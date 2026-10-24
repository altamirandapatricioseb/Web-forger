// Proveedores y órdenes de compra con backend real: el catálogo sabía todo sobre lo que ENTRA
// (ventas, pedidos, caja) y nada sobre lo que SALE — a quién le compro, qué le pedí, cuánto le
// debo y si ya llegó. Este módulo cierra ese lado: libreta de proveedores (contacto, rubro, CUIT,
// condiciones) y órdenes de compra con renglones (descripción, cantidad, costo unitario) cuyo
// total lo calcula SIEMPRE el servidor — no se manda desde el navegador, así nadie lo edita. Las
// órdenes tienen un circuito con transiciones validadas: borrador → enviada → recibida, y anulada
// desde las dos primeras. Una orden recibida queda SELLADA (409 si se intenta tocar o borrar):
// es el respaldo de lo que se pagó. La integración fuerte: si el módulo Inventario está activo,
// marcar la orden como recibida GENERA LOS MOVIMIENTOS DE ENTRADA de stock en la sucursal elegida,
// con lo que el depósito se actualiza solo y deja de haber dos verdades. Panel solo-admin
// /compras-admin.html con KPIs animados (Anime.js + red de seguridad), filtro por estado, detalle
// de renglones y CSV. Requiere Autenticación. Distinto de "inventory" (mueve stock) y de "caja"
// (mueve plata): acá se administra la RELACIÓN con el proveedor y el papel de la compra.
const { phIcon } = require('../../src/icons');

const SEMILLA_PROV = [
  { name: 'Distribuidora del Norte', contact: 'Marcelo Paz', email: 'ventas@distribuidoranorte.com', phone: '+54 11 4000-0000', taxId: '30-71234567-8', terms: '30 días', notes: 'Entrega los martes.', active: true },
  { name: 'Insumos Rápidos', contact: 'Vanina Ruiz', email: 'pedidos@insumosrapidos.com', phone: '+54 351 500-0000', taxId: '27-23456789-4', terms: 'Contado', notes: '', active: true },
];

