// Solicitud de devolución o cambio (RMA): el cliente pide una devolución/cambio desde
// /devoluciones.html indicando su comprobante, el producto y el motivo, y recibe un código
// (RTN-XXXXXX) para seguir el estado sin necesidad de cuenta. El estado se muestra como una
// línea de progreso (Solicitada → Aprobada → Recibida → Resuelta, con "Rechazada" como cierre
// alternativo) animada con Anime.js (red de seguridad setTimeout + respeta
// "prefers-reduced-motion"). Con auth activo, la misma página suma un panel de gestión solo-admin
// (cambiar estado y dejar una nota). Sin auth la solicitud se guarda igual y se consulta por
// código; la gestión queda deshabilitada y se avisa en el README. Distinto de "ordertrack"
// (seguimiento de un pedido que emite el negocio) y de "tickets" (soporte genérico): acá el
// cliente inicia una devolución de un producto ya comprado y el negocio la aprueba o rechaza.
const ESTADOS = ['solicitada', 'aprobada', 'recibida', 'resuelta'];

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'returns', type: 'functional', name: 'Devoluciones y cambios',
  description: 'Solicitud de devolución/cambio (RMA): el cliente pide una devolución indicando comprobante, producto y motivo, recibe un código de seguimiento y consulta el estado (línea de progreso animada). Con auth activo, panel de gestión para administradores (aprobar/rechazar y notas).',
  usesAnime: true,
  mounts: [{ route: '/api/returns', file: 'routes/returns.js' }],
  collections: ['returns'],
  nav: () => [{ label: 'Devoluciones', href: '/devoluciones.html' }],
  pages: (cfg) => ({
    devoluciones: {
      title: 'Devoluciones y cambios',
      html: `  <section>
    <div class="container">
      <h2>Devoluciones y cambios</h2>
      <p class="section-sub">¿Necesitás devolver o cambiar un producto? Pedilo acá y seguí el estado con tu código.</p>
      <div class="grid cols-2">
        <form id="rt-form" class="card">
          <h3>Solicitar una devolución</h3>
          <label>Nombre</label><input name="name" required maxlength="80">
          <label>Email</label><input name="email" type="email" required>
          <label>N.º de comprobante o pedido</label><input name="order" required maxlength="60" placeholder="El que figura en tu factura o ticket">
          <label>Producto</label><input name="product" required maxlength="120" placeholder="Qué producto querés devolver o cambiar">
          <label>Tipo</label>
          <select name="kind" required>
            <option value="devolucion">Devolución (quiero mi dinero)</option>
            <option value="cambio">Cambio (por otro producto/talle)</option>
          </select>
          <label>Motivo</label><textarea name="reason" rows="4" required minlength="10" maxlength="1000" placeholder="Contanos el motivo (falla, talle, no era lo esperado, etc.)"></textarea>
          <div style="margin-top:16px"><button class="btn" type="submit">Enviar solicitud</button></div>
        </form>
        <div>
          <div class="card" id="rt-nuevo" hidden style="margin-bottom:20px">
            <h3>¡Solicitud recibida!</h3>
            <p class="muted" style="margin:0">Guardá este código para seguir el estado:</p>
            <p class="rt-codigo" id="rt-codigo-nuevo">—</p>
          </div>
          <div class="card">
            <h3>Seguí tu solicitud</h3>
            <label for="rt-buscar">Código de seguimiento</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input id="rt-buscar" placeholder="RTN-A1B2C3" style="flex:1;min-width:150px;text-transform:uppercase">
              <button class="btn" type="button" id="rt-buscar-btn" style="width:auto">Consultar</button>
            </div>
            <div id="rt-estado"></div>
          </div>
        </div>
      </div>${cfg.moduleIds.includes('auth') ? `
      <div id="rt-admin" hidden style="margin-top:40px">
        <h3>Gestión de devoluciones <span class="muted" style="font-weight:400;font-size:.85rem">(solo administradores)</span></h3>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
          <button class="btn ghost" type="button" id="rt-csv">Descargar CSV</button>
        </div>
        <div id="rt-admin-tabla"><p class="muted">Cargando…</p></div>
      </div>` : ''}
    </div>
  </section>`,
    },
  }),
  head: () => `  <style>
    .rt-codigo{font-size:1.6rem;font-weight:800;color:var(--accent);letter-spacing:.06em;margin:4px 0 0;font-variant-numeric:tabular-nums}
    .rt-pasos{position:relative;display:flex;justify-content:space-between;margin:14px 0 6px;padding:0 4px}
    .rt-linea{position:absolute;left:20px;right:20px;top:7px;height:3px;background:var(--line);border-radius:999px}
    .rt-avance{height:100%;width:0;background:var(--accent);border-radius:999px}
    .rt-paso{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:1;flex:1}
    .rt-punto{width:17px;height:17px;border-radius:50%;background:var(--bg);border:3px solid var(--line);box-sizing:border-box}
    .rt-paso.hecho .rt-punto{border-color:var(--accent);background:var(--accent)}
    .rt-paso .rt-label{font-size:.76rem;color:var(--muted);text-align:center}
    .rt-paso.hecho .rt-label{color:var(--text);font-weight:600}
    .rt-nota{margin-top:14px;background:var(--surface);border-left:3px solid var(--accent);padding:10px 14px;border-radius:0 var(--radius) var(--radius) 0;font-size:.92rem}
    .rt-rechazada{border-left-color:#dc2626}
    .rt-rechazada .rt-badge{color:#dc2626;font-weight:700}
  </style>`,
  files: (cfg) => ({
    'routes/returns.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { check, str, isEmail, oneOf } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
// Estados del flujo de devolución. "rechazada" es un cierre alternativo (no está en la línea).
const ESTADOS = ${JSON.stringify(ESTADOS)};
const TODOS_ESTADOS = ESTADOS.concat(['rechazada']);
const TIPOS = ['devolucion', 'cambio'];

const validar = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  email: isEmail,
  order: (v) => str(v, 1, 60),
  product: (v) => str(v, 2, 120),
  kind: (v) => oneOf(v, TIPOS),
  reason: (v) => str(v, 10, 1000),
});

