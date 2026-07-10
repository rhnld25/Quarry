// Quarry desktop shell (Electron).
// Loads the Quarry app (the single-source `Quarry Analyst.dc.html`) in a window
// and injects the per-client license token so licensing works offline.
//
// Run in dev:   npm install && npm start   (needs Node.js installed)
// Package:      npm run build:win   /   npm run build:mac
const { app, BrowserWindow, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');

// --- locate the app HTML (dev: repo root next to /electron; packaged: resources/app) ---
function appHtmlPath() {
  const packaged = path.join(process.resourcesPath || '', 'app', 'Quarry Analyst.dc.html');
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, '..', 'Quarry Analyst.dc.html'); // dev
}

// --- read this client's license token, if present ---
// Looked up in order: alongside the executable/app, then Electron's userData dir.
function readLicenseToken() {
  const candidates = [
    path.join(path.dirname(appHtmlPath()), 'license.json'),
    path.join(__dirname, 'license.json'),
    path.join(app.getPath('userData'), 'license.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (j && typeof j.token === 'string' && j.token) return j.token;
      }
    } catch (e) { /* ignore malformed license file */ }
  }
  return '';
}

function createWindow() {
  const token = readLicenseToken();
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0e1117',
    title: 'Quarry',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Pass the license token to the renderer via preload (see preload.js).
      additionalArguments: token ? ['--quarry-license=' + token] : [],
    },
  });

  win.loadFile(appHtmlPath());

  // Open external links in the system browser, not inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // minimal, product-style chrome
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
