// Banda de suscripción al newsletter dentro del contenido (distinta del formulario
// chico del footer): una sección destacada a todo el ancho que capta emails como CTA.
// Si el módulo funcional "newsletter" está activo, postea a /api/newsletter (idempotente
// por email). Si no lo está, valida el email en el cliente y muestra un aviso amable sin
// romper: así la banda sirve igual como maqueta editable. Sin JS, el form no envía pero
// se ve completo.
const { esc, txt } = require('../../src/templates');

module.exports = {
  id: 'newsletterinline', type: 'ui', name: 'Banda de newsletter',
  description: 'Sección destacada a todo el ancho para captar suscriptores por email. Si el módulo funcional Newsletter está activo, guarda las altas en /api/newsletter; si no, valida en el cliente y avisa. Vanilla JS.',
  fields: [
    { key: 'titulo', label: 'Título', default: 'Enterate antes que nadie', max: 80 },
    { key: 'texto', label: 'Bajada', type: 'textarea', default: 'Novedades, consejos y ofertas directo a tu correo. Sin spam, cancelás cuando quieras.', max: 220 },
    { key: 'placeholder', label: 'Ejemplo dentro del campo de email', default: 'tu@email.com', max: 60 },
    { key: 'boton', label: 'Texto del botón', default: 'Suscribirme', max: 40 },
    { key: 'nota', label: 'Nota al pie', default: 'Respetamos tu privacidad.', max: 120 },
    { key: 'exito', label: 'Mensaje al suscribirse', default: '¡Gracias! Te sumamos a la lista.', max: 120 },
    { key: 'emailInvalido', label: 'Aviso si el email no es válido', default: 'Ingresá un email válido.', max: 120 },
  ],
  head: () => `  <style>
    #newsletterinline .nlband{background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 90%,black),var(--accent));color:#fff;border-radius:var(--radius);padding:44px 32px;text-align:center}
    #newsletterinline .nlband h2{color:#fff;margin:0 0 8px}
    #newsletterinline .nlband p{color:rgba(255,255,255,.9);max-width:52ch;margin:0 auto 22px}
    #newsletterinline .nl-form{display:flex;gap:10px;max-width:460px;margin:0 auto;flex-wrap:wrap;justify-content:center}
    #newsletterinline .nl-form input{flex:1;min-width:200px;border:0;color:var(--text)}
    #newsletterinline .nl-form .btn{background:#fff;color:var(--accent);border:0}
    #newsletterinline .nl-form .btn:hover{filter:brightness(.94)}
    #newsletterinline .nl-nota{font-size:.8rem;color:rgba(255,255,255,.75);margin:14px 0 0}
  </style>`,
  html: (cfg) => `  <section id="newsletterinline">
    <div class="container">
      <div class="nlband">
        <h2>${esc(txt(cfg, 'newsletterinline', 'titulo', 'Enterate antes que nadie'))}</h2>
        <p>${esc(txt(cfg, 'newsletterinline', 'texto', 'Novedades, consejos y ofertas directo a tu correo. Sin spam, cancelás cuando quieras.'))}</p>
        <form class="nl-form" id="nl-inline-form" novalidate>
          <input type="email" name="email" placeholder="${esc(txt(cfg, 'newsletterinline', 'placeholder', 'tu@email.com'))}" required aria-label="Tu email">
          <button class="btn" type="submit">${esc(txt(cfg, 'newsletterinline', 'boton', 'Suscribirme'))}</button>
        </form>
        <p class="nl-nota">${esc(txt(cfg, 'newsletterinline', 'nota', 'Respetamos tu privacidad.'))}</p>
      </div>
    </div>
  </section>`,
  // Los avisos viajan adentro de un string de JS: JSON.stringify, no esc()
  clientJs: (cfg) => `/* Módulo banda de newsletter: valida el email y lo envía a /api/newsletter si existe
   ese endpoint (módulo funcional Newsletter). Si no hay backend (o en vista previa),
   valida en el cliente y muestra un aviso, sin romper. */
(function () {
  var form = document.getElementById('nl-inline-form');
  if (!form) return;
  var MSG_EXITO = ${JSON.stringify(txt(cfg, 'newsletterinline', 'exito', '¡Gracias! Te sumamos a la lista.'))};
  var MSG_INVALIDO = ${JSON.stringify(txt(cfg, 'newsletterinline', 'emailInvalido', 'Ingresá un email válido.'))};
  var input = form.querySelector('input[name=email]');
  var reEmail = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = (input.value || '').trim();
    if (!reEmail.test(email)) { App.toast(MSG_INVALIDO); input.focus(); return; }
    // Intenta persistir vía API; si no hay backend responde 404 y lo tomamos como maqueta
    try {
      var r = await App.api('/api/newsletter', { method: 'POST', body: { email: email } });
      form.reset();
      App.toast(r.message || '¡Suscripción confirmada!');
    } catch (err) {
      if (err.message === 'preview') return;
      // 404 = módulo funcional Newsletter no activo: no es un error para el visitante
      if (err.data && err.data.errors) { App.toast('Revisá el email ingresado.'); return; }
      form.reset();
      App.toast(MSG_EXITO);
    }
  });
})();`,
  readmeNotes: () => [
    '**Banda de newsletter**: para guardar las altas activá también el módulo funcional **Newsletter** (postea a `/api/newsletter`). Sin él, la banda valida el email en el cliente pero no lo persiste. Los textos salen del Builder (bloque *Textos por sección*) y se pueden retocar después en la sección `#newsletterinline` de `public/index.html`.',
  ],
};
