// Fila virtual / turnero de mostrador con backend real: el visitante saca su número desde
// /fila.html (nombre y teléfono opcional), el servidor le asigna el siguiente número DEL DÍA
// (colección queueturns, numeración que arranca en 1 cada día) y le devuelve un secreto propio con
// el que la página sigue su turno en vivo por sondeo liviano: "ahora atendemos el N.º X, tenés Y
// personas delante". Cuando el negocio lo llama, la página lo destaca ("¡Es tu turno!") y avisa en
// el título de la pestaña. El visitante puede cancelar su turno (solo el suyo: el secreto viaja en
// la baja). Con auth activo, /fila-admin.html es el panel solo-admin del mostrador: número en
// atención bien grande, botón "Llamar al siguiente", lista del día con marcar atendido / ausente y
// vaciado de la fila. Sin websockets: polling que corre gratis en cualquier hosting. Animado con
// Anime.js (pop del número, pulso al avanzar la fila, count-up de la espera) + red de seguridad.
// Distinto de "agenda" (turnos con fecha y horario reservados con anticipación), de "bookings"
// (solicitud de turno genérica) y de "reservamesa" (cupo por franja): acá es la fila por orden de
// llegada de un mostrador (farmacia, panadería, atención al público), sin horario.

module.exports = {
  id: 'fila', type: 'functional', name: 'Fila virtual',
  description: 'Turnero de mostrador por orden de llegada: el visitante saca número en /fila.html y sigue en vivo cuántos hay delante y qué número se atiende (sondeo liviano, aviso "¡Es tu turno!"); puede cancelar su turno. Con auth activo, panel de mostrador en /fila-admin.html con "Llamar al siguiente", atendido/ausente y vaciado del día. Colección queueturns, numeración diaria. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/fila', file: 'routes/fila.js' }],
  collections: ['queueturns'],
  nav: (cfg) => {
    const links = [{ label: 'Fila virtual', href: '/fila.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Mostrador', href: '/fila-admin.html', id: 'nav-fila-admin' });
    return links;
  },
  head: () => `  <style>
    .fv-num{font-size:3.4rem;font-weight:800;font-variant-numeric:tabular-nums;line-height:1;color:var(--accent)}
    .fv-big{text-align:center;padding:28px 20px}
    .fv-big .muted{display:block;margin-top:6px}
    .fv-estado{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:16px}
    .fv-estado .card{text-align:center;min-width:150px}
    .fv-estado strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .fv-turno{border-color:var(--accent)}
    .fv-esperando{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--line)}
    .fv-esperando.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
    .fv-esperando.off{color:#b91c1c;border-color:#b91c1c}
  </style>`,
  files: (cfg) => ({
    'routes/fila.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { str, oneOf } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// La numeración arranca en 1 cada día: la fila es siempre "la de hoy"
const hoy = () => new Date().toISOString().slice(0, 10);
const deHoy = (t) => t.day === hoy();

// Número que se está atendiendo ahora: el último llamado del día (0 = todavía no se llamó a nadie)
function atendiendo(rows) {
  let n = 0;
  for (const t of rows) if (t.status === 'llamado' && t.number > n) n = t.number;
  return n;
}

// Estado público de la fila de hoy
async function estadoFila() {
  const rows = await db.find('queueturns', deHoy);
  return {
    nowServing: atendiendo(rows),
    waiting: rows.filter(t => t.status === 'esperando').length,
    lastNumber: rows.reduce((m, t) => Math.max(m, t.number), 0),
  };
}

// GET /api/fila/estado — cómo viene la fila de hoy (público; lo sondea la página)
router.get('/estado', async (req, res) => {
  res.json(await estadoFila());
});

// POST /api/fila — saca un número (público). Devuelve el secreto con el que se sigue/cancela.
router.post('/', async (req, res) => {
  if (!str(req.body.name, 2, 60)) return res.status(422).json({ error: 'Decinos tu nombre para llamarte' });
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim().slice(0, 40) : '';
  const rows = await db.find('queueturns', deHoy);
  const row = await db.insert('queueturns', {
    day: hoy(),
    number: rows.reduce((m, t) => Math.max(m, t.number), 0) + 1,
    name: req.body.name.trim(),
    phone,
    status: 'esperando',
    secret: crypto.randomBytes(8).toString('hex'),
  });
  res.status(201).json({ id: row.id, number: row.number, secret: row.secret, ahead: rows.filter(t => t.status === 'esperando').length });
});

// GET /api/fila/turno/:id?secret= — estado del propio turno (el secreto es la llave)
router.get('/turno/:id', async (req, res) => {
  const t = await db.get('queueturns', req.params.id);
  if (!t || t.secret !== String(req.query.secret || '') || !deHoy(t)) {
    return res.status(404).json({ error: 'Ese turno no existe o ya venció (la fila arranca de cero cada día)' });
  }
  const rows = await db.find('queueturns', deHoy);
  res.json({
    number: t.number,
    status: t.status,
    nowServing: atendiendo(rows),
    ahead: rows.filter(x => x.status === 'esperando' && x.number < t.number).length,
  });
});

// DELETE /api/fila/turno/:id — el visitante cancela SU turno (solo si sigue esperando)
router.delete('/turno/:id', async (req, res) => {
  const t = await db.get('queueturns', req.params.id);
  if (!t || t.secret !== String((req.body && req.body.secret) || '')) return res.status(404).json({ error: 'Turno inexistente' });
  if (t.status !== 'esperando') return res.status(422).json({ error: 'Ese turno ya fue llamado: acercate al mostrador' });
  await db.remove('queueturns', t.id);
  res.json({ ok: true });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/fila/admin/list — la fila completa de hoy (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  const rows = await db.find('queueturns', deHoy);
  rows.sort((a, b) => a.number - b.number);
  res.json({ estado: await estadoFila(), turnos: rows.map(({ secret, ...t }) => t) });
});

// POST /api/fila/admin/next — llama al siguiente que espera (solo admin)
router.post('/admin/next', requireAdmin, async (req, res) => {
  const rows = await db.find('queueturns', (t) => deHoy(t) && t.status === 'esperando');
  if (!rows.length) return res.status(404).json({ error: 'No hay nadie esperando en la fila' });
  rows.sort((a, b) => a.number - b.number);
  const upd = await db.update('queueturns', rows[0].id, { status: 'llamado' });
  res.json({ number: upd.number, name: upd.name });
});

// PATCH /api/fila/admin/:id — marca un turno como atendido / ausente / vuelve a llamarlo (solo admin)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  if (!oneOf(req.body.status, ['atendido', 'ausente', 'llamado'])) return res.status(422).json({ error: 'Estado inválido' });
  const row = await db.update('queueturns', req.params.id, { status: req.body.status });
  if (!row) return res.status(404).json({ error: 'Turno inexistente' });
  const { secret, ...sin } = row;
  res.json(sin);
});

// POST /api/fila/admin/reset — vacía la fila de hoy (solo admin; cierre de jornada)
router.post('/admin/reset', requireAdmin, async (req, res) => {
  const rows = await db.find('queueturns', deHoy);
  for (const t of rows) await db.remove('queueturns', t.id);
  res.json({ removed: rows.length });
});
` : `// El panel del mostrador (llamar al siguiente, atendido/ausente, vaciar la fila) requiere el
// módulo de autenticación: activalo en el Builder para habilitar /fila-admin.html. Sin él, la
// fila igual toma números; podés operarla a mano editando data/queueturns.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      fila: {
        title: 'Fila virtual',
        html: `  <section>
    <div class="container" style="max-width:560px">
      <h2>Fila virtual</h2>
      <p class="section-sub">Sacá tu número desde el celu y seguí la fila en vivo: te avisamos cuando sea tu turno, sin hacer cola parado.</p>
      <div id="fv-box"><p class="muted">Cargando la fila…</p></div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['fila-admin'] = {
        title: 'Mostrador',
        html: `  <section>
    <div class="container" style="max-width:760px">
      <h2>Mostrador</h2>
      <p class="section-sub">La fila de hoy: llamá al siguiente y marcá cómo terminó cada turno. Solo visible para administradores.</p>
      <div class="card fv-big" id="fv-now"><span class="muted">Cargando…</span></div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:18px 0 26px">
        <button class="btn" type="button" id="fv-next">Llamar al siguiente</button>
        <button class="btn ghost" type="button" id="fv-reset">Vaciar la fila de hoy</button>
      </div>
      <div id="fv-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo fila virtual: sacar número y seguir la fila en vivo en /fila.html (sondeo liviano,
   aviso "¡Es tu turno!"); con auth activo, el panel del mostrador en /fila-admin.html. Animado
   con Anime.js (pop del número, pulso al avanzar) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function pop(el) {
    var anime = window.anime;
    if (anime && anime.animate && !reduce && el) {
      anime.animate(el, { scale: [0.85, 1], opacity: [0, 1], duration: 420, ease: 'outBack' });
      // Red de seguridad: fija el estado final aunque el loop esté pausado (pestaña oculta)
      setTimeout(function () { el.style.opacity = 1; el.style.transform = 'none'; }, 800);
    }
  }

  // ---- Página pública /fila.html ----
  var box = document.getElementById('fv-box');
  if (box) {
    var timer = null;
    var tituloOriginal = document.title;
    var mio = null;
    try { mio = JSON.parse(localStorage.getItem('fv-turno') || 'null'); } catch (e) {}

    function pintarForm(estado) {
      document.title = tituloOriginal;
      box.innerHTML = '<div class="fv-estado">' +
        '<div class="card"><strong>' + (estado.nowServing || '—') + '</strong><span class="muted">Atendiendo ahora</span></div>' +
        '<div class="card"><strong>' + estado.waiting + '</strong><span class="muted">' + (estado.waiting === 1 ? 'Persona en fila' : 'Personas en fila') + '</span></div>' +
      '</div>' +
      '<form id="fv-form" class="card" style="margin-top:18px">' +
        '<label>Tu nombre</label><input name="name" required minlength="2" maxlength="60" placeholder="Para llamarte por tu nombre">' +
        '<label>Teléfono (opcional)</label><input name="phone" maxlength="40" placeholder="Por si necesitamos avisarte">' +
        '<button class="btn" type="submit" style="margin-top:14px">Sacar mi número</button>' +
      '</form>';
      var formF = document.getElementById('fv-form');
      formF.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (window.__PREVIEW__) { App.toast('Vista previa: sacarías tu número'); return; }
        try {
          var r = await App.api('/api/fila', { method: 'POST', body: { name: formF.querySelector('[name="name"]').value, phone: formF.querySelector('[name="phone"]').value } });
          mio = { id: r.id, secret: r.secret };
          try { localStorage.setItem('fv-turno', JSON.stringify(mio)); } catch (e2) {}
          seguir();
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    }

    function pintarTurno(t) {
      var esMiTurno = t.status === 'llamado';
      // Aviso en la pestaña: útil si el visitante está mirando otra cosa mientras espera
      document.title = esMiTurno ? '¡Es tu turno! — ' + tituloOriginal : '#' + t.number + ' · atienden ' + (t.nowServing || '—') + ' — ' + tituloOriginal;
      var html = '<div class="card fv-big' + (esMiTurno ? ' fv-turno' : '') + '" id="fv-mi-card">';
      if (esMiTurno) {
        html += '<span class="fv-num">¡Es tu turno!</span><span class="muted">Acercate al mostrador: tu número es el ' + t.number + '.</span>';
      } else if (t.status === 'atendido' || t.status === 'ausente') {
        html += '<span class="fv-num">' + t.number + '</span><span class="muted">' + (t.status === 'atendido' ? 'Tu turno ya fue atendido. ¡Gracias por venir!' : 'Figurás como ausente: sacá un número nuevo si seguís acá.') + '</span>';
      } else {
        html += '<span class="fv-num">' + t.number + '</span><span class="muted">Tu número en la fila de hoy</span>';
      }
      html += '</div>';
      if (t.status === 'esperando') {
        html += '<div class="fv-estado">' +
          '<div class="card"><strong>' + (t.nowServing || '—') + '</strong><span class="muted">Atendiendo ahora</span></div>' +
          '<div class="card"><strong id="fv-ahead">' + t.ahead + '</strong><span class="muted">' + (t.ahead === 1 ? 'Persona delante' : 'Personas delante') + '</span></div>' +
        '</div>' +
        '<p style="text-align:center;margin-top:16px"><button class="btn ghost" type="button" id="fv-cancelar">Cancelar mi turno</button></p>';
      } else {
        html += '<p style="text-align:center;margin-top:16px"><button class="btn ghost" type="button" id="fv-salir">' + (esMiTurno ? 'Listo' : 'Sacar un número nuevo') + '</button></p>';
      }
      box.innerHTML = html;
      pop(document.getElementById('fv-mi-card'));
      var btnC = document.getElementById('fv-cancelar');
      if (btnC) btnC.addEventListener('click', async function () {
        if (!confirm('¿Cancelar tu turno y salir de la fila?')) return;
        try { await App.api('/api/fila/turno/' + mio.id, { method: 'DELETE', body: { secret: mio.secret } }); } catch (e) {}
        salir();
      });
      var btnS = document.getElementById('fv-salir');
      if (btnS) btnS.addEventListener('click', salir);
    }

    function salir() {
      mio = null;
      try { localStorage.removeItem('fv-turno'); } catch (e) {}
      clearTimeout(timer);
      inicio();
    }

    var ultimoAhead = null;
    function seguir() {
      if (!mio) return;
      fetch('/api/fila/turno/' + encodeURIComponent(mio.id) + '?secret=' + encodeURIComponent(mio.secret))
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) { salir(); return; }
          // Solo repinta si algo cambió (evita parpadeo del sondeo)
          if (ultimoAhead === null || ultimoAhead.status !== res.d.status || ultimoAhead.ahead !== res.d.ahead || ultimoAhead.nowServing !== res.d.nowServing) {
            pintarTurno(res.d);
          }
          ultimoAhead = res.d;
          clearTimeout(timer);
          if (res.d.status === 'esperando' || res.d.status === 'llamado') {
            timer = setTimeout(seguir, 5000);
          }
        })
        .catch(function () { clearTimeout(timer); timer = setTimeout(seguir, 8000); });
    }

    function inicio() {
      if (window.__PREVIEW__) { pintarForm({ nowServing: 12, waiting: 4, lastNumber: 16 }); return; }
      if (mio) { seguir(); return; }
      fetch('/api/fila/estado').then(function (r) { return r.json(); }).then(pintarForm)
        .catch(function () { box.innerHTML = '<p class="muted">No pudimos cargar la fila.</p>'; });
    }
    inicio();
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /fila-admin.html ----
  var adminBox = document.getElementById('fv-admin');
  var nowBox = document.getElementById('fv-now');
  if (adminBox && nowBox) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var turnos = [];
    var estado = { nowServing: 0, waiting: 0 };
    var LBL = { esperando: 'Esperando', llamado: 'Llamado', atendido: 'Atendido', ausente: 'Ausente' };
    var timerA = null;

    function pintarNow() {
      nowBox.innerHTML = '<span class="fv-num" id="fv-now-num">' + (estado.nowServing || '—') + '</span>' +
        '<span class="muted">Atendiendo ahora · ' + estado.waiting + ' en espera</span>';
    }

    function pintar() {
      pintarNow();
      adminBox.innerHTML = App.table(turnos, [
        { label: 'N.º', render: function (r) { return '<strong>' + r.number + '</strong>'; } },
        { key: 'name', label: 'Nombre' },
        { label: 'Teléfono', render: function (r) { return r.phone ? App.esc(r.phone) : '<span class="muted">—</span>'; } },
        { label: 'Estado', render: function (r) {
          var cls = r.status === 'esperando' || r.status === 'llamado' ? ' on' : (r.status === 'ausente' ? ' off' : '');
          return '<span class="fv-esperando' + cls + '">' + (LBL[r.status] || r.status) + '</span>';
        } },
        { label: 'Acciones', render: function (r) {
          if (r.status === 'llamado') {
            return '<button class="btn ghost" type="button" data-ok="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Atendido</button>' +
              '<button class="btn ghost" type="button" data-no="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Ausente</button>';
          }
          if (r.status === 'ausente') return '<button class="btn ghost" type="button" data-re="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Volver a llamar</button>';
          return '';
        } },
      ]);
      adminBox.querySelectorAll('[data-ok]').forEach(function (b) { b.addEventListener('click', function () { marcar(b.getAttribute('data-ok'), 'atendido'); }); });
      adminBox.querySelectorAll('[data-no]').forEach(function (b) { b.addEventListener('click', function () { marcar(b.getAttribute('data-no'), 'ausente'); }); });
      adminBox.querySelectorAll('[data-re]').forEach(function (b) { b.addEventListener('click', function () { marcar(b.getAttribute('data-re'), 'llamado'); }); });
    }

    async function marcar(id, status) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se marcaría el turno'); return; }
      try {
        var upd = await App.api('/api/fila/admin/' + id, { method: 'PATCH', body: { status: status } });
        turnos = turnos.map(function (r) { return r.id === id ? upd : r; });
        estado.nowServing = turnos.filter(function (r) { return r.status === 'llamado'; }).reduce(function (m, r) { return Math.max(m, r.number); }, 0);
        estado.waiting = turnos.filter(function (r) { return r.status === 'esperando'; }).length;
        pintar();
        App.toast('Turno ' + (LBL[status] || status).toLowerCase());
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    function cargar(primera) {
      App.api('/api/fila/admin/list').then(function (d) {
        turnos = d.turnos; estado = d.estado; pintar();
      }).catch(function (err) { if (primera) adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }

    var btnNext = document.getElementById('fv-next');
    if (btnNext) btnNext.addEventListener('click', async function () {
      if (window.__PREVIEW__) { App.toast('Vista previa: se llamaría al siguiente'); return; }
      try {
        var r = await App.api('/api/fila/admin/next', { method: 'POST' });
        App.toast('Llamando al N.º ' + r.number + ' (' + r.name + ')');
        cargar(false);
        pop(nowBox);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var btnReset = document.getElementById('fv-reset');
    if (btnReset) btnReset.addEventListener('click', async function () {
      if (window.__PREVIEW__) { App.toast('Vista previa: se vaciaría la fila'); return; }
      if (!confirm('¿Vaciar TODA la fila de hoy? Los que esperan pierden su número.')) return;
      try {
        var r = await App.api('/api/fila/admin/reset', { method: 'POST' });
        App.toast('Fila vaciada (' + r.removed + ' turnos)');
        cargar(false);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (window.__PREVIEW__) {
      turnos = [
        { id: 'd1', number: 12, name: 'Ana López', phone: '11 5555-5555', status: 'llamado' },
        { id: 'd2', number: 13, name: 'Juan Pérez', phone: '', status: 'esperando' },
        { id: 'd3', number: 14, name: 'Marta Ruiz', phone: '11 4444-4444', status: 'esperando' },
      ];
      estado = { nowServing: 12, waiting: 2 };
      pintar();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      cargar(true);
      // La fila se mueve sola: refresco liviano para ver los números nuevos sin tocar nada
      timerA = setInterval(function () { cargar(false); }, 6000);
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navF = document.getElementById('nav-fila-admin');
    if (navF && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navF.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Fila virtual**: los turnos del día viven en la colección \`queueturns\` (la numeración arranca en 1 cada día). El visitante saca número en \`/fila.html\` y sigue la fila en vivo (sondeo cada 5 s, aviso "¡Es tu turno!" también en el título de la pestaña); puede cancelar su turno mientras espera. ${cfg.moduleIds.includes('auth') ? 'El mostrador se opera desde \`/fila-admin.html\`: "Llamar al siguiente", atendido/ausente y vaciado de la fila al cierre.' : 'Para operar el mostrador desde la web activá el módulo **Autenticación** (habilita \`/fila-admin.html\`); sin él, la fila igual toma números.'} No requiere websockets: funciona por sondeo liviano en cualquier hosting gratuito.`,
  ],
};
