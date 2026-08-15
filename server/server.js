const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const { Readable } = require("stream");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const localEnv = path.join(__dirname, ".env");
if (fs.existsSync(localEnv)) {
    for (const line of fs.readFileSync(localEnv, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
    }
}

const app = express();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES) || 200 * 1024 * 1024 }
});
const PORT = Number(process.env.PORT) || 3000;
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "launcher";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const STORAGE_CHUNK_BYTES = Number(process.env.STORAGE_CHUNK_BYTES) || 25 * 1024 * 1024;
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "https://pub-f98c037de28142368ae5d8959bf79267.r2.dev").replace(/\/$/, "");
const R2_MANIFEST_URL = process.env.R2_MANIFEST_URL || `${R2_PUBLIC_URL}/manifest.json`;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "cfb80e890e1b8bb91cdba3c287138b67";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET = process.env.R2_BUCKET || "zombielauncher-download";
const MANIFEST_SUFFIX = ".zmanifest";
const TYPES = {
    mod: { prefix: "mod", extensions: [".jar"] },
    shader: { prefix: "shader", extensions: [".zip"] },
    resourcepack: { prefix: "resourcepack", extensions: [".zip"] }
};
let bucketReadyPromise = null;
const r2Client = R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
    ? new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
    })
    : null;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function storageHeaders(extra = {}) {
    return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...extra };
}

function requireStorage() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        const error = new Error("SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정하세요.");
        error.status = 503;
        throw error;
    }
}

function safeEqual(left, right) {
    const a = Buffer.from(String(left || ""));
    const b = Buffer.from(String(right || ""));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
    if (!ADMIN_PASSWORD) return res.status(503).json({ success: false, message: "ADMIN_PASSWORD가 설정되지 않았습니다." });
    if (!safeEqual(req.get("x-admin-password"), ADMIN_PASSWORD)) {
        return res.status(401).json({ success: false, message: "관리자 인증에 실패했습니다." });
    }
    next();
}

function encodePath(value) {
    return value.split("/").map(encodeURIComponent).join("/");
}

function fileId(objectPath) {
    return Buffer.from(objectPath, "utf8").toString("base64url");
}

function decodeUploadName(originalName) {
    const decoded = Buffer.from(originalName, "latin1").toString("utf8");
    return decoded.includes("\uFFFD") ? originalName : decoded;
}

function safeStorageName(name) {
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name);
}

function manifestPathFor(prefix, name) {
    const digest = crypto.createHash("sha256").update(name, "utf8").digest("hex").slice(0, 40);
    return `${prefix}/${digest}${MANIFEST_SUFFIX}`;
}

function detectContentType(buffer, requestedType) {
    if (requestedType === "mod") return requestedType;
    try {
        const entries = new AdmZip(buffer).getEntries().map(entry => entry.entryName.replace(/\\/g, "/").toLowerCase());
        const hasShaderRoot = entries.some(name => name === "shaders/" || name.startsWith("shaders/"));
        const hasResourceContent = entries.some(name => name === "pack.mcmeta" || name.startsWith("assets/") || name.includes("/assets/"));
        if (hasShaderRoot) return "shader";
        if (hasResourceContent) return "resourcepack";
    } catch (error) {
        console.warn(`ZIP type detection skipped: ${error.message}`);
    }
    return requestedType;
}

function pathFromId(id) {
    const objectPath = Buffer.from(id, "base64url").toString("utf8");
    if (!/^(mod|shader|resourcepack)\/[^/]+$/.test(objectPath)) throw new Error("잘못된 파일 ID입니다.");
    return objectPath;
}

