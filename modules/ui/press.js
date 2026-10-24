const { esc } = require('../../src/templates');

// Franja de prensa y certificaciones ("Como se vio en…" + sellos de confianza).
// Distinta de "logos" (clientes que confían): acá van medios que te mencionaron y
// certificaciones/sellos. Estática, sin JS. Los medios son wordmarks tipográficos y
// las certificaciones sellos con ícono SVG inline, todo reemplazable por <img> reales.
module.exports = {
  id: 'press', type: 'ui', name: 'Prensa y certificaciones',
  description: 'Franja "Como se vio en" con medios que te mencionaron más sellos de certificación/confianza. Estática, sin JS.',
  html: (cfg) => {
    // Medios donde apareció la marca (placeholders): reemplazá por <img> del logo real.
    const medios = ['El Diario', 'Revista Pyme', 'Radio Ciudad', 'Portal Negocios', 'TV Región'];
    // Certificaciones/sellos: cada uno con un ícono SVG y una etiqueta.
    const sellos = [
      { i: 'shield', t: 'Sitio seguro SSL' },
      { i: 'check', t: 'Empresa verificada' },
      { i: 'leaf', t: 'Compromiso sustentable' },
      { i: 'star', t: 'Calidad certificada' },
    ];
    const icono = (id) => ({
      shield: '<path d="M12 2l8 3v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V5l8-3z"/><path d="M9 12l2 2 4-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
      check: '<circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
      leaf: '<path d="M4 20c0-8 6-14 16-14 0 10-6 16-16 14z"/><path d="M8 16c3-4 6-6 9-7" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
      star: '<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/>',
    }[id] || '');
    const mediosHtml = medios.map(m => `<span class="press-media">${esc(m)}</span>`).join('\n        ');
    const sellosHtml = sellos.map(s => `<div class="press-cert">
          <span class="press-cert-ico" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">${icono(s.i)}</svg></span>
          <span>${esc(s.t)}</span>
        </div>`).join('\n        ');
    return `  <section id="prensa" style="background:var(--surface)">
    <div class="container">
      <p class="press-kicker">Como se vio en</p>
      <div class="press-medios">
        ${mediosHtml}
      </div>
      <div class="press-certs">
        ${sellosHtml}
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    #prensa .press-kicker{text-align:center;text-transform:uppercase;letter-spacing:.12em;font-size:.78rem;font-weight:700;color:var(--muted);margin:0 0 20px}
    #prensa .press-medios{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:28px 40px}
    #prensa .press-media{font-weight:800;font-size:1.15rem;letter-spacing:-.01em;color:var(--muted);opacity:.7;filter:grayscale(1);transition:opacity .2s,filter .2s}
    #prensa .press-media:hover{opacity:1;filter:grayscale(0);color:var(--text)}
    #prensa .press-certs{display:flex;flex-wrap:wrap;justify-content:center;gap:14px 22px;margin-top:28px;padding-top:24px;border-top:1px solid var(--line)}
    #prensa .press-cert{display:inline-flex;align-items:center;gap:9px;font-size:.9rem;font-weight:600;color:var(--text)}
    #prensa .press-cert-ico{display:inline-flex;color:var(--accent)}
  </style>`,
  readmeNotes: () => [
    '**Prensa y certificaciones**: los medios ("El Diario", "Revista Pyme"…) y sellos son placeholders; editalos en la sección `#prensa` de `public/index.html`. Para logos reales de medios, reemplazá cada `<span class="press-media">` por un `<img>`.',
  ],
};
