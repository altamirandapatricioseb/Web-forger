// Gestión de presupuestos: agrega un panel solo-admin para trabajar los pedidos de presupuesto
// que ya captura el módulo "Pedido de presupuesto" (quote). No duplica el alta: reusa la misma
// colección quotes y le suma un flujo de estados (nuevo → cotizado → aceptado / rechazado), una
// nota interna, filtro y CSV, más un resumen animado con Anime.js (total y pendientes con count-up).
// Depende de quote (se activa solo) y del módulo de autenticación para el panel: sin auth no hay
// panel (los pedidos siguen guardándose igual en data/quotes.json). Cierra el hueco marcado en el
// catálogo: había captura de presupuestos sin ninguna gestión posterior.
module.exports = {
  id: 'quotesadmin', type: 'functional', name: 'Gestión de presupuestos',
  description: 'Panel solo-admin /presupuestos.html para trabajar los pedidos de presupuesto capturados por el módulo "Pedido de presupuesto": estados (nuevo/cotizado/aceptado/rechazado), nota interna, filtro, CSV y resumen animado (Anime.js). Requiere el módulo Pedido de presupuesto; el panel necesita Autenticación.',
  usesAnime: true,
  requires: ['quote'],
  collections: ['quotes'],
  mounts: (cfg) => cfg.moduleIds.includes('auth') ? [{ route: '/api/quotes-admin', file: 'routes/quotesadmin.js' }] : [],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Presupuestos', href: '/presupuestos.html', id: 'nav-presupuestos' }] : [],
  head: (cfg) => cfg.moduleIds.includes('auth') ? `  <style>
    .qa-resumen{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px}
    .qa-kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px 18px;min-width:130px}
    .qa-kpi strong{display:block;font-size:1.7rem;color:var(--accent);font-variant-numeric:tabular-nums;line-height:1.1}
    .qa-kpi span{color:var(--muted);font-size:.85rem}
    .qa-estado{font-size:.85rem;padding:4px 6px;width:auto;min-width:130px}
    .qa-note{background:none;border:0;color:var(--accent);cursor:pointer;font:inherit;font-size:.82rem;text-decoration:underline;padding:0}
  </style>` : '',
  files: (cfg) => cfg.moduleIds.includes('auth') ? {
    'routes/quotesadmin.js': `const router = require('express').Router();
const db = require('../src/db');
const { oneOf, str } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

// Estados por los que pasa un pedido de presupuesto (editá las etiquetas si tu operación usa otras)
const ESTADOS = ['nuevo', 'cotizado', 'aceptado', 'rechazado'];

// Normaliza pedidos viejos que no tengan estado (quedan como "nuevo")
const conEstado = (q) => ({ ...q, status: ESTADOS.includes(q.status) ? q.status : 'nuevo' });

// GET /api/quotes-admin — todos los pedidos (solo admin; filtro ?status=)
router.get('/', requireAdmin, async (req, res) => {
  let rows = (await db.all('quotes')).map(conEstado);
  if (req.query.status && ESTADOS.includes(req.query.status)) rows = rows.filter(r => r.status === req.query.status);
  res.json(rows.reverse());
});

// GET /api/quotes-admin/stats — total y pendientes (para el resumen)
router.get('/stats', requireAdmin, async (req, res) => {
  const rows = (await db.all('quotes')).map(conEstado);
  res.json({ total: rows.length, pendientes: rows.filter(r => r.status === 'nuevo').length });
});

// PATCH /api/quotes-admin/:id — cambia estado y/o agrega una nota interna (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.status !== undefined) {
    if (!oneOf(req.body.status, ESTADOS)) return res.status(422).json({ error: 'Estado inválido', errors: { status: 'Debe ser ' + ESTADOS.join(', ') } });
    patch.status = req.body.status;
  }
  if (req.body.note !== undefined) {
    if (req.body.note !== '' && !str(req.body.note, 1, 500)) return res.status(422).json({ error: 'Nota inválida' });
    patch.note = String(req.body.note).trim().slice(0, 500);
  }
  if (!Object.keys(patch).length) return res.status(422).json({ error: 'Nada para actualizar' });
  const row = await db.update('quotes', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Pedido inexistente' });
  res.json(conEstado(row));
});

module.exports = router;
` } : {},
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    presupuestos: {
      title: 'Pedidos de presupuesto',
      html: `  <section>
    <div class="container">
      <h2>Pedidos de presupuesto</h2>
      <p class="section-sub">Trabajá los pedidos que llegan por el formulario de presupuesto: cambiá el estado, dejá una nota interna y descargá el CSV. Solo visible para administradores.</p>
      <div class="qa-resumen" id="qa-resumen" hidden>
        <div class="qa-kpi"><strong class="qa-num" data-n="0" id="qa-total">0</strong><span>pedidos en total</span></div>
        <div class="qa-kpi"><strong class="qa-num" data-n="0" id="qa-pend">0</strong><span>sin responder</span></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
        <select id="qa-filtro" style="width:auto;min-width:200px">
          <option value="">Todos los estados</option>
          <option value="nuevo">Nuevos</option>
          <option value="cotizado">Cotizados</option>
          <option value="aceptado">Aceptados</option>
          <option value="rechazado">Rechazados</option>
        </select>
        <button class="btn ghost" type="button" id="qa-csv">Descargar CSV</button>
      </div>
      <div id="qa-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => cfg.moduleIds.includes('auth') ? `/* Módulo gestión de presupuestos: panel admin /presupuestos.html sobre la colección quotes.
   Resumen con count-up (Anime.js + red de seguridad). En la vista previa simula la API. */
(function () {
  var adminBox = document.getElementById('qa-admin');
  if (!adminBox) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var filtro = document.getElementById('qa-filtro');
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var todos = [];
  var ESTADOS = ['nuevo', 'cotizado', 'aceptado', 'rechazado'];
  var LABEL = { nuevo: 'Nuevo', cotizado: 'Cotizado', aceptado: 'Aceptado', rechazado: 'Rechazado' };
  var ETIQUETAS = { createdAt: 'Fecha', name: 'Nombre', email: 'Email', phone: 'Teléfono', service: 'Necesita', budget: 'Presupuesto', details: 'Detalle', status: 'Estado', note: 'Nota' };

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    el.setAttribute('data-n', hasta);
    if (!anime || !anime.animate || reduce) { el.textContent = hasta; return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 700, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = hasta; }, 900);
  }

  function resumen() {
    var box = document.getElementById('qa-resumen');
    if (!box) return;
    box.hidden = false;
    contar(document.getElementById('qa-total'), todos.length);
    contar(document.getElementById('qa-pend'), todos.filter(function (r) { return (r.status || 'nuevo') === 'nuevo'; }).length);
  }

  function filtrados() {
    var v = filtro && filtro.value;
    return v ? todos.filter(function (r) { return (r.status || 'nuevo') === v; }) : todos;
  }

  function pintar() {
    adminBox.innerHTML = App.table(filtrados(), [
      { label: ETIQUETAS.createdAt, render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } },
      { key: 'name', label: ETIQUETAS.name },
      { label: ETIQUETAS.email, render: function (r) { return '<a href="mailto:' + App.esc(r.email) + '">' + App.esc(r.email) + '</a>'; } },
      { label: ETIQUETAS.service, render: function (r) { return App.esc(r.service || '—'); } },
      { label: ETIQUETAS.budget, render: function (r) { return App.esc(r.budget || '—'); } },
      { label: ETIQUETAS.details, render: function (r) { return r.details ? '<span title="' + App.esc(r.details) + '">' + App.esc(String(r.details).slice(0, 60)) + (String(r.details).length > 60 ? '…' : '') + '</span>' : '<span class="muted">—</span>'; } },
      { label: ETIQUETAS.status, render: function (r) {
        var v = r.status || 'nuevo';
        return '<select class="qa-estado" data-status="' + r.id + '">' + ESTADOS.map(function (e) { return '<option value="' + e + '"' + (e === v ? ' selected' : '') + '>' + LABEL[e] + '</option>'; }).join('') + '</select>';
      } },
      { label: ETIQUETAS.note, render: function (r) { return '<button class="qa-note" type="button" data-note="' + r.id + '">' + (r.note ? App.esc(String(r.note).slice(0, 24)) + (String(r.note).length > 24 ? '…' : '') : '+ nota') + '</button>'; } },
    ]);
    adminBox.querySelectorAll('[data-status]').forEach(function (sel) {
      sel.addEventListener('change', function () { cambiar(sel.getAttribute('data-status'), { status: sel.value }); });
    });
    adminBox.querySelectorAll('[data-note]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-note');
        var actual = (todos.filter(function (r) { return r.id === id; })[0] || {}).note || '';
        var nota = prompt('Nota interna sobre este pedido:', actual);
        if (nota === null) return;
        cambiar(id, { note: nota });
      });
    });
  }

  async function cambiar(id, patch) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el cambio'); return; }
    try {
      var row = await App.api('/api/quotes-admin/' + id, { method: 'PATCH', body: patch });
      todos = todos.map(function (r) { return r.id === id ? row : r; });
      pintar(); resumen();
      App.toast('Pedido actualizado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  if (filtro) filtro.addEventListener('change', pintar);

  var csvBtn = document.getElementById('qa-csv');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    var claves = ['createdAt', 'name', 'email', 'phone', 'service', 'budget', 'details', 'status', 'note'];
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [claves.map(function (k) { return celda(ETIQUETAS[k] || k); }).join(';')];
    filtrados().forEach(function (r) { lineas.push(claves.map(function (k) { return celda(k === 'status' ? (r.status || 'nuevo') : r[k]); }).join(';')); });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'presupuestos-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function listo(rows) { todos = rows; pintar(); resumen(); }

  if (window.__PREVIEW__) {
    listo([
      { id: '1', name: 'Sofía Ruiz', email: 'sofia@mail.com', phone: '', service: 'Proyecto a medida', budget: 'Entre $100.000 y $500.000', details: 'Necesito una tienda online con pasarela de pago y catálogo de 50 productos.', status: 'nuevo', createdAt: new Date().toISOString() },
      { id: '2', name: 'Diego Paz', email: 'diego@mail.com', phone: '11 5555-5555', service: 'Contratación de un servicio', budget: 'A definir', details: 'Mantenimiento mensual del sitio.', status: 'cotizado', note: 'Enviada propuesta el 12/07', createdAt: new Date().toISOString() },
    ]);
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    App.api('/api/quotes-admin').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var navQ = document.getElementById('nav-presupuestos');
    if (navQ && (!me || me.role !== 'admin') && !window.__PREVIEW__) navQ.style.display = 'none';
  })();
})();` : '',
  readmeNotes: (cfg) => [
    `**Gestión de presupuestos**: trabaja sobre los pedidos que captura el módulo *Pedido de presupuesto* (colección \`quotes\`), sin duplicar el alta. ${cfg.moduleIds.includes('auth') ? 'En `/presupuestos.html` cambiás el estado (nuevo → cotizado → aceptado/rechazado), dejás una nota interna y descargás el CSV.' : 'El panel de gestión requiere el módulo **Autenticación**: activalo para habilitar `/presupuestos.html`. Sin él, los pedidos se siguen guardando en `data/quotes.json`.'}`,
  ],
};
