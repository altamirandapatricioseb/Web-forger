// Cotizador de costo de envío por zona: una sección pública en la Home donde el visitante elige su
// provincia (y opcionalmente ingresa su código postal) y el servidor le devuelve el costo y el
// plazo estimado del envío, buscando la zona que corresponde a esa provincia (colección
// shippingzones). Cada zona puede tener envío gratis a partir de cierto monto de compra. Con el
// módulo de autenticación activo, /envios-admin.html es un ABM solo-admin para crear, editar y
// borrar zonas (nombre, provincias que abarca, costo, días y umbral de envío gratis). Se siembran
// tres zonas de ejemplo la primera vez para que el cotizador funcione desde el arranque, incluso
// sin auth. El resultado (costo) se anima con un count-up de Anime.js (red de seguridad + respeta
// "prefers-reduced-motion"). Es una pieza clásica de cualquier tienda online y no existía en el
// catálogo. Distinto de "branches" (sucursales físicas) y de "map" (ubicación en el mapa).

// Provincias de Argentina (constante del cliente y del servidor; ajustá la lista si operás en
// otro país). El cotizador ofrece estas opciones y cada zona declara qué provincias abarca.
const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

// Zonas de ejemplo (se siembran la primera vez; el negocio las edita desde el ABM).
const SEMILLA = [
  { name: 'CABA y GBA', provinces: ['CABA', 'Buenos Aires'], cost: 2500, days: 2, freeFrom: 40000 },
  { name: 'Centro', provinces: ['Córdoba', 'Santa Fe', 'Entre Ríos', 'La Pampa', 'Mendoza', 'San Luis'], cost: 4200, days: 4, freeFrom: 60000 },
  { name: 'Resto del país', provinces: ['Catamarca', 'Chaco', 'Chubut', 'Corrientes', 'Formosa', 'Jujuy', 'La Rioja', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'Santa Cruz', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'], cost: 6800, days: 7, freeFrom: 90000 },
];

module.exports = {
  id: 'shipping', type: 'functional', name: 'Cotizador de envío',
  description: 'Sección "¿Cuánto cuesta el envío?": el visitante elige su provincia y el servidor devuelve costo y plazo estimado según la zona (colección shippingzones), con envío gratis opcional por monto. Costo animado con Anime.js. Con auth activo, ABM solo-admin de zonas en /envios-admin.html.',
  usesAnime: true,
  mounts: [{ route: '/api/shipping', file: 'routes/shipping.js' }],
  collections: ['shippingzones'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Envíos', href: '/envios-admin.html', id: 'nav-envios-admin' }] : [],
  html: () => `  <section id="cotizar-envio">
    <div class="container" style="max-width:640px">
      <h2>¿Cuánto cuesta el envío?</h2>
      <p class="section-sub">Elegí tu provincia y te decimos el costo y en cuántos días llega.</p>
      <form id="sh-form" class="card">
        <label for="sh-prov">Provincia de destino</label>
        <select name="province" id="sh-prov" required></select>
        <label for="sh-cp">Código postal (opcional)</label>
        <input name="postal" id="sh-cp" maxlength="8" inputmode="numeric" placeholder="Ej: 1425">
        <button class="btn" type="submit" style="margin-top:12px">Calcular envío</button>
      </form>
      <div id="sh-result" hidden></div>
      <noscript><p class="muted">Activá JavaScript para calcular el costo de envío.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    #sh-result{margin-top:16px;background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:0 var(--radius) var(--radius) 0;padding:18px 20px}
    #sh-result h3{margin:0 0 6px}
    .sh-costo{font-size:1.9rem;font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums;line-height:1}
    .sh-costo.free{color:var(--accent)}
    .sh-plazo{color:var(--muted);margin:8px 0 0;font-size:.92rem}
    .sh-free-hint{margin:10px 0 0;font-size:.85rem;color:var(--muted)}
    .sh-zona{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;background:color-mix(in srgb,var(--accent) 18%,var(--surface));color:var(--accent);vertical-align:baseline;margin-left:6px}
  </style>`,
  files: (cfg) => ({
    'routes/shipping.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num, oneOf } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Provincias válidas (deben coincidir con las que ofrece el cotizador en el frontend)
const PROVINCIAS = ${JSON.stringify(PROVINCIAS)};

// Siembra zonas de ejemplo la primera vez para que el cotizador funcione desde el arranque
db.seedIfEmpty('shippingzones', ${JSON.stringify(SEMILLA, null, 2)});

const validarZona = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  cost: (v) => num(v, 0, 10000000),
  days: (v) => num(v, 0, 365),
});

// Normaliza la lista de provincias que abarca una zona (solo provincias válidas, sin repetidos)
function limpiarProvincias(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter(p => PROVINCIAS.includes(p)))];
}

// GET /api/shipping/quote?province=... — costo y plazo del envío a esa provincia (público)
router.get('/quote', async (req, res) => {
  const province = String(req.query.province || '').trim();
  if (!oneOf(province, PROVINCIAS)) return res.status(422).json({ error: 'Provincia inválida', errors: { province: 'Elegí una provincia de la lista' } });
  const zonas = await db.all('shippingzones');
  const zona = zonas.find(z => Array.isArray(z.provinces) && z.provinces.includes(province));
  if (!zona) return res.status(404).json({ error: 'Todavía no tenemos configurado el envío a esa provincia. Escribinos y lo coordinamos.' });
  res.json({ zone: zona.name, cost: zona.cost, days: zona.days, freeFrom: zona.freeFrom || 0, province });
});

// GET /api/shipping/provinces — provincias disponibles (para el desplegable del cotizador)
router.get('/provinces', (req, res) => res.json(PROVINCIAS));
${cfg.moduleIds.includes('auth') ? `
// GET /api/shipping — todas las zonas (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  res.json(await db.all('shippingzones'));
});

// POST /api/shipping — crea una zona (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = validarZona(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const row = await db.insert('shippingzones', {
    name: req.body.name.trim(),
    provinces: limpiarProvincias(req.body.provinces),
    cost: Math.round(req.body.cost),
    days: Math.round(req.body.days),
    freeFrom: num(req.body.freeFrom, 0, 100000000) ? Math.round(req.body.freeFrom) : 0,
  });
  res.status(201).json(row);
});

// PATCH /api/shipping/:id — edita una zona (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.name !== undefined) { if (!str(req.body.name, 2, 80)) return res.status(422).json({ error: 'Nombre inválido' }); patch.name = req.body.name.trim(); }
  if (req.body.provinces !== undefined) patch.provinces = limpiarProvincias(req.body.provinces);
  if (req.body.cost !== undefined) { if (!num(req.body.cost, 0, 10000000)) return res.status(422).json({ error: 'Costo inválido' }); patch.cost = Math.round(req.body.cost); }
  if (req.body.days !== undefined) { if (!num(req.body.days, 0, 365)) return res.status(422).json({ error: 'Plazo inválido' }); patch.days = Math.round(req.body.days); }
  if (req.body.freeFrom !== undefined) patch.freeFrom = num(req.body.freeFrom, 0, 100000000) ? Math.round(req.body.freeFrom) : 0;
  const row = await db.update('shippingzones', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Zona inexistente' });
  res.json(row);
});

// DELETE /api/shipping/:id — borra una zona (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const z = await db.get('shippingzones', req.params.id);
  if (!z) return res.status(404).json({ error: 'Zona inexistente' });
  await db.remove('shippingzones', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de zonas de envío (crear, editar, borrar) requiere el módulo de autenticación:
// activalo en el Builder para habilitar /envios-admin.html. Sin él, se usan las zonas sembradas
// y podés editarlas a mano en data/shippingzones.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'envios-admin': {
      title: 'Zonas de envío',
      html: `  <section>
    <div class="container">
      <h2>Zonas de envío</h2>
      <p class="section-sub">Definí cuánto cuesta y en cuántos días llega el envío según la provincia. Solo visible para administradores.</p>
      <form id="sh-zform" class="card" style="max-width:680px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <label>Nombre de la zona</label>
        <input name="name" required minlength="2" maxlength="80" placeholder="Ej: CABA y GBA">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Costo del envío ($)</label><input name="cost" type="number" min="0" step="1" required placeholder="2500"></div>
          <div><label>Plazo (días hábiles)</label><input name="days" type="number" min="0" step="1" required placeholder="3"></div>
        </div>
        <label>Envío gratis a partir de ($, opcional — 0 para desactivar)</label>
        <input name="freeFrom" type="number" min="0" step="1" placeholder="40000">
        <label>Provincias que abarca esta zona</label>
        <div id="sh-provs" class="sh-provs"></div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn" type="submit" id="sh-zsave">Guardar zona</button>
          <button class="btn ghost" type="button" id="sh-zcancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="sh-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo cotizador de envío: sección pública en la Home (elegir provincia → costo + plazo con
   count-up de Anime.js) y, con auth activo, el ABM de zonas en /envios-admin.html.
   En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PROVINCIAS = ${JSON.stringify(PROVINCIAS)};

  function contar(el, hasta, prefijo) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = prefijo + Number(hasta).toLocaleString('es-AR'); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 650, ease: 'outCubic', onUpdate: function () { el.textContent = prefijo + Math.round(st.v).toLocaleString('es-AR'); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = prefijo + Number(hasta).toLocaleString('es-AR'); }, 850);
  }

  // ---- Sección pública (Home) ----
  var form = document.getElementById('sh-form');
  if (form) {
    var prov = document.getElementById('sh-prov');
    if (prov) prov.innerHTML = '<option value="">Elegí tu provincia…</option>' + PROVINCIAS.map(function (p) { return '<option value="' + App.esc(p) + '">' + App.esc(p) + '</option>'; }).join('');
    var result = document.getElementById('sh-result');

    function mostrar(r) {
      if (!result) return;
      result.hidden = false;
      var gratis = r.freeFrom && r.freeFrom > 0;
      result.innerHTML = '<h3>Envío a ' + App.esc(r.province) + '<span class="sh-zona">' + App.esc(r.zone) + '</span></h3>' +
        (r.cost === 0
          ? '<p class="sh-costo free">¡Gratis!</p>'
          : '<p class="sh-costo" id="sh-costo">$0</p>') +
        '<p class="sh-plazo">Llega en aproximadamente <strong>' + r.days + (r.days === 1 ? ' día hábil' : ' días hábiles') + '</strong>.</p>' +
        (gratis ? '<p class="sh-free-hint">Tenés <strong>envío gratis</strong> en compras desde ' + App.money(r.freeFrom) + '.</p>' : '');
      if (r.cost > 0) contar(document.getElementById('sh-costo'), r.cost, '$');
      var anime = window.anime;
      if (anime && anime.animate && !reduce) anime.animate(result, { opacity: [0, 1], translateY: [10, 0], duration: 400, ease: 'outCubic' });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var province = prov ? prov.value : '';
      if (!province) { App.toast('Elegí tu provincia'); return; }
      if (window.__PREVIEW__) {
        mostrar({ province: province, zone: 'CABA y GBA', cost: 2500, days: 2, freeFrom: 40000 });
        return;
      }
      try { mostrar(await App.api('/api/shipping/quote?province=' + encodeURIComponent(province))); }
      catch (err) {
        if (err.message !== 'preview' && result) { result.hidden = false; result.innerHTML = '<p class="muted" style="margin:0">' + App.esc(err.message) + '</p>'; }
      }
    });
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM /envios-admin.html ----
  var adminBox = document.getElementById('sh-admin');
  var formZ = document.getElementById('sh-zform');
  if (adminBox && formZ) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var zonas = [];
    var idInput = formZ.querySelector('[name="id"]');
    var cancelBtn = document.getElementById('sh-zcancel');
    var saveBtn = document.getElementById('sh-zsave');
    var provsBox = document.getElementById('sh-provs');

    // Casilleros de provincias (una por provincia): la zona abarca las tildadas
    if (provsBox) provsBox.innerHTML = PROVINCIAS.map(function (p) {
      return '<label style="display:inline-flex;align-items:center;gap:6px;font-weight:400;margin:0 12px 8px 0"><input type="checkbox" value="' + App.esc(p) + '" style="width:auto"> ' + App.esc(p) + '</label>';
    }).join('');
    function provsSeleccionadas() { return [].slice.call(provsBox.querySelectorAll('input:checked')).map(function (c) { return c.value; }); }
    function marcarProvs(lista) { provsBox.querySelectorAll('input').forEach(function (c) { c.checked = (lista || []).indexOf(c.value) >= 0; }); }

    function pintar() {
      adminBox.innerHTML = App.table(zonas, [
        { key: 'name', label: 'Zona' },
        { label: 'Provincias', render: function (r) { return '<span class="muted" style="font-size:.85rem">' + App.esc((r.provinces || []).join(', ') || '—') + '</span>'; } },
        { label: 'Costo', render: function (r) { return App.money(r.cost); } },
        { label: 'Plazo', render: function (r) { return (r.days || 0) + ' días'; } },
        { label: 'Envío gratis', render: function (r) { return r.freeFrom ? 'desde ' + App.money(r.freeFrom) : '<span class="muted">—</span>'; } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
    }

    function resetForm() {
      formZ.reset(); idInput.value = ''; marcarProvs([]);
      saveBtn.textContent = 'Guardar zona';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var z = zonas.filter(function (r) { return r.id === id; })[0];
      if (!z) return;
      idInput.value = z.id;
      formZ.querySelector('[name="name"]').value = z.name;
      formZ.querySelector('[name="cost"]').value = z.cost;
      formZ.querySelector('[name="days"]').value = z.days;
      formZ.querySelector('[name="freeFrom"]').value = z.freeFrom || 0;
      marcarProvs(z.provinces);
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formZ.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría la zona'); return; }
      if (!confirm('¿Borrar esta zona de envío?')) return;
      try {
        await App.api('/api/shipping/' + id, { method: 'DELETE' });
        zonas = zonas.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Zona borrada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formZ.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        name: formZ.querySelector('[name="name"]').value,
        cost: Number(formZ.querySelector('[name="cost"]').value),
        days: Number(formZ.querySelector('[name="days"]').value),
        freeFrom: Number(formZ.querySelector('[name="freeFrom"]').value || 0),
        provinces: provsSeleccionadas(),
      };
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'crearía') + ' la zona'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/shipping/' + editando, { method: 'PATCH', body: datos });
          zonas = zonas.map(function (r) { return r.id === editando ? upd : r; });
          App.toast('Cambios guardados');
        } else {
          var nueva = await App.api('/api/shipping', { method: 'POST', body: datos });
          zonas.push(nueva);
          App.toast('Zona creada');
        }
        resetForm();
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function listo(rows) { zonas = rows; pintar(); }
    if (window.__PREVIEW__) {
      listo([
        { id: 'd1', name: 'CABA y GBA', provinces: ['CABA', 'Buenos Aires'], cost: 2500, days: 2, freeFrom: 40000 },
        { id: 'd2', name: 'Resto del país', provinces: ['Córdoba', 'Salta'], cost: 6800, days: 7, freeFrom: 0 },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/shipping').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navE = document.getElementById('nav-envios-admin');
    if (navE && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navE.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Cotizador de envío**: las zonas viven en la colección \`shippingzones\` (nombre, provincias que abarca, costo, días y umbral de envío gratis). El visitante elige su provincia en la Home y el servidor devuelve el costo y el plazo. Se siembran tres zonas de ejemplo la primera vez. ${cfg.moduleIds.includes('auth') ? 'Los administradores crean, editan y borran zonas en \`/envios-admin.html\`.' : 'Para administrar las zonas desde la web activá el módulo **Autenticación** (habilita \`/envios-admin.html\`); sin él, editá \`data/shippingzones.json\` a mano.'} La lista de provincias es de Argentina: si operás en otro país, editá la constante \`PROVINCIAS\` en \`routes/shipping.js\`.`,
  ],
};
