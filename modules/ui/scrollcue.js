// Indicador "deslizá hacia abajo": una flecha al pie del hero que rebota suavemente
// (Anime.js) invitando a scrollear, y que al hacer clic lleva a la siguiente sección.
// Se oculta apenas el visitante empieza a scrollear. Requiere el hero (se inyecta dentro).
// Decorativo: sin Anime o con "menos movimiento" queda quieta pero sigue siendo un botón
// funcional que baja a la siguiente sección.
module.exports = {
  id: 'scrollcue', type: 'ui', name: 'Indicador de scroll',
  description: 'Flecha animada al pie del hero que invita a seguir bajando y lleva a la siguiente sección al hacer clic. Se oculta al empezar a scrollear. Animada con Anime.js.',
  usesAnime: true,
  requires: ['hero'],
  head: () => `  <style>
    .scrollcue{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:2;border:0;background:transparent;cursor:pointer;padding:8px;line-height:0;color:var(--accent);transition:opacity .4s}
    .scrollcue svg{display:block;width:30px;height:30px}
    .scrollcue.oculto{opacity:0;pointer-events:none}
    @media (prefers-reduced-motion: reduce){.scrollcue{animation:none}}
  </style>`,
  clientJs: () => `/* Módulo indicador de scroll: inyecta una flecha al pie del hero que rebota con
   Anime.js y baja a la siguiente sección al hacer clic. Sin librería o con menos
   movimiento no rebota, pero sigue funcionando como botón. Se oculta al scrollear. */
(function () {
  var hero = document.querySelector('.hero');
  if (!hero) return;
  if (getComputedStyle(hero).position === 'static') hero.style.position = 'relative';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'scrollcue';
  btn.setAttribute('aria-label', 'Bajar a la siguiente sección');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  btn.addEventListener('click', function () {
    // Baja a la primera sección que venga después del hero
    var sig = hero.nextElementSibling;
    while (sig && sig.tagName !== 'SECTION') sig = sig.nextElementSibling;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sig) sig.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    else window.scrollTo({ top: window.innerHeight, behavior: reduce ? 'auto' : 'smooth' });
  });
  hero.appendChild(btn);
  // Se oculta apenas el visitante scrollea un poco
  var oculto = false;
  window.addEventListener('scroll', function () {
    if (!oculto && window.scrollY > 60) { oculto = true; btn.classList.add('oculto'); }
  }, { passive: true });
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var anime = window.anime;
  if (!anime || !anime.animate || reduce) return;   // quieta pero funcional
  // Rebote suave en bucle de ida y vuelta
  anime.animate(btn, { translateY: [0, 10], duration: 900, loop: true, alternate: true, ease: 'inOutSine' });
})();`,
};
