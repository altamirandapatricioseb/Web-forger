// Solicitar llamada ("Te llamamos"): sección en la Home donde el visitante deja su nombre,
// teléfono y una franja horaria preferida para que el negocio lo llame. El backend guarda el
// pedido (colección callbacks) con estado pendiente y devuelve cuánta gente ya pidió que la
// llamen (prueba social, count-up con Anime.js + red de seguridad). Con el módulo de
// autenticación activo, suma una página /llamadas.html solo-admin con la lista de pedidos,
// botón para marcarlos como "contactado" y CSV. Sin auth el pedido se guarda igual y se lee en
// data/callbacks.json. Distinto de "contact" (mensaje escrito), "bookings" (turno con fecha) e
// "inbox" (bandeja): acá el cliente pide explícitamente que lo llamen y el admin gestiona la cola.
const FRANJAS = [
  { id: 'manana', label: 'A la mañana (9 a 12 h)' },
  { id: 'tarde', label: 'A la tarde (12 a 18 h)' },
  { id: 'noche', label: 'Al final del día (18 a 21 h)' },
  { id: 'cualquiera', label: 'Cualquier horario' },
];

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'callback', type: 'functional', name: 'Solicitar llamada',
  description: 'Sección "Te llamamos": el visitante deja su teléfono y franja horaria y el negocio lo llama. Muestra cuánta gente ya lo pidió (Anime.js). Con auth activo, panel admin en /llamadas.html con la cola de pedidos, marcado de "contactado" y CSV.',
  usesAnime: true,
  mounts: [{ route: '/api/callback', file: 'routes/callback.js' }],
  collections: ['callbacks'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Llamadas', href: '/llamadas.html', id: 'nav-llamadas' }] : [],
  html: () => `  <section id="solicitar-llamada">
    <div class="container" style="max-width:640px">
      <h2>¿Preferís que te llamemos?</h2>
      <p class="section-sub">Dejanos tu teléfono y cuándo te viene bien: te llamamos nosotros, sin costo.</p>
      <p class="cb-social" id="cb-social" hidden><strong class="cb-num" data-n="0">0</strong> personas ya pidieron que las llamemos.</p>
      <form id="cb-form" class="card">
        <label>Nombre</label>
        <input name="name" required maxlength="80" placeholder="Tu nombre">
        <label>Teléfono</label>
        <input name="phone" required maxlength="30" placeholder="Ej: 11 2345-6789" inputmode="tel">
        <label>¿Cuándo te llamamos?</label>
        <select name="slot" id="cb-slot"></select>
        <label>Motivo (opcional)</label>
        <input name="reason" maxlength="200" placeholder="Contanos brevemente el motivo">
        <button class="btn" type="submit" style="margin-top:10px">Pedir que me llamen</button>
      </form>
      <div id="cb-ok" hidden></div>
      <noscript><p class="muted">Activá JavaScript para pedir una llamada.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    .cb-social{font-size:.9rem;color:var(--muted);margin:0 0 12px}
    .cb-social strong{color:var(--accent);font-variant-numeric:tabular-nums}
    #cb-ok{background:var(--surface);border-left:3px solid var(--accent);padding:14px 16px;border-radius:0 var(--radius) var(--radius) 0}
    #cb-ok h3{margin:0 0 4px}
    .cb-check{display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:50%;background:var(--accent);color:#fff;font-size:.8rem;margin-right:6px}
  </style>`,
  files: (cfg) => ({
    'routes/callback.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, oneOf } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
// Franjas horarias que puede elegir el visitante (editá las etiquetas según tu operación)
const FRANJAS = ${JSON.stringify(FRANJAS, null, 2)};
const ESTADOS = ['pendiente', 'contactado'];
const franjaLabel = (id) => (FRANJAS.find(f => f.id === id) || {}).label || id;

const validar = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  phone: (v) => str(v, 4, 30),
  slot: (v) => oneOf(v, FRANJAS.map(f => f.id)),
});

// GET /api/callback/stats — cuántas personas ya pidieron una llamada (prueba social pública)
router.get('/stats', async (req, res) => {
  res.json({ total: await db.count('callbacks') });
});

// POST /api/callback — registra el pedido { name, phone, slot, reason? }
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 200) : '';
  await db.insert('callbacks', {
    name: req.body.name.trim(),
    phone: req.body.phone.trim(),
    slot: req.body.slot,
    slotLabel: franjaLabel(req.body.slot),
    reason,
    status: 'pendiente',
  });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): alguien pidió que lo llamen.
  // Es "disparar y seguir": un email caído jamás rompe el pedido de llamada.
  mailer.notify('Nuevo pedido de llamada', req.body.name.trim() + ' pidió que lo llamen al ' + req.body.phone.trim() + ' (' + franjaLabel(req.body.slot) + ')' + (reason ? '. Motivo: ' + reason : '') + '.').catch(() => {});
