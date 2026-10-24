const { esc, txt, txtList } = require('../../src/templates');

// Etiquetas por defecto de las cuatro cajas, en el orden en que se muestran.
const ETIQUETAS = ['Días', 'Horas', 'Minutos', 'Segundos'];

// Cuenta regresiva a un evento/lanzamiento. La fecha objetivo se pone en data-fecha.
// Si no hay fecha (o ya pasó), cae a fin del mes actual: así siempre cuenta en vivo.
module.exports = {
  id: 'countdown', type: 'ui', name: 'Cuenta regresiva',
  description: 'Contador regresivo a un evento o lanzamiento (días, horas, minutos, segundos). Fecha configurable; por defecto cuenta hasta fin de mes.',
  fields: [
    { key: 'titulo', label: 'Título', default: 'Falta muy poco', max: 80 },
    // Vacío por defecto porque el texto original lleva el nombre de la marca, que recién se
    // conoce al generar: si el cliente no escribe nada, sigue saliendo la frase de siempre.
    { key: 'bajada', label: 'Bajada', type: 'textarea', default: '', max: 220, hint: 'Si lo dejás vacío se usa "Aprovechá <tu marca> antes de que termine la oferta.".' },
    { key: 'etiquetas', label: 'Etiquetas de las cajas', type: 'list', default: ETIQUETAS.join('\n'), max: 120, hint: 'Cuatro líneas, en orden: días, horas, minutos y segundos.' },
    { key: 'final', label: 'Mensaje cuando llega la fecha', default: '¡Ya llegó el día!', max: 80 },
    { key: 'boton', label: 'Texto del botón', default: 'Quiero aprovechar', max: 40 },
  ],
  html: (cfg) => {
    // El botón lleva a contacto si existe; si no, a Nosotros (siempre presente)
    const href = cfg.moduleIds.includes('contact') ? '/contact.html' : '/about.html';
    // Si el cliente carga menos de cuatro líneas, las que falten vuelven a la etiqueta original
    // txtList parte por "|", pero acá no hay columnas: si alguien usa esa barra en una
    // etiqueta, se vuelve a unir tal cual la escribió en vez de salir con comas.
    const lbls = txtList(cfg, 'countdown', 'etiquetas', ETIQUETAS.join('\n'))
      .map(l => Array.isArray(l) ? l.join(' | ') : l);
    const etiqueta = (i) => esc(lbls[i] == null ? ETIQUETAS[i] : lbls[i]);
    const caja = (u, lbl) => `<div class="cd-box">
          <span class="cd-num" data-u="${u}">00</span>
          <span class="cd-lbl">${lbl}</span>
        </div>`;
    return `  <section id="cuenta-regresiva">
    <div class="container">
      <div class="cd" data-cd data-fecha="" style="text-align:center">
        <h2>${esc(txt(cfg, 'countdown', 'titulo', 'Falta muy poco'))}</h2>
        <p class="section-sub" style="margin-left:auto;margin-right:auto">${esc(txt(cfg, 'countdown', 'bajada', `Aprovechá ${cfg.brand.name} antes de que termine la oferta.`))}</p>
        <div class="cd-grid" role="timer" aria-label="Cuenta regresiva">
          ${caja('d', etiqueta(0))}
          ${caja('h', etiqueta(1))}
          ${caja('m', etiqueta(2))}
          ${caja('s', etiqueta(3))}
        </div>
        <p class="cd-done" hidden>${esc(txt(cfg, 'countdown', 'final', '¡Ya llegó el día!'))}</p>
        <p style="margin-top:24px"><a class="btn" href="${href}">${esc(txt(cfg, 'countdown', 'boton', 'Quiero aprovechar'))}</a></p>
      </div>
    </div>
  </section>`;
  },
  clientJs: () => `// Módulo cuenta regresiva: tick por segundo hasta la fecha objetivo.
// Sin JS quedan los ceros y el botón: la sección no se ve rota.
(function () {
  var raiz = document.querySelector('.cd[data-cd]');
  if (!raiz) return;
  var estilo = document.createElement('style');
  estilo.textContent = '.cd-grid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin:8px 0 4px}' +
    '.cd-box{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);' +
    'min-width:88px;padding:16px 10px}' +
    '.cd-num{display:block;font-size:2.4rem;font-weight:800;line-height:1;letter-spacing:-.02em;' +
    'color:var(--accent);font-variant-numeric:tabular-nums}' +
    '.cd-lbl{display:block;margin-top:6px;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}' +
    '.cd-done{font-size:1.4rem;font-weight:700;color:var(--accent);margin:8px 0}';
  document.head.appendChild(estilo);
  var nums = {};
  raiz.querySelectorAll('.cd-num').forEach(function (el) { nums[el.dataset.u] = el; });
  var grid = raiz.querySelector('.cd-grid');
  var doneMsg = raiz.querySelector('.cd-done');
  var dos = function (n) { return (n < 10 ? '0' : '') + n; };
  // Fin del mes actual a las 23:59:59; si ya pasó, fin del mes que viene
  function finDeMes() {
    var d = new Date();
    var t = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    if (t - d <= 0) t = new Date(d.getFullYear(), d.getMonth() + 2, 0, 23, 59, 59, 999);
    return t;
  }
  // La fecha de data-fecha manda si es válida y futura; si no, se usa el fin de mes
  var objetivo;
  var attr = (raiz.dataset.fecha || '').trim();
  if (attr) {
    var parsed = new Date(attr);
    objetivo = (!isNaN(parsed) && parsed - new Date() > 0) ? parsed : finDeMes();
  } else {
    objetivo = finDeMes();
  }
  var timer;
  function tick() {
    var resta = objetivo - new Date();
    if (resta <= 0) {
      clearInterval(timer);
      if (grid) grid.hidden = true;
      if (doneMsg) doneMsg.hidden = false;
      return;
    }
    var s = Math.floor(resta / 1000);
    if (nums.d) nums.d.textContent = dos(Math.floor(s / 86400));
    if (nums.h) nums.h.textContent = dos(Math.floor((s % 86400) / 3600));
    if (nums.m) nums.m.textContent = dos(Math.floor((s % 3600) / 60));
    if (nums.s) nums.s.textContent = dos(s % 60);
  }
  tick();
  timer = setInterval(tick, 1000);
})();`,
  readmeNotes: () => [
    '**Cuenta regresiva**: los textos (título, bajada, etiquetas, botón y mensaje final) salen del Builder (bloque *Textos por sección*). Por defecto cuenta hasta fin del mes actual. Para apuntar a un evento fijo, poné la fecha en el atributo `data-fecha` del div `cd` en la sección `cuenta-regresiva` (`public/index.html`), por ejemplo `data-fecha="2026-12-31T20:00"`.',
  ],
};
