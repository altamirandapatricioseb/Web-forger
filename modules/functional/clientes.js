// Ficha de clientes (CRM liviano) con backend real: la libreta de contactos que le faltaba al
// catálogo. Cada persona que pasa por el negocio tiene una ficha en la colección customers (nombre,
// email, teléfono, empresa, etiquetas) con un ESTADO de seguimiento (nuevo → contactado → cliente /
// perdido) y una BITÁCORA DE NOTAS con fecha y autor: "llamé y no atendió", "pidió presupuesto",
// "cerró". El servidor calcula los KPIs del embudo, ordena por último contacto y busca sin acentos
// ni mayúsculas sobre nombre, email, empresa y etiquetas. Además IMPORTA los contactos que el sitio
// ya venía juntando en otras colecciones (leads, suscriptores del newsletter, mensajes de contacto)
// sin duplicar por email: el negocio deja de tener su gente desparramada en cinco bandejas. Con el
// módulo de Avisos por email activo, se le puede escribir al cliente desde su propia ficha y el
// email queda registrado en la bitácora. Panel solo-admin en /clientes-admin.html con búsqueda,
// filtro, CSV y ficha desplegable. Animado con Anime.js (count-up de KPIs, aparición de la ficha) +
// red de seguridad. Distinto de "leads" (captura anónima de emails), "inbox" (mensajes recibidos) y
// "users-admin" (cuentas del sistema): acá se sigue la RELACIÓN comercial en el tiempo.

module.exports = {
  id: 'clientes', type: 'functional', name: 'Ficha de clientes (CRM)',
  description: 'La libreta de contactos del negocio con backend real: ficha por persona (nombre, email, teléfono, empresa, etiquetas), estado de seguimiento (nuevo / contactado / cliente / perdido) y bitácora de notas fechadas. El servidor calcula el embudo, ordena por último contacto y busca sin acentos. Importa sin duplicar los contactos que ya juntaron otros módulos (leads, newsletter, mensajes). Con Avisos por email podés escribirle desde la ficha y queda registrado. Panel solo-admin /clientes-admin.html con búsqueda, filtro y CSV. Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/clientes', file: 'routes/clientes.js' }],
  collections: ['customers'],
  nav: () => [{ label: 'Clientes', href: '/clientes-admin.html', id: 'nav-clientes-admin' }],
  head: () => `  <style>
    .cl-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:22px}
    .cl-kpis .card{text-align:center}
    .cl-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .cl-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--muted)}
    .cl-chip.cliente{background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent);border-color:transparent}
    .cl-chip.perdido{opacity:.65}
    .cl-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px}
    .cl-tag{font-size:.7rem;padding:1px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--line)}
    .cl-nota{padding:10px 0;border-bottom:1px solid var(--line)}
    .cl-nota:last-child{border-bottom:0}
    .cl-nota time{font-size:.76rem;color:var(--muted);display:block}
  </style>`,
  files: (cfg) => ({
    'routes/clientes.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, isEmail, oneOf } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');
${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
const ESTADOS = ['nuevo', 'contactado', 'cliente', 'perdido'];

// Búsqueda tolerante: sin acentos ni mayúsculas (misma convención que el buscador del sitio)
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');

// Etiquetas: se guardan como lista limpia a partir del texto separado por comas del panel
function etiquetas(v) {
  return String(v || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 8);
}

// Última señal de vida de la ficha: la nota más reciente o, si nunca hubo, el alta
const ultimoContacto = (c) => (c.notes && c.notes.length ? c.notes[c.notes.length - 1].at : c.createdAt);

const ESQUEMA = {
  name: (v) => str(v, 2, 90),
  email: (v) => v === '' || v === undefined || isEmail(v),
  phone: (v) => v === '' || v === undefined || str(v, 5, 40),
  company: (v) => v === '' || v === undefined || str(v, 2, 90),
  status: (v) => v === undefined || oneOf(v, ESTADOS),
};

function limpiar(body) {
  return {
    name: String(body.name).trim(),
    email: String(body.email || '').toLowerCase().trim(),
    phone: String(body.phone || '').trim(),
    company: String(body.company || '').trim(),
    status: ESTADOS.includes(body.status) ? body.status : 'nuevo',
    tags: etiquetas(body.tags),
  };
}

// GET /api/clientes/admin/stats — el embudo completo (solo admin)
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const rows = await db.all('customers');
  const stats = { total: rows.length, notas: rows.reduce((a, c) => a + ((c.notes || []).length), 0) };
  for (const e of ESTADOS) stats[e] = rows.filter(c => c.status === e).length;
  res.json(stats);
});

