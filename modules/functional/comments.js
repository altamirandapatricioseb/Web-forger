module.exports = {
  id: 'comments', type: 'functional', name: 'Comentarios',
  description: 'Comentarios públicos con moderación básica: API REST, modelo y validaciones.',
  mounts: [{ route: '/api/comments', file: 'routes/comments.js' }],
  collections: ['comments'],
  html: () => `  <section id="comentarios" style="background:var(--surface)">
    <div class="container" style="max-width:760px">
      <h2>Comentarios</h2>
      <p class="section-sub">Dejanos tu opinión.</p>
      <form id="comment-form" class="card">
        <label>Nombre</label><input name="author" required maxlength="60">
        <label>Comentario</label><textarea name="text" rows="3" required maxlength="1000"></textarea>
        <div style="margin-top:12px"><button class="btn" type="submit">Publicar</button></div>
      </form>
      <div id="comment-list" style="margin-top:20px"></div>
    </div>
  </section>`,
  files: () => ({
    'models/comment.js': `const { check, str } = require('../src/validate');

/** Modelo Comentario */
exports.validate = (data) => check(data, {
  author: (v) => str(v, 2, 60),
  text: (v) => str(v, 2, 1000),
});
`,
    'routes/comments.js': `const router = require('express').Router();
const db = require('../src/db');
const Comment = require('../models/comment');

// GET /api/comments?resource=home — lista por recurso (default: home)
router.get('/', async (req, res) => {
  const resource = String(req.query.resource || 'home');
  res.json((await db.find('comments', c => c.resource === resource)).slice(-50).reverse());
});

// POST /api/comments
router.post('/', async (req, res) => {
  const { ok, errors } = Comment.validate(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const { author, text } = req.body;
  const resource = String(req.body.resource || 'home');
  res.status(201).json((await db.insert('comments', { author, text, resource })));
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo comentarios */
(function () {
  const list = document.getElementById('comment-list');
  const form = document.getElementById('comment-form');
  if (!list || !form) return;

  const esc = (s) => String(s).replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const render = (rows) => {
    list.innerHTML = rows.length
      ? rows.map(c => '<div class="card" style="margin-bottom:10px"><strong>' + esc(c.author) + '</strong> <span class="muted" style="font-size:.8rem">' + new Date(c.createdAt).toLocaleDateString('es-AR') + '</span><p style="margin:6px 0 0">' + esc(c.text) + '</p></div>').join('')
      : '<p class="muted">Todavía no hay comentarios. ¡Sé el primero!</p>';
  };

  if (!window.__PREVIEW__) App.api('/api/comments').then(render).catch(() => {});
  else render([]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await App.api('/api/comments', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      App.toast('Comentario publicado');
      render(await App.api('/api/comments'));
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
})();`,
};
