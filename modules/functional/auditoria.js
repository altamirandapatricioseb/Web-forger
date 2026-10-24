// Registro de auditoría con backend real: quién hizo qué y cuándo en la trastienda del sitio. Es
// el requisito clásico de cualquier negocio con más de una persona operando ("¿quién borró el
// pedido?", "¿cuándo cambió ese precio?") y hasta ahora el catálogo no lo tenía. La gracia de la
// implementación: NO hay que tocar ningún módulo. Es un MIDDLEWARE (contrato `middlewares`) que
// observa todos los pedidos que ESCRIBEN (POST/PUT/PATCH/DELETE) contra /api hechos con sesión
// iniciada y anota el movimiento cuando la respuesta termina — con el usuario del token, el módulo
// afectado, la acción, el resultado real (200, 404, 422…) y la IP. Como la tabla de módulos se
// arma AL GENERAR a partir de las rutas montadas, cada movimiento se muestra con el nombre humano
// del módulo ("Banner rotativo") y no con la ruta cruda. El panel /auditoria-admin.html filtra por
// usuario, módulo y días, con KPIs animados, CSV y purga. Animado con Anime.js + red de seguridad.
// Es a prueba de olvidos: un módulo nuevo queda auditado el día que se agrega, sin escribir nada.

module.exports = {
  id: 'auditoria', type: 'functional', name: 'Registro de auditoría',
  description: 'Anota automáticamente quién hizo qué en la administración del sitio: un middleware observa todos los pedidos que escriben (POST/PUT/PATCH/DELETE) hechos con sesión iniciada y registra usuario, módulo afectado, acción, resultado real e IP, sin tocar ni una línea de los demás módulos. Panel /auditoria-admin.html con KPIs, filtros por usuario, módulo y período, CSV y purga. Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/auditoria', file: 'routes/auditoria.js' }],
  middlewares: [{ file: 'src/middleware/auditoria.js' }],
  collections: ['auditlog'],
  nav: () => [{ label: 'Auditoría (admin)', href: '/auditoria-admin.html', id: 'nav-auditoria-admin' }],
  head: () => `  <style>
    .aud-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:22px 0}
    .aud-kpis .card{text-align:center}
    .aud-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .aud-acc{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .aud-acc.creo{background:#2e9e5b20;color:#1d6b3c}
    .aud-acc.edito{background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent)}
    .aud-acc.borro{background:#c0392b20;color:#c0392b}
    .aud-fallo{opacity:.6}
    .aud-filtros{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
    .aud-filtros select,.aud-filtros input{width:auto;min-width:150px}
  </style>`,
  files: (cfg) => {
    // Diccionario ruta → nombre humano del módulo, armado con el registro REAL de módulos
    // seleccionados. El require es perezoso a propósito: el registro carga este archivo, así que
    // pedirlo arriba sería una dependencia circular. Acá adentro ya está todo cargado.
    const registry = require('../../src/registry');
    const etiquetas = {};
    for (const m of registry.selected(cfg.moduleIds)) {
      const mounts = typeof m.mounts === 'function' ? m.mounts(cfg) : (m.mounts || []);
      for (const mt of mounts) {
        // '/api/banners' → 'banners'; '/l' (rutas públicas fuera de /api) no se auditan
        const seg = String(mt.route || '').split('/').filter(Boolean);
        if (seg[0] !== 'api' || !seg[1]) continue;
        etiquetas[seg[1]] = m.name;
      }
    }
    return {
      'src/middleware/auditoria.js': `/**
 * Registro de auditoría. Middleware global montado antes de los estáticos (ver src/app.js).
 * Observa los pedidos que ESCRIBEN contra /api hechos con sesión iniciada y anota el movimiento
 * cuando la respuesta termina, así queda registrado el resultado REAL (incluidos los intentos
 * fallidos: un 403 repetido es justamente lo que interesa ver).
 */
const db = require('../db');
const { verify } = require('../token');

// Módulos del sitio por su primer segmento de ruta, resuelto al generar el proyecto
const MODULOS = ${JSON.stringify(etiquetas, null, 2).split('\n').join('\n')};

// Nunca se audita a sí mismo (ver el panel no es un movimiento) ni el login (no lleva token)
const EXCLUIDAS = ['/api/auditoria'];

const ACCIONES = { POST: 'creo', PUT: 'edito', PATCH: 'edito', DELETE: 'borro' };

function ipDe(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || (req.socket && req.socket.remoteAddress) || 'desconocida';
  return ip.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
}

module.exports = function auditoria(req, res, next) {
  if (!ACCIONES[req.method] || !req.path.startsWith('/api')) return next();
  if (EXCLUIDAS.some(r => req.path === r || req.path.startsWith(r + '/'))) return next();
  const payload = verify(String(req.headers.authorization || '').replace(/^Bearer /, ''));
  if (!payload) return next(); // sin sesión no hay a quién auditar: eso lo cubre el escudo

  const path = req.path;
  const metodo = req.method;
  const ip = ipDe(req);
  const t0 = Date.now();

  // Se anota al terminar la respuesta: así se guarda el status real y nunca se demora al usuario
  // Promise.resolve() a propósito: el driver JSON inserta de forma síncrona y el de Supabase
  // devuelve promesa. Como acá no se puede usar await (esto es un callback de evento), hay que
  // envolver el resultado para que .catch() exista en los dos casos.
  res.on('finish', () => {
    const seg = path.split('/').filter(Boolean);
    const clave = seg[1] || '';
    Promise.resolve(db.insert('auditlog', {
      userId: payload.sub || '',
      email: payload.email || '',
      role: payload.role || '',
      modulo: MODULOS[clave] || clave || 'Sistema',
      moduloId: clave,
      accion: ACCIONES[metodo],
      metodo,
      path,
      status: res.statusCode,
      ok: res.statusCode < 400,
      ip,
      ms: Date.now() - t0,
    })).catch((err) => console.error('[auditoria] no se pudo anotar el movimiento:', err.message));
  });

  next();
};
`,
      'routes/auditoria.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');

const dia = (iso) => String(iso || '').slice(0, 10);

// GET /api/auditoria — movimientos con filtros (solo admin)
// ?email= &modulo= &dias= &accion=  — todo opcional, del más nuevo al más viejo
router.get('/', requireAdmin, async (req, res) => {
  let rows = (await db.all('auditlog')).slice().reverse();
  const email = String(req.query.email || '').toLowerCase().trim();
  const modulo = String(req.query.modulo || '').trim();
  const accion = String(req.query.accion || '').trim();
  const dias = Number(req.query.dias);
  if (email) rows = rows.filter(r => String(r.email).toLowerCase() === email);
  if (modulo) rows = rows.filter(r => r.moduloId === modulo);
  if (accion) rows = rows.filter(r => r.accion === accion);
  if (isFinite(dias) && dias > 0) {
    const corte = Date.now() - dias * 86400000;
    rows = rows.filter(r => (Date.parse(r.createdAt || '') || 0) >= corte);
  }
  res.json(rows.slice(0, 500));
});

// GET /api/auditoria/stats — KPIs + las listas para armar los filtros (solo admin)
router.get('/stats', requireAdmin, async (req, res) => {
  const rows = await db.all('auditlog');
  const hoy = dia(new Date().toISOString());
  const corteSemana = Date.now() - 7 * 86400000;
  const usuarios = {};
  const modulos = {};
  for (const r of rows) {
    usuarios[r.email] = (usuarios[r.email] || 0) + 1;
    if (r.moduloId) modulos[r.moduloId] = r.modulo;
  }
  res.json({
    total: rows.length,
    hoy: rows.filter(r => dia(r.createdAt) === hoy).length,
    semana: rows.filter(r => (Date.parse(r.createdAt || '') || 0) >= corteSemana).length,
    borrados: rows.filter(r => r.accion === 'borro' && r.ok).length,
    fallidos: rows.filter(r => !r.ok).length,
    usuarios: Object.keys(usuarios).sort(),
    modulos: Object.entries(modulos).map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  });
});

// DELETE /api/auditoria/purgar?dias=90 — borra lo más viejo que N días (solo admin).
// Sin "dias" no borra nada: purgar todo el registro de auditoría de un click sería justamente
// lo que un registro de auditoría tiene que hacer difícil.
router.delete('/purgar', requireAdmin, async (req, res) => {
  const dias = Number(req.query.dias);
  if (!isFinite(dias) || dias < 1) return res.status(422).json({ error: 'Indicá desde cuántos días para atrás purgar (mínimo 1)' });
  const corte = Date.now() - dias * 86400000;
  const viejos = (await db.all('auditlog')).filter(r => (Date.parse(r.createdAt || '') || Date.now()) < corte);
  for (const r of viejos) await db.remove('auditlog', r.id);
  res.json({ borrados: viejos.length });
});

module.exports = router;
`,
    };
  },
  pages: () => ({
    'auditoria-admin': {
      title: 'Registro de auditoría',
      html: `  <section>
    <div class="container" style="max-width:1000px">
      <h2>Registro de auditoría</h2>
      <p class="section-sub">Cada alta, edición y baja hecha desde la administración queda anotada con su autor, el módulo afectado y el resultado. Se registra solo: ningún panel tiene que acordarse de avisar. Solo visible para administradores.</p>
      <div class="aud-kpis" id="aud-kpis"></div>
      <div class="aud-filtros">
        <select id="aud-usuario"><option value="">Todos los usuarios</option></select>
        <select id="aud-modulo"><option value="">Todos los módulos</option></select>
        <select id="aud-accion">
          <option value="">Todas las acciones</option>
          <option value="creo">Altas</option>
          <option value="edito">Ediciones</option>
          <option value="borro">Bajas</option>
        </select>
        <select id="aud-dias">
          <option value="">Todo el historial</option>
          <option value="1">Último día</option>
          <option value="7" selected>Última semana</option>
          <option value="30">Último mes</option>
        </select>
        <button class="btn ghost" type="button" id="aud-csv">Descargar CSV</button>
        <button class="btn ghost" type="button" id="aud-purgar" style="color:#c0392b;border-color:#c0392b">Purgar +90 días</button>
      </div>
      <div id="aud-list"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo registro de auditoría: panel solo-admin en /auditoria-admin.html con KPIs, filtros por
   usuario/módulo/acción/período, CSV y purga. Animado con Anime.js (count-up de KPIs) + red de
   seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  // Oculta el link admin de la navbar para quien no es admin (en TODAS las páginas)
  var navAud = document.getElementById('nav-auditoria-admin');
  if (navAud && (!me || me.role !== 'admin') && !window.__PREVIEW__) navAud.style.display = 'none';

  var kpis = document.getElementById('aud-kpis');
  if (!kpis) return;
  var listBox = document.getElementById('aud-list');
  var selUsuario = document.getElementById('aud-usuario');
  var selModulo = document.getElementById('aud-modulo');
  var selAccion = document.getElementById('aud-accion');
  var selDias = document.getElementById('aud-dias');
  var movimientos = [];

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
    kpis.innerHTML = '<div class="card"><strong id="aud-k-hoy">0</strong><span class="muted">movimientos hoy</span></div>' +
      '<div class="card"><strong id="aud-k-sem">0</strong><span class="muted">esta semana</span></div>' +
      '<div class="card"><strong id="aud-k-bor">0</strong><span class="muted">bajas registradas</span></div>' +
      '<div class="card"><strong id="aud-k-fal">0</strong><span class="muted">intentos rechazados</span></div>';
    contar(document.getElementById('aud-k-hoy'), s.hoy);
    contar(document.getElementById('aud-k-sem'), s.semana);
    contar(document.getElementById('aud-k-bor'), s.borrados);
    contar(document.getElementById('aud-k-fal'), s.fallidos);
    // Los filtros se arman con lo que REALMENTE hay registrado, no con una lista fija
    var usuarioActual = selUsuario.value;
    selUsuario.innerHTML = '<option value="">Todos los usuarios</option>' +
      s.usuarios.map(function (u) { return '<option value="' + App.esc(u) + '">' + App.esc(u) + '</option>'; }).join('');
    selUsuario.value = usuarioActual;
    var moduloActual = selModulo.value;
    selModulo.innerHTML = '<option value="">Todos los módulos</option>' +
      s.modulos.map(function (m) { return '<option value="' + App.esc(m.id) + '">' + App.esc(m.nombre) + '</option>'; }).join('');
    selModulo.value = moduloActual;
  }

  var ETIQUETAS = { creo: 'Alta', edito: 'Edición', borro: 'Baja' };
  function pintarLista() {
    listBox.innerHTML = App.table(movimientos, [
      { label: 'Cuándo', render: function (r) { return new Date(r.createdAt).toLocaleString('es-AR'); } },
      { label: 'Quién', render: function (r) { return App.esc(r.email) + '<br><span class="muted" style="font-size:.8rem">' + App.esc(r.role) + '</span>'; } },
      { label: 'Acción', render: function (r) { return '<span class="aud-acc ' + App.esc(r.accion) + '">' + (ETIQUETAS[r.accion] || r.accion) + '</span>'; } },
      { label: 'Módulo', key: 'modulo' },
      { label: 'Resultado', render: function (r) { return r.ok ? String(r.status) : '<span class="aud-fallo">' + r.status + ' rechazado</span>'; } },
      { label: 'Ruta', render: function (r) { return '<span style="font-size:.8rem">' + App.esc(r.path) + '</span>'; } },
    ]);
  }

  function query() {
    var p = [];
    if (selUsuario.value) p.push('email=' + encodeURIComponent(selUsuario.value));
    if (selModulo.value) p.push('modulo=' + encodeURIComponent(selModulo.value));
    if (selAccion.value) p.push('accion=' + encodeURIComponent(selAccion.value));
    if (selDias.value) p.push('dias=' + encodeURIComponent(selDias.value));
    return p.length ? '?' + p.join('&') : '';
  }

  function cargar() {
    App.api('/api/auditoria/stats').then(pintarStats).catch(function (err) { kpis.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    App.api('/api/auditoria' + query()).then(function (rows) { movimientos = rows; pintarLista(); }).catch(function () {});
  }

  [selUsuario, selModulo, selAccion, selDias].forEach(function (s) {
    s.addEventListener('change', function () { if (!window.__PREVIEW__) cargar(); });
  });

  document.getElementById('aud-purgar').addEventListener('click', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: se purgaría lo anterior a 90 días'); return; }
    if (!confirm('¿Borrar del registro los movimientos de más de 90 días? No se puede deshacer.')) return;
    try {
      var r = await App.api('/api/auditoria/purgar?dias=90', { method: 'DELETE' });
      App.toast(r.borrados + ' movimientos purgados');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  document.getElementById('aud-csv').addEventListener('click', function () {
    var filas = [['fecha', 'usuario', 'rol', 'accion', 'modulo', 'metodo', 'ruta', 'status', 'ip']].concat(movimientos.map(function (r) {
      return [r.createdAt, r.email, r.role, ETIQUETAS[r.accion] || r.accion, r.modulo, r.metodo, r.path, r.status, r.ip];
    }));
    var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'auditoria.csv';
    a.click();
  });

  if (window.__PREVIEW__) {
    pintarStats({ total: 128, hoy: 9, semana: 41, borrados: 6, fallidos: 2, usuarios: ['admin@empresa.com'], modulos: [{ id: 'products', nombre: 'Catálogo de productos' }] });
    movimientos = [
      { id: 'd1', createdAt: new Date().toISOString(), email: 'admin@empresa.com', role: 'admin', accion: 'borro', modulo: 'Catálogo de productos', metodo: 'DELETE', path: '/api/products/admin/9f2', status: 200, ok: true, ip: '190.11.22.33' },
      { id: 'd2', createdAt: new Date().toISOString(), email: 'ventas@empresa.com', role: 'user', accion: 'edito', modulo: 'Comprobantes', metodo: 'PUT', path: '/api/invoices/admin/3ab', status: 403, ok: false, ip: '190.11.22.34' },
    ];
    pintarLista();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargar();
  }
})();`,
  readmeNotes: (cfg) => [
    `**Registro de auditoría**: lo alimenta un **middleware** (\`src/middleware/auditoria.js\`) que observa todos los pedidos que escriben (\`POST/PUT/PATCH/DELETE\`) contra \`/api\` hechos **con sesión iniciada**, y anota el movimiento cuando la respuesta termina — por eso queda guardado el resultado real, **incluidos los intentos rechazados** (un 403 repetido es justamente lo que interesa ver). No hay que tocar ningún módulo: la tabla de nombres (\`/api/products\` → "Catálogo de productos") se arma al generar el proyecto, así que **cualquier módulo que agregues después queda auditado solo**. Lo mirás en \`/auditoria-admin.html\` con filtros por usuario, módulo, acción y período, y CSV. El registro se purga a mano (\`+90 días\`)${cfg.moduleIds.includes('tareas') ? ' o solo, con el trabajo "Purga del registro de auditoría" del módulo **Tareas programadas**.' : '; si activás **Tareas programadas**, la purga pasa a ser automática.'} Los pedidos **sin sesión** no se auditan (no hay a quién anotar): de esos se ocupa el módulo **Escudo anti-spam**.`,
  ],
};
