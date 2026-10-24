// "¿Te resultó útil esta página?": widget de valoración que se inyecta antes del footer
// en todas las páginas, con los votos persistidos en el servidor (colección feedback).
// Tras votar muestra el porcentaje real de visitantes que la encontraron útil, con
// count-up de Anime.js (red de seguridad setTimeout + respeta "prefers-reduced-motion").
// Un voto por página por navegador (localStorage). Patrón clásico de centros de ayuda
// y documentación: sirve para detectar qué páginas no están funcionando. No aporta HTML
// propio: el widget lo crea el JS, así que sin JavaScript no aparece (mejora progresiva).
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'feedback', type: 'functional', name: '¿Te resultó útil?',
  description: 'Widget "¿Te resultó útil esta página?" al pie de cada página, con votos guardados en el servidor y porcentaje real de utilidad animado (Anime.js).',
  usesAnime: true,
  mounts: [{ route: '/api/feedback', file: 'routes/feedback.js' }],
  collections: ['feedback'],
  head: () => `  <style>
    .fb-caja{border-top:1px solid var(--line);padding:22px 0}
    .fb-inner{display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap}
    .fb-q{font-weight:600}
    .fb-btn{width:auto;padding:8px 16px}
    .fb-pct{color:var(--accent);font-weight:800;font-variant-numeric:tabular-nums}
  </style>`,
  files: () => ({
    'routes/feedback.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str } = require('../src/validate');

const validar = (data) => check(data, {
  page: (v) => str(v, 1, 160) && String(v).startsWith('/'),
  util: (v) => typeof v === 'boolean',
});

// Resumen de utilidad de una página: cuántos sí, cuántos no y el porcentaje
async function resumen(page) {
  const rows = await db.find('feedback', f => f.page === page);
  const si = rows.filter(f => f.util).length;
  const total = rows.length;
  return { page, si, no: total - si, total, porcentaje: total ? Math.round(si * 100 / total) : 0 };
}

// POST /api/feedback — registra una opinión { page, util } y devuelve el resumen actualizado
router.post('/', async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  await db.insert('feedback', { page: req.body.page, util: req.body.util });
  res.status(201).json(await resumen(req.body.page));
});

// GET /api/feedback/summary?page=/x.html — resumen de utilidad de una página
router.get('/summary', async (req, res) => {
  const page = String(req.query.page || '');
  if (!page.startsWith('/') || page.length > 160) return res.status(422).json({ error: 'Página inválida' });
  res.json(await resumen(page));
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo "¿te resultó útil?": inyecta el widget de valoración antes del footer, envía
   el voto al servidor y muestra el porcentaje real de utilidad con count-up (Anime.js
   + red de seguridad). Un voto por página por navegador. En la vista previa simula. */
(function () {
  var footer = document.querySelector('footer');
  if (!footer || !footer.parentNode) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Página normalizada: "/" y "/index.html" cuentan como la misma
  var pagina = location.pathname === '/' ? '/index.html' : location.pathname;
  if (window.__PREVIEW__) pagina = '/index.html';

  var caja = document.createElement('div');
  caja.className = 'fb-caja';
  footer.parentNode.insertBefore(caja, footer);

  function yaVoto() { try { return localStorage.getItem('fb-votado-' + pagina); } catch (e) { return null; } }
  function recordar() { try { localStorage.setItem('fb-votado-' + pagina, '1'); } catch (e) {} }

  function pintarBotones() {
    caja.innerHTML = '<div class="container"><div class="fb-inner">' +
      '<span class="fb-q">¿Te resultó útil esta página?</span>' +
      '<button type="button" class="btn ghost fb-btn" data-fb="si">${phIcon('thumbs-up', { size: 16 })} Sí</button>' +
      '<button type="button" class="btn ghost fb-btn" data-fb="no">${phIcon('thumbs-down', { size: 16 })} No</button>' +
      '</div></div>';
    caja.querySelectorAll('[data-fb]').forEach(function (b) {
      b.addEventListener('click', function () { votar(b.getAttribute('data-fb') === 'si'); });
    });
  }

  function pintarResumen(r, agradecer) {
    var texto = r.total
      ? 'El <strong class="fb-pct" data-pct="' + r.porcentaje + '">0%</strong> de los visitantes encontró útil esta página <span class="muted">(' + r.total + ' ' + (r.total === 1 ? 'opinión' : 'opiniones') + ')</span>.'
      : 'Todavía no hay opiniones sobre esta página.';
    caja.innerHTML = '<div class="container"><div class="fb-inner">' +
      (agradecer ? '<span class="fb-q">¡Gracias por tu opinión!</span> ' : '') +
      '<span>' + texto + '</span></div></div>';
    var pctEl = caja.querySelector('.fb-pct');
    if (!pctEl) return;
    var hasta = Number(pctEl.getAttribute('data-pct')) || 0;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { pctEl.textContent = hasta + '%'; return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 800, ease: 'outCubic', onUpdate: function () { pctEl.textContent = Math.round(st.v) + '%'; } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { pctEl.textContent = hasta + '%'; }, 1000);
  }

  async function votar(util) {
    if (window.__PREVIEW__) {
      // Voto simulado en la vista previa del Builder (la API vive en el proyecto exportado)
      recordar();
      pintarResumen({ porcentaje: util ? 93 : 86, total: 14 }, true);
      return;
    }
    try {
      var r = await App.api('/api/feedback', { method: 'POST', body: { page: pagina, util: util } });
      recordar();
      pintarResumen(r, true);
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  (async function () {
    if (!yaVoto()) { pintarBotones(); return; }
    // Ya votó en esta página: muestra el resumen actual sin botones
    if (window.__PREVIEW__) { pintarResumen({ porcentaje: 93, total: 14 }, false); return; }
    try { pintarResumen(await App.api('/api/feedback/summary?page=' + encodeURIComponent(pagina)), false); }
    catch (err) { pintarBotones(); }
  })();
})();`,
  readmeNotes: () => [
    '**¿Te resultó útil?**: el widget aparece al pie de todas las páginas y guarda los votos en la colección `feedback` (con la página votada). El control "un voto por página" es por navegador (`localStorage`). Para ver los resultados, consultá `GET /api/feedback/summary?page=/index.html` o mirá `data/feedback.json`.',
  ],
};
