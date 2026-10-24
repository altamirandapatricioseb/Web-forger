/**
 * Generador: config → Map<ruta, contenido> del proyecto completo.
 */
const registry = require('./registry');
const motion = require('./motion');
const T = require('./templates');

const DEFAULTS = {
  brand: {
    name: 'Mi Empresa',
    tagline: 'Hacemos que las cosas pasen',
    colors: { primary: '#1f2937', accent: '#2563eb', bg: '#ffffff' },
    // Montserrat por default: una geométrica premium que da terminación cuidada a cualquier sitio
    // generado (se carga vía Google Fonts, opt-out eligiendo una stack del sistema en el Builder).
    font: 'montserrat',
    domain: '',
  },
  texts: {
    heroTitle: 'Soluciones que impulsan tu negocio',
    heroSubtitle: 'Todo lo que necesitás para crecer, en un solo lugar.',
    heroCta: 'Empezar ahora',
    about: 'Somos un equipo dedicado a crear productos y servicios de calidad para nuestros clientes.',
  },
  modules: ['hero'],
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function normalize(raw = {}) {
  const cfg = {
    brand: { ...DEFAULTS.brand, ...(raw.brand || {}), colors: { ...DEFAULTS.brand.colors, ...((raw.brand || {}).colors || {}) } },
    texts: { ...DEFAULTS.texts, ...(raw.texts || {}) },
    moduleIds: Array.isArray(raw.modules) && raw.modules.length ? [...new Set(raw.modules)] : [...DEFAULTS.modules],
    persistence: raw.persistence === 'supabase' ? 'supabase' : 'json',
    deploy: raw.deploy === 'vercel' ? 'vercel' : 'local',
    docs: { saas: !!(raw.docs && raw.docs.saas) },
  };
  // Diseño visual del sitio generado: los ocho ejes de movimiento elegibles desde el Builder
  // (tarjetas, aparición al scroll, botones, enlaces, títulos, imágenes, campos y cambio de
  // página). El catálogo y la validación viven en src/motion.js; cualquier valor desconocido
  // —o una config vieja sin bloque design— cae al default de su eje, que reproduce el
  // comportamiento histórico. Una config guardada antes de este cambio genera el mismo sitio.
  cfg.design = motion.normalizeDesign(raw.design || {});
  // Acordeón FAQ: el despliegue SIEMPRE está animado (no hay opción "sin animación";
  // el único apagado legítimo es prefers-reduced-motion del visitante). Lo elegible
  // es el estilo. La aparición del texto sí es opcional (faqText, default activada).
  const FAQ_FX = ['slide', 'fade', 'spring'];
  const rawFaq = raw.design && raw.design.faqAnim;
  cfg.design.faqAnim = FAQ_FX.includes(rawFaq) ? rawFaq : 'slide';
  cfg.design.faqText = raw.design ? raw.design.faqText !== false : true;
  // Vercel tiene filesystem efímero: fuerza persistencia real
  if (cfg.deploy === 'vercel') cfg.persistence = 'supabase';
  // Validaciones de entrada del Builder
  for (const [k, v] of Object.entries(cfg.brand.colors)) {
    if (!HEX.test(v)) throw new Error(`Color inválido en "${k}": ${v} (formato #rrggbb)`);
  }
  if (!(cfg.brand.font in T.FONTS)) cfg.brand.font = 'sistema';
  if (!String(cfg.brand.name).trim()) throw new Error('El nombre de la marca no puede estar vacío');
  // Dominio opcional del sitio: los módulos que arman URLs absolutas (seo, rss) lo usan.
  // Se normaliza a https://… sin barra final; vacío significa "todavía no hay dominio".
  let dominio = String(cfg.brand.domain || '').trim();
  if (dominio) {
    if (!/^https?:\/\//i.test(dominio)) dominio = 'https://' + dominio;
    dominio = dominio.replace(/\/+$/, '');
    if (!/^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/i.test(dominio)) {
      throw new Error(`Dominio inválido: "${cfg.brand.domain}" (formato esperado: midominio.com)`);
    }
  }
  cfg.brand.domain = dominio;
  cfg.slug = cfg.brand.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'proyecto';
  // Dependencias entre módulos: cada módulo declara `requires` y acá se resuelven en cadena
  for (let i = 0; i < cfg.moduleIds.length; i++) {
    const m = registry.get(cfg.moduleIds[i]);
    if (!m || !m.requires) continue;
    for (const dep of m.requires) if (!cfg.moduleIds.includes(dep)) cfg.moduleIds.push(dep);
  }
  // Textos por sección (contrato `fields`): cada módulo declara qué textos suyos son
  // editables y con qué default; acá se resuelve el valor final de cada uno. Se recorre
  // DESPUÉS de resolver las dependencias para que un módulo agregado en cadena también
  // reciba sus textos. Un campo vacío vuelve al default declarado: así "borrar el campo"
  // en el Builder significa "dejalo como venía", no "dejá el sitio con un hueco".
  cfg.moduleTexts = {};
  const rawTexts = (raw.moduleTexts && typeof raw.moduleTexts === 'object') ? raw.moduleTexts : {};
  for (const id of cfg.moduleIds) {
    const m = registry.get(id);
    if (!m || !Array.isArray(m.fields) || !m.fields.length) continue;
    const dados = (rawTexts[id] && typeof rawTexts[id] === 'object') ? rawTexts[id] : {};
    const vals = {};
    for (const f of m.fields) {
      const crudo = dados[f.key];
      // Un campo select se valida contra su lista de opciones, no por largo: cualquier valor
      // que no esté en la lista (config manipulada, o guardada con una versión que tenía
      // otras opciones) cae al default del campo.
      if (f.type === 'select') {
        const ops = (f.options || []).map(o => (Array.isArray(o) ? o[0] : o));
        vals[f.key] = ops.includes(crudo) ? crudo : String(f.default == null ? (ops[0] || '') : f.default);
        continue;
      }
      // El recorte por `max` se hace acá y no sólo en el panel: la config puede llegar por
      // /api/preview o por un link compartido, sin pasar por los inputs del Builder.
      const v = typeof crudo === 'string' ? crudo.trim().slice(0, f.max || 400) : '';
      vals[f.key] = v || String(f.default == null ? '' : f.default);
    }
    cfg.moduleTexts[id] = vals;
  }
  // Animaciones (Motion): activas si el módulo `reveal` está seleccionado y la
  // librería está vendorizada. Este flag lo leen layout() y generate() para
  // sumar el <script> y el asset /js/motion.js de forma coherente.
  cfg.motion = cfg.moduleIds.includes('reveal') && Boolean(T.MOTION_LIB);
  // Anime.js: activa si algún módulo seleccionado la declara con `usesAnime` y la
  // librería está vendorizada. Análogo a cfg.motion pero por-módulo, no atado a `reveal`.
  cfg.anime = cfg.moduleIds.some(id => { const m = registry.get(id); return m && m.usesAnime; }) && Boolean(T.ANIME_LIB);
  return cfg;
}

function generate(rawConfig) {
  const cfg = normalize(rawConfig);
  const mods = registry.selected(cfg.moduleIds);
  const files = new Map();
  const mounts = [];
  // Middlewares globales de módulos: se montan antes de los estáticos (ver T.appJs)
  const middlewares = [];
  const envVars = {};
  cfg.collections = [...new Set(mods.flatMap(m => m.collections || []))];
  // El JS del sistema de movimiento va primero (después del helper base y antes de los
  // módulos): sólo emite algo si algún eje elegido lo necesita — una configuración de puro
  // CSS no agrega ni un byte al app.js del proyecto exportado.
  let clientJs = T.baseClientJs(cfg) + motion.motionJs(cfg);

  // Navegación coherente entre páginas
  const nav = [{ label: 'Inicio', href: '/index.html' }, { label: 'Nosotros', href: '/about.html' }];
  for (const m of mods) if (m.nav) nav.push(...m.nav(cfg));

  // Páginas propias resueltas una sola vez: las usan la composición HTML y ctx.pages
  const modPages = mods.filter(m => m.pages).map(m => [m, m.pages(cfg)]);
  // Contexto que reciben los módulos en files(cfg, ctx): la lista completa de páginas del sitio
  // y la navegación ya armada (la usa el módulo de menú administrable para sembrar su panel con
  // los links reales del proyecto en vez de pedirle al cliente que los cargue a mano).
  const ctx = {
    pages: ['index.html', 'about.html', ...modPages.flatMap(([, pgs]) => Object.keys(pgs).map(n => `${n}.html`))],
    nav: nav.map(l => ({ label: l.html ? String(l.label).replace(/<[^>]*>/g, '').trim() : l.label, href: l.href })),
  };

  // Archivos y montajes que aporta cada módulo
  for (const m of mods) {
    if (m.files) for (const [p, c] of Object.entries(m.files(cfg, ctx))) files.set(p, c);
    if (m.mounts) mounts.push(...(typeof m.mounts === 'function' ? m.mounts(cfg) : m.mounts));
    if (m.middlewares) middlewares.push(...(typeof m.middlewares === 'function' ? m.middlewares(cfg) : m.middlewares));
    if (m.env) Object.assign(envVars, m.env);
    if (m.clientJs) clientJs += '\n' + m.clientJs(cfg);
  }

  // Fragmentos extra del <head> aportados por los módulos (SEO, favicons…)
  const headFor = (page) => mods.filter(m => m.head).map(m => m.head(cfg, page)).join('\n');

  // Home: composición de las secciones UI seleccionadas, en orden
  const sections = mods.filter(m => m.html).map(m => m.html(cfg)).join('\n');
  files.set('public/index.html', T.layout(cfg, {
    title: 'Inicio', active: '/index.html', nav, head: headFor({ title: 'Inicio', active: '/index.html' }),
    body: sections || T.aboutBody(cfg),
  }));

  // About: siempre presente
  files.set('public/about.html', T.layout(cfg, { title: 'Nosotros', active: '/about.html', nav, head: headFor({ title: 'Nosotros', active: '/about.html' }), body: T.aboutBody(cfg) }));

  // Páginas propias de cada módulo (catálogo, dashboard, admin, auth, etc.)
  for (const [, pgs] of modPages) {
    for (const [name, body] of Object.entries(pgs)) {
      files.set(`public/${name}.html`, T.layout(cfg, { title: body.title, active: `/${name}.html`, nav, head: headFor({ title: body.title, active: `/${name}.html` }), body: body.html }));
    }
  }

  // Base del backend
  files.set('package.json', T.packageJson(cfg));
  files.set('server.js', T.serverJs(cfg));
  files.set('src/app.js', T.appJs(cfg, mounts, middlewares));
  files.set('src/env.js', T.ENV_JS);
  if (cfg.persistence === 'supabase') {
    files.set('src/db.js', T.DB_SUPABASE_JS);
    files.set('supabase/schema.sql', T.schemaSql(cfg.collections));
    Object.assign(envVars, { SUPABASE_URL: 'https://TU-PROYECTO.supabase.co', SUPABASE_SERVICE_KEY: 'service-role-key' });
  } else {
    files.set('src/db.js', T.DB_JS);
  }
  if (cfg.deploy === 'vercel') {
    // Rutas propias que aporta un módulo (contrato `vercelRewrites`) y que NO empiezan con /api:
    // en Vercel todo lo que no cae en el rewrite lo sirve la CDN de estáticos y nunca llega a
    // Express, así que un middleware que responde /p/:slug quedaría muerto sin esto.
    const extra = [...new Set(mods.flatMap(m => (typeof m.vercelRewrites === 'function' ? m.vercelRewrites(cfg) : m.vercelRewrites) || []))];
    files.set('vercel.json', T.vercelJson(extra));
    files.set('api/index.js', T.VERCEL_FN);
  }
  if (cfg.docs.saas) files.set('docs/B2B-SAAS.md', saasDoc(cfg, mods, cfg.collections));
  files.set('src/validate.js', T.VALIDATE_JS);
  files.set('public/css/styles.css', T.stylesCss(cfg));
  files.set('public/js/app.js', clientJs);
  if (cfg.motion) files.set('public/js/motion.js', T.MOTION_LIB);
  if (cfg.anime) files.set('public/js/anime.js', T.ANIME_LIB);
  files.set('.env.example', T.envExample(cfg, envVars));
  files.set('.gitignore', T.GITIGNORE);
  files.set('README.md', readme(cfg, mods, mounts));

  return files;
}


/* ---------- Guía B2B SaaS a medida del proyecto generado ---------- */

function saasDoc(cfg, mods, collections) {
  const fn = mods.filter(m => m.type === 'functional');
  const hasSupabase = cfg.persistence === 'supabase';
  const tenantCols = collections.filter(c => c !== 'users').map(c => `- \`${c}\``).join('\n');
  return `# ${cfg.brand.name} → B2B SaaS

Guía para convertir **este proyecto** (generado con los módulos: ${fn.map(m => m.name).join(', ')})
en un SaaS multi-tenant que le vendas a varias empresas a la vez. Está ordenada por etapas:
cada una deja el sistema funcionando antes de pasar a la siguiente.

## Etapa 1 — Multi-tenant por organización

La idea central: **todo dato pertenece a una organización** (\`orgId\`), y ningún request puede
leer ni escribir datos de otra organización.

1. Nueva colección \`orgs\`: \`{ name, slug, plan, createdAt }\`.${hasSupabase ? " Agregá la tabla en \`supabase/schema.sql\` con el mismo formato jsonb." : ""}
2. Cada usuario pertenece a una org: al registrarse, o crea una org nueva (es su admin) o entra
   por invitación. Agregá \`orgId\` al usuario y **al payload del token** en \`routes/auth.js\`
   (función \`sign\`), así viaja en cada request sin consultas extra.
3. Middleware de tenant en \`src/middleware/auth.js\`:

\`\`\`js
exports.requireOrg = (req, res, next) => {
  exports.requireAuth(req, res, () => {
    if (!req.user.orgId) return res.status(403).json({ error: 'Usuario sin organización' });
    req.orgId = req.user.orgId;
    next();
  });
};
\`\`\`

4. En cada ruta de este proyecto, dos cambios mecánicos:
   - al **insertar**: agregá \`orgId: req.orgId\` al objeto;
   - al **leer**: cambiá \`db.all(coleccion)\` por \`db.find(coleccion, r => r.orgId === req.orgId)\`.

   Colecciones de este proyecto que necesitan \`orgId\`:
${tenantCols || '- (solo usuarios)'}

5. El rol \`admin\` pasa a ser **admin de su org**, no del sistema. Agregá un rol \`superadmin\`
   (vos) para soporte, excluido de la lógica de negocio.
${hasSupabase ? `
> Con Supabase podés reforzarlo a nivel base: columna generada \`org_id text generated always as (data->>'orgId') stored\`, índice por \`org_id\`, y si algún día exponés la API con la anon key, políticas RLS por organización. Con la service key actual, el aislamiento lo garantiza el middleware.
` : `
> Cuando migres a Supabase (ver README), el aislamiento se puede reforzar con columnas generadas e índices por \`org_id\`.
`}
## Etapa 2 — Planes y límites

1. Definí planes en un archivo \`src/plans.js\`:

\`\`\`js
module.exports = {
  free:  { ${fn.some(m => m.id === 'branches') ? 'branches: 1, ' : ''}users: 3,  label: 'Gratis' },
  pro:   { ${fn.some(m => m.id === 'branches') ? 'branches: 10, ' : ''}users: 25, label: 'Pro' },
  full:  { ${fn.some(m => m.id === 'branches') ? 'branches: Infinity, ' : ''}users: Infinity, label: 'Empresa' },
};
\`\`\`

2. Antes de cada alta, validá el límite del plan de la org (helper \`checkLimit(orgId, 'users')\`).
3. Mostrá el plan y el uso en el panel admin: es tu mejor vendedor de upgrades.

## Etapa 3 — Cobro recurrente

Para Argentina/LATAM: **Mercado Pago Suscripciones** (preapproval). Internacional: **Stripe Billing**.
En ambos casos el patrón es igual:

1. Endpoint \`POST /api/billing/subscribe\` que crea la suscripción y guarda \`subscriptionId\` en la org.
2. **Webhook** (\`POST /api/billing/webhook\`) que escucha pagos aprobados/rechazados y actualiza
   \`org.plan\` y \`org.paidUntil\`. Nunca confíes en el redirect del checkout: la fuente de verdad es el webhook.
3. Middleware \`requireActivePlan\` que bloquea (HTTP 402) si \`paidUntil\` venció, con período de gracia.

## Etapa 4 — Onboarding y ciclo de vida

- Alta self-service: registro → crea org → wizard mínimo (${fn.slice(0, 3).map(m => m.name.toLowerCase()).join(' → ') || 'datos básicos'}).
- Invitaciones por email con token de un solo uso (colección \`invites\`).
- Exportación de datos por org (CSV de sus colecciones) — genera confianza y es requisito frecuente en B2B.
- Baja: soft-delete de la org y purga programada a 30 días.

## Etapa 5 — Operación

- Logs por \`orgId\` (prefijá cada \`console.log\` del server).
- Backups: ${hasSupabase ? 'Supabase hace backups automáticos; verificá la retención de tu plan.' : 'automatizá copias de \`data/\` o migrá a Supabase antes de tener clientes pagos.'}
- Métricas mínimas de negocio: orgs activas, MRR, churn mensual. Con el módulo Estadísticas ya tenés la base de eventos.

## Checklist antes de vender

- [ ] Aislamiento por org verificado con tests (dos orgs, misma consulta, datos distintos)
- [ ] Límites de plan aplicados en el servidor (no solo ocultos en la UI)
- [ ] Webhook de pagos con reintentos y firma verificada
- [ ] Términos y condiciones + política de datos
- [ ] Dominio propio con HTTPS${cfg.deploy === 'vercel' ? ' (en Vercel: Settings → Domains)' : ''}
`;
}

function readme(cfg, mods, mounts) {
  // Avisos de módulos que requieren acción humana (números, claves, textos legales…)
  const notes = mods.flatMap(m => (m.readmeNotes ? m.readmeNotes(cfg) : [])).map(n => `- ${n}`).join('\n');
  const ui = mods.filter(m => m.type === 'ui').map(m => `- ${m.name}`).join('\n') || '- (ninguno)';
  const fn = mods.filter(m => m.type === 'functional').map(m => `- **${m.name}**: ${m.description}`).join('\n') || '- (ninguno)';
  const api = mounts.map(m => `| \`${m.route}\` | \`${m.file}\` |`).join('\n');
  return `# ${cfg.brand.name}

> ${cfg.brand.tagline}

Proyecto generado con **WebForge Builder**, sin servicios pagos: una sola dependencia
(\`express\`), ${cfg.persistence === 'supabase' ? 'persistencia en **Supabase** (PostgreSQL vía PostgREST, sin dependencias extra)' : 'persistencia en archivos JSON dentro de `data/`'}
y autenticación JWT firmada con \`crypto\` nativo de Node.
${cfg.persistence === 'supabase' ? `
## Base de datos (Supabase)

1. Creá un proyecto en [supabase.com](https://supabase.com) (plan gratuito alcanza).
2. En **SQL Editor → New query**, pegá y ejecutá el contenido de \`supabase/schema.sql\`.
   Crea una tabla por colección, todas con RLS activado.
3. En **Project Settings → API** copiá la **Project URL** y la **service_role key**
   (⚠ la secreta, **no** la \`anon\`): son las variables \`SUPABASE_URL\` y \`SUPABASE_SERVICE_KEY\`.

La service key **solo vive en el servidor** (nunca en el frontend) y las tablas tienen RLS
activado, así que no son accesibles con la clave pública.
` : ''}${cfg.deploy === 'vercel' ? `
## Deploy en Vercel

El proyecto ya incluye \`vercel.json\` y \`api/index.js\` (la app Express corre como función serverless
y \`public/\` se sirve como estáticos). No hay build step.

\`\`\`bash
npm i -g vercel
vercel --prod
\`\`\`

También podés importar el repo desde [vercel.com](https://vercel.com) → **Add New → Project**
(framework: **Other**, sin build command) para que cada push redeploye solo.

Después, en **Settings → Environment Variables** cargá las que están listadas en \`.env.example\`
(\`JWT_SECRET\`, \`SUPABASE_URL\`, \`SUPABASE_SERVICE_KEY\`${mods.some(m => m.id === 'chatbot' || m.id === 'ai-agent') ? ', `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`' : ''}) y hacé
**Deployments → ⋯ → Redeploy**: las variables aplican al deploy siguiente.

Para generar un \`JWT_SECRET\` fuerte:

\`\`\`bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
\`\`\`

Los datos de ejemplo se cargan solos la primera vez que arranca.
` : `
## Publicarlo

Este proyecto se exportó con persistencia en archivos, que **no sobrevive en un hosting
serverless** (el filesystem es efímero: los datos se pierden en cada deploy). Para publicarlo,
volvé a exportarlo desde el Builder eligiendo **Vercel + Supabase**: el ZIP sale con
\`vercel.json\`, \`api/index.js\` y \`supabase/schema.sql\` incluidos.
`}

## Módulos incluidos

### Interfaz
${ui}

### Funcionales
${fn}

## API

| Ruta base | Archivo |
|---|---|
${api || '| — | — |'}

## Estructura

\`\`\`
server.js            Punto de entrada (Express)${cfg.deploy === 'vercel' ? `
api/index.js         Punto de entrada serverless (reusa la misma app)` : ''}
src/db.js            Capa de datos (${cfg.persistence === 'supabase' ? 'Supabase vía PostgREST' : 'JSON por colección'}, misma interfaz que un ORM simple)
src/validate.js      Helpers de validación de modelos
models/              Modelo + validaciones por módulo
routes/              Un router Express por módulo
public/              Frontend multipágina (HTML + CSS + JS vanilla)${cfg.persistence === 'supabase' ? `
supabase/schema.sql  Una tabla por colección, con RLS activado` : `
data/                Datos persistidos (se crea sola, ignorada por git)`}
\`\`\`

## Notas

- **Usuario admin**: el primer usuario registrado recibe rol \`admin\` automáticamente. Registrate
  antes de que el sitio sea público, o el primero en llegar se queda con el panel.${notes ? '\n' + notes : ''}
${cfg.persistence === 'supabase' ? '- **Producción**: definí un `JWT_SECRET` fuerte en las variables de entorno. La persistencia ya es PostgreSQL real (Supabase).' : '- **Producción**: cambiá a persistencia Supabase desde el Builder (o reemplazá `src/db.js` manteniendo la interfaz async) y definí un `JWT_SECRET` fuerte en las variables de entorno.'}${cfg.docs.saas ? '\n- **B2B SaaS**: en `docs/B2B-SAAS.md` tenés la guía paso a paso para convertir este proyecto en multi-tenant con planes y cobro recurrente.' : ''}
`;
}

module.exports = { generate, normalize };
