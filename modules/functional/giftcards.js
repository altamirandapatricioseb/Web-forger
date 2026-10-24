// Tarjetas de regalo (gift cards): el cliente emite una tarjeta desde /tarjetas-regalo.html
// (para quién, monto y mensaje opcional) y el sistema genera un código único GIFT-XXXXXX con
// saldo igual al monto. Cualquiera puede consultar el saldo por código y canjear (descontar) contra
// ese saldo — el código es la credencial, como en cualquier gift card real. El saldo se muestra con
// un count-up animado con Anime.js (red de seguridad setTimeout + respeta "prefers-reduced-motion").
// Con auth activo, la misma página suma un panel solo-admin con todas las tarjetas, su saldo, la
// posibilidad de anular una tarjeta y CSV. Sin auth las tarjetas se emiten y consultan igual; la
// gestión queda deshabilitada y se avisa en el README. Distinto de "coupons" (descuento porcentual
// sobre una compra) y de "loyalty" (puntos por sellos): acá hay saldo monetario transferible.
const MIN = 500; // Monto mínimo de una tarjeta (editable)
const MAX = 500000; // Monto máximo de una tarjeta (editable)
const MONTOS = [1000, 3000, 5000, 10000]; // Montos sugeridos en la UI

module.exports = {
  id: 'giftcards', type: 'functional', name: 'Tarjetas de regalo',
  description: 'Emisión de gift cards con código único y saldo monetario: el cliente emite una tarjeta (monto + destinatario + mensaje), consulta el saldo por código y canjea contra él, con saldo animado (Anime.js). Con auth activo, panel admin con todas las tarjetas, saldos, anulación y CSV.',
  usesAnime: true,
  mounts: [{ route: '/api/giftcards', file: 'routes/giftcards.js' }],
  collections: ['giftcards'],
  nav: () => [{ label: 'Tarjetas de regalo', href: '/tarjetas-regalo.html' }],
  pages: (cfg) => ({
    'tarjetas-regalo': {
      title: 'Tarjetas de regalo',
      html: `  <section>
    <div class="container">
      <h2>Regalá una tarjeta</h2>
      <p class="section-sub">Elegí un monto, dedicásela a quien quieras y te damos un código para compartir.</p>
      <div class="grid cols-2">
        <form id="gc-form" class="card">
          <h3>Emitir una tarjeta</h3>
          <label>Tu nombre</label><input name="from" required maxlength="80" placeholder="De parte de…">
          <label>Nombre de quien la recibe</label><input name="to" required maxlength="80" placeholder="Para…">
          <label>Email de quien la recibe (opcional)</label><input name="toEmail" type="email" placeholder="para@email.com">
          <label>Monto</label>
          <div class="gc-montos" id="gc-montos">${MONTOS.map((m, i) => `<button type="button" class="gc-monto${i === 0 ? ' on' : ''}" data-monto="${m}">$${m.toLocaleString('es-AR')}</button>`).join('')}</div>
          <input name="amount" type="number" min="${MIN}" max="${MAX}" step="100" value="${MONTOS[0]}" required>
          <label>Mensaje (opcional)</label><textarea name="message" rows="2" maxlength="200" placeholder="¡Feliz cumple!"></textarea>
          <div style="margin-top:16px"><button class="btn" type="submit">Emitir tarjeta</button></div>
        </form>
        <div>
          <div class="card gc-nueva" id="gc-nueva" hidden style="margin-bottom:20px">
            <h3>¡Tarjeta lista!</h3>
            <p class="muted" style="margin:0 0 6px">Compartí este código:</p>
            <div class="gc-code" id="gc-code-nuevo">—</div>
            <p class="muted" style="margin:10px 0 0">Saldo: <strong id="gc-monto-nuevo">—</strong></p>
          </div>
          <div class="card">
            <h3>Consultar / usar una tarjeta</h3>
            <label for="gc-buscar">Código de la tarjeta</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input id="gc-buscar" placeholder="GIFT-XXXXXX" style="flex:1;min-width:150px;text-transform:uppercase">
              <button class="btn" type="button" id="gc-buscar-btn" style="width:auto">Ver saldo</button>
            </div>
            <div id="gc-estado"></div>
          </div>
        </div>
      </div>${cfg.moduleIds.includes('auth') ? `
      <div id="gc-admin" hidden style="margin-top:40px">
        <h3>Tarjetas emitidas <span class="muted" style="font-weight:400;font-size:.85rem">(solo administradores)</span></h3>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
          <button class="btn ghost" type="button" id="gc-csv">Descargar CSV</button>
        </div>
        <div id="gc-admin-tabla"><p class="muted">Cargando…</p></div>
      </div>` : ''}
    </div>
  </section>`,
    },
  }),
  head: () => `  <style>
    .gc-montos{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 10px}
    .gc-monto{flex:1;min-width:80px;padding:9px 10px;border:1px solid var(--line);background:var(--bg);border-radius:var(--radius);font-weight:700;color:var(--muted);cursor:pointer;font-variant-numeric:tabular-nums}
    .gc-monto:hover{border-color:var(--accent);color:var(--accent)}
    .gc-monto.on{background:var(--accent);border-color:var(--accent);color:#fff}
    .gc-code{font-family:ui-monospace,'Cascadia Code',monospace;font-size:1.4rem;font-weight:800;letter-spacing:.08em;color:var(--accent);background:var(--surface);border:1px dashed var(--accent);border-radius:var(--radius);padding:10px 14px;text-align:center}
    .gc-estadobox{margin-top:16px}
    .gc-saldo{font-size:2rem;font-weight:800;color:var(--accent);line-height:1;font-variant-numeric:tabular-nums}
    .gc-chip{display:inline-block;font-size:.78rem;font-weight:700;padding:3px 10px;border-radius:999px;color:#fff}
    .gc-activa{background:#16a34a}
    .gc-agotada{background:#6b7280}
    .gc-anulada{background:#dc2626}
    .gc-usar{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}
  </style>`,
  files: (cfg) => ({
    'routes/giftcards.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
const MIN = ${MIN}; // Monto mínimo de una tarjeta
const MAX = ${MAX}; // Monto máximo de una tarjeta

// Genera un código único con formato GIFT-XXXXXX (sin caracteres ambiguos)
async function codigoUnico() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let intento = 0; intento < 20; intento++) {
    let s = '';
    for (let i = 0; i < 6; i++) s += alfabeto[Math.floor(Math.random() * alfabeto.length)];
    const code = 'GIFT-' + s;
    if (!(await db.find('giftcards', c => c.code === code)).length) return code;
  }
  return 'GIFT-' + Date.now().toString(36).toUpperCase().slice(-6);
}

// Estado derivado de la tarjeta
function estado(c) {
  if (c.void) return 'anulada';
  return c.balance > 0 ? 'activa' : 'agotada';
}

// Vista pública: sin datos del comprador, solo lo necesario para el portador del código
const publica = (c) => ({ code: c.code, to: c.to, amount: c.amount, balance: c.balance, message: c.message || '', status: estado(c) });

const validar = (data) => check(data, {
  from: (v) => str(v, 2, 80),
  to: (v) => str(v, 2, 80),
  toEmail: (v) => v === undefined || v === null || v === '' || /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v),
  amount: (v) => num(v, MIN, MAX),
  message: (v) => v === undefined || v === null || (typeof v === 'string' && v.length <= 200),
});

