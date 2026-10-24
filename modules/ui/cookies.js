const { esc, txt } = require('../../src/templates');

// Textos por defecto del banner. Son los que ve el visitante y los únicos editables:
// el resto del módulo (la lógica de consentimiento) no cambia.
const TEXTO_DEFAULT = 'Usamos cookies y almacenamiento local para que el sitio funcione y mejorar tu experiencia.';
const ACEPTAR_DEFAULT = 'Aceptar';
const ESENCIALES_DEFAULT = 'Solo esenciales';
const ETIQUETA_DEFAULT = 'Aviso de cookies';

module.exports = {
  id: 'cookies', type: 'ui', name: 'Banner de cookies',
  description: 'Aviso de cookies con aceptar/solo esenciales, recordado en el navegador y animado al entrar (Anime.js). Avisa la elección con el evento `wf:consent` y respeta la versión de política que publique el módulo Registro de consentimientos: si la política cambia, vuelve a preguntar.',
  usesAnime: true,
  fields: [
    { key: 'texto', label: 'Texto del aviso', type: 'textarea', default: TEXTO_DEFAULT, max: 300 },
    { key: 'aceptar', label: 'Botón "aceptar todo"', default: ACEPTAR_DEFAULT, max: 40 },
    { key: 'esenciales', label: 'Botón "solo esenciales"', default: ESENCIALES_DEFAULT, max: 40 },
    { key: 'etiqueta', label: 'Nombre del aviso (lectores de pantalla)', default: ETIQUETA_DEFAULT, max: 80 },
  ],
  // Los textos viajan adentro de strings de JavaScript, así que se interpolan con
  // JSON.stringify: eso escapa comillas y saltos de línea. Los tres que además terminan
  // en innerHTML pasan antes por esc(), porque ahí el navegador sí interpreta marcado;
  // el aria-label va por setAttribute y no lo necesita.
  clientJs: (cfg) => `/* Módulo banner de cookies: se inyecta en todas las páginas hasta que el visitante elige.
   La elección queda en localStorage ('cookie-consent': 'accepted' | 'essential')
   para que cualquier script futuro (analytics, etc.) la consulte antes de activarse.
   Dos puntos de entrada para otros módulos (el arranque se difiere a DOMContentLoaded a
   propósito, así no depende del orden en que se concatenan los clientJs):
     - window.WFConsentVersion → promesa OPCIONAL con la versión vigente de la política
       (la publica el módulo Registro de consentimientos). Si la versión guardada no coincide
       con la vigente, el banner vuelve a preguntar.
     - evento 'wf:consent' en document con detail {choice, version} cuando el visitante elige:
       lo escucha el backend de consentimientos para registrarlo del lado del servidor. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CLAVE = 'cookie-consent';
  var CLAVE_V = 'cookie-consent-version';
  var store = {
    get() { try { return localStorage.getItem(CLAVE); } catch { return null; } },
    getVersion() { try { return localStorage.getItem(CLAVE_V); } catch { return null; } },
    set(v, version) {
      try {
        localStorage.setItem(CLAVE, v);
        if (version) localStorage.setItem(CLAVE_V, String(version));
      } catch {}
    },
  };

  function mostrar(version) {
    const style = document.createElement('style');
    style.textContent = '.cookie-banner{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:40;' +
      'display:flex;flex-wrap:wrap;gap:12px;align-items:center;max-width:min(680px,calc(100vw - 32px));' +
      'background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);' +
      'padding:14px 18px;box-shadow:0 8px 30px rgba(0,0,0,.18)}' +
      '.cookie-banner p{margin:0;font-size:.9rem;flex:1 1 260px}' +
      '.cookie-banner .btn{padding:8px 14px;font-size:.85rem}';
    document.head.appendChild(style);
    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', ${JSON.stringify(txt(cfg, 'cookies', 'etiqueta', ETIQUETA_DEFAULT))});
    banner.innerHTML = '<p>' + ${JSON.stringify(esc(txt(cfg, 'cookies', 'texto', TEXTO_DEFAULT)))} + '</p>' +
      '<button class="btn" data-consent="accepted">' + ${JSON.stringify(esc(txt(cfg, 'cookies', 'aceptar', ACEPTAR_DEFAULT)))} + '</button>' +
      '<button class="btn ghost" data-consent="essential">' + ${JSON.stringify(esc(txt(cfg, 'cookies', 'esenciales', ESENCIALES_DEFAULT)))} + '</button>';
    banner.addEventListener('click', (e) => {
      const choice = e.target.dataset && e.target.dataset.consent;
      if (!choice) return;
      store.set(choice, version);
      // Aviso para el resto del sitio: el módulo Registro de consentimientos lo persiste
      // en el servidor, y cualquier script de terceros puede escucharlo antes de activarse.
      document.dispatchEvent(new CustomEvent('wf:consent', { detail: { choice: choice, version: version || null } }));
      salir(banner);
    });
    document.body.appendChild(banner);
    entrar(banner);
  }

  // Entrada animada con Anime.js (sube desde abajo). Sin la librería o con "menos movimiento"
  // el banner aparece igual: la animación nunca es condición para verlo.
  function entrar(banner) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) return;
    anime.animate(banner, { opacity: [0, 1], translateY: [24, 0], duration: 420, ease: 'outCubic' });
    // Red de seguridad: Anime.js pausa su loop con la pestaña oculta; esto fija el estado final
    setTimeout(function () { banner.style.opacity = 1; }, 700);
  }

  function salir(banner) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { banner.remove(); return; }
    anime.animate(banner, { opacity: [1, 0], translateY: [0, 20], duration: 260, ease: 'inQuad' });
    setTimeout(function () { banner.remove(); }, 300);
  }

  function decidir(version) {
    var elegido = store.get();
    // Ya eligió y la política no cambió: no molestamos
    if (elegido && (!version || String(store.getVersion() || '') === String(version))) return;
    mostrar(version);
  }

  function arrancar() {
    // Promesa opcional publicada por el módulo Registro de consentimientos con la versión
    // vigente de la política. Si falla (o no está el módulo), el banner funciona igual.
    var p = window.WFConsentVersion;
    if (p && typeof p.then === 'function') p.then(decidir, function () { decidir(null); });
    else decidir(null);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else setTimeout(arrancar, 0);
})();`,
};
