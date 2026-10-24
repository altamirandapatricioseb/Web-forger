// Bolsa de trabajo administrable con backend real: la página pública /vacantes.html lista las
// búsquedas laborales ABIERTAS traídas del servidor (colección jobopenings) con chips de filtro por
// área, y cada vacante se despliega con su detalle y un formulario de postulación propio (nombre,
// email, CV por URL opcional y mensaje) que se guarda en el backend (colección jobapplicants) con
// dedupe por email+vacante (409 si ya te postulaste). Con auth activo, /vacantes-admin.html es el
// ABM de búsquedas (crear, editar, abrir/pausar, borrar — borrar arrastra sus postulaciones) más la
// bandeja de postulantes con estados (nuevo → en revisión → entrevista → contratado / descartado),
// nota interna, filtros por vacante y estado, link al CV y CSV. Se siembran dos búsquedas para que
// la página viva desde el arranque. Animado con Anime.js (tarjetas con stagger, acordeón del
// detalle, KPIs con count-up) + red de seguridad. Distinto de "jobs" (UI estática: un único
// formulario genérico sin puestos administrables) y de "jobsadmin" (gestiona lo que captura jobs):
// acá el negocio publica y pausa búsquedas concretas y cada postulación queda atada a su vacante.

// Modalidades de trabajo válidas para una búsqueda
const MODALIDADES = ['presencial', 'remoto', 'hibrido'];
// Estados posibles de una postulación y sus etiquetas visibles
const ESTADOS = ['nuevo', 'revision', 'entrevista', 'contratado', 'descartado'];
const LABELS = { nuevo: 'Nuevo', revision: 'En revisión', entrevista: 'Entrevista', contratado: 'Contratado', descartado: 'Descartado' };

// Búsquedas de ejemplo (se siembran la primera vez; el negocio las edita desde el ABM)
const SEMILLA = [
  { title: 'Vendedor/a para atención al público', area: 'Ventas', modality: 'presencial', location: 'CABA', description: 'Buscamos una persona con ganas de sumarse al equipo de atención en nuestro local. Jornada completa de lunes a sábado con franco rotativo. Valoramos experiencia en ventas, buen trato y proactividad. Ofrecemos sueldo de convenio, premios por objetivos y buen clima de trabajo.', open: true },
  { title: 'Community manager freelance', area: 'Marketing', modality: 'remoto', location: 'Remoto (Argentina)', description: 'Necesitamos alguien que gestione nuestras redes: calendario de contenidos, piezas simples y respuesta a consultas. Dedicación part-time con horarios flexibles. Es un plus saber diseño básico y tener experiencia con negocios locales.', open: true },
];

