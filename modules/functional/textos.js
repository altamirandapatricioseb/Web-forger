// Textos del sitio editables con backend real: los textos principales (título y bajada del hero,
// texto del botón principal y párrafo institucional de "Nosotros") viven en una ficha única
// (colección sitetexts) sembrada con los textos elegidos en el Builder al generar. GET /api/textos
// es público y el cliente los INYECTA EN VIVO sobre el HTML generado al cargar cada página: el
// negocio corrige un título o una bajada desde /textos-admin.html (solo admin) y el cambio se ve al
// instante en el sitio publicado, sin regenerar ni volver a deployar nada. Es el pedido más común
// de cualquier cliente real ("¿puedo cambiar el texto yo solo?") resuelto sin convertir el sitio en
// un CMS completo. Si un campo queda vacío en el panel, esa pieza conserva el texto original del
// HTML (el override es por campo). Animado con Anime.js (fundido sutil al aplicar un texto distinto
// al horneado, aparición del panel) + red de seguridad. Distinto de "blogcms" (artículos nuevos) y
// de "negocio" (datos institucionales del pie): acá se editan los textos fijos del sitio.

module.exports = {
  id: 'textos', type: 'functional', name: 'Textos editables',
  description: 'Los textos principales del sitio (título y bajada del hero, botón principal, párrafo de "Nosotros") se guardan en el backend (colección sitetexts) y se inyectan en vivo al cargar cada página: el negocio los edita en /textos-admin.html (requiere auth) y el cambio se ve al instante sin regenerar el sitio. Sembrados con los textos del Builder. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/textos', file: 'routes/textos.js' }],
  collections: ['sitetexts'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Textos del sitio', href: '/textos-admin.html', id: 'nav-textos-admin' }] : [],
  files: (cfg) => ({
    'routes/textos.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Siembra la ficha de textos la primera vez con los textos elegidos en el Builder
db.seedIfEmpty('sitetexts', [{
  heroTitle: ${JSON.stringify(cfg.texts.heroTitle)},
  heroSubtitle: ${JSON.stringify(cfg.texts.heroSubtitle)},
  heroCta: ${JSON.stringify(cfg.texts.heroCta)},
  about: ${JSON.stringify(cfg.texts.about)},
}]);

// Campos editables y su largo máximo (vacío = esa pieza conserva el texto original del HTML)
const CAMPOS = [['heroTitle', 120], ['heroSubtitle', 220], ['heroCta', 40], ['about', 600]];

// Devuelve la ficha única (creándola si alguien borró el archivo de datos)
async function ficha() {
  const rows = await db.all('sitetexts');
  if (rows.length) return rows[0];
  return db.insert('sitetexts', { heroTitle: '', heroSubtitle: '', heroCta: '', about: '' });
}

// GET /api/textos — textos vigentes del sitio (público; los inyecta el cliente al cargar)
router.get('/', async (req, res) => {
  const f = await ficha();
  res.json({ heroTitle: f.heroTitle || '', heroSubtitle: f.heroSubtitle || '', heroCta: f.heroCta || '', about: f.about || '' });
});
${cfg.moduleIds.includes('auth') ? `
// PUT /api/textos — actualiza los textos (solo admin; todos los campos son opcionales)
router.put('/', requireAdmin, async (req, res) => {
  const patch = {};
  for (const [campo, max] of CAMPOS) {
    if (req.body[campo] !== undefined) {
      const v = String(req.body[campo]).trim();
      if (v && !str(v, 2, max)) return res.status(422).json({ error: 'Revisá el campo ' + campo + ' (máximo ' + max + ' caracteres)' });
      patch[campo] = v;
    }
  }
  const f = await ficha();
  const upd = await db.update('sitetexts', f.id, patch);
  res.json(upd);
});
` : `// La edición de los textos requiere el módulo de autenticación: activalo en el Builder para
// habilitar /textos-admin.html. Sin él, editá data/sitetexts.json a mano (las páginas los
// inyectan igual al cargar).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'textos-admin': {
      title: 'Textos del sitio',
      html: `  <section>
    <div class="container" style="max-width:640px">
      <h2>Textos del sitio</h2>
      <p class="section-sub">Editá los textos principales y el cambio se ve al instante en todo el sitio, sin regenerar nada. Si dejás un campo vacío, se conserva el texto original. Solo visible para administradores.</p>
      <form id="tx-form" class="card">
        <label>Título principal (hero)</label>
        <input name="heroTitle" maxlength="120" placeholder="El gran título de tu portada">
        <label>Bajada del hero</label>
        <textarea name="heroSubtitle" rows="2" maxlength="220" placeholder="La frase que acompaña al título"></textarea>
        <label>Texto del botón principal</label>
        <input name="heroCta" maxlength="40" placeholder="Ej: Empezar ahora">
        <label>Párrafo de "Nosotros"</label>
        <textarea name="about" rows="4" maxlength="600" placeholder="Quiénes son y qué hacen"></textarea>
        <button class="btn" type="submit" style="margin-top:16px">Guardar textos</button>
      </form>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo textos editables: trae los textos de /api/textos y los aplica sobre el HTML generado
   (hero y párrafo de "Nosotros") al cargar cada página; con auth activo, el panel de edición vive
   en /textos-admin.html. Animado con Anime.js (fundido sutil al reemplazar) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reemplaza el texto de un nodo solo si el override existe y es distinto del horneado,
  // con un fundido sutil para que el cambio no "salte" si el texto difiere.
  function aplicar(el, texto) {
    if (!el || !texto || el.textContent.trim() === texto) return;
    el.textContent = texto;
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(el, { opacity: [0.35, 1], duration: 420, ease: 'outCubic' });
      // Red de seguridad: deja el texto visible aunque el loop esté pausado (pestaña oculta)
      setTimeout(function () { el.style.opacity = 1; }, 700);
    }
  }

  // Inyección sobre las piezas conocidas del HTML generado: hero (si el módulo está activo en la
  // página) y el bloque "Sobre …" de Nosotros (presente en /about.html y como fallback de la Home).
  function inyectar(t) {
    var hero = document.querySelector('.hero .container');
    if (hero) {
      aplicar(hero.querySelector('h1'), t.heroTitle);
      aplicar(hero.querySelector('p'), t.heroSubtitle);
      aplicar(hero.querySelector('.btn'), t.heroCta);
    }
    // El bloque institucional arranca con "Sobre <marca>": su bajada es el párrafo editable
    [].slice.call(document.querySelectorAll('h2')).forEach(function (h) {
      if (h.textContent.indexOf('Sobre ') === 0) {
        var sub = h.parentElement.querySelector('.section-sub');
        aplicar(sub, t.about);
      }
    });
  }

  // En la vista previa del Builder los textos ya vienen de la config en vivo: no se inyecta nada
  if (!window.__PREVIEW__) {
    fetch('/api/textos').then(function (r) { return r.json(); }).then(function (t) { if (t && !t.error) inyectar(t); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /textos-admin.html ----
  var formT = document.getElementById('tx-form');
  if (formT) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var CAMPOS = ['heroTitle', 'heroSubtitle', 'heroCta', 'about'];

    function cargar(t) {
      CAMPOS.forEach(function (k) { formT.querySelector('[name="' + k + '"]').value = t[k] || ''; });
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(formT, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: 'outCubic' });
        setTimeout(function () { formT.style.opacity = 1; formT.style.transform = 'none'; }, 800);
      }
    }

    formT.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {};
      CAMPOS.forEach(function (k) { datos[k] = formT.querySelector('[name="' + k + '"]').value; });
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardarían los textos'); return; }
      try {
        await App.api('/api/textos', { method: 'PUT', body: datos });
        App.toast('Textos guardados: ya se ven en todo el sitio');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (window.__PREVIEW__) {
      cargar({ heroTitle: 'Soluciones que impulsan tu negocio', heroSubtitle: 'Todo lo que necesitás para crecer, en un solo lugar.', heroCta: 'Empezar ahora', about: 'Somos un equipo dedicado a crear productos y servicios de calidad.' });
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      fetch('/api/textos').then(function (r) { return r.json(); }).then(cargar).catch(function () {});
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navT = document.getElementById('nav-textos-admin');
    if (navT && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navT.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Textos editables**: los textos principales del sitio (título y bajada del hero, botón principal, párrafo de "Nosotros") viven en la colección \`sitetexts\`, sembrada con los textos elegidos al generar, y se inyectan en vivo al cargar cada página. ${cfg.moduleIds.includes('auth') ? 'Los administradores los editan en \`/textos-admin.html\` y el cambio se ve al instante, sin regenerar el sitio.' : 'Para editarlos desde la web activá el módulo **Autenticación** (habilita \`/textos-admin.html\`); sin él, editá \`data/sitetexts.json\` a mano.'} Un campo vacío conserva el texto original horneado en el HTML.`,
  ],
};
