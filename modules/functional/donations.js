// Donaciones con meta de recaudación: sección en la Home donde el visitante registra un aporte
// (nombre, email, monto y mensaje opcional) para una causa. El backend guarda cada aporte
// (colección donations) y calcula el total recaudado y el porcentaje hacia la META. La barra de
// progreso y el total se animan con Anime.js (count-up + red de seguridad setTimeout + respeta
// "prefers-reduced-motion"). El aporte se registra como "comprometido" (no cobra: es un registro de
// intención, sin servicios pagos). Con auth activo, suma una página /donaciones.html solo-admin con
// la lista de aportes, el marcado de "recibido/pendiente", el total confirmado y CSV. Sin auth los
// aportes se guardan igual y se leen en data/donations.json. Distinto del módulo UI "Barra de meta"
// (solo visual, sin backend) y de "loyalty" (puntos): acá se registran aportes reales hacia una meta.
const META = 500000; // Meta de recaudación en la moneda del sitio (editable)
const CAUSA = 'nuestra campaña solidaria'; // Nombre de la causa (editable)
const MIN = 100; // Aporte mínimo (editable)
const MAX = 1000000; // Aporte máximo (editable)
const MONTOS = [500, 1000, 2500, 5000]; // Montos sugeridos en la UI

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'donations', type: 'functional', name: 'Donaciones con meta',
  description: 'Recaudación hacia una meta: el visitante registra un aporte (monto + datos + mensaje) y el backend suma el total recaudado y el % de la meta, con barra y total animados (Anime.js). Con auth activo, panel admin en /donaciones.html con los aportes, marcado recibido/pendiente y CSV.',
  usesAnime: true,
  mounts: [{ route: '/api/donations', file: 'routes/donations.js' }],
  collections: ['donations'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Donaciones', href: '/donaciones.html', id: 'nav-donations' }] : [],
  html: () => `  <section id="donations">
    <div class="container" style="max-width:760px">
      <h2>Sumate a ${CAUSA}</h2>
      <p class="section-sub">Cada aporte nos acerca a la meta. Registrá el tuyo y seguí el avance en vivo.</p>
      <div class="don-meta card">
        <div class="don-cifras">
          <div><strong class="don-total" id="don-total" data-n="0">${'$0'}</strong><span>recaudado</span></div>
          <div class="don-goal">de <strong id="don-goal">—</strong></div>
        </div>
        <div class="don-track"><div class="don-fill" id="don-fill" data-pct="0"></div></div>
        <p class="muted" style="margin:6px 0 0;font-size:.82rem"><span id="don-pct">0</span>% de la meta · <span id="don-count">0</span> aportes</p>
      </div>
      <form id="don-form" class="card" style="margin-top:20px">
        <h3>Registrar mi aporte</h3>
        <div class="grid cols-2">
          <div><label>Nombre</label><input name="name" required maxlength="80"></div>
          <div><label>Email</label><input name="email" type="email" required></div>
        </div>
        <label>Monto del aporte</label>
        <div class="don-montos" id="don-montos">${MONTOS.map((m, i) => `<button type="button" class="don-monto${i === 0 ? ' on' : ''}" data-monto="${m}">$${m.toLocaleString('es-AR')}</button>`).join('')}</div>
        <input name="amount" type="number" min="${MIN}" max="${MAX}" step="100" value="${MONTOS[0]}" required>
        <label>Mensaje de apoyo (opcional)</label><textarea name="message" rows="2" maxlength="200" placeholder="¡Fuerza con la causa!"></textarea>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:12px"><input type="checkbox" name="anon" style="width:auto"> Mostrar mi aporte como anónimo</label>
        <div style="margin-top:16px"><button class="btn" type="submit">Registrar aporte</button></div>
      </form>
      <div id="don-ultimos" style="margin-top:20px"></div>
      <noscript><p class="muted">Activá JavaScript para registrar tu aporte.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    #donations .don-meta{padding:22px}
    #donations .don-cifras{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;justify-content:space-between}
    #donations .don-cifras strong{font-size:2.2rem;color:var(--accent);line-height:1;font-variant-numeric:tabular-nums}
    #donations .don-cifras>div>span{display:block;font-size:.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
    #donations .don-goal{color:var(--muted);font-size:1rem}
    #donations .don-goal strong{color:var(--text);font-variant-numeric:tabular-nums}
    #donations .don-track{height:14px;background:var(--surface);border:1px solid var(--line);border-radius:999px;overflow:hidden;margin:14px 0 0}
    #donations .don-fill{height:100%;width:0;background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 60%,var(--primary)));border-radius:999px}
    #donations .don-montos{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 10px}
    #donations .don-monto{flex:1;min-width:80px;padding:9px 10px;border:1px solid var(--line);background:var(--bg);border-radius:var(--radius);font-weight:700;color:var(--muted);cursor:pointer;font-variant-numeric:tabular-nums}
    #donations .don-monto:hover{border-color:var(--accent);color:var(--accent)}
    #donations .don-monto.on{background:var(--accent);border-color:var(--accent);color:#fff}
    #donations .don-lista{display:grid;gap:8px}
    #donations .don-item{display:flex;justify-content:space-between;gap:10px;padding:8px 12px;background:var(--surface);border-radius:var(--radius);font-size:.9rem}
    #donations .don-item strong{color:var(--accent)}
  </style>`,
  files: (cfg) => ({
    'routes/donations.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
const META = ${META}; // Meta de recaudación
const CAUSA = ${JSON.stringify(CAUSA)};
const MIN = ${MIN};
const MAX = ${MAX};

// Resumen público: total recaudado, cantidad de aportes y % hacia la meta
async function resumen() {
  const rows = await db.all('donations');
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const pct = META > 0 ? Math.min(100, Math.round(total * 100 / META)) : 0;
  return { total, count: rows.length, goal: META, causa: CAUSA, pct };
}

// Últimos aportes visibles públicamente (respeta el flag anónimo, sin email)
async function ultimos(n) {
  const rows = (await db.all('donations')).slice(-n).reverse();
  return rows.map(r => ({ name: r.anon ? 'Anónimo' : r.name, amount: r.amount, message: r.message || '' }));
}

const validar = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  email: (v) => typeof v === 'string' && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v),
  amount: (v) => num(v, MIN, MAX),
  message: (v) => v === undefined || v === null || (typeof v === 'string' && v.length <= 200),
});