// Vista pública de una solicitud: solo lo necesario para el seguimiento (sin email)
const publica = (r) => ({ code: r.code, product: r.product, kind: r.kind, status: r.status, note: r.note || '', createdAt: r.createdAt });

// POST /api/returns — abre una solicitud y devuelve el código de seguimiento
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const code = 'RTN-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const row = await db.insert('returns', {
    code,
    name: req.body.name.trim(),
    email: req.body.email.toLowerCase().trim(),
    order: req.body.order.trim(),
    product: req.body.product.trim(),
    kind: req.body.kind,
    reason: req.body.reason.trim(),
    status: 'solicitada',
    note: '',
  });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): entró una solicitud de devolución/cambio.
  // Es "disparar y seguir": un email caído jamás rompe el alta de la solicitud.
  mailer.notify('Nueva solicitud de ' + row.kind + ': ' + row.product, row.name + ' (' + row.email + ') solicitó ' + row.kind + ' de "' + row.product + '" (compra ' + row.order + '). Motivo: ' + row.reason.slice(0, 300) + '. Código: ' + code + '. Gestionala desde el panel de devoluciones.').catch(() => {});
` : ''}  res.status(201).json(publica(row));
});

// GET /api/returns/codigo/:code — estado público por código de seguimiento
router.get('/codigo/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const r = (await db.find('returns', x => x.code === code))[0];
  if (!r) return res.status(404).json({ error: 'No encontramos una solicitud con ese código' });
  res.json(publica(r));
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/returns — todas las solicitudes, de más nueva a más vieja (solo admin; filtro ?status=)
router.get('/', requireAdmin, async (req, res) => {
  let rows = await db.all('returns');
  if (req.query.status) rows = rows.filter(r => r.status === req.query.status);
  res.json(rows.reverse());
});

// PATCH /api/returns/:id — actualiza estado y/o nota (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.status !== undefined) {
    if (!oneOf(req.body.status, TODOS_ESTADOS)) {
      return res.status(422).json({ error: 'Estado inválido', errors: { status: 'Debe ser ' + TODOS_ESTADOS.join(', ') } });
    }
    patch.status = req.body.status;
  }
  if (req.body.note !== undefined) {
    if (typeof req.body.note !== 'string' || req.body.note.length > 1000) {
      return res.status(422).json({ error: 'Nota inválida', errors: { note: 'Texto de hasta 1000 caracteres' } });
    }
    patch.note = req.body.note.trim();
  }
  if (!Object.keys(patch).length) return res.status(422).json({ error: 'Nada para actualizar' });
  const row = await db.update('returns', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Solicitud inexistente' });
  res.json(row);
});
` : `// La gestión de devoluciones (listar todas, aprobar/rechazar, notas) requiere el módulo de
// autenticación: activalo en el Builder para habilitar el panel de administración.
`}
module.exports = router;
`,
  }),
  clientJs: (cfg) => `/* Módulo devoluciones y cambios: alta de solicitud con código RTN-XXXXXX, consulta de estado
   con línea de progreso animada (Anime.js + red de seguridad) y, con auth activo, panel de
   gestión solo-admin. En la vista previa del Builder simula la API. */
