// Pure Standalone Electron Desktop App with Native App Protocol (Zero-CORS, Full ES Module Support, No HTTP Ports)
const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// 1. MUST register standard secure scheme BEFORE app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

let mainWindow = null;
const isDev = !app.isPackaged;

// Robust resolution for production dist/ directory
function getDistDir() {
  const appPath = app.getAppPath();
  const candidates = [
    path.join(__dirname, 'dist'),
    path.join(appPath, 'dist'),
    path.join(process.resourcesPath, 'app', 'dist'),
    path.join(process.resourcesPath, 'app.asar', 'dist'),
    __dirname,
    appPath
  ];

  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'index.html'))) {
        console.log('[Electron] Found index.html at:', dir);
        return dir;
      }
    } catch (e) {}
  }

  return path.join(__dirname, 'dist');
}

// Locate database file paths (prioritize portable folder beside .exe and app userData)
function getDatabaseTargetFiles() {
  const targets = [];
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    targets.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'ccf_database.json'));
    targets.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data', 'ccf_database.json'));
  }
  try {
    const userData = app.getPath('userData');
    targets.push(path.join(userData, 'ccf_database.json'));
  } catch (e) {}

  if (!__dirname.includes('app.asar')) {
    targets.push(path.join(__dirname, 'data', 'ccf_database.json'));
  }
  return targets;
}

function setupAppProtocol() {
  protocol.handle('app', async (request) => {
    try {
      const parsedUrl = new URL(request.url);
      const pathname = decodeURIComponent(parsedUrl.pathname);

      // 1. Database API handler
      if (pathname === '/api/database' || pathname === 'api/database') {
        const candidates = getDatabaseTargetFiles();

        if (request.method === 'GET') {
          let bestRaw = null;
          let maxRows = -1;

          for (const file of candidates) {
            if (fs.existsSync(file)) {
              try {
                const raw = fs.readFileSync(file, 'utf-8');
                const parsed = JSON.parse(raw);
                const count = Array.isArray(parsed) ? parsed.length : (parsed.rows?.length || 0);
                if (count > maxRows) {
                  maxRows = count;
                  bestRaw = raw;
                }
              } catch (e) {}
            }
          }

          if (bestRaw && maxRows > 0) {
            return new Response(bestRaw, {
              headers: { 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ success: true, rows: [] }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (request.method === 'POST') {
          const body = await request.text();
          let anySaved = false;
          for (const file of candidates) {
            try {
              const dir = path.dirname(file);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(file, body, 'utf-8');
              anySaved = true;
            } catch (e) {
              console.warn(`[Electron] Could not save database to ${file}:`, e.message);
            }
          }

          return new Response(JSON.stringify({ success: anySaved }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (request.method === 'DELETE') {
          for (const file of candidates) {
            try {
              if (fs.existsSync(file)) fs.unlinkSync(file);
            } catch (e) {}
          }
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 2. Static Assets Handler
      const distDir = getDistDir();
      let relPath = pathname.startsWith('/') ? pathname.substring(1) : pathname;
      if (!relPath || relPath === '/') {
        relPath = 'index.html';
      }

      let filePath = path.join(distDir, relPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      return net.fetch(pathToFileURL(filePath).toString());
    } catch (err) {
      console.error('[Electron] Protocol handle error:', err);
      // Fallback SPA index.html
      const distDir = getDistDir();
      const fallbackPath = path.join(distDir, 'index.html');
      return net.fetch(pathToFileURL(fallbackPath).toString());
    }
  });
}

function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, 'build', 'icon.png'))
    ? path.join(__dirname, 'build', 'icon.png')
    : path.join(__dirname, 'public', 'etisalat-icon.png');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Change Factory Index',
    icon: iconPath,
    backgroundColor: '#0F172A',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  // Load via native secure 'app://' protocol (Zero-CORS, direct C++ streaming, no HTTP ports)
  mainWindow.loadURL('app://./index.html');

  // Allow F12 to toggle DevTools if needed
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupAppProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
