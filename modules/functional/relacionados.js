// Productos relacionados con datos reales: el "quien compró esto también compró" que hasta ahora
// el catálogo no tenía. La ficha ya mostraba cuatro productos, pero los elegía por CATEGORÍA — es
// decir, por la única regla que garantiza mostrar lo más parecido a lo que la persona ya está
// mirando. Recomendarle otra remera a quien está comprando una remera no vende nada: lo que vende
// es el pantalón que compraron los otros que se llevaron esa remera.
//
// Acá las recomendaciones salen de los PEDIDOS REALES. El servidor recorre las órdenes no
// canceladas, cuenta cuántas veces dos productos aparecieron en la misma compra y ordena por esa
// frecuencia. Es el mismo cálculo que usa cualquier tienda grande, y no necesita ningún servicio
// externo: el dato ya está en la colección `orders`.
//
// Tres decisiones:
//
//   1. LA CURACIÓN MANUAL GANA SIEMPRE. El negocio sabe cosas que los datos todavía no: que la
//      funda va con el teléfono, que el repuesto va con la máquina. Lo que se elige a mano va
//      primero; la co-compra rellena lo que falta.
//   2. HAY UN PISO DE EVIDENCIA. Una sola compra conjunta no es un patrón, es una coincidencia.
//      Por debajo del mínimo (2 pedidos) la sugerencia no se muestra, y se cae al criterio de
//      categoría — que es flojo, pero honesto.
//   3. NUNCA SE RECOMIENDA LO QUE NO SE PUEDE COMPRAR. Un producto pausado o sin stock sale de la
//      lista antes de armarla: mandar a alguien a una ficha con el botón apagado es peor que no
//      recomendar nada.
//
// El bloque del carrito ("completá tu compra") es el segundo lugar donde esto rinde: se recalcula
// con cada cambio del carrito escuchando el evento `wf:cart`, pidiéndole al servidor qué falta —
// y descartando lo que ya está adentro. Animado con Anime.js (entrada con stagger) + red de
// seguridad por si el loop está pausado.

