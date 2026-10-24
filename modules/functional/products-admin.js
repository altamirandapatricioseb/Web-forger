// Gestión de productos: el catálogo maestro de la tienda. Hasta la 39ª este módulo guardaba
// nombre, precio, SKU, categoría y descripción — suficiente para una lista de precios, insuficiente
// para vender. Le faltaban las tres cosas sin las cuales no hay e-commerce:
//
//   1. IMÁGENES. Un catálogo de tarjetas de texto no vende nada. Ahora cada producto lleva una
//      galería ordenada (la primera es la portada), cargada por URL o SUBIDA DE VERDAD desde el
//      panel si el módulo Biblioteca de archivos está activo — el binario viaja crudo a
//      /api/uploads/admin y vuelve una URL propia del sitio, sin depender de ningún hosting externo.
//   2. STOCK. No existía el campo, así que el checkout vendía infinito: diez personas podían
//      comprar la última unidad al mismo tiempo y el negocio se enteraba al querer despacharlas.
//      Ahora el stock vive en el producto, el checkout lo valida y lo descuenta (módulo Carrito), y
//      cada ajuste manual queda registrado con su motivo. Es opcional por producto (`trackStock`):
//      un servicio o un producto a pedido no lleva stock.
//   3. BÚSQUEDA Y FILTROS DEL LADO DEL SERVIDOR. `GET /api/products/buscar` resuelve texto,
//      categoría, marca, rango de precio, "solo con stock", orden y paginación en el servidor.
//      Filtrar en el navegador obliga a bajar el catálogo entero: con 40 productos no se nota y con
//      4.000 el sitio no abre.
//
// Además cada producto tiene ahora un SLUG único, que es lo que le da URL propia a la ficha
// (`/producto/<slug>`, módulo Página de producto). Sin slug no hay página compartible, ni
// posicionamiento por producto, ni ficha para Google Shopping.
//
// COMPATIBILIDAD: `GET /api/products` sigue devolviendo el mismo ARREGLO de siempre. Lo consumen el
// carrito, el POS, el agente IA, "avisame cuando vuelva", la lista de precios y el simulador de
// descuentos: cambiarle la forma para meter la paginación habría roto seis módulos en silencio.
// La respuesta paginada vive en su propia ruta.
const { phIcon } = require('../../src/icons');

// Los productos sembrados: los mismos de siempre, ahora con stock y slug para que la tienda
// funcione desde el arranque. Sin imágenes a propósito — una foto inventada es peor que un hueco
// honesto, y el generador ya tiene un slot de imagen que comunica "acá va tu foto".
const SEMILLA = [
  { name: 'Producto Clásico', slug: 'producto-clasico', price: 4999, sku: 'CLA-001', category: 'General', description: 'El favorito de siempre.', stock: 25 },
  { name: 'Producto Premium', slug: 'producto-premium', price: 9999, sku: 'PRE-001', category: 'General', description: 'Calidad superior, terminación impecable.', stock: 12 },
  { name: 'Producto Edición Limitada', slug: 'producto-edicion-limitada', price: 14999, sku: 'LIM-001', category: 'Especiales', description: 'Serie numerada, stock reducido.', stock: 3 },
].map(p => ({ brand: '', compareAt: 0, details: '', images: [], trackStock: true, allowBackorder: false, weight: 0, featured: false, active: true, ...p }));

