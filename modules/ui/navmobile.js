const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'navmobile', type: 'ui', name: 'Menú hamburguesa',
  description: 'Navbar responsive: en pantallas chicas los links se pliegan en un menú hamburguesa accesible.',
  clientJs: () => `/* Módulo menú hamburguesa: en pantallas chicas oculta los links de la navbar
   y los despliega con un botón. Sin JS la navbar queda como está (los links visibles),
   así que el menú nunca puede dejar la navegación inaccesible. */
(function () {
  var links = document.querySelector('.navbar .nav-links');
  if (!links) return;
  var style = document.createElement('style');
  style.textContent = '.nav-toggle{display:none;border:0;background:transparent;color:var(--text);' +
    'font-size:1.5rem;cursor:pointer;padding:4px 8px;line-height:1}' +
    '@media (max-width: 720px){' +
    '.navbar .container{flex-wrap:wrap;height:auto;padding-top:12px;padding-bottom:12px}' +
    '.nav-toggle{display:inline-block}' +
    '.navbar .nav-links{display:none;width:100%;flex-direction:column;align-items:flex-start;gap:12px;padding:12px 0 6px}' +
    '.navbar .nav-links.open{display:flex}}';
  document.head.appendChild(style);
  // Glifos Phosphor horneados en build (hamburguesa / cruz)
  var ICONO_MENU = '${phIcon('list', { size: 24 })}';
  var ICONO_CERRAR = '${phIcon('x', { size: 24 })}';
  var btn = document.createElement('button');
  btn.className = 'nav-toggle';
  btn.type = 'button';
  btn.innerHTML = ICONO_MENU;
  btn.setAttribute('aria-label', 'Abrir menú');
  btn.setAttribute('aria-expanded', 'false');
  // El botón va entre la marca y los links para que el flex lo deje a la derecha
  links.parentNode.insertBefore(btn, links);
  function set(open) {
    links.classList.toggle('open', open);
    btn.innerHTML = open ? ICONO_CERRAR : ICONO_MENU;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }
  btn.addEventListener('click', function () { set(!links.classList.contains('open')); });
  // Al navegar por un link o apretar Escape el menú se cierra
  links.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && links.classList.contains('open')) { set(false); btn.focus(); }
  });
})();`,
};
