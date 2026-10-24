const { esc } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

// Sección "Próximos eventos / agenda": tarjetas con badge de fecha (día grande + mes),
// título, hora, lugar y CTA. Estática (sin JS): los datos son placeholders editables.
// Las tarjetas usan la clase .card, así el módulo reveal (si está activo) las anima al scroll.
module.exports = {
  id: 'events', type: 'ui', name: 'Próximos eventos',
  description: 'Agenda de próximos eventos con tarjetas (fecha, hora, lugar y botón). Estática, sin JS. Ideal para talleres, charlas, ferias o lanzamientos.',
  html: (cfg) => {
    // Botón a contacto si existe; si no, a Nosotros (siempre presente)
    const href = cfg.moduleIds.includes('contact') ? '/contact.html' : '/about.html';
    // Eventos placeholder: editá día, mes, título, hora y lugar según tu agenda real
    const eventos = [
      { dia: '15', mes: 'AGO', titulo: 'Taller de introducción', hora: '18:00 hs', lugar: 'Sede central' },
      { dia: '02', mes: 'SEP', titulo: 'Charla abierta a la comunidad', hora: '19:30 hs', lugar: 'Auditorio' },
      { dia: '20', mes: 'SEP', titulo: 'Jornada de puertas abiertas', hora: '10:00 hs', lugar: 'Todas las sucursales' },
    ];
    const cards = eventos.map(ev => `<article class="card ev-card">
          <div class="ev-fecha" aria-hidden="true">
            <span class="ev-dia">${esc(ev.dia)}</span>
            <span class="ev-mes">${esc(ev.mes)}</span>
          </div>
          <div class="ev-cuerpo">
            <h3 style="margin:0 0 8px">${esc(ev.titulo)}</h3>
            <p class="muted" style="margin:0;font-size:.88rem">
              ${phIcon('clock', { size: 14 })} ${esc(ev.hora)} · ${phIcon('map-pin', { size: 14 })} ${esc(ev.lugar)}
            </p>
            <p style="margin:14px 0 0"><a class="btn btn-sm" href="${href}">Quiero asistir</a></p>
          </div>
        </article>`).join('\n        ');
    return `  <section id="eventos">
    <div class="container">
      <h2>Próximos eventos</h2>
      <p class="section-sub">Sumate a nuestras próximas actividades. Reservá tu lugar con anticipación.</p>
      <div class="ev-grid">
        ${cards}
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    .ev-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:24px}
    .ev-card{display:flex;gap:16px;align-items:flex-start}
    .ev-fecha{flex:0 0 auto;width:64px;text-align:center;background:var(--accent);color:#fff;border-radius:12px;padding:10px 6px;line-height:1}
    .ev-dia{display:block;font-size:1.7rem;font-weight:800;letter-spacing:-.02em}
    .ev-mes{display:block;font-size:.72rem;letter-spacing:.08em;margin-top:4px;opacity:.9}
    .ev-cuerpo{flex:1 1 auto}
    .btn-sm{padding:7px 14px;font-size:.85rem}
  </style>`,
  readmeNotes: () => [
    '**Próximos eventos**: las fechas y datos de la sección `eventos` son placeholders. Editá el array `eventos` en `modules/ui/events.js` (o el HTML en `public/index.html`) con tu agenda real; quitá la sección cuando no tengas eventos activos.',
  ],
};
