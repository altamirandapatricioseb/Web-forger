const { esc, txt, txtList } = require('../../src/templates');
const { phIconOr } = require('../../src/icons');

// Cada dato: número (con su sufijo/prefijo ya incluido), una etiqueta corta y un nombre de
// icono Phosphor opcional que acompaña a la cifra (ej: la estrella de satisfacción).
const DATOS = [
  { n: '+500', l: 'Clientes activos' },
  { n: '10', l: 'Años de experiencia' },
  { n: '4.9', l: 'Satisfacción promedio', icono: 'star-fill' },
  { n: '24/7', l: 'Soporte disponible' },
];

// Default del campo editable: exactamente los datos de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ITEMS_DEFAULT = DATOS
  .map(d => [d.n, d.l].concat(d.icono ? [d.icono] : []).join(' | '))
  .join('\n');

// Lista efectiva de estadísticas según la config del Builder.
// Formatos aceptados por línea: "cifra | etiqueta | icono", "cifra | etiqueta" o sólo "cifra".
// A diferencia de los contadores, acá la cifra es texto libre: no se anima, se muestra tal cual.
function datos(cfg) {
  const lineas = txtList(cfg, 'metrics', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return DATOS;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = DATOS[i % DATOS.length];
    // Con una sola columna se completa con la etiqueta y el icono base
    if (partes.length < 2) return { n: partes[0], l: base.l, icono: base.icono };
    return { n: partes[0], l: partes[1], icono: partes[2] || '' };
  });
}

// Banda de estadísticas de confianza: números grandes sobre una franja de acento
// ("+500 clientes", "10 años", "4.9★"). Estática, sin JS: la cifra final ya está
// en el HTML. Para cifras que se animan al entrar en pantalla está el módulo "contadores".
module.exports = {
  id: 'metrics', type: 'ui', name: 'Banda de estadísticas',
  description: 'Franja destacada con cifras de confianza (clientes, años, satisfacción). Estática, sin JS.',
  fields: [
    {
      key: 'items', label: 'Estadísticas', type: 'list', max: 1500, default: ITEMS_DEFAULT,
      hint: 'Una estadística por línea: cifra | etiqueta | icono. La cifra es texto libre (+500, 24/7). El icono es opcional: un nombre de Phosphor (phosphoricons.com); si no existe se usa el de reserva.',
    },
  ],
  html: (cfg) => {
    const items = datos(cfg).map(d => `<div class="metric">
          <span class="metric-n">${esc(d.n)}${d.icono ? ' ' + phIconOr(d.icono, 'star-fill', { size: 22, style: 'vertical-align:baseline' }) : ''}</span>
          <span class="metric-l">${esc(d.l)}</span>
        </div>`).join('\n        ');
    // Franja full-bleed de acento; el texto va en blanco para contrastar
    return `  <section id="estadisticas" style="padding:0">
    <div style="background:var(--accent);color:#fff;padding:48px 0">
      <div class="container">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:24px;text-align:center">
        ${items}
        </div>
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    #estadisticas .metric-n{display:block;font-size:2.6rem;font-weight:800;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
    #estadisticas .metric-l{display:block;margin-top:8px;font-size:.85rem;opacity:.9;text-transform:uppercase;letter-spacing:.05em}
  </style>`,
  readmeNotes: () => [
    '**Banda de estadísticas**: las cifras ("+500", "10", "4.9★"…) y sus etiquetas salen del bloque *Textos por sección* del Builder; si no las editaste, son placeholders. También podés cambiarlas después en la sección `estadisticas` de la Home (`public/index.html`).',
  ],
};
