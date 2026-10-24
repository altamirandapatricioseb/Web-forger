// Historia y proceso administrables con backend real: la línea de tiempo "Nuestra historia" (módulo
// UI timeline) y los pasos de "Cómo trabajamos" (módulo UI process) traían hitos y pasos HORNEADOS
// en el HTML. Son el relato que el negocio cuenta de sí mismo y cambia seguido: se cumple un
// aniversario, se abre una sucursal, se agrega un paso al proceso de trabajo. Hasta ahora cada
// cambio obligaba a regenerar y volver a deployar, y el sitio quedaba congelado en "2021: nueva
// etapa" tres años después.
//
// Un módulo, dos entidades (hitos y pasos): son dos listas ordenadas del mismo bloque narrativo
// —quiénes fuimos y cómo trabajamos— y separarlas en dos módulos obligaría al negocio a entrar a
// dos pantallas para contar una sola historia. Mismo criterio que horarios (horarios + feriados).
// Las rutas comparten un único CRUD parametrizado por :tipo, así agregar la segunda lista no
// duplicó ni una línea de lógica.
//
// GET /api/historia es público y el cliente inyecta EN VIVO sobre el HTML ya renderizado, con el
// MISMO marcado que hornean los dos módulos UI (el punto de la línea de tiempo, el número redondo
// del paso), y renumerando los pasos según el orden real: si se borra el paso 2, el 3 pasa a ser 2.
// El orden lo decide el servidor. Panel solo-admin, animado con Anime.js + red de seguridad.
const { phIcon } = require('../../src/icons');

// Siembra: los mismos hitos y pasos que hornean timeline.js y process.js, para que la primera
// carga no parpadee mostrando primero el HTML y después datos distintos.
const HITOS = [
  { year: '2015', title: 'Los comienzos', text: 'Arrancamos con un local chico y una idea clara: hacer las cosas bien desde el primer día.' },
  { year: '2018', title: 'Crecimiento', text: 'Sumamos equipo y duplicamos la capacidad para responder a una demanda que no paraba de crecer.' },
  { year: '2021', title: 'Nueva etapa', text: 'Renovamos nuestras instalaciones y dimos el salto digital para atender a todo el país.' },
  { year: 'Hoy', title: 'Mirando adelante', text: 'Seguimos invirtiendo en calidad y en las personas que hacen posible cada entrega.' },
].map((h, i) => ({ ...h, active: true, order: i + 1 }));

// Los pasos salen del propio módulo UI, que los resuelve contra la config del Builder: una
// copia literal acá se desincroniza en cuanto el usuario edita la sección "Cómo trabajamos",
// y la primera carga del sitio parpadearía mostrando primero unos pasos y después otros.
const { pasos: pasosUI } = require('../ui/process');
const PASOS = (cfg) => pasosUI(cfg).map((p, i) => ({
  title: p.titulo, text: p.texto, active: true, order: i + 1,
}));

