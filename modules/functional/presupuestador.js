// Cotizador online administrable con backend real: "armá tu presupuesto y enterate cuánto sale",
// que es de las cosas que más pide un negocio de servicios y que el catálogo sólo tenía a medias.
// Estaba la calculadora de presupuesto (módulo UI `estimator`), que es puro navegador con precios
// escritos en el HTML, y estaba el pedido de presupuesto (`quote`), que es un formulario que no
// calcula nada. Acá los CONCEPTOS SON DATOS: el negocio los carga desde el panel (por cantidad, por
// opción o por sí/no, más ajustes porcentuales del tipo "urgente +20%") y el visitante arma su
// cotización en /cotizador.html. Lo importante: el total NUNCA llega del navegador. El cliente manda
// qué eligió y el servidor lo valida contra la definición vigente y calcula el número — si alguien
// edita el HTML y manda un total de $1, el servidor lo descarta. Cada cotización queda guardada con
// un código y con la FOTO de los precios del momento: cambiar la lista mañana no reescribe lo que se
// le prometió a alguien ayer. El visitante consulta su código en la misma página, sin cuenta.
// Panel solo-admin /cotizador-admin.html con KPIs animados (Anime.js + red de seguridad), ABM de
// conceptos, bandeja de cotizaciones y CSV. Requiere Autenticación (para el panel; cotizar es
// público).
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'presupuestador', type: 'functional', name: 'Cotizador online',
  description: 'El "armá tu presupuesto online" con backend real: el negocio carga los conceptos desde el panel (por cantidad, por opción, por sí/no y ajustes porcentuales tipo "urgente +20%") y el visitante arma su cotización en /cotizador.html sin registrarse. El total lo calcula siempre el servidor validando lo elegido contra la definición vigente: un total mandado desde el navegador se descarta. Cada cotización queda guardada con su código y con la foto de los precios del momento, así que cambiar la lista no reescribe lo que ya se prometió; el visitante consulta el estado con su código. Panel solo-admin /cotizador-admin.html con KPIs animados (Anime.js), ABM de conceptos, bandeja y CSV. Requiere Autenticación.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/cotizador', file: 'routes/presupuestador.js' }],
  collections: ['calcitems', 'calcquotes'],
  nav: () => [
    { label: 'Cotizador', href: '/cotizador.html', id: 'nav-cotizador' },
    { label: 'Cotizador (admin)', href: '/cotizador-admin.html', id: 'nav-cotizador-admin' },
  ],
  head: () => `  <style>
    .cz-item{border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;margin-bottom:12px;background:var(--surface)}
    .cz-item label{margin-top:0}
    .cz-item .cz-precio{font-size:.8rem;color:var(--muted)}
    .cz-sino{display:flex;align-items:center;gap:10px;font-weight:600}
    .cz-sino input{width:auto;margin:0}
    .cz-total{position:sticky;bottom:0;background:var(--bg);border-top:2px solid var(--accent);padding:14px 0;margin-top:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
    .cz-total strong{font-size:1.9rem;font-variant-numeric:tabular-nums}
    .cz-detalle table{width:100%;font-size:.9rem}
    .cz-detalle td,.cz-detalle th{padding:6px 8px}
    .cz-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .cz-codigo{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.3rem;font-weight:700;letter-spacing:.06em}
    .cz-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .cz-kpis .card{text-align:center}
    .cz-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .cz-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .cz-chip.nuevo{background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}
    .cz-chip.contactado{background:#2e9e5b20;color:#1d6b3c}
    .cz-chip.cerrado{background:#2e9e5b20;color:#1d6b3c}
    .cz-chip.perdido{background:#c0392b18;color:#c0392b}
    .cz-grupo{margin:22px 0 10px;font-size:1.05rem}
  </style>`,
  html: (cfg) => `  <section class="section">
    <div class="container" style="text-align:center;max-width:640px">
      <h2>${phIcon('lightning', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Calculá tu presupuesto online</h2>
      <p class="section-sub">Elegí lo que necesitás y te decimos cuánto sale, al instante y sin compromiso. ${cfg.brand.name} te contacta después con la propuesta final.</p>
      <a class="btn" href="/cotizador.html">Armar mi presupuesto</a>
    </div>
  </section>`,
  pages: () => ({
    'cotizador': {
      title: 'Cotizador online',
      html: `  <section>
    <div class="container" style="max-width:760px">
      <h2>Armá tu presupuesto</h2>
      <p class="section-sub">Elegí lo que necesitás y el total se calcula solo. Es una estimación: te contactamos para confirmarla.</p>

      <form id="cz-form">
        <div id="cz-campos"><p class="muted">Cargando conceptos…</p></div>
        <div class="cz-total" id="cz-barra" style="display:none">
          <span class="muted">Total estimado</span>
          <strong id="cz-total">$0</strong>
        </div>
        <div class="card" id="cz-datos" style="margin-top:22px;display:none">
          <h3>¿A quién le pasamos la propuesta?</h3>
          <div class="grid cols-2">
            <div><label>Nombre</label><input name="name" required maxlength="80"></div>
            <div><label>Email</label><input name="email" type="email" required></div>
          </div>
          <label>Teléfono (opcional)</label><input name="phone" maxlength="30">
          <label>Comentario (opcional)</label><textarea name="message" rows="2" maxlength="400"></textarea>
          <div style="margin-top:16px"><button class="btn" type="submit">Pedir esta cotización</button></div>
        </div>
      </form>

      <div id="cz-resultado"></div>

      <div class="card" style="margin-top:30px">
        <h3>¿Ya pediste una cotización?</h3>
        <p class="muted" style="margin-top:0">Consultá el estado con el código que te dimos.</p>
        <form id="cz-consulta" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
          <div style="flex:1;min-width:180px"><label>Código</label><input name="code" required maxlength="20" placeholder="CO-XXXXXX" style="margin:0"></div>
          <button class="btn ghost" type="submit">Consultar</button>
        </form>
        <div id="cz-consulta-out"></div>
      </div>
    </div>
  </section>`,
    },
    'cotizador-admin': {
      title: 'Cotizador (admin)',
      html: `  <section>
    <div class="container">
      <h2>Cotizador online</h2>
      <p class="section-sub">Los conceptos que ve el visitante y las cotizaciones que pidió. El total lo calcula el servidor: no se puede falsear desde el navegador.</p>
      <div id="cz-kpis" class="cz-kpis"></div>

      <div class="card" style="margin-bottom:26px">
        <h3>Nuevo concepto</h3>
        <form id="cz-item-form">
          <div class="grid cols-2">
            <div><label>Nombre visible</label><input name="label" required maxlength="80" placeholder="Metros cuadrados a pintar"></div>
            <div><label>Grupo (opcional)</label><input name="grupo" maxlength="40" placeholder="Obra, terminaciones…"></div>
          </div>
          <div class="grid cols-3">
            <div>
              <label>Tipo</label>
              <select name="kind" id="cz-kind">
                <option value="cantidad">Por cantidad (precio × cantidad)</option>
                <option value="opcion">Elegir una opción</option>
                <option value="sino">Sí / No (suma fijo)</option>
                <option value="ajuste">Ajuste porcentual sobre el total</option>
              </select>
            </div>
            <div id="cz-campo-precio"><label>Precio unitario</label><input name="price" type="number" min="0" step="any" value="0"></div>
            <div id="cz-campo-unidad"><label>Unidad</label><input name="unit" maxlength="20" placeholder="m², horas, unidades"></div>
          </div>
          <div id="cz-campo-opciones" style="display:none">
            <label>Opciones (una por línea: <code>Etiqueta | precio</code>; en los ajustes el número es el porcentaje)</label>
            <textarea name="options" rows="3" placeholder="Estándar | 0&#10;Urgente | 20"></textarea>
          </div>
          <div class="grid cols-3">
            <div><label>Mínimo</label><input name="min" type="number" step="any" value="0"></div>
            <div><label>Máximo</label><input name="max" type="number" step="any" value="1000"></div>
            <div><label>Orden</label><input name="order" type="number" value="0"></div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-weight:400">
            <input type="checkbox" name="required" style="width:auto;margin:0"> Es obligatorio
          </label>
          <div style="margin-top:14px"><button class="btn" type="submit">Agregar concepto</button></div>
        </form>
      </div>

      <h3>Conceptos</h3>
      <div id="cz-items"><p class="muted">Cargando…</p></div>

      <h3 style="margin-top:34px">Cotizaciones pedidas</h3>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
        <select id="cz-filtro" style="width:auto;margin:0">
          <option value="">Todos los estados</option>
          <option value="nuevo">Nuevas</option>
          <option value="contactado">Contactadas</option>
          <option value="cerrado">Cerradas</option>
          <option value="perdido">Perdidas</option>
        </select>
        <button class="btn ghost" type="button" id="cz-csv">Descargar CSV</button>
      </div>
      <div id="cz-quotes"><p class="muted">Cargando…</p></div>
      <div id="cz-quote-detalle"></div>
    </div>
  </section>`,
    },
  }),
  files: (cfg) => {
    const conMailer = cfg.moduleIds.includes('mailer');
    return {
      'routes/presupuestador.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { check, str, num, isEmail, oneOf } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');${conMailer ? `
const mailer = require('../src/mailer');` : ''}

const TIPOS = ['cantidad', 'opcion', 'sino', 'ajuste'];
const ESTADOS = ['nuevo', 'contactado', 'cerrado', 'perdido'];
const redondear = (n) => Math.round(n * 100) / 100;

// Los conceptos que ve el visitante: sólo los publicados, ya ordenados
async function definicion() {
  const rows = (await db.all('calcitems')).filter(i => i.active !== false);
  return rows.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.label).localeCompare(String(b.label), 'es'));
}

