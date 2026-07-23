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

async function downloadFile(url, destination) {
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) throw new Error(`Download ${response.status}: ${url}`);

    await fs.ensureDir(path.dirname(destination));
    const temporary = `${destination}.download`;

    try {
        await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temporary));
        await fs.move(temporary, destination, { overwrite: true });
    } catch (error) {
        await fs.remove(temporary);
        throw error;
    }
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
            await downloadFile(file.url, target);
            writeLog("UPDATE", `${file.name} downloaded`);
        }
        next.files[key] = { signature, size: Number(file.size) || 0 };
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

    return data.version || null;
}

module.exports = { checkUpdate, update };
