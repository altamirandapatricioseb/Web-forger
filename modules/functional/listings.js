// Directorio / avisos clasificados administrable con backend real: una página pública /avisos.html
// que lista avisos publicados (propiedades, autos, servicios, productos usados, profesionales…)
// con buscador y filtro por categoría, y abre cada aviso en detalle en la misma página
// (?aviso=<id>) sumando una visita real (colección listings). Con el módulo de autenticación
// activo, /avisos-admin.html es un ABM solo-admin para crear, editar, publicar/despublicar y
// borrar avisos. Se siembran tres avisos de ejemplo la primera vez para que el directorio tenga
// contenido desde el arranque, incluso sin auth. La aparición de las tarjetas y del detalle se
// anima con Anime.js (stagger + red de seguridad, respeta "prefers-reduced-motion"). Es un patrón
// muy usado por inmobiliarias, concesionarias, marketplaces y directorios profesionales, y no
// existía en el catálogo. Distinto de "products-admin" (catálogo de e-commerce con stock y carrito)
// y de "catalogo"/"productcompare" (UI estática): acá el negocio publica y administra avisos con
// precio, ubicación y ficha, servidos dinámicamente.

// Avisos de ejemplo (se siembran la primera vez; el negocio los edita o borra desde el ABM).
const SEMILLA = [
  { title: 'Departamento 2 ambientes a estrenar', category: 'Inmuebles', price: 95000, location: 'Palermo, CABA', description: 'Luminoso 2 ambientes a estrenar, con balcón, cocina integrada y amenities. Excelente ubicación a metros del subte. Apto crédito.', image: '', published: true, views: 0 },
  { title: 'Auto sedán 2019 muy buen estado', category: 'Vehículos', price: 12500000, location: 'Córdoba Capital', description: 'Sedán full 2019, 68.000 km, único dueño, service al día. Financiación y toma de usados.', image: '', published: true, views: 0 },
  { title: 'Servicio de diseño gráfico freelance', category: 'Servicios', price: 0, location: 'Remoto / a convenir', description: 'Diseño de identidad de marca, piezas para redes y material impreso. Presupuestos a medida sin cargo.', image: '', published: true, views: 0 },
];

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'listings', type: 'functional', name: 'Directorio de avisos',
  description: 'Directorio/clasificados con backend: página pública /avisos.html que lista avisos publicados (buscador + filtro por categoría) y los abre en detalle sumando visitas reales (Anime.js). Sirve para inmuebles, vehículos, servicios o profesionales. Con auth activo, ABM solo-admin en /avisos-admin.html.',
  usesAnime: true,
  mounts: [{ route: '/api/listings', file: 'routes/listings.js' }],
  collections: ['listings'],
  nav: (cfg) => {
    const links = [{ label: 'Avisos', href: '/avisos.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Mis avisos', href: '/avisos-admin.html', id: 'nav-avisos-admin' });
    return links;
  },
  head: () => `  <style>
    .ls-tools{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 20px}
    .ls-search{flex:1;min-width:220px;max-width:420px}
    .ls-cats{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 24px}
    .ls-chip{background:var(--surface);border:1px solid var(--line);color:var(--text);border-radius:999px;padding:5px 14px;font:inherit;font-size:.85rem;cursor:pointer}
    .ls-chip.active{background:var(--accent);border-color:transparent;color:#fff}
    .ls-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
    .ls-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;text-align:left;padding:0;cursor:pointer;font:inherit;color:inherit}
    .ls-card .ls-img{aspect-ratio:4/3;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 16%,var(--surface)),var(--surface));background-size:cover;background-position:center}
    .ls-card .ls-body{padding:14px 16px;display:flex;flex-direction:column;gap:6px;flex:1}
    .ls-card .ls-cat{font-size:.72rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em}
    .ls-card h3{margin:0;font-size:1.05rem;line-height:1.3}
    .ls-card .ls-price{font-weight:800;font-size:1.15rem}
    .ls-card .ls-loc{font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:5px}
    .ls-card .ls-desc{margin:0;color:var(--muted);font-size:.9rem;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .ls-empty{color:var(--muted)}
    .ls-detail{max-width:760px}
    .ls-detail .ls-img-full{width:100%;aspect-ratio:16/9;border-radius:var(--radius);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 16%,var(--surface)),var(--surface));background-size:cover;background-position:center;margin:0 0 20px}
    .ls-detail h2{margin:0 0 6px}
    .ls-detail .ls-price-big{font-size:2rem;font-weight:800;color:var(--accent);margin:0 0 4px}
    .ls-detail .ls-meta{color:var(--muted);font-size:.9rem;margin:0 0 20px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
    .ls-detail .ls-content{white-space:pre-line;line-height:1.7}
    .ls-back{background:transparent;border:0;color:var(--accent);font:inherit;cursor:pointer;padding:0;margin:0 0 18px;display:inline-flex;align-items:center;gap:6px}
    .ls-badge{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;vertical-align:baseline;background:var(--surface);border:1px solid var(--line)}
    .ls-badge.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
  </style>`,
  files: (cfg) => ({
    'routes/listings.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Siembra avisos de ejemplo la primera vez para que /avisos.html tenga contenido desde el arranque
db.seedIfEmpty('listings', ${JSON.stringify(SEMILLA, null, 2)});

const validar = (data) => check(data, {
  title: (v) => str(v, 3, 140),
  category: (v) => str(v, 2, 60),
  location: (v) => str(v, 2, 120),
  description: (v) => str(v, 10, 6000),
});

// Vista pública en el listado (sin la descripción completa)
const resumen = (a) => ({ id: a.id, title: a.title, category: a.category, price: a.price || 0, location: a.location, image: a.image || '', views: a.views || 0, createdAt: a.createdAt });
// Vista pública del aviso completo
const completo = (a) => ({ id: a.id, title: a.title, category: a.category, price: a.price || 0, location: a.location, description: a.description, image: a.image || '', views: a.views || 0, createdAt: a.createdAt });

// GET /api/listings — avisos publicados; ?q= filtra por título/categoría/ubicación/descr, ?cat= por categoría
router.get('/', async (req, res) => {
  let rows = await db.find('listings', a => a.published);
  const q = String(req.query.q || '').trim().toLowerCase();
  const cat = String(req.query.cat || '').trim().toLowerCase();
  if (q) rows = rows.filter(a => (a.title + ' ' + a.category + ' ' + a.location + ' ' + a.description).toLowerCase().includes(q));
  if (cat) rows = rows.filter(a => (a.category || '').toLowerCase() === cat);
  res.json(rows.reverse().map(resumen));
});

// GET /api/listings/categorias — categorías con avisos publicados (para los chips de filtro)
router.get('/categorias', async (req, res) => {
  const cats = [...new Set((await db.find('listings', a => a.published)).map(a => a.category).filter(Boolean))];
  res.json(cats);
});

// GET /api/listings/:id — aviso completo (solo si está publicado)
router.get('/:id', async (req, res) => {
  const a = await db.get('listings', req.params.id);
  if (!a || !a.published) return res.status(404).json({ error: 'Aviso inexistente' });
  res.json(completo(a));
});

// POST /api/listings/:id/view — suma una visita al aviso (contador real, público)
router.post('/:id/view', async (req, res) => {
  const a = await db.get('listings', req.params.id);
  if (!a || !a.published) return res.status(404).json({ error: 'Aviso inexistente' });
  const row = await db.update('listings', a.id, { views: (a.views || 0) + 1 });
  res.json({ views: row.views });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/listings/all/list — todos los avisos, publicados o no (solo admin)
router.get('/all/list', requireAdmin, async (req, res) => {
  res.json((await db.all('listings')).reverse());
});

// POST /api/listings — crea un aviso (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const image = typeof req.body.image === 'string' ? req.body.image.trim().slice(0, 500) : '';
  const row = await db.insert('listings', {
    title: req.body.title.trim(),
    category: req.body.category.trim(),
    price: num(req.body.price, 0, 100000000000) ? Math.round(req.body.price) : 0,
    location: req.body.location.trim(),
    description: req.body.description.trim(),
    image,
    published: req.body.published !== false,
    views: 0,
  });
  res.status(201).json(row);
});

// PATCH /api/listings/:id — edita un aviso o cambia su publicación (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.title !== undefined) { if (!str(req.body.title, 3, 140)) return res.status(422).json({ error: 'Título inválido' }); patch.title = req.body.title.trim(); }
  if (req.body.category !== undefined) { if (!str(req.body.category, 2, 60)) return res.status(422).json({ error: 'Categoría inválida' }); patch.category = req.body.category.trim(); }
  if (req.body.location !== undefined) { if (!str(req.body.location, 2, 120)) return res.status(422).json({ error: 'Ubicación inválida' }); patch.location = req.body.location.trim(); }
  if (req.body.description !== undefined) { if (!str(req.body.description, 10, 6000)) return res.status(422).json({ error: 'Descripción inválida' }); patch.description = req.body.description.trim(); }
  if (req.body.price !== undefined) patch.price = num(req.body.price, 0, 100000000000) ? Math.round(req.body.price) : 0;
  if (req.body.image !== undefined) patch.image = typeof req.body.image === 'string' ? req.body.image.trim().slice(0, 500) : '';
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  const row = await db.update('listings', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Aviso inexistente' });
  res.json(row);
});

// DELETE /api/listings/:id — borra un aviso (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const a = await db.get('listings', req.params.id);
  if (!a) return res.status(404).json({ error: 'Aviso inexistente' });
  await db.remove('listings', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de avisos (crear, editar, publicar, borrar) requiere el módulo de autenticación:
// activalo en el Builder para habilitar /avisos-admin.html. Sin él, se muestran los avisos
// sembrados y podés editarlos a mano en data/listings.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      avisos: {
        title: 'Avisos',
        html: `  <section>
    <div class="container">
      <div id="ls-list-view">
        <h2>Avisos</h2>
        <p class="section-sub">Explorá los avisos publicados. Buscá o filtrá por categoría.</p>
        <div class="ls-tools">
          <input type="search" id="ls-search" class="ls-search" placeholder="Buscar avisos…" aria-label="Buscar avisos">
        </div>
        <div class="ls-cats" id="ls-cats"></div>
        <div id="ls-grid"><p class="ls-empty">Cargando avisos…</p></div>
      </div>
      <div id="ls-detail-view" hidden></div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['avisos-admin'] = {
        title: 'Mis avisos',
        html: `  <section>
    <div class="container">
      <h2>Mis avisos</h2>
      <p class="section-sub">Publicá y administrá los avisos de tu directorio. Solo visible para administradores.</p>
      <form id="ls-form" class="card" style="max-width:720px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <label>Título del aviso</label>
        <input name="title" required minlength="3" maxlength="140" placeholder="Ej: Departamento 2 ambientes a estrenar">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Categoría</label><input name="category" required minlength="2" maxlength="60" placeholder="Ej: Inmuebles" list="ls-cat-list"><datalist id="ls-cat-list"></datalist></div>
          <div><label>Precio ($, 0 = "a convenir")</label><input name="price" type="number" min="0" step="1" placeholder="95000"></div>
        </div>
        <label>Ubicación</label>
        <input name="location" required minlength="2" maxlength="120" placeholder="Ej: Palermo, CABA">
        <label>Imagen (URL, opcional)</label>
        <input name="image" maxlength="500" placeholder="https://… (dejalo vacío para usar un fondo de marca)">
        <label>Descripción</label>
        <textarea name="description" rows="6" required minlength="10" maxlength="6000" placeholder="Describí el aviso con todo el detalle que quieras."></textarea>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" name="published" checked style="width:auto"> Publicado (visible en /avisos.html)</label>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn" type="submit" id="ls-save">Publicar aviso</button>
          <button class="btn ghost" type="button" id="ls-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="ls-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo directorio de avisos: página pública /avisos.html (listado con buscador/filtro y detalle
   del aviso con contador de visitas real, animado con Anime.js) y, con auth activo, el ABM en
   /avisos-admin.html. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEMO = [
    { id: 'd1', title: 'Departamento 2 ambientes a estrenar', category: 'Inmuebles', price: 95000, location: 'Palermo, CABA', description: 'Luminoso 2 ambientes a estrenar, con balcón y amenities.\\n\\nApto crédito.', image: '', views: 31, createdAt: new Date().toISOString() },
    { id: 'd2', title: 'Auto sedán 2019 muy buen estado', category: 'Vehículos', price: 12500000, location: 'Córdoba Capital', description: 'Sedán full 2019, 68.000 km, único dueño.', image: '', views: 12, createdAt: new Date().toISOString() },
    { id: 'd3', title: 'Servicio de diseño gráfico', category: 'Servicios', price: 0, location: 'Remoto', description: 'Diseño de marca y piezas para redes.', image: '', views: 8, createdAt: new Date().toISOString() },
  ];

  function precio(n) { return n && n > 0 ? App.money(n) : 'A convenir'; }
  function fechaCorta(iso) { try { return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }

  function revelar(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [16, 0], duration: 480, delay: anime.stagger ? anime.stagger(55) : 0, ease: 'outCubic' });
    // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
    setTimeout(function () { nodos.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 700);
  }

  // ---- Página pública /avisos.html ----
  var listView = document.getElementById('ls-list-view');
  var detailView = document.getElementById('ls-detail-view');
  var grid = document.getElementById('ls-grid');
  if (grid && listView && detailView) {
    var search = document.getElementById('ls-search');
    var catsBox = document.getElementById('ls-cats');
    var catActiva = '';
    var contados = {};

    function imgStyle(img) { return img ? ' style="background-image:url(\\'' + App.esc(img).replace(/'/g, '%27') + '\\')"' : ''; }

    function pintarLista(avisos) {
      if (!avisos.length) { grid.innerHTML = '<p class="ls-empty">No hay avisos para mostrar todavía.</p>'; return; }
      grid.innerHTML = avisos.map(function (a) {
        return '<button class="ls-card" type="button" data-id="' + a.id + '">' +
          '<span class="ls-img"' + imgStyle(a.image) + '></span>' +
          '<span class="ls-body">' +
            '<span class="ls-cat">' + App.esc(a.category) + '</span>' +
            '<h3>' + App.esc(a.title) + '</h3>' +
            '<span class="ls-price">' + App.esc(precio(a.price)) + '</span>' +
            '<span class="ls-loc">' + App.esc(a.location) + '</span>' +
            '<p class="ls-desc">' + App.esc(a.title) + '</p>' +
          '</span></button>';
      }).join('');
      var cards = [].slice.call(grid.querySelectorAll('.ls-card'));
      cards.forEach(function (c) { c.addEventListener('click', function () { abrirAviso(c.getAttribute('data-id')); }); });
      revelar(cards);
    }

    function pintarCats(cats) {
      if (!catsBox) return;
      var chips = ['<button class="ls-chip' + (catActiva ? '' : ' active') + '" type="button" data-cat="">Todas</button>'];
      cats.forEach(function (c) { chips.push('<button class="ls-chip' + (catActiva === c ? ' active' : '') + '" type="button" data-cat="' + App.esc(c) + '">' + App.esc(c) + '</button>'); });
      catsBox.innerHTML = chips.join('');
      catsBox.querySelectorAll('[data-cat]').forEach(function (b) {
        b.addEventListener('click', function () { catActiva = b.getAttribute('data-cat'); pintarCats(cats); cargarLista(); });
      });
    }

    function cargarLista() {
      var q = (search && search.value.trim()) || '';
      if (window.__PREVIEW__) {
        var f = q.toLowerCase();
        pintarLista(DEMO.filter(function (a) {
          return (!f || (a.title + a.category + a.location + a.description).toLowerCase().indexOf(f) >= 0) && (!catActiva || a.category === catActiva);
        }));
        return;
      }
      var qs = [];
      if (q) qs.push('q=' + encodeURIComponent(q));
      if (catActiva) qs.push('cat=' + encodeURIComponent(catActiva));
      App.api('/api/listings' + (qs.length ? '?' + qs.join('&') : '')).then(pintarLista).catch(function () { grid.innerHTML = '<p class="ls-empty">No se pudieron cargar los avisos.</p>'; });
    }

    function abrirAviso(id) {
      try { history.pushState({ aviso: id }, '', '?aviso=' + encodeURIComponent(id)); } catch (e) {}
      mostrarAviso(id);
    }

    function mostrarAviso(id) {
      function render(a) {
        listView.hidden = true;
        detailView.hidden = false;
        detailView.innerHTML = '<article class="ls-detail">' +
          '<button class="ls-back" type="button" id="ls-volver">${phIcon('arrow-left', { size: 13 })} Volver a los avisos</button>' +
          (a.image ? '<div class="ls-img-full" style="background-image:url(\\'' + App.esc(a.image).replace(/'/g, '%27') + '\\')"></div>' : '') +
          '<span class="ls-cat" style="color:var(--accent);font-weight:700;text-transform:uppercase;font-size:.72rem;letter-spacing:.04em">' + App.esc(a.category) + '</span>' +
          '<h2>' + App.esc(a.title) + '</h2>' +
          '<p class="ls-price-big">' + App.esc(precio(a.price)) + '</p>' +
          '<p class="ls-meta"><span>' + App.esc(a.location) + '</span><span>·</span><span>' + fechaCorta(a.createdAt) + '</span><span>·</span><span id="ls-views">' + (a.views || 0) + ' visitas</span></p>' +
          '<div class="ls-content">' + App.esc(a.description) + '</div></article>';
        document.getElementById('ls-volver').addEventListener('click', volver);
        if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
        var anime = window.anime;
        if (anime && anime.animate && !reduce) anime.animate(detailView.querySelector('.ls-detail'), { opacity: [0, 1], translateY: [12, 0], duration: 420, ease: 'outCubic' });
        if (!contados[a.id]) {
          contados[a.id] = true;
          if (!window.__PREVIEW__) App.api('/api/listings/' + a.id + '/view', { method: 'POST' }).then(function (r) {
            var v = document.getElementById('ls-views');
            if (v && r && typeof r.views === 'number') v.textContent = r.views + ' visitas';
          }).catch(function () {});
        }
      }
      if (window.__PREVIEW__) { var d = DEMO.filter(function (a) { return a.id === id; })[0] || DEMO[0]; render(d); return; }
      App.api('/api/listings/' + encodeURIComponent(id)).then(render).catch(function () {
        detailView.hidden = true; listView.hidden = false;
        App.toast('No encontramos ese aviso');
      });
    }

    function volver() {
      try { history.pushState({}, '', location.pathname); } catch (e) {}
      detailView.hidden = true; detailView.innerHTML = '';
      listView.hidden = false;
    }

    window.addEventListener('popstate', function () {
      var id = new URLSearchParams(location.search).get('aviso');
      if (id) mostrarAviso(id); else volver();
    });

    if (search) { var t; search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(cargarLista, 250); }); }

    if (window.__PREVIEW__) { pintarCats(['Inmuebles', 'Vehículos', 'Servicios']); }
    else App.api('/api/listings/categorias').then(pintarCats).catch(function () { pintarCats([]); });
    cargarLista();
    var inicial = new URLSearchParams(location.search).get('aviso');
    if (inicial) mostrarAviso(inicial);
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM /avisos-admin.html ----
  var adminBox = document.getElementById('ls-admin');
  var formA = document.getElementById('ls-form');
  if (adminBox && formA) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var idInput = formA.querySelector('[name="id"]');
    var cancelBtn = document.getElementById('ls-cancel');
    var saveBtn = document.getElementById('ls-save');
    var datalist = document.getElementById('ls-cat-list');

    function refrescarCats() {
      if (!datalist) return;
      var cats = {};
      todos.forEach(function (a) { if (a.category) cats[a.category] = 1; });
      datalist.innerHTML = Object.keys(cats).map(function (c) { return '<option value="' + App.esc(c) + '">'; }).join('');
    }

    function pintar() {
      adminBox.innerHTML = App.table(todos, [
        { key: 'title', label: 'Título' },
        { label: 'Categoría', render: function (r) { return '<span class="ls-badge">' + App.esc(r.category) + '</span>'; } },
        { label: 'Precio', render: function (r) { return r.price && r.price > 0 ? App.money(r.price) : '<span class="muted">A convenir</span>'; } },
        { label: 'Ubicación', render: function (r) { return App.esc(r.location); } },
        { label: 'Estado', render: function (r) { return r.published ? '<span class="ls-badge on">Publicado</span>' : '<span class="ls-badge">Borrador</span>'; } },
        { label: 'Visitas', render: function (r) { return String(r.views || 0); } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-pub="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.published ? 'Despublicar' : 'Publicar') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      adminBox.querySelectorAll('[data-pub]').forEach(function (b) { b.addEventListener('click', function () { togglePub(b.getAttribute('data-pub')); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
      refrescarCats();
    }

    function resetForm() {
      formA.reset(); idInput.value = '';
      formA.querySelector('[name="published"]').checked = true;
      saveBtn.textContent = 'Publicar aviso';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var a = todos.filter(function (r) { return r.id === id; })[0];
      if (!a) return;
      idInput.value = a.id;
      formA.querySelector('[name="title"]').value = a.title;
      formA.querySelector('[name="category"]').value = a.category;
      formA.querySelector('[name="price"]').value = a.price || 0;
      formA.querySelector('[name="location"]').value = a.location;
      formA.querySelector('[name="image"]').value = a.image || '';
      formA.querySelector('[name="description"]').value = a.description;
      formA.querySelector('[name="published"]').checked = !!a.published;
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formA.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function togglePub(id) {
      var a = todos.filter(function (r) { return r.id === id; })[0];
      if (!a) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: cambiaría publicación'); return; }
      try {
        var row = await App.api('/api/listings/' + id, { method: 'PATCH', body: { published: !a.published } });
        a.published = row.published; pintar();
        App.toast(a.published ? 'Aviso publicado' : 'Aviso despublicado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este aviso? No se puede deshacer.')) return;
      try {
        await App.api('/api/listings/' + id, { method: 'DELETE' });
        todos = todos.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Aviso borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formA.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = Object.fromEntries(new FormData(formA));
      datos.published = formA.querySelector('[name="published"]').checked;
      datos.price = Number(datos.price || 0);
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'publicaría') + ' el aviso'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/listings/' + editando, { method: 'PATCH', body: datos });
          todos = todos.map(function (r) { return r.id === editando ? upd : r; });
          App.toast('Cambios guardados');
        } else {
          var nuevo = await App.api('/api/listings', { method: 'POST', body: datos });
          todos.unshift(nuevo);
          App.toast('Aviso publicado');
        }
        resetForm();
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function listo(rows) { todos = rows; pintar(); }
    if (window.__PREVIEW__) {
      listo([
        { id: 'd1', title: 'Departamento 2 ambientes', category: 'Inmuebles', price: 95000, location: 'Palermo, CABA', description: 'Luminoso a estrenar.', image: '', published: true, views: 31, createdAt: new Date().toISOString() },
        { id: 'd9', title: 'Aviso en borrador', category: 'Servicios', price: 0, location: 'Remoto', description: 'Todavía sin publicar.', image: '', published: false, views: 0, createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/listings/all/list').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navA = document.getElementById('nav-avisos-admin');
    if (navA && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navA.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Directorio de avisos**: los avisos viven en la colección \`listings\` y se muestran en \`/avisos.html\` con buscador, filtro por categoría y contador de visitas real. Se siembran tres avisos de ejemplo la primera vez (inmueble, vehículo y servicio: cambialos por tu rubro). ${cfg.moduleIds.includes('auth') ? 'Los administradores crean, editan, publican y borran avisos en \`/avisos-admin.html\`. La imagen es opcional (URL).' : 'Para publicar y administrar avisos desde la web activá el módulo **Autenticación** (habilita \`/avisos-admin.html\`); sin él, editá \`data/listings.json\` a mano.'} Cada aviso tiene enlace directo compartible (\`/avisos.html?aviso=<id>\`). Un precio en 0 se muestra como "A convenir".`,
  ],
};
