module.exports = {
  id: 'galleryfilters', type: 'ui', name: 'Filtros de galería',
  description: 'Tabs de categorías arriba de la galería que filtran las tarjetas, estilo portfolio. Las categorías salen del data-cat de cada tarjeta.',
  // Sin galería no hay nada que filtrar: el generador la agrega sola si falta
  requires: ['gallery'],
  clientJs: () => `/* Módulo filtros de galería: arma las tabs con las categorías (data-cat) que
   encuentra en las tarjetas y filtra al hacer clic. Sin JS la galería se ve completa. */
(function () {
  var grid = document.querySelector('#galeria .grid');
  if (!grid) return;
  var tarjetas = grid.querySelectorAll('[data-cat]');
  if (!tarjetas.length) return;
  // Categorías únicas en orden de aparición
  var cats = [];
  Array.prototype.forEach.call(tarjetas, function (t) {
    if (cats.indexOf(t.dataset.cat) < 0) cats.push(t.dataset.cat);
  });
  // Con una sola categoría las tabs no aportan nada
  if (cats.length < 2) return;
  var style = document.createElement('style');
  style.textContent = '.galeria-filtros{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}' +
    '.galeria-filtros button{width:auto;padding:7px 16px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--text);font:inherit;font-size:.9rem;cursor:pointer}' +
    '.galeria-filtros button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:white}';
  document.head.appendChild(style);
  var barra = document.createElement('div');
  barra.className = 'galeria-filtros';
  barra.setAttribute('role', 'group');
  barra.setAttribute('aria-label', 'Filtrar galería por categoría');
  ['Todos'].concat(cats).forEach(function (cat) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = cat;
    b.setAttribute('aria-pressed', cat === 'Todos' ? 'true' : 'false');
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(barra.children, function (o) { o.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      Array.prototype.forEach.call(tarjetas, function (t) {
        t.style.display = cat === 'Todos' || t.dataset.cat === cat ? '' : 'none';
      });
    });
    barra.appendChild(b);
  });
  grid.parentNode.insertBefore(barra, grid);
})();`,
  readmeNotes: () => [
    '**Filtros de galería**: las categorías salen del atributo `data-cat` de cada tarjeta de la sección `#galeria`; renombralas o agregá nuevas editando esos atributos en `public/index.html` (las tabs se arman solas).',
  ],
};
