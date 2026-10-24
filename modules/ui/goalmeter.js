const { esc, txt } = require('../../src/templates');

// Barra de meta / objetivo: muestra el avance hacia una meta (recaudación de una campaña,
// donaciones, cupos vendidos, objetivo del mes…) con una barra que se llena y un número
// que cuenta hasta el valor actual cuando la sección entra en pantalla. Animado con
// Anime.js (con red de seguridad si el loop está pausado) y respeta "prefers-reduced-motion":
// sin animación, muestra el estado final igual. Los valores son placeholders editables desde
// el Builder (bloque "Textos por sección"). Distinto de "Contadores" (números sueltos) y
// "Barras de capacidades" (porcentajes de skills): esto es un progreso concreto hacia un
// objetivo con unidad.
const META = {
  titulo: 'Campaña solidaria 2026',
  descripcion: 'Estamos juntando fondos para el nuevo proyecto. ¡Sumate y ayudanos a llegar!',
  actual: 68000,
  objetivo: 100000,
  prefijo: '$',
  sufijo: '',
  etiquetaActual: 'recaudado',
  etiquetaObjetivo: 'meta',
  textoBoton: 'Quiero colaborar',
};

// Convierte a número lo que escribió el cliente; si no parsea (o no es positivo, que
// rompería el porcentaje) queda el valor base. Se toleran los puntos de miles y la coma
// decimal, porque es lo que sale natural al escribir "68.000".
function numero(s, base) {
  const limpio = String(s).replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return Number.isFinite(n) && n > 0 ? n : base;
}

// Valores efectivos de la meta según la config del Builder. Devuelve siempre la misma
// forma que la constante META para que el render no cambie.
function meta(cfg) {
  return {
    titulo: txt(cfg, 'goalmeter', 'titulo', META.titulo),
    descripcion: txt(cfg, 'goalmeter', 'descripcion', META.descripcion),
    actual: numero(txt(cfg, 'goalmeter', 'actual', META.actual), META.actual),
    objetivo: numero(txt(cfg, 'goalmeter', 'objetivo', META.objetivo), META.objetivo),
    prefijo: txt(cfg, 'goalmeter', 'prefijo', META.prefijo),
    sufijo: txt(cfg, 'goalmeter', 'sufijo', META.sufijo),
    etiquetaActual: txt(cfg, 'goalmeter', 'etiquetaActual', META.etiquetaActual),
    etiquetaObjetivo: txt(cfg, 'goalmeter', 'etiquetaObjetivo', META.etiquetaObjetivo),
    textoBoton: txt(cfg, 'goalmeter', 'textoBoton', META.textoBoton),
  };
}

