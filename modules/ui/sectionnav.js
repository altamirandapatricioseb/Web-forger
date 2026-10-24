// Navegación por puntos (scrollspy): un riel vertical de puntos a la derecha que marca
// la sección visible y salta a ella con scroll suave al hacer clic. Se arma solo a partir
// de las <section id="…"> de la página, así que crece con los módulos activos. No aporta
// HTML propio: si hay menos de 3 secciones o la pantalla es chica, no aparece. Con
// prefers-reduced-motion el salto es instantáneo (sin scroll suave).
module.exports = {
  id: 'sectionnav', type: 'ui', name: 'Navegación por puntos',
  description: 'Riel vertical de puntos a un costado que resalta la sección visible y lleva a ella con scroll suave. Se genera solo desde las secciones de la página; ideal para páginas largas.',
  head: () => `  <style>
    .dotnav{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:40;display:flex;flex-direction:column;gap:14px}
    .dotnav button{position:relative;width:12px;height:12px;padding:0;border:2px solid var(--muted);border-radius:50%;background:transparent;cursor:pointer;transition:background .2s,border-color .2s,transform .2s}
    .dotnav button:hover{border-color:var(--accent);transform:scale(1.2)}
    .dotnav button.activo{background:var(--accent);border-color:var(--accent)}
    .dotnav button span{position:absolute;right:22px;top:50%;transform:translateY(-50%);white-space:nowrap;background:var(--text);color:var(--bg);font-size:.75rem;padding:3px 9px;border-radius:6px;opacity:0;pointer-events:none;transition:opacity .2s}
    .dotnav button:hover span,.dotnav button:focus-visible span{opacity:1}
    @media (max-width:900px){.dotnav{display:none}}
  </style>`,
  clientJs: () => `/* Módulo navegación por puntos: arma un riel de puntos desde las <section id> de la
   página y marca la visible al scrollear (IntersectionObserver). Sin JS no aparece nada:
   es una ayuda de navegación, no contenido. */
(function () {
  var secciones = Array.prototype.slice.call(document.querySelectorAll('section[id]'));
  // Sólo tiene sentido en páginas largas: con menos de 3 secciones no se muestra
  if (secciones.length < 3) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = document.createElement('nav');
  nav.className = 'dotnav';
  nav.setAttribute('aria-label', 'Secciones de la página');
  var puntos = secciones.map(function (sec) {
    // Etiqueta: el primer encabezado de la sección, o el id como respaldo
    var h = sec.querySelector('h1,h2,h3');
    var texto = (h ? h.textContent : sec.id).trim();
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Ir a ' + texto);
    b.innerHTML = '<span>' + texto.replace(/</g, '&lt;') + '</span>';
    b.addEventListener('click', function () {
      sec.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
    nav.appendChild(b);
    return b;
  });
  document.body.appendChild(nav);
  function marcar(idx) {
    puntos.forEach(function (p, i) { p.classList.toggle('activo', i === idx); });
  }
  if ('IntersectionObserver' in window) {
    var visibles = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        visibles[secciones.indexOf(e.target)] = e.isIntersecting ? e.intersectionRatio : 0;
      });
      // La sección con mayor porción visible manda
      var mejor = -1, max = 0;
      for (var k in visibles) { if (visibles[k] > max) { max = visibles[k]; mejor = +k; } }
      if (mejor >= 0) marcar(mejor);
    }, { threshold: [0.15, 0.5, 0.85] });
    secciones.forEach(function (s) { observer.observe(s); });
  }
  marcar(0);
})();`,
};
