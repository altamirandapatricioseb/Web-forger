const { phIcon } = require('../../src/icons');

// Testimonios moderados: sección en la Home con un muro de testimonios YA aprobados y un
// formulario para que cualquier visitante deje el suyo. Lo que se envía queda pendiente
// (colección testimonials, estado pending) y NO se muestra hasta que un administrador lo
// aprueba. El muro se revela con Anime.js (con red de seguridad) y muestra cuántos testimonios
// publicados hay. Con el módulo de autenticación activo, suma una página /testimonios-admin.html
// solo-admin para aprobar, rechazar o borrar cada envío, filtrar por estado y bajar un CSV.
// Distinto de "reviews" (reseñas con estrella atadas a un producto/compra) y de "qanda"
// (preguntas del público): acá el cliente deja una recomendación curada (nombre, rol/empresa,
// texto y estrellas opcionales) que el negocio modera antes de publicar como prueba social.

// Testimonios de ejemplo (se siembran la primera vez para que el muro no esté vacío sin auth).
const SEMILLA = [
  { name: 'María Fernández', role: 'Dueña de Panadería La Espiga', message: 'Desde que trabajamos con ellos, nuestras ventas online crecieron muchísimo. El trato es cercano y siempre están para ayudar.', rating: 5, status: 'approved' },
  { name: 'Javier Gómez', role: 'Gerente en Talleres Gómez', message: 'Profesionales de verdad. Entendieron lo que necesitábamos y lo entregaron en tiempo. Los recomiendo sin dudar.', rating: 5, status: 'approved' },
];

