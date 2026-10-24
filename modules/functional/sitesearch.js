// Buscador global del sitio con backend real: la página pública /buscar.html busca EN EL SERVIDOR
// sobre el contenido dinámico de los módulos activos (novedades, ayuda, carta, avisos, proyectos,
// descargables, cursos, profesionales, vacantes…), ignorando mayúsculas y ACENTOS ("catalogo"
// encuentra "Catálogo": cierra el pendiente histórico de búsqueda sin acentos). Cada búsqueda se
// registra en la colección searchqueries con su cantidad de resultados: con auth activo,
// /busquedas-admin.html muestra qué busca la gente y qué buscó SIN encontrar (oro puro para saber
// qué contenido falta), con CSV. Las fuentes se resuelven al generar el proyecto según los módulos
// seleccionados: si mañana activás otro módulo de contenido, regenerás y el buscador lo indexa.
// Animado con Anime.js (resultados con stagger, contadores con count-up) + red de seguridad.
// Distinto del módulo UI "Buscador" (search): aquel filtra en vivo el texto de la página actual;
// este consulta el backend y encuentra contenido que no está en la página (artículos, platos, avisos…).

// Fuentes de búsqueda disponibles: cada una existe solo si su módulo está seleccionado.
// campos = dónde buscar; titulo/extra = qué mostrar; flag = campo de publicado/disponible.
const FUENTES_POSIBLES = [
  { mod: 'blogcms', col: 'posts', label: 'Novedades', campos: ['title', 'category', 'excerpt'], titulo: 'title', extra: 'category', href: '/blog.html?post=', anchor: true, flag: 'published' },
  { mod: 'kb', col: 'kbarticles', label: 'Centro de ayuda', campos: ['title', 'category', 'body'], titulo: 'title', extra: 'category', href: '/ayuda.html', anchor: false, flag: 'published' },
  { mod: 'menu', col: 'menuitems', label: 'Nuestra carta', campos: ['name', 'category', 'description'], titulo: 'name', extra: 'category', href: '/carta.html', anchor: false, flag: 'available' },
  { mod: 'listings', col: 'listings', label: 'Avisos', campos: ['title', 'category', 'location', 'description'], titulo: 'title', extra: 'location', href: '/avisos.html?aviso=', anchor: true, flag: 'published' },
  { mod: 'projects', col: 'projects', label: 'Proyectos', campos: ['title', 'category', 'client', 'excerpt'], titulo: 'title', extra: 'category', href: '/proyectos.html?proyecto=', anchor: true, flag: 'published' },
  { mod: 'downloads', col: 'downloads', label: 'Descargables', campos: ['title', 'category', 'desc'], titulo: 'title', extra: 'category', href: '/descargables.html', anchor: false, flag: 'published' },
  { mod: 'cursos', col: 'courses', label: 'Cursos', campos: ['title', 'description'], titulo: 'title', extra: 'description', href: '/cursos.html?curso=', anchor: true, flag: 'published' },
  { mod: 'profesionales', col: 'pros', label: 'Profesionales', campos: ['name', 'specialty', 'bio'], titulo: 'name', extra: 'specialty', href: '/profesionales.html', anchor: false, flag: 'published' },
  { mod: 'vacantes', col: 'jobopenings', label: 'Vacantes', campos: ['title', 'area', 'location', 'description'], titulo: 'title', extra: 'area', href: '/vacantes.html?v=', anchor: true, flag: 'open' },
  { mod: 'listaprecios', col: 'pricelist', label: 'Lista de precios', campos: ['name', 'category', 'unit'], titulo: 'name', extra: 'category', href: '/precios.html', anchor: false, flag: 'published' },
  { mod: 'videos', col: 'videos', label: 'Videos', campos: ['title', 'category'], titulo: 'title', extra: 'category', href: '/videos.html', anchor: false, flag: 'published' },
  { mod: 'alquileres', col: 'rentitems', label: 'Alquileres', campos: ['name', 'detail'], titulo: 'name', extra: 'detail', href: '/alquileres.html', anchor: false, flag: 'published' },
];

