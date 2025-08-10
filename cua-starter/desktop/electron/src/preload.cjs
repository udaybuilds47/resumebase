const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("cua", {
  nav: (url) => ipcRenderer.invoke("cua:nav", url)
});