module.exports = {
  id: 'products-admin', type: 'functional', name: 'Gestión de productos',
  description: 'Catálogo maestro de la tienda: nombre, slug propio, SKU, categoría, marca, precio (con precio anterior tachado), descripción corta y detalle largo, galería de imágenes (por URL o subidas de verdad si Biblioteca de archivos está activa), stock con control opcional por producto y ajustes registrados con su motivo, peso para el cálculo de envío y destacado. Expone búsqueda y filtros RESUELTOS EN EL SERVIDOR (texto, categoría, marca, rango de precio, solo con stock, orden y paginación) para que el catálogo no tenga que bajarse entero al navegador. GET /api/products sigue devolviendo el mismo arreglo de siempre, así los seis módulos que lo consumen no se enteran del cambio. Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/products', file: 'routes/products.js' }],
  collections: ['products', 'stockmoves'],
  nav: () => [{ label: 'Productos', href: '/products.html', id: 'nav-products' }],
  head: () => `  <style>
    .pr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-top:20px}
    .pr-item{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);overflow:hidden;display:flex;flex-direction:column}
    .pr-foto{aspect-ratio:4/3;background:color-mix(in srgb,var(--text) 6%,var(--bg));display:flex;align-items:center;justify-content:center;color:var(--muted)}
    .pr-foto img{width:100%;height:100%;object-fit:cover;display:block}
    .pr-cuerpo{padding:13px 15px;display:flex;flex-direction:column;gap:5px;flex:1}
    .pr-cuerpo strong{line-height:1.25}
    .pr-meta{font-size:.78rem;color:var(--muted)}
    .pr-precio{font-variant-numeric:tabular-nums;font-weight:700}
    .pr-antes{text-decoration:line-through;color:var(--muted);font-weight:400;margin-left:7px;font-size:.86rem}
    .pr-acc{display:flex;gap:6px;flex-wrap:wrap;padding:0 15px 13px}
    .pr-acc .btn{width:auto;padding:5px 11px;font-size:.8rem}
    .pr-chip{display:inline-block;font-size:.71rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .pr-chip.ok{background:#2e9e5b20;color:#1d6b3c}
    .pr-chip.poco{background:#e6a80020;color:#8a6400}
    .pr-chip.sin{background:#c0392b18;color:#c0392b}
    .pr-chip.baja{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .pr-fotos{display:flex;gap:9px;flex-wrap:wrap;margin:8px 0 4px}
    .pr-thumb{position:relative;width:78px;height:78px;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--bg)}
    .pr-thumb img{width:100%;height:100%;object-fit:cover;display:block}
    .pr-thumb button{position:absolute;top:2px;right:2px;border:0;background:rgba(0,0,0,.62);color:#fff;border-radius:5px;width:19px;height:19px;line-height:1;cursor:pointer;font-size:.8rem;padding:0}
    .pr-thumb.portada{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 25%,transparent)}
    .pr-thumb .pr-tag{position:absolute;left:0;right:0;bottom:0;background:var(--accent);color:#fff;font-size:.62rem;text-align:center;padding:1px 0}
    .pr-drop{border:2px dashed var(--line);border-radius:var(--radius);padding:16px;text-align:center;color:var(--muted);font-size:.87rem;cursor:pointer}
    .pr-drop.encima{border-color:var(--accent);color:var(--accent)}
    .pr-barra{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:6px}
    .pr-barra input,.pr-barra select{margin:0}
  </style>`,
  files: (cfg) => ({
    'routes/products.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');
const { verify } = require('../src/token');

// Una imagen válida es una ruta del propio sitio (las que devuelve la biblioteca de archivos) o
// una URL http(s). Nunca javascript: ni data:, que es como una galería se vuelve un XSS.
const IMAGEN = /^(\\/[\\w\\-./#?=&%]*|https?:\\/\\/[^\\s"']+)$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const validate = (data) => check(data, {
  name: (v) => str(v, 2, 120),
  price: (v) => num(v, 0.01),
  sku: (v) => v === undefined || v === '' || str(v, 1, 40),
  category: (v) => v === undefined || v === '' || str(v, 1, 60),
  description: (v) => v === undefined || str(v, 0, 500),
});

db.seedIfEmpty('products', ${JSON.stringify(SEMILLA, null, 2)});

/** Slug a partir del nombre, único en la colección (se le agrega -2, -3… si ya existe). */
async function slugUnico(nombre, idActual) {
  const base = String(nombre).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70) || 'producto';
  const usados = new Set((await db.all('products')).filter(p => p.id !== idActual).map(p => p.slug));
  if (!usados.has(base)) return base;
  for (let i = 2; i < 500; i++) if (!usados.has(base + '-' + i)) return base + '-' + i;
  return base + '-' + Date.now();
}

/** Vista completa y normalizada. Los campos nuevos tienen default, así un producto viejo
 *  (creado antes de que el modelo creciera) no rompe nada al leerse. */
const vista = (p) => ({
  id: p.id, name: p.name, slug: p.slug || '', sku: p.sku || '',
  category: p.category || '', brand: p.brand || '',
  price: Number(p.price) || 0, compareAt: Number(p.compareAt) || 0,
  description: p.description || '', details: p.details || '',
  images: (Array.isArray(p.images) ? p.images : []).filter(i => i && IMAGEN.test(i.url || '')),
  stock: Number(p.stock) || 0,
  trackStock: p.trackStock !== false,
  allowBackorder: !!p.allowBackorder,
  weight: Number(p.weight) || 0,
  featured: !!p.featured, active: p.active !== false,
  createdAt: p.createdAt || null,
});

/** ¿Se puede comprar y cuántas unidades? Es la ÚNICA definición de disponibilidad del proyecto:
 *  la usan la ficha, el catálogo y el checkout, para que los tres digan lo mismo. */
function disponible(p) {
  const v = vista(p);
  if (!v.active) return { comprable: false, cantidad: 0, motivo: 'no disponible' };
  if (!v.trackStock || v.allowBackorder) return { comprable: true, cantidad: Infinity, motivo: '' };
  return { comprable: v.stock > 0, cantidad: v.stock, motivo: v.stock > 0 ? '' : 'sin stock' };
}

// GET /api/products — activos (público). Con ?all=1 y admin: todos.
// Devuelve un ARREGLO, igual que siempre: lo consumen el carrito, el POS, el agente IA, los avisos
// de stock, la lista de precios y el simulador de descuentos. La búsqueda paginada vive en /buscar.
router.get('/', async (req, res) => {
  const rows = await db.all('products');
  if (req.query.all === '1') {
    const payload = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
    if (payload && payload.role === 'admin') return res.json(rows.map(vista));
  }
  res.json(rows.filter(p => p.active !== false).map(vista));
});

// GET /api/products/buscar — texto, categoría, marca, precio, stock, orden y paginación.
// Todo se resuelve ACÁ: filtrar en el navegador obliga a bajar el catálogo entero, que con 40
// productos no se nota y con 4.000 hace que el sitio no abra.
// Sin tildes y en minúsculas: nadie escribe "algodón" con tilde en un buscador, y "algodon" tiene
// que encontrarlo igual. Se normalizan LOS DOS lados de la comparación, no sólo la consulta.
const plegar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');

