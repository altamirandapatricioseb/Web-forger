const { esc, txt, txtList } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

// Preguntas frecuentes: acordeón con <details>. Además del HTML visible, emite datos
// estructurados FAQPage (schema.org) en el <head> de la Home para que los buscadores
// puedan mostrar el rich result de preguntas. Las preguntas/respuestas se definen una
// sola vez (FAQS) y se usan tanto en el HTML como en el JSON-LD, así nunca divergen.
//
// Animación: el despliegue está SIEMPRE animado (estilo elegible en el Builder:
// deslizar / fundido / resorte, via cfg.design.faqAnim) y la aparición del texto es
// opcional (cfg.design.faqText). El caret Phosphor rota al abrir. Cómo funciona:
// - El colapso usa el truco de grid-template-rows 0fr→1fr, pero como <details> no
//   rendea su contenido cerrado, el CSS solo no puede animar la apertura: el clientJs
//   intercepta el toggle, abre el atributo y recién entonces agrega la clase .abierto
//   (doble rAF) para que la transición corra. Al cerrar, quita la clase y espera el
//   transitionend antes de sacar el atributo, con timeout de red de seguridad.
// - Todo el colapso vive bajo @media (scripting: enabled): sin JS el acordeón queda
//   nativo e instantáneo, nunca contenido invisible. Con prefers-reduced-motion el
//   clientJs no intercepta nada y las transiciones se apagan: instantáneo y usable.
const FAQS = [
  { q: '¿Cómo empiezo?', a: 'Escribinos desde la página de contacto y te respondemos en el día.' },
  { q: '¿Qué formas de pago aceptan?', a: 'Transferencia, tarjetas y efectivo.' },
  { q: '¿Hacen envíos?', a: 'Sí, a todo el país.' },
];

// Default del campo editable del Builder: las mismas preguntas de arriba, una por línea.
const ITEMS_DEFAULT = FAQS.map(f => `${f.q} | ${f.a}`).join('\n');

/**
 * Preguntas efectivas según la config del Builder. La usan el HTML, el JSON-LD y la SEMILLA
 * del módulo `faqadmin`: si el panel de administración se sembrara con las preguntas por
 * defecto mientras el HTML muestra las del Builder, la primera carga del sitio parpadearía
 * mostrando primero unas preguntas y un instante después otras.
 * Formato por línea: "pregunta | respuesta". Una línea sin "|" se toma como pregunta y
 * conserva la respuesta base de esa posición.
 */
function faqs(cfg) {
  const lineas = txtList(cfg, 'faq', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return FAQS;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = FAQS[i % FAQS.length];
    return { q: partes[0], a: partes.length > 1 ? partes.slice(1).join(' | ') : base.a };
  });
}

// Curvas: salida exponencial para deslizar/fundido; resorte con rebote solo en la
// variante "resorte" (elegida a propósito por el usuario del Builder, no un default).
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

const FAQ_CSS = `
  #faq .faq-q { cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: space-between; gap: 12px; list-style: none; }
  #faq .faq-q::-webkit-details-marker { display: none; }
  #faq .faq-q::marker { content: ''; }
  #faq .faq-caret { flex-shrink: 0; color: var(--accent); transition: transform .3s ${EASE_OUT}; }
  #faq .faq-item[open] .faq-caret { transform: rotate(180deg); }
  #faq .faq-a-inner { overflow: hidden; min-height: 0; }
  #faq .faq-a p { margin: 10px 0 0; }
  @media (scripting: enabled) and (prefers-reduced-motion: no-preference) {
    #faq .faq-a { display: grid; grid-template-rows: 0fr; }
    #faq .faq-item.abierto .faq-a { grid-template-rows: 1fr; }
    #faq.faq-fx-slide .faq-a { transition: grid-template-rows .34s ${EASE_OUT}; }
    #faq.faq-fx-fade .faq-a { transition: grid-template-rows .34s ${EASE_OUT}; }
    #faq.faq-fx-fade .faq-a-inner { opacity: 0; transition: opacity .3s ease .06s; }
    #faq.faq-fx-fade .faq-item.abierto .faq-a-inner { opacity: 1; }
    #faq.faq-fx-spring .faq-a { transition: grid-template-rows .5s ${EASE_SPRING}; }
    #faq.faq-fx-spring .faq-a-inner { transform: translateY(-6px); transition: transform .5s ${EASE_SPRING}; }
    #faq.faq-fx-spring .faq-item.abierto .faq-a-inner { transform: none; }
    #faq.faq-textfx .faq-a p { opacity: 0; transform: translateY(8px); transition: opacity .32s ease .12s, transform .32s ${EASE_OUT} .12s; }
    #faq.faq-textfx .faq-item.abierto .faq-a p { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    #faq .faq-caret { transition: none; }
  }`;

