// Agenda de eventos con backend real: la sección "Próximos eventos" (módulo UI events) era
// ESTÁTICA — tres eventos inventados horneados en el HTML— y su propio readme pedía "quitá la
// sección cuando no tengas eventos activos", que es justo lo que nadie se acuerda de hacer: la
// falla típica de esa sección no es que esté vacía, es que en marzo siga anunciando un taller de
// agosto. Acá los eventos viven en la colección eventitems y el SERVIDOR decide cuáles son
// próximos con su propio reloj, así un evento vencido desaparece solo y, si no queda ninguno, la
// sección entera se oculta. Nunca hay que acordarse de nada.
// La fecha se guarda como YYYY-MM-DD y se formatea con una tabla de meses propia, no con
// toLocaleDateString: `new Date('2026-08-15')` se parsea como UTC y en cualquier huso al oeste de
// Greenwich devuelve el 14. Un módulo de agenda que corre el día de los eventos no sirve.
// La ficha admite descripción, cupo, y un botón con destino y texto propios (con "Inscripción a
// eventos" activo, el default es la sección de inscripción). Emite JSON-LD Event, que es lo que
// hace que Google pueda mostrar el evento con su fecha en el resultado de búsqueda.
// Panel solo-admin /eventos-admin.html, animado con Anime.js.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'eventos', type: 'functional', name: 'Eventos administrables',
  description: 'Le da backend real a la sección "Próximos eventos": los eventos viven en la colección eventitems y se inyectan en vivo sobre las tarjetas horneadas. El servidor decide con su reloj cuáles siguen siendo próximos, así un evento vencido desaparece solo y, si no queda ninguno, la sección se oculta entera en vez de anunciar algo que ya pasó. Cada evento admite fecha, hora, lugar, descripción, cupo y un botón con destino propio; con Inscripción a eventos activo, ese módulo toma la misma agenda en vez de su lista horneada. Emite JSON-LD Event para que Google muestre la fecha en el resultado. ABM en /eventos-admin.html. Animado con Anime.js.',
  usesAnime: true,
  requires: ['events'],
  mounts: [{ route: '/api/eventos', file: 'routes/eventos.js' }],
  collections: ['eventitems'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Eventos', href: '/eventos-admin.html', id: 'nav-eventos-admin' }] : [],
  head: () => `  <style>
    .evx-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .evx-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .evx-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .evx-chip.old{background:#c0392b18;color:#c0392b}
    .evx-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .evx-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .evx-cuando{font-variant-numeric:tabular-nums;white-space:nowrap}
    .evx-desc{font-size:.85rem;color:var(--muted);max-width:44ch}
  </style>`,
  files: (cfg) => ({
    'routes/eventos.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Se siembran los mismos tres eventos que hornea la sección (mismos días y meses que los badges
// del HTML) para que la primera carga no parpadee. Son DATOS INVENTADOS: reemplazalos por tu
// agenda real. Cuando estas fechas pasen, la sección se va a ocultar sola — que es exactamente
// lo que tiene que hacer una agenda vacía.
db.seedIfEmpty('eventitems', [
  { titulo: 'Taller de introducción', fecha: '2026-08-15', hora: '18:00', lugar: 'Sede central', descripcion: 'Un encuentro práctico para arrancar con lo esencial.', cupo: 30, enlace: '', textoBoton: 'Quiero asistir', visible: true },
  { titulo: 'Charla abierta a la comunidad', fecha: '2026-09-02', hora: '19:30', lugar: 'Auditorio', descripcion: 'Charla abierta con preguntas y respuestas al final.', cupo: 60, enlace: '', textoBoton: 'Quiero asistir', visible: true },
  { titulo: 'Jornada de puertas abiertas', fecha: '2026-09-20', hora: '10:00', lugar: 'Todas las sucursales', descripcion: 'Recorrido, novedades y café. Entrada libre.', cupo: 0, enlace: '', textoBoton: 'Quiero asistir', visible: true },
]);

const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;
const HORA = /^([01]\\d|2[0-3]):[0-5]\\d$/;
// Un destino válido es una ruta del propio sitio o una URL http(s). Nada de javascript: ni data:
// — esto termina en el href de un botón del sitio publicado.
const DESTINO = /^(\\/[\\w\\-./%#?=&]*|https?:\\/\\/[^\\s"'<>]+)$/;

// VENTANA DE VIGENCIA: un evento sigue siendo "próximo" hasta 36 horas después del comienzo de su
// día en UTC. No es arbitrario: cubre el día completo del evento en cualquier huso horario del
// mundo (UTC-12 a UTC+14) y lo baja a la mañana siguiente. Cortar a la medianoche UTC escondería
// un evento de la noche en América mientras todavía está pasando.
const VIGENCIA_MS = 36 * 60 * 60 * 1000;
const vigente = (r, ahora) => {
  if (!FECHA.test(String(r.fecha || ''))) return false;
  return Date.parse(r.fecha + 'T00:00:00Z') + VIGENCIA_MS > ahora;
};

const limpiar = (r) => ({
  id: r.id,
  titulo: r.titulo || '',
  fecha: r.fecha || '',
  hora: r.hora || '',
  lugar: r.lugar || '',
  descripcion: r.descripcion || '',
  cupo: Math.max(0, Number(r.cupo) || 0),
  enlace: r.enlace || '',
  textoBoton: r.textoBoton || 'Quiero asistir',
  visible: r.visible !== false,
});

// El orden es la fecha, siempre: en una agenda no hay nada que reordenar a mano, y un botón de
// "subir" que contradiga el calendario sólo sirve para publicar la agenda desordenada.
const porFecha = (rows) => rows.map(limpiar).sort((a, b) =>
  String(a.fecha).localeCompare(String(b.fecha)) || String(a.hora).localeCompare(String(b.hora)));

function leer(body, parcial) {
  const patch = {};
  if (body.titulo !== undefined || !parcial) {
    if (!str(body.titulo, 2, 90)) return { ok: false, error: 'El título tiene que tener entre 2 y 90 caracteres' };
    patch.titulo = String(body.titulo).trim();
  }
  if (body.fecha !== undefined || !parcial) {
    const v = String(body.fecha || '').trim();
    if (!FECHA.test(v) || isNaN(Date.parse(v + 'T00:00:00Z'))) return { ok: false, error: 'La fecha tiene que ser una fecha válida (AAAA-MM-DD)' };
    patch.fecha = v;
  }
  if (body.hora !== undefined) {
    const v = String(body.hora || '').trim();
    if (v && !HORA.test(v)) return { ok: false, error: 'La hora tiene que tener formato HH:MM (24 horas)' };
    patch.hora = v;
  }
  if (body.lugar !== undefined) patch.lugar = String(body.lugar).trim().slice(0, 90);
  if (body.descripcion !== undefined) patch.descripcion = String(body.descripcion).trim().slice(0, 400);
  if (body.textoBoton !== undefined) patch.textoBoton = String(body.textoBoton).trim().slice(0, 40) || 'Quiero asistir';
  if (body.cupo !== undefined) {
    const n = Number(body.cupo);
    if (!isFinite(n) || n < 0 || n > 100000) return { ok: false, error: 'El cupo tiene que ser un número entre 0 y 100.000 (0 = sin límite)' };
    patch.cupo = Math.floor(n);
  }
  if (body.enlace !== undefined) {
    const v = String(body.enlace).trim();
    if (v && !DESTINO.test(v)) return { ok: false, error: 'El destino del botón tiene que ser una ruta del sitio (/contact.html) o una URL http(s)' };
    patch.enlace = v;
  }
  if (body.visible !== undefined) patch.visible = !(body.visible === false || body.visible === 'false');
  return { ok: true, patch };
}

// GET /api/eventos — público: sólo los visibles que todavía no pasaron, por fecha
router.get('/', async (req, res) => {
  const ahora = Date.now();
  const rows = porFecha(await db.all('eventitems'))
    .filter(r => r.visible && vigente(r, ahora))
    .slice(0, 12);
  res.json({ rows });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/eventos/todos — el panel ve también los ocultos y los que ya pasaron
router.get('/todos', requireAdmin, async (req, res) => {
  const ahora = Date.now();
  const rows = porFecha(await db.all('eventitems')).map(r => ({ ...r, pasado: !vigente(r, ahora) }));
  res.json({ rows, proximos: rows.filter(r => r.visible && !r.pasado).length, pasados: rows.filter(r => r.pasado).length });
});

// POST /api/eventos — alta
router.post('/', requireAdmin, async (req, res) => {
  const { ok, error, patch } = leer(req.body, false);
  if (!ok) return res.status(422).json({ error });
  const row = await db.insert('eventitems', {
    titulo: patch.titulo, fecha: patch.fecha,
    hora: patch.hora || '', lugar: patch.lugar || '',
    descripcion: patch.descripcion || '', cupo: patch.cupo || 0,
    enlace: patch.enlace || '', textoBoton: patch.textoBoton || 'Quiero asistir',
    visible: patch.visible !== false,
  });
  res.status(201).json(limpiar(row));
});

// PUT /api/eventos/:id — edición parcial
router.put('/:id', requireAdmin, async (req, res) => {
  const r = await db.get('eventitems', req.params.id);
  if (!r) return res.status(404).json({ error: 'Ese evento no existe' });
  const { ok, error, patch } = leer(req.body, true);
  if (!ok) return res.status(422).json({ error });
  res.json(limpiar(await db.update('eventitems', r.id, patch)));
});

// DELETE /api/eventos/:id — baja definitiva. Para sacarlo del sitio sin perder el dato está
// Ocultar; y un evento que ya pasó no hace falta borrarlo: deja de mostrarse solo.
router.delete('/:id', requireAdmin, async (req, res) => {
  const r = await db.get('eventitems', req.params.id);
  if (!r) return res.status(404).json({ error: 'Ese evento no existe' });
  await db.remove('eventitems', r.id);
  res.json({ ok: true });
});
` : `// La edición de la agenda requiere el módulo de autenticación: activalo en el Builder para
// habilitar /eventos-admin.html. Sin él, se edita en data/eventitems.json (la sección lo lee igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'eventos-admin': {
      title: 'Eventos',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('clock', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Agenda de eventos</h2>
      <p class="section-sub">Lo que cargues acá es lo que ve el visitante en "Próximos eventos", al instante y sin regenerar nada. Los eventos que ya pasaron dejan de mostrarse solos, y si no queda ninguno próximo la sección se oculta entera. Los tres sembrados son de ejemplo: reemplazalos por tu agenda real. Solo visible para administradores.</p>

      <div class="card" style="margin-bottom:26px">
        <h3 id="evx-form-titulo">Agregar evento</h3>
        <form id="evx-form">
          <label>Título</label>
          <input name="titulo" required maxlength="90" placeholder="Taller de introducción">
          <div class="grid cols-2">
            <div><label>Fecha</label><input name="fecha" type="date" required></div>
            <div><label>Hora (opcional)</label><input name="hora" type="time"></div>
          </div>
          <div class="grid cols-2">
            <div><label>Lugar</label><input name="lugar" maxlength="90" placeholder="Sede central"></div>
            <div><label>Cupo (0 = sin límite)</label><input name="cupo" type="number" min="0" max="100000" step="1" value="0"></div>
          </div>
          <label>Descripción (opcional)</label>
          <textarea name="descripcion" rows="2" maxlength="400" placeholder="Un encuentro práctico para arrancar con lo esencial."></textarea>
          <div class="grid cols-2">
            <div><label>Destino del botón</label><input name="enlace" maxlength="300" placeholder="${cfg.moduleIds.includes('eventregister') ? '/index.html#inscripcion-eventos' : '/contact.html'}"></div>
            <div><label>Texto del botón</label><input name="textoBoton" maxlength="40" placeholder="Quiero asistir"></div>
          </div>
          <span class="muted" style="font-size:.8rem">Sin destino, el botón lleva a ${cfg.moduleIds.includes('eventregister') ? 'la sección de inscripción' : cfg.moduleIds.includes('contact') ? 'la página de contacto' : 'la página Nosotros'}.</span>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="visible" style="width:auto;margin:0" checked> Visible en el sitio</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="evx-guardar">Agregar evento</button>
            <button class="btn ghost" type="button" id="evx-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>

      <div id="evx-lista"><p class="muted">Cargando…</p></div>
      <p class="muted" style="font-size:.85rem;margin-top:14px">El orden lo decide la fecha. Un evento marcado "Ya pasó" no se muestra en el sitio aunque esté visible: no hace falta borrarlo.</p>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo eventos administrables: trae la agenda de /api/eventos y reemplaza las tarjetas
   horneadas de "Próximos eventos". Si no hay ninguno próximo oculta la sección entera, que es
   mejor que dejar un título sin contenido. Emite JSON-LD Event.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el ABM vive en /eventos-admin.html.` : ''}
   Aparición escalonada con Anime.js + red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RELOJ = ${JSON.stringify(phIcon('clock', { size: 14 }))};
  var PIN = ${JSON.stringify(phIcon('map-pin', { size: 14 }))};
  // Tabla propia de meses: formatear con toLocaleDateString obligaría a construir un Date, y
  // 'AAAA-MM-DD' se parsea como UTC — en América eso devuelve el día anterior.
  var MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  var DESTINO_DEFAULT = ${JSON.stringify(
    cfg.moduleIds.includes('eventregister') ? '/index.html#inscripcion-eventos'
      : cfg.moduleIds.includes('contact') ? '/contact.html' : '/about.html')};

  function partes(fecha) {
    var m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(fecha || ''));
    if (!m) return { dia: '--', mes: '', anio: '' };
    return { dia: m[3], mes: MESES[Number(m[2]) - 1] || '', anio: m[1] };
  }

  // ---- Sección pública ----
  function pintarSeccion(rows) {
    var seccion = document.getElementById('eventos');
    if (!seccion) return;
    var grid = seccion.querySelector('.ev-grid');
    if (!grid) return;
    if (!rows || !rows.length) {
      // Sin eventos próximos la sección entera se va: un título "Próximos eventos" sobre una
      // grilla vacía se lee como un sitio roto, y anunciar uno vencido es peor todavía.
      seccion.hidden = true;
      seccion.style.display = 'none';
      return;
    }
    seccion.hidden = false;
    seccion.style.display = '';
    grid.innerHTML = rows.map(function (ev) {
      var p = partes(ev.fecha);
      var meta = [];
      if (ev.hora) meta.push(RELOJ + ' ' + App.esc(ev.hora) + ' hs');
      if (ev.lugar) meta.push(PIN + ' ' + App.esc(ev.lugar));
      if (ev.cupo) meta.push(App.esc(ev.cupo + ' lugares'));
      var destino = ev.enlace || DESTINO_DEFAULT;
      return '<article class="card ev-card">' +
        '<div class="ev-fecha" aria-hidden="true">' +
          '<span class="ev-dia">' + App.esc(p.dia) + '</span>' +
          '<span class="ev-mes">' + App.esc(p.mes) + '</span>' +
        '</div>' +
        '<div class="ev-cuerpo">' +
          '<h3 style="margin:0 0 8px">' + App.esc(ev.titulo) + '</h3>' +
          (meta.length ? '<p class="muted" style="margin:0;font-size:.88rem">' + meta.join(' · ') + '</p>' : '') +
          (ev.descripcion ? '<p class="muted" style="margin:8px 0 0;font-size:.9rem">' + App.esc(ev.descripcion) + '</p>' : '') +
          '<p style="margin:14px 0 0"><a class="btn btn-sm" href="' + App.esc(destino) + '">' + App.esc(ev.textoBoton || 'Quiero asistir') + '</a></p>' +
        '</div>' +
      '</article>';
    }).join('');

    // JSON-LD Event: es lo que le permite a Google mostrar la fecha del evento en el resultado.
    // Se reemplaza entero en cada pintada para que nunca queden datos de una agenda vieja.
    var viejo = document.getElementById('evx-jsonld');
    if (viejo) viejo.remove();
    var sc = document.createElement('script');
    sc.type = 'application/ld+json';
    sc.id = 'evx-jsonld';
    sc.textContent = JSON.stringify(rows.map(function (ev) {
      var o = {
        '@context': 'https://schema.org', '@type': 'Event',
        name: ev.titulo,
        startDate: ev.hora ? ev.fecha + 'T' + ev.hora : ev.fecha,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
      };
      if (ev.lugar) o.location = { '@type': 'Place', name: ev.lugar };
      if (ev.descripcion) o.description = ev.descripcion;
      return o;
    })).replace(/</g, '\\\\u003c');
    document.head.appendChild(sc);

    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(grid.children, { opacity: [0, 1], translateY: [14, 0], duration: 460, delay: anime.stagger ? anime.stagger(75) : 0, ease: 'outCubic' });
      // Red de seguridad: con la pestaña oculta el loop de Anime no corre y las tarjetas
      // se quedarían en opacidad 0. Se fija el estado final igual.
      setTimeout(function () {
        Array.prototype.forEach.call(grid.children, function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
      }, 1000);
    }
  }

  var DEMO = [
    { id: '1', titulo: 'Taller de introducción', fecha: '2026-08-15', hora: '18:00', lugar: 'Sede central', descripcion: 'Un encuentro práctico para arrancar con lo esencial.', cupo: 30, enlace: '', textoBoton: 'Quiero asistir', visible: true },
    { id: '2', titulo: 'Charla abierta a la comunidad', fecha: '2026-09-02', hora: '19:30', lugar: 'Auditorio', descripcion: 'Charla abierta con preguntas y respuestas al final.', cupo: 60, enlace: '', textoBoton: 'Quiero asistir', visible: true },
    { id: '3', titulo: 'Jornada de puertas abiertas', fecha: '2026-09-20', hora: '10:00', lugar: 'Todas las sucursales', descripcion: 'Recorrido, novedades y café. Entrada libre.', cupo: 0, enlace: '', textoBoton: 'Quiero asistir', visible: true },
  ];

  if (document.getElementById('eventos')) {
    if (window.__PREVIEW__) pintarSeccion(DEMO);
    else fetch('/api/eventos').then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.rows) pintarSeccion(d.rows); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /eventos-admin.html ----
  var form = document.getElementById('evx-form');
  var box = document.getElementById('evx-lista');
  if (form && box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var editando = '';
    var CAMPOS = ['titulo', 'fecha', 'hora', 'lugar', 'descripcion', 'enlace', 'textoBoton'];

    function salirDeEdicion() {
      editando = '';
      form.reset();
      form.querySelector('[name="visible"]').checked = true;
      form.querySelector('[name="cupo"]').value = 0;
      document.getElementById('evx-form-titulo').textContent = 'Agregar evento';
      document.getElementById('evx-guardar').textContent = 'Agregar evento';
      document.getElementById('evx-cancelar').hidden = true;
    }

    function editar(ev) {
      editando = ev.id;
      CAMPOS.forEach(function (k) { form.querySelector('[name="' + k + '"]').value = ev[k] || ''; });
      form.querySelector('[name="cupo"]').value = Number(ev.cupo) || 0;
      form.querySelector('[name="visible"]').checked = ev.visible !== false;
      document.getElementById('evx-form-titulo').textContent = 'Editando: ' + ev.titulo;
      document.getElementById('evx-guardar').textContent = 'Guardar cambios';
      document.getElementById('evx-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function pintar() {
      box.innerHTML = App.table(lista, [
        { label: 'Cuándo', render: function (ev) {
          var p = partes(ev.fecha);
          return '<span class="evx-cuando"><strong>' + App.esc(p.dia + ' ' + p.mes) + '</strong> ' + App.esc(p.anio) +
            (ev.hora ? '<br><span class="muted">' + App.esc(ev.hora) + ' hs</span>' : '') + '</span>';
        } },
        { label: 'Evento', render: function (ev) {
          return '<strong>' + App.esc(ev.titulo) + '</strong>' +
            (ev.lugar ? '<br><span class="muted" style="font-size:.82rem">' + App.esc(ev.lugar) + '</span>' : '') +
            (ev.descripcion ? '<br><span class="evx-desc">' + App.esc(ev.descripcion) + '</span>' : '') +
            (ev.cupo ? '<br><span class="muted" style="font-size:.82rem">Cupo: ' + ev.cupo + '</span>' : '');
        } },
        { label: 'Estado', render: function (ev) {
          if (ev.pasado) return '<span class="evx-chip old">Ya pasó</span>';
          return ev.visible ? '<span class="evx-chip on">En el sitio</span>' : '<span class="evx-chip off">Oculto</span>';
        } },
        { label: '', render: function (ev) {
          return '<span class="evx-acciones">' +
            '<button class="btn ghost" type="button" data-evx-edit="' + ev.id + '">Editar</button>' +
            '<button class="btn ghost" type="button" data-evx-ver="' + ev.id + '">' + (ev.visible ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn ghost" type="button" data-evx-del="' + ev.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-evx-edit]').forEach(function (b) {
        b.addEventListener('click', function () { var ev = buscar(b.getAttribute('data-evx-edit')); if (ev) editar(ev); });
      });
      box.querySelectorAll('[data-evx-ver]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var ev = buscar(b.getAttribute('data-evx-ver'));
          if (!ev) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
          try {
            await App.api('/api/eventos/' + ev.id, { method: 'PUT', body: { visible: !ev.visible } });
            App.toast(ev.visible ? 'Evento oculto' : 'Evento visible');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-evx-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar este evento? Si ya pasó no hace falta: deja de mostrarse solo.')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/eventos/' + b.getAttribute('data-evx-del'), { method: 'DELETE' });
            App.toast('Evento borrado');
            if (editando === b.getAttribute('data-evx-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function cargar() {
      if (window.__PREVIEW__) { lista = DEMO.map(function (e) { return Object.assign({ pasado: false }, e); }); pintar(); return; }
      try {
        var out = await App.api('/api/eventos/todos');
        lista = out.rows;
        pintar();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {};
      CAMPOS.forEach(function (k) { datos[k] = form.querySelector('[name="' + k + '"]').value; });
      datos.cupo = Number(form.querySelector('[name="cupo"]').value) || 0;
      datos.visible = form.querySelector('[name="visible"]').checked;
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el evento'); return; }
      try {
        if (editando) await App.api('/api/eventos/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/eventos', { method: 'POST', body: datos });
        App.toast(editando ? 'Evento actualizado' : 'Evento agregado');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var cancelar = document.getElementById('evx-cancelar');
    if (cancelar) cancelar.addEventListener('click', salirDeEdicion);

    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      form.style.display = 'none';
    } else {
      cargar();
      var animeP = window.anime;
      if (animeP && animeP.animate && !reduce) {
        animeP.animate(form, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: 'outCubic' });
        setTimeout(function () { form.style.opacity = 1; form.style.transform = 'none'; }, 800);
      }
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navE = document.getElementById('nav-eventos-admin');
    if (navE && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navE.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Eventos administrables**: la agenda vive en la colección \`eventitems\` y se inyecta en vivo sobre "Próximos eventos", así que **agregar o correr un evento no requiere regenerar ni volver a deployar**. Se siembran **tres eventos de ejemplo con fechas inventadas**: reemplazalos por tu agenda real ${cfg.moduleIds.includes('auth') ? 'desde `/eventos-admin.html`' : 'editando `data/eventitems.json` (o activá el módulo **Autenticación** para el ABM web en `/eventos-admin.html`)'}. Un evento **deja de mostrarse solo** pasadas 36 horas del comienzo de su día (la ventana cubre el día completo en cualquier huso horario), y si no queda ninguno próximo **la sección se oculta entera**: no hay que acordarse de sacarla.${cfg.moduleIds.includes('eventregister') ? ' Con **Inscripción a eventos** activo, ese módulo toma **esta misma agenda** (los eventos con cupo mayor a 0) en vez de su lista horneada: se carga en un solo lugar.' : ''} Se emite **JSON-LD \`Event\`** para que Google pueda mostrar la fecha en el resultado de búsqueda.`,
  ],
};
