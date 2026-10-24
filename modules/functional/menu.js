// Carta / menú de restaurante administrable con backend real: una página pública /carta.html que
// muestra los platos publicados agrupados por categoría (Entradas, Principales, Postres, Bebidas…)
// con su precio, descripción y etiquetas de dieta (vegetariano, sin TACC, picante), y un buscador
// que filtra en el servidor (colección menuitems). Cada plato puede marcarse como "no disponible
// hoy" sin borrarlo. Con el módulo de autenticación activo, /carta-admin.html es un ABM solo-admin
// para crear, editar, activar/pausar y borrar platos. Se siembran algunos platos de ejemplo la
// primera vez para que la carta se vea desde el arranque, incluso sin auth. La aparición de las
// secciones se anima con Anime.js (stagger + red de seguridad, respeta "prefers-reduced-motion").
// Es una pieza clave para restaurantes, bares y cafeterías, y no existía en el catálogo. Distinto
// de "products-admin" (catálogo de e-commerce con stock y carrito) y de "catalogo"/"pricing" (UI
// estática): acá el negocio gastronómico administra su carta y se sirve dinámicamente, sin carrito.

// Etiquetas de dieta disponibles (constante del cliente y del servidor).
const TAGS = [
  { id: 'veg', label: 'Vegetariano' },
  { id: 'vegan', label: 'Vegano' },
  { id: 'sintacc', label: 'Sin TACC' },
  { id: 'picante', label: 'Picante' },
];

// Platos de ejemplo (se siembran la primera vez; el negocio los edita o borra desde el ABM).
const SEMILLA = [
  { name: 'Empanadas caseras (x6)', category: 'Entradas', price: 4800, description: 'Surtido de carne cortada a cuchillo, pollo y jamón y queso.', tags: [], available: true },
  { name: 'Provoleta a la parrilla', category: 'Entradas', price: 5200, description: 'Con orégano, aceite de oliva y pan tostado.', tags: ['veg'], available: true },
  { name: 'Bife de chorizo con guarnición', category: 'Principales', price: 12500, description: 'Corte premium a la parrilla con papas rústicas o ensalada.', tags: ['sintacc'], available: true },
  { name: 'Risotto de hongos', category: 'Principales', price: 9800, description: 'Cremoso, con hongos de estación y parmesano.', tags: ['veg', 'sintacc'], available: true },
  { name: 'Flan casero con dulce de leche', category: 'Postres', price: 3900, description: 'Con crema o dulce de leche a elección.', tags: ['veg'], available: true },
  { name: 'Limonada de jengibre', category: 'Bebidas', price: 2800, description: 'Con menta fresca y jengibre. Jarra o vaso.', tags: ['vegan', 'sintacc'], available: true },
];

