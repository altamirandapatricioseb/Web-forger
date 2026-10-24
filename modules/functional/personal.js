// Personal y asistencia con backend real: el legajo del equipo y el reloj de fichaje que le faltaba
// al catálogo. Hasta ahora el generador sabía todo sobre los clientes y nada sobre LA GENTE QUE
// TRABAJA — quién está en el legajo, quién entró hoy, cuántas horas lleva el mes. Acá el empleado
// ficha con su propia cuenta desde /fichar.html (un botón que alterna entrada y salida: el servidor
// decide cuál corresponde mirando si tiene un turno abierto, así no se puede fichar dos entradas
// seguidas) y las horas las calcula SIEMPRE el servidor a partir de los pares entrada/salida: nunca
// se guardan como número editable. El vínculo entre la cuenta y el legajo es el EMAIL, así que
// activar el módulo no obliga a crear usuarios nuevos. Un fichaje que quedó sin salida no se
// inventa: se marca "sin salida" y aparece en rojo para que el admin lo corrija a mano, que es lo
// que hace cualquier reloj de verdad. Panel solo-admin /personal-admin.html con KPIs animados
// (Anime.js + red de seguridad), legajo, planilla del mes por empleado, carga manual del fichaje
// olvidado y CSV. Requiere Autenticación. Distinto de "repositores" (asignación a sucursales para
// trabajo de campo) y de "roles" (qué puede tocar cada uno en la trastienda).
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'personal', type: 'functional', name: 'Personal y asistencia',
  description: 'El legajo del equipo y el reloj de fichaje con backend real: cada empleado ficha entrada y salida desde /fichar.html con su propia cuenta (el servidor decide qué corresponde mirando si tiene un turno abierto) y las horas trabajadas las calcula siempre el servidor sumando los pares entrada/salida, nunca se guardan como número editable. El fichaje que quedó sin salida se marca como tal en vez de inventar la hora. Panel solo-admin /personal-admin.html con KPIs animados (Anime.js), legajo con puesto y valor hora, planilla del mes por empleado con costo estimado, corrección manual y CSV. Requiere Autenticación.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/personal', file: 'routes/personal.js' }],
  collections: ['staff', 'shifts'],
  nav: () => [
    { label: 'Fichar', href: '/fichar.html', id: 'nav-fichar' },
    { label: 'Personal (admin)', href: '/personal-admin.html', id: 'nav-personal-admin' },
  ],
  head: () => `  <style>
    .pe-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .pe-kpis .card{text-align:center}
    .pe-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .pe-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .pe-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .pe-chip.dentro{background:#2e9e5b20;color:#1d6b3c}
    .pe-chip.fuera{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .pe-chip.falta{background:#c0392b18;color:#c0392b}
    .pe-reloj{text-align:center;padding:34px 20px}
    .pe-reloj .pe-hora{font-size:3rem;font-weight:700;font-variant-numeric:tabular-nums;line-height:1;margin:0}
    .pe-reloj .pe-dia{color:var(--muted);margin:6px 0 22px}
    /* Sólo la inicial: capitalize pondría mayúscula en cada palabra y en español la fecha
       que devuelve toLocaleDateString es "martes, 21 de julio" (el "de" va en minúscula) */
    .pe-reloj .pe-dia::first-letter{text-transform:uppercase}
    .pe-btn-ficha{font-size:1.05rem;padding:16px 42px}
    .pe-estado{margin:20px 0 0;font-size:.95rem}
    .pe-hoy{margin-top:26px;font-size:.9rem}
    .pe-hoy td,.pe-hoy th{padding:6px 8px}
    .pe-baja{opacity:.55}
  </style>`,
  pages: (cfg) => ({
    'fichar': {
      title: 'Fichar entrada y salida',
      html: `  <section>
    <div class="container" style="max-width:640px">
      <h2>Fichar</h2>
      <p class="section-sub">Marcá tu entrada y tu salida. Las horas las calcula el sistema: no hay nada que anotar a mano.</p>
      <div class="card pe-reloj">
        <p class="pe-hora" id="pe-hora">--:--</p>
        <p class="pe-dia" id="pe-dia"></p>
        <button class="btn pe-btn-ficha" type="button" id="pe-fichar" disabled>Cargando…</button>
        <p class="pe-estado" id="pe-estado"></p>
      </div>
      <div id="pe-mio"></div>
    </div>
  </section>`,
    },
    'personal-admin': {
      title: 'Personal y asistencia',
      html: `  <section>
    <div class="container">
      <h2>Personal y asistencia</h2>
      <p class="section-sub">El legajo del equipo y las horas trabajadas de cada uno. El total del mes lo calcula el servidor sumando los fichajes: no se puede escribir a mano.</p>
      <div id="pe-kpis" class="pe-kpis"></div>

      <div class="card" style="margin-bottom:26px">
        <h3>Agregar al legajo</h3>
        <form id="pe-form">
          <div class="grid cols-2">
            <div><label>Nombre y apellido</label><input name="name" required maxlength="80"></div>
            <div><label>Email (el mismo de su cuenta para poder fichar)</label><input name="email" type="email" required></div>
          </div>
          <div class="grid cols-2">
            <div><label>Puesto</label><input name="position" maxlength="60" placeholder="Vendedora, cocinero, chofer…"></div>
            <div><label>Valor hora (opcional)</label><input name="hourlyRate" type="number" min="0" step="any" placeholder="Para estimar el costo del mes"></div>
          </div>${cfg.moduleIds.includes('branches') ? `
          <label>Sucursal</label>
          <select name="branchId" id="pe-sucursal"><option value="">Sin asignar</option></select>` : ''}
          <div style="margin-top:16px"><button class="btn" type="submit">Agregar</button></div>
        </form>
      </div>

      <h3>${phIcon('users', { size: 18, style: 'vertical-align:-4px;margin-right:8px' })}Legajo</h3>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
        <input id="pe-buscar" placeholder="Buscar por nombre o puesto" style="width:auto;min-width:200px;margin:0">
        <label style="display:flex;align-items:center;gap:6px;font-weight:400;margin:0">
          <input type="checkbox" id="pe-ver-bajas" style="width:auto;margin:0"> Ver también las bajas
        </label>
      </div>
      <div id="pe-legajo"><p class="muted">Cargando…</p></div>

      <h3 style="margin-top:34px">${phIcon('clock', { size: 18, style: 'vertical-align:-4px;margin-right:8px' })}Planilla del mes</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px">
        <div><label style="font-size:.85rem">Mes</label><input type="month" id="pe-mes" style="margin:0"></div>
        <div><label style="font-size:.85rem">Empleado</label><select id="pe-filtro-emp" style="margin:0"><option value="">Todos</option></select></div>
        <button class="btn ghost" type="button" id="pe-csv" style="margin-left:auto">Descargar CSV</button>
      </div>
      <div class="card" style="margin-bottom:18px">
        <h4 style="margin-top:0">Cargar un fichaje a mano</h4>
        <p class="muted" style="font-size:.85rem;margin-top:0">Para el día que alguien se olvidó de fichar. Queda marcado como carga manual.</p>
        <form id="pe-manual">
          <div class="grid cols-2">
            <div><label>Empleado</label><select name="staffId" id="pe-manual-emp" required></select></div>
            <div><label>Fecha</label><input name="date" type="date" required></div>
          </div>
          <div class="grid cols-2">
            <div><label>Entrada</label><input name="inTime" type="time" required></div>
            <div><label>Salida</label><input name="outTime" type="time" required></div>
          </div>
          <label>Motivo</label><input name="note" maxlength="120" placeholder="Se olvidó de fichar, trabajó desde casa…">
          <div style="margin-top:14px"><button class="btn" type="submit">Cargar fichaje</button></div>
        </form>
      </div>
      <div id="pe-planilla"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  files: (cfg) => {
    const conSucursales = cfg.moduleIds.includes('branches');
    return {
      'routes/personal.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, isEmail, num } = require('../src/validate');
const { requireAuth, requireAdmin } = require('../src/middleware/auth');

const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;
const MES = /^\\d{4}-\\d{2}$/;
const HORA = /^\\d{2}:\\d{2}$/;
const hoy = () => new Date().toISOString().slice(0, 10);
// Un turno abierto más viejo que esto ya no es un turno: es un fichaje que quedó sin salida.
const HORAS_MAX = 20;

const mail = (v) => String(v || '').toLowerCase().trim();
// Minutos entre dos marcas ISO, siempre calculados acá: el cliente nunca manda duración.
const minutosEntre = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));

// El turno abierto de un empleado: entrada sin salida y sin marcar como incompleto
async function turnoAbierto(staffId) {
  const abiertos = await db.find('shifts', s => s.staffId === staffId && !s.out && !s.missing);
  return abiertos.sort((a, b) => String(b.in).localeCompare(String(a.in)))[0] || null;
}

// Legajo de la persona que hace el pedido, buscada por el email de su cuenta
async function miLegajo(req) {
  const rows = await db.find('staff', s => mail(s.email) === mail(req.user.email));
  return rows.filter(s => s.active !== false)[0] || rows[0] || null;
}

// Minutos trabajados en un mes (YYYY-MM) por empleado
function minutosDelMes(shifts, mes) {
  return shifts.filter(s => String(s.date).slice(0, 7) === mes && !s.missing)
    .reduce((t, s) => t + (Number(s.minutes) || 0), 0);
}

/* ---------- lo que usa el propio empleado ---------- */

// GET /api/personal/mi — mi estado actual, mis fichajes de hoy y mis horas del mes
router.get('/mi', requireAuth, async (req, res) => {
  const yo = await miLegajo(req);
  if (!yo) return res.status(403).json({ error: 'Tu cuenta no figura en el legajo: pedile al administrador que te agregue con este mismo email' });
  if (yo.active === false) return res.status(403).json({ error: 'Tu legajo está dado de baja' });
  const mios = await db.find('shifts', s => s.staffId === yo.id);
  const abierto = await turnoAbierto(yo.id);
  const delDia = mios.filter(s => s.date === hoy()).sort((a, b) => String(a.in).localeCompare(String(b.in)));
  res.json({
    staff: { id: yo.id, name: yo.name, position: yo.position || '' },
    abierto: abierto ? { in: abierto.in, minutos: minutosEntre(abierto.in, new Date().toISOString()) } : null,
    hoy: delDia,
    minutosHoy: delDia.filter(s => !s.missing).reduce((t, s) => t + (Number(s.minutes) || 0), 0),
    minutosMes: minutosDelMes(mios, hoy().slice(0, 7)),
  });
});

// POST /api/personal/fichar — alterna entrada y salida. El servidor decide cuál corresponde:
// así nadie puede fichar dos entradas seguidas ni una salida sin haber entrado.
router.post('/fichar', requireAuth, async (req, res) => {
  const yo = await miLegajo(req);
  if (!yo) return res.status(403).json({ error: 'Tu cuenta no figura en el legajo: pedile al administrador que te agregue con este mismo email' });
  if (yo.active === false) return res.status(403).json({ error: 'Tu legajo está dado de baja' });
  const ahora = new Date().toISOString();
  const abierto = await turnoAbierto(yo.id);

  if (abierto) {
    const mins = minutosEntre(abierto.in, ahora);
    // Turno eterno: no se inventa la hora de salida. Queda marcado para que el admin lo corrija.
    if (mins > HORAS_MAX * 60) {
      await db.update('shifts', abierto.id, { missing: true, minutes: 0 });
      const nuevo = await db.insert('shifts', {
        staffId: yo.id, staffName: yo.name, date: hoy(), in: ahora, out: '', minutes: 0,
        branchId: yo.branchId || '', source: 'ficha', note: '', missing: false,
      });
      return res.status(201).json({ accion: 'entrada', shift: nuevo, avisoSinSalida: true });
    }
    // Doble toque: no se registra un turno de cero minutos
    if (mins < 1) return res.status(409).json({ error: 'Acabás de fichar hace menos de un minuto' });
    const cerrado = await db.update('shifts', abierto.id, { out: ahora, minutes: mins });
    return res.json({ accion: 'salida', shift: cerrado, minutos: mins });
  }

  const nuevo = await db.insert('shifts', {
    staffId: yo.id, staffName: yo.name, date: hoy(), in: ahora, out: '', minutes: 0,
    branchId: yo.branchId || '', source: 'ficha', note: '', missing: false,
  });
  res.status(201).json({ accion: 'entrada', shift: nuevo });
});

/* ---------- legajo (solo admin) ---------- */

// GET /api/personal — legajo con estado actual y horas del mes de cada uno
router.get('/', requireAdmin, async (req, res) => {
  const mes = MES.test(String(req.query.mes || '')) ? req.query.mes : hoy().slice(0, 7);
  const todos = await db.all('staff');
  const shifts = await db.all('shifts');
  let rows = todos;
  if (req.query.bajas !== '1') rows = rows.filter(s => s.active !== false);
  const q = String(req.query.q || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim();
  if (q) rows = rows.filter(s => (s.name + ' ' + (s.position || '') + ' ' + s.email).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').includes(q));
  res.json(rows.map(s => {
    const suyos = shifts.filter(x => x.staffId === s.id);
    const abierto = suyos.filter(x => !x.out && !x.missing)[0] || null;
    const minutos = minutosDelMes(suyos, mes);
    return {
      ...s,
      dentro: Boolean(abierto),
      desde: abierto ? abierto.in : '',
      minutosMes: minutos,
      sinSalida: suyos.filter(x => x.missing && String(x.date).slice(0, 7) === mes).length,
      costoMes: s.hourlyRate ? Math.round((minutos / 60) * Number(s.hourlyRate)) : 0,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'es')));
});

// GET /api/personal/resumen — KPIs del mes (los calcula el servidor, no la pantalla)
router.get('/resumen', requireAdmin, async (req, res) => {
  const mes = MES.test(String(req.query.mes || '')) ? req.query.mes : hoy().slice(0, 7);
  const activos = (await db.all('staff')).filter(s => s.active !== false);
  const shifts = await db.all('shifts');
  const dentro = activos.filter(s => shifts.some(x => x.staffId === s.id && !x.out && !x.missing));
  const delMes = shifts.filter(s => String(s.date).slice(0, 7) === mes && !s.missing);
  const fichaonHoy = new Set(shifts.filter(s => s.date === hoy()).map(s => s.staffId));
  res.json({
    activos: activos.length,
    dentro: dentro.length,
    horasMes: Math.round(delMes.reduce((t, s) => t + (Number(s.minutes) || 0), 0) / 60),
    sinFicharHoy: activos.filter(s => !fichaonHoy.has(s.id)).length,
    sinSalida: shifts.filter(s => s.missing && String(s.date).slice(0, 7) === mes).length,
  });
});

// POST /api/personal — alta en el legajo (idempotente por email: no se duplica una persona)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, { name: (v) => str(v, 2, 80), email: isEmail });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const email = mail(req.body.email);
  const ya = (await db.all('staff')).filter(s => mail(s.email) === email)[0];
  if (ya) return res.status(409).json({ error: 'Ya hay alguien en el legajo con ese email' });
  const rate = Number(req.body.hourlyRate);
  const row = await db.insert('staff', {
    name: String(req.body.name).trim(),
    email,
    position: String(req.body.position || '').trim().slice(0, 60),
    hourlyRate: isFinite(rate) && rate > 0 ? Math.round(rate * 100) / 100 : 0,
    branchId: String(req.body.branchId || ''),
    active: true,
  });
  res.status(201).json(row);
});

// PUT /api/personal/:id — edita el legajo (el email también: la gente cambia de cuenta)
router.put('/:id', requireAdmin, async (req, res) => {
  const s = await db.get('staff', req.params.id);
  if (!s) return res.status(404).json({ error: 'Esa persona no está en el legajo' });
  const patch = {};
  if (req.body.name !== undefined) {
    if (!str(req.body.name, 2, 80)) return res.status(422).json({ error: 'Nombre inválido' });
    patch.name = String(req.body.name).trim();
  }
  if (req.body.email !== undefined) {
    if (!isEmail(req.body.email)) return res.status(422).json({ error: 'Email inválido' });
    const email = mail(req.body.email);
    if ((await db.all('staff')).some(x => x.id !== s.id && mail(x.email) === email)) {
      return res.status(409).json({ error: 'Ya hay alguien en el legajo con ese email' });
    }
    patch.email = email;
  }
  if (req.body.position !== undefined) patch.position = String(req.body.position).trim().slice(0, 60);
  if (req.body.branchId !== undefined) patch.branchId = String(req.body.branchId || '');
  if (req.body.hourlyRate !== undefined) {
    const rate = Number(req.body.hourlyRate);
    if (!num(rate, 0, 100000000)) return res.status(422).json({ error: 'Valor hora inválido' });
    patch.hourlyRate = Math.round(rate * 100) / 100;
  }
  if (req.body.active !== undefined) patch.active = Boolean(req.body.active);
  const row = await db.update('staff', s.id, patch);
  // El nombre viaja también a los fichajes ya registrados: la planilla vieja no puede quedar
  // con el nombre anterior (es el mismo dato, no una foto del pasado).
  if (patch.name) {
    for (const sh of await db.find('shifts', x => x.staffId === s.id)) {
      await db.update('shifts', sh.id, { staffName: patch.name });
    }
  }
  res.json(row);
});

// DELETE /api/personal/:id — baja. Si tiene fichajes es BAJA LÓGICA: borrarlos rompería la
// planilla de meses ya cerrados. Sin fichajes, se borra de verdad.
router.delete('/:id', requireAdmin, async (req, res) => {
  const s = await db.get('staff', req.params.id);
  if (!s) return res.status(404).json({ error: 'Esa persona no está en el legajo' });
  const tiene = (await db.find('shifts', x => x.staffId === s.id)).length;
  if (tiene) {
    const row = await db.update('staff', s.id, { active: false });
    return res.json({ ok: true, baja: 'logica', shifts: tiene, staff: row });
  }
  await db.remove('staff', s.id);
  res.json({ ok: true, baja: 'definitiva' });
});

/* ---------- planilla de fichajes (solo admin) ---------- */

// GET /api/personal/registros?mes=&empleado= — los fichajes del período
router.get('/registros', requireAdmin, async (req, res) => {
  const mes = MES.test(String(req.query.mes || '')) ? req.query.mes : hoy().slice(0, 7);
  let rows = await db.find('shifts', s => String(s.date).slice(0, 7) === mes);
  if (req.query.empleado) rows = rows.filter(s => s.staffId === req.query.empleado);
  rows.sort((a, b) => String(b.date + b.in).localeCompare(String(a.date + a.in)));
  res.json({
    mes,
    total: rows.filter(s => !s.missing).reduce((t, s) => t + (Number(s.minutes) || 0), 0),
    rows,
  });
});

// POST /api/personal/registros — carga manual del fichaje olvidado
router.post('/registros', requireAdmin, async (req, res) => {
  const s = await db.get('staff', String(req.body.staffId || ''));
  if (!s) return res.status(404).json({ error: 'Elegí un empleado del legajo' });
  const date = String(req.body.date || '');
  if (!FECHA.test(date)) return res.status(422).json({ error: 'Fecha inválida' });
  if (date > hoy()) return res.status(422).json({ error: 'No se pueden cargar fichajes a futuro' });
  const inT = String(req.body.inTime || ''), outT = String(req.body.outTime || '');
  if (!HORA.test(inT) || !HORA.test(outT)) return res.status(422).json({ error: 'Horas inválidas (formato HH:MM)' });
  if (outT <= inT) return res.status(422).json({ error: 'La salida tiene que ser posterior a la entrada' });
  const ini = date + 'T' + inT + ':00', fin = date + 'T' + outT + ':00';
  const row = await db.insert('shifts', {
    staffId: s.id, staffName: s.name, date,
    in: new Date(ini).toISOString(), out: new Date(fin).toISOString(),
    minutes: minutosEntre(ini, fin),
    branchId: s.branchId || '', source: 'manual',
    note: String(req.body.note || '').trim().slice(0, 120), missing: false,
    author: req.user.name,
  });
  res.status(201).json(row);
});

// PATCH /api/personal/registros/:id — completa la salida de un fichaje que quedó abierto
router.patch('/registros/:id', requireAdmin, async (req, res) => {
  const sh = await db.get('shifts', req.params.id);
  if (!sh) return res.status(404).json({ error: 'Fichaje inexistente' });
  const outT = String(req.body.outTime || '');
  if (!HORA.test(outT)) return res.status(422).json({ error: 'Hora inválida (formato HH:MM)' });
  const fin = sh.date + 'T' + outT + ':00';
  const mins = minutosEntre(sh.in, fin);
  if (mins < 1) return res.status(422).json({ error: 'La salida tiene que ser posterior a la entrada' });
  const row = await db.update('shifts', sh.id, {
    out: new Date(fin).toISOString(), minutes: mins, missing: false,
    note: (sh.note ? sh.note + ' · ' : '') + 'salida completada a mano',
  });
  res.json(row);
});

// DELETE /api/personal/registros/:id — borra un fichaje mal cargado
router.delete('/registros/:id', requireAdmin, async (req, res) => {
  const sh = await db.get('shifts', req.params.id);
  if (!sh) return res.status(404).json({ error: 'Fichaje inexistente' });
  await db.remove('shifts', sh.id);
  res.json({ ok: true });
});
${conSucursales ? `
// GET /api/personal/sucursales — para asignar cada persona a su local
router.get('/sucursales', requireAdmin, async (req, res) => {
  const rows = await db.all('branches');
  res.json(rows.map(b => ({ id: b.id, name: b.name })));
});
` : ''}
module.exports = router;
`,
    };
  },
  clientJs: (cfg) => `/* Módulo personal y asistencia: reloj de fichaje del empleado (/fichar.html) y panel admin con
   legajo, planilla del mes, carga manual y CSV. KPIs con count-up (Anime.js + red de seguridad).
   En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };
  var hhmm = function (iso) { try { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return '—'; } };
  var fecha = function (d) { try { return new Date(d + 'T12:00:00').toLocaleDateString('es-AR'); } catch (e) { return d; } };
  var horas = function (min) {
    var m = Math.max(0, Math.round(Number(min) || 0));
    return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm';
  };

  function contar(el, valor, sufijo) {
    var pintar = function (v) { el.textContent = Math.round(v) + (sufijo || ''); };
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { pintar(valor); return; }
    var obj = { v: 0 };
    anime.animate(obj, { v: valor, duration: 700, ease: 'outCubic', onUpdate: function () { pintar(obj.v); } });
    setTimeout(function () { pintar(valor); }, 900);
  }

  /* ----- reloj de fichaje del empleado ----- */
  (function () {
    var btn = document.getElementById('pe-fichar');
    if (!btn) return;
    var estado = document.getElementById('pe-estado');
    var mio = document.getElementById('pe-mio');
    var datos = null;

    function reloj() {
      var h = document.getElementById('pe-hora'), d = document.getElementById('pe-dia');
      var ahora = new Date();
      if (h) h.textContent = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      if (d) d.textContent = ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    reloj();
    setInterval(reloj, 20000);

    function pintar() {
      if (!datos) return;
      var dentro = Boolean(datos.abierto);
      btn.disabled = false;
      btn.textContent = dentro ? 'Fichar salida' : 'Fichar entrada';
      btn.className = 'btn pe-btn-ficha' + (dentro ? ' ghost' : '');
      if (estado) {
        estado.innerHTML = dentro
          ? 'Entraste a las <strong>' + hhmm(datos.abierto.in) + '</strong> · llevás ' + horas(datos.abierto.minutos)
          : '<span class="muted">No estás fichado ahora mismo.</span>';
      }
      if (mio) {
        var filas = (datos.hoy || []).map(function (s) {
          return '<tr><td>' + hhmm(s.in) + '</td><td>' + (s.out ? hhmm(s.out) : (s.missing ? '<span class="pe-chip falta">sin salida</span>' : '<span class="pe-chip dentro">en curso</span>')) + '</td>' +
            '<td class="pe-num">' + (s.out ? horas(s.minutes) : '—') + '</td></tr>';
        }).join('');
        mio.innerHTML = '<div class="card pe-hoy"><h3 style="margin-top:0">Tus horas</h3>' +
          '<p class="muted" style="margin-top:0">Hoy: <strong>' + horas(datos.minutosHoy) + '</strong> · Este mes: <strong>' + horas(datos.minutosMes) + '</strong></p>' +
          (filas ? '<table><thead><tr><th>Entrada</th><th>Salida</th><th class="pe-num">Total</th></tr></thead><tbody>' + filas + '</tbody></table>' : '<p class="muted">Todavía no fichaste hoy.</p>') +
          '</div>';
      }
    }

    async function cargar() {
      if (window.__PREVIEW__) {
        datos = { staff: { name: 'Empleado de ejemplo' }, abierto: null, hoy: [], minutosHoy: 0, minutosMes: 0 };
        pintar();
        return;
      }
      try { datos = await App.api('/api/personal/mi'); pintar(); }
      catch (err) {
        if (err.message === 'preview') return;
        btn.disabled = true;
        btn.textContent = 'No disponible';
        if (estado) estado.innerHTML = '<span class="muted">' + App.esc(err.message) + '</span>';
      }
    }

    btn.addEventListener('click', async function () {
      if (window.__PREVIEW__) { App.toast('Vista previa: se registraría el fichaje'); return; }
      btn.disabled = true;
      try {
        var r = await App.api('/api/personal/fichar', { method: 'POST' });
        App.toast(r.accion === 'entrada'
          ? (r.avisoSinSalida ? 'Entrada registrada (el turno anterior quedó sin salida: avisale al administrador)' : 'Entrada registrada')
          : 'Salida registrada · ' + horas(r.minutos));
        var anime = window.anime;
        if (anime && anime.animate && !reduce) {
          anime.animate(btn, { scale: [1, 1.08, 1], duration: 420, ease: 'outBack' });
          setTimeout(function () { btn.style.transform = ''; }, 600);
        }
        await cargar();
      } catch (err) {
        btn.disabled = false;
        if (err.message !== 'preview') App.toast(err.message);
      }
    });

    cargar();
    // El estado se refresca solo: si el turno sigue abierto, el "llevás X" tiene que avanzar
    setInterval(function () { if (!window.__PREVIEW__ && datos && datos.abierto) cargar(); }, 60000);
  })();

  /* ----- panel admin ----- */
  (function () {
    var box = document.getElementById('pe-legajo');
    if (!box) return;
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      return;
    }
    var legajo = [], planilla = { rows: [], total: 0 };

    function mesActual() {
      var m = document.getElementById('pe-mes');
      return (m && m.value) || new Date().toISOString().slice(0, 7);
    }

    function pintarKpis(r) {
      var cont = document.getElementById('pe-kpis');
      if (!cont) return;
      var datos = [['En el legajo', r.activos, ''], ['Trabajando ahora', r.dentro, ''], ['Horas del mes', r.horasMes, 'h'], ['Sin fichar hoy', r.sinFicharHoy, ''], ['Fichajes sin salida', r.sinSalida, '']];
      cont.innerHTML = datos.map(function (d) {
        return '<div class="card"><strong data-pe-kpi="' + d[1] + '" data-pe-suf="' + d[2] + '">0</strong><span class="muted">' + d[0] + '</span></div>';
      }).join('');
      cont.querySelectorAll('[data-pe-kpi]').forEach(function (el) {
        contar(el, Number(el.getAttribute('data-pe-kpi')), el.getAttribute('data-pe-suf'));
      });
    }

    function pintarLegajo() {
      box.innerHTML = App.table(legajo, [
        { label: 'Persona', render: function (s) {
          return '<strong>' + App.esc(s.name) + '</strong>' + (s.position ? '<br><span class="muted" style="font-size:.8rem">' + App.esc(s.position) + '</span>' : '') +
            '<br><span class="muted" style="font-size:.78rem">' + App.esc(s.email) + '</span>';
        } },
        { label: 'Estado', render: function (s) {
          if (s.active === false) return '<span class="pe-chip fuera">baja</span>';
          return s.dentro ? '<span class="pe-chip dentro">dentro desde ' + hhmm(s.desde) + '</span>' : '<span class="pe-chip fuera">fuera</span>';
        } },
        { label: 'Horas del mes', render: function (s) {
          return '<span class="pe-num">' + horas(s.minutosMes) + (s.sinSalida ? ' <span class="pe-chip falta">' + s.sinSalida + ' sin salida</span>' : '') + '</span>';
        } },
        { label: 'Costo estimado', render: function (s) { return '<span class="pe-num">' + (s.costoMes ? App.money(s.costoMes) : '—') + '</span>'; } },
        { label: '', render: function (s) {
          return '<button class="btn ghost" type="button" data-pe-edit="' + s.id + '">Editar</button> ' +
            '<button class="btn ghost" type="button" data-pe-del="' + s.id + '">Baja</button>';
        } },
      ]);
      box.querySelectorAll('tbody tr').forEach(function (tr, i) {
        if (legajo[i] && legajo[i].active === false) tr.classList.add('pe-baja');
      });
      box.querySelectorAll('[data-pe-edit]').forEach(function (b) {
        b.addEventListener('click', function () { editar(b.getAttribute('data-pe-edit')); });
      });
      box.querySelectorAll('[data-pe-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Dar de baja a esta persona? Si tiene fichajes, la planilla se conserva.')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se daría de baja'); return; }
          try {
            var r = await App.api('/api/personal/' + b.getAttribute('data-pe-del'), { method: 'DELETE' });
            App.toast(r.baja === 'logica' ? 'Dada de baja (se conservan ' + r.shifts + ' fichajes)' : 'Borrada del legajo');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      // Los selectores de empleado se rearman con el legajo vivo
      var opts = '<option value="">Todos</option>' + legajo.filter(function (s) { return s.active !== false; })
        .map(function (s) { return '<option value="' + attr(s.id) + '">' + App.esc(s.name) + '</option>'; }).join('');
      var filtro = document.getElementById('pe-filtro-emp');
      if (filtro) { var v = filtro.value; filtro.innerHTML = opts; filtro.value = v; }
      var manual = document.getElementById('pe-manual-emp');
      if (manual) {
        var v2 = manual.value;
        manual.innerHTML = '<option value="">Elegí…</option>' + legajo.filter(function (s) { return s.active !== false; })
          .map(function (s) { return '<option value="' + attr(s.id) + '">' + App.esc(s.name) + '</option>'; }).join('');
        manual.value = v2;
      }
    }

    async function editar(id) {
      var s = legajo.filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      var nombre = prompt('Nombre', s.name);
      if (nombre === null) return;
      var puesto = prompt('Puesto', s.position || '');
      if (puesto === null) return;
      var rate = prompt('Valor hora (0 para no calcular costo)', String(s.hourlyRate || 0));
      if (rate === null) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría'); return; }
      try {
        await App.api('/api/personal/' + id, { method: 'PUT', body: { name: nombre, position: puesto, hourlyRate: Number(rate) || 0, active: true } });
        App.toast('Legajo actualizado');
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    function pintarPlanilla() {
      var cont = document.getElementById('pe-planilla');
      if (!cont) return;
      var filas = planilla.rows.map(function (s) {
        return '<tr><td>' + fecha(s.date) + '</td><td>' + App.esc(s.staffName) + '</td>' +
          '<td>' + hhmm(s.in) + '</td>' +
          '<td>' + (s.out ? hhmm(s.out) : (s.missing ? '<span class="pe-chip falta">sin salida</span>' : '<span class="pe-chip dentro">en curso</span>')) + '</td>' +
          '<td class="pe-num">' + (s.out ? horas(s.minutes) : '—') + '</td>' +
          '<td>' + (s.source === 'manual' ? '<span class="pe-chip fuera">manual</span>' : '') + (s.note ? ' <span class="muted" style="font-size:.78rem">' + App.esc(s.note) + '</span>' : '') + '</td>' +
          '<td>' + (s.missing ? '<button class="btn ghost" type="button" data-pe-fix="' + s.id + '">Completar</button> ' : '') +
          '<button class="btn ghost" type="button" data-pe-delreg="' + s.id + '">Borrar</button></td></tr>';
      }).join('');
      cont.innerHTML = planilla.rows.length
        ? '<div class="card" style="overflow:auto;padding:0"><table><thead><tr><th>Fecha</th><th>Persona</th><th>Entrada</th><th>Salida</th><th class="pe-num">Total</th><th>Origen</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
          '<p class="pe-num" style="font-size:1.05rem;font-weight:700;margin-top:10px">Total del período: ' + horas(planilla.total) + '</p>'
        : '<p class="muted">Sin fichajes en el período elegido.</p>';
      cont.querySelectorAll('[data-pe-fix]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var h = prompt('¿A qué hora salió? (HH:MM)', '18:00');
          if (!h) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se completaría'); return; }
          try { await App.api('/api/personal/registros/' + b.getAttribute('data-pe-fix'), { method: 'PATCH', body: { outTime: h } }); App.toast('Fichaje completado'); await cargar(); }
          catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      cont.querySelectorAll('[data-pe-delreg]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar este fichaje?')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try { await App.api('/api/personal/registros/' + b.getAttribute('data-pe-delreg'), { method: 'DELETE' }); App.toast('Fichaje borrado'); await cargar(); }
          catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function cargar() {
      var mes = mesActual();
      var q = (document.getElementById('pe-buscar') || {}).value || '';
      var bajas = (document.getElementById('pe-ver-bajas') || {}).checked;
      var emp = (document.getElementById('pe-filtro-emp') || {}).value || '';
      if (window.__PREVIEW__) {
        legajo = [{ id: '1', name: 'Empleada de ejemplo', email: 'empleada@mail.com', position: 'Atención al público', hourlyRate: 3000, active: true, dentro: true, desde: new Date().toISOString(), minutosMes: 8400, sinSalida: 0, costoMes: 420000 }];
        planilla = { mes: mes, total: 480, rows: [{ id: 'a', date: new Date().toISOString().slice(0, 10), staffName: 'Empleada de ejemplo', in: new Date().toISOString(), out: '', minutes: 0, missing: false, source: 'ficha', note: '' }] };
        pintarKpis({ activos: 1, dentro: 1, horasMes: 140, sinFicharHoy: 0, sinSalida: 0 });
      } else {
        try {
          var qs = ['mes=' + encodeURIComponent(mes)];
          if (q) qs.push('q=' + encodeURIComponent(q));
          if (bajas) qs.push('bajas=1');
          legajo = await App.api('/api/personal?' + qs.join('&'));
          pintarKpis(await App.api('/api/personal/resumen?mes=' + encodeURIComponent(mes)));
          planilla = await App.api('/api/personal/registros?mes=' + encodeURIComponent(mes) + (emp ? '&empleado=' + encodeURIComponent(emp) : ''));
        } catch (err) {
          if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
          return;
        }
      }
      pintarLegajo();
      pintarPlanilla();
    }

    var form = document.getElementById('pe-form');
    if (form) form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: se agregaría al legajo'); return; }
      try {
        await App.api('/api/personal', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
        form.reset();
        App.toast('Agregada al legajo');
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var manual = document.getElementById('pe-manual');
    if (manual) manual.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: se cargaría el fichaje'); return; }
      try {
        await App.api('/api/personal/registros', { method: 'POST', body: Object.fromEntries(new FormData(manual)) });
        manual.reset();
        App.toast('Fichaje cargado');
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var mesInput = document.getElementById('pe-mes');
    if (mesInput) { mesInput.value = new Date().toISOString().slice(0, 7); mesInput.addEventListener('change', cargar); }
    var filtro = document.getElementById('pe-filtro-emp');
    if (filtro) filtro.addEventListener('change', cargar);
    var buscar = document.getElementById('pe-buscar');
    if (buscar) buscar.addEventListener('input', function () { clearTimeout(buscar._t); buscar._t = setTimeout(cargar, 250); });
    var bajas = document.getElementById('pe-ver-bajas');
    if (bajas) bajas.addEventListener('change', cargar);

    var csv = document.getElementById('pe-csv');
    if (csv) csv.addEventListener('click', function () {
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [['Fecha', 'Persona', 'Entrada', 'Salida', 'Minutos', 'Horas', 'Origen', 'Nota'].map(celda).join(';')];
      planilla.rows.forEach(function (s) {
        lineas.push([s.date, s.staffName, hhmm(s.in), s.out ? hhmm(s.out) : '', s.minutes || 0, horas(s.minutes), s.source === 'manual' ? 'manual' : 'fichaje', s.note || ''].map(celda).join(';'));
      });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'asistencia-' + mesActual() + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });
${cfg.moduleIds.includes('branches') ? `
    // Con sucursales activas, cada persona se asigna a su local
    (async function () {
      var sel = document.getElementById('pe-sucursal');
      if (!sel) return;
      var lista = [];
      if (window.__PREVIEW__) lista = [{ id: '1', name: 'Casa central' }];
      else { try { lista = await App.api('/api/personal/sucursales'); } catch (err) { return; } }
      sel.innerHTML = '<option value="">Sin asignar</option>' + lista.map(function (b) {
        return '<option value="' + attr(b.id) + '">' + App.esc(b.name) + '</option>';
      }).join('');
    })();
` : ''}
    cargar();
  })();
})();`,
  readmeNotes: (cfg) => [
    `**Personal y asistencia**: el legajo se administra en \`/personal-admin.html\` (solo admin) y cada empleado ficha en \`/fichar.html\` con su propia cuenta. El vínculo entre la cuenta y el legajo es el **email**: cargá a la persona con el mismo email con el que inicia sesión, o no va a poder fichar. Las horas **las calcula el servidor** sumando los pares entrada/salida: no hay ningún campo de horas que se pueda escribir a mano. Si alguien se olvida de marcar la salida, el turno queda como **"sin salida"** (no se inventa una hora) y se completa desde la planilla del panel. Dar de baja a alguien que ya fichó es **baja lógica**: la planilla de los meses pasados no se toca.${cfg.moduleIds.includes('branches') ? ' Con **Sucursales** activo podés asignar cada persona a su local y el fichaje queda registrado con esa sucursal.' : ''}`,
  ],
};
