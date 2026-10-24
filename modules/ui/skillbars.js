const { esc, txt, txtList } = require('../../src/templates');

// Barras de capacidades/habilidades con porcentaje. El HTML ya trae el valor final
// (ancho en el style inline y el número visible): sin JS, o con "menos movimiento",
// se ve completo igual. Con Anime.js, cada barra crece de 0 a su nivel al entrar en
// pantalla. Los datos son placeholder editables desde el Builder.
const CAPACIDADES = [
  { label: 'Diseño y experiencia de usuario', nivel: 95 },
  { label: 'Desarrollo a medida', nivel: 90 },
  { label: 'Estrategia y consultoría', nivel: 85 },
  { label: 'Soporte y mantenimiento', nivel: 92 },
];

// Default del campo editable: exactamente las capacidades de arriba, para que el panel
// arranque mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ITEMS_DEFAULT = CAPACIDADES.map(c => `${c.label} | ${c.nivel}`).join('\n');

// Lista efectiva de capacidades según la config del Builder.
// Formatos aceptados por línea: "etiqueta | nivel" o sólo "etiqueta".
// El nivel se acota a 0–100: un valor fuera de rango rompería el ancho de la barra.
function capacidades(cfg) {
  const lineas = txtList(cfg, 'skillbars', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return CAPACIDADES;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = CAPACIDADES[i % CAPACIDADES.length];
    const crudo = partes.length >= 2 ? parseInt(String(partes[1]).replace(/[^\d-]/g, ''), 10) : NaN;
    const nivel = Number.isFinite(crudo) ? Math.max(0, Math.min(100, crudo)) : base.nivel;
    return { label: partes[0], nivel };
  });
}

module.exports = {
  id: 'skillbars', type: 'ui', name: 'Barras de capacidades',
  description: 'Sección con barras de progreso horizontales (habilidades/capacidades) que crecen hasta su porcentaje al entrar en pantalla, animadas con Anime.js. Respeta la preferencia de menos movimiento.',
  usesAnime: true,
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Nuestras capacidades', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'En qué somos fuertes y por qué podés confiar en nosotros.', max: 220 },
    {
      key: 'items', label: 'Capacidades', type: 'list', max: 1500, default: ITEMS_DEFAULT,
      hint: 'Una capacidad por línea: etiqueta | nivel. El nivel es un número de 0 a 100 (el porcentaje de la barra).',
    },
  ],
  head: () => `  <style>
    .skillbar{margin:0 0 18px}
    .skillbar-top{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 6px;font-weight:600}
    .skillbar-pct{color:var(--accent);font-variant-numeric:tabular-nums;font-weight:700}
    .skillbar-riel{background:var(--line);border-radius:999px;height:12px;overflow:hidden}
    .skillbar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 55%,var(--primary)));will-change:width}
  </style>`,
  html: (cfg) => `  <section id="capacidades">
    <div class="container">
      <h2>${esc(txt(cfg, 'skillbars', 'titulo', 'Nuestras capacidades'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'skillbars', 'bajada', 'En qué somos fuertes y por qué podés confiar en nosotros.'))}</p>
      <div style="max-width:720px;margin:0 auto">
${capacidades(cfg).map(c => `        <div class="skillbar">
          <div class="skillbar-top"><span>${esc(c.label)}</span><span class="skillbar-pct" data-meta="${c.nivel}">${c.nivel}%</span></div>
          <div class="skillbar-riel"><div class="skillbar-fill" data-nivel="${c.nivel}" style="width:${c.nivel}%"></div></div>
        </div>`).join('\n')}
      </div>
    </div>
  </section>`,
  clientJs: () => `/* Módulo barras de capacidades: cada barra crece de 0% a su nivel al entrar en
   pantalla con Anime.js (window.anime). El HTML ya trae el ancho final: sin librería o
   con prefers-reduced-motion no se anima pero la barra se ve completa. */
(function () {
  var fills = document.querySelectorAll('.skillbar-fill');
  if (!fills.length) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var anime = window.anime;
  // Sin Anime, sin IntersectionObserver o con menos movimiento: quedan en su ancho final (el del HTML)
  if (!anime || !anime.animate || reduce || !('IntersectionObserver' in window)) return;
  function pintarNum(fill) {
    // Sincroniza el número de porcentaje con el ancho mientras crece la barra
    var top = fill.parentNode.previousElementSibling;
    var pct = top && top.querySelector('.skillbar-pct');
    if (!pct) return null;
    return function () { pct.textContent = Math.round(parseFloat(fill.style.width) || 0) + '%'; };
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      observer.unobserve(e.target);
      var fill = e.target;
      var nivel = parseInt(fill.dataset.nivel, 10) || 0;
      var sync = pintarNum(fill);
      anime.animate(fill, {
        width: ['0%', nivel + '%'], duration: 1200, ease: 'out(3)',
        onUpdate: sync || undefined,
        onComplete: function () { fill.style.width = nivel + '%'; if (sync) sync(); }
      });
      // Red de seguridad: si el motor está pausado (pestaña oculta) igual fija el valor final
      setTimeout(function () { fill.style.width = nivel + '%'; if (sync) sync(); }, 1300);
    });
  }, { threshold: 0.35 });
  Array.prototype.forEach.call(fills, function (fill) {
    // Arranca en 0 recién acá: si el observer nunca dispara, el HTML ya mostraba el ancho real
    fill.style.width = '0%';
    var sync = pintarNum(fill);
    if (sync) sync();
    observer.observe(fill);
  });
})();`,
  readmeNotes: () => [
    '**Barras de capacidades**: las capacidades y sus porcentajes salen del bloque *Textos por sección* del Builder; si no las editaste, son placeholders. También podés cambiar `data-nivel`, el ancho (`width`) y las etiquetas en la sección `#capacidades` de `public/index.html`.',
  ],
};
