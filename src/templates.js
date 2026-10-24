/**
 * Plantillas base de todo proyecto generado.
 * El proyecto exportado tiene UNA sola dependencia (express):
 * persistencia en archivos JSON y JWT firmado con crypto nativo.
 */

const fs = require('fs');
const path = require('path');
const { phIcon } = require('./icons');
const { motionCss } = require('./motion');

/* Librería Motion (motion.dev) vendorizada una sola vez. Se sirve como
 * /js/motion.js en los proyectos que activen el módulo de animaciones.
 * Es un asset estático, NO una dependencia npm: el proyecto exportado sigue
 * teniendo una sola dependencia (express) y corre 100% offline. */
let MOTION_LIB = '';
try {
  MOTION_LIB = fs.readFileSync(path.join(__dirname, '..', 'public', 'vendor', 'motion.js'), 'utf8');
} catch {
  console.warn('[aviso] No se encontró public/vendor/motion.js: las animaciones Motion quedarán desactivadas en los proyectos generados.');
}

/* Librería Anime.js (animejs.com) vendorizada igual que Motion: bundle UMD que
 * expone window.anime (anime.animate, anime.utils, anime.createTimeline…). Se
 * sirve como /js/anime.js sólo en los proyectos que activen un módulo que la use.
 * También es un asset estático, NO una dependencia npm del proyecto exportado. */
let ANIME_LIB = '';
try {
  ANIME_LIB = fs.readFileSync(path.join(__dirname, '..', 'public', 'vendor', 'anime.js'), 'utf8');
} catch {
  console.warn('[aviso] No se encontró public/vendor/anime.js: las animaciones Anime.js quedarán desactivadas en los proyectos generados.');
}

/* Catálogo de tipografías elegibles para el sitio GENERADO.
 * - Las cuatro primeras son stacks del sistema: 100% offline, sin pedir nada a la red.
 * - Las que traen `google` se cargan desde Google Fonts (una sola familia, pesos 400–800).
 *   Son opt-in: sólo se enlazan si el usuario las elige, así el default 'sistema' mantiene
 *   la promesa de "corre 100% offline". Elegí sólo familias que funcionan como fuente única
 *   de toda la UI (títulos + cuerpo + labels); nada de display-serif para texto corrido. */
const FONT_CATALOG = [
  { id: 'sistema',    label: 'Sistema (moderna)', stack: `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` },
  { id: 'humanista',  label: 'Humanista',         stack: `'Trebuchet MS', 'Segoe UI', Verdana, sans-serif` },
  { id: 'clasica',    label: 'Clásica (serif)',   stack: `Georgia, 'Times New Roman', serif` },
  { id: 'tecnica',    label: 'Técnica (mono)',    stack: `ui-monospace, 'Cascadia Code', 'Courier New', monospace` },
  { id: 'montserrat', label: 'Montserrat',        stack: `'Montserrat', system-ui, -apple-system, sans-serif`, google: 'Montserrat:wght@400;500;600;700;800' },
  { id: 'inter',      label: 'Inter',             stack: `'Inter', system-ui, -apple-system, sans-serif`,      google: 'Inter:wght@400;500;600;700;800' },
  { id: 'poppins',    label: 'Poppins',           stack: `'Poppins', system-ui, -apple-system, sans-serif`,    google: 'Poppins:wght@400;500;600;700;800' },
  { id: 'space',      label: 'Space Grotesk',     stack: `'Space Grotesk', ui-monospace, monospace`,           google: 'Space+Grotesk:wght@400;500;600;700' },
];
const FONTS = Object.fromEntries(FONT_CATALOG.map(f => [f.id, f.stack]));

// <link> del <head> para la tipografía elegida. Vacío para las stacks del sistema.
function fontHead(font) {
  const f = FONT_CATALOG.find(x => x.id === font);
  if (!f || !f.google) return '';
  return `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${f.google}&display=swap">`;
}

function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- textos por sección (contrato `fields`) ----------
 * Un módulo declara `fields: [{key, label, default, …}]` y el generador deja el valor final
 * resuelto en cfg.moduleTexts[id][key] (ver normalize()). Estos dos helpers son la única
 * forma en que los módulos deberían leerlos: nunca alcanzar cfg.moduleTexts a mano, porque
 * el fallback importa — una config vieja (o un link compartido de antes de que el campo
 * existiera) no trae la clave y el módulo tiene que seguir renderizando su texto original. */

