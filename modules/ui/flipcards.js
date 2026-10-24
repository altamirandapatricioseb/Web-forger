const { esc } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

// Tarjetas que giran (flip 3D) al pasar el mouse o al tocarlas, revelando info en el
// dorso. Patrón típico para beneficios/servicios/valores. Puro CSS para el giro
// (transform 3D), con un pelín de JS para que en táctil/teclado también se pueda voltear.
// El icono de cada tarjeta es un nombre de icono Phosphor (se hornea como SVG inline)
const TARJETAS = [
  { icono: 'lightning', titulo: 'Rapidez', frente: 'Entregas ágiles', dorso: 'Trabajamos con plazos claros y cumplimos: la mayoría de los proyectos salen en semanas, no en meses.' },
  { icono: 'target', titulo: 'Precisión', frente: 'Foco en resultados', dorso: 'Definimos objetivos medibles desde el día uno y ajustamos el rumbo con datos, no con corazonadas.' },
  { icono: 'handshake', titulo: 'Cercanía', frente: 'Trato directo', dorso: 'Hablás siempre con quien hace el trabajo. Sin intermediarios ni respuestas de manual.' },
  { icono: 'shield-check', titulo: 'Confianza', frente: 'Soporte real', dorso: 'No desaparecemos al entregar: te acompañamos con mantenimiento y mejoras continuas.' },
];

module.exports = {
  id: 'flipcards', type: 'ui', name: 'Tarjetas giratorias',
  description: 'Grilla de tarjetas que giran en 3D al pasar el mouse (o al tocarlas en móvil) y muestran más información en el dorso. Ideal para beneficios o valores.',
  head: () => `  <style>
    .flip{background:transparent;border:0;padding:0;perspective:1000px;min-height:210px}
    .flip-inner{position:relative;width:100%;height:100%;min-height:210px;transition:transform .6s cubic-bezier(.34,1.56,.64,1);transform-style:preserve-3d}
    .flip:hover .flip-inner,.flip:focus-within .flip-inner,.flip.is-flipped .flip-inner{transform:rotateY(180deg)}
    .flip-cara{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:22px;border-radius:var(--radius);border:1px solid var(--line)}
    .flip-frente{background:var(--surface)}
    .flip-icono{line-height:0;margin:0 0 10px}
    .flip-dorso{background:var(--accent);color:#fff;transform:rotateY(180deg)}
    .flip-dorso h3{color:#fff;margin:0 0 8px}
    .flip-dorso p{margin:0;font-size:.95rem;opacity:.95}
    @media (prefers-reduced-motion: reduce){.flip-inner{transition-duration:.001ms}}
  </style>`,
  html: () => `  <section id="beneficios">
    <div class="container">
      <h2>Por qué elegirnos</h2>
      <p class="section-sub">Pasá el mouse (o tocá) cada tarjeta para conocer más.</p>
      <div class="grid cols-3" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
${TARJETAS.map(t => `        <button type="button" class="flip" aria-label="${esc(t.titulo)}: ${esc(t.frente)}">
          <div class="flip-inner">
            <div class="flip-cara flip-frente">
              <div class="flip-icono" aria-hidden="true">${phIcon(t.icono, { size: 38, color: 'var(--accent)' })}</div>
              <h3>${esc(t.titulo)}</h3>
              <p class="muted" style="margin:0">${esc(t.frente)}</p>
            </div>
            <div class="flip-cara flip-dorso">
              <h3>${esc(t.titulo)}</h3>
              <p>${esc(t.dorso)}</p>
            </div>
          </div>
        </button>`).join('\n')}
      </div>
    </div>
  </section>`,
  clientJs: () => `/* Módulo tarjetas giratorias: el giro es 100% CSS (hover/focus). Este JS solo agrega
   el voltear al tocar/clic en pantallas táctiles, donde no hay hover. Sin JS igual funcionan
   con el mouse y con el teclado (foco). */
(function () {
  var flips = document.querySelectorAll('.flip');
  if (!flips.length) return;
  Array.prototype.forEach.call(flips, function (card) {
    card.addEventListener('click', function () {
      // En desktop el hover ya la giró; el click solo importa en táctil. Alterna la clase.
      card.classList.toggle('is-flipped');
    });
  });
})();`,
  readmeNotes: () => [
    '**Tarjetas giratorias**: los íconos (emoji), títulos y textos de frente/dorso son placeholders; editá el array `TARJETAS` en `modules/ui/flipcards.js` o la sección `#beneficios` de `public/index.html`.',
  ],
};
