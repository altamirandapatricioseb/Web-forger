// Mi perfil con backend real: la pieza que le faltaba a la autenticación del catálogo. Hasta ahora
// un usuario registrado podía entrar y salir, y si olvidaba la clave el módulo "recuperar" se la
// reseteaba por email — pero no había forma de corregir un nombre mal escrito, cambiar el email de
// contacto, cambiar la contraseña estando adentro (lo que pide cualquier norma de seguridad básica)
// ni darse de baja. Todo eso pasa por el servidor con las validaciones que corresponden: la clave
// nueva exige la actual (que alguien te deje la sesión abierta no le alcanza para robarte la
// cuenta), el email nuevo se valida y se chequea que no esté tomado, y como el token JWT lleva
// adentro el nombre, el email y el rol, cada cambio devuelve un TOKEN NUEVO para que la sesión siga
// siendo coherente sin obligar a volver a entrar. La baja de cuenta pide la contraseña y protege al
// último administrador: es imposible dejar el sistema sin nadie que lo administre. Animado con
// Anime.js (entrada escalonada de las tarjetas, medidor de fuerza de la clave) + red de seguridad.

module.exports = {
  id: 'perfil', type: 'functional', name: 'Mi perfil',
  description: 'Página /perfil.html para que cada usuario registrado gestione su cuenta: corregir su nombre y teléfono, cambiar su email (validado y sin pisar el de otro), cambiar la contraseña exigiendo la actual y darse de baja confirmando con su clave. Cada cambio devuelve un token nuevo para que la sesión siga coherente, y el sistema nunca se queda sin administrador. Requiere auth. Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/perfil', file: 'routes/perfil.js' }],
  nav: () => [{ label: 'Mi perfil', href: '/perfil.html', id: 'nav-perfil' }],
  head: () => `  <style>
    .per-cab{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:8px}
    .per-ini{width:64px;height:64px;border-radius:999px;display:grid;place-items:center;flex:none;
      background:color-mix(in srgb,var(--accent) 18%,var(--surface));color:var(--accent);
      font-weight:800;font-size:1.5rem;letter-spacing:-.02em}
    .per-rol{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700;background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent)}
    .per-card{margin-bottom:20px}
    .per-fuerza{height:6px;border-radius:999px;background:var(--line);overflow:hidden;margin-top:8px}
    .per-fuerza i{display:block;height:100%;width:0;background:var(--accent);border-radius:999px}
    .per-peligro{border:1px solid #c0392b40}
    .per-peligro h3{color:#c0392b}
  </style>`,
  files: () => ({
    'routes/perfil.js': `const router = require('express').Router();
const db = require('../src/db');
const User = require('../models/user');
const password = require('../src/password');
const { sign } = require('../src/token');
const { requireAuth } = require('../src/middleware/auth');
const { str, isEmail } = require('../src/validate');

// El token lleva adentro nombre, email y rol: después de cada cambio hay que emitir uno nuevo,
// si no la sesión sigue mostrando los datos viejos hasta que la persona vuelva a entrar.
const nuevoToken = (u) => sign({ sub: u.id, name: u.name, email: u.email, role: u.role });

// GET /api/perfil — mis datos (nunca viaja el hash de la contraseña)
router.get('/', requireAuth, async (req, res) => {
  const user = await db.get('users', req.user.sub);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ...User.publicView(user), phone: user.phone || '' });
});

// PUT /api/perfil — corrige nombre y teléfono
router.put('/', requireAuth, async (req, res) => {
  const user = await db.get('users', req.user.sub);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const patch = {};
  if (req.body.name !== undefined) {
    if (!str(req.body.name, 2, 80)) return res.status(422).json({ error: 'El nombre va entre 2 y 80 caracteres' });
    patch.name = req.body.name.trim();
  }
  if (req.body.phone !== undefined) {
    const v = String(req.body.phone || '').trim();
    if (v && !/^[0-9 ()+-]{6,25}$/.test(v)) return res.status(422).json({ error: 'Teléfono inválido' });
    patch.phone = v;
  }
  const upd = await db.update('users', user.id, patch);
  res.json({ user: { ...User.publicView(upd), phone: upd.phone || '' }, token: nuevoToken(upd) });
});

// PUT /api/perfil/email — cambia el email de acceso (pide la contraseña actual: el email ES la
// llave de entrada, cambiarlo sin verificar la identidad sería secuestrar la cuenta)
router.put('/email', requireAuth, async (req, res) => {
  const user = await db.get('users', req.user.sub);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (!isEmail(req.body.email)) return res.status(422).json({ error: 'Email inválido' });
  if (!password.compare(String(req.body.current || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta' });
  }
  const email = req.body.email.toLowerCase().trim();
  if (email === user.email) return res.status(422).json({ error: 'Ese ya es tu email actual' });
  if ((await db.find('users', u => u.email === email && u.id !== user.id)).length) {
    return res.status(409).json({ error: 'Ese email ya está registrado por otra cuenta' });
  }
  const upd = await db.update('users', user.id, { email });
  res.json({ user: { ...User.publicView(upd), phone: upd.phone || '' }, token: nuevoToken(upd) });
});

// PUT /api/perfil/password — cambia la contraseña exigiendo la actual
router.put('/password', requireAuth, async (req, res) => {
  const user = await db.get('users', req.user.sub);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (!password.compare(String(req.body.current || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta' });
  }
  if (!str(req.body.password, 8, 100)) return res.status(422).json({ error: 'La contraseña nueva necesita al menos 8 caracteres' });
  if (String(req.body.password) === String(req.body.current)) {
    return res.status(422).json({ error: 'La contraseña nueva tiene que ser distinta de la actual' });
  }
  const upd = await db.update('users', user.id, { passwordHash: password.hash(req.body.password) });
  res.json({ ok: true, token: nuevoToken(upd) });
});

// DELETE /api/perfil — baja de cuenta, confirmando con la contraseña. Nunca se puede borrar al
// último administrador: el sistema quedaría sin nadie que lo administre y sin forma de volver.
router.delete('/', requireAuth, async (req, res) => {
  const user = await db.get('users', req.user.sub);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (!password.compare(String(req.body.current || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'La contraseña no es correcta' });
  }
  if (user.role === 'admin') {
    const admins = await db.find('users', u => u.role === 'admin');
    if (admins.length <= 1) return res.status(409).json({ error: 'Sos el único administrador: nombrá a otro antes de darte de baja' });
  }
  await db.remove('users', user.id);
  res.json({ ok: true });
});

module.exports = router;
`,
  }),
  pages: () => ({
    perfil: {
      title: 'Mi perfil',
      html: `  <section>
    <div class="container" style="max-width:620px">
      <div class="per-cab">
        <div class="per-ini" id="per-ini" aria-hidden="true">—</div>
        <div>
          <h2 style="margin:0 0 4px" id="per-nombre">Mi perfil</h2>
          <p class="muted" style="margin:0"><span id="per-email">—</span> · <span class="per-rol" id="per-rol">—</span></p>
        </div>
      </div>
      <p class="section-sub">Acá gestionás tu cuenta: tus datos, tu email de acceso y tu contraseña.</p>

      <form id="per-datos" class="card per-card">
        <h3 style="margin-top:0">Tus datos</h3>
        <label>Nombre</label>
        <input name="name" required minlength="2" maxlength="80">
        <label>Teléfono (opcional)</label>
        <input name="phone" maxlength="25" placeholder="11 5555-5555">
        <button class="btn ghost" type="submit" style="margin-top:16px">Guardar datos</button>
      </form>

      <form id="per-email-form" class="card per-card">
        <h3 style="margin-top:0">Email de acceso</h3>
        <p class="muted" style="margin:0 0 6px;font-size:.88rem">Con este email entrás al sitio. Para cambiarlo necesitamos tu contraseña actual.</p>
        <label>Email nuevo</label>
        <input name="email" type="email" required>
        <label>Tu contraseña actual</label>
        <input name="current" type="password" required>
        <button class="btn ghost" type="submit" style="margin-top:16px">Cambiar email</button>
      </form>

      <form id="per-pass" class="card per-card">
        <h3 style="margin-top:0">Contraseña</h3>
        <label>Contraseña actual</label>
        <input name="current" type="password" required>
        <label>Contraseña nueva</label>
        <input name="password" type="password" required minlength="8">
        <div class="per-fuerza" aria-hidden="true"><i id="per-barra"></i></div>
        <p class="muted" style="margin:6px 0 0;font-size:.82rem" id="per-fuerza-txt">Mínimo 8 caracteres.</p>
        <button class="btn ghost" type="submit" style="margin-top:16px">Cambiar contraseña</button>
      </form>

      <form id="per-baja" class="card per-card per-peligro">
        <h3 style="margin-top:0">Dar de baja mi cuenta</h3>
        <p class="muted" style="margin:0 0 6px;font-size:.88rem">Se borra tu usuario y no vas a poder volver a entrar con él. Esta acción no se puede deshacer.</p>
        <label>Confirmá con tu contraseña</label>
        <input name="current" type="password" required>
        <button class="btn ghost" type="submit" style="margin-top:16px;color:#c0392b;border-color:#c0392b">Dar de baja mi cuenta</button>
      </form>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo mi perfil: página /perfil.html con los datos de la cuenta, el cambio de email y de
   contraseña y la baja. Cada cambio guarda el token nuevo que devuelve el servidor, así la sesión
   nunca queda con datos viejos. Animado con Anime.js (entrada escalonada de las tarjetas, medidor
   de fuerza de la clave) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  // El link "Mi perfil" solo tiene sentido con sesión iniciada
  var navPer = document.getElementById('nav-perfil');
  if (navPer && !me && !window.__PREVIEW__) navPer.style.display = 'none';

  var formDatos = document.getElementById('per-datos');
  if (!formDatos) return;
  var formEmail = document.getElementById('per-email-form');
  var formPass = document.getElementById('per-pass');
  var formBaja = document.getElementById('per-baja');
  var barra = document.getElementById('per-barra');
  var fuerzaTxt = document.getElementById('per-fuerza-txt');

  // Guarda la sesión nueva que devuelve el servidor tras cada cambio (el token lleva nombre,
  // email y rol adentro: sin esto la navbar seguiría mostrando los datos viejos)
  function guardarSesion(r) {
    if (r.token) localStorage.setItem('token', r.token);
    if (r.user) { localStorage.setItem('user', JSON.stringify(r.user)); pintar(r.user); }
  }

  function pintar(u) {
    document.getElementById('per-nombre').textContent = u.name || 'Mi perfil';
    document.getElementById('per-email').textContent = u.email || '—';
    document.getElementById('per-rol').textContent = u.role === 'admin' ? 'administrador' : 'usuario';
    document.getElementById('per-ini').textContent = String(u.name || '?').trim().charAt(0).toUpperCase();
    formDatos.querySelector('[name="name"]').value = u.name || '';
    formDatos.querySelector('[name="phone"]').value = u.phone || '';
    formEmail.querySelector('[name="email"]').value = '';
  }

  // Medidor de fuerza: largo + variedad de caracteres. Es una guía visual, la regla real
  // (mínimo 8 caracteres) la aplica el servidor.
  function fuerza(v) {
    var p = 0;
    if (v.length >= 8) p += 35;
    if (v.length >= 12) p += 20;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) p += 15;
    if (/[0-9]/.test(v)) p += 15;
    if (/[^a-zA-Z0-9]/.test(v)) p += 15;
    return Math.min(100, p);
  }

  formPass.querySelector('[name="password"]').addEventListener('input', function (e) {
    var p = fuerza(e.target.value);
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(barra, { width: p + '%', duration: 320, ease: 'outCubic' });
      // Red de seguridad: fija el ancho final si el loop está pausado (pestaña oculta)
      setTimeout(function () { barra.style.width = p + '%'; }, 500);
    } else {
      barra.style.width = p + '%';
    }
    fuerzaTxt.textContent = !e.target.value ? 'Mínimo 8 caracteres.'
      : p < 50 ? 'Contraseña débil: sumá largo, mayúsculas o símbolos.'
      : p < 85 ? 'Contraseña aceptable.' : 'Contraseña fuerte.';
  });

  formDatos.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se guardarían tus datos'); return; }
    try {
      guardarSesion(await App.api('/api/perfil', { method: 'PUT', body: {
        name: formDatos.querySelector('[name="name"]').value,
        phone: formDatos.querySelector('[name="phone"]').value,
      } }));
      App.toast('Datos guardados');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  formEmail.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se cambiaría tu email'); return; }
    try {
      guardarSesion(await App.api('/api/perfil/email', { method: 'PUT', body: {
        email: formEmail.querySelector('[name="email"]').value,
        current: formEmail.querySelector('[name="current"]').value,
      } }));
      formEmail.reset();
      App.toast('Email actualizado: ya podés entrar con el nuevo');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  formPass.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se cambiaría tu contraseña'); return; }
    try {
      var r = await App.api('/api/perfil/password', { method: 'PUT', body: {
        current: formPass.querySelector('[name="current"]').value,
        password: formPass.querySelector('[name="password"]').value,
      } });
      if (r.token) localStorage.setItem('token', r.token);
      formPass.reset();
      barra.style.width = '0';
      fuerzaTxt.textContent = 'Mínimo 8 caracteres.';
      App.toast('Contraseña cambiada');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  formBaja.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se daría de baja la cuenta'); return; }
    if (!confirm('¿Dar de baja tu cuenta? Se borra tu usuario y no vas a poder volver a entrar con él.')) return;
    try {
      await App.api('/api/perfil', { method: 'DELETE', body: { current: formBaja.querySelector('[name="current"]').value } });
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      alert('Tu cuenta fue dada de baja. Gracias por haber sido parte.');
      location.href = '/index.html';
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  var tarjetas = document.querySelectorAll('.per-card');
  function entrar() {
    var anime = window.anime;
    if (anime && anime.animate && !reduce && tarjetas.length) {
      anime.animate(tarjetas, { opacity: [0, 1], translateY: [16, 0], duration: 440, delay: anime.stagger ? anime.stagger(70) : 0, ease: 'outCubic' });
      // Red de seguridad: deja las tarjetas visibles aunque el loop esté pausado (pestaña oculta)
      setTimeout(function () {
        tarjetas.forEach(function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
      }, 440 + 70 * tarjetas.length + 200);
    }
  }

  if (window.__PREVIEW__) {
    pintar({ name: 'Ana López', email: 'ana@mail.com', role: 'user', phone: '11 5555-5555' });
    entrar();
  } else if (!me) {
    location.href = '/auth.html';
  } else {
    pintar(me);
    entrar();
    // Los datos frescos del servidor mandan sobre lo guardado en el navegador
    App.api('/api/perfil').then(pintar).catch(function (err) { App.toast(err.message); });
  }
})();`,
  readmeNotes: () => [
    `**Mi perfil**: cada usuario registrado gestiona su cuenta en \`/perfil.html\` — nombre y teléfono, **email de acceso** (pide la contraseña actual, porque el email es la llave de entrada) y **contraseña** (también exige la actual: tener la sesión abierta no alcanza para robar una cuenta). Como el token JWT lleva adentro nombre, email y rol, **cada cambio devuelve un token nuevo** que el frontend guarda solo: la sesión sigue coherente sin volver a entrar. La **baja de cuenta** se confirma con la contraseña y está protegida: el **último administrador no se puede borrar**. Ojo: dar de baja borra el usuario, no los datos que esa persona haya generado en otros módulos (pedidos, turnos, comprobantes), que quedan asociados a su email para el historial del negocio — si necesitás borrado total por pedido de privacidad, hay que sumar esa limpieza a mano.`,
  ],
};
