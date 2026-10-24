// Portafolio / trabajos realizados administrable con backend real: una página pública
// /proyectos.html que lista los proyectos publicados (traídos del servidor) con buscador y filtro
// por categoría/rubro, y abre cada proyecto completo en la misma página (?proyecto=<id>) sumando una
// visita real (colección projects). Con el módulo de autenticación activo, /proyectos-admin.html es
// un ABM solo-admin para crear, editar, publicar/despublicar y borrar proyectos. Se siembran tres
// proyectos de ejemplo la primera vez para que el portafolio tenga contenido desde el arranque,
// incluso sin auth. La aparición de las tarjetas y del detalle se anima con Anime.js (stagger + red
// de seguridad, respeta "prefers-reduced-motion"). Pensado para estudios, agencias, freelancers,
// constructoras, arquitectos y cualquier negocio que muestre casos de trabajo. Distinto de
// "portfolio" (UI estática con trabajos fijos en el HTML), de "listings" (avisos clasificados con
// precio) y de "products-admin" (catálogo e-commerce con stock/carrito): acá el negocio administra
// sus casos de trabajo desde la web y se sirven dinámicamente, con enlace opcional al proyecto real.

// Proyectos de ejemplo (se siembran la primera vez; el negocio los edita o borra desde el ABM).
const SEMILLA = [
  { title: 'Rediseño de marca para cafetería', category: 'Branding', client: 'Café del Barrio', excerpt: 'Nueva identidad visual completa: logo, paleta, packaging y cartelería para una cafetería de especialidad.', body: 'El desafío era modernizar la imagen sin perder la calidez que caracteriza al lugar.\n\nTrabajamos la identidad de punta a punta: logotipo, sistema de color, tipografías, packaging de café en grano y toda la cartelería del local. El resultado fue una marca más reconocible que aumentó la venta de productos para llevar.', cover: '', url: '', published: true, views: 0 },
  { title: 'Tienda online de indumentaria', category: 'Desarrollo web', client: 'Moda Norte', excerpt: 'E-commerce a medida con catálogo, carrito y medios de pago integrados. Más ventas y menos consultas repetidas.', body: 'Desarrollamos una tienda online rápida y fácil de administrar.\n\nEl cliente ahora carga sus productos en minutos, gestiona stock y recibe los pedidos organizados. En el primer trimestre las ventas online crecieron de forma sostenida y bajaron las consultas por WhatsApp sobre precios y disponibilidad.', cover: '', url: '', published: true, views: 0 },
  { title: 'Reforma integral de local comercial', category: 'Obra', client: 'Farmacia Central', excerpt: 'Puesta en valor de un local de 120 m²: nueva distribución, iluminación y frente. Entregado en tiempo y forma.', body: 'Encaramos la reforma completa manteniendo el local operativo por etapas.\n\nRediseñamos la distribución para mejorar la circulación, renovamos la instalación eléctrica y la iluminación, y ejecutamos un frente nuevo. La obra se entregó dentro del plazo pactado y sin cortar la atención al público.', cover: '', url: '', published: true, views: 0 },
];

