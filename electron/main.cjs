// Desktop shell: one window with the game (no local server, no console window), saves as plain files in
// Documents\SEC\ (easy to copy to another computer), and automatic updates from GitHub Releases.

const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const APP_NAME = 'SEC';
const WINDOW_TITLE = 'SEC — Self-Organizing Entropic Complex';
/** saves of version 0.1.0 (the game was called "Park Wymarłych") */
const OLD_SAVE_DIR = 'Park Wymarłych';
app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId('com.scepeczki.parkwymarlych');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win = null;

// ---------------------------------------------------------------- saves (plain JSON files)

// SEC_SAVE_DIR: test runs use their own folder and never touch the player's saves
const saveDir = () => process.env.SEC_SAVE_DIR || path.join(app.getPath('documents'), APP_NAME);
const savePath = () => path.join(saveDir(), 'zapis.json');
const backupPath = (n) => path.join(saveDir(), `zapis-kopia-${n}.json`);

/** first start after the rename: bring the old save folder's files over (the old folder stays as it was) */
function migrateOldSaves() {
  if (process.env.SEC_SAVE_DIR) return;
  try {
    const old = path.join(app.getPath('documents'), OLD_SAVE_DIR);
    if (fs.existsSync(savePath()) || !fs.existsSync(path.join(old, 'zapis.json'))) return;
    fs.mkdirSync(saveDir(), { recursive: true });
    for (const f of fs.readdirSync(old)) if (f.endsWith('.json')) fs.copyFileSync(path.join(old, f), path.join(saveDir(), f));
  } catch (e) { console.error('save migration failed', e); }
}

function readSave() {
  for (const p of [savePath(), backupPath(1), backupPath(2)]) {
    try {
      const txt = fs.readFileSync(p, 'utf8');
      JSON.parse(txt); // only return a file that is valid
      return txt;
    } catch { /* try the next one */ }
  }
  return null;
}

let lastBackup = 0;
function writeSave(json) {
  try {
    fs.mkdirSync(saveDir(), { recursive: true });
    // keep two rolling backups (refreshed at most every 10 minutes)
    if (Date.now() - lastBackup > 10 * 60 * 1000 && fs.existsSync(savePath())) {
      try { if (fs.existsSync(backupPath(1))) fs.copyFileSync(backupPath(1), backupPath(2)); } catch { /* */ }
      try { fs.copyFileSync(savePath(), backupPath(1)); } catch { /* */ }
      lastBackup = Date.now();
    }
    const tmp = savePath() + '.tmp';
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, savePath());
    return true;
  } catch (e) {
    console.error('save failed', e);
    return false;
  }
}

ipcMain.on('save:read', (e) => { e.returnValue = readSave(); });
ipcMain.on('save:write', (e, json) => { e.returnValue = writeSave(json); });
ipcMain.handle('save:dir', () => saveDir());
ipcMain.handle('save:open-dir', () => { fs.mkdirSync(saveDir(), { recursive: true }); return shell.openPath(saveDir()); });
ipcMain.handle('save:export', async (_e, json) => {
  const stamp = new Date().toISOString().slice(0, 10);
  const r = await dialog.showSaveDialog(win, {
    title: 'Zapisz kopię gry',
    defaultPath: path.join(app.getPath('desktop'), `park-wymarlych-${stamp}.json`),
    filters: [{ name: 'Zapis gry', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, json, 'utf8');
  return r.filePath;
});
ipcMain.handle('save:import', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Wczytaj zapis gry', properties: ['openFile'], filters: [{ name: 'Zapis gry', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});
ipcMain.handle('app:version', () => app.getVersion());

// ---------------------------------------------------------------- updates (GitHub Releases)

let updater = null;
function setupUpdates() {
  if (!app.isPackaged) return;
  try {
    updater = require('electron-updater').autoUpdater;
  } catch { return; }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  const send = (kind, data) => win?.webContents.send('update', { kind, ...data });
  updater.on('update-available', (i) => send('available', { version: i.version }));
  updater.on('download-progress', (p) => send('progress', { percent: p.percent }));
  updater.on('update-downloaded', (i) => send('ready', { version: i.version, notes: typeof i.releaseNotes === 'string' ? i.releaseNotes : '' }));
  updater.on('error', (e) => console.warn('update error', e?.message));
  const check = () => updater.checkForUpdates().catch(() => { /* offline */ });
  setTimeout(check, 4000);
  setInterval(check, 60 * 60 * 1000);
}
ipcMain.handle('update:install', () => { updater?.quitAndInstall(false, true); });

// ---------------------------------------------------------------- window

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#14130e',
    title: WINDOW_TITLE,
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // links (e.g. Paleobiology Database) open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  // F11 full screen, F12 dev tools (for bug reports)
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') win.setFullScreen(!win.isFullScreen());
    if (input.key === 'F12') win.webContents.toggleDevTools();
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { migrateOldSaves(); createWindow(); setupUpdates(); });
app.on('window-all-closed', () => app.quit());
