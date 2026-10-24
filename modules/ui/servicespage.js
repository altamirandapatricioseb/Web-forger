// Reusa los MISMOS servicios que la sección de la home (única fuente de verdad): se piden por
// función porque desde el bloque "Textos por sección" del Builder la lista es editable, y una
// página de detalle que muestre otros servicios que la Home es peor que no tenerla.
const { servicios, iconoServicio } = require('./services');
const { esc, txt } = require('../../src/templates');

// Detalle placeholder por servicio: párrafo largo + puntos clave; el cliente lo edita en su HTML
const DETALLES = [
  { parrafo: 'Cada trabajo pasa por una revisión final antes de entregarse: verificamos terminaciones, funcionamiento y que el resultado coincida con lo acordado. Si algo no está a la altura, lo corregimos sin costo adicional.', puntos: ['Control de calidad documentado en cada entrega', 'Garantía escrita sobre el trabajo realizado', 'Correcciones sin cargo dentro del período de garantía'] },
  { parrafo: 'Desde el primer contacto hablás con una persona que conoce tu caso y lo sigue de principio a fin. Nada de derivaciones interminables: un solo interlocutor con la información completa.', puntos: ['Un responsable asignado a tu proyecto', 'Respuesta en el día por los canales que prefieras', 'Seguimiento posterior a la entrega'] },
  { parrafo: 'Definimos plazos reales desde el arranque y los cumplimos. Te avisamos el avance en cada etapa para que nunca tengas que preguntar en qué está tu pedido.', puntos: ['Cronograma acordado antes de empezar', 'Avisos de avance en cada hito', 'Entregas parciales cuando el proyecto lo permite'] },
  { parrafo: 'Años de trabajo sostenido y clientes que vuelven y nos recomiendan. La experiencia acumulada nos permite anticipar problemas antes de que aparezcan.', puntos: ['Trayectoria comprobable en el rubro', 'Referencias de clientes disponibles', 'Procesos probados en decenas de proyectos'] },
  { parrafo: 'El presupuesto que te pasamos es el precio final: cerrado por adelantado, con el detalle de qué incluye y qué no. Cualquier adicional se conversa y aprueba antes de ejecutarse.', puntos: ['Presupuesto detallado y sin letra chica', 'Sin costos sorpresa durante el trabajo', 'Adicionales siempre aprobados por vos antes'] },
  { parrafo: 'La entrega no es el final de la relación: seguimos disponibles para ajustes, consultas y mantenimiento. Queremos que lo que hicimos siga funcionando bien con el tiempo.', puntos: ['Soporte por consultas sin vencimiento', 'Ajustes menores incluidos el primer mes', 'Planes de mantenimiento opcionales'] },
];

module.exports = {
  id: 'servicespage', type: 'ui', name: 'Página de servicios',
  description: 'Página propia con el detalle de cada servicio (descripción ampliada y puntos clave, con anclas por servicio). Las tarjetas de la home enlazan a su detalle.',
  requires: ['services'],
  fields: [
    { key: 'titulo', label: 'Título de la página', default: 'Nuestros servicios', max: 80 },
    { key: 'bajada', label: 'Bajada de la página', default: 'El detalle de cómo trabajamos cada servicio. Cualquier duda, escribinos.', max: 240 },
  ],
  nav: () => [{ label: 'Servicios', href: '/services.html' }],
  pages: (cfg) => {
    // El CTA final apunta al canal de conversión disponible según los módulos activos
    const cta = cfg.moduleIds.includes('quote')
      ? { href: '/quote.html', label: 'Pedir presupuesto' }
      : cfg.moduleIds.includes('contact')
        ? { href: '/contact.html', label: 'Consultar ahora' }
        : { href: '/about.html', label: 'Conocenos' };
    return {
      services: {
        title: 'Servicios',
        html: `  <section>
    <div class="container" style="max-width:820px">
      <h2>${esc(txt(cfg, 'servicespage', 'titulo', 'Nuestros servicios'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'servicespage', 'bajada', 'El detalle de cómo trabajamos cada servicio. Cualquier duda, escribinos.'))}</p>
      <div id="servicios-detalle">
${servicios(cfg).map((s, i) => {
          // El detalle largo sigue siendo placeholder y hay 6: si el Builder cargó más
          // servicios, se reparten en ciclo en vez de romper con un índice inexistente.
          const d = DETALLES[i % DETALLES.length];
          return `      <article id="servicio-${i + 1}" class="card" style="margin-bottom:20px;scroll-margin-top:80px">
        <div style="display:flex;gap:14px;align-items:center;margin-bottom:10px">
          ${iconoServicio(s.icon)}
          <h3 style="margin:0">${esc(s.titulo)}</h3>
        </div>
        <p class="muted" style="margin:0 0 12px">${d.parrafo}</p>
        <ul style="margin:0;padding-left:20px">
${d.puntos.map(p => `          <li class="muted" style="margin:4px 0">${p}</li>`).join('\n')}
        </ul>
      </article>`;
        }).join('\n')}
      </div>
      <div style="text-align:center;margin-top:32px">
        <a class="btn" href="${cta.href}">${cta.label}</a>
      </div>
    </div>
  </section>`,
      },
    };
  },
  readmeNotes: () => [
    '**Página de servicios**: las descripciones ampliadas y los puntos clave de `public/services.html` son placeholders; editalos junto con las tarjetas de la home para que cuenten lo mismo.',
  ],
};

// Los detalles quedan exportados para que el módulo funcional `servicios` siembre la colección
// con EXACTAMENTE el mismo contenido que hornea esta página (única fuente de verdad).
module.exports.DETALLES = DETALLES;
