// Servicios administrables con backend real: la sección "Nuestros servicios" (módulo UI services) y
// la página de detalle (servicespage) traían los seis servicios HORNEADOS en el HTML. Son el
// contenido que MÁS cambia en un sitio comercial después de los precios —se suma un servicio nuevo,
// se deja de ofrecer otro, se reescribe una descripción— y hasta ahora cada cambio obligaba a
// regenerar el proyecto y volver a deployar. Acá los servicios viven en la colección services,
// GET /api/servicios es público y el cliente los INYECTA EN VIVO sobre las tarjetas ya renderizadas
// y sobre la página de detalle, con el MISMO marcado que hornean los dos módulos UI (incluido el
// ancla #servicio-N que une la tarjeta con su detalle). El ícono se guarda como NOMBRE Phosphor de
// una lista blanca —nunca como HTML— y el SVG se hornea en el cliente: así el negocio elige de una
// grilla y no puede inyectar marcado. Los puntos clave del detalle son una lista (máximo 6). El
// orden lo decide el servidor (botones subir/bajar), no el navegador. Se siembran los seis
// servicios del HTML horneado —título, texto, párrafo y puntos, tomados de los propios módulos UI
// para que no puedan divergir— así la primera carga no parpadea con datos distintos.
// Panel solo-admin, animado con Anime.js + red de seguridad. Requiere la sección de servicios.
const { phIcon } = require('../../src/icons');
const { servicios } = require('../ui/services');
const { DETALLES } = require('../ui/servicespage');

// Lista blanca de íconos elegibles desde el panel: el dato guardado es el NOMBRE, y el SVG lo
// hornea el generador acá abajo. Cubre los rubros típicos de un servicio comercial.
const ICONOS = [
  'seal-check', 'chat-circle-dots', 'lightning', 'shield-check', 'tag', 'headset',
  'truck', 'clock', 'users', 'target', 'handshake', 'heart',
  'chart-line-up', 'lock', 'map-pin', 'gift',
];

// Siembra: EXACTAMENTE los servicios que hornean services + servicespage (única fuente de
// verdad). Es función de cfg y no una constante porque desde el Builder la lista es editable:
// una semilla con los defaults dejaría la primera carga mostrando primero los servicios del
// HTML y un instante después otros distintos.
const semilla = (cfg) => servicios(cfg).map((s, i) => ({
  title: s.titulo,
  text: s.texto,
  icon: s.icon,
  detail: DETALLES[i % DETALLES.length].parrafo,
  bullets: DETALLES[i % DETALLES.length].puntos,
  active: true,
  order: i + 1,
}));

