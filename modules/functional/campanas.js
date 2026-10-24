// Campañas de email con backend real: el negocio escribe una campaña (asunto + texto), la guarda
// como borrador y la ENVÍA a todos los suscriptores del newsletter con un click. Cada destinatario
// genera una fila REAL en la bandeja de salida del módulo Avisos por email (colección outbox): sin
// RESEND_API_KEY quedan registradas (y se ven en /emails-admin.html), con la clave gratuita de
// Resend salen de verdad una por una. La campaña enviada queda sellada (no se edita ni se reenvía:
// 409) con su cantidad de destinatarios y fecha de envío. El panel /campanas-admin.html es
// solo-admin: KPIs animados (suscriptores actuales, campañas enviadas, emails generados), redacción
// con contador de caracteres, "probar conmigo" (se manda solo al negocio vía mailer.notify) y el
// historial. Animado con Anime.js + red de seguridad. Requiere Avisos por email + Newsletter +
// Autenticación (el Builder los agrega solos por dependencia). Distinto de "newsletter" (captura
// suscriptores): acá el negocio les ESCRIBE. Cierra el ciclo de email marketing del catálogo.

module.exports = {
  id: 'campanas', type: 'functional', name: 'Campañas de email',
  description: 'Panel solo-admin /campanas-admin.html para escribir campañas (asunto + texto), probarlas con uno mismo y enviarlas a todos los suscriptores del newsletter: cada destinatario genera una fila real en la bandeja de salida (outbox) del módulo Avisos por email — sin clave quedan registradas, con RESEND_API_KEY salen de verdad. La campaña enviada queda sellada con destinatarios y fecha. KPIs animados con Anime.js. Requiere Avisos por email, Newsletter y Autenticación.',
  usesAnime: true,
  requires: ['mailer', 'newsletter', 'auth'],
  mounts: [{ route: '/api/campanas', file: 'routes/campanas.js' }],
  collections: ['campaigns'],
  nav: () => [{ label: 'Campañas (admin)', href: '/campanas-admin.html', id: 'nav-campanas-admin' }],
  head: () => `  <style>
    .cp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .cp-kpis .card{text-align:center}
    .cp-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .cp-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px}
    .cp-chip.enviada{background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent)}
    .cp-chip.borrador{background:var(--surface);border:1px solid var(--line);color:var(--muted)}
    .cp-count{font-size:.8rem;color:var(--muted);text-align:right;display:block}
  </style>`,
  files: (cfg) => ({
    'routes/campanas.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');
const mailer = require('../src/mailer');

const validar = (data) => check(data, {
  subject: (v) => str(v, 3, 140),
  body: (v) => str(v, 10, 4000),
});

// GET /api/campanas/admin/stats — KPIs del email marketing (solo admin)
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const campanas = await db.all('campaigns');
  res.json({
    suscriptores: await db.count('subscribers'),
    enviadas: campanas.filter(c => c.status === 'enviada').length,
    borradores: campanas.filter(c => c.status !== 'enviada').length,
    emails: campanas.reduce((s, c) => s + (c.recipients || 0), 0),
    envioActivo: mailer.envioActivo(),
  });
});

// GET /api/campanas/admin/list — campañas, más recientes primero (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  res.json((await db.all('campaigns')).slice(-100).reverse());
});

// POST /api/campanas/admin — guarda una campaña nueva como borrador (solo admin)
router.post('/admin', requireAdmin, async (req, res) => {
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const row = await db.insert('campaigns', {
    subject: req.body.subject.trim(),
    body: req.body.body.trim(),
    status: 'borrador',
    recipients: 0,
    sentAt: '',
  });
  res.status(201).json(row);
});

// PATCH /api/campanas/admin/:id — edita un borrador (una campaña enviada queda sellada: 409)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  const c = await db.get('campaigns', req.params.id);
  if (!c) return res.status(404).json({ error: 'Campaña inexistente' });
  if (c.status === 'enviada') return res.status(409).json({ error: 'Esta campaña ya se envió: no se puede editar' });
  const { ok, errors } = validar(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  res.json(await db.update('campaigns', c.id, { subject: req.body.subject.trim(), body: req.body.body.trim() }));
});

// POST /api/campanas/admin/:id/test — le manda la campaña SOLO al negocio para revisarla (solo admin)
router.post('/admin/:id/test', requireAdmin, async (req, res) => {
  const c = await db.get('campaigns', req.params.id);
  if (!c) return res.status(404).json({ error: 'Campaña inexistente' });
  const row = await mailer.notify('[Prueba] ' + c.subject, c.body);
  res.status(201).json({ status: row.status });
});

