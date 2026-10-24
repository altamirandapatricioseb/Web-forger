// Gestión de pedidos: la trastienda de la tienda. El checkout guardaba la orden y ahí se terminaba
// todo — no había ninguna pantalla donde el negocio viera qué le compraron, a dónde va, qué falta
// despachar ni cuánto vendió. El módulo Seguimiento de pedidos tenía un panel, pero para pedidos
// que el negocio cargaba A MANO: no mostraba los items, ni el total, ni la dirección, ni el medio
// de entrega, porque esos pedidos no venían de ningún checkout.
//
// Acá el negocio ve los pedidos REALES del carrito: qué compraron, cuánto pagaron, a dónde va, qué
// descuentos se aplicaron y en qué estado está cada uno. Comparte la colección `orders` y los
// mismos estados que Seguimiento de pedidos, así el cliente sigue su compra en /seguimiento.html
// con el código que le dio el checkout, sin que nadie copie nada de un lado a otro.
//
// Dos decisiones que importan:
//   1. CANCELAR REPONE EL STOCK. Un pedido cancelado cuyas unidades no vuelven al catálogo es
//      mercadería que existe y que el sistema cree vendida: se deja de vender algo que está en el
//      depósito. La reposición queda registrada en el historial del producto con el número de
//      pedido, y es IDEMPOTENTE — cancelar dos veces no duplica las unidades (se marca el pedido
//      con `stockRepuesto` y el segundo intento devuelve 409).
//   2. EL PEDIDO NO SE EDITA. Los items, los precios y los totales quedan como se cobraron. Lo que
//      cambia es el estado, la nota para el cliente y el número de seguimiento del correo. Un
//      panel que deja reescribir el importe de una venta ya hecha es un agujero contable.
//
// Los importes que muestra el resumen (vendido, a despachar, ticket promedio) se calculan al leer
// sobre los pedidos no cancelados: no hay un contador guardado que se pueda desincronizar.
// Panel /pedidos-admin.html con KPIs animados (Anime.js) + red de seguridad y exportación a CSV.
const { phIcon } = require('../../src/icons');

// Los mismos estados que el módulo Seguimiento de pedidos, a propósito: comparten la colección
// `orders` y el cliente ve el avance con el código que le dio el checkout.
const ESTADOS = [
  { id: 'recibido', label: 'Recibido' },
  { id: 'preparacion', label: 'En preparación' },
  { id: 'enviado', label: 'Enviado' },
  { id: 'entregado', label: 'Entregado' },
];

module.exports = {
  id: 'pedidos', type: 'functional', name: 'Gestión de pedidos',
  description: 'El panel donde el negocio ve y despacha los pedidos REALES del checkout: qué compraron, cuánto pagaron, qué descuentos se aplicaron, a dónde va (envío a domicilio con dirección completa o retiro en el local) y en qué estado está cada uno. Comparte la colección orders y los estados con Seguimiento de pedidos, así el cliente sigue su compra con el código que le dio el checkout. Cancelar un pedido REPONE EL STOCK de forma idempotente y queda registrado en el historial del producto. Los items y los importes no se pueden editar: un panel que deja reescribir una venta ya cobrada es un agujero contable. KPIs de vendido, a despachar y ticket promedio calculados al leer, filtros por estado y exportación a CSV. Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth', 'cart'],
  mounts: [{ route: '/api/pedidos', file: 'routes/pedidos.js' }],
  nav: () => [{ label: 'Pedidos', href: '/pedidos-admin.html', id: 'nav-pedidos' }],
  head: () => `  <style>
    .pd-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:14px;margin:22px 0}
    .pd-kpis .card{text-align:center}
    .pd-kpis strong{display:block;font-size:1.7rem;font-variant-numeric:tabular-nums}
    .pd-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0 16px}
    .pd-tabs button{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 15px;cursor:pointer;font:inherit;font-size:.88rem;color:inherit}
    .pd-tabs button.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:700}
    .pd-fila{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);padding:15px 17px;margin-bottom:11px}
    .pd-cab{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;cursor:pointer}
    .pd-code{font-family:ui-monospace,'Cascadia Code','Courier New',monospace;font-weight:700;letter-spacing:.03em}
    .pd-est{display:inline-block;font-size:.73rem;padding:2px 10px;border-radius:999px;font-weight:700}
    .pd-est.recibido{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .pd-est.preparacion{background:#e6a80020;color:#8a6400}
    .pd-est.enviado{background:#2e9e5b20;color:#1d6b3c}
    .pd-est.entregado{background:#2e9e5b20;color:#1d6b3c}
    .pd-est.cancelado{background:#c0392b18;color:#c0392b}
    .pd-total{font-variant-numeric:tabular-nums;font-weight:700;font-size:1.05rem}
    .pd-cuerpo{display:none;margin-top:15px;padding-top:15px;border-top:1px solid var(--line)}
    .pd-fila.abierta .pd-cuerpo{display:block}
    .pd-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}
    .pd-items{list-style:none;padding:0;margin:0;font-size:.9rem}
    .pd-items li{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:1px solid var(--line)}
    .pd-tot{list-style:none;padding:0;margin:10px 0 0;font-size:.9rem}
    .pd-tot li{display:flex;justify-content:space-between;gap:12px;padding:3px 0}
    .pd-tot li.fuerte{border-top:1px solid var(--line);margin-top:6px;padding-top:8px;font-weight:700;font-size:1rem}
    .pd-dir{font-size:.9rem;line-height:1.6}
    .pd-acc{display:flex;gap:7px;flex-wrap:wrap;margin-top:16px}
    .pd-acc .btn{width:auto;padding:6px 13px;font-size:.85rem}
    .pd-vacio{text-align:center;padding:40px 20px;color:var(--muted)}
  </style>`,
  files: (cfg) => ({
    'routes/pedidos.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');
${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
const ESTADOS = ${JSON.stringify(ESTADOS)};
const IDS = ESTADOS.map(e => e.id);
const labelDe = (id) => (ESTADOS.find(e => e.id === id) || {}).label || id;

/** Sólo los pedidos que salieron del checkout: los que tienen items. El módulo Seguimiento de
 *  pedidos comparte esta colección con pedidos cargados a mano (sin items), y mezclarlos haría
 *  que el resumen de ventas sume cosas que nunca se cobraron. */
const esDeTienda = (o) => Array.isArray(o.items) && o.items.length > 0;

const vista = (o) => ({
  id: o.id, code: o.code || '', status: o.status || 'recibido', statusLabel: labelDe(o.status),
  cancelado: o.status === 'cancelado',
  customer: o.customer || '', email: o.email || '',
  items: o.items || [],
  subtotal: Number(o.subtotal) || 0,
  promoDiscount: Number(o.promoDiscount) || 0,
  promos: Array.isArray(o.promos) ? o.promos : [],
  coupon: o.coupon || null, discount: Number(o.discount) || 0,
  shippingCost: Number(o.shippingCost) || 0, shippingZone: o.shippingZone || '', shippingDays: Number(o.shippingDays) || 0,
  entrega: o.entrega || null,
  total: Number(o.total) || 0,
  note: o.note || '', tracking: o.tracking || '',
  stockRepuesto: !!o.stockRepuesto,
  createdAt: o.createdAt, updatedAt: o.updatedAt || o.createdAt,
});

// GET /api/pedidos — los pedidos del checkout, del más nuevo al más viejo (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  let rows = (await db.all('orders')).filter(esDeTienda).map(vista)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const todos = rows;
  if (req.query.status) rows = rows.filter(o => o.status === req.query.status);

  // El resumen se calcula al leer sobre los NO cancelados. Un contador guardado se desincroniza
  // el día que alguien cancela un pedido y nadie se acuerda de restarlo.
  const validos = todos.filter(o => !o.cancelado);
  const vendido = validos.reduce((s, o) => s + o.total, 0);
  res.json({
    rows, states: ESTADOS,
    resumen: {
      total: todos.length,
      vendido,
      aDespachar: todos.filter(o => !o.cancelado && (o.status === 'recibido' || o.status === 'preparacion')).length,
      ticket: validos.length ? Math.round(vendido / validos.length) : 0,
      cancelados: todos.filter(o => o.cancelado).length,
    },
    conteo: IDS.reduce((acc, id) => { acc[id] = todos.filter(o => o.status === id).length; return acc; }, { cancelado: todos.filter(o => o.cancelado).length }),
  });
});

