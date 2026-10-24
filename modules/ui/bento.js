const { phIcon } = require('../../src/icons');

// Grilla "bento": mosaico asimétrico de destacados (tendencia de diseño 2024-2025).
// Bloques de distinto tamaño que arman una cuadrícula visualmente rica para mostrar
// características, beneficios o cifras clave. 100% CSS: sin JS se ve completo igual.
// Los datos son placeholder editables en la sección #bento.
// El icono de cada bloque es un nombre de icono Phosphor (se hornea como SVG inline); '' = sin icono
const BLOQUES = [
  { titulo: 'Todo en un solo lugar', texto: 'Centralizá tu operación sin saltar entre diez herramientas distintas.', tam: 'grande', icono: 'stack' },
  { titulo: 'Rápido de verdad', texto: 'Pensado para responder al instante.', tam: 'alto', icono: 'lightning' },
  { titulo: '+2.000', texto: 'clientes activos', tam: 'cifra', icono: '' },
  { titulo: 'Seguro por diseño', texto: 'Tus datos protegidos en cada paso.', tam: 'normal', icono: 'lock' },
  { titulo: 'Soporte humano', texto: 'Personas reales que te acompañan cuando lo necesitás.', tam: 'ancho', icono: 'chat-circle-dots' },
];

module.exports = {
  id: 'bento', type: 'ui', name: 'Grilla bento',
  description: 'Mosaico asimétrico de destacados (estilo "bento grid") con bloques de distinto tamaño para características, beneficios o cifras clave. 100% CSS, responsive y accesible.',
  head: () => `  <style>
    #bento .bento-grid{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:150px;gap:16px}
    #bento .bento-item{position:relative;overflow:hidden;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:22px;display:flex;flex-direction:column;justify-content:flex-end;gap:6px}
    #bento .bento-item h3{margin:0;font-size:1.15rem;letter-spacing:-0.01em}
    #bento .bento-item p{margin:0;color:var(--muted);font-size:.92rem}
    #bento .bento-ico{line-height:0;margin:0 0 auto}
    #bento .bento-item.grande{grid-column:span 2;grid-row:span 2;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 16%,var(--surface)),var(--surface))}
    #bento .bento-item.grande h3{font-size:1.5rem}
    #bento .bento-item.alto{grid-row:span 2}
    #bento .bento-item.ancho{grid-column:span 2}
    #bento .bento-item.cifra{align-items:center;justify-content:center;text-align:center;background:var(--accent);color:#fff}
    #bento .bento-item.cifra h3{font-size:2.4rem;font-weight:800;color:#fff}
    #bento .bento-item.cifra p{color:rgba(255,255,255,.85)}
    @media (prefers-reduced-motion: no-preference){#bento .bento-item{transition:transform .25s ease, box-shadow .25s ease}#bento .bento-item:hover{transform:translateY(-3px);box-shadow:0 12px 30px color-mix(in srgb,var(--primary) 16%,transparent)}}
    @media (max-width:820px){#bento .bento-grid{grid-template-columns:repeat(2,1fr)}#bento .bento-item.grande{grid-column:span 2}#bento .bento-item.ancho{grid-column:span 2}#bento .bento-item.alto{grid-row:span 1}}
    @media (max-width:520px){#bento .bento-grid{grid-template-columns:1fr}#bento .bento-item,#bento .bento-item.grande,#bento .bento-item.ancho{grid-column:span 1}}
  </style>`,
  html: () => `  <section id="bento">
    <div class="container">
      <h2>Por qué elegirnos</h2>
      <p class="section-sub">Lo esencial, de un vistazo.</p>
      <div class="bento-grid">
${BLOQUES.map(b => `        <div class="bento-item ${b.tam}">
${b.icono ? `          <span class="bento-ico" aria-hidden="true">${phIcon(b.icono, { size: 26, color: 'var(--accent)' })}</span>\n` : ''}          <h3>${b.titulo}</h3>
          <p>${b.texto}</p>
        </div>`).join('\n')}
      </div>
    </div>
  </section>`,
  readmeNotes: () => [
    '**Grilla bento**: los bloques (títulos, textos, íconos y tamaños `grande`/`alto`/`ancho`/`cifra`/`normal`) son placeholders; editalos en la sección `#bento` de `public/index.html`.',
  ],
};