// GET /api/donations/summary — total, % y últimos aportes (público)
router.get('/summary', async (req, res) => {
  res.json({ ...(await resumen()), recent: await ultimos(5) });
});

// POST /api/donations — registra un aporte comprometido y devuelve el resumen actualizado
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos (revisá el monto)', errors });
  await db.insert('donations', {
    name: req.body.name.trim(),
    email: req.body.email.toLowerCase().trim(),
    amount: Math.round(Number(req.body.amount)),
    message: (req.body.message || '').trim(),
    anon: Boolean(req.body.anon),
    received: false,
  });
  res.status(201).json({ ...(await resumen()), recent: await ultimos(5) });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/donations/all — todos los aportes con el total confirmado (solo admin; filtro ?received=)
router.get('/all', requireAdmin, async (req, res) => {
  let rows = (await db.all('donations')).reverse();
  if (req.query.received === 'si') rows = rows.filter(r => r.received);
  if (req.query.received === 'no') rows = rows.filter(r => !r.received);
  const confirmado = rows.filter(r => r.received).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  res.json({ resumen: await resumen(), confirmado, aportes: rows });
});

// PATCH /api/donations/:id — marca un aporte como recibido/pendiente (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  if (req.body.received === undefined) return res.status(422).json({ error: 'Nada para actualizar' });
  const row = await db.update('donations', req.params.id, { received: Boolean(req.body.received) });
  if (!row) return res.status(404).json({ error: 'Aporte inexistente' });
  res.json(row);
});
` : `// El detalle de aportes y el marcado recibido/pendiente requieren el módulo de autenticación:
// activalo en el Builder para habilitar /donaciones.html. Sin él, mirá data/donations.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    donaciones: {
      title: 'Donaciones',
      html: `  <section>
    <div class="container">
      <h2>Aportes recibidos</h2>
      <p class="section-sub">Total recaudado, aportes y confirmación de recepción. Solo visible para administradores.</p>
      <div id="don-admin-resumen"></div>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin:20px 0 12px">
        <select id="don-filtro" style="width:auto;min-width:200px">
          <option value="">Todos los aportes</option>
          <option value="si">Recibidos</option>
          <option value="no">Pendientes</option>
        </select>
        <button class="btn ghost" type="button" id="don-csv">Descargar CSV</button>
      </div>
      <div id="don-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo donaciones: sección pública con barra de meta animada (Anime.js + red de seguridad) y,
   con auth activo, panel admin en /donaciones.html. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Count-up de dinero con Anime.js (red de seguridad si la pestaña está oculta)
  function contarMoney(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = App.money(hasta); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 900, ease: 'outCubic', onUpdate: function () { el.textContent = App.money(Math.round(st.v)); } });
    setTimeout(function () { el.textContent = App.money(hasta); }, 1100);
  }
  function animarBarra(el, pct) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.style.width = pct + '%'; return; }
    anime.animate(el, { width: ['0%', pct + '%'], duration: 800, ease: 'outCubic' });
    setTimeout(function () { el.style.width = pct + '%'; }, 1000);
  }

  // ---- Sección pública (Home) ----
  var meta = document.querySelector('#donations .don-meta');
  if (meta) {
    var form = document.getElementById('don-form');
    var montos = document.getElementById('don-montos');
    var inputMonto = form && form.querySelector('[name="amount"]');

    if (montos) montos.addEventListener('click', function (e) {
      var b = e.target.closest('.don-monto');
      if (!b) return;
      montos.querySelectorAll('.don-monto').forEach(function (x) { x.classList.toggle('on', x === b); });
      if (inputMonto) inputMonto.value = b.getAttribute('data-monto');
    });
    if (inputMonto) inputMonto.addEventListener('input', function () {
      if (montos) montos.querySelectorAll('.don-monto').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-monto') === inputMonto.value); });
    });

    function pintarResumen(r, animar) {
      var goal = document.getElementById('don-goal');
      if (goal) goal.textContent = App.money(r.goal || 0);
      var pctEl = document.getElementById('don-pct');
      if (pctEl) pctEl.textContent = r.pct || 0;
      var countEl = document.getElementById('don-count');
      if (countEl) countEl.textContent = r.count || 0;
      var totalEl = document.getElementById('don-total');
      var fill = document.getElementById('don-fill');
      if (animar) { contarMoney(totalEl, r.total || 0); animarBarra(fill, r.pct || 0); }
      else { if (totalEl) totalEl.textContent = App.money(r.total || 0); if (fill) fill.style.width = (r.pct || 0) + '%'; }
      var ultimos = document.getElementById('don-ultimos');
      if (ultimos && r.recent && r.recent.length) {
        ultimos.innerHTML = '<h3 style="font-size:1rem;margin:0 0 8px">Últimos aportes</h3><div class="don-lista">' +
          r.recent.map(function (a) {
            return '<div class="don-item"><span>' + App.esc(a.name) + (a.message ? ' <span class="muted">— ' + App.esc(a.message) + '</span>' : '') + '</span><strong>' + App.money(a.amount) + '</strong></div>';
          }).join('') + '</div>';
      }
    }

    if (window.__PREVIEW__) {
      pintarResumen({ total: 320000, count: 87, goal: 500000, pct: 64, recent: [
        { name: 'Lucía', amount: 5000, message: '¡Éxitos!' },
        { name: 'Anónimo', amount: 2500, message: '' },
        { name: 'Marcos', amount: 1000, message: 'Gran causa' },
      ] }, true);
    } else {
      App.api('/api/donations/summary').then(function (r) { pintarResumen(r, true); }).catch(function () {});
    }

    if (form) form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var body = { name: fd.get('name'), email: fd.get('email'), amount: Number(fd.get('amount')), message: fd.get('message'), anon: fd.get('anon') === 'on' };
      if (window.__PREVIEW__) { pintarResumen({ total: 320000 + body.amount, count: 88, goal: 500000, pct: Math.min(100, Math.round((320000 + body.amount) * 100 / 500000)), recent: [{ name: body.anon ? 'Anónimo' : body.name, amount: body.amount, message: body.message || '' }] }, true); form.reset(); App.toast('Vista previa: se registraría el aporte'); return; }
      try {
        var r = await App.api('/api/donations', { method: 'POST', body: body });
        form.reset();
        pintarResumen(r, true);
        App.toast('¡Gracias por tu aporte!');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel admin (/donaciones.html) ----
  var adminBox = document.getElementById('don-admin');
  if (adminBox) {
    var filtro = document.getElementById('don-filtro');
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var ETIQUETAS = { createdAt: 'Fecha', name: 'Nombre', email: 'Email', amount: 'Monto', message: 'Mensaje', received: 'Recibido', anon: 'Anónimo' };

    function pintarResumenAdmin(data) {
      var box = document.getElementById('don-admin-resumen');
      if (!box) return;
      var r = data.resumen || {};
      box.innerHTML = '<div class="card" style="display:flex;gap:28px;align-items:center;flex-wrap:wrap">' +
        '<div><div style="font-size:2rem;font-weight:800;color:var(--accent);line-height:1">' + App.money(r.total || 0) + '</div><div class="muted" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.04em">Recaudado</div></div>' +
        '<div><div style="font-size:2rem;font-weight:800;line-height:1">' + App.money(data.confirmado || 0) + '</div><div class="muted" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.04em">Confirmado</div></div>' +
        '<div class="muted" style="font-size:.9rem"><div>Meta: <strong>' + App.money(r.goal || 0) + '</strong></div><div>Aportes: <strong>' + (r.count || 0) + '</strong></div><div>Avance: <strong>' + (r.pct || 0) + '%</strong></div></div></div>';
    }

    function cargar() {
      var q = filtro && filtro.value ? '?received=' + filtro.value : '';
      if (window.__PREVIEW__) { listo({ resumen: { total: 320000, count: 3, goal: 500000, pct: 64 }, confirmado: 7500, aportes: [
        { id: '1', name: 'Lucía', email: 'lucia@mail.com', amount: 5000, message: '¡Éxitos!', received: true, anon: false, createdAt: new Date().toISOString() },
        { id: '2', name: 'Marcos', email: 'marcos@mail.com', amount: 2500, message: '', received: true, anon: false, createdAt: new Date().toISOString() },
        { id: '3', name: 'Sofía', email: 'sofia@mail.com', amount: 1000, message: 'Gran causa', received: false, anon: true, createdAt: new Date().toISOString() },
      ] }); return; }
      App.api('/api/donations/all' + q).then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }

    function listo(data) { todos = data.aportes || []; pintarResumenAdmin(data); pintar(); }

    function pintar() {
      adminBox.innerHTML = App.table(todos, [
        { label: ETIQUETAS.createdAt, render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } },
        { label: ETIQUETAS.name, render: function (r) { return App.esc(r.name) + (r.anon ? ' <span class="muted">(anón.)</span>' : ''); } },
        { label: ETIQUETAS.email, render: function (r) { return '<span class="muted">' + App.esc(r.email) + '</span>'; } },
        { label: ETIQUETAS.amount, render: function (r) { return '<strong>' + App.money(r.amount) + '</strong>'; } },
        { label: ETIQUETAS.message, render: function (r) { return r.message ? App.esc(r.message) : '<span class="muted">—</span>'; } },
        { label: ETIQUETAS.received, render: function (r) { return '<button class="btn ghost" type="button" data-don-rec="' + r.id + '">' + (r.received ? '${phIcon('check', { size: 13 })} Recibido' : 'Marcar recibido') + '</button>'; } },
      ]);
      adminBox.querySelectorAll('[data-don-rec]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var id = b.getAttribute('data-don-rec');
          var f = todos.filter(function (x) { return x.id === id; })[0];
          if (!f) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se marcaría como ' + (f.received ? 'pendiente' : 'recibido')); return; }
          try { await App.api('/api/donations/' + id, { method: 'PATCH', body: { received: !f.received } }); cargar(); App.toast('Aporte actualizado'); }
          catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    if (filtro) filtro.addEventListener('change', cargar);

    var csvBtn = document.getElementById('don-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var claves = ['createdAt', 'name', 'email', 'amount', 'message', 'received', 'anon'];
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [claves.map(function (k) { return celda(ETIQUETAS[k] || k); }).join(';')];
      todos.forEach(function (r) { lineas.push(claves.map(function (k) {
        if (k === 'received' || k === 'anon') return celda(r[k] ? 'Sí' : 'No');
        if (k === 'createdAt') return celda(r[k] ? new Date(r[k]).toLocaleDateString('es-AR') : '');
        return celda(r[k]);
      }).join(';')); });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'donaciones-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    if (window.__PREVIEW__) cargar();
    else if (!me || me.role !== 'admin') location.href = '/auth.html';
    else cargar();
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navN = document.getElementById('nav-donations');
    if (navN && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navN.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Donaciones con meta**: los aportes se registran en la colección \`donations\` y el visitante ve el total recaudado y el % hacia la meta (\`META\` = ${META}, editable en \`routes/donations.js\` junto con la causa). Los aportes son **comprometidos** (registro de intención, no cobran: sin servicios pagos). ${cfg.moduleIds.includes('auth') ? 'Los administradores ven todos los aportes, marcan cuáles fueron recibidos, ven el total confirmado y exportan el CSV en \`/donaciones.html\`.' : 'Para gestionar los aportes activá el módulo **Autenticación** (habilita \`/donaciones.html\`); sin él, mirá \`data/donations.json\`.'} Para cobrar de verdad, conectá el POST con Mercado Pago o Stripe desde \`routes/donations.js\`.`,
  ],
};