module.exports = {
  id: 'menu', type: 'functional', name: 'Carta / menú',
  description: 'Carta de restaurante con backend: página pública /carta.html con los platos publicados agrupados por categoría, precio, descripción, etiquetas de dieta y buscador que filtra en el servidor (Anime.js). Cada plato se puede marcar "no disponible hoy". Con auth activo, ABM solo-admin en /carta-admin.html.',
  usesAnime: true,
  mounts: [{ route: '/api/menu', file: 'routes/menu.js' }],
  collections: ['menuitems'],
  nav: (cfg) => {
    const links = [{ label: 'Carta', href: '/carta.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Editar carta', href: '/carta-admin.html', id: 'nav-carta-admin' });
    return links;
  },
  head: () => `  <style>
    .mn-search{max-width:420px;margin:0 0 28px}
    .mn-cat{margin:0 0 32px}
    .mn-cat h3{margin:0 0 4px;font-size:1.35rem;color:var(--accent)}
    .mn-cat .mn-line{height:2px;background:color-mix(in srgb,var(--accent) 30%,var(--line));border:0;margin:0 0 16px}
    .mn-item{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px dashed var(--line)}
    .mn-item:last-child{border-bottom:0}
    .mn-item.off{opacity:.55}
    .mn-item .mn-info{flex:1}
    .mn-item .mn-name{font-weight:700;margin:0}
    .mn-item .mn-desc{margin:4px 0 0;color:var(--muted);font-size:.9rem}
    .mn-item .mn-tags{margin:6px 0 0;display:flex;gap:6px;flex-wrap:wrap}
    .mn-tag{font-size:.68rem;padding:1px 8px;border-radius:999px;background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}
    .mn-tag.off{background:var(--surface);border:1px solid var(--line);color:var(--muted)}
    .mn-item .mn-price{font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
    .mn-noff{font-size:.72rem;color:var(--muted);display:block}
    .mn-empty{color:var(--muted)}
    .mn-badge{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;vertical-align:baseline;background:var(--surface);border:1px solid var(--line)}
    .mn-badge.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
  </style>`,
  files: (cfg) => ({
    'routes/menu.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Etiquetas de dieta válidas (deben coincidir con las del frontend)
const TAGS = ${JSON.stringify(TAGS.map(t => t.id))};

// Siembra platos de ejemplo la primera vez para que /carta.html se vea desde el arranque
db.seedIfEmpty('menuitems', ${JSON.stringify(SEMILLA, null, 2)});

const validar = (data) => check(data, {
  name: (v) => str(v, 2, 120),
  category: (v) => str(v, 2, 60),
  price: (v) => num(v, 0, 100000000),
});

// Normaliza las etiquetas de dieta (solo las válidas, sin repetidos)
function limpiarTags(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter(t => TAGS.includes(t)))];
}

// Vista pública de un plato
const publico = (p) => ({ id: p.id, name: p.name, category: p.category, price: p.price || 0, description: p.description || '', tags: p.tags || [], available: p.available !== false });

// GET /api/menu — platos publicados agrupados por orden de categoría; ?q= filtra en el servidor
router.get('/', async (req, res) => {
  let rows = await db.all('menuitems');
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q) rows = rows.filter(p => (p.name + ' ' + p.category + ' ' + (p.description || '')).toLowerCase().includes(q));
  res.json(rows.map(publico));
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/menu/all — todos los platos (solo admin)
router.get('/all', requireAdmin, async (req, res) => {
  res.json(await db.all('menuitems'));
});

// POST /api/menu — crea un plato (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 400) : '';
  const row = await db.insert('menuitems', {
    name: req.body.name.trim(),
    category: req.body.category.trim(),
    price: Math.round(req.body.price),
    description,
    tags: limpiarTags(req.body.tags),
    available: req.body.available !== false,
  });
  res.status(201).json(row);
});

// PATCH /api/menu/:id — edita un plato o cambia su disponibilidad (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.name !== undefined) { if (!str(req.body.name, 2, 120)) return res.status(422).json({ error: 'Nombre inválido' }); patch.name = req.body.name.trim(); }
  if (req.body.category !== undefined) { if (!str(req.body.category, 2, 60)) return res.status(422).json({ error: 'Categoría inválida' }); patch.category = req.body.category.trim(); }
  if (req.body.price !== undefined) { if (!num(req.body.price, 0, 100000000)) return res.status(422).json({ error: 'Precio inválido' }); patch.price = Math.round(req.body.price); }
  if (req.body.description !== undefined) patch.description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 400) : '';
  if (req.body.tags !== undefined) patch.tags = limpiarTags(req.body.tags);
  if (req.body.available !== undefined) patch.available = !!req.body.available;
  const row = await db.update('menuitems', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Plato inexistente' });
  res.json(row);
});

