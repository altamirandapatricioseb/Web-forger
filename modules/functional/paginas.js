// Páginas administrables con backend real: el pedido que ningún módulo del catálogo contestaba.
// Hasta acá, TODA página del sitio se horneaba al generar — si el negocio necesitaba una nueva
// ("Política de envíos", "Sucursales", "Preguntas sobre garantías", una landing de campaña), había
// que volver al Builder, regenerar el proyecto y deployar de nuevo. Es exactamente lo que un
// cliente real no puede hacer, y es la razón número uno por la que un sitio termina desactualizado.
//
// Acá las páginas viven en la colección sitepages y se sirven en /p/<slug>. La decisión importante:
// el HTML lo arma EL SERVIDOR antes de responder, no el navegador. Una página pintada por
// JavaScript después de cargar no la ve Google, ni el previsualizador de WhatsApp, ni el de
// LinkedIn — y una página que el negocio publica para que la encuentren tiene que ser encontrable.
// El middleware (contrato `middlewares`, corre antes de express.static) toma la cáscara ya generada
// de /paginas.html —con la navbar, el CSS y el pie reales del sitio— y le reemplaza el bloque de
// contenido, el <title> y la meta description. Cero plantillas en tiempo de ejecución, cero
// parpadeo, y la página sale con el mismo diseño que el resto del sitio.
//
// El contenido no es un campo HTML libre sino una lista de BLOQUES tipados (título, párrafo, lista,
// imagen, botón, cita, separador). Dos motivos: se escapa todo lo que entra —un panel que acepta
// HTML crudo es un XSS almacenado esperando— y el resultado hereda los estilos del sitio en vez de
// pelearse con ellos. En los párrafos sí se acepta el mínimo indispensable de formato: **negrita**
// y [texto](enlace), resueltos DESPUÉS de escapar, así el marcado sale del formato y nunca del dato.
//
// Además el middleware suma las páginas publicadas al sitemap.xml que hornea el módulo SEO (si está
// activo): una página que no está en el sitemap es una página que tarda semanas en indexarse.
//
// Panel /paginas-admin.html con editor de bloques y vista previa renderizada POR EL SERVIDOR (el
// mismo renderer que sirve la página real: si la previa se ve bien, la página se ve bien).
// Animado con Anime.js + red de seguridad. Requiere auth para editar; sin auth las páginas se
// sirven igual desde data/sitepages.json.
const { phIcon } = require('../../src/icons');

// Tipos de bloque disponibles. El dato guardado es el nombre del tipo, nunca marcado.
const TIPOS = ['titulo', 'parrafo', 'lista', 'imagen', 'boton', 'cita', 'separador'];

// Página de ejemplo, sembrada como BORRADOR a propósito: muestra cómo se arma una página sin
// publicar contenido inventado en un sitio real (el mismo criterio que la prueba A/B apagada).
const SEMILLA = [{
  slug: 'pagina-de-ejemplo',
  title: 'Página de ejemplo',
  description: 'Ejemplo de página administrable: editala o borrala desde el panel.',
  published: false,
  enMenu: false,
  order: 1,
  blocks: [
    { tipo: 'parrafo', texto: 'Esta página está en **borrador**: no se ve en el sitio hasta que la publiques. Usala para probar el editor y después borrala.' },
    { tipo: 'titulo', texto: 'Cómo se arma una página' },
    { tipo: 'lista', items: ['Agregá bloques de contenido en el orden que quieras', 'Escribí el texto de cada bloque', 'Publicala cuando esté lista'] },
    { tipo: 'boton', texto: 'Volver al inicio', href: '/index.html' },
  ],
}];

