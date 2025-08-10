import { app, BrowserWindow, BrowserView, ipcMain } from "electron";
import path from "node:path";
app.commandLine.appendSwitch("remote-debugging-port", "9222");
let win;
let view;
function layout() {
    const [w, h] = win.getContentSize();
    view.setBounds({ x: 420, y: 56, width: w - 420 - 16, height: h - 56 - 16 });
}
app.whenReady().then(async () => {
    win = new BrowserWindow({
        width: 1440,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    await win.loadURL(process.env.UI_URL ?? "http://localhost:3000");
    view = new BrowserView({ webPreferences: { contextIsolation: true } });
    win.setBrowserView(view);
    layout();
    win.on("resize", layout);
    await view.webContents.loadURL("about:blank");
});
ipcMain.handle("cua:nav", async (_e, url) => {
    if (!/^https?:\/\//i.test(url))
        url = `https://${url}`;
    await view.webContents.loadURL(url);
});
