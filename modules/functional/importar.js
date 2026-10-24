// Importación de datos por CSV con backend real: el catálogo entero sabe EXPORTAR (casi todos los
// paneles tienen su botón de CSV) y no sabía IMPORTAR, con lo que cada cliente que ya tenía sus
// datos en una planilla tenía que cargarlos a mano uno por uno el primer día. Este módulo cierra
// ese círculo para CUALQUIER colección del proyecto: el servidor lista las colecciones existentes
// con los campos que ya tienen sus filas, parsea el CSV (comillas, saltos de línea adentro de una
// celda, separador ; o , detectado solo), muestra una PREVISUALIZACIÓN antes de tocar nada y recién
// entonces inserta. El mapeo de columna → campo lo elige el usuario, así el CSV puede venir de
// cualquier lado y no hace falta renombrar encabezados en Excel. Tiene tres protecciones que no son
// opcionales: colecciones VEDADAS (usuarios, roles y firmas no se importan nunca — serían una vía
// directa para crearse un admin o fabricar una firma), TOPE de filas por importación, y campo de
// DEDUPLICACIÓN opcional para no duplicar lo que ya está. Los valores se convierten solos (número,
// sí/no, texto) siguiendo lo que ya guarda la colección. Panel solo-admin /importar-admin.html
// animado con Anime.js + red de seguridad. Requiere Autenticación. Es la contraparte exacta de
// "respaldo" (que copia y restaura el proyecto entero): acá entran datos de AFUERA.
const { phIcon } = require('../../src/icons');

// Colecciones que nunca se importan: crear cuentas, roles o firmas desde una planilla sería
// una escalada de privilegios o una firma fabricada. La lista viaja al servidor generado.
const VEDADAS = ['users', 'roles', 'signdocs', 'filedata', 'taskruns', 'taskcfg', 'shieldlog', 'cashclosures'];
const MAX_FILAS = 2000;    // Tope de filas por importación
const MAX_CSV = 1000000;   // Tope del texto pegado (1 MB)

