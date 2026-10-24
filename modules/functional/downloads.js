// Centro de descargas / biblioteca de recursos administrable con backend real: una página pública
// /descargables.html que lista los archivos publicados (traídos del servidor) agrupados por
// categoría, con buscador, y donde cada descarga pasa por el servidor que suma una descarga real al
// contador (colección downloads) antes de abrir el archivo. Con el módulo de autenticación activo,
// /descargables-admin.html es un ABM solo-admin para cargar recursos (título, categoría, URL del
// archivo, descripción y peso opcional), publicar/despublicar y borrar, viendo la cantidad de
// descargas de cada uno. Se siembran tres recursos de ejemplo la primera vez. La aparición de las
// tarjetas y el count-up del contador se animan con Anime.js (stagger + red de seguridad, respeta
// "prefers-reduced-motion"). Pensado para catálogos en PDF, listas de precios, manuales, fichas
// técnicas, brochures y material descargable en general. Distinto de "leadmagnet" (un único
// descargable con registro de email para captar leads) y de "resources" (UI estática con enlaces
// fijos): acá el negocio administra una biblioteca de archivos y mide cuánto se descarga cada uno.

// Recursos de ejemplo (se siembran la primera vez; el negocio los edita o borra desde el ABM).
const SEMILLA = [
  { title: 'Catálogo de productos', category: 'Catálogos', desc: 'Todo nuestro catálogo actualizado con precios y especificaciones.', url: '', size: '2.4 MB', published: true, downloads: 0 },
  { title: 'Lista de precios mayorista', category: 'Precios', desc: 'Precios y condiciones para revendedores y compras por volumen.', url: '', size: '480 KB', published: true, downloads: 0 },
  { title: 'Manual de uso y cuidados', category: 'Guías', desc: 'Guía práctica para aprovechar al máximo tu compra y mantenerla en buen estado.', url: '', size: '1.1 MB', published: true, downloads: 0 },
];

module.exports = {
  id: 'downloads', type: 'functional', name: 'Centro de descargas',
  description: 'Biblioteca de recursos descargables con backend: página pública /descargables.html que lista archivos por categoría (buscador) y cuenta cada descarga real vía servidor (Anime.js). Con auth activo, ABM solo-admin en /descargables-admin.html para cargar, publicar y borrar recursos, viendo cuántas veces se descargó cada uno.',
  usesAnime: true,
  mounts: [{ route: '/api/downloads', file: 'routes/downloads.js' }],
  collections: ['downloads'],
  nav: (cfg) => {
    const links = [{ label: 'Descargas', href: '/descargables.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Recursos', href: '/descargables-admin.html', id: 'nav-descargables-admin' });
    return links;
  },
  head: () => `  <style>
    .dl-tools{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 24px}
    .dl-search{flex:1;min-width:220px;max-width:420px}
    .dl-group{margin:0 0 30px}
    .dl-group h3{margin:0 0 14px;font-size:1.15rem;display:flex;align-items:center;gap:10px}
    .dl-group h3 .dl-count{font-size:.78rem;font-weight:600;color:var(--muted)}
    .dl-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
    .dl-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;display:flex;flex-direction:column;gap:8px}
    .dl-card .dl-ic{width:40px;height:40px;border-radius:var(--radius);display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--accent) 16%,var(--surface));color:var(--accent);flex-shrink:0}
    .dl-card h4{margin:0;font-size:1.05rem;line-height:1.3}
    .dl-card p{margin:0;color:var(--muted);font-size:.9rem;flex:1}
    .dl-card .dl-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px;font-size:.8rem;color:var(--muted)}
    .dl-card .dl-btn{margin-top:6px}
    .dl-dcount{font-variant-numeric:tabular-nums}
    .dl-empty{color:var(--muted)}
    .dl-badge{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;vertical-align:baseline;background:var(--surface);border:1px solid var(--line)}
    .dl-badge.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
  </style>`,
  files: (cfg) => ({
    'routes/downloads.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Siembra recursos de ejemplo la primera vez para que /descargables.html tenga contenido desde el arranque
db.seedIfEmpty('downloads', ${JSON.stringify(SEMILLA, null, 2)});

const validar = (data) => check(data, {
  title: (v) => str(v, 3, 140),
  category: (v) => str(v, 2, 60),
  desc: (v) => str(v, 5, 400),
});

// Normaliza la URL del archivo (solo http/https; vacío = todavía sin archivo cargado)
function limpiarUrl(v) {
  const s = typeof v === 'string' ? v.trim().slice(0, 600) : '';
  return /^https?:\\/\\//i.test(s) ? s : '';
}

// Vista pública de un recurso (sin exponer nada interno)
const publico = (d) => ({ id: d.id, title: d.title, category: d.category, desc: d.desc, url: d.url || '', size: d.size || '', downloads: d.downloads || 0 });

// GET /api/downloads — recursos publicados; ?q= filtra por título/categoría/descripción, ?cat= por categoría
router.get('/', async (req, res) => {
  let rows = await db.find('downloads', d => d.published);
  const q = String(req.query.q || '').trim().toLowerCase();
  const cat = String(req.query.cat || '').trim().toLowerCase();
  if (q) rows = rows.filter(d => (d.title + ' ' + d.category + ' ' + d.desc).toLowerCase().includes(q));
  if (cat) rows = rows.filter(d => (d.category || '').toLowerCase() === cat);
  res.json(rows.map(publico));
});

// POST /api/downloads/:id/get — registra una descarga real y devuelve la URL del archivo (público)
router.post('/:id/get', async (req, res) => {
  const d = await db.get('downloads', req.params.id);
  if (!d || !d.published) return res.status(404).json({ error: 'Recurso inexistente' });
  const row = await db.update('downloads', d.id, { downloads: (d.downloads || 0) + 1 });
  res.json({ url: d.url || '', downloads: row.downloads });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/downloads/all/list — todos los recursos, publicados o no (solo admin)
router.get('/all/list', requireAdmin, async (req, res) => {
  res.json((await db.all('downloads')).reverse());
});

// POST /api/downloads — carga un recurso (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const row = await db.insert('downloads', {
    title: req.body.title.trim(),
    category: req.body.category.trim(),
    desc: req.body.desc.trim(),
    url: limpiarUrl(req.body.url),
    size: typeof req.body.size === 'string' ? req.body.size.trim().slice(0, 40) : '',
    published: req.body.published !== false,
    downloads: 0,
  });
  res.status(201).json(row);
});

// PATCH /api/downloads/:id — edita un recurso o cambia su publicación (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.title !== undefined) { if (!str(req.body.title, 3, 140)) return res.status(422).json({ error: 'Título inválido' }); patch.title = req.body.title.trim(); }
  if (req.body.category !== undefined) { if (!str(req.body.category, 2, 60)) return res.status(422).json({ error: 'Categoría inválida' }); patch.category = req.body.category.trim(); }
  if (req.body.desc !== undefined) { if (!str(req.body.desc, 5, 400)) return res.status(422).json({ error: 'Descripción inválida' }); patch.desc = req.body.desc.trim(); }
  if (req.body.url !== undefined) patch.url = limpiarUrl(req.body.url);
  if (req.body.size !== undefined) patch.size = typeof req.body.size === 'string' ? req.body.size.trim().slice(0, 40) : '';
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  const row = await db.update('downloads', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Recurso inexistente' });
  res.json(row);
});

