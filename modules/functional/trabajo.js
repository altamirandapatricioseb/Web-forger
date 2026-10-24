// Tablero de tareas del equipo con backend real: el "qué tiene que hacer cada uno" que le faltaba al
// catálogo. Ojo con el nombre: el módulo "tareas" son los trabajos automáticos del servidor (cron);
// esto es el tablero de trabajo de las PERSONAS. Tres columnas (pendiente / en curso / hecha), cada
// tarea con responsable, prioridad, vencimiento y bitácora de notas fechadas y firmadas. Dos
// decisiones que lo hacen usable de verdad: el estado lo mueve el servidor validando la transición
// (una tarea no salta de pendiente a hecha sin pasar por en curso, y volver atrás borra la fecha de
// finalización) y la VISIBILIDAD está cortada en el servidor, no en la pantalla: el admin ve el
// tablero completo y cualquier otra persona ve SOLO lo suyo. Eso importa porque en estos sitios el
// registro es público: si el listado del equipo fuera visible para cualquier usuario logueado,
// bastaría con registrarse para llevarse todos los emails del personal. Las tareas vencidas las
// marca el servidor comparando con su propia fecha, no la del navegador (el reloj del visitante no
// es fuente de verdad). Página /trabajo.html, animada con Anime.js (KPIs con count-up, entrada
// escalonada de las tarjetas) + red de seguridad para la pestaña oculta. Requiere Autenticación.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'trabajo', type: 'functional', name: 'Tablero de tareas del equipo',
  description: 'El tablero de trabajo del equipo con backend real: tareas con responsable, prioridad, vencimiento y bitácora de notas, organizadas en tres columnas (pendiente, en curso, hecha). El servidor valida cada cambio de estado y marca las vencidas con su propia fecha, no con la del navegador. La visibilidad se corta en el servidor: el admin ve todo el tablero y cada persona ve solamente las tareas que tiene asignadas, así que registrarse no alcanza para ver el trabajo ajeno ni los emails del equipo. Página /trabajo.html con KPIs animados (Anime.js), filtros, bitácora y CSV. Requiere Autenticación. Distinto de "Tareas programadas", que son los trabajos automáticos del servidor.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/trabajo', file: 'routes/trabajo.js' }],
  collections: ['worktasks'],
  nav: () => [{ label: 'Tablero', href: '/trabajo.html', id: 'nav-trabajo' }],
  head: () => `  <style>
    .tb-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .tb-kpis .card{text-align:center}
    .tb-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .tb-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:18px;align-items:start}
    .tb-col h3{display:flex;align-items:center;justify-content:space-between;font-size:1rem;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid var(--line)}
    .tb-col h3 span{font-size:.8rem;color:var(--muted);font-weight:600}
    .tb-card{border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;background:var(--surface);margin-bottom:12px}
    .tb-card h4{margin:0 0 6px;font-size:.98rem}
    .tb-card p{margin:0 0 8px;font-size:.86rem;color:var(--muted)}
    .tb-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
    .tb-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .tb-chip.alta{background:#c0392b18;color:#c0392b}
    .tb-chip.media{background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}
    .tb-chip.baja{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .tb-chip.vencida{background:#c0392b;color:#fff}
    .tb-chip.hoy{background:#2e9e5b20;color:#1d6b3c}
    .tb-quien{font-size:.78rem;color:var(--muted)}
    .tb-acc{display:flex;gap:6px;flex-wrap:wrap}
    .tb-acc .btn{padding:5px 12px;font-size:.8rem}
    .tb-notas{border-left:3px solid var(--accent);padding:8px 12px;margin-top:10px;font-size:.8rem;background:var(--bg);border-radius:0 var(--radius) var(--radius) 0}
    .tb-notas div{margin-bottom:5px}
    .tb-vacia{color:var(--muted);font-size:.86rem;padding:10px 0}
  </style>`,
  pages: () => ({
    'trabajo': {
      title: 'Tablero del equipo',
      html: `  <section>
    <div class="container">
      <h2>Tablero del equipo</h2>
      <p class="section-sub" id="tb-sub">Quién hace qué y para cuándo. El estado y los vencimientos los controla el servidor.</p>
      <div id="tb-kpis" class="tb-kpis"></div>

      <div class="card" id="tb-alta-box" style="margin-bottom:26px;display:none">
        <h3>Nueva tarea</h3>
        <form id="tb-form">
          <label>Qué hay que hacer</label><input name="title" required maxlength="120" placeholder="Llamar al proveedor de packaging">
          <label>Detalle (opcional)</label><textarea name="detail" rows="2" maxlength="600"></textarea>
          <div class="grid cols-3">
            <div><label>Responsable</label><select name="assigneeEmail" id="tb-resp"><option value="">Sin asignar</option></select></div>
            <div>
              <label>Prioridad</label>
              <select name="priority"><option value="media">Media</option><option value="alta">Alta</option><option value="baja">Baja</option></select>
            </div>
            <div><label>Vence el</label><input name="dueDate" type="date"></div>
          </div>
          <div style="margin-top:16px"><button class="btn" type="submit">Crear tarea</button></div>
        </form>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:16px">
        <input id="tb-buscar" placeholder="Buscar en las tareas" style="width:auto;min-width:190px;margin:0">
        <select id="tb-filtro-resp" style="width:auto;margin:0"><option value="">Todos los responsables</option></select>
        <label style="display:flex;align-items:center;gap:6px;font-weight:400;margin:0">
          <input type="checkbox" id="tb-solo-vencidas" style="width:auto;margin:0"> Sólo vencidas
        </label>
        <button class="btn ghost" type="button" id="tb-csv">Descargar CSV</button>
      </div>

      <div id="tb-tablero" class="tb-cols"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  files: () => ({
    'routes/trabajo.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, oneOf } = require('../src/validate');
const { requireAuth, requireAdmin } = require('../src/middleware/auth');

const ESTADOS = ['pendiente', 'curso', 'hecha'];
const PRIORIDADES = ['baja', 'media', 'alta'];
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;
const hoy = () => new Date().toISOString().slice(0, 10);
const mail = (v) => String(v || '').toLowerCase().trim();

// Transiciones válidas: una tarea no salta de pendiente a hecha sin pasar por en curso, y
// reabrir algo hecho vuelve a "en curso" (nunca a pendiente: ya se empezó).
const PASOS = {
  pendiente: ['curso'],
  curso: ['pendiente', 'hecha'],
  hecha: ['curso'],
};

// El servidor decide qué está vencido con SU fecha: el reloj del navegador no es fuente de verdad
function decorar(t) {
  const vencida = Boolean(t.dueDate) && t.status !== 'hecha' && t.dueDate < hoy();
  const paraHoy = Boolean(t.dueDate) && t.status !== 'hecha' && t.dueDate === hoy();
  return { ...t, vencida, paraHoy };
}

// ¿Esta persona puede tocar esta tarea? El admin siempre; el resto, sólo lo suyo.
const puede = (req, t) => req.user.role === 'admin' || mail(t.assigneeEmail) === mail(req.user.email);

// Lo que ve cada uno: el admin el tablero entero, cualquier otro sólo sus tareas.
// El corte es del servidor: no alcanza con esconder botones en la pantalla.
async function visibles(req) {
  const todas = await db.all('worktasks');
  if (req.user.role === 'admin') return todas;
  return todas.filter(t => mail(t.assigneeEmail) === mail(req.user.email));
}

// GET /api/trabajo — el tablero (filtros ?q=, ?responsable=, ?vencidas=1)
router.get('/', requireAuth, async (req, res) => {
  let rows = (await visibles(req)).map(decorar);
  const q = String(req.query.q || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim();
  if (q) rows = rows.filter(t => (t.title + ' ' + (t.detail || '') + ' ' + (t.assigneeName || '')).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').includes(q));
  if (req.query.responsable) rows = rows.filter(t => mail(t.assigneeEmail) === mail(req.query.responsable));
  if (req.query.vencidas === '1') rows = rows.filter(t => t.vencida);
  // Orden: primero lo vencido, después por prioridad y por vencimiento más cercano
  const peso = { alta: 0, media: 1, baja: 2 };
  rows.sort((a, b) => (Number(b.vencida) - Number(a.vencida))
    || ((peso[a.priority] ?? 1) - (peso[b.priority] ?? 1))
    || String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')));
  res.json({ soyAdmin: req.user.role === 'admin', rows });
});

// GET /api/trabajo/resumen — KPIs del tablero que ve quien pregunta
router.get('/resumen', requireAuth, async (req, res) => {
  const rows = (await visibles(req)).map(decorar);
  const semana = new Date(Date.now() - 7 * 86400000).toISOString();
  res.json({
    pendientes: rows.filter(t => t.status === 'pendiente').length,
    curso: rows.filter(t => t.status === 'curso').length,
    vencidas: rows.filter(t => t.vencida).length,
    hechasSemana: rows.filter(t => t.status === 'hecha' && String(t.completedAt || '') > semana).length,
  });
});

// GET /api/trabajo/equipo — a quién se le puede asignar. SOLO ADMIN: la lista de usuarios con
// su email no puede quedar al alcance de cualquiera que se registre en el sitio.
router.get('/equipo', requireAdmin, async (req, res) => {
  const users = await db.all('users');
  res.json(users.filter(u => u.active !== false)
    .map(u => ({ name: u.name, email: u.email }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es')));
});

// POST /api/trabajo — crea una tarea (solo admin: es quien reparte el trabajo)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, { title: (v) => str(v, 3, 120) });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const dueDate = FECHA.test(String(req.body.dueDate || '')) ? req.body.dueDate : '';
  const priority = PRIORIDADES.includes(req.body.priority) ? req.body.priority : 'media';
  let assigneeEmail = mail(req.body.assigneeEmail), assigneeName = '';
  if (assigneeEmail) {
    const u = (await db.all('users')).filter(x => mail(x.email) === assigneeEmail)[0];
    if (!u) return res.status(422).json({ error: 'Esa persona no tiene cuenta en el sitio' });
    assigneeName = u.name;
  }
  const row = await db.insert('worktasks', {
    title: String(req.body.title).trim(),
    detail: String(req.body.detail || '').trim().slice(0, 600),
    assigneeEmail, assigneeName,
    priority, dueDate,
    status: 'pendiente',
    completedAt: '',
    author: req.user.name,
    notes: [],
  });
  res.status(201).json(decorar(row));
});

// PATCH /api/trabajo/:id/estado — mueve la tarea validando la transición
router.patch('/:id/estado', requireAuth, async (req, res) => {
  const t = await db.get('worktasks', req.params.id);
  if (!t) return res.status(404).json({ error: 'Tarea inexistente' });
  if (!puede(req, t)) return res.status(403).json({ error: 'Sólo el responsable o un administrador pueden mover esta tarea' });
  if (!oneOf(req.body.status, ESTADOS)) return res.status(422).json({ error: 'Estado inválido' });
  const destino = req.body.status;
  if (destino === t.status) return res.json(decorar(t));
  if (!(PASOS[t.status] || []).includes(destino)) {
    return res.status(409).json({ error: 'De "' + t.status + '" no se puede pasar directo a "' + destino + '"' });
  }
  const row = await db.update('worktasks', t.id, {
    status: destino,
    // Volver atrás borra la fecha de finalización: una tarea reabierta no está hecha
    completedAt: destino === 'hecha' ? new Date().toISOString() : '',
  });
  res.json(decorar(row));
});

// PATCH /api/trabajo/:id — edita la tarea (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const t = await db.get('worktasks', req.params.id);
  if (!t) return res.status(404).json({ error: 'Tarea inexistente' });
  const patch = {};
  if (req.body.title !== undefined) {
    if (!str(req.body.title, 3, 120)) return res.status(422).json({ error: 'Título inválido' });
    patch.title = String(req.body.title).trim();
  }
  if (req.body.detail !== undefined) patch.detail = String(req.body.detail).trim().slice(0, 600);
  if (req.body.priority !== undefined) {
    if (!oneOf(req.body.priority, PRIORIDADES)) return res.status(422).json({ error: 'Prioridad inválida' });
    patch.priority = req.body.priority;
  }
  if (req.body.dueDate !== undefined) patch.dueDate = FECHA.test(String(req.body.dueDate)) ? req.body.dueDate : '';
  if (req.body.assigneeEmail !== undefined) {
    const em = mail(req.body.assigneeEmail);
    if (!em) { patch.assigneeEmail = ''; patch.assigneeName = ''; }
    else {
      const u = (await db.all('users')).filter(x => mail(x.email) === em)[0];
      if (!u) return res.status(422).json({ error: 'Esa persona no tiene cuenta en el sitio' });
      patch.assigneeEmail = em;
      patch.assigneeName = u.name;
    }
  }
  res.json(decorar(await db.update('worktasks', t.id, patch)));
});

// POST /api/trabajo/:id/nota — bitácora fechada y firmada (el responsable también puede)
router.post('/:id/nota', requireAuth, async (req, res) => {
  const t = await db.get('worktasks', req.params.id);
  if (!t) return res.status(404).json({ error: 'Tarea inexistente' });
  if (!puede(req, t)) return res.status(403).json({ error: 'Sólo el responsable o un administrador pueden anotar en esta tarea' });
  if (!str(req.body.text, 2, 400)) return res.status(422).json({ error: 'La nota está vacía o es demasiado larga' });
  const notes = [...(t.notes || []), { text: String(req.body.text).trim(), author: req.user.name, at: new Date().toISOString() }];
  res.status(201).json(decorar(await db.update('worktasks', t.id, { notes })));
});

// DELETE /api/trabajo/:id — borra la tarea (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const t = await db.get('worktasks', req.params.id);
  if (!t) return res.status(404).json({ error: 'Tarea inexistente' });
  await db.remove('worktasks', t.id);
  res.json({ ok: true });
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo tablero del equipo: tres columnas con las tareas, alta y asignación (admin), cambio de
   estado, bitácora y CSV. KPIs con count-up y entrada escalonada de las tarjetas (Anime.js + red de
   seguridad). En la vista previa del Builder simula la API. */
(function () {
  var box = document.getElementById('tb-tablero');
  if (!box) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };
  var fecha = function (d) { try { return new Date(d + 'T12:00:00').toLocaleDateString('es-AR'); } catch (e) { return d; } };
  var cuando = function (iso) { try { return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  var COLUMNAS = [['pendiente', 'Pendientes'], ['curso', 'En curso'], ['hecha', 'Hechas']];
  var lista = [], soyAdmin = false, abierta = '';

  var me = JSON.parse(localStorage.getItem('user') || 'null');
  if (!window.__PREVIEW__ && !me) {
    box.innerHTML = '<p class="muted">Necesitás iniciar sesión para ver el tablero del equipo.</p>';
    return;
  }

  function contar(el, valor) {
    var pintar = function (v) { el.textContent = Math.round(v); };
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { pintar(valor); return; }
    var obj = { v: 0 };
    anime.animate(obj, { v: valor, duration: 700, ease: 'outCubic', onUpdate: function () { pintar(obj.v); } });
    setTimeout(function () { pintar(valor); }, 900);
  }

  function pintarKpis(r) {
    var cont = document.getElementById('tb-kpis');
    if (!cont) return;
    var datos = [['Pendientes', r.pendientes], ['En curso', r.curso], ['Vencidas', r.vencidas], ['Hechas esta semana', r.hechasSemana]];
    cont.innerHTML = datos.map(function (d) {
      return '<div class="card"><strong data-tb-kpi="' + d[1] + '">0</strong><span class="muted">' + d[0] + '</span></div>';
    }).join('');
    cont.querySelectorAll('[data-tb-kpi]').forEach(function (el) { contar(el, Number(el.getAttribute('data-tb-kpi'))); });
  }

  function tarjeta(t) {
    var chips = '<span class="tb-chip ' + App.esc(t.priority) + '">' + (t.priority === 'alta' ? 'Alta' : t.priority === 'baja' ? 'Baja' : 'Media') + '</span>';
    if (t.vencida) chips += '<span class="tb-chip vencida">Vencida ' + fecha(t.dueDate) + '</span>';
    else if (t.paraHoy) chips += '<span class="tb-chip hoy">Vence hoy</span>';
    else if (t.dueDate) chips += '<span class="tb-chip baja">Vence ' + fecha(t.dueDate) + '</span>';
    var acciones = '';
    if (t.status === 'pendiente') acciones += '<button class="btn" type="button" data-tb-mover="' + t.id + '" data-tb-a="curso">Empezar</button>';
    if (t.status === 'curso') acciones += '<button class="btn" type="button" data-tb-mover="' + t.id + '" data-tb-a="hecha">Marcar hecha</button>' +
      '<button class="btn ghost" type="button" data-tb-mover="' + t.id + '" data-tb-a="pendiente">Pausar</button>';
    if (t.status === 'hecha') acciones += '<button class="btn ghost" type="button" data-tb-mover="' + t.id + '" data-tb-a="curso">Reabrir</button>';
    acciones += '<button class="btn ghost" type="button" data-tb-nota="' + t.id + '">Nota</button>';
    if (soyAdmin) acciones += '<button class="btn ghost" type="button" data-tb-del="' + t.id + '">Borrar</button>';
    var notas = '';
    if (abierta === t.id && (t.notes || []).length) {
      notas = '<div class="tb-notas">' + t.notes.slice().reverse().map(function (n) {
        return '<div><strong>' + App.esc(n.author) + '</strong> · ' + cuando(n.at) + '<br>' + App.esc(n.text) + '</div>';
      }).join('') + '</div>';
    }
    return '<article class="tb-card" data-tb-id="' + t.id + '">' +
      '<h4>' + App.esc(t.title) + '</h4>' +
      (t.detail ? '<p>' + App.esc(t.detail) + '</p>' : '') +
      '<div class="tb-meta">' + chips + '</div>' +
      '<p class="tb-quien">' + (t.assigneeName ? 'Responsable: <strong>' + App.esc(t.assigneeName) + '</strong>' : 'Sin asignar') +
      ((t.notes || []).length ? ' · <button class="btn ghost" type="button" data-tb-ver="' + t.id + '" style="padding:2px 8px;font-size:.75rem">' + t.notes.length + ' nota' + (t.notes.length === 1 ? '' : 's') + '</button>' : '') + '</p>' +
      '<div class="tb-acc">' + acciones + '</div>' + notas +
      '</article>';
  }

  function pintar() {
    box.innerHTML = COLUMNAS.map(function (c) {
      var suyas = lista.filter(function (t) { return t.status === c[0]; });
      return '<div class="tb-col"><h3>' + c[1] + '<span>' + suyas.length + '</span></h3>' +
        (suyas.length ? suyas.map(tarjeta).join('') : '<p class="tb-vacia">Nada por acá.</p>') + '</div>';
    }).join('');

    box.querySelectorAll('[data-tb-mover]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (window.__PREVIEW__) { App.toast('Vista previa: se movería la tarea'); return; }
        try {
          await App.api('/api/trabajo/' + b.getAttribute('data-tb-mover') + '/estado', { method: 'PATCH', body: { status: b.getAttribute('data-tb-a') } });
          App.toast('Tarea actualizada');
          await cargar();
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
    box.querySelectorAll('[data-tb-nota]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var texto = prompt('Nota para esta tarea');
        if (!texto) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: se anotaría'); return; }
        try {
          abierta = b.getAttribute('data-tb-nota');
          await App.api('/api/trabajo/' + abierta + '/nota', { method: 'POST', body: { text: texto } });
          App.toast('Nota agregada');
          await cargar();
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
    box.querySelectorAll('[data-tb-ver]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-tb-ver');
        abierta = abierta === id ? '' : id;
        pintar();
      });
    });
    box.querySelectorAll('[data-tb-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('¿Borrar la tarea?')) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
        try { await App.api('/api/trabajo/' + b.getAttribute('data-tb-del'), { method: 'DELETE' }); App.toast('Tarea borrada'); await cargar(); }
        catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });

    // Entrada escalonada de las tarjetas: el tablero se arma a la vista
    var anime = window.anime;
    var cards = box.querySelectorAll('.tb-card');
    if (anime && anime.animate && !reduce && cards.length) {
      anime.animate(cards, { opacity: [0, 1], translateY: [10, 0], duration: 420, delay: anime.stagger ? anime.stagger(45) : 0, ease: 'outQuad' });
      // Red de seguridad: con la pestaña oculta el loop no corre y las tarjetas quedarían invisibles
      setTimeout(function () {
        cards.forEach(function (c) { c.style.opacity = '1'; c.style.transform = 'none'; });
      }, 900);
    }
  }

  async function cargar() {
    var q = (document.getElementById('tb-buscar') || {}).value || '';
    var resp = (document.getElementById('tb-filtro-resp') || {}).value || '';
    var venc = (document.getElementById('tb-solo-vencidas') || {}).checked;
    if (window.__PREVIEW__) {
      soyAdmin = true;
      lista = [
        { id: '1', title: 'Llamar al proveedor de packaging', detail: 'Pedir cotización por 500 unidades', assigneeName: 'Equipo', assigneeEmail: 'equipo@mail.com', priority: 'alta', dueDate: new Date().toISOString().slice(0, 10), status: 'curso', vencida: false, paraHoy: true, notes: [] },
        { id: '2', title: 'Actualizar fotos del catálogo', detail: '', assigneeName: '', assigneeEmail: '', priority: 'media', dueDate: '', status: 'pendiente', vencida: false, paraHoy: false, notes: [] },
      ];
      pintarKpis({ pendientes: 1, curso: 1, vencidas: 0, hechasSemana: 3 });
    } else {
      try {
        var qs = [];
        if (q) qs.push('q=' + encodeURIComponent(q));
        if (resp) qs.push('responsable=' + encodeURIComponent(resp));
        if (venc) qs.push('vencidas=1');
        var data = await App.api('/api/trabajo' + (qs.length ? '?' + qs.join('&') : ''));
        lista = data.rows;
        soyAdmin = data.soyAdmin;
        pintarKpis(await App.api('/api/trabajo/resumen'));
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
        return;
      }
    }
    var alta = document.getElementById('tb-alta-box');
    if (alta) alta.style.display = soyAdmin ? '' : 'none';
    var sub = document.getElementById('tb-sub');
    if (sub && !soyAdmin) sub.textContent = 'Estas son las tareas que tenés asignadas. El estado y los vencimientos los controla el servidor.';
    pintar();
  }

  // La lista de responsables sólo la puede pedir un admin: para el resto queda oculta
  async function equipo() {
    var sel = document.getElementById('tb-resp');
    var filtro = document.getElementById('tb-filtro-resp');
    var gente = [];
    if (window.__PREVIEW__) gente = [{ name: 'Persona de ejemplo', email: 'persona@mail.com' }];
    else { try { gente = await App.api('/api/trabajo/equipo'); } catch (err) { if (filtro) filtro.style.display = 'none'; return; } }
    var opts = gente.map(function (u) { return '<option value="' + attr(u.email) + '">' + App.esc(u.name) + '</option>'; }).join('');
    if (sel) sel.innerHTML = '<option value="">Sin asignar</option>' + opts;
    if (filtro) filtro.innerHTML = '<option value="">Todos los responsables</option>' + opts;
  }

  var form = document.getElementById('tb-form');
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: se crearía la tarea'); return; }
    try {
      await App.api('/api/trabajo', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      App.toast('Tarea creada');
      await cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  var buscar = document.getElementById('tb-buscar');
  if (buscar) buscar.addEventListener('input', function () { clearTimeout(buscar._t); buscar._t = setTimeout(cargar, 250); });
  var filtro = document.getElementById('tb-filtro-resp');
  if (filtro) filtro.addEventListener('change', cargar);
  var venc = document.getElementById('tb-solo-vencidas');
  if (venc) venc.addEventListener('change', cargar);

  var csv = document.getElementById('tb-csv');
  if (csv) csv.addEventListener('click', function () {
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [['Tarea', 'Detalle', 'Responsable', 'Prioridad', 'Vence', 'Estado', 'Vencida', 'Notas'].map(celda).join(';')];
    lista.forEach(function (t) {
      lineas.push([t.title, t.detail, t.assigneeName, t.priority, t.dueDate, t.status, t.vencida ? 'sí' : 'no', (t.notes || []).length].map(celda).join(';'));
    });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tablero-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  equipo();
  cargar();
})();`,
  readmeNotes: () => [
    `**Tablero del equipo**: está en \`/trabajo.html\` y no es lo mismo que **Tareas programadas** (aquellas son los trabajos automáticos del servidor; este es el trabajo de las personas). **Quién ve qué lo decide el servidor**: un administrador ve el tablero completo y cualquier otra persona registrada ve únicamente las tareas que tiene asignadas — como el registro del sitio es público, la lista del equipo con sus emails **sólo se le entrega a un admin**. Crear y asignar tareas es potestad del admin; mover el estado y anotar en la bitácora lo puede hacer también el responsable. Los pasos están validados (\`pendiente → en curso → hecha\`, y reabrir una tarea hecha la devuelve a "en curso" borrando la fecha de finalización), y las **vencidas las marca el servidor con su propia fecha**, no con la del navegador de quien mira.`,
  ],
};
