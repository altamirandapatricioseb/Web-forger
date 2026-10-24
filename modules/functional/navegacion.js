// Menú de navegación administrable con backend real. El menú del sitio se arma AL GENERAR: cada
// módulo activo aporta sus links y el orden es el orden en que se cargaron los módulos. Funciona,
// pero es lo primero que un cliente quiere tocar y lo único que no podía: "sacá 'Reseñas' del
// menú", "poné 'Turnos' primero", "en vez de 'Catálogo' que diga 'Tienda'", "agregame un link a
// nuestro Instagram". Cada uno de esos pedidos obligaba a regenerar el proyecto y volver a
// deployar por un cambio de una palabra.
//
// Acá el menú vive en la colección navlinks, sembrada AL GENERAR con los links reales del proyecto
// (el generador se los pasa al módulo en ctx.nav), así el panel arranca con el menú de verdad y no
// pidiendo que se carguen las direcciones a mano.
//
// La decisión de implementación que importa: el cliente NO reconstruye el HTML del menú, MUEVE los
// enlaces que ya existen. Reescribir el innerHTML de .nav-links parece más simple y rompe tres
// cosas silenciosamente: el contador del carrito (que otro módulo enganchó a un nodo concreto), el
// display:none con que varios módulos esconden sus links de administración a quien no es admin, y
// la clase "active" de la página en curso. Moviendo los nodos originales con appendChild, todo eso
// sobrevive porque son los mismos elementos.
//
// Expone window.WFNav.aplicar() para los módulos que agregan links después de cargar la página
// (el de páginas administrables lo llama al insertar las suyas), y suma links propios a destinos
// externos —redes, WhatsApp, un formulario de Google— validados contra javascript: y data:.
// Panel /menu-admin.html, animado con Anime.js + red de seguridad.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'navegacion', type: 'functional', name: 'Menú de navegación administrable',
  description: 'El menú del sitio se ordena, se renombra, se esconde y se amplía desde /menu-admin.html sin regenerar ni volver a deployar: "sacá Reseñas", "poné Turnos primero", "que Catálogo diga Tienda", "agregá un link a Instagram". Se siembra al generar con los links reales del proyecto, así el panel arranca con el menú de verdad. El cliente mueve los enlaces que ya existen en vez de reconstruir el menú, para no romper el contador del carrito, la marca de página activa ni los links de administración que otros módulos esconden. Expone window.WFNav.aplicar() para los módulos que agregan links después de cargar. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/navegacion', file: 'routes/navegacion.js' }],
  collections: ['navlinks'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Menú', href: '/menu-admin.html', id: 'nav-navegacion' }] : [],
  head: () => `  <style>
    .nv-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .nv-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .nv-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .nv-acc{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .nv-acc .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .nv-href{font-family:ui-monospace,'Cascadia Code','Courier New',monospace;font-size:.8rem;color:var(--muted);word-break:break-all}
    .nv-previa{display:flex;flex-wrap:wrap;gap:8px;padding:14px 16px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);margin:8px 0 26px}
    .nv-previa span{font-size:.9rem;padding:4px 10px;border-radius:999px;background:var(--bg);border:1px solid var(--line)}
    .nv-previa span.nv-nuevo{border-color:var(--accent);color:var(--accent)}
  </style>`,
  files: (cfg, ctx = { pages: [], nav: [] }) => {
    // El menú real del proyecto, conocido al generar: se siembra tal cual para que el panel abra
    // con lo que el visitante ve hoy. Los links de administración arrancan marcados como tales:
    // son los que cada módulo esconde a quien no es admin, y reordenarlos no cambia eso.
    const semilla = (ctx.nav || []).map((l, i) => ({
      href: l.href,
      label: l.label,
      original: l.label,
      order: i + 1,
      visible: true,
      custom: false,
      admin: /-admin\.html$/.test(l.href) || l.href === '/auth.html',
    }));
    return {
      'routes/navegacion.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Un destino válido es una página del sitio, una URL http(s), un ancla, un mailto o un tel.
// Nunca javascript: ni data:, que es como un panel de menú se convierte en un XSS almacenado.
const DESTINO = /^(https?:\\/\\/[^\\s"']+|\\/[\\w\\-./#?=&%+]*|#[\\w-]+|mailto:[^\\s"']+|tel:[+\\d\\s()-]+)$/;

// Menú real del proyecto, horneado al generar (el generador lo pasa en ctx.nav)
db.seedIfEmpty('navlinks', ${JSON.stringify(semilla, null, 2)});

const salida = (l) => ({
  id: l.id, href: l.href, label: l.label,
  original: l.original || '', order: Number(l.order) || 0,
  visible: l.visible !== false, custom: !!l.custom, admin: !!l.admin,
  externo: /^https?:\\/\\//.test(String(l.href || '')),
});

const ordenados = (rows) => rows.map(salida).sort((a, b) => (a.order - b.order) || a.href.localeCompare(b.href));

// GET /api/navegacion — público: el menú vigente. Los links de administración viajan igual
// (cada módulo decide si los muestra según quién mira), pero marcados.
router.get('/', async (req, res) => {
  const rows = ordenados(await db.all('navlinks'));
  res.json({ rows: rows.map(({ original, ...l }) => l) });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/navegacion/todos — el panel ve también lo oculto y el nombre original de cada link
router.get('/todos', requireAdmin, async (req, res) => {
  res.json({ rows: ordenados(await db.all('navlinks')) });
});

// POST /api/navegacion — link propio (redes, WhatsApp, un formulario externo)
router.post('/', requireAdmin, async (req, res) => {
  const body = req.body || {};
  if (!str(body.label, 1, 40)) return res.status(422).json({ error: 'El nombre va entre 1 y 40 caracteres' });
  const href = String(body.href || '').trim();
  if (!DESTINO.test(href) || href.length > 400) {
    return res.status(422).json({ error: 'El destino tiene que ser una página del sitio (/contacto.html), una URL http(s), un ancla (#seccion), un mailto: o un tel:' });
  }
  const repetido = (await db.all('navlinks')).some(l => String(l.href) === href);
  if (repetido) return res.status(409).json({ error: 'Ese destino ya está en el menú' });
  const ultimo = (await db.all('navlinks')).reduce((m, l) => Math.max(m, Number(l.order) || 0), 0);
  const row = await db.insert('navlinks', {
    href, label: String(body.label).trim(), original: '',
    order: ultimo + 1, visible: true, custom: true, admin: false,
  });
  res.status(201).json(salida(row));
});

// PUT /api/navegacion/:id — renombrar o mostrar/ocultar. El destino de un link del sitio NO se
// cambia acá: lo genera un módulo y apuntarlo a otro lado dejaría una página huérfana.
router.put('/:id', requireAdmin, async (req, res) => {
  const l = await db.get('navlinks', req.params.id);
  if (!l) return res.status(404).json({ error: 'Ese link no existe' });
  const body = req.body || {};
  const patch = {};
  if (body.label !== undefined) {
    if (!str(body.label, 1, 40)) return res.status(422).json({ error: 'El nombre va entre 1 y 40 caracteres' });
    patch.label = String(body.label).trim();
  }
  if (body.href !== undefined) {
    if (!l.custom) return res.status(409).json({ error: 'El destino de un link del sitio lo define su módulo: podés renombrarlo u ocultarlo, no redirigirlo' });
    const href = String(body.href).trim();
    if (!DESTINO.test(href) || href.length > 400) return res.status(422).json({ error: 'Destino inválido' });
    const repetido = (await db.all('navlinks')).some(x => String(x.href) === href && x.id !== l.id);
    if (repetido) return res.status(409).json({ error: 'Ese destino ya está en el menú' });
    patch.href = href;
  }
  if (body.visible !== undefined) patch.visible = !(body.visible === false || body.visible === 'false');
  res.json(salida(await db.update('navlinks', l.id, patch)));
});

// POST /api/navegacion/:id/mover — sube o baja una posición
router.post('/:id/mover', requireAdmin, async (req, res) => {
  const dir = req.body && req.body.dir === 'sube' ? -1 : 1;
  const l = await db.get('navlinks', req.params.id);
  if (!l) return res.status(404).json({ error: 'Ese link no existe' });
  const lista = ordenados(await db.all('navlinks'));
  const i = lista.findIndex(x => x.id === l.id);
  const j = i + dir;
  if (j < 0 || j >= lista.length) return res.status(409).json({ error: dir < 0 ? 'Ya es el primero' : 'Ya es el último' });
  const nueva = lista.slice();
  nueva[i] = lista[j];
  nueva[j] = lista[i];
  // Se reescriben todas las posiciones: queda 1..N sin huecos ni empates
  for (let k = 0; k < nueva.length; k++) await db.update('navlinks', nueva[k].id, { order: k + 1 });
  res.json({ rows: ordenados(await db.all('navlinks')) });
});

// POST /api/navegacion/:id/restaurar — vuelve al nombre original que puso el módulo
router.post('/:id/restaurar', requireAdmin, async (req, res) => {
  const l = await db.get('navlinks', req.params.id);
  if (!l) return res.status(404).json({ error: 'Ese link no existe' });
  if (l.custom) return res.status(409).json({ error: 'Ese link lo creaste vos: no tiene nombre original' });
  res.json(salida(await db.update('navlinks', l.id, { label: l.original || l.label, visible: true })));
});

// DELETE /api/navegacion/:id — sólo los links propios. Los del sitio se ocultan, no se borran:
// borrarlos dejaría la página accesible pero sin forma de volver a ponerla en el menú.
router.delete('/:id', requireAdmin, async (req, res) => {
  const l = await db.get('navlinks', req.params.id);
  if (!l) return res.status(404).json({ error: 'Ese link no existe' });
  if (!l.custom) return res.status(409).json({ error: 'Ese link lo aporta un módulo del sitio: ocultalo en vez de borrarlo' });
  await db.remove('navlinks', l.id);
  res.json({ ok: true });
});
` : `// La edición requiere el módulo de autenticación: activalo en el Builder para habilitar
// /menu-admin.html. Sin él el menú se edita en data/navlinks.json (el sitio lo aplica igual).
`}
module.exports = router;
`,
    };
  },
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'menu-admin': {
      title: 'Menú',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('list', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Menú de navegación</h2>
      <p class="section-sub">Ordená, renombrá y escondé los links del menú, o sumá los tuyos (redes, WhatsApp, un formulario externo). Los cambios se ven en todo el sitio al instante, sin regenerar. Solo visible para administradores.</p>

      <label style="display:block;margin-bottom:6px">Así queda el menú</label>
      <div class="nv-previa" id="nv-previa"></div>

      <div class="card" style="margin-bottom:26px">
        <h3 style="margin-top:0">Agregar un link propio</h3>
        <form id="nv-form">
          <div class="grid cols-2">
            <div><label for="nv-label">Nombre</label><input id="nv-label" name="label" required maxlength="40" placeholder="Instagram"></div>
            <div><label for="nv-href">Destino</label><input id="nv-href" name="href" required maxlength="400" placeholder="https://instagram.com/tunegocio"></div>
          </div>
          <button class="btn" type="submit" style="margin-top:14px">Agregar al menú</button>
        </form>
      </div>

      <div id="nv-lista"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo menú administrable: aplica orden, nombres y visibilidad sobre el menú ya renderizado.
   No reconstruye el HTML: MUEVE los enlaces que ya existen. Reescribir .nav-links rompería en
   silencio el contador del carrito (enganchado a un nodo concreto), el display:none con que varios
   módulos esconden sus links de administración, y la clase "active" de la página en curso.
   Expone window.WFNav.aplicar() para los módulos que insertan links después de cargar.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel vive en /menu-admin.html.` : ''} */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var config = null;

  // Normaliza una dirección para compararla: sin origen, sin barra final, en minúsculas
  function clave(href) {
    var h = String(href || '').trim();
    try { if (/^https?:\\/\\//i.test(h) && h.indexOf(location.origin) === 0) h = h.slice(location.origin.length); } catch (e) {}
    return h.toLowerCase().replace(/\\/+$/, '') || '/';
  }

  function aplicar() {
    var cont = document.querySelector('.nav-links');
    if (!cont || !config) return;
    var anclas = Array.prototype.slice.call(cont.querySelectorAll('a'));
    var porHref = {};
    anclas.forEach(function (a) { porHref[clave(a.getAttribute('href'))] = a; });

    var enOrden = [];
    var nuevos = [];
    config.forEach(function (l) {
      var a = porHref[clave(l.href)];
      if (!a) {
        // Link propio del panel: todavía no está en el HTML horneado, se crea
        if (!l.custom || l.visible === false) return;
        a = document.createElement('a');
        a.href = l.href;
        if (l.externo) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        nuevos.push(a);
      }
      // El nombre se pisa sólo sobre el texto: si el link tiene un ícono horneado (nav-icon)
      // reemplazar su contenido lo borraría, así que esos se dejan como están.
      if (l.label && !a.classList.contains('nav-icon') && !a.querySelector('svg')) {
        var badge = a.querySelector('.badge');
        a.textContent = l.label;
        if (badge) { a.appendChild(document.createTextNode(' ')); a.appendChild(badge); }
      }
      // Oculto por el panel. Se usa el atributo hidden y NO style.display, que es lo que usan los
      // módulos para esconderle su link de administración a quien no es admin: pisarlo mostraría
      // el panel de otro módulo en el menú de un visitante cualquiera.
      a.hidden = l.visible === false;
      enOrden.push(a);
    });

    // Los que el panel no conoce (links insertados por otros módulos después de generar) quedan
    // al final, en el orden en que estaban
    anclas.forEach(function (a) { if (enOrden.indexOf(a) < 0) enOrden.push(a); });
    enOrden.forEach(function (a) { cont.appendChild(a); });

    if (nuevos.length) {
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(nuevos, { opacity: [0, 1], duration: 320, ease: 'outCubic' });
        // Red de seguridad: con la pestaña oculta el loop de Anime no corre
        setTimeout(function () { nuevos.forEach(function (a) { a.style.opacity = 1; }); }, 700);
      }
    }
  }

  window.WFNav = { aplicar: aplicar };

  var DEMO = [
    { href: '/index.html', label: 'Inicio', order: 1, visible: true, custom: false },
    { href: '/about.html', label: 'Nosotros', order: 2, visible: true, custom: false },
    { href: 'https://instagram.com/', label: 'Instagram', order: 3, visible: true, custom: true, externo: true },
  ];

  if (window.__PREVIEW__) {
    // Sin servidor no hay menú guardado: en la vista previa del Builder se deja el menú horneado
    // tal cual y sólo el panel muestra datos de ejemplo.
    config = null;
  } else {
    fetch('/api/navegacion').then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.rows) { config = d.rows; aplicar(); } })
      .catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /menu-admin.html ----
  var form = document.getElementById('nv-form');
  var box = document.getElementById('nv-lista');
  if (form && box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var SUBIR = ${JSON.stringify(phIcon('arrow-up', { size: 14 }))};
    var BAJAR = ${JSON.stringify(phIcon('arrow-down', { size: 14 }))};

    function pintarPrevia() {
      var cont = document.getElementById('nv-previa');
      var visibles = lista.filter(function (l) { return l.visible; });
      cont.innerHTML = visibles.length
        ? visibles.map(function (l) { return '<span class="' + (l.custom ? 'nv-nuevo' : '') + '">' + App.esc(l.label) + '</span>'; }).join('')
        : '<span class="muted">El menú quedaría vacío.</span>';
    }

    function pintarTabla() {
      box.innerHTML = App.table(lista, [
        { label: 'Link', render: function (l) {
          return '<strong>' + App.esc(l.label) + '</strong>' +
            (l.original && l.original !== l.label ? '<br><span class="muted" style="font-size:.78rem">antes: ' + App.esc(l.original) + '</span>' : '') +
            '<br><span class="nv-href">' + App.esc(l.href) + '</span>';
        } },
        { label: 'Tipo', render: function (l) {
          if (l.custom) return '<span class="nv-chip off">Propio</span>';
          if (l.admin) return '<span class="nv-chip off">Administración</span>';
          return '<span class="muted">Del sitio</span>';
        } },
        { label: 'Estado', render: function (l) { return l.visible ? '<span class="nv-chip on">Visible</span>' : '<span class="nv-chip off">Oculto</span>'; } },
        { label: '', render: function (l) {
          return '<span class="nv-acc">' +
            '<button class="btn ghost" type="button" aria-label="Subir" title="Subir" data-nv-sube="' + l.id + '">' + SUBIR + '</button>' +
            '<button class="btn ghost" type="button" aria-label="Bajar" title="Bajar" data-nv-baja="' + l.id + '">' + BAJAR + '</button>' +
            '<button class="btn ghost" type="button" data-nv-ren="' + l.id + '">Renombrar</button>' +
            '<button class="btn ghost" type="button" data-nv-ver="' + l.id + '">' + (l.visible ? 'Ocultar' : 'Mostrar') + '</button>' +
            (l.custom
              ? '<button class="btn ghost" type="button" data-nv-del="' + l.id + '">Borrar</button>'
              : (l.original && l.original !== l.label ? '<button class="btn ghost" type="button" data-nv-res="' + l.id + '">Restaurar</button>' : '')) +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-nv-sube]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-nv-sube'), 'sube'); });
      });
      box.querySelectorAll('[data-nv-baja]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-nv-baja'), 'baja'); });
      });
      box.querySelectorAll('[data-nv-ren]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var l = buscar(b.getAttribute('data-nv-ren'));
          if (!l) return;
          var nombre = prompt('Nombre del link en el menú:', l.label);
          if (nombre === null) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se renombraría el link'); return; }
          try {
            await App.api('/api/navegacion/' + l.id, { method: 'PUT', body: { label: nombre } });
            App.toast('Link renombrado');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-nv-ver]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var l = buscar(b.getAttribute('data-nv-ver'));
          if (!l) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
          try {
            await App.api('/api/navegacion/' + l.id, { method: 'PUT', body: { visible: !l.visible } });
            App.toast(l.visible ? 'Link oculto' : 'Link visible');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-nv-res]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (window.__PREVIEW__) { App.toast('Vista previa: volvería al nombre original'); return; }
          try {
            await App.api('/api/navegacion/' + b.getAttribute('data-nv-res') + '/restaurar', { method: 'POST', body: {} });
            App.toast('Nombre original restaurado');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-nv-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Sacar este link del menú? (Es un link propio: se borra)')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/navegacion/' + b.getAttribute('data-nv-del'), { method: 'DELETE' });
            App.toast('Link borrado');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      pintarPrevia();
    }

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reordenaría'); return; }
      try {
        var out = await App.api('/api/navegacion/' + id + '/mover', { method: 'POST', body: { dir: dir } });
        lista = out.rows;
        pintarTabla();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function cargar() {
      if (window.__PREVIEW__) {
        lista = DEMO.map(function (l, i) { return { id: 'd' + i, original: l.label, admin: false, ...l }; });
        pintarTabla();
        return;
      }
      try {
        var out = await App.api('/api/navegacion/todos');
        lista = out.rows;
        pintarTabla();
        // El menú de esta misma página también se actualiza: el panel muestra el efecto real
        config = lista;
        aplicar();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: se agregaría el link'); return; }
      try {
        await App.api('/api/navegacion', { method: 'POST', body: {
          label: form.querySelector('[name="label"]').value,
          href: form.querySelector('[name="href"]').value,
        } });
        App.toast('Link agregado al menú');
        form.reset();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

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
    var navN = document.getElementById('nav-navegacion');
    if (navN && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navN.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Menú administrable**: el menú se siembra al generar con **los links reales de este proyecto** y después se ordena, renombra, esconde o amplía ${cfg.moduleIds.includes('auth') ? 'desde `/menu-admin.html`' : 'editando `data/navlinks.json` (activá el módulo **Autenticación** para hacerlo desde `/menu-admin.html`)'}, sin regenerar. El destino de los links **del sitio** no se puede cambiar (lo define el módulo que los aporta): se renombran o se ocultan. Los links propios (Instagram, WhatsApp, un formulario externo) sí se crean y se borran. Si agregás módulos nuevos y regenerás, sus links aparecen al final: la siembra sólo corre con la colección vacía, así que los cambios que hiciste **no se pisan**.`,
  ],
};
