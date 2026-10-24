/**
 * Generador de códigos QR propio, sin dependencias ni servicios de terceros.
 * Modo byte (UTF-8), versiones 1 a 10 (hasta 271 caracteres en nivel L), los cuatro
 * niveles de corrección de error (L/M/Q/H) y las 8 máscaras con su puntaje de penalización,
 * tal como los define la norma ISO/IEC 18004. Devuelve la matriz de módulos y un SVG.
 *
 * Por qué está acá y no como dependencia: pedirle el QR a un servicio externo (las APIs
 * clásicas de "chart" que devuelven un PNG) significa que cada persona que abre el panel
 * le avisa a un tercero qué está generando el negocio, y que el día que ese servicio se
 * apaga los QR dejan de salir. Acá el código se arma en el propio servidor.
 *
 * Este archivo es la FUENTE ÚNICA del encoder: el módulo `qr` lo lee tal cual y lo emite
 * como src/qrcode.js del proyecto generado, y el Builder lo usa para hornear el código de
 * ejemplo de la vista previa. Si se toca acá, cambian los dos a la vez.
 */

// --- Aritmética en el campo de Galois GF(256) con polinomio primitivo 0x11d ---
// Las tablas de exponentes y logaritmos convierten las multiplicaciones (caras) en sumas
// de índices, que es lo que hace viable calcular la corrección de error a mano.
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];

// Polinomio generador de Reed-Solomon para n símbolos de corrección
function rsGenerator(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

// Resto de dividir los datos por el generador: son los códigos de corrección de error
function rsRemainder(data, ecCount) {
  const gen = rsGenerator(ecCount);
  const res = new Array(ecCount).fill(0);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < ecCount; i++) res[i] ^= gfMul(gen[i + 1], factor);
  }
  return res;
}

/* Tabla de bloques por versión y nivel de corrección (ISO/IEC 18004, tabla 9).
   Cada entrada: [códigos de corrección por bloque, bloques del grupo 1, datos por bloque
   del grupo 1, bloques del grupo 2, datos por bloque del grupo 2]. */
const BLOQUES = {
  L: [[7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0], [26, 1, 108, 0, 0],
      [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0], [30, 2, 116, 0, 0], [18, 2, 68, 2, 69]],
  M: [[10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
      [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]],
  Q: [[13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0], [26, 2, 24, 0, 0], [18, 2, 15, 2, 16],
      [24, 4, 19, 0, 0], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19], [20, 4, 16, 4, 17], [24, 6, 19, 2, 20]],
  H: [[17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0], [22, 2, 11, 2, 12],
      [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15], [24, 4, 12, 4, 13], [28, 6, 15, 2, 16]],
};

// Centros de los patrones de alineación por versión (vacío en la 1: no lleva)
const ALINEACION = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// Bits del nivel de corrección dentro de la información de formato
const EC_BITS = { L: 1, M: 0, Q: 3, H: 2 };

const capacidadDatos = (version, ec) => {
  const b = BLOQUES[ec][version - 1];
  return b[1] * b[2] + b[3] * b[4];
};

/* Arma el flujo de bits de datos: indicador de modo byte (0100), cantidad de bytes,
   los bytes en sí, terminador y relleno alternado 0xEC/0x11 hasta llenar la capacidad. */
