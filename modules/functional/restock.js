// Avisos de stock ("Avisame cuando vuelva"): sección en la Home que lista productos sin
// stock (constante PRODUCTOS, editable) y deja que el visitante pida ser avisado por email
// cuando vuelvan. El backend guarda los pedidos (colección restockrequests), controla que no
// se dupliquen (idempotente por producto+email) y devuelve cuánta gente está esperando ese
// producto (prueba social). El contador de interesados cuenta con Anime.js (red de seguridad
// setTimeout + respeta "prefers-reduced-motion"). Con auth activo, suma una página
// /avisos-stock.html solo-admin con los interesados por producto, un botón para marcar
// "avisados" y CSV. Sin auth los pedidos se guardan igual y se leen en
// data/restockrequests.json. Patrón clásico de e-commerce que mide demanda de lo agotado.
const PRODUCTOS = [
  { id: 'p1', name: 'Producto estrella', note: 'Talle único · agotado temporalmente' },
  { id: 'p2', name: 'Edición limitada', note: 'Vuelve en unas semanas' },
  { id: 'p3', name: 'Combo del mes', note: 'Sin stock por alta demanda' },
];

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'restock', type: 'functional', name: 'Avisos de stock',
  description: 'Sección "Avisame cuando vuelva": el visitante deja su email para que le avisen cuando un producto agotado vuelva a estar disponible, y ve cuánta gente lo espera (Anime.js). Con auth activo, panel admin en /avisos-stock.html con interesados por producto y CSV. Mide la demanda de lo agotado.',
  usesAnime: true,
  mounts: [{ route: '/api/restock', file: 'routes/restock.js' }],
  collections: ['restockrequests'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Avisos de stock', href: '/avisos-stock.html', id: 'nav-restock' }] : [],
  html: () => `  <section id="avisos-stock">
    <div class="container">
      <h2>Avisame cuando vuelva</h2>
      <p class="section-sub">¿Te interesa algo que está agotado? Dejanos tu email y te avisamos apenas vuelva.</p>
      <div class="grid cols-3" id="rs-lista"><p class="muted">Cargando productos…</p></div>
      <noscript><p class="muted">Activá JavaScript para pedir un aviso de stock.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    .rs-card{display:flex;flex-direction:column;gap:8px}
    .rs-agotado{display:inline-block;background:var(--surface);color:var(--muted);font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 8px;border-radius:999px;align-self:flex-start}
    .rs-espera{font-size:.85rem;color:var(--muted)}
    .rs-espera strong{color:var(--accent);font-variant-numeric:tabular-nums}
    .rs-form{display:grid;gap:8px;margin-top:auto}
    .rs-form input{width:100%}
    .rs-ok{background:var(--surface);border-left:3px solid var(--accent);padding:10px 14px;border-radius:0 var(--radius) var(--radius) 0;font-size:.88rem}
  </style>`,
  files: (cfg) => ({
    'routes/restock.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Productos agotados: editá esta lista (id, nombre y aclaración) según tu stock.
const PRODUCTOS = ${JSON.stringify(PRODUCTOS, null, 2)};
const producto = (id) => PRODUCTOS.find(p => p.id === id) || null;

const validar = (data) => check(data, {
  product: (v) => str(v, 1, 40),
  email: isEmail,
});

// Cantidad de interesados (no avisados aún) de un producto
async function esperando(id) {
  return (await db.find('restockrequests', r => r.product === id && !r.notified)).length;
}

// GET /api/restock — productos agotados con su cantidad de interesados (público)
router.get('/', async (req, res) => {
  const filas = await Promise.all(PRODUCTOS.map(async p => ({ id: p.id, name: p.name, note: p.note, waiting: await esperando(p.id) })));
  res.json(filas);
});

// POST /api/restock — pide aviso { product, email } (idempotente por producto+email)
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const p = producto(req.body.product);
  if (!p) return res.status(404).json({ error: 'El producto no existe' });
  const email = req.body.email.toLowerCase().trim();
  const previa = (await db.find('restockrequests', r => r.product === p.id && r.email === email))[0];
  if (previa) return res.json({ ok: true, waiting: await esperando(p.id), already: true });
  await db.insert('restockrequests', { product: p.id, email, notified: false });
  res.status(201).json({ ok: true, waiting: await esperando(p.id) });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/restock/all — interesados por producto (solo admin; filtro ?product=)
router.get('/all', requireAdmin, async (req, res) => {
  let rows = await db.all('restockrequests');
  if (req.query.product) rows = rows.filter(r => r.product === req.query.product);
  const nombre = {};
  PRODUCTOS.forEach(p => { nombre[p.id] = p.name; });
  res.json(rows.reverse().map(r => ({ ...r, productName: nombre[r.product] || r.product })));
});

// PATCH /api/restock/notified — marca como avisados a todos los de un producto (solo admin)
router.patch('/notified', requireAdmin, async (req, res) => {
  const p = producto(req.body.product);
  if (!p) return res.status(404).json({ error: 'El producto no existe' });
  const pendientes = await db.find('restockrequests', r => r.product === p.id && !r.notified);
  for (const r of pendientes) await db.update('restockrequests', r.id, { notified: true });
  res.json({ ok: true, marcados: pendientes.length });
});
` : `// El listado de interesados por producto requiere el módulo de autenticación: activalo en
// el Builder para habilitar /avisos-stock.html. Sin él, mirá data/restockrequests.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'avisos-stock': {
      title: 'Avisos de stock',
      html: `  <section>
    <div class="container">
      <h2>Interesados en avisos de stock</h2>
      <p class="section-sub">Quiénes esperan cada producto agotado. Cuando repongas stock, marcá "avisados" y exportá el CSV para mandarles el aviso. Solo visible para administradores.</p>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
        <select id="rs-filtro" style="width:auto;min-width:200px"><option value="">Todos los productos</option></select>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn ghost" type="button" id="rs-marcar">Marcar seleccionado como avisado</button>
          <button class="btn ghost" type="button" id="rs-csv">Descargar CSV</button>
        </div>
      </div>
      <div id="rs-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo avisos de stock: lista los productos agotados con su cantidad de interesados,
   deja pedir un aviso por email y anima el contador (Anime.js + red de seguridad). Un
   pedido por producto por navegador (localStorage). En la vista previa del Builder simula
   la API. Con auth, arma el panel admin en /avisos-stock.html. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PRODUCTOS_DEMO = ${JSON.stringify(PRODUCTOS)};

  function pedido(id) { try { return localStorage.getItem('rs-pedido-' + id); } catch (e) { return null; } }
  function recordar(id) { try { localStorage.setItem('rs-pedido-' + id, '1'); } catch (e) {} }

  // ---- Sección pública (Home) ----
  var lista = document.getElementById('rs-lista');
  if (lista) {
    function demoEstado() {
      var w = { p1: 34, p2: 12, p3: 7 };
      return PRODUCTOS_DEMO.map(function (p) { return { id: p.id, name: p.name, note: p.note, waiting: w[p.id] || 0 }; });
    }

    function pintarLista(productos) {
      lista.innerHTML = '';
      productos.forEach(function (p) {
        var card = document.createElement('div');
        card.className = 'card rs-card';
        card.setAttribute('data-p', p.id);
        card.innerHTML =
          '<span class="rs-agotado">Sin stock</span>' +
          '<h3 style="margin:0">' + App.esc(p.name) + '</h3>' +
          '<p class="muted" style="margin:0">' + App.esc(p.note || '') + '</p>' +
          '<p class="rs-espera"><strong class="rs-num" data-n="' + p.waiting + '">' + p.waiting + '</strong> ' +
          (p.waiting === 1 ? 'persona espera' : 'personas esperan') + ' este producto</p>' +
          '<div class="rs-slot"></div>';
        lista.appendChild(card);
        var slot = card.querySelector('.rs-slot');
        if (pedido(p.id)) {
          slot.innerHTML = '<div class="rs-ok">${phIcon('check', { size: 15 })} Te avisamos por email cuando vuelva.</div>';
        } else {
          slot.innerHTML =
            '<form class="rs-form" data-p="' + p.id + '">' +
            '<input name="email" type="email" placeholder="Tu email" required>' +
            '<button class="btn" type="submit">Avisame cuando vuelva</button></form>';
        }
        contar(card.querySelector('.rs-num'), p.waiting, true);
      });
      enlazarForms();
    }

    function contar(el, hasta, desdeCero) {
      if (!el) return;
      var desde = desdeCero ? 0 : (Number(el.getAttribute('data-n')) || 0);
      el.setAttribute('data-n', hasta);
      var anime = window.anime;
      if (!anime || !anime.animate || reduce) { el.textContent = hasta; return; }
      var st = { v: desde };
      anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v); } });
      // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
      setTimeout(function () { el.textContent = hasta; }, 800);
    }

    function enlazarForms() {
      lista.querySelectorAll('.rs-form').forEach(function (form) {
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          var id = form.getAttribute('data-p');
          var card = form.closest('.card');
          var email = (new FormData(form)).get('email');
          if (window.__PREVIEW__) {
            recordar(id);
            if (card) { contar(card.querySelector('.rs-num'), (Number((card.querySelector('.rs-num') || {}).getAttribute && card.querySelector('.rs-num').getAttribute('data-n')) || 0) + 1); mostrarOk(card); }
            return;
          }
          try {
            var r = await App.api('/api/restock', { method: 'POST', body: { product: id, email: email } });
            recordar(id);
            if (card) { contar(card.querySelector('.rs-num'), r.waiting); mostrarOk(card); }
            App.toast(r.already ? 'Ya estabas anotado' : '¡Listo! Te avisamos cuando vuelva.');
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    function mostrarOk(card) {
      var slot = card.querySelector('.rs-slot');
      if (slot) slot.innerHTML = '<div class="rs-ok">${phIcon('check', { size: 15 })} Te avisamos por email cuando vuelva.</div>';
    }

    (async function () {
      if (window.__PREVIEW__) { pintarLista(demoEstado()); return; }
      try { pintarLista(await App.api('/api/restock')); }
      catch (err) { lista.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; }
    })();
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel admin (/avisos-stock.html) ----
  var adminBox = document.getElementById('rs-admin');
  if (adminBox) {
    var filtro = document.getElementById('rs-filtro');
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var ETIQUETAS = { createdAt: 'Fecha', productName: 'Producto', email: 'Email', notified: 'Avisado' };

    function filtrados() {
      var v = filtro && filtro.value;
      return v ? todos.filter(function (r) { return r.product === v; }) : todos;
    }

    function pintar() {
      adminBox.innerHTML = App.table(filtrados(), [
        { label: ETIQUETAS.createdAt, render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } },
        { label: ETIQUETAS.productName, render: function (r) { return '<span class="badge" style="vertical-align:baseline">' + App.esc(r.productName || '—') + '</span>'; } },
        { key: 'email', label: ETIQUETAS.email },
        { label: ETIQUETAS.notified, render: function (r) { return r.notified ? '<span style="color:var(--accent)">${phIcon('check', { size: 13 })} sí</span>' : '<span class="muted">pendiente</span>'; } },
      ]);
    }

    function pintarFiltro() {
      if (!filtro) return;
      var vistos = {};
      todos.forEach(function (r) { if (r.product) vistos[r.product] = r.productName || r.product; });
      Object.keys(vistos).forEach(function (id) {
        var op = document.createElement('option');
        op.value = id; op.textContent = vistos[id];
        filtro.appendChild(op);
      });
      filtro.addEventListener('change', pintar);
    }

    var marcarBtn = document.getElementById('rs-marcar');
    if (marcarBtn) marcarBtn.addEventListener('click', async function () {
      var v = filtro && filtro.value;
      if (!v) { App.toast('Elegí un producto en el filtro primero'); return; }
      if (window.__PREVIEW__) { App.toast('Vista previa: se marcarían como avisados'); return; }
      try {
        var r = await App.api('/api/restock/notified', { method: 'PATCH', body: { product: v } });
        App.toast('Marcados como avisados: ' + r.marcados);
        App.api('/api/restock/all').then(function (rows) { todos = rows; pintar(); });
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var csvBtn = document.getElementById('rs-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var claves = ['createdAt', 'productName', 'email', 'notified'];
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [claves.map(function (k) { return celda(ETIQUETAS[k] || k); }).join(';')];
      filtrados().forEach(function (r) { lineas.push(claves.map(function (k) { return celda(k === 'notified' ? (r[k] ? 'sí' : 'no') : r[k]); }).join(';')); });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'avisos-stock-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    function listo(rows) { todos = rows; pintarFiltro(); pintar(); }

    if (window.__PREVIEW__) {
      listo([
        { product: 'p1', productName: 'Producto estrella', email: 'sofia@mail.com', notified: false, createdAt: new Date().toISOString() },
        { product: 'p2', productName: 'Edición limitada', email: 'diego@mail.com', notified: true, createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/restock/all').then(listo)
        .catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navRs = document.getElementById('nav-restock');
    if (navRs && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navRs.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Avisos de stock**: editá los productos agotados en la constante \`PRODUCTOS\` de \`routes/restock.js\`. Los pedidos de aviso se guardan en la colección \`restockrequests\` (idempotente por producto+email). ${cfg.moduleIds.includes('auth') ? 'Los administradores ven los interesados por producto, los marcan como avisados y descargan el CSV en \`/avisos-stock.html\` para mandarles el mail cuando repongas stock.' : 'Para ver los interesados activá el módulo **Autenticación** (habilita \`/avisos-stock.html\`); sin él, mirá \`data/restockrequests.json\`.'} El aviso por email lo mandás vos con la lista exportada (o integrando el módulo Newsletter / un servicio de email).`,
  ],
};
