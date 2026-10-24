/**
 * Escena 3D "Switch mecánico" (rubro periféricos / tecnología) del módulo escena3d.
 * Cumple el contrato documentado en casa.js (id, label, titulo, pasos, html, css, js).
 *
 * Geometría (y+ es abajo; el origen de toda pieza es el centro del mundo). La pila,
 * de abajo hacia arriba:
 *   placa base       plano horizontal en y=+120 (la sombra de contacto va en y=+126)
 *   carcasa inferior tronco de pirámide: base 180x180 en y=+118, tapa 140x140 en y=+58
 *   resorte          6 espiras planas de 66px de diámetro entre y=+106 e y=+51 (paso 11)
 *   vástago          cruz de dos planos 44x56 centrada en y=+30 + base 46x46 en y=+56
 *   carcasa superior tronco 150 a 110 entre y=+58 e y=+8, con marco-ventana horizontal arriba
 *   keycap           tronco 128 a 104 entre y=0 e y=-54, tapa redondeada en y=-54
 * Las caras inclinadas de cada tronco se arman igual que el techo de casa.js:
 * translateY(centro) [rotateY(orientación)] translateZ(radio) rotateX(inclinación),
 * con la base trapezoidal recortada por clip-path (más ancha abajo).
 *
 * Recorrido: órbita del switch armado -> explosión vertical escalonada (la keycap
 * primero, la base quieta) -> órbita de la pila abierta -> reensamble rápido ->
 * pulsación final: keycap y vástago bajan 13px y vuelven, las carcasas se hacen
 * "vidrio" (radiografía) para mostrar el resorte comprimiéndose, y un anillo de
 * clic con borde de acento pulsa y se disipa.
 */
