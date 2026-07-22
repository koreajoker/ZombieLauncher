const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcher", {
    login: () => ipcRenderer.invoke("login-microsoft"),
    onLoginSuccess: callback => ipcRenderer.on("login-success", (_event, account) => callback(account)),
    getAccount: () => ipcRenderer.invoke("get-account"),
    logout: () => ipcRenderer.invoke("logout"),
    play: () => ipcRenderer.invoke("minecraft-launch"),
    saveSettings: data => ipcRenderer.invoke("save-settings", data),
    loadSettings: () => ipcRenderer.invoke("load-settings"),
    adminLogin: password => ipcRenderer.invoke("admin-login", password),
    loadLauncherConfig: () => ipcRenderer.invoke("load-launcher-config"),
    checkUpdate: () => ipcRenderer.invoke("check-update"),
    onProgress: callback => ipcRenderer.on("update-progress", (_event, data) => callback(data.progress, data.name)),
    minimize: () => ipcRenderer.send("window-minimize"),
    close: () => ipcRenderer.send("window-close")
});

contextBridge.exposeInMainWorld("admin", {
    files: () => ipcRenderer.invoke("admin-files"),
    upload: type => ipcRenderer.invoke("admin-upload-file", type),
    deleteFile: id => ipcRenderer.invoke("admin-delete-file", id),
    saveConfig: data => ipcRenderer.invoke("admin-save-config", data),
    close: () => ipcRenderer.invoke("admin-close")
});

contextBridge.exposeInMainWorld("api", {
    minimize: () => ipcRenderer.send("window-minimize"),
    maximize: () => ipcRenderer.send("window-maximize"),
    close: () => ipcRenderer.send("window-close"),
    openAdmin: () => ipcRenderer.send("open-admin"),
    openExternal: url => ipcRenderer.invoke("open-external", url)
});
