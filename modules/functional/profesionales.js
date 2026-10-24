// Directorio de profesionales administrable con ficha y consulta real: una página pública
// /profesionales.html que lista los profesionales publicados traídos del servidor (colección pros)
// con chips de filtro por especialidad y buscador que filtra en el servidor, y en cada ficha un
// formulario de consulta cuyo envío se guarda en el backend (colección prorequests) para que el
// negocio lo gestione — la ficha pública nunca expone el email ni el teléfono del profesional. Con
// el módulo de autenticación activo, /profesionales-admin.html es un panel solo-admin con el ABM de
// profesionales (crear, editar, publicar/despublicar, borrar; foto por URL http/https, lo demás se
// descarta como anti-XSS) y la bandeja de consultas por profesional (marcar contactado, borrar). Se
// siembran tres profesionales de ejemplo. Las fichas aparecen con stagger de Anime.js (red de
// seguridad + respeta "prefers-reduced-motion"). Cierra el vertical de estudios, clínicas y
// consultoras que faltaba: distinto de "team" (UI estática decorativa) y de "listings" (avisos con
// precio): acá el negocio administra su staff y cada profesional recibe consultas gestionables.

// Profesionales de ejemplo (se siembran la primera vez; el negocio los edita o borra desde el ABM).
const SEMILLA = [
  { name: 'Dra. Carolina Suárez', specialty: 'Clínica médica', bio: 'Más de 15 años acompañando pacientes con un enfoque integral y preventivo.', photo: '', published: true },
  { name: 'Lic. Martín Aguirre', specialty: 'Nutrición', bio: 'Planes de alimentación realistas y sostenibles, adaptados a tu rutina.', photo: '', published: true },
  { name: 'Lic. Paula Benítez', specialty: 'Psicología', bio: 'Terapia breve orientada a objetivos, presencial y online.', photo: '', published: true },
];

