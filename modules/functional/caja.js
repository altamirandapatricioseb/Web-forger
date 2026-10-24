// Caja diaria del negocio con backend real: el panel solo-admin /caja-admin.html registra cada
// movimiento de plata del día (ingreso o egreso, con concepto, importe y medio de pago:
// efectivo / transferencia / tarjeta / otro) en la colección cashmoves, muestra los totales del
// día calculados SIEMPRE en el servidor (ingresos, egresos, saldo y desglose por medio, con
// count-up animado) y permite CERRAR LA CAJA del día: el cierre consolida los totales en la
// colección cashclosures y a partir de ahí ese día queda sellado — agregar o borrar movimientos
// de un día cerrado responde 409. Se puede navegar cualquier fecha (para cargar movimientos
// olvidados de días anteriores no cerrados) y el historial de cierres queda a mano con su CSV.
// Animado con Anime.js + red de seguridad. Requiere Autenticación (todo el módulo es solo-admin:
// 401 sin token). Distinto de "pos" (punto de venta que cobra productos) y "stats" (métricas de
// visitas): acá se lleva la PLATA del día — la planilla de caja que todo comercio lleva a mano.

module.exports = {
  id: 'caja', type: 'functional', name: 'Caja diaria',
  description: 'Panel solo-admin /caja-admin.html para llevar la caja del negocio: ingresos y egresos del día con concepto, importe y medio de pago (efectivo/transferencia/tarjeta/otro), totales y saldo calculados en el servidor con count-up animado, cierre de caja que sella el día (409 al tocar un día cerrado) e historial de cierres con CSV. Animado con Anime.js. Requiere Autenticación.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/caja', file: 'routes/caja.js' }],
  collections: ['cashmoves', 'cashclosures'],
  nav: () => [{ label: 'Caja (admin)', href: '/caja-admin.html', id: 'nav-caja-admin' }],
  head: () => `  <style>
    .cj-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .cj-kpis .card{text-align:center}
    .cj-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .cj-kpis .neg strong{color:#c0392b}
    .cj-cerrada{border-left:3px solid var(--accent);padding:10px 14px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0;margin-bottom:22px;font-size:.92rem}
    .cj-tipo{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px}
    .cj-tipo.ingreso{background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent)}
    .cj-tipo.egreso{background:color-mix(in srgb,#c0392b 12%,var(--surface));color:#c0392b}
    .cj-medios{font-size:.85rem;color:var(--muted);margin:0 0 18px}
  </style>`,
  files: () => ({
    'routes/caja.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num, oneOf } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

const TIPOS = ['ingreso', 'egreso'];
const MEDIOS = ['efectivo', 'transferencia', 'tarjeta', 'otro'];
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;
const hoy = () => new Date().toISOString().slice(0, 10);

// Normaliza la fecha pedida (default: hoy). Devuelve null si el formato es inválido.
function fechaDe(q) {
  const d = String(q || '').trim() || hoy();
  return FECHA.test(d) ? d : null;
}

// Totales de un conjunto de movimientos, SIEMPRE calculados en el servidor
function totales(moves) {
  const t = { ingresos: 0, egresos: 0, saldo: 0, porMedio: {} };
  for (const m of moves) {
    const signo = m.kind === 'egreso' ? -1 : 1;
    if (signo > 0) t.ingresos += m.amount; else t.egresos += m.amount;
    t.porMedio[m.method] = (t.porMedio[m.method] || 0) + signo * m.amount;
  }
  t.saldo = t.ingresos - t.egresos;
  return t;
}

// ¿La caja de esta fecha ya está cerrada?
const cierreDe = async (date) => (await db.find('cashclosures', c => c.date === date))[0];

// GET /api/caja/admin/dia?date= — movimientos y totales del día (solo admin; default hoy)
router.get('/admin/dia', requireAdmin, async (req, res) => {
  const date = fechaDe(req.query.date);
  if (!date) return res.status(422).json({ error: 'Fecha inválida (formato AAAA-MM-DD)' });
  const moves = (await db.find('cashmoves', m => m.date === date)).reverse();
  const cierre = await cierreDe(date);
  res.json({ date, closed: Boolean(cierre), closure: cierre || null, moves, totals: totales(moves) });
});

// POST /api/caja/admin — registra un movimiento (solo admin; 409 si el día ya cerró)
router.post('/admin', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, {
    kind: (v) => oneOf(v, TIPOS),
    concept: (v) => str(v, 2, 120),
    amount: (v) => num(v, 0.01, 1000000000),
    method: (v) => oneOf(v, MEDIOS),
  });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const date = fechaDe(req.body.date);
  if (!date) return res.status(422).json({ error: 'Fecha inválida (formato AAAA-MM-DD)' });
  if (date > hoy()) return res.status(422).json({ error: 'No se pueden cargar movimientos a futuro' });
  if (await cierreDe(date)) return res.status(409).json({ error: 'La caja del ' + date + ' ya está cerrada: no admite más movimientos' });
  const row = await db.insert('cashmoves', {
    date,
    kind: req.body.kind,
    concept: req.body.concept.trim(),
    amount: req.body.amount,
    method: req.body.method,
  });
  res.status(201).json(row);
});

