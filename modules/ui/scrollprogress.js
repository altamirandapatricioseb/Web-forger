// Barra de progreso de lectura: cinta fina arriba de todo que crece con el scroll.
// Solo JS de cliente; presente en todas las páginas. Útil sobre todo en páginas largas.
module.exports = {
  id: 'scrollprogress', type: 'ui', name: 'Progreso de lectura',
  description: 'Barra fina en el borde superior que indica cuánto se avanzó en la página. Presente en todas las páginas.',
  clientJs: () => `// Módulo progreso de lectura: barra fija arriba que refleja el % scrolleado.
(function () {
  var estilo = document.createElement('style');
  estilo.textContent = '#scroll-progress{position:fixed;top:0;left:0;height:3px;width:0;z-index:60;' +
    'background:var(--accent);transition:width .08s linear;pointer-events:none}';
  document.head.appendChild(estilo);
  var barra = document.createElement('div');
  barra.id = 'scroll-progress';
  barra.setAttribute('role', 'progressbar');
  barra.setAttribute('aria-label', 'Progreso de lectura');
  barra.setAttribute('aria-hidden', 'true');
  document.body.appendChild(barra);
  function actualizar() {
    var doc = document.documentElement;
    // Cuánto se puede scrollear en total (0 si la página entra en pantalla)
    var alcance = (doc.scrollHeight - doc.clientHeight);
    var pct = alcance > 0 ? (doc.scrollTop || window.pageYOffset || 0) / alcance * 100 : 0;
    if (pct < 0) pct = 0; else if (pct > 100) pct = 100;
    barra.style.width = pct + '%';
  }
  window.addEventListener('scroll', actualizar, { passive: true });
  window.addEventListener('resize', actualizar);
  actualizar();
})();`,
};
