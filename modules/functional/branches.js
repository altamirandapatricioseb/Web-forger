module.exports = {
  id: 'branches', type: 'functional', name: 'Sucursales',
  description: 'Alta, edición y baja de sucursales con dirección y zona. Base para inventario, repositores y puntos de venta.',
  requires: ['auth'],
  mounts: [{ route: '/api/branches', file: 'routes/branches.js' }],
  collections: ['branches'],
  nav: () => [{ label: 'Sucursales', href: '/branches.html', id: 'nav-branches' }],
  pages: () => ({
    branches: {
      title: 'Sucursales',
      html: `  <section>
    <div class="container">
      <h2>Sucursales</h2>
      <p class="section-sub">Puntos físicos de la operación, agrupados por zona.</p>
      <div class="card" style="margin-bottom:24px">
        <h3>Nueva sucursal</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="br-name" placeholder="Nombre" style="flex:2;min-width:160px">
          <input id="br-address" placeholder="Dirección" style="flex:3;min-width:200px">
          <input id="br-zone" placeholder="Zona (ej: Oeste)" style="flex:1;min-width:120px">
          <button class="btn" id="br-create" type="button">Crear</button>
        </div>
      </div>
      <div id="branches-table"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  files: () => ({
    'models/branch.js': `const { check, str } = require('../src/validate');

/** Modelo Sucursal */
exports.validate = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  address: (v) => str(v, 3, 160),
  zone: (v) => v === undefined || v === '' || str(v, 1, 60),
});
`,
    'routes/branches.js': `const router = require('express').Router();
const db = require('../src/db');
const Branch = require('../models/branch');
const { requireAuth, requireAdmin } = require('../src/middleware/auth');

// GET /api/branches — listado (cualquier usuario logueado)
router.get('/', requireAuth, async (req, res) => res.json((await db.all('branches'))));

// POST /api/branches — alta (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = Branch.validate(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const { name, address, zone = '' } = req.body;
  res.status(201).json((await db.insert('branches', { name: name.trim(), address: address.trim(), zone: String(zone).trim() })));
});

// PATCH /api/branches/:id — edición (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  if (!(await db.get('branches', req.params.id))) return res.status(404).json({ error: 'Sucursal inexistente' });
  const { ok, errors } = Branch.validate({ ...db.get('branches', req.params.id), ...req.body });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const patch = {};
  for (const k of ['name', 'address', 'zone']) if (req.body[k] !== undefined) patch[k] = String(req.body[k]).trim();
  res.json((await db.update('branches', req.params.id, patch)));
});

// DELETE /api/branches/:id — baja (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  if (!(await db.get('branches', req.params.id))) return res.status(404).json({ error: 'Sucursal inexistente' });
  (await db.remove('branches', req.params.id));
  res.json({ ok: true });
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo sucursales */
(function () {
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const nav = document.getElementById('nav-branches');
  if (nav && (!me || me.role !== 'admin') && !window.__PREVIEW__) nav.style.display = 'none';

  const box = document.getElementById('branches-table');
  if (!box) return;

  function render(list) {
    box.innerHTML = App.table(list, [
      { key: 'name', label: 'Nombre' },
      { key: 'address', label: 'Dirección' },
      { key: 'zone', label: 'Zona' },
      { label: '', render: (b) => '<a href="#" data-del="' + b.id + '">Eliminar</a>' },
    ]);
    box.querySelectorAll('[data-del]').forEach(a => a.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await App.api('/api/branches/' + a.dataset.del, { method: 'DELETE' }); load(); }
      catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }));
  }

  function load() {
    if (window.__PREVIEW__) return render([
      { id: '1', name: 'Sucursal Centro', address: 'Av. Rivadavia 1234, CABA', zone: 'Centro' },
      { id: '2', name: 'Sucursal Ituzaingó', address: 'Zufriategui 850', zone: 'Oeste' },
      { id: '3', name: 'Depósito Morón', address: 'Int. García Silva 320', zone: 'Oeste' },
    ]);
    App.api('/api/branches').then(render).catch(err => box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>');
  }
  load();

  document.getElementById('br-create').addEventListener('click', async () => {
    try {
      await App.api('/api/branches', { method: 'POST', body: {
        name: document.getElementById('br-name').value,
        address: document.getElementById('br-address').value,
        zone: document.getElementById('br-zone').value,
      } });
      ['br-name', 'br-address', 'br-zone'].forEach(id => document.getElementById(id).value = '');
      App.toast('Sucursal creada');
      load();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
})();`,
};
