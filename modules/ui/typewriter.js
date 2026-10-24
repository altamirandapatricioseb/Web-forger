module.exports = {
  id: 'typewriter', type: 'ui', name: 'Titular con palabras rotativas',
  description: 'Franja con un titular donde una palabra se reescribe sola (efecto máquina de escribir), rotando entre varios servicios o rubros. Vanilla JS; con "menos movimiento" muestra la primera palabra fija.',
  // Efecto typewriter en JS puro: es la herramienta correcta (escritura letra a letra).
  // No usa Anime.js a propósito; degrada a texto fijo si el visitante pide menos movimiento.
  html: () => `  <section class="tw-band">
    <div class="container">
      <p class="tw-line">Hacemos <span class="tw-rot" data-tw-rot aria-live="polite">diseño web</span><span class="tw-cursor" aria-hidden="true"></span></p>
    </div>
  </section>`,
  head: () => `  <style>
    .tw-band{background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:44px 0}
    .tw-line{font-size:clamp(1.4rem,3.4vw,2.2rem);font-weight:800;letter-spacing:-.02em;margin:0;text-align:center}
    .tw-rot{color:var(--accent)}
    .tw-cursor{display:inline-block;width:2px;height:1em;margin-left:2px;vertical-align:-.12em;background:var(--accent)}
    @media (prefers-reduced-motion: no-preference){.tw-cursor{animation:tw-parpadeo 1s step-end infinite}}
    @keyframes tw-parpadeo{50%{opacity:0}}
  </style>`,
  clientJs: () => `// Módulo titular rotativo: reescribe una palabra letra a letra y va rotando la lista.
// Editá PALABRAS para cambiar los rubros. Sin JS queda "diseño web" (la del HTML).
(function () {
  var el = document.querySelector('[data-tw-rot]');
  if (!el) return;
  var PALABRAS = ['diseño web', 'marketing digital', 'tiendas online', 'identidad de marca'];
  if (!PALABRAS.length) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Con menos movimiento: sin escritura, la primera palabra fija (accesible y estable)
  if (reduce) { el.textContent = PALABRAS[0]; return; }
  var i = 0, pos = 0, borrando = false;
  function paso() {
    var palabra = PALABRAS[i % PALABRAS.length];
    if (!borrando) {
      pos++;
      el.textContent = palabra.slice(0, pos);
      if (pos >= palabra.length) { borrando = true; return setTimeout(paso, 1400); }
      setTimeout(paso, 85);
    } else {
      pos--;
      el.textContent = palabra.slice(0, pos);
      if (pos <= 0) { borrando = false; i++; return setTimeout(paso, 260); }
      setTimeout(paso, 40);
    }
  }
  el.textContent = '';
  setTimeout(paso, 600);
})();`,
  readmeNotes: () => [
    '**Titular con palabras rotativas**: editá la lista `PALABRAS` en `public/js/app.js` (buscá "titular rotativo") para poner tus rubros o servicios. El texto fijo de respaldo está en la sección `tw-band` de `public/index.html`.',
  ],
};
