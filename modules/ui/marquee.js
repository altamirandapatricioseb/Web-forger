const { esc, txt, txtList } = require('../../src/templates');

// Frases placeholder de la cinta, editables desde el Builder. Podés poner beneficios,
// marcas o novedades.
const FRASES = [
  'Envío gratis a todo el país',
  'Atención personalizada',
  '10 años de experiencia',
  'Pago 100% seguro',
  'Garantía de satisfacción',
  'Más de 500 clientes felices',
];

// Default del campo editable: exactamente las frases de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const FRASES_DEFAULT = FRASES.join('\n');

// Frases efectivas según la config del Builder: una por línea. Si alguien igual escribe
// un "|", txtList ya partió la línea en partes: se rearma en una sola frase.
function frases(cfg) {
  const lineas = txtList(cfg, 'marquee', 'frases', FRASES_DEFAULT);
  if (!lineas.length) return FRASES;
  return lineas.map(linea => (Array.isArray(linea) ? linea.join(' | ') : linea));
}

// Marquesina (ticker): frases o marcas que se desplazan en loop continuo.
// Muy usada para "confían en nosotros", beneficios o novedades.
// La animación es CSS puro; el clientJs solo inyecta los estilos. Sin JS quedan
// las frases en una fila estática (se ven igual, sin movimiento).
module.exports = {
  id: 'marquee', type: 'ui', name: 'Marquesina animada',
  description: 'Cinta con frases o marcas que se desplazan en bucle continuo (pausa al pasar el mouse). Respeta la preferencia de menos movimiento.',
  fields: [
    { key: 'etiqueta', label: 'Nombre de la cinta (lectores de pantalla)', default: 'Novedades', max: 80 },
    {
      key: 'frases', label: 'Frases de la cinta', type: 'list', max: 1500, default: FRASES_DEFAULT,
      hint: 'Una frase por línea, en el orden en que se muestran. Ejemplo: "Envío gratis a todo el país". El punto separador entre frases lo pone el sitio; la copia del loop se duplica sola.',
    },
  ],
  html: (cfg) => {
    const lista0 = frases(cfg);
    // Se duplica la lista (aria-hidden en la copia) para que el loop sea sin cortes
    const item = (t) => `<li class="mq-item">${esc(t)}</li>`;
    const sep = '<li class="mq-sep" aria-hidden="true">•</li>';
    const lista = lista0.map(item).join(sep);
    const copia = lista0.map(t => `<li class="mq-item" aria-hidden="true">${esc(t)}</li>`).join(sep);
    return `  <section id="marquesina" class="mq" aria-label="${esc(txt(cfg, 'marquee', 'etiqueta', 'Novedades'))}" style="padding:0">
    <div class="mq-track">
      <ul class="mq-group">${lista}</ul>
      <ul class="mq-group" aria-hidden="true">${sep}${copia}${sep}</ul>
    </div>
  </section>`;
  },
  clientJs: () => `// Módulo marquesina: estilos de la cinta animada. La animación es CSS;
// con prefers-reduced-motion se detiene y las frases quedan quietas y legibles.
(function () {
  if (!document.querySelector('.mq .mq-track')) return;
  var estilo = document.createElement('style');
  estilo.textContent =
    '.mq{background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden}' +
    '.mq-track{display:flex;width:max-content;animation:mq-scroll 32s linear infinite}' +
    '.mq:hover .mq-track{animation-play-state:paused}' +
    '.mq-group{display:flex;align-items:center;gap:14px;margin:0;padding:14px 7px;list-style:none;white-space:nowrap}' +
    '.mq-item{font-weight:600;font-size:.95rem;color:var(--text)}' +
    '.mq-sep{color:var(--accent)}' +
    '@keyframes mq-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}' +
    '@media (prefers-reduced-motion: reduce){.mq-track{animation:none;flex-wrap:wrap;justify-content:center}}';
  document.head.appendChild(estilo);
})();`,
  readmeNotes: () => [
    '**Marquesina animada**: las frases de la cinta salen del bloque *Textos por sección* del Builder (la copia del loop se duplica sola). Si las editás después a mano en la sección `marquesina` de la Home (`public/index.html`), mantené la segunda lista (la copia con `aria-hidden`) igual a la primera para que el loop no tenga saltos.',
  ],
};
