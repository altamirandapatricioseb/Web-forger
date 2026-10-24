/**
 * Sistema de movimiento del sitio generado: catálogo de efectos elegibles desde el Builder.
 *
 * Antes había un solo eje elegible (el hover de las tarjetas) y todo lo demás estaba fijo.
 * Acá viven OCHO ejes independientes —tarjetas, entrada al scroll, botones, enlaces, títulos,
 * imágenes, campos y transición entre páginas— cada uno con varias variantes adaptadas de la
 * biblioteca de componentes (Skiper UI) al stack del proyecto exportado: CSS puro donde
 * alcanza y JavaScript vanilla donde no (nada de React ni framer-motion, que el proyecto
 * generado no tiene ni va a tener).
 *
 * Dos reglas que valen para TODO lo de este archivo:
 *   1. El default de cada eje reproduce el comportamiento histórico, así una config vieja
 *      (o un link compartido de antes) genera exactamente el mismo sitio que antes.
 *   2. Todo movimiento vive bajo `prefers-reduced-motion: no-preference`. Si el visitante
 *      pidió menos movimiento, el sitio queda estático y 100% usable — nunca contenido
 *      invisible esperando una animación que no va a correr.
 */

/* ---------- catálogo (lo consume el panel del Builder vía /api/efectos) ---------- */

// Cada eje: id, etiqueta para el panel, ayuda y opciones (la primera es el default).
const EJES = [
  {
    id: 'cardHover', label: 'Tarjetas (hover)',
    hint: 'Las tarjetas con formularios nunca se mueven: sus campos tienen animación propia.',
    options: [
      ['lift', 'Levantar con sombra'],
      ['glow', 'Borde brillante'],
      ['aurora', 'Fondo aurora'],
      ['zoom', 'Acercar'],
      ['tilt', 'Inclinación 3D (sigue al mouse)'],
      ['spotlight', 'Foco de luz que sigue al mouse'],
      ['border', 'Borde que gira'],
      ['blurpeers', 'Desenfocar las de al lado'],
      ['none', 'Sin efecto'],
    ],
  },
  {
    id: 'reveal', label: 'Aparición al hacer scroll',
    hint: 'Sólo si el módulo Animaciones está activo. Es lo que hace que el sitio "se arme" mientras se baja.',
    options: [
      ['fade', 'Fundido hacia arriba'],
      ['blur', 'Fundido con desenfoque'],
      ['mask', 'Cortina (se descubre)'],
      ['rotate', 'Rotar y acercar'],
      ['scale', 'Crecer desde el centro'],
      ['slide', 'Entrar desde los costados'],
      ['flip', 'Girar sobre el eje horizontal'],
      ['none', 'Sin aparición'],
    ],
  },
  {
    id: 'btnFx', label: 'Botones',
    options: [
      ['lift', 'Levantar (resorte)'],
      ['shine', 'Barrido de brillo'],
      ['fill', 'Relleno deslizante'],
      ['squish', 'Apretar al presionar'],
      ['arrow', 'Flecha que avanza'],
      ['magnetic', 'Magnético (sigue al mouse)'],
      ['none', 'Sin efecto'],
    ],
  },
  {
    id: 'linkFx', label: 'Enlaces del menú',
    options: [
      ['underline', 'Subrayado que entra'],
      ['textroll', 'El texto rueda'],
      ['highlight', 'Resaltado que crece'],
      ['dot', 'Punto indicador'],
      ['none', 'Sin efecto'],
    ],
  },
  {
    id: 'titleFx', label: 'Títulos',
    hint: 'Se aplica al título del hero y a los títulos de sección cuando entran en pantalla.',
    options: [
      ['none', 'Sin efecto'],
      ['words', 'Palabra por palabra'],
      ['chars', 'Letra por letra'],
      ['shine', 'Destello que barre'],
      ['line', 'Subrayado que se dibuja'],
    ],
  },
  {
    id: 'imgFx', label: 'Imágenes y medios (hover)',
    options: [
      ['zoom', 'Acercar'],
      ['mask', 'Máscara que se abre'],
      ['blurout', 'Sale del desenfoque'],
      ['gray', 'De gris a color'],
      ['none', 'Sin efecto'],
    ],
  },
  {
    id: 'inputFx', label: 'Campos de formulario',
    options: [
      ['ring', 'Anillo de acento'],
      ['glow', 'Resplandor'],
      ['lift', 'Levantar'],
      ['underline', 'Subrayado que crece'],
    ],
  },
  {
    id: 'pageFx', label: 'Cambio de página',
    hint: 'Transición al navegar entre páginas del sitio. Los navegadores que no la soportan simplemente no la muestran.',
    options: [
      ['none', 'Sin transición'],
      ['fade', 'Fundido'],
      ['slide', 'Deslizar'],
      ['curtain', 'Cortina'],
    ],
  },
];

