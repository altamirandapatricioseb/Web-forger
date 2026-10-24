// Galería de fotos administrable con backend real: una página pública /galeria.html que muestra las
// fotos publicadas (traídas del servidor) agrupadas por álbum, con filtro por álbum, visor
// (lightbox) para verlas grandes y un "me gusta" real por foto (contador persistido en el servidor,
// colección albumphotos). Con el módulo de autenticación activo, /galeria-admin.html es un ABM
// solo-admin para cargar fotos (URL + título + álbum), reordenar por álbum, publicar/despublicar y
// borrar. Se siembran algunas fotos de ejemplo la primera vez para que la galería tenga contenido
// desde el arranque, incluso sin auth. La aparición de las fotos y la apertura del visor se animan
// con Anime.js (stagger + red de seguridad, respeta "prefers-reduced-motion"). Pensada para
// fotógrafos, restaurantes, salones de eventos, inmobiliarias, gimnasios y cualquier negocio con
// contenido visual. Distinta de "gallery"/"galleryfilters"/"lightbox" (UI estática con imágenes
// fijas en el HTML): acá el negocio administra las fotos desde la web, se sirven dinámicamente y los
// visitantes pueden dejar su "me gusta".

// Fotos de ejemplo (se siembran la primera vez; el negocio las edita o borra desde el ABM).
// Sin URL real: usan un fondo de marca (marcador) hasta que se cargue la foto verdadera.
const SEMILLA = [
  { title: 'Fachada principal', album: 'Instalaciones', url: '', published: true, likes: 0 },
  { title: 'Salón interior', album: 'Instalaciones', url: '', published: true, likes: 0 },
  { title: 'Nuestro equipo trabajando', album: 'Equipo', url: '', published: true, likes: 0 },
  { title: 'Detalle de producto', album: 'Productos', url: '', published: true, likes: 0 },
  { title: 'Evento de lanzamiento', album: 'Eventos', url: '', published: true, likes: 0 },
  { title: 'Espacio de atención', album: 'Instalaciones', url: '', published: true, likes: 0 },
];

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'albums', type: 'functional', name: 'Galería administrable',
  description: 'Galería de fotos con backend: página pública /galeria.html con las fotos publicadas agrupadas por álbum, filtro, visor (lightbox) y "me gusta" real por foto (Anime.js). Con auth activo, ABM solo-admin en /galeria-admin.html para cargar, publicar y borrar fotos.',
  usesAnime: true,
  mounts: [{ route: '/api/albums', file: 'routes/albums.js' }],
  collections: ['albumphotos'],
  nav: (cfg) => {
    const links = [{ label: 'Galería', href: '/galeria.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Fotos', href: '/galeria-admin.html', id: 'nav-galeria-admin' });
    return links;
  },
  head: () => `  <style>
    .gl-cats{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 24px}
    .gl-chip{background:var(--surface);border:1px solid var(--line);color:var(--text);border-radius:999px;padding:5px 14px;font:inherit;font-size:.85rem;cursor:pointer}
    .gl-chip.active{background:var(--accent);border-color:transparent;color:#fff}
    .gl-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
    .gl-item{position:relative;border-radius:var(--radius);overflow:hidden;border:1px solid var(--line);background:var(--surface);cursor:pointer;padding:0;font:inherit;color:inherit;text-align:left}
    .gl-item .gl-img{aspect-ratio:4/3;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 18%,var(--surface)),var(--surface));background-size:cover;background-position:center;display:block}
    .gl-item .gl-cap{position:absolute;left:0;right:0;bottom:0;padding:10px 12px;background:linear-gradient(to top,rgba(0,0,0,.62),transparent);color:#fff;font-size:.85rem;font-weight:600;display:flex;justify-content:space-between;align-items:flex-end;gap:8px}
    .gl-item .gl-likes{font-size:.78rem;font-weight:600;white-space:nowrap;opacity:.95}
    .gl-empty{color:var(--muted)}
    /* Visor (lightbox) */
    .gl-viewer{position:fixed;inset:0;background:rgba(0,0,0,.86);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;z-index:80;padding:24px}
    .gl-viewer[hidden]{display:none}
    .gl-viewer .gl-frame{max-width:min(92vw,1000px);max-height:74vh;border-radius:var(--radius);background:#111 center/contain no-repeat;background-size:contain;width:min(92vw,1000px);aspect-ratio:3/2}
    .gl-viewer .gl-vcap{color:#fff;font-size:1rem;text-align:center;max-width:80vw}
    .gl-viewer .gl-vbar{display:flex;gap:12px;align-items:center}
    .gl-like{background:var(--surface);border:1px solid var(--line);color:var(--text);border-radius:999px;padding:8px 16px;font:inherit;font-size:.9rem;cursor:pointer;display:inline-flex;gap:8px;align-items:center}
    .gl-like.on{background:color-mix(in srgb,var(--accent) 22%,var(--surface));border-color:transparent;color:var(--accent)}
    .gl-close{position:absolute;top:16px;right:20px;background:transparent;border:0;color:#fff;font-size:2rem;line-height:1;cursor:pointer;padding:4px 10px}
    .gl-nav{background:transparent;border:0;color:#fff;font-size:2.2rem;line-height:1;cursor:pointer;padding:0 8px;opacity:.85}
    .gl-nav:hover{opacity:1}
    .gl-badge{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;vertical-align:baseline;background:var(--surface);border:1px solid var(--line)}
    .gl-badge.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
  </style>`,
  files: (cfg) => ({
    'routes/albums.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Siembra fotos de ejemplo la primera vez para que /galeria.html tenga contenido desde el arranque
db.seedIfEmpty('albumphotos', ${JSON.stringify(SEMILLA, null, 2)});

const validar = (data) => check(data, {
  title: (v) => str(v, 2, 120),
  album: (v) => str(v, 2, 60),
});

// Normaliza la URL de la foto (solo http/https; vacío usa el fondo de marca como marcador)
function limpiarUrl(v) {
  const s = typeof v === 'string' ? v.trim().slice(0, 500) : '';
  return /^https?:\\/\\//i.test(s) ? s : '';
}

// Vista pública de una foto
const publica = (p) => ({ id: p.id, title: p.title, album: p.album, url: p.url || '', likes: p.likes || 0, createdAt: p.createdAt });

// GET /api/albums — fotos publicadas; ?album= filtra por álbum
router.get('/', async (req, res) => {
  let rows = await db.find('albumphotos', p => p.published);
  const album = String(req.query.album || '').trim().toLowerCase();
  if (album) rows = rows.filter(p => (p.album || '').toLowerCase() === album);
  res.json(rows.map(publica));
});

// GET /api/albums/albumes — nombres de álbumes con fotos publicadas (para los chips de filtro)
router.get('/albumes', async (req, res) => {
  const albums = [...new Set((await db.find('albumphotos', p => p.published)).map(p => p.album).filter(Boolean))];
  res.json(albums);
});

// POST /api/albums/:id/like — suma un "me gusta" a la foto (contador real, público)
router.post('/:id/like', async (req, res) => {
  const p = await db.get('albumphotos', req.params.id);
  if (!p || !p.published) return res.status(404).json({ error: 'Foto inexistente' });
  const row = await db.update('albumphotos', p.id, { likes: (p.likes || 0) + 1 });
  res.json({ likes: row.likes });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/albums/all/list — todas las fotos, publicadas o no (solo admin)
router.get('/all/list', requireAdmin, async (req, res) => {
  res.json((await db.all('albumphotos')).reverse());
});

// POST /api/albums — carga una foto (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const row = await db.insert('albumphotos', {
    title: req.body.title.trim(),
    album: req.body.album.trim(),
    url: limpiarUrl(req.body.url),
    published: req.body.published !== false,
    likes: 0,
  });
  res.status(201).json(row);
});