// POST /api/campanas/admin/:id/send — envía la campaña a TODOS los suscriptores (solo admin).
// Cada destinatario genera su fila en la bandeja de salida: sin clave quedan registradas,
// con RESEND_API_KEY salen de verdad una por una.
router.post('/admin/:id/send', requireAdmin, async (req, res) => {
  const c = await db.get('campaigns', req.params.id);
  if (!c) return res.status(404).json({ error: 'Campaña inexistente' });
  if (c.status === 'enviada') return res.status(409).json({ error: 'Esta campaña ya se envió' });
  const subs = await db.all('subscribers');
  if (!subs.length) return res.status(409).json({ error: 'Todavía no hay suscriptores del newsletter a quienes enviar' });
  let generados = 0;
  for (const s of subs) {
    if (!s.email) continue;
    // Una fila de bandeja por suscriptor: el estado real de cada email queda auditado en outbox
    const fila = await db.insert('outbox', { to: s.email, subject: c.subject, text: c.body, status: 'registrado', error: '' });
    if (mailer.envioActivo()) await mailer.enviar(fila);
    generados++;
  }
  const upd = await db.update('campaigns', c.id, { status: 'enviada', recipients: generados, sentAt: new Date().toISOString() });
  res.json({ ...upd, envioActivo: mailer.envioActivo() });
});