module.exports = {
  id: 'relacionados', type: 'functional', name: 'Productos relacionados',
  description: 'Recomendaciones calculadas sobre los PEDIDOS REALES: el servidor cuenta cuántas veces dos productos se compraron juntos y ordena por esa frecuencia ("quien compró esto también compró"). El negocio puede fijar a mano los relacionados de cada producto y esa elección gana siempre; la co-compra rellena el resto y, si todavía no hay evidencia suficiente, cae a la misma categoría. Nunca recomienda productos pausados ni sin stock. Alimenta el bloque de la ficha de producto y suma un "Completá tu compra" al carrito que se recalcula con cada cambio. Panel /relacionados-admin.html con el ranking de co-compra a la vista. Animado con Anime.js.',
  usesAnime: true,
  requires: ['products-admin', 'cart'],
  mounts: [{ route: '/api/relacionados', file: 'routes/relacionados.js' }],
  collections: ['crossell'],
  nav: () => [{ label: 'Relacionados', href: '/relacionados-admin.html', id: 'nav-relacionados' }],
  head: () => `  <style>
    .rl-carrito{margin-top:30px}
    .rl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:15px;margin-top:14px}
    .rl-item{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--surface);text-decoration:none;color:inherit;display:flex;flex-direction:column}
    .rl-foto{aspect-ratio:4/3;background:color-mix(in srgb,var(--text) 5%,var(--bg));display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.76rem}
    .rl-foto img{width:100%;height:100%;object-fit:cover;display:block}
    .rl-txt{padding:11px 13px;display:flex;flex-direction:column;gap:3px;flex:1}
    .rl-txt strong{font-size:.93rem;line-height:1.3}
    .rl-precio{font-variant-numeric:tabular-nums;font-weight:700}
    .rl-motivo{font-size:.72rem;color:var(--muted);letter-spacing:.02em}
    .rl-admin-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;margin-top:18px}
    @media (max-width:820px){.rl-admin-grid{grid-template-columns:1fr}}
    .rl-check{display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid var(--line);margin:0}
    .rl-check input{width:auto;margin:0}
    .rl-caja{max-height:340px;overflow-y:auto;border:1px solid var(--line);border-radius:var(--radius);padding:6px 13px}
    .rl-rank{list-style:none;padding:0;margin:0}
    .rl-rank li{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--line);font-size:.89rem}
    .rl-rank b{font-variant-numeric:tabular-nums}
  </style>`,
  files: () => ({
    'routes/relacionados.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');

const TOPE = 4;
// Una sola compra conjunta no es un patrón, es una coincidencia. Por debajo de este piso la
// sugerencia no se muestra y se cae al criterio de categoría, que es flojo pero honesto.
const MINIMO_EVIDENCIA = 2;

// El grafo de co-compra se recalcula como mucho una vez por minuto: recorrer todos los pedidos en
// cada visita a una ficha es trabajo repetido para un dato que cambia con cada venta, no con cada
// visita. Un minuto de desfasaje en una recomendación no le cuesta nada a nadie.
let grafo = null;
let grafoHasta = 0;

async function coCompras() {
  if (grafo && Date.now() < grafoHasta) return grafo;
  const mapa = new Map();
  for (const o of await db.all('orders')) {
    if (o.status === 'cancelado') continue;
    // Distintos: dos líneas del mismo producto (dos talles) no son una co-compra consigo mismo
    const ids = [...new Set((Array.isArray(o.items) ? o.items : []).map(i => i && i.productId).filter(Boolean))];
    for (let a = 0; a < ids.length; a++) {
      for (let b = 0; b < ids.length; b++) {
        if (a === b) continue;
        if (!mapa.has(ids[a])) mapa.set(ids[a], new Map());
        const fila = mapa.get(ids[a]);
        fila.set(ids[b], (fila.get(ids[b]) || 0) + 1);
      }
    }
  }
  grafo = mapa;
  grafoHasta = Date.now() + 60000;
  return grafo;
}

/** ¿Se puede comprar? Misma regla que la ficha y el checkout. Recomendar lo que no se puede
 *  comprar es mandar a alguien a una página con el botón apagado. */
function vendible(p) {
  if (!p || p.active === false) return false;
  if (p.trackStock === false || p.allowBackorder) return true;
  return (Number(p.stock) || 0) > 0;
}

const tarjeta = (p, motivo) => ({
  id: p.id, name: p.name, slug: p.slug || '', price: Number(p.price) || 0,
  image: (Array.isArray(p.images) && p.images[0]) ? p.images[0].url : '',
  motivo,
});

const manualesDe = async (productId) => {
  const row = (await db.find('crossell', r => r.productId === productId))[0];
  return Array.isArray(row && row.manualIds) ? row.manualIds : [];
};

/**
 * Arma la lista de recomendados de un producto (o de un conjunto: el carrito).
 * Orden: lo elegido a mano, después la co-compra con evidencia suficiente, después la categoría.
 */
async function recomendar({ semillas, excluir, tope = TOPE, conManuales = true }) {
  const productos = await db.all('products');
  const porId = new Map(productos.map(p => [p.id, p]));
  const fuera = new Set(excluir || []);
  const salida = [];
  const puesto = new Set();

  const sumar = (id, motivo) => {
    if (salida.length >= tope || puesto.has(id) || fuera.has(id)) return;
    const p = porId.get(id);
    if (!vendible(p)) return;
    puesto.add(id);
    salida.push(tarjeta(p, motivo));
  };

  if (conManuales) {
    for (const s of semillas) for (const id of await manualesDe(s)) sumar(id, 'elegido');
  }

  if (salida.length < tope) {
    const mapa = await coCompras();
    const puntaje = new Map();
    for (const s of semillas) {
      for (const [id, n] of (mapa.get(s) || new Map())) {
        if (n < MINIMO_EVIDENCIA) continue;
        puntaje.set(id, (puntaje.get(id) || 0) + n);
      }
    }
    for (const [id] of [...puntaje.entries()].sort((a, b) => b[1] - a[1])) sumar(id, 'comprado-junto');
  }

  if (salida.length < tope) {
    const categorias = new Set(semillas.map(s => (porId.get(s) || {}).category).filter(Boolean));
    for (const p of productos) if (categorias.has(p.category)) sumar(p.id, 'misma-categoria');
  }

  return salida;
}

// GET /api/relacionados/producto/:productId — el bloque de la ficha
router.get('/producto/:productId', async (req, res) => {
  const p = await db.get('products', req.params.productId);
  if (!p) return res.status(404).json({ error: 'Ese producto no existe' });
  res.json(await recomendar({ semillas: [p.id], excluir: [p.id] }));
});

// POST /api/relacionados/carrito — { items:[{productId}] } → "completá tu compra".
// Se excluye lo que ya está en el carrito: recomendarle a alguien lo que ya eligió es ruido.
router.post('/carrito', async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body && req.body.items) ? req.body.items : [])
    .slice(0, 200).map(i => i && i.productId).filter(Boolean))];
  if (!ids.length) return res.json([]);
  res.json(await recomendar({ semillas: ids, excluir: ids }));
});

