// Simulador de financiación con backend real: una sección en la Home donde el visitante elige la
// línea de crédito, el monto y la cantidad de cuotas, y el SERVIDOR calcula la cuota estimada por
// sistema francés (con la tasa vigente de esa línea), registrando además cada simulación en la
// colección financequotes para medir la demanda de cada línea. Las líneas (nombre, tasa nominal
// anual, monto mínimo/máximo y plazos ofrecidos) viven en la colección financelines y se administran
// desde la web: con el módulo de autenticación activo, /financiacion-admin.html es un ABM solo-admin
// que también muestra cuántas simulaciones tuvo cada línea (la tasa se cambia ahí y rige al
// instante, sin tocar código). Sin auth, el simulador funciona igual con las líneas sembradas
// (editables a mano en data/financelines.json). La cuota sube con count-up de Anime.js (red de
// seguridad + respeta "prefers-reduced-motion"). Es la pieza de "¿cuánto pagarías por mes?" de
// bancos, concesionarias, inmobiliarias y comercios con financiación propia, que faltaba con backend
// de verdad: distinto de "estimator" (calculadora de presupuesto front-only) y de "shipping"
// (cotizador de envío). El resultado es una simulación orientativa, no una oferta de crédito.

// Líneas de ejemplo (se siembran la primera vez; el negocio las edita desde el ABM).
const SEMILLA = [
  { name: 'Préstamo personal', tna: 75, minAmount: 100000, maxAmount: 5000000, terms: [3, 6, 12, 18, 24], published: true },
  { name: 'Crédito prendario', tna: 45, minAmount: 1000000, maxAmount: 30000000, terms: [12, 24, 36, 48], published: true },
  { name: 'Financiación de la tienda', tna: 30, minAmount: 50000, maxAmount: 2000000, terms: [3, 6, 12], published: true },
];