` : ''}  res.status(201).json({ ok: true, total: await db.count('callbacks') });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/callback/all — cola de pedidos (solo admin; filtro ?status=pendiente|contactado)
router.get('/all', requireAdmin, async (req, res) => {
  let rows = await db.all('callbacks');
  if (req.query.status && ESTADOS.includes(req.query.status)) rows = rows.filter(r => r.status === req.query.status);
  res.json(rows.reverse());
});

// PATCH /api/callback/:id — cambia el estado del pedido (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  if (!oneOf(req.body.status, ESTADOS)) return res.status(422).json({ error: 'Estado inválido', errors: { status: 'Debe ser ' + ESTADOS.join(', ') } });
  const row = await db.update('callbacks', req.params.id, { status: req.body.status });
  if (!row) return res.status(404).json({ error: 'Pedido inexistente' });
  res.json(row);
});
` : `// La cola de pedidos de llamada (listar y marcar como contactado) requiere el módulo de
// autenticación: activalo en el Builder para habilitar /llamadas.html. Sin él, los pedidos
// quedan guardados en data/callbacks.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    llamadas: {
      title: 'Pedidos de llamada',
      html: `  <section>
    <div class="container">
      <h2>Pedidos de llamada</h2>
      <p class="section-sub">Quiénes pidieron que los llames, con su horario preferido. Marcá "contactado" cuando ya hablaste. Solo visible para administradores.</p>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
        <select id="cb-filtro" style="width:auto;min-width:200px">
          <option value="">Todos</option>
          <option value="pendiente">Pendientes</option>
          <option value="contactado">Contactados</option>
        </select>
        <button class="btn ghost" type="button" id="cb-csv">Descargar CSV</button>
      </div>
      <div id="cb-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo solicitar llamada: sección pública con formulario de pedido y contador de prueba
   social (Anime.js + red de seguridad), y con auth activo, el panel admin en /llamadas.html.
   En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FRANJAS = ${JSON.stringify(FRANJAS)};

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

  // ---- Sección pública (Home) ----
  var form = document.getElementById('cb-form');
  if (form) {
    var slotSel = document.getElementById('cb-slot');
    if (slotSel) slotSel.innerHTML = FRANJAS.map(function (f) { return '<option value="' + f.id + '">' + App.esc(f.label) + '</option>'; }).join('');
    var social = document.getElementById('cb-social');
    var okBox = document.getElementById('cb-ok');

    function mostrarSocial(total) {
      if (!social) return;
      if (total > 0) { social.hidden = false; contar(social.querySelector('.cb-num'), total); }
    }

    function pedirStats() {
      if (window.__PREVIEW__) { mostrarSocial(48); return; }
      App.api('/api/callback/stats').then(function (r) { mostrarSocial(r.total || 0); }).catch(function () {});
    }
    pedirStats();

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = Object.fromEntries(new FormData(form));
      if (window.__PREVIEW__) { mostrarOk(datos); return; }
      try {
        var r = await App.api('/api/callback', { method: 'POST', body: datos });
        mostrarOk(datos);
        mostrarSocial(r.total || 0);
        App.toast('¡Listo! Te vamos a llamar.');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function mostrarOk(datos) {
      form.hidden = true;
      if (okBox) {
        var franja = (FRANJAS.filter(function (f) { return f.id === datos.slot; })[0] || {}).label || '';
        okBox.hidden = false;
        okBox.innerHTML = '<h3><span class="cb-check">${phIcon('check', { size: 16 })}</span>Pedido registrado</h3>' +
          '<p style="margin:0" class="muted">Te llamamos al <strong>' + App.esc(datos.phone) + '</strong>' +
          (franja ? ' — ' + App.esc(franja) : '') + '. Gracias, ' + App.esc((datos.name || '').split(' ')[0]) + '.</p>';
        var anime = window.anime;
        if (anime && anime.animate && !reduce) anime.animate(okBox, { opacity: [0, 1], translateY: [8, 0], duration: 450, ease: 'outCubic' });
      }
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel admin (/llamadas.html) ----
  var adminBox = document.getElementById('cb-admin');
  if (adminBox) {
    var filtro = document.getElementById('cb-filtro');
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var ETIQUETAS = { createdAt: 'Fecha', name: 'Nombre', phone: 'Teléfono', slotLabel: 'Horario', reason: 'Motivo', status: 'Estado' };

    function filtrados() {
      var v = filtro && filtro.value;
      return v ? todos.filter(function (r) { return r.status === v; }) : todos;
    }

    function pintar() {
      adminBox.innerHTML = App.table(filtrados(), [
        { label: ETIQUETAS.createdAt, render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } },
        { key: 'name', label: ETIQUETAS.name },
        { label: ETIQUETAS.phone, render: function (r) { return '<a href="tel:' + App.esc(String(r.phone).replace(/[^0-9+]/g, '')) + '">' + App.esc(r.phone) + '</a>'; } },
        { label: ETIQUETAS.slotLabel, render: function (r) { return '<span class="badge" style="vertical-align:baseline">' + App.esc(r.slotLabel || r.slot || '—') + '</span>'; } },
        { label: ETIQUETAS.reason, render: function (r) { return r.reason ? App.esc(r.reason) : '<span class="muted">—</span>'; } },
        { label: ETIQUETAS.status, render: function (r) {
          if (r.status === 'contactado') return '<span style="color:var(--accent)">${phIcon('check', { size: 13 })} contactado</span>';
          return '<button class="btn ghost" type="button" data-done="' + r.id + '" style="padding:4px 10px;font-size:.82rem">Marcar contactado</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-done]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var id = b.getAttribute('data-done');
          if (window.__PREVIEW__) { App.toast('Vista previa: se marcaría contactado'); return; }
          try {
            await App.api('/api/callback/' + id, { method: 'PATCH', body: { status: 'contactado' } });
            var f = todos.filter(function (r) { return r.id === id; })[0];
            if (f) f.status = 'contactado';
            pintar();
            App.toast('Marcado como contactado');
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    if (filtro) filtro.addEventListener('change', pintar);

    var csvBtn = document.getElementById('cb-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var claves = ['createdAt', 'name', 'phone', 'slotLabel', 'reason', 'status'];
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [claves.map(function (k) { return celda(ETIQUETAS[k] || k); }).join(';')];
      filtrados().forEach(function (r) { lineas.push(claves.map(function (k) { return celda(r[k]); }).join(';')); });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'llamadas-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    function listo(rows) { todos = rows; pintar(); }

    if (window.__PREVIEW__) {
      listo([
        { id: '1', name: 'Sofía Ruiz', phone: '11 2345-6789', slot: 'manana', slotLabel: 'A la mañana (9 a 12 h)', reason: 'Consulta por un presupuesto', status: 'pendiente', createdAt: new Date().toISOString() },
        { id: '2', name: 'Diego Paz', phone: '11 9876-5432', slot: 'cualquiera', slotLabel: 'Cualquier horario', reason: '', status: 'contactado', createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/callback/all').then(listo)
        .catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navCb = document.getElementById('nav-llamadas');
    if (navCb && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navCb.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Solicitar llamada**: los pedidos se guardan en la colección \`callbacks\` con estado \`pendiente\`. Editá las franjas horarias en la constante \`FRANJAS\` de \`routes/callback.js\`. ${cfg.moduleIds.includes('auth') ? 'Los administradores ven la cola, marcan cada pedido como "contactado" y descargan el CSV en \`/llamadas.html\`.' : 'Para ver y gestionar la cola activá el módulo **Autenticación** (habilita \`/llamadas.html\`); sin él, mirá \`data/callbacks.json\`.'} El aviso de "personas que ya pidieron una llamada" es prueba social real (total de la colección).`,
  ],
};
