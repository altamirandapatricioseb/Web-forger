const { txt } = require('../../src/templates');

module.exports = {
  id: 'announcement', type: 'ui', name: 'Barra de anuncios',
  description: 'Barra superior de promoción con cuenta regresiva (hasta el domingo) y botón de cierre que se recuerda en localStorage. Presente en todas las páginas.',
  fields: [
    { key: 'mensaje', label: 'Texto del anuncio', type: 'textarea', default: 'Envío gratis en compras superiores a $50.000 — solo hasta el domingo', max: 200 },
    { key: 'etiquetaTiempo', label: 'Texto antes de la cuenta regresiva', default: 'Termina en', max: 40 },
    { key: 'cerrarAria', label: 'Descripción del botón de cierre para lectores de pantalla', default: 'Cerrar anuncio', max: 60 },
  ],
  // Los textos viajan adentro de un string de JS: JSON.stringify, nunca esc()
  clientJs: (cfg) => `/* Módulo barra de anuncios: promo con countdown y cierre recordado.
   El texto sale del Builder y queda horneado en MENSAJE; si lo cambiás, la barra vuelve a
   aparecer aunque el visitante la haya cerrado antes (el cierre se guarda por mensaje). */
(function () {
  var MENSAJE = ${JSON.stringify(txt(cfg, 'announcement', 'mensaje', 'Envío gratis en compras superiores a $50.000 — solo hasta el domingo'))};
  var ETIQUETA_TIEMPO = ${JSON.stringify(txt(cfg, 'announcement', 'etiquetaTiempo', 'Termina en'))};
  // Si el visitante ya cerró ESTE mensaje, no se vuelve a mostrar
  try { if (localStorage.getItem('announce-cerrado') === MENSAJE) return; } catch (e) {}
  var style = document.createElement('style');
  style.textContent = '.announce{background:var(--accent);color:#fff;font-size:.9rem;text-align:center;' +
    'padding:9px 44px 9px 16px;position:relative}' +
    '.announce b{font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.announce button{position:absolute;right:10px;top:50%;transform:translateY(-50%);border:0;' +
    'background:transparent;color:#fff;font-size:1.1rem;cursor:pointer;line-height:1;padding:4px 8px}';
  document.head.appendChild(style);
  var bar = document.createElement('div');
  bar.className = 'announce';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Anuncio');
  var texto = document.createElement('span');
  texto.textContent = MENSAJE + ' · ';
  var reloj = document.createElement('b');
  var cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.textContent = '×';
  cerrar.setAttribute('aria-label', ${JSON.stringify(txt(cfg, 'announcement', 'cerrarAria', 'Cerrar anuncio'))});
  bar.appendChild(texto);
  bar.appendChild(reloj);
  bar.appendChild(cerrar);
  // Va antes de la navbar; como la navbar es sticky, la barra scrollea y la navbar queda
  document.body.insertBefore(bar, document.body.firstChild);
  cerrar.addEventListener('click', function () {
    bar.remove();
    clearInterval(timer);
    try { localStorage.setItem('announce-cerrado', MENSAJE); } catch (e) {}
  });
  // Cuenta regresiva hasta el próximo domingo a la medianoche (se renueva sola cada semana)
  function proximoDomingo() {
    var d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
    d.setHours(23, 59, 59, 999);
    if (d - new Date() <= 0) d.setDate(d.getDate() + 7);
    return d;
  }
  var limite = proximoDomingo();
  var dosDigitos = function (n) { return (n < 10 ? '0' : '') + n; };
  function tick() {
    var resta = limite - new Date();
    if (resta <= 0) { limite = proximoDomingo(); resta = limite - new Date(); }
    var s = Math.floor(resta / 1000);
    var dias = Math.floor(s / 86400);
    var horas = Math.floor((s % 86400) / 3600);
    var min = Math.floor((s % 3600) / 60);
    var seg = s % 60;
    reloj.textContent = ETIQUETA_TIEMPO + ' ' + (dias ? dias + 'd ' : '') + dosDigitos(horas) + ':' + dosDigitos(min) + ':' + dosDigitos(seg);
  }
  tick();
  var timer = setInterval(tick, 1000);
})();`,
  readmeNotes: () => [
    '**Barra de anuncios**: el texto de la promo sale del Builder (bloque *Textos por sección*) y queda horneado en la constante `MENSAJE` de `public/js/app.js` (buscá "barra de anuncios"), donde también se puede retocar después. La cuenta regresiva apunta al próximo domingo y se renueva sola.',
  ],
};
