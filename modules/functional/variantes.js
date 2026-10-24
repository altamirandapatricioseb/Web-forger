// Variantes de producto (talle, color, sabor, medida…): el último agujero grande que le quedaba al
// e-commerce del catálogo. Hasta acá un producto era UNA cosa con UN precio y UN stock. Una remera
// con cuatro talles obligaba a cargar cuatro productos distintos, con lo que el cliente veía cuatro
// tarjetas casi iguales en el catálogo, la ficha no tenía selector, y el negocio no podía saber
// "cuántas remeras vendí" sin sumar a mano.
//
// Tres decisiones definen el módulo:
//
//   1. EL STOCK DE LA VARIANTE MANDA, Y EL DEL PRODUCTO ES SU ESPEJO. Cada vez que cambia el stock
//      de una variante, el módulo reescribe `products.stock` con la SUMA de sus variantes. No es
//      redundancia decorativa: gracias a eso todo lo que ya existía —la disponibilidad de la ficha,
//      el "solo con stock" de la tienda, el chip de "quedan 3" del catálogo, la validación del
//      checkout y la reposición al cancelar— sigue funcionando sin enterarse de las variantes. El
//      control fino se agrega ARRIBA de esas reglas, no en lugar de ellas.
//   2. EL ID DE LA VARIANTE ES DETERMINISTA (`talle-m__color-azul`), derivado de sus opciones. Si
//      fuera aleatorio, regenerar la matriz de combinaciones —algo que pasa cada vez que se agrega
//      un talle— cambiaría los ids y dejaría huérfanos los carritos y los pedidos que ya la
//      referencian. Con la clave derivada, agregar un talle deja intactas las combinaciones
//      anteriores, con su stock y su SKU.
//   3. EL PRECIO DE LA VARIANTE ES UNA DIFERENCIA, NO UN PRECIO. Se guarda `priceDelta` (+$500 el
//      talle XL) y el precio final lo calcula SIEMPRE el servidor sumando al precio del producto.
//      Guardar precios absolutos por variante hace que un aumento general del 10% haya que
//      aplicarlo variante por variante, y que el precio tachado deje de tener sentido.
//
// La ficha se sirve armada por el servidor (módulo Página de producto) y el selector lo agrega este
// módulo del lado del cliente: es una interacción, no contenido indexable, y así la ficha no tiene
// que saber que las variantes existen. Lo que sí sabe la ficha es que si el producto REQUIERE una
// variante y no hay ninguna elegida, no deja agregar al carrito.
//
// Animado con Anime.js: las opciones entran con stagger y el precio hace un pop al cambiar de
// variante, con la red de seguridad de siempre por si el loop está pausado (pestaña oculta).
const { phIcon } = require('../../src/icons');

// Semilla: se le ponen talles al primer producto sembrado REPARTIENDO su stock (25 = 8+9+8), no
// sumando unidades nuevas. Si la semilla inventara stock, el catálogo arrancaría diciendo que hay
// más mercadería de la que decía antes de activar el módulo.
const SEMILLA_EJES = [{ nombre: 'Talle', valores: ['S', 'M', 'L'] }];
const SEMILLA_STOCK = { 'talle-s': 8, 'talle-m': 9, 'talle-l': 8 };

