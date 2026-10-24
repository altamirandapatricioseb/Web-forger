// Escena 3D "Rueda y freno (automotor)" — STUB provisional (cubo neutro que rota).
// La escena real reemplaza este archivo cumpliendo el contrato documentado en casa.js.
module.exports = {
  id: 'rueda',
  label: 'Rueda y freno (automotor)',
  titulo: 'Lo que revisamos en cada service',
  pasos: [
    {
        "t": "La cubierta",
        "x": "Medimos la profundidad del dibujo y la presión antes de tocar nada."
    },
    {
        "t": "La llanta",
        "x": "Balanceo y alineación con equipo calibrado, no a ojo."
    },
    {
        "t": "El freno",
        "x": "Disco, pastillas y pinza a la vista: te mostramos lo que hay que cambiar."
    },
    {
        "t": "Sacá tu turno",
        "x": "Presupuesto cerrado antes de empezar y el auto listo el mismo día."
    }
],
  html: `<div class="e3s">
        <div class="e3s-cara e3s-f"></div><div class="e3s-cara e3s-t"></div>
        <div class="e3s-cara e3s-i"></div><div class="e3s-cara e3s-d"></div>
        <div class="e3s-cara e3s-a"></div><div class="e3s-cara e3s-b"></div>
      </div>`,
  css: `
  .s3d-esc-rueda .e3s { position: relative; width: 220px; height: 220px; transform-style: preserve-3d; }
  .s3d-esc-rueda .e3s-cara { position: absolute; left: 50%; top: 50%; width: 220px; height: 220px; margin: -110px 0 0 -110px;
    background: color-mix(in srgb, var(--accent) 22%, var(--surface)); border: 1px solid color-mix(in srgb, var(--text) 20%, transparent); }
  .s3d-esc-rueda .e3s-f { transform: translateZ(110px); }
  .s3d-esc-rueda .e3s-t { transform: rotateY(180deg) translateZ(110px); }
  .s3d-esc-rueda .e3s-i { transform: rotateY(-90deg) translateZ(110px); }
  .s3d-esc-rueda .e3s-d { transform: rotateY(90deg) translateZ(110px); }
  .s3d-esc-rueda .e3s-a { transform: rotateX(90deg) translateZ(110px); }
  .s3d-esc-rueda .e3s-b { transform: rotateX(-90deg) translateZ(110px); }
  .s3d-esc-rueda .s3d-world { transform: rotateX(18deg) rotateY(-30deg); }`,
  js: `function (p, q, u, W) {
    W.style.transform = 'rotateX(' + u.lerp(14, 32, p) + 'deg) rotateY(' + u.lerp(-30, 330, p) + 'deg)';
  }`,
};
