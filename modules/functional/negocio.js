// Datos del negocio administrables con backend real: una única ficha (colección bizinfo) con la
// razón social, el CUIT, la dirección, el teléfono, el email y el horario de atención del negocio,
// editable desde /negocio-admin.html (solo admin) y consultable públicamente en GET /api/negocio.
// Esos datos se INYECTAN EN VIVO en el pie de todas las páginas del sitio (dirección · teléfono ·
// email · horario, con aparición animada), así el cliente los corrige una sola vez desde el panel
// sin regenerar nada. Si el módulo de comprobantes (invoices) está activo, la razón social, el CUIT
// y la dirección se agregan solos al encabezado del comprobante público (también al imprimirlo):
// cierra el pendiente de "datos del negocio configurables" anotado por la 26ª. Se siembra una ficha
// de ejemplo con el nombre de la marca. Animado con Anime.js (fade del pie, aparición del panel) +
// red de seguridad. Distinto de "hours" (horarios UI estáticos) y "branches" (sucursales múltiples):
// acá es LA ficha institucional única que alimenta al resto del sitio.

module.exports = {
  id: 'negocio', type: 'functional', name: 'Datos del negocio',
  description: 'Ficha única del negocio (razón social, CUIT, dirección, teléfono, email, horario) editable desde /negocio-admin.html y servida por GET /api/negocio: se inyecta en vivo en el pie de todas las páginas y, si el módulo de comprobantes está activo, en el encabezado fiscal del comprobante impreso. Colección bizinfo, sembrada con datos de ejemplo. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/negocio', file: 'routes/negocio.js' }],
  collections: ['bizinfo'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Mi negocio', href: '/negocio-admin.html', id: 'nav-negocio-admin' }] : [],
  head: () => `  <style>
    .ng-footer{width:100%;font-size:.85rem;color:var(--muted);display:flex;gap:6px 18px;flex-wrap:wrap}
    .ng-footer span{white-space:nowrap}
    .neg-fiscal{margin:4px 0 0;font-size:.8rem;color:var(--muted)}
  </style>`,
  files: (cfg) => ({
    'routes/negocio.js': `const router = require('express').Router();
const db = require('../src/db');
const { str, isEmail } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Siembra la ficha del negocio la primera vez (una sola fila; el admin la completa desde el panel)
db.seedIfEmpty('bizinfo', [{
  legalName: ${JSON.stringify(cfg.brand.name + ' S.R.L.')},
  cuit: '30-12345678-9',
  address: 'Av. Siempreviva 123, CABA',
  phone: '+54 11 5555-5555',
  email: ${JSON.stringify('hola@' + cfg.slug + '.com')},
  hoursText: 'Lun a Vie 9 a 18 h · Sáb 9 a 13 h',
}]);

// CUIT argentino: 11 dígitos con guiones opcionales (validación de formato, no de dígito verificador)
const CUIT = /^\\d{2}-?\\d{8}-?\\d$/;

// Devuelve la ficha única (creándola si alguien borró el archivo de datos)
async function ficha() {
  const rows = await db.all('bizinfo');
  if (rows.length) return rows[0];
  return db.insert('bizinfo', { legalName: '', cuit: '', address: '', phone: '', email: '', hoursText: '' });
}

// GET /api/negocio — ficha pública del negocio (la usan el pie de página y el comprobante)
router.get('/', async (req, res) => {
  const f = await ficha();
  res.json({ legalName: f.legalName || '', cuit: f.cuit || '', address: f.address || '', phone: f.phone || '', email: f.email || '', hoursText: f.hoursText || '' });
});
${cfg.moduleIds.includes('auth') ? `
// PUT /api/negocio — actualiza la ficha (solo admin; todos los campos son opcionales)
router.put('/', requireAdmin, async (req, res) => {
  const patch = {};
  for (const [campo, max] of [['legalName', 120], ['address', 160], ['phone', 40], ['hoursText', 120]]) {
    if (req.body[campo] !== undefined) {
      const v = String(req.body[campo]).trim();
      if (v && !str(v, 1, max)) return res.status(422).json({ error: 'Revisá el campo ' + campo });
      patch[campo] = v;
    }
  }
  if (req.body.cuit !== undefined) {
    const v = String(req.body.cuit).trim();
    if (v && !CUIT.test(v)) return res.status(422).json({ error: 'CUIT inválido (formato 30-12345678-9)', errors: { cuit: 'Formato esperado: 30-12345678-9' } });
    patch.cuit = v;
  }
  if (req.body.email !== undefined) {
    const v = String(req.body.email).trim();
    if (v && !isEmail(v)) return res.status(422).json({ error: 'Email inválido', errors: { email: 'Revisá el email' } });
    patch.email = v;
  }
  const f = await ficha();
  const upd = await db.update('bizinfo', f.id, patch);
  res.json(upd);
});
` : `// La edición de la ficha requiere el módulo de autenticación: activalo en el Builder para
// habilitar /negocio-admin.html. Sin él, editá data/bizinfo.json a mano (el pie de página y el
// comprobante leen la ficha igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'negocio-admin': {
      title: 'Datos del negocio',
      html: `  <section>
    <div class="container" style="max-width:640px">
      <h2>Datos del negocio</h2>
      <p class="section-sub">Estos datos se muestran en el pie de todas las páginas${cfg.moduleIds.includes('invoices') ? ' y en el encabezado de los comprobantes' : ''}. Editalos una sola vez acá. Solo visible para administradores.</p>
      <form id="ng-form" class="card">
        <label>Razón social</label>
        <input name="legalName" maxlength="120" placeholder="Ej: Mi Empresa S.R.L.">
        <div class="grid cols-2" style="gap:14px">
          <div><label>CUIT</label><input name="cuit" maxlength="13" placeholder="30-12345678-9"></div>
          <div><label>Teléfono</label><input name="phone" maxlength="40" placeholder="+54 11 5555-5555"></div>
        </div>
        <label>Dirección</label>
        <input name="address" maxlength="160" placeholder="Calle 123, Ciudad">
        <label>Email de contacto</label>
        <input name="email" type="email" maxlength="120" placeholder="hola@minegocio.com">
        <label>Horario de atención (texto libre)</label>
        <input name="hoursText" maxlength="120" placeholder="Lun a Vie 9 a 18 h">
        <button class="btn" type="submit" style="margin-top:16px">Guardar datos</button>
      </form>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo datos del negocio: trae la ficha de /api/negocio y la inyecta en el pie de todas las
   páginas${cfg.moduleIds.includes('invoices') ? ' y en el encabezado fiscal del comprobante público' : ''}; con auth activo, el panel de edición
   vive en /negocio-admin.html. Animado con Anime.js (fade de aparición) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Pinta la línea institucional en el pie de página (todas las páginas la tienen)
  function pintarFooter(f) {
    var cont = document.querySelector('footer .container');
    if (!cont || document.getElementById('ng-footer')) return;
    var partes = [];
    if (f.address) partes.push(f.address);
    if (f.phone) partes.push('Tel: ' + f.phone);
    if (f.email) partes.push(f.email);
    if (f.hoursText) partes.push(f.hoursText);
    if (f.legalName && f.cuit) partes.push(f.legalName + ' · CUIT ' + f.cuit);
    if (!partes.length) return;
    var div = document.createElement('div');
    div.className = 'ng-footer';
    div.id = 'ng-footer';
    div.innerHTML = partes.map(function (p) { return '<span>' + App.esc(p) + '</span>'; }).join('');
    cont.appendChild(div);
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(div, { opacity: [0, 1], translateY: [6, 0], duration: 500, ease: 'outCubic' });
      // Red de seguridad: deja el pie visible aunque el loop esté pausado (pestaña oculta)
      setTimeout(function () { div.style.opacity = 1; div.style.transform = 'none'; }, 900);
    }
  }
${cfg.moduleIds.includes('invoices') ? `
  // Integración con comprobantes: agrega razón social / CUIT / dirección al encabezado del
  // comprobante público cuando se renderiza (también sale en la impresión). Observa el
  // contenedor porque el comprobante se pinta recién al consultar el código.
  function observarComprobante(f) {
    var view = document.getElementById('inv-view');
    if (!view || !(f.legalName || f.cuit || f.address)) return;
    var texto = [f.legalName, f.cuit ? 'CUIT ' + f.cuit : '', f.address].filter(Boolean).join(' · ');
    function inyectar() {
      var head = view.querySelector('.inv-head');
      if (!head || head.querySelector('.neg-fiscal')) return;
      var p = document.createElement('p');
      p.className = 'neg-fiscal';
      p.textContent = texto;
      var col = head.firstElementChild || head;
      col.appendChild(p);
    }
    inyectar();
    new MutationObserver(inyectar).observe(view, { childList: true, subtree: true });
  }
` : ''}
  // La ficha es pública: se lee con fetch directo (sin token) y en la vista previa se simula
  function iniciar(f) {
    window.App.negocio = f;
    pintarFooter(f);
${cfg.moduleIds.includes('invoices') ? `    observarComprobante(f);
` : ''}  }

  if (window.__PREVIEW__) {
    iniciar({ legalName: 'Mi Empresa S.R.L.', cuit: '30-12345678-9', address: 'Av. Siempreviva 123, CABA', phone: '+54 11 5555-5555', email: 'hola@miempresa.com', hoursText: 'Lun a Vie 9 a 18 h' });
  } else {
    fetch('/api/negocio').then(function (r) { return r.json(); }).then(function (f) { if (f && !f.error) iniciar(f); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /negocio-admin.html ----
  var formN = document.getElementById('ng-form');
  if (formN) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var CAMPOS = ['legalName', 'cuit', 'address', 'phone', 'email', 'hoursText'];

    function cargar(f) {
      CAMPOS.forEach(function (k) { formN.querySelector('[name="' + k + '"]').value = f[k] || ''; });
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(formN, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: 'outCubic' });
        setTimeout(function () { formN.style.opacity = 1; formN.style.transform = 'none'; }, 800);
      }
    }

    formN.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {};
      CAMPOS.forEach(function (k) { datos[k] = formN.querySelector('[name="' + k + '"]').value; });
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la ficha'); return; }
      try {
        await App.api('/api/negocio', { method: 'PUT', body: datos });
        App.toast('Datos del negocio guardados');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (window.__PREVIEW__) {
      cargar({ legalName: 'Mi Empresa S.R.L.', cuit: '30-12345678-9', address: 'Av. Siempreviva 123, CABA', phone: '+54 11 5555-5555', email: 'hola@miempresa.com', hoursText: 'Lun a Vie 9 a 18 h' });
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      fetch('/api/negocio').then(function (r) { return r.json(); }).then(cargar).catch(function () {});
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navN = document.getElementById('nav-negocio-admin');
    if (navN && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navN.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Datos del negocio**: la ficha institucional (razón social, CUIT, dirección, teléfono, email, horario) vive en la colección \`bizinfo\` y se muestra en el pie de todas las páginas${cfg.moduleIds.includes('invoices') ? ' y en el encabezado de los comprobantes impresos' : ''}. Se siembra con datos de EJEMPLO: reemplazalos por los reales ${cfg.moduleIds.includes('auth') ? 'desde \`/negocio-admin.html\`' : 'editando \`data/bizinfo.json\` (o activá el módulo **Autenticación** para editarlos desde la web en \`/negocio-admin.html\`)'} antes de publicar el sitio.`,
  ],
};
