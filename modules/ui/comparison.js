const { esc, txt, txtList } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

// Planes en columnas; "destacado" resalta la columna recomendada
const PLANES = [
  { nombre: 'Básico', destacado: false },
  { nombre: 'Pro', destacado: true },
  { nombre: 'Empresa', destacado: false },
];
// Cada fila: característica y su valor por plan (true=✓, false=✕, string=texto libre)
const FILAS = [
  { c: 'Usuarios incluidos', v: ['1', '10', 'Ilimitados'] },
  { c: 'Soporte por email', v: [true, true, true] },
  { c: 'Soporte prioritario', v: [false, true, true] },
  { c: 'Reportes avanzados', v: [false, true, true] },
  { c: 'Integraciones', v: [false, '5', 'Ilimitadas'] },
  { c: 'Gestor de cuenta dedicado', v: [false, false, true] },
];

// Palabras que en los campos editables significan "incluido" / "no incluido". Cualquier
// otra cosa se muestra tal cual como texto libre (por ejemplo "10" o "Ilimitados").
const SI = ['si', 'sí', 'x', '✓', 'true', 'incluido'];
const NO = ['no', '-', '—', '✕', 'false', 'no incluido'];
// Marcas admitidas para señalar la columna recomendada
const DESTACADO = SI.concat(['destacado', 'recomendado']);

// Cómo se escribe un valor de celda en el campo editable (para armar los defaults)
const comoTexto = (v) => (v === true ? 'sí' : v === false ? 'no' : String(v));

// Defaults de los campos editables: exactamente los planes y filas de arriba, para que el
// panel arranque mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const PLANES_DEFAULT = PLANES.map(p => (p.destacado ? `${p.nombre} | destacado` : p.nombre)).join('\n');
const FILAS_DEFAULT = FILAS.map(f => [f.c].concat(f.v.map(comoTexto)).join(' | ')).join('\n');

// Planes efectivos según la config del Builder.
// Formatos aceptados por línea: "nombre | destacado" o sólo "nombre".
function planes(cfg) {
  const lineas = txtList(cfg, 'comparison', 'planes', PLANES_DEFAULT);
  if (!lineas.length) return PLANES;
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = PLANES[i % PLANES.length];
    return {
      nombre: partes[0] || base.nombre,
      destacado: partes.length >= 2 ? DESTACADO.includes(String(partes[1]).trim().toLowerCase()) : base.destacado,
    };
  });
}

// Interpreta una celda: "sí"/"no" pasan a ✓/✕; el resto queda como texto libre.
function celdaValor(s) {
  const k = String(s).trim().toLowerCase();
  if (SI.includes(k)) return true;
  if (NO.includes(k)) return false;
  return String(s).trim();
}

/**
 * Filas efectivas según la config del Builder. `n` es la cantidad de planes: cada fila
 * devuelve SIEMPRE exactamente n valores (completando por índice con la fila base) para
 * que el <thead> y el <tbody> no se desalineen si alguien escribe una fila corta.
 * Formato por línea: "característica | valor plan 1 | valor plan 2 | …".
 */
function filas(cfg, n) {
  const lineas = txtList(cfg, 'comparison', 'filas', FILAS_DEFAULT);
  const origen = lineas.length ? lineas : FILAS.map(f => [f.c].concat(f.v.map(comoTexto)));
  return origen.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = FILAS[i % FILAS.length];
    const v = [];
    for (let k = 0; k < n; k++) {
      const crudo = partes[k + 1];
      v.push(crudo === undefined ? base.v[k % base.v.length] : celdaValor(crudo));
    }
    return { c: partes[0], v };
  });
}

// Tabla comparativa de planes: matriz de características con ✓ / ✕ / valor.
// Complemento de "precios": deja comparar de un vistazo qué incluye cada opción.
// Estática (sin JS). Planes y filas son placeholders editables desde el Builder.
module.exports = {
  id: 'comparison', type: 'ui', name: 'Tabla comparativa',
  description: 'Matriz de características por plan (✓/✕/valores) para comparar opciones de un vistazo. Estática, sin JS.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Compará los planes', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'Elegí la opción que mejor se adapte a lo que necesitás.', max: 220 },
    {
      key: 'planes', label: 'Planes (columnas)', type: 'list', max: 400, default: PLANES_DEFAULT,
      hint: 'Un plan por línea, de izquierda a derecha: nombre | destacado. Escribí "destacado" en la segunda columna para resaltar el plan recomendado. Ejemplo: "Pro | destacado".',
    },
    {
      key: 'filas', label: 'Filas de características', type: 'list', max: 2000, default: FILAS_DEFAULT,
      hint: 'Una característica por línea: característica | valor del plan 1 | valor del plan 2 | … Escribí "sí" o "no" para el tilde y la cruz, o cualquier texto para mostrarlo tal cual. Ejemplo: "Integraciones | no | 5 | Ilimitadas".',
    },
  ],
  html: (cfg) => {
    const cols = planes(cfg);
    // Fondo suave para la columna recomendada, celda por celda
    const destac = 'background:color-mix(in srgb, var(--accent) 7%, var(--bg))';
    const celda = (v) => {
      if (v === true) return `<span style="color:var(--accent);display:inline-flex;vertical-align:middle">${phIcon('check', { size: 18, label: 'Incluido' })}</span>`;
      if (v === false) return `<span class="muted" style="opacity:.55;display:inline-flex;vertical-align:middle">${phIcon('x', { size: 16, label: 'No incluido' })}</span>`;
      return esc(String(v));
    };
    const ths = cols.map(p => `<th scope="col" style="text-align:center${p.destacado ? ';color:var(--accent);' + destac : ''}">${esc(p.nombre)}${p.destacado ? ' <span class="badge">Recomendado</span>' : ''}</th>`).join('');
    const trs = filas(cfg, cols.length).map(f => `<tr>
            <th scope="row" style="font-weight:600">${esc(f.c)}</th>
            ${f.v.map((v, i) => `<td style="text-align:center${cols[i].destacado ? ';' + destac : ''}">${celda(v)}</td>`).join('\n            ')}
          </tr>`).join('\n          ');
    // data-mejorada="1" evita que el módulo "datatable" le agregue orden y buscador:
    // una tabla comparativa no se ordena ni se filtra, se lee.
    return `  <section id="comparativa">
    <div class="container">
      <h2>${esc(txt(cfg, 'comparison', 'titulo', 'Compará los planes'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'comparison', 'bajada', 'Elegí la opción que mejor se adapte a lo que necesitás.'))}</p>
      <div class="card" style="overflow-x:auto;padding:0">
        <table data-mejorada="1">
          <thead>
            <tr><th scope="col"></th>${ths}</tr>
          </thead>
          <tbody>
          ${trs}
          </tbody>
        </table>
      </div>
    </div>
  </section>`;
  },
  readmeNotes: () => [
    '**Tabla comparativa**: los planes y las filas de características salen del bloque *Textos por sección* del Builder; si no los editaste, son placeholders. También podés cambiarlos después en la sección `comparativa` de la Home (`public/index.html`).',
  ],
};
