const { esc } = require('../../src/templates');

// Quiz / recomendador interactivo: una serie de preguntas de opción única guían al
// visitante hacia una recomendación (qué plan, servicio o producto le conviene). Suma
// votos por cada resultado posible y al final muestra el más elegido, con un CTA. Todo
// frontend puro, sin backend. Preguntas y resultados son placeholders editables (viajan
// embebidos en un <script type="application/json">). Las transiciones entre pasos se
// animan con Anime.js (con red de seguridad) y respetan "prefers-reduced-motion". Distinto
// del "Formulario multi-paso" (ese junta datos de un formulario): esto orienta una decisión.
const QUIZ = {
  intro: 'Respondé 3 preguntas rápidas y te recomendamos la opción ideal para vos.',
  preguntas: [
    { pregunta: '¿Para qué lo vas a usar?', opciones: [
      { texto: 'Un proyecto personal', valor: 'inicial' },
      { texto: 'Mi pyme o emprendimiento', valor: 'pro' },
      { texto: 'Una empresa con varios equipos', valor: 'empresa' },
    ] },
    { pregunta: '¿Cuántas personas lo van a usar?', opciones: [
      { texto: 'Solo yo', valor: 'inicial' },
      { texto: 'Un equipo chico (2 a 10)', valor: 'pro' },
      { texto: 'Muchas personas (10+)', valor: 'empresa' },
    ] },
    { pregunta: '¿Qué es lo más importante para vos?', opciones: [
      { texto: 'Empezar gratis y simple', valor: 'inicial' },
      { texto: 'Buen soporte y funciones', valor: 'pro' },
      { texto: 'Escala, seguridad e integraciones', valor: 'empresa' },
    ] },
  ],
  resultados: {
    inicial: { titulo: 'Plan Inicial', texto: 'Ideal para arrancar sin costo y con lo esencial. Podés escalar cuando lo necesites.' },
    pro: { titulo: 'Plan Profesional', texto: 'El equilibrio justo entre funciones, soporte y precio para tu negocio en crecimiento.' },
    empresa: { titulo: 'Plan Empresa', texto: 'Pensado para organizaciones que necesitan escala, seguridad e integraciones a medida.' },
  },
  textoBoton: 'Ver esta opción',
};

