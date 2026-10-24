module.exports = {
  id: 'contactbar', type: 'ui', name: 'Barra de contacto móvil',
  description: 'Barra fija inferior, solo visible en celulares, con acciones de un toque: llamar, WhatsApp y cómo llegar. Datos configurables en public/js/app.js.',
  readmeNotes: () => [
    '**Barra de contacto móvil**: reemplazá los datos de ejemplo en `public/js/app.js` (constantes `TELEFONO`, `NUMERO_WHATSAPP` y `DIRECCION`, buscá "módulo barra de contacto"). La barra solo se ve en pantallas de hasta 768px; en escritorio no aparece.',
  ],
  clientJs: (cfg) => `/* Módulo barra de contacto móvil: acciones de un toque (llamar / WhatsApp / cómo llegar)
   fijas abajo, solo en celulares. Los otros flotantes (WhatsApp, volver arriba, accesibilidad,
   cookies) se reacomodan por CSS para no quedar tapados por la barra. */
(function () {
  // IMPORTANTE — ACCIÓN REQUERIDA: reemplazá por los datos reales del negocio
  var TELEFONO = '+541100000000';                       // con código de país, sin espacios
  var NUMERO_WHATSAPP = '5491100000000';                // formato internacional sin + ni espacios
  var DIRECCION = 'Av. Siempre Viva 123, Tu Ciudad';    // como la buscarías en Google Maps
  var mensaje = ${JSON.stringify(`¡Hola ${cfg.brand.name}! Quiero hacer una consulta.`)};
  var style = document.createElement('style');
  style.textContent = '.contactbar{display:none}' +
    '@media (max-width:768px){' +
    '.contactbar{position:fixed;left:0;right:0;bottom:0;z-index:45;display:flex;background:var(--bg);border-top:1px solid var(--line);box-shadow:0 -4px 16px rgba(0,0,0,.08)}' +
    '.contactbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 4px 8px;color:var(--text);text-decoration:none;font-size:.72rem;font-weight:600}' +
    '.contactbar a + a{border-left:1px solid var(--line)}' +
    '.contactbar svg{width:20px;height:20px;fill:var(--accent)}' +
    'body{padding-bottom:58px}' +
    // Convivencia: la barra ya incluye WhatsApp, así que el flotante sobra en el celular;
    // el resto de los flotantes sube por encima de la barra
    '.whatsapp-fab{display:none!important}' +
    '.backtotop{bottom:76px!important}' +
    '#a11y-boton{bottom:76px!important}' +
    '[aria-label="Preferencias de accesibilidad"]{bottom:132px!important}' +
    '.cookie-banner{bottom:66px!important}' +
    '}';
  document.head.appendChild(style);
  var barra = document.createElement('nav');
  barra.className = 'contactbar';
  barra.setAttribute('aria-label', 'Contacto rápido');
  barra.innerHTML =
    '<a href="tel:' + TELEFONO + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>Llamar</a>' +
    '<a href="https://wa.me/' + NUMERO_WHATSAPP + '?text=' + encodeURIComponent(mensaje) + '" target="_blank" rel="noopener"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.2 1.6 6L4 29l8.2-1.5c1.2.5 2.5.7 3.8.7 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.2 0-2.4-.2-3.5-.7l-.5-.2-4.9.9 1-4.7-.3-.5c-1-1.6-1.5-3.4-1.5-5.3 0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.4 9.8-9.9 9.8zm5.4-7.3c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1-1.1 2.5s1.1 2.9 1.3 3.1c.2.2 2.2 3.4 5.4 4.8.8.3 1.3.5 1.8.7.8.2 1.5.2 2 .1.6-.1 1.8-.7 2.1-1.5.3-.7.3-1.3.2-1.5-.1-.1-.3-.2-.6-.3z"/></svg>WhatsApp</a>' +
    '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(DIRECCION) + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>Cómo llegar</a>';
  document.body.appendChild(barra);
})();`,
};
