const { esc, txt, txtList } = require('../../src/templates');

// Cifras placeholder de un negocio tipo, editables desde el Builder.
// `valor` es entero (el JS lo anima con parseInt) y `sufijo` es lo que va pegado atrás.
const CIFRAS = [
  { valor: 12, sufijo: '+', label: 'Años de experiencia' },
  { valor: 480, sufijo: '+', label: 'Clientes satisfechos' },
  { valor: 1250, sufijo: '', label: 'Proyectos entregados' },
  { valor: 98, sufijo: '%', label: 'Nos recomiendan' },
];

// Default del campo editable: exactamente las cifras de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ITEMS_DEFAULT = CIFRAS.map(c => `${c.valor}${c.sufijo} | ${c.label}`).join('\n');

// Lista efectiva de cifras según la config del Builder.
// Formatos aceptados por línea: "cifra | etiqueta" o sólo "cifra".
// La cifra separa el número entero de lo que venga pegado atrás (el sufijo: "+", "%"…).
function cifras(cfg) {
  const lineas = txtList(cfg, 'counters', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return CIFRAS;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = CIFRAS[i % CIFRAS.length];
    const m = /^([\d.,]+)(.*)$/.exec(String(partes[0]).trim());
    // Sin número usable la tarjeta no tendría qué animar: se cae a la cifra base
    const valor = m ? parseInt(m[1].replace(/[.,]/g, ''), 10) : base.valor;
    return {
      valor: Number.isFinite(valor) ? valor : base.valor,
      sufijo: m ? m[2].trim() : base.sufijo,
      label: partes.length >= 2 ? partes.slice(1).join(' | ') : base.label,
    };
  });
}

module.exports = {
  id: 'counters', type: 'ui', name: 'Contadores animados',
  description: 'Cifras del negocio (años, clientes, proyectos) que suben de 0 a su valor al entrar en pantalla. Respeta la preferencia de menos movimiento.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Números que nos respaldan', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'La trayectoria se mide en resultados concretos.', max: 220 },
    {
      key: 'items', label: 'Cifras', type: 'list', max: 1500, default: ITEMS_DEFAULT,
      hint: 'Una cifra por línea: número | etiqueta. El número tiene que ser entero y puede llevar un sufijo pegado (12+, 98%).',
    },
  ],
  html: (cfg) => `  <section id="cifras" style="background:var(--surface)">
    <div class="container">
      <h2>${esc(txt(cfg, 'counters', 'titulo', 'Números que nos respaldan'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'counters', 'bajada', 'La trayectoria se mide en resultados concretos.'))}</p>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
${cifras(cfg).map(c => `        <div class="card" style="text-align:center">
          <span class="contador" data-meta="${c.valor}" data-sufijo="${esc(c.sufijo)}" style="font-size:2.4rem;font-weight:800;color:var(--accent);letter-spacing:-0.02em">${c.valor.toLocaleString('es-AR')}${esc(c.sufijo)}</span>
          <p class="muted" style="margin:6px 0 0">${esc(c.label)}</p>
        </div>`).join('\n')}
      </div>
    </div>
  </section>`,
  clientJs: () => `/* Módulo contadores: anima cada cifra de 0 a su valor al entrar en pantalla.
   El HTML ya trae el valor final: sin JS (o con prefers-reduced-motion) no se anima
   pero la cifra se ve igual. El easing frena suave al final (cúbico). */
(function () {
  var els = document.querySelectorAll('.contador');
  if (!els.length) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  function pintar(el, n) { el.textContent = n.toLocaleString('es-AR') + (el.dataset.sufijo || ''); }
  function animar(el) {
    var meta = parseInt(el.dataset.meta, 10) || 0;
    var inicio = null, dur = 1400;
    function paso(t) {
      if (!inicio) inicio = t;
      var p = Math.min((t - inicio) / dur, 1);
      pintar(el, Math.round(meta * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      observer.unobserve(e.target);
      animar(e.target);
    });
  }, { threshold: 0.4 });
  Array.prototype.forEach.call(els, function (el) {
    // Arranca en 0 recién acá: si el observer nunca dispara, el HTML ya mostraba el valor real
    pintar(el, 0);
    observer.observe(el);
  });
})();`,
  readmeNotes: () => [
    '**Contadores**: las cifras de la Home salen del bloque *Textos por sección* del Builder; si no las editaste, son placeholders. También podés cambiar `data-meta`, sufijos y etiquetas en la sección `#cifras` de `public/index.html`.',
  ],
};
