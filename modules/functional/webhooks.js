// Integraciones salientes (webhooks): el sitio avisa a otros sistemas cuando pasa algo.
// Es la pieza que le faltaba al catálogo para conectarse con el mundo sin escribir código: cada
// vez que una operación de escritura de CUALQUIER módulo termina bien (un mensaje de contacto, un
// pedido, una reserva, una postulación), este módulo despacha un POST JSON a los endpoints que el
// negocio haya cargado — un canal de Discord o Slack, un Zap de Zapier, un escenario de Make, o el
// sistema propio del cliente. Todo gratis: son webhooks entrantes de servicios con capa gratuita,
// sin API keys nuestras.
//
// Cómo funciona sin tocar los otros módulos: es un MIDDLEWARE global (contrato `middlewares`) que
// se monta antes de los estáticos y se engancha al final de la respuesta. Si el pedido fue
// POST/PUT/PATCH/DELETE contra /api y terminó en 2xx, arma el evento y lo despacha. Ningún módulo
// existente necesita enterarse.
//
// Tres cosas que lo hacen serio y no un fetch suelto:
//   1. FIRMA HMAC-SHA256 del cuerpo con el secreto del endpoint (cabecera X-WF-Signature), así el
//      receptor puede verificar que el aviso salió de este sitio y no de un tercero.
//   2. REINTENTOS con espera creciente y registro de cada intento (código, milisegundos, error).
//   3. Bloqueo de destinos internos (localhost, 127.x, 10.x, 192.168.x, 172.16-31.x, 169.254.x):
//      un panel que deja poner cualquier URL es un SSRF esperando pasar.
// El despacho es "disparar y seguir": un endpoint caído nunca demora ni rompe el pedido original.
// Panel /webhooks.html con KPIs animados (Anime.js), alta/baja de endpoints, botón de prueba y el
// registro de entregas.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'webhooks', type: 'functional', name: 'Integraciones (webhooks)',
  description: 'Avisa a otros sistemas cuando pasa algo en el sitio: cada escritura exitosa contra /api dispara un POST JSON firmado con HMAC-SHA256 a los endpoints cargados (Discord, Slack, Zapier, Make o un sistema propio), con reintentos, registro de entregas y bloqueo de destinos internos. Un middleware global lo hace sin tocar los demás módulos. Panel /webhooks.html con KPIs animados (Anime.js), prueba de endpoint y log.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/webhooks', file: 'routes/webhooks.js' }],
  middlewares: [{ file: 'src/middleware/webhooks.js' }],
  collections: ['webhooks', 'webhookdeliveries'],
  nav: () => [{ label: 'Integraciones', href: '/webhooks.html', id: 'nav-webhooks' }],
  head: () => `  <style>
    .wh-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:22px 0}
    .wh-kpis .card{text-align:center}
    .wh-kpis strong{display:block;font-size:1.7rem;font-variant-numeric:tabular-nums}
    .wh-ep{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}
    .wh-ep .wh-datos{flex:1;min-width:220px;overflow-wrap:anywhere}
    .wh-ep code{font-size:.82rem}
    .wh-led{width:10px;height:10px;border-radius:999px;background:#2e9e5b;flex:none;margin-top:7px}
    .wh-ep.off .wh-led{background:var(--muted)}
    .wh-tag{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .wh-tag.ok{background:#2e9e5b20;color:#1c6b3c}
    .wh-tag.err{background:#c0392b20;color:#c0392b}
    .wh-secreto{font-family:ui-monospace,monospace;font-size:.78rem;color:var(--muted);overflow-wrap:anywhere}
  </style>`,
  files: () => ({
    // El middleware es la pieza central: observa el final de cada respuesta y despacha.
    'src/middleware/webhooks.js': `/**
 * Despachador de webhooks. Middleware global montado antes de express.static (ver src/app.js).
 * No modifica ni frena nada: se engancha al evento 'finish' de la respuesta y, si el pedido
 * fue una escritura exitosa contra /api, manda el aviso a los endpoints suscriptos.
 * El despacho ocurre DESPUÉS de que el visitante ya recibió su respuesta, así una integración
 * lenta o caída jamás se le nota a quien usa el sitio.
 */
const crypto = require('crypto');
const db = require('../db');

// Rutas que nunca disparan avisos: el propio panel (evitaría bucles) y el login (datos sensibles)
const EXCLUIDAS = ['/api/webhooks', '/api/auth'];

// Destinos internos: bloquearlos evita que el panel se convierta en un SSRF hacia la red privada
const PRIVADAS = [
  /^localhost$/i, /^127\\./, /^0\\.0\\.0\\.0$/, /^10\\./, /^192\\.168\\./,
  /^172\\.(1[6-9]|2\\d|3[01])\\./, /^169\\.254\\./, /^\\[?::1\\]?$/, /\\.local$/i, /\\.internal$/i,
];

/** ¿La URL es un destino público válido? Se usa al guardar Y antes de cada despacho. */
function destinoValido(url) {
  let u;
  try { u = new URL(String(url)); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  return !PRIVADAS.some(re => re.test(u.hostname));
}

// Cache de endpoints: sin esto habría una lectura de base por cada pedido del sitio
let cache = null;
let cacheAt = 0;
const TTL_MS = 15000;

async function endpoints() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  cache = (await db.all('webhooks')).filter(w => w.active !== false);
  cacheAt = Date.now();
  return cache;
}

/** Nombre de evento legible a partir del método y la ruta: 'contact.creado', 'orders.borrado'. */
function nombreEvento(method, path) {
  const recurso = String(path).replace(/^\\/api\\//, '').split('/')[0] || 'api';
  const verbo = { POST: 'creado', PUT: 'actualizado', PATCH: 'actualizado', DELETE: 'borrado' }[method] || 'cambiado';
  return recurso + '.' + verbo;
}

/** Copia del cuerpo sin campos sensibles: una contraseña jamás sale del servidor. */
function saneado(body, nivel = 0) {
  if (!body || typeof body !== 'object' || Buffer.isBuffer(body) || nivel > 3) return {};
  const out = Array.isArray(body) ? [] : {};
  for (const [k, v] of Object.entries(body)) {
    if (/pass|clave|secret|token|tarjeta|card|cvv/i.test(k)) { out[k] = '[oculto]'; continue; }
    if (v && typeof v === 'object') out[k] = saneado(v, nivel + 1);
    else out[k] = v;
  }
  return out;
}

const firmar = (secreto, cuerpo) => crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex');

/** Registro de entregas con tope: es una ayuda para diagnosticar, no un archivo histórico. */
async function registrar(fila) {
  await db.insert('webhookdeliveries', fila);
  const rows = await db.all('webhookdeliveries');
  if (rows.length > 400) {
    for (const viejo of rows.slice(0, rows.length - 300)) await db.remove('webhookdeliveries', viejo.id);
  }
}

/**
 * Envía un evento a UN endpoint, con reintentos y espera creciente (1s, 3s).
 * Devuelve el resultado del último intento; siempre registra lo que pasó.
 */
async function enviar(wh, evento) {
  const cuerpo = JSON.stringify(evento);
  const firma = firmar(wh.secret || '', cuerpo);
  const intentos = 3;
  let ultimo = { ok: false, status: 0, error: 'sin intentos' };
  for (let i = 1; i <= intentos; i++) {
    const t0 = Date.now();
    try {
      if (!destinoValido(wh.url)) throw new Error('Destino no permitido');
      const ctrl = new AbortController();
      const corte = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WebForge-Webhooks/1.0',
          'X-WF-Event': evento.evento,
          'X-WF-Delivery': evento.id,
          'X-WF-Signature': 'sha256=' + firma,
        },
        body: cuerpo,
        signal: ctrl.signal,
      });
      clearTimeout(corte);
      ultimo = { ok: res.ok, status: res.status, ms: Date.now() - t0, intento: i, error: res.ok ? '' : 'HTTP ' + res.status };
      if (res.ok) break;
    } catch (err) {
      ultimo = { ok: false, status: 0, ms: Date.now() - t0, intento: i, error: String(err.message || err).slice(0, 160) };
    }
    // Espera creciente antes de reintentar (no en el último intento)
    if (i < intentos) await new Promise(r => setTimeout(r, i * 2000 - 1000));
  }
  await registrar({
    webhookId: wh.id, url: wh.url, evento: evento.evento,
    ok: ultimo.ok, status: ultimo.status, ms: ultimo.ms || 0,
    intentos: ultimo.intento || intentos, error: ultimo.error || '',
  });
  return ultimo;
}

/** Despacha un evento a todos los endpoints suscriptos a esa ruta. No espera a que terminen. */
async function despachar(evento, ruta) {
  const todos = await endpoints();
  const suscriptos = todos.filter(w => !w.filtro || String(ruta).startsWith(w.filtro));
  for (const wh of suscriptos) enviar(wh, evento).catch(() => {});
}

function webhooks(req, res, next) {
  const escribe = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!escribe || !req.path.startsWith('/api')) return next();
  if (EXCLUIDAS.some(r => req.path === r || req.path.startsWith(r + '/'))) return next();
  const ruta = req.path;
  const cuerpo = saneado(req.body);
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const evento = {
      id: crypto.randomBytes(8).toString('hex'),
      evento: nombreEvento(req.method, ruta),
      metodo: req.method,
      ruta,
      estado: res.statusCode,
      fecha: new Date().toISOString(),
      datos: cuerpo,
    };
    despachar(evento, ruta).catch(() => {});
  });
  next();
}

module.exports = webhooks;
// El router del panel comparte el mismo cache, la misma validación de destino y el mismo envío
module.exports.invalidar = () => { cache = null; };
module.exports.destinoValido = destinoValido;
module.exports.enviar = enviar;
`,
    'routes/webhooks.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const despachador = require('../src/middleware/webhooks');
const { requireAdmin } = require('../src/middleware/auth');

// GET /api/webhooks — endpoints cargados + KPIs de entregas (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  const eps = await db.all('webhooks');
  const entregas = await db.all('webhookdeliveries');
  res.json({
    endpoints: eps.slice().reverse(),
    kpis: {
      activos: eps.filter(w => w.active !== false).length,
      entregas: entregas.length,
      ok: entregas.filter(d => d.ok).length,
      fallidas: entregas.filter(d => !d.ok).length,
    },
  });
});

