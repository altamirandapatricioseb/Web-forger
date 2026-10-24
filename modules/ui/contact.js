const { esc, txt } = require('../../src/templates');

module.exports = {
  id: 'contact', type: 'ui', name: 'Contacto',
  description: 'Página de contacto con formulario, API y persistencia de mensajes.',
  nav: () => [{ label: 'Contacto', href: '/contact.html' }],
  mounts: [{ route: '/api/contact', file: 'routes/contact.js' }],
  collections: ['messages'],
  fields: [
    { key: 'titulo', label: 'Título de la página', default: 'Hablemos', max: 80 },
    { key: 'bajada', label: 'Bajada', type: 'textarea', default: 'Contanos qué necesitás y te respondemos a la brevedad.', max: 220 },
    { key: 'etiquetaNombre', label: 'Etiqueta del campo Nombre', default: 'Nombre', max: 40 },
    { key: 'etiquetaEmail', label: 'Etiqueta del campo Email', default: 'Email', max: 40 },
    { key: 'etiquetaMensaje', label: 'Etiqueta del campo Mensaje', default: 'Mensaje', max: 40 },
    { key: 'boton', label: 'Texto del botón', default: 'Enviar mensaje', max: 40 },
    { key: 'horario', label: 'Horario de atención', default: 'Horario de atención: lunes a viernes, 9 a 18 h.', max: 120 },
    { key: 'exito', label: 'Mensaje al enviar', default: '¡Mensaje enviado! Te respondemos pronto.', max: 120 },
  ],
  pages: (cfg) => ({
    contact: {
      title: 'Contacto',
      html: `  <section>
    <div class="container">
      <h2>${esc(txt(cfg, 'contact', 'titulo', 'Hablemos'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'contact', 'bajada', 'Contanos qué necesitás y te respondemos a la brevedad.'))}</p>
      <div class="grid cols-2">
        <form id="contact-form" class="card">
          <label>${esc(txt(cfg, 'contact', 'etiquetaNombre', 'Nombre'))}</label><input name="name" required maxlength="80">
          <label>${esc(txt(cfg, 'contact', 'etiquetaEmail', 'Email'))}</label><input name="email" type="email" required>
          <label>${esc(txt(cfg, 'contact', 'etiquetaMensaje', 'Mensaje'))}</label><textarea name="message" rows="5" required maxlength="2000"></textarea>
          <div style="margin-top:16px"><button class="btn" type="submit">${esc(txt(cfg, 'contact', 'boton', 'Enviar mensaje'))}</button></div>
        </form>
        <div class="card">
          <h3>${esc(cfg.brand.name)}</h3>
          <p class="muted">${esc(cfg.brand.tagline)}</p>
          <p class="muted">${esc(txt(cfg, 'contact', 'horario', 'Horario de atención: lunes a viernes, 9 a 18 h.'))}</p>
        </div>
      </div>
    </div>
  </section>`,
    },
  }),
  files: () => ({
    'models/message.js': `const { check, str, isEmail } = require('../src/validate');

/** Modelo Mensaje de contacto */
exports.validate = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  email: isEmail,
  message: (v) => str(v, 5, 2000),
});
`,
    'routes/contact.js': `const router = require('express').Router();
const db = require('../src/db');
const Message = require('../models/message');

// POST /api/contact — guarda un mensaje de contacto
router.post('/', async (req, res) => {
  const { ok, errors } = Message.validate(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const { name, email, message } = req.body;
  const saved = (await db.insert('messages', { name, email, message, read: false }));
  res.status(201).json({ ok: true, id: saved.id });
});

module.exports = router;
`,
  }),
  // El aviso de éxito viaja adentro de un string de JS: JSON.stringify, no esc()
  clientJs: (cfg) => `/* Módulo contacto */
(function () {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      await App.api('/api/contact', { method: 'POST', body: data });
      form.reset();
      App.toast(${JSON.stringify(txt(cfg, 'contact', 'exito', '¡Mensaje enviado! Te respondemos pronto.'))});
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
})();`,
};
