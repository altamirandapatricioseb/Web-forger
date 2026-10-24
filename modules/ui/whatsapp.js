const { txt } = require('../../src/templates');

module.exports = {
  id: 'whatsapp', type: 'ui', name: 'Botón de WhatsApp',
  description: 'Botón flotante de WhatsApp en todas las páginas, con mensaje prellenado. El número se configura en public/js/app.js.',
  fields: [
    // Vacío por defecto porque el mensaje original lleva el nombre de la marca, que recién se
    // conoce al generar: si el cliente no escribe nada, sigue saliendo la frase de siempre.
    { key: 'mensaje', label: 'Mensaje prellenado del chat', type: 'textarea', default: '', max: 200, hint: 'Si lo dejás vacío se usa "¡Hola <tu marca>! Quiero hacer una consulta.".' },
    { key: 'aria', label: 'Descripción del botón para lectores de pantalla', default: 'Chatear por WhatsApp', max: 60 },
  ],
  readmeNotes: () => [
    '**WhatsApp**: reemplazá el número de ejemplo en `public/js/app.js` (constante `NUMERO_WHATSAPP`, formato internacional sin `+` ni espacios, ej. `5491122334455`). El mensaje prellenado sale del Builder (bloque *Textos por sección*).',
  ],
  clientJs: (cfg) => `/* Módulo botón de WhatsApp: flotante en todas las páginas, abre un chat con mensaje prellenado.
   Sin SDKs: solo el link público wa.me. Verde oficial de WhatsApp, independiente de la paleta. */
(function () {
  // IMPORTANTE — ACCIÓN REQUERIDA: reemplazá por el número real (formato internacional, sin + ni espacios)
  var NUMERO_WHATSAPP = '5491100000000';
  var mensaje = ${JSON.stringify(txt(cfg, 'whatsapp', 'mensaje', `¡Hola ${cfg.brand.name}! Quiero hacer una consulta.`))};
  var style = document.createElement('style');
  style.textContent = '.whatsapp-fab{position:fixed;right:18px;bottom:18px;z-index:30;width:54px;height:54px;' +
    'display:flex;align-items:center;justify-content:center;border-radius:50%;background:#25d366;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.25);transition:transform .15s ease}' +
    '.whatsapp-fab:hover{transform:scale(1.08)}' +
    '.whatsapp-fab svg{width:30px;height:30px;fill:#fff}';
  document.head.appendChild(style);
  var fab = document.createElement('a');
  fab.id = 'whatsapp-fab';
  fab.className = 'whatsapp-fab';
  fab.href = 'https://wa.me/' + NUMERO_WHATSAPP + '?text=' + encodeURIComponent(mensaje);
  fab.target = '_blank';
  fab.rel = 'noopener';
  fab.setAttribute('aria-label', ${JSON.stringify(txt(cfg, 'whatsapp', 'aria', 'Chatear por WhatsApp'))});
  fab.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.2 1.6 6L4 29l8.2-1.5c1.2.5 2.5.7 3.8.7 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.2 0-2.4-.2-3.5-.7l-.5-.2-4.9.9 1-4.7-.3-.5c-1-1.6-1.5-3.4-1.5-5.3 0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.4 9.8-9.9 9.8zm5.4-7.3c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1-1.1 2.5s1.1 2.9 1.3 3.1c.2.2 2.2 3.4 5.4 4.8.8.3 1.3.5 1.8.7.8.2 1.5.2 2 .1.6-.1 1.8-.7 2.1-1.5.3-.7.3-1.3.2-1.5-.1-.1-.3-.2-.6-.3z"/></svg>';
  document.body.appendChild(fab);
  // Convivencia con el botón "volver arriba": WhatsApp queda abajo, el otro sube
  var arriba = document.getElementById('backtotop-btn');
  if (arriba) arriba.style.bottom = '84px';
})();`,
};
