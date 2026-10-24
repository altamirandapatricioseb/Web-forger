const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'backtotop', type: 'ui', name: 'Volver arriba',
  description: 'Botón flotante que aparece al scrollear y vuelve al inicio con scroll suave. Presente en todas las páginas.',
  clientJs: () => `/* Módulo volver arriba: aparece pasado cierto scroll y sube suave.
   Respeta prefers-reduced-motion (en ese caso el salto es instantáneo). */
(function () {
  var style = document.createElement('style');
  style.textContent = '.backtotop{position:fixed;right:18px;bottom:18px;z-index:30;width:44px;height:44px;' +
    'border:0;border-radius:50%;background:var(--accent);color:#fff;cursor:pointer;' +
    'display:flex;align-items:center;justify-content:center;' +
    'box-shadow:0 4px 14px rgba(0,0,0,.22);opacity:0;pointer-events:none;transition:opacity .25s ease}' +
    '.backtotop.show{opacity:1;pointer-events:auto}';
  document.head.appendChild(style);
  var btn = document.createElement('button');
  btn.id = 'backtotop-btn';
  btn.className = 'backtotop';
  btn.type = 'button';
  btn.innerHTML = '${phIcon('arrow-up', { size: 20 })}';
  btn.setAttribute('aria-label', 'Volver arriba');
  document.body.appendChild(btn);
  // Convivencia con el botón de WhatsApp: si ya está, este se ubica encima
  if (document.getElementById('whatsapp-fab')) btn.style.bottom = '84px';
  var visible = false;
  function onScroll() {
    var mostrar = window.scrollY > 400;
    if (mostrar !== visible) {
      visible = mostrar;
      btn.classList.toggle('show', visible);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  btn.addEventListener('click', function () {
    var suave = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    window.scrollTo({ top: 0, behavior: suave ? 'smooth' : 'auto' });
  });
})();`,
};