module.exports = {
  id: 'importar', type: 'functional', name: 'Importar datos (CSV)',
  description: 'Importación de planillas a cualquier colección del proyecto con backend real: el servidor lista las colecciones con sus campos, parsea el CSV (comillas, saltos de línea dentro de celda y separador ; o , detectado solo), muestra una previsualización antes de tocar nada y recién entonces inserta. Mapeo de columna a campo, deduplicación opcional por campo, conversión automática de números y sí/no, tope de filas y colecciones vedadas (usuarios, roles y firmas nunca se importan). Panel solo-admin /importar-admin.html animado con Anime.js. Requiere Autenticación.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/importar', file: 'routes/importar.js' }],
  nav: () => [{ label: 'Importar (admin)', href: '/importar-admin.html', id: 'nav-importar-admin' }],
  head: () => `  <style>
    .im-paso{display:flex;gap:12px;align-items:baseline;margin:30px 0 10px}
    .im-paso span{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:var(--surface);border:1px solid var(--line);font-size:.8rem;font-weight:700;flex:none}
    .im-paso h3{margin:0;font-size:1.05rem}
    .im-drop{border:1px dashed var(--line);border-radius:var(--radius);padding:22px;text-align:center;color:var(--muted);cursor:pointer}
    .im-drop.activo{border-color:var(--accent);color:var(--accent)}
    .im-mapa{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px 18px;margin-top:8px}
    .im-mapa label{margin:0;font-size:.85rem}
    .im-mapa select{margin:4px 0 0}
    .im-tabla{overflow:auto}
    .im-tabla table{font-size:.85rem;white-space:nowrap}
    .im-res{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-top:18px}
    .im-res .card{text-align:center}
    .im-res strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .im-aviso{border-left:3px solid var(--accent);padding:12px 16px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0;margin:18px 0;font-size:.9rem}
  </style>`,
  pages: () => ({
    'importar-admin': {
      title: 'Importar datos',
      html: `  <section>
    <div class="container">
      <h2>Importar datos</h2>
      <p class="section-sub">Traé lo que ya tenés en una planilla. Nada se guarda hasta que veas la previsualización y confirmes.</p>

      <div class="im-paso"><span>1</span><h3>Elegí a dónde van</h3></div>
      <div class="card">
        <label for="im-coleccion">Sección del sistema</label>
        <select id="im-coleccion"></select>
        <p class="muted" id="im-coleccion-info" style="margin:8px 0 0;font-size:.85rem"></p>
      </div>

      <div class="im-paso"><span>2</span><h3>Cargá el CSV</h3></div>
      <div class="card">
        <div class="im-drop" id="im-drop">
          ${phIcon('database', { size: 20, style: 'vertical-align:-4px;margin-right:8px' })}Arrastrá el archivo .csv acá o tocá para elegirlo
          <input type="file" id="im-file" accept=".csv,text/csv" hidden>
        </div>
        <label style="margin-top:16px">…o pegá el contenido</label>
        <textarea id="im-csv" rows="6" placeholder="nombre;email;telefono&#10;Ana Ruiz;ana@mail.com;1155550000"></textarea>
        <div style="margin-top:12px"><button class="btn" type="button" id="im-previsualizar">Previsualizar</button></div>
      </div>

      <div id="im-paso3" hidden>
        <div class="im-paso"><span>3</span><h3>Emparejá las columnas</h3></div>
        <div class="card">
          <p class="muted" style="margin:0 0 4px;font-size:.88rem">Decile a cada columna del CSV en qué campo del sistema tiene que entrar. El desplegable sugiere los campos que esa sección ya usa, pero podés escribir otro. Las columnas que dejes vacías se descartan.</p>
          <div class="im-mapa" id="im-mapa"></div>
          <label style="margin-top:18px">No duplicar por</label>
          <select id="im-dedupe"><option value="">Importar todo (sin control de duplicados)</option></select>
          <p class="muted" style="margin:6px 0 0;font-size:.82rem">Si elegís un campo, las filas cuyo valor ya exista en el sistema se saltean.</p>
          <div class="im-aviso" id="im-resumen-prev"></div>
          <div class="im-tabla" id="im-preview"></div>
          <div style="margin-top:16px"><button class="btn" type="button" id="im-confirmar">Importar</button></div>
        </div>
      </div>

      <div id="im-resultado"></div>
    </div>
  </section>`,
    },
  }),
  files: (cfg) => {
    // Las colecciones importables salen de las que realmente usa este proyecto
    const importables = (cfg.collections || []).filter(c => !VEDADAS.includes(c)).sort();
    return {
      'routes/importar.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');

// Colecciones de este proyecto que se pueden importar (las vedadas ni se listan: crear usuarios,
// roles o firmas desde una planilla sería una escalada de privilegios o una firma fabricada)
const IMPORTABLES = ${JSON.stringify(importables)};
const MAX_FILAS = ${MAX_FILAS};
const MAX_CSV = ${MAX_CSV};
// Campos que administra el propio almacén: si vienen en el CSV se ignoran
const RESERVADOS = ['id', 'createdAt'];

/**
 * Parser de CSV completo: respeta comillas dobles ("" escapa una comilla adentro), saltos de
 * línea dentro de una celda y CRLF. El separador se detecta contando ; y , en la primera línea.
 */
function parseCsv(texto) {
  const t = String(texto).replace(/^\\uFEFF/, '');
  const primera = t.split(/\\r?\\n/)[0] || '';
  const sep = (primera.split(';').length > primera.split(',').length) ? ';' : ',';
  const filas = [];
  let campo = '';
  let fila = [];
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; }
        else comillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { comillas = true; continue; }
    if (c === sep) { fila.push(campo); campo = ''; continue; }
    if (c === '\\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; continue; }
    if (c === '\\r') continue;
    campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  // Descarta las líneas totalmente vacías (el CSV de Excel suele terminar con una)
  return filas.filter(f => f.some(v => String(v).trim() !== ''));
}

// Convierte el texto de una celda al tipo que corresponde: número, sí/no o texto
function valorDe(txt) {
  const v = String(txt).trim();
  if (v === '') return '';
  if (/^-?\\d+([.,]\\d+)?$/.test(v) && v.length < 16) return Number(v.replace(',', '.'));
  const b = v.toLowerCase();
  if (['true', 'sí', 'si', 'verdadero'].includes(b)) return true;
  if (['false', 'no', 'falso'].includes(b)) return false;
  return v;
}

// Campos que ya usa una colección: la unión de las claves de sus filas (hasta 200 muestras)
function camposDe(rows) {
  const set = new Set();
  for (const r of rows.slice(0, 200)) for (const k of Object.keys(r)) if (!RESERVADOS.includes(k)) set.add(k);
  return [...set];
}

const permitida = (n) => IMPORTABLES.includes(n);

// GET /api/importar/colecciones — qué se puede importar y con qué campos
router.get('/colecciones', requireAdmin, async (req, res) => {
  const out = [];
  for (const name of IMPORTABLES) {
    const rows = await db.all(name);
    out.push({ name, count: rows.length, fields: camposDe(rows) });
  }
  res.json({ collections: out, maxRows: MAX_FILAS });
});

// POST /api/importar/previsualizar — parsea y muestra sin guardar NADA
router.post('/previsualizar', requireAdmin, async (req, res) => {
  const name = String(req.body.coleccion || '');
  if (!permitida(name)) return res.status(422).json({ error: 'Esa sección no admite importación' });
  const csv = String(req.body.csv || '');
  if (!csv.trim()) return res.status(422).json({ error: 'Pegá el CSV o elegí un archivo' });
  if (csv.length > MAX_CSV) return res.status(413).json({ error: 'El archivo es demasiado grande (máximo 1 MB)' });
  const filas = parseCsv(csv);
  if (filas.length < 2) return res.status(422).json({ error: 'El CSV necesita una fila de encabezados y al menos una fila de datos' });
  const headers = filas[0].map(h => String(h).trim());
  if (headers.some(h => !h)) return res.status(422).json({ error: 'Hay columnas sin nombre en la fila de encabezados' });
  const datos = filas.slice(1);
  res.json({
    headers,
    fields: camposDe(await db.all(name)),
    total: datos.length,
    excede: datos.length > MAX_FILAS,
    maxRows: MAX_FILAS,
    sample: datos.slice(0, 5).map(f => headers.map((h, i) => valorDe(f[i] === undefined ? '' : f[i]))),
  });
});

// POST /api/importar/confirmar — recién acá se escribe
router.post('/confirmar', requireAdmin, async (req, res) => {
  const name = String(req.body.coleccion || '');
  if (!permitida(name)) return res.status(422).json({ error: 'Esa sección no admite importación' });
  const csv = String(req.body.csv || '');
  if (csv.length > MAX_CSV) return res.status(413).json({ error: 'El archivo es demasiado grande (máximo 1 MB)' });
  const filas = parseCsv(csv);
  if (filas.length < 2) return res.status(422).json({ error: 'El CSV no tiene filas de datos' });
  const headers = filas[0].map(h => String(h).trim());
  const datos = filas.slice(1);
  if (datos.length > MAX_FILAS) {
    return res.status(422).json({ error: 'Demasiadas filas: el máximo por importación es ' + MAX_FILAS });
  }

  // Mapeo columna del CSV → campo del sistema (lo elige el usuario en el panel)
  const mapa = (req.body.mapping && typeof req.body.mapping === 'object') ? req.body.mapping : {};
  const columnas = headers.map((h, i) => ({ i, campo: String(mapa[h] || '').trim() }))
    .filter(c => c.campo && !RESERVADOS.includes(c.campo));
  if (!columnas.length) return res.status(422).json({ error: 'Emparejá al menos una columna con un campo del sistema' });

  const dedupe = String(req.body.dedupe || '').trim();
  if (dedupe && !columnas.some(c => c.campo === dedupe)) {
    return res.status(422).json({ error: 'El campo para no duplicar tiene que estar entre los que importás' });
  }
  // Valores ya existentes del campo de deduplicación (comparación por texto en minúsculas)
  const existentes = new Set();
  if (dedupe) {
    for (const r of await db.all(name)) {
      if (r[dedupe] !== undefined && r[dedupe] !== '') existentes.add(String(r[dedupe]).toLowerCase().trim());
    }
  }

  let insertados = 0, omitidos = 0, vacias = 0;
  for (const f of datos) {
    const row = {};
    for (const c of columnas) row[c.campo] = valorDe(f[c.i] === undefined ? '' : f[c.i]);
    // Una fila sin ningún valor útil no se inserta
    if (!Object.values(row).some(v => v !== '' && v !== undefined)) { vacias++; continue; }
    if (dedupe) {
      const clave = String(row[dedupe] === undefined ? '' : row[dedupe]).toLowerCase().trim();
      if (!clave || existentes.has(clave)) { omitidos++; continue; }
      existentes.add(clave);
    }
    await db.insert(name, row);
    insertados++;
  }
  res.json({ insertados, omitidos, vacias, total: datos.length, coleccion: name });
});

module.exports = router;
`,
    };
  },
  clientJs: () => `/* Módulo importar datos: elección de colección, carga de archivo o pegado, previsualización
   con mapeo de columnas y resultado con count-up (Anime.js + red de seguridad). Sólo admin.
   En la vista previa del Builder simula la API. */
(function () {
  var sel = document.getElementById('im-coleccion');
  if (!sel) return;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
    sel.closest('.card').innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
    return;
  }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };
  // Nombres legibles de las colecciones más comunes; el resto se muestra tal cual
  var NOMBRES = {
    customers: 'Clientes (CRM)', products: 'Productos', bookings: 'Reservas', subscribers: 'Suscriptores',
    leads: 'Contactos captados', messages: 'Mensajes recibidos', suppliers: 'Proveedores',
    ctamoves: 'Movimientos de cuenta corriente', posts: 'Artículos del blog', listings: 'Avisos',
    menuitems: 'Carta', services: 'Servicios', cashmoves: 'Movimientos de caja', warranties: 'Garantías',
  };
  var colecciones = [], estado = null;

  function contar(el, valor) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = valor; return; }
    var obj = { v: 0 };
    anime.animate(obj, { v: valor, duration: 650, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(obj.v); } });
    setTimeout(function () { el.textContent = valor; }, 850);
  }

  var nombreDe = function (c) { return NOMBRES[c.name] || c.name; };

  function pintarColecciones() {
    sel.innerHTML = colecciones.map(function (c) {
      return '<option value="' + attr(c.name) + '">' + App.esc(nombreDe(c)) + '</option>';
    }).join('');
    infoColeccion();
  }

  function actual() { return colecciones.filter(function (c) { return c.name === sel.value; })[0]; }

  function infoColeccion() {
    var info = document.getElementById('im-coleccion-info');
    var c = actual();
    if (!info || !c) return;
    info.textContent = c.count + (c.count === 1 ? ' registro cargado' : ' registros cargados') +
      (c.fields.length ? ' · campos: ' + c.fields.join(', ') : ' · todavía sin campos conocidos (se toman los del CSV)');
  }

  sel.addEventListener('change', function () {
    infoColeccion();
    var p3 = document.getElementById('im-paso3');
    if (p3) p3.hidden = true;
  });

  /* ---------- Carga del archivo ---------- */
  var drop = document.getElementById('im-drop');
  var file = document.getElementById('im-file');
  var textarea = document.getElementById('im-csv');

  function leerArchivo(f) {
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () { textarea.value = String(fr.result || ''); App.toast('Archivo cargado: ' + f.name); };
    fr.readAsText(f, 'utf-8');
  }
  if (drop && file) {
    drop.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () { leerArchivo(file.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('activo'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('activo'); });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) leerArchivo(e.dataTransfer.files[0]);
    });
  }

  /* ---------- Previsualización ---------- */
  function nombreParecido(header, campos) {
    var n = function (s) { return String(s).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]/g, ''); };
    var h = n(header);
    for (var i = 0; i < campos.length; i++) if (n(campos[i]) === h) return campos[i];
    return '';
  }

  // Campos actualmente escritos en el mapeo (los usa el selector de deduplicación)
  function camposMapeados() {
    return [].slice.call(document.querySelectorAll('[data-im-col]'))
      .map(function (i) { return i.value.trim(); }).filter(Boolean);
  }

  function pintarDedupe() {
    var dedupe = document.getElementById('im-dedupe');
    if (!dedupe) return;
    var previo = dedupe.value;
    var campos = camposMapeados();
    dedupe.innerHTML = '<option value="">Importar todo (sin control de duplicados)</option>' +
      campos.map(function (f) { return '<option value="' + attr(f) + '">' + App.esc(f) + '</option>'; }).join('');
    if (campos.indexOf(previo) >= 0) dedupe.value = previo;
  }

  function pintarMapa() {
    var mapa = document.getElementById('im-mapa');
    if (!mapa || !estado) return;
    // Campo libre con sugerencias: cuando la colección todavía está vacía no hay campos conocidos
    // que ofrecer, así que el nombre se tiene que poder ESCRIBIR (si fuera un desplegable cerrado,
    // la primera importación de una sección vacía crearía campos con los nombres del CSV).
    var campos = estado.fields.slice();
    estado.headers.forEach(function (h) { if (campos.indexOf(h) < 0) campos.push(h); });
    mapa.innerHTML = '<datalist id="im-campos">' +
      campos.map(function (f) { return '<option value="' + attr(f) + '"></option>'; }).join('') + '</datalist>' +
      estado.headers.map(function (h) {
        var sug = nombreParecido(h, estado.fields) || h;
        return '<label>' + App.esc(h) +
          '<input data-im-col="' + attr(h) + '" list="im-campos" value="' + attr(sug) + '" placeholder="Dejar vacío para no importar" maxlength="40"></label>';
      }).join('');
    mapa.querySelectorAll('[data-im-col]').forEach(function (i) { i.addEventListener('input', pintarDedupe); });
    pintarDedupe();

    var resumen = document.getElementById('im-resumen-prev');
    if (resumen) {
      resumen.innerHTML = estado.excede
        ? 'El archivo tiene <strong>' + estado.total + '</strong> filas y el máximo por importación es <strong>' + estado.maxRows + '</strong>. Partilo en varios archivos.'
        : 'Se van a importar <strong>' + estado.total + '</strong> fila(s) a <strong>' + App.esc(nombreDe(actual() || { name: sel.value })) + '</strong>. Abajo, las primeras como las entendió el sistema.';
    }
    var prev = document.getElementById('im-preview');
    if (prev) {
      prev.innerHTML = '<div class="card" style="padding:0;overflow:auto"><table><thead><tr>' +
        estado.headers.map(function (h) { return '<th>' + App.esc(h) + '</th>'; }).join('') +
        '</tr></thead><tbody>' +
        estado.sample.map(function (f) {
          return '<tr>' + f.map(function (v) { return '<td>' + App.esc(v === '' ? '—' : v) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }
    var btn = document.getElementById('im-confirmar');
    if (btn) btn.disabled = !!estado.excede;
  }

  var prevBtn = document.getElementById('im-previsualizar');
  if (prevBtn) prevBtn.addEventListener('click', async function () {
    var csv = textarea.value;
    if (!csv.trim()) { App.toast('Pegá el CSV o elegí un archivo'); return; }
    if (window.__PREVIEW__) {
      estado = { headers: ['nombre', 'email'], fields: ['name', 'email'], total: 2, excede: false, maxRows: 2000, sample: [['Ana Ruiz', 'ana@mail.com'], ['Juan Paz', 'juan@mail.com']] };
    } else {
      try { estado = await App.api('/api/importar/previsualizar', { method: 'POST', body: { coleccion: sel.value, csv: csv } }); }
      catch (err) { if (err.message !== 'preview') App.toast(err.message); return; }
    }
    document.getElementById('im-paso3').hidden = false;
    pintarMapa();
    document.getElementById('im-paso3').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });

  /* ---------- Confirmación ---------- */
  var confBtn = document.getElementById('im-confirmar');
  if (confBtn) confBtn.addEventListener('click', async function () {
    var mapping = {};
    document.querySelectorAll('[data-im-col]').forEach(function (s) {
      if (s.value.trim()) mapping[s.getAttribute('data-im-col')] = s.value.trim();
    });
    if (!Object.keys(mapping).length) { App.toast('Emparejá al menos una columna'); return; }
    var dedupe = (document.getElementById('im-dedupe') || {}).value || '';
    if (window.__PREVIEW__) { mostrarResultado({ insertados: 2, omitidos: 0, vacias: 0, total: 2 }); return; }
    confBtn.disabled = true;
    try {
      var r = await App.api('/api/importar/confirmar', { method: 'POST', body: { coleccion: sel.value, csv: textarea.value, mapping: mapping, dedupe: dedupe } });
      mostrarResultado(r);
      App.toast('Importación terminada: ' + r.insertados + ' registro(s)');
      await cargar();
      sel.value = r.coleccion;
      infoColeccion();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    confBtn.disabled = false;
  });

  function mostrarResultado(r) {
    var cont = document.getElementById('im-resultado');
    if (!cont) return;
    var datos = [['Importados', r.insertados], ['Duplicados salteados', r.omitidos], ['Filas vacías', r.vacias], ['Filas del archivo', r.total]];
    cont.innerHTML = '<div class="im-paso"><span>${'4'}</span><h3>Listo</h3></div><div class="im-res">' +
      datos.map(function (d) { return '<div class="card"><strong data-im-kpi="' + d[1] + '">0</strong><span class="muted">' + d[0] + '</span></div>'; }).join('') +
      '</div>';
    cont.querySelectorAll('[data-im-kpi]').forEach(function (el) { contar(el, Number(el.getAttribute('data-im-kpi'))); });
    cont.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  async function cargar() {
    if (window.__PREVIEW__) {
      colecciones = [{ name: 'customers', count: 3, fields: ['name', 'email', 'phone'] }];
    } else {
      try { colecciones = (await App.api('/api/importar/colecciones')).collections || []; }
      catch (err) { if (err.message !== 'preview') App.toast(err.message); return; }
    }
    if (!colecciones.length) {
      sel.innerHTML = '<option value="">No hay secciones importables en este proyecto</option>';
      var info = document.getElementById('im-coleccion-info');
      if (info) info.textContent = 'Activá algún módulo con datos propios (clientes, productos, reservas…) para poder importar.';
      return;
    }
    pintarColecciones();
  }

  cargar();
})();`,
  readmeNotes: () => [
    `**Importar datos (CSV)**: panel solo-admin en \`/importar-admin.html\`. El servidor lista las colecciones importables de este proyecto, parsea el CSV (comillas, saltos de línea dentro de una celda y separador \`;\` o \`,\` detectado solo) y **muestra una previsualización antes de escribir nada**: recién al confirmar inserta. Máximo ${MAX_FILAS} filas y 1 MB por importación. Por seguridad **nunca** se pueden importar las colecciones de usuarios, roles ni firmas (serían una vía para crearse un administrador o fabricar una firma); la lista completa está en \`IMPORTABLES\`, dentro de \`routes/importar.js\`. Los valores se convierten solos: los números quedan como número, \`sí/no\` como booleano y el resto como texto.`,
  ],
};
