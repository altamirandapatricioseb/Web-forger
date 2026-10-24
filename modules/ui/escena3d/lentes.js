/**
 * Escena 3D "Anteojos" (rubro óptica) del módulo escena3d.
 * Cumple el contrato documentado en casa.js (id, label, titulo, pasos, html, css, js).
 *
 * Geometría (y+ es abajo, el frente del armazón mira a +z):
 *   - Frente de 324 de ancho: aros de 132x96 (borde de 9 = el acetato) centrados en x=±96,
 *     puente en y=-32 entre ambos, plaquetas en x=±26 apenas retiradas en z.
 *   - Bisagras en (±162, -30): las varillas (150x10) llevan transform-origin en el extremo
 *     de la bisagra y pivotean con rotateY — plegadas ±4° (cruzadas tras el frente),
 *     abiertas ±92° (hacia -z, con un leve abanico realista). Son espejadas: la izquierda
 *     rota en + y la derecha en -.
 *   - La lente vive DENTRO de su aro (nieta del raíz: por eso lleva position:absolute
 *     propio) y trae dos hijas para animar: un tinte (historia fotocromática, sólo opacity)
 *     y un brillo que barre con translateX bajo overflow:hidden.
 *
 * Recorrido: 0-0.25 las piezas vuelan a su lugar con la cámara de frente → 0.25-0.5 las
 * varillas se despliegan (primero una, después la otra) y la cámara pasa a tres cuartos →
 * 0.5-0.78 las lentes se entintan y la cámara pasea al perfil para lucir las varillas →
 * 0.78-1 vuelta a la pose de vidriera con un flotado suave y el barrido del reflejo.
 */
