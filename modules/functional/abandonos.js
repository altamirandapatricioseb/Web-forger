// Carritos abandonados con backend real. Es el agujero más caro de cualquier tienda: entre 6 y 8
// de cada 10 carritos que se arman nunca llegan al checkout, y hasta ahora el catálogo no se
// enteraba de ninguno — el carrito vivía en el localStorage del visitante, la única computadora a
// la que el dueño del negocio no tiene acceso. Si nadie compra, el panel de pedidos está vacío y
// no hay nada más que decir.
//
// Acá cada carrito con productos deja una fila EN EL SERVIDOR: qué llevaba, cuánto valía y cuándo
// fue la última actividad. El subtotal se recalcula contra la colección products, igual que en el
// checkout: el navegador dice qué productos y cuántos, nunca cuánto valen.
//
// Tres decisiones que lo separan de "guardar el carrito en una tabla":
//   1. "Abandonado" NO es un estado guardado: lo calcula el servidor con SU reloj comparando la
//      última actividad contra la espera configurada. Un estado guardado se desactualiza solo y
//      termina mostrando como abandonado un carrito que se compró hace media hora.
//   2. Un carrito se da por RECUPERADO si existe una orden del mismo visitante posterior a su
//      última actividad. Se resuelve con una consulta a orders al leer, no con un aviso del
//      navegador: el aviso no llega si la pestaña se cierra justo después de comprar.
//   3. Cada carrito tiene un CÓDIGO de recuperación y un enlace /catalog.html?recuperar=CODIGO
//      que le devuelve el carrito armado a quien lo abre. Sin eso, "te acordás que dejaste algo"
//      obliga al cliente a buscar los productos de nuevo, que es justo lo que lo hizo abandonar.
//
// El seguimiento es anónimo por default (un identificador aleatorio del navegador, sin IP ni
// user-agent). Si el visitante inició sesión, el servidor toma su email DEL TOKEN —nunca del
// cuerpo del pedido, que se puede escribir a mano— y ahí sí el negocio tiene a quién escribirle.
// Con el módulo Avisos por email activo, el panel manda el recordatorio con el enlace incluido.
// Y si el visitante rechazó el almacenamiento en el centro de privacidad, no se manda nada.
// Panel /abandonos-admin.html con KPIs animados (Anime.js) + red de seguridad.
const { phIcon } = require('../../src/icons');

// Minutos sin actividad después de los cuales un carrito cuenta como abandonado
const ESPERA_MIN = 30;

