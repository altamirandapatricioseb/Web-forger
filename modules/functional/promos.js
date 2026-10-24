// Promociones con vigencia y backend real: una sección en la Home muestra SOLO las promociones
// vigentes (el servidor filtra por fecha desde/hasta contra el día de hoy: una promo vencida
// desaparece sola, sin tocar nada), cada una con su etiqueta de descuento, cuántos días le quedan
// y un botón "Me interesa" que suma un interés REAL en el backend (un voto por navegador vía
// localStorage): el negocio mide qué promo tracciona antes de repetirla. Con auth activo,
// /promos-admin.html es el ABM solo-admin (título, etiqueta, detalle, desde/hasta, publicar) donde
// cada promo muestra su estado calculado (vigente / programada / vencida / oculta) y sus
// interesados. Se siembran dos promos vigentes y una vencida (que demuestra el filtro). Animado con
// Anime.js (tarjetas con stagger, pop del interés, count-up) + red de seguridad. Distinto de
// "promo" (popup estático de promoción), "countdown" (cuenta regresiva UI) y "coupons" (códigos de
// descuento del carrito): acá las promociones son datos administrables con vigencia real.

// Promos de ejemplo (fechas fijas: dos vigentes hasta 2030 y una vencida que demuestra el filtro)
const SEMILLA = [
  { title: '2x1 en la segunda unidad', badge: '2x1', detail: 'Llevando dos unidades iguales, la segunda va sin cargo. Aplica a productos seleccionados, todos los días.', from: '2026-01-01', until: '2030-12-31', published: true, interests: 0 },
  { title: '20% de descuento pagando en efectivo', badge: '20% OFF', detail: 'Abonando en efectivo en el local tenés un 20% de descuento directo sobre el total de tu compra.', from: '2026-01-01', until: '2030-06-30', published: true, interests: 0 },
  { title: 'Promo de lanzamiento del sitio', badge: '-30%', detail: 'Descuento especial por el estreno de nuestro nuevo sitio web.', from: '2025-11-01', until: '2025-12-31', published: true, interests: 0 },
];

