// Preguntas del público ("Preguntanos"): sección en la Home donde cualquier visitante deja
// una pregunta que queda pendiente de moderación; el equipo la responde y, al publicarla,
// aparece en un acordeón para todos. El backend guarda las preguntas (colección questions)
// con su estado publicado/pendiente. La lista pública muestra solo las respondidas y
// publicadas; abrir/cerrar cada respuesta se anima con Anime.js (red de seguridad setTimeout
// + respeta "prefers-reduced-motion"). Con auth activo, suma una página /preguntas.html
// solo-admin para responder, publicar y borrar. Sin auth las preguntas se guardan igual y
// se moderan editando data/questions.json. Distinto de "faq" (lista fija que definís vos),
// de "tickets" (soporte privado con código) y de "comments" (comentarios de blog): acá es
// un muro público de preguntas y respuestas moderadas.
module.exports = {
  id: 'qanda', type: 'functional', name: 'Preguntas del público',
  description: 'Muro público de preguntas y respuestas moderadas: el visitante deja una pregunta, el equipo la responde y las publicadas se ven en un acordeón animado (Anime.js). Con auth activo, moderación en /preguntas.html.',
  usesAnime: true,
  mounts: [{ route: '/api/qanda', file: 'routes/qanda.js' }],
  collections: ['questions'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Preguntas', href: '/preguntas.html', id: 'nav-preguntas' }] : [],
  html: () => `  <section id="preguntanos">
    <div class="container">
      <h2>Preguntanos</h2>
      <p class="section-sub">¿Tenés una duda? Dejala acá. Respondemos las más frecuentes y las publicamos para todos.</p>
      <div class="grid cols-2">
        <form id="qa-form" class="card">
          <h3>Hacé tu pregunta</h3>
          <label>Tu nombre <span class="muted">(opcional)</span></label>
          <input name="name" maxlength="80" placeholder="Cómo querés que te llamemos">
          <label>Tu pregunta</label>
          <textarea name="question" rows="4" required minlength="8" maxlength="500" placeholder="Escribí tu pregunta con el mayor detalle posible"></textarea>
          <div style="margin-top:16px"><button class="btn" type="submit">Enviar pregunta</button></div>
          <div id="qa-gracias" class="qa-gracias" hidden>¡Gracias! Tu pregunta quedó pendiente de respuesta.</div>
        </form>
        <div>
          <h3>Preguntas respondidas</h3>
          <div id="qa-lista"><p class="muted">Cargando…</p></div>
        </div>
      </div>
      <noscript><p class="muted">Activá JavaScript para enviar y ver preguntas.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    .qa-gracias{margin-top:14px;background:var(--surface);border-left:3px solid var(--accent);padding:10px 14px;border-radius:0 var(--radius) var(--radius) 0;font-size:.9rem}
    .qa-item{border:1.5px solid var(--line);border-radius:var(--radius);margin-bottom:10px;overflow:hidden}
    .qa-q{width:100%;text-align:left;background:var(--bg);border:0;color:var(--text);font:inherit;font-weight:600;padding:14px 16px;cursor:pointer;display:flex;justify-content:space-between;gap:12px;align-items:center}
    .qa-q:hover,.qa-q:focus-visible{color:var(--accent)}
    .qa-flecha{transition:transform .25s ease;flex:0 0 auto}
    .qa-item.abierto .qa-flecha{transform:rotate(180deg)}
    .qa-a{overflow:hidden;height:0}
    .qa-a-inner{padding:0 16px 14px;color:var(--muted);white-space:pre-line}
    .qa-autor{display:block;margin-top:8px;font-size:.82rem;color:var(--muted)}
  </style>`,
  files: (cfg) => ({
    'routes/qanda.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
const validar = (data) => check(data, {
  question: (v) => str(v, 8, 500),
  name: (v) => v === undefined || v === '' || str(v, 0, 80),
});

// Vista pública de una pregunta publicada: sin datos internos
const publica = (q) => ({ id: q.id, name: q.name || '', question: q.question, answer: q.answer || '', createdAt: q.createdAt });

// GET /api/qanda — preguntas respondidas y publicadas, de más nueva a más vieja (público)
router.get('/', async (req, res) => {
  const rows = await db.find('questions', q => q.published && q.answer);
  res.json(rows.reverse().map(publica));
});

// POST /api/qanda — deja una pregunta { question, name? } pendiente de moderación
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  await db.insert('questions', {
    name: String(req.body.name || '').trim(),
    question: req.body.question.trim(),
    answer: '',
    published: false,
  });
  res.status(201).json({ ok: true, message: 'Pregunta recibida' });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/qanda/all — todas las preguntas incluidas las pendientes (solo admin)
router.get('/all', requireAdmin, async (req, res) => {
  const rows = await db.all('questions');
  res.json(rows.reverse());
});

// PATCH /api/qanda/:id — responde y/o publica una pregunta (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const patch = {};
  if (req.body.answer !== undefined) {
    if (typeof req.body.answer !== 'string' || req.body.answer.length > 1000) {
      return res.status(422).json({ error: 'Respuesta inválida', errors: { answer: 'Hasta 1000 caracteres' } });
    }
    patch.answer = req.body.answer.trim();
  }
  if (req.body.published !== undefined) patch.published = !!req.body.published;
  if (!Object.keys(patch).length) return res.status(422).json({ error: 'Nada para actualizar' });
  const row = await db.update('questions', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Pregunta inexistente' });
  res.json(row);
});

// DELETE /api/qanda/:id — elimina una pregunta (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  db.remove('questions', req.params.id);
  res.json({ ok: true });
});
` : `// La moderación (responder, publicar, borrar) requiere el módulo de autenticación:
// activalo en el Builder para habilitar /preguntas.html. Sin él, las preguntas quedan
// guardadas en data/questions.json (respondé y poné "published": true a mano).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    preguntas: {
      title: 'Preguntas',
      html: `  <section>
    <div class="container">
      <h2>Moderar preguntas</h2>
      <p class="section-sub">Respondé, publicá o borrá las preguntas del público. Solo visible para administradores.</p>
      <div id="qa-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo preguntas del público: envía preguntas a moderación, muestra las publicadas en
   un acordeón que abre/cierra con Anime.js (red de seguridad) y, con auth, arma la
   moderación en /preguntas.html. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };

  var DEMO = [
    { id: 'd1', name: 'María', question: '¿Hacen envíos a todo el país?', answer: 'Sí, enviamos a todo el país por correo. El costo se calcula al finalizar la compra según el destino.', createdAt: new Date().toISOString() },
    { id: 'd2', name: '', question: '¿Puedo pagar en cuotas?', answer: 'Sí, aceptamos las principales tarjetas y ofrecemos planes de cuotas según promociones vigentes.', createdAt: new Date().toISOString() },
  ];

  // ---- Sección pública (Home): enviar pregunta + acordeón de respondidas ----
  var form = document.getElementById('qa-form');
  var listaBox = document.getElementById('qa-lista');

  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var gracias = document.getElementById('qa-gracias');
    if (window.__PREVIEW__) { form.reset(); if (gracias) gracias.hidden = false; return; }
    try {
      await App.api('/api/qanda', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      if (gracias) gracias.hidden = false;
      App.toast('¡Pregunta enviada!');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  function pintarLista(items) {
    if (!listaBox) return;
    if (!items.length) { listaBox.innerHTML = '<p class="muted">Todavía no hay preguntas respondidas. ¡Sé el primero en preguntar!</p>'; return; }
    listaBox.innerHTML = items.map(function (q, i) {
      return '<div class="qa-item" data-i="' + i + '">' +
        '<button type="button" class="qa-q" aria-expanded="false"><span>' + App.esc(q.question) + '</span><span class="qa-flecha" aria-hidden="true">▾</span></button>' +
        '<div class="qa-a"><div class="qa-a-inner">' + App.esc(q.answer) +
        (q.name ? '<span class="qa-autor">Preguntó ' + App.esc(q.name) + '</span>' : '') +
        '</div></div></div>';
    }).join('');
    enlazarAcordeon();
  }

  function enlazarAcordeon() {
    listaBox.querySelectorAll('.qa-item').forEach(function (item) {
      var btn = item.querySelector('.qa-q');
      var panel = item.querySelector('.qa-a');
      btn.addEventListener('click', function () {
        var abierto = item.classList.contains('abierto');
        if (abierto) cerrar(item, panel, btn); else abrir(item, panel, btn);
      });
    });
  }

  function abrir(item, panel, btn) {
    item.classList.add('abierto');
    btn.setAttribute('aria-expanded', 'true');
    var alto = panel.firstElementChild.offsetHeight;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { panel.style.height = 'auto'; return; }
    anime.animate(panel, { height: [0, alto], duration: 320, ease: 'outCubic', onComplete: function () { panel.style.height = 'auto'; } });
    // Red de seguridad: deja el panel abierto si el loop está pausado (pestaña oculta)
    setTimeout(function () { if (item.classList.contains('abierto')) panel.style.height = 'auto'; }, 500);
  }

  function cerrar(item, panel, btn) {
    item.classList.remove('abierto');
    btn.setAttribute('aria-expanded', 'false');
    var alto = panel.firstElementChild.offsetHeight;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { panel.style.height = '0px'; return; }
    panel.style.height = alto + 'px';
    anime.animate(panel, { height: [alto, 0], duration: 260, ease: 'inCubic' });
    setTimeout(function () { if (!item.classList.contains('abierto')) panel.style.height = '0px'; }, 420);
  }

  if (listaBox) {
    if (window.__PREVIEW__) { pintarLista(DEMO); }
    else {
      App.api('/api/qanda').then(pintarLista)
        .catch(function (err) { listaBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Moderación admin (/preguntas.html) ----
  var adminBox = document.getElementById('qa-admin');
  if (adminBox) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');

    function pintarAdmin(rows) {
      if (!rows.length) { adminBox.innerHTML = '<p class="muted">No hay preguntas todavía.</p>'; return; }
      adminBox.innerHTML = rows.map(function (q) {
        return '<div class="card" style="margin-bottom:12px" data-q="' + q.id + '">' +
          '<p style="margin:0 0 4px"><strong>' + App.esc(q.question) + '</strong></p>' +
          '<p class="muted" style="margin:0 0 8px;font-size:.82rem">' + (q.name ? App.esc(q.name) + ' · ' : '') + (q.createdAt ? new Date(q.createdAt).toLocaleDateString('es-AR') : '') + (q.published ? ' · <span style="color:var(--accent)">publicada</span>' : ' · pendiente') + '</p>' +
          '<textarea data-answer rows="3" placeholder="Escribí la respuesta" style="width:100%">' + App.esc(q.answer || '') + '</textarea>' +
          '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:8px">' +
          '<label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" data-pub style="width:auto"' + (q.published ? ' checked' : '') + '> Publicada</label>' +
          '<button class="btn ghost" type="button" data-save style="width:auto">Guardar</button>' +
          '<button class="btn ghost" type="button" data-del style="width:auto;color:#b91c1c">Borrar</button>' +
          '</div></div>';
      }).join('');
      adminBox.querySelectorAll('[data-q]').forEach(function (row) {
        var id = row.getAttribute('data-q');
        row.querySelector('[data-save]').addEventListener('click', async function () {
          var answer = row.querySelector('[data-answer]').value;
          var published = row.querySelector('[data-pub]').checked;
          try { await App.api('/api/qanda/' + id, { method: 'PATCH', body: { answer: answer, published: published } }); App.toast('Guardado'); }
          catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
        row.querySelector('[data-del]').addEventListener('click', async function () {
          if (!confirm('¿Borrar esta pregunta?')) return;
          try { await App.api('/api/qanda/' + id, { method: 'DELETE' }); row.remove(); App.toast('Borrada'); }
          catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    if (window.__PREVIEW__) {
      pintarAdmin([
        { id: 'd1', name: 'María', question: '¿Hacen envíos a todo el país?', answer: 'Sí, a todo el país.', published: true, createdAt: new Date().toISOString() },
        { id: 'd3', name: '', question: '¿Tienen local a la calle?', answer: '', published: false, createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/qanda/all').then(pintarAdmin)
        .catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navPre = document.getElementById('nav-preguntas');
    if (navPre && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navPre.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Preguntas del público**: los visitantes dejan preguntas en la Home (colección \`questions\`, quedan pendientes). ${cfg.moduleIds.includes('auth') ? 'Los administradores las responden, publican o borran en \`/preguntas.html\`; solo las publicadas se muestran al público.' : 'Para moderarlas activá el módulo **Autenticación** (habilita \`/preguntas.html\`); sin él, editá \`data/questions.json\`: agregá el texto en \`answer\` y poné \`"published": true\` para que aparezcan.'}`,
  ],
};
