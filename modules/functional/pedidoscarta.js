// Pedidos online desde la carta con backend real: el visitante arma su pedido directo en
// /carta.html (cada plato disponible suma un botón "Agregar" y aparece una barra flotante con el
// total), elige retiro en el local o envío a domicilio, deja nombre y teléfono y confirma. El
// servidor valida cada plato contra la colección menuitems (existe y está disponible hoy) y
// RECALCULA EL TOTAL SIEMPRE con los precios del backend (nunca confía en el navegador), genera un
// código PC-XXXXXX y guarda el pedido (colección foodorders). El cliente lo sigue en vivo en
// /mi-pedido.html (línea de estados Recibido → En preparación → Listo → Entregado, con sondeo
// liviano). Con auth activo, /comandas.html es el tablero solo-admin de la cocina: pedidos del día,
// KPIs animados, avance de estado, cancelación, borrado y CSV. Animado con Anime.js (barra del
// pedido, pop del contador, pulso del estado) + red de seguridad. Distinto de "ordertrack" (el
// negocio carga códigos a mano y el cliente los sigue), de "cart" (carrito de e-commerce sobre
// products-admin) y de "menu" (la carta sola, sin pedidos): acá el pedido nace del propio visitante
// sobre la carta y la cocina lo gestiona. Requiere el módulo Carta / menú.

