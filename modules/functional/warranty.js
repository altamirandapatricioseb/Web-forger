// Registro de garantía: el cliente registra un producto comprado desde /garantia.html
// (nombre, email, producto, número de serie y fecha de compra) y el sistema calcula la fecha de
// fin de cobertura (fecha de compra + MESES de garantía). Después puede consultar el estado de su
// garantía por número de serie (Vigente / Vencida / Reclamada), con una barra de tiempo
// transcurrido animada con Anime.js (red de seguridad setTimeout + respeta
// "prefers-reduced-motion"). El número de serie es único (no se registra dos veces). Con auth
// activo, la misma página suma un panel solo-admin con todos los registros, marcado de "reclamada"
// con nota y CSV. Sin auth el registro se guarda igual y se consulta por serie; la gestión queda
// deshabilitada y se avisa en el README. Distinto de "returns" (devolución de un producto) y de
// "ordertrack" (seguimiento de un pedido): acá se registra la cobertura de un producto ya comprado.
const MESES = 12; // Meses de cobertura por defecto (editable)

module.exports = {
  id: 'warranty', type: 'functional', name: 'Registro de garantía',
  description: 'Registro de garantía: el cliente registra un producto (serie + fecha de compra), el sistema calcula el fin de cobertura y permite consultar el estado (Vigente/Vencida/Reclamada) con una barra de tiempo animada (Anime.js). Con auth activo, panel admin con todos los registros, marcado de "reclamada" y CSV.',
  usesAnime: true,
  mounts: [{ route: '/api/warranty', file: 'routes/warranty.js' }],
  collections: ['warranties'],
  nav: () => [{ label: 'Garantía', href: '/garantia.html' }],
  pages: (cfg) => ({
    garantia: {
      title: 'Registro de garantía',
      html: `  <section>
    <div class="container">
      <h2>Registrá tu garantía</h2>
      <p class="section-sub">Registrá tu producto para activar la garantía y consultá el estado cuando quieras.</p>
      <div class="grid cols-2">
        <form id="wr-form" class="card">
          <h3>Registrar un producto</h3>
          <label>Nombre</label><input name="name" required maxlength="80">
          <label>Email</label><input name="email" type="email" required>
          <label>Producto</label><input name="product" required maxlength="120" placeholder="Modelo del producto">
          <label>Número de serie</label><input name="serial" required maxlength="60" placeholder="El que figura en el producto o su caja" style="text-transform:uppercase">
          <label>Fecha de compra</label><input name="purchaseDate" type="date" required>
          <div style="margin-top:16px"><button class="btn" type="submit">Activar garantía</button></div>
        </form>
        <div>
          <div class="card" id="wr-nuevo" hidden style="margin-bottom:20px">
            <h3>¡Garantía activada!</h3>
            <p class="muted" style="margin:0">Tu cobertura vence el <strong id="wr-vence-nuevo">—</strong>.</p>
          </div>
          <div class="card">
            <h3>Consultá tu garantía</h3>
            <label for="wr-buscar">Número de serie</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input id="wr-buscar" placeholder="Nº de serie" style="flex:1;min-width:150px;text-transform:uppercase">
              <button class="btn" type="button" id="wr-buscar-btn" style="width:auto">Consultar</button>
            </div>
            <div id="wr-estado"></div>
          </div>
        </div>
      </div>${cfg.moduleIds.includes('auth') ? `
      <div id="wr-admin" hidden style="margin-top:40px">
        <h3>Garantías registradas <span class="muted" style="font-weight:400;font-size:.85rem">(solo administradores)</span></h3>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
          <button class="btn ghost" type="button" id="wr-csv">Descargar CSV</button>
        </div>
        <div id="wr-admin-tabla"><p class="muted">Cargando…</p></div>
      </div>` : ''}
    </div>
  </section>`,
    },
  }),
  head: () => `  <style>
    .wr-estadobox{margin-top:16px}
    .wr-chip{display:inline-block;font-size:.78rem;font-weight:700;letter-spacing:.03em;padding:4px 10px;border-radius:999px;color:#fff}
    .wr-vigente{background:#16a34a}
    .wr-vencida{background:#6b7280}
    .wr-reclamada{background:#d97706}
    .wr-track{height:10px;background:var(--surface);border-radius:999px;overflow:hidden;margin:12px 0 4px}
    .wr-fill{height:100%;width:0;background:var(--accent);border-radius:999px}
    .wr-fill.vencida{background:#6b7280}
    .wr-nota{margin-top:12px;background:var(--surface);border-left:3px solid var(--accent);padding:10px 14px;border-radius:0 var(--radius) var(--radius) 0;font-size:.9rem}
  </style>`,
  files: (cfg) => ({
    'routes/warranty.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, isEmail, dateISO } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
const MESES = ${MESES}; // Meses de cobertura por defecto

// Fecha de fin de cobertura = fecha de compra + MESES meses
function finCobertura(purchaseISO, meses) {
  const d = new Date(purchaseISO);
  d.setMonth(d.getMonth() + (meses || MESES));
  return d.toISOString();
}

// Estado derivado de las fechas (o "reclamada" si el admin la marcó)
function estado(row) {
  if (row.claimed) return 'reclamada';
  return new Date(row.coverageEnd).getTime() >= Date.now() ? 'vigente' : 'vencida';
}

// Vista pública de un registro: sin nombre ni email
const publica = (r) => ({ product: r.product, serial: r.serial, purchaseDate: r.purchaseDate, coverageEnd: r.coverageEnd, months: r.months, status: estado(r), note: r.note || '' });

const validar = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  email: isEmail,
  product: (v) => str(v, 2, 120),
  serial: (v) => str(v, 2, 60),
  purchaseDate: (v) => dateISO(v) && new Date(v).getTime() <= Date.now(),
});

// POST /api/warranty — registra un producto y calcula la cobertura (serie única)
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos (revisá la fecha: no puede ser futura)', errors });
  const serial = req.body.serial.trim().toUpperCase();
  const existe = (await db.find('warranties', x => x.serial === serial))[0];
  if (existe) return res.status(409).json({ error: 'Ese número de serie ya está registrado' });
  const purchaseDate = new Date(req.body.purchaseDate).toISOString();
  const row = await db.insert('warranties', {
    name: req.body.name.trim(),
    email: req.body.email.toLowerCase().trim(),
    product: req.body.product.trim(),
    serial,
    purchaseDate,
    months: MESES,
    coverageEnd: finCobertura(purchaseDate, MESES),
    claimed: false,
    note: '',
  });
  res.status(201).json(publica(row));
});

