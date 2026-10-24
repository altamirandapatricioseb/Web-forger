module.exports = {
  id: 'stickynav', type: 'ui', name: 'Navbar inteligente al scroll',
  description: 'La barra de navegación se compacta y gana sombra al bajar, se oculta cuando el visitante baja y reaparece al subir. Da más espacio de lectura sin perder el menú a mano. Presente en todas las páginas.',
  // Sin html: sólo aporta comportamiento a la navbar ya existente (.navbar). Vanilla puro
  // con requestAnimationFrame; no necesita librerías y no rompe nada si el JS no corre.
  head: () => `  <style>
    .navbar{transition:transform .3s ease, box-shadow .25s ease}
    .navbar.nav-scrolled{box-shadow:0 4px 20px color-mix(in srgb, var(--primary) 12%, transparent)}
    .navbar.nav-scrolled .container{height:54px}
    .navbar.nav-hidden{transform:translateY(-100%)}
    @media (prefers-reduced-motion: reduce){.navbar.nav-hidden{transform:none}}
  </style>`,
  clientJs: () => `// Módulo navbar inteligente: agrega/quita clases según el scroll. Se compacta pasados
// unos px (sombra + menos alto) y se oculta al bajar, reaparece al subir. Con "menos
// movimiento" no se oculta (el CSS neutraliza el translate). Sin JS, la navbar queda normal.
// El toggle es directo (sin requestAnimationFrame): son solo clases, cuesta poco, y así
// funciona igual aunque la pestaña esté en segundo plano (donde rAF se pausa).
(function () {
  var nav = document.querySelector('.navbar');
  if (!nav) return;
  var ultimo = window.pageYOffset || 0;
  function actualizar() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (y > 8) nav.classList.add('nav-scrolled'); else nav.classList.remove('nav-scrolled');
    // Oculta al bajar (más allá de 200px) y muestra al subir
    if (y > ultimo && y > 200) nav.classList.add('nav-hidden');
    else nav.classList.remove('nav-hidden');
    ultimo = y;
  }
  window.addEventListener('scroll', actualizar, { passive: true });
  actualizar();
})();`,
};