// ---------- panel ----------

// GET /api/relacionados/admin/:productId — lo elegido a mano, el ranking real y el catálogo
router.get('/admin/:productId', requireAdmin, async (req, res) => {
  const p = await db.get('products', req.params.productId);
  if (!p) return res.status(404).json({ error: 'Ese producto no existe' });
  const productos = await db.all('products');
  const porId = new Map(productos.map(x => [x.id, x]));
  const mapa = await coCompras();
  const ranking = [...(mapa.get(p.id) || new Map())]
    .sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([id, n]) => ({ id, name: (porId.get(id) || {}).name || '(producto borrado)', pedidos: n, suficiente: n >= MINIMO_EVIDENCIA }));
  res.json({
    productId: p.id,
    manualIds: await manualesDe(p.id),
    ranking, minimo: MINIMO_EVIDENCIA,
    productos: productos.map(x => ({ id: x.id, name: x.name, active: x.active !== false })),
    vistaPrevia: await recomendar({ semillas: [p.id], excluir: [p.id] }),
  });
});

// PUT /api/relacionados/:productId — fija los relacionados a mano
router.put('/:productId', requireAdmin, async (req, res) => {
  const p = await db.get('products', req.params.productId);
  if (!p) return res.status(404).json({ error: 'Ese producto no existe' });
  const existentes = new Set((await db.all('products')).map(x => x.id));
  const manualIds = [...new Set((Array.isArray(req.body && req.body.manualIds) ? req.body.manualIds : [])
    .map(String).filter(id => existentes.has(id) && id !== p.id))].slice(0, TOPE);
  const row = (await db.find('crossell', r => r.productId === p.id))[0];
  if (row) await db.update('crossell', row.id, { manualIds });
  else await db.insert('crossell', { productId: p.id, manualIds });
  res.json({ productId: p.id, manualIds, vistaPrevia: await recomendar({ semillas: [p.id], excluir: [p.id] }) });
});

