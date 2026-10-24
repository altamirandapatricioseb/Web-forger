// Tarjeta de fidelidad digital (sellos): sección en la Home donde el visitante se suma con su
// email y ve su tarjeta con los sellos acumulados y cuántos le faltan para el premio (barra de
// progreso + sellos que aparecen con Anime.js, red de seguridad). El backend guarda cada tarjeta
// (colección loyaltycards, una por email, idempotente). Los sellos los carga el negocio: con el
// módulo de autenticación activo, la página /fidelidad.html solo-admin permite buscar una tarjeta
// por email, sumarle un sello (cada compra) y canjear el premio cuando llega a la meta (reinicia
// los sellos y registra el canje). Sin auth el alta/consulta funciona igual y las tarjetas se leen
// en data/loyaltycards.json. Patrón clásico de cafés, peluquerías y locales: "juntá sellos y ganá".
const META = 10; // Sellos necesarios para el premio (editable)
const PREMIO = 'Un producto o servicio de regalo'; // Descripción del premio (editable)

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'loyalty', type: 'functional', name: 'Tarjeta de fidelidad',
  description: 'Tarjeta de sellos digital: el visitante se suma con su email y ve su progreso hacia el premio (barra + sellos con Anime.js). El negocio carga los sellos y canjea el premio desde /fidelidad.html (requiere auth). Colección loyaltycards.',
  usesAnime: true,
  mounts: [{ route: '/api/loyalty', file: 'routes/loyalty.js' }],
  collections: ['loyaltycards'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Fidelidad', href: '/fidelidad.html', id: 'nav-fidelidad' }] : [],
  html: () => `  <section id="fidelidad">
    <div class="container" style="max-width:640px">
      <h2>Sumá sellos y ganá</h2>
      <p class="section-sub">Cada compra suma un sello. Al juntar <strong id="ly-meta">10</strong> te llevás <strong id="ly-premio">tu premio</strong>. Ingresá tu email para ver tu tarjeta.</p>
      <form id="ly-form" class="card">
        <label>Email</label>
        <input name="email" type="email" required placeholder="Tu email">
        <label>Nombre (opcional)</label>
        <input name="name" maxlength="80" placeholder="Tu nombre">
        <button class="btn" type="submit" style="margin-top:10px">Ver mi tarjeta</button>
      </form>
      <div id="ly-card" hidden></div>
      <noscript><p class="muted">Activá JavaScript para usar tu tarjeta de fidelidad.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    #ly-card{margin-top:14px}
    .ly-tarjeta{background:var(--surface);border-radius:var(--radius);padding:18px}
    .ly-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    .ly-top strong{font-variant-numeric:tabular-nums}
    .ly-sellos{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
    .ly-sello{width:34px;height:34px;border-radius:50%;border:2px dashed var(--line);display:flex;align-items:center;justify-content:center;font-size:1rem;color:var(--muted);transition:transform .2s ease}
    .ly-sello.on{border-style:solid;border-color:var(--accent);background:color-mix(in srgb, var(--accent) 14%, transparent);color:var(--accent)}
    .ly-barra{height:8px;background:var(--line);border-radius:999px;overflow:hidden;margin:8px 0}
    .ly-relleno{height:100%;width:0;background:var(--accent);border-radius:999px}
    .ly-premio{background:color-mix(in srgb, var(--accent) 12%, transparent);border-left:3px solid var(--accent);padding:12px 14px;border-radius:0 var(--radius) var(--radius) 0;margin-top:8px}
  </style>`,
  files: (cfg) => ({
    'routes/loyalty.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Configuración del programa: sellos para el premio y descripción del premio (editables)
const META = ${JSON.stringify(META)};
const PREMIO = ${JSON.stringify(PREMIO)};

// Vista pública de una tarjeta: nunca expone datos internos de más
const publica = (c) => ({
  email: c.email, name: c.name || '', stamps: c.stamps || 0, goal: META, reward: PREMIO,
  redeemable: (c.stamps || 0) >= META, redemptions: c.redemptions || 0,
});

// GET /api/loyalty/config — meta y premio del programa (público, para la Home)
router.get('/config', (req, res) => res.json({ goal: META, reward: PREMIO }));

// POST /api/loyalty/card — alta/consulta de tarjeta por email (idempotente)
router.post('/card', async (req, res) => {
  const { ok, errors } = check(req.body, { email: isEmail });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const email = req.body.email.toLowerCase().trim();
  let card = (await db.find('loyaltycards', c => c.email === email))[0];
  if (!card) {
    const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
    card = await db.insert('loyaltycards', { email, name, stamps: 0, redemptions: 0 });
  } else if (req.body.name && !card.name) {
    card = await db.update('loyaltycards', card.id, { name: String(req.body.name).trim().slice(0, 80) });
  }
  res.json(publica(card));
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/loyalty/all — todas las tarjetas (solo admin; búsqueda ?q=email)
router.get('/all', requireAdmin, async (req, res) => {
  let rows = await db.all('loyaltycards');
  const q = (req.query.q || '').toString().toLowerCase().trim();
  if (q) rows = rows.filter(c => (c.email || '').includes(q) || (c.name || '').toLowerCase().includes(q));
  res.json(rows.reverse().map(c => ({ ...c, goal: META, reward: PREMIO })));
});

// PATCH /api/loyalty/:id/stamp — suma un sello a la tarjeta (solo admin)
router.patch('/:id/stamp', requireAdmin, async (req, res) => {
  const card = await db.get('loyaltycards', req.params.id);
  if (!card) return res.status(404).json({ error: 'Tarjeta inexistente' });
  const row = await db.update('loyaltycards', card.id, { stamps: (card.stamps || 0) + 1 });
  res.json({ ...row, goal: META, reward: PREMIO });
});

// POST /api/loyalty/:id/redeem — canjea el premio si llegó a la meta: reinicia sellos y cuenta el canje (solo admin)
router.post('/:id/redeem', requireAdmin, async (req, res) => {
  const card = await db.get('loyaltycards', req.params.id);
  if (!card) return res.status(404).json({ error: 'Tarjeta inexistente' });
  if ((card.stamps || 0) < META) return res.status(409).json({ error: 'Todavía no llegó a la meta', errors: { stamps: 'Faltan ' + (META - (card.stamps || 0)) + ' sellos' } });
  const row = await db.update('loyaltycards', card.id, {
    stamps: (card.stamps || 0) - META,
    redemptions: (card.redemptions || 0) + 1,
    lastRedeemedAt: new Date().toISOString(),
  });
  res.json({ ...row, goal: META, reward: PREMIO });
});
` : `// La carga de sellos y el canje del premio requieren el módulo de autenticación: activalo en
// el Builder para habilitar /fidelidad.html. Sin él, las tarjetas quedan en data/loyaltycards.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    fidelidad: {
      title: 'Tarjetas de fidelidad',
      html: `  <section>
    <div class="container">
      <h2>Tarjetas de fidelidad</h2>
      <p class="section-sub">Buscá la tarjeta por email, sumá un sello en cada compra y canjeá el premio cuando llega a la meta. Solo visible para administradores.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <input id="ly-buscar" placeholder="Buscar por email o nombre" style="flex:1;min-width:200px">
        <button class="btn ghost" type="button" id="ly-csv">Descargar CSV</button>
      </div>
      <div id="ly-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo tarjeta de fidelidad: sección pública para consultar la tarjeta por email con
   barra de progreso y sellos animados (Anime.js + red de seguridad), y con auth activo, el
   panel admin en /fidelidad.html para sumar sellos y canjear. Vista previa simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var META = ${JSON.stringify(META)};
  var PREMIO = ${JSON.stringify(PREMIO)};

  function pintarMeta() {
    var m = document.getElementById('ly-meta'); if (m) m.textContent = META;
    var p = document.getElementById('ly-premio'); if (p) p.textContent = PREMIO;
  }

  // ---- Sección pública (Home) ----
  var form = document.getElementById('ly-form');
  if (form) {
    pintarMeta();
    var box = document.getElementById('ly-card');

    if (window.__PREVIEW__) { /* usa META/PREMIO embebidos */ }
    else App.api('/api/loyalty/config').then(function (c) { META = c.goal; PREMIO = c.reward; pintarMeta(); }).catch(function () {});

    function pintarTarjeta(c) {
      if (!box) return;
      var stamps = c.stamps || 0, goal = c.goal || META;
      var pct = goal ? Math.min(100, Math.round(stamps * 100 / goal)) : 0;
      var puntos = '';
      for (var i = 0; i < goal; i++) puntos += '<div class="ly-sello' + (i < stamps ? ' on' : '') + '">' + (i < stamps ? '${phIcon('star-fill', { size: 16 })}' : (i + 1)) + '</div>';
      box.hidden = false;
      box.innerHTML = '<div class="ly-tarjeta">' +
        '<div class="ly-top"><span>Hola' + (c.name ? ' ' + App.esc(c.name.split(' ')[0]) : '') + '</span>' +
        '<span><strong class="ly-num" data-n="' + stamps + '">' + stamps + '</strong> / ' + goal + ' sellos</span></div>' +
        '<div class="ly-barra"><div class="ly-relleno" data-pct="' + pct + '"></div></div>' +
        '<div class="ly-sellos">' + puntos + '</div>' +
        (c.redeemable
          ? '<div class="ly-premio"><strong>¡Llegaste a la meta! ${phIcon('confetti', { size: 16 })}</strong><br>Mostrá esta tarjeta para llevarte: ' + App.esc(c.reward || PREMIO) + '</div>'
          : '<p class="muted" style="margin:6px 0 0">Te faltan <strong>' + (goal - stamps) + '</strong> sellos para: ' + App.esc(c.reward || PREMIO) + '</p>') +
        (c.redemptions ? '<p class="muted" style="margin:6px 0 0;font-size:.82rem">Premios canjeados: ' + c.redemptions + '</p>' : '');
      animar(box, stamps, pct);
    }

    function animar(scope, stamps, pct) {
      var relleno = scope.querySelector('.ly-relleno');
      var num = scope.querySelector('.ly-num');
      var sellos = scope.querySelectorAll('.ly-sello.on');
      var anime = window.anime;
      function fijar() { if (relleno) relleno.style.width = pct + '%'; if (num) num.textContent = stamps; }
      if (!anime || !anime.animate || reduce) { fijar(); return; }
      if (relleno) anime.animate(relleno, { width: ['0%', pct + '%'], duration: 800, ease: 'outCubic' });
      if (num) { var st = { v: 0 }; anime.animate(st, { v: stamps, duration: 700, ease: 'outCubic', onUpdate: function () { num.textContent = Math.round(st.v); } }); }
      if (sellos.length) anime.animate(sellos, { scale: [0.4, 1], opacity: [0, 1], delay: anime.stagger ? anime.stagger(60) : 0, duration: 400, ease: 'outBack' });
      // Red de seguridad: fija el estado final si el loop está pausado (pestaña oculta)
      setTimeout(fijar, 1000);
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = Object.fromEntries(new FormData(form));
      if (window.__PREVIEW__) { pintarTarjeta({ email: datos.email, name: datos.name, stamps: 6, goal: META, reward: PREMIO, redeemable: false, redemptions: 0 }); return; }
      try {
        var c = await App.api('/api/loyalty/card', { method: 'POST', body: datos });
        pintarTarjeta(c);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel admin (/fidelidad.html) ----
  var adminBox = document.getElementById('ly-admin');
  if (adminBox) {
    var buscar = document.getElementById('ly-buscar');
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];

    function filtrados() {
      var q = (buscar && buscar.value || '').toLowerCase().trim();
      if (!q) return todos;
      return todos.filter(function (c) { return (c.email || '').toLowerCase().indexOf(q) >= 0 || (c.name || '').toLowerCase().indexOf(q) >= 0; });
    }

    function pintar() {
      adminBox.innerHTML = App.table(filtrados(), [
        { key: 'email', label: 'Email' },
        { label: 'Nombre', render: function (c) { return c.name ? App.esc(c.name) : '<span class="muted">—</span>'; } },
        { label: 'Sellos', render: function (c) { return '<strong>' + (c.stamps || 0) + '</strong> / ' + (c.goal || 0); } },
        { label: 'Canjes', render: function (c) { return c.redemptions || 0; } },
        { label: 'Acciones', render: function (c) {
          var addBtn = '<button class="btn ghost" type="button" data-stamp="' + c.id + '" style="padding:4px 10px;font-size:.82rem">+1 sello</button>';
          var redBtn = (c.stamps || 0) >= (c.goal || Infinity)
            ? ' <button class="btn" type="button" data-redeem="' + c.id + '" style="padding:4px 10px;font-size:.82rem">Canjear premio</button>' : '';
          return addBtn + redBtn;
        } },
      ]);
      adminBox.querySelectorAll('[data-stamp]').forEach(function (b) {
        b.addEventListener('click', function () { accion('/api/loyalty/' + b.getAttribute('data-stamp') + '/stamp', 'PATCH', '¡Sello sumado!'); });
      });
      adminBox.querySelectorAll('[data-redeem]').forEach(function (b) {
        b.addEventListener('click', function () { accion('/api/loyalty/' + b.getAttribute('data-redeem') + '/redeem', 'POST', 'Premio canjeado'); });
      });
    }

    async function accion(path, method, msg) {
      if (window.__PREVIEW__) { App.toast('Vista previa: ' + msg); return; }
      try {
        var row = await App.api(path, { method: method });
        var i = todos.findIndex(function (c) { return c.id === row.id; });
        if (i >= 0) todos[i] = row;
        pintar();
        App.toast(msg);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    if (buscar) buscar.addEventListener('input', pintar);

    var csvBtn = document.getElementById('ly-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var claves = ['email', 'name', 'stamps', 'redemptions', 'createdAt'];
      var etq = { email: 'Email', name: 'Nombre', stamps: 'Sellos', redemptions: 'Canjes', createdAt: 'Alta' };
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [claves.map(function (k) { return celda(etq[k] || k); }).join(';')];
      filtrados().forEach(function (r) { lineas.push(claves.map(function (k) { return celda(k === 'createdAt' && r[k] ? new Date(r[k]).toLocaleDateString('es-AR') : r[k]); }).join(';')); });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fidelidad-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    function listo(rows) { todos = rows; pintar(); }

    if (window.__PREVIEW__) {
      listo([
        { id: '1', email: 'sofia@mail.com', name: 'Sofía Ruiz', stamps: 10, redemptions: 1, goal: META, reward: PREMIO, createdAt: new Date().toISOString() },
        { id: '2', email: 'diego@mail.com', name: 'Diego Paz', stamps: 4, redemptions: 0, goal: META, reward: PREMIO, createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/loyalty/all').then(listo)
        .catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navLy = document.getElementById('nav-fidelidad');
    if (navLy && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navLy.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Tarjeta de fidelidad**: configurá la meta de sellos y el premio en las constantes \`META\` y \`PREMIO\` de \`routes/loyalty.js\`. Cada tarjeta es única por email (colección \`loyaltycards\`). ${cfg.moduleIds.includes('auth') ? 'Los administradores buscan la tarjeta, suman un sello por compra y canjean el premio (reinicia los sellos) en \`/fidelidad.html\`.' : 'La carga de sellos y el canje requieren el módulo **Autenticación** (habilita \`/fidelidad.html\`); sin él, mirá \`data/loyaltycards.json\`.'} El visitante solo puede consultar/crear su tarjeta, nunca sumarse sellos.`,
  ],
};