// GET /api/webhooks/entregas — últimas entregas, de la más nueva a la más vieja (solo admin)
router.get('/entregas', requireAdmin, async (req, res) => {
  res.json((await db.all('webhookdeliveries')).slice().reverse().slice(0, 200));
});

// POST /api/webhooks — da de alta un endpoint (solo admin). El secreto se genera acá.
router.post('/', requireAdmin, async (req, res) => {
  const url = String(req.body.url || '').trim();
  if (!despachador.destinoValido(url)) {
    return res.status(422).json({ error: 'La URL tiene que ser http(s) y apuntar a un host público (no localhost ni redes privadas)' });
  }
  const nombre = String(req.body.nombre || '').trim().slice(0, 60) || new URL(url).hostname;
  const filtro = String(req.body.filtro || '').trim().slice(0, 60);
  if (filtro && !filtro.startsWith('/api')) return res.status(422).json({ error: 'El filtro de ruta tiene que empezar con /api' });
  if ((await db.all('webhooks')).length >= 25) return res.status(422).json({ error: 'Llegaste al máximo de 25 endpoints' });
  const wh = await db.insert('webhooks', {
    nombre, url, filtro, active: true,
    secret: crypto.randomBytes(16).toString('hex'),
  });
  despachador.invalidar();
  res.status(201).json(wh);
});