// Estados del pedido en orden de avance (cancelado va aparte, no es un paso de la línea)
const ESTADOS = [
  { id: 'recibido', label: 'Recibido' },
  { id: 'preparando', label: 'En preparación' },
  { id: 'listo', label: 'Listo para retirar / salir' },
  { id: 'entregado', label: 'Entregado' },
];

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'pedidoscarta', type: 'functional', name: 'Pedidos de la carta',
  description: 'El visitante arma su pedido desde /carta.html (botón "Agregar" por plato + barra flotante), elige retiro o envío y confirma: el servidor valida los platos, recalcula el total con precios del backend y devuelve un código PC-XXXXXX seguible en vivo en /mi-pedido.html. Con auth activo, tablero de comandas solo-admin en /comandas.html con estados, KPIs y CSV. Colección foodorders. Animado con Anime.js. Requiere Carta / menú.',
  usesAnime: true,
  requires: ['menu'],
  mounts: [{ route: '/api/pedidoscarta', file: 'routes/pedidoscarta.js' }],
  collections: ['foodorders'],
  nav: (cfg) => {
    const links = [{ label: 'Mi pedido', href: '/mi-pedido.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Comandas', href: '/comandas.html', id: 'nav-comandas' });
    return links;
  },
  head: () => `  <style>
    .pc-add{display:flex;align-items:center;gap:8px;margin-top:8px}
    .pc-add .btn{padding:4px 12px;font-size:.8rem}
    .pc-qty{display:inline-flex;align-items:center;gap:10px;font-weight:700;font-variant-numeric:tabular-nums}
    .pc-qty button{width:26px;height:26px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--text);font-weight:800;cursor:pointer;line-height:1}
    .pc-qty button:hover{border-color:var(--accent);color:var(--accent)}
    .pc-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:60;background:var(--accent);color:#fff;border-radius:999px;padding:11px 22px;display:flex;align-items:center;gap:14px;box-shadow:0 8px 28px rgba(0,0,0,.25);cursor:pointer;border:0;font-weight:700;font-size:.95rem}
    .pc-bar[hidden]{display:none}
    .pc-panel{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;padding:16px}
    .pc-panel[hidden]{display:none}
    .pc-panel .pc-caja{background:var(--bg);border-radius:var(--radius);max-width:560px;width:100%;max-height:88vh;overflow:auto;padding:22px}
    .pc-linea{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed var(--line)}
    .pc-linea .pc-nom{flex:1}
    .pc-linea .pc-sub{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
    .pc-total{display:flex;justify-content:space-between;font-weight:800;font-size:1.1rem;padding:12px 0 4px}
    .pc-pasos{position:relative;display:flex;justify-content:space-between;margin:18px 0 6px;padding:0 4px}
    .pc-pasos::before{content:'';position:absolute;top:14px;left:24px;right:24px;height:3px;background:var(--line);border-radius:999px}
    .pc-pasoslinea{position:absolute;top:14px;left:24px;height:3px;background:var(--accent);border-radius:999px;width:0}
    .pc-paso{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;text-align:center}
    .pc-bola{width:30px;height:30px;border-radius:50%;background:var(--bg);border:3px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:.85rem;color:var(--muted)}
    .pc-paso.done .pc-bola{border-color:var(--accent);background:var(--accent);color:#fff}
    .pc-paso.current .pc-bola{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb, var(--accent) 20%, transparent)}
    .pc-paso small{font-size:.75rem;color:var(--muted);max-width:88px}
    .pc-paso.done small,.pc-paso.current small{color:var(--text)}
    .pc-cancelado{background:color-mix(in srgb, #b91c1c 10%, transparent);border-left:3px solid #b91c1c;color:#b91c1c;padding:12px 14px;border-radius:0 var(--radius) var(--radius) 0;font-weight:600}
    .pc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .pc-kpis .card{text-align:center}
    .pc-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .pc-est{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--line)}
    .pc-est.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
    .pc-est.off{color:#b91c1c;border-color:#b91c1c}
  </style>`,
  files: (cfg) => ({
    'routes/pedidoscarta.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { check, str, oneOf } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
// Estados del pedido en orden de avance ('cancelado' es terminal y va aparte)
const ESTADOS = ${JSON.stringify(ESTADOS.map(e => e.id))};

const genCode = () => 'PC-' + crypto.randomBytes(3).toString('hex').toUpperCase();

// Vista pública de un pedido: el código ES la llave, pero nunca exponemos el teléfono completo
const publico = (p) => ({
  code: p.code, status: p.status, mode: p.mode, address: p.mode === 'delivery' ? p.address : '',
  items: p.items, total: p.total, name: p.name, note: p.note || '', createdAt: p.createdAt,
});

// POST /api/pedidoscarta — crea un pedido armado desde la carta (público).
// El total se calcula SIEMPRE en el servidor con los precios actuales de menuitems.
router.post('/', async (req, res) => {
  const { ok, errors } = check(req.body, {
    name: (v) => str(v, 2, 80),
    phone: (v) => str(v, 6, 40),
    mode: (v) => oneOf(v, ['retiro', 'delivery']),
  });
  if (!ok) return res.status(422).json({ error: 'Revisá tus datos (nombre, teléfono y modalidad)', errors });
  if (req.body.mode === 'delivery' && !str(req.body.address, 5, 160)) {
    return res.status(422).json({ error: 'Para envío a domicilio necesitamos la dirección' });
  }
  const pedidos = Array.isArray(req.body.items) ? req.body.items : [];
  if (!pedidos.length || pedidos.length > 40) return res.status(422).json({ error: 'El pedido está vacío' });
  // Valida cada renglón contra la carta real: plato existente y disponible hoy
  const items = [];
  let total = 0;
  for (const it of pedidos) {
    const qty = Math.round(Number(it && it.qty));
    if (!isFinite(qty) || qty < 1 || qty > 99) return res.status(422).json({ error: 'Cantidad inválida en el pedido' });
    const plato = await db.get('menuitems', String(it && it.id || ''));
    if (!plato || plato.available === false) {
      return res.status(422).json({ error: 'Un plato de tu pedido ya no está disponible: actualizá la carta y volvé a intentar' });
    }
    items.push({ id: plato.id, name: plato.name, price: plato.price || 0, qty });
    total += (plato.price || 0) * qty;
  }
  if (total <= 0) return res.status(422).json({ error: 'El pedido no tiene importe' });
  const row = await db.insert('foodorders', {
    code: genCode(),
    name: req.body.name.trim(),
    phone: req.body.phone.trim(),
    mode: req.body.mode,
    address: req.body.mode === 'delivery' ? req.body.address.trim() : '',
    note: typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 300) : '',
    items, total, status: 'recibido',
  });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): entró una comanda nueva.
  // Es "disparar y seguir": un email caído jamás rompe el alta del pedido.
  mailer.notify('Nuevo pedido de la carta: ' + row.code, row.name + ' (tel. ' + row.phone + ') pidió ' + items.map(i => i.qty + '× ' + i.name).join(', ') + ' por $' + total.toLocaleString('es-AR') + ' (' + (row.mode === 'delivery' ? 'envío a ' + row.address : 'retiro en el local') + '). Atendelo desde el panel de pedidos.').catch(() => {});
` : ''}  res.status(201).json({ code: row.code, total: row.total, status: row.status });
});

// GET /api/pedidoscarta/track/:code — seguimiento público por código
router.get('/track/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const rows = await db.find('foodorders', (p) => p.code === code);
  if (!rows.length) return res.status(404).json({ error: 'No encontramos un pedido con ese código' });
  res.json(publico(rows[0]));
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/pedidoscarta/admin/list — todos los pedidos, más nuevos primero (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  const rows = await db.all('foodorders');
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json(rows);
});

// PATCH /api/pedidoscarta/admin/:id — cambia el estado de un pedido (solo admin)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  const status = String(req.body.status || '');
  if (!ESTADOS.includes(status) && status !== 'cancelado') return res.status(422).json({ error: 'Estado inválido' });
  const row = await db.update('foodorders', req.params.id, { status });
  if (!row) return res.status(404).json({ error: 'Pedido inexistente' });
  res.json(row);
});

// DELETE /api/pedidoscarta/admin/:id — borra un pedido (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const p = await db.get('foodorders', req.params.id);
  if (!p) return res.status(404).json({ error: 'Pedido inexistente' });
  await db.remove('foodorders', req.params.id);
  res.json({ ok: true });
});
` : `// El tablero de comandas requiere el módulo de autenticación: activalo en el Builder para
// habilitar /comandas.html. Sin él, los pedidos igual se guardan en data/foodorders.json y el
// cliente los sigue por código en /mi-pedido.html.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      'mi-pedido': {
        title: 'Mi pedido',
        html: `  <section>
    <div class="container" style="max-width:640px">
      <h2>Seguí tu pedido</h2>
      <p class="section-sub">Ingresá el código que te dimos al confirmar (empieza con PC-) y mirá el avance en vivo.</p>
      <form id="pc-track-form" class="card" style="display:flex;gap:10px;align-items:center">
        <input id="pc-code" placeholder="PC-A1B2C3" maxlength="12" style="flex:1;text-transform:uppercase" aria-label="Código de pedido">
        <button class="btn" type="submit">Consultar</button>
      </form>
      <div id="pc-track" style="margin-top:20px"></div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs.comandas = {
        title: 'Comandas',
        html: `  <section>
    <div class="container">
      <h2>Comandas</h2>
      <p class="section-sub">Los pedidos que llegan desde la carta, para que la cocina los avance de estado. Solo visible para administradores.</p>
      <div class="pc-kpis" id="pc-kpis"></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
        <select id="pc-f-status" style="max-width:220px"><option value="">Todos los estados</option></select>
        <button class="btn ghost" type="button" id="pc-csv">Descargar CSV</button>
      </div>
      <div id="pc-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo pedidos de la carta: suma "Agregar" a cada plato de /carta.html con barra flotante y
   confirmación (el server recalcula el total), seguimiento en vivo por código en /mi-pedido.html
   y, con auth activo, el tablero de comandas en /comandas.html. Animado con Anime.js + red de
   seguridad. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ESTADOS = ${JSON.stringify(ESTADOS)};
  var IDX = {}; ESTADOS.forEach(function (e, i) { IDX[e.id] = i; });

  // ---- Armado del pedido en /carta.html ----
  var mnList = document.getElementById('mn-list');
  if (mnList) {
    var carta = {};   // id → {name, price} de los platos disponibles (para pintar el panel)
    var cart = {};    // id → cantidad
    try { cart = JSON.parse(localStorage.getItem('pc-cart') || '{}'); } catch (e) { cart = {}; }

    // Barra flotante y panel de confirmación se crean una sola vez, colgados del body
    var bar = document.createElement('button');
    bar.type = 'button'; bar.className = 'pc-bar'; bar.id = 'pc-bar'; bar.hidden = true;
    document.body.appendChild(bar);
    var panel = document.createElement('div');
    panel.className = 'pc-panel'; panel.id = 'pc-panel'; panel.hidden = true;
    panel.innerHTML = '<div class="pc-caja">' +
      '<h3 style="margin:0 0 4px">Tu pedido</h3>' +
      '<div id="pc-lineas"></div>' +
      '<div class="pc-total"><span>Total</span><span id="pc-total-num"></span></div>' +
      '<form id="pc-form" style="margin-top:10px">' +
        '<div class="grid cols-2" style="gap:12px">' +
          '<div><label>Tu nombre</label><input name="name" required minlength="2" maxlength="80" placeholder="Nombre y apellido"></div>' +
          '<div><label>Teléfono</label><input name="phone" required minlength="6" maxlength="40" placeholder="11 5555-5555"></div>' +
        '</div>' +
        '<label style="margin-top:8px">¿Cómo lo recibís?</label>' +
        '<div style="display:flex;gap:16px;margin:4px 0 8px">' +
          '<label style="display:inline-flex;align-items:center;gap:6px;font-weight:400;margin:0"><input type="radio" name="mode" value="retiro" checked style="width:auto"> Retiro en el local</label>' +
          '<label style="display:inline-flex;align-items:center;gap:6px;font-weight:400;margin:0"><input type="radio" name="mode" value="delivery" style="width:auto"> Envío a domicilio</label>' +
        '</div>' +
        '<div id="pc-dir-box" hidden><label>Dirección de entrega</label><input name="address" maxlength="160" placeholder="Calle 123, piso/depto, barrio"></div>' +
        '<label>Aclaraciones (opcional)</label>' +
        '<textarea name="note" rows="2" maxlength="300" placeholder="Sin cebolla, timbre roto, etc."></textarea>' +
        '<div style="display:flex;gap:8px;margin-top:14px">' +
          '<button class="btn" type="submit">Confirmar pedido</button>' +
          '<button class="btn ghost" type="button" id="pc-cerrar">Seguir mirando la carta</button>' +
        '</div>' +
      '</form>' +
      '<div id="pc-exito" hidden></div>' +
    '</div>';
    document.body.appendChild(panel);
    var formPC = panel.querySelector('#pc-form');
    var exitoBox = panel.querySelector('#pc-exito');

    function totalCarrito() {
      var t = 0;
      Object.keys(cart).forEach(function (id) { if (carta[id]) t += carta[id].price * cart[id]; });
      return t;
    }
    function itemsCarrito() {
      var n = 0;
      Object.keys(cart).forEach(function (id) { n += cart[id]; });
      return n;
    }
    function guardar() { try { localStorage.setItem('pc-cart', JSON.stringify(cart)); } catch (e) {} }

    function pintarBar() {
      var n = itemsCarrito();
      var estaba = !bar.hidden;
      bar.hidden = n === 0;
      if (n === 0) return;
      bar.innerHTML = n + (n === 1 ? ' ítem' : ' ítems') + ' · ' + App.money(totalCarrito()) + ' — <u>Hacer pedido</u>';
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        // La barra entra desde abajo la primera vez; después solo hace un pop al cambiar
        anime.animate(bar, estaba ? { scale: [1, 1.06, 1], duration: 250, ease: 'outCubic' } : { translateY: [40, 0], opacity: [0, 1], duration: 380, ease: 'outCubic' });
        setTimeout(function () { bar.style.transform = 'translateX(-50%)'; bar.style.opacity = 1; }, 700);
      }
    }

    // Inyecta los controles "Agregar / − n +" en cada plato disponible de la carta.
    // La carta se re-renderiza al buscar, así que se observa el contenedor (patrón MutationObserver).
    function inyectarControles() {
      [].slice.call(mnList.querySelectorAll('.mn-item[data-plato]')).forEach(function (item) {
        if (item.querySelector('.pc-add') || item.classList.contains('off')) return;
        var id = item.getAttribute('data-plato');
        if (!carta[id]) return;
        var box = document.createElement('div');
        box.className = 'pc-add';
        item.querySelector('.mn-info').appendChild(box);
        pintarControl(box, id);
      });
    }
    function pintarControl(box, id) {
      var q = cart[id] || 0;
      if (!q) {
        box.innerHTML = '<button class="btn ghost" type="button">Agregar</button>';
        box.firstChild.addEventListener('click', function () { cambiar(id, 1); });
      } else {
        box.innerHTML = '<span class="pc-qty"><button type="button" aria-label="Quitar uno">−</button><span>' + q + '</span><button type="button" aria-label="Sumar uno">+</button></span>';
        var btns = box.querySelectorAll('button');
        btns[0].addEventListener('click', function () { cambiar(id, -1); });
        btns[1].addEventListener('click', function () { cambiar(id, 1); });
      }
    }
    function cambiar(id, delta) {
      cart[id] = Math.max(0, Math.min(99, (cart[id] || 0) + delta));
      if (!cart[id]) delete cart[id];
      guardar();
      // Repinta el control del plato tocado, la barra y (si está abierto) el panel
      [].slice.call(mnList.querySelectorAll('.mn-item[data-plato="' + id + '"] .pc-add')).forEach(function (b) { pintarControl(b, id); });
      pintarBar();
      if (!panel.hidden) pintarPanel();
    }

    function pintarPanel() {
      var lineas = panel.querySelector('#pc-lineas');
      var ids = Object.keys(cart).filter(function (id) { return carta[id]; });
      if (!ids.length) { cerrarPanel(); return; }
      lineas.innerHTML = ids.map(function (id) {
        return '<div class="pc-linea"><span class="pc-nom">' + App.esc(carta[id].name) + '</span>' +
          '<span class="pc-qty"><button type="button" data-menos="' + id + '">−</button><span>' + cart[id] + '</span><button type="button" data-mas="' + id + '">+</button></span>' +
          '<span class="pc-sub">' + App.money(carta[id].price * cart[id]) + '</span></div>';
      }).join('');
      panel.querySelector('#pc-total-num').textContent = App.money(totalCarrito());
      lineas.querySelectorAll('[data-menos]').forEach(function (b) { b.addEventListener('click', function () { cambiar(b.getAttribute('data-menos'), -1); }); });
      lineas.querySelectorAll('[data-mas]').forEach(function (b) { b.addEventListener('click', function () { cambiar(b.getAttribute('data-mas'), 1); }); });
    }
    function abrirPanel() {
      panel.hidden = false;
      formPC.hidden = false; exitoBox.hidden = true;
      pintarPanel();
      var caja = panel.querySelector('.pc-caja');
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(caja, { translateY: [30, 0], opacity: [0, 1], duration: 320, ease: 'outCubic' });
        setTimeout(function () { caja.style.opacity = 1; caja.style.transform = 'none'; }, 650);
      }
    }
    function cerrarPanel() { panel.hidden = true; }
    bar.addEventListener('click', abrirPanel);
    panel.addEventListener('click', function (e) { if (e.target === panel) cerrarPanel(); });
    panel.querySelector('#pc-cerrar').addEventListener('click', cerrarPanel);

    // Muestra/oculta la dirección según la modalidad elegida
    formPC.querySelectorAll('[name="mode"]').forEach(function (r) {
      r.addEventListener('change', function () {
        var esDelivery = formPC.querySelector('[name="mode"]:checked').value === 'delivery';
        formPC.querySelector('#pc-dir-box').hidden = !esDelivery;
        formPC.querySelector('[name="address"]').required = esDelivery;
      });
    });

    formPC.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        name: formPC.querySelector('[name="name"]').value,
        phone: formPC.querySelector('[name="phone"]').value,
        mode: formPC.querySelector('[name="mode"]:checked').value,
        address: formPC.querySelector('[name="address"]').value,
        note: formPC.querySelector('[name="note"]').value,
        items: Object.keys(cart).map(function (id) { return { id: id, qty: cart[id] }; }),
      };
      if (window.__PREVIEW__) { App.toast('Vista previa: se confirmaría el pedido'); return; }
      try {
        var r = await App.api('/api/pedidoscarta', { method: 'POST', body: datos });
        cart = {}; guardar(); pintarBar();
        // Reinyecta los botones "Agregar" limpios en la carta
        [].slice.call(mnList.querySelectorAll('.pc-add')).forEach(function (b) { pintarControl(b, b.closest('.mn-item').getAttribute('data-plato')); });
        formPC.hidden = true;
        exitoBox.hidden = false;
        exitoBox.innerHTML = '<div class="card" style="text-align:center;border-color:var(--accent)">' +
          '<h3 style="margin:0 0 6px">¡Pedido confirmado!</h3>' +
          '<p style="margin:0 0 4px">Tu código de seguimiento es</p>' +
          '<p style="font-size:1.6rem;font-weight:800;margin:0 0 10px" id="pc-code-ok">' + App.esc(r.code) + '</p>' +
          '<p class="muted" style="margin:0 0 12px">Total: ' + App.money(r.total) + '. Guardalo para seguir tu pedido.</p>' +
          '<a class="btn" href="/mi-pedido.html?code=' + encodeURIComponent(r.code) + '">Seguir mi pedido</a></div>';
        var anime = window.anime;
        var okCard = exitoBox.firstChild;
        if (anime && anime.animate && !reduce && okCard) {
          anime.animate(okCard, { scale: [0.92, 1], opacity: [0, 1], duration: 400, ease: 'outBack' });
          setTimeout(function () { okCard.style.opacity = 1; okCard.style.transform = 'none'; }, 800);
        }
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    // Carga la carta (id → nombre/precio) y engancha los controles al render del módulo menu
    function conCarta(rows) {
      rows.forEach(function (p) { if (p.available !== false) carta[p.id] = { name: p.name, price: p.price || 0 }; });
      // Purga del carrito los platos que ya no están disponibles
      Object.keys(cart).forEach(function (id) { if (!carta[id]) delete cart[id]; });
      guardar();
      inyectarControles();
      pintarBar();
      new MutationObserver(inyectarControles).observe(mnList, { childList: true, subtree: true });
    }
    if (window.__PREVIEW__) {
      conCarta([
        { id: 'd1', name: 'Provoleta a la parrilla', price: 5200, available: true },
        { id: 'd2', name: 'Bife de chorizo', price: 12500, available: true },
        { id: 'd4', name: 'Flan casero', price: 3900, available: true },
      ]);
    } else {
      fetch('/api/menu').then(function (r) { return r.json(); }).then(conCarta).catch(function () {});
    }
  }

  // ---- Seguimiento /mi-pedido.html ----
  var trackBox = document.getElementById('pc-track');
  var trackForm = document.getElementById('pc-track-form');
  if (trackBox && trackForm) {
    var codeInput = document.getElementById('pc-code');
    var timer = null;
    var ultimoEstado = '';

    function pintarPedido(p) {
      var cancelado = p.status === 'cancelado';
      var idx = IDX[p.status] !== undefined ? IDX[p.status] : 0;
      var html = '<div class="card">';
      html += '<p style="margin:0 0 2px;font-weight:700">Pedido ' + App.esc(p.code) + ' — ' + App.esc(p.name) + '</p>';
      html += '<p class="muted" style="margin:0 0 8px;font-size:.85rem">' + (p.mode === 'delivery' ? 'Envío a domicilio' + (p.address ? ' — ' + App.esc(p.address) : '') : 'Retiro en el local') + '</p>';
      if (cancelado) {
        html += '<p class="pc-cancelado">Este pedido fue cancelado. Ante cualquier duda, contactanos.</p>';
      } else {
        html += '<div class="pc-pasos"><div class="pc-pasoslinea" id="pc-linea"></div>' + ESTADOS.map(function (e, i) {
          var cls = i < idx ? 'done' : (i === idx ? 'current' : '');
          return '<div class="pc-paso ' + cls + '"><span class="pc-bola">' + (i < idx ? '${phIcon('check', { size: 14 })}' : i + 1) + '</span><small>' + e.label + '</small></div>';
        }).join('') + '</div>';
      }
      html += '<div style="margin-top:14px">' + p.items.map(function (it) {
        return '<div class="pc-linea"><span class="pc-nom">' + it.qty + ' × ' + App.esc(it.name) + '</span><span class="pc-sub">' + App.money(it.price * it.qty) + '</span></div>';
      }).join('') + '</div>';
      html += '<div class="pc-total"><span>Total</span><span>' + App.money(p.total) + '</span></div>';
      if (p.note) html += '<p class="muted" style="margin:4px 0 0;font-size:.85rem">Aclaración: ' + App.esc(p.note) + '</p>';
      html += '</div>';
      trackBox.innerHTML = html;
      var anime = window.anime;
      var linea = document.getElementById('pc-linea');
      if (linea && !cancelado) {
        // La línea de progreso avanza hasta el paso actual (misma técnica que ordertrack)
        var pct = idx === 0 ? 0 : (idx / (ESTADOS.length - 1)) * 100;
        if (anime && anime.animate && !reduce) {
          anime.animate(linea, { width: [0, 'calc((100% - 48px) * ' + (pct / 100) + ')'], duration: 700, ease: 'outCubic' });
        }
        // Red de seguridad: fija el ancho final aunque el loop esté pausado
        setTimeout(function () { linea.style.width = 'calc((100% - 48px) * ' + (pct / 100) + ')'; }, 900);
      }
      // Aviso sutil cuando el estado cambió entre sondeos
      if (ultimoEstado && ultimoEstado !== p.status) App.toast('Tu pedido avanzó de estado');
      ultimoEstado = p.status;
    }

    function consultar(code, silencioso) {
      if (window.__PREVIEW__) {
        pintarPedido({ code: 'PC-DEMO01', name: 'Ana', mode: 'retiro', address: '', status: 'preparando', note: '', total: 18900, items: [{ name: 'Provoleta a la parrilla', price: 5200, qty: 1 }, { name: 'Bife de chorizo', price: 12500, qty: 1 }] });
        return;
      }
      fetch('/api/pedidoscarta/track/' + encodeURIComponent(code)).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); }).then(function (res) {
        if (!res.ok) { if (!silencioso) trackBox.innerHTML = '<p class="muted">' + App.esc(res.d.error || 'No encontramos ese pedido') + '</p>'; return; }
        pintarPedido(res.d);
        // Sondeo liviano mientras el pedido siga en curso
        clearTimeout(timer);
        if (res.d.status !== 'entregado' && res.d.status !== 'cancelado') {
          timer = setTimeout(function () { consultar(code, true); }, 8000);
        }
      }).catch(function () { if (!silencioso) trackBox.innerHTML = '<p class="muted">No pudimos consultar el pedido.</p>'; });
    }

    trackForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = codeInput.value.trim().toUpperCase();
      if (code) consultar(code);
    });
    // Enlace directo /mi-pedido.html?code=PC-XXXXXX: auto-consulta
    var qs = new URLSearchParams(location.search).get('code');
    if (qs) { codeInput.value = qs.toUpperCase(); consultar(qs.toUpperCase()); }
    else if (window.__PREVIEW__) { consultar('PC-DEMO01'); }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Tablero /comandas.html ----
  var adminBox = document.getElementById('pc-admin');
  if (adminBox) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var pedidos = [];
    var fStatus = document.getElementById('pc-f-status');
    var kpisBox = document.getElementById('pc-kpis');
    var LBL = { recibido: 'Recibido', preparando: 'En preparación', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado' };
    var SIG = { recibido: 'preparando', preparando: 'listo', listo: 'entregado' };
    if (fStatus) Object.keys(LBL).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = LBL[k]; fStatus.appendChild(o); });

    function esHoy(iso) { return String(iso).slice(0, 10) === new Date().toISOString().slice(0, 10); }

    function pintarKpis() {
      var enCurso = pedidos.filter(function (p) { return p.status === 'recibido' || p.status === 'preparando'; }).length;
      var listos = pedidos.filter(function (p) { return p.status === 'listo'; }).length;
      var totalHoy = pedidos.filter(function (p) { return esHoy(p.createdAt) && p.status !== 'cancelado'; }).reduce(function (t, p) { return t + (p.total || 0); }, 0);
      kpisBox.innerHTML = '<div class="card"><strong data-n="' + enCurso + '">0</strong><span class="muted">En curso</span></div>' +
        '<div class="card"><strong data-n="' + listos + '">0</strong><span class="muted">Listos para entregar</span></div>' +
        '<div class="card"><strong data-n="' + totalHoy + '" data-money="1">0</strong><span class="muted">Total del día</span></div>';
      // KPIs con count-up de Anime.js + red de seguridad
      [].slice.call(kpisBox.querySelectorAll('strong')).forEach(function (el) {
        var fin = Number(el.getAttribute('data-n'));
        var esPlata = el.getAttribute('data-money');
        var mostrar = function (v) { el.textContent = esPlata ? App.money(Math.round(v)) : String(Math.round(v)); };
        var anime = window.anime;
        if (anime && anime.animate && !reduce && fin > 0) {
          var obj = { v: 0 };
          anime.animate(obj, { v: fin, duration: 700, ease: 'outCubic', onUpdate: function () { mostrar(obj.v); } });
          setTimeout(function () { mostrar(fin); }, 900);
        } else { mostrar(fin); }
      });
    }

    function pintar() {
      var filtro = fStatus ? fStatus.value : '';
      var rows = filtro ? pedidos.filter(function (p) { return p.status === filtro; }) : pedidos;
      adminBox.innerHTML = App.table(rows, [
        { key: 'code', label: 'Código' },
        { label: 'Cliente', render: function (r) { return App.esc(r.name) + '<br><span class="muted" style="font-size:.8rem">' + App.esc(r.phone) + '</span>'; } },
        { label: 'Modalidad', render: function (r) { return r.mode === 'delivery' ? 'Envío<br><span class="muted" style="font-size:.8rem">' + App.esc(r.address || '') + '</span>' : 'Retiro'; } },
        { label: 'Pedido', render: function (r) { return r.items.map(function (it) { return it.qty + '× ' + App.esc(it.name); }).join('<br>') + (r.note ? '<br><span class="muted" style="font-size:.8rem">' + App.esc(r.note) + '</span>' : ''); } },
        { label: 'Total', render: function (r) { return App.money(r.total); } },
        { label: 'Estado', render: function (r) { return '<span class="pc-est' + (r.status === 'cancelado' ? ' off' : (r.status === 'entregado' ? '' : ' on')) + '">' + (LBL[r.status] || r.status) + '</span>'; } },
        { label: 'Acciones', render: function (r) {
          var b = '';
          if (SIG[r.status]) b += '<button class="btn ghost" type="button" data-next="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">→ ' + LBL[SIG[r.status]] + '</button>';
          if (r.status !== 'cancelado' && r.status !== 'entregado') b += '<button class="btn ghost" type="button" data-cancel="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Cancelar</button>';
          b += '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
          return b;
        } },
      ]);
      adminBox.querySelectorAll('[data-next]').forEach(function (b) { b.addEventListener('click', function () { avanzar(b.getAttribute('data-next')); }); });
      adminBox.querySelectorAll('[data-cancel]').forEach(function (b) { b.addEventListener('click', function () { cancelar(b.getAttribute('data-cancel')); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
      pintarKpis();
    }

    async function cambiarEstado(id, status, aviso) {
      if (window.__PREVIEW__) { App.toast('Vista previa: cambiaría el estado'); return; }
      try {
        var upd = await App.api('/api/pedidoscarta/admin/' + id, { method: 'PATCH', body: { status: status } });
        pedidos = pedidos.map(function (r) { return r.id === id ? upd : r; });
        pintar();
        App.toast(aviso);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }
    function avanzar(id) {
      var p = pedidos.filter(function (r) { return r.id === id; })[0];
      if (p && SIG[p.status]) cambiarEstado(id, SIG[p.status], 'Pedido → ' + LBL[SIG[p.status]]);
    }
    function cancelar(id) {
      if (!window.__PREVIEW__ && !confirm('¿Cancelar este pedido?')) return;
      cambiarEstado(id, 'cancelado', 'Pedido cancelado');
    }
    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este pedido del historial?')) return;
      try {
        await App.api('/api/pedidoscarta/admin/' + id, { method: 'DELETE' });
        pedidos = pedidos.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Pedido borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }
    if (fStatus) fStatus.addEventListener('change', pintar);

    var csvBtn = document.getElementById('pc-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var filas = [['codigo', 'cliente', 'telefono', 'modalidad', 'direccion', 'pedido', 'total', 'estado', 'fecha']].concat(pedidos.map(function (p) {
        return [p.code, p.name, p.phone, p.mode, p.address || '', p.items.map(function (it) { return it.qty + 'x ' + it.name; }).join(' | '), p.total, LBL[p.status] || p.status, p.createdAt];
      }));
      var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'comandas.csv';
      a.click();
    });

    function cargar(primera) {
      App.api('/api/pedidoscarta/admin/list').then(function (rows) {
        pedidos = rows; pintar();
      }).catch(function (err) { if (primera) adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
    if (window.__PREVIEW__) {
      pedidos = [
        { id: 'd1', code: 'PC-DEMO01', name: 'Ana López', phone: '11 5555-5555', mode: 'retiro', address: '', note: '', items: [{ name: 'Provoleta', price: 5200, qty: 1 }, { name: 'Bife de chorizo', price: 12500, qty: 1 }], total: 17700, status: 'preparando', createdAt: new Date().toISOString() },
        { id: 'd2', code: 'PC-DEMO02', name: 'Juan Pérez', phone: '11 4444-4444', mode: 'delivery', address: 'Calle 123', note: 'Sin sal', items: [{ name: 'Risotto de hongos', price: 9800, qty: 2 }], total: 19600, status: 'recibido', createdAt: new Date().toISOString() },
      ];
      pintar();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      cargar(true);
      // Refresco liviano cada 20 s: las comandas nuevas aparecen solas
      setInterval(function () { cargar(false); }, 20000);
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navPC = document.getElementById('nav-comandas');
    if (navPC && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navPC.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Pedidos de la carta**: los visitantes arman su pedido desde \`/carta.html\` (botón "Agregar" por plato), eligen retiro o envío y confirman; el servidor valida los platos contra la carta, **recalcula el total con los precios del backend** y devuelve un código \`PC-XXXXXX\` para seguirlo en vivo en \`/mi-pedido.html\`. Los pedidos viven en la colección \`foodorders\`. ${cfg.moduleIds.includes('auth') ? 'La cocina los gestiona en \`/comandas.html\` (estados Recibido → En preparación → Listo → Entregado, KPIs y CSV).' : 'Para gestionarlos desde la web activá el módulo **Autenticación** (habilita \`/comandas.html\`); sin él, mirá \`data/foodorders.json\`.'} No cobra online: el pago se coordina al retirar o entregar.`,
  ],
};
