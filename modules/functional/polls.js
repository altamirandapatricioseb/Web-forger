// Encuestas y votaciones: sección en la Home con una encuesta cuyos votos se guardan
// en el servidor (colecciones polls + pollvotes), así los resultados suman entre todos
// los visitantes. Un voto por navegador (localStorage; sin login no hay dedupe fuerte,
// avisado en el README). Los resultados se muestran con barras y porcentajes animados
// con Anime.js, con red de seguridad setTimeout que fija el estado final si el loop
// está pausado (pestaña oculta) y respetando "prefers-reduced-motion". La encuesta de
// ejemplo se siembra sola la primera vez y se edita en data/polls.json (o en la tabla
// polls de Supabase). Distinto de "quiz" (recomendador sin persistencia): acá el dato
// agregado es el valor.
module.exports = {
  id: 'polls', type: 'functional', name: 'Encuestas y votaciones',
  description: 'Encuesta en la Home con votos persistidos en el servidor y resultados en vivo para todos los visitantes, con barras animadas (Anime.js).',
  usesAnime: true,
  mounts: [{ route: '/api/polls', file: 'routes/polls.js' }],
  collections: ['polls', 'pollvotes'],
  html: () => `  <section id="encuesta">
    <div class="container">
      <h2>Tu opinión nos importa</h2>
      <p class="section-sub">Votá y mirá los resultados en vivo: los votos de todos los visitantes suman.</p>
      <div class="card poll-card" id="poll-card"><p class="muted">Cargando encuesta…</p></div>
      <noscript><p class="muted">Activá JavaScript para participar de la encuesta.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    .poll-card{max-width:640px}
    .poll-q{margin:0 0 14px}
    .poll-ops{display:grid;gap:10px}
    .poll-op{text-align:left;background:var(--bg);border:1.5px solid var(--line);border-radius:var(--radius);padding:12px 14px;font:inherit;cursor:pointer;color:var(--text)}
    .poll-op:hover,.poll-op:focus-visible{border-color:var(--accent);color:var(--accent)}
    .poll-res{display:grid;gap:12px}
    .poll-etiqueta{display:flex;justify-content:space-between;gap:10px;font-size:.92rem;margin-bottom:4px}
    .poll-pct{font-variant-numeric:tabular-nums}
    .poll-barra{height:10px;background:var(--line);border-radius:999px;overflow:hidden}
    .poll-relleno{height:100%;width:0;background:var(--accent);border-radius:999px}
    .poll-fila.propia .poll-etiqueta{color:var(--accent);font-weight:600}
    .poll-hint{margin:14px 0 0;font-size:.85rem}
  </style>`,
  files: () => ({
    'routes/polls.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str } = require('../src/validate');

// Encuesta de ejemplo la primera vez: editala en data/polls.json (o en la tabla polls).
// La siembra se hace en el primer request (no al cargar el módulo) para que la capa
// de datos async (Supabase) no dispare promesas sueltas en el arranque.
let sembrada = false;
async function sembrar() {
  if (sembrada) return;
  sembrada = true;
  await db.seedIfEmpty('polls', [{
    question: '¿Qué te gustaría que sumemos primero?',
    options: [
      { id: 'op1', label: 'Más medios de pago' },
      { id: 'op2', label: 'Envíos a todo el país' },
      { id: 'op3', label: 'Nuevos productos y servicios' },
      { id: 'op4', label: 'Atención por WhatsApp' },
    ],
    active: true,
  }]);
}

// Resultados de una encuesta: conteo por opción sobre la colección de votos
async function resultados(poll) {
  const votos = await db.find('pollvotes', v => v.pollId === poll.id);
  const porOpcion = {};
  for (const op of poll.options) porOpcion[op.id] = 0;
  for (const v of votos) if (v.option in porOpcion) porOpcion[v.option]++;
  return { id: poll.id, question: poll.question, options: poll.options, votes: porOpcion, total: votos.length };
}

// GET /api/polls — encuestas activas con sus resultados
router.get('/', async (req, res) => {
  await sembrar();
  const activas = await db.find('polls', p => p.active !== false);
  res.json(await Promise.all(activas.map(resultados)));
});

// POST /api/polls/:id/vote — registra un voto anónimo { option }
router.post('/:id/vote', async (req, res) => {
  await sembrar();
  const poll = await db.get('polls', req.params.id);
  if (!poll || poll.active === false) return res.status(404).json({ error: 'Encuesta inexistente o cerrada' });
  const { ok } = check(req.body, { option: (v) => str(v, 1, 40) });
  if (!ok || !poll.options.some(o => o.id === req.body.option)) {
    return res.status(422).json({ error: 'Opción inválida', errors: { option: 'Elegí una opción de la encuesta' } });
  }
  await db.insert('pollvotes', { pollId: poll.id, option: req.body.option });
  res.status(201).json(await resultados(poll));
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo encuestas: carga la encuesta activa desde la API, deja votar una vez por
   navegador (localStorage) y muestra los resultados con barras animadas (Anime.js,
   con red de seguridad). En la vista previa del Builder usa datos de ejemplo. */
(function () {
  var card = document.getElementById('poll-card');
  if (!card) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Encuesta de ejemplo para la vista previa del Builder (sin API)
  var DEMO = {
    id: 'demo',
    question: '¿Qué te gustaría que sumemos primero?',
    options: [
      { id: 'op1', label: 'Más medios de pago' },
      { id: 'op2', label: 'Envíos a todo el país' },
      { id: 'op3', label: 'Nuevos productos y servicios' },
      { id: 'op4', label: 'Atención por WhatsApp' },
    ],
    votes: { op1: 12, op2: 31, op3: 9, op4: 17 },
    total: 69,
  };

  function votada(id) { try { return localStorage.getItem('poll-votada-' + id); } catch (e) { return null; } }
  function recordar(id, op) { try { localStorage.setItem('poll-votada-' + id, op); } catch (e) {} }

  function pintarOpciones(poll) {
    var html = '<h3 class="poll-q">' + App.esc(poll.question) + '</h3><div class="poll-ops">';
    poll.options.forEach(function (op) {
      html += '<button type="button" class="poll-op" data-op="' + App.esc(op.id) + '">' + App.esc(op.label) + '</button>';
    });
    html += '</div><p class="muted poll-hint">Un voto por persona. Los resultados se ven después de votar.</p>';
    card.innerHTML = html;
    card.querySelectorAll('.poll-op').forEach(function (b) {
      b.addEventListener('click', function () { votar(poll, b.getAttribute('data-op')); });
    });
  }

  function pintarResultados(poll, propia) {
    var html = '<h3 class="poll-q">' + App.esc(poll.question) + '</h3><div class="poll-res">';
    poll.options.forEach(function (op) {
      var n = (poll.votes && poll.votes[op.id]) || 0;
      var pct = poll.total ? Math.round(n * 100 / poll.total) : 0;
      html += '<div class="poll-fila' + (propia === op.id ? ' propia' : '') + '">' +
        '<div class="poll-etiqueta"><span>' + App.esc(op.label) + (propia === op.id ? ' · tu voto' : '') + '</span>' +
        '<strong class="poll-pct" data-pct="' + pct + '">0%</strong></div>' +
        '<div class="poll-barra"><div class="poll-relleno" data-pct="' + pct + '"></div></div></div>';
    });
    html += '</div><p class="muted poll-hint">' + poll.total + ' voto' + (poll.total === 1 ? '' : 's') + ' en total. ¡Gracias por participar!</p>';
    card.innerHTML = html;
    animarBarras();
  }

  function animarBarras() {
    var rellenos = card.querySelectorAll('.poll-relleno');
    var pcts = card.querySelectorAll('.poll-pct');
    function fijar() {
      rellenos.forEach(function (r) { r.style.width = (Number(r.getAttribute('data-pct')) || 0) + '%'; });
      pcts.forEach(function (p) { p.textContent = (Number(p.getAttribute('data-pct')) || 0) + '%'; });
    }
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { fijar(); return; }
    rellenos.forEach(function (r) {
      anime.animate(r, { width: ['0%', (Number(r.getAttribute('data-pct')) || 0) + '%'], duration: 900, ease: 'outCubic' });
    });
    pcts.forEach(function (p) {
      var hasta = Number(p.getAttribute('data-pct')) || 0;
      var st = { v: 0 };
      anime.animate(st, { v: hasta, duration: 900, ease: 'outCubic', onUpdate: function () { p.textContent = Math.round(st.v) + '%'; } });
    });
    // Red de seguridad: fija el estado final si el loop está pausado (pestaña oculta)
    setTimeout(fijar, 1100);
  }

  async function votar(poll, op) {
    if (window.__PREVIEW__) {
      // En la vista previa el voto es simulado (la API vive en el proyecto exportado)
      DEMO.votes[op] = (DEMO.votes[op] || 0) + 1;
      DEMO.total += 1;
      recordar(poll.id, op);
      pintarResultados(DEMO, op);
      return;
    }
    try {
      var res = await App.api('/api/polls/' + encodeURIComponent(poll.id) + '/vote', { method: 'POST', body: { option: op } });
      recordar(poll.id, op);
      pintarResultados(res, op);
      App.toast('¡Voto registrado!');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  (async function () {
    if (window.__PREVIEW__) {
      var propiaDemo = votada(DEMO.id);
      if (propiaDemo) pintarResultados(DEMO, propiaDemo); else pintarOpciones(DEMO);
      return;
    }
    try {
      var lista = await App.api('/api/polls');
      if (!lista.length) { card.innerHTML = '<p class="muted">No hay encuestas activas por ahora.</p>'; return; }
      var poll = lista[0];
      var propia = votada(poll.id);
      if (propia) pintarResultados(poll, propia); else pintarOpciones(poll);
    } catch (err) { card.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; }
  })();
})();`,
  readmeNotes: () => [
    '**Encuestas y votaciones**: la encuesta de ejemplo se siembra sola la primera vez; editá la pregunta y las opciones en `data/polls.json` (o en la tabla `polls` de Supabase). El control "un voto por persona" es por navegador (`localStorage`): sin login no hay dedupe fuerte del lado del servidor.',
  ],
};