// Texto de un campo. `fallback` es el último recurso: normalmente el default ya viene resuelto.
function txt(cfg, modId, key, fallback = '') {
  const v = ((cfg && cfg.moduleTexts) || {})[modId];
  const s = v ? v[key] : undefined;
  return (s === undefined || s === null || s === '') ? fallback : String(s);
}

// Campo de tipo lista: una línea por ítem. Con `partes`, además parte cada línea por "|"
// (convención de los campos que llevan varias columnas: "Título | Texto").
function txtList(cfg, modId, key, fallback = '') {
  return String(txt(cfg, modId, key, fallback))
    .split('\n').map(s => s.trim()).filter(Boolean)
    .map(linea => linea.includes('|') ? linea.split('|').map(p => p.trim()) : linea);
}

// Luminancia relativa (WCAG) de un color #rrggbb. La usa el sistema de tokens para elegir
// texto oscuro sobre fondos claros y texto claro sobre fondos oscuros: así el color de texto
// nunca queda ilegible sea cual sea el fondo que elija el cliente en el Builder.
function relLuminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return 1; // si no se puede leer, asumimos fondo claro (texto oscuro)
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/* ---------- package.json / env / git ---------- */

function packageJson(cfg) {
  return JSON.stringify({
    name: cfg.slug,
    version: '1.0.0',
    description: `${cfg.brand.name} — generado con WebForge Builder`,
    main: 'server.js',
    scripts: { start: 'node server.js', dev: 'node --watch server.js' },
    dependencies: { express: '^5.1.0' },
  }, null, 2) + '\n';
}

function envExample(cfg, envVars) {
  const lines = ['# Copiá este archivo a .env y completá los valores', 'PORT=3000'];
  for (const [k, v] of Object.entries(envVars)) lines.push(`${k}=${v}`);
  return lines.join('\n') + '\n';
}

const GITIGNORE = `node_modules/\n.env\ndata/\n`;

/* ---------- server.js del proyecto generado ---------- */

function appJs(cfg, mounts, middlewares = []) {
  const requires = mounts.map(m => `app.use('${m.route}', require('../${m.file.replace(/\.js$/, '')}'));`).join('\n');
  // Middlewares globales que aportan los módulos (contrato `middlewares`). Van ANTES de los
  // estáticos a propósito: un módulo como "mantenimiento" tiene que poder interceptar también
  // las páginas HTML, no sólo las rutas de API.
  const pre = middlewares
    .map(mw => `app.use(require('./${mw.file.replace(/^src\//, '').replace(/\.js$/, '')}'));`)
    .join('\n');
  return `/**
 * ${cfg.brand.name} — aplicación Express (compartida por server local y Vercel).
 * Generado con WebForge Builder.
 */
require('./env');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
${pre ? pre + '\n' : ''}app.use(express.static(path.join(__dirname, '..', 'public')));

// Rutas de API por módulo
${requires || '// (sin módulos funcionales seleccionados)'}

// 404 de API en JSON
app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));

// Errores (incluye async: Express 5 los reenvía solo)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
`;
}

function serverJs(cfg) {
  return `/**
 * ${cfg.brand.name} — arranque local.
 */
const app = require('./src/app');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(${JSON.stringify(cfg.brand.name)} + ' -> http://localhost:' + PORT));
`;
}

const VERCEL_JSON = JSON.stringify({
  rewrites: [{ source: '/api/:path*', destination: '/api/index' }],
}, null, 2) + '\n';

// vercel.json con las rutas extra que declaran los módulos (contrato `vercelRewrites`).
// El orden importa: los patrones se evalúan de arriba hacia abajo, y /api va primero porque es
// el que resuelve todas las llamadas de datos del sitio.
function vercelJson(extraSources = []) {
  const rewrites = [
    { source: '/api/:path*', destination: '/api/index' },
    ...extraSources.map(source => ({ source, destination: '/api/index' })),
  ];
  return JSON.stringify({ rewrites }, null, 2) + '\n';
}

const VERCEL_FN = `// Punto de entrada serverless para Vercel: reusa la app Express completa.
module.exports = require('../src/app');
`;

/* ---------- driver Supabase (PostgREST por fetch, sin dependencias) ---------- */

