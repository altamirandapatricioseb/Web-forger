// Encuesta NPS ("¿Qué tan probable es que nos recomiendes?"): sección en la Home donde el
// visitante puntúa de 0 a 10 y deja un comentario opcional. El backend guarda cada respuesta
// (colección npsresponses) y calcula el NPS en vivo (promotores 9-10, pasivos 7-8, detractores
// 0-6; NPS = %promotores − %detractores). El puntaje se muestra con un count-up y las barras de
// distribución se animan con Anime.js (red de seguridad setTimeout + respeta
// "prefers-reduced-motion"). Un voto por navegador (localStorage). Con auth activo, suma una
// página /nps.html solo-admin con la distribución, los comentarios y CSV. Sin auth las respuestas
// se guardan igual y se leen en data/npsresponses.json. Distinto de "feedback" (¿te resultó útil?
// por página, sí/no) y de "polls" (encuesta de opción múltiple): acá se mide la métrica NPS clásica.
module.exports = {
  id: 'nps', type: 'functional', name: 'Encuesta NPS',
  description: 'Encuesta "¿Nos recomendarías?" de 0 a 10 con comentario opcional. Calcula el NPS en vivo (promotores/pasivos/detractores) y lo muestra con Anime.js. Con auth activo, panel admin en /nps.html con la distribución, comentarios y CSV. Un voto por navegador.',
  usesAnime: true,
  mounts: [{ route: '/api/nps', file: 'routes/nps.js' }],
  collections: ['npsresponses'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'NPS', href: '/nps.html', id: 'nav-nps' }] : [],
  html: () => `  <section id="nps">
    <div class="container" style="max-width:680px">
      <h2>¿Nos recomendarías?</h2>
      <p class="section-sub">Del 0 al 10, ¿qué tan probable es que nos recomiendes a un amigo o colega?</p>
      <div id="nps-form">
        <div class="nps-escala" id="nps-escala" role="group" aria-label="Puntaje de 0 a 10"></div>
        <div class="nps-extremos"><span>Nada probable</span><span>Muy probable</span></div>
        <label for="nps-comentario" style="margin-top:14px">¿Por qué? (opcional)</label>
        <textarea id="nps-comentario" rows="2" maxlength="300" placeholder="Contanos brevemente el motivo de tu puntaje"></textarea>
        <button class="btn" type="button" id="nps-enviar" style="margin-top:12px" disabled>Enviar mi respuesta</button>
      </div>
      <div id="nps-gracias" hidden>
        <p class="nps-thanks">¡Gracias por tu opinión!</p>
        <div class="nps-resultado">
          <div class="nps-score"><strong class="nps-num" data-n="0">0</strong><span>NPS actual</span></div>
          <div class="nps-barras" id="nps-barras"></div>
        </div>
        <p class="muted" style="font-size:.82rem;text-align:center;margin:10px 0 0"><span class="nps-total" id="nps-total">0</span> respuestas hasta ahora</p>
      </div>
      <noscript><p class="muted">Activá JavaScript para responder la encuesta.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    #nps .nps-escala{display:flex;flex-wrap:wrap;gap:6px;justify-content:space-between;margin:8px 0 4px}
    #nps .nps-op{flex:1;min-width:34px;aspect-ratio:1;border:1px solid var(--line);background:var(--bg);border-radius:var(--radius);font-weight:700;color:var(--muted);cursor:pointer;font-variant-numeric:tabular-nums}
    #nps .nps-op:hover{border-color:var(--accent);color:var(--accent)}
    #nps .nps-op[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
    #nps .nps-extremos{display:flex;justify-content:space-between;font-size:.78rem;color:var(--muted)}
    #nps .nps-thanks{font-weight:700;text-align:center;font-size:1.05rem;margin:0 0 14px}
    #nps .nps-resultado{display:flex;gap:20px;align-items:center;flex-wrap:wrap;justify-content:center}
    #nps .nps-score{display:flex;flex-direction:column;align-items:center;min-width:110px}
    #nps .nps-score strong{font-size:2.6rem;line-height:1;color:var(--accent);font-variant-numeric:tabular-nums}
    #nps .nps-score span{font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
    #nps .nps-barras{flex:1;min-width:220px;display:grid;gap:8px}
    #nps .nps-fila{display:grid;grid-template-columns:92px 1fr 40px;align-items:center;gap:8px;font-size:.82rem}
    #nps .nps-track{height:10px;background:var(--surface);border-radius:999px;overflow:hidden}
    #nps .nps-fill{height:100%;width:0;border-radius:999px}
  </style>`,
  files: (cfg) => ({
    'routes/nps.js': `const router = require('express').Router();
const db = require('../src/db');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Categoría NPS según el puntaje (métrica estándar)
const categoria = (n) => (n >= 9 ? 'promotor' : n >= 7 ? 'pasivo' : 'detractor');

// Resumen agregado: totales por categoría y NPS = %promotores − %detractores
async function resumen() {
  const rows = await db.all('npsresponses');
  const total = rows.length;
  const c = { promotor: 0, pasivo: 0, detractor: 0 };
  for (const r of rows) c[r.category || categoria(r.score)]++;
  const nps = total ? Math.round((c.promotor - c.detractor) * 100 / total) : 0;
  return { total, nps, promotores: c.promotor, pasivos: c.pasivo, detractores: c.detractor };
}

// GET /api/nps/summary — NPS y distribución en vivo (público, sin comentarios)
router.get('/summary', async (req, res) => {
  res.json(await resumen());
});

// POST /api/nps — registra una respuesta { score (0-10), comment? }
router.post('/', async (req, res) => {
  const score = req.body && req.body.score;
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    return res.status(422).json({ error: 'Puntaje inválido', errors: { score: 'Debe ser un entero de 0 a 10' } });
  }
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 300) : '';
  await db.insert('npsresponses', { score, category: categoria(score), comment });
  res.status(201).json(await resumen());
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/nps/all — todas las respuestas, de más nueva a más vieja (solo admin; filtro ?category=)
router.get('/all', requireAdmin, async (req, res) => {
  let rows = await db.all('npsresponses');
  if (['promotor', 'pasivo', 'detractor'].includes(req.query.category)) rows = rows.filter(r => r.category === req.query.category);
  res.json({ resumen: await resumen(), respuestas: rows.reverse() });
});
` : `// El detalle de respuestas y comentarios requiere el módulo de autenticación: activalo en el
// Builder para habilitar /nps.html. Sin él, las respuestas quedan en data/npsresponses.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    nps: {
      title: 'Encuesta NPS',
      html: `  <section>
    <div class="container">
      <h2>Resultados de NPS</h2>
      <p class="section-sub">Puntaje neto de recomendación y comentarios de los visitantes. Solo visible para administradores.</p>
      <div id="nps-admin-resumen"></div>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin:20px 0 12px">
        <select id="nps-filtro" style="width:auto;min-width:200px">
          <option value="">Todas las respuestas</option>
          <option value="promotor">Promotores (9-10)</option>
          <option value="pasivo">Pasivos (7-8)</option>
          <option value="detractor">Detractores (0-6)</option>
        </select>
        <button class="btn ghost" type="button" id="nps-csv">Descargar CSV</button>
      </div>
      <div id="nps-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo NPS: sección pública con la escala 0-10 y resultado en vivo (Anime.js + red de
   seguridad), y con auth activo, el panel admin en /nps.html. Un voto por navegador
   (localStorage). En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CATS = [
    { key: 'promotores', label: 'Promotores', color: '#16a34a' },
    { key: 'pasivos', label: 'Pasivos', color: '#d97706' },
    { key: 'detractores', label: 'Detractores', color: '#dc2626' },
  ];

  function contar(el, hasta) {
    if (!el) return;
    el.setAttribute('data-n', hasta);
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = hasta; return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 800, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = hasta; }, 1000);
  }

  // ---- Sección pública (Home) ----
  var escala = document.getElementById('nps-escala');
  if (escala) {
    var elegido = null;
    var enviar = document.getElementById('nps-enviar');
    var comentario = document.getElementById('nps-comentario');
    var formBox = document.getElementById('nps-form');
    var graciasBox = document.getElementById('nps-gracias');

    for (var n = 0; n <= 10; n++) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'nps-op'; b.textContent = n;
      b.setAttribute('data-score', n); b.setAttribute('aria-pressed', 'false');
      escala.appendChild(b);
    }
    escala.addEventListener('click', function (e) {
      var op = e.target.closest('.nps-op');
      if (!op) return;
      elegido = Number(op.getAttribute('data-score'));
      escala.querySelectorAll('.nps-op').forEach(function (x) { x.setAttribute('aria-pressed', String(x === op)); });
      if (enviar) enviar.disabled = false;
    });

    function yaVoto() { try { return localStorage.getItem('nps-voto'); } catch (e) { return null; } }
    function recordar() { try { localStorage.setItem('nps-voto', '1'); } catch (e) {} }

    function mostrarResultado(r) {
      if (formBox) formBox.hidden = true;
      if (graciasBox) graciasBox.hidden = false;
      contar(document.querySelector('#nps-gracias .nps-num'), r.nps || 0);
      var total = document.getElementById('nps-total');
      if (total) total.textContent = r.total || 0;
      var barras = document.getElementById('nps-barras');
      if (barras) {
        barras.innerHTML = CATS.map(function (c) {
          var val = r[c.key] || 0;
          var pct = r.total ? Math.round(val * 100 / r.total) : 0;
          return '<div class="nps-fila"><span>' + c.label + '</span>' +
            '<span class="nps-track"><span class="nps-fill" data-pct="' + pct + '" style="background:' + c.color + '"></span></span>' +
            '<span style="text-align:right">' + pct + '%</span></div>';
        }).join('');
        var anime = window.anime;
        barras.querySelectorAll('.nps-fill').forEach(function (f) {
          var pct = f.getAttribute('data-pct') + '%';
          if (!anime || !anime.animate || reduce) { f.style.width = pct; return; }
          anime.animate(f, { width: ['0%', pct], duration: 700, ease: 'outCubic' });
          setTimeout(function () { f.style.width = pct; }, 900);
        });
      }
    }

    if (yaVoto()) {
      if (window.__PREVIEW__) { mostrarResultado({ total: 128, nps: 42, promotores: 74, pasivos: 34, detractores: 20 }); }
      else App.api('/api/nps/summary').then(mostrarResultado).catch(function () {});
    }

    if (enviar) enviar.addEventListener('click', async function () {
      if (elegido === null) { App.toast('Elegí un puntaje de 0 a 10'); return; }
      var body = { score: elegido, comment: comentario ? comentario.value : '' };
      if (window.__PREVIEW__) { recordar(); mostrarResultado({ total: 129, nps: 43, promotores: 75, pasivos: 34, detractores: 20 }); return; }
      try {
        var r = await App.api('/api/nps', { method: 'POST', body: body });
        recordar();
        mostrarResultado(r);
        App.toast('¡Gracias por tu respuesta!');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel admin (/nps.html) ----
  var adminBox = document.getElementById('nps-admin');
  if (adminBox) {
    var filtro = document.getElementById('nps-filtro');
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todas = [];
    var CAT_LABEL = { promotor: 'Promotor', pasivo: 'Pasivo', detractor: 'Detractor' };
    var CAT_COLOR = { promotor: '#16a34a', pasivo: '#d97706', detractor: '#dc2626' };
    var ETIQUETAS = { createdAt: 'Fecha', score: 'Puntaje', category: 'Categoría', comment: 'Comentario' };

    function filtradas() {
      var v = filtro && filtro.value;
      return v ? todas.filter(function (r) { return r.category === v; }) : todas;
    }

    function pintarResumen(r) {
      var box = document.getElementById('nps-admin-resumen');
      if (!box) return;
      box.innerHTML = '<div class="card" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">' +
        '<div><div style="font-size:2.4rem;font-weight:800;color:var(--accent);line-height:1">' + (r.nps || 0) + '</div>' +
        '<div class="muted" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.04em">NPS</div></div>' +
        '<div class="muted" style="font-size:.9rem">' +
        '<div>Promotores: <strong>' + (r.promotores || 0) + '</strong></div>' +
        '<div>Pasivos: <strong>' + (r.pasivos || 0) + '</strong></div>' +
        '<div>Detractores: <strong>' + (r.detractores || 0) + '</strong></div>' +
        '<div>Total: <strong>' + (r.total || 0) + '</strong></div></div></div>';
    }

    function pintar() {
      adminBox.innerHTML = App.table(filtradas(), [
        { label: ETIQUETAS.createdAt, render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } },
        { label: ETIQUETAS.score, render: function (r) { return '<strong style="font-variant-numeric:tabular-nums">' + App.esc(String(r.score)) + '</strong>'; } },
        { label: ETIQUETAS.category, render: function (r) { return '<span class="badge" style="vertical-align:baseline;background:' + (CAT_COLOR[r.category] || 'var(--surface)') + ';color:#fff">' + App.esc(CAT_LABEL[r.category] || r.category) + '</span>'; } },
        { label: ETIQUETAS.comment, render: function (r) { return r.comment ? App.esc(r.comment) : '<span class="muted">—</span>'; } },
      ]);
    }

    if (filtro) filtro.addEventListener('change', pintar);

    var csvBtn = document.getElementById('nps-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var claves = ['createdAt', 'score', 'category', 'comment'];
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [claves.map(function (k) { return celda(ETIQUETAS[k] || k); }).join(';')];
      filtradas().forEach(function (r) { lineas.push(claves.map(function (k) { return celda(k === 'category' ? (CAT_LABEL[r[k]] || r[k]) : r[k]); }).join(';')); });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'nps-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    function listo(data) { todas = data.respuestas || []; pintarResumen(data.resumen || {}); pintar(); }

    if (window.__PREVIEW__) {
      listo({ resumen: { total: 3, nps: 33, promotores: 2, pasivos: 0, detractores: 1 }, respuestas: [
        { score: 10, category: 'promotor', comment: 'Excelente atención, súper recomendable.', createdAt: new Date().toISOString() },
        { score: 9, category: 'promotor', comment: '', createdAt: new Date().toISOString() },
        { score: 4, category: 'detractor', comment: 'Tardaron en responder.', createdAt: new Date().toISOString() },
      ] });
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/nps/all').then(listo)
        .catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navN = document.getElementById('nav-nps');
    if (navN && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navN.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Encuesta NPS**: las respuestas se guardan en la colección \`npsresponses\` con su categoría (promotor 9-10, pasivo 7-8, detractor 0-6). El NPS que ve el visitante es real (\`%promotores − %detractores\`). ${cfg.moduleIds.includes('auth') ? 'Los administradores ven la distribución, los comentarios y descargan el CSV en \`/nps.html\`.' : 'Para ver los comentarios y la distribución detallada activá el módulo **Autenticación** (habilita \`/nps.html\`); sin él, mirá \`data/npsresponses.json\`.'} Es un voto por navegador (localStorage); no hay dedupe fuerte del lado servidor.`,
  ],
};