module.exports = {
  id: 'simulador', type: 'functional', name: 'Simulador de financiación',
  description: 'Simulador de cuotas con backend: el visitante elige línea, monto y plazo y el servidor calcula la cuota estimada por sistema francés con la tasa vigente, registrando cada simulación para medir demanda. Las líneas (tasa, montos, plazos) se administran desde la web: con auth activo, ABM solo-admin en /financiacion-admin.html con el conteo de simulaciones por línea. Cuota animada con count-up de Anime.js. Ideal para concesionarias, inmobiliarias y comercios con financiación.',
  usesAnime: true,
  mounts: [{ route: '/api/financing', file: 'routes/simulador.js' }],
  collections: ['financelines', 'financequotes'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Financiación', href: '/financiacion-admin.html', id: 'nav-fin-admin' }] : [],
  html: () => `  <section id="simulador">
    <div class="container" style="max-width:640px">
      <h2>Simulá tu financiación</h2>
      <p class="section-sub">Elegí la línea, el monto y en cuántas cuotas: te mostramos al instante cuánto pagarías por mes.</p>
      <form id="fs-form" class="card">
        <label for="fs-linea">Línea de financiación</label>
        <select id="fs-linea" required></select>
        <p class="fs-rango muted" id="fs-rango" hidden></p>
        <div class="grid cols-2" style="gap:14px">
          <div><label for="fs-monto">Monto ($)</label><input type="number" id="fs-monto" min="0" step="1000" required placeholder="Ej: 500000"></div>
          <div><label for="fs-plazo">Cuotas</label><select id="fs-plazo" required></select></div>
        </div>
        <button class="btn" type="submit" style="margin-top:14px">Calcular cuota</button>
      </form>
      <div id="fs-result" hidden>
        <p class="fs-lead">Pagarías por mes</p>
        <p class="fs-cuota" id="fs-cuota">$0</p>
        <p class="fs-det" id="fs-det"></p>
        <p class="fs-legal">Simulación orientativa sujeta a aprobación crediticia. No constituye una oferta.</p>
      </div>
      <noscript><p class="muted">Activá JavaScript para simular tu financiación.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    .fs-rango{font-size:.85rem;margin:4px 0 0}
    #fs-result{margin-top:16px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px 22px;text-align:center}
    .fs-lead{margin:0;color:var(--muted);font-size:.9rem}
    .fs-cuota{margin:4px 0;font-size:2.2rem;font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums}
    .fs-det{margin:0;color:var(--muted);font-size:.92rem}
    .fs-legal{margin:12px 0 0;color:var(--muted);font-size:.75rem}
    .fs-b{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--line)}
    .fs-b.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
  </style>`,
  files: (cfg) => ({
    'routes/simulador.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Siembra líneas de ejemplo la primera vez para que el simulador funcione desde el arranque
db.seedIfEmpty('financelines', ${JSON.stringify(SEMILLA, null, 2)});

// Normaliza la lista de plazos (meses enteros entre 1 y 360, sin repetidos, ordenados)
function limpiarPlazos(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 360))].sort((a, b) => a - b);
}

// Cuota por sistema francés: interés mensual sobre saldo, cuota fija.
// Con tasa 0 la cuota es el monto dividido en partes iguales.
function cuotaFrancesa(monto, tna, meses) {
  const i = tna / 100 / 12;
  if (i === 0) return monto / meses;
  return monto * i / (1 - Math.pow(1 + i, -meses));
}

// Vista pública de una línea (para armar el formulario del simulador)
const publico = (l) => ({ id: l.id, name: l.name, tna: l.tna, minAmount: l.minAmount, maxAmount: l.maxAmount, terms: l.terms || [] });

// GET /api/financing/lines — líneas publicadas (público)
router.get('/lines', async (req, res) => {
  res.json((await db.all('financelines')).filter(l => l.published !== false).map(publico));
});

// POST /api/financing/quote — calcula la cuota en el servidor y registra la simulación (público)
router.post('/quote', async (req, res) => {
  const l = await db.get('financelines', String((req.body && req.body.line) || ''));
  if (!l || l.published === false) return res.status(404).json({ error: 'Línea de financiación inexistente' });
  const amount = Number(req.body.amount);
  const months = Number(req.body.months);
  if (!num(amount, l.minAmount, l.maxAmount)) return res.status(422).json({ error: 'El monto para esta línea va de ' + l.minAmount + ' a ' + l.maxAmount });
  if (!(l.terms || []).includes(months)) return res.status(422).json({ error: 'Elegí un plazo válido para esta línea' });
  const installment = Math.round(cuotaFrancesa(amount, l.tna, months));
  // Se registra cada simulación para medir la demanda de cada línea (sin datos personales)
  await db.insert('financequotes', { lineId: l.id, lineName: l.name, amount, months, installment });
  res.json({ line: l.name, amount, months, tna: l.tna, installment, total: installment * months });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/financing/admin/all — todas las líneas con su conteo de simulaciones (solo admin)
router.get('/admin/all', requireAdmin, async (req, res) => {
  const rows = await db.all('financelines');
  const quotes = await db.all('financequotes');
  res.json(rows.map(l => ({ ...l, quotes: quotes.filter(q => q.lineId === l.id).length })));
});

// Valida el cuerpo de una línea (alta y edición comparten reglas)
function validarLinea(body) {
  return check(body, {
    name: (v) => str(v, 2, 80),
    tna: (v) => num(v, 0, 500),
    minAmount: (v) => num(v, 0, 1000000000),
    maxAmount: (v) => num(v, 0, 10000000000),
  });
}

// POST /api/financing/admin — crea una línea (solo admin)
router.post('/admin', requireAdmin, async (req, res) => {
  const { ok, errors } = validarLinea(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  if (req.body.maxAmount < req.body.minAmount) return res.status(422).json({ error: 'El monto máximo no puede ser menor al mínimo' });
  const terms = limpiarPlazos(req.body.terms);
  if (!terms.length) return res.status(422).json({ error: 'Indicá al menos un plazo en meses (ej: 3, 6, 12)' });
  const row = await db.insert('financelines', {
    name: req.body.name.trim(),
    tna: req.body.tna,
    minAmount: Math.round(req.body.minAmount),
    maxAmount: Math.round(req.body.maxAmount),
    terms,
    published: req.body.published !== false,
  });
  res.status(201).json(row);
});

// PATCH /api/financing/admin/:id — edita una línea o cambia su publicación (solo admin)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.name !== undefined) { if (!str(req.body.name, 2, 80)) return res.status(422).json({ error: 'Nombre inválido' }); patch.name = req.body.name.trim(); }
  if (req.body.tna !== undefined) { if (!num(req.body.tna, 0, 500)) return res.status(422).json({ error: 'Tasa inválida (TNA de 0 a 500)' }); patch.tna = req.body.tna; }
  if (req.body.minAmount !== undefined) { if (!num(req.body.minAmount, 0, 1000000000)) return res.status(422).json({ error: 'Monto mínimo inválido' }); patch.minAmount = Math.round(req.body.minAmount); }
  if (req.body.maxAmount !== undefined) { if (!num(req.body.maxAmount, 0, 10000000000)) return res.status(422).json({ error: 'Monto máximo inválido' }); patch.maxAmount = Math.round(req.body.maxAmount); }
  if (req.body.terms !== undefined) {
    const terms = limpiarPlazos(req.body.terms);
    if (!terms.length) return res.status(422).json({ error: 'Indicá al menos un plazo en meses' });
    patch.terms = terms;
  }
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  const row = await db.update('financelines', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Línea inexistente' });
  res.json(row);
});

// DELETE /api/financing/admin/:id — borra una línea (sus simulaciones quedan para estadística) (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const l = await db.get('financelines', req.params.id);
  if (!l) return res.status(404).json({ error: 'Línea inexistente' });
  await db.remove('financelines', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de líneas (tasas, montos, plazos) requiere el módulo de autenticación: activalo en el
// Builder para habilitar /financiacion-admin.html. Sin él, el simulador usa las líneas sembradas y
// podés editarlas a mano en data/financelines.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'financiacion-admin': {
      title: 'Líneas de financiación',
      html: `  <section>
    <div class="container">
      <h2>Líneas de financiación</h2>
      <p class="section-sub">Administrá las líneas del simulador: la tasa, los montos y los plazos que cambies acá rigen al instante. Solo visible para administradores.</p>
      <form id="fsa-form" class="card" style="max-width:680px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Nombre de la línea</label><input name="name" required minlength="2" maxlength="80" placeholder="Ej: Préstamo personal"></div>
          <div><label>Tasa nominal anual (%)</label><input name="tna" type="number" min="0" max="500" step="0.1" required placeholder="75"></div>
        </div>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Monto mínimo ($)</label><input name="minAmount" type="number" min="0" step="1000" required placeholder="100000"></div>
          <div><label>Monto máximo ($)</label><input name="maxAmount" type="number" min="0" step="1000" required placeholder="5000000"></div>
        </div>
        <label>Plazos en meses (separados por coma)</label>
        <input name="terms" required placeholder="3, 6, 12, 18, 24">
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:12px"><input type="checkbox" name="published" checked style="width:auto"> Publicada (visible en el simulador)</label>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn" type="submit" id="fsa-save">Guardar línea</button>
          <button class="btn ghost" type="button" id="fsa-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="fsa-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo simulador de financiación: sección pública en la Home (línea + monto + cuotas → cuota
   calculada en el servidor con count-up de Anime.js) y, con auth activo, el ABM de líneas en
   /financiacion-admin.html. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEMO_LINEAS = [
    { id: 'd1', name: 'Préstamo personal', tna: 75, minAmount: 100000, maxAmount: 5000000, terms: [3, 6, 12, 18, 24] },
    { id: 'd2', name: 'Financiación de la tienda', tna: 30, minAmount: 50000, maxAmount: 2000000, terms: [3, 6, 12] },
  ];

  // Count-up de un importe; red de seguridad si el loop está pausado (pestaña oculta)
  function contarPlata(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = App.money(hasta); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 700, ease: 'outCubic', onUpdate: function () { el.textContent = App.money(Math.round(st.v)); } });
    setTimeout(function () { el.textContent = App.money(hasta); }, 900);
  }

  // ---- Sección pública (Home) ----
  var form = document.getElementById('fs-form');
  if (form) {
    var selLinea = document.getElementById('fs-linea');
    var selPlazo = document.getElementById('fs-plazo');
    var inMonto = document.getElementById('fs-monto');
    var rango = document.getElementById('fs-rango');
    var result = document.getElementById('fs-result');
    var lineas = [];

    function lineaActual() { return lineas.filter(function (l) { return l.id === selLinea.value; })[0]; }

    function refrescarLinea() {
      var l = lineaActual();
      if (!l) { rango.hidden = true; selPlazo.innerHTML = ''; return; }
      rango.hidden = false;
      rango.textContent = 'Monto de ' + App.money(l.minAmount) + ' a ' + App.money(l.maxAmount) + ' · TNA ' + l.tna + '%';
      inMonto.min = l.minAmount; inMonto.max = l.maxAmount;
      selPlazo.innerHTML = l.terms.map(function (m) { return '<option value="' + m + '">' + m + (m === 1 ? ' cuota' : ' cuotas') + '</option>'; }).join('');
    }

    function pintarLineas(rows) {
      lineas = rows;
      if (!lineas.length) { form.innerHTML = '<p class="muted">Todavía no hay líneas de financiación publicadas.</p>'; return; }
      selLinea.innerHTML = lineas.map(function (l) { return '<option value="' + App.esc(l.id) + '">' + App.esc(l.name) + '</option>'; }).join('');
      refrescarLinea();
    }
    selLinea.addEventListener('change', function () { refrescarLinea(); result.hidden = true; });

    function mostrar(r) {
      result.hidden = false;
      contarPlata(document.getElementById('fs-cuota'), r.installment);
      document.getElementById('fs-det').textContent = r.months + ' cuotas fijas de ' + App.money(r.installment) + ' · Total ' + App.money(r.total) + ' · TNA ' + r.tna + '% · ' + r.line;
      var anime = window.anime;
      if (anime && anime.animate && !reduce) anime.animate(result, { opacity: [0, 1], translateY: [10, 0], duration: 400, ease: 'outCubic' });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var l = lineaActual();
      if (!l) return;
      var datos = { line: l.id, amount: Number(inMonto.value), months: Number(selPlazo.value) };
      if (window.__PREVIEW__) {
        // Espejo del cálculo del servidor, solo para que la vista previa muestre algo razonable
        var i = l.tna / 100 / 12;
        var cuota = i === 0 ? datos.amount / datos.months : datos.amount * i / (1 - Math.pow(1 + i, -datos.months));
        mostrar({ line: l.name, amount: datos.amount, months: datos.months, tna: l.tna, installment: Math.round(cuota), total: Math.round(cuota) * datos.months });
        return;
      }
      try {
        mostrar(await App.api('/api/financing/quote', { method: 'POST', body: datos }));
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (window.__PREVIEW__) { pintarLineas(DEMO_LINEAS); }
    else { App.api('/api/financing/lines').then(pintarLineas).catch(function () { form.innerHTML = '<p class="muted">No se pudo cargar el simulador.</p>'; }); }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM /financiacion-admin.html ----
  var adminBox = document.getElementById('fsa-admin');
  var formA = document.getElementById('fsa-form');
  if (adminBox && formA) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todas = [];
    var idInput = formA.querySelector('[name="id"]');
    var cancelBtn = document.getElementById('fsa-cancel');
    var saveBtn = document.getElementById('fsa-save');

    function pintar() {
      adminBox.innerHTML = App.table(todas, [
        { key: 'name', label: 'Línea' },
        { label: 'TNA', render: function (r) { return r.tna + '%'; } },
        { label: 'Montos', render: function (r) { return App.money(r.minAmount) + ' – ' + App.money(r.maxAmount); } },
        { label: 'Plazos', render: function (r) { return (r.terms || []).join(', ') + ' meses'; } },
        { label: 'Simulaciones', render: function (r) { return String(r.quotes || 0); } },
        { label: 'Estado', render: function (r) { return r.published !== false ? '<span class="fs-b on">Publicada</span>' : '<span class="fs-b">Oculta</span>'; } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-pub="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.published !== false ? 'Ocultar' : 'Publicar') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      adminBox.querySelectorAll('[data-pub]').forEach(function (b) { b.addEventListener('click', function () { togglePub(b.getAttribute('data-pub')); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
    }

    function resetForm() {
      formA.reset(); idInput.value = '';
      formA.querySelector('[name="published"]').checked = true;
      saveBtn.textContent = 'Guardar línea';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var l = todas.filter(function (r) { return r.id === id; })[0];
      if (!l) return;
      idInput.value = l.id;
      formA.querySelector('[name="name"]').value = l.name;
      formA.querySelector('[name="tna"]').value = l.tna;
      formA.querySelector('[name="minAmount"]').value = l.minAmount;
      formA.querySelector('[name="maxAmount"]').value = l.maxAmount;
      formA.querySelector('[name="terms"]').value = (l.terms || []).join(', ');
      formA.querySelector('[name="published"]').checked = l.published !== false;
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formA.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function togglePub(id) {
      var l = todas.filter(function (r) { return r.id === id; })[0];
      if (!l) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: cambiaría la publicación'); return; }
      try {
        var row = await App.api('/api/financing/admin/' + id, { method: 'PATCH', body: { published: l.published === false } });
        l.published = row.published; pintar();
        App.toast(l.published ? 'Línea publicada' : 'Línea oculta');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar esta línea de financiación?')) return;
      try {
        await App.api('/api/financing/admin/' + id, { method: 'DELETE' });
        todas = todas.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Línea borrada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formA.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        name: formA.querySelector('[name="name"]').value,
        tna: Number(formA.querySelector('[name="tna"]').value),
        minAmount: Number(formA.querySelector('[name="minAmount"]').value),
        maxAmount: Number(formA.querySelector('[name="maxAmount"]').value),
        terms: formA.querySelector('[name="terms"]').value.split(',').map(function (s) { return Number(s.trim()); }),
        published: formA.querySelector('[name="published"]').checked,
      };
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'crearía') + ' la línea'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/financing/admin/' + editando, { method: 'PATCH', body: datos });
          todas = todas.map(function (r) { return r.id === editando ? { ...upd, quotes: r.quotes } : r; });
          App.toast('Cambios guardados');
        } else {
          var nueva = await App.api('/api/financing/admin', { method: 'POST', body: datos });
          todas.push({ ...nueva, quotes: 0 });
          App.toast('Línea creada');
        }
        resetForm();
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function listo(rows) { todas = rows; pintar(); }
    if (window.__PREVIEW__) {
      listo([
        { id: 'd1', name: 'Préstamo personal', tna: 75, minAmount: 100000, maxAmount: 5000000, terms: [3, 6, 12], published: true, quotes: 12 },
        { id: 'd2', name: 'Crédito prendario', tna: 45, minAmount: 1000000, maxAmount: 30000000, terms: [12, 24], published: false, quotes: 0 },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/financing/admin/all').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navF = document.getElementById('nav-fin-admin');
    if (navF && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navF.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Simulador de financiación**: las líneas (nombre, TNA, monto mínimo/máximo y plazos) viven en la colección \`financelines\` y cada simulación se registra en \`financequotes\` (sin datos personales) para medir la demanda. El visitante simula desde la Home y el servidor calcula la cuota por sistema francés con la tasa vigente. Se siembran tres líneas de ejemplo. ${cfg.moduleIds.includes('auth') ? 'Los administradores editan tasas, montos y plazos en \`/financiacion-admin.html\` (rigen al instante) y ven cuántas simulaciones tuvo cada línea.' : 'Para editar las líneas desde la web activá el módulo **Autenticación** (habilita \`/financiacion-admin.html\`); sin él, editá \`data/financelines.json\` a mano.'} El resultado que ve el visitante es una simulación orientativa y así se aclara en pantalla: no constituye una oferta de crédito.`,
  ],
};
