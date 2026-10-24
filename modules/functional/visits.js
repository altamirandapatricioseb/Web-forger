const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'visits', type: 'functional', name: 'Registro de visitas',
  description: 'Formulario de campo: cada repositor registra visitas a sus sucursales asignadas (estado, observaciones). El admin ve todo con filtros.',
  requires: ['repositores'],
  mounts: [{ route: '/api/visits', file: 'routes/visits.js' }],
  collections: ['visits'],
  nav: () => [{ label: 'Visitas', href: '/visits.html', id: 'nav-visits' }],
  pages: () => ({
    visits: {
      title: 'Visitas',
      html: `  <section>
    <div class="container">
      <h2>Registro de visitas</h2>
      <p class="section-sub">Registrá la visita al terminar la recorrida. La fecha y hora se toman del servidor.</p>
      <div class="card" style="margin-bottom:24px" id="visit-form-card">
        <h3>Nueva visita</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select id="vi-branch" style="flex:1;min-width:180px"></select>
          <select id="vi-status" style="width:180px">
            <option value="completa">Completa</option>
            <option value="parcial">Parcial</option>
            <option value="sin-acceso">Sin acceso al local</option>
          </select>
          <input id="vi-notes" placeholder="Observaciones (góndola, faltantes, etc.)" style="flex:3;min-width:220px">
          <button class="btn" id="vi-create" type="button">Registrar visita</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap" id="visit-filters">
        <select id="vf-branch" style="width:auto;min-width:170px"></select>
        <select id="vf-status" style="width:auto">
          <option value="">Todos los estados</option>
          <option value="completa">Completa</option>
          <option value="parcial">Parcial</option>
          <option value="sin-acceso">Sin acceso</option>
        </select>
      </div>
      <div id="visits-table"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  files: () => ({
    'routes/visits.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, oneOf } = require('../src/validate');
const { requireRole } = require('../src/middleware/auth');

const STATUSES = ['completa', 'parcial', 'sin-acceso'];

const validate = (data) => check(data, {
  branchId: (v) => str(v, 1, 60),
  status: (v) => oneOf(v, STATUSES),
  notes: (v) => v === undefined || str(v, 0, 500),
});

// POST /api/visits — registra una visita (repositor en sucursal asignada; admin en cualquiera)
router.post('/', requireRole('repositor'), async (req, res) => {
  const { ok, errors } = validate(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const branch = (await db.get('branches', req.body.branchId));
  if (!branch) return res.status(422).json({ error: 'Sucursal inexistente' });
  if (req.user.role !== 'admin') {
    const assigned = (await db.find('assignments', a => a.userId === req.user.sub && a.branchId === branch.id)).length;
    if (!assigned) return res.status(403).json({ error: 'No estás asignado a esa sucursal' });
  }
  const visit = (await db.insert('visits', {
    branchId: branch.id, branch: branch.name,
    status: req.body.status, notes: String(req.body.notes || '').trim(),
    userId: req.user.sub, author: req.user.name,
  }));
  res.status(201).json(visit);
});

// GET /api/visits — el repositor ve las propias; el admin, todas. Filtros: ?branchId= ?status= ?userId=
router.get('/', requireRole('repositor'), async (req, res) => {
  let rows = req.user.role === 'admin' ? (await db.all('visits')) : (await db.find('visits', v => v.userId === req.user.sub));
  for (const k of ['branchId', 'status', 'userId']) if (req.query[k]) rows = rows.filter(v => v[k] === req.query[k]);
  res.json(rows.slice(-200).reverse());
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo visitas */
(function () {
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const nav = document.getElementById('nav-visits');
  if (nav && (!me || (me.role !== 'admin' && me.role !== 'repositor')) && !window.__PREVIEW__) nav.style.display = 'none';

  const box = document.getElementById('visits-table');
  if (!box) return;
  const STATUS_LABEL = { completa: '${phIcon('check', { size: 13 })} Completa', parcial: '${phIcon('circle-half', { size: 13 })} Parcial', 'sin-acceso': '${phIcon('x', { size: 13 })} Sin acceso' };

  const DEMO = {
    branches: [{ id: 'b1', name: 'Sucursal Centro' }, { id: 'b2', name: 'Sucursal Ituzaingó' }],
    visits: [
      { branch: 'Sucursal Centro', status: 'completa', notes: 'Góndola repuesta, faltante de PRE-001', author: 'Marcela', createdAt: new Date().toISOString() },
      { branch: 'Sucursal Ituzaingó', status: 'sin-acceso', notes: 'Local cerrado por inventario', author: 'Jorge', createdAt: new Date(Date.now() - 86400000).toISOString() },
    ],
  };

  function render(rows) {
    box.innerHTML = App.table(rows, [
      { label: 'Fecha', render: (v) => (v.createdAt || '').slice(0, 16).replace('T', ' ') },
      { key: 'branch', label: 'Sucursal' },
      { key: 'author', label: 'Repositor' },
      { label: 'Estado', render: (v) => STATUS_LABEL[v.status] || v.status },
      { key: 'notes', label: 'Observaciones' },
    ]);
  }

  async function loadTable() {
    if (window.__PREVIEW__) return render(DEMO.visits);
    const b = document.getElementById('vf-branch').value;
    const s = document.getElementById('vf-status').value;
    const q = (b ? '&branchId=' + b : '') + (s ? '&status=' + s : '');
    try { render(await App.api('/api/visits?x=1' + q)); }
    catch (err) { box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; }
  }

  (async () => {
    let mine = DEMO.branches, all = DEMO.branches;
    if (!window.__PREVIEW__) {
      try {
        [mine, all] = await Promise.all([App.api('/api/repositores/my-branches'), App.api('/api/branches').catch(() => [])]);
      } catch (err) { box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; return; }
    }
    // El form ofrece solo las sucursales asignadas; el filtro, todas las visibles
    document.getElementById('vi-branch').innerHTML = App.options(mine, 'id', 'name', 'Sucursal…');
    document.getElementById('vf-branch').innerHTML = App.options(all.length ? all : mine, 'id', 'name', 'Todas las sucursales');
    if (!mine.length) document.getElementById('visit-form-card').innerHTML = '<p class="muted">No tenés sucursales asignadas todavía. Pedile a un administrador que te asigne desde Repositores.</p>';
    loadTable();
  })();

  ['vf-branch', 'vf-status'].forEach(id => document.getElementById(id).addEventListener('change', loadTable));

  const btn = document.getElementById('vi-create');
  if (btn) btn.addEventListener('click', async () => {
    try {
      await App.api('/api/visits', { method: 'POST', body: {
        branchId: document.getElementById('vi-branch').value,
        status: document.getElementById('vi-status').value,
        notes: document.getElementById('vi-notes').value,
      } });
      App.toast('Visita registrada');
      document.getElementById('vi-notes').value = '';
      loadTable();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
})();`,
};
