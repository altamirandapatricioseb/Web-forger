const { esc, txt } = require('../../src/templates');

// Formulario que arma un mensaje de WhatsApp: el visitante completa nombre, contacto y
// consulta, y al enviar se abre WhatsApp (wa.me) con todo el texto prellenado hacia el
// número del negocio. No necesita backend ni API keys: es 100% frontend, ideal para
// captar consultas en sitios chicos deployados gratis. Distinto del botón flotante de
// WhatsApp (ese sólo abre un chat vacío; este manda los datos del formulario).
module.exports = {
  id: 'whatsappform', type: 'ui', name: 'Formulario a WhatsApp',
  description: 'Formulario de contacto que, al enviar, abre WhatsApp con el mensaje ya armado (nombre, contacto y consulta) hacia el número del negocio. Sin backend ni API keys. El número se configura en public/js/app.js.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Escribinos por WhatsApp', max: 80 },
    { key: 'bajada', label: 'Bajada', type: 'textarea', default: 'Completá tus datos y se abrirá WhatsApp con tu consulta lista para enviar.', max: 220 },
    { key: 'phNombre', label: 'Ejemplo dentro del campo Nombre', default: 'Tu nombre', max: 60 },
    { key: 'phContacto', label: 'Ejemplo dentro del campo Teléfono o email', default: 'Para que podamos responderte', max: 80 },
    { key: 'phMensaje', label: 'Ejemplo dentro del campo Consulta', default: 'Contanos en qué podemos ayudarte', max: 80 },
    { key: 'boton', label: 'Texto del botón', default: 'Enviar por WhatsApp', max: 40 },
    { key: 'errorNombre', label: 'Aviso si falta el nombre', default: 'Ingresá tu nombre.', max: 120 },
    { key: 'errorMensaje', label: 'Aviso si falta la consulta', default: 'Escribí tu consulta.', max: 120 },
    { key: 'aviso', label: 'Mensaje al abrir WhatsApp', default: 'Abriendo WhatsApp con tu consulta…', max: 120 },
  ],
  html: (cfg) => `  <section id="whatsapp-form">
    <div class="container" style="max-width:560px">
      <h2>${esc(txt(cfg, 'whatsappform', 'titulo', 'Escribinos por WhatsApp'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'whatsappform', 'bajada', 'Completá tus datos y se abrirá WhatsApp con tu consulta lista para enviar.'))}</p>
      <form class="waform card" novalidate>
        <label>Nombre
          <input type="text" name="nombre" required autocomplete="name" placeholder="${esc(txt(cfg, 'whatsappform', 'phNombre', 'Tu nombre'))}">
        </label>
        <label>Teléfono o email <span class="muted">(opcional)</span>
          <input type="text" name="contacto" autocomplete="tel" placeholder="${esc(txt(cfg, 'whatsappform', 'phContacto', 'Para que podamos responderte'))}">
        </label>
        <label>Consulta
          <textarea name="mensaje" rows="4" required placeholder="${esc(txt(cfg, 'whatsappform', 'phMensaje', 'Contanos en qué podemos ayudarte'))}"></textarea>
        </label>
        <p class="waform-error muted" hidden></p>
        <button class="btn" type="submit">${esc(txt(cfg, 'whatsappform', 'boton', 'Enviar por WhatsApp'))}</button>
      </form>
    </div>
  </section>`,
  head: () => `  <style>
    #whatsapp-form .waform{display:grid;gap:14px}
    #whatsapp-form .waform label{display:block;font-weight:600;font-size:.95rem}
    #whatsapp-form .waform input,#whatsapp-form .waform textarea{margin-top:6px;font-weight:400}
    #whatsapp-form .waform-error[hidden]{display:none}
    #whatsapp-form .waform-error{color:#b91c1c;font-weight:600}
    #whatsapp-form .waform .btn{justify-self:start;display:inline-flex;align-items:center;gap:8px;background:#25d366}
    #whatsapp-form .waform .btn svg{width:18px;height:18px;fill:#fff}
  </style>`,
  clientJs: (cfg) => `/* Módulo formulario a WhatsApp: valida los campos y abre wa.me con el mensaje armado.
   Sin backend: sólo el link público de WhatsApp. Editá el número más abajo. */
(function () {
  var form = document.querySelector('#whatsapp-form .waform');
  if (!form) return;
  // IMPORTANTE — ACCIÓN REQUERIDA: reemplazá por el número real (formato internacional, sin + ni espacios)
  var NUMERO_WHATSAPP = '5491100000000';
  var marca = ${JSON.stringify(cfg.brand.name)};
  // Avisos del formulario: van por JSON.stringify porque viajan adentro de este string de JS
  var MSG_NOMBRE = ${JSON.stringify(txt(cfg, 'whatsappform', 'errorNombre', 'Ingresá tu nombre.'))};
  var MSG_MENSAJE = ${JSON.stringify(txt(cfg, 'whatsappform', 'errorMensaje', 'Escribí tu consulta.'))};
  var MSG_AVISO = ${JSON.stringify(txt(cfg, 'whatsappform', 'aviso', 'Abriendo WhatsApp con tu consulta…'))};
  var error = form.querySelector('.waform-error');
  // Agrega el ícono de WhatsApp al botón
  var btn = form.querySelector('button[type="submit"]');
  if (btn) btn.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.2 1.6 6L4 29l8.2-1.5c1.2.5 2.5.7 3.8.7 6.6 0 12-5.4 12-12S22.6 3 16 3z"/></svg>');
  function mostrarError(msg) {
    if (!error) return;
    error.textContent = msg;
    error.hidden = false;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (error) error.hidden = true;
    var nombre = (form.nombre.value || '').trim();
    var contacto = (form.contacto.value || '').trim();
    var mensaje = (form.mensaje.value || '').trim();
    if (!nombre) { mostrarError(MSG_NOMBRE); form.nombre.focus(); return; }
    if (!mensaje) { mostrarError(MSG_MENSAJE); form.mensaje.focus(); return; }
    // Arma el texto del mensaje con saltos de línea
    var texto = '¡Hola ' + marca + '! Soy ' + nombre + '.';
    texto += '\\n\\n' + mensaje;
    if (contacto) texto += '\\n\\nMi contacto: ' + contacto;
    var url = 'https://wa.me/' + NUMERO_WHATSAPP + '?text=' + encodeURIComponent(texto);
    window.open(url, '_blank', 'noopener');
    if (window.App && App.toast) App.toast(MSG_AVISO);
  });
})();`,
  readmeNotes: () => [
    '**Formulario a WhatsApp**: reemplazá el número de ejemplo en `public/js/app.js` (constante `NUMERO_WHATSAPP` del módulo, formato internacional sin `+` ni espacios, ej. `5491122334455`). El formulario no usa backend: arma el mensaje y abre `wa.me` con el texto prellenado.',
  ],
};
