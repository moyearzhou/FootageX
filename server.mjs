import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(__dirname);
const publicDir = join(__dirname, "public");
const outputDir = join(rootDir, "outputs", "video_workbench");
const inventoryPath = join(outputDir, "video_inventory.json");
const reviewsPath = join(outputDir, "video_reviews.json");
const aiReviewsPath = join(outputDir, "video_ai_reviews.json");
const exportCsvPath = join(outputDir, "video_review_export.csv");
const settingsPath = join(outputDir, "immich_settings.json");

mkdirSync(outputDir, { recursive: true });

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".mts": "video/mp2t",
  ".m2ts": "video/mp2t",
  ".mkv": "video/x-matroska",
};

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

function loadInventory() {
  if (!existsSync(inventoryPath)) {
    return null;
  }
  return JSON.parse(readFileSync(inventoryPath, "utf-8"));
}

function loadReviews() {
  if (!existsSync(reviewsPath)) {
    return {};
  }
  return JSON.parse(readFileSync(reviewsPath, "utf-8"));
}

function loadAiReviews() {
  if (!existsSync(aiReviewsPath)) {
    return {};
  }
  return JSON.parse(readFileSync(aiReviewsPath, "utf-8"));
}

function loadSettings() {
  if (!existsSync(settingsPath)) {
    return { immichBaseUrl: "", immichApiKey: "", dataSource: "local", openAiApiKey: "", openAiBaseUrl: "https://aiapi.zotpaper.cn/v1", openAiModel: "gpt-5.4-mini" };
  }
  return JSON.parse(readFileSync(settingsPath, "utf-8"));
}

function publicSettings(settings = loadSettings()) {
  return {
    immichBaseUrl: settings.immichBaseUrl || "",
    hasImmichApiKey: Boolean(settings.immichApiKey),
    dataSource: settings.dataSource || "local",
    hasOpenAiApiKey: Boolean(settings.openAiApiKey),
    openAiBaseUrl: settings.openAiBaseUrl || "https://aiapi.zotpaper.cn/v1",
    openAiModel: settings.openAiModel || "gpt-5.4-mini",
  };
}

