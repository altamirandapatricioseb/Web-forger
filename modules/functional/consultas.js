// Preguntas sobre el producto: el canal de venta que le faltaba a la ficha. Quien duda antes de
// comprar hoy tiene dos caminos —escribir por WhatsApp o irse—, y los dos tienen el mismo problema:
// la respuesta se la lleva una sola persona. Las diez que iban a preguntar lo mismo se van igual.
//
// Acá la pregunta y su respuesta quedan PUBLICADAS en la ficha, así el trabajo de contestar una vez
// sirve para siempre. Es, además, el contenido que más convierte de una página de producto: lo
// escribieron compradores reales y contesta exactamente lo que frena la compra ("¿viene con
// garantía?", "¿entra en un placard de 60 cm?").
//
// Cuatro decisiones que lo separan de una caja de comentarios:
//
//   1. NADA SE PUBLICA SOLO. Una pregunta entra como pendiente y aparece en la ficha recién cuando
//      el negocio la contesta. Un muro público donde cualquiera escribe sin moderación en la ficha
//      de un producto es spam servido en la página que más importa.
//   2. EL EMAIL DE QUIEN PREGUNTA NUNCA SE MUESTRA. Se guarda sólo para avisarle cuando haya
//      respuesta, y la vista pública lo omite por construcción (no por un `hidden` en el HTML).
//   3. LAS URLs SE RECHAZAN EN EL SERVIDOR. El 90% del spam de formularios abiertos es un enlace.
//      Una pregunta genuina sobre un producto casi nunca necesita uno.
//   4. EL AVISO AL QUE PREGUNTÓ SALE AL RESPONDER, NO ANTES. Con el módulo Avisos por email activo,
//      contestar dispara el mail con la respuesta adentro: es la parte que devuelve a la persona a
//      la ficha, y la que convierte la consulta en venta.
//
// El bloque de la ficha lo inyecta este módulo del lado del cliente (la ficha la arma el servidor y
// no tiene por qué saber que las consultas existen). Animado con Anime.js: las respuestas entran
// con stagger y el envío hace un pop, con red de seguridad por si el loop está pausado.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'consultas', type: 'functional', name: 'Preguntas sobre el producto',
  description: 'El bloque "Preguntas y respuestas" de la ficha de producto: el visitante pregunta sin registrarse y el negocio contesta desde su panel, con la respuesta quedando PUBLICADA para todos los que entren después. Nada aparece sin moderación (una pregunta entra pendiente y se publica al contestarla), el email de quien pregunta no se muestra nunca y las URLs se rechazan en el servidor. Con Avisos por email activo, el negocio recibe un mail por cada consulta nueva y quien preguntó recibe la respuesta. Panel /consultas-admin.html con filtros por estado, contador de pendientes y exportación. Animado con Anime.js.',
  usesAnime: true,
  requires: ['products-admin', 'ficha'],
  mounts: [{ route: '/api/consultas', file: 'routes/consultas.js' }],
  collections: ['productqa'],
  nav: () => [{ label: 'Consultas', href: '/consultas-admin.html', id: 'nav-consultas' }],
  head: () => `  <style>
    .cs-bloque{margin-top:56px;border-top:1px solid var(--line);padding-top:28px}
    .cs-lista{list-style:none;padding:0;margin:18px 0 0}
    .cs-item{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);padding:15px 17px;margin-bottom:12px}
    .cs-p{display:flex;gap:9px;align-items:flex-start;margin:0 0 9px;font-weight:600;line-height:1.45}
    .cs-p .cs-ico{flex:none;color:var(--accent);margin-top:2px}
    .cs-r{display:flex;gap:9px;align-items:flex-start;margin:0;color:var(--muted);line-height:1.6;padding-left:2px}
    .cs-r .cs-ico{flex:none;margin-top:3px}
    .cs-quien{font-size:.78rem;color:var(--muted);font-weight:400;display:block;margin-top:3px}
    .cs-form{margin-top:20px;border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;background:var(--surface)}
    .cs-form textarea{min-height:80px;resize:vertical}
    .cs-form .btn{width:auto}
    .cs-vacio{color:var(--muted);font-size:.92rem}
    .cs-tabla{width:100%;border-collapse:collapse;font-size:.88rem}
    .cs-tabla th,.cs-tabla td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
    .cs-tabla th{font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600}
    .cs-tabla textarea{margin:0;min-height:60px}
    .cs-chip{display:inline-block;font-size:.71rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .cs-chip.pend{background:#e6a80020;color:#8a6400}
    .cs-chip.list{background:#2e9e5b20;color:#1d6b3c}
    .cs-acc{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
    .cs-acc .btn{width:auto;padding:5px 11px;font-size:.8rem}
    .cs-kpi{display:flex;gap:22px;flex-wrap:wrap;margin:14px 0 6px}
    .cs-kpi div{min-width:110px}
    .cs-kpi strong{display:block;font-size:1.7rem;font-variant-numeric:tabular-nums;line-height:1.1}
    .cs-kpi span{font-size:.79rem;color:var(--muted)}
  </style>`,
  files: (cfg) => ({
    'routes/consultas.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');
${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
const MIN = 8, MAX = 400, MAX_RESPUESTA = 1200;
const TOPE_PENDIENTES = 40;

// El 90% del spam de un formulario abierto es un enlace. Una pregunta genuina sobre un producto
// casi nunca lleva uno, así que rechazarlos filtra casi todo sin molestar a nadie real.
const ENLACE = /(https?:\\/\\/|www\\.|\\b[a-z0-9-]+\\.(com|net|org|ru|xyz|info|biz|top|shop)\\b)/i;

// Cooldown por IP en memoria: frena el envío repetido sin guardar nada. En serverless cada
// instancia tiene el suyo, así que NO es la defensa principal — la defensa es la moderación:
// hasta que alguien conteste, la pregunta no se ve en ninguna parte.
const ultimo = new Map();
const COOLDOWN = 20000;

const esEmail = (e) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(e || ''));

/** Vista PÚBLICA: el email de quien preguntó no está acá. No se oculta con CSS ni se filtra en el
 *  navegador — directamente no viaja, que es la única forma de que no se filtre nunca. */
const publica = (r) => ({
  id: r.id, pregunta: r.pregunta, respuesta: r.respuesta || '',
  nombre: r.nombre || 'Cliente',
  preguntadaAt: r.createdAt || null,
  respondidaAt: r.respondidaAt || null,
});

const interna = (r) => ({
  id: r.id, productId: r.productId, productName: r.productName || '',
  nombre: r.nombre || '', email: r.email || '',
  pregunta: r.pregunta, respuesta: r.respuesta || '',
  publicada: !!r.publicada,
  preguntadaAt: r.createdAt || null, respondidaAt: r.respondidaAt || null,
});

// GET /api/consultas/producto/:productId — lo que se ve en la ficha: sólo lo publicado.
router.get('/producto/:productId', async (req, res) => {
  const rows = await db.find('productqa', r => r.productId === req.params.productId && r.publicada && r.respuesta);
  rows.sort((a, b) => String(b.respondidaAt || '').localeCompare(String(a.respondidaAt || '')));
  res.json(rows.slice(0, 30).map(publica));
});

// POST /api/consultas/producto/:productId — pregunta nueva (pública, sin registro).
// Entra SIEMPRE como pendiente: nada llega a la ficha sin que alguien la conteste.
router.post('/producto/:productId', async (req, res) => {
  const p = await db.get('products', req.params.productId);
  if (!p || p.active === false) return res.status(404).json({ error: 'Ese producto no existe' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const ahora = Date.now();
  if (ip && ultimo.get(ip) && ahora - ultimo.get(ip) < COOLDOWN) {
    return res.status(429).json({ error: 'Esperá unos segundos antes de mandar otra consulta' });
  }

  const pregunta = String((req.body && req.body.pregunta) || '').trim().replace(/\\s+/g, ' ');
  const nombre = String((req.body && req.body.nombre) || '').trim().slice(0, 60);
  const email = String((req.body && req.body.email) || '').trim().slice(0, 120);
  if (pregunta.length < MIN) return res.status(422).json({ error: 'Contanos un poco más: la consulta va de ' + MIN + ' a ' + MAX + ' caracteres' });
  if (pregunta.length > MAX) return res.status(422).json({ error: 'La consulta no puede pasar de ' + MAX + ' caracteres' });
  if (ENLACE.test(pregunta)) return res.status(422).json({ error: 'Las consultas no pueden llevar enlaces' });
  if (email && !esEmail(email)) return res.status(422).json({ error: 'Ese email no parece válido' });

  const pendientes = (await db.find('productqa', r => r.productId === p.id && !r.respuesta)).length;
  if (pendientes >= TOPE_PENDIENTES) {
    return res.status(429).json({ error: 'Tenemos muchas consultas sin responder de este producto. Escribinos y te contestamos directo.' });
  }

  if (ip) ultimo.set(ip, ahora);
  const row = await db.insert('productqa', {
    productId: p.id, productName: p.name,
    nombre: nombre || 'Cliente', email,
    pregunta, respuesta: '', respondidaAt: null,
    // Publicada arranca en false por construcción: la moderación no es una opción del panel,
    // es la única forma en que algo llega a la ficha.
    publicada: false,
  });
${cfg.moduleIds.includes('mailer') ? `  // Aviso al negocio. Es "disparar y seguir": un email caído no puede romper la consulta.
  mailer.notify('Consulta sobre ' + p.name, (nombre || 'Alguien') + ' preguntó: "' + pregunta + '". Contestala desde /consultas-admin.html.').catch(() => {});
` : ''}  res.status(201).json({ ok: true, id: row.id, mensaje: 'Recibimos tu consulta. Te contestamos y la publicamos en esta página.' });
});

// ---------- panel ----------

// GET /api/consultas — todas (solo admin). ?estado=pendiente|respondida
router.get('/', requireAdmin, async (req, res) => {
  let rows = await db.all('productqa');
  const estado = String(req.query.estado || '');
  if (estado === 'pendiente') rows = rows.filter(r => !r.respuesta);
  if (estado === 'respondida') rows = rows.filter(r => r.respuesta);
  rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const todas = await db.all('productqa');
  res.json({
    rows: rows.slice(0, 300).map(interna),
    pendientes: todas.filter(r => !r.respuesta).length,
    publicadas: todas.filter(r => r.publicada && r.respuesta).length,
    total: todas.length,
  });
});

// POST /api/consultas/:id/responder — contestar. Publica la consulta en el mismo movimiento:
// contestar y no publicar sería trabajo tirado, y el panel ya tiene "ocultar" para el otro caso.
router.post('/:id/responder', requireAdmin, async (req, res) => {
  const row = await db.get('productqa', req.params.id);
  if (!row) return res.status(404).json({ error: 'Esa consulta no existe' });
  const respuesta = String((req.body && req.body.respuesta) || '').trim();
  if (respuesta.length < 2) return res.status(422).json({ error: 'Escribí la respuesta' });
  if (respuesta.length > MAX_RESPUESTA) return res.status(422).json({ error: 'La respuesta no puede pasar de ' + MAX_RESPUESTA + ' caracteres' });
  const publicada = !(req.body && req.body.publicada === false);
  const guardada = await db.update('productqa', row.id, {
    respuesta, publicada, respondidaAt: new Date().toISOString(),
  });
${cfg.moduleIds.includes('mailer') ? `  // El aviso a quien preguntó es la parte que devuelve a la persona a la ficha: la respuesta va
  // ADENTRO del mail, no un "entrá a ver". Sólo si dejó email, claro.
  if (row.email) {
    mailer.notifyTo(row.email, 'Respondimos tu consulta sobre ' + (row.productName || 'tu producto'),
      'Preguntaste: "' + row.pregunta + '"\\n\\nNuestra respuesta: ' + respuesta).catch(() => {});
  }
` : ''}  res.json(interna(guardada));
});

// PATCH /api/consultas/:id — mostrar u ocultar de la ficha sin borrar el historial
router.patch('/:id', requireAdmin, async (req, res) => {
  const row = await db.get('productqa', req.params.id);
  if (!row) return res.status(404).json({ error: 'Esa consulta no existe' });
  if (req.body.publicada === undefined) return res.status(422).json({ error: 'Nada que cambiar' });
  res.json(interna(await db.update('productqa', row.id, { publicada: !(req.body.publicada === false || req.body.publicada === 'false') })));
});

// DELETE /api/consultas/:id — para el spam que igual se cuele
router.delete('/:id', requireAdmin, async (req, res) => {
  const row = await db.get('productqa', req.params.id);
  if (!row) return res.status(404).json({ error: 'Esa consulta no existe' });
  await db.remove('productqa', row.id);
  res.json({ ok: true });
});

module.exports = router;
`,
  }),
  pages: () => ({
    'consultas-admin': {
      title: 'Consultas',
      html: `  <section>
    <div class="container">
      <h2>Preguntas sobre los productos</h2>
      <p class="section-sub">Cada respuesta queda publicada en la ficha del producto: contestás una
        vez y le sirve a todos los que entren después. Nada se ve hasta que lo contestás.</p>
      <div id="cs-panel" hidden>
        <div class="cs-kpi" id="cs-kpi"></div>
        <div style="display:flex;gap:9px;flex-wrap:wrap;margin:10px 0 16px">
          <button class="btn ghost" type="button" data-cs-filtro="pendiente">Sin responder</button>
          <button class="btn ghost" type="button" data-cs-filtro="respondida">Respondidas</button>
          <button class="btn ghost" type="button" data-cs-filtro="">Todas</button>
        </div>
        <div style="overflow-x:auto"><table class="cs-tabla">
          <thead><tr><th>Producto</th><th>Consulta</th><th>Respuesta</th><th>Estado</th></tr></thead>
          <tbody id="cs-filas"></tbody>
        </table></div>
      </div>
      <p class="muted" id="cs-sin" hidden>Entrá como administrador para ver las consultas.</p>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo Preguntas sobre el producto.
   El bloque de la ficha se inyecta desde acá: la ficha la arma el servidor y no tiene por qué
   saber que las consultas existen. Lo que se muestra es sólo lo que el negocio ya contestó — la
   moderación vive en el servidor, no en este archivo. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function esc(s) { return (window.App && App.esc) ? App.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  function entrada(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [10, 0], duration: 360, delay: anime.stagger(45), ease: 'outCubic' });
    // Red de seguridad: con la pestaña oculta el loop de Anime no corre y las consultas quedarían
    // invisibles, que es peor que no animar nada
    setTimeout(function () {
      for (var i = 0; i < nodos.length; i++) { nodos[i].style.opacity = 1; nodos[i].style.transform = 'none'; }
    }, 800);
  }

  function pop(el) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) return;
    anime.animate(el, { scale: [1, 1.06, 1], duration: 320, ease: 'outCubic' });
    setTimeout(function () { el.style.transform = 'none'; }, 480);
  }

  /* ---------- bloque de la ficha ---------- */

  var boton = document.getElementById('fi-add');
  var cuerpo = document.getElementById('fi-cuerpo');
  var productId = boton ? boton.getAttribute('data-fi-id') : null;
  // Sin botón (producto agotado) igual se puede preguntar: el id sale del enlace canónico que la
  // ficha ya tiene. Si no hay ninguna de las dos cosas, no estamos en una ficha.
  if (cuerpo && !productId) {
    var marca = cuerpo.querySelector('[data-fi-id]');
    if (marca) productId = marca.getAttribute('data-fi-id');
  }

  if (cuerpo && productId && !window.__PREVIEW__) {
    var bloque = document.createElement('section');
    bloque.className = 'cs-bloque';
    bloque.innerHTML = '<h2>Preguntas y respuestas</h2>' +
      '<div id="cs-lista"><p class="cs-vacio">Cargando consultas…</p></div>' +
      '<form class="cs-form" id="cs-form">' +
        '<label for="cs-q">¿Tenés una duda sobre este producto?</label>' +
        '<textarea id="cs-q" maxlength="400" required placeholder="Preguntá lo que necesites saber antes de comprar."></textarea>' +
        '<div class="grid cols-2">' +
          '<div><label for="cs-nombre">Tu nombre (opcional)</label><input id="cs-nombre" maxlength="60" autocomplete="name"></div>' +
          '<div><label for="cs-email">Tu email (opcional, para avisarte)</label><input id="cs-email" type="email" maxlength="120" autocomplete="email"></div>' +
        '</div>' +
        '<p class="muted" style="font-size:.8rem;margin:2px 0 10px">Tu email no se publica: sólo lo usamos para avisarte cuando respondamos.</p>' +
        '<button class="btn" type="submit" id="cs-enviar">Enviar consulta</button>' +
      '</form>';
    cuerpo.appendChild(bloque);

    var lista = document.getElementById('cs-lista');

    function pintar(rows) {
      if (!rows.length) {
        lista.innerHTML = '<p class="cs-vacio">Todavía no hay consultas sobre este producto. Hacé la primera.</p>';
        return;
      }
      lista.innerHTML = '<ul class="cs-lista">' + rows.map(function (r) {
        return '<li class="cs-item">' +
          '<p class="cs-p"><span class="cs-ico">${phIcon('chat-circle-dots', { size: 17 })}</span><span>' + esc(r.pregunta) +
            '<span class="cs-quien">' + esc(r.nombre) + '</span></span></p>' +
          '<p class="cs-r"><span class="cs-ico">${phIcon('check', { size: 15 })}</span><span>' + esc(r.respuesta) + '</span></p>' +
        '</li>';
      }).join('') + '</ul>';
      entrada(lista.querySelectorAll('.cs-item'));
    }

    fetch('/api/consultas/producto/' + encodeURIComponent(productId))
      .then(function (r) { return r.json(); })
      .then(function (rows) { pintar(Array.isArray(rows) ? rows : []); })
      .catch(function () { lista.innerHTML = '<p class="cs-vacio">No se pudieron cargar las consultas.</p>'; });

    document.getElementById('cs-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var enviar = document.getElementById('cs-enviar');
      var campo = document.getElementById('cs-q');
      enviar.disabled = true;
      App.api('/api/consultas/producto/' + encodeURIComponent(productId), {
        method: 'POST',
        body: {
          pregunta: campo.value,
          nombre: document.getElementById('cs-nombre').value,
          email: document.getElementById('cs-email').value,
        },
      }).then(function (r) {
        campo.value = '';
        App.toast(r.mensaje || 'Recibimos tu consulta');
        pop(enviar);
      }).catch(function (e) { if (e.message !== 'preview') App.toast(e.message); })
        .then(function () { enviar.disabled = false; });
    });
  }

  /* ---------- panel ---------- */

  var panel = document.getElementById('cs-panel');
  if (!panel) return;
  var sin = document.getElementById('cs-sin');
  // El rol sale de localStorage.user, que es lo que guarda el login (mismo criterio que el
  // resto de los paneles). Decodificar el JWT a mano con atob() no sirve: el payload viene en
  // base64url (con - y _) y atob() lo rechaza, así que el panel no se mostraba nunca.
  var me = null;
  try { me = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) {}
  var esAdmin = !!(me && me.role === 'admin');
  if (window.__PREVIEW__) esAdmin = true;
  if (!esAdmin) { if (sin) sin.hidden = false; return; }
  panel.hidden = false;

  var filas = document.getElementById('cs-filas');
  var kpi = document.getElementById('cs-kpi');
  var filtro = 'pendiente';

  function pintarPanel(d) {
    kpi.innerHTML = '<div><strong>' + d.pendientes + '</strong><span>sin responder</span></div>' +
      '<div><strong>' + d.publicadas + '</strong><span>publicadas en las fichas</span></div>' +
      '<div><strong>' + d.total + '</strong><span>consultas en total</span></div>';
    if (!d.rows.length) {
      filas.innerHTML = '<tr><td colspan="4" class="muted">No hay consultas con ese filtro.</td></tr>';
      return;
    }
    filas.innerHTML = d.rows.map(function (r) {
      return '<tr data-cs-id="' + esc(r.id) + '">' +
        '<td><strong>' + esc(r.productName) + '</strong></td>' +
        '<td>' + esc(r.pregunta) + '<span class="cs-quien">' + esc(r.nombre) + (r.email ? ' · ' + esc(r.email) : ' · sin email') + '</span></td>' +
        '<td><textarea class="cs-resp" maxlength="1200" placeholder="Escribí la respuesta…">' + esc(r.respuesta) + '</textarea>' +
          '<div class="cs-acc">' +
            '<button class="btn cs-responder" type="button">' + (r.respuesta ? 'Actualizar' : 'Responder y publicar') + '</button>' +
            (r.respuesta ? '<button class="btn ghost cs-ver" type="button">' + (r.publicada ? 'Ocultar' : 'Mostrar') + '</button>' : '') +
            '<button class="btn ghost cs-borrar" type="button">Borrar</button>' +
          '</div></td>' +
        '<td>' + (r.respuesta
          ? (r.publicada ? '<span class="cs-chip list">publicada</span>' : '<span class="cs-chip pend">oculta</span>')
          : '<span class="cs-chip pend">sin responder</span>') + '</td>' +
      '</tr>';
    }).join('');

    filas.querySelectorAll('[data-cs-id]').forEach(function (tr) {
      var id = tr.getAttribute('data-cs-id');
      tr.querySelector('.cs-responder').addEventListener('click', function () {
        App.api('/api/consultas/' + id + '/responder', { method: 'POST', body: { respuesta: tr.querySelector('.cs-resp').value } })
          .then(function () { App.toast('Respondida y publicada en la ficha'); cargar(); })
          .catch(function (e) { if (e.message !== 'preview') App.toast(e.message); });
      });
      var ver = tr.querySelector('.cs-ver');
      if (ver) ver.addEventListener('click', function () {
        App.api('/api/consultas/' + id, { method: 'PATCH', body: { publicada: ver.textContent === 'Mostrar' } })
          .then(function () { cargar(); })
          .catch(function (e) { if (e.message !== 'preview') App.toast(e.message); });
      });
      tr.querySelector('.cs-borrar').addEventListener('click', function () {
        if (!confirm('¿Borrar esta consulta? No se puede deshacer.')) return;
        App.api('/api/consultas/' + id, { method: 'DELETE' })
          .then(function () { cargar(); })
          .catch(function (e) { if (e.message !== 'preview') App.toast(e.message); });
      });
    });
    entrada(filas.querySelectorAll('[data-cs-id]'));
  }

  function cargar() {
    return App.api('/api/consultas' + (filtro ? '?estado=' + filtro : ''))
      .then(pintarPanel)
      .catch(function (e) { if (e.message !== 'preview') App.toast(e.message); });
  }

  document.querySelectorAll('[data-cs-filtro]').forEach(function (b) {
    b.addEventListener('click', function () { filtro = b.getAttribute('data-cs-filtro'); cargar(); });
  });

  if (window.__PREVIEW__) {
    pintarPanel({
      pendientes: 1, publicadas: 1, total: 2,
      rows: [
        { id: 'd1', productName: 'Producto Clásico', nombre: 'Marina', email: 'marina@ejemplo.com', pregunta: '¿Viene con garantía escrita?', respuesta: '', publicada: false },
        { id: 'd2', productName: 'Producto Premium', nombre: 'Cliente', email: '', pregunta: '¿Hacen envíos al interior?', respuesta: 'Sí, a todo el país en 3 a 5 días hábiles.', publicada: true },
      ],
    });
  } else {
    cargar();
  }
})();`,
  readmeNotes: (cfg) => [
    `**Preguntas sobre el producto**: el bloque aparece al pie de cada ficha (\`/producto/<slug>\`) y **sólo muestra lo que ya respondiste** — una consulta entra como pendiente y no se ve en ninguna parte hasta que la contestás desde \`/consultas-admin.html\`. Es a propósito: un formulario abierto sin moderación en la página que más vende es spam servido en bandeja. El **email de quien pregunta nunca viaja a la vista pública** (no se oculta con CSS: no sale del servidor), y las consultas **con enlaces se rechazan**, que filtra casi todo el spam automático sin molestar a nadie real. Hay un cooldown de 20 segundos por IP: en Vercel cada instancia tiene el suyo, así que la defensa real sigue siendo la moderación.${cfg.moduleIds.includes('mailer') ? ' Con **Avisos por email** activo recibís un mail por cada consulta nueva, y quien preguntó recibe **la respuesta adentro del mail** cuando contestás.' : ' Activá el módulo **Avisos por email** para enterarte de las consultas nuevas sin entrar al panel y para que quien preguntó reciba tu respuesta.'}`,
  ],
};
