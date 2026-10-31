// Pure Standalone Electron Desktop App (Self-Contained In-Process Server, Real File Persistence)
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow = null;
let localServer = null;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// If running packaged inside app.asar on Windows, extract dist/ to user profile so files are real physical files
function ensureDistAvailable() {
  // 1. Check if dist/index.html already exists physically on disk
  const physicalCandidates = [
    path.join(__dirname, 'dist'),
    path.join(process.resourcesPath, 'app', 'dist'),
    path.join(process.resourcesPath, 'dist'),
    path.join(app.getAppPath(), 'dist')
  ];

  for (const dir of physicalCandidates) {
    try {
      if (!dir.includes('.asar') && fs.existsSync(path.join(dir, 'index.html'))) {
        return dir;
      }
    } catch (e) {}
  }

  // 2. If running inside an ASAR archive, extract to app userData folder
  if (__dirname.includes('.asar') || process.resourcesPath.includes('.asar')) {
    try {
      let asarPath = null;
      if (__dirname.includes('.asar')) {
        asarPath = __dirname.split(/\.asar[\\\/]?/)[0] + '.asar';
      } else {
        asarPath = path.join(process.resourcesPath, 'app.asar');
      }

      if (fs.existsSync(asarPath)) {
        const destDir = path.join(app.getPath('userData'), 'extracted-dist');
        const targetIndex = path.join(destDir, 'index.html');

        let asar = null;
        try { asar = require('@electron/asar'); } catch (e) {
          try { asar = require('asar'); } catch (e2) {}
        }

        if (asar) {
          if (!fs.existsSync(targetIndex)) {
            console.log('[Electron] Extracting bundled assets to:', destDir);
            try { fs.mkdirSync(destDir, { recursive: true }); } catch (e) {}
            asar.extractAll(asarPath, destDir);
          }

          if (fs.existsSync(targetIndex)) {
            return destDir;
          }
          if (fs.existsSync(path.join(destDir, 'dist', 'index.html'))) {
            return path.join(destDir, 'dist');
          }
        }
      }
    } catch (e) {
      console.warn('[Electron] ASAR extraction notice:', e.message);
    }
  }

  // Fallback to standard __dirname/dist
  return path.join(__dirname, 'dist');
}

// Read file helper with dual-layer fallback (regular fs + direct ASAR buffer extraction)
function readAppFile(dir, relPath) {
  const filePath = path.join(dir, relPath);

  // Layer 1: Normal filesystem read
  try {
    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
      return fs.readFileSync(filePath);
    }
  } catch (e) {}

  // Layer 2: Direct ASAR extraction if in asar
  if (dir.includes('.asar') || filePath.includes('.asar')) {
    const parts = filePath.split(/\.asar[\\\/]/);
    if (parts.length >= 2) {
      const asarPath = parts[0] + '.asar';
      const internalPath = parts[1].replace(/\\/g, '/');
      try {
        let asar = null;
        try { asar = require('@electron/asar'); } catch (e1) {
          try { asar = require('asar'); } catch (e2) {}
        }
        if (asar) {
          return asar.extractFile(asarPath, internalPath);
        }
      } catch (e) {}
    }
  }

  return null;
}

// Locate database file paths (portable folder beside .exe and app userData profile)
function getDatabaseTargetFiles() {
  const targets = [];
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    targets.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'ccf_database.json'));
    targets.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data', 'ccf_database.json'));
  }
  try {
    const userData = app.getPath('userData');
    targets.push(path.join(userData, 'ccf_database.json'));
    targets.push(path.join(userData, 'data', 'ccf_database.json'));
  } catch (e) {}

  targets.push(path.join(process.cwd(), 'ccf_database.json'));
  targets.push(path.join(process.cwd(), 'data', 'ccf_database.json'));

  if (!__dirname.includes('app.asar')) {
    targets.push(path.join(__dirname, 'data', 'ccf_database.json'));
    targets.push(path.join(__dirname, 'ccf_database.json'));
  }
  return [...new Set(targets)];
}

