// Soporte con seguimiento: el visitante abre un reclamo/consulta desde /soporte.html y
// recibe un código (TK-XXXXXX) para consultar el estado cuando quiera, sin necesidad de
// cuenta. El estado se muestra como una línea de progreso de 3 pasos (Recibido → En
// proceso → Resuelto) animada con Anime.js (red de seguridad setTimeout + respeta
// "prefers-reduced-motion"). Si el módulo de autenticación está activo, la misma página
// suma un panel de gestión solo-admin (cambiar estado y responder); sin auth, la gestión
// queda deshabilitada y se avisa en el README. Distinto de "inbox" (bandeja de mensajes
// de formularios): acá hay ida y vuelta con estado consultable por el cliente.
const ESTADOS = ['abierto', 'en-proceso', 'resuelto'];

module.exports = {
  id: 'tickets', type: 'functional', name: 'Soporte con seguimiento',
  description: 'Mesa de soporte: el visitante abre un reclamo, recibe un código de seguimiento y consulta el estado (línea de progreso animada). Con auth activo, panel de gestión para administradores.',
  usesAnime: true,
  mounts: [{ route: '/api/tickets', file: 'routes/tickets.js' }],
  collections: ['tickets'],
  nav: () => [{ label: 'Soporte', href: '/soporte.html' }],
  pages: (cfg) => ({
    soporte: {
      title: 'Soporte',
      html: `  <section>
    <div class="container">
      <h2>Centro de soporte</h2>
      <p class="section-sub">Contanos tu problema o consulta: te damos un código para seguir el estado del reclamo cuando quieras.</p>
      <div class="grid cols-2">
        <form id="tk-form" class="card">
          <h3>Abrir un reclamo</h3>
          <label>Nombre</label><input name="name" required maxlength="80">
          <label>Email</label><input name="email" type="email" required>
          <label>Asunto</label><input name="subject" required maxlength="120">
          <label>Detalle</label><textarea name="detail" rows="4" required minlength="10" maxlength="1000" placeholder="Contanos qué pasó con el mayor detalle posible"></textarea>
          <div style="margin-top:16px"><button class="btn" type="submit">Enviar reclamo</button></div>
        </form>
        <div>
          <div class="card" id="tk-nuevo" hidden style="margin-bottom:20px">
            <h3>¡Reclamo recibido!</h3>
            <p class="muted" style="margin:0">Guardá este código para consultar el estado:</p>
            <p class="tk-codigo" id="tk-codigo-nuevo">—</p>
          </div>
          <div class="card">
            <h3>Seguí tu reclamo</h3>
            <label for="tk-buscar">Código de seguimiento</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input id="tk-buscar" placeholder="TK-A1B2C3" style="flex:1;min-width:150px;text-transform:uppercase">
              <button class="btn" type="button" id="tk-buscar-btn" style="width:auto">Consultar</button>
            </div>
            <div id="tk-estado"></div>
          </div>
        </div>
      </div>${cfg.moduleIds.includes('auth') ? `
      <div id="tk-admin" hidden style="margin-top:40px">
        <h3>Gestión de reclamos <span class="muted" style="font-weight:400;font-size:.85rem">(solo administradores)</span></h3>
        <div id="tk-admin-tabla"><p class="muted">Cargando…</p></div>
      </div>` : ''}
    </div>
  </section>`,
    },
  }),
  head: () => `  <style>
    .tk-codigo{font-size:1.6rem;font-weight:800;color:var(--accent);letter-spacing:.06em;margin:4px 0 0;font-variant-numeric:tabular-nums}
    .tk-pasos{position:relative;display:flex;justify-content:space-between;margin:12px 0 6px;padding:0 4px}
    .tk-linea{position:absolute;left:20px;right:20px;top:7px;height:3px;background:var(--line);border-radius:999px}
    .tk-avance{height:100%;width:0;background:var(--accent);border-radius:999px}
    .tk-paso{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:1}
    .tk-punto{width:17px;height:17px;border-radius:50%;background:var(--bg);border:3px solid var(--line);box-sizing:border-box}
    .tk-paso.hecho .tk-punto{border-color:var(--accent);background:var(--accent)}
    .tk-paso .tk-label{font-size:.8rem;color:var(--muted)}
    .tk-paso.hecho .tk-label{color:var(--text);font-weight:600}
    .tk-respuesta{margin-top:14px;background:var(--surface);border-left:3px solid var(--accent);padding:10px 14px;border-radius:0 var(--radius) var(--radius) 0;font-size:.92rem}
  </style>`,
  files: (cfg) => ({
    'routes/tickets.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { check, str, isEmail, oneOf } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
const ESTADOS = ${JSON.stringify(ESTADOS)};

const validar = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  email: isEmail,
  subject: (v) => str(v, 3, 120),
  detail: (v) => str(v, 10, 1000),
});

// Vista pública de un ticket: solo lo necesario para el seguimiento (sin email ni detalle)
const publica = (t) => ({ code: t.code, subject: t.subject, status: t.status, reply: t.reply || '', createdAt: t.createdAt });

// POST /api/tickets — abre un reclamo y devuelve el código de seguimiento
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const code = 'TK-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const ticket = await db.insert('tickets', {
    code,
    name: req.body.name.trim(),
    email: req.body.email.toLowerCase().trim(),
    subject: req.body.subject.trim(),
    detail: req.body.detail.trim(),
    status: 'abierto',
    reply: '',
  });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): entró un reclamo nuevo.
  // Es "disparar y seguir": un email caído jamás rompe el alta del reclamo.
  mailer.notify('Nuevo reclamo: ' + ticket.subject, ticket.name + ' (' + ticket.email + ') abrió el reclamo ' + code + '. Detalle: ' + ticket.detail.slice(0, 300) + '. Respondelo desde el panel de reclamos.').catch(() => {});
