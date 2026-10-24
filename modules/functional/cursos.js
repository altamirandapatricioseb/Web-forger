// Cursos online con lecciones y progreso real por alumno: una página pública /cursos.html que lista
// los cursos publicados traídos del servidor (colección courses), y al abrir uno (?curso=<id>, enlace
// compartible) muestra sus lecciones. El visitante se inscribe con su email (idempotente) y va
// marcando lecciones como completadas: el avance se guarda en el servidor (colección courseprogress)
// y se muestra como barra de progreso + porcentaje animados con Anime.js, retomable desde cualquier
// dispositivo con el mismo email. Con el módulo de autenticación activo, /cursos-admin.html es un ABM
// solo-admin (crear, editar, publicar/despublicar, borrar cursos; las lecciones se escriben una por
// línea) que además muestra cuántos alumnos tiene cada curso. Se siembran dos cursos de ejemplo. Es
// el sistema de cursos con progreso que faltaba en el catálogo: distinto de "kb" (artículos sueltos
// de ayuda), de "blogcms" (novedades) y de "downloads" (archivos): acá hay contenido ordenado en
// lecciones y un avance por alumno persistido en el backend.

// Cursos de ejemplo (se siembran la primera vez; el negocio los edita o borra desde el ABM).
const SEMILLA = [
  {
    title: 'Introducción a nuestro método',
    description: 'Las bases para arrancar: qué hacemos, cómo lo hacemos y qué vas a lograr al terminar.',
    published: true,
    lessons: [
      { id: 'l1', title: 'Bienvenida y cómo aprovechar el curso', body: 'Qué vas a encontrar en cada lección y cómo marcar tu avance para retomarlo cuando quieras.' },
      { id: 'l2', title: 'Los tres pilares del método', body: 'Claridad, práctica y constancia: cómo se combinan y por qué funcionan juntos.' },
      { id: 'l3', title: 'Tu primer ejercicio práctico', body: 'Una consigna corta para aplicar lo visto. Al terminarla, marcá la lección como completada.' },
    ],
  },
  {
    title: 'Nivel intermedio: profundizando',
    description: 'Para quienes ya hicieron la introducción: técnicas avanzadas y casos reales paso a paso.',
    published: true,
    lessons: [
      { id: 'l1', title: 'Repaso y diagnóstico', body: 'Un repaso rápido de la introducción y un autodiagnóstico para saber de dónde partís.' },
      { id: 'l2', title: 'Caso real de principio a fin', body: 'Analizamos un caso completo aplicando el método, con los errores más comunes señalados.' },
    ],
  },
];

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'cursos', type: 'functional', name: 'Cursos con progreso',
  description: 'Cursos online con backend: página pública /cursos.html con los cursos publicados y sus lecciones; el alumno se inscribe con su email y marca lecciones completadas, con el avance guardado en el servidor y una barra de progreso animada con Anime.js (retomable desde cualquier dispositivo). Con auth activo, ABM solo-admin en /cursos-admin.html con la cantidad de alumnos por curso.',
  usesAnime: true,
  mounts: [{ route: '/api/cursos', file: 'routes/cursos.js' }],
  collections: ['courses', 'courseprogress'],
  nav: (cfg) => {
    const links = [{ label: 'Cursos', href: '/cursos.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Cursos (admin)', href: '/cursos-admin.html', id: 'nav-cursos-admin' });
    return links;
  },
  head: () => `  <style>
    .cu-card{cursor:pointer}
    .cu-meta{display:flex;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:.85rem;margin:10px 0 0}
    .cu-back{display:inline-block;margin:0 0 18px;font-size:.9rem}
    .cu-prog{margin:18px 0 26px}
    .cu-bar{height:10px;background:var(--surface);border:1px solid var(--line);border-radius:999px;overflow:hidden}
    .cu-fill{height:100%;width:0%;background:var(--accent);border-radius:999px}
    .cu-pct{font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums}
    .cu-lesson{padding:16px 0;border-bottom:1px dashed var(--line)}
    .cu-lesson:last-child{border-bottom:0}
    .cu-lesson h4{margin:0 0 6px}
    .cu-lesson p{margin:0 0 10px;color:var(--muted);font-size:.92rem}
    .cu-lesson.done h4{color:var(--accent)}
    .cu-done-mark{font-size:.8rem;color:var(--accent);font-weight:700}
    .cu-enroll{max-width:460px}
    .cu-badge{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--line)}
    .cu-badge.on{background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--accent);border-color:transparent}
    .cu-empty{color:var(--muted)}
  </style>`,
  files: (cfg) => ({
    'routes/cursos.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Siembra cursos de ejemplo la primera vez para que /cursos.html se vea desde el arranque
db.seedIfEmpty('courses', ${JSON.stringify(SEMILLA, null, 2)});

// Vista pública resumida de un curso (sin el cuerpo de las lecciones)
const resumen = (c, alumnos) => ({ id: c.id, title: c.title, description: c.description || '', lessons: (c.lessons || []).length, students: alumnos });

// Cantidad de alumnos inscriptos de un curso
async function alumnosDe(courseId) {
  return (await db.find('courseprogress', p => p.courseId === courseId)).length;
}

// Normaliza el email para que la inscripción sea idempotente sin duplicar por mayúsculas
const normEmail = (e) => String(e || '').trim().toLowerCase();

// GET /api/cursos — cursos publicados con cantidad de lecciones y alumnos (público)
router.get('/', async (req, res) => {
  const rows = (await db.all('courses')).filter(c => c.published !== false);
  const out = [];
  for (const c of rows) out.push(resumen(c, await alumnosDe(c.id)));
  res.json(out);
});

// GET /api/cursos/:id — un curso publicado con sus lecciones completas (público)
router.get('/:id', async (req, res) => {
  const c = await db.get('courses', req.params.id);
  if (!c || c.published === false) return res.status(404).json({ error: 'Curso inexistente' });
  res.json({ id: c.id, title: c.title, description: c.description || '', lessons: c.lessons || [], students: await alumnosDe(c.id) });
});

// POST /api/cursos/:id/enroll — inscribe (o recupera) al alumno por email; idempotente (público)
router.post('/:id/enroll', async (req, res) => {
  const c = await db.get('courses', req.params.id);
  if (!c || c.published === false) return res.status(404).json({ error: 'Curso inexistente' });
  const email = normEmail(req.body && req.body.email);
  if (!isEmail(email)) return res.status(422).json({ error: 'Ingresá un email válido' });
  let row = (await db.find('courseprogress', p => p.courseId === c.id && p.email === email))[0];
  let creado = false;
  if (!row) {
    row = await db.insert('courseprogress', { courseId: c.id, email, done: [] });
    creado = true;
  }
  res.status(creado ? 201 : 200).json({ courseId: c.id, done: row.done || [], total: (c.lessons || []).length, already: !creado });
});

// POST /api/cursos/:id/progress — marca una lección como completada (público, requiere inscripción)
router.post('/:id/progress', async (req, res) => {
  const c = await db.get('courses', req.params.id);
  if (!c || c.published === false) return res.status(404).json({ error: 'Curso inexistente' });
  const email = normEmail(req.body && req.body.email);
  if (!isEmail(email)) return res.status(422).json({ error: 'Ingresá un email válido' });
  const lesson = String((req.body && req.body.lesson) || '').trim();
  if (!(c.lessons || []).some(l => l.id === lesson)) return res.status(422).json({ error: 'Lección inválida' });
  const row = (await db.find('courseprogress', p => p.courseId === c.id && p.email === email))[0];
  if (!row) return res.status(404).json({ error: 'Inscribite al curso antes de marcar lecciones' });
  // Idempotente: marcar dos veces la misma lección no duplica el avance
  const done = [...new Set([...(row.done || []), lesson])].filter(id => (c.lessons || []).some(l => l.id === id));
  await db.update('courseprogress', row.id, { done });
  res.json({ courseId: c.id, done, total: (c.lessons || []).length });
});
${cfg.moduleIds.includes('auth') ? `
// Convierte el texto del ABM (una lección por línea, "Título | contenido") en lecciones con id estable
function parsearLecciones(texto) {
  return String(texto || '').split('\\n').map(l => l.trim()).filter(Boolean).slice(0, 60).map((linea, i) => {
    const sep = linea.indexOf('|');
    const title = (sep >= 0 ? linea.slice(0, sep) : linea).trim().slice(0, 140);
    const body = (sep >= 0 ? linea.slice(sep + 1) : '').trim().slice(0, 1000);
    return { id: 'l' + (i + 1), title, body };
  }).filter(l => l.title.length >= 2);
}

// GET /api/cursos/admin/all — todos los cursos con alumnos, incluidos borradores (solo admin)
router.get('/admin/all', requireAdmin, async (req, res) => {
  const rows = await db.all('courses');
  const out = [];
  for (const c of rows) out.push({ ...c, students: await alumnosDe(c.id) });
  res.json(out);
});

// POST /api/cursos/admin — crea un curso (solo admin); lessonsText = una lección por línea
router.post('/admin', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, { title: (v) => str(v, 2, 120) });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const lessons = parsearLecciones(req.body.lessonsText);
  if (!lessons.length) return res.status(422).json({ error: 'Escribí al menos una lección (una por línea)' });
  const row = await db.insert('courses', {
    title: req.body.title.trim(),
    description: typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 400) : '',
    lessons,
    published: req.body.published !== false,
  });
  res.status(201).json(row);
});

// PATCH /api/cursos/admin/:id — edita un curso o cambia su publicación (solo admin)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.title !== undefined) { if (!str(req.body.title, 2, 120)) return res.status(422).json({ error: 'Título inválido' }); patch.title = req.body.title.trim(); }
  if (req.body.description !== undefined) patch.description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 400) : '';
  if (req.body.lessonsText !== undefined) {
    const lessons = parsearLecciones(req.body.lessonsText);
    if (!lessons.length) return res.status(422).json({ error: 'Escribí al menos una lección (una por línea)' });
    patch.lessons = lessons;
  }
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  const row = await db.update('courses', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Curso inexistente' });
  res.json(row);
});

// DELETE /api/cursos/admin/:id — borra un curso y el progreso de sus alumnos (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const c = await db.get('courses', req.params.id);
  if (!c) return res.status(404).json({ error: 'Curso inexistente' });
  await db.remove('courses', req.params.id);
  for (const p of await db.find('courseprogress', p => p.courseId === req.params.id)) await db.remove('courseprogress', p.id);
  res.json({ ok: true });
});
` : `// El ABM de cursos (crear, editar, publicar, borrar) requiere el módulo de autenticación: activalo
// en el Builder para habilitar /cursos-admin.html. Sin él, se muestran los cursos sembrados y podés
// editarlos a mano en data/courses.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => {
    const pgs = {
      cursos: {
        title: 'Cursos',
        html: `  <section>
    <div class="container">
      <div id="cu-list-view">
        <h2>Nuestros cursos</h2>
        <p class="section-sub">Aprendé a tu ritmo: inscribite con tu email, marcá tu avance y retomalo cuando quieras desde cualquier dispositivo.</p>
        <div id="cu-list" class="grid cols-2"><p class="cu-empty">Cargando cursos…</p></div>
      </div>
      <div id="cu-course-view" hidden>
        <a href="/cursos.html" class="cu-back" id="cu-back">&larr; Volver a los cursos</a>
        <h2 id="cu-title"></h2>
        <p class="section-sub" id="cu-desc"></p>
        <form id="cu-enroll" class="card cu-enroll">
          <label for="cu-email">Tu email para guardar el avance</label>
          <input type="email" id="cu-email" required placeholder="tu@email.com">
          <button class="btn" type="submit" style="margin-top:12px">Empezar el curso</button>
        </form>
        <div id="cu-prog" class="cu-prog" hidden>
          <p style="margin:0 0 8px">Tu avance: <span class="cu-pct" id="cu-pct">0%</span> <span class="muted" id="cu-count"></span></p>
          <div class="cu-bar"><div class="cu-fill" id="cu-fill"></div></div>
        </div>
        <div id="cu-lessons"></div>
      </div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['cursos-admin'] = {
        title: 'Administrar cursos',
        html: `  <section>
    <div class="container">
      <h2>Administrar cursos</h2>
      <p class="section-sub">Creá y editá tus cursos. Las lecciones se escriben una por línea con el formato "Título | contenido". Solo visible para administradores.</p>
      <form id="cua-form" class="card" style="max-width:680px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <label>Título del curso</label>
        <input name="title" required minlength="2" maxlength="120" placeholder="Ej: Introducción a nuestro método">
        <label>Descripción (opcional)</label>
        <textarea name="description" rows="2" maxlength="400" placeholder="Qué va a aprender el alumno."></textarea>
        <label>Lecciones (una por línea: Título | contenido)</label>
        <textarea name="lessonsText" rows="6" required placeholder="Bienvenida | Qué vas a encontrar en el curso.&#10;Primer tema | Desarrollo de la lección."></textarea>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:12px"><input type="checkbox" name="published" checked style="width:auto"> Publicado (visible en /cursos.html)</label>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn" type="submit" id="cua-save">Guardar curso</button>
          <button class="btn ghost" type="button" id="cua-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="cua-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo cursos con progreso: página pública /cursos.html (listado, lecciones, inscripción por email
   y avance con barra + porcentaje animados con Anime.js) y, con auth activo, el ABM en
   /cursos-admin.html. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEMO = [
    { id: 'd1', title: 'Introducción a nuestro método', description: 'Las bases para arrancar.', lessons: 3, students: 24 },
    { id: 'd2', title: 'Nivel intermedio', description: 'Técnicas avanzadas y casos reales.', lessons: 2, students: 9 },
  ];
  var DEMO_LECCIONES = [
    { id: 'l1', title: 'Bienvenida', body: 'Qué vas a encontrar en cada lección.' },
    { id: 'l2', title: 'Los tres pilares', body: 'Claridad, práctica y constancia.' },
    { id: 'l3', title: 'Ejercicio práctico', body: 'Una consigna corta para aplicar lo visto.' },
  ];

  // Barra de progreso + porcentaje animados; red de seguridad si el loop está pausado (pestaña oculta)
  function animarProgreso(pct) {
    var fill = document.getElementById('cu-fill');
    var label = document.getElementById('cu-pct');
    if (!fill || !label) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { fill.style.width = pct + '%'; label.textContent = pct + '%'; return; }
    anime.animate(fill, { width: pct + '%', duration: 600, ease: 'outCubic' });
    var st = { v: 0 };
    anime.animate(st, { v: pct, duration: 600, ease: 'outCubic', onUpdate: function () { label.textContent = Math.round(st.v) + '%'; } });
    setTimeout(function () { fill.style.width = pct + '%'; label.textContent = pct + '%'; }, 800);
  }

  // ---- Página pública /cursos.html ----
  var listBox = document.getElementById('cu-list');
  if (listBox) {
    var listView = document.getElementById('cu-list-view');
    var courseView = document.getElementById('cu-course-view');
    var enrollForm = document.getElementById('cu-enroll');
    var progBox = document.getElementById('cu-prog');
    var lessonsBox = document.getElementById('cu-lessons');
    var cursoActual = null;
    var emailActual = localStorage.getItem('cu-email') || '';
    var hechas = [];

    function pintarLista(cursos) {
      if (!cursos.length) { listBox.innerHTML = '<p class="cu-empty">Todavía no hay cursos publicados.</p>'; return; }
      listBox.innerHTML = cursos.map(function (c) {
        return '<div class="card cu-card" data-id="' + App.esc(c.id) + '" role="button" tabindex="0">' +
          '<h3 style="margin:0 0 6px">' + App.esc(c.title) + '</h3>' +
          (c.description ? '<p class="muted" style="margin:0">' + App.esc(c.description) + '</p>' : '') +
          '<div class="cu-meta"><span>' + c.lessons + (c.lessons === 1 ? ' lección' : ' lecciones') + '</span><span>' + c.students + (c.students === 1 ? ' alumno' : ' alumnos') + '</span></div>' +
        '</div>';
      }).join('');
      listBox.querySelectorAll('.cu-card').forEach(function (card) {
        function abrirCard() { abrir(card.getAttribute('data-id')); }
        card.addEventListener('click', abrirCard);
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirCard(); } });
      });
      var cards = [].slice.call(listBox.querySelectorAll('.cu-card'));
      var anime = window.anime;
      if (anime && anime.animate && !reduce && cards.length) {
        anime.animate(cards, { opacity: [0, 1], translateY: [14, 0], duration: 450, delay: anime.stagger ? anime.stagger(80) : 0, ease: 'outCubic' });
        setTimeout(function () { cards.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 900);
      }
    }

    function pintarLecciones() {
      if (!cursoActual) return;
      var inscripto = !progBox.hidden;
      lessonsBox.innerHTML = cursoActual.lessons.map(function (l) {
        var done = hechas.indexOf(l.id) >= 0;
        return '<div class="cu-lesson' + (done ? ' done' : '') + '">' +
          '<h4>' + App.esc(l.title) + (done ? ' <span class="cu-done-mark">${phIcon('check', { size: 13 })} completada</span>' : '') + '</h4>' +
          (l.body ? '<p>' + App.esc(l.body) + '</p>' : '') +
          (inscripto && !done ? '<button class="btn ghost" type="button" data-done="' + App.esc(l.id) + '" style="padding:5px 14px;font-size:.85rem">Marcar completada</button>' : '') +
        '</div>';
      }).join('');
      lessonsBox.querySelectorAll('[data-done]').forEach(function (b) {
        b.addEventListener('click', function () { completar(b.getAttribute('data-done')); });
      });
    }

    function refrescarProgreso() {
      if (!cursoActual) return;
      var total = cursoActual.lessons.length || 1;
      var pct = Math.round((hechas.length / total) * 100);
      document.getElementById('cu-count').textContent = '(' + hechas.length + ' de ' + total + ')';
      animarProgreso(pct);
    }

    async function completar(lessonId) {
      if (window.__PREVIEW__) {
        if (hechas.indexOf(lessonId) < 0) hechas.push(lessonId);
        refrescarProgreso(); pintarLecciones();
        return;
      }
      try {
        var r = await App.api('/api/cursos/' + cursoActual.id + '/progress', { method: 'POST', body: { email: emailActual, lesson: lessonId } });
        hechas = r.done;
        refrescarProgreso(); pintarLecciones();
        if (hechas.length === cursoActual.lessons.length) App.toast('¡Curso completado! Felicitaciones.');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    function mostrarCurso(c) {
      cursoActual = c;
      listView.hidden = true;
      courseView.hidden = false;
      document.getElementById('cu-title').textContent = c.title;
      document.getElementById('cu-desc').textContent = c.description || '';
      enrollForm.hidden = false;
      progBox.hidden = true;
      hechas = [];
      if (emailActual) document.getElementById('cu-email').value = emailActual;
      pintarLecciones();
    }

    function abrir(id) {
      if (window.__PREVIEW__) {
        mostrarCurso({ id: id, title: 'Introducción a nuestro método', description: 'Las bases para arrancar.', lessons: DEMO_LECCIONES });
        return;
      }
      App.api('/api/cursos/' + id).then(function (c) {
        mostrarCurso(c);
        // Enlace compartible al curso abierto
        try { history.replaceState(null, '', '/cursos.html?curso=' + encodeURIComponent(id)); } catch (e) { /* noop */ }
        // Si ya estaba inscripto con este email, retoma el avance solo
        if (emailActual) inscribir(true);
      }).catch(function () { App.toast('No encontramos ese curso'); });
    }

    async function inscribir(silencioso) {
      if (window.__PREVIEW__) {
        enrollForm.hidden = true; progBox.hidden = false;
        hechas = ['l1']; refrescarProgreso(); pintarLecciones();
        return;
      }
      try {
        var r = await App.api('/api/cursos/' + cursoActual.id + '/enroll', { method: 'POST', body: { email: emailActual } });
        localStorage.setItem('cu-email', emailActual);
        enrollForm.hidden = true;
        progBox.hidden = false;
        hechas = r.done;
        refrescarProgreso(); pintarLecciones();
        if (!silencioso) App.toast(r.already ? 'Retomaste tu avance' : '¡Inscripción lista! Marcá cada lección al terminarla.');
      } catch (err) { if (err.message !== 'preview' && !silencioso) App.toast(err.message); }
    }

    enrollForm.addEventListener('submit', function (e) {
      e.preventDefault();
      emailActual = document.getElementById('cu-email').value.trim().toLowerCase();
      if (!emailActual) return;
      inscribir(false);
    });

    // Carga inicial: lista de cursos, o directo un curso si viene ?curso= en la URL
    var qs = new URLSearchParams(location.search);
    var directo = qs.get('curso');
    if (window.__PREVIEW__) { pintarLista(DEMO); }
    else {
      App.api('/api/cursos').then(pintarLista).catch(function () { listBox.innerHTML = '<p class="cu-empty">No se pudieron cargar los cursos.</p>'; });
      if (directo) abrir(directo);
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- ABM /cursos-admin.html ----
  var adminBox = document.getElementById('cua-admin');
  var formA = document.getElementById('cua-form');
  if (adminBox && formA) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var idInput = formA.querySelector('[name="id"]');
    var cancelBtn = document.getElementById('cua-cancel');
    var saveBtn = document.getElementById('cua-save');

    function aTexto(lessons) {
      return (lessons || []).map(function (l) { return l.title + (l.body ? ' | ' + l.body : ''); }).join('\\n');
    }

    function pintar() {
      adminBox.innerHTML = App.table(todos, [
        { key: 'title', label: 'Curso' },
        { label: 'Lecciones', render: function (r) { return String((r.lessons || []).length); } },
        { label: 'Alumnos', render: function (r) { return String(r.students || 0); } },
        { label: 'Estado', render: function (r) { return r.published !== false ? '<span class="cu-badge on">Publicado</span>' : '<span class="cu-badge">Borrador</span>'; } },
        { label: 'Acciones', render: function (r) {
          return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-pub="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (r.published !== false ? 'Despublicar' : 'Publicar') + '</button>' +
            '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      adminBox.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      adminBox.querySelectorAll('[data-pub]').forEach(function (b) { b.addEventListener('click', function () { togglePub(b.getAttribute('data-pub')); }); });
      adminBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
    }

    function resetForm() {
      formA.reset(); idInput.value = '';
      formA.querySelector('[name="published"]').checked = true;
      saveBtn.textContent = 'Guardar curso';
      if (cancelBtn) cancelBtn.hidden = true;
    }

    function editar(id) {
      var c = todos.filter(function (r) { return r.id === id; })[0];
      if (!c) return;
      idInput.value = c.id;
      formA.querySelector('[name="title"]').value = c.title;
      formA.querySelector('[name="description"]').value = c.description || '';
      formA.querySelector('[name="lessonsText"]').value = aTexto(c.lessons);
      formA.querySelector('[name="published"]').checked = c.published !== false;
      saveBtn.textContent = 'Guardar cambios';
      if (cancelBtn) cancelBtn.hidden = false;
      formA.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    async function togglePub(id) {
      var c = todos.filter(function (r) { return r.id === id; })[0];
      if (!c) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: cambiaría la publicación'); return; }
      try {
        var row = await App.api('/api/cursos/admin/' + id, { method: 'PATCH', body: { published: c.published === false } });
        c.published = row.published; pintar();
        App.toast(c.published ? 'Curso publicado' : 'Curso despublicado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este curso? También se borra el avance de sus alumnos.')) return;
      try {
        await App.api('/api/cursos/admin/' + id, { method: 'DELETE' });
        todos = todos.filter(function (r) { return r.id !== id; });
        pintar();
        App.toast('Curso borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    formA.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        title: formA.querySelector('[name="title"]').value,
        description: formA.querySelector('[name="description"]').value,
        lessonsText: formA.querySelector('[name="lessonsText"]').value,
        published: formA.querySelector('[name="published"]').checked,
      };
      var editando = idInput.value;
      if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'crearía') + ' el curso'); return; }
      try {
        if (editando) {
          var upd = await App.api('/api/cursos/admin/' + editando, { method: 'PATCH', body: datos });
          todos = todos.map(function (r) { return r.id === editando ? { ...upd, students: r.students } : r; });
          App.toast('Cambios guardados');
        } else {
          var nuevo = await App.api('/api/cursos/admin', { method: 'POST', body: datos });
          todos.push({ ...nuevo, students: 0 });
          App.toast('Curso creado');
        }
        resetForm();
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function listo(rows) { todos = rows; pintar(); }
    if (window.__PREVIEW__) {
      listo([
        { id: 'd1', title: 'Introducción a nuestro método', description: 'Las bases.', lessons: [{ id: 'l1', title: 'Bienvenida', body: '' }], published: true, students: 24 },
        { id: 'd2', title: 'Nivel intermedio', description: 'Avanzado.', lessons: [{ id: 'l1', title: 'Repaso', body: '' }], published: false, students: 0 },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/cursos/admin/all').then(listo).catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navC = document.getElementById('nav-cursos-admin');
    if (navC && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navC.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Cursos con progreso**: los cursos viven en la colección \`courses\` (con sus lecciones adentro) y el avance de cada alumno en \`courseprogress\`. El alumno se inscribe en \`/cursos.html\` con su email (sin contraseña) y marca lecciones completadas; el avance queda en el servidor y se retoma con el mismo email desde cualquier dispositivo. Se siembran dos cursos de ejemplo. ${cfg.moduleIds.includes('auth') ? 'Los administradores crean y editan cursos en \`/cursos-admin.html\` (las lecciones se escriben una por línea con el formato "Título | contenido"); al reordenar o quitar lecciones de un curso, el avance ya marcado sobre lecciones que cambian de posición puede reasignarse (los ids son por posición: l1, l2…).' : 'Para administrar los cursos desde la web activá el módulo **Autenticación** (habilita \`/cursos-admin.html\`); sin él, editá \`data/courses.json\` a mano.'}`,
  ],
};