const DB_SUPABASE_JS = `/**
 * Capa de datos sobre Supabase (PostgreSQL vía PostgREST), sin dependencias.
 * Misma interfaz que el driver JSON: all, find, get, count, insert, update, remove, seedIfEmpty, restore.
 * Cada colección es una tabla (id text, data jsonb, created_at) creada por supabase/schema.sql.
 * Nota: find(coleccion, predicado) trae la tabla y filtra en memoria — simple y suficiente
 * para datos operativos; si una tabla crece mucho, optimizá ese caso con filtros PostgREST.
 */
require('./env');
const crypto = require('crypto');

const BASE = String(process.env.SUPABASE_URL || '').replace(new RegExp('/+$'), '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
if (!BASE || !KEY) console.warn('[aviso] Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en .env');

async function rest(method, table, query = '', body) {
  const res = await fetch(BASE + '/rest/v1/' + table + query, {
    method,
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error('Supabase ' + res.status + ' en ' + table + ': ' + (await res.text()).slice(0, 300));
  if (res.status === 204) return [];
  return res.json();
}

const unpack = (row) => ({ id: row.id, ...row.data, createdAt: row.created_at });

module.exports = {
  async all(n) { return (await rest('GET', n, '?select=*&order=created_at.asc')).map(unpack); },
  async find(n, fn) { return (await this.all(n)).filter(fn); },
  async get(n, id) {
    const rows = await rest('GET', n, '?select=*&id=eq.' + encodeURIComponent(id));
    return rows.length ? unpack(rows[0]) : null;
  },
  async count(n) { return (await this.all(n)).length; },
  async insert(n, row) {
    const id = crypto.randomBytes(6).toString('hex');
    const created = await rest('POST', n, '', { id, data: row });
    return unpack(created[0]);
  },
  async update(n, id, patch) {
    const current = await this.get(n, id);
    if (!current) return null;
    const { id: _i, createdAt: _c, ...data } = { ...current, ...patch };
    const rows = await rest('PATCH', n, '?id=eq.' + encodeURIComponent(id), { data });
    return rows.length ? unpack(rows[0]) : { ...data, id, createdAt: current.createdAt };
  },
  async remove(n, id) { await rest('DELETE', n, '?id=eq.' + encodeURIComponent(id)); },
  async seedIfEmpty(n, rows) {
    if (await this.count(n)) return;
    for (const r of rows) await this.insert(n, r);
  },
  // Reemplaza la colección completa PRESERVANDO ids y fechas (lo usa el módulo de respaldo:
  // restaurar con ids nuevos rompería las referencias cruzadas, p. ej. openingId de postulantes).
  // El DELETE usa un filtro que matchea todo (PostgREST exige filtro) y el alta va en tandas.
  async restore(n, rows) {
    await rest('DELETE', n, '?id=neq.__ninguno__');
    for (let i = 0; i < rows.length; i += 200) {
      const tanda = rows.slice(i, i + 200).map(r => {
        const { id, createdAt, ...data } = r;
        return { id: id || crypto.randomBytes(6).toString('hex'), data, created_at: createdAt || new Date().toISOString() };
      });
      if (tanda.length) await rest('POST', n, '', tanda);
    }
  },
};
`;

function schemaSql(collections) {
  const tables = collections.map(c => `create table if not exists "${c}" (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table "${c}" enable row level security; -- solo accesible con la service key`).join('\n\n');
  return `-- Esquema generado por WebForge Builder.
-- Ejecutalo una sola vez en Supabase → SQL Editor → New query.
-- Cada colección es una tabla con documento jsonb: simple, flexible y suficiente
-- para la capa src/db.js. RLS queda activado: la API solo funciona con la service key.

${tables}
`;
}


/* ---------- Cliente de IA (API compatible OpenAI: Groq, Gemini, OpenRouter) ---------- */

const AI_JS = `/**
 * Cliente de IA sin dependencias, contra cualquier API compatible OpenAI.
 * Proveedores con capa gratuita (elegí uno y completá .env):
 *   Groq        → AI_BASE_URL=https://api.groq.com/openai/v1            AI_MODEL=llama-3.3-70b-versatile   (console.groq.com)
 *   Gemini      → AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai  AI_MODEL=gemini-2.0-flash  (aistudio.google.com)
 *   OpenRouter  → AI_BASE_URL=https://openrouter.ai/api/v1              AI_MODEL=meta-llama/llama-3.3-70b-instruct:free
 */
require('./env');

const BASE = String(process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(new RegExp('/+$'), '');
const KEY = process.env.AI_API_KEY || '';
const MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';

exports.enabled = () => Boolean(KEY);

/** Una vuelta de chat. Devuelve el message de la respuesta (puede traer tool_calls). */
exports.chat = async ({ system, messages, tools }) => {
  const body = {
    model: MODEL,
    messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
    temperature: 0.3,
    max_tokens: 700,
  };
  if (tools && tools.length) body.tools = tools;
  const res = await fetch(BASE + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Proveedor de IA respondió ' + res.status + ': ' + (await res.text()).slice(0, 300));
  const data = await res.json();
  return data.choices[0].message;
};
`;

