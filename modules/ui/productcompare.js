const { esc } = require('../../src/templates');

// Comparador de productos lado a lado: el visitante marca hasta MAX productos y ve una
// tabla que enfrenta sus atributos (precio y características) columna por columna, con las
// diferencias resaltadas. Todo frontend puro, sin backend ni librerías. Los productos y sus
// atributos son placeholders editables en la constante PRODUCTOS. Distinto de la "Tabla
// comparativa" (esa es una matriz fija de planes): acá el visitante elige qué comparar.
const PRODUCTOS = [
  { nombre: 'Plan Inicial', precio: '$9.999/mes', atributos: { 'Usuarios': '1', 'Almacenamiento': '10 GB', 'Soporte': 'Email', 'Reportes': 'Básicos', 'Integraciones': 'No' } },
  { nombre: 'Plan Profesional', precio: '$24.999/mes', atributos: { 'Usuarios': '10', 'Almacenamiento': '100 GB', 'Soporte': 'Prioritario', 'Reportes': 'Avanzados', 'Integraciones': 'Sí' } },
  { nombre: 'Plan Empresa', precio: '$59.999/mes', atributos: { 'Usuarios': 'Ilimitados', 'Almacenamiento': '1 TB', 'Soporte': '24/7 dedicado', 'Reportes': 'A medida', 'Integraciones': 'Sí + API' } },
  { nombre: 'Plan Equipo', precio: '$39.999/mes', atributos: { 'Usuarios': '25', 'Almacenamiento': '500 GB', 'Soporte': 'Prioritario', 'Reportes': 'Avanzados', 'Integraciones': 'Sí' } },
];

