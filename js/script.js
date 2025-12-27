/* =========================
   PUBLIC SCRIPT (index.html)
   ========================= */

// ====== CONFIG ======
const GOAL_MXN = 500000;
const TICKET_PRICE = 500;

const CONTACT_WA = "+52 415 215 7587";
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
    box-shadow: 0 14px 40px rgba(0,0,0,.25);
  `;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transition = "opacity .25s ease";
  }, 1200);
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

  // ✅ WhatsApp: abre chat correctamente (mejor compatibilidad)
  if (exists("btnWA")) {
    const waText = "text=" + msg;
    $("btnWA").href = "https://api.whatsapp.com/send/?" + waText;
    $("btnWA").setAttribute("target", "_blank");
    $("btnWA").setAttribute("rel", "noopener");
  }

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
    s.src = url + sep + "callback=" + encodeURIComponent(cb);
    s.onerror = () => {
      cleanup();
      reject(new Error("script error"));
    };

    document.body.appendChild(s);
  });
}

// ====== DATA NORMALIZATION ======
function normalizeValidatedRow(row) {
  const amount = Number(row.amount ?? row.monto ?? row.monto_mxn ?? 0) || 0;
  let tickets = Number(row.tickets ?? row.boletos ?? 0) || 0;
  if (!tickets && amount >= TICKET_PRICE) tickets = Math.floor(amount / TICKET_PRICE);

  return {
    name: (row.name ?? row.nombre ?? "—").toString(),
    amount,
    tickets,
    date: row.date ?? row.fecha ?? "",
  };
}

// ====== HERO (KPIs + progress) ======
function renderKPIsAndProgress() {
  if (
    !exists("goalLabel") ||
    !exists("raisedLabel") ||
    !exists("ticketsLabel") ||
    !exists("pctLabel") ||
    !exists("progressBar")
  ) {
    return;
  }

  const totalAmount = validated.reduce((acc, x) => acc + (Number(x.amount) || 0), 0);
  const totalTickets = validated.reduce((acc, x) => acc + (Number(x.tickets) || 0), 0);

  $("goalLabel").textContent = mxn(GOAL_MXN);
  $("raisedLabel").textContent = mxn(totalAmount);
  $("ticketsLabel").textContent = totalTickets.toLocaleString("es-MX");

  const pct = GOAL_MXN > 0 ? (totalAmount / GOAL_MXN) * 100 : 0;
  const pctClamped = clamp(pct, 0, 100);
  $("pctLabel").textContent = Math.floor(pctClamped) + "%";
  $("progressBar").style.width = pctClamped.toFixed(1) + "%";
}

// ====== TOP DONADORES ======
function computeTopFromValidated() {
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

function renderTopTable(list) {
  if (!exists("tbodyTop")) return;
  const tbody = $("tbodyTop");
  tbody.innerHTML = "";

  if (!Array.isArray(list) || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Aún no hay donadores.</td></tr>`;
    return;
  }

  list.forEach((x, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${i + 1}</b></td>
      <td>${escapeHtml(x.name || "—")}</td>
      <td><b>${mxn(Number(x.amount) || 0)}</b></td>
      <td>${Number(x.tickets || 0).toLocaleString("es-MX")}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadValidated() {
  try {
    const res = await jsonp(APPS_SCRIPT_WEBAPP + "?action=validated");
    if (!res || !res.ok) throw new Error(res?.error || "No ok");

    const items = Array.isArray(res.items) ? res.items : [];
    validated = items.map(normalizeValidatedRow);
  } catch (e) {
    validated = [];
  }

  renderKPIsAndProgress();
}

async function loadRanking() {
  // ✅ quita “Cargando…” inmediatamente
  renderTopTable([]);

  try {
    const res = await jsonp(APPS_SCRIPT_WEBAPP + "?action=ranking");
    if (!res || !res.ok) throw new Error(res?.error || "No ok");

    const topRaw = Array.isArray(res.top) ? res.top : [];
    const top = topRaw
      .map((r) => ({
        name: r.name ?? r.nombre ?? "—",
        amount: Number(r.amount ?? r.monto ?? 0) || 0,
        tickets: Number(r.tickets ?? r.boletos ?? 0) || 0,
      }))
      .filter((x) => x.amount > 0 || x.tickets > 0)
      .slice(0, 10);

    renderTopTable(top);
  } catch (e) {
    // fallback desde validated
    renderTopTable(computeTopFromValidated());
  }
}

// ====== REGISTRO ======
function makeDedupeKey() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "k_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}

async function submitRegistration() {
  if (__submitting) return;
  __submitting = true;

  if (!exists("fName") || !exists("fAmount") || !exists("fOk") || !exists("btnSend")) {
    __submitting = false;
    return alert("El formulario aún no está listo. Recarga la página.");
  }

  const name = $("fName").value.trim();
  const whatsapp = exists("fWhatsapp") ? $("fWhatsapp").value.trim() : "";
  const email = exists("fEmail") ? $("fEmail").value.trim() : "";
  const amountRaw = $("fAmount").value.trim();
  const note = exists("fNote") ? $("fNote").value.trim() : "";
  const ok = $("fOk").checked;

  if (!name || !amountRaw) { __submitting = false; return alert("Completa nombre y monto."); }
  if (!ok) { __submitting = false; return alert("Confirma que enviarás evidencia por WhatsApp o correo."); }

  const amount = Number(String(amountRaw).replace(/[^\d.]/g, "")) || 0;
  if (amount < TICKET_PRICE) { __submitting = false; return alert("El monto mínimo para 1 boleto es $500 MXN."); }

  const btn = $("btnSend");
  btn.disabled = true;
  btn.textContent = "Registrando...";

  const dedupeKey = makeDedupeKey();

  const qs =
    "name=" + encodeURIComponent(name) +
    "&whatsapp=" + encodeURIComponent(whatsapp) +
    "&email=" + encodeURIComponent(email) +
    "&amount=" + encodeURIComponent(String(amount)) +
    "&note=" + encodeURIComponent(note) +
    "&dedupe_key=" + encodeURIComponent(dedupeKey);

  const url = APPS_SCRIPT_WEBAPP + "?" + qs;

  try {
    const res = await jsonp(url);
    if (!res || !res.ok) throw new Error(res?.error || "No se pudo registrar");

    const boletos = Number(res.boletos || 0);
    const folio = String(res.folio || "");

    const msg =
      `✅ Registro recibido
Folio: ${folio}
Boletos: ${boletos}

Ahora envía tu comprobante para validar:
WhatsApp: ${CONTACT_WA}
Correo: ${CONTACT_EMAIL}

Incluye tu folio en el mensaje.`;

    if (exists("regResult")) {
      const box = $("regResult");
      box.style.display = "block";
      box.className = "soft p-3";

      const safeMsg = msg.replace(/'/g, "\\'");
      box.innerHTML = `
        <div style="font-weight:900; font-size:1.05rem;">Registro recibido ✅</div>
        <div class="muted small mt-1">Folio: <span class="mono"><b>${escapeHtml(folio)}</b></span></div>
        <div class="muted small">Boletos: <b>${boletos}</b></div>
        <div class="divider"></div>
        <div class="small" style="line-height:1.7">
          Envía tu comprobante para validar:<br>
          WhatsApp: <b>${escapeHtml(CONTACT_WA)}</b><br>
          Correo: <b>${escapeHtml(CONTACT_EMAIL)}</b><br>
          <span class="muted small">Incluye tu folio en el mensaje.</span>
        </div>
        <div class="mt-3 d-flex gap-2 flex-wrap">
          <button class="btn btn-outline-primary btn-sm" onclick="copyText('${safeMsg}')">Copiar mensaje</button>
        </div>
      `;
    }

    toast("Registro guardado ✅");

    // refresca datos públicos
    await loadValidated();
    await loadRanking();
  } catch (err) {
    alert("No se pudo enviar el registro. Intenta de nuevo. Si persiste, manda tus datos por WhatsApp/correo junto con tu comprobante.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Registrar";
    __submitting = false;
  }
}

// ====== PRIZE CAROUSELS (contador 1/N + debug rotas) ======
function initPrizeCarousels() {
  const cars = document.querySelectorAll(".prizeCarousel");
  if (!cars.length) return false;

  cars.forEach((car) => {
    const items = Array.from(car.querySelectorAll(".carousel-item"));
    const totalEl = car.querySelector(".prizeCounter .total");
    const currentEl = car.querySelector(".prizeCounter .current");

    if (!items.length) return;

    if (totalEl) totalEl.textContent = String(items.length);

    const update = () => {
      const idx = items.findIndex((x) => x.classList.contains("active"));
      if (currentEl) currentEl.textContent = String((idx >= 0 ? idx : 0) + 1);
    };

    update();
    car.addEventListener("slid.bs.carousel", update);

    // debug imágenes rotas
    car.querySelectorAll("img").forEach((img) => {
      img.addEventListener("error", () => {
        console.warn("[img error]", img.getAttribute("src"));
      }, { once: true });
    });
  });

  return true;
}

// ====== INIT ======
async function initPublicWhenReady() {
  const required = ["year", "shareLink", "tbodyTop", "goalLabel", "raisedLabel", "ticketsLabel", "pctLabel", "progressBar"];
  if (!required.every(exists)) return false;

  $("year").textContent = new Date().getFullYear();

  // inyecta contacto en hero/modal si existen
  if (exists("waLabel")) $("waLabel").textContent = CONTACT_WA;
  if (exists("emailLabel")) $("emailLabel").textContent = CONTACT_EMAIL;
  if (exists("waInline")) $("waInline").textContent = CONTACT_WA;
  if (exists("emailInline")) $("emailInline").textContent = CONTACT_EMAIL;

  initShare();

  await loadValidated();
  await loadRanking();

  // init carousels si ya están
  initPrizeCarousels();

  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  initPublicWhenReady().then((ok) => {
    if (ok) return;

    document.addEventListener("partials:loaded", () => {
      initPublicWhenReady();
      initPrizeCarousels();
    }, { once: true });

    // fallback poll suave (por si el evento no dispara)
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const ok2 = await initPublicWhenReady();
      if (ok2) initPrizeCarousels();
      if (ok2 || tries > 40) clearInterval(t); // ~4s
    }, 100);
  });
});

// ====== EXPORTS ======
window.copyText = copyText;
window.openShare = openShare;
window.copyShare = copyShare;
window.submitRegistration = submitRegistration;