// PATCH /api/webhooks/:id — enciende o apaga un endpoint (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const wh = await db.get('webhooks', req.params.id);
  if (!wh) return res.status(404).json({ error: 'Endpoint no encontrado' });
  const upd = await db.update('webhooks', wh.id, { active: !!req.body.active });
  despachador.invalidar();
  res.json(upd);
});

// DELETE /api/webhooks/:id — borra un endpoint (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const wh = await db.get('webhooks', req.params.id);
  if (!wh) return res.status(404).json({ error: 'Endpoint no encontrado' });
  await db.remove('webhooks', wh.id);
  despachador.invalidar();
  res.json({ ok: true });
});

// POST /api/webhooks/:id/probar — manda un evento de prueba y devuelve el resultado real
// (solo admin). A diferencia del despacho normal, acá SÍ se espera la respuesta: el admin
// necesita ver en el acto si su URL contesta.
router.post('/:id/probar', requireAdmin, async (req, res) => {
  const wh = await db.get('webhooks', req.params.id);
  if (!wh) return res.status(404).json({ error: 'Endpoint no encontrado' });
  const resultado = await despachador.enviar(wh, {
    id: crypto.randomBytes(8).toString('hex'),
    evento: 'prueba.manual',
    metodo: 'POST',
    ruta: '/api/webhooks/probar',
    estado: 200,
    fecha: new Date().toISOString(),
    datos: { mensaje: 'Prueba de integración enviada desde el panel', content: 'Prueba de integración enviada desde el panel' },
  });
  res.json(resultado);
});