module.exports = {
  id: 'compras', type: 'functional', name: 'Proveedores y compras',
  description: 'Libreta de proveedores y órdenes de compra con backend real: renglones con cantidad y costo unitario, totales calculados en el servidor y circuito de estados validado (borrador → enviada → recibida, anulable). Una orden recibida queda sellada. Con el módulo Inventario activo, marcarla como recibida genera los movimientos de entrada de stock en la sucursal elegida. Panel solo-admin /compras-admin.html con KPIs animados (Anime.js), filtro por estado, detalle y CSV. Requiere Autenticación.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/compras', file: 'routes/compras.js' }],
  collections: ['suppliers', 'purchases'],
  nav: () => [{ label: 'Compras (admin)', href: '/compras-admin.html', id: 'nav-compras-admin' }],
  head: () => `  <style>
    .cp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .cp-kpis .card{text-align:center}
    .cp-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .cp-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .cp-chip.borrador{background:var(--surface);border:1px solid var(--line);color:var(--muted)}
    .cp-chip.enviada{background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}
    .cp-chip.recibida{background:#2e9e5b20;color:#1d6b3c}
    .cp-chip.anulada{background:#c0392b18;color:#c0392b}
    .cp-reng{display:grid;grid-template-columns:1fr 90px 130px 40px;gap:8px;align-items:center;margin-bottom:8px}
    .cp-reng input{margin:0}
    .cp-reng button{background:none;border:0;color:var(--muted);cursor:pointer;font-size:1.1rem;line-height:1;padding:6px}
    .cp-total{text-align:right;font-size:1.15rem;font-weight:700;font-variant-numeric:tabular-nums;margin-top:10px}
    .cp-detalle table{width:100%;font-size:.9rem}
    .cp-detalle td,.cp-detalle th{padding:6px 8px}
    .cp-num{text-align:right;font-variant-numeric:tabular-nums}
    @media (max-width:640px){.cp-reng{grid-template-columns:1fr 70px 100px 32px}}
  </style>`,
  pages: (cfg) => ({
    'compras-admin': {
      title: 'Proveedores y compras',
      html: `  <section>
    <div class="container">
      <h2>Proveedores y compras</h2>
      <p class="section-sub">A quién le comprás, qué le pediste y si ya llegó.${cfg.moduleIds.includes('inventory') ? ' Al marcar una orden como recibida, el stock entra solo al inventario.' : ''}</p>
      <div id="cp-kpis" class="cp-kpis"></div>

      <h3 style="margin-top:14px">Nueva orden de compra</h3>
      <div class="card" style="margin-bottom:26px">
        <form id="cp-orden">
          <label>Proveedor</label>
          <select name="supplierId" id="cp-prov-sel" required></select>${cfg.moduleIds.includes('inventory') ? `
          <label>Sucursal que recibe</label>
          <select name="branchId" id="cp-branch-sel" required></select>` : ''}
          <label>Referencia (opcional)</label><input name="ref" maxlength="60" placeholder="Nº de remito, pedido telefónico…">
          <label style="margin-top:14px">Renglones</label>
          <div id="cp-renglones"></div>
          <button class="btn ghost" type="button" id="cp-add-reng" style="width:auto">${phIcon('plus', { size: 14, style: 'vertical-align:-2px;margin-right:6px' })}Agregar renglón</button>
          <p class="cp-total">Total: <span id="cp-total-nuevo">$0</span></p>
          <div style="margin-top:10px"><button class="btn" type="submit">Crear orden</button></div>
        </form>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
        <select id="cp-filtro" style="width:auto;margin:0">
          <option value="">Todos los estados</option>
          <option value="borrador">Borradores</option>
          <option value="enviada">Enviadas</option>
          <option value="recibida">Recibidas</option>
          <option value="anulada">Anuladas</option>
        </select>
        <button class="btn ghost" type="button" id="cp-csv">Descargar CSV</button>
      </div>
      <div id="cp-ordenes"><p class="muted">Cargando…</p></div>
      <div id="cp-detalle"></div>

      <h3 style="margin-top:40px">${phIcon('truck', { size: 18, style: 'vertical-align:-4px;margin-right:8px' })}Proveedores</h3>
      <div class="card" style="margin-bottom:22px">
        <form id="cp-prov">
          <div class="grid cols-2">
            <div><label>Nombre / razón social</label><input name="name" required maxlength="80"></div>
            <div><label>Persona de contacto</label><input name="contact" maxlength="80"></div>
            <div><label>Email</label><input name="email" type="email"></div>
            <div><label>Teléfono</label><input name="phone" maxlength="40"></div>
            <div><label>CUIT / identificación fiscal</label><input name="taxId" maxlength="30"></div>
            <div><label>Condiciones de pago</label><input name="terms" maxlength="60" placeholder="Contado, 30 días…"></div>
          </div>
          <label>Notas</label><input name="notes" maxlength="300" placeholder="Días de entrega, mínimos de compra…">
          <div style="margin-top:16px"><button class="btn" type="submit">Guardar proveedor</button></div>
        </form>
      </div>
      <div id="cp-proveedores"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  files: (cfg) => {
    const conInventario = cfg.moduleIds.includes('inventory');
    return {
      'routes/compras.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

const ESTADOS = ['borrador', 'enviada', 'recibida', 'anulada'];
// Circuito permitido: una orden nunca vuelve atrás y lo recibido queda sellado
const TRANSICIONES = { borrador: ['enviada', 'anulada'], enviada: ['recibida', 'anulada'], recibida: [], anulada: [] };
const MAX_RENGLONES = 60;

// Siembra dos proveedores de ejemplo la primera vez
db.seedIfEmpty('suppliers', ${JSON.stringify(SEMILLA_PROV, null, 2)});

// El total SIEMPRE lo calcula el servidor a partir de los renglones: el navegador sólo lo muestra
const totalDe = (items) => items.reduce((s, i) => s + i.qty * i.unitCost, 0);

// Normaliza y valida los renglones que llegan del panel
function renglones(raw) {
  if (!Array.isArray(raw) || !raw.length) return { error: 'La orden necesita al menos un renglón' };
  if (raw.length > MAX_RENGLONES) return { error: 'Demasiados renglones (máximo ' + MAX_RENGLONES + ')' };
  const items = [];
  for (const r of raw) {
    if (!str(r && r.desc, 1, 120)) return { error: 'Cada renglón necesita una descripción' };
    if (!num(Number(r.qty), 0.001, 1000000)) return { error: 'Cantidad inválida en "' + String(r.desc).slice(0, 30) + '"' };
    if (!num(Number(r.unitCost), 0, 1000000000)) return { error: 'Costo inválido en "' + String(r.desc).slice(0, 30) + '"' };
    items.push({
      desc: String(r.desc).trim(),
      qty: Number(r.qty),
      unitCost: Number(r.unitCost),${conInventario ? `
      productId: r.productId ? String(r.productId) : '',` : ''}
    });
  }
  return { items };
}

/* ---------- Proveedores ---------- */

// GET /api/compras/proveedores — libreta completa (solo admin)
router.get('/proveedores', requireAdmin, async (req, res) => {
  const rows = await db.all('suppliers');
  const ordenes = await db.all('purchases');
  res.json(rows.map(s => ({
    ...s,
    orders: ordenes.filter(o => o.supplierId === s.id && o.status !== 'anulada').length,
  })).sort((a, b) => a.name.localeCompare(b.name, 'es')));
});

// POST /api/compras/proveedores — alta (nombre único)
router.post('/proveedores', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, { name: (v) => str(v, 2, 80) });
  if (!ok) return res.status(422).json({ error: 'El nombre del proveedor es obligatorio', errors });
  const name = req.body.name.trim();
  if ((await db.find('suppliers', s => s.name.toLowerCase() === name.toLowerCase())).length) {
    return res.status(409).json({ error: 'Ya existe un proveedor con ese nombre' });
  }
  const opt = (k, max) => String(req.body[k] || '').trim().slice(0, max);
  res.status(201).json(await db.insert('suppliers', {
    name,
    contact: opt('contact', 80),
    email: opt('email', 120).toLowerCase(),
    phone: opt('phone', 40),
    taxId: opt('taxId', 30),
    terms: opt('terms', 60),
    notes: opt('notes', 300),
    active: true,
  }));
});

// PATCH /api/compras/proveedores/:id — edita datos o da de baja (active: false)
router.patch('/proveedores/:id', requireAdmin, async (req, res) => {
  const prov = await db.get('suppliers', req.params.id);
  if (!prov) return res.status(404).json({ error: 'Proveedor inexistente' });
  const patch = {};
  for (const [k, max] of [['name', 80], ['contact', 80], ['email', 120], ['phone', 40], ['taxId', 30], ['terms', 60], ['notes', 300]]) {
    if (req.body[k] !== undefined) {
      if (typeof req.body[k] !== 'string' || req.body[k].length > max) return res.status(422).json({ error: 'Campo inválido: ' + k });
      patch[k] = req.body[k].trim();
    }
  }
  if (patch.name !== undefined && patch.name.length < 2) return res.status(422).json({ error: 'Nombre demasiado corto' });
  if (req.body.active !== undefined) patch.active = Boolean(req.body.active);
  if (!Object.keys(patch).length) return res.status(422).json({ error: 'Nada para actualizar' });
  res.json(await db.update('suppliers', prov.id, patch));
});

// DELETE /api/compras/proveedores/:id — sólo si nunca se le compró (si hay órdenes, se da de baja)
router.delete('/proveedores/:id', requireAdmin, async (req, res) => {
  const prov = await db.get('suppliers', req.params.id);
  if (!prov) return res.status(404).json({ error: 'Proveedor inexistente' });
  if ((await db.find('purchases', o => o.supplierId === prov.id)).length) {
    return res.status(409).json({ error: 'Tiene órdenes cargadas: dalo de baja en vez de borrarlo' });
  }
  await db.remove('suppliers', prov.id);
  res.json({ ok: true });
});

/* ---------- Órdenes de compra ---------- */

// GET /api/compras/ordenes — órdenes con el nombre del proveedor resuelto (filtro ?status=)
router.get('/ordenes', requireAdmin, async (req, res) => {
  const provs = await db.all('suppliers');
  const nombre = (id) => (provs.filter(p => p.id === id)[0] || {}).name || 'Proveedor eliminado';
  let rows = (await db.all('purchases')).map(o => ({ ...o, supplierName: nombre(o.supplierId) }));
  if (ESTADOS.includes(req.query.status)) rows = rows.filter(o => o.status === req.query.status);
  res.json(rows.reverse());
});

// POST /api/compras/ordenes — nueva orden en borrador (el total lo calcula el servidor)
router.post('/ordenes', requireAdmin, async (req, res) => {
  const prov = await db.get('suppliers', String(req.body.supplierId || ''));
  if (!prov) return res.status(422).json({ error: 'Elegí un proveedor de la lista' });
  const { items, error } = renglones(req.body.items);
  if (error) return res.status(422).json({ error });
${conInventario ? `  const branchId = String(req.body.branchId || '');
  if (!(await db.get('branches', branchId))) return res.status(422).json({ error: 'Elegí la sucursal que recibe la mercadería' });
` : ''}  const row = await db.insert('purchases', {
    supplierId: prov.id,${conInventario ? `
    branchId,` : ''}
    ref: String(req.body.ref || '').trim().slice(0, 60),
    items,
    total: totalDe(items),
    status: 'borrador',
    author: req.user.name,
    receivedAt: '',
  });
  res.status(201).json({ ...row, supplierName: prov.name });
});

// PATCH /api/compras/ordenes/:id — cambia el estado siguiendo el circuito${conInventario ? `
// Al pasar a "recibida" se generan los movimientos de entrada de stock de los renglones que
// apuntan a un producto del catálogo: el depósito se actualiza solo.` : ''}
router.patch('/ordenes/:id', requireAdmin, async (req, res) => {
  const orden = await db.get('purchases', req.params.id);
  if (!orden) return res.status(404).json({ error: 'Orden inexistente' });
  const destino = String(req.body.status || '');
  if (!ESTADOS.includes(destino)) return res.status(422).json({ error: 'Estado inválido' });
  if (!TRANSICIONES[orden.status].includes(destino)) {
    return res.status(409).json({ error: 'Una orden ' + orden.status + ' no puede pasar a ' + destino });
  }
  const patch = { status: destino };
${conInventario ? `  let ingresados = 0;
  if (destino === 'recibida') {
    patch.receivedAt = new Date().toISOString();
    for (const it of orden.items) {
      if (!it.productId) continue;
      const prod = await db.get('products', it.productId);
      if (!prod) continue;
      await db.insert('movements', {
        branchId: orden.branchId,
        productId: it.productId,
        type: 'entrada',
        qty: it.qty,
        delta: it.qty,
        note: 'Orden de compra ' + (orden.ref || orden.id),
        userId: req.user.sub,
        author: req.user.name,
      });
      ingresados++;
    }
  }
  const upd = await db.update('purchases', orden.id, patch);
  res.json({ ...upd, stockIngresado: ingresados });
});
` : `  if (destino === 'recibida') patch.receivedAt = new Date().toISOString();
  res.json(await db.update('purchases', orden.id, patch));
});
`}

// DELETE /api/compras/ordenes/:id — sólo borradores: lo enviado y lo recibido queda como respaldo
router.delete('/ordenes/:id', requireAdmin, async (req, res) => {
  const orden = await db.get('purchases', req.params.id);
  if (!orden) return res.status(404).json({ error: 'Orden inexistente' });
  if (orden.status !== 'borrador') {
    return res.status(409).json({ error: 'Sólo se borran los borradores: anulá la orden en su lugar' });
  }
  await db.remove('purchases', orden.id);
  res.json({ ok: true });
});

// GET /api/compras/resumen — KPIs calculados en el servidor
router.get('/resumen', requireAdmin, async (req, res) => {
  const ordenes = await db.all('purchases');
  const abiertas = ordenes.filter(o => o.status === 'borrador' || o.status === 'enviada');
  const mes = new Date().toISOString().slice(0, 7);
  res.json({
    proveedores: (await db.find('suppliers', s => s.active !== false)).length,
    abiertas: abiertas.length,
    comprometido: abiertas.reduce((s, o) => s + (o.total || 0), 0),
    recibidoMes: ordenes.filter(o => o.status === 'recibida' && String(o.receivedAt || '').slice(0, 7) === mes)
      .reduce((s, o) => s + (o.total || 0), 0),
  });
});
${conInventario ? `
// GET /api/compras/catalogo — sucursales y productos para armar los renglones con stock real
router.get('/catalogo', requireAdmin, async (req, res) => {
  res.json({
    branches: (await db.all('branches')).map(b => ({ id: b.id, name: b.name })),
    products: (await db.find('products', p => p.active !== false)).map(p => ({ id: p.id, name: p.name })),
  });
});
` : ''}
module.exports = router;
`,
    };
  },
  clientJs: (cfg) => `/* Módulo proveedores y compras: alta de proveedores, armado de órdenes con renglones (total en
   vivo, pero el que vale es el del servidor), circuito de estados y CSV. KPIs con count-up
   (Anime.js + red de seguridad). Sólo admin. En la vista previa del Builder simula la API. */
(function () {
  var box = document.getElementById('cp-ordenes');
  if (!box) return;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
    box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
    var pv = document.getElementById('cp-proveedores');
    if (pv) pv.innerHTML = '';
    return;
  }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };
  var fecha = function (iso) { try { return new Date(iso).toLocaleDateString('es-AR'); } catch (e) { return '—'; } };
  var LABELS = { borrador: 'Borrador', enviada: 'Enviada', recibida: 'Recibida', anulada: 'Anulada' };
  var proveedores = [], ordenes = [], productos = [], sucursales = [];
  var conInventario = ${cfg.moduleIds.includes('inventory') ? 'true' : 'false'};

  function contar(el, valor, money) {
    var pintar = function (v) { el.textContent = money ? App.money(Math.round(v)) : Math.round(v); };
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { pintar(valor); return; }
    var obj = { v: 0 };
    anime.animate(obj, { v: valor, duration: 700, ease: 'outCubic', onUpdate: function () { pintar(obj.v); } });
    setTimeout(function () { pintar(valor); }, 900);
  }

  function pintarKpis(r) {
    var cont = document.getElementById('cp-kpis');
    if (!cont) return;
    var datos = [
      ['Proveedores activos', r.proveedores, false],
      ['Órdenes abiertas', r.abiertas, false],
      ['Comprometido', r.comprometido, true],
      ['Recibido este mes', r.recibidoMes, true],
    ];
    cont.innerHTML = datos.map(function (d) {
      return '<div class="card"><strong data-cp-kpi="' + d[1] + '" data-cp-money="' + (d[2] ? '1' : '') + '">0</strong><span class="muted">' + d[0] + '</span></div>';
    }).join('');
    cont.querySelectorAll('[data-cp-kpi]').forEach(function (el) {
      contar(el, Number(el.getAttribute('data-cp-kpi')), el.getAttribute('data-cp-money') === '1');
    });
  }

  /* ---------- Renglones de la orden nueva ---------- */
  var rengBox = document.getElementById('cp-renglones');

  function filaRenglon() {
    var div = document.createElement('div');
    div.className = 'cp-reng';
    var desc = conInventario && productos.length
      ? '<select data-cp-prod><option value="">Descripción libre…</option>' +
        productos.map(function (p) { return '<option value="' + attr(p.id) + '">' + App.esc(p.name) + '</option>'; }).join('') + '</select>'
      : '';
    div.innerHTML = desc +
      '<input data-cp-desc placeholder="Qué se compra" maxlength="120">' +
      '<input data-cp-qty type="number" min="0.001" step="any" value="1" placeholder="Cant.">' +
      '<input data-cp-cost type="number" min="0" step="any" value="0" placeholder="Costo unit.">' +
      '<button type="button" title="Quitar renglón" data-cp-quitar>&times;</button>';
    if (desc) div.style.gridTemplateColumns = '1fr 1fr 80px 120px 34px';
    div.querySelector('[data-cp-quitar]').addEventListener('click', function () {
      div.remove();
      if (!rengBox.children.length) agregarRenglon();
      totalVivo();
    });
    var sel = div.querySelector('[data-cp-prod]');
    if (sel) sel.addEventListener('change', function () {
      var p = productos.filter(function (x) { return x.id === sel.value; })[0];
      if (p) div.querySelector('[data-cp-desc]').value = p.name;
    });
    div.querySelectorAll('input').forEach(function (i) { i.addEventListener('input', totalVivo); });
    return div;
  }

  function agregarRenglon() { if (rengBox) { rengBox.appendChild(filaRenglon()); totalVivo(); } }

  function leerRenglones() {
    if (!rengBox) return [];
    return [].slice.call(rengBox.children).map(function (d) {
      var sel = d.querySelector('[data-cp-prod]');
      return {
        desc: d.querySelector('[data-cp-desc]').value,
        qty: Number(d.querySelector('[data-cp-qty]').value),
        unitCost: Number(d.querySelector('[data-cp-cost]').value),
        productId: sel ? sel.value : '',
      };
    }).filter(function (r) { return String(r.desc).trim(); });
  }

  function totalVivo() {
    var el = document.getElementById('cp-total-nuevo');
    if (!el) return;
    var t = leerRenglones().reduce(function (s, r) { return s + (r.qty || 0) * (r.unitCost || 0); }, 0);
    el.textContent = App.money(Math.round(t));
  }

  var addBtn = document.getElementById('cp-add-reng');
  if (addBtn) addBtn.addEventListener('click', agregarRenglon);

  /* ---------- Pintado ---------- */
  function pintarSelects() {
    var sel = document.getElementById('cp-prov-sel');
    if (sel) {
      var activos = proveedores.filter(function (p) { return p.active !== false; });
      sel.innerHTML = App.options(activos, 'id', 'name', activos.length ? 'Elegí un proveedor' : 'Cargá un proveedor primero');
    }
    var bsel = document.getElementById('cp-branch-sel');
    if (bsel) bsel.innerHTML = App.options(sucursales, 'id', 'name', 'Elegí la sucursal');
  }

  function pintarProveedores() {
    var cont = document.getElementById('cp-proveedores');
    if (!cont) return;
    cont.innerHTML = App.table(proveedores, [
      { label: 'Proveedor', render: function (p) { return '<strong>' + App.esc(p.name) + '</strong>' + (p.active === false ? ' <span class="cp-chip anulada">De baja</span>' : '') + (p.notes ? '<br><span class="muted" style="font-size:.8rem">' + App.esc(p.notes) + '</span>' : ''); } },
      { label: 'Contacto', render: function (p) { return (p.contact ? App.esc(p.contact) + '<br>' : '') + '<span class="muted" style="font-size:.8rem">' + App.esc(p.email || p.phone || '—') + '</span>'; } },
      { label: 'CUIT', render: function (p) { return App.esc(p.taxId || '—'); } },
      { label: 'Pago', render: function (p) { return App.esc(p.terms || '—'); } },
      { label: 'Órdenes', render: function (p) { return '<span class="cp-num">' + p.orders + '</span>'; } },
      { label: '', render: function (p) { return '<button class="btn ghost" type="button" data-cp-baja="' + p.id + '">' + (p.active === false ? 'Reactivar' : 'Dar de baja') + '</button>'; } },
    ]);
    cont.querySelectorAll('[data-cp-baja]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var p = proveedores.filter(function (x) { return x.id === b.getAttribute('data-cp-baja'); })[0];
        if (!p) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría el estado'); return; }
        try { await App.api('/api/compras/proveedores/' + p.id, { method: 'PATCH', body: { active: p.active === false } }); App.toast('Proveedor actualizado'); cargar(); }
        catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }

  function pintarOrdenes() {
    var filtro = (document.getElementById('cp-filtro') || {}).value || '';
    var rows = filtro ? ordenes.filter(function (o) { return o.status === filtro; }) : ordenes;
    box.innerHTML = App.table(rows, [
      { label: 'Orden', render: function (o) { return '<strong>' + App.esc(o.supplierName) + '</strong>' + (o.ref ? '<br><span class="muted" style="font-size:.8rem">' + App.esc(o.ref) + '</span>' : ''); } },
      { label: 'Fecha', render: function (o) { return fecha(o.createdAt); } },
      { label: 'Renglones', render: function (o) { return '<span class="cp-num">' + (o.items || []).length + '</span>'; } },
      { label: 'Total', render: function (o) { return '<span class="cp-num">' + App.money(o.total) + '</span>'; } },
      { label: 'Estado', render: function (o) { return '<span class="cp-chip ' + o.status + '">' + (LABELS[o.status] || o.status) + '</span>'; } },
      { label: '', render: function (o) {
        var b = '<button class="btn ghost" type="button" data-cp-ver="' + o.id + '">Ver</button> ';
        if (o.status === 'borrador') b += '<button class="btn ghost" type="button" data-cp-est="' + o.id + '" data-cp-a="enviada">Marcar enviada</button> ';
        if (o.status === 'enviada') b += '<button class="btn ghost" type="button" data-cp-est="' + o.id + '" data-cp-a="recibida">Marcar recibida</button> ';
        if (o.status === 'borrador' || o.status === 'enviada') b += '<button class="btn ghost" type="button" data-cp-est="' + o.id + '" data-cp-a="anulada">Anular</button>';
        return b;
      } },
    ]);
    box.querySelectorAll('[data-cp-ver]').forEach(function (b) {
      b.addEventListener('click', function () { verDetalle(b.getAttribute('data-cp-ver')); });
    });
    box.querySelectorAll('[data-cp-est]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var destino = b.getAttribute('data-cp-a');
        if (destino === 'anulada' && !confirm('¿Anular la orden?')) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: la orden pasaría a ' + destino); return; }
        try {
          var r = await App.api('/api/compras/ordenes/' + b.getAttribute('data-cp-est'), { method: 'PATCH', body: { status: destino } });
          App.toast(r.stockIngresado ? 'Orden recibida · ' + r.stockIngresado + ' producto(s) ingresados al stock' : 'Orden ' + (LABELS[destino] || destino).toLowerCase());
          cargar();
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }

  function verDetalle(id) {
    var o = ordenes.filter(function (x) { return x.id === id; })[0];
    var cont = document.getElementById('cp-detalle');
    if (!o || !cont) return;
    var filas = (o.items || []).map(function (i) {
      return '<tr><td>' + App.esc(i.desc) + '</td><td class="cp-num">' + i.qty + '</td><td class="cp-num">' + App.money(i.unitCost) + '</td><td class="cp-num">' + App.money(Math.round(i.qty * i.unitCost)) + '</td></tr>';
    }).join('');
    cont.innerHTML = '<div class="card cp-detalle" style="margin-top:24px">' +
      '<h3>' + App.esc(o.supplierName) + ' <span class="cp-chip ' + o.status + '">' + (LABELS[o.status] || o.status) + '</span></h3>' +
      '<p class="muted" style="margin:0 0 12px;font-size:.85rem">' + fecha(o.createdAt) + (o.ref ? ' · ' + App.esc(o.ref) : '') + (o.receivedAt ? ' · recibida el ' + fecha(o.receivedAt) : '') + '</p>' +
      '<table><thead><tr><th>Detalle</th><th class="cp-num">Cant.</th><th class="cp-num">Costo</th><th class="cp-num">Subtotal</th></tr></thead><tbody>' + filas + '</tbody></table>' +
      '<p class="cp-total">Total: ' + App.money(o.total) + '</p>' +
      (o.status === 'borrador' ? '<button class="btn ghost" type="button" id="cp-borrar-orden" style="width:auto">Borrar borrador</button>' : '') +
      '</div>';
    var del = document.getElementById('cp-borrar-orden');
    if (del) del.addEventListener('click', async function () {
      if (!confirm('¿Borrar el borrador?')) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      try { await App.api('/api/compras/ordenes/' + o.id, { method: 'DELETE' }); cont.innerHTML = ''; App.toast('Borrador eliminado'); cargar(); }
      catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });
    cont.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  async function cargar() {
    if (window.__PREVIEW__) {
      proveedores = [{ id: '1', name: 'Distribuidora del Norte', contact: 'Marcelo Paz', email: 'ventas@ejemplo.com', phone: '', taxId: '30-71234567-8', terms: '30 días', notes: '', active: true, orders: 1 }];
      ordenes = [{ id: '1', supplierId: '1', supplierName: 'Distribuidora del Norte', ref: 'OC-001', items: [{ desc: 'Insumo de ejemplo', qty: 10, unitCost: 3500 }], total: 35000, status: 'enviada', createdAt: new Date().toISOString(), receivedAt: '' }];
      pintarKpis({ proveedores: 1, abiertas: 1, comprometido: 35000, recibidoMes: 0 });
    } else {
      try {
        proveedores = await App.api('/api/compras/proveedores');
        ordenes = await App.api('/api/compras/ordenes');
        pintarKpis(await App.api('/api/compras/resumen'));
        if (conInventario) {
          var cat = await App.api('/api/compras/catalogo');
          productos = cat.products || [];
          sucursales = cat.branches || [];
        }
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
        return;
      }
    }
    pintarSelects();
    pintarProveedores();
    pintarOrdenes();
    if (rengBox && !rengBox.children.length) agregarRenglon();
  }

  var formProv = document.getElementById('cp-prov');
  if (formProv) formProv.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el proveedor'); return; }
    try {
      await App.api('/api/compras/proveedores', { method: 'POST', body: Object.fromEntries(new FormData(formProv)) });
      formProv.reset();
      App.toast('Proveedor guardado');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  var formOrden = document.getElementById('cp-orden');
  if (formOrden) formOrden.addEventListener('submit', async function (e) {
    e.preventDefault();
    var datos = Object.fromEntries(new FormData(formOrden));
    datos.items = leerRenglones();
    if (!datos.items.length) { App.toast('Cargá al menos un renglón con descripción'); return; }
    if (window.__PREVIEW__) { App.toast('Vista previa: se crearía la orden'); return; }
    try {
      var o = await App.api('/api/compras/ordenes', { method: 'POST', body: datos });
      formOrden.reset();
      rengBox.innerHTML = '';
      agregarRenglon();
      App.toast('Orden creada en borrador');
      await cargar();
      verDetalle(o.id);
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  var filtro = document.getElementById('cp-filtro');
  if (filtro) filtro.addEventListener('change', pintarOrdenes);

  var csv = document.getElementById('cp-csv');
  if (csv) csv.addEventListener('click', function () {
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [['Fecha', 'Proveedor', 'Referencia', 'Detalle', 'Cantidad', 'Costo unitario', 'Subtotal', 'Estado'].map(celda).join(';')];
    ordenes.forEach(function (o) {
      (o.items || []).forEach(function (i) {
        lineas.push([fecha(o.createdAt), o.supplierName, o.ref || '', i.desc, i.qty, i.unitCost, Math.round(i.qty * i.unitCost), LABELS[o.status] || o.status].map(celda).join(';'));
      });
    });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'compras-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  cargar();
})();`,
  readmeNotes: (cfg) => [
    `**Proveedores y compras**: panel solo-admin en \`/compras-admin.html\`. El total de cada orden lo calcula el servidor a partir de los renglones (el navegador sólo lo previsualiza), y el circuito de estados está validado en \`routes/compras.js\`: borrador → enviada → recibida, con anulación desde las dos primeras. **Una orden recibida queda sellada**: no se borra ni se modifica, porque es el respaldo de lo que se pagó.${cfg.moduleIds.includes('inventory') ? ' Como el módulo **Inventario** está activo, al marcar una orden como recibida se generan automáticamente los movimientos de entrada de stock de los renglones asociados a un producto del catálogo, en la sucursal elegida al crear la orden.' : ' Si activás el módulo **Inventario** en el Builder, marcar una orden como recibida pasa además a cargar el stock automáticamente.'}`,
  ],
};
