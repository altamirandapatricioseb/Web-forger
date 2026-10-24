/**
 * Categorías del catálogo de módulos (fuente única de verdad).
 *
 * Antes vivían duplicadas dentro de public/app.js y sólo cubrían ~40 de los 128 módulos
 * funcionales: los otros 86 caían todos juntos en "Otros", que con este tamaño de catálogo
 * es lo mismo que no tener categorías. Al moverlas acá las consumen el panel del Builder
 * (vía /api/modules y /api/categorias) y el generador del manual (tools/catalogo.js), y
 * agregar un módulo nuevo se resuelve en un solo lugar.
 *
 * Un módulo puede declarar su propia `category` y esa gana; lo que no aparece en ninguna
 * lista sigue cayendo en "Otros", así un módulo nuevo aparece igual sin tocar este archivo.
 */

// Módulos de interfaz: secciones y comportamientos visuales del sitio.
const UI_CATS = [
  ['Navegación y estructura', ['navmobile', 'megamenu', 'stickynav', 'breadcrumbs', 'sectionnav', 'backtotop', 'megafooter', 'announcement', 'contactbar', 'mobilecta', 'toc', 'commandpalette', 'scrollcue', 'scrollprogress', 'search']],
  ['Hero y encabezado', ['hero', 'herobg', 'typewriter', 'preloader', 'escena3d']],
  ['Medios y galería', ['gallery', 'galleryfilters', 'lightbox', 'carousel', 'masonry', 'bento', 'imagehotspots', 'video', 'lazyload', 'parallax', 'flipcards', 'marquee']],
  ['Contenido y secciones', ['services', 'servicespage', 'features', 'process', 'team', 'timeline', 'faq', 'tabs', 'readmore', 'blog', 'blogpages', 'rss', 'portfolio', 'quiz', 'beforeafter', 'skillbars', 'counters', 'metrics', 'hours', 'map', 'datatable']],
  ['Comercio y precios', ['pricing', 'comparison', 'productcompare', 'catalogo', 'currency', 'payments', 'estimator', 'goalmeter']],
  ['Prueba social y confianza', ['testimonials', 'testimonialslider', 'reviewswall', 'logos', 'press', 'ratingbanner', 'socialproof', 'trust', 'social', 'socialfeed']],
  ['Captación y formularios', ['contact', 'quote', 'jobs', 'newsletterinline', 'multistep', 'whatsappform', 'whatsapp', 'waitlist', 'events', 'resources']],
  ['Conversión y avisos', ['cta', 'promo', 'exitpopup', 'countdown', 'cookies', 'agegate', 'share', 'appbadges']],
  ['Utilidades y SEO', ['seo', 'favicon', 'page404', 'legal', 'i18n', 'pwa', 'a11y', 'darkmode', 'reveal', 'branchselector', 'modal', 'tooltip']],
];

// Módulos funcionales: los que agregan backend, panel y datos reales.
const FN_CATS = [
  ['Cuentas y usuarios', ['auth', 'perfil', 'recuperar', 'users-admin', 'roles', 'clientportal', 'membership']],
  ['Tienda y productos', ['cart', 'products-admin', 'ficha', 'tienda', 'variantes', 'etiquetas', 'relacionados', 'consultas', 'comparativa', 'listaprecios', 'favorites', 'reviews', 'restock', 'giftcards']],
  ['Ventas, pedidos y cobros', ['pedidos', 'ordertrack', 'pedidoscarta', 'abandonos', 'coupons', 'descuentos', 'enviogratis', 'shipping', 'pagoinformado', 'invoices', 'ctacte', 'caja', 'simulador', 'presupuestador', 'quotesadmin', 'returns', 'warranty', 'donations']],
  ['Reservas y turnos', ['bookings', 'agenda', 'reservamesa', 'alquileres', 'fila', 'eventregister', 'callback']],
  ['Contenido administrable', ['textos', 'paginas', 'navegacion', 'banners', 'blogcms', 'projects', 'albums', 'videos', 'downloads', 'listings', 'menu', 'promos', 'servicios', 'equipo', 'historia', 'horarios', 'faqadmin', 'planes', 'marca', 'razones', 'eventos', 'espera', 'publicaciones', 'recomendador', 'cambio', 'negocio', 'traducciones', 'seoadmin', 'uploads', 'cursos']],
  ['Marketing y fidelización', ['newsletter', 'campanas', 'mailer', 'leadmagnet', 'leads', 'referrals', 'loyalty', 'raffle', 'cumples', 'nps', 'feedback', 'polls', 'usertestimonials', 'experimentos', 'enlaces', 'qr']],
  ['Soporte y comunidad', ['chatbot', 'ai-agent', 'livechat', 'comments', 'qanda', 'kb', 'tickets', 'profesionales', 'formularios', 'firma']],
  ['Operación interna', ['branches', 'inventory', 'pos', 'compras', 'personal', 'repositores', 'trabajo', 'vencimientos', 'tablero', 'importar', 'respaldo', 'tareas', 'notifcentro', 'clientes', 'jobsadmin', 'vacantes', 'inbox']],
  ['Seguridad y cumplimiento', ['escudo', 'auditoria', 'privacidad', 'mantenimiento', 'salud', 'webhooks']],
  ['Métricas y búsqueda', ['stats', 'visits', 'sitesearch']],
];

// id -> categoría (la última lista que lo nombre gana; el test de tools/catalogo.js verifica
// que ningún id aparezca dos veces, así un duplicado no se esconde)
const CAT_OF = {};
for (const [cat, ids] of [...UI_CATS, ...FN_CATS]) ids.forEach(id => { CAT_OF[id] = cat; });

// Categoría efectiva de un módulo: la que declara el módulo gana sobre el mapa de arriba.
const catFor = (m) => m.category || CAT_OF[m.id] || 'Otros';

// Orden en que el panel muestra las categorías de cada tipo ("Otros" siempre al final).
const catOrder = (type) => (type === 'ui' ? UI_CATS : FN_CATS).map(c => c[0]).concat('Otros');

module.exports = { UI_CATS, FN_CATS, CAT_OF, catFor, catOrder };
