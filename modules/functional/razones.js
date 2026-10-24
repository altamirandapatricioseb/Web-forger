// Garantías y características administrables con backend real: la barra de garantías (módulo UI
// trust) y las filas "Por qué elegirnos" (módulo UI features) traían textos HORNEADOS en el HTML —y
// no cualquier texto: PROMESAS COMERCIALES. "Envío gratis en compras superiores a $50.000" y
// "Hasta 30 días para cambiar de idea" son condiciones que el visitante puede reclamar, y salían a
// producción con cifras inventadas que el negocio no podía corregir sin regenerar y volver a
// deployar. De todos los placeholders del catálogo, estos eran los que más caro salían.
//
// Un módulo, dos entidades (garantías y destacados): las dos listas contestan la misma pregunta
// —por qué comprarnos a nosotros— y comparten forma exacta (ícono, título, texto), así que el CRUD
// del servidor va parametrizado por :tipo y el panel las arma con la misma fábrica. Mismo criterio
// que historia (hitos + pasos).
//
// El ícono se guarda como NOMBRE Phosphor de una lista blanca (nunca marcado) y el SVG se hornea en
// el cliente. Las filas de características se reinsertan como HERMANAS DIRECTAS del contenedor, no
// dentro de un envoltorio: el zigzag depende de :nth-child(even) contando desde el título de la
// sección, y meterlas en un div lo rompería en silencio. GET /api/razones es público.
// Panel solo-admin, animado con Anime.js + red de seguridad. Requiere la barra de garantías.
const { phIcon } = require('../../src/icons');

// Lista blanca compartida por las dos listas: el dato guardado es el NOMBRE del ícono
const ICONOS = [
  'truck', 'lock', 'shield-check', 'headset', 'seal-check', 'tag',
  'clock', 'handshake', 'heart', 'gift', 'star', 'check',
  'lightning', 'chart-line-up', 'target', 'users',
];

// Siembra: los mismos textos que hornean trust.js y features.js, para que la primera carga no
// parpadee mostrando primero el HTML y después datos distintos.
const GARANTIAS = [
  { icon: 'truck', title: 'Envío gratis', text: 'En compras superiores a $50.000' },
  { icon: 'lock', title: 'Pago seguro', text: 'Tus datos siempre protegidos' },
  { icon: 'clock', title: 'Cambios y devoluciones', text: 'Hasta 30 días para cambiar de idea' },
  { icon: 'headset', title: 'Atención personalizada', text: 'Te acompañamos antes y después' },
].map((r, i) => ({ ...r, active: true, order: i + 1 }));

// Las filas de "Por qué elegirnos" salen del propio módulo UI, que las resuelve contra la
// config del Builder: una copia literal acá se desincroniza en cuanto el usuario edita la
// sección, y la primera carga del sitio parpadearía mostrando primero unas filas y después
// otras. Es función de cfg por la misma razón.
const { features } = require('../ui/features');
const DESTACADOS = (cfg) => features(cfg).map((r, i) => ({
  icon: r.icon, title: r.t, text: r.d, active: true, order: i + 1,
}));

