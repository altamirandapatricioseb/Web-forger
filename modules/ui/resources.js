const { esc, txt, txtList } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

// Cada recurso: ícono SVG (stroke = acento), tipo/peso, título, bajada y enlace.
// href="#" es placeholder: reemplazalo por el PDF real subido a /public.
// El `svg` NO es editable desde el Builder porque es marcado, no texto: se toma por
// índice del recurso base, así una lista más larga sigue teniendo ícono siempre.
const RECURSOS = [
  { tipo: 'PDF · 1.2 MB', titulo: 'Guía de inicio rápido', desc: 'Todo lo que necesitás saber para arrancar, en 10 minutos de lectura.', href: '#',
    svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l3 3 3-3"/><path d="M12 12v6"/>' },
  { tipo: 'PDF · 3.4 MB', titulo: 'Catálogo completo', desc: 'Todos nuestros productos y servicios con precios de referencia.', href: '#',
    svg: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>' },
  { tipo: 'PDF · 0.8 MB', titulo: 'Ficha técnica', desc: 'Especificaciones detalladas y datos de contacto para consultas.', href: '#',
    svg: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>' },
];

// Default del campo editable: exactamente los recursos de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ITEMS_DEFAULT = RECURSOS.map(r => `${r.tipo} | ${r.titulo} | ${r.desc} | ${r.href}`).join('\n');

// Lista efectiva de recursos según la config del Builder. Formatos aceptados por línea:
// "tipo | título | descripción | enlace", con las columnas de la derecha opcionales.
function recursos(cfg) {
  const lineas = txtList(cfg, 'resources', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return RECURSOS;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = RECURSOS[i % RECURSOS.length];
    return {
      tipo: partes[0],
      titulo: partes.length >= 2 ? partes[1] : base.titulo,
      desc: partes.length >= 3 ? partes[2] : base.desc,
      href: partes.length >= 4 ? partes.slice(3).join(' | ') : base.href,
      svg: base.svg,
    };
  });
}

// Sección "Recursos y descargas": tarjetas con ícono, título, descripción y botón de
// descarga (guías, catálogos, fichas técnicas en PDF). Típica pieza de captación de
// leads en sitios B2B/servicios. Estática (sin JS): los enlaces son placeholders.
module.exports = {
  id: 'resources', type: 'ui', name: 'Recursos descargables',
  description: 'Sección de recursos y descargas (guías, catálogos, fichas técnicas) con tarjetas y botón de descarga. Estática, sin JS.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Recursos y descargas', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'Material gratuito para conocernos mejor. Descargá lo que necesites.', max: 220 },
    {
      key: 'items', label: 'Recursos', type: 'list', max: 1800, default: ITEMS_DEFAULT,
      hint: 'Un recurso por línea: tipo y peso | título | descripción | enlace. Ejemplo: "PDF · 1.2 MB | Guía de inicio rápido | Todo lo que necesitás para arrancar. | /guia-inicio.pdf". Subí el archivo a la carpeta public/ y poné acá su ruta; con # el botón no descarga nada.',
    },
    { key: 'boton', label: 'Texto del botón', default: 'Descargar', max: 40 },
  ],
  html: (cfg) => {
    const boton = esc(txt(cfg, 'resources', 'boton', 'Descargar'));
    const cards = recursos(cfg).map(r => `<article class="card res-card">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${r.svg}</svg>
          <span class="muted" style="font-size:.74rem;text-transform:uppercase;letter-spacing:.05em">${esc(r.tipo)}</span>
          <h3 style="margin:6px 0">${esc(r.titulo)}</h3>
          <p class="muted" style="margin:0 0 16px;font-size:.9rem">${esc(r.desc)}</p>
          <a class="btn" href="${esc(r.href)}" download style="margin-top:auto">
            ${phIcon('download-simple', { size: 14 })} ${boton}
          </a>
        </article>`).join('\n        ');
    return `  <section id="recursos">
    <div class="container">
      <h2>${esc(txt(cfg, 'resources', 'titulo', 'Recursos y descargas'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'resources', 'bajada', 'Material gratuito para conocernos mejor. Descargá lo que necesites.'))}</p>
      <div class="res-grid">
        ${cards}
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    .res-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:24px}
    .res-card{display:flex;flex-direction:column;align-items:flex-start}
  </style>`,
  readmeNotes: () => [
    '**Recursos descargables**: los recursos salen del bloque *Textos por sección* del Builder; si no los editaste, los botones "Descargar" apuntan a `#` (placeholder). Subí tus PDF a la carpeta `public/` y poné la ruta real (por ejemplo `/guia-inicio.pdf`) en la última columna de cada línea, o editá el `href` después en la sección `recursos` de `public/index.html`. Los íconos no son editables desde el Builder: se cambian en `modules/ui/resources.js`.',
  ],
};
