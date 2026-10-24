// Horarios de atención administrables con backend real: la tabla del módulo UI hours traía las
// filas HORNEADAS en el HTML y el cartel "Abierto ahora" lo calculaba el RELOJ DEL VISITANTE, así
// que un negocio que cambiaba el horario de verano tenía que regenerar el sitio, y un visitante con
// la computadora en otra zona horaria veía "Abierto" con el local cerrado. Acá los horarios viven
// en la colección openhours, GET /api/horarios es público y el cliente REESCRIBE EN VIVO la tabla
// conservando los atributos data-dias / data-abre / data-cierra que el módulo hours usa como única
// fuente de verdad: por eso su recálculo por minuto sigue funcionando sobre las filas nuevas, sin
// tocar una línea de ese módulo.
// Las dos piezas que lo hacen útil de verdad y que no se pueden resolver en el front:
//   1. FERIADOS Y CIERRES EXCEPCIONALES. "Cerrado el 25 de diciembre" o "el 24 abrimos hasta las
//      13" es exactamente lo que el cliente llama a preguntar. El feriado de hoy pisa la fila del
//      día (el cliente le saca el horario a las filas que cubren hoy y agrega la del feriado), así
//      que el cartel del módulo hours dice "Cerrado" sin saber nada de feriados.
//   2. EL VEREDICTO LO DA EL SERVIDOR, con su reloj y con la zona horaria del NEGOCIO (guardada en
//      minutos de diferencia con UTC, porque en Vercel el servidor corre en UTC y un local de
//      Buenos Aires cerraría tres horas antes). Además calcula "cierra a las 18:00" y "abre el
//      martes a las 09:00" recorriendo los próximos 7 días con los feriados aplicados.
// Panel solo-admin /horarios-admin.html, animado con Anime.js + red de seguridad. Requiere la
// sección de horarios de atención (hours).
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'horarios', type: 'functional', name: 'Horarios y feriados administrables',
  description: 'Los horarios de atención se guardan en el backend (colección openhours) y se inyectan en vivo sobre la tabla del sitio: el negocio los edita en /horarios-admin.html y el visitante los ve al instante, sin regenerar. Suma lo que el front solo no puede: feriados y cierres excepcionales por fecha (con horario especial opcional) que pisan el día, y el veredicto "Abierto ahora / Cerrado" calculado por el SERVIDOR con la zona horaria del negocio (no con el reloj del visitante), incluyendo a qué hora cierra hoy o cuándo vuelve a abrir. GET /api/horarios es público; la edición es solo-admin. Animado con Anime.js.',
  usesAnime: true,
  requires: ['hours'],
  mounts: [{ route: '/api/horarios', file: 'routes/horarios.js' }],
  collections: ['openhours'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Horarios', href: '/horarios-admin.html', id: 'nav-horarios-admin' }] : [],
  head: () => `  <style>
    .hr-extra{margin-top:12px;font-size:.9rem}
    .hr-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .hr-chip.abierto{background:#2e9e5b20;color:#1d6b3c}
    .hr-chip.cerrado{background:#c0392b18;color:#c0392b}
    .hr-chip.feriado{background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}
    .hr-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .hr-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .hr-hora{font-variant-numeric:tabular-nums;white-space:nowrap}
  </style>`,
  files: (cfg) => ({
    'routes/horarios.js': `const router = require('express').Router();
const db = require('../src/db');
const { str, num } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Se siembran las mismas filas que hornea la sección más la configuración de zona horaria:
// así la primera carga del sitio no parpadea mostrando primero el HTML y después otros datos.
db.seedIfEmpty('openhours', [
  { kind: 'cfg', tzOffsetMin: -180 },
  { kind: 'row', label: 'Lunes a viernes', spec: '1-5', open: '09:00', close: '18:00', order: 1 },
  { kind: 'row', label: 'Sábados', spec: '6', open: '09:00', close: '13:00', order: 2 },
  { kind: 'row', label: 'Domingos', spec: '0', open: '', close: '', order: 3 },
]);

const HORA = /^([01]\\d|2[0-3]):[0-5]\\d$/;
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;
// Días de la semana como los numera Date: "1-5" (rango) o "0,6" (lista), o combinaciones
const SPEC = /^\\d(-\\d)?(,\\d(-\\d)?)*$/;
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const minutos = (hhmm) => Number(String(hhmm).slice(0, 2)) * 60 + Number(String(hhmm).slice(3, 5));
const hhmm = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

// ¿El día d (0-6) entra en la spec "1-5" o "0,6"? Misma regla que usa la tabla del sitio
function cubre(spec, d) {
  return String(spec).split(',').some((parte) => {
    const r = parte.split('-');
    return r.length === 2 ? d >= +r[0] && d <= +r[1] : d === +parte;
  });
}

// La hora del NEGOCIO, no la del servidor: en Vercel el proceso corre en UTC y un local de Buenos
// Aires cerraría tres horas antes. Se desplaza el instante y se leen los getters UTC.
function ahoraNegocio(offsetMin) {
  const d = new Date(Date.now() + offsetMin * 60000);
  return {
    fecha: d.toISOString().slice(0, 10),
    dow: d.getUTCDay(),
    min: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

// Suma días a una fecha ISO sin pasar por husos horarios (todo en UTC)
function masDias(fechaISO, n) {
  return new Date(Date.parse(fechaISO + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}
const dowDe = (fechaISO) => new Date(Date.parse(fechaISO + 'T00:00:00Z')).getUTCDay();

async function estado() {
  const todo = await db.all('openhours');
  const cfg = todo.find(r => r.kind === 'cfg') || { tzOffsetMin: -180 };
  const rows = todo.filter(r => r.kind === 'row')
    .map(r => ({ id: r.id, label: r.label || '', spec: r.spec || '0', open: r.open || '', close: r.close || '', order: Number(r.order) || 0 }))
    .sort((a, b) => a.order - b.order);
  const feriados = todo.filter(r => r.kind === 'holiday')
    .map(r => ({ id: r.id, date: r.date, label: r.label || '', open: r.open || '', close: r.close || '' }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { cfg, rows, feriados, porFecha: Object.fromEntries(feriados.map(f => [f.date, f])) };
}

// Intervalos de atención de una fecha concreta, con el feriado ya aplicado (si lo hay).
// Un feriado sin horario significa cerrado todo el día: devuelve la lista vacía.
function intervalos(fechaISO, rows, porFecha) {
  const f = porFecha[fechaISO];
  if (f) return f.open && f.close ? [[minutos(f.open), minutos(f.close)]] : [];
  const d = dowDe(fechaISO);
  return rows.filter(r => r.open && r.close && cubre(r.spec, d))
    .map(r => [minutos(r.open), minutos(r.close)])
    .sort((a, b) => a[0] - b[0]);
}

// GET /api/horarios — público: la tabla, los próximos feriados y el veredicto del servidor
router.get('/', async (req, res) => {
  const { cfg, rows, feriados, porFecha } = await estado();
  const ahora = ahoraNegocio(Number(cfg.tzOffsetMin) || 0);
  const deHoy = intervalos(ahora.fecha, rows, porFecha);
  const abiertoEn = deHoy.find(([a, b]) => ahora.min >= a && ahora.min < b) || null;
  const feriadoHoy = porFecha[ahora.fecha] || null;

  // Si está cerrado, se busca la próxima apertura recorriendo hasta 7 días con feriados aplicados
  let proxima = null;
  if (!abiertoEn) {
    for (let k = 0; k < 8 && !proxima; k++) {
      const fecha = masDias(ahora.fecha, k);
      for (const [a] of intervalos(fecha, rows, porFecha)) {
        if (k === 0 && a <= ahora.min) continue;
        proxima = { fecha, hora: hhmm(a), dia: k === 0 ? 'hoy' : (k === 1 ? 'mañana' : DIAS[dowDe(fecha)]) };
        break;
      }
    }
  }

  res.json({
    rows: rows.map(({ id, label, spec, open, close }) => ({ id, label, spec, open, close })),
    // Sólo se publican los feriados de hoy en adelante: los pasados son ruido para el visitante
    feriados: feriados.filter(f => f.date >= ahora.fecha).slice(0, 12),
    hoy: {
      fecha: ahora.fecha,
      dow: ahora.dow,
      hora: hhmm(ahora.min),
      abierto: !!abiertoEn,
      cierraA: abiertoEn ? hhmm(abiertoEn[1]) : '',
      feriado: feriadoHoy ? { label: feriadoHoy.label, open: feriadoHoy.open, close: feriadoHoy.close } : null,
      proxima,
    },
  });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/horarios/config — el panel necesita también la zona horaria y los feriados pasados
router.get('/config', requireAdmin, async (req, res) => {
  const { cfg, rows, feriados } = await estado();
  res.json({ tzOffsetMin: Number(cfg.tzOffsetMin) || 0, rows, feriados });
});

// PUT /api/horarios/config — zona horaria del negocio, en minutos de diferencia con UTC
router.put('/config', requireAdmin, async (req, res) => {
  const v = Number(req.body.tzOffsetMin);
  if (!num(v, -720, 840)) return res.status(422).json({ error: 'Diferencia horaria inválida (entre -720 y +840 minutos)' });
  const todo = await db.all('openhours');
  const cfg = todo.find(r => r.kind === 'cfg');
  const row = cfg ? await db.update('openhours', cfg.id, { tzOffsetMin: v }) : await db.insert('openhours', { kind: 'cfg', tzOffsetMin: v });
  res.json({ tzOffsetMin: row.tzOffsetMin });
});

// Valida una franja: etiqueta, días y (si abre) el par de horas coherente
function leerFila(body) {
  if (!str(body.label, 2, 60)) return { error: 'La etiqueta tiene que tener entre 2 y 60 caracteres' };
  if (!SPEC.test(String(body.spec || ''))) return { error: 'Días inválidos (0=domingo … 6=sábado; se admite "1-5" o "0,6")' };
  const abre = String(body.open || '').trim();
  const cierra = String(body.close || '').trim();
  if (abre || cierra) {
    if (!HORA.test(abre) || !HORA.test(cierra)) return { error: 'Horas inválidas (formato HH:MM)' };
    // Una franja que cierra antes de abrir no es un horario: es un error de carga
    if (minutos(cierra) <= minutos(abre)) return { error: 'La hora de cierre tiene que ser posterior a la de apertura' };
  }
  return { ok: true, data: { label: String(body.label).trim(), spec: String(body.spec).trim(), open: abre, close: cierra } };
}

// POST /api/horarios/filas — agrega una franja al final de la tabla
router.post('/filas', requireAdmin, async (req, res) => {
  const r = leerFila(req.body);
  if (r.error) return res.status(422).json({ error: r.error });
  const todo = await db.all('openhours');
  const ultimo = todo.filter(x => x.kind === 'row').reduce((m, x) => Math.max(m, Number(x.order) || 0), 0);
  const row = await db.insert('openhours', { kind: 'row', ...r.data, order: ultimo + 1 });
  res.status(201).json(row);
});

// PUT /api/horarios/filas/:id — corrige una franja existente
router.put('/filas/:id', requireAdmin, async (req, res) => {
  const f = await db.get('openhours', req.params.id);
  if (!f || f.kind !== 'row') return res.status(404).json({ error: 'Esa franja no existe' });
  const r = leerFila(req.body);
  if (r.error) return res.status(422).json({ error: r.error });
  res.json(await db.update('openhours', f.id, r.data));
});

// DELETE /api/horarios/filas/:id — saca la franja de la tabla
router.delete('/filas/:id', requireAdmin, async (req, res) => {
  const f = await db.get('openhours', req.params.id);
  if (!f || f.kind !== 'row') return res.status(404).json({ error: 'Esa franja no existe' });
  await db.remove('openhours', f.id);
  res.json({ ok: true });
});

// POST /api/horarios/feriados — cierre excepcional por fecha (con horario especial opcional).
// Una sola entrada por fecha: cargar dos veces el mismo día sería ambiguo, así que se pisa.
router.post('/feriados', requireAdmin, async (req, res) => {
  if (!FECHA.test(String(req.body.date || ''))) return res.status(422).json({ error: 'Fecha inválida' });
  if (!str(req.body.label, 2, 60)) return res.status(422).json({ error: 'El motivo tiene que tener entre 2 y 60 caracteres' });
  const abre = String(req.body.open || '').trim();
  const cierra = String(req.body.close || '').trim();
  if (abre || cierra) {
    if (!HORA.test(abre) || !HORA.test(cierra)) return res.status(422).json({ error: 'Horas inválidas (formato HH:MM). Dejalas vacías si ese día está cerrado' });
    if (minutos(cierra) <= minutos(abre)) return res.status(422).json({ error: 'La hora de cierre tiene que ser posterior a la de apertura' });
  }
  const datos = { kind: 'holiday', date: req.body.date, label: String(req.body.label).trim(), open: abre, close: cierra };
  const previo = (await db.all('openhours')).find(x => x.kind === 'holiday' && x.date === datos.date);
  const row = previo ? await db.update('openhours', previo.id, datos) : await db.insert('openhours', datos);
  res.status(previo ? 200 : 201).json({ ...row, reemplazado: !!previo });
});

// DELETE /api/horarios/feriados/:id — vuelve ese día al horario normal
router.delete('/feriados/:id', requireAdmin, async (req, res) => {
  const f = await db.get('openhours', req.params.id);
  if (!f || f.kind !== 'holiday') return res.status(404).json({ error: 'Ese feriado no existe' });
  await db.remove('openhours', f.id);
  res.json({ ok: true });
});
` : `// La edición de horarios requiere el módulo de autenticación: activalo en el Builder para
// habilitar /horarios-admin.html. Sin él, se editan en data/openhours.json (la tabla los lee igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'horarios-admin': {
      title: 'Horarios y feriados',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('clock', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Horarios y feriados</h2>
      <p class="section-sub">Lo que cargues acá es lo que ve el visitante en la tabla de horarios del sitio, al instante y sin regenerar nada. El cartel "Abierto ahora" lo calcula el servidor con la zona horaria del negocio, no con el reloj de quien mira. Solo visible para administradores.</p>

      <div class="card" style="margin-bottom:22px">
        <h3>Zona horaria del negocio</h3>
        <p class="muted" style="font-size:.88rem">El servidor puede correr en otro huso (en Vercel corre en UTC). Elegí el del local para que "Abierto ahora" sea correcto.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <div style="flex:1;min-width:220px">
            <label>Diferencia con UTC</label>
            <select id="hr-tz">
              <option value="-180">UTC−3 (Argentina, Uruguay, Brasil este)</option>
              <option value="-240">UTC−4 (Chile, Bolivia, Venezuela)</option>
              <option value="-300">UTC−5 (Colombia, Perú, Ecuador)</option>
              <option value="-360">UTC−6 (México centro)</option>
              <option value="0">UTC±0</option>
              <option value="60">UTC+1 (España, Europa central)</option>
              <option value="120">UTC+2</option>
            </select>
          </div>
          <button class="btn" type="button" id="hr-tz-guardar">Guardar</button>
        </div>
        <p class="muted" style="font-size:.85rem;margin-top:10px" id="hr-ahora"></p>
      </div>

      <div class="card" style="margin-bottom:22px">
        <h3 id="hr-fila-titulo">Nueva franja horaria</h3>
        <form id="hr-fila-form">
          <div class="grid cols-2">
            <div><label>Etiqueta</label><input name="label" required maxlength="60" placeholder="Lunes a viernes"></div>
            <div><label>Días</label><input name="spec" required maxlength="20" placeholder="1-5"><span class="muted" style="font-size:.8rem">0=domingo … 6=sábado. Rango "1-5" o lista "0,6"</span></div>
          </div>
          <div class="grid cols-2">
            <div><label>Abre</label><input name="open" type="time"></div>
            <div><label>Cierra</label><input name="close" type="time"><span class="muted" style="font-size:.8rem">Dejá las dos vacías para "Cerrado"</span></div>
          </div>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="hr-fila-guardar">Agregar franja</button>
            <button class="btn ghost" type="button" id="hr-fila-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>
      <div id="hr-filas" style="margin-bottom:32px"><p class="muted">Cargando…</p></div>

      <h3>Feriados y cierres excepcionales</h3>
      <p class="section-sub">Una fecha puntual que pisa el horario normal: cerrado todo el día, o con horario especial.</p>
      <div class="card" style="margin-bottom:22px">
        <form id="hr-fer-form">
          <div class="grid cols-2">
            <div><label>Fecha</label><input name="date" type="date" required></div>
            <div><label>Motivo</label><input name="label" required maxlength="60" placeholder="Feriado nacional"></div>
          </div>
          <div class="grid cols-2">
            <div><label>Abre (opcional)</label><input name="open" type="time"></div>
            <div><label>Cierra (opcional)</label><input name="close" type="time"><span class="muted" style="font-size:.8rem">Vacías = cerrado todo el día</span></div>
          </div>
          <div style="margin-top:16px"><button class="btn" type="submit">Agregar feriado</button></div>
        </form>
      </div>
      <div id="hr-feriados"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo horarios y feriados: trae la tabla de /api/horarios y la reescribe en vivo conservando
   los atributos data-dias / data-abre / data-cierra que el módulo hours usa como fuente de verdad
   (su recálculo por minuto sigue funcionando). El feriado de hoy le saca el horario a las filas del
   día y agrega la suya, así el cartel "Cerrado" sale sin que hours sepa de feriados. El veredicto y
   la próxima apertura los calcula el servidor con la zona horaria del negocio.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel de edición vive en /horarios-admin.html.` : ''} */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var fechaCorta = function (d) { try { return new Date(d + 'T12:00:00').toLocaleDateString('es-AR'); } catch (e) { return d; } };

  // ¿La spec "1-5" o "0,6" cubre el día d? Misma regla que la tabla y que el servidor
  function cubre(spec, d) {
    return String(spec).split(',').some(function (parte) {
      var r = parte.split('-');
      return r.length === 2 ? d >= +r[0] && d <= +r[1] : d === +parte;
    });
  }

  // ---- Sección pública: reescribe la tabla horneada con los horarios del backend ----
  function pintarSeccion(data) {
    var tabla = document.getElementById('tabla-horarios');
    if (!tabla || !data || !data.rows) return;
    var cuerpo = tabla.querySelector('tbody') || tabla;
    var feriadoHoy = data.hoy && data.hoy.feriado;
    var filas = data.rows.map(function (r) {
      // Con feriado hoy, las filas que cubren hoy pierden su horario: el día lo manda el feriado
      var pisada = feriadoHoy && cubre(r.spec, data.hoy.dow);
      var abre = pisada ? '' : r.open;
      var cierra = pisada ? '' : r.close;
      var texto = abre && cierra ? (abre + ' a ' + cierra) : (pisada ? 'Cerrado (feriado)' : 'Cerrado');
      return '<tr data-dias="' + App.esc(r.spec) + '"' + (abre ? ' data-abre="' + abre + '" data-cierra="' + cierra + '"' : '') + '>' +
        '<td>' + App.esc(r.label) + '</td><td style="text-align:right">' + App.esc(texto) + '</td></tr>';
    });
    if (feriadoHoy) {
      var esp = feriadoHoy.open && feriadoHoy.close ? (feriadoHoy.open + ' a ' + feriadoHoy.close) : 'Cerrado';
      filas.unshift('<tr data-dias="' + data.hoy.dow + '"' +
        (feriadoHoy.open ? ' data-abre="' + feriadoHoy.open + '" data-cierra="' + feriadoHoy.close + '"' : '') + '>' +
        '<td>Hoy · ' + App.esc(feriadoHoy.label) + '</td><td style="text-align:right">' + App.esc(esp) + '</td></tr>');
    }
    cuerpo.innerHTML = filas.join('');
    // El cartel "Abierto ahora / Cerrado" del módulo hours se calculó al cargar, con la tabla
    // horneada y sin saber de feriados: hay que hacerlo recalcular AHORA sobre la tabla nueva.
    // Sin esto el sitio muestra "Abierto ahora" arriba de una fila que dice "Cerrado (feriado)"
    // hasta el próximo minuto.
    if (window.WFHorarios && window.WFHorarios.actualizar) window.WFHorarios.actualizar();

    // Línea extra con lo que el reloj del visitante no puede saber: veredicto del servidor,
    // hora de cierre y próxima apertura. Va en su propio elemento porque hours reescribe
    // #estado-abierto cada minuto y se pisarían entre sí.
    var sec = document.getElementById('horarios');
    if (sec) {
      var extra = document.getElementById('hr-extra');
      if (!extra) {
        extra = document.createElement('p');
        extra.id = 'hr-extra';
        extra.className = 'hr-extra muted';
        var cont = sec.querySelector('.container');
        if (cont) cont.appendChild(extra);
      }
      var partes = [];
      if (data.hoy.abierto) partes.push('<span class="hr-chip abierto">Abierto</span> Hoy cerramos a las <strong class="hr-hora">' + App.esc(data.hoy.cierraA) + '</strong>');
      else {
        partes.push('<span class="hr-chip cerrado">Cerrado</span>');
        if (data.hoy.proxima) partes.push('Abrimos ' + App.esc(data.hoy.proxima.dia) + ' a las <strong class="hr-hora">' + App.esc(data.hoy.proxima.hora) + '</strong>');
      }
      if (feriadoHoy) partes.push('<span class="hr-chip feriado">' + App.esc(feriadoHoy.label) + '</span>');
      var proximos = (data.feriados || []).filter(function (f) { return f.date !== data.hoy.fecha; }).slice(0, 3);
      if (proximos.length) {
        partes.push('Próximos cierres: ' + proximos.map(function (f) {
          return App.esc(fechaCorta(f.date) + ' ' + f.label + (f.open ? ' (' + f.open + ' a ' + f.close + ')' : ''));
        }).join(' · '));
      }
      extra.innerHTML = partes.join(' &middot; ');
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(extra, { opacity: [0, 1], translateY: [6, 0], duration: 420, ease: 'outCubic' });
        // Red de seguridad: con la pestaña oculta el loop no corre y la línea quedaría invisible
        setTimeout(function () { extra.style.opacity = 1; extra.style.transform = 'none'; }, 900);
      }
    }
  }

  var DEMO = {
    rows: [
      { id: '1', label: 'Lunes a viernes', spec: '1-5', open: '09:00', close: '18:00' },
      { id: '2', label: 'Sábados', spec: '6', open: '09:00', close: '13:00' },
      { id: '3', label: 'Domingos', spec: '0', open: '', close: '' },
    ],
    feriados: [{ id: 'f1', date: '2026-12-25', label: 'Navidad', open: '', close: '' }],
    hoy: { fecha: new Date().toISOString().slice(0, 10), dow: new Date().getDay(), hora: '10:30', abierto: true, cierraA: '18:00', feriado: null, proxima: null },
  };

  if (document.getElementById('tabla-horarios')) {
    if (window.__PREVIEW__) pintarSeccion(DEMO);
    else fetch('/api/horarios').then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.rows) pintarSeccion(d); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /horarios-admin.html ----
  var formFila = document.getElementById('hr-fila-form');
  var cajaFilas = document.getElementById('hr-filas');
  if (formFila && cajaFilas) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var filas = [], feriados = [], editando = '';

    function salirDeEdicion() {
      editando = '';
      formFila.reset();
      document.getElementById('hr-fila-titulo').textContent = 'Nueva franja horaria';
      document.getElementById('hr-fila-guardar').textContent = 'Agregar franja';
      document.getElementById('hr-fila-cancelar').hidden = true;
    }

    function editarFila(f) {
      editando = f.id;
      ['label', 'spec', 'open', 'close'].forEach(function (k) { formFila.querySelector('[name="' + k + '"]').value = f[k] || ''; });
      document.getElementById('hr-fila-titulo').textContent = 'Editando: ' + f.label;
      document.getElementById('hr-fila-guardar').textContent = 'Guardar cambios';
      document.getElementById('hr-fila-cancelar').hidden = false;
      formFila.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function nombreDias(spec) {
      var out = [];
      for (var d = 0; d < 7; d++) if (cubre(spec, d)) out.push(DIAS[d]);
      return out.join(', ');
    }

    function pintarFilas() {
      cajaFilas.innerHTML = App.table(filas, [
        { label: 'Etiqueta', render: function (f) { return '<strong>' + App.esc(f.label) + '</strong>'; } },
        { label: 'Días', render: function (f) { return '<span class="muted">' + App.esc(nombreDias(f.spec)) + '</span>'; } },
        { label: 'Horario', render: function (f) { return '<span class="hr-hora">' + (f.open ? App.esc(f.open + ' a ' + f.close) : 'Cerrado') + '</span>'; } },
        { label: '', render: function (f) {
          return '<span class="hr-acciones">' +
            '<button class="btn ghost" type="button" data-hr-edit="' + f.id + '">Editar</button>' +
            '<button class="btn ghost" type="button" data-hr-del="' + f.id + '">Borrar</button></span>';
        } },
      ]);
      cajaFilas.querySelectorAll('[data-hr-edit]').forEach(function (b) {
        b.addEventListener('click', function () {
          var f = filas.filter(function (x) { return x.id === b.getAttribute('data-hr-edit'); })[0];
          if (f) editarFila(f);
        });
      });
      cajaFilas.querySelectorAll('[data-hr-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar esta franja horaria?')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/horarios/filas/' + b.getAttribute('data-hr-del'), { method: 'DELETE' });
            App.toast('Franja borrada');
            if (editando === b.getAttribute('data-hr-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    function pintarFeriados() {
      var caja = document.getElementById('hr-feriados');
      if (!caja) return;
      var hoy = new Date().toISOString().slice(0, 10);
      caja.innerHTML = App.table(feriados, [
        { label: 'Fecha', render: function (f) {
          return '<span class="hr-hora">' + App.esc(fechaCorta(f.date)) + '</span>' +
            (f.date < hoy ? ' <span class="muted" style="font-size:.78rem">(pasado)</span>' : '');
        } },
        { label: 'Motivo', render: function (f) { return App.esc(f.label); } },
        { label: 'Ese día', render: function (f) { return f.open ? '<span class="hr-hora">' + App.esc(f.open + ' a ' + f.close) + '</span>' : '<span class="hr-chip cerrado">Cerrado</span>'; } },
        { label: '', render: function (f) { return '<span class="hr-acciones"><button class="btn ghost" type="button" data-hr-ferdel="' + f.id + '">Borrar</button></span>'; } },
      ]);
      caja.querySelectorAll('[data-hr-ferdel]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar este feriado? Ese día vuelve al horario normal.')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/horarios/feriados/' + b.getAttribute('data-hr-ferdel'), { method: 'DELETE' });
            App.toast('Feriado borrado');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function cargar() {
      if (window.__PREVIEW__) {
        filas = DEMO.rows.slice();
        feriados = DEMO.feriados.slice();
        pintarFilas();
        pintarFeriados();
        return;
      }
      try {
        var cfgH = await App.api('/api/horarios/config');
        filas = cfgH.rows;
        feriados = cfgH.feriados;
        var sel = document.getElementById('hr-tz');
        if (sel) sel.value = String(cfgH.tzOffsetMin);
        pintarFilas();
        pintarFeriados();
        // El "ahora" del negocio sale del endpoint público: es el mismo que ve el visitante
        var pub = await App.api('/api/horarios');
        var av = document.getElementById('hr-ahora');
        if (av) av.textContent = 'Para el sitio son las ' + pub.hoy.hora + ' del ' + fechaCorta(pub.hoy.fecha) +
          ' · ahora mismo el negocio figura ' + (pub.hoy.abierto ? 'ABIERTO (cierra ' + pub.hoy.cierraA + ')' : 'CERRADO') + '.';
      } catch (err) {
        if (err.message !== 'preview') cajaFilas.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    formFila.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {};
      ['label', 'spec', 'open', 'close'].forEach(function (k) { datos[k] = formFila.querySelector('[name="' + k + '"]').value; });
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la franja'); return; }
      try {
        if (editando) await App.api('/api/horarios/filas/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/horarios/filas', { method: 'POST', body: datos });
        App.toast(editando ? 'Franja actualizada' : 'Franja agregada');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var cancelarF = document.getElementById('hr-fila-cancelar');
    if (cancelarF) cancelarF.addEventListener('click', salirDeEdicion);

    var formFer = document.getElementById('hr-fer-form');
    if (formFer) formFer.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {};
      ['date', 'label', 'open', 'close'].forEach(function (k) { datos[k] = formFer.querySelector('[name="' + k + '"]').value; });
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el feriado'); return; }
      try {
        var out = await App.api('/api/horarios/feriados', { method: 'POST', body: datos });
        formFer.reset();
        App.toast(out.reemplazado ? 'Ya había un feriado ese día: se reemplazó' : 'Feriado agregado');
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var btnTz = document.getElementById('hr-tz-guardar');
    if (btnTz) btnTz.addEventListener('click', async function () {
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la zona horaria'); return; }
      try {
        await App.api('/api/horarios/config', { method: 'PUT', body: { tzOffsetMin: Number(document.getElementById('hr-tz').value) } });
        App.toast('Zona horaria guardada');
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      cajaFilas.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      formFila.style.display = 'none';
      if (formFer) formFer.style.display = 'none';
    } else {
      cargar();
      var animeP = window.anime;
      if (animeP && animeP.animate && !reduce) {
        animeP.animate(formFila, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: 'outCubic' });
        setTimeout(function () { formFila.style.opacity = 1; formFila.style.transform = 'none'; }, 800);
      }
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navH = document.getElementById('nav-horarios-admin');
    if (navH && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navH.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Horarios y feriados administrables**: las franjas viven en la colección \`openhours\` y se inyectan en vivo sobre la tabla del sitio, así que **cambiar un horario no requiere regenerar ni volver a deployar**. Se siembran las tres franjas de ejemplo: ajustalas ${cfg.moduleIds.includes('auth') ? 'desde `/horarios-admin.html`' : 'editando `data/openhours.json` (o activá el módulo **Autenticación** para editarlas desde la web en `/horarios-admin.html`)'}. Los **feriados y cierres excepcionales** se cargan por fecha (cerrado todo el día, o con horario especial) y pisan el horario normal de ese día. **Importante**: el veredicto "Abierto ahora" lo calcula el servidor con la **zona horaria del negocio**, que se elige en el panel — si lo deployás en Vercel el proceso corre en UTC, así que dejar mal ese valor es lo único que puede hacer que el cartel mienta.`,
  ],
};
