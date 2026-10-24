// Roles y permisos con backend real: hasta ahora el sistema tenía dos únicos roles horneados
// ("admin" ve todo, "user" no ve nada de la trastienda) y el pedido más repetido de cualquier
// negocio con empleados era el del medio — "que la recepcionista cargue turnos pero no vea la caja".
// Este módulo lo resuelve SIN tocar los otros 90 módulos: un MIDDLEWARE global mira cada pedido a
// /api/… , resuelve a qué ÁREA pertenece (el mapa de áreas se arma AL GENERAR con las rutas y los
// nombres reales de los módulos activos) y corta con 403 si el rol del usuario no la tiene
// habilitada, distinguiendo consultar (GET) de modificar (POST/PATCH/DELETE). No es una pantalla
// que esconde botones: la puerta está en el servidor, así que da igual si alguien escribe la URL a
// mano o llama la API con curl. Dos modos por rol: "abierto" (puede todo salvo lo que se le quita)
// y "cerrado" (no puede nada salvo lo que se le da). Los usuarios sin rol asignado se comportan
// exactamente como antes: activar el módulo no rompe ningún proyecto existente. El admin siempre
// pasa (nunca se puede dejar el sistema sin nadie que entre). Panel solo-admin /roles-admin.html
// con matriz de áreas, asignación por usuario y KPIs animados con Anime.js + red de seguridad.
// Requiere Autenticación. Distinto de "users-admin" (alta y baja de cuentas) y de "auditoria"
// (registro de lo que ya pasó): acá se define QUIÉN PUEDE HACER QUÉ, antes de que pase.
const { phIcon } = require('../../src/icons');

// Rutas que el portero nunca mira: sin ellas nadie podría iniciar sesión ni administrar los
// propios roles (su router ya exige admin por su cuenta).
const LIBRES = ['/api/auth', '/api/roles'];

