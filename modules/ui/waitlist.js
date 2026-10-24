const { esc } = require('../../src/templates');

// Lista de espera / "próximamente": captura de emails para un lanzamiento, con un contador
// de personas anotadas que cuenta hasta su valor al entrar en pantalla (Anime.js, con red
// de seguridad) y prueba social ("ya somos N"). Al anotarse, incrementa el contador local,
// guarda el email en localStorage y agradece. Sin backend obligatorio: para recibir los
// emails de verdad se conecta el formulario a newsletter o a un endpoint (ver README).
// Distinto de "Newsletter" (suscripción a novedades) y del popup de salida: esto es la
// sección de captación para un producto o feature que todavía no salió. Valores editables
// en la constante LISTA. Respeta "prefers-reduced-motion".
// Integración: si el módulo funcional "leads" está activo en la config, además del
// guardado local cada alta se envía a POST /api/leads con origen "waitlist".
// Integración: si el módulo funcional "espera" está activo, esta sección deja de inventar el
// contador y de guardar en localStorage — expone window.WFLista (textos/setTotal/cerrar/alEnviar)
// y ese módulo le pone los datos reales del backend. El contador animado sigue viviendo acá para
// no duplicar su lógica; lo único que cambia es de dónde sale el número.
const LISTA = {
  titulo: 'Se viene algo grande',
  descripcion: 'Estamos por lanzar y los primeros en la lista tienen acceso anticipado y un beneficio exclusivo. Dejanos tu email y te avisamos.',
  base: 1240,
  textoBoton: 'Sumarme a la lista',
  placeholder: 'tu@email.com',
  etiquetaContador: 'personas ya se anotaron',
};

