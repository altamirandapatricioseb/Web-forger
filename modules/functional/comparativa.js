// Comparador administrable: el módulo UI "productcompare" era frontend puro y enfrentaba cuatro
// PLANES INVENTADOS con precios inventados ("Plan Inicial $9.999/mes", "Plan Empresa $59.999/mes")
// horneados en el HTML. En un sitio comercial esa sección es de las pocas donde el visitante toma
// la decisión de compra mirando NÚMEROS: publicar ahí precios de ejemplo es el peor lugar posible
// para un placeholder, y cambiarlos obligaba a regenerar y volver a deployar.
// Acá las opciones viven en la colección compareitems, con atributos libres (el negocio decide qué
// filas tiene la tabla) y orden propio. Y hay una segunda fuente que es la que le da sentido al
// módulo en una tienda: con "Gestión de productos" activo se puede poner fuente = catálogo y la
// sección enfrenta los PRODUCTOS REALES, con su precio real y su disponibilidad real, sin cargar
// nada dos veces ni arriesgarse a que el comparador diga un precio y la ficha diga otro.
// Panel solo-admin /comparativa-admin.html, animado con Anime.js.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'comparativa', type: 'functional', name: 'Comparador administrable',
  description: 'Le da backend real al Comparador de productos: las opciones viven en la colección compareitems con atributos libres (el negocio decide qué filas tiene la tabla) en vez de los cuatro planes inventados que traía horneados el HTML, que es lo último que conviene falsear porque es donde el visitante mira números para decidir. Con Gestión de productos activo se puede cambiar la fuente al catálogo real y el comparador enfrenta los productos con su precio y su disponibilidad de verdad, sin cargar nada dos veces. ABM con reordenar y ocultar en /comparativa-admin.html. Animado con Anime.js.',
  usesAnime: true,
  requires: ['productcompare'],
  mounts: [{ route: '/api/comparativa', file: 'routes/comparativa.js' }],
  collections: ['compareitems', 'comparecfg'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Comparador', href: '/comparativa-admin.html', id: 'nav-comparativa-admin' }] : [],
  head: () => `  <style>
    .cmp-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .cmp-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .cmp-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .cmp-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .cmp-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .cmp-attr{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px}
    .cmp-attr .btn{width:auto;padding:9px 13px}
    @media (max-width:640px){.cmp-attr{grid-template-columns:1fr}}
    .cmp-res{font-size:.85rem;color:var(--muted)}
  </style>`,
  files: (cfg) => ({
    'routes/comparativa.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
db.seedIfEmpty('comparecfg', [{ fuente: 'propios', maximo: 3 }]);

// Se siembran las mismas cuatro opciones que hornea la sección para que la primera carga no
// parpadee. Son PRECIOS INVENTADOS: reemplazalos por los reales antes de publicar, o poné la
// fuente en "catálogo" para que la tabla salga de los productos de verdad.
db.seedIfEmpty('compareitems', [
  { nombre: 'Plan Inicial', precio: '$9.999/mes', atributos: [{ clave: 'Usuarios', valor: '1' }, { clave: 'Almacenamiento', valor: '10 GB' }, { clave: 'Soporte', valor: 'Email' }, { clave: 'Reportes', valor: 'Básicos' }, { clave: 'Integraciones', valor: 'No' }], visible: true, order: 1 },
  { nombre: 'Plan Profesional', precio: '$24.999/mes', atributos: [{ clave: 'Usuarios', valor: '10' }, { clave: 'Almacenamiento', valor: '100 GB' }, { clave: 'Soporte', valor: 'Prioritario' }, { clave: 'Reportes', valor: 'Avanzados' }, { clave: 'Integraciones', valor: 'Sí' }], visible: true, order: 2 },
  { nombre: 'Plan Equipo', precio: '$39.999/mes', atributos: [{ clave: 'Usuarios', valor: '25' }, { clave: 'Almacenamiento', valor: '500 GB' }, { clave: 'Soporte', valor: 'Prioritario' }, { clave: 'Reportes', valor: 'Avanzados' }, { clave: 'Integraciones', valor: 'Sí' }], visible: true, order: 3 },
  { nombre: 'Plan Empresa', precio: '$59.999/mes', atributos: [{ clave: 'Usuarios', valor: 'Ilimitados' }, { clave: 'Almacenamiento', valor: '1 TB' }, { clave: 'Soporte', valor: '24/7 dedicado' }, { clave: 'Reportes', valor: 'A medida' }, { clave: 'Integraciones', valor: 'Sí + API' }], visible: true, order: 4 },
]);

const MAX_ATRIBUTOS = 12;
const FUENTES = ['propios'${cfg.moduleIds.includes('products-admin') ? ", 'catalogo'" : ''}];

const limpiar = (p) => ({
  id: p.id,
  nombre: p.nombre || '',
  precio: p.precio || '',
  atributos: Array.isArray(p.atributos) ? p.atributos.slice(0, MAX_ATRIBUTOS).map(a => ({ clave: String(a.clave || ''), valor: String(a.valor || '') })) : [],
  visible: p.visible !== false,
  order: Number(p.order) || 0,
});

const ordenados = (rows) => rows.map(limpiar).sort((a, b) => (a.order - b.order) || String(a.nombre).localeCompare(String(b.nombre)));

async function config() {
  const rows = await db.all('comparecfg');
  const c = rows[0] || {};
  const fuente = FUENTES.includes(c.fuente) ? c.fuente : 'propios';
  return { id: c.id, fuente, maximo: Math.min(6, Math.max(2, Number(c.maximo) || 3)) };
}
${cfg.moduleIds.includes('products-admin') ? `
// Fuente "catálogo": los productos reales, con su precio real. La tabla se arma con los atributos
// que el producto TIENE cargados — una fila "Marca" vacía en las cuatro columnas no informa nada,
// así que las claves sin ningún valor no se agregan.
async function desdeCatalogo() {
  const productos = (await db.all('products')).filter(p => p.active !== false);
  return productos.slice(0, 24).map((p, i) => {
    const atributos = [];
    if (p.category) atributos.push({ clave: 'Categoría', valor: String(p.category) });
    if (p.brand) atributos.push({ clave: 'Marca', valor: String(p.brand) });
    if (p.sku) atributos.push({ clave: 'Código', valor: String(p.sku) });
    // La disponibilidad sale del mismo número que valida el checkout: si el comparador dijera
    // "disponible" sobre algo agotado, la contradicción aparecería recién en la caja.
    const stock = Number(p.stock) || 0;
    const disponible = p.trackStock === false ? 'Disponible' : (stock > 0 ? 'Disponible' : (p.allowBackorder ? 'A pedido' : 'Sin stock'));
    atributos.push({ clave: 'Disponibilidad', valor: disponible });
    if (Number(p.weight) > 0) atributos.push({ clave: 'Peso', valor: Number(p.weight) + ' kg' });
    return {
      id: p.id,
      nombre: p.name,
      precio: '$' + Number(p.price || 0).toLocaleString('es-AR'),
      atributos,
      visible: true,
      order: i + 1,
    };
  });
}
` : ''}
// GET /api/comparativa — público: lo que se enfrenta en la sección
router.get('/', async (req, res) => {
  const c = await config();
${cfg.moduleIds.includes('products-admin') ? `  const rows = c.fuente === 'catalogo' ? await desdeCatalogo() : ordenados(await db.all('compareitems')).filter(p => p.visible);
` : `  const rows = ordenados(await db.all('compareitems')).filter(p => p.visible);
`}  res.json({
    maximo: c.maximo,
    fuente: c.fuente,
    rows: rows.map(({ nombre, precio, atributos }) => ({ nombre, precio, atributos })),
  });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/comparativa/todas — el panel ve también las ocultas
router.get('/todas', requireAdmin, async (req, res) => {
  res.json({ rows: ordenados(await db.all('compareitems')), config: await config(), fuentes: FUENTES });
});

// PUT /api/comparativa/config — fuente de datos y cuántas se pueden comparar a la vez
router.put('/config', requireAdmin, async (req, res) => {
  const c = await config();
  const b = req.body || {};
  const patch = {};
  if (b.fuente !== undefined) {
    if (!FUENTES.includes(b.fuente)) return res.status(422).json({ error: 'Fuente desconocida' });
    patch.fuente = b.fuente;
  }
  if (b.maximo !== undefined) {
    const n = Number(b.maximo);
    if (!isFinite(n) || n < 2 || n > 6) return res.status(422).json({ error: 'Se pueden comparar entre 2 y 6 opciones a la vez' });
    patch.maximo = Math.floor(n);
  }
  if (c.id) await db.update('comparecfg', c.id, patch);
  else await db.insert('comparecfg', patch);
  res.json(await config());
});

function leer(body, parcial) {
  const patch = {};
  if (body.nombre !== undefined || !parcial) {
    if (!str(body.nombre, 2, 90)) return { ok: false, error: 'El nombre tiene que tener entre 2 y 90 caracteres' };
    patch.nombre = String(body.nombre).trim();
  }
  if (body.precio !== undefined) patch.precio = String(body.precio).trim().slice(0, 40);
  if (body.atributos !== undefined) {
    if (!Array.isArray(body.atributos)) return { ok: false, error: 'Los atributos tienen que ser una lista' };
    if (body.atributos.length > MAX_ATRIBUTOS) return { ok: false, error: 'Como máximo ' + MAX_ATRIBUTOS + ' atributos' };
    const limpios = [];
    for (const a of body.atributos) {
      const clave = String((a && a.clave) || '').trim().slice(0, 40);
      // Un atributo sin nombre de fila no se puede enfrentar contra nada: se descarta en silencio
      // en vez de generar una fila anónima en la tabla pública.
      if (!clave) continue;
      limpios.push({ clave, valor: String((a && a.valor) || '').trim().slice(0, 80) });
    }
    patch.atributos = limpios;
  }
  if (body.visible !== undefined) patch.visible = !(body.visible === false || body.visible === 'false');
  return { ok: true, patch };
}

// POST /api/comparativa — alta. El orden lo decide el servidor: al final
router.post('/', requireAdmin, async (req, res) => {
  const { ok, error, patch } = leer(req.body, false);
  if (!ok) return res.status(422).json({ error });
  const todas = await db.all('compareitems');
  const ultimo = todas.reduce((m, p) => Math.max(m, Number(p.order) || 0), 0);
  const row = await db.insert('compareitems', {
    nombre: patch.nombre, precio: patch.precio || '',
    atributos: patch.atributos || [],
    visible: patch.visible !== false,
    order: ultimo + 1,
  });
  res.status(201).json(limpiar(row));
});

// PUT /api/comparativa/:id — edición parcial
router.put('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('compareitems', req.params.id);
  if (!p) return res.status(404).json({ error: 'Esa opción no existe' });
  const { ok, error, patch } = leer(req.body, true);
  if (!ok) return res.status(422).json({ error });
  res.json(limpiar(await db.update('compareitems', p.id, patch)));
});

// POST /api/comparativa/:id/mover — intercambia la opción con su vecina (orden del servidor)
router.post('/:id/mover', requireAdmin, async (req, res) => {
  const dir = req.body.dir === 'sube' ? -1 : 1;
  const lista = ordenados(await db.all('compareitems'));
  const i = lista.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Esa opción no existe' });
  const j = i + dir;
  if (j < 0 || j >= lista.length) return res.status(409).json({ error: dir < 0 ? 'Ya está primera' : 'Ya está última' });
  const nueva = lista.slice();
  nueva[i] = lista[j];
  nueva[j] = lista[i];
  for (let k = 0; k < nueva.length; k++) await db.update('compareitems', nueva[k].id, { order: k + 1 });
  res.json({ rows: ordenados(await db.all('compareitems')) });
});

// DELETE /api/comparativa/:id — baja definitiva (para sacarla del sitio está Ocultar)
router.delete('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('compareitems', req.params.id);
  if (!p) return res.status(404).json({ error: 'Esa opción no existe' });
  await db.remove('compareitems', p.id);
  res.json({ ok: true });
});
` : `// La edición del comparador requiere el módulo de autenticación: activalo en el Builder para
// habilitar /comparativa-admin.html. Sin él, se edita en data/compareitems.json (la sección lo
// lee igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'comparativa-admin': {
      title: 'Comparador',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('squares-four', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Comparador</h2>
      <p class="section-sub">Las opciones que el visitante enfrenta en "Compará y elegí". Los cambios se ven al instante, sin regenerar. Las cuatro sembradas tienen <strong>precios de ejemplo</strong>: reemplazalas por las reales antes de publicar. Solo visible para administradores.</p>

      <div class="card" style="margin-bottom:26px">
        <h3>Cómo se arma la tabla</h3>
        <form id="cmp-cfg">
          <div class="grid cols-2">
            <div>
              <label>Fuente de las opciones</label>
              <select name="fuente">
                <option value="propios">Opciones propias (las de abajo)</option>
                ${cfg.moduleIds.includes('products-admin') ? '<option value="catalogo">Productos del catálogo</option>' : ''}
              </select>
              ${cfg.moduleIds.includes('products-admin')
                ? '<span class="muted" style="font-size:.8rem">Con "Productos del catálogo" la tabla sale de tus productos reales, con su precio y su disponibilidad actuales: no hay dos lugares que puedan decir precios distintos.</span>'
                : '<span class="muted" style="font-size:.8rem">Activá el módulo <strong>Gestión de productos</strong> para poder enfrentar los productos reales de tu catálogo en vez de opciones cargadas a mano.</span>'}
            </div>
            <div>
              <label>Se pueden comparar a la vez</label>
              <input name="maximo" type="number" min="2" max="6" step="1" value="3">
              <span class="muted" style="font-size:.8rem">Más de 3 columnas no entran cómodas en un teléfono.</span>
            </div>
          </div>
          <div style="margin-top:16px"><button class="btn" type="submit">Guardar</button></div>
        </form>
      </div>

      <div class="card" style="margin-bottom:26px">
        <h3 id="cmp-form-titulo">Agregar opción</h3>
        <form id="cmp-form">
          <div class="grid cols-2">
            <div><label>Nombre</label><input name="nombre" required maxlength="90" placeholder="Plan Profesional"></div>
            <div><label>Precio (texto libre)</label><input name="precio" maxlength="40" placeholder="$24.999/mes"></div>
          </div>
          <label style="margin-top:14px">Atributos</label>
          <p class="muted" style="font-size:.82rem;margin:0 0 10px">Cada atributo es una fila de la tabla. Usá los <strong>mismos nombres de fila</strong> en todas las opciones: así quedan enfrentadas y se resaltan las diferencias.</p>
          <div id="cmp-attrs"></div>
          <button class="btn ghost" type="button" id="cmp-add-attr" style="width:auto;margin-top:6px">Agregar atributo</button>
          <label style="display:flex;align-items:center;gap:8px;margin-top:14px"><input type="checkbox" name="visible" style="width:auto;margin:0" checked> Visible en el sitio</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="cmp-guardar">Agregar opción</button>
            <button class="btn ghost" type="button" id="cmp-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>

      <div id="cmp-lista"><p class="muted">Cargando…</p></div>
      <p class="muted" style="font-size:.85rem;margin-top:14px">El orden de esta tabla es el orden de las tarjetas en el sitio.</p>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo comparador administrable: trae las opciones de /api/comparativa y se las pasa al
   módulo UI por window.WFComparador, que vuelve a pintar las tarjetas y reengancha los checks.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el ABM vive en /comparativa-admin.html.` : ''} */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Sección pública ----
  // window.WFComparador lo define el módulo UI y el orden de concatenación de los clientJs no
  // está garantizado: se consulta desde un callback asíncrono, cuando el app.js ya corrió.
  var DEMO = { maximo: 3, rows: [
    { nombre: 'Plan Inicial', precio: '$9.999/mes', atributos: [{ clave: 'Usuarios', valor: '1' }, { clave: 'Soporte', valor: 'Email' }] },
    { nombre: 'Plan Profesional', precio: '$24.999/mes', atributos: [{ clave: 'Usuarios', valor: '10' }, { clave: 'Soporte', valor: 'Prioritario' }] },
  ] };

  function aplicar(d) {
    var api = window.WFComparador;
    if (!api) return;
    // El módulo UI espera {nombre, precio, atributos:{clave:valor}}: la lista de pares se
    // convierte acá y no en el servidor, porque el orden de las filas de la tabla lo define
    // el orden en que el negocio cargó los atributos de la PRIMERA opción.
    api.setProductos((d.rows || []).map(function (p) {
      var attrs = {};
      (p.atributos || []).forEach(function (a) { attrs[a.clave] = a.valor; });
      return { nombre: p.nombre, precio: p.precio, atributos: attrs };
    }), d.maximo);
    var grid = document.getElementById('pc-grid');
    var anime = window.anime;
    if (grid && grid.children.length && anime && anime.animate && !reduce) {
      anime.animate(grid.children, { opacity: [0, 1], translateY: [10, 0], duration: 420, delay: anime.stagger ? anime.stagger(55) : 0, ease: 'outCubic' });
      // Red de seguridad: con la pestaña oculta el loop de Anime no corre y las tarjetas
      // se quedarían invisibles. Se fija el estado final igual.
      setTimeout(function () {
        Array.prototype.forEach.call(grid.children, function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
      }, 900);
    }
  }

  if (document.getElementById('comparador')) {
    if (window.__PREVIEW__) setTimeout(function () { aplicar(DEMO); }, 0);
    else fetch('/api/comparativa').then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.rows) aplicar(d); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /comparativa-admin.html ----
  var form = document.getElementById('cmp-form');
  var box = document.getElementById('cmp-lista');
  var formCfg = document.getElementById('cmp-cfg');
  if (form && box && formCfg) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var SUBIR = ${JSON.stringify(phIcon('arrow-up', { size: 14 }))};
    var BAJAR = ${JSON.stringify(phIcon('arrow-down', { size: 14 }))};
    var lista = [];
    var editando = '';
    var attrs = [];
    var cajaAttrs = document.getElementById('cmp-attrs');

    function pintarAttrs() {
      cajaAttrs.innerHTML = attrs.map(function (a, i) {
        return '<div class="cmp-attr" data-a="' + i + '">' +
          '<div><input data-k="clave" value="' + App.esc(a.clave) + '" maxlength="40" placeholder="Usuarios"></div>' +
          '<div><input data-k="valor" value="' + App.esc(a.valor) + '" maxlength="80" placeholder="10"></div>' +
          '<button class="btn ghost" type="button" data-del-a="' + i + '">Quitar</button>' +
        '</div>';
      }).join('') || '<p class="muted" style="font-size:.85rem">Sin atributos: la tabla mostraría sólo el precio.</p>';
      cajaAttrs.querySelectorAll('[data-del-a]').forEach(function (b) {
        b.addEventListener('click', function () { leerAttrs(); attrs.splice(Number(b.getAttribute('data-del-a')), 1); pintarAttrs(); });
      });
    }

    // Se lee el DOM antes de cada repintado: si no, agregar o quitar una fila borraría lo que el
    // administrador venía escribiendo en las de al lado.
    function leerAttrs() {
      cajaAttrs.querySelectorAll('[data-a]').forEach(function (fila) {
        var i = Number(fila.getAttribute('data-a'));
        if (!attrs[i]) return;
        fila.querySelectorAll('[data-k]').forEach(function (el) { attrs[i][el.getAttribute('data-k')] = el.value; });
      });
    }

    function salirDeEdicion() {
      editando = '';
      form.reset();
      form.querySelector('[name="visible"]').checked = true;
      attrs = [];
      pintarAttrs();
      document.getElementById('cmp-form-titulo').textContent = 'Agregar opción';
      document.getElementById('cmp-guardar').textContent = 'Agregar opción';
      document.getElementById('cmp-cancelar').hidden = true;
    }

    function editar(p) {
      editando = p.id;
      form.querySelector('[name="nombre"]').value = p.nombre || '';
      form.querySelector('[name="precio"]').value = p.precio || '';
      form.querySelector('[name="visible"]').checked = p.visible !== false;
      attrs = (p.atributos || []).map(function (a) { return { clave: a.clave, valor: a.valor }; });
      pintarAttrs();
      document.getElementById('cmp-form-titulo').textContent = 'Editando: ' + p.nombre;
      document.getElementById('cmp-guardar').textContent = 'Guardar cambios';
      document.getElementById('cmp-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function pintar() {
      box.innerHTML = App.table(lista, [
        { label: 'Opción', render: function (p) {
          return '<strong>' + App.esc(p.nombre) + '</strong>' +
            (p.precio ? '<br><span style="color:var(--accent);font-weight:600">' + App.esc(p.precio) + '</span>' : '') +
            (p.atributos.length ? '<br><span class="cmp-res">' + App.esc(p.atributos.map(function (a) { return a.clave + ': ' + a.valor; }).join(' · ')) + '</span>' : '');
        } },
        { label: 'Estado', render: function (p) { return p.visible ? '<span class="cmp-chip on">Visible</span>' : '<span class="cmp-chip off">Oculta</span>'; } },
        { label: '', render: function (p) {
          return '<span class="cmp-acciones">' +
            '<button class="btn ghost" type="button" aria-label="Subir" title="Subir" data-cmp-sube="' + p.id + '">' + SUBIR + '</button>' +
            '<button class="btn ghost" type="button" aria-label="Bajar" title="Bajar" data-cmp-baja="' + p.id + '">' + BAJAR + '</button>' +
            '<button class="btn ghost" type="button" data-cmp-edit="' + p.id + '">Editar</button>' +
            '<button class="btn ghost" type="button" data-cmp-ver="' + p.id + '">' + (p.visible ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn ghost" type="button" data-cmp-del="' + p.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-cmp-edit]').forEach(function (b) {
        b.addEventListener('click', function () { var p = buscar(b.getAttribute('data-cmp-edit')); if (p) editar(p); });
      });
      box.querySelectorAll('[data-cmp-sube]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-cmp-sube'), 'sube'); });
      });
      box.querySelectorAll('[data-cmp-baja]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-cmp-baja'), 'baja'); });
      });
      box.querySelectorAll('[data-cmp-ver]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var p = buscar(b.getAttribute('data-cmp-ver'));
          if (!p) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
          try {
            await App.api('/api/comparativa/' + p.id, { method: 'PUT', body: { visible: !p.visible } });
            App.toast(p.visible ? 'Opción oculta' : 'Opción visible');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-cmp-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar esta opción del comparador? Si sólo querés sacarla del sitio, usá "Ocultar".')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/comparativa/' + b.getAttribute('data-cmp-del'), { method: 'DELETE' });
            App.toast('Opción borrada');
            if (editando === b.getAttribute('data-cmp-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reordenaría'); return; }
      try {
        var out = await App.api('/api/comparativa/' + id + '/mover', { method: 'POST', body: { dir: dir } });
        lista = out.rows;
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function cargar() {
      if (window.__PREVIEW__) {
        lista = [{ id: '1', nombre: 'Plan Inicial', precio: '$9.999/mes', atributos: [{ clave: 'Usuarios', valor: '1' }], visible: true, order: 1 }];
        pintar();
        return;
      }
      try {
        var out = await App.api('/api/comparativa/todas');
        lista = out.rows;
        formCfg.querySelector('[name="fuente"]').value = out.config.fuente;
        formCfg.querySelector('[name="maximo"]').value = out.config.maximo;
        pintar();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    formCfg.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría'); return; }
      try {
        await App.api('/api/comparativa/config', { method: 'PUT', body: {
          fuente: formCfg.querySelector('[name="fuente"]').value,
          maximo: Number(formCfg.querySelector('[name="maximo"]').value) || 3,
        } });
        App.toast('Comparador actualizado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    document.getElementById('cmp-add-attr').addEventListener('click', function () {
      leerAttrs();
      attrs.push({ clave: '', valor: '' });
      pintarAttrs();
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      leerAttrs();
      var datos = {
        nombre: form.querySelector('[name="nombre"]').value,
        precio: form.querySelector('[name="precio"]').value,
        atributos: attrs,
        visible: form.querySelector('[name="visible"]').checked,
      };
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la opción'); return; }
      try {
        if (editando) await App.api('/api/comparativa/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/comparativa', { method: 'POST', body: datos });
        App.toast(editando ? 'Opción actualizada' : 'Opción agregada');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var cancelar = document.getElementById('cmp-cancelar');
    if (cancelar) cancelar.addEventListener('click', salirDeEdicion);

    pintarAttrs();

    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      form.style.display = 'none';
      formCfg.style.display = 'none';
    } else {
      cargar();
      var animeP = window.anime;
      if (animeP && animeP.animate && !reduce) {
        animeP.animate(form, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: 'outCubic' });
        setTimeout(function () { form.style.opacity = 1; form.style.transform = 'none'; }, 800);
      }
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navE = document.getElementById('nav-comparativa-admin');
    if (navE && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navE.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Comparador administrable**: las opciones viven en la colección \`compareitems\` con atributos libres (cada atributo es una fila de la tabla) y se editan ${cfg.moduleIds.includes('auth') ? 'desde `/comparativa-admin.html`' : 'en `data/compareitems.json` (activá **Autenticación** para el panel web)'}, sin regenerar. Se siembran las **cuatro opciones de ejemplo con precios inventados** que traía el HTML: reemplazalas por las reales **antes de publicar** — es la sección donde el visitante mira números para decidir, el peor lugar para un placeholder.${cfg.moduleIds.includes('products-admin') ? ' Con **Gestión de productos** activo podés poner la fuente en **"Productos del catálogo"**: la tabla se arma con tus productos reales, su precio y su disponibilidad actuales, y no hay dos lugares que puedan decir precios distintos.' : ' Activá **Gestión de productos** para poder enfrentar los productos reales del catálogo en vez de opciones cargadas a mano.'} Usá los **mismos nombres de fila** en todas las opciones: así quedan enfrentadas y se resaltan las diferencias.`,
  ],
};