function saveSettings(settings, { preserveSecret = true } = {}) {
  const existing = loadSettings();
  const safeSettings = {
    immichBaseUrl: String(settings.immichBaseUrl || "").replace(/\/+$/, ""),
    immichApiKey: settings.immichApiKey || (preserveSecret ? existing.immichApiKey || "" : ""),
    dataSource: settings.dataSource || existing.dataSource || "local",
    openAiApiKey: settings.openAiApiKey || (preserveSecret ? existing.openAiApiKey || "" : ""),
    openAiBaseUrl: String(settings.openAiBaseUrl || existing.openAiBaseUrl || "https://aiapi.zotpaper.cn/v1").replace(/\/+$/, ""),
    openAiModel: settings.openAiModel || existing.openAiModel || "gpt-5.4-mini",
  };
  writeFileSync(settingsPath, JSON.stringify(safeSettings, null, 2), "utf-8");
  return safeSettings;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function normalizeInventoryVideo(video, settings) {
  const looksLikeImmich = video.source === "immich"
    || Boolean(video.immichAssetId)
    || (settings.dataSource === "immich" && isUuid(video.id));
  if (!looksLikeImmich) return video;
  return {
    ...video,
    source: "immich",
    immichAssetId: video.immichAssetId || video.id,
    immichAssetPath: video.immichAssetPath || video.path || "",
  };
}

function mergedInventory() {
  const inventory = loadInventory();
  const settings = loadSettings();
  if (!inventory) {
    return {
      root: "",
      source: "empty",
      generatedAt: "",
      totalVideos: 0,
      totalSize: 0,
      totalSizeHuman: "0 B",
      errors: [],
      settings: publicSettings(settings),
      videos: [],
    };
  }
  const reviews = loadReviews();
  const aiReviews = loadAiReviews();
  return {
    ...inventory,
    settings: publicSettings(settings),
    videos: inventory.videos.map((video) => {
      const normalized = normalizeInventoryVideo(video, settings);
      return {
        ...normalized,
        aiReview: aiReviews[normalized.id] || aiReviews[normalized.immichAssetId] || null,
        ...(reviews[normalized.id] || {}),
      };
    }),
  };
}

function saveReviews(reviews) {
  writeFileSync(reviewsPath, JSON.stringify(reviews, null, 2), "utf-8");
  writeExportCsv(reviews);
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function writeExportCsv(reviews) {
  const inventory = loadInventory();
  if (!inventory) return;
  const headers = [
    "id", "relativePath", "sizeHuman", "device", "event", "reviewStatus", "rating", "tags", "notes", "segments",
    "immichUrl", "immichAssetId", "immichAssetPath",
  ];
  const rows = [headers.join(",")];
  for (const video of inventory.videos) {
    const review = reviews[video.id] || {};
    rows.push(headers.map((key) => {
      if (key === "segments") return csvCell(JSON.stringify(review.segments || []));
      return csvCell(review[key] ?? video[key] ?? "");
    }).join(","));
  }
  writeFileSync(exportCsvPath, `${rows.join("\n")}\n`, "utf-8");
}

function humanSize(num) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = Number(num || 0);
  for (const unit of units) {
    if (n < 1024 || unit === units[units.length - 1]) {
      return unit === "B" ? `${Math.round(n)} B` : `${n.toFixed(1)} ${unit}`;
    }
    n /= 1024;
  }
}

function asList(payload) {
  return payload?.assets?.items
    || payload?.assets
    || payload?.items
    || payload?.data?.assets?.items
    || payload?.data?.items
    || [];
}

function normalizeImmichAsset(asset, index, baseUrl) {
  const name = asset.originalFileName || asset.originalPath?.split("/").pop() || asset.fileName || asset.id;
  const size = Number(asset.exifInfo?.fileSizeInByte || asset.fileSizeInByte || asset.size || 0);
  const originalPath = asset.originalPath || "";
  const folder = originalPath.split("/").slice(0, -1).join("/");
  return {
    id: asset.id,
    immichAssetId: asset.id,
    source: "immich",
    path: originalPath,
    relativePath: originalPath || name,
    name,
    extension: extname(name).toLowerCase(),
    size,
    sizeHuman: humanSize(size),
    modified: asset.fileModifiedAt || asset.localDateTime || asset.createdAt || "",
    duration: asset.duration || "",
    device: asset.exifInfo?.make || asset.exifInfo?.model || "Immich",
    event: asset.city || asset.state || asset.country || "Immich",
    folder,
    immichUrl: `${baseUrl}/photos/${asset.id}`,
    reviewStatus: "unreviewed",
    rating: 0,
    tags: [],
    notes: "",
    segments: [],
    rank: index + 1,
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function getImmichAssetDetail(id) {
  const response = await immichFetch(`/api/assets/${encodeURIComponent(id)}`);
  return response.json();
}

async function withImmichDetails(asset) {
  const hasSize = Number(asset.exifInfo?.fileSizeInByte || asset.fileSizeInByte || asset.size || 0) > 0;
  if (hasSize && asset.duration) {
    return asset;
  }
  try {
    return await getImmichAssetDetail(asset.id);
  } catch (error) {
    return { ...asset, detailError: error.message };
  }
}

async function immichFetch(path, options = {}) {
  const settings = loadSettings();
  if (!settings.immichBaseUrl || !settings.immichApiKey) {
    throw new Error("Immich 地址或 API Key 未配置");
  }
  const response = await fetch(`${settings.immichBaseUrl}${path}`, {
    ...options,
    headers: {
      "x-api-key": settings.immichApiKey,
      "accept": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Immich API ${response.status}: ${text.slice(0, 300)}`);
  }
  return response;
}

async function syncImmichVideos() {
  const settings = loadSettings();
  const videos = [];
  let page = 1;
  const size = 250;
  while (page <= 100) {
    const response = await immichFetch("/api/search/metadata", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "VIDEO", page, size, isVisible: true }),
    });
    const payload = await response.json();
    const items = asList(payload);
    const detailedItems = await mapWithConcurrency(items, 8, withImmichDetails);
    videos.push(...detailedItems.map((asset, index) => normalizeImmichAsset(asset, videos.length + index, settings.immichBaseUrl)));
    if (items.length < size) break;
    page += 1;
  }
  videos.sort((a, b) => b.size - a.size);
  videos.forEach((video, index) => {
    video.rank = index + 1;
  });
  const totalSize = videos.reduce((sum, video) => sum + video.size, 0);
  const inventory = {
    root: settings.immichBaseUrl,
    source: "immich",
    generatedAt: new Date().toISOString(),
    scanSeconds: 0,
    totalVideos: videos.length,
    totalSize,
    totalSizeHuman: humanSize(totalSize),
    errors: [],
    videos,
  };
  writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2), "utf-8");
  saveSettings({ ...settings, dataSource: "immich" });
  return inventory;
}

function sendStatic(req, res, pathname) {
  const relative = pathname === "/" ? "/index.html" : pathname;
  const target = resolve(publicDir, `.${relative}`);
  if (!target.startsWith(publicDir)) {
    json(res, 403, { error: "Forbidden" });
    return;
  }
  if (!existsSync(target)) {
    json(res, 404, { error: "Not found" });
    return;
  }
  const mime = mimeTypes[extname(target).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "content-type": mime,
    "cache-control": "no-store",
  });
  createReadStream(target).pipe(res);
}

function sendMedia(req, res, id) {
  const inventory = loadInventory();
  const video = inventory?.videos.find((item) => item.id === id);
  if (!video) {
    json(res, 404, { error: "Video not found" });
    return;
  }
  const filePath = video.path;
  let stat;
  try {
    stat = statSync(filePath);
  } catch (error) {
    json(res, 404, { error: "Video file is not accessible", details: error.message });
    return;
  }
  const range = req.headers.range;
  const mime = mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  if (range) {
    const [startText, endText] = range.replace("bytes=", "").split("-");
    const start = Number.parseInt(startText, 10);
    const end = endText ? Number.parseInt(endText, 10) : stat.size - 1;
    const safeEnd = Math.min(end, stat.size - 1);
    if (Number.isNaN(start) || start > safeEnd) {
      res.writeHead(416, { "content-range": `bytes */${stat.size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      "content-type": mime,
      "content-length": safeEnd - start + 1,
      "content-range": `bytes ${start}-${safeEnd}/${stat.size}`,
      "accept-ranges": "bytes",
    });
    createReadStream(filePath, { start, end: safeEnd }).pipe(res);
    return;
  }
  res.writeHead(200, {
    "content-type": mime,
    "content-length": stat.size,
    "accept-ranges": "bytes",
  });
  createReadStream(filePath).pipe(res);
}

async function proxyImmichAsset(req, res, id, kind) {
  try {
    const endpoint = kind === "thumbnail"
      ? `/api/assets/${encodeURIComponent(id)}/thumbnail?size=preview`
      : `/api/assets/${encodeURIComponent(id)}/original`;
    const upstream = await immichFetch(endpoint, {
      headers: req.headers.range ? { range: req.headers.range } : {},
    });
    const headers = {
      "content-type": upstream.headers.get("content-type") || "application/octet-stream",
      "accept-ranges": upstream.headers.get("accept-ranges") || "bytes",
    };
    for (const key of ["content-length", "content-range"]) {
      const value = upstream.headers.get(key);
      if (value) headers[key] = value;
    }
    res.writeHead(upstream.status, headers);
    if (!upstream.body) {
      res.end();
      return;
    }
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    json(res, 502, { error: error.message });
  }
}

function readJsonBody(req, limit = 20_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function extractJson(text) {
  const trimmed = String(text || "").trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const match = trimmed.match(/```json\s*([\s\S]*?)```|({[\s\S]*})/);
  if (!match) {
    throw new Error("AI 返回不是 JSON");
  }
  return JSON.parse(match[1] || match[2]);
}

function normalizeAiResult(result, video, frames) {
  return {
    assetId: video.id,
    analyzedAt: new Date().toISOString(),
    model: loadSettings().openAiModel || "gpt-5.4-mini",
    frameCount: frames.length,
    aiScore: Number(result.aiScore || 0),
    suggestedStatus: result.suggestedStatus || "cut",
    summary: result.summary || "",
    tags: Array.isArray(result.tags) ? result.tags : [],
    qualityIssues: Array.isArray(result.qualityIssues) ? result.qualityIssues : [],
    keepSegments: Array.isArray(result.keepSegments) ? result.keepSegments : [],
    deleteCandidates: Array.isArray(result.deleteCandidates) ? result.deleteCandidates : [],
  };
}

async function analyzeVideoWithOpenAI(video, frames) {
  const settings = loadSettings();
  if (!settings.openAiApiKey) {
    throw new Error("OpenAI API Key 未配置");
  }
  if (!frames.length) {
    throw new Error("没有可分析的视频帧");
  }
  const content = [
    {
      type: "input_text",
      text: [
        "你是旅行视频素材整理助手。请根据抽帧判断这个视频的素材价值。",
        "不要建议直接删除原文件，只能给出待删观察候选。",
        "请严格返回 JSON，不要 Markdown。",
        "",
        `文件名: ${video.name}`,
        `大小: ${video.sizeHuman}`,
        `时长: ${video.duration || "未知"}`,
        `路径: ${video.relativePath || video.path || ""}`,
        "",
        "字段要求：",
        "{",
        '  "aiScore": 0-100,',
        '  "suggestedStatus": "keep" | "cut" | "archive" | "delete_candidate",',
        '  "summary": "一句到三句话摘要",',
        '  "tags": ["标签"],',
        '  "qualityIssues": ["质量问题"],',
        '  "keepSegments": [{"start":"00:00","end":"00:10","score":90,"reason":"原因"}],',
        '  "deleteCandidates": [{"start":"00:00","end":"00:10","reason":"原因"}]',
        "}",
      ].join("\n"),
    },
    ...frames.map((frame) => ({
      type: "input_image",
      image_url: frame.dataUrl,
      detail: "low",
    })),
  ];
  const openAiBaseUrl = String(settings.openAiBaseUrl || "https://aiapi.zotpaper.cn/v1").replace(/\/+$/, "");
  const response = await fetch(`${openAiBaseUrl}/responses`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${settings.openAiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: settings.openAiModel || "gpt-5.4-mini",
      input: [{ role: "user", content }],
      max_output_tokens: 1200,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI API ${response.status}: ${text.slice(0, 500)}`);
  }
  const payload = await response.json();
  const outputText = payload.output_text
    || payload.output?.flatMap((item) => item.content || [])
      .map((item) => item.text || "")
      .join("\n");
  return normalizeAiResult(extractJson(outputText), video, frames);
}

async function testOpenAIModel() {
  const settings = loadSettings();
  if (!settings.openAiApiKey) {
    throw new Error("OpenAI API Key 未配置");
  }
  const openAiBaseUrl = String(settings.openAiBaseUrl || "https://aiapi.zotpaper.cn/v1").replace(/\/+$/, "");
  const model = settings.openAiModel || "gpt-5.4-mini";
  const response = await fetch(`${openAiBaseUrl}/responses`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${settings.openAiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: "Reply with exactly OK.",
      max_output_tokens: 16,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI API ${response.status}: ${text.slice(0, 500)}`);
  }
  let output = "";
  try {
    const payload = JSON.parse(text);
    output = payload.output_text
      || payload.output?.flatMap((item) => item.content || [])
        .map((item) => item.text || "")
        .join("\n")
      || "";
  } catch {
    output = text.slice(0, 200);
  }
  return { model, baseUrl: openAiBaseUrl, output: output.trim() };
}

async function handleAiAnalyze(req, res) {
  try {
    const body = await readJsonBody(req, 30_000_000);
    const inventory = loadInventory();
    const video = inventory?.videos.find((item) => item.id === body.id || item.immichAssetId === body.id);
    if (!video) {
      json(res, 404, { error: "Video not found" });
      return;
    }
    const frames = Array.isArray(body.frames) ? body.frames.slice(0, 24) : [];
    const result = await analyzeVideoWithOpenAI(video, frames);
    const aiReviews = loadAiReviews();
    aiReviews[video.id] = result;
    writeFileSync(aiReviewsPath, JSON.stringify(aiReviews, null, 2), "utf-8");
    json(res, 200, { ok: true, result, aiReviewsPath });
  } catch (error) {
    json(res, 502, { error: error.message });
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/inventory") {
    const inventory = mergedInventory();
    json(res, 200, inventory);
    return;
  }
  if (url.pathname === "/api/reviews" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const reviews = loadReviews();
        const current = reviews[payload.id] || {};
        reviews[payload.id] = {
          ...current,
          ...payload.review,
          updatedAt: new Date().toISOString(),
        };
        saveReviews(reviews);
        json(res, 200, { ok: true, review: reviews[payload.id], exportCsvPath });
      } catch (error) {
        json(res, 400, { error: error.message });
      }
    });
    return;
  }
  if (url.pathname === "/api/export") {
    json(res, 200, { reviewsPath, exportCsvPath, settingsPath });
    return;
  }
  if (url.pathname === "/api/settings" && req.method === "GET") {
    json(res, 200, publicSettings());
    return;
  }
  if (url.pathname === "/api/settings" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const settings = saveSettings(JSON.parse(body || "{}"));
        json(res, 200, { ok: true, settings: publicSettings(settings) });
      } catch (error) {
        json(res, 400, { error: error.message });
      }
    });
    return;
  }
  if (url.pathname === "/api/immich/sync" && req.method === "POST") {
    syncImmichVideos()
      .then((inventory) => json(res, 200, {
        ok: true,
        totalVideos: inventory.totalVideos,
        totalSizeHuman: inventory.totalSizeHuman,
      }))
      .catch((error) => json(res, 502, { error: error.message }));
    return;
  }
  if (url.pathname === "/api/ai/analyze" && req.method === "POST") {
    handleAiAnalyze(req, res);
    return;
  }
  if (url.pathname === "/api/ai/test" && req.method === "POST") {
    testOpenAIModel()
      .then((result) => json(res, 200, { ok: true, ...result }))
      .catch((error) => json(res, 502, { error: error.message }));
    return;
  }
  if (url.pathname.startsWith("/immich/media/")) {
    console.log(`[media] ${new Date().toISOString()} ${req.headers.range || "no-range"} ${url.pathname}`);
    proxyImmichAsset(req, res, decodeURIComponent(url.pathname.slice("/immich/media/".length)), "media");
    return;
  }
  if (url.pathname.startsWith("/immich/thumbnail/")) {
    proxyImmichAsset(req, res, decodeURIComponent(url.pathname.slice("/immich/thumbnail/".length)), "thumbnail");
    return;
  }
  if (url.pathname.startsWith("/media/")) {
    sendMedia(req, res, decodeURIComponent(url.pathname.slice("/media/".length)));
    return;
  }
  sendStatic(req, res, url.pathname);
});

const port = Number.parseInt(process.env.PORT || "5173", 10);
const host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`Video workbench: http://${displayHost}:${port}`);
  console.log(`Listening on: ${host}:${port}`);
  console.log(`Inventory: ${inventoryPath}`);
});
