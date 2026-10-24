// Agenda de turnos por profesional y servicio con slots horarios y backend real: una página pública
// /turnos.html donde el visitante elige servicio, profesional y fecha, ve la grilla de horarios del
// día (los ocupados aparecen deshabilitados) y reserva un horario puntual; el servidor recalcula la
// disponibilidad al confirmar (dos personas no pueden quedarse con el mismo horario: responde 409) y
// devuelve un código de turno. Cada servicio tiene su duración, así un color de 90 minutos bloquea
// tres slots de 30 y un corte solo uno. Con el módulo de autenticación activo, /agenda-admin.html es
// un panel solo-admin con la agenda del día por profesional (confirmar, marcar atendido, cancelar).
// Sin auth, los turnos igual se guardan y el negocio los ve en data/agbookings.json. La grilla de
// horarios aparece con stagger de Anime.js (red de seguridad + respeta "prefers-reduced-motion").
// Es la agenda "fina" que faltaba en el catálogo: distinto de "bookings" (turno genérico por fecha,
// sin horario ni profesional) y de "reservamesa" (cupo de personas por turno de restaurante).

// Profesionales que atienden (constante compartida cliente/servidor). Ajustá a tu equipo real.
const PROFESIONALES = [
  { id: 'flor', name: 'Florencia Ruiz', role: 'Estilista' },
  { id: 'marcos', name: 'Marcos Peña', role: 'Barbero' },
  { id: 'sol', name: 'Sol Medina', role: 'Colorista' },
];
// Servicios ofrecidos con su duración en minutos (la duración define cuántos slots bloquea).
const SERVICIOS = [
  { id: 'corte', label: 'Corte', dur: 30 },
  { id: 'barba', label: 'Barba y perfilado', dur: 30 },
  { id: 'color', label: 'Color completo', dur: 90 },
  { id: 'brushing', label: 'Brushing', dur: 60 },
];
// Horario de atención y paso de la grilla en minutos.
const HORARIO = { start: '09:00', end: '18:00' };
const PASO = 30;

