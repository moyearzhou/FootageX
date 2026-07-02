const state = {
  inventory: null,
  videos: [],
  filtered: [],
  current: null,
  settings: { immichBaseUrl: "", hasImmichApiKey: false, dataSource: "local", openAiBaseUrl: "https://aiapi.zotpaper.cn/v1", openAiModel: "gpt-5.4-mini" },
  tags: ["风景", "人物", "骑行", "航拍", "城市", "雪山", "海边", "公路", "转场", "稳定", "抖动", "模糊", "黑屏", "重复", "误录", "高光"],
};

const el = {
  scanMeta: document.querySelector("#scanMeta"),
  openSettingsBtn: document.querySelector("#openSettingsBtn"),
  closeSettingsBtn: document.querySelector("#closeSettingsBtn"),
  settingsModal: document.querySelector("#settingsModal"),
  totalVideos: document.querySelector("#totalVideos"),
  totalSize: document.querySelector("#totalSize"),
  reviewedCount: document.querySelector("#reviewedCount"),
  searchInput: document.querySelector("#searchInput"),
  deviceFilter: document.querySelector("#deviceFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  sortMode: document.querySelector("#sortMode"),
  videoList: document.querySelector("#videoList"),
  videoTitle: document.querySelector("#videoTitle"),
  videoPath: document.querySelector("#videoPath"),
  videoSize: document.querySelector("#videoSize"),
  videoEvent: document.querySelector("#videoEvent"),
  videoDevice: document.querySelector("#videoDevice"),
  player: document.querySelector("#player"),
  loadVideoBtn: document.querySelector("#loadVideoBtn"),
  unloadVideoBtn: document.querySelector("#unloadVideoBtn"),
  captureSheetBtn: document.querySelector("#captureSheetBtn"),
  addSegmentBtn: document.querySelector("#addSegmentBtn"),
  openOriginalBtn: document.querySelector("#openOriginalBtn"),
  contactSheet: document.querySelector("#contactSheet"),
  statusButtons: document.querySelector("#statusButtons"),
  ratingButtons: document.querySelector("#ratingButtons"),
  tagGrid: document.querySelector("#tagGrid"),
  notesInput: document.querySelector("#notesInput"),
  saveState: document.querySelector("#saveState"),
  segmentList: document.querySelector("#segmentList"),
  clearSegmentsBtn: document.querySelector("#clearSegmentsBtn"),
  immichBaseUrlInput: document.querySelector("#immichBaseUrlInput"),
  immichApiKeyInput: document.querySelector("#immichApiKeyInput"),
  saveImmichBtn: document.querySelector("#saveImmichBtn"),
  syncImmichBtn: document.querySelector("#syncImmichBtn"),
  openSavedImmichBtn: document.querySelector("#openSavedImmichBtn"),
  immichState: document.querySelector("#immichState"),
  openAiApiKeyInput: document.querySelector("#openAiApiKeyInput"),
  openAiBaseUrlInput: document.querySelector("#openAiBaseUrlInput"),
  openAiModelInput: document.querySelector("#openAiModelInput"),
  saveOpenAiBtn: document.querySelector("#saveOpenAiBtn"),
  testOpenAiBtn: document.querySelector("#testOpenAiBtn"),
  analyzeCurrentBtn: document.querySelector("#analyzeCurrentBtn"),
  aiState: document.querySelector("#aiState"),
  settingsAiState: document.querySelector("#settingsAiState"),
  aiResult: document.querySelector("#aiResult"),
};

function statusLabel(status) {
  return {
    unreviewed: "未标记",
    keep: "保留",
    cut: "剪片段",
    archive: "归档",
    delete_candidate: "待删观察",
  }[status || "unreviewed"];
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const rounded = Math.max(0, Math.floor(seconds));
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseTime(text) {
  const parts = String(text || "").split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function immichBaseUrl() {
  return String(state.settings.immichBaseUrl || "").replace(/\/+$/, "");
}

function isImmichVideo(video) {
  return video?.source === "immich" || Boolean(video?.immichAssetId);
}

function renderImmich(video) {
  const base = immichBaseUrl();
  el.immichBaseUrlInput.value = base;
  el.immichState.textContent = base && state.settings.hasImmichApiKey
    ? `已配置 · ${state.settings.dataSource === "immich" ? "Immich 数据源" : "待同步"}`
    : "未配置";
  el.immichApiKeyInput.placeholder = state.settings.hasImmichApiKey ? "已保存，留空则沿用" : "只保存在本地工作区";
  el.syncImmichBtn.disabled = !base || !state.settings.hasImmichApiKey;
  el.openSavedImmichBtn.disabled = !video?.immichUrl;
}

function renderAi(video) {
  const result = video?.aiReview || null;
  el.openAiBaseUrlInput.value = state.settings.openAiBaseUrl || "https://aiapi.zotpaper.cn/v1";
  el.openAiModelInput.value = state.settings.openAiModel || "gpt-5.4-mini";
  el.openAiApiKeyInput.placeholder = state.settings.hasOpenAiApiKey ? "已保存，留空则沿用" : "只保存在本地工作区";
  el.settingsAiState.textContent = state.settings.hasOpenAiApiKey ? `已配置 · ${state.settings.openAiModel || "模型"}` : "未配置";
  el.analyzeCurrentBtn.disabled = !state.settings.hasOpenAiApiKey || !video;
  el.testOpenAiBtn.disabled = !state.settings.hasOpenAiApiKey;
  if (!result) {
    el.aiState.textContent = state.settings.hasOpenAiApiKey ? "未分析" : "未配置";
    el.aiResult.innerHTML = `<div class="empty">${state.settings.hasOpenAiApiKey ? "当前视频还没有 AI 分析结果" : "先保存 OpenAI API Key"}</div>`;
    return;
  }
  el.aiState.textContent = `${result.suggestedStatus || "建议"} · ${result.aiScore || 0}`;
  const tags = (result.tags || []).map((tag) => `<span class="aiChip">${tag}</span>`).join("");
  const issues = (result.qualityIssues || []).map((item) => `<li>${item}</li>`).join("");
  const keepSegments = (result.keepSegments || []).map((segment) => `
    <li><strong>${segment.start || ""}-${segment.end || ""}</strong> ${segment.reason || ""}</li>
  `).join("");
  const deleteSegments = (result.deleteCandidates || []).map((segment) => `
    <li><strong>${segment.start || ""}-${segment.end || ""}</strong> ${segment.reason || ""}</li>
  `).join("");
  el.aiResult.innerHTML = `
    <div class="aiSummary">${result.summary || "无摘要"}</div>
    <div class="aiChips">${tags}</div>
    <button id="acceptAiSuggestionBtn" type="button">接受 AI 建议</button>
    <div class="aiBlock"><h4>质量问题</h4><ul>${issues || "<li>未发现明显问题</li>"}</ul></div>
    <div class="aiBlock"><h4>推荐保留片段</h4><ul>${keepSegments || "<li>暂无</li>"}</ul></div>
    <div class="aiBlock"><h4>待删观察片段</h4><ul>${deleteSegments || "<li>暂无</li>"}</ul></div>
  `;
}

function openSettings() {
  el.settingsModal.hidden = false;
  el.immichBaseUrlInput.focus();
}

function closeSettings() {
  el.settingsModal.hidden = true;
  el.openSettingsBtn.focus();
}

function reviewPatch(video, patch) {
  Object.assign(video, patch);
  saveReview(video);
  renderReview(video);
  renderList();
  renderStats();
}

async function saveReview(video) {
  el.saveState.textContent = "保存中";
  const review = {
    reviewStatus: video.reviewStatus || "unreviewed",
    rating: video.rating || 0,
    tags: video.tags || [],
    notes: video.notes || "",
    segments: video.segments || [],
    immichUrl: video.immichUrl || "",
    immichAssetId: video.immichAssetId || "",
    immichAssetPath: video.immichAssetPath || video.path || "",
  };
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: video.id, review }),
  });
  if (!response.ok) {
    el.saveState.textContent = "保存失败";
    return;
  }
  el.saveState.textContent = "已保存";
}

