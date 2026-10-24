const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'repositores', type: 'functional', name: 'Gestión de repositores',
  description: 'Asignación de repositores (usuarios con ese rol) a sucursales. Cada repositor ve solo sus sucursales asignadas.',
  requires: ['auth', 'branches', 'users-admin'],
  mounts: [{ route: '/api/repositores', file: 'routes/repositores.js' }],
  collections: ['assignments'],
  nav: () => [{ label: 'Repositores', href: '/repositores.html', id: 'nav-repositores' }],
  pages: () => ({
    repositores: {
      title: 'Repositores',
      html: `  <section>
    <div class="container">
      <h2>Repositores</h2>
      <p class="section-sub">Asigná repositores a sucursales. El rol "repositor" se otorga desde Gestión de usuarios.</p>
      <div class="card" style="margin-bottom:24px">
        <h3>Nueva asignación</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select id="as-user" style="flex:1;min-width:180px"></select>
          <select id="as-branch" style="flex:1;min-width:180px"></select>
          <button class="btn" id="as-create" type="button">Asignar</button>
        </div>
      </div>
      <div id="repositores-table"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  files: () => ({
    'routes/repositores.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAdmin, requireRole } = require('../src/middleware/auth');

/** Sucursales asignadas a un usuario */
const branchesOf = async (userId) => {
  const byId = new Map((await db.all('branches')).map(b => [b.id, b]));
  return (await db.find('assignments', a => a.userId === userId)).map(a => byId.get(a.branchId)).filter(Boolean);
};

// GET /api/repositores — repositores con sus sucursales (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  const repositores = (await db.find('users', u => u.role === 'repositor' && u.active !== false));
  const result = [];
  for (const u of repositores) result.push({ id: u.id, name: u.name, email: u.email, branches: await branchesOf(u.id) });
  res.json(result);
});

// GET /api/repositores/my-branches — sucursales del repositor logueado
router.get('/my-branches', requireRole('repositor'), async (req, res) => {
  if (req.user.role === 'admin') return res.json((await db.all('branches')));
  res.json(await branchesOf(req.user.sub));
});

// POST /api/repositores/assign — asigna o desasigna (toggle, solo admin)
router.post('/assign', requireAdmin, async (req, res) => {
  const { userId, branchId } = req.body;
  const user = (await db.get('users', userId));
  if (!user || user.role !== 'repositor') return res.status(422).json({ error: 'El usuario no existe o no tiene rol repositor' });
  if (!(await db.get('branches', branchId))) return res.status(422).json({ error: 'Sucursal inexistente' });
  const existing = (await db.find('assignments', a => a.userId === userId && a.branchId === branchId))[0];
  if (existing) { (await db.remove('assignments', existing.id)); return res.json({ assigned: false }); }
  (await db.insert('assignments', { userId, branchId }));
  res.status(201).json({ assigned: true });
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo repositores */
(function () {
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const nav = document.getElementById('nav-repositores');
  if (nav && (!me || me.role !== 'admin') && !window.__PREVIEW__) nav.style.display = 'none';

  const box = document.getElementById('repositores-table');
  if (!box) return;

  const DEMO = [
    { id: 'r1', name: 'Marcela Ruiz', email: 'marcela@empresa.com', branches: [{ id: 'b1', name: 'Sucursal Centro' }, { id: 'b2', name: 'Sucursal Ituzaingó' }] },
    { id: 'r2', name: 'Jorge Paz', email: 'jorge@empresa.com', branches: [] },
  ];

  function render(list) {
    box.innerHTML = App.table(list, [
      { key: 'name', label: 'Repositor' },
      { key: 'email', label: 'Email' },
      { label: 'Sucursales asignadas', render: (r) => r.branches.length
        ? r.branches.map(b => '<span style="display:inline-block;border:1px solid var(--line);border-radius:20px;padding:2px 10px;margin:2px;font-size:.8rem">' + App.esc(b.name) + ' <a href="#" data-unassign="' + r.id + ':' + b.id + '" title="Quitar">${phIcon('x', { size: 11 })}</a></span>').join('')
        : '<span class="muted">Sin asignaciones</span>' },
    ]);
    box.querySelectorAll('[data-unassign]').forEach(a => a.addEventListener('click', async (e) => {
      e.preventDefault();
      const [userId, branchId] = a.dataset.unassign.split(':');
      try { await App.api('/api/repositores/assign', { method: 'POST', body: { userId, branchId } }); load(); }
      catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }));
  }

  async function load() {
    if (window.__PREVIEW__) {
      render(DEMO);
      document.getElementById('as-user').innerHTML = App.options(DEMO, 'id', 'name', 'Repositor…');
      document.getElementById('as-branch').innerHTML = App.options([{ id: 'b1', name: 'Sucursal Centro' }, { id: 'b2', name: 'Sucursal Ituzaingó' }], 'id', 'name', 'Sucursal…');
      return;
    }
    try {
      const [repositores, branches] = await Promise.all([App.api('/api/repositores'), App.api('/api/branches')]);
      render(repositores);
      document.getElementById('as-user').innerHTML = App.options(repositores, 'id', 'name', 'Repositor…');
      document.getElementById('as-branch').innerHTML = App.options(branches, 'id', 'name', 'Sucursal…');
    } catch (err) { box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; }
  }
  load();

  document.getElementById('as-create').addEventListener('click', async () => {
    try {
      const r = await App.api('/api/repositores/assign', { method: 'POST', body: {
        userId: document.getElementById('as-user').value,
        branchId: document.getElementById('as-branch').value,
      } });
      App.toast(r.assigned ? 'Asignación creada' : 'Asignación quitada');
      load();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
})();`,
};
