const { phIcon } = require('../../src/icons');

// Iconos Phosphor horneados para el toggle: luna cuando el sitio está en claro (invita a oscuro),
// sol cuando está en oscuro (invita a claro). Sin emojis: SVG inline que hereda el color del texto.
const ICON_MOON = phIcon('moon', { size: 20 });
const ICON_SUN = phIcon('sun', { size: 20 });

module.exports = {
  id: 'darkmode', type: 'ui', name: 'Modo oscuro',
  description: 'Botón claro/oscuro en la navbar con icono Phosphor animado (sol/luna): recuerda la preferencia y respeta el modo del sistema.',
  usesAnime: true,
  // Icono horneado en la navbar (html: markup confiable, no se escapa; icon: sin subrayado animado)
  nav: () => [{ label: ICON_MOON, href: '#', id: 'theme-toggle', html: true, icon: true }],
  head: () => `  <style>
    #theme-toggle { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 999px; color: var(--text); }
    #theme-toggle:hover { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
    #theme-toggle svg { display: block; }
  </style>`,
  clientJs: () => `/* Módulo modo oscuro: alterna el tema invirtiendo las variables base y cambia el icono
   (sol/luna) con una animación de rotación + escala (Anime.js) con red de seguridad. El resto de
   la paleta (surface, muted, line) deriva de --bg y --text vía color-mix. */
(function () {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  var ICON = { moon: '${ICON_MOON}', sun: '${ICON_SUN}' };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var style = document.createElement('style');
  style.textContent = ':root[data-theme="dark"]{--bg:#0d1220;--text:#e7eaf0;color-scheme:dark}';
  document.head.appendChild(style);
  // localStorage puede fallar en contextos aislados (p. ej. el iframe del preview)
  var store = {
    get: function () { try { return localStorage.getItem('theme'); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem('theme', v); } catch (e) {} },
  };
  var system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  var theme = store.get() === 'dark' || store.get() === 'light' ? store.get() : system;

  function apply(animate) {
    document.documentElement.dataset.theme = theme;
    // En oscuro mostramos el sol (acción = ir a claro) y viceversa
    var name = theme === 'dark' ? 'sun' : 'moon';
    btn.innerHTML = ICON[name];
    btn.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    var svg = btn.querySelector('svg');
    var anime = window.anime;
    if (svg && animate && anime && anime.animate && !reduce) {
      anime.animate(svg, { rotate: [-120, 0], scale: [0.3, 1], opacity: [0, 1], duration: 500, ease: 'outBack' });
      // Red de seguridad: si el loop está pausado (pestaña oculta) deja el icono en su estado final
      setTimeout(function () { svg.style.opacity = 1; svg.style.transform = 'none'; }, 800);
    }
  }

  btn.addEventListener('click', function (e) {
    e.preventDefault();
    theme = theme === 'dark' ? 'light' : 'dark';
    store.set(theme);
    apply(true);
  });
  apply(false);
})();`,
};
