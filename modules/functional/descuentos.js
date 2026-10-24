// Reglas de descuento automáticas con backend real. El catálogo ya tenía cupones (un código que
// el visitante tipea), pero le faltaba lo que un comercio pide primero: los descuentos que se
// aplican SOLOS. "10% llevando más de $50.000", "por cada 3 unidades te descuento $1.500",
// "20% en la línea de verano hasta fin de mes". Sin esto, la única forma de hacer una promoción
// era bajar los precios de la lista a mano y volver a subirlos cuando termina.
//
// La regla de oro es la misma que en el cotizador y en el envío gratis: EL TOTAL NO LLEGA DEL
// NAVEGADOR. El servidor recalcula el subtotal contra la colección products, aplica las reglas
// vigentes y devuelve el detalle. El navegador dice qué productos y cuántos; cuánto valen y
// cuánto se descuenta lo dice el servidor. Un descuento que se pudiera falsear desde el frontend
// no es una promoción: es un agujero.
//
// Dos decisiones que separan esto de un "restale un porcentaje al total":
//   1. Los porcentajes se aplican SIEMPRE sobre el subtotal original, nunca en cascada. Dos
//      reglas del 10% descuentan 20%, no 19%. Es lo mismo que hace el cotizador con los ajustes,
//      y es lo que el comerciante espera cuando escribe "10% + 10%".
//   2. Una regla marcada "no acumulable" corta la lista: si aplica, ninguna posterior se suma.
//      Es la promoción exclusiva de siempre ("este descuento no es combinable con otros").
// Además cada regla tiene VIGENCIA (desde/hasta) evaluada con la fecha del SERVIDOR —una promo
// que termina según el reloj del visitante se puede estirar cambiando la hora de la máquina— y
// un TOPE opcional en pesos, que es lo que evita que un 20% sobre un pedido mayorista se coma
// el margen entero.
//
// Y lo más importante: el descuento que se muestra en el carrito es el que efectivamente se
// cobra. El checkout (routes/orders.js del módulo Carrito) llama al mismo cálculo antes de
// guardar la orden, así que el cartel del carrito nunca promete algo que la orden no cumple.
// Con cupones activos, el cupón se aplica DESPUÉS de los descuentos automáticos.
// Panel /descuentos-admin.html con KPIs animados (Anime.js) + red de seguridad.
const { phIcon } = require('../../src/icons');

// Regla sembrada: apagada a propósito. Un descuento que se enciende solo al generar el proyecto
// es plata que el negocio regala sin haberlo decidido.
const SEMILLA = [{
  nombre: '10% llevando más de $50.000',
  tipo: 'monto', umbral: 50000, modo: 'porcentaje', valor: 10, tope: 0,
  productos: [], desde: '', hasta: '', acumulable: false, activa: false, order: 1,
}];

