// Firma de documentos con backend real: el trámite que hoy se resuelve mandando un PDF por mail y
// esperando que vuelva escaneado. El negocio redacta el documento (contrato, presupuesto aprobado,
// consentimiento, reglamento) desde /firmas-admin.html, carga a quién se lo manda y el sistema
// devuelve un ENLACE ÚNICO con token. Quien lo recibe entra sin cuenta a /firmar.html?t=…, lee el
// texto, escribe su nombre completo y FIRMA CON EL DEDO O EL MOUSE sobre un lienzo. Al firmar, el
// servidor sella una CONSTANCIA: huella SHA-256 del texto exacto que se mostró, fecha y hora, IP y
// navegador. Eso es lo que hace que la firma valga algo: si mañana alguien cambia el documento, la
// huella deja de coincidir y se nota. El enlace es de un solo uso (409 si ya se firmó), se puede
// anular antes de que firmen y vencer solo por fecha. La parte pública NO requiere autenticación (el
// cliente no se va a crear una cuenta para firmar) pero sí el token, que es imposible de adivinar.
// Con auth activo, el panel admin lista estados con KPIs animados (Anime.js + red de seguridad),
// copia el enlace, muestra la firma y exporta CSV. Distinto de "quotesadmin" (presupuestos) y de
// "privacidad" (consentimiento de datos): acá se firma un TEXTO y queda la prueba de quién lo firmó.
const { phIcon } = require('../../src/icons');

const DIAS_VENCE = 30; // Días de validez del enlace desde que se emite (editable)