module.exports = {
  id: 'sitesearch', type: 'functional', name: 'Buscador global del sitio',
  description: 'Página /buscar.html que busca en el servidor sobre el contenido dinámico de los módulos activos (novedades, ayuda, carta, avisos, proyectos, cursos…), sin distinguir acentos ni mayúsculas. Registra cada búsqueda (colección searchqueries): con auth activo, /busquedas-admin.html muestra los términos más buscados y los que no encontraron nada, con CSV. Resultados animados con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/search', file: 'routes/sitesearch.js' }],
  collections: ['searchqueries'],
  nav: (cfg) => {
    const links = [{ label: 'Buscar', href: '/buscar.html' }];
    if (cfg.moduleIds.includes('auth')) links.push({ label: 'Búsquedas', href: '/busquedas-admin.html', id: 'nav-search-admin' });
    return links;
  },
  head: () => `  <style>
    .ss-box{display:flex;gap:10px;align-items:center}
    .ss-box input{font-size:1.05rem;padding:13px 16px}
    .ss-grupo{margin-top:26px}
    .ss-grupo h3{margin:0 0 10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-size:.8rem}
    .ss-item{display:block;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:13px 16px;margin-bottom:8px;text-decoration:none;color:var(--text)}
    .ss-item:hover{border-color:var(--accent)}
    .ss-item strong{display:block}
    .ss-item .ss-extra{font-size:.82rem;color:var(--muted)}
    .ss-count{color:var(--muted);margin:14px 0 0;font-size:.9rem}
    .ss-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px}
    .ss-kpis .card{text-align:center}
    .ss-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
  </style>`,
  files: (cfg) => {
    // Solo las fuentes cuyos módulos están seleccionados en este proyecto
    const fuentes = FUENTES_POSIBLES.filter(f => cfg.moduleIds.includes(f.mod))
      .map(({ mod, ...resto }) => resto);
    return {
      'routes/sitesearch.js': `const router = require('express').Router();
const db = require('../src/db');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Pliega acentos y mayúsculas: "Catálogo" → "catalogo" (búsqueda tolerante)
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');

// Fuentes de búsqueda de ESTE proyecto (resueltas por el Builder según los módulos activos)
const FUENTES = ${JSON.stringify(fuentes, null, 2)};

// GET /api/search?q=... — busca en todas las fuentes y registra la búsqueda (público)
router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.status(422).json({ error: 'Escribí al menos 2 letras para buscar' });
  const fq = fold(q);
  const grupos = [];
  let total = 0;
  for (const f of FUENTES) {
    // Solo contenido publicado/disponible; hasta 8 resultados por fuente
    const rows = (await db.all(f.col)).filter(r => r[f.flag] !== false);
    const hits = rows.filter(r => f.campos.some(c => fold(r[c]).includes(fq))).slice(0, 8);
    if (!hits.length) continue;
    total += hits.length;
    grupos.push({
      label: f.label,
      items: hits.map(r => ({
        title: String(r[f.titulo] || ''),
        extra: String(r[f.extra] || '').slice(0, 90),
        href: f.anchor ? f.href + r.id : f.href,
      })),
    });
  }
  // Registro de la búsqueda: alimenta el panel de términos buscados / sin resultados
  await db.insert('searchqueries', { q: q.slice(0, 80), total });
  res.json({ q, total, grupos });
});
${cfg.moduleIds.includes('auth') ? `
// Agrupa las búsquedas registradas por término plegado y devuelve las más repetidas
function ranking(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = fold(r.q);
    const it = map.get(k) || { q: r.q, veces: 0 };
    it.veces += 1;
    map.set(k, it);
  }
  return [...map.values()].sort((a, b) => b.veces - a.veces).slice(0, 10);
}

// GET /api/search/admin/stats — resumen: total, top de términos y top sin resultados (solo admin)
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const rows = await db.all('searchqueries');
  res.json({
    total: rows.length,
    sinResultados: ranking(rows.filter(r => !r.total)),
    top: ranking(rows),
  });
});

// GET /api/search/admin/list — últimas búsquedas, más recientes primero (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  const rows = await db.all('searchqueries');
  res.json(rows.slice(-200).reverse());
});

