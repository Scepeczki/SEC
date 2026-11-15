// Bridge between the game page and the desktop shell (saves as files, updates). Exposed as window.desktop.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  /** current save file contents (or null) — synchronous so the game can start from it */
  readSave: () => ipcRenderer.sendSync('save:read'),
  /** write the save file — synchronous so it also works while the window is closing */
  writeSave: (json) => ipcRenderer.sendSync('save:write', json),
  saveDir: () => ipcRenderer.invoke('save:dir'),
  openSaveDir: () => ipcRenderer.invoke('save:open-dir'),
  exportSave: (json) => ipcRenderer.invoke('save:export', json),
  importSave: () => ipcRenderer.invoke('save:import'),
  version: () => ipcRenderer.invoke('app:version'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: (cb) => {
    const f = (_e, d) => cb(d);
    ipcRenderer.on('update', f);
    return () => ipcRenderer.removeListener('update', f);
  },
});
