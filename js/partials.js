// /js/partials.js
// Carga secciones HTML en "mount points" sin romper si falta algo.

const PARTIALS = [
  { mount: "#mount-headers", url: "./headers.html" },

  { mount: "#mount-hero",    url: "./sections/hero.html" },
  { mount: "#mount-premios", url: "./sections/premios.html" },
  { mount: "#mount-reglas",  url: "./sections/reglas.html" },

  // SOLO TOP
  { mount: "#mount-top",     url: "./sections/top.html" },

  { mount: "#mount-share",   url: "./sections/share.html" },
  { mount: "#mount-modal",   url: "./sections/modal-registro.html" },
  { mount: "#mount-footer",  url: "./sections/footer.html" },
];

async function loadHTML(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return await res.text();
}

async function bootPartials() {
  const errors = [];

  for (const p of PARTIALS) {
    const el = document.querySelector(p.mount);

    if (!el) continue;

    try {
      el.innerHTML = await loadHTML(p.url);
    } catch (e) {
      console.error("[partials]", e);
      errors.push(e.message);
    }
  }

  document.dispatchEvent(new CustomEvent("partials:loaded"));

  if (errors.length) {
    alert("Error cargando secciones:\n" + errors.join("\n"));
  }
}

window.bootPartials = bootPartials;

document.addEventListener("DOMContentLoaded", bootPartials);
