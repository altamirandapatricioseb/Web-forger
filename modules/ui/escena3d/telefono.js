/**
 * Escena 3D "Teléfono desarmado" (rubro tecnología / electrónica) del módulo escena3d.
 * Cumple el contrato documentado en casa.js (id, label, titulo, pasos, html, css, js).
 *
 * Geometría: un smartphone de pie mirando al visitante, 170 (x) por 330 (y), armado como
 * sándwich de 5 capas apiladas en Z (de atrás hacia adelante):
 *   0 tapa trasera (isla de cámaras + logo)   z reposo -6
 *   1 batería (rayo de carga)                 z reposo -3
 *   2 placa lógica (chips + pistas)           z reposo  0
 *   3 marco medio (chasis de aluminio)        z reposo +3
 *   4 pantalla (vidrio, notch y status bar)   z reposo +6
 * Cada capa es un plano centrado en el mundo: su transform es SOLO translateZ, así el JS
 * puede pisarlo completo con un único valor por frame. El recorrido: órbita del equipo
 * armado → EXPLOSIÓN en vista lateral (cada capa i se separa translateZ((i-2)·sep), la de
 * atrás primero) → paseo de cámara con el equipo abierto → REENSAMBLE de frente con un
 * brillo sutil de pantalla.
 */
module.exports = {
  id: 'telefono',
  label: 'Teléfono desarmado (tecnología)',
  titulo: 'Mirá lo que llevás en el bolsillo',
  pasos: [
    { t: 'Diseño exterior', x: 'Cada detalle del equipo, pensado para durar.' },
    { t: 'Por dentro', x: 'Los componentes que hacen el trabajo pesado, capa por capa.' },
    { t: 'Ingeniería real', x: 'Batería, placa y cámara: calidad que no se ve pero se nota.' },
    { t: 'Todo vuelve a su lugar', x: 'Armado de precisión, garantía oficial y soporte local.' },
  ],
  html: `<div class="e3t">
        <div class="e3t-capa e3t-tapa">
          <div class="e3t-isla">
            <div class="e3t-lente e3t-lente-a"></div>
            <div class="e3t-lente e3t-lente-b"></div>
            <div class="e3t-flash"></div>
          </div>
          <div class="e3t-logo"></div>
        </div>
        <div class="e3t-capa e3t-bateria">
          <div class="e3t-banda"></div>
          <div class="e3t-rayo"></div>
        </div>
        <div class="e3t-capa e3t-placa">
          <div class="e3t-chip e3t-chip-a"></div>
          <div class="e3t-chip e3t-chip-b"></div>
          <div class="e3t-chip e3t-chip-c"></div>
          <div class="e3t-chip e3t-chip-d"></div>
        </div>
        <div class="e3t-capa e3t-marco">
          <div class="e3t-boton e3t-boton-a"></div>
          <div class="e3t-boton e3t-boton-b"></div>
        </div>
        <div class="e3t-capa e3t-pantalla">
          <div class="e3t-notch"></div>
          <div class="e3t-pill e3t-pill-a"></div>
          <div class="e3t-pill e3t-pill-b"></div>
          <div class="e3t-reflejo"></div>
          <div class="e3t-brillo"></div>
        </div>
        <div class="e3t-sombra"></div>
      </div>`,
  css: `
  .s3d-esc-telefono .e3t { position: relative; width: 170px; height: 330px; transform-style: preserve-3d; }
  .s3d-esc-telefono .e3t > div { position: absolute; left: 50%; top: 50%; transform-style: preserve-3d; }
  /* capas del sándwich: 170x330 centradas en el mundo; el transform sólo apila en Z */
  .s3d-esc-telefono .e3t-capa { width: 170px; height: 330px; margin: -165px 0 0 -85px; border-radius: 26px; }
  /* tapa trasera */
  .s3d-esc-telefono .e3t-tapa { background: linear-gradient(165deg, color-mix(in srgb, var(--primary) 52%, var(--surface)), color-mix(in srgb, var(--primary) 26%, var(--bg)));
    border: 1px solid color-mix(in srgb, var(--text) 24%, transparent); transform: translateZ(-6px); }
  /* isla de cámaras (nieta de .e3t, por eso el absolute propio); asoma 4px hacia afuera */
  .s3d-esc-telefono .e3t-isla { position: absolute; left: 14px; top: 14px; width: 66px; height: 66px; border-radius: 18px;
    background: color-mix(in srgb, var(--primary) 66%, var(--bg));
    border: 1px solid color-mix(in srgb, var(--text) 30%, transparent); transform: translateZ(-4px); }
  /* vidrio de lente: azulado a propósito (material), siempre mezclado con los tokens */
  .s3d-esc-telefono .e3t-lente { position: absolute; width: 22px; height: 22px; border-radius: 50%;
    background: radial-gradient(circle at 35% 32%, color-mix(in srgb, #9fc7e8 45%, var(--primary)), color-mix(in srgb, #0b1626 78%, var(--primary)) 72%);
    border: 2px solid color-mix(in srgb, var(--text) 40%, var(--surface)); }
  .s3d-esc-telefono .e3t-lente-a { left: 8px; top: 8px; }
  .s3d-esc-telefono .e3t-lente-b { left: 8px; top: 36px; }
  /* lente del flash: ambar palido a propósito (material) */
  .s3d-esc-telefono .e3t-flash { position: absolute; left: 42px; top: 12px; width: 11px; height: 11px; border-radius: 50%;
    background: color-mix(in srgb, #f4e9c8 55%, var(--surface)); border: 1px solid color-mix(in srgb, var(--text) 25%, transparent); }
  .s3d-esc-telefono .e3t-logo { position: absolute; left: 50%; top: 52%; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%;
    background: color-mix(in srgb, var(--accent) 55%, transparent); }
  /* batería */
  .s3d-esc-telefono .e3t-bateria { width: 126px; height: 198px; margin: -99px 0 0 -63px; border-radius: 14px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--text) 14%, var(--surface)), color-mix(in srgb, var(--text) 30%, var(--surface)));
    border: 1px solid color-mix(in srgb, var(--text) 32%, transparent); transform: translateZ(-3px); }
  .s3d-esc-telefono .e3t-banda { position: absolute; left: 50%; top: 16px; width: 92px; height: 7px; margin-left: -46px; border-radius: 4px;
    background: color-mix(in srgb, var(--text) 42%, var(--surface)); }
  .s3d-esc-telefono .e3t-rayo { position: absolute; left: 50%; top: 50%; width: 36px; height: 60px; margin: -26px 0 0 -18px;
    background: color-mix(in srgb, var(--accent) 78%, var(--surface));
    clip-path: polygon(56% 0, 12% 56%, 44% 56%, 40% 100%, 88% 40%, 54% 40%); }
  /* placa lógica: base con dos rejillas finas de pistas hechas con gradientes */
  .s3d-esc-telefono .e3t-placa { width: 146px; height: 296px; margin: -148px 0 0 -73px; border-radius: 14px;
    background: repeating-linear-gradient(0deg, transparent 0 21px, color-mix(in srgb, var(--accent) 30%, transparent) 21px 22px),
      repeating-linear-gradient(90deg, transparent 0 25px, color-mix(in srgb, var(--accent) 22%, transparent) 25px 26px),
      linear-gradient(170deg, color-mix(in srgb, var(--primary) 44%, var(--surface)), color-mix(in srgb, var(--primary) 60%, var(--bg)));
    border: 1px solid color-mix(in srgb, var(--text) 26%, transparent); transform: translateZ(0px); }
  .s3d-esc-telefono .e3t-chip { position: absolute; border-radius: 5px;
    background: linear-gradient(145deg, color-mix(in srgb, var(--text) 58%, var(--surface)), color-mix(in srgb, var(--text) 76%, var(--bg)));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--text) 30%, transparent) inset; }
  .s3d-esc-telefono .e3t-chip-a { left: 50%; top: 54px; width: 46px; height: 46px; margin-left: -23px; }
  .s3d-esc-telefono .e3t-chip-b { left: 22px; top: 128px; width: 30px; height: 30px; }
  .s3d-esc-telefono .e3t-chip-c { left: 88px; top: 122px; width: 26px; height: 44px; }
  .s3d-esc-telefono .e3t-chip-d { left: 34px; top: 196px; width: 20px; height: 20px; }
  /* marco medio: anillo de chasis; aluminio gris a propósito (material), anclado a la superficie */
  .s3d-esc-telefono .e3t-marco { box-sizing: border-box; border-radius: 28px; background: transparent;
    border: 7px solid color-mix(in srgb, #b6bdc6 55%, var(--surface)); transform: translateZ(3px); }
  .s3d-esc-telefono .e3t-boton { position: absolute; right: -4px; width: 4px; border-radius: 2px;
    background: color-mix(in srgb, #b6bdc6 45%, var(--text)); }
  .s3d-esc-telefono .e3t-boton-a { top: 84px; height: 40px; }
  .s3d-esc-telefono .e3t-boton-b { top: 136px; height: 26px; }
  /* pantalla: vidrio apagado azul noche a propósito (material), anclado al primario */
  .s3d-esc-telefono .e3t-pantalla { background: linear-gradient(160deg, color-mix(in srgb, #101a2e 80%, var(--primary)), color-mix(in srgb, #070c16 85%, var(--primary)));
    border: 1px solid color-mix(in srgb, var(--text) 30%, transparent); transform: translateZ(6px); }
  .s3d-esc-telefono .e3t-notch { position: absolute; left: 50%; top: 10px; width: 54px; height: 16px; margin-left: -27px; border-radius: 9px;
    background: color-mix(in srgb, #05080f 82%, var(--primary)); }
  /* status bar insinuada: dos píldoras de luz emitida (blanco frío a propósito) */
  .s3d-esc-telefono .e3t-pill { position: absolute; top: 15px; height: 6px; border-radius: 3px;
    background: color-mix(in srgb, #eaf1f8 62%, var(--accent)); opacity: 0.85; }
  .s3d-esc-telefono .e3t-pill-a { left: 16px; width: 26px; }
  .s3d-esc-telefono .e3t-pill-b { right: 16px; width: 16px; }
  /* reflejo diagonal fijo del vidrio (blanco diluido a propósito) */
  .s3d-esc-telefono .e3t-reflejo { position: absolute; left: 0; top: 0; width: 100%; height: 100%; border-radius: 26px;
    background: linear-gradient(115deg, transparent 40%, color-mix(in srgb, white 15%, transparent) 50%, transparent 60%); }
  /* brillo del final: apagado en reposo, el JS lo enciende en el reensamble */
  .s3d-esc-telefono .e3t-brillo { position: absolute; left: 0; top: 0; width: 100%; height: 100%; border-radius: 26px;
    background: radial-gradient(circle at 50% 32%, color-mix(in srgb, var(--accent) 40%, transparent), transparent 72%); opacity: 0; }
  /* sombra de contacto: aporta el peso que el CSS 3D no da solo */
  .s3d-esc-telefono .e3t-sombra { width: 250px; height: 96px; margin: -48px 0 0 -125px; border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--text) 28%, transparent), transparent 72%);
    transform: rotateX(90deg) translateZ(-172px); }
  /* pose de reposo del mundo (sin JS): teléfono armado en tres cuartos */
  .s3d-esc-telefono .s3d-world { transform: rotateX(8deg) rotateY(-28deg); }`,
  js: `function (p, q, u, W) {
    // cámara: órbita del equipo armado, vista lateral para la explosión, paseo y frente final.
    // Cada lerp encadenado parte del valor ya saturado del tramo anterior: puro respecto de p.
    var rotY = u.lerp(-28, 25, u.seg(p, 0, 0.22));
    rotY = u.lerp(rotY, 55, u.seg(p, 0.22, 0.55));
    rotY = u.lerp(rotY, 80, u.seg(p, 0.55, 0.8));
    rotY = u.lerp(rotY, 8, u.seg(p, 0.8, 1));
    var rotX = u.lerp(8, 14, u.seg(p, 0.22, 0.55));
    rotX = u.lerp(rotX, 6, u.seg(p, 0.8, 1));
    // el zoom cede durante la explosión para que el abanico entre en el viewport
    var zoom = u.lerp(1, 0.85, u.seg(p, 0.22, 0.55));
    zoom = u.lerp(zoom, 1, u.seg(p, 0.8, 1));
    W.style.transform = 'rotateX(' + rotX.toFixed(2) + 'deg) rotateY(' + rotY.toFixed(2) + 'deg) scale(' + zoom.toFixed(3) + ')';
    // explosión: cada capa i se aparta translateZ((i-2)·sep), escalonada (la de atrás primero);
    // el cierre (0.8-1) deshace la separación y devuelve el sándwich a los 3px de reposo
    var cierre = u.seg(p, 0.8, 1);
    var capas = ['.e3t-tapa', '.e3t-bateria', '.e3t-placa', '.e3t-marco', '.e3t-pantalla'];
    for (var i = 0; i < capas.length; i++) {
      var c = q(capas[i]);
      if (!c) continue;
      var abre = u.seg(p, 0.22 + i * 0.033, 0.44 + i * 0.033);
      var z = (i - 2) * (3 + 92 * abre * (1 - cierre));
      c.style.transform = 'translateZ(' + z.toFixed(1) + 'px)';
    }
    // la pantalla clarea un poco abierta, para que se lean las capas de atrás
    var apertura = u.seg(p, 0.25, 0.5) * (1 - cierre);
    var pan = q('.e3t-pantalla');
    if (pan) pan.style.opacity = String(1 - 0.15 * apertura);
    // brillo sutil de pantalla al cerrar el reensamble
    var br = q('.e3t-brillo');
    if (br) br.style.opacity = String(u.seg(p, 0.86, 1));
    // la sombra respira con la explosión: el abanico proyecta más piso
    var so = q('.e3t-sombra');
    if (so) so.style.transform = 'rotateX(90deg) translateZ(-172px) scale(' + (1 + 0.4 * apertura).toFixed(3) + ')';
  }`,
};
