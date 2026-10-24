const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'a11y', type: 'ui', name: 'Accesibilidad',
  description: 'Enlace "Saltar al contenido" y botón flotante con opciones de accesibilidad: tamaño del texto, alto contraste y subrayado de enlaces. Recuerda las preferencias del visitante.',
  clientJs: () => `/* Módulo accesibilidad: skip-link + panel de preferencias visuales persistidas */
(function () {
  // Tamaños de texto disponibles, en % sobre el tamaño base del navegador
  var TAMANOS = [100, 112.5, 125, 137.5];

  var style = document.createElement('style');
  // El selector doble le gana en especificidad al modo oscuro sin importar el orden de carga
  style.textContent =
    '.skip-link{position:absolute;left:-9999px;top:0;background:var(--accent);color:#fff;padding:10px 16px;z-index:100;border-radius:0 0 var(--radius) 0;font-weight:600}' +
    '.skip-link:focus{left:0}' +
    ':root[data-contrast="alto"][data-contrast="alto"]{--bg:#000;--text:#fff;--muted:#d6d6d6;--line:#777;--surface:#111;--accent:#ffd400;color-scheme:dark}' +
    ':root[data-contrast="alto"] .btn{color:#000}' +
    ':root[data-underline="si"] a{text-decoration:underline!important}';
  document.head.appendChild(style);

  // Skip-link como primer elemento del body, apuntando a lo que sigue a la navbar
  var nav = document.querySelector('.navbar');
  var destino = nav && nav.nextElementSibling ? nav.nextElementSibling : document.body.firstElementChild;
  if (destino) {
    destino.id = destino.id || 'contenido';
    destino.setAttribute('tabindex', '-1');
    var skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#' + destino.id;
    skip.textContent = 'Saltar al contenido';
    document.body.insertBefore(skip, document.body.firstChild);
  }

  // localStorage puede fallar en contextos aislados (p. ej. el iframe del preview)
  var store = {
    get() { try { return JSON.parse(localStorage.getItem('a11y') || '{}'); } catch { return {}; } },
    set(v) { try { localStorage.setItem('a11y', JSON.stringify(v)); } catch {} },
  };
  var prefs = store.get();

  function aplicar() {
    document.documentElement.style.fontSize = (prefs.size && prefs.size !== 100) ? prefs.size + '%' : '';
    if (prefs.contrast) document.documentElement.dataset.contrast = 'alto';
    else delete document.documentElement.dataset.contrast;
    if (prefs.underline) document.documentElement.dataset.underline = 'si';
    else delete document.documentElement.dataset.underline;
    store.set(prefs);
  }
  aplicar();

  // Botón flotante abajo a la izquierda (WhatsApp y volver-arriba usan la derecha)
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'a11y-boton';
  btn.innerHTML = '${phIcon('wheelchair', { size: 20 })}';
  btn.setAttribute('aria-label', 'Opciones de accesibilidad');
  btn.setAttribute('aria-expanded', 'false');
  btn.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:55;width:48px;height:48px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--text);font-size:1.3rem;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18)';
  document.body.appendChild(btn);

  var panel = document.createElement('div');
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Preferencias de accesibilidad');
  panel.style.cssText = 'position:fixed;bottom:76px;left:20px;z-index:55;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:var(--radius);padding:14px;display:none;min-width:220px;box-shadow:0 10px 30px rgba(0,0,0,.2)';
  panel.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">' +
    '<span style="font-size:.9rem;font-weight:600">Tamaño del texto</span>' +
    '<span style="display:flex;gap:6px">' +
    '<button type="button" class="btn ghost" id="a11y-menos" aria-label="Achicar texto" style="padding:4px 10px">A−</button>' +
    '<button type="button" class="btn ghost" id="a11y-mas" aria-label="Agrandar texto" style="padding:4px 10px">A+</button>' +
    '</span></div>' +
    '<label style="display:flex;align-items:center;gap:8px;margin:8px 0;font-size:.9rem;font-weight:400;cursor:pointer">' +
    '<input type="checkbox" id="a11y-contraste" style="width:auto"> Alto contraste</label>' +
    '<label style="display:flex;align-items:center;gap:8px;margin:8px 0;font-size:.9rem;font-weight:400;cursor:pointer">' +
    '<input type="checkbox" id="a11y-subrayado" style="width:auto"> Subrayar enlaces</label>';
  document.body.appendChild(panel);

  var chkContraste = panel.querySelector('#a11y-contraste');
  var chkSubrayado = panel.querySelector('#a11y-subrayado');
  chkContraste.checked = !!prefs.contrast;
  chkSubrayado.checked = !!prefs.underline;

  btn.addEventListener('click', function () {
    var abierto = panel.style.display !== 'none';
    panel.style.display = abierto ? 'none' : 'block';
    btn.setAttribute('aria-expanded', String(!abierto));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.style.display !== 'none') {
      panel.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });

  panel.querySelector('#a11y-mas').addEventListener('click', function () {
    var i = TAMANOS.indexOf(prefs.size || 100);
    prefs.size = TAMANOS[Math.min(i + 1, TAMANOS.length - 1)];
    aplicar();
  });
  panel.querySelector('#a11y-menos').addEventListener('click', function () {
    var i = TAMANOS.indexOf(prefs.size || 100);
    prefs.size = TAMANOS[Math.max(i - 1, 0)];
    aplicar();
  });
  chkContraste.addEventListener('change', function () { prefs.contrast = chkContraste.checked; aplicar(); });
  chkSubrayado.addEventListener('change', function () { prefs.underline = chkSubrayado.checked; aplicar(); });
})();`,
};
