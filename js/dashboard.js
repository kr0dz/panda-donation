/* =========================
   ADMIN SCRIPT (dashboard.html)
   ========================= */

// ===== DOM HELPERS =====
function $(id) { return document.getElementById(id); }
function exists(id) { return !!document.getElementById(id); }

// ===== FALLBACK HELPERS (si NO cargas script.js en dashboard) =====
const __mxnFallback = (n) =>
  Number(n || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });

const __escapeHtmlFallback = (s) =>
  String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));

// Alias (usa los globales si ya existen)
const mxn = window.mxn || __mxnFallback;
const esc = window.esc || window.escapeHtml || __escapeHtmlFallback;

// Toast fallback
function __toastFallback(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = `
    position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
    background: rgba(11,18,32,.92); color: #fff; padding: 10px 12px;
    border-radius: 999px; z-index: 9999; font-size: 14px; box-shadow: 0 14px 40px rgba(0,0,0,.25);
  `;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transition = "opacity .25s ease";
  }, 1200);
  setTimeout(() => t.remove(), 1500);
}
const toast = window.toast || __toastFallback;

// copyText fallback
function __copyTextFallback(txt) {
  navigator.clipboard
    .writeText(txt)
    .then(() => toast("Copiado ✅"))
    .catch(() => alert("No se pudo copiar. Copia manualmente."));
}
const copyText = window.copyText || __copyTextFallback;

// JSONP fallback
function __jsonpFallback(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const s = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, 15000);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[cb]; } catch (e) { window[cb] = undefined; }
      s.remove();
    }

    window[cb] = (data) => { cleanup(); resolve(data); };

    const sep = url.includes("?") ? "&" : "?";
    s.src = url + sep + "callback=" + encodeURIComponent(cb);
    s.onerror = () => { cleanup(); reject(new Error("script error")); };

    document.body.appendChild(s);
  });
}
const jsonp = window.jsonp || __jsonpFallback;

// Normalizer fallback
function __normalizeValidatedRowFallback(row, ticketPrice = 200) {
  const amount = Number(row.amount ?? row.monto ?? row.monto_mxn ?? 0) || 0;
  let tickets = Number(row.tickets ?? row.boletos ?? 0) || 0;
  if (!tickets && amount >= ticketPrice) tickets = Math.floor(amount / ticketPrice);

  return {
    id: row.id ?? row.folio ?? "-",
    name: row.name ?? row.nombre ?? "-",
    amount,
    tickets,
    date: row.date ?? row.fecha ?? "",
    status: row.status ?? row.estado ?? "Validado",
  };
}
const normalizeValidatedRow =
  window.normalizeValidatedRow || ((row) => __normalizeValidatedRowFallback(row, window.TICKET_PRICE || 200));

// ====== CONFIG / STORAGE ======
const LS_TOKEN = "ADMIN_TOKEN";
const LS_WEBAPP = "WEBAPP_BASE";

// URL BASE (sin params)
const DEFAULT_WEBAPP_BASE =
  "https://script.google.com/macros/s/AKfycbzdvpnb3-JtRcVoK4Z2BdDNnfafj-i2RaqIdmkMPky8qpgbo22kdGRGpplMqeSaGkWG/exec";

// Precio de boleto (si existe global, úsalo; si no, 200)
const TICKET_PRICE = window.TICKET_PRICE || 200;

// Día oficial de la rifa (para mensajes / auditoría)
const RAFFLE_DATE = "10 de febrero";

// Estado (si existe global validated úsalo; si no, crea uno)
let validated = Array.isArray(window.validated) ? window.validated : [];
window.__raffleResult = null;

// ====== AUTH / CONFIG UI ======
function getToken() {
  return localStorage.getItem(LS_TOKEN) || "";
}

function getWebappBase() {
  const inputVal = exists("webapp") ? $("webapp").value.trim() : "";
  const v = (inputVal || localStorage.getItem(LS_WEBAPP) || DEFAULT_WEBAPP_BASE).trim();

  if (!v) throw new Error("Configura la URL BASE del Web App.");
  if (v.includes("?")) throw new Error("Pega la URL BASE sin parámetros (sin ?action=...).");
  return v;
}

