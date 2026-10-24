/**
 * Escena 3D "Caja de envío" (rubro e-commerce / logística) del módulo escena3d.
 * Cumple el contrato documentado en casa.js (la implementación de referencia).
 *
 * Geometría de la caja: ancho 240 (x), alto 150 (y), profundidad 180 (z).
 * Paredes en z=±90 y x=±120; el fondo se acuesta con rotateX(90) translateZ(-75)
 * (recordar: tras rotateX(90) un translateZ positivo mueve en -y, hacia arriba).
 * Las 4 solapas van bisagradas en la arista superior de su pared (y=-75) con
 * transform-origin en su borde inferior: rotateX(90) = cerrada (horizontal hacia
 * el centro), rotateX(-70) = abierta hacia afuera (160 grados de recorrido).
 * Apilado del cierre (evita z-fighting y cruces al abrir): solapas laterales 3px
 * por encima de las grandes (bisagra en y=-78), la cinta a y=-81 sobre la juntura.
 *
 * El recorrido: órbita de la caja cerrada → la cinta se corta → las solapas se
 * abren escalonadas mientras la cámara sube a mirar adentro → el producto se
 * eleva girando con su halo encendiéndose → flota mientras el conjunto orbita.
 */
module.exports = {
  id: 'caja',
  label: 'Caja de envío (e-commerce)',
  titulo: 'Del carrito a tu puerta',
  pasos: [
    { t: 'Empacado con cuidado', x: 'Cada pedido se prepara y protege como si fuera para nosotros.' },
    { t: 'Se abre la caja', x: 'Todo llega completo, ordenado y listo para usar.' },
    { t: 'Tu compra, impecable', x: 'Productos originales con garantía y factura incluida.' },
    { t: 'Envíos a todo el país', x: 'Seguimiento en línea desde que sale hasta que llega.' },
  ],
  html: `<div class="e3j">
        <div class="e3j-sombra"></div>
        <div class="e3j-fondo"></div>
        <div class="e3j-pared e3j-pared-f">
          <div class="e3j-eti"><div class="e3j-eti-l1"></div><div class="e3j-eti-l2"></div><div class="e3j-eti-l3"></div><div class="e3j-eti-cod"></div></div>
          <div class="e3j-tab e3j-tab-f"></div>
        </div>
        <div class="e3j-pared e3j-pared-t"><div class="e3j-tab e3j-tab-t"></div></div>
        <div class="e3j-pared e3j-pared-i"></div>
        <div class="e3j-pared e3j-pared-d"></div>
        <div class="e3j-int e3j-int-f"></div>
        <div class="e3j-int e3j-int-t"></div>
        <div class="e3j-int e3j-int-i"></div>
        <div class="e3j-int e3j-int-d"></div>
        <div class="e3j-prod">
          <div class="e3j-cara e3j-cara-f"></div><div class="e3j-cara e3j-cara-t"></div>
          <div class="e3j-cara e3j-cara-i"></div><div class="e3j-cara e3j-cara-d"></div>
          <div class="e3j-cara e3j-cara-a"></div><div class="e3j-cara e3j-cara-b"></div>
          <div class="e3j-halo e3j-halo-a"></div><div class="e3j-halo e3j-halo-b"></div>
        </div>
        <div class="e3j-sol e3j-sol-i"></div>
        <div class="e3j-sol e3j-sol-d"></div>
        <div class="e3j-sol e3j-sol-t"></div>
        <div class="e3j-sol e3j-sol-f"></div>
        <div class="e3j-cinta"></div>
      </div>`,
  css: `
  .s3d-esc-caja .e3j { position: relative; width: 340px; height: 330px; transform-style: preserve-3d; }
  .s3d-esc-caja .e3j > div { position: absolute; left: 50%; top: 50%; transform-style: preserve-3d; }
  /* paredes de cartón kraft (marrón papel mezclado con la paleta, veta vertical sutil) */
  .s3d-esc-caja .e3j-pared { width: 240px; height: 150px; margin: -75px 0 0 -120px;
    background:
      repeating-linear-gradient(90deg, transparent 0 18px, color-mix(in srgb, var(--text) 4%, transparent) 18px 20px),
      linear-gradient(180deg, color-mix(in srgb, #c99e66 55%, var(--surface)), color-mix(in srgb, #9a6f3f 55%, var(--surface)));
    border: 1px solid color-mix(in srgb, var(--text) 24%, transparent); }
  .s3d-esc-caja .e3j-pared-f { transform: translateZ(90px); }
  .s3d-esc-caja .e3j-pared-t { transform: rotateY(180deg) translateZ(90px); }
  .s3d-esc-caja .e3j-pared-i, .s3d-esc-caja .e3j-pared-d { width: 180px; margin-left: -90px; }
  .s3d-esc-caja .e3j-pared-i { transform: rotateY(-90deg) translateZ(120px); }
  .s3d-esc-caja .e3j-pared-d { transform: rotateY(90deg) translateZ(120px); }
  /* caras internas: forros levemente metidos hacia adentro, más oscuros en la parte alta
     (la sombra de las solapas); backface oculto para que no asomen desde afuera */
  .s3d-esc-caja .e3j-int { width: 234px; height: 146px; margin: -73px 0 0 -117px; backface-visibility: hidden;
    background: linear-gradient(180deg, color-mix(in srgb, #33220f 80%, var(--primary)), color-mix(in srgb, #6f4d2b 55%, var(--surface)) 72%); }
  .s3d-esc-caja .e3j-int-f { transform: translateZ(87px) rotateY(180deg); }
  .s3d-esc-caja .e3j-int-t { transform: translateZ(-87px); }
  .s3d-esc-caja .e3j-int-i, .s3d-esc-caja .e3j-int-d { width: 174px; margin-left: -87px; }
  .s3d-esc-caja .e3j-int-i { transform: rotateY(90deg) translateZ(-117px); }
  .s3d-esc-caja .e3j-int-d { transform: rotateY(-90deg) translateZ(-117px); }
  /* fondo: su cara frontal apunta hacia arriba, es el piso interior que se ve al abrir */
  .s3d-esc-caja .e3j-fondo { width: 240px; height: 180px; margin: -90px 0 0 -120px;
    background: radial-gradient(closest-side, color-mix(in srgb, #7a5530 45%, var(--surface)), color-mix(in srgb, #46301a 60%, var(--surface)));
    transform: rotateX(90deg) translateZ(-75px); }
  /* solapas: bisagra en el borde inferior del elemento (la arista superior de su pared) */
  .s3d-esc-caja .e3j-sol { transform-origin: 50% 100%;
    background:
      repeating-linear-gradient(90deg, transparent 0 18px, color-mix(in srgb, var(--text) 4%, transparent) 18px 20px),
      linear-gradient(180deg, color-mix(in srgb, #cfa670 55%, var(--surface)), color-mix(in srgb, #a97c48 55%, var(--surface)));
    border: 1px solid color-mix(in srgb, var(--text) 22%, transparent); }
  .s3d-esc-caja .e3j-sol-f, .s3d-esc-caja .e3j-sol-t { width: 240px; height: 90px; margin: -45px 0 0 -120px; }
  .s3d-esc-caja .e3j-sol-i, .s3d-esc-caja .e3j-sol-d { width: 180px; height: 60px; margin: -30px 0 0 -90px; }
  /* pose de reposo: caja cerrada (rotateX(90) deja la solapa horizontal hacia el centro) */
  .s3d-esc-caja .e3j-sol-f { transform: translateY(-120px) translateZ(90px) rotateX(90deg); }
  .s3d-esc-caja .e3j-sol-t { transform: rotateY(180deg) translateY(-120px) translateZ(90px) rotateX(90deg); }
  .s3d-esc-caja .e3j-sol-i { transform: rotateY(-90deg) translateY(-108px) translateZ(120px) rotateX(90deg); }
  .s3d-esc-caja .e3j-sol-d { transform: rotateY(90deg) translateY(-108px) translateZ(120px) rotateX(90deg); }
  /* cinta de embalaje sobre la juntura de las solapas grandes, con un brillo al medio */
  .s3d-esc-caja .e3j-cinta { width: 244px; height: 48px; margin: -24px 0 0 -122px;
    background:
      linear-gradient(90deg, transparent 12%, color-mix(in srgb, white 18%, transparent) 50%, transparent 88%),
      linear-gradient(180deg, color-mix(in srgb, white 22%, var(--accent)), var(--accent) 55%, color-mix(in srgb, var(--primary) 26%, var(--accent)));
    transform: rotateX(90deg) translateZ(81px); }
  /* rabos de la cinta que bajan por el frente y el fondo (hijos 2D dentro de su pared) */
  .s3d-esc-caja .e3j-tab { position: absolute; left: 50%; top: 0; width: 48px; height: 26px; margin-left: -24px;
    background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--primary) 26%, var(--accent))); }
  /* etiqueta de envío: papel claro con líneas de "texto" y un código de barras */
  .s3d-esc-caja .e3j-eti { position: absolute; left: 26px; top: 44px; width: 96px; height: 62px; border-radius: 3px;
    background: color-mix(in srgb, #ffffff 78%, var(--surface));
    box-shadow: 0 1px 4px color-mix(in srgb, var(--text) 25%, transparent);
    transform: rotate(-2deg); }
  .s3d-esc-caja .e3j-eti div { position: absolute; left: 10px; height: 5px; border-radius: 2px;
    background: color-mix(in srgb, var(--text) 55%, transparent); }
  .s3d-esc-caja .e3j-eti-l1 { top: 10px; width: 62px; }
  .s3d-esc-caja .e3j-eti-l2 { top: 21px; width: 46px; }
  .s3d-esc-caja .e3j-eti-l3 { top: 32px; width: 56px; }
  .s3d-esc-caja .e3j-eti .e3j-eti-cod { top: 44px; width: 44px; height: 9px; border-radius: 0;
    background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--text) 70%, transparent) 0 2px, transparent 2px 4px); }
  /* producto: cubo acento con brillo; arranca apoyado dentro de la caja (centro en y=30) */
  .s3d-esc-caja .e3j-prod { width: 90px; height: 90px; margin: -45px 0 0 -45px; transform: translateY(30px); }
  .s3d-esc-caja .e3j-prod div { position: absolute; left: 50%; top: 50%; }
  .s3d-esc-caja .e3j-cara { width: 90px; height: 90px; margin: -45px 0 0 -45px;
    background: linear-gradient(155deg, color-mix(in srgb, white 32%, var(--accent)), var(--accent) 48%, color-mix(in srgb, var(--primary) 36%, var(--accent)));
    box-shadow: 0 0 0 1px color-mix(in srgb, white 24%, var(--accent)) inset; }
  .s3d-esc-caja .e3j-cara-f { transform: translateZ(45px); }
  .s3d-esc-caja .e3j-cara-t { transform: rotateY(180deg) translateZ(45px); }
  .s3d-esc-caja .e3j-cara-i { transform: rotateY(-90deg) translateZ(45px); }
  .s3d-esc-caja .e3j-cara-d { transform: rotateY(90deg) translateZ(45px); }
  .s3d-esc-caja .e3j-cara-a { transform: rotateX(90deg) translateZ(45px);
    background: linear-gradient(155deg, color-mix(in srgb, white 45%, var(--accent)), color-mix(in srgb, white 12%, var(--accent))); }
  .s3d-esc-caja .e3j-cara-b { transform: rotateX(-90deg) translateZ(45px); }
  /* halos cruzados (uno de frente, otro a 90 grados): apagados hasta que el producto asoma */
  .s3d-esc-caja .e3j-halo { width: 190px; height: 190px; margin: -95px 0 0 -95px; opacity: 0;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 42%, transparent), color-mix(in srgb, var(--accent) 12%, transparent) 55%, transparent 75%); }
  .s3d-esc-caja .e3j-halo-b { transform: rotateY(90deg); }
  /* sombra de contacto: aporta el peso que el CSS 3D no da solo */
  .s3d-esc-caja .e3j-sombra { width: 340px; height: 250px; margin: -125px 0 0 -170px; border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--text) 28%, transparent), transparent 70%);
    transform: rotateX(90deg) translateZ(-80px); }
  /* pose de reposo del mundo (sin JS): caja cerrada en tres cuartos */
  .s3d-esc-caja .s3d-world { transform: rotateX(18deg) rotateY(-32deg); }`,
  js: `function (p, q, u, W) {
    // cámara: órbita de presentación, sube para mirar adentro y baja para la vuelta final
    var giro = u.lerp(-32, 28, u.seg(p, 0, 0.26)) + u.lerp(0, 76, u.seg(p, 0.58, 1));
    var alza = u.lerp(18, 40, u.seg(p, 0.3, 0.55)) + u.lerp(0, -13, u.seg(p, 0.78, 1));
    var zoom = 0.96 + 0.07 * Math.sin(Math.PI * u.clamp(p, 0, 1));
    W.style.transform = 'rotateX(' + alza.toFixed(2) + 'deg) rotateY(' + giro.toFixed(2) + 'deg) scale(' + zoom.toFixed(3) + ')';
    // la cinta se corta: se retrae hacia el centro y desaparece (los rabos la siguen)
    var corte = 1 - u.seg(p, 0.22, 0.32);
    var cinta = q('.e3j-cinta');
    if (cinta) {
      cinta.style.transform = 'rotateX(90deg) translateZ(81px) scaleX(' + Math.max(corte, 0.001).toFixed(3) + ')';
      cinta.style.opacity = String(corte);
    }
    var tf = q('.e3j-tab-f'), tt = q('.e3j-tab-t');
    if (tf) tf.style.opacity = String(corte);
    if (tt) tt.style.opacity = String(corte);
    // solapas: primero las laterales (van arriba de la pila), después fondo y frente;
    // cada transform repite la base del CSS y sólo varía el ángulo de la bisagra
    var abre = [
      ['.e3j-sol-i', u.seg(p, 0.3, 0.46), 'rotateY(-90deg) translateY(-108px) translateZ(120px)'],
      ['.e3j-sol-d', u.seg(p, 0.32, 0.48), 'rotateY(90deg) translateY(-108px) translateZ(120px)'],
      ['.e3j-sol-t', u.seg(p, 0.36, 0.52), 'rotateY(180deg) translateY(-120px) translateZ(90px)'],
      ['.e3j-sol-f', u.seg(p, 0.38, 0.55), 'translateY(-120px) translateZ(90px)'],
    ];
    for (var i = 0; i < abre.length; i++) {
      var s = q(abre[i][0]);
      if (s) s.style.transform = abre[i][2] + ' rotateX(' + u.lerp(90, -70, abre[i][1]).toFixed(2) + 'deg)';
    }
    // el producto se eleva desde adentro (y=30) hasta flotar por encima (y=-140),
    // gira lento y al final ondula con un seno sutil (función pura de p)
    var sube = u.seg(p, 0.55, 0.8);
    var flota = u.seg(p, 0.8, 1);
    var y = u.lerp(30, -140, sube) + 4 * flota * Math.sin(p * Math.PI * 7);
    var vuelta = u.lerp(0, 180, u.seg(p, 0.55, 0.86)) + u.lerp(0, 26, u.seg(p, 0.86, 1));
    var prod = q('.e3j-prod');
    if (prod) prod.style.transform = 'translateY(' + y.toFixed(1) + 'px) rotateY(' + vuelta.toFixed(2) + 'deg)';
    // el halo se enciende recién cuando el producto asoma de la caja
    var halo = 0.9 * u.seg(p, 0.62, 0.86);
    var ha = q('.e3j-halo-a'), hb = q('.e3j-halo-b');
    if (ha) ha.style.opacity = String(halo);
    if (hb) hb.style.opacity = String(halo);
  }`,
};
