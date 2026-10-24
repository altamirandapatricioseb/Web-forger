const { esc, txt, txtList } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

// Testimonios de ejemplo: placeholders genéricos, editables desde el Builder
// (bloque "Textos por sección"). `q` es la frase y `a` quién la firma.
const TESTIMONIOS = [
  { q: 'Excelente atención y resultados. Superó lo que esperábamos.', a: 'María G.' },
  { q: 'Rápidos, claros y profesionales. Los recomiendo sin dudar.', a: 'Julián P.' },
  { q: 'El mejor servicio que contratamos este año.', a: 'Carla S.' },
];

// Default del campo editable: exactamente los testimonios de arriba, para que el panel
// arranque mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ITEMS_DEFAULT = TESTIMONIOS.map(t => `${t.q} | ${t.a}`).join('\n');

// Bajada por defecto. {marca} se reemplaza por el nombre del negocio al generar: así el
// default declarado puede ser una constante (lo exige el contrato `fields`) y el texto
// horneado sigue nombrando a la marca igual que antes.
const BAJADA_DEFAULT = 'Historias reales de quienes ya confiaron en {marca}.';

// Lista efectiva de testimonios según la config del Builder.
// Formatos aceptados por línea: "frase | autor" o sólo "frase".
function testimonios(cfg) {
  const lineas = txtList(cfg, 'testimonials', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return TESTIMONIOS;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = TESTIMONIOS[i % TESTIMONIOS.length];
    if (partes.length >= 2) return { q: partes.slice(0, -1).join(' | '), a: partes[partes.length - 1] };
    return { q: partes[0], a: base.a };
  });
}

module.exports = {
  id: 'testimonials', type: 'ui', name: 'Testimonios',
  description: 'Opiniones de clientes en tarjetas. Si el módulo de reseñas está activo, muestra las mejores reseñas reales en lugar de los ejemplos.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Lo que dicen nuestros clientes', max: 80 },
    {
      key: 'bajada', label: 'Bajada', default: BAJADA_DEFAULT, max: 220,
      hint: 'Escribí {marca} donde quieras que aparezca el nombre del negocio.',
    },
    {
      key: 'items', label: 'Testimonios', type: 'list', max: 1500, default: ITEMS_DEFAULT,
      hint: 'Un testimonio por línea: frase | autor. Ejemplo: "Excelente atención y resultados. | María G.". Las comillas y el guion del autor los pone el sitio.',
    },
  ],
  html: (cfg) => `  <section id="testimonios" style="background:var(--surface)">
    <div class="container">
      <h2>${esc(txt(cfg, 'testimonials', 'titulo', 'Lo que dicen nuestros clientes'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'testimonials', 'bajada', BAJADA_DEFAULT).replace(/\{marca\}/g, cfg.brand.name))}</p>
      <div class="grid cols-3">
        ${testimonios(cfg).map(t => `<div class="card"><p>“${esc(t.q)}”</p><strong>— ${esc(t.a)}</strong></div>`).join('\n        ')}
      </div>
    </div>
  </section>`,
  // Convivencia con el módulo reseñas: los testimonios de ejemplo se reemplazan por reseñas reales
  clientJs: (cfg) => {
    if (!cfg.moduleIds.includes('reviews')) return '';
    // Los dos glifos de estrella (Phosphor) se hornean como strings en el JS del cliente;
    // el navegador solo los repite según el rating: sin librería de iconos en runtime.
    return `/* Módulo testimonios: si hay reseñas reales de 4-5 estrellas, reemplazan a los ejemplos */
(function () {
  var grid = document.querySelector('#testimonios .grid');
  if (!grid || window.__PREVIEW__) return;
  var STAR_ON = '${phIcon('star-fill', { size: 15 })}';
  var STAR_OFF = '${phIcon('star', { size: 15, style: 'opacity:.35' })}';
  var estrellas = function (n) { var s = ''; for (var i = 0; i < 5; i++) s += i < n ? STAR_ON : STAR_OFF; return s; };
  App.api('/api/reviews/top').then(function (rs) {
    if (!rs.length) return; // sin reseñas reales todavía: quedan los ejemplos
    grid.innerHTML = rs.slice(0, 3).map(function (r) {
      return '<div class="card"><p style="color:var(--accent);display:inline-flex;gap:2px;margin:0 0 6px" role="img" aria-label="' + r.rating + ' de 5 estrellas">' + estrellas(r.rating) + '</p>' +
        '<p>“' + App.esc(r.text) + '”</p><strong>— ' + App.esc(r.author) + '</strong></div>';
    }).join('');
  }).catch(function () {}); // si la API falla, los ejemplos siguen en pantalla
})();`;
  },
  readmeNotes: (cfg) => (cfg.moduleIds.includes('reviews')
    ? ['**Testimonios**: cuando el sitio acumule reseñas de 4-5 estrellas (módulo Reseñas), la sección las muestra automáticamente en lugar de los ejemplos.']
    : ['**Testimonios**: las opiniones salen del bloque *Textos por sección* del Builder; si no las editaste, son ejemplos. También podés cambiarlas después en la sección `#testimonios` de `public/index.html`.']),
};