function saveWebapp() {
  try {
    if (!exists("webapp")) return alert("No existe el input #webapp en dashboard.html");
    const v = $("webapp").value.trim();
    if (!v) return alert("Pega la URL base /exec.");
    if (v.includes("?")) return alert("Pega la URL BASE sin parámetros.");
    localStorage.setItem(LS_WEBAPP, v);
    toast("URL guardada ✅");
  } catch (e) {
    alert(e.message);
  }
}

function saveToken() {
  if (!exists("token")) return alert("No existe el input #token en dashboard.html");
  const t = $("token").value.trim();
  if (!t) return alert("Pega tu ADMIN_TOKEN.");
  localStorage.setItem(LS_TOKEN, t);
  toast("Token guardado ✅");
  setUIAccess();
  refreshAll();
}

function logout() {
  localStorage.removeItem(LS_TOKEN);
  window.__raffleResult = null;
  location.reload();
}

function setUIAccess() {
  const token = getToken();
  if (exists("adminUI")) $("adminUI").classList.toggle("hidden", !token);

  // Si quieres ocultar el card del token cuando ya hay token:
  // if (exists("cardToken")) $("cardToken").classList.toggle("hidden", !!token);
}

// ====== URL BUILDER ======
function buildUrl(params) {
  const base = getWebappBase();
  const u = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).length) u.searchParams.set(k, String(v));
  });
  return u.toString();
}

// ====== PENDING ======
async function loadPending() {
  const token = getToken();
  if (!token) return;

  try {
    const url = buildUrl({ action: "pending", key: token });
    const data = await jsonp(url);
    if (!data || !data.ok) throw new Error(data?.error || "No se pudo cargar pendientes");

    const items = Array.isArray(data.items) ? data.items : (data.rows || []);
    renderPending(items);
  } catch (e) {
    alert("Pendientes: " + e.message);
  }
}