// GET /api/clientes/admin/list — fichas ordenadas por último contacto (solo admin).
// ?q= busca en nombre, email, empresa y etiquetas; ?status= filtra por estado.
router.get('/admin/list', requireAdmin, async (req, res) => {
  let rows = await db.all('customers');
  const q = fold(req.query.q);
  if (q) {
    rows = rows.filter(c => [c.name, c.email, c.company, (c.tags || []).join(' ')].some(v => fold(v).includes(q)));
  }
  if (ESTADOS.includes(req.query.status)) rows = rows.filter(c => c.status === req.query.status);
  rows = rows.map(c => ({ ...c, lastContact: ultimoContacto(c) }))
    .sort((a, b) => String(b.lastContact).localeCompare(String(a.lastContact)));
  res.json(rows.slice(0, 500));
});

// POST /api/clientes/admin — alta de una ficha (solo admin). Idempotente por email: si ya existe
// una ficha con ese email se actualiza, porque dos fichas de la misma persona es el peor bug de un CRM.
// En ese caso SOLO se pisan los campos que vinieron con algo: un alta rápida con el email suelto no
// puede borrar el teléfono y la empresa que ya estaban cargados (para vaciar un campo está el editar).
router.post('/admin', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, ESQUEMA);
  if (!ok) return res.status(422).json({ error: 'Revisá los datos de la ficha', errors });
  const datos = limpiar(req.body);
  if (datos.email) {
    const existente = (await db.find('customers', c => c.email === datos.email))[0];
    if (existente) {
      const patch = {};
      for (const [k, v] of Object.entries(datos)) {
        if (k === 'tags' ? v.length : v !== '') patch[k] = v;
      }
      return res.json({ ...(await db.update('customers', existente.id, patch)), merged: true });
    }
  }
  res.status(201).json(await db.insert('customers', { ...datos, notes: [] }));
});

// PUT /api/clientes/admin/:id — edita una ficha (solo admin)
router.put('/admin/:id', requireAdmin, async (req, res) => {
  const c = await db.get('customers', req.params.id);
  if (!c) return res.status(404).json({ error: 'Ficha inexistente' });
  const { ok, errors } = check(req.body, ESQUEMA);
  if (!ok) return res.status(422).json({ error: 'Revisá los datos de la ficha', errors });
  res.json(await db.update('customers', c.id, limpiar(req.body)));
});

// POST /api/clientes/admin/:id/nota — suma una nota fechada a la bitácora (solo admin).
// Puede venir con estado nuevo: registrar el contacto y mover el embudo es un solo gesto real.
router.post('/admin/:id/nota', requireAdmin, async (req, res) => {
  const c = await db.get('customers', req.params.id);
  if (!c) return res.status(404).json({ error: 'Ficha inexistente' });
  if (!str(req.body.text, 2, 600)) return res.status(422).json({ error: 'La nota va entre 2 y 600 caracteres' });
  const notes = (c.notes || []).concat([{
    at: new Date().toISOString(),
    text: String(req.body.text).trim(),
    by: req.user.name || 'admin',
  }]).slice(-200);
  const patch = { notes };
  if (ESTADOS.includes(req.body.status)) patch.status = req.body.status;
  res.status(201).json(await db.update('customers', c.id, patch));
});

// DELETE /api/clientes/admin/:id — borra una ficha con toda su bitácora (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const c = await db.get('customers', req.params.id);
  if (!c) return res.status(404).json({ error: 'Ficha inexistente' });
  await db.remove('customers', req.params.id);
  res.json({ ok: true });
});