module.exports = {
  id: 'productcompare', type: 'ui', name: 'Comparador de productos',
  description: 'Comparador lado a lado: el visitante elige hasta 3 productos y ve sus atributos enfrentados con las diferencias resaltadas. Frontend puro, sin backend.',
  html: (cfg) => {
    // Con el módulo "comparativa" activo las opciones las pone el backend: hornear los cuatro
    // planes inventados haría que la sección mostrara precios falsos hasta que llegue el fetch,
    // y un precio falso en pantalla —aunque dure medio segundo— es lo peor que puede pasar acá.
    const conBackend = cfg.moduleIds.includes('comparativa');
    // Tarjetas seleccionables; el JSON viaja embebido para que el JS arme la tabla
    const cards = conBackend ? '' : PRODUCTOS.map((p, i) => `        <label class="pc-card">
          <input type="checkbox" class="pc-check" data-i="${i}">
          <span class="pc-nombre">${esc(p.nombre)}</span>
          <span class="pc-precio">${esc(p.precio)}</span>
        </label>`).join('\n');
    return `  <section id="comparador">
    <div class="container">
      <h2>Compará y elegí</h2>
      <p class="section-sub">Marcá hasta 3 opciones para verlas enfrentadas y decidir con toda la información.</p>
      <div class="pc-grid" id="pc-grid">
${cards}
      </div>
      <p class="pc-aviso muted" id="pc-aviso">${conBackend ? 'Cargando opciones…' : 'Elegí al menos 2 opciones para compararlas.'}</p>
      <div class="pc-tabla-wrap" id="pc-tabla"></div>
    </div>
    <script type="application/json" id="pc-datos">${conBackend ? '[]' : JSON.stringify(PRODUCTOS).replace(/</g, '\\u003c')}</script>
  </section>`;
  },
  head: () => `  <style>
    .pc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:18px}
    .pc-card{display:flex;flex-direction:column;gap:4px;background:var(--surface);border:1.5px solid var(--line);border-radius:var(--radius);
      padding:16px;cursor:pointer;position:relative;transition:border-color .2s ease,box-shadow .2s ease}
    .pc-card:has(.pc-check:checked){border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}
    .pc-card:has(.pc-check:disabled){opacity:.5}
    .pc-check{width:auto;margin:0 0 4px}
    .pc-nombre{font-weight:700}
    .pc-precio{color:var(--accent);font-weight:600}
    .pc-tabla-wrap{overflow-x:auto}
    .pc-tabla{width:100%;border-collapse:collapse;min-width:420px}
    .pc-tabla th,.pc-tabla td{padding:11px 14px;border-bottom:1px solid var(--line);text-align:left}
    .pc-tabla thead th{background:var(--surface);font-size:1rem}
    .pc-tabla tbody th,.pc-tabla th[scope=row]{color:var(--muted);font-weight:600;white-space:nowrap}
    .pc-tabla td.dif{background:color-mix(in srgb,var(--accent) 12%,var(--bg));font-weight:600}
  </style>`,
  clientJs: () => `/* Módulo comparador de productos: arma la tabla enfrentada con lo que el visitante
   marca. Los productos se editan en la constante PRODUCTOS de modules/ui/productcompare.js
   (viajan embebidos en un <script type="application/json"> dentro de la sección).
   Expone window.WFComparador para que el módulo funcional "comparativa" (si está activo) le
   pase las opciones reales —propias del panel o el catálogo de productos— y vuelva a pintar. */
(function () {
  var cont = document.getElementById('comparador');
  if (!cont) return;
  var datosEl = document.getElementById('pc-datos');
  var tabla = document.getElementById('pc-tabla');
  var aviso = document.getElementById('pc-aviso');
  var grid = document.getElementById('pc-grid');
  if (!datosEl || !tabla) return;
  var MAX = 3;
  var productos;
  try { productos = JSON.parse(datosEl.textContent); } catch (e) { return; }
  var checks = Array.prototype.slice.call(cont.querySelectorAll('.pc-check'));

  // Dibuja las tarjetas seleccionables desde los datos actuales y vuelve a enganchar los checks:
  // reemplazar el innerHTML sin volver a bindear deja una grilla que se ve bien y no hace nada.
  function pintarCards() {
    if (!grid) return;
    grid.innerHTML = productos.map(function (p, i) {
      return '<label class="pc-card">' +
        '<input type="checkbox" class="pc-check" data-i="' + i + '">' +
        '<span class="pc-nombre">' + App.esc(p.nombre) + '</span>' +
        '<span class="pc-precio">' + App.esc(p.precio) + '</span>' +
      '</label>';
    }).join('');
    checks = Array.prototype.slice.call(cont.querySelectorAll('.pc-check'));
    checks.forEach(function (c) { c.addEventListener('change', render); });
  }

  function seleccionados() {
    return checks.filter(function (c) { return c.checked; }).map(function (c) { return Number(c.getAttribute('data-i')); });
  }

  function render() {
    var sel = seleccionados();
    // Limita a MAX: deshabilita los no marcados cuando se llegó al tope
    checks.forEach(function (c) { c.disabled = !c.checked && sel.length >= MAX; });
    if (sel.length < 2) {
      tabla.innerHTML = '';
      aviso.textContent = productos.length
        ? 'Elegí al menos 2 opciones para compararlas.'
        : 'Todavía no hay opciones para comparar.';
      aviso.style.display = '';
      return;
    }
    aviso.style.display = 'none';
    var elegidos = sel.map(function (i) { return productos[i]; });
    // Filas: precio primero, luego cada atributo (tomando las claves del primero)
    var filas = [{ etiqueta: 'Precio', clave: '__precio' }];
    Object.keys(elegidos[0].atributos).forEach(function (k) { filas.push({ etiqueta: k, clave: k }); });
    var valor = function (p, f) { return f.clave === '__precio' ? p.precio : (p.atributos[f.clave] || '—'); };
    var head = '<thead><tr><th></th>' + elegidos.map(function (p) { return '<th scope="col">' + App.esc(p.nombre) + '</th>'; }).join('') + '</tr></thead>';
    var body = '<tbody>' + filas.map(function (f) {
      var valores = elegidos.map(function (p) { return valor(p, f); });
      // Resalta la fila cuando no todos los valores coinciden (ahí está la diferencia)
      var todosIguales = valores.every(function (v) { return v === valores[0]; });
      return '<tr><th scope="row">' + App.esc(f.etiqueta) + '</th>' +
        valores.map(function (v) { return '<td class="' + (todosIguales ? '' : 'dif') + '">' + App.esc(v) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody>';
    tabla.innerHTML = '<table class="pc-tabla">' + head + body + '</table>';
  }

  checks.forEach(function (c) { c.addEventListener('change', render); });

  // Punto de entrada del módulo funcional "comparativa"
  window.WFComparador = {
    setProductos: function (lista, maximo) {
      productos = Array.isArray(lista) ? lista : [];
      if (Number(maximo) >= 2) MAX = Math.min(6, Math.floor(maximo));
      pintarCards();
      render();
    },
  };

  render();
})();`,
  readmeNotes: (cfg) => [
    cfg.moduleIds.includes('comparativa')
      ? '**Comparador de productos**: con el módulo **Comparador administrable** activo, las opciones salen del backend (propias del panel o **los productos reales del catálogo**) y se editan en `/comparativa-admin.html`; no hace falta tocar la constante `PRODUCTOS`.'
      : '**Comparador de productos**: los productos y sus atributos son placeholders; editalos en la constante `PRODUCTOS` de `modules/ui/productcompare.js`. Se comparan hasta 3 a la vez y las filas con valores distintos se resaltan solas. Activá el módulo **Comparador administrable** para cargarlos desde la web o enfrentar los productos reales de tu catálogo.',
  ],
};
