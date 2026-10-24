// Reserva de mesa para restaurante/bar con backend real y control de cupo: una sección pública en la
// Home donde el visitante elige fecha, turno (mediodía o noche) y cantidad de personas, deja sus
// datos y el servidor confirma la reserva SOLO si todavía hay lugar en ese turno (suma las personas
// ya reservadas para esa fecha+turno contra un cupo configurable y rechaza con 409 si se completó).
// Devuelve un código de reserva. Con el módulo de autenticación activo, /mesas-admin.html es un panel
// solo-admin con la agenda de reservas (por fecha), el estado (pendiente/confirmada/cancelada) y el
// cupo usado por turno; permite confirmar o cancelar. Sin auth, las reservas igual se guardan y el
// negocio las ve en data/tablebookings.json. La ocupación del turno se muestra con un count-up de
// Anime.js (red de seguridad + respeta "prefers-reduced-motion"). Complementa el módulo "menu"
// (carta) para dejar el vertical gastronómico completo. Distinto de "bookings" (turnos genéricos sin
// cupo por franja) y de "eventregister" (inscripción a eventos con cupo total, no por turno diario).

// Turnos del día (constante compartida cliente/servidor). Ajustá las franjas a tu operación.
const TURNOS = [
  { id: 'mediodia', label: 'Mediodía (12:00 a 15:30)' },
  { id: 'noche', label: 'Noche (20:00 a 23:30)' },
];
// Cupo de personas por turno (capacidad del salón por franja). Editable en routes/reservamesa.js.
const CUPO_POR_TURNO = 40;

