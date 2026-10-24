// Página de producto: el agujero más grande que tenía el catálogo como e-commerce. Los productos
// vivían sólo dentro de la grilla de /catalog.html — no tenían dirección propia. Sin URL por
// producto no hay nada de esto: no se puede compartir un link por WhatsApp, no se puede anunciar un
// producto puntual, Google no puede posicionarlo (indexa una sola página con todo mezclado), y no
// existe la ficha que leen Google Shopping y los previsualizadores de las redes.
//
// Acá cada producto se sirve en `/producto/<slug>` y **el HTML lo arma el servidor**, con el mismo
// patrón que las páginas administrables: el middleware toma la cáscara ya generada de
// `public/producto.html` —con la navbar, el CSS y el pie reales del sitio— y le reemplaza el bloque
// marcado, el `<title>` y la meta description. Pintar la ficha con JavaScript después de cargar
// sería más fácil y no la vería ningún buscador ni ningún previsualizador, que es exactamente para
// lo que existe una ficha de producto.
//
// Incluye el **JSON-LD `Product`** con precio, moneda y disponibilidad: es el dato estructurado con
// el que Google muestra el precio y el "En stock" abajo del resultado de búsqueda, y el mismo que
// pide Google Shopping. Se emite con la disponibilidad REAL (`InStock` / `OutOfStock`), calculada
// con la misma regla que usa el checkout — anunciar stock que no existe es peor que no anunciarlo.
//
// La galería cambia la foto grande con un fundido de Anime.js (red de seguridad incluida), el
// selector de cantidad respeta el stock disponible, y "Agregar al carrito" usa `window.WFCart`
// —el punto de entrada del módulo Carrito— en vez de reimplementar el formato del localStorage.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'ficha', type: 'functional', name: 'Página de producto',
  description: 'Cada producto tiene su dirección propia en /producto/<slug> con el HTML armado POR EL SERVIDOR: galería de imágenes, precio (con el anterior tachado si hay oferta), disponibilidad real, descripción, detalle largo, selector de cantidad limitado por el stock, botón de agregar al carrito y productos relacionados de la misma categoría. Emite JSON-LD Product con precio y disponibilidad reales, que es lo que Google usa para mostrar el precio en el resultado de búsqueda y lo que pide Google Shopping. Sin página de producto no hay link para compartir, ni anuncio de un producto puntual, ni posicionamiento por producto. Galería animada con Anime.js.',
  usesAnime: true,
  requires: ['products-admin', 'cart'],
  middlewares: [{ file: 'src/middleware/ficha.js' }],
  // En Vercel, lo que no matchea un rewrite lo sirve la CDN de estáticos y nunca llega a Express:
  // sin esta línea /producto/<slug> daría 404 en producción funcionando perfecto en local.
  vercelRewrites: ['/producto/:slug*'],
  head: () => `  <style>
    .fi-wrap{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:36px;align-items:start}
    @media (max-width:820px){.fi-wrap{grid-template-columns:1fr;gap:24px}}
    .fi-foto{aspect-ratio:1/1;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:color-mix(in srgb,var(--text) 5%,var(--bg));display:flex;align-items:center;justify-content:center;color:var(--muted)}
    .fi-foto img{width:100%;height:100%;object-fit:cover;display:block}
    .fi-thumbs{display:flex;gap:9px;flex-wrap:wrap;margin-top:11px}
    .fi-thumbs button{width:66px;height:66px;padding:0;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--bg);cursor:pointer}
    .fi-thumbs button[aria-current="true"]{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 25%,transparent)}
    .fi-thumbs img{width:100%;height:100%;object-fit:cover;display:block}
    .fi-cat{font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
    .fi-nombre{font-size:clamp(1.6rem,3.4vw,2.2rem);line-height:1.15;margin:6px 0 10px}
    .fi-precio{display:flex;align-items:baseline;gap:11px;flex-wrap:wrap;margin:0 0 6px}
    .fi-precio strong{font-size:1.9rem;font-variant-numeric:tabular-nums}
    .fi-antes{text-decoration:line-through;color:var(--muted)}
    .fi-off{background:#2e9e5b20;color:#1d6b3c;font-size:.76rem;font-weight:700;padding:2px 10px;border-radius:999px}
    .fi-stock{font-size:.88rem;margin:0 0 18px}
    .fi-stock.hay{color:#1d6b3c}
    .fi-stock.poco{color:#8a6400}
    .fi-stock.no{color:#c0392b}
    .fi-desc{line-height:1.65;margin:0 0 18px}
    .fi-compra{display:flex;gap:11px;align-items:center;flex-wrap:wrap;margin-bottom:20px}
    .fi-compra input{width:82px;margin:0;text-align:center}
    .fi-compra .btn{width:auto}
    .fi-detalle{border-top:1px solid var(--line);padding-top:20px;margin-top:4px;line-height:1.7;white-space:pre-wrap}
    .fi-datos{list-style:none;padding:0;margin:16px 0 0;font-size:.87rem;color:var(--muted)}
    .fi-datos li{padding:5px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:14px}
    .fi-rel{margin-top:56px}
    .fi-rel-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px;margin-top:16px}
    .fi-rel-item{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--surface);text-decoration:none;color:inherit;display:block}
    .fi-rel-item .fi-rel-foto{aspect-ratio:4/3;background:color-mix(in srgb,var(--text) 5%,var(--bg));display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.78rem}
    .fi-rel-item img{width:100%;height:100%;object-fit:cover;display:block}
    .fi-rel-item div.fi-rel-txt{padding:11px 13px}
    .fi-rel-item strong{display:block;font-size:.93rem;line-height:1.3;margin-bottom:3px}
  </style>`,
  files: () => ({
    'src/middleware/ficha.js': `/**
 * Servidor de fichas de producto. Montado ANTES de express.static (ver src/app.js).
 *
 * Toma la cáscara ya generada de public/producto.html y le reemplaza el bloque marcado con los
 * comentarios WF-FICHA, el <title> y la meta description. El HTML sale terminado en la primera
 * respuesta: es la única forma de que la ficha la vean el buscador y los previsualizadores.
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

const PUBLICO = path.join(__dirname, '..', '..', 'public');
const INICIO = '<!--WF-FICHA-INICIO-->';
const FIN = '<!--WF-FICHA-FIN-->';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const IMAGEN = /^(\\/[\\w\\-./#?=&%]*|https?:\\/\\/[^\\s"']+)$/;
const money = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

// Caché corta: por acá pasa cada visita a una ficha y el driver JSON lee del disco en cada
// consulta. routes/products.js no la invalida a propósito — cinco segundos de desfasaje en un
// precio es aceptable, y una invalidación cruzada ataría dos módulos que hoy no se conocen.
let cache = null;
let cacheHasta = 0;
async function productos() {
  if (cache && Date.now() < cacheHasta) return cache;
  cache = (await db.all('products')).filter(p => p.active !== false);
  cacheHasta = Date.now() + 5000;
  return cache;
}

// La cáscara no cambia mientras el servidor vive
let shell;
function cascara() {
  if (shell !== undefined) return shell;
  try { shell = fs.readFileSync(path.join(PUBLICO, 'producto.html'), 'utf8'); } catch { shell = null; }
  return shell;
}

/** Misma regla de disponibilidad que el checkout: la ficha nunca ofrece lo que no se puede vender. */
function disponible(p) {
  if (p.trackStock === false || p.allowBackorder) return { comprable: true, cantidad: 99 };
  const s = Number(p.stock) || 0;
  return { comprable: s > 0, cantidad: Math.min(99, s) };
}

function origenDe(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
  return proto + '://' + host;
}

function galeria(p) {
  const imgs = (Array.isArray(p.images) ? p.images : []).filter(i => i && IMAGEN.test(i.url || ''));
  if (!imgs.length) {
    return '<div class="fi-foto" id="fi-foto"><span>Sin imagen</span></div>';
  }
  const principal = '<div class="fi-foto"><img id="fi-foto" src="' + esc(imgs[0].url) + '" alt="' +
    esc(imgs[0].alt || p.name) + '"></div>';
  if (imgs.length === 1) return principal;
  const thumbs = imgs.map((im, i) =>
    '<button type="button" data-fi-img="' + esc(im.url) + '" aria-current="' + (i === 0) + '" aria-label="Ver imagen ' + (i + 1) + '">' +
    '<img src="' + esc(im.url) + '" alt="" loading="lazy"></button>').join('');
  return principal + '<div class="fi-thumbs">' + thumbs + '</div>';
}

function cuerpo(p, relacionados) {
  const d = disponible(p);
  const off = p.compareAt && p.compareAt > p.price
    ? '<span class="fi-off">' + Math.round((1 - p.price / p.compareAt) * 100) + '% OFF</span>' : '';
  const stockTxt = !d.comprable
    ? '<p class="fi-stock no">Sin stock por el momento</p>'
    : (p.trackStock === false || p.allowBackorder)
      ? '<p class="fi-stock hay">Disponible</p>'
      : (Number(p.stock) <= 5
        ? '<p class="fi-stock poco">¡Últimas ' + Number(p.stock) + ' unidades!</p>'
        : '<p class="fi-stock hay">En stock</p>');

  const compra = d.comprable
    ? '<div class="fi-compra">' +
      '<label for="fi-qty" class="muted" style="margin:0">Cantidad</label>' +
      '<input id="fi-qty" type="number" min="1" max="' + d.cantidad + '" value="1" step="1">' +
      '<button class="btn" type="button" id="fi-add" data-fi-id="' + esc(p.id) + '">Agregar al carrito</button>' +
      '</div>'
    : '<div class="fi-compra"><button class="btn ghost" type="button" disabled aria-disabled="true">Sin stock</button></div>';

  const datos = [
    p.sku ? ['Código', p.sku] : null,
    p.brand ? ['Marca', p.brand] : null,
    p.category ? ['Categoría', p.category] : null,
    Number(p.weight) > 0 ? ['Peso', Number(p.weight) + ' kg'] : null,
  ].filter(Boolean);

  const rel = relacionados.length ? '<section class="fi-rel"><h2>También te puede interesar</h2><div class="fi-rel-grid">' +
    relacionados.map(r => '<a class="fi-rel-item" href="/producto/' + esc(r.slug) + '">' +
      '<div class="fi-rel-foto">' + (r.images && r.images[0]
        ? '<img src="' + esc(r.images[0].url) + '" alt="' + esc(r.name) + '" loading="lazy">'
        : 'sin imagen') + '</div>' +
      '<div class="fi-rel-txt"><strong>' + esc(r.name) + '</strong><span class="muted">' + money(r.price) + '</span></div></a>').join('') +
    '</div></section>' : '';

  return '<div class="fi-wrap">' +
    '<div>' + galeria(p) + '</div>' +
    '<div>' +
      (p.category ? '<span class="fi-cat">' + esc(p.category) + '</span>' : '') +
      '<h1 class="fi-nombre">' + esc(p.name) + '</h1>' +
      '<p class="fi-precio"><strong>' + money(p.price) + '</strong>' +
        (p.compareAt && p.compareAt > p.price ? '<span class="fi-antes">' + money(p.compareAt) + '</span>' + off : '') + '</p>' +
      stockTxt +
      (p.description ? '<p class="fi-desc">' + esc(p.description) + '</p>' : '') +
      compra +
      (datos.length ? '<ul class="fi-datos">' + datos.map(x => '<li><span>' + esc(x[0]) + '</span><span>' + esc(x[1]) + '</span></li>').join('') + '</ul>' : '') +
    '</div>' +
  '</div>' +
  (p.details ? '<div class="fi-detalle">' + esc(p.details) + '</div>' : '') +
  rel;
}

/** JSON-LD Product: lo que Google usa para mostrar precio y disponibilidad en el resultado, y lo
 *  que pide Google Shopping. La disponibilidad es la REAL: anunciar stock que no hay es peor que
 *  no anunciar nada — Google penaliza el dato estructurado que no coincide con la página. */
function jsonLd(p, url) {
  const d = disponible(p);
  const datos = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description || p.details || p.name,
    url,
    sku: p.sku || undefined,
    brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    image: (Array.isArray(p.images) ? p.images : []).filter(i => i && IMAGEN.test(i.url || ''))
      .map(i => (/^https?:/.test(i.url) ? i.url : url.replace(/\\/producto\\/.*$/, '') + i.url)),
    offers: {
      '@type': 'Offer',
      price: Number(p.price) || 0,
      priceCurrency: 'ARS',
      availability: d.comprable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url,
    },
  };
  // El JSON va dentro de un <script>: se neutraliza cualquier "</script>" que venga en un texto
  return '<script type="application/ld+json">' +
    JSON.stringify(datos).replace(/</g, '\\\\u003c') + '</script>';
}

function armar(html, { titulo, descripcion, cuerpoHtml, ld }) {
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
  if (ld) salida = salida.replace('</head>', ld + '\\n</head>');
  return salida;
}

function slugDe(p) {
  const m = /^\\/producto\\/([^/?#]+)\\/?$/.exec(p);
  if (!m) return null;
  try { return decodeURIComponent(m[1]).toLowerCase(); } catch { return m[1].toLowerCase(); }
}

async function middlewareFicha(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const slug = slugDe(req.path);
  if (!slug) return next();
  const html = cascara();
  if (!html) return next();

  let lista;
  try { lista = await productos(); } catch { return next(); }
  const p = lista.find(x => String(x.slug || '').toLowerCase() === slug);
  // Sin producto con ese slug se sigue de largo: lo resuelve el 404 del sitio
  if (!p) return next();

  const url = origenDe(req) + '/producto/' + encodeURIComponent(p.slug);
  const relacionados = lista
    .filter(x => x.id !== p.id && x.category && x.category === p.category && x.slug)
    .slice(0, 4);

  const salida = armar(html, {
    titulo: p.name,
    descripcion: (p.description || p.details || '').slice(0, 300),
    cuerpoHtml: cuerpo(p, relacionados),
    ld: jsonLd(p, url),
  });
  if (!salida) return next();
  res.type('html').send(salida);
}

module.exports = middlewareFicha;
module.exports.invalidar = function () { cache = null; cacheHasta = 0; };
`,
  }),
  pages: () => ({
    // Cáscara de la ficha. El middleware reemplaza lo que hay entre los dos comentarios WF-FICHA
    // con el producto ya renderizado. Lo horneado es el estado vacío: es lo que se ve en la vista
    // previa del Builder (sin servidor) y si alguien entra a /producto.html directamente.
    producto: {
      title: 'Producto',
      html: `  <section>
    <div class="container">
      <div id="fi-cuerpo">
        <!--WF-FICHA-INICIO-->
        <h1>Producto</h1>
        <p class="section-sub">Elegí un producto desde el catálogo para ver su ficha.</p>
        <p><a class="btn" href="/catalog.html">Ver el catálogo</a></p>
        <!--WF-FICHA-FIN-->
      </div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo ficha de producto. Lo que este archivo NO hace: renderizar la ficha. Eso lo arma el
   servidor (src/middleware/ficha.js), porque una ficha pintada por JavaScript no la ve ni Google ni
   el previsualizador de WhatsApp — y es justamente para eso que un producto tiene página propia.
   Acá quedan sólo las dos interacciones: cambiar la foto grande y agregar al carrito (usando
   window.WFCart, el punto de entrada del módulo Carrito, en vez de duplicar su formato).
   Fundido con Anime.js + red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Galería ----
  var thumbs = document.querySelectorAll('[data-fi-img]');
  if (thumbs.length) {
    thumbs.forEach(function (b) {
      b.addEventListener('click', function () {
        var foto = document.getElementById('fi-foto');
        if (!foto || foto.tagName !== 'IMG') return;
        var url = b.getAttribute('data-fi-img');
        if (foto.getAttribute('src') === url) return;
        thumbs.forEach(function (o) { o.setAttribute('aria-current', String(o === b)); });
        var anime = window.anime;
        if (!anime || !anime.animate || reduce) { foto.src = url; return; }
        anime.animate(foto, { opacity: [1, 0], duration: 130, ease: 'inQuad' });
        setTimeout(function () {
          foto.src = url;
          anime.animate(foto, { opacity: [0, 1], duration: 220, ease: 'outCubic' });
          // Red de seguridad: con la pestaña oculta el loop de Anime no corre y la foto quedaría
          // en opacidad 0, que es peor que no animar nada
          setTimeout(function () { foto.style.opacity = 1; }, 400);
        }, 140);
      });
    });
  }

  // ---- Agregar al carrito ----
  var boton = document.getElementById('fi-add');
  if (boton) {
    boton.addEventListener('click', function () {
      var id = boton.getAttribute('data-fi-id');
      var campo = document.getElementById('fi-qty');
      var qty = campo ? Number(campo.value) || 1 : 1;
      var tope = campo ? Number(campo.getAttribute('max')) || 99 : 99;
      if (qty > tope) { qty = tope; if (campo) campo.value = tope; }
      if (window.__PREVIEW__) { App.toast('Vista previa: se agregaría al carrito'); return; }
      if (!window.WFCart) { App.toast('El carrito no está disponible en esta página'); return; }
      // Si el producto se vende por variantes (módulo Variantes), sin combinación elegida no se
      // agrega nada: un pedido de "una remera" sin talle hay que resolverlo después por teléfono.
      // El selector lo pinta ese módulo; acá sólo se le pregunta qué eligió el visitante.
      var variantId = null;
      if (window.WFVariantes && window.WFVariantes.requiere(id)) {
        variantId = window.WFVariantes.seleccion();
        if (!variantId) { App.toast('Elegí una opción antes de agregar al carrito'); return; }
      }
      window.WFCart.agregar(id, qty, variantId);
      App.toast(qty > 1 ? qty + ' unidades agregadas al carrito' : 'Agregado al carrito');
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(boton, { scale: [1, 1.06, 1], duration: 340, ease: 'outCubic' });
        setTimeout(function () { boton.style.transform = 'none'; }, 500);
      }
    });
  }
})();`,
  readmeNotes: () => [
    `**Página de producto**: cada producto se sirve en \`/producto/<slug>\` con el HTML **armado por el servidor** (\`src/middleware/ficha.js\`) sobre la cáscara \`public/producto.html\`, así la ficha la ven Google y los previsualizadores de WhatsApp y LinkedIn. Emite **JSON-LD \`Product\`** con precio y **disponibilidad real** (\`InStock\`/\`OutOfStock\`) — es lo que Google usa para mostrar el precio bajo el resultado y lo que pide Google Shopping; por eso la disponibilidad sale del stock de verdad y no de un valor fijo. El slug lo genera **Gestión de productos** al crear el producto y **no cambia** al renombrarlo, para que los enlaces que ya circulan sigan funcionando. La moneda del dato estructurado está en \`ARS\`: cambiala en \`src/middleware/ficha.js\` si vendés en otra.`,
  ],
};