// POST /api/clientes/admin/importar — trae los contactos que ya juntaron otros módulos del sitio
// sin duplicar por email (solo admin). Las fuentes dependen de los módulos activos al generar.
router.post('/admin/importar', requireAdmin, async (req, res) => {
  const fuentes = [
${cfg.moduleIds.includes('leads') ? `    { coleccion: 'leads', etiqueta: 'lead', nombre: (r) => r.name || String(r.email || '').split('@')[0] },
` : ''}${cfg.moduleIds.includes('newsletter') ? `    { coleccion: 'subscribers', etiqueta: 'newsletter', nombre: (r) => r.name || String(r.email || '').split('@')[0] },
` : ''}${cfg.moduleIds.includes('contact') ? `    { coleccion: 'messages', etiqueta: 'consulta', nombre: (r) => r.name || String(r.email || '').split('@')[0] },
` : ''}  ];
  if (!fuentes.length) return res.status(409).json({ error: 'No hay módulos de captación activos para importar' });
  const existentes = new Set((await db.all('customers')).map(c => c.email).filter(Boolean));
  let creados = 0;
  for (const f of fuentes) {
    for (const r of await db.all(f.coleccion)) {
      const email = String(r.email || '').toLowerCase().trim();
      if (!email || existentes.has(email)) continue;
      existentes.add(email);
      await db.insert('customers', {
        name: String(f.nombre(r) || email).slice(0, 90),
        email, phone: String(r.phone || '').slice(0, 40), company: '',
        status: 'nuevo', tags: [f.etiqueta], notes: [],
      });
      creados++;
    }
  }
  res.json({ ok: true, creados });
});
${cfg.moduleIds.includes('mailer') ? `
// POST /api/clientes/admin/:id/email — le escribe al cliente desde su ficha (solo admin).
// El envío queda registrado en la bitácora, así el historial no depende de la casilla del que escribió.
router.post('/admin/:id/email', requireAdmin, async (req, res) => {
  const c = await db.get('customers', req.params.id);
  if (!c) return res.status(404).json({ error: 'Ficha inexistente' });
  if (!c.email) return res.status(422).json({ error: 'Esta ficha no tiene email cargado' });
  if (!str(req.body.subject, 3, 120)) return res.status(422).json({ error: 'El asunto va entre 3 y 120 caracteres' });
  if (!str(req.body.text, 3, 3000)) return res.status(422).json({ error: 'El mensaje va entre 3 y 3000 caracteres' });
  const row = await mailer.notifyTo(c.email, String(req.body.subject).trim(), String(req.body.text).trim());
  const notes = (c.notes || []).concat([{
    at: new Date().toISOString(),
    text: 'Email enviado — ' + String(req.body.subject).trim(),
    by: req.user.name || 'admin',
  }]).slice(-200);
  res.status(201).json({ ...(await db.update('customers', c.id, { notes })), envio: row.status });
});
` : ''}
module.exports = router;
`,
  }),
  pages: (cfg) => ({
    'clientes-admin': {
      title: 'Clientes',
      html: `  <section>
    <div class="container" style="max-width:980px">
      <h2>Clientes</h2>
      <p class="section-sub">La libreta del negocio: quién es cada contacto, en qué punto está y todo lo que se habló con él. Solo visible para administradores.</p>
      <div class="cl-kpis" id="cla-kpis"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <input id="cla-q" placeholder="Buscar por nombre, email, empresa o etiqueta" style="flex:1;min-width:220px">
        <select id="cla-estado" style="width:auto">
          <option value="">Todos los estados</option>
          <option value="nuevo">Nuevos</option>
          <option value="contactado">Contactados</option>
          <option value="cliente">Clientes</option>
          <option value="perdido">Perdidos</option>
        </select>
        <button class="btn ghost" type="button" id="cla-csv">Descargar CSV</button>
