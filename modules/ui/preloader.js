module.exports = {
  id: 'preloader', type: 'ui', name: 'Pantalla de carga',
  description: 'Pantalla de bienvenida a pantalla completa con el nombre de marca y un spinner que se desvanece cuando la página terminó de cargar. El logo entra animado con Anime.js. Presente en todas las páginas.',
  usesAnime: true,
  // La animación del logo la hace Anime.js; el spinner y la red de seguridad son CSS puro,
  // así el overlay SIEMPRE se va aunque el JS no corra (nunca deja el sitio tapado).
  html: (cfg) => `  <div class="preloader" data-preloader role="status" aria-label="Cargando">
    <div class="preloader-box">
      <span class="preloader-logo" data-preloader-logo>${require('../../src/templates').esc(cfg.brand.name)}<span>.</span></span>
      <span class="preloader-spin" aria-hidden="true"></span>
    </div>
  </div>`,
  head: () => `  <style>
    .preloader{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:var(--bg);
      animation:preloader-red 0.6s ease 3s forwards}
    .preloader-box{display:flex;flex-direction:column;align-items:center;gap:20px}
    .preloader-logo{font-weight:800;font-size:1.7rem;letter-spacing:-.02em;color:var(--text)}
    .preloader-logo span{color:var(--accent)}
    .preloader-spin{width:34px;height:34px;border-radius:50%;border:3px solid var(--line);border-top-color:var(--accent);animation:preloader-giro .8s linear infinite}
    .preloader.oculto{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .45s ease, visibility .45s ease}
    @keyframes preloader-giro{to{transform:rotate(360deg)}}
    /* Red de seguridad SIN JS: pase lo que pase, el overlay se oculta antes de los 4s */
    @keyframes preloader-red{to{opacity:0;visibility:hidden;pointer-events:none}}
    @media (prefers-reduced-motion: reduce){.preloader-spin{animation-duration:1.6s}}
  </style>`,
  clientJs: () => `// Módulo pantalla de carga: oculta el overlay cuando la página cargó y anima el
// logo con Anime.js (window.anime) si la librería está disponible. Sin JS, la
// red de seguridad de CSS igual lo desvanece: el contenido nunca queda tapado.
(function () {
  var pl = document.querySelector('[data-preloader]');
  if (!pl) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var anime = window.anime;
  // Entrada del logo con Anime.js (opacidad + escala). Es puro adorno: si no está, no pasa nada
  if (anime && anime.animate && !reduce) {
    var logo = pl.querySelector('[data-preloader-logo]');
    if (logo) anime.animate(logo, { opacity: [0, 1], scale: [0.82, 1], duration: 650 });
  }
  function ocultar() {
    if (!pl) return;
    pl.style.animation = 'none';   // cancela la red de seguridad CSS para controlar el fundido acá
    pl.classList.add('oculto');
    setTimeout(function () { if (pl && pl.parentNode) pl.parentNode.removeChild(pl); pl = null; }, 500);
  }
  // Se va cuando la página terminó de cargar; si ya está lista, en el próximo tick
  if (document.readyState === 'complete') { setTimeout(ocultar, 250); }
  else { window.addEventListener('load', function () { setTimeout(ocultar, 200); }); }
  // Red de seguridad JS: no dejar el overlay más de 3s aunque 'load' nunca dispare
  setTimeout(ocultar, 3000);
})();`,
};