module.exports = {
  id: 'paginas', type: 'functional', name: 'Páginas administrables',
  description: 'El negocio crea páginas nuevas del sitio (política de envíos, sucursales, una landing de campaña) sin regenerar ni volver a deployar: se editan en /paginas-admin.html con un editor de bloques tipados —título, párrafo, lista, imagen, botón, cita— y se sirven en /p/<slug>. El HTML lo arma el servidor antes de responder, con la navbar y el diseño reales del sitio, así la página la ven Google y los previsualizadores de WhatsApp y LinkedIn (una página pintada por JavaScript no la ve ninguno). Las publicadas se suman solas al sitemap.xml y pueden aparecer en el menú. Nada de HTML libre: todo se escapa, con **negrita** y [enlaces] resueltos después de escapar. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/paginas', file: 'routes/paginas.js' }],
  middlewares: [{ file: 'src/middleware/paginas.js' }],
  // En Vercel todo lo que no matchea un rewrite lo sirve la CDN de estáticos y nunca llega a
  // Express: sin esta línea /p/<slug> daría 404 en producción aunque funcione local.
  vercelRewrites: ['/p/:slug*'],
  collections: ['sitepages'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Páginas', href: '/paginas-admin.html', id: 'nav-paginas' }] : [],
  head: () => `  <style>
    .pg-art{max-width:760px;margin:0 auto}
    .pg-art h1{font-size:clamp(1.9rem,4vw,2.6rem);line-height:1.15;margin:0 0 10px}
    .pg-art .pg-bajada{color:var(--muted);font-size:1.05rem;margin:0 0 30px}
    .pg-art h2{margin:34px 0 12px}
    .pg-art p{line-height:1.7;margin:0 0 16px}
    .pg-art ul{line-height:1.7;padding-left:22px;margin:0 0 16px}
    .pg-art li{margin-bottom:6px}
    .pg-art blockquote{margin:22px 0;padding:14px 20px;border-left:3px solid var(--accent);background:var(--surface);border-radius:0 var(--radius) var(--radius) 0}
    .pg-art blockquote p{margin:0}
    .pg-art blockquote cite{display:block;margin-top:8px;font-size:.85rem;color:var(--muted);font-style:normal}
    .pg-art figure{margin:24px 0}
    .pg-art figure img{width:100%;height:auto;border-radius:var(--radius);display:block}
    .pg-art figcaption{font-size:.84rem;color:var(--muted);margin-top:8px;text-align:center}
    .pg-art hr{border:0;border-top:1px solid var(--line);margin:32px 0}
    .pg-art .pg-fecha{font-size:.82rem;color:var(--muted);margin-top:38px;padding-top:16px;border-top:1px solid var(--line)}
    .pg-indice{display:grid;gap:12px;margin-top:24px}
    .pg-indice a{display:block;padding:16px 18px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);text-decoration:none;color:inherit}
    .pg-indice strong{display:block;margin-bottom:4px}
    .pg-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .pg-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .pg-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .pg-bloques{display:grid;gap:10px;margin:14px 0}
    .pg-bloque{border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px;background:var(--bg)}
    .pg-bloque header{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}
    .pg-bloque .pg-tipo{font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
    .pg-bloque textarea{min-height:74px}
    .pg-bloque input,.pg-bloque textarea{margin-bottom:8px}
    .pg-acc{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .pg-acc .btn{width:auto;padding:5px 11px;font-size:.82rem}
    .pg-agregar{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
    .pg-agregar .btn{width:auto;padding:6px 13px;font-size:.85rem}
    .pg-previa{border:1px solid var(--line);border-radius:var(--radius);padding:22px 24px;background:var(--surface);margin-top:14px}
    .pg-url{font-family:ui-monospace,'Cascadia Code','Courier New',monospace;font-size:.84rem;word-break:break-all}
  </style>`,
  files: (cfg) => ({
    // Renderer compartido: lo usan el middleware (página real) y la ruta de vista previa del panel.
    // Una sola implementación es la única forma de que la previa no mienta.
    'src/paginas-render.js': `/**
 * Render de bloques a HTML. Es la ÚNICA implementación del renderer: la usa el middleware que
 * sirve /p/<slug> y también la vista previa del panel, así lo que el admin ve mientras edita es
 * literalmente lo que el visitante va a recibir.
 *
 * Todo lo que viene del panel se escapa ANTES de aplicar cualquier formato. El formato liviano
 * (**negrita** y [texto](enlace)) se resuelve sobre el texto ya escapado, así el marcado sale
 * siempre del formato y nunca del dato: no hay forma de inyectar HTML desde el editor.
 */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Enlaces aceptados: del propio sitio, http(s), mailto o tel. Nunca javascript: ni data:
const ENLACE = /^(https?:\\/\\/[^\\s"']+|\\/[\\w\\-./#?=&%+]*|mailto:[^\\s"']+|tel:[+\\d\\s()-]+)$/;
const enlaceValido = (u) => ENLACE.test(String(u || '').trim());

/** Formato liviano sobre texto YA escapado: **negrita** y [texto](enlace). */
function formato(textoEscapado) {
  let out = String(textoEscapado);
  out = out.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
  out = out.replace(/\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/g, (m, t, u) => {
    // La URL viene escapada: se desescapan solo las entidades que un enlace legítimo puede traer
    const limpia = String(u).replace(/&amp;/g, '&').replace(/&#39;/g, "'");
    if (!enlaceValido(limpia)) return t;
    const externo = /^https?:\\/\\//.test(limpia);
    return '<a href="' + esc(limpia) + '"' + (externo ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + t + '</a>';
  });
  return out;
}

const parrafo = (t) => formato(esc(t)).replace(/\\r?\\n/g, '<br>');

/** Un bloque → su HTML. Un tipo desconocido devuelve cadena vacía: nunca rompe la página. */
function bloqueHtml(b) {
  if (!b || typeof b !== 'object') return '';
  switch (b.tipo) {
    case 'titulo':
      return b.texto ? '<h2>' + esc(b.texto) + '</h2>' : '';
    case 'parrafo':
      return b.texto ? '<p>' + parrafo(b.texto) + '</p>' : '';
    case 'lista': {
      const items = (Array.isArray(b.items) ? b.items : []).filter(i => String(i || '').trim());
      if (!items.length) return '';
      return '<ul>' + items.map(i => '<li>' + parrafo(i) + '</li>').join('') + '</ul>';
    }
    case 'imagen': {
      if (!enlaceValido(b.src)) return '';
      const alt = esc(b.alt || '');
      const pie = b.pie ? '<figcaption>' + esc(b.pie) + '</figcaption>' : '';
      return '<figure><img src="' + esc(b.src) + '" alt="' + alt + '" loading="lazy">' + pie + '</figure>';
    }
    case 'boton': {
      if (!b.texto || !enlaceValido(b.href)) return '';
      const externo = /^https?:\\/\\//.test(String(b.href).trim());
      return '<p><a class="btn" href="' + esc(b.href) + '"' + (externo ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + esc(b.texto) + '</a></p>';
    }
    case 'cita': {
      if (!b.texto) return '';
      const autor = b.autor ? '<cite>' + esc(b.autor) + '</cite>' : '';
      return '<blockquote><p>' + parrafo(b.texto) + '</p>' + autor + '</blockquote>';
    }
    case 'separador':
      return '<hr>';
    default:
      return '';
  }
}

/** Página completa (encabezado + bloques + fecha de actualización) lista para el hueco del shell. */
function paginaHtml(pagina) {
  const bloques = (Array.isArray(pagina.blocks) ? pagina.blocks : []).map(bloqueHtml).filter(Boolean).join('\\n      ');
  const bajada = pagina.description ? '<p class="pg-bajada">' + esc(pagina.description) + '</p>' : '';
  const fecha = pagina.updatedAt || pagina.createdAt;
  const pie = fecha ? '<p class="pg-fecha">Última actualización: ' +
    esc(new Date(fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })) + '</p>' : '';
  return '<h1>' + esc(pagina.title || '') + '</h1>\\n      ' + bajada + '\\n      ' + bloques + '\\n      ' + pie;
}

/** Índice de páginas publicadas (lo que se ve en /paginas.html). */
function indiceHtml(paginas) {
  if (!paginas.length) {
    return '<h1>Páginas</h1>\\n      <p class="pg-bajada">Todavía no hay páginas publicadas.</p>';
  }
  return '<h1>Páginas</h1>\\n      <div class="pg-indice">' + paginas.map(p =>
    '<a href="/p/' + esc(p.slug) + '"><strong>' + esc(p.title) + '</strong>' +
    (p.description ? '<span class="muted">' + esc(p.description) + '</span>' : '') + '</a>'
  ).join('') + '</div>';
}

module.exports = { esc, enlaceValido, bloqueHtml, paginaHtml, indiceHtml };
`,

    // Middleware: sirve /p/<slug> y /paginas.html con el HTML ya armado, y completa el sitemap.
    'src/middleware/paginas.js': `/**
 * Servidor de páginas administrables. Montado ANTES de express.static (ver src/app.js).
 *
 * Toma la cáscara ya generada de public/paginas.html —que trae la navbar, el CSS, el pie y los
 * scripts reales del sitio— y le reemplaza el bloque marcado con los comentarios WF-PAGINA, el
 * <title> y la meta description. No hay motor de plantillas ni parpadeo: el visitante (y el
 * buscador) reciben la página terminada en la primera respuesta.
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { esc, paginaHtml, indiceHtml } = require('../paginas-render');

const PUBLICO = path.join(__dirname, '..', '..', 'public');
const INICIO = '<!--WF-PAGINA-INICIO-->';
const FIN = '<!--WF-PAGINA-FIN-->';

// Caché corta de las páginas: por acá pasa cada visita y el driver JSON lee del disco en cada
// consulta. routes/paginas.js llama a invalidar() apenas guarda, así el cambio se ve al instante.
let cache = null;
let cacheHasta = 0;
async function publicadas() {
  if (cache && Date.now() < cacheHasta) return cache;
  cache = (await db.all('sitepages'))
    .filter(p => p.published !== false)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  cacheHasta = Date.now() + 5000;
  return cache;
}
function invalidar() { cache = null; cacheHasta = 0; }

// La cáscara no cambia mientras el servidor vive: se lee una sola vez
let shell;
function cascara() {
  if (shell !== undefined) return shell;
  try { shell = fs.readFileSync(path.join(PUBLICO, 'paginas.html'), 'utf8'); }
  catch { shell = null; }
  return shell;
}

/** Reemplaza el hueco de contenido, el título de la pestaña y la meta description. */
function armar(html, { titulo, descripcion, cuerpo }) {
  const i = html.indexOf(INICIO);
  const j = html.indexOf(FIN);
  if (i < 0 || j < 0 || j < i) return null;
  let salida = html.slice(0, i + INICIO.length) + '\\n      ' + cuerpo + '\\n      ' + html.slice(j);
  salida = salida.replace(/<title>[\\s\\S]*?<\\/title>/i, (m) => {
    // Se conserva el sufijo de marca que arma el layout (" — Mi Empresa")
    const partes = m.replace(/<\\/?title>/gi, '').split('—');
    const marca = partes.length > 1 ? ' —' + partes.slice(1).join('—') : '';
    return '<title>' + esc(titulo) + marca + '</title>';
  });
  if (descripcion) {
    const meta = '  <meta name="description" content="' + esc(descripcion) + '">';
    salida = /<meta\\s+name=["']description["'][^>]*>/i.test(salida)
      ? salida.replace(/[ \\t]*<meta\\s+name=["']description["'][^>]*>/i, meta)
      : salida.replace(/<\\/title>/i, '</title>\\n' + meta);
  }
  return salida;
}

/** Slug pedido en /p/<slug> (con o sin barra final). Devuelve null si la ruta no es de páginas. */
function slugDe(p) {
  const m = /^\\/p\\/([^/?#]+)\\/?$/.exec(p);
  if (!m) return null;
  try { return decodeURIComponent(m[1]).toLowerCase(); } catch { return m[1].toLowerCase(); }
}

// Dirección pública real del sitio (detrás de un proxy el host viaja en x-forwarded-*)
function origenDe(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
  return proto + '://' + host;
}

async function middlewarePaginas(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const p = req.path;
  if (p.startsWith('/api/')) return next();

  // 1. sitemap.xml: se le suman las páginas publicadas al que hornea el módulo SEO. Una página
  // que no está en el sitemap tarda semanas en indexarse, y este módulo crea páginas nuevas
  // después de generar el proyecto: el archivo estático no puede conocerlas.
  if (p === '/sitemap.xml') {
    let base;
    try { base = fs.readFileSync(path.join(PUBLICO, 'sitemap.xml'), 'utf8'); } catch { base = null; }
    if (!base || !base.includes('</urlset>')) return next();
    let lista;
    try { lista = await publicadas(); } catch { return next(); }
    if (!lista.length) return next();
    const origen = origenDe(req);
    const urls = lista.map(pg => '  <url><loc>' + esc(origen + '/p/' + pg.slug) + '</loc>' +
      (pg.updatedAt ? '<lastmod>' + esc(String(pg.updatedAt).slice(0, 10)) + '</lastmod>' : '') +
      '</url>').join('\\n');
    return res.type('application/xml').send(base.replace('</urlset>', urls + '\\n</urlset>'));
  }

  // 2. Índice de páginas publicadas
  const html = cascara();
  if (p === '/paginas.html' || p === '/paginas') {
    if (!html) return next();
    let lista;
    try { lista = await publicadas(); } catch { return next(); }
    const salida = armar(html, {
      titulo: 'Páginas',
      descripcion: '',
      cuerpo: indiceHtml(lista.map(pg => ({ slug: pg.slug, title: pg.title, description: pg.description }))),
    });
    if (!salida) return next();
    return res.type('html').send(salida);
  }

  // 3. Una página concreta
  const slug = slugDe(p);
  if (!slug) return next();
  if (!html) return next();
  let lista;
  try { lista = await publicadas(); } catch { return next(); }
  const pagina = lista.find(x => String(x.slug || '').toLowerCase() === slug);
  // Sin página publicada con ese slug se sigue de largo: lo resuelve el 404 del sitio
  if (!pagina) return next();
  const salida = armar(html, {
    titulo: pagina.title || 'Página',
    descripcion: pagina.description || '',
    cuerpo: paginaHtml(pagina),
  });
  if (!salida) return next();
  res.type('html').send(salida);
}

module.exports = middlewarePaginas;
module.exports.invalidar = invalidar;
`,

    'routes/paginas.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
const { paginaHtml } = require('../src/paginas-render');
const { invalidar } = require('../src/middleware/paginas');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
const TIPOS = ${JSON.stringify(TIPOS)};
// Un slug es lo que va en la dirección: minúsculas, números y guiones. Nada más, porque la
// dirección de una página publicada no se puede corregir después sin romper los enlaces.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Nombres que ya usa el sitio: dejar publicar /p/api o /p/index confunde más de lo que ayuda
const RESERVADOS = ['api', 'index', 'about', 'paginas', 'p'];

db.seedIfEmpty('sitepages', ${JSON.stringify(SEMILLA, null, 2)});

const salida = (p) => ({
  id: p.id, slug: p.slug, title: p.title, description: p.description || '',
  published: p.published !== false, enMenu: !!p.enMenu, order: Number(p.order) || 0,
  blocks: Array.isArray(p.blocks) ? p.blocks : [],
  updatedAt: p.updatedAt || p.createdAt || null,
});

const ordenadas = (rows) => rows.map(salida)
  .sort((a, b) => (a.order - b.order) || String(a.title).localeCompare(String(b.title)));

/** Normaliza los bloques que manda el panel: tipo de la lista blanca y campos acotados. */
function leerBloques(raw) {
  if (!Array.isArray(raw)) return { ok: false, error: 'El contenido tiene que ser una lista de bloques' };
  if (raw.length > 60) return { ok: false, error: 'Una página admite hasta 60 bloques' };
  const out = [];
  for (const b of raw) {
    if (!b || !TIPOS.includes(b.tipo)) return { ok: false, error: 'Tipo de bloque inválido' };
    const limpio = { tipo: b.tipo };
    if (b.tipo === 'lista') {
      const items = (Array.isArray(b.items) ? b.items : []).map(i => String(i == null ? '' : i).slice(0, 300));
      if (items.length > 30) return { ok: false, error: 'Una lista admite hasta 30 puntos' };
      limpio.items = items;
    } else if (b.tipo !== 'separador') {
      limpio.texto = String(b.texto == null ? '' : b.texto).slice(0, 4000);
    }
    if (b.tipo === 'imagen') {
      limpio.src = String(b.src || '').trim().slice(0, 500);
      limpio.alt = String(b.alt || '').slice(0, 200);
      limpio.pie = String(b.pie || '').slice(0, 300);
      delete limpio.texto;
    }
    if (b.tipo === 'boton') limpio.href = String(b.href || '').trim().slice(0, 500);
    if (b.tipo === 'cita') limpio.autor = String(b.autor || '').slice(0, 120);
    out.push(limpio);
  }
  return { ok: true, blocks: out };
}

/** Validación de la ficha. \`parcial\` = PUT: sólo se tocan los campos que llegaron. */
async function leer(body, parcial, idActual) {
  const patch = {};
  if (body.title !== undefined || !parcial) {
    if (!str(body.title, 2, 120)) return { ok: false, error: 'El título tiene que tener entre 2 y 120 caracteres' };
    patch.title = String(body.title).trim();
  }
  if (body.slug !== undefined || !parcial) {
    const s = String(body.slug || '').trim().toLowerCase();
    if (!SLUG.test(s) || s.length > 80) return { ok: false, error: 'La dirección va en minúsculas, con números y guiones (ejemplo: politica-de-envios)' };
    if (RESERVADOS.includes(s)) return { ok: false, error: 'Esa dirección la usa el sitio: elegí otra' };
    const repetida = (await db.all('sitepages')).some(p => p.slug === s && p.id !== idActual);
    if (repetida) return { ok: false, error: 'Ya hay otra página con esa dirección' };
    patch.slug = s;
  }
  if (body.description !== undefined) {
    const d = String(body.description || '').trim();
    if (d.length > 300) return { ok: false, error: 'La bajada no puede pasar de 300 caracteres' };
    patch.description = d;
  }
  if (body.blocks !== undefined) {
    const r = leerBloques(body.blocks);
    if (!r.ok) return r;
    patch.blocks = r.blocks;
  }
  if (body.published !== undefined) patch.published = !(body.published === false || body.published === 'false');
  if (body.enMenu !== undefined) patch.enMenu = !(body.enMenu === false || body.enMenu === 'false');
  return { ok: true, patch };
}

// GET /api/paginas — público: sólo lo publicado, sin los bloques (el índice y el menú no los
// necesitan y la página real ya llega armada por el servidor)
router.get('/', async (req, res) => {
  const rows = ordenadas(await db.all('sitepages')).filter(p => p.published);
  res.json({ rows: rows.map(p => ({ slug: p.slug, title: p.title, description: p.description, enMenu: p.enMenu, url: '/p/' + p.slug })) });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/paginas/todas — el panel ve también los borradores, con su contenido
router.get('/todas', requireAdmin, async (req, res) => {
  res.json({ rows: ordenadas(await db.all('sitepages')) });
});

// POST /api/paginas/previa — el HTML tal como lo va a servir el sitio. Es el MISMO renderer que
// usa el middleware: si la previa se ve bien, la página se ve bien.
router.post('/previa', requireAdmin, async (req, res) => {
  const r = leerBloques(req.body && req.body.blocks);
  if (!r.ok) return res.status(422).json({ error: r.error });
  res.json({ html: paginaHtml({
    title: String((req.body && req.body.title) || 'Sin título').slice(0, 120),
    description: String((req.body && req.body.description) || '').slice(0, 300),
    blocks: r.blocks,
    updatedAt: new Date().toISOString(),
  }) });
});

// POST /api/paginas — alta. La posición la decide el servidor: al final
router.post('/', requireAdmin, async (req, res) => {
  const { ok, error, patch } = await leer(req.body || {}, false, null);
  if (!ok) return res.status(422).json({ error });
  const ultimo = (await db.all('sitepages')).reduce((m, p) => Math.max(m, Number(p.order) || 0), 0);
  const row = await db.insert('sitepages', {
    slug: patch.slug, title: patch.title, description: patch.description || '',
    blocks: patch.blocks || [], published: patch.published === true,
    enMenu: patch.enMenu === true, order: ultimo + 1, updatedAt: new Date().toISOString(),
  });
  invalidar();
  res.status(201).json(salida(row));
});

// PUT /api/paginas/:id — edición parcial
router.put('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('sitepages', req.params.id);
  if (!p) return res.status(404).json({ error: 'Esa página no existe' });
  const { ok, error, patch } = await leer(req.body || {}, true, p.id);
  if (!ok) return res.status(422).json({ error });
  patch.updatedAt = new Date().toISOString();
  const row = await db.update('sitepages', p.id, patch);
  invalidar();
  res.json(salida(row));
});

// POST /api/paginas/:id/mover — sube o baja en el orden del índice y del menú
router.post('/:id/mover', requireAdmin, async (req, res) => {
  const dir = req.body && req.body.dir === 'sube' ? -1 : 1;
  const p = await db.get('sitepages', req.params.id);
  if (!p) return res.status(404).json({ error: 'Esa página no existe' });
  const lista = ordenadas(await db.all('sitepages'));
  const i = lista.findIndex(x => x.id === p.id);
  const j = i + dir;
  if (j < 0 || j >= lista.length) return res.status(409).json({ error: dir < 0 ? 'Ya es la primera' : 'Ya es la última' });
  const nueva = lista.slice();
  nueva[i] = lista[j];
  nueva[j] = lista[i];
  // Se reescriben las posiciones completas: queda 1..N sin huecos ni empates
  for (let k = 0; k < nueva.length; k++) await db.update('sitepages', nueva[k].id, { order: k + 1 });
  invalidar();
  res.json({ rows: ordenadas(await db.all('sitepages')) });
});

// DELETE /api/paginas/:id — baja definitiva (para sacarla del sitio sin perderla está el borrador)
router.delete('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('sitepages', req.params.id);
  if (!p) return res.status(404).json({ error: 'Esa página no existe' });
  await db.remove('sitepages', p.id);
  invalidar();
  res.json({ ok: true });
});
` : `// La edición requiere el módulo de autenticación: activalo en el Builder para habilitar
// /paginas-admin.html. Sin él las páginas se sirven igual, editando data/sitepages.json a mano.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => Object.assign({
    // Cáscara de las páginas administrables. El middleware reemplaza lo que hay entre los dos
    // comentarios WF-PAGINA con el contenido real ya renderizado en el servidor. Lo que queda
    // horneado es el estado vacío: es lo que se ve en la vista previa del Builder (sin servidor)
    // y lo que respondería el sitio si la colección estuviera vacía.
    paginas: {
      title: 'Páginas',
      html: `  <section>
    <div class="container">
      <article class="pg-art" id="pg-cuerpo">
        <!--WF-PAGINA-INICIO-->
        <h1>Páginas</h1>
        <p class="pg-bajada">Todavía no hay páginas publicadas.</p>
        <!--WF-PAGINA-FIN-->
      </article>
    </div>
  </section>`,
    },
  }, cfg.moduleIds.includes('auth') ? {
    'paginas-admin': {
      title: 'Páginas',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('stack', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Páginas del sitio</h2>
      <p class="section-sub">Creá páginas nuevas sin regenerar ni volver a deployar: se publican en <code>/p/&lt;direccion&gt;</code> con el diseño del sitio, las arma el servidor (así las ve Google y el previsualizador de WhatsApp) y las publicadas entran solas al sitemap. Solo visible para administradores.</p>

      <div class="card" style="margin-bottom:26px">
        <h3 id="pg-form-titulo">Nueva página</h3>
        <form id="pg-form">
          <div class="grid cols-2">
            <div><label for="pg-title">Título</label><input id="pg-title" name="title" required maxlength="120" placeholder="Política de envíos"></div>
            <div><label for="pg-slug">Dirección</label><input id="pg-slug" name="slug" required maxlength="80" placeholder="politica-de-envios"><span class="muted pg-url" id="pg-url-previa">/p/…</span></div>
          </div>
          <label for="pg-desc">Bajada (opcional, también es la descripción para Google)</label>
          <input id="pg-desc" name="description" maxlength="300" placeholder="Cómo, cuándo y a qué costo enviamos tus pedidos.">

          <label style="margin-top:18px">Contenido</label>
          <div class="pg-bloques" id="pg-bloques"></div>
          <div class="pg-agregar" id="pg-agregar"></div>
          <p class="muted" style="font-size:.82rem;margin-top:10px">En los párrafos y las listas podés usar <code>**negrita**</code> y <code>[texto](/otra-pagina.html)</code>.</p>

          <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:18px">
            <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="pg-pub" style="width:auto;margin:0"> Publicada</label>
            <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="pg-menu" style="width:auto;margin:0"> Mostrar en el menú</label>
          </div>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="pg-guardar">Crear página</button>
            <button class="btn ghost" type="button" id="pg-ver-previa">Vista previa</button>
            <button class="btn ghost" type="button" id="pg-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
        <div class="pg-previa" id="pg-previa" hidden></div>
      </div>

      <div id="pg-lista"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {}),
  clientJs: (cfg) => `/* Módulo páginas administrables. Ojo con lo que este archivo NO hace: no renderiza el contenido
   de las páginas. Eso lo arma el servidor antes de responder (src/middleware/paginas.js), porque
   una página pintada por JavaScript no la ve ni Google ni el previsualizador de WhatsApp. Acá sólo
   quedan dos cosas: sumar al menú las páginas marcadas "en el menú"${cfg.moduleIds.includes('auth') ? ' y el panel de edición' : ''}.
   Anime.js para la aparición, con red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Links de las páginas marcadas "en el menú" ----
  // Se agregan a la navbar de cada página. Si el módulo Menú administrable está activo, se le
  // avisa después de insertarlos para que aplique su orden y sus nombres también sobre estos.
  function alMenu(rows) {
    var cont = document.querySelector('.nav-links');
    if (!cont || !rows.length) return;
    var nuevos = [];
    rows.forEach(function (p) {
      if (!p.enMenu) return;
      if (cont.querySelector('a[href="' + p.url + '"]')) return;
      var a = document.createElement('a');
      a.href = p.url;
      a.textContent = p.title;
      a.setAttribute('data-wf-pagina', p.slug);
      if (location.pathname === p.url) a.className = 'active';
      cont.appendChild(a);
      nuevos.push(a);
    });
    if (!nuevos.length) return;
    if (window.WFNav && typeof window.WFNav.aplicar === 'function') window.WFNav.aplicar();
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(nuevos, { opacity: [0, 1], duration: 320, ease: 'outCubic' });
      // Red de seguridad: con la pestaña oculta el loop de Anime no corre
      setTimeout(function () { nuevos.forEach(function (a) { a.style.opacity = 1; }); }, 700);
    }
  }

  var DEMO = [
    { slug: 'politica-de-envios', title: 'Política de envíos', description: 'Cómo, cuándo y a qué costo enviamos.', enMenu: true, url: '/p/politica-de-envios' },
    { slug: 'preguntas-de-garantia', title: 'Preguntas de garantía', description: 'Qué cubre y por cuánto tiempo.', enMenu: false, url: '/p/preguntas-de-garantia' },
  ];

  if (window.__PREVIEW__) {
    // En la vista previa del Builder no hay servidor: se muestran páginas de ejemplo para que se
    // entienda qué hace el módulo (el índice horneado dice "todavía no hay páginas publicadas").
    alMenu(DEMO);
    var art = document.getElementById('pg-cuerpo');
    if (art && !document.getElementById('pg-form')) {
      art.innerHTML = '<h1>Páginas</h1><div class="pg-indice">' + DEMO.map(function (p) {
        return '<a href="#"><strong>' + App.esc(p.title) + '</strong><span class="muted">' + App.esc(p.description) + '</span></a>';
      }).join('') + '</div>';
    }
  } else {
    fetch('/api/paginas').then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.rows) alMenu(d.rows); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /paginas-admin.html ----
  var form = document.getElementById('pg-form');
  var box = document.getElementById('pg-lista');
  if (form && box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var editando = '';
    var bloques = [];
    var SUBIR = ${JSON.stringify(phIcon('arrow-up', { size: 14 }))};
    var BAJAR = ${JSON.stringify(phIcon('arrow-down', { size: 14 }))};
    var NOMBRES = { titulo: 'Título', parrafo: 'Párrafo', lista: 'Lista', imagen: 'Imagen', boton: 'Botón', cita: 'Cita', separador: 'Separador' };
    var TIPOS = ${JSON.stringify(TIPOS)};

    function nuevoBloque(tipo) {
      if (tipo === 'lista') return { tipo: 'lista', items: [''] };
      if (tipo === 'imagen') return { tipo: 'imagen', src: '', alt: '', pie: '' };
      if (tipo === 'boton') return { tipo: 'boton', texto: '', href: '' };
      if (tipo === 'cita') return { tipo: 'cita', texto: '', autor: '' };
      if (tipo === 'separador') return { tipo: 'separador' };
      return { tipo: tipo, texto: '' };
    }

    // Los campos de cada bloque según su tipo. El valor se lee del DOM al guardar, no en cada
    // tecla: reconstruir la lista con cada pulsación haría perder el foco del campo.
    function camposDe(b, i) {
      if (b.tipo === 'separador') return '<p class="muted" style="margin:0;font-size:.85rem">Una línea divisoria.</p>';
      if (b.tipo === 'lista') {
        return (b.items && b.items.length ? b.items : ['']).map(function (it, k) {
          return '<input data-pg-item="' + i + '-' + k + '" value="' + App.esc(it) + '" maxlength="300" placeholder="Punto ' + (k + 1) + '">';
        }).join('') + '<button class="btn ghost" type="button" data-pg-item-mas="' + i + '" style="width:auto;padding:5px 11px;font-size:.82rem">Agregar punto</button>';
      }
      if (b.tipo === 'imagen') {
        return '<input data-pg-campo="' + i + '-src" value="' + App.esc(b.src || '') + '" maxlength="500" placeholder="/img/foto.jpg o https://…">' +
          '<input data-pg-campo="' + i + '-alt" value="' + App.esc(b.alt || '') + '" maxlength="200" placeholder="Descripción de la imagen (para quien no la ve)">' +
          '<input data-pg-campo="' + i + '-pie" value="' + App.esc(b.pie || '') + '" maxlength="300" placeholder="Epígrafe (opcional)">';
      }
      if (b.tipo === 'boton') {
        return '<input data-pg-campo="' + i + '-texto" value="' + App.esc(b.texto || '') + '" maxlength="80" placeholder="Texto del botón">' +
          '<input data-pg-campo="' + i + '-href" value="' + App.esc(b.href || '') + '" maxlength="500" placeholder="/contacto.html o https://…">';
      }
      if (b.tipo === 'cita') {
        return '<textarea data-pg-campo="' + i + '-texto" maxlength="4000" placeholder="La frase">' + App.esc(b.texto || '') + '</textarea>' +
          '<input data-pg-campo="' + i + '-autor" value="' + App.esc(b.autor || '') + '" maxlength="120" placeholder="Quién lo dijo">';
      }
      if (b.tipo === 'titulo') {
        return '<input data-pg-campo="' + i + '-texto" value="' + App.esc(b.texto || '') + '" maxlength="200" placeholder="Texto del título">';
      }
      return '<textarea data-pg-campo="' + i + '-texto" maxlength="4000" placeholder="Escribí el párrafo">' + App.esc(b.texto || '') + '</textarea>';
    }

    function pintarBloques() {
      var cont = document.getElementById('pg-bloques');
      cont.innerHTML = bloques.length ? bloques.map(function (b, i) {
        return '<div class="pg-bloque"><header><span class="pg-tipo">' + (NOMBRES[b.tipo] || b.tipo) + '</span>' +
          '<span class="pg-acc">' +
          '<button class="btn ghost" type="button" aria-label="Subir" title="Subir" data-pg-sube="' + i + '">' + SUBIR + '</button>' +
          '<button class="btn ghost" type="button" aria-label="Bajar" title="Bajar" data-pg-baja="' + i + '">' + BAJAR + '</button>' +
          '<button class="btn ghost" type="button" data-pg-quita="' + i + '">Quitar</button>' +
          '</span></header>' + camposDe(b, i) + '</div>';
      }).join('') : '<p class="muted" style="margin:0">Agregá el primer bloque con los botones de abajo.</p>';

      cont.querySelectorAll('[data-pg-quita]').forEach(function (b) {
        b.addEventListener('click', function () { leerDelDOM(); bloques.splice(Number(b.getAttribute('data-pg-quita')), 1); pintarBloques(); });
      });
      cont.querySelectorAll('[data-pg-sube]').forEach(function (b) {
        b.addEventListener('click', function () { moverBloque(Number(b.getAttribute('data-pg-sube')), -1); });
      });
      cont.querySelectorAll('[data-pg-baja]').forEach(function (b) {
        b.addEventListener('click', function () { moverBloque(Number(b.getAttribute('data-pg-baja')), 1); });
      });
      cont.querySelectorAll('[data-pg-item-mas]').forEach(function (b) {
        b.addEventListener('click', function () {
          leerDelDOM();
          var i = Number(b.getAttribute('data-pg-item-mas'));
          bloques[i].items = (bloques[i].items || []).concat(['']);
          pintarBloques();
        });
      });
    }

    function moverBloque(i, dir) {
      leerDelDOM();
      var j = i + dir;
      if (j < 0 || j >= bloques.length) return;
      var tmp = bloques[i];
      bloques[i] = bloques[j];
      bloques[j] = tmp;
      pintarBloques();
    }

    // Vuelca lo tipeado a la estructura antes de cualquier operación que repinte
    function leerDelDOM() {
      var cont = document.getElementById('pg-bloques');
      if (!cont) return;
      cont.querySelectorAll('[data-pg-campo]').forEach(function (el) {
        var partes = el.getAttribute('data-pg-campo').split('-');
        var b = bloques[Number(partes[0])];
        if (b) b[partes[1]] = el.value;
      });
      bloques.forEach(function (b, i) {
        if (b.tipo !== 'lista') return;
        var items = [];
        cont.querySelectorAll('[data-pg-item^="' + i + '-"]').forEach(function (el) { items.push(el.value); });
        b.items = items.length ? items : [''];
      });
    }

    function pintarAgregar() {
      var cont = document.getElementById('pg-agregar');
      cont.innerHTML = TIPOS.map(function (t) {
        return '<button class="btn ghost" type="button" data-pg-mas="' + t + '">+ ' + NOMBRES[t] + '</button>';
      }).join('');
      cont.querySelectorAll('[data-pg-mas]').forEach(function (b) {
        b.addEventListener('click', function () {
          leerDelDOM();
          bloques.push(nuevoBloque(b.getAttribute('data-pg-mas')));
          pintarBloques();
        });
      });
    }

    function urlPrevia() {
      var s = form.querySelector('[name="slug"]').value.trim().toLowerCase();
      document.getElementById('pg-url-previa').textContent = '/p/' + (s || '…');
    }

    // Sugerencia de dirección a partir del título, sólo mientras la página es nueva: cambiarle el
    // slug a una página publicada rompe los enlaces que ya circulan.
    function sugerirSlug() {
      if (editando) return;
      var campo = form.querySelector('[name="slug"]');
      if (campo.dataset.tocado === '1') return;
      campo.value = form.querySelector('[name="title"]').value.toLowerCase()
        .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
      urlPrevia();
    }

    function salirDeEdicion() {
      editando = '';
      form.reset();
      form.querySelector('[name="slug"]').dataset.tocado = '';
      bloques = [];
      pintarBloques();
      urlPrevia();
      document.getElementById('pg-previa').hidden = true;
      document.getElementById('pg-form-titulo').textContent = 'Nueva página';
      document.getElementById('pg-guardar').textContent = 'Crear página';
      document.getElementById('pg-cancelar').hidden = true;
    }

    function editar(p) {
      editando = p.id;
      form.querySelector('[name="title"]').value = p.title || '';
      form.querySelector('[name="slug"]').value = p.slug || '';
      form.querySelector('[name="slug"]').dataset.tocado = '1';
      form.querySelector('[name="description"]').value = p.description || '';
      document.getElementById('pg-pub').checked = !!p.published;
      document.getElementById('pg-menu').checked = !!p.enMenu;
      bloques = JSON.parse(JSON.stringify(p.blocks || []));
      pintarBloques();
      urlPrevia();
      document.getElementById('pg-previa').hidden = true;
      document.getElementById('pg-form-titulo').textContent = 'Editando: ' + p.title;
      document.getElementById('pg-guardar').textContent = 'Guardar cambios';
      document.getElementById('pg-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function pintarTabla() {
      box.innerHTML = App.table(lista, [
        { label: 'Página', render: function (p) {
          return '<strong>' + App.esc(p.title) + '</strong><br><span class="muted pg-url">/p/' + App.esc(p.slug) + '</span>';
        } },
        { label: 'Estado', render: function (p) {
          return (p.published ? '<span class="pg-chip on">Publicada</span>' : '<span class="pg-chip off">Borrador</span>') +
            (p.enMenu ? ' <span class="pg-chip off">En el menú</span>' : '');
        } },
        { label: 'Bloques', render: function (p) { return String((p.blocks || []).length); } },
        { label: '', render: function (p) {
          return '<span class="pg-acc">' +
            '<button class="btn ghost" type="button" aria-label="Subir" title="Subir" data-pg-sube-p="' + p.id + '">' + SUBIR + '</button>' +
            '<button class="btn ghost" type="button" aria-label="Bajar" title="Bajar" data-pg-baja-p="' + p.id + '">' + BAJAR + '</button>' +
            (p.published ? '<a class="btn ghost" href="/p/' + App.esc(p.slug) + '" target="_blank" rel="noopener">Ver</a>' : '') +
            '<button class="btn ghost" type="button" data-pg-edit="' + p.id + '">Editar</button>' +
            '<button class="btn ghost" type="button" data-pg-pub="' + p.id + '">' + (p.published ? 'Despublicar' : 'Publicar') + '</button>' +
            '<button class="btn ghost" type="button" data-pg-del="' + p.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-pg-edit]').forEach(function (b) {
        b.addEventListener('click', function () { var p = buscar(b.getAttribute('data-pg-edit')); if (p) editar(p); });
      });
      box.querySelectorAll('[data-pg-sube-p]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-pg-sube-p'), 'sube'); });
      });
      box.querySelectorAll('[data-pg-baja-p]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-pg-baja-p'), 'baja'); });
      });
      box.querySelectorAll('[data-pg-pub]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var p = buscar(b.getAttribute('data-pg-pub'));
          if (!p) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se publicaría la página'); return; }
          try {
            await App.api('/api/paginas/' + p.id, { method: 'PUT', body: { published: !p.published } });
            App.toast(p.published ? 'Página despublicada' : 'Página publicada en /p/' + p.slug);
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-pg-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar esta página? Si sólo querés sacarla del sitio, usá "Despublicar".')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/paginas/' + b.getAttribute('data-pg-del'), { method: 'DELETE' });
            App.toast('Página borrada');
            if (editando === b.getAttribute('data-pg-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reordenaría'); return; }
      try {
        var out = await App.api('/api/paginas/' + id + '/mover', { method: 'POST', body: { dir: dir } });
        lista = out.rows;
        pintarTabla();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    var DEMO_PANEL = ${JSON.stringify(SEMILLA.map((p, i) => ({ id: 'd' + (i + 1), ...p, updatedAt: null })))};

    async function cargar() {
      if (window.__PREVIEW__) { lista = DEMO_PANEL.slice(); pintarTabla(); return; }
      try {
        var out = await App.api('/api/paginas/todas');
        lista = out.rows;
        pintarTabla();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    function datosDelForm() {
      leerDelDOM();
      return {
        title: form.querySelector('[name="title"]').value,
        slug: form.querySelector('[name="slug"]').value,
        description: form.querySelector('[name="description"]').value,
        published: document.getElementById('pg-pub').checked,
        enMenu: document.getElementById('pg-menu').checked,
        blocks: bloques,
      };
    }

    form.querySelector('[name="title"]').addEventListener('input', sugerirSlug);
    form.querySelector('[name="slug"]').addEventListener('input', function () { this.dataset.tocado = '1'; urlPrevia(); });

    document.getElementById('pg-ver-previa').addEventListener('click', async function () {
      var caja = document.getElementById('pg-previa');
      var datos = datosDelForm();
      if (window.__PREVIEW__) {
        caja.hidden = false;
        caja.innerHTML = '<p class="muted">Vista previa: acá se ve la página tal como la arma el servidor.</p>';
        return;
      }
      try {
        // La previa la renderiza el SERVIDOR con el mismo código que sirve la página real
        var out = await App.api('/api/paginas/previa', { method: 'POST', body: datos });
        caja.hidden = false;
        caja.innerHTML = '<div class="pg-art">' + out.html + '</div>';
        var anime = window.anime;
        if (anime && anime.animate && !reduce) {
          anime.animate(caja, { opacity: [0, 1], translateY: [8, 0], duration: 380, ease: 'outCubic' });
          setTimeout(function () { caja.style.opacity = 1; caja.style.transform = 'none'; }, 700);
        }
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = datosDelForm();
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la página'); return; }
      try {
        if (editando) await App.api('/api/paginas/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/paginas', { method: 'POST', body: datos });
        App.toast(editando ? 'Página actualizada' : 'Página creada');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    document.getElementById('pg-cancelar').addEventListener('click', salirDeEdicion);

    pintarAgregar();
    pintarBloques();
    urlPrevia();
    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      form.style.display = 'none';
    } else {
      cargar();
      var animeF = window.anime;
      if (animeF && animeF.animate && !reduce) {
        animeF.animate(form, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: 'outCubic' });
        setTimeout(function () { form.style.opacity = 1; form.style.transform = 'none'; }, 800);
      }
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navP = document.getElementById('nav-paginas');
    if (navP && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navP.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Páginas administrables**: las páginas nuevas se publican en \`/p/<direccion>\` y **las arma el servidor** (\`src/middleware/paginas.js\`) sobre la cáscara \`public/paginas.html\`, así salen con la navbar y el diseño del sitio y las ve Google. ${cfg.moduleIds.includes('auth') ? 'Se editan en `/paginas-admin.html` con bloques (título, párrafo, lista, imagen, botón, cita) y se ven al instante, sin regenerar.' : 'Sin el módulo **Autenticación** no hay panel: las páginas viven en `data/sitepages.json` y se editan a mano.'} Viene sembrada **una página de ejemplo en borrador** (no se publica sola): editala o borrala. El índice de las publicadas está en \`/paginas.html\` y, si el módulo **SEO** está activo, las publicadas se suman solas a \`/sitemap.xml\`.${cfg.deploy === 'vercel' ? ' En Vercel el `vercel.json` generado ya incluye el rewrite de `/p/:slug*` hacia la función: sin él la CDN devolvería 404 sin pasar por Express.' : ''} El contenido **no acepta HTML libre** a propósito (todo se escapa); el formato disponible es \`**negrita**\` y \`[texto](enlace)\`.`,
  ],
};