module.exports = {
  id: 'lentes',
  label: 'Anteojos (óptica)',
  titulo: 'Hechos para tus ojos',
  pasos: [
    { t: 'El armazón', x: 'Livianos, resistentes y con el calce ajustado a tu rostro.' },
    { t: 'Las lentes', x: 'Cristales con antirreflejo y filtro UV de serie.' },
    { t: 'Cada pieza importa', x: 'Bisagras, plaquetas y varillas de primera calidad.' },
    { t: 'Probátelos', x: 'Vení al local y encontrá el par perfecto con nuestro equipo.' },
  ],
  html: `<div class="e3l">
        <div class="e3l-aro e3l-aro-i">
          <div class="e3l-lente"><div class="e3l-tinte"></div><div class="e3l-brillo"></div></div>
        </div>
        <div class="e3l-aro e3l-aro-d">
          <div class="e3l-lente"><div class="e3l-tinte"></div><div class="e3l-brillo"></div></div>
        </div>
        <div class="e3l-puente"></div>
        <div class="e3l-plaq e3l-plaq-i"></div>
        <div class="e3l-plaq e3l-plaq-d"></div>
        <div class="e3l-bis e3l-bis-i"></div>
        <div class="e3l-bis e3l-bis-d"></div>
        <div class="e3l-var e3l-var-i"></div>
        <div class="e3l-var e3l-var-d"></div>
        <div class="e3l-sombra"></div>
      </div>`,
  css: `
  .s3d-esc-lentes .e3l { position: relative; width: 340px; height: 240px; transform-style: preserve-3d; }
  .s3d-esc-lentes .e3l > div { position: absolute; left: 50%; top: 50%; transform-style: preserve-3d; }
  /* aros: acetato oscuro derivado de los tokens; el centro queda libre para la lente */
  .s3d-esc-lentes .e3l-aro { width: 132px; height: 96px; margin: -48px 0 0 -66px; box-sizing: border-box;
    border-radius: 44px; border: 9px solid color-mix(in srgb, var(--text) 72%, var(--primary) 28%);
    background: transparent; }
  .s3d-esc-lentes .e3l-aro-i { transform: translateX(-96px); }
  .s3d-esc-lentes .e3l-aro-d { transform: translateX(96px); }
  /* lente: vidrio azulado translúcido con un brillo diagonal fijo (nieta de .e3l, absolute propio) */
  .s3d-esc-lentes .e3l-lente { position: absolute; inset: 3px; border-radius: 32px; overflow: hidden;
    background:
      linear-gradient(115deg, transparent 40%, color-mix(in srgb, white 34%, transparent) 47%, transparent 54%),
      linear-gradient(150deg,
        color-mix(in srgb, color-mix(in srgb, var(--accent) 30%, #bcd8ee 70%) 52%, transparent),
        color-mix(in srgb, color-mix(in srgb, var(--accent) 40%, #7fa9cd 60%) 36%, transparent) 55%,
        color-mix(in srgb, color-mix(in srgb, var(--primary) 35%, #58809f 65%) 46%, transparent)); }
  /* tinte fotocromático: la escena sólo le sube la opacidad */
  .s3d-esc-lentes .e3l-tinte { position: absolute; inset: 0; border-radius: inherit; opacity: 0;
    background: color-mix(in srgb, color-mix(in srgb, var(--primary) 40%, var(--text) 60%) 92%, transparent); }
  /* brillo que barre la lente al final del recorrido */
  .s3d-esc-lentes .e3l-brillo { position: absolute; left: -6px; top: -30%; width: 24px; height: 160%; opacity: 0;
    background: linear-gradient(100deg, transparent, color-mix(in srgb, white 65%, transparent) 50%, transparent);
    transform: rotate(16deg); }
  /* puente y plaquetas */
  .s3d-esc-lentes .e3l-puente { width: 72px; height: 13px; margin: -7px 0 0 -36px; border-radius: 8px 8px 16px 16px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--text) 64%, var(--primary) 36%), color-mix(in srgb, var(--text) 78%, var(--primary) 22%));
    transform: translateY(-32px); }
  .s3d-esc-lentes .e3l-plaq { width: 10px; height: 18px; margin: -9px 0 0 -5px; border-radius: 50%;
    background: color-mix(in srgb, var(--text) 26%, var(--surface) 74%); }
  .s3d-esc-lentes .e3l-plaq-i { transform: translateX(-26px) translateY(2px) translateZ(-6px) rotateY(30deg); }
  .s3d-esc-lentes .e3l-plaq-d { transform: translateX(26px) translateY(2px) translateZ(-6px) rotateY(-30deg); }
  /* bisagras: el tope metálico donde pivotean las varillas (gris mezclado con el token del texto) */
  .s3d-esc-lentes .e3l-bis { width: 8px; height: 18px; margin: -9px 0 0 -4px; border-radius: 3px;
    background: color-mix(in srgb, #b9bec6 55%, var(--text) 45%); }
  .s3d-esc-lentes .e3l-bis-i { transform: translateX(-160px) translateY(-30px) translateZ(-4px); }
  .s3d-esc-lentes .e3l-bis-d { transform: translateX(160px) translateY(-30px) translateZ(-4px); }
  /* varillas: barras con el origen de giro en la bisagra y la punta curva del lado libre */
  .s3d-esc-lentes .e3l-var { width: 150px; height: 10px; margin: -5px 0 0 -75px; }
  .s3d-esc-lentes .e3l-var-i { transform-origin: left center; border-radius: 5px 16px 16px 5px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--text) 72%, var(--primary) 28%), color-mix(in srgb, var(--text) 55%, var(--bg) 45%));
    transform: translateX(-87px) translateY(-30px) translateZ(-6px) rotateY(92deg); }
  .s3d-esc-lentes .e3l-var-d { transform-origin: right center; border-radius: 16px 5px 5px 16px;
    background: linear-gradient(270deg, color-mix(in srgb, var(--text) 72%, var(--primary) 28%), color-mix(in srgb, var(--text) 55%, var(--bg) 45%));
    transform: translateX(87px) translateY(-30px) translateZ(-6px) rotateY(-92deg); }
  /* sombra de contacto: aporta el peso que el CSS 3D no da solo */
  .s3d-esc-lentes .e3l-sombra { width: 340px; height: 150px; margin: -75px 0 0 -170px; border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--text) 24%, transparent), transparent 72%);
    transform: rotateX(90deg) translateZ(-72px); }
  /* pose de reposo del mundo (sin JS): anteojos armados y abiertos, en tres cuartos de vidriera */
  .s3d-esc-lentes .s3d-world { transform: rotateX(6deg) rotateY(-24deg); }`,
  js: `function (p, q, u, W) {
    // cámara: de frente durante el armado, tres cuartos al desplegar, perfil para lucir
    // las varillas y vuelta a vidriera con un flotado suave (todo función pura de p)
    var g1 = u.seg(p, 0.25, 0.5), g2 = u.seg(p, 0.5, 0.78), g3 = u.seg(p, 0.78, 1);
    var ry = -26 * g1 - 32 * g2 + 34 * g3;
    var rx = 4 + 4 * g1 - 2 * g2;
    var flote = Math.sin(g3 * Math.PI * 2) * 6;
    var zoom = 0.95 + 0.07 * Math.sin(Math.PI * u.clamp(p, 0, 1));
    W.style.transform = 'translateY(' + flote.toFixed(1) + 'px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) scale(' + zoom.toFixed(3) + ')';
    // 0-0.25: las piezas vuelan a su lugar (aros desde los costados, puente desde arriba);
    // cada transform inline repite la posición base completa porque pisa al del CSS
    var ai = u.seg(p, 0, 0.2), ad = u.seg(p, 0.03, 0.23), pu = u.seg(p, 0.1, 0.26);
    var aroI = q('.e3l-aro-i'), aroD = q('.e3l-aro-d'), puente = q('.e3l-puente');
    if (aroI) { aroI.style.transform = 'translateX(' + u.lerp(-230, -96, ai).toFixed(1) + 'px) rotateY(' + u.lerp(38, 0, ai).toFixed(1) + 'deg)'; aroI.style.opacity = String(ai); }
    if (aroD) { aroD.style.transform = 'translateX(' + u.lerp(230, 96, ad).toFixed(1) + 'px) rotateY(' + u.lerp(-38, 0, ad).toFixed(1) + 'deg)'; aroD.style.opacity = String(ad); }
    if (puente) { puente.style.transform = 'translateY(' + u.lerp(-150, -32, pu).toFixed(1) + 'px)'; puente.style.opacity = String(pu); }
    // los detalles chicos (plaquetas y bisagras) aparecen cuando el frente ya asentó
    var det = u.seg(p, 0.14, 0.28);
    var chicos = ['.e3l-plaq-i', '.e3l-plaq-d', '.e3l-bis-i', '.e3l-bis-d'];
    for (var i = 0; i < chicos.length; i++) { var c = q(chicos[i]); if (c) c.style.opacity = String(det); }
    var sombra = q('.e3l-sombra');
    if (sombra) sombra.style.opacity = String(u.seg(p, 0.04, 0.24));
    // 0.25-0.5: las varillas se despliegan desde la bisagra, primero una y después la otra
    // (espejadas: la izquierda rota en + y la derecha en -)
    var vop = u.seg(p, 0.18, 0.28);
    var vi = u.lerp(4, 92, u.seg(p, 0.27, 0.4)), vd = u.lerp(-4, -92, u.seg(p, 0.37, 0.5));
    var varI = q('.e3l-var-i'), varD = q('.e3l-var-d');
    if (varI) { varI.style.transform = 'translateX(-87px) translateY(-30px) translateZ(-6px) rotateY(' + vi.toFixed(1) + 'deg)'; varI.style.opacity = String(vop); }
    if (varD) { varD.style.transform = 'translateX(87px) translateY(-30px) translateZ(-6px) rotateY(' + vd.toFixed(1) + 'deg)'; varD.style.opacity = String(vop); }
    // 0.5-0.78: las lentes se entintan (historia fotocromática, sólo opacidad)
    var tin = 0.62 * u.seg(p, 0.52, 0.74);
    var tinI = q('.e3l-aro-i .e3l-tinte'), tinD = q('.e3l-aro-d .e3l-tinte');
    if (tinI) tinI.style.opacity = String(tin);
    if (tinD) tinD.style.opacity = String(tin);
    // 0.78-1: el reflejo barre cada lente (la izquierda primero) mientras la cámara vuelve
    var bi = u.seg(p, 0.8, 0.94), bd = u.seg(p, 0.85, 0.99);
    var briI = q('.e3l-aro-i .e3l-brillo'), briD = q('.e3l-aro-d .e3l-brillo');
    if (briI) { briI.style.transform = 'translateX(' + u.lerp(-30, 130, bi).toFixed(1) + 'px) rotate(16deg)'; briI.style.opacity = String(0.85 * Math.sin(Math.PI * bi)); }
    if (briD) { briD.style.transform = 'translateX(' + u.lerp(-30, 130, bd).toFixed(1) + 'px) rotate(16deg)'; briD.style.opacity = String(0.85 * Math.sin(Math.PI * bd)); }
  }`,
};
