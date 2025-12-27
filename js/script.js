 // ====== CONFIG ======
    const GOAL_MXN = 500000;
    const TICKET_PRICE = 500;

    const CONTACT_WA = "+52 1 415 215 7587";
    const CONTACT_EMAIL = "hbcasamorena@gmail.com";

    // ✅ Tu WebApp
    const APPS_SCRIPT_WEBAPP = "https://script.google.com/macros/s/AKfycbzdvpnb3-JtRcVoK4Z2BdDNnfafj-i2RaqIdmkMPky8qpgbo22kdGRGpplMqeSaGkWG/exec";

    // URL del sitio (si se deja vacío, se usa la actual)
    const SITE_URL = "";

    // ====== STATE ======
    let validated = [];
    let __submitting = false;

    // ====== HELPERS ======
    const mxn = (n) => Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
    const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[m]));
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    function toast(msg) {
      const t = document.createElement("div");
      t.textContent = msg;
      t.style.cssText = `
        position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
        background: rgba(11,18,32,.92); color: #fff; padding: 10px 12px;
        border-radius: 999px; z-index: 9999; font-size: 14px; box-shadow: 0 14px 40px rgba(0,0,0,.25);
      `;
      document.body.appendChild(t);
      setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .25s ease"; }, 1200);
      setTimeout(() => t.remove(), 1500);
    }

    function copyText(txt) {
      navigator.clipboard.writeText(txt)
        .then(() => toast("Copiado ✅"))
        .catch(() => alert("No se pudo copiar. Copia manualmente."));
    }

    function openShare() {
      location.hash = "#share";
      document.getElementById("shareLink").focus();
    }
    function copyShare() { copyText(document.getElementById("shareLink").value); }

    function normalizeValidatedRow(row) {
      const amount = Number(row.amount ?? row.monto ?? row.monto_mxn ?? 0) || 0;
      let tickets = Number(row.tickets ?? row.boletos ?? 0) || 0;
      if (!tickets && amount >= TICKET_PRICE) tickets = Math.floor(amount / TICKET_PRICE);

      return {
        id: row.id ?? row.folio ?? "-",
        name: row.name ?? row.nombre ?? "-",
        amount,
        tickets,
        date: row.date ?? row.fecha ?? "",
        status: row.status ?? row.estado ?? "Validado"
      };
    }

    // --- JSONP ---
    function jsonp(url) {
      return new Promise((resolve, reject) => {
        const cb = "cb_" + Math.random().toString(36).slice(2);
        const s = document.createElement("script");
        const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 15000);

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

    // ====== RENDER ======
    function renderKPIsAndProgress() {
      const totalAmount = validated.reduce((acc, x) => acc + (Number(x.amount) || 0), 0);
      const totalTickets = validated.reduce((acc, x) => acc + (Number(x.tickets) || 0), 0);

      document.getElementById("goalLabel").textContent = mxn(GOAL_MXN);
      document.getElementById("raisedLabel").textContent = mxn(totalAmount);
      document.getElementById("ticketsLabel").textContent = totalTickets.toLocaleString("es-MX");

      const pct = GOAL_MXN > 0 ? (totalAmount / GOAL_MXN) * 100 : 0;
      const pctClamped = clamp(pct, 0, 100);
      document.getElementById("pctLabel").textContent = Math.floor(pctClamped) + "%";
      document.getElementById("progressBar").style.width = pctClamped.toFixed(1) + "%";
    }

    function renderValidatedTable() {
      const tbody = document.getElementById("tbodyValidadas");
      tbody.innerHTML = "";

      if (!validated.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="muted">Aún no hay donaciones validadas.</td></tr>`;
        return;
      }

      validated
        .slice()
        .sort((a, b) => (String(b.date || "")).localeCompare(String(a.date || "")))
        .forEach((r) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td class="mono"><b>${escapeHtml(r.id)}</b></td>
            <td>${escapeHtml(r.name)}</td>
            <td><b>${mxn(r.amount)}</b></td>
            <td>${Number(r.tickets || 0).toLocaleString("es-MX")}</td>
            <td class="muted small">${escapeHtml(r.date || "")}</td>
            <td class="text-end"><span class="badge text-bg-success">${escapeHtml(r.status || "Validado")}</span></td>
          `;
          tbody.appendChild(tr);
        });
    }

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
      const tbody = document.getElementById("tbodyTop");
      tbody.innerHTML = "";

      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="muted">Aún no hay donaciones validadas.</td></tr>`;
        return;
      }

      list.forEach((x, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><b>${i + 1}</b></td>
          <td>${escapeHtml(x.name || "-")}</td>
          <td><b>${mxn(Number(x.amount) || 0)}</b></td>
          <td>${Number(x.tickets || 0).toLocaleString("es-MX")}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    function renderAll() {
      renderKPIsAndProgress();
      renderValidatedTable();
    }

    // ====== DATA LOAD ======
    async function loadValidated() {
      try {
        const res = await jsonp(APPS_SCRIPT_WEBAPP + "?action=validated");
        if (!res || !res.ok) throw new Error(res?.error || "No ok");

        validated = Array.isArray(res.items) ? res.items.map(normalizeValidatedRow) : [];
      } catch (e) {
        validated = [];
      }

      renderAll();
    }

    async function loadRanking() {
      // 1) intenta backend action=ranking
      try {
        const res = await jsonp(APPS_SCRIPT_WEBAPP + "?action=ranking");
        if (!res || !res.ok) throw new Error(res?.error || "No ok");
        const top = Array.isArray(res.top) ? res.top.slice(0, 10) : [];
        renderTopTable(top);
        return;
      } catch (e) {
        // 2) fallback: calcula del validated
        renderTopTable(computeTopFromValidated());
      }
    }

    // ====== PUBLIC REGISTRATION ======
    function makeDedupeKey() {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
      return "k_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    }

    async function submitRegistration() {
      if (__submitting) return;
      __submitting = true;

      const name = document.getElementById("fName").value.trim();
      const whatsapp = document.getElementById("fWhatsapp").value.trim();
      const email = document.getElementById("fEmail").value.trim();
      const amountRaw = document.getElementById("fAmount").value.trim();
      const note = document.getElementById("fNote").value.trim();
      const ok = document.getElementById("fOk").checked;

      if (!name || !amountRaw) { __submitting = false; return alert("Completa nombre y monto."); }
      if (!ok) { __submitting = false; return alert("Confirma que enviarás evidencia por WhatsApp o correo."); }

      const amount = Number(String(amountRaw).replace(/[^\d.]/g, "")) || 0;
      if (amount < TICKET_PRICE) { __submitting = false; return alert("El monto mínimo para 1 boleto es $500 MXN."); }

      const btn = document.getElementById("btnSend");
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

        const box = document.getElementById("regResult");
        box.style.display = "block";
        box.className = "soft p-3";
        box.innerHTML = `
          <div style="font-weight:900; font-size:1.05rem;">Registro recibido ✅</div>
          <div class="muted small mt-1">Folio: <span class="mono"><b>${escapeHtml(folio)}</b></span></div>
          <div class="muted small">Boletos: <b>${boletos}</b></div>
          <div class="divider"></div>
          <div class="small" style="line-height:1.7">
            Envía tu comprobante para validar y participar en la lista pública:<br>
            WhatsApp: <b>${escapeHtml(CONTACT_WA)}</b><br>
            Correo: <b>${escapeHtml(CONTACT_EMAIL)}</b><br>
            <span class="muted small">Incluye tu folio en el mensaje.</span>
          </div>
          <div class="mt-3 d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-primary btn-sm" onclick="copyText('${escapeHtml(msg).replace(/'/g,"&#039;")}')">Copiar mensaje</button>
          </div>
        `;

        toast("Registro guardado en Google Sheets ✅");

        // (Opcional) recargar datos públicos después de registrar
        // NO aumenta hasta que validas, pero al menos refresca tablas si tú ya validaste algo.
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

    // ====== SHARE INIT ======
    function initShare() {
      const base = SITE_URL || (location.origin + location.pathname);
      document.getElementById("shareLink").value = base;

      const msg = encodeURIComponent("Rifa solidaria — Apoyemos a Panda. 1 boleto=$500. Premios: estancias en hoteles. Participa aquí: " + base);
      document.getElementById("btnWA").href = "https://wa.me/?text=" + msg;
      document.getElementById("btnFB").href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(base);
      document.getElementById("btnX").href = "https://twitter.com/intent/tweet?text=" + msg;
    }

    // ====== INIT ======
    document.addEventListener("DOMContentLoaded", async () => {
      document.getElementById("year").textContent = new Date().getFullYear();
      initShare();

      // carga pública
      await loadValidated();
      await loadRanking();
    });