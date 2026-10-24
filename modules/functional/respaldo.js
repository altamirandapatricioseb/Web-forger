// Copia de seguridad con backend real: el administrador descarga TODOS los datos del sitio
// (todas las colecciones que usan los módulos activos, resueltas al generar el proyecto) en un
// único archivo JSON, y puede RESTAURARLO después — en el mismo sitio o en uno regenerado — con
// los ids y fechas originales preservados (las referencias cruzadas entre colecciones no se
// rompen). Cada exportación y restauración queda registrada en un historial (colección backuplog).
// El archivo de restauración viaja como octet-stream crudo (hasta 20 MB) para no chocar con el
// límite del express.json global — mismo truco que el módulo de subida de archivos. Es la pieza
// de tranquilidad que cualquier negocio necesita antes de operar en serio: si algo se rompe o se
// borra por error, hay una copia para volver atrás. Con Anime.js (KPIs con count-up, stagger de
// tarjetas) + red de seguridad. Requiere autenticación: todo el módulo es solo-admin.

module.exports = {
  id: 'respaldo', type: 'functional', name: 'Copia de seguridad',
  description: 'Panel solo-admin /respaldo-admin.html para descargar una copia completa de los datos del sitio (todas las colecciones de los módulos activos) en un archivo JSON y restaurarla cuando haga falta, preservando ids y fechas. Historial de copias y restauraciones con KPIs animados (Anime.js). Requiere Autenticación.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/respaldo', file: 'routes/respaldo.js' }],
  collections: ['backuplog'],
  nav: () => [{ label: 'Respaldo', href: '/respaldo-admin.html', id: 'nav-respaldo-admin' }],
  head: () => `  <style>
    .bk-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .bk-kpis .card{text-align:center;padding:16px}
    .bk-kpis strong{font-size:1.5rem;display:block;font-variant-numeric:tabular-nums}
    .bk-kpis .muted{font-size:.82rem}
    .bk-zona{border:1px dashed var(--line);border-radius:var(--radius);padding:18px;margin-bottom:18px}
    .bk-zona h3{margin:0 0 6px}
    .bk-zona p{margin:0 0 12px;color:var(--muted);font-size:.92rem}
  </style>`,
  files: (cfg) => {
    // Colecciones de ESTE proyecto (resueltas por el Builder según los módulos activos).
    // backuplog queda afuera: respaldar el propio historial de respaldos solo confunde.
    const colecciones = cfg.collections.filter(c => c !== 'backuplog');
    return {
      'routes/respaldo.js': `const router = require('express').Router();
const express = require('express');
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');

// Colecciones de este proyecto (las resuelve el Builder según los módulos activos)
const COLECCIONES = ${JSON.stringify(colecciones)};

// GET /api/respaldo/admin/stats — cuántos registros hay por colección + historial (solo admin)
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const conteos = {};
  for (const c of COLECCIONES) conteos[c] = await db.count(c);
  const historial = (await db.all('backuplog')).slice(-20).reverse();
  res.json({ colecciones: conteos, total: Object.values(conteos).reduce((a, b) => a + b, 0), historial });
});

// GET /api/respaldo/admin/export — descarga la copia completa en un JSON (solo admin)
router.get('/admin/export', requireAdmin, async (req, res) => {
  const data = {};
  let total = 0;
  for (const c of COLECCIONES) {
    data[c] = await db.all(c);
    total += data[c].length;
  }
  await db.insert('backuplog', { action: 'export', total, detail: COLECCIONES.length + ' colecciones' });
  res.setHeader('Content-Disposition', 'attachment; filename="respaldo-' + new Date().toISOString().slice(0, 10) + '.json"');
  res.json({ version: 1, generatedAt: new Date().toISOString(), collections: data });
});

// POST /api/respaldo/admin/import — restaura una copia (solo admin). El archivo viaja como
// octet-stream crudo para esquivar el límite de tamaño del express.json global (hasta 20 MB).
router.post('/admin/import', requireAdmin, express.raw({ type: 'application/octet-stream', limit: '20mb' }), async (req, res) => {
  let copia;
  try { copia = JSON.parse(req.body.toString('utf8')); } catch { return res.status(422).json({ error: 'El archivo no es un JSON válido' }); }
  if (!copia || copia.version !== 1 || !copia.collections || typeof copia.collections !== 'object') {
    return res.status(422).json({ error: 'El archivo no parece una copia de seguridad de este sitio (falta version/collections)' });
  }
  const restauradas = {};
  let total = 0;
  for (const [nombre, filas] of Object.entries(copia.collections)) {
    // Solo colecciones que este proyecto conoce y solo listas de objetos: lo demás se ignora
    if (!COLECCIONES.includes(nombre) || !Array.isArray(filas)) continue;
    if (filas.some(f => !f || typeof f !== 'object' || Array.isArray(f))) {
      return res.status(422).json({ error: 'La colección "' + nombre + '" tiene filas inválidas: no se restauró nada' });
    }
    await db.restore(nombre, filas);
    restauradas[nombre] = filas.length;
    total += filas.length;
  }
  if (!Object.keys(restauradas).length) return res.status(422).json({ error: 'La copia no trae ninguna colección de este proyecto' });
  await db.insert('backuplog', { action: 'import', total, detail: Object.keys(restauradas).length + ' colecciones' });
  res.json({ ok: true, total, restauradas });
});

module.exports = router;
`,
    };
  },
  pages: () => ({
    'respaldo-admin': {
      title: 'Copia de seguridad',
      html: `  <section>
    <div class="container" style="max-width:860px">
      <h2>Copia de seguridad</h2>
      <p class="section-sub">Descargá todos los datos del sitio en un archivo y restauralos cuando haga falta. Hacé una copia antes de cualquier cambio grande. Solo visible para administradores.</p>
      <div class="bk-kpis" id="bk-kpis"><p class="muted">Cargando…</p></div>
      <div class="grid cols-2" style="align-items:stretch">
        <div class="bk-zona">
          <h3>Descargar copia</h3>
          <p>Se genera un archivo JSON con todas las colecciones del sitio. Guardalo en un lugar seguro.</p>
          <button class="btn" type="button" id="bk-export">Descargar copia completa</button>
        </div>
        <div class="bk-zona">
          <h3>Restaurar copia</h3>
          <p><strong>Atención:</strong> restaurar reemplaza los datos actuales por los del archivo. No se puede deshacer.</p>
          <input type="file" id="bk-file" accept="application/json,.json">
          <button class="btn ghost" type="button" id="bk-import" style="margin-top:10px">Restaurar desde el archivo</button>
        </div>
      </div>
      <h3 style="margin:26px 0 10px">Historial</h3>
      <div id="bk-hist"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo copia de seguridad: exportación/restauración completa de datos solo-admin en
   /respaldo-admin.html, con historial. Animado con Anime.js (count-up, stagger) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var kpis = document.getElementById('bk-kpis');
  if (!kpis) {
    // No estamos en la página del panel: solo ocultar el link de navbar si corresponde
    var navR0 = document.getElementById('nav-respaldo-admin');
    var me0 = JSON.parse(localStorage.getItem('user') || 'null');
    if (navR0 && (!me0 || me0.role !== 'admin') && !window.__PREVIEW__) navR0.style.display = 'none';
    return;
  }
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var histBox = document.getElementById('bk-hist');

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = Number(hasta).toLocaleString('es-AR'); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR'); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = Number(hasta).toLocaleString('es-AR'); }, 800);
  }

  function pintarStats(s) {
    var cards = '<div class="card"><strong id="bk-k-total">0</strong><span class="muted">registros en total</span></div>';
    Object.keys(s.colecciones).forEach(function (c, i) {
      cards += '<div class="card bk-col"><strong id="bk-k-' + i + '">0</strong><span class="muted">' + App.esc(c) + '</span></div>';
    });
    kpis.innerHTML = cards;
    contar(document.getElementById('bk-k-total'), s.total);
    Object.keys(s.colecciones).forEach(function (c, i) { contar(document.getElementById('bk-k-' + i), s.colecciones[c]); });
    var anime = window.anime;
    var els = kpis.querySelectorAll('.card');
    if (anime && anime.animate && !reduce && els.length) {
      anime.animate(els, { opacity: [0, 1], translateY: [10, 0], duration: 380, delay: anime.stagger(40), ease: 'outCubic' });
      // Red de seguridad: deja todo visible aunque el loop esté pausado
      setTimeout(function () { els.forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; }); }, 1200);
    }
    pintarHist(s.historial || []);
  }

  function pintarHist(historial) {
    histBox.innerHTML = App.table(historial, [
      { label: 'Cuándo', render: function (r) { return new Date(r.createdAt).toLocaleString('es-AR'); } },
      { label: 'Acción', render: function (r) { return r.action === 'export' ? 'Copia descargada' : '<strong>Restauración</strong>'; } },
      { label: 'Registros', render: function (r) { return String(r.total); } },
      { label: 'Detalle', render: function (r) { return App.esc(r.detail || ''); } },
    ]);
  }

  function cargar() {
    App.api('/api/respaldo/admin/stats').then(pintarStats).catch(function (err) { kpis.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
  }

  var expBtn = document.getElementById('bk-export');
  if (expBtn) expBtn.addEventListener('click', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: se descargaría la copia'); return; }
    try {
      // La descarga necesita el token, así que va por fetch y se baja como blob
      var res = await fetch('/api/respaldo/admin/export', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      if (!res.ok) throw new Error((await res.json().catch(function () { return {}; })).error || 'No se pudo generar la copia');
      var blob = await res.blob();
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'respaldo-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      App.toast('Copia descargada: guardala en un lugar seguro');
      cargar();
    } catch (err) { App.toast(err.message); }
  });

  var impBtn = document.getElementById('bk-import');
  var fileInput = document.getElementById('bk-file');
  if (impBtn) impBtn.addEventListener('click', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: se restauraría la copia'); return; }
    var f = fileInput.files && fileInput.files[0];
    if (!f) { App.toast('Primero elegí el archivo de la copia'); return; }
    if (!confirm('¿Restaurar los datos desde "' + f.name + '"? Los datos actuales se REEMPLAZAN por los del archivo.')) return;
    if (!confirm('Última confirmación: esta acción no se puede deshacer. ¿Continuar?')) return;
    try {
      var res = await fetch('/api/respaldo/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', Authorization: 'Bearer ' + localStorage.getItem('token') },
        body: f,
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'No se pudo restaurar');
      App.toast('Restauración completa: ' + data.total + ' registros');
      fileInput.value = '';
      cargar();
    } catch (err) { App.toast(err.message); }
  });

  if (window.__PREVIEW__) {
    pintarStats({
      total: 128,
      colecciones: { users: 12, posts: 8, quotes: 23, outbox: 85 },
      historial: [{ id: 'd1', action: 'export', total: 128, detail: '4 colecciones', createdAt: new Date().toISOString() }],
    });
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargar();
  }

  // Oculta el link admin de la navbar para quien no es admin
  var navR = document.getElementById('nav-respaldo-admin');
  if (navR && (!me || me.role !== 'admin') && !window.__PREVIEW__) navR.style.display = 'none';
})();`,
  readmeNotes: (cfg) => [
    `**Copia de seguridad**: en \`/respaldo-admin.html\` (solo administradores) descargás un JSON con **todas** las colecciones del sitio (${cfg.collections.filter(c => c !== 'backuplog').join(', ')}) y podés restaurarlo después preservando ids y fechas. Restaurar **reemplaza** los datos actuales: hacé una copia fresca antes. La copia incluye la colección \`users\` (con las contraseñas hasheadas): tratá el archivo como confidencial. Cada operación queda en el historial (colección \`backuplog\`).`,
  ],
};
