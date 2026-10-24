// Carga diferida de imágenes: marca todas las <img> del sitio con loading="lazy" y
// decoding="async" (para que el navegador no las descargue hasta que hagan falta) y
// les agrega un fundido de entrada al aparecer en pantalla. Es puro comportamiento:
// no aporta HTML ni sección, mejora el rendimiento de cualquier página con imágenes.
// Las imágenes que no deban diferirse se marcan con data-nolazy en el HTML.
module.exports = {
  id: 'lazyload', type: 'ui', name: 'Carga diferida de imágenes',
  description: 'Difiere la descarga de las imágenes (loading="lazy") y las hace aparecer con un fundido suave al entrar en pantalla. Mejora el rendimiento; sin JS las imágenes se ven igual.',
  head: () => `  <style>
    /* Estado inicial sólo si el JS marcó la imagen: así, sin JS, nada queda oculto */
    img.lazy-img{opacity:0;transition:opacity .55s ease}
    img.lazy-img.lazy-lista{opacity:1}
    @media (prefers-reduced-motion: reduce){img.lazy-img{transition:none}}
  </style>`,
  clientJs: () => `/* Módulo carga diferida: aplica loading="lazy"/decoding="async" a las imágenes y
   les da un fundido de entrada con IntersectionObserver. Degrada sin romper: si no hay
   soporte, las muestra de una. Respeta "prefers-reduced-motion". */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Muestra la imagen (saca el estado oculto)
  function mostrar(img) { img.classList.add('lazy-lista'); }
  function preparar() {
    var imgs = document.querySelectorAll('img:not([data-nolazy])');
    if (!imgs.length) return;
    var soporta = 'IntersectionObserver' in window && !reduce;
    var obs = soporta ? new IntersectionObserver(function (entradas, o) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        mostrar(e.target);
        o.unobserve(e.target);
      });
    }, { rootMargin: '120px 0px' }) : null;
    imgs.forEach(function (img) {
      // Hint al navegador para que difiera la descarga y decodifique en segundo plano
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (!obs) return; // sin soporte o con menos movimiento: se ven tal cual, sin fundido
      img.classList.add('lazy-img');
      // Si ya está cargada (caché) y visible, no la ocultamos con fundido innecesario
      if (img.complete && img.naturalWidth > 0) { mostrar(img); return; }
      obs.observe(img);
    });
    // Red de seguridad: si algo queda sin dispararse, muéstralas a los 3s
    setTimeout(function () {
      document.querySelectorAll('img.lazy-img:not(.lazy-lista)').forEach(mostrar);
    }, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', preparar);
  else preparar();
})();`,
};
