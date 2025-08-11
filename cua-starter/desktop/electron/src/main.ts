import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
app.commandLine.appendSwitch("remote-debugging-port", "9222");

let win: BrowserWindow;

app.whenReady().then(async () => {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    focusable: true,
    show: false,
    autoHideMenuBar: false,
    transparent: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
      webviewTag: true,
      webSecurity: true,
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    }
  });

  await win.loadURL(process.env.UI_URL ?? "http://localhost:3000");

  // Show window after everything is set up
  win.show();
  
  // Ensure normal window behavior
  win.setAlwaysOnTop(false);
  win.setVisibleOnAllWorkspaces(false);
  
  // Force normal window level on macOS
  if (process.platform === 'darwin') {
    win.setWindowButtonVisibility(true);
  }
});

// Modern approach: WebContentsView will be embedded in the renderer process
// Navigation will be handled by the web app itself