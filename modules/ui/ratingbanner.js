const { esc } = require('../../src/templates');
const { phIcon, phStars } = require('../../src/icons');

// Banner de valoración agregada: nota promedio grande + fila de estrellas + cantidad
// de reseñas ("4.8 ★★★★★ · Basado en 250 reseñas"). Es la prueba social condensada que
// va cerca del hero o de precios. Estático por defecto (la nota ya está en el HTML).
// Si el módulo de reseñas está activo, un clientJs opcional recalcula nota y cantidad
// reales desde /api/reviews/summary. Usa Motion para una entrada suave si está disponible.
module.exports = {
  id: 'ratingbanner', type: 'ui', name: 'Banner de valoración',
  description: 'Banda con la nota promedio, estrellas y cantidad de reseñas. Si el módulo Reseñas está activo, toma los datos reales; si no, muestra un placeholder editable.',
  html: (cfg) => {
    // Placeholders editables: nota (0-5, admite medias) y cantidad de reseñas.
    const nota = 4.8;
    const cantidad = 250;
    // Estrellas a partir de la nota (Phosphor: llenas, media y vacías). El marcado
    // accesible vive en el aria-label del contenedor; la fila va aria-hidden.
    const estrellasHtml = phStars(nota, { size: 24 });
    return `  <section id="valoracion">
    <div class="container">
      <div class="rating-box" role="img" aria-label="${nota} de 5 estrellas, ${cantidad} reseñas">
        <span class="rating-nota" data-nota="${nota}">${esc(nota.toString().replace('.', ','))}</span>
        <span class="rating-stars" data-nota="${nota}" aria-hidden="true">${estrellasHtml}</span>
        <span class="rating-meta">Basado en <strong data-cant>${cantidad}</strong> reseñas de clientes</span>
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    #valoracion .rating-box{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:28px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)}
    #valoracion .rating-nota{font-size:3rem;font-weight:800;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
    #valoracion .rating-stars{display:inline-flex;gap:3px;color:var(--accent);line-height:1}
    #valoracion .rating-meta{color:var(--muted);font-size:.92rem}
  </style>`,
  // Si conviven con el módulo reseñas, recalcula nota y cantidad reales agregando /summary.
  clientJs: (cfg) => {
    if (!(cfg.moduleIds || []).includes('reviews')) return '';
    return `/* Módulo banner de valoración: nota y cantidad reales desde /api/reviews/summary si hay datos */
(function () {
  var box = document.querySelector('#valoracion .rating-box');
  if (!box || window.__PREVIEW__) return;
  var notaEl = box.querySelector('.rating-nota');
  var starsEl = box.querySelector('.rating-stars');
  var cantEl = box.querySelector('[data-cant]');
  // Glifos Phosphor horneados en build: el navegador solo arma la fila según la nota.
  var STAR_ON = '${phIcon('star-fill', { size: 24 })}';
  var STAR_HALF = '${phIcon('star-half-fill', { size: 24 })}';
  var STAR_OFF = '${phIcon('star', { size: 24, style: 'opacity:.35' })}';
  function pintarEstrellas(n) {
    var v = Math.max(0, Math.min(5, Math.round(n * 2) / 2));
    var llenas = Math.floor(v), media = v % 1 !== 0;
    var out = '';
    for (var i = 0; i < 5; i++) {
      if (i < llenas) out += STAR_ON;
      else if (i === llenas && media) out += STAR_HALF;
      else out += STAR_OFF;
    }
    starsEl.innerHTML = out;
  }
  App.api('/api/reviews/summary').then(function (resumen) {
    // /summary devuelve { productId: { avg, count } }: se agrega en una nota global ponderada
    var sumaPeso = 0, total = 0;
    Object.keys(resumen || {}).forEach(function (k) {
      var s = resumen[k]; if (!s || !s.count) return;
      sumaPeso += s.avg * s.count; total += s.count;
    });
    if (!total) return; // sin reseñas reales todavía: queda el placeholder
    var nota = Math.round(sumaPeso / total * 10) / 10;
    notaEl.textContent = nota.toString().replace('.', ',');
    if (cantEl) cantEl.textContent = total;
    pintarEstrellas(nota);
    box.setAttribute('aria-label', nota + ' de 5 estrellas, ' + total + ' reseñas');
  }).catch(function () {}); // si la API falla, queda el placeholder
})();`;
  },
  readmeNotes: (cfg) => ((cfg.moduleIds || []).includes('reviews')
    ? ['**Banner de valoración**: cuando el sitio acumule reseñas (módulo Reseñas), la nota y la cantidad se actualizan solas desde la API. Hasta entonces muestra el placeholder (4,8 · 250 reseñas), editable en `#valoracion` de `public/index.html`.']
    : ['**Banner de valoración**: la nota (4,8) y la cantidad (250 reseñas) son placeholders; editalas en la sección `#valoracion` de `public/index.html`. Con el módulo Reseñas activo se calcularían solas.']),
};
