// Club de socios / membresías: el visitante se asocia desde /socios.html eligiendo un plan
// (nombre + precio + período, de la constante PLANES) y deja sus datos; el sistema genera un número
// de socio único SOC-XXXXXX y deja la solicitud en estado "pendiente". Después puede consultar el
// estado de su membresía por número de socio (Pendiente / Activo / Suspendido / Baja) con una
// animación de aparición del número (Anime.js + red de seguridad setTimeout + respeta
// "prefers-reduced-motion"). La vista pública no expone email ni teléfono. Con auth activo, la misma
// página suma un panel solo-admin para activar/suspender/dar de baja socios, filtrar por plan/estado
// y exportar CSV. Sin auth las altas se guardan igual y se consultan por número; la gestión queda
// deshabilitada y se avisa en el README. Distinto de "auth" (login de usuarios del sistema) y de
// "newsletter" (suscripción a emails): acá se administra una membresía con plan y estado.
const PLANES = [
  { id: 'basico', name: 'Básico', price: 2000, period: 'por mes' },
  { id: 'pleno', name: 'Pleno', price: 4500, period: 'por mes' },
  { id: 'anual', name: 'Anual', price: 40000, period: 'por año' },
];

module.exports = {
  id: 'membership', type: 'functional', name: 'Club de socios',
  description: 'Membresías con planes: el visitante se asocia eligiendo un plan y recibe un número de socio único; consulta el estado (pendiente/activo/suspendido/baja) por número. Con auth activo, panel admin en /socios.html para activar/suspender/dar de baja, filtrar y CSV.',
  usesAnime: true,
  mounts: [{ route: '/api/membership', file: 'routes/membership.js' }],
  collections: ['members'],
  nav: () => [{ label: 'Socios', href: '/socios.html' }],
  pages: (cfg) => ({
    socios: {
      title: 'Club de socios',
      html: `  <section>
    <div class="container">
      <h2>Hacete socio</h2>
      <p class="section-sub">Elegí tu plan, sumate al club y disfrutá los beneficios.</p>
      <div class="ms-planes" id="ms-planes">${PLANES.map((p, i) => `<label class="ms-plan${i === 1 ? ' on' : ''}"><input type="radio" name="planpick" value="${p.id}"${i === 1 ? ' checked' : ''} style="display:none"><span class="ms-plan-name">${p.name}</span><span class="ms-plan-price">$${p.price.toLocaleString('es-AR')}</span><span class="ms-plan-period">${p.period}</span></label>`).join('')}</div>
      <div class="grid cols-2" style="margin-top:20px">
        <form id="ms-form" class="card">
          <h3>Tus datos</h3>
          <label>Nombre y apellido</label><input name="name" required maxlength="80">
          <label>Email</label><input name="email" type="email" required>
          <label>Teléfono (opcional)</label><input name="phone" maxlength="30" placeholder="+54 …">
          <input type="hidden" name="plan" value="${PLANES[1].id}">
          <div style="margin-top:16px"><button class="btn" type="submit">Asociarme</button></div>
        </form>
        <div>
          <div class="card ms-nuevo" id="ms-nuevo" hidden style="margin-bottom:20px">
            <h3>¡Bienvenido/a al club!</h3>
            <p class="muted" style="margin:0 0 6px">Tu número de socio es:</p>
            <div class="ms-num" id="ms-num-nuevo">—</div>
            <p class="muted" style="margin:10px 0 0">Guardalo para consultar el estado de tu membresía.</p>
          </div>
          <div class="card">
            <h3>Consultar mi membresía</h3>
            <label for="ms-buscar">Número de socio</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input id="ms-buscar" placeholder="SOC-XXXXXX" style="flex:1;min-width:150px;text-transform:uppercase">
              <button class="btn" type="button" id="ms-buscar-btn" style="width:auto">Consultar</button>
            </div>
            <div id="ms-estado"></div>
          </div>
        </div>
      </div>${cfg.moduleIds.includes('auth') ? `
      <div id="ms-admin" hidden style="margin-top:40px">
        <h3>Socios <span class="muted" style="font-weight:400;font-size:.85rem">(solo administradores)</span></h3>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
          <select id="ms-filtro-plan" style="width:auto;min-width:150px"><option value="">Todos los planes</option>${PLANES.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
          <select id="ms-filtro-estado" style="width:auto;min-width:150px"><option value="">Todos los estados</option><option value="pendiente">Pendiente</option><option value="activo">Activo</option><option value="suspendido">Suspendido</option><option value="baja">Baja</option></select>
          <button class="btn ghost" type="button" id="ms-csv">Descargar CSV</button>
        </div>
        <div id="ms-admin-tabla"><p class="muted">Cargando…</p></div>
      </div>` : ''}
    </div>
  </section>`,
    },
  }),
  head: () => `  <style>
    .ms-planes{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
    .ms-plan{display:flex;flex-direction:column;gap:2px;padding:18px;border:1.5px solid var(--line);border-radius:var(--radius);cursor:pointer;background:var(--surface);transition:border-color .2s ease,box-shadow .2s ease}
    .ms-plan:hover{border-color:var(--accent)}
    .ms-plan.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
    .ms-plan-name{font-weight:700;font-size:1.1rem}
    .ms-plan-price{font-size:1.6rem;font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums}
    .ms-plan-period{font-size:.8rem;color:var(--muted)}
    .ms-num{font-family:ui-monospace,'Cascadia Code',monospace;font-size:1.4rem;font-weight:800;letter-spacing:.08em;color:var(--accent);background:var(--surface);border:1px dashed var(--accent);border-radius:var(--radius);padding:10px 14px;text-align:center}
    .ms-estadobox{margin-top:16px}
    .ms-chip{display:inline-block;font-size:.78rem;font-weight:700;padding:3px 10px;border-radius:999px;color:#fff}
    .ms-pendiente{background:#d97706}
    .ms-activo{background:#16a34a}
    .ms-suspendido{background:#6b7280}
    .ms-baja{background:#dc2626}
  </style>`,
  files: (cfg) => ({
    'routes/membership.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, oneOf } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
const PLANES = ${JSON.stringify(PLANES)};
const PLAN_IDS = PLANES.map(p => p.id);
const ESTADOS = ['pendiente', 'activo', 'suspendido', 'baja'];

// Genera un número de socio único con formato SOC-XXXXXX
async function numeroUnico() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let intento = 0; intento < 20; intento++) {
    let s = '';
    for (let i = 0; i < 6; i++) s += alfabeto[Math.floor(Math.random() * alfabeto.length)];
    const num = 'SOC-' + s;
    if (!(await db.find('members', m => m.number === num)).length) return num;
  }
  return 'SOC-' + Date.now().toString(36).toUpperCase().slice(-6);
}

const planDe = (id) => PLANES.find(p => p.id === id) || null;

// Vista pública: sin email ni teléfono, solo lo que el socio necesita ver
const publica = (m) => { const p = planDe(m.plan); return { number: m.number, planName: p ? p.name : m.plan, status: m.status }; };

const validar = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  email: (v) => typeof v === 'string' && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v),
  phone: (v) => v === undefined || v === null || v === '' || (typeof v === 'string' && v.length <= 30),
  plan: (v) => oneOf(v, PLAN_IDS),
});