module.exports = {
  id: 'waitlist', type: 'ui', name: 'Lista de espera',
  description: 'Sección de lista de espera / "próximamente" para captar emails de un lanzamiento, con contador de anotados animado (Anime.js) como prueba social. Sin backend obligatorio.',
  usesAnime: true,
  // Con el módulo "espera" activo el contador arranca en 0 y el número real lo pone el backend:
  // sembrar el 1.240 inventado haría que la primera pintada mostrara una cifra falsa antes de
  // corregirse, que es peor que arrancar en cero.
  html: (cfg) => `  <section id="waitlist">
    <div class="container">
      <div class="wl-card card" data-waitlist data-base="${cfg.moduleIds.includes('espera') ? 0 : LISTA.base}">
        <h2>${esc(LISTA.titulo)}</h2>
        <p class="section-sub">${esc(LISTA.descripcion)}</p>
        <div class="wl-contador">
          <span class="wl-num" id="wl-num">0</span>
          <span class="muted">${esc(LISTA.etiquetaContador)}</span>
        </div>
        <form class="wl-form" id="wl-form" novalidate>
          <input type="email" id="wl-email" required placeholder="${esc(LISTA.placeholder)}" aria-label="Tu email">
          <button type="submit" class="btn">${esc(LISTA.textoBoton)}</button>
        </form>
        <p class="wl-ok muted" id="wl-ok" hidden>¡Listo! Ya estás en la lista. Te avisamos apenas salga.</p>
      </div>
    </div>
  </section>`,
  head: () => `  <style>
    .wl-card{max-width:560px;margin:0 auto;text-align:center}
    .wl-contador{display:flex;flex-direction:column;gap:2px;margin:4px 0 18px}
    .wl-num{font-size:2.2rem;font-weight:800;line-height:1;color:var(--accent);font-variant-numeric:tabular-nums}
    .wl-form{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
    .wl-form input{flex:1;min-width:200px;max-width:340px}
    .wl-form button{width:auto;flex:none}
    .wl-ok{margin:14px 0 0;color:var(--accent);font-weight:600}
  </style>`,
  clientJs: (cfg) => `/* Módulo lista de espera: el contador cuenta hasta el total (base + anotados locales)
   al entrar en pantalla, con Anime.js. Al enviar, guarda el email en localStorage, suma 1
   al contador y agradece. Editá los textos en la constante LISTA de modules/ui/waitlist.js.
   Para recibir los emails de verdad, conectá el submit a tu newsletter o endpoint (README).${cfg.moduleIds.includes('espera') ? `
   Con el módulo "Lista de espera administrable" activo, los datos y el alta los maneja el
   backend: acá queda el contador animado y se expone window.WFLista para que ese módulo le
   pase los textos, el total real y la posición en la fila. */` : ' */'}
(function () {
  var card = document.querySelector('[data-waitlist]');
  if (!card) return;
  // Con backend activo el número no lo sabe el navegador: lo pone el servidor por WFLista
  var CON_BACKEND = ${cfg.moduleIds.includes('espera') ? 'true' : 'false'};
  var base = Number(card.getAttribute('data-base')) || 0;
  var numEl = document.getElementById('wl-num');
  var form = document.getElementById('wl-form');
  var email = document.getElementById('wl-email');
  var ok = document.getElementById('wl-ok');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Anotados propios guardados localmente (para que el contador refleje el alta al volver)
  var propios = 0;
  if (!CON_BACKEND) { try { propios = Number(localStorage.getItem('waitlist-propios') || 0) || 0; } catch (e) {} }
  var total = base + propios;
  var fmt = function (n) { return Math.round(n).toLocaleString('es-AR'); };

  function contar(desde, hasta, cb) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { if (numEl) numEl.textContent = fmt(hasta); if (cb) cb(); return; }
    var estado = { v: desde };
    anime.animate(estado, { v: hasta, duration: 1100, ease: 'outCubic',
      onUpdate: function () { if (numEl) numEl.textContent = fmt(estado.v); },
      onComplete: cb });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { if (numEl) numEl.textContent = fmt(hasta); }, 1400);
  }

  // Cuenta hasta el total cuando la sección entra en pantalla. Con backend, además hay que
  // esperar a que llegue el número real: animar hasta 0 y después saltar al total verdadero
  // se vería como un error, así que el contador espera al dato y recién ahí arranca.
  var animado = false, visible = false, totalListo = !CON_BACKEND;
  function animar() {
    visible = true;
    if (animado || !totalListo) return;
    animado = true;
    contar(0, total);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entradas, obs) {
      if (entradas.some(function (e) { return e.isIntersecting; })) { animar(); obs.disconnect(); }
    }, { rootMargin: '0px 0px -12% 0px' });
    io.observe(card);
  } else {
    animar();
  }

  // Punto de entrada para el módulo funcional "espera": le pasa los textos, el total real y el
  // resultado del alta. Vive acá (y no allá) para no duplicar el contador ni el manejo del form.
  var enviar = null;
  window.WFLista = {
    textos: function (d) {
      var h2 = card.querySelector('h2');
      var sub = card.querySelector('.section-sub');
      var etiqueta = card.querySelector('.wl-contador .muted');
      var boton = form && form.querySelector('button[type="submit"]');
      if (h2 && d.titulo) h2.textContent = d.titulo;
      if (sub && d.descripcion) sub.textContent = d.descripcion;
      if (etiqueta && d.etiqueta) etiqueta.textContent = d.etiqueta;
      if (boton && d.boton) boton.textContent = d.boton;
    },
    setTotal: function (n) {
      var previo = totalListo ? total : 0;
      total = Number(n) || 0;
      totalListo = true;
      if (!animado && visible) { animado = true; contar(0, total); }
      else if (animado) contar(previo, total);
      else if (numEl) numEl.textContent = fmt(total);
    },
    cerrar: function (mensaje) {
      if (form) form.hidden = true;
      if (ok) { ok.textContent = mensaje; ok.hidden = false; }
    },
    alEnviar: function (fn) { enviar = fn; },
  };

  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var valor = (email && email.value || '').trim();
    if (!valor || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(valor)) {
      if (email) { email.focus(); }
      App.toast('Ingresá un email válido');
      return;
    }
    if (CON_BACKEND) {
      // El alta la resuelve el backend: devuelve la posición en la fila, que es el dato que
      // el navegador no puede saber. El contador lo actualiza el servidor por setTotal.
      if (!enviar) { App.toast('Un segundo, estamos cargando la lista'); return; }
      enviar(valor, function (mensaje, posicion) {
        form.hidden = true;
        if (ok) {
          ok.textContent = posicion ? mensaje + ' Sos el número ' + posicion + ' de la lista.' : mensaje;
          ok.hidden = false;
        }
      });
      return;
    }
    // Sin backend: guardamos localmente y sumamos 1 al contador. Conectá a tu newsletter
    // o a un endpoint si querés recibir los emails de verdad (ver README).
    try { localStorage.setItem('waitlist-email', valor); localStorage.setItem('waitlist-propios', String(propios + 1)); } catch (err) {}
${cfg.moduleIds.includes('leads') ? `    // Módulo "Captación de leads" activo: además del guardado local, el alta viaja al
    // backend con origen "waitlist" (idempotente; si falla no bloquea la UX)
    if (!window.__PREVIEW__ && window.App && App.api) {
      App.api('/api/leads', { method: 'POST', body: { email: valor, origen: 'waitlist' } }).catch(function () {});
    }
` : ''}
    total += 1;
    contar(total - 1, total);
    form.hidden = true;
    if (ok) ok.hidden = false;
    App.toast('¡Sumado a la lista de espera!');
  });
})();`,
  readmeNotes: (cfg) => [
    cfg.moduleIds.includes('espera')
      ? `**Lista de espera**: con el módulo **Lista de espera administrable** activo, los textos, el estado (abierta/cerrada) y el contador salen del backend, el alta se guarda de verdad y quien se anota recibe **su posición en la fila**. Editalo todo desde \`/espera-admin.html\`; no hace falta tocar la constante \`LISTA\`.`
      : `**Lista de espera**: los textos y el número base de anotados son placeholders; editá la constante \`LISTA\` en \`modules/ui/waitlist.js\`. ${cfg.moduleIds.includes('leads') ? 'Con el módulo **Captación de leads** activo, cada alta se envía sola a `POST /api/leads` (origen `waitlist`) y se ve en `/leads.html`.' : 'Sin backend guarda el email en `localStorage`; para recibirlos de verdad, activá el módulo **Lista de espera administrable** (recomendado) o el de **Captación de leads**, o conectá el `submit` del formulario (`#wl-form`) a tu newsletter o a un endpoint propio.'}`,
  ],
};
