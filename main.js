const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Setup file logging
const logFile = path.join(app.getPath('userData'), 'app.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
function log(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  logStream.write(entry);
  console.log(msg);
}
ipcMain.on('log', (_e, ...args) => log('[RENDERER]', ...args));
log('--- App Start ---');

// Songs folder: put audio files (and optional .lrc/.txt lyrics with the same name) here
const songsDir = () => {
  const dir = app.isPackaged ? path.join(path.dirname(process.execPath), 'songs') : path.join(__dirname, 'songs');
  log('[DEBUG_LOG] app.isPackaged:', app.isPackaged);
  log('[DEBUG_LOG] Resolved songsDir:', dir);
  return dir;
};
const AUDIO = /\.(mp3|m4a|flac|wav|ogg|opus|aac)$/i;
function walk(dir, out = []) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out); else out.push(p);
    }
  } catch (e) {
    log('[DEBUG_LOG] Error walking directory:', dir, e.message);
  }
  return out;
}
ipcMain.handle('songs:scan', () => {
  const dir = songsDir();
  log('[DEBUG_LOG] Scanning directory:', dir);
  fs.mkdirSync(dir, { recursive: true });
  const files = walk(dir);
  log('[DEBUG_LOG] Found files:', files.length);
  if (files.length > 0) {
    log('[DEBUG_LOG] Files in folder:', files.map(p => path.basename(p)));
  }
  const audioFiles = files.filter(p => AUDIO.test(p));
  log('[DEBUG_LOG] Audio files:', audioFiles.length);
  return audioFiles.map(p => {
    const base = p.replace(/\.[^.]+$/, '');
    let lyrics = '';
    for (const ext of ['.lrc', '.txt']) {
      try { lyrics = fs.readFileSync(base + ext, 'utf8').trim(); if (lyrics) break; } catch (e) {}
    }
    return { path: p, file: path.basename(p), size: fs.statSync(p).size, lyrics };
  });
});
ipcMain.handle('songs:open', () => { fs.mkdirSync(songsDir(), { recursive: true }); return shell.openPath(songsDir()); });
ipcMain.handle('songs:import', (_e, filePath) => {
  const dir = songsDir();
  fs.mkdirSync(dir, { recursive: true });
  try {
    let dest = path.join(dir, path.basename(filePath));
    if (path.resolve(filePath).toLowerCase() === path.resolve(dest).toLowerCase()) return { success: true, path: dest }; // already in the folder
    if (fs.existsSync(dest)) {
      if (fs.statSync(dest).size === fs.statSync(filePath).size) return { success: true, path: dest }; // same song already copied
      const { name, ext } = path.parse(dest);
      let i = 2;
      while (fs.existsSync(dest = path.join(dir, `${name} (${i})${ext}`))) i++;
    }
    fs.copyFileSync(filePath, dest);
    log('Imported file to:', dest);
    return { success: true, path: dest };
  } catch (e) {
    log('Failed to import file:', filePath, e.message);
    return { success: false, error: e.message };
  }
});
// Reads a song from disk and hands the bytes to the player (avoids file:// and custom-protocol problems)
ipcMain.handle('songs:read', async (_e, p) => {
  if (!AUDIO.test(p)) throw new Error('Not an audio file');
  return fs.promises.readFile(p);
});

// Library (song paths, lyrics, playlists) is saved here so it survives restarts
const libFile = () => path.join(app.getPath('userData'), 'library.json');
ipcMain.handle('lib:load', () => {
  log('[DEBUG_LOG] Loading library from:', libFile());
  try {
    const data = JSON.parse(fs.readFileSync(libFile(), 'utf8'));
    log('[DEBUG_LOG] Library loaded, tracks:', data.tracks ? data.tracks.length : 0);
    return data;
  } catch (e) {
    log('[DEBUG_LOG] No library found or error loading:', e.message);
    return null;
  }
});
ipcMain.handle('lib:save', (_e, data) => {
  log('[DEBUG_LOG] Saving library. Tracks:', data.tracks ? data.tracks.length : 0);
  const tmp = libFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, libFile());
});
ipcMain.handle('logs:get', () => {
  try { return fs.readFileSync(logFile, 'utf8'); } catch (e) { return 'No logs found: ' + e.message; }
});

// Lets keyboard media keys (play/pause/next/prev) control the player
app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeyHandling,MediaSessionService');
// Allow audio to start without a prior click
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    title: 'Pulse',
    backgroundColor: '#171021',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  // Open any external link in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });