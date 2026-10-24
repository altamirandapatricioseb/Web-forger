// SEO administrable con backend real: el título y la descripción que Google muestra dejan de estar
// horneados en el HTML y pasan a ser un dato que el dueño edita desde /seo-admin.html. Hasta ahora
// el módulo UI `seo` escribía las metas UNA VEZ al generar el proyecto: cambiar el título de la Home
// obligaba a volver al Builder y reexportar todo el sitio, que es exactamente lo que un cliente no
// puede hacer. Acá el cambio es un MIDDLEWARE de Express montado antes de los estáticos: intercepta
// cada página HTML, le reescribe el <head> con las metas vigentes y la sirve. El navegador y el
// buscador reciben el HTML ya corregido — no es JavaScript pintando el título después de cargar,
// que es lo que ningún robot espera.
// Además resuelve las otras dos cosas que se piden siempre al mudar o rehacer un sitio: las
// REDIRECCIONES 301 (la dirección vieja que quedó en Google o impresa en un folleto sigue llevando
// a la nueva, conservando el posicionamiento) y el robots.txt editable sin tocar archivos.
// Animado con Anime.js (count-up de KPIs, entrada escalonada de las fichas) + red de seguridad.
// Requiere auth: es una herramienta de la trastienda.

module.exports = {
  id: 'seoadmin', type: 'functional', name: 'SEO administrable',
  description: 'Título, descripción, imagen para compartir y canonical de cada página, editables desde el panel y aplicados por un middleware que reescribe el <head> del HTML antes de servirlo (no por JavaScript en el navegador: el buscador recibe el HTML ya corregido). Incluye redirecciones 301/302 con contador de usos —la dirección vieja sigue funcionando— y robots.txt editable sin tocar archivos. Panel /seo-admin.html con vista previa del resultado en Google. Requiere auth. Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/seo', file: 'routes/seoadmin.js' }],
  middlewares: [{ file: 'src/middleware/seoadmin.js' }],
  collections: ['seopages', 'seoredirects', 'seoconfig'],
  nav: () => [{ label: 'SEO (admin)', href: '/seo-admin.html', id: 'nav-seo-admin' }],
  head: () => `  <style>
    .seo-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:22px 0}
    .seo-kpis .card{text-align:center}
    .seo-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .seo-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 18px}
    .seo-tabs button{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:7px 16px;cursor:pointer;font:inherit;font-size:.9rem;color:inherit}
    .seo-tabs button.on{background:var(--accent);border-color:var(--accent);color:#fff}
    .seo-fila{border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;margin-bottom:12px;background:var(--surface)}
    .seo-fila header{display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer}
    .seo-ruta{font-family:ui-monospace,'Cascadia Code','Courier New',monospace;font-size:.86rem;word-break:break-all}
    .seo-tag{display:inline-block;font-size:.7rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .seo-tag.ok{background:#2e9e5b20;color:#1d6b3c}
    .seo-tag.pend{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .seo-tag.no{background:#c0392b1a;color:#c0392b}
    .seo-cuerpo{display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--line)}
    .seo-fila.abierta .seo-cuerpo{display:block}
    .seo-serp{border:1px solid var(--line);border-radius:8px;padding:14px 16px;background:var(--bg);margin-top:14px}
    .seo-serp .u{font-size:.78rem;color:#3d6b2f;word-break:break-all}
    .seo-serp .t{color:#1a0dab;font-size:1.05rem;line-height:1.3;margin:2px 0 3px}
    .seo-serp .d{font-size:.85rem;color:var(--muted);line-height:1.45}
    .seo-cont{font-size:.75rem;color:var(--muted);text-align:right}
    .seo-cont.largo{color:#c0392b;font-weight:700}
  </style>`,
  files: (cfg, ctx = { pages: [] }) => {
    // Las páginas del sitio se conocen AL GENERAR (ctx.pages trae todas, incluidas las de los
    // módulos activos): se hornean acá y el servidor siembra su ficha la primera vez. Así el panel
    // no arranca vacío ni obliga a cargar las rutas a mano.
    const paginas = ['index.html', ...ctx.pages.filter(p => p !== 'index.html')];
    // Las páginas de trastienda arrancan con noindex: que Google indexe el login de un cliente es
    // un error clásico y silencioso.
    const esInterna = (p) => /-admin\.html$/.test(p) || p === 'auth.html' || p === 'login.html' || p === 'registro.html';
    const seed = paginas.map(p => ({ ruta: '/' + p, noindex: esInterna(p), interna: esInterna(p) }));
    const DOMINIO = cfg.brand.domain || '';
    return {
      // Middleware: la pieza central del módulo. Corre antes de express.static, así que puede
      // reescribir el HTML que se va a servir y responder las redirecciones ANTES que los archivos.
      'src/middleware/seoadmin.js': `/**
 * Middleware de SEO administrable. Montado ANTES de express.static (ver src/app.js) para poder:
 *   1. resolver las redirecciones 301/302 antes de que el 404 se lleve el pedido,
 *   2. servir el robots.txt vigente de la base en vez del archivo estático,
 *   3. reescribir el <head> de cada página HTML con las metas que el dueño editó.
 *
 * Por qué reescribir en el servidor y no pintar con JavaScript: el buscador (y el previsualizador
 * de WhatsApp, y el de LinkedIn) leen el HTML tal como llega. Un título puesto por JS después de
 * cargar la página no lo ve ninguno de los tres.
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

const PUBLICO = path.join(__dirname, '..', '..', 'public');
const DOMINIO = ${JSON.stringify(DOMINIO)};

// Caché de las fichas: el driver JSON lee del disco en cada consulta y acá pasan TODAS las visitas
// del sitio. Cinco segundos alcanzan para que el panel se sienta inmediato sin releer por request;
// además routes/seoadmin.js llama a invalidar() apenas guarda algo, así el cambio se ve al toque.
let cache = null;
let cacheHasta = 0;
async function datos() {
  const ahora = Date.now();
  if (cache && ahora < cacheHasta) return cache;
  cache = {
    pages: await db.all('seopages'),
    redirects: await db.all('seoredirects'),
    config: (await db.all('seoconfig'))[0] || null,
  };
  cacheHasta = ahora + 5000;
  return cache;
}

// Caché del HTML original de cada página: son archivos estáticos que no cambian mientras el
// servidor vive, así que se leen una sola vez y después se reescribe sobre la copia en memoria.
const original = new Map();
function leerPagina(archivo) {
  if (original.has(archivo)) return original.get(archivo);
  let html = null;
  try {
    const abs = path.join(PUBLICO, archivo);
    // Defensa de recorrido de directorio: solo se sirve lo que está adentro de public/
    if (abs.startsWith(PUBLICO) && fs.existsSync(abs)) html = fs.readFileSync(abs, 'utf8');
  } catch { html = null; }
  original.set(archivo, html);
  return html;
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Dirección pública real del sitio (detrás de un proxy el host viaja en x-forwarded-*)
function origenDe(req) {
  if (DOMINIO) return DOMINIO;
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
  return proto + '://' + host;
}

// Qué archivo de public/ corresponde a la ruta pedida ('/' → index.html). Solo páginas: los
// assets (css, js, imágenes) se dejan pasar sin tocar.
function archivoDe(p) {
  if (p === '/' || p === '') return 'index.html';
  if (!p.endsWith('.html')) return null;
  const limpio = p.replace(/^\\/+/, '');
  if (limpio.includes('..')) return null;
  return limpio;
}

// Se quitan SOLO las metas que administra este módulo (las que emite el módulo seo al generar):
// el resto del <head> —fuente, hojas de estilo, JSON-LD, favicon— queda intacto.
const ADMINISTRADAS = [
  /[ \\t]*<meta\\s+name=["']description["'][^>]*>\\n?/gi,
  /[ \\t]*<meta\\s+name=["']robots["'][^>]*>\\n?/gi,
  /[ \\t]*<meta\\s+property=["']og:(?:title|description|url|image|type)["'][^>]*>\\n?/gi,
  /[ \\t]*<meta\\s+name=["']twitter:(?:card|title|description|image)["'][^>]*>\\n?/gi,
  /[ \\t]*<link\\s+rel=["']canonical["'][^>]*>\\n?/gi,
];

function reescribir(html, ficha, cfgSeo, url) {
  const titulo = (ficha && ficha.title) || '';
  const desc = (ficha && ficha.description) || (cfgSeo && cfgSeo.description) || '';
  const img = (ficha && ficha.image) || (cfgSeo && cfgSeo.image) || '';
  const noindex = !!(ficha && ficha.noindex);
  // Sin nada cargado y sin noindex no hay motivo para tocar el HTML: se sirve el original
  if (!titulo && !desc && !img && !noindex) return null;

  let salida = html;
  for (const re of ADMINISTRADAS) salida = salida.replace(re, '');

  // El título de la pestaña: si el dueño cargó uno, manda el suyo tal cual (los títulos de
  // buscador se escriben completos, con la marca donde el dueño quiera, no siempre al final).
  const tituloFinal = titulo || (salida.match(/<title>([\\s\\S]*?)<\\/title>/i) || [, ''])[1];
  if (titulo) salida = salida.replace(/<title>[\\s\\S]*?<\\/title>/i, '<title>' + esc(titulo) + '</title>');

  const metas = [
    desc ? '  <meta name="description" content="' + esc(desc) + '">' : '',
    noindex ? '  <meta name="robots" content="noindex,nofollow">' : '',
    '  <link rel="canonical" href="' + esc(url) + '">',
    '  <meta property="og:type" content="website">',
    '  <meta property="og:title" content="' + esc(tituloFinal) + '">',
    desc ? '  <meta property="og:description" content="' + esc(desc) + '">' : '',
    '  <meta property="og:url" content="' + esc(url) + '">',
    img ? '  <meta property="og:image" content="' + esc(img) + '">' : '',
    '  <meta name="twitter:card" content="' + (img ? 'summary_large_image' : 'summary') + '">',
    img ? '  <meta name="twitter:image" content="' + esc(img) + '">' : '',
  ].filter(Boolean).join('\\n');

  // Van justo después del </title>: es el lugar donde cualquiera los busca al ver el código
  return salida.replace(/<\\/title>/i, '</title>\\n' + metas);
}

async function middlewareSeo(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const p = req.path;
  if (p.startsWith('/api/')) return next();

  let d;
  try { d = await datos(); } catch { return next(); }

  // 1. Redirecciones: lo primero, porque la dirección vieja puede coincidir con un archivo que ya
  // no queremos servir. Comparación sin distinguir mayúsculas ni barra final.
  const desde = p.toLowerCase().replace(/\\/+$/, '') || '/';
  const redir = d.redirects.find(r => r.active !== false && String(r.from || '').toLowerCase().replace(/\\/+$/, '') === desde);
  if (redir) {
    let destino = redir.to;
    // Los parámetros del pedido viajan al destino: una campaña vieja con ?utm_source=… no se pierde
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?') + 1) : '';
    if (query && redir.keepQuery !== false) destino += (destino.includes('?') ? '&' : '?') + query;
    res.redirect(redir.code === 302 ? 302 : 301, destino);
    // El contador va después de responder: quien navega nunca espera por la estadística
    Promise.resolve(db.update('seoredirects', redir.id, {
      hits: (redir.hits || 0) + 1, lastHitAt: new Date().toISOString(),
    })).then(invalidar, () => {});
    return;
  }

  // 2. robots.txt vigente (el archivo estático del módulo seo queda como respaldo si no hay ficha)
  if (p === '/robots.txt' && d.config && d.config.robots) {
    return res.type('text/plain').send(d.config.robots);
  }

  // 3. Páginas HTML: se reescribe el <head> con las metas cargadas
  const archivo = archivoDe(p);
  if (!archivo) return next();
  const html = leerPagina(archivo);
  if (html == null) return next();

  const ficha = d.pages.find(f => f.ruta === '/' + archivo);
  const url = origenDe(req) + (archivo === 'index.html' ? '/' : '/' + archivo);
  let salida = null;
  try { salida = reescribir(html, ficha, d.config, url); } catch { salida = null; }
  if (salida == null) return next();
  res.type('html').send(salida);
}

// La invalidación explícita la llama routes/seoadmin.js después de guardar: sin esto el panel
// mostraría el cambio guardado pero el sitio seguiría sirviendo lo viejo hasta 5 segundos.
function invalidar() { cache = null; cacheHasta = 0; }

module.exports = middlewareSeo;
module.exports.invalidar = invalidar;
`,

      'routes/seoadmin.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');
const { invalidar } = require('../src/middleware/seoadmin');

// Páginas del sitio horneadas al generar el proyecto: el panel arranca con todas cargadas
const PAGINAS = ${JSON.stringify(seed, null, 2).replace(/\n/g, '\n')};
const DOMINIO = ${JSON.stringify(DOMINIO)};

const ROBOTS_INICIAL = '# Permitir el rastreo de todo el sitio\\nUser-agent: *\\nAllow: /\\n' +
  (DOMINIO ? '\\nSitemap: ' + DOMINIO + '/sitemap.xml\\n' : '');

// Ficha global: descripción e imagen por defecto para las páginas que no tienen la suya
async function config() {
  const rows = await db.all('seoconfig');
  if (rows.length) return rows[0];
  return db.insert('seoconfig', { description: '', image: '', robots: ROBOTS_INICIAL });
}

// Se siembran las páginas conocidas al generar y se agregan las que falten (un proyecto que
// creció con módulos nuevos suma sus páginas la próxima vez que se abre el panel)
async function paginas() {
  const actuales = await db.all('seopages');
  const porRuta = new Map(actuales.map(p => [p.ruta, p]));
  for (const p of PAGINAS) {
    if (porRuta.has(p.ruta)) continue;
    const nueva = await db.insert('seopages', { ...p, title: '', description: '', image: '' });
    porRuta.set(p.ruta, nueva);
  }
  // Orden estable: primero la Home, después las públicas y al final las de trastienda
  return [...porRuta.values()].sort((a, b) => {
    if (a.ruta === '/index.html') return -1;
    if (b.ruta === '/index.html') return 1;
    if (!!a.interna !== !!b.interna) return a.interna ? 1 : -1;
    return a.ruta.localeCompare(b.ruta);
  });
}

// Una ruta de redirección válida: interna, empieza con barra y sin espacios
const rutaOk = (v) => typeof v === 'string' && /^\\/[^\\s]{0,200}$/.test(v.trim());
// El destino puede ser interno o una dirección http(s) completa (una mudanza de dominio es
// exactamente para lo que se inventaron las 301)
function destinoOk(v) {
  if (typeof v !== 'string' || !v.trim()) return false;
  const t = v.trim();
  if (t.startsWith('/')) return /^\\/[^\\s]{0,300}$/.test(t);
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

// GET /api/seo — páginas, redirecciones y ficha global (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  res.json({
    pages: await paginas(),
    redirects: (await db.all('seoredirects')).slice().reverse(),
    config: await config(),
  });
});