${['leads', 'newsletter', 'contact'].some(m => cfg.moduleIds.includes(m)) ? `        <button class="btn ghost" type="button" id="cla-importar">Importar contactos del sitio</button>
` : ''}      </div>
      <form id="cla-form" class="card">
        <h3 style="margin-top:0" id="cla-titulo">Nueva ficha</h3>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Nombre</label><input name="name" required minlength="2" maxlength="90" placeholder="Nombre y apellido"></div>
          <div><label>Email</label><input name="email" type="email" maxlength="120" placeholder="opcional"></div>
        </div>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Teléfono</label><input name="phone" maxlength="40" placeholder="opcional"></div>
          <div><label>Empresa</label><input name="company" maxlength="90" placeholder="opcional"></div>
        </div>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Estado</label><select name="status">
            <option value="nuevo">Nuevo</option>
            <option value="contactado">Contactado</option>
            <option value="cliente">Cliente</option>
            <option value="perdido">Perdido</option>
          </select></div>
          <div><label>Etiquetas (separadas por coma)</label><input name="tags" maxlength="160" placeholder="mayorista, zona norte"></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
          <button class="btn" type="submit" id="cla-guardar">Agregar ficha</button>
          <button class="btn ghost" type="button" id="cla-cancelar" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="cla-ficha" style="margin-top:26px"></div>
      <div id="cla-list" style="margin-top:26px"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  clientJs: (cfg) => `/* Módulo ficha de clientes: panel solo-admin en /clientes-admin.html con el embudo, la búsqueda
   servida por el backend y la bitácora de notas por ficha. Animado con Anime.js (count-up de KPIs,
   aparición de la ficha desplegable) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  // Oculta el link admin de la navbar para quien no es admin (en TODAS las páginas)
  var navCl = document.getElementById('nav-clientes-admin');
  if (navCl && (!me || me.role !== 'admin') && !window.__PREVIEW__) navCl.style.display = 'none';

  var kpisCl = document.getElementById('cla-kpis');
  if (!kpisCl) return;
  var formCl = document.getElementById('cla-form');
  var listCl = document.getElementById('cla-list');
  var fichaBox = document.getElementById('cla-ficha');
  var buscar = document.getElementById('cla-q');
  var filtroEstado = document.getElementById('cla-estado');
  var cancelar = document.getElementById('cla-cancelar');
  var CAMPOS = ['name', 'email', 'phone', 'company', 'tags'];
  var lista = [], editando = null, abierta = null, debounce = null;

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
    kpisCl.innerHTML = '<div class="card"><strong id="cla-k-tot">0</strong><span class="muted">fichas</span></div>' +
      '<div class="card"><strong id="cla-k-nue">0</strong><span class="muted">nuevos</span></div>' +
      '<div class="card"><strong id="cla-k-con">0</strong><span class="muted">contactados</span></div>' +
      '<div class="card"><strong id="cla-k-cli">0</strong><span class="muted">clientes</span></div>' +
      '<div class="card"><strong id="cla-k-not">0</strong><span class="muted">notas registradas</span></div>';
    contar(document.getElementById('cla-k-tot'), s.total);
    contar(document.getElementById('cla-k-nue'), s.nuevo);
    contar(document.getElementById('cla-k-con'), s.contactado);
    contar(document.getElementById('cla-k-cli'), s.cliente);
    contar(document.getElementById('cla-k-not'), s.notas);
  }

  function fecha(iso) { return iso ? new Date(iso).toLocaleDateString('es-AR') : '—'; }

  function pintarLista() {
    listCl.innerHTML = App.table(lista, [
      { label: 'Contacto', render: function (r) {
        return '<strong>' + App.esc(r.name) + '</strong>' +
          (r.company ? '<br><span class="muted" style="font-size:.82rem">' + App.esc(r.company) + '</span>' : '') +
          ((r.tags || []).length ? '<div class="cl-tags">' + r.tags.map(function (t) { return '<span class="cl-tag">' + App.esc(t) + '</span>'; }).join('') + '</div>' : '');
      } },
      { label: 'Datos', render: function (r) {
        return (r.email ? App.esc(r.email) : '<span class="muted">sin email</span>') +
          (r.phone ? '<br><span class="muted" style="font-size:.82rem">' + App.esc(r.phone) + '</span>' : '');
      } },
      { label: 'Estado', render: function (r) { return '<span class="cl-chip ' + r.status + '">' + r.status + '</span>'; } },
      { label: 'Último contacto', render: function (r) {
        return fecha(r.lastContact) + '<br><span class="muted" style="font-size:.82rem">' + ((r.notes || []).length) + ' notas</span>';
      } },
      { label: 'Acciones', render: function (r) {
        return '<button class="btn ghost" type="button" data-ficha="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Ficha</button>' +
          '<button class="btn ghost" type="button" data-edit="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
          '<button class="btn ghost" type="button" data-del="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
      } },
    ]);
    listCl.querySelectorAll('[data-ficha]').forEach(function (b) { b.addEventListener('click', function () { verFicha(b.getAttribute('data-ficha')); }); });
    listCl.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
    listCl.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
  }

  // ---- Ficha desplegable con la bitácora ----
  function verFicha(id) {
    var r = lista.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    if (abierta === id) { abierta = null; fichaBox.innerHTML = ''; return; }
    abierta = id;
    var notas = (r.notes || []).slice().reverse();
    fichaBox.innerHTML = '<div class="card"><h3 style="margin-top:0">' + App.esc(r.name) + '</h3>' +
      '<p class="muted" style="margin-top:0">' + App.esc([r.company, r.email, r.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto') + '</p>' +
      '<form id="cla-nota"><label>Nueva nota de seguimiento</label>' +
      '<textarea name="text" rows="2" required maxlength="600" placeholder="Qué pasó en este contacto"></textarea>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center">' +
      '<select name="status" style="width:auto"><option value="">Dejar el estado como está</option>' +
      '<option value="nuevo">Pasar a nuevo</option><option value="contactado">Pasar a contactado</option>' +
      '<option value="cliente">Pasar a cliente</option><option value="perdido">Pasar a perdido</option></select>' +
      '<button class="btn" type="submit">Guardar nota</button></div></form>' +
${cfg.moduleIds.includes('mailer') ? `      (r.email ? '<form id="cla-email" style="margin-top:18px;padding-top:18px;border-top:1px solid var(--line)">' +
        '<label>Escribirle a ' + App.esc(r.email) + '</label>' +
        '<input name="subject" maxlength="120" placeholder="Asunto" required>' +
        '<textarea name="text" rows="3" maxlength="3000" placeholder="Tu mensaje" required></textarea>' +
        '<button class="btn ghost" type="submit" style="margin-top:12px">Enviar email</button></form>' : '') +
