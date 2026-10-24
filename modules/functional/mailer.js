// Avisos por email con backend real: el sistema registra cada aviso del negocio en una BANDEJA DE
// SALIDA propia (colección outbox) y, si el cliente carga una RESEND_API_KEY (free tier, opcional),
// los envía de verdad por email. Sin clave el módulo funciona igual: cada aviso queda registrado
// con estado "registrado" y se consulta desde el panel — nada se pierde ni se rompe, y el día que
// se carga la clave los avisos empiezan a salir solos. Los módulos que capturan datos del público
// (bolsa de trabajo, solicitar llamada, directorio de profesionales) llaman a mailer.notify() al
// recibir un alta y el negocio se entera sin entrar al panel. El destinatario sale de la ficha del
// negocio (módulo "Datos del negocio") si está activa, o de MAIL_TO en el .env. Con auth activo,
// /emails-admin.html es la bandeja solo-admin: KPIs animados, estados (registrado/enviado/error),
// reintento de envío, email de prueba y CSV. Animado con Anime.js + red de seguridad. Cierra el
// pendiente histórico de email transaccional sin obligar a ninguna API key.

module.exports = {
  id: 'mailer', type: 'functional', name: 'Avisos por email',
  description: 'Bandeja de salida real (colección outbox): los módulos que capturan datos (postulaciones, pedidos de llamada, consultas a profesionales) registran un aviso por email al negocio. Con RESEND_API_KEY (free tier, opcional) los avisos se envían de verdad; sin clave quedan registrados y visibles. Con auth activo, panel /emails-admin.html con estados, reintento, email de prueba y CSV. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/mailer', file: 'routes/mailer.js' }],
  collections: ['outbox'],
  env: {
    RESEND_API_KEY: 're_xxxxxxxx (opcional: con la clave de resend.com los avisos se envían de verdad; sin ella quedan registrados en la bandeja)',
    MAIL_TO: 'avisos@tunegocio.com',
    MAIL_FROM: 'Avisos <onboarding@resend.dev>',
  },
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Emails (admin)', href: '/emails-admin.html', id: 'nav-mailer-admin' }] : [],
  head: () => `  <style>
    .mx-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .mx-kpis .card{text-align:center}
    .mx-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .mx-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px}
    .mx-chip.enviado{background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent)}
    .mx-chip.registrado{background:var(--surface);border:1px solid var(--line);color:var(--muted)}
    .mx-chip.error{background:color-mix(in srgb,#c0392b 12%,var(--surface));color:#c0392b}
    .mx-estado-envio{border-left:3px solid var(--accent);padding:10px 14px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0;margin-bottom:22px;font-size:.92rem}
  </style>`,
  files: (cfg) => ({
    // Helper compartido: cualquier módulo del proyecto puede avisar por email con una línea.
    'src/mailer.js': `/**
 * Avisos por email del negocio. Cada aviso queda SIEMPRE registrado en la colección outbox
 * (bandeja de salida) y, si hay RESEND_API_KEY en el .env, además se envía de verdad vía
 * https://resend.com (free tier alcanza). Sin clave nada falla: el aviso queda con estado
 * "registrado" y se ve en el panel. Usalo desde cualquier ruta: mailer.notify(asunto, texto).
 */
require('./env');
const db = require('./db');

// Destinatario de los avisos: ${cfg.moduleIds.includes('negocio') ? 'el email de la ficha del negocio (módulo Datos del negocio) y, si está vacío, ' : ''}MAIL_TO del .env
async function destino() {
${cfg.moduleIds.includes('negocio') ? `  const fichas = await db.all('bizinfo');
  if (fichas.length && fichas[0].email) return fichas[0].email;
` : ''}  return process.env.MAIL_TO || '';
}

// ¿El envío real está activo? (sin clave, los avisos solo se registran)
const envioActivo = () => Boolean(process.env.RESEND_API_KEY);

// Intenta el envío real de una fila de la bandeja y actualiza su estado
async function enviar(row) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Avisos <onboarding@resend.dev>',
        to: [row.to],
        subject: row.subject,
        text: row.text,
      }),
    });
    if (!res.ok) throw new Error('Resend ' + res.status + ': ' + (await res.text()).slice(0, 200));
    return await db.update('outbox', row.id, { status: 'enviado', error: '', sentAt: new Date().toISOString() });
  } catch (err) {
    return await db.update('outbox', row.id, { status: 'error', error: String(err.message).slice(0, 300) });
  }
}

// Registra un aviso PARA UN DESTINATARIO CUALQUIERA (y lo envía si hay clave). Es la versión
// general: la usan los módulos que le escriben AL CLIENTE (su código de turno, el link para
// recuperar la contraseña, la confirmación de su pedido) y no al negocio. Nunca lanza: un email
// caído jamás debe romper la operación que lo disparó — el resultado queda en el estado de la fila.
async function notifyTo(to, subject, text) {
  const dest = String(to || '').trim();
  const row = await db.insert('outbox', {
    to: dest,
    subject: String(subject || '').slice(0, 140),
    text: String(text || '').slice(0, 4000),
    status: 'registrado',
    error: dest ? '' : 'Sin destinatario',
  });
  if (envioActivo() && dest) return enviar(row);
  return row;
}

// Registra un aviso PARA EL NEGOCIO (destinatario de la ficha o MAIL_TO). El caso más común.
async function notify(subject, text) {
  const to = await destino();
  if (!to) {
    return db.insert('outbox', {
      to: '',
      subject: String(subject || '').slice(0, 140),
      text: String(text || '').slice(0, 4000),
      status: 'registrado',
      error: 'Sin destinatario: definí MAIL_TO en .env${cfg.moduleIds.includes('negocio') ? ' o cargá el email en la ficha del negocio' : ''}',
    });
  }
  return notifyTo(to, subject, text);
}

module.exports = { notify, notifyTo, enviar, destino, envioActivo };
`,
    'routes/mailer.js': `const router = require('express').Router();
const db = require('../src/db');
const mailer = require('../src/mailer');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');

// GET /api/mailer/admin/stats — resumen de la bandeja + configuración vigente (solo admin)
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const rows = await db.all('outbox');
  res.json({
    total: rows.length,
    enviados: rows.filter(r => r.status === 'enviado').length,
    registrados: rows.filter(r => r.status === 'registrado').length,
    errores: rows.filter(r => r.status === 'error').length,
    envioActivo: mailer.envioActivo(),
    destino: await mailer.destino(),
  });
});

// GET /api/mailer/admin/list — últimos avisos, más recientes primero (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  let rows = await db.all('outbox');
  if (req.query.status && ['registrado', 'enviado', 'error'].includes(req.query.status)) {
    rows = rows.filter(r => r.status === req.query.status);
  }
  res.json(rows.slice(-200).reverse());
});

// POST /api/mailer/admin/test — registra (y si hay clave, envía) un email de prueba (solo admin)
router.post('/admin/test', requireAdmin, async (req, res) => {
  const row = await mailer.notify('Email de prueba', 'Este es un aviso de prueba enviado desde el panel de emails del sitio. Si lo estás leyendo en tu casilla, el envío real está funcionando.');
  res.status(201).json(row);
});

// POST /api/mailer/admin/:id/resend — reintenta el envío real de un aviso (solo admin)
router.post('/admin/:id/resend', requireAdmin, async (req, res) => {
  if (!mailer.envioActivo()) return res.status(409).json({ error: 'El envío real está apagado: cargá RESEND_API_KEY en el .env para enviar' });
  const row = await db.get('outbox', req.params.id);
  if (!row) return res.status(404).json({ error: 'Aviso inexistente' });
  if (!row.to) return res.status(422).json({ error: 'El aviso no tiene destinatario' });
  res.json(await mailer.enviar(row));
});

// DELETE /api/mailer/admin/:id — borra un aviso de la bandeja (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const row = await db.get('outbox', req.params.id);
  if (!row) return res.status(404).json({ error: 'Aviso inexistente' });
  await db.remove('outbox', req.params.id);
  res.json({ ok: true });
});
` : `// La bandeja de salida requiere el módulo de autenticación: activalo en el Builder para
// habilitar /emails-admin.html. Los avisos igual se registran en data/outbox.json (y se
// envían de verdad si cargás RESEND_API_KEY en el .env).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'emails-admin': {
      title: 'Avisos por email',
      html: `  <section>
    <div class="container" style="max-width:920px">
      <h2>Avisos por email</h2>
      <p class="section-sub">Cada aviso que genera el sitio (postulaciones, llamadas, consultas…) queda acá. Con una clave de Resend además se envían de verdad a tu casilla. Solo visible para administradores.</p>
      <div class="mx-estado-envio" id="mx-config">Cargando configuración…</div>
      <div class="mx-kpis" id="mx-kpis"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
        <button class="btn" type="button" id="mx-test">Enviar email de prueba</button>
        <select id="mx-filtro" style="width:auto">
          <option value="">Todos los estados</option>
          <option value="registrado">Registrados</option>
          <option value="enviado">Enviados</option>
          <option value="error">Con error</option>
        </select>
        <button class="btn ghost" type="button" id="mx-csv">Descargar CSV</button>
      </div>
      <div id="mx-list"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => cfg.moduleIds.includes('auth') ? `/* Módulo avisos por email: bandeja de salida solo-admin en /emails-admin.html con KPIs,
   reintento de envío y email de prueba. Animado con Anime.js (count-up) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  // Oculta el link admin de la navbar para quien no es admin (en TODAS las páginas,
  // por eso va antes del corte de "no estamos en el panel")
  var navM = document.getElementById('nav-mailer-admin');
  if (navM && (!me || me.role !== 'admin') && !window.__PREVIEW__) navM.style.display = 'none';
  var kpis = document.getElementById('mx-kpis');
  if (!kpis) return;
  var config = document.getElementById('mx-config');
  var listBox = document.getElementById('mx-list');
  var filtro = document.getElementById('mx-filtro');
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

  function pintarStats(s) {
    config.innerHTML = s.envioActivo
      ? '<strong>Envío real activo.</strong> Los avisos salen por email a <strong>' + App.esc(s.destino || '(sin destinatario)') + '</strong>.'
      : 'Envío real apagado: los avisos <strong>quedan registrados en esta bandeja</strong>. Para recibirlos por email, cargá <code>RESEND_API_KEY</code> en el .env (resend.com, gratis)' + (s.destino ? ' — destinatario actual: <strong>' + App.esc(s.destino) + '</strong>.' : ' y definí el destinatario (MAIL_TO${cfg.moduleIds.includes('negocio') ? ' o el email de la ficha del negocio' : ''}).');
    kpis.innerHTML = '<div class="card"><strong id="mx-k-total">0</strong><span class="muted">avisos totales</span></div>' +
      '<div class="card"><strong id="mx-k-env">0</strong><span class="muted">enviados</span></div>' +
      '<div class="card"><strong id="mx-k-reg">0</strong><span class="muted">registrados</span></div>' +
      '<div class="card"><strong id="mx-k-err">0</strong><span class="muted">con error</span></div>';
    contar(document.getElementById('mx-k-total'), s.total);
    contar(document.getElementById('mx-k-env'), s.enviados);
    contar(document.getElementById('mx-k-reg'), s.registrados);
    contar(document.getElementById('mx-k-err'), s.errores);
  }

  function chip(st) { return '<span class="mx-chip ' + st + '">' + st + '</span>'; }

  function pintarLista() {
    listBox.innerHTML = App.table(lista.slice(0, 60), [
      { label: 'Cuándo', render: function (r) { return new Date(r.createdAt).toLocaleString('es-AR'); } },
      { label: 'Asunto', render: function (r) { return '<strong>' + App.esc(r.subject) + '</strong><br><span class="muted" style="font-size:.82rem">' + App.esc(String(r.text || '').slice(0, 90)) + '</span>'; } },
      { label: 'Para', render: function (r) { return App.esc(r.to || '—'); } },
      { label: 'Estado', render: function (r) { return chip(r.status) + (r.error ? '<br><span class="muted" style="font-size:.78rem">' + App.esc(r.error) + '</span>' : ''); } },
      { label: 'Acciones', render: function (r) {
        return (r.status !== 'enviado' ? '<button class="btn ghost" type="button" data-resend="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Reenviar</button>' : '') +
          '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
      } },
    ]);
    listBox.querySelectorAll('[data-resend]').forEach(function (b) { b.addEventListener('click', function () { reenviar(b.getAttribute('data-resend')); }); });
    listBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
  }

  function cargar() {
    App.api('/api/mailer/admin/stats').then(pintarStats).catch(function (err) { kpis.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    App.api('/api/mailer/admin/list' + (filtro.value ? '?status=' + filtro.value : '')).then(function (rows) { lista = rows; pintarLista(); }).catch(function () {});
  }

  async function reenviar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se reintentaría el envío'); return; }
    try {
      await App.api('/api/mailer/admin/' + id + '/resend', { method: 'POST' });
      App.toast('Envío reintentado');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function borrar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se borraría el aviso'); return; }
    if (!confirm('¿Borrar este aviso de la bandeja?')) return;
    try {
      await App.api('/api/mailer/admin/' + id, { method: 'DELETE' });
      lista = lista.filter(function (r) { return r.id !== id; });
      pintarLista();
      App.toast('Aviso borrado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  var testBtn = document.getElementById('mx-test');
  if (testBtn) testBtn.addEventListener('click', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: se registraría un email de prueba'); return; }
    try {
      var r = await App.api('/api/mailer/admin/test', { method: 'POST' });
      App.toast(r.status === 'enviado' ? 'Email de prueba enviado: revisá tu casilla' : 'Email de prueba registrado en la bandeja');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  var csvBtn = document.getElementById('mx-csv');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    var filas = [['fecha', 'asunto', 'para', 'estado', 'error']].concat(lista.map(function (r) { return [r.createdAt, r.subject, r.to, r.status, r.error || '']; }));
    var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'avisos-email.csv';
    a.click();
  });

  filtro.addEventListener('change', function () {
    if (window.__PREVIEW__) return;
    App.api('/api/mailer/admin/list' + (filtro.value ? '?status=' + filtro.value : '')).then(function (rows) { lista = rows; pintarLista(); }).catch(function () {});
  });

  if (window.__PREVIEW__) {
    pintarStats({ total: 5, enviados: 3, registrados: 1, errores: 1, envioActivo: true, destino: 'avisos@tunegocio.com' });
    lista = [
      { id: 'd1', subject: 'Nueva postulación: Vendedor/a', text: 'Ana López (ana@mail.com) se postuló.', to: 'avisos@tunegocio.com', status: 'enviado', createdAt: new Date().toISOString() },
      { id: 'd2', subject: 'Nuevo pedido de llamada', text: 'Luis Gómez pidió que lo llamen a la tarde.', to: 'avisos@tunegocio.com', status: 'registrado', createdAt: new Date().toISOString() },
    ];
    pintarLista();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargar();
  }
})();` : `/* Módulo avisos por email: sin el módulo de autenticación no hay panel; los avisos igual se
   registran en la colección outbox (y se envían si hay RESEND_API_KEY en el .env). */`,
  readmeNotes: (cfg) => {
    const integrados = [
      cfg.moduleIds.includes('vacantes') ? 'una **postulación** a la bolsa de trabajo' : '',
      cfg.moduleIds.includes('callback') ? 'un **pedido de llamada**' : '',
      cfg.moduleIds.includes('profesionales') ? 'una **consulta a un profesional**' : '',
    ].filter(Boolean);
    return [
      `**Avisos por email**: cada aviso queda registrado en la colección \`outbox\` (bandeja de salida)${integrados.length ? `; el sitio avisa solo cuando entra ${integrados.join(', ')}` : ''}. El envío REAL es opcional: creá una cuenta gratis en [resend.com](https://resend.com), copiá tu \`RESEND_API_KEY\` al \`.env\` y los avisos salen por email (con el plan gratuito y sin dominio propio verificado, Resend entrega a la casilla del dueño de la cuenta usando el remitente \`onboarding@resend.dev\`). El destinatario sale de ${cfg.moduleIds.includes('negocio') ? 'la **ficha del negocio** (o de \`MAIL_TO\` en el \`.env\` si la ficha no tiene email)' : '\`MAIL_TO\` en el \`.env\`'}. ${cfg.moduleIds.includes('auth') ? 'La bandeja vive en \`/emails-admin.html\` (estados, reintento, email de prueba y CSV).' : 'Para ver la bandeja desde la web activá el módulo **Autenticación** (habilita \`/emails-admin.html\`).'}`,
    ];
  },
};