// EL CÁLCULO. Recibe lo que eligió el visitante y lo valida contra la definición vigente.
// El total que mande el navegador se ignora por completo: acá se arma de cero.
function cotizar(items, seleccion) {
  const lines = [];
  const errores = [];
  let base = 0;
  const ajustes = [];

  for (const it of items) {
    const elegido = seleccion[it.id];
    if (it.kind === 'sino') {
      if (!elegido) { if (it.required) errores.push(it.label + ': es obligatorio'); continue; }
      const monto = redondear(Number(it.price) || 0);
      base += monto;
      lines.push({ itemId: it.id, label: it.label, detail: 'Sí', amount: monto });
      continue;
    }
    if (it.kind === 'cantidad') {
      const qty = Number(elegido);
      if (!elegido && elegido !== 0) { if (it.required) errores.push(it.label + ': es obligatorio'); continue; }
      if (!isFinite(qty)) { errores.push(it.label + ': cantidad inválida'); continue; }
      const min = Number(it.min) || 0, max = Number(it.max) || 1000000;
      if (qty < min || qty > max) { errores.push(it.label + ': tiene que estar entre ' + min + ' y ' + max); continue; }
      if (qty === 0) { if (it.required) errores.push(it.label + ': es obligatorio'); continue; }
      const monto = redondear(qty * (Number(it.price) || 0));
      base += monto;
      lines.push({ itemId: it.id, label: it.label, detail: qty + (it.unit ? ' ' + it.unit : ''), amount: monto });
      continue;
    }
    // opcion y ajuste comparten forma: una lista cerrada de opciones
    const ops = Array.isArray(it.options) ? it.options : [];
    if (elegido === undefined || elegido === '') { if (it.required) errores.push(it.label + ': es obligatorio'); continue; }
    const op = ops.filter(o => o.label === elegido)[0];
    // Una opción que no está en la definición no se acepta "por las dudas": se rechaza
    if (!op) { errores.push(it.label + ': esa opción no existe'); continue; }
    if (it.kind === 'opcion') {
      const monto = redondear(Number(op.price) || 0);
      base += monto;
      lines.push({ itemId: it.id, label: it.label, detail: op.label, amount: monto });
    } else {
      ajustes.push({ itemId: it.id, label: it.label, detail: op.label, percent: Number(op.price) || 0 });
    }
  }

  base = redondear(base);
  let total = base;
  // Los ajustes se aplican SIEMPRE sobre la base, nunca en cascada uno sobre otro:
  // dos recargos del 10% suman 20%, no 21%. Es lo que espera cualquiera que lea el detalle.
  for (const aj of ajustes) {
    const monto = redondear(base * (aj.percent / 100));
    total += monto;
    lines.push({ itemId: aj.itemId, label: aj.label, detail: aj.detail + ' (' + aj.percent + '%)', amount: monto });
  }
  return { lines, base, total: redondear(total), errores };
}

