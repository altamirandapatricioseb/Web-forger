// Modo mantenimiento con backend real: el negocio "baja" el sitio con un interruptor desde
// /mantenimiento-admin.html y TODAS las páginas públicas pasan a responder 503 con una pantalla de
// mantenimiento propia (título, mensaje y fecha estimada de vuelta editables). No es un cartel
// pegado en el frontend: es un MIDDLEWARE de Express montado antes de los estáticos, así que
// intercepta también el HTML — nadie ve el sitio a medio actualizar ni se saltea el aviso apagando
// JavaScript. El admin sigue navegando gracias a un LINK DE ACCESO con clave secreta (deja una
// cookie de 24 h) y las páginas de login y del propio panel nunca se bloquean, así que es imposible
// quedar afuera del sistema. El 503 lleva Retry-After: Google entiende que es temporal y no
// desindexa el sitio. El servidor cuenta cuántas visitas vieron el cartel. Animado con Anime.js
// (interruptor, count-up de visitas frenadas) + red de seguridad. Distinto de "page404" (página de
// error estática): acá el estado es un dato administrable que cambia el comportamiento del servidor.

module.exports = {
  id: 'mantenimiento', type: 'functional', name: 'Modo mantenimiento',
  description: 'Interruptor real para poner el sitio en mantenimiento: un middleware de Express (montado antes de los estáticos) responde 503 con una pantalla propia — título, mensaje y fecha estimada editables — a todas las páginas públicas. El admin sigue navegando con un link de acceso con clave (cookie de 24 h) y el login nunca se bloquea. Cuenta las visitas frenadas. Con auth activo, panel /mantenimiento-admin.html. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/mantenimiento', file: 'routes/mantenimiento.js' }],
  middlewares: [{ file: 'src/middleware/mantenimiento.js' }],
  collections: ['maintenance'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Mantenimiento', href: '/mantenimiento-admin.html', id: 'nav-mant-admin' }] : [],
  head: () => `  <style>
    .mt-sw{display:flex;align-items:center;gap:16px;padding:18px 20px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
    .mt-sw .mt-led{width:14px;height:14px;border-radius:999px;background:#2e9e5b;flex:none}
    .mt-sw.on .mt-led{background:#c0392b}
    .mt-sw strong{display:block}
    .mt-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:22px 0}
    .mt-kpis .card{text-align:center}
    .mt-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .mt-link{border-left:3px solid var(--accent);padding:14px 18px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0;margin:18px 0;word-break:break-all;font-size:.9rem}
  </style>`,
  files: (cfg) => ({
    // Pantalla de mantenimiento: HTML autocontenido (sin CSS ni JS externos, porque el propio
    // middleware puede estar bloqueando los estáticos del sitio). Se arma en el servidor con los
    // textos vigentes de la ficha, así el negocio los cambia sin regenerar nada.
    'src/middleware/mantenimiento.js': `/**
 * Middleware de modo mantenimiento. Montado ANTES de express.static (ver src/app.js), así que
 * intercepta también las páginas HTML. Deja pasar siempre: los estáticos (css/js/imágenes), el
 * login, el panel de mantenimiento y sus APIs — para que sea imposible quedar afuera del sistema.
 */
const db = require('../db');

// Rutas que NUNCA se bloquean: sin ellas el admin no podría entrar a apagar el mantenimiento
const LIBRES = ['/auth.html', '/mantenimiento-admin.html', '/api/auth', '/api/mantenimiento'];

// ¿Es una página (HTML) y no un asset? Los assets se dejan pasar: la pantalla de mantenimiento
// es autocontenida, pero bloquear /css/styles.css rompería el login que sí dejamos abierto.
function esPagina(p) {
  if (p === '/' || p.endsWith('/')) return true;
  const ultimo = p.slice(p.lastIndexOf('/') + 1);
  return !ultimo.includes('.') || ultimo.endsWith('.html');
}

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Ficha única del estado (se crea sola la primera vez, apagada)
async function ficha() {
  const rows = await db.all('maintenance');
  if (rows.length) return rows[0];
  return db.insert('maintenance', {
    active: false,
    title: 'Estamos haciendo mejoras',
    message: 'El sitio vuelve a estar disponible en unos minutos. Gracias por la paciencia.',
    until: '',
    blocked: 0,
    bypassKey: require('crypto').randomBytes(8).toString('hex'),
  });
}

function pantalla(f) {
  const vuelve = f.until ? '<p class="vuelve">Volvemos aproximadamente el <strong>' + esc(f.until.split('-').reverse().join('/')) + '</strong></p>' : '';
  return \`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>\${esc(f.title)} — ${cfg.brand.name.replace(/[`$\\]/g, '')}</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px;
    font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    background:${cfg.brand.colors.bg};color:${cfg.brand.colors.primary}}
  .caja{max-width:560px;text-align:center}
  .marca{font-weight:800;letter-spacing:-.02em;font-size:1.05rem;color:${cfg.brand.colors.accent};margin-bottom:28px}
  h1{font-size:clamp(1.7rem,5vw,2.4rem);line-height:1.15;letter-spacing:-.02em;margin:0 0 14px}
  p{font-size:1.05rem;line-height:1.6;opacity:.75;margin:0 0 10px}
  .vuelve{opacity:1;margin-top:22px;font-size:.95rem}
  .barra{height:4px;width:120px;margin:32px auto 0;border-radius:999px;
    background:linear-gradient(90deg,transparent,${cfg.brand.colors.accent},transparent);
    background-size:200% 100%;animation:desliz 1.8s ease-in-out infinite}
  @keyframes desliz{0%{background-position:100% 0}100%{background-position:-100% 0}}
  @media (prefers-reduced-motion:reduce){.barra{animation:none}}