module.exports = {
  id: 'faq', type: 'ui', name: 'Preguntas frecuentes',
  description: 'Acordeón de preguntas y respuestas con despliegue animado (estilo elegible) y datos estructurados FAQPage (SEO) en el head de la Home.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Preguntas frecuentes', max: 80 },
    {
      key: 'items', label: 'Preguntas y respuestas', type: 'list', max: 2600, default: ITEMS_DEFAULT,
      hint: 'Una por línea: pregunta | respuesta. Salen también en los datos estructurados FAQPage que lee Google.',
    },
  ],
  html: (cfg) => {
    const caret = phIcon('caret-down', { size: 18, cls: 'faq-caret' });
    const items = faqs(cfg).map(f => `        <details class="card faq-item">
          <summary class="faq-q">${esc(f.q)} ${caret}</summary>
          <div class="faq-a"><div class="faq-a-inner"><p class="muted">${esc(f.a)}</p></div></div>
        </details>`).join('\n');
    const clases = `faq-fx-${cfg.design.faqAnim}${cfg.design.faqText ? ' faq-textfx' : ''}`;
    return `  <section id="faq" class="${clases}">
    <style>${FAQ_CSS}
    </style>
    <div class="container">
      <h2>${esc(txt(cfg, 'faq', 'titulo', 'Preguntas frecuentes'))}</h2>
      <div class="grid" style="max-width:720px">
${items}
      </div>
    </div>
  </section>`;
  },
  clientJs: () => `/* FAQ: apertura/cierre animados del acordeón. Sin este JS (o con menos movimiento)
   el <details> nativo sigue funcionando, instantáneo. */
(function () {
  var faq = document.getElementById('faq');
  if (!faq) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Red de seguridad: si transitionend no llega (pestaña oculta, transición apagada),
  // el cierre se concreta igual pasado el largo de la transición más un margen.
  var DUR = faq.classList.contains('faq-fx-spring') ? 620 : 460;
  // El enganche por ítem vive en una función con nombre para poder repetirlo: el módulo
  // "faqadmin" (backend de preguntas) reemplaza los <details> por los del negocio después
  // de que este JS corrió, y los nuevos también tienen que abrirse animados.
  function enganchar(item) {
    var sum = item.querySelector('summary');
    var panel = item.querySelector('.faq-a');
    if (!sum || !panel) return;
    // Un ítem ya enganchado no se vuelve a enganchar: dos handlers cancelarían la apertura
    if (item._wfFaq) return;
    item._wfFaq = true;
    sum.addEventListener('click', function (e) {
      e.preventDefault();
      if (item.classList.contains('abierto')) {
        item.classList.remove('abierto');
        var token = {};
        item._cierre = token;
        var cerrar = function () {
          if (item._cierre !== token) return; // se reabrió en el medio: no tocar
          item._cierre = null;
          item.removeAttribute('open');
        };
        panel.addEventListener('transitionend', function alFinal(ev) {
          if (ev.target !== panel) return;
          panel.removeEventListener('transitionend', alFinal);
          cerrar();
        });
        setTimeout(cerrar, DUR);
      } else {
        item._cierre = null; // cancela un cierre pendiente si lo había
        item.setAttribute('open', '');
        // Doble rAF: el contenido tiene que pintarse colapsado (0fr) antes de la clase,
        // si no la transición de apertura no corre. El setTimeout es la red de seguridad
        // para pestañas ocultas/throttled donde rAF no dispara: abre igual (sin animar).
        var abrir = function () { item.classList.add('abierto'); };
        requestAnimationFrame(function () { requestAnimationFrame(abrir); });
        setTimeout(abrir, 80);
      }
    });
  }

  function engancharTodos() {
    Array.prototype.forEach.call(faq.querySelectorAll('.faq-item'), enganchar);
  }
  engancharTodos();

  // Punto de entrada para quien reemplace las preguntas en vivo (módulo "faqadmin")
  window.WFFaq = { rebind: engancharTodos };
})();`,
  // JSON-LD FAQPage: sólo en la Home (donde vive la sección). El \\u003c evita que
  // cualquier texto con "<" cierre el <script> antes de tiempo.
  head: (cfg, page) => {
    if (page.active !== '/index.html') return '';
    const ldjson = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs(cfg).map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    }).replace(/</g, '\\u003c');
    return `  <script type="application/ld+json">${ldjson}</script>`;
  },
  readmeNotes: () => [
    '**Preguntas frecuentes**: las preguntas y respuestas se cargan en el Builder (bloque *Textos por sección*) y alimentan tanto el acordeón visible como los datos estructurados FAQPage (SEO), así nunca divergen. Para que el negocio pueda editarlas desde el sitio publicado, activá el módulo **Preguntas frecuentes administrables**.',
    '**Animación del acordeón**: el estilo de despliegue y la aparición del texto se eligen en el Builder (sección Tipografía y efectos); quedan horneados en las clases `faq-fx-*` / `faq-textfx` de la sección `#faq`.',
  ],
};

// La lista efectiva se exporta para que el backend `faqadmin` siembre su colección con
// EXACTAMENTE las preguntas que hornea esta sección.
module.exports.faqs = faqs;
module.exports.FAQS = FAQS;