// Carga .env sin dependencias


// Carga .env sin dependencias
const ENV_JS = `// Carga variables de .env sin dependencias externas
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', '.env');
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split('\\n')) {
    const m = line.match(/^\\s*([\\w.-]+)\\s*=\\s*(.*)\\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
`;

/* ---------- capa de datos (archivos JSON) ---------- */

const DB_JS = `/**
 * Mini almacén de datos por colección, persistido en data/<coleccion>.json.
 * Sin dependencias externas: ideal para correr local. Para producción,
 * reemplazar esta capa por SQLite/Postgres manteniendo la misma interfaz.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const file = (n) => path.join(DIR, n + '.json');
const read = (n) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return []; } };
const write = (n, rows) => fs.writeFileSync(file(n), JSON.stringify(rows, null, 2));

module.exports = {
  all: (n) => read(n),
  find: (n, fn) => read(n).filter(fn),
  get: (n, id) => read(n).find(r => r.id === id) || null,
  count: (n) => read(n).length,
  insert(n, row) {
    const rows = read(n);
    row.id = crypto.randomBytes(6).toString('hex');
    row.createdAt = new Date().toISOString();
    rows.push(row);
    write(n, rows);
    return row;
  },
  update(n, id, patch) {
    const rows = read(n);
    const i = rows.findIndex(r => r.id === id);
    if (i < 0) return null;
    rows[i] = { ...rows[i], ...patch, id: rows[i].id };
    write(n, rows);
    return rows[i];
  },
  remove(n, id) {
    write(n, read(n).filter(r => r.id !== id));
  },
  seedIfEmpty(n, rows) {
    if (read(n).length === 0) write(n, rows.map(r => ({ id: crypto.randomBytes(6).toString('hex'), createdAt: new Date().toISOString(), ...r })));
  },
  // Reemplaza la colección completa PRESERVANDO ids y fechas (lo usa el módulo de respaldo:
  // restaurar con ids nuevos rompería las referencias cruzadas, p. ej. openingId de postulantes)
  restore(n, rows) {
    write(n, rows.map(r => ({ ...r, id: r.id || crypto.randomBytes(6).toString('hex'), createdAt: r.createdAt || new Date().toISOString() })));
  },
};
`;

/* ---------- validaciones compartidas ---------- */

const VALIDATE_JS = `/** Helpers de validación compartidos por los modelos. */
exports.isEmail = (e) => typeof e === 'string' && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e);
exports.str = (v, min = 1, max = 500) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
exports.num = (v, min = 0, max = Infinity) => typeof v === 'number' && isFinite(v) && v >= min && v <= max;
exports.dateISO = (v) => typeof v === 'string' && !isNaN(Date.parse(v));
exports.oneOf = (v, opts) => opts.includes(v);

/** Corre un esquema {campo: fn} y devuelve { ok, errors } */
exports.check = (data, schema) => {
  const errors = {};
  for (const [field, rule] of Object.entries(schema)) {
    if (!rule(data ? data[field] : undefined)) errors[field] = 'Valor inválido o faltante';
  }
  return { ok: Object.keys(errors).length === 0, errors };
};
`;

/* ---------- CSS del proyecto generado ---------- */

