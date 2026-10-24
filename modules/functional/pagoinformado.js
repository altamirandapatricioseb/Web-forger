// Informar pago por transferencia con backend real: el flujo clásico del comercio argentino que
// faltaba — el negocio publica sus datos bancarios (titular, banco, alias, CBU/CVU, editables sin
// regenerar) en /informar-pago.html y el cliente, después de transferir, INFORMA su pago con un
// formulario (nombre, email, referencia opcional de pedido/reserva/factura, importe, fecha y
// comprobante por URL solo http/https, anti-XSS). Cada aviso queda en la colección paymentreports
// con estado "pendiente" y un código PG-XXXXXX con el que el cliente consulta el estado en la misma
// página (aprobado / rechazado / pendiente). Con auth activo, /pagos-admin.html es el panel
// solo-admin: edición de los datos bancarios, KPIs animados (pendientes, aprobados, importe
// conciliado con count-up), aprobar/rechazar cada aviso, filtro por estado y CSV. Si el módulo de
// Avisos por email está activo, cada pago informado dispara mailer.notify(). Animado con Anime.js
// + red de seguridad. Distinto de "cart" (checkout con pedido) y "invoices" (comprobantes que
// emite el negocio): acá el CLIENTE avisa que transfirió y el negocio concilia contra su banco.

// Datos bancarios de ejemplo (ficha única; el admin los reemplaza por los reales desde el panel)
const SEMILLA_DATOS = [
  { holder: 'Completá el titular de la cuenta', bank: 'Tu banco', alias: 'tu.alias.aca', cbu: '', note: 'Editá estos datos desde el panel de pagos antes de difundir la página.' },
];

module.exports = {
  id: 'pagoinformado', type: 'functional', name: 'Informar pago por transferencia',
  description: 'Página /informar-pago.html con los datos bancarios del negocio (titular, banco, alias, CBU — editables desde el panel sin regenerar) y formulario para que el cliente informe su transferencia (referencia, importe, comprobante por URL): queda con estado pendiente y un código PG-XXXXXX para consultar si fue aprobado. Con auth activo, panel solo-admin de conciliación con KPIs, aprobar/rechazar, filtro y CSV. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/pagos', file: 'routes/pagoinformado.js' }],
  collections: ['paymentinfo', 'paymentreports'],
  nav: (cfg) => {
    const links = [{ label: 'Informar pago', href: '/informar-pago.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Pagos (admin)', href: '/pagos-admin.html', id: 'nav-pagos-admin' });
    return links;
  },
  head: () => `  <style>
    .pg-datos{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px 22px}
    .pg-datos div{display:flex;flex-direction:column;gap:2px}
    .pg-datos .muted{font-size:.8rem}
    .pg-datos strong{font-size:1.02rem;overflow-wrap:anywhere}
    .pg-copiar{margin-top:12px}
    .pg-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px}
    .pg-chip.aprobado{background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent)}
    .pg-chip.pendiente{background:var(--surface);border:1px solid var(--line);color:var(--muted)}
    .pg-chip.rechazado{background:color-mix(in srgb,#c0392b 12%,var(--surface));color:#c0392b}
    .pg-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .pg-kpis .card{text-align:center}
    .pg-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .pg-ok{border-left:3px solid var(--accent);padding:14px 18px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0}
    .pg-ok code{font-size:1.15rem;font-weight:800;color:var(--accent)}
  </style>`,
  files: (cfg) => ({
    'routes/pagoinformado.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { check, str, num, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
// Siembra la ficha de datos bancarios la primera vez (reemplazala por los datos reales)
db.seedIfEmpty('paymentinfo', ${JSON.stringify(SEMILLA_DATOS, null, 2)});

const ESTADOS = ['pendiente', 'aprobado', 'rechazado'];
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;

// El comprobante viaja por URL y solo se acepta http/https: cualquier otra cosa (javascript:,
// data:…) se descarta de raíz como anti-XSS
const urlSegura = (u) => typeof u === 'string' && /^https?:\\/\\//i.test(u.trim()) ? u.trim().slice(0, 300) : '';

// Vista pública de un aviso de pago: solo lo necesario para el seguimiento (sin email ni nota)
const publico = (p) => ({ code: p.code, amount: p.amount, status: p.status, date: p.date, createdAt: p.createdAt });

// GET /api/pagos/datos — datos bancarios para transferir (público, ficha única)
router.get('/datos', async (req, res) => {
  const f = (await db.all('paymentinfo'))[0] || {};
  res.json({ holder: f.holder || '', bank: f.bank || '', alias: f.alias || '', cbu: f.cbu || '', note: f.note || '' });
});

// POST /api/pagos — el cliente informa su transferencia (público)
router.post('/', async (req, res) => {
  const { ok, errors } = check(req.body, {
    name: (v) => str(v, 2, 80),
    email: isEmail,
    amount: (v) => num(v, 1, 1000000000),
    date: (v) => v === undefined || v === '' || (typeof v === 'string' && FECHA.test(v)),
  });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const code = 'PG-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const row = await db.insert('paymentreports', {
    code,
    name: req.body.name.trim(),
    email: req.body.email.toLowerCase().trim(),
    reference: typeof req.body.reference === 'string' ? req.body.reference.trim().slice(0, 80) : '',
    amount: req.body.amount,
    date: req.body.date || new Date().toISOString().slice(0, 10),
    receiptUrl: urlSegura(req.body.receiptUrl),
    comment: typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 300) : '',
    status: 'pendiente',
  });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): alguien informó una transferencia.
  // Es "disparar y seguir": un email caído jamás rompe el aviso de pago.
  mailer.notify('Pago informado por $' + Number(req.body.amount).toLocaleString('es-AR'), req.body.name.trim() + ' (' + req.body.email.toLowerCase().trim() + ') informó una transferencia de $' + Number(req.body.amount).toLocaleString('es-AR') + ' con fecha ' + row.date + (row.reference ? '. Referencia: ' + row.reference : '') + '. Código: ' + code + '. Conciliá contra tu banco desde el panel de pagos.').catch(() => {});
