const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'inventory', type: 'functional', name: 'Inventario + Movimientos',
  description: 'Stock por producto y sucursal, derivado del historial de movimientos (entrada, salida, ajuste). Las salidas nunca dejan stock negativo.',
  requires: ['auth', 'branches', 'products-admin'],
  mounts: [{ route: '/api/inventory', file: 'routes/inventory.js' }],
  collections: ['movements'],
  nav: () => [{ label: 'Inventario', href: '/inventory.html', id: 'nav-inventory' }],
  pages: () => ({
    inventory: {
      title: 'Inventario',
      html: `  <section>
    <div class="container">
      <h2>Inventario</h2>
      <p class="section-sub">El stock se calcula siempre desde los movimientos: no puede desincronizarse.</p>
      <div class="card" style="margin-bottom:24px">
        <h3>Registrar movimiento</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select id="mv-branch" style="flex:1;min-width:150px"></select>
          <select id="mv-product" style="flex:1;min-width:150px"></select>
          <select id="mv-type" style="width:130px">
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste (fija el stock)</option>
          </select>
          <input id="mv-qty" type="number" placeholder="Cantidad" min="0" style="width:110px">
          <input id="mv-note" placeholder="Nota (opcional)" style="flex:2;min-width:150px">
          <button class="btn" id="mv-create" type="button">Registrar</button>
        </div>
      </div>
      <h3>Stock actual</h3>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="st-branch" style="width:auto;min-width:170px"></select>
        <select id="st-product" style="width:auto;min-width:170px"></select>
      </div>
      <div id="stock-table"><p class="muted">Cargando…</p></div>
      <h3 style="margin-top:32px">Últimos movimientos</h3>
      <div id="movements-table"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  files: () => ({
    'routes/inventory.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num, oneOf } = require('../src/validate');
const { requireAuth, requireRole } = require('../src/middleware/auth');

const TYPES = ['entrada', 'salida', 'ajuste'];

const validate = (data) => check(data, {
  branchId: (v) => str(v, 1, 60),
  productId: (v) => str(v, 1, 60),
  type: (v) => oneOf(v, TYPES),
  qty: (v) => num(v, 0, 1000000) && Number.isInteger(v),
  note: (v) => v === undefined || str(v, 0, 200),
});

/** Stock actual de un par sucursal/producto, sumando movimientos firmados */
const stockOf = async (branchId, productId) => ((await db.find('movements', m => m.branchId === branchId && m.productId === productId))
  .reduce((s, m) => s + m.delta, 0));

// GET /api/inventory/stock — matriz de stock, filtrable por ?branchId= y ?productId=
router.get('/stock', requireAuth, async (req, res) => {
  const branches = (await db.all('branches')).filter(b => !req.query.branchId || b.id === req.query.branchId);
  const products = (await db.all('products')).filter(p => p.active !== false && (!req.query.productId || p.id === req.query.productId));
  const rows = [];
  for (const b of branches) for (const p of products) {
    rows.push({ branchId: b.id, branch: b.name, productId: p.id, product: p.name, sku: p.sku || '', qty: await stockOf(b.id, p.id) });
  }
  res.json(rows);
});

// GET /api/inventory/movements — historial, filtrable por ?branchId= ?productId= ?type=
router.get('/movements', requireAuth, async (req, res) => {
  let rows = (await db.all('movements'));
  for (const k of ['branchId', 'productId', 'type']) if (req.query[k]) rows = rows.filter(m => m[k] === req.query[k]);
  res.json(rows.slice(-100).reverse());
});

// POST /api/inventory/movements — registra un movimiento (admin o repositor)
router.post('/movements', requireRole('repositor'), async (req, res) => {
  const { ok, errors } = validate(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const { branchId, productId, type, qty, note = '' } = req.body;
  if (!(await db.get('branches', branchId))) return res.status(422).json({ error: 'Sucursal inexistente' });
  const product = (await db.get('products', productId));
  if (!product || product.active === false) return res.status(422).json({ error: 'Producto inexistente o dado de baja' });

  const current = await stockOf(branchId, productId);
  let delta;
  if (type === 'entrada') delta = qty;
  else if (type === 'salida') {
    if (qty > current) return res.status(422).json({ error: 'Stock insuficiente: hay ' + current + ' unidades' });
    delta = -qty;
  } else delta = qty - current; // ajuste: fija el stock en qty

  const movement = (await db.insert('movements', {
    branchId, productId, type, qty, delta, note: String(note).trim(),
    userId: req.user.sub, author: req.user.name,
  }));
  res.status(201).json({ ...movement, stock: current + delta });
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo inventario */
(function () {
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const nav = document.getElementById('nav-inventory');
  if (nav && (!me || (me.role !== 'admin' && me.role !== 'repositor')) && !window.__PREVIEW__) nav.style.display = 'none';

  const stockBox = document.getElementById('stock-table');
  if (!stockBox) return;
  const mvBox = document.getElementById('movements-table');
  const TYPE_LABEL = { entrada: '${phIcon('arrow-up', { size: 13 })} Entrada', salida: '${phIcon('arrow-down', { size: 13 })} Salida', ajuste: 'Ajuste' };

  const DEMO = {
    branches: [{ id: 'b1', name: 'Sucursal Centro' }, { id: 'b2', name: 'Sucursal Ituzaingó' }],
    products: [{ id: 'p1', name: 'Producto Clásico', sku: 'CLA-001' }, { id: 'p2', name: 'Producto Premium', sku: 'PRE-001' }],
    stock: [
      { branch: 'Sucursal Centro', product: 'Producto Clásico', sku: 'CLA-001', qty: 42 },
      { branch: 'Sucursal Centro', product: 'Producto Premium', sku: 'PRE-001', qty: 8 },
      { branch: 'Sucursal Ituzaingó', product: 'Producto Clásico', sku: 'CLA-001', qty: 0 },
    ],
    movements: [
      { type: 'salida', qty: 3, branchId: 'b1', productId: 'p1', author: 'Marcela', note: 'Reposición góndola', createdAt: new Date().toISOString() },
      { type: 'entrada', qty: 50, branchId: 'b1', productId: 'p1', author: 'Patricio', note: 'Ingreso proveedor', createdAt: new Date().toISOString() },
    ],
  };

  let branches = [], products = [];
  function renderStock(rows) {
    stockBox.innerHTML = App.table(rows, [
      { key: 'branch', label: 'Sucursal' },
      { key: 'sku', label: 'SKU' },
      { key: 'product', label: 'Producto' },
      { label: 'Stock', render: (r) => r.qty === 0 ? '<strong style="color:#b91c1c">0</strong>' : '<strong>' + r.qty + '</strong>' },
    ]);
  }
  function renderMovements(rows) {
    const bById = new Map(branches.map(b => [b.id, b.name]));
    const pById = new Map(products.map(p => [p.id, p.name]));
    mvBox.innerHTML = App.table(rows, [
      { label: 'Fecha', render: (m) => (m.createdAt || '').slice(0, 16).replace('T', ' ') },
      { label: 'Tipo', render: (m) => TYPE_LABEL[m.type] || m.type },
      { label: 'Sucursal', render: (m) => App.esc(bById.get(m.branchId) || '—') },
      { label: 'Producto', render: (m) => App.esc(pById.get(m.productId) || '—') },
      { key: 'qty', label: 'Cant.' },
      { key: 'author', label: 'Usuario' },
      { key: 'note', label: 'Nota' },
    ]);
  }

  function fillSelects() {
    document.getElementById('mv-branch').innerHTML = App.options(branches, 'id', 'name', 'Sucursal…');
    document.getElementById('mv-product').innerHTML = App.options(products, 'id', 'name', 'Producto…');
    document.getElementById('st-branch').innerHTML = App.options(branches, 'id', 'name', 'Todas las sucursales');
    document.getElementById('st-product').innerHTML = App.options(products, 'id', 'name', 'Todos los productos');
  }

  async function loadTables() {
    if (window.__PREVIEW__) { renderStock(DEMO.stock); renderMovements(DEMO.movements); return; }
    const b = document.getElementById('st-branch').value;
    const p = document.getElementById('st-product').value;
    const q = (b ? '&branchId=' + b : '') + (p ? '&productId=' + p : '');
    try {
      renderStock(await App.api('/api/inventory/stock?x=1' + q));
      renderMovements(await App.api('/api/inventory/movements?x=1' + q));
    } catch (err) { stockBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; mvBox.innerHTML = ''; }
  }

  (async () => {
    if (window.__PREVIEW__) { branches = DEMO.branches; products = DEMO.products; }
    else {
      try {
        [branches, products] = await Promise.all([App.api('/api/branches'), App.api('/api/products')]);
      } catch (err) { stockBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; return; }
    }
    fillSelects();
    loadTables();
  })();

  ['st-branch', 'st-product'].forEach(id => document.getElementById(id).addEventListener('change', loadTables));

  document.getElementById('mv-create').addEventListener('click', async () => {
    try {
      const r = await App.api('/api/inventory/movements', { method: 'POST', body: {
        branchId: document.getElementById('mv-branch').value,
        productId: document.getElementById('mv-product').value,
        type: document.getElementById('mv-type').value,
        qty: Number(document.getElementById('mv-qty').value),
        note: document.getElementById('mv-note').value,
      } });
      App.toast('Movimiento registrado. Stock actual: ' + r.stock);
      document.getElementById('mv-qty').value = ''; document.getElementById('mv-note').value = '';
      loadTables();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
})();`,
};
