// Club de cumpleaños con backend real: sección en la Home donde el visitante se anota con nombre,
// email y fecha de nacimiento para recibir un beneficio en su día (el clásico "club de cumpleaños"
// de comercios, peluquerías y restaurantes). El alta es idempotente por email (anotarse de nuevo
// actualiza los datos, jamás duplica) y la fecha se valida en el servidor (formato real y no
// futura). Con auth activo, /cumples-admin.html es el panel solo-admin: KPIs animados (anotados,
// cumplen hoy, próximos 7 y 30 días), la lista ordenada por "días para el cumple" calculados
// SIEMPRE en el servidor (el año no importa: solo mes y día, con 29/2 resuelto al 1/3 en años no
// bisiestos), filtro de próximos, CSV y baja. Si el módulo de Avisos por email está activo, cada
// alta dispara mailer.notify() y el panel muestra a quién saludar hoy. Animado con Anime.js + red
// de seguridad. Distinto de "loyalty" (tarjeta de sellos por compra) y "leads" (captación
// genérica): acá el dato es la FECHA para accionar el saludo/beneficio en el día justo.

module.exports = {
  id: 'cumples', type: 'functional', name: 'Club de cumpleaños',
  description: 'Sección en la Home para que el visitante se anote al club de cumpleaños (nombre, email y fecha de nacimiento, alta idempotente por email) y reciba un beneficio en su día. Con auth activo, panel solo-admin /cumples-admin.html con los que cumplen hoy y los próximos ordenados por días faltantes (calculados en el servidor), KPIs animados, filtro y CSV. Con Avisos por email activo, cada alta avisa al negocio. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/cumples', file: 'routes/cumples.js' }],
  collections: ['birthdays'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Cumpleaños (admin)', href: '/cumples-admin.html', id: 'nav-cumples-admin' }] : [],
  html: () => `  <section id="cumpleanos">
    <div class="container" style="max-width:760px">
      <h2>Club de cumpleaños</h2>
      <p class="section-sub">Anotate con tu fecha y llevate un regalo o beneficio especial en tu día. Sin vueltas: solo tu nombre, tu email y tu cumple.</p>
      <form id="cum-form" class="card">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Tu nombre</label><input name="name" required minlength="2" maxlength="80" placeholder="Nombre y apellido"></div>
          <div><label>Tu email</label><input name="email" type="email" required placeholder="tu@email.com"></div>
        </div>
        <label>Tu fecha de nacimiento</label>
        <input name="birthday" type="date" required>
        <button class="btn" type="submit" style="margin-top:14px">Sumarme al club</button>
      </form>
      <div class="cum-ok" id="cum-ok" hidden></div>
      <noscript><p class="muted">Activá JavaScript para sumarte al club de cumpleaños.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    .cum-ok{border-left:3px solid var(--accent);padding:14px 18px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0;margin-top:18px}
    .cum-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .cum-kpis .card{text-align:center}
    .cum-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .cum-hoy{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;background:var(--accent);color:white;font-weight:700}
    .cum-pronto{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent)}
  </style>`,
  files: (cfg) => ({
    'routes/cumples.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;
const hoy = () => new Date().toISOString().slice(0, 10);

// ¿Fecha de nacimiento válida? Formato real, parseable y no futura (el año lejano no molesta)
function nacimientoValido(v) {
  if (typeof v !== 'string' || !FECHA.test(v)) return false;
  const t = Date.parse(v + 'T00:00:00Z');
  return !isNaN(t) && v <= hoy();
}

// Días que faltan para el próximo cumpleaños (solo cuentan mes y día; 29/2 cae 1/3 en años no
// bisiestos porque Date.UTC lo desborda solo). 0 = cumple hoy.
function diasParaElCumple(birthday) {
  const [, m, d] = birthday.split('-').map(Number);
  const ahora = new Date(hoy() + 'T00:00:00Z');
  let prox = Date.UTC(ahora.getUTCFullYear(), m - 1, d);
  if (prox < ahora.getTime()) prox = Date.UTC(ahora.getUTCFullYear() + 1, m - 1, d);
  return Math.round((prox - ahora.getTime()) / 86400000);
}

// POST /api/cumples — alta al club (público). Idempotente por email: re-anotarse actualiza.
router.post('/', async (req, res) => {
  const { ok, errors } = check(req.body, {
    name: (v) => str(v, 2, 80),
    email: isEmail,
    birthday: nacimientoValido,
  });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos (revisá tu fecha de nacimiento)', errors });
  const email = req.body.email.toLowerCase().trim();
  const name = req.body.name.trim();
  const birthday = req.body.birthday;
  const existente = (await db.find('birthdays', b => b.email === email))[0];
  if (existente) {
    // Ya estaba anotado: se actualizan nombre y fecha, jamás se duplica
    await db.update('birthdays', existente.id, { name, birthday });
    return res.json({ ok: true, updated: true });
  }
  await db.insert('birthdays', { name, email, birthday });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): alguien se sumó al club.
  // Es "disparar y seguir": un email caído jamás rompe el alta.
  mailer.notify('Nuevo miembro del club de cumpleaños', name + ' (' + email + ') se sumó al club de cumpleaños. Cumple el ' + birthday.slice(5).split('-').reverse().join('/') + '.').catch(() => {});
` : ''}  res.status(201).json({ ok: true, updated: false });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/cumples/admin/stats — KPIs del club (solo admin)
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const rows = await db.all('birthdays');
  const dias = rows.map(b => diasParaElCumple(b.birthday));
  res.json({
    total: rows.length,
    hoyCumplen: dias.filter(d => d === 0).length,
    semana: dias.filter(d => d <= 7).length,
    mes: dias.filter(d => d <= 30).length,
  });
});

// GET /api/cumples/admin/list — miembros ordenados por días para el cumple (solo admin;
// ?proximos=30 filtra a los que cumplen dentro de esos días)
router.get('/admin/list', requireAdmin, async (req, res) => {
  let rows = (await db.all('birthdays')).map(b => ({ ...b, daysToNext: diasParaElCumple(b.birthday) }));
  const proximos = Number(req.query.proximos);
  if (isFinite(proximos) && proximos > 0) rows = rows.filter(b => b.daysToNext <= proximos);
  rows.sort((a, b) => a.daysToNext - b.daysToNext || a.name.localeCompare(b.name, 'es'));
  res.json(rows.slice(0, 500));
});

// DELETE /api/cumples/admin/:id — da de baja a un miembro (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const b = await db.get('birthdays', req.params.id);
  if (!b) return res.status(404).json({ error: 'Miembro inexistente' });
  await db.remove('birthdays', req.params.id);
  res.json({ ok: true });
});
` : `// El panel del club requiere el módulo de autenticación: activalo en el Builder para habilitar
// /cumples-admin.html. Sin él, las altas igual se guardan en data/birthdays.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'cumples-admin': {
      title: 'Club de cumpleaños',
      html: `  <section>
    <div class="container" style="max-width:920px">
      <h2>Club de cumpleaños</h2>
      <p class="section-sub">Los anotados al club ordenados por cuánto falta para su día: saludá y aplicá el beneficio en el momento justo. Solo visible para administradores.</p>
      <div class="cum-kpis" id="cua-kpis"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <select id="cua-filtro" style="width:auto">
          <option value="">Todos los miembros</option>
          <option value="7">Cumplen esta semana</option>
          <option value="30" selected>Próximos 30 días</option>
        </select>
        <button class="btn ghost" type="button" id="cua-csv">Descargar CSV</button>
      </div>
      <div id="cua-list"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo club de cumpleaños: alta pública en la Home (idempotente por email) y, con auth, panel
   /cumples-admin.html con los próximos cumpleaños calculados en el servidor. Animado con Anime.js
   (count-up de KPIs, caja de éxito) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Sección pública en la Home ----
  var formCum = document.getElementById('cum-form');
  if (formCum) {
    var okBox = document.getElementById('cum-ok');
    formCum.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: acá te sumarías al club'); return; }
      try {
        var r = await App.api('/api/cumples', { method: 'POST', body: {
          name: formCum.querySelector('[name="name"]').value,
          email: formCum.querySelector('[name="email"]').value,
          birthday: formCum.querySelector('[name="birthday"]').value,
        } });
        formCum.reset();
        okBox.hidden = false;
        okBox.innerHTML = r.updated
          ? '<strong>Ya estabas en el club:</strong> actualizamos tus datos. ¡Nos vemos en tu cumple!'
          : '<strong>¡Listo, ya sos parte del club!</strong> En tu cumpleaños te espera algo especial.';
        var anime = window.anime;
        if (anime && anime.animate && !reduce) {
          anime.animate(okBox, { opacity: [0, 1], translateY: [12, 0], duration: 450, ease: 'outCubic' });
          // Red de seguridad: deja la caja visible aunque el loop esté pausado (pestaña oculta)
          setTimeout(function () { okBox.style.opacity = 1; okBox.style.transform = 'none'; }, 900);
        }
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /cumples-admin.html ----
  var kpisCum = document.getElementById('cua-kpis');
  if (kpisCum) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var listBox = document.getElementById('cua-list');
    var filtro = document.getElementById('cua-filtro');

    function contar(el, hasta) {
      if (!el) return;
      var anime = window.anime;
      if (!anime || !anime.animate || reduce) { el.textContent = String(hasta); return; }
      var st = { v: 0 };
      anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = String(Math.round(st.v)); } });
      // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
      setTimeout(function () { el.textContent = String(hasta); }, 800);
    }

    function pintarStats(s) {
      kpisCum.innerHTML = '<div class="card"><strong id="cua-k-total">0</strong><span class="muted">en el club</span></div>' +
        '<div class="card"><strong id="cua-k-hoy">0</strong><span class="muted">cumplen hoy</span></div>' +
        '<div class="card"><strong id="cua-k-sem">0</strong><span class="muted">esta semana</span></div>' +
        '<div class="card"><strong id="cua-k-mes">0</strong><span class="muted">próximos 30 días</span></div>';
      contar(document.getElementById('cua-k-total'), s.total);
      contar(document.getElementById('cua-k-hoy'), s.hoyCumplen);
      contar(document.getElementById('cua-k-sem'), s.semana);
      contar(document.getElementById('cua-k-mes'), s.mes);
    }

    // '1990-07-20' → '20/07' (el año no se muestra: el dato sensible no hace falta en la tabla)
    function diaMes(birthday) { return birthday.slice(5).split('-').reverse().join('/'); }

    function chipDias(d) {
      if (d === 0) return '<span class="cum-hoy">¡Cumple hoy!</span>';
      if (d <= 7) return '<span class="cum-pronto">En ' + d + (d === 1 ? ' día' : ' días') + '</span>';
      return 'En ' + d + ' días';
    }

    function pintarLista() {
      listBox.innerHTML = App.table(lista, [
        { label: 'Miembro', render: function (r) { return App.esc(r.name) + '<br><span class="muted" style="font-size:.82rem">' + App.esc(r.email) + '</span>'; } },
        { label: 'Cumple el', render: function (r) { return diaMes(r.birthday); } },
        { label: 'Falta', render: function (r) { return chipDias(r.daysToNext); } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Dar de baja</button>';
        } },
      ]);
      listBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
    }

    function cargar() {
      App.api('/api/cumples/admin/stats').then(pintarStats).catch(function (err) { kpisCum.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
      App.api('/api/cumples/admin/list' + (filtro.value ? '?proximos=' + filtro.value : '')).then(function (rows) { lista = rows; pintarLista(); }).catch(function () {});
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se daría de baja al miembro'); return; }
      if (!confirm('¿Dar de baja a este miembro del club?')) return;
      try {
        await App.api('/api/cumples/admin/' + id, { method: 'DELETE' });
        lista = lista.filter(function (r) { return r.id !== id; });
        pintarLista();
        App.toast('Miembro dado de baja');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    filtro.addEventListener('change', function () { if (!window.__PREVIEW__) cargar(); });

    var csvBtn = document.getElementById('cua-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var filas = [['nombre', 'email', 'cumple', 'dias_para_el_cumple']].concat(lista.map(function (r) { return [r.name, r.email, diaMes(r.birthday), r.daysToNext]; }));
      var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'club-cumpleanos.csv';
      a.click();
    });

    if (window.__PREVIEW__) {
      pintarStats({ total: 32, hoyCumplen: 1, semana: 3, mes: 6 });
      lista = [
        { id: 'd1', name: 'Ana López', email: 'ana@mail.com', birthday: '1990-07-20', daysToNext: 0 },
        { id: 'd2', name: 'Luis Gómez', email: 'luis@mail.com', birthday: '1985-07-24', daysToNext: 4 },
      ];
      pintarLista();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      cargar();
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navCum = document.getElementById('nav-cumples-admin');
    if (navCum && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navCum.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Club de cumpleaños**: los miembros viven en la colección \`birthdays\` (nombre, email, fecha). El alta es **idempotente por email** (re-anotarse actualiza, no duplica) y la fecha se valida en el servidor. ${cfg.moduleIds.includes('auth') ? 'El panel \`/cumples-admin.html\` muestra quiénes cumplen hoy y los próximos ordenados por días faltantes (calculados por el servidor, solo mes y día): usalo para saludar y aplicar el beneficio.' : 'Para ver el panel de próximos cumpleaños activá el módulo **Autenticación** (habilita \`/cumples-admin.html\`).'}${cfg.moduleIds.includes('mailer') ? ' Cada alta dispara un aviso por email (módulo Avisos por email).' : ''} El beneficio concreto (descuento, regalo) lo define y comunica el negocio: el texto de la sección es editable en la Home.`,
  ],
};
