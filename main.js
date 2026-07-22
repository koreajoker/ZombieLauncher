const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { microsoftLogin } = require("./auth/microsoft");
const { launchMinecraft } = require("./launcher/minecraft");
const { saveAccount, getAccount, removeAccount } = require("./launcher/account");
const { update } = require("./launcher/updater");

const API_URL = (
    process.env.ZOMBIE_API_URL ||
    (app.isPackaged ? "https://zombielauncher-api.onrender.com" : "http://127.0.0.1:3000")
).replace(/\/$/, "");
const ADMIN_PASSWORD = process.env.ZOMBIE_ADMIN_PASSWORD || "Frogfried1026";
const CONFIG_DIR = path.join(app.getPath("userData"), "config");
const SETTINGS_CONFIG = path.join(CONFIG_DIR, "settings.json");
const ALLOWED_UPLOAD_TYPES = new Set(["mod", "shader", "resourcepack"]);

let mainWindow = null;
let adminWindow = null;
let adminAuthenticated = false;
let updatePromise = null;
let adminCredential = null;

// `npm start` 개발 실행에서는 로컬 API를 함께 실행한다.
// 배포 빌드는 Render API만 사용하며 server/.env를 포함하지 않는다.
if (!app.isPackaged && !process.env.ZOMBIE_API_URL) {
    require("./server/server");
}

function readConfig(file, fallback = {}) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return fallback;
    }
}

function writeConfig(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 4), "utf8");
}

async function apiRequest(route, options = {}) {
    const response = await fetch(`${API_URL}${route}`, {
        ...options,
        signal: options.signal || AbortSignal.timeout(120000)
    });
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
        ? await response.json()
        : { message: await response.text() };
    if (!response.ok) throw new Error(body.message || `API 요청 실패 (${response.status})`);
    return body;
}

function requireAdmin(event) {
    if (!adminAuthenticated || !adminWindow || event.sender !== adminWindow.webContents) {
        throw new Error("관리자 인증이 필요합니다.");
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        frame: false,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.loadFile(path.join(__dirname, "src", "renderer", "index.html"));
    mainWindow.webContents.once("did-finish-load", () => runAutomaticUpdate());
    mainWindow.on("closed", () => { mainWindow = null; });
}

function createAdminWindow() {
    if (!adminAuthenticated) return false;
    if (adminWindow && !adminWindow.isDestroyed()) {
        adminWindow.focus();
        return true;
    }
    adminWindow = new BrowserWindow({
        width: 900,
        height: 700,
        frame: false,
        resizable: true,
        parent: mainWindow || undefined,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    adminWindow.loadFile(path.join(__dirname, "src", "renderer", "admin.html"));
    adminWindow.on("closed", () => {
        adminWindow = null;
        adminAuthenticated = false;
        adminCredential = null;
    });
    return true;
}

async function runAutomaticUpdate() {
    if (updatePromise) return updatePromise;
    updatePromise = update((progress, name) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("update-progress", { progress, name });
        }
    }, API_URL).then(version => ({ success: true, version }))
      .catch(error => ({ success: false, message: error.message }))
      .finally(() => { updatePromise = null; });
    return updatePromise;
}

app.whenReady().then(createWindow);
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

ipcMain.on("window-minimize", event => BrowserWindow.fromWebContents(event.sender)?.minimize());
ipcMain.on("window-close", event => BrowserWindow.fromWebContents(event.sender)?.close());
ipcMain.on("window-maximize", event => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on("discord", async () => {
    try {
        const config = await apiRequest("/config");
        if (typeof config.discord === "string" && /^https?:\/\//.test(config.discord)) {
            await shell.openExternal(config.discord);
        }
    } catch (error) {
        console.error("Discord URL error:", error);
    }
});
ipcMain.handle("open-external", async (_event, url) => {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) return false;
    await shell.openExternal(url);
    return true;
});

ipcMain.handle("admin-login", (_event, password) => {
    const valid = typeof password === "string" && password === ADMIN_PASSWORD;
    adminCredential = valid ? password : null;
    adminAuthenticated = valid;
    return valid;
});
ipcMain.on("open-admin", () => createAdminWindow());
ipcMain.handle("admin-close", event => {
    requireAdmin(event);
    adminWindow.close();
    return true;
});
ipcMain.handle("admin-files", event => {
    requireAdmin(event);
    return apiRequest("/files");
});
ipcMain.handle("admin-delete-file", (event, id) => {
    requireAdmin(event);
    return apiRequest(`/file/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-admin-password": adminCredential }
    });
});
ipcMain.handle("admin-save-config", (event, data) => {
    requireAdmin(event);
    return apiRequest("/admin/save", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-admin-password": adminCredential
        },
        body: JSON.stringify(data)
    });
});
ipcMain.handle("admin-upload-file", async (event, type) => {
    requireAdmin(event);
    if (!ALLOWED_UPLOAD_TYPES.has(type)) throw new Error("지원하지 않는 파일 종류입니다.");
    const filters = type === "mod"
        ? [{ name: "Minecraft Mod", extensions: ["jar"] }]
        : [{ name: "ZIP archive", extensions: ["zip"] }];
    const selected = await dialog.showOpenDialog(adminWindow, { properties: ["openFile"], filters });
    if (selected.canceled || !selected.filePaths[0]) return { success: false, canceled: true };

    const filePath = selected.filePaths[0];
    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
    return apiRequest(`/upload/${type}`, {
        method: "POST",
        headers: { "x-admin-password": adminCredential },
        body: form
    });
});

ipcMain.handle("load-launcher-config", async () => {
    try {
        return await apiRequest("/config");
    } catch (error) {
        console.error("API config error:", error);
        return { discord: "", notice: "", news: "", mods: [], resourcepacks: [], shaders: [] };
    }
});
ipcMain.handle("save-settings", (_event, data) => { writeConfig(SETTINGS_CONFIG, data); return true; });
ipcMain.handle("load-settings", () => readConfig(SETTINGS_CONFIG, { minRam: 1024, maxRam: 4096 }));

ipcMain.handle("login-microsoft", async () => {
    try {
        const account = await microsoftLogin();
        saveAccount(account);
        mainWindow?.webContents.send("login-success", account);
        return { success: true, account };
    } catch (error) {
        return { success: false, message: error.message };
    }
});
ipcMain.handle("get-account", () => getAccount());
ipcMain.handle("logout", () => { removeAccount(); return true; });
ipcMain.handle("minecraft-launch", async () => {
    try {
        const account = getAccount();
        if (!account) throw new Error("먼저 로그인하세요.");
        const syncResult = await runAutomaticUpdate();
        if (!syncResult.success) throw new Error(`콘텐츠 자동 다운로드 실패: ${syncResult.message}`);
        await launchMinecraft(account);
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
});
ipcMain.handle("check-update", runAutomaticUpdate);