module.exports = {
  id: 'razones', type: 'functional', name: 'Garantías y características administrables',
  description: 'Los badges de la barra de garantías (envío, pago seguro, devoluciones, atención) y las filas de "Por qué elegirnos" se guardan en el backend (colecciones guarantees y highlights) y se inyectan en vivo sobre el HTML ya renderizado: el negocio corrige el monto del envío gratis o el plazo de devolución desde /razones-admin.html y el sitio publicado lo refleja al instante, sin regenerar ni volver a deployar. Importa más de lo que parece: son promesas comerciales que el visitante puede reclamar, y venían con cifras de ejemplo. Cada entrada lleva ícono (elegido de una grilla Phosphor, se guarda el nombre y nunca HTML), título y texto; el orden lo decide el servidor y el zigzag alternado de las filas se conserva. GET /api/razones es público; el alta, la edición y el borrado son solo-admin. Animado con Anime.js.',
  usesAnime: true,
  requires: ['trust'],
  mounts: [{ route: '/api/razones', file: 'routes/razones.js' }],
  collections: ['guarantees', 'highlights'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Garantías', href: '/razones-admin.html', id: 'nav-razones' }] : [],
  head: () => `  <style>
    .rz-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .rz-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .rz-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .rz-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .rz-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .rz-iconos{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
    .rz-ico{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:1px solid var(--line);border-radius:var(--radius);background:var(--bg);cursor:pointer;color:var(--muted)}
    .rz-ico[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 22%,transparent)}
  </style>`,
  files: (cfg) => ({
    'routes/razones.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Dos listas con la misma forma: un solo CRUD parametrizado por :tipo las atiende a las dos
const TIPOS = {
  garantias: { col: 'guarantees', nombre: 'garantía' },
  destacados: { col: 'highlights', nombre: 'característica' },
};
const ICONOS = ${JSON.stringify(ICONOS)};

db.seedIfEmpty('guarantees', ${JSON.stringify(GARANTIAS, null, 2)});
db.seedIfEmpty('highlights', ${JSON.stringify(DESTACADOS(cfg), null, 2)});

const resolver = (r) => ({
  id: r.id,
  icon: ICONOS.includes(r.icon) ? r.icon : ICONOS[0],
  title: r.title || '',
  text: r.text || '',
  active: r.active !== false,
  order: Number(r.order) || 0,
});

const ordenados = (rows) => rows.map(resolver)
  .sort((a, b) => (a.order - b.order) || String(a.title).localeCompare(String(b.title)));

function leer(body, parcial) {
  const patch = {};
  if (body.title !== undefined || !parcial) {
    if (!str(body.title, 2, 60)) return { ok: false, error: 'El título tiene que tener entre 2 y 60 caracteres' };
    patch.title = String(body.title).trim();
  }
  if (body.text !== undefined || !parcial) {
    if (!str(body.text, 2, 300)) return { ok: false, error: 'El texto tiene que tener entre 2 y 300 caracteres' };
    patch.text = String(body.text).trim();
  }
  if (body.icon !== undefined) {
    if (!ICONOS.includes(body.icon)) return { ok: false, error: 'Ese ícono no está en la lista disponible' };
    patch.icon = body.icon;
  }
  if (body.active !== undefined) patch.active = !(body.active === false || body.active === 'false');
  return { ok: true, patch };
}

const tipoDe = (v) => Object.prototype.hasOwnProperty.call(TIPOS, v) ? TIPOS[v] : null;

// GET /api/razones — público: las dos listas visibles, en el orden que fijó el negocio
router.get('/', async (req, res) => {
  const limpio = (rows) => ordenados(rows).filter(r => r.active).map(({ active, order, ...pub }) => pub);
  res.json({
    garantias: limpio(await db.all('guarantees')),
    destacados: limpio(await db.all('highlights')),
  });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/razones/todos — el panel ve también lo apagado
router.get('/todos', requireAdmin, async (req, res) => {
  res.json({
    garantias: ordenados(await db.all('guarantees')),
    destacados: ordenados(await db.all('highlights')),
    iconos: ICONOS,
  });
});

// POST /api/razones/:tipo — alta. El orden lo decide el servidor: al final de la lista
router.post('/:tipo', requireAdmin, async (req, res) => {
  const t = tipoDe(req.params.tipo);
  if (!t) return res.status(404).json({ error: 'Lista desconocida' });
  const { ok, error, patch } = leer(req.body, false);
  if (!ok) return res.status(422).json({ error });
  const ultimo = (await db.all(t.col)).reduce((m, r) => Math.max(m, Number(r.order) || 0), 0);
  const row = await db.insert(t.col, {
    icon: patch.icon || ICONOS[0], title: patch.title, text: patch.text,
    active: patch.active !== false, order: ultimo + 1,
  });
  res.status(201).json(resolver(row));
});

// PUT /api/razones/:tipo/:id — edición parcial (el orden se cambia con /mover, no a mano)
router.put('/:tipo/:id', requireAdmin, async (req, res) => {
  const t = tipoDe(req.params.tipo);
  if (!t) return res.status(404).json({ error: 'Lista desconocida' });
  const r = await db.get(t.col, req.params.id);
  if (!r) return res.status(404).json({ error: 'Esa ' + t.nombre + ' no existe' });
  const { ok, error, patch } = leer(req.body, true);
  if (!ok) return res.status(422).json({ error });
  res.json(resolver(await db.update(t.col, r.id, patch)));
});

// POST /api/razones/:tipo/:id/mover — sube o baja intercambiando posición con la vecina
router.post('/:tipo/:id/mover', requireAdmin, async (req, res) => {
  const t = tipoDe(req.params.tipo);
  if (!t) return res.status(404).json({ error: 'Lista desconocida' });
  const dir = req.body.dir === 'sube' ? -1 : 1;
  const lista = ordenados(await db.all(t.col));
  const i = lista.findIndex(r => r.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Esa ' + t.nombre + ' no existe' });
  const j = i + dir;
  if (j < 0 || j >= lista.length) return res.status(409).json({ error: dir < 0 ? 'Ya es la primera' : 'Ya es la última' });
  const nueva = lista.slice();
  nueva[i] = lista[j];
  nueva[j] = lista[i];
  // Se reescriben las posiciones de toda la lista: queda 1..N sin huecos ni empates
  for (let k = 0; k < nueva.length; k++) await db.update(t.col, nueva[k].id, { order: k + 1 });
  res.json({ rows: ordenados(await db.all(t.col)) });
});

// DELETE /api/razones/:tipo/:id — baja definitiva (para esconderla sin perderla está el interruptor)
router.delete('/:tipo/:id', requireAdmin, async (req, res) => {
  const t = tipoDe(req.params.tipo);
  if (!t) return res.status(404).json({ error: 'Lista desconocida' });
  const r = await db.get(t.col, req.params.id);
  if (!r) return res.status(404).json({ error: 'Esa ' + t.nombre + ' no existe' });
  await db.remove(t.col, r.id);
  res.json({ ok: true });
});
` : `// La edición requiere el módulo de autenticación: activalo en el Builder para habilitar
// /razones-admin.html. Sin él, se editan en data/guarantees.json y data/highlights.json
// (las secciones los leen igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'razones-admin': {
      title: 'Garantías',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('shield-check', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Garantías y características</h2>
      <p class="section-sub">Lo que le prometés al visitante. <strong>Revisá los montos y los plazos antes de publicar</strong>: los que vienen cargados son de ejemplo y un cliente puede reclamártelos. Solo visible para administradores.</p>

      <h3 style="margin-top:8px">Barra de garantías</h3>
      <div class="card" style="margin-bottom:20px">
        <h4 id="gz-form-titulo" style="margin-top:0">Nueva garantía</h4>
        <form id="gz-form">
          <label>Título</label>
          <input name="title" required maxlength="60" placeholder="Envío gratis">
          <label>Detalle</label>
          <input name="text" required maxlength="300" placeholder="En compras superiores a $50.000">
          <label id="gz-icono-label">Ícono</label>
          <div class="rz-iconos" id="gz-iconos" role="group" aria-labelledby="gz-icono-label"></div>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="active" style="width:auto;margin:0" checked> Visible en el sitio</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="gz-guardar">Agregar garantía</button>
            <button class="btn ghost" type="button" id="gz-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>
      <div id="gz-lista"><p class="muted">Cargando…</p></div>

      <h3 style="margin-top:40px">Características destacadas</h3>
      <div class="card" style="margin-bottom:20px">
        <h4 id="dz-form-titulo" style="margin-top:0">Nueva característica</h4>
        <form id="dz-form">
          <label>Título</label>
          <input name="title" required maxlength="60" placeholder="Rápido de implementar">
          <label>Descripción</label>
          <textarea name="text" rows="3" required maxlength="300" placeholder="Poné todo en marcha en minutos, sin configuraciones eternas."></textarea>
          <label id="dz-icono-label">Ícono</label>
          <div class="rz-iconos" id="dz-iconos" role="group" aria-labelledby="dz-icono-label"></div>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="active" style="width:auto;margin:0" checked> Visible en el sitio</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="dz-guardar">Agregar característica</button>
            <button class="btn ghost" type="button" id="dz-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>
      <div id="dz-lista"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo razones: trae garantías y características de /api/razones y reconstruye la barra de
   garantías${cfg.moduleIds.includes('features') ? ' y las filas "Por qué elegirnos"' : ''} con el mismo marcado que hornean los módulos UI.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel de edición vive en /razones-admin.html.` : ''}
   Anime.js para la aparición, con red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ICO = ${JSON.stringify(Object.fromEntries(ICONOS.map(n => [n, phIcon(n, { size: 30, color: 'var(--accent)' })])))};
  var ICO_GRANDE = ${JSON.stringify(Object.fromEntries(ICONOS.map(n => [n, phIcon(n, { size: 64, color: 'var(--accent)' })])))};
  var ICO_MINI = ${JSON.stringify(Object.fromEntries(ICONOS.map(n => [n, phIcon(n, { size: 22 })])))};
  var PRIMERO = Object.keys(ICO)[0];

  function aparecer(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [10, 0], duration: 400, delay: anime.stagger ? anime.stagger(60) : 0, ease: 'outCubic' });
    // Red de seguridad: con la pestaña oculta el loop de Anime no corre y quedarían invisibles
    setTimeout(function () {
      Array.prototype.forEach.call(nodos, function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
    }, 900);
  }

  function pintarGarantias(rows) {
    var grid = document.getElementById('garantias-grid');
    if (!grid || !rows || !rows.length) return;
    grid.innerHTML = rows.map(function (r) {
      return '<div class="trust-item" style="display:flex;align-items:center;gap:12px">' +
        '<span style="flex:0 0 auto;display:inline-flex">' + (ICO[r.icon] || ICO[PRIMERO]) + '</span>' +
        '<div><strong style="display:block;font-size:.95rem">' + App.esc(r.title) + '</strong>' +
        '<span class="muted" style="font-size:.82rem">' + App.esc(r.text) + '</span></div>' +
        '</div>';
    }).join('');
    aparecer(grid.children);
  }

  function pintarDestacados(rows) {
    var seccion = document.getElementById('caracteristicas');
    if (!seccion || !rows || !rows.length) return;
    var cont = seccion.querySelector('.container');
    if (!cont) return;
    // Las filas van como HERMANAS del título, no dentro de un envoltorio: el zigzag es
    // :nth-child(even) sobre el contenedor y un div extra lo rompería en silencio.
    Array.prototype.slice.call(cont.querySelectorAll('.feature-row')).forEach(function (n) { n.remove(); });
    var nuevas = rows.map(function (r) {
      var div = document.createElement('div');
      div.className = 'feature-row';
      div.innerHTML = '<div class="feature-media" role="img" aria-label="' + App.esc(r.title) + '">' +
        (ICO_GRANDE[r.icon] || ICO_GRANDE[PRIMERO]) + '</div>' +
        '<div class="feature-text"><h3>' + App.esc(r.title) + '</h3>' +
        '<p class="muted">' + App.esc(r.text) + '</p></div>';
      cont.appendChild(div);
      return div;
    });
    aparecer(nuevas);
  }

  var DEMO = {
    garantias: ${JSON.stringify(GARANTIAS.map((r, i) => ({ id: 'g' + (i + 1), ...r })))},
    destacados: ${JSON.stringify(DESTACADOS(cfg).map((r, i) => ({ id: 'd' + (i + 1), ...r })))},
  };

  function pintarTodo(d) { pintarGarantias(d.garantias); pintarDestacados(d.destacados); }

  if (document.getElementById('garantias-grid') || document.getElementById('caracteristicas')) {
    if (window.__PREVIEW__) pintarTodo(DEMO);
    else fetch('/api/razones').then(function (r) { return r.json(); })
      .then(function (d) { if (d) pintarTodo(d); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /razones-admin.html ----
  // Las dos listas comparten forma y comportamiento: una fábrica arma las dos, igual que el
  // CRUD del servidor comparte rutas.
  function panel(cfgPanel) {
    var form = document.getElementById(cfgPanel.pre + '-form');
    var box = document.getElementById(cfgPanel.pre + '-lista');
    if (!form || !box) return null;
    var lista = [];
    var editando = '';
    var iconoElegido = PRIMERO;

    function pintarIconos() {
      var cont = document.getElementById(cfgPanel.pre + '-iconos');
      if (!cont) return;
      cont.innerHTML = Object.keys(ICO_MINI).map(function (n) {
        return '<button type="button" class="rz-ico" data-ico="' + n + '" aria-pressed="' + (n === iconoElegido) + '" title="' + n + '" aria-label="Ícono ' + n + '">' + ICO_MINI[n] + '</button>';
      }).join('');
      cont.querySelectorAll('[data-ico]').forEach(function (b) {
        b.addEventListener('click', function () { iconoElegido = b.getAttribute('data-ico'); pintarIconos(); });
      });
    }

    function salirDeEdicion() {
      editando = '';
      form.reset();
      form.querySelector('[name="active"]').checked = true;
      iconoElegido = PRIMERO;
      pintarIconos();
      document.getElementById(cfgPanel.pre + '-form-titulo').textContent = 'Nueva ' + cfgPanel.nombre;
      document.getElementById(cfgPanel.pre + '-guardar').textContent = 'Agregar ' + cfgPanel.nombre;
      document.getElementById(cfgPanel.pre + '-cancelar').hidden = true;
    }

    function editar(r) {
      editando = r.id;
      form.querySelector('[name="title"]').value = r.title || '';
      form.querySelector('[name="text"]').value = r.text || '';
      form.querySelector('[name="active"]').checked = r.active !== false;
      iconoElegido = r.icon || PRIMERO;
      pintarIconos();
      document.getElementById(cfgPanel.pre + '-form-titulo').textContent = 'Editando: ' + r.title;
      document.getElementById(cfgPanel.pre + '-guardar').textContent = 'Guardar cambios';
      document.getElementById(cfgPanel.pre + '-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function pintarTabla() {
      box.innerHTML = App.table(lista, [
        { label: '', render: function (r) { return ICO_MINI[r.icon] || ''; } },
        { label: cfgPanel.etiqueta, render: function (r) {
          return '<strong>' + App.esc(r.title) + '</strong><br><span class="muted" style="font-size:.8rem">' + App.esc(r.text) + '</span>';
        } },
        { label: 'Estado', render: function (r) { return r.active ? '<span class="rz-chip on">Visible</span>' : '<span class="rz-chip off">Oculta</span>'; } },
        { label: '', render: function (r) {
          return '<span class="rz-acciones">' +
            '<button class="btn ghost" type="button" aria-label="Subir" title="Subir" data-sube="' + r.id + '">' + ${JSON.stringify(phIcon('arrow-up', { size: 14 }))} + '</button>' +
            '<button class="btn ghost" type="button" aria-label="Bajar" title="Bajar" data-baja="' + r.id + '">' + ${JSON.stringify(phIcon('arrow-down', { size: 14 }))} + '</button>' +
            '<button class="btn ghost" type="button" data-edit="' + r.id + '">Editar</button>' +
            '<button class="btn ghost" type="button" data-ver="' + r.id + '">' + (r.active ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-edit]').forEach(function (b) {
        b.addEventListener('click', function () { var r = buscar(b.getAttribute('data-edit')); if (r) editar(r); });
      });
      box.querySelectorAll('[data-sube]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-sube'), 'sube'); });
      });
      box.querySelectorAll('[data-baja]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-baja'), 'baja'); });
      });
      box.querySelectorAll('[data-ver]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var r = buscar(b.getAttribute('data-ver'));
          if (!r) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
          try {
            await App.api('/api/razones/' + cfgPanel.tipo + '/' + r.id, { method: 'PUT', body: { active: !r.active } });
            App.toast(r.active ? 'Oculta' : 'Visible');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar? Si sólo querés sacarla del sitio, usá "Ocultar".')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/razones/' + cfgPanel.tipo + '/' + b.getAttribute('data-del'), { method: 'DELETE' });
            App.toast('Borrada');
            if (editando === b.getAttribute('data-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reordenaría'); return; }
      try {
        var out = await App.api('/api/razones/' + cfgPanel.tipo + '/' + id + '/mover', { method: 'POST', body: { dir: dir } });
        lista = out.rows;
        pintarTabla();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function cargar() {
      if (window.__PREVIEW__) { lista = DEMO[cfgPanel.tipo].slice(); pintarTabla(); return; }
      try {
        var out = await App.api('/api/razones/todos');
        lista = out[cfgPanel.tipo];
        pintarTabla();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        title: form.querySelector('[name="title"]').value,
        text: form.querySelector('[name="text"]').value,
        icon: iconoElegido,
        active: form.querySelector('[name="active"]').checked,
      };
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría'); return; }
      try {
        if (editando) await App.api('/api/razones/' + cfgPanel.tipo + '/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/razones/' + cfgPanel.tipo, { method: 'POST', body: datos });
        App.toast(editando ? 'Actualizada' : 'Agregada');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var cancelar = document.getElementById(cfgPanel.pre + '-cancelar');
    if (cancelar) cancelar.addEventListener('click', salirDeEdicion);

    pintarIconos();
    return { form: form, box: box, cargar: cargar };
  }

  var paneles = [
    panel({ pre: 'gz', tipo: 'garantias', nombre: 'garantía', etiqueta: 'Garantía' }),
    panel({ pre: 'dz', tipo: 'destacados', nombre: 'característica', etiqueta: 'Característica' }),
  ].filter(Boolean);

  if (paneles.length) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      paneles.forEach(function (p) {
        p.box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
        p.form.style.display = 'none';
      });
    } else {
      paneles.forEach(function (p) { p.cargar(); });
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        var forms = paneles.map(function (p) { return p.form; });
        anime.animate(forms, { opacity: [0, 1], translateY: [10, 0], duration: 420, delay: anime.stagger ? anime.stagger(80) : 0, ease: 'outCubic' });
        setTimeout(function () { forms.forEach(function (f) { f.style.opacity = 1; f.style.transform = 'none'; }); }, 800);
      }
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navR = document.getElementById('nav-razones');
    if (navR && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navR.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Garantías y características administrables**: viven en las colecciones \`guarantees\` y \`highlights\` y se inyectan en vivo, así que corregirlas **no requiere regenerar ni volver a deployar**. **Importante**: los valores sembrados ("Envío gratis en compras superiores a $50.000", "Hasta 30 días para cambiar de idea") son **de ejemplo y son promesas que un cliente puede reclamarte**: ajustalos a tus condiciones reales ${cfg.moduleIds.includes('auth') ? 'desde `/razones-admin.html`' : 'editando `data/guarantees.json` y `data/highlights.json` (o activá el módulo **Autenticación** para hacerlo desde `/razones-admin.html`)'} antes de publicar el sitio. El **ícono se elige de una grilla** (se guarda el nombre, nunca marcado).`,
  ],
};
