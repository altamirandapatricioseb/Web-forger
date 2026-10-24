// Monitor de salud del sitio con backend real: los tres problemas que un sitio publicado tiene y
// que nadie ve hasta que un cliente se queja. El catálogo ya mide CUÁNTA gente entra (módulo
// `stats`); lo que faltaba es medir CÓMO le fue: si la página cargó rápido en el teléfono de esa
// persona, si le explotó un error de JavaScript en la cara, y si el enlace que siguió lleva a una
// página que ya no existe.
// Las tres cosas se miden desde el navegador de la visita real, no con una prueba de laboratorio:
// las Core Web Vitals (LCP, CLS, INP) son las mismas métricas con las que Google decide el
// posicionamiento, y se toman con PerformanceObserver, que es la API que el navegador expone
// justamente para esto. Los errores se capturan con window.onerror y las promesas rechazadas.
// Los 404 los cuenta el servidor mirando el estado real de cada respuesta, así que también
// aparecen los que nunca llegaron a pintar una página.
// Nada de esto identifica a nadie: no se guarda IP, ni user-agent completo, ni identificador de
// visitante; solo el día, la página y el número. Y si el visitante rechazó el almacenamiento en
// el centro de privacidad, no se manda nada.
// Animado con Anime.js (count-up de KPIs, barras de la serie de 14 días) + red de seguridad.
// La medición es pública (la manda cada visita); el panel requiere auth.

