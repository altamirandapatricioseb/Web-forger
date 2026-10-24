const { esc } = require('../../src/templates');

// Banda decorativa con efecto parallax: capas (manchas + una frase destacada) que se
// desplazan a distinta velocidad al scrollear, dando sensación de profundidad. El efecto
// está atado al scroll continuo, por eso usa requestAnimationFrame directo y no una
// librería de tweens (Anime/Motion animan por tiempo, no por posición de scroll).
// Con "menos movimiento" o sin JS queda como una banda estática, legible igual.
module.exports = {
  id: 'parallax', type: 'ui', name: 'Banda parallax',
  description: 'Banda a todo el ancho con una frase destacada y capas de fondo que se mueven a distinta velocidad al hacer scroll (efecto profundidad). Puramente decorativa y respeta la preferencia de menos movimiento.',
  head: () => `  <style>
    .parallax{position:relative;overflow:hidden;padding:110px 0;text-align:center;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 22%,var(--bg)),var(--bg))}
    .parallax .container{position:relative;z-index:1}
    .parallax h2{font-size:clamp(1.6rem,4vw,2.6rem);margin:0 0 10px}
    .parallax-capa{position:absolute;border-radius:50%;filter:blur(50px);opacity:.45;pointer-events:none;will-change:transform;z-index:0}
    .parallax-capa.p1{width:300px;height:300px;top:-40px;left:8%;background:var(--accent)}
    .parallax-capa.p2{width:240px;height:240px;bottom:-60px;right:12%;background:color-mix(in srgb,var(--primary) 55%,var(--accent))}
    .parallax-capa.p3{width:180px;height:180px;top:30%;right:38%;background:color-mix(in srgb,var(--accent) 60%,var(--bg))}
    @media (prefers-reduced-motion: reduce){.parallax-capa{opacity:.3}}
  </style>`,
  html: (cfg) => `  <section class="parallax" id="parallax">
    <span class="parallax-capa p1" data-veloc="0.25" aria-hidden="true"></span>
    <span class="parallax-capa p2" data-veloc="-0.18" aria-hidden="true"></span>
    <span class="parallax-capa p3" data-veloc="0.12" aria-hidden="true"></span>
    <div class="container">
      <h2>${esc(cfg.brand.tagline)}</h2>
      <p class="section-sub" style="max-width:640px;margin:0 auto">Trabajamos cada día para estar a la altura de lo que confiás en nosotros.</p>
    </div>
  </section>`,
  clientJs: () => `/* Módulo banda parallax: desplaza cada capa a distinta velocidad según la posición de
   scroll de la banda en pantalla. Atado al scroll (no a tiempo), por eso rAF directo.
   Con prefers-reduced-motion o sin IntersectionObserver las capas quedan quietas. */
(function () {
  var banda = document.querySelector('.parallax');
  if (!banda) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  var capas = banda.querySelectorAll('.parallax-capa');
  if (!capas.length) return;
  var visible = false, pendiente = false;
  // Solo escucha scroll mientras la banda está en pantalla (ahorra trabajo)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) pedir();
    }, { threshold: 0 }).observe(banda);
  } else {
    visible = true;
  }
  function pintar() {
    pendiente = false;
    if (!visible) return;
    var rect = banda.getBoundingClientRect();
    // Progreso relativo del centro de la banda respecto al centro del viewport
    var centro = rect.top + rect.height / 2 - window.innerHeight / 2;
    Array.prototype.forEach.call(capas, function (capa) {
      var v = parseFloat(capa.dataset.veloc) || 0;
      capa.style.transform = 'translateY(' + (centro * v).toFixed(1) + 'px)';
    });
  }
  function pedir() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(pintar);
  }
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', pedir, { passive: true });
  pedir();
})();`,
};
