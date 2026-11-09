const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const paths = require("./paths");
const { writeLog } = require("./logger");

const API_URL = (process.env.ZOMBIE_API_URL || "https://zombielauncher-api.onrender.com").replace(/\/$/, "");
const STATE_FILE = path.join(paths.config, "content-state.json");

async function requestJSON(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Update API ${response.status}: ${await response.text()}`);
    return response.json();
}

async function sha256(file) {
    const hash = crypto.createHash("sha256");
    await new Promise((resolve, reject) => {
        const stream = fs.createReadStream(file);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("end", resolve);
        stream.on("error", reject);
    });
    return hash.digest("hex");
}

// 파일 하나당 전체 시간 제한 대신 "데이터가 일정 시간 안 오면 실패"로 판단한다 (느린 회선에서도 큰 파일을 받을 수 있게)
const IDLE_TIMEOUT_MS = 60000;
const MAX_ATTEMPTS = 4;

async function downloadOnce(url, destination, expectedSize) {
    const controller = new AbortController();
    let timer;
    const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => controller.abort(new Error(`${IDLE_TIMEOUT_MS / 1000}초 동안 데이터가 오지 않았습니다`)), IDLE_TIMEOUT_MS);
    };
    const temporary = `${destination}.download`;
    arm();
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok || !response.body) throw new Error(`Download ${response.status}: ${url}`);

        await fs.ensureDir(path.dirname(destination));
        const source = Readable.fromWeb(response.body);
        source.on("data", arm);
        await pipeline(source, fs.createWriteStream(temporary), { signal: controller.signal });

        if (expectedSize) {
            const stat = await fs.stat(temporary);
            if (stat.size !== Number(expectedSize)) {
                throw new Error(`파일 크기가 맞지 않습니다 (${stat.size} / ${expectedSize})`);
            }
        }
        await fs.move(temporary, destination, { overwrite: true });
    } catch (error) {
        await fs.remove(temporary).catch(() => {});
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

async function downloadFile(url, destination, expectedSize) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            await downloadOnce(url, destination, expectedSize);
            return;
        } catch (error) {
            lastError = error;
            const reason = error?.cause?.message || error?.message || String(error);
            writeLog("UPDATE ERROR", `${path.basename(destination)} 다운로드 실패 (${attempt}/${MAX_ATTEMPTS}): ${reason}`);
            if (attempt < MAX_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
    }
    throw lastError;
}

function destinationFor(file) {
    const folders = {
        mod: paths.mods,
        mods: paths.mods,
        shader: paths.shaderpacks,
        shaders: paths.shaderpacks,
        shaderpack: paths.shaderpacks,
        shaderpacks: paths.shaderpacks,
        resourcepack: paths.resourcepacks,
        resourcepacks: paths.resourcepacks
    };
    const folder = folders[file.type];
    return folder ? path.join(folder, path.basename(file.name)) : null;
}

function stateKey(file) {
    return `${file.type}/${path.basename(file.name)}`;
}

async function readState() {
    try {
        return await fs.readJson(STATE_FILE);
    } catch {
        return { files: {} };
    }
}

async function writeState(state) {
    await fs.ensureDir(path.dirname(STATE_FILE));
    await fs.writeJson(STATE_FILE, state, { spaces: 2 });
}

async function enableResourcePacks(files, previous) {
    const optionsFile = path.join(paths.minecraft, "options.txt");

    const desired = files
        .filter(file => file.type === "resourcepack")
        .map(file => `file/${path.basename(file.name)}`);
    const previouslyManaged = new Set(
        Object.keys(previous.files || {})
            .filter(key => key.startsWith("resourcepack/"))
            .map(key => `file/${key.slice("resourcepack/".length)}`)
    );
    await fs.ensureDir(path.dirname(optionsFile));
    const lines = await fs.pathExists(optionsFile)
        ? (await fs.readFile(optionsFile, "utf8")).split(/\r?\n/)
        : [];
    const languageIndex = lines.findIndex(line => line.startsWith("lang:"));
    if (languageIndex >= 0) lines[languageIndex] = "lang:ko_kr";
    else lines.push("lang:ko_kr");
    const index = lines.findIndex(line => line.startsWith("resourcePacks:"));
    let enabled = [];
    if (index >= 0) {
        try { enabled = JSON.parse(lines[index].slice("resourcePacks:".length)); } catch { enabled = []; }
    }
    enabled = enabled.filter(item => !previouslyManaged.has(item));
    for (const item of desired) if (!enabled.includes(item)) enabled.push(item);
    const value = `resourcePacks:${JSON.stringify(enabled)}`;
    if (index >= 0) lines[index] = value;
    else lines.push(value);
    await fs.writeFile(optionsFile, lines.join("\n"), "utf8");
}

async function checkUpdate(apiUrl = API_URL) {
    return requestJSON(`${apiUrl.replace(/\/$/, "")}/updates`);
}

async function update(onProgress = () => {}, apiUrl = API_URL) {
    const data = await checkUpdate(apiUrl);
    const files = Array.isArray(data.files) ? data.files : [];
    const previous = await readState();
    const next = { version: data.version || null, files: {} };
    const remoteKeys = new Set(files.map(stateKey));
    const failed = [];

    for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const target = destinationFor(file);
        if (!target || !file.url) continue;
        const key = stateKey(file);
        const signature = file.signature || `${file.updatedAt || ""}:${file.size || 0}`;
        let current = false;

        if (await fs.pathExists(target) && previous.files?.[key]?.signature === signature) {
            const stat = await fs.stat(target);
            current = !file.size || stat.size === Number(file.size);
        }

        if (!current && file.sha256 && await fs.pathExists(target)) {
            const currentHash = await sha256(target);
            if (currentHash.toLowerCase() === file.sha256.toLowerCase()) {
                current = true;
            }
        }

        if (!current) {
            try {
                await downloadFile(file.url, target, file.size);
                writeLog("UPDATE", `${file.name} downloaded`);
            } catch (error) {
                // 한 파일이 실패해도 나머지는 계속 받는다. 실패한 파일은 다음 업데이트 때 다시 시도한다.
                failed.push(path.basename(file.name));
                onProgress((index + 1) / files.length, file.name);
                continue;
            }
        }
        next.files[key] = { signature, size: Number(file.size) || 0 };
        // 받은 파일은 바로 기록해 둔다 (중간에 끊겨도 처음부터 다시 받지 않도록)
        await writeState({ version: previous.version || null, files: { ...(previous.files || {}), ...next.files } });
        onProgress((index + 1) / files.length, file.name);
    }

    for (const key of Object.keys(previous.files || {})) {
        if (remoteKeys.has(key)) continue;
        const separator = key.indexOf("/");
        const target = destinationFor({ type: key.slice(0, separator), name: key.slice(separator + 1) });
        if (target && await fs.pathExists(target)) {
            await fs.remove(target);
            writeLog("UPDATE", `${path.basename(target)} removed`);
        }
    }

    await enableResourcePacks(files, previous);
    await writeState(next);
    if (files.length === 0) onProgress(1, "");
    if (failed.length) {
        // 실패한 파일은 상태에서 빼서 다음에 다시 받게 한다
        throw new Error(`${failed.length}개 파일을 받지 못했습니다: ${failed.join(", ")}`);
    }

    return data.version || null;
}

module.exports = { checkUpdate, update };