module.exports = {
  id: 'historia', type: 'functional', name: 'Historia y proceso administrables',
  description: 'Los hitos de la línea de tiempo "Nuestra historia" y los pasos de "Cómo trabajamos" se guardan en el backend (colecciones milestones y worksteps) y se inyectan en vivo sobre el HTML ya renderizado: el negocio suma un hito o cambia un paso desde /historia-admin.html y el sitio publicado lo refleja al instante, sin regenerar ni volver a deployar. Los pasos se renumeran solos según el orden real, así borrar uno del medio no deja huecos en la numeración. El orden lo decide el servidor. GET /api/historia es público; el alta, la edición y el borrado son solo-admin. Animado con Anime.js.',
  usesAnime: true,
  requires: ['timeline'],
  mounts: [{ route: '/api/historia', file: 'routes/historia.js' }],
  collections: ['milestones', 'worksteps'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Historia', href: '/historia-admin.html', id: 'nav-historia' }] : [],
  head: () => `  <style>
    .hi-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .hi-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .hi-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .hi-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .hi-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
  </style>`,
  files: (cfg) => ({
    'routes/historia.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Dos listas ordenadas con la misma forma: un solo CRUD parametrizado por :tipo las atiende a las
// dos. La única diferencia real es que el hito lleva año y el paso no.
const TIPOS = {
  hitos: { col: 'milestones', año: true, nombre: 'hito' },
  pasos: { col: 'worksteps', año: false, nombre: 'paso' },
};

db.seedIfEmpty('milestones', ${JSON.stringify(HITOS, null, 2)});
db.seedIfEmpty('worksteps', ${JSON.stringify(PASOS(cfg), null, 2)});

const resolver = (r) => ({
  id: r.id,
  year: r.year || '',
  title: r.title || '',
  text: r.text || '',
  active: r.active !== false,
  order: Number(r.order) || 0,
});

const ordenados = (rows) => rows.map(resolver)
  .sort((a, b) => (a.order - b.order) || String(a.title).localeCompare(String(b.title)));

function leer(body, parcial, conAño) {
  const patch = {};
  if (conAño && (body.year !== undefined || !parcial)) {
    // El "año" es texto a propósito: el HTML original usa "Hoy" como último hito
    if (!str(body.year, 1, 20)) return { ok: false, error: 'El año tiene que tener entre 1 y 20 caracteres (puede ser "Hoy")' };
    patch.year = String(body.year).trim();
  }
  if (body.title !== undefined || !parcial) {
    if (!str(body.title, 2, 80)) return { ok: false, error: 'El título tiene que tener entre 2 y 80 caracteres' };
    patch.title = String(body.title).trim();
  }
  if (body.text !== undefined || !parcial) {
    if (!str(body.text, 2, 400)) return { ok: false, error: 'La descripción tiene que tener entre 2 y 400 caracteres' };
    patch.text = String(body.text).trim();
  }
  if (body.active !== undefined) patch.active = !(body.active === false || body.active === 'false');
  return { ok: true, patch };
}

// Resuelve el :tipo de la URL contra la lista blanca; null si no existe
const tipoDe = (v) => Object.prototype.hasOwnProperty.call(TIPOS, v) ? TIPOS[v] : null;

// GET /api/historia — público: hitos y pasos visibles, en el orden que fijó el negocio
router.get('/', async (req, res) => {
  const limpio = (rows) => ordenados(rows).filter(r => r.active).map(({ active, order, ...pub }) => pub);
  res.json({
    hitos: limpio(await db.all('milestones')),
    pasos: limpio(await db.all('worksteps')).map(({ year, ...p }) => p),
  });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/historia/todos — el panel ve también lo apagado
router.get('/todos', requireAdmin, async (req, res) => {
  res.json({
    hitos: ordenados(await db.all('milestones')),
    pasos: ordenados(await db.all('worksteps')),
  });
});

// POST /api/historia/:tipo — alta. El orden lo decide el servidor: al final de la lista
router.post('/:tipo', requireAdmin, async (req, res) => {
  const t = tipoDe(req.params.tipo);
  if (!t) return res.status(404).json({ error: 'Lista desconocida' });
  const { ok, error, patch } = leer(req.body, false, t.año);
  if (!ok) return res.status(422).json({ error });
  const ultimo = (await db.all(t.col)).reduce((m, r) => Math.max(m, Number(r.order) || 0), 0);
  const row = await db.insert(t.col, {
    year: patch.year || '', title: patch.title, text: patch.text,
    active: patch.active !== false, order: ultimo + 1,
  });
  res.status(201).json(resolver(row));
});

// PUT /api/historia/:tipo/:id — edición parcial (el orden se cambia con /mover, no a mano)
router.put('/:tipo/:id', requireAdmin, async (req, res) => {
  const t = tipoDe(req.params.tipo);
  if (!t) return res.status(404).json({ error: 'Lista desconocida' });
  const r = await db.get(t.col, req.params.id);
  if (!r) return res.status(404).json({ error: 'Ese ' + t.nombre + ' no existe' });
  const { ok, error, patch } = leer(req.body, true, t.año);
  if (!ok) return res.status(422).json({ error });
  res.json(resolver(await db.update(t.col, r.id, patch)));
});

// POST /api/historia/:tipo/:id/mover — sube o baja intercambiando posición con la vecina
router.post('/:tipo/:id/mover', requireAdmin, async (req, res) => {
  const t = tipoDe(req.params.tipo);
  if (!t) return res.status(404).json({ error: 'Lista desconocida' });
  const dir = req.body.dir === 'sube' ? -1 : 1;
  const lista = ordenados(await db.all(t.col));
  const i = lista.findIndex(r => r.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Ese ' + t.nombre + ' no existe' });
  const j = i + dir;
  if (j < 0 || j >= lista.length) return res.status(409).json({ error: dir < 0 ? 'Ya es el primero' : 'Ya es el último' });
  const nueva = lista.slice();
  nueva[i] = lista[j];
  nueva[j] = lista[i];
  // Se reescriben las posiciones de toda la lista: queda 1..N sin huecos ni empates
  for (let k = 0; k < nueva.length; k++) await db.update(t.col, nueva[k].id, { order: k + 1 });
  res.json({ rows: ordenados(await db.all(t.col)) });
});

// DELETE /api/historia/:tipo/:id — baja definitiva (para esconderlo sin perderlo está el interruptor)
router.delete('/:tipo/:id', requireAdmin, async (req, res) => {
  const t = tipoDe(req.params.tipo);
  if (!t) return res.status(404).json({ error: 'Lista desconocida' });
  const r = await db.get(t.col, req.params.id);
  if (!r) return res.status(404).json({ error: 'Ese ' + t.nombre + ' no existe' });
  await db.remove(t.col, r.id);
  res.json({ ok: true });
});
` : `// La edición requiere el módulo de autenticación: activalo en el Builder para habilitar
// /historia-admin.html. Sin él, los hitos y los pasos se editan en data/milestones.json y
// data/worksteps.json (las secciones los leen igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'historia-admin': {
      title: 'Historia y proceso',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('clock', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Historia y proceso</h2>
      <p class="section-sub">El relato del negocio: los hitos de la línea de tiempo${cfg.moduleIds.includes('process') ? ' y los pasos de "Cómo trabajamos"' : ''}. Lo que cargues acá se ve en el sitio al instante. Solo visible para administradores.</p>

      <h3 style="margin-top:8px">Hitos de la historia</h3>
      <div class="card" style="margin-bottom:20px">
        <h4 id="hi-form-titulo" style="margin-top:0">Nuevo hito</h4>
        <form id="hi-form">
          <div class="grid cols-2">
            <div><label>Año</label><input name="year" required maxlength="20" placeholder="2015 (o &quot;Hoy&quot;)"></div>
            <div><label>Título</label><input name="title" required maxlength="80" placeholder="Los comienzos"></div>
          </div>
          <label>Descripción</label>
          <textarea name="text" rows="3" required maxlength="400" placeholder="Arrancamos con un local chico y una idea clara…"></textarea>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="active" style="width:auto;margin:0" checked> Visible en el sitio</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="hi-guardar">Agregar hito</button>
            <button class="btn ghost" type="button" id="hi-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>
      <div id="hi-lista"><p class="muted">Cargando…</p></div>

      <h3 style="margin-top:40px">Pasos de "Cómo trabajamos"</h3>
      <div class="card" style="margin-bottom:20px">
        <h4 id="pa-form-titulo" style="margin-top:0">Nuevo paso</h4>
        <form id="pa-form">
          <label>Título</label>
          <input name="title" required maxlength="80" placeholder="Contanos tu idea">
          <label>Descripción</label>
          <textarea name="text" rows="3" required maxlength="400" placeholder="Nos escribís por el canal que prefieras…"></textarea>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="active" style="width:auto;margin:0" checked> Visible en el sitio</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="pa-guardar">Agregar paso</button>
            <button class="btn ghost" type="button" id="pa-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>
      <div id="pa-lista"><p class="muted">Cargando…</p></div>
      <p class="muted" style="font-size:.85rem;margin-top:14px">Los pasos se numeran solos según este orden: si borrás uno del medio, los siguientes se corren.</p>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo historia: trae hitos y pasos de /api/historia y reconstruye la línea de tiempo${cfg.moduleIds.includes('process') ? `
   y la sección "Cómo trabajamos"` : ''} con el mismo marcado que hornean los módulos UI.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel de edición vive en /historia-admin.html.` : ''}
   Anime.js para la aparición, con red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SUBIR = ${JSON.stringify(phIcon('arrow-up', { size: 14 }))};
  var BAJAR = ${JSON.stringify(phIcon('arrow-down', { size: 14 }))};

  function aparecer(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [10, 0], duration: 420, delay: anime.stagger ? anime.stagger(70) : 0, ease: 'outCubic' });
    // Red de seguridad: con la pestaña oculta el loop de Anime no corre y quedarían invisibles
    setTimeout(function () {
      Array.prototype.forEach.call(nodos, function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
    }, 900);
  }

  function pintarHitos(rows) {
    var linea = document.getElementById('historia-linea');
    if (!linea || !rows || !rows.length) return;
    linea.innerHTML = rows.map(function (h) {
      return '<div style="position:relative">' +
        '<span aria-hidden="true" style="position:absolute;left:-39px;top:7px;width:12px;height:12px;border-radius:50%;background:var(--accent);border:3px solid var(--bg);box-shadow:0 0 0 1px var(--line)"></span>' +
        '<span style="color:var(--accent);font-weight:800;font-size:.9rem;letter-spacing:.04em">' + App.esc(h.year) + '</span>' +
        '<h3 style="margin:2px 0 4px">' + App.esc(h.title) + '</h3>' +
        '<p class="muted" style="margin:0">' + App.esc(h.text) + '</p>' +
        '</div>';
    }).join('');
    aparecer(linea.children);
  }

  function pintarPasos(rows) {
    var seccion = document.getElementById('proceso');
    if (!seccion || !rows || !rows.length) return;
    var grid = seccion.querySelector('.grid');
    if (!grid) return;
    // El número sale del ORDEN, no de un dato guardado: borrar el paso 2 no deja un hueco
    grid.innerHTML = rows.map(function (p, i) {
      return '<div class="card" style="background:var(--bg)">' +
        '<div aria-hidden="true" style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;background:var(--accent);margin-bottom:12px">' + (i + 1) + '</div>' +
        '<h3 style="margin:0 0 6px">' + App.esc(p.title) + '</h3>' +
        '<p class="muted" style="margin:0">' + App.esc(p.text) + '</p>' +
        '</div>';
    }).join('');
    aparecer(grid.children);
  }

  var DEMO = { hitos: ${JSON.stringify(HITOS.map((h, i) => ({ id: 'h' + (i + 1), ...h })))}, pasos: ${JSON.stringify(PASOS(cfg).map((p, i) => ({ id: 'p' + (i + 1), ...p })))} };

  function pintarTodo(d) { pintarHitos(d.hitos); pintarPasos(d.pasos); }

  if (document.getElementById('historia-linea') || document.getElementById('proceso')) {
    if (window.__PREVIEW__) pintarTodo(DEMO);
    else fetch('/api/historia').then(function (r) { return r.json(); })
      .then(function (d) { if (d) pintarTodo(d); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /historia-admin.html ----
  // Las dos listas comparten pantalla y comportamiento: una sola fábrica las arma a las dos,
  // igual que el CRUD del servidor comparte rutas.
  function panel(cfgPanel) {
    var form = document.getElementById(cfgPanel.pre + '-form');
    var box = document.getElementById(cfgPanel.pre + '-lista');
    if (!form || !box) return null;
    var lista = [];
    var editando = '';

    function salirDeEdicion() {
      editando = '';
      form.reset();
      form.querySelector('[name="active"]').checked = true;
      document.getElementById(cfgPanel.pre + '-form-titulo').textContent = 'Nuevo ' + cfgPanel.nombre;
      document.getElementById(cfgPanel.pre + '-guardar').textContent = 'Agregar ' + cfgPanel.nombre;
      document.getElementById(cfgPanel.pre + '-cancelar').hidden = true;
    }

    function editar(r) {
      editando = r.id;
      cfgPanel.campos.forEach(function (k) {
        var el = form.querySelector('[name="' + k + '"]');
        if (el) el.value = r[k] == null ? '' : r[k];
      });
      form.querySelector('[name="active"]').checked = r.active !== false;
      document.getElementById(cfgPanel.pre + '-form-titulo').textContent = 'Editando: ' + r.title;
      document.getElementById(cfgPanel.pre + '-guardar').textContent = 'Guardar cambios';
      document.getElementById(cfgPanel.pre + '-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function pintarTabla() {
      var cols = [];
      if (cfgPanel.año) cols.push({ label: 'Año', render: function (r) { return '<strong>' + App.esc(r.year) + '</strong>'; } });
      else cols.push({ label: '#', render: function (r) { return '<span class="muted">' + (lista.indexOf(r) + 1) + '</span>'; } });
      cols.push({ label: cfgPanel.etiqueta, render: function (r) {
        return '<strong>' + App.esc(r.title) + '</strong><br><span class="muted" style="font-size:.8rem">' + App.esc(r.text) + '</span>';
      } });
      cols.push({ label: 'Estado', render: function (r) { return r.active ? '<span class="hi-chip on">Visible</span>' : '<span class="hi-chip off">Oculto</span>'; } });
      cols.push({ label: '', render: function (r) {
        return '<span class="hi-acciones">' +
          '<button class="btn ghost" type="button" aria-label="Subir" title="Subir" data-sube="' + r.id + '">' + SUBIR + '</button>' +
          '<button class="btn ghost" type="button" aria-label="Bajar" title="Bajar" data-baja="' + r.id + '">' + BAJAR + '</button>' +
          '<button class="btn ghost" type="button" data-edit="' + r.id + '">Editar</button>' +
          '<button class="btn ghost" type="button" data-ver="' + r.id + '">' + (r.active ? 'Ocultar' : 'Mostrar') + '</button>' +
          '<button class="btn ghost" type="button" data-del="' + r.id + '">Borrar</button>' +
          '</span>';
      } });
      box.innerHTML = App.table(lista, cols);
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
            await App.api('/api/historia/' + cfgPanel.tipo + '/' + r.id, { method: 'PUT', body: { active: !r.active } });
            App.toast(r.active ? 'Oculto' : 'Visible');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar? Si sólo querés sacarlo del sitio, usá "Ocultar".')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/historia/' + cfgPanel.tipo + '/' + b.getAttribute('data-del'), { method: 'DELETE' });
            App.toast('Borrado');
            if (editando === b.getAttribute('data-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reordenaría'); return; }
      try {
        var out = await App.api('/api/historia/' + cfgPanel.tipo + '/' + id + '/mover', { method: 'POST', body: { dir: dir } });
        lista = out.rows;
        pintarTabla();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function cargar() {
      if (window.__PREVIEW__) { lista = DEMO[cfgPanel.tipo].slice(); pintarTabla(); return; }
      try {
        var out = await App.api('/api/historia/todos');
        lista = out[cfgPanel.tipo];
        pintarTabla();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = { active: form.querySelector('[name="active"]').checked };
      cfgPanel.campos.forEach(function (k) {
        var el = form.querySelector('[name="' + k + '"]');
        if (el) datos[k] = el.value;
      });
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría'); return; }
      try {
        if (editando) await App.api('/api/historia/' + cfgPanel.tipo + '/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/historia/' + cfgPanel.tipo, { method: 'POST', body: datos });
        App.toast(editando ? 'Actualizado' : 'Agregado');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var cancelar = document.getElementById(cfgPanel.pre + '-cancelar');
    if (cancelar) cancelar.addEventListener('click', salirDeEdicion);

    return { form: form, box: box, cargar: cargar };
  }

  var paneles = [
    panel({ pre: 'hi', tipo: 'hitos', nombre: 'hito', etiqueta: 'Hito', año: true, campos: ['year', 'title', 'text'] }),
    panel({ pre: 'pa', tipo: 'pasos', nombre: 'paso', etiqueta: 'Paso', año: false, campos: ['title', 'text'] }),
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
    var navH = document.getElementById('nav-historia');
    if (navH && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navH.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Historia y proceso administrables**: los hitos viven en la colección \`milestones\` y los pasos en \`worksteps\`, y se inyectan en vivo sobre las secciones del sitio, así que actualizarlos **no requiere regenerar ni volver a deployar**. Se siembran los de ejemplo del HTML (2015, 2018, 2021, "Hoy"): reemplazalos por la historia real ${cfg.moduleIds.includes('auth') ? 'desde `/historia-admin.html`' : 'editando `data/milestones.json` y `data/worksteps.json` (o activá el módulo **Autenticación** para hacerlo desde `/historia-admin.html`)'}. El **año es texto** a propósito, para que el último hito pueda decir "Hoy", y los **pasos se numeran solos** según el orden: borrar uno del medio no deja huecos.`,
  ],
};
