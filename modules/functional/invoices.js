// Comprobantes y recibos con backend real: el negocio emite comprobantes desde un ABM solo-admin
// (cliente, items con cantidad y precio, total calculado SIEMPRE en el servidor) y cada uno recibe
// un código RC-XXXXXX. El cliente entra a la página pública /comprobante.html, pone su código (o
// llega con ?code= en la URL) y ve el comprobante completo listo para imprimir (hoja limpia vía
// @media print, sin navbar ni footer). La vista pública nunca expone el email ni la nota interna.
// Con auth activo, /comprobantes-admin.html permite emitir (filas de items dinámicas), marcar
// pagado/pendiente/anulado, dejar nota interna, filtrar por estado y exportar CSV, con KPI de total
// cobrado animado. Sin auth, la parte pública funciona igual con un comprobante de ejemplo sembrado
// (editable a mano en data/invoices.json). Distinto de "ordertrack" (estado logístico de un pedido)
// y de "quote"/"quotesadmin" (presupuestos que pide el visitante): acá el negocio emite el
// comprobante de una venta ya hecha y el cliente lo consulta e imprime. Animado con Anime.js
// (aparición del comprobante, filas con stagger y total con count-up) + red de seguridad.

// Estados posibles de un comprobante y sus etiquetas visibles
const ESTADOS = [
  { id: 'pendiente', label: 'Pendiente de pago' },
  { id: 'pagado', label: 'Pagado' },
  { id: 'anulado', label: 'Anulado' },
];