function renderStats() {
  const reviewed = state.videos.filter((video) => (video.reviewStatus || "unreviewed") !== "unreviewed").length;
  el.totalVideos.textContent = (state.inventory?.totalVideos || 0).toLocaleString("zh-CN");
  el.totalSize.textContent = state.inventory?.totalSizeHuman || "0 B";
  el.reviewedCount.textContent = reviewed.toLocaleString("zh-CN");
}

function renderFilters() {
  const devices = [...new Set(state.videos.map((video) => video.device))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  el.deviceFilter.innerHTML = `<option value="">全部</option>${devices.map((device) => `<option>${device}</option>`).join("")}`;
}

function applyFilters() {
  const query = el.searchInput.value.trim().toLowerCase();
  const device = el.deviceFilter.value;
  const status = el.statusFilter.value;
  let items = state.videos.filter((video) => {
    const haystack = `${video.name} ${video.relativePath} ${video.event} ${video.folder}`.toLowerCase();
    return (!query || haystack.includes(query))
      && (!device || video.device === device)
      && (!status || (video.reviewStatus || "unreviewed") === status);
  });
  const mode = el.sortMode.value;
  items = items.sort((a, b) => {
    if (mode === "modified_desc") return b.modified.localeCompare(a.modified);
    if (mode === "event_asc") return a.event.localeCompare(b.event, "zh-CN") || b.size - a.size;
    if (mode === "rating_desc") return (b.rating || 0) - (a.rating || 0) || b.size - a.size;
    return b.size - a.size;
  });
  state.filtered = items;
  renderList();
}

function renderList() {
  if (!state.filtered.length) {
    el.videoList.innerHTML = `<div class="empty">没有符合条件的视频</div>`;
    return;
  }
  el.videoList.innerHTML = state.filtered.map((video) => `
    <button class="videoItem ${state.current?.id === video.id ? "active" : ""}" data-id="${video.id}">
      <div>
        <div class="videoName">${video.name}</div>
        <div class="videoMeta">${video.sizeHuman} · ${video.device} · ${video.event}</div>
        <div class="videoFolder">${video.folder}</div>
      </div>
      <span class="statusPill ${video.reviewStatus || "unreviewed"}">${statusLabel(video.reviewStatus)}</span>
    </button>
  `).join("");
}

function selectVideo(id) {
  const video = state.videos.find((item) => item.id === id);
  if (!video) return;
  state.current = video;
  el.videoTitle.textContent = video.name;
  el.videoPath.textContent = video.relativePath;
  el.videoSize.textContent = video.sizeHuman;
  el.videoEvent.textContent = video.event;
  el.videoDevice.textContent = video.device;
  unloadVideo();
  el.contactSheet.innerHTML = `<div class="empty">点击“生成缩略总览”抽取当前视频画面</div>`;
  renderReview(video);
  renderImmich(video);
  renderAi(video);
  renderList();
}

function unloadVideo() {
  el.player.pause();
  el.player.removeAttribute("src");
  el.player.load();
}

async function loadVideoForCurrent() {
  if (!state.current) throw new Error("请先选择一个视频");
  const src = isImmichVideo(state.current)
    ? `/immich/media/${encodeURIComponent(state.current.immichAssetId || state.current.id)}`
    : `/media/${encodeURIComponent(state.current.id)}`;
  if (el.player.getAttribute("src") !== src) {
    el.player.src = src;
    el.player.load();
  }
  if (Number.isFinite(el.player.duration) && el.player.duration > 0) return;
  await new Promise((resolve, reject) => {
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("视频加载失败"));
    };
    const cleanup = () => {
      el.player.removeEventListener("loadedmetadata", done);
      el.player.removeEventListener("error", fail);
    };
    el.player.addEventListener("loadedmetadata", done, { once: true });
    el.player.addEventListener("error", fail, { once: true });
  });
}

