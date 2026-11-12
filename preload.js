const { contextBridge, ipcRenderer, webUtils } = require('electron');
const os = require('os');

let username = 'PDFacil';
try {
  username = os.userInfo().username || username;
} catch {}

contextBridge.exposeInMainWorld('api', {
  username,
  platform: process.platform,
  startupPath: () => ipcRenderer.invoke('startup-path'),
  version: () => ipcRenderer.invoke('app-version'),
  getRecent: () => ipcRenderer.invoke('get-recent'),
  removeRecent: (p) => ipcRenderer.invoke('remove-recent', p),
  openDialog: () => ipcRenderer.invoke('open-dialog'),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  pickFolder: (title, defaultPath) => ipcRenderer.invoke('pick-folder', title, defaultPath),
  zotero: {
    config: () => ipcRenderer.invoke('zotero:config'),
    connect: (key, dataDir, baseDir) => ipcRenderer.invoke('zotero:connect', key, dataDir, baseDir),
    folders: (dataDir, baseDir) => ipcRenderer.invoke('zotero:folders', dataDir, baseDir),
    disconnect: () => ipcRenderer.invoke('zotero:disconnect'),
    api: (method, path, opts) => ipcRenderer.invoke('zotero:api', method, path, opts),
    file: (lib, attKey, data) => ipcRenderer.invoke('zotero:file', lib, attKey, data),
    keyForPath: (p) => ipcRenderer.invoke('zotero:key-for-path', p),
  },
  readBytes: (p) => ipcRenderer.invoke('read-bytes', p),
  saveDialog: (suggested, kind) => ipcRenderer.invoke('save-dialog', suggested, kind),
  writeFile: (p, bytes) => ipcRenderer.invoke('write-file', p, bytes),
  confirm: (msg, buttons) => ipcRenderer.invoke('confirm', msg, buttons),
  error: (msg) => ipcRenderer.invoke('error', msg),
  printPages: (pages) => ipcRenderer.invoke('print-pages', pages),
  setDirty: (v) => ipcRenderer.send('set-dirty', v),
  setTitle: (t) => ipcRenderer.send('set-title', t),
  forceClose: () => ipcRenderer.send('force-close'),
  pathForFile: (file) => webUtils.getPathForFile(file),
  onOpenPath: (cb) => ipcRenderer.on('open-path', (_e, p) => cb(p)),
  onSaveAndClose: (cb) => ipcRenderer.on('save-and-close', () => cb()),
});
