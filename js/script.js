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
    // alias para código admin que usa `esc`
    const esc = escapeHtml;

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
   // ==== END SCRIPT ====== 

    // === STORAGE KEYS ===
    const LS_TOKEN = "ADMIN_TOKEN";
    const LS_WEBAPP = "WEBAPP_BASE";

    // === DEFAULT WEBAPP BASE (sin params) ===
    const DEFAULT_WEBAPP_BASE = "https://script.google.com/macros/s/AKfycbzdvpnb3-JtRcVoK4Z2BdDNnfafj-i2RaqIdmkMPky8qpgbo22kdGRGpplMqeSaGkWG/exec";

    // === CONFIG ===
    // `TICKET_PRICE` y `validated` vienen de la sección pública superior
    window.__raffleResult = null;

    // Helpers compartidos (toast, copyText, esc, jsonp, etc.) están definidos en la sección pública.

    function getToken(){ return localStorage.getItem(LS_TOKEN) || ""; }

    function getWebappBase(){
      const v = (document.getElementById("webapp").value.trim() || localStorage.getItem(LS_WEBAPP) || DEFAULT_WEBAPP_BASE).trim();
      if(!v) throw new Error("Configura la URL BASE del Web App.");
      if(v.includes("?")) throw new Error("Pega la URL BASE sin parámetros (sin ?action=...).");
      return v;
    }

    function saveWebapp(){
      try{
        const v = document.getElementById("webapp").value.trim();
        if(!v) return alert("Pega la URL base /exec.");
        if(v.includes("?")) return alert("Pega la URL BASE sin parámetros.");
        localStorage.setItem(LS_WEBAPP, v);
        toast("URL guardada ✅");
      }catch(e){
        alert(e.message);
      }
    }

    function saveToken(){
      const t = document.getElementById("token").value.trim();
      if(!t) return alert("Pega tu ADMIN_TOKEN.");
      localStorage.setItem(LS_TOKEN, t);
      toast("Token guardado ✅");
      setUIAccess();
      refreshAll();
    }

    function logout(){
      localStorage.removeItem(LS_TOKEN);
      window.__raffleResult = null;
      location.reload();
    }

    function setUIAccess(){
      const token = getToken();
      const adminUI = document.getElementById("adminUI");
      adminUI.classList.toggle("hidden", !token);
      // si quieres: ocultar tarjeta token cuando ya hay token:
      // document.getElementById("cardToken").classList.toggle("hidden", !!token);
    }

    // Usar `jsonp` definido en la sección pública.

    function buildUrl(params){
      const base = getWebappBase();
      const u = new URL(base);
      Object.entries(params).forEach(([k,v])=>{
        if(v !== undefined && v !== null && String(v).length) u.searchParams.set(k, String(v));
      });
      return u.toString();
    }

    // `normalizeValidatedRow` viene de la sección pública.

    // === PENDING ===
    async function loadPending(){
      const token = getToken();
      if(!token) return;

      try{
        const url = buildUrl({ action:"pending", key: token });
        const data = await jsonp(url);
        if(!data || !data.ok) throw new Error(data?.error || "No se pudo cargar pendientes");

        const items = Array.isArray(data.items) ? data.items : (data.rows || []);
        renderPending(items);
      }catch(e){
        alert("Pendientes: " + e.message);
      }
    }

    function renderPending(rows){
      const tb = document.getElementById("pendingBody");
      tb.innerHTML = "";

      if(!rows.length){
        tb.innerHTML = `<tr><td colspan="6" class="text-secondary">No hay pendientes.</td></tr>`;
        return;
      }

      rows.forEach(r=>{
        const folio = r.folio || r.id || "-";
        const nombre = r.nombre || r.name || "-";
        const monto = Number(r.monto_mxn ?? r.amount ?? 0) || 0;
        let boletos = Number(r.boletos ?? r.tickets ?? 0) || 0;
        if(!boletos && monto >= TICKET_PRICE) boletos = Math.floor(monto / TICKET_PRICE);
        const ts = r.timestamp || r.date || r.fecha || "";

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="mono"><b>${esc(folio)}</b></td>
          <td>${esc(nombre)}</td>
          <td><b>${mxn(monto)}</b></td>
          <td>${Number(boletos||0)}</td>
          <td class="text-secondary small">${esc(ts)}</td>
          <td class="text-end">
            <button class="btn btn-success btn-sm"
              onclick="validateFolio('${esc(folio).replace(/'/g,"&#039;")}', '${esc(nombre).replace(/'/g,"&#039;")}')">
              Validar
            </button>
          </td>
        `;
        tb.appendChild(tr);
      });
    }

    function abbreviate(full){
      const p = String(full||"").trim().split(/\s+/).filter(Boolean);
      if(p.length <= 1) return full || "";
      return `${p[0]} ${p[1][0].toUpperCase()}.`;
    }

    async function validateFolio(folio, fullName){
      const token = getToken();
      if(!token) return alert("Sin token.");

      const publicName = prompt("Nombre público (ej. “Luis G.”).", abbreviate(fullName));
      if(!publicName) return;

      try{
        const url = buildUrl({
          action:"validate",
          key: token,
          folio: folio,
          publicName: publicName.trim()
        });

        const data = await jsonp(url);
        if(!data || !data.ok) throw new Error(data?.error || "No se pudo validar");

        toast("Validado ✅");
        await refreshAll();
      }catch(e){
        alert("Validar: " + e.message);
      }
    }

    // === VALIDATED ===
    async function loadValidated(){
      try{
        const url = buildUrl({ action:"validated" });
        const data = await jsonp(url);
        if(!data || !data.ok) throw new Error(data?.error || "No se pudo cargar validadas");
        validated = Array.isArray(data.items) ? data.items.map(normalizeValidatedRow) : [];
      }catch(e){
        validated = [];
        // no alert agresivo aquí: solo afecta sorteo/ranking
        console.warn(e);
      }finally{
        renderSorteoStats();
      }
    }

    // === RANKING ===
    function computeTopFromValidated(){
      const map = new Map();
      for(const row of validated){
        const name = (row.name || "").trim() || "Anónimo";
        const prev = map.get(name) || { name, amount: 0, tickets: 0 };
        prev.amount += Number(row.amount) || 0;
        prev.tickets += Number(row.tickets) || 0;
        map.set(name, prev);
      }
      return Array.from(map.values())
        .sort((a,b)=> (b.amount - a.amount) || (b.tickets - a.tickets) || a.name.localeCompare(b.name))
        .slice(0,10);
    }

    async function loadRanking(){
      try{
        const url = buildUrl({ action:"ranking" });
        const data = await jsonp(url);
        if(!data || !data.ok) throw new Error(data?.error || "No se pudo cargar ranking");
        renderRanking(Array.isArray(data.top) ? data.top : []);
      }catch(e){
        // fallback a cálculo local
        if(!validated.length) await loadValidated();
        renderRanking(computeTopFromValidated());
      }
    }

    function renderRanking(list){
      if(!list.length){
        document.getElementById("ranking").innerHTML = `<div class="text-secondary">Aún no hay donaciones validadas.</div>`;
        return;
      }
      const html = `
        <ol class="mb-0">
          ${list.map(x=>`
            <li class="mb-2">
              <div style="font-weight:800;">${esc(x.name || x.nombre || "—")}</div>
              <div class="text-secondary small">
                Total: <b>${mxn(Number(x.amount ?? x.monto ?? 0) || 0)}</b> ·
                Boletos: <b>${Number(x.tickets ?? x.boletos ?? 0) || 0}</b>
              </div>
            </li>
          `).join("")}
        </ol>
      `;
      document.getElementById("ranking").innerHTML = html;
    }

    // === SORTEO ===
    function renderSorteoStats(){
      const participants = validated.length;
      const ticketsTotal = validated.reduce((a,x)=>a + (Number(x.tickets)||0), 0);
      document.getElementById("participantsCount").textContent = participants.toLocaleString("es-MX");
      document.getElementById("ticketsTotal").textContent = ticketsTotal.toLocaleString("es-MX");
    }

    function cryptoRandomInt(min, max){
      const range = max - min + 1;
      const maxRange = 0xFFFFFFFF;
      const bucket = Math.floor(maxRange / range) * range;
      let x;
      do{
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        x = arr[0];
      }while(x >= bucket);
      return min + (x % range);
    }

    function simpleHash(str){
      let h1 = 0xdeadbeef ^ str.length;
      let h2 = 0x41c6ce57 ^ str.length;
      for(let i=0, ch; i<str.length; i++){
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = (h1 ^ (h1 >>> 16)) >>> 0;
      h2 = (h2 ^ (h2 >>> 16)) >>> 0;
      return ("RAFFLE-" + (h1.toString(16).padStart(8,"0") + h2.toString(16).padStart(8,"0")).toUpperCase());
    }

    async function drawWinner(){
      if(!validated.length){
        await loadValidated();
      }
      if(!validated.length) return alert("No hay donaciones validadas.");

      const pool = [];
      validated.forEach(p=>{
        const t = Number(p.tickets) || 0;
        for(let i=0;i<t;i++) pool.push(p);
      });
      if(!pool.length) return alert("No hay boletos asignados (tickets=0).");

      const idx = cryptoRandomInt(0, pool.length - 1);
      const w = pool[idx];

      const when = new Date().toISOString();
      const seed = `${when}|${w.id}|${pool.length}|${idx}`;
      const hash = simpleHash(seed);

      document.getElementById("winnerBox").innerHTML = `
        <div class="d-flex justify-content-between flex-wrap gap-2">
          <div>
            <div class="text-secondary small">Ganador</div>
            <div class="h5 mb-1" style="font-weight:800;">
              ${esc(w.name)} <span class="badge text-bg-primary ms-1">${esc(w.id)}</span>
            </div>
            <div class="text-secondary small mb-0">
              Boletos: <b>${Number(w.tickets)||0}</b> · Donación: <b>${mxn(Number(w.amount)||0)}</b>
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

      window.__raffleResult = { winner: w, when, hash, poolSize: pool.length, index: idx };
      toast("Sorteo realizado ✅");
    }

    function resetResult(){
      document.getElementById("winnerBox").innerHTML =
        `<div class="text-secondary small mb-1">Resultado</div><div class="text-secondary mb-0">Aún no se ha realizado el sorteo.</div>`;
      window.__raffleResult = null;
    }

    function copyResult(){
      const r = window.__raffleResult;
      if(!r) return alert("Primero realiza el sorteo.");
      const text =
`Resultado sorteo — Rifa Panda
Ganador: ${r.winner.name} (${r.winner.id})
Donación: ${r.winner.amount} MXN
Boletos: ${r.winner.tickets}
Fecha/Hora: ${r.when}
Pool: ${r.poolSize} (index ${r.index})
Huella: ${r.hash}`;
      copyText(text);
    }

    // === REFRESH ALL ===
    async function refreshAll(){
      await loadPending();
      await loadValidated();
      await loadRanking();
    }

    // === INIT ===
    document.addEventListener("DOMContentLoaded", ()=>{
      // Webapp base: cargar de storage o default
      const savedBase = localStorage.getItem(LS_WEBAPP) || DEFAULT_WEBAPP_BASE;
      document.getElementById("webapp").value = savedBase;

      // token: cargar de storage
      document.getElementById("token").value = getToken();

      setUIAccess();
      if(getToken()){
        refreshAll();
      }
    });