// DELETE /api/search/admin/clear — vacía el historial de búsquedas (solo admin)
router.delete('/admin/clear', requireAdmin, async (req, res) => {
  for (const r of await db.all('searchqueries')) await db.remove('searchqueries', r.id);
  res.json({ ok: true });
});
` : `// El panel de términos buscados requiere el módulo de autenticación: activalo en el Builder
// para habilitar /busquedas-admin.html. Las búsquedas igual se registran en data/searchqueries.json.
`}
module.exports = router;
`,
    };
  },
  pages: (cfg) => {
    const pgs = {
      buscar: {
        title: 'Buscar',
        html: `  <section>
    <div class="container" style="max-width:720px">
      <h2>Buscá en todo el sitio</h2>
      <p class="section-sub">Escribí lo que necesitás y te mostramos todo lo que tenemos sobre eso.</p>
      <div class="ss-box card">
        <input id="ss-input" type="search" placeholder="Ej: precios, envíos, turnos…" autocomplete="off" autofocus>
      </div>
      <p class="ss-count" id="ss-count" hidden></p>
      <div id="ss-results"></div>
      <noscript><p class="muted">Activá JavaScript para usar el buscador.</p></noscript>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      pgs['busquedas-admin'] = {
        title: 'Búsquedas del sitio',
        html: `  <section>
    <div class="container" style="max-width:860px">
      <h2>Qué busca la gente</h2>
      <p class="section-sub">Los términos que más se buscan y, sobre todo, los que no encontraron nada: ahí está el contenido que falta. Solo visible para administradores.</p>
      <div class="ss-kpis" id="ss-kpis"></div>
      <div class="grid cols-2" style="align-items:start">
        <div class="card"><h3 style="margin:0 0 10px">Más buscados</h3><div id="ss-top"><p class="muted">Cargando…</p></div></div>
        <div class="card"><h3 style="margin:0 0 10px">Buscados sin resultados</h3><div id="ss-zero"><p class="muted">Cargando…</p></div></div>
      </div>
      <h3 style="margin:26px 0 10px">Últimas búsquedas</h3>
      <div id="ss-list"><p class="muted">Cargando…</p></div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn ghost" type="button" id="ss-csv">Descargar CSV</button>
        <button class="btn ghost" type="button" id="ss-clear" style="color:#c0392b;border-color:#c0392b">Vaciar historial</button>
      </div>
    </div>
  </section>`,
      };
    }
    return pgs;
  },
  clientJs: (cfg) => `/* Módulo buscador global: /buscar.html consulta el backend con debounce (sin acentos) y,
   con auth activo, /busquedas-admin.html muestra el ranking de términos. Animado con Anime.js
   (stagger de resultados, count-up de KPIs) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = Number(hasta).toLocaleString('es-AR'); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR'); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = Number(hasta).toLocaleString('es-AR'); }, 800);
  }

  // ---- Página pública /buscar.html ----
  var input = document.getElementById('ss-input');
  if (input) {
    var results = document.getElementById('ss-results');
    var count = document.getElementById('ss-count');
    var timer = null;
    var ultima = '';

    function pintar(data) {
      count.hidden = false;
      count.textContent = data.total
        ? (data.total === 1 ? '1 resultado para "' : data.total + ' resultados para "') + data.q + '"'
        : 'No encontramos nada con "' + data.q + '". Probá con otra palabra.';
      results.innerHTML = data.grupos.map(function (g) {
        return '<div class="ss-grupo"><h3>' + App.esc(g.label) + '</h3>' + g.items.map(function (it) {
          return '<a class="ss-item" href="' + App.esc(it.href) + '"><strong>' + App.esc(it.title) + '</strong>' +
            (it.extra ? '<span class="ss-extra">' + App.esc(it.extra) + '</span>' : '') + '</a>';
        }).join('') + '</div>';
      }).join('');
      var anime = window.anime;
      var items = results.querySelectorAll('.ss-item');
      if (anime && anime.animate && !reduce && items.length) {
        anime.animate(items, { opacity: [0, 1], translateY: [10, 0], duration: 380, delay: anime.stagger(45), ease: 'outCubic' });
        // Red de seguridad: deja todo visible aunque el loop esté pausado
        setTimeout(function () { items.forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; }); }, 1200);
      }
    }

    function buscar() {
      var q = input.value.trim();
      if (q.length < 2 || q === ultima) return;
      ultima = q;
      if (window.__PREVIEW__) {
        pintar({ q: q, total: 2, grupos: [{ label: 'Novedades', items: [{ title: 'Bienvenidos a nuestro nuevo sitio', extra: 'Novedades', href: '#' }, { title: '3 consejos para tu compra', extra: 'Consejos', href: '#' }] }] });
        return;
      }
      fetch('/api/search?q=' + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (data) { if (data && data.grupos) pintar(data); })
        .catch(function () {});
    }

    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(buscar, 350);
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); buscar(); } });

    // Soporte de enlace directo /buscar.html?q=...
    var qUrl = new URLSearchParams(location.search).get('q');
    if (qUrl) { input.value = qUrl; buscar(); }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /busquedas-admin.html ----
  var kpis = document.getElementById('ss-kpis');
  if (kpis) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var topBox = document.getElementById('ss-top');
    var zeroBox = document.getElementById('ss-zero');
    var listBox = document.getElementById('ss-list');
    var lista = [];

    function rankingHtml(items) {
      if (!items.length) return '<p class="muted" style="margin:0">Sin datos todavía.</p>';
      return items.map(function (t) {
        return '<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid var(--line)"><span>' + App.esc(t.q) + '</span><strong>' + t.veces + '</strong></div>';
      }).join('');
    }

    function pintarStats(s) {
      kpis.innerHTML = '<div class="card"><strong id="ss-k-total">0</strong><span class="muted">búsquedas totales</span></div>' +
        '<div class="card"><strong id="ss-k-zero">0</strong><span class="muted">términos sin resultados</span></div>';
      contar(document.getElementById('ss-k-total'), s.total);
      contar(document.getElementById('ss-k-zero'), s.sinResultados.length);
      topBox.innerHTML = rankingHtml(s.top);
      zeroBox.innerHTML = rankingHtml(s.sinResultados);
    }

    function pintarLista() {
      listBox.innerHTML = App.table(lista.slice(0, 50), [
        { label: 'Término', render: function (r) { return App.esc(r.q); } },
        { label: 'Resultados', render: function (r) { return r.total ? String(r.total) : '<span style="color:#c0392b;font-weight:700">0</span>'; } },
        { label: 'Cuándo', render: function (r) { return new Date(r.createdAt).toLocaleString('es-AR'); } },
      ]);
    }

    var csvBtn = document.getElementById('ss-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var filas = [['termino', 'resultados', 'fecha']].concat(lista.map(function (r) { return [r.q, r.total, r.createdAt]; }));
      var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'busquedas.csv';
      a.click();
    });

    var clearBtn = document.getElementById('ss-clear');
    if (clearBtn) clearBtn.addEventListener('click', async function () {
      if (window.__PREVIEW__) { App.toast('Vista previa: se vaciaría el historial'); return; }
      if (!confirm('¿Vaciar todo el historial de búsquedas?')) return;
      try {
        await App.api('/api/search/admin/clear', { method: 'DELETE' });
        lista = [];
        pintarStats({ total: 0, top: [], sinResultados: [] });
        pintarLista();
        App.toast('Historial vaciado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (window.__PREVIEW__) {
      pintarStats({ total: 42, top: [{ q: 'precios', veces: 9 }, { q: 'envíos', veces: 6 }], sinResultados: [{ q: 'cuotas', veces: 4 }] });
      lista = [{ q: 'precios', total: 3, createdAt: new Date().toISOString() }];
      pintarLista();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/search/admin/stats').then(pintarStats).catch(function (err) { kpis.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
      App.api('/api/search/admin/list').then(function (rows) { lista = rows; pintarLista(); }).catch(function () {});
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navS = document.getElementById('nav-search-admin');
    if (navS && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navS.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => {
    const activas = FUENTES_POSIBLES.filter(f => cfg.moduleIds.includes(f.mod)).map(f => f.label);
    return [
      `**Buscador global**: \`/buscar.html\` busca en el servidor sin distinguir acentos ni mayúsculas sobre el contenido dinámico de estos módulos: ${activas.length ? activas.join(', ') : '(ninguno activo todavía: activá módulos de contenido como Blog administrable, Centro de ayuda o Carta y regenerá el proyecto)'}. Cada búsqueda queda registrada en la colección \`searchqueries\`. ${cfg.moduleIds.includes('auth') ? 'Los administradores ven los términos más buscados y los que no encontraron nada en \`/busquedas-admin.html\`.' : 'Para ver el ranking de términos buscados activá el módulo **Autenticación** (habilita \`/busquedas-admin.html\`).'}`,
    ];
  },
};
