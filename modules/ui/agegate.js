// Verificación de edad (age gate): al cargar el sitio muestra un diálogo bloqueante que
// pregunta si la persona es mayor de edad. Necesario en rubros regulados (bebidas,
// vaping, apuestas, etc.). Si confirma, se recuerda en localStorage y no vuelve a
// aparecer durante el período configurado; si dice que no, queda bloqueado con un
// mensaje. Accesible (rol dialog, foco al abrir, no cierra con Esc porque es bloqueante)
// y respeta "prefers-reduced-motion". Apertura/cierre animados con Anime.js + red de
// seguridad si el loop está pausado. Frontend puro, sin backend.
const { esc, txt } = require('../../src/templates');

const EDAD_MINIMA = 18; // edad mínima requerida (editable desde el Builder)
const DIAS_RECORDAR = 30; // cuántos días se recuerda la confirmación

// Textos del diálogo. {edad} se reemplaza por la edad mínima al generar, así el default
// declarado es una constante (lo exige el contrato `fields`) y el texto sigue diciendo el
// número igual que antes.
const TITULO_DEFAULT = 'Verificación de edad';
const TEXTO_DEFAULT = 'Para ingresar tenés que ser mayor de {edad} años. ¿Confirmás que los tenés?';
const SI_DEFAULT = 'Sí, soy mayor de {edad}';
const NO_DEFAULT = 'No';
const RECHAZO_DEFAULT = 'Lo sentimos, tenés que ser mayor de {edad} años para ingresar.';

