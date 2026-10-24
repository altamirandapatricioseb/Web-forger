// Formularios a medida con backend real: el pedido que ningún catálogo fijo puede cubrir — "necesito
// un formulario de inscripción con estos seis campos" — resuelto sin tocar código. El admin arma el
// formulario en /formularios-admin.html (título, descripción y la lista de campos: texto, párrafo,
// email, teléfono, número, fecha, selección con opciones y sí/no), lo publica y queda vivo en
// /formularios.html?f=<slug>. La clave está en el servidor: la DEFINICIÓN de los campos es el dato, y
// POST /api/formularios/:slug valida cada respuesta CONTRA ESA DEFINICIÓN (obligatorios, tipo, largo
// y opciones permitidas) antes de guardarla — nunca se confía en el HTML que mandó el navegador, que
// cualquiera puede editar. Las respuestas caen en una bandeja por formulario con CSV, y si el módulo
// de Avisos por email está activo el negocio se entera de cada una sin entrar al panel. Trae un campo
// trampa (honeypot) invisible que descarta los bots sin molestar a nadie con un captcha. Animado con
// Anime.js (count-up de KPIs, aparición del formulario y del acuse) + red de seguridad. Distinto de
// "contact" (formulario de contacto fijo), "multistep" (formulario UI de varios pasos) y "polls"
// (encuestas de opción múltiple): acá el negocio DEFINE sus propios formularios cuando los necesita.

// Formulario de ejemplo: muestra los ocho tipos de campo funcionando de entrada
const SEMILLA = [{
  title: 'Inscripción a la próxima capacitación',
  slug: 'inscripcion',
  description: 'Completá tus datos y te reservamos un lugar. Te confirmamos por email unos días antes.',
  published: true,
  entries: 0,
  fields: [
    { name: 'nombre', label: 'Nombre y apellido', type: 'texto', required: true, options: [] },
    { name: 'email', label: 'Email', type: 'email', required: true, options: [] },
    { name: 'telefono', label: 'Teléfono', type: 'telefono', required: false, options: [] },
    { name: 'turno', label: 'Turno que preferís', type: 'seleccion', required: true, options: ['Mañana', 'Tarde', 'Noche'] },
    { name: 'personas', label: '¿Cuántas personas van?', type: 'numero', required: false, options: [] },
    { name: 'fecha', label: 'Fecha que te queda mejor', type: 'fecha', required: false, options: [] },
    { name: 'comentario', label: 'Algo que quieras contarnos', type: 'parrafo', required: false, options: [] },
    { name: 'factura', label: 'Necesito factura', type: 'sino', required: false, options: [] },
  ],
}];

