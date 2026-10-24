module.exports = {
  id: 'map', type: 'ui', name: 'Mapa de ubicación',
  description: 'Dónde encontrarnos: mapa embebido de OpenStreetMap (gratis, sin API key) junto a dirección y horarios.',
  html: (cfg) => `  <section id="ubicacion">
    <div class="container">
      <h2>Dónde encontrarnos</h2>
      <p class="section-sub">Vení a visitarnos o escribinos: estamos para ayudarte.</p>
      <div class="grid cols-2">
        <iframe
          title="Mapa de ubicación de ${cfg.brand.name}"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-58.3922%2C-34.6095%2C-58.3722%2C-34.6015&amp;layer=mapnik&amp;marker=-34.6055%2C-58.3822"
          style="width:100%;min-height:320px;border:1px solid var(--line);border-radius:var(--radius)"
          loading="lazy"></iframe>
        <div class="card">
          <h3 style="margin-top:0">Datos de contacto</h3>
          <p><strong>Dirección:</strong> Av. Siempre Viva 742, Ciudad</p>
          <p><strong>Horario:</strong> Lunes a viernes de 9 a 18 h · Sábados de 9 a 13 h</p>
          <p><strong>Teléfono:</strong> +54 11 0000-0000</p>
          <p class="muted">También podés vernos en <a href="https://www.openstreetmap.org/?mlat=-34.6055&amp;mlon=-58.3822#map=16/-34.6055/-58.3822" target="_blank" rel="noopener">el mapa completo</a>.</p>
        </div>
      </div>
    </div>
  </section>`,
  readmeNotes: () => [
    '**Mapa de ubicación**: el mapa apunta a coordenadas de ejemplo (Obelisco, Buenos Aires). Reemplazá el `bbox` y el `marker` del iframe en `public/index.html` por tu ubicación real (en openstreetmap.org → Compartir → HTML tenés el embed listo), y actualizá dirección, horario y teléfono.',
  ],
};