function stylesCss(cfg) {
  const { colors, font } = cfg.brand;
  // ¿El fondo elegido por el cliente es oscuro? Decide la dirección del texto (ver bloque :root).
  // El umbral 0.18 es el punto de cruce WCAG donde texto blanco y negro dan igual contraste:
  // por debajo conviene texto claro, por encima texto oscuro. Así se elige SIEMPRE la opción de
  // mayor contraste (un fondo de luminancia media —ámbar, celeste, gris medio— recibe texto oscuro,
  // no claro). Nota: un fondo de tono medio real (luminancia ~0.15-0.22) no llega a AA con ninguna
  // dirección; es un límite físico del texto directo sobre --bg, no de esta fórmula.
  const bgL = relLuminance(colors.bg);
  const bgDark = bgL < 0.18;
  // En un fondo de luminancia media (0.18–0.62) el "gris apagado" se lava y baja de contraste
  // (regla clásica: gris sobre color se ve deslavado). Ahí el texto secundario se acerca al texto
  // pleno (86% vs 68% hacia --text) para cumplir AA sobre fondos saturados; en fondos claros u
  // oscuros normales conserva el 68%, que da un gris legible y con jerarquía respecto del texto.
  const mutedPct = (bgL >= 0.18 && bgL <= 0.62) ? 86 : 68;
  return `/* ${cfg.brand.name} — estilos generados */
:root {
  --primary: ${colors.primary};
  --accent: ${colors.accent};
  --bg: ${colors.bg};
  --surface: color-mix(in srgb, var(--bg) 92%, var(--primary) 8%);
  /* CONTRATO DE CONTRASTE (accesibilidad): estos tokens garantizan texto legible sea cual sea
     la paleta que elija el cliente en el Builder, sin depender del módulo de modo oscuro.
     - --text: casi-tinta apenas teñida de marca. Su DIRECCIÓN depende de la luminancia del fondo
       (oscuro sobre fondo claro / claro sobre fondo oscuro), decidida en build con relLuminance().
       Antes derivaba 85% de --primary: un primario saturado dejaba el texto de bajo contraste.
     - --muted: 68% hacia el texto en fondos claros/oscuros (da un gris con jerarquía), 86% en
       fondos de luminancia media (ver mutedPct). Verificado ≥4.5:1 (WCAG AA) sobre --bg y sobre
       --surface en 12 paletas —claras, oscuras y saturadas/drenched—. Es texto de cuerpo
       (.section-sub, .muted), no decorativo: si tocás los porcentajes, revalidá el contraste. */
  --text: ${bgDark ? 'color-mix(in srgb, #ffffff 88%, var(--primary) 12%)' : 'color-mix(in srgb, #000000 82%, var(--primary) 18%)'};
  --muted: color-mix(in srgb, var(--text) ${mutedPct}%, var(--bg) ${100 - mutedPct}%);
  --line: color-mix(in srgb, var(--text) 16%, var(--bg) 84%);
  --radius: 10px;
  --font: ${FONTS[font] || FONTS.sistema};
}
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font); background: var(--bg); color: var(--text); line-height: 1.6; }
img { max-width: 100%; display: block; }
a { color: var(--accent); }
.container { max-width: 1080px; margin: 0 auto; padding: 0 20px; }

/* Navbar */
.navbar { position: sticky; top: 0; background: var(--bg); border-bottom: 1px solid var(--line); z-index: 10; }
.navbar .container { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.brand { font-weight: 800; font-size: 1.15rem; color: var(--text); text-decoration: none; letter-spacing: -0.02em; }
.brand span { color: var(--accent); }
.nav-links { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
/* El enlace en sí: sin decoración propia. El efecto (subrayado que entra, texto que rueda,
   resaltado, punto) lo aporta el sistema de movimiento según lo elegido en el Builder, y
   siempre en un ::after para no mover nunca el texto. */
.nav-links a { position: relative; color: var(--text); text-decoration: none; font-size: 0.95rem; padding-bottom: 2px; }
.nav-links a.active, .nav-links a:hover { color: var(--accent); }
/* El toggle de tema y cualquier link marcado como ícono no llevan subrayado */
.nav-links a#theme-toggle::after, .nav-links a.nav-icon::after { content: none; }

/* Botones y forms */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: var(--accent); color: white; border: 0; padding: 11px 22px; border-radius: var(--radius); font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; }
.btn:hover { filter: brightness(0.92); }
.btn.ghost { background: transparent; color: var(--accent); border: 1.5px solid var(--accent); }
.btn.ghost:hover { background: var(--accent); color: white; filter: none; }
.btn svg, .nav-links a svg { flex-shrink: 0; vertical-align: middle; }
/* Foco visible por teclado (accesibilidad): anillo de acento sin molestar al puntero.
   Los inputs conservan su propio anillo (más abajo); acá van links, botones y controles. */
a:focus-visible, .btn:focus-visible, button:focus-visible, [role="button"]:focus-visible, summary:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px;
}
input, textarea, select { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius); font: inherit; background: var(--bg); color: var(--text); }
label { display: block; font-size: 0.85rem; font-weight: 600; margin: 12px 0 4px; }
.field-error { color: #c0392b; font-size: 0.8rem; }

/* Secciones */
section { padding: 64px 0; }
section h2 { font-size: 1.8rem; letter-spacing: -0.02em; margin: 0 0 8px; }
.section-sub { color: var(--muted); margin: 0 0 28px; max-width: 60ch; }
.grid { display: grid; gap: 20px; }
.grid.cols-3 { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.grid.cols-2 { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 22px; }

/* Slot de imagen reemplazable (ver imageSlot()): comunica "acá va una foto" de forma autocontenida.
   El label usa --muted, que ya cumple contraste AA sobre --surface. */
.img-slot { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; padding: 16px; border-radius: var(--radius); color: var(--text); border: 1px solid var(--line); background: linear-gradient(135deg, var(--surface), color-mix(in srgb, var(--accent) 8%, var(--surface))); }
.img-slot-ic { opacity: 0.65; flex-shrink: 0; }
.img-slot-label { font-size: 0.9rem; font-weight: 600; }
.img-slot-cap { font-size: 0.8rem; color: var(--muted); }

/* Hero */
.hero { background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, var(--bg)), var(--bg)); padding: 96px 0; }
.hero h1 { font-size: clamp(2.25rem, 4.8vw, 3.75rem); line-height: 1.08; letter-spacing: -0.03em; margin: 0 0 16px; max-width: 18ch; text-wrap: balance; overflow-wrap: break-word; }
.hero p { font-size: 1.15rem; color: var(--muted); max-width: 60ch; margin: 0 0 28px; text-wrap: pretty; }

/* Footer */
footer { border-top: 1px solid var(--line); padding: 40px 0; margin-top: 40px; color: var(--muted); font-size: 0.9rem; }
footer .container { display: flex; flex-wrap: wrap; gap: 24px; justify-content: space-between; align-items: center; }
footer form { display: flex; gap: 8px; }
footer input { width: 220px; }

/* Utilitarios */
.toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--text); color: var(--bg); padding: 10px 18px; border-radius: 999px; font-size: 0.9rem; opacity: 0; transition: opacity .25s; pointer-events: none; z-index: 50; }
.toast.show { opacity: 1; }
.badge { background: var(--accent); color: white; border-radius: 999px; font-size: 0.72rem; padding: 1px 7px; vertical-align: super; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--line); }
.price { font-size: 1.5rem; font-weight: 800; }
.muted { color: var(--muted); }
@media (max-width: 640px) { .navbar .container { flex-wrap: wrap; height: auto; padding: 10px 20px; } }

/* Los checks y radios llevan el color de marca siempre (es color, no movimiento) */
input[type="checkbox"], input[type="radio"] { accent-color: var(--accent); }

${motionCss(cfg)}
`;
}

