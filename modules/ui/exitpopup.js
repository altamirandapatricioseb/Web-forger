// Popup de intención de salida (exit intent): detecta cuando el mouse abandona el
// viewport por arriba (gesto de cerrar la pestaña) en escritorio, o un fallback por
// inactividad/scroll en móvil donde no hay ese gesto, y ofrece una última promoción o
// captura de email. Se muestra una sola vez por período (localStorage, frecuenciaDias),
// se cierra con Escape/clic afuera/botón y es accesible (dialog con foco). Distinto del
// "Popup de promoción" (ese aparece por tiempo/scroll): este reacciona a la salida.
// La apertura se anima con Anime.js con red de seguridad si el loop está pausado.
// Integración: si el módulo funcional "leads" está activo en la config, además del
// guardado local cada email se envía a POST /api/leads con origen "exitpopup".
const { txt } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'exitpopup', type: 'ui', name: 'Popup de salida',
  description: 'Ventana emergente de intención de salida (exit intent) para captar un email u ofrecer un descuento antes de que el visitante se vaya. Frecuencia configurable, accesible y animada con Anime.js.',
  usesAnime: true,
  fields: [
    { key: 'titulo', label: 'Título del popup', default: '¿Te vas tan pronto?', max: 80 },
    { key: 'texto', label: 'Texto', type: 'textarea', default: 'Dejanos tu email y te enviamos un 10% de descuento para tu primera compra.', max: 220 },
    { key: 'boton', label: 'Texto del botón', default: 'Quiero el descuento', max: 40 },
    { key: 'placeholder', label: 'Ejemplo dentro del campo de email', default: 'tu@email.com', max: 60 },
    { key: 'exito', label: 'Mensaje al enviar', default: '¡Listo! Te contactamos con tu descuento.', max: 120 },
  ],
  // Todos los textos viajan adentro de un string de JS: van por JSON.stringify, nunca por
  // esc(), para que una comilla en el texto del cliente no parta el archivo generado.
  clientJs: (cfg) => `/* Módulo popup de salida: aparece cuando el visitante intenta irse. Los textos salen
   del Builder y quedan horneados en POPUP. Sin backend: al enviar guarda el intento y muestra
   un aviso; conectalo a tu newsletter o backend si querés persistir los emails (ver README). */
(function () {
  var POPUP = {
    titulo: ${JSON.stringify(txt(cfg, 'exitpopup', 'titulo', '¿Te vas tan pronto?'))},
    texto: ${JSON.stringify(txt(cfg, 'exitpopup', 'texto', 'Dejanos tu email y te enviamos un 10% de descuento para tu primera compra.'))},
    textoBoton: ${JSON.stringify(txt(cfg, 'exitpopup', 'boton', 'Quiero el descuento'))},
    placeholder: ${JSON.stringify(txt(cfg, 'exitpopup', 'placeholder', 'tu@email.com'))},
    exito: ${JSON.stringify(txt(cfg, 'exitpopup', 'exito', '¡Listo! Te contactamos con tu descuento.'))},
    frecuenciaDias: 7,
    inactividadSegundosMovil: 25,
  };
  var visto = Number(localStorage.getItem('exitpopup-visto') || 0);
  if (Date.now() - visto < POPUP.frecuenciaDias * 24 * 3600 * 1000) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esTactil = window.matchMedia && window.matchMedia('(hover: none)').matches;
  var abierto = false, ultimoFoco = null;

  function marcarVisto() { localStorage.setItem('exitpopup-visto', String(Date.now())); }

  function abrir() {
    if (abierto) return;
    abierto = true;
    marcarVisto();
    desarmar();
    var fondo = document.createElement('div');
    fondo.id = 'exitpopup';
    fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:70;display:flex;align-items:center;justify-content:center;padding:20px';
    var caja = document.createElement('div');
    caja.setAttribute('role', 'dialog');
    caja.setAttribute('aria-modal', 'true');
    caja.setAttribute('aria-labelledby', 'exitpopup-titulo');
    caja.style.cssText = 'background:var(--bg);color:var(--text);border-radius:calc(var(--radius) + 4px);max-width:440px;width:100%;padding:30px;position:relative;box-shadow:0 24px 60px rgba(0,0,0,.3)';
    caja.innerHTML =
      '<button type="button" id="exitpopup-cerrar" aria-label="Cerrar" style="position:absolute;top:10px;right:10px;width:34px;background:none;border:0;cursor:pointer;color:var(--muted);padding:4px">${phIcon('x', { size: 18 })}</button>' +
      '<h3 id="exitpopup-titulo" style="margin:0 0 8px;font-size:1.4rem">' + App.esc(POPUP.titulo) + '</h3>' +
      '<p style="margin:0 0 18px;color:var(--muted)">' + App.esc(POPUP.texto) + '</p>' +
      '<form id="exitpopup-form" style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<input type="email" id="exitpopup-email" required placeholder="' + App.esc(POPUP.placeholder) + '" style="flex:1;min-width:180px">' +
      '<button type="submit" class="btn" style="width:auto">' + App.esc(POPUP.textoBoton) + '</button>' +
      '</form>';
    fondo.appendChild(caja);
    document.body.appendChild(fondo);
    ultimoFoco = document.activeElement;

    function cerrar() {
      fondo.remove();
      document.removeEventListener('keydown', porTecla);
      if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }
    function porTecla(e) {
      if (e.key === 'Escape') { cerrar(); return; }
      if (e.key !== 'Tab') return;
      var f = caja.querySelectorAll('button,input');
      if (!f.length) return;
      var p = f[0], u = f[f.length - 1];
      if (e.shiftKey && document.activeElement === p) { e.preventDefault(); u.focus(); }
      else if (!e.shiftKey && document.activeElement === u) { e.preventDefault(); p.focus(); }
    }
    document.getElementById('exitpopup-cerrar').addEventListener('click', cerrar);
    fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); });
    document.addEventListener('keydown', porTecla);
    document.getElementById('exitpopup-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('exitpopup-email').value.trim();
      if (!email) return;
      // Sin backend: dejamos el email guardado localmente y avisamos. Conectá a tu
      // newsletter o a un endpoint si querés recibir los correos (ver README).
      try { localStorage.setItem('exitpopup-email', email); } catch (err) {}
${cfg.moduleIds.includes('leads') ? `      // Módulo "Captación de leads" activo: además del guardado local, el email viaja
      // al backend con origen "exitpopup" (idempotente; si falla no bloquea la UX)
      if (!window.__PREVIEW__ && window.App && App.api) {
        App.api('/api/leads', { method: 'POST', body: { email: email, origen: 'exitpopup' } }).catch(function () {});
      }
