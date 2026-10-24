// Recuperación de contraseña con backend real: el clásico "olvidé mi contraseña" que hasta ahora le
// faltaba al módulo de autenticación. El usuario pide el reset en /recuperar.html, el servidor genera
// un TOKEN de un solo uso (32 bytes de crypto, vence en 60 minutos, invalida los anteriores del
// mismo usuario) y le manda POR EMAIL el link a /nueva-clave.html?t=… usando mailer.notifyTo() — el
// primer módulo que le escribe AL CLIENTE y no al negocio, cerrando el pendiente más viejo del
// proyecto. Sin RESEND_API_KEY el módulo funciona igual: el email con el link queda registrado en la
// bandeja de salida (/emails-admin.html), así que el negocio siempre puede recuperarlo. La respuesta
// del pedido es SIEMPRE la misma exista o no el email (no se puede enumerar usuarios), el token se
// consume al cambiar la contraseña y todos los tokens vivos del usuario se invalidan de una. El link
// "¿Olvidaste tu contraseña?" se inyecta en el formulario de login sin tocar el módulo auth. Animado
// con Anime.js (aparición de las tarjetas, medidor de fuerza de la contraseña) + red de seguridad.

module.exports = {
  id: 'recuperar', type: 'functional', name: 'Recuperar contraseña',
  description: 'Flujo completo de "olvidé mi contraseña": /recuperar.html pide el email y el servidor manda por email un link con token de un solo uso (32 bytes, vence a los 60 minutos) a /nueva-clave.html. La respuesta es siempre igual exista o no el email (no se pueden enumerar usuarios) y cambiar la clave invalida todos los tokens vivos. Sin clave de envío el link queda igual en la bandeja de salida. Requiere Autenticación y Avisos por email. Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth', 'mailer'],
  mounts: [{ route: '/api/recuperar', file: 'routes/recuperar.js' }],
  collections: ['resets'],
  head: () => `  <style>
    .rc-ok{border-left:3px solid var(--accent);padding:14px 18px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0;margin-top:18px}
    .rc-fuerza{height:5px;border-radius:999px;background:var(--line);overflow:hidden;margin:8px 0 4px}
    .rc-fuerza span{display:block;height:100%;width:100%;border-radius:999px;background:var(--accent);
      transform:scaleX(0);transform-origin:left;transition:transform .25s ease}
    .rc-nota{font-size:.82rem}
  </style>`,
  files: () => ({
    'routes/recuperar.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { isEmail, str } = require('../src/validate');
const password = require('../src/password');
const mailer = require('../src/mailer');

const VIGENCIA_MIN = 60; // el link vence a la hora: suficiente para el usuario, corto para un atacante

// Token vivo (no usado y no vencido) a partir de su valor
async function tokenVivo(valor) {
  if (typeof valor !== 'string' || valor.length < 32) return null;
  const t = (await db.find('resets', r => r.token === valor))[0];
  if (!t || t.usedAt) return null;
  return Date.parse(t.expiresAt) > Date.now() ? t : null;
}

// POST /api/recuperar — pide el link de recuperación (público).
// SIEMPRE responde lo mismo exista o no el email: si respondiera distinto, cualquiera podría
// averiguar qué direcciones están registradas probando una por una.
router.post('/', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const respuesta = { ok: true, message: 'Si ese email tiene una cuenta, te mandamos el link para cambiar la contraseña.' };
  if (!isEmail(email)) return res.status(422).json({ error: 'Revisá el email' });
  const user = (await db.find('users', u => u.email === email))[0];
  if (!user) return res.json(respuesta);

  // Un pedido nuevo invalida los anteriores: nunca queda más de un link vivo por usuario
  for (const viejo of await db.find('resets', r => r.userId === user.id && !r.usedAt)) {
    await db.update('resets', viejo.id, { usedAt: new Date().toISOString(), canceled: true });
  }
  const token = crypto.randomBytes(32).toString('hex');
  await db.insert('resets', {
    userId: user.id,
    email,
    token,
    expiresAt: new Date(Date.now() + VIGENCIA_MIN * 60000).toISOString(),
    usedAt: '',
  });
  // Base del link: el host real del pedido, así funciona igual en local y en el dominio publicado
  const base = (req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.get('host');
  const link = base + '/nueva-clave.html?t=' + token;
  // Email AL USUARIO (no al negocio). Es "disparar y seguir": un email caído no rompe el pedido,
  // y sin clave de envío el link igual queda registrado en la bandeja de salida.
  mailer.notifyTo(email, 'Cambiar tu contraseña',
    'Hola ' + user.name + ':\\n\\nPediste cambiar la contraseña de tu cuenta. Entrá a este link y elegí una nueva:\\n\\n' +
    link + '\\n\\nEl link vence en ' + VIGENCIA_MIN + ' minutos y se puede usar una sola vez.\\n' +
    'Si no pediste este cambio, ignorá este mensaje: tu contraseña sigue siendo la misma.').catch(() => {});
  res.json(respuesta);
});

// GET /api/recuperar/validar?t=… — ¿el link sigue sirviendo? (público, para avisar antes del form)
router.get('/validar', async (req, res) => {
  const t = await tokenVivo(String(req.query.t || ''));
  if (!t) return res.status(410).json({ error: 'Este link ya venció o fue usado. Pedí uno nuevo.' });
  res.json({ ok: true, email: t.email });
});

// POST /api/recuperar/cambiar — fija la contraseña nueva y consume el token (público)
router.post('/cambiar', async (req, res) => {
  const t = await tokenVivo(String(req.body.token || ''));
  if (!t) return res.status(410).json({ error: 'Este link ya venció o fue usado. Pedí uno nuevo.' });
  if (!str(req.body.password, 8, 100)) {
    return res.status(422).json({ error: 'La contraseña nueva tiene que tener al menos 8 caracteres' });
  }
  const user = await db.get('users', t.userId);
  if (!user) return res.status(404).json({ error: 'La cuenta ya no existe' });
  await db.update('users', user.id, { passwordHash: password.hash(req.body.password) });
  // Se consume el token usado y se matan los demás del usuario: un solo link vale, una sola vez
  for (const otro of await db.find('resets', r => r.userId === user.id && !r.usedAt)) {
    await db.update('resets', otro.id, { usedAt: new Date().toISOString(), canceled: otro.id !== t.id });
  }
  mailer.notifyTo(user.email, 'Tu contraseña fue cambiada',
    'Hola ' + user.name + ':\\n\\nTe confirmamos que la contraseña de tu cuenta se cambió recién. ' +
    'Si no fuiste vos, escribinos cuanto antes.').catch(() => {});
  res.json({ ok: true });
});

module.exports = router;
`,
  }),
  pages: () => ({
    recuperar: {
      title: 'Recuperar contraseña',
      html: `  <section>
    <div class="container">
      <form id="rc-form" class="card" style="max-width:420px;margin:0 auto">
        <h2>Recuperar contraseña</h2>
        <p class="muted rc-nota">Poné el email de tu cuenta y te mandamos un link para elegir una contraseña nueva.</p>
        <label>Email</label><input name="email" type="email" required autocomplete="email">
        <div style="margin-top:16px"><button class="btn" type="submit">Mandarme el link</button></div>
        <p class="muted rc-nota" style="margin-top:16px"><a href="/auth.html">Volver a ingresar</a></p>
      </form>
      <div class="rc-ok" id="rc-ok" hidden style="max-width:420px;margin:18px auto 0"></div>
    </div>
  </section>`,
    },
    'nueva-clave': {
      title: 'Elegir contraseña nueva',
      html: `  <section>
    <div class="container">
      <form id="rc-nueva" class="card" style="max-width:420px;margin:0 auto" hidden>
        <h2>Elegí tu contraseña nueva</h2>
        <p class="muted rc-nota" id="rc-para">—</p>
        <label>Contraseña nueva</label>
        <input name="password" type="password" required minlength="8" autocomplete="new-password">
        <div class="rc-fuerza" aria-hidden="true"><span id="rc-barra"></span></div>
        <p class="muted rc-nota" id="rc-nivel">Mínimo 8 caracteres.</p>
        <label>Repetila</label>
        <input name="password2" type="password" required minlength="8" autocomplete="new-password">
        <div style="margin-top:16px"><button class="btn" type="submit">Guardar contraseña</button></div>
      </form>
      <div class="card" id="rc-invalido" style="max-width:420px;margin:0 auto" hidden>
        <h2>El link ya no sirve</h2>
        <p class="muted" id="rc-motivo">Este link venció o ya fue usado.</p>
        <a class="btn ghost" href="/recuperar.html">Pedir uno nuevo</a>
      </div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo recuperar contraseña: pedido del link en /recuperar.html, cambio en
   /nueva-clave.html?t=… y el link "¿Olvidaste tu contraseña?" inyectado en el login sin tocar el
   módulo auth. Animado con Anime.js (aparición de las tarjetas) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function aparecer(el) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) return;
    anime.animate(el, { opacity: [0, 1], translateY: [12, 0], duration: 420, ease: 'outCubic' });
    // Red de seguridad: deja la tarjeta visible aunque el loop esté pausado (pestaña oculta)
    setTimeout(function () { el.style.opacity = 1; el.style.transform = 'none'; }, 800);
  }

  // ---- Link "¿Olvidaste tu contraseña?" dentro del formulario de login del módulo auth ----
  var login = document.getElementById('login-form');
  if (login && !login.querySelector('[data-rc-link]')) {
    var p = document.createElement('p');
    p.className = 'muted rc-nota';
    p.style.marginTop = '10px';
    p.innerHTML = '<a href="/recuperar.html" data-rc-link>¿Olvidaste tu contraseña?</a>';
    var botonera = login.querySelector('button[type="submit"]');
    if (botonera && botonera.parentElement) botonera.parentElement.insertAdjacentElement('afterend', p);
    else login.appendChild(p);
  }

  // ---- /recuperar.html: pedido del link ----
  var formRc = document.getElementById('rc-form');
  if (formRc) {
    var okRc = document.getElementById('rc-ok');
    formRc.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se pediría el link de recuperación'); return; }
      try {
        var r = await App.api('/api/recuperar', { method: 'POST', body: { email: formRc.querySelector('[name="email"]').value } });
        formRc.reset();
        okRc.hidden = false;
        okRc.innerHTML = '<strong>Listo.</strong> ' + App.esc(r.message) + ' Revisá tu casilla (y la carpeta de correo no deseado). El link vale por una hora.';
        aparecer(okRc);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });
  }

  // ---- /nueva-clave.html: cambio efectivo con el token del link ----
  var formNueva = document.getElementById('rc-nueva');
  if (formNueva) {
    var invalido = document.getElementById('rc-invalido');
    var motivo = document.getElementById('rc-motivo');
    var barra = document.getElementById('rc-barra');
    var nivel = document.getElementById('rc-nivel');
    var token = new URLSearchParams(location.search).get('t') || '';

    // Medidor de fuerza: orientativo y calculado en el navegador; el mínimo real lo exige el server
    var campoPass = formNueva.querySelector('[name="password"]');
    campoPass.addEventListener('input', function () {
      var v = campoPass.value;
      var puntos = Math.min(4, (v.length >= 8 ? 1 : 0) + (v.length >= 12 ? 1 : 0) +
        (/[A-Z]/.test(v) && /[a-z]/.test(v) ? 1 : 0) + (/[0-9\\W]/.test(v) ? 1 : 0));
      barra.style.transform = 'scaleX(' + (puntos / 4) + ')';
      nivel.textContent = v.length < 8 ? 'Mínimo 8 caracteres.'
        : ['', 'Débil: sumale largo o números.', 'Aceptable.', 'Buena.', 'Muy buena.'][puntos];
    });

    function mostrarInvalido(msg) {
      formNueva.hidden = true;
      invalido.hidden = false;
      if (msg) motivo.textContent = msg;
      aparecer(invalido);
    }

    formNueva.addEventListener('submit', async function (e) {
      e.preventDefault();
      var p1 = campoPass.value;
      var p2 = formNueva.querySelector('[name="password2"]').value;
      if (p1 !== p2) { App.toast('Las dos contraseñas tienen que ser iguales'); return; }
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se guardaría la contraseña nueva'); return; }
      try {
        await App.api('/api/recuperar/cambiar', { method: 'POST', body: { token: token, password: p1 } });
        App.toast('Contraseña cambiada: ya podés ingresar');
        setTimeout(function () { location.href = '/auth.html'; }, 1200);
      } catch (err) {
        if (err.message === 'preview') return;
        if (String(err.message).indexOf('venció') >= 0) mostrarInvalido(err.message);
        else App.toast(err.message);
      }
    });

    if (window.__PREVIEW__) {
      formNueva.hidden = false;
      document.getElementById('rc-para').textContent = 'Cuenta: ana@mail.com';
      aparecer(formNueva);
    } else if (!token) {
      mostrarInvalido('Te faltó el link: entrá desde el mail que te mandamos.');
    } else {
      App.api('/api/recuperar/validar?t=' + encodeURIComponent(token)).then(function (r) {
        formNueva.hidden = false;
        document.getElementById('rc-para').textContent = 'Cuenta: ' + r.email;
        aparecer(formNueva);
      }).catch(function (err) { mostrarInvalido(err.message); });
    }
  }
})();`,
  readmeNotes: () => [
    `**Recuperar contraseña**: el flujo vive en \`/recuperar.html\` (pedir el link) y \`/nueva-clave.html?t=…\` (elegir la contraseña nueva); el link "¿Olvidaste tu contraseña?" se inyecta solo en el formulario de login. Los tokens se guardan en la colección \`resets\`: **32 bytes de \`crypto\`, un solo uso y 60 minutos de vigencia**, y cada pedido nuevo invalida los anteriores del mismo usuario. El pedido responde **siempre lo mismo exista o no el email**, así nadie puede averiguar qué direcciones están registradas. El link se manda **por email al usuario** (módulo Avisos por email): si todavía no cargaste \`RESEND_API_KEY\`, el email igual queda registrado en la bandeja de salida (\`/emails-admin.html\`) y desde ahí podés pasarle el link a mano — el flujo no depende de ninguna clave para funcionar.`,
  ],
};