` : ''}  res.status(201).json(publico(row));
});

// GET /api/pagos/codigo/:code — estado público de un aviso por su código de seguimiento
router.get('/codigo/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const p = (await db.find('paymentreports', x => x.code === code))[0];
  if (!p) return res.status(404).json({ error: 'No encontramos un pago informado con ese código' });
  res.json(publico(p));
});
${cfg.moduleIds.includes('auth') ? `
// PATCH /api/pagos/admin/datos — edita la ficha de datos bancarios (solo admin)
router.patch('/admin/datos', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, {
    holder: (v) => str(v, 3, 90),
    bank: (v) => str(v, 2, 60),
    alias: (v) => str(v, 3, 60),
  });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const cbu = String(req.body.cbu || '').trim();
  if (cbu && !/^\\d{22}$/.test(cbu)) return res.status(422).json({ error: 'El CBU/CVU debe tener 22 dígitos (o quedar vacío)', errors: { cbu: 'Formato inválido' } });
  const ficha = (await db.all('paymentinfo'))[0];
  const datos = {
    holder: req.body.holder.trim(),
    bank: req.body.bank.trim(),
    alias: req.body.alias.trim(),
    cbu,
    note: typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 200) : '',
  };
  const row = ficha ? await db.update('paymentinfo', ficha.id, datos) : await db.insert('paymentinfo', datos);
  res.json(row);
});

// GET /api/pagos/admin/stats — KPIs de conciliación (solo admin)
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const rows = await db.all('paymentreports');
  res.json({
    pendientes: rows.filter(r => r.status === 'pendiente').length,
    aprobados: rows.filter(r => r.status === 'aprobado').length,
    rechazados: rows.filter(r => r.status === 'rechazado').length,
    montoAprobado: rows.filter(r => r.status === 'aprobado').reduce((s, r) => s + (r.amount || 0), 0),
  });
});

// GET /api/pagos/admin/list — avisos de pago, más recientes primero (solo admin; ?status= filtra)
router.get('/admin/list', requireAdmin, async (req, res) => {
  let rows = await db.all('paymentreports');
  if (req.query.status && ESTADOS.includes(req.query.status)) rows = rows.filter(r => r.status === req.query.status);
  res.json(rows.slice(-300).reverse());
});

