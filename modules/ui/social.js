// Iconos SVG inline (trazos estilo feather) que heredan el color del texto del footer
const ICONOS = {
  instagram: '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  x: '<path d="M4 4l7.2 8.6L4.4 20h2.6l5.4-6 5 6H20l-7.5-9L19.4 4h-2.6l-4.9 5.5L7.4 4H4z"/>',
  youtube: '<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.92 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>',
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4V8h4v2a6 6 0 0 1 2-2z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
};

module.exports = {
  id: 'social', type: 'ui', name: 'Redes sociales',
  description: 'Íconos de redes sociales (Instagram, Facebook, X, YouTube, LinkedIn) en el footer de todas las páginas; se muestran solo las redes con URL cargada.',
  clientJs: () => `/* Módulo redes sociales: íconos en el footer de todas las páginas.
   Editá las URLs de REDES acá abajo; las que queden vacías ('') no se muestran. */
(function () {
  var REDES = [
    { red: 'Instagram', url: 'https://instagram.com/mi-empresa', icono: '${ICONOS.instagram}' },
    { red: 'Facebook', url: 'https://facebook.com/mi-empresa', icono: '${ICONOS.facebook}' },
    { red: 'X (Twitter)', url: 'https://x.com/mi-empresa', icono: '${ICONOS.x}' },
    { red: 'YouTube', url: '', icono: '${ICONOS.youtube}' },
    { red: 'LinkedIn', url: '', icono: '${ICONOS.linkedin}' },
  ];
  var activas = REDES.filter(function (r) { return r.url; });
  var footer = document.querySelector('footer .container');
  if (!footer || !activas.length) return;
  var bloque = document.createElement('nav');
  bloque.setAttribute('aria-label', 'Redes sociales');
  bloque.style.cssText = 'display:flex;gap:14px;align-items:center';
  activas.forEach(function (r) {
    var a = document.createElement('a');
    a.href = r.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', r.red);
    a.title = r.red;
    a.style.cssText = 'color:var(--muted);display:inline-flex';
    a.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + r.icono + '</svg>';
    a.addEventListener('mouseenter', function () { a.style.color = 'var(--accent)'; });
    a.addEventListener('mouseleave', function () { a.style.color = 'var(--muted)'; });
    bloque.appendChild(a);
  });
  footer.appendChild(bloque);
})();`,
  readmeNotes: () => [
    '**Redes sociales**: las URLs son placeholders; editá la constante `REDES` en `public/js/app.js` (buscá "redes sociales"). Las redes con URL vacía no se muestran.',
  ],
};