router.get('/buscar', async (req, res) => {
  const todos = (await db.all('products')).filter(p => p.active !== false).map(vista);
  const q = plegar(String(req.query.q || '').trim());
  const cat = String(req.query.cat || '').trim();
  const marca = String(req.query.marca || '').trim();
  const min = Number(req.query.min);
  const max = Number(req.query.max);
  const soloStock = req.query.stock === '1';

  // Las facetas se calculan sobre TODO el catálogo activo, no sobre el resultado filtrado: si se
  // recalcularan sobre lo filtrado, elegir una categoría haría desaparecer las demás del filtro.
  const categorias = [...new Set(todos.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const marcas = [...new Set(todos.map(p => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const precios = todos.map(p => p.price);

  let rows = todos.filter(p => {
    if (cat && p.category !== cat) return false;
    if (marca && p.brand !== marca) return false;
    if (isFinite(min) && p.price < min) return false;
    if (isFinite(max) && p.price > max) return false;
    if (soloStock && !disponible(p).comprable) return false;
    if (q) {
      const heno = plegar(p.name + ' ' + p.description + ' ' + p.details + ' ' + p.sku + ' ' + p.category + ' ' + p.brand);
      // Todas las palabras tienen que aparecer: "remera azul" no puede traer todas las remeras
      if (!q.split(/\\s+/).filter(Boolean).every(t => heno.includes(t))) return false;
    }
    return true;
  });

  const orden = String(req.query.orden || 'destacados');
  const cmp = {
    'precio-asc': (a, b) => a.price - b.price,
    'precio-desc': (a, b) => b.price - a.price,
    'nombre': (a, b) => a.name.localeCompare(b.name, 'es'),
    'nuevos': (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    // Por default: destacados primero, después los que tienen stock, después alfabético. Dejar
    // arriba lo que no se puede comprar es la forma más rápida de perder una venta.
    'destacados': (a, b) => (b.featured - a.featured) ||
      (disponible(b).comprable - disponible(a).comprable) || a.name.localeCompare(b.name, 'es'),
  }[orden] || null;
  rows.sort(cmp || cmp === null ? (cmp || ((a, b) => a.name.localeCompare(b.name, 'es'))) : undefined);

  const total = rows.length;
  // Sólo se acota el máximo: un tope alto es lo que evita que alguien se lleve el catálogo entero
  // en una consulta. Poner también un mínimo sorprendía a quien pedía 2 por página y recibía 4.
  const porPagina = Math.min(60, Math.max(1, Number(req.query.porPagina) || 12));
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(paginas, Math.max(1, Number(req.query.pagina) || 1));
  rows = rows.slice((pagina - 1) * porPagina, pagina * porPagina);

  res.json({
    rows: rows.map(p => ({ ...p, disponibilidad: disponible(p) })),
    total, pagina, paginas, porPagina,
    categorias, marcas,
    precioMin: precios.length ? Math.min(...precios) : 0,
    precioMax: precios.length ? Math.max(...precios) : 0,
  });
});

// GET /api/products/slug/:slug — ficha pública de un producto por su dirección
router.get('/slug/:slug', async (req, res) => {
  const p = (await db.all('products')).find(x => String(x.slug || '') === String(req.params.slug).toLowerCase());
  if (!p || p.active === false) return res.status(404).json({ error: 'Ese producto no existe' });
  const v = vista(p);
  // Relacionados: de la misma categoría, comprables, sin incluirse a sí mismo
  const relacionados = (await db.all('products')).filter(x => x.active !== false).map(vista)
    .filter(x => x.id !== v.id && x.category && x.category === v.category)
    .slice(0, 4)
    .map(x => ({ id: x.id, name: x.name, slug: x.slug, price: x.price, images: x.images.slice(0, 1) }));
  res.json({ ...v, disponibilidad: disponible(p), relacionados });
});

/** Normaliza y valida los campos que llegan del panel. */
async function leerCampos(body, actual) {
  const patch = {};
  for (const k of ['name', 'sku', 'category', 'brand', 'description', 'details']) {
    if (body[k] === undefined) continue;
    patch[k] = String(body[k]).trim().slice(0, k === 'details' ? 4000 : 500);
  }
  if (body.slug !== undefined) {
    const s = String(body.slug).trim().toLowerCase();
    if (s && !SLUG.test(s)) return { ok: false, error: 'La dirección va en minúsculas, con números y guiones' };
    if (s) {
      const repetido = (await db.all('products')).some(p => p.slug === s && p.id !== (actual && actual.id));
      if (repetido) return { ok: false, error: 'Ya hay otro producto con esa dirección' };
      patch.slug = s;
    }
  }
  for (const [k, tope] of [['price', 100000000], ['compareAt', 100000000], ['weight', 1000]]) {
    if (body[k] === undefined) continue;
    const n = Number(body[k]);
    if (!isFinite(n) || n < 0 || n > tope) return { ok: false, error: 'Valor inválido en ' + k };
    patch[k] = k === 'weight' ? Math.round(n * 1000) / 1000 : Math.round(n * 100) / 100;
  }
  // El precio anterior es el tachado: si no es mayor que el actual, no es una oferta, es ruido
  const precio = patch.price !== undefined ? patch.price : (actual ? Number(actual.price) : 0);
  const antes = patch.compareAt !== undefined ? patch.compareAt : (actual ? Number(actual.compareAt) || 0 : 0);
  if (antes && antes <= precio) return { ok: false, error: 'El precio anterior tiene que ser mayor que el precio actual (si no, no es una oferta)' };

  if (body.images !== undefined) {
    if (!Array.isArray(body.images)) return { ok: false, error: 'Las imágenes tienen que ser una lista' };
    if (body.images.length > 12) return { ok: false, error: 'Hasta 12 imágenes por producto' };
    const imgs = [];
    for (const i of body.images) {
      const url = String((i && i.url) || '').trim();
      if (!url) continue;
      if (!IMAGEN.test(url) || url.length > 500) return { ok: false, error: 'Imagen inválida: tiene que ser una ruta del sitio o una URL http(s)' };
      imgs.push({ url, alt: String((i && i.alt) || '').slice(0, 200) });
    }
    patch.images = imgs;
  }
  if (body.stock !== undefined) {
    const n = Number(body.stock);
    if (!isFinite(n) || n < 0 || n > 1000000) return { ok: false, error: 'El stock va entre 0 y 1.000.000' };
    patch.stock = Math.round(n);
  }
  for (const k of ['trackStock', 'allowBackorder', 'featured', 'active']) {
    if (body[k] !== undefined) patch[k] = !(body[k] === false || body[k] === 'false');
  }
  return { ok: true, patch };
}

// POST /api/products — alta (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = validate(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const leido = await leerCampos(req.body || {}, null);
  if (!leido.ok) return res.status(422).json({ error: leido.error });
  const base = {
    name: '', slug: '', sku: '', category: '', brand: '', price: 0, compareAt: 0,
    description: '', details: '', images: [], stock: 0, trackStock: true,
    allowBackorder: false, weight: 0, featured: false, active: true,
  };
  const row = { ...base, ...leido.patch };
  if (!row.slug) row.slug = await slugUnico(row.name, null);
  const creado = await db.insert('products', row);
  if (creado.trackStock && Number(creado.stock) > 0) {
    await db.insert('stockmoves', { productId: creado.id, delta: Number(creado.stock), motivo: 'Carga inicial', usuario: req.user.email || '', resultado: Number(creado.stock) });
  }
  res.status(201).json(vista(creado));
});

// PATCH /api/products/:id — edición o reactivación (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const current = await db.get('products', req.params.id);
  if (!current) return res.status(404).json({ error: 'Producto inexistente' });
  const { ok, errors } = validate({ ...current, ...req.body });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const leido = await leerCampos(req.body || {}, current);
  if (!leido.ok) return res.status(422).json({ error: leido.error });
  // Cambiar el nombre NO cambia el slug de un producto ya publicado: los enlaces que ya circulan
  // (y lo que Google indexó) tienen que seguir funcionando. Para moverlo hay que editarlo a mano.
  if (leido.patch.name && !current.slug) leido.patch.slug = await slugUnico(leido.patch.name, current.id);
  // El stock por PATCH queda registrado igual que un ajuste manual: sin rastro, un faltante no se
  // puede explicar nunca
  if (leido.patch.stock !== undefined && Number(leido.patch.stock) !== Number(current.stock || 0)) {
    await db.insert('stockmoves', {
      productId: current.id, delta: Number(leido.patch.stock) - (Number(current.stock) || 0),
      motivo: 'Edición del producto', usuario: req.user.email || '', resultado: Number(leido.patch.stock),
    });
  }
  res.json(vista(await db.update('products', current.id, leido.patch)));
});

// POST /api/products/:id/stock — ajuste con motivo (solo admin). { delta } o { set }
router.post('/:id/stock', requireAdmin, async (req, res) => {
  const p = await db.get('products', req.params.id);
  if (!p) return res.status(404).json({ error: 'Producto inexistente' });
  const actual = Number(p.stock) || 0;
  let destino;
  if (req.body && req.body.set !== undefined) destino = Number(req.body.set);
  else if (req.body && req.body.delta !== undefined) destino = actual + Number(req.body.delta);
  else return res.status(422).json({ error: 'Indicá cuánto sumar (delta) o en cuánto dejarlo (set)' });
  if (!isFinite(destino) || destino < 0 || destino > 1000000) {
    return res.status(422).json({ error: 'El stock no puede quedar negativo ni pasar de 1.000.000' });
  }
  const motivo = String((req.body && req.body.motivo) || '').trim().slice(0, 120) || 'Ajuste manual';
  const row = await db.update('products', p.id, { stock: Math.round(destino) });
  await db.insert('stockmoves', {
    productId: p.id, delta: Math.round(destino) - actual, motivo,
    usuario: req.user.email || '', resultado: Math.round(destino),
  });
  res.json(vista(row));
});

// GET /api/products/:id/stock — historial de movimientos de ese producto (solo admin)
router.get('/:id/stock', requireAdmin, async (req, res) => {
  const rows = (await db.find('stockmoves', m => m.productId === req.params.id))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 60);
  res.json({ rows });
});

// DELETE /api/products/:id — baja lógica (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  if (!(await db.get('products', req.params.id))) return res.status(404).json({ error: 'Producto inexistente' });
  res.json(vista(await db.update('products', req.params.id, { active: false })));
});

