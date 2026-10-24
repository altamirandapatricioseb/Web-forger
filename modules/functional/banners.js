// Banner rotativo administrable con backend real: la franja grande del encabezado de la Home —
// el elemento que TODO cliente quiere poder cambiar solo — deja de estar horneada en el HTML y pasa
// a ser un dato. El admin carga slides desde /banners-admin.html (título, bajada, botón con su
// link, imagen por URL, orden y vigencia desde/hasta) y la Home los pide a GET /api/banners, que
// devuelve SOLO los publicados y vigentes ya ordenados: un banner de temporada se apaga solo el día
// que vence, sin tocar nada. Cada vista y cada clic se cuentan en el servidor, así que el panel
// muestra el CTR real de cada slide y el negocio sabe cuál tracciona. Rotación automática con
// Anime.js (fundido cruzado), pausa al pasar el mouse, puntos de navegación, respeto de
// prefers-reduced-motion y red de seguridad. Los links y las imágenes se validan en el servidor
// (solo http/https o rutas internas: nada de javascript:). Distinto de "carousel" (carrusel UI con
// contenido fijo), "promo" (popup) y "promos" (tarjetas de promoción con vigencia): acá es EL
// banner principal del sitio, editable sin regenerar ni volver a deployar.

// Slides de ejemplo: uno vigente hasta 2030 y otro programado, que demuestra el filtro por fecha
const SEMILLA = [
  {
    title: 'Bienvenido a nuestra tienda',
    subtitle: 'Conocé todo lo que tenemos para ofrecerte, con atención personalizada de lunes a sábado.',
    ctaText: 'Ver todo', ctaHref: '/index.html', image: '',
    order: 1, published: true, from: '', until: '', views: 0, clicks: 0,
  },
  {
    title: 'Envíos sin cargo en tu primera compra',
    subtitle: 'Válido en toda la ciudad para pedidos superiores al mínimo. Consultanos por zonas.',
    ctaText: 'Consultar', ctaHref: '/index.html', image: '',
    order: 2, published: true, from: '', until: '2030-12-31', views: 0, clicks: 0,
  },
];

