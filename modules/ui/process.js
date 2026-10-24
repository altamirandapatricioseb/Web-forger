const { esc, txt, txtList } = require('../../src/templates');

// Pasos placeholder de un proceso comercial tipo; editables desde el Builder
const PASOS = [
  { titulo: 'Contanos tu idea', texto: 'Nos escribís por el canal que prefieras y nos contás qué necesitás, sin compromiso.' },
  { titulo: 'Recibí tu propuesta', texto: 'Te enviamos una propuesta clara, con alcance, tiempos y precio cerrado.' },
  { titulo: 'Manos a la obra', texto: 'Ponemos el proyecto en marcha y te mantenemos al tanto de cada avance.' },
  { titulo: 'Entrega y seguimiento', texto: 'Entregamos en fecha y seguimos disponibles para lo que necesites después.' },
];

// Default del campo editable: exactamente los pasos de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ITEMS_DEFAULT = PASOS.map(p => `${p.titulo} | ${p.texto}`).join('\n');

// Lista efectiva de pasos según la config del Builder.
// Formatos aceptados por línea: "título | texto" o sólo "título".
function pasos(cfg) {
  const lineas = txtList(cfg, 'process', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return PASOS;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = PASOS[i % PASOS.length];
    if (partes.length >= 2) return { titulo: partes[0], texto: partes.slice(1).join(' | ') };
    return { titulo: partes[0], texto: base.texto };
  });
}

module.exports = {
  id: 'process', type: 'ui', name: 'Cómo trabajamos',
  description: 'Sección "Cómo trabajamos": pasos numerados del proceso, de la consulta a la entrega. Típica de sitios de servicios.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Cómo trabajamos', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'Un proceso claro de principio a fin, sin sorpresas.', max: 220 },
    {
      key: 'items', label: 'Pasos', type: 'list', max: 2000, default: ITEMS_DEFAULT,
      hint: 'Un paso por línea, en orden: título | texto. Se numeran solos según el orden. También vale sólo el título.',
    },
  ],
  html: (cfg) => `  <section id="proceso" style="background:var(--surface)">
    <div class="container">
      <h2>${esc(txt(cfg, 'process', 'titulo', 'Cómo trabajamos'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'process', 'bajada', 'Un proceso claro de principio a fin, sin sorpresas.'))}</p>
      <div class="grid cols-3">
${pasos(cfg).map((p, i) => `        <div class="card" style="background:var(--bg)">
          <div aria-hidden="true" style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;background:var(--accent);margin-bottom:12px">${i + 1}</div>
          <h3 style="margin:0 0 6px">${esc(p.titulo)}</h3>
          <p class="muted" style="margin:0">${esc(p.texto)}</p>
        </div>`).join('\n')}
      </div>
    </div>
  </section>`,
  readmeNotes: () => [
    '**Cómo trabajamos**: los pasos salen del bloque *Textos por sección* del Builder; si no los editaste, son placeholders. También podés cambiarlos después en la sección `#proceso` de `public/index.html`.',
  ],
};

// La lista efectiva se exporta para que el backend `historia` siembre la colección worksteps
// con EXACTAMENTE los pasos que hornea esta sección (misma razón que en features).
module.exports.pasos = pasos;
module.exports.PASOS = PASOS;