(function () {
  var form = document.getElementById('rt-form');
  var estadoBox = document.getElementById('rt-estado');
  if (!form && !estadoBox) return;
  var ESTADOS = ${JSON.stringify(ESTADOS)};
  var LABELS = { solicitada: 'Solicitada', aprobada: 'Aprobada', recibida: 'Recibida', resuelta: 'Resuelta', rechazada: 'Rechazada' };
  var KIND = { devolucion: 'Devolución', cambio: 'Cambio' };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Escape para usar dentro de atributos HTML (App.esc no cubre comillas)
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };

  function mostrarCodigo(code) {
    var box = document.getElementById('rt-nuevo');
    var el = document.getElementById('rt-codigo-nuevo');
    if (el) el.textContent = code;
    if (box) box.hidden = false;
    var input = document.getElementById('rt-buscar');
    if (input) input.value = code;
  }

  // Alta de solicitud
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { mostrarCodigo('RTN-DEMO01'); form.reset(); return; }
    try {
      var r = await App.api('/api/returns', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      mostrarCodigo(r.code);
      App.toast('Solicitud enviada. ¡Guardá el código!');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  // Consulta por código
  var buscarInput = document.getElementById('rt-buscar');
  var buscarBtn = document.getElementById('rt-buscar-btn');
  async function buscar() {
    var code = (buscarInput && buscarInput.value || '').trim().toUpperCase();
    if (!code) { App.toast('Ingresá el código de seguimiento'); return; }
    if (window.__PREVIEW__) {
      pintarEstado({ code: code, product: 'Zapatillas modelo X', kind: 'cambio', status: 'aprobada', note: 'Aprobada. Envianos el producto a nuestra sucursal central.', createdAt: new Date().toISOString() });
      return;
    }
    try { pintarEstado(await App.api('/api/returns/codigo/' + encodeURIComponent(code))); }
    catch (err) {
      if (err.message !== 'preview' && estadoBox) estadoBox.innerHTML = '<p class="muted" style="margin:12px 0 0">' + App.esc(err.message) + '</p>';
    }
  }
  if (buscarBtn) buscarBtn.addEventListener('click', buscar);
  if (buscarInput) buscarInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });

  function pintarEstado(r) {
    if (!estadoBox) return;
    var rechazada = r.status === 'rechazada';
    var idx = ESTADOS.indexOf(r.status);
    if (idx < 0) idx = 0;
    var encabezado =
      '<p style="margin:16px 0 2px"><strong>' + App.esc(r.product) + '</strong> <span class="muted">(' + App.esc(r.code) + ')</span></p>' +
      '<p class="muted" style="margin:0 0 6px;font-size:.85rem">' + App.esc(KIND[r.kind] || r.kind) + ' · solicitada el ' + new Date(r.createdAt).toLocaleDateString('es-AR') + '</p>';
    if (rechazada) {
      estadoBox.innerHTML = encabezado +
        '<div class="rt-nota rt-rechazada"><span class="rt-badge">${phIcon('x', { size: 14 })} Solicitud rechazada</span>' +
        (r.note ? '<p style="margin:6px 0 0">' + App.esc(r.note) + '</p>' : '') + '</div>';
      return;
    }
    var pasos = '';
    ESTADOS.forEach(function (st, i) {
      pasos += '<div class="rt-paso' + (i <= idx ? ' hecho' : '') + '"><span class="rt-punto"></span><span class="rt-label">' + LABELS[st] + '</span></div>';
    });
    estadoBox.innerHTML = encabezado +
      '<div class="rt-pasos"><div class="rt-linea"><div class="rt-avance" id="rt-avance"></div></div>' + pasos + '</div>' +
      (r.note ? '<div class="rt-nota"><strong>Nota del equipo:</strong><p style="margin:6px 0 0">' + App.esc(r.note) + '</p></div>' : '');
    animarAvance(idx);
  }

  function animarAvance(idx) {
    var avance = document.getElementById('rt-avance');
    if (!avance) return;
    var pct = Math.round(idx * 100 / (ESTADOS.length - 1)) + '%';
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { avance.style.width = pct; return; }
    anime.animate(avance, { width: ['0%', pct], duration: 700, ease: 'outCubic' });
    // Red de seguridad: fija el estado final si el loop está pausado (pestaña oculta)
    setTimeout(function () { avance.style.width = pct; }, 900);
  }
${cfg.moduleIds.includes('auth') ? `
  // Panel de gestión (solo admin): tabla con estado y nota editables por solicitud
  var TODOS_ESTADOS = ESTADOS.concat(['rechazada']);
  var adminBox = document.getElementById('rt-admin');
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var filasAdmin = [];
  if (adminBox && ((me && me.role === 'admin') || window.__PREVIEW__)) {
    adminBox.hidden = false;
    cargarAdmin();
  }

  async function cargarAdmin() {
    var cont = document.getElementById('rt-admin-tabla');
    if (!cont) return;
    if (window.__PREVIEW__) {
      filasAdmin = [{ id: '1', code: 'RTN-DEMO01', product: 'Zapatillas modelo X', kind: 'cambio', name: 'Laura Gómez', email: 'laura@mail.com', order: 'F-0012', reason: 'El talle no era el correcto.', status: 'solicitada', note: '', createdAt: new Date().toISOString() }];
    } else {
      try { filasAdmin = await App.api('/api/returns'); }
      catch (err) { if (err.message !== 'preview') cont.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; return; }
    }
    cont.innerHTML = App.table(filasAdmin, [
      { label: 'Fecha', render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } },
      { key: 'code', label: 'Código' },
      { label: 'Producto', render: function (r) { return '<span title="' + attr(r.reason || '') + '">' + App.esc(r.product) + '</span><br><span class="muted" style="font-size:.8rem">Comprob.: ' + App.esc(r.order || '—') + '</span>'; } },
      { label: 'Tipo', render: function (r) { return '<span class="badge" style="vertical-align:baseline">' + App.esc(KIND[r.kind] || r.kind) + '</span>'; } },
      { label: 'Contacto', render: function (r) { return App.esc(r.name) + '<br><span class="muted">' + App.esc(r.email) + '</span>'; } },
      { label: 'Estado', render: function (r) {
        return '<select data-rt-status="' + r.id + '" style="width:auto">' + TODOS_ESTADOS.map(function (s) {
          return '<option value="' + s + '"' + (s === r.status ? ' selected' : '') + '>' + LABELS[s] + '</option>';
        }).join('') + '</select>';
      } },
      { label: 'Nota', render: function (r) { return '<input data-rt-note="' + r.id + '" value="' + attr(r.note || '') + '" placeholder="Nota para el cliente" style="min-width:180px">'; } },
      { label: '', render: function (r) { return '<button class="btn ghost" type="button" data-rt-guardar="' + r.id + '">Guardar</button>'; } },
    ]);
    cont.querySelectorAll('[data-rt-guardar]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.getAttribute('data-rt-guardar');
        var sel = cont.querySelector('[data-rt-status="' + id + '"]');
        var note = cont.querySelector('[data-rt-note="' + id + '"]');
        if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el cambio'); return; }
        try {
          await App.api('/api/returns/' + id, { method: 'PATCH', body: { status: sel.value, note: note.value } });
          var f = filasAdmin.filter(function (x) { return x.id === id; })[0];
          if (f) { f.status = sel.value; f.note = note.value; }
          App.toast('Solicitud actualizada');
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }

  var csvBtn = document.getElementById('rt-csv');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    var ET = { createdAt: 'Fecha', code: 'Código', product: 'Producto', order: 'Comprobante', kind: 'Tipo', name: 'Nombre', email: 'Email', status: 'Estado', reason: 'Motivo', note: 'Nota' };
    var claves = ['createdAt', 'code', 'product', 'order', 'kind', 'name', 'email', 'status', 'reason', 'note'];
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [claves.map(function (k) { return celda(ET[k] || k); }).join(';')];
    filasAdmin.forEach(function (r) { lineas.push(claves.map(function (k) { return celda(k === 'kind' ? (KIND[r[k]] || r[k]) : (k === 'status' ? (LABELS[r[k]] || r[k]) : r[k])); }).join(';')); });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'devoluciones-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Devoluciones y cambios**: el cliente abre solicitudes en \`/devoluciones.html\` y las consulta con su código RTN-XXXXXX (la vista pública no expone su email). Las solicitudes se guardan en la colección \`returns\`. ${cfg.moduleIds.includes('auth') ? 'Los administradores aprueban/rechazan, cambian el estado, dejan una nota y exportan el CSV desde la misma página (sección "Gestión de devoluciones").' : 'Para gestionar las solicitudes (aprobar/rechazar y notas) activá el módulo **Autenticación** en el Builder; sin él, quedan guardadas pero solo se consultan por código.'}`,
  ],
};