// DELETE /api/caja/admin/:id — borra un movimiento (solo admin; 409 si su día ya cerró)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const m = await db.get('cashmoves', req.params.id);
  if (!m) return res.status(404).json({ error: 'Movimiento inexistente' });
  if (await cierreDe(m.date)) return res.status(409).json({ error: 'La caja del ' + m.date + ' ya está cerrada: sus movimientos no se tocan' });
  await db.remove('cashmoves', req.params.id);
  res.json({ ok: true });
});

// POST /api/caja/admin/cerrar — cierra la caja del día: consolida totales y sella los movimientos (solo admin)
router.post('/admin/cerrar', requireAdmin, async (req, res) => {
  const date = fechaDe(req.body && req.body.date);
  if (!date) return res.status(422).json({ error: 'Fecha inválida (formato AAAA-MM-DD)' });
  if (await cierreDe(date)) return res.status(409).json({ error: 'La caja del ' + date + ' ya está cerrada' });
  const moves = await db.find('cashmoves', m => m.date === date);
  if (!moves.length) return res.status(422).json({ error: 'No hay movimientos que cerrar en esa fecha' });
  const t = totales(moves);
  const row = await db.insert('cashclosures', {
    date,
    ingresos: t.ingresos,
    egresos: t.egresos,
    saldo: t.saldo,
    porMedio: t.porMedio,
    moves: moves.length,
    note: typeof (req.body && req.body.note) === 'string' ? req.body.note.trim().slice(0, 200) : '',
  });
  res.status(201).json(row);
});

// GET /api/caja/admin/cierres — historial de cierres, más recientes primero (solo admin)
router.get('/admin/cierres', requireAdmin, async (req, res) => {
  res.json((await db.all('cashclosures')).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 120));
});

