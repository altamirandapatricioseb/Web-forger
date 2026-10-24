// Preguntas frecuentes administrables con backend real: el acordeón de la sección FAQ (módulo UI
// faq) traía las preguntas HORNEADAS en una constante del generador, así que agregar la pregunta
// que el negocio recibe todos los días por WhatsApp obligaba a regenerar el sitio. Acá viven en la
// colección faqs, GET /api/faqs es público y el cliente REEMPLAZA EN VIVO los <details> ya
// renderizados por los del backend, con el mismo marcado (details.card.faq-item > summary.faq-q +
// caret, div.faq-a > div.faq-a-inner > p) para que el despliegue animado siga funcionando: por eso
// faq expone window.WFFaq.rebind(). Además reescribe el JSON-LD FAQPage del <head> con las
// preguntas reales, así el rich result de Google deja de mostrar los ejemplos (los rastreadores que
// ejecutan JS lo ven actualizado; el HTML horneado sigue siendo válido para los que no).
// La pieza que lo vuelve útil de verdad es que el negocio ve QUÉ SE PREGUNTA: cada apertura suma
// una vista (POST /api/faqs/:id/vista, público y anónimo, sin cookies ni datos personales), y el
// panel ordena por vistas para que se sepa cuál conviene contestar mejor o subir arriba de todo.
// El orden lo decide el servidor (botones subir/bajar), no el navegador. Se siembran las mismas
// tres preguntas del HTML horneado para que la primera carga no parpadee. Panel solo-admin,
// animado con Anime.js + red de seguridad. Requiere la sección de preguntas frecuentes (faq).
const { phIcon } = require('../../src/icons');
// Las preguntas salen del propio módulo UI (que las resuelve contra la config del Builder):
// una copia literal acá se desincronizaría en cuanto el usuario editara la sección.
const { faqs } = require('../ui/faq');

// Semilla de la colección: EXACTAMENTE las preguntas que hornea la sección.
const semilla = (cfg) => faqs(cfg).map((f, i) => ({ q: f.q, a: f.a, active: true, order: i + 1, views: 0 }));