/* ---------- público ---------- */

// GET /api/cotizador/form — los conceptos publicados, tal como los ve el visitante
router.get('/form', async (req, res) => {
  const items = await definicion();
  res.json(items.map(i => ({
    id: i.id, label: i.label, grupo: i.grupo || '', kind: i.kind,
    price: i.price || 0, unit: i.unit || '', min: i.min || 0, max: i.max || 0,
    required: Boolean(i.required),
    options: (i.options || []).map(o => ({ label: o.label, price: o.price })),
  })));
});

// POST /api/cotizador/calcular — devuelve el total SIN guardar nada (el detalle en vivo)
router.post('/calcular', async (req, res) => {
  const items = await definicion();
  const out = cotizar(items, req.body && req.body.seleccion ? req.body.seleccion : {});
  res.json({ lines: out.lines, base: out.base, total: out.total, errores: out.errores });
});

// POST /api/cotizador — guarda la cotización con su código
router.post('/', async (req, res) => {
  const { ok, errors } = check(req.body, { name: (v) => str(v, 2, 80), email: isEmail });
  if (!ok) return res.status(422).json({ error: 'Completá tu nombre y un email válido', errors });
  const items = await definicion();
  if (!items.length) return res.status(409).json({ error: 'El cotizador todavía no tiene conceptos cargados' });
  const out = cotizar(items, req.body.seleccion || {});
  if (out.errores.length) return res.status(422).json({ error: out.errores[0], errores: out.errores });
  if (!out.lines.length) return res.status(422).json({ error: 'Elegí al menos un concepto para cotizar' });
  const row = await db.insert('calcquotes', {
    code: 'CO-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    name: String(req.body.name).trim(),
    email: String(req.body.email).toLowerCase().trim(),
    phone: String(req.body.phone || '').trim().slice(0, 30),
    message: String(req.body.message || '').trim().slice(0, 400),
    // Foto del cálculo: los renglones y el total quedan congelados. Si mañana suben los precios,
    // lo que se le prometió a esta persona sigue diciendo lo mismo.
    lines: out.lines,
    base: out.base,
    total: out.total,
    status: 'nuevo',
    note: '',
  });
${conMailer ? `  // Avisos por email (módulo Avisos por email): al negocio le llega el pedido y a la persona su
  // código. Es "disparar y seguir": un email caído jamás rompe la cotización ya guardada.
  const detalle = out.lines.map(l => '· ' + l.label + ' (' + l.detail + '): $' + l.amount.toLocaleString('es-AR')).join('\\n');
  mailer.notify('Nueva cotización ' + row.code + ': $' + row.total.toLocaleString('es-AR'), row.name + ' (' + row.email + (row.phone ? ', tel. ' + row.phone : '') + ') armó esta cotización:\\n\\n' + detalle + '\\n\\nTOTAL: $' + row.total.toLocaleString('es-AR') + (row.message ? '\\n\\nComentario: ' + row.message : '') + '\\n\\nAtendela desde /cotizador-admin.html').catch(() => {});
  mailer.notifyTo(row.email, 'Tu presupuesto estimado: ' + row.code, 'Hola ' + row.name + ',\\n\\nEste es el presupuesto que armaste:\\n\\n' + detalle + '\\n\\nTOTAL ESTIMADO: $' + row.total.toLocaleString('es-AR') + '\\n\\nGuardá tu código ' + row.code + ' para consultar el estado. Te contactamos a la brevedad con la propuesta final.').catch(() => {});
` : ''}  res.status(201).json({ code: row.code, total: row.total, base: row.base, lines: row.lines });
});

// GET /api/cotizador/consulta/:code — el visitante consulta su código, sin cuenta.
// Devuelve lo suyo y nada más: ni el email ni la nota interna del negocio.
router.get('/consulta/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const q = (await db.find('calcquotes', r => r.code === code))[0];
  if (!q) return res.status(404).json({ error: 'No encontramos ninguna cotización con ese código' });
  res.json({ code: q.code, total: q.total, lines: q.lines, status: q.status, createdAt: q.createdAt });
});

/* ---------- panel (solo admin) ---------- */