module.exports = {
  id: 'reservamesa', type: 'functional', name: 'Reserva de mesa',
  description: 'Sección "Reservá tu mesa": el visitante elige fecha, turno y cantidad de personas y el servidor confirma solo si hay cupo en ese turno (rechaza cuando se completó), devolviendo un código. Ocupación animada con Anime.js. Con auth activo, panel solo-admin en /mesas-admin.html con la agenda por fecha y confirmación/cancelación. Ideal para restaurantes y bares (complementa la carta).',
  usesAnime: true,
  mounts: [{ route: '/api/tablebooking', file: 'routes/reservamesa.js' }],
  collections: ['tablebookings'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Reservas', href: '/mesas-admin.html', id: 'nav-mesas-admin' }] : [],
  html: () => `  <section id="reservar-mesa">
    <div class="container" style="max-width:640px">
      <h2>Reservá tu mesa</h2>
      <p class="section-sub">Elegí día, turno y cuántos son. Te confirmamos al instante si hay lugar.</p>
      <form id="rm-form" class="card">
        <div class="grid cols-2" style="gap:14px">
          <div><label for="rm-fecha">Fecha</label><input type="date" name="date" id="rm-fecha" required></div>
          <div><label for="rm-turno">Turno</label><select name="turn" id="rm-turno" required></select></div>
        </div>
        <label for="rm-personas">Cantidad de personas</label>
        <input type="number" name="people" id="rm-personas" min="1" max="20" value="2" required>
        <div id="rm-cupo" class="rm-cupo" hidden></div>
        <div class="grid cols-2" style="gap:14px">
          <div><label for="rm-nombre">Nombre y apellido</label><input name="name" id="rm-nombre" required minlength="2" maxlength="80" placeholder="Ej: Ana Pérez"></div>
          <div><label for="rm-tel">Teléfono</label><input name="phone" id="rm-tel" required minlength="6" maxlength="30" placeholder="Ej: 11 5555 5555"></div>
        </div>
        <label for="rm-nota">Comentario (opcional)</label>
        <input name="note" id="rm-nota" maxlength="200" placeholder="Ej: mesa cerca de la ventana, festejo de cumpleaños…">
        <button class="btn" type="submit" style="margin-top:12px">Reservar mesa</button>
      </form>
      <div id="rm-result" hidden></div>
      <noscript><p class="muted">Activá JavaScript para reservar tu mesa online.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    .rm-cupo{margin:4px 0 4px;font-size:.85rem;color:var(--muted)}
    .rm-cupo strong{color:var(--accent);font-variant-numeric:tabular-nums}
    .rm-cupo.full{color:#c0392b}
    .rm-cupo.full strong{color:#c0392b}
    #rm-result{margin-top:16px;background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:0 var(--radius) var(--radius) 0;padding:18px 20px}
    #rm-result.err{border-left-color:#c0392b}
    #rm-result h3{margin:0 0 6px}
    .rm-code{font-size:1.5rem;font-weight:800;color:var(--accent);letter-spacing:.06em}
    .rm-det{color:var(--muted);margin:8px 0 0;font-size:.92rem}
  </style>`,
  files: (cfg) => ({
    'routes/reservamesa.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num, oneOf, dateISO } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
// Turnos válidos (deben coincidir con los que ofrece el formulario en el frontend)
const TURNOS = ${JSON.stringify(TURNOS)};
const TURN_IDS = TURNOS.map(t => t.id);
// Cupo de personas por turno (capacidad del salón por franja). Ajustá este número a tu operación.
const CUPO_POR_TURNO = ${CUPO_POR_TURNO};

// Suma las personas ya reservadas (no canceladas) para una fecha + turno
async function personasReservadas(date, turn) {
  const rows = await db.find('tablebookings', r => r.date === date && r.turn === turn && r.status !== 'cancelada');
  return rows.reduce((acc, r) => acc + (Number(r.people) || 0), 0);
}

// Solo fechas de hoy en adelante (no se reserva para el pasado)
function fechaFutura(v) {
  if (!dateISO(v)) return false;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const d = new Date(v + 'T00:00:00');
  return d >= hoy;
}

// GET /api/tablebooking/availability?date=&turn= — cupo usado y disponible de un turno (público)
router.get('/availability', async (req, res) => {
  const date = String(req.query.date || '').trim();
  const turn = String(req.query.turn || '').trim();
  if (!fechaFutura(date)) return res.status(422).json({ error: 'Elegí una fecha válida (de hoy en adelante)' });
  if (!oneOf(turn, TURN_IDS)) return res.status(422).json({ error: 'Turno inválido' });
  const usado = await personasReservadas(date, turn);
  res.json({ date, turn, capacity: CUPO_POR_TURNO, used: usado, free: Math.max(0, CUPO_POR_TURNO - usado) });
});

// GET /api/tablebooking/turnos — turnos disponibles (para el desplegable)
router.get('/turnos', (req, res) => res.json(TURNOS));

// POST /api/tablebooking — crea una reserva si hay cupo en el turno (público)
router.post('/', async (req, res) => {
  const { ok, errors } = check(req.body, {
    name: (v) => str(v, 2, 80),
    phone: (v) => str(v, 6, 30),
    people: (v) => num(v, 1, 20),
  });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const date = String(req.body.date || '').trim();
  const turn = String(req.body.turn || '').trim();
  if (!fechaFutura(date)) return res.status(422).json({ error: 'Elegí una fecha válida (de hoy en adelante)', errors: { date: 'Fecha inválida' } });
  if (!oneOf(turn, TURN_IDS)) return res.status(422).json({ error: 'Elegí un turno válido', errors: { turn: 'Turno inválido' } });
  const people = Math.round(req.body.people);
  // Control de cupo real: si sumar esta reserva supera la capacidad del turno, se rechaza
  const usado = await personasReservadas(date, turn);
  if (usado + people > CUPO_POR_TURNO) {
    return res.status(409).json({ error: 'Ese turno ya está completo. Probá con otra fecha u otro turno.', free: Math.max(0, CUPO_POR_TURNO - usado) });
  }
  // Código de reserva legible (para que el cliente lo muestre al llegar)
  const code = 'M-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const row = await db.insert('tablebookings', {
    name: req.body.name.trim(),
    phone: req.body.phone.trim(),
    people,
    date,
    turn,
    note: typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 200) : '',
    status: 'pendiente',
    code,
  });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): entró una reserva de mesa.
  // Es "disparar y seguir": un email caído jamás rompe la reserva.
  mailer.notify('Nueva reserva de mesa: ' + date, row.name + ' (tel. ' + row.phone + ') reservó para ' + people + (people === 1 ? ' persona' : ' personas') + ' el ' + date + ', turno ' + ((TURNOS.find(t => t.id === turn) || {}).label || turn) + '. Código: ' + code + '. Confirmala desde el panel de mesas.').catch(() => {});
` : ''}  res.status(201).json({ code: row.code, date, turn, people, status: row.status, free: Math.max(0, CUPO_POR_TURNO - usado - people) });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/tablebooking — todas las reservas, más recientes primero (solo admin); ?date= filtra por fecha
router.get('/', requireAdmin, async (req, res) => {
  let rows = (await db.all('tablebookings')).reverse();
  const date = String(req.query.date || '').trim();
  if (date) rows = rows.filter(r => r.date === date);
  res.json(rows.map(r => ({ ...r, turnLabel: (TURNOS.find(t => t.id === r.turn) || {}).label || r.turn })));
});

// PATCH /api/tablebooking/:id — cambia el estado de una reserva (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const status = String(req.body.status || '').trim();
  if (!oneOf(status, ['pendiente', 'confirmada', 'cancelada'])) return res.status(422).json({ error: 'Estado inválido' });
  const row = await db.update('tablebookings', req.params.id, { status });
  if (!row) return res.status(404).json({ error: 'Reserva inexistente' });
  res.json(row);
});

// DELETE /api/tablebooking/:id — borra una reserva (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const r = await db.get('tablebookings', req.params.id);
  if (!r) return res.status(404).json({ error: 'Reserva inexistente' });
  await db.remove('tablebookings', req.params.id);
  res.json({ ok: true });
});
` : `// El panel de reservas (agenda, confirmar/cancelar) requiere el módulo de autenticación: activalo en
// el Builder para habilitar /mesas-admin.html. Sin él, las reservas se guardan igual y podés verlas
// en data/tablebookings.json.
`}module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'mesas-admin': {
      title: 'Reservas de mesa',
      html: `  <section>
    <div class="container">
      <h2>Reservas de mesa</h2>
      <p class="section-sub">Agenda de reservas por fecha. Confirmá o cancelá y controlá el cupo de cada turno. Solo visible para administradores.</p>
      <div class="card" style="max-width:420px;margin-bottom:22px">
        <label for="rm-adm-fecha">Ver reservas del día</label>
        <input type="date" id="rm-adm-fecha">
        <div id="rm-adm-cupo" class="rm-cupo" style="margin-top:10px"></div>
      </div>
      <div id="rm-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo reserva de mesa: sección pública en la Home (elegir fecha/turno/personas → confirmación con
   código si hay cupo, ocupación con count-up de Anime.js) y, con auth activo, el panel de agenda en
   /mesas-admin.html. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TURNOS = ${JSON.stringify(TURNOS)};
  var CUPO = ${CUPO_POR_TURNO};

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = hasta; return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 500, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = hasta; }, 700);
  }

  function estadoBadge(s) {
    var map = { pendiente: 'rm-b', confirmada: 'rm-b on', cancelada: 'rm-b off' };
    return '<span class="' + (map[s] || 'rm-b') + '">' + App.esc(s) + '</span>';
  }

  // ---- Sección pública (Home) ----
  var form = document.getElementById('rm-form');
  if (form) {
    var selTurno = document.getElementById('rm-turno');
    if (selTurno) selTurno.innerHTML = TURNOS.map(function (t) { return '<option value="' + App.esc(t.id) + '">' + App.esc(t.label) + '</option>'; }).join('');
    var inFecha = document.getElementById('rm-fecha');
    var inPersonas = document.getElementById('rm-personas');
    var cupoBox = document.getElementById('rm-cupo');
    var result = document.getElementById('rm-result');

    // Fecha mínima = hoy (no se reserva para el pasado)
    (function () {
      var hoy = new Date(); var m = String(hoy.getMonth() + 1).padStart(2, '0'); var d = String(hoy.getDate()).padStart(2, '0');
      if (inFecha) inFecha.min = hoy.getFullYear() + '-' + m + '-' + d;
    })();

    function mostrarCupo() {
      if (!cupoBox || !inFecha || !selTurno) return;
      var date = inFecha.value, turn = selTurno.value;
      if (!date || !turn) { cupoBox.hidden = true; return; }
      function pintar(free) {
        cupoBox.hidden = false;
        var lleno = free <= 0;
        cupoBox.classList.toggle('full', lleno);
        cupoBox.innerHTML = lleno
          ? 'Ese turno está <strong>completo</strong>. Probá con otra fecha u otro turno.'
          : 'Quedan <strong id="rm-free">0</strong> lugares en este turno.';
        if (!lleno) contar(document.getElementById('rm-free'), free);
      }
      if (window.__PREVIEW__) { pintar(CUPO - 6); return; }
      App.api('/api/tablebooking/availability?date=' + encodeURIComponent(date) + '&turn=' + encodeURIComponent(turn))
        .then(function (r) { pintar(r.free); })
        .catch(function () { cupoBox.hidden = true; });
    }
    if (inFecha) inFecha.addEventListener('change', mostrarCupo);
    if (selTurno) selTurno.addEventListener('change', mostrarCupo);

    function mostrarOk(r) {
      if (!result) return;
      result.hidden = false; result.classList.remove('err');
      var turnLabel = (TURNOS.filter(function (t) { return t.id === r.turn; })[0] || {}).label || r.turn;
      result.innerHTML = '<h3>¡Mesa reservada!</h3>' +
        '<p class="rm-code">' + App.esc(r.code) + '</p>' +
        '<p class="rm-det">Para <strong>' + r.people + (r.people === 1 ? ' persona' : ' personas') + '</strong> · ' + App.esc(r.date) + ' · ' + App.esc(turnLabel) + '.<br>Mostrá este código al llegar. Te esperamos.</p>';
      var anime = window.anime;
      if (anime && anime.animate && !reduce) anime.animate(result, { opacity: [0, 1], translateY: [10, 0], duration: 400, ease: 'outCubic' });
    }
    function mostrarError(msg) {
      if (!result) return;
      result.hidden = false; result.classList.add('err');
      result.innerHTML = '<h3>No pudimos reservar</h3><p class="rm-det" style="margin:0">' + App.esc(msg) + '</p>';
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        name: document.getElementById('rm-nombre').value,
        phone: document.getElementById('rm-tel').value,
        people: Number(inPersonas.value),
        date: inFecha.value,
        turn: selTurno.value,
        note: document.getElementById('rm-nota').value,
      };
      if (!datos.date) { App.toast('Elegí una fecha'); return; }
      if (window.__PREVIEW__) {
        mostrarOk({ code: 'M-AB123', date: datos.date, turn: datos.turn, people: datos.people });
        return;
      }
      try {
        var r = await App.api('/api/tablebooking', { method: 'POST', body: datos });
        mostrarOk(r);
        form.reset();
        if (cupoBox) cupoBox.hidden = true;
      } catch (err) {
        if (err.message !== 'preview') mostrarError(err.message);
      }
    });
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /mesas-admin.html ----
  var adminBox = document.getElementById('rm-admin');
  if (adminBox) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var reservas = [];
    var inFechaAdm = document.getElementById('rm-adm-fecha');
    var cupoAdm = document.getElementById('rm-adm-cupo');

    function pintarCupo() {
      if (!cupoAdm) return;
      if (!reservas.length) { cupoAdm.innerHTML = ''; return; }
      // Ocupación por turno de las reservas mostradas (no canceladas)
      var porTurno = {};
      TURNOS.forEach(function (t) { porTurno[t.id] = 0; });
      reservas.forEach(function (r) { if (r.status !== 'cancelada' && porTurno[r.turn] !== undefined) porTurno[r.turn] += (Number(r.people) || 0); });
      cupoAdm.innerHTML = TURNOS.map(function (t) {
        var u = porTurno[t.id] || 0;
        return '<div>' + App.esc(t.label) + ': <strong>' + u + '/' + CUPO + '</strong> personas</div>';
      }).join('');
    }

    function pintar() {
      adminBox.innerHTML = App.table(reservas, [
        { label: 'Fecha', render: function (r) { return App.esc(r.date); } },
        { label: 'Turno', render: function (r) { return App.esc(r.turnLabel || r.turn); } },
        { key: 'name', label: 'Cliente' },
        { label: 'Personas', render: function (r) { return String(r.people); } },
        { label: 'Teléfono', render: function (r) { return App.esc(r.phone); } },
        { label: 'Nota', render: function (r) { return r.note ? App.esc(r.note) : '<span class="muted">—</span>'; } },
        { label: 'Estado', render: function (r) { return estadoBadge(r.status); } },
        { label: 'Código', render: function (r) { return '<code>' + App.esc(r.code) + '</code>'; } },
        { label: 'Acciones', render: function (r) {
          return (r.status !== 'confirmada' ? '<button class="btn ghost" type="button" data-ok="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Confirmar</button>' : '') +
            (r.status !== 'cancelada' ? '<button class="btn ghost" type="button" data-no="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Cancelar</button>' : '') +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-ok]').forEach(function (b) { b.addEventListener('click', function () { cambiar(b.getAttribute('data-ok'), 'confirmada'); }); });
      adminBox.querySelectorAll('[data-no]').forEach(function (b) { b.addEventListener('click', function () { cambiar(b.getAttribute('data-no'), 'cancelada'); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
      pintarCupo();
    }

    async function cambiar(id, status) {
      if (window.__PREVIEW__) { App.toast('Vista previa: la reserva quedaría ' + status); return; }
      try {
        var row = await App.api('/api/tablebooking/' + id, { method: 'PATCH', body: { status: status } });
        reservas = reservas.map(function (r) { return r.id === id ? { ...r, status: row.status } : r; });
        pintar();
        App.toast('Reserva ' + status);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar esta reserva?')) return;
      try {
        await App.api('/api/tablebooking/' + id, { method: 'DELETE' });
        reservas = reservas.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Reserva borrada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    function cargar() {
      var date = inFechaAdm ? inFechaAdm.value : '';
      if (window.__PREVIEW__) {
        reservas = [
          { id: 'd1', date: date || '2026-01-01', turn: 'noche', turnLabel: 'Noche (20:00 a 23:30)', name: 'Ana Pérez', people: 4, phone: '11 5555 5555', note: 'Festejo', status: 'confirmada', code: 'M-AB123' },
          { id: 'd2', date: date || '2026-01-01', turn: 'mediodia', turnLabel: 'Mediodía (12:00 a 15:30)', name: 'Luis Gómez', people: 2, phone: '11 4444 4444', note: '', status: 'pendiente', code: 'M-CD456' },
        ];
        pintar();
        return;
      }
      var qs = date ? '?date=' + encodeURIComponent(date) : '';
      App.api('/api/tablebooking' + qs).then(function (rows) { reservas = rows; pintar(); }).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
    if (inFechaAdm) inFechaAdm.addEventListener('change', cargar);

    if (window.__PREVIEW__) { cargar(); }
    else if (!me || me.role !== 'admin') { location.href = '/auth.html'; }
    else { cargar(); }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navM = document.getElementById('nav-mesas-admin');
    if (navM && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navM.style.display = 'none';
  })();
` : ''}
  // Estilos de los badges de estado del panel (inyectados una vez)
  (function () {
    if (document.getElementById('rm-badge-css')) return;
    var st = document.createElement('style'); st.id = 'rm-badge-css';
    st.textContent = '.rm-b{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--line);text-transform:capitalize}.rm-b.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}.rm-b.off{opacity:.6;text-decoration:line-through}';
    document.head.appendChild(st);
  })();
})();`,
  readmeNotes: (cfg) => [
    `**Reserva de mesa**: las reservas viven en la colección \`tablebookings\`. El visitante reserva desde la Home eligiendo fecha, turno y personas; el servidor confirma **solo si hay cupo** en ese turno (capacidad por turno configurable en \`CUPO_POR_TURNO\` dentro de \`routes/reservamesa.js\`, default ${CUPO_POR_TURNO} personas) y devuelve un código de reserva. ${cfg.moduleIds.includes('auth') ? 'Los administradores ven la agenda por fecha, el cupo usado por turno y confirman/cancelan reservas en \`/mesas-admin.html\`.' : 'Para ver y administrar las reservas desde la web activá el módulo **Autenticación** (habilita \`/mesas-admin.html\`); sin él, las reservas se guardan en \`data/tablebookings.json\`.'} Ajustá los turnos en la constante \`TURNOS\`.`,
  ],
};
