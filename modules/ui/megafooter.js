const { esc, txt, txtList } = require('../../src/templates');

// Columnas de enlaces placeholder, editables desde el Builder. Cada entrada lleva la
// columna a la que pertenece, el texto visible y el destino. Un destino vacío se
// muestra como texto suelto (por ejemplo un horario de atención), no como enlace.
const ENLACES = [
  { col: 'Empresa', t: 'Inicio', h: '/index.html' },
  { col: 'Empresa', t: 'Nosotros', h: '/about.html' },
  { col: 'Empresa', t: 'Servicios', h: '/index.html#servicios' },
  { col: 'Ayuda', t: 'Preguntas frecuentes', h: '/index.html#faq' },
  { col: 'Ayuda', t: 'Contacto', h: '/index.html#contacto' },
  { col: 'Ayuda', t: 'Sobre nosotros', h: '/about.html' },
  { col: 'Contacto', t: 'hola@tudominio.com', h: 'mailto:hola@tudominio.com' },
  { col: 'Contacto', t: '+54 00 0000-0000', h: 'tel:+540000000000' },
  { col: 'Contacto', t: 'Lun a Vie, 9 a 18 h', h: '' },
];

// Default del campo editable: exactamente los enlaces de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ENLACES_DEFAULT = ENLACES.map(e => `${e.col} | ${e.t} | ${e.h}`).join('\n');

/**
 * Columnas efectivas según la config del Builder: agrupa las líneas por nombre de columna
 * respetando el orden de aparición, y devuelve siempre [{ titulo, items: [{t, h}] }] para
 * que el marcado no cambie.
 * Formatos aceptados por línea: "columna | texto | destino", "columna | texto" (texto
 * suelto, sin enlace) o sólo "columna" (se ignora: no aporta una fila).
 */
function columnas(cfg) {
  const lineas = txtList(cfg, 'megafooter', 'enlaces', ENLACES_DEFAULT);
  const origen = lineas.length ? lineas : ENLACES.map(e => [e.col, e.t, e.h]);
  const orden = [];
  const mapa = new Map();
  origen.forEach((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = ENLACES[i % ENLACES.length];
    if (partes.length < 2) return; // sin texto visible no hay fila que dibujar
    const titulo = partes[0] || base.col;
    // El destino puede llevar "|" (raro, pero una URL con query lo admite): se rearma entero
    const h = partes.length >= 3 ? partes.slice(2).join(' | ') : '';
    if (!mapa.has(titulo)) { mapa.set(titulo, []); orden.push(titulo); }
    mapa.get(titulo).push({ t: partes[1], h });
  });
  // Si ninguna línea tenía texto visible, el pie quedaría sin columnas: volvemos a las base
  if (!orden.length) return columnasBase();
  return orden.map(titulo => ({ titulo, items: mapa.get(titulo) }));
}

// Columnas armadas desde la constante ENLACES, en el mismo formato que devuelve columnas()
function columnasBase() {
  const orden = [];
  const mapa = new Map();
  for (const e of ENLACES) {
    if (!mapa.has(e.col)) { mapa.set(e.col, []); orden.push(e.col); }
    mapa.get(e.col).push({ t: e.t, h: e.h });
  }
  return orden.map(titulo => ({ titulo, items: mapa.get(titulo) }));
}

// Mega footer (pre-footer): banda ancha con columnas de enlaces, datos de contacto y
// una breve descripción de la marca, tal como la usan los sitios comerciales. Se ubica
// como sección antes del footer mínimo de copyright que ya trae el layout. Es HTML+CSS
// puro (sin JS ni dependencias): las columnas se acomodan solas y en móvil se apilan.
// Los enlaces y datos se editan desde el Builder o en el HTML generado.
module.exports = {
  id: 'megafooter', type: 'ui', name: 'Mega footer',
  description: 'Pie de página ampliado (pre-footer) con columnas de enlaces, contacto y descripción de la marca. HTML/CSS puro, responsive, sin dependencias.',
  fields: [
    {
      key: 'enlaces', label: 'Columnas de enlaces', type: 'list', max: 1600, default: ENLACES_DEFAULT,
      hint: 'Un enlace por línea: columna | texto | destino. Las líneas con la misma columna se agrupan juntas, en el orden en que aparecen. Ejemplo: "Empresa | Nosotros | /about.html". Sin destino queda como texto suelto (por ejemplo "Contacto | Lun a Vie, 9 a 18 h").',
    },
  ],
  html: (cfg) => `  <section id="megafooter" class="megafooter">
    <div class="container megafooter-grid">
      <div class="megafooter-marca">
        <div class="megafooter-logo">${esc(cfg.brand.name)}<span>.</span></div>
        <p class="muted">${esc(cfg.brand.tagline)}</p>
      </div>
      <!-- Editá las columnas y enlaces según las páginas de tu sitio -->
      ${columnas(cfg).map(c => `<div class="megafooter-col">
        <h4>${esc(c.titulo)}</h4>
        ${c.items.map(it => (it.h
          ? `<a href="${esc(it.h)}">${esc(it.t)}</a>`
          : `<span class="muted">${esc(it.t)}</span>`)).join('\n        ')}
      </div>`).join('\n      ')}
    </div>
  </section>`,
  head: () => `  <style>
    .megafooter{background:var(--surface);border-top:1px solid var(--line);padding:56px 0 48px}
    .megafooter-grid{display:grid;gap:32px;grid-template-columns:1.6fr repeat(3, 1fr)}
    .megafooter-logo{font-weight:800;font-size:1.25rem;letter-spacing:-.02em;margin-bottom:6px}
    .megafooter-logo span{color:var(--accent)}
    .megafooter-marca p{margin:0;max-width:32ch}
    .megafooter-col h4{margin:0 0 12px;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
    .megafooter-col a,.megafooter-col span{display:block;padding:4px 0;color:var(--text);text-decoration:none;font-size:.92rem}
    .megafooter-col a:hover{color:var(--accent)}
    @media (max-width: 860px){.megafooter-grid{grid-template-columns:1fr 1fr}.megafooter-marca{grid-column:1 / -1}}
    @media (max-width: 480px){.megafooter-grid{grid-template-columns:1fr}}
  </style>`,
  readmeNotes: () => [
    '**Mega footer**: las columnas, enlaces y datos de contacto salen del bloque *Textos por sección* del Builder; también podés editarlos después en la sección `#megafooter` de `public/index.html`. Aparece como banda ampliada arriba del pie de copyright.',
  ],
};