function renderReview(video) {
  [...el.statusButtons.querySelectorAll("button")].forEach((button) => {
    button.classList.toggle("active", button.dataset.status === (video.reviewStatus || "unreviewed"));
  });
  [...el.ratingButtons.querySelectorAll("button")].forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.rating) <= (video.rating || 0));
  });
  el.notesInput.value = video.notes || "";
  renderTags(video);
  renderSegments(video);
}

function renderTags(video) {
  const selected = new Set(video.tags || []);
  el.tagGrid.innerHTML = state.tags.map((tag) => `
    <button type="button" class="${selected.has(tag) ? "active" : ""}" data-tag="${tag}">${tag}</button>
  `).join("");
}

function renderSegments(video) {
  const segments = video.segments || [];
  if (!segments.length) {
    el.segmentList.innerHTML = `<div class="empty">还没有记录片段</div>`;
    return;
  }
  el.segmentList.innerHTML = segments.map((segment, index) => `
    <div class="segmentItem" data-index="${index}">
      <div class="segmentTimes">
        <input data-field="start" value="${formatTime(segment.start)}" aria-label="开始时间" />
        <input data-field="end" value="${formatTime(segment.end)}" aria-label="结束时间" />
        <button data-remove="${index}" type="button">删除</button>
      </div>
      <input data-field="label" value="${segment.label || ""}" placeholder="片段描述，如：稳定海边转场" />
    </div>
  `).join("");
}

