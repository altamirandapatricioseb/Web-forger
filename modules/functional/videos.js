// Galería de videos administrable con backend real: página pública /videos.html con los videos
// publicados traídos del servidor (colección videos), agrupables por categoría con chips de filtro
// y REPRODUCCIONES REALES contadas en el backend (POST /:id/play al dar play). Los videos se cargan
// por URL de YouTube o Vimeo: el servidor extrae y valida el ID (solo caracteres seguros, anti-XSS)
// y el embed se construye siempre desde ese ID, nunca desde la URL cruda. La página no carga ningún
// iframe hasta que el visitante da play (click-to-play): la grilla es liviana, no hace requests a
// terceros al abrir y respeta la privacidad (se usa youtube-nocookie). Con auth activo,
// /videos-admin.html es el ABM solo-admin (título, categoría, URL, publicar/ocultar, borrar) con
// las reproducciones de cada video. Se siembran 2 videos de ejemplo (cortos abiertos de Blender).
// Animado con Anime.js (tarjetas con stagger, pop del contador) + red de seguridad. Distinto de
// "video" (módulo UI: un único video institucional fijo en la Home): acá el negocio administra una
// videoteca completa y mide qué se mira.

// Videos de ejemplo: cortometrajes abiertos de Blender (licencia libre, siempre disponibles)
const SEMILLA = [
  { title: 'Big Buck Bunny (corto animado)', category: 'Institucional', provider: 'youtube', videoId: 'aqz-KE-bpKQ', published: true, plays: 0 },
  { title: 'Spring (corto animado)', category: 'Novedades', provider: 'youtube', videoId: 'WhWc3b3KhnY', published: true, plays: 0 },
];

