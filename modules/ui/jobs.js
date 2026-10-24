const { esc, txt, txtList } = require('../../src/templates');

// Búsquedas abiertas placeholder; el cliente las edita desde el Builder (o después en
// public/jobs.html, recordando que el título de cada puesto también arma el select del form)
const PUESTOS = [
  { titulo: 'Vendedor/a de salón', modalidad: 'Presencial · Jornada completa', descripcion: 'Atención al cliente en el local, manejo de caja y reposición. Buscamos buena actitud y ganas de aprender; no hace falta experiencia previa.' },
  { titulo: 'Administrativo/a', modalidad: 'Híbrido · Media jornada', descripcion: 'Facturación, seguimiento de pagos a proveedores y atención telefónica. Se valora manejo de planillas de cálculo.' },
  { titulo: 'Repartidor/a con movilidad propia', modalidad: 'Presencial · Por turnos', descripcion: 'Entregas en la zona con moto o auto propio. Combustible a cargo de la empresa y horarios rotativos a convenir.' },
];

// Default del campo editable: exactamente los puestos de arriba, para que el panel arranque
// mostrando lo que la página ya dice.
const PUESTOS_DEFAULT = PUESTOS.map(p => `${p.titulo} | ${p.modalidad} | ${p.descripcion}`).join('\n');

/**
 * Puestos efectivos según la config. Una sola fuente para las tarjetas y para las opciones
 * del select: si se armaran por separado, el visitante podría elegir un puesto que no figura.
 * Formatos por línea: "título | modalidad | descripción", "título | modalidad" o sólo "título".
 */
function puestos(cfg) {
  const filas = txtList(cfg, 'jobs', 'puestos', PUESTOS_DEFAULT);
  if (!filas.length) return PUESTOS;
  return filas.map(fila => {
    const partes = Array.isArray(fila) ? fila : [fila];
    return { titulo: partes[0] || '', modalidad: partes[1] || '', descripcion: partes.slice(2).join(' | ') };
  });
}