module.exports = router;
// Se exporta la regla de disponibilidad para que el checkout (routes/orders.js) descuente stock
// con exactamente el mismo criterio que muestra el catálogo.
module.exports.disponible = disponible;
module.exports.vista = vista;
`,
  }),
  pages: () => ({
    products: {
      title: 'Productos',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('tag', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Gestión de productos</h2>
      <p class="section-sub">El catálogo maestro de la tienda. Los productos dados de baja dejan de mostrarse pero conservan su historial. El stock que cargues acá es el que el checkout valida y descuenta.</p>

      <div class="card" style="margin-bottom:24px">
        <h3 id="pr-form-titulo" style="margin-top:0">Nuevo producto</h3>
        <form id="pr-form">
          <div class="grid cols-2">
            <div><label for="pr-name">Nombre</label><input id="pr-name" name="name" required maxlength="120" placeholder="Remera de algodón"></div>
            <div><label for="pr-slug">Dirección de la ficha</label><input id="pr-slug" name="slug" maxlength="80" placeholder="se genera sola"><span class="muted" style="font-size:.79rem" id="pr-url">/producto/…</span></div>
          </div>
          <div class="grid cols-3">
            <div><label for="pr-sku">SKU</label><input id="pr-sku" name="sku" maxlength="40" placeholder="REM-001"></div>
            <div><label for="pr-category">Categoría</label><input id="pr-category" name="category" maxlength="60" placeholder="Indumentaria" list="pr-cats"><datalist id="pr-cats"></datalist></div>
            <div><label for="pr-brand">Marca</label><input id="pr-brand" name="brand" maxlength="60" placeholder="Opcional" list="pr-marcas"><datalist id="pr-marcas"></datalist></div>
          </div>
          <div class="grid cols-3">
            <div><label for="pr-price">Precio</label><input id="pr-price" name="price" type="number" min="0.01" step="0.01" required></div>
            <div><label for="pr-compare">Precio anterior (tachado)</label><input id="pr-compare" name="compareAt" type="number" min="0" step="0.01" placeholder="0 = sin oferta"></div>
            <div><label for="pr-weight">Peso en kg (para el envío)</label><input id="pr-weight" name="weight" type="number" min="0" step="0.001" placeholder="0"></div>
          </div>

          <label for="pr-description">Descripción corta (la del listado)</label>
          <input id="pr-description" name="description" maxlength="500" placeholder="Una línea que resuma el producto.">
          <label for="pr-details">Detalle largo (el de la ficha)</label>
          <textarea id="pr-details" name="details" maxlength="4000" rows="4" placeholder="Materiales, medidas, cuidados, qué incluye…"></textarea>

          <label style="margin-top:16px">Imágenes <span class="muted" style="font-weight:400">— la primera es la portada</span></label>
          <div class="pr-fotos" id="pr-fotos"></div>
          <div class="pr-drop" id="pr-drop">Arrastrá una imagen o hacé clic para elegirla<input type="file" id="pr-file" accept="image/*" multiple hidden></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px">
            <input id="pr-img-url" placeholder="…o pegá la URL de una imagen" maxlength="500" style="flex:1;min-width:200px;margin:0">
            <button class="btn ghost" type="button" id="pr-img-add" style="width:auto">Agregar por URL</button>
          </div>

          <div class="grid cols-2" style="margin-top:18px">
            <div><label for="pr-stock">Stock</label><input id="pr-stock" name="stock" type="number" min="0" step="1" value="0"></div>
            <div style="display:flex;flex-direction:column;gap:9px;justify-content:flex-end;padding-bottom:4px">
              <label style="display:flex;align-items:center;gap:8px;margin:0"><input type="checkbox" id="pr-track" style="width:auto;margin:0" checked> Controlar stock (si no, se vende sin límite)</label>
              <label style="display:flex;align-items:center;gap:8px;margin:0"><input type="checkbox" id="pr-backorder" style="width:auto;margin:0"> Aceptar pedidos sin stock (a pedido)</label>
              <label style="display:flex;align-items:center;gap:8px;margin:0"><input type="checkbox" id="pr-featured" style="width:auto;margin:0"> Destacado</label>
            </div>
          </div>

          <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="pr-guardar">Crear producto</button>
            <button class="btn ghost" type="button" id="pr-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>

      <div class="pr-barra">
        <div style="flex:2;min-width:180px"><label for="pr-q">Buscar</label><input id="pr-q" placeholder="Nombre, SKU, categoría…"></div>
        <div style="flex:1;min-width:130px"><label for="pr-f-cat">Categoría</label><select id="pr-f-cat"><option value="">Todas</option></select></div>
        <div style="flex:1;min-width:130px"><label for="pr-f-est">Estado</label><select id="pr-f-est"><option value="">Todos</option><option value="activo">Activos</option><option value="baja">Dados de baja</option><option value="sin">Sin stock</option></select></div>
      </div>
      <div id="products-table"><p class="muted">Cargando…</p></div>
      <div id="pr-hist"></div>
    </div>
  </section>`,
    },
  }),
  clientJs: (cfg) => `/* Módulo gestión de productos: alta y edición con galería de imágenes${cfg.moduleIds.includes('uploads') ? ' (subida real vía la Biblioteca de archivos)' : ' por URL'},
   stock con historial de ajustes, y filtros sobre el catálogo maestro. Anime.js para la aparición
   de la grilla, con red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var nav = document.getElementById('nav-products');
  if (nav && (!me || me.role !== 'admin') && !window.__PREVIEW__) nav.style.display = 'none';

  var box = document.getElementById('products-table');
  var form = document.getElementById('pr-form');
  if (!box || !form) return;

  var lista = [];
  var imagenes = [];
  var editando = '';

  function aparecer(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [10, 0], duration: 360, delay: anime.stagger ? anime.stagger(28) : 0, ease: 'outCubic' });
    // Red de seguridad: con la pestaña oculta el loop de Anime no corre y quedarían invisibles
    setTimeout(function () {
      Array.prototype.forEach.call(nodos, function (n) { n.style.opacity = 1; n.style.transform = 'none'; });
    }, 900);
  }

  /* ---------- galería del formulario ---------- */

  function pintarFotos() {
    var cont = document.getElementById('pr-fotos');
    cont.innerHTML = imagenes.map(function (im, i) {
      return '<div class="pr-thumb' + (i === 0 ? ' portada' : '') + '">' +
        '<img src="' + App.esc(im.url) + '" alt="' + App.esc(im.alt || '') + '">' +
        '<button type="button" data-pr-img-del="' + i + '" aria-label="Quitar imagen" title="Quitar">×</button>' +
        (i === 0 ? '<span class="pr-tag">portada</span>' : '<button type="button" data-pr-img-port="' + i + '" style="left:2px;right:auto" aria-label="Usar de portada" title="Usar de portada">↑</button>') +
        '</div>';
    }).join('') || '<span class="muted" style="font-size:.85rem">Sin imágenes todavía.</span>';
    cont.querySelectorAll('[data-pr-img-del]').forEach(function (b) {
      b.addEventListener('click', function () { imagenes.splice(Number(b.getAttribute('data-pr-img-del')), 1); pintarFotos(); });
    });
    cont.querySelectorAll('[data-pr-img-port]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-pr-img-port'));
        imagenes.unshift(imagenes.splice(i, 1)[0]);
        pintarFotos();
      });
    });
  }

  function agregarImagen(url, alt) {
    if (!url) return;
    if (imagenes.length >= 12) { App.toast('Hasta 12 imágenes por producto'); return; }
    imagenes.push({ url: url, alt: alt || '' });
    pintarFotos();
  }

  document.getElementById('pr-img-add').addEventListener('click', function () {
    var campo = document.getElementById('pr-img-url');
    var v = campo.value.trim();
    if (!v) return;
    if (!/^(\\/|https?:\\/\\/)/.test(v)) { App.toast('Tiene que ser una ruta del sitio (/img/foto.jpg) o una URL http(s)'); return; }
    agregarImagen(v, document.getElementById('pr-name').value);
    campo.value = '';
  });
${cfg.moduleIds.includes('uploads') ? `
  // Subida real a la Biblioteca de archivos: el binario viaja crudo (octet-stream), no como JSON,
  // así no choca contra el límite del express.json global. Devuelve una URL propia del sitio.
  function subir(file) {
    if (!file) return;
    if (window.__PREVIEW__) { App.toast('Vista previa: la imagen se subiría en el proyecto exportado'); return; }
    if (!/^image\\//.test(file.type)) { App.toast('Elegí un archivo de imagen'); return; }
    if (file.size > 5 * 1024 * 1024) { App.toast('La imagen supera el máximo de 5 MB'); return; }
    var nombreAscii = file.name.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^\\x20-\\x7E]/g, '-');
    App.toast('Subiendo ' + file.name + '…');
    file.arrayBuffer().then(function (buf) {
      return fetch('/api/uploads/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-file-name': nombreAscii,
          Authorization: 'Bearer ' + (localStorage.getItem('token') || ''),
        },
        body: buf,
      });
    }).then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.d.error || 'No se pudo subir');
        agregarImagen(r.d.url, document.getElementById('pr-name').value);
        App.toast('Imagen subida');
      }).catch(function (err) { App.toast(err.message); });
  }

  var drop = document.getElementById('pr-drop');
  var file = document.getElementById('pr-file');
  drop.addEventListener('click', function () { file.click(); });
  file.addEventListener('change', function () { Array.prototype.forEach.call(file.files, subir); file.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('encima'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('encima'); });
  });
  drop.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) Array.prototype.forEach.call(e.dataTransfer.files, subir);
  });
