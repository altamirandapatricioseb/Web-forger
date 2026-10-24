const { esc } = require('../../src/templates');

// Tooltips (globos de ayuda) accesibles: cualquier elemento con data-tooltip="texto"
// muestra un globo posicionado al pasar el mouse, al recibir foco por teclado o al tocar
// en móvil, y se oculta al salir o con Esc. Un único globo compartido para todo el sitio,
// posicionado por JS para no salirse de la pantalla. La sección visible es una demo editable.
module.exports = {
  id: 'tooltip', type: 'ui', name: 'Globos de ayuda (tooltips)',
  description: 'Tooltips accesibles: cualquier elemento con data-tooltip="texto" muestra un globo al pasar el mouse, al enfocar con teclado o al tocar. Un único globo compartido, posicionado por JS. Incluye una demo editable.',
  html: () => `  <section id="tooltips-demo">
    <div class="container" style="max-width:720px">
      <h2>Globos de ayuda</h2>
      <p class="section-sub">Pasá el mouse (o tocá) sobre los términos marcados para ver una explicación en un globo.</p>
      <p>Ofrecemos <span class="tip" tabindex="0" data-tooltip="Sin costo de instalación ni permanencia mínima.">planes flexibles</span>, <span class="tip" tabindex="0" data-tooltip="Te respondemos dentro de las 24 horas hábiles.">soporte rápido</span> y <span class="tip" tabindex="0" data-tooltip="Tus datos viajan cifrados de punta a punta.">conexión segura</span> para todos nuestros clientes.</p>
    </div>
  </section>`,
  head: () => `  <style>
    .tip{border-bottom:1px dotted var(--accent);cursor:help;outline-offset:3px}
    .tooltip-bubble{position:fixed;z-index:90;max-width:240px;padding:8px 11px;border-radius:8px;background:var(--primary);color:#fff;font-size:.85rem;line-height:1.35;box-shadow:0 6px 20px rgba(0,0,0,.22);opacity:0;transform:translateY(4px);transition:opacity .16s ease, transform .16s ease;pointer-events:none}
    .tooltip-bubble.visible{opacity:1;transform:translateY(0)}
    @media (prefers-reduced-motion: reduce){.tooltip-bubble{transition:none}}
  </style>`,
  clientJs: () => `/* Módulo tooltips: globo único compartido para todo elemento con data-tooltip.
   Aparece al pasar el mouse, al enfocar por teclado y al tocar; se oculta al salir o con
   Esc. Posicionado por JS para no salirse de la pantalla (arriba, o abajo si no entra).
   Degrada sin romper: si no corre el JS, el texto sigue en el atributo. */
(function () {
  var globo, actual = null;
  function crear() {
    if (globo) return;
    globo = document.createElement('div');
    globo.className = 'tooltip-bubble';
    globo.setAttribute('role', 'tooltip');
    document.body.appendChild(globo);
  }
  function posicionar(destino) {
    var r = destino.getBoundingClientRect();
    var gr = globo.getBoundingClientRect();
    var margen = 8;
    // Centrado horizontal sobre el elemento, sin salirse del viewport
    var x = r.left + r.width / 2 - gr.width / 2;
    x = Math.max(margen, Math.min(x, window.innerWidth - gr.width - margen));
    // Arriba por defecto; si no hay lugar, abajo
    var y = r.top - gr.height - margen;
    if (y < margen) y = r.bottom + margen;
    globo.style.left = x + 'px';
    globo.style.top = y + 'px';
  }
  function mostrar(destino) {
    crear();
    var texto = destino.getAttribute('data-tooltip');
    if (!texto) return;
    actual = destino;
    globo.textContent = texto;
    // Vincula el globo al elemento para lectores de pantalla
    if (!destino.id) destino.id = 'tip-' + Math.round(performance.now()) + '-' + Math.floor(Math.random() * 1000);
    globo.id = destino.id + '-bubble';
    destino.setAttribute('aria-describedby', globo.id);
    posicionar(destino);
    globo.classList.add('visible');
  }
  function ocultar() {
    if (!globo) return;
    globo.classList.remove('visible');
    if (actual) { actual.removeAttribute('aria-describedby'); actual = null; }
  }
  document.addEventListener('mouseover', function (e) {
    var t = e.target.closest('[data-tooltip]');
    if (t) mostrar(t);
  });
  document.addEventListener('mouseout', function (e) {
    var t = e.target.closest('[data-tooltip]');
    if (t && t === actual) ocultar();
  });
  document.addEventListener('focusin', function (e) {
    var t = e.target.closest('[data-tooltip]');
    if (t) mostrar(t);
  });
  document.addEventListener('focusout', ocultar);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') ocultar(); });
  // Táctil: un toque muestra el globo del elemento tocado y oculta cualquier otro
  document.addEventListener('touchstart', function (e) {
    var t = e.target.closest('[data-tooltip]');
    if (t) mostrar(t); else ocultar();
  }, { passive: true });
  window.addEventListener('scroll', ocultar, { passive: true });
})();`,
  readmeNotes: () => [
    '**Globos de ayuda**: agregá `data-tooltip="texto"` a cualquier elemento (agregale `tabindex="0"` si no es un control, para que también funcione con teclado) y aparecerá un globo con esa explicación. La sección de demo (`#tooltips-demo`) es editable o borrable.',
  ],
};
