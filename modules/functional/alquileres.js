// Alquileres por día con backend real: página pública /alquileres.html con los espacios/recursos
// publicados traídos del servidor (colección rentitems) — cabañas, salones, quinchos, canchas,
// equipos — cada uno con su precio por día y capacidad. El visitante elige el recurso y un rango
// de fechas (desde/hasta) y el SERVIDOR controla el solapamiento contra las reservas activas: si
// otro se lo llevó en el medio responde 409 y la reserva no se pisa jamás. El total se calcula
// SIEMPRE en el servidor (días × precio del recurso, nunca lo que diga el navegador) y se devuelve
// un código AL-XXXXXX. Las fechas ya ocupadas de cada recurso se muestran antes de reservar. Con
// auth activo, /alquileres-admin.html es el panel solo-admin: ABM de recursos (publicar/ocultar,
// borrar arrastra sus reservas) y bandeja de reservas (confirmar / cancelar — cancelar libera las
// fechas — / borrar). Se siembran 2 recursos. Animado con Anime.js (stagger, count-up del total)
// + red de seguridad. Distinto de "agenda" (turnos por hora con profesional), "reservamesa" (cupo
// de personas por franja) y "bookings" (turno genérico): acá se reserva un recurso completo por
// rango de días. Completa el vertical de hospedaje/alquiler de espacios.

// Recursos de ejemplo (editables desde el panel admin con auth activo)
const SEMILLA = [
  { name: 'Cabaña Aires del Bosque', detail: 'Cabaña equipada para 4 personas con parrilla, cocina completa y vista al bosque. Ropa de cama incluida.', price: 85000, capacity: 4, published: true },
  { name: 'Salón de eventos El Encuentro', detail: 'Salón climatizado para eventos de hasta 80 personas, con cocina industrial, mesas, sillas y estacionamiento propio.', price: 120000, capacity: 80, published: true },
];