module.exports = {
  id: 'jobs', type: 'ui', name: 'Trabajá con nosotros',
  description: 'Página de empleo con búsquedas abiertas y formulario de postulación, con API y persistencia de postulaciones.',
  nav: () => [{ label: 'Empleo', href: '/jobs.html' }],
  mounts: [{ route: '/api/applications', file: 'routes/applications.js' }],
  collections: ['applications'],
  fields: [
    { key: 'titulo', label: 'Título de la página', default: 'Trabajá con nosotros', max: 80 },
    { key: 'bajada', label: 'Bajada', type: 'textarea', default: 'Estas son nuestras búsquedas abiertas. Si ninguna coincide con tu perfil, igual podés postularte de forma espontánea.', max: 220 },
    {
      key: 'puestos', label: 'Búsquedas abiertas', type: 'list', max: 1500, default: PUESTOS_DEFAULT,
      hint: 'Un puesto por línea: título | modalidad | descripción. El título también aparece como opción en el formulario.',
    },
    { key: 'espontanea', label: 'Opción de postulación espontánea', default: 'Postulación espontánea', max: 60 },
    { key: 'formTitulo', label: 'Título del formulario', default: 'Postulate', max: 80 },
    { key: 'formBajada', label: 'Bajada del formulario', type: 'textarea', default: 'Completá tus datos y te contactamos si tu perfil encaja con la búsqueda.', max: 220 },
    { key: 'boton', label: 'Texto del botón', default: 'Enviar postulación', max: 40 },
    { key: 'exito', label: 'Mensaje al enviar', default: '¡Postulación enviada! Te contactamos si tu perfil encaja.', max: 120 },
  ],
  pages: (cfg) => ({
    jobs: {
      title: 'Trabajá con nosotros',
      html: `  <section>
    <div class="container">
      <h2>${esc(txt(cfg, 'jobs', 'titulo', 'Trabajá con nosotros'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'jobs', 'bajada', 'Estas son nuestras búsquedas abiertas. Si ninguna coincide con tu perfil, igual podés postularte de forma espontánea.'))}</p>
      <div class="grid cols-3" style="margin-bottom:40px">
${puestos(cfg).map(p => `        <div class="card">
          <h3 style="margin:0 0 4px">${esc(p.titulo)}</h3>
          <p class="muted" style="margin:0 0 10px;font-size:.85rem">${esc(p.modalidad)}</p>
          <p class="muted" style="margin:0">${esc(p.descripcion)}</p>
        </div>`).join('\n')}
      </div>
      <form id="jobs-form" class="card" style="max-width:640px">
        <h3 style="margin:0 0 4px">${esc(txt(cfg, 'jobs', 'formTitulo', 'Postulate'))}</h3>
        <p class="muted" style="margin:0 0 8px;font-size:.9rem">${esc(txt(cfg, 'jobs', 'formBajada', 'Completá tus datos y te contactamos si tu perfil encaja con la búsqueda.'))}</p>
        <label>Nombre</label><input name="name" required minlength="2" maxlength="80">
        <label>Email</label><input name="email" type="email" required>
        <label>Puesto al que te postulás</label>
        <select name="position" required>
          <option value="">Elegí un puesto</option>
${puestos(cfg).map(p => `          <option>${esc(p.titulo)}</option>`).join('\n')}
          <option>${esc(txt(cfg, 'jobs', 'espontanea', 'Postulación espontánea'))}</option>
        </select>
        <label>Link a tu CV (opcional)</label><input name="cvUrl" type="url" maxlength="300" placeholder="https://… (Drive, LinkedIn, portfolio)">
        <label>Contanos sobre vos</label><textarea name="message" rows="5" required minlength="5" maxlength="2000" placeholder="Experiencia, disponibilidad horaria y por qué te interesa el puesto"></textarea>
        <div style="margin-top:16px"><button class="btn" type="submit">${esc(txt(cfg, 'jobs', 'boton', 'Enviar postulación'))}</button></div>
      </form>
    </div>
  </section>`,
    },
  }),
  files: () => ({
    'models/application.js': `const { check, str, isEmail } = require('../src/validate');

/** Modelo Postulación laboral (el link al CV es opcional pero debe ser http/https) */
exports.validate = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  email: isEmail,
  position: (v) => str(v, 2, 120),
  cvUrl: (v) => v === undefined || v === '' || (str(v, 8, 300) && /^https?:\\/\\//.test(v)),
  message: (v) => str(v, 5, 2000),
});
`,
    'routes/applications.js': `const router = require('express').Router();
const db = require('../src/db');
const Application = require('../models/application');

// POST /api/applications — guarda una postulación laboral
router.post('/', async (req, res) => {
  const { ok, errors } = Application.validate(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const { name, email, position, cvUrl, message } = req.body;
  const saved = await db.insert('applications', { name, email, position, cvUrl: cvUrl || '', message, status: 'nuevo' });
  res.status(201).json({ ok: true, id: saved.id });
});

module.exports = router;
`,
  }),
  // El aviso de éxito viaja adentro de un string de JS: JSON.stringify, no esc()
  clientJs: (cfg) => `/* Módulo trabajá con nosotros */
(function () {
  var form = document.getElementById('jobs-form');
  if (!form) return;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var data = Object.fromEntries(new FormData(form));
    try {
      await App.api('/api/applications', { method: 'POST', body: data });
      form.reset();
      App.toast(${JSON.stringify(txt(cfg, 'jobs', 'exito', '¡Postulación enviada! Te contactamos si tu perfil encaja.'))});
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
})();`,
  readmeNotes: () => [
    '**Trabajá con nosotros**: las búsquedas abiertas salen del campo "Búsquedas abiertas" del Builder (bloque *Textos por sección*); si no las editaste, son placeholders. El mismo campo arma las tarjetas y las `<option>` del formulario, que también se pueden retocar después en `public/jobs.html`. Las postulaciones quedan en la colección `applications`.',
  ],
};
