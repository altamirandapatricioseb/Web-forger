const { esc } = require('../../src/templates');

// Ventanas modales reutilizables: un único overlay para todo el sitio, accesible
// (foco atrapado, cierre con Esc y clic afuera, foco devuelto al abrir/cerrar) y
// animado con Anime.js (escala + fundido). Cualquier botón/enlace con
// data-modal-target="#id" abre el contenido del elemento fuente (oculto) referenciado.
// También expone window.abrirModal({titulo, html}) para abrir contenido a demanda.
// La sección visible es una demo editable (términos y condiciones) que muestra el uso.
module.exports = {
  id: 'modal', type: 'ui', name: 'Ventanas modales',
  description: 'Ventanas modales reutilizables y accesibles (foco atrapado, cierre con Esc/afuera), animadas con Anime.js. Se abren con data-modal-target="#id" o con window.abrirModal(). Incluye una demo editable.',
  usesAnime: true,
  html: () => `  <section id="modal-demo">
    <div class="container" style="text-align:center">
      <h2>Ventanas modales</h2>
      <p class="section-sub" style="margin-inline:auto">Ejemplo de uso: el botón abre el contenido oculto de más abajo en una ventana modal.</p>
      <button type="button" class="btn ghost" data-modal-target="#modal-terminos">Ver términos y condiciones</button>
      <!-- Contenido fuente: oculto en la página, se muestra dentro de la modal. Editá o duplicá este bloque -->
      <div id="modal-terminos" class="modal-fuente" hidden data-modal-titulo="Términos y condiciones">
        <p class="muted">Este es un texto de ejemplo. Reemplazalo por tus términos, una política, un aviso o cualquier contenido que quieras mostrar en una ventana modal.</p>
        <p class="muted">Podés crear más botones con <code>data-modal-target="#id"</code> apuntando a otros bloques ocultos como este.</p>
      </div>
    </div>
  </section>`,
  head: () => `  <style>
    .modal-fuente{display:none}
    .modal-overlay{position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.55);opacity:0}
    .modal-overlay.abierta{display:flex}
    .modal-box{background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:calc(var(--radius) + 4px);box-shadow:0 24px 60px rgba(0,0,0,.28);max-width:560px;width:100%;max-height:85vh;overflow:auto}
    .modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid var(--line)}
    .modal-head h3{margin:0;font-size:1.15rem}
    .modal-close{background:none;border:0;cursor:pointer;color:var(--muted);width:34px;height:34px;border-radius:50%;font-size:1.4rem;line-height:1;display:flex;align-items:center;justify-content:center}
    .modal-close:hover{background:var(--surface);color:var(--text)}
    .modal-body{padding:20px}
    .modal-body > :first-child{margin-top:0}
    .modal-body > :last-child{margin-bottom:0}
    @media (prefers-reduced-motion: reduce){.modal-overlay{transition:none}}
  </style>`,
  clientJs: () => `/* Módulo ventanas modales: overlay único reutilizable, accesible y animado con Anime.js.
   Abrí con data-modal-target="#id" (clona el contenido del elemento oculto) o con
   window.abrirModal({titulo, html}). Cierre con Esc, clic afuera o el botón. Degrada sin
   librería (aparece sin animar) y respeta "prefers-reduced-motion". */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var overlay, caja, cuerpo, tituloEl, ultimoFoco = null;
  function construir() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    var head = document.createElement('div');
    head.className = 'modal-head';
    tituloEl = document.createElement('h3');
    tituloEl.id = 'modal-titulo';
    overlay.setAttribute('aria-labelledby', 'modal-titulo');
    var cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'modal-close';
    cerrar.setAttribute('aria-label', 'Cerrar');
    cerrar.innerHTML = '&times;';
    cerrar.addEventListener('click', cerrarModal);
    head.appendChild(tituloEl);
    head.appendChild(cerrar);
    caja = document.createElement('div');
    caja.className = 'modal-box';
    cuerpo = document.createElement('div');
    cuerpo.className = 'modal-body';
    caja.appendChild(head);
    caja.appendChild(cuerpo);
    overlay.appendChild(caja);
    // Clic sobre el fondo (no sobre la caja) cierra
    overlay.addEventListener('click', function (e) { if (e.target === overlay) cerrarModal(); });
    document.body.appendChild(overlay);
  }
  function focusables() {
    return caja.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
  }
  function onKey(e) {
    if (e.key === 'Escape') { cerrarModal(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) return;
    var primero = f[0], ultimo = f[f.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }
  function abrirModal(op) {
    op = op || {};
    construir();
    tituloEl.textContent = op.titulo || '';
    cuerpo.innerHTML = op.html || '';
    ultimoFoco = document.activeElement;
    overlay.classList.add('abierta');
    overlay.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onKey);
    // Enfoca el primer elemento interactivo o el botón de cerrar
    var f = focusables();
    (f[0] || caja.querySelector('.modal-close')).focus();
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(overlay, { opacity: [0, 1], duration: 220 });
      anime.animate(caja, { opacity: [0, 1], scale: [0.92, 1], translateY: [12, 0], duration: 300, ease: 'outCubic' });
      // Red de seguridad: si el motor está pausado (pestaña oculta), fija el estado final
      setTimeout(function () { overlay.style.opacity = '1'; caja.style.opacity = ''; caja.style.transform = ''; }, 360);
    } else {
      overlay.style.opacity = '1';
    }
  }
  function cerrarModal() {
    if (!overlay || !overlay.classList.contains('abierta')) return;
    document.removeEventListener('keydown', onKey);
    function terminar() {
      overlay.classList.remove('abierta');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.opacity = '';
      cuerpo.innerHTML = '';
      if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(caja, { opacity: [1, 0], scale: [1, 0.94], duration: 180, ease: 'inCubic' });
      anime.animate(overlay, { opacity: [1, 0], duration: 200, onComplete: terminar });
      setTimeout(terminar, 240); // red de seguridad si el loop está pausado
    } else {
      terminar();
    }
  }
  // Cablea los disparadores declarativos: data-modal-target="#id"
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-modal-target]');
    if (!trigger) return;
    var sel = trigger.getAttribute('data-modal-target');
    var fuente = sel && document.querySelector(sel);
    if (!fuente) return;
    e.preventDefault();
    var titulo = fuente.getAttribute('data-modal-titulo') || (trigger.textContent || '').trim();
    abrirModal({ titulo: titulo, html: fuente.innerHTML });
  });
  window.abrirModal = abrirModal;
  window.cerrarModal = cerrarModal;
})();`,
  readmeNotes: () => [
    '**Ventanas modales**: cualquier botón o enlace con `data-modal-target="#id"` abre el contenido del elemento oculto con ese `id` (poné el título en `data-modal-titulo`). Desde tu propio JS podés abrir contenido a demanda con `window.abrirModal({ titulo, html })`. La sección de demo (`#modal-demo`) es editable o borrable.',
  ],
};