// { cardHover: ['lift', 'glow', …], … } — lo usa normalize() para validar
const VALORES = Object.fromEntries(EJES.map(e => [e.id, e.options.map(o => o[0])]));
// { cardHover: 'lift', … } — la primera opción de cada eje es el default
const DEFAULTS = Object.fromEntries(EJES.map(e => [e.id, e.options[0][0]]));

/** Normaliza el bloque design: cualquier valor desconocido cae al default del eje. */
function normalizeDesign(raw = {}) {
  const out = {};
  for (const eje of EJES) {
    const v = raw[eje.id];
    out[eje.id] = VALORES[eje.id].includes(v) ? v : DEFAULTS[eje.id];
  }
  return out;
}

/* ---------- curvas ---------- */

const OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';        // salida exponencial: la de la casa
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';  // resorte con rebote leve, sólo donde suma

/* ---------- CSS ---------- */

// Selector de tarjeta "decorativa": una card que ES un formulario o que CONTIENE campos nunca
// recibe efecto de hover. Una tarjeta que se mueve mientras se tipea es molesta, no simpática.
const CARD = '.card:not(form):not(:has(form, input, select, textarea))';

const CARD_FX = {
  lift: `  ${CARD} { transition: transform .28s ${SPRING}, box-shadow .28s ease; will-change: transform; }
  ${CARD}:hover { transform: translateY(-4px); box-shadow: 0 12px 30px color-mix(in srgb, var(--primary) 18%, transparent); }`,

  glow: `  ${CARD} { transition: border-color .25s ease, box-shadow .25s ease; }
  ${CARD}:hover { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 0 22px color-mix(in srgb, var(--accent) 35%, transparent); }`,

  aurora: `  ${CARD} { transition: box-shadow .3s ease; }
  ${CARD}:hover { background-image: linear-gradient(120deg, color-mix(in srgb, var(--accent) 14%, var(--surface)), var(--surface) 45%, color-mix(in srgb, var(--primary) 14%, var(--surface))); background-size: 200% 200%; animation: card-aurora 3.5s ease-in-out infinite; }
  @keyframes card-aurora { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`,

  zoom: `  ${CARD} { transition: transform .28s ${SPRING}, box-shadow .28s ease; will-change: transform; }
  ${CARD}:hover { transform: scale(1.025); box-shadow: 0 10px 26px color-mix(in srgb, var(--primary) 16%, transparent); }`,

  /* tilt: la rotación la calcula el JS y la deja en --rx/--ry; el CSS sólo la aplica, así el
     efecto degrada a "no pasa nada" si el JS no corre. */
  tilt: `  ${CARD} { transition: transform .35s ${OUT}, box-shadow .3s ease; transform-style: preserve-3d; will-change: transform; }
  ${CARD}[data-fx-tilt]:hover { transform: perspective(700px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateZ(6px); box-shadow: 0 18px 40px color-mix(in srgb, var(--primary) 20%, transparent); transition: transform .08s linear, box-shadow .3s ease; }`,

  /* spotlight: un radial-gradient centrado donde está el mouse (--mx/--my los pone el JS).
     Se pinta en un ::after para no tocar el fondo real de la tarjeta. */
  spotlight: `  ${CARD} { position: relative; overflow: hidden; transition: border-color .25s ease; }
  ${CARD}::after { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .3s ease; background: radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--accent) 22%, transparent), transparent 65%); }
  ${CARD}:hover::after { opacity: 1; }
  ${CARD}:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); }`,

  /* border: un anillo cónico que gira detrás de la tarjeta y asoma como borde de 1px. */
  border: `  ${CARD} { position: relative; }
  ${CARD}::before { content: ""; position: absolute; inset: -1px; border-radius: inherit; padding: 1px; background: conic-gradient(from var(--ang, 0deg), transparent 0deg, var(--accent) 90deg, transparent 200deg); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; opacity: 0; transition: opacity .25s ease; }
  ${CARD}:hover::before { opacity: 1; animation: card-ang 2.4s linear infinite; }
  @property --ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
  @keyframes card-ang { to { --ang: 360deg; } }`,

  /* blurpeers: al apuntar una tarjeta, las hermanas se desenfocan y bajan de opacidad
     (adaptado del blur progresivo de Skiper UI). CSS puro: sin JS y sin listeners. */
  blurpeers: `  .grid:has(${CARD}:hover) ${CARD}:not(:hover) { filter: blur(2px); opacity: .62; }
  ${CARD} { transition: filter .3s ease, opacity .3s ease, transform .3s ${OUT}; }
  .grid:has(${CARD}:hover) ${CARD}:hover { transform: translateY(-3px); }`,

  none: '',
};

