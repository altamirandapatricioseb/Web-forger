// Códigos QR con backend real: el generador propio del negocio. El QR es hoy la puerta de
// entrada física al sitio —la carta de un restaurante en la mesa, el volante que se reparte en
// la calle, la etiqueta de un producto, el cartel de la vidriera— y hasta ahora el catálogo no
// tenía forma de hacer uno. La decisión de fondo es que el código se ARMA EN EL SERVIDOR, con un
// encoder propio (src/qrcode.js: modo byte, versiones 1 a 10, los cuatro niveles de corrección y
// las 8 máscaras de la norma ISO/IEC 18004): las APIs de terceros que devuelven un PNG le avisan
// a un extraño qué está imprimiendo el negocio y dejan de funcionar el día que ese servicio cierra.
// Además de la imagen, el módulo resuelve lo que hace útil a un QR impreso: los que apuntan a una
// página pasan por /q/<nombre>, que REDIRIGE de verdad (302) y cuenta cada escaneo con su día y si
// vino de un teléfono o de una computadora — así por fin se puede responder "¿alguien escaneó el
// cartel?" con un número. Y como el destino se edita sin regenerar el código, un QR ya impreso en
// mil folletos se puede reapuntar a otra página. Animado con Anime.js (count-up de los KPIs,
// barras de la serie diaria, entrada escalonada de las tarjetas) + red de seguridad.
// Requiere auth: es una herramienta de la trastienda; lo público es la imagen y la redirección.

const fs = require('fs');
const path = require('path');

// El encoder vive una sola vez en src/qrcode.js del Builder: de ahí se copia al proyecto
// generado y de ahí sale también el código de ejemplo horneado en la vista previa.
const QRCODE_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'qrcode.js'), 'utf8');
const qrcode = require('../../src/qrcode');

// Código de ejemplo para la vista previa del Builder (ahí no hay servidor que lo genere)
const DEMO_SVG = qrcode.svg('https://midominio.com/q/carta', { ec: 'M', escala: 4, margen: 2 });