</style>
</head>
<body>
  <div class="caja">
    <div class="marca">${cfg.brand.name.replace(/[`$\\]/g, '')}</div>
    <h1>\${esc(f.title)}</h1>
    <p>\${esc(f.message)}</p>
    \${vuelve}
    <div class="barra" aria-hidden="true"></div>
  </div>
</body>
</html>\`;
}

module.exports = async function mantenimiento(req, res, next) {
  const f = await ficha();
  if (!f.active) return next();
  if (LIBRES.some(r => req.path === r || req.path.startsWith(r + '/'))) return next();

  // Link de acceso del admin: ?acceso=<clave> deja una cookie de 24 h y habilita la navegación
  if (req.query && req.query.acceso && req.query.acceso === f.bypassKey) {
    res.setHeader('Set-Cookie', 'wfmant=' + f.bypassKey + '; Path=/; Max-Age=86400; SameSite=Lax');
    return next();
  }
  if (String(req.headers.cookie || '').split(';').some(c => c.trim() === 'wfmant=' + f.bypassKey)) return next();

  // Assets libres: la pantalla es autocontenida, pero el login que dejamos abierto necesita su CSS
  if (!esPagina(req.path) && !req.path.startsWith('/api')) return next();

  res.setHeader('Retry-After', '3600'); // 503 + Retry-After: Google lo lee como temporal
  if (req.path.startsWith('/api')) {
    return res.status(503).json({ error: f.title + ': ' + f.message, maintenance: true });
  }
  // Cada visita frenada se cuenta: es la métrica de cuánta gente se topó con el cartel
  await db.update('maintenance', f.id, { blocked: (f.blocked || 0) + 1 });
  res.status(503).type('html').send(pantalla(f));
};
`,
    'routes/mantenimiento.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;

// Misma ficha única que lee el middleware (se crea sola apagada la primera vez)
async function ficha() {
  const rows = await db.all('maintenance');
  if (rows.length) return rows[0];
  return db.insert('maintenance', {
    active: false,
    title: 'Estamos haciendo mejoras',
    message: 'El sitio vuelve a estar disponible en unos minutos. Gracias por la paciencia.',
    until: '',
    blocked: 0,
    bypassKey: require('crypto').randomBytes(8).toString('hex'),
  });
}

// GET /api/mantenimiento/estado — estado público mínimo (no expone la clave de acceso)
router.get('/estado', async (req, res) => {
  const f = await ficha();
  res.json({ active: !!f.active });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/mantenimiento — ficha completa con la clave de acceso (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  const f = await ficha();
  res.json(f);
});

// PUT /api/mantenimiento — enciende/apaga y edita los textos del cartel (solo admin)
router.put('/', requireAdmin, async (req, res) => {
  const f = await ficha();
  const patch = {};
  if (req.body.active !== undefined) patch.active = !!req.body.active;
  if (req.body.title !== undefined) {
    if (!str(req.body.title, 3, 80)) return res.status(422).json({ error: 'El título del cartel va entre 3 y 80 caracteres' });
    patch.title = String(req.body.title).trim();
  }
  if (req.body.message !== undefined) {
    if (!str(req.body.message, 3, 400)) return res.status(422).json({ error: 'El mensaje del cartel va entre 3 y 400 caracteres' });
    patch.message = String(req.body.message).trim();
  }
  if (req.body.until !== undefined) {
    const v = String(req.body.until || '').trim();
    if (v && (!FECHA.test(v) || isNaN(Date.parse(v + 'T00:00:00Z')))) {
      return res.status(422).json({ error: 'Fecha estimada inválida' });
    }
    patch.until = v;
  }
  // Encender vuelve a arrancar el contador: cada bajada del sitio mide lo suyo
  if (patch.active === true && !f.active) patch.blocked = 0;
  res.json(await db.update('maintenance', f.id, patch));
});

// POST /api/mantenimiento/clave — rota la clave del link de acceso (solo admin)
router.post('/clave', requireAdmin, async (req, res) => {
  const f = await ficha();
  const upd = await db.update('maintenance', f.id, { bypassKey: require('crypto').randomBytes(8).toString('hex') });
  res.json({ bypassKey: upd.bypassKey });
});
` : `// El panel de mantenimiento requiere el módulo de autenticación: activalo en el Builder para
// habilitar /mantenimiento-admin.html. Sin él, editá data/maintenance.json a mano (active: true)
// y el middleware baja el sitio igual.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'mantenimiento-admin': {
      title: 'Modo mantenimiento',
      html: `  <section>
    <div class="container" style="max-width:720px">
      <h2>Modo mantenimiento</h2>
      <p class="section-sub">Bajá el sitio mientras hacés cambios: los visitantes ven un cartel propio y el servidor responde 503 (Google entiende que es temporal). Vos seguís navegando con el link de acceso. Solo visible para administradores.</p>
      <div class="mt-sw" id="mt-sw">
        <span class="mt-led" aria-hidden="true"></span>
        <span style="flex:1"><strong id="mt-estado">Cargando…</strong><span class="muted" id="mt-detalle">—</span></span>
        <button class="btn" type="button" id="mt-toggle">—</button>
      </div>
      <div class="mt-kpis" id="mt-kpis"></div>
      <div class="mt-link" id="mt-acceso" hidden></div>
      <form id="mt-form" class="card">
        <h3 style="margin-top:0">Textos del cartel</h3>
        <label>Título</label>
        <input name="title" maxlength="80" required placeholder="Estamos haciendo mejoras">
        <label>Mensaje</label>
        <textarea name="message" rows="3" maxlength="400" required placeholder="El sitio vuelve en unos minutos."></textarea>
        <label>Fecha estimada de vuelta (opcional)</label>
        <input name="until" type="date">
        <button class="btn ghost" type="submit" style="margin-top:16px">Guardar textos</button>
      </form>
      <p class="muted" style="font-size:.85rem;margin-top:18px">El login (<code>/auth.html</code>) y esta página nunca se bloquean: es imposible quedar afuera del sistema.</p>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => cfg.moduleIds.includes('auth') ? `/* Módulo modo mantenimiento: panel solo-admin en /mantenimiento-admin.html con el interruptor,
   los textos del cartel y el link de acceso. Animado con Anime.js (pop del interruptor, count-up
   de visitas frenadas) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  // Oculta el link admin de la navbar para quien no es admin (en TODAS las páginas)
  var navMt = document.getElementById('nav-mant-admin');
  if (navMt && (!me || me.role !== 'admin') && !window.__PREVIEW__) navMt.style.display = 'none';

  var sw = document.getElementById('mt-sw');
  if (!sw) return;
  var estado = document.getElementById('mt-estado');
  var detalle = document.getElementById('mt-detalle');
  var toggle = document.getElementById('mt-toggle');
  var kpis = document.getElementById('mt-kpis');
  var acceso = document.getElementById('mt-acceso');
  var formMt = document.getElementById('mt-form');
  var actual = null;

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = Number(hasta).toLocaleString('es-AR'); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR'); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = Number(hasta).toLocaleString('es-AR'); }, 800);
  }

  function pintar(f) {
    actual = f;
    sw.classList.toggle('on', !!f.active);
    estado.textContent = f.active ? 'El sitio está en mantenimiento' : 'El sitio está online';
    detalle.textContent = f.active
      ? 'Los visitantes ven el cartel. Vos navegás con el link de acceso.'
      : 'Todo el mundo ve el sitio con normalidad.';
    toggle.textContent = f.active ? 'Volver a publicar' : 'Bajar el sitio';
    kpis.innerHTML = '<div class="card"><strong id="mt-k-blo">0</strong><span class="muted">visitas frenadas</span></div>' +
      '<div class="card"><strong style="font-size:1.15rem">' + (f.active ? 'En mantenimiento' : 'Online') + '</strong><span class="muted">estado actual</span></div>' +
      '<div class="card"><strong style="font-size:1.15rem">' + (f.until ? f.until.split('-').reverse().join('/') : 'Sin fecha') + '</strong><span class="muted">vuelta estimada</span></div>';
    contar(document.getElementById('mt-k-blo'), f.blocked || 0);
    if (f.bypassKey) {
      acceso.hidden = false;
      var url = location.origin + '/index.html?acceso=' + f.bypassKey;
      acceso.innerHTML = '<strong>Tu link de acceso:</strong> abrilo una vez y podés navegar el sitio completo durante 24 horas aunque esté en mantenimiento.<br><a href="' + App.esc(url) + '" target="_blank" rel="noopener">' + App.esc(url) + '</a>';
    }
    formMt.querySelector('[name="title"]').value = f.title || '';
    formMt.querySelector('[name="message"]').value = f.message || '';
    formMt.querySelector('[name="until"]').value = f.until || '';
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(sw, { scale: [0.97, 1], opacity: [0.6, 1], duration: 380, ease: 'outCubic' });
      // Red de seguridad: deja el interruptor visible aunque el loop esté pausado
      setTimeout(function () { sw.style.opacity = 1; sw.style.transform = 'none'; }, 700);
    }
  }

  toggle.addEventListener('click', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se bajaría o publicaría el sitio'); return; }
    if (!actual) return;
    var prender = !actual.active;
    if (prender && !confirm('¿Bajar el sitio? Los visitantes van a ver el cartel de mantenimiento.')) return;
    try {
      pintar(await App.api('/api/mantenimiento', { method: 'PUT', body: { active: prender } }));
      App.toast(prender ? 'Sitio en mantenimiento' : 'Sitio publicado de nuevo');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  formMt.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: se guardarían los textos del cartel'); return; }
    try {
      pintar(await App.api('/api/mantenimiento', { method: 'PUT', body: {
        title: formMt.querySelector('[name="title"]').value,
        message: formMt.querySelector('[name="message"]').value,
        until: formMt.querySelector('[name="until"]').value,
      } }));
      App.toast('Textos del cartel guardados');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  if (window.__PREVIEW__) {
    pintar({ active: false, title: 'Estamos haciendo mejoras', message: 'El sitio vuelve a estar disponible en unos minutos. Gracias por la paciencia.', until: '', blocked: 0, bypassKey: 'clave-de-ejemplo' });
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    App.api('/api/mantenimiento').then(pintar).catch(function (err) { estado.textContent = err.message; });
  }
})();` : `/* Módulo modo mantenimiento: sin el módulo de autenticación no hay panel; el middleware lee
   igual data/maintenance.json (poné active: true a mano para bajar el sitio). */`,
  readmeNotes: (cfg) => [
    `**Modo mantenimiento**: el estado vive en la colección \`maintenance\` y lo aplica un **middleware de Express** (\`src/middleware/mantenimiento.js\`) montado antes de los estáticos, así que también intercepta el HTML: con el modo encendido todas las páginas públicas responden **503 + Retry-After** con un cartel propio (Google lo lee como caída temporal y no desindexa el sitio). ${cfg.moduleIds.includes('auth') ? 'Se enciende desde `/mantenimiento-admin.html`, donde también editás el título, el mensaje y la fecha estimada de vuelta. El panel te da un **link de acceso** (`?acceso=<clave>`) que deja una cookie de 24 h para seguir navegando el sitio bajado; podés rotar la clave cuando quieras.' : 'Sin el módulo **Autenticación** no hay panel: encendelo poniendo `"active": true` en `data/maintenance.json` (el link de acceso es `?acceso=<bypassKey>` del mismo archivo).'} El login (\`/auth.html\`)${cfg.moduleIds.includes('auth') ? ', esta página' : ''} y los archivos estáticos nunca se bloquean: es imposible quedar afuera del sistema.`,
  ],
};