async function seekVideo(video, time) {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    const fail = () => reject(new Error("无法抽取该时间点"));
    video.addEventListener("seeked", done, { once: true });
    video.addEventListener("error", fail, { once: true });
    video.currentTime = Math.min(Math.max(time, 0), Math.max(video.duration - 0.2, 0));
  });
}

async function captureFrames({ render = false, maxFrames = 16 } = {}) {
  await loadVideoForCurrent();
  const video = el.player;
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    throw new Error("视频元数据还没加载好，稍等一秒再试");
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const count = Math.min(maxFrames, Math.max(6, Math.ceil(video.duration / 45)));
  const times = Array.from({ length: count }, (_, index) => (video.duration * (index + 0.5)) / count);
  const frames = [];
  if (render) el.contactSheet.innerHTML = "";
  for (const time of times) {
    await seekVideo(video, time);
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    canvas.width = 320;
    canvas.height = Math.round((height / width) * canvas.width);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    frames.push({ time: formatTime(time), seconds: time, dataUrl });
    if (render) {
      const item = document.createElement("div");
      item.className = "thumb";
      item.innerHTML = `<img alt="${formatTime(time)}" src="${dataUrl}" /><button type="button">${formatTime(time)}</button>`;
      item.querySelector("button").addEventListener("click", () => {
        video.currentTime = time;
        video.play();
      });
      el.contactSheet.appendChild(item);
    }
  }
  video.pause();
  return frames;
}

async function captureContactSheet() {
  if (!state.current) return;
  el.captureSheetBtn.disabled = true;
  el.captureSheetBtn.textContent = "抽帧中";
  try {
    await captureFrames({ render: true, maxFrames: 16 });
  } catch (error) {
    el.contactSheet.innerHTML = `<div class="empty">${error.message}</div>`;
  }
  el.captureSheetBtn.disabled = false;
  el.captureSheetBtn.textContent = "生成缩略总览";
}

function addSegment() {
  if (!state.current) return;
  const current = el.player.currentTime || 0;
  const segment = {
    start: Math.max(0, current - 5),
    end: Math.min(Number.isFinite(el.player.duration) ? el.player.duration : current + 10, current + 10),
    label: "",
  };
  const segments = [...(state.current.segments || []), segment];
  reviewPatch(state.current, { reviewStatus: "cut", segments });
}

async function init() {
  const response = await fetch("/api/inventory");
  if (!response.ok) {
    const error = await response.json();
    document.body.innerHTML = `<main class="empty">${error.error}</main>`;
    return;
  }
  state.inventory = await response.json();
  state.videos = state.inventory.videos;
  state.settings = state.inventory.settings || state.settings;
  el.scanMeta.textContent = state.inventory.root
    ? `${state.inventory.root} · ${state.inventory.generatedAt}`
    : "首次运行：配置 Immich 后同步视频";
  renderStats();
  renderFilters();
  applyFilters();
  renderImmich(null);
  if (state.videos.length) {
    selectVideo(state.videos[0].id);
  } else {
    state.current = null;
    el.videoTitle.textContent = "还没有视频";
    el.videoPath.textContent = "点击左侧设置，填写 Immich 地址和 API Key，然后同步视频。";
    el.videoSize.textContent = "0 B";
    el.videoEvent.textContent = "待同步";
    el.videoDevice.textContent = "Immich";
    el.player.pause();
    el.player.removeAttribute("src");
    el.player.load();
    el.contactSheet.innerHTML = `<div class="empty">同步后会在这里预览视频</div>`;
    renderReview({ reviewStatus: "unreviewed", rating: 0, tags: [], notes: "", segments: [] });
    renderAi(null);
  }
}

