module.exports = {
  id: 'branchselector', type: 'ui', name: 'Selector de sucursal',
  description: 'Selector de sucursal/ciudad: el visitante elige una sede y ve su dirección, horario, teléfono y un botón "Cómo llegar" (Google Maps sin API key). Recuerda la elegida en el navegador. La transición usa Anime.js.',
  usesAnime: true,
  // Frontend puro: las sucursales son placeholders editables en el JS. El botón de mapa
  // abre una búsqueda de Google Maps por dirección (no necesita clave ni SDK).
  html: () => `  <section id="sucursales">
    <div class="container">
      <h2>Encontrá tu sucursal</h2>
      <p class="section-sub">Elegí la más cercana para ver la dirección, los horarios y cómo llegar.</p>
      <div class="suc-card card" data-suc>
        <label class="suc-campo">
          <span>Sucursal</span>
          <select data-suc-select>
            <option value="0">Sucursal Centro</option>
            <option value="1">Sucursal Norte</option>
            <option value="2">Sucursal Sur</option>
          </select>
        </label>
        <div class="suc-info" data-suc-info></div>
      </div>
    </div>
  </section>`,
  head: () => `  <style>
    .suc-card{display:grid;grid-template-columns:1fr 1.4fr;gap:26px;align-items:start;max-width:820px;margin:24px auto 0}
    .suc-campo{display:flex;flex-direction:column;gap:6px;font-size:.9rem;font-weight:600}
    .suc-info h3{margin:0 0 10px;font-size:1.2rem}
    .suc-dato{margin:0 0 6px;font-size:.94rem;color:var(--muted)}
    .suc-dato b{color:var(--text);font-weight:600}
    .suc-info .btn{margin-top:12px}
    @media (max-width:640px){.suc-card{grid-template-columns:1fr}}
  </style>`,
  clientJs: () => `// Módulo selector de sucursal: al cambiar el select repinta la ficha y recuerda la
// elección en localStorage. La transición de la ficha se anima con Anime.js si está.
// Editá SUCURSALES con tus sedes reales. Sin JS, el select queda visible sin ficha.
(function () {
  var raiz = document.querySelector('[data-suc]');
  if (!raiz) return;
  var sel = raiz.querySelector('[data-suc-select]');
  var info = raiz.querySelector('[data-suc-info]');
  if (!sel || !info) return;
  var SUCURSALES = [
    { nombre: 'Sucursal Centro', direccion: 'Av. Corrientes 1234, CABA', horario: 'Lun a Vie 9 a 19 · Sáb 9 a 13', tel: '+54 11 5555-1000' },
    { nombre: 'Sucursal Norte', direccion: 'Av. Cabildo 4567, CABA', horario: 'Lun a Vie 10 a 20 · Sáb 10 a 14', tel: '+54 11 5555-2000' },
    { nombre: 'Sucursal Sur', direccion: 'Av. Mitre 890, Avellaneda', horario: 'Lun a Vie 9 a 18', tel: '+54 11 5555-3000' }
  ];
  var KEY = 'sucursal-elegida';
  function mapsUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  function pintar(i) {
    var s = SUCURSALES[i] || SUCURSALES[0];
    var telLimpio = s.tel.replace(/[^+\\d]/g, '');
    info.innerHTML = '<h3>' + App.esc(s.nombre) + '</h3>' +
      '<p class="suc-dato"><b>Dirección:</b> ' + App.esc(s.direccion) + '</p>' +
      '<p class="suc-dato"><b>Horario:</b> ' + App.esc(s.horario) + '</p>' +
      '<p class="suc-dato"><b>Teléfono:</b> <a href="tel:' + App.esc(telLimpio) + '">' + App.esc(s.tel) + '</a></p>' +
      '<a class="btn" target="_blank" rel="noopener" href="' + mapsUrl(s.direccion) + '">Cómo llegar</a>';
    var anime = window.anime;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Adorno: la ficha entra con un fundido corto si Anime.js está disponible
    if (anime && anime.animate && !reduce) {
      anime.animate(info, { opacity: [0, 1], translateY: [8, 0], duration: 340 });
      // Red de seguridad: si el motor está pausado (pestaña oculta) igual dejamos la ficha
      // visible; nunca queda en opacidad 0 por una animación que no llegó a correr
      setTimeout(function () { info.style.opacity = ''; info.style.transform = ''; }, 450);
    }
  }
  var guardada = parseInt(localStorage.getItem(KEY), 10);
  if (!isNaN(guardada) && SUCURSALES[guardada]) sel.value = String(guardada);
  sel.addEventListener('change', function () {
    var i = parseInt(sel.value, 10) || 0;
    try { localStorage.setItem(KEY, String(i)); } catch (e) {}
    pintar(i);
  });
  pintar(parseInt(sel.value, 10) || 0);
})();`,
  readmeNotes: () => [
    '**Selector de sucursal**: las sedes son placeholders. Editá la lista `SUCURSALES` en `public/js/app.js` (buscá "selector de sucursal") con tus direcciones, horarios y teléfonos reales. Sumá o quitá `<option>` en la sección `sucursales` de `public/index.html` para que coincidan con la cantidad de sucursales.',
  ],
};
