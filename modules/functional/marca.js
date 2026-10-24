// Clientes, prensa y certificaciones administrables con backend real: las franjas "Confían en
// nosotros" (módulo UI logos) y "Como se vio en" + sellos (módulo UI press) traían nombres
// INVENTADOS horneados en el HTML —"Nova Group", "El Diario", "Radio Ciudad"—. Es la peor clase de
// placeholder: no se ve roto, así que sale a producción tal cual y el sitio termina exhibiendo
// clientes que no existen y medios que nunca hablaron del negocio. Acá las tres listas viven en la
// colección brandlogos, GET /api/marca es público y el cliente las INYECTA EN VIVO sobre las
// franjas ya renderizadas, con el MISMO marcado (.logo-marca, .press-media, .press-cert) para no
// perder el grisado que toma color en hover ni los estilos del <head> de press.
// Cada entrada puede ser un WORDMARK tipográfico (sólo el nombre, como el HTML original) o un LOGO
// REAL por URL: si hay imagen se usa el <img> —los estilos de grisado ya la contemplan— y si no,
// el texto. La URL se valida contra javascript:/data: y se limita a http(s) o rutas del sitio.
// Los sellos llevan un ícono Phosphor elegido de una lista blanca (se guarda el nombre, nunca
// marcado). El orden lo decide el servidor, dentro de cada grupo. Panel solo-admin, animado con
// Anime.js + red de seguridad. Requiere la franja de logos de clientes.
const { phIcon } = require('../../src/icons');

// Íconos elegibles para los sellos de certificación. El dato guardado es el NOMBRE.
const ICONOS = ['shield-check', 'seal-check', 'star', 'lock', 'check', 'handshake', 'heart', 'thumbs-up'];

// Siembra: los mismos nombres que hornean logos.js y press.js, para que la primera carga no
// parpadee mostrando primero el HTML y después datos distintos.
const SEMILLA = [
  { kind: 'cliente', name: 'Nova Group', order: 1 },
  { kind: 'cliente', name: 'Altura SA', order: 2 },
  { kind: 'cliente', name: 'Vector', order: 3 },
  { kind: 'cliente', name: 'Prisma Studio', order: 4 },
  { kind: 'cliente', name: 'Faro Digital', order: 5 },
  { kind: 'cliente', name: 'Cumbre', order: 6 },
  { kind: 'medio', name: 'El Diario', order: 1 },
  { kind: 'medio', name: 'Revista Pyme', order: 2 },
  { kind: 'medio', name: 'Radio Ciudad', order: 3 },
  { kind: 'medio', name: 'Portal Negocios', order: 4 },
  { kind: 'medio', name: 'TV Región', order: 5 },
  { kind: 'sello', name: 'Sitio seguro SSL', icon: 'shield-check', order: 1 },
  { kind: 'sello', name: 'Empresa verificada', icon: 'seal-check', order: 2 },
  { kind: 'sello', name: 'Compromiso sustentable', icon: 'heart', order: 3 },
  { kind: 'sello', name: 'Calidad certificada', icon: 'star', order: 4 },
].map(r => ({ imageUrl: '', icon: '', active: true, ...r }));