module.exports = {
  id: 'formularios', type: 'functional', name: 'Formularios a medida',
  description: 'El negocio arma sus propios formularios desde el panel (título, descripción y campos: texto, párrafo, email, teléfono, número, fecha, selección con opciones y sí/no), los publica en /formularios.html?f=<slug> y recibe las respuestas en una bandeja con CSV. La definición de los campos es el dato: el servidor valida cada respuesta contra ella (obligatorios, tipo, largo y opciones), nunca contra el HTML del navegador. Campo trampa anti-bots sin captcha. Con Avisos por email, cada respuesta avisa al negocio. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/formularios', file: 'routes/formularios.js' }],
  collections: ['forms', 'formentries'],
  nav: (cfg) => [
    { label: 'Formularios', href: '/formularios.html' },
    ...(cfg.moduleIds.includes('auth') ? [{ label: 'Formularios (admin)', href: '/formularios-admin.html', id: 'nav-forms-admin' }] : []),
  ],
  head: () => `  <style>
    .fm-trampa{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
    .fm-ok{border-left:3px solid var(--accent);padding:16px 20px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0;margin-top:18px}
    .fm-indice{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
    .fm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .fm-kpis .card{text-align:center}
    .fm-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .fm-campo{display:grid;grid-template-columns:1fr 150px auto auto;gap:8px;align-items:center;margin-bottom:8px}
    .fm-campo input,.fm-campo select{margin:0}
    .fm-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--muted)}
    .fm-chip.publicado{background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent);border-color:transparent}
    @media (max-width:640px){.fm-campo{grid-template-columns:1fr 1fr}}
  </style>`,
  files: (cfg) => ({
    'routes/formularios.js': `const router = require('express').Router();
const db = require('../src/db');
const { str, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
db.seedIfEmpty('forms', ${JSON.stringify(SEMILLA, null, 2)});

const TIPOS = ['texto', 'parrafo', 'email', 'telefono', 'numero', 'fecha', 'seleccion', 'sino'];
const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;

// Nombre técnico de un campo a partir de su etiqueta (sin acentos, sin espacios).
// Es la clave con la que viaja la respuesta: por eso se calcula acá y no la manda el navegador.
function nombreCampo(label, usados) {
  let base = String(label || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '').slice(0, 40) || 'campo';
  let n = base, i = 2;
  while (usados.has(n)) { n = base + '_' + i; i++; }
  usados.add(n);
  return n;
}

// Slug único del formulario: es la parte visible de su URL pública
async function slugUnico(title, exceptoId) {
  let base = String(title || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50) || 'formulario';
  const todos = await db.all('forms');
  let s = base, i = 2;
  while (todos.some(f => f.slug === s && f.id !== exceptoId)) { s = base + '-' + i; i++; }
  return s;
}

// Normaliza la lista de campos que llega del panel: descarta lo inválido en vez de guardarlo roto
function normalizarCampos(lista) {
  const usados = new Set();
  return (Array.isArray(lista) ? lista : []).slice(0, 20).map(c => {
    const label = String(c.label || '').trim();
    if (!str(label, 2, 80)) return null;
    const type = TIPOS.includes(c.type) ? c.type : 'texto';
    const options = type === 'seleccion'
      ? String(c.options || '').split(',').map(o => o.trim()).filter(Boolean).slice(0, 20)
      : [];
    if (type === 'seleccion' && !options.length) return null;
    return { name: nombreCampo(label, usados), label, type, required: !!c.required, options };
  }).filter(Boolean);
}

// Vista pública de un formulario: solo lo que el visitante necesita para completarlo
const publico = (f) => ({ slug: f.slug, title: f.title, description: f.description || '', fields: f.fields || [] });

/**
 * Valida una respuesta CONTRA LA DEFINICIÓN GUARDADA del formulario. El HTML que se le mostró al
 * visitante no es una garantía de nada (cualquiera lo edita antes de mandar), así que los
 * obligatorios, los tipos, los largos y las opciones permitidas se revisan de nuevo acá.
 */
function validarRespuesta(form, body) {
  const datos = {}, errores = {};
  for (const c of form.fields || []) {
    const bruto = body ? body[c.name] : undefined;
    const vacio = bruto === undefined || bruto === null || String(bruto).trim() === '';
    if (c.type === 'sino') { datos[c.name] = bruto === true || bruto === 'true'; continue; }
    if (vacio) {
      if (c.required) errores[c.name] = 'Falta completar "' + c.label + '"';
      else datos[c.name] = '';
      continue;
    }
    const v = String(bruto).trim();
    if (c.type === 'email' && !isEmail(v)) errores[c.name] = '"' + c.label + '": revisá el email';
    else if (c.type === 'numero' && !isFinite(Number(v))) errores[c.name] = '"' + c.label + '": tiene que ser un número';
    else if (c.type === 'fecha' && (!FECHA.test(v) || isNaN(Date.parse(v + 'T00:00:00Z')))) errores[c.name] = '"' + c.label + '": fecha inválida';
    else if (c.type === 'seleccion' && !c.options.includes(v)) errores[c.name] = '"' + c.label + '": opción no válida';
    else if (!str(v, 1, c.type === 'parrafo' ? 2000 : 200)) errores[c.name] = '"' + c.label + '": texto demasiado largo';
    else datos[c.name] = v;
  }
  return { ok: Object.keys(errores).length === 0, errores, datos };
}

// GET /api/formularios — formularios publicados (público, para el índice de la página)
router.get('/', async (req, res) => {
  const rows = (await db.all('forms')).filter(f => f.published);
  res.json(rows.map(f => ({ slug: f.slug, title: f.title, description: f.description || '', campos: (f.fields || []).length })));
});

${cfg.moduleIds.includes('auth') ? `
// GET /api/formularios/admin/stats — resumen de formularios y respuestas (solo admin)
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const forms = await db.all('forms');
  const entries = await db.all('formentries');
  const hoy = new Date().toISOString().slice(0, 10);
  res.json({
    total: forms.length,
    publicados: forms.filter(f => f.published).length,
    respuestas: entries.length,
    hoy: entries.filter(e => String(e.createdAt).slice(0, 10) === hoy).length,
  });
});

