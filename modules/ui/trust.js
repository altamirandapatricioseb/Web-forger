const { esc } = require('../../src/templates');

// Barra de garantías: badges de confianza típicos de un sitio comercial.
// Sección estática (sin JS): iconos SVG inline + título + bajada corta.
module.exports = {
  id: 'trust', type: 'ui', name: 'Garantías de confianza',
  description: 'Barra de garantías (envío gratis, pago seguro, cambios y devoluciones, atención personalizada) con iconos. Estática, sin JS.',
  html: (cfg) => {
    // Cada badge: icono SVG (stroke = color de acento), título y detalle editable
    const items = [
      { t: 'Envío gratis', d: 'En compras superiores a $50.000',
        svg: '<path d="M3 13h13V6H3zM16 8h4l3 3v2h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>' },
      { t: 'Pago seguro', d: 'Tus datos siempre protegidos',
        svg: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>' },
      { t: 'Cambios y devoluciones', d: 'Hasta 30 días para cambiar de idea',
        svg: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>' },
      { t: 'Atención personalizada', d: 'Te acompañamos antes y después',
        svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
    ];
    const badges = items.map(it => `<div class="trust-item" style="display:flex;align-items:center;gap:12px">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:0 0 auto">${it.svg}</svg>
          <div>
            <strong style="display:block;font-size:.95rem">${esc(it.t)}</strong>
            <span class="muted" style="font-size:.82rem">${esc(it.d)}</span>
          </div>
        </div>`).join('\n        ');
    return `  <section id="garantias" style="padding:36px 0">
    <div class="container">
      <div id="garantias-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:22px;align-items:center">
        ${badges}
      </div>
    </div>
  </section>`;
  },
  readmeNotes: () => [
    '**Garantías de confianza**: los textos de los badges (envío gratis, devoluciones, etc.) son placeholders; editalos en el módulo `garantias` de la Home (`public/index.html`) para que reflejen tus condiciones reales.',
  ],
};
