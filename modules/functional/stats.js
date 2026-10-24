module.exports = {
  id: 'stats', type: 'functional', name: 'Estadísticas de visitas',
  description: 'Contador de visitas por página (sin cookies ni servicios externos) con gráfico de barras en el panel de administración.',
  requires: ['auth'],
  mounts: [{ route: '/api/stats', file: 'routes/stats.js' }],
  collections: ['stats'],
  files: () => ({
    'routes/stats.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

// POST /api/stats/hit — registra una visita (público, anónimo: solo la ruta)
router.post('/hit', async (req, res) => {
  const path = String(req.body.path || '');
  if (!str(path, 1, 100) || !path.startsWith('/')) return res.status(422).json({ error: 'Ruta inválida' });
  const row = (await db.find('stats', s => s.path === path))[0];
  if (row) (await db.update('stats', row.id, { count: row.count + 1 }));
  else (await db.insert('stats', { path, count: 1 }));
  res.status(204).end();
});

// GET /api/stats — totales por página, de mayor a menor (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  res.json((await db.all('stats')).sort((a, b) => b.count - a.count));
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo estadísticas: beacon por página + gráfico en el admin */
(function () {
  // Registrar la visita (nunca en el preview del Builder)
  if (!window.__PREVIEW__) {
    App.api('/api/stats/hit', { method: 'POST', body: { path: location.pathname } }).catch(() => {});
  }

  // Gráfico de barras en el panel admin
  const adminTables = document.getElementById('admin-tables');
  if (!adminTables) return;
  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginTop = '24px';
  card.innerHTML = '<h3>Visitas por página</h3><div id="stats-bars" class="muted">Cargando…</div>';
  adminTables.parentElement.appendChild(card);

  function render(rows) {
    const box = card.querySelector('#stats-bars');
    if (!rows.length) { box.textContent = 'Todavía no hay visitas registradas.'; return; }
    const max = rows[0].count;
    box.innerHTML = rows.map(r =>
      '<div style="margin:8px 0">' +
      '<div style="display:flex;justify-content:space-between;font-size:.85rem"><span>' + r.path + '</span><strong>' + r.count + '</strong></div>' +
      '<div style="background:var(--line);border-radius:4px;height:10px;overflow:hidden">' +
      '<div style="width:' + Math.max(4, Math.round(r.count / max * 100)) + '%;height:100%;background:var(--accent)"></div></div></div>'
    ).join('');
  }
  if (window.__PREVIEW__) {
    render([{ path: '/index.html', count: 128 }, { path: '/catalog.html', count: 74 }, { path: '/contact.html', count: 21 }]);
  } else {
    App.api('/api/stats').then(render).catch(() => { card.style.display = 'none'; });
  }
})();`,
};