module.exports = {
  id: 'videos', type: 'functional', name: 'Galería de videos',
  description: 'Página /videos.html con los videos publicados servidos desde el backend (colección videos): se cargan por URL de YouTube/Vimeo (ID validado en el servidor, anti-XSS), se filtran por categoría y solo cargan el reproductor al dar play (click-to-play con youtube-nocookie). Cada reproducción se cuenta de verdad. Con auth activo, ABM solo-admin en /videos-admin.html con las reproducciones por video. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/videos', file: 'routes/videos.js' }],
  collections: ['videos'],
  nav: (cfg) => {
    const links = [{ label: 'Videos', href: '/videos.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Videos (admin)', href: '/videos-admin.html', id: 'nav-videos-admin' });
    return links;
  },
  head: () => `  <style>
    .vd-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
    .vd-chips .btn{padding:6px 14px;font-size:.85rem}
    .vd-card{padding:0;overflow:hidden;display:flex;flex-direction:column}
    .vd-frame{position:relative;aspect-ratio:16/9;background:color-mix(in srgb,var(--primary) 22%,var(--bg));display:flex;align-items:center;justify-content:center}
    .vd-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
    .vd-play{display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:var(--accent);border:0;cursor:pointer;color:#fff}
    .vd-play svg{margin-left:4px}
    .vd-info{padding:16px 18px;display:flex;flex-direction:column;gap:6px}
    .vd-info h3{margin:0;font-size:1.02rem}
    .vd-cat{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent);align-self:flex-start}
    .vd-plays{font-size:.82rem;color:var(--muted)}
  </style>`,
  files: (cfg) => ({
    'routes/videos.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Siembra dos videos de ejemplo la primera vez (cortos abiertos de Blender)
db.seedIfEmpty('videos', ${JSON.stringify(SEMILLA, null, 2)});

// Extrae proveedor + ID desde una URL de YouTube o Vimeo. El embed se construye SIEMPRE desde
// este ID validado (solo caracteres seguros), nunca desde la URL cruda: anti-XSS de raíz.
function parseVideo(url) {
  const u = String(url || '').trim();
  let m = u.match(/(?:youtube\\.com\\/(?:watch\\?v=|shorts\\/|embed\\/)|youtu\\.be\\/)([A-Za-z0-9_-]{6,20})/);
  if (m) return { provider: 'youtube', videoId: m[1] };
  m = u.match(/vimeo\\.com\\/(?:video\\/)?(\\d{6,12})/);
  if (m) return { provider: 'vimeo', videoId: m[1] };
  return null;
}

// Vista pública de un video (sin campos internos)
const publico = (v) => ({ id: v.id, title: v.title, category: v.category, provider: v.provider, videoId: v.videoId, plays: v.plays || 0 });

// GET /api/videos — videos publicados (público; ?cat= filtra por categoría)
router.get('/', async (req, res) => {
  let rows = (await db.all('videos')).filter(v => v.published !== false);
  if (req.query.cat) rows = rows.filter(v => v.category === req.query.cat);
  res.json(rows.map(publico));
});

// GET /api/videos/categorias — categorías con videos publicados (para los chips)
router.get('/categorias', async (req, res) => {
  const rows = (await db.all('videos')).filter(v => v.published !== false);
  res.json([...new Set(rows.map(v => v.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));
});

// POST /api/videos/:id/play — suma una reproducción real (público, al dar play)
router.post('/:id/play', async (req, res) => {
  const v = await db.get('videos', req.params.id);
  if (!v || v.published === false) return res.status(404).json({ error: 'Video inexistente' });
  const upd = await db.update('videos', v.id, { plays: (v.plays || 0) + 1 });
  res.json({ plays: upd.plays });
});
${cfg.moduleIds.includes('auth') ? `
const validarVideo = (data) => check(data, {
  title: (v) => str(v, 3, 90),
  category: (v) => str(v, 2, 40),
  url: (v) => str(v, 8, 300),
});

// GET /api/videos/admin/list — todos los videos, también los ocultos (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  res.json(await db.all('videos'));
});

// POST /api/videos/admin — carga un video por URL de YouTube/Vimeo (solo admin)
router.post('/admin', requireAdmin, async (req, res) => {
  const { ok, errors } = validarVideo(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const parsed = parseVideo(req.body.url);
  if (!parsed) return res.status(422).json({ error: 'La URL debe ser un video de YouTube o Vimeo (ej: https://www.youtube.com/watch?v=...)' });
  const row = await db.insert('videos', {
    title: req.body.title.trim(),
    category: req.body.category.trim(),
    provider: parsed.provider,
    videoId: parsed.videoId,
    published: req.body.published !== false,
    plays: 0,
  });
  res.status(201).json(row);
});

// PATCH /api/videos/admin/:id — edita, publica u oculta un video (solo admin)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.title !== undefined) { if (!str(req.body.title, 3, 90)) return res.status(422).json({ error: 'Título inválido' }); patch.title = req.body.title.trim(); }
  if (req.body.category !== undefined) { if (!str(req.body.category, 2, 40)) return res.status(422).json({ error: 'Categoría inválida' }); patch.category = req.body.category.trim(); }
  if (req.body.url !== undefined) {
    const parsed = parseVideo(req.body.url);
    if (!parsed) return res.status(422).json({ error: 'La URL debe ser un video de YouTube o Vimeo' });
    patch.provider = parsed.provider; patch.videoId = parsed.videoId;
  }
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  const row = await db.update('videos', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Video inexistente' });
  res.json(row);
});

// DELETE /api/videos/admin/:id — borra un video (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const v = await db.get('videos', req.params.id);
  if (!v) return res.status(404).json({ error: 'Video inexistente' });
  await db.remove('videos', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de videos requiere el módulo de autenticación: activalo en el Builder para habilitar
// /videos-admin.html. Sin él, editá data/videos.json a mano (la página pública funciona igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      videos: {
        title: 'Videos',
        html: `  <section>
    <div class="container">
      <h2>Videos</h2>
      <p class="section-sub">Mirá nuestros videos: se cargan recién cuando les das play, así la página vuela.</p>
      <div class="vd-chips" id="vd-chips"></div>
      <div class="grid cols-3" id="vd-list"><p class="muted">Cargando videos…</p></div>
      <noscript><p class="muted">Activá JavaScript para reproducir los videos.</p></noscript>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['videos-admin'] = {
        title: 'Videos',
        html: `  <section>
    <div class="container" style="max-width:860px">
      <h2>Videos</h2>
      <p class="section-sub">Pegá el enlace de YouTube o Vimeo y listo: el video aparece en la página pública. Solo visible para administradores.</p>
      <form id="vd-form" class="card" style="max-width:680px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <label>Título</label>
        <input name="title" required minlength="3" maxlength="90" placeholder="Ej: Conocé nuestro local">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Categoría</label><input name="category" required minlength="2" maxlength="40" placeholder="Ej: Institucional" list="vd-cats"><datalist id="vd-cats"></datalist></div>
          <div><label>&nbsp;</label><label style="display:inline-flex;align-items:center;gap:8px;font-weight:400;margin:0"><input type="checkbox" name="published" checked style="width:auto"> Publicado</label></div>
        </div>
        <label>Enlace del video (YouTube o Vimeo)</label>
        <input name="url" required minlength="8" maxlength="300" placeholder="https://www.youtube.com/watch?v=...">
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn" type="submit" id="vd-save">Guardar video</button>
          <button class="btn ghost" type="button" id="vd-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="vd-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo galería de videos: /videos.html trae los publicados del backend, filtra por categoría
   y solo carga el iframe al dar play (click-to-play, youtube-nocookie), contando la reproducción
   real. Con auth, ABM en /videos-admin.html. Animado con Anime.js + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // URL del reproductor construida SOLO desde el ID validado por el servidor (anti-XSS)
  function embedUrl(v) {
    return v.provider === 'vimeo'
      ? 'https://player.vimeo.com/video/' + encodeURIComponent(v.videoId) + '?autoplay=1'
      : 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.videoId) + '?autoplay=1';
  }

  function playsTexto(n) { return n === 1 ? '1 reproducción' : n + ' reproducciones'; }

  // ---- Página pública /videos.html ----
  var pubBox = document.getElementById('vd-list');
  if (pubBox) {
    var chipsBox = document.getElementById('vd-chips');
    var catActiva = '';
    var videos = [];

    function pintarChips(cats) {
      if (!cats.length) { chipsBox.innerHTML = ''; return; }
      chipsBox.innerHTML = '<button class="btn' + (catActiva ? ' ghost' : '') + '" type="button" data-cat="">Todos</button>' +
        cats.map(function (c) {
          return '<button class="btn' + (catActiva === c ? '' : ' ghost') + '" type="button" data-cat="' + App.esc(c) + '">' + App.esc(c) + '</button>';
        }).join('');
      chipsBox.querySelectorAll('[data-cat]').forEach(function (b) {
        b.addEventListener('click', function () { catActiva = b.getAttribute('data-cat'); pintarChips(cats); pintar(); });
      });
    }

    function pintar() {
      var lista = catActiva ? videos.filter(function (v) { return v.category === catActiva; }) : videos;
      if (!lista.length) { pubBox.innerHTML = '<p class="muted">Todavía no hay videos publicados' + (catActiva ? ' en esta categoría' : '') + '.</p>'; return; }
      pubBox.innerHTML = lista.map(function (v) {
        return '<div class="card vd-card"><div class="vd-frame" data-frame="' + v.id + '">' +
          '<button class="vd-play" type="button" data-play="' + v.id + '" aria-label="Reproducir ' + App.esc(v.title) + '">' +
          '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button></div>' +
          '<div class="vd-info">' + (v.category ? '<span class="vd-cat">' + App.esc(v.category) + '</span>' : '') +
          '<h3>' + App.esc(v.title) + '</h3>' +
          '<span class="vd-plays" id="vd-p-' + v.id + '">' + playsTexto(v.plays || 0) + '</span></div></div>';
      }).join('');
      pubBox.querySelectorAll('[data-play]').forEach(function (b) { b.addEventListener('click', function () { reproducir(b.getAttribute('data-play')); }); });
      var anime = window.anime;
      var cards = pubBox.querySelectorAll('.vd-card');
      if (anime && anime.animate && !reduce && cards.length) {
        anime.animate(cards, { opacity: [0, 1], translateY: [16, 0], duration: 450, delay: anime.stagger(80), ease: 'outCubic' });
        // Red de seguridad: deja todo visible aunque el loop esté pausado (pestaña oculta)
        setTimeout(function () { cards.forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; }); }, 1500);
      }
    }

    function reproducir(id) {
      var v = videos.filter(function (x) { return x.id === id; })[0];
      var frame = pubBox.querySelector('[data-frame="' + id + '"]');
      if (!v || !frame) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se reproduce el video'); return; }
      // Recién ahora se carga el reproductor (click-to-play): antes no hay requests a terceros
      frame.innerHTML = '<iframe src="' + embedUrl(v) + '" title="' + App.esc(v.title) + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
      fetch('/api/videos/' + id + '/play', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (d) {
        var p = document.getElementById('vd-p-' + id);
        if (p && d && d.plays !== undefined) p.textContent = playsTexto(d.plays);
      }).catch(function () {});
    }

    if (window.__PREVIEW__) {
      videos = [
        { id: 'd1', title: 'Big Buck Bunny (corto animado)', category: 'Institucional', provider: 'youtube', videoId: 'aqz-KE-bpKQ', plays: 12 },
        { id: 'd2', title: 'Spring (corto animado)', category: 'Novedades', provider: 'youtube', videoId: 'WhWc3b3KhnY', plays: 4 },
      ];
      pintarChips(['Institucional', 'Novedades']);
      pintar();
    } else {
      fetch('/api/videos').then(function (r) { return r.json(); }).then(function (rows) {
        videos = rows;
        fetch('/api/videos/categorias').then(function (r) { return r.json(); }).then(function (cats) { pintarChips(cats); pintar(); }).catch(function () { pintar(); });
      }).catch(function () { pubBox.innerHTML = '<p class="muted">No pudimos cargar los videos.</p>'; });
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /videos-admin.html ----
  var adminBox = document.getElementById('vd-admin');
  var formV = document.getElementById('vd-form');
  if (adminBox && formV) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var idInput = formV.querySelector('[name="id"]');
    var saveBtn = document.getElementById('vd-save');
    var cancelBtn = document.getElementById('vd-cancel');
    var datalist = document.getElementById('vd-cats');

    function urlDe(v) { return v.provider === 'vimeo' ? 'https://vimeo.com/' + v.videoId : 'https://www.youtube.com/watch?v=' + v.videoId; }

    function pintarAdmin() {
      if (datalist) datalist.innerHTML = [...new Set(lista.map(function (v) { return v.category; }))].map(function (c) { return '<option value="' + App.esc(c) + '">'; }).join('');
      adminBox.innerHTML = App.table(lista, [
        { key: 'title', label: 'Video' },
        { key: 'category', label: 'Categoría' },
        { label: 'Origen', render: function (r) { return r.provider === 'vimeo' ? 'Vimeo' : 'YouTube'; } },
        { label: 'Reproducciones', render: function (r) { return String(r.plays || 0); } },
        { label: 'Estado', render: function (r) { return r.published === false ? '<span class="muted">Oculto</span>' : '<strong style="color:var(--accent)">Publicado</strong>'; } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-pub="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.published === false ? 'Publicar' : 'Ocultar') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      adminBox.querySelectorAll('[data-pub]').forEach(function (b) { b.addEventListener('click', function () { alternar(b.getAttribute('data-pub')); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
    }

    function resetForm() {
      formV.reset(); idInput.value = '';
      formV.querySelector('[name="published"]').checked = true;
      saveBtn.textContent = 'Guardar video';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var v = lista.filter(function (r) { return r.id === id; })[0];
      if (!v) return;
      idInput.value = v.id;
      formV.querySelector('[name="title"]').value = v.title;
      formV.querySelector('[name="category"]').value = v.category || '';
      formV.querySelector('[name="url"]').value = urlDe(v);
      formV.querySelector('[name="published"]').checked = v.published !== false;
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formV.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function alternar(id) {
      var v = lista.filter(function (r) { return r.id === id; })[0];
      if (!v) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
      try {
        var upd = await App.api('/api/videos/admin/' + id, { method: 'PATCH', body: { published: v.published === false } });
        lista = lista.map(function (r) { return r.id === id ? upd : r; });
        pintarAdmin();
        App.toast(upd.published ? 'Video publicado' : 'Video oculto');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría el video'); return; }
      if (!confirm('¿Borrar este video de la galería?')) return;
      try {
        await App.api('/api/videos/admin/' + id, { method: 'DELETE' });
        lista = lista.filter(function (r) { return r.id !== id; });
        pintarAdmin();
        App.toast('Video borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formV.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        title: formV.querySelector('[name="title"]').value,
        category: formV.querySelector('[name="category"]').value,
        url: formV.querySelector('[name="url"]').value,
        published: formV.querySelector('[name="published"]').checked,
      };
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'cargaría') + ' el video'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/videos/admin/' + editando, { method: 'PATCH', body: datos });
          lista = lista.map(function (r) { return r.id === editando ? upd : r; });
          App.toast('Cambios guardados');
        } else {
          var nuevo = await App.api('/api/videos/admin', { method: 'POST', body: datos });
          lista.push(nuevo);
          App.toast('Video cargado');
        }
        resetForm();
        pintarAdmin();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (window.__PREVIEW__) {
      lista = [
        { id: 'd1', title: 'Big Buck Bunny (corto animado)', category: 'Institucional', provider: 'youtube', videoId: 'aqz-KE-bpKQ', plays: 12, published: true },
        { id: 'd2', title: 'Spring (corto animado)', category: 'Novedades', provider: 'youtube', videoId: 'WhWc3b3KhnY', plays: 4, published: false },
      ];
      pintarAdmin();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/videos/admin/list').then(function (rows) { lista = rows; pintarAdmin(); }).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navV = document.getElementById('nav-videos-admin');
    if (navV && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navV.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Galería de videos**: los videos viven en la colección \`videos\` y se cargan pegando el enlace de **YouTube o Vimeo** (el servidor valida y guarda solo el ID del video). La página pública \`/videos.html\` no carga ningún reproductor hasta que el visitante da play (se usa \`youtube-nocookie\`), y cada reproducción se cuenta. ${cfg.moduleIds.includes('auth') ? 'Los administradores gestionan la videoteca en \`/videos-admin.html\`.' : 'Para administrarla desde la web activá el módulo **Autenticación** (habilita \`/videos-admin.html\`); sin él, editá \`data/videos.json\` a mano.'} Se siembran dos cortos abiertos de Blender como ejemplo: reemplazalos por tus videos.`,
  ],
};
