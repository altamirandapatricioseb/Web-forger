const { esc, txt, txtList } = require('../../src/templates');
const { phIconOr } = require('../../src/icons');

// Cada característica: nombre de icono Phosphor, título y bajada. Son placeholders editables
// desde el Builder (bloque "Textos por sección"); las "imágenes" son degradados reemplazables.
const FEATS = [
  { icon: 'lightning', t: 'Rápido de implementar', d: 'Poné todo en marcha en minutos, sin configuraciones eternas ni sorpresas.' },
  { icon: 'lock', t: 'Seguro por diseño', d: 'Tus datos y los de tus clientes protegidos en cada paso del proceso.' },
  { icon: 'chart-line-up', t: 'Pensado para crecer', d: 'Acompaña tu negocio a medida que suma clientes, sin rehacer nada.' },
];

// Default del campo editable: exactamente las filas de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ITEMS_DEFAULT = FEATS.map(f => `${f.icon} | ${f.t} | ${f.d}`).join('\n');

// Lista efectiva de características según la config del Builder.
// Formatos aceptados por línea: "icono | título | texto", "título | texto" o sólo "título".
function features(cfg) {
  const lineas = txtList(cfg, 'features', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return FEATS;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = FEATS[i % FEATS.length];
    if (partes.length >= 3) return { icon: partes[0], t: partes[1], d: partes.slice(2).join(' | ') };
    if (partes.length === 2) return { icon: base.icon, t: partes[0], d: partes[1] };
    return { icon: base.icon, t: partes[0], d: '' };
  });
}

// Filas de características alternadas (zigzag): imagen a un lado, texto al otro,
// invirtiendo el orden en cada fila. Layout clásico de landing de producto.
// Estática (sin JS); las "imágenes" son degradados placeholder reemplazables por fotos.
module.exports = {
  id: 'features', type: 'ui', name: 'Características destacadas',
  description: 'Filas alternadas (imagen + texto en zigzag) para destacar las claves de tu producto o servicio. Estática, sin JS.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Por qué elegirnos', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'Todo lo que necesitás, sin complicarte.', max: 220 },
    {
      key: 'items', label: 'Características', type: 'list', max: 1800, default: ITEMS_DEFAULT,
      hint: 'Una característica por línea: icono | título | texto. El icono es un nombre de Phosphor (phosphoricons.com); si no existe se usa el de reserva. También vale "título | texto".',
    },
  ],
  html: (cfg) => {
    const filas = features(cfg).map(f => `<div class="feature-row">
        <div class="feature-media" role="img" aria-label="${esc(f.t)}">${phIconOr(f.icon, 'lightning', { size: 64, color: 'var(--accent)' })}</div>
        <div class="feature-text">
          <h3>${esc(f.t)}</h3>
          <p class="muted">${esc(f.d)}</p>
        </div>
      </div>`).join('\n      ');
    return `  <section id="caracteristicas">
    <div class="container">
      <h2>${esc(txt(cfg, 'features', 'titulo', 'Por qué elegirnos'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'features', 'bajada', 'Todo lo que necesitás, sin complicarte.'))}</p>
      ${filas}
    </div>
  </section>`;
  },
  head: () => `  <style>
    #caracteristicas .feature-row{display:flex;flex-wrap:wrap;align-items:center;gap:32px;margin-top:36px}
    #caracteristicas .feature-row:nth-child(even){flex-direction:row-reverse}
    #caracteristicas .feature-media{flex:1 1 280px;min-height:200px;display:flex;align-items:center;justify-content:center;font-size:4rem;border-radius:var(--radius);background:linear-gradient(135deg, color-mix(in srgb, var(--accent) 22%, var(--bg)), color-mix(in srgb, var(--primary) 14%, var(--bg)))}
    #caracteristicas .feature-text{flex:1 1 280px}
    #caracteristicas .feature-text h3{font-size:1.4rem;letter-spacing:-.02em;margin:0 0 8px}
    #caracteristicas .feature-text p{margin:0}
  </style>`,
  readmeNotes: () => [
    '**Características destacadas**: los íconos (Phosphor, SVG inline), títulos y textos salen del bloque *Textos por sección* del Builder; si no los editaste, son placeholders. También se pueden cambiar después en la sección `caracteristicas` de la Home (`public/index.html`). Para usar fotos reales, reemplazá cada `<div class="feature-media">` por un `<img>`.',
  ],
};

// La lista efectiva se exporta para que el backend `razones` siembre la colección highlights
// con EXACTAMENTE las filas que hornea esta sección: si sembrara los defaults mientras el
// HTML muestra las del Builder, la primera carga parpadearía con dos contenidos distintos.
module.exports.features = features;
module.exports.FEATS = FEATS;
