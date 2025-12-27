/* =========================
   PUBLIC SCRIPT (index.html)
   ========================= */

// ====== CONFIG ======
const GOAL_MXN = 500000;
const TICKET_PRICE = 500;

const CONTACT_WA = "+52 1 415 215 7587";
const CONTACT_EMAIL = "hbcasamorena@gmail.com";

const APPS_SCRIPT_WEBAPP =
  "https://script.google.com/macros/s/AKfycbzdvpnb3-JtRcVoK4Z2BdDNnfafj-i2RaqIdmkMPky8qpgbo22kdGRGpplMqeSaGkWG/exec";

const SITE_URL = "";

// ====== STATE ======
let validated = [];
let __submitting = false;

// ====== HELPERS ======
const mxn = (n) =>
  Number(n || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));

const esc = escapeHtml;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function $(id) {
  return document.getElementById(id);
}
function exists(id) {
  return !!$(id);
}

// ====== TOAST ======
function toast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = `
    position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
    background: rgba(11,18,32,.92); color: #fff; padding: 10px 12px;
    border-radius: 999px; z-index: 9999; font-size: 14px;
  `;
  document.body.appendChild(t);
  setTimeout(() => (t.style.opacity = "0"), 1200);
  setTimeout(() => t.remove(), 1500);
}

function copyText(txt) {
  navigator.clipboard
    .writeText(txt)
    .then(() => toast("Copiado ✅"))
    .catch(() => alert("No se pudo copiar."));
}

// ====== SHARE ======
function openShare() {
  location.hash = "#share";
  if (exists("shareLink")) $("shareLink").focus();
}
function copyShare() {
  if (exists("shareLink")) copyText($("shareLink").value);
}

function initShare() {
  if (!exists("shareLink")) return;

  const base = SITE_URL || (location.origin + location.pathname);
  $("shareLink").value = base;

  const msg = encodeURIComponent(
    "Rifa solidaria — Apoyemos a Panda. 1 boleto=$500. Premios: estancias en hoteles. Participa aquí: " +
      base
  );

  if (exists("btnWA")) $("btnWA").href = "https://wa.me/?text=" + msg;
  if (exists("btnFB"))
    $("btnFB").href =
      "https://www.facebook.com/sharer/sharer.php?u=" +
      encodeURIComponent(base);
  if (exists("btnX"))
    $("btnX").href =
      "https://twitter.com/intent/tweet?text=" + msg;
}

// ====== JSONP ======
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const s = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, 15000);

    function cleanup() {
      clearTimeout(timer);
      try {
        delete window[cb];
      } catch {
        window[cb] = undefined;
      }
      s.remove();
    }

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };

    const sep = url.includes("?") ? "&" : "?";
    s.src = url + sep + "callback=" + cb;
    s.onerror = () => {
      cleanup();
      reject(new Error("script error"));
    };

    document.body.appendChild(s);
  });
}

// ====== TOP DONADORES ======
function normalizeValidatedRow(row) {
  const amount = Number(row.amount ?? row.monto ?? row.monto_mxn ?? 0) || 0;
  let tickets = Number(row.tickets ?? row.boletos ?? 0) || 0;
  if (!tickets && amount >= TICKET_PRICE)
    tickets = Math.floor(amount / TICKET_PRICE);

  return {
    name: row.name ?? row.nombre ?? "—",
    amount,
    tickets,
  };
}

function computeTopFromValidated() {
  const map = new Map();
  for (const row of validated) {
    const name = (row.name || "").trim() || "Anónimo";
    const prev = map.get(name) || { name, amount: 0, tickets: 0 };
    prev.amount += row.amount;
    prev.tickets += row.tickets;
    map.set(name, prev);
  }
  return Array.from(map.values())
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        b.tickets - a.tickets ||
        a.name.localeCompare(b.name)
    )
    .slice(0, 10);
}

function renderTopTable(list) {
  if (!exists("tbodyTop")) return;
  const tbody = $("tbodyTop");
  tbody.innerHTML = "";

  if (!list.length) {
    tbody.innerHTML =
      `<tr><td colspan="4" class="muted">Aún no hay donaciones validadas.</td></tr>`;
    return;
  }

  list.forEach((x, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(x.name)}</td>
      <td><b>${mxn(x.amount)}</b></td>
      <td>${x.tickets}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadRanking() {
  try {
    const res = await jsonp(APPS_SCRIPT_WEBAPP + "?action=ranking");
    if (!res || !res.ok) throw new Error();
    renderTopTable(res.top || []);
  } catch {
    renderTopTable(computeTopFromValidated());
  }
}

// ====== REGISTRO ======
async function submitRegistration() {
  if (__submitting) return;
  __submitting = true;

  if (!exists("fName") || !exists("fAmount") || !exists("fOk")) {
    __submitting = false;
    return;
  }

  const name = $("fName").value.trim();
  const amount = Number($("fAmount").value.replace(/[^\d.]/g, ""));
  if (!name || amount < TICKET_PRICE) {
    __submitting = false;
    return alert("Datos inválidos.");
  }

  const url =
    APPS_SCRIPT_WEBAPP +
    `?name=${encodeURIComponent(name)}&amount=${amount}`;

  try {
    const res = await jsonp(url);
    if (!res || !res.ok) throw new Error();
    toast("Registro recibido ✅");
    loadRanking();
  } catch {
    alert("Error al registrar.");
  } finally {
    __submitting = false;
  }
}

// ====== INIT ======
async function initPublicWhenReady() {
  const required = ["year", "shareLink", "tbodyTop"];
  if (!required.every(exists)) return false;

  $("year").textContent = new Date().getFullYear();
  initShare();
  await loadRanking();
  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  initPublicWhenReady().then((ok) => {
    if (ok) return;
    document.addEventListener(
      "partials:loaded",
      () => initPublicWhenReady(),
      { once: true }
    );
  });
});

// ====== EXPORTS ======
window.copyText = copyText;
window.openShare = openShare;
window.copyShare = copyShare;
window.submitRegistration = submitRegistration;
