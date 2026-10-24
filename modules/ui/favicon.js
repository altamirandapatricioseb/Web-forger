module.exports = {
  id: 'favicon', type: 'ui', name: 'Favicon de marca',
  description: 'Favicon SVG generado con la inicial de la marca sobre el color de acento. Sin archivos de imagen: va inline en el <head> de todas las páginas.',
  head: (cfg) => {
    // Primera letra o número del nombre de la marca; si no hay, cae en un punto
    const m = String(cfg.brand.name).match(/[a-zA-Z0-9À-ÿÑñ]/);
    const inicial = (m ? m[0] : '·').toUpperCase();
    // El SVG viaja como data URI, así el proyecto no suma archivos binarios
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" rx="14" fill="${cfg.brand.colors.accent}"/>` +
      `<text x="32" y="44" font-family="Arial, sans-serif" font-size="36" font-weight="bold" text-anchor="middle" fill="#ffffff">${inicial}</text></svg>`;
    return `  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(svg)}">`;
  },
};
