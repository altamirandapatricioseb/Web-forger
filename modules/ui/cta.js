const { esc, txt } = require('../../src/templates');

module.exports = {
  id: 'cta', type: 'ui', name: 'Llamado a la acción',
  description: 'Banda destacada con título y botón antes del footer, para empujar el contacto o la conversión. El botón apunta al formulario de contacto si está activo.',
  fields: [
    { key: 'titulo', label: 'Título', default: '¿Listo para empezar?', max: 80 },
    { key: 'bajada', label: 'Bajada', type: 'textarea', default: 'Contanos qué necesitás y te respondemos a la brevedad, sin compromiso.', max: 220 },
    // Sin valor propio el botón sigue usando el CTA del hero, que es como venía funcionando:
    // por eso el default es vacío y el texto real llega como fallback de txt().
    { key: 'boton', label: 'Texto del botón', default: '', max: 40, hint: 'Si lo dejás vacío se usa el texto del botón del hero configurado más arriba.' },
  ],
  // Si el módulo contacto está activo el botón lleva a su página; si no, a Nosotros
  html: (cfg) => {
    const destino = cfg.moduleIds.includes('contact') ? '/contact.html' : '/about.html';
    return `  <section id="cta" style="background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 65%,var(--primary) 35%));padding:56px 0">
    <div class="container" style="display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between">
      <div>
        <h2 style="color:white;margin:0 0 6px">${esc(txt(cfg, 'cta', 'titulo', '¿Listo para empezar?'))}</h2>
        <p style="color:white;opacity:.85;margin:0;max-width:55ch">${esc(txt(cfg, 'cta', 'bajada', 'Contanos qué necesitás y te respondemos a la brevedad, sin compromiso.'))}</p>
      </div>
      <a class="btn" href="${destino}" style="background:white;color:var(--accent);white-space:nowrap">${esc(txt(cfg, 'cta', 'boton', cfg.texts.heroCta))}</a>
    </div>
  </section>`;
  },
  readmeNotes: () => [
    '**Llamado a la acción**: el título, la bajada y el texto del botón de la banda `#cta` salen del Builder (bloque *Textos por sección*); si dejás el botón vacío, reutiliza el texto del CTA del hero. También se pueden editar después en `public/index.html`.',
  ],
};