el.openSettingsBtn.addEventListener("click", openSettings);
el.closeSettingsBtn.addEventListener("click", closeSettings);
el.settingsModal.addEventListener("click", (event) => {
  if (event.target === el.settingsModal) closeSettings();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !el.settingsModal.hidden) closeSettings();
});

[el.searchInput, el.deviceFilter, el.statusFilter, el.sortMode].forEach((input) => {
  input.addEventListener("input", applyFilters);
});

el.videoList.addEventListener("click", (event) => {
  const button = event.target.closest(".videoItem");
  if (button) selectVideo(button.dataset.id);
});

el.statusButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-status]");
  if (button && state.current) reviewPatch(state.current, { reviewStatus: button.dataset.status });
});

el.ratingButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-rating]");
  if (button && state.current) reviewPatch(state.current, { rating: Number(button.dataset.rating) });
});

el.tagGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tag]");
  if (!button || !state.current) return;
  const tags = new Set(state.current.tags || []);
  if (tags.has(button.dataset.tag)) tags.delete(button.dataset.tag);
  else tags.add(button.dataset.tag);
  reviewPatch(state.current, { tags: [...tags] });
});

el.notesInput.addEventListener("change", () => {
  if (state.current) reviewPatch(state.current, { notes: el.notesInput.value });
});

el.segmentList.addEventListener("change", (event) => {
  if (!state.current) return;
  const item = event.target.closest(".segmentItem");
  if (!item) return;
  const index = Number(item.dataset.index);
  const segments = [...(state.current.segments || [])];
  const field = event.target.dataset.field;
  if (field === "start" || field === "end") segments[index][field] = parseTime(event.target.value);
  if (field === "label") segments[index][field] = event.target.value;
  reviewPatch(state.current, { segments });
});

el.segmentList.addEventListener("click", (event) => {
  const remove = event.target.closest("button[data-remove]");
  if (!remove || !state.current) return;
  const index = Number(remove.dataset.remove);
  const segments = [...(state.current.segments || [])];
  segments.splice(index, 1);
  reviewPatch(state.current, { segments });
});

el.clearSegmentsBtn.addEventListener("click", () => {
  if (state.current) reviewPatch(state.current, { segments: [] });
});

el.loadVideoBtn.addEventListener("click", async () => {
  el.loadVideoBtn.disabled = true;
  el.loadVideoBtn.textContent = "加载中";
  try {
    await loadVideoForCurrent();
    el.loadVideoBtn.textContent = "已加载";
  } catch (error) {
    el.loadVideoBtn.textContent = "加载失败";
    el.contactSheet.innerHTML = `<div class="empty">${error.message}</div>`;
  } finally {
    setTimeout(() => {
      el.loadVideoBtn.disabled = false;
      el.loadVideoBtn.textContent = "加载视频";
    }, 1200);
  }
});

el.unloadVideoBtn.addEventListener("click", () => {
  unloadVideo();
  el.contactSheet.innerHTML = `<div class="empty">视频已卸载，点击“加载视频”后再播放或抽帧</div>`;
});

el.captureSheetBtn.addEventListener("click", captureContactSheet);
el.addSegmentBtn.addEventListener("click", addSegment);
el.openOriginalBtn.addEventListener("click", () => {
  if (state.current) window.open(`/media/${encodeURIComponent(state.current.id)}`, "_blank");
});