module.exports = {
  id: 'roles', type: 'functional', name: 'Roles y permisos',
  description: 'Permisos por área con backend real: un middleware global corta cada pedido a la API según el rol del usuario, distinguiendo consultar de modificar. El mapa de áreas se arma con los módulos activos del proyecto. Dos modos por rol (abierto: puede todo salvo lo quitado / cerrado: no puede nada salvo lo dado). Los usuarios sin rol funcionan como siempre y el admin nunca se bloquea. Panel solo-admin /roles-admin.html con matriz de permisos, asignación por usuario y KPIs animados (Anime.js). Requiere Autenticación.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/roles', file: 'routes/roles.js' }],
  middlewares: [{ file: 'src/middleware/permisos.js' }],
  collections: ['roles'],
  nav: () => [{ label: 'Roles (admin)', href: '/roles-admin.html', id: 'nav-roles-admin' }],
  head: () => `  <style>
    .rl-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .rl-kpis .card{text-align:center}
    .rl-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .rl-rol{margin-bottom:18px}
    .rl-rol header{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:4px}
    .rl-rol h3{margin:0;font-size:1.05rem}
    .rl-modo{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .rl-modo.abierto{background:#2e9e5b20;color:#1d6b3c}
    .rl-modo.cerrado{background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}
    .rl-areas{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px 18px;margin-top:14px}
    .rl-area{display:flex;gap:10px;align-items:center;justify-content:space-between;font-size:.9rem;border-bottom:1px dashed var(--line);padding-bottom:6px}
    .rl-area select{width:auto;min-width:120px;margin:0;font-size:.85rem;padding:4px 8px}
    .rl-acc{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
    .rl-nota{border-left:3px solid var(--accent);padding:12px 16px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0;margin:18px 0;font-size:.9rem}
    .rl-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--muted)}
  </style>`,
  pages: () => ({
    'roles-admin': {
      title: 'Roles y permisos',
      html: `  <section>
    <div class="container">
      <h2>Roles y permisos</h2>
      <p class="section-sub">Definí qué puede ver y qué puede tocar cada persona del equipo. El control corre en el servidor: no alcanza con conocer la dirección de una pantalla.</p>
      <div id="rl-kpis" class="rl-kpis"></div>
      <div class="rl-nota">
        ${phIcon('lock', { size: 16, style: 'vertical-align:-3px;margin-right:6px' })}Los administradores pasan siempre (para que el sistema nunca quede sin nadie que entre) y quien no tiene rol asignado funciona como hasta ahora.
      </div>
      <div class="card" style="margin-bottom:26px">
        <h3>Nuevo rol</h3>
        <form id="rl-form">
          <label>Nombre del rol</label><input name="name" required maxlength="40" placeholder="Recepción, Depósito, Contable…">
          <label>Modo</label>
          <select name="mode">
            <option value="abierto">Abierto — puede todo salvo lo que le saque</option>
            <option value="cerrado">Cerrado — no puede nada salvo lo que le dé</option>
          </select>
          <div style="margin-top:16px"><button class="btn" type="submit">Crear rol</button></div>
        </form>
      </div>
      <div id="rl-lista"><p class="muted">Cargando…</p></div>
      <h3 style="margin-top:36px">Personas del equipo</h3>
      <p class="section-sub">Asigná un rol a cada cuenta. Sin rol, la cuenta sigue funcionando como siempre.</p>
      <div id="rl-usuarios"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  files: (cfg) => {
    // El mapa de áreas se arma con lo que el proyecto REALMENTE monta: cada módulo funcional
    // activo aporta sus rutas de API con su nombre visible. Un módulo nuevo aparece solo.
    const registry = require('../../src/registry');
    const areas = [];
    for (const id of cfg.moduleIds) {
      const m = registry.get(id);
      if (!m || m.type !== 'functional' || !m.mounts) continue;
      const mounts = typeof m.mounts === 'function' ? m.mounts(cfg) : m.mounts;
      const rutas = mounts.map(x => x.route).filter(r => !LIBRES.includes(r));
      if (!rutas.length) continue;
      areas.push({ key: id, label: m.name, routes: rutas });
    }
    areas.sort((a, b) => a.label.localeCompare(b.label, 'es'));
    // Rol de ejemplo: consulta de todo sin poder modificar nada. Se siembra una sola vez.
    const semilla = [{ key: 'consulta', name: 'Consulta', mode: 'abierto', perms: Object.fromEntries(areas.map(a => [a.key, 'read'])) }];

    return {
      'src/middleware/permisos.js': `/**
 * Portero de la API. Montado ANTES de los estáticos y de los routers (ver src/app.js), mira cada
 * pedido a /api/… , resuelve el ÁREA por el prefijo de la ruta y decide con el rol del usuario.
 * Reglas, en orden:
 *   1. Lo que no es /api/ o cae en una ruta libre (login, este mismo panel) pasa derecho.
 *   2. Sin sesión válida pasa: cada ruta ya decide si es pública o responde 401 por su cuenta.
 *   3. El rol admin pasa siempre: el sistema nunca puede quedar sin nadie que entre.
 *   4. Sin rol asignado pasa: activar el módulo no cambia el comportamiento de nadie.
 *   5. Con rol: 'none' corta todo, 'read' deja consultar (GET/HEAD) y corta lo que modifica.
 * El mapa de áreas se generó con los módulos activos de este proyecto.
 */
const { verify } = require('../token');
const db = require('../db');

// Áreas del proyecto: prefijo de API → clave y nombre visible
const AREAS = ${JSON.stringify(areas, null, 2).split('\n').join('\n')};
const LIBRES = ${JSON.stringify(LIBRES)};

const bajo = (p, base) => p === base || p.startsWith(base + '/');

/** Área a la que pertenece una ruta (null si la ruta no está bajo ningún módulo conocido) */
function areaDe(path) {
  for (const a of AREAS) for (const r of a.routes) if (bajo(path, r)) return a;
  return null;
}

module.exports = async function permisos(req, res, next) {
  const path = req.path || '';
  if (!path.startsWith('/api/')) return next();
  if (LIBRES.some(l => bajo(path, l))) return next();
  const area = areaDe(path);
  if (!area) return next();

  const payload = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
  if (!payload || payload.role === 'admin') return next();

  const user = await db.get('users', payload.sub);
  if (!user || !user.roleKey) return next();
  const rol = (await db.find('roles', r => r.key === user.roleKey))[0];
  if (!rol) return next();

  // Modo del rol: en "abierto" lo no configurado se permite; en "cerrado" se niega.
  const nivel = (rol.perms && rol.perms[area.key]) || (rol.mode === 'cerrado' ? 'none' : 'write');
  const modifica = req.method !== 'GET' && req.method !== 'HEAD';
  if (nivel === 'none') {
    return res.status(403).json({ error: 'Tu rol (' + rol.name + ') no tiene acceso a ' + area.label });
  }
  if (nivel === 'read' && modifica) {
    return res.status(403).json({ error: 'Tu rol (' + rol.name + ') puede consultar ' + area.label + ' pero no modificarlo' });
  }
  next();
};
`,
      'routes/roles.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, oneOf } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

// Áreas del proyecto (mismo mapa que usa el middleware, sin las rutas)
const AREAS = ${JSON.stringify(areas.map(a => ({ key: a.key, label: a.label })), null, 2)};
const NIVELES = ['none', 'read', 'write'];
const MODOS = ['abierto', 'cerrado'];

// Siembra un rol de ejemplo ("Consulta": ve todo, no toca nada) la primera vez
db.seedIfEmpty('roles', ${JSON.stringify(semilla, null, 2)});

// Clave estable a partir del nombre (es la que queda guardada en cada usuario)
const claveDe = (nombre) => String(nombre).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30) || 'rol';

// Deja sólo las áreas que existen en este proyecto y con un nivel válido
function limpiarPerms(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const a of AREAS) {
    const v = raw[a.key];
    if (NIVELES.includes(v)) out[a.key] = v;
  }
  return out;
}

// GET /api/roles/areas — las áreas que puede regular este proyecto
router.get('/areas', requireAdmin, (req, res) => res.json(AREAS));

// GET /api/roles — roles definidos, con la cantidad de personas que los tienen
router.get('/', requireAdmin, async (req, res) => {
  const roles = await db.all('roles');
  const users = await db.all('users');
  res.json(roles.map(r => ({ ...r, users: users.filter(u => u.roleKey === r.key).length })));
});

// POST /api/roles — crea un rol (clave única derivada del nombre)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = check(req.body, {
    name: (v) => str(v, 2, 40),
    mode: (v) => v === undefined || oneOf(v, MODOS),
  });
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const key = claveDe(req.body.name);
  if ((await db.find('roles', r => r.key === key)).length) {
    return res.status(409).json({ error: 'Ya existe un rol con ese nombre' });
  }
  const row = await db.insert('roles', {
    key,
    name: req.body.name.trim(),
    mode: MODOS.includes(req.body.mode) ? req.body.mode : 'abierto',
    perms: limpiarPerms(req.body.perms),
  });
  res.status(201).json({ ...row, users: 0 });
});

// PATCH /api/roles/:id — cambia nombre, modo y/o matriz de permisos (la clave no se toca:
// es la que quedó guardada en los usuarios)
router.patch('/:id', requireAdmin, async (req, res) => {
  const rol = await db.get('roles', req.params.id);
  if (!rol) return res.status(404).json({ error: 'Rol inexistente' });
  const patch = {};
  if (req.body.name !== undefined) {
    if (!str(req.body.name, 2, 40)) return res.status(422).json({ error: 'Nombre inválido' });
    patch.name = req.body.name.trim();
  }
  if (req.body.mode !== undefined) {
    if (!MODOS.includes(req.body.mode)) return res.status(422).json({ error: 'Modo inválido' });
    patch.mode = req.body.mode;
  }
  if (req.body.perms !== undefined) patch.perms = limpiarPerms(req.body.perms);
  if (!Object.keys(patch).length) return res.status(422).json({ error: 'Nada para actualizar' });
  res.json(await db.update('roles', req.params.id, patch));
});

// DELETE /api/roles/:id — borra el rol y libera a quienes lo tenían (nadie queda con un rol fantasma)
router.delete('/:id', requireAdmin, async (req, res) => {
  const rol = await db.get('roles', req.params.id);
  if (!rol) return res.status(404).json({ error: 'Rol inexistente' });
  const afectados = await db.find('users', u => u.roleKey === rol.key);
  for (const u of afectados) await db.update('users', u.id, { roleKey: '' });
  await db.remove('roles', req.params.id);
  res.json({ ok: true, liberados: afectados.length });
});

// GET /api/roles/usuarios — cuentas del sistema con su rol asignado
router.get('/usuarios', requireAdmin, async (req, res) => {
  const rows = await db.all('users');
  res.json(rows.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, roleKey: u.roleKey || '' })));
});

// PATCH /api/roles/usuarios/:id — asigna (o quita, con "") el rol de una cuenta
router.patch('/usuarios/:id', requireAdmin, async (req, res) => {
  const user = await db.get('users', req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario inexistente' });
  if (user.id === req.user.sub) {
    return res.status(409).json({ error: 'No podés cambiarte el rol a vos mismo (evita quedarte afuera)' });
  }
  const key = String(req.body.roleKey || '').trim();
  if (key && !(await db.find('roles', r => r.key === key)).length) {
    return res.status(422).json({ error: 'Ese rol no existe' });
  }
  const upd = await db.update('users', user.id, { roleKey: key });
  res.json({ id: upd.id, name: upd.name, email: upd.email, role: upd.role, roleKey: upd.roleKey || '' });
});

module.exports = router;
`,
    };
  },
  clientJs: () => `/* Módulo roles y permisos: matriz de áreas por rol, asignación por usuario y KPIs con
   count-up (Anime.js + red de seguridad para pestaña oculta). Sólo admin. */
(function () {
  var lista = document.getElementById('rl-lista');
  if (!lista) return;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
    lista.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
    var ux = document.getElementById('rl-usuarios');
    if (ux) ux.innerHTML = '';
    return;
  }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var attr = function (s) { return App.esc(s).replace(/"/g, '&quot;'); };
  var NIVELES = [['write', 'Total'], ['read', 'Sólo consultar'], ['none', 'Sin acceso']];
  var areas = [], roles = [], usuarios = [];

  // Count-up de un número (con red de seguridad si el loop está pausado)
  function contar(el, valor) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = valor; return; }
    var obj = { v: 0 };
    anime.animate(obj, { v: valor, duration: 650, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(obj.v); } });
    setTimeout(function () { el.textContent = valor; }, 850);
  }

  function pintarKpis() {
    var box = document.getElementById('rl-kpis');
    if (!box) return;
    var conRol = usuarios.filter(function (u) { return u.roleKey; }).length;
    var datos = [['Roles definidos', roles.length], ['Personas con rol', conRol], ['Áreas del sistema', areas.length]];
    box.innerHTML = datos.map(function (d) {
      return '<div class="card"><strong data-rl-kpi="' + d[1] + '">0</strong><span class="muted">' + d[0] + '</span></div>';
    }).join('');
    box.querySelectorAll('[data-rl-kpi]').forEach(function (el) { contar(el, Number(el.getAttribute('data-rl-kpi'))); });
  }

  function pintarRoles() {
    if (!roles.length) { lista.innerHTML = '<p class="muted">Todavía no hay roles definidos.</p>'; return; }
    lista.innerHTML = roles.map(function (r) {
      var filas = areas.map(function (a) {
        var nivel = (r.perms && r.perms[a.key]) || (r.mode === 'cerrado' ? 'none' : 'write');
        var opts = NIVELES.map(function (n) {
          return '<option value="' + n[0] + '"' + (n[0] === nivel ? ' selected' : '') + '>' + n[1] + '</option>';
        }).join('');
        return '<div class="rl-area"><span>' + App.esc(a.label) + '</span>' +
          '<select data-rl-perm="' + r.id + '" data-rl-area="' + a.key + '">' + opts + '</select></div>';
      }).join('');
      return '<div class="card rl-rol">' +
        '<header><h3>' + App.esc(r.name) + '</h3>' +
        '<span class="rl-modo ' + (r.mode === 'cerrado' ? 'cerrado' : 'abierto') + '">' + (r.mode === 'cerrado' ? 'Cerrado' : 'Abierto') + '</span>' +
        '<span class="rl-chip">' + r.users + (r.users === 1 ? ' persona' : ' personas') + '</span></header>' +
        '<p class="muted" style="margin:0;font-size:.85rem">' + (r.mode === 'cerrado'
          ? 'Sólo puede lo que esté marcado como Total o Sólo consultar.'
          : 'Puede todo, salvo lo que esté marcado como Sin acceso o Sólo consultar.') + '</p>' +
        '<div class="rl-areas">' + filas + '</div>' +
        '<div class="rl-acc">' +
        '<button class="btn" type="button" data-rl-guardar="' + r.id + '">Guardar permisos</button>' +
        '<button class="btn ghost" type="button" data-rl-modo="' + r.id + '">Cambiar a ' + (r.mode === 'cerrado' ? 'abierto' : 'cerrado') + '</button>' +
        '<button class="btn ghost" type="button" data-rl-borrar="' + r.id + '">Eliminar</button>' +
        '</div></div>';
    }).join('');

    lista.querySelectorAll('[data-rl-guardar]').forEach(function (b) {
      b.addEventListener('click', function () { guardarPerms(b.getAttribute('data-rl-guardar')); });
    });
    lista.querySelectorAll('[data-rl-modo]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-rl-modo');
        var r = roles.filter(function (x) { return x.id === id; })[0];
        if (r) patchRol(id, { mode: r.mode === 'cerrado' ? 'abierto' : 'cerrado' });
      });
    });
    lista.querySelectorAll('[data-rl-borrar]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.getAttribute('data-rl-borrar');
        if (!confirm('¿Eliminar el rol? Las personas que lo tengan quedan sin restricciones.')) return;
        if (window.__PREVIEW__) { App.toast('Vista previa: se eliminaría el rol'); return; }
        try {
          var r = await App.api('/api/roles/' + id, { method: 'DELETE' });
          App.toast(r.liberados ? 'Rol eliminado (' + r.liberados + ' persona(s) liberadas)' : 'Rol eliminado');
          cargar();
        } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
      });
    });
  }

  async function guardarPerms(id) {
    var perms = {};
    lista.querySelectorAll('[data-rl-perm="' + id + '"]').forEach(function (s) {
      perms[s.getAttribute('data-rl-area')] = s.value;
    });
    patchRol(id, { perms: perms });
  }

  async function patchRol(id, patch) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el cambio'); return; }
    try {
      await App.api('/api/roles/' + id, { method: 'PATCH', body: patch });
      App.toast('Rol actualizado');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  function pintarUsuarios() {
    var box = document.getElementById('rl-usuarios');
    if (!box) return;
    box.innerHTML = App.table(usuarios, [
      { label: 'Persona', render: function (u) { return '<strong>' + App.esc(u.name) + '</strong><br><span class="muted" style="font-size:.8rem">' + App.esc(u.email) + '</span>'; } },
      { label: 'Cuenta', render: function (u) { return u.role === 'admin' ? '<span class="rl-chip">Administrador</span>' : '<span class="muted">Usuario</span>'; } },
      { label: 'Rol', render: function (u) {
        if (u.role === 'admin') return '<span class="muted" style="font-size:.85rem">Pasa siempre</span>';
        var opts = '<option value="">Sin rol</option>' + roles.map(function (r) {
          return '<option value="' + attr(r.key) + '"' + (r.key === u.roleKey ? ' selected' : '') + '>' + App.esc(r.name) + '</option>';
        }).join('');
        return '<select data-rl-user="' + u.id + '" style="margin:0;width:auto;min-width:150px">' + opts + '</select>';
      } },
    ]);
    box.querySelectorAll('[data-rl-user]').forEach(function (s) {
      s.addEventListener('change', async function () {
        if (window.__PREVIEW__) { App.toast('Vista previa: se asignaría el rol'); return; }
        try {
          await App.api('/api/roles/usuarios/' + s.getAttribute('data-rl-user'), { method: 'PATCH', body: { roleKey: s.value } });
          App.toast('Rol asignado');
          cargar();
        } catch (err) { if (err.message !== 'preview') { App.toast(err.message); cargar(); } }
      });
    });
  }

  async function cargar() {
    if (window.__PREVIEW__) {
      areas = [{ key: 'caja', label: 'Caja diaria' }, { key: 'bookings', label: 'Reservas' }];
      roles = [{ id: '1', key: 'recepcion', name: 'Recepción', mode: 'abierto', perms: { caja: 'none' }, users: 1 }];
      usuarios = [{ id: '1', name: 'Ana Ruiz', email: 'ana@mail.com', role: 'user', roleKey: 'recepcion' }];
    } else {
      try {
        areas = await App.api('/api/roles/areas');
        roles = await App.api('/api/roles');
        usuarios = await App.api('/api/roles/usuarios');
      } catch (err) {
        if (err.message !== 'preview') lista.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
        return;
      }
    }
    pintarKpis();
    pintarRoles();
    pintarUsuarios();
  }

  var form = document.getElementById('rl-form');
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: se crearía el rol'); return; }
    try {
      await App.api('/api/roles', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      App.toast('Rol creado');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  cargar();
})();`,
  readmeNotes: () => [
    '**Roles y permisos**: el control real está en `src/middleware/permisos.js`, que corre antes de los routers y corta con 403 los pedidos a la API que el rol del usuario no tiene habilitados. El mapa de áreas se generó con los módulos activos de este proyecto: si más adelante agregás rutas nuevas, sumalas al arreglo `AREAS` de ese archivo (y al de `routes/roles.js`) para que queden reguladas. Los administradores pasan siempre y las cuentas sin rol asignado no cambian su comportamiento, así que activar el módulo no rompe nada; los permisos empiezan a aplicar recién cuando asignás un rol desde `/roles-admin.html`.',
    '**Un rol restringe, nunca otorga**: darle nivel "Total" sobre un área a una cuenta común no la convierte en administradora. Las rutas que ya exigían rol `admin` lo siguen exigiendo por su cuenta (el portero corre antes, no en lugar de ellas), así que el permiso más amplio que podés dar con un rol es el que esa cuenta ya tenía. Para que alguien administre un área hay que darle además la cuenta de administrador desde el panel de usuarios.',
  ],
};
