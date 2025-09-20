const $ = (sel) => document.querySelector(sel);
const statusEl = $("#status");
const whyWrap  = $("#whyWrap");
const whyBtn   = $("#whyBtn");
const whyBox   = $("#whyBox");

function fmt(ts) { try { return new Date(ts).toLocaleString(); } catch { return "—"; } }

function showWhy(explicacao) {
  if (!explicacao) return;
  whyWrap.style.display = "block";
  whyBox.textContent = explicacao;
  // toggle
  whyBtn.onclick = () => {
    const open = whyBox.style.display !== "none";
    whyBox.style.display = open ? "none" : "block";
    whyBtn.textContent = open ? "Por que pode não ser confiável?" : "Ocultar explicação";
  };
}

function hideWhy() {
  whyWrap.style.display = "none";
  whyBox.style.display = "none";
  whyBtn.textContent = "Por que pode não ser confiável?";
}

function renderStatus({ lastStatus, lastSentAt, lastError, lastResult }) {
  statusEl.className = "muted"; // reset
  hideWhy();

  const titulo = lastResult?.titulo ? ` · ${lastResult.titulo}` : "";
  const classe = lastResult?.classificacao?.toLowerCase() || "";

  if (lastStatus === "ok") {
    if (classe.includes("possível") && (classe.includes("fake") || classe.includes("não confiável") || classe.includes("nao confiavel"))) {
      // NÃO confiável
      statusEl.classList.add("warn");
      statusEl.innerHTML = `⚠️ <strong>Possivelmente não confiável</strong>${titulo}`;
      // mostra botão/explicação
      showWhy(lastResult?.explicacao || "");
    } else if (classe.includes("confiável")) {
      // Confiável
      statusEl.classList.add("ok");
      statusEl.innerHTML = `✅ <strong>Possivelmente confiável</strong>${titulo}`;
    } else {
      statusEl.innerHTML = `ℹ️ <strong>Resultado recebido</strong>${titulo}`;
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