module.exports = {
  id: 'agenda', type: 'functional', name: 'Agenda de turnos con horarios',
  description: 'Turnos con agenda fina: página pública /turnos.html donde el visitante elige servicio, profesional y fecha, ve la grilla de horarios libres/ocupados del día (cada servicio bloquea según su duración) y reserva un horario puntual; el servidor evita superposiciones (409 si se ocupó) y devuelve un código. Grilla animada con Anime.js. Con auth activo, panel solo-admin en /agenda-admin.html con la agenda del día por profesional. Ideal para peluquerías, consultorios y estudios.',
  usesAnime: true,
  mounts: [{ route: '/api/agenda', file: 'routes/agenda.js' }],
  collections: ['agbookings'],
  nav: (cfg) => {
    const links = [{ label: 'Turnos', href: '/turnos.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Agenda', href: '/agenda-admin.html', id: 'nav-agenda-admin' });
    return links;
  },
  head: () => `  <style>
    .ag-steps{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
    .ag-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px;margin:14px 0 4px}
    .ag-slot{padding:8px 4px;border:1.5px solid var(--line);border-radius:var(--radius);background:var(--bg);color:var(--text);font:inherit;font-size:.88rem;font-weight:600;cursor:pointer;font-variant-numeric:tabular-nums}
    .ag-slot:hover{border-color:var(--accent);color:var(--accent)}
    .ag-slot.sel{background:var(--accent);border-color:var(--accent);color:#fff}
    .ag-slot:disabled{opacity:.35;cursor:not-allowed;text-decoration:line-through}
    .ag-slot:disabled:hover{border-color:var(--line);color:var(--text)}
    .ag-hint{font-size:.85rem;color:var(--muted);margin:4px 0 0}
    #ag-result{margin-top:16px;background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:0 var(--radius) var(--radius) 0;padding:18px 20px}
    #ag-result.err{border-left-color:#c0392b}
    #ag-result h3{margin:0 0 6px}
    .ag-code{font-size:1.5rem;font-weight:800;color:var(--accent);letter-spacing:.06em}
    .ag-det{color:var(--muted);margin:8px 0 0;font-size:.92rem}
    .ag-b{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--line);text-transform:capitalize}
    .ag-b.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
    .ag-b.off{opacity:.6;text-decoration:line-through}
  </style>`,
  files: (cfg) => ({
    'routes/agenda.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, oneOf, dateISO } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
// Profesionales, servicios (con duración en minutos) y horario de atención.
// Deben coincidir con los que ofrece el frontend; ajustalos a tu operación real.
const PROFESIONALES = ${JSON.stringify(PROFESIONALES)};
const SERVICIOS = ${JSON.stringify(SERVICIOS)};
const HORARIO = ${JSON.stringify(HORARIO)};
const PASO = ${PASO};
const PRO_IDS = PROFESIONALES.map(p => p.id);
const SRV_IDS = SERVICIOS.map(s => s.id);

// '09:30' → minutos desde las 0:00 (y su inversa, para armar la grilla)
const aMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const aHora = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

// Solo fechas de hoy en adelante (no se dan turnos para el pasado)
function fechaFutura(v) {
  if (!dateISO(v)) return false;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return new Date(v + 'T00:00:00') >= hoy;
}

// Turnos vigentes (no cancelados) de un profesional en una fecha, como rangos [desde, hasta) en minutos
async function ocupados(date, pro) {
  const rows = await db.find('agbookings', r => r.date === date && r.pro === pro && r.status !== 'cancelado');
  return rows.map(r => {
    const srv = SERVICIOS.find(s => s.id === r.service);
    const desde = aMin(r.time);
    return [desde, desde + ((srv && srv.dur) || PASO)];
  });
}

// Grilla de horarios de un día para un servicio: cada slot dice si está libre
// (un servicio de 90' necesita 90' seguidos libres y que entre antes del cierre)
async function grilla(date, pro, serviceId) {
  const srv = SERVICIOS.find(s => s.id === serviceId);
  const dur = (srv && srv.dur) || PASO;
  const rangos = await ocupados(date, pro);
  const fin = aMin(HORARIO.end);
  const slots = [];
  for (let t = aMin(HORARIO.start); t + dur <= fin; t += PASO) {
    const choca = rangos.some(([d, h]) => t < h && t + dur > d);
    slots.push({ time: aHora(t), free: !choca });
  }
  return slots;
}

// GET /api/agenda/meta — profesionales, servicios y horario (para armar el formulario)
router.get('/meta', (req, res) => res.json({ pros: PROFESIONALES, services: SERVICIOS, schedule: HORARIO, step: PASO }));

// GET /api/agenda/slots?date=&pro=&service= — grilla de horarios del día con libre/ocupado (público)
router.get('/slots', async (req, res) => {
  const date = String(req.query.date || '').trim();
  const pro = String(req.query.pro || '').trim();
  const service = String(req.query.service || '').trim();
  if (!fechaFutura(date)) return res.status(422).json({ error: 'Elegí una fecha válida (de hoy en adelante)' });
  if (!oneOf(pro, PRO_IDS)) return res.status(422).json({ error: 'Profesional inválido' });
  if (!oneOf(service, SRV_IDS)) return res.status(422).json({ error: 'Servicio inválido' });
  res.json({ date, pro, service, slots: await grilla(date, pro, service) });
});

// POST /api/agenda — reserva un turno si el horario sigue libre (público)
router.post('/', async (req, res) => {
  const { ok, errors } = check(req.body, {
    name: (v) => str(v, 2, 80),
    phone: (v) => str(v, 6, 30),
  });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const date = String(req.body.date || '').trim();
  const pro = String(req.body.pro || '').trim();
  const service = String(req.body.service || '').trim();
  const time = String(req.body.time || '').trim();
  if (!fechaFutura(date)) return res.status(422).json({ error: 'Elegí una fecha válida (de hoy en adelante)', errors: { date: 'Fecha inválida' } });
  if (!oneOf(pro, PRO_IDS)) return res.status(422).json({ error: 'Elegí un profesional válido', errors: { pro: 'Profesional inválido' } });
  if (!oneOf(service, SRV_IDS)) return res.status(422).json({ error: 'Elegí un servicio válido', errors: { service: 'Servicio inválido' } });
  // El horario tiene que ser un slot de la grilla y seguir libre (lo recalcula el servidor: nunca
  // se confía en lo que pintó el navegador, otro visitante pudo habérselo llevado en el medio)
  const slots = await grilla(date, pro, service);
  const slot = slots.find(s => s.time === time);
  if (!slot) return res.status(422).json({ error: 'Elegí un horario válido de la grilla', errors: { time: 'Horario inválido' } });
  if (!slot.free) return res.status(409).json({ error: 'Ese horario se acaba de ocupar. Elegí otro de la grilla.' });
  // Código de turno legible (para que el cliente lo muestre al llegar)
  const code = 'AG-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const row = await db.insert('agbookings', {
    name: req.body.name.trim(),
    phone: req.body.phone.trim(),
    date, pro, service, time,
    note: typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 200) : '',
    status: 'pendiente',
    code,
  });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email): entró un turno nuevo.
  // Es "disparar y seguir": un email caído jamás rompe la reserva del turno.
  mailer.notify('Nuevo turno: ' + date + ' ' + time, row.name + ' (tel. ' + row.phone + ') reservó "' + ((SERVICIOS.find(s => s.id === service) || {}).label || service) + '" con ' + ((PROFESIONALES.find(p => p.id === pro) || {}).name || pro) + ' el ' + date + ' a las ' + time + '. Código: ' + code + '. Confirmalo desde el panel de agenda.').catch(() => {});
` : ''}  res.status(201).json({ code: row.code, date, pro, service, time, status: row.status });
});
${cfg.moduleIds.includes('auth') ? `
// Vista admin: agrega el nombre del profesional y el servicio con su duración
const conEtiquetas = (r) => {
  const p = PROFESIONALES.find(x => x.id === r.pro);
  const s = SERVICIOS.find(x => x.id === r.service);
  return { ...r, proName: (p && p.name) || r.pro, serviceLabel: (s && s.label) || r.service, dur: (s && s.dur) || PASO };
};

// GET /api/agenda — todos los turnos, más recientes primero (solo admin); ?date= filtra por día
router.get('/', requireAdmin, async (req, res) => {
  let rows = (await db.all('agbookings')).reverse();
  const date = String(req.query.date || '').trim();
  if (date) rows = rows.filter(r => r.date === date);
  // La agenda del día se lee mejor ordenada por profesional y horario
  if (date) rows = rows.slice().sort((a, b) => (a.pro + a.time).localeCompare(b.pro + b.time));
  res.json(rows.map(conEtiquetas));
});

// PATCH /api/agenda/:id — cambia el estado de un turno (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const status = String(req.body.status || '').trim();
  if (!oneOf(status, ['pendiente', 'confirmado', 'atendido', 'cancelado'])) return res.status(422).json({ error: 'Estado inválido' });
  const row = await db.update('agbookings', req.params.id, { status });
  if (!row) return res.status(404).json({ error: 'Turno inexistente' });
  res.json(conEtiquetas(row));
});