// PATCH /api/pedidos/:id — estado, nota para el cliente y número de seguimiento del correo.
// Los items y los importes NO se tocan: quedan como se cobraron.
router.patch('/:id', requireAdmin, async (req, res) => {
  const o = await db.get('orders', req.params.id);
  if (!o || !esDeTienda(o)) return res.status(404).json({ error: 'Ese pedido no existe' });
  if (o.status === 'cancelado') return res.status(409).json({ error: 'El pedido está cancelado: no se puede volver a mover' });
  const patch = { updatedAt: new Date().toISOString() };
  if (req.body.status !== undefined) {
    if (!IDS.includes(req.body.status)) return res.status(422).json({ error: 'Estado inválido (' + IDS.join(', ') + ')' });
    patch.status = req.body.status;
  }
  if (req.body.note !== undefined) patch.note = String(req.body.note).slice(0, 500);
  if (req.body.tracking !== undefined) patch.tracking = String(req.body.tracking).trim().slice(0, 60);
  const row = await db.update('orders', o.id, patch);
${cfg.moduleIds.includes('mailer') ? `  // Aviso al cliente cuando el pedido sale: es el momento en que quiere enterarse
  if (patch.status === 'enviado' && row.email) {
    mailer.notifyTo(row.email, 'Tu pedido ' + row.code + ' ya salió',
      'Hola' + (row.customer ? ' ' + row.customer : '') + ': tu pedido ' + row.code + ' está en camino.' +
      (row.tracking ? ' Número de seguimiento del correo: ' + row.tracking + '.' : '') +
      ' Podés ver su estado en /seguimiento.html con el código ' + row.code + '.').catch(() => {});
  }
` : ''}  res.json(vista(row));
});

