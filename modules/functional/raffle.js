// Sorteo: sección en la Home donde el visitante participa dejando nombre y email, y ve en vivo
// cuánta gente ya se anotó (prueba social, count-up con Anime.js + red de seguridad). El backend
// guarda las participaciones (colección raffleentries, una por email, idempotente) y, cuando el
// negocio lo decide, elige un ganador al azar del lado del servidor (colección raffledraws) — la
// elección aleatoria nunca ocurre en el navegador, así no se puede manipular. El ganador se
// muestra públicamente con el email enmascarado. Con el módulo de autenticación activo, la página
// /sorteo.html solo-admin lista participantes, tiene el botón "Sortear ganador", permite reabrir
// el sorteo y exporta CSV. Sin auth la participación funciona igual y el sorteo se corre editando
// data (o activando auth). Distinto de "polls"/"quiz" (votación/recomendador sin premio ni ganador).
const PREMIO = 'Un premio sorpresa'; // Descripción del premio (editable)
const BASES = 'Participás dejando tu email. Un participante por email. El ganador se elige al azar y lo anunciamos por email.'; // Bases resumidas (editable)

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'raffle', type: 'functional', name: 'Sorteo',
  description: 'Sorteo con participación por email (idempotente) y contador de participantes en vivo (Anime.js). El ganador se elige al azar en el servidor. Con auth activo, panel admin en /sorteo.html para sortear, reabrir y exportar CSV. Colecciones raffleentries y raffledraws.',
  usesAnime: true,
  mounts: [{ route: '/api/raffle', file: 'routes/raffle.js' }],
  collections: ['raffleentries', 'raffledraws'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Sorteo', href: '/sorteo.html', id: 'nav-sorteo' }] : [],
  html: () => `  <section id="sorteo">
    <div class="container" style="max-width:640px">
      <h2>Participá del sorteo</h2>
      <p class="section-sub">Dejá tus datos y participá por <strong id="rf-premio">nuestro premio</strong>. <span id="rf-count-wrap" hidden><strong class="rf-num" data-n="0">0</strong> personas ya participan.</span></p>
      <div id="rf-winner" hidden></div>
      <form id="rf-form" class="card">
        <label>Nombre</label>
        <input name="name" required maxlength="80" placeholder="Tu nombre">
        <label>Email</label>
        <input name="email" type="email" required placeholder="Tu email">
        <button class="btn" type="submit" style="margin-top:10px">Participar</button>
        <p class="muted" id="rf-bases" style="font-size:.8rem;margin:8px 0 0"></p>
      </form>
      <div id="rf-ok" hidden></div>
      <noscript><p class="muted">Activá JavaScript para participar del sorteo.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    #rf-count-wrap strong{color:var(--accent);font-variant-numeric:tabular-nums}
    #rf-winner{background:color-mix(in srgb, var(--accent) 12%, transparent);border-left:3px solid var(--accent);padding:14px 16px;border-radius:0 var(--radius) var(--radius) 0;margin-bottom:14px}
    #rf-winner h3{margin:0 0 4px}
    #rf-ok{background:var(--surface);border-left:3px solid var(--accent);padding:14px 16px;border-radius:0 var(--radius) var(--radius) 0}
    .rf-ganador-nombre{font-weight:800;color:var(--accent)}
  </style>`,
  files: (cfg) => ({
    'routes/raffle.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { check, str, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Datos del sorteo: premio y bases resumidas (editables)
const PREMIO = ${JSON.stringify(PREMIO)};
const BASES = ${JSON.stringify(BASES)};

const validar = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  email: isEmail,
});

// Enmascara el email para mostrar al ganador públicamente sin exponerlo entero
function enmascarar(email) {
  const [u, d] = String(email).split('@');
  if (!d) return '***';
  const visible = u.slice(0, 2);
  return visible + '***@' + d;
}

// Draw activo = la última tirada registrada (permite reabrir borrando las tiradas)
async function drawActivo() {
  const draws = await db.all('raffledraws');
  return draws.length ? draws[draws.length - 1] : null;
}

// GET /api/raffle — estado público: premio, cantidad de participantes y ganador si ya se sorteó
router.get('/', async (req, res) => {
  const draw = await drawActivo();
  res.json({
    prize: PREMIO, terms: BASES,
    count: await db.count('raffleentries'),
    drawn: !!draw,
    winner: draw ? { name: (draw.winnerName || '').split(' ')[0], email: enmascarar(draw.winnerEmail) } : null,
    drawnAt: draw ? draw.createdAt : null,
  });
});

// POST /api/raffle — participa { name, email } (idempotente por email); cerrado si ya hay ganador
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  if (await drawActivo()) return res.status(409).json({ error: 'El sorteo ya cerró: el ganador fue elegido' });
  const email = req.body.email.toLowerCase().trim();
  const previa = (await db.find('raffleentries', r => r.email === email))[0];
  if (previa) return res.json({ ok: true, count: await db.count('raffleentries'), already: true });
  await db.insert('raffleentries', { name: req.body.name.trim(), email });
  res.status(201).json({ ok: true, count: await db.count('raffleentries') });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/raffle/all — participantes + estado del sorteo (solo admin)
router.get('/all', requireAdmin, async (req, res) => {
  const entries = (await db.all('raffleentries')).slice().reverse();
  const draw = await drawActivo();
  res.json({ entries, drawn: !!draw, winner: draw ? { name: draw.winnerName, email: draw.winnerEmail, at: draw.createdAt } : null });
});

// POST /api/raffle/draw — elige un ganador al azar entre los participantes (solo admin)
router.post('/draw', requireAdmin, async (req, res) => {
  if (await drawActivo()) return res.status(409).json({ error: 'Ya hay un ganador. Reabrí el sorteo para volver a sortear.' });
  const entries = await db.all('raffleentries');
  if (!entries.length) return res.status(409).json({ error: 'No hay participantes para sortear' });
  // Elección aleatoria uniforme del lado del servidor (crypto, no Math.random)
  const idx = crypto.randomInt(entries.length);
  const ganador = entries[idx];
  const draw = await db.insert('raffledraws', { winnerEntryId: ganador.id, winnerName: ganador.name, winnerEmail: ganador.email, pool: entries.length });
  res.status(201).json({ ok: true, winner: { name: ganador.name, email: ganador.email }, pool: entries.length, at: draw.createdAt });
});

// POST /api/raffle/reopen — borra las tiradas para volver a sortear (solo admin)
router.post('/reopen', requireAdmin, async (req, res) => {
  const draws = await db.all('raffledraws');
  for (const d of draws) await db.remove('raffledraws', d.id);
  res.json({ ok: true, reopened: draws.length });
});
` : `// Correr el sorteo (elegir ganador al azar) y ver los participantes requiere el módulo de
// autenticación: activalo en el Builder para habilitar /sorteo.html. Sin él, las
// participaciones quedan en data/raffleentries.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    sorteo: {
      title: 'Sorteo',
      html: `  <section>
    <div class="container">
      <h2>Gestión del sorteo</h2>
      <p class="section-sub">Participantes anotados y elección del ganador. El ganador se elige al azar en el servidor. Solo visible para administradores.</p>
      <div id="rf-panel" class="card" style="margin-bottom:14px">
        <p class="muted" style="margin:0">Cargando…</p>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn ghost" type="button" id="rf-csv">Descargar CSV</button>
      </div>
      <div id="rf-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo sorteo: sección pública para participar con contador animado (Anime.js + red de
   seguridad) y aviso del ganador si ya se sorteó; con auth activo, panel admin en /sorteo.html
   para elegir ganador (al azar en el servidor), reabrir y exportar. Vista previa simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PREMIO = ${JSON.stringify(PREMIO)};
  var BASES = ${JSON.stringify(BASES)};

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    el.setAttribute('data-n', hasta);
    if (!anime || !anime.animate || reduce) { el.textContent = hasta; return; }
    var st = { v: Number(el.textContent) || 0 };
    anime.animate(st, { v: hasta, duration: 700, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v); } });
    setTimeout(function () { el.textContent = hasta; }, 900);
  }

  // ---- Sección pública (Home) ----
  var form = document.getElementById('rf-form');
  if (form) {
    var premioEl = document.getElementById('rf-premio'); if (premioEl) premioEl.textContent = PREMIO;
    var basesEl = document.getElementById('rf-bases'); if (basesEl) basesEl.textContent = BASES;
    var countWrap = document.getElementById('rf-count-wrap');
    var winnerBox = document.getElementById('rf-winner');
    var okBox = document.getElementById('rf-ok');

    function pintarEstado(s) {
      if (premioEl) premioEl.textContent = s.prize || PREMIO;
      if (basesEl && s.terms) basesEl.textContent = s.terms;
      if (countWrap && s.count > 0) { countWrap.hidden = false; contar(countWrap.querySelector('.rf-num'), s.count); }
      if (s.drawn && s.winner && winnerBox) {
        winnerBox.hidden = false;
        winnerBox.innerHTML = '<h3>${phIcon('confetti', { size: 18 })} ¡Tenemos ganador!</h3><p style="margin:0">Felicitaciones a <span class="rf-ganador-nombre">' + App.esc(s.winner.name || 'nuestro ganador') + '</span> (' + App.esc(s.winner.email) + '). Lo contactamos por email.</p>';
        form.hidden = true;
        var anime = window.anime;
        if (anime && anime.animate && !reduce) anime.animate(winnerBox, { opacity: [0, 1], scale: [0.96, 1], duration: 500, ease: 'outBack' });
      }
    }

    if (window.__PREVIEW__) { pintarEstado({ prize: PREMIO, terms: BASES, count: 128, drawn: false, winner: null }); }
    else App.api('/api/raffle').then(pintarEstado).catch(function () {});

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = Object.fromEntries(new FormData(form));
      if (window.__PREVIEW__) { mostrarOk(datos, true); return; }
      try {
        var r = await App.api('/api/raffle', { method: 'POST', body: datos });
        mostrarOk(datos, !r.already);
        if (countWrap) { countWrap.hidden = false; contar(countWrap.querySelector('.rf-num'), r.count); }
        App.toast(r.already ? 'Ya estabas participando' : '¡Estás participando!');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function mostrarOk(datos, nuevo) {
      form.hidden = true;
      if (okBox) {
        okBox.hidden = false;
        okBox.innerHTML = '<h3 style="margin:0 0 4px">${phIcon('check', { size: 16 })} ' + (nuevo ? '¡Ya estás participando!' : 'Ya participabas') + '</h3>' +
          '<p class="muted" style="margin:0">Te avisamos por email a <strong>' + App.esc(datos.email) + '</strong> si resultás ganador/a. ¡Suerte, ' + App.esc((datos.name || '').split(' ')[0]) + '!</p>';
      }
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel admin (/sorteo.html) ----
  var adminBox = document.getElementById('rf-admin');
  var panel = document.getElementById('rf-panel');
  if (adminBox && panel) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var estado = { entries: [], drawn: false, winner: null };

    function pintarPanel() {
      var n = estado.entries.length;
      if (estado.drawn && estado.winner) {
        panel.innerHTML = '<h3 style="margin:0 0 6px">Ganador del sorteo ${phIcon('confetti', { size: 16 })}</h3>' +
          '<p style="margin:0 0 10px"><span class="rf-ganador-nombre">' + App.esc(estado.winner.name) + '</span> — ' + App.esc(estado.winner.email) +
          '<br><span class="muted" style="font-size:.85rem">Sorteado entre ' + n + ' participantes' + (estado.winner.at ? ' el ' + new Date(estado.winner.at).toLocaleString('es-AR') : '') + '</span></p>' +
          '<button class="btn ghost" type="button" id="rf-reopen">Reabrir sorteo</button>';
      } else {
        panel.innerHTML = '<h3 style="margin:0 0 6px">' + n + ' participante' + (n === 1 ? '' : 's') + '</h3>' +
          '<p class="muted" style="margin:0 0 10px">Cuando quieras cerrar el sorteo, elegí un ganador al azar.</p>' +
          '<button class="btn" type="button" id="rf-draw"' + (n ? '' : ' disabled') + '>Sortear ganador</button>';
      }
      var drawBtn = document.getElementById('rf-draw');
      if (drawBtn) drawBtn.addEventListener('click', sortear);
      var reBtn = document.getElementById('rf-reopen');
      if (reBtn) reBtn.addEventListener('click', reabrir);
    }

    function pintarTabla() {
      adminBox.innerHTML = App.table(estado.entries, [
        { label: 'Fecha', render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } },
        { key: 'name', label: 'Nombre' },
        { key: 'email', label: 'Email' },
      ]);
    }

    async function sortear() {
      if (window.__PREVIEW__) { App.toast('Vista previa: se elegiría un ganador al azar'); return; }
      if (!confirm('¿Elegir un ganador al azar entre ' + estado.entries.length + ' participantes? El sorteo quedará cerrado.')) return;
      try {
        var r = await App.api('/api/raffle/draw', { method: 'POST' });
        estado.drawn = true; estado.winner = { name: r.winner.name, email: r.winner.email, at: r.at };
        pintarPanel();
        App.toast('Ganador: ' + r.winner.name);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function reabrir() {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reabriría el sorteo'); return; }
      if (!confirm('¿Reabrir el sorteo? Se borra el ganador actual y se puede volver a sortear.')) return;
      try {
        await App.api('/api/raffle/reopen', { method: 'POST' });
        estado.drawn = false; estado.winner = null;
        pintarPanel();
        App.toast('Sorteo reabierto');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    var csvBtn = document.getElementById('rf-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var claves = ['createdAt', 'name', 'email'];
      var etq = { createdAt: 'Fecha', name: 'Nombre', email: 'Email' };
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [claves.map(function (k) { return celda(etq[k] || k); }).join(';')];
      estado.entries.forEach(function (r) { lineas.push(claves.map(function (k) { return celda(k === 'createdAt' && r[k] ? new Date(r[k]).toLocaleDateString('es-AR') : r[k]); }).join(';')); });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sorteo-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    function listo(s) { estado = { entries: s.entries || [], drawn: !!s.drawn, winner: s.winner }; pintarPanel(); pintarTabla(); }

    if (window.__PREVIEW__) {
      listo({ entries: [
        { id: '1', name: 'Sofía Ruiz', email: 'sofia@mail.com', createdAt: new Date().toISOString() },
        { id: '2', name: 'Diego Paz', email: 'diego@mail.com', createdAt: new Date().toISOString() },
      ], drawn: false, winner: null });
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/raffle/all').then(listo)
        .catch(function (err) { panel.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navRf = document.getElementById('nav-sorteo');
    if (navRf && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navRf.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Sorteo**: editá el premio y las bases en las constantes \`PREMIO\` y \`BASES\` de \`routes/raffle.js\`. Las participaciones se guardan en \`raffleentries\` (una por email). ${cfg.moduleIds.includes('auth') ? 'Desde \`/sorteo.html\` los administradores ven los participantes, corren el sorteo (el ganador se elige al azar en el servidor con \`crypto.randomInt\`), pueden reabrirlo y exportar el CSV.' : 'Para ver los participantes y correr el sorteo activá el módulo **Autenticación** (habilita \`/sorteo.html\`); sin él, mirá \`data/raffleentries.json\`.'} Al elegir ganador el sorteo se cierra a nuevas participaciones; el ganador se muestra en la Home con el email enmascarado.`,
  ],
};