const BTN_FX = {
  lift: `  .btn { transition: transform .28s ${SPRING}, box-shadow .28s ease, filter .2s ease, background-color .2s ease, color .2s ease; will-change: transform; }
  .btn:hover { transform: translateY(-2px) scale(1.03); }
  .btn:active { transform: translateY(0) scale(0.97); transition-duration: .1s; }`,

  /* shine: un brillo diagonal que cruza el botón una vez por hover. */
  shine: `  .btn { position: relative; overflow: hidden; transition: filter .2s ease, background-color .2s ease, color .2s ease; }
  .btn::after { content: ""; position: absolute; top: 0; left: -120%; width: 60%; height: 100%; background: linear-gradient(100deg, transparent, color-mix(in srgb, #ffffff 45%, transparent), transparent); transform: skewX(-18deg); }
  .btn:hover::after { animation: btn-shine .7s ${OUT}; }
  @keyframes btn-shine { to { left: 130%; } }`,

  /* fill: el fondo entra desde abajo. Los ghost quedan especialmente bien. */
  fill: `  .btn { position: relative; overflow: hidden; z-index: 0; transition: color .25s ease; }
  .btn::before { content: ""; position: absolute; inset: 0; z-index: -1; background: var(--primary); transform: scaleY(0); transform-origin: bottom; transition: transform .3s ${OUT}; }
  .btn:hover::before { transform: scaleY(1); }
  .btn.ghost::before { background: var(--accent); }
  .btn:active { transform: scale(0.98); }`,

  /* squish: sin movimiento en hover, todo el gesto es la presión (Botón Squircle de Apple). */
  squish: `  .btn { transition: transform .35s ${SPRING}, filter .2s ease; will-change: transform; }
  .btn:hover { filter: brightness(0.94); }
  .btn:active { transform: scale(0.94); transition-duration: .09s; }`,

  /* arrow: la flecha del final se corre y el botón la acompaña. La flecha la agrega el JS
     (sólo a los botones que no tengan ya un ícono propio). */
  arrow: `  .btn { transition: transform .25s ${OUT}, gap .25s ${OUT}, filter .2s ease; }
  .btn .btn-arrow { display: inline-block; transition: transform .25s ${OUT}; }
  .btn:hover .btn-arrow { transform: translateX(4px); }
  .btn:hover { gap: 11px; }
  .btn:active { transform: scale(0.98); }`,

  /* magnetic: el desplazamiento lo calcula el JS en --dx/--dy. */
  magnetic: `  .btn { transition: transform .35s ${OUT}, filter .2s ease; will-change: transform; }
  .btn[data-fx-magnet] { transform: translate(var(--dx, 0px), var(--dy, 0px)); }
  .btn[data-fx-magnet]:hover { transition: transform .12s linear; }
  .btn:active { filter: brightness(0.92); }`,

  none: '',
};

