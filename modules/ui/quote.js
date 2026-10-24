const { esc, txt, txtList } = require('../../src/templates');

// Opciones placeholder de los selects; el cliente las edita desde el Builder (o después
// en public/quote.html).
const SERVICIOS = ['Compra de productos', 'Contratación de un servicio', 'Proyecto a medida', 'Otro'];
const PRESUPUESTOS = ['Hasta $100.000', 'Entre $100.000 y $500.000', 'Más de $500.000', 'A definir'];
const PASOS = ['1 · Tus datos', '2 · Tu proyecto', '3 · Confirmar'];

// Una línea = una opción. Se aplana a texto plano porque txtList parte por "|" y acá
// no hay columnas: una opción con "|" adentro vuelve a unirse tal cual la escribieron.
const lineas = (cfg, key, def) => txtList(cfg, 'quote', key, def)
  .map(l => Array.isArray(l) ? l.join(' | ') : l);

module.exports = {
  id: 'quote', type: 'ui', name: 'Pedido de presupuesto',
  description: 'Página con formulario multipaso (wizard de 3 pasos con validación por paso), API y persistencia de pedidos de presupuesto.',
  nav: () => [{ label: 'Presupuesto', href: '/quote.html' }],
  mounts: [{ route: '/api/quotes', file: 'routes/quotes.js' }],
  collections: ['quotes'],
  fields: [
    { key: 'titulo', label: 'Título de la página', default: 'Pedí tu presupuesto', max: 80 },
    { key: 'bajada', label: 'Bajada', type: 'textarea', default: 'Contanos qué necesitás en tres pasos y te enviamos una propuesta sin compromiso.', max: 220 },
    { key: 'pasos', label: 'Nombres de los pasos', type: 'list', default: PASOS.join('\n'), max: 160, hint: 'Tres líneas: el formulario tiene tres pasos.' },
    { key: 'servicios', label: 'Opciones de "Qué necesitás"', type: 'list', default: SERVICIOS.join('\n'), max: 600, hint: 'Una opción por línea.' },
    { key: 'presupuestos', label: 'Rangos de presupuesto', type: 'list', default: PRESUPUESTOS.join('\n'), max: 600, hint: 'Un rango por línea.' },
    { key: 'resumenTitulo', label: 'Título del paso de confirmación', default: 'Revisá tu pedido', max: 80 },
    { key: 'botonAtras', label: 'Texto del botón Atrás', default: 'Atrás', max: 40 },
    { key: 'botonSiguiente', label: 'Texto del botón Siguiente', default: 'Siguiente', max: 40 },
    { key: 'botonEnviar', label: 'Texto del botón de envío', default: 'Enviar pedido', max: 40 },
    { key: 'exito', label: 'Mensaje al enviar', default: '¡Pedido enviado! Te contactamos con la propuesta.', max: 120 },
  ],
  pages: (cfg) => ({
    quote: {
      title: 'Presupuesto',
      html: `  <section>
    <div class="container">
      <h2>${esc(txt(cfg, 'quote', 'titulo', 'Pedí tu presupuesto'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'quote', 'bajada', 'Contanos qué necesitás en tres pasos y te enviamos una propuesta sin compromiso.'))}</p>
      <form id="quote-form" class="card" style="max-width:640px" novalidate>
        <ol id="quote-pasos" style="display:flex;gap:6px;list-style:none;padding:0;margin:0 0 22px;font-size:.85rem">
${lineas(cfg, 'pasos', PASOS.join('\n')).map(p => `          <li style="flex:1;text-align:center;padding:7px 4px;border-radius:var(--radius);border:1px solid var(--line)">${esc(p)}</li>`).join('\n')}
        </ol>
        <fieldset data-paso="1" style="border:0;padding:0;margin:0">
          <label>Nombre</label><input name="name" required minlength="2" maxlength="80">
          <label>Email</label><input name="email" type="email" required>
          <label>Teléfono (opcional)</label><input name="phone" maxlength="40">
        </fieldset>
        <fieldset data-paso="2" hidden style="border:0;padding:0;margin:0">
          <label>Qué necesitás</label>
          <select name="service" required>
            <option value="">Elegí una opción</option>
${lineas(cfg, 'servicios', SERVICIOS.join('\n')).map(s => `            <option>${esc(s)}</option>`).join('\n')}
          </select>
          <label>Presupuesto estimado</label>
          <select name="budget" required>
            <option value="">Elegí un rango</option>
${lineas(cfg, 'presupuestos', PRESUPUESTOS.join('\n')).map(p => `            <option>${esc(p)}</option>`).join('\n')}
          </select>
          <label>Contanos más</label><textarea name="details" rows="5" required minlength="5" maxlength="2000" placeholder="Qué necesitás, para cuándo y todo detalle que sume"></textarea>
        </fieldset>
        <fieldset data-paso="3" hidden style="border:0;padding:0;margin:0">
          <h3 style="margin:0 0 10px">${esc(txt(cfg, 'quote', 'resumenTitulo', 'Revisá tu pedido'))}</h3>
          <div id="quote-resumen" class="muted"></div>
        </fieldset>
        <div style="display:flex;justify-content:space-between;gap:10px;margin-top:20px">
          <button type="button" class="btn ghost" id="quote-prev" hidden>${esc(txt(cfg, 'quote', 'botonAtras', 'Atrás'))}</button>
          <span style="flex:1"></span>
          <button type="button" class="btn" id="quote-next">${esc(txt(cfg, 'quote', 'botonSiguiente', 'Siguiente'))}</button>
          <button type="submit" class="btn" id="quote-send" hidden>${esc(txt(cfg, 'quote', 'botonEnviar', 'Enviar pedido'))}</button>
        </div>
      </form>
    </div>
  </section>`,
    },
  }),
  files: (cfg) => ({
    'models/quote.js': `const { check, str, isEmail } = require('../src/validate');

/** Modelo Pedido de presupuesto (el teléfono es opcional) */
exports.validate = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  email: isEmail,
  phone: (v) => v === undefined || v === '' || str(v, 6, 40),
  service: (v) => str(v, 2, 80),
  budget: (v) => str(v, 2, 80),
  details: (v) => str(v, 5, 2000),
});
`,
    'routes/quotes.js': `const router = require('express').Router();
const db = require('../src/db');
const Quote = require('../models/quote');
${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
// POST /api/quotes — guarda un pedido de presupuesto
router.post('/', async (req, res) => {
  const { ok, errors } = Quote.validate(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const { name, email, phone, service, budget, details } = req.body;
  const saved = await db.insert('quotes', { name, email, phone: phone || '', service, budget, details, status: 'nuevo' });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): entró un pedido de presupuesto.
  // Es "disparar y seguir": un email caído jamás rompe el alta del pedido.
  mailer.notify('Nuevo pedido de presupuesto: ' + saved.service, saved.name + ' (' + saved.email + (saved.phone ? ', tel. ' + saved.phone : '') + ') pidió presupuesto por "' + saved.service + '" con presupuesto estimado "' + saved.budget + '". Detalle: ' + String(saved.details).slice(0, 300) + '. Cotizalo desde el panel de presupuestos.').catch(() => {});
` : ''}  res.status(201).json({ ok: true, id: saved.id });
});

