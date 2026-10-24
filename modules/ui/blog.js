const { esc, txt, txtList } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

// Artículos placeholder del blog; el cliente los edita acá (en el proyecto generado,
// en public/index.html y en las páginas blog-*.html si el módulo blogpages está activo).
// La sección de la Home, las páginas por artículo (blogpages) y el feed RSS (rss)
// salen todos de esta misma lista: una sola fuente de verdad.
const POSTS = [
  {
    slug: 'elegir-servicio',
    fecha: 'Junio 2026',
    fechaISO: '2026-06-15',
    titulo: 'Cómo elegir el servicio correcto',
    resumen: 'Una guía corta para decidir sin dar vueltas.',
    parrafos: [
      'Elegir un servicio no debería ser una odisea. La clave está en tener claro qué problema querés resolver antes de mirar opciones: cuando el objetivo está definido, comparar deja de ser una lotería.',
      'Nuestro consejo es simple: hacé una lista de tres cosas que no pueden faltar y una que sería un lindo extra. Con esa vara, la mayoría de las alternativas se descartan solas y quedan las que de verdad te sirven.',
      'Y si todavía tenés dudas, escribinos. Preferimos orientarte bien antes que venderte algo que no necesitás: un cliente bien asesorado vuelve, y eso para nosotros vale más que cualquier venta puntual.',
    ],
  },
  {
    slug: 'novedades-temporada',
    fecha: 'Mayo 2026',
    fechaISO: '2026-05-20',
    titulo: 'Novedades de temporada',
    resumen: 'Todo lo nuevo que preparamos para vos.',
    parrafos: [
      'Esta temporada llega con varias novedades que veníamos preparando hace meses. Renovamos parte de nuestra propuesta y sumamos opciones que nos pidieron muchísimo durante el último año.',
      'Entre lo más destacado: nuevas alternativas pensadas para quienes recién empiezan, mejoras en los servicios de siempre y atención en horarios extendidos para que te quede cómodo pasar cuando puedas.',
      'Como siempre, los primeros en enterarse de cada lanzamiento son quienes nos siguen de cerca. Si no querés perderte nada, suscribite a las novedades o seguinos en redes.',
    ],
  },
  {
    slug: 'detras-de-escena',
    fecha: 'Abril 2026',
    fechaISO: '2026-04-10',
    titulo: 'Detrás de escena',
    resumen: 'Así trabaja nuestro equipo día a día.',
    parrafos: [
      'Muchos nos preguntan cómo es un día típico de trabajo puertas adentro. La respuesta corta: mucha coordinación, mate de por medio y una obsesión sana por los detalles.',
      'Cada proyecto arranca con una reunión corta donde definimos prioridades y responsables. Después, cada uno a lo suyo, con revisiones cruzadas antes de dar nada por terminado: cuatro ojos ven más que dos.',
      'Ese proceso, que de afuera no se ve, es el motivo por el que podemos cumplir plazos sin sacrificar calidad. En este espacio vamos a ir contando más sobre cómo trabajamos, así nos conocés mejor.',
    ],
  },
];

// Default del campo editable: exactamente los artículos de arriba, para que el panel arranque
// mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar. Sólo viajan los
// datos de la tarjeta (fecha, título, resumen): el cuerpo del artículo se edita en su página.
const ITEMS_DEFAULT = POSTS.map(p => `${p.fecha} | ${p.titulo} | ${p.resumen}`).join('\n');

// Slug a partir del título, con el mismo criterio que usa el generador para el nombre del
// proyecto. Sólo se usa para artículos AGREGADOS por el cliente: los tres de fábrica
// conservan su slug original para no cambiar las URLs de un sitio ya publicado.
const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/**
 * Lista efectiva de artículos según la config del Builder.
 * La consumen también `blogpages` (una página por artículo) y `rss` (el feed): tiene que
 * haber UNA sola fuente, o el feed terminaría anunciando artículos distintos de los de la Home.
 * Formatos aceptados por línea: "fecha | título | resumen", "fecha | título" o sólo "título".
 * El cuerpo (`parrafos`) y la fecha ISO del feed salen del artículo base por índice: el campo
 * del Builder edita la tarjeta, no el texto largo de la página.
 */
function posts(cfg) {
  const lineas = txtList(cfg, 'blog', 'items', ITEMS_DEFAULT);
  if (!lineas.length) return POSTS;
  const usados = new Set();
  return lineas.map((linea, i) => {
    const partes = Array.isArray(linea) ? linea : [linea];
    const base = POSTS[i % POSTS.length];
    const fecha = partes.length >= 2 ? partes[0] : base.fecha;
    const titulo = partes.length >= 2 ? partes[1] : partes[0];
    const resumen = partes.length >= 3 ? partes.slice(2).join(' | ') : base.resumen;
    // Los artículos de fábrica mantienen su slug; los nuevos lo derivan del título
    let slug = i < POSTS.length ? POSTS[i].slug : (slugify(titulo) || `articulo-${i + 1}`);
    // Dos artículos con el mismo slug colapsarían en una sola página: se desempata por posición
    if (usados.has(slug)) slug = `${slug}-${i + 1}`;
    usados.add(slug);
    return { slug, fecha, fechaISO: base.fechaISO, titulo, resumen, parrafos: base.parrafos };
  });
}

module.exports = {
  id: 'blog', type: 'ui', name: 'Blog',
  description: 'Listado de novedades y artículos.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Novedades', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'Lo último de nuestro equipo.', max: 220 },
    {
      key: 'items', label: 'Artículos', type: 'list', max: 2600, default: ITEMS_DEFAULT,
      hint: 'Un artículo por línea: fecha | título | resumen. Es lo que se ve en la tarjeta; el texto largo de cada artículo se edita después en su página blog-*.html.',
    },
  ],
  // Si el módulo blogpages está activo, cada tarjeta enlaza a su página de artículo
  html: (cfg) => {
    const conPaginas = cfg.moduleIds.includes('blogpages');
    return `  <section id="blog" style="background:var(--surface)">
    <div class="container">
      <h2>${esc(txt(cfg, 'blog', 'titulo', 'Novedades'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'blog', 'bajada', 'Lo último de nuestro equipo.'))}</p>
      <div class="grid cols-3">
${posts(cfg).map(p => `        <article class="card"><span class="muted" style="font-size:.8rem">${esc(p.fecha)}</span><h3>${conPaginas ? `<a href="/blog-${esc(p.slug)}.html" style="color:inherit;text-decoration:none">${esc(p.titulo)}</a>` : esc(p.titulo)}</h3><p class="muted">${esc(p.resumen)}</p>${conPaginas ? `<a href="/blog-${esc(p.slug)}.html" style="display:inline-flex;align-items:center;gap:4px">Leer más ${phIcon('arrow-right', { size: 14 })}</a>` : ''}</article>`).join('\n')}
      </div>
    </div>
  </section>`;
  },
  readmeNotes: () => [
    '**Blog**: las tarjetas de novedades salen del bloque *Textos por sección* del Builder; si no las editaste, son placeholders. También podés cambiarlas después en la sección `#blog` de `public/index.html`.',
  ],
  // Lista base compartida con los módulos blogpages (páginas por artículo) y rss (feed)
  POSTS,
};

// Se exporta el helper para que las páginas por artículo y el feed usen exactamente
// los mismos artículos que la Home.
module.exports.posts = posts;
