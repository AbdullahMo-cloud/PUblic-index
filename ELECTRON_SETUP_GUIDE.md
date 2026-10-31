# Electron Portable Standalone Desktop Application

Pure serverless Electron desktop application that loads the compiled React app directly (`dist/index.html`). No background server, no localhost, zero installation required.

---

## 1. Quick Build (Exact 3 Commands)

In your project root (e.g., `D:\APP Des\change\factory index V6`):

```bash
# Step 1: Install dependencies
npm install

# Step 2: Build the React frontend
npm run build

# Step 3: Package into portable desktop app
npm run dist
```

---

## 2. Output Location: `dist-desktop\`

After running `npm run dist`, the output will be in **`dist-desktop\`**:

```
dist-desktop\
├── win-unpacked\                           (Unpacked application folder)
├── builder-debug.yml                       (Build diagnostic file)
├── builder-effective-config.yaml           (Resolved builder config)
├── Change Factory Index V.1.0.0.exe       (Single standalone portable application with Etisalat icon)
└── Change Factory Index V.1.0.0.zip       (Compressed zipped distribution)
```

---

## 3. How It Works (Serverless & Portable)

1. **Direct File Loading (`mainWindow.loadFile`)**:
   - `electron.js` loads `dist/index.html` directly from the package without spawning any local HTTP server.
   - Zero terminal popups, zero port 3000 conflicts, zero localhost in browser.

2. **Official Etisalat Icon**:
   - The standalone `.exe`, taskbar, and window header are automatically branded with `public/etisalat.ico`.

3. **Persistent Local Storage**:
   - All tracker records and matrix computations are stored automatically and persistently in local high-capacity IndexedDB within the app's persistent storage profile.
   - Excel export/import and offline backups remain fully functional.
