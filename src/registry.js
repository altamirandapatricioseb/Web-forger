/**
 * Registro de módulos (patrón plugin).
 * Un módulo es un archivo en modules/ui o modules/functional que exporta:
 *   id           string único
 *   type         'ui' | 'functional'
 *   name         nombre visible
 *   description  descripción corta
 *   fields            → [{key, label, default, max, type?, hint?}] textos del
 *                       módulo editables desde el Builder. El panel arma el bloque
 *                       "Textos por sección" con esto y el generador deja el valor
 *                       resuelto en cfg.moduleTexts[id][key]; se lee con los helpers
 *                       txt()/txtList() de templates.js, nunca a mano.
 *                       type: 'text' (default) | 'textarea' | 'list' (uno por línea,
 *                       columnas separadas por "|") | 'select' (opciones cerradas:
 *                       el campo trae options = [[valor, etiqueta], …] y el generador
 *                       valida contra esa lista, no por largo)       (opcional)
 *   html(cfg)         → string   sección HTML para la Home            (opcional)
 *   files(cfg, ctx)   → {ruta: contenido} archivos backend generados
 *                       (ctx = {pages: ['index.html', …], nav: [{label, href}]}
 *                       con todas las páginas del sitio y el menú ya armado;
 *                       útil para sitemaps, índices y menús administrables) (opcional)
 *   mounts            → [{route, file}] rutas Express a montar         (opcional)
 *   middlewares       → [{file}] middlewares globales montados ANTES de
 *                       los estáticos (interceptan también el HTML)     (opcional)
 *   vercelRewrites    → ['/p/:slug*'] rutas propias fuera de /api que un
 *                       middleware responde. En Vercel, lo que no matchea un
 *                       rewrite lo sirve la CDN y nunca llega a Express      (opcional)
 *   env               → {CLAVE: valorEjemplo} para .env.example        (opcional)
 *   nav(cfg)          → [{label, href}] links extra en la navbar       (opcional)
 *   pages(cfg, ctx)   → {nombre: htmlBody} páginas propias             (opcional)
 *   clientJs(cfg)     → string   JS que se agrega a public/js/app.js   (opcional)
 *   head(cfg, page)   → string   fragmento extra del <head> de cada página
 *                       (page = {title, active}; para SEO, favicons…)  (opcional)
 *   collections       → [string] colecciones de datos que usa          (opcional)
 *   requires          → [string] ids de módulos de los que depende     (opcional)
 *   readmeNotes(cfg)  → [string] avisos en el README generado para
 *                       pasos que requieren acción humana              (opcional)
 *
 * Para agregar un módulo nuevo alcanza con crear el archivo: se carga solo.
 *
 * PATRÓN "backend de una sección" (textos, negocio, planes, faqadmin, horarios, cambio, equipo):
 * un módulo funcional que le da datos administrables a una sección que el generador hornea en el
 * HTML. La convención, ya repetida siete veces:
 *   1. `requires: ['<id del módulo UI>']` — sin la sección no hay nada que alimentar.
 *   2. La siembra (`db.seedIfEmpty`) repite EXACTAMENTE los datos horneados en el HTML, para que
 *      la primera carga no parpadee mostrando primero unos datos y después otros.
 *   3. `GET` público + inyección en vivo desde clientJs sobre el DOM ya renderizado; el panel de
 *      edición es solo-admin y sólo existe si `auth` está activo (sin auth, el módulo degrada a
 *      "editá el JSON a mano" y la parte pública sigue funcionando).
 *   4. Si al reemplazar el DOM se rompen handlers que el módulo UI enganchó al cargar, ese módulo
 *      UI expone un punto de entrada `window.WF*` (WFPrecios.refrescar, WFFaq.rebind,
 *      WFMoneda.setMonedas, WFHorarios.actualizar) en vez de duplicar su lógica acá.
 */
const fs = require('fs');
const path = require('path');

const modules = new Map();

for (const type of ['ui', 'functional']) {
  const dir = path.join(__dirname, '..', 'modules', type);
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.js')) continue;
    const mod = require(path.join(dir, file));
    if (!mod.id || mod.type !== type) {
      throw new Error(`Módulo inválido: ${type}/${file} (falta id o type incorrecto)`);
    }
    if (modules.has(mod.id)) throw new Error(`Módulo duplicado: ${mod.id}`);
    modules.set(mod.id, mod);
  }
}

module.exports = {
  list: () => [...modules.values()],
  get: (id) => modules.get(id),
  selected: (ids = []) => ids.map(id => modules.get(id)).filter(Boolean),
};
