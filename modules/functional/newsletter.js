module.exports = {
  id: 'newsletter', type: 'functional', name: 'Newsletter',
  description: 'Suscripción por email desde el footer, con validación y control de duplicados.',
  mounts: [{ route: '/api/newsletter', file: 'routes/newsletter.js' }],
  collections: ['subscribers'],
  files: () => ({
    'models/subscriber.js': `const { check, isEmail } = require('../src/validate');

/** Modelo Suscriptor */
exports.validate = (data) => check(data, { email: isEmail });
`,
    'routes/newsletter.js': `const router = require('express').Router();
const db = require('../src/db');
const Subscriber = require('../models/subscriber');

// POST /api/newsletter — alta de suscriptor (idempotente por email)
router.post('/', async (req, res) => {
  const { ok, errors } = Subscriber.validate(req.body);
  if (!ok) return res.status(422).json({ error: 'Email inválido', errors });
  const email = req.body.email.toLowerCase().trim();
  if ((await db.find('subscribers', s => s.email === email)).length) {
    return res.json({ ok: true, message: 'Ya estabas suscripto' });
  }
  (await db.insert('subscribers', { email }));
  res.status(201).json({ ok: true, message: 'Suscripción confirmada' });
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo newsletter (form del footer) */
(function () {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await App.api('/api/newsletter', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      App.toast(r.message || '¡Suscripción confirmada!');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
})();`,
};
