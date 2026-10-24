// Fuentes que la bandeja sabe listar; se incluyen solo las de módulos activos en la config
const FUENTES = [
  { modulo: 'contact', col: 'messages', label: 'Mensajes', cols: ['name', 'email', 'message'] },
  { modulo: 'quote', col: 'quotes', label: 'Presupuestos', cols: ['name', 'email', 'phone', 'service', 'budget', 'details'] },
  { modulo: 'jobs', col: 'applications', label: 'Postulaciones', cols: ['name', 'email', 'position', 'cvUrl', 'message'] },
];
const activas = (cfg) => FUENTES.filter(f => cfg.moduleIds.includes(f.modulo));

module.exports = {
  id: 'inbox', type: 'functional', name: 'Bandeja de entrada',
  description: 'Panel admin con los mensajes de contacto, pedidos de presupuesto y postulaciones recibidos: estado nuevo/respondido y descarga CSV. Requiere autenticación.',
  requires: ['auth'],
  mounts: [{ route: '/api/inbox', file: 'routes/inbox.js' }],
  nav: () => [{ label: 'Bandeja', href: '/inbox.html', id: 'nav-inbox', badge: 'inbox-badge' }],
  pages: (cfg) => ({
    inbox: {
      title: 'Bandeja de entrada',
      html: `  <section>
    <div class="container">
      <h2>Bandeja de entrada</h2>
      <p class="section-sub">Todo lo que llega por los formularios del sitio, en un solo lugar. Solo visible para administradores.</p>
${activas(cfg).length ? `      <div id="inbox-tabs" role="tablist" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px"></div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
        <button class="btn ghost" type="button" id="inbox-csv">Descargar CSV</button>
      </div>
      <div id="inbox-table"><p class="muted">Cargando…</p></div>` : `      <div class="card"><p class="muted" style="margin:0">No hay formularios activos en este sitio. Activá los módulos Contacto, Pedido de presupuesto o Trabajá con nosotros para recibir datos acá.</p></div>`}
    </div>
  </section>`,
    },
  }),
  files: (cfg) => ({
    'routes/inbox.js': `const router = require('express').Router();
const db = require('../src/db');
const { oneOf } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

// Colecciones de formularios presentes en este proyecto
const FUENTES = ${JSON.stringify(activas(cfg).map(f => f.col))};
const ESTADOS = ['nuevo', 'respondido'];

// GET /api/inbox — todo lo recibido, por colección y de más nuevo a más viejo (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  const out = {};
  for (const col of FUENTES) out[col] = (await db.all(col)).reverse();
  res.json(out);
});

// PATCH /api/inbox/:col/:id — cambia el estado de un ítem (solo admin)
router.patch('/:col/:id', requireAdmin, async (req, res) => {
  if (!FUENTES.includes(req.params.col)) return res.status(404).json({ error: 'Colección desconocida' });
  if (!oneOf(req.body.status, ESTADOS)) {
    return res.status(422).json({ error: 'Estado inválido', errors: { status: 'Debe ser ' + ESTADOS.join(' o ') } });
  }
  const row = await db.update(req.params.col, req.params.id, { status: req.body.status });
  if (!row) return res.status(404).json({ error: 'Ítem inexistente' });
  res.json(row);
});

module.exports = router;
`,
  }),
  clientJs: (cfg) => `/* Módulo bandeja de entrada (solo admin) */
(function () {
  var FUENTES = ${JSON.stringify(activas(cfg).map(({ col, label, cols }) => ({ col, label, cols })))};
  var ETIQUETAS = { name: 'Nombre', email: 'Email', message: 'Mensaje', phone: 'Teléfono', service: 'Servicio', budget: 'Presupuesto', details: 'Detalle', position: 'Puesto', cvUrl: 'CV', createdAt: 'Fecha', status: 'Estado' };

  // La bandeja es solo para admins: se oculta el link de la navbar para el resto
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var navInbox = document.getElementById('nav-inbox');
  var badge = document.getElementById('inbox-badge');
  if (navInbox && (!me || me.role !== 'admin') && !window.__PREVIEW__) navInbox.style.display = 'none';
  if (badge) badge.style.display = 'none';

  var tabs = document.getElementById('inbox-tabs');
  var box = document.getElementById('inbox-table');

  var datos = {};
  var activa = FUENTES.length ? FUENTES[0].col : null;

  function nuevos(col) {
    return (datos[col] || []).filter(function (r) { return (r.status || 'nuevo') === 'nuevo'; }).length;
  }

  function pintarBadge() {
    if (!badge) return;
    var total = FUENTES.reduce(function (n, f) { return n + nuevos(f.col); }, 0);
    badge.textContent = total;
    badge.style.display = total ? '' : 'none';
  }

  function pintarTabs() {
    if (!tabs) return;
    tabs.innerHTML = '';
    FUENTES.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn' + (f.col === activa ? '' : ' ghost');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', f.col === activa);
      var n = nuevos(f.col);
      b.textContent = f.label + ' (' + (datos[f.col] || []).length + (n ? ' · ' + n + ' nuevos' : '') + ')';
      b.addEventListener('click', function () { activa = f.col; pintar(); });
      tabs.appendChild(b);
    });
  }

  function pintarTabla() {
    if (!box || !activa) return;
    var fuente = FUENTES.find(function (f) { return f.col === activa; });
    var filas = datos[activa] || [];
    var cols = fuente.cols.map(function (k) {
      if (k === 'cvUrl') return { label: ETIQUETAS[k], render: function (r) { return r.cvUrl ? '<a href="' + App.esc(r.cvUrl) + '" target="_blank" rel="noopener">Ver CV</a>' : '—'; } };
      return { key: k, label: ETIQUETAS[k] || k, render: function (r) { return App.esc(String(r[k] || '—')).slice(0, 120); } };
    });
    cols.unshift({ label: ETIQUETAS.createdAt, render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } });
    cols.push({ label: ETIQUETAS.status, render: function (r) {
      var st = r.status || 'nuevo';
      return '<span style="' + (st === 'nuevo' ? 'color:var(--accent);font-weight:700' : 'color:var(--muted)') + '">' + st + '</span>';
    } });
    cols.push({ label: '', render: function (r) {
      var st = r.status || 'nuevo';
      return '<button class="btn ghost" type="button" data-estado="' + r.id + '" data-next="' + (st === 'nuevo' ? 'respondido' : 'nuevo') + '">' + (st === 'nuevo' ? 'Marcar respondido' : 'Marcar nuevo') + '</button>';
    } });
    box.innerHTML = App.table(filas, cols);
    box.querySelectorAll('[data-estado]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try {
          await App.api('/api/inbox/' + activa + '/' + b.dataset.estado, { method: 'PATCH', body: { status: b.dataset.next } });
          var fila = (datos[activa] || []).find(function (r) { return r.id === b.dataset.estado; });
          if (fila) fila.status = b.dataset.next;
          pintar();
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }

  function pintar() { pintarTabs(); pintarTabla(); pintarBadge(); }

  // Descarga CSV de la pestaña activa (separador ; para Excel es-AR, con BOM UTF-8)
  var csvBtn = document.getElementById('inbox-csv');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    if (!activa) return;
    var fuente = FUENTES.find(function (f) { return f.col === activa; });
    var claves = ['createdAt'].concat(fuente.cols, ['status']);
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [claves.map(function (k) { return celda(ETIQUETAS[k] || k); }).join(';')];
    (datos[activa] || []).forEach(function (r) {
      lineas.push(claves.map(function (k) { return celda(k === 'status' ? (r.status || 'nuevo') : r[k]); }).join(';'));
    });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = activa + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function cargar() {
    if (!box || !FUENTES.length) return;
    if (window.__PREVIEW__) {
      FUENTES.forEach(function (f) { datos[f.col] = []; });
      datos[FUENTES[0].col] = [
        { id: '1', name: 'Laura Gómez', email: 'laura@mail.com', message: 'Hola, quería consultar por…', service: 'Proyecto a medida', budget: 'A definir', details: 'Consulta de ejemplo', position: 'Vendedor/a de salón', createdAt: new Date().toISOString(), status: 'nuevo' },
        { id: '2', name: 'Martín Paz', email: 'martin@mail.com', message: 'Buenas tardes, los contacto por…', service: 'Otro', budget: 'Hasta $100.000', details: 'Otra consulta', position: 'Administrativo/a', createdAt: new Date().toISOString(), status: 'respondido' },
      ];
      pintar();
      return;
    }
    if (!me || me.role !== 'admin') { location.href = '/auth.html'; return; }
    App.api('/api/inbox').then(function (data) { datos = data; pintar(); })
      .catch(function (err) { box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
  }
  cargar();
  // El badge de la navbar se actualiza en todas las páginas, no solo en la bandeja
  if (!box && badge && me && me.role === 'admin' && !window.__PREVIEW__) {
    App.api('/api/inbox').then(function (data) { datos = data; pintarBadge(); }).catch(function () {});
  }
})();`,
  readmeNotes: (cfg) => [
    `**Bandeja de entrada**: solo los administradores ven el link "Bandeja" y pueden entrar a \`/inbox.html\`. ${activas(cfg).length ? `Lista ${activas(cfg).map(f => f.label.toLowerCase()).join(', ')} con estado nuevo/respondido y descarga CSV.` : 'Activá Contacto, Pedido de presupuesto o Trabajá con nosotros para que tenga datos que mostrar.'}`,
  ],
};
