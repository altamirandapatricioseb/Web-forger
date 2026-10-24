// Seguimiento de pedidos: página pública /seguimiento.html donde el cliente ingresa el código de
// su pedido (OT-XXXXXX) y ve el estado como una línea de progreso animada (Recibido → En
// preparación → Enviado → Entregado), sin necesidad de cuenta. Los pedidos los crea el negocio:
// con el módulo de autenticación activo, la página /pedidos.html solo-admin permite dar de alta un
// pedido (genera el código), cambiar su estado y agregar una nota, además de listar y exportar CSV.
// El backend guarda los pedidos (colección orders) y siembra un pedido de ejemplo la primera vez
// para que el seguimiento sea usable enseguida. La vista pública nunca expone el email ni el
// detalle interno, solo el nombre de pila y el estado. Distinto de "tickets" (el visitante abre un
// reclamo de soporte) y de "bookings"/"eventregister": acá el negocio emite un código de pedido y
// el cliente sigue su avance, como el tracking de una tienda online.
const ESTADOS = [
  { id: 'recibido', label: 'Recibido' },
  { id: 'preparacion', label: 'En preparación' },
  { id: 'enviado', label: 'Enviado' },
  { id: 'entregado', label: 'Entregado' },
];

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'ordertrack', type: 'functional', name: 'Seguimiento de pedidos',
  description: 'Página pública /seguimiento.html: el cliente ingresa el código de su pedido y ve su estado como línea de progreso animada (Anime.js). El negocio crea y actualiza los pedidos desde /pedidos.html (requiere auth). Colección orders.',
  usesAnime: true,
  mounts: [{ route: '/api/ordertrack', file: 'routes/ordertrack.js' }],
  collections: ['orders'],
  nav: (cfg) => {
    const links = [{ label: 'Seguí tu pedido', href: '/seguimiento.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Pedidos', href: '/pedidos.html', id: 'nav-pedidos' });
    return links;
  },
  head: () => `  <style>
    .ot-pasos{position:relative;display:flex;justify-content:space-between;margin:18px 0 6px;padding:0 4px}
    .ot-pasos::before{content:'';position:absolute;top:14px;left:24px;right:24px;height:3px;background:var(--line);border-radius:999px}
    .ot-linea{position:absolute;top:14px;left:24px;height:3px;background:var(--accent);border-radius:999px;width:0}
    .ot-paso{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;text-align:center}
    .ot-bola{width:30px;height:30px;border-radius:50%;background:var(--bg);border:3px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:.85rem;color:var(--muted)}
    .ot-paso.done .ot-bola{border-color:var(--accent);background:var(--accent);color:#fff}
    .ot-paso.current .ot-bola{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb, var(--accent) 20%, transparent)}
    .ot-paso small{font-size:.78rem;color:var(--muted);max-width:80px}
    .ot-paso.done small,.ot-paso.current small{color:var(--text)}
    .ot-cancel{background:color-mix(in srgb, #b91c1c 10%, transparent);border-left:3px solid #b91c1c;color:#b91c1c;padding:12px 14px;border-radius:0 var(--radius) var(--radius) 0;font-weight:600}
    .ot-nota{background:var(--surface);border-radius:var(--radius);padding:12px 14px;margin-top:10px;font-size:.9rem}
    .ot-meta{color:var(--muted);font-size:.85rem;margin-top:4px}
  </style>`,
  files: (cfg) => ({
    'routes/ordertrack.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { check, str, oneOf } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Estados posibles del pedido, en orden (editá las etiquetas si tu operación usa otras)
const ESTADOS = ${JSON.stringify(ESTADOS, null, 2)};
const IDS = ESTADOS.map(e => e.id);
const labelDe = (id) => (ESTADOS.find(e => e.id === id) || {}).label || id;

// Siembra un pedido de ejemplo la primera vez para que /seguimiento.html sea usable enseguida
db.seedIfEmpty('orders', [
  { code: 'OT-DEMO01', customer: 'Cliente de ejemplo', email: 'ejemplo@mail.com', detail: 'Pedido de muestra', status: 'preparacion', note: 'Estamos preparando tu pedido.' },
]);

const genCode = () => 'OT-' + crypto.randomBytes(3).toString('hex').toUpperCase();

// Vista pública de un pedido: solo nombre de pila y estado, nunca el email ni datos internos
const publico = (o) => ({
  code: o.code, status: o.status, statusLabel: labelDe(o.status),
  states: ESTADOS, canceled: o.status === 'cancelado',
  customer: (o.customer || '').split(' ')[0], note: o.note || '', updatedAt: o.updatedAt || o.createdAt,
});

// GET /api/ordertrack/code/:code — estado público por código de pedido
router.get('/code/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const o = (await db.find('orders', r => (r.code || '').toUpperCase() === code))[0];
  if (!o) return res.status(404).json({ error: 'No encontramos un pedido con ese código' });
  res.json(publico(o));
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/ordertrack — todos los pedidos, de más nuevo a más viejo (solo admin; filtro ?status=)
router.get('/', requireAdmin, async (req, res) => {
  let rows = await db.all('orders');
  if (req.query.status) rows = rows.filter(o => o.status === req.query.status);
  res.json({ orders: rows.reverse(), states: ESTADOS });
});

// POST /api/ordertrack — crea un pedido y genera su código (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, { customer: (v) => str(v, 2, 80) });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const status = oneOf(req.body.status, IDS) ? req.body.status : 'recibido';
  const order = await db.insert('orders', {
    code: genCode(),
    customer: req.body.customer.trim(),
    email: typeof req.body.email === 'string' ? req.body.email.trim().slice(0, 120) : '',
    detail: typeof req.body.detail === 'string' ? req.body.detail.trim().slice(0, 500) : '',
    status,
    note: typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : '',
    updatedAt: new Date().toISOString(),
  });
  res.status(201).json(order);
});

// PATCH /api/ordertrack/:id — cambia estado y/o nota del pedido (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = { updatedAt: new Date().toISOString() };
  if (req.body.status !== undefined) {
    if (!oneOf(req.body.status, IDS.concat('cancelado'))) return res.status(422).json({ error: 'Estado inválido', errors: { status: 'Debe ser ' + IDS.concat('cancelado').join(', ') } });
    patch.status = req.body.status;
  }
  if (req.body.note !== undefined) {
    if (typeof req.body.note !== 'string' || req.body.note.length > 500) return res.status(422).json({ error: 'Nota inválida', errors: { note: 'Texto de hasta 500 caracteres' } });
    patch.note = req.body.note.trim();
  }
  const row = await db.update('orders', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Pedido inexistente' });
  res.json(row);
});
` : `// La gestión de pedidos (crear, cambiar estado, notas, listado) requiere el módulo de
// autenticación: activalo en el Builder para habilitar /pedidos.html. Sin él, el pedido de
// ejemplo sembrado permite probar /seguimiento.html; los pedidos reales se editan en
// data/orders.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      seguimiento: {
        title: 'Seguí tu pedido',
        html: `  <section id="seguimiento">
    <div class="container" style="max-width:640px">
      <h2>Seguí tu pedido</h2>
      <p class="section-sub">Ingresá el código que te dimos (por ejemplo OT-A1B2C3) para ver el estado de tu pedido.</p>
      <div class="card">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="ot-buscar" placeholder="OT-A1B2C3" style="flex:1;min-width:150px;text-transform:uppercase">
          <button class="btn" type="button" id="ot-ver">Ver estado</button>
        </div>
        <div id="ot-estado"></div>
      </div>
      <noscript><p class="muted">Activá JavaScript para consultar el estado de tu pedido.</p></noscript>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs.pedidos = {
        title: 'Pedidos',
        html: `  <section>
    <div class="container">
      <h2>Gestión de pedidos</h2>
      <p class="section-sub">Creá pedidos (se genera el código para el cliente), cambiá el estado y agregá notas. Solo visible para administradores.</p>
      <details class="card" style="margin-bottom:14px">
        <summary style="cursor:pointer;font-weight:600">${phIcon('plus', { size: 14 })} Nuevo pedido</summary>
        <form id="ot-nuevo" style="margin-top:10px">
          <label>Cliente</label><input name="customer" required maxlength="80" placeholder="Nombre del cliente">
          <label>Email (opcional)</label><input name="email" type="email" maxlength="120" placeholder="Para avisarle por email">
          <label>Detalle (opcional)</label><input name="detail" maxlength="500" placeholder="Qué incluye el pedido">
          <label>Estado inicial</label><select name="status" id="ot-nuevo-estado"></select>
          <button class="btn" type="submit" style="margin-top:10px">Crear pedido</button>
        </form>
      </details>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
        <select id="ot-filtro" style="width:auto;min-width:200px"><option value="">Todos los estados</option></select>
        <button class="btn ghost" type="button" id="ot-csv">Descargar CSV</button>
      </div>
      <div id="ot-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo seguimiento de pedidos: página pública que busca un pedido por código y dibuja la
   línea de progreso animada (Anime.js + red de seguridad); con auth activo, panel admin en
   /pedidos.html para crear y actualizar pedidos. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ESTADOS = ${JSON.stringify(ESTADOS)};
  var IDS = ESTADOS.map(function (e) { return e.id; });

  function timelineHtml(estado) {
    if (estado.canceled) {
      return '<div class="ot-cancel">Este pedido fue cancelado.</div>' +
        (estado.note ? '<div class="ot-nota">' + App.esc(estado.note) + '</div>' : '');
    }
    var states = estado.states || ESTADOS;
    var idx = states.map(function (s) { return s.id; }).indexOf(estado.status);
    var pasos = states.map(function (s, i) {
      var cls = i < idx ? 'done' : (i === idx ? 'current' : '');
      return '<div class="ot-paso ' + cls + '"><div class="ot-bola">' + (i < idx ? '${phIcon('check', { size: 14 })}' : (i + 1)) + '</div><small>' + App.esc(s.label) + '</small></div>';
    }).join('');
    var pct = states.length > 1 ? Math.max(0, idx) / (states.length - 1) * 100 : 0;
    return '<div class="ot-pasos"><div class="ot-linea" data-pct="' + pct + '"></div>' + pasos + '</div>' +
      '<p class="ot-meta">Estado actual: <strong>' + App.esc(estado.statusLabel) + '</strong>' +
      (estado.customer ? ' · Pedido de ' + App.esc(estado.customer) : '') +
      (estado.updatedAt ? ' · Actualizado el ' + new Date(estado.updatedAt).toLocaleDateString('es-AR') : '') + '</p>' +
      (estado.note ? '<div class="ot-nota">' + App.esc(estado.note) + '</div>' : '');
  }

  function animarLinea(scope) {
    var linea = scope.querySelector('.ot-linea');
    if (!linea) return;
    var pct = Number(linea.getAttribute('data-pct')) || 0;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { linea.style.width = pct + '%'; return; }
    anime.animate(linea, { width: ['0%', pct + '%'], duration: 700, ease: 'outCubic' });
    setTimeout(function () { linea.style.width = pct + '%'; }, 900);
  }

  // ---- Página pública (/seguimiento.html) ----
  var estadoBox = document.getElementById('ot-estado');
  var verBtn = document.getElementById('ot-ver');
  var buscarInput = document.getElementById('ot-buscar');
  if (estadoBox && verBtn) {
    function pintarEstado(estado) { estadoBox.innerHTML = timelineHtml(estado); animarLinea(estadoBox); }

    async function consultar() {
      var code = (buscarInput.value || '').toUpperCase().trim();
      if (!code) { App.toast('Ingresá tu código de pedido'); return; }
      if (window.__PREVIEW__) {
        pintarEstado({ code: code, status: 'enviado', statusLabel: 'Enviado', states: ESTADOS, canceled: false, customer: 'María', note: 'Tu pedido salió del depósito.', updatedAt: new Date().toISOString() });
        return;
      }
      estadoBox.innerHTML = '<p class="muted" style="margin:12px 0 0">Buscando…</p>';
      try {
        pintarEstado(await App.api('/api/ordertrack/code/' + encodeURIComponent(code)));
      } catch (err) {
        if (err.message !== 'preview') estadoBox.innerHTML = '<p class="muted" style="margin:12px 0 0">' + App.esc(err.message) + '</p>';
      }
    }

    verBtn.addEventListener('click', consultar);
    if (buscarInput) buscarInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); consultar(); } });
    // Si el link trae ?code=OT-XXXX consulta directo (útil para mandar el link por email)
    try { var qc = new URLSearchParams(location.search).get('code'); if (qc && buscarInput) { buscarInput.value = qc; consultar(); } } catch (e) {}
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel admin (/pedidos.html) ----
  var adminBox = document.getElementById('ot-admin');
  if (adminBox) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var filtro = document.getElementById('ot-filtro');
    var nuevoForm = document.getElementById('ot-nuevo');
    var nuevoEstado = document.getElementById('ot-nuevo-estado');
    var todos = [];
    var TODOS_ESTADOS = ESTADOS.concat([{ id: 'cancelado', label: 'Cancelado' }]);

    if (nuevoEstado) nuevoEstado.innerHTML = ESTADOS.map(function (s) { return '<option value="' + s.id + '">' + App.esc(s.label) + '</option>'; }).join('');
    if (filtro) TODOS_ESTADOS.forEach(function (s) { var o = document.createElement('option'); o.value = s.id; o.textContent = s.label; filtro.appendChild(o); });

    function filtrados() {
      var v = filtro && filtro.value;
      return v ? todos.filter(function (o) { return o.status === v; }) : todos;
    }

    function selEstado(o) {
      return '<select data-status="' + o.id + '" style="width:auto;min-width:150px">' +
        TODOS_ESTADOS.map(function (s) { return '<option value="' + s.id + '"' + (s.id === o.status ? ' selected' : '') + '>' + App.esc(s.label) + '</option>'; }).join('') +
        '</select>';
    }

    function pintar() {
      adminBox.innerHTML = App.table(filtrados(), [
        { label: 'Código', render: function (o) { return '<code>' + App.esc(o.code) + '</code>'; } },
        { key: 'customer', label: 'Cliente' },
        { label: 'Detalle', render: function (o) { return o.detail ? App.esc(o.detail) : '<span class="muted">—</span>'; } },
        { label: 'Estado', render: selEstado },
        { label: 'Actualizado', render: function (o) { return o.updatedAt ? new Date(o.updatedAt).toLocaleDateString('es-AR') : '—'; } },
      ]);
      adminBox.querySelectorAll('[data-status]').forEach(function (sel) {
        sel.addEventListener('change', async function () {
          var id = sel.getAttribute('data-status');
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría el estado'); return; }
          try {
            var row = await App.api('/api/ordertrack/' + id, { method: 'PATCH', body: { status: sel.value } });
            var i = todos.findIndex(function (o) { return o.id === id; });
            if (i >= 0) todos[i] = row;
            App.toast('Estado actualizado');
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    if (filtro) filtro.addEventListener('change', pintar);

    if (nuevoForm) nuevoForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = Object.fromEntries(new FormData(nuevoForm));
      if (window.__PREVIEW__) { App.toast('Vista previa: se crearía el pedido (código OT-…)'); return; }
      try {
        var row = await App.api('/api/ordertrack', { method: 'POST', body: datos });
        todos.unshift(row);
        pintar();
        nuevoForm.reset();
        App.toast('Pedido creado: ' + row.code);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var csvBtn = document.getElementById('ot-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var claves = ['code', 'customer', 'email', 'detail', 'status', 'updatedAt'];
      var etq = { code: 'Código', customer: 'Cliente', email: 'Email', detail: 'Detalle', status: 'Estado', updatedAt: 'Actualizado' };
      var label = {}; TODOS_ESTADOS.forEach(function (s) { label[s.id] = s.label; });
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [claves.map(function (k) { return celda(etq[k] || k); }).join(';')];
      filtrados().forEach(function (r) { lineas.push(claves.map(function (k) {
        if (k === 'status') return celda(label[r[k]] || r[k]);
        if (k === 'updatedAt' && r[k]) return celda(new Date(r[k]).toLocaleDateString('es-AR'));
        return celda(r[k]);
      }).join(';')); });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'pedidos-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    function listo(res) { todos = res.orders || []; pintar(); }

    if (window.__PREVIEW__) {
      listo({ orders: [
        { id: '1', code: 'OT-A1B2C3', customer: 'Sofía Ruiz', email: 'sofia@mail.com', detail: '2 productos', status: 'preparacion', updatedAt: new Date().toISOString() },
        { id: '2', code: 'OT-D4E5F6', customer: 'Diego Paz', email: 'diego@mail.com', detail: 'Combo', status: 'entregado', updatedAt: new Date().toISOString() },
      ], states: ESTADOS });
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/ordertrack').then(listo)
        .catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navOt = document.getElementById('nav-pedidos');
    if (navOt && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navOt.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Seguimiento de pedidos**: los clientes consultan el estado por código en \`/seguimiento.html\` (también con \`?code=OT-XXXXXX\` en la URL para mandar por email). Los estados se editan en la constante \`ESTADOS\` de \`routes/ordertrack.js\`. Se siembra un pedido de ejemplo (\`OT-DEMO01\`) la primera vez. ${cfg.moduleIds.includes('auth') ? 'Los administradores crean pedidos (se genera el código), cambian el estado y agregan notas en \`/pedidos.html\`.' : 'Para crear y gestionar pedidos activá el módulo **Autenticación** (habilita \`/pedidos.html\`); sin él, editá \`data/orders.json\`.'} La vista pública muestra solo el nombre de pila y el estado, nunca el email.`,
  ],
};