module.exports = {
  id: 'alquileres', type: 'functional', name: 'Alquileres por día',
  description: 'Página /alquileres.html con los espacios/recursos publicados (cabañas, salones, canchas, equipos) servidos desde el backend: el visitante elige un rango de fechas y el servidor controla el solapamiento contra las reservas activas (409 si se ocupó) y calcula el total (días × precio), devolviendo un código de reserva. Con auth activo, panel solo-admin con ABM de recursos y bandeja de reservas (cancelar libera las fechas). Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/alquileres', file: 'routes/alquileres.js' }],
  collections: ['rentitems', 'rentbookings'],
  nav: (cfg) => {
    const links = [{ label: 'Alquileres', href: '/alquileres.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Alquileres (admin)', href: '/alquileres-admin.html', id: 'nav-alquileres-admin' });
    return links;
  },
  head: () => `  <style>
    .rq-card{display:flex;flex-direction:column;gap:8px;cursor:pointer;border:2px solid transparent}
    .rq-card.sel{border-color:var(--accent)}
    .rq-card h3{margin:0;font-size:1.05rem}
    .rq-card p{margin:0;color:var(--muted);font-size:.9rem;flex:1}
    .rq-precio{font-weight:800;color:var(--accent);font-size:1.05rem}
    .rq-cap{font-size:.8rem;color:var(--muted)}
    .rq-ocupadas{font-size:.82rem;color:var(--muted);margin:10px 0 0}
    .rq-ocupadas strong{color:var(--text)}
    .rq-total{border-left:3px solid var(--accent);padding:10px 14px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0;margin:14px 0;font-size:.95rem}
    .rq-total strong{font-variant-numeric:tabular-nums}
    .rq-ok{border-left:3px solid var(--accent);padding:14px 18px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0}
    .rq-ok code{font-size:1.15rem;font-weight:800;color:var(--accent)}
  </style>`,
  files: (cfg) => ({
    'routes/alquileres.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
// Siembra dos recursos de ejemplo la primera vez (editalos desde el panel admin)
db.seedIfEmpty('rentitems', ${JSON.stringify(SEMILLA, null, 2)});

// Fecha en formato AAAA-MM-DD (comparable como texto)
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;
const hoy = () => new Date().toISOString().slice(0, 10);

// Cantidad de días de un rango INCLUSIVO (desde y hasta cuentan): 2026-08-01 → 2026-08-03 = 3 días
const dias = (from, until) => Math.round((Date.parse(until) - Date.parse(from)) / 86400000) + 1;

// ¿La reserva sigue ocupando fechas? (las canceladas liberan su rango)
const activa = (b) => b.status !== 'cancelada';

// ¿Dos rangos inclusivos se pisan?
const sePisan = (b, from, until) => !(b.until < from || b.from > until);

// Vista pública de un recurso (sin campos internos)
const publico = (r) => ({ id: r.id, name: r.name, detail: r.detail, price: r.price, capacity: r.capacity || 0 });

// GET /api/alquileres — recursos publicados (público)
router.get('/', async (req, res) => {
  res.json((await db.all('rentitems')).filter(r => r.published !== false).map(publico));
});

// GET /api/alquileres/:id/ocupadas — próximos rangos ya reservados del recurso (público,
// sin datos personales: solo fechas, para que el visitante no elija un rango perdido)
router.get('/:id/ocupadas', async (req, res) => {
  const item = await db.get('rentitems', req.params.id);
  if (!item || item.published === false) return res.status(404).json({ error: 'Recurso inexistente' });
  const d = hoy();
  const rangos = (await db.find('rentbookings', b => b.itemId === item.id && activa(b) && b.until >= d))
    .map(b => ({ from: b.from, until: b.until }))
    .sort((a, b) => a.from.localeCompare(b.from));
  res.json(rangos);
});

// POST /api/alquileres/reservar — reserva un rango de fechas si sigue libre (público)
router.post('/reservar', async (req, res) => {
  const { ok, errors } = check(req.body, {
    itemId: (v) => str(v, 1, 60),
    name: (v) => str(v, 2, 80),
    phone: (v) => str(v, 6, 30),
    from: (v) => typeof v === 'string' && FECHA.test(v),
    until: (v) => typeof v === 'string' && FECHA.test(v),
  });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const item = await db.get('rentitems', req.body.itemId);
  if (!item || item.published === false) return res.status(404).json({ error: 'Ese recurso ya no está disponible' });
  const { from, until } = req.body;
  if (from < hoy()) return res.status(422).json({ error: 'La fecha de inicio ya pasó', errors: { from: 'Fecha pasada' } });
  if (until < from) return res.status(422).json({ error: 'La fecha "hasta" no puede ser anterior a "desde"', errors: { until: 'Rango inválido' } });
  if (dias(from, until) > 60) return res.status(422).json({ error: 'El rango máximo de reserva es de 60 días', errors: { until: 'Rango demasiado largo' } });
  // Control de solapamiento REAL en el servidor: nunca se confía en lo que pintó el navegador,
  // otro visitante pudo haber reservado el mismo rango en el medio
  const choque = (await db.find('rentbookings', b => b.itemId === item.id && activa(b) && sePisan(b, from, until)))[0];
  if (choque) return res.status(409).json({ error: 'Esas fechas se acaban de ocupar. Elegí otro rango.', busy: { from: choque.from, until: choque.until } });
  const total = dias(from, until) * (item.price || 0);
  const code = 'AL-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const row = await db.insert('rentbookings', {
    itemId: item.id,
    name: req.body.name.trim(),
    phone: req.body.phone.trim(),
    from, until,
    days: dias(from, until),
    total,
    status: 'pendiente',
    code,
  });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): entró una reserva de alquiler.
  // Es "disparar y seguir": un email caído jamás rompe la reserva.
  mailer.notify('Nueva reserva de alquiler: ' + item.name, req.body.name.trim() + ' reservó "' + item.name + '" del ' + from + ' al ' + until + ' (' + row.days + (row.days === 1 ? ' día' : ' días') + ', total $' + total.toLocaleString('es-AR') + '). Teléfono: ' + req.body.phone.trim() + '. Código: ' + code + '.').catch(() => {});
` : ''}  res.status(201).json({ code: row.code, item: item.name, from, until, days: row.days, total, status: row.status });
});
${cfg.moduleIds.includes('auth') ? `
const validarItem = (data) => check(data, {
  name: (v) => str(v, 3, 90),
  detail: (v) => str(v, 10, 500),
  price: (v) => num(v, 0, 100000000),
});

// GET /api/alquileres/admin/items — todos los recursos, también los ocultos (solo admin)
router.get('/admin/items', requireAdmin, async (req, res) => {
  const items = await db.all('rentitems');
  const reservas = await db.all('rentbookings');
  res.json(items.map(i => ({ ...i, bookings: reservas.filter(b => b.itemId === i.id && activa(b)).length })));
});

// POST /api/alquileres/admin/items — alta de recurso (solo admin)
router.post('/admin/items', requireAdmin, async (req, res) => {
  const { ok, errors } = validarItem(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const row = await db.insert('rentitems', {
    name: req.body.name.trim(),
    detail: req.body.detail.trim(),
    price: req.body.price,
    capacity: num(req.body.capacity, 0, 100000) ? Math.round(req.body.capacity) : 0,
    published: req.body.published !== false,
  });
  res.status(201).json({ ...row, bookings: 0 });
});

// PATCH /api/alquileres/admin/items/:id — edita, publica u oculta un recurso (solo admin)
router.patch('/admin/items/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.name !== undefined) { if (!str(req.body.name, 3, 90)) return res.status(422).json({ error: 'Nombre inválido' }); patch.name = req.body.name.trim(); }
  if (req.body.detail !== undefined) { if (!str(req.body.detail, 10, 500)) return res.status(422).json({ error: 'Descripción inválida (mínimo 10 caracteres)' }); patch.detail = req.body.detail.trim(); }
  if (req.body.price !== undefined) { if (!num(req.body.price, 0, 100000000)) return res.status(422).json({ error: 'Precio inválido' }); patch.price = req.body.price; }
  if (req.body.capacity !== undefined) { if (!num(req.body.capacity, 0, 100000)) return res.status(422).json({ error: 'Capacidad inválida' }); patch.capacity = Math.round(req.body.capacity); }
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  const row = await db.update('rentitems', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Recurso inexistente' });
  res.json(row);
});

// DELETE /api/alquileres/admin/items/:id — borra un recurso Y sus reservas (solo admin)
router.delete('/admin/items/:id', requireAdmin, async (req, res) => {
  const item = await db.get('rentitems', req.params.id);
  if (!item) return res.status(404).json({ error: 'Recurso inexistente' });
  // Borrado en cascada: las reservas de un recurso borrado no tienen a qué apuntar
  for (const b of await db.find('rentbookings', x => x.itemId === item.id)) await db.remove('rentbookings', b.id);
  await db.remove('rentitems', req.params.id);
  res.json({ ok: true });
});

// GET /api/alquileres/admin/list — reservas con el nombre del recurso, más recientes primero (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  const items = await db.all('rentitems');
  let rows = await db.all('rentbookings');
  if (req.query.status && ['pendiente', 'confirmada', 'cancelada'].includes(req.query.status)) {
    rows = rows.filter(b => b.status === req.query.status);
  }
  res.json(rows.slice(-200).reverse().map(b => ({ ...b, itemName: (items.find(i => i.id === b.itemId) || {}).name || '(recurso borrado)' })));
});

