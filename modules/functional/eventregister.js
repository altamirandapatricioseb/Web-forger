// Inscripción a eventos (RSVP) con cupos: sección en la Home que lista los eventos
// próximos (constante EVENTOS, editable) y deja anotarse dejando nombre y email. El
// backend guarda las inscripciones (colección eventregistrations), controla el cupo de
// cada evento y devuelve un código de confirmación (EV-XXXXXX). Una inscripción por
// email por evento (idempotente: si ya estabas anotado te devuelve tu mismo código). El
// contador de lugares disponibles baja en vivo y cuenta con Anime.js (red de seguridad
// setTimeout + respeta "prefers-reduced-motion"). Con el módulo de autenticación activo,
// suma una página /inscripciones.html solo-admin con el listado por evento y CSV. Sin
// auth la inscripción funciona igual y las anotaciones se leen en data/eventregistrations.json.
// Distinto de "events" (UI decorativa de próximos eventos) y de "bookings" (agenda de
// turnos): acá el visitante se inscribe a un evento con cupo limitado.
// Con el módulo "eventos" (Eventos administrables) activo, la constante EVENTOS se reemplaza por
// la colección eventitems: la agenda deja de estar horneada en DOS lugares (acá y en la sección)
// y se carga una sola vez desde el panel. Entran los eventos visibles, vigentes y con cupo > 0.
const EVENTOS = [
  { id: 'ev1', title: 'Taller de introducción', date: '2026-08-12', time: '18:00', place: 'Sede central', capacity: 30, description: 'Un encuentro práctico para arrancar con lo esencial. Cupos limitados.' },
  { id: 'ev2', title: 'Webinar en vivo', date: '2026-08-20', time: '19:30', place: 'Online (Zoom)', capacity: 100, description: 'Charla online con preguntas y respuestas al final. Te mandamos el link por email.' },
  { id: 'ev3', title: 'Jornada para clientes', date: '2026-09-05', time: '10:00', place: 'Auditorio', capacity: 60, description: 'Novedades, casos reales y networking. Desayuno incluido.' },
];

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'eventregister', type: 'functional', name: 'Inscripción a eventos',
  description: 'Sección para anotarse a eventos con cupo limitado: el visitante deja nombre y email, recibe un código de confirmación y ve los lugares disponibles en vivo (Anime.js). Con auth activo, panel admin en /inscripciones.html con listado por evento y CSV.',
  usesAnime: true,
  mounts: [{ route: '/api/eventregister', file: 'routes/eventregister.js' }],
  collections: ['eventregistrations'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Inscripciones', href: '/inscripciones.html', id: 'nav-inscripciones' }] : [],
  html: () => `  <section id="inscripcion-eventos">
    <div class="container">
      <h2>Inscribite a nuestros eventos</h2>
      <p class="section-sub">Elegí un evento y reservá tu lugar. Los cupos son limitados y se van completando.</p>
      <div class="grid cols-3" id="er-lista"><p class="muted">Cargando eventos…</p></div>
      <noscript><p class="muted">Activá JavaScript para inscribirte a los eventos.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    .er-card{display:flex;flex-direction:column;gap:8px}
    .er-fecha{color:var(--accent);font-weight:700;font-size:.9rem}
    .er-meta{font-size:.85rem;color:var(--muted)}
    .er-cupo{display:flex;align-items:center;gap:8px;margin:4px 0 2px;font-size:.9rem}
    .er-cupo strong{font-variant-numeric:tabular-nums}
    .er-barra{flex:1;height:7px;background:var(--line);border-radius:999px;overflow:hidden}
    .er-relleno{height:100%;width:0;background:var(--accent);border-radius:999px}
    .er-form{display:grid;gap:8px;margin-top:6px}
    .er-form input{width:100%}
    .er-ok{background:var(--surface);border-left:3px solid var(--accent);padding:10px 14px;border-radius:0 var(--radius) var(--radius) 0;font-size:.9rem}
    .er-codigo{font-weight:800;color:var(--accent);letter-spacing:.05em}
    .er-lleno{opacity:.75}
    .er-agotado{color:#b91c1c;font-weight:700;font-size:.85rem}
  </style>`,
  files: (cfg) => ({
    'routes/eventregister.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { check, str, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
${cfg.moduleIds.includes('eventos') ? `// AGENDA COMPARTIDA con el módulo "Eventos administrables": la fuente es la colección eventitems,
// así el negocio carga sus eventos en UN solo lugar en vez de repetirlos acá y en la sección.
// Entran los que están visibles, no vencidos y CON CUPO: este módulo reparte lugares limitados, y
// un evento con cupo 0 (sin límite declarado) no tiene nada que repartir ni que agotar.
const VIGENCIA_MS = 36 * 60 * 60 * 1000;
async function agenda() {
  const ahora = Date.now();
  const rows = await db.find('eventitems', r => r.visible !== false && Number(r.cupo) > 0
    && /^\\d{4}-\\d{2}-\\d{2}$/.test(String(r.fecha || ''))
    && Date.parse(r.fecha + 'T00:00:00Z') + VIGENCIA_MS > ahora);
  return rows
    .map(r => ({ id: r.id, title: r.titulo, date: r.fecha, time: r.hora || '', place: r.lugar || '', capacity: Number(r.cupo) || 0, description: r.descripcion || '' }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time)));
}` : `// Eventos disponibles: editá esta lista (título, fecha, lugar y cupo) según tu agenda.
// (Con el módulo "Eventos administrables" activo, esta constante se reemplaza por la colección
// eventitems y la agenda se carga desde el panel.)
const EVENTOS = ${JSON.stringify(EVENTOS, null, 2)};
async function agenda() { return EVENTOS; }`}
// Siempre asíncrono, venga de la constante o de la colección: un solo camino de código.
const evento = async (id) => (await agenda()).find(e => e.id === id) || null;

const validar = (data) => check(data, {
  eventId: (v) => str(v, 1, 40),
  name: (v) => str(v, 2, 80),
  email: isEmail,
});

// Estado de cupo de un evento: inscriptos y lugares que quedan
async function cupo(ev) {
  const tomados = (await db.find('eventregistrations', r => r.eventId === ev.id)).length;
  const restantes = Math.max(0, ev.capacity - tomados);
  return { id: ev.id, title: ev.title, date: ev.date, time: ev.time, place: ev.place, description: ev.description, capacity: ev.capacity, taken: tomados, remaining: restantes };
}

// GET /api/eventregister — eventos con su estado de cupo (público)
router.get('/', async (req, res) => {
  res.json(await Promise.all((await agenda()).map(cupo)));
});

// POST /api/eventregister — inscribe { eventId, name, email } y devuelve el código
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const ev = await evento(req.body.eventId);
  if (!ev) return res.status(404).json({ error: 'El evento no existe' });
  const email = req.body.email.toLowerCase().trim();
  // Idempotente: si ya estaba anotado a este evento devuelve su mismo código
  const previa = (await db.find('eventregistrations', r => r.eventId === ev.id && r.email === email))[0];
  if (previa) return res.json({ code: previa.code, event: ev.title, remaining: (await cupo(ev)).remaining, already: true });
  // Control de cupo del lado del servidor (la UI también lo muestra, pero acá manda)
  const estado = await cupo(ev);
  if (estado.remaining <= 0) return res.status(409).json({ error: 'El evento está completo' });
  const code = 'EV-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  await db.insert('eventregistrations', { code, eventId: ev.id, name: req.body.name.trim(), email });
  res.status(201).json({ code, event: ev.title, remaining: estado.remaining - 1 });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/eventregister/all — todas las inscripciones (solo admin; filtro ?eventId=)
router.get('/all', requireAdmin, async (req, res) => {
  let rows = await db.all('eventregistrations');
  if (req.query.eventId) rows = rows.filter(r => r.eventId === req.query.eventId);
  const titulo = {};
  // El título sale de la agenda vigente; una inscripción a un evento que ya pasó (y por eso no
  // está en la agenda) conserva su eventId como etiqueta en vez de desaparecer del listado.
  (await agenda()).forEach(e => { titulo[e.id] = e.title; });
  res.json(rows.reverse().map(r => ({ ...r, eventTitle: titulo[r.eventId] || r.eventId })));
});
` : `// El listado de inscriptos por evento requiere el módulo de autenticación: activalo en
// el Builder para habilitar la página /inscripciones.html. Sin él, las inscripciones
// quedan guardadas en data/eventregistrations.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    inscripciones: {
      title: 'Inscripciones',
      html: `  <section>
    <div class="container">
      <h2>Inscripciones a eventos</h2>
      <p class="section-sub">Personas anotadas a cada evento, con su código de confirmación. Solo visible para administradores.</p>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
        <select id="er-filtro" style="width:auto;min-width:200px"><option value="">Todos los eventos</option></select>
        <button class="btn ghost" type="button" id="er-csv">Descargar CSV</button>
      </div>
      <div id="er-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo inscripción a eventos: lista los eventos con su cupo, deja anotarse, muestra
   el código de confirmación y anima el contador de lugares (Anime.js + red de seguridad).
   Una inscripción por email por evento (localStorage recuerda las propias). En la vista
   previa del Builder simula la API. Con auth, arma el panel admin en /inscripciones.html. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };
  var EVENTOS_DEMO = ${JSON.stringify(EVENTOS.map(e => ({ ...e })))};

  // Eventos de ejemplo con cupo simulado para la vista previa del Builder
  function demoEstado() {
    var tomados = { ev1: 22, ev2: 41, ev3: 58 };
    return EVENTOS_DEMO.map(function (e) {
      var t = tomados[e.id] || 0;
      return { id: e.id, title: e.title, date: e.date, time: e.time, place: e.place, description: e.description, capacity: e.capacity, taken: t, remaining: Math.max(0, e.capacity - t) };
    });
  }

  function anotado(id) { try { return localStorage.getItem('er-anotado-' + id); } catch (e) { return null; } }
  function recordar(id, code) { try { localStorage.setItem('er-anotado-' + id, code); } catch (e) {} }

  function fechaLinda(iso) {
    try { return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }); }
    catch (e) { return iso; }
  }

  // ---- Sección pública de inscripción (Home) ----
  var lista = document.getElementById('er-lista');
  if (lista) {
    function pintarLista(eventos) {
      lista.innerHTML = '';
      eventos.forEach(function (ev) {
        var card = document.createElement('div');
        card.className = 'card er-card' + (ev.remaining <= 0 ? ' er-lleno' : '');
        card.setAttribute('data-ev', ev.id);
        var ya = anotado(ev.id);
        card.innerHTML =
          '<span class="er-fecha">' + fechaLinda(ev.date) + (ev.time ? ' · ' + App.esc(ev.time) : '') + '</span>' +
          '<h3 style="margin:0">' + App.esc(ev.title) + '</h3>' +
          '<p class="er-meta">${phIcon('map-pin', { size: 13 })} ' + App.esc(ev.place) + '</p>' +
          '<p class="muted" style="margin:0">' + App.esc(ev.description) + '</p>' +
          '<div class="er-cupo"><div class="er-barra"><div class="er-relleno" data-pct="' + (ev.capacity ? Math.round(ev.taken * 100 / ev.capacity) : 0) + '"></div></div>' +
          '<span class="er-meta"><strong class="er-rest" data-rest="' + ev.remaining + '">' + ev.remaining + '</strong> lugares</span></div>' +
          '<div class="er-slot"></div>';
        lista.appendChild(card);
        var slot = card.querySelector('.er-slot');
        if (ya) {
          slot.innerHTML = '<div class="er-ok">Ya estás anotado. Tu código: <span class="er-codigo">' + App.esc(ya) + '</span></div>';
        } else if (ev.remaining <= 0) {
          slot.innerHTML = '<p class="er-agotado">Cupo completo</p>';
        } else {
          slot.innerHTML =
            '<form class="er-form" data-ev="' + ev.id + '">' +
            '<input name="name" placeholder="Tu nombre" required maxlength="80">' +
            '<input name="email" type="email" placeholder="Tu email" required>' +
            '<button class="btn" type="submit">Reservar mi lugar</button></form>';
        }
      });
      animarBarras();
      enlazarForms();
    }

    function animarBarras() {
      var rellenos = lista.querySelectorAll('.er-relleno');
      var anime = window.anime;
      function fijar() { rellenos.forEach(function (r) { r.style.width = (Number(r.getAttribute('data-pct')) || 0) + '%'; }); }
      if (!anime || !anime.animate || reduce) { fijar(); return; }
      rellenos.forEach(function (r) {
        anime.animate(r, { width: ['0%', (Number(r.getAttribute('data-pct')) || 0) + '%'], duration: 800, ease: 'outCubic' });
      });
      // Red de seguridad: fija el estado final si el loop está pausado (pestaña oculta)
      setTimeout(fijar, 1000);
    }

    function contarRestantes(card, hasta) {
      var el = card.querySelector('.er-rest');
      if (!el) return;
      var desde = Number(el.getAttribute('data-rest')) || 0;
      el.setAttribute('data-rest', hasta);
      var anime = window.anime;
      if (!anime || !anime.animate || reduce) { el.textContent = hasta; return; }
      var st = { v: desde };
      anime.animate(st, { v: hasta, duration: 500, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v); } });
      setTimeout(function () { el.textContent = hasta; }, 700);
    }

    function enlazarForms() {
      lista.querySelectorAll('.er-form').forEach(function (form) {
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          var id = form.getAttribute('data-ev');
          var card = form.closest('.card');
          var datos = Object.fromEntries(new FormData(form));
          datos.eventId = id;
          if (window.__PREVIEW__) {
            recordar(id, 'EV-DEMO01');
            if (card) { contarRestantes(card, Math.max(0, (Number((card.querySelector('.er-rest') || {}).getAttribute && card.querySelector('.er-rest').getAttribute('data-rest')) || 1) - 1)); mostrarOk(card, 'EV-DEMO01'); }
            return;
          }
          try {
            var r = await App.api('/api/eventregister', { method: 'POST', body: datos });
            recordar(id, r.code);
            if (card) { contarRestantes(card, r.remaining); mostrarOk(card, r.code); }
            App.toast(r.already ? 'Ya estabas anotado' : '¡Lugar reservado!');
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    function mostrarOk(card, code) {
      var slot = card.querySelector('.er-slot');
      if (slot) slot.innerHTML = '<div class="er-ok">¡Listo! Tu código: <span class="er-codigo">' + App.esc(code) + '</span></div>';
    }

    (async function () {
      if (window.__PREVIEW__) { pintarLista(demoEstado()); return; }
      try { pintarLista(await App.api('/api/eventregister')); }
      catch (err) { lista.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; }
    })();
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel admin (/inscripciones.html) ----
  var adminBox = document.getElementById('er-admin');
  if (adminBox) {
    var filtro = document.getElementById('er-filtro');
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var ETIQUETAS = { createdAt: 'Fecha', eventTitle: 'Evento', name: 'Nombre', email: 'Email', code: 'Código' };

    function filtrados() {
      var v = filtro && filtro.value;
      return v ? todos.filter(function (r) { return r.eventId === v; }) : todos;
    }

    function pintar() {
      adminBox.innerHTML = App.table(filtrados(), [
        { label: ETIQUETAS.createdAt, render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } },
        { label: ETIQUETAS.eventTitle, render: function (r) { return '<span class="badge" style="vertical-align:baseline">' + App.esc(r.eventTitle || '—') + '</span>'; } },
        { key: 'name', label: ETIQUETAS.name },
        { key: 'email', label: ETIQUETAS.email },
        { label: ETIQUETAS.code, render: function (r) { return '<code>' + App.esc(r.code || '—') + '</code>'; } },
      ]);
    }

    function pintarFiltro() {
      if (!filtro) return;
      var vistos = {};
      todos.forEach(function (r) { if (r.eventId) vistos[r.eventId] = r.eventTitle || r.eventId; });
      Object.keys(vistos).forEach(function (id) {
        var op = document.createElement('option');
        op.value = id; op.textContent = vistos[id];
        filtro.appendChild(op);
      });
      filtro.addEventListener('change', pintar);
    }

    var csvBtn = document.getElementById('er-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var claves = ['createdAt', 'eventTitle', 'name', 'email', 'code'];
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [claves.map(function (k) { return celda(ETIQUETAS[k] || k); }).join(';')];
      filtrados().forEach(function (r) { lineas.push(claves.map(function (k) { return celda(r[k]); }).join(';')); });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'inscripciones-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    function listo(rows) { todos = rows; pintarFiltro(); pintar(); }

    if (window.__PREVIEW__) {
      listo([
        { eventId: 'ev1', eventTitle: 'Taller de introducción', name: 'Sofía Ruiz', email: 'sofia@mail.com', code: 'EV-A1B2C3', createdAt: new Date().toISOString() },
        { eventId: 'ev2', eventTitle: 'Webinar en vivo', name: 'Diego Paz', email: 'diego@mail.com', code: 'EV-D4E5F6', createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/eventregister/all').then(listo)
        .catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navIns = document.getElementById('nav-inscripciones');
    if (navIns && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navIns.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Inscripción a eventos**: ${cfg.moduleIds.includes('eventos') ? 'los eventos salen de la **misma agenda** que administra el módulo **Eventos administrables** (colección `eventitems`, panel `/eventos-admin.html`): se cargan en un solo lugar. Este módulo ofrece los que están **visibles, no vencidos y con cupo mayor a 0** — un evento sin cupo declarado no tiene lugares que repartir.' : 'editá los eventos (título, fecha, lugar y cupo) en la constante `EVENTOS` de `routes/eventregister.js` (o activá el módulo **Eventos administrables** para cargarlos desde el panel, sin regenerar).'} Las inscripciones se guardan en la colección \`eventregistrations\` y el cupo se controla en el servidor. ${cfg.moduleIds.includes('auth') ? 'Los administradores ven el listado por evento y descargan CSV en \`/inscripciones.html\`.' : 'Para ver quién se anotó activá el módulo **Autenticación** (habilita \`/inscripciones.html\`); sin él, consultá \`data/eventregistrations.json\`.'} El control "una inscripción por evento" es por email (idempotente en el servidor) y por navegador (\`localStorage\`).`,
  ],
};