// DELETE /api/campanas/admin/:id — borra una campaña (el historial de outbox no se toca) (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const c = await db.get('campaigns', req.params.id);
  if (!c) return res.status(404).json({ error: 'Campaña inexistente' });
  await db.remove('campaigns', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
`,
  }),
  pages: () => ({
    'campanas-admin': {
      title: 'Campañas de email',
      html: `  <section>
    <div class="container" style="max-width:920px">
      <h2>Campañas de email</h2>
      <p class="section-sub">Escribí una campaña, probala con vos y enviala a todos los suscriptores del newsletter. Solo visible para administradores.</p>
      <div class="cp-kpis" id="cp-kpis"></div>
      <div class="mx-estado-envio" id="cp-config" hidden></div>
      <form id="cp-form" class="card" style="max-width:680px;margin-bottom:26px">
        <input type="hidden" name="id" value="">
        <label>Asunto</label>
        <input name="subject" required minlength="3" maxlength="140" placeholder="Ej: Novedades y promos de agosto">
        <label>Texto del email</label>
        <textarea name="body" rows="7" required minlength="10" maxlength="4000" placeholder="Hola: te contamos las novedades del mes…"></textarea>
        <span class="cp-count" id="cp-count">0 / 4000</span>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn" type="submit" id="cp-save">Guardar borrador</button>
          <button class="btn ghost" type="button" id="cp-cancel" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="cp-list"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo campañas de email: panel solo-admin para redactar, probar y enviar campañas a los
   suscriptores del newsletter vía la bandeja de salida del mailer. Animado con Anime.js
   (count-up de KPIs) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  // Oculta el link admin de la navbar para quien no es admin (en TODAS las páginas)
  var navC = document.getElementById('nav-campanas-admin');
  if (navC && (!me || me.role !== 'admin') && !window.__PREVIEW__) navC.style.display = 'none';
  var kpis = document.getElementById('cp-kpis');
  if (!kpis) return;
  var formC = document.getElementById('cp-form');
  var listBox = document.getElementById('cp-list');
  var config = document.getElementById('cp-config');
  var idInput = formC.querySelector('[name="id"]');
  var saveBtn = document.getElementById('cp-save');
  var cancelBtn = document.getElementById('cp-cancel');
  var bodyInput = formC.querySelector('[name="body"]');
  var countBox = document.getElementById('cp-count');
  var lista = [];

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = Number(hasta).toLocaleString('es-AR'); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR'); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = Number(hasta).toLocaleString('es-AR'); }, 800);
  }

  bodyInput.addEventListener('input', function () { countBox.textContent = bodyInput.value.length + ' / 4000'; });

  function pintarStats(s) {
    kpis.innerHTML = '<div class="card"><strong id="cp-k-subs">0</strong><span class="muted">suscriptores</span></div>' +
      '<div class="card"><strong id="cp-k-env">0</strong><span class="muted">campañas enviadas</span></div>' +
      '<div class="card"><strong id="cp-k-bor">0</strong><span class="muted">borradores</span></div>' +
      '<div class="card"><strong id="cp-k-mails">0</strong><span class="muted">emails generados</span></div>';
    contar(document.getElementById('cp-k-subs'), s.suscriptores);
    contar(document.getElementById('cp-k-env'), s.enviadas);
    contar(document.getElementById('cp-k-bor'), s.borradores);
    contar(document.getElementById('cp-k-mails'), s.emails);
    config.hidden = false;
    config.innerHTML = s.envioActivo
      ? '<strong>Envío real activo:</strong> al enviar una campaña, los emails salen de verdad a cada suscriptor.'
      : 'Envío real apagado: al enviar, cada email queda <strong>registrado en la bandeja de salida</strong> (mirá /emails-admin.html). Cargá <code>RESEND_API_KEY</code> en el .env para que salgan de verdad.';
  }

  function pintarLista() {
    listBox.innerHTML = App.table(lista, [
      { key: 'subject', label: 'Campaña' },
      { label: 'Estado', render: function (r) { return '<span class="cp-chip ' + r.status + '">' + (r.status === 'enviada' ? 'Enviada' : 'Borrador') + '</span>'; } },
      { label: 'Destinatarios', render: function (r) { return r.status === 'enviada' ? String(r.recipients || 0) : '—'; } },
      { label: 'Enviada el', render: function (r) { return r.sentAt ? new Date(r.sentAt).toLocaleString('es-AR') : '—'; } },
      { label: 'Acciones', render: function (r) {
        if (r.status === 'enviada') {
          return '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        }
        return '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
          '<button class="btn ghost" type="button" data-test="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Probar conmigo</button>' +
          '<button class="btn ghost" type="button" data-send="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Enviar a todos</button>' +
          '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
      } },
    ]);
    listBox.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
    listBox.querySelectorAll('[data-test]').forEach(function (b) { b.addEventListener('click', function () { probar(b.getAttribute('data-test')); }); });
    listBox.querySelectorAll('[data-send]').forEach(function (b) { b.addEventListener('click', function () { enviar(b.getAttribute('data-send')); }); });
    listBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
  }

  function cargar() {
    App.api('/api/campanas/admin/stats').then(pintarStats).catch(function (err) { kpis.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    App.api('/api/campanas/admin/list').then(function (rows) { lista = rows; pintarLista(); }).catch(function () {});
  }

  function resetForm() {
    formC.reset(); idInput.value = '';
    countBox.textContent = '0 / 4000';
    saveBtn.textContent = 'Guardar borrador';
    if (cancelBtn) cancelBtn.hidden = true;
  }

  function editar(id) {
    var c = lista.filter(function (r) { return r.id === id; })[0];
    if (!c) return;
    idInput.value = c.id;
    formC.querySelector('[name="subject"]').value = c.subject;
    bodyInput.value = c.body;
    countBox.textContent = c.body.length + ' / 4000';
    saveBtn.textContent = 'Guardar cambios';
    if (cancelBtn) cancelBtn.hidden = false;
    formC.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

  async function probar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se enviaría la prueba'); return; }
    try {
      var r = await App.api('/api/campanas/admin/' + id + '/test', { method: 'POST' });
      App.toast(r.status === 'enviado' ? 'Prueba enviada: revisá tu casilla' : 'Prueba registrada en la bandeja de salida');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function enviar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se enviaría la campaña'); return; }
    if (!confirm('¿Enviar esta campaña a TODOS los suscriptores del newsletter? Una vez enviada no se puede editar ni reenviar.')) return;
    try {
      var r = await App.api('/api/campanas/admin/' + id + '/send', { method: 'POST' });
      App.toast(r.envioActivo ? 'Campaña enviada a ' + r.recipients + ' suscriptores' : 'Campaña generada: ' + r.recipients + ' emails registrados en la bandeja de salida');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function borrar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se borraría la campaña'); return; }
    if (!confirm('¿Borrar esta campaña? El historial de emails de la bandeja de salida no se toca.')) return;
    try {
      await App.api('/api/campanas/admin/' + id, { method: 'DELETE' });
      lista = lista.filter(function (r) { return r.id !== id; });
      pintarLista();
      App.toast('Campaña borrada');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  formC.addEventListener('submit', async function (e) {
    e.preventDefault();
    var datos = { subject: formC.querySelector('[name="subject"]').value, body: bodyInput.value };
    var editando = idInput.value;
    if (window.__PREVIEW__) { App.toast('Vista previa: se ' + (editando ? 'guardaría' : 'crearía') + ' la campaña'); return; }
    try {
      if (editando) {
        await App.api('/api/campanas/admin/' + editando, { method: 'PATCH', body: datos });
        App.toast('Borrador actualizado');
      } else {
        await App.api('/api/campanas/admin', { method: 'POST', body: datos });
        App.toast('Borrador guardado');
      }
      resetForm();
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  if (window.__PREVIEW__) {
    pintarStats({ suscriptores: 48, enviadas: 3, borradores: 1, emails: 130, envioActivo: false });
    lista = [
      { id: 'd1', subject: 'Novedades y promos de agosto', body: 'Hola…', status: 'borrador', recipients: 0, sentAt: '' },
      { id: 'd2', subject: 'Lanzamos el nuevo local', body: 'Hola…', status: 'enviada', recipients: 44, sentAt: new Date().toISOString() },
    ];
    pintarLista();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargar();
  }
})();`,
  readmeNotes: () => [
    `**Campañas de email**: se redactan y envían desde \`/campanas-admin.html\` a **todos los suscriptores del newsletter** (colección \`subscribers\`). Cada destinatario genera una fila real en la bandeja de salida (\`outbox\`): sin clave quedan registradas y visibles en \`/emails-admin.html\`; con \`RESEND_API_KEY\` salen de verdad. **Ojo con el plan gratuito de Resend** (100 emails/día y remitente \`onboarding@resend.dev\` sin dominio verificado): para listas grandes verificá tu dominio en Resend y envía en tandas. El botón "Probar conmigo" manda la campaña solo a la casilla del negocio antes del envío masivo. Una campaña enviada queda sellada (no se edita ni se reenvía).`,
  ],
};
