// Escudo anti-spam y límite de pedidos con backend real: un MIDDLEWARE de Express (montado antes
// de los estáticos, contrato `middlewares`) que protege TODOS los envíos públicos del sitio a la
// vez — formularios de contacto, reservas, comentarios, altas, login — sin tocar una sola línea de
// los otros módulos. Hace tres cosas que hoy cada módulo se defendía solo (o no se defendía): corta
// las ráfagas por IP con una ventana deslizante (429 + Retry-After, el mismo mecanismo que usan los
// servicios serios), rechaza los envíos con palabras de spam o con demasiados enlaces (422) y
// bloquea a mano las IPs que ya molestaron (403). Los administradores logueados quedan exentos: un
// panel legítimamente hace ráfagas de altas. Todo lo frenado queda registrado con IP, ruta y motivo,
// y el panel /escudo-admin.html muestra los KPIs y deja ajustar el límite sin regenerar el sitio.
// Animado con Anime.js (count-up de KPIs, pulso del escudo) + red de seguridad. Sin dependencias ni
// servicios pagos: no es reCAPTCHA, no le pide nada a terceros y no molesta al visitante honesto.

// Palabras que se bloquean por default: el spam clásico de formularios públicos. La lista es
// editable desde el panel, así que cada negocio la adapta a lo suyo (una farmacia querrá sacar
// "farmacia" de la lista y una inmobiliaria agregar sus propias molestias).
const PALABRAS = ['casino', 'viagra', 'porn', 'crypto pump', 'seo services', 'backlinks', 'bitcoin doubler'];

