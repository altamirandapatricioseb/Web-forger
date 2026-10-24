const { esc, txt, txtList } = require('../../src/templates');

// Proyectos placeholder del portfolio, editables desde el Builder.
// Cada tarjeta soporta una foto real: reemplazar el <div> del gradiente por un <img>
// (hay un comentario guía dentro del HTML generado y el aviso en el README).
// `cat` alimenta el data-cat con el que el JS arma las tabs de filtro.
const PROYECTOS = [
  { nombre: 'Identidad para café de especialidad', cat: 'Diseño', detalle: 'Marca, carta y señalética del local.' },
  { nombre: 'Refacción integral de oficinas', cat: 'Obras', detalle: 'Obra en seco y mobiliario a medida en 6 semanas.' },
  { nombre: 'Plan comercial para pyme familiar', cat: 'Consultoría', detalle: 'Diagnóstico, precios y canales de venta.' },
  { nombre: 'Packaging línea premium', cat: 'Diseño', detalle: 'Estuches y etiquetas para tres productos.' },
  { nombre: 'Ampliación de planta productiva', cat: 'Obras', detalle: 'Proyecto, permisos y dirección de obra.' },
  { nombre: 'Tablero de gestión mensual', cat: 'Consultoría', detalle: 'Indicadores clave y rutina de seguimiento.' },
];

// Default del campo editable: exactamente los proyectos de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ITEMS_DEFAULT = PROYECTOS.map(p => `${p.nombre} | ${p.cat} | ${p.detalle}`).join('\n');

// Lista efectiva de proyectos según la config del Builder.
// Formatos aceptados por línea: "nombre | categoría | detalle", "nombre | categoría"
// o sólo "nombre".
function proyectos(cfg) {
  const lineas = txtList(cfg, 'portfolio', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return PROYECTOS;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = PROYECTOS[i % PROYECTOS.length];
    if (partes.length >= 3) return { nombre: partes[0], cat: partes[1], detalle: partes.slice(2).join(' | ') };
    if (partes.length === 2) return { nombre: partes[0], cat: partes[1], detalle: base.detalle };
    return { nombre: partes[0], cat: base.cat, detalle: base.detalle };
  });
}

module.exports = {
  id: 'portfolio', type: 'ui', name: 'Página de portfolio',
  description: 'Página propia con los trabajos realizados, filtros por categoría y tarjetas listas para fotos reales (con carga diferida).',
  fields: [
    { key: 'titulo', label: 'Título de la página', default: 'Nuestro portfolio', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'Una selección de proyectos que muestran cómo trabajamos.', max: 220 },
    {
      key: 'items', label: 'Proyectos', type: 'list', max: 2600, default: ITEMS_DEFAULT,
      hint: 'Un proyecto por línea: nombre | categoría | detalle. Las tabs de filtro se arman solas con las categorías que uses.',
    },
  ],
  nav: () => [{ label: 'Portfolio', href: '/portfolio.html' }],
  pages: (cfg) => ({
    portfolio: {
      title: 'Portfolio',
      html: `  <section id="portfolio">
    <div class="container">
      <h2>${esc(txt(cfg, 'portfolio', 'titulo', 'Nuestro portfolio'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'portfolio', 'bajada', 'Una selección de proyectos que muestran cómo trabajamos.'))}</p>
      <div class="grid cols-3">
${proyectos(cfg).map((p, i) => `        <figure class="card" data-cat="${esc(p.cat)}" style="padding:0;overflow:hidden;margin:0">
          <!-- Para usar una foto real, reemplazá el <div> de abajo por:
               <img src="https://tu-imagen.jpg" alt="${esc(p.nombre)}" loading="lazy" style="aspect-ratio:4/3;object-fit:cover;width:100%"> -->
          <div aria-hidden="true" style="aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;background:linear-gradient(${120 + i * 25}deg,var(--surface),color-mix(in srgb,var(--accent) ${14 + (i % 3) * 8}%,var(--surface)))"><span class="muted">Foto del proyecto</span></div>
          <figcaption style="padding:14px 18px"><strong>${esc(p.nombre)}</strong><div class="muted" style="font-size:.85rem;margin-top:2px">${esc(p.cat)} · ${esc(p.detalle)}</div></figcaption>
        </figure>`).join('\n')}
      </div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo página de portfolio: arma las tabs de filtro con las categorías (data-cat)
   que encuentra en las tarjetas. Solo corre en portfolio.html; sin JS se ve todo junto. */
(function () {
  var grid = document.querySelector('#portfolio .grid');
  if (!grid) return;
  var tarjetas = grid.querySelectorAll('[data-cat]');
  if (!tarjetas.length) return;
  // Categorías únicas en orden de aparición
  var cats = [];
  Array.prototype.forEach.call(tarjetas, function (t) {
    if (cats.indexOf(t.dataset.cat) < 0) cats.push(t.dataset.cat);
  });
  // Con una sola categoría las tabs no aportan nada
  if (cats.length < 2) return;
  var style = document.createElement('style');
  style.textContent = '.portfolio-filtros{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}' +
    '.portfolio-filtros button{width:auto;padding:7px 16px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--text);font:inherit;font-size:.9rem;cursor:pointer}' +
    '.portfolio-filtros button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:white}';
  document.head.appendChild(style);
  var barra = document.createElement('div');
  barra.className = 'portfolio-filtros';
  barra.setAttribute('role', 'group');
  barra.setAttribute('aria-label', 'Filtrar portfolio por categoría');
  ['Todos'].concat(cats).forEach(function (cat) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = cat;
    b.setAttribute('aria-pressed', cat === 'Todos' ? 'true' : 'false');
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(barra.children, function (o) { o.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      Array.prototype.forEach.call(tarjetas, function (t) {
        t.style.display = cat === 'Todos' || t.dataset.cat === cat ? '' : 'none';
      });
    });
    barra.appendChild(b);
  });
  grid.parentNode.insertBefore(barra, grid);
})();`,
  readmeNotes: () => [
    '**Portfolio**: los proyectos de `public/portfolio.html` salen del bloque *Textos por sección* del Builder; si no los editaste, son placeholders. También podés editar nombres, detalles y el atributo `data-cat` de cada tarjeta directamente en el HTML (las tabs de filtro se arman solas). Para mostrar fotos reales seguí el comentario guía dentro de cada tarjeta: un `<img loading="lazy">` reemplaza al gradiente y, si el módulo Lightbox está activo, la foto se amplía con un clic.',
  ],
};
