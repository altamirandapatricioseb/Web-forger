// Equipo administrable con backend real: la sección "Nuestro equipo" (módulo UI team) traía tres
// personas INVENTADAS y horneadas en el HTML (Ana Pérez, Bruno Díaz, Carla Gómez), así que todo
// sitio generado salía a producción con nombres falsos hasta que alguien editara el HTML a mano —
// y cada alta o baja del equipo obligaba a regenerar y volver a deployar. Acá las personas viven en
// la colección teamcards, GET /api/equipo es público y el cliente REEMPLAZA EN VIVO las tarjetas.
// Cada persona puede tener foto por URL (si el módulo de archivos está activo, la URL sale de ahí)
// y si no la tiene se dibuja el mismo avatar de iniciales con degradado del HTML original, así una
// ficha sin foto nunca se ve rota. El orden lo decide el servidor (botones subir/bajar), no el
// navegador, y una persona que se va se puede OCULTAR en vez de borrar: el dato queda.
// Panel solo-admin /equipo-admin.html, animado con Anime.js (aparición escalonada de las tarjetas)
// + red de seguridad. Distinto de "personal" (el legajo interno con fichajes y horas): acá es la
// cara pública del equipo, y son datos y públicos distintos.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'equipo', type: 'functional', name: 'Equipo administrable',
  description: 'Las personas de la sección "Nuestro equipo" se guardan en el backend (colección teamcards) y se inyectan en vivo sobre las tarjetas: el negocio da de alta, edita, reordena y oculta gente desde /equipo-admin.html y el sitio publicado lo refleja al instante, sin regenerar. Cada persona admite foto por URL y, sin foto, se dibuja el avatar de iniciales con degradado del diseño original. El orden lo decide el servidor. GET /api/equipo es público; el alta, la edición y el borrado son solo-admin. Distinto del módulo Personal (legajo interno con fichajes): acá es la cara pública del equipo. Animado con Anime.js.',
  usesAnime: true,
  requires: ['team'],
  mounts: [{ route: '/api/equipo', file: 'routes/equipo.js' }],
  collections: ['teamcards'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Equipo', href: '/equipo-admin.html', id: 'nav-equipo-admin' }] : [],
  head: () => `  <style>
    .eq-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .eq-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .eq-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .eq-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .eq-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .eq-mini{width:38px;height:38px;border-radius:50%;object-fit:cover;vertical-align:middle}
    .eq-bio{font-size:.85rem;color:var(--muted);max-width:40ch}
  </style>`,
  files: (cfg) => ({
    'routes/equipo.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Se siembran las mismas tres personas de ejemplo que hornea la sección: así la primera carga no
// parpadea. Son NOMBRES INVENTADOS: hay que reemplazarlos por los reales antes de publicar.
db.seedIfEmpty('teamcards', [
  { name: 'Ana Pérez', role: 'Dirección general', bio: 'Lidera el rumbo del negocio con 15 años de oficio.', photo: '', active: true, order: 1 },
  { name: 'Bruno Díaz', role: 'Atención al cliente', bio: 'Tu primer contacto: rápido, claro y resolutivo.', photo: '', active: true, order: 2 },
  { name: 'Carla Gómez', role: 'Operaciones', bio: 'Hace que todo salga a tiempo y como se prometió.', photo: '', active: true, order: 3 },
]);

// Una foto válida es una ruta del propio sitio (la que devuelve el módulo de archivos) o una URL
// http(s). Cualquier otra cosa (javascript:, data:) se rechaza: eso termina en el HTML del sitio.
const FOTO = /^(\\/[\\w\\-./%]*|https?:\\/\\/[^\\s"'<>]+)$/;

const limpiar = (p) => ({
  id: p.id,
  name: p.name || '',
  role: p.role || '',
  bio: p.bio || '',
  photo: p.photo || '',
  active: p.active !== false,
  order: Number(p.order) || 0,
});

const ordenados = (rows) => rows.map(limpiar).sort((a, b) => (a.order - b.order) || String(a.name).localeCompare(String(b.name)));

// Valida el cuerpo de un alta o una edición. Devuelve {ok, error, patch}
function leer(body, parcial) {
  const patch = {};
  if (body.name !== undefined || !parcial) {
    if (!str(body.name, 2, 60)) return { ok: false, error: 'El nombre tiene que tener entre 2 y 60 caracteres' };
    patch.name = String(body.name).trim();
  }
  if (body.role !== undefined || !parcial) {
    if (!str(body.role, 2, 60)) return { ok: false, error: 'El rol tiene que tener entre 2 y 60 caracteres' };
    patch.role = String(body.role).trim();
  }
  if (body.bio !== undefined) patch.bio = String(body.bio).trim().slice(0, 240);
  if (body.photo !== undefined) {
    const v = String(body.photo).trim();
    if (v && !FOTO.test(v)) return { ok: false, error: 'La foto tiene que ser una ruta del sitio (/uploads/…) o una URL http(s)' };
    patch.photo = v;
  }
  if (body.active !== undefined) patch.active = !(body.active === false || body.active === 'false');
  return { ok: true, patch };
}

// GET /api/equipo — público: sólo la gente visible, en el orden que fijó el negocio
router.get('/', async (req, res) => {
  const rows = ordenados(await db.all('teamcards')).filter(p => p.active)
    .map(({ id, name, role, bio, photo }) => ({ id, name, role, bio, photo }));
  res.json({ rows });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/equipo/todos — el panel ve también a la gente oculta
router.get('/todos', requireAdmin, async (req, res) => {
  res.json({ rows: ordenados(await db.all('teamcards')) });
});

// POST /api/equipo — alta. El orden lo decide el servidor: al final de la lista
router.post('/', requireAdmin, async (req, res) => {
  const { ok, error, patch } = leer(req.body, false);
  if (!ok) return res.status(422).json({ error });
  const todos = await db.all('teamcards');
  const ultimo = todos.reduce((m, p) => Math.max(m, Number(p.order) || 0), 0);
  const row = await db.insert('teamcards', {
    name: patch.name, role: patch.role,
    bio: patch.bio || '', photo: patch.photo || '',
    active: patch.active !== false,
    order: ultimo + 1,
  });
  res.status(201).json(limpiar(row));
});

// PUT /api/equipo/:id — edición parcial (el orden se cambia con /mover, no a mano)
router.put('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('teamcards', req.params.id);
  if (!p) return res.status(404).json({ error: 'Esa persona no está en el equipo' });
  const { ok, error, patch } = leer(req.body, true);
  if (!ok) return res.status(422).json({ error });
  res.json(limpiar(await db.update('teamcards', p.id, patch)));
});

// POST /api/equipo/:id/mover — sube o baja a la persona intercambiándola con su vecina.
// El orden es del servidor: dos administradores no pueden dejarlo en estados distintos.
router.post('/:id/mover', requireAdmin, async (req, res) => {
  const dir = req.body.dir === 'sube' ? -1 : 1;
  const lista = ordenados(await db.all('teamcards'));
  const i = lista.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Esa persona no está en el equipo' });
  const j = i + dir;
  if (j < 0 || j >= lista.length) return res.status(409).json({ error: dir < 0 ? 'Ya está primero' : 'Ya está último' });
  const nueva = lista.slice();
  nueva[i] = lista[j];
  nueva[j] = lista[i];
  // Se reescriben las posiciones de toda la lista: queda 1..N sin huecos ni empates
  for (let k = 0; k < nueva.length; k++) await db.update('teamcards', nueva[k].id, { order: k + 1 });
  res.json({ rows: ordenados(await db.all('teamcards')) });
});

// DELETE /api/equipo/:id — baja definitiva (para sacarla del sitio sin perder el dato está Ocultar)
router.delete('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('teamcards', req.params.id);
  if (!p) return res.status(404).json({ error: 'Esa persona no está en el equipo' });
  await db.remove('teamcards', p.id);
  res.json({ ok: true });
});
` : `// La edición del equipo requiere el módulo de autenticación: activalo en el Builder para
// habilitar /equipo-admin.html. Sin él, se edita en data/teamcards.json (la sección lo lee igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'equipo-admin': {
      title: 'Equipo',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('users', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Equipo</h2>
      <p class="section-sub">Lo que cargues acá es lo que ve el visitante en la sección "Nuestro equipo", al instante y sin regenerar nada. Las tres personas sembradas son de ejemplo: reemplazalas por las reales antes de publicar. Solo visible para administradores.</p>

      <div class="card" style="margin-bottom:26px">
        <h3 id="eq-form-titulo">Agregar persona</h3>
        <form id="eq-form">
          <div class="grid cols-2">
            <div><label>Nombre y apellido</label><input name="name" required maxlength="60" placeholder="Ana Pérez"></div>
            <div><label>Rol</label><input name="role" required maxlength="60" placeholder="Dirección general"></div>
          </div>
          <label>Mini bio</label>
          <input name="bio" maxlength="240" placeholder="Lidera el rumbo del negocio con 15 años de oficio.">
          <label>Foto (opcional)</label>
          <input name="photo" maxlength="300" placeholder="${cfg.moduleIds.includes('uploads') ? '/uploads/ana.jpg o https://…' : 'https://… (o dejala vacía para el avatar de iniciales)'}">
          <span class="muted" style="font-size:.8rem">Sin foto se dibuja un avatar con las iniciales.${cfg.moduleIds.includes('uploads') ? ' Podés subir la imagen desde la biblioteca de archivos y pegar acá su URL.' : ''}</span>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="active" style="width:auto;margin:0" checked> Visible en el sitio</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="eq-guardar">Agregar al equipo</button>
            <button class="btn ghost" type="button" id="eq-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>

      <div id="eq-lista"><p class="muted">Cargando…</p></div>
      <p class="muted" style="font-size:.85rem;margin-top:14px">El orden de esta tabla es el orden en que se ven las tarjetas en el sitio.</p>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo equipo administrable: trae la gente de /api/equipo y reemplaza las tarjetas horneadas de
   la sección "Nuestro equipo", con foto o con el avatar de iniciales del diseño original.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel de edición vive en /equipo-admin.html.` : ''}
   Aparición escalonada con Anime.js + red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Íconos horneados: los botones de reordenar llevan flecha Phosphor, no el glifo ↑↓
  var SUBIR = ${JSON.stringify(phIcon('arrow-up', { size: 14 }))};
  var BAJAR = ${JSON.stringify(phIcon('arrow-down', { size: 14 }))};
  var iniciales = function (n) {
    return String(n).trim().split(/\\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
  };

  // ---- Sección pública: reemplaza las tarjetas horneadas por las del backend ----
  function pintarSeccion(rows) {
    var seccion = document.getElementById('equipo');
    if (!seccion || !rows || !rows.length) return;
    var grid = seccion.querySelector('.grid');
    if (!grid) return;
    grid.innerHTML = rows.map(function (p, i) {
      // Mismo degradado que hornea el HTML: el matiz avanza con la posición de la tarjeta
      var avatar = p.photo
        ? '<img src="' + App.esc(p.photo) + '" alt="' + App.esc(p.name) + '" loading="lazy" style="width:72px;height:72px;margin:0 auto 12px;border-radius:50%;object-fit:cover;display:block">'
        : '<div aria-hidden="true" style="width:72px;height:72px;margin:0 auto 12px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.3rem;color:#fff;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--primary) ' + (40 + (i % 3) * 20) + '%,var(--accent)))">' + App.esc(iniciales(p.name)) + '</div>';
      return '<div class="card" style="text-align:center">' + avatar +
        '<h3 style="margin:0 0 2px">' + App.esc(p.name) + '</h3>' +
        '<p style="margin:0 0 8px;color:var(--accent);font-size:.9rem;font-weight:600">' + App.esc(p.role) + '</p>' +
        (p.bio ? '<p class="muted" style="margin:0;font-size:.92rem">' + App.esc(p.bio) + '</p>' : '') +
        '</div>';
    }).join('');
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(grid.children, { opacity: [0, 1], translateY: [12, 0], duration: 460, delay: anime.stagger ? anime.stagger(70) : 0, ease: 'outCubic' });
      // Red de seguridad: con la pestaña oculta el loop de Anime no corre y las tarjetas
      // se quedarían en opacidad 0. Se fija el estado final igual.
      setTimeout(function () {
        Array.prototype.forEach.call(grid.children, function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
      }, 1000);
    }
  }

  var DEMO = [
    { id: '1', name: 'Ana Pérez', role: 'Dirección general', bio: 'Lidera el rumbo del negocio con 15 años de oficio.', photo: '', active: true, order: 1 },
    { id: '2', name: 'Bruno Díaz', role: 'Atención al cliente', bio: 'Tu primer contacto: rápido, claro y resolutivo.', photo: '', active: true, order: 2 },
    { id: '3', name: 'Carla Gómez', role: 'Operaciones', bio: 'Hace que todo salga a tiempo y como se prometió.', photo: '', active: true, order: 3 },
  ];

  if (document.getElementById('equipo')) {
    if (window.__PREVIEW__) pintarSeccion(DEMO);
    else fetch('/api/equipo').then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.rows) pintarSeccion(d.rows); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /equipo-admin.html ----
  var form = document.getElementById('eq-form');
  var box = document.getElementById('eq-lista');
  if (form && box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var editando = '';
    var CAMPOS = ['name', 'role', 'bio', 'photo'];

    function salirDeEdicion() {
      editando = '';
      form.reset();
      form.querySelector('[name="active"]').checked = true;
      document.getElementById('eq-form-titulo').textContent = 'Agregar persona';
      document.getElementById('eq-guardar').textContent = 'Agregar al equipo';
      document.getElementById('eq-cancelar').hidden = true;
    }

    function editar(p) {
      editando = p.id;
      CAMPOS.forEach(function (k) { form.querySelector('[name="' + k + '"]').value = p[k] || ''; });
      form.querySelector('[name="active"]').checked = p.active !== false;
      document.getElementById('eq-form-titulo').textContent = 'Editando: ' + p.name;
      document.getElementById('eq-guardar').textContent = 'Guardar cambios';
      document.getElementById('eq-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function pintar() {
      box.innerHTML = App.table(lista, [
        { label: 'Persona', render: function (p) {
          var foto = p.photo
            ? '<img class="eq-mini" src="' + App.esc(p.photo) + '" alt="" loading="lazy"> '
            : '';
          return foto + '<strong>' + App.esc(p.name) + '</strong>' +
            '<br><span class="muted" style="font-size:.82rem">' + App.esc(p.role) + '</span>' +
            (p.bio ? '<br><span class="eq-bio">' + App.esc(p.bio) + '</span>' : '');
        } },
        { label: 'Estado', render: function (p) { return p.active ? '<span class="eq-chip on">Visible</span>' : '<span class="eq-chip off">Oculta</span>'; } },
        { label: '', render: function (p) {
          return '<span class="eq-acciones">' +
            '<button class="btn ghost" type="button" aria-label="Subir" title="Subir" data-eq-sube="' + p.id + '">' + SUBIR + '</button>' +
            '<button class="btn ghost" type="button" aria-label="Bajar" title="Bajar" data-eq-baja="' + p.id + '">' + BAJAR + '</button>' +
            '<button class="btn ghost" type="button" data-eq-edit="' + p.id + '">Editar</button>' +
            '<button class="btn ghost" type="button" data-eq-ver="' + p.id + '">' + (p.active ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn ghost" type="button" data-eq-del="' + p.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-eq-edit]').forEach(function (b) {
        b.addEventListener('click', function () { var p = buscar(b.getAttribute('data-eq-edit')); if (p) editar(p); });
      });
      box.querySelectorAll('[data-eq-sube]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-eq-sube'), 'sube'); });
      });
      box.querySelectorAll('[data-eq-baja]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-eq-baja'), 'baja'); });
      });
      box.querySelectorAll('[data-eq-ver]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var p = buscar(b.getAttribute('data-eq-ver'));
          if (!p) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
          try {
            await App.api('/api/equipo/' + p.id, { method: 'PUT', body: { active: !p.active } });
            App.toast(p.active ? 'Persona oculta' : 'Persona visible');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-eq-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar a esta persona del equipo? Si sólo querés sacarla del sitio, usá "Ocultar".')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/equipo/' + b.getAttribute('data-eq-del'), { method: 'DELETE' });
            App.toast('Persona borrada');
            if (editando === b.getAttribute('data-eq-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reordenaría'); return; }
      try {
        var out = await App.api('/api/equipo/' + id + '/mover', { method: 'POST', body: { dir: dir } });
        lista = out.rows;
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function cargar() {
      if (window.__PREVIEW__) { lista = DEMO.slice(); pintar(); return; }
      try {
        var out = await App.api('/api/equipo/todos');
        lista = out.rows;
        pintar();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {};
      CAMPOS.forEach(function (k) { datos[k] = form.querySelector('[name="' + k + '"]').value; });
      datos.active = form.querySelector('[name="active"]').checked;
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la persona'); return; }
      try {
        if (editando) await App.api('/api/equipo/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/equipo', { method: 'POST', body: datos });
        App.toast(editando ? 'Datos actualizados' : 'Persona agregada');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var cancelar = document.getElementById('eq-cancelar');
    if (cancelar) cancelar.addEventListener('click', salirDeEdicion);

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
    var navE = document.getElementById('nav-equipo-admin');
    if (navE && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navE.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Equipo administrable**: las personas viven en la colección \`teamcards\` y se inyectan en vivo sobre la sección "Nuestro equipo", así que **un alta o una baja no requieren regenerar ni volver a deployar**. Se siembran **tres personas de ejemplo con nombres inventados** (Ana Pérez, Bruno Díaz, Carla Gómez): reemplazalas por las reales ${cfg.moduleIds.includes('auth') ? 'desde `/equipo-admin.html`' : 'editando `data/teamcards.json` (o activá el módulo **Autenticación** para editarlas desde la web en `/equipo-admin.html`)'} **antes de publicar el sitio**. La foto es una URL (${cfg.moduleIds.includes('uploads') ? 'podés subirla desde la biblioteca de archivos y pegar acá su URL' : 'de tu servidor o externa'}); sin foto se dibuja el avatar de iniciales. El **orden lo decide el servidor** (botones de subir y bajar del panel).`,
  ],
};
