module.exports = {
  id: 'auth', type: 'functional', name: 'Autenticación',
  description: 'Login y registro en páginas separadas (/auth.html y /registro.html), sesiones con JWT (HMAC nativo) y passwords con scrypt. Incluye Dashboard de usuario y Panel Admin.',
  nav: () => [
    { label: 'Mi cuenta', href: '/dashboard.html', id: 'nav-account' },
    { label: 'Admin', href: '/admin.html', id: 'nav-admin' },
  ],
  mounts: [
    { route: '/api/auth', file: 'routes/auth.js' },
    { route: '/api/admin', file: 'routes/admin.js' },
  ],
  env: { JWT_SECRET: 'cambiar-por-un-secreto-largo-y-aleatorio' },
  collections: ['users'],
  pages: () => ({
    // Login en su propia página: /auth.html sigue siendo la página de login (otros módulos linkean acá)
    auth: {
      title: 'Ingresar',
      html: `  <section>
    <div class="container">
      <form id="login-form" class="card" style="max-width:420px;margin:0 auto">
        <h2>Ingresar</h2>
        <label>Email</label><input name="email" type="email" required>
        <label>Contraseña</label><input name="password" type="password" required>
        <div style="margin-top:16px"><button class="btn" type="submit">Ingresar</button></div>
        <p class="muted" style="font-size:.85rem;margin-top:16px">¿No tenés cuenta? <a href="/registro.html">Creá una</a></p>
      </form>
    </div>
  </section>`,
    },
    // Registro separado del login, con la misma estética de card centrada
    registro: {
      title: 'Crear cuenta',
      html: `  <section>
    <div class="container">
      <form id="register-form" class="card" style="max-width:420px;margin:0 auto">
        <h2>Crear cuenta</h2>
        <label>Nombre</label><input name="name" required maxlength="80">
        <label>Email</label><input name="email" type="email" required>
        <label>Contraseña</label><input name="password" type="password" required minlength="8">
        <p class="muted" style="font-size:.8rem">Mínimo 8 caracteres. El primer usuario registrado es administrador.</p>
        <div style="margin-top:8px"><button class="btn ghost" type="submit">Registrarme</button></div>
        <p class="muted" style="font-size:.85rem;margin-top:16px">¿Ya tenés cuenta? <a href="/auth.html">Ingresá</a></p>
      </form>
    </div>
  </section>`,
    },
    dashboard: {
      title: 'Mi cuenta',
      html: `  <section>
    <div class="container">
      <h2>Mi cuenta</h2>
      <div class="grid cols-2">
        <div class="card">
          <h3 id="dash-name">—</h3>
          <p class="muted" id="dash-email">—</p>
          <p class="muted">Rol: <strong id="dash-role">—</strong></p>
          <button class="btn ghost" id="logout-btn">Cerrar sesión</button>
        </div>
        <div class="card" id="dash-activity"><h3>Mi actividad</h3><p class="muted">Sin actividad todavía.</p></div>
      </div>
    </div>
  </section>`,
    },
    admin: {
      title: 'Panel Admin',
      html: `  <section>
    <div class="container">
      <h2>Panel de administración</h2>
      <p class="section-sub">Resumen de datos del sistema. Solo visible para administradores.</p>
      <div class="grid cols-3" id="admin-stats"></div>
      <div id="admin-tables" style="margin-top:32px"></div>
    </div>
  </section>`,
    },
  }),
  files: () => ({
    'src/token.js': `/** JWT minimalista firmado con HMAC-SHA256 (crypto nativo, sin dependencias). */
const crypto = require('crypto');
const SECRET = process.env.JWT_SECRET || 'dev-secret-solo-local';

const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const hmac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');

exports.sign = (payload, hours = 24) => {
  const body = encode({ ...payload, exp: Date.now() + hours * 3600 * 1000 });
  return body + '.' + hmac(body);
};

exports.verify = (token) => {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = hmac(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
};
`,
    'src/password.js': `/** Hash de contraseñas con scrypt + salt (crypto nativo). */
const crypto = require('crypto');

exports.hash = (plain) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(plain, salt, 32).toString('hex');
  return salt + ':' + key;
};

exports.compare = (plain, stored) => {
  const [salt, key] = String(stored).split(':');
  if (!salt || !key) return false;
  const test = crypto.scryptSync(plain, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(test));
};
`,
    'src/middleware/auth.js': `const { verify } = require('../token');

/** Exige un token válido; deja el usuario en req.user */
exports.requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const payload = verify(token);
  if (!payload) return res.status(401).json({ error: 'Necesitás iniciar sesión' });
  req.user = payload;
  next();
};

/** Exige rol admin */
exports.requireAdmin = (req, res, next) => {
  exports.requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Requiere permisos de administrador' });
    next();
  });
};

/** Exige alguno de los roles indicados (admin siempre pasa) */
exports.requireRole = (...roles) => (req, res, next) => {
  exports.requireAuth(req, res, () => {
    if (req.user.role !== 'admin' && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tenés permisos para esta acción' });
    }
    next();
  });
};
`,
    'models/user.js': `const { check, str, isEmail } = require('../src/validate');

/** Modelo Usuario */
exports.validateRegister = (data) => check(data, {
  name: (v) => str(v, 2, 80),
  email: isEmail,
  password: (v) => str(v, 8, 100),
});

exports.publicView = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt });
`,
    'routes/auth.js': `const router = require('express').Router();
const db = require('../src/db');
const User = require('../models/user');
const password = require('../src/password');
const { sign } = require('../src/token');
const { requireAuth } = require('../src/middleware/auth');

// POST /api/auth/register — el primer usuario es admin
router.post('/register', async (req, res) => {
  const { ok, errors } = User.validateRegister(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const email = req.body.email.toLowerCase().trim();
  if ((await db.find('users', u => u.email === email)).length) {
    return res.status(409).json({ error: 'Ese email ya está registrado' });
  }
  const role = (await db.count('users')) === 0 ? 'admin' : 'user';
  const user = (await db.insert('users', {
    name: req.body.name.trim(),
    email,
    passwordHash: password.hash(req.body.password),
    role,
  }));
  const token = sign({ sub: user.id, name: user.name, email: user.email, role: user.role });
  res.status(201).json({ token, user: User.publicView(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const user = (await db.find('users', u => u.email === email))[0];
  if (!user || !password.compare(String(req.body.password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }
  if (user.active === false) {
    return res.status(403).json({ error: 'Tu usuario está desactivado. Contactá a un administrador.' });
  }
  const token = sign({ sub: user.id, name: user.name, email: user.email, role: user.role });
  res.json({ token, user: User.publicView(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = (await db.get('users', req.user.sub));
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(User.publicView(user));
});

module.exports = router;
`,
    'routes/admin.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');

const COLLECTIONS = ['users', 'messages', 'subscribers', 'bookings', 'orders', 'comments', 'products', 'coupons', 'reviews', 'favorites', 'branches', 'movements', 'assignments', 'visits', 'pos', 'sales', 'polls', 'pollvotes', 'tickets', 'feedback', 'leads'];

// GET /api/admin/overview — conteos y últimas filas por colección
router.get('/overview', requireAdmin, async (req, res) => {
  const overview = {};
  for (const name of COLLECTIONS) {
    const rows = (await db.all(name));
    if (!rows.length) continue;
    overview[name] = {
      count: rows.length,
      latest: rows.slice(-5).reverse().map(({ passwordHash, ...safe }) => safe),
    };
  }
  res.json(overview);
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo autenticación */
(function () {
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // Navbar según sesión
  const navAccount = document.getElementById('nav-account');
  const navAdmin = document.getElementById('nav-admin');
  if (navAccount && !user) { navAccount.textContent = 'Ingresar'; navAccount.href = '/auth.html'; }
  if (navAdmin && (!user || user.role !== 'admin')) navAdmin.style.display = 'none';

  const save = ({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    location.href = '/dashboard.html';
  };

  const login = document.getElementById('login-form');
  if (login) login.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { save(await App.api('/api/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(login)) })); }
    catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  const register = document.getElementById('register-form');
  if (register) register.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { save(await App.api('/api/auth/register', { method: 'POST', body: Object.fromEntries(new FormData(register)) })); }
    catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  // Dashboard
  if (document.getElementById('dash-name')) {
    if (!user && !window.__PREVIEW__) location.href = '/auth.html';
    else if (user) {
      document.getElementById('dash-name').textContent = user.name;
      document.getElementById('dash-email').textContent = user.email;
      document.getElementById('dash-role').textContent = user.role;
    }
    document.getElementById('logout-btn').addEventListener('click', () => {
      localStorage.removeItem('token'); localStorage.removeItem('user');
      location.href = '/index.html';
    });
  }

  // Panel admin
  const stats = document.getElementById('admin-stats');
  if (stats && !window.__PREVIEW__) {
    if (!user || user.role !== 'admin') { location.href = '/auth.html'; return; }
    App.api('/api/admin/overview').then(data => {
      const tables = document.getElementById('admin-tables');
      for (const [name, info] of Object.entries(data)) {
        stats.insertAdjacentHTML('beforeend',
          '<div class="card"><h3 style="margin:0">' + info.count + '</h3><p class="muted" style="margin:4px 0 0">' + name + '</p></div>');
        const cols = Object.keys(info.latest[0] || {}).slice(0, 6);
        tables.insertAdjacentHTML('beforeend',
          '<h3 style="text-transform:capitalize">' + name + ' (últimos 5)</h3><div class="card" style="overflow:auto"><table><thead><tr>' +
          cols.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' +
          info.latest.map(r => '<tr>' + cols.map(c => '<td>' + String(r[c] ?? '').slice(0, 48) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>');
      }
    }).catch(err => App.toast(err.message));
  }
})();`,
};