module.exports = {
  // La estructura sembrada se exporta para que el módulo funcional "recomendador" la use como
  // semilla EXACTA de su colección: si la duplicara, cualquier cambio acá dejaría la primera
  // carga mostrando un cuestionario y el backend otro.
  SEED: QUIZ,
  id: 'quiz', type: 'ui', name: 'Quiz recomendador',
  description: 'Quiz interactivo que guía al visitante con preguntas y le recomienda la mejor opción (plan/servicio/producto) con un CTA. Frontend puro, transiciones con Anime.js.',
  usesAnime: true,
  html: (cfg) => {
    // El CTA del resultado apunta a precios/contacto si existen; si no, a Nosotros
    const href = cfg.moduleIds.includes('pricing') ? '/index.html#precios'
      : cfg.moduleIds.includes('contact') ? '/contact.html' : '/about.html';
    const datos = { ...QUIZ, href };
    return `  <section id="quiz">
    <div class="container">
      <h2>¿Cuál te conviene?</h2>
      <p class="section-sub">${esc(QUIZ.intro)}</p>
      <div class="quiz-card card" id="quiz-app">
        <noscript><p class="muted">Este recomendador necesita JavaScript. Podés escribirnos y te asesoramos.</p></noscript>
      </div>
    </div>
    <script type="application/json" id="quiz-datos">${JSON.stringify(datos).replace(/</g, '\\u003c')}</script>
  </section>`;
  },
  head: () => `  <style>
    .quiz-card{max-width:600px;margin:0 auto;min-height:230px;display:flex;flex-direction:column;justify-content:center}
    .quiz-prog{height:6px;background:color-mix(in srgb,var(--text) 10%,var(--bg));border-radius:999px;overflow:hidden;margin-bottom:18px}
    .quiz-prog i{display:block;height:100%;background:var(--accent);border-radius:999px;transition:width .3s ease}
    .quiz-paso{font-size:.8rem;color:var(--muted);margin-bottom:8px}
    .quiz-preg{font-size:1.25rem;font-weight:700;margin:0 0 16px}
    .quiz-ops{display:flex;flex-direction:column;gap:10px}
    .quiz-op{text-align:left;background:var(--bg);border:1.5px solid var(--line);border-radius:var(--radius);padding:13px 16px;
      font:inherit;cursor:pointer;transition:border-color .2s ease,background .2s ease}
    .quiz-op:hover,.quiz-op:focus-visible{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--bg))}
    .quiz-res{text-align:center}
    .quiz-res .quiz-badge{display:inline-block;font-size:.78rem;color:var(--accent);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}
    .quiz-res h3{font-size:1.7rem;margin:0 0 10px}
    .quiz-res .quiz-acciones{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px}
    .quiz-reiniciar{background:transparent;border:0;color:var(--muted);font:inherit;cursor:pointer;text-decoration:underline}
  </style>`,
  clientJs: () => `/* Módulo quiz recomendador: arma preguntas y resultado en base a los datos embebidos.
   Editá preguntas, opciones y resultados en la constante QUIZ de modules/ui/quiz.js.
   Suma un voto por opción y al final recomienda el resultado más votado.
   Expone window.WFQuiz para que el módulo funcional "recomendador" (si está activo) reemplace el
   cuestionario por el administrable y registre cada respuesta: el quiz sigue siendo de este
   módulo, lo que se agrega es de dónde salen los datos y adónde van las respuestas. */
(function () {
  var app = document.getElementById('quiz-app');
  var datosEl = document.getElementById('quiz-datos');
  if (!app || !datosEl) return;
  var QUIZ;
  try { QUIZ = JSON.parse(datosEl.textContent); } catch (e) { return; }
  if (!QUIZ.preguntas || !QUIZ.preguntas.length) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var indice = 0, votos = {};
  // Ganchos opcionales del módulo funcional. Sin él quedan en null y el quiz corre igual.
  var alResponder = null, alTerminar = null;

  function anim(entrada) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) return;
    var hijos = Array.prototype.slice.call(app.children);
    if (!hijos.length) return;
    anime.animate(hijos, { opacity: [0, 1], translateX: [entrada ? 24 : -24, 0], duration: 320, delay: anime.stagger ? anime.stagger(40) : 0, ease: 'outCubic' });
    // Red de seguridad: fija visible por si el loop está pausado
    setTimeout(function () { hijos.forEach(function (h) { h.style.opacity = '1'; h.style.transform = ''; }); }, 500);
  }

  function elegir(valor, texto) {
    var p = QUIZ.preguntas[indice];
    votos[valor] = (votos[valor] || 0) + 1;
    // El aviso sale ANTES de avanzar: así el índice que viaja es el de la pregunta contestada,
    // que es el número con el que después se calcula en cuál abandona la gente.
    if (alResponder) { try { alResponder(indice, p && p.pregunta, texto, valor); } catch (e) {} }
    indice++;
    if (indice < QUIZ.preguntas.length) pintarPregunta(true);
    else pintarResultado();
  }

  function pintarPregunta(entrada) {
    var p = QUIZ.preguntas[indice];
    var pct = Math.round((indice / QUIZ.preguntas.length) * 100);
    var html = '<div class="quiz-prog"><i style="width:' + pct + '%"></i></div>' +
      '<div class="quiz-paso">Pregunta ' + (indice + 1) + ' de ' + QUIZ.preguntas.length + '</div>' +
      '<p class="quiz-preg">' + App.esc(p.pregunta) + '</p>' +
      '<div class="quiz-ops">' +
      p.opciones.map(function (o, i) {
        return '<button type="button" class="quiz-op" data-valor="' + App.esc(o.valor) + '" data-i="' + i + '">' + App.esc(o.texto) + '</button>';
      }).join('') + '</div>';
    app.innerHTML = html;
    Array.prototype.slice.call(app.querySelectorAll('.quiz-op')).forEach(function (b) {
      b.addEventListener('click', function () { elegir(b.getAttribute('data-valor'), b.textContent); });
    });
    var primera = app.querySelector('.quiz-op');
    if (primera && indice > 0) primera.focus();
    anim(entrada);
  }

  function pintarResultado() {
    // Resultado más votado (ante empate, gana el primero que llegó al máximo)
    var ganador = null, max = -1;
    Object.keys(votos).forEach(function (k) { if (votos[k] > max) { max = votos[k]; ganador = k; } });
    var r = (QUIZ.resultados && QUIZ.resultados[ganador]) || { titulo: 'Tu recomendación', texto: 'Escribinos y te asesoramos.' };
    // El destino puede ser propio del resultado (cada recomendación lleva a su página) y, si no,
    // el general del quiz: sin esto, todas las recomendaciones apuntan al mismo lado y la
    // recomendación deja de ser una recomendación.
    var destino = r.enlace || QUIZ.href || '/about.html';
    app.innerHTML = '<div class="quiz-res">' +
      '<span class="quiz-badge">Te recomendamos</span>' +
      '<h3>' + App.esc(r.titulo) + '</h3>' +
      '<p class="muted">' + App.esc(r.texto) + '</p>' +
      '<div class="quiz-acciones">' +
      '<a class="btn" href="' + App.esc(destino) + '">' + App.esc(r.textoBoton || QUIZ.textoBoton || 'Ver más') + '</a>' +
      '<button type="button" class="quiz-reiniciar">Volver a empezar</button>' +
      '</div>' +
      '<div id="quiz-extra"></div>' +
      '</div>';
    var reiniciar = app.querySelector('.quiz-reiniciar');
    if (reiniciar) reiniciar.addEventListener('click', function () { indice = 0; votos = {}; pintarPregunta(false); });
    if (alTerminar) { try { alTerminar(ganador, r, document.getElementById('quiz-extra')); } catch (e) {} }
    anim(true);
  }

  // Punto de entrada del módulo funcional "recomendador": le deja reemplazar el cuestionario por
  // el administrable y engancharse a cada respuesta y al resultado.
  window.WFQuiz = {
    setDatos: function (d) {
      if (!d || !d.preguntas || !d.preguntas.length) return;
      var seccion = document.getElementById('quiz');
      if (seccion) {
        var h2 = seccion.querySelector('h2');
        var sub = seccion.querySelector('.section-sub');
        if (h2 && d.titulo) h2.textContent = d.titulo;
        if (sub && d.intro) sub.textContent = d.intro;
      }
      QUIZ = d;
      indice = 0;
      votos = {};
      pintarPregunta(false);
    },
    alResponder: function (fn) { alResponder = fn; },
    alTerminar: function (fn) { alTerminar = fn; },
  };

  pintarPregunta(false);
})();`,
  readmeNotes: (cfg) => [
    cfg.moduleIds.includes('recomendador')
      ? '**Quiz recomendador**: con el módulo **Quiz recomendador administrable** activo, las preguntas, opciones y resultados se editan desde `/recomendador-admin.html` (no hace falta tocar la constante `QUIZ`) y **cada recorrido queda registrado**: cuál recomendó, cuántos terminaron y en qué pregunta abandona la gente.'
      : '**Quiz recomendador**: las preguntas, opciones y resultados son placeholders; editá la constante `QUIZ` en `modules/ui/quiz.js`. Cada opción suma un voto al resultado indicado en `valor`; al final se recomienda el más votado. El CTA enlaza a Precios/Contacto si están activos. El quiz **no registra nada**: activá el módulo **Quiz recomendador administrable** para editarlo desde la web y ver qué contesta la gente.',
  ],
};
