const { esc, txt, txtList } = require('../../src/templates');

// Planes base y sus precios: placeholders editables desde el Builder. El precio viaja en
// `value` y `data-base` de cada <option>; el JS del cliente lee de ahí.
const PLANES = [
  { nombre: 'Plan básico', precio: 60000 },
  { nombre: 'Plan profesional', precio: 120000 },
  { nombre: 'Plan empresa', precio: 220000 },
];
// Adicionales de importe fijo. La etiqueta lleva el monto escrito a propósito: así el
// texto que ve el visitante y el número que suma la calculadora se editan juntos.
const EXTRAS = [
  { etiqueta: 'Soporte prioritario (+$25.000)', importe: 25000 },
  { etiqueta: 'Puesta en marcha (+$40.000)', importe: 40000 },
];
// Recargo porcentual (una sola opción: el JS busca un único [data-est-urgente])
const URGENTE = { etiqueta: 'Entrega urgente (+30%)', recargo: 0.3 };

// Defaults de los campos editables: exactamente los valores de arriba, para que el panel
// arranque mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const PLANES_DEFAULT = PLANES.map(p => `${p.nombre} | ${p.precio}`).join('\n');
const EXTRAS_DEFAULT = EXTRAS.map(e => `${e.etiqueta} | ${e.importe}`).join('\n');
const URGENTE_DEFAULT = `${URGENTE.etiqueta} | ${URGENTE.recargo}`;

// Convierte a número lo que escribió el cliente; si no parsea, queda el valor base.
function numero(s, base) {
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : base;
}

// Planes efectivos. Formatos por línea: "nombre | precio" o sólo "nombre".
function planes(cfg) {
  const lineas = txtList(cfg, 'estimator', 'planes', PLANES_DEFAULT);
  if (!lineas.length) return PLANES;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = PLANES[i % PLANES.length];
    return { nombre: partes[0], precio: partes.length >= 2 ? numero(partes[1], base.precio) : base.precio };
  });
}

// Adicionales efectivos. Formatos por línea: "etiqueta | importe" o sólo "etiqueta".
function extras(cfg) {
  const lineas = txtList(cfg, 'estimator', 'extras', EXTRAS_DEFAULT);
  if (!lineas.length) return EXTRAS;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = EXTRAS[i % EXTRAS.length];
    return { etiqueta: partes[0], importe: partes.length >= 2 ? numero(partes[1], base.importe) : base.importe };
  });
}

// Recargo por urgencia: se usa sólo la primera línea, porque el JS del cliente lee un
// único [data-est-urgente]. Formato: "etiqueta | recargo" (0.3 = 30%).
function urgente(cfg) {
  const lineas = txtList(cfg, 'estimator', 'urgente', URGENTE_DEFAULT);
  if (!lineas.length) return URGENTE;
  const partes = Array.isArray(lineas[0]) ? lineas[0] : [lineas[0]];
  return { etiqueta: partes[0], recargo: partes.length >= 2 ? numero(partes[1], URGENTE.recargo) : URGENTE.recargo };
}

