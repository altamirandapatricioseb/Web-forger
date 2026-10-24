// Etiquetas de producto y páginas de colección: el tercer eje que le faltaba al catálogo. La tienda
// ya filtra por categoría y por marca, pero las dos son atributos ÚNICOS —un producto tiene una
// categoría y una marca—, y lo que un negocio necesita anunciar casi nunca lo es: "Regalos para el
// Día de la Madre", "Menos de $20.000", "Recién llegados", "Última liquidación". Un mismo producto
// entra en varias de esas listas a la vez, y cada lista se arma y se desarma en una semana.
//
// Además de agrupar, cada etiqueta tiene DIRECCIÓN PROPIA: `/etiqueta/<slug>`, con el HTML armado
// por el servidor —el mismo patrón que la ficha de producto y las páginas administrables—. Eso es
// lo que la convierte en una página de aterrizaje real: se puede mandar por WhatsApp, poner en un
// anuncio y posicionar en Google por "regalos para el día de la madre", que es una búsqueda que
// existe y por la que ninguna ficha suelta compite. Un filtro que sólo vive como parámetro en la
// URL de la tienda no puede hacer nada de eso.
//
// Dos decisiones:
//
//   1. LA ETIQUETA GUARDA A QUÉ PRODUCTOS APUNTA, no al revés. Así armar la lista del Día de la
//      Madre es editar UNA fila y no veinte productos, y desarmarla es borrarla: los productos
//      quedan intactos. Es también lo que permite tener la etiqueta cargada y todavía oculta.
//   2. LA PÁGINA NO MUESTRA LO QUE NO SE PUEDE COMPRAR. Los productos pausados salen de la lista;
//      los agotados se muestran al final y marcados, porque en una colección sí aportan (dicen qué
//      hay) pero no pueden encabezarla.

// Etiquetas sembradas: una visible que demuestra la página de colección y una oculta que demuestra
// que se puede preparar una campaña antes de publicarla. Sin productos asignados a propósito — una
// asignación inventada haría que la primera visita vea una colección que el negocio no armó.
const SEMILLA = [
  { slug: 'destacados', nombre: 'Destacados', descripcion: 'Lo que más nos piden.', productIds: [], visible: true, orden: 1 },
  { slug: 'liquidacion', nombre: 'Liquidación', descripcion: 'Últimas unidades a precio de cierre.', productIds: [], visible: false, orden: 2 },
];

