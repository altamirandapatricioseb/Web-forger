// Escena 3D al scroll: una sección de landing puramente visual donde un objeto típico del
// rubro se recorre/desarma a medida que el visitante scrollea, con pasos de texto al costado
// (referencia: las páginas de storytelling tipo 45R "Indigo Hakusho"). Todo en CSS 3D + JS
// vanilla: nada de Three.js ni WebGL — el proyecto exportado sigue sin dependencias y corre
// offline. El scroll es el NATIVO (sticky + progreso medido): no hay scroll-jacking, la rueda
// del mouse siempre responde como el visitante espera.
//
// Las escenas viven en modules/ui/escena3d/ (el registro ignora subcarpetas) y cumplen el
// contrato documentado en casa.js: html + css + una función update(p, q, u, W) que recibe el
// progreso 0..1. El Builder elige la escena con un campo select y puede pisar título y pasos.
//
// Degradación en cascada, en este orden:
//   - Sin JS: la sección NO mide 420vh (sería un vacío inescrolleable); queda una vista
//     estática con el objeto armado (pose de reposo del CSS) y los pasos como lista normal.
//   - Con "reducir movimiento": ídem estático — el motor ni se engancha.
//   - Con JS y movimiento: el motor agrega .s3d-on, que activa la altura de recorrido y el
//     sticky, y pinta cada frame desde rAF (sin timers: con la pestaña oculta no corre nada
//     que pueda quedar a medias, el estado es función pura del scroll).
const { esc, txt, txtList } = require('../../src/templates');

// Catálogo de escenas, agrupadas por rubro para que el select del Builder se pueda leer.
// Agregar una es crear el archivo en escena3d/ y sumarla acá: el select, la validación y el
// resto del módulo salen solos de este objeto.
const ESCENAS = {
  // Vivienda, comercio y servicios
  casa: require('./escena3d/casa'),
  caja: require('./escena3d/caja'),
  engranajes: require('./escena3d/engranajes'),
  libro: require('./escena3d/libro'),
  // Tecnología
  telefono: require('./escena3d/telefono'),
  switch: require('./escena3d/switch'),
  // Gastronomía
  hamburguesa: require('./escena3d/hamburguesa'),
  taza: require('./escena3d/taza'),
  botella: require('./escena3d/botella'),
  // Indumentaria y accesorios
  remera: require('./escena3d/remera'),
  zapatilla: require('./escena3d/zapatilla'),
  lentes: require('./escena3d/lentes'),
  // Salud, automotor y verde
  diente: require('./escena3d/diente'),
  rueda: require('./escena3d/rueda'),
  planta: require('./escena3d/planta'),
};

// Escena efectiva según la config (el select ya viene validado por el generador)
const escenaDe = (cfg) => ESCENAS[txt(cfg, 'escena3d', 'escena', 'casa')] || ESCENAS.casa;

// Opciones de puesta en escena. Se resuelven a CLASES sobre la sección y su CSS se emite
// siempre: son cuatro reglas, y así el mismo HTML sirve para cualquier combinación.
const LARGOS = { corto: '300vh', normal: '420vh', largo: '580vh' };
const largoDe = (cfg) => LARGOS[txt(cfg, 'escena3d', 'largo', 'normal')] || LARGOS.normal;
const claseDe = (cfg, campo, def) => `s3d-${campo}-${txt(cfg, 'escena3d', campo, def)}`;

// Pasos efectivos: los del Builder si se cargaron (tope 6), si no los propios de la escena
function pasosDe(cfg) {
  const propios = txtList(cfg, 'escena3d', 'pasos', '');
  if (!propios.length) return escenaDe(cfg).pasos;
  return propios.slice(0, 6).map(linea => {
    const partes = Array.isArray(linea) ? linea : [linea];
    return { t: partes[0], x: partes.length > 1 ? partes.slice(1).join(' | ') : '' };
  });
}