// POST /api/pedidos/:id/cancelar — cancela y REPONE EL STOCK.
// Es idempotente: un pedido cuyas unidades ya volvieron no las suma dos veces. Sin esa marca, dos
// clics en "cancelar" inventan mercadería que no existe.
router.post('/:id/cancelar', requireAdmin, async (req, res) => {
  const o = await db.get('orders', req.params.id);
  if (!o || !esDeTienda(o)) return res.status(404).json({ error: 'Ese pedido no existe' });
  if (o.status === 'cancelado') return res.status(409).json({ error: 'Ese pedido ya estaba cancelado' });
  const motivo = String((req.body && req.body.motivo) || '').trim().slice(0, 200);
${cfg.moduleIds.includes('products-admin') ? `
  // Reposición: las unidades vuelven al catálogo. Un pedido cancelado cuyo stock no vuelve es
  // mercadería que está en el depósito y que el sistema cree vendida.
  if (!o.stockRepuesto) {
    for (const i of (o.items || [])) {
      const p = await db.get('products', i.productId);
${cfg.moduleIds.includes('variantes') ? `      // Si la línea se vendió con una combinación (talle, color), las unidades vuelven A ESA
      // variante y el motor reescribe el stock del producto con la suma. Reponer al producto
      // dejaría el total bien y el detalle mal: aparecerían 3 unidades sin talle asignado.
      if (p && i.variantId) {
        await require('../src/variantes').mover(p.id, i.variantId, Number(i.qty) || 0,
          'Cancelación del pedido ' + (o.code || o.id), req.user.email || '');
        continue;
      }
` : ''}      if (!p || p.trackStock === false) continue;
      const queda = (Number(p.stock) || 0) + (Number(i.qty) || 0);
      await db.update('products', p.id, { stock: queda });
      await db.insert('stockmoves', {
        productId: p.id, delta: Number(i.qty) || 0,
        motivo: 'Cancelación del pedido ' + (o.code || o.id),
        usuario: req.user.email || '', resultado: queda,
      });
    }
  }
` : ''}${cfg.moduleIds.includes('coupons') ? `  // El cupón vuelve a quedar disponible: se había consumido al comprar
  if (o.coupon) {
    const c = (await db.find('coupons', x => x.code === o.coupon))[0];
    if (c && (c.uses || 0) > 0) await db.update('coupons', c.id, { uses: c.uses - 1 });
  }
` : ''}  const row = await db.update('orders', o.id, {
    status: 'cancelado', stockRepuesto: true,
    note: motivo || o.note || '', canceladoAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  res.json(vista(row));
});

// GET /api/pedidos/csv — exportación para la contadora o para el sistema de facturación
router.get('/csv', requireAdmin, async (req, res) => {
  const rows = (await db.all('orders')).filter(esDeTienda).map(vista)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const cab = ['Codigo', 'Fecha', 'Estado', 'Cliente', 'Email', 'Entrega', 'Direccion', 'Localidad', 'Provincia', 'CP', 'Items', 'Subtotal', 'Descuentos', 'Cupon', 'Envio', 'Total', 'Seguimiento'];
  const lineas = rows.map(o => [
    o.code, o.createdAt, o.statusLabel, o.customer, o.email,
    o.entrega ? (o.entrega.metodo === 'retiro' ? 'Retiro en el local' : 'Envio a domicilio') : '',
    (o.entrega && o.entrega.direccion) || '', (o.entrega && o.entrega.ciudad) || '',
    (o.entrega && o.entrega.provincia) || '', (o.entrega && o.entrega.cp) || '',
    o.items.map(i => i.qty + 'x ' + i.name).join(' | '),
    o.subtotal, o.promoDiscount + o.discount, o.coupon || '', o.shippingCost, o.total, o.tracking,
  ].map(esc).join(','));
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="pedidos.csv"')
    .send([cab.map(esc).join(','), ...lineas].join('\\n'));
});

module.exports = router;
`,
  }),
  pages: () => ({
    'pedidos-admin': {
      title: 'Pedidos',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('shopping-cart', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Pedidos de la tienda</h2>
      <p class="section-sub">Los pedidos que entraron por el checkout, con su detalle, su entrega y su estado. El cliente ve el avance en <code>/seguimiento.html</code> con el código de su pedido. Solo visible para administradores.</p>
      <div class="pd-kpis" id="pd-kpis"></div>
      <div class="pd-tabs" id="pd-tabs"></div>
      <div id="pd-lista"><p class="muted">Cargando…</p></div>
      <div style="margin-top:20px"><button class="btn ghost" type="button" id="pd-csv" style="width:auto">Descargar CSV</button></div>
    </div>
  </section>`,
    },
  }),
  clientJs: (cfg) => `/* Módulo gestión de pedidos: panel solo-admin de los pedidos del checkout. Los importes no se
   editan (quedan como se cobraron); lo que cambia es el estado, la nota y el seguimiento.
   Anime.js para los KPIs, con red de seguridad por si el loop está pausado. */
(function () {
  var box = document.getElementById('pd-lista');
  if (!box) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var datos = null;
  var filtro = '';

  function contar(el, hasta, money) {
    if (!el) return;
    var fmt = function (v) { return money ? App.money(Math.round(v)) : Math.round(v).toLocaleString('es-AR'); };
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = fmt(hasta); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 640, ease: 'outCubic', onUpdate: function () { el.textContent = fmt(st.v); } });
    // Red de seguridad: Anime.js pausa su loop con la pestaña oculta
    setTimeout(function () { el.textContent = fmt(hasta); }, 840);
  }

  function pintarKpis(r) {
    var k = document.getElementById('pd-kpis');
    k.innerHTML = '<div class="card"><strong id="pd-k-vend">0</strong><span class="muted">vendido</span></div>' +
      '<div class="card"><strong id="pd-k-desp">0</strong><span class="muted">a despachar</span></div>' +
      '<div class="card"><strong id="pd-k-tot">0</strong><span class="muted">pedidos</span></div>' +
      '<div class="card"><strong id="pd-k-tick">0</strong><span class="muted">ticket promedio</span></div>';
    contar(document.getElementById('pd-k-vend'), r.vendido, true);
    contar(document.getElementById('pd-k-desp'), r.aDespachar);
    contar(document.getElementById('pd-k-tot'), r.total);
    contar(document.getElementById('pd-k-tick'), r.ticket, true);
  }

  function pintarTabs() {
    var t = document.getElementById('pd-tabs');
    var opciones = [['', 'Todos']].concat(datos.states.map(function (e) { return [e.id, e.label]; }));
    opciones.push(['cancelado', 'Cancelados']);
    t.innerHTML = opciones.map(function (o) {
      var n = o[0] ? (datos.conteo[o[0]] || 0) : datos.resumen.total;
      return '<button type="button" data-pd-tab="' + o[0] + '" class="' + (filtro === o[0] ? 'on' : '') + '">' + o[1] + ' (' + n + ')</button>';
    }).join('');
    t.querySelectorAll('[data-pd-tab]').forEach(function (b) {
      b.addEventListener('click', function () { filtro = b.getAttribute('data-pd-tab'); cargar(); });
    });
  }

  function entregaHtml(o) {
    if (!o.entrega) return '<p class="muted">Este pedido no tiene datos de entrega (se cargó antes de que el checkout los pidiera).</p>';
    var e = o.entrega;
    if (e.metodo === 'retiro') {
      return '<p class="pd-dir"><strong>Retira en el local</strong><br>' + App.esc(e.nombre) + '<br>' + App.esc(e.telefono) +
        (e.notas ? '<br><span class="muted">' + App.esc(e.notas) + '</span>' : '') + '</p>';
    }
    return '<p class="pd-dir"><strong>Envío a domicilio</strong><br>' +
      App.esc(e.nombre) + ' · ' + App.esc(e.telefono) + '<br>' +
      App.esc(e.direccion) + '<br>' + App.esc(e.ciudad) + (e.provincia ? ', ' + App.esc(e.provincia) : '') + ' (CP ' + App.esc(e.cp) + ')' +
      (o.shippingZone ? '<br><span class="muted">Zona ' + App.esc(o.shippingZone) + ' · ' + o.shippingDays + ' días hábiles</span>' : '') +
      (e.notas ? '<br><span class="muted">' + App.esc(e.notas) + '</span>' : '') + '</p>';
  }

  function totalesHtml(o) {
    var l = ['<li><span>Subtotal</span><span>' + App.money(o.subtotal) + '</span></li>'];
    (o.promos || []).forEach(function (p) {
      l.push('<li><span>' + App.esc(p.nombre) + '</span><span>− ' + App.money(p.monto) + '</span></li>');
    });
    if (!o.promos.length && o.promoDiscount) l.push('<li><span>Descuentos</span><span>− ' + App.money(o.promoDiscount) + '</span></li>');
    if (o.discount) l.push('<li><span>Cupón ' + App.esc(o.coupon || '') + '</span><span>− ' + App.money(o.discount) + '</span></li>');
    l.push('<li><span>Envío</span><span>' + (o.shippingCost ? App.money(o.shippingCost) : 'sin cargo') + '</span></li>');
    l.push('<li class="fuerte"><span>Total</span><span>' + App.money(o.total) + '</span></li>');
    return '<ul class="pd-tot">' + l.join('') + '</ul>';
  }

  function pintar() {
    if (!datos.rows.length) {
      box.innerHTML = '<div class="pd-vacio">Todavía no hay pedidos' + (filtro ? ' en ese estado' : '') + '.</div>';
      return;
    }
    box.innerHTML = datos.rows.map(function (o) {
      var siguiente = datos.states[datos.states.findIndex(function (e) { return e.id === o.status; }) + 1];
      return '<div class="pd-fila" data-pd-id="' + o.id + '">' +
        '<div class="pd-cab">' +
          '<div><span class="pd-code">' + App.esc(o.code) + '</span> <span class="pd-est ' + (o.cancelado ? 'cancelado' : o.status) + '">' + App.esc(o.statusLabel) + '</span>' +
            '<br><span class="muted" style="font-size:.84rem">' + App.esc(o.customer) + ' · ' + new Date(o.createdAt).toLocaleString('es-AR') + '</span></div>' +
          '<span class="pd-total">' + App.money(o.total) + '</span>' +
        '</div>' +
        '<div class="pd-cuerpo"><div class="pd-cols">' +
          '<div><strong style="display:block;margin-bottom:8px">Qué compró</strong>' +
            '<ul class="pd-items">' + o.items.map(function (i) {
              return '<li><span>' + i.qty + '× ' + App.esc(i.name) + '</span><span>' + App.money(i.unitPrice * i.qty) + '</span></li>';
            }).join('') + '</ul>' + totalesHtml(o) + '</div>' +
          '<div><strong style="display:block;margin-bottom:8px">A dónde va</strong>' + entregaHtml(o) +
            (o.email ? '<p class="muted" style="font-size:.84rem">' + App.esc(o.email) + '</p>' : '') +
            (o.tracking ? '<p style="font-size:.86rem">Seguimiento del correo: <strong>' + App.esc(o.tracking) + '</strong></p>' : '') +
            (o.note ? '<p class="muted" style="font-size:.86rem">Nota: ' + App.esc(o.note) + '</p>' : '') +
          '</div>' +
        '</div>' +
        (o.cancelado ? '<p class="muted" style="margin-top:14px;font-size:.86rem">Pedido cancelado' + (o.stockRepuesto ? ' — el stock volvió al catálogo.' : '.') + '</p>' :
        '<div class="pd-acc">' +
          (siguiente ? '<button class="btn" type="button" data-pd-avanzar="' + o.id + '" data-pd-a="' + siguiente.id + '">Marcar como ' + siguiente.label.toLowerCase() + '</button>' : '') +
          '<button class="btn ghost" type="button" data-pd-track="' + o.id + '">Número de seguimiento</button>' +
          '<button class="btn ghost" type="button" data-pd-nota="' + o.id + '">Nota para el cliente</button>' +
          '<button class="btn ghost" type="button" data-pd-cancel="' + o.id + '">Cancelar</button>' +
        '</div>') +
        '</div></div>';
    }).join('');

    box.querySelectorAll('.pd-cab').forEach(function (c) {
      c.addEventListener('click', function () { c.closest('.pd-fila').classList.toggle('abierta'); });
    });
    box.querySelectorAll('[data-pd-avanzar]').forEach(function (b) {
      b.addEventListener('click', function () {
        mandar(b.getAttribute('data-pd-avanzar'), { status: b.getAttribute('data-pd-a') }, 'Pedido actualizado');
      });
    });
    box.querySelectorAll('[data-pd-track]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = prompt('Número de seguimiento del correo:', '');
        if (v === null) return;
        mandar(b.getAttribute('data-pd-track'), { tracking: v }, 'Seguimiento guardado');
      });
    });
    box.querySelectorAll('[data-pd-nota]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = prompt('Nota que ve el cliente en el seguimiento:', '');
        if (v === null) return;
        mandar(b.getAttribute('data-pd-nota'), { note: v }, 'Nota guardada');
      });
    });
    box.querySelectorAll('[data-pd-cancel]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('¿Cancelar este pedido?${cfg.moduleIds.includes('products-admin') ? ' Las unidades vuelven al stock.' : ''}')) return;
        var motivo = prompt('Motivo (lo ve el cliente en el seguimiento):', '');
        if (motivo === null) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: se cancelaría el pedido'); return; }
        try {
          await App.api('/api/pedidos/' + b.getAttribute('data-pd-cancel') + '/cancelar', { method: 'POST', body: { motivo: motivo } });
          App.toast('Pedido cancelado${cfg.moduleIds.includes('products-admin') ? ' y stock repuesto' : ''}');
          cargar();
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }

  async function mandar(id, body, aviso) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el cambio'); return; }
    try {
      await App.api('/api/pedidos/' + id, { method: 'PATCH', body: body });
      App.toast(aviso);
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  var DEMO = {
    states: ${JSON.stringify(ESTADOS)},
    resumen: { total: 24, vendido: 486300, aDespachar: 5, ticket: 20262, cancelados: 1 },
    conteo: { recibido: 3, preparacion: 2, enviado: 6, entregado: 12, cancelado: 1 },
    rows: [{
      id: 'd1', code: 'OT-A1B2C3', status: 'recibido', statusLabel: 'Recibido', cancelado: false,
      customer: 'Cliente de ejemplo', email: 'cliente@ejemplo.com',
      items: [{ name: 'Producto Premium', unitPrice: 9999, qty: 2 }, { name: 'Producto Clásico', unitPrice: 4999, qty: 1 }],
      subtotal: 24997, promoDiscount: 2500, promos: [{ nombre: '10% llevando más de $20.000', monto: 2500 }],
      coupon: null, discount: 0, shippingCost: 2500, shippingZone: 'CABA y GBA', shippingDays: 2,
      entrega: { metodo: 'envio', nombre: 'Cliente de ejemplo', telefono: '11 5555-5555', direccion: 'Av. Siempreviva 742', ciudad: 'CABA', provincia: 'CABA', cp: 'C1000', notas: '' },
      total: 24997, note: '', tracking: '', stockRepuesto: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }],
  };

  async function cargar() {
    if (window.__PREVIEW__) { datos = DEMO; pintarKpis(datos.resumen); pintarTabs(); pintar(); return; }
    try {
      datos = await App.api('/api/pedidos' + (filtro ? '?status=' + encodeURIComponent(filtro) : ''));
      pintarKpis(datos.resumen);
      pintarTabs();
      pintar();
    } catch (err) {
      if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
    }
  }

  document.getElementById('pd-csv').addEventListener('click', function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: se descargaría el CSV'); return; }
    // El CSV requiere el token: se pide con fetch y se baja como blob
    fetch('/api/pedidos/csv', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') } })
      .then(function (r) { if (!r.ok) throw new Error('No se pudo exportar'); return r.blob(); })
      .then(function (b) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'pedidos.csv';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      }).catch(function (err) { App.toast(err.message); });
  });

  if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
    box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
  } else {
    cargar();
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navP = document.getElementById('nav-pedidos');
    if (navP && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navP.style.display = 'none';
  })();
})();`,
  readmeNotes: (cfg) => [
    `**Gestión de pedidos**: el panel está en \`/pedidos-admin.html\` y muestra los pedidos que entraron **por el checkout** (los que tienen items). Comparte la colección \`orders\` y los estados con **Seguimiento de pedidos**, así el cliente sigue su compra en \`/seguimiento.html\` con el código que le dio el checkout, sin copiar nada a mano.${cfg.moduleIds.includes('products-admin') ? ' **Cancelar repone el stock** y lo registra en el historial del producto; es idempotente, así que cancelar dos veces no inventa unidades.' : ''}${cfg.moduleIds.includes('coupons') ? ' Cancelar también **libera el cupón** que se había consumido.' : ''} Los items y los importes **no se pueden editar**: quedan como se cobraron.`,
  ],
};