module.exports = {
  id: 'usertestimonials', type: 'functional', name: 'Testimonios moderados',
  description: 'Sección "Dejá tu testimonio": el visitante envía una recomendación que queda pendiente y solo se publica cuando un administrador la aprueba. Muro de testimonios aprobados con Anime.js. Con auth activo, panel /testimonios-admin.html para moderar (aprobar/rechazar/borrar) y CSV.',
  usesAnime: true,
  mounts: [{ route: '/api/testimonials', file: 'routes/testimonials.js' }],
  collections: ['testimonials'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Testimonios', href: '/testimonios-admin.html', id: 'nav-testimonios' }] : [],
  html: () => `  <section id="testimonios-clientes">
    <div class="container">
      <h2>Lo que dicen de nosotros</h2>
      <p class="section-sub">Testimonios reales de clientes. <strong class="tm-num" data-n="0" id="tm-count" hidden>0</strong><span id="tm-count-txt" hidden> publicados.</span></p>
      <div id="tm-wall" class="grid cols-3"><p class="muted">Cargando testimonios…</p></div>
      <div class="card" style="max-width:640px;margin-top:34px">
        <h3 style="margin:0 0 4px">Dejá tu testimonio</h3>
        <p class="muted" style="margin:0 0 8px;font-size:.9rem">Contanos tu experiencia. Lo revisamos antes de publicarlo.</p>
        <form id="tm-form">
          <label>Nombre</label>
          <input name="name" required maxlength="80" placeholder="Tu nombre">
          <label>Rol o empresa (opcional)</label>
          <input name="role" maxlength="120" placeholder="Ej: Cliente desde 2020 / Dueño de…">
          <label>Tu testimonio</label>
          <textarea name="message" rows="4" required minlength="10" maxlength="600" placeholder="Contanos cómo fue tu experiencia"></textarea>
          <label>¿Cuántas estrellas nos das? (opcional)</label>
          <div id="tm-stars" class="tm-stars-input" role="radiogroup" aria-label="Puntuación en estrellas"></div>
          <input type="hidden" name="rating" value="">
          <button class="btn" type="submit" style="margin-top:14px">Enviar testimonio</button>
        </form>
        <div id="tm-ok" hidden></div>
        <noscript><p class="muted">Activá JavaScript para dejar un testimonio.</p></noscript>
      </div>
    </div>
  </section>`,
  head: () => `  <style>
    .tm-num{color:var(--accent);font-variant-numeric:tabular-nums}
    .tm-card{display:flex;flex-direction:column;gap:8px}
    .tm-card .tm-quote{margin:0;font-style:italic}
    .tm-card .tm-who{font-weight:700;margin:0}
    .tm-card .tm-role{color:var(--muted);font-size:.85rem;margin:0}
    .tm-rating{color:#f5a623;letter-spacing:2px;font-size:1rem}
    .tm-stars-input{display:flex;gap:4px;font-size:1.6rem;cursor:pointer;user-select:none}
    .tm-stars-input span{color:var(--line);transition:color .15s ease,transform .15s ease}
    .tm-stars-input span.on{color:#f5a623}
    .tm-stars-input span:hover{transform:scale(1.15)}
    #tm-ok{background:var(--surface);border-left:3px solid var(--accent);padding:14px 16px;border-radius:0 var(--radius) var(--radius) 0;margin-top:12px}
    #tm-ok h3{margin:0 0 4px}
    .tm-badge{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;vertical-align:baseline}
    .tm-badge.pending{background:color-mix(in srgb,#f5a623 22%,var(--surface));color:#a06a00}
    .tm-badge.approved{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent)}
    .tm-badge.rejected{background:color-mix(in srgb,#c0392b 18%,var(--surface));color:#c0392b}
  </style>`,
  files: (cfg) => ({
    'routes/testimonials.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num, oneOf } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
const ESTADOS = ['pending', 'approved', 'rejected'];

// Siembra un par de testimonios aprobados la primera vez para que el muro no esté vacío
db.seedIfEmpty('testimonials', ${JSON.stringify(SEMILLA, null, 2)});

const validar = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  message: (v) => str(v, 10, 600),
});

// Vista pública de un testimonio: nunca expone datos internos, solo lo visible
const publico = (t) => ({ name: t.name, role: t.role || '', message: t.message, rating: t.rating || 0, createdAt: t.createdAt });

// GET /api/testimonials — muro público (solo los aprobados, más nuevos primero)
router.get('/', async (req, res) => {
  const rows = await db.find('testimonials', r => r.status === 'approved');
  res.json(rows.reverse().map(publico));
});

// GET /api/testimonials/stats — cuántos testimonios publicados hay (prueba social)
router.get('/stats', async (req, res) => {
  res.json({ total: (await db.find('testimonials', r => r.status === 'approved')).length });
});

// POST /api/testimonials — deja un testimonio { name, role?, message, rating? } → queda pendiente
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const role = typeof req.body.role === 'string' ? req.body.role.trim().slice(0, 120) : '';
  // El rating es opcional; si viene, debe ser un entero de 1 a 5
  let rating = 0;
  if (req.body.rating !== undefined && req.body.rating !== '' && req.body.rating !== null) {
    const n = Number(req.body.rating);
    if (!num(n, 1, 5) || !Number.isInteger(n)) return res.status(422).json({ error: 'Estrellas inválidas', errors: { rating: 'Debe ser un número de 1 a 5' } });
    rating = n;
  }
  await db.insert('testimonials', {
    name: req.body.name.trim(),
    role,
    message: req.body.message.trim(),
    rating,
    status: 'pending',
  });
  res.status(201).json({ ok: true });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/testimonials/all — todos los envíos (solo admin; filtro ?status=pending|approved|rejected)
router.get('/all', requireAdmin, async (req, res) => {
  let rows = await db.all('testimonials');
  if (req.query.status && ESTADOS.includes(req.query.status)) rows = rows.filter(r => r.status === req.query.status);
  res.json(rows.reverse());
});

// PATCH /api/testimonials/:id — aprueba o rechaza un testimonio (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  if (!oneOf(req.body.status, ESTADOS)) return res.status(422).json({ error: 'Estado inválido', errors: { status: 'Debe ser ' + ESTADOS.join(', ') } });
  const row = await db.update('testimonials', req.params.id, { status: req.body.status });
  if (!row) return res.status(404).json({ error: 'Testimonio inexistente' });
  res.json(row);
});

