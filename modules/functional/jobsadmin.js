// Gestión de postulaciones: panel solo-admin para trabajar las postulaciones que ya captura el
// módulo "Trabajá con nosotros" (jobs). No duplica el alta: reusa la colección applications y le
// suma un flujo de estados (nuevo → en revisión → entrevista → contratado / descartado), una nota
// interna, filtros (por estado y por puesto), CSV y un resumen animado con Anime.js. Depende de
// jobs (se activa solo) y del módulo de autenticación para el panel: sin auth no hay panel (las
// postulaciones siguen guardándose igual en data/applications.json). Cierra el hueco marcado en el
// catálogo: había captura de postulaciones sin ninguna gestión posterior.
module.exports = {
  id: 'jobsadmin', type: 'functional', name: 'Gestión de postulaciones',
  description: 'Panel solo-admin /postulaciones.html para trabajar las postulaciones capturadas por el módulo "Trabajá con nosotros": estados (nuevo/revisión/entrevista/contratado/descartado), nota interna, filtro por estado y por puesto, CSV y resumen animado (Anime.js). Requiere el módulo Trabajá con nosotros; el panel necesita Autenticación.',
  usesAnime: true,
  requires: ['jobs'],
  collections: ['applications'],
  mounts: (cfg) => cfg.moduleIds.includes('auth') ? [{ route: '/api/applications-admin', file: 'routes/jobsadmin.js' }] : [],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Postulaciones', href: '/postulaciones.html', id: 'nav-postulaciones' }] : [],
  head: (cfg) => cfg.moduleIds.includes('auth') ? `  <style>
    .ja-resumen{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px}
    .ja-kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px 18px;min-width:130px}
    .ja-kpi strong{display:block;font-size:1.7rem;color:var(--accent);font-variant-numeric:tabular-nums;line-height:1.1}
    .ja-kpi span{color:var(--muted);font-size:.85rem}
    .ja-estado{font-size:.85rem;padding:4px 6px;width:auto;min-width:130px}
    .ja-note{background:none;border:0;color:var(--accent);cursor:pointer;font:inherit;font-size:.82rem;text-decoration:underline;padding:0}
  </style>` : '',
  files: (cfg) => cfg.moduleIds.includes('auth') ? {
    'routes/jobsadmin.js': `const router = require('express').Router();
const db = require('../src/db');
const { oneOf, str } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

// Estados por los que pasa una postulación (editá las etiquetas si tu proceso usa otras)
const ESTADOS = ['nuevo', 'revision', 'entrevista', 'contratado', 'descartado'];

// Normaliza postulaciones viejas que no tengan estado (quedan como "nuevo")
const conEstado = (a) => ({ ...a, status: ESTADOS.includes(a.status) ? a.status : 'nuevo' });

// GET /api/applications-admin — todas las postulaciones (solo admin; filtros ?status= y ?position=)
router.get('/', requireAdmin, async (req, res) => {
  let rows = (await db.all('applications')).map(conEstado);
  if (req.query.status && ESTADOS.includes(req.query.status)) rows = rows.filter(r => r.status === req.query.status);
  if (req.query.position) rows = rows.filter(r => r.position === req.query.position);
  res.json(rows.reverse());
});

// GET /api/applications-admin/stats — total y sin revisar (para el resumen)
router.get('/stats', requireAdmin, async (req, res) => {
  const rows = (await db.all('applications')).map(conEstado);
  res.json({ total: rows.length, pendientes: rows.filter(r => r.status === 'nuevo').length });
});

// PATCH /api/applications-admin/:id — cambia estado y/o agrega una nota interna (solo admin)
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
  const row = await db.update('applications', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Postulación inexistente' });
  res.json(conEstado(row));
});

module.exports = router;
` } : {},
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    postulaciones: {
      title: 'Postulaciones',
      html: `  <section>
    <div class="container">
      <h2>Postulaciones recibidas</h2>
      <p class="section-sub">Trabajá las postulaciones que llegan por "Trabajá con nosotros": moverlas de estado, dejar una nota y descargar el CSV. Solo visible para administradores.</p>
      <div class="ja-resumen" id="ja-resumen" hidden>
        <div class="ja-kpi"><strong class="ja-num" data-n="0" id="ja-total">0</strong><span>postulaciones</span></div>
        <div class="ja-kpi"><strong class="ja-num" data-n="0" id="ja-pend">0</strong><span>sin revisar</span></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <select id="ja-filtro" style="width:auto;min-width:170px">
          <option value="">Todos los estados</option>
          <option value="nuevo">Nuevos</option>
          <option value="revision">En revisión</option>
          <option value="entrevista">En entrevista</option>
          <option value="contratado">Contratados</option>
          <option value="descartado">Descartados</option>
        </select>
        <select id="ja-puesto" style="width:auto;min-width:170px"><option value="">Todos los puestos</option></select>
        <span style="flex:1"></span>
        <button class="btn ghost" type="button" id="ja-csv">Descargar CSV</button>
      </div>
      <div id="ja-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => cfg.moduleIds.includes('auth') ? `/* Módulo gestión de postulaciones: panel admin /postulaciones.html sobre la colección
   applications. Resumen con count-up (Anime.js + red de seguridad). En la vista previa simula la API. */
(function () {
  var adminBox = document.getElementById('ja-admin');
  if (!adminBox) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var filtro = document.getElementById('ja-filtro');
  var filtroPuesto = document.getElementById('ja-puesto');
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var todos = [];
  var ESTADOS = ['nuevo', 'revision', 'entrevista', 'contratado', 'descartado'];
  var LABEL = { nuevo: 'Nuevo', revision: 'En revisión', entrevista: 'Entrevista', contratado: 'Contratado', descartado: 'Descartado' };
  var ETIQUETAS = { createdAt: 'Fecha', name: 'Nombre', email: 'Email', position: 'Puesto', cvUrl: 'CV', message: 'Mensaje', status: 'Estado', note: 'Nota' };

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
    var box = document.getElementById('ja-resumen');
    if (!box) return;
    box.hidden = false;
    contar(document.getElementById('ja-total'), todos.length);
    contar(document.getElementById('ja-pend'), todos.filter(function (r) { return (r.status || 'nuevo') === 'nuevo'; }).length);
  }

  function refrescarPuestos() {
    if (!filtroPuesto) return;
    var prev = filtroPuesto.value;
    var puestos = {};
    todos.forEach(function (r) { if (r.position) puestos[r.position] = 1; });
    filtroPuesto.innerHTML = '<option value="">Todos los puestos</option>' + Object.keys(puestos).map(function (p) { return '<option value="' + App.esc(p) + '">' + App.esc(p) + '</option>'; }).join('');
    filtroPuesto.value = prev;
  }

  function filtrados() {
    var v = filtro && filtro.value;
    var p = filtroPuesto && filtroPuesto.value;
    return todos.filter(function (r) {
      if (v && (r.status || 'nuevo') !== v) return false;
      if (p && r.position !== p) return false;
      return true;
    });
  }

  function pintar() {
    adminBox.innerHTML = App.table(filtrados(), [
      { label: ETIQUETAS.createdAt, render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } },
      { key: 'name', label: ETIQUETAS.name },
      { label: ETIQUETAS.email, render: function (r) { return '<a href="mailto:' + App.esc(r.email) + '">' + App.esc(r.email) + '</a>'; } },
      { label: ETIQUETAS.position, render: function (r) { return App.esc(r.position || '—'); } },
      { label: ETIQUETAS.cvUrl, render: function (r) { return r.cvUrl ? '<a href="' + App.esc(r.cvUrl) + '" target="_blank" rel="noopener">Ver CV</a>' : '<span class="muted">—</span>'; } },
      { label: ETIQUETAS.message, render: function (r) { return r.message ? '<span title="' + App.esc(r.message) + '">' + App.esc(String(r.message).slice(0, 50)) + (String(r.message).length > 50 ? '…' : '') + '</span>' : '<span class="muted">—</span>'; } },
      { label: ETIQUETAS.status, render: function (r) {
        var v = r.status || 'nuevo';
        return '<select class="ja-estado" data-status="' + r.id + '">' + ESTADOS.map(function (e) { return '<option value="' + e + '"' + (e === v ? ' selected' : '') + '>' + LABEL[e] + '</option>'; }).join('') + '</select>';
      } },
      { label: ETIQUETAS.note, render: function (r) { return '<button class="ja-note" type="button" data-note="' + r.id + '">' + (r.note ? App.esc(String(r.note).slice(0, 24)) + (String(r.note).length > 24 ? '…' : '') : '+ nota') + '</button>'; } },
    ]);
    adminBox.querySelectorAll('[data-status]').forEach(function (sel) {
      sel.addEventListener('change', function () { cambiar(sel.getAttribute('data-status'), { status: sel.value }); });
    });
    adminBox.querySelectorAll('[data-note]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-note');
        var actual = (todos.filter(function (r) { return r.id === id; })[0] || {}).note || '';
        var nota = prompt('Nota interna sobre esta postulación:', actual);
        if (nota === null) return;
        cambiar(id, { note: nota });
      });
    });
  }

  async function cambiar(id, patch) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el cambio'); return; }
    try {
      var row = await App.api('/api/applications-admin/' + id, { method: 'PATCH', body: patch });
      todos = todos.map(function (r) { return r.id === id ? row : r; });
      pintar(); resumen();
      App.toast('Postulación actualizada');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  if (filtro) filtro.addEventListener('change', pintar);
  if (filtroPuesto) filtroPuesto.addEventListener('change', pintar);

  var csvBtn = document.getElementById('ja-csv');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    var claves = ['createdAt', 'name', 'email', 'position', 'cvUrl', 'message', 'status', 'note'];
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [claves.map(function (k) { return celda(ETIQUETAS[k] || k); }).join(';')];
    filtrados().forEach(function (r) { lineas.push(claves.map(function (k) { return celda(k === 'status' ? (r.status || 'nuevo') : r[k]); }).join(';')); });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'postulaciones-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function listo(rows) { todos = rows; refrescarPuestos(); pintar(); resumen(); }

  if (window.__PREVIEW__) {
    listo([
      { id: '1', name: 'Ana López', email: 'ana@mail.com', position: 'Vendedor/a de salón', cvUrl: 'https://linkedin.com/in/ana', message: 'Tengo 3 años de experiencia en atención al cliente y disponibilidad full time.', status: 'nuevo', createdAt: new Date().toISOString() },
      { id: '2', name: 'Marcos Díaz', email: 'marcos@mail.com', position: 'Administrativo/a', cvUrl: '', message: 'Manejo avanzado de planillas y facturación.', status: 'entrevista', note: 'Entrevista el jueves 16', createdAt: new Date().toISOString() },
    ]);
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    App.api('/api/applications-admin').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var navJ = document.getElementById('nav-postulaciones');
    if (navJ && (!me || me.role !== 'admin') && !window.__PREVIEW__) navJ.style.display = 'none';
  })();
})();` : '',
  readmeNotes: (cfg) => [
    `**Gestión de postulaciones**: trabaja sobre las postulaciones que captura el módulo *Trabajá con nosotros* (colección \`applications\`), sin duplicar el alta. ${cfg.moduleIds.includes('auth') ? 'En `/postulaciones.html` movés cada una de estado (nuevo → en revisión → entrevista → contratado/descartado), dejás una nota interna, filtrás por estado y puesto, y descargás el CSV.' : 'El panel de gestión requiere el módulo **Autenticación**: activalo para habilitar `/postulaciones.html`. Sin él, las postulaciones se siguen guardando en `data/applications.json`.'}`,
  ],
};