module.exports = {
  id: 'switch',
  label: 'Switch mecánico (periféricos)',
  titulo: 'El clic perfecto, por dentro',
  pasos: [
    { t: 'La tecla', x: 'Perfil ergonómico y materiales que aguantan millones de pulsaciones.' },
    { t: 'El mecanismo', x: 'Vástago, resorte y carcasa: cada pieza calibrada al gramo.' },
    { t: 'La pulsación', x: 'Recorrido preciso y respuesta táctil en cada tecla.' },
    { t: 'Armalo a tu medida', x: 'Elegí el switch que va con tu forma de escribir y jugar.' },
  ],
  html: `<div class="e3w">
        <div class="e3w-sombra"></div>
        <div class="e3w-placa"></div>
        <div class="e3w-cinf">
          <div class="e3w-cara e3w-ci-f"></div>
          <div class="e3w-cara e3w-ci-t"></div>
          <div class="e3w-cara e3w-ci-i"></div>
          <div class="e3w-cara e3w-ci-d"></div>
        </div>
        <div class="e3w-resorte">
          <div class="e3w-aro e3w-aro1"></div>
          <div class="e3w-aro e3w-aro2"></div>
          <div class="e3w-aro e3w-aro3"></div>
          <div class="e3w-aro e3w-aro4"></div>
          <div class="e3w-aro e3w-aro5"></div>
          <div class="e3w-aro e3w-aro6"></div>
        </div>
        <div class="e3w-vastago">
          <div class="e3w-va-a"></div>
          <div class="e3w-va-b"></div>
          <div class="e3w-va-base"></div>
        </div>
        <div class="e3w-csup">
          <div class="e3w-scara e3w-cs-f"></div>
          <div class="e3w-scara e3w-cs-t"></div>
          <div class="e3w-scara e3w-cs-i"></div>
          <div class="e3w-scara e3w-cs-d"></div>
          <div class="e3w-marco e3w-cs-n"></div>
          <div class="e3w-marco e3w-cs-s"></div>
          <div class="e3w-marco e3w-cs-o"></div>
          <div class="e3w-marco e3w-cs-e"></div>
        </div>
        <div class="e3w-keycap">
          <div class="e3w-kcara e3w-k-f"></div>
          <div class="e3w-kcara e3w-k-t"></div>
          <div class="e3w-kcara e3w-k-i"></div>
          <div class="e3w-kcara e3w-k-d"></div>
          <div class="e3w-k-tapa"></div>
        </div>
        <div class="e3w-clic"></div>
      </div>`,
  css: `
  .s3d-esc-switch .e3w { position: relative; width: 340px; height: 300px; transform-style: preserve-3d; }
  /* selector descendente a propósito: también las nietas (caras dentro de los grupos)
     cuelgan del centro del mundo con su propio position:absolute */
  .s3d-esc-switch .e3w div { position: absolute; left: 50%; top: 50%; transform-style: preserve-3d; }
  /* grupos de la pila: cajas 0x0 en el centro; el JS sólo les escribe translateY */
  .s3d-esc-switch .e3w-cinf, .s3d-esc-switch .e3w-resorte, .s3d-esc-switch .e3w-vastago,
  .s3d-esc-switch .e3w-csup, .s3d-esc-switch .e3w-keycap { width: 0; height: 0; }
  /* sombra de contacto: aporta el peso que el CSS 3D no da solo */
  .s3d-esc-switch .e3w-sombra { width: 300px; height: 230px; margin: -115px 0 0 -150px; border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--text) 28%, transparent), transparent 70%);
    transform: rotateX(90deg) translateZ(-126px); }
  /* placa base: chapa fina donde apoya el switch */
  .s3d-esc-switch .e3w-placa { width: 250px; height: 206px; margin: -103px 0 0 -125px; border-radius: 14px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--text) 16%, var(--surface)), color-mix(in srgb, var(--primary) 22%, var(--surface)));
    border: 1px solid color-mix(in srgb, var(--text) 22%, transparent);
    transform: rotateX(90deg) translateZ(-120px); }
  /* carcasa inferior: 4 caras trapezoidales inclinadas 18.4 grados (base 180, tapa 140, alto 60) */
  .s3d-esc-switch .e3w-cara { width: 180px; height: 63px; margin: -31.5px 0 0 -90px; backface-visibility: hidden;
    clip-path: polygon(11.1% 0, 88.9% 0, 100% 100%, 0 100%);
    background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 88%, var(--text) 12%), color-mix(in srgb, var(--primary) 70%, var(--bg) 30%)); }
  .s3d-esc-switch .e3w-ci-i, .s3d-esc-switch .e3w-ci-d { background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 78%, var(--text) 22%), color-mix(in srgb, var(--primary) 64%, var(--bg) 36%)); }
  .s3d-esc-switch .e3w-ci-f { transform: translateY(88px) translateZ(80px) rotateX(18.4deg); }
  .s3d-esc-switch .e3w-ci-t { transform: translateY(88px) rotateY(180deg) translateZ(80px) rotateX(18.4deg); }
  .s3d-esc-switch .e3w-ci-i { transform: translateY(88px) rotateY(-90deg) translateZ(80px) rotateX(18.4deg); }
  .s3d-esc-switch .e3w-ci-d { transform: translateY(88px) rotateY(90deg) translateZ(80px) rotateX(18.4deg); }
  /* resorte: espiras planas apiladas; el gris metálico del material justifica el literal,
     siempre mezclado con el token de texto */
  .s3d-esc-switch .e3w-aro { width: 66px; height: 66px; margin: -33px 0 0 -33px; border-radius: 50%;
    border: 4px solid color-mix(in srgb, #9aa3ad 60%, var(--text) 40%); }
  .s3d-esc-switch .e3w-aro1 { transform: rotateX(90deg) translateZ(-106px); }
  .s3d-esc-switch .e3w-aro2 { transform: rotateX(90deg) translateZ(-95px); }
  .s3d-esc-switch .e3w-aro3 { transform: rotateX(90deg) translateZ(-84px); }
  .s3d-esc-switch .e3w-aro4 { transform: rotateX(90deg) translateZ(-73px); }
  .s3d-esc-switch .e3w-aro5 { transform: rotateX(90deg) translateZ(-62px); }
  .s3d-esc-switch .e3w-aro6 { transform: rotateX(90deg) translateZ(-51px); }
  /* vástago en cruz: la pieza de identidad, en el color de acento */
  .s3d-esc-switch .e3w-va-a, .s3d-esc-switch .e3w-va-b { width: 44px; height: 56px; margin: -28px 0 0 -22px; border-radius: 4px 4px 0 0;
    background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 72%, var(--primary) 28%)); }
  .s3d-esc-switch .e3w-va-a { transform: translateY(30px); }
  .s3d-esc-switch .e3w-va-b { transform: translateY(30px) rotateY(90deg); }
  .s3d-esc-switch .e3w-va-base { width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 8px;
    background: color-mix(in srgb, var(--accent) 80%, var(--text) 20%);
    transform: rotateX(90deg) translateZ(-56px); }
  /* carcasa superior: tronco 150 a 110 inclinado 21.8 grados */
  .s3d-esc-switch .e3w-scara { width: 150px; height: 54px; margin: -27px 0 0 -75px; backface-visibility: hidden;
    clip-path: polygon(13.3% 0, 86.7% 0, 100% 100%, 0 100%);
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg) 72%, var(--primary) 28%), color-mix(in srgb, var(--bg) 56%, var(--primary) 44%)); }
  .s3d-esc-switch .e3w-cs-i, .s3d-esc-switch .e3w-cs-d { background: linear-gradient(180deg, color-mix(in srgb, var(--bg) 60%, var(--primary) 40%), color-mix(in srgb, var(--bg) 46%, var(--primary) 54%)); }
  .s3d-esc-switch .e3w-cs-f { transform: translateY(33px) translateZ(65px) rotateX(21.8deg); }
  .s3d-esc-switch .e3w-cs-t { transform: translateY(33px) rotateY(180deg) translateZ(65px) rotateX(21.8deg); }
  .s3d-esc-switch .e3w-cs-i { transform: translateY(33px) rotateY(-90deg) translateZ(65px) rotateX(21.8deg); }
  .s3d-esc-switch .e3w-cs-d { transform: translateY(33px) rotateY(90deg) translateZ(65px) rotateX(21.8deg); }
  /* marco-ventana de la carcasa superior: 4 tiras horizontales en y=+8 que dejan
     una abertura central de 56x56 por donde asoma el vástago */
  .s3d-esc-switch .e3w-marco { background: color-mix(in srgb, var(--bg) 76%, var(--primary) 24%); }
  .s3d-esc-switch .e3w-cs-n, .s3d-esc-switch .e3w-cs-s { width: 110px; height: 27px; margin: -13.5px 0 0 -55px; }
  .s3d-esc-switch .e3w-cs-n { transform: rotateX(90deg) translateZ(-8px) translateY(-41.5px); }
  .s3d-esc-switch .e3w-cs-s { transform: rotateX(90deg) translateZ(-8px) translateY(41.5px); }
  .s3d-esc-switch .e3w-cs-o, .s3d-esc-switch .e3w-cs-e { width: 27px; height: 56px; margin: -28px 0 0 -13.5px; }
  .s3d-esc-switch .e3w-cs-o { transform: rotateX(90deg) translateZ(-8px) translateX(-41.5px); }
  .s3d-esc-switch .e3w-cs-e { transform: rotateX(90deg) translateZ(-8px) translateX(41.5px); }
  /* keycap: tronco 128 a 104 (bisel en gradiente) con tapa redondeada más clara */
  .s3d-esc-switch .e3w-kcara { width: 128px; height: 55px; margin: -27.5px 0 0 -64px; backface-visibility: hidden;
    clip-path: polygon(9.4% 0, 90.6% 0, 100% 100%, 0 100%);
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg) 70%, var(--primary) 30%), color-mix(in srgb, var(--bg) 52%, var(--primary) 48%)); }
  .s3d-esc-switch .e3w-k-i, .s3d-esc-switch .e3w-k-d { background: linear-gradient(180deg, color-mix(in srgb, var(--bg) 58%, var(--primary) 42%), color-mix(in srgb, var(--bg) 42%, var(--primary) 58%)); }
  .s3d-esc-switch .e3w-k-f { transform: translateY(-27px) translateZ(58px) rotateX(12.5deg); }
  .s3d-esc-switch .e3w-k-t { transform: translateY(-27px) rotateY(180deg) translateZ(58px) rotateX(12.5deg); }
  .s3d-esc-switch .e3w-k-i { transform: translateY(-27px) rotateY(-90deg) translateZ(58px) rotateX(12.5deg); }
  .s3d-esc-switch .e3w-k-d { transform: translateY(-27px) rotateY(90deg) translateZ(58px) rotateX(12.5deg); }
  .s3d-esc-switch .e3w-k-tapa { width: 106px; height: 106px; margin: -53px 0 0 -53px; border-radius: 16px;
    background: radial-gradient(circle at 42% 38%, color-mix(in srgb, var(--bg) 88%, var(--primary) 12%), color-mix(in srgb, var(--bg) 72%, var(--primary) 28%));
    border: 1px solid color-mix(in srgb, var(--text) 18%, transparent);
    transform: rotateX(90deg) translateZ(54px); }
  /* anillo de clic: invisible en reposo, lo enciende la pulsación final */
  .s3d-esc-switch .e3w-clic { width: 150px; height: 150px; margin: -75px 0 0 -75px; border-radius: 50%;
    border: 3px solid var(--accent); opacity: 0;
    transform: rotateX(90deg) translateZ(-6px) scale(0.6); }
  /* pose de reposo del mundo (sin JS): switch armado en tres cuartos elevado */
  .s3d-esc-switch .s3d-world { transform: rotateX(22deg) rotateY(-30deg); }`,
  js: `function (p, q, u, W) {
    // reensamble rápido: apaga la explosión entre 0.75 y 0.88 y deja aire para el clic
    var arme = 1 - u.seg(p, 0.75, 0.88);
    // explosión vertical escalonada: la keycap arranca primero, la base al final
    var exK = u.seg(p, 0.2, 0.4) * arme;
    var exS = u.seg(p, 0.23, 0.43) * arme;
    var exV = u.seg(p, 0.26, 0.46) * arme;
    var exR = u.seg(p, 0.29, 0.49) * arme;
    var exI = u.seg(p, 0.32, 0.5) * arme;
    var abierto = u.seg(p, 0.2, 0.5) * arme;
    // pulsación final: un ciclo bajada-vuelta (0 a 1 a 0) sobre el último tramo
    var puls = Math.sin(Math.PI * u.seg(p, 0.9, 1));
    var baja = 13 * puls;
    // cámara: presentación en órbita, baja y se aleja para ver la pila, vuelve para el clic;
    // el translateY (en pantalla) recentra la pila abierta, que crece hacia arriba
    var orbY = -30 + 40 * u.seg(p, 0, 0.22) + 35 * u.seg(p, 0.5, 0.75) - 28 * u.seg(p, 0.78, 0.92);
    var orbX = 22 + 5 * u.seg(p, 0, 0.22) - 12 * abierto;
    var zoom = 1 - 0.2 * abierto + 0.05 * puls;
    var alto = 46 * abierto;
    W.style.transform = 'translateY(' + alto.toFixed(1) + 'px) rotateX(' + orbX.toFixed(2) + 'deg) rotateY(' + orbY.toFixed(2) + 'deg) scale(' + zoom.toFixed(3) + ')';
    // grupos de la pila: transform completo (la pose de cada cara vive en el CSS, acá
    // sólo se traslada el grupo entero; keycap y vástago suman la bajada del clic)
    var g = q('.e3w-keycap');
    if (g) g.style.transform = 'translateY(' + (-150 * exK + baja).toFixed(1) + 'px)';
    g = q('.e3w-csup');
    if (g) g.style.transform = 'translateY(' + (-140 * exS).toFixed(1) + 'px)';
    g = q('.e3w-vastago');
    if (g) g.style.transform = 'translateY(' + (-80 * exV + baja).toFixed(1) + 'px)';
    g = q('.e3w-resorte');
    if (g) g.style.transform = 'translateY(' + (-78 * exR).toFixed(1) + 'px)';
    g = q('.e3w-cinf');
    if (g) g.style.transform = 'translateY(' + (-14 * exI).toFixed(1) + 'px)';
    // resorte: el paso entre espiras se achica en proporción exacta a lo que baja el
    // vástago (13px sobre 55 de largo libre), así la espira de arriba sigue a la base
    var pasoAro = 11 * (1 - 0.236 * puls);
    var aros = ['.e3w-aro1', '.e3w-aro2', '.e3w-aro3', '.e3w-aro4', '.e3w-aro5', '.e3w-aro6'];
    for (var i = 0; i < aros.length; i++) {
      var a = q(aros[i]);
      if (a) a.style.transform = 'rotateX(90deg) translateZ(' + (-(106 - i * pasoAro)).toFixed(1) + 'px)';
    }
    // radiografía del clic: las carcasas se vuelven vidrio (opacidad por cara, nunca
    // sobre el grupo: la opacidad en un contenedor preserve-3d aplana a sus hijas)
    var vidrio = u.seg(p, 0.86, 0.93);
    var caras = ['.e3w-ci-f', '.e3w-ci-t', '.e3w-ci-i', '.e3w-ci-d', '.e3w-cs-f', '.e3w-cs-t', '.e3w-cs-i', '.e3w-cs-d', '.e3w-cs-n', '.e3w-cs-s', '.e3w-cs-o', '.e3w-cs-e'];
    for (var j = 0; j < caras.length; j++) {
      var c = q(caras[j]);
      if (c) c.style.opacity = String(1 - 0.72 * vidrio);
    }
    // anillo de clic: pulso que nace en el fondo de la pulsación y se disipa
    var rp = u.seg(p, 0.94, 1);
    var an = q('.e3w-clic');
    if (an) {
      an.style.transform = 'rotateX(90deg) translateZ(-6px) scale(' + (0.6 + 0.8 * rp).toFixed(3) + ')';
      an.style.opacity = (u.clamp(rp * 6, 0, 1) * (1 - rp)).toFixed(3);
    }
  }`,
};