module.exports = {
  id: 'promos', type: 'functional', name: 'Promociones con vigencia',
  description: 'Sección "Promociones" en la Home servida desde el backend: solo se muestran las promos vigentes (el servidor filtra por fecha desde/hasta), con días restantes y botón "Me interesa" que registra interés real por promo. Con auth activo, ABM solo-admin en /promos-admin.html con estado calculado (vigente/programada/vencida) e interesados. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/promos', file: 'routes/promos.js' }],
  collections: ['promos'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Promos (admin)', href: '/promos-admin.html', id: 'nav-promos-admin' }] : [],
  html: () => `  <section id="promociones">
    <div class="container">
      <h2>Promociones</h2>
      <p class="section-sub">Aprovechalas antes de que terminen: estas son las promos activas hoy.</p>
      <div class="grid cols-3" id="pm-list"><p class="muted">Cargando promociones…</p></div>
      <noscript><p class="muted">Activá JavaScript para ver las promociones vigentes.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    .pm-card{display:flex;flex-direction:column;gap:10px}
    .pm-badge{align-self:flex-start;background:var(--accent);color:white;font-weight:800;font-size:1.05rem;padding:4px 14px;border-radius:999px;letter-spacing:.02em}
    .pm-card h3{margin:0;font-size:1.08rem}
    .pm-card p{margin:0;color:var(--muted);font-size:.92rem;flex:1}
    .pm-quedan{font-size:.8rem;color:var(--muted)}
    .pm-quedan strong{color:var(--accent)}
    .pm-int{display:flex;align-items:center;gap:10px;margin-top:4px}
    .pm-int .btn{padding:7px 16px;font-size:.85rem}
    .pm-int-count{font-size:.82rem;color:var(--muted)}
  </style>`,
  files: (cfg) => ({
    'routes/promos.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Siembra promos de ejemplo la primera vez (dos vigentes y una ya vencida)
db.seedIfEmpty('promos', ${JSON.stringify(SEMILLA, null, 2)});

// Fecha en formato AAAA-MM-DD (comparable como texto) y helpers de vigencia
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;
const hoy = () => new Date().toISOString().slice(0, 10);
const vigente = (p, d) => p.published !== false && (!p.from || p.from <= d) && (!p.until || p.until >= d);

// Estado calculado de una promo para el panel admin
function estado(p, d) {
  if (p.published === false) return 'oculta';
  if (p.from && p.from > d) return 'programada';
  if (p.until && p.until < d) return 'vencida';
  return 'vigente';
}

// Días que le quedan a una promo vigente (null = sin vencimiento)
function diasRestantes(p, d) {
  if (!p.until) return null;
  return Math.max(0, Math.round((Date.parse(p.until) - Date.parse(d)) / 86400000));
}

const validarPromo = (data) => check(data, {
  title: (v) => str(v, 3, 90),
  badge: (v) => str(v, 1, 20),
  detail: (v) => str(v, 10, 500),
});

// GET /api/promos — solo las promociones vigentes hoy (público)
router.get('/', async (req, res) => {
  const d = hoy();
  const rows = (await db.all('promos')).filter(p => vigente(p, d));
  res.json(rows.map(p => ({ id: p.id, title: p.title, badge: p.badge, detail: p.detail, until: p.until || '', daysLeft: diasRestantes(p, d), interests: p.interests || 0 })));
});

// POST /api/promos/:id/interest — suma un "me interesa" real (público; el dedupe es por navegador)
router.post('/:id/interest', async (req, res) => {
  const p = await db.get('promos', req.params.id);
  if (!p || !vigente(p, hoy())) return res.status(404).json({ error: 'Esa promoción ya no está vigente' });
  const upd = await db.update('promos', p.id, { interests: (p.interests || 0) + 1 });
  res.json({ interests: upd.interests });
});
${cfg.moduleIds.includes('auth') ? `
// Valida y normaliza las fechas de vigencia recibidas del ABM
function fechas(body) {
  const from = String(body.from || '').trim();
  const until = String(body.until || '').trim();
  if (from && !FECHA.test(from)) return { error: 'Fecha "desde" inválida (formato AAAA-MM-DD)' };
  if (until && !FECHA.test(until)) return { error: 'Fecha "hasta" inválida (formato AAAA-MM-DD)' };
  if (from && until && until < from) return { error: 'La fecha "hasta" no puede ser anterior a "desde"' };
  return { from, until };
}

// GET /api/promos/admin/list — todas las promos con su estado calculado (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  const d = hoy();
  res.json((await db.all('promos')).map(p => ({ ...p, estado: estado(p, d) })));
});

// POST /api/promos/admin — crea una promo (solo admin)
router.post('/admin', requireAdmin, async (req, res) => {
  const { ok, errors } = validarPromo(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const f = fechas(req.body);
  if (f.error) return res.status(422).json({ error: f.error });
  const row = await db.insert('promos', {
    title: req.body.title.trim(),
    badge: req.body.badge.trim(),
    detail: req.body.detail.trim(),
    from: f.from,
    until: f.until,
    published: req.body.published !== false,
    interests: 0,
  });
  res.status(201).json({ ...row, estado: estado(row, hoy()) });
});

// PATCH /api/promos/admin/:id — edita una promo o la publica/oculta (solo admin)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.title !== undefined) { if (!str(req.body.title, 3, 90)) return res.status(422).json({ error: 'Título inválido' }); patch.title = req.body.title.trim(); }
  if (req.body.badge !== undefined) { if (!str(req.body.badge, 1, 20)) return res.status(422).json({ error: 'Etiqueta inválida' }); patch.badge = req.body.badge.trim(); }
  if (req.body.detail !== undefined) { if (!str(req.body.detail, 10, 500)) return res.status(422).json({ error: 'Detalle inválido (mínimo 10 caracteres)' }); patch.detail = req.body.detail.trim(); }
  if (req.body.from !== undefined || req.body.until !== undefined) {
    const actual = await db.get('promos', req.params.id);
    if (!actual) return res.status(404).json({ error: 'Promoción inexistente' });
    const f = fechas({ from: req.body.from !== undefined ? req.body.from : actual.from, until: req.body.until !== undefined ? req.body.until : actual.until });
    if (f.error) return res.status(422).json({ error: f.error });
    patch.from = f.from; patch.until = f.until;
  }
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  const row = await db.update('promos', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Promoción inexistente' });
  res.json({ ...row, estado: estado(row, hoy()) });
});

// DELETE /api/promos/admin/:id — borra una promo (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const p = await db.get('promos', req.params.id);
  if (!p) return res.status(404).json({ error: 'Promoción inexistente' });
  await db.remove('promos', req.params.id);
  res.json({ ok: true });
});
` : `// El ABM de promociones requiere el módulo de autenticación: activalo en el Builder para
// habilitar /promos-admin.html. Sin él, editá data/promos.json a mano (la Home igual muestra
// solo las vigentes según sus fechas).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'promos-admin': {
      title: 'Promociones',
      html: `  <section>
    <div class="container">
      <h2>Promociones</h2>
      <p class="section-sub">Cargá tus promos con su vigencia: aparecen y desaparecen solas de la Home según las fechas. Solo visible para administradores.</p>
      <form id="pm-form" class="card" style="max-width:680px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <label>Título de la promo</label>
        <input name="title" required minlength="3" maxlength="90" placeholder="Ej: 2x1 en la segunda unidad">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Etiqueta corta (se muestra grande)</label><input name="badge" required minlength="1" maxlength="20" placeholder="Ej: 2x1, 20% OFF"></div>
          <div><label>&nbsp;</label><label style="display:inline-flex;align-items:center;gap:8px;font-weight:400;margin:0"><input type="checkbox" name="published" checked style="width:auto"> Publicada</label></div>
        </div>
        <label>Detalle / condiciones</label>
        <textarea name="detail" rows="3" required minlength="10" maxlength="500" placeholder="Qué incluye, condiciones y aclaraciones…"></textarea>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Vigente desde (opcional)</label><input name="from" type="date"></div>
          <div><label>Vigente hasta (opcional — vacío = sin vencimiento)</label><input name="until" type="date"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn" type="submit" id="pm-save">Guardar promo</button>
          <button class="btn ghost" type="button" id="pm-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="pm-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo promociones con vigencia: la Home muestra solo las vigentes (servidas por el backend)
   con "Me interesa" real; con auth activo, ABM en /promos-admin.html. Animado con Anime.js
   (stagger de tarjetas, pop del interés) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EST = { vigente: '<strong style="color:var(--accent)">Vigente</strong>', programada: 'Programada', vencida: '<span class="muted">Vencida</span>', oculta: '<span class="muted">Oculta</span>' };

  // ---- Sección pública de la Home ----
  var pubBox = document.getElementById('pm-list');
  if (pubBox) {
    function quedanTexto(p) {
      if (p.daysLeft === null || p.daysLeft === undefined) return 'Sin vencimiento';
      if (p.daysLeft === 0) return '<strong>¡Termina hoy!</strong>';
      if (p.daysLeft === 1) return 'Queda <strong>1 día</strong>';
      return 'Quedan <strong>' + p.daysLeft + ' días</strong>';
    }

    function pintar(promos) {
      if (!promos.length) { pubBox.innerHTML = '<p class="muted">Por ahora no hay promociones vigentes. Volvé a mirar pronto.</p>'; return; }
      var votadas = [];
      try { votadas = JSON.parse(localStorage.getItem('pm-votadas') || '[]'); } catch (e) {}
      pubBox.innerHTML = promos.map(function (p) {
        var ya = votadas.indexOf(p.id) >= 0;
        return '<div class="card pm-card"><span class="pm-badge">' + App.esc(p.badge) + '</span>' +
          '<h3>' + App.esc(p.title) + '</h3><p>' + App.esc(p.detail) + '</p>' +
          '<span class="pm-quedan">' + quedanTexto(p) + '</span>' +
          '<div class="pm-int"><button class="btn' + (ya ? ' ghost' : '') + '" type="button" data-int="' + p.id + '"' + (ya ? ' disabled' : '') + '>' + (ya ? 'Te interesa' : 'Me interesa') + '</button>' +
          '<span class="pm-int-count" id="pm-c-' + p.id + '">' + (p.interests ? 'A ' + p.interests + (p.interests === 1 ? ' persona le interesa' : ' personas les interesa') : 'Sé el primero en marcarla') + '</span></div></div>';
      }).join('');
      pubBox.querySelectorAll('[data-int]').forEach(function (b) { b.addEventListener('click', function () { interesar(b); }); });
      var anime = window.anime;
      var cards = pubBox.querySelectorAll('.pm-card');
      if (anime && anime.animate && !reduce && cards.length) {
        anime.animate(cards, { opacity: [0, 1], translateY: [16, 0], duration: 450, delay: anime.stagger(90), ease: 'outCubic' });
        // Red de seguridad: deja todo visible aunque el loop esté pausado (pestaña oculta)
        setTimeout(function () { cards.forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; }); }, 1500);
      }
    }

    async function interesar(btn) {
      var id = btn.getAttribute('data-int');
      if (window.__PREVIEW__) { App.toast('Vista previa: se sumaría tu interés'); return; }
      try {
        var r = await App.api('/api/promos/' + id + '/interest', { method: 'POST' });
        btn.disabled = true; btn.className = 'btn ghost'; btn.textContent = 'Te interesa';
        var c = document.getElementById('pm-c-' + id);
        if (c) c.textContent = 'A ' + r.interests + (r.interests === 1 ? ' persona le interesa' : ' personas les interesa');
        try {
          var v = JSON.parse(localStorage.getItem('pm-votadas') || '[]');
          v.push(id);
          localStorage.setItem('pm-votadas', JSON.stringify(v));
        } catch (e) {}
        var anime = window.anime;
        if (anime && anime.animate && !reduce) anime.animate(btn, { scale: [1, 1.15, 1], duration: 350, ease: 'outBack' });
        setTimeout(function () { btn.style.transform = 'none'; }, 600);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    if (window.__PREVIEW__) {
      pintar([
        { id: 'd1', title: '2x1 en la segunda unidad', badge: '2x1', detail: 'Llevando dos unidades iguales, la segunda va sin cargo.', daysLeft: 12, interests: 8 },
        { id: 'd2', title: '20% pagando en efectivo', badge: '20% OFF', detail: 'Descuento directo abonando en efectivo en el local.', daysLeft: null, interests: 0 },
      ]);
    } else {
      fetch('/api/promos').then(function (r) { return r.json(); }).then(pintar).catch(function () { pubBox.innerHTML = '<p class="muted">No pudimos cargar las promociones.</p>'; });
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /promos-admin.html ----
  var adminBox = document.getElementById('pm-admin');
  var formP = document.getElementById('pm-form');
  if (adminBox && formP) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var promos = [];
    var idInput = formP.querySelector('[name="id"]');
    var saveBtn = document.getElementById('pm-save');
    var cancelBtn = document.getElementById('pm-cancel');

    function pintarAdmin() {
      adminBox.innerHTML = App.table(promos, [
        { key: 'badge', label: 'Etiqueta' },
        { key: 'title', label: 'Promo' },
        { label: 'Vigencia', render: function (r) { return (r.from || '—') + ' → ' + (r.until || 'sin venc.'); } },
        { label: 'Estado', render: function (r) { return EST[r.estado] || r.estado; } },
        { label: 'Interesados', render: function (r) { return String(r.interests || 0); } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-pub="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.published === false ? 'Publicar' : 'Ocultar') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      adminBox.querySelectorAll('[data-pub]').forEach(function (b) { b.addEventListener('click', function () { alternar(b.getAttribute('data-pub')); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
    }

    function resetForm() {
      formP.reset(); idInput.value = '';
      formP.querySelector('[name="published"]').checked = true;
      saveBtn.textContent = 'Guardar promo';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var p = promos.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      idInput.value = p.id;
      ['title', 'badge', 'detail', 'from', 'until'].forEach(function (k) { formP.querySelector('[name="' + k + '"]').value = p[k] || ''; });
      formP.querySelector('[name="published"]').checked = p.published !== false;
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formP.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function alternar(id) {
      var p = promos.filter(function (r) { return r.id === id; })[0];
      if (!p) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
      try {
        var upd = await App.api('/api/promos/admin/' + id, { method: 'PATCH', body: { published: p.published === false } });
        promos = promos.map(function (r) { return r.id === id ? upd : r; });
        pintarAdmin();
        App.toast(upd.published ? 'Promo publicada' : 'Promo oculta');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría la promo'); return; }
      if (!confirm('¿Borrar esta promoción?')) return;
      try {
        await App.api('/api/promos/admin/' + id, { method: 'DELETE' });
        promos = promos.filter(function (r) { return r.id !== id; });
        pintarAdmin();
        App.toast('Promo borrada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formP.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        title: formP.querySelector('[name="title"]').value,
        badge: formP.querySelector('[name="badge"]').value,
        detail: formP.querySelector('[name="detail"]').value,
        from: formP.querySelector('[name="from"]').value,
        until: formP.querySelector('[name="until"]').value,
        published: formP.querySelector('[name="published"]').checked,
      };
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'crearía') + ' la promo'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/promos/admin/' + editando, { method: 'PATCH', body: datos });
          promos = promos.map(function (r) { return r.id === editando ? upd : r; });
          App.toast('Cambios guardados');
        } else {
          var nueva = await App.api('/api/promos/admin', { method: 'POST', body: datos });
          promos.push(nueva);
          App.toast('Promo creada');
        }
        resetForm();
        pintarAdmin();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (window.__PREVIEW__) {
      promos = [
        { id: 'd1', badge: '2x1', title: '2x1 en la segunda unidad', from: '2026-01-01', until: '2030-12-31', estado: 'vigente', interests: 8, published: true },
        { id: 'd2', badge: '-30%', title: 'Promo de lanzamiento', from: '2025-11-01', until: '2025-12-31', estado: 'vencida', interests: 23, published: true },
      ];
      pintarAdmin();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/promos/admin/list').then(function (rows) { promos = rows; pintarAdmin(); }).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navP = document.getElementById('nav-promos-admin');
    if (navP && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navP.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Promociones con vigencia**: viven en la colección \`promos\` (título, etiqueta, detalle, desde/hasta, publicada). La Home muestra solo las vigentes al día de hoy: una promo vencida desaparece sola. El botón "Me interesa" registra interés real por promo (un voto por navegador). ${cfg.moduleIds.includes('auth') ? 'Los administradores las gestionan en \`/promos-admin.html\` (estado calculado e interesados por promo).' : 'Para administrarlas desde la web activá el módulo **Autenticación** (habilita \`/promos-admin.html\`); sin él, editá \`data/promos.json\` a mano.'} Se siembran dos promos vigentes y una vencida de ejemplo.`,
  ],
};