// GET /api/seo/stats — KPIs del panel (solo admin)
router.get('/stats', requireAdmin, async (req, res) => {
  const ps = await paginas();
  const rs = await db.all('seoredirects');
  const publicas = ps.filter(p => !p.noindex);
  res.json({
    paginas: ps.length,
    completas: publicas.filter(p => str(p.title, 1, 200) && str(p.description, 1, 400)).length,
    publicas: publicas.length,
    redirecciones: rs.filter(r => r.active !== false).length,
    usos: rs.reduce((a, r) => a + (r.hits || 0), 0),
  });
});

// PUT /api/seo/config — descripción e imagen por defecto y robots.txt (solo admin)
router.put('/config', requireAdmin, async (req, res) => {
  const c = await config();
  const patch = {};
  if (req.body.description !== undefined) {
    if (req.body.description && !str(req.body.description, 0, 400)) return res.status(422).json({ error: 'La descripción por defecto no puede pasar de 400 caracteres' });
    patch.description = String(req.body.description || '').trim();
  }
  if (req.body.image !== undefined) {
    const img = String(req.body.image || '').trim();
    // Solo http/https: una "imagen" javascript: en una meta es un vector de ataque gratis
    if (img && !/^https?:\\/\\//i.test(img)) return res.status(422).json({ error: 'La imagen tiene que ser una dirección http:// o https://' });
    patch.image = img;
  }
  if (req.body.robots !== undefined) {
    if (!str(req.body.robots, 1, 4000)) return res.status(422).json({ error: 'El robots.txt no puede estar vacío (ni pasar de 4000 caracteres)' });
    patch.robots = String(req.body.robots);
  }
  const out = await db.update('seoconfig', c.id, patch);
  invalidar();
  res.json(out);
});

// POST /api/seo/redirecciones — nueva redirección (solo admin)
router.post('/redirecciones', requireAdmin, async (req, res) => {
  const from = String(req.body.from || '').trim();
  const to = String(req.body.to || '').trim();
  if (!rutaOk(from)) return res.status(422).json({ error: 'La dirección vieja tiene que empezar con / (por ejemplo /promo-2024.html)' });
  if (!destinoOk(to)) return res.status(422).json({ error: 'El destino tiene que ser una ruta interna (/algo.html) o una dirección http:// o https://' });
  // Una redirección a sí misma es un bucle infinito servido con una sonrisa
  if (from.toLowerCase().replace(/\\/+$/, '') === to.toLowerCase().replace(/\\/+$/, '')) {
    return res.status(422).json({ error: 'El origen y el destino no pueden ser la misma dirección' });
  }
  if ((await db.find('seoredirects', r => String(r.from).toLowerCase() === from.toLowerCase())).length) {
    return res.status(409).json({ error: 'Ya hay una redirección para esa dirección' });
  }
  const fila = await db.insert('seoredirects', {
    from, to,
    code: req.body.code === 302 ? 302 : 301,
    keepQuery: req.body.keepQuery !== false,
    active: true, hits: 0, lastHitAt: '',
  });
  invalidar();
  res.status(201).json(fila);
});

// PUT /api/seo/redirecciones/:id — pausar, reactivar o cambiar el destino (solo admin)
router.put('/redirecciones/:id', requireAdmin, async (req, res) => {
  const r = await db.get('seoredirects', req.params.id);
  if (!r) return res.status(404).json({ error: 'Redirección inexistente' });
  const patch = {};
  if (req.body.to !== undefined) {
    if (!destinoOk(req.body.to)) return res.status(422).json({ error: 'El destino tiene que ser una ruta interna (/algo.html) o una dirección http:// o https://' });
    patch.to = String(req.body.to).trim();
  }
  if (req.body.code !== undefined) patch.code = req.body.code === 302 ? 302 : 301;
  if (req.body.active !== undefined) patch.active = !!req.body.active;
  if (req.body.keepQuery !== undefined) patch.keepQuery = !!req.body.keepQuery;
  const out = await db.update('seoredirects', r.id, patch);
  invalidar();
  res.json(out);
});

// DELETE /api/seo/redirecciones/:id (solo admin)
router.delete('/redirecciones/:id', requireAdmin, async (req, res) => {
  const r = await db.get('seoredirects', req.params.id);
  if (!r) return res.status(404).json({ error: 'Redirección inexistente' });
  await db.remove('seoredirects', r.id);
  invalidar();
  res.json({ ok: true });
});

// PUT /api/seo/paginas/:id — metas de una página (solo admin). Va al final para no tapar nada.
router.put('/paginas/:id', requireAdmin, async (req, res) => {
  const p = await db.get('seopages', req.params.id);
  if (!p) return res.status(404).json({ error: 'Página inexistente' });
  const patch = {};
  if (req.body.title !== undefined) {
    if (req.body.title && !str(req.body.title, 0, 200)) return res.status(422).json({ error: 'El título no puede pasar de 200 caracteres' });
    patch.title = String(req.body.title || '').trim();
  }
  if (req.body.description !== undefined) {
    if (req.body.description && !str(req.body.description, 0, 400)) return res.status(422).json({ error: 'La descripción no puede pasar de 400 caracteres' });
    patch.description = String(req.body.description || '').trim();
  }
  if (req.body.image !== undefined) {
    const img = String(req.body.image || '').trim();
    if (img && !/^https?:\\/\\//i.test(img)) return res.status(422).json({ error: 'La imagen tiene que ser una dirección http:// o https://' });
    patch.image = img;
  }
  if (req.body.noindex !== undefined) patch.noindex = !!req.body.noindex;
  const out = await db.update('seopages', p.id, patch);
  invalidar();
  res.json(out);
});

module.exports = router;
`,
    };
  },
  pages: () => ({
    'seo-admin': {
      title: 'SEO',
      html: `  <section>
    <div class="container" style="max-width:1000px">
      <h2>SEO del sitio</h2>
      <p class="section-sub">Cómo aparece cada página en Google y al compartirla por WhatsApp. Lo que guardes acá se aplica al instante: el servidor reescribe el encabezado de la página antes de mandarla, sin volver a exportar el sitio. Solo visible para administradores.</p>
      <div class="seo-kpis" id="seo-kpis"></div>
      <div class="seo-tabs">
        <button type="button" data-tab="paginas" class="on">Páginas</button>
        <button type="button" data-tab="redirecciones">Redirecciones</button>
        <button type="button" data-tab="general">General y robots.txt</button>
      </div>
      <div id="seo-paginas"><p class="muted">Cargando…</p></div>
      <div id="seo-redirecciones" style="display:none">
        <form id="seo-redir-form" class="card">
          <h3 style="margin-top:0">Nueva redirección</h3>
          <p class="muted" style="margin:0 0 14px;font-size:.9rem">Para cuando una dirección deja de existir: la vieja sigue funcionando y lleva a la nueva, así no perdés lo que ya está en Google ni los enlaces impresos.</p>
          <div class="grid cols-2" style="gap:14px">
            <div><label>Dirección vieja</label><input name="from" required placeholder="/promo-2024.html"></div>
            <div><label>Destino</label><input name="to" required placeholder="/promociones.html"></div>
          </div>
          <div class="grid cols-2" style="gap:14px">
            <div>
              <label>Tipo</label>
              <select name="code">
                <option value="301">Permanente (301) — recomendada</option>
                <option value="302">Temporal (302)</option>
              </select>
            </div>
            <div style="display:flex;align-items:flex-end;padding-bottom:10px">
              <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" name="keepQuery" checked style="width:auto"> Llevar los parámetros al destino</label>
            </div>
          </div>
          <button class="btn" type="submit" style="margin-top:14px">Crear redirección</button>
        </form>
        <div id="seo-redir-lista" style="margin-top:22px"></div>
      </div>
      <div id="seo-general" style="display:none">
        <form id="seo-cfg-form" class="card">
          <h3 style="margin-top:0">Valores por defecto</h3>
          <p class="muted" style="margin:0 0 14px;font-size:.9rem">Se usan en las páginas que no tienen su propia descripción o imagen cargada.</p>
          <label>Descripción por defecto</label>
          <textarea name="description" rows="2" maxlength="400" placeholder="Qué hace tu negocio, en una frase."></textarea>
          <label>Imagen para compartir (URL)</label>
          <input name="image" type="url" placeholder="https://midominio.com/portada.jpg">
          <label style="margin-top:14px">robots.txt</label>
          <textarea name="robots" rows="7" maxlength="4000" style="font-family:ui-monospace,'Cascadia Code','Courier New',monospace;font-size:.85rem"></textarea>
          <p class="muted" style="font-size:.82rem;margin:6px 0 0">Se sirve en <code>/robots.txt</code>. Si no sabés qué poner, dejalo como está: le dice a los buscadores que pueden recorrer todo el sitio.</p>
          <button class="btn" type="submit" style="margin-top:16px">Guardar</button>
        </form>
      </div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo SEO administrable: panel solo-admin en /seo-admin.html (metas por página con vista
   previa del resultado en Google, redirecciones 301/302 con sus usos, robots.txt editable).
   Animado con Anime.js (count-up de KPIs, entrada escalonada de las fichas) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var navSeo = document.getElementById('nav-seo-admin');
  if (navSeo && (!me || me.role !== 'admin') && !window.__PREVIEW__) navSeo.style.display = 'none';

  var kpis = document.getElementById('seo-kpis');
  if (!kpis) return;
  var cajaPaginas = document.getElementById('seo-paginas');
  var cajaRedir = document.getElementById('seo-redir-lista');
  var formRedir = document.getElementById('seo-redir-form');
  var formCfg = document.getElementById('seo-cfg-form');
  var paginas = [], redirs = [], cfg = {};

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = Number(hasta).toLocaleString('es-AR'); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR'); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = Number(hasta).toLocaleString('es-AR'); }, 800);
  }

  function pintarStats(s) {
    kpis.innerHTML = '<div class="card"><strong id="seo-k-pag">0</strong><span class="muted">páginas</span></div>' +
      '<div class="card"><strong id="seo-k-com">0</strong><span class="muted">con SEO completo</span></div>' +
      '<div class="card"><strong id="seo-k-red">0</strong><span class="muted">redirecciones activas</span></div>' +
      '<div class="card"><strong id="seo-k-uso">0</strong><span class="muted">visitas rescatadas</span></div>';
    contar(document.getElementById('seo-k-pag'), s.paginas);
    contar(document.getElementById('seo-k-com'), s.completas);
    contar(document.getElementById('seo-k-red'), s.redirecciones);
    contar(document.getElementById('seo-k-uso'), s.usos);
  }

  // Pestañas del panel
  var tabs = document.querySelectorAll('.seo-tabs button');
  tabs.forEach(function (b) {
    b.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      var cual = b.getAttribute('data-tab');
      document.getElementById('seo-paginas').style.display = cual === 'paginas' ? '' : 'none';
      document.getElementById('seo-redirecciones').style.display = cual === 'redirecciones' ? '' : 'none';
      document.getElementById('seo-general').style.display = cual === 'general' ? '' : 'none';
    });
  });

  function estado(p) {
    if (p.noindex) return '<span class="seo-tag no">sin indexar</span>';
    if (p.title && p.description) return '<span class="seo-tag ok">completo</span>';
    return '<span class="seo-tag pend">a medias</span>';
  }

  // Vista previa del resultado en Google: es la forma más rápida de que alguien entienda para
  // qué sirve el título y por qué conviene que entre en el largo recomendado.
  function serp(p) {
    var t = p.title || ('(el título actual de la página)');
    var d = p.description || cfg.description || '(sin descripción: Google va a inventar una con el texto de la página)';
    return '<div class="seo-serp"><div class="u">' + App.esc(location.origin + p.ruta) + '</div>' +
      '<div class="t">' + App.esc(t.slice(0, 65)) + (t.length > 65 ? '…' : '') + '</div>' +
      '<div class="d">' + App.esc(d.slice(0, 160)) + (d.length > 160 ? '…' : '') + '</div></div>';
  }

  function pintarPaginas() {
    cajaPaginas.innerHTML = paginas.map(function (p) {
      return '<div class="seo-fila" data-id="' + p.id + '">' +
        '<header data-abrir="' + p.id + '"><div><span class="seo-ruta">' + App.esc(p.ruta) + '</span>' +
        (p.interna ? ' <span class="muted" style="font-size:.75rem">· trastienda</span>' : '') +
        '<br><span class="muted" style="font-size:.85rem">' + App.esc(p.title || 'sin título propio') + '</span></div>' +
        '<div>' + estado(p) + '</div></header>' +
        '<div class="seo-cuerpo">' +
        '<label>Título en el buscador</label><input data-c="title" value="' + App.esc(p.title || '') + '" maxlength="200" placeholder="Nombre del negocio · qué ofrece">' +
        '<div class="seo-cont" data-cont="title">0 / 60</div>' +
        '<label>Descripción</label><textarea data-c="description" rows="2" maxlength="400" placeholder="La frase que aparece debajo del título en Google.">' + App.esc(p.description || '') + '</textarea>' +
        '<div class="seo-cont" data-cont="description">0 / 155</div>' +
        '<label>Imagen al compartir (URL)</label><input data-c="image" value="' + App.esc(p.image || '') + '" placeholder="https://midominio.com/portada.jpg">' +
        '<label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:12px"><input type="checkbox" data-c="noindex" ' + (p.noindex ? 'checked' : '') + ' style="width:auto"> Pedirle a los buscadores que NO indexen esta página</label>' +
        serp(p) +
        '<button class="btn" type="button" data-guardar="' + p.id + '" style="margin-top:14px">Guardar</button>' +
        '</div></div>';
    }).join('');

    cajaPaginas.querySelectorAll('[data-abrir]').forEach(function (h) {
      h.addEventListener('click', function () { h.parentNode.classList.toggle('abierta'); });
    });
    cajaPaginas.querySelectorAll('.seo-fila').forEach(function (fila) {
      // Contador de caracteres con el largo recomendado por Google (60 título / 155 descripción)
      [['title', 60], ['description', 155]].forEach(function (par) {
        var campo = fila.querySelector('[data-c="' + par[0] + '"]');
        var cont = fila.querySelector('[data-cont="' + par[0] + '"]');
        function refrescar() {
          cont.textContent = campo.value.length + ' / ' + par[1];
          cont.classList.toggle('largo', campo.value.length > par[1]);
        }
        campo.addEventListener('input', refrescar);
        refrescar();
      });
    });
    cajaPaginas.querySelectorAll('[data-guardar]').forEach(function (b) {
      b.addEventListener('click', function () { guardarPagina(b.getAttribute('data-guardar')); });
    });

    // Entrada escalonada de las fichas
    var filas = cajaPaginas.querySelectorAll('.seo-fila');
    var anime = window.anime;
    function fijar() { filas.forEach(function (f) { f.style.opacity = 1; f.style.transform = 'none'; }); }
    if (anime && anime.animate && !reduce && filas.length) {
      anime.animate(filas, { opacity: [0, 1], translateY: [10, 0], duration: 420, delay: anime.stagger ? anime.stagger(28) : 0, ease: 'outCubic' });
      // Red de seguridad: deja las fichas visibles aunque el loop esté pausado
      setTimeout(fijar, 420 + 28 * filas.length + 200);
    } else {
      fijar();
    }
  }

  async function guardarPagina(id) {
    var fila = cajaPaginas.querySelector('.seo-fila[data-id="' + id + '"]');
    var cuerpo = {
      title: fila.querySelector('[data-c="title"]').value,
      description: fila.querySelector('[data-c="description"]').value,
      image: fila.querySelector('[data-c="image"]').value,
      noindex: fila.querySelector('[data-c="noindex"]').checked,
    };
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se guardan las metas de la página'); return; }
    try {
      var upd = await App.api('/api/seo/paginas/' + id, { method: 'PUT', body: cuerpo });
      paginas = paginas.map(function (x) { return x.id === id ? upd : x; });
      pintarPaginas();
      cargarStats();
      App.toast('Listo: la página ya se sirve con estas metas');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  function pintarRedirs() {
    cajaRedir.innerHTML = App.table(redirs, [
      { label: 'Dirección vieja', render: function (r) { return '<span class="seo-ruta">' + App.esc(r.from) + '</span>'; } },
      { label: 'Lleva a', render: function (r) { return '<span class="seo-ruta">' + App.esc(r.to) + '</span>'; } },
      { label: 'Tipo', render: function (r) { return (r.code === 302 ? '302 temporal' : '301 permanente') + (r.active === false ? ' <span class="seo-tag pend">pausada</span>' : ''); } },
      { label: 'Usos', render: function (r) { return '<strong>' + (r.hits || 0) + '</strong>'; } },
      { label: 'Acciones', render: function (r) {
        return '<button class="btn ghost" type="button" data-tog="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.active === false ? 'Reactivar' : 'Pausar') + '</button>' +
          '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
      } },
    ]);
    cajaRedir.querySelectorAll('[data-tog]').forEach(function (b) { b.addEventListener('click', function () { alternar(b.getAttribute('data-tog')); }); });
    cajaRedir.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
  }

  async function alternar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se pausa la redirección'); return; }
    var r = redirs.filter(function (x) { return x.id === id; })[0];
    try {
      var upd = await App.api('/api/seo/redirecciones/' + id, { method: 'PUT', body: { active: r.active === false } });
      redirs = redirs.map(function (x) { return x.id === id ? upd : x; });
      pintarRedirs();
      cargarStats();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function borrar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se borraría la redirección'); return; }
    if (!confirm('¿Borrar esta redirección? La dirección vieja va a empezar a dar error 404.')) return;
    try {
      await App.api('/api/seo/redirecciones/' + id, { method: 'DELETE' });
      redirs = redirs.filter(function (x) { return x.id !== id; });
      pintarRedirs();
      cargarStats();
      App.toast('Redirección borrada');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  formRedir.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se crea la redirección'); return; }
    try {
      var nueva = await App.api('/api/seo/redirecciones', { method: 'POST', body: {
        from: formRedir.querySelector('[name="from"]').value,
        to: formRedir.querySelector('[name="to"]').value,
        code: Number(formRedir.querySelector('[name="code"]').value),
        keepQuery: formRedir.querySelector('[name="keepQuery"]').checked,
      } });
      formRedir.reset();
      redirs = [nueva].concat(redirs);
      pintarRedirs();
      cargarStats();
      App.toast('Redirección creada: ya está funcionando');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  formCfg.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se guardan los valores por defecto'); return; }
    try {
      cfg = await App.api('/api/seo/config', { method: 'PUT', body: {
        description: formCfg.querySelector('[name="description"]').value,
        image: formCfg.querySelector('[name="image"]').value,
        robots: formCfg.querySelector('[name="robots"]').value,
      } });
      pintarPaginas();
      App.toast('Guardado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  function pintarCfg() {
    formCfg.querySelector('[name="description"]').value = cfg.description || '';
    formCfg.querySelector('[name="image"]').value = cfg.image || '';
    formCfg.querySelector('[name="robots"]').value = cfg.robots || '';
  }

  function cargarStats() { App.api('/api/seo/stats').then(pintarStats).catch(function () {}); }

  if (window.__PREVIEW__) {
    pintarStats({ paginas: 9, completas: 5, redirecciones: 2, usos: 143 });
    paginas = [
      { id: 'd1', ruta: '/index.html', title: 'Mi Empresa · Soluciones que impulsan tu negocio', description: 'Todo lo que necesitás para crecer, en un solo lugar.', image: '', noindex: false },
      { id: 'd2', ruta: '/servicios.html', title: '', description: '', image: '', noindex: false },
      { id: 'd3', ruta: '/seo-admin.html', title: '', description: '', image: '', noindex: true, interna: true },
    ];
    redirs = [{ id: 'r1', from: '/promo-2024.html', to: '/promociones.html', code: 301, hits: 118, active: true }];
    cfg = { description: 'Todo lo que necesitás para crecer, en un solo lugar.', image: '', robots: 'User-agent: *\\nAllow: /' };
    pintarPaginas();
    pintarRedirs();
    pintarCfg();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargarStats();
    App.api('/api/seo').then(function (d) {
      paginas = d.pages; redirs = d.redirects; cfg = d.config || {};
      pintarPaginas(); pintarRedirs(); pintarCfg();
    }).catch(function (err) { cajaPaginas.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
  }
})();`,
  readmeNotes: (cfg) => [
    `**SEO administrable**: entrá a \`/seo-admin.html\` y cargá el **título** y la **descripción** de cada página. No hace falta volver a exportar el sitio: un middleware de Express reescribe el \`<head>\` del HTML **antes de servirlo**, así que el buscador (y la vista previa de WhatsApp, y la de LinkedIn) reciben el texto ya corregido — un título puesto con JavaScript después de cargar la página **no lo ve ninguno de los tres**. Guías rápidas: el título entra completo en Google hasta ~**60 caracteres** y la descripción hasta ~**155** (el panel te los cuenta). Las páginas de trastienda (\`*-admin.html\`, login) arrancan con **"no indexar"** activado a propósito.
  Las **redirecciones** son para cuando una dirección deja de existir: cargá la vieja y la nueva y el servidor responde **301** (permanente), que es lo que le dice a Google "esto se mudó, pasale el posicionamiento a la nueva". El panel cuenta cuántas visitas rescató cada una. El **robots.txt** también se edita desde ahí y se sirve desde la base${cfg.moduleIds && cfg.moduleIds.includes('seo') ? ' (tiene prioridad sobre el archivo `public/robots.txt` que generó el módulo SEO)' : ''}.${cfg.brand.domain ? '' : ' Ojo: como todavía no cargaste un dominio en el Builder, el `canonical` se arma con la dirección desde la que se pide la página.'}`,
  ],
};
