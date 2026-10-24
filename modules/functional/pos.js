const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'pos', type: 'functional', name: 'Puntos de venta',
  description: 'Cajas por sucursal y registro de ventas con total calculado en el servidor. Si Inventario está activo, cada venta descuenta stock.',
  requires: ['auth', 'branches', 'products-admin'],
  mounts: [{ route: '/api/pos', file: 'routes/pos.js' }],
  collections: ['pos', 'sales'],
  nav: () => [{ label: 'Ventas', href: '/pos.html', id: 'nav-pos' }],
  pages: () => ({
    pos: {
      title: 'Punto de venta',
      html: `  <section>
    <div class="container">
      <h2>Punto de venta</h2>
      <p class="section-sub">Elegí la caja, cargá los ítems y confirmá. El total se calcula en el servidor.</p>
      <div class="grid cols-2">
        <div class="card">
          <h3>Nueva venta</h3>
          <select id="ps-pos" style="margin-bottom:10px"></select>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <select id="ps-product" style="flex:2;min-width:150px"></select>
            <input id="ps-qty" type="number" value="1" min="1" style="width:80px">
            <button class="btn btn-ghost" id="ps-add" type="button">Agregar</button>
          </div>
          <div id="ps-items" class="muted" style="margin:14px 0">Sin ítems.</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong id="ps-total"></strong>
            <button class="btn" id="ps-confirm" type="button">Confirmar venta</button>
          </div>
        </div>
        <div class="card" id="pos-admin-card">
          <h3>Cajas</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <input id="pc-name" placeholder="Nombre (ej: Caja 1)" style="flex:1;min-width:130px">
            <select id="pc-branch" style="flex:1;min-width:150px"></select>
            <button class="btn btn-ghost" id="pc-create" type="button">Crear</button>
          </div>
          <div id="pos-list" class="muted">Cargando…</div>
        </div>
      </div>
      <h3 style="margin-top:32px">Últimas ventas</h3>
      <div id="sales-table"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  files: (cfg) => ({
    'routes/pos.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num } = require('../src/validate');
const { requireAuth, requireAdmin } = require('../src/middleware/auth');

const validatePos = (data) => check(data, {
  name: (v) => str(v, 2, 60),
  branchId: (v) => str(v, 1, 60),
});

// GET /api/pos — cajas con su sucursal (cualquier usuario logueado)
router.get('/', requireAuth, async (req, res) => {
  const byId = new Map((await db.all('branches')).map(b => [b.id, b.name]));
  res.json((await db.all('pos')).map(p => ({ ...p, branch: byId.get(p.branchId) || '—' })));
});

// POST /api/pos — alta de caja (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = validatePos(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  if (!(await db.get('branches', req.body.branchId))) return res.status(422).json({ error: 'Sucursal inexistente' });
  res.status(201).json((await db.insert('pos', { name: req.body.name.trim(), branchId: req.body.branchId })));
});

// DELETE /api/pos/:id — baja de caja (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  if (!(await db.get('pos', req.params.id))) return res.status(404).json({ error: 'Caja inexistente' });
  (await db.remove('pos', req.params.id));
  res.json({ ok: true });
});

// POST /api/pos/sales — registra una venta; total calculado en el servidor
router.post('/sales', requireAuth, async (req, res) => {
  const pos = (await db.get('pos', req.body.posId));
  if (!pos) return res.status(422).json({ error: 'Elegí una caja válida' });
  const items = req.body.items;
  if (!Array.isArray(items) || !items.length) return res.status(422).json({ error: 'La venta no tiene ítems' });
  const productsById = new Map((await db.all('products')).filter(p => p.active !== false).map(p => [p.id, p]));
  const errors = {};
  for (const [i, it] of items.entries()) {
    if (!it || !productsById.has(it.productId)) errors['items.' + i] = 'Producto inexistente o dado de baja';
    else if (!num(it.qty, 1, 9999) || !Number.isInteger(it.qty)) errors['items.' + i] = 'Cantidad inválida';
  }
  if (Object.keys(errors).length) return res.status(422).json({ error: 'Venta inválida', errors });
${cfg.moduleIds.includes('inventory') ? `
  // Inventario activo: validar stock en la sucursal de la caja y descontar
  const stockOf = async (productId) => ((await db.find('movements', m => m.branchId === pos.branchId && m.productId === productId))
    .reduce((s, m) => s + m.delta, 0));
  for (const it of items) {
    const available = await stockOf(it.productId);
    if (it.qty > available) {
      return res.status(422).json({ error: 'Stock insuficiente de "' + productsById.get(it.productId).name + '": hay ' + available + ' unidades en la sucursal' });
    }
  }
` : ''}
  const detail = items.map(it => {
    const p = productsById.get(it.productId);
    return { productId: p.id, name: p.name, unitPrice: p.price, qty: it.qty };
  });
  const total = detail.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const sale = (await db.insert('sales', { posId: pos.id, posName: pos.name, branchId: pos.branchId, items: detail, total, userId: req.user.sub, author: req.user.name }));
${cfg.moduleIds.includes('inventory') ? `  for (const it of detail) {
    (await db.insert('movements', { branchId: pos.branchId, productId: it.productId, type: 'salida', qty: it.qty, delta: -it.qty, note: 'Venta ' + sale.id + ' (' + pos.name + ')', userId: req.user.sub, author: req.user.name }));
  }
` : ''}  res.status(201).json(sale);
});

// GET /api/pos/sales — últimas ventas (solo admin; filtro ?posId=)
router.get('/sales', requireAdmin, async (req, res) => {
  let rows = (await db.all('sales'));
  if (req.query.posId) rows = rows.filter(s => s.posId === req.query.posId);
  res.json(rows.slice(-100).reverse());
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo punto de venta */
(function () {
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const nav = document.getElementById('nav-pos');
  if (nav && !me && !window.__PREVIEW__) nav.style.display = 'none';

  const itemsBox = document.getElementById('ps-items');
  if (!itemsBox) return;

  const DEMO = {
    pos: [{ id: 'c1', name: 'Caja 1', branch: 'Sucursal Centro' }, { id: 'c2', name: 'Caja 2', branch: 'Sucursal Ituzaingó' }],
    products: [{ id: 'p1', name: 'Producto Clásico', price: 4999 }, { id: 'p2', name: 'Producto Premium', price: 9999 }],
    sales: [{ posName: 'Caja 1', total: 19997, author: 'Patricio', items: [{}, {}], createdAt: new Date().toISOString() }],
  };

  let products = [], sale = [];
  function renderItems() {
    const totalEl = document.getElementById('ps-total');
    if (!sale.length) { itemsBox.innerHTML = 'Sin ítems.'; totalEl.textContent = ''; return; }
    const byId = new Map(products.map(p => [p.id, p]));
    let total = 0;
    itemsBox.innerHTML = sale.map((it, idx) => {
      const p = byId.get(it.productId);
      total += p.price * it.qty;
      return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line)">' +
        '<span>' + App.esc(p.name) + ' × ' + it.qty + '</span>' +
        '<span>' + App.money(p.price * it.qty) + ' <a href="#" data-rm="' + idx + '">${phIcon('x', { size: 12 })}</a></span></div>';
    }).join('');
    totalEl.textContent = 'Total: ' + App.money(total);
    itemsBox.querySelectorAll('[data-rm]').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault(); sale.splice(Number(a.dataset.rm), 1); renderItems();
    }));
  }

  function renderPosList(list) {
    const box = document.getElementById('pos-list');
    if (!list.length) { box.textContent = 'Todavía no hay cajas.'; return; }
    box.innerHTML = list.map(p =>
      '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line)">' +
      '<span><strong>' + App.esc(p.name) + '</strong> · ' + App.esc(p.branch) + '</span>' +
      '<a href="#" data-delpos="' + p.id + '">Eliminar</a></div>'
    ).join('');
    box.querySelectorAll('[data-delpos]').forEach(a => a.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await App.api('/api/pos/' + a.dataset.delpos, { method: 'DELETE' }); load(); }
      catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }));
  }

  function renderSales(rows) {
    document.getElementById('sales-table').innerHTML = App.table(rows, [
      { label: 'Fecha', render: (s) => (s.createdAt || '').slice(0, 16).replace('T', ' ') },
      { key: 'posName', label: 'Caja' },
      { key: 'author', label: 'Vendedor' },
      { label: 'Ítems', render: (s) => s.items.length },
      { label: 'Total', render: (s) => '<strong>' + App.money(s.total) + '</strong>' },
    ]);
  }

  async function load() {
    if (window.__PREVIEW__) {
      products = DEMO.products;
      document.getElementById('ps-pos').innerHTML = App.options(DEMO.pos, 'id', 'name', 'Caja…');
      document.getElementById('ps-product').innerHTML = App.options(products, 'id', 'name', 'Producto…');
      document.getElementById('pc-branch').innerHTML = App.options([{ id: 'b1', name: 'Sucursal Centro' }], 'id', 'name', 'Sucursal…');
      renderPosList(DEMO.pos); renderSales(DEMO.sales); renderItems();
      return;
    }
    try {
      const [posList, prods, branches] = await Promise.all([App.api('/api/pos'), App.api('/api/products'), App.api('/api/branches')]);
      products = prods;
      document.getElementById('ps-pos').innerHTML = App.options(posList, 'id', 'name', 'Caja…');
      document.getElementById('ps-product').innerHTML = App.options(products, 'id', 'name', 'Producto…');
      document.getElementById('pc-branch').innerHTML = App.options(branches, 'id', 'name', 'Sucursal…');
      renderPosList(posList);
      if (me && me.role === 'admin') App.api('/api/pos/sales').then(renderSales).catch(() => {});
      else { document.getElementById('sales-table').innerHTML = '<p class="muted">Solo los administradores ven el historial completo.</p>'; document.getElementById('pos-admin-card').style.display = 'none'; }
    } catch (err) { itemsBox.innerHTML = App.esc(err.message); }
  }
  load();
  renderItems();

  document.getElementById('ps-add').addEventListener('click', () => {
    const productId = document.getElementById('ps-product').value;
    const qty = Number(document.getElementById('ps-qty').value);
    if (!productId || !qty || qty < 1) return App.toast('Elegí producto y cantidad');
    const found = sale.find(i => i.productId === productId);
    if (found) found.qty += qty; else sale.push({ productId, qty });
    renderItems();
  });

  document.getElementById('ps-confirm').addEventListener('click', async () => {
    if (!sale.length) return App.toast('La venta no tiene ítems');
    try {
      const r = await App.api('/api/pos/sales', { method: 'POST', body: { posId: document.getElementById('ps-pos').value, items: sale } });
      sale = []; renderItems();
      App.toast('Venta registrada: ' + App.money(r.total));
      load();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  document.getElementById('pc-create').addEventListener('click', async () => {
    try {
      await App.api('/api/pos', { method: 'POST', body: { name: document.getElementById('pc-name').value, branchId: document.getElementById('pc-branch').value } });
      document.getElementById('pc-name').value = '';
      App.toast('Caja creada');
      load();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
})();`,
};
