// Programa de referidos ("Recomendá y ganá"): sección en la Home donde el visitante deja
// su email y recibe un código y un link para compartir (tusitio.com/?ref=CODIGO). Cuando
// alguien llega por ese link y se anota, se le acredita el referido a quien lo invitó. El
// backend guarda los miembros (colección referrals) y los referidos acreditados (colección
// referralhits); el conteo es real y suma entre visitas. El link entrante se detecta leyendo
// ?ref= de la URL en cualquier página y se guarda en localStorage hasta que la persona se
// anota. El contador de referidos cuenta con Anime.js (red de seguridad setTimeout + respeta
// "prefers-reduced-motion"). Con auth activo, suma un ranking solo-admin en /referidos.html
// con CSV. Sin auth el programa funciona igual y el ranking se lee en data/referrals.json.
// Distinto de "leads"/"newsletter" (captación simple): acá hay un mecanismo de invitación
// con crédito por cada persona traída.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'referrals', type: 'functional', name: 'Programa de referidos',
  description: 'Sección "Recomendá y ganá": el visitante obtiene un código y un link para compartir; cada persona que llega por ese link y se anota le suma un referido (conteo real, animado con Anime.js). Con auth activo, ranking admin en /referidos.html con CSV.',
  usesAnime: true,
  mounts: [{ route: '/api/referrals', file: 'routes/referrals.js' }],
  collections: ['referrals', 'referralhits'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Referidos', href: '/referidos.html', id: 'nav-referidos' }] : [],
  html: () => `  <section id="referidos">
    <div class="container">
      <h2>Recomendá y ganá</h2>
      <p class="section-sub">Compartí tu link con quien quieras. Cuando se anoten, vas sumando referidos.</p>
      <div class="card rf-card" id="rf-card"><p class="muted">Cargando…</p></div>
      <noscript><p class="muted">Activá JavaScript para participar del programa de referidos.</p></noscript>
    </div>
  </section>`,
  head: () => `  <style>
    .rf-card{max-width:560px}
    .rf-form{display:grid;gap:10px}
    .rf-panel{display:grid;gap:12px}
    .rf-linea{display:flex;gap:8px;flex-wrap:wrap}
    .rf-link{flex:1;min-width:180px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9rem}
    .rf-stat{display:flex;align-items:baseline;gap:8px}
    .rf-num{font-size:2.4rem;font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums;line-height:1}
    .rf-share{display:flex;gap:8px;flex-wrap:wrap}
    .rf-share .btn{width:auto}
    .rf-invitado{background:var(--surface);border-left:3px solid var(--accent);padding:8px 12px;border-radius:0 var(--radius) var(--radius) 0;font-size:.88rem;margin-bottom:6px}
  </style>`,
  files: (cfg) => ({
    'routes/referrals.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { check, str, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Genera un código corto legible para el link de referido (evita 0/O/1/I)
function nuevoCodigo() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) c += abc[bytes[i] % abc.length];
  return c;
}

// Cantidad de referidos acreditados a un código
async function conteo(code) {
  return (await db.find('referralhits', h => h.code === code)).length;
}

// POST /api/referrals/join — alta de un miembro por email (idempotente); devuelve su código
router.post('/join', async (req, res) => {
  const { ok } = check(req.body, { email: isEmail });
  if (!ok) return res.status(422).json({ error: 'Email inválido', errors: { email: 'Ingresá un email válido' } });
  const email = req.body.email.toLowerCase().trim();
  let m = (await db.find('referrals', r => r.email === email))[0];
  if (!m) {
    let code;
    // Reintenta si el código sale repetido (colisión prácticamente nula)
    do { code = nuevoCodigo(); } while ((await db.find('referrals', r => r.code === code)).length);
    m = await db.insert('referrals', { email, code });
  }
  res.status(201).json({ code: m.code, count: await conteo(m.code) });
});

// POST /api/referrals/refer — acredita un referido { code, email } a quien invitó
router.post('/refer', async (req, res) => {
  const { ok } = check(req.body, { code: (v) => str(v, 4, 12), email: isEmail });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos' });
  const code = String(req.body.code).toUpperCase().trim();
  const email = req.body.email.toLowerCase().trim();
  const dueño = (await db.find('referrals', r => r.code === code))[0];
  if (!dueño) return res.status(404).json({ error: 'Código de referido inexistente' });
  // No se puede referir a uno mismo
  if (dueño.email === email) return res.json({ ok: false, reason: 'self' });
  // Un crédito por email referido (idempotente global)
  if ((await db.find('referralhits', h => h.email === email)).length) return res.json({ ok: false, reason: 'dup' });
  await db.insert('referralhits', { code, email });
  res.status(201).json({ ok: true, count: await conteo(code) });
});

// GET /api/referrals/stats?code=XXXX — conteo público de un código
router.get('/stats', async (req, res) => {
  const code = String(req.query.code || '').toUpperCase().trim();
  if (code.length < 4 || code.length > 12) return res.status(422).json({ error: 'Código inválido' });
  if (!(await db.find('referrals', r => r.code === code)).length) return res.status(404).json({ error: 'Código inexistente' });
  res.json({ code, count: await conteo(code) });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/referrals — ranking de miembros por cantidad de referidos (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  const miembros = await db.all('referrals');
  const hits = await db.all('referralhits');
  const porCodigo = {};
  hits.forEach(h => { porCodigo[h.code] = (porCodigo[h.code] || 0) + 1; });
  const filas = miembros.map(m => ({ email: m.email, code: m.code, count: porCodigo[m.code] || 0, createdAt: m.createdAt }));
  filas.sort((a, b) => b.count - a.count);
  res.json(filas);
});
` : `// El ranking de referidos requiere el módulo de autenticación: activalo en el Builder
// para habilitar /referidos.html. Sin él, mirá data/referrals.json y data/referralhits.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    referidos: {
      title: 'Referidos',
      html: `  <section>
    <div class="container">
      <h2>Ranking de referidos</h2>
      <p class="section-sub">Quiénes recomendaron y cuántas personas trajeron. Solo visible para administradores.</p>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn ghost" type="button" id="rf-csv">Descargar CSV</button>
      </div>
      <div id="rf-admin"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo programa de referidos: detecta ?ref= en la URL (link entrante), deja anotarse
   con el email para obtener código + link para compartir, acredita al que invitó y muestra
   el conteo real con count-up (Anime.js + red de seguridad). En la vista previa simula la
   API. Con auth, arma el ranking admin en /referidos.html. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Detecta un link entrante (?ref=CODIGO) en cualquier página y lo guarda pendiente
  (function () {
    try {
      var ref = new URLSearchParams(location.search).get('ref');
      if (ref && /^[a-z0-9]{4,12}$/i.test(ref) && !localStorage.getItem('rf-mio')) {
        localStorage.setItem('rf-invitadoPor', ref.toUpperCase());
      }
    } catch (e) {}
  })();

  var card = document.getElementById('rf-card');
  if (card) {
    var reduceMe = reduce;

    function guardarMio(code) { try { localStorage.setItem('rf-mio', code); } catch (e) {} }
    function miCodigo() { try { return localStorage.getItem('rf-mio'); } catch (e) { return null; } }
    function invitadoPor() { try { return localStorage.getItem('rf-invitadoPor'); } catch (e) { return null; } }

    function linkDe(code) { return location.origin + '/?ref=' + code; }

    function pintarForm() {
      var invitado = invitadoPor();
      card.innerHTML =
        (invitado ? '<p class="rf-invitado">Te invitó un amigo ${phIcon('handshake', { size: 14 })} Al anotarte, le sumás un referido.</p>' : '') +
        '<form class="rf-form" id="rf-form">' +
        '<label>Tu email</label><input name="email" type="email" placeholder="vos@email.com" required>' +
        '<button class="btn" type="submit">Obtener mi link</button></form>';
      var form = document.getElementById('rf-form');
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var email = (new FormData(form)).get('email');
        if (window.__PREVIEW__) { guardarMio('DEMO12'); pintarPanel('DEMO12', 3); acreditarInvitacion(email); return; }
        try {
          var r = await App.api('/api/referrals/join', { method: 'POST', body: { email: email } });
          guardarMio(r.code);
          pintarPanel(r.code, r.count);
          acreditarInvitacion(email);
          App.toast('¡Tu link está listo para compartir!');
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    }

    // Si esta persona llegó por un link de referido, acredita al que la invitó
    async function acreditarInvitacion(email) {
      var code = invitadoPor();
      if (!code) return;
      try { localStorage.removeItem('rf-invitadoPor'); } catch (e) {}
      if (window.__PREVIEW__) return;
      try { await App.api('/api/referrals/refer', { method: 'POST', body: { code: code, email: email } }); } catch (e) {}
    }

    function pintarPanel(code, count) {
      var link = linkDe(code);
      card.innerHTML =
        '<div class="rf-panel">' +
        '<div class="rf-stat"><span class="rf-num" data-n="' + count + '">0</span><span class="muted">referido' + (count === 1 ? '' : 's') + ' hasta ahora</span></div>' +
        '<div><label>Tu link para compartir</label><div class="rf-linea">' +
        '<input class="rf-link" id="rf-link" readonly value="' + App.esc(link) + '">' +
        '<button class="btn ghost" type="button" id="rf-copiar" style="width:auto">Copiar</button></div>' +
        '<p class="muted" style="margin:6px 0 0;font-size:.85rem">Tu código: <strong>' + App.esc(code) + '</strong></p></div>' +
        '<div class="rf-share">' +
        '<a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('Te recomiendo esto: ' + link) + '">Compartir por WhatsApp</a>' +
        '<a class="btn ghost" target="_blank" rel="noopener" href="mailto:?subject=' + encodeURIComponent('Te recomiendo') + '&body=' + encodeURIComponent(link) + '">Por email</a>' +
        '</div></div>';
      var copiar = document.getElementById('rf-copiar');
      if (copiar) copiar.addEventListener('click', function () {
        var input = document.getElementById('rf-link');
        input.select();
        try { navigator.clipboard ? navigator.clipboard.writeText(input.value) : document.execCommand('copy'); App.toast('Link copiado'); }
        catch (e) { document.execCommand('copy'); App.toast('Link copiado'); }
      });
      contar(count);
    }

    function contar(hasta) {
      var el = card.querySelector('.rf-num');
      if (!el) return;
      var anime = window.anime;
      if (!anime || !anime.animate || reduceMe) { el.textContent = hasta; return; }
      var st = { v: 0 };
      anime.animate(st, { v: hasta, duration: 700, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v); } });
      // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
      setTimeout(function () { el.textContent = hasta; }, 900);
    }

    (async function () {
      var code = miCodigo();
      if (!code) { pintarForm(); return; }
      if (window.__PREVIEW__) { pintarPanel(code, 3); return; }
      try {
        var r = await App.api('/api/referrals/stats?code=' + encodeURIComponent(code));
        pintarPanel(r.code, r.count);
      } catch (err) { pintarForm(); }
    })();
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Ranking admin (/referidos.html) ----
  var adminBox = document.getElementById('rf-admin');
  if (adminBox) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var ETIQUETAS = { email: 'Email', code: 'Código', count: 'Referidos', createdAt: 'Desde' };

    function pintar() {
      adminBox.innerHTML = App.table(todos, [
        { key: 'email', label: ETIQUETAS.email },
        { label: ETIQUETAS.code, render: function (r) { return '<code>' + App.esc(r.code) + '</code>'; } },
        { label: ETIQUETAS.count, render: function (r) { return '<strong style="color:var(--accent)">' + (r.count || 0) + '</strong>'; } },
        { label: ETIQUETAS.createdAt, render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-AR') : '—'; } },
      ]);
    }

    var csvBtn = document.getElementById('rf-csv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var claves = ['email', 'code', 'count', 'createdAt'];
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [claves.map(function (k) { return celda(ETIQUETAS[k] || k); }).join(';')];
      todos.forEach(function (r) { lineas.push(claves.map(function (k) { return celda(r[k]); }).join(';')); });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'referidos-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    function listo(rows) { todos = rows; pintar(); }

    if (window.__PREVIEW__) {
      listo([
        { email: 'ana@mail.com', code: 'ABC123', count: 7, createdAt: new Date().toISOString() },
        { email: 'luis@mail.com', code: 'XYZ789', count: 3, createdAt: new Date().toISOString() },
      ]);
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/referrals').then(listo)
        .catch(function (err) { adminBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navRef = document.getElementById('nav-referidos');
    if (navRef && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navRef.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Programa de referidos**: cada visitante obtiene un código y un link (\`tusitio.com/?ref=CODIGO\`); cuando alguien llega por ese link y se anota, se acredita el referido (colecciones \`referrals\` y \`referralhits\`). El conteo es real y por email (un crédito por persona referida). ${cfg.moduleIds.includes('auth') ? 'Los administradores ven el ranking y descargan CSV en \`/referidos.html\`.' : 'Para ver el ranking activá el módulo **Autenticación** (habilita \`/referidos.html\`); sin él, mirá \`data/referrals.json\`.'} El premio por referir lo definís vos (es el gancho comercial): comunicalo en el texto de la sección.`,
  ],
};