// Convierte a entero positivo lo que escribió el cliente; si no parsea, queda el base.
function entero(s, base) {
  const n = parseInt(String(s).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : base;
}

module.exports = {
  id: 'agegate', type: 'ui', name: 'Verificación de edad',
  description: 'Diálogo bloqueante al entrar que pide confirmar la mayoría de edad (rubros regulados). Recuerda la confirmación en localStorage. Accesible y animado con Anime.js.',
  usesAnime: true,
  fields: [
    { key: 'edad', label: 'Edad mínima', default: String(EDAD_MINIMA), max: 3, hint: 'Sólo el número de años. Ejemplo: 18.' },
    { key: 'dias', label: 'Días que se recuerda la confirmación', default: String(DIAS_RECORDAR), max: 4, hint: 'Sólo el número de días. Ejemplo: 30.' },
    { key: 'titulo', label: 'Título del diálogo', default: TITULO_DEFAULT, max: 80 },
    { key: 'texto', label: 'Pregunta', type: 'textarea', default: TEXTO_DEFAULT, max: 300, hint: 'Escribí {edad} donde quieras que aparezca la edad mínima.' },
    { key: 'botonSi', label: 'Botón afirmativo', default: SI_DEFAULT, max: 60, hint: 'Admite {edad}.' },
    { key: 'botonNo', label: 'Botón negativo', default: NO_DEFAULT, max: 60 },
    { key: 'rechazo', label: 'Mensaje al responder que no', type: 'textarea', default: RECHAZO_DEFAULT, max: 300, hint: 'Admite {edad}.' },
  ],
  head: () => `  <style>
    .agegate-overlay{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;padding:20px;
      background:rgba(0,0,0,.72);backdrop-filter:blur(3px)}
    .agegate-box{max-width:420px;width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius);
      padding:30px 26px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.3)}
    .agegate-box h2{margin:.2rem 0 .5rem}
    .agegate-box p{color:var(--muted);margin:0 0 20px}
    .agegate-acciones{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
    .agegate-acciones .btn{width:auto;min-width:120px}
    .agegate-no{background:none;border:1px solid var(--line);color:var(--text)}
    .agegate-error{color:#dc2626;font-weight:600;margin:16px 0 0;min-height:1.2em}
    html.agegate-lock,body.agegate-lock{overflow:hidden}
  </style>`,
  clientJs: (cfg) => {
    const edad = entero(txt(cfg, 'agegate', 'edad', EDAD_MINIMA), EDAD_MINIMA);
    const dias = entero(txt(cfg, 'agegate', 'dias', DIAS_RECORDAR), DIAS_RECORDAR);
    // Los textos se resuelven acá (no en el navegador): se les reemplaza {edad} y se
    // escapan con esc() porque terminan en innerHTML/textContent dentro del diálogo.
    // Después viajan como literales de JavaScript vía JSON.stringify, nunca con esc solo.
    const conEdad = (key, base) => esc(txt(cfg, 'agegate', key, base).replace(/\{edad\}/g, String(edad)));
    const titulo = conEdad('titulo', TITULO_DEFAULT);
    const texto = conEdad('texto', TEXTO_DEFAULT);
    const botonSi = conEdad('botonSi', SI_DEFAULT);
    const botonNo = conEdad('botonNo', NO_DEFAULT);
    // El rechazo se pinta con textContent: ahí el navegador no interpreta marcado
    const rechazo = txt(cfg, 'agegate', 'rechazo', RECHAZO_DEFAULT).replace(/\{edad\}/g, String(edad));
    return `/* Módulo verificación de edad: diálogo bloqueante al entrar. La edad mínima, los días
   que se recuerda la confirmación y los textos se editan desde el Builder (bloque
   "Textos por sección"). */
(function () {
  if (window.__PREVIEW__) return; // en la vista previa del builder no bloqueamos
  var DIAS = ${dias};
  var GUARDA = 'agegate-ok';
  // Si ya confirmó dentro del período, no mostramos nada
  var previo = Number(localStorage.getItem(GUARDA) || 0);
  if (previo && (Date.now() - previo) < DIAS * 864e5) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var anime = window.anime;
  var focoPrevio = document.activeElement;

  var overlay = document.createElement('div');
  overlay.className = 'agegate-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'agegate-titulo');
  overlay.innerHTML = '<div class="agegate-box">' +
    '<h2 id="agegate-titulo">' + ${JSON.stringify(titulo)} + '</h2>' +
    '<p>' + ${JSON.stringify(texto)} + '</p>' +
    '<div class="agegate-acciones">' +
    '<button type="button" class="btn agegate-si">' + ${JSON.stringify(botonSi)} + '</button>' +
    '<button type="button" class="btn agegate-no">' + ${JSON.stringify(botonNo)} + '</button>' +
    '</div>' +
    '<p class="agegate-error" role="alert"></p></div>';

  var box = overlay.querySelector('.agegate-box');
  var si = overlay.querySelector('.agegate-si');
  var no = overlay.querySelector('.agegate-no');
  var error = overlay.querySelector('.agegate-error');

  // Atrapa el Tab dentro del diálogo (es bloqueante: no hay nada más navegable)
  overlay.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var foco = [si, no];
    var i = foco.indexOf(document.activeElement);
    e.preventDefault();
    var next = e.shiftKey ? (i <= 0 ? foco.length - 1 : i - 1) : (i + 1) % foco.length;
    foco[next].focus();
  });

  function bloquear() {
    document.documentElement.classList.add('agegate-lock');
    document.body.classList.add('agegate-lock');
  }
  function desbloquear() {
    document.documentElement.classList.remove('agegate-lock');
    document.body.classList.remove('agegate-lock');
  }

  si.addEventListener('click', function () {
    localStorage.setItem(GUARDA, String(Date.now()));
    if (anime && anime.animate && !reduce) {
      anime.animate(overlay, { opacity: [1, 0], duration: 320, ease: 'outQuad' });
      // Red de seguridad: si el loop está pausado, saca el overlay igual
      setTimeout(cerrar, 360);
    } else {
      cerrar();
    }
  });
  function cerrar() {
    desbloquear();
    if (overlay.parentNode) overlay.remove();
    if (focoPrevio && focoPrevio.focus) focoPrevio.focus();
  }

  no.addEventListener('click', function () {
    error.textContent = ${JSON.stringify(rechazo)};
    si.disabled = true;
    no.disabled = true;
  });

  bloquear();
  document.body.appendChild(overlay);
  si.focus();
  // Animación de entrada del diálogo
  if (anime && anime.animate && !reduce) {
    anime.animate(box, { opacity: [0, 1], scale: [0.94, 1], duration: 340, ease: 'outQuad' });
    // Red de seguridad: fija el estado final si el loop está pausado (pestaña oculta)
    setTimeout(function () { box.style.opacity = '1'; box.style.transform = ''; }, 700);
  }
})();`;
  },
  readmeNotes: () => [
    '**Verificación de edad**: la edad mínima, los días que se recuerda la confirmación y los textos del diálogo salen del bloque *Textos por sección* del Builder. Es una barrera del lado del cliente (recordada en `localStorage`), pensada para rubros regulados; no reemplaza una verificación de identidad real.',
  ],
};
