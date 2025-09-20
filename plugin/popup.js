const $ = (sel) => document.querySelector(sel);
const urlEl = $("#url");
const statusEl = $("#status");

function fmt(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return "—"; }
}

function renderStatus({ lastStatus, lastSentAt, lastError }) {
  statusEl.classList.remove("ok", "warn");
  if (lastStatus === "ok") {
    statusEl.classList.add("ok");
    statusEl.innerHTML = `✅ OK — ${fmt(lastSentAt)}`;
  } else if (lastStatus === "error") {
    statusEl.classList.add("warn");
    statusEl.innerHTML = `❌ Erro — ${fmt(lastSentAt)}${lastError ? ` <span class="mono">(${lastError})</span>` : ""}`;
  } else {
    statusEl.textContent = "—";
  }
}

function renderPayload(payload) {
  if (!payload) { urlEl.textContent = "—"; return; }
  try { urlEl.textContent = JSON.stringify(payload, null, 2); }
  catch { urlEl.textContent = String(payload); }
}

async function getActiveTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.url || null;
  } catch { return null; }
}

async function init() {
  // pega último JSON salvo e status
  const { lastPayload, lastStatus, lastSentAt, lastError } =
    await chrome.storage.local.get(["lastPayload", "lastStatus", "lastSentAt", "lastError"]);

  if (lastPayload) {
    renderPayload(lastPayload);
  } else {
    // fallback: mostra URL da aba atual enquanto ainda não salvamos payload
    const fallbackUrl = await getActiveTabUrl();
    renderPayload(fallbackUrl ? { url: fallbackUrl } : null);
  }

  renderStatus({ lastStatus, lastSentAt, lastError });
}

// Atualiza ao vivo quando o background salvar algo novo
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.lastPayload) renderPayload(changes.lastPayload.newValue);
  if (changes.lastStatus || changes.lastSentAt || changes.lastError) {
    renderStatus({
      lastStatus: changes.lastStatus?.newValue,
      lastSentAt: changes.lastSentAt?.newValue,
      lastError:  changes.lastError?.newValue
    });
  }
});

init();