module.exports = {
  id: 'etiquetas', type: 'functional', name: 'Etiquetas y colecciones',
  description: 'Agrupá productos en listas transversales ("Regalos", "Menos de $20.000", "Recién llegados") que un mismo producto puede integrar a la vez, a diferencia de la categoría y la marca que son únicas. Cada etiqueta tiene su propia dirección en /etiqueta/<slug> con el HTML ARMADO POR EL SERVIDOR: es una página de aterrizaje real que se puede mandar por WhatsApp, usar en un anuncio y posicionar en Google. La etiqueta guarda a qué productos apunta, así armar una campaña es editar una fila y desarmarla es borrarla, sin tocar ningún producto. Las etiquetas aparecen como chips en la ficha y sobre la tienda. Panel /etiquetas-admin.html. Animado con Anime.js.',
  usesAnime: true,
  requires: ['products-admin'],
  mounts: [{ route: '/api/etiquetas', file: 'routes/etiquetas.js' }],
  middlewares: [{ file: 'src/middleware/etiquetas.js' }],
  // En Vercel, lo que no matchea un rewrite lo sirve la CDN de estáticos y nunca llega a Express:
  // sin esta línea /etiqueta/<slug> daría 404 en producción funcionando perfecto en local.
  vercelRewrites: ['/etiqueta/:slug*'],
  collections: ['producttags'],
  nav: () => [{ label: 'Etiquetas', href: '/etiquetas-admin.html', id: 'nav-etiquetas' }],
  head: () => `  <style>
    .et-chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
    .et-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:5px 13px;font-size:.82rem;text-decoration:none;color:inherit;background:var(--surface);line-height:1.2}
    .et-chip:hover{border-color:var(--accent);color:var(--accent)}
    .et-chip .et-n{color:var(--muted);font-variant-numeric:tabular-nums}
    .et-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:17px;margin-top:22px}
    .et-item{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--surface);text-decoration:none;color:inherit;display:flex;flex-direction:column}
    .et-foto{aspect-ratio:4/3;background:color-mix(in srgb,var(--text) 5%,var(--bg));display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.76rem}
    .et-foto img{width:100%;height:100%;object-fit:cover;display:block}
    .et-txt{padding:12px 14px;display:flex;flex-direction:column;gap:4px;flex:1}
    .et-txt strong{font-size:.95rem;line-height:1.3}
    .et-precio{font-variant-numeric:tabular-nums;font-weight:700}
    .et-antes{text-decoration:line-through;color:var(--muted);font-weight:400;font-size:.84rem;margin-left:6px}
    .et-agotado{font-size:.76rem;color:#c0392b}
    .et-vacia{color:var(--muted)}
    .et-tabla{width:100%;border-collapse:collapse;font-size:.88rem;margin-top:14px}
    .et-tabla th,.et-tabla td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
    .et-tabla th{font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600}
    .et-acc{display:flex;gap:6px;flex-wrap:wrap}
    .et-acc .btn{width:auto;padding:5px 11px;font-size:.8rem}
    .et-estado{display:inline-block;font-size:.71rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .et-estado.si{background:#2e9e5b20;color:#1d6b3c}
    .et-estado.no{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .et-caja{max-height:280px;overflow-y:auto;border:1px solid var(--line);border-radius:var(--radius);padding:6px 13px;margin-top:8px}
    .et-check{display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid var(--line);margin:0}
    .et-check input{width:auto;margin:0}
  </style>`,
  files: () => ({
    'routes/etiquetas.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

db.seedIfEmpty('producttags', ${JSON.stringify(SEMILLA, null, 2)});

const vista = (e) => ({
  id: e.id, slug: e.slug || '', nombre: e.nombre || '',
  descripcion: e.descripcion || '',
  productIds: Array.isArray(e.productIds) ? e.productIds : [],
  visible: e.visible !== false,
  orden: Number(e.orden) || 0,
});

function slugDesde(texto) {
  return String(texto).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

/** Cuántos productos VENDIBLES tiene la etiqueta. Es el número que se muestra en el chip: contar
 *  los pausados haría que un chip prometa 12 y la página muestre 4. */
function cuenta(e, porId) {
  return e.productIds.filter(id => { const p = porId.get(id); return p && p.active !== false; }).length;
}

// GET /api/etiquetas — las visibles, con su cuenta real (público)
router.get('/', async (req, res) => {
  const porId = new Map((await db.all('products')).map(p => [p.id, p]));
  const rows = (await db.all('producttags')).map(vista)
    .filter(e => e.visible && e.slug)
    .map(e => ({ slug: e.slug, nombre: e.nombre, descripcion: e.descripcion, productos: cuenta(e, porId) }))
    .filter(e => e.productos > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  res.json(rows);
});

// GET /api/etiquetas/producto/:productId — las etiquetas visibles de un producto (chips de la ficha)
router.get('/producto/:productId', async (req, res) => {
  const rows = (await db.all('producttags')).map(vista)
    .filter(e => e.visible && e.slug && e.productIds.includes(req.params.productId))
    .map(e => ({ slug: e.slug, nombre: e.nombre }));
  res.json(rows);
});

// ---------- panel ----------

// GET /api/etiquetas/admin/todo — etiquetas (incluidas las ocultas) y el catálogo para asignar
router.get('/admin/todo', requireAdmin, async (req, res) => {
  const productos = (await db.all('products')).map(p => ({ id: p.id, name: p.name, active: p.active !== false }));
  const porId = new Map((await db.all('products')).map(p => [p.id, p]));
  const rows = (await db.all('producttags')).map(vista)
    .sort((a, b) => (a.orden - b.orden) || a.nombre.localeCompare(b.nombre, 'es'))
    .map(e => ({ ...e, productos: cuenta(e, porId) }));
  res.json({ rows, productos });
});

/** Normaliza y valida lo que llega del panel. */
async function leer(body, actual) {
  const patch = {};
  if (body.nombre !== undefined) {
    const n = String(body.nombre).trim().slice(0, 60);
    if (n.length < 2) return { ok: false, error: 'El nombre va de 2 a 60 caracteres' };
    patch.nombre = n;
  }
  if (body.descripcion !== undefined) patch.descripcion = String(body.descripcion).trim().slice(0, 300);
  if (body.slug !== undefined || (!actual && patch.nombre)) {
    const s = body.slug !== undefined ? slugDesde(body.slug) : slugDesde(patch.nombre);
    if (!s || !SLUG.test(s)) return { ok: false, error: 'La dirección va en minúsculas, con números y guiones' };
    const repetido = (await db.all('producttags')).some(e => e.slug === s && e.id !== (actual && actual.id));
    if (repetido) return { ok: false, error: 'Ya hay otra etiqueta con esa dirección' };
    patch.slug = s;
  }
  if (body.productIds !== undefined) {
    if (!Array.isArray(body.productIds)) return { ok: false, error: 'La lista de productos es inválida' };
    const existentes = new Set((await db.all('products')).map(p => p.id));
    patch.productIds = [...new Set(body.productIds.map(String).filter(id => existentes.has(id)))].slice(0, 400);
  }
  if (body.visible !== undefined) patch.visible = !(body.visible === false || body.visible === 'false');
  if (body.orden !== undefined) {
    const n = Number(body.orden);
    if (!isFinite(n) || n < 0 || n > 9999) return { ok: false, error: 'El orden va de 0 a 9999' };
    patch.orden = Math.round(n);
  }
  return { ok: true, patch };
}

// POST /api/etiquetas — alta (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const leido = await leer(req.body || {}, null);
  if (!leido.ok) return res.status(422).json({ error: leido.error });
  if (!leido.patch.nombre) return res.status(422).json({ error: 'Poné un nombre' });
  const row = await db.insert('producttags', {
    nombre: '', slug: '', descripcion: '', productIds: [], visible: true, orden: 0, ...leido.patch,
  });
  res.status(201).json(vista(row));
});

// PATCH /api/etiquetas/:id — edición (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const actual = await db.get('producttags', req.params.id);
  if (!actual) return res.status(404).json({ error: 'Esa etiqueta no existe' });
  const leido = await leer(req.body || {}, actual);
  if (!leido.ok) return res.status(422).json({ error: leido.error });
  res.json(vista(await db.update('producttags', actual.id, leido.patch)));
});

// DELETE /api/etiquetas/:id — borrar la etiqueta NO toca los productos: es todo el punto de que la
// lista viva en la etiqueta y no en cada producto.
router.delete('/:id', requireAdmin, async (req, res) => {
  const actual = await db.get('producttags', req.params.id);
  if (!actual) return res.status(404).json({ error: 'Esa etiqueta no existe' });
  await db.remove('producttags', actual.id);
  res.json({ ok: true });
});

module.exports = router;
`,
    'src/middleware/etiquetas.js': `/**
 * Servidor de páginas de colección. Montado ANTES de express.static (ver src/app.js).
 *
 * Toma la cáscara ya generada de public/etiqueta.html y le reemplaza el bloque marcado con los
 * comentarios WF-ETIQUETA, el <title> y la meta description. El HTML sale terminado en la primera
 * respuesta: una página de aterrizaje pintada por JavaScript no la ve ni Google ni el
 * previsualizador de WhatsApp, que son los dos motivos por los que existe.
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

const PUBLICO = path.join(__dirname, '..', '..', 'public');
const INICIO = '<!--WF-ETIQUETA-INICIO-->';
const FIN = '<!--WF-ETIQUETA-FIN-->';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const IMAGEN = /^(\\/[\\w\\-./#?=&%]*|https?:\\/\\/[^\\s"']+)$/;
const money = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

// La cáscara no cambia mientras el servidor vive
let shell;
function cascara() {
  if (shell !== undefined) return shell;
  try { shell = fs.readFileSync(path.join(PUBLICO, 'etiqueta.html'), 'utf8'); } catch { shell = null; }
  return shell;
}

/** Misma regla de disponibilidad que la ficha y el checkout. */
function comprable(p) {
  if (p.active === false) return false;
  if (p.trackStock === false || p.allowBackorder) return true;
  return (Number(p.stock) || 0) > 0;
}

function tarjeta(p, i) {
  const img = (Array.isArray(p.images) ? p.images : []).find(x => x && IMAGEN.test(x.url || ''));
  // Las primeras no se difieren: están sobre el pliegue y una de ellas es el elemento más grande
  // de la pantalla (el LCP que mide Google). Diferir lo que ya está a la vista sólo hace que la
  // página tarde más en verse terminada.
  const carga = i < 4 ? (i === 0 ? ' fetchpriority="high"' : '') : ' loading="lazy"';
  const destino = p.slug ? '/producto/' + encodeURIComponent(p.slug) : '/catalog.html';
  return '<a class="et-item" href="' + destino + '">' +
    '<div class="et-foto">' + (img
      ? '<img src="' + esc(img.url) + '" alt="' + esc(img.alt || p.name) + '"' + carga + '>'
      : 'sin imagen') + '</div>' +
    '<div class="et-txt"><strong>' + esc(p.name) + '</strong>' +
      '<span class="et-precio">' + money(p.price) +
        (p.compareAt && p.compareAt > p.price ? '<span class="et-antes">' + money(p.compareAt) + '</span>' : '') +
      '</span>' +
      (comprable(p) ? '' : '<span class="et-agotado">Sin stock por ahora</span>') +
    '</div></a>';
}

function cuerpo(etiqueta, productos) {
  if (!productos.length) {
    return '<h1>' + esc(etiqueta.nombre) + '</h1>' +
      '<p class="et-vacia">Todavía no hay productos en esta colección. ' +
      '<a href="/catalog.html">Mirá el catálogo completo</a>.</p>';
  }
  return '<h1>' + esc(etiqueta.nombre) + '</h1>' +
    (etiqueta.descripcion ? '<p class="section-sub">' + esc(etiqueta.descripcion) + '</p>' : '') +
    '<p class="muted">' + productos.length + (productos.length === 1 ? ' producto' : ' productos') + '</p>' +
    '<div class="et-grid">' + productos.map(tarjeta).join('') + '</div>';
}

function armar(html, { titulo, descripcion, cuerpoHtml }) {
  const i = html.indexOf(INICIO);
  const j = html.indexOf(FIN);
  if (i < 0 || j < 0 || j < i) return null;
  let salida = html.slice(0, i + INICIO.length) + '\\n      ' + cuerpoHtml + '\\n      ' + html.slice(j);
  salida = salida.replace(/<title>[\\s\\S]*?<\\/title>/i, (m) => {
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

function slugDe(p) {
  const m = /^\\/etiqueta\\/([^/?#]+)\\/?$/.exec(p);
  if (!m) return null;
  try { return decodeURIComponent(m[1]).toLowerCase(); } catch { return m[1].toLowerCase(); }
}

async function middlewareEtiquetas(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const slug = slugDe(req.path);
  if (!slug) return next();
  const html = cascara();
  if (!html) return next();

  let etiquetas, productos;
  try {
    etiquetas = await db.all('producttags');
    productos = await db.all('products');
  } catch { return next(); }

  const e = etiquetas.find(x => String(x.slug || '').toLowerCase() === slug);
  // Una etiqueta oculta se comporta como inexistente: se sigue de largo y lo resuelve el 404 del
  // sitio. Servirla con un cartel de "no disponible" la deja indexable, que es lo contrario de
  // lo que quiere alguien que todavía no publicó su campaña.
  if (!e || e.visible === false) return next();

  const porId = new Map(productos.map(p => [p.id, p]));
  const lista = (Array.isArray(e.productIds) ? e.productIds : [])
    .map(id => porId.get(id))
    .filter(p => p && p.active !== false)
    // Los agotados van al final: en una colección aportan (dicen qué hay) pero no pueden encabezarla
    .sort((a, b) => (comprable(b) - comprable(a)));

  const salida = armar(html, {
    titulo: e.nombre,
    descripcion: (e.descripcion || (e.nombre + ': ' + lista.length + ' productos')).slice(0, 300),
    cuerpoHtml: cuerpo(e, lista),
  });
  if (!salida) return next();
  res.type('html').send(salida);
}

module.exports = middlewareEtiquetas;
`,
  }),
  pages: () => ({
    // Cáscara de la página de colección. El middleware reemplaza lo que hay entre los dos
    // comentarios WF-ETIQUETA. Lo horneado es el estado vacío: es lo que se ve en la vista previa
    // del Builder (sin servidor) y si alguien entra a /etiqueta.html directamente.
    etiqueta: {
      title: 'Colección',
      html: `  <section>
    <div class="container">
      <div id="et-cuerpo">
        <!--WF-ETIQUETA-INICIO-->
        <h1>Colección</h1>
        <p class="section-sub">Elegí una colección desde el catálogo para ver sus productos.</p>
        <p><a class="btn" href="/catalog.html">Ver el catálogo</a></p>
        <!--WF-ETIQUETA-FIN-->
      </div>
    </div>
  </section>`,
    },
    'etiquetas-admin': {
      title: 'Etiquetas',
      html: `  <section>
    <div class="container">
      <h2>Etiquetas y colecciones</h2>
      <p class="section-sub">Listas transversales que un producto puede integrar a la vez. Cada una
        tiene su página propia en <code>/etiqueta/&lt;direccion&gt;</code>, lista para mandar por
        WhatsApp o usar en un anuncio.</p>
      <div id="et-panel" hidden>
        <div class="card">
          <h3 style="margin:0 0 10px;font-size:1rem">Etiqueta nueva</h3>
          <div class="grid cols-2">
            <div><label for="et-nombre">Nombre</label><input id="et-nombre" maxlength="60" placeholder="Regalos para el Día de la Madre"></div>
            <div><label for="et-desc">Descripción (opcional)</label><input id="et-desc" maxlength="300" placeholder="Ideas para regalar, hasta $30.000."></div>
          </div>
          <button class="btn" type="button" id="et-crear">Crear etiqueta</button>
        </div>
        <div style="overflow-x:auto"><table class="et-tabla">
          <thead><tr><th>Etiqueta</th><th>Dirección</th><th>Productos</th><th>Estado</th><th></th></tr></thead>
          <tbody id="et-filas"></tbody>
        </table></div>
        <div class="card" id="et-editor" hidden style="margin-top:20px">
          <h3 style="margin:0 0 4px;font-size:1rem" id="et-editor-titulo"></h3>
          <p class="muted" style="font-size:.85rem;margin:0">Marcá qué productos entran. Borrar la
            etiqueta no toca ningún producto.</p>
          <div class="et-caja" id="et-catalogo"></div>
          <div class="et-acc" style="margin-top:12px">
            <button class="btn" type="button" id="et-guardar">Guardar productos</button>
            <button class="btn ghost" type="button" id="et-cerrar">Cerrar</button>
          </div>
        </div>
      </div>
      <p class="muted" id="et-sin" hidden>Entrá como administrador para gestionar las etiquetas.</p>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo Etiquetas y colecciones.
   Lo que este archivo NO hace: renderizar la página de colección. Eso lo arma el servidor
   (src/middleware/etiquetas.js), porque una página de aterrizaje pintada por JavaScript no la ve
   ni Google ni el previsualizador de WhatsApp. Acá quedan los chips (ficha y tienda) y el panel. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function esc(s) { return (window.App && App.esc) ? App.esc(s) : String(s == null ? '' : s); }

  function entrada(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [7, 0], duration: 300, delay: anime.stagger(30), ease: 'outCubic' });
    // Red de seguridad: con la pestaña oculta el loop de Anime no corre y los chips quedarían
    // invisibles, que es peor que no animar nada
    setTimeout(function () {
      for (var i = 0; i < nodos.length; i++) { nodos[i].style.opacity = 1; nodos[i].style.transform = 'none'; }
    }, 700);
  }

  function chips(rows, conCuenta) {
    return rows.map(function (e) {
      return '<a class="et-chip" href="/etiqueta/' + encodeURIComponent(e.slug) + '">' + esc(e.nombre) +
        (conCuenta && e.productos ? '<span class="et-n">' + e.productos + '</span>' : '') + '</a>';
    }).join('');
  }

  /* ---------- chips de la ficha ---------- */

  var botonFicha = document.getElementById('fi-add');
  var nombreFicha = document.querySelector('.fi-nombre');
  if (botonFicha && nombreFicha && !window.__PREVIEW__) {
    fetch('/api/etiquetas/producto/' + encodeURIComponent(botonFicha.getAttribute('data-fi-id')))
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) return;
        var caja = document.createElement('div');
        caja.className = 'et-chips';
        caja.style.marginTop = '12px';
        caja.innerHTML = chips(rows, false);
        // Después del nombre y no antes: arriba está la categoría, que es el dato jerárquico.
        nombreFicha.parentNode.insertBefore(caja, nombreFicha.nextSibling);
        entrada(caja.querySelectorAll('.et-chip'));
      })
      .catch(function () {});
  }

  /* ---------- chips sobre la tienda y el catálogo ---------- */

  var anclaTienda = document.getElementById('ti-resultados') || document.getElementById('product-grid');
  if (anclaTienda && !window.__PREVIEW__) {
    fetch('/api/etiquetas')
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) return;
        var caja = document.createElement('div');
        caja.className = 'et-chips';
        caja.innerHTML = chips(rows, true);
        anclaTienda.parentNode.insertBefore(caja, anclaTienda);
        entrada(caja.querySelectorAll('.et-chip'));
      })
      .catch(function () {});
  }

  /* ---------- panel ---------- */

  var panel = document.getElementById('et-panel');
  if (!panel) return;
  var sin = document.getElementById('et-sin');
  // El rol sale de localStorage.user, que es lo que guarda el login (mismo criterio que el
  // resto de los paneles). Decodificar el JWT a mano con atob() no sirve: el payload viene en
  // base64url (con - y _) y atob() lo rechaza, así que el panel no se mostraba nunca.
  var me = null;
  try { me = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) {}
  var esAdmin = !!(me && me.role === 'admin');
  if (window.__PREVIEW__) esAdmin = true;
  if (!esAdmin) { if (sin) sin.hidden = false; return; }
  panel.hidden = false;

  var filas = document.getElementById('et-filas');
  var editor = document.getElementById('et-editor');
  var cajaCatalogo = document.getElementById('et-catalogo');
  var datos = { rows: [], productos: [] };
  var editando = null;

  function pintar() {
    if (!datos.rows.length) {
      filas.innerHTML = '<tr><td colspan="5" class="muted">Todavía no hay etiquetas.</td></tr>';
      return;
    }
    filas.innerHTML = datos.rows.map(function (e) {
      return '<tr data-et-id="' + esc(e.id) + '">' +
        '<td><strong>' + esc(e.nombre) + '</strong>' + (e.descripcion ? '<br><span class="muted" style="font-size:.79rem">' + esc(e.descripcion) + '</span>' : '') + '</td>' +
        '<td>' + (e.visible ? '<a href="/etiqueta/' + encodeURIComponent(e.slug) + '">/etiqueta/' + esc(e.slug) + '</a>' : '<span class="muted">/etiqueta/' + esc(e.slug) + '</span>') + '</td>' +
        '<td>' + e.productos + '</td>' +
        '<td>' + (e.visible ? '<span class="et-estado si">visible</span>' : '<span class="et-estado no">oculta</span>') + '</td>' +
        '<td><div class="et-acc">' +
          '<button class="btn et-productos" type="button">Productos</button>' +
          '<button class="btn ghost et-ver" type="button">' + (e.visible ? 'Ocultar' : 'Publicar') + '</button>' +
          '<button class="btn ghost et-borrar" type="button">Borrar</button>' +
        '</div></td></tr>';
    }).join('');

    filas.querySelectorAll('[data-et-id]').forEach(function (tr) {
      var id = tr.getAttribute('data-et-id');
      var e = datos.rows.filter(function (x) { return x.id === id; })[0];
      tr.querySelector('.et-productos').addEventListener('click', function () { abrir(e); });
      tr.querySelector('.et-ver').addEventListener('click', function () {
        App.api('/api/etiquetas/' + id, { method: 'PATCH', body: { visible: !e.visible } })
          .then(function () { cargar(); }).catch(function (err) { if (err.message !== 'preview') App.toast(err.message); });
      });
      tr.querySelector('.et-borrar').addEventListener('click', function () {
        if (!confirm('¿Borrar "' + e.nombre + '"? Los productos no se tocan.')) return;
        App.api('/api/etiquetas/' + id, { method: 'DELETE' })
          .then(function () { editor.hidden = true; editando = null; cargar(); })
          .catch(function (err) { if (err.message !== 'preview') App.toast(err.message); });
      });
    });
    entrada(filas.querySelectorAll('[data-et-id]'));
  }

  function abrir(e) {
    editando = e;
    editor.hidden = false;
    document.getElementById('et-editor-titulo').textContent = 'Productos de "' + e.nombre + '"';
    var dentro = {};
    e.productIds.forEach(function (id) { dentro[id] = true; });
    cajaCatalogo.innerHTML = datos.productos.map(function (p) {
      return '<label class="et-check"><input type="checkbox" value="' + esc(p.id) + '"' +
        (dentro[p.id] ? ' checked' : '') + '> ' + esc(p.name) +
        (p.active ? '' : ' <span class="muted">(pausado)</span>') + '</label>';
    }).join('');
    editor.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  document.getElementById('et-cerrar').addEventListener('click', function () { editor.hidden = true; editando = null; });

  document.getElementById('et-guardar').addEventListener('click', function () {
    if (!editando) return;
    var ids = [];
    cajaCatalogo.querySelectorAll('input:checked').forEach(function (c) { ids.push(c.value); });
    App.api('/api/etiquetas/' + editando.id, { method: 'PATCH', body: { productIds: ids } })
      .then(function () { App.toast('Guardado'); cargar(); })
      .catch(function (err) { if (err.message !== 'preview') App.toast(err.message); });
  });

  document.getElementById('et-crear').addEventListener('click', function () {
    var nombre = document.getElementById('et-nombre').value;
    App.api('/api/etiquetas', { method: 'POST', body: { nombre: nombre, descripcion: document.getElementById('et-desc').value } })
      .then(function (e) {
        document.getElementById('et-nombre').value = '';
        document.getElementById('et-desc').value = '';
        App.toast('Creada en /etiqueta/' + e.slug);
        cargar();
      })
      .catch(function (err) { if (err.message !== 'preview') App.toast(err.message); });
  });

  function cargar() {
    return App.api('/api/etiquetas/admin/todo').then(function (d) {
      datos = d;
      pintar();
      if (editando) {
        var actualizada = d.rows.filter(function (x) { return x.id === editando.id; })[0];
        if (actualizada) editando = actualizada; else { editor.hidden = true; editando = null; }
      }
    }).catch(function (e) { if (e.message !== 'preview') App.toast(e.message); });
  }

  if (window.__PREVIEW__) {
    datos = {
      rows: [
        { id: 'd1', nombre: 'Destacados', slug: 'destacados', descripcion: 'Lo que más nos piden.', productIds: ['p1'], visible: true, productos: 1 },
        { id: 'd2', nombre: 'Liquidación', slug: 'liquidacion', descripcion: '', productIds: [], visible: false, productos: 0 },
      ],
      productos: [{ id: 'p1', name: 'Producto Clásico', active: true }, { id: 'p2', name: 'Producto Premium', active: true }],
    };
    pintar();
  } else {
    cargar();
  }
})();`,
  readmeNotes: (cfg) => [
    `**Etiquetas y colecciones**: cada etiqueta se sirve en \`/etiqueta/<direccion>\` con el HTML **armado por el servidor** (\`src/middleware/etiquetas.js\`) sobre la cáscara \`public/etiqueta.html\`, así la colección la ven Google y los previsualizadores de WhatsApp. **La etiqueta guarda a qué productos apunta**, no al revés: armar "Regalos para el Día de la Madre" es editar una fila en \`/etiquetas-admin.html\` y desarmarla es borrarla, sin tocar ningún producto. Una etiqueta **oculta se comporta como inexistente** (404), no como una página con cartel: servirla la dejaría indexada antes de que la campaña exista.${cfg.deploy === 'vercel' ? ' En Vercel el `vercel.json` generado ya incluye el rewrite de `/etiqueta/:slug*`: sin él la CDN devolvería 404 sin pasar por Express.' : ''} **Pendiente conocido**: las páginas de colección **no entran al \`sitemap.xml\`** (se descubren por los enlaces internos de la ficha y la tienda); si te importa acelerar la indexación, agregalas a mano en \`public/sitemap.xml\`.`,
  ],
};