async function getR2Updates() {
    const response = await fetch(R2_MANIFEST_URL, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`R2 manifest 오류 (${response.status})`);

    const manifest = await response.json();
    const groups = [
        ["mods", "mod"],
        ["resourcepacks", "resourcepack"],
        ["shaderpacks", "shader"]
    ];
    const files = [];

    for (const [key, type] of groups) {
        for (const item of Array.isArray(manifest[key]) ? manifest[key] : []) {
            const name = path.basename(String(item.file || ""));
            const relativeUrl = String(item.url || "").replace(/^\/+/, "");
            if (!name || !relativeUrl || relativeUrl.includes("..")) continue;
            files.push({
                name,
                type,
                url: `${R2_PUBLIC_URL}/${relativeUrl.split("/").map(encodeURIComponent).join("/")}`,
                size: Number(item.size) || 0,
                sha256: item.sha256 || null,
                updatedAt: manifest.updatedAt || null,
                signature: `${manifest.version || "1"}:${relativeUrl}:${item.sha256 || item.sha1 || ""}`
            });
        }
    }

    return { success: true, version: manifest.version || "1", files };
}

async function ensureBucket() {
    requireStorage();
    if (bucketReadyPromise) return bucketReadyPromise;

    bucketReadyPromise = (async () => {
        const bucketUrl = `${SUPABASE_URL}/storage/v1/bucket/${encodeURIComponent(SUPABASE_BUCKET)}`;
        const existing = await fetch(bucketUrl, { headers: storageHeaders() });
        if (existing.ok) return;

        const detail = await existing.text();
        const missing = existing.status === 404 || /bucket not found/i.test(detail);
        if (!missing) throw new Error(`Supabase 버킷 확인 오류 (${existing.status}): ${detail}`);

        const created = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
            method: "POST",
            headers: storageHeaders({ "content-type": "application/json" }),
            body: JSON.stringify({
                id: SUPABASE_BUCKET,
                name: SUPABASE_BUCKET,
                public: false
            })
        });
        if (!created.ok && created.status !== 409) {
            throw new Error(`Supabase 버킷 생성 오류 (${created.status}): ${await created.text()}`);
        }
        console.log(`Supabase Storage bucket ready: ${SUPABASE_BUCKET}`);
    })().catch(error => {
        bucketReadyPromise = null;
        throw error;
    });

    return bucketReadyPromise;
}

async function storageRequest(pathname, options = {}) {
    await ensureBucket();
    const response = await fetch(`${SUPABASE_URL}/storage/v1${pathname}`, {
        ...options,
        headers: storageHeaders(options.headers)
    });
    if (!response.ok) {
        const detail = await response.text();
        const error = new Error(`Supabase Storage 오류 (${response.status}): ${detail}`);
        error.status = response.status;
        throw error;
    }
    return response;
}

async function readStorageJson(objectPath) {
    const response = await storageRequest(`/object/${encodeURIComponent(SUPABASE_BUCKET)}/${encodePath(objectPath)}`);
    return response.json();
}

async function removeObject(objectPath, ignoreMissing = false) {
    try {
        await storageRequest(`/object/${encodeURIComponent(SUPABASE_BUCKET)}/${encodePath(objectPath)}`, { method: "DELETE" });
    } catch (error) {
        if (!ignoreMissing || !/404|not found/i.test(error.message)) throw error;
    }
}

async function removeManifestAndChunks(manifestPath, ignoreMissing = true) {
    try {
        const manifest = await readStorageJson(manifestPath);
        for (const chunkPath of manifest.chunks || []) await removeObject(chunkPath, true);
        await removeObject(manifestPath, true);
    } catch (error) {
        if (!ignoreMissing || !/404|not found/i.test(error.message)) throw error;
    }
}