module.exports = {
  id: 'invoices', type: 'functional', name: 'Comprobantes y recibos',
  description: 'Emisión de comprobantes/recibos con backend: el negocio los emite desde un ABM solo-admin (items con cantidad y precio, total calculado en el servidor, estados pendiente/pagado/anulado) y el cliente los consulta e imprime en /comprobante.html con su código RC-XXXXXX (hoja de impresión limpia). Con auth activo, panel /comprobantes-admin.html con filtro, nota interna, CSV y total cobrado animado (Anime.js).',
  usesAnime: true,
  mounts: [{ route: '/api/invoices', file: 'routes/invoices.js' }],
  collections: ['invoices'],
  nav: (cfg) => {
    const links = [{ label: 'Comprobante', href: '/comprobante.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Comprobantes (admin)', href: '/comprobantes-admin.html', id: 'nav-invoices-admin' });
    return links;
  },
  head: () => `  <style>
    .inv-doc{max-width:640px;margin:0 auto}
    .inv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;border-bottom:2px solid var(--accent);padding-bottom:14px;margin-bottom:14px}
    .inv-code{font-size:.85rem;color:var(--muted)}
    .inv-chip{display:inline-block;font-size:.75rem;font-weight:700;padding:2px 10px;border-radius:999px;background:var(--surface);border:1px solid var(--line)}
    .inv-chip.pagado{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
    .inv-chip.pendiente{background:var(--surface);border:1px solid var(--line)}
    .inv-chip.anulado{background:color-mix(in srgb,#c0392b 14%,var(--surface));color:#c0392b;border-color:transparent;text-decoration:line-through}
    .inv-total{display:flex;justify-content:flex-end;gap:18px;align-items:baseline;margin-top:14px;border-top:1px solid var(--line);padding-top:12px}
    .inv-total strong{font-size:1.6rem}
    .inv-item-row{display:grid;grid-template-columns:1fr 84px 130px 34px;gap:8px;align-items:end;margin-bottom:8px}
    .inv-err{color:#c0392b;font-weight:600}
    /* Hoja de impresión limpia: solo el comprobante, sin navegación ni botones */
    @media print {
      .navbar, footer, .no-print, .toast { display: none !important; }
      section { padding: 0; }
      .card { border: none; box-shadow: none; }
    }
  </style>`,
  files: (cfg) => ({
    'routes/invoices.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { check, str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Estados válidos de un comprobante
const ESTADOS = ${JSON.stringify(ESTADOS.map(e => e.id))};

// Comprobante de ejemplo: la página pública se puede probar desde el arranque con RC-DEMO01
db.seedIfEmpty('invoices', [{
  code: 'RC-DEMO01',
  customer: 'Cliente de ejemplo',
  email: '',
  items: [{ desc: 'Servicio profesional', qty: 1, price: 15000 }, { desc: 'Materiales', qty: 2, price: 3500 }],
  total: 22000,
  status: 'pagado',
  note: '',
}]);

// Normaliza y valida los items recibidos; el total lo calcula SIEMPRE el servidor
function limpiarItems(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 20) return null;
  const items = [];
  for (const it of raw) {
    const desc = typeof (it && it.desc) === 'string' ? it.desc.trim().slice(0, 120) : '';
    const qty = Math.round(Number(it && it.qty));
    const price = Number(it && it.price);
    if (!desc || !isFinite(qty) || qty < 1 || qty > 999) return null;
    if (!isFinite(price) || price < 0 || price > 99999999) return null;
    items.push({ desc, qty, price: Math.round(price * 100) / 100 });
  }
  return items;
}
const totalDe = (items) => Math.round(items.reduce((a, it) => a + it.qty * it.price, 0) * 100) / 100;

// Vista pública: nunca expone el email del cliente ni la nota interna
const publico = (r) => ({ code: r.code, customer: r.customer, items: r.items, total: r.total, status: r.status, createdAt: r.createdAt });

// GET /api/invoices/code/:code — consulta pública de un comprobante por su código
router.get('/code/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  if (!/^RC-[A-Z0-9]{4,8}$/.test(code)) return res.status(422).json({ error: 'El código tiene el formato RC-XXXXXX' });
  const row = (await db.find('invoices', r => r.code === code))[0];
  if (!row) return res.status(404).json({ error: 'No encontramos un comprobante con ese código' });
  res.json(publico(row));
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/invoices/admin/list — todos los comprobantes, más recientes primero (solo admin); ?status= filtra
router.get('/admin/list', requireAdmin, async (req, res) => {
  let rows = (await db.all('invoices')).reverse();
  const status = String(req.query.status || '').trim();
  if (status) rows = rows.filter(r => r.status === status);
  res.json(rows);
});

// POST /api/invoices/admin — emite un comprobante nuevo (solo admin)
router.post('/admin', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, { customer: (v) => str(v, 2, 80) });
  const items = limpiarItems(req.body.items);
  if (!ok || !items) return res.status(422).json({ error: 'Completá el cliente y al menos un item válido (cantidad 1-999, precio no negativo)', errors });
  const row = await db.insert('invoices', {
    code: 'RC-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    customer: req.body.customer.trim(),
    email: typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 120) : '',
    items,
    total: totalDe(items),
    status: ESTADOS.includes(req.body.status) ? req.body.status : 'pendiente',
    note: '',
  });
  res.status(201).json(row);
});

// PATCH /api/invoices/admin/:id — cambia el estado o la nota interna (solo admin)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.status !== undefined) {
    if (!ESTADOS.includes(req.body.status)) return res.status(422).json({ error: 'Estado inválido' });
    patch.status = req.body.status;
  }
  if (req.body.note !== undefined) patch.note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 300) : '';
  if (!Object.keys(patch).length) return res.status(422).json({ error: 'Nada para actualizar' });
  const row = await db.update('invoices', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Comprobante inexistente' });
  res.json(row);
});

