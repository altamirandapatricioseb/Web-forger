const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'breadcrumbs', type: 'ui', name: 'Miga de pan',
  description: 'Breadcrumb automático bajo la navbar en todas las páginas internas (Inicio › Página actual), con marcado accesible.',
  clientJs: () => `/* Módulo miga de pan: se arma sola con el título de la página activa. */
(function () {
  var path = location.pathname;
  // La Home no lleva miga: es el punto de partida
  if (path === '/' || /(^|\\/)index\\.html$/.test(path)) return;
  var navbar = document.querySelector('.navbar');
  if (!navbar) return;
  var style = document.createElement('style');
  style.textContent = '.breadcrumbs{border-bottom:1px solid var(--line);font-size:.85rem;color:var(--muted)}' +
    '.breadcrumbs .container{padding-top:9px;padding-bottom:9px}' +
    '.breadcrumbs a{color:var(--muted);text-decoration:none}' +
    '.breadcrumbs a:hover{color:var(--accent)}' +
    '.breadcrumbs [aria-current]{color:var(--text);font-weight:600}';
  document.head.appendChild(style);
  // El <title> del layout es "Página — Marca"; la miga usa solo la primera parte
  var titulo = (document.title.split(' — ')[0] || 'Página').trim();
  var bc = document.createElement('nav');
  bc.className = 'breadcrumbs';
  bc.setAttribute('aria-label', 'Miga de pan');
  bc.innerHTML = '<div class="container"><a href="/index.html">Inicio</a> <span aria-hidden="true" style="display:inline-flex;vertical-align:-2px">${phIcon('caret-right', { size: 12 })}</span> ' +
    '<span aria-current="page">' + App.esc(titulo) + '</span></div>';
  navbar.insertAdjacentElement('afterend', bc);
})();`,
};
