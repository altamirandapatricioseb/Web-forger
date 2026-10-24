const { esc, txt, txtList } = require('../../src/templates');

// Paneles placeholder: etiqueta de la pestaña, título del panel y su contenido.
// `items` (viñetas) y `texto` (párrafo) son excluyentes: definen qué marcado se hornea.
const PANELES = [
  {
    label: 'Características', titulo: 'Lo que nos distingue',
    items: ['Calidad garantizada en cada detalle.', 'Atención cercana antes, durante y después.', 'Precios claros, sin sorpresas.'],
  },
  {
    label: 'Especificaciones', titulo: 'Detalles técnicos',
    texto: 'Completá acá los datos concretos de tu producto o servicio: materiales, medidas, tiempos de entrega, cobertura o lo que tu cliente necesite saber antes de decidir.',
  },
  {
    label: 'Envíos y devoluciones', titulo: 'Cómo te llega',
    texto: 'Enviamos a todo el país en 24 a 72 h. Si algo no te convence, tenés 30 días para cambiarlo o devolverlo sin costo. Escribinos y lo resolvemos.',
  },
];

// Default del campo editable: exactamente los paneles de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
// Las viñetas viajan en una sola columna separadas por ";".
const ITEMS_DEFAULT = PANELES
  .map(p => `${p.label} | ${p.titulo} | ${p.items ? p.items.join('; ') : p.texto}`)
  .join('\n');

// El título de la sección admite el comodín {marca}: se reemplaza por el nombre del negocio,
// así el default ("{marca} en detalle") rinde exactamente el texto de siempre.
const conMarca = (s, cfg) => String(s).replace(/\{marca\}/g, cfg.brand.name);

// Lista efectiva de paneles según la config del Builder.
// Formatos aceptados por línea: "etiqueta | título | contenido", "etiqueta | contenido"
// o sólo "etiqueta". Un contenido con ";" se hornea como lista de viñetas.
function paneles(cfg) {
  const lineas = txtList(cfg, 'tabs', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return PANELES;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = PANELES[i % PANELES.length];
    const label = partes[0];
    const titulo = partes.length >= 3 ? partes[1] : base.titulo;
    const cuerpo = partes.length >= 3 ? partes.slice(2).join(' | ') : (partes.length === 2 ? partes[1] : null);
    if (cuerpo === null) return { label, titulo, items: base.items, texto: base.texto };
    if (cuerpo.includes(';')) return { label, titulo, items: cuerpo.split(';').map(s => s.trim()).filter(Boolean) };
    return { label, titulo, texto: cuerpo };
  });
}

// Cuerpo horneado de un panel: viñetas si trae `items`, párrafo si trae `texto`.
// La sangría replica la del bloque que lo contiene para que el HTML salga prolijo.
function cuerpoPanel(p) {
  const h3 = `<h3 style="margin-top:0">${esc(p.titulo)}</h3>`;
  if (p.items && p.items.length) {
    return `${h3}
          <ul class="muted" style="line-height:1.9;margin:0;padding-left:18px">
${p.items.map(t => `            <li>${esc(t)}</li>`).join('\n')}
          </ul>`;
  }
  return `${h3}
          <p class="muted" style="margin:0">${esc(p.texto || '')}</p>`;
}