module.exports = {
  id: 'vacantes', type: 'functional', name: 'Bolsa de trabajo',
  description: 'Página /vacantes.html con las búsquedas laborales abiertas servidas desde el backend (colección jobopenings): filtro por área, detalle desplegable y postulación por vacante guardada en el servidor (dedupe por email, CV por URL). Con auth activo, ABM de búsquedas y bandeja de postulantes con estados, nota, filtros y CSV en /vacantes-admin.html. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/vacantes', file: 'routes/vacantes.js' }],
  collections: ['jobopenings', 'jobapplicants'],
  nav: (cfg) => {
    const links = [{ label: 'Vacantes', href: '/vacantes.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Vacantes (admin)', href: '/vacantes-admin.html', id: 'nav-vacantes-admin' });
    return links;
  },
  head: () => `  <style>
    .vc-card{margin-bottom:14px;padding:0;overflow:hidden}
    .vc-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 22px;cursor:pointer;background:none;border:0;width:100%;text-align:left;font:inherit;color:var(--text)}
    .vc-head h3{margin:0;font-size:1.05rem}
    .vc-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
    .vc-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent)}
    .vc-chip.gris{background:var(--surface);border:1px solid var(--line);color:var(--muted)}
    .vc-body{padding:0 22px;border-top:1px solid var(--line);display:none}
    .vc-card.abierta .vc-body{display:block}
    .vc-flecha{transition:transform .25s ease;flex-shrink:0;color:var(--muted)}
    .vc-card.abierta .vc-flecha{transform:rotate(180deg)}
    .vc-areas{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
    .vc-areas .btn{padding:6px 14px;font-size:.85rem}
    .vc-ok{background:color-mix(in srgb,var(--accent) 12%,var(--surface));border:1px solid var(--accent);border-radius:var(--radius);padding:16px 18px;margin:14px 0}
  </style>`,
  files: (cfg) => ({
    'routes/vacantes.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, oneOf, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
// Modalidades y estados válidos (deben coincidir con los del frontend)
const MODALIDADES = ${JSON.stringify(MODALIDADES)};
const ESTADOS = ${JSON.stringify(ESTADOS)};

// Siembra dos búsquedas de ejemplo la primera vez para que la página viva desde el arranque
db.seedIfEmpty('jobopenings', ${JSON.stringify(SEMILLA, null, 2)});

// Solo URLs http/https como CV (se descarta javascript: y similares, anti-XSS)
const urlSegura = (u) => /^https?:\\/\\//i.test(String(u || '').trim()) ? String(u).trim() : '';

const validarVacante = (data) => check(data, {
  title: (v) => str(v, 3, 90),
  area: (v) => str(v, 2, 40),
  modality: (v) => oneOf(v, MODALIDADES),
  location: (v) => str(v, 2, 60),
  description: (v) => str(v, 20, 2000),
});

// GET /api/vacantes — búsquedas abiertas (público)
router.get('/', async (req, res) => {
  const rows = (await db.all('jobopenings')).filter(v => v.open !== false);
  res.json(rows.map(v => ({ id: v.id, title: v.title, area: v.area, modality: v.modality, location: v.location, description: v.description, createdAt: v.createdAt })));
});

// POST /api/vacantes/:id/apply — postulación a una vacante (público)
router.post('/:id/apply', async (req, res) => {
  const vacante = await db.get('jobopenings', req.params.id);
  if (!vacante || vacante.open === false) return res.status(404).json({ error: 'Esa búsqueda ya no está disponible' });
  const { ok, errors } = check(req.body, {
    name: (v) => str(v, 2, 80),
    email: (v) => isEmail(v),
    message: (v) => str(v, 10, 1500),
  });
  if (!ok) return res.status(422).json({ error: 'Revisá los datos del formulario', errors });
  const email = req.body.email.trim().toLowerCase();
  // Dedupe: una postulación por email y vacante
  const repetida = (await db.find('jobapplicants', a => a.openingId === vacante.id && a.email === email)).length;
  if (repetida) return res.status(409).json({ error: 'Ya te postulaste a esta búsqueda. Te vamos a contactar por email.' });
  await db.insert('jobapplicants', {
    openingId: vacante.id,
    openingTitle: vacante.title,
    name: req.body.name.trim(),
    email,
    cvUrl: urlSegura(req.body.cvUrl),
    message: req.body.message.trim(),
    status: 'nuevo',
    note: '',
  });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): entró una postulación nueva.
  // Es "disparar y seguir": un email caído jamás rompe la postulación.
  mailer.notify('Nueva postulación: ' + vacante.title, req.body.name.trim() + ' (' + email + ') se postuló a la búsqueda "' + vacante.title + '". Mirá el detalle en el panel de vacantes.').catch(() => {});
` : ''}  res.status(201).json({ ok: true });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/vacantes/admin/list — todas las búsquedas con su cantidad de postulantes (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  const postulantes = await db.all('jobapplicants');
  const rows = (await db.all('jobopenings')).map(v => ({
    ...v,
    applicants: postulantes.filter(a => a.openingId === v.id).length,
  }));
  res.json(rows);
});

// POST /api/vacantes/admin — crea una búsqueda (solo admin)
router.post('/admin', requireAdmin, async (req, res) => {
  const { ok, errors } = validarVacante(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const row = await db.insert('jobopenings', {
    title: req.body.title.trim(),
    area: req.body.area.trim(),
    modality: req.body.modality,
    location: req.body.location.trim(),
    description: req.body.description.trim(),
    open: req.body.open !== false,
  });
  res.status(201).json(row);
});

// PATCH /api/vacantes/admin/:id — edita una búsqueda o la abre/pausa (solo admin)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.title !== undefined) { if (!str(req.body.title, 3, 90)) return res.status(422).json({ error: 'Título inválido' }); patch.title = req.body.title.trim(); }
  if (req.body.area !== undefined) { if (!str(req.body.area, 2, 40)) return res.status(422).json({ error: 'Área inválida' }); patch.area = req.body.area.trim(); }
  if (req.body.modality !== undefined) { if (!oneOf(req.body.modality, MODALIDADES)) return res.status(422).json({ error: 'Modalidad inválida' }); patch.modality = req.body.modality; }
  if (req.body.location !== undefined) { if (!str(req.body.location, 2, 60)) return res.status(422).json({ error: 'Ubicación inválida' }); patch.location = req.body.location.trim(); }
  if (req.body.description !== undefined) { if (!str(req.body.description, 20, 2000)) return res.status(422).json({ error: 'Descripción inválida (mínimo 20 caracteres)' }); patch.description = req.body.description.trim(); }
  if (req.body.open !== undefined) patch.open = !!req.body.open;
  const row = await db.update('jobopenings', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Búsqueda inexistente' });
  res.json(row);
});

// DELETE /api/vacantes/admin/:id — borra una búsqueda y sus postulaciones (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const v = await db.get('jobopenings', req.params.id);
  if (!v) return res.status(404).json({ error: 'Búsqueda inexistente' });
  await db.remove('jobopenings', req.params.id);
  for (const a of await db.find('jobapplicants', a => a.openingId === req.params.id)) await db.remove('jobapplicants', a.id);
  res.json({ ok: true });
});

// GET /api/vacantes/admin/applicants — postulaciones, más recientes primero; ?opening= y ?status= filtran (solo admin)
router.get('/admin/applicants', requireAdmin, async (req, res) => {
  let rows = (await db.all('jobapplicants')).reverse();
  if (req.query.opening) rows = rows.filter(a => a.openingId === req.query.opening);
  if (req.query.status) rows = rows.filter(a => (a.status || 'nuevo') === req.query.status);
  res.json(rows);
});

// PATCH /api/vacantes/admin/applicants/:id — cambia el estado o la nota de una postulación (solo admin)
router.patch('/admin/applicants/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.status !== undefined) { if (!oneOf(req.body.status, ESTADOS)) return res.status(422).json({ error: 'Estado inválido' }); patch.status = req.body.status; }
  if (req.body.note !== undefined) patch.note = String(req.body.note).slice(0, 500);
  if (!Object.keys(patch).length) return res.status(422).json({ error: 'Nada para actualizar' });
  const row = await db.update('jobapplicants', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Postulación inexistente' });
  res.json(row);
});

// DELETE /api/vacantes/admin/applicants/:id — borra una postulación (solo admin)
router.delete('/admin/applicants/:id', requireAdmin, async (req, res) => {
  const a = await db.get('jobapplicants', req.params.id);
  if (!a) return res.status(404).json({ error: 'Postulación inexistente' });
  await db.remove('jobapplicants', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de búsquedas y la bandeja de postulantes requieren el módulo de autenticación:
// activalo en el Builder para habilitar /vacantes-admin.html. Sin él, las postulaciones igual
// se guardan en data/jobapplicants.json y las búsquedas se editan en data/jobopenings.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      vacantes: {
        title: 'Trabajá con nosotros',
        html: `  <section>
    <div class="container" style="max-width:760px">
      <h2>Sumate al equipo</h2>
      <p class="section-sub">Estas son nuestras búsquedas abiertas. Abrí la que te interese y postulate ahí mismo.</p>
      <div class="vc-areas" id="vc-areas"></div>
      <div id="vc-list"><p class="muted">Cargando búsquedas…</p></div>
      <noscript><p class="muted">Activá JavaScript para ver las búsquedas abiertas.</p></noscript>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['vacantes-admin'] = {
        title: 'Vacantes y postulantes',
        html: `  <section>
    <div class="container">
      <h2>Búsquedas laborales</h2>
      <p class="section-sub">Publicá y pausá búsquedas, y gestioná a los postulantes de cada una. Solo visible para administradores.</p>
      <form id="vc-form" class="card" style="max-width:680px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <label>Título de la búsqueda</label>
        <input name="title" required minlength="3" maxlength="90" placeholder="Ej: Vendedor/a para el local">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Área</label><input name="area" required minlength="2" maxlength="40" placeholder="Ej: Ventas"></div>
          <div><label>Modalidad</label><select name="modality"><option value="presencial">Presencial</option><option value="remoto">Remoto</option><option value="hibrido">Híbrido</option></select></div>
        </div>
        <label>Ubicación</label>
        <input name="location" required minlength="2" maxlength="60" placeholder="Ej: CABA / Remoto">
        <label>Descripción del puesto</label>
        <textarea name="description" rows="5" required minlength="20" maxlength="2000" placeholder="Tareas, requisitos, horarios y qué ofrecemos…"></textarea>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn" type="submit" id="vc-save">Publicar búsqueda</button>
          <button class="btn ghost" type="button" id="vc-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="vc-admin"><p class="muted">Cargando…</p></div>
      <h3 style="margin:30px 0 10px">Postulantes</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <select id="vc-f-opening" style="max-width:280px"><option value="">Todas las búsquedas</option></select>
        <select id="vc-f-status" style="max-width:200px"><option value="">Todos los estados</option></select>
        <button class="btn ghost" type="button" id="vc-csv">Descargar CSV</button>
      </div>
      <div id="vc-apps"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo bolsa de trabajo: /vacantes.html lista las búsquedas abiertas con filtro por área,
   detalle desplegable y postulación por vacante; con auth activo, ABM + bandeja de postulantes
   en /vacantes-admin.html. Animado con Anime.js (stagger, acordeón) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MODA = { presencial: 'Presencial', remoto: 'Remoto', hibrido: 'Híbrido' };
  var ESTADOS = ${JSON.stringify(ESTADOS)};
  var LABELS = ${JSON.stringify(LABELS)};

  // ---- Página pública /vacantes.html ----
  var listBox = document.getElementById('vc-list');
  if (listBox) {
    var areasBox = document.getElementById('vc-areas');
    var vacantes = [];
    var areaActiva = '';

    function formHtml(v) {
      return '<form class="vc-apply" data-id="' + v.id + '" style="margin:14px 0 20px">' +
        '<div class="grid cols-2" style="gap:12px">' +
        '<div><label>Tu nombre</label><input name="name" required minlength="2" maxlength="80"></div>' +
        '<div><label>Tu email</label><input name="email" type="email" required></div></div>' +
        '<label>Link a tu CV (opcional)</label><input name="cvUrl" type="url" placeholder="https://…">' +
        '<label>Contanos por qué te interesa</label><textarea name="message" rows="3" required minlength="10" maxlength="1500"></textarea>' +
        '<button class="btn" type="submit" style="margin-top:12px">Postularme</button></form>';
    }

    function pintar() {
      var rows = areaActiva ? vacantes.filter(function (v) { return v.area === areaActiva; }) : vacantes;
      if (!rows.length) { listBox.innerHTML = '<p class="muted">Por ahora no hay búsquedas abiertas' + (areaActiva ? ' en esa área' : '') + '. Volvé a mirar pronto.</p>'; return; }
      listBox.innerHTML = rows.map(function (v) {
        return '<div class="card vc-card" id="vc-' + v.id + '">' +
          '<button class="vc-head" type="button" data-toggle="' + v.id + '"><div><h3>' + App.esc(v.title) + '</h3>' +
          '<div class="vc-meta"><span class="vc-chip">' + App.esc(v.area) + '</span>' +
          '<span class="vc-chip gris">' + App.esc(MODA[v.modality] || v.modality) + '</span>' +
          '<span class="vc-chip gris">' + App.esc(v.location) + '</span></div></div>' +
          '<svg class="vc-flecha" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>' +
          '<div class="vc-body"><p style="white-space:pre-line">' + App.esc(v.description) + '</p><h4 style="margin:16px 0 4px">Postulate a esta búsqueda</h4>' + formHtml(v) + '</div></div>';
      }).join('');
      listBox.querySelectorAll('[data-toggle]').forEach(function (b) { b.addEventListener('click', function () { toggle(b.getAttribute('data-toggle')); }); });
      listBox.querySelectorAll('.vc-apply').forEach(function (f) { f.addEventListener('submit', postular); });
      var anime = window.anime;
      var cards = listBox.querySelectorAll('.vc-card');
      if (anime && anime.animate && !reduce && cards.length) {
        anime.animate(cards, { opacity: [0, 1], translateY: [14, 0], duration: 420, delay: anime.stagger(70), ease: 'outCubic' });
        // Red de seguridad: deja todo visible aunque el loop esté pausado (pestaña oculta)
        setTimeout(function () { cards.forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; }); }, 1400);
      }
    }

    function toggle(id) {
      var card = document.getElementById('vc-' + id);
      if (!card) return;
      var abrir = !card.classList.contains('abierta');
      listBox.querySelectorAll('.vc-card.abierta').forEach(function (c) { c.classList.remove('abierta'); });
      if (!abrir) return;
      card.classList.add('abierta');
      var body = card.querySelector('.vc-body');
      var anime = window.anime;
      if (anime && anime.animate && !reduce && body) {
        anime.animate(body, { opacity: [0, 1], translateY: [-6, 0], duration: 300, ease: 'outCubic' });
        setTimeout(function () { body.style.opacity = 1; body.style.transform = 'none'; }, 500);
      }
    }

    async function postular(e) {
      e.preventDefault();
      var f = e.target;
      var id = f.getAttribute('data-id');
      var datos = {
        name: f.querySelector('[name="name"]').value,
        email: f.querySelector('[name="email"]').value,
        cvUrl: f.querySelector('[name="cvUrl"]').value,
        message: f.querySelector('[name="message"]').value,
      };
      if (window.__PREVIEW__) { App.toast('Vista previa: la postulación se enviaría al backend'); return; }
      try {
        await App.api('/api/vacantes/' + id + '/apply', { method: 'POST', body: datos });
        f.outerHTML = '<div class="vc-ok"><strong>¡Recibimos tu postulación!</strong><p class="muted" style="margin:6px 0 0">Si tu perfil encaja con la búsqueda te contactamos por email. Gracias por querer sumarte.</p></div>';
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    function listo(rows) {
      vacantes = rows;
      var areas = [];
      rows.forEach(function (v) { if (areas.indexOf(v.area) < 0) areas.push(v.area); });
      if (areasBox && areas.length > 1) {
        areasBox.innerHTML = '<button class="btn" type="button" data-area="">Todas</button>' + areas.map(function (a) {
          return '<button class="btn ghost" type="button" data-area="' + App.esc(a) + '">' + App.esc(a) + '</button>';
        }).join('');
        areasBox.querySelectorAll('[data-area]').forEach(function (b) {
          b.addEventListener('click', function () {
            areaActiva = b.getAttribute('data-area');
            areasBox.querySelectorAll('[data-area]').forEach(function (x) { x.className = 'btn ghost'; });
            b.className = 'btn';
            pintar();
          });
        });
      }
      pintar();
      // Enlace directo /vacantes.html?v=<id>: abre esa búsqueda y la trae a la vista
      var vUrl = new URLSearchParams(location.search).get('v');
      if (vUrl && document.getElementById('vc-' + vUrl)) {
        toggle(vUrl);
        document.getElementById('vc-' + vUrl).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    if (window.__PREVIEW__) {
      listo([
        { id: 'd1', title: 'Vendedor/a para atención al público', area: 'Ventas', modality: 'presencial', location: 'CABA', description: 'Jornada completa de lunes a sábado. Valoramos experiencia en ventas y buen trato.' },
        { id: 'd2', title: 'Community manager freelance', area: 'Marketing', modality: 'remoto', location: 'Remoto', description: 'Gestión de redes con dedicación part-time y horarios flexibles.' },
      ]);
    } else {
      fetch('/api/vacantes').then(function (r) { return r.json(); }).then(listo).catch(function () { listBox.innerHTML = '<p class="muted">No pudimos cargar las búsquedas.</p>'; });
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /vacantes-admin.html ----
  var adminBox = document.getElementById('vc-admin');
  var formV = document.getElementById('vc-form');
  if (adminBox && formV) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var busquedas = [];
    var apps = [];
    var idInput = formV.querySelector('[name="id"]');
    var saveBtn = document.getElementById('vc-save');
    var cancelBtn = document.getElementById('vc-cancel');
    var appsBox = document.getElementById('vc-apps');
    var fOpening = document.getElementById('vc-f-opening');
    var fStatus = document.getElementById('vc-f-status');

    if (fStatus) fStatus.innerHTML = '<option value="">Todos los estados</option>' + ESTADOS.map(function (s) { return '<option value="' + s + '">' + LABELS[s] + '</option>'; }).join('');

    function pintarBusquedas() {
      adminBox.innerHTML = App.table(busquedas, [
        { key: 'title', label: 'Búsqueda' },
        { key: 'area', label: 'Área' },
        { label: 'Modalidad', render: function (r) { return MODA[r.modality] || r.modality; } },
        { label: 'Postulantes', render: function (r) { return String(r.applicants || 0); } },
        { label: 'Estado', render: function (r) { return r.open === false ? '<span class="muted">Pausada</span>' : '<strong style="color:var(--accent)">Abierta</strong>'; } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-open="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.open === false ? 'Reabrir' : 'Pausar') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      adminBox.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { alternar(b.getAttribute('data-open')); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
      if (fOpening) fOpening.innerHTML = '<option value="">Todas las búsquedas</option>' + busquedas.map(function (v) { return '<option value="' + v.id + '">' + App.esc(v.title) + '</option>'; }).join('');
    }

    function pintarApps() {
      var rows = apps;
      if (fOpening && fOpening.value) rows = rows.filter(function (a) { return a.openingId === fOpening.value; });
      if (fStatus && fStatus.value) rows = rows.filter(function (a) { return (a.status || 'nuevo') === fStatus.value; });
      appsBox.innerHTML = App.table(rows, [
        { key: 'name', label: 'Nombre' },
        { label: 'Email', render: function (r) { return '<a href="mailto:' + App.esc(r.email) + '">' + App.esc(r.email) + '</a>'; } },
        { label: 'Búsqueda', render: function (r) { return App.esc(r.openingTitle || '—'); } },
        { label: 'CV', render: function (r) { return r.cvUrl ? '<a href="' + App.esc(r.cvUrl) + '" target="_blank" rel="noopener">Ver CV</a>' : '<span class="muted">—</span>'; } },
        { label: 'Estado', render: function (r) {
          return '<select data-status="' + r.id + '" style="width:auto;padding:4px 8px;font-size:.82rem">' + ESTADOS.map(function (s) {
            return '<option value="' + s + '"' + ((r.status || 'nuevo') === s ? ' selected' : '') + '>' + LABELS[s] + '</option>';
          }).join('') + '</select>';
        } },
        { label: 'Nota', render: function (r) { return '<button class="btn ghost" type="button" data-note="' + r.id + '" style="padding:3px 9px;font-size:.8rem"' + (r.note ? ' title="' + App.esc(r.note) + '"' : '') + '>' + (r.note ? 'Ver/editar' : 'Agregar') + '</button>'; } },
        { label: '', render: function (r) { return '<button class="btn ghost" type="button" data-adel="' + r.id + '" style="padding:3px 9px;font-size:.8rem;color:#c0392b;border-color:#c0392b">Borrar</button>'; } },
      ]);
      appsBox.querySelectorAll('[data-status]').forEach(function (s) {
        s.addEventListener('change', function () { cambiarEstado(s.getAttribute('data-status'), s.value); });
      });
      appsBox.querySelectorAll('[data-note]').forEach(function (b) { b.addEventListener('click', function () { nota(b.getAttribute('data-note')); }); });
      appsBox.querySelectorAll('[data-adel]').forEach(function (b) { b.addEventListener('click', function () { borrarApp(b.getAttribute('data-adel')); }); });
    }

    function resetForm() {
      formV.reset(); idInput.value = '';
      saveBtn.textContent = 'Publicar búsqueda';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var v = busquedas.filter(function (r) { return r.id === id; })[0];
      if (!v) return;
      idInput.value = v.id;
      ['title', 'area', 'location', 'description'].forEach(function (k) { formV.querySelector('[name="' + k + '"]').value = v[k] || ''; });
      formV.querySelector('[name="modality"]').value = v.modality || 'presencial';
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formV.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function alternar(id) {
      var v = busquedas.filter(function (r) { return r.id === id; })[0];
      if (!v) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría el estado'); return; }
      try {
        var upd = await App.api('/api/vacantes/admin/' + id, { method: 'PATCH', body: { open: v.open === false } });
        busquedas = busquedas.map(function (r) { return r.id === id ? { ...upd, applicants: r.applicants } : r; });
        pintarBusquedas();
        App.toast(upd.open ? 'Búsqueda reabierta' : 'Búsqueda pausada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría la búsqueda'); return; }
      if (!confirm('¿Borrar esta búsqueda y todas sus postulaciones?')) return;
      try {
        await App.api('/api/vacantes/admin/' + id, { method: 'DELETE' });
        busquedas = busquedas.filter(function (r) { return r.id !== id; });
        apps = apps.filter(function (a) { return a.openingId !== id; });
        pintarBusquedas(); pintarApps();
        App.toast('Búsqueda borrada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function cambiarEstado(id, status) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría el estado'); return; }
      try {
        var upd = await App.api('/api/vacantes/admin/applicants/' + id, { method: 'PATCH', body: { status: status } });
        apps = apps.map(function (a) { return a.id === id ? upd : a; });
        App.toast('Estado actualizado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function nota(id) {
      var a = apps.filter(function (r) { return r.id === id; })[0];
      if (!a) return;
      var texto = prompt('Nota interna sobre este postulante:', a.note || '');
      if (texto === null) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la nota'); return; }
      try {
        var upd = await App.api('/api/vacantes/admin/applicants/' + id, { method: 'PATCH', body: { note: texto } });
        apps = apps.map(function (r) { return r.id === id ? upd : r; });
        pintarApps();
        App.toast('Nota guardada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrarApp(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría la postulación'); return; }
      if (!confirm('¿Borrar esta postulación?')) return;
      try {
        await App.api('/api/vacantes/admin/applicants/' + id, { method: 'DELETE' });
        apps = apps.filter(function (a) { return a.id !== id; });
        pintarApps();
        App.toast('Postulación borrada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    if (fOpening) fOpening.addEventListener('change', pintarApps);
    if (fStatus) fStatus.addEventListener('change', pintarApps);

    var csvBtn = document.getElementById('vc-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var filas = [['nombre', 'email', 'busqueda', 'cv', 'estado', 'nota', 'fecha']].concat(apps.map(function (a) {
        return [a.name, a.email, a.openingTitle, a.cvUrl || '', LABELS[a.status || 'nuevo'], a.note || '', a.createdAt];
      }));
      var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'postulantes.csv';
      a.click();
    });

    formV.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        title: formV.querySelector('[name="title"]').value,
        area: formV.querySelector('[name="area"]').value,
        modality: formV.querySelector('[name="modality"]').value,
        location: formV.querySelector('[name="location"]').value,
        description: formV.querySelector('[name="description"]').value,
      };
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'publicaría') + ' la búsqueda'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/vacantes/admin/' + editando, { method: 'PATCH', body: datos });
          busquedas = busquedas.map(function (r) { return r.id === editando ? { ...upd, applicants: r.applicants } : r; });
          App.toast('Cambios guardados');
        } else {
          var nueva = await App.api('/api/vacantes/admin', { method: 'POST', body: datos });
          busquedas.push({ ...nueva, applicants: 0 });
          App.toast('Búsqueda publicada');
        }
        resetForm();
        pintarBusquedas();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (window.__PREVIEW__) {
      busquedas = [{ id: 'd1', title: 'Vendedor/a para el local', area: 'Ventas', modality: 'presencial', applicants: 3, open: true }];
      apps = [{ id: 'a1', openingId: 'd1', openingTitle: 'Vendedor/a para el local', name: 'Ana López', email: 'ana@mail.com', cvUrl: '', status: 'nuevo', note: '', createdAt: new Date().toISOString() }];
      pintarBusquedas(); pintarApps();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/vacantes/admin/list').then(function (rows) { busquedas = rows; pintarBusquedas(); }).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
      App.api('/api/vacantes/admin/applicants').then(function (rows) { apps = rows; pintarApps(); }).catch(function () {});
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navV = document.getElementById('nav-vacantes-admin');
    if (navV && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navV.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Bolsa de trabajo**: las búsquedas viven en la colección \`jobopenings\` y las postulaciones en \`jobapplicants\` (una por email y búsqueda; el CV viaja como URL, solo http/https). Se siembran dos búsquedas de ejemplo. ${cfg.moduleIds.includes('auth') ? 'Los administradores publican/pausan búsquedas y gestionan postulantes (estados, nota, CSV) en \`/vacantes-admin.html\`.' : 'Para gestionar búsquedas y postulantes desde la web activá el módulo **Autenticación** (habilita \`/vacantes-admin.html\`).'} Si también activás el módulo **Trabajá con nosotros** (jobs), vas a tener dos vías de postulación: conviene dejar solo una.`,
  ],
};
