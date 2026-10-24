// Menú desplegable (submenús) en la navegación: mejora progresiva sobre la navbar.
// El JS inyecta un ítem con panel desplegable dentro de .nav-links usando la lista
// editable MENU. Es accesible (aria-haspopup/aria-expanded, teclado con Enter/Espacio/
// Escape/flechas, foco atrapado dentro del panel abierto) y responsive: en escritorio
// el panel flota bajo el disparador y en móvil (o con el menú hamburguesa) se despliega
// en línea. La apertura se anima con Anime.js (fundido + leve desplazamiento) con red de
// seguridad si el loop está pausado y respeta "prefers-reduced-motion".
module.exports = {
  id: 'megamenu', type: 'ui', name: 'Menú desplegable',
  description: 'Agrega a la navbar un menú desplegable con submenús agrupados (mega menú), accesible y responsive. Los enlaces se editan en public/js/app.js. Animado con Anime.js.',
  usesAnime: true,
  clientJs: () => `/* Módulo menú desplegable: editá los grupos y enlaces en la lista MENU.
   El panel se inyecta en la navbar como mejora progresiva; sin JS la navegación
   queda intacta. Accesible por teclado y con red de seguridad de animación. */
(function () {
  // Editá acá el rótulo del disparador y los grupos de enlaces del panel
  var MENU = {
    rotulo: 'Explorar',
    grupos: [
      { titulo: 'Empresa', enlaces: [
        { texto: 'Nosotros', href: '/about.html' },
        { texto: 'Inicio', href: '/index.html' },
      ] },
      { titulo: 'Explorar', enlaces: [
        { texto: 'Servicios', href: '/index.html#servicios' },
        { texto: 'Contacto', href: '/index.html#contacto' },
      ] },
    ],
  };
  var links = document.querySelector('.navbar .nav-links');
  if (!links) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var style = document.createElement('style');
  style.textContent = '.megamenu{position:relative}' +
    '.megamenu-btn{display:inline-flex;align-items:center;gap:6px;width:auto;background:none;border:0;color:var(--text);font:inherit;font-size:.95rem;cursor:pointer;padding:0}' +
    '.megamenu-btn:hover,.megamenu-btn[aria-expanded="true"]{color:var(--accent)}' +
    '.megamenu-btn .megamenu-flecha{transition:transform .2s ease;font-size:.7em}' +
    '.megamenu-btn[aria-expanded="true"] .megamenu-flecha{transform:rotate(180deg)}' +
    '.megamenu-panel{position:absolute;top:calc(100% + 12px);left:0;z-index:20;display:none;gap:22px;' +
    'background:var(--bg);border:1px solid var(--line);border-radius:calc(var(--radius) + 4px);' +
    'box-shadow:0 20px 50px rgba(0,0,0,.16);padding:18px 22px;min-width:340px}' +
    '.megamenu-panel.abierto{display:flex}' +
    '.megamenu-col h4{margin:0 0 8px;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}' +
    '.megamenu-col a{display:block;padding:5px 0;color:var(--text);text-decoration:none;font-size:.95rem;white-space:nowrap}' +
    '.megamenu-col a:hover,.megamenu-col a:focus{color:var(--accent)}' +
    '@media (max-width: 720px){.megamenu{width:100%}.megamenu-panel{position:static;flex-direction:column;gap:10px;' +
    'min-width:0;box-shadow:none;border:0;border-left:2px solid var(--line);border-radius:0;padding:6px 0 6px 14px;margin-top:8px}}';
  document.head.appendChild(style);

  var cont = document.createElement('div');
  cont.className = 'megamenu';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'megamenu-btn';
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = App.esc(MENU.rotulo) + ' <span class="megamenu-flecha" aria-hidden="true">▾</span>';
  var panel = document.createElement('div');
  panel.className = 'megamenu-panel';
  panel.setAttribute('role', 'menu');
  MENU.grupos.forEach(function (g) {
    var col = document.createElement('div');
    col.className = 'megamenu-col';
    var h = document.createElement('h4');
    h.textContent = g.titulo;
    col.appendChild(h);
    (g.enlaces || []).forEach(function (e) {
      var a = document.createElement('a');
      a.href = e.href;
      a.textContent = e.texto;
      a.setAttribute('role', 'menuitem');
      col.appendChild(a);
    });
    panel.appendChild(col);
  });
  cont.appendChild(btn);
  cont.appendChild(panel);
  links.appendChild(cont);

  function enlacesFoco() { return panel.querySelectorAll('a'); }
  function abrir() {
    panel.classList.add('abierto');
    btn.setAttribute('aria-expanded', 'true');
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(panel, { opacity: [0, 1], translateY: [-8, 0], duration: 200, ease: 'outQuad' });
      // Red de seguridad: fija el estado final si el loop está pausado (pestaña oculta)
      setTimeout(function () { panel.style.opacity = '1'; panel.style.transform = ''; }, 260);
    }
    document.addEventListener('click', afuera, true);
  }
  function cerrar(devolverFoco) {
    if (!panel.classList.contains('abierto')) return;
    panel.classList.remove('abierto');
    panel.style.opacity = '';
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', afuera, true);
    if (devolverFoco) btn.focus();
  }
  function afuera(e) { if (!cont.contains(e.target)) cerrar(false); }
  function toggle() { panel.classList.contains('abierto') ? cerrar(false) : abrir(); }

  btn.addEventListener('click', function (e) { e.preventDefault(); toggle(); });
  btn.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!panel.classList.contains('abierto')) abrir();
      var f = enlacesFoco(); if (f.length) f[0].focus();
    } else if (e.key === 'Escape') { cerrar(true); }
  });
  panel.addEventListener('keydown', function (e) {
    var f = enlacesFoco();
    if (!f.length) return;
    var i = Array.prototype.indexOf.call(f, document.activeElement);
    if (e.key === 'Escape') { cerrar(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); f[Math.min(i + 1, f.length - 1)].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); i <= 0 ? btn.focus() : f[i - 1].focus(); }
    else if (e.key === 'Tab' && !e.shiftKey && i === f.length - 1) { cerrar(false); }
  });
  // Al elegir un enlace del panel, cerrar (útil también dentro del menú hamburguesa)
  panel.addEventListener('click', function (e) { if (e.target.closest('a')) cerrar(false); });
})();`,
  readmeNotes: () => [
    '**Menú desplegable**: los grupos y enlaces del mega menú se editan en la constante `MENU` de `public/js/app.js` (buscá "menú desplegable"). El disparador se agrega solo a la navbar y convive con el menú hamburguesa.',
  ],
};