// DELETE /api/agenda/:id — borra un turno (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const r = await db.get('agbookings', req.params.id);
  if (!r) return res.status(404).json({ error: 'Turno inexistente' });
  await db.remove('agbookings', req.params.id);
  res.json({ ok: true });
});
` : `// El panel de agenda (confirmar, marcar atendido, cancelar) requiere el módulo de autenticación:
// activalo en el Builder para habilitar /agenda-admin.html. Sin él, los turnos se guardan igual y
// podés verlos en data/agbookings.json.
`}module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      turnos: {
        title: 'Turnos',
        html: `  <section>
    <div class="container" style="max-width:760px">
      <h2>Sacá tu turno online</h2>
      <p class="section-sub">Elegí el servicio, con quién querés atenderte y el día: te mostramos los horarios libres al instante.</p>
      <form id="ag-form" class="card">
        <div class="ag-steps">
          <div><label for="ag-servicio">Servicio</label><select id="ag-servicio" name="service" required></select></div>
          <div><label for="ag-pro">Profesional</label><select id="ag-pro" name="pro" required></select></div>
          <div><label for="ag-fecha">Fecha</label><input type="date" id="ag-fecha" name="date" required></div>
        </div>
        <div id="ag-grid-box" hidden>
          <label style="margin-top:16px">Elegí un horario</label>
          <div id="ag-slots" class="ag-slots"></div>
          <p class="ag-hint">Los horarios tachados ya están ocupados. La duración del servicio bloquea el tiempo que necesita.</p>
        </div>
        <div id="ag-datos" hidden>
          <div class="grid cols-2" style="gap:14px">
            <div><label for="ag-nombre">Nombre y apellido</label><input id="ag-nombre" name="name" required minlength="2" maxlength="80" placeholder="Ej: Ana Pérez"></div>
            <div><label for="ag-tel">Teléfono</label><input id="ag-tel" name="phone" required minlength="6" maxlength="30" placeholder="Ej: 11 5555 5555"></div>
          </div>
          <label for="ag-nota">Comentario (opcional)</label>
          <input id="ag-nota" name="note" maxlength="200" placeholder="Ej: primera vez, pelo largo…">
          <button class="btn" type="submit" style="margin-top:12px">Confirmar turno</button>
        </div>
      </form>
      <div id="ag-result" hidden></div>
      <noscript><p class="muted">Activá JavaScript para sacar tu turno online.</p></noscript>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['agenda-admin'] = {
        title: 'Agenda del día',
        html: `  <section>
    <div class="container">
      <h2>Agenda de turnos</h2>
      <p class="section-sub">Turnos por día y profesional. Confirmá, marcá atendidos o cancelá. Solo visible para administradores.</p>
      <div class="card" style="max-width:420px;margin-bottom:22px">
        <label for="ag-adm-fecha">Ver agenda del día</label>
        <input type="date" id="ag-adm-fecha">
      </div>
      <div id="ag-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo agenda de turnos: página pública /turnos.html (servicio + profesional + fecha → grilla de
   horarios libres con stagger de Anime.js → confirmación con código) y, con auth activo, el panel de
   agenda del día en /agenda-admin.html. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PROS = ${JSON.stringify(PROFESIONALES)};
  var SRVS = ${JSON.stringify(SERVICIOS)};

  function nombrePro(id) { return (PROS.filter(function (p) { return p.id === id; })[0] || {}).name || id; }
  function labelSrv(id) { return (SRVS.filter(function (s) { return s.id === id; })[0] || {}).label || id; }

  function estadoBadge(s) {
    var map = { pendiente: 'ag-b', confirmado: 'ag-b on', atendido: 'ag-b on', cancelado: 'ag-b off' };
    return '<span class="' + (map[s] || 'ag-b') + '">' + App.esc(s) + '</span>';
  }

  // ---- Página pública /turnos.html ----
  var form = document.getElementById('ag-form');
  if (form) {
    var selSrv = document.getElementById('ag-servicio');
    var selPro = document.getElementById('ag-pro');
    var inFecha = document.getElementById('ag-fecha');
    var gridBox = document.getElementById('ag-grid-box');
    var slotsBox = document.getElementById('ag-slots');
    var datosBox = document.getElementById('ag-datos');
    var result = document.getElementById('ag-result');
    var horaSel = '';

    selSrv.innerHTML = SRVS.map(function (s) { return '<option value="' + App.esc(s.id) + '">' + App.esc(s.label) + ' (' + s.dur + " min)" + '</option>'; }).join('');
    selPro.innerHTML = PROS.map(function (p) { return '<option value="' + App.esc(p.id) + '">' + App.esc(p.name) + ' — ' + App.esc(p.role) + '</option>'; }).join('');

    // Fecha mínima = hoy (no se dan turnos para el pasado)
    (function () {
      var hoy = new Date(); var m = String(hoy.getMonth() + 1).padStart(2, '0'); var d = String(hoy.getDate()).padStart(2, '0');
      inFecha.min = hoy.getFullYear() + '-' + m + '-' + d;
    })();

    function pintarGrilla(slots) {
      horaSel = '';
      datosBox.hidden = true;
      gridBox.hidden = false;
      slotsBox.innerHTML = slots.map(function (s) {
        return '<button type="button" class="ag-slot" data-t="' + App.esc(s.time) + '"' + (s.free ? '' : ' disabled') + '>' + App.esc(s.time) + '</button>';
      }).join('');
      slotsBox.querySelectorAll('.ag-slot:not(:disabled)').forEach(function (b) {
        b.addEventListener('click', function () {
          slotsBox.querySelectorAll('.ag-slot').forEach(function (x) { x.classList.remove('sel'); });
          b.classList.add('sel');
          horaSel = b.getAttribute('data-t');
          datosBox.hidden = false;
        });
      });
      // Aparición de la grilla con stagger; red de seguridad si el loop está pausado (pestaña oculta)
      var chips = [].slice.call(slotsBox.querySelectorAll('.ag-slot'));
      var anime = window.anime;
      if (anime && anime.animate && !reduce && chips.length) {
        anime.animate(chips, { opacity: [0, 1], scale: [0.85, 1], duration: 300, delay: anime.stagger ? anime.stagger(18) : 0, ease: 'outCubic' });
        setTimeout(function () { chips.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 800);
      }
    }

    function cargarGrilla() {
      var date = inFecha.value;
      if (!date) { gridBox.hidden = true; datosBox.hidden = true; return; }
      if (window.__PREVIEW__) {
        // Demo: media mañana ocupada para que se vea la grilla mixta
        var demo = [];
        for (var h = 9; h < 18; h++) { ['00', '30'].forEach(function (mm) { demo.push({ time: String(h).padStart(2, '0') + ':' + mm, free: !(h === 10 || (h === 15 && mm === '30')) }); }); }
        pintarGrilla(demo);
        return;
      }
      App.api('/api/agenda/slots?date=' + encodeURIComponent(date) + '&pro=' + encodeURIComponent(selPro.value) + '&service=' + encodeURIComponent(selSrv.value))
        .then(function (r) { pintarGrilla(r.slots); })
        .catch(function (err) { gridBox.hidden = true; if (err.message !== 'preview') App.toast(err.message); });
    }
    inFecha.addEventListener('change', cargarGrilla);
    selPro.addEventListener('change', cargarGrilla);
    selSrv.addEventListener('change', cargarGrilla);

    function mostrarOk(r) {
      result.hidden = false; result.classList.remove('err');
      result.innerHTML = '<h3>¡Turno reservado!</h3>' +
        '<p class="ag-code">' + App.esc(r.code) + '</p>' +
        '<p class="ag-det"><strong>' + App.esc(labelSrv(r.service)) + '</strong> con ' + App.esc(nombrePro(r.pro)) + '<br>' + App.esc(r.date) + ' a las <strong>' + App.esc(r.time) + '</strong>. Mostrá este código al llegar.</p>';
      var anime = window.anime;
      if (anime && anime.animate && !reduce) anime.animate(result, { opacity: [0, 1], translateY: [10, 0], duration: 400, ease: 'outCubic' });
    }
    function mostrarError(msg) {
      result.hidden = false; result.classList.add('err');
      result.innerHTML = '<h3>No pudimos reservar el turno</h3><p class="ag-det" style="margin:0">' + App.esc(msg) + '</p>';
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!horaSel) { App.toast('Elegí un horario de la grilla'); return; }
      var datos = {
        name: document.getElementById('ag-nombre').value,
        phone: document.getElementById('ag-tel').value,
        date: inFecha.value,
        pro: selPro.value,
        service: selSrv.value,
        time: horaSel,
        note: document.getElementById('ag-nota').value,
      };
      if (window.__PREVIEW__) { mostrarOk({ code: 'AG-AB12CD', date: datos.date, pro: datos.pro, service: datos.service, time: horaSel }); return; }
      try {
        var r = await App.api('/api/agenda', { method: 'POST', body: datos });
        mostrarOk(r);
        form.reset(); gridBox.hidden = true; datosBox.hidden = true; horaSel = '';
      } catch (err) {
        if (err.message !== 'preview') { mostrarError(err.message); cargarGrilla(); }
      }
    });
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /agenda-admin.html ----
  var adminBox = document.getElementById('ag-admin');
  if (adminBox) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var turnos = [];
    var inFechaAdm = document.getElementById('ag-adm-fecha');

    function pintar() {
      adminBox.innerHTML = App.table(turnos, [
        { label: 'Fecha', render: function (r) { return App.esc(r.date); } },
        { label: 'Hora', render: function (r) { return '<strong>' + App.esc(r.time) + '</strong> <span class="muted">(' + r.dur + " min)" + '</span>'; } },
        { label: 'Profesional', render: function (r) { return App.esc(r.proName || nombrePro(r.pro)); } },
        { label: 'Servicio', render: function (r) { return App.esc(r.serviceLabel || labelSrv(r.service)); } },
        { key: 'name', label: 'Cliente' },
        { label: 'Teléfono', render: function (r) { return App.esc(r.phone); } },
        { label: 'Nota', render: function (r) { return r.note ? App.esc(r.note) : '<span class="muted">—</span>'; } },
        { label: 'Estado', render: function (r) { return estadoBadge(r.status); } },
        { label: 'Código', render: function (r) { return '<code>' + App.esc(r.code) + '</code>'; } },
        { label: 'Acciones', render: function (r) {
          return (r.status === 'pendiente' ? '<button class="btn ghost" type="button" data-ok="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Confirmar</button>' : '') +
            (r.status !== 'atendido' && r.status !== 'cancelado' ? '<button class="btn ghost" type="button" data-at="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Atendido</button>' : '') +
            (r.status !== 'cancelado' ? '<button class="btn ghost" type="button" data-no="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Cancelar</button>' : '') +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-ok]').forEach(function (b) { b.addEventListener('click', function () { cambiar(b.getAttribute('data-ok'), 'confirmado'); }); });
      adminBox.querySelectorAll('[data-at]').forEach(function (b) { b.addEventListener('click', function () { cambiar(b.getAttribute('data-at'), 'atendido'); }); });
      adminBox.querySelectorAll('[data-no]').forEach(function (b) { b.addEventListener('click', function () { cambiar(b.getAttribute('data-no'), 'cancelado'); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
    }

    async function cambiar(id, status) {
      if (window.__PREVIEW__) { App.toast('Vista previa: el turno quedaría ' + status); return; }
      try {
        var row = await App.api('/api/agenda/' + id, { method: 'PATCH', body: { status: status } });
        turnos = turnos.map(function (r) { return r.id === id ? row : r; });
        pintar();
        App.toast('Turno ' + status);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este turno?')) return;
      try {
        await App.api('/api/agenda/' + id, { method: 'DELETE' });
        turnos = turnos.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Turno borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    function cargar() {
      var date = inFechaAdm ? inFechaAdm.value : '';
      if (window.__PREVIEW__) {
        turnos = [
          { id: 'd1', date: date || '2026-01-01', time: '10:00', dur: 90, pro: 'sol', proName: 'Sol Medina', service: 'color', serviceLabel: 'Color completo', name: 'Ana Pérez', phone: '11 5555 5555', note: '', status: 'confirmado', code: 'AG-AB12CD' },
          { id: 'd2', date: date || '2026-01-01', time: '11:30', dur: 30, pro: 'marcos', proName: 'Marcos Peña', service: 'corte', serviceLabel: 'Corte', name: 'Luis Gómez', phone: '11 4444 4444', note: 'Primera vez', status: 'pendiente', code: 'AG-EF34GH' },
        ];
        pintar();
        return;
      }
      var qs = date ? '?date=' + encodeURIComponent(date) : '';
      App.api('/api/agenda' + qs).then(function (rows) { turnos = rows; pintar(); }).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
    if (inFechaAdm) inFechaAdm.addEventListener('change', cargar);

    if (window.__PREVIEW__) { cargar(); }
    else if (!me || me.role !== 'admin') { location.href = '/auth.html'; }
    else { cargar(); }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navA = document.getElementById('nav-agenda-admin');
    if (navA && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navA.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Agenda de turnos con horarios**: los turnos viven en la colección \`agbookings\`. El visitante saca turno en \`/turnos.html\` eligiendo servicio, profesional y fecha; la grilla marca los horarios ocupados y cada servicio bloquea el tiempo de su duración. El servidor recalcula la disponibilidad al confirmar (responde 409 si el horario se ocupó en el medio) y devuelve un código. ${cfg.moduleIds.includes('auth') ? 'Los administradores ven la agenda del día por profesional y confirman/marcan atendido/cancelan en \`/agenda-admin.html\`.' : 'Para gestionar la agenda desde la web activá el módulo **Autenticación** (habilita \`/agenda-admin.html\`); sin él, los turnos se guardan en \`data/agbookings.json\`.'} Ajustá profesionales, servicios (con su duración), horario de atención y paso de la grilla en las constantes de \`routes/agenda.js\` (y sus espejos en \`public/js/app.js\`).`,
  ],
};