// CSS del armazón (layout, pasos, riel de progreso). El de la escena elegida se concatena.
const BASE_CSS = `
  #escena3d { padding: 0; }
  /* Fondo de la sección, elegible en el Builder */
  #escena3d.s3d-fondo-degradado { background: linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--primary) 6%, var(--bg)) 50%, var(--bg)); }
  #escena3d.s3d-fondo-tenue { background: color-mix(in srgb, var(--accent) 7%, var(--bg)); }
  #escena3d.s3d-fondo-contraste { background: color-mix(in srgb, var(--primary) 92%, var(--bg)); color: color-mix(in srgb, var(--bg) 92%, var(--primary)); }
  #escena3d.s3d-fondo-contraste .s3d-step p, #escena3d.s3d-fondo-contraste .s3d-copy h2 { color: inherit; }
  #escena3d.s3d-fondo-contraste .s3d-step p { opacity: .78; }
  #escena3d.s3d-fondo-ninguno { background: none; }
  #escena3d .s3d-pin { position: relative; }
  #escena3d .s3d-stage { display: flex; align-items: center; gap: 28px; min-height: 90vh; max-width: 1080px; margin: 0 auto; padding: 40px 20px; }
  /* Lado del texto: invertir la fila deja el objeto a la izquierda sin tocar el HTML */
  #escena3d.s3d-lado-derecha .s3d-stage { flex-direction: row-reverse; }
  #escena3d.s3d-lado-derecha.s3d-on .s3d-rail { left: auto; right: 0; }
  #escena3d.s3d-on .s3d-stage { position: sticky; top: 0; height: 100vh; min-height: 0; overflow: hidden; box-sizing: border-box; }
  #escena3d .s3d-copy { flex: 0 1 360px; min-width: 0; position: relative; z-index: 2; }
  #escena3d .s3d-copy h2 { margin: 0 0 18px; }
  #escena3d .s3d-steps { list-style: none; margin: 0; padding: 0; }
  #escena3d .s3d-step h3 { margin: 0 0 6px; font-size: 1.05rem; letter-spacing: -0.01em; }
  #escena3d .s3d-step p { margin: 0; color: var(--muted); font-size: 0.95rem; }
  /* sin recorrido activo: los pasos son una lista normal, numerada con el acento */
  #escena3d:not(.s3d-on) .s3d-step { margin: 0 0 18px; padding-left: 34px; position: relative; counter-increment: s3d; }
  #escena3d:not(.s3d-on) .s3d-steps { counter-reset: s3d; }
  #escena3d:not(.s3d-on) .s3d-step::before { content: counter(s3d); position: absolute; left: 0; top: 0;
    width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: white;
    font-size: 0.72rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  /* recorrido activo: un paso por vez, apilados y cross-fade */
  #escena3d.s3d-on .s3d-steps { position: relative; min-height: 170px; }
  #escena3d.s3d-on .s3d-step { position: absolute; inset: 0 auto auto 0; width: 100%; opacity: 0; transform: translateY(14px); pointer-events: none; }
  /* La escala del objeto vive en UNA variable y todas las media queries de abajo sólo la
     pisan, siempre con el mismo selector (#escena3d). Con selectores de distinta
     especificidad —que fue el primer intento— la regla de alto le ganaba a la de ancho sin
     importar el orden, y en un celular angosto el objeto se salía de cuadro igual. */
  #escena3d { --s3d-escala: 1; }
  #escena3d .s3d-viewport { flex: 1 1 0; min-width: 0; display: flex; align-items: center; justify-content: center; perspective: 1400px; perspective-origin: 50% 42%; transform: scale(var(--s3d-escala)); }
  #escena3d .s3d-world { transform-style: preserve-3d; position: relative; }
  /* riel de progreso vertical, sólo en modo recorrido */
  #escena3d .s3d-rail { display: none; }
  #escena3d.s3d-on .s3d-rail { display: block; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    width: 3px; height: 150px; border-radius: 2px; background: color-mix(in srgb, var(--text) 12%, transparent); }
  #escena3d .s3d-bar { display: block; width: 100%; height: 0; border-radius: 2px; background: var(--accent); }
  @media (prefers-reduced-motion: no-preference) {
    #escena3d.s3d-on .s3d-step { transition: opacity .45s ease, transform .5s cubic-bezier(0.22, 1, 0.36, 1); }
    #escena3d.s3d-on .s3d-step.activa { opacity: 1; transform: none; pointer-events: auto; }
  }
  @media (prefers-reduced-motion: reduce) {
    #escena3d .s3d-step { opacity: 1; transform: none; }
  }
  /* Pantallas bajas (notebooks 1366x768, ventanas a media altura): el stage mide 100vh y el
     objeto no entra. Se achica el VIEWPORT y no el mundo a propósito: el transform del mundo
     lo escribe el JS en cada frame y pisaría cualquier escala que pusiéramos acá. */
  @media (max-height: 780px) { #escena3d { --s3d-escala: 0.84; } }
  @media (max-height: 640px) { #escena3d { --s3d-escala: 0.68; } }
  /* Banda intermedia (tablet en horizontal, ventana a media pantalla): el layout sigue siendo
     de dos columnas, así que al objeto le queda menos de la mitad del ancho. Sin este paso,
     una tablet de 768px de ancho y alta —donde no entra ninguna de las otras queries— se
     comía 85px de la casa por los costados. */
  @media (max-width: 1000px) { #escena3d { --s3d-escala: 0.64; } }
  /* móvil: el objeto arriba, el texto como tarjeta apoyada abajo */
  @media (max-width: 760px) {
    #escena3d { --s3d-escala: 0.62; }
    #escena3d .s3d-stage { flex-direction: column; justify-content: center; gap: 8px; }
    #escena3d.s3d-on .s3d-copy { order: 2; flex: 0 0 auto; width: 100%; background: color-mix(in srgb, var(--bg) 86%, transparent); backdrop-filter: blur(6px); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; }
    #escena3d.s3d-on .s3d-copy h2 { font-size: 1.15rem; margin-bottom: 10px; }
    #escena3d.s3d-on .s3d-steps { min-height: 120px; }
    #escena3d .s3d-viewport { order: 1; }
    #escena3d.s3d-on .s3d-rail { display: none; }
  }
  /* Móvil angosto: las escenas más anchas (la casa mide ~500px proyectados) se salían por
     los costados. Achica de nuevo por ANCHO, que es el eje que las de arriba no miran. */
  @media (max-width: 460px) { #escena3d { --s3d-escala: 0.5; } }`;