// PATCH /api/alquileres/admin/:id — confirma o cancela una reserva (cancelar libera las fechas) (solo admin)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  if (!['pendiente', 'confirmada', 'cancelada'].includes(req.body.status)) return res.status(422).json({ error: 'Estado inválido' });
  const row = await db.update('rentbookings', req.params.id, { status: req.body.status });
  if (!row) return res.status(404).json({ error: 'Reserva inexistente' });
  res.json(row);
});

// DELETE /api/alquileres/admin/:id — borra una reserva (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const b = await db.get('rentbookings', req.params.id);
  if (!b) return res.status(404).json({ error: 'Reserva inexistente' });
  await db.remove('rentbookings', req.params.id);
  res.json({ ok: true });
});
` : `// El panel de alquileres requiere el módulo de autenticación: activalo en el Builder para
// habilitar /alquileres-admin.html. Sin él, editá data/rentitems.json y data/rentbookings.json
// a mano (la página pública y el control de solapamiento funcionan igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      alquileres: {
        title: 'Alquileres',
        html: `  <section>
    <div class="container">
      <h2>Alquileres</h2>
      <p class="section-sub">Elegí el espacio, marcá tus fechas y reservá al instante: la disponibilidad se controla en el momento.</p>
      <div class="grid cols-2" id="rq-items"><p class="muted">Cargando espacios…</p></div>
      <form id="rq-form" class="card" style="max-width:640px;margin-top:26px" hidden>
        <h3 style="margin-top:0">Reservar <span id="rq-nombre"></span></h3>
        <p class="rq-ocupadas" id="rq-ocupadas" hidden></p>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Desde</label><input name="from" type="date" required></div>
          <div><label>Hasta (inclusive)</label><input name="until" type="date" required></div>
        </div>
        <div class="rq-total" id="rq-total" hidden></div>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Tu nombre</label><input name="name" required minlength="2" maxlength="80" placeholder="Nombre y apellido"></div>
          <div><label>Tu teléfono</label><input name="phone" type="tel" required minlength="6" maxlength="30" placeholder="Ej: 11 5555-5555"></div>
        </div>
        <button class="btn" type="submit" style="margin-top:14px">Reservar estas fechas</button>
      </form>
      <div class="rq-ok" id="rq-ok" hidden></div>
      <noscript><p class="muted">Activá JavaScript para reservar online.</p></noscript>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['alquileres-admin'] = {
        title: 'Alquileres',
        html: `  <section>
    <div class="container" style="max-width:960px">
      <h2>Alquileres</h2>
      <p class="section-sub">Administrá tus espacios y sus reservas. Cancelar una reserva libera sus fechas. Solo visible para administradores.</p>
      <h3>Espacios y recursos</h3>
      <form id="rqa-form" class="card" style="max-width:680px;margin-bottom:22px">
        <input type="hidden" name="id" value="">
        <label>Nombre</label>
        <input name="name" required minlength="3" maxlength="90" placeholder="Ej: Cabaña Aires del Bosque">
        <label>Descripción</label>
        <textarea name="detail" rows="2" required minlength="10" maxlength="500" placeholder="Qué incluye, comodidades, condiciones…"></textarea>
        <div class="grid cols-3" style="gap:14px">
          <div><label>Precio por día</label><input name="price" type="number" min="0" step="1" required placeholder="85000"></div>
          <div><label>Capacidad (personas)</label><input name="capacity" type="number" min="0" step="1" placeholder="4"></div>
          <div><label>&nbsp;</label><label style="display:inline-flex;align-items:center;gap:8px;font-weight:400;margin:0"><input type="checkbox" name="published" checked style="width:auto"> Publicado</label></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn" type="submit" id="rqa-save">Guardar recurso</button>
          <button class="btn ghost" type="button" id="rqa-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="rqa-items"><p class="muted">Cargando…</p></div>
      <h3 style="margin-top:34px">Reservas</h3>
      <select id="rqa-filtro" style="width:auto;margin-bottom:14px">
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendientes</option>
        <option value="confirmada">Confirmadas</option>
        <option value="cancelada">Canceladas</option>
      </select>
      <div id="rqa-list"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo alquileres por día: /alquileres.html lista los recursos del backend y reserva por rango
   de fechas (el servidor controla el solapamiento y calcula el total). Con auth, panel en
   /alquileres-admin.html. Animado con Anime.js (stagger, count-up) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EST = { pendiente: 'Pendiente', confirmada: '<strong style="color:var(--accent)">Confirmada</strong>', cancelada: '<span class="muted">Cancelada</span>' };

  // Cantidad de días de un rango inclusivo (misma cuenta que hace el servidor)
  function diasDe(from, until) { return Math.round((Date.parse(until) - Date.parse(from)) / 86400000) + 1; }

  // ---- Página pública /alquileres.html ----
  var itemsBox = document.getElementById('rq-items');
  if (itemsBox) {
    var formR = document.getElementById('rq-form');
    var okBox = document.getElementById('rq-ok');
    var totalBox = document.getElementById('rq-total');
    var ocupadasBox = document.getElementById('rq-ocupadas');
    var items = [];
    var sel = null;

    function pintarItems() {
      if (!items.length) { itemsBox.innerHTML = '<p class="muted">Por ahora no hay espacios disponibles para alquilar.</p>'; return; }
      itemsBox.innerHTML = items.map(function (it) {
        return '<div class="card rq-card' + (sel && sel.id === it.id ? ' sel' : '') + '" data-item="' + it.id + '" role="button" tabindex="0">' +
          '<h3>' + App.esc(it.name) + '</h3><p>' + App.esc(it.detail) + '</p>' +
          (it.capacity ? '<span class="rq-cap">Hasta ' + it.capacity + ' personas</span>' : '') +
          '<span class="rq-precio">' + App.money(it.price) + ' por día</span></div>';
      }).join('');
      itemsBox.querySelectorAll('[data-item]').forEach(function (c) {
        c.addEventListener('click', function () { elegir(c.getAttribute('data-item')); });
        c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(c.getAttribute('data-item')); } });
      });
      var anime = window.anime;
      var cards = itemsBox.querySelectorAll('.rq-card');
      if (anime && anime.animate && !reduce && cards.length) {
        anime.animate(cards, { opacity: [0, 1], translateY: [16, 0], duration: 450, delay: anime.stagger(90), ease: 'outCubic' });
        // Red de seguridad: deja todo visible aunque el loop esté pausado (pestaña oculta)
        setTimeout(function () { cards.forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; }); }, 1500);
      }
    }

    function elegir(id) {
      sel = items.filter(function (x) { return x.id === id; })[0] || null;
      if (!sel) return;
      pintarItems();
      okBox.hidden = true;
      formR.hidden = false;
      document.getElementById('rq-nombre').textContent = sel.name;
      var hoy = new Date().toISOString().slice(0, 10);
      formR.querySelector('[name="from"]').min = hoy;
      formR.querySelector('[name="until"]').min = hoy;
      actualizarTotal();
      ocupadasBox.hidden = true;
      if (!window.__PREVIEW__) {
        fetch('/api/alquileres/' + id + '/ocupadas').then(function (r) { return r.json(); }).then(function (rangos) {
          if (!rangos.length) { ocupadasBox.hidden = false; ocupadasBox.innerHTML = 'Todas las fechas próximas están libres.'; return; }
          ocupadasBox.hidden = false;
          ocupadasBox.innerHTML = '<strong>Fechas ya reservadas:</strong> ' + rangos.map(function (g) { return g.from === g.until ? g.from : g.from + ' al ' + g.until; }).join(' · ');
        }).catch(function () {});
      }
      formR.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Estimación en vivo del total (el importe final lo calcula el servidor con la misma cuenta)
    function actualizarTotal() {
      var from = formR.querySelector('[name="from"]').value;
      var until = formR.querySelector('[name="until"]').value;
      if (!sel || !from || !until || until < from) { totalBox.hidden = true; return; }
      var d = diasDe(from, until);
      totalBox.hidden = false;
      totalBox.innerHTML = d + (d === 1 ? ' día' : ' días') + ' × ' + App.money(sel.price) + ' = <strong>' + App.money(d * sel.price) + '</strong>';
    }
    formR.querySelector('[name="from"]').addEventListener('change', actualizarTotal);
    formR.querySelector('[name="until"]').addEventListener('change', actualizarTotal);

    formR.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!sel) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se reservaría el espacio'); return; }
      try {
        var r = await App.api('/api/alquileres/reservar', { method: 'POST', body: {
          itemId: sel.id,
          from: formR.querySelector('[name="from"]').value,
          until: formR.querySelector('[name="until"]').value,
          name: formR.querySelector('[name="name"]').value,
          phone: formR.querySelector('[name="phone"]').value,
        } });
        formR.hidden = true;
        okBox.hidden = false;
        okBox.innerHTML = '<h3 style="margin-top:0">Reserva recibida</h3>' +
          '<p>Reservaste <strong>' + App.esc(r.item) + '</strong> del <strong>' + r.from + '</strong> al <strong>' + r.until + '</strong> (' + r.days + (r.days === 1 ? ' día' : ' días') + ').</p>' +
          '<p>Total: <strong id="rq-ok-total">' + App.money(0) + '</strong></p>' +
          '<p>Tu código de reserva es <code>' + App.esc(r.code) + '</code>. Guardalo: te lo van a pedir para confirmar.</p>';
        var tEl = document.getElementById('rq-ok-total');
        var anime = window.anime;
        if (anime && anime.animate && !reduce) {
          var st = { v: 0 };
          anime.animate(st, { v: r.total, duration: 700, ease: 'outCubic', onUpdate: function () { tEl.textContent = App.money(Math.round(st.v)); } });
          // Red de seguridad: fija el importe final si el loop está pausado
          setTimeout(function () { tEl.textContent = App.money(r.total); }, 900);
        } else { tEl.textContent = App.money(r.total); }
        okBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        if (err.message !== 'preview') App.toast(err.message);
        if (err.data && err.data.busy) elegir(sel.id);
      }
    });

    if (window.__PREVIEW__) {
      items = [
        { id: 'd1', name: 'Cabaña Aires del Bosque', detail: 'Cabaña equipada para 4 personas con parrilla y vista al bosque.', price: 85000, capacity: 4 },
        { id: 'd2', name: 'Salón de eventos El Encuentro', detail: 'Salón climatizado para eventos de hasta 80 personas.', price: 120000, capacity: 80 },
      ];
      pintarItems();
    } else {
      fetch('/api/alquileres').then(function (r) { return r.json(); }).then(function (rows) { items = rows; pintarItems(); }).catch(function () { itemsBox.innerHTML = '<p class="muted">No pudimos cargar los espacios.</p>'; });
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /alquileres-admin.html ----
  var adminItems = document.getElementById('rqa-items');
  var formA = document.getElementById('rqa-form');
  if (adminItems && formA) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var listaItems = [];
    var reservas = [];
    var listBox = document.getElementById('rqa-list');
    var filtro = document.getElementById('rqa-filtro');
    var idInput = formA.querySelector('[name="id"]');
    var saveBtn = document.getElementById('rqa-save');
    var cancelBtn = document.getElementById('rqa-cancel');

    function pintarItemsAdmin() {
      adminItems.innerHTML = App.table(listaItems, [
        { key: 'name', label: 'Recurso' },
        { label: 'Precio/día', render: function (r) { return App.money(r.price); } },
        { label: 'Capacidad', render: function (r) { return r.capacity ? String(r.capacity) : '—'; } },
        { label: 'Reservas activas', render: function (r) { return String(r.bookings || 0); } },
        { label: 'Estado', render: function (r) { return r.published === false ? '<span class="muted">Oculto</span>' : '<strong style="color:var(--accent)">Publicado</strong>'; } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-pub="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.published === false ? 'Publicar' : 'Ocultar') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      adminItems.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editarItem(b.getAttribute('data-edit')); }); });
      adminItems.querySelectorAll('[data-pub]').forEach(function (b) { b.addEventListener('click', function () { alternarItem(b.getAttribute('data-pub')); }); });
      adminItems.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrarItem(b.getAttribute('data-del')); }); });
    }

    function pintarReservas() {
      listBox.innerHTML = App.table(reservas, [
        { key: 'code', label: 'Código' },
        { key: 'itemName', label: 'Recurso' },
        { label: 'Fechas', render: function (r) { return r.from + ' → ' + r.until + ' (' + r.days + (r.days === 1 ? ' día' : ' días') + ')'; } },
        { label: 'Cliente', render: function (r) { return App.esc(r.name) + '<br><span class="muted" style="font-size:.82rem">' + App.esc(r.phone) + '</span>'; } },
        { label: 'Total', render: function (r) { return App.money(r.total); } },
        { label: 'Estado', render: function (r) { return EST[r.status] || r.status; } },
        { label: 'Acciones', render: function (r) {
          return (r.status === 'pendiente' ? '<button class="btn ghost" type="button" data-est="confirmada" data-id="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Confirmar</button>' : '') +
            (r.status !== 'cancelada' ? '<button class="btn ghost" type="button" data-est="cancelada" data-id="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Cancelar</button>' : '') +
            '<button class="btn ghost" type="button" data-delr="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      listBox.querySelectorAll('[data-est]').forEach(function (b) { b.addEventListener('click', function () { estadoReserva(b.getAttribute('data-id'), b.getAttribute('data-est')); }); });
      listBox.querySelectorAll('[data-delr]').forEach(function (b) { b.addEventListener('click', function () { borrarReserva(b.getAttribute('data-delr')); }); });
    }

    function resetForm() {
      formA.reset(); idInput.value = '';
      formA.querySelector('[name="published"]').checked = true;
      saveBtn.textContent = 'Guardar recurso';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editarItem(id) {
      var it = listaItems.filter(function (r) { return r.id === id; })[0];
      if (!it) return;
      idInput.value = it.id;
      formA.querySelector('[name="name"]').value = it.name;
      formA.querySelector('[name="detail"]').value = it.detail || '';
      formA.querySelector('[name="price"]').value = it.price;
      formA.querySelector('[name="capacity"]').value = it.capacity || '';
      formA.querySelector('[name="published"]').checked = it.published !== false;
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formA.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function alternarItem(id) {
      var it = listaItems.filter(function (r) { return r.id === id; })[0];
      if (!it) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
      try {
        var upd = await App.api('/api/alquileres/admin/items/' + id, { method: 'PATCH', body: { published: it.published === false } });
        listaItems = listaItems.map(function (r) { return r.id === id ? Object.assign({}, r, upd) : r; });
        pintarItemsAdmin();
        App.toast(upd.published ? 'Recurso publicado' : 'Recurso oculto');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrarItem(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría el recurso'); return; }
      if (!confirm('¿Borrar este recurso? Sus reservas también se borran.')) return;
      try {
        await App.api('/api/alquileres/admin/items/' + id, { method: 'DELETE' });
        listaItems = listaItems.filter(function (r) { return r.id !== id; });
        reservas = reservas.filter(function (r) { return r.itemId !== id; });
        pintarItemsAdmin();
        pintarReservas();
        App.toast('Recurso borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function estadoReserva(id, status) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría el estado'); return; }
      try {
        var upd = await App.api('/api/alquileres/admin/' + id, { method: 'PATCH', body: { status: status } });
        reservas = reservas.map(function (r) { return r.id === id ? Object.assign({}, r, upd) : r; });
        pintarReservas();
        App.toast(status === 'confirmada' ? 'Reserva confirmada' : 'Reserva cancelada: sus fechas quedaron libres');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrarReserva(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría la reserva'); return; }
      if (!confirm('¿Borrar esta reserva?')) return;
      try {
        await App.api('/api/alquileres/admin/' + id, { method: 'DELETE' });
        reservas = reservas.filter(function (r) { return r.id !== id; });
        pintarReservas();
        App.toast('Reserva borrada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formA.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        name: formA.querySelector('[name="name"]').value,
        detail: formA.querySelector('[name="detail"]').value,
        price: Number(formA.querySelector('[name="price"]').value),
        capacity: Number(formA.querySelector('[name="capacity"]').value || 0),
        published: formA.querySelector('[name="published"]').checked,
      };
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'crearía') + ' el recurso'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/alquileres/admin/items/' + editando, { method: 'PATCH', body: datos });
          listaItems = listaItems.map(function (r) { return r.id === editando ? Object.assign({}, r, upd) : r; });
          App.toast('Cambios guardados');
        } else {
          var nuevo = await App.api('/api/alquileres/admin/items', { method: 'POST', body: datos });
          listaItems.push(nuevo);
          App.toast('Recurso creado');
        }
        resetForm();
        pintarItemsAdmin();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function cargarReservas() {
      App.api('/api/alquileres/admin/list' + (filtro.value ? '?status=' + filtro.value : '')).then(function (rows) { reservas = rows; pintarReservas(); }).catch(function () {});
    }
    filtro.addEventListener('change', function () { if (!window.__PREVIEW__) cargarReservas(); });

    if (window.__PREVIEW__) {
      listaItems = [{ id: 'd1', name: 'Cabaña Aires del Bosque', detail: 'Cabaña equipada para 4 personas.', price: 85000, capacity: 4, bookings: 2, published: true }];
      reservas = [{ id: 'r1', code: 'AL-DEMO01', itemId: 'd1', itemName: 'Cabaña Aires del Bosque', from: '2026-08-01', until: '2026-08-03', days: 3, total: 255000, name: 'Ana López', phone: '11 5555-5555', status: 'pendiente' }];
      pintarItemsAdmin();
      pintarReservas();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/alquileres/admin/items').then(function (rows) { listaItems = rows; pintarItemsAdmin(); }).catch(function (err) { adminItems.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
      cargarReservas();
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navR = document.getElementById('nav-alquileres-admin');
    if (navR && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navR.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Alquileres por día**: los espacios/recursos viven en la colección \`rentitems\` (nombre, descripción, precio por día, capacidad) y las reservas en \`rentbookings\`. El visitante reserva un rango de fechas en \`/alquileres.html\` y el servidor controla el solapamiento contra las reservas activas (una reserva cancelada libera sus fechas) y calcula el total. ${cfg.moduleIds.includes('auth') ? 'Los administradores gestionan recursos y reservas en \`/alquileres-admin.html\`.' : 'Para administrar desde la web activá el módulo **Autenticación** (habilita \`/alquileres-admin.html\`); sin él, editá los JSON de \`data/\` a mano.'} Se siembran dos recursos de ejemplo: reemplazalos por los tuyos.`,
  ],
};