module.exports = router;
`,
  }),
  // El aviso de éxito viaja adentro de un string de JS: JSON.stringify, no esc()
  clientJs: (cfg) => `/* Módulo pedido de presupuesto: wizard de 3 pasos con validación por paso.
   Enter avanza de paso (no envía) hasta llegar a la confirmación. */
(function () {
  var form = document.getElementById('quote-form');
  if (!form) return;
  var pasos = form.querySelectorAll('fieldset[data-paso]');
  var marcas = document.querySelectorAll('#quote-pasos li');
  var prev = document.getElementById('quote-prev');
  var next = document.getElementById('quote-next');
  var send = document.getElementById('quote-send');
  var resumen = document.getElementById('quote-resumen');
  var actual = 0;
  // Valida solo los campos del paso visible usando la validación nativa del navegador
  function validaPaso() {
    var campos = pasos[actual].querySelectorAll('input, select, textarea');
    for (var i = 0; i < campos.length; i++) {
      if (!campos[i].reportValidity()) return false;
    }
    return true;
  }
  function etiqueta(name) {
    var campo = form.querySelector('[name="' + name + '"]');
    var lbl = campo && campo.previousElementSibling;
    return lbl ? lbl.textContent : name;
  }
  function armarResumen() {
    var data = new FormData(form);
    var filas = [];
    ['name', 'email', 'phone', 'service', 'budget', 'details'].forEach(function (k) {
      var v = String(data.get(k) || '').trim();
      if (v) filas.push('<div style="padding:6px 0;border-bottom:1px solid var(--line)"><strong>' + App.esc(etiqueta(k)) + ':</strong> ' + App.esc(v) + '</div>');
    });
    resumen.innerHTML = filas.join('');
  }
  function mostrar() {
    Array.prototype.forEach.call(pasos, function (p, i) { p.hidden = i !== actual; });
    Array.prototype.forEach.call(marcas, function (m, i) {
      var activo = i === actual;
      m.style.borderColor = i <= actual ? 'var(--accent)' : 'var(--line)';
      m.style.fontWeight = activo ? '700' : '';
      m.style.color = i <= actual ? 'var(--accent)' : 'var(--muted)';
      if (activo) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current');
    });
    prev.hidden = actual === 0;
    next.hidden = actual === pasos.length - 1;
    send.hidden = actual !== pasos.length - 1;
    if (actual === pasos.length - 1) armarResumen();
  }
  next.addEventListener('click', function () {
    if (!validaPaso()) return;
    actual++;
    mostrar();
  });
  prev.addEventListener('click', function () {
    actual--;
    mostrar();
  });
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    // Enter en un paso intermedio avanza en lugar de enviar
    if (actual < pasos.length - 1) { next.click(); return; }
    var data = Object.fromEntries(new FormData(form));
    try {
      await App.api('/api/quotes', { method: 'POST', body: data });
      form.reset();
      actual = 0;
      mostrar();
      App.toast(${JSON.stringify(txt(cfg, 'quote', 'exito', '¡Pedido enviado! Te contactamos con la propuesta.'))});
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
  mostrar();
})();`,
  readmeNotes: () => [
    '**Pedido de presupuesto**: las opciones de "Qué necesitás", los rangos de presupuesto, los nombres de los pasos y los textos de los botones salen del Builder (bloque *Textos por sección*); si no los editaste, son placeholders. También se pueden cambiar después en `public/quote.html`. Los pedidos quedan en la colección `quotes`.',
  ],
};
