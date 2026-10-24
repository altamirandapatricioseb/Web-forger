const { esc } = require('../../src/templates');

// Formulario multi-paso (wizard): divide un formulario largo en pasos con barra de
// progreso, validación por paso (no deja avanzar con campos inválidos) y un resumen
// final editable antes de enviar. Como no hay backend obligatorio, al confirmar arma
// un mailto con todos los datos hacia el email del negocio (editable en app.js); si el
// módulo whatsapp/whatsappform no aplica, el mailto es universal y gratis. La transición
// entre pasos y el avance de la barra se animan con Anime.js (con red de seguridad si el
// loop está pausado) y respeta "prefers-reduced-motion". Mejora progresiva: sin JS el
// formulario se ve completo en una sola columna y sigue siendo usable.
module.exports = {
  id: 'multistep', type: 'ui', name: 'Formulario multi-paso',
  description: 'Formulario tipo wizard en varios pasos con barra de progreso, validación por paso y resumen final; al confirmar arma un mailto con los datos. Animado con Anime.js.',
  usesAnime: true,
  html: () => `  <section id="multistep">
    <div class="container" style="max-width:640px">
      <h2>Pedí tu propuesta</h2>
      <p class="section-sub">Completá estos pasos y te enviamos una propuesta a medida.</p>
      <!-- Wizard: cada .wizard-paso es un paso. Agregá/quitá campos libremente;
           los campos con "required" se validan antes de avanzar. -->
      <form id="wizard" class="card" novalidate>
        <div class="wizard-barra"><div class="wizard-barra-fill" id="wizard-fill"></div></div>
        <ol class="wizard-pasos" id="wizard-pasos" aria-hidden="true"></ol>

        <fieldset class="wizard-paso" data-titulo="Tus datos">
          <legend>Tus datos</legend>
          <label for="ms-nombre">Nombre y apellido</label>
          <input id="ms-nombre" name="Nombre" type="text" required>
          <label for="ms-email">Email</label>
          <input id="ms-email" name="Email" type="email" required>
        </fieldset>

        <fieldset class="wizard-paso" data-titulo="Tu proyecto" hidden>
          <legend>Tu proyecto</legend>
          <label for="ms-tipo">¿Qué necesitás?</label>
          <select id="ms-tipo" name="Tipo" required>
            <option value="">Elegí una opción…</option>
            <option>Sitio web</option>
            <option>Tienda online</option>
            <option>Rediseño</option>
            <option>Otro</option>
          </select>
          <label for="ms-presupuesto">Presupuesto estimado</label>
          <select id="ms-presupuesto" name="Presupuesto" required>
            <option value="">Elegí un rango…</option>
            <option>Hasta $500</option>
            <option>$500 a $2000</option>
            <option>Más de $2000</option>
          </select>
        </fieldset>

        <fieldset class="wizard-paso" data-titulo="Detalle" hidden>
          <legend>Contanos más</legend>
          <label for="ms-mensaje">Detalle del pedido</label>
          <textarea id="ms-mensaje" name="Mensaje" rows="4" required></textarea>
          <div class="wizard-resumen" id="wizard-resumen"></div>
        </fieldset>

        <div class="wizard-nav">
          <button type="button" class="btn ghost" id="wizard-prev" hidden>Atrás</button>
          <button type="button" class="btn" id="wizard-next">Siguiente</button>
          <button type="submit" class="btn" id="wizard-enviar" hidden>Enviar propuesta</button>
        </div>
      </form>
    </div>
  </section>`,
  head: () => `  <style>
    .wizard-barra{height:6px;background:var(--line);border-radius:999px;overflow:hidden;margin:0 0 8px}
    .wizard-barra-fill{height:100%;width:0;background:var(--accent);border-radius:999px;transition:width .3s ease}
    .wizard-pasos{list-style:none;display:flex;gap:6px;padding:0;margin:0 0 20px;font-size:.8rem;color:var(--muted)}
    .wizard-pasos li{flex:1;text-align:center;padding-top:4px;border-top:2px solid var(--line)}
    .wizard-pasos li[aria-current="step"]{color:var(--accent);border-top-color:var(--accent);font-weight:600}
    .wizard-nav{display:flex;justify-content:space-between;gap:10px;margin-top:20px}
    .wizard-nav .btn{width:auto}
    .wizard-resumen{margin-top:16px;font-size:.9rem}
    .wizard-resumen dl{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0}
    .wizard-resumen dt{color:var(--muted)}
    .wizard-resumen dd{margin:0;font-weight:600;word-break:break-word}
    @media (prefers-reduced-motion: reduce){.wizard-barra-fill{transition:none}}
  </style>`,
  clientJs: () => `/* Módulo formulario multi-paso: navegación entre pasos con validación y resumen.
   Editá EMAIL_DESTINO con el correo donde querés recibir los pedidos. Al confirmar
   se abre el cliente de correo con todos los datos cargados (sin backend). */
(function () {
  var EMAIL_DESTINO = 'hola@tudominio.com';
  var form = document.getElementById('wizard');
  if (!form) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pasos = Array.prototype.slice.call(form.querySelectorAll('.wizard-paso'));
  var fill = document.getElementById('wizard-fill');
  var lista = document.getElementById('wizard-pasos');
  var prev = document.getElementById('wizard-prev');
  var next = document.getElementById('wizard-next');
  var enviar = document.getElementById('wizard-enviar');
  var resumen = document.getElementById('wizard-resumen');
  var actual = 0;

  // Riel de pasos (indicadores) a partir de data-titulo
  pasos.forEach(function (p, i) {
    var li = document.createElement('li');
    li.textContent = (i + 1) + '. ' + (p.getAttribute('data-titulo') || ('Paso ' + (i + 1)));
    lista.appendChild(li);
  });

  function pintar() {
    pasos.forEach(function (p, i) { p.hidden = i !== actual; });
    Array.prototype.forEach.call(lista.children, function (li, i) {
      li.setAttribute('aria-current', i === actual ? 'step' : 'false');
    });
    var pct = Math.round(((actual + 1) / pasos.length) * 100);
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(fill, { width: pct + '%', duration: 320, ease: 'outQuad' });
      anime.animate(pasos[actual], { opacity: [0, 1], translateX: [16, 0], duration: 260, ease: 'outQuad' });
      // Red de seguridad: fija el estado final si el loop está pausado
      setTimeout(function () { fill.style.width = pct + '%'; pasos[actual].style.opacity = '1'; pasos[actual].style.transform = ''; }, 380);
    } else {
      fill.style.width = pct + '%';
    }
    prev.hidden = actual === 0;
    next.hidden = actual === pasos.length - 1;
    enviar.hidden = actual !== pasos.length - 1;
    if (actual === pasos.length - 1) construirResumen();
    var foco = pasos[actual].querySelector('input,select,textarea');
    if (foco) foco.focus();
  }

  // Valida sólo los campos del paso actual usando la validación nativa del navegador
  function pasoValido() {
    var campos = pasos[actual].querySelectorAll('input,select,textarea');
    for (var i = 0; i < campos.length; i++) {
      if (!campos[i].checkValidity()) { campos[i].reportValidity(); return false; }
    }
    return true;
  }

  function datos() {
    var d = [];
    form.querySelectorAll('input[name],select[name],textarea[name]').forEach(function (c) {
      d.push({ k: c.name, v: (c.value || '').trim() });
    });
    return d;
  }

  function construirResumen() {
    var html = '<dl>';
    datos().forEach(function (x) { html += '<dt>' + App.esc(x.k) + '</dt><dd>' + App.esc(x.v || '—') + '</dd>'; });
    html += '</dl>';
    resumen.innerHTML = html;
  }

  next.addEventListener('click', function () { if (pasoValido() && actual < pasos.length - 1) { actual++; pintar(); } });
  prev.addEventListener('click', function () { if (actual > 0) { actual--; pintar(); } });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!pasoValido()) return;
    var cuerpo = datos().map(function (x) { return x.k + ': ' + x.v; }).join('\\n');
    var asunto = 'Pedido de propuesta desde el sitio';
    // mailto universal: no requiere backend ni servicios pagos
    window.location.href = 'mailto:' + EMAIL_DESTINO + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo);
    App.toast('Abrimos tu correo con el pedido cargado. ¡Gracias!');
  });

  pintar();
})();`,
  readmeNotes: () => [
    '**Formulario multi-paso**: definí el correo receptor en la constante `EMAIL_DESTINO` de `public/js/app.js` (buscá "formulario multi-paso"). Los pasos y campos se editan en la sección `#multistep` de `public/index.html`; al confirmar se abre el correo del visitante con todos los datos (sin backend).',
  ],
};
