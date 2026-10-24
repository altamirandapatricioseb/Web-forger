const { esc, txt } = require('../../src/templates');

// Comparador antes/después: dos imágenes superpuestas y un deslizador que revela una u otra.
// La interacción real la da un <input type="range"> (arrastre, teclado y lectores de pantalla gratis).
module.exports = {
  id: 'beforeafter', type: 'ui', name: 'Antes / Después',
  description: 'Comparador de imágenes con deslizador arrastrable (accesible por teclado). Placeholders con degradado; se reemplazan por fotos reales.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'El cambio que logramos', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'Arrastrá el control para comparar el antes y el después.', max: 220 },
    { key: 'etiquetaAntes', label: 'Etiqueta de la imagen izquierda', default: 'Antes', max: 40 },
    { key: 'etiquetaDespues', label: 'Etiqueta de la imagen derecha', default: 'Después', max: 40 },
  ],
  html: (cfg) => `  <section id="antes-despues">
    <div class="container">
      <h2>${esc(txt(cfg, 'beforeafter', 'titulo', 'El cambio que logramos'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'beforeafter', 'bajada', 'Arrastrá el control para comparar el antes y el después.'))}</p>
      <div class="ba" data-ba style="--pos:50;position:relative;max-width:760px;margin:0 auto;aspect-ratio:16/9;border-radius:var(--radius);overflow:hidden;border:1px solid var(--line);user-select:none">
        <div class="ba-after" style="position:absolute;inset:0;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 45%,var(--surface)),var(--accent))"></div>
        <div class="ba-before" style="position:absolute;inset:0;background:linear-gradient(135deg,var(--surface),color-mix(in srgb,var(--text) 30%,var(--surface)))"></div>
        <span class="ba-tag ba-tag-before" style="position:absolute;top:12px;left:12px">${esc(txt(cfg, 'beforeafter', 'etiquetaAntes', 'Antes'))}</span>
        <span class="ba-tag ba-tag-after" style="position:absolute;top:12px;right:12px">${esc(txt(cfg, 'beforeafter', 'etiquetaDespues', 'Después'))}</span>
        <div class="ba-divider" aria-hidden="true"></div>
        <input type="range" class="ba-range" min="0" max="100" value="50" step="1" aria-label="Comparar antes y después de ${esc(cfg.brand.name)}">
      </div>
    </div>
  </section>`,
  clientJs: () => `// Módulo antes/después: el range controla una variable CSS --pos que recorta la capa superior.
// Sin JS queda una división fija 50/50 (se ven ambas mitades): la sección no se rompe.
(function () {
  var raiz = document.querySelector('.ba[data-ba]');
  if (!raiz) return;
  var range = raiz.querySelector('.ba-range');
  if (!range) return;
  var estilo = document.createElement('style');
  estilo.textContent =
    // La capa "antes" se recorta según --pos para revelar el "después" debajo
    '.ba-before{clip-path:inset(0 calc((100 - var(--pos)) * 1%) 0 0)}' +
    '.ba-tag{font-size:.72rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#fff;' +
    'background:rgba(0,0,0,.45);padding:3px 9px;border-radius:999px;pointer-events:none}' +
    '.ba-divider{position:absolute;top:0;bottom:0;left:calc(var(--pos) * 1%);width:2px;' +
    'background:#fff;box-shadow:0 0 6px rgba(0,0,0,.4);transform:translateX(-1px);pointer-events:none}' +
    // El input ocupa todo el widget; su thumb es el tirador circular, el resto es transparente
    '.ba-range{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;background:transparent;' +
    'cursor:ew-resize;-webkit-appearance:none;appearance:none}' +
    '.ba-range:focus{outline:none}' +
    '.ba-range::-webkit-slider-thumb{-webkit-appearance:none;width:34px;height:34px;border-radius:50%;' +
    'background:#fff;border:2px solid var(--accent);box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:ew-resize}' +
    '.ba-range::-moz-range-thumb{width:34px;height:34px;border-radius:50%;background:#fff;' +
    'border:2px solid var(--accent);box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:ew-resize}' +
    '.ba-range::-moz-range-track{background:transparent}' +
    // Anillo de foco visible al tabular (teclado), sobre el tirador
    '.ba-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 55%,transparent)}' +
    '.ba-range:focus-visible::-moz-range-thumb{box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 55%,transparent)}';
  document.head.appendChild(estilo);
  function aplicar() { raiz.style.setProperty('--pos', range.value); }
  range.addEventListener('input', aplicar);
  aplicar();
})();`,
  readmeNotes: () => [
    '**Antes / Después**: las dos capas son degradados de ejemplo; para usar fotos reales reemplazá el `background` de `.ba-before` y `.ba-after` en la sección `antes-despues` (`public/index.html`) por `url(/img/antes.jpg)` y `url(/img/despues.jpg)` con `background-size:cover;background-position:center`.',
  ],
};