module.exports = {
  id: 'salud', type: 'functional', name: 'Monitor de salud del sitio',
  description: 'Mide cómo le fue a cada visita real: velocidad de carga con las Core Web Vitals de Google (LCP, CLS, INP) tomadas con PerformanceObserver, errores de JavaScript que rompen la página en el navegador del visitante, y enlaces rotos (404) contados por el servidor con el estado real de cada respuesta. Panel /salud-admin.html con serie de 14 días, páginas más lentas, errores agrupados y 404 con un botón para redirigirlos. No guarda IP ni identificador de visitante. Requiere auth para el panel. Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/salud', file: 'routes/salud.js' }],
  middlewares: [{ file: 'src/middleware/salud.js' }],
  collections: ['vitals', 'jserrors', 'notfound'],
  nav: () => [{ label: 'Salud del sitio (admin)', href: '/salud-admin.html', id: 'nav-salud-admin' }],
  head: () => `  <style>
    .sl-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:22px 0}
    .sl-kpis .card{text-align:center}
    .sl-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .sl-kpis .sl-sub{font-size:.75rem}
    .sl-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 18px}
    .sl-tabs button{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:7px 16px;cursor:pointer;font:inherit;font-size:.9rem;color:inherit}
    .sl-tabs button.on{background:var(--accent);border-color:var(--accent);color:#fff}
    .sl-serie{display:flex;align-items:flex-end;gap:5px;height:120px;margin:18px 0 6px}
    .sl-barra{flex:1;border-radius:4px 4px 0 0;min-height:3px;background:#2e9e5b;position:relative}
    .sl-barra.media{background:#e6a800}
    .sl-barra.mala{background:#c0392b}
    .sl-barra.vacia{background:var(--line)}
    .sl-barra span{position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:.68rem;color:var(--muted)}
    .sl-dias{display:flex;gap:5px;font-size:.68rem;color:var(--muted)}
    .sl-dias div{flex:1;text-align:center}
    .sl-metrica{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
    .sl-punto{width:12px;height:12px;border-radius:999px;background:#2e9e5b;flex:none}
    .sl-punto.media{background:#e6a800}
    .sl-punto.mala{background:#c0392b}
    .sl-punto.sin{background:var(--line)}
    .sl-msg{font-family:ui-monospace,'Cascadia Code','Courier New',monospace;font-size:.8rem;word-break:break-word}
    .sl-ruta{font-family:ui-monospace,'Cascadia Code','Courier New',monospace;font-size:.82rem;word-break:break-all}
    .sl-resuelto{opacity:.55}
  </style>`,
  files: (cfg) => ({
    // Middleware de 404: se anota el estado REAL de la respuesta (al terminar), no una suposición
    // sobre si el archivo existe. Así aparecen también los 404 de API y los que devuelve otro módulo.
    'src/middleware/salud.js': `/**
 * Middleware del monitor de salud: cuenta los 404 del sitio. Montado ANTES de express.static
 * (ver src/app.js), pero NO responde nada: se engancha al final de la respuesta y anota si terminó
 * en 404. Mirar el estado real en vez de adivinar si el archivo existe es lo que hace que también
 * queden registrados los 404 que devuelve un router (un producto borrado, un artículo que ya no está).
 */
const db = require('../db');

const hoy = () => new Date().toISOString().slice(0, 10);

// Solo el dominio de quien enlazó, nunca la dirección entera: alcanza para saber si el enlace
// roto está en Google, en Instagram o adentro del propio sitio, y no arma el historial de nadie.
function origenDe(ref) {
  if (!ref) return 'directo';
  try {
    const u = new URL(ref);
    return u.hostname || 'directo';
  } catch { return 'directo'; }
}

// Los assets que faltan (un favicon, un mapa de fuentes) ensucian el listado sin decir nada:
// lo que importa son las páginas a las que alguien intentó entrar.
function esInteresante(p) {
  if (p.startsWith('/api/')) return false;
  const ultimo = p.slice(p.lastIndexOf('/') + 1);
  return !ultimo.includes('.') || ultimo.endsWith('.html');
}

module.exports = function salud404(req, res, next) {
  if (req.method !== 'GET') return next();
  res.on('finish', () => {
    if (res.statusCode !== 404) return;
    const ruta = String(req.path || '').slice(0, 200);
    if (!esInteresante(ruta)) return;
    const desde = origenDe(req.headers.referer || req.headers.referrer);
    const dia = hoy();
    // Se agrupa por ruta+origen+día: un robot golpeando mil veces la misma dirección no puede
    // hacer crecer la base sin control.
    Promise.resolve()
      .then(() => db.find('notfound', f => f.ruta === ruta && f.desde === desde && f.dia === dia))
      .then((filas) => filas[0]
        ? db.update('notfound', filas[0].id, { hits: (filas[0].hits || 0) + 1 })
        : db.insert('notfound', { ruta, desde, dia, hits: 1, resuelto: false }))
      .catch((err) => console.error('[salud] no se pudo anotar el 404:', err.message));
  });
  next();
};
`,

    'routes/salud.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');
${cfg.moduleIds.includes('seoadmin') ? "const { invalidar } = require('../src/middleware/seoadmin');" : ''}

// Umbrales oficiales de las Core Web Vitals (los mismos que usa Google para clasificar una
// visita como buena / mejorable / mala). Están acá y no en el navegador a propósito: si mañana
// Google los mueve, se corrigen en un solo lugar y toda la serie histórica se relee con el nuevo
// criterio, porque lo que se guarda es el promedio y el conteo por categoría del día.
const UMBRALES = {
  LCP: { bueno: 2500, malo: 4000, unidad: 'ms', nombre: 'Carga del contenido principal' },
  CLS: { bueno: 0.1, malo: 0.25, unidad: '', nombre: 'Estabilidad visual' },
  INP: { bueno: 200, malo: 500, unidad: 'ms', nombre: 'Respuesta a la interacción' },
};
const METRICAS = Object.keys(UMBRALES);

// Topes de tamaño: esto lo llama cualquier visitante anónimo, así que nada puede crecer sin techo
const MAX_ERRORES = 300;
const MAX_LARGO = 300;

const hoy = () => new Date().toISOString().slice(0, 10);
const recorta = (s, n) => String(s == null ? '' : s).slice(0, n);

// Solo la ruta, nunca la URL completa con sus parámetros (ahí puede viajar un email en un ?email=)
function rutaDe(v) {
  const t = String(v || '/').split('?')[0].split('#')[0];
  return /^\\/[^\\s]{0,120}$/.test(t) ? t : '/';
}

function categoria(metrica, valor) {
  const u = UMBRALES[metrica];
  if (valor <= u.bueno) return 'bueno';
  if (valor <= u.malo) return 'mejorable';
  return 'malo';
}

/* ---------- Lo que manda cada visita (público) ---------- */

// POST /api/salud/reporte — las mediciones de una visita real. Público por necesidad: lo llama
// el navegador de cualquier persona que entra al sitio.
router.post('/reporte', async (req, res) => {
  const ruta = rutaDe(req.body.pagina);
  const dia = hoy();
  let guardadas = 0;

  // Métricas de velocidad: se acumulan por día/métrica/página en una sola fila. No se guarda una
  // fila por visita porque no hace falta: para decidir qué arreglar alcanza con el promedio y
  // cuántas visitas cayeron en cada categoría.
  const medidas = Array.isArray(req.body.vitals) ? req.body.vitals.slice(0, 5) : [];
  for (const m of medidas) {
    if (!METRICAS.includes(m && m.metrica)) continue;
    const valor = Number(m.valor);
    // Valores imposibles (negativos, o un LCP de media hora por una pestaña en segundo plano)
    if (!isFinite(valor) || valor < 0 || valor > 600000) continue;
    const cat = categoria(m.metrica, valor);
    const fila = (await db.find('vitals', v => v.dia === dia && v.metrica === m.metrica && v.ruta === ruta))[0];
    if (fila) {
      await db.update('vitals', fila.id, {
        n: (fila.n || 0) + 1,
        suma: (fila.suma || 0) + valor,
        peor: Math.max(fila.peor || 0, valor),
        [cat]: (fila[cat] || 0) + 1,
      });
    } else {
      await db.insert('vitals', {
        dia, metrica: m.metrica, ruta, n: 1, suma: valor, peor: valor,
        bueno: cat === 'bueno' ? 1 : 0, mejorable: cat === 'mejorable' ? 1 : 0, malo: cat === 'malo' ? 1 : 0,
      });
    }
    guardadas++;
  }

  // Errores de JavaScript: se agrupan por mensaje+archivo+línea. Un error que le pasa a 400
  // personas es UNA fila con 400 usos, no 400 filas: así el listado se puede leer.
  const errores = Array.isArray(req.body.errores) ? req.body.errores.slice(0, 5) : [];
  for (const e of errores) {
    const mensaje = recorta(e && e.mensaje, MAX_LARGO).trim();
    if (!mensaje) continue;
    const archivo = recorta(e && e.archivo, MAX_LARGO);
    const linea = Number(e && e.linea) || 0;
    const previo = (await db.find('jserrors', x => x.mensaje === mensaje && x.archivo === archivo && x.linea === linea))[0];
    if (previo) {
      await db.update('jserrors', previo.id, {
        hits: (previo.hits || 0) + 1, lastAt: new Date().toISOString(), ruta,
        // Un error que vuelve a pasar deja de estar resuelto: el arreglo no funcionó
        resuelto: false,
      });
    } else {
      if ((await db.all('jserrors')).length >= MAX_ERRORES) continue;
      await db.insert('jserrors', { mensaje, archivo, linea, ruta, hits: 1, lastAt: new Date().toISOString(), resuelto: false });
    }
    guardadas++;
  }

  // Respuesta mínima: la manda un beacon que nadie lee, no tiene sentido devolver datos
  res.status(guardadas ? 201 : 200).json({ ok: true, guardadas });
});

/* ---------- Panel del negocio ---------- */

// GET /api/salud/stats — KPIs de la semana (solo admin)
router.get('/stats', requireAdmin, async (req, res) => {
  const vs = await db.all('vitals');
  const errs = await db.all('jserrors');
  const n4 = await db.all('notfound');
  const corte = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const semana = vs.filter(v => v.dia >= corte);
  const visitas = semana.filter(v => v.metrica === 'LCP').reduce((a, v) => a + (v.n || 0), 0);
  const buenas = semana.filter(v => v.metrica === 'LCP').reduce((a, v) => a + (v.bueno || 0), 0);
  res.json({
    visitas,
    rapidas: visitas ? Math.round(buenas / visitas * 100) : 0,
    errores: errs.filter(e => !e.resuelto).length,
    erroresHits: errs.filter(e => !e.resuelto).reduce((a, e) => a + (e.hits || 0), 0),
    rotos: n4.filter(f => f.dia >= corte && !f.resuelto).reduce((a, f) => a + (f.hits || 0), 0),
  });
});

// GET /api/salud/velocidad — serie de 14 días y detalle por métrica y por página (solo admin)
router.get('/velocidad', requireAdmin, async (req, res) => {
  const vs = await db.all('vitals');
  // Serie completa de 14 días: los días sin visitas valen 0 y se muestran igual (un gráfico que
  // saltea los días vacíos hace creer que el sitio anduvo bien cuando en realidad nadie entró)
  const serie = [];
  for (let i = 13; i >= 0; i--) {
    const dia = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const delDia = vs.filter(v => v.dia === dia && v.metrica === 'LCP');
    const n = delDia.reduce((a, v) => a + (v.n || 0), 0);
    serie.push({ dia, n, bueno: delDia.reduce((a, v) => a + (v.bueno || 0), 0) });
  }
  const metricas = METRICAS.map(m => {
    const filas = vs.filter(v => v.metrica === m);
    const n = filas.reduce((a, v) => a + (v.n || 0), 0);
    return {
      metrica: m,
      nombre: UMBRALES[m].nombre,
      unidad: UMBRALES[m].unidad,
      n,
      promedio: n ? Math.round(filas.reduce((a, v) => a + (v.suma || 0), 0) / n * (m === 'CLS' ? 1000 : 1)) / (m === 'CLS' ? 1000 : 1) : 0,
      bueno: filas.reduce((a, v) => a + (v.bueno || 0), 0),
      mejorable: filas.reduce((a, v) => a + (v.mejorable || 0), 0),
      malo: filas.reduce((a, v) => a + (v.malo || 0), 0),
      umbrales: UMBRALES[m],
    };
  });
  // Las páginas más lentas: es la lista por la que se empieza a arreglar
  const porRuta = {};
  for (const v of vs.filter(x => x.metrica === 'LCP')) {
    const r = porRuta[v.ruta] || (porRuta[v.ruta] = { ruta: v.ruta, n: 0, suma: 0, malo: 0 });
    r.n += v.n || 0; r.suma += v.suma || 0; r.malo += v.malo || 0;
  }
  const paginas = Object.values(porRuta).map(r => ({ ...r, promedio: r.n ? Math.round(r.suma / r.n) : 0 }))
    .sort((a, b) => b.promedio - a.promedio).slice(0, 12);
  res.json({ serie, metricas, paginas });
});

// GET /api/salud/errores — errores agrupados (solo admin)
router.get('/errores', requireAdmin, async (req, res) => {
  res.json((await db.all('jserrors')).slice().sort((a, b) => (b.hits || 0) - (a.hits || 0)));
});

// PUT /api/salud/errores/:id — marcar como resuelto (solo admin)
router.put('/errores/:id', requireAdmin, async (req, res) => {
  const e = await db.get('jserrors', req.params.id);
  if (!e) return res.status(404).json({ error: 'Error inexistente' });
  res.json(await db.update('jserrors', e.id, { resuelto: !!req.body.resuelto }));
});

// DELETE /api/salud/errores/:id (solo admin)
router.delete('/errores/:id', requireAdmin, async (req, res) => {
  const e = await db.get('jserrors', req.params.id);
  if (!e) return res.status(404).json({ error: 'Error inexistente' });
  await db.remove('jserrors', e.id);
  res.json({ ok: true });
});

// GET /api/salud/rotos — enlaces rotos agrupados por ruta (solo admin)
router.get('/rotos', requireAdmin, async (req, res) => {
  const filas = await db.all('notfound');
  const porRuta = {};
  for (const f of filas) {
    const r = porRuta[f.ruta] || (porRuta[f.ruta] = { ruta: f.ruta, hits: 0, desde: {}, ultimo: f.dia, resuelto: true });
    r.hits += f.hits || 0;
    r.desde[f.desde] = (r.desde[f.desde] || 0) + (f.hits || 0);
    if (f.dia > r.ultimo) r.ultimo = f.dia;
    // La ruta queda "pendiente" si alguna de sus filas lo está
    if (!f.resuelto) r.resuelto = false;
  }
  res.json(Object.values(porRuta).map(r => ({
    ...r,
    desde: Object.entries(r.desde).map(([d, n]) => ({ desde: d, hits: n })).sort((a, b) => b.hits - a.hits),
  })).sort((a, b) => b.hits - a.hits));
});
${cfg.moduleIds.includes('seoadmin') ? `
// POST /api/salud/rotos/redirigir — arregla un enlace roto creando su redirección 301 y lo marca
// resuelto. Es el circuito completo: el servidor detecta el 404, el dueño elige a dónde debería
// llevar y la dirección vieja vuelve a funcionar, todo sin salir del panel. (solo admin)
router.post('/rotos/redirigir', requireAdmin, async (req, res) => {
  const ruta = rutaDe(req.body.ruta);
  const destino = String(req.body.destino || '').trim();
  if (!destino) return res.status(422).json({ error: 'Falta el destino de la redirección' });
  if (!(destino.startsWith('/') || /^https?:\\/\\//i.test(destino))) {
    return res.status(422).json({ error: 'El destino tiene que ser una ruta interna (/algo.html) o una dirección http:// o https://' });
  }
  if (ruta.toLowerCase() === destino.toLowerCase()) return res.status(422).json({ error: 'El origen y el destino no pueden ser la misma dirección' });
  const yaEsta = (await db.find('seoredirects', r => String(r.from).toLowerCase() === ruta.toLowerCase()))[0];
  if (!yaEsta) {
    await db.insert('seoredirects', { from: ruta, to: destino, code: 301, keepQuery: true, active: true, hits: 0, lastHitAt: '' });
  } else {
    await db.update('seoredirects', yaEsta.id, { to: destino, active: true });
  }
  invalidar();
  for (const f of await db.find('notfound', x => x.ruta === ruta)) await db.update('notfound', f.id, { resuelto: true });
  res.status(201).json({ ok: true, from: ruta, to: destino });
});
` : ''}
// PUT /api/salud/rotos — marcar una ruta rota como atendida sin redirigirla (solo admin)
router.put('/rotos', requireAdmin, async (req, res) => {
  const ruta = rutaDe(req.body.ruta);
  const filas = await db.find('notfound', f => f.ruta === ruta);
  if (!filas.length) return res.status(404).json({ error: 'Esa ruta no está registrada' });
  for (const f of filas) await db.update('notfound', f.id, { resuelto: !!req.body.resuelto });
  res.json({ ok: true });
});

module.exports = router;
`,
  }),
  pages: () => ({
    'salud-admin': {
      title: 'Salud del sitio',
      html: `  <section>
    <div class="container" style="max-width:1000px">
      <h2>Salud del sitio</h2>
      <p class="section-sub">Cómo le fue de verdad a la gente que entró: cuánto tardó en cargar, si algo se rompió en su navegador y si siguió un enlace a una página que ya no existe. Todo medido en visitas reales, sin guardar quién es nadie. Solo visible para administradores.</p>
      <div class="sl-kpis" id="sl-kpis"></div>
      <div class="sl-tabs">
        <button type="button" data-tab="velocidad" class="on">Velocidad</button>
        <button type="button" data-tab="errores">Errores</button>
        <button type="button" data-tab="rotos">Enlaces rotos</button>
      </div>
      <div id="sl-velocidad"><p class="muted">Cargando…</p></div>
      <div id="sl-errores" style="display:none"></div>
      <div id="sl-rotos" style="display:none"></div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo monitor de salud: mide en TODAS las páginas las Core Web Vitals de la visita real
   (LCP, CLS, INP con PerformanceObserver) y captura los errores de JavaScript, y los manda una
   sola vez al servidor cuando la persona se va. El panel solo-admin vive en /salud-admin.html.
   Animado con Anime.js (count-up, barras de la serie) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var navSalud = document.getElementById('nav-salud-admin');
  if (navSalud && (!me || me.role !== 'admin') && !window.__PREVIEW__) navSalud.style.display = 'none';

  /* ---------- Medición en el navegador del visitante ---------- */
  (function medir() {
    if (window.__PREVIEW__ || !window.PerformanceObserver) return;
    // Si la persona rechazó el almacenamiento en el centro de privacidad, no se mide nada.
    // Estas métricas no identifican a nadie, pero respetar la decisión no se negocia.
    try { if (localStorage.getItem('cookie-consent') === 'rejected') return; } catch (e) {}

    var vitals = {};
    var errores = [];
    var enviado = false;

    function observar(tipo, fn, extra) {
      try {
        var po = new PerformanceObserver(function (lista) { lista.getEntries().forEach(fn); });
        po.observe(Object.assign({ type: tipo, buffered: true }, extra || {}));
        return po;
      } catch (e) { return null; }
    }

    // LCP: el elemento grande que la persona percibe como "ya cargó". Vale la ÚLTIMA entrada.
    observar('largest-contentful-paint', function (e) { vitals.LCP = e.startTime; });

    // CLS: cuánto se movió el contenido solo. Se suman los saltos que NO siguen a un clic o
    // a una tecla (esos son cambios que la persona pidió, no un salto molesto).
    var cls = 0;
    observar('layout-shift', function (e) { if (!e.hadRecentInput) { cls += e.value; vitals.CLS = cls; } });

    // INP: cuánto tardó la página en responder a la interacción más lenta. Se toma la peor,
    // que es la que la persona recuerda.
    observar('event', function (e) {
      if (!e.duration) return;
      if (!vitals.INP || e.duration > vitals.INP) vitals.INP = e.duration;
    }, { durationThreshold: 40 });

    function anotarError(mensaje, archivo, linea) {
      if (errores.length >= 5) return;
      errores.push({ mensaje: String(mensaje || '').slice(0, 300), archivo: String(archivo || '').slice(0, 300), linea: Number(linea) || 0 });
      // Un error es urgente: se manda al toque, no vaya a ser que además rompa el envío del final
      enviar();
    }
    window.addEventListener('error', function (e) {
      anotarError(e.message, e.filename, e.lineno);
    });
    window.addEventListener('unhandledrejection', function (e) {
      var r = e.reason;
      anotarError('Promesa rechazada: ' + ((r && r.message) || r), (r && r.stack ? String(r.stack).split('\\n')[1] : ''), 0);
    });

    function enviar() {
      var medidas = Object.keys(vitals).map(function (k) { return { metrica: k, valor: vitals[k] }; });
      if (!medidas.length && !errores.length) return;
      if (enviado && !errores.length) return;
      enviado = true;
      var cuerpo = JSON.stringify({ pagina: location.pathname, vitals: medidas, errores: errores });
      errores = [];
      // sendBeacon sobrevive al cierre de la pestaña, que es exactamente cuando queremos medir.
      // El tipo application/json es lo que hace que express.json() lo parsee del otro lado.
      try {
        if (navigator.sendBeacon && navigator.sendBeacon('/api/salud/reporte', new Blob([cuerpo], { type: 'application/json' }))) return;
      } catch (e) {}
      fetch('/api/salud/reporte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, keepalive: true }).catch(function () {});
    }

    // Se manda cuando la pestaña se oculta: es el único momento garantizado en móviles
    // (el evento 'unload' no dispara en iOS). Si la persona vuelve, ya está enviado.
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') enviar(); });
    window.addEventListener('pagehide', enviar);
  })();

  /* ---------- Panel del negocio ---------- */
  var kpis = document.getElementById('sl-kpis');
  if (!kpis) return;
  var cajaVel = document.getElementById('sl-velocidad');
  var cajaErr = document.getElementById('sl-errores');
  var cajaRot = document.getElementById('sl-rotos');
  var errores = [], rotos = [];
  var HAY_SEO = !!document.getElementById('nav-seo-admin');

  function contar(el, hasta, sufijo) {
    if (!el) return;
    var anime = window.anime;
    function fin() { el.textContent = Number(hasta).toLocaleString('es-AR') + (sufijo || ''); }
    if (!anime || !anime.animate || reduce) { fin(); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR') + (sufijo || ''); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(fin, 800);
  }

  function pintarStats(s) {
    kpis.innerHTML = '<div class="card"><strong id="sl-k-vis">0</strong><span class="muted sl-sub">visitas medidas (7 d)</span></div>' +
      '<div class="card"><strong id="sl-k-rap">0</strong><span class="muted sl-sub">cargaron rápido</span></div>' +
      '<div class="card"><strong id="sl-k-err">0</strong><span class="muted sl-sub">errores sin resolver</span></div>' +
      '<div class="card"><strong id="sl-k-rot">0</strong><span class="muted sl-sub">visitas a enlaces rotos (7 d)</span></div>';
    contar(document.getElementById('sl-k-vis'), s.visitas);
    contar(document.getElementById('sl-k-rap'), s.rapidas, '%');
    contar(document.getElementById('sl-k-err'), s.errores);
    contar(document.getElementById('sl-k-rot'), s.rotos);
  }

  var tabs = document.querySelectorAll('.sl-tabs button');
  tabs.forEach(function (b) {
    b.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      var cual = b.getAttribute('data-tab');
      cajaVel.style.display = cual === 'velocidad' ? '' : 'none';
      cajaErr.style.display = cual === 'errores' ? '' : 'none';
      cajaRot.style.display = cual === 'rotos' ? '' : 'none';
    });
  });

  function clase(m) {
    if (!m.n) return 'sin';
    var pct = m.bueno / m.n;
    return pct >= 0.75 ? '' : (pct >= 0.5 ? 'media' : 'mala');
  }

  function valorTxt(m) {
    if (!m.n) return 'sin datos';
    return (m.metrica === 'CLS' ? m.promedio.toFixed(3) : Math.round(m.promedio) + ' ms');
  }

  function pintarVelocidad(d) {
    var maximo = Math.max.apply(null, d.serie.map(function (p) { return p.n; }).concat([1]));
    cajaVel.innerHTML = '<div class="card">' +
      '<h3 style="margin:0 0 2px">Visitas medidas por día</h3>' +
      '<p class="muted" style="margin:0;font-size:.88rem">El color dice cómo cargó: verde si al menos 3 de cada 4 visitas fueron rápidas.</p>' +
      '<div class="sl-serie">' + d.serie.map(function (p) {
        var cls = !p.n ? 'vacia' : (p.bueno / p.n >= 0.75 ? '' : (p.bueno / p.n >= 0.5 ? 'media' : 'mala'));
        return '<div class="sl-barra ' + cls + '" data-alto="' + Math.round(p.n / maximo * 100) + '" style="height:3px" title="' + p.dia + ': ' + p.n + ' visitas">' + (p.n ? '<span>' + p.n + '</span>' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="sl-dias">' + d.serie.map(function (p) { return '<div>' + p.dia.slice(8) + '</div>'; }).join('') + '</div>' +
      '</div>' +
      '<div class="card" style="margin-top:18px"><h3 style="margin:0 0 8px">Las tres métricas de Google</h3>' +
      d.metricas.map(function (m) {
        return '<div class="sl-metrica"><span class="sl-punto ' + clase(m) + '"></span>' +
          '<span><strong>' + App.esc(m.nombre) + '</strong> <span class="muted">(' + m.metrica + ')</span><br>' +
          '<span class="muted" style="font-size:.82rem">' + (m.n ? m.bueno + ' bien · ' + m.mejorable + ' regular · ' + m.malo + ' mal' : 'todavía sin mediciones') + '</span></span>' +
          '<strong style="font-variant-numeric:tabular-nums">' + valorTxt(m) + '</strong></div>';
      }).join('') + '</div>' +
      '<div class="card" style="margin-top:18px"><h3 style="margin:0 0 8px">Páginas más lentas</h3>' +
      (d.paginas.length ? d.paginas.map(function (p) {
        return '<div class="sl-metrica"><span class="sl-punto ' + (p.promedio <= 2500 ? '' : (p.promedio <= 4000 ? 'media' : 'mala')) + '"></span>' +
          '<span class="sl-ruta">' + App.esc(p.ruta) + '<br><span class="muted" style="font-size:.8rem">' + p.n + ' visita(s) medidas</span></span>' +
          '<strong style="font-variant-numeric:tabular-nums">' + Math.round(p.promedio) + ' ms</strong></div>';
      }).join('') : '<p class="muted">Todavía no hay mediciones. Navegá el sitio en otra pestaña y volvé.</p>') +
      '</div>';

    var barras = cajaVel.querySelectorAll('.sl-barra');
    var anime = window.anime;
    function fijar() { barras.forEach(function (b) { b.style.height = Math.max(3, Number(b.getAttribute('data-alto'))) + '%'; }); }
    if (anime && anime.animate && !reduce && barras.length) {
      barras.forEach(function (b, i) {
        anime.animate(b, { height: ['3%', Math.max(3, Number(b.getAttribute('data-alto'))) + '%'], duration: 620, delay: i * 32, ease: 'outCubic' });
      });
      // Red de seguridad: deja las barras en su altura final aunque el loop esté pausado
      setTimeout(fijar, 620 + 32 * barras.length + 200);
    } else { fijar(); }
  }

  function pintarErrores() {
    cajaErr.innerHTML = (errores.length ? '' : '<p class="muted">Ningún error registrado. Es la mejor noticia posible de esta pantalla.</p>') +
      App.table(errores, [
        { label: 'Qué pasó', render: function (e) {
          return '<span class="sl-msg">' + App.esc(e.mensaje) + '</span>' +
            (e.archivo ? '<br><span class="muted" style="font-size:.78rem">' + App.esc(e.archivo) + (e.linea ? ':' + e.linea : '') + '</span>' : '');
        } },
        { label: 'Dónde', render: function (e) { return '<span class="sl-ruta">' + App.esc(e.ruta || '—') + '</span>'; } },
        { label: 'Veces', render: function (e) { return '<strong>' + (e.hits || 0) + '</strong><br><span class="muted" style="font-size:.75rem">' + (e.lastAt ? new Date(e.lastAt).toLocaleDateString('es-AR') : '') + '</span>'; } },
        { label: 'Acciones', render: function (e) {
          return '<button class="btn ghost" type="button" data-res="' + e.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (e.resuelto ? 'Reabrir' : 'Marcar resuelto') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + e.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
    cajaErr.querySelectorAll('tbody tr').forEach(function (tr, i) { if (errores[i] && errores[i].resuelto) tr.classList.add('sl-resuelto'); });
    cajaErr.querySelectorAll('[data-res]').forEach(function (b) { b.addEventListener('click', function () { resolverError(b.getAttribute('data-res')); }); });
    cajaErr.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrarError(b.getAttribute('data-del')); }); });
  }

  async function resolverError(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se marca el error como resuelto'); return; }
    var e = errores.filter(function (x) { return x.id === id; })[0];
    try {
      var upd = await App.api('/api/salud/errores/' + id, { method: 'PUT', body: { resuelto: !e.resuelto } });
      errores = errores.map(function (x) { return x.id === id ? upd : x; });
      pintarErrores();
      cargarStats();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function borrarError(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se borraría el error'); return; }
    if (!confirm('¿Borrar este error del listado? Si vuelve a pasar, se registra de nuevo.')) return;
    try {
      await App.api('/api/salud/errores/' + id, { method: 'DELETE' });
      errores = errores.filter(function (x) { return x.id !== id; });
      pintarErrores();
      cargarStats();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  function pintarRotos() {
    cajaRot.innerHTML = '<p class="muted" style="margin:0 0 14px">Direcciones a las que alguien intentó entrar y no existen. ' +
      (HAY_SEO ? 'Podés arreglarlas creando una redirección: la dirección vieja vuelve a funcionar y lleva a donde vos digas.' : 'Para que vuelvan a funcionar hace falta el módulo de SEO administrable, que gestiona las redirecciones.') + '</p>' +
      (rotos.length ? '' : '<p class="muted">Ningún enlace roto registrado.</p>') +
      App.table(rotos, [
        { label: 'Dirección', render: function (r) { return '<span class="sl-ruta">' + App.esc(r.ruta) + '</span>' + (r.resuelto ? ' <span class="muted" style="font-size:.75rem">· atendida</span>' : ''); } },
        { label: 'Quién enlaza', render: function (r) {
          return r.desde.slice(0, 3).map(function (d) { return App.esc(d.desde) + ' <span class="muted">(' + d.hits + ')</span>'; }).join('<br>');
        } },
        { label: 'Visitas', render: function (r) { return '<strong>' + r.hits + '</strong><br><span class="muted" style="font-size:.75rem">' + App.esc(r.ultimo) + '</span>'; } },
        { label: 'Acciones', render: function (r) {
          return (HAY_SEO ? '<button class="btn ghost" type="button" data-red="' + App.esc(r.ruta) + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Redirigir</button>' : '') +
            '<button class="btn ghost" type="button" data-ok="' + App.esc(r.ruta) + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.resuelto ? 'Reabrir' : 'Ya está') + '</button>';
        } },
      ]);
    cajaRot.querySelectorAll('[data-red]').forEach(function (b) { b.addEventListener('click', function () { redirigir(b.getAttribute('data-red')); }); });
    cajaRot.querySelectorAll('[data-ok]').forEach(function (b) { b.addEventListener('click', function () { atender(b.getAttribute('data-ok')); }); });
  }

  async function redirigir(ruta) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se crea la redirección'); return; }
    var destino = prompt('¿A dónde debería llevar ' + ruta + '?', '/index.html');
    if (!destino) return;
    try {
      await App.api('/api/salud/rotos/redirigir', { method: 'POST', body: { ruta: ruta, destino: destino } });
      App.toast('Listo: ' + ruta + ' ahora lleva a ' + destino);
      cargarRotos();
      cargarStats();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function atender(ruta) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se marca como atendida'); return; }
    var r = rotos.filter(function (x) { return x.ruta === ruta; })[0];
    try {
      await App.api('/api/salud/rotos', { method: 'PUT', body: { ruta: ruta, resuelto: !r.resuelto } });
      cargarRotos();
      cargarStats();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  function cargarStats() { App.api('/api/salud/stats').then(pintarStats).catch(function () {}); }
  function cargarRotos() { App.api('/api/salud/rotos').then(function (rows) { rotos = rows; pintarRotos(); }).catch(function () {}); }

  if (window.__PREVIEW__) {
    pintarStats({ visitas: 1284, rapidas: 82, errores: 2, rotos: 37 });
    pintarVelocidad({
      serie: [{ dia: '2026-07-16', n: 120, bueno: 101 }, { dia: '2026-07-17', n: 168, bueno: 140 }, { dia: '2026-07-18', n: 210, bueno: 118 }, { dia: '2026-07-19', n: 96, bueno: 88 }],
      metricas: [
        { metrica: 'LCP', nombre: 'Carga del contenido principal', n: 594, promedio: 2180, bueno: 480, mejorable: 90, malo: 24 },
        { metrica: 'CLS', nombre: 'Estabilidad visual', n: 594, promedio: 0.06, bueno: 540, mejorable: 44, malo: 10 },
        { metrica: 'INP', nombre: 'Respuesta a la interacción', n: 310, promedio: 168, bueno: 260, mejorable: 40, malo: 10 },
      ],
      paginas: [{ ruta: '/galeria.html', n: 88, promedio: 4310 }, { ruta: '/index.html', n: 402, promedio: 1980 }],
    });
    errores = [{ id: 'e1', mensaje: "Cannot read properties of null (reading 'addEventListener')", archivo: '/js/app.js', linea: 412, ruta: '/contacto.html', hits: 37, lastAt: new Date().toISOString(), resuelto: false }];
    rotos = [{ ruta: '/promo-2024.html', hits: 37, ultimo: '2026-07-20', resuelto: false, desde: [{ desde: 'google.com', hits: 30 }, { desde: 'directo', hits: 7 }] }];
    pintarErrores();
    pintarRotos();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargarStats();
    App.api('/api/salud/velocidad').then(pintarVelocidad).catch(function (err) { cajaVel.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    App.api('/api/salud/errores').then(function (rows) { errores = rows; pintarErrores(); }).catch(function () {});
    cargarRotos();
  }
})();`,
  readmeNotes: (cfg) => [
    `**Salud del sitio**: en \`/salud-admin.html\` tenés tres cosas que normalmente hay que contratar aparte. **Velocidad**: las Core Web Vitals (LCP, CLS, INP) medidas en el navegador de cada visita real —son las mismas métricas con las que Google decide el posicionamiento— con la lista de páginas más lentas para saber por dónde empezar. **Errores**: cuando a un visitante se le rompe algo en JavaScript queda registrado con el mensaje, el archivo y la línea, agrupado por error (uno que le pasa a 400 personas es una fila con 400 usos, no 400 filas); si un error marcado como resuelto vuelve a pasar, se reabre solo. **Enlaces rotos**: el servidor cuenta cada 404 real con el dominio de quien enlazó${cfg.moduleIds.includes('seoadmin') ? ', y el botón "Redirigir" le crea la redirección 301 ahí mismo — el circuito completo sin salir del panel' : ' (con el módulo SEO administrable podés redirigirlos desde el mismo panel)'}.
  Las mediciones **no guardan IP, ni user-agent, ni identificador de visitante**: solo el día, la ruta y el número${cfg.moduleIds.includes('privacidad') ? ', y no se manda nada si la persona rechazó el almacenamiento en el centro de privacidad' : ''}. Los datos aparecen a medida que la gente navega: si recién publicaste, el panel va a estar vacío un rato.`,
  ],
};
