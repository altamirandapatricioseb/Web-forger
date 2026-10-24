const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'favorites', type: 'functional', name: 'Favoritos',
  description: 'Lista de deseos por usuario: corazón en cada producto del catálogo y página propia con los guardados.',
  requires: ['cart', 'auth'],
  mounts: [{ route: '/api/favorites', file: 'routes/favorites.js' }],
  collections: ['favorites'],
  nav: () => [{ label: 'Favoritos', href: '/favorites.html' }],
  pages: () => ({
    favorites: {
      title: 'Favoritos',
      html: `  <section>
    <div class="container">
      <h2>Mis favoritos</h2>
      <p class="section-sub">Los productos que guardaste para más adelante.</p>
      <div class="grid cols-3" id="fav-grid"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  files: () => ({
    'routes/favorites.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAuth } = require('../src/middleware/auth');

// GET /api/favorites — productos favoritos del usuario (con datos del catálogo)
router.get('/', requireAuth, async (req, res) => {
  const favs = (await db.find('favorites', f => f.userId === req.user.sub));
  const byId = new Map((await db.all('products')).map(p => [p.id, p]));
  res.json(favs.map(f => byId.get(f.productId)).filter(Boolean));
});

// POST /api/favorites/toggle — agrega o quita un producto
router.post('/toggle', requireAuth, async (req, res) => {
  const { productId } = req.body;
  if (!(await db.get('products', productId))) return res.status(422).json({ error: 'Producto inexistente' });
  const existing = (await db.find('favorites', f => f.userId === req.user.sub && f.productId === productId))[0];
  if (existing) { (await db.remove('favorites', existing.id)); return res.json({ favorited: false }); }
  (await db.insert('favorites', { userId: req.user.sub, productId }));
  res.json({ favorited: true });
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo favoritos: corazón en el catálogo + página propia */
(function () {
  const HEART = { on: '${phIcon('heart-fill', { size: 16 })}', off: '${phIcon('heart', { size: 16 })}' };

  // --- Corazón en cada tarjeta del catálogo ---
  const grid = document.getElementById('product-grid');
  if (grid) {
    let mine = new Set();
    const ready = window.__PREVIEW__
      ? Promise.resolve((mine = new Set(['demo2'])))
      : (localStorage.getItem('token')
        ? App.api('/api/favorites').then(list => { mine = new Set(list.map(p => p.id)); }).catch(() => {})
        : Promise.resolve());

    async function enhance() {
      await ready;
      grid.querySelectorAll('[data-add]').forEach(btn => {
        const card = btn.closest('.card');
        if (!card || card.querySelector('.fav-btn')) return;
        const pid = btn.dataset.add;
        const heart = document.createElement('button');
        heart.className = 'fav-btn';
        heart.type = 'button';
        heart.textContent = mine.has(pid) ? HEART.on : HEART.off;
        heart.style.cssText = 'position:absolute;top:12px;right:12px;background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--accent)';
        card.style.position = 'relative';
        card.appendChild(heart);
        heart.addEventListener('click', async () => {
          if (!localStorage.getItem('token') && !window.__PREVIEW__) { location.href = '/auth.html'; return; }
          if (window.__PREVIEW__) { heart.textContent = heart.textContent === HEART.on ? HEART.off : HEART.on; return; }
          try {
            const r = await App.api('/api/favorites/toggle', { method: 'POST', body: { productId: pid } });
            heart.textContent = r.favorited ? HEART.on : HEART.off;
            App.toast(r.favorited ? 'Agregado a favoritos' : 'Quitado de favoritos');
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }
    new MutationObserver(enhance).observe(grid, { childList: true });
    enhance();
  }

  // --- Página de favoritos ---
  const favGrid = document.getElementById('fav-grid');
  if (!favGrid) return;
  function render(list) {
    if (!list.length) { favGrid.innerHTML = '<p class="muted">Todavía no guardaste nada. Tocá el ${phIcon('heart', { size: 13 })} en el catálogo.</p>'; return; }
    favGrid.innerHTML = list.map(p =>
      '<div class="card"><h3>' + p.name + '</h3><p class="muted">' + (p.description || '') + '</p>' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><span class="price">' + App.money(p.price) + '</span>' +
      '<button class="btn btn-ghost" data-unfav="' + p.id + '" type="button">Quitar ${phIcon('heart-fill', { size: 13 })}</button></div></div>'
    ).join('');
    favGrid.querySelectorAll('[data-unfav]').forEach(b => b.addEventListener('click', async () => {
      try { await App.api('/api/favorites/toggle', { method: 'POST', body: { productId: b.dataset.unfav } }); load(); }
      catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }));
  }
  function load() {
    if (window.__PREVIEW__) return render([{ id: 'demo2', name: 'Producto Premium', price: 9999, description: 'Calidad superior.' }]);
    if (!localStorage.getItem('token')) { favGrid.innerHTML = '<p class="muted">Iniciá sesión para ver tus favoritos. <a href="/auth.html">Ingresar</a></p>'; return; }
    App.api('/api/favorites').then(render).catch(() => favGrid.innerHTML = '<p class="muted">No se pudieron cargar los favoritos.</p>');
  }
  load();
})();`,
};
