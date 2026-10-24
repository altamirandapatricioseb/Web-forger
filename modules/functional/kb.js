// Centro de ayuda / Base de conocimiento: una página pública /ayuda.html donde el visitante
// busca y lee artículos de ayuda agrupados por categoría, en formato acordeón (abre/cierra con
// Anime.js). Cada vez que se abre un artículo se suma una visita real en el servidor (colección
// kbarticles), y el buscador filtra del lado del servidor por título, categoría y contenido. Los
// artículos los escribe el negocio: con el módulo de autenticación activo, /ayuda-admin.html es un
// ABM solo-admin para crear, editar, publicar/despublicar y borrar artículos. Se siembran algunos
// de ejemplo la primera vez para que la página sirva desde el arranque, incluso sin auth.
// Distinto de "faq" (lista fija y estática de preguntas) y de "qanda" (preguntas que hace el
// público y el negocio responde): acá el negocio publica y organiza su propia documentación de ayuda.

// Artículos de ejemplo (se siembran la primera vez; el negocio los edita o borra desde el ABM).
const SEMILLA = [
  { title: '¿Cuáles son los horarios de atención?', category: 'General', body: 'Atendemos de lunes a viernes de 9 a 18 h y los sábados de 9 a 13 h. Fuera de ese horario podés dejarnos un mensaje y te respondemos al siguiente día hábil.', published: true, views: 0 },
  { title: '¿Qué métodos de pago aceptan?', category: 'Pagos', body: 'Aceptamos efectivo, tarjetas de débito y crédito, y transferencia bancaria. Para compras online también podés pagar con billeteras virtuales.', published: true, views: 0 },
  { title: '¿Hacen envíos a todo el país?', category: 'Envíos', body: 'Sí, realizamos envíos a todo el país a través de correo y transportes. El costo y el plazo dependen de la localidad de destino; te lo confirmamos antes de despachar.', published: true, views: 0 },
  { title: '¿Puedo cambiar o devolver un producto?', category: 'Envíos', body: 'Tenés 10 días desde que recibís el producto para solicitar un cambio o devolución, siempre que esté sin uso y con su embalaje original. Escribinos y te guiamos con el proceso.', published: true, views: 0 },
];

module.exports = {
  id: 'kb', type: 'functional', name: 'Centro de ayuda',
  description: 'Base de conocimiento con página pública /ayuda.html: buscador (filtra en el servidor), artículos por categoría en acordeón (Anime.js) y contador de visitas real. Con auth activo, ABM solo-admin en /ayuda-admin.html para crear, editar, publicar y borrar artículos.',
  usesAnime: true,
  mounts: [{ route: '/api/kb', file: 'routes/kb.js' }],
  collections: ['kbarticles'],
  nav: (cfg) => {
    const links = [{ label: 'Ayuda', href: '/ayuda.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Artículos', href: '/ayuda-admin.html', id: 'nav-kb-admin' });
    return links;
  },
  head: () => `  <style>
    .kb-search{max-width:520px;margin:0 0 24px}
    .kb-cat{margin:0 0 28px}
    .kb-cat h3{margin:0 0 10px;font-size:1.15rem;color:var(--accent)}
    .kb-item{border:1px solid var(--line);border-radius:var(--radius);margin-bottom:8px;background:var(--surface);overflow:hidden}
    .kb-q{width:100%;text-align:left;background:transparent;border:0;padding:14px 16px;font:inherit;font-weight:600;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px;color:var(--text)}
    .kb-q:hover{color:var(--accent)}
    .kb-q .kb-chevron{transition:transform .25s ease;flex:none}
    .kb-item.open .kb-q .kb-chevron{transform:rotate(180deg)}
    .kb-a{max-height:0;overflow:hidden}
    .kb-a-inner{padding:0 16px 16px;color:var(--muted);white-space:pre-line}
    .kb-views{font-size:.78rem;color:var(--muted);display:block;margin-top:8px}
    .kb-empty{color:var(--muted)}
    .kb-badge{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;vertical-align:baseline;background:var(--surface);border:1px solid var(--line)}
    .kb-badge.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
  </style>`,
  files: (cfg) => ({
    'routes/kb.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Siembra artículos de ejemplo la primera vez para que /ayuda.html sirva desde el arranque
db.seedIfEmpty('kbarticles', ${JSON.stringify(SEMILLA, null, 2)});

const validar = (data) => check(data, {
  title: (v) => str(v, 3, 140),
  category: (v) => str(v, 2, 60),
  body: (v) => str(v, 10, 5000),
});

// Vista pública de un artículo (no hay datos sensibles, pero se normaliza igual)
const publico = (a) => ({ id: a.id, title: a.title, category: a.category, body: a.body, views: a.views || 0, createdAt: a.createdAt });

// GET /api/kb — artículos publicados; ?q= filtra en el servidor por título, categoría y contenido
router.get('/', async (req, res) => {
  let rows = await db.find('kbarticles', r => r.published);
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q) rows = rows.filter(a => (a.title + ' ' + a.category + ' ' + a.body).toLowerCase().includes(q));
  res.json(rows.map(publico));
});

// POST /api/kb/:id/view — suma una visita al artículo (contador real, público)
router.post('/:id/view', async (req, res) => {
  const a = await db.get('kbarticles', req.params.id);
  if (!a || !a.published) return res.status(404).json({ error: 'Artículo inexistente' });
  const row = await db.update('kbarticles', a.id, { views: (a.views || 0) + 1 });
  res.json({ views: row.views });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/kb/all — todos los artículos, publicados o no (solo admin)
router.get('/all', requireAdmin, async (req, res) => {
  res.json((await db.all('kbarticles')).reverse());
});

// POST /api/kb — crea un artículo (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const row = await db.insert('kbarticles', {
    title: req.body.title.trim(),
    category: req.body.category.trim(),
    body: req.body.body.trim(),
    published: req.body.published !== false,
    views: 0,
  });
  res.status(201).json(row);
});