` : `
  // Sin el módulo Biblioteca de archivos no hay subida: las imágenes se cargan por URL.
  var drop = document.getElementById('pr-drop');
  drop.textContent = 'Activá el módulo "Biblioteca de archivos" para subir imágenes desde acá. Por ahora, pegá su URL abajo.';
  drop.style.cursor = 'default';
`}
  /* ---------- formulario ---------- */

  function sugerirSlug() {
    if (editando) return;
    var campo = document.getElementById('pr-slug');
    if (campo.dataset.tocado === '1') return;
    campo.value = document.getElementById('pr-name').value.toLowerCase()
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70);
    pintarUrl();
  }
  function pintarUrl() {
    document.getElementById('pr-url').textContent = '/producto/' + (document.getElementById('pr-slug').value || '…');
  }
  document.getElementById('pr-name').addEventListener('input', sugerirSlug);
  document.getElementById('pr-slug').addEventListener('input', function () { this.dataset.tocado = '1'; pintarUrl(); });

  function salirDeEdicion() {
    editando = '';
    form.reset();
    document.getElementById('pr-slug').dataset.tocado = '';
    document.getElementById('pr-track').checked = true;
    imagenes = [];
    pintarFotos();
    pintarUrl();
    document.getElementById('pr-form-titulo').textContent = 'Nuevo producto';
    document.getElementById('pr-guardar').textContent = 'Crear producto';
    document.getElementById('pr-cancelar').hidden = true;
    document.getElementById('pr-hist').innerHTML = '';
  }

  function editar(p) {
    editando = p.id;
    var v = { name: p.name, slug: p.slug, sku: p.sku, category: p.category, brand: p.brand,
      price: p.price, compareAt: p.compareAt || '', weight: p.weight || '',
      description: p.description, details: p.details, stock: p.stock };
    Object.keys(v).forEach(function (k) {
      var el = form.querySelector('[name="' + k + '"]');
      if (el) el.value = v[k] == null ? '' : v[k];
    });
    document.getElementById('pr-slug').dataset.tocado = '1';
    document.getElementById('pr-track').checked = p.trackStock !== false;
    document.getElementById('pr-backorder').checked = !!p.allowBackorder;
    document.getElementById('pr-featured').checked = !!p.featured;
    imagenes = (p.images || []).slice();
    pintarFotos();
    pintarUrl();
    document.getElementById('pr-form-titulo').textContent = 'Editando: ' + p.name;
    document.getElementById('pr-guardar').textContent = 'Guardar cambios';
    document.getElementById('pr-cancelar').hidden = false;
    form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    verHistorial(p.id);
  }

  async function verHistorial(id) {
    var caja = document.getElementById('pr-hist');
    if (window.__PREVIEW__) { caja.innerHTML = ''; return; }
    try {
      var out = await App.api('/api/products/' + id + '/stock');
      caja.innerHTML = out.rows.length
        ? '<h3 style="margin-top:30px">Movimientos de stock</h3>' + App.table(out.rows, [
            { label: 'Fecha', render: function (m) { return new Date(m.createdAt).toLocaleString('es-AR'); } },
            { label: 'Cambio', render: function (m) { return (m.delta > 0 ? '+' : '') + m.delta; } },
            { label: 'Queda', key: 'resultado' },
            { label: 'Motivo', key: 'motivo' },
            { label: 'Quién', render: function (m) { return App.esc(m.usuario || '—'); } },
          ])
        : '';
    } catch (err) { caja.innerHTML = ''; }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var datos = {
      name: document.getElementById('pr-name').value,
      slug: document.getElementById('pr-slug').value,
      sku: document.getElementById('pr-sku').value,
      category: document.getElementById('pr-category').value,
      brand: document.getElementById('pr-brand').value,
      price: Number(document.getElementById('pr-price').value),
      compareAt: Number(document.getElementById('pr-compare').value) || 0,
      weight: Number(document.getElementById('pr-weight').value) || 0,
      description: document.getElementById('pr-description').value,
      details: document.getElementById('pr-details').value,
      images: imagenes,
      stock: Number(document.getElementById('pr-stock').value) || 0,
      trackStock: document.getElementById('pr-track').checked,
      allowBackorder: document.getElementById('pr-backorder').checked,
      featured: document.getElementById('pr-featured').checked,
    };
    if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el producto'); return; }
    try {
      if (editando) await App.api('/api/products/' + editando, { method: 'PATCH', body: datos });
      else await App.api('/api/products', { method: 'POST', body: datos });
      App.toast(editando ? 'Producto actualizado' : 'Producto creado');
      salirDeEdicion();
      load();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  document.getElementById('pr-cancelar').addEventListener('click', salirDeEdicion);

  /* ---------- grilla ---------- */

  function chipStock(p) {
    if (!p.trackStock) return '<span class="pr-chip ok">Sin control de stock</span>';
    if (p.stock <= 0) return '<span class="pr-chip sin">Sin stock</span>' + (p.allowBackorder ? ' <span class="pr-chip baja">a pedido</span>' : '');
    if (p.stock <= 5) return '<span class="pr-chip poco">Quedan ' + p.stock + '</span>';
    return '<span class="pr-chip ok">' + p.stock + ' en stock</span>';
  }

  function filtrar() {
    var q = (document.getElementById('pr-q').value || '').toLowerCase().trim();
    var cat = document.getElementById('pr-f-cat').value;
    var est = document.getElementById('pr-f-est').value;
    return lista.filter(function (p) {
      if (cat && p.category !== cat) return false;
      if (est === 'activo' && p.active === false) return false;
      if (est === 'baja' && p.active !== false) return false;
      if (est === 'sin' && !(p.trackStock && p.stock <= 0)) return false;
      if (q && (p.name + ' ' + p.sku + ' ' + p.category + ' ' + p.brand).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function render() {
    var rows = filtrar();
    if (!rows.length) { box.innerHTML = '<p class="muted">No hay productos que coincidan.</p>'; return; }
    box.innerHTML = '<div class="pr-grid">' + rows.map(function (p) {
      var foto = (p.images && p.images[0])
        ? '<img src="' + App.esc(p.images[0].url) + '" alt="' + App.esc(p.images[0].alt || p.name) + '" loading="lazy">'
        : '<span style="font-size:.8rem">sin imagen</span>';
      return '<div class="pr-item"><div class="pr-foto">' + foto + '</div><div class="pr-cuerpo">' +
        '<strong>' + App.esc(p.name) + '</strong>' +
        '<span class="pr-meta">' + App.esc([p.sku, p.category, p.brand].filter(Boolean).join(' · ') || 'sin categoría') + '</span>' +
        '<span class="pr-precio">' + App.money(p.price) + (p.compareAt ? '<span class="pr-antes">' + App.money(p.compareAt) + '</span>' : '') + '</span>' +
        '<span>' + chipStock(p) + (p.active === false ? ' <span class="pr-chip baja">De baja</span>' : '') + (p.featured ? ' <span class="pr-chip baja">Destacado</span>' : '') + '</span>' +
        '</div><div class="pr-acc">' +
        '<button class="btn ghost" type="button" data-pr-edit="' + p.id + '">Editar</button>' +
        '<button class="btn ghost" type="button" data-pr-stock="' + p.id + '">Stock</button>' +
        (p.active === false
          ? '<button class="btn ghost" type="button" data-pr-alta="' + p.id + '">Reactivar</button>'
          : '<button class="btn ghost" type="button" data-pr-baja="' + p.id + '">Dar de baja</button>') +
        '</div></div>';
    }).join('') + '</div>';

    var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
    box.querySelectorAll('[data-pr-edit]').forEach(function (b) {
      b.addEventListener('click', function () { var p = buscar(b.getAttribute('data-pr-edit')); if (p) editar(p); });
    });
    box.querySelectorAll('[data-pr-stock]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var p = buscar(b.getAttribute('data-pr-stock'));
        if (!p) return;
        var v = prompt('Stock de "' + p.name + '" (ahora ' + p.stock + '). Escribí el número que queda:', String(p.stock));
        if (v === null) return;
        var motivo = prompt('¿Por qué? (recepción, rotura, conteo…)', 'Ajuste manual');
        if (motivo === null) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: se ajustaría el stock'); return; }
        try {
          await App.api('/api/products/' + p.id + '/stock', { method: 'POST', body: { set: Number(v), motivo: motivo } });
          App.toast('Stock actualizado');
          load();
          if (editando === p.id) verHistorial(p.id);
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
    box.querySelectorAll('[data-pr-baja]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('¿Dar de baja este producto? Deja de mostrarse en la tienda pero conserva su historial.')) return;
        try { await App.api('/api/products/' + b.getAttribute('data-pr-baja'), { method: 'DELETE' }); load(); }
        catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
    box.querySelectorAll('[data-pr-alta]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { await App.api('/api/products/' + b.getAttribute('data-pr-alta'), { method: 'PATCH', body: { active: true } }); load(); }
        catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
    aparecer(box.querySelectorAll('.pr-item'));
  }

  function pintarFiltros() {
    var cats = [];
    var marcas = [];
    lista.forEach(function (p) {
      if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category);
      if (p.brand && marcas.indexOf(p.brand) < 0) marcas.push(p.brand);
    });
    document.getElementById('pr-f-cat').innerHTML = '<option value="">Todas</option>' +
      cats.map(function (c) { return '<option>' + App.esc(c) + '</option>'; }).join('');
    document.getElementById('pr-cats').innerHTML = cats.map(function (c) { return '<option value="' + App.esc(c) + '">'; }).join('');
    document.getElementById('pr-marcas').innerHTML = marcas.map(function (m) { return '<option value="' + App.esc(m) + '">'; }).join('');
  }

  var DEMO = ${JSON.stringify(SEMILLA.map((p, i) => ({ id: 'd' + (i + 1), ...p })))};

  function load() {
    if (window.__PREVIEW__) { lista = DEMO.slice(); pintarFiltros(); render(); return; }
    App.api('/api/products?all=1').then(function (rows) {
      lista = rows;
      pintarFiltros();
      render();
    }).catch(function (err) { box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
  }

  ['pr-q', 'pr-f-cat', 'pr-f-est'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', render);
  });

  pintarFotos();
  pintarUrl();
  load();
})();`,
  readmeNotes: (cfg) => [
    `**Gestión de productos**: el catálogo maestro vive en \`data/products.json\`. Cada producto tiene **galería de imágenes** ${cfg.moduleIds.includes('uploads') ? '(se suben desde el panel — el archivo va a la Biblioteca de archivos y queda con una URL propia del sitio, sin hosting externo)' : '(por URL; activá el módulo **Biblioteca de archivos** para poder subirlas desde el panel)'}, **stock** con control opcional por producto (\`trackStock\`) y **slug propio** que le da su URL de ficha. Cada cambio de stock queda registrado en \`stockmoves\` con motivo y usuario: sin ese rastro, un faltante no se puede explicar. \`GET /api/products\` devuelve el arreglo de siempre; la búsqueda con filtros y paginación está en \`GET /api/products/buscar\`.`,
  ],
};
