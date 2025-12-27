// /js/partials.js
// Carga secciones HTML en "mount points" sin romper si falta algo.

const PARTIALS = [
  { mount: "#mount-header",  url: "headers.html" },

  { mount: "#mount-hero",    url: "sections/hero.html" },
  { mount: "#mount-premios", url: "sections/premios.html" },
  { mount: "#mount-reglas",  url: "sections/reglas.html" },

  { mount: "#mount-top",     url: "sections/top.html" },
  { mount: "#mount-share",   url: "sections/share.html" },

  { mount: "#mount-footer",  url: "sections/footer.html" },

  // modal fuera del flujo
  { mount: "#mount-modal",   url: "sections/modal-registro.html" },
];

async function loadHTML(relativeUrl) {
  const absoluteUrl = new URL(relativeUrl, location.href).toString();
  const res = await fetch(absoluteUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${relativeUrl} (${res.status})`);
  return await res.text();
}

async function bootPartials() {
  const errors = [];

  const tasks = PARTIALS.map(async (p) => {
    const el = document.querySelector(p.mount);
    if (!el) return;

    try {
      el.innerHTML = await loadHTML(p.url);
    } catch (e) {
      console.error("[partials]", p.url, e);
      errors.push(`${p.url}: ${e.message}`);
      // fallback visual mínimo (no bloquea)
      el.innerHTML = "";
    }
  });

  await Promise.all(tasks);

  // ✅ IMPORTANTÍSIMO: dispara cuando todo terminó
  document.dispatchEvent(new CustomEvent("partials:loaded", { detail: { errors } }));

  // si quieres ver errores sin alert
  if (errors.length) {
    console.warn("[partials] errores:", errors);
  }
}

window.bootPartials = bootPartials;
document.addEventListener("DOMContentLoaded", bootPartials);
