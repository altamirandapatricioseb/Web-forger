const { esc, txt, txtList } = require('../../src/templates');
const { phIcon, phIconOr } = require('../../src/icons');

// Icono Phosphor de tarjeta de servicio: tamaño fijo, color de acento. Va por phIconOr porque
// el nombre puede venir de un campo de texto del Builder: uno mal tipeado cae al de reserva
// en vez de tirar abajo la generación entera.
const icono = (nombre) => phIconOr(nombre, 'seal-check', { size: 34, color: 'var(--accent)' });

// Servicios por defecto: placeholders genéricos de un negocio comercial. `icon` guarda el
// NOMBRE Phosphor (phosphoricons.com) porque el módulo funcional `servicios` lo necesita como
// DATO para sembrar su colección: el SVG horneado no sirve de dato.
const SERVICIOS = [
  { icon: 'seal-check', titulo: 'Garantía de calidad', texto: 'Cada trabajo se revisa antes de entregarse. Si algo no está bien, lo resolvemos sin costo.' },
  { icon: 'chat-circle-dots', titulo: 'Atención personalizada', texto: 'Hablás siempre con una persona que conoce tu caso, no con un call center.' },
  { icon: 'lightning', titulo: 'Entrega rápida', texto: 'Tiempos claros desde el primer día y avisos de avance en cada etapa.' },
  { icon: 'shield-check', titulo: 'Confianza y respaldo', texto: 'Años de experiencia y clientes que nos recomiendan avalan nuestro trabajo.' },
  { icon: 'tag', titulo: 'Precios claros', texto: 'Presupuesto cerrado por adelantado, sin sorpresas ni costos ocultos.' },
  { icon: 'headset', titulo: 'Soporte continuo', texto: 'Después de la entrega seguimos disponibles para ajustes y consultas.' },
];

// Default del campo editable: exactamente los servicios de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ITEMS_DEFAULT = SERVICIOS.map(s => `${s.icon} | ${s.titulo} | ${s.texto}`).join('\n');

/**
 * Lista efectiva de servicios según la config del Builder.
 * La consumen también `servicespage` (la página de detalle) y el módulo funcional `servicios`
 * (que la usa de semilla): tiene que haber UNA sola fuente, o la página de detalle terminaría
 * mostrando servicios distintos de los de la Home.
 * Formatos aceptados por línea: "icono | título | texto", "título | texto" o sólo "título".
 */
function servicios(cfg) {
  const lineas = txtList(cfg, 'services', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return SERVICIOS;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = SERVICIOS[i % SERVICIOS.length];
    if (partes.length >= 3) return { icon: partes[0], titulo: partes[1], texto: partes.slice(2).join(' | ') };
    if (partes.length === 2) return { icon: base.icon, titulo: partes[0], texto: partes[1] };
    return { icon: base.icon, titulo: partes[0], texto: '' };
  });
}

module.exports = {
  id: 'services', type: 'ui', name: 'Servicios',
  description: 'Sección "Nuestros servicios": grilla de tarjetas con icono, título y descripción. La sección más pedida de un sitio comercial.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Nuestros servicios', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'Soluciones pensadas para cada etapa de tu negocio.', max: 220 },
    {
      key: 'items', label: 'Servicios', type: 'list', max: 2600, default: ITEMS_DEFAULT,
      hint: 'Un servicio por línea: icono | título | texto. El icono es un nombre de Phosphor (phosphoricons.com); si no existe se usa el de reserva. También vale "título | texto".',
    },
  ],
  // Si la página de servicios está activa, cada tarjeta enlaza a su detalle
  html: (cfg) => `  <section id="servicios">
    <div class="container">
      <h2>${esc(txt(cfg, 'services', 'titulo', 'Nuestros servicios'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'services', 'bajada', 'Soluciones pensadas para cada etapa de tu negocio.'))}</p>
      <div class="grid cols-3">
${servicios(cfg).map((s, i) => `        <div class="card">
          ${icono(s.icon)}
          <h3 style="margin:12px 0 6px">${esc(s.titulo)}</h3>
          <p class="muted" style="margin:0">${esc(s.texto)}</p>${cfg.moduleIds.includes('servicespage') ? `
          <a href="/services.html#servicio-${i + 1}" style="display:inline-flex;align-items:center;gap:4px;margin-top:10px;font-size:.9rem">Ver detalle ${phIcon('arrow-right', { size: 13 })}</a>` : ''}
        </div>`).join('\n')}
      </div>
    </div>
  </section>`,
  readmeNotes: () => [
    '**Servicios**: los servicios de la Home salen del campo "Servicios" del Builder (bloque *Textos por sección*); si no los editaste, son los placeholders genéricos. Se pueden cambiar después en la sección `#servicios` de `public/index.html`, o volverlos editables desde el sitio publicado con el módulo **Servicios administrables**.',
  ],
};

// Se exportan la lista base, el helper y el icono para que la página de detalle
// (`servicespage`) y el backend (`servicios`) usen exactamente los mismos datos que la Home.
module.exports.SERVICIOS = SERVICIOS;
module.exports.servicios = servicios;
module.exports.iconoServicio = icono;
