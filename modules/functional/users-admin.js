module.exports = {
  id: 'users-admin', type: 'functional', name: 'Gestión de usuarios',
  description: 'Panel para administrar usuarios: cambio de rol (user, repositor, admin) y activación/desactivación con bloqueo de login.',
  requires: ['auth'],
  mounts: [{ route: '/api/users', file: 'routes/users.js' }],
  nav: () => [{ label: 'Usuarios', href: '/users.html', id: 'nav-users' }],
  pages: () => ({
    users: {
      title: 'Usuarios',
      html: `  <section>
    <div class="container">
      <h2>Gestión de usuarios</h2>
      <p class="section-sub">Roles y estado de cada cuenta. Los usuarios desactivados no pueden iniciar sesión.</p>
      <div id="users-table"><p class="muted">Cargando…</p></div>
      <p class="muted" style="font-size:.8rem;margin-top:12px">Los cambios de rol aplican en el próximo inicio de sesión del usuario.</p>
    </div>
  </section>`,
    },
  }),
  files: () => ({
    'routes/users.js': `const router = require('express').Router();
const db = require('../src/db');
const { oneOf } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

const ROLES = ['user', 'repositor', 'admin'];
const safe = ({ passwordHash, ...u }) => u;

// GET /api/users — listado (solo admin)
router.get('/', requireAdmin, async (req, res) => res.json((await db.all('users')).map(safe)));

// PATCH /api/users/:id — cambia rol y/o estado (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const user = (await db.get('users', req.params.id));
  if (!user) return res.status(404).json({ error: 'Usuario inexistente' });
  const patch = {};
  if (req.body.role !== undefined) {
    if (!oneOf(req.body.role, ROLES)) return res.status(422).json({ error: 'Rol inválido', errors: { role: 'Debe ser ' + ROLES.join(', ') } });
    patch.role = req.body.role;
  }
  if (req.body.active !== undefined) {
    if (typeof req.body.active !== 'boolean') return res.status(422).json({ error: 'Estado inválido' });
    if (req.params.id === req.user.sub && req.body.active === false) {
      return res.status(422).json({ error: 'No podés desactivar tu propia cuenta' });
    }
    patch.active = req.body.active;
  }
  res.json(safe((await db.update('users', req.params.id, patch))));
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo gestión de usuarios */
(function () {
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const navUsers = document.getElementById('nav-users');
  if (navUsers && (!me || me.role !== 'admin') && !window.__PREVIEW__) navUsers.style.display = 'none';

  const box = document.getElementById('users-table');
  if (!box) return;
  const ROLES = ['user', 'repositor', 'admin'];

  function render(users) {
    box.innerHTML = App.table(users, [
      { key: 'name', label: 'Nombre' },
      { key: 'email', label: 'Email' },
      { label: 'Rol', render: (u) => '<select data-role="' + u.id + '" style="width:auto">' + ROLES.map(r => '<option' + (u.role === r ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>' },
      { label: 'Estado', render: (u) => u.active === false ? '<span style="color:#b91c1c">Desactivado</span>' : 'Activo' },
      { label: '', render: (u) => '<button class="btn btn-ghost" data-toggle="' + u.id + '" data-next="' + (u.active === false) + '" type="button">' + (u.active === false ? 'Activar' : 'Desactivar') + '</button>' },
    ]);
    box.querySelectorAll('[data-role]').forEach(s => s.addEventListener('change', async () => {
      try { await App.api('/api/users/' + s.dataset.role, { method: 'PATCH', body: { role: s.value } }); App.toast('Rol actualizado'); }
      catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }));
    box.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      try { await App.api('/api/users/' + b.dataset.toggle, { method: 'PATCH', body: { active: b.dataset.next === 'true' } }); load(); }
      catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }));
  }

  function load() {
    if (window.__PREVIEW__) return render([
      { id: '1', name: 'Patricio', email: 'admin@empresa.com', role: 'admin', active: true },
      { id: '2', name: 'Marcela Ruiz', email: 'marcela@empresa.com', role: 'repositor', active: true },
      { id: '3', name: 'Ex empleado', email: 'viejo@empresa.com', role: 'user', active: false },
    ]);
    App.api('/api/users').then(render).catch(err => box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>');
  }
  load();
})();`,
};