module.exports = {
  id: 'goalmeter', type: 'ui', name: 'Barra de meta / objetivo',
  description: 'Progreso hacia una meta (recaudación, donaciones, cupos, objetivo del mes) con barra que se llena y número que cuenta al entrar en pantalla. Animado con Anime.js.',
  usesAnime: true,
  fields: [
    { key: 'titulo', label: 'Título de la meta', default: META.titulo, max: 80 },
    { key: 'descripcion', label: 'Bajada', default: META.descripcion, max: 220 },
    { key: 'actual', label: 'Valor alcanzado', default: String(META.actual), max: 20, hint: 'Sólo el número, sin símbolo de moneda. Ejemplo: 68000.' },
    { key: 'objetivo', label: 'Objetivo', default: String(META.objetivo), max: 20, hint: 'Sólo el número, sin símbolo de moneda. Ejemplo: 100000.' },
    { key: 'prefijo', label: 'Prefijo del número', default: META.prefijo, max: 8, hint: 'Va pegado adelante del número. Ejemplo: $.' },
    { key: 'sufijo', label: 'Sufijo del número', default: META.sufijo, max: 8, hint: 'Va pegado atrás del número. Ejemplo: kg, cupos.' },
    { key: 'etiquetaActual', label: 'Palabra para lo alcanzado', default: META.etiquetaActual, max: 40, hint: 'Se lee como "68.000 recaudado de 100.000 meta".' },
    { key: 'etiquetaObjetivo', label: 'Palabra para el objetivo', default: META.etiquetaObjetivo, max: 40 },
    { key: 'textoBoton', label: 'Texto del botón', default: META.textoBoton, max: 60 },
  ],
  html: (cfg) => {
    const m = meta(cfg);
    const pct = Math.max(0, Math.min(100, Math.round((m.actual / m.objetivo) * 100)));
    // El botón apunta a contacto/presupuesto si existen; si no, a Nosotros
    const href = cfg.moduleIds.includes('contact') ? '/contact.html'
      : cfg.moduleIds.includes('quote') ? '/quote.html' : '/about.html';
    const fmt = (n) => esc(m.prefijo) + Number(n).toLocaleString('es-AR') + esc(m.sufijo);
    return `  <section id="meta">
    <div class="container">
      <div class="goal card" data-goal data-actual="${m.actual}" data-objetivo="${m.objetivo}" data-pct="${pct}"
        data-prefijo="${esc(m.prefijo)}" data-sufijo="${esc(m.sufijo)}">
        <h2>${esc(m.titulo)}</h2>
        <p class="section-sub">${esc(m.descripcion)}</p>
        <div class="goal-cifras">
          <span class="goal-actual" id="goal-actual">${fmt(m.actual)}</span>
          <span class="muted">${esc(m.etiquetaActual)} de <b>${fmt(m.objetivo)}</b> ${esc(m.etiquetaObjetivo)}</span>
        </div>
        <div class="goal-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Avance de la meta">
          <div class="goal-fill" id="goal-fill" style="width:0%"></div>
        </div>
        <div class="goal-pie">
          <span class="goal-pct" id="goal-pct">${pct}%</span>
          <a class="btn" href="${href}">${esc(m.textoBoton)}</a>
        </div>
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    .goal{max-width:640px;margin:0 auto;text-align:center}
    .goal-cifras{display:flex;flex-direction:column;gap:2px;margin:6px 0 14px}
    .goal-actual{font-size:2.4rem;font-weight:800;line-height:1;color:var(--accent);font-variant-numeric:tabular-nums}
    .goal-track{height:16px;background:color-mix(in srgb,var(--text) 10%,var(--bg));border-radius:999px;overflow:hidden}
    .goal-fill{height:100%;background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 55%,var(--primary)));border-radius:999px;transition:width .2s linear}
    .goal-pie{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:14px;flex-wrap:wrap}
    .goal-pct{font-weight:700;font-variant-numeric:tabular-nums}
  </style>`,
  clientJs: () => `/* Módulo barra de meta: cuando la barra entra en pantalla, el número cuenta hasta
   el valor actual y la barra se llena, con Anime.js. Los valores se editan desde el Builder
   (bloque "Textos por sección") y viajan en atributos data- de la sección. */
(function () {
  var el = document.querySelector('[data-goal]');
  if (!el) return;
  var actual = Number(el.getAttribute('data-actual')) || 0;
  var pct = Number(el.getAttribute('data-pct')) || 0;
  var prefijo = el.getAttribute('data-prefijo') || '';
  var sufijo = el.getAttribute('data-sufijo') || '';
  var numEl = document.getElementById('goal-actual');
  var pctEl = document.getElementById('goal-pct');
  var fill = document.getElementById('goal-fill');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (n) { return prefijo + Math.round(n).toLocaleString('es-AR') + sufijo; };

  function fijarFinal() {
    if (numEl) numEl.textContent = fmt(actual);
    if (pctEl) pctEl.textContent = pct + '%';
    if (fill) fill.style.width = pct + '%';
  }

  var anime = window.anime;
  if (!anime || !anime.animate || reduce) { fijarFinal(); return; }

  function animar() {
    if (fill) anime.animate(fill, { width: [ '0%', pct + '%' ], duration: 1200, ease: 'outCubic' });
    var estado = { v: 0 };
    anime.animate(estado, { v: actual, duration: 1200, ease: 'outCubic', modifier: anime.round ? anime.round(0) : undefined,
      onUpdate: function () {
        if (numEl) numEl.textContent = fmt(estado.v);
        if (pctEl) pctEl.textContent = Math.round((estado.v / actual) * pct) + '%';
      } });
    // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
    setTimeout(fijarFinal, 1500);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entradas, obs) {
      if (entradas.some(function (e) { return e.isIntersecting; })) { animar(); obs.disconnect(); }
    }, { rootMargin: '0px 0px -12% 0px' });
    io.observe(el);
  } else {
    animar();
  }
})();`,
  readmeNotes: () => [
    '**Barra de meta / objetivo**: los valores (título, monto recaudado, objetivo, unidad) salen del bloque *Textos por sección* del Builder; si no los editaste, son placeholders. También podés cambiarlos después en la sección `#meta` de `public/index.html` (atributos `data-` de la tarjeta). El botón enlaza a Contacto/Presupuesto si están activos, o a Nosotros.',
  ],
};