function bitsDeDatos(bytes, version, ec) {
  const capacidad = capacidadDatos(version, ec);
  const bits = [];
  const push = (valor, largo) => { for (let i = largo - 1; i >= 0; i--) bits.push((valor >> i) & 1); };
  push(4, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  // Terminador: hasta 4 ceros, pero nunca más allá de la capacidad
  const total = capacidad * 8;
  for (let i = 0; i < 4 && bits.length < total; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const datos = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    datos.push(byte);
  }
  const relleno = [0xEC, 0x11];
  for (let i = 0; datos.length < capacidad; i++) datos.push(relleno[i % 2]);
  return datos;
}

/* Intercala los bloques de datos y los de corrección como pide la norma: primero el
   byte 0 de cada bloque, después el byte 1 de cada bloque, etc. Sin esto, una mancha
   sobre el código se comería un bloque entero en vez de repartirse entre todos. */
function codificar(bytes, version, ec) {
  const [ecPorBloque, n1, d1, n2, d2] = BLOQUES[ec][version - 1];
  const datos = bitsDeDatos(bytes, version, ec);
  const bloques = [];
  let pos = 0;
  for (let i = 0; i < n1; i++) { bloques.push(datos.slice(pos, pos + d1)); pos += d1; }
  for (let i = 0; i < n2; i++) { bloques.push(datos.slice(pos, pos + d2)); pos += d2; }
  const correcciones = bloques.map(b => rsRemainder(b, ecPorBloque));
  const salida = [];
  const maxDatos = Math.max(d1, d2);
  for (let i = 0; i < maxDatos; i++) {
    for (const b of bloques) if (i < b.length) salida.push(b[i]);
  }
  for (let i = 0; i < ecPorBloque; i++) {
    for (const c of correcciones) salida.push(c[i]);
  }
  return salida;
}

// Información de formato: 5 bits (nivel + máscara) con BCH(15,5) y máscara final 0x5412
function bitsFormato(ec, mascara) {
  const datos = (EC_BITS[ec] << 3) | mascara;
  let resto = datos << 10;
  for (let i = 4; i >= 0; i--) {
    if ((resto >> (i + 10)) & 1) resto ^= 0x537 << i;
  }
  return ((datos << 10) | resto) ^ 0x5412;
}

// Información de versión (solo de la 7 en adelante): 6 bits con BCH(18,6)
function bitsVersion(version) {
  let resto = version << 12;
  for (let i = 5; i >= 0; i--) {
    if ((resto >> (i + 12)) & 1) resto ^= 0x1f25 << i;
  }
  return (version << 12) | resto;
}

const MASCARAS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// Dibuja los patrones fijos y marca qué celdas quedan reservadas (no llevan datos)
function armarBase(version) {
  const size = version * 4 + 17;
  const m = [], res = [];
  for (let i = 0; i < size; i++) { m.push(new Array(size).fill(0)); res.push(new Array(size).fill(false)); }

  const finder = (fr, fc) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = fr + r, cc = fc + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const dentro = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const negro = dentro && ((r === 0 || r === 6 || c === 0 || c === 6) || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        m[rr][cc] = negro ? 1 : 0;
        res[rr][cc] = true;
      }
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  // Patrones de tiempo: la fila y la columna 6 alternan negro/blanco
  for (let i = 8; i < size - 8; i++) {
    m[6][i] = i % 2 === 0 ? 1 : 0; res[6][i] = true;
    m[i][6] = i % 2 === 0 ? 1 : 0; res[i][6] = true;
  }

  // Patrones de alineación, salvo donde pisarían un patrón localizador
  const centros = ALINEACION[version - 1];
  for (const fr of centros) {
    for (const fc of centros) {
      if ((fr === 6 && fc === 6) || (fr === 6 && fc === size - 7) || (fr === size - 7 && fc === 6)) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          m[fr + r][fc + c] = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0;
          res[fr + r][fc + c] = true;
        }
      }
    }
  }

  // Módulo oscuro fijo y reserva de la zona de formato
  m[size - 8][8] = 1; res[size - 8][8] = true;
  for (let i = 0; i < 9; i++) { res[8][i] = true; res[i][8] = true; }
  for (let i = 0; i < 8; i++) { res[8][size - 1 - i] = true; res[size - 1 - i][8] = true; }

  // Zona de información de versión (dos bloques de 3x6) a partir de la versión 7
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = Math.floor(i / 3), b = i % 3;
      res[size - 11 + b][a] = true;
      res[a][size - 11 + b] = true;
    }
  }
  return { size, m, res };
}

// Recorrido en zigzag de derecha a izquierda, salteando la columna del patrón de tiempo
function ubicarDatos(m, res, size, codigos) {
  const bits = [];
  for (const byte of codigos) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  let idx = 0, sube = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let paso = 0; paso < size; paso++) {
      const r = sube ? size - 1 - paso : paso;
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (res[r][cc]) continue;
        m[r][cc] = idx < bits.length ? bits[idx++] : 0;
      }
    }
    sube = !sube;
  }
}

// Escribe la información de formato en sus dos ubicaciones (la norma la guarda por
// duplicado a propósito: si una esquina del código se daña, el lector usa la otra)
function escribirFormato(m, size, ec, mascara) {
  const bits = bitsFormato(ec, mascara);
  for (let i = 0; i < 15; i++) {
    const b = (bits >> i) & 1;
    // copia vertical: columna 8, repartida entre el localizador de arriba y el de abajo
    if (i < 6) m[i][8] = b;
    else if (i < 8) m[i + 1][8] = b;
    else m[size - 15 + i][8] = b;
    // copia horizontal: fila 8, repartida entre el localizador de la derecha y el de la izquierda
    if (i < 8) m[8][size - 1 - i] = b;
    else if (i < 9) m[8][15 - i] = b;
    else m[8][14 - i] = b;
  }
  m[size - 8][8] = 1;
}

function escribirVersion(m, size, version) {
  if (version < 7) return;
  const bits = bitsVersion(version);
  for (let i = 0; i < 18; i++) {
    const b = (bits >> i) & 1;
    const a = Math.floor(i / 3), c = i % 3;
    m[size - 11 + c][a] = b;
    m[a][size - 11 + c] = b;
  }
}

