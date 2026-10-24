const { esc } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

// Feed social estilo Instagram: grilla de placeholders cuadrados con overlay al pasar el
// mouse (corazón + cantidad de "me gusta") y un botón "Seguinos @usuario" que enlaza al
// perfil. Frontend puro, sin API de Instagram (que requiere token y app aprobada): son
// placeholders editables, ideal para deploy gratis. La entrada en cascada se anima con
// Anime.js (con red de seguridad si el loop está pausado) y respeta
// "prefers-reduced-motion". Distinto de "Galería"/"Mosaico": imita el feed de una red
// social con su llamada a seguir la cuenta.
const USUARIO = 'tu_negocio'; // handle sin @ (editable)
const PERFIL = 'https://instagram.com/tu_negocio'; // URL del perfil (editable)

// Cada casillero: cantidad de "me gusta" mostrada en el overlay
const POSTS = [128, 342, 96, 511, 74, 208, 155, 89];

module.exports = {
  id: 'socialfeed', type: 'ui', name: 'Feed social',
  description: 'Grilla estilo Instagram con overlay de "me gusta" al pasar el mouse y botón para seguir el perfil. Placeholders editables (sin API), con entrada animada con Anime.js.',
  usesAnime: true,
  html: () => {
    const tiles = POSTS.map((likes, i) => `        <a class="social-tile" href="${esc(PERFIL)}" target="_blank" rel="noopener" aria-label="Ver publicación ${i + 1} en el perfil">
          <span class="social-ph muted">Foto ${i + 1}</span>
          <span class="social-hover">${phIcon('heart-fill', { size: 14 })} ${likes}</span>
        </a>`).join('\n');
    return `  <section id="feed-social">
    <div class="container">
      <h2>Seguinos en redes</h2>
      <p class="section-sub">Mirá lo último que compartimos en nuestro perfil.</p>
      <div class="social-grid" id="social-grid">
${tiles}
      </div>
      <p style="text-align:center;margin-top:24px">
        <a class="btn" id="social-seguir" href="${esc(PERFIL)}" target="_blank" rel="noopener">Seguinos @${esc(USUARIO)}</a>
      </p>
    </div>
  </section>`;
  },
  head: () => `  <style>
    .social-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    .social-tile{position:relative;aspect-ratio:1/1;border-radius:var(--radius);overflow:hidden;display:flex;align-items:center;justify-content:center;
      text-decoration:none;background:linear-gradient(135deg,var(--surface),color-mix(in srgb,var(--accent) 24%,var(--surface)))}
    .social-ph{font-size:.9rem}
    .social-hover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;color:#fff;
      background:rgba(0,0,0,.45);opacity:0;transition:opacity .2s ease}
    .social-tile:hover .social-hover,.social-tile:focus-visible .social-hover{opacity:1}
    @media (max-width:640px){.social-grid{grid-template-columns:repeat(2,1fr)}}
  </style>`,
  clientJs: () => `/* Módulo feed social: entrada en cascada de los casilleros la primera vez que se ven.
   El overlay de "me gusta" es CSS (hover/focus); esto sólo anima la aparición. */
(function () {
  var grid = document.getElementById('social-grid');
  if (!grid) return;
  var items = Array.prototype.slice.call(grid.querySelectorAll('.social-tile'));
  if (!items.length) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var anime = window.anime;
  if (!anime || !anime.animate || reduce) return;
  function animar() {
    anime.animate(items, { opacity: [0, 1], scale: [0.9, 1], duration: 500, delay: anime.stagger ? anime.stagger(55) : 0, ease: 'outQuad' });
    // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
    setTimeout(function () { items.forEach(function (it) { it.style.opacity = '1'; it.style.transform = ''; }); }, 1300);
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
    '**Feed social**: el usuario (`USUARIO`), la URL del perfil (`PERFIL`) y la cantidad de casilleros/“me gusta” (`POSTS`) se editan en `modules/ui/socialfeed.js`. Son placeholders (sin API de Instagram): reemplazá cada `.social-ph` por una `<img>` con la foto real de tu publicación.',
  ],
};