module.exports = {
  id: 'variantes', type: 'functional', name: 'Variantes de producto',
  description: 'Talle, color, sabor o medida: un mismo producto con varias combinaciones, cada una con su SKU, su diferencia de precio y su stock propio. El panel define los ejes (hasta 3) y genera la matriz de combinaciones conservando el stock y el SKU de las que ya existían. La ficha suma el selector de opciones, el precio y la disponibilidad se actualizan al elegir, el carrito guarda qué combinación se compró y el checkout valida y descuenta el stock DE ESA VARIANTE; cancelar el pedido lo repone. El stock del producto se mantiene como la suma de sus variantes, así la tienda, el catálogo y los avisos de stock siguen funcionando sin cambios. Animado con Anime.js.',
  usesAnime: true,
  requires: ['products-admin', 'cart', 'auth'],
  mounts: [{ route: '/api/variantes', file: 'routes/variantes.js' }],
  collections: ['variantsets'],
  nav: () => [{ label: 'Variantes', href: '/variantes-admin.html', id: 'nav-variantes' }],
  head: () => `  <style>
    .va-sel{margin:0 0 18px}
    .va-eje{margin-bottom:13px}
    .va-eje > span{display:block;font-size:.82rem;color:var(--muted);margin-bottom:6px;letter-spacing:.02em}
    .va-ops{display:flex;gap:8px;flex-wrap:wrap}
    .va-op{border:1px solid var(--line);background:var(--surface);color:inherit;border-radius:999px;padding:7px 15px;font:inherit;font-size:.88rem;cursor:pointer;line-height:1.2}
    .va-op[aria-pressed="true"]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface));font-weight:600}
    .va-op[data-agotada="1"]{opacity:.42;text-decoration:line-through;cursor:not-allowed}
    .va-op:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    .va-aviso{font-size:.86rem;color:var(--muted);margin:2px 0 0}
    .va-tabla{width:100%;border-collapse:collapse;margin-top:14px;font-size:.88rem}
    .va-tabla th,.va-tabla td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
    .va-tabla th{font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600}
    .va-tabla input{margin:0;width:100%;min-width:74px}
    .va-tabla input[type="checkbox"]{width:auto}
    .va-tabla td.va-num{width:110px}
    .va-chip{display:inline-block;font-size:.71rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .va-chip.ok{background:#2e9e5b20;color:#1d6b3c}
    .va-chip.sin{background:#c0392b18;color:#c0392b}
    .va-ejes-edit{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2.2fr) auto;gap:10px;align-items:end;margin-bottom:9px}
    .va-ejes-edit input{margin:0}
    @media (max-width:700px){.va-ejes-edit{grid-template-columns:1fr}}
    .va-total{font-variant-numeric:tabular-nums;font-weight:700}
  </style>`,
  files: (cfg) => ({
    // Motor compartido: lo usan las rutas de este módulo, el checkout (routes/orders.js) y la
    // cancelación de pedidos (routes/pedidos.js). Un único lugar donde vive la regla de qué se
    // puede vender y cuánto sale, para que los tres digan lo mismo.
    'src/variantes.js': `/**
 * Variantes de producto: motor compartido.
 *
 * Regla central: el stock de la VARIANTE es el dato real y \`products.stock\` es su espejo (la
 * suma). Todo lo que ya consultaba el stock del producto —la ficha, la tienda, el catálogo, el
 * checkout, los avisos de "avisame cuando vuelva"— sigue funcionando sin saber que existen las
 * variantes, porque el número que lee sigue siendo cierto.
 */
const db = require('./db');

/** Clave de una opción o de un eje, sin acentos ni mayúsculas: es lo que forma el id determinista. */
const clave = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD')
  .replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 24) || 'x';

/** Id determinista de una combinación: derivarlo de las opciones (y no sortearlo) es lo que hace
 *  que regenerar la matriz al agregar un talle NO deje huérfanos los carritos ni los pedidos. */
const idVariante = (ejes, opciones) =>
  ejes.map(e => clave(e.nombre) + '-' + clave(opciones[e.nombre])).join('__');

/** Etiqueta legible: "Talle M · Color Azul". Es lo que se guarda en el item del pedido. */
const etiqueta = (ejes, opciones) =>
  ejes.map(e => e.nombre + ' ' + opciones[e.nombre]).join(' · ');

/** Vista normalizada del conjunto de variantes de un producto (defaults para filas viejas). */
function vista(set) {
  if (!set) return null;
  const ejes = (Array.isArray(set.ejes) ? set.ejes : [])
    .map(e => ({ nombre: String(e && e.nombre || '').slice(0, 30), valores: (Array.isArray(e && e.valores) ? e.valores : []).map(v => String(v).slice(0, 40)) }))
    .filter(e => e.nombre && e.valores.length);
  const variantes = (Array.isArray(set.variantes) ? set.variantes : []).map(v => ({
    id: String(v.id || ''),
    opciones: v.opciones && typeof v.opciones === 'object' ? v.opciones : {},
    etiqueta: v.etiqueta || '',
    sku: String(v.sku || ''),
    priceDelta: Number(v.priceDelta) || 0,
    stock: Math.max(0, Math.round(Number(v.stock) || 0)),
    active: v.active !== false,
  })).filter(v => v.id);
  return { id: set.id, productId: set.productId, ejes, variantes };
}

/** El conjunto de variantes de un producto, o null si no tiene. */
async function cargar(productId) {
  const rows = await db.find('variantsets', s => s.productId === productId);
  return vista(rows[0] || null);
}

/** ¿Este producto obliga a elegir una variante? Sólo si tiene ejes Y alguna combinación activa. */
async function requiere(productId) {
  const set = await cargar(productId);
  return !!(set && set.ejes.length && set.variantes.some(v => v.active));
}

/**
 * Resuelve una variante para el checkout: existe, es de ESE producto, está activa y alcanza el
 * stock. Devuelve además el sobreprecio, que es lo que el servidor le suma al precio del producto
 * (el navegador nunca manda importes).
 */
async function resolver(productId, variantId, qty) {
  const set = await cargar(productId);
  const obliga = !!(set && set.ejes.length && set.variantes.some(v => v.active));
  if (!obliga) {
    // El producto no maneja variantes: si igual vino una, es un carrito viejo o adulterado
    if (variantId) return { ok: false, error: 'Ese producto ya no se vende por variantes' };
    return { ok: true, variantId: null, label: '', priceDelta: 0 };
  }
  if (!variantId) return { ok: false, error: 'Elegí una opción antes de comprar' };
  const v = set.variantes.find(x => x.id === variantId && x.active);
  if (!v) return { ok: false, error: 'Esa opción ya no está disponible' };
  if (v.stock < qty) return { ok: false, error: 'Quedan ' + v.stock + ' unidades de ' + (v.etiqueta || v.id), disponible: v.stock };
  return { ok: true, variantId: v.id, label: v.etiqueta || v.id, priceDelta: v.priceDelta };
}

/** Reescribe products.stock con la suma de las variantes activas. El espejo que sostiene todo. */
async function sincronizar(productId, set) {
  const s = set || (await cargar(productId));
  if (!s || !s.ejes.length || !s.variantes.length) return null;
  const total = s.variantes.filter(v => v.active).reduce((n, v) => n + v.stock, 0);
  const p = await db.get('products', productId);
  if (!p) return total;
  // trackStock queda encendido a la fuerza: un producto con variantes que no controla stock haría
  // que el checkout venda combinaciones agotadas sin mirar el número de la variante.
  if (Number(p.stock) !== total || p.trackStock === false) {
    await db.update('products', productId, { stock: total, trackStock: true });
  }
  return total;
}

/** Mueve el stock de UNA variante y sincroniza el producto. delta negativo = venta. */
async function mover(productId, variantId, delta, motivo, usuario) {
  const rows = await db.find('variantsets', s => s.productId === productId);
  const row = rows[0];
  if (!row) return null;
  const variantes = (Array.isArray(row.variantes) ? row.variantes : []).map(v => {
    if (v.id !== variantId) return v;
    return { ...v, stock: Math.max(0, Math.round((Number(v.stock) || 0) + delta)) };
  });
  const guardado = await db.update('variantsets', row.id, { variantes });
  const set = vista(guardado);
  const v = set.variantes.find(x => x.id === variantId);
  await sincronizar(productId, set);
  if (motivo) {
    await db.insert('stockmoves', {
      productId, variantId, variantLabel: (v && v.etiqueta) || variantId,
      delta: Math.round(delta), motivo, usuario: usuario || '',
      resultado: v ? v.stock : 0,
    });
  }
  return v || null;
}

module.exports = { clave, idVariante, etiqueta, vista, cargar, requiere, resolver, sincronizar, mover };
`,
    'routes/variantes.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');
const V = require('../src/variantes');

const TOPE_EJES = 3;
const TOPE_COMBINACIONES = 120;

// Semilla: le pone talles al primer producto sembrado REPARTIENDO su stock, no sumándolo. Una
// semilla que inventa mercadería hace que el catálogo arranque mintiendo.
async function sembrar() {
  if ((await db.all('variantsets')).length) return;
  const productos = await db.all('products');
  const p = productos[0];
  if (!p) return;
  const ejes = ${JSON.stringify(SEMILLA_EJES)};
  const stocks = ${JSON.stringify(SEMILLA_STOCK)};
  const variantes = ejes[0].valores.map(valor => {
    const opciones = { [ejes[0].nombre]: valor };
    const id = V.idVariante(ejes, opciones);
    return { id, opciones, etiqueta: V.etiqueta(ejes, opciones), sku: (p.sku || '') + '-' + valor, priceDelta: 0, stock: Number(stocks[id]) || 0, active: true };
  });
  await db.insert('variantsets', { productId: p.id, ejes, variantes });
  await V.sincronizar(p.id);
}
sembrar().catch(() => {});

/** Combinaciones de los ejes (producto cartesiano), en orden estable. */
function combinaciones(ejes) {
  let filas = [{}];
  for (const eje of ejes) {
    const siguiente = [];
    for (const fila of filas) for (const valor of eje.valores) siguiente.push({ ...fila, [eje.nombre]: valor });
    filas = siguiente;
    if (filas.length > TOPE_COMBINACIONES) return null;
  }
  return filas;
}

/** Lee ejes del cuerpo: nombres únicos, valores únicos y no vacíos. */
function leerEjes(body) {
  const crudos = Array.isArray(body && body.ejes) ? body.ejes : null;
  if (!crudos) return { ok: false, error: 'Mandá la lista de ejes' };
  if (crudos.length > TOPE_EJES) return { ok: false, error: 'Hasta ' + TOPE_EJES + ' ejes por producto (talle, color, medida)' };
  const ejes = [];
  const vistos = new Set();
  for (const e of crudos) {
    const nombre = String((e && e.nombre) || '').trim().slice(0, 30);
    if (!nombre) continue;
    if (vistos.has(nombre.toLowerCase())) return { ok: false, error: 'Hay dos ejes con el mismo nombre: ' + nombre };
    vistos.add(nombre.toLowerCase());
    const valores = [];
    const vv = new Set();
    for (const v of (Array.isArray(e.valores) ? e.valores : [])) {
      const val = String(v).trim().slice(0, 40);
      if (!val || vv.has(val.toLowerCase())) continue;
      vv.add(val.toLowerCase());
      valores.push(val);
    }
    if (!valores.length) return { ok: false, error: 'El eje "' + nombre + '" no tiene ningún valor' };
    if (valores.length > 40) return { ok: false, error: 'El eje "' + nombre + '" tiene demasiados valores (máximo 40)' };
    ejes.push({ nombre, valores });
  }
  return { ok: true, ejes };
}

// ---------- público ----------

// GET /api/variantes/indice — índice liviano para el carrito y el catálogo. Dice qué productos
// obligan a elegir variante (para que la tarjeta lleve a la ficha en vez de agregar a ciegas) y
// cómo se llama y cuánto suma cada combinación (para pintar el carrito). Nunca es la fuente del
// precio: eso lo decide el servidor al confirmar.
router.get('/indice', async (req, res) => {
  const activos = new Map((await db.all('products')).filter(p => p.active !== false).map(p => [p.id, p]));
  const productos = {};
  const variantes = {};
  for (const set of (await db.all('variantsets')).map(V.vista)) {
    const p = activos.get(set.productId);
    if (!p || !set.ejes.length) continue;
    const vivas = set.variantes.filter(v => v.active);
    if (!vivas.length) continue;
    productos[set.productId] = { slug: p.slug || '', opciones: set.ejes.map(e => e.nombre).join(' / ') };
    for (const v of vivas) {
      variantes[v.id] = { productId: set.productId, label: v.etiqueta || v.id, priceDelta: v.priceDelta, stock: v.stock };
    }
  }
  res.json({ productos, variantes });
});

// GET /api/variantes/admin/todo — resumen para el panel (va antes de /:productId a propósito)
router.get('/admin/todo', requireAdmin, async (req, res) => {
  const productos = (await db.all('products')).map(p => ({ id: p.id, name: p.name, sku: p.sku || '', price: Number(p.price) || 0, active: p.active !== false }));
  const sets = (await db.all('variantsets')).map(V.vista);
  res.json({
    productos,
    sets: sets.map(s => ({
      productId: s.productId, ejes: s.ejes, variantes: s.variantes,
      total: s.variantes.filter(v => v.active).reduce((n, v) => n + v.stock, 0),
    })),
  });
});

// GET /api/variantes/:productId — las combinaciones vendibles de un producto (público)
router.get('/:productId', async (req, res) => {
  const p = await db.get('products', req.params.productId);
  if (!p || p.active === false) return res.status(404).json({ error: 'Ese producto no existe' });
  const set = await V.cargar(p.id);
  if (!set || !set.ejes.length) return res.json({ productId: p.id, ejes: [], variantes: [] });
  res.json({
    productId: p.id,
    precioBase: Number(p.price) || 0,
    ejes: set.ejes,
    variantes: set.variantes.filter(v => v.active).map(v => ({
      id: v.id, opciones: v.opciones, etiqueta: v.etiqueta,
      priceDelta: v.priceDelta, stock: v.stock, comprable: v.stock > 0,
    })),
  });
});

// ---------- administración ----------

// PUT /api/variantes/:productId — define los ejes y regenera la matriz CONSERVANDO lo cargado.
// Es la operación central: agregar un talle no puede borrar el stock de los talles que ya estaban.
router.put('/:productId', requireAdmin, async (req, res) => {
  const p = await db.get('products', req.params.productId);
  if (!p) return res.status(404).json({ error: 'Ese producto no existe' });
  const leido = leerEjes(req.body || {});
  if (!leido.ok) return res.status(422).json({ error: leido.error });
  const ejes = leido.ejes;

  const rows = await db.find('variantsets', s => s.productId === p.id);
  const anterior = V.vista(rows[0] || null);
  const previas = new Map((anterior ? anterior.variantes : []).map(v => [v.id, v]));

  if (!ejes.length) {
    // Sin ejes el producto vuelve a ser uno solo: se borra el conjunto y el stock del producto
    // queda como estaba (deja de ser un espejo y vuelve a ser el dato).
    if (rows[0]) await db.remove('variantsets', rows[0].id);
    return res.json({ productId: p.id, ejes: [], variantes: [] });
  }

  const filas = combinaciones(ejes);
  if (!filas) return res.status(422).json({ error: 'Esa combinación de ejes da más de ' + TOPE_COMBINACIONES + ' variantes. Reducí los valores.' });

  // Agregar un TALLE conserva las combinaciones anteriores (el id se deriva de las opciones), pero
  // agregar un EJE nuevo o renombrar uno cambia todos los ids: "Talle M" y "Talle M / Color Azul"
  // no son la misma cosa, y no hay forma de saber cuántas de las 9 unidades de M eran azules. En
  // vez de repartir a ojo o borrar en silencio, se corta y se avisa qué stock se va a perder. El
  // cliente confirma con los números a la vista.
  const nuevos = new Set(filas.map(o => V.idVariante(ejes, o)));
  const huerfanas = [...previas.values()].filter(v => !nuevos.has(v.id) && v.stock > 0);
  if (huerfanas.length && !(req.body && req.body.confirmar)) {
    return res.status(409).json({
      error: 'Este cambio deja sin lugar a ' + huerfanas.length + ' combinación(es) que todavía tienen stock: ' +
        huerfanas.map(v => (v.etiqueta || v.id) + ' (' + v.stock + ')').join(', ') +
        '. Volvé a mandarlo confirmando si querés seguir.',
      huerfanas: huerfanas.map(v => ({ id: v.id, etiqueta: v.etiqueta, stock: v.stock })),
      requiereConfirmacion: true,
    });
  }

  const variantes = filas.map(opciones => {
    const id = V.idVariante(ejes, opciones);
    const previa = previas.get(id);
    return {
      id, opciones, etiqueta: V.etiqueta(ejes, opciones),
      sku: previa ? previa.sku : '',
      priceDelta: previa ? previa.priceDelta : 0,
      stock: previa ? previa.stock : 0,
      active: previa ? previa.active : true,
    };
  });

  const guardado = rows[0]
    ? await db.update('variantsets', rows[0].id, { ejes, variantes })
    : await db.insert('variantsets', { productId: p.id, ejes, variantes });
  const set = V.vista(guardado);
  await V.sincronizar(p.id, set);
  res.json({ ...set, conservadas: variantes.filter(v => previas.has(v.id)).length, nuevas: variantes.filter(v => !previas.has(v.id)).length });
});

// PATCH /api/variantes/:productId/filas — guarda SKU, sobreprecio y estado de varias variantes.
// El stock NO se toca acá: cambiarlo sin motivo deja un faltante que después nadie puede explicar.
router.patch('/:productId/filas', requireAdmin, async (req, res) => {
  const rows = await db.find('variantsets', s => s.productId === req.params.productId);
  if (!rows[0]) return res.status(404).json({ error: 'Ese producto no tiene variantes' });
  const patch = new Map((Array.isArray(req.body && req.body.filas) ? req.body.filas : []).map(f => [String(f && f.id || ''), f]));
  const variantes = (rows[0].variantes || []).map(v => {
    const f = patch.get(v.id);
    if (!f) return v;
    const delta = Number(f.priceDelta);
    if (f.priceDelta !== undefined && (!isFinite(delta) || Math.abs(delta) > 100000000)) return v;
    return {
      ...v,
      sku: f.sku !== undefined ? String(f.sku).trim().slice(0, 40) : v.sku,
      priceDelta: f.priceDelta !== undefined ? Math.round(delta * 100) / 100 : v.priceDelta,
      active: f.active !== undefined ? !(f.active === false || f.active === 'false') : v.active,
    };
  });
  const set = V.vista(await db.update('variantsets', rows[0].id, { variantes }));
  await V.sincronizar(req.params.productId, set);
  res.json(set);
});

// POST /api/variantes/:productId/:variantId/stock — ajuste con motivo, registrado en el historial
// del producto igual que cualquier movimiento de stock. { delta } o { set }
router.post('/:productId/:variantId/stock', requireAdmin, async (req, res) => {
  const set = await V.cargar(req.params.productId);
  if (!set) return res.status(404).json({ error: 'Ese producto no tiene variantes' });
  const v = set.variantes.find(x => x.id === req.params.variantId);
  if (!v) return res.status(404).json({ error: 'Esa variante no existe' });
  let delta;
  if (req.body && req.body.set !== undefined) delta = Math.round(Number(req.body.set)) - v.stock;
  else if (req.body && req.body.delta !== undefined) delta = Math.round(Number(req.body.delta));
  else return res.status(422).json({ error: 'Indicá cuánto sumar (delta) o en cuánto dejarlo (set)' });
  if (!isFinite(delta)) return res.status(422).json({ error: 'Cantidad inválida' });
  if (v.stock + delta < 0) return res.status(422).json({ error: 'El stock no puede quedar negativo' });
  if (v.stock + delta > 1000000) return res.status(422).json({ error: 'El stock no puede pasar de 1.000.000' });
  const motivo = String((req.body && req.body.motivo) || '').trim().slice(0, 120) || 'Ajuste manual';
  const actualizada = await V.mover(req.params.productId, v.id, delta, motivo, req.user.email || '');
  const total = await V.sincronizar(req.params.productId);
  res.json({ variante: actualizada, totalProducto: total });
});

module.exports = router;
`,
  }),
  pages: () => ({
    'variantes-admin': {
      title: 'Variantes',
      html: `  <section>
    <div class="container">
      <h2>Variantes de producto</h2>
      <p class="section-sub">Un mismo producto con varias combinaciones: talle, color, medida. Cada
        combinación lleva su SKU, su diferencia de precio y su stock propio.</p>

      <div class="card" id="va-panel" hidden>
        <label for="va-producto">Producto</label>
        <select id="va-producto"></select>

        <div id="va-ejes-caja" style="margin-top:18px">
          <h3 style="margin:0 0 4px;font-size:1rem">Ejes</h3>
          <p class="muted" style="font-size:.85rem;margin:0 0 12px">Los valores van separados por
            coma: <code>S, M, L, XL</code>. Al guardar se generan todas las combinaciones
            <strong>conservando el stock y el SKU</strong> de las que ya existían.</p>
          <div id="va-ejes"></div>
          <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:6px">
            <button class="btn ghost" type="button" id="va-add-eje">Agregar eje</button>
            <button class="btn" type="button" id="va-guardar-ejes">Guardar ejes y generar</button>
          </div>
        </div>

        <div id="va-matriz" style="margin-top:22px"></div>
      </div>

      <p class="muted" id="va-sin" hidden>Entrá como administrador para gestionar las variantes.</p>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo Variantes de producto.
   Dos trabajos, los dos del lado del cliente porque son interacción y no contenido indexable:
   (1) el selector de opciones de la ficha, que actualiza precio, stock y tope de cantidad; y
   (2) el barrido de los botones "Agregar" del catálogo y de la tienda, que en un producto con
   variantes pasan a llevar a la ficha — agregar a ciegas una remera sin talle es una venta que
   después hay que deshacer a mano.
   El precio que se muestra es informativo: el que se cobra lo recalcula SIEMPRE el servidor. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var indice = { productos: {}, variantes: {} };

  // Punto de entrada para el resto del sitio (lo consultan la ficha y el carrito) — se publica
  // enseguida, aunque el índice todavía no haya llegado: sin él, los módulos que preguntan
  // "¿este producto lleva variante?" tirarían error en vez de degradar a "no".
  window.WFVariantes = {
    requiere: function (productId) { return !!indice.productos[productId]; },
    info: function (variantId) { return indice.variantes[variantId] || null; },
    seleccion: function () { return seleccionActual; },
  };

  var seleccionActual = null;

  /* ---------- índice + barrido de los botones del catálogo ---------- */

  function barrer() {
    var botones = document.querySelectorAll('[data-add],[data-ti-add]');
    for (var i = 0; i < botones.length; i++) {
      var b = botones[i];
      if (b.getAttribute('data-va-listo') === '1') continue;
      var id = b.getAttribute('data-add') || b.getAttribute('data-ti-add');
      var p = indice.productos[id];
      if (!p) continue;
      b.setAttribute('data-va-listo', '1');
      if (!p.slug) continue;
      var a = document.createElement('a');
      a.className = b.className;
      a.href = '/producto/' + encodeURIComponent(p.slug);
      a.textContent = 'Elegir ' + (p.opciones || 'opciones').toLowerCase();
      a.setAttribute('data-va-listo', '1');
      b.parentNode.replaceChild(a, b);
    }
  }

  function cargarIndice() {
    if (window.__PREVIEW__) return Promise.resolve();
    return fetch('/api/variantes/indice').then(function (r) { return r.json(); }).then(function (d) {
      indice = { productos: (d && d.productos) || {}, variantes: (d && d.variantes) || {} };
      barrer();
      // El carrito ya se pintó con lo que sabía hace un momento: sin variantes cargadas mostró
      // "(opción)" y el precio sin el sobreprecio. Ahora que el índice está, se le pide que
      // vuelva a pintar. Un carrito que muestra un importe distinto del que va a cobrar el
      // checkout es exactamente el bug que este proyecto ya se comió una vez.
      if (window.WFCart && window.WFCart.refrescar) window.WFCart.refrescar();
      // Las grillas del catálogo y de la tienda se pintan después de una consulta propia, así que
      // el barrido tiene que volver a correr cuando aparecen. Un observador cuesta menos que
      // acoplarse al ciclo de vida de dos módulos que no se conocen entre sí.
      if (window.MutationObserver && Object.keys(indice.productos).length) {
        var pendiente = false;
        new MutationObserver(function () {
          if (pendiente) return;
          pendiente = true;
          setTimeout(function () { pendiente = false; barrer(); }, 60);
        }).observe(document.body, { childList: true, subtree: true });
      }
    }).catch(function () {});
  }

  /* ---------- selector de la ficha ---------- */

  function money(n) { return (window.App && App.money) ? App.money(n) : '$' + Math.round(n).toLocaleString('es-AR'); }

  function selectorFicha() {
    var boton = document.getElementById('fi-add');
    var compra = document.querySelector('.fi-compra');
    if (!compra) return;
    // Sin botón de compra el producto está agotado: igual conviene mostrar las opciones, pero el
    // id del producto sale del botón. Sin él no hay nada que consultar.
    if (!boton) return;
    var productId = boton.getAttribute('data-fi-id');
    if (!productId) return;

    fetch('/api/variantes/' + encodeURIComponent(productId)).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ejes || !d.ejes.length || !d.variantes || !d.variantes.length) return;
      pintar(compra, boton, d);
    }).catch(function () {});
  }

  function pintar(compra, boton, d) {
    var caja = document.createElement('div');
    caja.className = 'va-sel';
    var elegido = {};

    var html = '';
    for (var i = 0; i < d.ejes.length; i++) {
      var eje = d.ejes[i];
      html += '<div class="va-eje"><span>' + esc(eje.nombre) + '</span><div class="va-ops" data-va-eje="' + esc(eje.nombre) + '">';
      for (var j = 0; j < eje.valores.length; j++) {
        html += '<button type="button" class="va-op" aria-pressed="false" data-va-valor="' + esc(eje.valores[j]) + '">' + esc(eje.valores[j]) + '</button>';
      }
      html += '</div></div>';
    }
    html += '<p class="va-aviso" id="va-aviso">Elegí ' + d.ejes.map(function (e) { return e.nombre.toLowerCase(); }).join(' y ') + ' para ver el stock.</p>';
    caja.innerHTML = html;
    compra.parentNode.insertBefore(caja, compra);

    var qty = document.getElementById('fi-qty');
    var precioEl = document.querySelector('.fi-precio strong');
    var stockEl = document.querySelector('.fi-stock');
    var aviso = document.getElementById('va-aviso');

    // Estado inicial: sin combinación elegida no se puede comprar. Es preferible un botón apagado
    // con el motivo escrito al lado que un botón que el checkout va a rechazar.
    boton.disabled = true;
    boton.setAttribute('aria-disabled', 'true');

    function buscarVariante() {
      for (var i = 0; i < d.variantes.length; i++) {
        var v = d.variantes[i];
        var coincide = true;
        for (var k = 0; k < d.ejes.length; k++) {
          if (v.opciones[d.ejes[k].nombre] !== elegido[d.ejes[k].nombre]) { coincide = false; break; }
        }
        if (coincide) return v;
      }
      return null;
    }

    /** ¿Existe alguna combinación CON STOCK que use este valor junto con lo ya elegido? Es lo que
     *  permite tachar "XL" cuando ese talle está agotado en el color elegido. */
    function hayCon(ejeNombre, valor) {
      for (var i = 0; i < d.variantes.length; i++) {
        var v = d.variantes[i];
        if (v.opciones[ejeNombre] !== valor) continue;
        var choca = false;
        for (var k = 0; k < d.ejes.length; k++) {
          var n = d.ejes[k].nombre;
          if (n === ejeNombre) continue;
          if (elegido[n] && v.opciones[n] !== elegido[n]) { choca = true; break; }
        }
        if (!choca && v.stock > 0) return true;
      }
      return false;
    }

    function refrescar() {
      caja.querySelectorAll('[data-va-eje]').forEach(function (grupo) {
        var nombre = grupo.getAttribute('data-va-eje');
        grupo.querySelectorAll('[data-va-valor]').forEach(function (b) {
          var valor = b.getAttribute('data-va-valor');
          b.setAttribute('aria-pressed', String(elegido[nombre] === valor));
          b.setAttribute('data-agotada', hayCon(nombre, valor) ? '0' : '1');
        });
      });

      var completo = d.ejes.every(function (e) { return !!elegido[e.nombre]; });
      var v = completo ? buscarVariante() : null;
      seleccionActual = v && v.stock > 0 ? v.id : null;

      if (!completo) {
        aviso.textContent = 'Elegí ' + d.ejes.map(function (e) { return e.nombre.toLowerCase(); }).join(' y ') + ' para ver el stock.';
        boton.disabled = true; boton.setAttribute('aria-disabled', 'true');
        return;
      }
      if (!v) {
        aviso.textContent = 'Esa combinación no está disponible.';
        boton.disabled = true; boton.setAttribute('aria-disabled', 'true');
        return;
      }
      if (precioEl) {
        var nuevo = money((d.precioBase || 0) + (v.priceDelta || 0));
        if (precioEl.textContent !== nuevo) { precioEl.textContent = nuevo; pop(precioEl); }
      }
      if (v.stock <= 0) {
        aviso.textContent = 'Sin stock en esa combinación.';
        if (stockEl) { stockEl.className = 'fi-stock no'; stockEl.textContent = 'Sin stock por el momento'; }
        boton.disabled = true; boton.setAttribute('aria-disabled', 'true');
        return;
      }
      aviso.textContent = v.etiqueta + (v.priceDelta ? ' · ' + (v.priceDelta > 0 ? '+' : '') + money(v.priceDelta) : '') + ' · ' + v.stock + (v.stock === 1 ? ' unidad disponible' : ' unidades disponibles');
      if (stockEl) {
        stockEl.className = 'fi-stock ' + (v.stock <= 5 ? 'poco' : 'hay');
        stockEl.textContent = v.stock <= 5 ? '¡Últimas ' + v.stock + ' unidades!' : 'En stock';
      }
      if (qty) {
        qty.max = String(Math.min(99, v.stock));
        if (Number(qty.value) > v.stock) qty.value = String(v.stock);
      }
      boton.disabled = false; boton.removeAttribute('aria-disabled');
    }

    caja.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-va-valor]') : null;
      if (!b || b.getAttribute('data-agotada') === '1') return;
      var nombre = b.parentNode.getAttribute('data-va-eje');
      var valor = b.getAttribute('data-va-valor');
      elegido[nombre] = elegido[nombre] === valor ? '' : valor;
      refrescar();
    });

    refrescar();
    entrada(caja.querySelectorAll('.va-op'));
  }

  function esc(s) { return (window.App && App.esc) ? App.esc(s) : String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  function entrada(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [8, 0], duration: 320, delay: anime.stagger(28), ease: 'outCubic' });
    // Red de seguridad: con la pestaña oculta el loop de Anime no corre y las opciones quedarían
    // invisibles, que es peor que no animar nada
    setTimeout(function () {
      for (var i = 0; i < nodos.length; i++) { nodos[i].style.opacity = 1; nodos[i].style.transform = 'none'; }
    }, 700);
  }

  function pop(el) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) return;
    anime.animate(el, { scale: [1, 1.09, 1], duration: 340, ease: 'outCubic' });
    setTimeout(function () { el.style.transform = 'none'; }, 500);
  }

  cargarIndice().then(selectorFicha);

  /* ---------- panel de administración ---------- */

  var panel = document.getElementById('va-panel');
  if (!panel) return;
  var sinAuth = document.getElementById('va-sin');
  // El rol sale de localStorage.user, que es lo que guarda el login (mismo criterio que el
  // resto de los paneles). Decodificar el JWT a mano con atob() no sirve: el payload viene en
  // base64url (con - y _) y atob() lo rechaza, así que el panel no se mostraba nunca.
  var me = null;
  try { me = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) {}
  var esAdmin = !!(me && me.role === 'admin');
  if (window.__PREVIEW__) esAdmin = true;
  if (!esAdmin) { if (sinAuth) sinAuth.hidden = false; return; }
  panel.hidden = false;

  var selProducto = document.getElementById('va-producto');
  var cajaEjes = document.getElementById('va-ejes');
  var cajaMatriz = document.getElementById('va-matriz');
  var datos = { productos: [], sets: [] };

  function setDe(productId) {
    for (var i = 0; i < datos.sets.length; i++) if (datos.sets[i].productId === productId) return datos.sets[i];
    return null;
  }

  function filaEje(nombre, valores) {
    var d = document.createElement('div');
    d.className = 'va-ejes-edit';
    d.innerHTML = '<div><label>Nombre</label><input class="va-eje-nombre" maxlength="30" placeholder="Talle" value="' + esc(nombre || '') + '"></div>' +
      '<div><label>Valores (separados por coma)</label><input class="va-eje-valores" maxlength="600" placeholder="S, M, L, XL" value="' + esc(valores || '') + '"></div>' +
      '<div><button class="btn ghost va-eje-quitar" type="button">Quitar</button></div>';
    d.querySelector('.va-eje-quitar').addEventListener('click', function () { d.remove(); });
    return d;
  }

  function pintarEjes(set) {
    cajaEjes.innerHTML = '';
    var ejes = (set && set.ejes) || [];
    if (!ejes.length) cajaEjes.appendChild(filaEje('', ''));
    else for (var i = 0; i < ejes.length; i++) cajaEjes.appendChild(filaEje(ejes[i].nombre, ejes[i].valores.join(', ')));
  }

  function pintarMatriz(set) {
    if (!set || !set.variantes.length) {
      cajaMatriz.innerHTML = '<p class="muted">Este producto todavía no tiene combinaciones. Cargá los ejes y apretá "Guardar ejes y generar".</p>';
      return;
    }
    var producto = null;
    for (var i = 0; i < datos.productos.length; i++) if (datos.productos[i].id === set.productId) producto = datos.productos[i];
    var base = producto ? producto.price : 0;
    var filas = set.variantes.map(function (v) {
      return '<tr data-va-fila="' + esc(v.id) + '">' +
        '<td><strong>' + esc(v.etiqueta || v.id) + '</strong><br><span class="muted" style="font-size:.76rem">' + esc(v.id) + '</span></td>' +
        '<td class="va-num"><input class="va-f-sku" maxlength="40" value="' + esc(v.sku) + '"></td>' +
        '<td class="va-num"><input class="va-f-delta" type="number" step="0.01" value="' + v.priceDelta + '"></td>' +
        '<td class="va-num">' + (window.App ? App.money(base + v.priceDelta) : base + v.priceDelta) + '</td>' +
        '<td class="va-num"><strong class="va-f-stock">' + v.stock + '</strong> ' +
          '<button class="btn ghost va-f-ajustar" type="button" style="width:auto;padding:3px 9px;font-size:.76rem">Ajustar</button></td>' +
        '<td><label style="display:flex;align-items:center;gap:6px;margin:0"><input type="checkbox" class="va-f-active"' + (v.active ? ' checked' : '') + '> activa</label></td>' +
        '<td>' + (v.stock > 0 ? '<span class="va-chip ok">con stock</span>' : '<span class="va-chip sin">sin stock</span>') + '</td>' +
      '</tr>';
    }).join('');
    cajaMatriz.innerHTML = '<h3 style="margin:0 0 2px;font-size:1rem">Combinaciones</h3>' +
      '<p class="muted" style="font-size:.85rem;margin:0">El stock del producto es la <strong>suma</strong> de sus variantes activas: ' +
      '<span class="va-total" id="va-total">' + set.total + '</span> unidades. El sobreprecio se suma al precio del producto.</p>' +
      '<div style="overflow-x:auto"><table class="va-tabla"><thead><tr><th>Combinación</th><th>SKU</th><th>Sobreprecio</th><th>Precio final</th><th>Stock</th><th>Estado</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
      '<div style="margin-top:12px"><button class="btn" type="button" id="va-guardar-filas">Guardar SKU, precios y estado</button></div>';

    cajaMatriz.querySelectorAll('.va-f-ajustar').forEach(function (b) {
      b.addEventListener('click', function () { ajustar(set.productId, b.closest('[data-va-fila]')); });
    });
    var guardar = document.getElementById('va-guardar-filas');
    if (guardar) guardar.addEventListener('click', function () { guardarFilas(set.productId); });
  }

  function ajustar(productId, tr) {
    var id = tr.getAttribute('data-va-fila');
    var cuanto = prompt('¿Cuántas unidades sumar o restar? (ej: 5 o -2)');
    if (cuanto === null) return;
    var delta = Number(cuanto);
    if (!isFinite(delta) || delta === 0) { App.toast('Poné un número distinto de cero'); return; }
    var motivo = prompt('Motivo del ajuste', 'Recepción de mercadería') || '';
    App.api('/api/variantes/' + encodeURIComponent(productId) + '/' + encodeURIComponent(id) + '/stock', { method: 'POST', body: { delta: delta, motivo: motivo } })
      .then(function (r) {
        tr.querySelector('.va-f-stock').textContent = r.variante ? r.variante.stock : '?';
        var total = document.getElementById('va-total');
        if (total) { total.textContent = r.totalProducto; pop(total); }
        App.toast('Stock ajustado');
        cargar(productId);
      })
      .catch(function (e) { if (e.message !== 'preview') App.toast(e.message); });
  }

  function guardarFilas(productId) {
    var filas = [];
    cajaMatriz.querySelectorAll('[data-va-fila]').forEach(function (tr) {
      filas.push({
        id: tr.getAttribute('data-va-fila'),
        sku: tr.querySelector('.va-f-sku').value,
        priceDelta: Number(tr.querySelector('.va-f-delta').value) || 0,
        active: tr.querySelector('.va-f-active').checked,
      });
    });
    App.api('/api/variantes/' + encodeURIComponent(productId) + '/filas', { method: 'PATCH', body: { filas: filas } })
      .then(function () { App.toast('Guardado'); cargar(productId); })
      .catch(function (e) { if (e.message !== 'preview') App.toast(e.message); });
  }

  // El servidor corta con 409 cuando el cambio de ejes deja sin lugar a combinaciones que TODAVÍA
  // tienen stock. Se le muestran los números al cliente y recién ahí se reintenta confirmando:
  // borrar 25 unidades de inventario en silencio porque alguien agregó un eje "Color" es de las
  // pérdidas que después no se pueden reconstruir.
  function guardarEjes(productId, ejes, confirmar) {
    App.api('/api/variantes/' + encodeURIComponent(productId), { method: 'PUT', body: { ejes: ejes, confirmar: !!confirmar } })
      .then(function (r) {
        App.toast(ejes.length
          ? 'Listo: ' + (r.variantes || []).length + ' combinaciones (' + (r.conservadas || 0) + ' conservadas, ' + (r.nuevas || 0) + ' nuevas)'
          : 'Este producto vuelve a venderse sin variantes');
        cargar(productId);
      })
      .catch(function (e) {
        if (e.message === 'preview') return;
        if (/todavía tienen stock/.test(e.message) && confirm(e.message)) { guardarEjes(productId, ejes, true); return; }
        App.toast(e.message);
      });
  }

  function cargar(seleccionar) {
    return App.api('/api/variantes/admin/todo').then(function (d) {
      datos = d;
      var actual = seleccionar || selProducto.value || (d.productos[0] && d.productos[0].id);
      selProducto.innerHTML = d.productos.map(function (p) {
        var set = null;
        for (var i = 0; i < d.sets.length; i++) if (d.sets[i].productId === p.id) set = d.sets[i];
        return '<option value="' + esc(p.id) + '">' + esc(p.name) + (set && set.variantes.length ? ' — ' + set.variantes.length + ' variantes' : '') + '</option>';
      }).join('');
      selProducto.value = actual;
      var set = setDe(actual);
      pintarEjes(set);
      pintarMatriz(set);
    }).catch(function (e) { if (e.message !== 'preview') App.toast(e.message); });
  }

  selProducto.addEventListener('change', function () {
    var set = setDe(selProducto.value);
    pintarEjes(set);
    pintarMatriz(set);
  });

  document.getElementById('va-add-eje').addEventListener('click', function () {
    if (cajaEjes.children.length >= 3) { App.toast('Hasta 3 ejes por producto'); return; }
    cajaEjes.appendChild(filaEje('', ''));
  });

  document.getElementById('va-guardar-ejes').addEventListener('click', function () {
    var ejes = [];
    cajaEjes.querySelectorAll('.va-ejes-edit').forEach(function (d) {
      var nombre = d.querySelector('.va-eje-nombre').value.trim();
      var valores = d.querySelector('.va-eje-valores').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (nombre && valores.length) ejes.push({ nombre: nombre, valores: valores });
    });
    var productId = selProducto.value;
    guardarEjes(productId, ejes, false);
  });

  if (window.__PREVIEW__) {
    datos = {
      productos: [{ id: 'demo1', name: 'Producto Clásico', price: 4999, sku: 'CLA-001', active: true }],
      sets: [{ productId: 'demo1', ejes: [{ nombre: 'Talle', valores: ['S', 'M', 'L'] }], total: 25, variantes: [
        { id: 'talle-s', etiqueta: 'Talle S', sku: 'CLA-001-S', priceDelta: 0, stock: 8, active: true },
        { id: 'talle-m', etiqueta: 'Talle M', sku: 'CLA-001-M', priceDelta: 0, stock: 9, active: true },
        { id: 'talle-l', etiqueta: 'Talle L', sku: 'CLA-001-L', priceDelta: 300, stock: 8, active: true },
      ] }],
    };
    selProducto.innerHTML = '<option value="demo1">Producto Clásico — 3 variantes</option>';
    pintarEjes(datos.sets[0]);
    pintarMatriz(datos.sets[0]);
  } else {
    cargar();
  }
})();`,
  readmeNotes: () => [
    `**Variantes de producto**: el stock de la **variante** es el dato real y \`products.stock\` es su **espejo** (la suma de las variantes activas). Gracias a eso la ficha, la tienda, el catálogo, los avisos de stock y el checkout siguen funcionando sin cambios: el número que leen sigue siendo cierto. Consecuencia práctica: **no edites el stock de un producto con variantes desde Gestión de productos** — el valor lo vuelve a pisar la próxima sincronización. Ajustalo desde \`/variantes-admin.html\`, que además deja el movimiento registrado con su motivo y su combinación. El **id de cada variante se deriva de sus opciones** (\`talle-m__color-azul\`), así agregar un talle regenera la matriz sin romper los carritos ni los pedidos que ya la referencian; en cambio, **renombrar un eje o un valor crea combinaciones nuevas** y deja las anteriores fuera de la matriz. El precio de la variante se guarda como **diferencia** (\`+$500\` el XL), nunca como precio absoluto: así un aumento general se aplica una sola vez en el producto.`,
  ],
};