/* Enlaces del menú. El trazo/fondo vive en un ::after para no mover nunca el texto. */
const LINK_FX = {
  underline: `  .nav-links a::after { content: ""; position: absolute; left: 0; bottom: -1px; height: 2px; width: 100%; background: var(--accent); transform: scaleX(0); transform-origin: right; transition: transform .3s cubic-bezier(0.4, 0, 0.2, 1); }
  .nav-links a.active::after, .nav-links a:hover::after { transform: scaleX(1); transform-origin: left; }`,

  /* textroll: el label sube y una copia entra desde abajo. La copia la crea el JS; sin JS
     el enlace queda quieto y perfectamente legible. */
  textroll: `  .nav-links a .roll { display: inline-block; overflow: hidden; vertical-align: bottom; }
  .nav-links a .roll span { display: block; transition: transform .32s ${OUT}; }
  .nav-links a:hover .roll span { transform: translateY(-100%); }`,

  highlight: `  .nav-links a::after { content: ""; position: absolute; left: -6px; right: -6px; top: -3px; bottom: -3px; z-index: -1; border-radius: calc(var(--radius) / 2); background: color-mix(in srgb, var(--accent) 16%, transparent); transform: scale(0.7); opacity: 0; transition: transform .25s ${OUT}, opacity .25s ease; }
  .nav-links a { position: relative; z-index: 0; }
  .nav-links a:hover::after, .nav-links a.active::after { transform: scale(1); opacity: 1; }`,

  dot: `  .nav-links a::after { content: ""; position: absolute; left: 50%; bottom: -5px; width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%; background: var(--accent); transform: scale(0); transition: transform .25s ${SPRING}; }
  .nav-links a:hover::after, .nav-links a.active::after { transform: scale(1); }`,

  none: '',
};

/* Imágenes y medios. El zoom se contiene con overflow en el contenedor. */
const IMG_SEL = '.card img, .img-slot, .feature-media, [data-fx-img]';
const IMG_FX = {
  zoom: `  ${IMG_SEL} { transition: transform .45s ${OUT}; }
  .card:hover img, .card:hover .img-slot, [data-fx-img]:hover { transform: scale(1.05); }
  .card { overflow: hidden; }`,

  mask: `  ${IMG_SEL} { clip-path: inset(0 0 0 0); transition: clip-path .5s ${OUT}, transform .5s ${OUT}; }
  .card:hover img, .card:hover .img-slot, [data-fx-img]:hover { clip-path: inset(3% 3% 3% 3% round 10px); transform: scale(1.04); }`,

  blurout: `  ${IMG_SEL} { filter: blur(0); transition: filter .4s ease, transform .5s ${OUT}; }
  .card img, .card .img-slot { filter: blur(3px); }
  .card:hover img, .card:hover .img-slot { filter: blur(0); transform: scale(1.02); }`,

  gray: `  ${IMG_SEL} { filter: grayscale(1); transition: filter .4s ease, transform .45s ${OUT}; }
  .card:hover img, .card:hover .img-slot, [data-fx-img]:hover { filter: grayscale(0); transform: scale(1.02); }`,

  none: '',
};

const INPUT_FX = {
  ring: `  input, textarea, select { transition: border-color .2s ease, box-shadow .2s ease; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent); }`,

  glow: `  input, textarea, select { transition: border-color .2s ease, box-shadow .3s ease; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 0 18px color-mix(in srgb, var(--accent) 32%, transparent); }`,

  lift: `  input, textarea, select { transition: border-color .2s ease, box-shadow .25s ease, transform .25s ${OUT}; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 6px 18px color-mix(in srgb, var(--primary) 14%, transparent); }`,

  /* underline: el borde se apaga y queda una línea de acento que crece desde el centro.
     El trazo va en un background porque un ::after sobre un <input> no se puede pintar. */
  underline: `  input, textarea, select { transition: border-color .2s ease, background-size .3s ${OUT}; background-image: linear-gradient(var(--accent), var(--accent)); background-repeat: no-repeat; background-position: center bottom; background-size: 0% 2px; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); background-size: 100% 2px; }`,
};

/* Transición entre páginas: View Transitions nativas (Chrome/Edge). Donde no existen, el
   navegador ignora la regla y la navegación es la de siempre — sin JS y sin fallback frágil. */
const PAGE_FX = {
  none: '',
  fade: `  @view-transition { navigation: auto; }
  ::view-transition-old(root) { animation: pg-out .18s ease both; }
  ::view-transition-new(root) { animation: pg-in .26s ${OUT} both; }
  @keyframes pg-out { to { opacity: 0; } }
  @keyframes pg-in { from { opacity: 0; } }`,
  slide: `  @view-transition { navigation: auto; }
  ::view-transition-old(root) { animation: pg-sl-out .2s ease both; }
  ::view-transition-new(root) { animation: pg-sl-in .32s ${OUT} both; }
  @keyframes pg-sl-out { to { opacity: 0; transform: translateX(-24px); } }
  @keyframes pg-sl-in { from { opacity: 0; transform: translateX(28px); } }`,
  curtain: `  @view-transition { navigation: auto; }
  ::view-transition-new(root) { animation: pg-cur .42s ${OUT} both; }
  @keyframes pg-cur { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0 0 0 0); } }`,
};

