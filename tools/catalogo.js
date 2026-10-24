/**
 * Genera MODULOS.md: la referencia completa del catálogo, agrupada por categoría.
 *
 *   node tools/catalogo.js
 *
 * Se genera en vez de escribirse a mano porque el catálogo cambia en cada corrida y una lista
 * copiada a mano se desactualiza en silencio (que es exactamente lo que le pasó a la lista de
 * módulos del README). La fuente es el registro real + src/categorias.js.
 */
const fs = require('fs');
const path = require('path');
const registry = require('../src/registry');
const { catFor, catOrder } = require('../src/categorias');

// Primera oración de la descripción, para que la tabla se pueda leer de un vistazo.
// El texto completo se ve en el Builder al pasar por el módulo.
function resumen(desc = '') {
  const limpio = String(desc).replace(/\s+/g, ' ').trim();
  const corte = limpio.search(/\.\s/);
  let frase = corte > 40 ? limpio.slice(0, corte + 1) : limpio;
  if (frase.length > 240) frase = frase.slice(0, 237).replace(/\s+\S*$/, '') + '…';
  return frase.replace(/\|/g, '\\|');
}

function tabla(mods) {
  const filas = mods.map(m => {
    const req = (m.requires || []).length ? '`' + m.requires.join('` `') + '`' : '—';
    const marcas = [
      m.pages ? 'páginas' : '',
      m.mounts ? 'API' : '',
      m.middlewares ? 'middleware' : '',
      (m.collections || []).length ? 'datos' : '',
    ].filter(Boolean).join(', ') || '—';
    return `| \`${m.id}\` | **${m.name}** | ${resumen(m.description)} | ${req} | ${marcas} |`;
  });
  return ['| id | Módulo | Qué hace | Requiere | Aporta |', '|---|---|---|---|---|', ...filas].join('\n');
}

function seccion(type, titulo, intro) {
  const mods = registry.list().filter(m => m.type === type);
  const grupos = new Map();
  for (const m of mods) {
    const c = catFor(m);
    if (!grupos.has(c)) grupos.set(c, []);
    grupos.get(c).push(m);
  }
  const partes = [`## ${titulo} (${mods.length})`, '', intro, ''];
  for (const cat of catOrder(type, [...grupos.keys()])) {
    const lista = grupos.get(cat);
    if (!lista || !lista.length) continue;
    lista.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    partes.push(`### ${cat} (${lista.length})`, '', tabla(lista), '');
  }
  return partes.join('\n');
}

const total = registry.list().length;
const ui = registry.list().filter(m => m.type === 'ui').length;
const doc = `# Catálogo de módulos — WebForge Builder

> Archivo **generado** por \`node tools/catalogo.js\`. No lo edites a mano: se regenera con el
> catálogo real del registro. Para el manual de uso, ver **[MANUAL.md](MANUAL.md)**.

**${total} módulos: ${ui} de interfaz · ${total - ui} funcionales.**

La columna **Requiere** son las dependencias: si tildás un módulo, el Builder agrega solo las
suyas (y las de las suyas, en cadena) y te las muestra marcadas como *auto*. La columna
**Aporta** dice qué suma cada uno al proyecto exportado: *páginas* (páginas HTML propias),
*API* (rutas del backend), *middleware* (intercepta todos los pedidos, también los HTML) y
*datos* (colecciones persistidas).

${seccion('ui', 'Módulos de interfaz', 'Secciones visuales y comportamientos del sitio. No tienen backend propio: se hornean en el HTML que exporta el Builder (varios tienen un módulo funcional "administrable" que después les da datos editables sin regenerar).')}
${seccion('functional', 'Módulos funcionales', 'Agregan backend real: rutas de API, validación en el servidor, persistencia y —casi siempre— un panel de administración. Muchos existen para volver editable una sección de interfaz: el par típico es `faq` (la sección) + `faqadmin` (el panel que la administra).')}`;

fs.writeFileSync(path.join(__dirname, '..', 'MODULOS.md'), doc.replace(/\n{3,}/g, '\n\n'));
console.log(`MODULOS.md generado: ${total} módulos.`);
