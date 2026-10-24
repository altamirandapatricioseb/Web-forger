// Captación de leads centralizada: un endpoint público POST /api/leads donde cualquier
// formulario de captura del sitio puede mandar emails con su origen (waitlist, exitpopup,
// u otros propios), más un panel solo-admin en /leads.html con filtro por origen y
// descarga CSV. Cierra el pendiente de la 15ª/17ª: "waitlist" y "exitpopup" guardaban los
// emails solo en localStorage; con este módulo activo los envían al backend automáticamente
// (la integración vive en esos módulos, condicionada a que "leads" esté en la config).
// El alta es idempotente por email+origen (como newsletter). Requiere auth para el panel;
// el POST es público porque lo usan visitantes anónimos.
module.exports = {
  id: 'leads', type: 'functional', name: 'Captación de leads',
  description: 'Endpoint central para captar emails desde los formularios del sitio (lista de espera, popup de salida u otros) con panel admin: origen de cada lead, filtro y descarga CSV. Requiere autenticación.',
  requires: ['auth'],
  mounts: [{ route: '/api/leads', file: 'routes/leads.js' }],
  collections: ['leads'],
  nav: () => [{ label: 'Leads', href: '/leads.html', id: 'nav-leads' }],
  pages: () => ({
    leads: {
      title: 'Leads',
      html: `  <section>
    <div class="container">
      <h2>Leads captados</h2>
      <p class="section-sub">Emails que dejaron los visitantes en los formularios de captura del sitio, con su origen. Solo visible para administradores.</p>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
        <select id="ld-origen" style="width:auto;min-width:190px"><option value="">Todos los orígenes</option></select>
        <button class="btn ghost" type="button" id="ld-csv">Descargar CSV</button>
      </div>
      <div id="ld-tabla"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  files: () => ({
    'routes/leads.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, isEmail } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

const validar = (data) => check(data, {
  email: isEmail,
  origen: (v) => str(v, 2, 40),
  nota: (v) => v === undefined || str(v, 0, 300),
});

// POST /api/leads — alta pública de un lead (idempotente por email+origen)
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const email = req.body.email.toLowerCase().trim();
  const origen = req.body.origen.toLowerCase().trim();
  if ((await db.find('leads', l => l.email === email && l.origen === origen)).length) {
    return res.json({ ok: true, message: 'Ya estabas anotado' });
  }
  await db.insert('leads', { email, origen, nota: String(req.body.nota || '').trim() });
  res.status(201).json({ ok: true, message: '¡Anotado! Te contactamos pronto.' });
});

// GET /api/leads — listado de más nuevo a más viejo (solo admin; filtro ?origen=)
router.get('/', requireAdmin, async (req, res) => {
  let rows = await db.all('leads');
  if (req.query.origen) rows = rows.filter(l => l.origen === req.query.origen);
  res.json(rows.reverse());
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo captación de leads (panel solo admin): tabla con filtro por origen y CSV.
   Los formularios de captura (waitlist, exitpopup) postean a /api/leads solos cuando
   este módulo está activo. En la vista previa muestra datos de ejemplo. */
(function () {
  // El panel es solo para admins: se oculta el link de la navbar para el resto
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var navLeads = document.getElementById('nav-leads');
  if (navLeads && (!me || me.role !== 'admin') && !window.__PREVIEW__) navLeads.style.display = 'none';

  var tabla = document.getElementById('ld-tabla');
  if (!tabla) return;
  var selOrigen = document.getElementById('ld-origen');
  var todos = [];

  var ETIQUETAS = { createdAt: 'Fecha', email: 'Email', origen: 'Origen', nota: 'Nota' };

  function filtrados() {
    var o = selOrigen && selOrigen.value;
    return o ? todos.filter(function (l) { return l.origen === o; }) : todos;
  }

  function pintar() {
    tabla.innerHTML = App.table(filtrados(), [
      { label: ETIQUETAS.createdAt, render: function (l) { return l.createdAt ? new Date(l.createdAt).toLocaleDateString('es-AR') : '—'; } },
      { key: 'email', label: ETIQUETAS.email },
      { label: ETIQUETAS.origen, render: function (l) { return '<span class="badge" style="vertical-align:baseline">' + App.esc(l.origen || '—') + '</span>'; } },
      { key: 'nota', label: ETIQUETAS.nota },
    ]);
  }

  function pintarOrigenes() {
    if (!selOrigen) return;
    var vistos = {};
    todos.forEach(function (l) { if (l.origen) vistos[l.origen] = true; });
    Object.keys(vistos).sort().forEach(function (o) {
      var op = document.createElement('option');
      op.value = o;
      op.textContent = o;
      selOrigen.appendChild(op);
    });
    selOrigen.addEventListener('change', pintar);
  }

  // Descarga CSV de lo filtrado (separador ; para Excel es-AR, con BOM UTF-8)
  var csvBtn = document.getElementById('ld-csv');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    var claves = ['createdAt', 'email', 'origen', 'nota'];
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [claves.map(function (k) { return celda(ETIQUETAS[k] || k); }).join(';')];
    filtrados().forEach(function (l) {
      lineas.push(claves.map(function (k) { return celda(l[k]); }).join(';'));
    });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'leads-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function listo(rows) { todos = rows; pintarOrigenes(); pintar(); }

  if (window.__PREVIEW__) {
    listo([
      { email: 'sofia@mail.com', origen: 'waitlist', nota: '', createdAt: new Date().toISOString() },
      { email: 'diego@mail.com', origen: 'exitpopup', nota: '', createdAt: new Date().toISOString() },
    ]);
    return;
  }
  if (!me || me.role !== 'admin') { location.href = '/auth.html'; return; }
  App.api('/api/leads').then(listo)
    .catch(function (err) { tabla.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
})();`,
  readmeNotes: (cfg) => [
    `**Captación de leads**: cualquier formulario puede postear \`{ email, origen }\` a \`POST /api/leads\` (público, idempotente por email+origen); los administradores los ven en \`/leads.html\` con filtro por origen y CSV. ${cfg.moduleIds.includes('waitlist') || cfg.moduleIds.includes('exitpopup') ? 'En este proyecto ya postean solos: ' + ['waitlist', 'exitpopup'].filter(id => cfg.moduleIds.includes(id)).map(id => id === 'waitlist' ? 'la lista de espera (origen `waitlist`)' : 'el popup de salida (origen `exitpopup`)').join(' y ') + '.' : 'Activá "Lista de espera" o "Popup de salida" para tener formularios que ya postean solos.'}`,
  ],
};