module.exports = {
  id: 'firma', type: 'functional', name: 'Firma de documentos',
  description: 'Documentos para firmar a distancia con backend real: el negocio redacta el texto y el sistema genera un enlace único con token. El firmante entra sin cuenta a /firmar.html, lee, escribe su nombre y firma en un lienzo (dedo o mouse). El servidor sella la constancia con huella SHA-256 del texto, fecha, IP y navegador; el enlace es de un solo uso, anulable y con vencimiento. Con auth activo, panel /firmas-admin.html con estados, copia de enlace, vista de la firma, KPIs animados (Anime.js) y CSV.',
  usesAnime: true,
  mounts: [{ route: '/api/firma', file: 'routes/firma.js' }],
  collections: ['signdocs'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Firmas (admin)', href: '/firmas-admin.html', id: 'nav-firma-admin' }] : [],
  head: () => `  <style>
    .fm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .fm-kpis .card{text-align:center}
    .fm-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .fm-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .fm-chip.pendiente{background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}
    .fm-chip.firmado{background:#2e9e5b20;color:#1d6b3c}
    .fm-chip.anulado{background:var(--surface);border:1px solid var(--line);color:var(--muted)}
    .fm-chip.vencido{background:#c0392b18;color:#c0392b}
    .fm-doc{white-space:pre-wrap;line-height:1.7;max-height:420px;overflow:auto;background:var(--surface);padding:20px 22px;border-radius:var(--radius);margin:18px 0}
    .fm-lienzo{border:1px dashed var(--line);border-radius:var(--radius);background:var(--bg);touch-action:none;width:100%;max-width:460px;height:180px;display:block;cursor:crosshair}
    .fm-huella{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78rem;word-break:break-all;color:var(--muted)}
    .fm-constancia{border:1px solid var(--line);border-radius:var(--radius);padding:20px 22px;margin-top:20px}
    .fm-firma-img{max-width:280px;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius)}
    .fm-enlace{font-size:.82rem;word-break:break-all;color:var(--muted)}
  </style>`,
  pages: (cfg) => {
    const paginas = {
      firmar: {
        title: 'Firmar documento',
        html: `  <section>
    <div class="container" style="max-width:760px">
      <div id="fm-cargando"><p class="muted">Abriendo el documento…</p></div>
      <div id="fm-error" hidden><h2>No pudimos abrir el documento</h2><p class="muted" id="fm-error-txt"></p></div>
      <div id="fm-vista" hidden>
        <h2 id="fm-titulo">—</h2>
        <p class="section-sub">Para <strong id="fm-para">—</strong>. Leé el documento completo antes de firmar.</p>
        <div class="fm-doc" id="fm-cuerpo"></div>
        <form id="fm-form" class="card">
          <h3>Tu firma</h3>
          <label>Nombre y apellido completos</label><input name="fullName" required maxlength="80" placeholder="Como figura en tu documento">
          <label style="margin-top:14px">Firmá con el dedo o el mouse</label>
          <canvas id="fm-lienzo" class="fm-lienzo" width="920" height="360"></canvas>
          <div style="margin:8px 0 16px"><button class="btn ghost" type="button" id="fm-limpiar" style="width:auto">Borrar y firmar de nuevo</button></div>
          <label style="display:flex;gap:10px;align-items:flex-start;font-weight:400">
            <input type="checkbox" id="fm-acepto" style="width:auto;margin:4px 0 0" required>
            <span>Leí el documento completo y presto mi conformidad. Entiendo que esta firma queda registrada con fecha y hora.</span>
          </label>
          <div style="margin-top:16px"><button class="btn" type="submit">Firmar documento</button></div>
        </form>
      </div>
      <div id="fm-listo" hidden>
        <h2>${'Documento firmado'}</h2>
        <p class="section-sub">Guardá esta constancia: es la prueba de lo que firmaste y cuándo.</p>
        <div class="fm-constancia">
          <p style="margin:0 0 10px"><strong id="fm-c-titulo">—</strong></p>
          <p class="muted" style="margin:0 0 4px">Firmado por <strong id="fm-c-nombre">—</strong> el <span id="fm-c-fecha">—</span></p>
          <p class="muted" style="margin:14px 0 4px;font-size:.85rem">Huella del documento (SHA-256)</p>
          <p class="fm-huella" id="fm-c-huella">—</p>
          <img id="fm-c-firma" class="fm-firma-img" alt="Firma registrada" hidden>
        </div>
      </div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      paginas['firmas-admin'] = {
        title: 'Firma de documentos',
        html: `  <section>
    <div class="container">
      <h2>Firma de documentos</h2>
      <p class="section-sub">Redactá el documento, mandá el enlace y quedate con la constancia. No hace falta que la otra persona tenga cuenta.</p>
      <div id="fm-kpis" class="fm-kpis"></div>
      <div class="card" style="margin-bottom:26px">
        <h3>Nuevo documento</h3>
        <form id="fm-nuevo">
          <label>Título</label><input name="title" required maxlength="120" placeholder="Contrato de servicios — Marzo">
          <label>Texto del documento</label>
          <textarea name="body" rows="8" required maxlength="20000" placeholder="Escribí acá el texto completo que la persona va a leer y firmar."></textarea>
          <div class="grid cols-2" style="margin-top:8px">
            <div><label>Nombre de quien firma</label><input name="signerName" required maxlength="80"></div>
            <div><label>Email de quien firma</label><input name="signerEmail" type="email" required></div>
          </div>
          <div style="margin-top:16px"><button class="btn" type="submit">${phIcon('paper-plane-tilt', { size: 16, style: 'vertical-align:-3px;margin-right:6px' })}Generar enlace para firmar</button></div>
        </form>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
        <select id="fm-filtro" style="width:auto;margin:0">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="firmado">Firmados</option>
          <option value="anulado">Anulados</option>
        </select>
        <button class="btn ghost" type="button" id="fm-csv">Descargar CSV</button>
      </div>
      <div id="fm-tabla"><p class="muted">Cargando…</p></div>
      <div id="fm-detalle"></div>
    </div>
  </section>`,
      };
    }
    return paginas;
  },
  files: (cfg) => ({
    'routes/firma.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { check, str, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
const DIAS_VENCE = ${DIAS_VENCE}; // Validez del enlace desde que se emite
const MAX_FIRMA = 400000;         // Tope del PNG de la firma (dataURL), ~300 KB de imagen

// Huella del texto exacto que se mostró: si el documento cambia, deja de coincidir
const huella = (txt) => crypto.createHash('sha256').update(String(txt), 'utf8').digest('hex');

// IP del firmante mirando el proxy (Vercel y compañía) antes que el socket
function ipDe(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || (req.socket && req.socket.remoteAddress) || '';
}

const vencido = (d) => d.status === 'pendiente' && d.expiresAt && new Date(d.expiresAt).getTime() < Date.now();
const estado = (d) => (vencido(d) ? 'vencido' : d.status);

// Vista pública: nunca viaja el email del firmante ni la IP de nadie
const publica = (d) => ({
  title: d.title, body: d.body, signerName: d.signerName,
  status: estado(d), expiresAt: d.expiresAt,
  signedAt: d.signedAt || '', signedName: d.signedName || '',
  hash: d.hash, signature: d.signature || '',
});

// POST /api/firma/doc/:token/firmar — la parte pública: firma sin cuenta, con el token del enlace
router.post('/doc/:token/firmar', async (req, res) => {
  const doc = (await db.find('signdocs', d => d.token === req.params.token))[0];
  if (!doc) return res.status(404).json({ error: 'El enlace no corresponde a ningún documento' });
  if (doc.status === 'firmado') return res.status(409).json({ error: 'Este documento ya fue firmado' });
  if (doc.status === 'anulado') return res.status(409).json({ error: 'Este documento fue anulado por quien lo emitió' });
  if (vencido(doc)) return res.status(409).json({ error: 'El enlace venció: pedí uno nuevo' });

  const { ok, errors } = check(req.body, { fullName: (v) => str(v, 3, 80) });
  if (!ok) return res.status(422).json({ error: 'Escribí tu nombre y apellido completos', errors });
  if (req.body.accept !== true) return res.status(422).json({ error: 'Tenés que confirmar que leíste el documento' });
  const firma = String(req.body.signature || '');
  if (!/^data:image\\/png;base64,[A-Za-z0-9+/=]+$/.test(firma)) {
    return res.status(422).json({ error: 'Falta la firma: dibujala en el recuadro' });
  }
  if (firma.length > MAX_FIRMA) return res.status(413).json({ error: 'La firma es demasiado pesada' });

  const signedAt = new Date().toISOString();
  const upd = await db.update('signdocs', doc.id, {
    status: 'firmado',
    signedName: req.body.fullName.trim(),
    signedAt,
    signature: firma,
    ip: ipDe(req),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
    // Sello de la firma: ata el texto, el nombre y el momento en un solo valor
    proof: huella(doc.hash + '|' + req.body.fullName.trim() + '|' + signedAt),
  });
  res.json(publica(upd));
});

// GET /api/firma/doc/:token — el documento que ve quien recibió el enlace
router.get('/doc/:token', async (req, res) => {
  const doc = (await db.find('signdocs', d => d.token === req.params.token))[0];
  if (!doc) return res.status(404).json({ error: 'El enlace no corresponde a ningún documento' });
  res.json(publica(doc));
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/firma — todos los documentos con su estado (solo admin; filtro ?status=)
router.get('/', requireAdmin, async (req, res) => {
  let rows = (await db.all('signdocs')).map(d => ({ ...d, status: estado(d) }));
  if (['pendiente', 'firmado', 'anulado', 'vencido'].includes(req.query.status)) {
    rows = rows.filter(d => d.status === req.query.status);
  }
  res.json(rows.reverse());
});

// POST /api/firma — redacta un documento y devuelve el enlace con token (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, {
    title: (v) => str(v, 3, 120),
    body: (v) => str(v, 20, 20000),
    signerName: (v) => str(v, 2, 80),
    signerEmail: isEmail,
  });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos (el texto necesita al menos 20 caracteres)', errors });
  const body = req.body.body.trim();
  const vence = new Date(Date.now() + DIAS_VENCE * 86400000).toISOString();
  const row = await db.insert('signdocs', {
    title: req.body.title.trim(),
    body,
    hash: huella(body),
    signerName: req.body.signerName.trim(),
    signerEmail: req.body.signerEmail.toLowerCase().trim(),
    token: crypto.randomBytes(18).toString('base64url'),
    status: 'pendiente',
    expiresAt: vence,
    author: req.user.name,
  });
  res.status(201).json({ ...row, status: 'pendiente' });
});

// PATCH /api/firma/:id — anula un documento todavía sin firmar (solo admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const doc = await db.get('signdocs', req.params.id);
  if (!doc) return res.status(404).json({ error: 'Documento inexistente' });
  if (doc.status === 'firmado') return res.status(409).json({ error: 'Un documento firmado no se anula: la constancia ya existe' });
  if (req.body.status !== 'anulado') return res.status(422).json({ error: 'Sólo se puede anular' });
  res.json(await db.update('signdocs', doc.id, { status: 'anulado' }));
});

// DELETE /api/firma/:id — borra un documento sin firmar (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const doc = await db.get('signdocs', req.params.id);
  if (!doc) return res.status(404).json({ error: 'Documento inexistente' });
  if (doc.status === 'firmado') return res.status(409).json({ error: 'Un documento firmado no se borra: es la prueba de la firma' });
  await db.remove('signdocs', doc.id);
  res.json({ ok: true });
});
` : `// Redactar documentos y ver las constancias requiere el módulo de autenticación:
// activalo en el Builder para habilitar el panel /firmas-admin.html.
`}
module.exports = router;
`,
  }),
  clientJs: (cfg) => `/* Módulo firma de documentos: parte pública (lectura + lienzo de firma + constancia) y, con
   auth activo, panel admin con KPIs animados (Anime.js + red de seguridad), enlace copiable,
   vista de la firma y CSV. En la vista previa del Builder simula la API. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };
  var fechaHora = function (iso) { try { return new Date(iso).toLocaleString('es-AR'); } catch (e) { return '—'; } };
  var LABELS = { pendiente: 'Pendiente', firmado: 'Firmado', anulado: 'Anulado', vencido: 'Vencido' };

  /* ---------- Parte pública: /firmar.html?t=TOKEN ---------- */
  var vista = document.getElementById('fm-vista');
  if (vista) {
    var token = new URLSearchParams(location.search).get('t') || '';
    var cargando = document.getElementById('fm-cargando');
    var errBox = document.getElementById('fm-error');
    var listo = document.getElementById('fm-listo');
    var lienzo = document.getElementById('fm-lienzo');
    var ctx = lienzo && lienzo.getContext('2d');
    var trazado = false;

    function fallar(msg) {
      if (cargando) cargando.hidden = true;
      if (errBox) { errBox.hidden = false; document.getElementById('fm-error-txt').textContent = msg; }
    }

    function mostrarConstancia(d) {
      if (cargando) cargando.hidden = true;
      vista.hidden = true;
      if (!listo) return;
      listo.hidden = false;
      document.getElementById('fm-c-titulo').textContent = d.title;
      document.getElementById('fm-c-nombre').textContent = d.signedName || '—';
      document.getElementById('fm-c-fecha').textContent = fechaHora(d.signedAt);
      document.getElementById('fm-c-huella').textContent = d.hash || '—';
      var img = document.getElementById('fm-c-firma');
      if (img && d.signature) { img.src = d.signature; img.hidden = false; }
    }

    function mostrarDoc(d) {
      if (cargando) cargando.hidden = true;
      if (d.status === 'firmado') { mostrarConstancia(d); return; }
      if (d.status === 'anulado') { fallar('Este documento fue anulado por quien lo emitió.'); return; }
      if (d.status === 'vencido') { fallar('El enlace venció. Pedile uno nuevo a quien te lo mandó.'); return; }
      vista.hidden = false;
      document.getElementById('fm-titulo').textContent = d.title;
      document.getElementById('fm-para').textContent = d.signerName;
      document.getElementById('fm-cuerpo').textContent = d.body;
      prepararLienzo();
    }

    // Lienzo de firma: mismo código para mouse y dedo vía Pointer Events
    function prepararLienzo() {
      if (!ctx) return;
      ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = getComputedStyle(document.body).color || '#111';
      var dibujando = false;
      var punto = function (e) {
        var r = lienzo.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (lienzo.width / r.width), y: (e.clientY - r.top) * (lienzo.height / r.height) };
      };
      lienzo.addEventListener('pointerdown', function (e) {
        dibujando = true; trazado = true;
        lienzo.setPointerCapture(e.pointerId);
        var p = punto(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
      });
      lienzo.addEventListener('pointermove', function (e) {
        if (!dibujando) return;
        e.preventDefault();
        var p = punto(e); ctx.lineTo(p.x, p.y); ctx.stroke();
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
        lienzo.addEventListener(ev, function () { dibujando = false; });
      });
      var limpiar = document.getElementById('fm-limpiar');
      if (limpiar) limpiar.addEventListener('click', function () {
        ctx.clearRect(0, 0, lienzo.width, lienzo.height);
        trazado = false;
      });
    }

    var formF = document.getElementById('fm-form');
    if (formF) formF.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!trazado) { App.toast('Falta tu firma en el recuadro'); return; }
      var acepto = document.getElementById('fm-acepto');
      if (acepto && !acepto.checked) { App.toast('Confirmá que leíste el documento'); return; }
      var datos = {
        fullName: formF.querySelector('[name="fullName"]').value,
        accept: true,
        signature: lienzo.toDataURL('image/png'),
      };
      if (window.__PREVIEW__) {
        mostrarConstancia({ title: 'Documento de ejemplo', signedName: datos.fullName, signedAt: new Date().toISOString(), hash: '0'.repeat(64), signature: datos.signature });
        return;
      }
      try {
        mostrarConstancia(await App.api('/api/firma/doc/' + encodeURIComponent(token) + '/firmar', { method: 'POST', body: datos }));
        App.toast('Documento firmado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    (async function () {
      if (window.__PREVIEW__) {
        mostrarDoc({ title: 'Contrato de servicios — ejemplo', body: 'Este es el texto que la persona lee antes de firmar.\\n\\nEn el proyecto exportado llega desde el servidor con su huella SHA-256.', signerName: 'Laura Gómez', status: 'pendiente', hash: '' });
        return;
      }
      if (!token) { fallar('Este enlace está incompleto. Pedile a quien te lo mandó el enlace completo.'); return; }
      try { mostrarDoc(await App.api('/api/firma/doc/' + encodeURIComponent(token))); }
      catch (err) { if (err.message !== 'preview') fallar(err.message); }
    })();
  }
${cfg.moduleIds.includes('auth') ? `
  /* ---------- Panel admin ---------- */
  var tabla = document.getElementById('fm-tabla');
  if (!tabla) return;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
    tabla.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
    return;
  }
  var docs = [];

  function contar(el, valor) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = valor; return; }
    var obj = { v: 0 };
    anime.animate(obj, { v: valor, duration: 650, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(obj.v); } });
    setTimeout(function () { el.textContent = valor; }, 850);
  }

  function pintarKpis() {
    var box = document.getElementById('fm-kpis');
    if (!box) return;
    var cont = function (s) { return docs.filter(function (d) { return d.status === s; }).length; };
    var datos = [['Pendientes', cont('pendiente')], ['Firmados', cont('firmado')], ['Vencidos', cont('vencido')], ['Anulados', cont('anulado')]];
    box.innerHTML = datos.map(function (d) {
      return '<div class="card"><strong data-fm-kpi="' + d[1] + '">0</strong><span class="muted">' + d[0] + '</span></div>';
    }).join('');
    box.querySelectorAll('[data-fm-kpi]').forEach(function (el) { contar(el, Number(el.getAttribute('data-fm-kpi'))); });
  }

  function enlaceDe(d) { return location.origin + '/firmar.html?t=' + d.token; }

  function pintarTabla() {
    var filtro = (document.getElementById('fm-filtro') || {}).value || '';
    var rows = filtro ? docs.filter(function (d) { return d.status === filtro; }) : docs;
    tabla.innerHTML = App.table(rows, [
      { label: 'Documento', render: function (d) { return '<strong>' + App.esc(d.title) + '</strong><br><span class="muted" style="font-size:.8rem">' + App.esc(d.signerName) + ' · ' + App.esc(d.signerEmail) + '</span>'; } },
      { label: 'Estado', render: function (d) { return '<span class="fm-chip ' + d.status + '">' + (LABELS[d.status] || d.status) + '</span>'; } },
      { label: 'Emitido', render: function (d) { return fechaHora(d.createdAt); } },
      { label: 'Firmado', render: function (d) { return d.signedAt ? fechaHora(d.signedAt) + '<br><span class="muted" style="font-size:.8rem">' + App.esc(d.signedName || '') + '</span>' : '<span class="muted">—</span>'; } },
      { label: '', render: function (d) {
        var b = '<button class="btn ghost" type="button" data-fm-ver="' + d.id + '">Ver</button> ';
        if (d.status === 'pendiente') b += '<button class="btn ghost" type="button" data-fm-copiar="' + d.id + '">Copiar enlace</button> <button class="btn ghost" type="button" data-fm-anular="' + d.id + '">Anular</button>';
        return b;
      } },
    ]);
    tabla.querySelectorAll('[data-fm-ver]').forEach(function (b) {
      b.addEventListener('click', function () { verDetalle(b.getAttribute('data-fm-ver')); });
    });
    tabla.querySelectorAll('[data-fm-copiar]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = docs.filter(function (x) { return x.id === b.getAttribute('data-fm-copiar'); })[0];
        if (!d) return;
        var url = enlaceDe(d);
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { App.toast('Enlace copiado'); }, function () { prompt('Copiá el enlace:', url); });
        else prompt('Copiá el enlace:', url);
      });
    });
    tabla.querySelectorAll('[data-fm-anular]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('¿Anular el documento? El enlace deja de funcionar.')) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: se anularía'); return; }
        try { await App.api('/api/firma/' + b.getAttribute('data-fm-anular'), { method: 'PATCH', body: { status: 'anulado' } }); App.toast('Documento anulado'); cargar(); }
        catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }

  function verDetalle(id) {
    var d = docs.filter(function (x) { return x.id === id; })[0];
    var box = document.getElementById('fm-detalle');
    if (!d || !box) return;
    box.innerHTML = '<div class="card" style="margin-top:26px">' +
      '<h3>' + App.esc(d.title) + ' <span class="fm-chip ' + d.status + '">' + (LABELS[d.status] || d.status) + '</span></h3>' +
      '<div class="fm-doc">' + App.esc(d.body) + '</div>' +
      '<p class="muted" style="margin:0 0 4px;font-size:.85rem">Huella del texto (SHA-256)</p>' +
      '<p class="fm-huella">' + App.esc(d.hash || '') + '</p>' +
      (d.status === 'pendiente' ? '<p class="fm-enlace">Enlace para firmar: ' + App.esc(enlaceDe(d)) + '</p>' : '') +
      (d.status === 'firmado' ? '<p class="muted" style="margin:14px 0 6px">Firmado por <strong>' + App.esc(d.signedName || '') + '</strong> el ' + fechaHora(d.signedAt) + ' · IP ' + App.esc(d.ip || '—') + '</p>' +
        '<img class="fm-firma-img" alt="Firma de ' + attr(d.signedName || '') + '" src="' + attr(d.signature || '') + '">' +
        '<p class="muted" style="margin:12px 0 4px;font-size:.85rem">Sello de la firma</p><p class="fm-huella">' + App.esc(d.proof || '') + '</p>' : '') +
      '</div>';
    box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  async function cargar() {
    if (window.__PREVIEW__) {
      docs = [{ id: '1', title: 'Contrato de servicios', body: 'Texto del contrato de ejemplo.', hash: '0'.repeat(64), signerName: 'Laura Gómez', signerEmail: 'laura@mail.com', token: 'demo', status: 'pendiente', createdAt: new Date().toISOString() }];
    } else {
      try { docs = await App.api('/api/firma'); }
      catch (err) { if (err.message !== 'preview') tabla.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; return; }
    }
    pintarKpis();
    pintarTabla();
  }

  var nuevo = document.getElementById('fm-nuevo');
  if (nuevo) nuevo.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: se generaría el enlace'); return; }
    try {
      var d = await App.api('/api/firma', { method: 'POST', body: Object.fromEntries(new FormData(nuevo)) });
      nuevo.reset();
      await cargar();
      App.toast('Documento listo: copiá el enlace y mandáselo');
      verDetalle(d.id);
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  var filtro = document.getElementById('fm-filtro');
  if (filtro) filtro.addEventListener('change', pintarTabla);

  var csv = document.getElementById('fm-csv');
  if (csv) csv.addEventListener('click', function () {
    var claves = [['createdAt', 'Emitido'], ['title', 'Documento'], ['signerName', 'Destinatario'], ['signerEmail', 'Email'], ['status', 'Estado'], ['signedName', 'Firmado por'], ['signedAt', 'Fecha de firma'], ['ip', 'IP'], ['hash', 'Huella'], ['proof', 'Sello']];
    var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lineas = [claves.map(function (k) { return celda(k[1]); }).join(';')];
    docs.forEach(function (d) {
      lineas.push(claves.map(function (k) {
        if (k[0] === 'status') return celda(LABELS[d.status] || d.status);
        if (k[0] === 'createdAt' || k[0] === 'signedAt') return celda(d[k[0]] ? fechaHora(d[k[0]]) : '');
        return celda(d[k[0]]);
      }).join(';'));
    });
    var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'firmas-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  cargar();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Firma de documentos**: ${cfg.moduleIds.includes('auth') ? 'redactá el documento en `/firmas-admin.html`, copiá el enlace que devuelve y mandáselo a quien tiene que firmar' : 'para redactar documentos y ver las constancias activá el módulo **Autenticación** en el Builder; sin él, la página `/firmar.html` funciona pero no hay panel para emitir enlaces'}. El enlace vence a los ${DIAS_VENCE} días (editable en \`routes/firma.js\`) y es de un solo uso. Al firmar se guardan la huella SHA-256 del texto exacto, la fecha y hora, la IP y el navegador: sirve como constancia de conformidad, **no reemplaza a la firma digital con certificado** (en Argentina, Ley 25.506) cuando la ley exige esa forma. Un documento firmado no se puede borrar ni anular a propósito: es la prueba.`,
  ],
};