function renderPending(rows) {
  if (!exists("pendingBody")) return; // tabla pendientes
  const tb = $("pendingBody");
  tb.innerHTML = "";

  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="6" class="text-secondary">No hay pendientes.</td></tr>`;
    return;
  }

  rows.forEach((r) => {
    const folio = r.folio || r.id || "-";
    const nombre = r.nombre || r.name || "-";
    const monto = Number(r.monto_mxn ?? r.amount ?? 0) || 0;

    let boletos = Number(r.boletos ?? r.tickets ?? 0) || 0;
    if (!boletos && monto >= TICKET_PRICE) boletos = Math.floor(monto / TICKET_PRICE);

    const ts = r.timestamp || r.date || r.fecha || "";

    const tr = document.createElement("tr");
    const folioSafe = String(folio).replace(/'/g, "\\'");
    const nameSafe = String(nombre).replace(/'/g, "\\'");

    tr.innerHTML = `
      <td class="mono"><b>${esc(folio)}</b></td>
      <td>${esc(nombre)}</td>
      <td><b>${mxn(monto)}</b></td>
      <td>${Number(boletos || 0)}</td>
      <td class="text-secondary small">${esc(ts)}</td>
      <td class="text-end">
        <button class="btn btn-success btn-sm" onclick="validateFolio('${folioSafe}', '${nameSafe}')">
          Validar
        </button>
      </td>
    `;
    tb.appendChild(tr);
  });
}

function abbreviate(full) {
  const p = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return full || "";
  return `${p[0]} ${p[1][0].toUpperCase()}.`;
}

async function validateFolio(folio, fullName) {
  const token = getToken();
  if (!token) return alert("Sin token.");

  const publicName = prompt("Nombre público (ej. “Luis G.”).", abbreviate(fullName));
  if (!publicName) return;

  try {
    const url = buildUrl({
      action: "validate",
      key: token,
      folio: folio,
      publicName: publicName.trim(),
    });

    const data = await jsonp(url);
    if (!data || !data.ok) throw new Error(data?.error || "No se pudo validar");

    toast("Validado ✅");
    await refreshAll();
  } catch (e) {
    alert("Validar: " + e.message);
  }
}

// ====== VALIDATED (para sorteo y stats) ======
async function loadValidatedAdmin() {
  try {
    const url = buildUrl({ action: "validated" });
    const data = await jsonp(url);
    if (!data || !data.ok) throw new Error(data?.error || "No se pudo cargar validadas");
    validated = Array.isArray(data.items) ? data.items.map(normalizeValidatedRow) : [];
    window.validated = validated;
  } catch (e) {
    validated = [];
    console.warn(e);
  } finally {
    renderSorteoStats();
  }
}

// ====== RANKING ======
function computeTopFromValidatedAdmin() {
  const map = new Map();
  for (const row of validated) {
    const name = (row.name || "").trim() || "Anónimo";
    const prev = map.get(name) || { name, amount: 0, tickets: 0 };
    prev.amount += Number(row.amount) || 0;
    prev.tickets += Number(row.tickets) || 0;
    map.set(name, prev);
  }
  return Array.from(map.values())
    .sort((a, b) => (b.amount - a.amount) || (b.tickets - a.tickets) || a.name.localeCompare(b.name))
    .slice(0, 10);
}

async function loadRankingAdmin() {
  try {
    const url = buildUrl({ action: "ranking" });
    const data = await jsonp(url);
    if (!data || !data.ok) throw new Error(data?.error || "No se pudo cargar ranking");
    renderRanking(Array.isArray(data.top) ? data.top : []);
  } catch (e) {
    if (!validated.length) await loadValidatedAdmin();
    renderRanking(computeTopFromValidatedAdmin());
  }
}

function renderRanking(list) {
  if (!exists("ranking")) return;
  if (!list.length) {
    $("ranking").innerHTML = `<div class="text-secondary">Aún no hay donaciones validadas.</div>`;
    return;
  }

  const html = `
    <ol class="mb-0">
      ${list
      .map((x) => {
        const name = x.name ?? x.nombre ?? "—";
        const amount = Number(x.amount ?? x.monto ?? 0) || 0;
        const tickets = Number(x.tickets ?? x.boletos ?? 0) || 0;

        return `
            <li class="mb-2">
              <div style="font-weight:800;">${esc(name)}</div>
              <div class="text-secondary small">
                Total: <b>${mxn(amount)}</b> ·
                Boletos: <b>${tickets}</b>
              </div>
            </li>
          `;
      })
      .join("")}
    </ol>
  `;
  $("ranking").innerHTML = html;
}

// ====== SORTEO ======
function renderSorteoStats() {
  if (!exists("participantsCount") || !exists("ticketsTotal")) return;

  const participants = validated.length;
  const ticketsTotal = validated.reduce((a, x) => a + (Number(x.tickets) || 0), 0);

  $("participantsCount").textContent = participants.toLocaleString("es-MX");
  $("ticketsTotal").textContent = ticketsTotal.toLocaleString("es-MX");
}

function cryptoRandomInt(min, max) {
  const range = max - min + 1;
  const maxRange = 0xffffffff;
  const bucket = Math.floor(maxRange / range) * range;
  let x;
  do {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    x = arr[0];
  } while (x >= bucket);
  return min + (x % range);
}

function simpleHash(str) {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h2 = (h2 ^ (h2 >>> 16)) >>> 0;
  return (
    "RAFFLE-" +
    (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0"))
      .toUpperCase()
  );
}

async function drawWinner() {
  if (!validated.length) await loadValidatedAdmin();
  if (!validated.length) return alert("No hay donaciones validadas.");

  // pool por boletos
  const pool = [];
  validated.forEach((p) => {
    const t = Number(p.tickets) || 0;
    for (let i = 0; i < t; i++) pool.push(p);
  });
  if (!pool.length) return alert("No hay boletos asignados (tickets=0).");

  const idx = cryptoRandomInt(0, pool.length - 1);
  const w = pool[idx];

  const when = new Date().toISOString();
  const seed = `${when}|${w.id}|${pool.length}|${idx}`;
  const hash = simpleHash(seed);

  // Guarda resultado
  window.__raffleResult = { winner: w, when, hash, poolSize: pool.length, index: idx };

  // Animación fullscreen
  if (typeof showCountdownAndRevealWinner === "function") {
    showCountdownAndRevealWinner(
      {
        name: w.name,
        folio: w.id,
        tickets: Number(w.tickets) || 0,
        amount: mxn(Number(w.amount) || 0),
        fingerprint: hash,
      },
      10
    );
  }

  // UI normal en winnerBox
  if (exists("winnerBox")) {
    $("winnerBox").innerHTML = `
      <div class="d-flex justify-content-between flex-wrap gap-2">
        <div>
          <div class="text-secondary small">Ganador</div>
          <div class="h5 mb-1" style="font-weight:800;">
            ${esc(w.name)} <span class="badge text-bg-primary ms-1">${esc(w.id)}</span>
          </div>
          <div class="text-secondary small mb-0">
            Boletos: <b>${Number(w.tickets) || 0}</b> · Donación: <b>${mxn(Number(w.amount) || 0)}</b>
          </div>
        </div>
        <div class="text-end">
          <div class="text-secondary small">Momento</div>
          <div class="mono"><b>${esc(when)}</b></div>
        </div>
      </div>
      <hr class="my-3">
      <div class="text-secondary small mb-1">Huella del sorteo</div>
      <div class="mono"><b>${esc(hash)}</b></div>
      <div class="text-secondary small mt-2">PoolSize: <b>${pool.length}</b> · Index: <b>${idx}</b></div>
    `;
  }

  toast("Sorteo realizado ✅");
}

function resetResult() {
  if (exists("winnerBox")) {
    $("winnerBox").innerHTML =
      `<div class="text-secondary small mb-1">Resultado</div><div class="text-secondary mb-0">Aún no se ha realizado el sorteo.</div>`;
  }
  window.__raffleResult = null;
}

function copyResult() {
  const r = window.__raffleResult;
  if (!r) return alert("Primero realiza el sorteo.");

  const amountStr = mxn(Number(r.winner.amount) || 0);

  const text =
`Resultado sorteo — Rifa Panda
Día oficial de la rifa: ${RAFFLE_DATE}
Momento de ejecución: ${r.when}

Ganador: ${r.winner.name} (${r.winner.id})
Donación: ${amountStr}
Boletos: ${r.winner.tickets}

Pool: ${r.poolSize} (index ${r.index})
Huella: ${r.hash}`;

  copyText(text);
}

// ====== REFRESH ALL ======
async function refreshAll() {
  await loadPending();
  await loadValidatedAdmin();
  await loadRankingAdmin();
}

// ====== EXPORT FUNCTIONS to window (para onclick en HTML) ======
window.saveWebapp = saveWebapp;
window.saveToken = saveToken;
window.logout = logout;

window.loadPending = loadPending;
window.validateFolio = validateFolio;

window.drawWinner = drawWinner;
window.resetResult = resetResult;
window.copyResult = copyResult;

window.refreshAll = refreshAll;

// ====== INIT ======
async function initDashboardWhenReady() {
  // IDs mínimos
  const required = ["webapp", "token"];
  const ready = required.every(exists);
  if (!ready) return false;

  // base del webapp
  $("webapp").value = localStorage.getItem(LS_WEBAPP) || DEFAULT_WEBAPP_BASE;

  // token
  $("token").value = getToken();

  setUIAccess();

  if (getToken()) {
    await refreshAll();
  }

  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  // 1) intentar inmediato
  initDashboardWhenReady().then((ok) => {
    if (ok) return;

    // 2) si usas partials.js, escucha evento
    document.addEventListener("partials:loaded", () => {
      initDashboardWhenReady();
    }, { once: true });

    // 3) fallback poll (por si no emites evento)
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const ok2 = await initDashboardWhenReady();
      if (ok2 || tries > 40) clearInterval(t); // ~4s
    }, 100);
  });
});

/* =========================
   DRAW OVERLAY (COUNTDOWN + CONFETTI)
   ========================= */

const __drawUI = {
  overlay: null,
  num: null,
  hint: null,
  reveal: null,
  winnerLine: null,
  winnerMeta: null,
  running: false,
  t: null,
};

function initDrawOverlayUI() {
  __drawUI.overlay = document.getElementById("drawOverlay");
  __drawUI.num = document.getElementById("countNum");
  __drawUI.hint = document.getElementById("countHint");
  __drawUI.reveal = document.getElementById("winnerReveal");
  __drawUI.winnerLine = document.getElementById("winnerLine");
  __drawUI.winnerMeta = document.getElementById("winnerMeta");

  if (!__drawUI.overlay) return;

  // Click to close (only after reveal)
  __drawUI.overlay.addEventListener("click", () => {
    if (__drawUI.reveal?.classList.contains("show")) closeDrawOverlay();
  });

  // ESC to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && __drawUI.reveal?.classList.contains("show")) {
      closeDrawOverlay();
    }
  });
}

function openDrawOverlay() {
  if (!__drawUI.overlay) initDrawOverlayUI();
  if (!__drawUI.overlay) return;

  __drawUI.overlay.classList.add("show");
  __drawUI.overlay.setAttribute("aria-hidden", "false");
}

function closeDrawOverlay() {
  if (!__drawUI.overlay) return;
  __drawUI.overlay.classList.remove("show");
  __drawUI.overlay.setAttribute("aria-hidden", "true");
  __drawUI.reveal?.classList.remove("show");
  __drawUI.num && (__drawUI.num.textContent = "");
  __drawUI.hint && (__drawUI.hint.textContent = "");
  __drawUI.running = false;
  if (__drawUI.t) clearTimeout(__drawUI.t);
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function confettiBurst(durationMs = 2500) {
  if (typeof confetti !== "function") return;

  const end = Date.now() + durationMs;

  (function frame() {
    confetti({
      particleCount: 6,
      spread: 70,
      startVelocity: 42,
      origin: { x: Math.random(), y: 0.15 },
    });
    confetti({
      particleCount: 4,
      spread: 110,
      startVelocity: 36,
      origin: { x: Math.random(), y: 0.2 },
    });

    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/**
 * winnerPayload ejemplo:
 * {
 *   name: "Juan Pérez",
 *   folio: "A-1029",
 *   tickets: 4,
 *   amount: 2000,
 *   fingerprint: "abc123...",
 *   raw: { ... } // opcional
 * }
 */
async function showCountdownAndRevealWinner(winnerPayload, seconds = 10) {
  if (__drawUI.running) return;
  __drawUI.running = true;

  openDrawOverlay();

  // Reset UI
  __drawUI.reveal.classList.remove("show");
  __drawUI.hint.textContent = "Iniciando conteo…";
  __drawUI.winnerLine.textContent = "—";
  __drawUI.winnerMeta.textContent = "";

  // Countdown
  for (let s = seconds; s >= 1; s--) {
    __drawUI.num.textContent = String(s);
    __drawUI.num.classList.remove("pop");
    // reflow para re-disparar animación
    void __drawUI.num.offsetWidth;
    __drawUI.num.classList.add("pop");

    __drawUI.hint.textContent = "Sorteando (ponderado por boletos)…";
    await sleep(1000);
  }

  // Reveal winner
  __drawUI.num.textContent = "🎉";
  __drawUI.num.classList.remove("pop");
  void __drawUI.num.offsetWidth;
  __drawUI.num.classList.add("pop");

  const safeName = winnerPayload?.name ?? "Ganador/a";
  const safeFolio = winnerPayload?.folio ? ` — Folio ${winnerPayload.folio}` : "";
  __drawUI.winnerLine.textContent = `${safeName}${safeFolio}`;

  const metaParts = [];
  if (winnerPayload?.tickets != null) metaParts.push(`Boletos: ${winnerPayload.tickets}`);
  if (winnerPayload?.amount != null) metaParts.push(`Monto: ${winnerPayload.amount}`);
  if (winnerPayload?.fingerprint) metaParts.push(`Huella: ${winnerPayload.fingerprint}`);

  __drawUI.winnerMeta.textContent = metaParts.join("  •  ");

  __drawUI.reveal.classList.add("show");
  confettiBurst(2600);

  // Auto-close opcional después de 8s
  __drawUI.t = setTimeout(() => {
    closeDrawOverlay();
  }, 8000);

  __drawUI.running = false;
}

// init overlay
document.addEventListener("DOMContentLoaded", initDrawOverlayUI);