module.exports = {
  id: 'qr', type: 'functional', name: 'Códigos QR',
  description: 'Generador de códigos QR propio, armado en el servidor sin servicios de terceros (encoder completo: modo byte, versiones 1 a 10, los cuatro niveles de corrección y las 8 máscaras de la norma). Los códigos que apuntan a una página pasan por /q/<nombre>, que redirige de verdad (302) y cuenta cada escaneo por día y por tipo de dispositivo, así que el destino se puede cambiar sin volver a imprimir nada. También genera códigos de texto libre (WiFi, teléfono, mensaje). Panel /qr-admin.html con vista previa, descarga en SVG y PNG, KPIs y CSV. Requiere auth. Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [
    // La imagen y la redirección viven en /q para que el enlace impreso sea lo más corto posible
    { route: '/q', file: 'routes/qr-ir.js' },
    { route: '/api/qr', file: 'routes/qr.js' },
  ],
  collections: ['qrcodes', 'qrscans'],
  nav: () => [{ label: 'Códigos QR (admin)', href: '/qr-admin.html', id: 'nav-qr-admin' }],
  head: () => `  <style>
    .qr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:22px 0}
    .qr-kpis .card{text-align:center}
    .qr-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .qr-mini{width:76px;height:76px;display:block;border-radius:6px;border:1px solid var(--line);background:#fff}
    .qr-mini-vacio{width:76px;height:76px;display:grid;place-items:center;border-radius:6px;border:1px dashed var(--line);color:var(--muted);font-size:.7rem;text-align:center;padding:4px}
    .qr-url{font-family:ui-monospace,'Cascadia Code','Courier New',monospace;font-size:.82rem;word-break:break-all}
    .qr-est{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .qr-est.activo{background:#2e9e5b20;color:#1d6b3c}
    .qr-est.pausado{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .qr-est.texto{background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent)}
    .qr-serie{display:flex;align-items:flex-end;gap:5px;height:110px;margin:18px 0 6px}
    .qr-barra{flex:1;background:color-mix(in srgb,var(--accent) 70%,var(--surface));border-radius:4px 4px 0 0;min-height:2px;position:relative}
    .qr-barra span{position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:.7rem;color:var(--muted)}
    .qr-dias{display:flex;gap:5px;font-size:.68rem;color:var(--muted)}
    .qr-dias div{flex:1;text-align:center}
    .qr-disp{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--line);font-size:.9rem}
    .qr-grande{max-width:280px;margin:0 auto;display:block;background:#fff;border-radius:8px;border:1px solid var(--line)}
  </style>`,
  files: () => ({
    // El encoder completo, copiado tal cual desde el Builder (fuente única)
    'src/qrcode.js': QRCODE_SRC,

    // Cara pública del módulo: la imagen del código y la redirección que cuenta escaneos.
    // Las dos tienen que ser rapidísimas y no filtrar nada del panel.
    'routes/qr-ir.js': `const router = require('express').Router();
const db = require('../src/db');
const qrcode = require('../src/qrcode');

const hoy = () => new Date().toISOString().slice(0, 10);
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Página de "código no disponible": autocontenida y con noindex (un QR muerto no se indexa)
function noDisponible(res, mensaje) {
  res.status(404).type('html').send('<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">' +
    '<title>Código no disponible</title><link rel="stylesheet" href="/css/styles.css"></head><body>' +
    '<section><div class="container" style="max-width:520px;text-align:center">' +
    '<h2>Código no disponible</h2><p class="muted">' + esc(mensaje) + '</p>' +
    '<a class="btn" href="/index.html">Ir al inicio</a></div></section></body></html>');
}

// Dirección pública del sitio tal como la ve quien escanea. Detrás de un proxy (Vercel) el host
// real viaja en x-forwarded-*, así que el QR impreso apunta al dominio de verdad y no a localhost.
function origenDe(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
  return proto + '://' + host;
}

// Qué se codifica adentro del QR: los de tipo enlace guardan la dirección corta propia (por eso
// el destino se puede cambiar después sin reimprimir), los de texto guardan su contenido tal cual.
const contenidoDe = (c, origen) => c.tipo === 'texto' ? String(c.contenido || '') : (origen + '/q/' + c.slug);

// Solo móvil o escritorio: alcanza para saber si el cartel de la calle funciona y no arma
// el perfil de nadie (no se guarda el user-agent completo ni la IP).
const dispositivo = (ua) => /Mobi|Android|iPhone|iPad|iPod/i.test(String(ua || '')) ? 'móvil' : 'escritorio';

// GET /q/<nombre>.svg → imagen del código   ·   GET /q/<nombre> → redirección contando el escaneo
router.get('/:slug', async (req, res) => {
  let slug = String(req.params.slug || '').toLowerCase();
  const esImagen = slug.endsWith('.svg');
  if (esImagen) slug = slug.slice(0, -4);

  const code = (await db.find('qrcodes', c => c.slug === slug))[0];
  if (!code) {
    return esImagen ? res.status(404).json({ error: 'Código inexistente' })
      : noDisponible(res, 'Este código QR no existe. Puede que esté mal impreso o que lo hayan borrado.');
  }

  // La imagen es pública a propósito: un QR se hace para repartirlo, no hay secreto que guardar.
  // Se sirve aunque el código esté pausado, así el panel siempre puede mostrar la vista previa.
  if (esImagen) {
    const escala = Math.max(1, Math.min(20, parseInt(req.query.escala, 10) || 8));
    try {
      const svg = qrcode.svg(contenidoDe(code, origenDe(req)), { ec: code.ec, escala, margen: 4 });
      return res.type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
    } catch (err) {
      return res.status(422).json({ error: err.message });
    }
  }

  if (code.tipo !== 'enlace') return noDisponible(res, 'Este código guarda un texto, no una página web.');
  if (code.active === false) return noDisponible(res, 'Este código fue pausado por el administrador del sitio.');

  // Los parámetros que traiga el escaneo se reenvían al destino: si el negocio imprimió
  // /q/mesa?m=12, el "12" llega igual a la página de la carta.
  let destino = code.destino;
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?') + 1) : '';
  if (query) destino += (destino.includes('?') ? '&' : '?') + query;

  // Se cuenta después de responder: quien escanea nunca espera por la estadística
  res.redirect(302, destino);

  const dia = hoy();
  const disp = dispositivo(req.headers['user-agent']);
  try {
    await db.update('qrcodes', code.id, { scans: (code.scans || 0) + 1, lastScanAt: new Date().toISOString() });
    // Un renglón por código/día/dispositivo (no uno por escaneo): el histórico no crece sin control
    const fila = (await db.find('qrscans', s => s.codeId === code.id && s.dia === dia && s.disp === disp))[0];
    if (fila) await db.update('qrscans', fila.id, { scans: (fila.scans || 0) + 1 });
    else await db.insert('qrscans', { codeId: code.id, dia, disp, scans: 1 });
  } catch (err) {
    console.error('[qr] no se pudo contar el escaneo:', err.message);
  }
});

module.exports = router;
`,
    'routes/qr.js': `const router = require('express').Router();
const db = require('../src/db');
const qrcode = require('../src/qrcode');
const { str } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

// Nombre corto válido: letras, números y guiones. Se reservan las rutas propias del sitio.
const SLUG_OK = /^[a-z0-9][a-z0-9-]{1,39}$/;
const RESERVADOS = ['api', 'q', 'l', 'admin', 'index'];
const EC_OK = ['L', 'M', 'Q', 'H'];

// Un texto cualquiera → nombre corto usable ("Carta del Restaurante!" → "carta-del-restaurante")
const aSlug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

// Destino válido: SOLO http/https. Sin esto, un "javascript:..." impreso en un QR sería un
// XSS disparado desde el propio dominio del cliente contra quien lo escanee.
function urlValida(v) {
  if (typeof v !== 'string' || !str(v, 5, 600)) return false;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

const estado = (c) => c.tipo === 'texto' ? 'texto' : (c.active === false ? 'pausado' : 'activo');
const vista = (c) => ({ ...c, estado: estado(c) });

// GET /api/qr — todos los códigos con su estado calculado (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  res.json((await db.all('qrcodes')).slice().reverse().map(vista));
});

// GET /api/qr/stats — KPIs del generador (solo admin)
router.get('/stats', requireAdmin, async (req, res) => {
  const codes = await db.all('qrcodes');
  const scans = await db.all('qrscans');
  const corteSemana = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  res.json({
    total: codes.length,
    activos: codes.filter(c => estado(c) === 'activo').length,
    scans: codes.reduce((a, c) => a + (c.scans || 0), 0),
    scansSemana: scans.filter(s => s.dia >= corteSemana).reduce((a, s) => a + (s.scans || 0), 0),
  });
});

// POST /api/qr — crea un código (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  if (!str(req.body.title, 2, 80)) return res.status(422).json({ error: 'El título va entre 2 y 80 caracteres' });
  const tipo = req.body.tipo === 'texto' ? 'texto' : 'enlace';
  const ec = EC_OK.includes(req.body.ec) ? req.body.ec : 'M';
  const slug = aSlug(req.body.slug || req.body.title);
  if (!SLUG_OK.test(slug)) return res.status(422).json({ error: 'El nombre corto usa letras, números y guiones (entre 2 y 40 caracteres)' });
  if (RESERVADOS.includes(slug)) return res.status(422).json({ error: 'Ese nombre corto está reservado, elegí otro' });
  if ((await db.find('qrcodes', c => c.slug === slug)).length) return res.status(409).json({ error: 'Ya existe un código con ese nombre corto' });

  let destino = '', contenido = '';
  if (tipo === 'enlace') {
    if (!urlValida(req.body.destino)) return res.status(422).json({ error: 'El destino tiene que ser una dirección http:// o https:// válida' });
    destino = req.body.destino.trim();
  } else {
    if (!str(req.body.contenido, 1, 600)) return res.status(422).json({ error: 'El contenido del código no puede estar vacío' });
    contenido = req.body.contenido.trim();
    // Se prueba a codificarlo AHORA: mejor un error claro al guardar que un código roto impreso
    try { qrcode.matriz(contenido, ec); }
    catch (err) { return res.status(422).json({ error: err.message }); }
  }

  res.status(201).json(vista(await db.insert('qrcodes', {
    slug, title: req.body.title.trim(), tipo, destino, contenido, ec,
    active: true, scans: 0, lastScanAt: '',
  })));
});

// Las rutas con :id van AL FINAL para no tapar a /stats
// GET /api/qr/:id/detalle — serie de los últimos 14 días y dispositivos (solo admin)
router.get('/:id/detalle', requireAdmin, async (req, res) => {
  const code = await db.get('qrcodes', req.params.id);
  if (!code) return res.status(404).json({ error: 'Código inexistente' });
  const filas = await db.find('qrscans', s => s.codeId === code.id);
  // Serie completa de 14 días (los días sin escaneos valen 0: el gráfico no miente por omisión)
  const serie = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    serie.push({ dia: d, scans: filas.filter(f => f.dia === d).reduce((a, f) => a + (f.scans || 0), 0) });
  }
  const porDisp = {};
  for (const f of filas) porDisp[f.disp || 'escritorio'] = (porDisp[f.disp || 'escritorio'] || 0) + (f.scans || 0);
  res.json({
    code: vista(code),
    serie,
    dispositivos: Object.entries(porDisp).map(([disp, scans]) => ({ disp, scans })).sort((a, b) => b.scans - a.scans),
  });
});

// PUT /api/qr/:id — edita título, destino, contenido, corrección o pausa (solo admin).
// El nombre corto NO se edita: cambiarlo dejaría muertos todos los códigos ya impresos.
router.put('/:id', requireAdmin, async (req, res) => {
  const code = await db.get('qrcodes', req.params.id);
  if (!code) return res.status(404).json({ error: 'Código inexistente' });
  const patch = {};
  if (req.body.title !== undefined) {
    if (!str(req.body.title, 2, 80)) return res.status(422).json({ error: 'El título va entre 2 y 80 caracteres' });
    patch.title = req.body.title.trim();
  }
  if (req.body.destino !== undefined && code.tipo === 'enlace') {
    if (!urlValida(req.body.destino)) return res.status(422).json({ error: 'El destino tiene que ser una dirección http:// o https:// válida' });
    patch.destino = req.body.destino.trim();
  }
  if (req.body.contenido !== undefined && code.tipo === 'texto') {
    if (!str(req.body.contenido, 1, 600)) return res.status(422).json({ error: 'El contenido del código no puede estar vacío' });
    try { qrcode.matriz(req.body.contenido.trim(), req.body.ec || code.ec); }
    catch (err) { return res.status(422).json({ error: err.message }); }
    patch.contenido = req.body.contenido.trim();
  }
  if (req.body.ec !== undefined) {
    if (!EC_OK.includes(req.body.ec)) return res.status(422).json({ error: 'Nivel de corrección inválido' });
    // Subir la corrección achica lo que entra: se verifica antes de guardar
    if (code.tipo === 'texto') {
      try { qrcode.matriz(patch.contenido || code.contenido, req.body.ec); }
      catch (err) { return res.status(422).json({ error: err.message }); }
    }
    patch.ec = req.body.ec;
  }
  if (req.body.active !== undefined) patch.active = !!req.body.active;
  res.json(vista(await db.update('qrcodes', code.id, patch)));
});

// DELETE /api/qr/:id — borra el código y su historial de escaneos (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const code = await db.get('qrcodes', req.params.id);
  if (!code) return res.status(404).json({ error: 'Código inexistente' });
  for (const s of await db.find('qrscans', s => s.codeId === code.id)) await db.remove('qrscans', s.id);
  await db.remove('qrcodes', code.id);
  res.json({ ok: true });
});

module.exports = router;
`,
  }),
  pages: () => ({
    'qr-admin': {
      title: 'Códigos QR',
      html: `  <section>
    <div class="container" style="max-width:1000px">
      <h2>Códigos QR</h2>
      <p class="section-sub">Generá los códigos que vas a imprimir en la carta, en el volante o en la vidriera. Los que apuntan a una página cuentan cada escaneo y te dejan cambiar el destino sin volver a imprimir nada. Solo visible para administradores.</p>
      <div class="qr-kpis" id="qr-kpis"></div>
      <form id="qr-form" class="card">
        <h3 style="margin-top:0">Nuevo código</h3>
        <div class="grid cols-2" style="gap:14px">
          <div><label>Título (para vos)</label><input name="title" required maxlength="80" placeholder="Carta para las mesas"></div>
          <div><label>Nombre corto (opcional)</label><input name="slug" maxlength="40" placeholder="carta"></div>
        </div>
        <div class="grid cols-2" style="gap:14px">
          <div>
            <label>Qué guarda el código</label>
            <select name="tipo" id="qr-tipo">
              <option value="enlace">Una página del sitio (cuenta escaneos)</option>
              <option value="texto">Un texto libre (WiFi, teléfono, mensaje)</option>
            </select>
          </div>
          <div>
            <label>Nivel de corrección de error</label>
            <select name="ec">
              <option value="L">Bajo — el código más chico</option>
              <option value="M" selected>Medio — recomendado</option>
              <option value="Q">Alto</option>
              <option value="H">Máximo — sobrevive a manchas y dobleces</option>
            </select>
          </div>
        </div>
        <div id="qr-campo-enlace">
          <label>Destino</label>
          <input name="destino" type="url" placeholder="https://midominio.com/carta.html">
        </div>
        <div id="qr-campo-texto" style="display:none">
          <label>Contenido del código</label>
          <textarea name="contenido" rows="3" maxlength="600" placeholder="WIFI:S:MiRed;T:WPA;P:miclave;;"></textarea>
        </div>
        <button class="btn" type="submit" style="margin-top:16px">Generar código</button>
      </form>
      <div id="qr-list" style="margin-top:26px"><p class="muted">Cargando…</p></div>
      <div id="qr-detalle"></div>
      <div style="margin-top:18px"><button class="btn ghost" type="button" id="qr-csv">Descargar CSV</button></div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo códigos QR: panel solo-admin en /qr-admin.html (alta, listado con vista previa real
   servida por el backend, descarga en SVG y en PNG, detalle con serie diaria y dispositivos).
   Animado con Anime.js (count-up de KPIs, barras de la serie) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  // Oculta el link admin de la navbar para quien no es admin (en TODAS las páginas)
  var navQr = document.getElementById('nav-qr-admin');
  if (navQr && (!me || me.role !== 'admin') && !window.__PREVIEW__) navQr.style.display = 'none';

  var kpis = document.getElementById('qr-kpis');
  if (!kpis) return;
  var listBox = document.getElementById('qr-list');
  var detBox = document.getElementById('qr-detalle');
  var formQr = document.getElementById('qr-form');
  var codigos = [];
  // Código de ejemplo horneado al generar el proyecto: la vista previa del Builder no tiene
  // servidor que arme la imagen, así que muestra este QR real en vez de una foto rota.
  var DEMO = ${JSON.stringify(DEMO_SVG)};

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
    kpis.innerHTML = '<div class="card"><strong id="qr-k-tot">0</strong><span class="muted">códigos</span></div>' +
      '<div class="card"><strong id="qr-k-act">0</strong><span class="muted">activos</span></div>' +
      '<div class="card"><strong id="qr-k-esc">0</strong><span class="muted">escaneos totales</span></div>' +
      '<div class="card"><strong id="qr-k-sem">0</strong><span class="muted">escaneos esta semana</span></div>';
    contar(document.getElementById('qr-k-tot'), s.total);
    contar(document.getElementById('qr-k-act'), s.activos);
    contar(document.getElementById('qr-k-esc'), s.scans);
    contar(document.getElementById('qr-k-sem'), s.scansSemana);
  }

  function corto(c) { return location.origin + '/q/' + c.slug; }
  function imagen(c, escala) { return '/q/' + c.slug + '.svg?escala=' + (escala || 4); }

  // Alterna los campos del formulario según el tipo elegido
  var selTipo = document.getElementById('qr-tipo');
  selTipo.addEventListener('change', function () {
    var esTexto = selTipo.value === 'texto';
    document.getElementById('qr-campo-enlace').style.display = esTexto ? 'none' : '';
    document.getElementById('qr-campo-texto').style.display = esTexto ? '' : 'none';
  });

  function pintarLista() {
    listBox.innerHTML = App.table(codigos, [
      { label: 'Código', render: function (c) {
        return window.__PREVIEW__ ? DEMO : '<img class="qr-mini" src="' + App.esc(imagen(c, 3)) + '" alt="Código QR de ' + App.esc(c.title) + '" loading="lazy">';
      } },
      { label: 'Qué es', render: function (c) {
        var extra = c.tipo === 'texto'
          ? '<span class="muted qr-url">' + App.esc(String(c.contenido || '').slice(0, 60)) + (String(c.contenido || '').length > 60 ? '…' : '') + '</span>'
          : '<a class="qr-url" href="' + App.esc(corto(c)) + '" target="_blank" rel="noopener">' + App.esc(corto(c)) + '</a>' +
            '<br><span class="muted qr-url">→ ' + App.esc(String(c.destino || '').slice(0, 50)) + (String(c.destino || '').length > 50 ? '…' : '') + '</span>';
        return App.esc(c.title) + '<br>' + extra;
      } },
      { label: 'Estado', render: function (c) {
        return '<span class="qr-est ' + App.esc(c.estado) + '">' + c.estado + '</span><br><span class="muted" style="font-size:.78rem">corrección ' + App.esc(c.ec || 'M') + '</span>';
      } },
      { label: 'Escaneos', render: function (c) { return c.tipo === 'texto' ? '<span class="muted">—</span>' : '<strong>' + (c.scans || 0) + '</strong>'; } },
      { label: 'Acciones', render: function (c) {
        var b = '<button class="btn ghost" type="button" data-svg="' + c.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">SVG</button>' +
          '<button class="btn ghost" type="button" data-png="' + c.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">PNG</button>';
        if (c.tipo === 'enlace') {
          b += '<button class="btn ghost" type="button" data-cop="' + c.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Copiar</button>' +
            '<button class="btn ghost" type="button" data-det="' + c.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Ver escaneos</button>' +
            '<button class="btn ghost" type="button" data-tog="' + c.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (c.active === false ? 'Reactivar' : 'Pausar') + '</button>';
        }
        return b + '<button class="btn ghost" type="button" data-del="' + c.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
      } },
    ]);
    listBox.querySelectorAll('[data-svg]').forEach(function (b) { b.addEventListener('click', function () { bajarSvg(b.getAttribute('data-svg')); }); });
    listBox.querySelectorAll('[data-png]').forEach(function (b) { b.addEventListener('click', function () { bajarPng(b.getAttribute('data-png')); }); });
    listBox.querySelectorAll('[data-cop]').forEach(function (b) { b.addEventListener('click', function () { copiar(b.getAttribute('data-cop')); }); });
    listBox.querySelectorAll('[data-det]').forEach(function (b) { b.addEventListener('click', function () { detalle(b.getAttribute('data-det')); }); });
    listBox.querySelectorAll('[data-tog]').forEach(function (b) { b.addEventListener('click', function () { alternar(b.getAttribute('data-tog')); }); });
    listBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
  }

  function buscar(id) { return codigos.filter(function (x) { return x.id === id; })[0]; }

  // El SVG lo arma el servidor: acá solo se descarga tal cual, en escala grande para imprimir
  async function bajarSvg(id) {
    var c = buscar(id);
    if (!c) return;
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se descarga el código en SVG'); return; }
    try {
      var res = await fetch(imagen(c, 16));
      if (!res.ok) throw new Error('No se pudo generar la imagen');
      var texto = await res.text();
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml' }));
      a.download = 'qr-' + c.slug + '.svg';
      a.click();
      App.toast('Código descargado en SVG (calidad de imprenta)');
    } catch (err) { App.toast(err.message); }
  }

  // El PNG se rasteriza en el navegador a partir del MISMO SVG del servidor: quien lo mande
  // por WhatsApp necesita un mapa de bits, y así no hace falta un codificador PNG en el backend.
  async function bajarPng(id) {
    var c = buscar(id);
    if (!c) return;
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se descarga el código en PNG'); return; }
    try {
      var res = await fetch(imagen(c, 16));
      if (!res.ok) throw new Error('No se pudo generar la imagen');
      var svgTexto = await res.text();
      var url = URL.createObjectURL(new Blob([svgTexto], { type: 'image/svg+xml' }));
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = img.width || 600;
        canvas.height = img.height || 600;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'qr-' + c.slug + '.png';
          a.click();
          App.toast('Código descargado en PNG');
        });
      };
      img.onerror = function () { App.toast('No se pudo convertir el código a PNG'); };
      img.src = url;
    } catch (err) { App.toast(err.message); }
  }

  function copiar(id) {
    var c = buscar(id);
    if (!c) return;
    var url = corto(c);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { App.toast('Enlace copiado'); }, function () { App.toast(url); });
    } else {
      App.toast(url);
    }
  }

  function pintarDetalle(d) {
    var maximo = Math.max.apply(null, d.serie.map(function (p) { return p.scans; }).concat([1]));
    var totalDisp = d.dispositivos.reduce(function (a, x) { return a + x.scans; }, 0);
    detBox.innerHTML = '<div class="card" style="margin-top:22px">' +
      '<h3 style="margin:0 0 4px">' + App.esc(d.code.title) + '</h3>' +
      '<p class="muted" style="margin:0 0 10px;font-size:.88rem">Escaneos de los últimos 14 días · ' + (d.code.scans || 0) + ' en total</p>' +
      (window.__PREVIEW__ ? DEMO : '<img class="qr-grande" src="' + App.esc(imagen(d.code, 8)) + '" alt="Código QR de ' + App.esc(d.code.title) + '">') +
      '<div class="qr-serie" id="qr-serie">' + d.serie.map(function (p) {
        return '<div class="qr-barra" data-alto="' + Math.round(p.scans / maximo * 100) + '" style="height:2px" title="' + p.dia + ': ' + p.scans + '">' + (p.scans ? '<span>' + p.scans + '</span>' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="qr-dias">' + d.serie.map(function (p) { return '<div>' + p.dia.slice(8) + '</div>'; }).join('') + '</div>' +
      '<h4 style="margin:22px 0 6px">Desde dónde escanearon</h4>' +
      (totalDisp ? d.dispositivos.map(function (x) {
        return '<div class="qr-disp"><span>' + App.esc(x.disp) + '</span><strong>' + x.scans + '</strong></div>';
      }).join('') : '<p class="muted">Todavía nadie escaneó este código.</p>') +
      '</div>';
    var barras = detBox.querySelectorAll('.qr-barra');
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

  formQr.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se generaría el código QR'); return; }
    try {
      var nuevo = await App.api('/api/qr', { method: 'POST', body: {
        title: formQr.querySelector('[name="title"]').value,
        slug: formQr.querySelector('[name="slug"]').value,
        tipo: selTipo.value,
        ec: formQr.querySelector('[name="ec"]').value,
        destino: formQr.querySelector('[name="destino"]').value,
        contenido: formQr.querySelector('[name="contenido"]').value,
      } });
      formQr.reset();
      selTipo.dispatchEvent(new Event('change'));
      codigos = [nuevo].concat(codigos);
      pintarLista();
      cargarStats();
      App.toast('Código generado: ya podés descargarlo');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  async function detalle(id) {
    if (window.__PREVIEW__) {
      pintarDetalle({ code: { title: 'Carta para las mesas', scans: 342, slug: 'carta', ec: 'M' }, serie: [{ dia: '2026-07-18', scans: 21 }, { dia: '2026-07-19', scans: 48 }, { dia: '2026-07-20', scans: 63 }, { dia: '2026-07-21', scans: 39 }], dispositivos: [{ disp: 'móvil', scans: 320 }, { disp: 'escritorio', scans: 22 }] });
      return;
    }
    try { pintarDetalle(await App.api('/api/qr/' + id + '/detalle')); }
    catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function alternar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se pausa o reactiva el código'); return; }
    var c = buscar(id);
    try {
      var upd = await App.api('/api/qr/' + id, { method: 'PUT', body: { active: c.active === false } });
      codigos = codigos.map(function (x) { return x.id === id ? upd : x; });
      pintarLista();
      cargarStats();
      App.toast(upd.active === false ? 'Código pausado' : 'Código reactivado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function borrar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se borraría el código'); return; }
    if (!confirm('¿Borrar este código QR? Los que ya estén impresos van a dejar de funcionar.')) return;
    try {
      await App.api('/api/qr/' + id, { method: 'DELETE' });
      codigos = codigos.filter(function (x) { return x.id !== id; });
      pintarLista();
      detBox.innerHTML = '';
      cargarStats();
      App.toast('Código borrado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  document.getElementById('qr-csv').addEventListener('click', function () {
    var filas = [['titulo', 'nombre_corto', 'tipo', 'enlace_o_contenido', 'destino', 'correccion', 'estado', 'escaneos']].concat(codigos.map(function (c) {
      return [c.title, c.slug, c.tipo, c.tipo === 'texto' ? c.contenido : corto(c), c.destino || '', c.ec || 'M', c.estado, c.scans || 0];
    }));
    var csv = filas.map(function (f) { return f.map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'codigos-qr.csv';
    a.click();
  });

  function cargarStats() {
    App.api('/api/qr/stats').then(pintarStats).catch(function () {});
  }

  if (window.__PREVIEW__) {
    pintarStats({ total: 4, activos: 3, scans: 512, scansSemana: 171 });
    codigos = [
      { id: 'd1', slug: 'carta', title: 'Carta para las mesas', tipo: 'enlace', destino: 'https://midominio.com/carta.html', ec: 'M', estado: 'activo', active: true, scans: 342 },
      { id: 'd2', slug: 'wifi', title: 'WiFi del local', tipo: 'texto', contenido: 'WIFI:S:MiRed;T:WPA;P:miclave;;', ec: 'Q', estado: 'texto', active: true, scans: 0 },
    ];
    pintarLista();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargarStats();
    App.api('/api/qr').then(function (rows) { codigos = rows; pintarLista(); }).catch(function (err) { listBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
  }
})();`,
  readmeNotes: (cfg) => [
    `**Códigos QR**: se generan en \`/qr-admin.html\` y el código lo arma **tu propio servidor** (\`src/qrcode.js\`, encoder completo de la norma ISO/IEC 18004: modo byte, versiones 1 a 10, niveles de corrección L/M/Q/H y las 8 máscaras). No se le pide nada a ningún servicio externo, así que **nadie más sabe qué está imprimiendo tu negocio** y los códigos siguen saliendo aunque mañana cierre cualquier API de terceros. Hay dos tipos: los de **página**, que se imprimen apuntando a \`${cfg.brand.domain || 'https://tudominio.com'}/q/<nombre>\` y redirigen (302) contando cada escaneo por día y por tipo de dispositivo —el destino se puede **cambiar después sin volver a imprimir**, que es lo que salva un folleto ya repartido—, y los de **texto libre** (red WiFi, teléfono, un mensaje), que guardan el contenido adentro del código y por eso **no se pueden medir ni editar a distancia**. El **nombre corto no se puede editar** a propósito: cambiarlo dejaría muertos todos los códigos ya impresos. Para imprimir usá siempre el **SVG** (no se pixela a ningún tamaño); el PNG está para mandar por WhatsApp. Consejo de imprenta: si el código va sobre una superficie que se puede manchar, doblar o mojar, subilo a corrección **Q** o **H** — el código se lee igual con parte de la superficie arruinada.`,
  ],
};