module.exports = {
  id: 'faqadmin', type: 'functional', name: 'Preguntas frecuentes administrables',
  description: 'Las preguntas del acordeón FAQ se guardan en el backend (colección faqs) y se inyectan en vivo sobre la sección: el negocio agrega, edita, reordena y oculta preguntas desde /faq-admin.html y el sitio publicado lo refleja al instante, sin regenerar. Reconstruye los <details> con el mismo marcado del módulo Preguntas frecuentes (el despliegue animado se re-engancha) y reescribe el JSON-LD FAQPage del head con las preguntas reales. Cada apertura suma una vista anónima, así el panel muestra qué se pregunta más. GET /api/faqs es público; el alta, la edición y el borrado son solo-admin. Animado con Anime.js.',
  usesAnime: true,
  requires: ['faq'],
  mounts: [{ route: '/api/faqs', file: 'routes/faqs.js' }],
  collections: ['faqs'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Preguntas', href: '/faq-admin.html', id: 'nav-faq-admin' }] : [],
  head: () => `  <style>
    .fq-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .fq-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .fq-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .fq-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .fq-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .fq-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .fq-resp{font-size:.85rem;color:var(--muted);max-width:44ch}
  </style>`,
  files: (cfg) => ({
    'routes/faqs.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Se siembran las mismas preguntas que hornea la sección: así la primera carga del sitio no
// parpadea mostrando primero el HTML y después datos distintos.
db.seedIfEmpty('faqs', ${JSON.stringify(semilla(cfg), null, 2)});

const limpiar = (f) => ({
  id: f.id,
  q: f.q || '',
  a: f.a || '',
  active: f.active !== false,
  order: Number(f.order) || 0,
  views: Number(f.views) || 0,
});

const ordenados = (rows) => rows.map(limpiar).sort((a, b) => (a.order - b.order) || String(a.q).localeCompare(String(b.q)));

// GET /api/faqs — público: sólo las preguntas visibles, en el orden que fijó el negocio.
// No expone el contador de vistas: es un dato del negocio, no del visitante.
router.get('/', async (req, res) => {
  const rows = ordenados(await db.all('faqs')).filter(f => f.active)
    .map(({ id, q, a }) => ({ id, q, a }));
  res.json({ rows });
});

// POST /api/faqs/:id/vista — el visitante abrió esa pregunta. Público y anónimo: no guarda quién
// fue ni desde dónde, sólo incrementa un contador. Responde 204 para que el cliente no espere nada.
router.post('/:id/vista', async (req, res) => {
  const f = await db.get('faqs', req.params.id);
  if (f) await db.update('faqs', f.id, { views: (Number(f.views) || 0) + 1 });
  res.status(204).end();
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/faqs/todas — el panel ve también las preguntas ocultas y las vistas.
// ?orden=vistas las trae por lo más consultado (para decidir qué subir arriba de todo)
router.get('/todas', requireAdmin, async (req, res) => {
  let rows = ordenados(await db.all('faqs'));
  if (req.query.orden === 'vistas') rows = rows.slice().sort((a, b) => b.views - a.views);
  res.json({ rows, totalVistas: rows.reduce((s, f) => s + f.views, 0) });
});

// POST /api/faqs — alta. El orden lo decide el servidor: al final de la lista
router.post('/', requireAdmin, async (req, res) => {
  if (!str(req.body.q, 5, 160)) return res.status(422).json({ error: 'La pregunta tiene que tener entre 5 y 160 caracteres' });
  if (!str(req.body.a, 2, 1200)) return res.status(422).json({ error: 'La respuesta tiene que tener entre 2 y 1200 caracteres' });
  const todas = await db.all('faqs');
  const ultimo = todas.reduce((m, f) => Math.max(m, Number(f.order) || 0), 0);
  const row = await db.insert('faqs', {
    q: String(req.body.q).trim(),
    a: String(req.body.a).trim(),
    active: !(req.body.active === false || req.body.active === 'false'),
    order: ultimo + 1,
    views: 0,
  });
  res.status(201).json(limpiar(row));
});

// PUT /api/faqs/:id — edición parcial (el orden se cambia con /mover, no a mano)
router.put('/:id', requireAdmin, async (req, res) => {
  const f = await db.get('faqs', req.params.id);
  if (!f) return res.status(404).json({ error: 'Esa pregunta no existe' });
  const patch = {};
  if (req.body.q !== undefined) {
    if (!str(req.body.q, 5, 160)) return res.status(422).json({ error: 'Pregunta inválida (5 a 160 caracteres)' });
    patch.q = String(req.body.q).trim();
  }
  if (req.body.a !== undefined) {
    if (!str(req.body.a, 2, 1200)) return res.status(422).json({ error: 'Respuesta inválida (2 a 1200 caracteres)' });
    patch.a = String(req.body.a).trim();
  }
  if (req.body.active !== undefined) patch.active = !(req.body.active === false || req.body.active === 'false');
  res.json(limpiar(await db.update('faqs', f.id, patch)));
});

// POST /api/faqs/:id/mover — sube o baja la pregunta intercambiándola con su vecina.
// El orden es del servidor: dos administradores no pueden dejarlo en estados distintos.
router.post('/:id/mover', requireAdmin, async (req, res) => {
  const dir = req.body.dir === 'sube' ? -1 : 1;
  const lista = ordenados(await db.all('faqs'));
  const i = lista.findIndex(f => f.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Esa pregunta no existe' });
  const j = i + dir;
  if (j < 0 || j >= lista.length) return res.status(409).json({ error: dir < 0 ? 'Esa pregunta ya es la primera' : 'Esa pregunta ya es la última' });
  const nueva = lista.slice();
  nueva[i] = lista[j];
  nueva[j] = lista[i];
  // Se reescriben las posiciones de toda la lista: queda 1..N sin huecos ni empates
  for (let k = 0; k < nueva.length; k++) await db.update('faqs', nueva[k].id, { order: k + 1 });
  res.json({ rows: ordenados(await db.all('faqs')) });
});

// DELETE /api/faqs/:id — baja definitiva (para esconderla sin perderla está el interruptor)
router.delete('/:id', requireAdmin, async (req, res) => {
  const f = await db.get('faqs', req.params.id);
  if (!f) return res.status(404).json({ error: 'Esa pregunta no existe' });
  await db.remove('faqs', f.id);
  res.json({ ok: true });
});
` : `// La edición de preguntas requiere el módulo de autenticación: activalo en el Builder para
// habilitar /faq-admin.html. Sin él, se editan en data/faqs.json (la sección las lee igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'faq-admin': {
      title: 'Preguntas frecuentes',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('chat-circle-dots', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Preguntas frecuentes</h2>
      <p class="section-sub">Lo que cargues acá es lo que ve el visitante en el acordeón del sitio, al instante y sin regenerar nada. La columna "Vistas" cuenta cuántas veces se abrió cada pregunta: sirve para saber qué conviene contestar mejor. Solo visible para administradores.</p>

      <div class="card" style="margin-bottom:26px">
        <h3 id="fq-form-titulo">Nueva pregunta</h3>
        <form id="fq-form">
          <label>Pregunta</label>
          <input name="q" required minlength="5" maxlength="160" placeholder="¿Hacen envíos al interior?">
          <label>Respuesta</label>
          <textarea name="a" required maxlength="1200" rows="4" placeholder="Sí, enviamos a todo el país por correo. El costo se calcula al finalizar la compra."></textarea>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="active" style="width:auto;margin:0" checked> Visible en el sitio</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="fq-guardar">Agregar pregunta</button>
            <button class="btn ghost" type="button" id="fq-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
        <select id="fq-orden" style="width:auto;margin:0">
          <option value="">Orden del sitio</option>
          <option value="vistas">Las más consultadas primero</option>
        </select>
      </div>
      <div id="fq-lista"><p class="muted">Cargando…</p></div>
      <p class="muted" style="font-size:.85rem;margin-top:14px" id="fq-pie"></p>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo preguntas frecuentes administrables: trae las preguntas de /api/faqs y reemplaza los
   <details> horneados por los del backend, con el mismo marcado para que el despliegue animado del
   módulo faq se re-enganche (window.WFFaq.rebind). También reescribe el JSON-LD FAQPage del head y
   registra una vista anónima cada vez que el visitante abre una pregunta.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel de edición vive en /faq-admin.html.` : ''} */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // El caret es el mismo ícono Phosphor que hornea la sección: se replica tal cual
  var CARET = ${JSON.stringify(phIcon('caret-down', { size: 18, cls: 'faq-caret' }))};
  // Íconos horneados: los botones de reordenar llevan flecha Phosphor, no el glifo ↑↓
  var SUBIR = ${JSON.stringify(phIcon('arrow-up', { size: 14 }))};
  var BAJAR = ${JSON.stringify(phIcon('arrow-down', { size: 14 }))};

  // ---- Sección pública: reemplaza el acordeón horneado por el del backend ----
  function pintarSeccion(rows) {
    var faq = document.getElementById('faq');
    if (!faq || !rows || !rows.length) return;
    var grid = faq.querySelector('.grid');
    if (!grid) return;
    grid.innerHTML = rows.map(function (f) {
      return '<details class="card faq-item" data-faq-id="' + App.esc(f.id) + '">' +
        '<summary class="faq-q">' + App.esc(f.q) + ' ' + CARET + '</summary>' +
        '<div class="faq-a"><div class="faq-a-inner"><p class="muted">' + App.esc(f.a) + '</p></div></div>' +
        '</details>';
    }).join('');
    // El acordeón animado engancha sus handlers por ítem: hay que avisarle de los nuevos.
    // Si el módulo faq salió temprano (prefers-reduced-motion) no existe WFFaq y el
    // <details> nativo sigue funcionando: instantáneo, nunca contenido invisible.
    if (window.WFFaq && window.WFFaq.rebind) window.WFFaq.rebind();
    contarAperturas(grid);
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(grid.children, { opacity: [0, 1], translateY: [8, 0], duration: 380, delay: anime.stagger ? anime.stagger(50) : 0, ease: 'outCubic' });
      // Red de seguridad: con la pestaña oculta el loop de Anime no corre y las tarjetas
      // se quedarían invisibles. Se fija el estado final igual.
      setTimeout(function () {
        Array.prototype.forEach.call(grid.children, function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
      }, 900);
    }
    actualizarJsonLd(rows);
  }

  // Una vista por pregunta y por carga de página: abrir y cerrar diez veces no infla el número
  function contarAperturas(grid) {
    Array.prototype.forEach.call(grid.querySelectorAll('.faq-item[data-faq-id]'), function (item) {
      item.addEventListener('toggle', function () {
        if (!item.open || item._vista) return;
        item._vista = true;
        if (window.__PREVIEW__) return;
        // keepalive: la vista se registra aunque el visitante navegue enseguida
        fetch('/api/faqs/' + encodeURIComponent(item.getAttribute('data-faq-id')) + '/vista', { method: 'POST', keepalive: true }).catch(function () {});
      });
    });
  }

  // El <head> trae el JSON-LD FAQPage con las preguntas horneadas: se reescribe con las reales.
  // Los rastreadores que ejecutan JS ven las de verdad; los que no, siguen viendo un FAQPage válido.
  function actualizarJsonLd(rows) {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      var datos = null;
      try { datos = JSON.parse(scripts[i].textContent); } catch (e) { datos = null; }
      if (!datos || datos['@type'] !== 'FAQPage') continue;
      datos.mainEntity = rows.map(function (f) {
        return { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } };
      });
      // El escape de "<" evita que una respuesta con markup cierre el <script> antes de tiempo
      scripts[i].textContent = JSON.stringify(datos).replace(/</g, '\\\\u003c');
      return;
    }
  }

  // Datos de la vista previa del Builder (la API no corre ahí): las mismas preguntas del
  // HTML, con vistas de ejemplo para que el panel se vea como se va a ver con uso real.
  var DEMO = ${JSON.stringify(semilla(cfg).map((f, i) => ({ id: String(i + 1), ...f, views: [42, 31, 12][i] || 0 })))};

  if (document.getElementById('faq')) {
    if (window.__PREVIEW__) pintarSeccion(DEMO);
    else fetch('/api/faqs').then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.rows) pintarSeccion(d.rows); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /faq-admin.html ----
  var form = document.getElementById('fq-form');
  var box = document.getElementById('fq-lista');
  if (form && box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var editando = '';

    function salirDeEdicion() {
      editando = '';
      form.reset();
      form.querySelector('[name="active"]').checked = true;
      document.getElementById('fq-form-titulo').textContent = 'Nueva pregunta';
      document.getElementById('fq-guardar').textContent = 'Agregar pregunta';
      document.getElementById('fq-cancelar').hidden = true;
    }

    function editar(f) {
      editando = f.id;
      form.querySelector('[name="q"]').value = f.q;
      form.querySelector('[name="a"]').value = f.a;
      form.querySelector('[name="active"]').checked = f.active !== false;
      document.getElementById('fq-form-titulo').textContent = 'Editando pregunta';
      document.getElementById('fq-guardar').textContent = 'Guardar cambios';
      document.getElementById('fq-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function pintar(porVistas) {
      box.innerHTML = App.table(lista, [
        { label: 'Pregunta', render: function (f) {
          return '<strong>' + App.esc(f.q) + '</strong><br><span class="fq-resp">' + App.esc(f.a.length > 120 ? f.a.slice(0, 120) + '…' : f.a) + '</span>';
        } },
        { label: 'Vistas', render: function (f) { return '<span class="fq-num">' + f.views + '</span>'; } },
        { label: 'Estado', render: function (f) { return f.active ? '<span class="fq-chip on">Visible</span>' : '<span class="fq-chip off">Oculta</span>'; } },
        { label: '', render: function (f) {
          // Con la tabla ordenada por vistas, mover confundiría: los botones sólo salen en el orden del sitio
          return '<span class="fq-acciones">' +
            (porVistas ? '' : '<button class="btn ghost" type="button" aria-label="Subir" title="Subir" data-fq-sube="' + f.id + '">' + SUBIR + '</button>' +
              '<button class="btn ghost" type="button" aria-label="Bajar" title="Bajar" data-fq-baja="' + f.id + '">' + BAJAR + '</button>') +
            '<button class="btn ghost" type="button" data-fq-edit="' + f.id + '">Editar</button>' +
            '<button class="btn ghost" type="button" data-fq-ver="' + f.id + '">' + (f.active ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn ghost" type="button" data-fq-del="' + f.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-fq-edit]').forEach(function (b) {
        b.addEventListener('click', function () { var f = buscar(b.getAttribute('data-fq-edit')); if (f) editar(f); });
      });
      box.querySelectorAll('[data-fq-sube]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-fq-sube'), 'sube'); });
      });
      box.querySelectorAll('[data-fq-baja]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-fq-baja'), 'baja'); });
      });
      box.querySelectorAll('[data-fq-ver]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var f = buscar(b.getAttribute('data-fq-ver'));
          if (!f) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
          try {
            await App.api('/api/faqs/' + f.id, { method: 'PUT', body: { active: !f.active } });
            App.toast(f.active ? 'Pregunta oculta' : 'Pregunta visible');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-fq-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar esta pregunta? Si sólo querés sacarla del sitio, usá "Ocultar".')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/faqs/' + b.getAttribute('data-fq-del'), { method: 'DELETE' });
            App.toast('Pregunta borrada');
            if (editando === b.getAttribute('data-fq-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reordenaría'); return; }
      try {
        var out = await App.api('/api/faqs/' + id + '/mover', { method: 'POST', body: { dir: dir } });
        lista = out.rows;
        pintar(false);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function cargar() {
      var orden = (document.getElementById('fq-orden') || {}).value || '';
      var pie = document.getElementById('fq-pie');
      if (window.__PREVIEW__) {
        lista = DEMO.slice();
        if (orden === 'vistas') lista.sort(function (a, b) { return b.views - a.views; });
        pintar(orden === 'vistas');
        if (pie) pie.textContent = '85 aperturas registradas en total.';
        return;
      }
      try {
        var out = await App.api('/api/faqs/todas' + (orden ? '?orden=vistas' : ''));
        lista = out.rows;
        pintar(orden === 'vistas');
        if (pie) pie.textContent = out.totalVistas
          ? out.totalVistas + ' aperturas registradas en total. El orden de esta tabla es el orden en que se ven en el sitio.'
          : 'Todavía nadie abrió una pregunta. El orden de esta tabla es el orden en que se ven en el sitio.';
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        q: form.querySelector('[name="q"]').value,
        a: form.querySelector('[name="a"]').value,
        active: form.querySelector('[name="active"]').checked,
      };
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la pregunta'); return; }
      try {
        if (editando) await App.api('/api/faqs/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/faqs', { method: 'POST', body: datos });
        App.toast(editando ? 'Pregunta actualizada' : 'Pregunta agregada');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var cancelar = document.getElementById('fq-cancelar');
    if (cancelar) cancelar.addEventListener('click', salirDeEdicion);
    var ordenSel = document.getElementById('fq-orden');
    if (ordenSel) ordenSel.addEventListener('change', cargar);

    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      form.style.display = 'none';
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
    var navF = document.getElementById('nav-faq-admin');
    if (navF && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navF.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Preguntas frecuentes administrables**: las preguntas viven en la colección \`faqs\` y se inyectan en vivo sobre el acordeón del sitio, así que **agregar una pregunta no requiere regenerar ni volver a deployar**. Se siembran las tres de ejemplo: reemplazalas por las reales ${cfg.moduleIds.includes('auth') ? 'desde `/faq-admin.html`' : 'editando `data/faqs.json` (o activá el módulo **Autenticación** para editarlas desde la web en `/faq-admin.html`)'}. Cada apertura suma una **vista anónima** (no se guarda quién ni desde dónde) y el panel puede ordenar por las más consultadas. El **JSON-LD FAQPage** del \`<head>\` se reescribe con las preguntas reales para los buscadores que ejecutan JS; el horneado sigue siendo válido para los que no, así que **conviene regenerar el sitio de vez en cuando** si las preguntas cambiaron mucho.`,
  ],
};
