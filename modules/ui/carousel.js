const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'carousel', type: 'ui', name: 'Carrusel',
  description: 'Carrusel de destacados con flechas, puntos y autoplay (se pausa al interactuar).',
  html: (cfg) => `  <section id="carrusel">
    <div class="container">
      <h2>Destacados</h2>
      <p class="section-sub">Lo mejor de ${cfg.brand.name}, en un vistazo.</p>
      <div class="carousel" style="position:relative;overflow:hidden;border-radius:var(--radius)" aria-roledescription="carrusel" aria-label="Destacados">
        <div class="carousel-track" style="display:flex;transition:transform .45s ease">
          ${[
            { t: 'Calidad garantizada', d: 'Cada detalle pensado para durar y funcionar.' },
            { t: 'Atención cercana', d: 'Te acompañamos antes, durante y después.' },
            { t: 'Precios claros', d: 'Sin sorpresas: sabés lo que pagás y por qué.' },
          ].map((s, i) => `<div class="carousel-slide" style="flex:0 0 100%;min-height:260px;display:flex;flex-direction:column;justify-content:center;padding:40px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) ${14 + i * 10}%,var(--surface)),var(--surface))">
            <h3 style="font-size:1.6rem;margin:0 0 8px">${s.t}</h3>
            <p class="muted" style="margin:0;max-width:48ch">${s.d}</p>
          </div>`).join('\n          ')}
        </div>
      </div>
    </div>
  </section>`,
  clientJs: () => `/* Módulo carrusel: controles, puntos y autoplay. Sin JS queda visible el primer
   slide (el track desborda oculto), así que la sección nunca aparece rota. */
(function () {
  var root = document.querySelector('.carousel');
  if (!root) return;
  var track = root.querySelector('.carousel-track');
  var slides = track.children;
  if (slides.length < 2) return;
  var style = document.createElement('style');
  style.textContent = '.carousel-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:2;' +
    'width:38px;height:38px;border:0;border-radius:50%;background:color-mix(in srgb,var(--bg) 80%,transparent);' +
    'color:var(--text);font-size:1.1rem;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.18)}' +
    '.carousel-arrow:hover{background:var(--bg)}' +
    '.carousel-dots{position:absolute;bottom:12px;left:0;right:0;display:flex;gap:8px;justify-content:center;z-index:2}' +
    '.carousel-dots button{width:10px;height:10px;border-radius:50%;border:0;cursor:pointer;padding:0;' +
    'background:color-mix(in srgb,var(--text) 30%,transparent)}' +
    '.carousel-dots button[aria-current="true"]{background:var(--accent)}';
  document.head.appendChild(style);
  var index = 0;
  var timer = null;
  // Sin autoplay si el visitante prefiere menos movimiento
  var autoplay = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var dots = document.createElement('div');
  dots.className = 'carousel-dots';
  for (var i = 0; i < slides.length; i++) {
    var d = document.createElement('button');
    d.type = 'button';
    d.dataset.index = i;
    d.setAttribute('aria-label', 'Ir al slide ' + (i + 1));
    dots.appendChild(d);
  }
  dots.addEventListener('click', function (e) {
    if (e.target.dataset && e.target.dataset.index !== undefined) go(Number(e.target.dataset.index), true);
  });
  function arrow(dir, label, icono, pos) {
    var b = document.createElement('button');
    b.className = 'carousel-arrow';
    b.type = 'button';
    b.innerHTML = icono;
    b.setAttribute('aria-label', label);
    b.style[pos] = '12px';
    b.addEventListener('click', function () { go(index + dir, true); });
    root.appendChild(b);
  }
  arrow(-1, 'Slide anterior', '${phIcon('caret-left', { size: 22 })}', 'left');
  arrow(1, 'Slide siguiente', '${phIcon('caret-right', { size: 22 })}', 'right');
  root.appendChild(dots);
  function go(i, manual) {
    index = (i + slides.length) % slides.length;
    track.style.transform = 'translateX(-' + index * 100 + '%)';
    for (var j = 0; j < dots.children.length; j++) {
      dots.children[j].setAttribute('aria-current', j === index ? 'true' : 'false');
    }
    // Una interacción manual reinicia el reloj del autoplay
    if (manual) start();
  }
  function start() {
    clearInterval(timer);
    if (autoplay) timer = setInterval(function () { go(index + 1); }, 5000);
  }
  // Pausa mientras el mouse o el foco están encima (accesibilidad y lectura)
  root.addEventListener('mouseenter', function () { clearInterval(timer); });
  root.addEventListener('mouseleave', start);
  root.addEventListener('focusin', function () { clearInterval(timer); });
  root.addEventListener('focusout', start);
  go(0);
  start();
})();`,
};
