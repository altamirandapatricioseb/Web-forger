// Escena 3D "Muela e implante (odontología)" — STUB provisional (cubo neutro que rota).
// La escena real reemplaza este archivo cumpliendo el contrato documentado en casa.js.
module.exports = {
  id: 'diente',
  label: 'Muela e implante (odontología)',
  titulo: 'Tu tratamiento, explicado',
  pasos: [
    {
        "t": "El diagnóstico",
        "x": "Estudiamos la pieza y el hueso antes de proponerte nada."
    },
    {
        "t": "El implante",
        "x": "Titanio que se integra al hueso y trabaja como una raíz propia."
    },
    {
        "t": "La corona",
        "x": "Diseñada a tu color y a tu mordida, para que ni vos la distingas."
    },
    {
        "t": "Primera consulta",
        "x": "Diagnóstico sin cargo y un plan con costos claros desde el inicio."
    }
],
  html: `<div class="e3s">
        <div class="e3s-cara e3s-f"></div><div class="e3s-cara e3s-t"></div>
        <div class="e3s-cara e3s-i"></div><div class="e3s-cara e3s-d"></div>
        <div class="e3s-cara e3s-a"></div><div class="e3s-cara e3s-b"></div>
      </div>`,
  css: `
  .s3d-esc-diente .e3s { position: relative; width: 220px; height: 220px; transform-style: preserve-3d; }
  .s3d-esc-diente .e3s-cara { position: absolute; left: 50%; top: 50%; width: 220px; height: 220px; margin: -110px 0 0 -110px;
    background: color-mix(in srgb, var(--accent) 22%, var(--surface)); border: 1px solid color-mix(in srgb, var(--text) 20%, transparent); }
  .s3d-esc-diente .e3s-f { transform: translateZ(110px); }
  .s3d-esc-diente .e3s-t { transform: rotateY(180deg) translateZ(110px); }
  .s3d-esc-diente .e3s-i { transform: rotateY(-90deg) translateZ(110px); }
  .s3d-esc-diente .e3s-d { transform: rotateY(90deg) translateZ(110px); }
  .s3d-esc-diente .e3s-a { transform: rotateX(90deg) translateZ(110px); }
  .s3d-esc-diente .e3s-b { transform: rotateX(-90deg) translateZ(110px); }
  .s3d-esc-diente .s3d-world { transform: rotateX(18deg) rotateY(-30deg); }`,
  js: `function (p, q, u, W) {
    W.style.transform = 'rotateX(' + u.lerp(14, 32, p) + 'deg) rotateY(' + u.lerp(-30, 330, p) + 'deg)';
  }`,
};
