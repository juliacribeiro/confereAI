const $ = (sel) => document.querySelector(sel);
const statusEl = $("#status");
const whyWrap  = $("#whyWrap");
const whyBtn   = $("#whyBtn");
const whyBox   = $("#whyBox");

function fmt(ts) { try { return new Date(ts).toLocaleString(); } catch { return "—"; } }

// Normaliza justificativa (string|objeto|array -> array)
function normalizeJustificativa(explicacao) {
  if (!explicacao) return [];
  if (Array.isArray(explicacao)) return explicacao;
  if (typeof explicacao === "object") return Object.values(explicacao);
  return [String(explicacao)];
}

function setExplanation(explicacao, cls) {
  const items = normalizeJustificativa(explicacao);
  if (items.length === 0) return;

  whyWrap.style.display = "block";
  whyBtn.textContent = (cls === 1) ? "Ver detalhes do erro" : "Ver justificativa";
  whyBox.innerHTML = "<ul style='margin:0; padding-left:18px'>" +
    items.map(t => `<li>${String(t)}</li>`).join("") +
    "</ul>";

  whyBtn.onclick = () => {
    const open = whyBox.style.display !== "none";
    whyBox.style.display = open ? "none" : "block";
    whyBtn.textContent = open
      ? ((cls === 1) ? "Ver detalhes do erro" : "Ver justificativa")
      : "Ocultar detalhes";
  };
  whyBox.style.display = "none";
}

function hideWhy() {
  whyWrap.style.display = "none";
  whyBox.style.display = "none";
  whyBtn.textContent = "Ver justificativa";
}

function renderStatus({ lastStatus, lastSentAt, lastError, lastResult }) {
  statusEl.className = "muted";
  hideWhy();

  const titulo = lastResult?.titulo ? ` · ${lastResult.titulo}` : "";
  const cls = Number(lastResult?.classificacao);
  const explicacao = lastResult?.explicacao;

  if (lastStatus === "ok") {
    if (cls === 1) {
      // provavelmetne com fake news
      statusEl.classList.add("warn");
      const items = normalizeJustificativa(explicacao);
      const resumo = items.length ? ` — Erro: ${items[0]}` : "";
      statusEl.innerHTML = `⚠️ <strong>provavelmetne com fake news</strong>${titulo}${resumo ? ` <span class="mono">${resumo}</span>` : ""}`;
      setExplanation(explicacao, cls);
    } else if (cls === 0) {
      // provavelmente sem fake news
      statusEl.classList.add("ok");
      statusEl.innerHTML = `✅ <strong>provavelmente sem fake news</strong>${titulo}`;
      setExplanation(explicacao, cls);
    } else if (cls === 2) {
      // incerto
      statusEl.innerHTML = `❓ <strong>Incerto</strong>${titulo}`;
      setExplanation(explicacao, cls);
    } else {
      statusEl.innerHTML = `ℹ️ <strong>Resultado recebido</strong>${titulo}`;
      setExplanation(explicacao, cls);
    }
  } else if (lastStatus === "error") {
    statusEl.classList.add("warn");
    statusEl.innerHTML = `❌ Erro ao analisar — ${fmt(lastSentAt)}${lastError ? ` <span class="mono">(${lastError})</span>` : ""}`;
  } else {
    statusEl.textContent = "—";
  }
}

async function init() {
  const { lastStatus, lastSentAt, lastError, lastResult } =
    await chrome.storage.local.get(["lastStatus", "lastSentAt", "lastError", "lastResult"]);
  renderStatus({ lastStatus, lastSentAt, lastError, lastResult });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.lastStatus || changes.lastSentAt || changes.lastError || changes.lastResult) {
    renderStatus({
      lastStatus: changes.lastStatus?.newValue ?? undefined,
      lastSentAt: changes.lastSentAt?.newValue ?? undefined,
      lastError:  changes.lastError?.newValue  ?? undefined,
      lastResult: changes.lastResult?.newValue ?? undefined
    });
  }
});

init();
