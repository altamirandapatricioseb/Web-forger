const { esc, imageSlot, txt, txtList } = require('../../src/templates');

// Tiles placeholder de la galería: etiqueta del slot y categoría. Si el módulo
// "Filtros de galería" está activo, las categorías se usan como tabs. Sin ese módulo,
// el data-cat no tiene ningún efecto visual.
const TILES = [
  { label: 'Foto 1', cat: 'Diseño' },
  { label: 'Foto 2', cat: 'Obras' },
  { label: 'Foto 3', cat: 'Consultoría' },
  { label: 'Foto 4', cat: 'Diseño' },
  { label: 'Foto 5', cat: 'Obras' },
  { label: 'Foto 6', cat: 'Consultoría' },
];

// Default del campo editable: exactamente los tiles de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ITEMS_DEFAULT = TILES.map(t => `${t.label} | ${t.cat}`).join('\n');

// Lista efectiva de tiles según la config del Builder.
// Formatos aceptados por línea: "etiqueta | categoría" o sólo "etiqueta".
function tiles(cfg) {
  const lineas = txtList(cfg, 'gallery', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return TILES;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = TILES[i % TILES.length];
    return { label: partes[0], cat: partes.length >= 2 ? partes[1] : base.cat };
  });
}

module.exports = {
  id: 'gallery', type: 'ui', name: 'Galería',
  description: 'Grilla de imágenes o trabajos destacados, con realce al pasar el mouse.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Galería', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'Algunos de nuestros trabajos recientes.', max: 220 },
    {
      key: 'items', label: 'Tiles de la galería', type: 'list', max: 1500, default: ITEMS_DEFAULT,
      hint: 'Un tile por línea: etiqueta | categoría. La etiqueta es el texto del slot vacío; la categoría alimenta el filtro si usás "Filtros de galería".',
    },
  ],
  // Hover sobre los tiles: aplica a los hijos directos de la grilla, así funciona igual
  // con los slots de prueba (.img-slot) y con las <img> reales cuando el cliente las
  // reemplace. Levanta el tile con borde de acento y sombra tenue del primario; el
  // movimiento se apaga solo con prefers-reduced-motion (el realce de borde queda).
  html: (cfg) => `  <section id="galeria">
    <style>
      #galeria .grid > * { border-radius: var(--radius); }
      #galeria .grid > *:hover { border-color: var(--accent); }
      @media (prefers-reduced-motion: no-preference) {
        #galeria .grid > * { transition: transform .3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow .3s ease, border-color .2s ease; }
        #galeria .grid > *:hover { transform: translateY(-4px) scale(1.015); box-shadow: 0 12px 28px color-mix(in srgb, var(--primary) 16%, transparent); }
        #galeria .img-slot-ic { transition: transform .3s cubic-bezier(0.22, 1, 0.36, 1), opacity .2s ease; }
        #galeria .grid > *:hover .img-slot-ic { transform: scale(1.12); opacity: 1; }
      }
    </style>
    <div class="container">
      <h2>${esc(txt(cfg, 'gallery', 'titulo', 'Galería'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'gallery', 'bajada', 'Algunos de nuestros trabajos recientes.'))}</p>
      <div class="grid cols-3">
        ${tiles(cfg).map(t => imageSlot({ ratio: '4/3', label: t.label, attrs: `data-cat="${esc(t.cat)}"` })).join('\n        ')}
      </div>
    </div>
  </section>`,
  readmeNotes: () => [
    '**Galería**: cada tile es un *slot de imagen reemplazable* (`<div class="img-slot">`), no una foto final. Sus etiquetas y categorías salen del bloque *Textos por sección* del Builder. Reemplazá cada uno por `<img src="/img/tu-trabajo.jpg" alt="Descripción del trabajo">` en la sección `#galeria` de `public/index.html` (mantené el `data-cat` si usás **Filtros de galería**). Poné las fotos en `public/img/`. Es autocontenido: no depende de servicios externos.',
  ],
};
