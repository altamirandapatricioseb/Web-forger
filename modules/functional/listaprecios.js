// Lista de precios administrable con backend real: página pública /precios.html con los ítems
// publicados agrupados por categoría (precio alineado a la derecha, unidad opcional "por hora / por
// kg" y buscador que filtra EN EL SERVIDOR sin distinguir acentos: "instalacion" encuentra
// "Instalación"), más la leyenda "Precios actualizados al DD/MM/AAAA" calculada con la última
// modificación real. Con auth activo, /precios-admin.html es el ABM solo-admin (crear, editar,
// publicar/ocultar, borrar) que suma el AUMENTO MASIVO: aplicar un porcentaje a toda la lista o a
// una categoría en un solo paso (el clásico de la inflación argentina: "subí todo 15%"), con
// vista previa de cuántos ítems toca. Colección pricelist, se siembran ítems de ejemplo. Animado
// con Anime.js (stagger de categorías, count-up del aumento) + red de seguridad. Distinto de
// "pricing" (tarjetas de planes estáticas), "menu" (carta gastronómica) y "products-admin"
// (e-commerce con stock y carrito): acá es la lista de precios de servicios/productos del negocio,
// sin carrito, pensada para actualizarse seguido.

// Ítems de ejemplo (el negocio los reemplaza desde el ABM)
const SEMILLA = [
  { name: 'Consulta / diagnóstico inicial', category: 'Servicios', price: 15000, unit: '', published: true },
  { name: 'Mano de obra especializada', category: 'Servicios', price: 22000, unit: 'por hora', published: true },
  { name: 'Visita a domicilio', category: 'Servicios', price: 18000, unit: 'CABA y GBA', published: true },
  { name: 'Producto estándar', category: 'Productos', price: 35000, unit: 'por unidad', published: true },
  { name: 'Producto premium', category: 'Productos', price: 68000, unit: 'por unidad', published: true },
  { name: 'Repuesto original', category: 'Repuestos', price: 12500, unit: '', published: true },
];