// GET /api/formularios/admin/list — todos los formularios con su conteo real (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  const entries = await db.all('formentries');
  const rows = (await db.all('forms')).map(f => ({
    ...f, entries: entries.filter(e => e.formSlug === f.slug).length,
  }));
  res.json(rows.reverse());
});

// GET /api/formularios/admin/:slug/respuestas — bandeja de un formulario (solo admin)
router.get('/admin/:slug/respuestas', requireAdmin, async (req, res) => {
  const f = (await db.find('forms', x => x.slug === req.params.slug))[0];
  if (!f) return res.status(404).json({ error: 'Formulario inexistente' });
  const rows = (await db.find('formentries', e => e.formSlug === f.slug)).slice(-300).reverse();
  res.json({ form: publico(f), entries: rows });
});

// POST /api/formularios/admin — crea un formulario (solo admin)
router.post('/admin', requireAdmin, async (req, res) => {
  if (!str(req.body.title, 3, 90)) return res.status(422).json({ error: 'El título va entre 3 y 90 caracteres' });
  const fields = normalizarCampos(req.body.fields);
  if (!fields.length) return res.status(422).json({ error: 'Cargá al menos un campo válido (las selecciones necesitan opciones)' });
  const f = await db.insert('forms', {
    title: String(req.body.title).trim(),
    slug: await slugUnico(req.body.title),
    description: String(req.body.description || '').trim().slice(0, 300),
    published: req.body.published !== false,
    fields, entries: 0,
  });
  res.status(201).json(f);
});

// PUT /api/formularios/admin/:id — edita un formulario (solo admin).
// El slug NO cambia al editar: si cambiara, se romperían los links ya repartidos y las respuestas
// viejas quedarían huérfanas.
router.put('/admin/:id', requireAdmin, async (req, res) => {
  const f = await db.get('forms', req.params.id);
  if (!f) return res.status(404).json({ error: 'Formulario inexistente' });
  if (!str(req.body.title, 3, 90)) return res.status(422).json({ error: 'El título va entre 3 y 90 caracteres' });
  const fields = normalizarCampos(req.body.fields);
  if (!fields.length) return res.status(422).json({ error: 'Cargá al menos un campo válido (las selecciones necesitan opciones)' });
  res.json(await db.update('forms', f.id, {
    title: String(req.body.title).trim(),
    description: String(req.body.description || '').trim().slice(0, 300),
    published: req.body.published !== false,
    fields,
  }));
});