module.exports = {
  id: 'abandonos', type: 'functional', name: 'Carritos abandonados',
  description: 'Cada carrito con productos deja una fila en el servidor (qué llevaba, cuánto valía, cuándo fue la última actividad) con el subtotal recalculado contra el catálogo real. "Abandonado" lo decide el servidor con su reloj, no es un estado guardado que se desactualiza; y un carrito se da por recuperado si existe una orden posterior del mismo visitante, resuelto al leer contra la colección de pedidos. Cada uno trae un enlace de recuperación que le devuelve el carrito armado a quien lo abre. Seguimiento anónimo por default; con sesión iniciada el email sale del token, nunca del cuerpo del pedido. Panel /abandonos-admin.html con KPIs, valor abandonado y, con Avisos por email activo, envío del recordatorio. Animado con Anime.js.',
  usesAnime: true,
  requires: ['cart'],
  mounts: [{ route: '/api/abandonos', file: 'routes/abandonos.js' }],
  collections: ['abandonedcarts'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Carritos', href: '/abandonos-admin.html', id: 'nav-abandonos' }] : [],
  head: () => `  <style>
    .ab-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin:22px 0}
    .ab-kpis .card{text-align:center}
    .ab-kpis strong{display:block;font-size:1.7rem;font-variant-numeric:tabular-nums}
    .ab-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .ab-chip.abierto{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .ab-chip.aband{background:#c0392b18;color:#c0392b}
    .ab-chip.recup{background:#2e9e5b20;color:#1d6b3c}
    .ab-acc{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .ab-acc .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .ab-items{font-size:.82rem;color:var(--muted)}
    .ab-link{font-family:ui-monospace,'Cascadia Code','Courier New',monospace;font-size:.78rem;word-break:break-all}
    .ab-aviso{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;margin-bottom:20px;font-size:.92rem}
  </style>`,
  files: (cfg) => ({
    'routes/abandonos.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
const { verify } = require('../src/token');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
// Minutos sin actividad después de los cuales un carrito cuenta como abandonado
const ESPERA_MIN = ${ESPERA_MIN};
// Los carritos viejos se barren solos: esto es una herramienta de venta, no un archivo histórico
const RETENCION_DIAS = 60;

/** Subtotal REAL: los precios salen del catálogo, nunca del cuerpo del pedido. */
async function detalleDe(items) {
  if (!Array.isArray(items) || !items.length) return { lineas: [], subtotal: 0 };
  const porId = new Map((await db.all('products')).map(p => [p.id, p]));
  const lineas = [];
  for (const i of items.slice(0, 200)) {
    const p = i && porId.get(i.productId);
    const qty = Math.round(Number(i && i.qty));
    if (!p || !isFinite(qty) || qty < 1 || qty > 99) continue;
    lineas.push({ productId: p.id, name: p.name, unitPrice: Number(p.price) || 0, qty });
  }
  return { lineas, subtotal: Math.round(lineas.reduce((s, l) => s + l.unitPrice * l.qty, 0)) };
}

/** Identificador de visitante: 12 caracteres hexadecimales. Nada más se acepta como tal. */
const VID = /^[a-f0-9]{12}$/;
${cfg.moduleIds.includes('auth') ? `
/** Sesión OPCIONAL: si el visitante inició sesión, su email sale del token firmado. Leerlo del
 *  cuerpo del pedido dejaría que cualquiera cargue carritos a nombre de otra persona. */
function sesionDe(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
  return (token && verify(token)) || null;
}
` : ''}
router.post('/latido', async (req, res) => {
  const vid = String((req.body && req.body.vid) || '');
  if (!VID.test(vid)) return res.status(422).json({ error: 'Identificador inválido' });
  const { lineas, subtotal } = await detalleDe(req.body && req.body.items);
  const previo = (await db.find('abandonedcarts', c => c.vid === vid))[0];

  // Carrito vaciado: se borra la fila. Un carrito vacío no es un carrito abandonado, y dejarlo
  // inflaría el contador con gente que se arrepintió antes de irse.
  if (!lineas.length) {
    if (previo) await db.remove('abandonedcarts', previo.id);
    return res.json({ ok: true, vacio: true });
  }

  const datos = { items: lineas, subtotal, lastAt: new Date().toISOString() };
${cfg.moduleIds.includes('auth') ? `  const u = sesionDe(req);
  if (u) { datos.userId = u.sub || ''; datos.email = u.email || ''; datos.name = u.name || ''; }
` : ''}
  if (previo) {
    const row = await db.update('abandonedcarts', previo.id, datos);
    return res.json({ ok: true, code: row.code });
  }
  const row = await db.insert('abandonedcarts', {
    vid, code: crypto.randomBytes(5).toString('hex').toUpperCase(),
    userId: '', email: '', name: '', atendido: false, ...datos,
  });
  res.json({ ok: true, code: row.code });
});

// GET /api/abandonos/recuperar/:code — público: devuelve el carrito para volver a armarlo.
// No expone el email ni el nombre: el enlace puede terminar reenviado a cualquiera.
router.get('/recuperar/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const c = (await db.find('abandonedcarts', x => String(x.code).toUpperCase() === code))[0];
  if (!c) return res.status(404).json({ error: 'Ese carrito ya no está disponible' });
  // Los precios se vuelven a resolver contra el catálogo: si cambiaron, manda el precio de hoy
  const { lineas } = await detalleDe(c.items);
  res.json({ items: lineas.map(l => ({ productId: l.productId, qty: l.qty })) });
});
${cfg.moduleIds.includes('auth') ? `
/** Estado calculado, nunca guardado: depende del reloj del servidor y de las órdenes existentes. */
function estadoDe(c, ordenes, ahora) {
  const last = Date.parse(c.lastAt || c.createdAt || 0) || 0;
  // ¿Compró después de la última actividad del carrito? Entonces se recuperó solo
  const compro = ordenes.some(o => {
    const mismo = (c.userId && o.userId === c.userId);
    if (!mismo) return false;
    return (Date.parse(o.createdAt || 0) || 0) >= last;
  });
  if (compro) return 'recuperado';
  return (ahora - last) >= ESPERA_MIN * 60000 ? 'abandonado' : 'abierto';
}

// GET /api/abandonos — panel: carritos con su estado calculado (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  const ahora = Date.now();
  const todos = await db.all('abandonedcarts');
  // Barrido de los viejos: al leer, que es cuando ya estamos pagando la consulta
  const limite = ahora - RETENCION_DIAS * 86400000;
  const vivos = [];
  for (const c of todos) {
    if ((Date.parse(c.lastAt || c.createdAt || 0) || 0) < limite) { await db.remove('abandonedcarts', c.id); continue; }
    vivos.push(c);
  }
  const ordenes = await db.all('orders');
  const rows = vivos.map(c => ({
    id: c.id, code: c.code, estado: estadoDe(c, ordenes, ahora),
    subtotal: Number(c.subtotal) || 0,
    items: Array.isArray(c.items) ? c.items : [],
    unidades: (Array.isArray(c.items) ? c.items : []).reduce((s, l) => s + (Number(l.qty) || 0), 0),
    email: c.email || '', name: c.name || '',
    atendido: !!c.atendido, avisadoAt: c.avisadoAt || null,
    lastAt: c.lastAt || c.createdAt || null,
  })).sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')));

  const abandonados = rows.filter(r => r.estado === 'abandonado');
  res.json({
    rows,
    esperaMin: ESPERA_MIN,
    resumen: {
      abiertos: rows.filter(r => r.estado === 'abierto').length,
      abandonados: abandonados.length,
      recuperados: rows.filter(r => r.estado === 'recuperado').length,
      valorAbandonado: abandonados.reduce((s, r) => s + r.subtotal, 0),
      conContacto: abandonados.filter(r => r.email).length,
    },
  });
});

// PUT /api/abandonos/:id — marcar como atendido (ya lo llamé, ya le escribí)
router.put('/:id', requireAdmin, async (req, res) => {
  const c = await db.get('abandonedcarts', req.params.id);
  if (!c) return res.status(404).json({ error: 'Ese carrito ya no existe' });
  const atendido = !(req.body && (req.body.atendido === false || req.body.atendido === 'false'));
  await db.update('abandonedcarts', c.id, { atendido });
  res.json({ ok: true, atendido });
});

// DELETE /api/abandonos/:id — sacarlo de la lista
router.delete('/:id', requireAdmin, async (req, res) => {
  const c = await db.get('abandonedcarts', req.params.id);
  if (!c) return res.status(404).json({ error: 'Ese carrito ya no existe' });
  await db.remove('abandonedcarts', c.id);
  res.json({ ok: true });
});
${cfg.moduleIds.includes('mailer') ? `
// POST /api/abandonos/:id/avisar — recordatorio por email con el enlace de recuperación
router.post('/:id/avisar', requireAdmin, async (req, res) => {
  const c = await db.get('abandonedcarts', req.params.id);
  if (!c) return res.status(404).json({ error: 'Ese carrito ya no existe' });
  if (!c.email) return res.status(409).json({ error: 'Ese carrito es anónimo: no hay a quién escribirle' });
  const origen = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0] + '://' +
    String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0];
  const enlace = origen + '/catalog.html?recuperar=' + encodeURIComponent(c.code);
  const detalle = (Array.isArray(c.items) ? c.items : []).map(l => l.qty + '× ' + l.name).join(', ');
  await mailer.notifyTo(c.email, 'Te quedó algo en el carrito',
    (c.name ? 'Hola ' + c.name + ': ' : 'Hola: ') + 'dejaste ' + detalle + ' en tu carrito. ' +
    'Podés retomarlo desde este enlace: ' + enlace);
  await db.update('abandonedcarts', c.id, { avisadoAt: new Date().toISOString() });
  res.json({ ok: true, enlace });
});
` : ''}` : `// El panel de carritos abandonados requiere el módulo de autenticación. Sin él el seguimiento
// funciona igual y las filas se consultan en data/abandonedcarts.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'abandonos-admin': {
      title: 'Carritos',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('shopping-cart', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Carritos abandonados</h2>
      <p class="section-sub">Los carritos que se armaron y no llegaron a comprarse. Cada uno trae un enlace que le devuelve el carrito armado a quien lo abre${cfg.moduleIds.includes('mailer') ? ', y podés mandarle el recordatorio por email si el visitante tenía sesión iniciada' : ''}. Solo visible para administradores.</p>
      <p class="ab-aviso" id="ab-aviso">—</p>
      <div class="ab-kpis" id="ab-kpis"></div>
      <div id="ab-lista"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo carritos abandonados: le avisa al servidor cada cambio del carrito (evento 'wf:cart'
   del módulo Carrito) para que quede la fila, y resuelve el enlace de recuperación
   /catalog.html?recuperar=CODIGO volviendo a armar el carrito. El subtotal lo calcula el servidor:
   acá sólo viajan qué productos y cuántos.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel vive en /abandonos-admin.html.` : ''}
   Anime.js para los KPIs, con red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CLAVE_VID = 'wf-vid';

  // Identificador aleatorio del navegador. No es un dato personal: no viaja ni IP ni user-agent,
  // y sirve sólo para que dos cargas del mismo navegador no cuenten como dos carritos distintos.
  function vid() {
    try {
      var v = localStorage.getItem(CLAVE_VID);
      if (!v || !/^[a-f0-9]{12}$/.test(v)) {
        v = '';
        var bytes = new Uint8Array(6);
        (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(bytes) : bytes.forEach(function (_, i) { bytes[i] = Math.floor(Math.random() * 256); });
        for (var i = 0; i < bytes.length; i++) v += ('0' + bytes[i].toString(16)).slice(-2);
        localStorage.setItem(CLAVE_VID, v);
      }
      return v;
    } catch (e) { return ''; }
  }

  // Respeta la decisión del visitante en el centro de privacidad: si eligió "solo esenciales",
  // no se manda nada. El módulo existe para vender, no para seguir a quien pidió que no.
  function permitido() {
    try { return localStorage.getItem('cookie-consent') !== 'essential'; } catch (e) { return true; }
  }

  var pendiente = null;
  function latido(items) {
    if (window.__PREVIEW__ || !permitido()) return;
    var id = vid();
    if (!id) return;
    // Se agrupa: agregar tres productos seguidos manda UN aviso, no tres
    clearTimeout(pendiente);
    pendiente = setTimeout(function () {
      fetch('/api/abandonos/latido', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, (function () {
          try { var t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; } catch (e) { return {}; }
        })()),
        body: JSON.stringify({ vid: id, items: (items || []).map(function (i) { return { productId: i.productId, qty: i.qty }; }) }),
      }).catch(function () {});
    }, 900);
  }

  document.addEventListener('wf:cart', function (e) { latido(e.detail); });

  // ---- Enlace de recuperación: /catalog.html?recuperar=CODIGO ----
  (function () {
    var code = new URLSearchParams(location.search).get('recuperar');
    if (!code || window.__PREVIEW__) return;
    fetch('/api/abandonos/recuperar/' + encodeURIComponent(code))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('no')); })
      .then(function (d) {
        if (!d || !d.items || !d.items.length) return;
        try { localStorage.setItem('cart', JSON.stringify(d.items)); } catch (e) { return; }
        // Se avisa por el mismo evento que usa el módulo Carrito, así todo lo que escucha el
        // carrito (envío gratis, descuentos, el contador de la navbar) se entera sin recargar
        document.dispatchEvent(new CustomEvent('wf:cart', { detail: d.items }));
        if (window.App && App.toast) App.toast('Te devolvimos el carrito que habías dejado');
        // La dirección se limpia: recargar no tiene que volver a pisar el carrito
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
        setTimeout(function () { location.reload(); }, 900);
      })
      .catch(function () {});
  })();
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /abandonos-admin.html ----
  var box = document.getElementById('ab-lista');
  if (box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var datos = null;

    function contar(el, hasta, money) {
      if (!el) return;
      var fmt = function (v) { return money ? App.money(Math.round(v)) : Math.round(v).toLocaleString('es-AR'); };
      var anime = window.anime;
      if (!anime || !anime.animate || reduce) { el.textContent = fmt(hasta); return; }
      var st = { v: 0 };
      anime.animate(st, { v: hasta, duration: 620, ease: 'outCubic', onUpdate: function () { el.textContent = fmt(st.v); } });
      // Red de seguridad: Anime.js pausa su loop con la pestaña oculta
      setTimeout(function () { el.textContent = fmt(hasta); }, 820);
    }

    var NOMBRE = { abierto: 'En curso', abandonado: 'Abandonado', recuperado: 'Recuperado' };
    var CLASE = { abierto: 'abierto', abandonado: 'aband', recuperado: 'recup' };

    function pintar(d) {
      datos = d;
      document.getElementById('ab-aviso').textContent =
        'Un carrito cuenta como abandonado después de ' + d.esperaMin + ' minutos sin actividad. ' +
        'Se da por recuperado solo si aparece un pedido posterior del mismo visitante. ' +
        d.resumen.conContacto + ' de los ' + d.resumen.abandonados + ' abandonados tienen email (el visitante había iniciado sesión).';

      var kpis = document.getElementById('ab-kpis');
      kpis.innerHTML = '<div class="card"><strong id="ab-k-ab">0</strong><span class="muted">abandonados</span></div>' +
        '<div class="card"><strong id="ab-k-val">0</strong><span class="muted">valor abandonado</span></div>' +
        '<div class="card"><strong id="ab-k-cur">0</strong><span class="muted">carritos en curso</span></div>' +
        '<div class="card"><strong id="ab-k-rec">0</strong><span class="muted">recuperados</span></div>';
      contar(document.getElementById('ab-k-ab'), d.resumen.abandonados);
      contar(document.getElementById('ab-k-val'), d.resumen.valorAbandonado, true);
      contar(document.getElementById('ab-k-cur'), d.resumen.abiertos);
      contar(document.getElementById('ab-k-rec'), d.resumen.recuperados);

      box.innerHTML = App.table(d.rows, [
        { label: 'Carrito', render: function (r) {
          return '<strong>' + App.money(r.subtotal) + '</strong> <span class="muted">· ' + r.unidades + ' unidades</span>' +
            '<br><span class="ab-items">' + App.esc(r.items.map(function (l) { return l.qty + '× ' + l.name; }).join(', ')) + '</span>';
        } },
        { label: 'Contacto', render: function (r) {
          if (!r.email) return '<span class="muted">Anónimo</span>';
          return App.esc(r.name || '') + '<br><span class="muted" style="font-size:.82rem">' + App.esc(r.email) + '</span>';
        } },
        { label: 'Estado', render: function (r) {
          return '<span class="ab-chip ' + CLASE[r.estado] + '">' + NOMBRE[r.estado] + '</span>' +
            (r.atendido ? ' <span class="ab-chip abierto">Atendido</span>' : '') +
            (r.avisadoAt ? '<br><span class="muted" style="font-size:.78rem">avisado</span>' : '') +
            '<br><span class="muted" style="font-size:.78rem">' + App.esc(new Date(r.lastAt).toLocaleString('es-AR')) + '</span>';
        } },
        { label: '', render: function (r) {
          return '<span class="ab-acc">' +
            '<button class="btn ghost" type="button" data-ab-link="' + r.code + '">Copiar enlace</button>' +
            ${cfg.moduleIds.includes('mailer') ? `(r.email ? '<button class="btn ghost" type="button" data-ab-mail="' + r.id + '">Enviar recordatorio</button>' : '') +` : ''}
            '<button class="btn ghost" type="button" data-ab-at="' + r.id + '">' + (r.atendido ? 'Sin atender' : 'Marcar atendido') + '</button>' +
            '<button class="btn ghost" type="button" data-ab-del="' + r.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);

      box.querySelectorAll('[data-ab-link]').forEach(function (b) {
        b.addEventListener('click', function () {
          var url = location.origin + '/catalog.html?recuperar=' + b.getAttribute('data-ab-link');
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () { App.toast('Enlace copiado'); }, function () { prompt('Copiá el enlace:', url); });
          } else { prompt('Copiá el enlace:', url); }
        });
      });
      box.querySelectorAll('[data-ab-at]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var r = d.rows.filter(function (x) { return x.id === b.getAttribute('data-ab-at'); })[0];
          if (!r) return;
          try {
            await App.api('/api/abandonos/' + r.id, { method: 'PUT', body: { atendido: !r.atendido } });
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-ab-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Sacar este carrito de la lista?')) return;
          try {
            await App.api('/api/abandonos/' + b.getAttribute('data-ab-del'), { method: 'DELETE' });
            App.toast('Carrito borrado');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
${cfg.moduleIds.includes('mailer') ? `      box.querySelectorAll('[data-ab-mail]').forEach(function (b) {
        b.addEventListener('click', async function () {
          try {
            await App.api('/api/abandonos/' + b.getAttribute('data-ab-mail') + '/avisar', { method: 'POST', body: {} });
            App.toast('Recordatorio registrado en la bandeja de salida');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
` : ''}    }

    var DEMO = {
      esperaMin: ${ESPERA_MIN},
      resumen: { abiertos: 3, abandonados: 12, recuperados: 4, valorAbandonado: 184970, conContacto: 5 },
      rows: [
        { id: 'd1', code: 'A1B2C3D4E5', estado: 'abandonado', subtotal: 24997, unidades: 3, items: [{ qty: 2, name: 'Producto Clásico' }, { qty: 1, name: 'Combo Inicial' }], email: 'cliente@ejemplo.com', name: 'Cliente de ejemplo', atendido: false, avisadoAt: null, lastAt: new Date().toISOString() },
        { id: 'd2', code: 'F6G7H8I9J0', estado: 'abierto', subtotal: 9999, unidades: 1, items: [{ qty: 1, name: 'Producto Premium' }], email: '', name: '', atendido: false, avisadoAt: null, lastAt: new Date().toISOString() },
      ],
    };

    async function cargar() {
      if (window.__PREVIEW__) { pintar(DEMO); return; }
      try { pintar(await App.api('/api/abandonos')); }
      catch (err) { if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; }
    }

    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
    } else {
      cargar();
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navA = document.getElementById('nav-abandonos');
    if (navA && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navA.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Carritos abandonados**: cada carrito con productos deja una fila en \`abandonedcarts\` con el subtotal **recalculado en el servidor** contra el catálogo. "Abandonado" no se guarda: lo decide el servidor comparando la última actividad con la espera de **${ESPERA_MIN} minutos**, y un carrito pasa a "recuperado" solo si aparece un pedido posterior del mismo visitante. Cada uno trae un **enlace de recuperación** (\`/catalog.html?recuperar=CODIGO\`) que le devuelve el carrito armado a quien lo abre.${cfg.moduleIds.includes('auth') ? ' El panel está en `/abandonos-admin.html`.' : ' Sin el módulo **Autenticación** no hay panel ni email de contacto: las filas se consultan en `data/abandonedcarts.json`.'}${cfg.moduleIds.includes('mailer') ? ' Con **Avisos por email** activo podés mandar el recordatorio con el enlace desde el panel.' : ''} El seguimiento es **anónimo** (un identificador aleatorio del navegador, sin IP ni user-agent) y **respeta el rechazo del banner de cookies**: si el visitante eligió "solo esenciales", no se manda nada. El email sólo aparece si el visitante **tenía sesión iniciada**, y sale del token firmado, nunca del cuerpo del pedido.`,
  ],
};
