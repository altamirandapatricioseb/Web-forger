// Galería tipo mosaico (masonry): tarjetas de alturas variables acomodadas en columnas
// tipo Pinterest usando CSS "columns" (layout puro CSS, sin JS ni librerías de masonry:
// deployable gratis). Los mosaicos son placeholders con gradiente (como la galería), pero
// de proporciones distintas para dar el efecto mosaico; reemplazalos por <img> reales.
// La entrada en cascada se anima con Anime.js (con red de seguridad si el loop está
// pausado) y respeta "prefers-reduced-motion". Distinta de "Galería" (grilla uniforme):
// esta es un mosaico de alturas irregulares.
const RATIOS = ['4 / 5', '1 / 1', '3 / 4', '4 / 3', '1 / 1', '3 / 5', '4 / 3', '1 / 1', '3 / 4'];

module.exports = {
  id: 'masonry', type: 'ui', name: 'Galería mosaico',
  description: 'Galería tipo mosaico (masonry) con tarjetas de alturas variables en columnas al estilo Pinterest. Layout con CSS columns (sin librerías) y entrada animada con Anime.js.',
  usesAnime: true,
  html: () => {
    const tiles = RATIOS.map((r, i) => `        <figure class="mosaic-item" style="aspect-ratio:${r}">
          <span class="muted">Imagen ${i + 1}</span>
        </figure>`).join('\n');
    return `  <section id="mosaico">
    <div class="container">
      <h2>Mosaico de trabajos</h2>
      <p class="section-sub">Una selección de nuestro trabajo en formato mosaico.</p>
      <div class="mosaic" id="mosaic-grid">
${tiles}
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    .mosaic{columns:3 240px;column-gap:16px}
    .mosaic-item{break-inside:avoid;margin:0 0 16px;border-radius:var(--radius);overflow:hidden;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,var(--surface),color-mix(in srgb,var(--accent) 22%,var(--surface)));transition:transform .25s ease,box-shadow .25s ease}
    .mosaic-item:hover{transform:translateY(-4px);box-shadow:0 12px 30px rgba(0,0,0,.16)}
    .mosaic-item img{width:100%;height:100%;object-fit:cover;display:block}
    @media (max-width:560px){.mosaic{columns:2 140px}}
  </style>`,
  clientJs: () => `/* Módulo galería mosaico: entrada en cascada de los mosaicos la primera vez que se
   ven. El layout en columnas es 100% CSS; esto sólo agrega la animación de aparición. */
(function () {
  var grid = document.getElementById('mosaic-grid');
  if (!grid) return;
  var items = Array.prototype.slice.call(grid.querySelectorAll('.mosaic-item'));
  if (!items.length) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var anime = window.anime;
  if (!anime || !anime.animate || reduce) return;
  // Anima cuando la galería entra en pantalla (o de una si no hay IntersectionObserver)
  function animar() {
    anime.animate(items, { opacity: [0, 1], translateY: [24, 0], duration: 560, delay: anime.stagger ? anime.stagger(60) : 0, ease: 'outQuad' });
    // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
    setTimeout(function () { items.forEach(function (it) { it.style.opacity = '1'; it.style.transform = ''; }); }, 1400);
  }
  items.forEach(function (it) { it.style.opacity = '0'; });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entradas, obs) {
      if (entradas.some(function (e) { return e.isIntersecting; })) { animar(); obs.disconnect(); }
    }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(grid);
  } else {
    animar();
  }
})();`,
  readmeNotes: () => [
    '**Galería mosaico**: los mosaicos son placeholders con gradiente; reemplazá cada `<figure class="mosaic-item">` por una imagen real (`<figure class="mosaic-item"><img src="…" alt="…"></figure>`) en la sección `#mosaico` de `public/index.html`. Las proporciones se editan en la constante `RATIOS` de `modules/ui/masonry.js`.',
  ],
};