// DELETE /api/formularios/admin/:id — borra el formulario y todas sus respuestas (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const f = await db.get('forms', req.params.id);
  if (!f) return res.status(404).json({ error: 'Formulario inexistente' });
  for (const e of await db.find('formentries', x => x.formSlug === f.slug)) await db.remove('formentries', e.id);
  await db.remove('forms', f.id);
  res.json({ ok: true });
});
` : `// El constructor de formularios requiere el módulo de autenticación: activalo en el Builder para
// habilitar /formularios-admin.html. Sin él, el formulario sembrado igual funciona y las respuestas
// se guardan en data/formentries.json.
`}
// Las rutas con :slug van AL FINAL a propósito: declaradas antes, "/:slug" se tragaría
// "POST /admin" (slug = "admin") y el alta de formularios nunca llegaría a su handler.

// GET /api/formularios/:slug — definición de un formulario publicado (público)
router.get('/:slug', async (req, res) => {
  const f = (await db.find('forms', x => x.slug === req.params.slug))[0];
  if (!f || !f.published) return res.status(404).json({ error: 'Ese formulario no existe o no está publicado' });
  res.json(publico(f));
});

// POST /api/formularios/:slug — recibe una respuesta (público)
router.post('/:slug', async (req, res) => {
  const f = (await db.find('forms', x => x.slug === req.params.slug))[0];
  if (!f || !f.published) return res.status(404).json({ error: 'Ese formulario no existe o no está publicado' });
  // Campo trampa: es invisible para las personas, así que si viene lleno es un bot. Se responde
  // ok igual (que no sepa que lo detectamos) pero no se guarda nada.
  if (String((req.body || {})._website || '').trim()) return res.status(201).json({ ok: true });
  const { ok, errores, datos } = validarRespuesta(f, req.body);
  if (!ok) return res.status(422).json({ error: Object.values(errores)[0], errors: errores });
  await db.insert('formentries', { formSlug: f.slug, formTitle: f.title, data: datos });
  await db.update('forms', f.id, { entries: (f.entries || 0) + 1 });
${cfg.moduleIds.includes('mailer') ? `  // Aviso por email al negocio (módulo Avisos por email). Es "disparar y seguir": un email
  // caído jamás rompe la respuesta que ya se guardó.
  const resumen = (f.fields || []).map(c => c.label + ': ' + (c.type === 'sino' ? (datos[c.name] ? 'sí' : 'no') : (datos[c.name] || '—'))).join('\\n');
  mailer.notify('Nueva respuesta: ' + f.title, 'Entró una respuesta al formulario "' + f.title + '".\\n\\n' + resumen).catch(() => {});
