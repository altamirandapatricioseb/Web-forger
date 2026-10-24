/**
 * Escena 3D "Casa" (rubro inmobiliaria / construcción) del módulo escena3d.
 *
 * CONTRATO DE ESCENA (vale para todos los archivos de esta carpeta):
 *   id       clave del select del Builder
 *   label    etiqueta del select
 *   titulo   título por defecto de la sección (el Builder puede pisarlo)
 *   pasos    [{t, x}] pasos por defecto del recorrido (el Builder puede pisarlos)
 *   html     marcado del objeto, va dentro de .s3d-world (aria-hidden lo pone el módulo)
 *   css      estilos de la escena, con selectores bajo .s3d-esc-<id>
 *   js       string con UNA función "function (p, q, u, W) { … }" que recibe el progreso
 *            0..1 del scroll, q(sel) (querySelector cacheado dentro de la sección),
 *            u = {lerp, clamp, seg} y W (el nodo .s3d-world). No usa nada de afuera.
 *
 * Convenciones que mantienen cuerda la geometría:
 *   - Toda pieza: position:absolute; left:50%; top:50%; margin-left:-W/2; margin-top:-H/2.
 *     Así el origen local de cada pieza es el CENTRO del mundo y el transform es sólo 3D.
 *   - La pose de REPOSO (la que se ve sin JS o con "reducir movimiento") va en el CSS y
 *     tiene que mostrar el objeto ARMADO y presentable: update() la pisa con estilos inline.
 *   - Colores SIEMPRE derivados de los tokens (--primary/--accent/--surface/--bg/--line)
 *     con color-mix: la escena tiene que verse bien con cualquier paleta del Builder.
 *   - Nada de imágenes ni librerías: divs, gradientes y clip-path.
 *
 * Geometría de la casa: ancho 340 (x), profundidad 240 (z), paredes de 170 de alto.
 * El techo es a dos aguas con cumbrera a lo largo de x; los hastiales (triángulos) van
 * sobre las paredes laterales. El recorrido: órbita de fachada → se levanta el techo →
 * la fachada se vuelve transparente y aparecen los ambientes → vista de casa de muñecas.
 */
