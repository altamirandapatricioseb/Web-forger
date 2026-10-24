// Índice "En esta página": arma solo una tarjeta con los títulos (h2/h3) del contenido
// y resalta el que se está viendo al scrollear, con salto suave al hacer clic. Pensado
// para páginas largas (artículos del blog, textos legales, guías). No aporta HTML: se
// construye desde el JS leyendo los encabezados. Si hay menos de 3, o en pantalla angosta,
// no aparece (no estorba en móvil). Distinto de la navegación por puntos (sectionnav):
// esto es una lista con texto a la izquierda, ideal para lectura larga.
module.exports = {
  id: 'toc', type: 'ui', name: 'Índice de página',
  description: 'Tarjeta flotante "En esta página" que se arma sola con los títulos del contenido y marca el visible al scrollear, con salto suave. Ideal para artículos y textos largos. Vanilla JS; en móvil no aparece.',
  head: () => `  <style>
    .toc-box{position:fixed;top:96px;left:calc((100vw - 1080px)/2 - 200px);width:190px;max-height:70vh;overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;font-size:.85rem;z-index:8}
    .toc-box strong{display:block;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 8px}
    .toc-box a{display:block;color:var(--muted);text-decoration:none;padding:4px 0 4px 10px;border-left:2px solid var(--line);line-height:1.35}
    .toc-box a.nivel-3{padding-left:20px;font-size:.8rem}
    .toc-box a:hover{color:var(--text)}
    .toc-box a.toc-activo{color:var(--accent);border-left-color:var(--accent);font-weight:600}
    @media (max-width:1420px){.toc-box{display:none}}
    @media (prefers-reduced-motion: reduce){.toc-box a{transition:none}}
  </style>`,
  clientJs: () => `/* Módulo índice de página: construye una tarjeta con los encabezados del contenido y
   marca el activo al scrollear. Sólo se muestra si hay al menos 3 títulos y hay espacio
   lateral (CSS lo esconde por debajo de 1420px). No toca el HTML de origen salvo para
   darle un id a cada título que no lo tenga. */
(function () {
  // Toma los h2/h3 dentro de secciones/artículo, salteando el hero y la navbar
  var contenedor = document.querySelector('main') || document.body;
  var titulos = [].slice.call(contenedor.querySelectorAll('section h2, article h2, section h3, article h3'))
    .filter(function (h) { return !h.closest('.hero') && (h.textContent || '').trim(); });
  if (titulos.length < 3) return;
  function slugify(t) {
    return t.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'seccion';
  }
  var usados = {};
  var box = document.createElement('nav');
  box.className = 'toc-box';
  box.setAttribute('aria-label', 'Índice de la página');
  var html = '<strong>En esta página</strong>';
  var enlaces = [];
  titulos.forEach(function (h) {
    if (!h.id) {
      var base = slugify(h.textContent.trim()).slice(0, 40);
      var id = base; var n = 2;
      while (usados[id] || document.getElementById(id)) { id = base + '-' + n; n++; }
      usados[id] = true; h.id = id;
    } else { usados[h.id] = true; }
    var nivel = h.tagName === 'H3' ? ' nivel-3' : '';
    html += '<a href="#' + h.id + '" class="toc-link' + nivel + '" data-id="' + h.id + '">' + App.esc(h.textContent.trim()) + '</a>';
  });
  box.innerHTML = html;
  document.body.appendChild(box);
  enlaces = [].slice.call(box.querySelectorAll('.toc-link'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Salto suave al hacer clic
  box.addEventListener('click', function (e) {
    var a = e.target.closest('.toc-link');
    if (!a) return;
    e.preventDefault();
    var dest = document.getElementById(a.getAttribute('data-id'));
    if (dest) dest.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
  // Marca el título visible con IntersectionObserver
  if (!('IntersectionObserver' in window)) { if (enlaces[0]) enlaces[0].classList.add('toc-activo'); return; }
  var visibles = {};
  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (en) { visibles[en.target.id] = en.isIntersecting; });
    // Marca el primero de los títulos que están en pantalla
    var activo = titulos.map(function (h) { return h.id; }).filter(function (id) { return visibles[id]; })[0];
    if (!activo) return;
    enlaces.forEach(function (a) { a.classList.toggle('toc-activo', a.getAttribute('data-id') === activo); });
  }, { rootMargin: '-80px 0px -70% 0px' });
  titulos.forEach(function (h) { obs.observe(h); });
})();`,
  readmeNotes: () => [
    '**Índice de página**: se arma solo con los títulos `<h2>`/`<h3>` del contenido y sólo aparece en pantallas anchas (más de 1420px) con al menos 3 títulos. Ideal para páginas con artículos largos o textos legales; no requiere configuración.',
  ],
};