module.exports = {
  id: 'escudo', type: 'functional', name: 'Escudo anti-spam',
  description: 'Protección real para todos los envíos públicos del sitio: un middleware de Express corta las ráfagas por IP con ventana deslizante (429 + Retry-After), rechaza los envíos con palabras de spam o exceso de enlaces (422) y bloquea IPs a mano (403). Los administradores quedan exentos. Cada bloqueo queda registrado con IP, ruta y motivo. Con auth activo, panel /escudo-admin.html con KPIs, límites editables y lista de IPs. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/escudo', file: 'routes/escudo.js' }],
  middlewares: [{ file: 'src/middleware/escudo.js' }],
  collections: ['shield', 'shieldlog'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Escudo (admin)', href: '/escudo-admin.html', id: 'nav-escudo-admin' }] : [],
  head: () => `  <style>
    .esc-sw{display:flex;align-items:center;gap:16px;padding:18px 20px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
    .esc-sw .esc-led{width:14px;height:14px;border-radius:999px;background:#2e9e5b;flex:none}
    .esc-sw.off .esc-led{background:#c0392b}
    .esc-sw strong{display:block}
    .esc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:22px 0}
    .esc-kpis .card{text-align:center}
    .esc-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .esc-tag{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .esc-tag.limite{background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent)}
    .esc-tag.palabra{background:#f39c1220;color:#a06000}
    .esc-tag.ip{background:#c0392b20;color:#c0392b}
    .esc-ips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
    .esc-ip{display:inline-flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:5px 8px 5px 14px;font-size:.85rem}
    .esc-ip button{background:none;border:0;color:#c0392b;cursor:pointer;font:inherit;font-weight:700;padding:0 4px}
  </style>`,
  files: (cfg) => ({
    // El middleware es la pieza central: corre ANTES de los estáticos y de todas las rutas de API,
    // así que un pedido frenado nunca llega al módulo que iba a atenderlo.
    'src/middleware/escudo.js': `/**
 * Escudo anti-spam. Middleware global montado antes de express.static (ver src/app.js).
 * Solo actúa sobre pedidos que ESCRIBEN (POST/PUT/PATCH/DELETE) contra /api: la navegación
 * y las lecturas nunca se frenan. La ventana deslizante vive en memoria (rapidísima, cero
 * escrituras); la configuración y el registro de bloqueos viven en la base.
 */
const db = require('../db');
${cfg.moduleIds.includes('auth') ? `const { verify } = require('../token');
` : ''}
// Rutas que NUNCA se frenan: sin ellas un admin podría quedar afuera de su propio panel
const LIBRES = ['/api/escudo'];

// Ventana deslizante en memoria: ip -> [timestamps]. Se limpia sola.
const golpes = new Map();
let ultimaLimpieza = Date.now();

// Config cacheada: sin esto habría una lectura de base por pedido (y con Supabase, un HTTP)
let cache = null;
let cacheAt = 0;
const TTL_MS = 15000;

const DEFAULTS = {
  active: true,
  maxPorVentana: 120,
  ventanaMin: 10,
  maxEnlaces: 3,
  palabras: ${JSON.stringify(PALABRAS)},
  ips: [],
  frenados: 0,
  porLimite: 0,
  porPalabra: 0,
  porIp: 0,
};

// Ficha única de configuración (se crea sola la primera vez, con los valores por default)
async function ficha() {
  const rows = await db.all('shield');
  if (rows.length) return { ...DEFAULTS, ...rows[0] };
  return { ...DEFAULTS, ...(await db.insert('shield', { ...DEFAULTS })) };
}

async function config() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  cache = await ficha();
  cacheAt = Date.now();
  return cache;
}

// IP real del visitante: detrás de Vercel/Nginx viene en x-forwarded-for (el primero de la lista)
function ipDe(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || (req.socket && req.socket.remoteAddress) || 'desconocida';
  return ip.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
}

// Texto plegado: sin acentos y en minúscula, para que "cásino" no se escape del filtro
const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');

// Junta el texto de un cuerpo JSON (hasta 2 niveles) salteando las contraseñas: nunca se
// inspecciona ni se registra lo que el visitante escribió en un campo de clave.
function textoDe(body, nivel = 0) {
  if (!body || typeof body !== 'object' || Buffer.isBuffer(body) || nivel > 2) return '';
  let out = '';
  for (const [k, v] of Object.entries(body)) {
    if (/pass|clave|token|secret/i.test(k)) continue;
    if (typeof v === 'string') out += ' ' + v;
    else if (v && typeof v === 'object') out += textoDe(v, nivel + 1);
  }
  return out;
}

// Registro de lo frenado, con tope: el log es una ayuda para el negocio, no un archivo histórico
async function registrar(tipo, ip, path, detalle) {
  await db.insert('shieldlog', { tipo, ip, path, detalle: String(detalle || '').slice(0, 160) });
  const rows = await db.all('shieldlog');
  if (rows.length > 400) {
    for (const viejo of rows.slice(0, rows.length - 300)) await db.remove('shieldlog', viejo.id);
  }
}

// Suma uno al contador correspondiente y al total (y refresca el cache para que el panel lo vea)
async function contar(f, campo) {
  const patch = { frenados: (f.frenados || 0) + 1, [campo]: (f[campo] || 0) + 1 };
  await db.update('shield', f.id, patch);
  cache = { ...f, ...patch };
  cacheAt = Date.now();
}

async function escudo(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (!req.path.startsWith('/api')) return next();
  if (LIBRES.some(r => req.path === r || req.path.startsWith(r + '/'))) return next();

  const f = await config();
  if (!f.active) return next();
${cfg.moduleIds.includes('auth') ? `
  // Los administradores no se limitan: un panel hace ráfagas legítimas (altas masivas, importaciones)
  const payload = verify(String(req.headers.authorization || '').replace(/^Bearer /, ''));
  if (payload && payload.role === 'admin') return next();
` : ''}
  const ip = ipDe(req);

  // 1) IP bloqueada a mano por el negocio
  if ((f.ips || []).includes(ip)) {
    await contar(f, 'porIp');
    await registrar('ip', ip, req.path, 'IP en la lista de bloqueo');
    return res.status(403).json({ error: 'Tu conexión está bloqueada. Si es un error, contactanos por otro medio.' });
  }

  // 2) Ráfaga: ventana deslizante en memoria
  const ahora = Date.now();
  const ventana = Math.max(1, Number(f.ventanaMin) || 10) * 60000;
  if (ahora - ultimaLimpieza > 60000) {
    // Limpieza perezosa: saca del mapa las IPs que ya no tienen golpes vigentes
    for (const [k, v] of golpes) {
      const vivos = v.filter(t => ahora - t < ventana);
      if (vivos.length) golpes.set(k, vivos); else golpes.delete(k);
    }
    ultimaLimpieza = ahora;
  }
  const previos = (golpes.get(ip) || []).filter(t => ahora - t < ventana);
  previos.push(ahora);
  golpes.set(ip, previos);
  if (previos.length > (Number(f.maxPorVentana) || 120)) {
    await contar(f, 'porLimite');
    await registrar('limite', ip, req.path, previos.length + ' envíos en ' + f.ventanaMin + ' min');
    res.setHeader('Retry-After', String(Math.ceil(ventana / 1000)));
    return res.status(429).json({ error: 'Demasiados envíos seguidos. Esperá unos minutos y volvé a intentar.' });
  }

  // 3) Contenido: palabras bloqueadas y exceso de enlaces (el spam de formularios siempre pega links)
  const texto = fold(textoDe(req.body));
  if (texto.trim()) {
    const palabra = (f.palabras || []).map(fold).filter(Boolean).find(p => texto.includes(p));
    if (palabra) {
      await contar(f, 'porPalabra');
      await registrar('palabra', ip, req.path, 'Palabra bloqueada: ' + palabra);
      return res.status(422).json({ error: 'Tu mensaje contiene contenido no permitido.' });
    }
    const enlaces = (texto.match(/https?:\\/\\//g) || []).length;
    if (enlaces > (Number(f.maxEnlaces) || 3)) {
      await contar(f, 'porPalabra');
      await registrar('palabra', ip, req.path, enlaces + ' enlaces en un mismo envío');
      return res.status(422).json({ error: 'Tu mensaje tiene demasiados enlaces.' });
    }
  }

  next();
}

module.exports = escudo;
// El router del panel comparte la misma ficha e invalida el cache al guardar cambios,
// así un ajuste del límite se aplica en el acto y no cuando vence el TTL.
module.exports.ficha = ficha;
module.exports.invalidar = () => { cache = null; };
module.exports.DEFAULTS = DEFAULTS;
`,
    'routes/escudo.js': `const router = require('express').Router();
const db = require('../src/db');
const escudo = require('../src/middleware/escudo');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Formato de IPv4 o IPv6 sencillo: alcanza para evitar que se cargue cualquier cosa en la lista
const IP_OK = /^[0-9a-fA-F.:]{3,45}$/;
${cfg.moduleIds.includes('auth') ? `
// GET /api/escudo — configuración + contadores (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  res.json(await escudo.ficha());
});

// GET /api/escudo/log — últimos bloqueos, del más nuevo al más viejo (solo admin)
router.get('/log', requireAdmin, async (req, res) => {
  const rows = (await db.all('shieldlog')).slice().reverse();
  res.json(rows.slice(0, 200));
});

// PUT /api/escudo — ajusta límites, palabras y encendido (solo admin)
router.put('/', requireAdmin, async (req, res) => {
  const f = await escudo.ficha();
  const patch = {};
  if (req.body.active !== undefined) patch.active = !!req.body.active;
  if (req.body.maxPorVentana !== undefined) {
    const n = Number(req.body.maxPorVentana);
    if (!isFinite(n) || n < 3 || n > 5000) return res.status(422).json({ error: 'El máximo de envíos va entre 3 y 5000' });
    patch.maxPorVentana = Math.round(n);
  }
  if (req.body.ventanaMin !== undefined) {
    const n = Number(req.body.ventanaMin);
    if (!isFinite(n) || n < 1 || n > 1440) return res.status(422).json({ error: 'La ventana va entre 1 y 1440 minutos' });
    patch.ventanaMin = Math.round(n);
  }
  if (req.body.maxEnlaces !== undefined) {
    const n = Number(req.body.maxEnlaces);
    if (!isFinite(n) || n < 0 || n > 50) return res.status(422).json({ error: 'El máximo de enlaces va entre 0 y 50' });
    patch.maxEnlaces = Math.round(n);
  }
  if (req.body.palabras !== undefined) {
    if (!Array.isArray(req.body.palabras)) return res.status(422).json({ error: 'Las palabras bloqueadas van como lista' });
    patch.palabras = req.body.palabras.map(p => String(p).trim().toLowerCase()).filter(Boolean).slice(0, 100);
  }
  const upd = await db.update('shield', f.id, patch);
  escudo.invalidar(); // el cambio se aplica en el acto, no cuando vence el cache
  res.json({ ...escudo.DEFAULTS, ...upd });
});

// POST /api/escudo/ips — bloquea una IP a mano (solo admin)
router.post('/ips', requireAdmin, async (req, res) => {
  const ip = String(req.body.ip || '').trim();
  if (!IP_OK.test(ip)) return res.status(422).json({ error: 'Dirección IP inválida' });
  const f = await escudo.ficha();
  const ips = [...new Set([...(f.ips || []), ip])].slice(0, 500);
  const upd = await db.update('shield', f.id, { ips });
  escudo.invalidar();
  res.status(201).json({ ...escudo.DEFAULTS, ...upd });
});

// DELETE /api/escudo/ips — saca una IP de la lista (va por body: una IP no entra limpia en la URL)
router.delete('/ips', requireAdmin, async (req, res) => {
  const ip = String(req.body.ip || '').trim();
  const f = await escudo.ficha();
  const upd = await db.update('shield', f.id, { ips: (f.ips || []).filter(x => x !== ip) });
  escudo.invalidar();
  res.json({ ...escudo.DEFAULTS, ...upd });
});

// DELETE /api/escudo/log — vacía el registro de bloqueos y los contadores (solo admin)
router.delete('/log', requireAdmin, async (req, res) => {
  for (const r of await db.all('shieldlog')) await db.remove('shieldlog', r.id);
  const f = await escudo.ficha();
  await db.update('shield', f.id, { frenados: 0, porLimite: 0, porPalabra: 0, porIp: 0 });
  escudo.invalidar();
  res.json({ ok: true });
});
` : `// El panel del escudo requiere el módulo de autenticación: activalo en el Builder para habilitar
// /escudo-admin.html. Sin él, el middleware protege el sitio igual con los valores por default
// (editables a mano en data/shield.json).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'escudo-admin': {
      title: 'Escudo anti-spam',
      html: `  <section>
    <div class="container" style="max-width:860px">
      <h2>Escudo anti-spam</h2>
      <p class="section-sub">Protege de una sola vez todos los formularios y envíos del sitio: corta las ráfagas por IP, rechaza el spam por contenido y bloquea las direcciones que ya molestaron. Vos, como administrador, quedás exento. Solo visible para administradores.</p>
      <div class="esc-sw" id="esc-sw">
        <span class="esc-led" aria-hidden="true"></span>
        <span style="flex:1"><strong id="esc-estado">Cargando…</strong><span class="muted" id="esc-detalle">—</span></span>
        <button class="btn" type="button" id="esc-toggle">—</button>
      </div>
      <div class="esc-kpis" id="esc-kpis"></div>
      <form id="esc-form" class="card">
        <h3 style="margin-top:0">Límites</h3>
        <div class="grid cols-3" style="gap:14px">
          <div><label>Envíos permitidos por IP</label><input name="maxPorVentana" type="number" min="3" max="5000" required></div>
          <div><label>Cada cuántos minutos</label><input name="ventanaMin" type="number" min="1" max="1440" required></div>
          <div><label>Máximo de enlaces por mensaje</label><input name="maxEnlaces" type="number" min="0" max="50" required></div>
        </div>
        <label>Palabras bloqueadas (separadas por coma)</label>
        <textarea name="palabras" rows="2" placeholder="casino, viagra, backlinks"></textarea>
        <button class="btn ghost" type="submit" style="margin-top:16px">Guardar límites</button>
      </form>
      <h3 style="margin-top:32px">IPs bloqueadas</h3>
      <div class="esc-ips" id="esc-ips"></div>
      <form id="esc-ip-form" style="display:flex;gap:8px;flex-wrap:wrap;max-width:420px">
        <input name="ip" placeholder="190.11.22.33" style="flex:1;min-width:180px" required>
        <button class="btn ghost" type="submit">Bloquear IP</button>
      </form>
      <h3 style="margin-top:32px">Últimos bloqueos</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn ghost" type="button" id="esc-csv">Descargar CSV</button>
        <button class="btn ghost" type="button" id="esc-vaciar" style="color:#c0392b;border-color:#c0392b">Vaciar registro</button>
      </div>
      <div id="esc-log"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => cfg.moduleIds.includes('auth') ? `/* Módulo escudo anti-spam: panel solo-admin en /escudo-admin.html (interruptor, límites, IPs
   bloqueadas y registro de lo frenado). Animado con Anime.js (count-up de KPIs, pulso del
   interruptor) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  // Oculta el link admin de la navbar para quien no es admin (en TODAS las páginas)
  var navEsc = document.getElementById('nav-escudo-admin');
  if (navEsc && (!me || me.role !== 'admin') && !window.__PREVIEW__) navEsc.style.display = 'none';

  var sw = document.getElementById('esc-sw');
  if (!sw) return;
  var estado = document.getElementById('esc-estado');
  var detalle = document.getElementById('esc-detalle');
  var toggle = document.getElementById('esc-toggle');
  var kpis = document.getElementById('esc-kpis');
  var formEsc = document.getElementById('esc-form');
  var ipsBox = document.getElementById('esc-ips');
  var formIp = document.getElementById('esc-ip-form');
  var logBox = document.getElementById('esc-log');
  var actual = null;
  var log = [];

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = Number(hasta).toLocaleString('es-AR'); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR'); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = Number(hasta).toLocaleString('es-AR'); }, 800);
  }

  function pintarIps(f) {
    var ips = f.ips || [];
    ipsBox.innerHTML = ips.length
      ? ips.map(function (ip) { return '<span class="esc-ip">' + App.esc(ip) + '<button type="button" data-ip="' + App.esc(ip) + '" title="Desbloquear">&times;</button></span>'; }).join('')
      : '<span class="muted">Ninguna IP bloqueada a mano.</span>';
    ipsBox.querySelectorAll('[data-ip]').forEach(function (b) {
      b.addEventListener('click', function () { desbloquear(b.getAttribute('data-ip')); });
    });
  }

  function pintar(f) {
    actual = f;
    sw.classList.toggle('off', !f.active);
    estado.textContent = f.active ? 'El escudo está activo' : 'El escudo está apagado';
    detalle.textContent = f.active
      ? 'Se frenan las ráfagas, el spam por contenido y las IPs bloqueadas.'
      : 'Todos los envíos pasan sin control. Los formularios quedan expuestos.';
    toggle.textContent = f.active ? 'Apagar escudo' : 'Encender escudo';
    kpis.innerHTML = '<div class="card"><strong id="esc-k-tot">0</strong><span class="muted">envíos frenados</span></div>' +
      '<div class="card"><strong id="esc-k-lim">0</strong><span class="muted">por ráfaga</span></div>' +
      '<div class="card"><strong id="esc-k-pal">0</strong><span class="muted">por contenido</span></div>' +
      '<div class="card"><strong id="esc-k-ip">0</strong><span class="muted">por IP bloqueada</span></div>';
    contar(document.getElementById('esc-k-tot'), f.frenados || 0);
    contar(document.getElementById('esc-k-lim'), f.porLimite || 0);
    contar(document.getElementById('esc-k-pal'), f.porPalabra || 0);
    contar(document.getElementById('esc-k-ip'), f.porIp || 0);
    formEsc.querySelector('[name="maxPorVentana"]').value = f.maxPorVentana;
    formEsc.querySelector('[name="ventanaMin"]').value = f.ventanaMin;
    formEsc.querySelector('[name="maxEnlaces"]').value = f.maxEnlaces;
    formEsc.querySelector('[name="palabras"]').value = (f.palabras || []).join(', ');
    pintarIps(f);
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(sw, { scale: [0.97, 1], opacity: [0.6, 1], duration: 380, ease: 'outCubic' });
      // Red de seguridad: deja el interruptor visible aunque el loop esté pausado
      setTimeout(function () { sw.style.opacity = 1; sw.style.transform = 'none'; }, 700);
    }
  }

  var TIPOS = { limite: 'Ráfaga', palabra: 'Contenido', ip: 'IP bloqueada' };
  function pintarLog() {
    logBox.innerHTML = App.table(log, [
      { label: 'Cuándo', render: function (r) { return new Date(r.createdAt).toLocaleString('es-AR'); } },
      { label: 'Motivo', render: function (r) { return '<span class="esc-tag ' + App.esc(r.tipo) + '">' + (TIPOS[r.tipo] || r.tipo) + '</span>'; } },
      { label: 'IP', key: 'ip' },
      { label: 'Ruta', key: 'path' },
      { label: 'Detalle', key: 'detalle' },
    ]);
  }

  toggle.addEventListener('click', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se enciende o apaga el escudo'); return; }
    if (!actual) return;
    if (actual.active && !confirm('¿Apagar el escudo? Los formularios quedan sin protección anti-spam.')) return;
    try {
      pintar(await App.api('/api/escudo', { method: 'PUT', body: { active: !actual.active } }));
      App.toast(actual.active ? 'Escudo activo' : 'Escudo apagado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  formEsc.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: se guardarían los límites'); return; }
    try {
      pintar(await App.api('/api/escudo', { method: 'PUT', body: {
        maxPorVentana: Number(formEsc.querySelector('[name="maxPorVentana"]').value),
        ventanaMin: Number(formEsc.querySelector('[name="ventanaMin"]').value),
        maxEnlaces: Number(formEsc.querySelector('[name="maxEnlaces"]').value),
        palabras: formEsc.querySelector('[name="palabras"]').value.split(',').map(function (p) { return p.trim(); }).filter(Boolean),
      } }));
      App.toast('Límites guardados');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  formIp.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: se bloquearía la IP'); return; }
    var input = formIp.querySelector('[name="ip"]');
    try {
      pintar(await App.api('/api/escudo/ips', { method: 'POST', body: { ip: input.value } }));
      input.value = '';
      App.toast('IP bloqueada');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  async function desbloquear(ip) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se desbloquearía la IP'); return; }
    try {
      pintar(await App.api('/api/escudo/ips', { method: 'DELETE', body: { ip: ip } }));
      App.toast('IP desbloqueada');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  document.getElementById('esc-vaciar').addEventListener('click', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: se vaciaría el registro'); return; }
    if (!confirm('¿Vaciar el registro de bloqueos y poner los contadores en cero?')) return;
    try {
      await App.api('/api/escudo/log', { method: 'DELETE' });
      log = []; pintarLog();
      cargar();
      App.toast('Registro vaciado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  document.getElementById('esc-csv').addEventListener('click', function () {
    var filas = [['fecha', 'motivo', 'ip', 'ruta', 'detalle']].concat(log.map(function (r) {
      return [r.createdAt, TIPOS[r.tipo] || r.tipo, r.ip, r.path, r.detalle];
    }));
    var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'escudo-bloqueos.csv';
    a.click();
  });

  function cargar() {
    App.api('/api/escudo').then(pintar).catch(function (err) { estado.textContent = err.message; });
    App.api('/api/escudo/log').then(function (rows) { log = rows; pintarLog(); }).catch(function () {});
  }

  if (window.__PREVIEW__) {
    pintar({ active: true, maxPorVentana: 120, ventanaMin: 10, maxEnlaces: 3, palabras: ['casino', 'viagra'], ips: ['190.11.22.33'], frenados: 47, porLimite: 31, porPalabra: 14, porIp: 2 });
    log = [
      { id: 'd1', createdAt: new Date().toISOString(), tipo: 'limite', ip: '190.11.22.33', path: '/api/contact', detalle: '121 envíos en 10 min' },
      { id: 'd2', createdAt: new Date().toISOString(), tipo: 'palabra', ip: '45.9.8.7', path: '/api/comments', detalle: 'Palabra bloqueada: casino' },
    ];
    pintarLog();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargar();
  }
})();` : `/* Módulo escudo anti-spam: sin el módulo de autenticación no hay panel; el middleware protege
   igual todos los envíos con los valores por default (editables en data/shield.json). */`,
  readmeNotes: (cfg) => [
    `**Escudo anti-spam**: lo aplica un **middleware de Express** (\`src/middleware/escudo.js\`) montado antes de los estáticos, así que ningún envío frenado llega al módulo que lo iba a atender. Solo actúa sobre pedidos que escriben (\`POST/PUT/PATCH/DELETE\`) contra \`/api\`: navegar y leer nunca se frena. Tres defensas: **ráfaga por IP** (ventana deslizante, responde **429 + Retry-After**), **contenido** (palabras bloqueadas y exceso de enlaces, responde 422) y **lista de IPs** bloqueadas a mano (403).${cfg.moduleIds.includes('auth') ? ' Los administradores logueados quedan **exentos** (un panel hace ráfagas legítimas). Los límites, las palabras y las IPs se editan en `/escudo-admin.html` y se aplican en el acto.' : ' Sin el módulo **Autenticación** no hay panel: los valores por default viven en `data/shield.json` y se editan a mano.'} La ventana deslizante vive **en memoria** (cero escrituras por pedido): en un hosting serverless como Vercel cada instancia lleva su propia cuenta, así que el límite efectivo se multiplica por la cantidad de instancias activas — para un sitio comercial normal alcanza y sobra; si necesitás un límite exacto y global, hay que llevar la ventana a la base.`,
  ],
};