async function listType(type) {
    const response = await storageRequest(`/object/list/${encodeURIComponent(SUPABASE_BUCKET)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prefix: TYPES[type].prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } })
    });
    const rows = await response.json();
    const files = [];
    for (const row of rows.filter(item => item.name && item.id)) {
        const objectPath = `${TYPES[type].prefix}/${row.name}`;
        if (row.name.endsWith(MANIFEST_SUFFIX)) {
            const manifest = await readStorageJson(objectPath);
            files.push({
                id: fileId(objectPath),
                name: manifest.name,
                type,
                size: manifest.size || 0,
                sha256: manifest.sha256 || null,
                updatedAt: row.updated_at || row.created_at || null
            });
        } else {
            files.push({
                id: fileId(objectPath),
                name: row.name,
                type,
                size: row.metadata?.size || 0,
                updatedAt: row.updated_at || row.created_at || null
            });
        }
    }
    return files;
}

async function getConfig() {
    const response = await fetch(`${R2_PUBLIC_URL}/config/launcher.json`, {
        signal: AbortSignal.timeout(30000),
        headers: { "cache-control": "no-cache" }
    });
    if (response.status === 404) return { discord: "", serverAddress: "", news: "", notice: "" };
    if (!response.ok) throw new Error(`R2 설정 읽기 오류 (${response.status})`);
    return response.json();
}

function cleanServerAddress(value) {
    const address = typeof value === "string" ? value.trim() : "";
    if (!address) return "";
    if (address.length > 255 || /[\s/\\?#]/.test(address)) {
        const error = new Error("서버 주소 형식이 올바르지 않습니다.");
        error.status = 400;
        throw error;
    }
    const portMatch = address.match(/:(\d+)$/);
    if (portMatch && Number(portMatch[1]) > 65535) {
        const error = new Error("서버 포트는 1~65535 범위여야 합니다.");
        error.status = 400;
        throw error;
    }
    return address;
}

async function saveConfig(config) {
    if (!r2Client) {
        const error = new Error("R2 관리자 API 자격 증명이 설정되지 않았습니다.");
        error.status = 503;
        throw error;
    }
    await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: "config/launcher.json",
        Body: JSON.stringify(config, null, 2),
        ContentType: "application/json; charset=utf-8",
        CacheControl: "no-cache"
    }));
}

app.get("/health", (_req, res) => res.json({ success: true }));
app.post("/admin/verify", requireAdmin, (_req, res) => res.json({ success: true }));
app.get("/config", async (_req, res, next) => {
    try { res.json(await getConfig()); } catch (error) { next(error); }
});
app.get("/files", async (_req, res, next) => {
    try {
        const groups = await Promise.all(Object.keys(TYPES).map(listType));
        res.json({ success: true, files: groups.flat() });
    } catch (error) { next(error); }
});
app.get("/updates", async (req, res, next) => {
    try {
        if (R2_MANIFEST_URL) return res.json(await getR2Updates());
        const groups = await Promise.all(Object.keys(TYPES).map(listType));
        const baseUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
        const files = groups.flat().map(file => ({
            name: file.name,
            type: file.type,
            url: `${baseUrl.replace(/\/$/, "")}/file/${encodeURIComponent(file.id)}`,
            size: file.size,
            sha256: file.sha256 || null,
            updatedAt: file.updatedAt,
            signature: `${file.id}:${file.updatedAt || ""}:${file.size || 0}`
        }));
        res.json({ success: true, version: process.env.CONTENT_VERSION || "1", files });
    } catch (error) { next(error); }
});

for (const [type, rule] of Object.entries(TYPES)) {
    app.post(`/upload/${type}`, requireAdmin, upload.single("file"), async (req, res, next) => {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: "파일이 없습니다." });
            const name = decodeUploadName(req.file.originalname).replace(/[\\/]/g, "_");
            const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
            if (!rule.extensions.includes(extension)) {
                return res.status(400).json({ success: false, message: `허용 확장자: ${rule.extensions.join(", ")}` });
            }
            const detectedType = detectContentType(req.file.buffer, type);
            const detectedRule = TYPES[detectedType];
            const objectPath = `${detectedRule.prefix}/${name}`;
            const manifestPath = manifestPathFor(detectedRule.prefix, name);
            const legacyManifestPath = `${objectPath}${MANIFEST_SUFFIX}`;
            const needsManifest = req.file.size > STORAGE_CHUNK_BYTES || !safeStorageName(name);

            if (!needsManifest) {
                await removeManifestAndChunks(manifestPath, true);
                await removeManifestAndChunks(legacyManifestPath, true);
                await storageRequest(`/object/${encodeURIComponent(SUPABASE_BUCKET)}/${encodePath(objectPath)}`, {
                    method: "POST",
                    headers: { "content-type": req.file.mimetype || "application/octet-stream", "x-upsert": "true" },
                    body: req.file.buffer
                });
                return res.json({ success: true, file: { id: fileId(objectPath), name, type: detectedType, chunked: false } });
            }

            const uploadId = crypto.randomUUID();
            const chunks = [];
            try {
                for (let offset = 0, index = 0; offset < req.file.size; offset += STORAGE_CHUNK_BYTES, index += 1) {
                    const chunkPath = `_chunks/${uploadId}/${String(index).padStart(5, "0")}`;
                    await storageRequest(`/object/${encodeURIComponent(SUPABASE_BUCKET)}/${encodePath(chunkPath)}`, {
                        method: "POST",
                        headers: { "content-type": "application/octet-stream", "x-upsert": "false" },
                        body: req.file.buffer.subarray(offset, Math.min(offset + STORAGE_CHUNK_BYTES, req.file.size))
                    });
                    chunks.push(chunkPath);
                }

                await removeManifestAndChunks(manifestPath, true);
                if (safeStorageName(name)) {
                    await removeManifestAndChunks(legacyManifestPath, true);
                    await removeObject(objectPath, true);
                }
                const manifest = {
                    version: 1,
                    name,
                    size: req.file.size,
                    contentType: req.file.mimetype || "application/octet-stream",
                    sha256: crypto.createHash("sha256").update(req.file.buffer).digest("hex"),
                    chunks
                };
                await storageRequest(`/object/${encodeURIComponent(SUPABASE_BUCKET)}/${encodePath(manifestPath)}`, {
                    method: "POST",
                    headers: { "content-type": "application/json", "x-upsert": "true" },
                    body: JSON.stringify(manifest)
                });
                return res.json({ success: true, file: { id: fileId(manifestPath), name, type: detectedType, chunked: true } });
            } catch (error) {
                for (const chunkPath of chunks) await removeObject(chunkPath, true).catch(() => {});
                throw error;
            }
        } catch (error) { next(error); }
    });
}

app.get("/file/:id", async (req, res, next) => {
    try {
        const objectPath = pathFromId(req.params.id);
        if (objectPath.endsWith(MANIFEST_SUFFIX)) {
            const manifest = await readStorageJson(objectPath);
            res.setHeader("content-type", manifest.contentType || "application/octet-stream");
            res.setHeader("content-length", String(manifest.size));
            res.setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(manifest.name)}`);
            for (const chunkPath of manifest.chunks || []) {
                const chunk = await storageRequest(`/object/${encodeURIComponent(SUPABASE_BUCKET)}/${encodePath(chunkPath)}`);
                for await (const data of chunk.body) {
                    if (!res.write(data)) await new Promise(resolve => res.once("drain", resolve));
                }
            }
            return res.end();
        }
        const response = await storageRequest(`/object/${encodeURIComponent(SUPABASE_BUCKET)}/${encodePath(objectPath)}`);
        res.setHeader("content-type", response.headers.get("content-type") || "application/octet-stream");
        const length = response.headers.get("content-length");
        if (length) res.setHeader("content-length", length);
        res.setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(objectPath.split("/").pop())}`);
        Readable.fromWeb(response.body).pipe(res);
    } catch (error) { next(error); }
});

app.delete("/file/:id", requireAdmin, async (req, res, next) => {
    try {
        const objectPath = pathFromId(req.params.id);
        if (objectPath.endsWith(MANIFEST_SUFFIX)) await removeManifestAndChunks(objectPath, false);
        else await removeObject(objectPath);
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/admin/save", requireAdmin, async (req, res, next) => {
    try {
        const config = {
            discord: typeof req.body.discord === "string" ? req.body.discord : "",
            serverAddress: cleanServerAddress(req.body.serverAddress),
            news: typeof req.body.news === "string" ? req.body.news : "",
            notice: typeof req.body.notice === "string" ? req.body.notice : ""
        };
        await saveConfig(config);
        res.json({ success: true, config });
    } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(error.status || 500).json({ success: false, message: error.message || "서버 오류" });
});

app.listen(PORT, () => console.log(`ZombieLauncher API listening on ${PORT}`));
