const { esc, txt, txtList } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

// Reseñas placeholder editables desde el Builder: texto, autor y rol/empresa.
const ITEMS = [
  { q: 'Desde que trabajamos juntos, todo es más simple. El equipo responde rápido y se nota el compromiso.', a: 'Laura Giménez', r: 'Dueña, Café del Centro' },
  { q: 'Cumplieron con los tiempos y superaron lo que esperábamos. Los recomiendo sin dudarlo.', a: 'Martín Rossi', r: 'Gerente, Rossi Logística' },
  { q: 'Atención impecable de principio a fin. Volvería a elegirlos las veces que haga falta.', a: 'Carla Méndez', r: 'Emprendedora' },
];

// Default del campo editable: exactamente las reseñas de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ITEMS_DEFAULT = ITEMS.map(it => `${it.q} | ${it.a} | ${it.r}`).join('\n');

// Lista efectiva de testimonios según la config del Builder.
// Formatos aceptados por línea: "frase | autor | rol", "frase | autor" o sólo "frase".
function testimonios(cfg) {
  const lineas = txtList(cfg, 'testimonialslider', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return ITEMS;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = ITEMS[i % ITEMS.length];
    if (partes.length >= 3) return { q: partes.slice(0, -2).join(' | '), a: partes[partes.length - 2], r: partes[partes.length - 1] };
    if (partes.length === 2) return { q: partes[0], a: partes[1], r: '' };
    return { q: partes[0], a: base.a, r: base.r };
  });
}

// Testimonios en carrusel automático: rota solo, con flechas y puntos.
// Standalone (no depende del módulo "testimonios"): trae sus propias reseñas placeholder.
// Sin JS se ven todos los testimonios apilados (nada se rompe); los controles los crea el JS.
module.exports = {
  id: 'testimonialslider', type: 'ui', name: 'Testimonios en carrusel',
  description: 'Carrusel de testimonios que rota automáticamente, con flechas y puntos. Pausa al pasar el mouse y respeta la preferencia de menos movimiento.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Lo que dicen nuestros clientes', max: 80 },
    {
      key: 'items', label: 'Testimonios', type: 'list', max: 2000, default: ITEMS_DEFAULT,
      hint: 'Un testimonio por línea: frase | autor | rol o empresa. Ejemplo: "Cumplieron con los tiempos. | Martín Rossi | Gerente, Rossi Logística". Con dos o más testimonios el carrusel rota solo.',
    },
  ],
  html: (cfg) => {
    const slides = testimonios(cfg).map((it, i) => `<li class="ts-slide"${i === 0 ? ' data-first' : ''}>
          <blockquote class="ts-quote">“${esc(it.q)}”</blockquote>
          <p class="ts-author"><strong>${esc(it.a)}</strong><br><span class="muted">${esc(it.r)}</span></p>
        </li>`).join('\n        ');
    return `  <section id="testimonios-carrusel">
    <div class="container">
      <h2>${esc(txt(cfg, 'testimonialslider', 'titulo', 'Lo que dicen nuestros clientes'))}</h2>
      <div class="ts" data-ts>
        <ul class="ts-slides" aria-live="polite">
        ${slides}
        </ul>
      </div>
    </div>
  </section>`;
  },
  clientJs: () => `// Módulo testimonios en carrusel: muestra uno por vez, rota solo y crea los controles.
// Sin JS quedan todos visibles apilados. Con prefers-reduced-motion no autoavanza,
// pero las flechas y los puntos siguen funcionando.
(function () {
  var raiz = document.querySelector('.ts[data-ts]');
  if (!raiz) return;
  var lista = raiz.querySelector('.ts-slides');
  var slides = Array.prototype.slice.call(raiz.querySelectorAll('.ts-slide'));
  if (slides.length < 2) return;

  var estilo = document.createElement('style');
  estilo.textContent =
    '.ts{position:relative;max-width:720px;margin:8px auto 0}' +
    '.ts-slides{list-style:none;margin:0;padding:0}' +
    '.ts-js .ts-slide{display:none}' +
    '.ts-js .ts-slide.ts-active{display:block}' +
    '.ts-slide{text-align:center;padding:12px 8px}' +
    '.ts-quote{font-size:1.2rem;line-height:1.5;margin:0 0 16px;font-style:italic}' +
    '.ts-author{margin:0}' +
    '.ts-nav{position:absolute;top:38%;transform:translateY(-50%);background:var(--surface);' +
    'border:1px solid var(--line);color:var(--text);width:40px;height:40px;border-radius:999px;' +
    'font-size:1.4rem;line-height:1;cursor:pointer;padding:0}' +
    '.ts-nav:hover{color:var(--accent);border-color:var(--accent)}' +
    '.ts-prev{left:-8px}.ts-next{right:-8px}' +
    '.ts-dots{display:flex;gap:8px;justify-content:center;margin-top:14px}' +
    '.ts-dot{width:10px;height:10px;padding:0;border-radius:999px;border:1px solid var(--accent);' +
    'background:transparent;cursor:pointer}' +
    '.ts-dot[aria-current="true"]{background:var(--accent)}';
  document.head.appendChild(estilo);
  raiz.classList.add('ts-js');

  var actual = 0;
  function mostrar(i) {
    actual = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) { s.classList.toggle('ts-active', k === actual); });
    dots.forEach(function (d, k) { d.setAttribute('aria-current', k === actual ? 'true' : 'false'); });
  }

  // Flechas anterior/siguiente
  function flecha(clase, etiqueta, icono, salto) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ts-nav ' + clase;
    b.setAttribute('aria-label', etiqueta);
    b.innerHTML = icono;
    b.addEventListener('click', function () { mostrar(actual + salto); reiniciar(); });
    return b;
  }
  raiz.appendChild(flecha('ts-prev', 'Testimonio anterior', '${phIcon('caret-left', { size: 20 })}', -1));
  raiz.appendChild(flecha('ts-next', 'Testimonio siguiente', '${phIcon('caret-right', { size: 20 })}', 1));

  // Puntos de navegación
  var cajaDots = document.createElement('div');
  cajaDots.className = 'ts-dots';
  var dots = slides.map(function (s, i) {
    var d = document.createElement('button');
    d.type = 'button';
    d.className = 'ts-dot';
    d.setAttribute('aria-label', 'Ir al testimonio ' + (i + 1));
    d.addEventListener('click', function () { mostrar(i); reiniciar(); });
    cajaDots.appendChild(d);
    return d;
  });
  raiz.appendChild(cajaDots);

  mostrar(0);

  // Autoavance, salvo que el visitante prefiera menos movimiento
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var timer = null;
  function reiniciar() {
    if (reduce) return;
    clearInterval(timer);
    timer = setInterval(function () { mostrar(actual + 1); }, 6000);
  }
  raiz.addEventListener('mouseenter', function () { clearInterval(timer); });
  raiz.addEventListener('mouseleave', reiniciar);
  reiniciar();
})();`,
  readmeNotes: () => [
    '**Testimonios en carrusel**: las reseñas (texto, autor y rol) son placeholders; editalas en la sección `testimonios-carrusel` de la Home (`public/index.html`).',
  ],
};