// GET /api/warranty/serie/:serial — estado público por número de serie
router.get('/serie/:serial', async (req, res) => {
  const serial = String(req.params.serial || '').trim().toUpperCase();
  const r = (await db.find('warranties', x => x.serial === serial))[0];
  if (!r) return res.status(404).json({ error: 'No encontramos una garantía con ese número de serie' });
  res.json(publica(r));
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/warranty — todos los registros con su estado (solo admin; filtro ?status=)
router.get('/', requireAdmin, async (req, res) => {
  let rows = await db.all('warranties');
  rows = rows.map(r => ({ ...r, status: estado(r) }));
  if (['vigente', 'vencida', 'reclamada'].includes(req.query.status)) rows = rows.filter(r => r.status === req.query.status);
  res.json(rows.reverse());
});

// PATCH /api/warranty/:id — marca/desmarca reclamada y/o nota (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.claimed !== undefined) patch.claimed = Boolean(req.body.claimed);
  if (req.body.note !== undefined) {
    if (typeof req.body.note !== 'string' || req.body.note.length > 1000) {
      return res.status(422).json({ error: 'Nota inválida', errors: { note: 'Texto de hasta 1000 caracteres' } });
    }
    patch.note = req.body.note.trim();
  }
  if (!Object.keys(patch).length) return res.status(422).json({ error: 'Nada para actualizar' });
  const row = await db.update('warranties', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Registro inexistente' });
  res.json({ ...row, status: estado(row) });
});
` : `// La gestión de garantías (listar todas, marcar reclamada, notas) requiere el módulo de
// autenticación: activalo en el Builder para habilitar el panel de administración.
`}
module.exports = router;
`,
  }),
  clientJs: (cfg) => `/* Módulo registro de garantía: alta de producto con cálculo de fin de cobertura, consulta por
   número de serie con barra de tiempo animada (Anime.js + red de seguridad) y, con auth activo,
   panel de gestión solo-admin. En la vista previa del Builder simula la API. */
(function () {
  var form = document.getElementById('wr-form');
  var estadoBox = document.getElementById('wr-estado');
  if (!form && !estadoBox) return;
  var LABELS = { vigente: 'Vigente', vencida: 'Vencida', reclamada: 'Reclamada' };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };
  var fecha = function (iso) { try { return new Date(iso).toLocaleDateString('es-AR'); } catch (e) { return '—'; } };

  function mostrarNuevo(r) {
    var box = document.getElementById('wr-nuevo');
    var el = document.getElementById('wr-vence-nuevo');
    if (el) el.textContent = fecha(r.coverageEnd);
    if (box) box.hidden = false;
    var input = document.getElementById('wr-buscar');
    if (input) input.value = r.serial || '';
  }

  // Alta de registro
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) {
      var hoy = new Date(); var fin = new Date(); fin.setMonth(fin.getMonth() + 12);
      mostrarNuevo({ serial: 'DEMO-0001', coverageEnd: fin.toISOString() });
      form.reset();
      return;
    }
    try {
      var r = await App.api('/api/warranty', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      mostrarNuevo(r);
      App.toast('¡Garantía activada!');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  // Consulta por número de serie
  var buscarInput = document.getElementById('wr-buscar');
  var buscarBtn = document.getElementById('wr-buscar-btn');
  async function buscar() {
    var serial = (buscarInput && buscarInput.value || '').trim().toUpperCase();
    if (!serial) { App.toast('Ingresá el número de serie'); return; }
    if (window.__PREVIEW__) {
      var hoy = new Date(); var compra = new Date(); compra.setMonth(compra.getMonth() - 4);
      var fin = new Date(compra); fin.setMonth(fin.getMonth() + 12);
      pintarEstado({ product: 'Producto de ejemplo', serial: serial, purchaseDate: compra.toISOString(), coverageEnd: fin.toISOString(), months: 12, status: 'vigente', note: '' });
      return;
    }
    try { pintarEstado(await App.api('/api/warranty/serie/' + encodeURIComponent(serial))); }
    catch (err) {
      if (err.message !== 'preview' && estadoBox) estadoBox.innerHTML = '<p class="muted" style="margin:12px 0 0">' + App.esc(err.message) + '</p>';
    }
  }
  if (buscarBtn) buscarBtn.addEventListener('click', buscar);
  if (buscarInput) buscarInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });

  function pintarEstado(r) {
    if (!estadoBox) return;
    var inicio = new Date(r.purchaseDate).getTime();
    var fin = new Date(r.coverageEnd).getTime();
    var ahora = Date.now();
    var total = Math.max(1, fin - inicio);
    var pct = Math.max(0, Math.min(100, Math.round((ahora - inicio) * 100 / total)));
    var venc = r.status === 'vencida';
    estadoBox.innerHTML =
      '<div class="wr-estadobox">' +
      '<p style="margin:0 0 6px"><strong>' + App.esc(r.product) + '</strong> <span class="muted">(' + App.esc(r.serial) + ')</span> ' +
      '<span class="wr-chip wr-' + r.status + '">' + (LABELS[r.status] || r.status) + '</span></p>' +
      '<p class="muted" style="margin:0;font-size:.85rem">Compra: ' + fecha(r.purchaseDate) + ' · Cobertura hasta: ' + fecha(r.coverageEnd) + '</p>' +
      '<div class="wr-track"><div class="wr-fill' + (venc ? ' vencida' : '') + '" id="wr-fill" data-pct="' + pct + '"></div></div>' +
      '<p class="muted" style="margin:0;font-size:.8rem">' + (venc ? 'Cobertura finalizada' : (r.status === 'reclamada' ? 'Garantía reclamada' : 'Tiempo de cobertura transcurrido: ' + pct + '%')) + '</p>' +
      (r.note ? '<div class="wr-nota">' + App.esc(r.note) + '</div>' : '') +
      '</div>';
    var fill = document.getElementById('wr-fill');
    if (fill) {
      var target = pct + '%';
      var anime = window.anime;
      if (!anime || !anime.animate || reduce) { fill.style.width = target; return; }
      anime.animate(fill, { width: ['0%', target], duration: 700, ease: 'outCubic' });
      // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
      setTimeout(function () { fill.style.width = target; }, 900);
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // Panel de gestión (solo admin): tabla con marcado de "reclamada" y nota por registro
  var adminBox = document.getElementById('wr-admin');
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var filasAdmin = [];
  if (adminBox && ((me && me.role === 'admin') || window.__PREVIEW__)) {
    adminBox.hidden = false;
    cargarAdmin();
  }

  async function cargarAdmin() {
    var cont = document.getElementById('wr-admin-tabla');
    if (!cont) return;
    if (window.__PREVIEW__) {
      var compra = new Date(); compra.setMonth(compra.getMonth() - 2);
      var fin = new Date(compra); fin.setMonth(fin.getMonth() + 12);
      filasAdmin = [{ id: '1', product: 'Producto de ejemplo', serial: 'DEMO-0001', name: 'Laura Gómez', email: 'laura@mail.com', purchaseDate: compra.toISOString(), coverageEnd: fin.toISOString(), status: 'vigente', claimed: false, note: '' }];
    } else {
      try { filasAdmin = await App.api('/api/warranty'); }
      catch (err) { if (err.message !== 'preview') cont.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; return; }
    }
    cont.innerHTML = App.table(filasAdmin, [
      { label: 'Producto', render: function (r) { return '<strong>' + App.esc(r.product) + '</strong><br><span class="muted" style="font-size:.8rem">' + App.esc(r.serial) + '</span>'; } },
      { label: 'Contacto', render: function (r) { return App.esc(r.name) + '<br><span class="muted">' + App.esc(r.email) + '</span>'; } },
      { label: 'Compra', render: function (r) { return fecha(r.purchaseDate); } },
      { label: 'Cobertura hasta', render: function (r) { return fecha(r.coverageEnd); } },
      { label: 'Estado', render: function (r) { return '<span class="wr-chip wr-' + r.status + '">' + (LABELS[r.status] || r.status) + '</span>'; } },
      { label: 'Reclamada', render: function (r) { return '<input type="checkbox" data-wr-claim="' + r.id + '"' + (r.claimed ? ' checked' : '') + '>'; } },
      { label: 'Nota', render: function (r) { return '<input data-wr-note="' + r.id + '" value="' + attr(r.note || '') + '" placeholder="Nota interna" style="min-width:160px">'; } },
      { label: '', render: function (r) { return '<button class="btn ghost" type="button" data-wr-guardar="' + r.id + '">Guardar</button>'; } },
    ]);
    cont.querySelectorAll('[data-wr-guardar]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.getAttribute('data-wr-guardar');
        var chk = cont.querySelector('[data-wr-claim="' + id + '"]');
        var note = cont.querySelector('[data-wr-note="' + id + '"]');
        if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el cambio'); return; }
        try {
          var upd = await App.api('/api/warranty/' + id, { method: 'PATCH', body: { claimed: chk.checked, note: note.value } });
          var f = filasAdmin.filter(function (x) { return x.id === id; })[0];
          if (f) { f.claimed = chk.checked; f.note = note.value; f.status = upd.status; }
          cargarAdmin();
          App.toast('Garantía actualizada');
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }

  var csvBtn = document.getElementById('wr-csv');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    var ET = { createdAt: 'Registrado', product: 'Producto', serial: 'Serie', name: 'Nombre', email: 'Email', purchaseDate: 'Compra', coverageEnd: 'Cobertura hasta', status: 'Estado', note: 'Nota' };
    var claves = ['createdAt', 'product', 'serial', 'name', 'email', 'purchaseDate', 'coverageEnd', 'status', 'note'];
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [claves.map(function (k) { return celda(ET[k] || k); }).join(';')];
    filasAdmin.forEach(function (r) { lineas.push(claves.map(function (k) {
      if (k === 'status') return celda(LABELS[r[k]] || r[k]);
      if (k === 'purchaseDate' || k === 'coverageEnd' || k === 'createdAt') return celda(r[k] ? fecha(r[k]) : '');
      return celda(r[k]);
    }).join(';')); });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'garantias-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Registro de garantía**: el cliente registra su producto en \`/garantia.html\` (número de serie único) y consulta el estado por número de serie (la vista pública no expone nombre ni email). Los registros se guardan en la colección \`warranties\`; la fecha de fin de cobertura se calcula como fecha de compra + \`MESES\` (${MESES} por defecto, editable en \`routes/warranty.js\`). ${cfg.moduleIds.includes('auth') ? 'Los administradores ven todos los registros, marcan garantías como "reclamada", dejan notas y exportan el CSV desde la misma página.' : 'Para gestionar las garantías (marcar reclamadas y notas) activá el módulo **Autenticación** en el Builder; sin él, quedan guardadas pero solo se consultan por número de serie.'}`,
  ],
};
