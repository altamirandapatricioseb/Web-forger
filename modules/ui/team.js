module.exports = {
  id: 'team', type: 'ui', name: 'Equipo',
  description: 'Sección "Nuestro equipo" con foto (avatar de iniciales), nombre, rol y mini bio.',
  html: (cfg) => `  <section id="equipo">
    <div class="container">
      <h2>Nuestro equipo</h2>
      <p class="section-sub">Las personas detrás de ${cfg.brand.name}.</p>
      <div class="grid cols-3">
        ${[
          { n: 'Ana Pérez', r: 'Dirección general', b: 'Lidera el rumbo del negocio con 15 años de oficio.' },
          { n: 'Bruno Díaz', r: 'Atención al cliente', b: 'Tu primer contacto: rápido, claro y resolutivo.' },
          { n: 'Carla Gómez', r: 'Operaciones', b: 'Hace que todo salga a tiempo y como se prometió.' },
        ].map((p, i) => `<div class="card" style="text-align:center">
          <div aria-hidden="true" style="width:72px;height:72px;margin:0 auto 12px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.3rem;color:#fff;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--primary) ${40 + i * 20}%,var(--accent)))">${p.n.split(' ').map(w => w[0]).join('')}</div>
          <h3 style="margin:0 0 2px">${p.n}</h3>
          <p style="margin:0 0 8px;color:var(--accent);font-size:.9rem;font-weight:600">${p.r}</p>
          <p class="muted" style="margin:0;font-size:.92rem">${p.b}</p>
        </div>`).join('\n        ')}
      </div>
    </div>
  </section>`,
};