// GET /api/membership/planes — planes disponibles (público)
router.get('/planes', (req, res) => res.json(PLANES));

// POST /api/membership — alta de socio, devuelve el número (estado inicial: pendiente)
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos (revisá el plan elegido)', errors });
  const number = await numeroUnico();
  const row = await db.insert('members', {
    number,
    name: req.body.name.trim(),
    email: req.body.email.toLowerCase().trim(),
    phone: (req.body.phone || '').trim(),
    plan: req.body.plan,
    status: 'pendiente',
  });
  res.status(201).json(publica(row));
});

// GET /api/membership/consulta/:number — estado público por número de socio
router.get('/consulta/:number', async (req, res) => {
  const number = String(req.params.number || '').trim().toUpperCase();
  const m = (await db.find('members', x => x.number === number))[0];
  if (!m) return res.status(404).json({ error: 'No encontramos un socio con ese número' });
  res.json(publica(m));
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/membership — todos los socios (solo admin; filtros ?plan= y ?status=)
router.get('/', requireAdmin, async (req, res) => {
  let rows = await db.all('members');
  if (PLAN_IDS.includes(req.query.plan)) rows = rows.filter(m => m.plan === req.query.plan);
  if (ESTADOS.includes(req.query.status)) rows = rows.filter(m => m.status === req.query.status);
  res.json(rows.reverse());
});

// PATCH /api/membership/:id — cambia el estado del socio (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  if (!oneOf(req.body.status, ESTADOS)) return res.status(422).json({ error: 'Estado inválido', errors: { status: 'Uno de: ' + ESTADOS.join(', ') } });
  const row = await db.update('members', req.params.id, { status: req.body.status });
  if (!row) return res.status(404).json({ error: 'Socio inexistente' });
  res.json(row);
});
` : `// La gestión de socios (listar todos, cambiar estado) requiere el módulo de autenticación:
// activalo en el Builder para habilitar el panel de administración.
`}
module.exports = router;
`,
  }),
  clientJs: (cfg) => `/* Módulo club de socios: alta con número único, consulta de estado por número (aparición animada
   con Anime.js + red de seguridad) y, con auth activo, panel de gestión solo-admin. En la vista
   previa del Builder simula la API. */
(function () {
  var form = document.getElementById('ms-form');
  var estadoBox = document.getElementById('ms-estado');
  if (!form && !estadoBox) return;
  var LABELS = { pendiente: 'Pendiente', activo: 'Activo', suspendido: 'Suspendido', baja: 'Baja' };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Selector visual de planes (sincroniza el hidden del form)
  var planes = document.getElementById('ms-planes');
  var inputPlan = form && form.querySelector('[name="plan"]');
  if (planes) planes.addEventListener('click', function (e) {
    var lab = e.target.closest('.ms-plan');
    if (!lab) return;
    planes.querySelectorAll('.ms-plan').forEach(function (x) { x.classList.toggle('on', x === lab); });
    var radio = lab.querySelector('input');
    if (radio && inputPlan) inputPlan.value = radio.value;
  });

  function revelarNumero(el) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) return;
    anime.animate(el, { opacity: [0, 1], scale: [0.9, 1], duration: 500, ease: 'outBack' });
    setTimeout(function () { el.style.opacity = 1; el.style.transform = 'none'; }, 700);
  }

  function mostrarNuevo(r) {
    var box = document.getElementById('ms-nuevo');
    var num = document.getElementById('ms-num-nuevo');
    if (num) num.textContent = r.number || '—';
    if (box) box.hidden = false;
    revelarNumero(num);
    var buscar = document.getElementById('ms-buscar');
    if (buscar) buscar.value = r.number || '';
  }

  // Alta de socio
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = Object.fromEntries(new FormData(form));
    if (window.__PREVIEW__) { mostrarNuevo({ number: 'SOC-DEMO01' }); form.reset(); return; }
    try {
      var r = await App.api('/api/membership', { method: 'POST', body: body });
      form.reset();
      mostrarNuevo(r);
      App.toast('¡Ya sos socio! Te contactaremos para activar tu membresía.');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  // Consulta por número de socio
  var buscarInput = document.getElementById('ms-buscar');
  var buscarBtn = document.getElementById('ms-buscar-btn');
  async function buscar() {
    var number = (buscarInput && buscarInput.value || '').trim().toUpperCase();
    if (!number) { App.toast('Ingresá tu número de socio'); return; }
    if (window.__PREVIEW__) { pintarEstado({ number: number, planName: 'Pleno', status: 'activo' }); return; }
    try { pintarEstado(await App.api('/api/membership/consulta/' + encodeURIComponent(number))); }
    catch (err) { if (err.message !== 'preview' && estadoBox) estadoBox.innerHTML = '<p class="muted" style="margin:12px 0 0">' + App.esc(err.message) + '</p>'; }
  }
  if (buscarBtn) buscarBtn.addEventListener('click', buscar);
  if (buscarInput) buscarInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });

  function pintarEstado(r) {
    if (!estadoBox) return;
    estadoBox.innerHTML =
      '<div class="ms-estadobox">' +
      '<p style="margin:0 0 4px"><strong style="font-family:ui-monospace,monospace">' + App.esc(r.number) + '</strong> <span class="ms-chip ms-' + r.status + '">' + (LABELS[r.status] || r.status) + '</span></p>' +
      '<p class="muted" style="margin:0">Plan: <strong>' + App.esc(r.planName) + '</strong></p>' +
      '</div>';
  }
${cfg.moduleIds.includes('auth') ? `
  // Panel de gestión (solo admin): tabla con cambio de estado por socio
  var adminBox = document.getElementById('ms-admin');
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var filasAdmin = [];
  var PLANES = ${JSON.stringify(PLANES)};
  var planName = function (id) { var p = PLANES.filter(function (x) { return x.id === id; })[0]; return p ? p.name : id; };
  if (adminBox && ((me && me.role === 'admin') || window.__PREVIEW__)) { adminBox.hidden = false; cargarAdmin(); }
  var fPlan = document.getElementById('ms-filtro-plan');
  var fEstado = document.getElementById('ms-filtro-estado');
  if (fPlan) fPlan.addEventListener('change', cargarAdmin);
  if (fEstado) fEstado.addEventListener('change', cargarAdmin);

  async function cargarAdmin() {
    var cont = document.getElementById('ms-admin-tabla');
    if (!cont) return;
    if (window.__PREVIEW__) {
      filasAdmin = [
        { id: '1', number: 'SOC-ABC123', name: 'Ana Ruiz', email: 'ana@mail.com', phone: '+54 11 5555', plan: 'pleno', status: 'activo', createdAt: new Date().toISOString() },
        { id: '2', number: 'SOC-XYZ789', name: 'Beto Paz', email: 'beto@mail.com', phone: '', plan: 'basico', status: 'pendiente', createdAt: new Date().toISOString() },
      ];
    } else {
      var qs = [];
      if (fPlan && fPlan.value) qs.push('plan=' + encodeURIComponent(fPlan.value));
      if (fEstado && fEstado.value) qs.push('status=' + encodeURIComponent(fEstado.value));
      try { filasAdmin = await App.api('/api/membership' + (qs.length ? '?' + qs.join('&') : '')); }
      catch (err) { if (err.message !== 'preview') cont.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; return; }
    }
    cont.innerHTML = App.table(filasAdmin, [
      { label: 'Socio', render: function (r) { return '<strong style="font-family:ui-monospace,monospace">' + App.esc(r.number) + '</strong>'; } },
      { label: 'Nombre', render: function (r) { return App.esc(r.name); } },
      { label: 'Contacto', render: function (r) { return '<span class="muted">' + App.esc(r.email) + (r.phone ? '<br>' + App.esc(r.phone) : '') + '</span>'; } },
      { label: 'Plan', render: function (r) { return planName(r.plan); } },
      { label: 'Estado', render: function (r) {
        var opts = ['pendiente', 'activo', 'suspendido', 'baja'].map(function (s) { return '<option value="' + s + '"' + (r.status === s ? ' selected' : '') + '>' + LABELS[s] + '</option>'; }).join('');
        return '<select data-ms-estado="' + r.id + '" style="width:auto;min-width:130px">' + opts + '</select>';
      } },
    ]);
    cont.querySelectorAll('[data-ms-estado]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        var id = sel.getAttribute('data-ms-estado');
        if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría el estado'); return; }
        try {
          await App.api('/api/membership/' + id, { method: 'PATCH', body: { status: sel.value } });
          var f = filasAdmin.filter(function (x) { return x.id === id; })[0];
          if (f) f.status = sel.value;
          App.toast('Socio actualizado');
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }

  var csvBtn = document.getElementById('ms-csv');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    var ET = { createdAt: 'Alta', number: 'Nº socio', name: 'Nombre', email: 'Email', phone: 'Teléfono', plan: 'Plan', status: 'Estado' };
    var claves = ['createdAt', 'number', 'name', 'email', 'phone', 'plan', 'status'];
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [claves.map(function (k) { return celda(ET[k] || k); }).join(';')];
    filasAdmin.forEach(function (r) { lineas.push(claves.map(function (k) {
      if (k === 'plan') return celda(planName(r[k]));
      if (k === 'status') return celda(LABELS[r[k]] || r[k]);
      if (k === 'createdAt') return celda(r[k] ? new Date(r[k]).toLocaleDateString('es-AR') : '');
      return celda(r[k]);
    }).join(';')); });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'socios-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Club de socios**: las altas se guardan en la colección \`members\` con un número único \`SOC-XXXXXX\` y estado inicial \`pendiente\`. Los planes se definen en \`routes/membership.js\` (constante \`PLANES\`) y también en el HTML de la página; si cambiás precios, actualizá ambos. La consulta pública por número no expone email ni teléfono. ${cfg.moduleIds.includes('auth') ? 'Los administradores activan/suspenden/dan de baja socios, filtran por plan y estado, y exportan el CSV desde \`/socios.html\`.' : 'Para gestionar los socios (cambiar estados) activá el módulo **Autenticación** en el Builder; sin él, las altas quedan guardadas y solo se consultan por número.'}`,
  ],
};
