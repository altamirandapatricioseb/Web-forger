const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'cart', type: 'functional', name: 'Carrito + Checkout',
  description: 'Catálogo de productos con API, carrito persistente en el navegador y checkout que genera órdenes validadas.',
  requires: ['auth'],
  nav: () => [{ label: 'Catálogo', href: '/catalog.html', badge: 'cart-count' }],
  mounts: (cfg) => [
    // Si Gestión de productos está activa, ella es la dueña de /api/products
    ...(cfg.moduleIds.includes('products-admin') ? [] : [{ route: '/api/products', file: 'routes/products.js' }]),
    { route: '/api/orders', file: 'routes/orders.js' },
  ],
  collections: ['products', 'orders'],
  pages: () => ({
    catalog: {
      title: 'Catálogo',
      html: `  <section>
    <div class="container">
      <h2>Catálogo</h2>
      <p class="section-sub">Agregá productos al carrito y finalizá la compra.</p>
      <div class="grid cols-3" id="product-grid"><p class="muted">Cargando productos…</p></div>
      <div class="card" id="cart-panel" style="margin-top:36px">
        <h3>Carrito</h3>
        <div id="cart-items" class="muted">Tu carrito está vacío.</div>

        <div id="cart-entrega" hidden style="margin-top:20px;padding-top:18px;border-top:1px solid var(--line)">
          <h4 style="margin:0 0 4px">¿Cómo lo recibís?</h4>
          <p class="muted" style="margin:0 0 12px;font-size:.86rem">Sin estos datos no podemos despachar el pedido.</p>
          <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:12px">
            <label style="display:flex;align-items:center;gap:7px;margin:0"><input type="radio" name="cart-metodo" value="envio" checked style="width:auto;margin:0"> Envío a domicilio</label>
            <label style="display:flex;align-items:center;gap:7px;margin:0"><input type="radio" name="cart-metodo" value="retiro" style="width:auto;margin:0"> Retiro en el local</label>
          </div>
          <div class="grid cols-2">
            <div><label for="cart-nombre">Nombre de quien recibe</label><input id="cart-nombre" maxlength="80" autocomplete="name"></div>
            <div><label for="cart-tel">Teléfono</label><input id="cart-tel" maxlength="30" autocomplete="tel" inputmode="tel"></div>
          </div>
          <div id="cart-campos-envio">
            <label for="cart-dir">Dirección (calle y número)</label>
            <input id="cart-dir" maxlength="160" autocomplete="street-address">
            <div class="grid cols-3">
              <div><label for="cart-ciudad">Localidad</label><input id="cart-ciudad" maxlength="80" autocomplete="address-level2"></div>
              <div><label for="cart-prov">Provincia</label><select id="cart-prov"><option value="">Elegí…</option></select></div>
              <div><label for="cart-cp">Código postal</label><input id="cart-cp" maxlength="8" autocomplete="postal-code"></div>
            </div>
          </div>
          <label for="cart-notas">Aclaraciones (opcional)</label>
          <input id="cart-notas" maxlength="300" placeholder="Timbre, horario preferido, referencia…">
          <div id="cart-envio-costo" class="muted" style="font-size:.88rem;margin-top:10px"></div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;gap:14px;flex-wrap:wrap">
          <strong id="cart-total"></strong>
          <button class="btn" id="checkout-btn">Finalizar compra</button>
        </div>
      </div>
    </div>
  </section>`,
    },
  }),
  files: (cfg) => ({
    'models/order.js': `const { check, str, num } = require('../src/validate');

/** Modelo Orden: items validados contra el catálogo real */
exports.validateItems = (items, productsById) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, errors: { items: 'El carrito está vacío' } };
  }
  const errors = {};
  for (const [i, item] of items.entries()) {
    if (!item || !productsById.has(item.productId)) errors['items.' + i] = 'Producto inexistente';
    else if (!num(item.qty, 1, 99)) errors['items.' + i] = 'Cantidad inválida (1 a 99)';
  }
  return { ok: Object.keys(errors).length === 0, errors };
};

exports.validateProduct = (data) => check(data, {
  name: (v) => str(v, 2, 120),
  price: (v) => num(v, 0.01),
  description: (v) => v === undefined || str(v, 0, 500),
});
`,
    ...(cfg.moduleIds.includes('products-admin') ? {} : {
    'routes/products.js': `const router = require('express').Router();
const db = require('../src/db');
const Order = require('../models/order');
const { requireAdmin } = require('../src/middleware/auth');

// Datos de ejemplo la primera vez
db.seedIfEmpty('products', [
  { name: 'Producto Clásico', price: 4999, description: 'El favorito de siempre.' },
  { name: 'Producto Premium', price: 9999, description: 'Calidad superior, terminación impecable.' },
  { name: 'Producto Edición Limitada', price: 14999, description: 'Serie numerada, stock reducido.' },
  { name: 'Combo Inicial', price: 7499, description: 'Todo lo necesario para arrancar.' },
]);

// GET /api/products — catálogo público
router.get('/', async (req, res) => res.json((await db.all('products'))));

// POST /api/products — alta (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = Order.validateProduct(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const { name, price, description = '' } = req.body;
  res.status(201).json((await db.insert('products', { name, price, description })));
});

module.exports = router;
`,
    }),
    'routes/orders.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const Order = require('../models/order');
const { requireAuth } = require('../src/middleware/auth');
${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}${cfg.moduleIds.includes('products-admin') ? `const { disponible } = require('./products');
` : ''}${cfg.moduleIds.includes('shipping') ? `
// Provincias válidas para el envío: la misma lista que usa el cotizador
const PROVINCIAS = ['CABA', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];
` : ''}
// El código del pedido: es lo que el cliente usa para seguirlo. Mismo formato que el módulo
// Seguimiento de pedidos, a propósito — comparten la colección \`orders\`, así que un pedido hecho
// en el checkout aparece en /seguimiento.html sin que haya que copiarlo a ninguna parte.
const genCode = () => 'OT-' + crypto.randomBytes(3).toString('hex').toUpperCase();

/** Datos de entrega. Sin esto un pedido no se puede despachar: es tan parte del checkout como el
 *  carrito. Se valida acá porque el navegador puede mandar cualquier cosa. */
function leerEntrega(body) {
  const e = (body && body.entrega) || {};
  const metodo = e.metodo === 'retiro' ? 'retiro' : 'envio';
  const nombre = String(e.nombre || '').trim();
  const telefono = String(e.telefono || '').trim();
  if (nombre.length < 2 || nombre.length > 80) return { ok: false, error: 'Poné el nombre de quien recibe (entre 2 y 80 caracteres)' };
  if (telefono.length < 6 || telefono.length > 30) return { ok: false, error: 'Poné un teléfono de contacto' };
  const out = { metodo, nombre, telefono, notas: String(e.notas || '').trim().slice(0, 300) };
  if (metodo === 'envio') {
    const direccion = String(e.direccion || '').trim();
    const ciudad = String(e.ciudad || '').trim();
    const cp = String(e.cp || '').trim();
    if (direccion.length < 5) return { ok: false, error: 'Poné la dirección de entrega (calle y número)' };
    if (ciudad.length < 2) return { ok: false, error: 'Poné la localidad' };
    if (!/^[0-9A-Za-z]{4,8}$/.test(cp)) return { ok: false, error: 'Poné un código postal válido' };
${cfg.moduleIds.includes('shipping') ? `    const provincia = String(e.provincia || '').trim();
    if (!PROVINCIAS.includes(provincia)) return { ok: false, error: 'Elegí una provincia de la lista' };
    Object.assign(out, { direccion: direccion.slice(0, 160), ciudad: ciudad.slice(0, 80), cp, provincia });
` : `    Object.assign(out, { direccion: direccion.slice(0, 160), ciudad: ciudad.slice(0, 80), cp, provincia: String(e.provincia || '').trim().slice(0, 60) });
`}  }
  return { ok: true, entrega: out };
}

// POST /api/orders — checkout: valida items contra el catálogo y calcula el total en el servidor
router.post('/', requireAuth, async (req, res) => {
  const productsById = new Map((await db.all('products')).map(p => [p.id, p]));
  const { ok, errors } = Order.validateItems(req.body.items, productsById);
  if (!ok) return res.status(422).json({ error: 'Carrito inválido', errors });

  const entregaLeida = leerEntrega(req.body);
  if (!entregaLeida.ok) return res.status(422).json({ error: entregaLeida.error });
  const entrega = entregaLeida.entrega;

${cfg.moduleIds.includes('variantes') ? `  // Variantes (talle, color): la combinación se resuelve en el SERVIDOR — que exista, que sea de
  // ese producto, que esté activa y que alcance el stock. El sobreprecio también sale de acá: el
  // navegador dice QUÉ compra, nunca CUÁNTO vale. Un item sin variante en un producto que las
  // exige se rechaza: vender "una remera" sin talle es un pedido que después hay que resolver
  // por teléfono.
  const V = require('../src/variantes');
  const items = [];
  for (const i of req.body.items) {
    const p = productsById.get(i.productId);
    const r = await V.resolver(p.id, i.variantId || null, i.qty);
    if (!r.ok) return res.status(409).json({ error: p.name + ': ' + r.error });
    items.push({
      productId: p.id,
      // El nombre lleva la combinación adentro a propósito: los paneles, el CSV, el email de
      // aviso y el seguimiento leen \`name\` y así los cuatro dicen el talle sin tocar ninguno.
      name: p.name + (r.label ? ' (' + r.label + ')' : ''),
      unitPrice: Math.round((Number(p.price) + r.priceDelta) * 100) / 100,
      qty: i.qty,
      variantId: r.variantId, variantLabel: r.label,
    });
  }
` : `  const items = req.body.items.map(i => {
    const p = productsById.get(i.productId);
    return { productId: p.id, name: p.name, unitPrice: p.price, qty: i.qty };
  });
`}${cfg.moduleIds.includes('products-admin') ? `
  // Stock: se valida ANTES de cobrar nada. Sin este control el checkout vende infinito y el
  // negocio se entera al querer despachar. Se informa producto por producto qué falta, porque
  // "no hay stock" a secas obliga al cliente a adivinar cuál de los cinco items es.
  const faltantes = [];
  for (const i of items) {
    const p = productsById.get(i.productId);
    const d = disponible(p);
    if (!d.comprable) { faltantes.push({ name: p.name, pedido: i.qty, disponible: 0 }); continue; }
    if (d.cantidad !== Infinity && i.qty > d.cantidad) faltantes.push({ name: p.name, pedido: i.qty, disponible: d.cantidad });
  }
  if (faltantes.length) {
    return res.status(409).json({
      error: 'No hay stock suficiente: ' + faltantes.map(f => f.name + ' (pediste ' + f.pedido + ', hay ' + f.disponible + ')').join('; '),
      faltantes,
    });
  }
` : ''}  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
${cfg.moduleIds.includes('descuentos') ? `  // Descuentos automáticos (módulo Descuentos): se usa EL MISMO motor que pinta el carrito, así
  // el importe que el visitante vio antes de apretar "Finalizar compra" es el que se guarda.
  const promo = await require('../src/descuentos').calcular(req.body.items);
  const promoDiscount = promo.descuento;
  const promos = promo.descuentos;
` : `  const promoDiscount = 0;
`}${cfg.moduleIds.includes('coupons') ? `  // Cupón de descuento: se valida y descuenta en el servidor. Va DESPUÉS de los descuentos
  // automáticos, sobre el importe ya rebajado: al revés, dos promociones del 50% regalarían el pedido.
  const Coupon = require('../models/coupon');
  let discount = 0, couponCode = null;
  if (req.body.couponCode) {
    const coupon = (await db.find('coupons', c => c.code === String(req.body.couponCode).toUpperCase().trim()))[0];
    const st = Coupon.status(coupon);
    if (!st.ok) return res.status(422).json({ error: st.reason });
    discount = Math.round((subtotal - promoDiscount) * coupon.percent / 100);
    couponCode = coupon.code;
    (await db.update('coupons', coupon.id, { uses: (coupon.uses || 0) + 1 }));
  }
` : `  const discount = 0;
  const couponCode = null;
`}${cfg.moduleIds.includes('shipping') ? `  // Costo de envío: lo resuelve el SERVIDOR buscando la zona de esa provincia, con la misma
  // regla que el cotizador público. El navegador manda a dónde va el pedido, nunca cuánto sale.
  let shippingCost = 0;
  let shippingZone = '';
  let shippingDays = 0;
  if (entrega.metodo === 'envio') {
    const zona = (await db.all('shippingzones')).find(z => Array.isArray(z.provinces) && z.provinces.includes(entrega.provincia));
    if (!zona) return res.status(422).json({ error: 'Todavía no tenemos configurado el envío a esa provincia. Escribinos y lo coordinamos.' });
    shippingZone = zona.name;
    shippingDays = Number(zona.days) || 0;
    // El envío gratis se decide sobre el importe DESPUÉS de descuentos: es lo que el cliente paga
    const base = Math.max(0, subtotal - promoDiscount - discount);
    shippingCost = (zona.freeFrom && base >= Number(zona.freeFrom)) ? 0 : (Number(zona.cost) || 0);
  }
` : `  const shippingCost = 0;
  const shippingZone = '';
  const shippingDays = 0;
`}
  const total = Math.max(0, subtotal - promoDiscount - discount) + shippingCost;
  const order = await db.insert('orders', {
    // Campos del pedido en sí
    userId: req.user.sub, items, subtotal,${cfg.moduleIds.includes('descuentos') ? ' promos, promoDiscount,' : ' promoDiscount,'}
    coupon: couponCode, discount,
    entrega, shippingCost, shippingZone, shippingDays,
    total,
    // Campos que comparte con el módulo Seguimiento de pedidos: mismo código, mismos estados.
    // Así el cliente sigue su compra en /seguimiento.html sin que nadie copie nada a mano.
    code: genCode(),
    customer: entrega.nombre,
    email: req.user.email || '',
    detail: items.map(i => i.qty + '× ' + i.name).join(', '),
    status: 'recibido',
    note: '',
    origen: 'tienda',
    updatedAt: new Date().toISOString(),
  });
${cfg.moduleIds.includes('products-admin') ? `
  // Recién ahora se descuenta el stock: con el pedido ya guardado, para que un error al escribir
  // no deje unidades restadas sin venta que las explique. Cada descuento queda registrado.
  for (const i of items) {
    const p = productsById.get(i.productId);
${cfg.moduleIds.includes('variantes') ? `    // Línea con variante: descuenta la COMBINACIÓN y deja que el motor reescriba el stock del
    // producto con la suma. Hay que pasar por ahí y no por el bloque de abajo porque un mismo
    // producto puede aparecer en dos líneas (talle S y talle M) y \`productsById\` es una foto
    // vieja: la segunda resta pisaría a la primera y una de las dos unidades no se descontaría.
    if (i.variantId) {
      await V.mover(p.id, i.variantId, -i.qty, 'Venta ' + order.code, req.user.email || '');
      continue;
    }
` : ''}    if (p.trackStock === false) continue;
    const queda = Math.max(0, (Number(p.stock) || 0) - i.qty);
    await db.update('products', p.id, { stock: queda });
    await db.insert('stockmoves', {
      productId: p.id, delta: -i.qty, motivo: 'Venta ' + order.code,
      usuario: req.user.email || '', resultado: queda,
    });
  }
` : ''}${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): entró un pedido nuevo.
  // Es "disparar y seguir": un email caído jamás rompe el checkout.
  mailer.notify('Nuevo pedido ' + order.code + ' por $' + order.total.toLocaleString('es-AR'), (req.user.name || 'Un cliente') + ' (' + (req.user.email || 'sin email') + ') hizo un pedido de ' + items.map(i => i.qty + '× ' + i.name).join(', ') + ' por $' + order.total.toLocaleString('es-AR') + '. Entrega: ' + (entrega.metodo === 'retiro' ? 'retira en el local' : entrega.direccion + ', ' + entrega.ciudad) + '. Gestionalo desde el panel de pedidos.').catch(() => {});
` : ''}  res.status(201).json(order);
});
${cfg.moduleIds.includes('shipping') ? `
// POST /api/orders/cotizar — costo de envío de ESTE carrito antes de comprar (público para quien
// tenga sesión). Es el mismo cálculo que aplica el checkout: el visitante ve el total final antes
// de confirmar, no después.
router.post('/cotizar', requireAuth, async (req, res) => {
  const productsById = new Map((await db.all('products')).map(p => [p.id, p]));
  const items = (Array.isArray(req.body.items) ? req.body.items : []).slice(0, 200)
    .map(i => ({ p: productsById.get(i && i.productId), qty: Math.round(Number(i && i.qty)), variantId: (i && i.variantId) || null }))
    .filter(x => x.p && x.qty >= 1 && x.qty <= 99);
${cfg.moduleIds.includes('variantes') ? `  // El sobreprecio de la variante entra también acá: si el umbral de envío gratis se midiera
  // contra un subtotal sin los deltas, la barra diría "te faltan $300" y el checkout cobraría el
  // envío igual. Un número que promete algo distinto de lo que se cobra es peor que ningún número.
  const V = require('../src/variantes');
  let subtotal = 0;
  for (const x of items) {
    let precio = Number(x.p.price) || 0;
    if (x.variantId) {
      const set = await V.cargar(x.p.id);
      const v = set && set.variantes.find(y => y.id === x.variantId && y.active);
      if (v) precio += v.priceDelta;
    }
    subtotal += precio * x.qty;
  }
` : `  const subtotal = items.reduce((s, x) => s + (Number(x.p.price) || 0) * x.qty, 0);
`}
  const provincia = String(req.body.provincia || '').trim();
  if (!PROVINCIAS.includes(provincia)) return res.status(422).json({ error: 'Elegí una provincia de la lista' });
  const zona = (await db.all('shippingzones')).find(z => Array.isArray(z.provinces) && z.provinces.includes(provincia));
  if (!zona) return res.status(404).json({ error: 'Todavía no tenemos configurado el envío a esa provincia. Escribinos y lo coordinamos.' });
${cfg.moduleIds.includes('descuentos') ? `  const promoDiscount = (await require('../src/descuentos').calcular(req.body.items)).descuento;
` : `  const promoDiscount = 0;
`}  const base = Math.max(0, subtotal - promoDiscount);
  const gratis = !!(zona.freeFrom && base >= Number(zona.freeFrom));
  res.json({
    zona: zona.name, dias: Number(zona.days) || 0,
    costo: gratis ? 0 : (Number(zona.cost) || 0),
    gratis, freeFrom: Number(zona.freeFrom) || 0,
    subtotal, promoDiscount, total: base + (gratis ? 0 : (Number(zona.cost) || 0)),
  });
});
` : ''}

// GET /api/orders — las propias (o todas si es admin con ?all=1)
router.get('/', requireAuth, async (req, res) => {
  const all = req.query.all === '1' && req.user.role === 'admin';
  res.json(all ? (await db.all('orders')) : (await db.find('orders', o => o.userId === req.user.sub)));
});

module.exports = router;
`,
  }),
  clientJs: (cfg) => `/* Módulo carrito + checkout */
(function () {
  const CART_KEY = 'cart';
  const getCart = () => JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  // Punto de entrada para el resto del sitio: cada cambio del carrito avisa con el evento
  // 'wf:cart' (detail = items). Lo escuchan los módulos que reaccionan al carrito sin
  // duplicar su lógica ni espiar el localStorage (envío gratis, recomendados).
  const avisar = (c) => { try { document.dispatchEvent(new CustomEvent('wf:cart', { detail: c })); } catch (e) {} };
  const setCart = (c) => { localStorage.setItem(CART_KEY, JSON.stringify(c)); renderBadge(); renderCart(); avisar(c); };

  function renderBadge() {
    const badge = document.getElementById('cart-count');
    if (badge) badge.textContent = getCart().reduce((s, i) => s + i.qty, 0);
  }
  renderBadge();

  // Punto de entrada para los módulos que agregan al carrito desde OTRA página (la ficha de
  // producto, el catálogo con filtros). Sin esto cada uno reimplementaría el formato del
  // localStorage y el evento 'wf:cart', y el día que cambie uno se rompen todos en silencio.
  window.WFCart = {
    // El tercer argumento es opcional y sólo lo manda la ficha cuando el producto se vende por
    // variantes (talle, color): dos talles distintos del mismo producto son DOS líneas del
    // carrito, no una con cantidad 2. Sin la variante en la clave, elegir M después de S
    // pisaría la línea anterior y el pedido saldría con el talle equivocado.
    agregar: function (productId, qty, variantId) {
      const cart = getCart();
      const n = Math.max(1, Math.min(99, Math.round(Number(qty) || 1)));
      const vid = variantId || null;
      const found = cart.find(i => i.productId === productId && (i.variantId || null) === vid);
      if (found) found.qty = Math.min(99, found.qty + n);
      else cart.push(vid ? { productId: productId, qty: n, variantId: vid } : { productId: productId, qty: n });
      setCart(cart);
      return cart;
    },
    obtener: getCart,
    vaciar: function () { setCart([]); },
    // Punto de entrada para los módulos que cambian cómo se MUESTRA una línea sin cambiar el
    // carrito. Hoy lo usa Variantes: el nombre de la combinación y su sobreprecio llegan en una
    // consulta aparte que puede resolverse DESPUÉS de que el carrito ya se pintó, y sin esto la
    // línea se queda diciendo "(opción)" con el precio sin el sobreprecio hasta el próximo cambio.
    refrescar: function () { renderBadge(); renderCart(); },
  };
  // Estado inicial para los módulos que escuchan 'wf:cart': se emite en el próximo tick
  // para que sus listeners ya estén enganchados (todos los clientJs corren sincrónicos).
  setTimeout(() => avisar(getCart()), 0);

  const grid = document.getElementById('product-grid');
  if (!grid) return;

  let products = [];
  function renderCart() {
    const box = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    // Fuera del catálogo no hay caja del carrito: WFCart.refrescar() se puede llamar desde
    // cualquier página (la ficha, la tienda) y no puede reventar por eso
    if (!box || !totalEl) return;
    const cart = getCart();
    if (!cart.length) { box.innerHTML = 'Tu carrito está vacío.'; totalEl.textContent = ''; return; }
    const byId = new Map(products.map(p => [p.id, p]));
    let total = 0;
    box.innerHTML = cart.map((i, idx) => {
      const p = byId.get(i.productId) || { name: '(producto)', price: 0 };
      // Con variantes activas, la línea vale el precio del producto MÁS el sobreprecio de la
      // combinación. Es sólo para mostrar: el importe que se cobra lo recalcula el servidor al
      // confirmar, contra sus propios datos y nunca contra lo que diga este navegador.
      const inf = (window.WFVariantes && i.variantId) ? window.WFVariantes.info(i.variantId) : null;
      const precio = p.price + (inf ? (inf.priceDelta || 0) : 0);
      const etiqueta = inf ? ' (' + inf.label + ')' : (i.variantId ? ' (opción)' : '');
      total += precio * i.qty;
      return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)">' +
        '<span>' + p.name + etiqueta + ' × ' + i.qty + '</span>' +
        '<span>' + App.money(precio * i.qty) + ' <a href="#" data-remove="' + idx + '" aria-label="Quitar del carrito" style="display:inline-flex;vertical-align:middle">${phIcon('x', { size: 14 })}</a></span></div>';
    }).join('');
    totalEl.textContent = 'Total: ' + App.money(total);
    box.querySelectorAll('[data-remove]').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      const c = getCart(); c.splice(Number(a.dataset.remove), 1); setCart(c);
    }));
  }

  // ¿Se puede comprar? Misma regla que el servidor: si el producto controla stock y no acepta
  // pedidos a pedido, sin unidades no hay botón. Mostrar "Agregar" en algo que el checkout va a
  // rechazar es hacerle perder el tiempo a quien quería comprar.
  function comprable(p) {
    if (p.active === false) return false;
    if (p.trackStock === false || p.allowBackorder) return true;
    return p.stock === undefined || Number(p.stock) > 0;
  }

  function renderProducts() {
    grid.innerHTML = products.map((p, i) => {
      // Las primeras no se difieren: están sobre el pliegue y una de ellas es el elemento más
      // grande de la pantalla (el LCP que mide Google). Diferir lo que ya está a la vista sólo
      // hace que la página tarde más en verse terminada.
      const carga = i < 3 ? (i === 0 ? ' fetchpriority="high"' : '') : ' loading="lazy"';
      const foto = (p.images && p.images[0])
        ? '<img src="' + App.esc(p.images[0].url) + '" alt="' + App.esc(p.images[0].alt || p.name) + '"' + carga + ' style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:calc(var(--radius) - 3px);margin-bottom:12px;display:block">'
        : '';
      // El nombre enlaza a la ficha sólo si el producto tiene su dirección propia (módulo
      // Gestión de productos); sin slug, la ficha no existe y un enlace roto es peor que ninguno.
      const titulo = p.slug
        ? '<h3 style="margin:0 0 6px"><a href="/producto/' + App.esc(p.slug) + '" style="color:inherit;text-decoration:none">' + App.esc(p.name) + '</a></h3>'
        : '<h3 style="margin:0 0 6px">' + App.esc(p.name) + '</h3>';
      const precio = '<span class="price">' + App.money(p.price) + '</span>' +
        (p.compareAt ? ' <span class="muted" style="text-decoration:line-through;font-size:.86rem">' + App.money(p.compareAt) + '</span>' : '');
      const puede = comprable(p);
      const poco = puede && p.trackStock !== false && !p.allowBackorder && Number(p.stock) > 0 && Number(p.stock) <= 5
        ? '<p class="muted" style="margin:0 0 8px;font-size:.8rem">¡Quedan ' + p.stock + '!</p>' : '';
      const boton = puede
        ? '<button class="btn" data-add="' + p.id + '">Agregar</button>'
        : '<button class="btn ghost" type="button" disabled aria-disabled="true">Sin stock</button>';
      return '<div class="card">' + foto + titulo +
        '<p class="muted">' + App.esc(p.description || '') + '</p>' + poco +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' + precio + boton + '</div></div>';
    }).join('');
    grid.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
      const cart = getCart();
      const found = cart.find(i => i.productId === b.dataset.add);
      if (found) found.qty++; else cart.push({ productId: b.dataset.add, qty: 1 });
      setCart(cart);
      App.toast('Agregado al carrito');
    }));
  }

  if (window.__PREVIEW__) {
    products = [
      { id: 'demo1', name: 'Producto Clásico', price: 4999, description: 'El favorito de siempre.' },
      { id: 'demo2', name: 'Producto Premium', price: 9999, description: 'Calidad superior.' },
      { id: 'demo3', name: 'Edición Limitada', price: 14999, description: 'Stock reducido.' },
    ];
    renderProducts(); renderCart();
  } else {
    App.api('/api/products').then(list => { products = list; renderProducts(); renderCart(); })
      .catch(() => grid.innerHTML = '<p class="muted">No se pudieron cargar los productos.</p>');
  }

  /* ---------- datos de entrega ---------- */

  const panelEntrega = document.getElementById('cart-entrega');

  // El bloque de entrega aparece recién cuando hay algo en el carrito: pedirle la dirección a
  // alguien que todavía no eligió nada es la forma más rápida de que se vaya.
  function mostrarEntrega() {
    if (!panelEntrega) return;
    panelEntrega.hidden = getCart().length === 0;
  }
  document.addEventListener('wf:cart', mostrarEntrega);

  function metodo() {
    const el = document.querySelector('input[name="cart-metodo"]:checked');
    return el ? el.value : 'envio';
  }

  function datosEntrega() {
    return {
      metodo: metodo(),
      nombre: (document.getElementById('cart-nombre') || {}).value || '',
      telefono: (document.getElementById('cart-tel') || {}).value || '',
      direccion: (document.getElementById('cart-dir') || {}).value || '',
      ciudad: (document.getElementById('cart-ciudad') || {}).value || '',
      provincia: (document.getElementById('cart-prov') || {}).value || '',
      cp: (document.getElementById('cart-cp') || {}).value || '',
      notas: (document.getElementById('cart-notas') || {}).value || '',
    };
  }

  if (panelEntrega) {
    // Retirar en el local no lleva dirección: dejar los campos pidiendo datos que no hacen falta
    // es la causa número uno de checkouts abandonados a mitad de camino.
    function ajustarMetodo() {
      const esRetiro = metodo() === 'retiro';
      document.getElementById('cart-campos-envio').hidden = esRetiro;
      cotizar();
    }
    document.querySelectorAll('input[name="cart-metodo"]').forEach(r => r.addEventListener('change', ajustarMetodo));

    // Se recuerdan los datos de entrega en este navegador: quien compra dos veces no vuelve a
    // tipear su dirección. Nunca salen del dispositivo salvo al confirmar el pedido.
    const CLAVE_ENTREGA = 'wf-entrega';
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_ENTREGA) || 'null');
      if (guardado) {
        const campos = { 'cart-nombre': 'nombre', 'cart-tel': 'telefono', 'cart-dir': 'direccion', 'cart-ciudad': 'ciudad', 'cart-cp': 'cp' };
        Object.keys(campos).forEach(id => { const el = document.getElementById(id); if (el && guardado[campos[id]]) el.value = guardado[campos[id]]; });
      }
    } catch (e) {}
${cfg.moduleIds.includes('shipping') ? `
    // Provincias del cotizador: la lista la manda el servidor, así no se duplica acá
    const selProv = document.getElementById('cart-prov');
    if (window.__PREVIEW__) {
      selProv.innerHTML = '<option value="">Elegí…</option><option>CABA</option><option>Buenos Aires</option><option>Córdoba</option>';
    } else {
      fetch('/api/shipping/provinces').then(r => r.json()).then(list => {
        selProv.innerHTML = '<option value="">Elegí…</option>' + list.map(p => '<option>' + App.esc(p) + '</option>').join('');
        try {
          const g = JSON.parse(localStorage.getItem(CLAVE_ENTREGA) || 'null');
          if (g && g.provincia) { selProv.value = g.provincia; cotizar(); }
        } catch (e) {}
      }).catch(() => {});
    }
    selProv.addEventListener('change', cotizar);

    // El costo del envío se muestra ANTES de confirmar, calculado por el servidor con la misma
    // regla que va a aplicar el checkout: nadie tiene que enterarse del envío después de comprar.
    let cotizando = false;
    let cotizaPendiente = false;
    async function cotizar() {
      const caja = document.getElementById('cart-envio-costo');
      if (!caja) return;
      if (metodo() === 'retiro') { caja.textContent = 'Retirás en el local: sin costo de envío.'; return; }
      const prov = selProv.value;
      const cart = getCart();
      if (!prov || !cart.length) { caja.textContent = ''; return; }
      if (window.__PREVIEW__) { caja.textContent = 'Vista previa: acá se muestra el costo del envío.'; return; }
      if (cotizando) { cotizaPendiente = true; return; }
      cotizando = true;
      try {
        do {
          cotizaPendiente = false;
          const r = await App.api('/api/orders/cotizar', { method: 'POST', body: { items: getCart(), provincia: selProv.value } });
          caja.textContent = r.gratis
            ? 'Envío GRATIS a ' + r.zona + ' (llega en ' + r.dias + ' días hábiles).'
            : 'Envío a ' + r.zona + ': ' + App.money(r.costo) + ' — llega en ' + r.dias + ' días hábiles' +
              (r.freeFrom ? '. Gratis desde ' + App.money(r.freeFrom) + '.' : '.');
        } while (cotizaPendiente);
      } catch (err) { caja.textContent = err.message === 'preview' ? '' : err.message; }
      finally { cotizando = false; }
    }
    document.addEventListener('wf:cart', cotizar);
` : `
    document.getElementById('cart-prov').closest('div').hidden = true;
    function cotizar() {}
`}
    ajustarMetodo();
    mostrarEntrega();
  }

  document.getElementById('checkout-btn').addEventListener('click', async () => {
    const cart = getCart();
    if (!cart.length) return App.toast('Tu carrito está vacío');
    if (!localStorage.getItem('token') && !window.__PREVIEW__) { location.href = '/auth.html'; return; }
    const entrega = datosEntrega();
    try {
      const body = { items: cart, entrega };
      const coupon = localStorage.getItem('couponCode');
      if (coupon) body.couponCode = coupon;
      const order = await App.api('/api/orders', { method: 'POST', body });
      // Los datos de entrega quedan para la próxima compra (en este navegador, no en el servidor)
      try { localStorage.setItem('wf-entrega', JSON.stringify(entrega)); } catch (e) {}
      setCart([]);
      localStorage.removeItem('couponCode');
      App.toast('¡Compra confirmada! Pedido ' + order.code + ' por ' + App.money(order.total) + '. Seguilo en /seguimiento.html');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
})();`,
};