// PATCH /api/pagos/admin/:id — aprueba o rechaza un aviso tras conciliar con el banco (solo admin)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  if (!ESTADOS.includes(req.body.status)) return res.status(422).json({ error: 'Estado inválido' });
  const row = await db.update('paymentreports', req.params.id, { status: req.body.status });
  if (!row) return res.status(404).json({ error: 'Aviso de pago inexistente' });
  res.json(row);
});

// DELETE /api/pagos/admin/:id — borra un aviso de pago (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const p = await db.get('paymentreports', req.params.id);
  if (!p) return res.status(404).json({ error: 'Aviso de pago inexistente' });
  await db.remove('paymentreports', req.params.id);
  res.json({ ok: true });
});
` : `// El panel de conciliación requiere el módulo de autenticación: activalo en el Builder para
// habilitar /pagos-admin.html. Sin él, los avisos igual se guardan en data/paymentreports.json
// y los datos bancarios se editan a mano en data/paymentinfo.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      'informar-pago': {
        title: 'Informar pago',
        html: `  <section>
    <div class="container" style="max-width:760px">
      <h2>Informar un pago</h2>
      <p class="section-sub">Transferí a nuestra cuenta y avisanos con este formulario: lo verificamos y te confirmamos.</p>
      <div class="card" style="margin-bottom:26px">
        <h3 style="margin-top:0">Datos para transferir</h3>
        <div class="pg-datos" id="pg-datos"><p class="muted">Cargando…</p></div>
        <button class="btn ghost pg-copiar" type="button" id="pg-copiar" hidden>Copiar alias</button>
      </div>
      <form id="pg-form" class="card">
        <h3 style="margin-top:0">Ya transferí, quiero avisar</h3>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Tu nombre</label><input name="name" required minlength="2" maxlength="80" placeholder="Nombre y apellido"></div>
          <div><label>Tu email</label><input name="email" type="email" required placeholder="tu@email.com"></div>
        </div>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Importe transferido</label><input name="amount" type="number" min="1" step="0.01" required placeholder="25000"></div>
          <div><label>Fecha del pago</label><input name="date" type="date"></div>
        </div>
        <label>Referencia (nro de pedido, reserva o factura — opcional)</label>
        <input name="reference" maxlength="80" placeholder="Ej: PED-1234">
        <label>Enlace al comprobante (opcional)</label>
        <input name="receiptUrl" type="url" maxlength="300" placeholder="https://…">
        <label>Comentario (opcional)</label>
        <textarea name="comment" rows="2" maxlength="300" placeholder="Algo que quieras aclarar…"></textarea>
        <button class="btn" type="submit" style="margin-top:14px">Informar el pago</button>
      </form>
      <div class="pg-ok" id="pg-ok" hidden style="margin-top:22px"></div>
      <form id="pg-track" class="card" style="margin-top:26px">
        <h3 style="margin-top:0">¿Ya informaste? Consultá el estado</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input name="code" required placeholder="Tu código (ej: PG-A1B2C3)" style="flex:1;min-width:180px">
          <button class="btn ghost" type="submit">Consultar</button>
        </div>
        <p id="pg-track-out" class="muted" style="margin:10px 0 0" hidden></p>
      </form>
      <noscript><p class="muted">Activá JavaScript para informar tu pago online.</p></noscript>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['pagos-admin'] = {
        title: 'Pagos informados',
        html: `  <section>
    <div class="container" style="max-width:960px">
      <h2>Pagos informados</h2>
      <p class="section-sub">Conciliá cada transferencia informada contra tu banco y aprobala o rechazala. Solo visible para administradores.</p>
      <form id="pga-datos" class="card" style="max-width:680px;margin-bottom:26px">
        <h3 style="margin-top:0">Datos bancarios publicados</h3>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Titular de la cuenta</label><input name="holder" required minlength="3" maxlength="90"></div>
          <div><label>Banco / billetera</label><input name="bank" required minlength="2" maxlength="60"></div>
        </div>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Alias</label><input name="alias" required minlength="3" maxlength="60"></div>
          <div><label>CBU/CVU (22 dígitos, opcional)</label><input name="cbu" maxlength="22" pattern="\\d{22}" placeholder="0000000000000000000000"></div>
        </div>
        <label>Aclaración (opcional)</label>
        <input name="note" maxlength="200" placeholder="Ej: enviá el comprobante por WhatsApp si podés">
        <button class="btn" type="submit" style="margin-top:14px">Guardar datos bancarios</button>
      </form>
      <div class="pg-kpis" id="pga-kpis"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <select id="pga-filtro" style="width:auto">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobado">Aprobados</option>
          <option value="rechazado">Rechazados</option>
        </select>
        <button class="btn ghost" type="button" id="pga-csv">Descargar CSV</button>
      </div>
      <div id="pga-list"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo informar pago: /informar-pago.html muestra los datos bancarios del backend, registra el
   aviso de transferencia (código PG- de seguimiento) y consulta su estado. Con auth, panel de
   conciliación en /pagos-admin.html. Animado con Anime.js (count-up) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CHIP = { pendiente: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado' };

  function chip(st) { return '<span class="pg-chip ' + st + '">' + (CHIP[st] || st) + '</span>'; }

  // ---- Página pública /informar-pago.html ----
  var datosBox = document.getElementById('pg-datos');
  if (datosBox) {
    var formP = document.getElementById('pg-form');
    var okBox = document.getElementById('pg-ok');
    var copiarBtn = document.getElementById('pg-copiar');
    var aliasActual = '';

    function pintarDatos(d) {
      var filas = [
        d.holder ? '<div><span class="muted">Titular</span><strong>' + App.esc(d.holder) + '</strong></div>' : '',
        d.bank ? '<div><span class="muted">Banco</span><strong>' + App.esc(d.bank) + '</strong></div>' : '',
        d.alias ? '<div><span class="muted">Alias</span><strong>' + App.esc(d.alias) + '</strong></div>' : '',
        d.cbu ? '<div><span class="muted">CBU/CVU</span><strong>' + App.esc(d.cbu) + '</strong></div>' : '',
      ].filter(Boolean);
      datosBox.innerHTML = filas.length ? filas.join('') : '<p class="muted">El negocio todavía no cargó sus datos bancarios.</p>';
      if (d.note) datosBox.innerHTML += '<div style="grid-column:1/-1"><span class="muted">' + App.esc(d.note) + '</span></div>';
      aliasActual = d.alias || '';
      if (copiarBtn) copiarBtn.hidden = !aliasActual;
    }

    if (copiarBtn) copiarBtn.addEventListener('click', function () {
      if (!aliasActual || !navigator.clipboard) return;
      navigator.clipboard.writeText(aliasActual).then(function () { App.toast('Alias copiado'); }).catch(function () {});
    });

    formP.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se informaría el pago'); return; }
      try {
        var r = await App.api('/api/pagos', { method: 'POST', body: {
          name: formP.querySelector('[name="name"]').value,
          email: formP.querySelector('[name="email"]').value,
          amount: Number(formP.querySelector('[name="amount"]').value),
          date: formP.querySelector('[name="date"]').value,
          reference: formP.querySelector('[name="reference"]').value,
          receiptUrl: formP.querySelector('[name="receiptUrl"]').value,
          comment: formP.querySelector('[name="comment"]').value,
        } });
        formP.reset();
        okBox.hidden = false;
        okBox.innerHTML = '<h3 style="margin-top:0">Aviso recibido</h3>' +
          '<p>Registramos tu pago de <strong>' + App.money(r.amount) + '</strong>. Lo verificamos contra nuestra cuenta y te confirmamos.</p>' +
          '<p>Tu código de seguimiento es <code>' + App.esc(r.code) + '</code>: guardalo para consultar el estado acá mismo.</p>';
        okBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        var anime = window.anime;
        if (anime && anime.animate && !reduce) {
          anime.animate(okBox, { opacity: [0, 1], translateY: [12, 0], duration: 450, ease: 'outCubic' });
          // Red de seguridad: deja la caja visible aunque el loop esté pausado
          setTimeout(function () { okBox.style.opacity = 1; okBox.style.transform = 'none'; }, 900);
        }
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var trackForm = document.getElementById('pg-track');
    var trackOut = document.getElementById('pg-track-out');
    trackForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se consultaría el estado'); return; }
      var code = trackForm.querySelector('[name="code"]').value.trim().toUpperCase();
      try {
        var p = await App.api('/api/pagos/codigo/' + encodeURIComponent(code));
        trackOut.hidden = false;
        trackOut.innerHTML = 'Pago <strong>' + App.esc(p.code) + '</strong> por ' + App.money(p.amount) + ' (' + App.esc(p.date) + '): ' + chip(p.status) +
          (p.status === 'pendiente' ? ' — lo estamos verificando.' : p.status === 'aprobado' ? ' — ¡listo, tu pago fue acreditado!' : ' — no pudimos acreditarlo: escribinos.');
      } catch (err) {
        if (err.message === 'preview') return;
        trackOut.hidden = false;
        trackOut.textContent = err.message;
      }
    });

    if (window.__PREVIEW__) {
      pintarDatos({ holder: 'Mi Empresa S.R.L.', bank: 'Banco Ejemplo', alias: 'mi.empresa.mp', cbu: '0000003100010000000001', note: '' });
    } else {
      fetch('/api/pagos/datos').then(function (r) { return r.json(); }).then(pintarDatos).catch(function () { datosBox.innerHTML = '<p class="muted">No pudimos cargar los datos bancarios.</p>'; });
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /pagos-admin.html ----
  var kpisBox = document.getElementById('pga-kpis');
  var datosForm = document.getElementById('pga-datos');
  if (kpisBox && datosForm) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var listBox = document.getElementById('pga-list');
    var filtro = document.getElementById('pga-filtro');

    function contar(el, hasta, esMoneda) {
      if (!el) return;
      var fmt = function (v) { return esMoneda ? App.money(Math.round(v)) : Math.round(v).toLocaleString('es-AR'); };
      var anime = window.anime;
      if (!anime || !anime.animate || reduce) { el.textContent = fmt(hasta); return; }
      var st = { v: 0 };
      anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = fmt(st.v); } });
      // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
      setTimeout(function () { el.textContent = fmt(hasta); }, 800);
    }

    function pintarStats(s) {
      kpisBox.innerHTML = '<div class="card"><strong id="pga-k-pen">0</strong><span class="muted">pendientes</span></div>' +
        '<div class="card"><strong id="pga-k-apr">0</strong><span class="muted">aprobados</span></div>' +
        '<div class="card"><strong id="pga-k-rec">0</strong><span class="muted">rechazados</span></div>' +
        '<div class="card"><strong id="pga-k-monto">$0</strong><span class="muted">conciliado</span></div>';
      contar(document.getElementById('pga-k-pen'), s.pendientes);
      contar(document.getElementById('pga-k-apr'), s.aprobados);
      contar(document.getElementById('pga-k-rec'), s.rechazados);
      contar(document.getElementById('pga-k-monto'), s.montoAprobado, true);
    }

    function pintarLista() {
      listBox.innerHTML = App.table(lista, [
        { key: 'code', label: 'Código' },
        { label: 'Cliente', render: function (r) { return App.esc(r.name) + '<br><span class="muted" style="font-size:.82rem">' + App.esc(r.email) + '</span>'; } },
        { label: 'Importe', render: function (r) { return '<strong>' + App.money(r.amount) + '</strong><br><span class="muted" style="font-size:.82rem">' + App.esc(r.date) + '</span>'; } },
        { label: 'Referencia', render: function (r) { return (r.reference ? App.esc(r.reference) : '—') + (r.receiptUrl ? '<br><a href="' + App.esc(r.receiptUrl) + '" target="_blank" rel="noopener">comprobante</a>' : ''); } },
        { label: 'Estado', render: function (r) { return chip(r.status) + (r.comment ? '<br><span class="muted" style="font-size:.78rem">' + App.esc(r.comment) + '</span>' : ''); } },
        { label: 'Acciones', render: function (r) {
          return (r.status !== 'aprobado' ? '<button class="btn ghost" type="button" data-est="aprobado" data-id="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Aprobar</button>' : '') +
            (r.status !== 'rechazado' ? '<button class="btn ghost" type="button" data-est="rechazado" data-id="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Rechazar</button>' : '') +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      listBox.querySelectorAll('[data-est]').forEach(function (b) { b.addEventListener('click', function () { cambiarEstado(b.getAttribute('data-id'), b.getAttribute('data-est')); }); });
      listBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
    }

    function cargar() {
      App.api('/api/pagos/admin/stats').then(pintarStats).catch(function (err) { kpisBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
      App.api('/api/pagos/admin/list' + (filtro.value ? '?status=' + filtro.value : '')).then(function (rows) { lista = rows; pintarLista(); }).catch(function () {});
    }

    async function cambiarEstado(id, status) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría el estado'); return; }
      try {
        await App.api('/api/pagos/admin/' + id, { method: 'PATCH', body: { status: status } });
        App.toast(status === 'aprobado' ? 'Pago aprobado' : 'Pago rechazado');
        cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría el aviso'); return; }
      if (!confirm('¿Borrar este aviso de pago?')) return;
      try {
        await App.api('/api/pagos/admin/' + id, { method: 'DELETE' });
        lista = lista.filter(function (r) { return r.id !== id; });
        pintarLista();
        App.toast('Aviso borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    datosForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardarían los datos bancarios'); return; }
      try {
        await App.api('/api/pagos/admin/datos', { method: 'PATCH', body: {
          holder: datosForm.querySelector('[name="holder"]').value,
          bank: datosForm.querySelector('[name="bank"]').value,
          alias: datosForm.querySelector('[name="alias"]').value,
          cbu: datosForm.querySelector('[name="cbu"]').value,
          note: datosForm.querySelector('[name="note"]').value,
        } });
        App.toast('Datos bancarios guardados');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    filtro.addEventListener('change', function () { if (!window.__PREVIEW__) cargar(); });

    var csvBtn = document.getElementById('pga-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var filas = [['codigo', 'fecha', 'nombre', 'email', 'importe', 'referencia', 'estado']].concat(lista.map(function (r) { return [r.code, r.date, r.name, r.email, r.amount, r.reference || '', r.status]; }));
      var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'pagos-informados.csv';
      a.click();
    });

    if (window.__PREVIEW__) {
      pintarStats({ pendientes: 2, aprobados: 5, rechazados: 1, montoAprobado: 340000 });
      lista = [
        { id: 'd1', code: 'PG-DEMO01', name: 'Ana López', email: 'ana@mail.com', amount: 25000, date: '2026-07-19', reference: 'PED-1234', receiptUrl: '', comment: '', status: 'pendiente' },
        { id: 'd2', code: 'PG-DEMO02', name: 'Luis Gómez', email: 'luis@mail.com', amount: 80000, date: '2026-07-18', reference: '', receiptUrl: '', comment: 'Transferí desde otra cuenta', status: 'aprobado' },
      ];
      pintarLista();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/pagos/datos').then(function (d) {
        ['holder', 'bank', 'alias', 'cbu', 'note'].forEach(function (k) { var el = datosForm.querySelector('[name="' + k + '"]'); if (el) el.value = d[k] || ''; });
      }).catch(function () {});
      cargar();
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navPg = document.getElementById('nav-pagos-admin');
    if (navPg && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navPg.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Informar pago por transferencia**: los datos bancarios publicados (titular, banco, alias, CBU) viven en la colección \`paymentinfo\` y se muestran en \`/informar-pago.html\` — **cargá los reales${cfg.moduleIds.includes('auth') ? ' desde \`/pagos-admin.html\`' : ' editando \`data/paymentinfo.json\`'} antes de difundir la página** (se siembra una ficha de ejemplo). Cada transferencia informada queda en \`paymentreports\` con estado pendiente y un código \`PG-\` con el que el cliente consulta si fue aprobada. ${cfg.moduleIds.includes('auth') ? 'La conciliación (aprobar/rechazar tras verificar contra tu banco) se hace en \`/pagos-admin.html\`.' : 'Para conciliar desde la web activá el módulo **Autenticación** (habilita \`/pagos-admin.html\`).'}${cfg.moduleIds.includes('mailer') ? ' Cada pago informado dispara un aviso por email (módulo Avisos por email).' : ''}`,
  ],
};
