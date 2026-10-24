// Imagen interactiva con puntos ("hotspots"): sobre una imagen se colocan pines que,
// al hacer clic o pasar el foco, muestran un cartelito con info. Ideal para recorridos
// de producto, planos, mapas de features o "cómo funciona" visual. Los pines laten
// suavemente con Anime.js para llamar la atención (decorativo: sin la librería o con
// "menos movimiento" quedan quietos pero siguen siendo botones). La imagen es un
// placeholder degradado editable; los pines y sus textos son placeholder.
const PINES = [
  { x: 26, y: 34, titulo: 'Materiales premium', texto: 'Terminaciones que duran años sin perder su aspecto.' },
  { x: 62, y: 28, titulo: 'Diseño ergonómico', texto: 'Pensado para el uso diario, cómodo desde el primer momento.' },
  { x: 45, y: 68, titulo: 'Detalle a medida', texto: 'Cada pieza revisada una por una antes de salir.' },
];

module.exports = {
  id: 'imagehotspots', type: 'ui', name: 'Imagen interactiva',
  description: 'Imagen con puntos interactivos ("hotspots") que revelan información al hacer clic o foco. Los pines laten con Anime.js. Ideal para recorridos de producto, planos o mapas de características. Accesible y con "menos movimiento".',
  usesAnime: true,
  head: () => `  <style>
    #hotspots .hs-marco{position:relative;max-width:840px;margin:0 auto;aspect-ratio:16/9;border-radius:var(--radius);overflow:hidden;border:1px solid var(--line);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 30%,var(--surface)),color-mix(in srgb,var(--primary) 30%,var(--surface)))}
    #hotspots .hs-img{width:100%;height:100%;object-fit:cover;display:block}
    #hotspots .hs-pin{position:absolute;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:50%;border:2px solid #fff;background:var(--accent);color:#fff;font-weight:800;font-size:1rem;line-height:1;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.3);z-index:2}
    #hotspots .hs-pin::before{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid var(--accent);opacity:.6;will-change:transform,opacity}
    #hotspots .hs-pin[aria-expanded=true]{background:var(--primary)}
    #hotspots .hs-tip{position:absolute;transform:translate(-50%,calc(-100% - 20px));min-width:180px;max-width:240px;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.18);z-index:3;font-size:.88rem;opacity:0;visibility:hidden;transition:opacity .18s}
    #hotspots .hs-tip.abierto{opacity:1;visibility:visible}
    #hotspots .hs-tip h4{margin:0 0 4px;font-size:.95rem}
    #hotspots .hs-tip p{margin:0;color:var(--muted)}
    #hotspots .hs-hint{text-align:center;color:var(--muted);font-size:.85rem;margin:14px 0 0}
    @media (prefers-reduced-motion: reduce){#hotspots .hs-pin::before{display:none}#hotspots .hs-tip{transition:none}}
  </style>`,
  html: () => `  <section id="hotspots">
    <div class="container">
      <h2>Mirá cada detalle</h2>
      <p class="section-sub">Tocá los puntos para descubrir qué hace especial a nuestro producto.</p>
      <div class="hs-marco" id="hs-marco">
${PINES.map((p, i) => `        <button type="button" class="hs-pin" data-i="${i}" style="left:${p.x}%;top:${p.y}%" aria-expanded="false" aria-label="Ver detalle: ${p.titulo}">${i + 1}</button>
        <div class="hs-tip" id="hs-tip-${i}" role="tooltip" style="left:${p.x}%;top:${p.y}%"><h4>${p.titulo}</h4><p>${p.texto}</p></div>`).join('\n')}
      </div>
      <p class="hs-hint">Reemplazá la imagen y los puntos por los de tu producto.</p>
    </div>
  </section>`,
  clientJs: () => `/* Módulo imagen interactiva: muestra/oculta el cartelito de cada pin al hacer clic o
   foco, y hace latir los pines con Anime.js (decorativo). Un solo cartelito abierto a la
   vez; se cierra con Escape o al clickear fuera. Sin librería o con "menos movimiento"
   los pines no laten pero siguen siendo botones accesibles. */
(function () {
  var marco = document.getElementById('hs-marco');
  if (!marco) return;
  var pines = [].slice.call(marco.querySelectorAll('.hs-pin'));
  if (!pines.length) return;
  function cerrarTodo(salvo) {
    pines.forEach(function (p) {
      if (p === salvo) return;
      p.setAttribute('aria-expanded', 'false');
      var tip = document.getElementById('hs-tip-' + p.dataset.i);
      if (tip) tip.classList.remove('abierto');
    });
  }
  pines.forEach(function (pin) {
    var tip = document.getElementById('hs-tip-' + pin.dataset.i);
    function toggle() {
      var abierto = pin.getAttribute('aria-expanded') === 'true';
      cerrarTodo(pin);
      pin.setAttribute('aria-expanded', abierto ? 'false' : 'true');
      if (tip) tip.classList.toggle('abierto', !abierto);
    }
    pin.addEventListener('click', toggle);
    // Abrir con foco de teclado, cerrar al salir del pin y su cartelito
    pin.addEventListener('focus', function () { cerrarTodo(pin); pin.setAttribute('aria-expanded', 'true'); if (tip) tip.classList.add('abierto'); });
  });
  // Cerrar al clickear fuera o con Escape
  document.addEventListener('click', function (e) { if (!e.target.closest('#hs-marco')) cerrarTodo(null); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarTodo(null); });
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var anime = window.anime;
  if (!anime || !anime.animate || reduce) return;   // quietos pero funcionales
  // Anillo que late en bucle para invitar a tocar (con desfase entre pines)
  pines.forEach(function (pin, i) {
    anime.animate(pin, { scale: [1, 1.12], duration: 1100, loop: true, alternate: true, ease: 'inOutSine', delay: i * 220 });
  });
})();`,
  readmeNotes: () => [
    '**Imagen interactiva**: la imagen es un placeholder degradado; reemplazala poniendo un `<img class="hs-img">` dentro de `#hs-marco` en `public/index.html`. Editá los pines (posición `left`/`top` en %, título y texto) en la sección `#hotspots`.',
  ],
};
