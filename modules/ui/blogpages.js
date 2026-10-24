// Los artículos viven en blog.js (una sola fuente de verdad para sección, páginas y RSS).
// Se usa el helper `posts(cfg)`, no la constante: así estas páginas muestran los mismos
// artículos que la Home cuando el cliente los edita desde el Builder.
const { posts } = require('./blog');
const { esc } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'blogpages', type: 'ui', name: 'Blog con páginas por artículo',
  description: 'Cada novedad del blog gana su propia página con URL propia (mejor para SEO y para compartir); la sección de la Home enlaza a ellas y el sitemap las incluye solo.',
  // Sin la sección de blog no hay artículos: el generador la agrega sola si falta
  requires: ['blog'],
  pages: (cfg) => Object.fromEntries(posts(cfg).map(p => [`blog-${p.slug}`, {
    title: p.titulo,
    html: `  <section>
    <div class="container" style="max-width:760px">
      <p class="muted" style="margin:0 0 6px;font-size:.85rem">${esc(p.fecha)}</p>
      <h2 style="font-size:2.1rem">${esc(p.titulo)}</h2>
${p.parrafos.map(t => `      <p style="font-size:1.05rem">${esc(t)}</p>`).join('\n')}
      <p style="margin-top:36px"><a href="/index.html#blog" style="display:inline-flex;align-items:center;gap:4px">${phIcon('arrow-left', { size: 14 })} Volver a novedades</a></p>
    </div>
  </section>`,
  }])),
  readmeNotes: () => [
    '**Blog con páginas por artículo**: la fecha, el título y el resumen de cada artículo salen del bloque *Textos por sección* del Builder (sección Blog); el cuerpo de cada uno es placeholder y se edita en su página `public/blog-*.html`. Para agregar un artículo nuevo, duplicá una página `blog-*.html` y sumá su tarjeta en la Home (y su entrada en `public/feed.xml` si usás el módulo RSS).',
  ],
};
