// Estado simples pra deduplicar envios
let last = { tabId: null, url: null };

const isHttp = (url) => /^https?:\/\//i.test(url);

// Lê configs salvas nas opções
async function getConfig() {
  const { endpoint, token } = await chrome.storage.local.get(["endpoint", "token"]);
  return { endpoint, token };
}

// Ícones
const ICONS = {
  idle:    { 16: "img/block_16.png",  32: "img/block_32.png",  48: "img/block_48.png",  128: "img/block_128.png"  },
  loading: { 16: "img/search_16.png", 32: "img/search_32.png", 48: "img/search_48.png", 128: "img/search_128.png" },
  ok:      { 16: "img/check_16.png",  32: "img/check_32.png",  48: "img/check_48.png",  128: "img/check_128.png"  },
  error:   { 16: "img/close_16.png",  32: "img/close_32.png",  48: "img/close_48.png",  128: "img/close_128.png"  }
};

async function setIcon(status = "idle", tabId) {
  const path = ICONS[status] || ICONS.idle;
  if (tabId) return chrome.action.setIcon({ path, tabId });
  return chrome.action.setIcon({ path });
}
async function setBadge(text = "", color = "#666", tabId) {
  if (tabId) {
    await chrome.action.setBadgeText({ text, tabId });
    await chrome.action.setBadgeBackgroundColor({ color, tabId });
  } else {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });
  }
}

// Normaliza strings (remove acentos/hífens e põe minúsculas)
function norm(s) {
  return (s || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[-–—]/g, " ")
    .toLowerCase();
}
function isSuspectClass(cl) {
  const c = norm(cl);
  // qualquer menção a fake ou "nao/não confiavel"
  return /fake|nao confiavel|nao\s+confiavel|nao-confiavel|nao\s*confiavel/.test(c);
}

// ---------- helpers de payload/armazenamento ----------
function buildPayload({ url, tabId }) {
  return {
    url,
    tabId,
    capturedAt: new Date().toISOString()
  };
}
async function saveLastPayload(payload) {
  const { payloadHistory = [] } = await chrome.storage.local.get(["payloadHistory"]);
  const next = [payload, ...payloadHistory].slice(0, 50);
  await chrome.storage.local.set({ lastPayload: payload, payloadHistory: next });
}

// ---------- envio p/ API /analyze ----------
async function sendToApi(url, tabId) {
  const { endpoint, token } = await getConfig();
  const payload = buildPayload({ url, tabId });  // ainda salvo localmente p/ troubleshooting

  if (!endpoint) {
    console.warn("[ext] Endpoint não configurado.");
    await saveLastPayload(payload);
    await chrome.storage.local.set({
      lastStatus: "error",
      lastUrl: url,
      lastSentAt: Date.now(),
      lastError: "Endpoint não configurado",
      lastResult: null
    });
    await setIcon("error", tabId);
    await setBadge("!", "#C0392B", tabId);
    return;
  }

  try {
    await setIcon("loading", tabId);
    await setBadge("…", "#666", tabId);

    // salva o JSON local ANTES (debug)
    await saveLastPayload(payload);

    // >>> o app.py espera { url } <<<
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ url })   // <<< compatível com /analyze
    });

    // trata HTTP error
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${txt || ""}`.trim());
    }

    // guarda o resultado retornado (titulo, resumo, classificacao, explicacao)
    let result = null;
    try { result = await res.json(); } catch { result = null; }

    await chrome.storage.local.set({
      lastStatus: "ok",
      lastUrl: url,
      lastSentAt: Date.now(),
      lastError: null,
      lastResult: result
    });

    // Ícone alinhado com a classificação retornada
    const suspect = isSuspectClass(result?.classificacao);
    await setIcon(suspect ? "error" : "ok", tabId);
    await setBadge("", "#666", tabId);

  } catch (e) {
    console.error("[ext] Falha ao enviar:", e);
    await chrome.storage.local.set({
      lastStatus: "error",
      lastUrl: url,
      lastSentAt: Date.now(),
      lastError: String(e && e.message ? e.message : e),
      lastResult: null
    });
    // erro de rede/HTTP → ícone de erro
    await setIcon("error", tabId);
    await setBadge("!", "#C0392B", tabId);
  }
}

// ---------- detecção de nova URL ----------
function handleNewUrl(tabId, url) {
  if (!url || !isHttp(url)) return;
  if (last.tabId === tabId && last.url === url) return;
  last = { tabId, url };
  sendToApi(url, tabId);
}
async function refreshActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) handleNewUrl(tab.id, tab.url);
  } catch {}
}

// listeners
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try { const tab = await chrome.tabs.get(tabId); handleNewUrl(tabId, tab.url); } catch {}
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) handleNewUrl(tabId, changeInfo.url);
  else if (changeInfo.status === "complete" && tab.active) handleNewUrl(tabId, tab.url);
});
chrome.windows.onFocusChanged.addListener(() => { setTimeout(refreshActiveTab, 120); });
chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => { chrome.tabs.get(details.tabId).then((tab) => { if (tab.active) handleNewUrl(tab.id, tab.url); }).catch(() => {}); },
  { url: [{ schemes: ["http", "https"] }] }
);

chrome.runtime.onInstalled.addListener(async () => {
  const { endpoint } = await chrome.storage.local.get(["endpoint"]);
  if (!endpoint) {
    await chrome.storage.local.set({ endpoint: "http://localhost:5000/analyze" });
    console.log("[ext] Endpoint padrão configurado:", "http://localhost:5000/analyze");
  }
});

refreshActiveTab();