` : ''}  res.status(201).json(publica(ticket));
});

// GET /api/tickets/codigo/:code — estado público por código de seguimiento
router.get('/codigo/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const t = (await db.find('tickets', x => x.code === code))[0];
  if (!t) return res.status(404).json({ error: 'No encontramos un reclamo con ese código' });
  res.json(publica(t));
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/tickets — todos los reclamos, de más nuevo a más viejo (solo admin; filtro ?status=)
router.get('/', requireAdmin, async (req, res) => {
  let rows = await db.all('tickets');
  if (req.query.status) rows = rows.filter(t => t.status === req.query.status);
  res.json(rows.reverse());
});

// PATCH /api/tickets/:id — actualiza estado y/o respuesta (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.status !== undefined) {
    if (!oneOf(req.body.status, ESTADOS)) {
      return res.status(422).json({ error: 'Estado inválido', errors: { status: 'Debe ser ' + ESTADOS.join(', ') } });
    }
    patch.status = req.body.status;
  }
  if (req.body.reply !== undefined) {
    if (typeof req.body.reply !== 'string' || req.body.reply.length > 1000) {
      return res.status(422).json({ error: 'Respuesta inválida', errors: { reply: 'Texto de hasta 1000 caracteres' } });
    }
    patch.reply = req.body.reply.trim();
  }
  if (!Object.keys(patch).length) return res.status(422).json({ error: 'Nada para actualizar' });
  const row = await db.update('tickets', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Reclamo inexistente' });
  res.json(row);
});
` : `// La gestión de reclamos (listar todos, cambiar estado, responder) requiere el módulo
// de autenticación: activalo en el Builder para habilitar el panel de administración.
`}
module.exports = router;
`,
  }),
  clientJs: (cfg) => `/* Módulo soporte con seguimiento: alta de reclamo con código TK-XXXXXX, consulta de
   estado con línea de progreso animada (Anime.js + red de seguridad) y, con auth activo,
   panel de gestión solo-admin. En la vista previa del Builder simula la API. */