module.exports = {
  id: 'descuentos', type: 'functional', name: 'Descuentos automáticos',
  description: 'Reglas de descuento que se aplican solas sobre el carrito: por monto ("10% llevando más de $50.000") o por cantidad ("por cada 3 unidades, $1.500 menos"), con vigencia desde/hasta evaluada con la fecha del servidor, tope en pesos y la opción "no acumulable" que corta las reglas siguientes. El subtotal y el descuento los calcula el servidor contra el catálogo real: el navegador dice qué productos y cuántos, nunca cuánto valen. El checkout usa el mismo cálculo, así que lo que se muestra en el carrito es lo que se cobra. Complementa los cupones (código que el visitante tipea); si están activos, el cupón se aplica después. Panel /descuentos-admin.html animado con Anime.js.',
  usesAnime: true,
  requires: ['cart'],
  mounts: [{ route: '/api/descuentos', file: 'routes/descuentos.js' }],
  collections: ['discountrules'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Descuentos', href: '/descuentos-admin.html', id: 'nav-descuentos' }] : [],
  head: () => `  <style>
    .ds-caja{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;margin-bottom:20px}
    .ds-fila{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:.94rem;padding:3px 0}
    .ds-fila.ds-desc{color:#1d6b3c}
    .ds-fila.ds-total{margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:1.05rem}
    .ds-fila strong{font-variant-numeric:tabular-nums}
    .ds-nota{font-size:.8rem;color:var(--muted);margin:8px 0 0}
    .ds-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin:22px 0}
    .ds-kpis .card{text-align:center}
    .ds-kpis strong{display:block;font-size:1.7rem;font-variant-numeric:tabular-nums}
    .ds-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .ds-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .ds-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .ds-chip.venc{background:#c0392b18;color:#c0392b}
    .ds-acc{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .ds-acc .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .ds-sim{border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;background:var(--bg);margin-top:14px}
  </style>`,
  files: (cfg) => ({
    // Cálculo compartido: lo usan la ruta pública (el cartel del carrito) y el checkout del
    // módulo Carrito. Una sola implementación es la única garantía de que lo que se muestra
    // es lo que se cobra.
    'src/descuentos.js': `/**
 * Motor de descuentos automáticos. Lo llaman routes/descuentos.js (para pintar el carrito) y
 * routes/orders.js (para guardar la orden). Una sola implementación a propósito: si el cartel
 * y el checkout calcularan por separado, tarde o temprano dirían cosas distintas.
 */
const db = require('./db');
${cfg.moduleIds.includes('variantes') ? `const V = require('./variantes');
` : ''}
/** Subtotal REAL: los precios salen del catálogo, nunca del cuerpo del pedido. */
async function lineasDe(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const porId = new Map((await db.all('products')).map(p => [p.id, p]));
  const out = [];
  for (const i of items.slice(0, 200)) {
    const p = i && porId.get(i.productId);
    const qty = Math.round(Number(i && i.qty));
    if (!p || !isFinite(qty) || qty < 1 || qty > 99) continue;
${cfg.moduleIds.includes('variantes') ? `    // Con variantes activas el precio de la línea es el del producto MÁS el sobreprecio de la
    // combinación elegida. Si el motor ignorara el delta, el descuento del cartel se calcularía
    // sobre un subtotal distinto al que cobra el checkout y los dos números dejarían de coincidir.
    let unitPrice = Number(p.price) || 0;
    if (i.variantId) {
      const set = await V.cargar(p.id);
      const v = set && set.variantes.find(x => x.id === i.variantId && x.active);
      if (v) unitPrice += v.priceDelta;
    }
    out.push({ productId: p.id, name: p.name, unitPrice, qty });
` : `    out.push({ productId: p.id, name: p.name, unitPrice: Number(p.price) || 0, qty });
`}  }
  return out;
}

/** Fecha de HOY según el servidor (YYYY-MM-DD). Nunca la del navegador: se cambia con dos clics. */
const hoy = () => new Date().toISOString().slice(0, 10);

/** ¿La regla está vigente ahora? Sin fechas cargadas, siempre. */
function vigente(r, dia = hoy()) {
  if (r.desde && String(r.desde) > dia) return false;
  if (r.hasta && String(r.hasta) < dia) return false;
  return true;
}

/** Cuánto descuenta UNA regla. Devuelve pesos (redondeados), nunca negativo. */
function montoDe(r, base, lineas) {
  const valor = Number(r.valor) || 0;
  const umbral = Number(r.umbral) || 0;
  let monto = 0;

  if (r.tipo === 'monto') {
    if (base < umbral) return 0;
    // El porcentaje va SOBRE EL SUBTOTAL ORIGINAL, no sobre lo que quedó de otra regla
    monto = r.modo === 'porcentaje' ? base * valor / 100 : valor;
  } else if (r.tipo === 'cantidad') {
    const ids = Array.isArray(r.productos) ? r.productos : [];
    const califican = lineas.filter(l => (!ids.length || ids.includes(l.productId)) && l.qty >= Math.max(1, umbral));
    if (!califican.length) return 0;
    monto = r.modo === 'porcentaje'
      ? califican.reduce((s, l) => s + l.unitPrice * l.qty, 0) * valor / 100
      // Fijo: un descuento por cada GRUPO completo de \`umbral\` unidades ("cada 3, $1.500 menos")
      : califican.reduce((s, l) => s + Math.floor(l.qty / Math.max(1, umbral)) * valor, 0);
  }

  const tope = Number(r.tope) || 0;
  if (tope > 0) monto = Math.min(monto, tope);
  return Math.max(0, Math.round(Math.min(monto, base)));
}

/**
 * Calcula el carrito completo.
 * @returns {{lineas, subtotal, descuentos:[{id,nombre,monto}], descuento, total}}
 */
async function calcular(items) {
  const lineas = await lineasDe(items);
  const subtotal = Math.round(lineas.reduce((s, l) => s + l.unitPrice * l.qty, 0));
  const reglas = (await db.all('discountrules'))
    .filter(r => r.activa !== false && vigente(r))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  const aplicados = [];
  let acumulado = 0;
  for (const r of reglas) {
    // Ya aplicó una regla exclusiva: las siguientes no se suman
    if (aplicados.length && aplicados[aplicados.length - 1].exclusiva) break;
    const monto = Math.min(montoDe(r, subtotal, lineas), subtotal - acumulado);
    if (monto <= 0) continue;
    acumulado += monto;
    aplicados.push({ id: r.id, nombre: r.nombre, monto, exclusiva: r.acumulable === false });
    if (r.acumulable === false) break;
  }

  return {
    lineas, subtotal,
    descuentos: aplicados.map(({ exclusiva, ...d }) => d),
    descuento: acumulado,
    total: Math.max(0, subtotal - acumulado),
  };
}

module.exports = { calcular, vigente, montoDe, hoy };
`,

    'routes/descuentos.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
const { calcular, vigente } = require('../src/descuentos');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
const TIPOS = ['monto', 'cantidad'];
const MODOS = ['porcentaje', 'fijo'];
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;

db.seedIfEmpty('discountrules', ${JSON.stringify(SEMILLA, null, 2)});

const salida = (r) => ({
  id: r.id, nombre: r.nombre,
  tipo: TIPOS.includes(r.tipo) ? r.tipo : 'monto',
  umbral: Number(r.umbral) || 0,
  modo: MODOS.includes(r.modo) ? r.modo : 'porcentaje',
  valor: Number(r.valor) || 0,
  tope: Number(r.tope) || 0,
  productos: Array.isArray(r.productos) ? r.productos : [],
  desde: r.desde || '', hasta: r.hasta || '',
  acumulable: r.acumulable !== false,
  activa: r.activa !== false,
  order: Number(r.order) || 0,
  // El estado lo decide el servidor con SU fecha: "vencida" no es un campo guardado
  vigente: r.activa !== false && vigente(r),
});

const ordenadas = (rows) => rows.map(salida).sort((a, b) => (a.order - b.order) || String(a.nombre).localeCompare(String(b.nombre)));

function leer(body, parcial) {
  const patch = {};
  if (body.nombre !== undefined || !parcial) {
    if (!str(body.nombre, 3, 80)) return { ok: false, error: 'El nombre va entre 3 y 80 caracteres' };
    patch.nombre = String(body.nombre).trim();
  }
  if (body.tipo !== undefined || !parcial) {
    if (!TIPOS.includes(body.tipo)) return { ok: false, error: 'Tipo inválido (por monto del carrito o por cantidad de unidades)' };
    patch.tipo = body.tipo;
  }
  if (body.modo !== undefined || !parcial) {
    if (!MODOS.includes(body.modo)) return { ok: false, error: 'Modo inválido (porcentaje o monto fijo)' };
    patch.modo = body.modo;
  }
  if (body.umbral !== undefined || !parcial) {
    const n = Number(body.umbral);
    if (!isFinite(n) || n < 1 || n > 100000000) return { ok: false, error: 'El mínimo va entre 1 y 100.000.000' };
    patch.umbral = Math.round(n);
  }
  if (body.valor !== undefined || !parcial) {
    const n = Number(body.valor);
    const modo = patch.modo || body.modo;
    if (!isFinite(n) || n <= 0) return { ok: false, error: 'El descuento tiene que ser mayor que cero' };
    // Un 100% no es un descuento, es un error de tipeo que regala el pedido entero
    if (modo === 'porcentaje' && n > 90) return { ok: false, error: 'El porcentaje no puede pasar de 90' };
    if (modo !== 'porcentaje' && n > 100000000) return { ok: false, error: 'El monto es demasiado grande' };
    patch.valor = modo === 'porcentaje' ? Math.round(n * 100) / 100 : Math.round(n);
  }
  if (body.tope !== undefined) {
    const n = Number(body.tope);
    if (!isFinite(n) || n < 0 || n > 100000000) return { ok: false, error: 'El tope va entre 0 (sin tope) y 100.000.000' };
    patch.tope = Math.round(n);
  }
  if (body.productos !== undefined) {
    const ids = Array.isArray(body.productos) ? body.productos.map(String).slice(0, 200) : [];
    patch.productos = ids;
  }
  for (const campo of ['desde', 'hasta']) {
    if (body[campo] === undefined) continue;
    const v = String(body[campo] || '').trim();
    if (v && !FECHA.test(v)) return { ok: false, error: 'Las fechas van en formato AAAA-MM-DD' };
    patch[campo] = v;
  }
  const desde = patch.desde !== undefined ? patch.desde : body.desde;
  const hasta = patch.hasta !== undefined ? patch.hasta : body.hasta;
  if (desde && hasta && String(desde) > String(hasta)) {
    return { ok: false, error: 'La fecha de inicio no puede ser posterior a la de fin' };
  }
  if (body.acumulable !== undefined) patch.acumulable = !(body.acumulable === false || body.acumulable === 'false');
  if (body.activa !== undefined) patch.activa = !(body.activa === false || body.activa === 'false');
  return { ok: true, patch };
}

// POST /api/descuentos/calcular — público: { items: [{productId, qty}] } → detalle del carrito.
// El cuerpo NO trae precios ni totales: los pone el servidor.
router.post('/calcular', async (req, res) => {
  const r = await calcular(req.body && req.body.items);
  res.json({ subtotal: r.subtotal, descuentos: r.descuentos, descuento: r.descuento, total: r.total });
});

// GET /api/descuentos — público: las promociones vigentes, para poder anunciarlas
router.get('/', async (req, res) => {
  const rows = ordenadas(await db.all('discountrules')).filter(r => r.vigente);
  res.json({ rows: rows.map(r => ({ nombre: r.nombre, tipo: r.tipo, umbral: r.umbral, modo: r.modo, valor: r.valor, hasta: r.hasta })) });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/descuentos/todos — el panel ve también lo apagado y lo vencido
router.get('/todos', requireAdmin, async (req, res) => {
  res.json({ rows: ordenadas(await db.all('discountrules')) });
});

// POST /api/descuentos — alta. La prioridad la decide el servidor: al final de la lista
router.post('/', requireAdmin, async (req, res) => {
  const { ok, error, patch } = leer(req.body || {}, false);
  if (!ok) return res.status(422).json({ error });
  const ultimo = (await db.all('discountrules')).reduce((m, r) => Math.max(m, Number(r.order) || 0), 0);
  const row = await db.insert('discountrules', {
    nombre: patch.nombre, tipo: patch.tipo, umbral: patch.umbral, modo: patch.modo,
    valor: patch.valor, tope: patch.tope || 0, productos: patch.productos || [],
    desde: patch.desde || '', hasta: patch.hasta || '',
    acumulable: patch.acumulable !== false, activa: patch.activa === true, order: ultimo + 1,
  });
  res.status(201).json(salida(row));
});

// PUT /api/descuentos/:id — edición parcial
router.put('/:id', requireAdmin, async (req, res) => {
  const r = await db.get('discountrules', req.params.id);
  if (!r) return res.status(404).json({ error: 'Esa regla no existe' });
  // La validación cruzada de fechas y de porcentaje necesita los valores que NO llegaron
  const mezcla = { ...salida(r), ...(req.body || {}) };
  const { ok, error, patch } = leer(mezcla, false);
  if (!ok) return res.status(422).json({ error });
  res.json(salida(await db.update('discountrules', r.id, patch)));
});

// POST /api/descuentos/:id/mover — cambia la prioridad. Importa: define qué regla aplica primero
// y, si es exclusiva, cuál corta a las demás.
router.post('/:id/mover', requireAdmin, async (req, res) => {
  const dir = req.body && req.body.dir === 'sube' ? -1 : 1;
  const r = await db.get('discountrules', req.params.id);
  if (!r) return res.status(404).json({ error: 'Esa regla no existe' });
  const lista = ordenadas(await db.all('discountrules'));
  const i = lista.findIndex(x => x.id === r.id);
  const j = i + dir;
  if (j < 0 || j >= lista.length) return res.status(409).json({ error: dir < 0 ? 'Ya es la primera' : 'Ya es la última' });
  const nueva = lista.slice();
  nueva[i] = lista[j];
  nueva[j] = lista[i];
  for (let k = 0; k < nueva.length; k++) await db.update('discountrules', nueva[k].id, { order: k + 1 });
  res.json({ rows: ordenadas(await db.all('discountrules')) });
});

// DELETE /api/descuentos/:id — baja definitiva (para pausarla está el interruptor)
router.delete('/:id', requireAdmin, async (req, res) => {
  const r = await db.get('discountrules', req.params.id);
  if (!r) return res.status(404).json({ error: 'Esa regla no existe' });
  await db.remove('discountrules', r.id);
  res.json({ ok: true });
});

// POST /api/descuentos/simular — el admin prueba un carrito imaginario y ve qué reglas aplican.
// Es el mismo motor que el carrito real: no hay forma de que la simulación mienta.
router.post('/simular', requireAdmin, async (req, res) => {
  res.json(await calcular(req.body && req.body.items));
});
` : `// El panel de descuentos requiere el módulo de autenticación. Sin él las reglas viven en
// data/discountrules.json y se editan a mano; el cálculo del carrito funciona igual.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'descuentos-admin': {
      title: 'Descuentos',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('tag', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Descuentos automáticos</h2>
      <p class="section-sub">Promociones que se aplican solas, sin que el cliente tipee ningún código. El subtotal y el descuento los calcula el servidor contra tu catálogo, y el checkout usa el mismo cálculo: lo que ve el visitante es lo que se cobra. Solo visible para administradores.</p>

      <div class="ds-kpis" id="ds-kpis"></div>

      <div class="card" style="margin-bottom:26px">
        <h3 id="ds-form-titulo">Nueva regla</h3>
        <form id="ds-form">
          <label for="ds-nombre">Nombre (lo ve el cliente en el carrito)</label>
          <input id="ds-nombre" name="nombre" required maxlength="80" placeholder="10% llevando más de $50.000">
          <div class="grid cols-2">
            <div>
              <label for="ds-tipo">Cuándo se aplica</label>
              <select id="ds-tipo" name="tipo">
                <option value="monto">Cuando el carrito supera un monto</option>
                <option value="cantidad">Cuando se llevan varias unidades de un producto</option>
              </select>
            </div>
            <div><label for="ds-umbral" id="ds-umbral-label">Monto mínimo del carrito</label><input id="ds-umbral" name="umbral" type="number" min="1" step="1" required></div>
          </div>
          <div class="grid cols-2">
            <div>
              <label for="ds-modo">Descuento</label>
              <select id="ds-modo" name="modo">
                <option value="porcentaje">Porcentaje</option>
                <option value="fijo">Monto fijo en pesos</option>
              </select>
            </div>
            <div><label for="ds-valor" id="ds-valor-label">Porcentaje (1 a 90)</label><input id="ds-valor" name="valor" type="number" min="0.01" step="0.01" required></div>
          </div>
          <div class="grid cols-3">
            <div><label for="ds-tope">Tope en pesos (0 = sin tope)</label><input id="ds-tope" name="tope" type="number" min="0" step="1" value="0"></div>
            <div><label for="ds-desde">Desde (opcional)</label><input id="ds-desde" name="desde" type="date"></div>
            <div><label for="ds-hasta">Hasta (opcional)</label><input id="ds-hasta" name="hasta" type="date"></div>
          </div>
          <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:14px">
            <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="ds-acum" style="width:auto;margin:0" checked> Se puede combinar con otras reglas</label>
            <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="ds-activa" style="width:auto;margin:0"> Activa</label>
          </div>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="ds-guardar">Crear regla</button>
            <button class="btn ghost" type="button" id="ds-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>

      <div id="ds-lista"><p class="muted">Cargando…</p></div>

      <h3 style="margin-top:34px">Probar un carrito</h3>
      <p class="muted" style="margin-top:0">Elegí productos y cantidades: el resultado lo calcula el mismo motor que usa el sitio.</p>
      <div class="ds-sim">
        <div id="ds-sim-items"><p class="muted">Cargando catálogo…</p></div>
        <button class="btn ghost" type="button" id="ds-sim-btn" style="width:auto;margin-top:12px">Calcular</button>
        <div id="ds-sim-out" style="margin-top:14px"></div>
      </div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo descuentos automáticos: le pide al servidor el detalle del carrito y lo muestra arriba
   del panel del carrito. El cálculo NUNCA se hace acá: el navegador manda qué productos y cuántos,
   el servidor devuelve subtotal, descuentos y total. Escucha 'wf:cart' del módulo Carrito.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel de reglas vive en /descuentos-admin.html.` : ''}
   Anime.js para la aparición, con red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function aparecer(nodo) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) return;
    anime.animate(nodo, { opacity: [0, 1], translateY: [8, 0], duration: 380, ease: 'outCubic' });
    // Red de seguridad: Anime.js pausa su loop con la pestaña oculta
    setTimeout(function () { nodo.style.opacity = 1; nodo.style.transform = 'none'; }, 700);
  }

  // ---- Caja pública (página del catálogo) ----
  var panel = document.getElementById('cart-panel');
  if (panel) {
    var caja = document.createElement('div');
    caja.className = 'ds-caja';
    caja.style.display = 'none';
    // Se inserta ANTES del panel del carrito, dentro de su mismo contenedor: no depende de
    // ningún :nth-child del módulo Carrito, sólo de que el panel exista.
    panel.parentNode.insertBefore(caja, panel);
    var pidiendo = false;
    var pendiente = null;

    function pintar(r) {
      if (!r || !r.descuentos || !r.descuentos.length) { caja.style.display = 'none'; return; }
      caja.style.display = '';
      caja.innerHTML = '<div class="ds-fila"><span>Subtotal</span><strong>' + App.money(r.subtotal) + '</strong></div>' +
        r.descuentos.map(function (d) {
          return '<div class="ds-fila ds-desc"><span>' + App.esc(d.nombre) + '</span><strong>− ' + App.money(d.monto) + '</strong></div>';
        }).join('') +
        '<div class="ds-fila ds-total"><span>Total con descuento</span><strong>' + App.money(r.total) + '</strong></div>' +
        '<p class="ds-nota">El descuento ya está aplicado: es el importe que se cobra al finalizar la compra.</p>';
      aparecer(caja);
    }

    // Se guarda SIEMPRE el último estado del carrito y, si ya hay una consulta en curso, se
    // atiende al terminar. Descartar los eventos que llegan mientras se consulta parece una
    // optimización y es un error: agregar seis unidades seguidas dispara seis eventos, y la caja
    // se quedaría mostrando el descuento de la primera. En un módulo cuyo trabajo es que el
    // número sea cierto, un número viejo es peor que ninguno.
    function actualizar(items) {
      pendiente = items || [];
      if (!pidiendo) correr();
    }

    async function correr() {
      pidiendo = true;
      try {
        while (pendiente) {
          var items = pendiente;
          pendiente = null;
          if (!items.length) { caja.style.display = 'none'; continue; }
          if (window.__PREVIEW__) {
            var demo = items.reduce(function (s, i) { return s + i.qty * 4999; }, 0);
            if (demo < 50000) { caja.style.display = 'none'; continue; }
            pintar({ subtotal: demo, descuentos: [{ nombre: '10% llevando más de $50.000', monto: Math.round(demo * 0.1) }], total: demo - Math.round(demo * 0.1) });
            continue;
          }
          try { pintar(await App.api('/api/descuentos/calcular', { method: 'POST', body: { items: items } })); }
          catch (err) { caja.style.display = 'none'; }
        }
      } finally { pidiendo = false; }
    }

    document.addEventListener('wf:cart', function (e) { actualizar(e.detail); });
    // Si el carrito ya tenía cosas antes de enganchar el listener, arrancamos con eso
    try { actualizar(JSON.parse(localStorage.getItem('cart') || '[]')); } catch (e) {}
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /descuentos-admin.html ----
  var form = document.getElementById('ds-form');
  var box = document.getElementById('ds-lista');
  if (form && box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var editando = '';
    var productos = [];
    var SUBIR = ${JSON.stringify(phIcon('arrow-up', { size: 14 }))};
    var BAJAR = ${JSON.stringify(phIcon('arrow-down', { size: 14 }))};

    function contar(el, hasta, money) {
      if (!el) return;
      var fmt = function (v) { return money ? App.money(Math.round(v)) : Math.round(v).toLocaleString('es-AR'); };
      var anime = window.anime;
      if (!anime || !anime.animate || reduce) { el.textContent = fmt(hasta); return; }
      var st = { v: 0 };
      anime.animate(st, { v: hasta, duration: 620, ease: 'outCubic', onUpdate: function () { el.textContent = fmt(st.v); } });
      setTimeout(function () { el.textContent = fmt(hasta); }, 820);
    }

    // Las etiquetas cambian según el tipo: "monto mínimo" y "cantidad mínima" no son lo mismo
    function ajustarCampos() {
      var tipo = form.querySelector('[name="tipo"]').value;
      var modo = form.querySelector('[name="modo"]').value;
      document.getElementById('ds-umbral-label').textContent = tipo === 'monto'
        ? 'Monto mínimo del carrito' : 'Cantidad mínima de unidades del mismo producto';
      document.getElementById('ds-valor-label').textContent = modo === 'porcentaje'
        ? 'Porcentaje (1 a 90)'
        : (tipo === 'cantidad' ? 'Pesos por cada grupo de esa cantidad' : 'Pesos de descuento');
    }

    function textoRegla(r) {
      var cuanto = r.modo === 'porcentaje' ? r.valor + '%' : App.money(r.valor);
      return r.tipo === 'monto'
        ? cuanto + ' cuando el carrito supera ' + App.money(r.umbral)
        : cuanto + ' llevando ' + r.umbral + ' o más unidades del mismo producto';
    }

    function pintarKpis() {
      var kpis = document.getElementById('ds-kpis');
      kpis.innerHTML = '<div class="card"><strong id="ds-k-act">0</strong><span class="muted">reglas vigentes</span></div>' +
        '<div class="card"><strong id="ds-k-tot">0</strong><span class="muted">reglas cargadas</span></div>' +
        '<div class="card"><strong id="ds-k-max">0</strong><span class="muted">mayor descuento configurado</span></div>';
      contar(document.getElementById('ds-k-act'), lista.filter(function (r) { return r.vigente; }).length);
      contar(document.getElementById('ds-k-tot'), lista.length);
      var maxPct = lista.reduce(function (m, r) { return r.modo === 'porcentaje' ? Math.max(m, r.valor) : m; }, 0);
      var el = document.getElementById('ds-k-max');
      if (el) el.textContent = maxPct ? maxPct + '%' : '—';
    }

    function salirDeEdicion() {
      editando = '';
      form.reset();
      document.getElementById('ds-acum').checked = true;
      document.getElementById('ds-activa').checked = false;
      document.getElementById('ds-tope').value = '0';
      ajustarCampos();
      document.getElementById('ds-form-titulo').textContent = 'Nueva regla';
      document.getElementById('ds-guardar').textContent = 'Crear regla';
      document.getElementById('ds-cancelar').hidden = true;
    }

    function editar(r) {
      editando = r.id;
      form.querySelector('[name="nombre"]').value = r.nombre;
      form.querySelector('[name="tipo"]').value = r.tipo;
      form.querySelector('[name="modo"]').value = r.modo;
      form.querySelector('[name="umbral"]').value = r.umbral;
      form.querySelector('[name="valor"]').value = r.valor;
      form.querySelector('[name="tope"]').value = r.tope || 0;
      form.querySelector('[name="desde"]').value = r.desde || '';
      form.querySelector('[name="hasta"]').value = r.hasta || '';
      document.getElementById('ds-acum').checked = r.acumulable !== false;
      document.getElementById('ds-activa').checked = !!r.activa;
      ajustarCampos();
      document.getElementById('ds-form-titulo').textContent = 'Editando: ' + r.nombre;
      document.getElementById('ds-guardar').textContent = 'Guardar cambios';
      document.getElementById('ds-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function pintarTabla() {
      box.innerHTML = App.table(lista, [
        { label: 'Regla', render: function (r) {
          return '<strong>' + App.esc(r.nombre) + '</strong><br><span class="muted" style="font-size:.82rem">' + App.esc(textoRegla(r)) + '</span>' +
            (r.tope ? '<br><span class="muted" style="font-size:.78rem">tope ' + App.money(r.tope) + '</span>' : '');
        } },
        { label: 'Vigencia', render: function (r) {
          if (!r.desde && !r.hasta) return '<span class="muted">Siempre</span>';
          return '<span class="muted" style="font-size:.82rem">' + App.esc((r.desde || 'desde siempre') + ' → ' + (r.hasta || 'sin fin')) + '</span>';
        } },
        { label: 'Estado', render: function (r) {
          if (!r.activa) return '<span class="ds-chip off">Pausada</span>';
          if (!r.vigente) return '<span class="ds-chip venc">Fuera de fecha</span>';
          return '<span class="ds-chip on">Vigente</span>' + (r.acumulable ? '' : ' <span class="ds-chip off">Exclusiva</span>');
        } },
        { label: '', render: function (r) {
          return '<span class="ds-acc">' +
            '<button class="btn ghost" type="button" aria-label="Subir prioridad" title="Subir prioridad" data-ds-sube="' + r.id + '">' + SUBIR + '</button>' +
            '<button class="btn ghost" type="button" aria-label="Bajar prioridad" title="Bajar prioridad" data-ds-baja="' + r.id + '">' + BAJAR + '</button>' +
            '<button class="btn ghost" type="button" data-ds-edit="' + r.id + '">Editar</button>' +
            '<button class="btn ghost" type="button" data-ds-act="' + r.id + '">' + (r.activa ? 'Pausar' : 'Activar') + '</button>' +
            '<button class="btn ghost" type="button" data-ds-del="' + r.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-ds-edit]').forEach(function (b) {
        b.addEventListener('click', function () { var r = buscar(b.getAttribute('data-ds-edit')); if (r) editar(r); });
      });
      box.querySelectorAll('[data-ds-sube]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-ds-sube'), 'sube'); });
      });
      box.querySelectorAll('[data-ds-baja]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-ds-baja'), 'baja'); });
      });
      box.querySelectorAll('[data-ds-act]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var r = buscar(b.getAttribute('data-ds-act'));
          if (!r) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se activaría o pausaría la regla'); return; }
          try {
            await App.api('/api/descuentos/' + r.id, { method: 'PUT', body: { activa: !r.activa } });
            App.toast(r.activa ? 'Regla pausada' : 'Regla activa');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-ds-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar esta regla? Si sólo querés frenarla, usá "Pausar".')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/descuentos/' + b.getAttribute('data-ds-del'), { method: 'DELETE' });
            App.toast('Regla borrada');
            if (editando === b.getAttribute('data-ds-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      pintarKpis();
    }

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la prioridad'); return; }
      try {
        var out = await App.api('/api/descuentos/' + id + '/mover', { method: 'POST', body: { dir: dir } });
        lista = out.rows;
        pintarTabla();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    var DEMO = ${JSON.stringify(SEMILLA.map((r, i) => ({ id: 'd' + (i + 1), ...r, vigente: false })))};

    async function cargar() {
      if (window.__PREVIEW__) { lista = DEMO.slice(); pintarTabla(); return; }
      try {
        var out = await App.api('/api/descuentos/todos');
        lista = out.rows;
        pintarTabla();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    // ---- Simulador: mismo motor que el carrito real ----
    async function cargarProductos() {
      var cont = document.getElementById('ds-sim-items');
      if (!cont) return;
      if (window.__PREVIEW__) {
        cont.innerHTML = '<p class="muted">Vista previa: acá se elige un carrito de prueba.</p>';
        return;
      }
      try {
        productos = await App.api('/api/products');
        cont.innerHTML = productos.slice(0, 8).map(function (p) {
          return '<label style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
            '<input type="number" min="0" max="99" value="0" data-ds-qty="' + p.id + '" style="width:80px;margin:0">' +
            '<span>' + App.esc(p.name) + ' <span class="muted">' + App.money(p.price) + '</span></span></label>';
        }).join('') || '<p class="muted">Todavía no hay productos en el catálogo.</p>';
      } catch (err) { cont.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; }
    }

    document.getElementById('ds-sim-btn').addEventListener('click', async function () {
      var out = document.getElementById('ds-sim-out');
      if (window.__PREVIEW__) { out.innerHTML = '<p class="muted">Vista previa: acá aparece el detalle calculado por el servidor.</p>'; return; }
      var items = [];
      document.querySelectorAll('[data-ds-qty]').forEach(function (el) {
        var q = Number(el.value) || 0;
        if (q > 0) items.push({ productId: el.getAttribute('data-ds-qty'), qty: q });
      });
      if (!items.length) { App.toast('Elegí al menos un producto'); return; }
      try {
        var r = await App.api('/api/descuentos/simular', { method: 'POST', body: { items: items } });
        out.innerHTML = '<div class="ds-fila"><span>Subtotal</span><strong>' + App.money(r.subtotal) + '</strong></div>' +
          (r.descuentos.length ? r.descuentos.map(function (d) {
            return '<div class="ds-fila ds-desc"><span>' + App.esc(d.nombre) + '</span><strong>− ' + App.money(d.monto) + '</strong></div>';
          }).join('') : '<div class="ds-fila"><span class="muted">Ninguna regla aplica a este carrito</span><span></span></div>') +
          '<div class="ds-fila ds-total"><span>Total</span><strong>' + App.money(r.total) + '</strong></div>';
        aparecer(out);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    form.querySelector('[name="tipo"]').addEventListener('change', ajustarCampos);
    form.querySelector('[name="modo"]').addEventListener('change', ajustarCampos);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        nombre: form.querySelector('[name="nombre"]').value,
        tipo: form.querySelector('[name="tipo"]').value,
        modo: form.querySelector('[name="modo"]').value,
        umbral: Number(form.querySelector('[name="umbral"]').value),
        valor: Number(form.querySelector('[name="valor"]').value),
        tope: Number(form.querySelector('[name="tope"]').value) || 0,
        desde: form.querySelector('[name="desde"]').value,
        hasta: form.querySelector('[name="hasta"]').value,
        acumulable: document.getElementById('ds-acum').checked,
        activa: document.getElementById('ds-activa').checked,
      };
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la regla'); return; }
      try {
        if (editando) await App.api('/api/descuentos/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/descuentos', { method: 'POST', body: datos });
        App.toast(editando ? 'Regla actualizada' : 'Regla creada');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    document.getElementById('ds-cancelar').addEventListener('click', salirDeEdicion);

    ajustarCampos();
    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      form.style.display = 'none';
    } else {
      cargar();
      cargarProductos();
      aparecer(form);
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navD = document.getElementById('nav-descuentos');
    if (navD && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navD.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Descuentos automáticos**: las reglas viven en \`data/discountrules.json\` (colección \`discountrules\`) y se aplican solas sobre el carrito, **sin código que el cliente tenga que tipear**. El cálculo lo hace el servidor (\`src/descuentos.js\`) contra el catálogo real, y **el checkout usa exactamente el mismo motor**: lo que se muestra en el carrito es lo que se cobra. Los porcentajes se aplican siempre **sobre el subtotal original**, nunca en cascada (dos reglas del 10% descuentan 20%), y una regla marcada **exclusiva** corta las siguientes. Viene sembrada **una regla de ejemplo pausada**: no descuenta nada hasta que la actives${cfg.moduleIds.includes('auth') ? ' desde `/descuentos-admin.html`' : ' (activá el módulo **Autenticación** para tener panel; sin él se edita el JSON a mano)'}.${cfg.moduleIds.includes('coupons') ? ' Con **Cupones** activo, el cupón se aplica **después** de los descuentos automáticos, sobre el importe ya rebajado.' : ''}`,
  ],
};