// Contenido en pestañas: patrón tablist accesible (ARIA + teclado).
// Sin JS todos los paneles quedan visibles apilados, así la sección nunca se ve rota.
module.exports = {
  id: 'tabs', type: 'ui', name: 'Contenido en pestañas',
  description: 'Sección con pestañas accesibles (roles ARIA y navegación por teclado). Ideal para características, especificaciones y envíos.',
  fields: [
    {
      key: 'titulo', label: 'Título de la sección', default: '{marca} en detalle', max: 80,
      hint: 'Donde escribas {marca} aparece el nombre de tu negocio.',
    },
    { key: 'bajada', label: 'Bajada', default: 'Todo lo que querés saber, ordenado en pestañas.', max: 220 },
    {
      key: 'items', label: 'Pestañas', type: 'list', max: 2600, default: ITEMS_DEFAULT,
      hint: 'Una pestaña por línea: etiqueta | título | contenido. Si el contenido lleva ";" se muestra como lista de viñetas.',
    },
  ],
  html: (cfg) => {
    const lista = paneles(cfg);
    const nav = lista.map((p, i) =>
      `<button type="button" class="tabs-tab" data-tab="${i}">${esc(p.label)}</button>`).join('\n          ');
    const cuerpos = lista.map((p, i) =>
      `<div class="tabs-panel card" data-panel="${i}">
          ${cuerpoPanel(p)}
        </div>`).join('\n        ');
    return `  <section id="pestanas">
    <div class="container">
      <h2>${esc(conMarca(txt(cfg, 'tabs', 'titulo', '{marca} en detalle'), cfg))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'tabs', 'bajada', 'Todo lo que querés saber, ordenado en pestañas.'))}</p>
      <div class="tabs" data-tabs>
        <div class="tabs-nav" role="tablist" aria-label="Información de ${esc(cfg.brand.name)}">
          ${nav}
        </div>
        ${cuerpos}
      </div>
    </div>
  </section>`;
  },
  clientJs: () => `// Módulo pestañas: activa el patrón tablist accesible sobre el HTML estático.
// Sin JS quedan todos los paneles visibles; recién acá se oculta lo no activo.
(function () {
  var raiz = document.querySelector('.tabs[data-tabs]');
  if (!raiz) return;
  var tabs = raiz.querySelectorAll('.tabs-tab');
  var paneles = raiz.querySelectorAll('.tabs-panel');
  if (!tabs.length || tabs.length !== paneles.length) return;
  var estilo = document.createElement('style');
  estilo.textContent = '.tabs-nav{display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--line);margin-bottom:18px}' +
    '.tabs-tab{border:0;background:transparent;color:var(--muted);font:inherit;font-weight:600;cursor:pointer;' +
    'padding:10px 16px;border-bottom:2px solid transparent;margin-bottom:-1px}' +
    '.tabs-tab:hover{color:var(--text)}' +
    '.tabs-tab[aria-selected="true"]{color:var(--accent);border-bottom-color:var(--accent)}' +
    '.tabs-panel[hidden]{display:none}';
  document.head.appendChild(estilo);
  var idBase = 'tabs-' + Math.floor(Math.random() * 1e6);
  function activar(i, foco) {
    for (var j = 0; j < tabs.length; j++) {
      var sel = j === i;
      tabs[j].setAttribute('aria-selected', sel ? 'true' : 'false');
      tabs[j].tabIndex = sel ? 0 : -1;
      paneles[j].hidden = !sel;
    }
    if (foco) tabs[i].focus();
  }
  for (var i = 0; i < tabs.length; i++) {
    (function (i) {
      var tab = tabs[i], panel = paneles[i];
      tab.setAttribute('role', 'tab');
      tab.id = idBase + '-tab-' + i;
      panel.setAttribute('role', 'tabpanel');
      panel.id = idBase + '-panel-' + i;
      tab.setAttribute('aria-controls', panel.id);
      panel.setAttribute('aria-labelledby', tab.id);
      panel.tabIndex = 0;
      tab.addEventListener('click', function () { activar(i); });
      // Flechas, Inicio y Fin mueven el foco entre pestañas (patrón WAI-ARIA)
      tab.addEventListener('keydown', function (e) {
        var n = tabs.length, destino = -1;
        if (e.key === 'ArrowRight') destino = (i + 1) % n;
        else if (e.key === 'ArrowLeft') destino = (i - 1 + n) % n;
        else if (e.key === 'Home') destino = 0;
        else if (e.key === 'End') destino = n - 1;
        if (destino >= 0) { e.preventDefault(); activar(destino, true); }
      });
    })(i);
  }
  activar(0);
})();`,
  readmeNotes: () => [
    '**Contenido en pestañas**: los textos de cada pestaña salen del bloque *Textos por sección* del Builder; si no los editaste, son placeholders. También podés cambiarlos después en la sección `pestanas` de la Home (`public/index.html`).',
  ],
};