// POST /api/giftcards — emite una tarjeta y devuelve su código y saldo
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos (revisá el monto)', errors });
  const amount = Math.round(Number(req.body.amount));
  const code = await codigoUnico();
  const row = await db.insert('giftcards', {
    code,
    from: req.body.from.trim(),
    to: req.body.to.trim(),
    toEmail: (req.body.toEmail || '').toLowerCase().trim(),
    amount,
    balance: amount,
    message: (req.body.message || '').trim(),
    void: false,
  });
  res.status(201).json(publica(row));
});

// GET /api/giftcards/saldo/:code — consulta pública de saldo por código
router.get('/saldo/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const c = (await db.find('giftcards', x => x.code === code))[0];
  if (!c) return res.status(404).json({ error: 'No encontramos una tarjeta con ese código' });
  res.json(publica(c));
});

// POST /api/giftcards/canjear — descuenta un monto del saldo (el código es la credencial)
router.post('/canjear', async (req, res) => {
  const code = String(req.body && req.body.code || '').trim().toUpperCase();
  const monto = Math.round(Number(req.body && req.body.amount));
  if (!code) return res.status(422).json({ error: 'Falta el código de la tarjeta' });
  if (!num(monto, 1, MAX)) return res.status(422).json({ error: 'Monto a canjear inválido' });
  const c = (await db.find('giftcards', x => x.code === code))[0];
  if (!c) return res.status(404).json({ error: 'No encontramos una tarjeta con ese código' });
  if (c.void) return res.status(409).json({ error: 'La tarjeta está anulada' });
  if (monto > c.balance) return res.status(409).json({ error: 'El saldo disponible no alcanza para ese monto' });
  const row = await db.update('giftcards', c.id, { balance: c.balance - monto });
  res.json(publica(row));
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/giftcards — todas las tarjetas con su estado (solo admin; filtro ?status=)
router.get('/', requireAdmin, async (req, res) => {
  let rows = await db.all('giftcards');
  rows = rows.map(c => ({ ...c, status: estado(c) }));
  if (['activa', 'agotada', 'anulada'].includes(req.query.status)) rows = rows.filter(c => c.status === req.query.status);
  res.json(rows.reverse());
});

// PATCH /api/giftcards/:id — anula/reactiva una tarjeta (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  if (req.body.void === undefined) return res.status(422).json({ error: 'Nada para actualizar' });
  const row = await db.update('giftcards', req.params.id, { void: Boolean(req.body.void) });
  if (!row) return res.status(404).json({ error: 'Tarjeta inexistente' });
  res.json({ ...row, status: estado(row) });
});
` : `// La gestión de tarjetas (listar todas, anular) requiere el módulo de autenticación:
// activalo en el Builder para habilitar el panel de administración.
`}
module.exports = router;
`,
  }),
  clientJs: (cfg) => `/* Módulo tarjetas de regalo: emisión con código único, consulta de saldo por código y canje,
   con saldo animado (Anime.js + red de seguridad) y, con auth activo, panel de gestión solo-admin.
   En la vista previa del Builder simula la API. */
(function () {
  var form = document.getElementById('gc-form');
  var estadoBox = document.getElementById('gc-estado');
  if (!form && !estadoBox) return;
  var LABELS = { activa: 'Activa', agotada: 'Sin saldo', anulada: 'Anulada' };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };

  // Count-up del saldo con Anime.js (red de seguridad si la pestaña está oculta)
  function contarSaldo(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = App.money(hasta); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 700, ease: 'outCubic', onUpdate: function () { el.textContent = App.money(Math.round(st.v)); } });
    setTimeout(function () { el.textContent = App.money(hasta); }, 900);
  }

  // Selector de montos sugeridos + input libre
  var montos = document.getElementById('gc-montos');
  var inputMonto = form && form.querySelector('[name="amount"]');
  if (montos) montos.addEventListener('click', function (e) {
    var b = e.target.closest('.gc-monto');
    if (!b) return;
    montos.querySelectorAll('.gc-monto').forEach(function (x) { x.classList.toggle('on', x === b); });
    if (inputMonto) inputMonto.value = b.getAttribute('data-monto');
  });
  if (inputMonto) inputMonto.addEventListener('input', function () {
    if (montos) montos.querySelectorAll('.gc-monto').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-monto') === inputMonto.value); });
  });

  function mostrarNueva(r) {
    var box = document.getElementById('gc-nueva');
    var code = document.getElementById('gc-code-nuevo');
    var monto = document.getElementById('gc-monto-nuevo');
    if (code) code.textContent = r.code || '—';
    if (monto) monto.textContent = App.money(r.balance != null ? r.balance : r.amount);
    if (box) box.hidden = false;
    var buscar = document.getElementById('gc-buscar');
    if (buscar) buscar.value = r.code || '';
  }

  // Emisión de tarjeta
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = Object.fromEntries(new FormData(form));
    body.amount = Number(body.amount);
    if (window.__PREVIEW__) { mostrarNueva({ code: 'GIFT-DEMO01', amount: body.amount || 1000, balance: body.amount || 1000 }); form.reset(); return; }
    try {
      var r = await App.api('/api/giftcards', { method: 'POST', body: body });
      form.reset();
      mostrarNueva(r);
      App.toast('¡Tarjeta emitida!');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  // Consulta de saldo por código
  var buscarInput = document.getElementById('gc-buscar');
  var buscarBtn = document.getElementById('gc-buscar-btn');
  async function buscar() {
    var code = (buscarInput && buscarInput.value || '').trim().toUpperCase();
    if (!code) { App.toast('Ingresá el código de la tarjeta'); return; }
    if (window.__PREVIEW__) { pintarEstado({ code: code, to: 'Alguien especial', amount: 5000, balance: 3500, message: '¡Feliz cumple!', status: 'activa' }); return; }
    try { pintarEstado(await App.api('/api/giftcards/saldo/' + encodeURIComponent(code))); }
    catch (err) { if (err.message !== 'preview' && estadoBox) estadoBox.innerHTML = '<p class="muted" style="margin:12px 0 0">' + App.esc(err.message) + '</p>'; }
  }
  if (buscarBtn) buscarBtn.addEventListener('click', buscar);
  if (buscarInput) buscarInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });

  function pintarEstado(r) {
    if (!estadoBox) return;
    var puedeUsar = r.status === 'activa';
    estadoBox.innerHTML =
      '<div class="gc-estadobox">' +
      '<p style="margin:0 0 4px"><span class="muted">Para</span> <strong>' + App.esc(r.to) + '</strong> ' +
      '<span class="gc-chip gc-' + r.status + '">' + (LABELS[r.status] || r.status) + '</span></p>' +
      (r.message ? '<p class="muted" style="margin:0 0 8px;font-style:italic">“' + App.esc(r.message) + '”</p>' : '') +
      '<div class="gc-saldo" id="gc-saldo">' + App.money(0) + '</div>' +
      '<p class="muted" style="margin:2px 0 0;font-size:.82rem">Saldo disponible' + (r.amount ? ' · emitida por ' + App.money(r.amount) : '') + '</p>' +
      (puedeUsar ? '<div class="gc-usar"><div style="flex:1;min-width:120px"><label style="margin:0 0 4px">Usar saldo</label>' +
        '<input id="gc-usar-monto" type="number" min="1" max="' + r.balance + '" step="100" placeholder="Monto a canjear"></div>' +
        '<button class="btn" type="button" id="gc-usar-btn" style="width:auto">Canjear</button></div>' : '') +
      '</div>';
    contarSaldo(document.getElementById('gc-saldo'), r.balance || 0);
    var usarBtn = document.getElementById('gc-usar-btn');
    if (usarBtn) usarBtn.addEventListener('click', async function () {
      var mEl = document.getElementById('gc-usar-monto');
      var monto = Math.round(Number(mEl && mEl.value));
      if (!(monto > 0)) { App.toast('Ingresá un monto a canjear'); return; }
      if (window.__PREVIEW__) { pintarEstado({ code: r.code, to: r.to, amount: r.amount, balance: Math.max(0, (r.balance || 0) - monto), message: r.message, status: (r.balance - monto > 0) ? 'activa' : 'agotada' }); App.toast('Vista previa: se canjearía el saldo'); return; }
      try {
        var upd = await App.api('/api/giftcards/canjear', { method: 'POST', body: { code: r.code, amount: monto } });
        pintarEstado(upd);
        App.toast('Canje realizado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });
  }
${cfg.moduleIds.includes('auth') ? `
  // Panel de gestión (solo admin): tabla con saldos y anulación
  var adminBox = document.getElementById('gc-admin');
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var filasAdmin = [];
  if (adminBox && ((me && me.role === 'admin') || window.__PREVIEW__)) { adminBox.hidden = false; cargarAdmin(); }

  async function cargarAdmin() {
    var cont = document.getElementById('gc-admin-tabla');
    if (!cont) return;
    if (window.__PREVIEW__) {
      filasAdmin = [
        { id: '1', code: 'GIFT-ABC123', from: 'Ana', to: 'Bruno', toEmail: 'bruno@mail.com', amount: 5000, balance: 3500, status: 'activa', void: false, createdAt: new Date().toISOString() },
        { id: '2', code: 'GIFT-XYZ789', from: 'Caro', to: 'Delia', toEmail: '', amount: 1000, balance: 0, status: 'agotada', void: false, createdAt: new Date().toISOString() },
      ];
    } else {
      try { filasAdmin = await App.api('/api/giftcards'); }
      catch (err) { if (err.message !== 'preview') cont.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; return; }
    }
    cont.innerHTML = App.table(filasAdmin, [
      { label: 'Código', render: function (r) { return '<strong style="font-family:ui-monospace,monospace">' + App.esc(r.code) + '</strong>'; } },
      { label: 'De → Para', render: function (r) { return App.esc(r.from) + ' → ' + App.esc(r.to) + (r.toEmail ? '<br><span class="muted" style="font-size:.8rem">' + App.esc(r.toEmail) + '</span>' : ''); } },
      { label: 'Emitida', render: function (r) { return App.money(r.amount); } },
      { label: 'Saldo', render: function (r) { return '<strong>' + App.money(r.balance) + '</strong>'; } },
      { label: 'Estado', render: function (r) { return '<span class="gc-chip gc-' + r.status + '">' + (LABELS[r.status] || r.status) + '</span>'; } },
      { label: '', render: function (r) { return '<button class="btn ghost" type="button" data-gc-void="' + r.id + '">' + (r.void ? 'Reactivar' : 'Anular') + '</button>'; } },
    ]);
    cont.querySelectorAll('[data-gc-void]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.getAttribute('data-gc-void');
        var f = filasAdmin.filter(function (x) { return x.id === id; })[0];
        if (!f) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (f.void ? 'reactivaría' : 'anularía') + ' la tarjeta'); return; }
        try {
          var upd = await App.api('/api/giftcards/' + id, { method: 'PATCH', body: { void: !f.void } });
          f.void = upd.void; f.status = upd.status;
          cargarAdmin();
          App.toast(upd.void ? 'Tarjeta anulada' : 'Tarjeta reactivada');
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }

  var csvBtn = document.getElementById('gc-csv');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    var ET = { createdAt: 'Emitida', code: 'Código', from: 'De', to: 'Para', toEmail: 'Email destino', amount: 'Monto', balance: 'Saldo', status: 'Estado' };
    var claves = ['createdAt', 'code', 'from', 'to', 'toEmail', 'amount', 'balance', 'status'];
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [claves.map(function (k) { return celda(ET[k] || k); }).join(';')];
    filasAdmin.forEach(function (r) { lineas.push(claves.map(function (k) {
      if (k === 'status') return celda(LABELS[r[k]] || r[k]);
      if (k === 'createdAt') return celda(r[k] ? new Date(r[k]).toLocaleDateString('es-AR') : '');
      return celda(r[k]);
    }).join(';')); });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tarjetas-regalo-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Tarjetas de regalo**: los clientes emiten gift cards en \`/tarjetas-regalo.html\` (código único \`GIFT-XXXXXX\`, monto entre ${MIN} y ${MAX}, editables en \`routes/giftcards.js\`). El saldo se consulta y se canjea con el código —que funciona como credencial— y todo se guarda en la colección \`giftcards\`. ${cfg.moduleIds.includes('auth') ? 'Los administradores ven todas las tarjetas, sus saldos, anulan tarjetas y exportan el CSV desde la misma página.' : 'Para gestionar las tarjetas (listar y anular) activá el módulo **Autenticación** en el Builder; sin él, se emiten y consultan pero no hay panel.'} El canje es público (el código es la credencial); si necesitás integrarlo al checkout, llamá a \`POST /api/giftcards/canjear\` desde tu flujo de pago.`,
  ],
};
