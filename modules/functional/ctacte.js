// Cuenta corriente de clientes con backend real: el "fiado" de toda la vida, que en el catálogo no
// existía — había cómo cobrar (POS, carrito, caja) pero no cómo llevar lo que QUEDÓ DEBIENDO. Acá
// cada persona tiene una cuenta con dos tipos de movimiento: CARGO (le vendí y no me pagó) y PAGO
// (me trajo plata). El saldo NUNCA se guarda: lo calcula el servidor sumando los movimientos, así
// que no puede desincronizarse ni editarse por afuera — el mismo criterio que usa Inventario con el
// stock. Los movimientos no se editan: para corregir uno se hace el contrario, que es como se lleva
// una cuenta de verdad y deja el historial completo. Dos integraciones reales: con "clientes" (CRM)
// la cuenta se abre eligiendo una ficha existente en vez de tipear el nombre otra vez, y con "caja"
// cada PAGO registrado entra automáticamente como ingreso del día en la caja diaria (respetando el
// cierre: si el día ya está cerrado, el pago se registra igual en la cuenta y avisa que no tocó la
// caja). Panel solo-admin /ctacte-admin.html con KPIs animados (Anime.js + red de seguridad), lista
// de cuentas ordenadas por saldo, resumen por cliente, buscador y CSV. Requiere Autenticación.
// Distinto de "invoices" (comprobantes) y "pagoinformado" (el cliente avisa que transfirió): acá se
// lleva el SALDO en el tiempo.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'ctacte', type: 'functional', name: 'Cuenta corriente de clientes',
  description: 'La cuenta corriente ("fiado") con backend real: cargos y pagos por cliente, con el saldo calculado siempre en el servidor a partir de los movimientos (nunca guardado, nunca desincronizado). Los movimientos no se editan: se corrigen con el contrario. Con el CRM de clientes activo la cuenta se abre desde la ficha existente; con Caja diaria, cada pago entra como ingreso del día respetando el cierre. Panel solo-admin /ctacte-admin.html con KPIs animados (Anime.js), cuentas ordenadas por saldo, resumen por cliente, buscador y CSV. Requiere Autenticación.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/ctacte', file: 'routes/ctacte.js' }],
  collections: ['ctamoves'],
  nav: () => [{ label: 'Cuentas (admin)', href: '/ctacte-admin.html', id: 'nav-ctacte-admin' }],
  head: () => `  <style>
    .cc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .cc-kpis .card{text-align:center}
    .cc-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .cc-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .cc-debe{color:#c0392b;font-weight:700}
    .cc-favor{color:#1d6b3c;font-weight:700}
    .cc-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .cc-chip.cargo{background:#c0392b18;color:#c0392b}
    .cc-chip.pago{background:#2e9e5b20;color:#1d6b3c}
    .cc-resumen table{width:100%;font-size:.9rem}
    .cc-resumen td,.cc-resumen th{padding:6px 8px}
    .cc-saldo-final{text-align:right;font-size:1.15rem;font-weight:700;font-variant-numeric:tabular-nums;margin-top:12px}
  </style>`,
  pages: (cfg) => ({
    'ctacte-admin': {
      title: 'Cuenta corriente',
      html: `  <section>
    <div class="container">
      <h2>Cuenta corriente</h2>
      <p class="section-sub">Lo que cada cliente debe y lo que ya pagó. El saldo lo calcula el servidor desde los movimientos: no se puede tocar a mano.</p>
      <div id="cc-kpis" class="cc-kpis"></div>

      <div class="card" style="margin-bottom:26px">
        <h3>Registrar movimiento</h3>
        <form id="cc-form">${cfg.moduleIds.includes('clientes') ? `
          <label>Cliente de la libreta</label>
          <select id="cc-cliente-sel"><option value="">Escribir a mano…</option></select>` : ''}
          <div class="grid cols-2">
            <div><label>Nombre del cliente</label><input name="clientName" id="cc-nombre" required maxlength="80"></div>
            <div><label>Email (opcional, identifica la cuenta)</label><input name="clientEmail" id="cc-email" type="email"></div>
          </div>
          <div class="grid cols-2">
            <div>
              <label>Tipo</label>
              <select name="kind">
                <option value="cargo">Cargo — se lleva algo y queda debiendo</option>
                <option value="pago">Pago — trae plata a cuenta</option>
              </select>
            </div>
            <div><label>Importe</label><input name="amount" type="number" min="0.01" step="any" required></div>
          </div>
          <label>Detalle</label><input name="detail" required maxlength="120" placeholder="Qué se llevó o cómo pagó">
          <label>Fecha</label><input name="date" type="date" id="cc-fecha">
          <div style="margin-top:16px"><button class="btn" type="submit">Registrar</button></div>
        </form>
      </div>

      <h3>${phIcon('handshake', { size: 18, style: 'vertical-align:-4px;margin-right:8px' })}Cuentas</h3>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
        <input id="cc-buscar" placeholder="Buscar cliente" style="width:auto;min-width:180px;margin:0">
        <label style="display:flex;align-items:center;gap:6px;font-weight:400;margin:0">
          <input type="checkbox" id="cc-solo-deuda" style="width:auto;margin:0"> Sólo con deuda
        </label>
        <button class="btn ghost" type="button" id="cc-csv">Descargar CSV</button>
      </div>
      <div id="cc-cuentas"><p class="muted">Cargando…</p></div>
      <div id="cc-resumen"></div>
    </div>
  </section>`,
    },
  }),
  files: (cfg) => {
    const conCaja = cfg.moduleIds.includes('caja');
    const conClientes = cfg.moduleIds.includes('clientes');
    return {
      'routes/ctacte.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num, oneOf } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

const TIPOS = ['cargo', 'pago'];
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;
const hoy = () => new Date().toISOString().slice(0, 10);

// La CLAVE de la cuenta: el email si lo hay (dos "Juan Pérez" distintos no se mezclan),
// y si no, el nombre normalizado sin acentos ni mayúsculas.
function claveDe(name, email) {
  const mail = String(email || '').toLowerCase().trim();
  if (mail) return 'm:' + mail;
  return 'n:' + String(name || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/\\s+/g, ' ').trim();
}

// Agrupa los movimientos en cuentas con el saldo calculado (cargos - pagos)
function cuentas(rows) {
  const map = new Map();
  for (const m of rows) {
    const c = map.get(m.clientKey) || { key: m.clientKey, clientName: m.clientName, clientEmail: m.clientEmail || '', charges: 0, payments: 0, moves: 0, lastAt: '' };
    if (m.kind === 'cargo') c.charges += m.amount; else c.payments += m.amount;
    c.moves++;
    // El nombre y el email más recientes ganan: la gente cambia de teléfono y de apellido
    if (!c.lastAt || m.date > c.lastAt) { c.lastAt = m.date; c.clientName = m.clientName; if (m.clientEmail) c.clientEmail = m.clientEmail; }
    map.set(m.clientKey, c);
  }
  return [...map.values()].map(c => ({ ...c, balance: Math.round((c.charges - c.payments) * 100) / 100 }));
}

// GET /api/ctacte — todas las cuentas con su saldo (filtros ?q= y ?deuda=1)
router.get('/', requireAdmin, async (req, res) => {
  let rows = cuentas(await db.all('ctamoves'));
  const q = String(req.query.q || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim();
  if (q) rows = rows.filter(c => (c.clientName + ' ' + c.clientEmail).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').includes(q));
  if (req.query.deuda === '1') rows = rows.filter(c => c.balance > 0);
  rows.sort((a, b) => b.balance - a.balance);
  res.json(rows);
});

// GET /api/ctacte/resumen — KPIs del servidor (a cobrar, a favor, cuentas con deuda, del mes)
router.get('/resumen', requireAdmin, async (req, res) => {
  const rows = await db.all('ctamoves');
  const lista = cuentas(rows);
  const mes = hoy().slice(0, 7);
  const delMes = rows.filter(m => String(m.date).slice(0, 7) === mes);
  res.json({
    aCobrar: Math.round(lista.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0) * 100) / 100,
    aFavor: Math.round(Math.abs(lista.filter(c => c.balance < 0).reduce((s, c) => s + c.balance, 0)) * 100) / 100,
    conDeuda: lista.filter(c => c.balance > 0).length,
    cobradoMes: Math.round(delMes.filter(m => m.kind === 'pago').reduce((s, m) => s + m.amount, 0) * 100) / 100,
  });
});

// GET /api/ctacte/cuenta/:key — resumen de una cuenta con su historial y saldo corrido
router.get('/cuenta/:key', requireAdmin, async (req, res) => {
  const rows = (await db.find('ctamoves', m => m.clientKey === req.params.key))
    .sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
  if (!rows.length) return res.status(404).json({ error: 'Esa cuenta no tiene movimientos' });
  let saldo = 0;
  const moves = rows.map(m => {
    saldo += m.kind === 'cargo' ? m.amount : -m.amount;
    return { ...m, running: Math.round(saldo * 100) / 100 };
  });
  const ultimo = rows[rows.length - 1];
  res.json({
    key: req.params.key,
    clientName: ultimo.clientName,
    clientEmail: ultimo.clientEmail || '',
    balance: Math.round(saldo * 100) / 100,
    moves: moves.reverse(),
  });
});

// POST /api/ctacte — registra un cargo o un pago${conCaja ? `
// Si es un PAGO y la caja del día no está cerrada, entra además como ingreso de la caja diaria.` : ''}
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, {
    clientName: (v) => str(v, 2, 80),
    kind: (v) => oneOf(v, TIPOS),
    amount: (v) => num(Number(v), 0.01, 1000000000),
    detail: (v) => str(v, 2, 120),
  });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const date = FECHA.test(String(req.body.date || '')) ? req.body.date : hoy();
  if (date > hoy()) return res.status(422).json({ error: 'No se pueden cargar movimientos a futuro' });
  const email = String(req.body.clientEmail || '').toLowerCase().trim();
  const amount = Math.round(Number(req.body.amount) * 100) / 100;
  const row = await db.insert('ctamoves', {
    clientKey: claveDe(req.body.clientName, email),
    clientName: req.body.clientName.trim(),
    clientEmail: email,
    kind: req.body.kind,
    amount,
    detail: req.body.detail.trim(),
    date,
    author: req.user.name,
  });
${conCaja ? `  // Espejo en la caja diaria: el pago que entra a la cuenta es plata que entró al negocio
  let enCaja = false;
  if (row.kind === 'pago') {
    const cerrada = (await db.find('cashclosures', c => c.date === date)).length > 0;
    if (!cerrada) {
      await db.insert('cashmoves', {
        date,
        kind: 'ingreso',
        concept: 'Cuenta corriente: ' + row.clientName,
        amount: row.amount,
        method: 'efectivo',
      });
      enCaja = true;
    }
  }
  res.status(201).json({ ...row, enCaja, cajaCerrada: row.kind === 'pago' && !enCaja });
});
` : `  res.status(201).json(row);
});
`}

// DELETE /api/ctacte/:id — borra un movimiento cargado por error (mismo día nomás).
// Para corregir algo viejo se registra el movimiento contrario: el historial no se reescribe.
router.delete('/:id', requireAdmin, async (req, res) => {
  const m = await db.get('ctamoves', req.params.id);
  if (!m) return res.status(404).json({ error: 'Movimiento inexistente' });
  if (String(m.createdAt).slice(0, 10) !== hoy()) {
    return res.status(409).json({ error: 'Sólo se borra lo cargado hoy: para corregir un movimiento viejo registrá el contrario' });
  }
  await db.remove('ctamoves', m.id);
  res.json({ ok: true });
});
${conClientes ? `
// GET /api/ctacte/clientes — fichas del CRM para abrir la cuenta sin volver a tipear los datos
router.get('/clientes', requireAdmin, async (req, res) => {
  const rows = await db.all('customers');
  res.json(rows.map(c => ({ id: c.id, name: c.name, email: c.email || '' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es')));
});
` : ''}
module.exports = router;
`,
    };
  },
  clientJs: (cfg) => `/* Módulo cuenta corriente: alta de cargos y pagos, listado de cuentas por saldo, resumen por
   cliente con saldo corrido y CSV. KPIs con count-up (Anime.js + red de seguridad). Sólo admin.
   En la vista previa del Builder simula la API. */
(function () {
  var box = document.getElementById('cc-cuentas');
  if (!box) return;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
    box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
    return;
  }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };
  var fecha = function (d) { try { return new Date(d + 'T12:00:00').toLocaleDateString('es-AR'); } catch (e) { return d; } };
  var lista = [], abierta = null;

  function contar(el, valor, money) {
    var pintar = function (v) { el.textContent = money ? App.money(Math.round(v)) : Math.round(v); };
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { pintar(valor); return; }
    var obj = { v: 0 };
    anime.animate(obj, { v: valor, duration: 700, ease: 'outCubic', onUpdate: function () { pintar(obj.v); } });
    setTimeout(function () { pintar(valor); }, 900);
  }

  function pintarKpis(r) {
    var cont = document.getElementById('cc-kpis');
    if (!cont) return;
    var datos = [['A cobrar', r.aCobrar, true], ['Cuentas con deuda', r.conDeuda, false], ['Cobrado este mes', r.cobradoMes, true], ['Saldo a favor de clientes', r.aFavor, true]];
    cont.innerHTML = datos.map(function (d) {
      return '<div class="card"><strong data-cc-kpi="' + d[1] + '" data-cc-money="' + (d[2] ? '1' : '') + '">0</strong><span class="muted">' + d[0] + '</span></div>';
    }).join('');
    cont.querySelectorAll('[data-cc-kpi]').forEach(function (el) {
      contar(el, Number(el.getAttribute('data-cc-kpi')), el.getAttribute('data-cc-money') === '1');
    });
  }

  function saldoHtml(v) {
    if (v > 0) return '<span class="cc-debe">' + App.money(v) + '</span>';
    if (v < 0) return '<span class="cc-favor">' + App.money(Math.abs(v)) + ' a favor</span>';
    return '<span class="muted">Sin saldo</span>';
  }

  function pintarCuentas() {
    box.innerHTML = App.table(lista, [
      { label: 'Cliente', render: function (c) { return '<strong>' + App.esc(c.clientName) + '</strong>' + (c.clientEmail ? '<br><span class="muted" style="font-size:.8rem">' + App.esc(c.clientEmail) + '</span>' : ''); } },
      { label: 'Movimientos', render: function (c) { return '<span class="cc-num">' + c.moves + '</span>'; } },
      { label: 'Último', render: function (c) { return fecha(c.lastAt); } },
      { label: 'Saldo', render: function (c) { return '<span class="cc-num">' + saldoHtml(c.balance) + '</span>'; } },
      { label: '', render: function (c) { return '<button class="btn ghost" type="button" data-cc-ver="' + attr(c.key) + '">Ver cuenta</button>'; } },
    ]);
    box.querySelectorAll('[data-cc-ver]').forEach(function (b) {
      b.addEventListener('click', function () { verCuenta(b.getAttribute('data-cc-ver')); });
    });
  }

  async function verCuenta(key) {
    var cont = document.getElementById('cc-resumen');
    if (!cont) return;
    var data;
    if (window.__PREVIEW__) {
      data = { key: key, clientName: 'Cliente de ejemplo', clientEmail: '', balance: 18000,
        moves: [{ id: '2', date: new Date().toISOString().slice(0, 10), kind: 'pago', amount: 7000, detail: 'Pago parcial', running: 18000 },
                { id: '1', date: new Date().toISOString().slice(0, 10), kind: 'cargo', amount: 25000, detail: 'Mercadería', running: 25000 }] };
    } else {
      try { data = await App.api('/api/ctacte/cuenta/' + encodeURIComponent(key)); }
      catch (err) { if (err.message !== 'preview') App.toast(err.message); return; }
    }
    abierta = key;
    var filas = data.moves.map(function (m) {
      return '<tr><td>' + fecha(m.date) + '</td>' +
        '<td><span class="cc-chip ' + m.kind + '">' + (m.kind === 'cargo' ? 'Cargo' : 'Pago') + '</span></td>' +
        '<td>' + App.esc(m.detail) + '</td>' +
        '<td class="cc-num">' + App.money(m.amount) + '</td>' +
        '<td class="cc-num">' + App.money(m.running) + '</td>' +
        '<td><button class="btn ghost" type="button" data-cc-borrar="' + m.id + '">Borrar</button></td></tr>';
    }).join('');
    cont.innerHTML = '<div class="card cc-resumen" style="margin-top:24px">' +
      '<h3>' + App.esc(data.clientName) + '</h3>' +
      (data.clientEmail ? '<p class="muted" style="margin:0 0 12px;font-size:.85rem">' + App.esc(data.clientEmail) + '</p>' : '') +
      '<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th class="cc-num">Importe</th><th class="cc-num">Saldo</th><th></th></tr></thead><tbody>' + filas + '</tbody></table>' +
      '<p class="cc-saldo-final">Saldo: ' + saldoHtml(data.balance) + '</p>' +
      '<p class="muted" style="margin:0;font-size:.82rem">Los movimientos de días anteriores no se borran: para corregir uno, registrá el movimiento contrario.</p>' +
      '</div>';
    cont.querySelectorAll('[data-cc-borrar]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('¿Borrar el movimiento?')) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
        try { await App.api('/api/ctacte/' + b.getAttribute('data-cc-borrar'), { method: 'DELETE' }); App.toast('Movimiento borrado'); await cargar(); verCuenta(key); }
        catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
    cont.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  async function cargar() {
    var q = (document.getElementById('cc-buscar') || {}).value || '';
    var soloDeuda = (document.getElementById('cc-solo-deuda') || {}).checked;
    if (window.__PREVIEW__) {
      lista = [{ key: 'n:cliente', clientName: 'Cliente de ejemplo', clientEmail: '', moves: 2, lastAt: new Date().toISOString().slice(0, 10), balance: 18000 }];
      pintarKpis({ aCobrar: 18000, conDeuda: 1, cobradoMes: 7000, aFavor: 0 });
    } else {
      try {
        var qs = [];
        if (q) qs.push('q=' + encodeURIComponent(q));
        if (soloDeuda) qs.push('deuda=1');
        lista = await App.api('/api/ctacte' + (qs.length ? '?' + qs.join('&') : ''));
        pintarKpis(await App.api('/api/ctacte/resumen'));
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
        return;
      }
    }
    pintarCuentas();
  }

  var form = document.getElementById('cc-form');
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: se registraría el movimiento'); return; }
    try {
      var r = await App.api('/api/ctacte', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      var nombre = form.querySelector('[name="clientName"]').value;
      var mail = form.querySelector('[name="clientEmail"]').value;
      form.reset();
      ponerHoy();
      App.toast(r.cajaCerrada ? 'Movimiento registrado (la caja del día ya estaba cerrada: no se tocó)' : (r.enCaja ? 'Pago registrado y cargado a la caja del día' : 'Movimiento registrado'));
      await cargar();
      // Deja abierto el resumen de la cuenta recién tocada: es lo que uno quiere ver después
      if (r.clientKey) verCuenta(r.clientKey);
      else if (nombre || mail) verCuenta(abierta || '');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  function ponerHoy() {
    var f = document.getElementById('cc-fecha');
    if (f && !f.value) f.value = new Date().toISOString().slice(0, 10);
  }
  ponerHoy();
${cfg.moduleIds.includes('clientes') ? `
  // Con el CRM activo, elegir una ficha completa nombre y email de una
  (async function () {
    var sel = document.getElementById('cc-cliente-sel');
    if (!sel) return;
    var fichas = [];
    if (window.__PREVIEW__) fichas = [{ id: '1', name: 'Cliente de ejemplo', email: 'cliente@mail.com' }];
    else { try { fichas = await App.api('/api/ctacte/clientes'); } catch (err) { return; } }
    sel.innerHTML = '<option value="">Escribir a mano…</option>' + fichas.map(function (c) {
      return '<option value="' + attr(c.id) + '">' + App.esc(c.name) + (c.email ? ' — ' + App.esc(c.email) : '') + '</option>';
    }).join('');
    sel.addEventListener('change', function () {
      var c = fichas.filter(function (x) { return x.id === sel.value; })[0];
      if (!c) return;
      document.getElementById('cc-nombre').value = c.name;
      document.getElementById('cc-email').value = c.email || '';
    });
  })();
` : ''}
  var buscar = document.getElementById('cc-buscar');
  if (buscar) buscar.addEventListener('input', function () { clearTimeout(buscar._t); buscar._t = setTimeout(cargar, 250); });
  var soloDeuda = document.getElementById('cc-solo-deuda');
  if (soloDeuda) soloDeuda.addEventListener('change', cargar);

  var csv = document.getElementById('cc-csv');
  if (csv) csv.addEventListener('click', function () {
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [['Cliente', 'Email', 'Movimientos', 'Último movimiento', 'Cargos', 'Pagos', 'Saldo'].map(celda).join(';')];
    lista.forEach(function (c) {
      lineas.push([c.clientName, c.clientEmail, c.moves, c.lastAt, c.charges, c.payments, c.balance].map(celda).join(';'));
    });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cuentas-corrientes-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  cargar();
})();`,
  readmeNotes: (cfg) => [
    `**Cuenta corriente**: panel solo-admin en \`/ctacte-admin.html\`. El saldo de cada cuenta **no se guarda**: lo calcula el servidor sumando los cargos y restando los pagos, así que no puede quedar desincronizado. Un movimiento sólo se borra el mismo día que se cargó; para corregir algo más viejo se registra el movimiento contrario y el historial queda completo. La cuenta se identifica por el email si lo cargás (y por el nombre normalizado si no), así que **conviene usar siempre el email** para que dos clientes con el mismo nombre no se mezclen.${cfg.moduleIds.includes('caja') ? ' Como el módulo **Caja diaria** está activo, cada pago se registra además como ingreso en efectivo de la caja del día; si esa caja ya está cerrada, el pago se guarda igual en la cuenta y el panel avisa que no tocó la caja.' : ''}${cfg.moduleIds.includes('clientes') ? ' Con el CRM de **clientes** activo, podés abrir la cuenta eligiendo una ficha existente en vez de tipear los datos.' : ''}`,
  ],
};
