const { esc } = require('../../src/templates');

// Catálogo filtrable de productos/servicios: grilla de tarjetas con filtro por categoría
// (chips que se arman solos desde data-cat) y buscador en vivo que filtra por título y
// descripción. Frontend puro, sin backend ni API keys: los productos se editan en el HTML.
// La entrada de las tarjetas se anima en cascada con Anime.js (con red de seguridad si el
// loop está pausado) y respeta "prefers-reduced-motion". Mejora progresiva: sin JS se ve
// la grilla completa y sigue siendo navegable.
const PRODUCTOS = [
  { cat: 'Diseño', titulo: 'Identidad de marca', precio: 'Desde $300', desc: 'Logo, paleta y guía de estilo para tu negocio.' },
  { cat: 'Diseño', titulo: 'Diseño de sitio web', precio: 'Desde $500', desc: 'Diseño a medida, responsive y orientado a conversión.' },
  { cat: 'Desarrollo', titulo: 'Tienda online', precio: 'Desde $900', desc: 'Catálogo, carrito y medios de pago listos para vender.' },
  { cat: 'Desarrollo', titulo: 'Landing page', precio: 'Desde $250', desc: 'Página única, rápida y optimizada para campañas.' },
  { cat: 'Marketing', titulo: 'Gestión de redes', precio: 'Desde $200/mes', desc: 'Contenido y calendario mensual para tus redes.' },
  { cat: 'Marketing', titulo: 'Campaña de ads', precio: 'Desde $150/mes', desc: 'Publicidad segmentada en Google y redes sociales.' },
];

module.exports = {
  id: 'catalogo', type: 'ui', name: 'Catálogo filtrable',
  description: 'Grilla de productos/servicios con filtro por categoría y buscador en vivo. Frontend puro (datos editables en el HTML), con entrada animada con Anime.js.',
  usesAnime: true,
  html: () => {
    const tarjetas = PRODUCTOS.map(p => `        <article class="card catalogo-item" data-cat="${esc(p.cat)}">
          <span class="catalogo-tag">${esc(p.cat)}</span>
          <h3 style="margin:.3rem 0 .2rem">${esc(p.titulo)}</h3>
          <p class="price" style="font-size:1.1rem">${esc(p.precio)}</p>
          <p class="muted" style="margin:.4rem 0 0">${esc(p.desc)}</p>
        </article>`).join('\n');
    return `  <section id="catalogo">
    <div class="container">
      <h2>Nuestro catálogo</h2>
      <p class="section-sub">Filtrá por categoría o buscá lo que necesitás.</p>
      <div class="catalogo-controles">
        <div class="catalogo-chips" id="catalogo-chips" role="group" aria-label="Filtrar por categoría"></div>
        <input type="search" id="catalogo-buscar" placeholder="Buscar en el catálogo…" aria-label="Buscar en el catálogo" autocomplete="off">
      </div>
      <div class="grid cols-3" id="catalogo-grid">
${tarjetas}
      </div>
      <p class="muted" id="catalogo-vacio" hidden>No encontramos resultados. Probá con otra búsqueda.</p>
    </div>
  </section>`;
  },
  head: () => `  <style>
    .catalogo-controles{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;margin:0 0 24px}
    .catalogo-chips{display:flex;flex-wrap:wrap;gap:8px}
    .catalogo-chips button{width:auto;padding:7px 16px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--text);font:inherit;font-size:.9rem;cursor:pointer}
    .catalogo-chips button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
    #catalogo-buscar{max-width:280px}
    .catalogo-item{position:relative}
    .catalogo-tag{display:inline-block;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);font-weight:700}
  </style>`,
  clientJs: () => `/* Módulo catálogo filtrable: chips de categoría (armados desde data-cat) + búsqueda
   en vivo por título y descripción. Los productos se editan en la sección #catalogo del
   HTML. Sin JS la grilla se ve completa. */
(function () {
  var grid = document.getElementById('catalogo-grid');
  if (!grid) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var items = Array.prototype.slice.call(grid.querySelectorAll('.catalogo-item'));
  var chips = document.getElementById('catalogo-chips');
  var buscar = document.getElementById('catalogo-buscar');
  var vacio = document.getElementById('catalogo-vacio');
  var catActiva = 'Todos';

  // Categorías únicas en orden de aparición
  var cats = [];
  items.forEach(function (it) { var c = it.dataset.cat; if (c && cats.indexOf(c) < 0) cats.push(c); });
  ['Todos'].concat(cats).forEach(function (c) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = c;
    b.setAttribute('aria-pressed', c === 'Todos' ? 'true' : 'false');
    b.addEventListener('click', function () {
      catActiva = c;
      Array.prototype.forEach.call(chips.children, function (o) { o.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      aplicar();
    });
    chips.appendChild(b);
  });

  function aplicar() {
    var q = (buscar && buscar.value ? buscar.value : '').trim().toLowerCase();
    var visibles = 0;
    items.forEach(function (it) {
      var okCat = catActiva === 'Todos' || it.dataset.cat === catActiva;
      var okTexto = !q || it.textContent.toLowerCase().indexOf(q) >= 0;
      var mostrar = okCat && okTexto;
      it.style.display = mostrar ? '' : 'none';
      if (mostrar) visibles++;
    });
    if (vacio) vacio.hidden = visibles > 0;
  }

  if (buscar) buscar.addEventListener('input', aplicar);

  // Entrada en cascada de las tarjetas la primera vez que se ven
  var anime = window.anime;
  if (anime && anime.animate && !reduce) {
    anime.animate(items, { opacity: [0, 1], translateY: [18, 0], duration: 500, delay: anime.stagger ? anime.stagger(70) : 0, ease: 'outQuad' });
    // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
    setTimeout(function () { items.forEach(function (it) { it.style.opacity = '1'; it.style.transform = ''; }); }, 1200);
  }
})();`,
  readmeNotes: () => [
    '**Catálogo filtrable**: los productos y sus categorías se editan en la constante `PRODUCTOS` de `modules/ui/catalogo.js` (afecta el HTML generado). En el sitio, los chips de filtro se arman solos desde el `data-cat` de cada tarjeta y el buscador filtra por título y descripción.',
  ],
};
