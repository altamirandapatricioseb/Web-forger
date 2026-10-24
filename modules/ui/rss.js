// Los artículos viven en blog.js (una sola fuente de verdad para sección, páginas y RSS).
// Se usa el helper `posts(cfg)`, no la constante: así el feed anuncia los mismos artículos
// que la Home cuando el cliente los edita desde el Builder.
const { posts } = require('./blog');

// Escape local para texto que va dentro del XML del feed
const xml = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = {
  id: 'rss', type: 'ui', name: 'Feed RSS del blog',
  description: 'Genera public/feed.xml con los artículos del blog y lo anuncia en el <head> para lectores y agregadores RSS.',
  // El feed enlaza a la página de cada artículo, así que necesita blogpages (y este a blog)
  requires: ['blogpages'],
  head: (cfg) => `  <link rel="alternate" type="application/rss+xml" title="${xml(cfg.brand.name)} — Novedades" href="/feed.xml">`,
  files: (cfg) => {
    // El RSS requiere URLs absolutas: usa el dominio del Builder o un placeholder avisado en el README
    const DOMINIO = cfg.brand.domain || 'https://TU-DOMINIO.com';
    // Los artículos ya vienen ordenados del más nuevo al más viejo en blog.js
    const items = posts(cfg).map(p => `    <item>
      <title>${xml(p.titulo)}</title>
      <link>${DOMINIO}/blog-${p.slug}.html</link>
      <guid isPermaLink="true">${DOMINIO}/blog-${p.slug}.html</guid>
      <pubDate>${new Date(p.fechaISO + 'T12:00:00Z').toUTCString()}</pubDate>
      <description>${xml(p.resumen)}</description>
    </item>`).join('\n');
    return {
      'public/feed.xml': `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xml(cfg.brand.name)} — Novedades</title>
    <link>${DOMINIO}/</link>
    <description>${xml(cfg.texts.about || cfg.brand.tagline)}</description>
    <language>es</language>
${items}
  </channel>
</rss>
`,
    };
  },
  readmeNotes: (cfg) => [
    cfg.brand.domain
      ? '**Feed RSS**: `public/feed.xml` ya usa tu dominio. Si agregás artículos al blog, sumá su `<item>` al feed para que los lectores RSS se enteren.'
      : '**Feed RSS**: los links de `public/feed.xml` usan el placeholder `https://TU-DOMINIO.com`; reemplazalo por tu dominio real (o completá el campo "Dominio" del Builder y volvé a exportar).',
  ],
};