/* Puntaje de penalización de la norma: cuanto más bajo, más fácil de leer es el código.
   Son las cuatro reglas clásicas (rachas largas, bloques 2x2, falsos localizadores y
   desbalance de negro), y se usan para elegir cuál de las 8 máscaras conviene. */
function penalizacion(m, size) {
  let total = 0;
  // Regla 1: rachas de 5 o más módulos del mismo color
  for (let i = 0; i < size; i++) {
    for (const fila of [true, false]) {
      let previo = -1, largo = 0;
      for (let j = 0; j < size; j++) {
        const v = fila ? m[i][j] : m[j][i];
        if (v === previo) { largo++; if (largo === 5) total += 3; else if (largo > 5) total += 1; }
        else { previo = v; largo = 1; }
      }
    }
  }
  // Regla 2: bloques de 2x2 del mismo color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) total += 3;
    }
  }
  // Regla 3: patrones que se confunden con un localizador (1:1:3:1:1 con zona clara)
  const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const coincide = (get, j, pat) => { for (let k = 0; k < 11; k++) if (get(j + k) !== pat[k]) return false; return true; };
  for (let i = 0; i < size; i++) {
    for (let j = 0; j + 11 <= size; j++) {
      const filaGet = (x) => m[i][x];
      const colGet = (x) => m[x][i];
      if (coincide(filaGet, j, A) || coincide(filaGet, j, B)) total += 40;
      if (coincide(colGet, j, A) || coincide(colGet, j, B)) total += 40;
    }
  }
  // Regla 4: desbalance respecto del 50% de módulos negros
  let negros = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) negros += m[r][c];
  const porcentaje = negros * 100 / (size * size);
  total += Math.floor(Math.abs(porcentaje - 50) / 5) * 10;
  return total;
}

/** Matriz de módulos del QR: { size, modules: [[0|1]], version, ec }.
    mascaraFija (0 a 7) fuerza una máscara en vez de elegir la de menor penalización;
    sirve para reproducir un código exacto y para comparar contra otra implementación. */
function matriz(texto, ecPedido, mascaraFija) {
  const ec = ['L', 'M', 'Q', 'H'].includes(ecPedido) ? ecPedido : 'M';
  const bytes = Array.from(Buffer.from(String(texto), 'utf8'));
  // Cabecera del modo byte: 4 bits de modo + 8 o 16 bits de longitud
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const cabecera = 4 + (v <= 9 ? 8 : 16);
    if (capacidadDatos(v, ec) * 8 >= cabecera + bytes.length * 8) { version = v; break; }
  }
  if (!version) {
    throw new Error('El contenido es demasiado largo para un código QR de hasta versión 10 (probá con menos texto o menor nivel de corrección)');
  }
  const codigos = codificar(bytes, version, ec);
  const base = armarBase(version);
  const size = base.size;
  ubicarDatos(base.m, base.res, size, codigos);
  escribirVersion(base.m, size, version);

  // Se prueban las 8 máscaras y gana la de menor penalización
  const candidatas = (mascaraFija >= 0 && mascaraFija <= 7) ? [Number(mascaraFija)] : [0, 1, 2, 3, 4, 5, 6, 7];
  let mejor = null, mejorPuntaje = Infinity;
  for (const k of candidatas) {
    const m = base.m.map(f => f.slice());
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!base.res[r][c] && MASCARAS[k](r, c)) m[r][c] ^= 1;
      }
    }
    escribirFormato(m, size, ec, k);
    const p = penalizacion(m, size);
    if (p < mejorPuntaje) { mejorPuntaje = p; mejor = m; }
  }
  return { size, modules: mejor, version, ec };
}

/** SVG del código QR: un solo <path>, sin fuentes ni imágenes externas. */
function svg(texto, opciones = {}) {
  const { size, modules, version } = matriz(texto, opciones.ec);
  const escala = Math.max(1, Math.min(40, Number(opciones.escala) || 8));
  const margen = opciones.margen === undefined ? 4 : Math.max(0, Math.min(12, Number(opciones.margen)));
  const oscuro = /^#[0-9a-fA-F]{6}$/.test(String(opciones.oscuro || '')) ? opciones.oscuro : '#000000';
  const claro = /^#[0-9a-fA-F]{6}$/.test(String(opciones.claro || '')) ? opciones.claro : '#ffffff';
  const lado = (size + margen * 2) * escala;
  let d = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) d += 'M' + ((c + margen) * escala) + ' ' + ((r + margen) * escala) + 'h' + escala + 'v' + escala + 'h-' + escala + 'z';
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + lado + '" height="' + lado + '" viewBox="0 0 ' + lado + ' ' + lado + '" shape-rendering="crispEdges" role="img" aria-label="Código QR">' +
    '<rect width="' + lado + '" height="' + lado + '" fill="' + claro + '"/>' +
    '<path d="' + d + '" fill="' + oscuro + '"/></svg>';
}

module.exports = { matriz, svg, capacidadDatos };
