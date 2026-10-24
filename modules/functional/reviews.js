const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'reviews', type: 'functional', name: 'Reseñas con estrellas',
  description: 'Calificaciones de 1 a 5 estrellas por producto, con promedio visible en el catálogo. Una reseña por usuario por producto.',
  requires: ['cart', 'auth'],
  mounts: [{ route: '/api/reviews', file: 'routes/reviews.js' }],
  collections: ['reviews'],
  files: () => ({
    'models/review.js': `const { check, str, num } = require('../src/validate');

/** Modelo Reseña */
exports.validate = (data) => check(data, {
  productId: (v) => str(v, 1, 60),
  rating: (v) => num(v, 1, 5) && Number.isInteger(v),
  text: (v) => str(v, 3, 400),
});
`,
    'routes/reviews.js': `const router = require('express').Router();
const db = require('../src/db');
const Review = require('../models/review');
const { requireAuth } = require('../src/middleware/auth');

// GET /api/reviews/summary — promedio y cantidad por producto
router.get('/summary', async (req, res) => {
  const summary = {};
  for (const r of (await db.all('reviews'))) {
    const s = summary[r.productId] || (summary[r.productId] = { sum: 0, count: 0 });
    s.sum += r.rating; s.count++;
  }
  res.json(Object.fromEntries(Object.entries(summary).map(([id, s]) => [id, { avg: Math.round(s.sum / s.count * 10) / 10, count: s.count }])));
});

// GET /api/reviews/top — mejores reseñas recientes (las consume la sección de testimonios)
router.get('/top', async (req, res) => {
  const top = (await db.all('reviews')).filter(r => r.rating >= 4).slice(-6).reverse();
  res.json(top.map(({ author, rating, text, createdAt }) => ({ author, rating, text, createdAt })));
});

// GET /api/reviews?productId=... — reseñas de un producto
router.get('/', async (req, res) => {
  res.json((await db.find('reviews', r => r.productId === req.query.productId)));
});

// POST /api/reviews — crear reseña (una por usuario por producto)
router.post('/', requireAuth, async (req, res) => {
  const { ok, errors } = Review.validate(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  if (!(await db.get('products', req.body.productId))) return res.status(422).json({ error: 'Producto inexistente' });
  if ((await db.find('reviews', r => r.productId === req.body.productId && r.userId === req.user.sub)).length) {
    return res.status(409).json({ error: 'Ya dejaste una reseña para este producto' });
  }
  const { productId, rating, text } = req.body;
  res.status(201).json((await db.insert('reviews', { productId, rating, text, userId: req.user.sub, author: req.user.name })));
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo reseñas: se engancha a las tarjetas del catálogo sin acoplarse al módulo carrito */
(function () {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  // Glifos Phosphor horneados en build; admite medias estrellas (promedios tipo 4,5)
  const STAR_ON = '${phIcon('star-fill', { size: 15 })}';
  const STAR_HALF = '${phIcon('star-half-fill', { size: 15 })}';
  const STAR_OFF = '${phIcon('star', { size: 15, style: 'opacity:.35' })}';
  const stars = (n) => {
    const v = Math.max(0, Math.min(5, Math.round(n * 2) / 2));
    const llenas = Math.floor(v), media = v % 1 !== 0;
    let out = '';
    for (let i = 0; i < 5; i++) {
      if (i < llenas) out += STAR_ON;
      else if (i === llenas && media) out += STAR_HALF;
      else out += STAR_OFF;
    }
    return '<span style="display:inline-flex;gap:1px;vertical-align:middle">' + out + '</span>';
  };
  let summaryPromise = null;
  const getSummary = () => summaryPromise || (summaryPromise = window.__PREVIEW__
    ? Promise.resolve({ demo1: { avg: 4.5, count: 12 }, demo2: { avg: 5, count: 3 } })
    : App.api('/api/reviews/summary').catch(() => ({})));

  async function enhance() {
    const summary = await getSummary();
    grid.querySelectorAll('[data-add]').forEach(btn => {
      const card = btn.closest('.card');
      if (!card || card.querySelector('.reviews-block')) return;
      const pid = btn.dataset.add;
      const s = summary[pid];
      const block = document.createElement('details');
      block.className = 'reviews-block';
      block.style.cssText = 'margin-top:10px;font-size:.9rem';
      block.innerHTML = '<summary style="cursor:pointer;color:var(--accent)">' +
        (s ? stars(s.avg) + ' ' + s.avg + ' (' + s.count + ')' : 'Sin reseñas todavía') + '</summary>' +
        '<div class="rv-list muted" style="margin-top:8px">…</div>' +
        '<div class="rv-form" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
        '<select class="rv-rating">' + [5, 4, 3, 2, 1].map(n => '<option value="' + n + '">' + stars(n) + '</option>').join('') + '</select>' +
        '<input class="rv-text" placeholder="Tu opinión" style="flex:1;min-width:120px">' +
        '<button class="btn btn-ghost rv-send" type="button">Enviar</button></div>';
      card.appendChild(block);

      block.addEventListener('toggle', async () => {
        if (!block.open) return;
        const listEl = block.querySelector('.rv-list');
        const reviews = window.__PREVIEW__
          ? [{ author: 'María', rating: 5, text: 'Excelente calidad, volvería a comprar.' }, { author: 'Diego', rating: 4, text: 'Muy bueno, llegó rápido.' }]
          : await App.api('/api/reviews?productId=' + encodeURIComponent(pid)).catch(() => []);
        listEl.innerHTML = reviews.length
          ? reviews.map(r => '<div style="padding:4px 0;border-bottom:1px solid var(--line)"><strong>' + r.author + '</strong> ' + stars(r.rating) + '<br>' + r.text.replace(/</g, '&lt;') + '</div>').join('')
          : 'Sé el primero en opinar.';
      });

      block.querySelector('.rv-send').addEventListener('click', async () => {
        if (!localStorage.getItem('token') && !window.__PREVIEW__) { location.href = '/auth.html'; return; }
        try {
          await App.api('/api/reviews', { method: 'POST', body: { productId: pid, rating: Number(block.querySelector('.rv-rating').value), text: block.querySelector('.rv-text').value } });
          App.toast('¡Gracias por tu reseña!');
          block.querySelector('.rv-text').value = '';
          block.open = false; block.open = true;
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }

  new MutationObserver(enhance).observe(grid, { childList: true });
  enhance();
})();`,
};