// DELETE /api/invoices/admin/:id — borra un comprobante (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const row = await db.get('invoices', req.params.id);
  if (!row) return res.status(404).json({ error: 'Comprobante inexistente' });
  await db.remove('invoices', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de comprobantes requiere el módulo de autenticación: activalo en el Builder para
// habilitar /comprobantes-admin.html. Sin él, editá data/invoices.json a mano (la consulta
// pública por código sigue funcionando igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      comprobante: {
        title: 'Consultar comprobante',
        html: `  <section>
    <div class="container inv-doc">
      <h2>Consultá tu comprobante</h2>
      <p class="section-sub">Ingresá el código que te dimos con tu compra (formato RC-XXXXXX) para ver e imprimir tu comprobante.</p>
      <form id="inv-form" class="card no-print" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:1;min-width:200px"><label>Código del comprobante</label><input name="code" required placeholder="RC-XXXXXX" maxlength="12" style="text-transform:uppercase"></div>
        <button class="btn" type="submit">Consultar</button>
      </form>
      <p id="inv-error" class="inv-err" hidden></p>
      <div id="inv-view" class="card" style="margin-top:22px" hidden></div>
      <div class="no-print" style="margin-top:14px;text-align:right">
        <button class="btn ghost" type="button" id="inv-print" hidden>Imprimir comprobante</button>
      </div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['comprobantes-admin'] = {
        title: 'Comprobantes emitidos',
        html: `  <section>
    <div class="container">
      <h2>Comprobantes y recibos</h2>
      <p class="section-sub">Emití comprobantes para tus clientes y llevá el control de cobros. Solo visible para administradores.</p>
      <div class="grid cols-3" style="margin-bottom:22px">
        <div class="card"><p class="muted" style="margin:0 0 4px">Emitidos</p><p class="price" id="inva-kpi-total" style="margin:0">0</p></div>
        <div class="card"><p class="muted" style="margin:0 0 4px">Cobrado (pagados)</p><p class="price" id="inva-kpi-cobrado" style="margin:0">$0</p></div>
        <div class="card"><p class="muted" style="margin:0 0 4px">Pendientes de pago</p><p class="price" id="inva-kpi-pend" style="margin:0">0</p></div>
      </div>
      <form id="inva-form" class="card" style="max-width:720px;margin-bottom:26px">
        <h3 style="margin:0 0 6px">Emitir comprobante</h3>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Cliente</label><input name="customer" required minlength="2" maxlength="80" placeholder="Nombre del cliente"></div>
          <div><label>Email del cliente (opcional)</label><input name="email" type="email" maxlength="120" placeholder="cliente@email.com"></div>
        </div>
        <label style="margin-top:14px">Items</label>
        <div id="inva-items"></div>
        <button class="btn ghost" type="button" id="inva-add" style="padding:6px 14px;font-size:.85rem">Agregar item</button>
        <div style="display:flex;gap:14px;align-items:center;margin-top:14px;flex-wrap:wrap">
          <div style="max-width:220px"><label style="margin-top:0">Estado inicial</label>
            <select name="status"><option value="pendiente">Pendiente de pago</option><option value="pagado">Pagado</option></select>
          </div>
          <p style="margin:0;font-weight:700">Total: <span id="inva-total">$0</span></p>
          <button class="btn" type="submit">Emitir comprobante</button>
        </div>
      </form>
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px">
        <div style="max-width:240px"><label>Filtrar por estado</label>
          <select id="inva-filtro"><option value="">Todos</option><option value="pendiente">Pendientes</option><option value="pagado">Pagados</option><option value="anulado">Anulados</option></select>
        </div>
        <button class="btn ghost" type="button" id="inva-csv" style="padding:8px 16px">Descargar CSV</button>
      </div>
      <div id="inva-list"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo comprobantes y recibos: consulta pública por código con hoja de impresión limpia y,
   con auth activo, el ABM de emisión en /comprobantes-admin.html. Animado con Anime.js
   (aparición del comprobante, filas con stagger, totales con count-up) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LABELS = { pendiente: 'Pendiente de pago', pagado: 'Pagado', anulado: 'Anulado' };

  // Count-up de un importe con Anime.js (con red de seguridad si la pestaña está oculta)
  function countMoney(el, hasta) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = App.money(hasta); return; }
    var obj = { v: 0 };
    anime.animate(obj, { v: hasta, duration: 700, ease: 'outCubic', onUpdate: function () { el.textContent = App.money(Math.round(obj.v)); } });
    setTimeout(function () { el.textContent = App.money(hasta); }, 850);
  }

  function chip(status) {
    return '<span class="inv-chip ' + App.esc(status) + '">' + App.esc(LABELS[status] || status) + '</span>';
  }

  // ---- Página pública /comprobante.html ----
  var form = document.getElementById('inv-form');
  if (form) {
    var view = document.getElementById('inv-view');
    var errBox = document.getElementById('inv-error');
    var printBtn = document.getElementById('inv-print');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

    function pintar(c) {
      var filas = c.items.map(function (it) {
        return '<tr><td>' + App.esc(it.desc) + '</td><td style="text-align:center">' + it.qty + '</td>' +
          '<td style="text-align:right">' + App.money(it.price) + '</td><td style="text-align:right">' + App.money(it.qty * it.price) + '</td></tr>';
      }).join('');
      view.innerHTML =
        '<div class="inv-head"><div><h3 style="margin:0">' + App.esc(document.querySelector('.brand').textContent) + '</h3>' +
        '<p class="inv-code" style="margin:4px 0 0">Comprobante ' + App.esc(c.code) + ' · ' + new Date(c.createdAt).toLocaleDateString('es-AR') + '</p></div>' +
        chip(c.status) + '</div>' +
        '<p style="margin:0 0 12px"><strong>Cliente:</strong> ' + App.esc(c.customer) + '</p>' +
        '<table><thead><tr><th>Detalle</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Subtotal</th></tr></thead>' +
        '<tbody>' + filas + '</tbody></table>' +
        '<div class="inv-total"><span class="muted">Total</span><strong id="inv-total-val">$0</strong></div>' +
        (c.status === 'anulado' ? '<p class="inv-err" style="margin:10px 0 0">Este comprobante fue anulado y no tiene validez.</p>' : '');
      view.hidden = false;
      printBtn.hidden = false;
      countMoney(document.getElementById('inv-total-val'), c.total);
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(view, { opacity: [0, 1], translateY: [16, 0], duration: 450, ease: 'outCubic' });
        var trs = [].slice.call(view.querySelectorAll('tbody tr'));
        if (trs.length) anime.animate(trs, { opacity: [0, 1], translateX: [-10, 0], duration: 350, delay: anime.stagger ? anime.stagger(70) : 0, ease: 'outCubic' });
        // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
        setTimeout(function () { view.style.opacity = 1; view.style.transform = 'none'; trs.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 900);
      }
    }

    function consultar(code) {
      errBox.hidden = true; view.hidden = true; printBtn.hidden = true;
      if (window.__PREVIEW__) {
        pintar({ code: 'RC-DEMO01', customer: 'Cliente de ejemplo', createdAt: new Date().toISOString(), status: 'pagado', total: 22000, items: [{ desc: 'Servicio profesional', qty: 1, price: 15000 }, { desc: 'Materiales', qty: 2, price: 3500 }] });
        return;
      }
      App.api('/api/invoices/code/' + encodeURIComponent(code)).then(pintar).catch(function (err) {
        if (err.message === 'preview') return;
        errBox.textContent = err.message; errBox.hidden = false;
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      consultar(form.querySelector('[name="code"]').value.trim().toUpperCase());
    });
    // Enlace directo compartible: /comprobante.html?code=RC-XXXXXX auto-consulta
    var qs = new URLSearchParams(location.search).get('code');
    if (qs) { form.querySelector('[name="code"]').value = qs.toUpperCase(); consultar(qs.toUpperCase()); }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM /comprobantes-admin.html ----
  var formA = document.getElementById('inva-form');
  if (formA) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var itemsBox = document.getElementById('inva-items');
    var listBox = document.getElementById('inva-list');
    var filtroSel = document.getElementById('inva-filtro');
    var totalLbl = document.getElementById('inva-total');

    // Filas dinámicas de items del formulario de emisión
    function filaItem() {
      var row = document.createElement('div');
      row.className = 'inv-item-row';
      row.innerHTML = '<div><label style="margin-top:0">Detalle</label><input data-f="desc" required maxlength="120" placeholder="Ej: Servicio de instalación"></div>' +
        '<div><label style="margin-top:0">Cant.</label><input data-f="qty" type="number" min="1" max="999" step="1" value="1" required></div>' +
        '<div><label style="margin-top:0">Precio</label><input data-f="price" type="number" min="0" step="0.01" value="0" required></div>' +
        '<button class="btn ghost" type="button" data-quitar style="padding:6px 10px" aria-label="Quitar item">&times;</button>';
      row.querySelector('[data-quitar]').addEventListener('click', function () {
        if (itemsBox.children.length > 1) { row.remove(); recalcular(); }
      });
      row.querySelectorAll('input').forEach(function (i) { i.addEventListener('input', recalcular); });
      itemsBox.appendChild(row);
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(row, { opacity: [0, 1], translateY: [8, 0], duration: 300, ease: 'outCubic' });
        setTimeout(function () { row.style.opacity = 1; row.style.transform = 'none'; }, 400);
      }
    }

    function leerItems() {
      return [].map.call(itemsBox.children, function (row) {
        return {
          desc: row.querySelector('[data-f="desc"]').value.trim(),
          qty: Number(row.querySelector('[data-f="qty"]').value),
          price: Number(row.querySelector('[data-f="price"]').value),
        };
      });
    }
    function recalcular() {
      var t = leerItems().reduce(function (a, it) { return a + (it.qty || 0) * (it.price || 0); }, 0);
      totalLbl.textContent = App.money(Math.round(t * 100) / 100);
    }
    document.getElementById('inva-add').addEventListener('click', function () { filaItem(); });
    filaItem();

    function kpis() {
      var pag = lista.filter(function (r) { return r.status === 'pagado'; });
      document.getElementById('inva-kpi-total').textContent = lista.length;
      document.getElementById('inva-kpi-pend').textContent = lista.filter(function (r) { return r.status === 'pendiente'; }).length;
      countMoney(document.getElementById('inva-kpi-cobrado'), pag.reduce(function (a, r) { return a + r.total; }, 0));
    }

    function pintarLista() {
      listBox.innerHTML = App.table(lista, [
        { key: 'code', label: 'Código' },
        { key: 'customer', label: 'Cliente' },
        { label: 'Total', render: function (r) { return App.money(r.total); } },
        { label: 'Estado', render: function (r) { return chip(r.status); } },
        { label: 'Fecha', render: function (r) { return new Date(r.createdAt).toLocaleDateString('es-AR'); } },
        { label: 'Acciones', render: function (r) {
          var b = '<a class="btn ghost" href="/comprobante.html?code=' + encodeURIComponent(r.code) + '" target="_blank" style="padding:3px 9px;font-size:.8rem;margin:2px">Ver</a>';
          if (r.status === 'pendiente') b += '<button class="btn ghost" type="button" data-pagar="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Marcar pagado</button>';
          if (r.status !== 'anulado') b += '<button class="btn ghost" type="button" data-anular="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Anular</button>';
          b += '<button class="btn ghost" type="button" data-nota="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Nota</button>';
          b += '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
          return b;
        } },
      ]);
      listBox.querySelectorAll('[data-pagar]').forEach(function (b) { b.addEventListener('click', function () { cambiar(b.getAttribute('data-pagar'), { status: 'pagado' }); }); });
      listBox.querySelectorAll('[data-anular]').forEach(function (b) { b.addEventListener('click', function () { if (confirm('¿Anular este comprobante?')) cambiar(b.getAttribute('data-anular'), { status: 'anulado' }); }); });
      listBox.querySelectorAll('[data-nota]').forEach(function (b) { b.addEventListener('click', function () {
        var r = lista.filter(function (x) { return x.id === b.getAttribute('data-nota'); })[0];
        var nota = prompt('Nota interna (no la ve el cliente):', (r && r.note) || '');
        if (nota !== null) cambiar(b.getAttribute('data-nota'), { note: nota });
      }); });
      listBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
      kpis();
    }

    async function cambiar(id, patch) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se actualizaría el comprobante'); return; }
      try {
        var row = await App.api('/api/invoices/admin/' + id, { method: 'PATCH', body: patch });
        lista = lista.map(function (r) { return r.id === id ? row : r; });
        pintarLista();
        App.toast('Comprobante actualizado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este comprobante? Esta acción no se puede deshacer.')) return;
      try {
        await App.api('/api/invoices/admin/' + id, { method: 'DELETE' });
        lista = lista.filter(function (r) { return r.id !== id; });
        pintarLista();
        App.toast('Comprobante borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    function cargar() {
      var status = filtroSel ? filtroSel.value : '';
      if (window.__PREVIEW__) {
        lista = [{ id: 'd1', code: 'RC-DEMO01', customer: 'Cliente de ejemplo', total: 22000, status: 'pagado', note: '', createdAt: new Date().toISOString() }];
        pintarLista();
        return;
      }
      App.api('/api/invoices/admin/list' + (status ? '?status=' + encodeURIComponent(status) : '')).then(function (rows) { lista = rows; pintarLista(); }).catch(function (err) { listBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
    if (filtroSel) filtroSel.addEventListener('change', cargar);

    document.getElementById('inva-csv').addEventListener('click', function () {
      var filas = [['codigo', 'cliente', 'email', 'total', 'estado', 'fecha', 'nota']].concat(lista.map(function (r) {
        return [r.code, r.customer, r.email || '', r.total, r.status, r.createdAt, r.note || ''];
      }));
      var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'comprobantes.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    formA.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        customer: formA.querySelector('[name="customer"]').value,
        email: formA.querySelector('[name="email"]').value,
        status: formA.querySelector('[name="status"]').value,
        items: leerItems(),
      };
      if (window.__PREVIEW__) { App.toast('Vista previa: se emitiría el comprobante'); return; }
      try {
        var nuevo = await App.api('/api/invoices/admin', { method: 'POST', body: datos });
        lista.unshift(nuevo);
        formA.querySelector('[name="customer"]').value = '';
        formA.querySelector('[name="email"]').value = '';
        itemsBox.innerHTML = ''; filaItem(); recalcular();
        pintarLista();
        App.toast('Comprobante ' + nuevo.code + ' emitido');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (window.__PREVIEW__) { cargar(); }
    else if (!me || me.role !== 'admin') { location.href = '/auth.html'; }
    else { cargar(); }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navI = document.getElementById('nav-invoices-admin');
    if (navI && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navI.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Comprobantes y recibos**: los comprobantes viven en la colección \`invoices\`; el total lo calcula siempre el servidor a partir de los items. El cliente consulta e imprime el suyo en \`/comprobante.html\` con el código \`RC-XXXXXX\` (o con el enlace directo \`/comprobante.html?code=…\`); la hoja de impresión sale limpia, sin navegación. Se siembra el comprobante de ejemplo \`RC-DEMO01\`. ${cfg.moduleIds.includes('auth') ? 'Los administradores emiten y gestionan (pagado/anulado, nota interna, CSV) en `/comprobantes-admin.html`.' : 'Para emitir y gestionar desde la web activá el módulo **Autenticación** (habilita `/comprobantes-admin.html`); sin él, editá `data/invoices.json` a mano.'}`,
  ],
};