module.exports = {
  id: 'casa',
  label: 'Casa (inmobiliaria)',
  titulo: 'Recorré tu próxima casa',
  pasos: [
    { t: 'La fachada', x: 'Frente moderno con entrada amplia y aberturas de primera calidad. Cada propiedad se entrega lista para habitar.' },
    { t: 'Mirala por dentro', x: 'Levantamos el techo para vos: distribución inteligente, ambientes luminosos y espacios que se aprovechan de verdad.' },
    { t: 'Los ambientes', x: 'Living integrado, cocina con isla y dormitorios en suite. Todo pensado para la vida real, no para la foto.' },
    { t: 'Tu próximo paso', x: 'Coordiná una visita y recorrela en persona. Nuestro equipo te acompaña en todo el proceso, de la reserva a la escritura.' },
  ],
  html: `<div class="e3c">
        <div class="e3c-piso"></div>
        <div class="e3c-pared e3c-pared-f">
          <div class="e3c-puerta"></div>
          <div class="e3c-ventana e3c-vent-a"></div>
          <div class="e3c-ventana e3c-vent-b"></div>
        </div>
        <div class="e3c-pared e3c-pared-t"></div>
        <div class="e3c-pared e3c-pared-i"><div class="e3c-ventana e3c-vent-c"></div></div>
        <div class="e3c-pared e3c-pared-d"></div>
        <div class="e3c-hastial e3c-hastial-i"></div>
        <div class="e3c-hastial e3c-hastial-d"></div>
        <div class="e3c-techo e3c-techo-f"></div>
        <div class="e3c-techo e3c-techo-t"></div>
        <div class="e3c-divisor e3c-div-a"></div>
        <div class="e3c-divisor e3c-div-b"></div>
        <div class="e3c-mueble e3c-cama"></div>
        <div class="e3c-mueble e3c-mesa"></div>
        <div class="e3c-mueble e3c-sillon"></div>
        <div class="e3c-mueble e3c-isla"></div>
        <div class="e3c-sombra"></div>
      </div>`,
  css: `
  .s3d-esc-casa .e3c { position: relative; width: 360px; height: 340px; transform-style: preserve-3d; }
  .s3d-esc-casa .e3c > div { position: absolute; left: 50%; top: 50%; transform-style: preserve-3d; }
  /* terreno */
  .s3d-esc-casa .e3c-piso { width: 420px; height: 320px; margin: -160px 0 0 -210px; border-radius: 18px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface)), color-mix(in srgb, var(--primary) 10%, var(--surface)));
    border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
    transform: rotateX(90deg) translateZ(-85px); }
  /* paredes */
  .s3d-esc-casa .e3c-pared { width: 340px; height: 170px; margin: -85px 0 0 -170px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg) 88%, var(--primary) 12%), color-mix(in srgb, var(--bg) 74%, var(--primary) 26%));
    border: 1px solid color-mix(in srgb, var(--text) 22%, transparent); backface-visibility: hidden; }
  .s3d-esc-casa .e3c-pared-f { transform: translateZ(120px); }
  .s3d-esc-casa .e3c-pared-t { transform: rotateY(180deg) translateZ(120px); }
  .s3d-esc-casa .e3c-pared-i, .s3d-esc-casa .e3c-pared-d { width: 240px; margin-left: -120px; }
  .s3d-esc-casa .e3c-pared-i { transform: rotateY(-90deg) translateZ(170px); }
  .s3d-esc-casa .e3c-pared-d { transform: rotateY(90deg) translateZ(170px); }
  /* aberturas (2D dentro del plano de su pared; nietas de .e3c, por eso el absolute propio) */
  .s3d-esc-casa .e3c-puerta, .s3d-esc-casa .e3c-ventana { position: absolute; }
  .s3d-esc-casa .e3c-puerta { width: 52px; height: 92px; left: 50%; top: auto; bottom: 0; margin-left: -26px;
    background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--primary) 30%));
    border-radius: 4px 4px 0 0; }
  .s3d-esc-casa .e3c-ventana { width: 58px; height: 52px; border-radius: 4px;
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 30%, #9fc7e8 70%), color-mix(in srgb, var(--primary) 35%, #5d87ad 65%));
    border: 3px solid color-mix(in srgb, var(--bg) 80%, var(--text) 20%); }
  .s3d-esc-casa .e3c-vent-a { left: 34px; top: 46px; margin: 0; }
  .s3d-esc-casa .e3c-vent-b { right: 34px; left: auto; top: 46px; margin: 0; }
  .s3d-esc-casa .e3c-vent-c { left: 50%; top: 46px; margin-left: -29px; }
  /* hastiales: triángulos sobre las paredes laterales */
  .s3d-esc-casa .e3c-hastial { width: 240px; height: 70px; margin: -35px 0 0 -120px;
    background: color-mix(in srgb, var(--bg) 70%, var(--primary) 30%);
    clip-path: polygon(50% 0, 0 100%, 100% 100%); }
  .s3d-esc-casa .e3c-hastial-i { transform: rotateY(-90deg) translateZ(170px) translateY(-120px); }
  .s3d-esc-casa .e3c-hastial-d { transform: rotateY(90deg) translateZ(170px) translateY(-120px); }
  /* techo a dos aguas: cumbrera en y=-155, aleros en y=-85 z=±130 → pendiente ~28° */
  .s3d-esc-casa .e3c-techo { width: 380px; height: 150px; margin: -75px 0 0 -190px; border-radius: 4px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 78%, var(--accent) 22%), color-mix(in srgb, var(--primary) 55%, var(--bg) 45%));
    border: 1px solid color-mix(in srgb, var(--text) 25%, transparent); }
  .s3d-esc-casa .e3c-techo-f { transform: translateY(-120px) translateZ(65px) rotateX(62deg); }
  .s3d-esc-casa .e3c-techo-t { transform: translateY(-120px) translateZ(-65px) rotateX(-62deg); }
  /* interior: divisores y muebles en planta (se apoyan en el piso) */
  .s3d-esc-casa .e3c-divisor { background: color-mix(in srgb, var(--bg) 80%, var(--primary) 20%);
    border: 1px solid color-mix(in srgb, var(--text) 16%, transparent); opacity: 0; }
  .s3d-esc-casa .e3c-div-a { width: 150px; height: 150px; margin: -75px 0 0 -75px; transform: rotateY(90deg) translateZ(-20px) translateY(10px); }
  .s3d-esc-casa .e3c-div-b { width: 130px; height: 150px; margin: -75px 0 0 -65px; transform: translateZ(-10px) translateX(85px) translateY(10px); }
  .s3d-esc-casa .e3c-mueble { border-radius: 6px; opacity: 0;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--text) 18%, transparent) inset; }
  .s3d-esc-casa .e3c-cama { width: 70px; height: 96px; margin: -48px 0 0 -35px;
    background: color-mix(in srgb, var(--accent) 45%, var(--bg) 55%);
    transform: rotateX(90deg) translateZ(-82px) translateX(-105px) translateY(-40px); }
  .s3d-esc-casa .e3c-mesa { width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%;
    background: color-mix(in srgb, var(--primary) 40%, var(--bg) 60%);
    transform: rotateX(90deg) translateZ(-82px) translateX(90px) translateY(-45px); }
  .s3d-esc-casa .e3c-sillon { width: 94px; height: 40px; margin: -20px 0 0 -47px;
    background: color-mix(in srgb, var(--accent) 30%, var(--bg) 70%);
    transform: rotateX(90deg) translateZ(-82px) translateX(70px) translateY(62px); }
  .s3d-esc-casa .e3c-isla { width: 34px; height: 78px; margin: -39px 0 0 -17px;
    background: color-mix(in srgb, var(--primary) 55%, var(--bg) 45%);
    transform: rotateX(90deg) translateZ(-82px) translateX(-110px) translateY(66px); }
  /* sombra de contacto: aporta el peso que el CSS 3D no da solo */
  .s3d-esc-casa .e3c-sombra { width: 400px; height: 300px; margin: -150px 0 0 -200px; border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--text) 26%, transparent), transparent 72%);
    transform: rotateX(90deg) translateZ(-88px); }
  /* pose de reposo del mundo (sin JS): casa armada en tres cuartos */
  .s3d-esc-casa .s3d-world { transform: rotateX(14deg) rotateY(-24deg); }`,
  js: `function (p, q, u, W) {
    // cámara: órbita continua alrededor de la casa + elevación progresiva
    var orbita = u.lerp(-24, 112, u.seg(p, 0, 1));
    var alza = u.lerp(10, 38, u.seg(p, 0.2, 0.9));
    var zoom = 0.94 + 0.1 * Math.sin(Math.PI * u.clamp(p, 0, 1));
    W.style.transform = 'rotateX(' + alza.toFixed(2) + 'deg) rotateY(' + orbita.toFixed(2) + 'deg) scale(' + zoom.toFixed(3) + ')';
    // el techo se levanta como una tapa (y los hastiales lo siguen desvaneciéndose)
    // El techo sube 118px y no más: medido en ventana de 720px de alto, con la cámara ya
    // elevada, un recorrido mayor le recorta la cumbrera contra el borde superior del stage.
    var techo = u.seg(p, 0.26, 0.5);
    var tf = q('.e3c-techo-f'), tt = q('.e3c-techo-t');
    if (tf) { tf.style.transform = 'translateY(' + (-120 - 118 * techo) + 'px) translateZ(65px) rotateX(62deg) rotateZ(' + (6 * techo) + 'deg)'; tf.style.opacity = String(1 - 0.75 * techo); }
    if (tt) { tt.style.transform = 'translateY(' + (-120 - 118 * techo) + 'px) translateZ(-65px) rotateX(-62deg) rotateZ(' + (-6 * techo) + 'deg)'; tt.style.opacity = String(1 - 0.75 * techo); }
    var hi = q('.e3c-hastial-i'), hd = q('.e3c-hastial-d');
    if (hi) hi.style.opacity = String(1 - techo);
    if (hd) hd.style.opacity = String(1 - techo);
    // la fachada se vuelve vidrio para dejar ver el interior
    var frente = u.seg(p, 0.48, 0.7);
    var pf = q('.e3c-pared-f');
    if (pf) pf.style.opacity = String(1 - 0.92 * frente);
    // los ambientes aparecen escalonados (divisores primero, muebles después)
    var interior = u.seg(p, 0.5, 0.78);
    var da = q('.e3c-div-a'), db = q('.e3c-div-b');
    if (da) da.style.opacity = String(interior);
    if (db) db.style.opacity = String(u.seg(p, 0.54, 0.8));
    var muebles = ['.e3c-cama', '.e3c-mesa', '.e3c-sillon', '.e3c-isla'];
    for (var i = 0; i < muebles.length; i++) {
      var m = q(muebles[i]);
      if (!m) continue;
      var t = u.seg(p, 0.58 + i * 0.05, 0.78 + i * 0.05);
      m.style.opacity = String(t);
    }
  }`,
};