// PATCH /api/kb/:id — edita un artículo o cambia su publicación (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.title !== undefined) { if (!str(req.body.title, 3, 140)) return res.status(422).json({ error: 'Título inválido' }); patch.title = req.body.title.trim(); }
  if (req.body.category !== undefined) { if (!str(req.body.category, 2, 60)) return res.status(422).json({ error: 'Categoría inválida' }); patch.category = req.body.category.trim(); }
  if (req.body.body !== undefined) { if (!str(req.body.body, 10, 5000)) return res.status(422).json({ error: 'Contenido inválido' }); patch.body = req.body.body.trim(); }
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  const row = await db.update('kbarticles', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Artículo inexistente' });
  res.json(row);
});

// DELETE /api/kb/:id — borra un artículo (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const a = await db.get('kbarticles', req.params.id);
  if (!a) return res.status(404).json({ error: 'Artículo inexistente' });
  await db.remove('kbarticles', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de artículos (crear, editar, publicar, borrar) requiere el módulo de autenticación:
// activalo en el Builder para habilitar /ayuda-admin.html. Sin él, se muestran los artículos
// sembrados y podés editarlos a mano en data/kbarticles.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      ayuda: {
        title: 'Centro de ayuda',
        html: `  <section>
    <div class="container">
      <h2>Centro de ayuda</h2>
      <p class="section-sub">Encontrá respuestas a las preguntas más frecuentes. Buscá por palabra clave o navegá por categoría.</p>
      <input type="search" id="kb-search" class="kb-search" placeholder="Buscar en la ayuda… (ej: envíos, pago)" aria-label="Buscar en la ayuda">
      <div id="kb-list"><p class="kb-empty">Cargando artículos…</p></div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['ayuda-admin'] = {
        title: 'Artículos de ayuda',
        html: `  <section>
    <div class="container">
      <h2>Artículos de ayuda</h2>
      <p class="section-sub">Creá y organizá la documentación de tu centro de ayuda. Solo visible para administradores.</p>
      <form id="kb-form" class="card" style="max-width:680px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <label>Título de la pregunta o tema</label>
        <input name="title" required minlength="3" maxlength="140" placeholder="Ej: ¿Cómo hago un cambio?">
        <label>Categoría</label>
        <input name="category" required minlength="2" maxlength="60" placeholder="Ej: Envíos" list="kb-cats">
        <datalist id="kb-cats"></datalist>
        <label>Respuesta / contenido</label>
        <textarea name="body" rows="6" required minlength="10" maxlength="5000" placeholder="Escribí la respuesta. Podés usar varios párrafos."></textarea>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" name="published" checked style="width:auto"> Publicado (visible en /ayuda.html)</label>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn" type="submit" id="kb-save">Guardar artículo</button>
          <button class="btn ghost" type="button" id="kb-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="kb-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo centro de ayuda: página pública /ayuda.html (buscador + acordeón con Anime.js y
   contador de visitas real) y, con auth activo, el ABM en /ayuda-admin.html.
   En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEMO = [
    { id: 'd1', title: '¿Cuáles son los horarios de atención?', category: 'General', body: 'Atendemos de lunes a viernes de 9 a 18 h y los sábados de 9 a 13 h.', views: 12 },
    { id: 'd2', title: '¿Qué métodos de pago aceptan?', category: 'Pagos', body: 'Aceptamos efectivo, tarjetas de débito y crédito, y transferencia bancaria.', views: 34 },
    { id: 'd3', title: '¿Hacen envíos a todo el país?', category: 'Envíos', body: 'Sí, hacemos envíos a todo el país. El costo depende de la localidad de destino.', views: 21 },
  ];

  function abrir(item, inner) {
    var anime = window.anime;
    item.classList.add('open');
    var alto = inner.scrollHeight;
    if (!anime || !anime.animate || reduce) { inner.parentElement.style.maxHeight = 'none'; return; }
    anime.animate(inner.parentElement, { maxHeight: [0, alto], duration: 320, ease: 'outCubic', onComplete: function () { inner.parentElement.style.maxHeight = 'none'; } });
    // Red de seguridad: si la pestaña está oculta y el loop se pausa, deja el panel abierto
    setTimeout(function () { if (item.classList.contains('open')) inner.parentElement.style.maxHeight = 'none'; }, 500);
  }
  function cerrar(item, inner) {
    var anime = window.anime;
    item.classList.remove('open');
    if (!anime || !anime.animate || reduce) { inner.parentElement.style.maxHeight = '0px'; return; }
    inner.parentElement.style.maxHeight = inner.scrollHeight + 'px';
    anime.animate(inner.parentElement, { maxHeight: [inner.scrollHeight, 0], duration: 260, ease: 'inCubic' });
    setTimeout(function () { if (!item.classList.contains('open')) inner.parentElement.style.maxHeight = '0px'; }, 400);
  }

  // ---- Página pública /ayuda.html ----
  var list = document.getElementById('kb-list');
  var search = document.getElementById('kb-search');
  if (list) {
    var vistos = {}; // no contar dos veces la misma apertura por sesión de página
    function render(articulos) {
      if (!articulos.length) { list.innerHTML = '<p class="kb-empty">No encontramos artículos para tu búsqueda. Probá con otra palabra.</p>'; return; }
      // Agrupar por categoría
      var porCat = {};
      articulos.forEach(function (a) { (porCat[a.category] = porCat[a.category] || []).push(a); });
      var html = '';
      Object.keys(porCat).forEach(function (cat) {
        html += '<div class="kb-cat"><h3>' + App.esc(cat) + '</h3>';
        porCat[cat].forEach(function (a) {
          html += '<div class="kb-item" data-id="' + a.id + '">' +
            '<button class="kb-q" type="button" aria-expanded="false"><span>' + App.esc(a.title) + '</span><span class="kb-chevron">▾</span></button>' +
            '<div class="kb-a"><div class="kb-a-inner">' + App.esc(a.body) +
            '<span class="kb-views">' + (a.views || 0) + ' personas vieron esta respuesta</span></div></div></div>';
        });
        html += '</div>';
      });
      list.innerHTML = html;
      list.querySelectorAll('.kb-item').forEach(function (item) {
        var btn = item.querySelector('.kb-q');
        var inner = item.querySelector('.kb-a-inner');
        var id = item.getAttribute('data-id');
        btn.addEventListener('click', function () {
          var estaAbierto = item.classList.contains('open');
          if (estaAbierto) { cerrar(item, inner); btn.setAttribute('aria-expanded', 'false'); return; }
          abrir(item, inner); btn.setAttribute('aria-expanded', 'true');
          // Contar la visita una sola vez por apertura de página
          if (!vistos[id]) {
            vistos[id] = true;
            if (!window.__PREVIEW__) App.api('/api/kb/' + id + '/view', { method: 'POST' }).then(function (r) {
              var v = item.querySelector('.kb-views');
              if (v && r && typeof r.views === 'number') v.textContent = r.views + ' personas vieron esta respuesta';
            }).catch(function () {});
          }
        });
      });
    }
    function cargar(q) {
      if (window.__PREVIEW__) {
        var f = (q || '').toLowerCase();
        render(DEMO.filter(function (a) { return !f || (a.title + a.category + a.body).toLowerCase().indexOf(f) >= 0; }));
        return;
      }
      App.api('/api/kb' + (q ? '?q=' + encodeURIComponent(q) : '')).then(render).catch(function () { list.innerHTML = '<p class="kb-empty">No se pudo cargar la ayuda.</p>'; });
    }
    if (search) {
      var t;
      search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { cargar(search.value.trim()); }, 250); });
    }
    cargar('');
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM /ayuda-admin.html ----
  var adminBox = document.getElementById('kb-admin');
  var formA = document.getElementById('kb-form');
  if (adminBox && formA) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var idInput = formA.querySelector('[name="id"]');
    var cancelBtn = document.getElementById('kb-cancel');
    var saveBtn = document.getElementById('kb-save');
    var datalist = document.getElementById('kb-cats');

    function refrescarCats() {
      if (!datalist) return;
      var cats = {};
      todos.forEach(function (a) { if (a.category) cats[a.category] = 1; });
      datalist.innerHTML = Object.keys(cats).map(function (c) { return '<option value="' + App.esc(c) + '">'; }).join('');
    }

    function pintar() {
      adminBox.innerHTML = App.table(todos, [
        { key: 'title', label: 'Título' },
        { label: 'Categoría', render: function (r) { return '<span class="kb-badge">' + App.esc(r.category) + '</span>'; } },
        { label: 'Estado', render: function (r) { return r.published ? '<span class="kb-badge on">Publicado</span>' : '<span class="kb-badge">Borrador</span>'; } },
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
      formA.reset();
      idInput.value = '';
      formA.querySelector('[name="published"]').checked = true;
      saveBtn.textContent = 'Guardar artículo';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var a = todos.filter(function (r) { return r.id === id; })[0];
      if (!a) return;
      idInput.value = a.id;
      formA.querySelector('[name="title"]').value = a.title;
      formA.querySelector('[name="category"]').value = a.category;
      formA.querySelector('[name="body"]').value = a.body;
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
        var row = await App.api('/api/kb/' + id, { method: 'PATCH', body: { published: !a.published } });
        a.published = row.published; pintar();
        App.toast(a.published ? 'Artículo publicado' : 'Artículo despublicado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este artículo? No se puede deshacer.')) return;
      try {
        await App.api('/api/kb/' + id, { method: 'DELETE' });
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
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'crearía') + ' el artículo'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/kb/' + editando, { method: 'PATCH', body: datos });
          todos = todos.map(function (r) { return r.id === editando ? upd : r; });
          App.toast('Cambios guardados');
        } else {
          var nuevo = await App.api('/api/kb', { method: 'POST', body: datos });
          todos.unshift(nuevo);
          App.toast('Artículo creado');
        }
        resetForm();
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function listo(rows) { todos = rows; pintar(); }
    if (window.__PREVIEW__) {
      listo([
        { id: 'd2', title: '¿Qué métodos de pago aceptan?', category: 'Pagos', body: 'Efectivo, tarjetas y transferencia.', published: true, views: 34, createdAt: new Date().toISOString() },
        { id: 'd9', title: 'Borrador sin publicar', category: 'General', body: 'Este artículo todavía no está publicado.', published: false, views: 0, createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/kb/all').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navK = document.getElementById('nav-kb-admin');
    if (navK && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navK.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Centro de ayuda**: los artículos viven en la colección \`kbarticles\` y se muestran en \`/ayuda.html\` con buscador (filtra en el servidor) y contador de visitas real. Se siembran cuatro artículos de ejemplo la primera vez. ${cfg.moduleIds.includes('auth') ? 'Los administradores crean, editan, publican y borran artículos en \`/ayuda-admin.html\`.' : 'Para administrar los artículos desde la web activá el módulo **Autenticación** (habilita \`/ayuda-admin.html\`); sin él, editá \`data/kbarticles.json\` a mano.'}`,
  ],
};
