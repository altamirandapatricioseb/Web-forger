// Enlaces cortos con backend real: el acortador propio del negocio. En vez de pegar en Instagram,
// en el WhatsApp o en un folleto una URL larguísima con parámetros de campaña (o depender de un
// servicio de terceros que puede caerse, cobrar o cerrar el link), el negocio arma
// midominio.com/l/promo y el servidor REDIRIGE de verdad (302) contando cada clic. Eso es lo que
// convierte al módulo en una herramienta de marketing y no en un adorno: el panel muestra clics
// totales, clics por día de los últimos 14 días y de dónde vino la gente (Instagram, Google, un
// email), con lo que por fin se puede responder "¿sirvió el volante?" con un número. Cada enlace
// tiene su interruptor y una fecha de vencimiento opcional: una campaña se apaga sola y el link
// deja de funcionar sin tocar nada. El destino se valida en el servidor (solo http/https, nunca
// javascript:) y los parámetros que traiga la visita se reenvían al destino, así las etiquetas UTM
// siguen llegando a Analytics. Animado con Anime.js (count-up, barras de la serie diaria) + red de
// seguridad. Requiere auth: es una herramienta de la trastienda, la parte pública es la redirección.

module.exports = {
  id: 'enlaces', type: 'functional', name: 'Enlaces cortos',
  description: 'Acortador de enlaces propio con estadísticas reales: el negocio crea /l/<nombre> y el servidor redirige (302) contando cada clic, con serie de los últimos 14 días y origen de las visitas (referente). Cada enlace se pausa o vence solo por fecha, el destino se valida en el servidor (solo http/https) y los parámetros de la visita se reenvían al destino para no perder las etiquetas de campaña. Panel /enlaces-admin.html con KPIs, detalle por enlace y CSV. Requiere auth. Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [
    // El acortador vive en /l para que el enlace sea lo más corto posible: midominio.com/l/promo
    { route: '/l', file: 'routes/enlaces-ir.js' },
    { route: '/api/enlaces', file: 'routes/enlaces.js' },
  ],
  collections: ['links', 'linkclicks'],
  nav: () => [{ label: 'Enlaces (admin)', href: '/enlaces-admin.html', id: 'nav-enlaces-admin' }],
  head: () => `  <style>
    .enl-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:22px 0}
    .enl-kpis .card{text-align:center}
    .enl-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .enl-url{font-family:ui-monospace,'Cascadia Code','Courier New',monospace;font-size:.85rem;word-break:break-all}
    .enl-est{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .enl-est.activo{background:#2e9e5b20;color:#1d6b3c}
    .enl-est.pausado{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .enl-est.vencido{background:#c0392b20;color:#c0392b}
    .enl-serie{display:flex;align-items:flex-end;gap:5px;height:110px;margin:18px 0 6px}
    .enl-barra{flex:1;background:color-mix(in srgb,var(--accent) 70%,var(--surface));border-radius:4px 4px 0 0;min-height:2px;position:relative}
    .enl-barra span{position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:.7rem;color:var(--muted)}
    .enl-dias{display:flex;gap:5px;font-size:.68rem;color:var(--muted)}
    .enl-dias div{flex:1;text-align:center}
    .enl-ref{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--line);font-size:.9rem}
  </style>`,
  files: () => ({
    // La redirección es la cara pública del módulo: tiene que ser rapidísima y no filtrar nada
    // del panel. Devuelve 302 al destino y cuenta el clic sin bloquear la respuesta.
    'routes/enlaces-ir.js': `const router = require('express').Router();
const db = require('../src/db');

const hoy = () => new Date().toISOString().slice(0, 10);
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Página de "enlace no disponible": autocontenida y con noindex (un link roto no se indexa)
function noDisponible(res, mensaje) {
  res.status(404).type('html').send('<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">' +
    '<title>Enlace no disponible</title><link rel="stylesheet" href="/css/styles.css"></head><body>' +
    '<section><div class="container" style="max-width:520px;text-align:center">' +
    '<h2>Enlace no disponible</h2><p class="muted">' + esc(mensaje) + '</p>' +
    '<a class="btn" href="/index.html">Ir al inicio</a></div></section></body></html>');
}

// De dónde vino la visita: se guarda SOLO el dominio del referente (instagram.com), nunca la URL
// completa. Alcanza para medir la campaña y no acumula datos de navegación de nadie.
function origen(ref) {
  if (!ref) return 'directo';
  try { return new URL(ref).hostname.replace(/^www\\./, '') || 'directo'; } catch { return 'directo'; }
}

// GET /l/:slug — redirección real con conteo de clics
router.get('/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const link = (await db.find('links', l => l.slug === slug))[0];
  if (!link) return noDisponible(res, 'Este enlace corto no existe. Puede que esté mal escrito.');
  if (link.active === false) return noDisponible(res, 'Este enlace fue pausado por el administrador del sitio.');
  if (link.until && link.until < hoy()) return noDisponible(res, 'Este enlace venció y ya no está disponible.');

  // Los parámetros que traiga la visita se reenvían al destino: así no se pierden las etiquetas
  // de campaña (utm_source y compañía) que el negocio agrega al compartir el link corto.
  let destino = link.url;
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?') + 1) : '';
  if (query) destino += (destino.includes('?') ? '&' : '?') + query;

  // Se cuenta después de responder: el visitante nunca espera por la estadística
  res.redirect(302, destino);

  const dia = hoy();
  const ref = origen(req.headers.referer || req.headers.referrer);
  try {
    await db.update('links', link.id, { clicks: (link.clicks || 0) + 1, lastClickAt: new Date().toISOString() });
    // Un renglón por enlace/día/origen (no uno por clic): el histórico no crece sin control
    const fila = (await db.find('linkclicks', c => c.linkId === link.id && c.dia === dia && c.ref === ref))[0];
    if (fila) await db.update('linkclicks', fila.id, { clicks: (fila.clicks || 0) + 1 });
    else await db.insert('linkclicks', { linkId: link.id, dia, ref, clicks: 1 });
  } catch (err) {
    console.error('[enlaces] no se pudo contar el clic:', err.message);
  }
});

module.exports = router;
`,
    'routes/enlaces.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

const FECHA = /^\\d{4}-\\d{2}-\\d{2}$/;
const hoy = () => new Date().toISOString().slice(0, 10);

// Nombre corto válido: letras, números y guiones. Se reserva "api" y "l" por las dudas.
const SLUG_OK = /^[a-z0-9][a-z0-9-]{1,39}$/;
const RESERVADOS = ['api', 'l', 'admin', 'index'];

// Un texto cualquiera → nombre corto usable ("Promo de Verano 2026!" → "promo-de-verano-2026")
const aSlug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

// Destino válido: SOLO http/https. Sin esto, un "javascript:..." guardado acá sería un XSS
// disparado desde el propio dominio del cliente.
function urlValida(v) {
  if (typeof v !== 'string' || !str(v, 5, 600)) return false;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

const estado = (l) => l.active === false ? 'pausado' : (l.until && l.until < hoy() ? 'vencido' : 'activo');
const vista = (l) => ({ ...l, estado: estado(l) });

// GET /api/enlaces — todos los enlaces con su estado calculado (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  const rows = (await db.all('links')).slice().reverse();
  res.json(rows.map(vista));
});

// GET /api/enlaces/stats — KPIs del acortador (solo admin)
router.get('/stats', requireAdmin, async (req, res) => {
  const links = await db.all('links');
  const clicks = await db.all('linkclicks');
  const d = hoy();
  const corteSemana = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  res.json({
    total: links.length,
    activos: links.filter(l => estado(l) === 'activo').length,
    clicks: links.reduce((a, l) => a + (l.clicks || 0), 0),
    clicksHoy: clicks.filter(c => c.dia === d).reduce((a, c) => a + (c.clicks || 0), 0),
    clicksSemana: clicks.filter(c => c.dia >= corteSemana).reduce((a, c) => a + (c.clicks || 0), 0),
  });
});

// POST /api/enlaces — crea un enlace corto (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  if (!urlValida(req.body.url)) return res.status(422).json({ error: 'El destino tiene que ser una dirección http:// o https:// válida' });
  if (!str(req.body.title, 2, 80)) return res.status(422).json({ error: 'El título va entre 2 y 80 caracteres' });
  const slug = aSlug(req.body.slug || req.body.title);
  if (!SLUG_OK.test(slug)) return res.status(422).json({ error: 'El nombre corto usa letras, números y guiones (entre 2 y 40 caracteres)' });
  if (RESERVADOS.includes(slug)) return res.status(422).json({ error: 'Ese nombre corto está reservado, elegí otro' });
  if ((await db.find('links', l => l.slug === slug)).length) return res.status(409).json({ error: 'Ya existe un enlace con ese nombre corto' });
  const until = String(req.body.until || '').trim();
  if (until && (!FECHA.test(until) || isNaN(Date.parse(until + 'T00:00:00Z')))) {
    return res.status(422).json({ error: 'Fecha de vencimiento inválida' });
  }
  const row = await db.insert('links', {
    slug,
    url: req.body.url.trim(),
    title: req.body.title.trim(),
    until,
    active: true,
    clicks: 0,
    lastClickAt: '',
  });
  res.status(201).json(vista(row));
});