module.exports = {
  id: 'listaprecios', type: 'functional', name: 'Lista de precios',
  description: 'Página pública /precios.html con la lista de precios agrupada por categoría, unidad opcional, buscador sin acentos que filtra en el servidor y leyenda "precios actualizados al…" real. Con auth activo, ABM solo-admin en /precios-admin.html con aumento masivo por porcentaje (toda la lista o una categoría). Colección pricelist. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/listaprecios', file: 'routes/listaprecios.js' }],
  collections: ['pricelist'],
  nav: (cfg) => {
    const links = [{ label: 'Precios', href: '/precios.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Precios (admin)', href: '/precios-admin.html', id: 'nav-precios-admin' });
    return links;
  },
  head: () => `  <style>
    .lp-search{max-width:420px;margin:0 0 10px}
    .lp-fecha{color:var(--muted);font-size:.85rem;margin:0 0 24px}
    .lp-cat{margin:0 0 30px}
    .lp-cat h3{margin:0 0 4px;font-size:1.35rem;color:var(--accent)}
    .lp-cat .lp-linea{height:2px;background:color-mix(in srgb,var(--accent) 30%,var(--line));border:0;margin:0 0 14px}
    .lp-item{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:10px 0;border-bottom:1px dashed var(--line)}
    .lp-item:last-child{border-bottom:0}
    .lp-item .lp-nom{flex:1}
    .lp-item .lp-uni{color:var(--muted);font-size:.85rem}
    .lp-item .lp-precio{font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
    .lp-empty{color:var(--muted)}
    .lp-badge{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--line)}
    .lp-badge.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
  </style>`,
  files: (cfg) => ({
    'routes/listaprecios.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Pliega acentos y mayúsculas para el buscador tolerante ("instalacion" → "Instalación")
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');

// Siembra ítems de ejemplo la primera vez para que /precios.html se vea desde el arranque
db.seedIfEmpty('pricelist', ${JSON.stringify(SEMILLA, null, 2)});

const validar = (data) => check(data, {
  name: (v) => str(v, 2, 120),
  category: (v) => str(v, 2, 60),
  price: (v) => num(v, 0, 1000000000),
});

// Última actualización real de la lista (la fecha más nueva entre alta y edición)
function ultimaFecha(rows) {
  let max = '';
  for (const r of rows) {
    const f = String(r.updatedAt || r.createdAt || '');
    if (f > max) max = f;
  }
  return max;
}

// Vista pública de un ítem
const publico = (p) => ({ id: p.id, name: p.name, category: p.category, price: p.price || 0, unit: p.unit || '' });

// GET /api/listaprecios — ítems publicados; ?q= filtra en el servidor sin distinguir acentos
router.get('/', async (req, res) => {
  let rows = (await db.all('pricelist')).filter(p => p.published !== false);
  const lastUpdate = ultimaFecha(rows);
  const q = fold(String(req.query.q || '').trim());
  if (q) rows = rows.filter(p => fold(p.name + ' ' + p.category + ' ' + (p.unit || '')).includes(q));
  res.json({ lastUpdate, items: rows.map(publico) });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/listaprecios/admin/list — todos los ítems (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  res.json(await db.all('pricelist'));
});

// POST /api/listaprecios/admin — crea un ítem (solo admin)
router.post('/admin', requireAdmin, async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const row = await db.insert('pricelist', {
    name: req.body.name.trim(),
    category: req.body.category.trim(),
    price: Math.round(req.body.price),
    unit: typeof req.body.unit === 'string' ? req.body.unit.trim().slice(0, 40) : '',
    published: req.body.published !== false,
    updatedAt: new Date().toISOString(),
  });
  res.status(201).json(row);
});

// PATCH /api/listaprecios/admin/:id — edita un ítem o lo publica/oculta (solo admin)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.name !== undefined) { if (!str(req.body.name, 2, 120)) return res.status(422).json({ error: 'Nombre inválido' }); patch.name = req.body.name.trim(); }
  if (req.body.category !== undefined) { if (!str(req.body.category, 2, 60)) return res.status(422).json({ error: 'Categoría inválida' }); patch.category = req.body.category.trim(); }
  if (req.body.price !== undefined) { if (!num(req.body.price, 0, 1000000000)) return res.status(422).json({ error: 'Precio inválido' }); patch.price = Math.round(req.body.price); }
  if (req.body.unit !== undefined) patch.unit = typeof req.body.unit === 'string' ? req.body.unit.trim().slice(0, 40) : '';
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  patch.updatedAt = new Date().toISOString();
  const row = await db.update('pricelist', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Ítem inexistente' });
  res.json(row);
});

// POST /api/listaprecios/admin/bulk — aumento (o baja) masiva por porcentaje (solo admin).
// Aplica a toda la lista o solo a una categoría; redondea a pesos enteros.
router.post('/admin/bulk', requireAdmin, async (req, res) => {
  const percent = Number(req.body.percent);
  if (!isFinite(percent) || percent < -90 || percent > 1000 || percent === 0) {
    return res.status(422).json({ error: 'Porcentaje inválido (entre -90 y 1000, distinto de 0)' });
  }
  const category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
  const rows = await db.all('pricelist');
  const tocados = rows.filter(p => !category || p.category === category);
  if (!tocados.length) return res.status(422).json({ error: 'No hay ítems en esa categoría' });
  const ahora = new Date().toISOString();
  for (const p of tocados) {
    await db.update('pricelist', p.id, { price: Math.max(0, Math.round((p.price || 0) * (1 + percent / 100))), updatedAt: ahora });
  }
  res.json({ updated: tocados.length, percent, category: category || null });
});

// DELETE /api/listaprecios/admin/:id — borra un ítem (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const p = await db.get('pricelist', req.params.id);
  if (!p) return res.status(404).json({ error: 'Ítem inexistente' });
  await db.remove('pricelist', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de la lista de precios (y el aumento masivo por porcentaje) requiere el módulo de
// autenticación: activalo en el Builder para habilitar /precios-admin.html. Sin él, editá
// data/pricelist.json a mano (la página pública muestra los ítems publicados igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      precios: {
        title: 'Precios',
        html: `  <section>
    <div class="container" style="max-width:760px">
      <h2>Lista de precios</h2>
      <p class="section-sub">Precios vigentes de nuestros productos y servicios. Ante cualquier duda, consultanos.</p>
      <input type="search" id="lp-search" class="lp-search" placeholder="Buscar en la lista… (ej: visita, repuesto)" aria-label="Buscar en la lista de precios">
      <p class="lp-fecha" id="lp-fecha"></p>
      <div id="lp-list"><p class="lp-empty">Cargando la lista de precios…</p></div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['precios-admin'] = {
        title: 'Precios',
        html: `  <section>
    <div class="container">
      <h2>Lista de precios</h2>
      <p class="section-sub">Administrá los ítems y aplicá aumentos masivos por porcentaje. Solo visible para administradores.</p>
      <div class="grid cols-2" style="gap:18px;align-items:start;margin-bottom:26px">
        <form id="lp-form" class="card">
          <input type="hidden" name="id" value="">
          <label>Nombre del ítem</label>
          <input name="name" required minlength="2" maxlength="120" placeholder="Ej: Mano de obra especializada">
          <div class="grid cols-2" style="gap:14px">
            <div><label>Categoría</label><input name="category" required minlength="2" maxlength="60" placeholder="Ej: Servicios" list="lp-cat-list"><datalist id="lp-cat-list"></datalist></div>
            <div><label>Precio ($)</label><input name="price" type="number" min="0" step="1" required placeholder="22000"></div>
          </div>
          <label>Unidad / aclaración (opcional)</label>
          <input name="unit" maxlength="40" placeholder="Ej: por hora, por kg, CABA y GBA">
          <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:12px"><input type="checkbox" name="published" checked style="width:auto"> Publicado en la lista</label>
          <div style="display:flex;gap:8px;margin-top:14px">
            <button class="btn" type="submit" id="lp-save">Guardar ítem</button>
            <button class="btn ghost" type="button" id="lp-cancel" hidden>Cancelar edición</button>
          </div>
        </form>
        <form id="lp-bulk" class="card">
          <h3 style="margin:0 0 4px">Aumento masivo</h3>
          <p class="muted" style="margin:0 0 10px;font-size:.9rem">Aplicá un porcentaje a toda la lista o a una categoría. Usá un número negativo para bajar precios.</p>
          <div class="grid cols-2" style="gap:14px">
            <div><label>Porcentaje (%)</label><input name="percent" type="number" min="-90" max="1000" step="0.1" required placeholder="15"></div>
            <div><label>Categoría</label><select name="category"><option value="">Toda la lista</option></select></div>
          </div>
          <p class="muted" style="margin:8px 0 0;font-size:.85rem" id="lp-bulk-aviso"></p>
          <button class="btn" type="submit" style="margin-top:12px">Aplicar aumento</button>
        </form>
      </div>
      <div id="lp-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo lista de precios: página pública /precios.html (categorías, buscador sin acentos en el
   server, "precios actualizados al…") y, con auth activo, el ABM con aumento masivo por
   porcentaje en /precios-admin.html. Animado con Anime.js + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEMO = [
    { id: 'd1', name: 'Consulta / diagnóstico inicial', category: 'Servicios', price: 15000, unit: '' },
    { id: 'd2', name: 'Mano de obra especializada', category: 'Servicios', price: 22000, unit: 'por hora' },
    { id: 'd3', name: 'Producto estándar', category: 'Productos', price: 35000, unit: 'por unidad' },
    { id: 'd4', name: 'Repuesto original', category: 'Repuestos', price: 12500, unit: '' },
  ];

  function fechaLinda(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ---- Página pública /precios.html ----
  var list = document.getElementById('lp-list');
  var search = document.getElementById('lp-search');
  var fechaEl = document.getElementById('lp-fecha');
  if (list) {
    function render(items) {
      if (!items.length) { list.innerHTML = '<p class="lp-empty">No encontramos ítems para tu búsqueda.</p>'; return; }
      var porCat = {};
      items.forEach(function (p) { (porCat[p.category] = porCat[p.category] || []).push(p); });
      var html = '';
      Object.keys(porCat).sort(function (a, b) { return a.localeCompare(b, 'es'); }).forEach(function (cat) {
        html += '<div class="lp-cat"><h3>' + App.esc(cat) + '</h3><hr class="lp-linea">';
        porCat[cat].forEach(function (p) {
          html += '<div class="lp-item"><span class="lp-nom">' + App.esc(p.name) +
            (p.unit ? ' <span class="lp-uni">(' + App.esc(p.unit) + ')</span>' : '') +
            '</span><span class="lp-precio">' + App.money(p.price) + '</span></div>';
        });
        html += '</div>';
      });
      list.innerHTML = html;
      var cats = [].slice.call(list.querySelectorAll('.lp-cat'));
      var anime = window.anime;
      if (anime && anime.animate && !reduce && cats.length) {
        anime.animate(cats, { opacity: [0, 1], translateY: [14, 0], duration: 450, delay: anime.stagger ? anime.stagger(70) : 0, ease: 'outCubic' });
        // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
        setTimeout(function () { cats.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 800);
      }
    }
    function cargar(q) {
      if (window.__PREVIEW__) {
        var f = (q || '').toLowerCase();
        if (fechaEl) fechaEl.textContent = 'Precios actualizados al ' + fechaLinda(new Date().toISOString());
        render(DEMO.filter(function (p) { return !f || (p.name + p.category).toLowerCase().indexOf(f) >= 0; }));
        return;
      }
      fetch('/api/listaprecios' + (q ? '?q=' + encodeURIComponent(q) : '')).then(function (r) { return r.json(); }).then(function (d) {
        if (fechaEl && d.lastUpdate) fechaEl.textContent = 'Precios actualizados al ' + fechaLinda(d.lastUpdate);
        render(d.items || []);
      }).catch(function () { list.innerHTML = '<p class="lp-empty">No se pudo cargar la lista de precios.</p>'; });
    }
    if (search) { var t; search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { cargar(search.value.trim()); }, 250); }); }
    cargar('');
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM /precios-admin.html ----
  var adminBox = document.getElementById('lp-admin');
  var formL = document.getElementById('lp-form');
  var formBulk = document.getElementById('lp-bulk');
  if (adminBox && formL) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var items = [];
    var idInput = formL.querySelector('[name="id"]');
    var saveBtn = document.getElementById('lp-save');
    var cancelBtn = document.getElementById('lp-cancel');
    var datalist = document.getElementById('lp-cat-list');
    var bulkCat = formBulk ? formBulk.querySelector('[name="category"]') : null;
    var bulkAviso = document.getElementById('lp-bulk-aviso');

    function categorias() {
      var cats = {};
      items.forEach(function (p) { if (p.category) cats[p.category] = (cats[p.category] || 0) + 1; });
      return cats;
    }
    function refrescarCats() {
      var cats = categorias();
      if (datalist) datalist.innerHTML = Object.keys(cats).map(function (c) { return '<option value="' + App.esc(c) + '">'; }).join('');
      if (bulkCat) {
        var actual = bulkCat.value;
        bulkCat.innerHTML = '<option value="">Toda la lista (' + items.length + ' ítems)</option>' +
          Object.keys(cats).sort().map(function (c) { return '<option value="' + App.esc(c) + '">' + App.esc(c) + ' (' + cats[c] + ')</option>'; }).join('');
        bulkCat.value = actual;
      }
    }

    function pintar() {
      adminBox.innerHTML = App.table(items, [
        { key: 'name', label: 'Ítem' },
        { label: 'Categoría', render: function (r) { return '<span class="lp-badge">' + App.esc(r.category) + '</span>'; } },
        { label: 'Precio', render: function (r) { return '<span data-precio="' + r.id + '">' + App.money(r.price) + '</span>'; } },
        { label: 'Unidad', render: function (r) { return r.unit ? App.esc(r.unit) : '<span class="muted">—</span>'; } },
        { label: 'Estado', render: function (r) { return r.published !== false ? '<span class="lp-badge on">Publicado</span>' : '<span class="lp-badge">Oculto</span>'; } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-pub="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.published === false ? 'Publicar' : 'Ocultar') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      adminBox.querySelectorAll('[data-pub]').forEach(function (b) { b.addEventListener('click', function () { alternar(b.getAttribute('data-pub')); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
      refrescarCats();
    }

    function resetForm() {
      formL.reset(); idInput.value = '';
      formL.querySelector('[name="published"]').checked = true;
      saveBtn.textContent = 'Guardar ítem';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var p = items.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      idInput.value = p.id;
      ['name', 'category', 'price', 'unit'].forEach(function (k) { formL.querySelector('[name="' + k + '"]').value = p[k] !== undefined ? p[k] : ''; });
      formL.querySelector('[name="published"]').checked = p.published !== false;
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formL.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function alternar(id) {
      var p = items.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
      try {
        var upd = await App.api('/api/listaprecios/admin/' + id, { method: 'PATCH', body: { published: p.published === false } });
        items = items.map(function (r) { return r.id === id ? upd : r; });
        pintar();
        App.toast(upd.published !== false ? 'Ítem publicado' : 'Ítem oculto');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría el ítem'); return; }
      if (!confirm('¿Borrar este ítem de la lista?')) return;
      try {
        await App.api('/api/listaprecios/admin/' + id, { method: 'DELETE' });
        items = items.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Ítem borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formL.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        name: formL.querySelector('[name="name"]').value,
        category: formL.querySelector('[name="category"]').value,
        price: Number(formL.querySelector('[name="price"]').value),
        unit: formL.querySelector('[name="unit"]').value,
        published: formL.querySelector('[name="published"]').checked,
      };
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'crearía') + ' el ítem'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/listaprecios/admin/' + editando, { method: 'PATCH', body: datos });
          items = items.map(function (r) { return r.id === editando ? upd : r; });
          App.toast('Cambios guardados');
        } else {
          var nuevo = await App.api('/api/listaprecios/admin', { method: 'POST', body: datos });
          items.push(nuevo);
          App.toast('Ítem agregado');
        }
        resetForm();
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    // Aviso en vivo de cuántos ítems tocaría el aumento masivo
    function avisoBulk() {
      if (!formBulk || !bulkAviso) return;
      var pct = Number(formBulk.querySelector('[name="percent"]').value);
      var cat = bulkCat ? bulkCat.value : '';
      var n = cat ? (categorias()[cat] || 0) : items.length;
      bulkAviso.textContent = isFinite(pct) && pct !== 0 && n
        ? 'Se van a actualizar ' + n + (n === 1 ? ' ítem' : ' ítems') + (cat ? ' de ' + cat : '') + ' un ' + pct + '%.'
        : '';
    }
    if (formBulk) {
      formBulk.querySelector('[name="percent"]').addEventListener('input', avisoBulk);
      if (bulkCat) bulkCat.addEventListener('change', avisoBulk);
      formBulk.addEventListener('submit', async function (e) {
        e.preventDefault();
        var pct = Number(formBulk.querySelector('[name="percent"]').value);
        var cat = bulkCat ? bulkCat.value : '';
        if (window.__PREVIEW__) { App.toast('Vista previa: se aplicaría el aumento'); return; }
        if (!confirm('¿Aplicar ' + pct + '% a ' + (cat || 'toda la lista') + '? Esta acción cambia los precios de una.')) return;
        try {
          var viejos = {};
          items.forEach(function (p) { viejos[p.id] = p.price; });
          var r = await App.api('/api/listaprecios/admin/bulk', { method: 'POST', body: { percent: pct, category: cat } });
          var rows = await App.api('/api/listaprecios/admin/list');
          items = rows; pintar();
          App.toast('Se actualizaron ' + r.updated + ' precios');
          // Count-up de los precios que cambiaron: del valor viejo al nuevo, con red de seguridad
          var anime = window.anime;
          items.forEach(function (p) {
            var el = adminBox.querySelector('[data-precio="' + p.id + '"]');
            if (!el || viejos[p.id] === undefined || viejos[p.id] === p.price) return;
            if (anime && anime.animate && !reduce) {
              var obj = { v: viejos[p.id] };
              anime.animate(obj, { v: p.price, duration: 800, ease: 'outCubic', onUpdate: function () { el.textContent = App.money(Math.round(obj.v)); } });
            }
            setTimeout(function () { el.textContent = App.money(p.price); }, 1000);
          });
          formBulk.reset(); avisoBulk();
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    }

    if (window.__PREVIEW__) {
      items = [
        { id: 'd1', name: 'Mano de obra especializada', category: 'Servicios', price: 22000, unit: 'por hora', published: true },
        { id: 'd2', name: 'Producto estándar', category: 'Productos', price: 35000, unit: 'por unidad', published: false },
      ];
      pintar();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/listaprecios/admin/list').then(function (rows) { items = rows; pintar(); }).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navL = document.getElementById('nav-precios-admin');
    if (navL && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navL.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Lista de precios**: los ítems viven en la colección \`pricelist\` y se muestran en \`/precios.html\` agrupados por categoría, con unidad opcional, buscador sin acentos (filtra en el servidor) y la leyenda "precios actualizados al…" calculada con la última modificación real. ${cfg.moduleIds.includes('auth') ? 'Los administradores los gestionan en \`/precios-admin.html\`, que además permite el **aumento masivo por porcentaje** (toda la lista o una categoría, con números negativos para bajar precios).' : 'Para administrarlos desde la web (incluido el aumento masivo por porcentaje) activá el módulo **Autenticación** (habilita \`/precios-admin.html\`); sin él, editá \`data/pricelist.json\` a mano.'} Se siembran ítems de ejemplo: reemplazalos por los tuyos.`,
  ],
};