` : ''}      '<h4 style="margin:22px 0 4px">Bitácora</h4>' +
      (notas.length ? notas.map(function (n) {
        return '<div class="cl-nota"><time>' + new Date(n.at).toLocaleString('es-AR') + ' · ' + App.esc(n.by || 'admin') + '</time>' + App.esc(n.text) + '</div>';
      }).join('') : '<p class="muted">Todavía no hay notas de seguimiento.</p>') +
      '</div>';

    var formNota = document.getElementById('cla-nota');
    formNota.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se guardaría la nota'); return; }
      try {
        await App.api('/api/clientes/admin/' + id + '/nota', { method: 'POST', body: {
          text: formNota.querySelector('[name="text"]').value,
          status: formNota.querySelector('[name="status"]').value || undefined,
        } });
        App.toast('Nota guardada');
        abierta = null;
        await cargar();
        verFicha(id);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });
${cfg.moduleIds.includes('mailer') ? `
    var formEmail = document.getElementById('cla-email');
    if (formEmail) formEmail.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se le escribiría al cliente'); return; }
      try {
        var r2 = await App.api('/api/clientes/admin/' + id + '/email', { method: 'POST', body: {
          subject: formEmail.querySelector('[name="subject"]').value,
          text: formEmail.querySelector('[name="text"]').value,
        } });
        App.toast(r2.envio === 'enviado' ? 'Email enviado y anotado en la bitácora' : 'Email registrado en la bandeja de salida');
        abierta = null;
        await cargar();
        verFicha(id);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });
` : ''}
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(fichaBox, { opacity: [0, 1], translateY: [10, 0], duration: 400, ease: 'outCubic' });
      // Red de seguridad: deja la ficha visible aunque el loop esté pausado (pestaña oculta)
      setTimeout(function () { fichaBox.style.opacity = 1; fichaBox.style.transform = 'none'; }, 750);
    }
  }

  function datosForm() {
    var d = {};
    CAMPOS.forEach(function (k) { d[k] = formCl.querySelector('[name="' + k + '"]').value.trim(); });
    d.status = formCl.querySelector('[name="status"]').value;
    return d;
  }

  function resetForm() {
    editando = null;
    formCl.reset();
    document.getElementById('cla-titulo').textContent = 'Nueva ficha';
    document.getElementById('cla-guardar').textContent = 'Agregar ficha';
    cancelar.hidden = true;
  }

  function editar(id) {
    var r = lista.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    editando = id;
    CAMPOS.forEach(function (k) {
      formCl.querySelector('[name="' + k + '"]').value = k === 'tags' ? (r.tags || []).join(', ') : (r[k] || '');
    });
    formCl.querySelector('[name="status"]').value = r.status || 'nuevo';
    document.getElementById('cla-titulo').textContent = 'Editando: ' + r.name;
    document.getElementById('cla-guardar').textContent = 'Guardar cambios';
    cancelar.hidden = false;
    formCl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }

  cancelar.addEventListener('click', resetForm);

  formCl.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se guardaría la ficha'); return; }
    try {
      var r;
      if (editando) r = await App.api('/api/clientes/admin/' + editando, { method: 'PUT', body: datosForm() });
      else r = await App.api('/api/clientes/admin', { method: 'POST', body: datosForm() });
      App.toast(r && r.merged ? 'Ya existía una ficha con ese email: se actualizó' : (editando ? 'Ficha actualizada' : 'Ficha agregada'));
      resetForm();
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  async function borrar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se borraría la ficha'); return; }
    if (!confirm('¿Borrar esta ficha con toda su bitácora?')) return;
    try {
      await App.api('/api/clientes/admin/' + id, { method: 'DELETE' });
      if (editando === id) resetForm();
      if (abierta === id) { abierta = null; fichaBox.innerHTML = ''; }
      App.toast('Ficha borrada');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  function query() {
    var p = [];
    if (buscar.value.trim()) p.push('q=' + encodeURIComponent(buscar.value.trim()));
    if (filtroEstado.value) p.push('status=' + filtroEstado.value);
    return p.length ? '?' + p.join('&') : '';
  }

  function cargar() {
    App.api('/api/clientes/admin/stats').then(pintarStats).catch(function (err) { kpisCl.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    return App.api('/api/clientes/admin/list' + query()).then(function (rows) { lista = rows; pintarLista(); }).catch(function () {});
  }

  // La búsqueda la resuelve el servidor; el debounce evita un pedido por tecla
  buscar.addEventListener('input', function () {
    if (window.__PREVIEW__) return;
    clearTimeout(debounce);
    debounce = setTimeout(cargar, 280);
  });
  filtroEstado.addEventListener('change', function () { if (!window.__PREVIEW__) cargar(); });

  var csvCl = document.getElementById('cla-csv');
  if (csvCl) csvCl.addEventListener('click', function () {
    var filas = [['nombre', 'email', 'telefono', 'empresa', 'estado', 'etiquetas', 'notas', 'ultimo_contacto']]
      .concat(lista.map(function (r) { return [r.name, r.email || '', r.phone || '', r.company || '', r.status, (r.tags || []).join(' '), (r.notes || []).length, r.lastContact || '']; }));
    var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'clientes.csv';
    a.click();
  });

  var impCl = document.getElementById('cla-importar');
  if (impCl) impCl.addEventListener('click', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se importarían los contactos del sitio'); return; }
    if (!confirm('¿Traer a la libreta los contactos que ya juntaron los otros módulos? No se duplica nada por email.')) return;
    try {
      var r = await App.api('/api/clientes/admin/importar', { method: 'POST' });
      App.toast(r.creados ? 'Se importaron ' + r.creados + ' contactos nuevos' : 'No había contactos nuevos para importar');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  if (window.__PREVIEW__) {
    pintarStats({ total: 3, nuevo: 1, contactado: 1, cliente: 1, perdido: 0, notas: 4 });
    lista = [
      { id: 'd1', name: 'Ana López', email: 'ana@mail.com', phone: '11 5555-1234', company: 'Distribuidora Sur', status: 'cliente', tags: ['mayorista'], notes: [{ at: new Date().toISOString(), text: 'Cerró la compra de septiembre.', by: 'admin' }], lastContact: new Date().toISOString() },
      { id: 'd2', name: 'Luis Gómez', email: 'luis@mail.com', phone: '', company: '', status: 'contactado', tags: ['zona norte'], notes: [], lastContact: new Date().toISOString() },
      { id: 'd3', name: 'Marta Ruiz', email: 'marta@mail.com', phone: '', company: 'Kiosco Central', status: 'nuevo', tags: [], notes: [], lastContact: new Date().toISOString() },
    ];
    pintarLista();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargar();
  }
})();`,
  readmeNotes: (cfg) => {
    const fuentes = [
      cfg.moduleIds.includes('leads') ? 'los **leads**' : '',
      cfg.moduleIds.includes('newsletter') ? 'los **suscriptores del newsletter**' : '',
      cfg.moduleIds.includes('contact') ? 'los **mensajes de contacto**' : '',
    ].filter(Boolean);
    return [
      `**Ficha de clientes (CRM)**: las fichas viven en la colección \`customers\` con su estado de seguimiento (\`nuevo\` → \`contactado\` → \`cliente\` / \`perdido\`) y una **bitácora de notas fechadas y firmadas**. El panel \`/clientes-admin.html\` (solo admin) tiene el embudo en KPIs, búsqueda **resuelta en el servidor** (sin acentos ni mayúsculas, sobre nombre, email, empresa y etiquetas), filtro por estado y CSV. El alta es **idempotente por email**: cargar dos veces a la misma persona actualiza su ficha en lugar de duplicarla.${fuentes.length ? ` El botón **Importar contactos del sitio** trae ${fuentes.join(', ')} sin pisar ni duplicar nada.` : ''}${cfg.moduleIds.includes('mailer') ? ' Con **Avisos por email** activo podés escribirle al cliente desde su propia ficha: el email sale por la bandeja de salida y queda anotado en la bitácora.' : ''}`,
    ];
  },
};