(function () {
  var form = document.getElementById('tk-form');
  var estadoBox = document.getElementById('tk-estado');
  if (!form && !estadoBox) return;
  var ESTADOS = ['abierto', 'en-proceso', 'resuelto'];
  var LABELS = { abierto: 'Recibido', 'en-proceso': 'En proceso', resuelto: 'Resuelto' };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Escape para usar dentro de atributos HTML (App.esc no cubre comillas)
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };

  function mostrarCodigo(code) {
    var box = document.getElementById('tk-nuevo');
    var el = document.getElementById('tk-codigo-nuevo');
    if (el) el.textContent = code;
    if (box) box.hidden = false;
    var input = document.getElementById('tk-buscar');
    if (input) input.value = code;
  }

  // Alta de reclamo
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { mostrarCodigo('TK-DEMO01'); form.reset(); return; }
    try {
      var t = await App.api('/api/tickets', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      mostrarCodigo(t.code);
      App.toast('Reclamo enviado. ¡Guardá el código!');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  // Consulta por código
  var buscarInput = document.getElementById('tk-buscar');
  var buscarBtn = document.getElementById('tk-buscar-btn');
  async function buscar() {
    var code = (buscarInput && buscarInput.value || '').trim().toUpperCase();
    if (!code) { App.toast('Ingresá el código de seguimiento'); return; }
    if (window.__PREVIEW__) {
      pintarEstado({ code: code, subject: 'Consulta de ejemplo', status: 'en-proceso', reply: 'Estamos revisando tu caso, te escribimos por email.', createdAt: new Date().toISOString() });
      return;
    }
    try { pintarEstado(await App.api('/api/tickets/codigo/' + encodeURIComponent(code))); }
    catch (err) {
      if (err.message !== 'preview' && estadoBox) estadoBox.innerHTML = '<p class="muted" style="margin:12px 0 0">' + App.esc(err.message) + '</p>';
    }
  }
  if (buscarBtn) buscarBtn.addEventListener('click', buscar);
  if (buscarInput) buscarInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });

  function pintarEstado(t) {
    if (!estadoBox) return;
    var idx = ESTADOS.indexOf(t.status);
    if (idx < 0) idx = 0;
    var pasos = '';
    ESTADOS.forEach(function (st, i) {
      pasos += '<div class="tk-paso' + (i <= idx ? ' hecho' : '') + '"><span class="tk-punto"></span><span class="tk-label">' + LABELS[st] + '</span></div>';
    });
    estadoBox.innerHTML =
      '<p style="margin:16px 0 2px"><strong>' + App.esc(t.subject) + '</strong> <span class="muted">(' + App.esc(t.code) + ')</span></p>' +
      '<p class="muted" style="margin:0 0 6px;font-size:.85rem">Abierto el ' + new Date(t.createdAt).toLocaleDateString('es-AR') + '</p>' +
      '<div class="tk-pasos"><div class="tk-linea"><div class="tk-avance" id="tk-avance"></div></div>' + pasos + '</div>' +
      (t.reply ? '<div class="tk-respuesta"><strong>Respuesta del equipo:</strong><p style="margin:6px 0 0">' + App.esc(t.reply) + '</p></div>' : '');
    animarAvance(idx);
  }

  function animarAvance(idx) {
    var avance = document.getElementById('tk-avance');
    if (!avance) return;
    var pct = Math.round(idx * 100 / (ESTADOS.length - 1)) + '%';
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { avance.style.width = pct; return; }
    anime.animate(avance, { width: ['0%', pct], duration: 700, ease: 'outCubic' });
    // Red de seguridad: fija el estado final si el loop está pausado (pestaña oculta)
    setTimeout(function () { avance.style.width = pct; }, 900);
  }
${cfg.moduleIds.includes('auth') ? `
  // Panel de gestión (solo admin): tabla con estado y respuesta editables por reclamo
  var adminBox = document.getElementById('tk-admin');
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  if (adminBox && ((me && me.role === 'admin') || window.__PREVIEW__)) {
    adminBox.hidden = false;
    cargarAdmin();
  }

  async function cargarAdmin() {
    var cont = document.getElementById('tk-admin-tabla');
    if (!cont) return;
    var rows = [];
    if (window.__PREVIEW__) {
      rows = [{ id: '1', code: 'TK-DEMO01', subject: 'Consulta de ejemplo', name: 'Laura Gómez', email: 'laura@mail.com', status: 'abierto', reply: '', detail: 'Detalle de ejemplo para la vista previa.', createdAt: new Date().toISOString() }];
    } else {
      try { rows = await App.api('/api/tickets'); }
      catch (err) { if (err.message !== 'preview') cont.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; return; }
    }
    cont.innerHTML = App.table(rows, [
      { label: 'Fecha', render: function (t) { return t.createdAt ? new Date(t.createdAt).toLocaleDateString('es-AR') : '—'; } },
      { key: 'code', label: 'Código' },
      { label: 'Asunto', render: function (t) { return '<span title="' + attr(t.detail || '') + '">' + App.esc(t.subject) + '</span>'; } },
      { label: 'Contacto', render: function (t) { return App.esc(t.name) + '<br><span class="muted">' + App.esc(t.email) + '</span>'; } },
      { label: 'Estado', render: function (t) {
        return '<select data-tk-status="' + t.id + '" style="width:auto">' + ESTADOS.map(function (s) {
          return '<option value="' + s + '"' + (s === t.status ? ' selected' : '') + '>' + LABELS[s] + '</option>';
        }).join('') + '</select>';
      } },
      { label: 'Respuesta', render: function (t) { return '<input data-tk-reply="' + t.id + '" value="' + attr(t.reply || '') + '" placeholder="Respuesta para el cliente" style="min-width:180px">'; } },
      { label: '', render: function (t) { return '<button class="btn ghost" type="button" data-tk-guardar="' + t.id + '">Guardar</button>'; } },
    ]);
    cont.querySelectorAll('[data-tk-guardar]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.getAttribute('data-tk-guardar');
        var sel = cont.querySelector('[data-tk-status="' + id + '"]');
        var rep = cont.querySelector('[data-tk-reply="' + id + '"]');
        try {
          await App.api('/api/tickets/' + id, { method: 'PATCH', body: { status: sel.value, reply: rep.value } });
          App.toast('Reclamo actualizado');
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Soporte con seguimiento**: el visitante abre reclamos en \`/soporte.html\` y los consulta con su código TK-XXXXXX. ${cfg.moduleIds.includes('auth') ? 'Los administradores gestionan estado y respuesta desde la misma página (sección "Gestión de reclamos").' : 'Para gestionar los reclamos (cambiar estado y responder) activá el módulo **Autenticación** en el Builder; sin él, los reclamos quedan guardados pero solo se consultan por código.'}`,
  ],
};