// Las rutas con :id van AL FINAL para no tapar a /stats
// GET /api/enlaces/:id/detalle — serie de los últimos 14 días y orígenes (solo admin)
router.get('/:id/detalle', requireAdmin, async (req, res) => {
  const link = await db.get('links', req.params.id);
  if (!link) return res.status(404).json({ error: 'Enlace inexistente' });
  const filas = await db.find('linkclicks', c => c.linkId === link.id);
  // Serie completa de 14 días (los días sin clics valen 0: el gráfico no miente por omisión)
  const serie = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    serie.push({ dia: d, clicks: filas.filter(f => f.dia === d).reduce((a, f) => a + (f.clicks || 0), 0) });
  }
  const porOrigen = {};
  for (const f of filas) porOrigen[f.ref || 'directo'] = (porOrigen[f.ref || 'directo'] || 0) + (f.clicks || 0);
  res.json({
    link: vista(link),
    serie,
    origenes: Object.entries(porOrigen).map(([ref, clicks]) => ({ ref, clicks })).sort((a, b) => b.clicks - a.clicks).slice(0, 12),
  });
});

// PUT /api/enlaces/:id — edita destino, título, vencimiento o pausa (solo admin).
// El nombre corto NO se edita: cambiarlo rompería los enlaces ya repartidos.
router.put('/:id', requireAdmin, async (req, res) => {
  const link = await db.get('links', req.params.id);
  if (!link) return res.status(404).json({ error: 'Enlace inexistente' });
  const patch = {};
  if (req.body.url !== undefined) {
    if (!urlValida(req.body.url)) return res.status(422).json({ error: 'El destino tiene que ser una dirección http:// o https:// válida' });
    patch.url = req.body.url.trim();
  }
  if (req.body.title !== undefined) {
    if (!str(req.body.title, 2, 80)) return res.status(422).json({ error: 'El título va entre 2 y 80 caracteres' });
    patch.title = req.body.title.trim();
  }
  if (req.body.until !== undefined) {
    const v = String(req.body.until || '').trim();
    if (v && (!FECHA.test(v) || isNaN(Date.parse(v + 'T00:00:00Z')))) return res.status(422).json({ error: 'Fecha de vencimiento inválida' });
    patch.until = v;
  }
  if (req.body.active !== undefined) patch.active = !!req.body.active;
  res.json(vista(await db.update('links', link.id, patch)));
});