module.exports = {
  id: 'profesionales', type: 'functional', name: 'Directorio de profesionales',
  description: 'Directorio de profesionales con backend: página pública /profesionales.html con las fichas publicadas (especialidad, bio y foto), chips de filtro por especialidad, buscador que filtra en el servidor y un formulario de consulta por profesional que se guarda en el backend (Anime.js). Con auth activo, ABM solo-admin y bandeja de consultas en /profesionales-admin.html. Ideal para clínicas, estudios y consultoras.',
  usesAnime: true,
  mounts: [{ route: '/api/pros', file: 'routes/profesionales.js' }],
  collections: ['pros', 'prorequests'],
  nav: (cfg) => {
    const links = [{ label: 'Profesionales', href: '/profesionales.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Staff (admin)', href: '/profesionales-admin.html', id: 'nav-pros-admin' });
    return links;
  },
  head: () => `  <style>
    .pr-filtros{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 22px}
    .pr-chip{padding:6px 14px;border:1.5px solid var(--line);border-radius:999px;background:var(--bg);color:var(--text);font:inherit;font-size:.85rem;cursor:pointer}
    .pr-chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
    .pr-search{max-width:420px;margin:0 0 18px}
    .pr-foto{width:72px;height:72px;border-radius:50%;object-fit:cover;background:color-mix(in srgb,var(--accent) 18%,var(--surface));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.4rem;color:var(--accent);flex-shrink:0}
    .pr-head{display:flex;gap:16px;align-items:center;margin:0 0 10px}
    .pr-esp{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}
    .pr-bio{color:var(--muted);font-size:.92rem;margin:0 0 12px}
    .pr-form{border-top:1px dashed var(--line);padding-top:12px;margin-top:auto}
    .pr-ok{color:var(--accent);font-weight:700;font-size:.9rem;margin:8px 0 0}
    .pr-empty{color:var(--muted)}
    .pr-b{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--line);text-transform:capitalize}
    .pr-b.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
  </style>`,
  files: (cfg) => ({
    'routes/profesionales.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
// Siembra profesionales de ejemplo la primera vez para que /profesionales.html se vea desde el arranque
db.seedIfEmpty('pros', ${JSON.stringify(SEMILLA, null, 2)});

// Solo se aceptan fotos por URL http/https; cualquier otro esquema se descarta (anti-XSS)
const urlSegura = (u) => (typeof u === 'string' && /^https?:\\/\\//i.test(u.trim()) ? u.trim().slice(0, 500) : '');

// Vista pública de un profesional (nunca expone datos internos)
const publico = (p) => ({ id: p.id, name: p.name, specialty: p.specialty, bio: p.bio || '', photo: p.photo || '' });

// GET /api/pros — profesionales publicados; ?esp= filtra por especialidad y ?q= busca en el servidor
router.get('/', async (req, res) => {
  let rows = (await db.all('pros')).filter(p => p.published !== false);
  const esp = String(req.query.esp || '').trim().toLowerCase();
  if (esp) rows = rows.filter(p => (p.specialty || '').toLowerCase() === esp);
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q) rows = rows.filter(p => (p.name + ' ' + p.specialty + ' ' + (p.bio || '')).toLowerCase().includes(q));
  res.json(rows.map(publico));
});

// GET /api/pros/especialidades — especialidades con profesionales publicados (para los chips)
router.get('/especialidades', async (req, res) => {
  const rows = (await db.all('pros')).filter(p => p.published !== false);
  res.json([...new Set(rows.map(p => p.specialty).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));
});

// POST /api/pros/:id/contact — deja una consulta para un profesional (público)
router.post('/:id/contact', async (req, res) => {
  const p = await db.get('pros', req.params.id);
  if (!p || p.published === false) return res.status(404).json({ error: 'Profesional inexistente' });
  const { ok, errors } = check(req.body, {
    name: (v) => str(v, 2, 80),
    email: (v) => isEmail(v),
    message: (v) => str(v, 10, 600),
  });
  if (!ok) return res.status(422).json({ error: 'Completá tu nombre, un email válido y una consulta de al menos 10 caracteres', errors });
  await db.insert('prorequests', {
    proId: p.id,
    proName: p.name,
    name: req.body.name.trim(),
    email: req.body.email.trim().toLowerCase(),
    message: req.body.message.trim(),
    status: 'nuevo',
  });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): entró una consulta nueva.
  // Es "disparar y seguir": un email caído jamás rompe la consulta.
  mailer.notify('Nueva consulta para ' + p.name, req.body.name.trim() + ' (' + req.body.email.trim().toLowerCase() + ') dejó una consulta para ' + p.name + ': ' + req.body.message.trim().slice(0, 300)).catch(() => {});
` : ''}  res.status(201).json({ ok: true });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/pros/admin/all — todos los profesionales con su cantidad de consultas (solo admin)
router.get('/admin/all', requireAdmin, async (req, res) => {
  const rows = await db.all('pros');
  const reqs = await db.all('prorequests');
  res.json(rows.map(p => ({ ...p, requests: reqs.filter(r => r.proId === p.id).length })));
});

// POST /api/pros/admin — crea un profesional (solo admin)
router.post('/admin', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, {
    name: (v) => str(v, 2, 80),
    specialty: (v) => str(v, 2, 60),
  });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const row = await db.insert('pros', {
    name: req.body.name.trim(),
    specialty: req.body.specialty.trim(),
    bio: typeof req.body.bio === 'string' ? req.body.bio.trim().slice(0, 400) : '',
    photo: urlSegura(req.body.photo),
    published: req.body.published !== false,
  });
  res.status(201).json(row);
});

// PATCH /api/pros/admin/:id — edita un profesional o cambia su publicación (solo admin)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.name !== undefined) { if (!str(req.body.name, 2, 80)) return res.status(422).json({ error: 'Nombre inválido' }); patch.name = req.body.name.trim(); }
  if (req.body.specialty !== undefined) { if (!str(req.body.specialty, 2, 60)) return res.status(422).json({ error: 'Especialidad inválida' }); patch.specialty = req.body.specialty.trim(); }
  if (req.body.bio !== undefined) patch.bio = typeof req.body.bio === 'string' ? req.body.bio.trim().slice(0, 400) : '';
  if (req.body.photo !== undefined) patch.photo = urlSegura(req.body.photo);
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  const row = await db.update('pros', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Profesional inexistente' });
  res.json(row);
});

// DELETE /api/pros/admin/:id — borra un profesional (sus consultas quedan en la bandeja) (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const p = await db.get('pros', req.params.id);
  if (!p) return res.status(404).json({ error: 'Profesional inexistente' });
  await db.remove('pros', req.params.id);
  res.json({ ok: true });
});

// GET /api/pros/admin/requests — bandeja de consultas, más recientes primero (solo admin); ?status= filtra
router.get('/admin/requests', requireAdmin, async (req, res) => {
  let rows = (await db.all('prorequests')).reverse();
  const status = String(req.query.status || '').trim();
  if (status) rows = rows.filter(r => r.status === status);
  res.json(rows);
});

// PATCH /api/pros/admin/requests/:id — marca una consulta como contactada o nueva (solo admin)
router.patch('/admin/requests/:id', requireAdmin, async (req, res) => {
  const status = String(req.body.status || '').trim();
  if (!['nuevo', 'contactado'].includes(status)) return res.status(422).json({ error: 'Estado inválido' });
  const row = await db.update('prorequests', req.params.id, { status });
  if (!row) return res.status(404).json({ error: 'Consulta inexistente' });
  res.json(row);
});

// DELETE /api/pros/admin/requests/:id — borra una consulta (solo admin)
router.delete('/admin/requests/:id', requireAdmin, async (req, res) => {
  const r = await db.get('prorequests', req.params.id);
  if (!r) return res.status(404).json({ error: 'Consulta inexistente' });
  await db.remove('prorequests', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de profesionales y la bandeja de consultas requieren el módulo de autenticación: activalo
// en el Builder para habilitar /profesionales-admin.html. Sin él, se muestran los profesionales
// sembrados (editables a mano en data/pros.json) y las consultas quedan en data/prorequests.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      profesionales: {
        title: 'Profesionales',
        html: `  <section>
    <div class="container">
      <h2>Nuestros profesionales</h2>
      <p class="section-sub">Conocé al equipo, elegí tu especialidad y dejá tu consulta: te respondemos a la brevedad.</p>
      <input type="search" id="pr-search" class="pr-search" placeholder="Buscar por nombre o especialidad…" aria-label="Buscar profesionales">
      <div id="pr-filtros" class="pr-filtros"></div>
      <div id="pr-list" class="grid cols-2"><p class="pr-empty">Cargando profesionales…</p></div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['profesionales-admin'] = {
        title: 'Administrar profesionales',
        html: `  <section>
    <div class="container">
      <h2>Administrar profesionales</h2>
      <p class="section-sub">ABM del staff y bandeja de consultas recibidas. Solo visible para administradores.</p>
      <form id="pra-form" class="card" style="max-width:680px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Nombre y título</label><input name="name" required minlength="2" maxlength="80" placeholder="Ej: Dra. Carolina Suárez"></div>
          <div><label>Especialidad</label><input name="specialty" required minlength="2" maxlength="60" placeholder="Ej: Clínica médica" list="pra-esp-list"><datalist id="pra-esp-list"></datalist></div>
        </div>
        <label>Bio (opcional)</label>
        <textarea name="bio" rows="2" maxlength="400" placeholder="Experiencia, enfoque y qué puede esperar el paciente o cliente."></textarea>
        <label>Foto (URL http/https, opcional)</label>
        <input name="photo" maxlength="500" placeholder="https://…/foto.jpg">
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:12px"><input type="checkbox" name="published" checked style="width:auto"> Publicado (visible en /profesionales.html)</label>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn" type="submit" id="pra-save">Guardar profesional</button>
          <button class="btn ghost" type="button" id="pra-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="pra-admin"><p class="muted">Cargando…</p></div>
      <h3 style="margin:34px 0 10px">Consultas recibidas</h3>
      <div style="max-width:280px;margin:0 0 14px">
        <label for="pra-filtro">Filtrar por estado</label>
        <select id="pra-filtro"><option value="">Todas</option><option value="nuevo">Nuevas</option><option value="contactado">Contactadas</option></select>
      </div>
      <div id="pra-reqs"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo directorio de profesionales: página pública /profesionales.html (fichas con filtro por
   especialidad, buscador server y consulta por profesional guardada en el backend, animado con
   Anime.js) y, con auth activo, el ABM + bandeja en /profesionales-admin.html. En la vista previa
   del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEMO = [
    { id: 'd1', name: 'Dra. Carolina Suárez', specialty: 'Clínica médica', bio: 'Enfoque integral y preventivo.', photo: '' },
    { id: 'd2', name: 'Lic. Martín Aguirre', specialty: 'Nutrición', bio: 'Planes realistas y sostenibles.', photo: '' },
    { id: 'd3', name: 'Lic. Paula Benítez', specialty: 'Psicología', bio: 'Terapia breve, presencial y online.', photo: '' },
  ];

  // Iniciales para la ficha sin foto (avatar de marca)
  function iniciales(nombre) {
    return String(nombre).split(/\\s+/).filter(function (w) { return /^[A-ZÁÉÍÓÚÑ]/i.test(w); }).slice(-2).map(function (w) { return w[0]; }).join('').toUpperCase() || '?';
  }

  // ---- Página pública /profesionales.html ----
  var listBox = document.getElementById('pr-list');
  if (listBox) {
    var filtrosBox = document.getElementById('pr-filtros');
    var search = document.getElementById('pr-search');
    var espSel = '';

    function pintarChips(esps) {
      filtrosBox.innerHTML = ['<button type="button" class="pr-chip on" data-esp="">Todos</button>']
        .concat(esps.map(function (e) { return '<button type="button" class="pr-chip" data-esp="' + App.esc(e) + '">' + App.esc(e) + '</button>'; })).join('');
      filtrosBox.querySelectorAll('.pr-chip').forEach(function (b) {
        b.addEventListener('click', function () {
          filtrosBox.querySelectorAll('.pr-chip').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          espSel = b.getAttribute('data-esp');
          cargar();
        });
      });
    }

    function fichaHtml(p) {
      var foto = p.photo
        ? '<img class="pr-foto" src="' + App.esc(p.photo) + '" alt="' + App.esc(p.name) + '">'
        : '<div class="pr-foto" aria-hidden="true">' + App.esc(iniciales(p.name)) + '</div>';
      return '<div class="card" style="display:flex;flex-direction:column">' +
        '<div class="pr-head">' + foto + '<div><h3 style="margin:0 0 4px">' + App.esc(p.name) + '</h3><span class="pr-esp">' + App.esc(p.specialty) + '</span></div></div>' +
        (p.bio ? '<p class="pr-bio">' + App.esc(p.bio) + '</p>' : '') +
        '<form class="pr-form" data-pro="' + App.esc(p.id) + '">' +
          '<label>Dejale tu consulta</label>' +
          '<div class="grid cols-2" style="gap:10px">' +
            '<input name="name" required minlength="2" maxlength="80" placeholder="Tu nombre">' +
            '<input name="email" type="email" required placeholder="tu@email.com">' +
          '</div>' +
          '<textarea name="message" rows="2" required minlength="10" maxlength="600" placeholder="Contanos tu consulta (mínimo 10 caracteres)." style="margin-top:10px"></textarea>' +
          '<button class="btn ghost" type="submit" style="margin-top:10px;padding:7px 16px;font-size:.88rem">Enviar consulta</button>' +
          '<p class="pr-ok" hidden>¡Consulta enviada! Te vamos a responder por email.</p>' +
        '</form>' +
      '</div>';
    }

    function pintar(pros) {
      if (!pros.length) { listBox.innerHTML = '<p class="pr-empty">No encontramos profesionales para tu búsqueda.</p>'; return; }
      listBox.innerHTML = pros.map(fichaHtml).join('');
      listBox.querySelectorAll('.pr-form').forEach(function (f) {
        f.addEventListener('submit', async function (e) {
          e.preventDefault();
          var datos = { name: f.querySelector('[name="name"]').value, email: f.querySelector('[name="email"]').value, message: f.querySelector('[name="message"]').value };
          var okBox = f.querySelector('.pr-ok');
          if (window.__PREVIEW__) { okBox.hidden = false; return; }
          try {
            await App.api('/api/pros/' + f.getAttribute('data-pro') + '/contact', { method: 'POST', body: datos });
            f.reset();
            okBox.hidden = false;
            var anime = window.anime;
            if (anime && anime.animate && !reduce) anime.animate(okBox, { opacity: [0, 1], translateY: [6, 0], duration: 350, ease: 'outCubic' });
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      var cards = [].slice.call(listBox.querySelectorAll('.card'));
      var anime = window.anime;
      if (anime && anime.animate && !reduce && cards.length) {
        anime.animate(cards, { opacity: [0, 1], translateY: [14, 0], duration: 450, delay: anime.stagger ? anime.stagger(80) : 0, ease: 'outCubic' });
        // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
        setTimeout(function () { cards.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 950);
      }
    }

    function cargar() {
      var q = search ? search.value.trim() : '';
      if (window.__PREVIEW__) {
        var f = q.toLowerCase();
        pintar(DEMO.filter(function (p) {
          return (!espSel || p.specialty === espSel) && (!f || (p.name + p.specialty + p.bio).toLowerCase().indexOf(f) >= 0);
        }));
        return;
      }
      var qs = [];
      if (espSel) qs.push('esp=' + encodeURIComponent(espSel));
      if (q) qs.push('q=' + encodeURIComponent(q));
      App.api('/api/pros' + (qs.length ? '?' + qs.join('&') : '')).then(pintar).catch(function () { listBox.innerHTML = '<p class="pr-empty">No se pudieron cargar los profesionales.</p>'; });
    }

    if (search) { var t; search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(cargar, 250); }); }
    if (window.__PREVIEW__) { pintarChips(['Clínica médica', 'Nutrición', 'Psicología']); cargar(); }
    else {
      App.api('/api/pros/especialidades').then(pintarChips).catch(function () { /* sin chips */ });
      cargar();
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM + bandeja /profesionales-admin.html ----
  var adminBox = document.getElementById('pra-admin');
  var formA = document.getElementById('pra-form');
  if (adminBox && formA) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var consultas = [];
    var idInput = formA.querySelector('[name="id"]');
    var cancelBtn = document.getElementById('pra-cancel');
    var saveBtn = document.getElementById('pra-save');
    var reqsBox = document.getElementById('pra-reqs');
    var filtroSel = document.getElementById('pra-filtro');
    var datalist = document.getElementById('pra-esp-list');

    function refrescarEsps() {
      if (!datalist) return;
      var esps = {};
      todos.forEach(function (p) { if (p.specialty) esps[p.specialty] = 1; });
      datalist.innerHTML = Object.keys(esps).map(function (e) { return '<option value="' + App.esc(e) + '">'; }).join('');
    }

    function pintar() {
      adminBox.innerHTML = App.table(todos, [
        { key: 'name', label: 'Profesional' },
        { label: 'Especialidad', render: function (r) { return '<span class="pr-esp">' + App.esc(r.specialty) + '</span>'; } },
        { label: 'Consultas', render: function (r) { return String(r.requests || 0); } },
        { label: 'Estado', render: function (r) { return r.published !== false ? '<span class="pr-b on">Publicado</span>' : '<span class="pr-b">Oculto</span>'; } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-pub="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.published !== false ? 'Ocultar' : 'Publicar') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      adminBox.querySelectorAll('[data-pub]').forEach(function (b) { b.addEventListener('click', function () { togglePub(b.getAttribute('data-pub')); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
      refrescarEsps();
    }

    function pintarReqs() {
      reqsBox.innerHTML = App.table(consultas, [
        { key: 'proName', label: 'Profesional' },
        { key: 'name', label: 'Quién consulta' },
        { label: 'Email', render: function (r) { return '<a href="mailto:' + App.esc(r.email) + '">' + App.esc(r.email) + '</a>'; } },
        { label: 'Consulta', render: function (r) { return App.esc(r.message); } },
        { label: 'Estado', render: function (r) { return r.status === 'contactado' ? '<span class="pr-b on">Contactado</span>' : '<span class="pr-b">Nuevo</span>'; } },
        { label: 'Acciones', render: function (r) {
          return (r.status !== 'contactado' ? '<button class="btn ghost" type="button" data-ct="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Marcar contactado</button>' : '') +
            '<button class="btn ghost" type="button" data-rdel="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      reqsBox.querySelectorAll('[data-ct]').forEach(function (b) { b.addEventListener('click', function () { contactar(b.getAttribute('data-ct')); }); });
      reqsBox.querySelectorAll('[data-rdel]').forEach(function (b) { b.addEventListener('click', function () { borrarReq(b.getAttribute('data-rdel')); }); });
    }

    function resetForm() {
      formA.reset(); idInput.value = '';
      formA.querySelector('[name="published"]').checked = true;
      saveBtn.textContent = 'Guardar profesional';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var p = todos.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      idInput.value = p.id;
      formA.querySelector('[name="name"]').value = p.name;
      formA.querySelector('[name="specialty"]').value = p.specialty;
      formA.querySelector('[name="bio"]').value = p.bio || '';
      formA.querySelector('[name="photo"]').value = p.photo || '';
      formA.querySelector('[name="published"]').checked = p.published !== false;
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formA.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function togglePub(id) {
      var p = todos.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: cambiaría la publicación'); return; }
      try {
        var row = await App.api('/api/pros/admin/' + id, { method: 'PATCH', body: { published: p.published === false } });
        p.published = row.published; pintar();
        App.toast(p.published ? 'Profesional publicado' : 'Profesional oculto');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este profesional? Sus consultas quedan en la bandeja.')) return;
      try {
        await App.api('/api/pros/admin/' + id, { method: 'DELETE' });
        todos = todos.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Profesional borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function contactar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: quedaría contactado'); return; }
      try {
        var row = await App.api('/api/pros/admin/requests/' + id, { method: 'PATCH', body: { status: 'contactado' } });
        consultas = consultas.map(function (r) { return r.id === id ? row : r; });
        pintarReqs();
        App.toast('Consulta marcada como contactada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrarReq(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar esta consulta?')) return;
      try {
        await App.api('/api/pros/admin/requests/' + id, { method: 'DELETE' });
        consultas = consultas.filter(function (r) { return r.id !== id; });
        pintarReqs();
        App.toast('Consulta borrada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    function cargarReqs() {
      var status = filtroSel ? filtroSel.value : '';
      if (window.__PREVIEW__) {
        consultas = [{ id: 'r1', proName: 'Dra. Carolina Suárez', name: 'Ana Pérez', email: 'ana@mail.com', message: 'Quisiera un turno para un chequeo general.', status: 'nuevo' }];
        pintarReqs();
        return;
      }
      App.api('/api/pros/admin/requests' + (status ? '?status=' + encodeURIComponent(status) : '')).then(function (rows) { consultas = rows; pintarReqs(); }).catch(function (err) { reqsBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
    if (filtroSel) filtroSel.addEventListener('change', cargarReqs);

    formA.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        name: formA.querySelector('[name="name"]').value,
        specialty: formA.querySelector('[name="specialty"]').value,
        bio: formA.querySelector('[name="bio"]').value,
        photo: formA.querySelector('[name="photo"]').value,
        published: formA.querySelector('[name="published"]').checked,
      };
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'crearía') + ' el profesional'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/pros/admin/' + editando, { method: 'PATCH', body: datos });
          todos = todos.map(function (r) { return r.id === editando ? { ...upd, requests: r.requests } : r; });
          App.toast('Cambios guardados');
        } else {
          var nuevo = await App.api('/api/pros/admin', { method: 'POST', body: datos });
          todos.push({ ...nuevo, requests: 0 });
          App.toast('Profesional agregado');
        }
        resetForm();
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function listo(rows) { todos = rows; pintar(); cargarReqs(); }
    if (window.__PREVIEW__) {
      listo([
        { id: 'd1', name: 'Dra. Carolina Suárez', specialty: 'Clínica médica', bio: 'Enfoque integral.', photo: '', published: true, requests: 1 },
        { id: 'd2', name: 'Lic. Martín Aguirre', specialty: 'Nutrición', bio: 'Planes realistas.', photo: '', published: false, requests: 0 },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/pros/admin/all').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navP = document.getElementById('nav-pros-admin');
    if (navP && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navP.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Directorio de profesionales**: los profesionales viven en la colección \`pros\` y las consultas de los visitantes en \`prorequests\`. La página pública \`/profesionales.html\` muestra las fichas publicadas con filtro por especialidad y buscador (filtra en el servidor); cada ficha tiene un formulario de consulta que se guarda en el backend, y nunca se exponen datos internos del profesional. Se siembran tres fichas de ejemplo. ${cfg.moduleIds.includes('auth') ? 'Los administradores gestionan el staff (crear, editar, publicar/ocultar, borrar; foto por URL http/https) y la bandeja de consultas (marcar contactado) en \`/profesionales-admin.html\`.' : 'Para administrar el staff y ver las consultas desde la web activá el módulo **Autenticación** (habilita \`/profesionales-admin.html\`); sin él, editá \`data/pros.json\` a mano y mirá las consultas en \`data/prorequests.json\`.'}`,
  ],
};