// Calculadora de presupuesto estimado: el visitante elige tipo de servicio, cantidad
// y extras, y ve el precio estimado actualizarse en vivo. El número se anima (count-up)
// con Anime.js si está disponible; si no, se pinta directo (degradación limpia).
// Todo el cálculo es frontend puro: no envía nada al servidor ni depende de backend.
module.exports = {
  id: 'estimator', type: 'ui', name: 'Calculadora de presupuesto',
  description: 'Estimador de precio interactivo: el visitante elige servicio, cantidad y extras y ve el presupuesto actualizarse en vivo (número animado con Anime.js). Sin backend.',
  usesAnime: true,
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Calculá tu presupuesto', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'Estimá el costo en segundos. Es orientativo: el presupuesto final lo confirmamos con vos.', max: 220 },
    {
      key: 'planes', label: 'Planes y precios', type: 'list', max: 800, default: PLANES_DEFAULT,
      hint: 'Un plan por línea: nombre | precio base (sólo el número, sin $ ni puntos). Ejemplo: "Plan profesional | 120000".',
    },
    {
      key: 'extras', label: 'Adicionales', type: 'list', max: 800, default: EXTRAS_DEFAULT,
      hint: 'Un adicional por línea: etiqueta | importe (sólo el número). La etiqueta es lo que lee el visitante, así que conviene incluir el monto ahí también. Ejemplo: "Soporte prioritario (+$25.000) | 25000".',
    },
    {
      key: 'urgente', label: 'Recargo por urgencia', max: 200, default: URGENTE_DEFAULT,
      hint: 'Una sola línea: etiqueta | recargo, donde 0.3 significa +30%. Ejemplo: "Entrega urgente (+30%) | 0.3".',
    },
    { key: 'etiquetaTotal', label: 'Etiqueta del total', default: 'Presupuesto estimado', max: 80 },
    { key: 'boton', label: 'Texto del botón', default: 'Pedir presupuesto real', max: 60 },
  ],
  html: (cfg) => {
    // Botón "pedir presupuesto real" apunta a quote/contact si existen; si no, a Nosotros
    const href = cfg.moduleIds.includes('quote') ? '/quote.html'
      : cfg.moduleIds.includes('contact') ? '/contact.html' : '/about.html';
    const urg = urgente(cfg);
    return `  <section id="calculadora">
    <div class="container">
      <h2>${esc(txt(cfg, 'estimator', 'titulo', 'Calculá tu presupuesto'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'estimator', 'bajada', 'Estimá el costo en segundos. Es orientativo: el presupuesto final lo confirmamos con vos.'))}</p>
      <div class="est-card card" data-est>
        <div class="est-campos">
          <label class="est-campo">
            <span>Tipo de servicio</span>
            <select data-est-servicio>
              ${planes(cfg).map(p => `<option value="${esc(p.precio)}" data-base="${esc(p.precio)}">${esc(p.nombre)}</option>`).join('\n              ')}
            </select>
          </label>
          <label class="est-campo">
            <span>Cantidad / alcance: <b data-est-cant-val>1</b></span>
            <input type="range" data-est-cant min="1" max="10" step="1" value="1">
          </label>
          <fieldset class="est-extras">
            <legend>Adicionales</legend>
            ${extras(cfg).map(e => `<label><input type="checkbox" data-est-extra value="${esc(e.importe)}"> ${esc(e.etiqueta)}</label>`).join('\n            ')}
            <label><input type="checkbox" data-est-urgente value="${esc(urg.recargo)}"> ${esc(urg.etiqueta)}</label>
          </fieldset>
        </div>
        <div class="est-total" aria-live="polite">
          <span class="est-total-lbl">${esc(txt(cfg, 'estimator', 'etiquetaTotal', 'Presupuesto estimado'))}</span>
          <span class="est-total-num" data-est-total>$0</span>
          <a class="btn" href="${href}">${esc(txt(cfg, 'estimator', 'boton', 'Pedir presupuesto real'))}</a>
        </div>
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    .est-card{display:grid;grid-template-columns:1.3fr 1fr;gap:28px;align-items:stretch;max-width:840px;margin:24px auto 0}
    .est-campos{display:flex;flex-direction:column;gap:18px}
    .est-campo{display:flex;flex-direction:column;gap:6px;font-size:.92rem;font-weight:600}
    .est-campo select,.est-campo input[type=range]{width:100%}
    .est-extras{border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px;display:flex;flex-direction:column;gap:8px}
    .est-extras legend{font-size:.82rem;color:var(--muted);padding:0 6px}
    .est-extras label{display:flex;align-items:center;gap:8px;font-size:.88rem;font-weight:400}
    .est-total{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:22px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:12px}
    .est-total-lbl{font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
    .est-total-num{font-size:2.6rem;font-weight:800;line-height:1;color:var(--accent);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
    @media (max-width:640px){.est-card{grid-template-columns:1fr}}
  </style>`,
  clientJs: () => `// Módulo calculadora de presupuesto: recalcula el total en cada cambio de los
// controles y anima el número con Anime.js (window.anime) si la librería cargó.
// Sin JS queda "$0" y el botón: la sección no se rompe, sólo no calcula.
(function () {
  var raiz = document.querySelector('[data-est]');
  if (!raiz) return;
  var sel = raiz.querySelector('[data-est-servicio]');
  var cant = raiz.querySelector('[data-est-cant]');
  var cantVal = raiz.querySelector('[data-est-cant-val]');
  var extras = Array.prototype.slice.call(raiz.querySelectorAll('[data-est-extra]'));
  var urgente = raiz.querySelector('[data-est-urgente]');
  var salida = raiz.querySelector('[data-est-total]');
  if (!sel || !cant || !salida) return;

  // Formato de moneda local (es-AR): $ con separador de miles, sin decimales
  var fmt;
  try { fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }); }
  catch (e) { fmt = { format: function (n) { return '$' + Math.round(n).toLocaleString('es-AR'); } }; }

  var actual = 0;       // último valor mostrado (origen de la próxima animación)
  var animando = null;  // animación Anime.js en curso (para pausarla)
  var reafirmar = null; // red de seguridad: fuerza el valor final pase lo que pase

  function calcular() {
    var base = parseFloat(sel.value) || 0;
    var q = parseInt(cant.value, 10) || 1;
    var total = base * q;
    extras.forEach(function (ch) { if (ch.checked) total += parseFloat(ch.value) || 0; });
    if (urgente && urgente.checked) total *= (1 + (parseFloat(urgente.value) || 0));
    return Math.round(total);
  }

  function pintar(n) { salida.textContent = fmt.format(Math.round(n)); }
  function fijar(destino) { actual = destino; pintar(destino); }

  function actualizar() {
    if (cantVal) cantVal.textContent = cant.value;
    var destino = calcular();
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var anime = window.anime;
    // Con Anime.js y sin preferencia de menos movimiento: count-up animado desde el valor
    // actualmente mostrado hasta el destino. onUpdate pinta cada frame; onComplete cierra.
    if (anime && anime.animate && !reduce) {
      if (animando && animando.pause) animando.pause();
      var estado = { v: actual };
      animando = anime.animate(estado, {
        v: destino, duration: 550,
        onUpdate: function () { pintar(estado.v); },
        onComplete: function () { fijar(destino); }
      });
      // Red de seguridad (igual que el módulo reveal): si el motor de animación no
      // corre —pestaña oculta, tab en segundo plano— igual mostramos el valor final.
      if (reafirmar) clearTimeout(reafirmar);
      reafirmar = setTimeout(function () { fijar(destino); }, 650);
    } else {
      // Sin librería (o menos movimiento): salto directo al valor final
      fijar(destino);
    }
  }

  sel.addEventListener('change', actualizar);
  cant.addEventListener('input', actualizar);
  extras.forEach(function (ch) { ch.addEventListener('change', actualizar); });
  if (urgente) urgente.addEventListener('change', actualizar);
  actualizar();
})();`,
  readmeNotes: () => [
    '**Calculadora de presupuesto**: los precios base de los planes, los adicionales y el recargo por urgencia salen del bloque *Textos por sección* del Builder; si no los editaste, son placeholders. También podés ajustarlos después en la sección `calculadora` de `public/index.html` (atributos `value`/`data-base` de los `<option>` y los checkboxes). El total es orientativo y no se envía a ningún lado.',
  ],
};
