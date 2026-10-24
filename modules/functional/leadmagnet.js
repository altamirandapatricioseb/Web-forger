// Descargable con registro (lead magnet): sección en la Home que ofrece material descargable
// (guías, catálogos, plantillas) a cambio del email. El visitante deja su email para desbloquear
// el enlace de descarga; el backend registra la captura (colección downloadleads, idempotente por
// recurso+email) y devuelve la URL del archivo más cuánta gente ya lo descargó (prueba social,
// count-up con Anime.js + red de seguridad). Con auth activo, suma una página /descargas.html
// solo-admin con los emails captados por recurso y CSV. Sin auth las capturas se guardan igual y
// se leen en data/downloadleads.json. Distinto del módulo UI "Recursos descargables" (lista de
// enlaces abiertos, sin captura) y de "leads" (captación genérica): acá el email desbloquea un
// archivo concreto y se mide la demanda de cada material.
const RECURSOS = [
  { id: 'guia', title: 'Guía práctica (PDF)', desc: 'Los pasos clave para empezar, en un documento descargable.', format: 'PDF', url: '/descargables/guia.pdf' },
  { id: 'catalogo', title: 'Catálogo completo', desc: 'Todos nuestros productos y precios en un solo archivo.', format: 'PDF', url: '/descargables/catalogo.pdf' },
  { id: 'plantilla', title: 'Plantilla editable', desc: 'La plantilla que usamos internamente, lista para adaptar.', format: 'XLSX', url: '/descargables/plantilla.xlsx' },
];

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'leadmagnet', type: 'functional', name: 'Descargable con registro',
  description: 'Ofrece material descargable (guías, catálogos, plantillas) a cambio del email: el visitante deja su email, desbloquea el enlace y ve cuánta gente lo descargó (Anime.js). Con auth activo, panel admin en /descargas.html con los emails captados por recurso y CSV. Mide la demanda de cada material.',
  usesAnime: true,
  mounts: [{ route: '/api/leadmagnet', file: 'routes/leadmagnet.js' }],
  collections: ['downloadleads'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Descargas', href: '/descargas.html', id: 'nav-leadmagnet' }] : [],
  html: () => `  <section id="descargables">
    <div class="container">
      <h2>Descargá nuestro material</h2>
      <p class="section-sub">Dejanos tu email y te habilitamos la descarga al instante. Sin vueltas.</p>
      <div class="grid cols-3" id="lm-lista"><p class="muted">Cargando material…</p></div>
      <noscript><p class="muted">Activá JavaScript para descargar el material.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    .lm-card{display:flex;flex-direction:column;gap:8px}
    .lm-format{display:inline-block;background:var(--accent);color:#fff;font-size:.72rem;font-weight:700;letter-spacing:.04em;padding:3px 8px;border-radius:999px;align-self:flex-start}
    .lm-count{font-size:.85rem;color:var(--muted)}
    .lm-count strong{color:var(--accent);font-variant-numeric:tabular-nums}
    .lm-form{display:grid;gap:8px;margin-top:auto}
    .lm-form input{width:100%}
    .lm-ok{background:var(--surface);border-left:3px solid var(--accent);padding:12px 14px;border-radius:0 var(--radius) var(--radius) 0;font-size:.9rem}
    .lm-ok a{font-weight:700}
  </style>`,
  files: (cfg) => ({
    'routes/leadmagnet.js': `const router = require('express').Router();
const db = require('../src/db');
const { isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Material descargable: editá título, descripción, formato y la URL real del archivo.
// Subí los archivos a public/descargables/ (o poné una URL externa) y actualizá "url".
const RECURSOS = ${JSON.stringify(RECURSOS, null, 2)};
const recurso = (id) => RECURSOS.find(r => r.id === id) || null;

// Cantidad de descargas (capturas) de un recurso
async function descargas(id) {
  return (await db.find('downloadleads', r => r.resource === id)).length;
}

// GET /api/leadmagnet — material con su cantidad de descargas (público, sin URL hasta desbloquear)
router.get('/', async (req, res) => {
  const filas = await Promise.all(RECURSOS.map(async r => ({ id: r.id, title: r.title, desc: r.desc, format: r.format, downloads: await descargas(r.id) })));
  res.json(filas);
});

// POST /api/leadmagnet — desbloquea la descarga { resource, email } (idempotente por recurso+email)
router.post('/', async (req, res) => {
  const r = recurso(req.body && req.body.resource);
  if (!r) return res.status(404).json({ error: 'El material no existe' });
  if (!isEmail(req.body.email)) return res.status(422).json({ error: 'Email inválido', errors: { email: 'Ingresá un email válido' } });
  const email = req.body.email.toLowerCase().trim();
  const previa = (await db.find('downloadleads', x => x.resource === r.id && x.email === email))[0];
  if (!previa) await db.insert('downloadleads', { resource: r.id, resourceTitle: r.title, email });
  res.status(previa ? 200 : 201).json({ ok: true, url: r.url, title: r.title, downloads: await descargas(r.id), already: Boolean(previa) });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/leadmagnet/all — emails captados por recurso (solo admin; filtro ?resource=)
router.get('/all', requireAdmin, async (req, res) => {
  let rows = await db.all('downloadleads');
  if (req.query.resource) rows = rows.filter(r => r.resource === req.query.resource);
  res.json(rows.reverse());
});
` : `// El listado de emails captados por recurso requiere el módulo de autenticación: activalo en
// el Builder para habilitar /descargas.html. Sin él, mirá data/downloadleads.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    descargas: {
      title: 'Descargas registradas',
      html: `  <section>
    <div class="container">
      <h2>Emails captados por descarga</h2>
      <p class="section-sub">Quiénes descargaron cada material dejando su email. Exportá el CSV para sumarlos a tu lista o hacer seguimiento. Solo visible para administradores.</p>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
        <select id="lm-filtro" style="width:auto;min-width:200px"><option value="">Todos los materiales</option></select>
        <button class="btn ghost" type="button" id="lm-csv">Descargar CSV</button>
      </div>
      <div id="lm-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo descargable con registro: lista el material con su cantidad de descargas, pide el
   email para desbloquear el enlace y anima el contador (Anime.js + red de seguridad). Recuerda
   por navegador (localStorage) qué recursos ya desbloqueaste. En la vista previa del Builder
   simula la API. Con auth, arma el panel admin en /descargas.html. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RECURSOS_DEMO = ${JSON.stringify(RECURSOS)};

  function desbloqueado(id) { try { return localStorage.getItem('lm-ok-' + id); } catch (e) { return null; } }
  function recordar(id, url) { try { localStorage.setItem('lm-ok-' + id, url || '1'); } catch (e) {} }

  // ---- Sección pública (Home) ----
  var lista = document.getElementById('lm-lista');
  if (lista) {
    function demoEstado() {
      var d = { guia: 214, catalogo: 133, plantilla: 87 };
      return RECURSOS_DEMO.map(function (r) { return { id: r.id, title: r.title, desc: r.desc, format: r.format, downloads: d[r.id] || 0 }; });
    }

    function urlDemo(id) { var r = RECURSOS_DEMO.filter(function (x) { return x.id === id; })[0]; return r ? r.url : '#'; }

    function contar(el, hasta) {
      if (!el) return;
      el.setAttribute('data-n', hasta);
      var anime = window.anime;
      if (!anime || !anime.animate || reduce) { el.textContent = hasta; return; }
      var st = { v: 0 };
      anime.animate(st, { v: hasta, duration: 700, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v); } });
      // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
      setTimeout(function () { el.textContent = hasta; }, 900);
    }

    function pintarLista(recursos) {
      lista.innerHTML = '';
      recursos.forEach(function (r) {
        var card = document.createElement('div');
        card.className = 'card lm-card';
        card.innerHTML =
          '<span class="lm-format">' + App.esc(r.format || 'Archivo') + '</span>' +
          '<h3 style="margin:0">' + App.esc(r.title) + '</h3>' +
          '<p class="muted" style="margin:0">' + App.esc(r.desc || '') + '</p>' +
          '<p class="lm-count"><strong class="lm-num" data-n="' + r.downloads + '">' + r.downloads + '</strong> ' +
          (r.downloads === 1 ? 'descarga' : 'descargas') + '</p>' +
          '<div class="lm-slot"></div>';
        lista.appendChild(card);
        var slot = card.querySelector('.lm-slot');
        var ya = desbloqueado(r.id);
        if (ya) { slot.innerHTML = enlaceOk(ya === '1' ? urlDemo(r.id) : ya); }
        else {
          slot.innerHTML =
            '<form class="lm-form" data-r="' + r.id + '">' +
            '<input name="email" type="email" placeholder="Tu email" required>' +
            '<button class="btn" type="submit">Descargar</button></form>';
        }
        contar(card.querySelector('.lm-num'), r.downloads);
      });
      enlazarForms();
    }

    function enlaceOk(url) {
      return '<div class="lm-ok">${phIcon('check', { size: 15 })} ¡Listo! <a href="' + App.esc(url) + '" target="_blank" rel="noopener">Descargar ahora</a></div>';
    }

    function enlazarForms() {
      lista.querySelectorAll('.lm-form').forEach(function (form) {
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          var id = form.getAttribute('data-r');
          var card = form.closest('.card');
          var email = (new FormData(form)).get('email');
          if (window.__PREVIEW__) {
            var u = urlDemo(id);
            recordar(id, u);
            if (card) { form.parentNode.innerHTML = enlaceOk(u); }
            return;
          }
          try {
            var r = await App.api('/api/leadmagnet', { method: 'POST', body: { resource: id, email: email } });
            recordar(id, r.url);
            var slot = form.parentNode;
            if (slot) slot.innerHTML = enlaceOk(r.url);
            if (card) contar(card.querySelector('.lm-num'), r.downloads);
            App.toast(r.already ? 'Ya lo habías desbloqueado' : '¡Descarga habilitada!');
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    (async function () {
      if (window.__PREVIEW__) { pintarLista(demoEstado()); return; }
      try { pintarLista(await App.api('/api/leadmagnet')); }
      catch (err) { lista.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; }
    })();
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel admin (/descargas.html) ----
  var adminBox = document.getElementById('lm-admin');
  if (adminBox) {
    var filtro = document.getElementById('lm-filtro');
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var ETIQUETAS = { createdAt: 'Fecha', resourceTitle: 'Material', email: 'Email' };

    function filtrados() {
      var v = filtro && filtro.value;
      return v ? todos.filter(function (r) { return r.resource === v; }) : todos;
    }

    function pintar() {
      adminBox.innerHTML = App.table(filtrados(), [
        { label: ETIQUETAS.createdAt, render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } },
        { label: ETIQUETAS.resourceTitle, render: function (r) { return '<span class="badge" style="vertical-align:baseline">' + App.esc(r.resourceTitle || r.resource || '—') + '</span>'; } },
        { key: 'email', label: ETIQUETAS.email },
      ]);
    }

    function pintarFiltro() {
      if (!filtro) return;
      var vistos = {};
      todos.forEach(function (r) { if (r.resource) vistos[r.resource] = r.resourceTitle || r.resource; });
      Object.keys(vistos).forEach(function (id) {
        var op = document.createElement('option');
        op.value = id; op.textContent = vistos[id];
        filtro.appendChild(op);
      });
      filtro.addEventListener('change', pintar);
    }

    var csvBtn = document.getElementById('lm-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var claves = ['createdAt', 'resourceTitle', 'email'];
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [claves.map(function (k) { return celda(ETIQUETAS[k] || k); }).join(';')];
      filtrados().forEach(function (r) { lineas.push(claves.map(function (k) { return celda(r[k]); }).join(';')); });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'descargas-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    function listo(rows) { todos = rows; pintarFiltro(); pintar(); }

    if (window.__PREVIEW__) {
      listo([
        { resource: 'guia', resourceTitle: 'Guía práctica (PDF)', email: 'sofia@mail.com', createdAt: new Date().toISOString() },
        { resource: 'catalogo', resourceTitle: 'Catálogo completo', email: 'diego@mail.com', createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/leadmagnet/all').then(listo)
        .catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navLm = document.getElementById('nav-leadmagnet');
    if (navLm && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navLm.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Descargable con registro**: editá el material y su URL en la constante \`RECURSOS\` de \`routes/leadmagnet.js\` y subí los archivos a \`public/descargables/\` (o usá URLs externas). Las capturas se guardan en la colección \`downloadleads\` (idempotente por recurso+email). ${cfg.moduleIds.includes('auth') ? 'Los administradores ven los emails captados por material y descargan el CSV en \`/descargas.html\`.' : 'Para ver los emails captados activá el módulo **Autenticación** (habilita \`/descargas.html\`); sin él, mirá \`data/downloadleads.json\`.'} El enlace de descarga se muestra recién después de dejar el email.`,
  ],
};
