// Escape local para valores que van a atributos HTML del <head>
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

module.exports = {
  id: 'seo', type: 'ui', name: 'SEO básico',
  description: 'Meta descripción, Open Graph, theme-color, datos estructurados (JSON-LD), robots.txt y sitemap.xml con las páginas públicas del sitio.',
  head: (cfg, page) => {
    // La descripción sale de los textos del negocio, recortada al largo que muestran los buscadores
    const desc = String(cfg.texts.about || cfg.brand.tagline).slice(0, 155);
    // JSON-LD de la organización; < evita cerrar el <script> desde los datos
    const ldjson = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: cfg.brand.name,
      slogan: cfg.brand.tagline,
      description: desc,
      ...(cfg.brand.domain ? { url: cfg.brand.domain } : {}),
    }).replace(/</g, '\\u003c');
    // Con dominio cargado en el Builder se agregan canonical y og:url absolutas por página
    // (sin dominio se omiten: una URL placeholder en el head confunde a los buscadores)
    const urlAbs = cfg.brand.domain
      ? `${cfg.brand.domain}${page.active === '/index.html' ? '/' : page.active}`
      : '';
    return `  <meta name="description" content="${esc(desc)}">
  <meta property="og:title" content="${esc(page.title)} — ${esc(cfg.brand.name)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(cfg.brand.name)}">
${urlAbs ? `  <meta property="og:url" content="${esc(urlAbs)}">\n  <link rel="canonical" href="${esc(urlAbs)}">\n` : ''}  <meta name="theme-color" content="${cfg.brand.colors.accent}">
  <script type="application/ld+json">${ldjson}</script>`;
  },
  files: (cfg, ctx = { pages: [] }) => {
    // Dominio placeholder: el sitemap necesita URLs absolutas (acción humana avisada en el README)
    // Si el campo "Dominio" del Builder está completo, se usa ese y no hace falta tocar nada
    const DOMINIO = cfg.brand.domain || 'https://TU-DOMINIO.com';
    // Páginas de uso interno (login, paneles de gestión) que no van al sitemap
    const PRIVADAS = ['auth.html', 'registro.html', 'dashboard.html', 'admin.html', 'inbox.html', 'pos.html', 'inventory.html', 'products.html', 'users.html', 'visits.html', 'repositores.html', 'favorites.html', 'agent.html', 'leads.html'];
    const urls = ctx.pages
      .filter(p => !PRIVADAS.includes(p))
      .map(p => `  <url><loc>${DOMINIO}/${p === 'index.html' ? '' : p}</loc></url>`)
      .join('\n');
    return {
      'public/robots.txt': `# Permitir el rastreo de todo el sitio\nUser-agent: *\nAllow: /\n\nSitemap: ${DOMINIO}/sitemap.xml\n`,
      'public/sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    };
  },
  readmeNotes: (cfg) => [
    cfg.brand.domain
      ? `**SEO**: la meta descripción sale del texto "Sobre nosotros" del Builder; revisala en los \`<head>\` de \`public/*.html\`. El sitemap (\`public/sitemap.xml\`), \`robots.txt\` y las metas og:url/canonical ya usan tu dominio (${cfg.brand.domain}).`
      : '**SEO**: la meta descripción sale del texto "Sobre nosotros" del Builder; revisala en los `<head>` de `public/*.html`. El sitemap se genera en `public/sitemap.xml` con las páginas públicas del sitio: reemplazá `https://TU-DOMINIO.com` por tu dominio real ahí y en `public/robots.txt` cuando lo tengas (o completá el campo "Dominio" del Builder y volvé a exportar).',
  ],
};
