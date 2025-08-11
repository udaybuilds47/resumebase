const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("cua", {
  // Modern approach: WebContentsView will be embedded in the renderer
  // No need for IPC navigation
});