// GET /api/cotizador/admin/items — todos los conceptos, publicados o no
router.get('/admin/items', requireAdmin, async (req, res) => {
  const rows = await db.all('calcitems');
  res.json(rows.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.label).localeCompare(String(b.label), 'es')));
});

// Normaliza las opciones que llegan del panel: lista cerrada de {label, price}
function parseOpciones(raw) {
  if (Array.isArray(raw)) {
    return raw.filter(o => o && str(o.label, 1, 60)).map(o => ({ label: String(o.label).trim(), price: Number(o.price) || 0 })).slice(0, 20);
  }
  return String(raw || '').split('\\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [label, price] = l.split('|');
    return { label: String(label || '').trim().slice(0, 60), price: Number(price) || 0 };
  }).filter(o => o.label).slice(0, 20);
}

// POST /api/cotizador/admin/items — alta de concepto
router.post('/admin/items', requireAdmin, async (req, res) => {
  if (!str(req.body.label, 2, 80)) return res.status(422).json({ error: 'El nombre del concepto es obligatorio' });
  const kind = oneOf(req.body.kind, TIPOS) ? req.body.kind : 'cantidad';
  const options = (kind === 'opcion' || kind === 'ajuste') ? parseOpciones(req.body.options) : [];
  if ((kind === 'opcion' || kind === 'ajuste') && !options.length) {
    return res.status(422).json({ error: 'Cargá al menos una opción (formato: Etiqueta | precio)' });
  }
  const min = Number(req.body.min) || 0;
  const max = Number(req.body.max) || 0;
  if (kind === 'cantidad' && max && max < min) return res.status(422).json({ error: 'El máximo no puede ser menor que el mínimo' });
  const row = await db.insert('calcitems', {
    label: String(req.body.label).trim(),
    grupo: String(req.body.grupo || '').trim().slice(0, 40),
    kind,
    price: num(Number(req.body.price), 0, 1000000000) ? redondear(Number(req.body.price)) : 0,
    unit: String(req.body.unit || '').trim().slice(0, 20),
    min, max: max || 1000,
    order: Number(req.body.order) || 0,
    required: Boolean(req.body.required),
    options,
    active: true,
  });
  res.status(201).json(row);
});

// PUT /api/cotizador/admin/items/:id — edita el concepto (los precios de las cotizaciones ya
// pedidas no cambian: cada una guardó su propia foto del cálculo)
router.put('/admin/items/:id', requireAdmin, async (req, res) => {
  const it = await db.get('calcitems', req.params.id);
  if (!it) return res.status(404).json({ error: 'Ese concepto no existe' });
  const patch = {};
  if (req.body.label !== undefined) {
    if (!str(req.body.label, 2, 80)) return res.status(422).json({ error: 'Nombre inválido' });
    patch.label = String(req.body.label).trim();
  }
  if (req.body.grupo !== undefined) patch.grupo = String(req.body.grupo).trim().slice(0, 40);
  if (req.body.price !== undefined) {
    if (!num(Number(req.body.price), 0, 1000000000)) return res.status(422).json({ error: 'Precio inválido' });
    patch.price = redondear(Number(req.body.price));
  }
  if (req.body.unit !== undefined) patch.unit = String(req.body.unit).trim().slice(0, 20);
  if (req.body.min !== undefined) patch.min = Number(req.body.min) || 0;
  if (req.body.max !== undefined) patch.max = Number(req.body.max) || 1000;
  if (req.body.order !== undefined) patch.order = Number(req.body.order) || 0;
  if (req.body.required !== undefined) patch.required = Boolean(req.body.required);
  if (req.body.active !== undefined) patch.active = Boolean(req.body.active);
  if (req.body.options !== undefined) {
    const options = parseOpciones(req.body.options);
    if ((patch.kind || it.kind) !== 'cantidad' && (it.kind === 'opcion' || it.kind === 'ajuste') && !options.length) {
      return res.status(422).json({ error: 'Cargá al menos una opción' });
    }
    patch.options = options;
  }
  res.json(await db.update('calcitems', it.id, patch));
});

// DELETE /api/cotizador/admin/items/:id — saca el concepto del cotizador
router.delete('/admin/items/:id', requireAdmin, async (req, res) => {
  const it = await db.get('calcitems', req.params.id);
  if (!it) return res.status(404).json({ error: 'Ese concepto no existe' });
  await db.remove('calcitems', it.id);
  res.json({ ok: true });
});

// GET /api/cotizador/admin/quotes — la bandeja (filtro ?estado=)
router.get('/admin/quotes', requireAdmin, async (req, res) => {
  let rows = await db.all('calcquotes');
  if (ESTADOS.includes(req.query.estado)) rows = rows.filter(q => q.status === req.query.estado);
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json(rows);
});

// GET /api/cotizador/admin/resumen — KPIs del servidor
router.get('/admin/resumen', requireAdmin, async (req, res) => {
  const rows = await db.all('calcquotes');
  const mes = new Date().toISOString().slice(0, 7);
  const delMes = rows.filter(q => String(q.createdAt).slice(0, 7) === mes);
  const cerradas = rows.filter(q => q.status === 'cerrado');
  res.json({
    nuevas: rows.filter(q => q.status === 'nuevo').length,
    delMes: delMes.length,
    montoMes: redondear(delMes.reduce((s, q) => s + (Number(q.total) || 0), 0)),
    ticket: rows.length ? Math.round(rows.reduce((s, q) => s + (Number(q.total) || 0), 0) / rows.length) : 0,
    cerradas: cerradas.length,
  });
});

