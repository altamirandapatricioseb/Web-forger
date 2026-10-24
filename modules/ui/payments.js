const { esc } = require('../../src/templates');

// Banda de "medios de pago aceptados": íconos SVG inline de tarjetas y billeteras.
// Sección estática (sin JS), típica del checkout/footer de cualquier e-commerce.
// Todos los logos son SVG propios (formas simples), no imágenes externas ni marcas
// registradas exactas: sirven de placeholder reconocible y editable.
module.exports = {
  id: 'payments', type: 'ui', name: 'Medios de pago',
  description: 'Banda "Aceptamos estos medios de pago" con íconos SVG de tarjetas, transferencia, efectivo y billetera virtual. Estática, sin JS.',
  html: (cfg) => {
    // Cada tarjeta: nombre + SVG inline dentro de un "chip" con el aspecto de una tarjeta.
    // Las marcas se dibujan con formas simples (no logos oficiales) para no depender de assets.
    const chip = (nombre, svg) => `<div class="pay-chip" title="${esc(nombre)}" aria-label="${esc(nombre)}">
          <svg width="46" height="30" viewBox="0 0 46 30" role="img" aria-hidden="true">
            <rect x="0.5" y="0.5" width="45" height="29" rx="4" fill="var(--surface)" stroke="var(--line)"/>
            ${svg}
          </svg>
          <span>${esc(nombre)}</span>
        </div>`;
    const medios = [
      chip('Visa', '<text x="23" y="20" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-style="italic" font-size="12" fill="#1a1f71">VISA</text>'),
      chip('Mastercard', '<circle cx="19" cy="15" r="8" fill="#eb001b"/><circle cx="27" cy="15" r="8" fill="#f79e1b" fill-opacity="0.85"/>'),
      chip('American Express', '<rect x="6" y="6" width="34" height="18" rx="2" fill="#2e77bc"/><text x="23" y="18" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="7" fill="#fff">AMEX</text>'),
      chip('Mercado Pago', '<path d="M8 15c4-5 26-5 30 0-4 5-26 5-30 0z" fill="#009ee3"/><circle cx="23" cy="15" r="3.2" fill="#fff"/>'),
      chip('Transferencia', '<path d="M13 12h16m-4-3 4 3-4 3M33 18H17m4 3-4-3 4-3" stroke="var(--accent)" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
      chip('Efectivo', '<rect x="9" y="9" width="28" height="12" rx="2" fill="none" stroke="#2e7d32" stroke-width="1.4"/><circle cx="23" cy="15" r="3.4" fill="none" stroke="#2e7d32" stroke-width="1.4"/>'),
    ];
    return `  <section id="medios-pago" style="padding:32px 0">
    <div class="container" style="text-align:center">
      <p class="muted" style="text-transform:uppercase;letter-spacing:.08em;font-size:.78rem;margin-bottom:14px">Aceptamos estos medios de pago</p>
      <div class="pay-grid">
        ${medios.join('\n        ')}
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    .pay-grid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;align-items:center}
    .pay-chip{display:flex;flex-direction:column;align-items:center;gap:6px}
    .pay-chip span{font-size:.72rem;color:var(--muted)}
    .pay-chip svg{border-radius:5px;filter:grayscale(.15)}
  </style>`,
  readmeNotes: () => [
    '**Medios de pago**: los íconos de la banda `medios-pago` son formas SVG propias (no logos oficiales de las marcas). Dejá sólo los medios que realmente aceptás editando el array `medios` en `modules/ui/payments.js` o directamente el HTML en `public/index.html`.',
  ],
};
