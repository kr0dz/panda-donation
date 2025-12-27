async function loadHTML(selector, url) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`No existe el mount: ${selector}`);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No pude cargar ${url} (${res.status})`);

  el.innerHTML = await res.text();
}

async function bootPartials() {
  // Header
  await loadHTML("#mount-header", "./headers.html");

  // Secciones
  await loadHTML("#mount-hero", "./sections/hero.html");
  await loadHTML("#mount-premios", "./sections/premios.html");
  await loadHTML("#mount-reglas", "./sections/reglas.html");
  await loadHTML("#mount-top", "./sections/top.html");
  await loadHTML("#mount-validadas", "./sections/validadas.html");
  await loadHTML("#mount-share", "./sections/share.html");

  // Footer + Modal
  await loadHTML("#mount-footer", "./sections/footer.html");
  await loadHTML("#mount-modal", "./sections/modal-registro.html");

  // Aviso a script.js: ya existe todo el DOM inyectado
  window.__PARTIALS_READY__ = true;
  document.dispatchEvent(new Event("partials:ready"));
}

bootPartials().catch((err) => {
  console.error(err);
  alert("Error cargando secciones. Revisa rutas/servidor. (No abre bien con file://)");
});
