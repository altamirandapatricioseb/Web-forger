const { REVEAL_KEYFRAMES } = require('../../src/motion');

// Animaciones de entrada con Motion. La VARIANTE (fundido, desenfoque, cortina, rotación,
// escala, costados, giro) se elige en el Builder — bloque "Movimiento y efectos", eje
// "Aparición al hacer scroll" — y de acá sale sólo el motor: los keyframes concretos viven
// en src/motion.js, que es también el catálogo que muestra el panel. Una sola fuente: si se
// agrega una variante allá, aparece en el panel y funciona acá sin tocar este archivo.
module.exports = {
  id: 'reveal', type: 'ui', name: 'Animaciones (Motion)',
  description: 'Entrada del hero en cascada, aparición de secciones y tarjetas al hacer scroll, y microinteracciones, con la librería Motion. La variante de aparición se elige en el Builder. Respeta la preferencia de menos movimiento.',
  clientJs: (cfg) => {
    const variante = (cfg.design && cfg.design.reveal) || 'fade';
    // Ojo con el `||`: la variante 'none' vale null a propósito, así que hay que preguntar
    // por la CLAVE y no por el valor, o 'none' terminaría animando como 'fade'.
    const conocida = Object.prototype.hasOwnProperty.call(REVEAL_KEYFRAMES, variante);
    const kf = conocida ? REVEAL_KEYFRAMES[variante] : REVEAL_KEYFRAMES.fade;
    // 'none' apaga la aparición al scroll pero deja la entrada del hero: el módulo sigue
    // siendo "el que anima la portada", que es por lo que se lo tilda.
    const apagado = !kf;
    return `/* Módulo Animaciones (Motion): entrada del hero, reveal al scroll y microinteracciones.
   Usa la librería Motion (window.Motion), servida como /js/motion.js. Sin ella —o con
   prefers-reduced-motion— no hace nada y el contenido queda visible y usable. El estado
   inicial (opacidad 0) se aplica sólo desde acá, nunca en el HTML: sin JS no se rompe nada.
   Las microinteracciones de hover/press viven en el CSS generado; acá va lo que Motion hace
   mejor: entrada en cascada y reveal al entrar en pantalla.
   Variante elegida en el Builder: ${variante}. */
(function () {
  var M = window.Motion;
  if (!M || !M.animate) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var animate = M.animate, inView = M.inView, stagger = M.stagger;
  var out = [0.22, 1, 0.36, 1];
  var slice = function (list) { return Array.prototype.slice.call(list); };
  // Keyframes de la variante elegida. Se copian por elemento porque la variante "costados"
  // invierte el signo en los pares, y mutar el objeto compartido afectaría a los siguientes.
  var KF = ${JSON.stringify(kf || REVEAL_KEYFRAMES.fade)};
  var alterna = ${variante === 'slide'};
  function kfPara(i) {
    if (!alterna) return KF;
    var copia = {};
    for (var k in KF) copia[k] = KF[k];
    if (i % 2 === 1) copia.x = [40, 0];
    return copia;
  }
  // Limpia los estilos inline que dejó la animación: el estado final es "como venía en el CSS"
  function limpiar(el) {
    el.style.opacity = '';
    el.style.transform = '';
    el.style.filter = '';
    el.style.clipPath = '';
  }

  // Navbar: baja suave al cargar
  var nav = document.querySelector('.navbar');
  if (nav) animate(nav, { opacity: [0, 1], y: [-14, 0] }, { duration: 0.5, ease: 'ease-out' });

  // Hero: título, bajada y CTA entran en cascada con la MISMA variante que el resto del
  // sitio. Se ocultan recién acá (no en el HTML); el script corre al final del body, antes
  // del primer paint, así no hay parpadeo.
  var hero = slice(document.querySelectorAll('.hero h1, .hero p, .hero .btn'));
  if (hero.length) {
    hero.forEach(function (el) { el.style.opacity = '0'; });
    hero.forEach(function (el, i) {
      animate(el, kfPara(i), { duration: 0.6, delay: 0.05 + i * 0.09, ease: out });
    });
    // Red de seguridad: pase lo que pase, el hero queda visible en < 1.5s. Nunca
    // dejamos contenido principal invisible si la animación no llegara a correr.
    setTimeout(function () { hero.forEach(function (el) { if (el.style.opacity === '0') limpiar(el); }); }, 1500);
  }
${apagado ? `
  // La variante elegida es "sin aparición": el reveal al scroll no se engancha.
})();` : `
  // Reveal al scroll: necesita IntersectionObserver. Si no está, no ocultamos nada
  // (el contenido queda visible tal cual).
  if (!('IntersectionObserver' in window) || !inView) return;
  var targets = slice(document.querySelectorAll('section h2, section .section-sub, .card'));
  var hidden = [];
  var lastParent = null, run = 0;
  targets.forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return; // ya visible al cargar
    el.style.opacity = '0';
    if (el.parentNode === lastParent) { run += 1; } else { run = 0; lastParent = el.parentNode; }
    el.__revealDelay = Math.min(run, 5) * 0.06;
    el.__revealIdx = hidden.length;
    hidden.push(el);
  });
  if (hidden.length) {
    inView(hidden, function (el) {
      var a = animate(el, kfPara(el.__revealIdx || 0),
        { duration: 0.55, delay: el.__revealDelay || 0, ease: out });
      // Al terminar, limpiar los estilos inline para no dejar rastros (estado final = visible)
      if (a && typeof a.then === 'function') a.then(function () { limpiar(el); });
      // sin retorno: Motion deja de observar el elemento (se anima una sola vez)
    }, { amount: 0.15 });
  }
})();`}`;
  },
};
