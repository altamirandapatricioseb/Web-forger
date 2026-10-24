const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'datatable', type: 'ui', name: 'Tablas con orden y búsqueda',
  description: 'Todas las tablas del sitio pasan a ordenarse por columna (clic en el encabezado, con soporte de teclado) y las de más de 5 filas suman un buscador. Sin cambiar el HTML.',
  clientJs: () => `/* Módulo tablas: orden por columna + buscador. Mejora progresiva sobre
   cualquier <table> del sitio, incluidas las que los otros módulos renderizan
   dinámicamente con App.table (se detectan con un MutationObserver). */
(function () {
  var style = document.createElement('style');
  style.textContent = 'thead th{cursor:pointer;user-select:none;white-space:nowrap}' +
    'thead th:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}' +
    'thead th .orden-flecha{font-size:.7em;opacity:.65;margin-left:4px}' +
    '.tabla-buscador{padding:12px 12px 0}' +
    '.tabla-buscador input{max-width:280px;padding:7px 10px;font-size:.9rem}';
  document.head.appendChild(style);

  // Números en formato es-AR ("$1.234,56", "15 %") → valor comparable; NaN si no lo es.
  // El test inicial excluye fechas y códigos: esos se ordenan como texto (localeCompare numeric).
  function numeroDe(txt) {
    if (!/^[$\\s]*-?[\\d.,]+\\s*%?$/.test(txt)) return NaN;
    var limpio = txt.replace(/[^0-9.,\\-]/g, '');
    if (limpio.indexOf(',') >= 0 && limpio.indexOf('.') >= 0) limpio = limpio.split('.').join('').replace(',', '.');
    else if (limpio.indexOf(',') >= 0) limpio = limpio.replace(',', '.');
    else if (/^-?\\d{1,3}(\\.\\d{3})+$/.test(limpio)) limpio = limpio.split('.').join('');
    return parseFloat(limpio);
  }

  function ordenar(th) {
    var table = th.closest('table');
    var tbody = table && table.tBodies[0];
    if (!tbody || tbody.rows.length < 2) return;
    var idx = Array.prototype.indexOf.call(th.parentNode.children, th);
    var asc = th.getAttribute('aria-sort') !== 'ascending';
    // Un solo encabezado queda marcado como orden activo
    Array.prototype.forEach.call(th.parentNode.children, function (o) {
      o.removeAttribute('aria-sort');
      var f = o.querySelector('.orden-flecha');
      if (f) f.remove();
    });
    th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
    var flecha = document.createElement('span');
    flecha.className = 'orden-flecha';
    flecha.setAttribute('aria-hidden', 'true');
    flecha.innerHTML = asc ? '${phIcon('caret-up', { size: 12 })}' : '${phIcon('caret-down', { size: 12 })}';
    th.appendChild(flecha);
    var filas = Array.prototype.slice.call(tbody.rows);
    filas.sort(function (a, b) {
      var ta = a.cells[idx] ? a.cells[idx].textContent.trim() : '';
      var tb = b.cells[idx] ? b.cells[idx].textContent.trim() : '';
      var na = numeroDe(ta), nb = numeroDe(tb);
      var r = (!isNaN(na) && !isNaN(nb)) ? na - nb : ta.localeCompare(tb, 'es', { numeric: true, sensitivity: 'base' });
      return asc ? r : -r;
    });
    for (var i = 0; i < filas.length; i++) tbody.appendChild(filas[i]);
  }

  // Delegación: clic o Enter/Espacio en cualquier encabezado ordena su tabla
  document.addEventListener('click', function (e) {
    var th = e.target.closest && e.target.closest('thead th');
    if (th) ordenar(th);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var th = e.target.closest && e.target.closest('thead th');
    if (th) { e.preventDefault(); ordenar(th); }
  });

  function mejorar(table) {
    if (table.dataset.mejorada) return;
    table.dataset.mejorada = '1';
    var tbody = table.tBodies[0];
    if (!table.tHead || !tbody || tbody.rows.length < 2) return;
    // Encabezados operables con teclado
    Array.prototype.forEach.call(table.tHead.rows[0].cells, function (th) {
      th.tabIndex = 0;
      th.title = 'Ordenar por esta columna';
    });
    // Buscador solo cuando hay volumen que justifique filtrar
    if (tbody.rows.length <= 5) return;
    var caja = document.createElement('div');
    caja.className = 'tabla-buscador';
    var input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Buscar en la tabla…';
    input.setAttribute('aria-label', 'Buscar en la tabla');
    caja.appendChild(input);
    table.parentNode.insertBefore(caja, table);
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      Array.prototype.forEach.call(tbody.rows, function (fila) {
        fila.style.display = !q || fila.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
      });
    });
  }

  function barrer(raiz) {
    if (raiz.querySelectorAll) Array.prototype.forEach.call(raiz.querySelectorAll('table'), mejorar);
    if (raiz.tagName === 'TABLE') mejorar(raiz);
  }
  barrer(document);
  // Las tablas que App.table inyecta después de un fetch también se mejoran
  new MutationObserver(function (cambios) {
    for (var i = 0; i < cambios.length; i++) {
      for (var j = 0; j < cambios[i].addedNodes.length; j++) {
        var n = cambios[i].addedNodes[j];
        if (n.nodeType === 1) barrer(n);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
})();`,
};