// DELETE /api/enlaces/:id — borra el enlace y su historial de clics (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const link = await db.get('links', req.params.id);
  if (!link) return res.status(404).json({ error: 'Enlace inexistente' });
  for (const c of await db.find('linkclicks', c => c.linkId === link.id)) await db.remove('linkclicks', c.id);
  await db.remove('links', link.id);
  res.json({ ok: true });
});

module.exports = router;
`,
  }),
  pages: () => ({
    'enlaces-admin': {
      title: 'Enlaces cortos',
      html: `  <section>
    <div class="container" style="max-width:980px">
      <h2>Enlaces cortos</h2>
      <p class="section-sub">Convertí cualquier dirección larga en un enlace propio y corto para compartir en redes, folletos o WhatsApp, y medí cuántos clics trajo cada campaña. Solo visible para administradores.</p>
      <div class="enl-kpis" id="enl-kpis"></div>
      <form id="enl-form" class="card">
        <h3 style="margin-top:0">Nuevo enlace</h3>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Título (para vos)</label><input name="title" required maxlength="80" placeholder="Promo de verano en Instagram"></div>
          <div><label>Nombre corto (opcional)</label><input name="slug" maxlength="40" placeholder="promo-verano"></div>
        </div>
        <label>Destino</label>
        <input name="url" type="url" required placeholder="https://midominio.com/promociones.html?utm_source=instagram">
        <label>Vence el (opcional)</label>
        <input name="until" type="date">
        <button class="btn" type="submit" style="margin-top:16px">Crear enlace</button>
      </form>
      <div id="enl-list" style="margin-top:26px"><p class="muted">Cargando…</p></div>
      <div id="enl-detalle"></div>
      <div style="margin-top:18px"><button class="btn ghost" type="button" id="enl-csv">Descargar CSV</button></div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo enlaces cortos: panel solo-admin en /enlaces-admin.html (alta, listado con clics,
   detalle con serie diaria y orígenes). Animado con Anime.js (count-up de KPIs, crecimiento de
   las barras de la serie) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  // Oculta el link admin de la navbar para quien no es admin (en TODAS las páginas)
  var navEnl = document.getElementById('nav-enlaces-admin');
  if (navEnl && (!me || me.role !== 'admin') && !window.__PREVIEW__) navEnl.style.display = 'none';

  var kpis = document.getElementById('enl-kpis');
  if (!kpis) return;
  var listBox = document.getElementById('enl-list');
  var detBox = document.getElementById('enl-detalle');
  var formEnl = document.getElementById('enl-form');
  var enlaces = [];

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
    kpis.innerHTML = '<div class="card"><strong id="enl-k-tot">0</strong><span class="muted">enlaces</span></div>' +
      '<div class="card"><strong id="enl-k-act">0</strong><span class="muted">activos</span></div>' +
      '<div class="card"><strong id="enl-k-cli">0</strong><span class="muted">clics totales</span></div>' +
      '<div class="card"><strong id="enl-k-sem">0</strong><span class="muted">clics esta semana</span></div>';
    contar(document.getElementById('enl-k-tot'), s.total);
    contar(document.getElementById('enl-k-act'), s.activos);
    contar(document.getElementById('enl-k-cli'), s.clicks);
    contar(document.getElementById('enl-k-sem'), s.clicksSemana);
  }

  function corto(l) { return location.origin + '/l/' + l.slug; }

  function pintarLista() {
    listBox.innerHTML = App.table(enlaces, [
      { label: 'Enlace', render: function (l) {
        return App.esc(l.title) + '<br><a class="enl-url" href="' + App.esc(corto(l)) + '" target="_blank" rel="noopener">' + App.esc(corto(l)) + '</a>';
      } },
      { label: 'Destino', render: function (l) { return '<span class="muted enl-url">' + App.esc(l.url.slice(0, 60)) + (l.url.length > 60 ? '…' : '') + '</span>'; } },
      { label: 'Estado', render: function (l) {
        return '<span class="enl-est ' + App.esc(l.estado) + '">' + l.estado + '</span>' + (l.until ? '<br><span class="muted" style="font-size:.78rem">hasta ' + l.until.split('-').reverse().join('/') + '</span>' : '');
      } },
      { label: 'Clics', render: function (l) { return '<strong>' + (l.clicks || 0) + '</strong>'; } },
      { label: 'Acciones', render: function (l) {
        return '<button class="btn ghost" type="button" data-cop="' + l.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Copiar</button>' +
          '<button class="btn ghost" type="button" data-det="' + l.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Ver clics</button>' +
          '<button class="btn ghost" type="button" data-tog="' + l.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (l.active === false ? 'Reactivar' : 'Pausar') + '</button>' +
          '<button class="btn ghost" type="button" data-del="' + l.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
      } },
    ]);
    listBox.querySelectorAll('[data-cop]').forEach(function (b) { b.addEventListener('click', function () { copiar(b.getAttribute('data-cop')); }); });
    listBox.querySelectorAll('[data-det]').forEach(function (b) { b.addEventListener('click', function () { detalle(b.getAttribute('data-det')); }); });
    listBox.querySelectorAll('[data-tog]').forEach(function (b) { b.addEventListener('click', function () { alternar(b.getAttribute('data-tog')); }); });
    listBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
  }

  function pintarDetalle(d) {
    var maximo = Math.max.apply(null, d.serie.map(function (p) { return p.clicks; }).concat([1]));
    detBox.innerHTML = '<div class="card" style="margin-top:22px">' +
      '<h3 style="margin:0 0 4px">' + App.esc(d.link.title) + '</h3>' +
      '<p class="muted" style="margin:0 0 10px;font-size:.88rem">Clics de los últimos 14 días · ' + (d.link.clicks || 0) + ' en total</p>' +
      '<div class="enl-serie" id="enl-serie">' + d.serie.map(function (p) {
        return '<div class="enl-barra" data-alto="' + Math.round(p.clicks / maximo * 100) + '" style="height:2px" title="' + p.dia + ': ' + p.clicks + '">' + (p.clicks ? '<span>' + p.clicks + '</span>' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="enl-dias">' + d.serie.map(function (p) { return '<div>' + p.dia.slice(8) + '</div>'; }).join('') + '</div>' +
      '<h4 style="margin:22px 0 6px">De dónde vinieron</h4>' +
      (d.origenes.length ? d.origenes.map(function (o) {
        return '<div class="enl-ref"><span>' + App.esc(o.ref) + '</span><strong>' + o.clicks + '</strong></div>';
      }).join('') : '<p class="muted">Todavía no hubo clics en este enlace.</p>') +
      '</div>';
    var barras = detBox.querySelectorAll('.enl-barra');
    var anime = window.anime;
    function fijar() {
      barras.forEach(function (b) { b.style.height = Math.max(2, Number(b.getAttribute('data-alto'))) + '%'; });
    }
    if (anime && anime.animate && !reduce && barras.length) {
      barras.forEach(function (b, i) {
        anime.animate(b, { height: ['2%', Math.max(2, Number(b.getAttribute('data-alto'))) + '%'], duration: 620, delay: i * 35, ease: 'outCubic' });
      });
      // Red de seguridad: deja las barras en su altura final aunque el loop esté pausado
      setTimeout(fijar, 620 + 35 * barras.length + 200);
    } else {
      fijar();
    }
    detBox.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  formEnl.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se crearía el enlace corto'); return; }
    try {
      var nuevo = await App.api('/api/enlaces', { method: 'POST', body: {
        title: formEnl.querySelector('[name="title"]').value,
        slug: formEnl.querySelector('[name="slug"]').value,
        url: formEnl.querySelector('[name="url"]').value,
        until: formEnl.querySelector('[name="until"]').value,
      } });
      formEnl.reset();
      enlaces = [nuevo].concat(enlaces);
      pintarLista();
      cargarStats();
      App.toast('Enlace creado: ' + corto(nuevo));
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  function copiar(id) {
    var l = enlaces.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    var url = corto(l);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { App.toast('Enlace copiado'); }, function () { App.toast(url); });
    } else {
      App.toast(url);
    }
  }

  async function detalle(id) {
    if (window.__PREVIEW__) {
      pintarDetalle({ link: { title: 'Promo de verano', clicks: 128 }, serie: [{ dia: '2026-07-08', clicks: 4 }, { dia: '2026-07-09', clicks: 11 }, { dia: '2026-07-10', clicks: 25 }, { dia: '2026-07-11', clicks: 18 }], origenes: [{ ref: 'instagram.com', clicks: 84 }, { ref: 'directo', clicks: 30 }] });
      return;
    }
    try { pintarDetalle(await App.api('/api/enlaces/' + id + '/detalle')); }
    catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function alternar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se pausa o reactiva el enlace'); return; }
    var l = enlaces.filter(function (x) { return x.id === id; })[0];
    try {
      var upd = await App.api('/api/enlaces/' + id, { method: 'PUT', body: { active: l.active === false } });
      enlaces = enlaces.map(function (x) { return x.id === id ? upd : x; });
      pintarLista();
      cargarStats();
      App.toast(upd.active === false ? 'Enlace pausado' : 'Enlace reactivado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function borrar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se borraría el enlace'); return; }
    if (!confirm('¿Borrar este enlace corto? Los que ya lo tengan repartido van a ver "enlace no disponible".')) return;
    try {
      await App.api('/api/enlaces/' + id, { method: 'DELETE' });
      enlaces = enlaces.filter(function (x) { return x.id !== id; });
      pintarLista();
      detBox.innerHTML = '';
      cargarStats();
      App.toast('Enlace borrado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  document.getElementById('enl-csv').addEventListener('click', function () {
    var filas = [['titulo', 'enlace_corto', 'destino', 'estado', 'clics', 'vence']].concat(enlaces.map(function (l) {
      return [l.title, corto(l), l.url, l.estado, l.clicks || 0, l.until || ''];
    }));
    var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'enlaces-cortos.csv';
    a.click();
  });

  function cargarStats() {
    App.api('/api/enlaces/stats').then(pintarStats).catch(function () {});
  }

  if (window.__PREVIEW__) {
    pintarStats({ total: 3, activos: 2, clicks: 214, clicksHoy: 12, clicksSemana: 58 });
    enlaces = [
      { id: 'd1', slug: 'promo-verano', title: 'Promo de verano en Instagram', url: 'https://midominio.com/promociones.html?utm_source=instagram', estado: 'activo', active: true, clicks: 128, until: '' },
      { id: 'd2', slug: 'carta', title: 'Carta para el QR de las mesas', url: 'https://midominio.com/carta.html', estado: 'pausado', active: false, clicks: 86, until: '2026-12-31' },
    ];
    pintarLista();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargarStats();
    App.api('/api/enlaces').then(function (rows) { enlaces = rows; pintarLista(); }).catch(function (err) { listBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
  }
})();`,
  readmeNotes: (cfg) => [
    `**Enlaces cortos**: se administran en \`/enlaces-admin.html\` y la parte pública es la **redirección real** \`${cfg.brand.domain || 'https://tudominio.com'}/l/<nombre>\` (HTTP 302), que cuenta cada clic con su día y el **dominio** del referente (nunca la URL completa de donde venía la persona). Los parámetros de la visita se **reenvían al destino**, así las etiquetas \`utm_*\` siguen llegando a tu analítica. Cada enlace se puede pausar o poner con fecha de vencimiento: al vencer, el link responde una página propia de "enlace no disponible" con \`noindex\`. El **nombre corto no se puede editar** a propósito (cambiarlo rompería los enlaces ya repartidos): si te equivocaste, creá otro. El destino se valida en el servidor y solo acepta \`http://\` y \`https://\`. Los clics se guardan agrupados por enlace/día/origen, no uno por uno: el historial no crece sin control.`,
  ],
};
