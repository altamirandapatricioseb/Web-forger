const { phIcon } = require('../../src/icons');

// Paleta de comandos / buscador global con atajos de teclado (estilo Cmd+K de apps
// modernas). Se abre con Ctrl/Cmd+K o con la tecla "/", y también con un botón "⌘K"
// que se inyecta en la navbar. Indexa las páginas del sitio (los links de la navbar),
// los títulos de sección de la página actual (cada h2) y una lista editable de acciones
// rápidas (ACCIONES). Filtra en vivo, se navega con flechas + Enter y se cierra con Esc.
// Distinto del "Buscador" (ese filtra tarjetas dentro de la página): esta es una capa de
// navegación rápida a cualquier parte del sitio. La apertura se anima con Anime.js con
// red de seguridad si el loop está pausado; respeta "prefers-reduced-motion".
module.exports = {
  id: 'commandpalette', type: 'ui', name: 'Paleta de comandos (⌘K)',
  description: 'Buscador global con atajos de teclado (Ctrl/Cmd+K): salta a cualquier página, sección o acción rápida del sitio. Se navega con flechas y Enter. Animado con Anime.js.',
  usesAnime: true,
  clientJs: () => `/* Módulo paleta de comandos: navegación rápida con Ctrl/Cmd+K o "/".
   Editá ACCIONES para sumar accesos directos propios (por ejemplo a un teléfono o a
   WhatsApp). Las páginas se toman solas de la navbar y las secciones de los <h2>. */
(function () {
  // Acciones rápidas extra, editables (además de páginas y secciones autodetectadas)
  var ACCIONES = [
    { texto: 'Ir al inicio de la página', icono: '${phIcon('arrow-up', { size: 14 })}', accion: function () { window.scrollTo({ top: 0, behavior: 'smooth' }); } },
    { texto: 'Ir al final de la página', icono: '${phIcon('arrow-down', { size: 14 })}', accion: function () { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } },
  ];
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var abierto = false, ultimoFoco = null, items = [], filtrados = [], sel = 0;
  var fondo, caja, input, lista;

  // Arma el índice: páginas (navbar) + secciones (h2 con id) + acciones rápidas
  function construirIndice() {
    var idx = [];
    Array.prototype.slice.call(document.querySelectorAll('.nav-links a')).forEach(function (a) {
      var txt = (a.textContent || '').replace(/\\s+/g, ' ').trim();
      if (txt) idx.push({ texto: txt, icono: '${phIcon('arrow-right', { size: 14 })}', grupo: 'Páginas', href: a.getAttribute('href') });
    });
    Array.prototype.slice.call(document.querySelectorAll('main h2, section h2')).forEach(function (h) {
      var txt = (h.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!txt) return;
      var cont = h.closest('section') || h.parentNode;
      var id = cont && cont.id;
      idx.push({ texto: txt, icono: '#', grupo: 'En esta página', accion: function () {
        (id ? document.getElementById(id) : h).scrollIntoView({ behavior: 'smooth', block: 'start' });
      } });
    });
    ACCIONES.forEach(function (a) { idx.push({ texto: a.texto, icono: a.icono || '•', grupo: 'Acciones', accion: a.accion }); });
    return idx;
  }

  function normalizar(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); }

  function render() {
    var q = normalizar(input.value.trim());
    filtrados = q ? items.filter(function (it) { return normalizar(it.texto).indexOf(q) !== -1; }) : items;
    sel = 0;
    if (!filtrados.length) { lista.innerHTML = '<li class="cmdk-vacio">Sin resultados</li>'; return; }
    var grupoPrev = null, html = '';
    filtrados.forEach(function (it, i) {
      if (it.grupo !== grupoPrev) { html += '<li class="cmdk-grupo" aria-hidden="true">' + App.esc(it.grupo) + '</li>'; grupoPrev = it.grupo; }
      html += '<li class="cmdk-item" role="option" id="cmdk-op-' + i + '" data-i="' + i + '">' +
        '<span class="cmdk-ico" aria-hidden="true">' + it.icono + '</span>' + App.esc(it.texto) + '</li>';
    });
    lista.innerHTML = html;
    marcarSel();
  }

  function marcarSel() {
    var ops = lista.querySelectorAll('.cmdk-item');
    ops.forEach(function (op, i) {
      var activo = i === sel;
      op.classList.toggle('sel', activo);
      op.setAttribute('aria-selected', activo ? 'true' : 'false');
      if (activo) { input.setAttribute('aria-activedescendant', op.id); op.scrollIntoView({ block: 'nearest' }); }
    });
  }

  function ejecutar(it) {
    cerrar();
    if (!it) return;
    if (it.href) window.location.href = it.href;
    else if (it.accion) it.accion();
  }

  function abrir() {
    if (abierto) return;
    abierto = true;
    ultimoFoco = document.activeElement;
    items = construirIndice();
    fondo = document.createElement('div');
    fondo.className = 'cmdk-fondo';
    caja = document.createElement('div');
    caja.className = 'cmdk-caja';
    caja.setAttribute('role', 'dialog');
    caja.setAttribute('aria-modal', 'true');
    caja.setAttribute('aria-label', 'Buscar y navegar');
    caja.innerHTML =
      '<input type="text" class="cmdk-input" role="combobox" aria-expanded="true" aria-controls="cmdk-lista" aria-autocomplete="list" placeholder="Buscar páginas, secciones o acciones…" autocomplete="off">' +
      '<ul class="cmdk-lista" id="cmdk-lista" role="listbox"></ul>' +
      '<div class="cmdk-pie"><span>↑↓ moverse</span><span>↵ ir</span><span>esc cerrar</span></div>';
    fondo.appendChild(caja);
    document.body.appendChild(fondo);
    input = caja.querySelector('.cmdk-input');
    lista = caja.querySelector('.cmdk-lista');
    render();
    input.focus();
    input.addEventListener('input', render);
    lista.addEventListener('mousemove', function (e) {
      var li = e.target.closest('.cmdk-item');
      if (li) { sel = Number(li.getAttribute('data-i')); marcarSel(); }
    });
    lista.addEventListener('click', function (e) {
      var li = e.target.closest('.cmdk-item');
      if (li) ejecutar(filtrados[Number(li.getAttribute('data-i'))]);
    });
    fondo.addEventListener('mousedown', function (e) { if (e.target === fondo) cerrar(); });
    document.addEventListener('keydown', porTecla, true);
    // Animación de apertura con Anime.js (con red de seguridad)
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(fondo, { opacity: [0, 1], duration: 160 });
      anime.animate(caja, { opacity: [0, 1], translateY: [-14, 0], scale: [0.98, 1], duration: 220, ease: 'outCubic' });
      setTimeout(function () { fondo.style.opacity = '1'; caja.style.opacity = ''; caja.style.transform = ''; }, 280);
    }
  }

  function cerrar() {
    if (!abierto) return;
    abierto = false;
    document.removeEventListener('keydown', porTecla, true);
    if (fondo) fondo.remove();
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  function porTecla(e) {
    if (!abierto) return;
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (filtrados.length) { sel = (sel + 1) % filtrados.length; marcarSel(); } return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (filtrados.length) { sel = (sel - 1 + filtrados.length) % filtrados.length; marcarSel(); } return; }
    if (e.key === 'Enter') { e.preventDefault(); ejecutar(filtrados[sel]); return; }
    if (e.key === 'Tab') { e.preventDefault(); } // atrapa el foco dentro del diálogo (sólo hay un input)
  }

  // Atajos globales: Ctrl/Cmd+K, o "/" cuando no se está escribiendo en un campo
  document.addEventListener('keydown', function (e) {
    var enCampo = /^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); abierto ? cerrar() : abrir(); return; }
    if (e.key === '/' && !enCampo && !abierto) { e.preventDefault(); abrir(); }
  });

  // Botón discreto en la navbar para descubrir el atajo (si hay navbar)
  var navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'cmdk-trigger';
    boton.setAttribute('aria-label', 'Buscar (Ctrl o Cmd + K)');
    var esMac = /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
    boton.innerHTML = '${phIcon('magnifying-glass', { size: 16 })} <kbd>' + (esMac ? '⌘' : 'Ctrl') + 'K</kbd>';
    boton.addEventListener('click', abrir);
    navLinks.appendChild(boton);
  }
})();`,
  head: () => `  <style>
    .cmdk-trigger{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--line);color:var(--muted);
      border-radius:999px;padding:5px 12px;font:inherit;font-size:.82rem;cursor:pointer;line-height:1}
    .cmdk-trigger:hover{color:var(--accent);border-color:var(--accent)}
    .cmdk-trigger kbd{font-family:inherit;font-size:.72rem;background:var(--bg);border:1px solid var(--line);border-radius:5px;padding:1px 5px}
    .cmdk-fondo{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:80;display:flex;align-items:flex-start;justify-content:center;padding:12vh 16px 16px}
    .cmdk-caja{background:var(--bg);color:var(--text);width:100%;max-width:560px;border-radius:calc(var(--radius) + 4px);
      border:1px solid var(--line);box-shadow:0 24px 70px rgba(0,0,0,.35);overflow:hidden;display:flex;flex-direction:column;max-height:70vh}
    .cmdk-input{border:0;border-bottom:1px solid var(--line);border-radius:0;padding:16px 18px;font-size:1.05rem;background:transparent}
    .cmdk-input:focus{outline:none}
    .cmdk-lista{list-style:none;margin:0;padding:6px;overflow:auto;flex:1}
    .cmdk-grupo{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:10px 12px 4px}
    .cmdk-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius);cursor:pointer;font-size:.95rem}
    .cmdk-item.sel{background:color-mix(in srgb,var(--accent) 16%,var(--bg))}
    .cmdk-ico{width:22px;text-align:center;color:var(--accent);flex:none}
    .cmdk-vacio{padding:20px 12px;color:var(--muted);text-align:center}
    .cmdk-pie{display:flex;gap:16px;padding:9px 14px;border-top:1px solid var(--line);font-size:.75rem;color:var(--muted)}
  </style>`,
  readmeNotes: () => [
    '**Paleta de comandos (⌘K)**: se abre con `Ctrl/Cmd+K` o con la tecla `/`. Indexa sola las páginas de la navbar y las secciones (`<h2>`) de cada página. Para sumar accesos directos propios (teléfono, WhatsApp, etc.) editá la constante `ACCIONES` en `public/js/app.js` (buscá "paleta de comandos").',
  ],
};
