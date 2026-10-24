// Blog / novedades administrable con backend real: una página pública /blog.html que lista los
// artículos publicados (traídos del servidor) con buscador y filtro por categoría, y abre cada
// artículo completo en la misma página (?post=<id>) sumando una visita real (colección posts).
// Con el módulo de autenticación activo, /blog-admin.html es un ABM solo-admin para escribir,
// editar, publicar/despublicar y borrar artículos. Se siembran dos artículos de ejemplo la primera
// vez para que el blog tenga contenido desde el arranque, incluso sin auth. La aparición de las
// tarjetas y del artículo se anima con Anime.js (stagger + red de seguridad, respeta
// "prefers-reduced-motion"). Distinto de "blog"/"blogpages" (UI estática con artículos fijos en el
// HTML) y de "comments" (comentarios de los visitantes): acá el negocio escribe y administra sus
// propias novedades desde la web y se sirven dinámicamente.

// Artículos de ejemplo (se siembran la primera vez; el negocio los edita o borra desde el ABM).
const SEMILLA = [
  { title: 'Bienvenidos a nuestro nuevo sitio', category: 'Novedades', excerpt: 'Renovamos por completo nuestra presencia online para atenderte mejor. Te contamos las novedades.', body: 'Después de varios meses de trabajo, estrenamos un sitio más rápido, más claro y pensado para vos.\n\nVas a encontrar toda la información de nuestros productos y servicios, y nuevas formas de contactarnos. Seguinos por acá para enterarte de todas las novedades, promociones y consejos.\n\n¡Gracias por acompañarnos en este camino!', cover: '', published: true, views: 0 },
  { title: '3 consejos para aprovechar al máximo tu compra', category: 'Consejos', excerpt: 'Pequeños trucos que hacen una gran diferencia. Leé nuestras recomendaciones antes de tu próxima compra.', body: 'Queremos que aproveches al máximo lo que ofrecemos. Por eso te dejamos tres consejos simples:\n\n1. Revisá bien las características antes de decidir: cada detalle cuenta.\n2. Consultanos cualquier duda: estamos para ayudarte a elegir mejor.\n3. Aprovechá nuestras promociones y el programa de beneficios.\n\nSi tenés más preguntas, escribinos. ¡Estamos para ayudarte!', cover: '', published: true, views: 0 },
];

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'blogcms', type: 'functional', name: 'Blog administrable',
  description: 'Blog/novedades con backend: página pública /blog.html que lista artículos publicados (buscador + filtro por categoría) y los abre completos sumando visitas reales (Anime.js). Con auth activo, ABM solo-admin en /blog-admin.html para escribir, editar, publicar y borrar artículos.',
  usesAnime: true,
  mounts: [{ route: '/api/blogcms', file: 'routes/blogcms.js' }],
  collections: ['posts'],
  nav: (cfg) => {
    const links = [{ label: 'Blog', href: '/blog.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Artículos', href: '/blog-admin.html', id: 'nav-blog-admin' });
    return links;
  },
  head: () => `  <style>
    .bl-tools{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 24px}
    .bl-search{flex:1;min-width:220px;max-width:420px}
    .bl-cats{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 24px}
    .bl-chip{background:var(--surface);border:1px solid var(--line);color:var(--text);border-radius:999px;padding:5px 14px;font:inherit;font-size:.85rem;cursor:pointer}
    .bl-chip.active{background:var(--accent);border-color:transparent;color:#fff}
    .bl-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
    .bl-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;text-align:left;padding:0;cursor:pointer;font:inherit;color:inherit}
    .bl-card .bl-cover{aspect-ratio:16/9;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 18%,var(--surface)),var(--surface));display:block;background-size:cover;background-position:center}
    .bl-card .bl-body{padding:16px 18px;display:flex;flex-direction:column;gap:8px;flex:1}
    .bl-card .bl-cat{font-size:.72rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em}
    .bl-card h3{margin:0;font-size:1.1rem;line-height:1.3}
    .bl-card p{margin:0;color:var(--muted);font-size:.92rem;flex:1}
    .bl-card .bl-meta{font-size:.78rem;color:var(--muted);display:flex;justify-content:space-between;gap:8px}
    .bl-empty{color:var(--muted)}
    .bl-article{max-width:720px}
    .bl-article .bl-cover-full{width:100%;aspect-ratio:16/7;border-radius:var(--radius);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 18%,var(--surface)),var(--surface));background-size:cover;background-position:center;margin:0 0 20px}
    .bl-article h2{margin:0 0 8px}
    .bl-article .bl-artmeta{color:var(--muted);font-size:.85rem;margin:0 0 24px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
    .bl-article .bl-content{white-space:pre-line;line-height:1.7}
    .bl-back{background:transparent;border:0;color:var(--accent);font:inherit;cursor:pointer;padding:0;margin:0 0 18px;display:inline-flex;align-items:center;gap:6px}
    .bl-badge{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;vertical-align:baseline;background:var(--surface);border:1px solid var(--line)}
    .bl-badge.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
  </style>`,
  files: (cfg) => ({
    'routes/blogcms.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Siembra artículos de ejemplo la primera vez para que /blog.html tenga contenido desde el arranque
db.seedIfEmpty('posts', ${JSON.stringify(SEMILLA, null, 2)});

const validar = (data) => check(data, {
  title: (v) => str(v, 3, 160),
  category: (v) => str(v, 2, 60),
  excerpt: (v) => str(v, 10, 320),
  body: (v) => str(v, 20, 20000),
});

// Vista pública en el listado (sin el body completo, para no mandar todo de una)
const resumen = (p) => ({ id: p.id, title: p.title, category: p.category, excerpt: p.excerpt, cover: p.cover || '', views: p.views || 0, createdAt: p.createdAt });
// Vista pública del artículo completo
const completo = (p) => ({ id: p.id, title: p.title, category: p.category, excerpt: p.excerpt, body: p.body, cover: p.cover || '', views: p.views || 0, createdAt: p.createdAt });

// GET /api/blogcms — artículos publicados; ?q= filtra por título/categoría/extracto, ?cat= por categoría
router.get('/', async (req, res) => {
  let rows = await db.find('posts', p => p.published);
  const q = String(req.query.q || '').trim().toLowerCase();
  const cat = String(req.query.cat || '').trim().toLowerCase();
  if (q) rows = rows.filter(p => (p.title + ' ' + p.category + ' ' + p.excerpt).toLowerCase().includes(q));
  if (cat) rows = rows.filter(p => (p.category || '').toLowerCase() === cat);
  res.json(rows.reverse().map(resumen));
});

// GET /api/blogcms/categorias — categorías con artículos publicados (para los chips de filtro)
router.get('/categorias', async (req, res) => {
  const cats = [...new Set((await db.find('posts', p => p.published)).map(p => p.category).filter(Boolean))];
  res.json(cats);
});

// GET /api/blogcms/:id — artículo completo (solo si está publicado)
router.get('/:id', async (req, res) => {
  const p = await db.get('posts', req.params.id);
  if (!p || !p.published) return res.status(404).json({ error: 'Artículo inexistente' });
  res.json(completo(p));
});

// POST /api/blogcms/:id/view — suma una visita al artículo (contador real, público)
router.post('/:id/view', async (req, res) => {
  const p = await db.get('posts', req.params.id);
  if (!p || !p.published) return res.status(404).json({ error: 'Artículo inexistente' });
  const row = await db.update('posts', p.id, { views: (p.views || 0) + 1 });
  res.json({ views: row.views });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/blogcms/all/list — todos los artículos, publicados o no (solo admin)
router.get('/all/list', requireAdmin, async (req, res) => {
  res.json((await db.all('posts')).reverse());
});

// POST /api/blogcms — crea un artículo (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const cover = typeof req.body.cover === 'string' ? req.body.cover.trim().slice(0, 500) : '';
  const row = await db.insert('posts', {
    title: req.body.title.trim(),
    category: req.body.category.trim(),
    excerpt: req.body.excerpt.trim(),
    body: req.body.body.trim(),
    cover,
    published: req.body.published !== false,
    views: 0,
  });
  res.status(201).json(row);
});

// PATCH /api/blogcms/:id — edita un artículo o cambia su publicación (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.title !== undefined) { if (!str(req.body.title, 3, 160)) return res.status(422).json({ error: 'Título inválido' }); patch.title = req.body.title.trim(); }
  if (req.body.category !== undefined) { if (!str(req.body.category, 2, 60)) return res.status(422).json({ error: 'Categoría inválida' }); patch.category = req.body.category.trim(); }
  if (req.body.excerpt !== undefined) { if (!str(req.body.excerpt, 10, 320)) return res.status(422).json({ error: 'Extracto inválido' }); patch.excerpt = req.body.excerpt.trim(); }
  if (req.body.body !== undefined) { if (!str(req.body.body, 20, 20000)) return res.status(422).json({ error: 'Contenido inválido' }); patch.body = req.body.body.trim(); }
  if (req.body.cover !== undefined) patch.cover = typeof req.body.cover === 'string' ? req.body.cover.trim().slice(0, 500) : '';
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  const row = await db.update('posts', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Artículo inexistente' });
  res.json(row);
});

// DELETE /api/blogcms/:id — borra un artículo (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('posts', req.params.id);
  if (!p) return res.status(404).json({ error: 'Artículo inexistente' });
  await db.remove('posts', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de artículos (escribir, editar, publicar, borrar) requiere el módulo de autenticación:
// activalo en el Builder para habilitar /blog-admin.html. Sin él, se muestran los artículos
// sembrados y podés editarlos a mano en data/posts.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      blog: {
        title: 'Blog',
        html: `  <section>
    <div class="container">
      <div id="bl-list-view">
        <h2>Novedades</h2>
        <p class="section-sub">Consejos, novedades y todo lo que tenés que saber. Buscá o filtrá por categoría.</p>
        <div class="bl-tools">
          <input type="search" id="bl-search" class="bl-search" placeholder="Buscar en el blog…" aria-label="Buscar en el blog">
        </div>
        <div class="bl-cats" id="bl-cats"></div>
        <div id="bl-grid"><p class="bl-empty">Cargando artículos…</p></div>
      </div>
      <div id="bl-article-view" hidden></div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['blog-admin'] = {
        title: 'Artículos del blog',
        html: `  <section>
    <div class="container">
      <h2>Artículos del blog</h2>
      <p class="section-sub">Escribí y administrá las novedades de tu sitio. Solo visible para administradores.</p>
      <form id="bl-form" class="card" style="max-width:720px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <label>Título</label>
        <input name="title" required minlength="3" maxlength="160" placeholder="Ej: Novedades de la temporada">
        <label>Categoría</label>
        <input name="category" required minlength="2" maxlength="60" placeholder="Ej: Novedades" list="bl-cat-list">
        <datalist id="bl-cat-list"></datalist>
        <label>Imagen de portada (URL, opcional)</label>
        <input name="cover" maxlength="500" placeholder="https://… (dejalo vacío para usar un fondo de marca)">
        <label>Extracto (resumen corto para el listado)</label>
        <textarea name="excerpt" rows="2" required minlength="10" maxlength="320" placeholder="Un resumen breve que invite a leer el artículo."></textarea>
        <label>Contenido del artículo</label>
        <textarea name="body" rows="10" required minlength="20" maxlength="20000" placeholder="Escribí el artículo. Podés usar varios párrafos (se respetan los saltos de línea)."></textarea>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" name="published" checked style="width:auto"> Publicado (visible en /blog.html)</label>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn" type="submit" id="bl-save">Publicar artículo</button>
          <button class="btn ghost" type="button" id="bl-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="bl-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo blog administrable: página pública /blog.html (listado con buscador/filtro y artículo
   completo con contador de visitas real, animado con Anime.js) y, con auth activo, el ABM en
   /blog-admin.html. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEMO = [
    { id: 'd1', title: 'Bienvenidos a nuestro nuevo sitio', category: 'Novedades', excerpt: 'Renovamos por completo nuestra presencia online para atenderte mejor.', body: 'Después de varios meses de trabajo, estrenamos un sitio más rápido y claro.\\n\\n¡Gracias por acompañarnos!', cover: '', views: 42, createdAt: new Date().toISOString() },
    { id: 'd2', title: '3 consejos para aprovechar tu compra', category: 'Consejos', excerpt: 'Pequeños trucos que hacen una gran diferencia.', body: 'Queremos que aproveches al máximo lo que ofrecemos.\\n\\n1. Revisá las características.\\n2. Consultanos.\\n3. Aprovechá las promos.', cover: '', views: 18, createdAt: new Date().toISOString() },
  ];

  function fechaCorta(iso) { try { return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }

  function revelar(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [16, 0], duration: 480, delay: anime.stagger ? anime.stagger(60) : 0, ease: 'outCubic' });
    // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
    setTimeout(function () { nodos.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 700);
  }

  // ---- Página pública /blog.html ----
  var listView = document.getElementById('bl-list-view');
  var articleView = document.getElementById('bl-article-view');
  var grid = document.getElementById('bl-grid');
  if (grid && listView && articleView) {
    var search = document.getElementById('bl-search');
    var catsBox = document.getElementById('bl-cats');
    var catActiva = '';
    var contados = {};

    function coverStyle(cover) { return cover ? ' style="background-image:url(\\'' + App.esc(cover).replace(/'/g, '%27') + '\\')"' : ''; }

    function pintarLista(posts) {
      if (!posts.length) { grid.innerHTML = '<p class="bl-empty">No hay artículos para mostrar todavía.</p>'; return; }
      grid.innerHTML = posts.map(function (p) {
        return '<button class="bl-card" type="button" data-id="' + p.id + '">' +
          '<span class="bl-cover"' + coverStyle(p.cover) + '></span>' +
          '<span class="bl-body">' +
            '<span class="bl-cat">' + App.esc(p.category) + '</span>' +
            '<h3>' + App.esc(p.title) + '</h3>' +
            '<p>' + App.esc(p.excerpt) + '</p>' +
            '<span class="bl-meta"><span>' + fechaCorta(p.createdAt) + '</span><span>' + (p.views || 0) + ' lecturas</span></span>' +
          '</span></button>';
      }).join('');
      var cards = [].slice.call(grid.querySelectorAll('.bl-card'));
      cards.forEach(function (c) { c.addEventListener('click', function () { abrirArticulo(c.getAttribute('data-id')); }); });
      revelar(cards);
    }

    function pintarCats(cats) {
      if (!catsBox) return;
      var chips = ['<button class="bl-chip' + (catActiva ? '' : ' active') + '" type="button" data-cat="">Todas</button>'];
      cats.forEach(function (c) { chips.push('<button class="bl-chip' + (catActiva === c ? ' active' : '') + '" type="button" data-cat="' + App.esc(c) + '">' + App.esc(c) + '</button>'); });
      catsBox.innerHTML = chips.join('');
      catsBox.querySelectorAll('[data-cat]').forEach(function (b) {
        b.addEventListener('click', function () { catActiva = b.getAttribute('data-cat'); pintarCats(cats); cargarLista(); });
      });
    }

    function cargarLista() {
      var q = (search && search.value.trim()) || '';
      if (window.__PREVIEW__) {
        var f = q.toLowerCase();
        pintarLista(DEMO.filter(function (p) {
          return (!f || (p.title + p.category + p.excerpt).toLowerCase().indexOf(f) >= 0) && (!catActiva || p.category === catActiva);
        }));
        return;
      }
      var qs = [];
      if (q) qs.push('q=' + encodeURIComponent(q));
      if (catActiva) qs.push('cat=' + encodeURIComponent(catActiva));
      App.api('/api/blogcms' + (qs.length ? '?' + qs.join('&') : '')).then(pintarLista).catch(function () { grid.innerHTML = '<p class="bl-empty">No se pudo cargar el blog.</p>'; });
    }

    function abrirArticulo(id) {
      // Refleja el artículo abierto en la URL para poder compartir el enlace directo
      try { history.pushState({ post: id }, '', '?post=' + encodeURIComponent(id)); } catch (e) {}
      mostrarArticulo(id);
    }

    function mostrarArticulo(id) {
      function render(p) {
        listView.hidden = true;
        articleView.hidden = false;
        articleView.innerHTML = '<article class="bl-article">' +
          '<button class="bl-back" type="button" id="bl-volver">${phIcon('arrow-left', { size: 13 })} Volver al blog</button>' +
          (p.cover ? '<div class="bl-cover-full" style="background-image:url(\\'' + App.esc(p.cover).replace(/'/g, '%27') + '\\')"></div>' : '') +
          '<span class="bl-cat" style="color:var(--accent);font-weight:700;text-transform:uppercase;font-size:.72rem;letter-spacing:.04em">' + App.esc(p.category) + '</span>' +
          '<h2>' + App.esc(p.title) + '</h2>' +
          '<p class="bl-artmeta"><span>' + fechaCorta(p.createdAt) + '</span><span>·</span><span id="bl-views">' + (p.views || 0) + ' lecturas</span></p>' +
          '<div class="bl-content">' + App.esc(p.body) + '</div></article>';
        document.getElementById('bl-volver').addEventListener('click', volver);
        if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
        var anime = window.anime;
        if (anime && anime.animate && !reduce) anime.animate(articleView.querySelector('.bl-article'), { opacity: [0, 1], translateY: [12, 0], duration: 420, ease: 'outCubic' });
        // Suma una visita real (una vez por apertura de página)
        if (!contados[p.id]) {
          contados[p.id] = true;
          if (!window.__PREVIEW__) App.api('/api/blogcms/' + p.id + '/view', { method: 'POST' }).then(function (r) {
            var v = document.getElementById('bl-views');
            if (v && r && typeof r.views === 'number') v.textContent = r.views + ' lecturas';
          }).catch(function () {});
        }
      }
      if (window.__PREVIEW__) { var d = DEMO.filter(function (p) { return p.id === id; })[0] || DEMO[0]; render(d); return; }
      App.api('/api/blogcms/' + encodeURIComponent(id)).then(render).catch(function () {
        articleView.hidden = true; listView.hidden = false;
        App.toast('No encontramos ese artículo');
      });
    }

    function volver() {
      try { history.pushState({}, '', location.pathname); } catch (e) {}
      articleView.hidden = true; articleView.innerHTML = '';
      listView.hidden = false;
    }

    window.addEventListener('popstate', function () {
      var id = new URLSearchParams(location.search).get('post');
      if (id) mostrarArticulo(id); else volver();
    });

    if (search) { var t; search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(cargarLista, 250); }); }

    // Carga inicial: categorías + listado (o artículo directo si viene ?post=)
    if (window.__PREVIEW__) { pintarCats(['Novedades', 'Consejos']); }
    else App.api('/api/blogcms/categorias').then(pintarCats).catch(function () { pintarCats([]); });
    cargarLista();
    var inicial = new URLSearchParams(location.search).get('post');
    if (inicial) mostrarArticulo(inicial);
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM /blog-admin.html ----
  var adminBox = document.getElementById('bl-admin');
  var formA = document.getElementById('bl-form');
  if (adminBox && formA) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var idInput = formA.querySelector('[name="id"]');
    var cancelBtn = document.getElementById('bl-cancel');
    var saveBtn = document.getElementById('bl-save');
    var datalist = document.getElementById('bl-cat-list');

    function refrescarCats() {
      if (!datalist) return;
      var cats = {};
      todos.forEach(function (p) { if (p.category) cats[p.category] = 1; });
      datalist.innerHTML = Object.keys(cats).map(function (c) { return '<option value="' + App.esc(c) + '">'; }).join('');
    }

    function pintar() {
      adminBox.innerHTML = App.table(todos, [
        { key: 'title', label: 'Título' },
        { label: 'Categoría', render: function (r) { return '<span class="bl-badge">' + App.esc(r.category) + '</span>'; } },
        { label: 'Estado', render: function (r) { return r.published ? '<span class="bl-badge on">Publicado</span>' : '<span class="bl-badge">Borrador</span>'; } },
        { label: 'Lecturas', render: function (r) { return String(r.views || 0); } },
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
      formA.reset();
      idInput.value = '';
      formA.querySelector('[name="published"]').checked = true;
      saveBtn.textContent = 'Publicar artículo';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var p = todos.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      idInput.value = p.id;
      formA.querySelector('[name="title"]').value = p.title;
      formA.querySelector('[name="category"]').value = p.category;
      formA.querySelector('[name="cover"]').value = p.cover || '';
      formA.querySelector('[name="excerpt"]').value = p.excerpt;
      formA.querySelector('[name="body"]').value = p.body;
      formA.querySelector('[name="published"]').checked = !!p.published;
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formA.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function togglePub(id) {
      var p = todos.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: cambiaría publicación'); return; }
      try {
        var row = await App.api('/api/blogcms/' + id, { method: 'PATCH', body: { published: !p.published } });
        p.published = row.published; pintar();
        App.toast(p.published ? 'Artículo publicado' : 'Artículo despublicado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este artículo? No se puede deshacer.')) return;
      try {
        await App.api('/api/blogcms/' + id, { method: 'DELETE' });
        todos = todos.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Artículo borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formA.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = Object.fromEntries(new FormData(formA));
      datos.published = formA.querySelector('[name="published"]').checked;
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'publicaría') + ' el artículo'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/blogcms/' + editando, { method: 'PATCH', body: datos });
          todos = todos.map(function (r) { return r.id === editando ? upd : r; });
          App.toast('Cambios guardados');
        } else {
          var nuevo = await App.api('/api/blogcms', { method: 'POST', body: datos });
          todos.unshift(nuevo);
          App.toast('Artículo publicado');
        }
        resetForm();
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function listo(rows) { todos = rows; pintar(); }
    if (window.__PREVIEW__) {
      listo([
        { id: 'd1', title: 'Bienvenidos a nuestro nuevo sitio', category: 'Novedades', excerpt: 'Renovamos nuestra presencia online.', body: 'Texto del artículo.', cover: '', published: true, views: 42, createdAt: new Date().toISOString() },
        { id: 'd9', title: 'Borrador sin publicar', category: 'Consejos', excerpt: 'Todavía en preparación.', body: 'Texto en progreso.', cover: '', published: false, views: 0, createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/blogcms/all/list').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navB = document.getElementById('nav-blog-admin');
    if (navB && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navB.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Blog administrable**: los artículos viven en la colección \`posts\` y se muestran en \`/blog.html\` con buscador, filtro por categoría y contador de lecturas real. Se siembran dos artículos de ejemplo la primera vez. ${cfg.moduleIds.includes('auth') ? 'Los administradores escriben, editan, publican y borran artículos en \`/blog-admin.html\`. La portada es opcional (URL de una imagen).' : 'Para escribir y administrar artículos desde la web activá el módulo **Autenticación** (habilita \`/blog-admin.html\`); sin él, editá \`data/posts.json\` a mano.'} Cada artículo tiene enlace directo compartible (\`/blog.html?post=<id>\`).`,
  ],
};