module.exports = router;
`,
  }),
  pages: () => ({
    'caja-admin': {
      title: 'Caja diaria',
      html: `  <section>
    <div class="container" style="max-width:960px">
      <h2>Caja diaria</h2>
      <p class="section-sub">Registrá cada ingreso y egreso del día, mirá el saldo al instante y cerrá la caja para dejar el día sellado. Solo visible para administradores.</p>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:18px">
        <label style="margin:0">Día:</label>
        <input type="date" id="cj-fecha" style="width:auto">
        <button class="btn ghost" type="button" id="cj-hoy">Hoy</button>
      </div>
      <div class="cj-cerrada" id="cj-estado" hidden></div>
      <div class="cj-kpis" id="cj-kpis"></div>
      <p class="cj-medios" id="cj-medios" hidden></p>
      <form id="cj-form" class="card" style="max-width:680px;margin-bottom:22px">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Tipo</label><select name="kind"><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></div>
          <div><label>Medio</label><select name="method"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></div>
        </div>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Concepto</label><input name="concept" required minlength="2" maxlength="120" placeholder="Ej: venta mostrador, pago proveedor…"></div>
          <div><label>Importe</label><input name="amount" type="number" min="0.01" step="0.01" required placeholder="12500"></div>
        </div>
        <button class="btn" type="submit" style="margin-top:14px">Registrar movimiento</button>
      </form>
      <div id="cj-list"><p class="muted">Cargando…</p></div>
      <div style="display:flex;gap:8px;margin:18px 0 34px;flex-wrap:wrap">
        <button class="btn" type="button" id="cj-cerrar">Cerrar caja del día</button>
        <button class="btn ghost" type="button" id="cj-csv">Descargar CSV del día</button>
      </div>
      <h3>Historial de cierres</h3>
      <div id="cj-cierres"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo caja diaria: panel solo-admin con movimientos del día, totales del servidor con
   count-up, cierre de caja que sella el día e historial. Animado con Anime.js + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  // Oculta el link admin de la navbar para quien no es admin (en TODAS las páginas)
  var navCj = document.getElementById('nav-caja-admin');
  if (navCj && (!me || me.role !== 'admin') && !window.__PREVIEW__) navCj.style.display = 'none';
  var kpis = document.getElementById('cj-kpis');
  if (!kpis) return;
  var fechaInput = document.getElementById('cj-fecha');
  var estadoBox = document.getElementById('cj-estado');
  var mediosBox = document.getElementById('cj-medios');
  var listBox = document.getElementById('cj-list');
  var cierresBox = document.getElementById('cj-cierres');
  var formCj = document.getElementById('cj-form');
  var cerrarBtn = document.getElementById('cj-cerrar');
  var dia = { moves: [], totals: { ingresos: 0, egresos: 0, saldo: 0, porMedio: {} }, closed: false };
  var MEDIO = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };

  fechaInput.value = new Date().toISOString().slice(0, 10);

  function contarPlata(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = App.money(hasta); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = App.money(Math.round(st.v)); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = App.money(hasta); }, 800);
  }

  function pintar() {
    var t = dia.totals;
    estadoBox.hidden = !dia.closed;
    if (dia.closed) estadoBox.innerHTML = '<strong>Caja cerrada.</strong> Este día quedó sellado' + (dia.closure && dia.closure.note ? ' — nota: ' + App.esc(dia.closure.note) : '') + ': sus movimientos ya no se pueden tocar.';
    formCj.querySelectorAll('input,select,button').forEach(function (el) { el.disabled = dia.closed; });
    cerrarBtn.disabled = dia.closed || !dia.moves.length;
    kpis.innerHTML = '<div class="card"><strong id="cj-k-ing">$0</strong><span class="muted">ingresos</span></div>' +
      '<div class="card' + (t.egresos ? ' neg' : '') + '"><strong id="cj-k-egr">$0</strong><span class="muted">egresos</span></div>' +
      '<div class="card"><strong id="cj-k-sal">$0</strong><span class="muted">saldo del día</span></div>' +
      '<div class="card"><strong id="cj-k-mov">0</strong><span class="muted">movimientos</span></div>';
    contarPlata(document.getElementById('cj-k-ing'), t.ingresos);
    contarPlata(document.getElementById('cj-k-egr'), t.egresos);
    contarPlata(document.getElementById('cj-k-sal'), t.saldo);
    document.getElementById('cj-k-mov').textContent = String(dia.moves.length);
    var medios = Object.keys(t.porMedio);
    mediosBox.hidden = !medios.length;
    mediosBox.innerHTML = medios.length ? 'Por medio: ' + medios.map(function (m) { return (MEDIO[m] || m) + ' <strong>' + App.money(t.porMedio[m]) + '</strong>'; }).join(' · ') : '';
    listBox.innerHTML = App.table(dia.moves, [
      { label: 'Tipo', render: function (r) { return '<span class="cj-tipo ' + r.kind + '">' + (r.kind === 'ingreso' ? 'Ingreso' : 'Egreso') + '</span>'; } },
      { key: 'concept', label: 'Concepto' },
      { label: 'Medio', render: function (r) { return MEDIO[r.method] || r.method; } },
      { label: 'Importe', render: function (r) { return (r.kind === 'egreso' ? '-' : '') + App.money(r.amount); } },
      { label: 'Acciones', render: function (r) {
        return dia.closed ? '—' : '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
      } },
    ]);
    listBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
  }

  function pintarCierres(rows) {
    cierresBox.innerHTML = App.table(rows, [
      { key: 'date', label: 'Día' },
      { label: 'Ingresos', render: function (r) { return App.money(r.ingresos); } },
      { label: 'Egresos', render: function (r) { return App.money(r.egresos); } },
      { label: 'Saldo', render: function (r) { return '<strong>' + App.money(r.saldo) + '</strong>'; } },
      { label: 'Movs.', render: function (r) { return String(r.moves || 0); } },
      { label: 'Nota', render: function (r) { return r.note ? App.esc(r.note) : '—'; } },
    ]);
  }

  function cargar() {
    App.api('/api/caja/admin/dia?date=' + fechaInput.value).then(function (d) { dia = d; pintar(); }).catch(function (err) { kpis.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    App.api('/api/caja/admin/cierres').then(pintarCierres).catch(function () {});
  }

  async function borrar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se borraría el movimiento'); return; }
    if (!confirm('¿Borrar este movimiento de la caja?')) return;
    try {
      await App.api('/api/caja/admin/' + id, { method: 'DELETE' });
      App.toast('Movimiento borrado');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  formCj.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: se registraría el movimiento'); return; }
    try {
      await App.api('/api/caja/admin', { method: 'POST', body: {
        date: fechaInput.value,
        kind: formCj.querySelector('[name="kind"]').value,
        concept: formCj.querySelector('[name="concept"]').value,
        amount: Number(formCj.querySelector('[name="amount"]').value),
        method: formCj.querySelector('[name="method"]').value,
      } });
      formCj.querySelector('[name="concept"]').value = '';
      formCj.querySelector('[name="amount"]').value = '';
      App.toast('Movimiento registrado');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  cerrarBtn.addEventListener('click', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: se cerraría la caja'); return; }
    var nota = prompt('Cerrar la caja del ' + fechaInput.value + ': el día queda sellado y no admite más movimientos. Nota del cierre (opcional):');
    if (nota === null) return;
    try {
      var r = await App.api('/api/caja/admin/cerrar', { method: 'POST', body: { date: fechaInput.value, note: nota } });
      App.toast('Caja cerrada con saldo ' + App.money(r.saldo));
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  document.getElementById('cj-hoy').addEventListener('click', function () {
    fechaInput.value = new Date().toISOString().slice(0, 10);
    if (!window.__PREVIEW__) cargar();
  });
  fechaInput.addEventListener('change', function () { if (!window.__PREVIEW__) cargar(); });

  var csvBtn = document.getElementById('cj-csv');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    var filas = [['fecha', 'tipo', 'concepto', 'medio', 'importe']].concat(dia.moves.map(function (r) { return [r.date, r.kind, r.concept, r.method, (r.kind === 'egreso' ? -r.amount : r.amount)]; }));
    var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'caja-' + fechaInput.value + '.csv';
    a.click();
  });

  if (window.__PREVIEW__) {
    dia = {
      closed: false,
      moves: [
        { id: 'd1', date: '2026-07-20', kind: 'ingreso', concept: 'Venta mostrador', amount: 25000, method: 'efectivo' },
        { id: 'd2', date: '2026-07-20', kind: 'egreso', concept: 'Pago proveedor', amount: 8000, method: 'transferencia' },
      ],
      totals: { ingresos: 25000, egresos: 8000, saldo: 17000, porMedio: { efectivo: 25000, transferencia: -8000 } },
    };
    pintar();
    pintarCierres([{ date: '2026-07-19', ingresos: 148000, egresos: 32000, saldo: 116000, moves: 14, note: '' }]);
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargar();
  }
})();`,
  readmeNotes: () => [
    `**Caja diaria**: los movimientos viven en la colección \`cashmoves\` y los cierres en \`cashclosures\`. Cada ingreso/egreso se registra con concepto, importe y medio de pago; los totales del día los calcula siempre el servidor. Al **cerrar la caja** el día queda sellado (no admite más movimientos ni borrados) y el cierre pasa al historial con su saldo y el desglose por medio. Todo el módulo es solo-admin (\`/caja-admin.html\`). Podés navegar a días anteriores no cerrados para cargar movimientos olvidados.`,
  ],
};
