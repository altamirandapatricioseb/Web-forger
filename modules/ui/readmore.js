const { esc } = require('../../src/templates');

// "Leer más / Leer menos": recorta textos largos a unas pocas líneas con un degradado
// al pie y un botón para expandir/plegar, animando la altura con Anime.js. Es mejora
// progresiva: el recorte lo agrega el JS, así que sin JS el texto se ve completo y legible.
// Se aplica a cualquier contenedor con data-readmore="N" (N = líneas visibles al plegar).
// La sección visible es una demo editable.
module.exports = {
  id: 'readmore', type: 'ui', name: 'Leer más',
  description: 'Recorta textos largos a unas líneas con botón "Leer más/menos" y degradado al pie, animando la altura con Anime.js. Sin JS el texto se ve completo. Se aplica con data-readmore="N".',
  usesAnime: true,
  html: (cfg) => `  <section id="leer-mas">
    <div class="container" style="max-width:720px">
      <h2>Sobre nosotros</h2>
      <div class="readmore" data-readmore="4">
        <p class="muted">${esc(cfg.texts.about)} Este bloque de ejemplo muestra cómo un texto largo se recorta a unas pocas líneas con un botón para seguir leyendo. Reemplazá este contenido por tu historia, la descripción de un servicio o cualquier texto extenso.</p>
        <p class="muted">Podés aplicar el recorte a cualquier bloque agregándole <code>data-readmore="4"</code> (el número indica cuántas líneas se ven al plegar). Duplicá o editá esta sección según lo necesites.</p>
      </div>
    </div>
  </section>`,
  head: () => `  <style>
    .readmore.readmore-activo{position:relative;overflow:hidden}
    .readmore-fade{position:absolute;left:0;right:0;bottom:0;height:64px;pointer-events:none;background:linear-gradient(to bottom, transparent, var(--bg));opacity:1;transition:opacity .3s}
    .readmore-abierto .readmore-fade{opacity:0}
    .readmore-btn{margin-top:12px;background:none;border:0;padding:0;color:var(--accent);font:inherit;font-weight:600;cursor:pointer;width:auto}
    .readmore-btn:hover{text-decoration:underline}
  </style>`,
  clientJs: () => `/* Módulo "leer más": recorta contenedores [data-readmore="N"] a N líneas y agrega un
   botón para expandir/plegar, animando la altura con Anime.js. Mejora progresiva: el
   recorte lo agrega este JS, así que sin él el texto queda completo. Respeta
   "prefers-reduced-motion" (salta sin animar). */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function preparar() {
    var bloques = document.querySelectorAll('[data-readmore]');
    if (!bloques.length) return;
    bloques.forEach(function (el) {
      if (el._readmore) return;
      var lineas = parseInt(el.getAttribute('data-readmore'), 10) || 4;
      var lh = parseFloat(getComputedStyle(el).lineHeight) || 24;
      var recortada = Math.round(lh * lineas);
      // Si el texto ya entra en el alto plegado, no hace falta recortar
      if (el.scrollHeight <= recortada + 8) return;
      el._readmore = true;
      el.classList.add('readmore-activo');
      el.style.height = recortada + 'px';
      // Degradado al pie que insinúa que hay más texto
      var fade = document.createElement('div');
      fade.className = 'readmore-fade';
      el.appendChild(fade);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'readmore-btn';
      btn.textContent = 'Leer más';
      btn.setAttribute('aria-expanded', 'false');
      el.insertAdjacentElement('afterend', btn);
      var abierto = false;
      function medirCompleto() {
        // Alto real del contenido: se mide con altura auto momentánea
        var previo = el.style.height;
        el.style.height = 'auto';
        var full = el.scrollHeight;
        el.style.height = previo;
        return full;
      }
      btn.addEventListener('click', function () {
        var anime = window.anime;
        var full = medirCompleto();
        var destino = abierto ? recortada : full;
        var desde = abierto ? full : recortada;
        el.classList.toggle('readmore-abierto', !abierto);
        function terminar() {
          // Al expandir dejamos altura auto para que el texto fluya si cambia el ancho
          el.style.height = abierto ? '' : 'auto';
          if (abierto) el.style.height = recortada + 'px';
        }
        if (anime && anime.animate && !reduce) {
          el.style.height = desde + 'px';
          anime.animate(el, { height: [desde, destino], duration: 320, ease: 'inOutQuad', onComplete: terminar });
          setTimeout(terminar, 380); // red de seguridad si el loop está pausado
        } else {
          el.style.height = abierto ? recortada + 'px' : 'auto';
        }
        abierto = !abierto;
        btn.textContent = abierto ? 'Leer menos' : 'Leer más';
        btn.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', preparar);
  else preparar();
})();`,
  readmeNotes: () => [
    '**Leer más**: agregá `data-readmore="4"` a cualquier contenedor de texto largo para recortarlo a esa cantidad de líneas con un botón "Leer más/menos" (el número es la cantidad de líneas visibles al plegar). La sección de demo (`#leer-mas`) es editable o borrable.',
  ],
};