module.exports = {
  id: 'projects', type: 'functional', name: 'Portafolio administrable',
  description: 'Portafolio de trabajos con backend: página pública /proyectos.html que lista los casos publicados (buscador + filtro por rubro) y los abre completos sumando visitas reales (Anime.js). Con auth activo, ABM solo-admin en /proyectos-admin.html para crear, editar, publicar y borrar proyectos, con enlace opcional al proyecto real.',
  usesAnime: true,
  mounts: [{ route: '/api/projects', file: 'routes/projects.js' }],
  collections: ['projects'],
  nav: (cfg) => {
    const links = [{ label: 'Proyectos', href: '/proyectos.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Portafolio', href: '/proyectos-admin.html', id: 'nav-proyectos-admin' });
    return links;
  },
  head: () => `  <style>
    .pj-tools{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 24px}
    .pj-search{flex:1;min-width:220px;max-width:420px}
    .pj-cats{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 24px}
    .pj-chip{background:var(--surface);border:1px solid var(--line);color:var(--text);border-radius:999px;padding:5px 14px;font:inherit;font-size:.85rem;cursor:pointer}
    .pj-chip.active{background:var(--accent);border-color:transparent;color:#fff}
    .pj-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
    .pj-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;text-align:left;padding:0;cursor:pointer;font:inherit;color:inherit}
    .pj-card .pj-cover{aspect-ratio:16/10;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 18%,var(--surface)),var(--surface));display:block;background-size:cover;background-position:center}
    .pj-card .pj-body{padding:16px 18px;display:flex;flex-direction:column;gap:8px;flex:1}
    .pj-card .pj-cat{font-size:.72rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em}
    .pj-card h3{margin:0;font-size:1.1rem;line-height:1.3}
    .pj-card p{margin:0;color:var(--muted);font-size:.92rem;flex:1}
    .pj-card .pj-meta{font-size:.78rem;color:var(--muted);display:flex;justify-content:space-between;gap:8px}
    .pj-empty{color:var(--muted)}
    .pj-detail{max-width:760px}
    .pj-detail .pj-cover-full{width:100%;aspect-ratio:16/8;border-radius:var(--radius);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 18%,var(--surface)),var(--surface));background-size:cover;background-position:center;margin:0 0 20px}
    .pj-detail h2{margin:0 0 8px}
    .pj-detail .pj-artmeta{color:var(--muted);font-size:.85rem;margin:0 0 24px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
    .pj-detail .pj-content{white-space:pre-line;line-height:1.7}
    .pj-detail .pj-link{display:inline-block;margin:22px 0 0}
    .pj-back{background:transparent;border:0;color:var(--accent);font:inherit;cursor:pointer;padding:0;margin:0 0 18px;display:inline-flex;align-items:center;gap:6px}
    .pj-badge{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;vertical-align:baseline;background:var(--surface);border:1px solid var(--line)}
    .pj-badge.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
  </style>`,
  files: (cfg) => ({
    'routes/projects.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Siembra proyectos de ejemplo la primera vez para que /proyectos.html tenga contenido desde el arranque
db.seedIfEmpty('projects', ${JSON.stringify(SEMILLA, null, 2)});

const validar = (data) => check(data, {
  title: (v) => str(v, 3, 160),
  category: (v) => str(v, 2, 60),
  excerpt: (v) => str(v, 10, 320),
  body: (v) => str(v, 20, 20000),
});

// Normaliza el enlace opcional al proyecto real (solo http/https; vacío si no corresponde)
function limpiarUrl(v) {
  const s = typeof v === 'string' ? v.trim().slice(0, 500) : '';
  return /^https?:\\/\\//i.test(s) ? s : '';
}

// Vista pública en el listado (sin el cuerpo completo, para no mandar todo de una)
const resumen = (p) => ({ id: p.id, title: p.title, category: p.category, client: p.client || '', excerpt: p.excerpt, cover: p.cover || '', views: p.views || 0, createdAt: p.createdAt });
// Vista pública del proyecto completo
const completo = (p) => ({ id: p.id, title: p.title, category: p.category, client: p.client || '', excerpt: p.excerpt, body: p.body, cover: p.cover || '', url: p.url || '', views: p.views || 0, createdAt: p.createdAt });

// GET /api/projects — proyectos publicados; ?q= filtra por título/rubro/cliente/extracto, ?cat= por rubro
router.get('/', async (req, res) => {
  let rows = await db.find('projects', p => p.published);
  const q = String(req.query.q || '').trim().toLowerCase();
  const cat = String(req.query.cat || '').trim().toLowerCase();
  if (q) rows = rows.filter(p => (p.title + ' ' + p.category + ' ' + (p.client || '') + ' ' + p.excerpt).toLowerCase().includes(q));
  if (cat) rows = rows.filter(p => (p.category || '').toLowerCase() === cat);
  res.json(rows.reverse().map(resumen));
});

// GET /api/projects/categorias — rubros con proyectos publicados (para los chips de filtro)
router.get('/categorias', async (req, res) => {
  const cats = [...new Set((await db.find('projects', p => p.published)).map(p => p.category).filter(Boolean))];
  res.json(cats);
});

// GET /api/projects/:id — proyecto completo (solo si está publicado)
router.get('/:id', async (req, res) => {
  const p = await db.get('projects', req.params.id);
  if (!p || !p.published) return res.status(404).json({ error: 'Proyecto inexistente' });
  res.json(completo(p));
});

// POST /api/projects/:id/view — suma una visita al proyecto (contador real, público)
router.post('/:id/view', async (req, res) => {
  const p = await db.get('projects', req.params.id);
  if (!p || !p.published) return res.status(404).json({ error: 'Proyecto inexistente' });
  const row = await db.update('projects', p.id, { views: (p.views || 0) + 1 });
  res.json({ views: row.views });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/projects/all/list — todos los proyectos, publicados o no (solo admin)
router.get('/all/list', requireAdmin, async (req, res) => {
  res.json((await db.all('projects')).reverse());
});

// POST /api/projects — crea un proyecto (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const cover = typeof req.body.cover === 'string' ? req.body.cover.trim().slice(0, 500) : '';
  const row = await db.insert('projects', {
    title: req.body.title.trim(),
    category: req.body.category.trim(),
    client: typeof req.body.client === 'string' ? req.body.client.trim().slice(0, 120) : '',
    excerpt: req.body.excerpt.trim(),
    body: req.body.body.trim(),
    cover,
    url: limpiarUrl(req.body.url),
    published: req.body.published !== false,
    views: 0,
  });
  res.status(201).json(row);
});

// PATCH /api/projects/:id — edita un proyecto o cambia su publicación (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.title !== undefined) { if (!str(req.body.title, 3, 160)) return res.status(422).json({ error: 'Título inválido' }); patch.title = req.body.title.trim(); }
  if (req.body.category !== undefined) { if (!str(req.body.category, 2, 60)) return res.status(422).json({ error: 'Rubro inválido' }); patch.category = req.body.category.trim(); }
  if (req.body.client !== undefined) patch.client = typeof req.body.client === 'string' ? req.body.client.trim().slice(0, 120) : '';
  if (req.body.excerpt !== undefined) { if (!str(req.body.excerpt, 10, 320)) return res.status(422).json({ error: 'Extracto inválido' }); patch.excerpt = req.body.excerpt.trim(); }
  if (req.body.body !== undefined) { if (!str(req.body.body, 20, 20000)) return res.status(422).json({ error: 'Descripción inválida' }); patch.body = req.body.body.trim(); }
  if (req.body.cover !== undefined) patch.cover = typeof req.body.cover === 'string' ? req.body.cover.trim().slice(0, 500) : '';
  if (req.body.url !== undefined) patch.url = limpiarUrl(req.body.url);
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  const row = await db.update('projects', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Proyecto inexistente' });
  res.json(row);
});

// DELETE /api/projects/:id — borra un proyecto (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('projects', req.params.id);
  if (!p) return res.status(404).json({ error: 'Proyecto inexistente' });
  await db.remove('projects', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de proyectos (crear, editar, publicar, borrar) requiere el módulo de autenticación:
// activalo en el Builder para habilitar /proyectos-admin.html. Sin él, se muestran los proyectos
// sembrados y podés editarlos a mano en data/projects.json.
`}module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      proyectos: {
        title: 'Proyectos',
        html: `  <section>
    <div class="container">
      <div id="pj-list-view">
        <h2>Nuestros proyectos</h2>
        <p class="section-sub">Una selección de los trabajos que hicimos. Buscá o filtrá por rubro.</p>
        <div class="pj-tools">
          <input type="search" id="pj-search" class="pj-search" placeholder="Buscar proyecto…" aria-label="Buscar proyecto">
        </div>
        <div class="pj-cats" id="pj-cats"></div>
        <div id="pj-grid"><p class="pj-empty">Cargando proyectos…</p></div>
      </div>
      <div id="pj-detail-view" hidden></div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['proyectos-admin'] = {
        title: 'Portafolio',
        html: `  <section>
    <div class="container">
      <h2>Portafolio</h2>
      <p class="section-sub">Cargá y administrá los proyectos que mostrás en tu sitio. Solo visible para administradores.</p>
      <form id="pj-form" class="card" style="max-width:760px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <label>Título del proyecto</label>
        <input name="title" required minlength="3" maxlength="160" placeholder="Ej: Rediseño de marca para cafetería">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Rubro / categoría</label><input name="category" required minlength="2" maxlength="60" placeholder="Ej: Branding" list="pj-cat-list"><datalist id="pj-cat-list"></datalist></div>
          <div><label>Cliente (opcional)</label><input name="client" maxlength="120" placeholder="Ej: Café del Barrio"></div>
        </div>
        <label>Imagen de portada (URL, opcional)</label>
        <input name="cover" maxlength="500" placeholder="https://… (dejalo vacío para usar un fondo de marca)">
        <label>Enlace al proyecto (opcional)</label>
        <input name="url" maxlength="500" placeholder="https://… (sitio, video o galería del trabajo)">
        <label>Resumen (para el listado)</label>
        <textarea name="excerpt" rows="2" required minlength="10" maxlength="320" placeholder="Una línea que resuma el proyecto y su resultado."></textarea>
        <label>Descripción completa</label>
        <textarea name="body" rows="9" required minlength="20" maxlength="20000" placeholder="Contá el desafío, la solución y los resultados. Podés usar varios párrafos."></textarea>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" name="published" checked style="width:auto"> Publicado (visible en /proyectos.html)</label>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn" type="submit" id="pj-save">Publicar proyecto</button>
          <button class="btn ghost" type="button" id="pj-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="pj-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo portafolio administrable: página pública /proyectos.html (listado con buscador/filtro y
   detalle con contador de visitas real, animado con Anime.js) y, con auth activo, el ABM en
   /proyectos-admin.html. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEMO = [
    { id: 'd1', title: 'Rediseño de marca para cafetería', category: 'Branding', client: 'Café del Barrio', excerpt: 'Nueva identidad visual completa para una cafetería de especialidad.', body: 'El desafío era modernizar la imagen sin perder la calidez.\\n\\nTrabajamos logo, color, tipografías y packaging.', cover: '', url: '', views: 57, createdAt: new Date().toISOString() },
    { id: 'd2', title: 'Tienda online de indumentaria', category: 'Desarrollo web', client: 'Moda Norte', excerpt: 'E-commerce a medida con catálogo, carrito y pagos.', body: 'Desarrollamos una tienda rápida y fácil de administrar.\\n\\nLas ventas online crecieron sostenidamente.', cover: '', url: 'https://ejemplo.com', views: 33, createdAt: new Date().toISOString() },
  ];

  function fechaCorta(iso) { try { return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }

  function revelar(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [16, 0], duration: 480, delay: anime.stagger ? anime.stagger(60) : 0, ease: 'outCubic' });
    // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
    setTimeout(function () { nodos.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 700);
  }

  // ---- Página pública /proyectos.html ----
  var listView = document.getElementById('pj-list-view');
  var detailView = document.getElementById('pj-detail-view');
  var grid = document.getElementById('pj-grid');
  if (grid && listView && detailView) {
    var search = document.getElementById('pj-search');
    var catsBox = document.getElementById('pj-cats');
    var catActiva = '';
    var contados = {};

    function coverStyle(cover) { return cover ? ' style="background-image:url(\\'' + App.esc(cover).replace(/'/g, '%27') + '\\')"' : ''; }

    function pintarLista(items) {
      if (!items.length) { grid.innerHTML = '<p class="pj-empty">No hay proyectos para mostrar todavía.</p>'; return; }
      grid.innerHTML = items.map(function (p) {
        return '<button class="pj-card" type="button" data-id="' + p.id + '">' +
          '<span class="pj-cover"' + coverStyle(p.cover) + '></span>' +
          '<span class="pj-body">' +
            '<span class="pj-cat">' + App.esc(p.category) + '</span>' +
            '<h3>' + App.esc(p.title) + '</h3>' +
            '<p>' + App.esc(p.excerpt) + '</p>' +
            '<span class="pj-meta"><span>' + (p.client ? App.esc(p.client) : fechaCorta(p.createdAt)) + '</span><span>' + (p.views || 0) + ' vistas</span></span>' +
          '</span></button>';
      }).join('');
      var cards = [].slice.call(grid.querySelectorAll('.pj-card'));
      cards.forEach(function (c) { c.addEventListener('click', function () { abrirDetalle(c.getAttribute('data-id')); }); });
      revelar(cards);
    }

    function pintarCats(cats) {
      if (!catsBox) return;
      var chips = ['<button class="pj-chip' + (catActiva ? '' : ' active') + '" type="button" data-cat="">Todos</button>'];
      cats.forEach(function (c) { chips.push('<button class="pj-chip' + (catActiva === c ? ' active' : '') + '" type="button" data-cat="' + App.esc(c) + '">' + App.esc(c) + '</button>'); });
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
          return (!f || (p.title + p.category + p.client + p.excerpt).toLowerCase().indexOf(f) >= 0) && (!catActiva || p.category === catActiva);
        }));
        return;
      }
      var qs = [];
      if (q) qs.push('q=' + encodeURIComponent(q));
      if (catActiva) qs.push('cat=' + encodeURIComponent(catActiva));
      App.api('/api/projects' + (qs.length ? '?' + qs.join('&') : '')).then(pintarLista).catch(function () { grid.innerHTML = '<p class="pj-empty">No se pudo cargar el portafolio.</p>'; });
    }

    function abrirDetalle(id) {
      try { history.pushState({ proyecto: id }, '', '?proyecto=' + encodeURIComponent(id)); } catch (e) {}
      mostrarDetalle(id);
    }

    function mostrarDetalle(id) {
      function render(p) {
        listView.hidden = true;
        detailView.hidden = false;
        detailView.innerHTML = '<article class="pj-detail">' +
          '<button class="pj-back" type="button" id="pj-volver">← Volver a proyectos</button>' +
          (p.cover ? '<div class="pj-cover-full" style="background-image:url(\\'' + App.esc(p.cover).replace(/'/g, '%27') + '\\')"></div>' : '') +
          '<span class="pj-cat" style="color:var(--accent);font-weight:700;text-transform:uppercase;font-size:.72rem;letter-spacing:.04em">' + App.esc(p.category) + '</span>' +
          '<h2>' + App.esc(p.title) + '</h2>' +
          '<p class="pj-artmeta">' + (p.client ? '<span>Cliente: ' + App.esc(p.client) + '</span><span>·</span>' : '') + '<span>' + fechaCorta(p.createdAt) + '</span><span>·</span><span id="pj-views">' + (p.views || 0) + ' vistas</span></p>' +
          '<div class="pj-content">' + App.esc(p.body) + '</div>' +
          (p.url ? '<a class="btn pj-link" href="' + App.esc(p.url).replace(/"/g, '%22') + '" target="_blank" rel="noopener">Ver el proyecto →</a>' : '') +
          '</article>';
        document.getElementById('pj-volver').addEventListener('click', volver);
        if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
        var anime = window.anime;
        if (anime && anime.animate && !reduce) anime.animate(detailView.querySelector('.pj-detail'), { opacity: [0, 1], translateY: [12, 0], duration: 420, ease: 'outCubic' });
        // Suma una visita real (una vez por apertura de página)
        if (!contados[p.id]) {
          contados[p.id] = true;
          if (!window.__PREVIEW__) App.api('/api/projects/' + p.id + '/view', { method: 'POST' }).then(function (r) {
            var v = document.getElementById('pj-views');
            if (v && r && typeof r.views === 'number') v.textContent = r.views + ' vistas';
          }).catch(function () {});
        }
      }
      if (window.__PREVIEW__) { var d = DEMO.filter(function (p) { return p.id === id; })[0] || DEMO[0]; render(d); return; }
      App.api('/api/projects/' + encodeURIComponent(id)).then(render).catch(function () {
        detailView.hidden = true; listView.hidden = false;
        App.toast('No encontramos ese proyecto');
      });
    }

    function volver() {
      try { history.pushState({}, '', location.pathname); } catch (e) {}
      detailView.hidden = true; detailView.innerHTML = '';
      listView.hidden = false;
    }

    window.addEventListener('popstate', function () {
      var id = new URLSearchParams(location.search).get('proyecto');
      if (id) mostrarDetalle(id); else volver();
    });

    if (search) { var t; search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(cargarLista, 250); }); }

    if (window.__PREVIEW__) { pintarCats(['Branding', 'Desarrollo web']); }
    else App.api('/api/projects/categorias').then(pintarCats).catch(function () { pintarCats([]); });
    cargarLista();
    var inicial = new URLSearchParams(location.search).get('proyecto');
    if (inicial) mostrarDetalle(inicial);
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM /proyectos-admin.html ----
  var adminBox = document.getElementById('pj-admin');
  var formA = document.getElementById('pj-form');
  if (adminBox && formA) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var idInput = formA.querySelector('[name="id"]');
    var cancelBtn = document.getElementById('pj-cancel');
    var saveBtn = document.getElementById('pj-save');
    var datalist = document.getElementById('pj-cat-list');

    function refrescarCats() {
      if (!datalist) return;
      var cats = {};
      todos.forEach(function (p) { if (p.category) cats[p.category] = 1; });
      datalist.innerHTML = Object.keys(cats).map(function (c) { return '<option value="' + App.esc(c) + '">'; }).join('');
    }

    function pintar() {
      adminBox.innerHTML = App.table(todos, [
        { key: 'title', label: 'Proyecto' },
        { label: 'Rubro', render: function (r) { return '<span class="pj-badge">' + App.esc(r.category) + '</span>'; } },
        { label: 'Cliente', render: function (r) { return r.client ? App.esc(r.client) : '<span class="muted">—</span>'; } },
        { label: 'Estado', render: function (r) { return r.published ? '<span class="pj-badge on">Publicado</span>' : '<span class="pj-badge">Borrador</span>'; } },
        { label: 'Vistas', render: function (r) { return String(r.views || 0); } },
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
      saveBtn.textContent = 'Publicar proyecto';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var p = todos.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      idInput.value = p.id;
      formA.querySelector('[name="title"]').value = p.title;
      formA.querySelector('[name="category"]').value = p.category;
      formA.querySelector('[name="client"]').value = p.client || '';
      formA.querySelector('[name="cover"]').value = p.cover || '';
      formA.querySelector('[name="url"]').value = p.url || '';
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
        var row = await App.api('/api/projects/' + id, { method: 'PATCH', body: { published: !p.published } });
        p.published = row.published; pintar();
        App.toast(p.published ? 'Proyecto publicado' : 'Proyecto despublicado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este proyecto? No se puede deshacer.')) return;
      try {
        await App.api('/api/projects/' + id, { method: 'DELETE' });
        todos = todos.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Proyecto borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formA.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = Object.fromEntries(new FormData(formA));
      datos.published = formA.querySelector('[name="published"]').checked;
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'publicaría') + ' el proyecto'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/projects/' + editando, { method: 'PATCH', body: datos });
          todos = todos.map(function (r) { return r.id === editando ? upd : r; });
          App.toast('Cambios guardados');
        } else {
          var nuevo = await App.api('/api/projects', { method: 'POST', body: datos });
          todos.unshift(nuevo);
          App.toast('Proyecto publicado');
        }
        resetForm();
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function listo(rows) { todos = rows; pintar(); }
    if (window.__PREVIEW__) {
      listo([
        { id: 'd1', title: 'Rediseño de marca para cafetería', category: 'Branding', client: 'Café del Barrio', excerpt: 'Nueva identidad visual completa.', body: 'Texto del proyecto.', cover: '', url: '', published: true, views: 57, createdAt: new Date().toISOString() },
        { id: 'd9', title: 'Proyecto en preparación', category: 'Obra', client: '', excerpt: 'Todavía sin publicar.', body: 'Texto en progreso.', cover: '', url: '', published: false, views: 0, createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/projects/all/list').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navP = document.getElementById('nav-proyectos-admin');
    if (navP && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navP.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Portafolio administrable**: los proyectos viven en la colección \`projects\` y se muestran en \`/proyectos.html\` con buscador, filtro por rubro y contador de vistas real. Se siembran tres proyectos de ejemplo la primera vez. ${cfg.moduleIds.includes('auth') ? 'Los administradores crean, editan, publican y borran proyectos en \`/proyectos-admin.html\`. La portada y el enlace al proyecto son opcionales (URL).' : 'Para cargar y administrar proyectos desde la web activá el módulo **Autenticación** (habilita \`/proyectos-admin.html\`); sin él, editá \`data/projects.json\` a mano.'} Cada proyecto tiene enlace directo compartible (\`/proyectos.html?proyecto=<id>\`).`,
  ],
};
