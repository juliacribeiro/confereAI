// Estado simples pra deduplicar envios
let last = { tabId: null, url: null };

const isHttp = (url) => /^https?:\/\//i.test(url);

// Lê configs salvas nas opções
async function getConfig() {
  const { endpoint, token } = await chrome.storage.local.get(["endpoint", "token"]);
  return { endpoint, token };
}

// Mapas de ícones por estado
const ICONS = {
  idle:    { 16: "img/block_16.png",  32: "img/block_32.png",  48: "img/block_48.png",  128: "img/block_128.png"  },
  loading: { 16: "img/cached_16.png", 32: "img/cached_32.png", 48: "img/cached_48.png", 128: "img/cached_128.png" },
  ok:      { 16: "img/check_16.png",  32: "img/check_32.png",  48: "img/check_48.png",  128: "img/check_128.png"  },
  error:   { 16: "img/close_16.png",  32: "img/close_32.png",  48: "img/close_48.png",  128: "img/close_128.png"  }
};

/**
 * Troca o ícone da action.
 * Passe um tabId para mudar só naquela aba; sem tabId muda globalmente.
 */
async function setIcon(status = "idle", tabId) {
  const path = ICONS[status] || ICONS.idle;
  if (tabId) return chrome.action.setIcon({ path, tabId });
  return chrome.action.setIcon({ path });
}

/** (Opcional) Badge curto para feedback visual */
async function setBadge(text = "", color = "#666") {
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}

// Envia a URL para sua API (com feedback de ícone + status persistido)
async function sendToApi(url, tabId) {
  const { endpoint, token } = await getConfig();
  const payload = buildPayload({ url, tabId }); // << JSON único da requisição

  if (!endpoint) {
    console.warn("[ext] Endpoint não configurado. Abra as opções para definir.");
    await saveLastPayload(payload);
    await chrome.storage.local.set({
      lastStatus: "error",
      lastUrl: url,
      lastSentAt: Date.now(),
      lastError: "Endpoint não configurado"
    });
    await setIcon("error", tabId);
    await setBadge("!", "#C0392B");
    setTimeout(() => { setIcon("idle", tabId); setBadge(""); }, 2500);
    return;
  }

  try {
    await setIcon("loading", tabId);
    await setBadge("…");

    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // salva o JSON localmente ANTES de enviar (útil p/ debug)
    await saveLastPayload(payload);

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload) // << envia o MESMO JSON salvo
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    console.log("[ext] URL enviada com sucesso:", url);

    await chrome.storage.local.set({
      lastStatus: "ok",
      lastUrl: url,
      lastSentAt: Date.now(),
      lastError: null
    });

    await setIcon("ok", tabId);
    await setBadge("");
    setTimeout(() => setIcon("idle", tabId), 2000);
  } catch (e) {
    console.error("[ext] Falha ao enviar:", e);

    await chrome.storage.local.set({
      lastStatus: "error",
      lastUrl: url,
      lastSentAt: Date.now(),
      lastError: String(e && e.message ? e.message : e)
    });

    await setIcon("error", tabId);
    await setBadge("!", "#C0392B");
    setTimeout(() => { setIcon("idle", tabId); setBadge(""); }, 3000);
  }
}


// Processa uma nova URL candidata (com dedupe/validações)
function handleNewUrl(tabId, url) {
  if (!url || !isHttp(url)) return; // ignora chrome://, file://, Web Store, etc.
  if (last.tabId === tabId && last.url === url) return; // duplicada
  last = { tabId, url };
  console.log("[ext] Nova URL ativa:", url);
  // envio automático sempre que detectar mudança
  sendToApi(url, tabId);
}

// Atualiza pela aba ativa da janela focada
async function refreshActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) handleNewUrl(tab.id, tab.url);
  } catch (_) {}
}

/** LISTENERS **/

// 1) Troca de aba ativa
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    handleNewUrl(tabId, tab.url);
  } catch (_) {}
});

// 2) Mudanças de URL / navegação tradicional
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    handleNewUrl(tabId, changeInfo.url);
  } else if (changeInfo.status === "complete" && tab.active) {
    // fallback quando a página termina de carregar
    handleNewUrl(tabId, tab.url);
  }
});

// 3) Troca de foco de janela (usuário alterna entre janelas)
chrome.windows.onFocusChanged.addListener(() => {
  setTimeout(refreshActiveTab, 120); // pequeno atraso ajuda a pegar a aba correta
});

// 4) Mudanças de histórico em SPA (pushState/replaceState)
chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    chrome.tabs.get(details.tabId).then((tab) => {
      if (tab.active) handleNewUrl(tab.id, tab.url);
    }).catch(() => {});
  },
  { url: [{ schemes: ["http", "https"] }] }
);

// Inicializa quando o service worker sobe
refreshActiveTab();

// ❌ Removido o listener SEND_NOW — não é mais necessário porque o envio é automático.

// --------- helpers de payload/armazenamento ----------
function buildPayload({ url, tabId }) {
  return {
    url,
    tabId,
    capturedAt: new Date().toISOString()
    // se quiser, dá pra incluir mais coisas depois: userAgent, title, etc.
  };
}

async function saveLastPayload(payload) {
  // mantém o último e também um histórico curto (ex.: 50 itens)
  const { payloadHistory = [] } = await chrome.storage.local.get(["payloadHistory"]);
  const next = [payload, ...payloadHistory].slice(0, 50);
  await chrome.storage.local.set({ lastPayload: payload, payloadHistory: next });
}