// DELETE /api/webhooks/entregas/todas — vacía el registro de entregas (solo admin)
router.delete('/entregas/todas', requireAdmin, async (req, res) => {
  for (const d of await db.all('webhookdeliveries')) await db.remove('webhookdeliveries', d.id);
  res.json({ ok: true });
});

module.exports = router;
`,
  }),
  pages: () => ({
    webhooks: {
      title: 'Integraciones',
      html: `  <section>
    <div class="container" style="max-width:900px">
      <h2>Integraciones (webhooks)</h2>
      <p class="section-sub">Avisale a otros sistemas cuando pasa algo en el sitio. Cada vez que se guarda algo (un mensaje, un pedido, una reserva…) mandamos un aviso JSON firmado a las direcciones que cargues acá. Sirve para un canal de Discord o Slack, un Zap de Zapier, un escenario de Make o tu propio sistema. Solo visible para administradores.</p>
      <div class="wh-kpis" id="wh-kpis"></div>
      <form class="card" id="wh-form">
        <h3 style="margin-top:0">Nueva integración</h3>
        <label for="wh-url">URL de destino</label>
        <input id="wh-url" name="url" type="url" placeholder="https://hooks.slack.com/services/..." required>
        <div class="grid cols-2" style="gap:14px">
          <div>
            <label for="wh-nombre">Nombre (opcional)</label>
            <input id="wh-nombre" name="nombre" maxlength="60" placeholder="Canal de ventas">
          </div>
          <div>
            <label for="wh-filtro">Solo esta ruta (opcional)</label>
            <input id="wh-filtro" name="filtro" maxlength="60" placeholder="/api/contact">
          </div>
        </div>
        <button class="btn" type="submit" style="margin-top:16px">Agregar integración</button>
      </form>
      <h3 style="margin-top:32px">Integraciones activas</h3>
      <div id="wh-lista"><p class="muted">Cargando…</p></div>
      <h3 style="margin-top:32px">Últimas entregas</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn ghost" type="button" id="wh-csv">Descargar CSV</button>
        <button class="btn ghost" type="button" id="wh-vaciar">Vaciar registro</button>
      </div>
      <div id="wh-log"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo integraciones (webhooks): panel solo-admin en /webhooks.html — alta/baja de endpoints,
   botón de prueba con el resultado real y registro de entregas. KPIs con count-up de Anime.js y
   entrada escalonada de las tarjetas, siempre con red de seguridad por si la pestaña está oculta. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  // Oculta el link admin de la navbar para quien no es admin (en TODAS las páginas)
  var navWh = document.getElementById('nav-webhooks');
  if (navWh && (!me || me.role !== 'admin') && !window.__PREVIEW__) navWh.style.display = 'none';

  var form = document.getElementById('wh-form');
  if (!form) return;
  var kpis = document.getElementById('wh-kpis');
  var lista = document.getElementById('wh-lista');
  var logBox = document.getElementById('wh-log');
  var entregas = [];

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = Number(hasta).toLocaleString('es-AR'); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 620, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR'); } });
    // Red de seguridad: Anime.js pausa su loop con la pestaña oculta
    setTimeout(function () { el.textContent = Number(hasta).toLocaleString('es-AR'); }, 820);
  }

  function entrada(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [12, 0], duration: 420, delay: anime.stagger ? anime.stagger(60) : 0, ease: 'outCubic' });
    setTimeout(function () {
      Array.prototype.forEach.call(nodos, function (n) { n.style.opacity = 1; n.style.transform = 'none'; });
    }, 420 + 60 * nodos.length + 120);
  }

  function pintarKpis(k) {
    kpis.innerHTML = '<div class="card"><strong id="wh-k-act">0</strong><span class="muted">integraciones activas</span></div>' +
      '<div class="card"><strong id="wh-k-ent">0</strong><span class="muted">avisos enviados</span></div>' +
      '<div class="card"><strong id="wh-k-ok">0</strong><span class="muted">entregados</span></div>' +
      '<div class="card"><strong id="wh-k-err">0</strong><span class="muted">con error</span></div>';
    contar(document.getElementById('wh-k-act'), k.activos || 0);
    contar(document.getElementById('wh-k-ent'), k.entregas || 0);
    contar(document.getElementById('wh-k-ok'), k.ok || 0);
    contar(document.getElementById('wh-k-err'), k.fallidas || 0);
  }

  function pintarLista(eps) {
    if (!eps.length) { lista.innerHTML = '<p class="muted">Todavía no cargaste ninguna integración.</p>'; return; }
    lista.innerHTML = eps.map(function (w) {
      return '<div class="card wh-ep' + (w.active === false ? ' off' : '') + '" data-id="' + App.esc(w.id) + '" style="margin-bottom:12px">' +
        '<span class="wh-led" aria-hidden="true"></span>' +
        '<div class="wh-datos"><strong>' + App.esc(w.nombre || '(sin nombre)') + '</strong>' +
        '<div class="muted" style="font-size:.85rem"><code>' + App.esc(w.url) + '</code></div>' +
        '<div class="muted" style="font-size:.85rem">' + (w.filtro ? 'Solo <code>' + App.esc(w.filtro) + '</code>' : 'Todas las escrituras del sitio') + '</div>' +
        '<div class="wh-secreto">Secreto de firma: ' + App.esc(w.secret || '') + '</div></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn ghost" type="button" data-probar="' + App.esc(w.id) + '">Probar</button>' +
        '<button class="btn ghost" type="button" data-toggle="' + App.esc(w.id) + '">' + (w.active === false ? 'Activar' : 'Pausar') + '</button>' +
        '<button class="btn ghost" type="button" data-borrar="' + App.esc(w.id) + '">Borrar</button>' +
        '</div></div>';
    }).join('');
    lista.querySelectorAll('[data-probar]').forEach(function (b) { b.addEventListener('click', function () { probar(b.getAttribute('data-probar'), b); }); });
    lista.querySelectorAll('[data-toggle]').forEach(function (b) { b.addEventListener('click', function () { alternar(b.getAttribute('data-toggle'), eps); }); });
    lista.querySelectorAll('[data-borrar]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-borrar')); }); });
    entrada(lista.querySelectorAll('.wh-ep'));
  }

  function pintarLog() {
    logBox.innerHTML = App.table(entregas, [
      { label: 'Cuándo', render: function (d) { return new Date(d.createdAt).toLocaleString('es-AR'); } },
      { label: 'Evento', render: function (d) { return '<code>' + App.esc(d.evento || '') + '</code>'; } },
      { label: 'Destino', render: function (d) { return '<span class="muted" style="overflow-wrap:anywhere">' + App.esc(String(d.url || '').slice(0, 60)) + '</span>'; } },
      { label: 'Resultado', render: function (d) {
        return d.ok
          ? '<span class="wh-tag ok">${phIcon('check', { size: 12 })} ' + (d.status || 200) + '</span>'
          : '<span class="wh-tag err">${phIcon('x', { size: 12 })} ' + App.esc(d.error || 'error') + '</span>';
      } },
      { label: 'Demora', render: function (d) { return (d.ms || 0) + ' ms'; } },
      { label: 'Intentos', key: 'intentos' },
    ]);
  }

  async function probar(id, boton) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se manda un aviso de prueba real'); return; }
    var previo = boton.textContent;
    boton.textContent = 'Probando…';
    boton.disabled = true;
    try {
      var r = await App.api('/api/webhooks/' + id + '/probar', { method: 'POST' });
      App.toast(r.ok ? 'Aviso entregado (HTTP ' + r.status + ', ' + r.ms + ' ms)' : 'No se pudo entregar: ' + (r.error || 'error'));
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    finally { boton.textContent = previo; boton.disabled = false; }
  }

  async function alternar(id, eps) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se pausa o activa la integración'); return; }
    var w = eps.filter(function (x) { return x.id === id; })[0];
    try {
      await App.api('/api/webhooks/' + id, { method: 'PATCH', body: { active: w ? w.active === false : true } });
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function borrar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se borra la integración'); return; }
    if (!confirm('¿Borrar esta integración? Deja de recibir avisos.')) return;
    try {
      await App.api('/api/webhooks/' + id, { method: 'DELETE' });
      App.toast('Integración borrada');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se agrega la integración'); return; }
    try {
      await App.api('/api/webhooks', { method: 'POST', body: {
        url: form.querySelector('[name="url"]').value,
        nombre: form.querySelector('[name="nombre"]').value,
        filtro: form.querySelector('[name="filtro"]').value,
      } });
      form.reset();
      App.toast('Integración agregada');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  document.getElementById('wh-vaciar').addEventListener('click', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: se vaciaría el registro'); return; }
    if (!confirm('¿Vaciar el registro de entregas?')) return;
    try {
      await App.api('/api/webhooks/entregas/todas', { method: 'DELETE' });
      entregas = []; pintarLog(); cargar();
      App.toast('Registro vaciado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  document.getElementById('wh-csv').addEventListener('click', function () {
    var claves = [['fecha', 'evento', 'destino', 'ok', 'estado', 'ms', 'intentos', 'error']];
    var filas = claves.concat(entregas.map(function (d) {
      return [d.createdAt, d.evento, d.url, d.ok ? 'sí' : 'no', d.status, d.ms, d.intentos, d.error];
    }));
    var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\\r\\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'webhooks-entregas-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function cargar() {
    App.api('/api/webhooks').then(function (r) { pintarKpis(r.kpis); pintarLista(r.endpoints); })
      .catch(function (err) { kpis.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    App.api('/api/webhooks/entregas').then(function (rows) { entregas = rows; pintarLog(); }).catch(function () {});
  }

  if (window.__PREVIEW__) {
    pintarKpis({ activos: 2, entregas: 41, ok: 39, fallidas: 2 });
    pintarLista([
      { id: 'd1', nombre: 'Canal de ventas (Slack)', url: 'https://hooks.slack.com/services/T000/B000/XXXX', filtro: '', active: true, secret: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6' },
      { id: 'd2', nombre: 'Zapier — contacto', url: 'https://hooks.zapier.com/hooks/catch/123456/abcdef/', filtro: '/api/contact', active: false, secret: 'f6e5d4c3b2a10987f6e5d4c3b2a10987' },
    ]);
    entregas = [
      { id: 'e1', createdAt: new Date().toISOString(), evento: 'contact.creado', url: 'https://hooks.slack.com/services/…', ok: true, status: 200, ms: 214, intentos: 1, error: '' },
      { id: 'e2', createdAt: new Date(Date.now() - 3600000).toISOString(), evento: 'orders.creado', url: 'https://hooks.zapier.com/…', ok: false, status: 0, ms: 8003, intentos: 3, error: 'The operation was aborted' },
    ];
    pintarLog();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargar();
  }
})();`,
  readmeNotes: () => [
    `**Integraciones (webhooks)**: las administrás en \`/webhooks.html\` (solo admin). Cada escritura exitosa (\`POST/PUT/PATCH/DELETE\` con respuesta 2xx) contra \`/api\` dispara un **POST JSON** a los endpoints cargados. Lo hace un **middleware global** (\`src/middleware/webhooks.js\`) enganchado al final de la respuesta: el aviso sale **después** de que el visitante ya recibió la suya, así una integración lenta o caída nunca se nota en el sitio. Cada aviso viaja **firmado**: cabecera \`X-WF-Signature: sha256=<hmac>\` calculada sobre el cuerpo con el secreto que ves en el panel — verificala del otro lado antes de confiar en el contenido. Hay **3 intentos** con espera creciente y cada uno queda registrado (código, milisegundos, error). Se **bloquean destinos internos** (localhost, 10.x, 192.168.x, 172.16-31.x, 169.254.x, .local): sin eso, un panel que acepta cualquier URL es una puerta a la red privada. Se excluyen \`/api/webhooks\` (evita bucles) y \`/api/auth\` (datos sensibles), y los campos tipo contraseña/token salen como \`[oculto]\`. Funciona gratis con Discord, Slack, Zapier o Make; en un hosting serverless como Vercel el despacho corre dentro de la misma invocación, así que si algún endpoint es muy lento conviene bajar el timeout de 8 s en \`src/middleware/webhooks.js\`.`,
  ],
};