// Start in-process HTTP engine
function startInProcessEngine(callback) {
  const distDir = ensureDistAvailable();
  console.log('[Electron] Serving application from:', distDir);

  localServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = new URL(req.url, 'http://127.0.0.1');
    const pathname = parsedUrl.pathname;

    // 1. In-process database API endpoints
    if (pathname === '/api/database' || pathname === '/api/database/') {
      const candidates = getDatabaseTargetFiles();

      if (req.method === 'GET') {
        let bestRaw = null;
        let maxRows = -1;

        for (const file of candidates) {
          if (fs.existsSync(file)) {
            try {
              const raw = fs.readFileSync(file, 'utf-8');
              const parsed = JSON.parse(raw);
              const rows = Array.isArray(parsed) ? parsed : (parsed.rows || []);
              if (rows.length > maxRows) {
                maxRows = rows.length;
                bestRaw = JSON.stringify({
                  success: true,
                  count: rows.length,
                  rows: rows,
                  lastUpdated: parsed.lastUpdated || new Date().toISOString()
                });
              }
            } catch (e) {
              console.warn(`[Electron] Could not parse database file ${file}:`, e.message);
            }
          }
        }

        if (bestRaw && maxRows > 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(bestRaw);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, count: 0, rows: [] }));
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          let anySaved = false;
          let parsedRows = [];
          try {
            const parsed = JSON.parse(body);
            parsedRows = Array.isArray(parsed) ? parsed : (parsed.rows || []);
          } catch (e) {}

          const payloadToSave = JSON.stringify({
            success: true,
            version: 1,
            engine: 'Local JSON File Database (Portable Electron Ready)',
            lastUpdated: new Date().toISOString(),
            count: parsedRows.length,
            rows: parsedRows
          }, null, 2);

          for (const file of candidates) {
            try {
              const dir = path.dirname(file);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(file, payloadToSave, 'utf-8');
              anySaved = true;
              console.log(`[Electron] Successfully persisted ${parsedRows.length} rows to ${file}`);
            } catch (e) {
              console.warn(`[Electron] Could not save database to ${file}:`, e.message);
            }
          }

          if (anySaved) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true, count: parsedRows.length }));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: 'Failed writing to disk' }));
          }
        });
        return;
      }

      if (req.method === 'DELETE') {
        for (const file of candidates) {
          try {
            if (fs.existsSync(file)) fs.unlinkSync(file);
          } catch (e) {}
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      }
    }

    // 2. Static files serving with dual-layer resolution
    let relPath = pathname.startsWith('/') ? pathname.substring(1) : pathname;
    if (!relPath || relPath === '/') {
      relPath = 'index.html';
    }

    // Try reading requested file
    let content = readAppFile(distDir, relPath);

    if (content) {
      const ext = path.extname(relPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      return res.end(content);
    }

    // SPA Fallback: Serve index.html for client-side routes
    content = readAppFile(distDir, 'index.html');
    if (!content && distDir.includes('dist')) {
      content = readAppFile(path.dirname(distDir), 'index.html');
    }

    if (content) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      return res.end(content);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Not found: ${relPath}`);
  });

  localServer.listen(0, '127.0.0.1', () => {
    const port = localServer.address().port;
    console.log(`[Electron] In-process server listening on http://127.0.0.1:${port}`);
    callback(port);
  });

  localServer.on('error', (err) => {
    console.error('[Electron] Server error:', err);
  });
}

function createWindow(port) {
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
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

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
    if (localServer) {
      try { localServer.close(); } catch (e) {}
    }
  });
}

app.whenReady().then(() => {
  startInProcessEngine((port) => {
    createWindow(port);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      startInProcessEngine((port) => {
        createWindow(port);
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (localServer) {
    try { localServer.close(); } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