` : ''}
      App.toast(POPUP.exito);
      cerrar();
    });
    var email = document.getElementById('exitpopup-email');
    if (email) email.focus();

    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(fondo, { opacity: [0, 1], duration: 200 });
      anime.animate(caja, { opacity: [0, 1], scale: [0.92, 1], translateY: [14, 0], duration: 300, ease: 'outCubic' });
      // Red de seguridad: fija el estado final si el loop está pausado
      setTimeout(function () { fondo.style.opacity = '1'; caja.style.opacity = ''; caja.style.transform = ''; }, 360);
    }
  }

  // Disparadores: mouse que sale por arriba (escritorio) o inactividad (táctil)
  var timer = null;
  function porMouse(e) { if (e.clientY <= 0) abrir(); }
  function reiniciarInactividad() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(abrir, POPUP.inactividadSegundosMovil * 1000);
  }
  function desarmar() {
    document.removeEventListener('mouseout', porMouse);
    if (timer) clearTimeout(timer);
    ['scroll', 'touchstart', 'click'].forEach(function (ev) { removeEventListener(ev, reiniciarInactividad); });
  }
  if (esTactil) {
    reiniciarInactividad();
    ['scroll', 'touchstart', 'click'].forEach(function (ev) { addEventListener(ev, reiniciarInactividad, { passive: true }); });
  } else {
    document.addEventListener('mouseout', porMouse);
  }
})();`,
  readmeNotes: (cfg) => [
    `**Popup de salida**: los textos salen del Builder (bloque *Textos por sección*) y quedan horneados —junto con la frecuencia— en la constante \`POPUP\` de \`public/js/app.js\` (buscá "popup de salida"). ${cfg.moduleIds.includes('leads') ? 'Con el módulo **Captación de leads** activo, cada email se envía solo a `POST /api/leads` (origen `exitpopup`) y se ve en `/leads.html`.' : 'Sin backend guarda el email en `localStorage`; para recibirlos de verdad, activá el módulo **Captación de leads** o conectá el `submit` del formulario (`#exitpopup-form`) a tu newsletter o a un endpoint propio.'}`,
  ],
};