/* Títulos: el JS parte el texto y marca el elemento; el CSS anima las piezas al aparecer. */
const TITLE_FX = {
  none: '',
  words: `  [data-fx-title] .fx-w { display: inline-block; opacity: 0; transform: translateY(0.5em); filter: blur(6px); transition: opacity .5s ease, transform .6s ${OUT}, filter .5s ease; transition-delay: calc(var(--i, 0) * 55ms); }
  [data-fx-title].fx-on .fx-w { opacity: 1; transform: none; filter: blur(0); }`,
  chars: `  [data-fx-title] .fx-c { display: inline-block; opacity: 0; transform: translateY(0.35em); transition: opacity .35s ease, transform .45s ${OUT}; transition-delay: calc(var(--i, 0) * 18ms); }
  [data-fx-title].fx-on .fx-c { opacity: 1; transform: none; }`,
  shine: `  [data-fx-title] { background-image: linear-gradient(100deg, var(--text) 40%, var(--accent) 50%, var(--text) 60%); background-size: 250% 100%; background-position: 130% 0; -webkit-background-clip: text; background-clip: text; }
  [data-fx-title].fx-on { animation: title-shine 1.5s ${OUT} .2s both; }
  @keyframes title-shine { from { background-position: 130% 0; } to { background-position: -30% 0; } }`,
  line: `  [data-fx-title] { position: relative; display: inline-block; padding-bottom: 6px; }
  [data-fx-title]::after { content: ""; position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; border-radius: 2px; background: var(--accent); transform: scaleX(0); transform-origin: left; transition: transform .7s ${OUT} .15s; }
  [data-fx-title].fx-on::after { transform: scaleX(1); }`,
};

/**
 * Bloque CSS del sistema de movimiento. Se pega dentro de stylesCss(), después de los
 * estilos base, para poder pisar lo que haga falta sin !important.
 */
function motionCss(cfg) {
  const d = cfg.design || {};
  const partes = [
    CARD_FX[d.cardHover] || CARD_FX.lift,
    BTN_FX[d.btnFx] || BTN_FX.lift,
    LINK_FX[d.linkFx] || LINK_FX.underline,
    IMG_FX[d.imgFx] || IMG_FX.zoom,
    TITLE_FX[d.titleFx] || '',
    // Los checks celebran el cambio con un pop: es feedback, no decoración
    `  input[type="checkbox"]:checked, input[type="radio"]:checked { animation: check-pop .25s ${SPRING}; }
  @keyframes check-pop { 0% { transform: scale(0.8); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }`,
    PAGE_FX[d.pageFx] || '',
  ].filter(Boolean);

  return `
/* ---- Sistema de movimiento (elegido en el Builder) ----
   Ejes: tarjetas=${d.cardHover} · aparición=${d.reveal} · botones=${d.btnFx} · enlaces=${d.linkFx}
   títulos=${d.titleFx} · imágenes=${d.imgFx} · campos=${d.inputFx} · página=${d.pageFx}
   Todo lo que se mueve está dentro del @media de abajo: con "menos movimiento" activado en el
   sistema del visitante, el sitio queda estático y usable. Lo que NO es movimiento (el anillo
   de foco de los campos) vive afuera, porque el foco visible es accesibilidad, no adorno. */
${INPUT_FX[d.inputFx] || INPUT_FX.ring}
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
${partes.join('\n')}
}
@media (prefers-reduced-motion: reduce) {
  /* Red de seguridad: si el JS marcó piezas para animar y el visitante pidió menos
     movimiento, se muestran ya. Nunca dejamos texto invisible. */
  [data-fx-title] .fx-w, [data-fx-title] .fx-c { opacity: 1; transform: none; filter: none; }
}
`;
}

/* ---------- JS de cliente ---------- */

// ¿Este eje necesita JavaScript? (los que no, son CSS puro y no emiten una línea)
const NECESITA_JS = (d) => (
  d.cardHover === 'tilt' || d.cardHover === 'spotlight' ||
  d.btnFx === 'magnetic' || d.btnFx === 'arrow' ||
  d.linkFx === 'textroll' ||
  (d.titleFx && d.titleFx !== 'none')
);