/* ---------- layout y páginas ---------- */

function layout(cfg, { title, body, active = '', nav = [], head = '' }) {
  const links = nav.map(l => {
    // l.html: el label ya es markup confiable del módulo (p. ej. un ícono Phosphor horneado),
    // no dato del usuario, así que no se escapa. l.icon: link de ícono (sin subrayado animado).
    const cls = [l.href === active ? 'active' : '', l.icon ? 'nav-icon' : ''].filter(Boolean).join(' ');
    return `<a href="${l.href}"${cls ? ` class="${cls}"` : ''}${l.id ? ` id="${l.id}"` : ''}>${l.html ? l.label : esc(l.label)}${l.badge ? ` <span class="badge" id="${l.badge}">0</span>` : ''}</a>`;
  }).join('\n        ');
  const newsletter = cfg.moduleIds.includes('newsletter')
    ? `<form id="newsletter-form"><input type="email" name="email" placeholder="tu@email.com" required><button class="btn" type="submit">Suscribirme</button></form>`
    : '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — ${esc(cfg.brand.name)}</title>
${(() => { const fh = fontHead(cfg.brand.font); return fh ? fh + '\n' : ''; })()}  <link rel="stylesheet" href="/css/styles.css">
${head ? head + '\n' : ''}</head>
<body>
  <nav class="navbar">
    <div class="container">
      <a class="brand" href="/index.html">${esc(cfg.brand.name)}<span>.</span></a>
      <div class="nav-links">
        ${links}
      </div>
    </div>
  </nav>
${body}
  <footer>
    <div class="container">
      <div>© ${new Date().getFullYear()} ${esc(cfg.brand.name)} · ${esc(cfg.brand.tagline)}</div>
      ${newsletter}
    </div>
  </footer>
  <div class="toast" id="toast"></div>
${cfg.motion ? '  <script src="/js/motion.js"></script>\n' : ''}${cfg.anime ? '  <script src="/js/anime.js"></script>\n' : ''}  <script src="/js/app.js"></script>
</body>
</html>
`;
}

// Slot de imagen reemplazable y AUTOCONTENIDO (sin dependencias externas: el proyecto generado
// sigue corriendo 100% offline). No finge ser una foto lista: comunica con ícono + texto que ahí
// va una imagen, para que el cliente reemplace el <div class="img-slot"> por un <img> real. Es la
// alternativa honesta a un bloque de degradado que se confunde con diseño terminado.
function imageSlot({ ratio = '4/3', label = 'Reemplazá con tu foto', caption = '', attrs = '' } = {}) {
  return `<div class="img-slot"${attrs ? ' ' + attrs : ''} role="img" aria-label="${esc(caption || label)}" style="aspect-ratio:${ratio}">
        <svg class="img-slot-ic" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg>
        <span class="img-slot-label">${esc(label)}</span>${caption ? `\n        <span class="img-slot-cap">${esc(caption)}</span>` : ''}
      </div>`;
}

function aboutBody(cfg) {
  return `  <section>
    <div class="container">
      <h2>Sobre ${esc(cfg.brand.name)}</h2>
      <p class="section-sub">${esc(cfg.texts.about)}</p>
      <div class="grid cols-3">
        <div class="card">${phIcon('target', { size: 32, color: 'var(--accent)' })}<h3 style="margin:12px 0 6px">Misión</h3><p class="muted" style="margin:0">Resolver de verdad el problema de nuestros clientes, sin vueltas.</p></div>
        <div class="card">${phIcon('users', { size: 32, color: 'var(--accent)' })}<h3 style="margin:12px 0 6px">Equipo</h3><p class="muted" style="margin:0">Un equipo chico y enfocado, con oficio y ganas.</p></div>
        <div class="card">${phIcon('handshake', { size: 32, color: 'var(--accent)' })}<h3 style="margin:12px 0 6px">Valores</h3><p class="muted" style="margin:0">Claridad, calidad y trato directo.</p></div>
      </div>
    </div>
  </section>`;
}

/* ---------- JS de cliente base ---------- */

function baseClientJs(cfg) {
  return `/* ${cfg.brand.name} — cliente. Generado con WebForge Builder. */
(function () {
  window.App = {
    async api(path, opts = {}) {
      if (window.__PREVIEW__) { App.toast('Vista previa: la API corre en el proyecto exportado'); throw new Error('preview'); }
      const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
      const token = localStorage.getItem('token');
      if (token) headers.Authorization = 'Bearer ' + token;
      const res = await fetch(path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || 'Error'), { data });
      return data;
    },
    toast(msg) {
      const t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(t._h);
      t._h = setTimeout(() => t.classList.remove('show'), 2600);
    },
    money(n) { return '$' + Number(n).toLocaleString('es-AR'); },
    esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
    /** Tabla genérica: cols = [{key, label, render?}] */
    table(rows, cols) {
      if (!rows || !rows.length) return '<p class="muted">Sin datos todavía.</p>';
      return '<div class="card" style="overflow:auto;padding:0"><table><thead><tr>' +
        cols.map(c => '<th>' + c.label + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + cols.map(c => '<td>' + (c.render ? c.render(r) : App.esc(r[c.key] ?? '—')) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div>';
    },
    /** Options de un <select> a partir de una lista */
    options(list, valueKey, labelKey, placeholder) {
      return (placeholder ? '<option value="">' + placeholder + '</option>' : '') +
        list.map(x => '<option value="' + x[valueKey] + '">' + App.esc(x[labelKey]) + '</option>').join('');
    },
  };
})();
`;
}

module.exports = { AI_JS, FONTS, FONT_CATALOG, fontHead, MOTION_LIB, ANIME_LIB, esc, txt, txtList, imageSlot, packageJson, envExample, GITIGNORE, serverJs, appJs, VERCEL_JSON, vercelJson, VERCEL_FN, ENV_JS, DB_JS, DB_SUPABASE_JS, schemaSql, VALIDATE_JS, stylesCss, layout, aboutBody, baseClientJs };