// DELETE /api/testimonials/:id — borra un testimonio (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const row = await db.get('testimonials', req.params.id);
  if (!row) return res.status(404).json({ error: 'Testimonio inexistente' });
  await db.remove('testimonials', req.params.id);
  res.json({ ok: true });
});
` : `// La moderación de testimonios (aprobar/rechazar/borrar) requiere el módulo de autenticación:
// activalo en el Builder para habilitar /testimonios-admin.html. Sin él, los envíos quedan
// pendientes en data/testimonials.json y solo se muestran los que sembraste como aprobados.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'testimonios-admin': {
      title: 'Moderar testimonios',
      html: `  <section>
    <div class="container">
      <h2>Moderar testimonios</h2>
      <p class="section-sub">Aprobá los testimonios para que aparezcan en la Home, rechazá o borrá los que no correspondan. Solo visible para administradores.</p>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
        <select id="tm-filtro" style="width:auto;min-width:200px">
          <option value="">Todos</option>
          <option value="pending" selected>Pendientes</option>
          <option value="approved">Aprobados</option>
          <option value="rejected">Rechazados</option>
        </select>
        <button class="btn ghost" type="button" id="tm-csv">Descargar CSV</button>
      </div>
      <div id="tm-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo testimonios: muro público de aprobados + formulario de envío (queda pendiente),
   y con auth activo, la moderación en /testimonios-admin.html. Anime.js con red de seguridad.
   En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Glifos Phosphor horneados en build (muro, picker del formulario y tabla de moderación)
  var STAR_ON = '${phIcon('star-fill', { size: 16 })}';
  var STAR_OFF = '${phIcon('star', { size: 16, style: 'opacity:.35' })}';
  var STAR_PICK = '${phIcon('star-fill', { size: 24 })}';

  function estrellas(n) {
    n = Math.max(0, Math.min(5, Number(n) || 0));
    if (!n) return '';
    var out = '';
    for (var i = 0; i < 5; i++) out += i < n ? STAR_ON : STAR_OFF;
    return '<div class="tm-rating" role="img" aria-label="' + n + ' de 5 estrellas" style="display:inline-flex;gap:1px;color:var(--accent)">' + out + '</div>';
  }

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    el.setAttribute('data-n', hasta);
    if (!anime || !anime.animate || reduce) { el.textContent = hasta; return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 700, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = hasta; }, 900);
  }

  // ---- Muro público + formulario (Home) ----
  var wall = document.getElementById('tm-wall');
  var form = document.getElementById('tm-form');
  if (wall) {
    function pintarMuro(lista) {
      if (!lista.length) { wall.innerHTML = '<p class="muted">Todavía no hay testimonios publicados. ¡Sé el primero!</p>'; return; }
      wall.innerHTML = lista.map(function (t) {
        return '<figure class="card tm-card">' +
          estrellas(t.rating) +
          '<blockquote class="tm-quote">“' + App.esc(t.message) + '”</blockquote>' +
          '<figcaption><p class="tm-who">' + App.esc(t.name) + '</p>' +
          (t.role ? '<p class="tm-role">' + App.esc(t.role) + '</p>' : '') +
          '</figcaption></figure>';
      }).join('');
      var count = document.getElementById('tm-count');
      var countTxt = document.getElementById('tm-count-txt');
      if (count) { count.hidden = false; contar(count, lista.length); }
      if (countTxt) countTxt.hidden = false;
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(wall.querySelectorAll('.tm-card'), { opacity: [0, 1], translateY: [16, 0], duration: 520, delay: anime.stagger ? anime.stagger(90) : 0, ease: 'outCubic' });
        // Red de seguridad: si la pestaña estaba oculta, asegura visibilidad final
        setTimeout(function () { wall.querySelectorAll('.tm-card').forEach(function (c) { c.style.opacity = 1; c.style.transform = 'none'; }); }, 1400);
      }
    }
    var demo = [
      { name: 'María Fernández', role: 'Dueña de Panadería La Espiga', message: 'Desde que trabajamos con ellos, nuestras ventas crecieron muchísimo. El trato es cercano.', rating: 5 },
      { name: 'Javier Gómez', role: 'Gerente en Talleres Gómez', message: 'Profesionales de verdad. Entendieron lo que necesitábamos y lo entregaron en tiempo.', rating: 5 },
      { name: 'Lucía Romero', role: 'Cliente desde 2021', message: 'Excelente atención y calidad. Siempre vuelvo.', rating: 4 },
    ];
    if (window.__PREVIEW__) { pintarMuro(demo); }
    else { App.api('/api/testimonials').then(pintarMuro).catch(function () { pintarMuro([]); }); }
  }

  if (form) {
    // Selector de estrellas opcional (0 = sin puntuar)
    var starsBox = document.getElementById('tm-stars');
    var ratingInput = form.querySelector('[name="rating"]');
    var valor = 0;
    if (starsBox) {
      starsBox.innerHTML = [1, 2, 3, 4, 5].map(function (i) { return '<span data-v="' + i + '" role="radio" aria-checked="false" tabindex="0" aria-label="' + i + (i === 1 ? ' estrella' : ' estrellas') + '">' + STAR_PICK + '</span>'; }).join('');
      var pintarStars = function () {
        starsBox.querySelectorAll('span').forEach(function (s) {
          var on = Number(s.getAttribute('data-v')) <= valor;
          s.classList.toggle('on', on);
          s.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        if (ratingInput) ratingInput.value = valor || '';
      };
      starsBox.addEventListener('click', function (e) {
        var s = e.target.closest('[data-v]');
        if (!s) return;
        var v = Number(s.getAttribute('data-v'));
        valor = (valor === v) ? 0 : v; // volver a tocar la misma estrella la desmarca
        pintarStars();
      });
    }
    var okBox = document.getElementById('tm-ok');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = Object.fromEntries(new FormData(form));
      if (window.__PREVIEW__) { mostrarOk(); return; }
      try {
        await App.api('/api/testimonials', { method: 'POST', body: datos });
        mostrarOk();
        App.toast('¡Gracias! Tu testimonio quedó pendiente de aprobación.');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });
    function mostrarOk() {
      form.hidden = true;
      if (okBox) {
        okBox.hidden = false;
        okBox.innerHTML = '<h3>${phIcon('check', { size: 18 })} ¡Testimonio recibido!</h3><p class="muted" style="margin:0">Lo revisamos y, si todo está bien, lo publicamos en breve. ¡Gracias por tu tiempo!</p>';
        var anime = window.anime;
        if (anime && anime.animate && !reduce) anime.animate(okBox, { opacity: [0, 1], translateY: [8, 0], duration: 450, ease: 'outCubic' });
      }
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel de moderación (/testimonios-admin.html) ----
  var adminBox = document.getElementById('tm-admin');
  if (adminBox) {
    var filtro = document.getElementById('tm-filtro');
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var ETIQUETAS = { createdAt: 'Fecha', name: 'Nombre', role: 'Rol/Empresa', message: 'Testimonio', rating: 'Estrellas', status: 'Estado' };
    var LABEL_ESTADO = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' };

    function filtrados() {
      var v = filtro && filtro.value;
      return v ? todos.filter(function (r) { return r.status === v; }) : todos;
    }

    function pintar() {
      adminBox.innerHTML = App.table(filtrados(), [
        { label: ETIQUETAS.createdAt, render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } },
        { key: 'name', label: ETIQUETAS.name },
        { label: ETIQUETAS.role, render: function (r) { return r.role ? App.esc(r.role) : '<span class="muted">—</span>'; } },
        { label: ETIQUETAS.message, render: function (r) { return '<span title="' + App.esc(r.message) + '">' + App.esc(String(r.message).slice(0, 90)) + (String(r.message).length > 90 ? '…' : '') + '</span>'; } },
        { label: ETIQUETAS.rating, render: function (r) { if (!r.rating) return '<span class="muted">—</span>'; var s = ''; for (var i = 0; i < r.rating; i++) s += STAR_ON; return '<span style="display:inline-flex;gap:1px;color:var(--accent)" role="img" aria-label="' + r.rating + ' de 5 estrellas">' + s + '</span>'; } },
        { label: ETIQUETAS.status, render: function (r) { return '<span class="tm-badge ' + r.status + '">' + (LABEL_ESTADO[r.status] || r.status) + '</span>'; } },
        { label: 'Acciones', render: function (r) {
          var btns = '';
          if (r.status !== 'approved') btns += '<button class="btn ghost" type="button" data-ok="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Aprobar</button>';
          if (r.status !== 'rejected') btns += '<button class="btn ghost" type="button" data-no="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Rechazar</button>';
          btns += '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
          return btns;
        } },
      ]);
      adminBox.querySelectorAll('[data-ok]').forEach(function (b) { b.addEventListener('click', function () { moderar(b.getAttribute('data-ok'), 'approved'); }); });
      adminBox.querySelectorAll('[data-no]').forEach(function (b) { b.addEventListener('click', function () { moderar(b.getAttribute('data-no'), 'rejected'); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
    }

    async function moderar(id, status) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se marcaría ' + status); return; }
      try {
        await App.api('/api/testimonials/' + id, { method: 'PATCH', body: { status: status } });
        var f = todos.filter(function (r) { return r.id === id; })[0];
        if (f) f.status = status;
        pintar();
        App.toast(status === 'approved' ? 'Testimonio aprobado' : 'Testimonio rechazado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este testimonio? No se puede deshacer.')) return;
      try {
        await App.api('/api/testimonials/' + id, { method: 'DELETE' });
        todos = todos.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Testimonio borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    if (filtro) filtro.addEventListener('change', pintar);

    var csvBtn = document.getElementById('tm-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var claves = ['createdAt', 'name', 'role', 'message', 'rating', 'status'];
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [claves.map(function (k) { return celda(ETIQUETAS[k] || k); }).join(';')];
      filtrados().forEach(function (r) { lineas.push(claves.map(function (k) { return celda(r[k]); }).join(';')); });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'testimonios-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    function listo(rows) { todos = rows; pintar(); }

    if (window.__PREVIEW__) {
      listo([
        { id: '1', name: 'Ana López', role: 'Cliente nueva', message: 'Me atendieron muy bien, súper recomendable para cualquiera que busque calidad.', rating: 5, status: 'pending', createdAt: new Date().toISOString() },
        { id: '2', name: 'María Fernández', role: 'Dueña de Panadería La Espiga', message: 'Desde que trabajamos con ellos nuestras ventas crecieron muchísimo.', rating: 5, status: 'approved', createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      // Traemos todos y filtramos del lado del cliente (el <select> ya reordena la vista)
      App.api('/api/testimonials/all').then(listo)
        .catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navTm = document.getElementById('nav-testimonios');
    if (navTm && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navTm.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Testimonios moderados**: los envíos del público quedan en la colección \`testimonials\` con estado \`pending\` y **no** se publican hasta aprobarlos. Se siembran dos testimonios de ejemplo la primera vez (editá o borralos). ${cfg.moduleIds.includes('auth') ? 'Los administradores aprueban, rechazan o borran cada envío y descargan el CSV en \`/testimonios-admin.html\`.' : 'Para moderar activá el módulo **Autenticación** (habilita \`/testimonios-admin.html\`); sin él, solo se muestran los testimonios sembrados como aprobados y los nuevos quedan pendientes en \`data/testimonials.json\`.'}`,
  ],
};
