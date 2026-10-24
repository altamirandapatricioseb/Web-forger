// Feed social con backend real: el módulo UI "socialfeed" publicaba ocho casilleros vacíos con
// cantidades de "me gusta" INVENTADAS (128, 342, 96, 511…) y un botón "Seguinos @tu_negocio" que
// apuntaba a una cuenta de Instagram que no existe. Es el mismo problema que la 37ª le encontró a
// logos y press: prueba social falsa que, como no se ve rota, sale a producción tal cual.
// Acá las publicaciones viven en la colección socialposts (imagen real, epígrafe y enlace al post)
// y el usuario y la URL del perfil en socialcfg. La decisión de fondo: el overlay muestra EL
// EPÍGRAFE, no un número de "me gusta". El campo de likes existe pero arranca vacío y sólo se
// muestra si el negocio lo carga — un número que se escribe a mano no es una métrica, y ponerlo
// por default es enseñarle al sitio a mentir.
// Sin API de Instagram (que exige token y app aprobada, o sea deja de ser deployable gratis): las
// fotos se suben desde el sitio y se enlazan al post real. Sin imagen cargada, el casillero
// conserva el degradado del diseño original, así nunca se ve roto.
// Panel solo-admin /publicaciones-admin.html, animado con Anime.js.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'publicaciones', type: 'functional', name: 'Feed social administrable',
  description: 'Le da backend real a la sección "Seguinos en redes": las publicaciones viven en la colección socialposts (imagen, epígrafe y enlace al post real) y el usuario y la URL del perfil en socialcfg, así el sitio deja de publicar ocho casilleros vacíos con "me gusta" inventados y un enlace a una cuenta que no existe. El overlay muestra el epígrafe; el contador de "me gusta" es opcional y arranca vacío, porque un número escrito a mano no es una métrica. Sin imagen cargada el casillero conserva el degradado del diseño original. ABM con reordenar y ocultar en /publicaciones-admin.html. Animado con Anime.js.',
  usesAnime: true,
  requires: ['socialfeed'],
  mounts: [{ route: '/api/publicaciones', file: 'routes/publicaciones.js' }],
  collections: ['socialposts', 'socialcfg'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Publicaciones', href: '/publicaciones-admin.html', id: 'nav-publicaciones-admin' }] : [],
  head: () => `  <style>
    .social-tile img{width:100%;height:100%;object-fit:cover;border-radius:inherit}
    .social-hover{padding:10px;text-align:center;font-size:.85rem;line-height:1.35}
    .pub-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .pub-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .pub-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .pub-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .pub-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .pub-mini{width:52px;height:52px;border-radius:var(--radius);object-fit:cover;vertical-align:middle}
    .pub-texto{font-size:.85rem;color:var(--muted);max-width:40ch}
  </style>`,
  files: (cfg) => ({
    'routes/publicaciones.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Usuario y perfil sembrados IGUALES a los del HTML horneado para que la primera carga no
// parpadee. Son DATOS INVENTADOS: 'tu_negocio' no es una cuenta real y hay que reemplazarla
// antes de publicar el sitio, o el botón principal de la sección lleva a ninguna parte.
db.seedIfEmpty('socialcfg', [{
  titulo: 'Seguinos en redes',
  intro: 'Mirá lo último que compartimos en nuestro perfil.',
  usuario: 'tu_negocio',
  perfil: 'https://instagram.com/tu_negocio',
}]);

// La colección de publicaciones NO se siembra: ocho casilleros vacíos con "me gusta" inventados
// son exactamente lo que este módulo viene a sacar. Sin publicaciones cargadas la sección se
// oculta sola, que es la única versión honesta de "todavía no publicamos nada".

// Una imagen válida es una ruta del propio sitio (la que devuelve el módulo de archivos) o una
// URL http(s). Cualquier otra cosa (javascript:, data:) se rechaza: esto va al src de un <img>.
const MEDIA = /^(\\/[\\w\\-./%]*|https?:\\/\\/[^\\s"'<>]+)$/;

const limpiar = (p) => ({
  id: p.id,
  imagen: p.imagen || '',
  texto: p.texto || '',
  enlace: p.enlace || '',
  likes: Math.max(0, Number(p.likes) || 0),
  visible: p.visible !== false,
  order: Number(p.order) || 0,
});

const ordenados = (rows) => rows.map(limpiar).sort((a, b) => (a.order - b.order) || String(a.id).localeCompare(String(b.id)));

async function config() {
  const rows = await db.all('socialcfg');
  const c = rows[0] || {};
  return {
    id: c.id,
    titulo: c.titulo || 'Seguinos en redes',
    intro: c.intro || '',
    usuario: c.usuario || '',
    perfil: c.perfil || '',
  };
}

function leer(body, parcial) {
  const patch = {};
  if (body.imagen !== undefined || !parcial) {
    const v = String(body.imagen || '').trim();
    if (v && !MEDIA.test(v)) return { ok: false, error: 'La imagen tiene que ser una ruta del sitio (/uploads/…) o una URL http(s)' };
    patch.imagen = v;
  }
  if (body.texto !== undefined) patch.texto = String(body.texto).trim().slice(0, 160);
  if (body.enlace !== undefined) {
    const v = String(body.enlace).trim();
    if (v && !MEDIA.test(v)) return { ok: false, error: 'El enlace tiene que ser una ruta del sitio o una URL http(s)' };
    patch.enlace = v;
  }
  if (body.likes !== undefined) {
    const n = Number(body.likes);
    if (!isFinite(n) || n < 0 || n > 100000000) return { ok: false, error: 'Los "me gusta" tienen que ser un número (o 0 para no mostrarlos)' };
    patch.likes = Math.floor(n);
  }
  if (body.visible !== undefined) patch.visible = !(body.visible === false || body.visible === 'false');
  return { ok: true, patch };
}

// GET /api/publicaciones — público: sólo las visibles, en el orden que fijó el negocio
router.get('/', async (req, res) => {
  const c = await config();
  const rows = ordenados(await db.all('socialposts')).filter(p => p.visible)
    .slice(0, 12)
    .map(({ id, imagen, texto, enlace, likes }) => ({ id, imagen, texto, enlace, likes }));
  res.json({ rows, titulo: c.titulo, intro: c.intro, usuario: c.usuario, perfil: c.perfil });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/publicaciones/todas — el panel ve también las ocultas
router.get('/todas', requireAdmin, async (req, res) => {
  res.json({ rows: ordenados(await db.all('socialposts')), config: await config() });
});

// PUT /api/publicaciones/config — usuario, perfil y textos de la sección
router.put('/config', requireAdmin, async (req, res) => {
  const c = await config();
  const b = req.body || {};
  const patch = {};
  if (b.titulo !== undefined) {
    if (!str(b.titulo, 2, 90)) return res.status(422).json({ error: 'El título tiene que tener entre 2 y 90 caracteres' });
    patch.titulo = String(b.titulo).trim();
  }
  if (b.intro !== undefined) patch.intro = String(b.intro).trim().slice(0, 300);
  if (b.usuario !== undefined) patch.usuario = String(b.usuario).trim().replace(/^@/, '').slice(0, 60);
  if (b.perfil !== undefined) {
    const v = String(b.perfil).trim();
    if (v && !/^https?:\\/\\/[^\\s"'<>]+$/.test(v)) return res.status(422).json({ error: 'El perfil tiene que ser una URL http(s) completa' });
    patch.perfil = v;
  }
  if (c.id) await db.update('socialcfg', c.id, patch);
  else await db.insert('socialcfg', patch);
  res.json(await config());
});

// POST /api/publicaciones — alta. El orden lo decide el servidor: al final de la grilla
router.post('/', requireAdmin, async (req, res) => {
  const { ok, error, patch } = leer(req.body, false);
  if (!ok) return res.status(422).json({ error });
  const todas = await db.all('socialposts');
  const ultimo = todas.reduce((m, p) => Math.max(m, Number(p.order) || 0), 0);
  const row = await db.insert('socialposts', {
    imagen: patch.imagen || '', texto: patch.texto || '',
    enlace: patch.enlace || '', likes: patch.likes || 0,
    visible: patch.visible !== false,
    order: ultimo + 1,
  });
  res.status(201).json(limpiar(row));
});

// PUT /api/publicaciones/:id — edición parcial (el orden se cambia con /mover, no a mano)
router.put('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('socialposts', req.params.id);
  if (!p) return res.status(404).json({ error: 'Esa publicación no existe' });
  const { ok, error, patch } = leer(req.body, true);
  if (!ok) return res.status(422).json({ error });
  res.json(limpiar(await db.update('socialposts', p.id, patch)));
});

// POST /api/publicaciones/:id/mover — intercambia la publicación con su vecina. El orden es del
// servidor: dos administradores no pueden dejar la grilla en dos estados distintos.
router.post('/:id/mover', requireAdmin, async (req, res) => {
  const dir = req.body.dir === 'sube' ? -1 : 1;
  const lista = ordenados(await db.all('socialposts'));
  const i = lista.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Esa publicación no existe' });
  const j = i + dir;
  if (j < 0 || j >= lista.length) return res.status(409).json({ error: dir < 0 ? 'Ya está primera' : 'Ya está última' });
  const nueva = lista.slice();
  nueva[i] = lista[j];
  nueva[j] = lista[i];
  // Se reescriben las posiciones de toda la lista: queda 1..N sin huecos ni empates
  for (let k = 0; k < nueva.length; k++) await db.update('socialposts', nueva[k].id, { order: k + 1 });
  res.json({ rows: ordenados(await db.all('socialposts')) });
});

// DELETE /api/publicaciones/:id — baja definitiva (para sacarla del sitio está Ocultar)
router.delete('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('socialposts', req.params.id);
  if (!p) return res.status(404).json({ error: 'Esa publicación no existe' });
  await db.remove('socialposts', p.id);
  res.json({ ok: true });
});
` : `// La carga de publicaciones requiere el módulo de autenticación: activalo en el Builder para
// habilitar /publicaciones-admin.html. Sin él, se editan en data/socialposts.json (la sección
// las lee igual) y la sección permanece oculta mientras no haya ninguna.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'publicaciones-admin': {
      title: 'Publicaciones',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('heart', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Feed social</h2>
      <p class="section-sub">Las publicaciones que se ven en "Seguinos en redes". Mientras no cargues ninguna, la sección no se muestra: es preferible a una grilla de casilleros vacíos. Solo visible para administradores.</p>

      <div class="card" style="margin-bottom:26px">
        <h3>Perfil y textos</h3>
        <form id="pub-cfg">
          <div class="grid cols-2">
            <div><label>Título de la sección</label><input name="titulo" required maxlength="90" placeholder="Seguinos en redes"></div>
            <div><label>Usuario (sin @)</label><input name="usuario" maxlength="60" placeholder="minegocio"></div>
          </div>
          <label>Bajada</label>
          <input name="intro" maxlength="300" placeholder="Mirá lo último que compartimos en nuestro perfil.">
          <label>URL del perfil</label>
          <input name="perfil" maxlength="300" placeholder="https://instagram.com/minegocio">
          <span class="muted" style="font-size:.8rem">Es adonde lleva el botón principal de la sección. Si queda vacío, el botón no se muestra: mejor eso que mandar a una cuenta que no existe.</span>
          <div style="margin-top:16px"><button class="btn" type="submit">Guardar</button></div>
        </form>
      </div>

      <div class="card" style="margin-bottom:26px">
        <h3 id="pub-form-titulo">Agregar publicación</h3>
        <form id="pub-form">
          <label>Imagen</label>
          <input name="imagen" maxlength="300" placeholder="${cfg.moduleIds.includes('uploads') ? '/uploads/foto.jpg o https://…' : 'https://…'}">
          <span class="muted" style="font-size:.8rem">${cfg.moduleIds.includes('uploads') ? 'Subí la foto desde la biblioteca de archivos y pegá acá su URL.' : 'Sin imagen, el casillero muestra el degradado del diseño.'}</span>
          <label>Epígrafe</label>
          <input name="texto" maxlength="160" placeholder="Lo que mostramos al pasar el mouse">
          <div class="grid cols-2">
            <div><label>Enlace a la publicación</label><input name="enlace" maxlength="300" placeholder="https://instagram.com/p/…"></div>
            <div><label>"Me gusta" (opcional)</label><input name="likes" type="number" min="0" step="1" value="0"></div>
          </div>
          <span class="muted" style="font-size:.8rem">Dejá los "me gusta" en 0 para no mostrarlos. Poné el número real de tu publicación o ninguno: un número inventado es prueba social falsa.</span>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="visible" style="width:auto;margin:0" checked> Visible en el sitio</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="pub-guardar">Agregar publicación</button>
            <button class="btn ghost" type="button" id="pub-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>

      <div id="pub-lista"><p class="muted">Cargando…</p></div>
      <p class="muted" style="font-size:.85rem;margin-top:14px">El orden de esta tabla es el orden de la grilla en el sitio. Se muestran hasta 12.</p>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo publicaciones: trae el feed de /api/publicaciones y reemplaza los casilleros
   horneados. Sin publicaciones cargadas oculta la sección entera en vez de dejar ocho recuadros
   vacíos con "me gusta" que nadie dio.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el ABM vive en /publicaciones-admin.html.` : ''}
   Aparición escalonada con Anime.js + red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CORAZON = ${JSON.stringify(phIcon('heart-fill', { size: 14 }))};

  // ---- Sección pública ----
  function pintarSeccion(d) {
    var seccion = document.getElementById('feed-social');
    if (!seccion) return;
    var grid = document.getElementById('social-grid');
    var boton = document.getElementById('social-seguir');
    var rows = (d && d.rows) || [];
    if (!rows.length) {
      seccion.hidden = true;
      seccion.style.display = 'none';
      return;
    }
    seccion.hidden = false;
    seccion.style.display = '';

    var h2 = seccion.querySelector('h2');
    var sub = seccion.querySelector('.section-sub');
    if (h2 && d.titulo) h2.textContent = d.titulo;
    if (sub && d.intro) sub.textContent = d.intro;
    if (boton) {
      if (d.perfil) {
        boton.href = d.perfil;
        boton.textContent = d.usuario ? 'Seguinos @' + d.usuario : 'Seguinos';
        boton.parentNode.style.display = '';
      } else {
        // Sin perfil cargado el botón desaparece: mandar a una cuenta inexistente es peor que
        // no tener botón.
        boton.parentNode.style.display = 'none';
      }
    }

    if (!grid) return;
    grid.innerHTML = rows.map(function (p, i) {
      var destino = p.enlace || d.perfil || '';
      var etiqueta = p.texto || ('Publicación ' + (i + 1));
      var fondo = p.imagen
        ? '<img src="' + App.esc(p.imagen) + '" alt="' + App.esc(etiqueta) + '" loading="lazy">'
        : '<span class="social-ph muted">' + App.esc(etiqueta) + '</span>';
      // El overlay muestra el epígrafe. Los "me gusta" sólo aparecen si el negocio cargó el
      // número real: por default no hay ninguno, que es la diferencia con la versión horneada.
      // Sin imagen el epígrafe ya está escrito en el casillero, así que repetirlo en el overlay
      // sería mostrar el mismo texto dos veces: ahí el overlay dice qué pasa si hacés clic.
      var overlay = (p.likes ? CORAZON + ' ' + p.likes.toLocaleString('es-AR') + (p.imagen ? ' · ' : '') : '') +
        (p.imagen ? App.esc(etiqueta) : (p.likes ? '' : 'Ver publicación'));
      var attrs = destino
        ? 'href="' + App.esc(destino) + '" target="_blank" rel="noopener"'
        : 'href="#" aria-disabled="true"';
      return '<a class="social-tile" ' + attrs + ' aria-label="' + App.esc(etiqueta) + '">' +
        fondo + '<span class="social-hover">' + overlay + '</span></a>';
    }).join('');

    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(grid.children, { opacity: [0, 1], scale: [0.92, 1], duration: 480, delay: anime.stagger ? anime.stagger(55) : 0, ease: 'outQuad' });
      // Red de seguridad: con la pestaña oculta el loop de Anime no corre y los casilleros
      // se quedarían invisibles. Se fija el estado final igual.
      setTimeout(function () {
        Array.prototype.forEach.call(grid.children, function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
      }, 1200);
    }
  }

  var DEMO = { titulo: 'Seguinos en redes', intro: 'Mirá lo último que compartimos.', usuario: 'minegocio', perfil: 'https://instagram.com/minegocio',
    rows: [{ id: '1', imagen: '', texto: 'Detrás de escena', enlace: '', likes: 0 }, { id: '2', imagen: '', texto: 'Lo nuevo de la semana', enlace: '', likes: 0 }] };

  if (document.getElementById('feed-social')) {
    if (window.__PREVIEW__) pintarSeccion(DEMO);
    else fetch('/api/publicaciones').then(function (r) { return r.json(); })
      .then(function (d) { if (d) pintarSeccion(d); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /publicaciones-admin.html ----
  var form = document.getElementById('pub-form');
  var box = document.getElementById('pub-lista');
  var formCfg = document.getElementById('pub-cfg');
  if (form && box && formCfg) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var SUBIR = ${JSON.stringify(phIcon('arrow-up', { size: 14 }))};
    var BAJAR = ${JSON.stringify(phIcon('arrow-down', { size: 14 }))};
    var lista = [];
    var editando = '';
    var CAMPOS = ['imagen', 'texto', 'enlace'];
    var CAMPOS_CFG = ['titulo', 'intro', 'usuario', 'perfil'];

    function salirDeEdicion() {
      editando = '';
      form.reset();
      form.querySelector('[name="visible"]').checked = true;
      form.querySelector('[name="likes"]').value = 0;
      document.getElementById('pub-form-titulo').textContent = 'Agregar publicación';
      document.getElementById('pub-guardar').textContent = 'Agregar publicación';
      document.getElementById('pub-cancelar').hidden = true;
    }

    function editar(p) {
      editando = p.id;
      CAMPOS.forEach(function (k) { form.querySelector('[name="' + k + '"]').value = p[k] || ''; });
      form.querySelector('[name="likes"]').value = Number(p.likes) || 0;
      form.querySelector('[name="visible"]').checked = p.visible !== false;
      document.getElementById('pub-form-titulo').textContent = 'Editando publicación';
      document.getElementById('pub-guardar').textContent = 'Guardar cambios';
      document.getElementById('pub-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function pintar() {
      box.innerHTML = App.table(lista, [
        { label: 'Publicación', render: function (p) {
          var mini = p.imagen ? '<img class="pub-mini" src="' + App.esc(p.imagen) + '" alt="" loading="lazy"> ' : '';
          return mini + (p.texto ? '<span class="pub-texto">' + App.esc(p.texto) + '</span>' : '<span class="muted">Sin epígrafe</span>') +
            (p.likes ? '<br><span class="muted" style="font-size:.82rem">' + p.likes + ' me gusta</span>' : '');
        } },
        { label: 'Estado', render: function (p) { return p.visible ? '<span class="pub-chip on">Visible</span>' : '<span class="pub-chip off">Oculta</span>'; } },
        { label: '', render: function (p) {
          return '<span class="pub-acciones">' +
            '<button class="btn ghost" type="button" aria-label="Subir" title="Subir" data-pub-sube="' + p.id + '">' + SUBIR + '</button>' +
            '<button class="btn ghost" type="button" aria-label="Bajar" title="Bajar" data-pub-baja="' + p.id + '">' + BAJAR + '</button>' +
            '<button class="btn ghost" type="button" data-pub-edit="' + p.id + '">Editar</button>' +
            '<button class="btn ghost" type="button" data-pub-ver="' + p.id + '">' + (p.visible ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn ghost" type="button" data-pub-del="' + p.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-pub-edit]').forEach(function (b) {
        b.addEventListener('click', function () { var p = buscar(b.getAttribute('data-pub-edit')); if (p) editar(p); });
      });
      box.querySelectorAll('[data-pub-sube]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-pub-sube'), 'sube'); });
      });
      box.querySelectorAll('[data-pub-baja]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-pub-baja'), 'baja'); });
      });
      box.querySelectorAll('[data-pub-ver]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var p = buscar(b.getAttribute('data-pub-ver'));
          if (!p) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
          try {
            await App.api('/api/publicaciones/' + p.id, { method: 'PUT', body: { visible: !p.visible } });
            App.toast(p.visible ? 'Publicación oculta' : 'Publicación visible');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-pub-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar esta publicación? Si sólo querés sacarla del sitio, usá "Ocultar".')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/publicaciones/' + b.getAttribute('data-pub-del'), { method: 'DELETE' });
            App.toast('Publicación borrada');
            if (editando === b.getAttribute('data-pub-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reordenaría'); return; }
      try {
        var out = await App.api('/api/publicaciones/' + id + '/mover', { method: 'POST', body: { dir: dir } });
        lista = out.rows;
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function cargar() {
      if (window.__PREVIEW__) {
        lista = [{ id: '1', imagen: '', texto: 'Detrás de escena', enlace: '', likes: 0, visible: true, order: 1 }];
        CAMPOS_CFG.forEach(function (k) { formCfg.querySelector('[name="' + k + '"]').value = DEMO[k] || ''; });
        pintar();
        return;
      }
      try {
        var out = await App.api('/api/publicaciones/todas');
        lista = out.rows;
        CAMPOS_CFG.forEach(function (k) { formCfg.querySelector('[name="' + k + '"]').value = out.config[k] || ''; });
        pintar();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    formCfg.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {};
      CAMPOS_CFG.forEach(function (k) { datos[k] = formCfg.querySelector('[name="' + k + '"]').value; });
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el perfil'); return; }
      try {
        await App.api('/api/publicaciones/config', { method: 'PUT', body: datos });
        App.toast('Perfil actualizado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {};
      CAMPOS.forEach(function (k) { datos[k] = form.querySelector('[name="' + k + '"]').value; });
      datos.likes = Number(form.querySelector('[name="likes"]').value) || 0;
      datos.visible = form.querySelector('[name="visible"]').checked;
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la publicación'); return; }
      try {
        if (editando) await App.api('/api/publicaciones/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/publicaciones', { method: 'POST', body: datos });
        App.toast(editando ? 'Publicación actualizada' : 'Publicación agregada');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var cancelar = document.getElementById('pub-cancelar');
    if (cancelar) cancelar.addEventListener('click', salirDeEdicion);

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
    var navE = document.getElementById('nav-publicaciones-admin');
    if (navE && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navE.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Feed social administrable**: las publicaciones viven en la colección \`socialposts\` y el usuario y la URL del perfil en \`socialcfg\`. La sección **no se muestra hasta que cargues la primera publicación**: los ocho casilleros vacíos con "me gusta" inventados que traía el HTML eran prueba social falsa. El usuario sembrado es **\`tu_negocio\`, que no existe**: cambialo ${cfg.moduleIds.includes('auth') ? 'en `/publicaciones-admin.html`' : 'en `data/socialcfg.json` (o activá **Autenticación** para el panel web)'} **antes de publicar el sitio**, o el botón principal de la sección lleva a ninguna parte. El overlay muestra el **epígrafe**; el contador de "me gusta" es opcional y arranca en 0 (no se muestra): cargá el número real de tu publicación o ninguno. No usa la API de Instagram, que exige token y app aprobada${cfg.moduleIds.includes('uploads') ? '; subí las fotos desde la biblioteca de archivos y pegá su URL' : ''}.`,
  ],
};