module.exports = {
  id: 'escena3d', type: 'ui', name: 'Escena 3D al scroll',
  description: 'Sección de landing puramente visual: un objeto típico del rubro (casa, teléfono desarmado, anteojos, switch mecánico o caja de envío) se recorre en 3D a medida que el visitante scrollea, con pasos de texto al costado. CSS 3D + scroll nativo, sin librerías ni scroll-jacking; estática sin JS o con "reducir movimiento".',
  fields: [
    {
      key: 'escena', label: 'Objeto del recorrido', type: 'select', default: 'casa',
      options: Object.values(ESCENAS).map(e => [e.id, e.label]),
      hint: 'El objeto 3D que se arma al hacer scroll. Cada opción trae su propio título y sus propios pasos, escritos para su rubro: elegí el objeto primero y después ajustá los textos.',
    },
    { key: 'titulo', label: 'Título de la sección', default: '', max: 90, hint: 'Vacío usa el título propio de la escena elegida.' },
    {
      key: 'pasos', label: 'Pasos del recorrido', type: 'list', default: '', max: 1800,
      hint: 'Uno por línea: título | texto (máximo 6). Vacío usa los pasos propios de la escena. Los pasos se reparten parejo a lo largo del scroll.',
    },
    {
      key: 'largo', label: 'Largo del recorrido', type: 'select', default: 'normal',
      options: [['corto', 'Corto — se recorre rápido'], ['normal', 'Normal'], ['largo', 'Largo — más detalle']],
      hint: 'Cuánto hay que scrollear para completar la animación. Con muchos pasos conviene "Largo"; para una landing corta, "Corto".',
    },
    {
      key: 'lado', label: 'Posición del texto', type: 'select', default: 'izquierda',
      options: [['izquierda', 'Texto a la izquierda, objeto a la derecha'], ['derecha', 'Texto a la derecha, objeto a la izquierda']],
    },
    {
      key: 'fondo', label: 'Fondo de la sección', type: 'select', default: 'degradado',
      options: [['degradado', 'Degradado suave'], ['tenue', 'Tinte de marca'], ['contraste', 'Bloque oscuro de marca'], ['ninguno', 'Sin fondo']],
      hint: '"Bloque oscuro" separa la sección del resto de la página y hace resaltar el objeto; el texto se aclara solo.',
    },
  ],
  html: (cfg) => {
    const esc3 = escenaDe(cfg);
    const pasos = pasosDe(cfg);
    const titulo = txt(cfg, 'escena3d', 'titulo', '') || esc3.titulo;
    const clases = [`s3d-esc-${esc3.id}`, claseDe(cfg, 'lado', 'izquierda'), claseDe(cfg, 'fondo', 'degradado')].join(' ');
    const items = pasos.map((s, i) => `          <li class="s3d-step${i === 0 ? ' activa' : ''}">
            <h3>${esc(s.t)}</h3>
            <p>${esc(s.x)}</p>
          </li>`).join('\n');
    return `  <section id="escena3d" class="${clases}" data-escena="${esc3.id}">
    <div class="s3d-pin">
      <div class="s3d-stage">
        <span class="s3d-rail" aria-hidden="true"><span class="s3d-bar"></span></span>
        <div class="s3d-copy">
          <h2>${esc(titulo)}</h2>
          <ol class="s3d-steps">
${items}
        </ol>
        </div>
        <div class="s3d-viewport" aria-hidden="true">
          <div class="s3d-world">
      ${esc3.html}
        </div>
        </div>
      </div>
    </div>
  </section>`;
  },
  // El CSS sólo va en la Home (la única página con la sección): las demás no lo pagan
  head: (cfg, page) => {
    if (page.active !== '/index.html') return '';
    const esc3 = escenaDe(cfg);
    // El largo del recorrido se hornea acá y no como clase: es UN valor por proyecto y así
    // no hay que emitir tres reglas para que gane una.
    return `  <style>${BASE_CSS}
  #escena3d.s3d-on .s3d-pin { height: ${largoDe(cfg)}; }
${esc3.css}
  </style>`;
  },
  // Motor de scroll + la función de la escena elegida. Armado por CONCATENACIÓN a propósito:
  // el js de la escena es un string con llaves y template-traps que dentro de un template
  // literal del módulo serían un campo minado (ver bitácora: "cierre de handler en template").
  clientJs: (cfg) => {
    const esc3 = escenaDe(cfg);
    return '/* Módulo escena 3D al scroll (' + esc3.id + '): el estado visual es función pura del\n' +
      '   progreso de scroll — sin timers, sin scroll-jacking. Sin JS o con menos movimiento,\n' +
      '   la sección queda estática con el objeto en su pose de reposo. */\n' +
      '(function () {\n' +
      "  var sec = document.getElementById('escena3d');\n" +
      '  if (!sec) return;\n' +
      "  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;\n" +
      "  var pin = sec.querySelector('.s3d-pin');\n" +
      "  var world = sec.querySelector('.s3d-world');\n" +
      "  var pasos = Array.prototype.slice.call(sec.querySelectorAll('.s3d-step'));\n" +
      "  var barra = sec.querySelector('.s3d-bar');\n" +
      '  if (!pin || !world) return;\n' +
      '  // caché de piezas: las escenas piden sus partes con q(sel) en cada frame\n' +
      '  var cache = {};\n' +
      '  function q(sel) { if (!(sel in cache)) cache[sel] = sec.querySelector(sel); return cache[sel]; }\n' +
      '  var u = {\n' +
      '    lerp: function (a, b, t) { return a + (b - a) * t; },\n' +
      '    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },\n' +
      '    // progreso 0..1 dentro del tramo [a,b] del scroll, suavizado (smoothstep)\n' +
      '    seg: function (p, a, b) { var t = (p - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); },\n' +
      '  };\n' +
      '  var escena = ' + esc3.js + ';\n' +
      "  sec.classList.add('s3d-on');\n" +
      '  var p = 0, pintado = -1, pedido = false;\n' +
      '  function aplicar() {\n' +
      '    pintado = p;\n' +
      '    escena(p, q, u, world);\n' +
      "    if (barra) barra.style.height = (p * 100).toFixed(1) + '%';\n" +
      '    var n = pasos.length;\n' +
      '    if (!n) return;\n' +
      '    var idx = Math.min(Math.floor(p * n), n - 1);\n' +
      "    for (var i = 0; i < n; i++) pasos[i].classList.toggle('activa', i === idx);\n" +
      '  }\n' +
      '  function medir() {\n' +
      '    if (pedido) return;\n' +
      '    pedido = true;\n' +
      '    var corrio = false;\n' +
      '    var tarea = function () {\n' +
      '      if (corrio) return;\n' +
      '      corrio = true;\n' +
      '      pedido = false;\n' +
      '      var r = pin.getBoundingClientRect();\n' +
      '      var total = r.height - window.innerHeight;\n' +
      '      p = total > 0 ? u.clamp(-r.top / total, 0, 1) : 0;\n' +
      '      if (Math.abs(p - pintado) > 0.0005) aplicar();\n' +
      '    };\n' +
      '    requestAnimationFrame(tarea);\n' +
      '    // Red de seguridad: con la pestaña oculta rAF no dispara (lección repetida de esta\n' +
      '    // casa) y el guard quedaría trabado para siempre; el timeout garantiza el avance.\n' +
      '    setTimeout(tarea, 90);\n' +
      '  }\n' +
      "  window.addEventListener('scroll', medir, { passive: true });\n" +
      "  window.addEventListener('resize', medir, { passive: true });\n" +
      '  // Sondeo liviano de respaldo: en paneles/pestañas ocultos el navegador puede no\n' +
      '  // despachar NI scroll NI rAF (sólo corren los timers). Un getBoundingClientRect\n' +
      '  // cada 300ms es gratis y garantiza que el estado nunca quede desfasado del scroll.\n' +
      '  setInterval(medir, 300);\n' +
      '  medir();\n' +
      '  aplicar();\n' +
      '})();';
  },
  readmeNotes: (cfg) => [
    `**Escena 3D al scroll**: la sección es decorativa (objeto: ${escenaDe(cfg).label}); el objeto, el título y los pasos se eligen en el Builder (bloque *Textos por sección*). Con JavaScript apagado o "reducir movimiento" activado queda una vista estática con los pasos como lista, a propósito.`,
  ],
};
