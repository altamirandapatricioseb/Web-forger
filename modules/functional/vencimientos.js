// Vencimientos y pagos a realizar con backend real: la otra mitad de la plata que el catálogo no
// tenía. Ya sabía qué me deben a mí (cuenta corriente) y qué le compro a mis proveedores (compras),
// pero no sabía QUÉ TENGO QUE PAGAR YO y cuándo: el alquiler, la luz, el monotributo, el seguro, el
// contador. Eso hoy vive en la cabeza del dueño o en un papel pegado a la heladera, y es lo que se
// paga tarde con recargo. Acá cada obligación tiene fecha de vencimiento y estado, y el servidor
// decide qué está vencido con SU fecha (el reloj del navegador no es fuente de verdad). La pieza que
// lo hace útil de verdad es la RECURRENCIA: el alquiler no es un gasto de julio, es un gasto de
// todos los meses, así que al marcar pagada una obligación mensual el servidor genera sola la del
// mes siguiente — y sólo entonces, para que no se llene de filas futuras que nadie pidió. Un
// vencimiento pagado queda sellado (409 a cualquier edición): es un hecho, no un borrador. Con Caja
// diaria activa, pagar registra además el egreso del día respetando el cierre. Panel solo-admin
// /vencimientos.html con KPIs animados (Anime.js + red de seguridad), calendario del mes, filtros y
// CSV. Requiere Autenticación.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'vencimientos', type: 'functional', name: 'Vencimientos y pagos',
  description: 'Lo que el negocio TIENE QUE PAGAR, con backend real: alquiler, servicios, impuestos, seguros y cuotas con su fecha de vencimiento y su estado. El servidor marca lo vencido con su propia fecha y calcula los totales; las obligaciones mensuales se renuevan solas al marcarlas pagadas (genera la del mes siguiente en ese momento, no una fila futura por adelantado) y un vencimiento pagado queda sellado contra ediciones. Con Caja diaria activa, pagar registra además el egreso del día respetando el cierre. Panel solo-admin /vencimientos.html con KPIs animados (Anime.js), agenda del mes, filtros por estado y categoría, y CSV. Requiere Autenticación.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/vencimientos', file: 'routes/vencimientos.js' }],
  collections: ['duebills'],
  nav: () => [{ label: 'Vencimientos', href: '/vencimientos.html', id: 'nav-vencimientos' }],
  head: () => `  <style>
    .vc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .vc-kpis .card{text-align:center}
    .vc-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .vc-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .vc-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .vc-chip.pagado{background:#2e9e5b20;color:#1d6b3c}
    .vc-chip.vencido{background:#c0392b;color:#fff}
    .vc-chip.pronto{background:#c0392b18;color:#c0392b}
    .vc-chip.futuro{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .vc-chip.mensual{background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}
    .vc-total{text-align:right;font-size:1.1rem;font-weight:700;font-variant-numeric:tabular-nums;margin-top:12px}
  </style>`,
  pages: (cfg) => ({
    'vencimientos': {
      title: 'Vencimientos y pagos',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('clock', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Vencimientos y pagos</h2>
      <p class="section-sub">Lo que hay que pagar y cuándo. El servidor marca lo vencido con su propia fecha y renueva solas las obligaciones mensuales cuando las pagás.</p>
      <div id="vc-kpis" class="vc-kpis"></div>

      <div class="card" style="margin-bottom:26px">
        <h3>Nuevo vencimiento</h3>
        <form id="vc-form">
          <div class="grid cols-2">
            <div><label>Concepto</label><input name="concept" required maxlength="100" placeholder="Alquiler del local, luz, monotributo…"></div>
            <div>
              <label>Categoría</label>
              <select name="category">
                <option value="servicios">Servicios (luz, gas, internet)</option>
                <option value="alquiler">Alquiler</option>
                <option value="impuestos">Impuestos y tasas</option>
                <option value="sueldos">Sueldos y cargas</option>
                <option value="proveedores">Proveedores</option>
                <option value="financiero">Cuotas y préstamos</option>
                <option value="otros">Otros</option>
              </select>
            </div>
          </div>
          <div class="grid cols-3">
            <div><label>Importe</label><input name="amount" type="number" min="0.01" step="any" required></div>
            <div><label>Vence el</label><input name="dueDate" type="date" required></div>
            <div>
              <label>Se repite</label>
              <select name="recurrence">
                <option value="unica">Una sola vez</option>
                <option value="mensual">Todos los meses</option>
              </select>
            </div>
          </div>
          <label>Nota (opcional)</label><input name="note" maxlength="150" placeholder="Número de cliente, dónde se paga…">
          <div style="margin-top:16px"><button class="btn" type="submit">Agendar</button></div>
        </form>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
        <select id="vc-estado" style="width:auto;margin:0">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="vencido">Vencidos</option>
          <option value="pagado">Pagados</option>
        </select>
        <input type="month" id="vc-mes" style="width:auto;margin:0">
        <button class="btn ghost" type="button" id="vc-limpiar">Ver todos los meses</button>
        <button class="btn ghost" type="button" id="vc-csv">Descargar CSV</button>
      </div>
      <div id="vc-lista"><p class="muted">Cargando…</p></div>
      <p class="vc-total" id="vc-total"></p>${cfg.moduleIds.includes('caja') ? `
      <p class="muted" style="font-size:.85rem">Al marcar un vencimiento como pagado se registra también el egreso en la caja del día. Si la caja ya cerró, el pago se guarda igual y el sistema te avisa.</p>` : ''}
    </div>
  </section>`,
    },
  }),
  files: (cfg) => {
    const conCaja = cfg.moduleIds.includes('caja');
    return {
      'routes/vencimientos.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num, oneOf } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

const CATEGORIAS = ['servicios', 'alquiler', 'impuestos', 'sueldos', 'proveedores', 'financiero', 'otros'];
const RECURRENCIAS = ['unica', 'mensual'];
const MEDIOS = ['efectivo', 'transferencia', 'debito', 'credito', 'otro'];
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;
const MES = /^\\d{4}-\\d{2}$/;
const hoy = () => new Date().toISOString().slice(0, 10);
const enDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// Suma un mes calendario a una fecha, sin días fantasma: el 31 de enero + 1 mes es el 28/29 de
// febrero, no el 3 de marzo (que es lo que devolvería Date si se lo deja solo).
function mesSiguiente(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const anio = m === 12 ? a + 1 : a;
  const mes = m === 12 ? 1 : m + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const dia = Math.min(d, ultimo);
  return anio + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
}

// El estado real lo decide el servidor con SU fecha: "vencido" no se guarda, se calcula
function decorar(r) {
  if (r.status === 'pagado') return { ...r, estado: 'pagado', diasRestantes: null };
  const dias = Math.round((Date.parse(r.dueDate + 'T00:00:00Z') - Date.parse(hoy() + 'T00:00:00Z')) / 86400000);
  return { ...r, estado: r.dueDate < hoy() ? 'vencido' : 'pendiente', diasRestantes: dias };
}

// GET /api/vencimientos — la agenda (filtros ?estado=, ?mes=, ?categoria=)
router.get('/', requireAdmin, async (req, res) => {
  let rows = (await db.all('duebills')).map(decorar);
  if (req.query.estado) rows = rows.filter(r => r.estado === req.query.estado);
  if (MES.test(String(req.query.mes || ''))) rows = rows.filter(r => String(r.dueDate).slice(0, 7) === req.query.mes);
  if (req.query.categoria) rows = rows.filter(r => r.category === req.query.categoria);
  // Primero lo que urge: vencido arriba, después por fecha; lo pagado al final
  rows.sort((a, b) => (Number(a.estado === 'pagado') - Number(b.estado === 'pagado'))
    || String(a.dueDate).localeCompare(String(b.dueDate)));
  const aPagar = rows.filter(r => r.estado !== 'pagado').reduce((s, r) => s + (Number(r.amount) || 0), 0);
  res.json({ rows, aPagar: Math.round(aPagar * 100) / 100 });
});

// GET /api/vencimientos/resumen — KPIs calculados en el servidor
router.get('/resumen', requireAdmin, async (req, res) => {
  const rows = (await db.all('duebills')).map(decorar);
  const mes = hoy().slice(0, 7);
  const semana = enDias(7);
  const vencidos = rows.filter(r => r.estado === 'vencido');
  const pronto = rows.filter(r => r.estado === 'pendiente' && r.dueDate <= semana);
  const delMes = rows.filter(r => String(r.dueDate).slice(0, 7) === mes);
  res.json({
    vencidos: vencidos.length,
    montoVencido: Math.round(vencidos.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100,
    estaSemana: pronto.length,
    aPagarMes: Math.round(delMes.filter(r => r.estado !== 'pagado').reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100,
    pagadoMes: Math.round(rows.filter(r => r.status === 'pagado' && String(r.paidAt || '').slice(0, 7) === mes)
      .reduce((s, r) => s + (Number(r.paidAmount) || 0), 0) * 100) / 100,
  });
});

// POST /api/vencimientos — agenda una obligación
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, {
    concept: (v) => str(v, 2, 100),
    amount: (v) => num(Number(v), 0.01, 1000000000),
  });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  if (!FECHA.test(String(req.body.dueDate || ''))) return res.status(422).json({ error: 'Fecha de vencimiento inválida' });
  const row = await db.insert('duebills', {
    concept: String(req.body.concept).trim(),
    category: CATEGORIAS.includes(req.body.category) ? req.body.category : 'otros',
    amount: Math.round(Number(req.body.amount) * 100) / 100,
    dueDate: req.body.dueDate,
    recurrence: RECURRENCIAS.includes(req.body.recurrence) ? req.body.recurrence : 'unica',
    note: String(req.body.note || '').trim().slice(0, 150),
    status: 'pendiente',
    paidAt: '', paidAmount: 0, method: '',
    author: req.user.name,
  });
  res.status(201).json(decorar(row));
});

// PUT /api/vencimientos/:id — corrige una obligación todavía impaga
router.put('/:id', requireAdmin, async (req, res) => {
  const r = await db.get('duebills', req.params.id);
  if (!r) return res.status(404).json({ error: 'Ese vencimiento no existe' });
  // Un pago ya hecho es un hecho, no un borrador: no se reescribe
  if (r.status === 'pagado') return res.status(409).json({ error: 'Un vencimiento pagado no se edita: si el pago estuvo mal, borralo y cargalo de nuevo' });
  const patch = {};
  if (req.body.concept !== undefined) {
    if (!str(req.body.concept, 2, 100)) return res.status(422).json({ error: 'Concepto inválido' });
    patch.concept = String(req.body.concept).trim();
  }
  if (req.body.amount !== undefined) {
    if (!num(Number(req.body.amount), 0.01, 1000000000)) return res.status(422).json({ error: 'Importe inválido' });
    patch.amount = Math.round(Number(req.body.amount) * 100) / 100;
  }
  if (req.body.dueDate !== undefined) {
    if (!FECHA.test(String(req.body.dueDate))) return res.status(422).json({ error: 'Fecha inválida' });
    patch.dueDate = req.body.dueDate;
  }
  if (req.body.category !== undefined) patch.category = CATEGORIAS.includes(req.body.category) ? req.body.category : 'otros';
  if (req.body.recurrence !== undefined) patch.recurrence = RECURRENCIAS.includes(req.body.recurrence) ? req.body.recurrence : 'unica';
  if (req.body.note !== undefined) patch.note = String(req.body.note).trim().slice(0, 150);
  res.json(decorar(await db.update('duebills', r.id, patch)));
});

// POST /api/vencimientos/:id/pagar — marca pagado. Si es mensual, genera el del mes que viene:
// recién en este momento, no por adelantado, para no llenar la agenda de filas que nadie pidió.${conCaja ? `
// Con Caja diaria activa, además registra el egreso del día (si la caja no está cerrada).` : ''}
router.post('/:id/pagar', requireAdmin, async (req, res) => {
  const r = await db.get('duebills', req.params.id);
  if (!r) return res.status(404).json({ error: 'Ese vencimiento no existe' });
  if (r.status === 'pagado') return res.status(409).json({ error: 'Ese vencimiento ya figura pagado' });
  const importe = req.body.paidAmount !== undefined && req.body.paidAmount !== ''
    ? Number(req.body.paidAmount) : Number(r.amount);
  if (!num(importe, 0.01, 1000000000)) return res.status(422).json({ error: 'Importe pagado inválido' });
  const fecha = FECHA.test(String(req.body.paidDate || '')) ? req.body.paidDate : hoy();
  if (fecha > hoy()) return res.status(422).json({ error: 'No se pueden registrar pagos a futuro' });
  const method = oneOf(req.body.method, MEDIOS) ? req.body.method : 'transferencia';
  const pagado = await db.update('duebills', r.id, {
    status: 'pagado',
    paidAt: fecha,
    paidAmount: Math.round(importe * 100) / 100,
    method,
    paidBy: req.user.name,
  });

  let siguiente = null;
  if (r.recurrence === 'mensual') {
    siguiente = await db.insert('duebills', {
      concept: r.concept, category: r.category, amount: r.amount,
      dueDate: mesSiguiente(r.dueDate),
      recurrence: 'mensual',
      note: r.note, status: 'pendiente',
      paidAt: '', paidAmount: 0, method: '',
      author: req.user.name,
    });
  }
${conCaja ? `  // Espejo en la caja diaria: lo que se paga es plata que sale del negocio
  let enCaja = false;
  const cerrada = (await db.find('cashclosures', c => c.date === fecha)).length > 0;
  if (!cerrada) {
    await db.insert('cashmoves', {
      date: fecha, kind: 'egreso',
      concept: 'Vencimiento: ' + r.concept,
      amount: pagado.paidAmount,
      method: method === 'debito' || method === 'credito' ? 'tarjeta' : (method === 'efectivo' ? 'efectivo' : 'transferencia'),
    });
    enCaja = true;
  }
  res.json({ ...decorar(pagado), siguiente: siguiente ? decorar(siguiente) : null, enCaja, cajaCerrada: !enCaja });
});
` : `  res.json({ ...decorar(pagado), siguiente: siguiente ? decorar(siguiente) : null });
});
`}
// POST /api/vencimientos/:id/despagar — deshace un pago mal cargado (no toca la caja:
// si el egreso ya entró, se corrige en la caja, que es donde vive ese dato)
router.post('/:id/despagar', requireAdmin, async (req, res) => {
  const r = await db.get('duebills', req.params.id);
  if (!r) return res.status(404).json({ error: 'Ese vencimiento no existe' });
  if (r.status !== 'pagado') return res.status(409).json({ error: 'Ese vencimiento no figura pagado' });
  const row = await db.update('duebills', r.id, { status: 'pendiente', paidAt: '', paidAmount: 0, method: '', paidBy: '' });
  res.json(decorar(row));
});

// DELETE /api/vencimientos/:id — saca la obligación de la agenda
router.delete('/:id', requireAdmin, async (req, res) => {
  const r = await db.get('duebills', req.params.id);
  if (!r) return res.status(404).json({ error: 'Ese vencimiento no existe' });
  await db.remove('duebills', r.id);
  res.json({ ok: true });
});

module.exports = router;
`,
    };
  },
  clientJs: () => `/* Módulo vencimientos: agenda de lo que hay que pagar, marcado de pagos con renovación mensual
   automática y CSV. KPIs con count-up (Anime.js + red de seguridad). Solo admin.
   En la vista previa del Builder simula la API. */
(function () {
  var box = document.getElementById('vc-lista');
  if (!box) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
    box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
    return;
  }
  var fecha = function (d) { try { return new Date(d + 'T12:00:00').toLocaleDateString('es-AR'); } catch (e) { return d; } };
  var CATS = { servicios: 'Servicios', alquiler: 'Alquiler', impuestos: 'Impuestos', sueldos: 'Sueldos', proveedores: 'Proveedores', financiero: 'Cuotas', otros: 'Otros' };
  var lista = [], aPagar = 0;

  function contar(el, valor, money) {
    var pintar = function (v) { el.textContent = money ? App.money(Math.round(v)) : Math.round(v); };
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { pintar(valor); return; }
    var obj = { v: 0 };
    anime.animate(obj, { v: valor, duration: 700, ease: 'outCubic', onUpdate: function () { pintar(obj.v); } });
    setTimeout(function () { pintar(valor); }, 900);
  }

  function pintarKpis(r) {
    var cont = document.getElementById('vc-kpis');
    if (!cont) return;
    var datos = [['Vencidos', r.vencidos, false], ['Monto vencido', r.montoVencido, true], ['Vencen esta semana', r.estaSemana, false], ['A pagar este mes', r.aPagarMes, true], ['Pagado este mes', r.pagadoMes, true]];
    cont.innerHTML = datos.map(function (d) {
      return '<div class="card"><strong data-vc-kpi="' + d[1] + '" data-vc-money="' + (d[2] ? '1' : '') + '">0</strong><span class="muted">' + d[0] + '</span></div>';
    }).join('');
    cont.querySelectorAll('[data-vc-kpi]').forEach(function (el) {
      contar(el, Number(el.getAttribute('data-vc-kpi')), el.getAttribute('data-vc-money') === '1');
    });
  }

  function estadoHtml(r) {
    if (r.estado === 'pagado') return '<span class="vc-chip pagado">Pagado ' + (r.paidAt ? fecha(r.paidAt) : '') + '</span>';
    if (r.estado === 'vencido') return '<span class="vc-chip vencido">Vencido hace ' + Math.abs(r.diasRestantes) + 'd</span>';
    if (r.diasRestantes <= 7) return '<span class="vc-chip pronto">' + (r.diasRestantes === 0 ? 'Vence hoy' : 'En ' + r.diasRestantes + 'd') + '</span>';
    return '<span class="vc-chip futuro">En ' + r.diasRestantes + 'd</span>';
  }

  function pintar() {
    box.innerHTML = App.table(lista, [
      { label: 'Concepto', render: function (r) {
        return '<strong>' + App.esc(r.concept) + '</strong>' +
          (r.recurrence === 'mensual' ? ' <span class="vc-chip mensual">mensual</span>' : '') +
          (r.note ? '<br><span class="muted" style="font-size:.8rem">' + App.esc(r.note) + '</span>' : '');
      } },
      { label: 'Categoría', render: function (r) { return App.esc(CATS[r.category] || r.category); } },
      { label: 'Vence', render: function (r) { return fecha(r.dueDate); } },
      { label: 'Estado', render: estadoHtml },
      { label: 'Importe', render: function (r) { return '<span class="vc-num">' + App.money(r.status === 'pagado' ? r.paidAmount : r.amount) + '</span>'; } },
      { label: '', render: function (r) {
        return (r.status === 'pagado'
          ? '<button class="btn ghost" type="button" data-vc-despagar="' + r.id + '">Deshacer</button>'
          : '<button class="btn" type="button" data-vc-pagar="' + r.id + '">Pagar</button>') +
          ' <button class="btn ghost" type="button" data-vc-del="' + r.id + '">Borrar</button>';
      } },
    ]);
    var total = document.getElementById('vc-total');
    if (total) total.textContent = aPagar ? 'Pendiente de pago en la vista: ' + App.money(aPagar) : '';

    box.querySelectorAll('[data-vc-pagar]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var r = lista.filter(function (x) { return x.id === b.getAttribute('data-vc-pagar'); })[0];
        if (!r) return;
        var importe = prompt('¿Cuánto se pagó?', String(r.amount));
        if (importe === null) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: se marcaría pagado'); return; }
        try {
          var out = await App.api('/api/vencimientos/' + r.id + '/pagar', { method: 'POST', body: { paidAmount: Number(importe) } });
          var msg = 'Pago registrado';
          if (out.siguiente) msg += ' · se agendó el del ' + fecha(out.siguiente.dueDate);
          if (out.cajaCerrada) msg += ' (la caja del día ya estaba cerrada: no se tocó)';
          else if (out.enCaja) msg += ' y cargado como egreso en la caja';
          App.toast(msg);
          await cargar();
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
    box.querySelectorAll('[data-vc-despagar]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('¿Deshacer el pago? El egreso ya cargado en la caja se corrige desde la caja.')) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: se desharía'); return; }
        try { await App.api('/api/vencimientos/' + b.getAttribute('data-vc-despagar') + '/despagar', { method: 'POST' }); App.toast('Pago deshecho'); await cargar(); }
        catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
    box.querySelectorAll('[data-vc-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('¿Borrar este vencimiento de la agenda?')) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
        try { await App.api('/api/vencimientos/' + b.getAttribute('data-vc-del'), { method: 'DELETE' }); App.toast('Borrado'); await cargar(); }
        catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }

  async function cargar() {
    var estado = (document.getElementById('vc-estado') || {}).value || '';
    var mes = (document.getElementById('vc-mes') || {}).value || '';
    if (window.__PREVIEW__) {
      lista = [
        { id: '1', concept: 'Alquiler del local', category: 'alquiler', amount: 450000, dueDate: new Date().toISOString().slice(0, 10), recurrence: 'mensual', note: '', status: 'pendiente', estado: 'pendiente', diasRestantes: 0, paidAmount: 0, paidAt: '' },
        { id: '2', concept: 'Luz', category: 'servicios', amount: 78000, dueDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), recurrence: 'mensual', note: 'Cliente 4471-2', status: 'pendiente', estado: 'vencido', diasRestantes: -3, paidAmount: 0, paidAt: '' },
      ];
      aPagar = 528000;
      pintarKpis({ vencidos: 1, montoVencido: 78000, estaSemana: 1, aPagarMes: 528000, pagadoMes: 0 });
    } else {
      try {
        var qs = [];
        if (estado) qs.push('estado=' + encodeURIComponent(estado));
        if (mes) qs.push('mes=' + encodeURIComponent(mes));
        var data = await App.api('/api/vencimientos' + (qs.length ? '?' + qs.join('&') : ''));
        lista = data.rows;
        aPagar = data.aPagar;
        pintarKpis(await App.api('/api/vencimientos/resumen'));
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
        return;
      }
    }
    pintar();
  }

  var form = document.getElementById('vc-form');
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: se agendaría el vencimiento'); return; }
    try {
      await App.api('/api/vencimientos', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      App.toast('Vencimiento agendado');
      await cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  var estado = document.getElementById('vc-estado');
  if (estado) estado.addEventListener('change', cargar);
  var mes = document.getElementById('vc-mes');
  if (mes) mes.addEventListener('change', cargar);
  var limpiar = document.getElementById('vc-limpiar');
  if (limpiar) limpiar.addEventListener('click', function () { if (mes) mes.value = ''; if (estado) estado.value = ''; cargar(); });

  var csv = document.getElementById('vc-csv');
  if (csv) csv.addEventListener('click', function () {
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [['Concepto', 'Categoría', 'Vence', 'Importe', 'Estado', 'Pagado el', 'Pagado', 'Se repite', 'Nota'].map(celda).join(';')];
    lista.forEach(function (r) {
      lineas.push([r.concept, CATS[r.category] || r.category, r.dueDate, r.amount, r.estado, r.paidAt || '', r.paidAmount || '', r.recurrence, r.note || ''].map(celda).join(';'));
    });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vencimientos-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  cargar();
})();`,
  readmeNotes: (cfg) => [
    `**Vencimientos y pagos**: panel solo-admin en \`/vencimientos.html\` con todo lo que el negocio tiene que pagar. El estado **vencido no se guarda: lo calcula el servidor** cada vez, con su propia fecha. Las obligaciones marcadas como **mensuales se renuevan solas**: cuando marcás una como pagada, el sistema agenda automáticamente la del mes siguiente (respetando los meses cortos: un vencimiento del 31 cae el 28 o 29 en febrero). Un vencimiento **pagado queda sellado** y no se puede editar; si el pago estuvo mal, usá "Deshacer".${cfg.moduleIds.includes('caja') ? ' Como **Caja diaria** está activo, cada pago se registra además como egreso de la caja del día; si esa caja ya cerró, el pago se guarda igual y el panel avisa que no la tocó. Deshacer un pago **no borra el egreso de la caja**: ese dato se corrige desde la caja, que es donde vive.' : ''}`,
  ],
};