el.saveImmichBtn.addEventListener("click", async () => {
  state.settings = {
    ...state.settings,
    immichBaseUrl: el.immichBaseUrlInput.value.trim().replace(/\/+$/, ""),
    immichApiKey: el.immichApiKeyInput.value.trim(),
  };
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state.settings),
  });
  if (response.ok) {
    const payload = await response.json();
    state.settings = payload.settings;
    el.immichApiKeyInput.value = "";
    el.immichState.textContent = "已保存";
  } else {
    el.immichState.textContent = "保存失败";
  }
  renderImmich(state.current);
});

el.saveOpenAiBtn.addEventListener("click", async () => {
  state.settings = {
    ...state.settings,
    openAiApiKey: el.openAiApiKeyInput.value.trim(),
    openAiBaseUrl: el.openAiBaseUrlInput.value.trim().replace(/\/+$/, "") || "https://aiapi.zotpaper.cn/v1",
    openAiModel: el.openAiModelInput.value.trim() || "gpt-5.4-mini",
  };
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state.settings),
  });
  if (response.ok) {
    const payload = await response.json();
    state.settings = payload.settings;
    el.openAiApiKeyInput.value = "";
    el.settingsAiState.textContent = "已保存";
  } else {
    el.settingsAiState.textContent = "保存失败";
  }
  renderAi(state.current);
});

el.testOpenAiBtn.addEventListener("click", async () => {
  el.settingsAiState.textContent = "检测中";
  el.testOpenAiBtn.disabled = true;
  const response = await fetch("/api/ai/test", { method: "POST" });
  const payload = await response.json().catch(() => ({}));
  if (response.ok) {
    el.settingsAiState.textContent = `可用 · ${payload.model}`;
  } else {
    el.settingsAiState.textContent = "检测失败";
    el.aiResult.innerHTML = `<div class="empty">${payload.error || "模型不可用"}</div>`;
  }
  el.testOpenAiBtn.disabled = !state.settings.hasOpenAiApiKey;
});

el.analyzeCurrentBtn.addEventListener("click", async () => {
  if (!state.current) return;
  el.aiState.textContent = "抽帧中";
  el.analyzeCurrentBtn.disabled = true;
  try {
    const frames = await captureFrames({ render: true, maxFrames: 16 });
    el.aiState.textContent = "分析中";
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: state.current.id, frames }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "AI 分析失败");
    state.current.aiReview = payload.result;
    renderAi(state.current);
  } catch (error) {
    el.aiState.textContent = "分析失败";
    el.aiResult.innerHTML = `<div class="empty">${error.message}</div>`;
  } finally {
    el.analyzeCurrentBtn.disabled = !state.settings.hasOpenAiApiKey || !state.current;
  }
});

el.syncImmichBtn.addEventListener("click", async () => {
  el.immichState.textContent = "同步中";
  el.syncImmichBtn.disabled = true;
  try {
    const response = await fetch("/api/immich/sync", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "同步失败");
    await init();
    el.immichState.textContent = `同步完成 · ${Number(payload.totalVideos || 0).toLocaleString("zh-CN")} 个 · ${payload.totalSizeHuman || "0 B"}`;
  } catch (error) {
    el.immichState.textContent = error.message || "同步失败";
  } finally {
    el.syncImmichBtn.disabled = !immichBaseUrl() || !state.settings.hasImmichApiKey;
  }
});

el.openSavedImmichBtn.addEventListener("click", () => {
  if (state.current?.immichUrl) window.open(state.current.immichUrl, "_blank");
});

el.aiResult.addEventListener("click", (event) => {
  const button = event.target.closest("#acceptAiSuggestionBtn");
  if (!button || !state.current?.aiReview) return;
  const ai = state.current.aiReview;
  const segments = (ai.keepSegments || []).map((segment) => ({
    start: parseTime(segment.start),
    end: parseTime(segment.end),
    label: segment.reason || "AI 推荐片段",
  }));
  reviewPatch(state.current, {
    reviewStatus: ai.suggestedStatus || "cut",
    tags: [...new Set([...(state.current.tags || []), ...(ai.tags || [])])],
    notes: [state.current.notes, ai.summary].filter(Boolean).join("\n"),
    segments: segments.length ? segments : state.current.segments || [],
  });
});

init();