// DELETE /api/menu/:id — borra un plato (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('menuitems', req.params.id);
  if (!p) return res.status(404).json({ error: 'Plato inexistente' });
  await db.remove('menuitems', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de la carta (crear, editar, pausar, borrar platos) requiere el módulo de autenticación:
// activalo en el Builder para habilitar /carta-admin.html. Sin él, se muestran los platos
// sembrados y podés editarlos a mano en data/menuitems.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      carta: {
        title: 'Carta',
        html: `  <section>
    <div class="container">
      <h2>Nuestra carta</h2>
      <p class="section-sub">Elaboramos todo con ingredientes frescos. Buscá tu plato o mirá la carta completa.</p>
      <input type="search" id="mn-search" class="mn-search" placeholder="Buscar en la carta… (ej: risotto, postre)" aria-label="Buscar en la carta">
      <div id="mn-list"><p class="mn-empty">Cargando la carta…</p></div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['carta-admin'] = {
        title: 'Editar carta',
        html: `  <section>
    <div class="container">
      <h2>Editar la carta</h2>
      <p class="section-sub">Administrá los platos de tu carta. Solo visible para administradores.</p>
      <form id="mn-form" class="card" style="max-width:680px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Nombre del plato</label><input name="name" required minlength="2" maxlength="120" placeholder="Ej: Risotto de hongos"></div>
          <div><label>Precio ($)</label><input name="price" type="number" min="0" step="1" required placeholder="9800"></div>
        </div>
        <label>Categoría</label>
        <input name="category" required minlength="2" maxlength="60" placeholder="Ej: Principales" list="mn-cat-list">
        <datalist id="mn-cat-list"></datalist>
        <label>Descripción (opcional)</label>
        <textarea name="description" rows="2" maxlength="400" placeholder="Ingredientes y detalle del plato."></textarea>
        <label>Etiquetas de dieta</label>
        <div id="mn-tags" class="mn-tags-form"></div>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:12px"><input type="checkbox" name="available" checked style="width:auto"> Disponible hoy (visible sin la marca "no disponible")</label>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn" type="submit" id="mn-save">Guardar plato</button>
          <button class="btn ghost" type="button" id="mn-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="mn-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo carta/menú: página pública /carta.html (platos por categoría, etiquetas de dieta y
   buscador que filtra en el servidor, animado con Anime.js) y, con auth activo, el ABM en
   /carta-admin.html. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAGS = ${JSON.stringify(TAGS)};
  var TAG_LABEL = TAGS.reduce(function (o, t) { o[t.id] = t.label; return o; }, {});
  // Orden preferido de categorías en la carta pública (las no listadas van al final, alfabéticas)
  var ORDEN = ['Entradas', 'Principales', 'Pastas', 'Pizzas', 'Guarniciones', 'Postres', 'Bebidas', 'Vinos'];

  var DEMO = [
    { id: 'd1', name: 'Provoleta a la parrilla', category: 'Entradas', price: 5200, description: 'Con orégano y pan tostado.', tags: ['veg'], available: true },
    { id: 'd2', name: 'Bife de chorizo', category: 'Principales', price: 12500, description: 'Corte premium con guarnición.', tags: ['sintacc'], available: true },
    { id: 'd3', name: 'Risotto de hongos', category: 'Principales', price: 9800, description: 'Cremoso, con hongos de estación.', tags: ['veg', 'sintacc'], available: false },
    { id: 'd4', name: 'Flan casero', category: 'Postres', price: 3900, description: 'Con crema o dulce de leche.', tags: ['veg'], available: true },
  ];

  function ordenCat(a, b) {
    var ia = ORDEN.indexOf(a), ib = ORDEN.indexOf(b);
    if (ia < 0 && ib < 0) return a.localeCompare(b, 'es');
    if (ia < 0) return 1;
    if (ib < 0) return -1;
    return ia - ib;
  }

  // ---- Página pública /carta.html ----
  var list = document.getElementById('mn-list');
  var search = document.getElementById('mn-search');
  if (list) {
    function render(platos) {
      if (!platos.length) { list.innerHTML = '<p class="mn-empty">No encontramos platos para tu búsqueda.</p>'; return; }
      var porCat = {};
      platos.forEach(function (p) { (porCat[p.category] = porCat[p.category] || []).push(p); });
      var html = '';
      Object.keys(porCat).sort(ordenCat).forEach(function (cat) {
        html += '<div class="mn-cat"><h3>' + App.esc(cat) + '</h3><hr class="mn-line">';
        porCat[cat].forEach(function (p) {
          var tags = (p.tags || []).map(function (t) { return '<span class="mn-tag">' + App.esc(TAG_LABEL[t] || t) + '</span>'; }).join('');
          // data-plato: lo usa el módulo "pedidos de la carta" para enganchar sus botones por plato
          html += '<div class="mn-item' + (p.available ? '' : ' off') + '" data-plato="' + p.id + '">' +
            '<div class="mn-info">' +
              '<p class="mn-name">' + App.esc(p.name) + (p.available ? '' : ' <span class="mn-noff">(no disponible hoy)</span>') + '</p>' +
              (p.description ? '<p class="mn-desc">' + App.esc(p.description) + '</p>' : '') +
              (tags ? '<div class="mn-tags">' + tags + '</div>' : '') +
            '</div>' +
            '<div class="mn-price">' + (p.price > 0 ? App.money(p.price) : '') + '</div>' +
          '</div>';
        });
        html += '</div>';
      });
      list.innerHTML = html;
      var cats = [].slice.call(list.querySelectorAll('.mn-cat'));
      var anime = window.anime;
      if (anime && anime.animate && !reduce && cats.length) {
        anime.animate(cats, { opacity: [0, 1], translateY: [14, 0], duration: 450, delay: anime.stagger ? anime.stagger(70) : 0, ease: 'outCubic' });
        // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
        setTimeout(function () { cats.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 750);
      }
    }
    function cargar(q) {
      if (window.__PREVIEW__) {
        var f = (q || '').toLowerCase();
        render(DEMO.filter(function (p) { return !f || (p.name + p.category + p.description).toLowerCase().indexOf(f) >= 0; }));
        return;
      }
      App.api('/api/menu' + (q ? '?q=' + encodeURIComponent(q) : '')).then(render).catch(function () { list.innerHTML = '<p class="mn-empty">No se pudo cargar la carta.</p>'; });
    }
    if (search) { var t; search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { cargar(search.value.trim()); }, 250); }); }
    cargar('');
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM /carta-admin.html ----
  var adminBox = document.getElementById('mn-admin');
  var formA = document.getElementById('mn-form');
  if (adminBox && formA) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var idInput = formA.querySelector('[name="id"]');
    var cancelBtn = document.getElementById('mn-cancel');
    var saveBtn = document.getElementById('mn-save');
    var datalist = document.getElementById('mn-cat-list');
    var tagsBox = document.getElementById('mn-tags');

    // Casilleros de etiquetas de dieta
    if (tagsBox) tagsBox.innerHTML = TAGS.map(function (t) {
      return '<label style="display:inline-flex;align-items:center;gap:6px;font-weight:400;margin:0 12px 4px 0"><input type="checkbox" value="' + t.id + '" style="width:auto"> ' + App.esc(t.label) + '</label>';
    }).join('');
    function tagsSeleccionados() { return [].slice.call(tagsBox.querySelectorAll('input:checked')).map(function (c) { return c.value; }); }
    function marcarTags(lista) { tagsBox.querySelectorAll('input').forEach(function (c) { c.checked = (lista || []).indexOf(c.value) >= 0; }); }

    function refrescarCats() {
      if (!datalist) return;
      var cats = {};
      todos.forEach(function (p) { if (p.category) cats[p.category] = 1; });
      datalist.innerHTML = Object.keys(cats).map(function (c) { return '<option value="' + App.esc(c) + '">'; }).join('');
    }

    function pintar() {
      adminBox.innerHTML = App.table(todos, [
        { key: 'name', label: 'Plato' },
        { label: 'Categoría', render: function (r) { return '<span class="mn-badge">' + App.esc(r.category) + '</span>'; } },
        { label: 'Precio', render: function (r) { return App.money(r.price); } },
        { label: 'Etiquetas', render: function (r) { return (r.tags && r.tags.length) ? r.tags.map(function (t) { return '<span class="mn-tag">' + App.esc(TAG_LABEL[t] || t) + '</span>'; }).join(' ') : '<span class="muted">—</span>'; } },
        { label: 'Estado', render: function (r) { return r.available ? '<span class="mn-badge on">Disponible</span>' : '<span class="mn-badge">Pausado</span>'; } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-av="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.available ? 'Pausar' : 'Activar') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      adminBox.querySelectorAll('[data-av]').forEach(function (b) { b.addEventListener('click', function () { toggleAv(b.getAttribute('data-av')); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
      refrescarCats();
    }

    function resetForm() {
      formA.reset(); idInput.value = ''; marcarTags([]);
      formA.querySelector('[name="available"]').checked = true;
      saveBtn.textContent = 'Guardar plato';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var p = todos.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      idInput.value = p.id;
      formA.querySelector('[name="name"]').value = p.name;
      formA.querySelector('[name="category"]').value = p.category;
      formA.querySelector('[name="price"]').value = p.price;
      formA.querySelector('[name="description"]').value = p.description || '';
      marcarTags(p.tags);
      formA.querySelector('[name="available"]').checked = p.available !== false;
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formA.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function toggleAv(id) {
      var p = todos.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: cambiaría disponibilidad'); return; }
      try {
        var row = await App.api('/api/menu/' + id, { method: 'PATCH', body: { available: !p.available } });
        p.available = row.available; pintar();
        App.toast(p.available ? 'Plato activado' : 'Plato pausado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este plato de la carta?')) return;
      try {
        await App.api('/api/menu/' + id, { method: 'DELETE' });
        todos = todos.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Plato borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formA.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        name: formA.querySelector('[name="name"]').value,
        category: formA.querySelector('[name="category"]').value,
        price: Number(formA.querySelector('[name="price"]').value),
        description: formA.querySelector('[name="description"]').value,
        tags: tagsSeleccionados(),
        available: formA.querySelector('[name="available"]').checked,
      };
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'crearía') + ' el plato'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/menu/' + editando, { method: 'PATCH', body: datos });
          todos = todos.map(function (r) { return r.id === editando ? upd : r; });
          App.toast('Cambios guardados');
        } else {
          var nuevo = await App.api('/api/menu', { method: 'POST', body: datos });
          todos.push(nuevo);
          App.toast('Plato agregado');
        }
        resetForm();
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function listo(rows) { todos = rows; pintar(); }
    if (window.__PREVIEW__) {
      listo([
        { id: 'd1', name: 'Bife de chorizo', category: 'Principales', price: 12500, description: 'Corte premium.', tags: ['sintacc'], available: true },
        { id: 'd3', name: 'Risotto de hongos', category: 'Principales', price: 9800, description: 'Cremoso.', tags: ['veg', 'sintacc'], available: false },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/menu/all').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navC = document.getElementById('nav-carta-admin');
    if (navC && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navC.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Carta / menú**: los platos viven en la colección \`menuitems\` y se muestran en \`/carta.html\` agrupados por categoría, con precio, descripción, etiquetas de dieta (vegetariano, sin TACC, etc.) y buscador que filtra en el servidor. Cada plato puede marcarse "no disponible hoy" sin borrarlo. Se siembran seis platos de ejemplo la primera vez. ${cfg.moduleIds.includes('auth') ? 'Los administradores crean, editan, pausan y borran platos en \`/carta-admin.html\`.' : 'Para administrar la carta desde la web activá el módulo **Autenticación** (habilita \`/carta-admin.html\`); sin él, editá \`data/menuitems.json\` a mano.'} El orden de las categorías en la carta pública se controla con la constante \`ORDEN\` en \`public/js/app.js\`.`,
  ],
};