module.exports = router;
module.exports.invalidar = function () { grafo = null; grafoHasta = 0; };
`,
  }),
  pages: () => ({
    'relacionados-admin': {
      title: 'Relacionados',
      html: `  <section>
    <div class="container">
      <h2>Productos relacionados</h2>
      <p class="section-sub">Lo que elegís a mano va primero. Debajo, el ranking de lo que
        realmente se compró junto con este producto, calculado sobre tus pedidos.</p>
      <div class="card" id="rl-panel" hidden>
        <label for="rl-producto">Producto</label>
        <select id="rl-producto"></select>
        <div class="rl-admin-grid">
          <div>
            <h3 style="margin:0 0 4px;font-size:1rem">Elegidos a mano</h3>
            <p class="muted" style="font-size:.85rem;margin:0 0 9px">Hasta 4. Van siempre primero,
              por delante de lo que digan los datos.</p>
            <div class="rl-caja" id="rl-catalogo"></div>
            <button class="btn" type="button" id="rl-guardar" style="margin-top:12px">Guardar</button>
          </div>
          <div>
            <h3 style="margin:0 0 4px;font-size:1rem">Se compró junto con…</h3>
            <p class="muted" style="font-size:.85rem;margin:0 0 9px" id="rl-minimo"></p>
            <ul class="rl-rank" id="rl-ranking"></ul>
            <h3 style="margin:22px 0 4px;font-size:1rem">Lo que va a ver el visitante</h3>
            <div class="rl-grid" id="rl-previa"></div>
          </div>
        </div>
      </div>
      <p class="muted" id="rl-sin" hidden>Entrá como administrador para configurar los relacionados.</p>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo Productos relacionados.
   Dos bloques públicos: el de la ficha (que reemplaza la lista por categoría que hornea el
   servidor con la que sale de los pedidos reales) y el "completá tu compra" del carrito, que se
   recalcula con cada cambio escuchando 'wf:cart'. El orden de las recomendaciones lo decide el
   servidor: acá sólo se pinta. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function esc(s) { return (window.App && App.esc) ? App.esc(s) : String(s == null ? '' : s); }
  function money(n) { return (window.App && App.money) ? App.money(n) : '$' + Math.round(n).toLocaleString('es-AR'); }

  var LEYENDA = {
    'elegido': 'Te lo recomendamos',
    'comprado-junto': 'Se compra junto con este',
    'misma-categoria': 'De la misma categoría',
  };

  function tarjetas(rows) {
    return rows.map(function (r) {
      var destino = r.slug ? '/producto/' + encodeURIComponent(r.slug) : '/catalog.html';
      return '<a class="rl-item" href="' + destino + '">' +
        '<div class="rl-foto">' + (r.image
          ? '<img src="' + esc(r.image) + '" alt="' + esc(r.name) + '" loading="lazy">'
          : 'sin imagen') + '</div>' +
        '<div class="rl-txt"><strong>' + esc(r.name) + '</strong>' +
          '<span class="rl-precio">' + money(r.price) + '</span>' +
          '<span class="rl-motivo">' + esc(LEYENDA[r.motivo] || '') + '</span></div></a>';
    }).join('');
  }

  function entrada(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [12, 0], duration: 380, delay: anime.stagger(50), ease: 'outCubic' });
    // Red de seguridad: con la pestaña oculta el loop de Anime no corre y las tarjetas quedarían
    // invisibles, que es peor que no animar nada
    setTimeout(function () {
      for (var i = 0; i < nodos.length; i++) { nodos[i].style.opacity = 1; nodos[i].style.transform = 'none'; }
    }, 900);
  }

  /* ---------- bloque de la ficha ---------- */

  var botonFicha = document.getElementById('fi-add');
  var cuerpoFicha = document.getElementById('fi-cuerpo');
  if (cuerpoFicha && botonFicha && !window.__PREVIEW__) {
    var productId = botonFicha.getAttribute('data-fi-id');
    fetch('/api/relacionados/producto/' + encodeURIComponent(productId))
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) return;
        // La ficha ya hornea una sección de relacionados por categoría. Si está, se reemplaza su
        // contenido (no se agrega otra abajo: dos bloques de "también te puede interesar" con
        // criterios distintos es exactamente la clase de duplicado que confunde).
        var seccion = cuerpoFicha.querySelector('.fi-rel');
        var grid;
        if (seccion) {
          grid = seccion.querySelector('.fi-rel-grid');
          if (grid) { grid.className = 'rl-grid'; }
        }
        if (!grid) {
          seccion = document.createElement('section');
          seccion.className = 'fi-rel';
          seccion.innerHTML = '<h2>También te puede interesar</h2><div class="rl-grid"></div>';
          cuerpoFicha.appendChild(seccion);
          grid = seccion.querySelector('.rl-grid');
        }
        grid.innerHTML = tarjetas(rows);
        entrada(grid.querySelectorAll('.rl-item'));
      })
      .catch(function () {});
  }

  /* ---------- "completá tu compra" en el carrito ---------- */

  var panelCarrito = document.getElementById('cart-panel');
  if (panelCarrito && !window.__PREVIEW__) {
    var caja = document.createElement('section');
    caja.className = 'rl-carrito';
    caja.hidden = true;
    caja.innerHTML = '<h3 style="margin:0">Completá tu compra</h3><div class="rl-grid"></div>';
    panelCarrito.parentNode.insertBefore(caja, panelCarrito.nextSibling);
    var gridCarrito = caja.querySelector('.rl-grid');

    // Coalescencia, no descarte: si llegan tres cambios del carrito con una consulta en vuelo, se
    // atiende el ÚLTIMO estado en vez de tirar los otros dos. Descartarlos deja el bloque
    // mostrando sugerencias de un carrito que ya no existe.
    var pidiendo = false;
    var pendiente = null;
    async function refrescar(items) {
      if (pidiendo) { pendiente = items; return; }
      pidiendo = true;
      try {
        do {
          var actuales = pendiente || items;
          pendiente = null;
          if (!actuales || !actuales.length) { caja.hidden = true; break; }
          var rows = await App.api('/api/relacionados/carrito', { method: 'POST', body: { items: actuales } });
          if (!Array.isArray(rows) || !rows.length) { caja.hidden = true; break; }
          gridCarrito.innerHTML = tarjetas(rows);
          caja.hidden = false;
          entrada(gridCarrito.querySelectorAll('.rl-item'));
        } while (pendiente);
      } catch (e) { caja.hidden = true; }
      finally { pidiendo = false; }
    }
    document.addEventListener('wf:cart', function (ev) { refrescar(ev.detail || []); });
  }

  /* ---------- panel ---------- */

  var panel = document.getElementById('rl-panel');
  if (!panel) return;
  var sin = document.getElementById('rl-sin');
  // El rol sale de localStorage.user, que es lo que guarda el login (mismo criterio que el
  // resto de los paneles). Decodificar el JWT a mano con atob() no sirve: el payload viene en
  // base64url (con - y _) y atob() lo rechaza, así que el panel no se mostraba nunca.
  var me = null;
  try { me = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) {}
  var esAdmin = !!(me && me.role === 'admin');
  if (window.__PREVIEW__) esAdmin = true;
  if (!esAdmin) { if (sin) sin.hidden = false; return; }
  panel.hidden = false;

  var selProducto = document.getElementById('rl-producto');
  var cajaCatalogo = document.getElementById('rl-catalogo');
  var listaRanking = document.getElementById('rl-ranking');
  var previa = document.getElementById('rl-previa');

  function pintarDetalle(d) {
    var elegidos = new Set(d.manualIds);
    cajaCatalogo.innerHTML = d.productos.filter(function (p) { return p.id !== d.productId; }).map(function (p) {
      return '<label class="rl-check"><input type="checkbox" value="' + esc(p.id) + '"' +
        (elegidos.has(p.id) ? ' checked' : '') + '> ' + esc(p.name) +
        (p.active ? '' : ' <span class="muted">(pausado)</span>') + '</label>';
    }).join('');
    document.getElementById('rl-minimo').textContent =
      'Se muestran las que aparecieron en al menos ' + d.minimo + ' pedidos. Por debajo de eso es una coincidencia, no un patrón.';
    listaRanking.innerHTML = d.ranking.length
      ? d.ranking.map(function (r) {
          return '<li><span>' + esc(r.name) + (r.suficiente ? '' : ' <span class="muted">(todavía no alcanza)</span>') +
            '</span><b>' + r.pedidos + '</b></li>';
        }).join('')
      : '<li class="muted">Todavía no hay pedidos que lo incluyan junto con otro producto.</li>';
    previa.innerHTML = d.vistaPrevia.length ? tarjetas(d.vistaPrevia) : '<p class="muted">Sin recomendaciones para mostrar.</p>';
    entrada(previa.querySelectorAll('.rl-item'));
  }

  function cargarDetalle(productId) {
    return App.api('/api/relacionados/admin/' + encodeURIComponent(productId))
      .then(pintarDetalle)
      .catch(function (e) { if (e.message !== 'preview') App.toast(e.message); });
  }

  document.getElementById('rl-guardar').addEventListener('click', function () {
    var ids = [];
    cajaCatalogo.querySelectorAll('input:checked').forEach(function (c) { ids.push(c.value); });
    if (ids.length > 4) { App.toast('Elegí hasta 4 productos'); return; }
    App.api('/api/relacionados/' + encodeURIComponent(selProducto.value), { method: 'PUT', body: { manualIds: ids } })
      .then(function () { App.toast('Guardado'); cargarDetalle(selProducto.value); })
      .catch(function (e) { if (e.message !== 'preview') App.toast(e.message); });
  });

  selProducto.addEventListener('change', function () { cargarDetalle(selProducto.value); });

  if (window.__PREVIEW__) {
    selProducto.innerHTML = '<option>Producto Clásico</option>';
    pintarDetalle({
      productId: 'demo1', manualIds: ['demo2'], minimo: 2,
      productos: [{ id: 'demo2', name: 'Producto Premium', active: true }, { id: 'demo3', name: 'Edición Limitada', active: true }],
      ranking: [{ id: 'demo2', name: 'Producto Premium', pedidos: 7, suficiente: true }, { id: 'demo3', name: 'Edición Limitada', pedidos: 1, suficiente: false }],
      vistaPrevia: [{ id: 'demo2', name: 'Producto Premium', slug: '', price: 9999, image: '', motivo: 'elegido' }],
    });
  } else {
    App.api('/api/products?all=1').then(function (rows) {
      selProducto.innerHTML = rows.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');
      if (rows.length) cargarDetalle(rows[0].id);
    }).catch(function (e) { if (e.message !== 'preview') App.toast(e.message); });
  }
})();`,
  readmeNotes: () => [
    `**Productos relacionados**: las recomendaciones salen de **tus pedidos reales** — el servidor recorre la colección \`orders\` (salteando los cancelados) y cuenta cuántas veces dos productos se compraron en la misma orden. El orden es: lo que fijaste a mano en \`/relacionados-admin.html\`, después la co-compra, después la misma categoría. Hay un **piso de 2 pedidos** para que una sugerencia salga por co-compra: con una sola compra conjunta no hay patrón, hay casualidad — por eso una tienda recién estrenada va a ver casi todo "de la misma categoría" hasta que junte historial, y eso es lo correcto. El grafo se recalcula **como mucho una vez por minuto**; si necesitás verlo al instante después de una venta, esperá ese minuto o reiniciá el servidor. Nunca se recomienda un producto pausado ni sin stock.`,
  ],
};