// PATCH /api/cotizador/admin/quotes/:id — mueve el estado o deja una nota interna
router.patch('/admin/quotes/:id', requireAdmin, async (req, res) => {
  const q = await db.get('calcquotes', req.params.id);
  if (!q) return res.status(404).json({ error: 'Esa cotización no existe' });
  const patch = {};
  if (req.body.status !== undefined) {
    if (!oneOf(req.body.status, ESTADOS)) return res.status(422).json({ error: 'Estado inválido' });
    patch.status = req.body.status;
  }
  if (req.body.note !== undefined) patch.note = String(req.body.note).trim().slice(0, 300);
  res.json(await db.update('calcquotes', q.id, patch));
});

// DELETE /api/cotizador/admin/quotes/:id
router.delete('/admin/quotes/:id', requireAdmin, async (req, res) => {
  const q = await db.get('calcquotes', req.params.id);
  if (!q) return res.status(404).json({ error: 'Esa cotización no existe' });
  await db.remove('calcquotes', q.id);
  res.json({ ok: true });
});

module.exports = router;
`,
    };
  },
  clientJs: () => `/* Módulo cotizador online: formulario público armado desde la definición del servidor, total en
   vivo calculado SIEMPRE en el servidor, consulta por código, y panel admin con ABM de conceptos y
   bandeja. Animaciones con Anime.js (count-up del total, entrada de renglones) + red de seguridad.
   En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };
  var fechaHora = function (iso) { try { return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  var ESTADOS = { nuevo: 'Nueva', contactado: 'Contactada', cerrado: 'Cerrada', perdido: 'Perdida' };

  function contar(el, valor, money) {
    var pintar = function (v) { el.textContent = money ? App.money(Math.round(v)) : Math.round(v); };
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { pintar(valor); return; }
    var obj = { v: 0 };
    anime.animate(obj, { v: valor, duration: 650, ease: 'outCubic', onUpdate: function () { pintar(obj.v); } });
    setTimeout(function () { pintar(valor); }, 850);
  }

  /* ----- cotizador público ----- */
  (function () {
    var campos = document.getElementById('cz-campos');
    if (!campos) return;
    var form = document.getElementById('cz-form');
    var barra = document.getElementById('cz-barra');
    var datos = document.getElementById('cz-datos');
    var totalEl = document.getElementById('cz-total');
    var items = [], ultimo = 0;

    function seleccion() {
      var sel = {};
      items.forEach(function (it) {
        var el = document.querySelector('[data-cz-in="' + it.id + '"]');
        if (!el) return;
        if (it.kind === 'sino') { if (el.checked) sel[it.id] = true; return; }
        if (el.value !== '') sel[it.id] = it.kind === 'cantidad' ? Number(el.value) : el.value;
      });
      return sel;
    }

    async function recalcular() {
      if (window.__PREVIEW__) {
        var t = 0;
        items.forEach(function (it) {
          var el = document.querySelector('[data-cz-in="' + it.id + '"]');
          if (!el) return;
          if (it.kind === 'cantidad') t += (Number(el.value) || 0) * (it.price || 0);
          if (it.kind === 'sino' && el.checked) t += it.price || 0;
        });
        mostrarTotal(t);
        return;
      }
      try {
        var out = await App.api('/api/cotizador/calcular', { method: 'POST', body: { seleccion: seleccion() } });
        mostrarTotal(out.total);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    function mostrarTotal(t) {
      if (!barra || !totalEl) return;
      barra.style.display = t > 0 ? '' : 'none';
      if (datos) datos.style.display = t > 0 ? '' : 'none';
      if (t === ultimo) return;
      ultimo = t;
      contar(totalEl, t, true);
    }

    function campo(it) {
      var pista = '';
      if (it.kind === 'cantidad' && it.price) pista = '<span class="cz-precio">' + App.money(it.price) + (it.unit ? ' por ' + App.esc(it.unit) : ' por unidad') + '</span>';
      if (it.kind === 'sino' && it.price) pista = '<span class="cz-precio">' + App.money(it.price) + '</span>';
      var control = '';
      if (it.kind === 'cantidad') {
        control = '<input type="number" data-cz-in="' + attr(it.id) + '" min="' + (it.min || 0) + '" max="' + (it.max || 1000) + '" step="any" placeholder="0"' + (it.required ? ' required' : '') + '>';
      } else if (it.kind === 'sino') {
        return '<div class="cz-item"><label class="cz-sino"><input type="checkbox" data-cz-in="' + attr(it.id) + '"> ' + App.esc(it.label) + '</label>' + pista + '</div>';
      } else {
        control = '<select data-cz-in="' + attr(it.id) + '"' + (it.required ? ' required' : '') + '>' +
          (it.required ? '' : '<option value="">Sin elegir</option>') +
          it.options.map(function (o) {
            var extra = it.kind === 'ajuste' ? (o.price ? ' (' + (o.price > 0 ? '+' : '') + o.price + '%)' : '') : (o.price ? ' — ' + App.money(o.price) : '');
            return '<option value="' + attr(o.label) + '">' + App.esc(o.label) + extra + '</option>';
          }).join('') + '</select>';
      }
      return '<div class="cz-item"><label>' + App.esc(it.label) + (it.required ? ' *' : '') + '</label>' + control + pista + '</div>';
    }

    function pintar() {
      if (!items.length) {
        campos.innerHTML = '<p class="muted">El cotizador todavía no tiene conceptos cargados. Volvé en un rato o escribinos.</p>';
        return;
      }
      var grupos = [];
      items.forEach(function (it) {
        var g = grupos.filter(function (x) { return x.nombre === (it.grupo || ''); })[0];
        if (!g) { g = { nombre: it.grupo || '', items: [] }; grupos.push(g); }
        g.items.push(it);
      });
      campos.innerHTML = grupos.map(function (g) {
        return (g.nombre ? '<h3 class="cz-grupo">' + App.esc(g.nombre) + '</h3>' : '') + g.items.map(campo).join('');
      }).join('');
      campos.querySelectorAll('[data-cz-in]').forEach(function (el) {
        el.addEventListener(el.type === 'number' ? 'input' : 'change', function () {
          clearTimeout(el._t);
          el._t = setTimeout(recalcular, el.type === 'number' ? 320 : 0);
        });
      });
    }

    async function cargar() {
      if (window.__PREVIEW__) {
        items = [
          { id: 'a', label: 'Metros cuadrados', grupo: 'Obra', kind: 'cantidad', price: 12000, unit: 'm²', min: 1, max: 500, required: true, options: [] },
          { id: 'b', label: 'Incluye materiales', grupo: 'Obra', kind: 'sino', price: 90000, unit: '', min: 0, max: 0, required: false, options: [] },
          { id: 'c', label: 'Plazo', grupo: '', kind: 'ajuste', price: 0, unit: '', min: 0, max: 0, required: false, options: [{ label: 'Normal', price: 0 }, { label: 'Urgente', price: 20 }] },
        ];
      } else {
        try { items = await App.api('/api/cotizador/form'); }
        catch (err) { if (err.message !== 'preview') campos.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; return; }
      }
      pintar();
    }

    if (form) form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: se pediría la cotización'); return; }
      var body = Object.fromEntries(new FormData(form));
      body.seleccion = seleccion();
      try {
        var out = await App.api('/api/cotizador', { method: 'POST', body: body });
        var filas = out.lines.map(function (l) {
          return '<tr><td>' + App.esc(l.label) + '</td><td class="muted">' + App.esc(l.detail) + '</td><td class="cz-num">' + App.money(l.amount) + '</td></tr>';
        }).join('');
        document.getElementById('cz-resultado').innerHTML =
          '<div class="card cz-detalle" style="margin-top:24px">' +
          '<h3>Tu presupuesto estimado</h3>' +
          '<p>Guardá este código para consultar el estado: <span class="cz-codigo">' + App.esc(out.code) + '</span></p>' +
          '<table><thead><tr><th>Concepto</th><th>Detalle</th><th class="cz-num">Importe</th></tr></thead><tbody>' + filas + '</tbody></table>' +
          '<p class="cz-num" style="font-size:1.3rem;font-weight:700;margin-top:12px">Total: ' + App.money(out.total) + '</p>' +
          '<p class="muted" style="font-size:.85rem;margin:0">Es una estimación calculada con los valores de hoy. Te contactamos para confirmarla.</p>' +
          '</div>';
        form.reset();
        if (barra) barra.style.display = 'none';
        if (datos) datos.style.display = 'none';
        ultimo = 0;
        pintar();
        document.getElementById('cz-resultado').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var consulta = document.getElementById('cz-consulta');
    if (consulta) consulta.addEventListener('submit', async function (e) {
      e.preventDefault();
      var out = document.getElementById('cz-consulta-out');
      var code = consulta.querySelector('[name="code"]').value.trim().toUpperCase();
      if (window.__PREVIEW__) { out.innerHTML = '<p class="muted">Vista previa: acá aparecería el estado de ' + App.esc(code) + '.</p>'; return; }
      try {
        var q = await App.api('/api/cotizador/consulta/' + encodeURIComponent(code));
        out.innerHTML = '<div class="cz-detalle" style="margin-top:14px">' +
          '<p>Cotización <strong>' + App.esc(q.code) + '</strong> del ' + fechaHora(q.createdAt) + ' · estado: <strong>' + App.esc(ESTADOS[q.status] || q.status) + '</strong></p>' +
          '<table><tbody>' + q.lines.map(function (l) {
            return '<tr><td>' + App.esc(l.label) + '</td><td class="muted">' + App.esc(l.detail) + '</td><td class="cz-num">' + App.money(l.amount) + '</td></tr>';
          }).join('') + '</tbody></table>' +
          '<p class="cz-num" style="font-weight:700">Total: ' + App.money(q.total) + '</p></div>';
      } catch (err) {
        if (err.message !== 'preview') out.innerHTML = '<p class="muted" style="margin-top:12px">' + App.esc(err.message) + '</p>';
      }
    });

    cargar();
  })();

  /* ----- panel admin ----- */
  (function () {
    var box = document.getElementById('cz-items');
    if (!box) return;
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      return;
    }
    var items = [], quotes = [];

    function pintarKpis(r) {
      var cont = document.getElementById('cz-kpis');
      if (!cont) return;
      var datos = [['Sin atender', r.nuevas, false], ['Cotizadas este mes', r.delMes, false], ['Monto cotizado del mes', r.montoMes, true], ['Ticket promedio', r.ticket, true], ['Cerradas', r.cerradas, false]];
      cont.innerHTML = datos.map(function (d) {
        return '<div class="card"><strong data-cz-kpi="' + d[1] + '" data-cz-money="' + (d[2] ? '1' : '') + '">0</strong><span class="muted">' + d[0] + '</span></div>';
      }).join('');
      cont.querySelectorAll('[data-cz-kpi]').forEach(function (el) {
        contar(el, Number(el.getAttribute('data-cz-kpi')), el.getAttribute('data-cz-money') === '1');
      });
    }

    function pintarItems() {
      box.innerHTML = App.table(items, [
        { label: 'Concepto', render: function (i) {
          return '<strong>' + App.esc(i.label) + '</strong>' + (i.grupo ? '<br><span class="muted" style="font-size:.8rem">' + App.esc(i.grupo) + '</span>' : '');
        } },
        { label: 'Tipo', render: function (i) {
          var t = { cantidad: 'Por cantidad', opcion: 'Opción', sino: 'Sí/No', ajuste: 'Ajuste %' };
          return App.esc(t[i.kind] || i.kind);
        } },
        { label: 'Valor', render: function (i) {
          if (i.kind === 'cantidad') return '<span class="cz-num">' + App.money(i.price) + (i.unit ? ' / ' + App.esc(i.unit) : '') + '</span>';
          if (i.kind === 'sino') return '<span class="cz-num">' + App.money(i.price) + '</span>';
          return (i.options || []).map(function (o) { return App.esc(o.label) + ' ' + (i.kind === 'ajuste' ? o.price + '%' : App.money(o.price)); }).join('<br>');
        } },
        { label: 'Estado', render: function (i) { return i.active === false ? '<span class="cz-chip perdido">oculto</span>' : '<span class="cz-chip contactado">publicado</span>'; } },
        { label: '', render: function (i) {
          return '<button class="btn ghost" type="button" data-cz-toggle="' + i.id + '">' + (i.active === false ? 'Publicar' : 'Ocultar') + '</button> ' +
            '<button class="btn ghost" type="button" data-cz-precio="' + i.id + '">Precio</button> ' +
            '<button class="btn ghost" type="button" data-cz-delitem="' + i.id + '">Borrar</button>';
        } },
      ]);
      box.querySelectorAll('[data-cz-toggle]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var i = items.filter(function (x) { return x.id === b.getAttribute('data-cz-toggle'); })[0];
          if (!i) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: cambiaría la publicación'); return; }
          try { await App.api('/api/cotizador/admin/items/' + i.id, { method: 'PUT', body: { active: i.active === false } }); await cargar(); }
          catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-cz-precio]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var i = items.filter(function (x) { return x.id === b.getAttribute('data-cz-precio'); })[0];
          if (!i) return;
          if (i.kind === 'opcion' || i.kind === 'ajuste') {
            var texto = prompt('Opciones (una por línea: Etiqueta | ' + (i.kind === 'ajuste' ? 'porcentaje' : 'precio') + ')',
              (i.options || []).map(function (o) { return o.label + ' | ' + o.price; }).join('\\n'));
            if (texto === null) return;
            if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría'); return; }
            try { await App.api('/api/cotizador/admin/items/' + i.id, { method: 'PUT', body: { options: texto } }); App.toast('Opciones actualizadas'); await cargar(); }
            catch (err) { if (err.message !== 'preview') App.toast(err.message); }
            return;
          }
          var p = prompt('Precio de "' + i.label + '"', String(i.price || 0));
          if (p === null) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría'); return; }
          try { await App.api('/api/cotizador/admin/items/' + i.id, { method: 'PUT', body: { price: Number(p) || 0 } }); App.toast('Precio actualizado'); await cargar(); }
          catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-cz-delitem]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar el concepto? Las cotizaciones ya pedidas conservan su detalle.')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try { await App.api('/api/cotizador/admin/items/' + b.getAttribute('data-cz-delitem'), { method: 'DELETE' }); App.toast('Concepto borrado'); await cargar(); }
          catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    function pintarQuotes() {
      var cont = document.getElementById('cz-quotes');
      if (!cont) return;
      cont.innerHTML = App.table(quotes, [
        { label: 'Código', render: function (q) { return '<strong>' + App.esc(q.code) + '</strong><br><span class="muted" style="font-size:.78rem">' + fechaHora(q.createdAt) + '</span>'; } },
        { label: 'Quién', render: function (q) {
          return App.esc(q.name) + '<br><span class="muted" style="font-size:.8rem">' + App.esc(q.email) + (q.phone ? ' · ' + App.esc(q.phone) : '') + '</span>';
        } },
        { label: 'Total', render: function (q) { return '<span class="cz-num">' + App.money(q.total) + '</span>'; } },
        { label: 'Estado', render: function (q) { return '<span class="cz-chip ' + App.esc(q.status) + '">' + App.esc(ESTADOS[q.status] || q.status) + '</span>'; } },
        { label: '', render: function (q) {
          return '<button class="btn ghost" type="button" data-cz-ver="' + q.id + '">Ver</button> ' +
            '<select data-cz-estado="' + q.id + '" style="width:auto;margin:0;display:inline-block">' +
            Object.keys(ESTADOS).map(function (k) { return '<option value="' + k + '"' + (q.status === k ? ' selected' : '') + '>' + ESTADOS[k] + '</option>'; }).join('') +
            '</select>';
        } },
      ]);
      cont.querySelectorAll('[data-cz-estado]').forEach(function (sel) {
        sel.addEventListener('change', async function () {
          if (window.__PREVIEW__) { App.toast('Vista previa: cambiaría el estado'); return; }
          try { await App.api('/api/cotizador/admin/quotes/' + sel.getAttribute('data-cz-estado'), { method: 'PATCH', body: { status: sel.value } }); App.toast('Estado actualizado'); await cargar(); }
          catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      cont.querySelectorAll('[data-cz-ver]').forEach(function (b) {
        b.addEventListener('click', function () {
          var q = quotes.filter(function (x) { return x.id === b.getAttribute('data-cz-ver'); })[0];
          if (!q) return;
          var det = document.getElementById('cz-quote-detalle');
          det.innerHTML = '<div class="card cz-detalle" style="margin-top:20px"><h3>' + App.esc(q.code) + ' — ' + App.esc(q.name) + '</h3>' +
            '<table><tbody>' + (q.lines || []).map(function (l) {
              return '<tr><td>' + App.esc(l.label) + '</td><td class="muted">' + App.esc(l.detail) + '</td><td class="cz-num">' + App.money(l.amount) + '</td></tr>';
            }).join('') + '</tbody></table>' +
            '<p class="cz-num" style="font-weight:700;font-size:1.15rem">Total: ' + App.money(q.total) + '</p>' +
            (q.message ? '<p class="muted">Comentario: ' + App.esc(q.message) + '</p>' : '') +
            '<button class="btn ghost" type="button" id="cz-borrar-q" data-id="' + q.id + '">Borrar cotización</button></div>';
          var del = document.getElementById('cz-borrar-q');
          if (del) del.addEventListener('click', async function () {
            if (!confirm('¿Borrar la cotización?')) return;
            if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
            try { await App.api('/api/cotizador/admin/quotes/' + del.getAttribute('data-id'), { method: 'DELETE' }); App.toast('Borrada'); det.innerHTML = ''; await cargar(); }
            catch (err) { if (err.message !== 'preview') App.toast(err.message); }
          });
          det.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
        });
      });
    }

    async function cargar() {
      var estado = (document.getElementById('cz-filtro') || {}).value || '';
      if (window.__PREVIEW__) {
        items = [{ id: '1', label: 'Metros cuadrados', grupo: 'Obra', kind: 'cantidad', price: 12000, unit: 'm²', active: true, options: [] }];
        quotes = [{ id: 'q1', code: 'CO-A1B2C3', name: 'Cliente de ejemplo', email: 'cliente@mail.com', phone: '', total: 480000, status: 'nuevo', createdAt: new Date().toISOString(), lines: [{ label: 'Metros cuadrados', detail: '40 m²', amount: 480000 }], message: '' }];
        pintarKpis({ nuevas: 1, delMes: 1, montoMes: 480000, ticket: 480000, cerradas: 0 });
      } else {
        try {
          items = await App.api('/api/cotizador/admin/items');
          quotes = await App.api('/api/cotizador/admin/quotes' + (estado ? '?estado=' + encodeURIComponent(estado) : ''));
          pintarKpis(await App.api('/api/cotizador/admin/resumen'));
        } catch (err) {
          if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
          return;
        }
      }
      pintarItems();
      pintarQuotes();
    }

    // Los campos del alta cambian según el tipo: pedir "opciones" para un concepto por
    // cantidad (o "unidad" para un ajuste porcentual) sólo confunde
    var kind = document.getElementById('cz-kind');
    function ajustarCampos() {
      if (!kind) return;
      var v = kind.value;
      var precio = document.getElementById('cz-campo-precio');
      var unidad = document.getElementById('cz-campo-unidad');
      var ops = document.getElementById('cz-campo-opciones');
      if (precio) precio.style.display = (v === 'cantidad' || v === 'sino') ? '' : 'none';
      if (unidad) unidad.style.display = v === 'cantidad' ? '' : 'none';
      if (ops) ops.style.display = (v === 'opcion' || v === 'ajuste') ? '' : 'none';
    }
    if (kind) kind.addEventListener('change', ajustarCampos);
    ajustarCampos();

    var itemForm = document.getElementById('cz-item-form');
    if (itemForm) itemForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: se agregaría el concepto'); return; }
      var body = Object.fromEntries(new FormData(itemForm));
      body.required = Boolean(itemForm.querySelector('[name="required"]').checked);
      try {
        await App.api('/api/cotizador/admin/items', { method: 'POST', body: body });
        itemForm.reset();
        ajustarCampos();
        App.toast('Concepto agregado');
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var filtro = document.getElementById('cz-filtro');
    if (filtro) filtro.addEventListener('change', cargar);

    var csv = document.getElementById('cz-csv');
    if (csv) csv.addEventListener('click', function () {
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [['Código', 'Fecha', 'Nombre', 'Email', 'Teléfono', 'Total', 'Estado', 'Comentario'].map(celda).join(';')];
      quotes.forEach(function (q) {
        lineas.push([q.code, q.createdAt, q.name, q.email, q.phone, q.total, q.status, q.message].map(celda).join(';'));
      });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cotizaciones-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    cargar();
  })();
})();`,
  readmeNotes: (cfg) => [
    `**Cotizador online**: el visitante arma su presupuesto en \`/cotizador.html\` y el negocio carga los conceptos en \`/cotizador-admin.html\` (solo admin). **El total nunca llega del navegador**: el cliente manda qué eligió y el servidor lo valida contra la definición vigente y calcula el número, así que editar el HTML no sirve para fabricar un precio. Hay cuatro tipos de concepto: **por cantidad** (precio × cantidad), **elegir una opción**, **sí/no** (suma un fijo) y **ajuste porcentual** (por ejemplo "urgente +20%", que se aplica sobre la base, nunca en cascada sobre otro ajuste). Cada cotización guarda la **foto de los precios del momento**: si mañana actualizás la lista, lo que ya se le prometió a alguien sigue diciendo lo mismo. El visitante consulta el estado con su código, sin registrarse.${cfg.moduleIds.includes('mailer') ? ' Con **Avisos por email** activo, el negocio recibe cada cotización y **la persona recibe su presupuesto y su código por email**.' : ' Activá **Avisos por email** para que cada cotización te llegue al correo y la persona reciba su código.'} Cargá los conceptos antes de publicar el sitio: sin conceptos, la página avisa que el cotizador todavía no está listo.`,
  ],
};
