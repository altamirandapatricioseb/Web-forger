// Tienda: el catálogo con el que se compra de verdad. Hasta acá había dos cosas y ninguna servía:
// `/catalog.html` (módulo Carrito) era una grilla pelada sin filtros ni buscador, y el módulo UI
// "catálogo filtrable" filtra bien pero sobre productos HORNEADOS EN EL HTML — no lee el catálogo
// real, así que el negocio no puede tocarlo sin regenerar. Cualquier tienda con más de veinte
// productos necesita lo que faltaba: buscar, filtrar por categoría, marca y precio, ordenar y
// paginar.
//
// La decisión que lo define: TODO SE RESUELVE EN EL SERVIDOR (`GET /api/products/buscar`). Filtrar
// en el navegador obliga a bajar el catálogo entero en cada visita — con 40 productos no se nota y
// con 4.000 el sitio no abre en un teléfono. El navegador manda qué quiere ver; el servidor manda
// qué hay.
//
// Tres detalles que separan esto de "una grilla con un input":
//   1. LA URL GUARDA LA BÚSQUEDA. Los filtros viajan en el query string, así que el resultado se
//      puede compartir, se puede volver con el botón "atrás" y se puede anunciar un filtro concreto
//      ("/tienda.html?cat=Ofertas"). Un buscador cuyo estado vive sólo en memoria pierde las tres.
//   2. LAS FACETAS SE CALCULAN SOBRE TODO EL CATÁLOGO, no sobre el resultado ya filtrado: si se
//      recalcularan sobre lo filtrado, elegir una categoría haría desaparecer todas las demás del
//      desplegable y no habría forma de cambiar de idea sin recargar.
//   3. EL BUSCADOR ESPERA A QUE TERMINES DE ESCRIBIR (350 ms) y descarta las respuestas que
//      llegan fuera de orden: sin eso, escribir rápido deja en pantalla el resultado de "rem"
//      cuando ya escribiste "remera".
//
// Cada tarjeta enlaza a la ficha del producto (`/producto/<slug>`) y agrega al carrito con
// `window.WFCart`, el punto de entrada del módulo Carrito. Animado con Anime.js + red de seguridad.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'tienda', type: 'functional', name: 'Tienda con filtros y buscador',
  description: 'La página de compra de verdad, en /tienda.html: buscador por texto, filtros por categoría, marca y rango de precio, "solo con stock", orden (destacados, precio, nombre, novedades) y paginación — todo RESUELTO EN EL SERVIDOR, así el navegador no tiene que bajarse el catálogo entero. Los filtros viajan en la URL, con lo que el resultado se puede compartir, volver con el botón atrás y anunciar. Cada tarjeta muestra la foto, el precio (con el anterior tachado si hay oferta) y la disponibilidad real, enlaza a la ficha del producto y agrega al carrito con window.WFCart. Animado con Anime.js.',
  usesAnime: true,
  requires: ['products-admin', 'cart'],
  nav: () => [{ label: 'Tienda', href: '/tienda.html' }],
  head: () => `  <style>
    .ti-layout{display:grid;grid-template-columns:230px minmax(0,1fr);gap:32px;align-items:start;margin-top:26px}
    @media (max-width:820px){.ti-layout{grid-template-columns:1fr;gap:20px}}
    .ti-filtros{position:sticky;top:88px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);padding:18px}
    @media (max-width:820px){.ti-filtros{position:static}}
    .ti-filtros h3{margin:0 0 4px;font-size:.95rem}
    .ti-filtros label{font-size:.83rem;margin-top:13px}
    .ti-filtros input,.ti-filtros select{margin-bottom:0}
    .ti-precio-rango{display:flex;gap:8px;align-items:center}
    .ti-precio-rango input{width:100%}
    .ti-top{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;margin-bottom:16px}
    .ti-buscar{flex:1;min-width:220px}
    .ti-buscar input{margin:0}
    .ti-orden{min-width:180px}
    .ti-orden select{margin:0}
    .ti-cuenta{font-size:.86rem;color:var(--muted);margin:0 0 14px}
    .ti-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:20px}
    .ti-card{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);overflow:hidden;display:flex;flex-direction:column}
    .ti-foto{aspect-ratio:1/1;background:color-mix(in srgb,var(--text) 5%,var(--bg));display:block;position:relative}
    .ti-foto img{width:100%;height:100%;object-fit:cover;display:block}
    .ti-foto .ti-vacia{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.78rem}
    .ti-off{position:absolute;top:9px;left:9px;background:var(--accent);color:#fff;font-size:.72rem;font-weight:700;padding:2px 9px;border-radius:999px}
    .ti-agotado{position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 72%,transparent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.86rem}
    .ti-cuerpo{padding:13px 15px;display:flex;flex-direction:column;gap:5px;flex:1}
    .ti-cuerpo a.ti-nombre{color:inherit;text-decoration:none;font-weight:600;line-height:1.3}
    .ti-cuerpo a.ti-nombre:hover{color:var(--accent)}
    .ti-cat{font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
    .ti-precio{font-weight:700;font-variant-numeric:tabular-nums;margin-top:auto}
    .ti-antes{text-decoration:line-through;color:var(--muted);font-weight:400;font-size:.85rem;margin-left:7px}
    .ti-card .btn{width:calc(100% - 30px);margin:0 15px 15px}
    .ti-pag{display:flex;gap:8px;justify-content:center;align-items:center;margin-top:30px;flex-wrap:wrap}
    .ti-pag button{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:7px 13px;cursor:pointer;font:inherit;color:inherit}
    .ti-pag button[aria-current="true"]{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:700}
    .ti-pag button:disabled{opacity:.45;cursor:default}
    .ti-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
    .ti-chips button{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:4px 13px;font-size:.83rem;cursor:pointer;font:inherit;color:inherit}
    .ti-vacio{text-align:center;padding:48px 20px;color:var(--muted)}
  </style>`,
  pages: () => ({
    tienda: {
      title: 'Tienda',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('shopping-cart', { size: 24, style: 'vertical-align:-5px;margin-right:10px' })}Tienda</h2>
      <p class="section-sub">Buscá, filtrá y comprá. Los filtros quedan en la dirección de la página: podés compartir o guardar el resultado.</p>

      <div class="ti-layout">
        <aside class="ti-filtros">
          <h3>Filtros</h3>
          <label for="ti-cat">Categoría</label>
          <select id="ti-cat"><option value="">Todas</option></select>
          <label for="ti-marca">Marca</label>
          <select id="ti-marca"><option value="">Todas</option></select>
          <label for="ti-min">Precio</label>
          <div class="ti-precio-rango">
            <input id="ti-min" type="number" min="0" step="1" placeholder="Desde" aria-label="Precio desde">
            <span class="muted">—</span>
            <input id="ti-max" type="number" min="0" step="1" placeholder="Hasta" aria-label="Precio hasta">
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin-top:15px"><input type="checkbox" id="ti-stock" style="width:auto;margin:0"> Solo con stock</label>
          <button class="btn ghost" type="button" id="ti-limpiar" style="width:100%;margin-top:16px">Limpiar filtros</button>
        </aside>

        <div>
          <div class="ti-top">
            <div class="ti-buscar">
              <label for="ti-q">Buscar</label>
              <input id="ti-q" type="search" placeholder="Nombre, código, categoría…" autocomplete="off">
            </div>
            <div class="ti-orden">
              <label for="ti-orden">Ordenar por</label>
              <select id="ti-orden">
                <option value="destacados">Destacados</option>
                <option value="precio-asc">Precio: de menor a mayor</option>
                <option value="precio-desc">Precio: de mayor a menor</option>
                <option value="nuevos">Más nuevos</option>
                <option value="nombre">Nombre (A-Z)</option>
              </select>
            </div>
          </div>
          <div class="ti-chips" id="ti-chips"></div>
          <p class="ti-cuenta" id="ti-cuenta">Cargando…</p>
          <div class="ti-grid" id="ti-grid"></div>
          <div class="ti-pag" id="ti-pag"></div>
        </div>
      </div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo tienda: catálogo con filtros, buscador, orden y paginación. El filtrado NO se hace acá:
   el servidor resuelve /api/products/buscar y devuelve sólo la página pedida. Bajar el catálogo
   entero para filtrarlo en el navegador funciona con 40 productos y hace que el sitio no abra con
   4.000. Los filtros viven en la URL para que el resultado se pueda compartir y para que el botón
   "atrás" funcione. Anime.js para la aparición de la grilla + red de seguridad. */
(function () {
  var grid = document.getElementById('ti-grid');
  if (!grid) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var els = {
    q: document.getElementById('ti-q'),
    cat: document.getElementById('ti-cat'),
    marca: document.getElementById('ti-marca'),
    min: document.getElementById('ti-min'),
    max: document.getElementById('ti-max'),
    stock: document.getElementById('ti-stock'),
    orden: document.getElementById('ti-orden'),
    cuenta: document.getElementById('ti-cuenta'),
    pag: document.getElementById('ti-pag'),
    chips: document.getElementById('ti-chips'),
  };
  var pagina = 1;
  // Cada consulta lleva su número: si vuelve una vieja después de una nueva, se descarta. Sin esto,
  // escribir rápido deja en pantalla el resultado de "rem" cuando ya escribiste "remera".
  var pedidoNro = 0;

  function estadoDesdeUrl() {
    var p = new URLSearchParams(location.search);
    els.q.value = p.get('q') || '';
    els.cat.value = p.get('cat') || '';
    els.marca.value = p.get('marca') || '';
    els.min.value = p.get('min') || '';
    els.max.value = p.get('max') || '';
    els.stock.checked = p.get('stock') === '1';
    els.orden.value = p.get('orden') || 'destacados';
    pagina = Math.max(1, Number(p.get('pagina')) || 1);
  }

  function paramsActuales() {
    var p = new URLSearchParams();
    if (els.q.value.trim()) p.set('q', els.q.value.trim());
    if (els.cat.value) p.set('cat', els.cat.value);
    if (els.marca.value) p.set('marca', els.marca.value);
    if (els.min.value) p.set('min', els.min.value);
    if (els.max.value) p.set('max', els.max.value);
    if (els.stock.checked) p.set('stock', '1');
    if (els.orden.value && els.orden.value !== 'destacados') p.set('orden', els.orden.value);
    if (pagina > 1) p.set('pagina', String(pagina));
    return p;
  }

  function guardarEnUrl(reemplazar) {
    var p = paramsActuales();
    var url = location.pathname + (p.toString() ? '?' + p.toString() : '');
    try {
      if (reemplazar) history.replaceState(null, '', url);
      else history.pushState(null, '', url);
    } catch (e) {}
  }

  function aparecer(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [12, 0], duration: 380, delay: anime.stagger ? anime.stagger(30) : 0, ease: 'outCubic' });
    // Red de seguridad: con la pestaña oculta el loop de Anime no corre y las tarjetas quedarían
    // invisibles, que es peor que no animar
    setTimeout(function () {
      Array.prototype.forEach.call(nodos, function (n) { n.style.opacity = 1; n.style.transform = 'none'; });
    }, 900);
  }

  function pintarFacetas(d) {
    // Las opciones se recalculan sólo si cambiaron: repintar el <select> en cada búsqueda le
    // borraría la selección al usuario justo cuando está eligiendo
    function llenar(sel, valores, etiqueta) {
      var actual = sel.value;
      var firma = valores.join('|');
      if (sel.dataset.firma === firma) return;
      sel.dataset.firma = firma;
      sel.innerHTML = '<option value="">' + etiqueta + '</option>' +
        valores.map(function (v) { return '<option value="' + App.esc(v) + '">' + App.esc(v) + '</option>'; }).join('');
      sel.value = actual;
    }
    llenar(els.cat, d.categorias || [], 'Todas');
    llenar(els.marca, d.marcas || [], 'Todas');
    if (!els.min.placeholder.match(/\\d/) && d.precioMin) {
      els.min.placeholder = 'Desde ' + Math.floor(d.precioMin);
      els.max.placeholder = 'Hasta ' + Math.ceil(d.precioMax);
    }
  }

  function pintarChips() {
    var activos = [];
    if (els.q.value.trim()) activos.push(['q', 'Búsqueda: ' + els.q.value.trim()]);
    if (els.cat.value) activos.push(['cat', els.cat.value]);
    if (els.marca.value) activos.push(['marca', els.marca.value]);
    if (els.min.value) activos.push(['min', 'Desde ' + App.money(els.min.value)]);
    if (els.max.value) activos.push(['max', 'Hasta ' + App.money(els.max.value)]);
    if (els.stock.checked) activos.push(['stock', 'Solo con stock']);
    els.chips.innerHTML = activos.map(function (a) {
      return '<button type="button" data-ti-quita="' + a[0] + '">' + App.esc(a[1]) + ' ×</button>';
    }).join('');
    els.chips.querySelectorAll('[data-ti-quita]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-ti-quita');
        if (k === 'stock') els.stock.checked = false;
        else els[k].value = '';
        pagina = 1;
        buscar();
      });
    });
  }

  function tarjeta(p, i) {
    var d = p.disponibilidad || { comprable: true };
    // Las primeras tarjetas NO se difieren: son las que están sobre el pliegue, así que la foto de
    // una de ellas es el elemento más grande de la pantalla (el LCP que mide Google). Diferir una
    // imagen que ya está a la vista sólo consigue que la página tarde más en verse terminada.
    var carga = i < 4 ? (i === 0 ? ' fetchpriority="high"' : '') : ' loading="lazy"';
    var foto = (p.images && p.images[0])
      ? '<img src="' + App.esc(p.images[0].url) + '" alt="' + App.esc(p.images[0].alt || p.name) + '"' + carga + '>'
      : '<span class="ti-vacia">sin imagen</span>';
    var off = (p.compareAt && p.compareAt > p.price)
      ? '<span class="ti-off">' + Math.round((1 - p.price / p.compareAt) * 100) + '% OFF</span>' : '';
    var agotado = d.comprable ? '' : '<span class="ti-agotado">Sin stock</span>';
    var url = '/producto/' + encodeURIComponent(p.slug || '');
    return '<div class="ti-card">' +
      (p.slug ? '<a class="ti-foto" href="' + url + '">' : '<span class="ti-foto">') + foto + off + agotado + (p.slug ? '</a>' : '</span>') +
      '<div class="ti-cuerpo">' +
        (p.category ? '<span class="ti-cat">' + App.esc(p.category) + '</span>' : '') +
        (p.slug ? '<a class="ti-nombre" href="' + url + '">' + App.esc(p.name) + '</a>' : '<span class="ti-nombre">' + App.esc(p.name) + '</span>') +
        '<span class="ti-precio">' + App.money(p.price) +
          (p.compareAt && p.compareAt > p.price ? '<span class="ti-antes">' + App.money(p.compareAt) + '</span>' : '') + '</span>' +
      '</div>' +
      (d.comprable
        ? '<button class="btn" type="button" data-ti-add="' + p.id + '">Agregar</button>'
        : '<button class="btn ghost" type="button" disabled aria-disabled="true">Sin stock</button>') +
      '</div>';
  }

  function pintarPaginas(d) {
    if (d.paginas <= 1) { els.pag.innerHTML = ''; return; }
    var botones = [];
    botones.push('<button type="button" data-ti-pag="' + (d.pagina - 1) + '"' + (d.pagina <= 1 ? ' disabled' : '') + '>Anterior</button>');
    // Con muchas páginas se muestran sólo las cercanas: 40 botones no ayudan a nadie
    for (var i = 1; i <= d.paginas; i++) {
      if (d.paginas > 7 && Math.abs(i - d.pagina) > 2 && i !== 1 && i !== d.paginas) {
        if (Math.abs(i - d.pagina) === 3) botones.push('<span class="muted">…</span>');
        continue;
      }
      botones.push('<button type="button" data-ti-pag="' + i + '" aria-current="' + (i === d.pagina) + '">' + i + '</button>');
    }
    botones.push('<button type="button" data-ti-pag="' + (d.pagina + 1) + '"' + (d.pagina >= d.paginas ? ' disabled' : '') + '>Siguiente</button>');
    els.pag.innerHTML = botones.join('');
    els.pag.querySelectorAll('[data-ti-pag]').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = Number(b.getAttribute('data-ti-pag'));
        if (!n || b.disabled) return;
        pagina = n;
        buscar();
        window.scrollTo({ top: grid.offsetTop - 90, behavior: reduce ? 'auto' : 'smooth' });
      });
    });
  }

  function pintar(d) {
    pintarFacetas(d);
    pintarChips();
    if (!d.rows.length) {
      els.cuenta.textContent = '';
      grid.innerHTML = '<div class="ti-vacio"><p>No encontramos productos con esos filtros.</p>' +
        '<button class="btn ghost" type="button" id="ti-vacio-limpiar" style="width:auto">Limpiar filtros</button></div>';
      var lb = document.getElementById('ti-vacio-limpiar');
      if (lb) lb.addEventListener('click', limpiar);
      els.pag.innerHTML = '';
      return;
    }
    els.cuenta.textContent = d.total === 1 ? '1 producto' :
      d.total + ' productos' + (d.paginas > 1 ? ' · página ' + d.pagina + ' de ' + d.paginas : '');
    grid.innerHTML = d.rows.map(tarjeta).join('');
    grid.querySelectorAll('[data-ti-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (window.__PREVIEW__) { App.toast('Vista previa: se agregaría al carrito'); return; }
        if (!window.WFCart) { App.toast('El carrito no está disponible'); return; }
        window.WFCart.agregar(b.getAttribute('data-ti-add'), 1);
        App.toast('Agregado al carrito');
      });
    });
    pintarPaginas(d);
    aparecer(grid.querySelectorAll('.ti-card'));
  }

  var DEMO = {
    total: 3, pagina: 1, paginas: 1,
    categorias: ['General', 'Especiales'], marcas: [], precioMin: 4999, precioMax: 14999,
    rows: [
      { id: 'd1', name: 'Producto Clásico', slug: 'producto-clasico', category: 'General', price: 4999, compareAt: 0, images: [], disponibilidad: { comprable: true } },
      { id: 'd2', name: 'Producto Premium', slug: 'producto-premium', category: 'General', price: 9999, compareAt: 12999, images: [], disponibilidad: { comprable: true } },
      { id: 'd3', name: 'Producto Edición Limitada', slug: 'producto-edicion-limitada', category: 'Especiales', price: 14999, compareAt: 0, images: [], disponibilidad: { comprable: false } },
    ],
  };

  async function buscar(reemplazarUrl) {
    guardarEnUrl(reemplazarUrl);
    if (window.__PREVIEW__) { pintar(DEMO); return; }
    var mio = ++pedidoNro;
    var p = paramsActuales();
    p.set('pagina', String(pagina));
    p.set('porPagina', '12');
    try {
      var r = await fetch('/api/products/buscar?' + p.toString());
      var d = await r.json();
      // Llegó tarde: ya hay una búsqueda más nueva en camino
      if (mio !== pedidoNro) return;
      if (!r.ok) throw new Error(d.error || 'No se pudo buscar');
      pintar(d);
    } catch (err) {
      if (mio !== pedidoNro) return;
      els.cuenta.textContent = '';
      grid.innerHTML = '<div class="ti-vacio">' + App.esc(err.message) + '</div>';
    }
  }

  function limpiar() {
    els.q.value = '';
    els.cat.value = '';
    els.marca.value = '';
    els.min.value = '';
    els.max.value = '';
    els.stock.checked = false;
    els.orden.value = 'destacados';
    pagina = 1;
    buscar();
  }

  // El buscador espera a que termines de escribir: una consulta por tecla es ruido para el
  // servidor y parpadeo para el visitante
  var timer = null;
  els.q.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { pagina = 1; buscar(); }, 350);
  });
  ['cat', 'marca', 'min', 'max', 'stock', 'orden'].forEach(function (k) {
    els[k].addEventListener('change', function () { pagina = 1; buscar(); });
  });
  document.getElementById('ti-limpiar').addEventListener('click', limpiar);

  // El botón "atrás" del navegador vuelve a la búsqueda anterior, como en cualquier tienda
  window.addEventListener('popstate', function () { estadoDesdeUrl(); buscar(true); });

  estadoDesdeUrl();
  buscar(true);
})();`,
  readmeNotes: () => [
    `**Tienda**: la página de compra está en \`/tienda.html\`. El buscador y los filtros los resuelve el servidor (\`GET /api/products/buscar\`), así que el navegador **nunca baja el catálogo entero** — con muchos productos es la diferencia entre que la tienda abra o no en un teléfono. Los filtros viajan en la dirección (\`/tienda.html?cat=Ofertas&orden=precio-asc\`): el resultado se puede **compartir, guardar y anunciar**, y el botón "atrás" funciona. \`/catalog.html\` (del módulo Carrito) sigue existiendo como grilla simple; si activás este módulo, **enlazá la Tienda desde el menú** y usá aquella sólo si querés las dos.`,
  ],
};
