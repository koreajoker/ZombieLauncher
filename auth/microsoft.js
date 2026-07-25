const { BrowserWindow } = require("electron");
const axios = require("axios");
const http = require("http");
const { xboxLogin } = require("./xbox");
const { xstsLogin } = require("./xsts");
const { minecraftLogin, profile } = require("./minecraft");

const CLIENT_ID = "219e3606-4a8f-4d80-9eb8-6d381dc45c2b";
const CALLBACK_PORT = 4567;
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}/callback`;

let activeLogin = null;
let loginWindow = null;

function microsoftLogin() {
    if (activeLogin) {
        if (loginWindow && !loginWindow.isDestroyed()) {
            loginWindow.show();
            loginWindow.focus();
        }
        return activeLogin;
    }

    activeLogin = new Promise((resolve, reject) => {
        let settled = false;
        let callbackServer = null;
        let timeout = null;

        const finish = (error, account) => {
            if (settled) return;
            settled = true;
            if (timeout) clearTimeout(timeout);
            if (callbackServer?.listening) callbackServer.close();
            if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();
            loginWindow = null;
            if (error) reject(error);
            else resolve(account);
        };

        callbackServer = http.createServer(async (req, res) => {
            if (!req.url?.startsWith("/callback")) {
                res.writeHead(404);
                res.end();
                return;
            }

            const callbackURL = new URL(req.url, REDIRECT_URI);
            const oauthError = callbackURL.searchParams.get("error_description");
            const code = callbackURL.searchParams.get("code");

            if (!code) {
                res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
                res.end("<h2>ZombieLauncher 로그인 실패</h2><p>창을 닫아주세요.</p>");
                finish(new Error(oauthError || "Microsoft 인증 코드가 없습니다."));
                return;
            }

            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end("<h2>ZombieLauncher 로그인 완료</h2><p>이 창은 자동으로 닫힙니다.</p>");
            callbackServer.close();

            try {
                const microsoftTokens = await exchangeCode(code);
                const account = await createMinecraftAccount(microsoftTokens);
                finish(null, account);
            } catch (error) {
                console.error("LOGIN ERROR", error.response?.data || error.message);
                finish(new Error(error.response?.data?.errorMessage || error.message || "Microsoft 로그인 실패"));
            }
        });

        callbackServer.once("error", error => {
            const message = error.code === "EADDRINUSE"
                ? "Microsoft 로그인 포트가 이미 사용 중입니다. 실행 중인 ZombieLauncher를 모두 종료한 뒤 다시 실행하세요."
                : `Microsoft 로그인 서버 오류: ${error.message}`;
            finish(new Error(message));
        });

        callbackServer.listen(CALLBACK_PORT, "127.0.0.1", () => {
            loginWindow = new BrowserWindow({
                width: 500,
                height: 700,
                resizable: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true
                }
            });

            const params = new URLSearchParams({
                client_id: CLIENT_ID,
                response_type: "code",
                redirect_uri: REDIRECT_URI,
                response_mode: "query",
                scope: "XboxLive.signin offline_access openid profile"
            });
            loginWindow.loadURL(`https://login.live.com/oauth20_authorize.srf?${params}`);
            loginWindow.on("closed", () => {
                loginWindow = null;
                if (!settled) finish(new Error("Microsoft 로그인이 취소되었습니다."));
            });
        });

        timeout = setTimeout(() => {
            finish(new Error("Microsoft 로그인 시간이 초과되었습니다."));
        }, 10 * 60 * 1000);
    }).finally(() => {
        activeLogin = null;
    });

    return activeLogin;
}

async function exchangeCode(code) {
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI
    });
    const response = await axios.post(
        "https://login.live.com/oauth20_token.srf",
        body.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return response.data;
}

async function refreshMicrosoftToken(refreshToken) {
    if (!refreshToken) {
        throw new Error("로그인 세션이 만료되었습니다. Microsoft 계정으로 다시 로그인해 주세요.");
    }

    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        redirect_uri: REDIRECT_URI,
        scope: "XboxLive.signin offline_access openid profile"
    });
    const response = await axios.post(
        "https://login.live.com/oauth20_token.srf",
        body.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return response.data;
}

async function createMinecraftAccount(microsoftTokens) {
    const xbox = await xboxLogin(microsoftTokens.access_token);
    const xsts = await xstsLogin(xbox);
    const minecraft = await minecraftLogin(xsts);
    const user = await profile(minecraft.access_token);

    return {
        name: user.name,
        uuid: user.id,
        minecraftToken: minecraft.access_token,
        accessToken: minecraft.access_token,
        refreshToken: microsoftTokens.refresh_token,
        expiresAt: Date.now() + (Number(minecraft.expires_in) || 86400) * 1000,
        xuid: xsts.DisplayClaims?.xui?.[0]?.xid || xbox.DisplayClaims?.xui?.[0]?.xid || "",
        userType: "msa",
        clientId: CLIENT_ID,
        profile: { id: user.id, name: user.name }
    };
}

async function refreshMinecraftAccount(account) {
    try {
        const microsoftTokens = await refreshMicrosoftToken(account?.refreshToken);
        if (!microsoftTokens.refresh_token) {
            microsoftTokens.refresh_token = account.refreshToken;
        }
        return await createMinecraftAccount(microsoftTokens);
    } catch (error) {
        console.error("TOKEN REFRESH ERROR", error.response?.data?.error || error.message);
        throw new Error("로그인 세션이 만료되었습니다. 로그아웃 후 Microsoft 계정으로 다시 로그인해 주세요.");
    }
}

module.exports = { microsoftLogin, refreshMinecraftAccount };
