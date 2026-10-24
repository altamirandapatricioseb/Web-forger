/**
 * WebForge Builder — aplicación Express (compartida por el server local y Vercel).
 * Expone: catálogo de módulos, preview en vivo, exportación a ZIP
 * y guardado/compartido de proyectos (opcional, con Supabase).
 */
const express = require('express');
const path = require('path');
const registry = require('./registry');
const categorias = require('./categorias');
const motion = require('./motion');
const { generate } = require('./generator');
const { streamZip } = require('./zipper');
const T = require('./templates');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));

/* ---- caché de generación ----
   generate(config) es determinista para una config dada, pero el preview lo llama en cada
   tecla (con debounce) y cada cambio de pestaña reusa EXACTAMENTE la misma config. Cachear el
   resultado por config evita rearmar el proyecto entero (todas las páginas + libs vendorizadas)
   en esos casos: cambiar de pestaña, deshacer un cambio, o exportar lo que ya se previsualizó
   salen instantáneos. LRU simple con tope chico; la memoria queda acotada. */
const GEN_CACHE = new Map();
const GEN_CACHE_MAX = 24;

// Clave estable: mismas claves en distinto orden no deberían romper el hit de caché.
function stableKey(value) {
  if (Array.isArray(value)) return '[' + value.map(stableKey).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableKey(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function generateCached(config) {
  const key = stableKey(config || {});
  const hit = GEN_CACHE.get(key);
  if (hit) { GEN_CACHE.delete(key); GEN_CACHE.set(key, hit); return hit; } // refrescar LRU
  const files = generate(config || {});
  GEN_CACHE.set(key, files);
  if (GEN_CACHE.size > GEN_CACHE_MAX) GEN_CACHE.delete(GEN_CACHE.keys().next().value);
  return files;
}

// Catálogo de tipografías elegibles para el sitio generado (lo consume el panel del Builder).
app.get('/api/fonts', (req, res) => {
  res.json(T.FONT_CATALOG.map(f => ({ id: f.id, label: f.label, stack: f.stack, google: f.google || null })));
});

// Catálogo de efectos de movimiento elegibles (ejes + opciones). El panel arma sus selects
// con esto, así agregar una variante en src/motion.js la hace aparecer sin tocar el frontend.
app.get('/api/efectos', (req, res) => {
  res.json(motion.EJES);
});

// Orden de las categorías del catálogo (el panel las muestra en este orden).
app.get('/api/categorias', (req, res) => {
  res.json({ ui: categorias.catOrder('ui'), functional: categorias.catOrder('functional') });
});

// Catálogo de módulos disponibles (metadata para la UI)
app.get('/api/modules', (req, res) => {
  res.json(registry.list().map(m => ({
    id: m.id, type: m.type, name: m.name, description: m.description,
    // category y requires: los usa el panel del Builder para agrupar el catálogo y avisar
    // qué módulos se agregan por dependencia. La categoría sale de src/categorias.js
    // (fuente única) salvo que el módulo declare la suya.
    category: categorias.catFor(m),
    requires: Array.isArray(m.requires) ? m.requires : [],
    // Campos de texto editables que declara el módulo (contrato `fields`): con esto el panel
    // arma el bloque "Textos por sección" sin saber nada de cada módulo en particular.
    fields: Array.isArray(m.fields) ? m.fields : [],
  })));
});

// Preview en vivo: genera el proyecto en memoria y devuelve la página pedida
// con CSS y JS inlineados para renderizar dentro de un iframe (srcdoc).
app.post('/api/preview', (req, res) => {
  try {
    const { config, page = 'index' } = req.body || {};
    const files = generateCached(config || {});
    const html = files.get(`public/${page}.html`);
    if (!html) return res.status(404).json({ error: `La página "${page}" no existe con esta configuración.` });
    const css = files.get('public/css/styles.css') || '';
    const js = files.get('public/js/app.js') || '';
    const motion = files.get('public/js/motion.js');
    const anime = files.get('public/js/anime.js');
    // Reemplazos por FUNCIÓN a propósito: el CSS/JS contiene '$' (p. ej. App.money
    // devuelve '$'), y en un string de reemplazo las secuencias $&, $', $` tienen
    // significado especial y corromperían el código inlineado. La forma-función
    // inserta el valor tal cual.
    let inlined = html
      .replace('<link rel="stylesheet" href="/css/styles.css">', () => `<style>${css}</style>`)
      .replace('<script src="/js/app.js"></script>', () => `<script>window.__PREVIEW__=true;${js}</script>`);
    // Las librerías Motion y Anime.js se referencian por <script src>; en el iframe
    // (srcdoc) esa ruta no resuelve al proyecto generado, así que las inlineamos para
    // ver las animaciones en la vista previa tal como saldrán en el proyecto exportado.
    if (motion) inlined = inlined.replace('<script src="/js/motion.js"></script>', () => `<script>${motion}</script>`);
    if (anime) inlined = inlined.replace('<script src="/js/anime.js"></script>', () => `<script>${anime}</script>`);
    res.json({ html: inlined, pages: pagesOf(files) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Exportación: genera el proyecto y lo empaqueta en un ZIP descargable.
app.post('/api/export', (req, res) => {
  try {
    const config = (req.body && req.body.config) || {};
    const files = generateCached(config);
    const slug = (config.brand && config.brand.name ? config.brand.name : 'proyecto')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'proyecto';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`);
    streamZip(files, slug, res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function pagesOf(files) {
  return [...files.keys()]
    .filter(k => k.startsWith('public/') && k.endsWith('.html'))
    .map(k => k.replace('public/', '').replace('.html', ''));
}

// ---- Proyectos guardados (opcional: requiere Supabase configurado) ----
const store = require('./store');

// POST /api/projects — guarda una config y devuelve un id compartible
app.post('/api/projects', async (req, res) => {
  if (!store.enabled()) return res.status(503).json({ error: 'Guardado no configurado: faltan SUPABASE_URL / SUPABASE_SERVICE_KEY' });
  const config = req.body && req.body.config;
  if (!config || typeof config !== 'object') return res.status(422).json({ error: 'Config inválida' });
  try {
    // valida generando: si la config no genera, no se guarda
    generate(config);
    const id = await store.save(config);
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/projects/:id — recupera una config guardada
app.get('/api/projects/:id', async (req, res) => {
  if (!store.enabled()) return res.status(503).json({ error: 'Guardado no configurado' });
  try {
    const config = await store.load(req.params.id);
    if (!config) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
