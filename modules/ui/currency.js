const { esc } = require('../../src/templates');

// Selector de moneda: convierte en vivo cualquier importe marcado con la clase
// "js-precio" y un atributo data-ars (monto base en pesos argentinos). Las monedas
// y sus tasas se editan en la constante MONEDAS (frontend puro, sin API de cambio:
// deployable gratis). La elección se recuerda en localStorage. Trae una lista de
// precios de demostración para que el módulo se vea y se pueda probar solo; en un
// sitio real basta con poner class="js-precio" data-ars="1000" en tus precios.
// Mejora progresiva: sin JS se ve el importe base en pesos.
const MONEDAS = [
  // codigo: ISO; simbolo: prefijo mostrado; tasa: cuántas unidades de la moneda vale 1 ARS;
  // decimales: cuántos decimales mostrar. Actualizá las tasas según tu mercado.
  { codigo: 'ARS', etiqueta: 'ARS $', simbolo: '$', tasa: 1, decimales: 0 },
  { codigo: 'USD', etiqueta: 'USD u$s', simbolo: 'u$s ', tasa: 0.00083, decimales: 2 },
  { codigo: 'EUR', etiqueta: 'EUR €', simbolo: '€ ', tasa: 0.00077, decimales: 2 },
  { codigo: 'BRL', etiqueta: 'BRL R$', simbolo: 'R$ ', tasa: 0.0046, decimales: 2 },
];

const DEMO = [
  { titulo: 'Plan básico', ars: 9999 },
  { titulo: 'Plan profesional', ars: 24999 },
  { titulo: 'Plan empresa', ars: 59999 },
];

module.exports = {
  id: 'currency', type: 'ui', name: 'Selector de moneda',
  description: 'Convierte en vivo los precios marcados (class="js-precio" data-ars) a distintas monedas con tasas fijas editables. Frontend puro, recuerda la elección en localStorage.',
  html: () => {
    const tarjetas = DEMO.map(d => `        <div class="card" style="text-align:center">
          <h3 style="margin:.2rem 0 .4rem">${esc(d.titulo)}</h3>
          <p class="price js-precio" data-ars="${d.ars}">$${Number(d.ars).toLocaleString('es-AR')}</p>
        </div>`).join('\n');
    return `  <section id="moneda">
    <div class="container">
      <h2>Precios en tu moneda</h2>
      <p class="section-sub">Elegí la moneda con la que preferís ver nuestros precios.</p>
      <div class="moneda-switch" id="moneda-switch" role="group" aria-label="Elegir moneda"></div>
      <div class="grid cols-3" style="margin-top:24px">
${tarjetas}
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    .moneda-switch{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;background:var(--surface);border:1px solid var(--line);border-radius:999px}
    .moneda-switch button{width:auto;background:none;border:0;padding:8px 16px;border-radius:999px;font:inherit;font-weight:600;color:var(--muted);cursor:pointer}
    .moneda-switch button[aria-pressed="true"]{background:var(--accent);color:#fff}
  </style>`,
  clientJs: () => `/* Módulo selector de moneda: convierte todos los .js-precio[data-ars] leyendo el
   monto base en pesos y aplicando la tasa de la moneda elegida. Las tasas se editan
   en la constante MONEDAS de modules/ui/currency.js. */
(function () {
  var switcher = document.getElementById('moneda-switch');
  if (!switcher) return;
  // Los precios se buscan cada vez y no se cachean: otros módulos (planes, catálogo) pueden
  // pintar importes después de que este JS corrió, y también tienen que convertirse.
  var listaPrecios = function () { return document.querySelectorAll('.js-precio[data-ars]'); };
  // Config replicada desde el módulo (mismo orden y valores). El módulo "cambio" (backend de
  // cotizaciones) la reemplaza en vivo por las tasas que carga el negocio.
  var MONEDAS = ${JSON.stringify(MONEDAS)};
  var GUARDA = 'moneda-preferida';
  var actual = localStorage.getItem(GUARDA) || MONEDAS[0].codigo;
  if (!MONEDAS.some(function (m) { return m.codigo === actual; })) actual = MONEDAS[0].codigo;

  function formatear(ars, m) {
    var valor = Number(ars) * m.tasa;
    var num = valor.toLocaleString('es-AR', { minimumFractionDigits: m.decimales, maximumFractionDigits: m.decimales });
    return m.simbolo + num;
  }
  function aplicar(codigo) {
    var m = MONEDAS.filter(function (x) { return x.codigo === codigo; })[0] || MONEDAS[0];
    actual = m.codigo;
    listaPrecios().forEach(function (p) {
      var texto = formatear(p.dataset.ars, m);
      // Conserva cualquier sufijo (ej: "/mes") que venga en un <span class="price-per"> hijo
      var sufijo = p.querySelector('.price-per');
      if (sufijo) {
        while (p.firstChild && p.firstChild !== sufijo) p.removeChild(p.firstChild);
        p.insertBefore(document.createTextNode(texto), sufijo);
      } else {
        p.textContent = texto;
      }
    });
    Array.prototype.forEach.call(switcher.children, function (b) {
      b.setAttribute('aria-pressed', b.dataset.codigo === codigo ? 'true' : 'false');
    });
    localStorage.setItem(GUARDA, codigo);
  }
  // Los botones se repintan enteros cuando cambian las monedas (el módulo "cambio" puede
  // agregar, sacar o renombrar una): así nunca queda un botón de una moneda que ya no existe.
  function pintarBotones() {
    switcher.innerHTML = '';
    MONEDAS.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.codigo = m.codigo;
      b.textContent = m.etiqueta;
      b.setAttribute('aria-pressed', m.codigo === actual ? 'true' : 'false');
      b.addEventListener('click', function () { aplicar(m.codigo); });
      switcher.appendChild(b);
    });
  }
  pintarBotones();
  aplicar(actual);

  // Punto de entrada para quien administre las cotizaciones en vivo (módulo "cambio").
  // Si la moneda elegida por el visitante ya no está en la lista nueva, se cae a la primera.
  window.WFMoneda = {
    setMonedas: function (lista) {
      if (!lista || !lista.length) return;
      MONEDAS = lista;
      if (!MONEDAS.some(function (m) { return m.codigo === actual; })) actual = MONEDAS[0].codigo;
      pintarBotones();
      aplicar(actual);
    },
    refrescar: function () { aplicar(actual); },
  };
})();`,
  readmeNotes: () => [
    '**Selector de moneda**: las monedas y sus tasas de cambio se editan en la constante `MONEDAS` de `modules/ui/currency.js` (son tasas fijas, sin API externa: actualizalas cuando cambie el mercado). Para que un precio se convierta, agregale `class="js-precio"` y `data-ars="MONTO"` (monto base en pesos) al elemento.',
  ],
};