module.exports = {
  id: 'marca', type: 'functional', name: 'Clientes, prensa y sellos administrables',
  description: 'Las franjas "Confían en nosotros" (clientes), "Como se vio en" (medios) y los sellos de certificación se guardan en el backend (colección brandlogos) y se inyectan en vivo sobre el HTML ya renderizado: el negocio suma un cliente nuevo o saca un medio desde /marca-admin.html y el sitio publicado lo refleja al instante, sin regenerar ni volver a deployar. Cada entrada puede ser el nombre tipográfico (como el HTML original) o el logo real por URL, validada contra javascript:/data:; los sellos llevan un ícono Phosphor elegido de una lista blanca. Se conserva el marcado original, así el grisado que toma color en hover sigue funcionando. GET /api/marca es público; el alta, la edición y el borrado son solo-admin. Animado con Anime.js.',
  usesAnime: true,
  requires: ['logos'],
  mounts: [{ route: '/api/marca', file: 'routes/marca.js' }],
  collections: ['brandlogos'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Clientes y prensa', href: '/marca-admin.html', id: 'nav-marca' }] : [],
  head: () => `  <style>
    .mk-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .mk-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .mk-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .mk-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .mk-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .mk-iconos{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
    .mk-ico{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:1px solid var(--line);border-radius:var(--radius);background:var(--bg);cursor:pointer;color:var(--muted)}
    .mk-ico[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 22%,transparent)}
  </style>`,
  files: (cfg) => ({
    'routes/marca.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Tres grupos con marcado propio en el HTML: clientes, medios y sellos de certificación
const GRUPOS = ['cliente', 'medio', 'sello'];
const ICONOS = ${JSON.stringify(ICONOS)};
// Un logo válido es una imagen del propio sitio o una URL http(s): nunca javascript: ni data:
const IMAGEN = /^(\\/[\\w\\-./#?=&%]*|https?:\\/\\/[^\\s"']+)$/;

db.seedIfEmpty('brandlogos', ${JSON.stringify(SEMILLA, null, 2)});

const resolver = (r) => ({
  id: r.id,
  kind: GRUPOS.includes(r.kind) ? r.kind : 'cliente',
  name: r.name || '',
  imageUrl: r.imageUrl || '',
  icon: ICONOS.includes(r.icon) ? r.icon : '',
  active: r.active !== false,
  order: Number(r.order) || 0,
});

// El orden es por grupo: sumar un cliente no puede reordenar los medios
const ordenados = (rows) => rows.map(resolver)
  .sort((a, b) => GRUPOS.indexOf(a.kind) - GRUPOS.indexOf(b.kind) || (a.order - b.order) || String(a.name).localeCompare(String(b.name)));

function leer(body, parcial) {
  const patch = {};
  if (body.kind !== undefined || !parcial) {
    if (!GRUPOS.includes(body.kind)) return { ok: false, error: 'Grupo inválido (cliente, medio o sello)' };
    patch.kind = body.kind;
  }
  if (body.name !== undefined || !parcial) {
    if (!str(body.name, 2, 60)) return { ok: false, error: 'El nombre tiene que tener entre 2 y 60 caracteres' };
    patch.name = String(body.name).trim();
  }
  if (body.imageUrl !== undefined) {
    const v = String(body.imageUrl).trim();
    if (v && !IMAGEN.test(v)) return { ok: false, error: 'El logo tiene que ser una ruta del sitio (/img/logo.png) o una URL http(s)' };
    patch.imageUrl = v;
  }
  if (body.icon !== undefined) {
    const v = String(body.icon).trim();
    if (v && !ICONOS.includes(v)) return { ok: false, error: 'Ese ícono no está en la lista disponible' };
    patch.icon = v;
  }
  if (body.active !== undefined) patch.active = !(body.active === false || body.active === 'false');
  return { ok: true, patch };
}

// GET /api/marca — público: los tres grupos ya separados y ordenados, sólo lo visible
router.get('/', async (req, res) => {
  const visibles = ordenados(await db.all('brandlogos')).filter(r => r.active);
  const grupo = (k) => visibles.filter(r => r.kind === k).map(({ active, kind, ...pub }) => pub);
  res.json({ clientes: grupo('cliente'), medios: grupo('medio'), sellos: grupo('sello') });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/marca/todos — el panel ve también lo apagado
router.get('/todos', requireAdmin, async (req, res) => {
  res.json({ rows: ordenados(await db.all('brandlogos')) });
});

// POST /api/marca — alta. La posición la decide el servidor: al final de SU grupo
router.post('/', requireAdmin, async (req, res) => {
  const { ok, error, patch } = leer(req.body, false);
  if (!ok) return res.status(422).json({ error });
  const delGrupo = (await db.all('brandlogos')).filter(r => r.kind === patch.kind);
  const ultimo = delGrupo.reduce((m, r) => Math.max(m, Number(r.order) || 0), 0);
  const row = await db.insert('brandlogos', {
    kind: patch.kind, name: patch.name,
    imageUrl: patch.imageUrl || '', icon: patch.icon || '',
    active: patch.active !== false, order: ultimo + 1,
  });
  res.status(201).json(resolver(row));
});

// PUT /api/marca/:id — edición parcial. Cambiar de grupo manda la entrada al final del nuevo
router.put('/:id', requireAdmin, async (req, res) => {
  const r = await db.get('brandlogos', req.params.id);
  if (!r) return res.status(404).json({ error: 'Esa entrada no existe' });
  const { ok, error, patch } = leer(req.body, true);
  if (!ok) return res.status(422).json({ error });
  if (patch.kind && patch.kind !== r.kind) {
    const delGrupo = (await db.all('brandlogos')).filter(x => x.kind === patch.kind);
    patch.order = delGrupo.reduce((m, x) => Math.max(m, Number(x.order) || 0), 0) + 1;
  }
  res.json(resolver(await db.update('brandlogos', r.id, patch)));
});

// POST /api/marca/:id/mover — sube o baja DENTRO de su grupo
router.post('/:id/mover', requireAdmin, async (req, res) => {
  const dir = req.body.dir === 'sube' ? -1 : 1;
  const r = await db.get('brandlogos', req.params.id);
  if (!r) return res.status(404).json({ error: 'Esa entrada no existe' });
  const lista = ordenados(await db.all('brandlogos')).filter(x => x.kind === resolver(r).kind);
  const i = lista.findIndex(x => x.id === r.id);
  const j = i + dir;
  if (j < 0 || j >= lista.length) return res.status(409).json({ error: dir < 0 ? 'Ya es la primera de su grupo' : 'Ya es la última de su grupo' });
  const nueva = lista.slice();
  nueva[i] = lista[j];
  nueva[j] = lista[i];
  // Se reescriben las posiciones del grupo entero: queda 1..N sin huecos ni empates
  for (let k = 0; k < nueva.length; k++) await db.update('brandlogos', nueva[k].id, { order: k + 1 });
  res.json({ rows: ordenados(await db.all('brandlogos')) });
});

// DELETE /api/marca/:id — baja definitiva (para esconderla sin perderla está el interruptor)
router.delete('/:id', requireAdmin, async (req, res) => {
  const r = await db.get('brandlogos', req.params.id);
  if (!r) return res.status(404).json({ error: 'Esa entrada no existe' });
  await db.remove('brandlogos', r.id);
  res.json({ ok: true });
});
` : `// La edición requiere el módulo de autenticación: activalo en el Builder para habilitar
// /marca-admin.html. Sin él, las franjas se editan en data/brandlogos.json (el sitio las lee igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'marca-admin': {
      title: 'Clientes y prensa',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('seal-check', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Clientes, prensa y sellos</h2>
      <p class="section-sub">Las franjas de confianza del sitio. Cargá clientes reales, medios que te mencionaron y las certificaciones que tengas: lo que no sea verdad, sacalo. Solo visible para administradores.</p>

      <div class="card" style="margin-bottom:26px">
        <h3 id="mk-form-titulo">Nueva entrada</h3>
        <form id="mk-form">
          <div class="grid cols-2">
            <div>
              <label>Grupo</label>
              <select name="kind" id="mk-kind">
                <option value="cliente">Cliente (franja "Confían en nosotros")</option>
                <option value="medio">Medio (franja "Como se vio en")</option>
                <option value="sello">Sello de certificación</option>
              </select>
            </div>
            <div><label>Nombre</label><input name="name" required maxlength="60" placeholder="Nova Group"></div>
          </div>
          <div id="mk-campo-imagen">
            <label>Logo (opcional)</label>
            <input name="imageUrl" maxlength="300" placeholder="/img/cliente.png o https://…">
            <span class="muted" style="font-size:.8rem">Sin logo se muestra el nombre en tipografía, como ahora.</span>
          </div>
          <div id="mk-campo-icono" hidden>
            <label id="mk-icono-label">Ícono del sello</label>
            <div class="mk-iconos" id="mk-iconos" role="group" aria-labelledby="mk-icono-label"></div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="active" style="width:auto;margin:0" checked> Visible en el sitio</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="mk-guardar">Agregar</button>
            <button class="btn ghost" type="button" id="mk-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>

      <div id="mk-lista"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo marca: trae clientes, medios y sellos de /api/marca y reconstruye las franjas con el
   mismo marcado que hornean los módulos UI (.logo-marca, .press-media, .press-cert), así los
   estilos de grisado y hover siguen aplicando.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel de edición vive en /marca-admin.html.` : ''}
   Anime.js para la aparición, con red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ICO = ${JSON.stringify(Object.fromEntries(ICONOS.map(n => [n, phIcon(n, { size: 22 })])))};
  var SUBIR = ${JSON.stringify(phIcon('arrow-up', { size: 14 }))};
  var BAJAR = ${JSON.stringify(phIcon('arrow-down', { size: 14 }))};
  var GRUPO_NOMBRE = { cliente: 'Cliente', medio: 'Medio', sello: 'Sello' };

  function aparecer(nodos) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce || !nodos.length) return;
    anime.animate(nodos, { opacity: [0, 1], translateY: [8, 0], duration: 380, delay: anime.stagger ? anime.stagger(40) : 0, ease: 'outCubic' });
    // Red de seguridad: con la pestaña oculta el loop de Anime no corre y quedarían invisibles
    setTimeout(function () {
      Array.prototype.forEach.call(nodos, function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
    }, 900);
  }

  // Un wordmark tipográfico si no hay logo; el <img> si lo hay (los estilos ya contemplan ambos)
  function marca(r, clase) {
    if (r.imageUrl) return '<img src="' + App.esc(r.imageUrl) + '" alt="' + App.esc(r.name) + '" class="' + clase + '">';
    return '<span class="' + clase + '">' + App.esc(r.name) + '</span>';
  }

  function pintar(datos) {
    var franja = document.querySelector('#clientes .logos-franja');
    if (franja && datos.clientes && datos.clientes.length) {
      franja.innerHTML = datos.clientes.map(function (r) { return marca(r, 'logo-marca'); }).join('');
      aparecer(franja.children);
    }
    var medios = document.querySelector('#prensa .press-medios');
    if (medios && datos.medios && datos.medios.length) {
      medios.innerHTML = datos.medios.map(function (r) { return marca(r, 'press-media'); }).join('');
      aparecer(medios.children);
    }
    var certs = document.querySelector('#prensa .press-certs');
    if (certs && datos.sellos && datos.sellos.length) {
      certs.innerHTML = datos.sellos.map(function (r) {
        return '<div class="press-cert"><span class="press-cert-ico" aria-hidden="true">' +
          (ICO[r.icon] || ICO['seal-check']) + '</span><span>' + App.esc(r.name) + '</span></div>';
      }).join('');
      aparecer(certs.children);
    }
  }

  var DEMO = ${JSON.stringify({
    clientes: SEMILLA.filter(r => r.kind === 'cliente').map(({ kind, active, ...r }, i) => ({ id: 'c' + i, ...r })),
    medios: SEMILLA.filter(r => r.kind === 'medio').map(({ kind, active, ...r }, i) => ({ id: 'm' + i, ...r })),
    sellos: SEMILLA.filter(r => r.kind === 'sello').map(({ kind, active, ...r }, i) => ({ id: 's' + i, ...r })),
  })};

  if (document.getElementById('clientes') || document.getElementById('prensa')) {
    if (window.__PREVIEW__) pintar(DEMO);
    else fetch('/api/marca').then(function (r) { return r.json(); })
      .then(function (d) { if (d) pintar(d); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /marca-admin.html ----
  var form = document.getElementById('mk-form');
  var box = document.getElementById('mk-lista');
  if (form && box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var editando = '';
    var iconoElegido = Object.keys(ICO)[0];

    function pintarIconos() {
      var cont = document.getElementById('mk-iconos');
      if (!cont) return;
      cont.innerHTML = Object.keys(ICO).map(function (n) {
        return '<button type="button" class="mk-ico" data-mk-ico="' + n + '" aria-pressed="' + (n === iconoElegido) + '" title="' + n + '" aria-label="Ícono ' + n + '">' + ICO[n] + '</button>';
      }).join('');
      cont.querySelectorAll('[data-mk-ico]').forEach(function (b) {
        b.addEventListener('click', function () { iconoElegido = b.getAttribute('data-mk-ico'); pintarIconos(); });
      });
    }

    // Un sello lleva ícono y no logo; un cliente o un medio, al revés
    function ajustarCampos() {
      var esSello = form.querySelector('[name="kind"]').value === 'sello';
      document.getElementById('mk-campo-icono').hidden = !esSello;
      document.getElementById('mk-campo-imagen').hidden = esSello;
    }

    function salirDeEdicion() {
      editando = '';
      form.reset();
      form.querySelector('[name="active"]').checked = true;
      iconoElegido = Object.keys(ICO)[0];
      pintarIconos();
      ajustarCampos();
      document.getElementById('mk-form-titulo').textContent = 'Nueva entrada';
      document.getElementById('mk-guardar').textContent = 'Agregar';
      document.getElementById('mk-cancelar').hidden = true;
    }

    function editar(r) {
      editando = r.id;
      form.querySelector('[name="kind"]').value = r.kind;
      form.querySelector('[name="name"]').value = r.name || '';
      form.querySelector('[name="imageUrl"]').value = r.imageUrl || '';
      form.querySelector('[name="active"]').checked = r.active !== false;
      iconoElegido = r.icon || Object.keys(ICO)[0];
      pintarIconos();
      ajustarCampos();
      document.getElementById('mk-form-titulo').textContent = 'Editando: ' + r.name;
      document.getElementById('mk-guardar').textContent = 'Guardar cambios';
      document.getElementById('mk-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function pintarTabla() {
      box.innerHTML = App.table(lista, [
        { label: 'Grupo', render: function (r) { return '<span class="muted">' + GRUPO_NOMBRE[r.kind] + '</span>'; } },
        { label: 'Entrada', render: function (r) {
          var ico = r.kind === 'sello' ? (ICO[r.icon] || ICO['seal-check']) + ' ' : '';
          return ico + '<strong>' + App.esc(r.name) + '</strong>' +
            (r.imageUrl ? '<br><span class="muted" style="font-size:.78rem">' + App.esc(r.imageUrl) + '</span>' : '');
        } },
        { label: 'Estado', render: function (r) { return r.active ? '<span class="mk-chip on">Visible</span>' : '<span class="mk-chip off">Oculta</span>'; } },
        { label: '', render: function (r) {
          return '<span class="mk-acciones">' +
            '<button class="btn ghost" type="button" aria-label="Subir" title="Subir" data-mk-sube="' + r.id + '">' + SUBIR + '</button>' +
            '<button class="btn ghost" type="button" aria-label="Bajar" title="Bajar" data-mk-baja="' + r.id + '">' + BAJAR + '</button>' +
            '<button class="btn ghost" type="button" data-mk-edit="' + r.id + '">Editar</button>' +
            '<button class="btn ghost" type="button" data-mk-ver="' + r.id + '">' + (r.active ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn ghost" type="button" data-mk-del="' + r.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-mk-edit]').forEach(function (b) {
        b.addEventListener('click', function () { var r = buscar(b.getAttribute('data-mk-edit')); if (r) editar(r); });
      });
      box.querySelectorAll('[data-mk-sube]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-mk-sube'), 'sube'); });
      });
      box.querySelectorAll('[data-mk-baja]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-mk-baja'), 'baja'); });
      });
      box.querySelectorAll('[data-mk-ver]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var r = buscar(b.getAttribute('data-mk-ver'));
          if (!r) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
          try {
            await App.api('/api/marca/' + r.id, { method: 'PUT', body: { active: !r.active } });
            App.toast(r.active ? 'Entrada oculta' : 'Entrada visible');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-mk-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar esta entrada? Si sólo querés sacarla del sitio, usá "Ocultar".')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/marca/' + b.getAttribute('data-mk-del'), { method: 'DELETE' });
            App.toast('Entrada borrada');
            if (editando === b.getAttribute('data-mk-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reordenaría'); return; }
      try {
        var out = await App.api('/api/marca/' + id + '/mover', { method: 'POST', body: { dir: dir } });
        lista = out.rows;
        pintarTabla();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    var DEMO_PANEL = ${JSON.stringify(SEMILLA.map((r, i) => ({ id: 'd' + (i + 1), ...r })))};

    async function cargar() {
      if (window.__PREVIEW__) { lista = DEMO_PANEL.slice(); pintarTabla(); return; }
      try {
        var out = await App.api('/api/marca/todos');
        lista = out.rows;
        pintarTabla();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    form.querySelector('[name="kind"]').addEventListener('change', ajustarCampos);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var kind = form.querySelector('[name="kind"]').value;
      var datos = {
        kind: kind,
        name: form.querySelector('[name="name"]').value,
        // El ícono sólo aplica a los sellos y el logo sólo a clientes y medios
        icon: kind === 'sello' ? iconoElegido : '',
        imageUrl: kind === 'sello' ? '' : form.querySelector('[name="imageUrl"]').value,
        active: form.querySelector('[name="active"]').checked,
      };
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la entrada'); return; }
      try {
        if (editando) await App.api('/api/marca/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/marca', { method: 'POST', body: datos });
        App.toast(editando ? 'Entrada actualizada' : 'Entrada agregada');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var cancelar = document.getElementById('mk-cancelar');
    if (cancelar) cancelar.addEventListener('click', salirDeEdicion);

    pintarIconos();
    ajustarCampos();
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
    var navM = document.getElementById('nav-marca');
    if (navM && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navM.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Clientes, prensa y sellos administrables**: las tres franjas viven en la colección \`brandlogos\` y se inyectan en vivo, así que cambiarlas **no requiere regenerar ni volver a deployar**. Se siembran los nombres de ejemplo del HTML ("Nova Group", "El Diario"…): **son inventados, reemplazalos por los reales antes de publicar** ${cfg.moduleIds.includes('auth') ? 'desde `/marca-admin.html`' : 'editando `data/brandlogos.json` (o activá el módulo **Autenticación** para hacerlo desde `/marca-admin.html`)'}. Cada cliente o medio puede mostrarse como **nombre tipográfico** (lo actual) o como **logo real** cargando su URL; los sellos llevan un **ícono elegido de una grilla**.`,
  ],
};