` : ''}  res.status(201).json({ ok: true });
});

module.exports = router;
`,
  }),
  pages: (cfg) => ({
    formularios: {
      title: 'Formularios',
      html: `  <section>
    <div class="container" style="max-width:720px">
      <div id="fm-indice-box">
        <h2>Formularios</h2>
        <p class="section-sub">Elegí el formulario que querés completar.</p>
        <div class="fm-indice" id="fm-indice"><p class="muted">Cargando…</p></div>
      </div>
      <div id="fm-uno" hidden>
        <h2 id="fm-titulo">—</h2>
        <p class="section-sub" id="fm-desc"></p>
        <form id="fm-form" class="card" style="position:relative">
          <div id="fm-campos"></div>
          <div class="fm-trampa" aria-hidden="true"><label>No completes este campo<input name="_website" tabindex="-1" autocomplete="off"></label></div>
          <button class="btn" type="submit" style="margin-top:18px">Enviar</button>
        </form>
        <div class="fm-ok" id="fm-ok" hidden></div>
        <p class="muted" style="font-size:.85rem;margin-top:18px"><a href="/formularios.html">Ver todos los formularios</a></p>
      </div>
      <noscript><p class="muted">Activá JavaScript para completar los formularios.</p></noscript>
    </div>
  </section>`,
    },
    ...(cfg.moduleIds.includes('auth') ? {
      'formularios-admin': {
        title: 'Formularios',
        html: `  <section>
    <div class="container" style="max-width:960px">
      <h2>Formularios a medida</h2>
      <p class="section-sub">Armá el formulario que necesites, publicalo y recibí las respuestas acá. Solo visible para administradores.</p>
      <div class="fm-kpis" id="fma-kpis"></div>
      <form id="fma-form" class="card">
        <h3 style="margin-top:0" id="fma-titulo">Nuevo formulario</h3>
        <label>Título</label>
        <input name="title" required minlength="3" maxlength="90" placeholder="Inscripción a la capacitación">
        <label>Descripción (opcional)</label>
        <textarea name="description" rows="2" maxlength="300" placeholder="Qué le explicás a quien lo completa"></textarea>
        <h4 style="margin:22px 0 10px">Campos</h4>
        <div id="fma-campos"></div>
        <button class="btn ghost" type="button" id="fma-agregar" style="margin-top:6px">Agregar campo</button>
        <label style="display:flex;align-items:center;gap:8px;margin-top:16px"><input type="checkbox" name="published" checked style="width:auto"> Publicado</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
          <button class="btn" type="submit" id="fma-guardar">Crear formulario</button>
          <button class="btn ghost" type="button" id="fma-cancelar" hidden>Cancelar edición</button>
        </div>
      </form>
      <div id="fma-list" style="margin-top:26px"><p class="muted">Cargando…</p></div>
      <div id="fma-respuestas" style="margin-top:26px"></div>
    </div>
  </section>`,
      },
    } : {}),
  }),
  clientJs: (cfg) => `/* Módulo formularios a medida: página pública que arma el formulario a partir de su definición
   (/formularios.html?f=<slug>) y, con auth, constructor + bandeja en /formularios-admin.html.
   Animado con Anime.js (aparición del formulario, acuse, count-up) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function aparecer(el, y) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) return;
    anime.animate(el, { opacity: [0, 1], translateY: [y || 12, 0], duration: 430, ease: 'outCubic' });
    // Red de seguridad: deja el bloque visible aunque el loop esté pausado (pestaña oculta)
    setTimeout(function () { el.style.opacity = 1; el.style.transform = 'none'; }, 800);
  }

  // Un campo de la definición → su HTML. Es la misma lista de tipos que valida el servidor.
  function campoHtml(c) {
    var req = c.required ? ' required' : '';
    var id = 'fmc-' + c.name;
    var control;
    if (c.type === 'parrafo') control = '<textarea id="' + id + '" name="' + c.name + '" rows="3" maxlength="2000"' + req + '></textarea>';
    else if (c.type === 'seleccion') control = '<select id="' + id + '" name="' + c.name + '"' + req + '><option value="">Elegí una opción</option>' +
      c.options.map(function (o) { return '<option value="' + App.esc(o) + '">' + App.esc(o) + '</option>'; }).join('') + '</select>';
    else if (c.type === 'sino') return '<label style="display:flex;align-items:center;gap:8px;margin-top:12px">' +
      '<input type="checkbox" id="' + id + '" name="' + c.name + '" style="width:auto"> ' + App.esc(c.label) + '</label>';
    else {
      var tipo = c.type === 'email' ? 'email' : c.type === 'telefono' ? 'tel' : c.type === 'numero' ? 'number' : c.type === 'fecha' ? 'date' : 'text';
      control = '<input id="' + id + '" type="' + tipo + '" name="' + c.name + '" maxlength="200"' + req + '>';
    }
    return '<label for="' + id + '">' + App.esc(c.label) + (c.required ? ' *' : '') + '</label>' + control;
  }

  // ---- Página pública /formularios.html ----
  var indiceBox = document.getElementById('fm-indice');
  if (indiceBox) {
    var unoBox = document.getElementById('fm-uno');
    var indiceWrap = document.getElementById('fm-indice-box');
    var formPub = document.getElementById('fm-form');
    var camposBox = document.getElementById('fm-campos');
    var okBox = document.getElementById('fm-ok');
    var slug = new URLSearchParams(location.search).get('f') || '';
    var definicion = null;

    function pintarIndice(rows) {
      if (!rows.length) { indiceBox.innerHTML = '<p class="muted">Todavía no hay formularios publicados.</p>'; return; }
      indiceBox.innerHTML = rows.map(function (f) {
        return '<a class="card" href="/formularios.html?f=' + encodeURIComponent(f.slug) + '" style="text-decoration:none;display:block">' +
          '<h3 style="margin:0 0 6px">' + App.esc(f.title) + '</h3>' +
          '<p class="muted" style="margin:0">' + App.esc(f.description || (f.campos + ' campos para completar')) + '</p></a>';
      }).join('');
      aparecer(indiceBox);
    }

    function pintarUno(f) {
      definicion = f;
      indiceWrap.hidden = true;
      unoBox.hidden = false;
      document.getElementById('fm-titulo').textContent = f.title;
      document.getElementById('fm-desc').textContent = f.description || '';
      camposBox.innerHTML = f.fields.map(campoHtml).join('');
      aparecer(unoBox);
    }

    if (formPub) formPub.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se enviaría la respuesta'); return; }
      if (!definicion) return;
      var cuerpo = { _website: formPub.querySelector('[name="_website"]').value };
      definicion.fields.forEach(function (c) {
        var el = formPub.querySelector('[name="' + c.name + '"]');
        if (!el) return;
        cuerpo[c.name] = c.type === 'sino' ? el.checked : el.value;
      });
      try {
        await App.api('/api/formularios/' + encodeURIComponent(definicion.slug), { method: 'POST', body: cuerpo });
        formPub.hidden = true;
        okBox.hidden = false;
        okBox.innerHTML = '<strong>¡Gracias!</strong> Recibimos tu respuesta a "' + App.esc(definicion.title) + '". Te vamos a contactar a la brevedad.';
        aparecer(okBox);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (window.__PREVIEW__) {
      pintarIndice([{ slug: 'inscripcion', title: 'Inscripción a la próxima capacitación', description: 'Completá tus datos y te reservamos un lugar.', campos: 8 }]);
    } else if (slug) {
      fetch('/api/formularios/' + encodeURIComponent(slug)).then(function (r) { return r.json(); })
        .then(function (f) { if (f && f.fields) pintarUno(f); else indiceBox.innerHTML = '<p class="muted">' + App.esc(f.error || 'Formulario no encontrado') + '</p>'; })
        .catch(function () { indiceBox.innerHTML = '<p class="muted">No se pudo cargar el formulario.</p>'; });
    } else {
      fetch('/api/formularios').then(function (r) { return r.json(); })
        .then(function (rows) { if (Array.isArray(rows)) pintarIndice(rows); })
        .catch(function () { indiceBox.innerHTML = '<p class="muted">No se pudieron cargar los formularios.</p>'; });
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /formularios-admin.html ----
  var kpisFm = document.getElementById('fma-kpis');
  if (kpisFm) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var formFm = document.getElementById('fma-form');
    var camposFm = document.getElementById('fma-campos');
    var listFm = document.getElementById('fma-list');
    var respBox = document.getElementById('fma-respuestas');
    var cancelarFm = document.getElementById('fma-cancelar');
    var TIPOS = [['texto', 'Texto corto'], ['parrafo', 'Párrafo'], ['email', 'Email'], ['telefono', 'Teléfono'],
      ['numero', 'Número'], ['fecha', 'Fecha'], ['seleccion', 'Selección'], ['sino', 'Sí / No']];
    var lista = [], editando = null, abierto = null, respuestasActuales = null;

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
      kpisFm.innerHTML = '<div class="card"><strong id="fma-k-tot">0</strong><span class="muted">formularios</span></div>' +
        '<div class="card"><strong id="fma-k-pub">0</strong><span class="muted">publicados</span></div>' +
        '<div class="card"><strong id="fma-k-res">0</strong><span class="muted">respuestas</span></div>' +
        '<div class="card"><strong id="fma-k-hoy">0</strong><span class="muted">respuestas hoy</span></div>';
      contar(document.getElementById('fma-k-tot'), s.total);
      contar(document.getElementById('fma-k-pub'), s.publicados);
      contar(document.getElementById('fma-k-res'), s.respuestas);
      contar(document.getElementById('fma-k-hoy'), s.hoy);
    }

    // ---- Editor de campos: filas que se agregan y se sacan ----
    function filaCampo(c) {
      c = c || { label: '', type: 'texto', required: false, options: [] };
      var fila = document.createElement('div');
      fila.className = 'fm-campo';
      fila.innerHTML = '<input class="fmc-label" placeholder="Etiqueta del campo" maxlength="80">' +
        '<select class="fmc-type">' + TIPOS.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') + '</select>' +
        '<label style="display:flex;align-items:center;gap:6px;font-size:.85rem;white-space:nowrap"><input type="checkbox" class="fmc-req" style="width:auto"> obligatorio</label>' +
        '<button class="btn ghost" type="button" style="padding:3px 10px;font-size:.8rem">Quitar</button>';
      var opciones = document.createElement('input');
      opciones.className = 'fmc-options';
      opciones.placeholder = 'Opciones separadas por coma';
      opciones.maxLength = 300;
      opciones.style.marginBottom = '10px';
      opciones.hidden = c.type !== 'seleccion';
      fila.querySelector('.fmc-label').value = c.label;
      fila.querySelector('.fmc-type').value = c.type;
      fila.querySelector('.fmc-req').checked = !!c.required;
      opciones.value = (c.options || []).join(', ');
      fila.querySelector('.fmc-type').addEventListener('change', function (e) { opciones.hidden = e.target.value !== 'seleccion'; });
      fila.querySelector('button').addEventListener('click', function () { fila.remove(); opciones.remove(); });
      camposFm.appendChild(fila);
      camposFm.appendChild(opciones);
    }

    function leerCampos() {
      return [].slice.call(camposFm.querySelectorAll('.fm-campo')).map(function (fila) {
        var opciones = fila.nextElementSibling;
        return {
          label: fila.querySelector('.fmc-label').value,
          type: fila.querySelector('.fmc-type').value,
          required: fila.querySelector('.fmc-req').checked,
          options: opciones && opciones.classList.contains('fmc-options') ? opciones.value : '',
        };
      });
    }

    document.getElementById('fma-agregar').addEventListener('click', function () { filaCampo(); });

    function resetForm() {
      editando = null;
      formFm.reset();
      camposFm.innerHTML = '';
      filaCampo();
      formFm.querySelector('[name="published"]').checked = true;
      document.getElementById('fma-titulo').textContent = 'Nuevo formulario';
      document.getElementById('fma-guardar').textContent = 'Crear formulario';
      cancelarFm.hidden = true;
    }

    function editar(id) {
      var f = lista.filter(function (x) { return x.id === id; })[0];
      if (!f) return;
      editando = id;
      formFm.querySelector('[name="title"]').value = f.title;
      formFm.querySelector('[name="description"]').value = f.description || '';
      formFm.querySelector('[name="published"]').checked = f.published !== false;
      camposFm.innerHTML = '';
      (f.fields || []).forEach(filaCampo);
      if (!(f.fields || []).length) filaCampo();
      document.getElementById('fma-titulo').textContent = 'Editando: ' + f.title;
      document.getElementById('fma-guardar').textContent = 'Guardar cambios';
      cancelarFm.hidden = false;
      formFm.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }

    cancelarFm.addEventListener('click', resetForm);

    formFm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se guardaría el formulario'); return; }
      var cuerpo = {
        title: formFm.querySelector('[name="title"]').value,
        description: formFm.querySelector('[name="description"]').value,
        published: formFm.querySelector('[name="published"]').checked,
        fields: leerCampos(),
      };
      try {
        if (editando) await App.api('/api/formularios/admin/' + editando, { method: 'PUT', body: cuerpo });
        else await App.api('/api/formularios/admin', { method: 'POST', body: cuerpo });
        App.toast(editando ? 'Formulario actualizado' : 'Formulario creado');
        resetForm();
        cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    function pintarLista() {
      listFm.innerHTML = App.table(lista, [
        { label: 'Formulario', render: function (f) {
          return '<strong>' + App.esc(f.title) + '</strong><br><span class="muted" style="font-size:.82rem">' +
            (f.fields || []).length + ' campos · /formularios.html?f=' + App.esc(f.slug) + '</span>';
        } },
        { label: 'Estado', render: function (f) {
          return '<span class="fm-chip ' + (f.published ? 'publicado' : '') + '">' + (f.published ? 'publicado' : 'borrador') + '</span>';
        } },
        { label: 'Respuestas', render: function (f) { return String(f.entries || 0); } },
        { label: 'Acciones', render: function (f) {
          return '<button class="btn ghost" type="button" data-ver="' + f.slug + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Respuestas</button>' +
            '<button class="btn ghost" type="button" data-edit="' + f.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Editar</button>' +
            '<button class="btn ghost" type="button" data-del="' + f.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      listFm.querySelectorAll('[data-ver]').forEach(function (b) { b.addEventListener('click', function () { verRespuestas(b.getAttribute('data-ver')); }); });
      listFm.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editar(b.getAttribute('data-edit')); }); });
      listFm.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
    }

    function verRespuestas(slug) {
      if (abierto === slug) { abierto = null; respBox.innerHTML = ''; return; }
      abierto = slug;
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se abren las respuestas'); return; }
      App.api('/api/formularios/admin/' + encodeURIComponent(slug) + '/respuestas').then(function (r) {
        respuestasActuales = r;
        var cols = r.form.fields.slice(0, 5);
        respBox.innerHTML = '<h3>Respuestas de "' + App.esc(r.form.title) + '"</h3>' +
          '<button class="btn ghost" type="button" id="fma-csv" style="margin-bottom:12px">Descargar CSV</button>' +
          App.table(r.entries, [{ label: 'Cuándo', render: function (e) { return new Date(e.createdAt).toLocaleString('es-AR'); } }].concat(
            cols.map(function (c) {
              return { label: c.label, render: function (e) {
                var v = e.data ? e.data[c.name] : '';
                return App.esc(c.type === 'sino' ? (v ? 'sí' : 'no') : (v || '—'));
              } };
            })));
        var csvFm = document.getElementById('fma-csv');
        if (csvFm) csvFm.addEventListener('click', function () {
          var campos = respuestasActuales.form.fields;
          var filas = [['fecha'].concat(campos.map(function (c) { return c.label; }))].concat(
            respuestasActuales.entries.map(function (e) {
              return [e.createdAt].concat(campos.map(function (c) {
                var v = e.data ? e.data[c.name] : '';
                return c.type === 'sino' ? (v ? 'si' : 'no') : (v || '');
              }));
            }));
          var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
          var a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
          a.download = 'respuestas-' + respuestasActuales.form.slug + '.csv';
          a.click();
        });
        aparecer(respBox);
      }).catch(function (err) { respBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se borraría el formulario'); return; }
      if (!confirm('¿Borrar este formulario con TODAS sus respuestas? No se puede deshacer.')) return;
      try {
        await App.api('/api/formularios/admin/' + id, { method: 'DELETE' });
        if (editando === id) resetForm();
        respBox.innerHTML = '';
        abierto = null;
        App.toast('Formulario borrado');
        cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    function cargar() {
      App.api('/api/formularios/admin/stats').then(pintarStats).catch(function (err) { kpisFm.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
      App.api('/api/formularios/admin/list').then(function (rows) { lista = rows; pintarLista(); }).catch(function () {});
    }

    filaCampo();

    if (window.__PREVIEW__) {
      pintarStats({ total: 1, publicados: 1, respuestas: 12, hoy: 3 });
      lista = [{ id: 'd1', title: 'Inscripción a la próxima capacitación', slug: 'inscripcion', published: true, entries: 12, fields: [{ name: 'nombre', label: 'Nombre', type: 'texto', required: true, options: [] }] }];
      pintarLista();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      cargar();
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navFm = document.getElementById('nav-forms-admin');
    if (navFm && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navFm.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Formularios a medida**: la **definición** de cada formulario vive en la colección \`forms\` y las respuestas en \`formentries\`. ${cfg.moduleIds.includes('auth') ? 'Se arman en `/formularios-admin.html` (título, descripción y campos: texto, párrafo, email, teléfono, número, fecha, selección con opciones y sí/no) y quedan publicados en `/formularios.html?f=<slug>`; la bandeja de cada uno se abre desde el panel y baja a CSV.' : 'Viene sembrado un formulario de ejemplo en `/formularios.html?f=inscripcion`; para armar los tuyos activá el módulo **Autenticación** (habilita `/formularios-admin.html`).'} Lo importante: **el servidor valida cada respuesta contra la definición guardada** (obligatorios, tipo, largo y opciones permitidas), nunca contra el HTML que mandó el navegador — que cualquiera puede editar antes de enviar. El **slug no cambia al editar**, así los links ya repartidos siguen funcionando. Incluye un campo trampa invisible que descarta bots sin obligar a nadie a resolver un captcha.${cfg.moduleIds.includes('mailer') ? ' Cada respuesta dispara un aviso por email al negocio (módulo Avisos por email).' : ''}`,
  ],
};