// DELETE /api/downloads/:id — borra un recurso (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const d = await db.get('downloads', req.params.id);
  if (!d) return res.status(404).json({ error: 'Recurso inexistente' });
  await db.remove('downloads', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de recursos (cargar, publicar, borrar) requiere el módulo de autenticación: activalo en el
// Builder para habilitar /descargables-admin.html. Sin él, se muestran los recursos sembrados y
// podés editarlos a mano en data/downloads.json.
`}module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      descargables: {
        title: 'Descargas',
        html: `  <section>
    <div class="container">
      <h2>Centro de descargas</h2>
      <p class="section-sub">Catálogos, listas de precios, manuales y más. Descargá el material que necesites.</p>
      <div class="dl-tools">
        <input type="search" id="dl-search" class="dl-search" placeholder="Buscar recurso…" aria-label="Buscar recurso">
      </div>
      <div id="dl-list"><p class="dl-empty">Cargando recursos…</p></div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['descargables-admin'] = {
        title: 'Recursos descargables',
        html: `  <section>
    <div class="container">
      <h2>Recursos descargables</h2>
      <p class="section-sub">Cargá los archivos que ofrecés en tu sitio y mirá cuántas veces se descargó cada uno. Solo visible para administradores.</p>
      <form id="dl-form" class="card" style="max-width:700px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <label>Título del recurso</label>
        <input name="title" required minlength="3" maxlength="140" placeholder="Ej: Catálogo de productos">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Categoría</label><input name="category" required minlength="2" maxlength="60" placeholder="Ej: Catálogos" list="dl-cat-list"><datalist id="dl-cat-list"></datalist></div>
          <div><label>Peso del archivo (opcional)</label><input name="size" maxlength="40" placeholder="Ej: 2.4 MB"></div>
        </div>
        <label>URL del archivo (opcional hasta subirlo)</label>
        <input name="url" maxlength="600" placeholder="https://… (enlace directo al PDF/archivo)">
        <label>Descripción</label>
        <textarea name="desc" rows="3" required minlength="5" maxlength="400" placeholder="Contá qué contiene el archivo."></textarea>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" name="published" checked style="width:auto"> Publicado (visible en /descargables.html)</label>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn" type="submit" id="dl-save">Cargar recurso</button>
          <button class="btn ghost" type="button" id="dl-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="dl-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo centro de descargas: página pública /descargables.html (recursos por categoría, buscador y
   descarga contada por el servidor con count-up de Anime.js) y, con auth activo, el ABM en
   /descargables-admin.html. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEMO = [
    { id: 'd1', title: 'Catálogo de productos', category: 'Catálogos', desc: 'Todo nuestro catálogo actualizado con precios.', url: '', size: '2.4 MB', downloads: 128 },
    { id: 'd2', title: 'Lista de precios mayorista', category: 'Precios', desc: 'Precios y condiciones para revendedores.', url: '', size: '480 KB', downloads: 54 },
    { id: 'd3', title: 'Manual de uso y cuidados', category: 'Guías', desc: 'Guía práctica para aprovechar tu compra.', url: '', size: '1.1 MB', downloads: 37 },
  ];

  var ICONO = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>';

  function revelar(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [16, 0], duration: 460, delay: anime.stagger ? anime.stagger(50) : 0, ease: 'outCubic' });
    // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
    setTimeout(function () { nodos.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 700);
  }

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    var final = Number(hasta).toLocaleString('es-AR');
    if (!anime || !anime.animate || reduce) { el.textContent = final; return; }
    var st = { v: Math.max(0, hasta - 1) };
    anime.animate(st, { v: hasta, duration: 420, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR'); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = final; }, 620);
  }

  // ---- Página pública /descargables.html ----
  var listBox = document.getElementById('dl-list');
  if (listBox) {
    var search = document.getElementById('dl-search');

    function pintar(items) {
      if (!items.length) { listBox.innerHTML = '<p class="dl-empty">No hay recursos para mostrar todavía.</p>'; return; }
      // Agrupa por categoría, respetando el orden de aparición
      var grupos = [], idx = {};
      items.forEach(function (d) {
        var c = d.category || 'General';
        if (idx[c] === undefined) { idx[c] = grupos.length; grupos.push({ cat: c, items: [] }); }
        grupos[idx[c]].items.push(d);
      });
      listBox.innerHTML = grupos.map(function (g) {
        return '<div class="dl-group"><h3>' + App.esc(g.cat) + ' <span class="dl-count">' + g.items.length + (g.items.length === 1 ? ' recurso' : ' recursos') + '</span></h3><div class="dl-grid">' +
          g.items.map(function (d) {
            return '<div class="dl-card">' +
              '<span class="dl-ic">' + ICONO + '</span>' +
              '<h4>' + App.esc(d.title) + '</h4>' +
              '<p>' + App.esc(d.desc) + '</p>' +
              '<div class="dl-meta"><span>' + (d.size ? App.esc(d.size) : '') + '</span><span><span class="dl-dcount" data-count="' + d.id + '">' + (d.downloads || 0) + '</span> descargas</span></div>' +
              '<button class="btn dl-btn" type="button" data-get="' + d.id + '">Descargar</button>' +
            '</div>';
          }).join('') + '</div></div>';
      }).join('');
      var cards = [].slice.call(listBox.querySelectorAll('.dl-card'));
      revelar(cards);
      listBox.querySelectorAll('[data-get]').forEach(function (b) { b.addEventListener('click', function () { descargar(b.getAttribute('data-get')); }); });
    }

    function descargar(id) {
      var counter = listBox.querySelector('[data-count="' + id + '"]');
      if (window.__PREVIEW__) {
        var d = DEMO.filter(function (x) { return x.id === id; })[0];
        if (d) { d.downloads = (d.downloads || 0) + 1; if (counter) contar(counter, d.downloads); }
        App.toast('Vista previa: acá se descargaría el archivo');
        return;
      }
      App.api('/api/downloads/' + id + '/get', { method: 'POST' }).then(function (r) {
        if (counter && r && typeof r.downloads === 'number') contar(counter, r.downloads);
        if (r && r.url) window.open(r.url, '_blank', 'noopener');
        else App.toast('El archivo todavía no está disponible. Probá más tarde.');
      }).catch(function (err) { if (err.message !== 'preview') App.toast(err.message); });
    }

    function cargar() {
      var q = (search && search.value.trim()) || '';
      if (window.__PREVIEW__) {
        var f = q.toLowerCase();
        pintar(DEMO.filter(function (d) { return !f || (d.title + d.category + d.desc).toLowerCase().indexOf(f) >= 0; }));
        return;
      }
      App.api('/api/downloads' + (q ? '?q=' + encodeURIComponent(q) : '')).then(pintar).catch(function () { listBox.innerHTML = '<p class="dl-empty">No se pudieron cargar los recursos.</p>'; });
    }

    if (search) { var t; search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(cargar, 250); }); }
    cargar();
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM /descargables-admin.html ----
  var adminBox = document.getElementById('dl-admin');
  var formA = document.getElementById('dl-form');
  if (adminBox && formA) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var idInput = formA.querySelector('[name="id"]');
    var cancelBtn = document.getElementById('dl-cancel');
    var saveBtn = document.getElementById('dl-save');
    var datalist = document.getElementById('dl-cat-list');

    function refrescarCats() {
      if (!datalist) return;
      var cats = {};
      todos.forEach(function (d) { if (d.category) cats[d.category] = 1; });
      datalist.innerHTML = Object.keys(cats).map(function (c) { return '<option value="' + App.esc(c) + '">'; }).join('');
    }

    function pintar() {
      adminBox.innerHTML = App.table(todos, [
        { key: 'title', label: 'Recurso' },
        { label: 'Categoría', render: function (r) { return '<span class="dl-badge">' + App.esc(r.category) + '</span>'; } },
        { label: 'Archivo', render: function (r) { return r.url ? '<span class="muted" style="font-size:.82rem">cargado</span>' : '<span class="muted" style="font-size:.82rem">sin archivo</span>'; } },
        { label: 'Descargas', render: function (r) { return String(r.downloads || 0); } },
        { label: 'Estado', render: function (r) { return r.published ? '<span class="dl-badge on">Publicado</span>' : '<span class="dl-badge">Oculto</span>'; } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-pub="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.published ? 'Ocultar' : 'Publicar') + '</button>' +
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
      saveBtn.textContent = 'Cargar recurso';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var d = todos.filter(function (r) { return r.id === id; })[0];
      if (!d) return;
      idInput.value = d.id;
      formA.querySelector('[name="title"]').value = d.title;
      formA.querySelector('[name="category"]').value = d.category;
      formA.querySelector('[name="size"]').value = d.size || '';
      formA.querySelector('[name="url"]').value = d.url || '';
      formA.querySelector('[name="desc"]').value = d.desc;
      formA.querySelector('[name="published"]').checked = !!d.published;
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formA.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function togglePub(id) {
      var d = todos.filter(function (r) { return r.id === id; })[0];
      if (!d) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: cambiaría publicación'); return; }
      try {
        var row = await App.api('/api/downloads/' + id, { method: 'PATCH', body: { published: !d.published } });
        d.published = row.published; pintar();
        App.toast(d.published ? 'Recurso publicado' : 'Recurso oculto');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este recurso? No se puede deshacer.')) return;
      try {
        await App.api('/api/downloads/' + id, { method: 'DELETE' });
        todos = todos.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Recurso borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formA.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = Object.fromEntries(new FormData(formA));
      datos.published = formA.querySelector('[name="published"]').checked;
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'cargaría') + ' el recurso'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/downloads/' + editando, { method: 'PATCH', body: datos });
          todos = todos.map(function (r) { return r.id === editando ? upd : r; });
          App.toast('Cambios guardados');
        } else {
          var nuevo = await App.api('/api/downloads', { method: 'POST', body: datos });
          todos.unshift(nuevo);
          App.toast('Recurso cargado');
        }
        resetForm();
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function listo(rows) { todos = rows; pintar(); }
    if (window.__PREVIEW__) {
      listo([
        { id: 'd1', title: 'Catálogo de productos', category: 'Catálogos', desc: 'Catálogo actualizado.', url: '', size: '2.4 MB', published: true, downloads: 128 },
        { id: 'd9', title: 'Recurso sin publicar', category: 'Guías', desc: 'Todavía en preparación.', url: '', size: '', published: false, downloads: 0 },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/downloads/all/list').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navD = document.getElementById('nav-descargables-admin');
    if (navD && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navD.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Centro de descargas**: los recursos viven en la colección \`downloads\` (título, categoría, descripción, URL del archivo, peso y contador de descargas) y se muestran en \`/descargables.html\` agrupados por categoría, con buscador. Cada descarga pasa por el servidor, que suma una descarga real antes de abrir el archivo. Se siembran tres recursos de ejemplo la primera vez (sin URL hasta que cargues el archivo). ${cfg.moduleIds.includes('auth') ? 'Los administradores cargan, publican/ocultan y borran recursos en \`/descargables-admin.html\`, y ven cuántas veces se descargó cada uno. El archivo se enlaza por URL (subilo a tu hosting y pegá el enlace directo).' : 'Para cargar y administrar recursos desde la web activá el módulo **Autenticación** (habilita \`/descargables-admin.html\`); sin él, editá \`data/downloads.json\` a mano.'}`,
  ],
};
