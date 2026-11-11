const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  pathOf: (file) => webUtils.getPathForFile(file),
  read: (p) => ipcRenderer.invoke('songs:read', p),
  scan: () => ipcRenderer.invoke('songs:scan'),
  importFile: (p) => ipcRenderer.invoke('songs:import', p),
  openSongs: () => ipcRenderer.invoke('songs:open'),
  load: () => ipcRenderer.invoke('lib:load'),
  save: (data) => ipcRenderer.invoke('lib:save', data),
  log: (...args) => ipcRenderer.send('log', ...args),
  getLogs: () => ipcRenderer.invoke('logs:get')
});