module.exports = {
  id: 'servicios', type: 'functional', name: 'Servicios administrables',
  description: 'Los servicios de la sección "Nuestros servicios" y de la página de detalle se guardan en el backend (colección services) y se inyectan en vivo sobre el HTML ya renderizado: el negocio agrega, edita, reordena o da de baja un servicio desde /servicios-admin.html y el sitio publicado lo refleja al instante, sin regenerar ni volver a deployar. Cada servicio tiene ícono (elegido de una grilla Phosphor, se guarda el nombre y nunca HTML), título, bajada, párrafo ampliado y hasta 6 puntos clave; las tarjetas y el detalle se reconstruyen con el mismo marcado y las mismas anclas #servicio-N que hornean los módulos UI. El orden lo decide el servidor. GET /api/servicios es público; el alta, la edición y el borrado son solo-admin. Animado con Anime.js.',
  usesAnime: true,
  requires: ['services'],
  mounts: [{ route: '/api/servicios', file: 'routes/servicios.js' }],
  collections: ['services'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Servicios (admin)', href: '/servicios-admin.html', id: 'nav-servicios-admin' }] : [],
  head: () => `  <style>
    .sv-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .sv-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .sv-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .sv-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .sv-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .sv-iconos{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
    .sv-ico{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:1px solid var(--line);border-radius:var(--radius);background:var(--bg);cursor:pointer;color:var(--muted)}
    .sv-ico[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 22%,transparent)}
  </style>`,
  files: (cfg) => ({
    'routes/servicios.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Íconos permitidos: el panel sólo ofrece estos y el servidor rechaza cualquier otro. El dato es
// el NOMBRE del ícono, nunca marcado: el SVG lo hornea el cliente desde su propia tabla.
const ICONOS = ${JSON.stringify(ICONOS)};

// Se siembran los mismos servicios que hornean la sección y la página de detalle: así la primera
// carga del sitio no parpadea mostrando primero el HTML y después datos distintos.
db.seedIfEmpty('services', ${JSON.stringify(semilla(cfg), null, 2).split('\n').join('\n')});

function resolver(s) {
  return {
    id: s.id,
    title: s.title || '',
    text: s.text || '',
    icon: ICONOS.includes(s.icon) ? s.icon : ICONOS[0],
    detail: s.detail || '',
    bullets: Array.isArray(s.bullets) ? s.bullets.slice(0, 6) : [],
    active: s.active !== false,
    order: Number(s.order) || 0,
  };
}

const ordenados = (rows) => rows.map(resolver)
  .sort((a, b) => (a.order - b.order) || String(a.title).localeCompare(String(b.title)));

// Valida el cuerpo de un alta o una edición. Devuelve {ok, error, patch}
function leer(body, parcial) {
  const patch = {};
  if (body.title !== undefined || !parcial) {
    if (!str(body.title, 2, 80)) return { ok: false, error: 'El título del servicio tiene que tener entre 2 y 80 caracteres' };
    patch.title = String(body.title).trim();
  }
  if (body.text !== undefined || !parcial) {
    if (!str(body.text, 2, 300)) return { ok: false, error: 'La bajada tiene que tener entre 2 y 300 caracteres' };
    patch.text = String(body.text).trim();
  }
  if (body.icon !== undefined) {
    if (!ICONOS.includes(body.icon)) return { ok: false, error: 'Ese ícono no está en la lista disponible' };
    patch.icon = body.icon;
  }
  if (body.detail !== undefined) patch.detail = String(body.detail).trim().slice(0, 1200);
  if (body.bullets !== undefined) {
    const lista = Array.isArray(body.bullets) ? body.bullets : String(body.bullets).split('\\n');
    // Se limpian vacíos y se corta en 6: la ficha del sitio no muestra más que eso
    patch.bullets = lista.map(b => String(b).trim().slice(0, 160)).filter(Boolean).slice(0, 6);
  }
  if (body.active !== undefined) patch.active = !(body.active === false || body.active === 'false');
  return { ok: true, patch };
}

// GET /api/servicios — público: sólo los servicios visibles, en el orden que fijó el negocio
router.get('/', async (req, res) => {
  const rows = ordenados(await db.all('services')).filter(s => s.active).map(s => {
    const { active, ...publico } = s;
    return publico;
  });
  res.json({ rows });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/servicios/todos — el panel ve también los servicios apagados
router.get('/todos', requireAdmin, async (req, res) => {
  res.json({ rows: ordenados(await db.all('services')), iconos: ICONOS });
});

// POST /api/servicios — alta. El orden lo decide el servidor: al final de la lista
router.post('/', requireAdmin, async (req, res) => {
  const { ok, error, patch } = leer(req.body, false);
  if (!ok) return res.status(422).json({ error });
  const todos = await db.all('services');
  const ultimo = todos.reduce((m, s) => Math.max(m, Number(s.order) || 0), 0);
  const row = await db.insert('services', {
    title: patch.title, text: patch.text,
    icon: patch.icon || ICONOS[0], detail: patch.detail || '',
    bullets: patch.bullets || [], active: patch.active !== false,
    order: ultimo + 1,
  });
  res.status(201).json(resolver(row));
});

// PUT /api/servicios/:id — edición parcial (el orden se cambia con /mover, no a mano)
router.put('/:id', requireAdmin, async (req, res) => {
  const s = await db.get('services', req.params.id);
  if (!s) return res.status(404).json({ error: 'Ese servicio no existe' });
  const { ok, error, patch } = leer(req.body, true);
  if (!ok) return res.status(422).json({ error });
  res.json(resolver(await db.update('services', s.id, patch)));
});

// POST /api/servicios/:id/mover — sube o baja el servicio intercambiando su posición con la vecina.
// El orden es del servidor: dos administradores no pueden dejarlo en estados distintos.
router.post('/:id/mover', requireAdmin, async (req, res) => {
  const dir = req.body.dir === 'sube' ? -1 : 1;
  const lista = ordenados(await db.all('services'));
  const i = lista.findIndex(s => s.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Ese servicio no existe' });
  const j = i + dir;
  if (j < 0 || j >= lista.length) return res.status(409).json({ error: dir < 0 ? 'Ese servicio ya es el primero' : 'Ese servicio ya es el último' });
  // Se reescriben las posiciones de toda la lista: así queda 1..N sin huecos ni empates
  const nueva = lista.slice();
  nueva[i] = lista[j];
  nueva[j] = lista[i];
  for (let k = 0; k < nueva.length; k++) await db.update('services', nueva[k].id, { order: k + 1 });
  res.json({ rows: ordenados(await db.all('services')) });
});

// DELETE /api/servicios/:id — baja definitiva (para sacarlo del sitio sin perderlo está el interruptor)
router.delete('/:id', requireAdmin, async (req, res) => {
  const s = await db.get('services', req.params.id);
  if (!s) return res.status(404).json({ error: 'Ese servicio no existe' });
  await db.remove('services', s.id);
  res.json({ ok: true });
});
` : `// La edición de servicios requiere el módulo de autenticación: activalo en el Builder para
// habilitar /servicios-admin.html. Sin él, los servicios se editan en data/services.json
// (la sección y la página de detalle los leen igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'servicios-admin': {
      title: 'Servicios',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('squares-four', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Servicios</h2>
      <p class="section-sub">Lo que cargues acá es lo que ve el visitante en la sección de servicios${cfg.moduleIds.includes('servicespage') ? ' y en la página de detalle' : ''}, al instante y sin regenerar nada. Solo visible para administradores.</p>

      <div class="card" style="margin-bottom:26px">
        <h3 id="sv-form-titulo">Nuevo servicio</h3>
        <form id="sv-form">
          <label>Título</label>
          <input name="title" required maxlength="80" placeholder="Garantía de calidad">
          <label>Bajada (la que se ve en la tarjeta)</label>
          <input name="text" required maxlength="300" placeholder="Cada trabajo se revisa antes de entregarse.">
          <label id="sv-icono-label">Ícono</label>
          <div class="sv-iconos" id="sv-iconos" role="group" aria-labelledby="sv-icono-label"></div>
          <label>Descripción ampliada${cfg.moduleIds.includes('servicespage') ? '' : ' (se guarda aunque la página de detalle esté apagada)'}</label>
          <textarea name="detail" rows="4" maxlength="1200" placeholder="Cada trabajo pasa por una revisión final antes de entregarse…"></textarea>
          <label>Puntos clave (uno por línea, hasta 6)</label>
          <textarea name="bullets" rows="4" placeholder="Control de calidad documentado&#10;Garantía escrita&#10;Correcciones sin cargo"></textarea>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="active" style="width:auto;margin:0" checked> Visible en el sitio</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="sv-guardar">Agregar servicio</button>
            <button class="btn ghost" type="button" id="sv-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>

      <div id="sv-lista"><p class="muted">Cargando…</p></div>
      <p class="muted" style="font-size:.85rem;margin-top:14px">El orden de esta tabla es el orden en que se ven las tarjetas en el sitio.</p>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo servicios: trae los servicios de /api/servicios y reconstruye la sección de la home${cfg.moduleIds.includes('servicespage') ? `
   y la página de detalle` : ''} con el mismo marcado que hornean los módulos UI (incluidas las
   anclas #servicio-N).${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel de edición vive en /servicios-admin.html.` : ''}
   Anime.js para la aparición de las tarjetas, con red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Íconos horneados por nombre: el backend guarda el nombre, el SVG lo pone el cliente
  var ICO = ${JSON.stringify(Object.fromEntries(ICONOS.map(n => [n, phIcon(n, { size: 34, color: 'var(--accent)' })])))};
  var ICO_MINI = ${JSON.stringify(Object.fromEntries(ICONOS.map(n => [n, phIcon(n, { size: 22 })])))};
  var FLECHA = ${JSON.stringify(phIcon('arrow-right', { size: 13 }))};
  var SUBIR = ${JSON.stringify(phIcon('arrow-up', { size: 14 }))};
  var BAJAR = ${JSON.stringify(phIcon('arrow-down', { size: 14 }))};
  var conDetalle = ${cfg.moduleIds.includes('servicespage') ? 'true' : 'false'};

  function icono(n) { return ICO[n] || ICO[Object.keys(ICO)[0]]; }

  // ---- Sección pública de la home: reemplaza las tarjetas horneadas ----
  function pintarSeccion(rows) {
    var seccion = document.getElementById('servicios');
    if (!seccion || !rows || !rows.length) return;
    var grid = seccion.querySelector('.grid');
    if (!grid) return;
    grid.innerHTML = rows.map(function (s, i) {
      return '<div class="card">' + icono(s.icon) +
        '<h3 style="margin:12px 0 6px">' + App.esc(s.title) + '</h3>' +
        '<p class="muted" style="margin:0">' + App.esc(s.text) + '</p>' +
        (conDetalle ? '<a href="/services.html#servicio-' + (i + 1) + '" style="display:inline-flex;align-items:center;gap:4px;margin-top:10px;font-size:.9rem">Ver detalle ' + FLECHA + '</a>' : '') +
        '</div>';
    }).join('');
    aparecer(grid.children);
  }

  // ---- Página de detalle: mismas anclas #servicio-N que hornea servicespage ----
  function pintarDetalle(rows) {
    var box = document.getElementById('servicios-detalle');
    if (!box || !rows || !rows.length) return;
    box.innerHTML = rows.map(function (s, i) {
      var puntos = (s.bullets || []).map(function (p) {
        return '<li class="muted" style="margin:4px 0">' + App.esc(p) + '</li>';
      }).join('');
      return '<article id="servicio-' + (i + 1) + '" class="card" style="margin-bottom:20px;scroll-margin-top:80px">' +
        '<div style="display:flex;gap:14px;align-items:center;margin-bottom:10px">' + icono(s.icon) +
        '<h3 style="margin:0">' + App.esc(s.title) + '</h3></div>' +
        '<p class="muted" style="margin:0 0 12px">' + App.esc(s.detail || s.text) + '</p>' +
        (puntos ? '<ul style="margin:0;padding-left:20px">' + puntos + '</ul>' : '') +
        '</article>';
    }).join('');
    aparecer(box.children);
    // El navegador ya resolvió el #hash con el DOM viejo: se vuelve a llevar al ancla pedida
    if (location.hash) {
      var destino = document.getElementById(location.hash.slice(1));
      if (destino) destino.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function aparecer(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [10, 0], duration: 420, delay: anime.stagger ? anime.stagger(55) : 0, ease: 'outCubic' });
    // Red de seguridad: con la pestaña oculta el loop de Anime no corre y las tarjetas se
    // quedarían en opacidad 0. Se fija el estado final igual.
    setTimeout(function () {
      Array.prototype.forEach.call(nodos, function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
    }, 900);
  }

  var DEMO = ${JSON.stringify(semilla(cfg).map((s, i) => ({ id: 'd' + (i + 1), ...s })))};

  function pintarTodo(rows) { pintarSeccion(rows); pintarDetalle(rows); }

  if (document.getElementById('servicios') || document.getElementById('servicios-detalle')) {
    if (window.__PREVIEW__) pintarTodo(DEMO);
    else fetch('/api/servicios').then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.rows) pintarTodo(d.rows); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /servicios-admin.html ----
  var form = document.getElementById('sv-form');
  var box = document.getElementById('sv-lista');
  if (form && box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var editando = '';
    var iconoElegido = Object.keys(ICO)[0];

    // Grilla de íconos: se elige uno solo, el valor viaja como nombre
    function pintarIconos() {
      var cont = document.getElementById('sv-iconos');
      if (!cont) return;
      cont.innerHTML = Object.keys(ICO_MINI).map(function (n) {
        return '<button type="button" class="sv-ico" data-sv-ico="' + n + '" aria-pressed="' + (n === iconoElegido) + '" title="' + n + '" aria-label="Ícono ' + n + '">' + ICO_MINI[n] + '</button>';
      }).join('');
      cont.querySelectorAll('[data-sv-ico]').forEach(function (b) {
        b.addEventListener('click', function () {
          iconoElegido = b.getAttribute('data-sv-ico');
          pintarIconos();
        });
      });
    }

    function salirDeEdicion() {
      editando = '';
      form.reset();
      form.querySelector('[name="active"]').checked = true;
      iconoElegido = Object.keys(ICO)[0];
      pintarIconos();
      document.getElementById('sv-form-titulo').textContent = 'Nuevo servicio';
      document.getElementById('sv-guardar').textContent = 'Agregar servicio';
      document.getElementById('sv-cancelar').hidden = true;
    }

    function editar(s) {
      editando = s.id;
      form.querySelector('[name="title"]').value = s.title || '';
      form.querySelector('[name="text"]').value = s.text || '';
      form.querySelector('[name="detail"]').value = s.detail || '';
      form.querySelector('[name="bullets"]').value = (s.bullets || []).join('\\n');
      form.querySelector('[name="active"]').checked = s.active !== false;
      iconoElegido = s.icon;
      pintarIconos();
      document.getElementById('sv-form-titulo').textContent = 'Editando: ' + s.title;
      document.getElementById('sv-guardar').textContent = 'Guardar cambios';
      document.getElementById('sv-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function pintar() {
      box.innerHTML = App.table(lista, [
        { label: '', render: function (s) { return ICO_MINI[s.icon] || ''; } },
        { label: 'Servicio', render: function (s) {
          return '<strong>' + App.esc(s.title) + '</strong><br><span class="muted" style="font-size:.8rem">' + App.esc(s.text) + '</span>';
        } },
        { label: 'Puntos', render: function (s) { return '<span class="muted">' + (s.bullets || []).length + '</span>'; } },
        { label: 'Estado', render: function (s) { return s.active ? '<span class="sv-chip on">Visible</span>' : '<span class="sv-chip off">Oculto</span>'; } },
        { label: '', render: function (s) {
          return '<span class="sv-acciones">' +
            '<button class="btn ghost" type="button" aria-label="Subir" title="Subir" data-sv-sube="' + s.id + '">' + SUBIR + '</button>' +
            '<button class="btn ghost" type="button" aria-label="Bajar" title="Bajar" data-sv-baja="' + s.id + '">' + BAJAR + '</button>' +
            '<button class="btn ghost" type="button" data-sv-edit="' + s.id + '">Editar</button>' +
            '<button class="btn ghost" type="button" data-sv-ver="' + s.id + '">' + (s.active ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn ghost" type="button" data-sv-del="' + s.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-sv-edit]').forEach(function (b) {
        b.addEventListener('click', function () { var s = buscar(b.getAttribute('data-sv-edit')); if (s) editar(s); });
      });
      box.querySelectorAll('[data-sv-sube]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-sv-sube'), 'sube'); });
      });
      box.querySelectorAll('[data-sv-baja]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-sv-baja'), 'baja'); });
      });
      box.querySelectorAll('[data-sv-ver]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var s = buscar(b.getAttribute('data-sv-ver'));
          if (!s) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
          try {
            await App.api('/api/servicios/' + s.id, { method: 'PUT', body: { active: !s.active } });
            App.toast(s.active ? 'Servicio oculto' : 'Servicio visible');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-sv-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar este servicio? Si sólo querés sacarlo del sitio, usá "Ocultar".')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/servicios/' + b.getAttribute('data-sv-del'), { method: 'DELETE' });
            App.toast('Servicio borrado');
            if (editando === b.getAttribute('data-sv-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reordenaría'); return; }
      try {
        var out = await App.api('/api/servicios/' + id + '/mover', { method: 'POST', body: { dir: dir } });
        lista = out.rows;
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function cargar() {
      if (window.__PREVIEW__) { lista = DEMO.slice(); pintar(); return; }
      try {
        var out = await App.api('/api/servicios/todos');
        lista = out.rows;
        pintar();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        title: form.querySelector('[name="title"]').value,
        text: form.querySelector('[name="text"]').value,
        detail: form.querySelector('[name="detail"]').value,
        // Un punto clave por línea: el servidor limpia vacíos y corta en 6
        bullets: form.querySelector('[name="bullets"]').value.split('\\n'),
        active: form.querySelector('[name="active"]').checked,
        icon: iconoElegido,
      };
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el servicio'); return; }
      try {
        if (editando) await App.api('/api/servicios/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/servicios', { method: 'POST', body: datos });
        App.toast(editando ? 'Servicio actualizado' : 'Servicio agregado');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var cancelar = document.getElementById('sv-cancelar');
    if (cancelar) cancelar.addEventListener('click', salirDeEdicion);

    pintarIconos();
    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      form.style.display = 'none';
    } else {
      cargar();
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(form, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: 'outCubic' });
        setTimeout(function () { form.style.opacity = 1; form.style.transform = 'none'; }, 800);
      }
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navS = document.getElementById('nav-servicios-admin');
    if (navS && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navS.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Servicios administrables**: los servicios viven en la colección \`services\` y se inyectan en vivo sobre la sección de la home${cfg.moduleIds.includes('servicespage') ? ' y sobre la página de detalle (`/services.html`)' : ''}, así que **agregar, editar o dar de baja un servicio no requiere regenerar ni volver a deployar**. Se siembran los seis servicios de ejemplo del HTML: reemplazalos por los reales ${cfg.moduleIds.includes('auth') ? 'desde `/servicios-admin.html`' : 'editando `data/services.json` (o activá el módulo **Autenticación** para editarlos desde la web en `/servicios-admin.html`)'}. El **ícono se elige de una grilla** (se guarda el nombre, nunca marcado) y los **puntos clave** se cargan uno por línea, hasta 6. El **orden lo decide el servidor** (botones de subir y bajar del panel).`,
  ],
};