/**
 * JS del sistema de movimiento. Se agrega a public/js/app.js sólo si algún eje elegido lo
 * necesita: una config de puro CSS no paga ni un byte. Todo es vanilla y defensivo — si algo
 * no está disponible, el efecto simplemente no ocurre.
 */
function motionJs(cfg) {
  const d = cfg.design || {};
  if (!NECESITA_JS(d)) return '';
  const bloques = [];

  if (d.cardHover === 'tilt') {
    bloques.push(`  // Inclinación 3D: se guardan los grados en variables CSS y el CSS los aplica.
  // El cálculo va dentro de un rAF para no leer/escribir layout en cada mousemove.
  cards().forEach(function (c) {
    c.setAttribute('data-fx-tilt', '');
    var pend = false, mx = 0, my = 0;
    c.addEventListener('mousemove', function (e) {
      var r = c.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width - 0.5;
      my = (e.clientY - r.top) / r.height - 0.5;
      if (pend) return;
      pend = true;
      requestAnimationFrame(function () {
        pend = false;
        c.style.setProperty('--ry', (mx * 9).toFixed(2) + 'deg');
        c.style.setProperty('--rx', (-my * 9).toFixed(2) + 'deg');
      });
    });
    c.addEventListener('mouseleave', function () {
      c.style.setProperty('--rx', '0deg');
      c.style.setProperty('--ry', '0deg');
    });
  });`);
  }

  if (d.cardHover === 'spotlight') {
    bloques.push(`  // Foco de luz: la posición del mouse va a --mx/--my (en %) y el CSS pinta el gradiente
  cards().forEach(function (c) {
    var pend = false, px = 50, py = 50;
    c.addEventListener('mousemove', function (e) {
      var r = c.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width) * 100;
      py = ((e.clientY - r.top) / r.height) * 100;
      if (pend) return;
      pend = true;
      requestAnimationFrame(function () {
        pend = false;
        c.style.setProperty('--mx', px.toFixed(1) + '%');
        c.style.setProperty('--my', py.toFixed(1) + '%');
      });
    });
  });`);
  }

  if (d.btnFx === 'magnetic') {
    bloques.push(`  // Magnético: el botón se corre hasta 6px hacia el mouse mientras está encima
  slice(document.querySelectorAll('.btn')).forEach(function (b) {
    b.setAttribute('data-fx-magnet', '');
    var pend = false, dx = 0, dy = 0;
    b.addEventListener('mousemove', function (e) {
      var r = b.getBoundingClientRect();
      dx = ((e.clientX - r.left) / r.width - 0.5) * 12;
      dy = ((e.clientY - r.top) / r.height - 0.5) * 12;
      if (pend) return;
      pend = true;
      requestAnimationFrame(function () {
        pend = false;
        b.style.setProperty('--dx', dx.toFixed(1) + 'px');
        b.style.setProperty('--dy', dy.toFixed(1) + 'px');
      });
    });
    b.addEventListener('mouseleave', function () {
      b.style.setProperty('--dx', '0px');
      b.style.setProperty('--dy', '0px');
    });
  });`);
  }

  if (d.btnFx === 'arrow') {
    bloques.push(`  // Flecha: se agrega sólo a los botones de texto plano. Un botón que ya trae un ícono
  // propio (carrito, WhatsApp) no recibe otra: dos íconos compiten y confunden.
  slice(document.querySelectorAll('.btn')).forEach(function (b) {
    if (b.querySelector('svg') || b.querySelector('.btn-arrow')) return;
    if (!b.textContent.trim()) return;
    var s = document.createElement('span');
    s.className = 'btn-arrow';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = '\\u2192';
    b.appendChild(s);
  });`);
  }

  if (d.linkFx === 'textroll') {
    bloques.push(`  // El texto rueda: se envuelve el label en un contenedor con dos copias apiladas.
  // Sólo los links que son texto puro (los de ícono y los que traen badge quedan afuera).
  slice(document.querySelectorAll('.nav-links a')).forEach(function (a) {
    if (a.querySelector('svg, .badge, .roll')) return;
    var t = a.textContent.trim();
    if (!t) return;
    a.textContent = '';
    var wrap = document.createElement('span');
    wrap.className = 'roll';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<span><span class="l1"></span><span class="l2"></span></span>';
    wrap.querySelector('.l1').textContent = t;
    wrap.querySelector('.l2').textContent = t;
    wrap.querySelector('.l1').style.display = 'block';
    wrap.querySelector('.l2').style.display = 'block';
    a.appendChild(wrap);
    // El texto accesible se conserva aparte: el bloque visible está en aria-hidden
    var sr = document.createElement('span');
    sr.textContent = t;
    sr.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
    a.appendChild(sr);
  });`);
  }

  if (d.titleFx && d.titleFx !== 'none') {
    const parte = d.titleFx === 'chars' ? 'chars' : (d.titleFx === 'words' ? 'words' : 'plain');
    bloques.push(`  // Títulos: se marcan y se animan al entrar en pantalla (una sola vez).
  // El texto se parte sólo en las variantes que lo necesitan; en las otras el elemento
  // entero recibe la clase y el CSS hace el resto.
  var titulos = slice(document.querySelectorAll('.hero h1, section h2'));
  titulos.forEach(function (h) {
    if (h.hasAttribute('data-fx-title')) return;
    h.setAttribute('data-fx-title', '');
    ${parte === 'plain' ? '' : `partir(h, '${parte}');`}
  });
  if (!('IntersectionObserver' in window)) {
    // Sin observer no ocultamos nada: todo visible de entrada
    titulos.forEach(function (h) { h.classList.add('fx-on'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('fx-on');
        io.unobserve(en.target);
      });
    }, { threshold: 0.2 });
    titulos.forEach(function (h) { io.observe(h); });
    // Red de seguridad: con la pestaña oculta el observer puede no disparar nunca.
    // Pase lo que pase, a los 2 segundos los títulos están visibles.
    setTimeout(function () { titulos.forEach(function (h) { h.classList.add('fx-on'); }); }, 2000);
  }`);
  }

  const partir = (d.titleFx === 'words' || d.titleFx === 'chars') ? `
  // Parte el título en palabras o letras, preservando los espacios. Sólo toca nodos de
  // texto: si el título trae un <span> o un ícono, ese nodo queda intacto.
  function partir(el, modo) {
    var nodos = slice(el.childNodes);
    var i = 0;
    nodos.forEach(function (n) {
      if (n.nodeType !== 3) return;
      var frag = document.createDocumentFragment();
      var piezas = modo === 'words' ? n.nodeValue.split(/(\\s+)/) : n.nodeValue.split('');
      piezas.forEach(function (p) {
        if (!p) return;
        if (/^\\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
        var s = document.createElement('span');
        s.className = modo === 'words' ? 'fx-w' : 'fx-c';
        s.style.setProperty('--i', i++);
        s.textContent = p;
        frag.appendChild(s);
      });
      el.replaceChild(frag, n);
    });
  }
` : '';

  return `/* Sistema de movimiento: la parte que no se puede resolver con CSS solo.
   Si el visitante pidió menos movimiento, este bloque no hace absolutamente nada
   (el CSS ya deja todo quieto, pero tampoco tiene sentido enganchar listeners). */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var slice = function (l) { return Array.prototype.slice.call(l); };
  // Mismo criterio que el CSS: las tarjetas con campos no reciben efecto de hover
  var cards = function () {
    return slice(document.querySelectorAll('.card')).filter(function (c) {
      return c.tagName !== 'FORM' && !c.querySelector('form, input, select, textarea');
    });
  };
${partir}${bloques.join('\n\n')}
})();
`;
}

/* ---------- variantes de la aparición al scroll (las aplica el módulo `reveal`) ---------- */

// Estado inicial y final de cada variante, en el formato que espera Motion (animate).
// El módulo `reveal` las lee para no duplicar el catálogo ni desincronizarse del panel.
const REVEAL_KEYFRAMES = {
  fade: { opacity: [0, 1], y: [26, 0] },
  blur: { opacity: [0, 1], y: [18, 0], filter: ['blur(10px)', 'blur(0px)'] },
  mask: { opacity: [0, 1], clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'] },
  rotate: { opacity: [0, 1], rotate: [-4, 0], scale: [0.94, 1] },
  scale: { opacity: [0, 1], scale: [0.88, 1] },
  slide: { opacity: [0, 1], x: [-40, 0] },
  flip: { opacity: [0, 1], rotateX: [-55, 0] },
  none: null,
};

module.exports = { EJES, VALORES, DEFAULTS, normalizeDesign, motionCss, motionJs, REVEAL_KEYFRAMES };