module.exports = {
  id: 'banners', type: 'functional', name: 'Banner rotativo',
  description: 'El banner principal de la Home pasa a ser un dato administrable: el admin carga slides (título, bajada, botón con link, imagen por URL, orden y vigencia desde/hasta) en /banners-admin.html y la Home muestra solo los publicados y vigentes, filtrados y ordenados por el servidor. Cada vista y cada clic se cuentan: el panel muestra el CTR real de cada slide. Rotación con fundido cruzado (Anime.js), pausa al hover y puntos de navegación.',
  usesAnime: true,
  mounts: [{ route: '/api/banners', file: 'routes/banners.js' }],
  collections: ['banners'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Banners (admin)', href: '/banners-admin.html', id: 'nav-banners-admin' }] : [],
  html: () => `  <section id="banners" class="bn-wrap" hidden aria-roledescription="carrusel" aria-label="Novedades destacadas">
    <div class="bn-stage" id="bn-stage"></div>
    <div class="bn-dots" id="bn-dots" role="tablist" aria-label="Elegir novedad"></div>
  </section>`,
  head: () => `  <style>
    .bn-wrap{position:relative;margin:0 0 8px}
    .bn-stage{position:relative;min-height:340px;display:grid}
    .bn-slide{grid-area:1/1;position:relative;display:grid;align-items:center;overflow:hidden;
      background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 88%,#000),var(--accent));
      background-size:cover;background-position:center;opacity:0;pointer-events:none}
    .bn-slide.on{opacity:1;pointer-events:auto}
    .bn-slide::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.62),rgba(0,0,0,.18))}
    .bn-inner{position:relative;z-index:1;padding:56px 0;color:#fff;max-width:620px}
    .bn-inner h2{color:#fff;margin:0 0 12px;font-size:clamp(1.6rem,4vw,2.4rem);line-height:1.15}
    .bn-inner p{color:rgba(255,255,255,.88);margin:0 0 22px;font-size:1.02rem;line-height:1.55}
    .bn-dots{position:absolute;left:0;right:0;bottom:16px;display:flex;gap:8px;justify-content:center;z-index:2}
    .bn-dots button{width:9px;height:9px;padding:0;border-radius:999px;border:0;cursor:pointer;
      background:rgba(255,255,255,.45);transition:transform .2s ease,background .2s ease}
    .bn-dots button[aria-selected="true"]{background:#fff;transform:scale(1.35)}
    .bn-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .bn-kpis .card{text-align:center}
    .bn-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .bn-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--muted)}
    .bn-chip.vigente{background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent);border-color:transparent}
    @media (max-width:640px){.bn-stage{min-height:280px}.bn-inner{padding:44px 0}}
  </style>`,
  files: (cfg) => ({
    'routes/banners.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;
const hoy = () => new Date().toISOString().slice(0, 10);

db.seedIfEmpty('banners', ${JSON.stringify(SEMILLA, null, 2).replace(/\n/g, '\n')});

// Link permitido: ruta interna (/algo) o http/https. Nunca javascript: ni data: (anti-XSS)
const linkOk = (v) => typeof v === 'string' && (/^\\/[^\\s]*$/.test(v) || /^https?:\\/\\/[^\\s]+$/i.test(v));
// La imagen es opcional; si viene, mismas reglas que el link
const imagenOk = (v) => v === '' || v === undefined || linkOk(v);
// Fecha opcional (vacío = sin límite por ese lado)
const fechaOk = (v) => v === '' || v === undefined || (typeof v === 'string' && FECHA.test(v) && !isNaN(Date.parse(v + 'T00:00:00Z')));

// Estado calculado de un slide contra el día de hoy: es la fuente de verdad del filtro público
function estado(b) {
  if (!b.published) return 'oculto';
  const d = hoy();
  if (b.from && d < b.from) return 'programado';
  if (b.until && d > b.until) return 'vencido';
  return 'vigente';
}

// Vista pública de un slide (sin métricas internas)
const publico = (b) => ({ id: b.id, title: b.title, subtitle: b.subtitle || '', ctaText: b.ctaText || '', ctaHref: b.ctaHref || '', image: b.image || '' });

// GET /api/banners — slides visibles hoy, ya ordenados (público).
// Cada slide devuelto suma una vista: es la base del CTR que muestra el panel.
router.get('/', async (req, res) => {
  const vigentes = (await db.all('banners')).filter(b => estado(b) === 'vigente')
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  for (const b of vigentes) await db.update('banners', b.id, { views: (b.views || 0) + 1 });
  res.json(vigentes.map(publico));
});

// POST /api/banners/:id/click — registra el clic en el botón del slide (público)
router.post('/:id/click', async (req, res) => {
  const b = await db.get('banners', req.params.id);
  if (!b) return res.status(404).json({ error: 'Banner inexistente' });
  await db.update('banners', b.id, { clicks: (b.clicks || 0) + 1 });
  res.json({ ok: true });
});
${cfg.moduleIds.includes('auth') ? `
// Campos editables y su validación (los mismos en alta y edición)
const ESQUEMA = {
  title: (v) => str(v, 3, 90),
  subtitle: (v) => v === '' || v === undefined || str(v, 3, 220),
  ctaText: (v) => v === '' || v === undefined || str(v, 2, 30),
  ctaHref: (v) => v === '' || v === undefined || linkOk(v),
  image: imagenOk,
  from: fechaOk,
  until: fechaOk,
};

function limpiar(body) {
  return {
    title: String(body.title).trim(),
    subtitle: String(body.subtitle || '').trim(),
    ctaText: String(body.ctaText || '').trim(),
    ctaHref: String(body.ctaHref || '').trim(),
    image: String(body.image || '').trim(),
    from: String(body.from || '').trim(),
    until: String(body.until || '').trim(),
    published: body.published !== false,
  };
}

// GET /api/banners/admin/stats — resumen del banner (solo admin)
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const rows = await db.all('banners');
  const views = rows.reduce((a, b) => a + (b.views || 0), 0);
  const clicks = rows.reduce((a, b) => a + (b.clicks || 0), 0);
  res.json({
    total: rows.length,
    vigentes: rows.filter(b => estado(b) === 'vigente').length,
    views, clicks,
    ctr: views ? Math.round((clicks / views) * 1000) / 10 : 0,
  });
});

// GET /api/banners/admin/list — todos los slides con su estado y CTR (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  const rows = (await db.all('banners')).sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json(rows.map(b => ({
    ...b, estado: estado(b),
    ctr: b.views ? Math.round(((b.clicks || 0) / b.views) * 1000) / 10 : 0,
  })));
});

// POST /api/banners/admin — alta de un slide (solo admin). Va al final del orden.
router.post('/admin', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, ESQUEMA);
  if (!ok) return res.status(422).json({ error: 'Revisá los datos del banner (el link debe empezar con / o con http)', errors });
  const rows = await db.all('banners');
  const orden = rows.reduce((m, b) => Math.max(m, b.order || 0), 0) + 1;
  res.status(201).json(await db.insert('banners', { ...limpiar(req.body), order: orden, views: 0, clicks: 0 }));
});

// PUT /api/banners/admin/:id — edita un slide (solo admin)
router.put('/admin/:id', requireAdmin, async (req, res) => {
  const b = await db.get('banners', req.params.id);
  if (!b) return res.status(404).json({ error: 'Banner inexistente' });
  const { ok, errors } = check(req.body, ESQUEMA);
  if (!ok) return res.status(422).json({ error: 'Revisá los datos del banner (el link debe empezar con / o con http)', errors });
  res.json(await db.update('banners', b.id, limpiar(req.body)));
});

// POST /api/banners/admin/:id/mover — sube o baja un slide intercambiando el orden (solo admin)
router.post('/admin/:id/mover', requireAdmin, async (req, res) => {
  const dir = req.body.dir === 'abajo' ? 1 : -1;
  const rows = (await db.all('banners')).sort((a, b) => (a.order || 0) - (b.order || 0));
  const i = rows.findIndex(b => b.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Banner inexistente' });
  const j = i + dir;
  if (j < 0 || j >= rows.length) return res.status(409).json({ error: 'Ese banner ya está en la punta' });
  // El intercambio se hace por posición, no por el valor guardado: sobrevive a órdenes repetidos
  await db.update('banners', rows[i].id, { order: j + 1 });
  await db.update('banners', rows[j].id, { order: i + 1 });
  res.json({ ok: true });
});

// DELETE /api/banners/admin/:id — borra un slide (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const b = await db.get('banners', req.params.id);
  if (!b) return res.status(404).json({ error: 'Banner inexistente' });
  await db.remove('banners', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de banners requiere el módulo de autenticación: activalo en el Builder para habilitar
// /banners-admin.html. Sin él, editá data/banners.json a mano (la Home los muestra igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'banners-admin': {
      title: 'Banner rotativo',
      html: `  <section>
    <div class="container" style="max-width:960px">
      <h2>Banner rotativo</h2>
      <p class="section-sub">Los slides del banner principal de la Home. Se publican y se apagan solos según su vigencia, y cada uno muestra cuántas veces se vio y cuántos clics tuvo. Solo visible para administradores.</p>
      <div class="bn-kpis" id="bna-kpis"></div>
      <form id="bna-form" class="card">
        <h3 style="margin-top:0" id="bna-titulo">Nuevo slide</h3>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Título</label><input name="title" required minlength="3" maxlength="90" placeholder="Bienvenido a nuestra tienda"></div>
          <div><label>Imagen de fondo (URL, opcional)</label><input name="image" maxlength="400" placeholder="https://… o /img/banner.jpg"></div>
        </div>
        <label>Bajada (opcional)</label>
        <textarea name="subtitle" rows="2" maxlength="220" placeholder="La frase que acompaña al título"></textarea>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Texto del botón (opcional)</label><input name="ctaText" maxlength="30" placeholder="Ver todo"></div>
          <div><label>Link del botón</label><input name="ctaHref" maxlength="400" placeholder="/index.html o https://…"></div>
        </div>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Mostrar desde (opcional)</label><input name="from" type="date"></div>
          <div><label>Mostrar hasta (opcional)</label><input name="until" type="date"></div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px"><input type="checkbox" name="published" checked style="width:auto"> Publicado</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
          <button class="btn" type="submit" id="bna-guardar">Agregar slide</button>
          <button class="btn ghost" type="button" id="bna-cancelar" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="bna-list" style="margin-top:26px"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo banner rotativo: la Home pide los slides vigentes a /api/banners y los rota con fundido
   cruzado (Anime.js) + red de seguridad; con auth activo, el ABM vive en /banners-admin.html. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Escapa una URL para meterla en url("…") de CSS sin romper la declaración
  function urlCss(u) { return String(u).replace(/["'\\\\()\\s]/g, encodeURIComponent); }

  // ---- Banner público de la Home ----
  var stage = document.getElementById('bn-stage');
  if (stage) {
    var wrap = document.getElementById('banners');
    var dotsBox = document.getElementById('bn-dots');
    var slides = [], dots = [], actual = 0, timer = null;

    function pintar(lista) {
      if (!lista.length) { wrap.hidden = true; return; }
      wrap.hidden = false;
      stage.innerHTML = lista.map(function (b, i) {
        var fondo = b.image ? ' style="background-image:url(&quot;' + urlCss(b.image) + '&quot;)"' : '';
        var boton = (b.ctaText && b.ctaHref)
          ? '<a class="btn" href="' + App.esc(b.ctaHref) + '" data-bn="' + b.id + '">' + App.esc(b.ctaText) + '</a>' : '';
        return '<article class="bn-slide' + (i === 0 ? ' on' : '') + '"' + fondo + ' role="tabpanel" aria-hidden="' + (i !== 0) + '">' +
          '<div class="bn-inner container"><h2>' + App.esc(b.title) + '</h2>' +
          (b.subtitle ? '<p>' + App.esc(b.subtitle) + '</p>' : '') + boton + '</div></article>';
      }).join('');
      dotsBox.innerHTML = lista.length > 1 ? lista.map(function (b, i) {
        return '<button type="button" role="tab" aria-selected="' + (i === 0) + '" aria-label="Novedad ' + (i + 1) + '"></button>';
      }).join('') : '';
      slides = [].slice.call(stage.querySelectorAll('.bn-slide'));
      dots = [].slice.call(dotsBox.querySelectorAll('button'));
      dots.forEach(function (d, i) { d.addEventListener('click', function () { ir(i); reiniciar(); }); });

      // El clic en el botón se registra antes de navegar (keepalive: sobrevive al cambio de página)
      stage.querySelectorAll('[data-bn]').forEach(function (a) {
        a.addEventListener('click', function () {
          if (window.__PREVIEW__) return;
          try {
            fetch('/api/banners/' + a.getAttribute('data-bn') + '/click', { method: 'POST', keepalive: true });
          } catch (e) { /* el clic nunca se bloquea por una métrica */ }
        });
      });

      if (lista.length > 1 && !reduce) arrancar();
    }

    function ir(i) {
      if (i === actual || !slides[i]) return;
      var sale = slides[actual], entra = slides[i];
      actual = i;
      dots.forEach(function (d, k) { d.setAttribute('aria-selected', String(k === i)); });
      slides.forEach(function (s, k) { s.setAttribute('aria-hidden', String(k !== i)); });
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        entra.classList.add('on');
        anime.animate(entra, { opacity: [0, 1], duration: 520, ease: 'outCubic' });
        anime.animate(sale, { opacity: [1, 0], duration: 420, ease: 'outCubic' });
        // Red de seguridad: fija el estado final aunque el loop esté pausado (pestaña oculta)
        setTimeout(function () {
          slides.forEach(function (s, k) { s.classList.toggle('on', k === actual); s.style.opacity = ''; });
        }, 700);
      } else {
        slides.forEach(function (s, k) { s.classList.toggle('on', k === i); });
      }
    }

    function arrancar() { timer = setInterval(function () { ir((actual + 1) % slides.length); }, 6000); }
    function reiniciar() { clearInterval(timer); if (slides.length > 1 && !reduce) arrancar(); }
    // Pausa mientras el visitante está leyendo el slide
    stage.addEventListener('mouseenter', function () { clearInterval(timer); });
    stage.addEventListener('mouseleave', reiniciar);

    if (window.__PREVIEW__) {
      pintar([
        { id: 'd1', title: 'Bienvenido a nuestra tienda', subtitle: 'Conocé todo lo que tenemos para ofrecerte, con atención personalizada de lunes a sábado.', ctaText: 'Ver todo', ctaHref: '/index.html', image: '' },
        { id: 'd2', title: 'Envíos sin cargo en tu primera compra', subtitle: 'Válido en toda la ciudad para pedidos superiores al mínimo.', ctaText: 'Consultar', ctaHref: '/index.html', image: '' },
      ]);
    } else {
      fetch('/api/banners').then(function (r) { return r.json(); })
        .then(function (rows) { if (Array.isArray(rows)) pintar(rows); })
        .catch(function () { wrap.hidden = true; });
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /banners-admin.html ----
  var kpisBn = document.getElementById('bna-kpis');
  if (kpisBn) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var formBn = document.getElementById('bna-form');
    var listBn = document.getElementById('bna-list');
    var cancelar = document.getElementById('bna-cancelar');
    var CAMPOS = ['title', 'image', 'subtitle', 'ctaText', 'ctaHref', 'from', 'until'];
    var lista = [], editando = null;

    function contar(el, hasta, sufijo) {
      if (!el) return;
      var fin = function () { el.textContent = Number(hasta).toLocaleString('es-AR') + (sufijo || ''); };
      var anime = window.anime;
      if (!anime || !anime.animate || reduce) { fin(); return; }
      var st = { v: 0 };
      anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = (Math.round(st.v * 10) / 10).toLocaleString('es-AR') + (sufijo || ''); } });
      // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
      setTimeout(fin, 800);
    }

    function pintarStats(s) {
      kpisBn.innerHTML = '<div class="card"><strong id="bna-k-tot">0</strong><span class="muted">slides cargados</span></div>' +
        '<div class="card"><strong id="bna-k-vig">0</strong><span class="muted">vigentes hoy</span></div>' +
        '<div class="card"><strong id="bna-k-vis">0</strong><span class="muted">veces mostrado</span></div>' +
        '<div class="card"><strong id="bna-k-ctr">0</strong><span class="muted">CTR general</span></div>';
      contar(document.getElementById('bna-k-tot'), s.total);
      contar(document.getElementById('bna-k-vig'), s.vigentes);
      contar(document.getElementById('bna-k-vis'), s.views);
      contar(document.getElementById('bna-k-ctr'), s.ctr, '%');
    }

    function pintarLista() {
      listBn.innerHTML = App.table(lista, [
        { label: 'Slide', render: function (r) {
          return '<strong>' + App.esc(r.title) + '</strong>' +
            (r.subtitle ? '<br><span class="muted" style="font-size:.82rem">' + App.esc(r.subtitle.slice(0, 80)) + '</span>' : '');
        } },
        { label: 'Estado', render: function (r) {
          var v = (r.from ? 'desde ' + r.from.split('-').reverse().join('/') : '') + (r.until ? ' hasta ' + r.until.split('-').reverse().join('/') : '');
          return '<span class="bn-chip ' + r.estado + '">' + r.estado + '</span>' + (v ? '<br><span class="muted" style="font-size:.78rem">' + App.esc(v.trim()) + '</span>' : '');
        } },
        { label: 'Rendimiento', render: function (r) {
          return (r.views || 0) + ' vistas · ' + (r.clicks || 0) + ' clics<br><span class="muted" style="font-size:.82rem">CTR ' + r.ctr + '%</span>';
        } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-up="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Subir</button>' +
            '<button class="btn ghost" type="button" data-down="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Bajar</button>' +
            '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      listBn.querySelectorAll('[data-up]').forEach(function (b) { b.addEventListener('click', function () { mover(b.getAttribute('data-up'), 'arriba'); }); });
      listBn.querySelectorAll('[data-down]').forEach(function (b) { b.addEventListener('click', function () { mover(b.getAttribute('data-down'), 'abajo'); }); });
      listBn.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      listBn.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
    }

    function datosForm() {
      var d = {};
      CAMPOS.forEach(function (k) { d[k] = formBn.querySelector('[name="' + k + '"]').value.trim(); });
      d.published = formBn.querySelector('[name="published"]').checked;
      return d;
    }

    function resetForm() {
      editando = null;
      formBn.reset();
      formBn.querySelector('[name="published"]').checked = true;
      document.getElementById('bna-titulo').textContent = 'Nuevo slide';
      document.getElementById('bna-guardar').textContent = 'Agregar slide';
      cancelar.hidden = true;
    }

    function editar(id) {
      var r = lista.filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      editando = id;
      CAMPOS.forEach(function (k) { formBn.querySelector('[name="' + k + '"]').value = r[k] || ''; });
      formBn.querySelector('[name="published"]').checked = r.published !== false;
      document.getElementById('bna-titulo').textContent = 'Editando: ' + r.title;
      document.getElementById('bna-guardar').textContent = 'Guardar cambios';
      cancelar.hidden = false;
      formBn.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }

    cancelar.addEventListener('click', resetForm);

    formBn.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se guardaría el slide'); return; }
      try {
        if (editando) await App.api('/api/banners/admin/' + editando, { method: 'PUT', body: datosForm() });
        else await App.api('/api/banners/admin', { method: 'POST', body: datosForm() });
        App.toast(editando ? 'Slide actualizado' : 'Slide agregado');
        resetForm();
        cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se reordenaría el slide'); return; }
      try { await App.api('/api/banners/admin/' + id + '/mover', { method: 'POST', body: { dir: dir } }); cargar(); }
      catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se borraría el slide'); return; }
      if (!confirm('¿Borrar este slide del banner?')) return;
      try {
        await App.api('/api/banners/admin/' + id, { method: 'DELETE' });
        if (editando === id) resetForm();
        App.toast('Slide borrado');
        cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    function cargar() {
      App.api('/api/banners/admin/stats').then(pintarStats).catch(function (err) { kpisBn.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
      App.api('/api/banners/admin/list').then(function (rows) { lista = rows; pintarLista(); }).catch(function () {});
    }

    if (window.__PREVIEW__) {
      pintarStats({ total: 2, vigentes: 2, views: 840, clicks: 63, ctr: 7.5 });
      lista = [
        { id: 'd1', title: 'Bienvenido a nuestra tienda', subtitle: 'Conocé todo lo que tenemos para ofrecerte.', estado: 'vigente', views: 520, clicks: 41, ctr: 7.9, from: '', until: '', published: true },
        { id: 'd2', title: 'Envíos sin cargo en tu primera compra', subtitle: 'Válido en toda la ciudad.', estado: 'vigente', views: 320, clicks: 22, ctr: 6.9, from: '', until: '2030-12-31', published: true },
      ];
      pintarLista();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      cargar();
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navBn = document.getElementById('nav-banners-admin');
    if (navBn && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navBn.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Banner rotativo**: los slides viven en la colección \`banners\` (sembrada con dos de ejemplo) y la Home pide a \`GET /api/banners\` **solo los publicados y vigentes**, ya ordenados: un banner de temporada se apaga solo el día que vence. ${cfg.moduleIds.includes('auth') ? 'El ABM está en `/banners-admin.html` (título, bajada, botón, imagen, orden y vigencia), con **vistas, clics y CTR reales** por slide.' : 'Para administrarlos desde la web activá el módulo **Autenticación** (habilita `/banners-admin.html`); sin él, editá `data/banners.json` a mano.'} La imagen se carga **por URL**${cfg.moduleIds.includes('uploads') ? ' — podés subirla antes en la Biblioteca de archivos y pegar acá su enlace' : ' (dejala vacía y el slide usa un degradado con el color de acento de la marca)'}. Los links se validan en el servidor: solo rutas internas (\`/algo\`) o \`http(s)://\`, nunca \`javascript:\`.`,
  ],
};