// PATCH /api/albums/:id — edita una foto o cambia su publicación (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.title !== undefined) { if (!str(req.body.title, 2, 120)) return res.status(422).json({ error: 'Título inválido' }); patch.title = req.body.title.trim(); }
  if (req.body.album !== undefined) { if (!str(req.body.album, 2, 60)) return res.status(422).json({ error: 'Álbum inválido' }); patch.album = req.body.album.trim(); }
  if (req.body.url !== undefined) patch.url = limpiarUrl(req.body.url);
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  const row = await db.update('albumphotos', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Foto inexistente' });
  res.json(row);
});

// DELETE /api/albums/:id — borra una foto (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('albumphotos', req.params.id);
  if (!p) return res.status(404).json({ error: 'Foto inexistente' });
  await db.remove('albumphotos', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de fotos (cargar, publicar, borrar) requiere el módulo de autenticación: activalo en el
// Builder para habilitar /galeria-admin.html. Sin él, se muestran las fotos sembradas y podés
// editarlas a mano en data/albumphotos.json.
`}module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      galeria: {
        title: 'Galería',
        html: `  <section>
    <div class="container">
      <h2>Galería</h2>
      <p class="section-sub">Mirá nuestras fotos. Filtrá por álbum y tocá una para verla en grande.</p>
      <div class="gl-cats" id="gl-cats"></div>
      <div id="gl-grid"><p class="gl-empty">Cargando fotos…</p></div>
    </div>
  </section>
  <div class="gl-viewer" id="gl-viewer" hidden>
    <button class="gl-close" id="gl-close" type="button" aria-label="Cerrar">×</button>
    <div class="gl-vbar">
      <button class="gl-nav" id="gl-prev" type="button" aria-label="Anterior">‹</button>
      <div class="gl-frame" id="gl-frame"></div>
      <button class="gl-nav" id="gl-next" type="button" aria-label="Siguiente">›</button>
    </div>
    <p class="gl-vcap" id="gl-vcap"></p>
    <button class="gl-like" id="gl-like" type="button">${phIcon('heart-fill', { size: 16 })} <span id="gl-like-n">Me gusta</span></button>
  </div>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['galeria-admin'] = {
        title: 'Fotos de la galería',
        html: `  <section>
    <div class="container">
      <h2>Fotos de la galería</h2>
      <p class="section-sub">Cargá las fotos que se muestran en tu sitio, agrupadas por álbum. Solo visible para administradores.</p>
      <form id="gl-form" class="card" style="max-width:680px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <label>Título / descripción de la foto</label>
        <input name="title" required minlength="2" maxlength="120" placeholder="Ej: Salón interior">
        <label>Álbum</label>
        <input name="album" required minlength="2" maxlength="60" placeholder="Ej: Instalaciones" list="gl-album-list">
        <datalist id="gl-album-list"></datalist>
        <label>URL de la imagen (opcional)</label>
        <input name="url" maxlength="500" placeholder="https://… (dejalo vacío para usar un fondo de marca)">
        <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" name="published" checked style="width:auto"> Publicada (visible en /galeria.html)</label>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn" type="submit" id="gl-save">Cargar foto</button>
          <button class="btn ghost" type="button" id="gl-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="gl-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo galería administrable: página pública /galeria.html (fotos por álbum, visor/lightbox y
   "me gusta" real animado con Anime.js) y, con auth activo, el ABM en /galeria-admin.html. En la
   vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEMO = [
    { id: 'd1', title: 'Fachada principal', album: 'Instalaciones', url: '', likes: 12, createdAt: new Date().toISOString() },
    { id: 'd2', title: 'Salón interior', album: 'Instalaciones', url: '', likes: 8, createdAt: new Date().toISOString() },
    { id: 'd3', title: 'Nuestro equipo', album: 'Equipo', url: '', likes: 21, createdAt: new Date().toISOString() },
    { id: 'd4', title: 'Detalle de producto', album: 'Productos', url: '', likes: 5, createdAt: new Date().toISOString() },
  ];

  function revelar(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], scale: [0.94, 1], duration: 460, delay: anime.stagger ? anime.stagger(45) : 0, ease: 'outCubic' });
    // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
    setTimeout(function () { nodos.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 700);
  }

  // ---- Página pública /galeria.html ----
  var grid = document.getElementById('gl-grid');
  var catsBox = document.getElementById('gl-cats');
  if (grid) {
    var albumActivo = '';
    var fotos = [];
    var visorIdx = -1;
    var gustadas = {};
    var viewer = document.getElementById('gl-viewer');
    var frame = document.getElementById('gl-frame');
    var vcap = document.getElementById('gl-vcap');
    var likeBtn = document.getElementById('gl-like');
    var likeN = document.getElementById('gl-like-n');

    function bgStyle(url) {
      return url
        ? 'background-image:url(\\'' + App.esc(url).replace(/'/g, '%27') + '\\')'
        : '';
    }

    function pintar() {
      if (!fotos.length) { grid.innerHTML = '<p class="gl-empty">No hay fotos para mostrar todavía.</p>'; return; }
      grid.innerHTML = fotos.map(function (p, i) {
        return '<button class="gl-item" type="button" data-i="' + i + '">' +
          '<span class="gl-img" style="' + bgStyle(p.url) + '"></span>' +
          '<span class="gl-cap"><span>' + App.esc(p.title) + '</span><span class="gl-likes">${phIcon('heart-fill', { size: 13 })} ' + (p.likes || 0) + '</span></span>' +
        '</button>';
      }).join('');
      var items = [].slice.call(grid.querySelectorAll('.gl-item'));
      items.forEach(function (it) { it.addEventListener('click', function () { abrirVisor(parseInt(it.getAttribute('data-i'), 10)); }); });
      revelar(items);
    }

    function pintarCats(albums) {
      if (!catsBox) return;
      var chips = ['<button class="gl-chip' + (albumActivo ? '' : ' active') + '" type="button" data-album="">Todos</button>'];
      albums.forEach(function (a) { chips.push('<button class="gl-chip' + (albumActivo === a ? ' active' : '') + '" type="button" data-album="' + App.esc(a) + '">' + App.esc(a) + '</button>'); });
      catsBox.innerHTML = chips.join('');
      catsBox.querySelectorAll('[data-album]').forEach(function (b) {
        b.addEventListener('click', function () { albumActivo = b.getAttribute('data-album'); pintarCats(albums); cargar(); });
      });
    }

    function cargar() {
      if (window.__PREVIEW__) {
        fotos = DEMO.filter(function (p) { return !albumActivo || p.album === albumActivo; });
        pintar();
        return;
      }
      App.api('/api/albums' + (albumActivo ? '?album=' + encodeURIComponent(albumActivo) : '')).then(function (rows) { fotos = rows; pintar(); }).catch(function () { grid.innerHTML = '<p class="gl-empty">No se pudo cargar la galería.</p>'; });
    }

    // ---- Visor (lightbox) ----
    function pintarVisor() {
      var p = fotos[visorIdx];
      if (!p || !frame) return;
      frame.style.backgroundImage = p.url ? "url('" + App.esc(p.url).replace(/'/g, '%27') + "')" : 'linear-gradient(135deg,#2a2a2a,#111)';
      if (vcap) vcap.textContent = p.title + ' · ' + p.album;
      actualizarLike();
      var anime = window.anime;
      if (anime && anime.animate && !reduce) anime.animate(frame, { opacity: [0, 1], scale: [0.96, 1], duration: 320, ease: 'outCubic' });
    }

    function actualizarLike() {
      var p = fotos[visorIdx];
      if (!p || !likeBtn || !likeN) return;
      likeN.textContent = (p.likes || 0) + (gustadas[p.id] ? ' · ¡Gracias!' : ' Me gusta');
      likeBtn.classList.toggle('on', !!gustadas[p.id]);
    }

    function abrirVisor(i) {
      visorIdx = i;
      if (viewer) viewer.hidden = false;
      pintarVisor();
    }
    function cerrarVisor() { if (viewer) viewer.hidden = true; visorIdx = -1; }
    function mover(d) { if (!fotos.length) return; visorIdx = (visorIdx + d + fotos.length) % fotos.length; pintarVisor(); }

    if (document.getElementById('gl-close')) document.getElementById('gl-close').addEventListener('click', cerrarVisor);
    if (document.getElementById('gl-prev')) document.getElementById('gl-prev').addEventListener('click', function () { mover(-1); });
    if (document.getElementById('gl-next')) document.getElementById('gl-next').addEventListener('click', function () { mover(1); });
    if (viewer) viewer.addEventListener('click', function (e) { if (e.target === viewer) cerrarVisor(); });
    document.addEventListener('keydown', function (e) {
      if (!viewer || viewer.hidden) return;
      if (e.key === 'Escape') cerrarVisor();
      else if (e.key === 'ArrowLeft') mover(-1);
      else if (e.key === 'ArrowRight') mover(1);
    });

    if (likeBtn) likeBtn.addEventListener('click', function () {
      var p = fotos[visorIdx];
      if (!p || gustadas[p.id]) return;
      gustadas[p.id] = true;
      p.likes = (p.likes || 0) + 1;
      actualizarLike();
      pintar();
      var anime = window.anime;
      if (anime && anime.animate && !reduce) anime.animate(likeBtn, { scale: [1, 1.18, 1], duration: 340, ease: 'outBack' });
      if (!window.__PREVIEW__) App.api('/api/albums/' + p.id + '/like', { method: 'POST' }).then(function (r) {
        if (r && typeof r.likes === 'number') { p.likes = r.likes; actualizarLike(); pintar(); }
      }).catch(function () {});
    });

    if (window.__PREVIEW__) pintarCats(['Instalaciones', 'Equipo', 'Productos']);
    else App.api('/api/albums/albumes').then(pintarCats).catch(function () { pintarCats([]); });
    cargar();
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM /galeria-admin.html ----
  var adminBox = document.getElementById('gl-admin');
  var formA = document.getElementById('gl-form');
  if (adminBox && formA) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todas = [];
    var idInput = formA.querySelector('[name="id"]');
    var cancelBtn = document.getElementById('gl-cancel');
    var saveBtn = document.getElementById('gl-save');
    var datalist = document.getElementById('gl-album-list');

    function refrescarAlbumes() {
      if (!datalist) return;
      var al = {};
      todas.forEach(function (p) { if (p.album) al[p.album] = 1; });
      datalist.innerHTML = Object.keys(al).map(function (a) { return '<option value="' + App.esc(a) + '">'; }).join('');
    }

    function pintar() {
      adminBox.innerHTML = App.table(todas, [
        { key: 'title', label: 'Foto' },
        { label: 'Álbum', render: function (r) { return '<span class="gl-badge">' + App.esc(r.album) + '</span>'; } },
        { label: 'Imagen', render: function (r) { return r.url ? '<span class="muted" style="font-size:.82rem">URL</span>' : '<span class="muted" style="font-size:.82rem">marca</span>'; } },
        { label: 'Me gusta', render: function (r) { return String(r.likes || 0); } },
        { label: 'Estado', render: function (r) { return r.published ? '<span class="gl-badge on">Publicada</span>' : '<span class="gl-badge">Oculta</span>'; } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-pub="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.published ? 'Ocultar' : 'Publicar') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      adminBox.querySelectorAll('[data-pub]').forEach(function (b) { b.addEventListener('click', function () { togglePub(b.getAttribute('data-pub')); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
      refrescarAlbumes();
    }

    function resetForm() {
      formA.reset();
      idInput.value = '';
      formA.querySelector('[name="published"]').checked = true;
      saveBtn.textContent = 'Cargar foto';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var p = todas.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      idInput.value = p.id;
      formA.querySelector('[name="title"]').value = p.title;
      formA.querySelector('[name="album"]').value = p.album;
      formA.querySelector('[name="url"]').value = p.url || '';
      formA.querySelector('[name="published"]').checked = !!p.published;
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formA.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function togglePub(id) {
      var p = todas.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: cambiaría publicación'); return; }
      try {
        var row = await App.api('/api/albums/' + id, { method: 'PATCH', body: { published: !p.published } });
        p.published = row.published; pintar();
        App.toast(p.published ? 'Foto publicada' : 'Foto oculta');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar esta foto? No se puede deshacer.')) return;
      try {
        await App.api('/api/albums/' + id, { method: 'DELETE' });
        todas = todas.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Foto borrada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formA.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = Object.fromEntries(new FormData(formA));
      datos.published = formA.querySelector('[name="published"]').checked;
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'cargaría') + ' la foto'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/albums/' + editando, { method: 'PATCH', body: datos });
          todas = todas.map(function (r) { return r.id === editando ? upd : r; });
          App.toast('Cambios guardados');
        } else {
          var nueva = await App.api('/api/albums', { method: 'POST', body: datos });
          todas.unshift(nueva);
          App.toast('Foto cargada');
        }
        resetForm();
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function listo(rows) { todas = rows; pintar(); }
    if (window.__PREVIEW__) {
      listo([
        { id: 'd1', title: 'Fachada principal', album: 'Instalaciones', url: '', published: true, likes: 12, createdAt: new Date().toISOString() },
        { id: 'd9', title: 'Foto oculta de prueba', album: 'Equipo', url: '', published: false, likes: 0, createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/albums/all/list').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navG = document.getElementById('nav-galeria-admin');
    if (navG && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navG.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Galería administrable**: las fotos viven en la colección \`albumphotos\` (título, álbum, URL de imagen y "me gusta") y se muestran en \`/galeria.html\` agrupadas por álbum, con visor (lightbox) y un contador de "me gusta" real. Se siembran algunas fotos de ejemplo la primera vez (sin URL usan un fondo de marca como marcador). ${cfg.moduleIds.includes('auth') ? 'Los administradores cargan, publican/ocultan y borran fotos en \`/galeria-admin.html\`. La imagen se carga por URL (subila a tu hosting o a un servicio de imágenes y pegá el enlace).' : 'Para cargar y administrar fotos desde la web activá el módulo **Autenticación** (habilita \`/galeria-admin.html\`); sin él, editá \`data/albumphotos.json\` a mano.'}`,
  ],
};
