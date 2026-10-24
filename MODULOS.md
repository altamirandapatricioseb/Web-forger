# Catálogo de módulos — WebForge Builder

> Archivo **generado** por `node tools/catalogo.js`. No lo edites a mano: se regenera con el
> catálogo real del registro. Para el manual de uso, ver **[MANUAL.md](MANUAL.md)**.

**229 módulos: 101 de interfaz · 128 funcionales.**

La columna **Requiere** son las dependencias: si tildás un módulo, el Builder agrega solo las
suyas (y las de las suyas, en cadena) y te las muestra marcadas como *auto*. La columna
**Aporta** dice qué suma cada uno al proyecto exportado: *páginas* (páginas HTML propias),
*API* (rutas del backend), *middleware* (intercepta todos los pedidos, también los HTML) y
*datos* (colecciones persistidas).

## Módulos de interfaz (101)

Secciones visuales y comportamientos del sitio. No tienen backend propio: se hornean en el HTML que exporta el Builder (varios tienen un módulo funcional "administrable" que después les da datos editables sin regenerar).

### Navegación y estructura (15)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `announcement` | **Barra de anuncios** | Barra superior de promoción con cuenta regresiva (hasta el domingo) y botón de cierre que se recuerda en localStorage. | — | — |
| `contactbar` | **Barra de contacto móvil** | Barra fija inferior, solo visible en celulares, con acciones de un toque: llamar, WhatsApp y cómo llegar. | — | — |
| `search` | **Buscador** | Búsqueda en vivo sobre el contenido de la página. | — | — |
| `mobilecta` | **CTA fijo en móvil** | Barra de acción fija al pie de la pantalla en móvil con un botón siempre visible (contacto, presupuesto o WhatsApp). | — | — |
| `scrollcue` | **Indicador de scroll** | Flecha animada al pie del hero que invita a seguir bajando y lleva a la siguiente sección al hacer clic. | `hero` | — |
| `toc` | **Índice de página** | Tarjeta flotante "En esta página" que se arma sola con los títulos del contenido y marca el visible al scrollear, con salto suave. | — | — |
| `megafooter` | **Mega footer** | Pie de página ampliado (pre-footer) con columnas de enlaces, contacto y descripción de la marca. | — | — |
| `megamenu` | **Menú desplegable** | Agrega a la navbar un menú desplegable con submenús agrupados (mega menú), accesible y responsive. | — | — |
| `navmobile` | **Menú hamburguesa** | Navbar responsive: en pantallas chicas los links se pliegan en un menú hamburguesa accesible. | — | — |
| `breadcrumbs` | **Miga de pan** | Breadcrumb automático bajo la navbar en todas las páginas internas (Inicio › Página actual), con marcado accesible. | — | — |
| `stickynav` | **Navbar inteligente al scroll** | La barra de navegación se compacta y gana sombra al bajar, se oculta cuando el visitante baja y reaparece al subir. | — | — |
| `sectionnav` | **Navegación por puntos** | Riel vertical de puntos a un costado que resalta la sección visible y lleva a ella con scroll suave. | — | — |
| `commandpalette` | **Paleta de comandos (⌘K)** | Buscador global con atajos de teclado (Ctrl/Cmd+K): salta a cualquier página, sección o acción rápida del sitio. | — | — |
| `scrollprogress` | **Progreso de lectura** | Barra fina en el borde superior que indica cuánto se avanzó en la página. | — | — |
| `backtotop` | **Volver arriba** | Botón flotante que aparece al scrollear y vuelve al inicio con scroll suave. | — | — |

### Hero y encabezado (5)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `escena3d` | **Escena 3D al scroll** | Sección de landing puramente visual: un objeto típico del rubro (casa, teléfono desarmado, anteojos, switch mecánico o caja de envío) se recorre en 3D a medida que el visitante scrollea, con pasos de texto al costado. | — | — |
| `herobg` | **Fondo animado del hero** | Fondo decorativo del hero con manchas de color difuminadas que flotan suavemente (estilo aurora), animadas con Anime.js. | `hero` | — |
| `hero` | **Hero** | Portada principal con título, bajada y llamado a la acción. | — | — |
| `preloader` | **Pantalla de carga** | Pantalla de bienvenida a pantalla completa con el nombre de marca y un spinner que se desvanece cuando la página terminó de cargar. | — | — |
| `typewriter` | **Titular con palabras rotativas** | Franja con un titular donde una palabra se reescribe sola (efecto máquina de escribir), rotando entre varios servicios o rubros. | — | — |

### Medios y galería (12)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `parallax` | **Banda parallax** | Banda a todo el ancho con una frase destacada y capas de fondo que se mueven a distinta velocidad al hacer scroll (efecto profundidad). | — | — |
| `lazyload` | **Carga diferida de imágenes** | Difiere la descarga de las imágenes (loading="lazy") y las hace aparecer con un fundido suave al entrar en pantalla. | — | — |
| `carousel` | **Carrusel** | Carrusel de destacados con flechas, puntos y autoplay (se pausa al interactuar). | — | — |
| `galleryfilters` | **Filtros de galería** | Tabs de categorías arriba de la galería que filtran las tarjetas, estilo portfolio. | `gallery` | — |
| `gallery` | **Galería** | Grilla de imágenes o trabajos destacados, con realce al pasar el mouse. | — | — |
| `masonry` | **Galería mosaico** | Galería tipo mosaico (masonry) con tarjetas de alturas variables en columnas al estilo Pinterest. | — | — |
| `bento` | **Grilla bento** | Mosaico asimétrico de destacados (estilo "bento grid") con bloques de distinto tamaño para características, beneficios o cifras clave. | — | — |
| `imagehotspots` | **Imagen interactiva** | Imagen con puntos interactivos ("hotspots") que revelan información al hacer clic o foco. | — | — |
| `lightbox` | **Lightbox** | Amplía imágenes y tarjetas de la galería en una vista superpuesta, con cierre por clic o Escape. | — | — |
| `marquee` | **Marquesina animada** | Cinta con frases o marcas que se desplazan en bucle continuo (pausa al pasar el mouse). | — | — |
| `flipcards` | **Tarjetas giratorias** | Grilla de tarjetas que giran en 3D al pasar el mouse (o al tocarlas en móvil) y muestran más información en el dorso. | — | — |
| `video` | **Video institucional** | Sección con un video de YouTube que carga recién al hacer clic (modo sin cookies): la página no contacta a YouTube hasta que el visitante lo reproduce. | — | — |

### Contenido y secciones (21)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `beforeafter` | **Antes / Después** | Comparador de imágenes con deslizador arrastrable (accesible por teclado). | — | — |
| `metrics` | **Banda de estadísticas** | Franja destacada con cifras de confianza (clientes, años, satisfacción). | — | — |
| `skillbars` | **Barras de capacidades** | Sección con barras de progreso horizontales (habilidades/capacidades) que crecen hasta su porcentaje al entrar en pantalla, animadas con Anime.js. | — | — |
| `blog` | **Blog** | Listado de novedades y artículos. | — | — |
| `blogpages` | **Blog con páginas por artículo** | Cada novedad del blog gana su propia página con URL propia (mejor para SEO y para compartir); la sección de la Home enlaza a ellas y el sitemap las incluye solo. | `blog` | páginas |
| `features` | **Características destacadas** | Filas alternadas (imagen + texto en zigzag) para destacar las claves de tu producto o servicio. | — | — |
| `process` | **Cómo trabajamos** | Sección "Cómo trabajamos": pasos numerados del proceso, de la consulta a la entrega. | — | — |
| `counters` | **Contadores animados** | Cifras del negocio (años, clientes, proyectos) que suben de 0 a su valor al entrar en pantalla. | — | — |
| `tabs` | **Contenido en pestañas** | Sección con pestañas accesibles (roles ARIA y navegación por teclado). | — | — |
| `team` | **Equipo** | Sección "Nuestro equipo" con foto (avatar de iniciales), nombre, rol y mini bio. | — | — |
| `rss` | **Feed RSS del blog** | Genera public/feed.xml con los artículos del blog y lo anuncia en el <head> para lectores y agregadores RSS. | `blogpages` | — |
| `hours` | **Horarios de atención** | Tabla de horarios semanales con indicador "Abierto ahora / Cerrado" calculado en vivo en el navegador del visitante. | — | — |
| `readmore` | **Leer más** | Recorta textos largos a unas líneas con botón "Leer más/menos" y degradado al pie, animando la altura con Anime.js. | — | — |
| `map` | **Mapa de ubicación** | Dónde encontrarnos: mapa embebido de OpenStreetMap (gratis, sin API key) junto a dirección y horarios. | — | — |
| `timeline` | **Nuestra historia** | Línea de tiempo vertical con los hitos de la empresa (año, título y descripción). | — | — |
| `portfolio` | **Página de portfolio** | Página propia con los trabajos realizados, filtros por categoría y tarjetas listas para fotos reales (con carga diferida). | — | páginas |
| `servicespage` | **Página de servicios** | Página propia con el detalle de cada servicio (descripción ampliada y puntos clave, con anclas por servicio). | `services` | páginas |
| `faq` | **Preguntas frecuentes** | Acordeón de preguntas y respuestas con despliegue animado (estilo elegible) y datos estructurados FAQPage (SEO) en el head de la Home. | — | — |
| `quiz` | **Quiz recomendador** | Quiz interactivo que guía al visitante con preguntas y le recomienda la mejor opción (plan/servicio/producto) con un CTA. | — | — |
| `services` | **Servicios** | Sección "Nuestros servicios": grilla de tarjetas con icono, título y descripción. | — | — |
| `datatable` | **Tablas con orden y búsqueda** | Todas las tablas del sitio pasan a ordenarse por columna (clic en el encabezado, con soporte de teclado) y las de más de 5 filas suman un buscador. | — | — |

### Comercio y precios (8)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `goalmeter` | **Barra de meta / objetivo** | Progreso hacia una meta (recaudación, donaciones, cupos, objetivo del mes) con barra que se llena y número que cuenta al entrar en pantalla. | — | — |
| `estimator` | **Calculadora de presupuesto** | Estimador de precio interactivo: el visitante elige servicio, cantidad y extras y ve el presupuesto actualizarse en vivo (número animado con Anime.js). | — | — |
| `catalogo` | **Catálogo filtrable** | Grilla de productos/servicios con filtro por categoría y buscador en vivo. | — | — |
| `productcompare` | **Comparador de productos** | Comparador lado a lado: el visitante elige hasta 3 productos y ve sus atributos enfrentados con las diferencias resaltadas. | — | — |
| `payments` | **Medios de pago** | Banda "Aceptamos estos medios de pago" con íconos SVG de tarjetas, transferencia, efectivo y billetera virtual. | — | — |
| `pricing` | **Precios** | Tabla de planes y precios con interruptor mensual/anual animado: pulgar deslizante en el switch (CSS transition) y count-up del importe con Anime.js, más pop de la insignia "2 meses gratis". | — | — |
| `currency` | **Selector de moneda** | Convierte en vivo los precios marcados (class="js-precio" data-ars) a distintas monedas con tasas fijas editables. | — | — |
| `comparison` | **Tabla comparativa** | Matriz de características por plan (✓/✕/valores) para comparar opciones de un vistazo. | — | — |

### Prueba social y confianza (10)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `socialproof` | **Avisos de actividad reciente** | Cartelitos flotantes que muestran actividad reciente ("Alguien de Córdoba reservó hace 3 min"). | — | — |
| `ratingbanner` | **Banner de valoración** | Banda con la nota promedio, estrellas y cantidad de reseñas. | — | — |
| `socialfeed` | **Feed social** | Grilla estilo Instagram con overlay de "me gusta" al pasar el mouse y botón para seguir el perfil. | — | — |
| `trust` | **Garantías de confianza** | Barra de garantías (envío gratis, pago seguro, cambios y devoluciones, atención personalizada) con iconos. | — | — |
| `logos` | **Logos de clientes** | Franja "Confían en nosotros" con las marcas que trabajaron con vos. | — | — |
| `reviewswall` | **Muro de reseñas** | Muro tipo mosaico (masonry) con muchas reseñas de clientes: estrellas, autor y origen. | — | — |
| `press` | **Prensa y certificaciones** | Franja "Como se vio en" con medios que te mencionaron más sellos de certificación/confianza. | — | — |
| `social` | **Redes sociales** | Íconos de redes sociales (Instagram, Facebook, X, YouTube, LinkedIn) en el footer de todas las páginas; se muestran solo las redes con URL cargada. | — | — |
| `testimonials` | **Testimonios** | Opiniones de clientes en tarjetas. Si el módulo de reseñas está activo, muestra las mejores reseñas reales en lugar de los ejemplos. | — | — |
| `testimonialslider` | **Testimonios en carrusel** | Carrusel de testimonios que rota automáticamente, con flechas y puntos. | — | — |

### Captación y formularios (10)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `newsletterinline` | **Banda de newsletter** | Sección destacada a todo el ancho para captar suscriptores por email. | — | — |
| `whatsapp` | **Botón de WhatsApp** | Botón flotante de WhatsApp en todas las páginas, con mensaje prellenado. | — | — |
| `contact` | **Contacto** | Página de contacto con formulario, API y persistencia de mensajes. | — | páginas, API, datos |
| `whatsappform` | **Formulario a WhatsApp** | Formulario de contacto que, al enviar, abre WhatsApp con el mensaje ya armado (nombre, contacto y consulta) hacia el número del negocio. | — | — |
| `multistep` | **Formulario multi-paso** | Formulario tipo wizard en varios pasos con barra de progreso, validación por paso y resumen final; al confirmar arma un mailto con los datos. | — | — |
| `waitlist` | **Lista de espera** | Sección de lista de espera / "próximamente" para captar emails de un lanzamiento, con contador de anotados animado (Anime.js) como prueba social. | — | — |
| `quote` | **Pedido de presupuesto** | Página con formulario multipaso (wizard de 3 pasos con validación por paso), API y persistencia de pedidos de presupuesto. | — | páginas, API, datos |
| `events` | **Próximos eventos** | Agenda de próximos eventos con tarjetas (fecha, hora, lugar y botón). | — | — |
| `resources` | **Recursos descargables** | Sección de recursos y descargas (guías, catálogos, fichas técnicas) con tarjetas y botón de descarga. | — | — |
| `jobs` | **Trabajá con nosotros** | Página de empleo con búsquedas abiertas y formulario de postulación, con API y persistencia de postulaciones. | — | páginas, API, datos |

### Conversión y avisos (8)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `cookies` | **Banner de cookies** | Aviso de cookies con aceptar/solo esenciales, recordado en el navegador y animado al entrar (Anime.js). | — | — |
| `share` | **Botones de compartir** | Sección para compartir la página: WhatsApp, X, Facebook, copiar link y compartir nativo del celular. | — | — |
| `countdown` | **Cuenta regresiva** | Contador regresivo a un evento o lanzamiento (días, horas, minutos, segundos). | — | — |
| `appbadges` | **Descarga de app** | Sección con botones de App Store y Google Play para descargar tu app móvil. | — | — |
| `cta` | **Llamado a la acción** | Banda destacada con título y botón antes del footer, para empujar el contacto o la conversión. | — | — |
| `promo` | **Popup de promoción** | Ventana emergente de promoción que aparece tras unos segundos (o al scrollear media página), se cierra con Escape o clic afuera y respeta una frecuencia máxima por visitante. | — | — |
| `exitpopup` | **Popup de salida** | Ventana emergente de intención de salida (exit intent) para captar un email u ofrecer un descuento antes de que el visitante se vaya. | — | — |
| `agegate` | **Verificación de edad** | Diálogo bloqueante al entrar que pide confirmar la mayoría de edad (rubros regulados). | — | — |

### Utilidades y SEO (12)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `a11y` | **Accesibilidad** | Enlace "Saltar al contenido" y botón flotante con opciones de accesibilidad: tamaño del texto, alto contraste y subrayado de enlaces. | — | — |
| `reveal` | **Animaciones (Motion)** | Entrada del hero en cascada, aparición de secciones y tarjetas al hacer scroll, y microinteracciones, con la librería Motion. | — | — |
| `pwa` | **App instalable (PWA)** | Manifest, ícono y service worker: el sitio se puede instalar como app en el celular o la PC, y las páginas ya visitadas siguen funcionando sin conexión. | — | — |
| `favicon` | **Favicon de marca** | Favicon SVG generado con la inicial de la marca sobre el color de acento. | — | — |
| `tooltip` | **Globos de ayuda (tooltips)** | Tooltips accesibles: cualquier elemento con data-tooltip="texto" muestra un globo al pasar el mouse, al enfocar con teclado o al tocar. | — | — |
| `darkmode` | **Modo oscuro** | Botón claro/oscuro en la navbar con icono Phosphor animado (sol/luna): recuerda la preferencia y respeta el modo del sistema. | — | — |
| `i18n` | **Multiidioma (ES/EN)** | Selector de idioma en la navbar: traduce los textos fijos del sitio al inglés con un diccionario editable y recuerda la elección. | — | — |
| `page404` | **Página 404** | Página "no encontrada" con el diseño del sitio y fallback en Express: cualquier ruta inexistente la muestra con status 404 (la API sigue respondiendo JSON). | — | páginas, API |
| `legal` | **Páginas legales** | Páginas de Términos y Condiciones y Política de Privacidad con texto modelo editable, enlazadas desde el footer de todas las páginas. | — | páginas |
| `branchselector` | **Selector de sucursal** | Selector de sucursal/ciudad: el visitante elige una sede y ve su dirección, horario, teléfono y un botón "Cómo llegar" (Google Maps sin API key). | — | — |
| `seo` | **SEO básico** | Meta descripción, Open Graph, theme-color, datos estructurados (JSON-LD), robots.txt y sitemap.xml con las páginas públicas del sitio. | — | — |
| `modal` | **Ventanas modales** | Ventanas modales reutilizables y accesibles (foco atrapado, cierre con Esc/afuera), animadas con Anime.js. | — | — |

## Módulos funcionales (128)

Agregan backend real: rutas de API, validación en el servidor, persistencia y —casi siempre— un panel de administración. Muchos existen para volver editable una sección de interfaz: el par típico es `faq` (la sección) + `faqadmin` (el panel que la administra).

### Cuentas y usuarios (7)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `auth` | **Autenticación** | Login y registro en páginas separadas (/auth.html y /registro.html), sesiones con JWT (HMAC nativo) y passwords con scrypt. | — | páginas, API, datos |
| `membership` | **Club de socios** | Membresías con planes: el visitante se asocia eligiendo un plan y recibe un número de socio único; consulta el estado (pendiente/activo/suspendido/baja) por número. | — | páginas, API, datos |
| `users-admin` | **Gestión de usuarios** | Panel para administrar usuarios: cambio de rol (user, repositor, admin) y activación/desactivación con bloqueo de login. | `auth` | páginas, API |
| `perfil` | **Mi perfil** | Página /perfil.html para que cada usuario registrado gestione su cuenta: corregir su nombre y teléfono, cambiar su email (validado y sin pisar el de otro), cambiar la contraseña exigiendo la actual y darse de baja confirmando con su clave. | `auth` | páginas, API |
| `clientportal` | **Portal del cliente** | Portal "Mis gestiones" con backend: el usuario logueado ve en /portal.html todo lo suyo en un solo lugar — pedidos, turnos, devoluciones, garantías, reclamos, presupuestos, cursos con avance, tarjeta de fidelidad y comprobantes —… | `auth` | páginas, API |
| `recuperar` | **Recuperar contraseña** | Flujo completo de "olvidé mi contraseña": /recuperar.html pide el email y el servidor manda por email un link con token de un solo uso (32 bytes, vence a los 60 minutos) a /nueva-clave.html. | `auth` `mailer` | páginas, API, datos |
| `roles` | **Roles y permisos** | Permisos por área con backend real: un middleware global corta cada pedido a la API según el rol del usuario, distinguiendo consultar de modificar. | `auth` | páginas, API, middleware, datos |

### Tienda y productos (14)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `restock` | **Avisos de stock** | Sección "Avisame cuando vuelva": el visitante deja su email para que le avisen cuando un producto agotado vuelva a estar disponible, y ve cuánta gente lo espera (Anime.js). | — | páginas, API, datos |
| `cart` | **Carrito + Checkout** | Catálogo de productos con API, carrito persistente en el navegador y checkout que genera órdenes validadas. | `auth` | páginas, API, datos |
| `comparativa` | **Comparador administrable** | Le da backend real al Comparador de productos: las opciones viven en la colección compareitems con atributos libres (el negocio decide qué filas tiene la tabla) en vez de los cuatro planes inventados que traía horneados el HTML, que es… | `productcompare` | páginas, API, datos |
| `etiquetas` | **Etiquetas y colecciones** | Agrupá productos en listas transversales ("Regalos", "Menos de $20.000", "Recién llegados") que un mismo producto puede integrar a la vez, a diferencia de la categoría y la marca que son únicas. | `products-admin` | páginas, API, middleware, datos |
| `favorites` | **Favoritos** | Lista de deseos por usuario: corazón en cada producto del catálogo y página propia con los guardados. | `cart` `auth` | páginas, API, datos |
| `products-admin` | **Gestión de productos** | Catálogo maestro de la tienda: nombre, slug propio, SKU, categoría, marca, precio (con precio anterior tachado), descripción corta y detalle largo, galería de imágenes (por URL o subidas de verdad si Biblioteca de archivos está activa),… | `auth` | páginas, API, datos |
| `listaprecios` | **Lista de precios** | Página pública /precios.html con la lista de precios agrupada por categoría, unidad opcional, buscador sin acentos que filtra en el servidor y leyenda "precios actualizados al…" real. | — | páginas, API, datos |
| `ficha` | **Página de producto** | Cada producto tiene su dirección propia en /producto/<slug> con el HTML armado POR EL SERVIDOR: galería de imágenes, precio (con el anterior tachado si hay oferta), disponibilidad real, descripción, detalle largo, selector de cantidad… | `products-admin` `cart` | páginas, middleware |
| `consultas` | **Preguntas sobre el producto** | El bloque "Preguntas y respuestas" de la ficha de producto: el visitante pregunta sin registrarse y el negocio contesta desde su panel, con la respuesta quedando PUBLICADA para todos los que entren después. | `products-admin` `ficha` | páginas, API, datos |
| `relacionados` | **Productos relacionados** | Recomendaciones calculadas sobre los PEDIDOS REALES: el servidor cuenta cuántas veces dos productos se compraron juntos y ordena por esa frecuencia ("quien compró esto también compró"). | `products-admin` `cart` | páginas, API, datos |
| `reviews` | **Reseñas con estrellas** | Calificaciones de 1 a 5 estrellas por producto, con promedio visible en el catálogo. | `cart` `auth` | API, datos |
| `giftcards` | **Tarjetas de regalo** | Emisión de gift cards con código único y saldo monetario: el cliente emite una tarjeta (monto + destinatario + mensaje), consulta el saldo por código y canjea contra él, con saldo animado (Anime.js). | — | páginas, API, datos |
| `tienda` | **Tienda con filtros y buscador** | La página de compra de verdad, en /tienda.html: buscador por texto, filtros por categoría, marca y rango de precio, "solo con stock", orden (destacados, precio, nombre, novedades) y paginación — todo RESUELTO EN EL SERVIDOR, así el… | `products-admin` `cart` | páginas |
| `variantes` | **Variantes de producto** | Talle, color, sabor o medida: un mismo producto con varias combinaciones, cada una con su SKU, su diferencia de precio y su stock propio. | `products-admin` `cart` `auth` | páginas, API, datos |

### Ventas, pedidos y cobros (18)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `caja` | **Caja diaria** | Panel solo-admin /caja-admin.html para llevar la caja del negocio: ingresos y egresos del día con concepto, importe y medio de pago (efectivo/transferencia/tarjeta/otro), totales y saldo calculados en el servidor con count-up animado,… | `auth` | páginas, API, datos |
| `abandonos` | **Carritos abandonados** | Cada carrito con productos deja una fila en el servidor (qué llevaba, cuánto valía, cuándo fue la última actividad) con el subtotal recalculado contra el catálogo real. | `cart` | páginas, API, datos |
| `invoices` | **Comprobantes y recibos** | Emisión de comprobantes/recibos con backend: el negocio los emite desde un ABM solo-admin (items con cantidad y precio, total calculado en el servidor, estados pendiente/pagado/anulado) y el cliente los consulta e imprime en… | — | páginas, API, datos |
| `shipping` | **Cotizador de envío** | Sección "¿Cuánto cuesta el envío?": el visitante elige su provincia y el servidor devuelve costo y plazo estimado según la zona (colección shippingzones), con envío gratis opcional por monto. | — | páginas, API, datos |
| `presupuestador` | **Cotizador online** | El "armá tu presupuesto online" con backend real: el negocio carga los conceptos desde el panel (por cantidad, por opción, por sí/no y ajustes porcentuales tipo "urgente +20%") y el visitante arma su cotización en /cotizador.html sin… | `auth` | páginas, API, datos |
| `ctacte` | **Cuenta corriente de clientes** | La cuenta corriente ("fiado") con backend real: cargos y pagos por cliente, con el saldo calculado siempre en el servidor a partir de los movimientos (nunca guardado, nunca desincronizado). | `auth` | páginas, API, datos |
| `coupons` | **Cupones de descuento** | Códigos de descuento con porcentaje, vencimiento y límite de usos. | `cart` | API, datos |
| `descuentos` | **Descuentos automáticos** | Reglas de descuento que se aplican solas sobre el carrito: por monto ("10% llevando más de $50.000") o por cantidad ("por cada 3 unidades, $1.500 menos"), con vigencia desde/hasta evaluada con la fecha del servidor, tope en pesos y la… | `cart` | páginas, API, datos |
| `returns` | **Devoluciones y cambios** | Solicitud de devolución/cambio (RMA): el cliente pide una devolución indicando comprobante, producto y motivo, recibe un código de seguimiento y consulta el estado (línea de progreso animada). | — | páginas, API, datos |
| `donations` | **Donaciones con meta** | Recaudación hacia una meta: el visitante registra un aporte (monto + datos + mensaje) y el backend suma el total recaudado y el % de la meta, con barra y total animados (Anime.js). | — | páginas, API, datos |
| `enviogratis` | **Envío gratis por umbral** | Barra de progreso "te faltan $X para el envío gratis" sobre el carrito, con el subtotal calculado en el servidor contra el catálogo real (el frontend no puede falsearlo). | `cart` | páginas, API, datos |
| `pedidos` | **Gestión de pedidos** | El panel donde el negocio ve y despacha los pedidos REALES del checkout: qué compraron, cuánto pagaron, qué descuentos se aplicaron, a dónde va (envío a domicilio con dirección completa o retiro en el local) y en qué estado está cada uno. | `auth` `cart` | páginas, API |
| `quotesadmin` | **Gestión de presupuestos** | Panel solo-admin /presupuestos.html para trabajar los pedidos de presupuesto capturados por el módulo "Pedido de presupuesto": estados (nuevo/cotizado/aceptado/rechazado), nota interna, filtro, CSV y resumen animado (Anime.js). | `quote` | páginas, API, datos |
| `pagoinformado` | **Informar pago por transferencia** | Página /informar-pago.html con los datos bancarios del negocio (titular, banco, alias, CBU — editables desde el panel sin regenerar) y formulario para que el cliente informe su transferencia (referencia, importe, comprobante por URL):… | — | páginas, API, datos |
| `pedidoscarta` | **Pedidos de la carta** | El visitante arma su pedido desde /carta.html (botón "Agregar" por plato + barra flotante), elige retiro o envío y confirma: el servidor valida los platos, recalcula el total con precios del backend y devuelve un código PC-XXXXXX… | `menu` | páginas, API, datos |
| `warranty` | **Registro de garantía** | Registro de garantía: el cliente registra un producto (serie + fecha de compra), el sistema calcula el fin de cobertura y permite consultar el estado (Vigente/Vencida/Reclamada) con una barra de tiempo animada (Anime.js). | — | páginas, API, datos |
| `ordertrack` | **Seguimiento de pedidos** | Página pública /seguimiento.html: el cliente ingresa el código de su pedido y ve su estado como línea de progreso animada (Anime.js). | — | páginas, API, datos |
| `simulador` | **Simulador de financiación** | Simulador de cuotas con backend: el visitante elige línea, monto y plazo y el servidor calcula la cuota estimada por sistema francés con la tasa vigente, registrando cada simulación para medir demanda. | — | páginas, API, datos |

### Reservas y turnos (7)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `agenda` | **Agenda de turnos con horarios** | Turnos con agenda fina: página pública /turnos.html donde el visitante elige servicio, profesional y fecha, ve la grilla de horarios libres/ocupados del día (cada servicio bloquea según su duración) y reserva un horario puntual; el… | — | páginas, API, datos |
| `alquileres` | **Alquileres por día** | Página /alquileres.html con los espacios/recursos publicados (cabañas, salones, canchas, equipos) servidos desde el backend: el visitante elige un rango de fechas y el servidor controla el solapamiento contra las reservas activas (409… | — | páginas, API, datos |
| `fila` | **Fila virtual** | Turnero de mostrador por orden de llegada: el visitante saca número en /fila.html y sigue en vivo cuántos hay delante y qué número se atiende (sondeo liviano, aviso "¡Es tu turno!"); puede cancelar su turno. | — | páginas, API, datos |
| `eventregister` | **Inscripción a eventos** | Sección para anotarse a eventos con cupo limitado: el visitante deja nombre y email, recibe un código de confirmación y ve los lugares disponibles en vivo (Anime.js). | — | páginas, API, datos |
| `reservamesa` | **Reserva de mesa** | Sección "Reservá tu mesa": el visitante elige fecha, turno y cantidad de personas y el servidor confirma solo si hay cupo en ese turno (rechaza cuando se completó), devolviendo un código. | — | páginas, API, datos |
| `bookings` | **Reservas** | Turnos/reservas con validación de fecha futura y consulta para administradores. | — | API, datos |
| `callback` | **Solicitar llamada** | Sección "Te llamamos": el visitante deja su teléfono y franja horaria y el negocio lo llama. | — | páginas, API, datos |

### Contenido administrable (30)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `banners` | **Banner rotativo** | El banner principal de la Home pasa a ser un dato administrable: el admin carga slides (título, bajada, botón con link, imagen por URL, orden y vigencia desde/hasta) en /banners-admin.html y la Home muestra solo los publicados y… | — | páginas, API, datos |
| `uploads` | **Biblioteca de archivos** | Subida real de archivos (imágenes, PDF, ZIP, audio, video, planillas; hasta 5 MB) con biblioteca solo-admin en /archivos-admin.html: subís por input o arrastrar y soltar y obtenés una URL del propio sitio para pegar en cualquier módulo… | `auth` | páginas, API, datos |
| `blogcms` | **Blog administrable** | Blog/novedades con backend: página pública /blog.html que lista artículos publicados (buscador + filtro por categoría) y los abre completos sumando visitas reales (Anime.js). | — | páginas, API, datos |
| `menu` | **Carta / menú** | Carta de restaurante con backend: página pública /carta.html con los platos publicados agrupados por categoría, precio, descripción, etiquetas de dieta y buscador que filtra en el servidor (Anime.js). | — | páginas, API, datos |
| `downloads` | **Centro de descargas** | Biblioteca de recursos descargables con backend: página pública /descargables.html que lista archivos por categoría (buscador) y cuenta cada descarga real vía servidor (Anime.js). | — | páginas, API, datos |
| `marca` | **Clientes, prensa y sellos administrables** | Las franjas "Confían en nosotros" (clientes), "Como se vio en" (medios) y los sellos de certificación se guardan en el backend (colección brandlogos) y se inyectan en vivo sobre el HTML ya renderizado: el negocio suma un cliente nuevo o… | `logos` | páginas, API, datos |
| `cursos` | **Cursos con progreso** | Cursos online con backend: página pública /cursos.html con los cursos publicados y sus lecciones; el alumno se inscribe con su email y marca lecciones completadas, con el avance guardado en el servidor y una barra de progreso animada… | — | páginas, API, datos |
| `negocio` | **Datos del negocio** | Ficha única del negocio (razón social, CUIT, dirección, teléfono, email, horario) editable desde /negocio-admin.html y servida por GET /api/negocio: se inyecta en vivo en el pie de todas las páginas y, si el módulo de comprobantes está… | — | páginas, API, datos |
| `listings` | **Directorio de avisos** | Directorio/clasificados con backend: página pública /avisos.html que lista avisos publicados (buscador + filtro por categoría) y los abre en detalle sumando visitas reales (Anime.js). | — | páginas, API, datos |
| `equipo` | **Equipo administrable** | Las personas de la sección "Nuestro equipo" se guardan en el backend (colección teamcards) y se inyectan en vivo sobre las tarjetas: el negocio da de alta, edita, reordena y oculta gente desde /equipo-admin.html y el sitio publicado lo… | `team` | páginas, API, datos |
| `eventos` | **Eventos administrables** | Le da backend real a la sección "Próximos eventos": los eventos viven en la colección eventitems y se inyectan en vivo sobre las tarjetas horneadas. | `events` | páginas, API, datos |
| `publicaciones` | **Feed social administrable** | Le da backend real a la sección "Seguinos en redes": las publicaciones viven en la colección socialposts (imagen, epígrafe y enlace al post real) y el usuario y la URL del perfil en socialcfg, así el sitio deja de publicar ocho… | `socialfeed` | páginas, API, datos |
| `albums` | **Galería administrable** | Galería de fotos con backend: página pública /galeria.html con las fotos publicadas agrupadas por álbum, filtro, visor (lightbox) y "me gusta" real por foto (Anime.js). | — | páginas, API, datos |
| `videos` | **Galería de videos** | Página /videos.html con los videos publicados servidos desde el backend (colección videos): se cargan por URL de YouTube/Vimeo (ID validado en el servidor, anti-XSS), se filtran por categoría y solo cargan el reproductor al dar play… | — | páginas, API, datos |
| `razones` | **Garantías y características administrables** | Los badges de la barra de garantías (envío, pago seguro, devoluciones, atención) y las filas de "Por qué elegirnos" se guardan en el backend (colecciones guarantees y highlights) y se inyectan en vivo sobre el HTML ya renderizado: el… | `trust` | páginas, API, datos |
| `historia` | **Historia y proceso administrables** | Los hitos de la línea de tiempo "Nuestra historia" y los pasos de "Cómo trabajamos" se guardan en el backend (colecciones milestones y worksteps) y se inyectan en vivo sobre el HTML ya renderizado: el negocio suma un hito o cambia un… | `timeline` | páginas, API, datos |
| `horarios` | **Horarios y feriados administrables** | Los horarios de atención se guardan en el backend (colección openhours) y se inyectan en vivo sobre la tabla del sitio: el negocio los edita en /horarios-admin.html y el visitante los ve al instante, sin regenerar. | `hours` | páginas, API, datos |
| `espera` | **Lista de espera administrable** | Le da backend real a la sección "Lista de espera": cada alta se guarda en la colección waitlist, el contador de anotados es el número verdadero (no una constante horneada) y quien deja su email recibe su posición en la fila. | `waitlist` | páginas, API, datos |
| `navegacion` | **Menú de navegación administrable** | El menú del sitio se ordena, se renombra, se esconde y se amplía desde /menu-admin.html sin regenerar ni volver a deployar: "sacá Reseñas", "poné Turnos primero", "que Catálogo diga Tienda", "agregá un link a Instagram". | — | páginas, API, datos |
| `traducciones` | **Multiidioma administrable** | Idiomas y traducciones cargados desde el panel, no horneados en el sitio: se agregan los idiomas que haga falta (inglés, portugués, el que sea) y se traduce frase por frase sin volver a exportar el proyecto. | `auth` | páginas, API, datos |
| `paginas` | **Páginas administrables** | El negocio crea páginas nuevas del sitio (política de envíos, sucursales, una landing de campaña) sin regenerar ni volver a deployar: se editan en /paginas-admin.html con un editor de bloques tipados —título, párrafo, lista, imagen,… | — | páginas, API, middleware, datos |
| `planes` | **Planes y precios administrables** | Los planes de la sección de precios se guardan en el backend (colección plans) y se inyectan en vivo sobre las tarjetas: el negocio cambia importes, textos y el plan destacado desde /planes-admin.html y el sitio publicado lo refleja al… | `pricing` | páginas, API, datos |
| `projects` | **Portafolio administrable** | Portafolio de trabajos con backend: página pública /proyectos.html que lista los casos publicados (buscador + filtro por rubro) y los abre completos sumando visitas reales (Anime.js). | — | páginas, API, datos |
| `faqadmin` | **Preguntas frecuentes administrables** | Las preguntas del acordeón FAQ se guardan en el backend (colección faqs) y se inyectan en vivo sobre la sección: el negocio agrega, edita, reordena y oculta preguntas desde /faq-admin.html y el sitio publicado lo refleja al instante,… | `faq` | páginas, API, datos |
| `promos` | **Promociones con vigencia** | Sección "Promociones" en la Home servida desde el backend: solo se muestran las promos vigentes (el servidor filtra por fecha desde/hasta), con días restantes y botón "Me interesa" que registra interés real por promo. | — | páginas, API, datos |
| `recomendador` | **Quiz recomendador administrable** | Le da backend real al Quiz recomendador: el cuestionario vive en la colección quizconfig y se edita desde /recomendador-admin.html sin regenerar, y cada recorrido queda registrado en quizruns. | `quiz` | páginas, API, datos |
| `seoadmin` | **SEO administrable** | Título, descripción, imagen para compartir y canonical de cada página, editables desde el panel y aplicados por un middleware que reescribe el <head> del HTML antes de servirlo (no por JavaScript en el navegador: el buscador recibe el… | `auth` | páginas, API, middleware, datos |
| `servicios` | **Servicios administrables** | Los servicios de la sección "Nuestros servicios" y de la página de detalle se guardan en el backend (colección services) y se inyectan en vivo sobre el HTML ya renderizado: el negocio agrega, edita, reordena o da de baja un servicio… | `services` | páginas, API, datos |
| `textos` | **Textos editables** | Los textos principales del sitio (título y bajada del hero, botón principal, párrafo de "Nosotros") se guardan en el backend (colección sitetexts) y se inyectan en vivo al cargar cada página: el negocio los edita en /textos-admin.html… | — | páginas, API, datos |
| `cambio` | **Tipo de cambio administrable** | Las cotizaciones del selector de moneda se guardan en el backend (colección fxrates) y se le pasan al selector en vivo: el negocio actualiza el dólar desde /cambio-admin.html y el sitio publicado convierte con esa tasa al instante, sin… | `currency` | páginas, API, datos |

### Marketing y fidelización (16)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `feedback` | **¿Te resultó útil?** | Widget "¿Te resultó útil esta página?" al pie de cada página, con votos guardados en el servidor y porcentaje real de utilidad animado (Anime.js). | — | API, datos |
| `mailer` | **Avisos por email** | Bandeja de salida real (colección outbox): los módulos que capturan datos (postulaciones, pedidos de llamada, consultas a profesionales) registran un aviso por email al negocio. | — | páginas, API, datos |
| `campanas` | **Campañas de email** | Panel solo-admin /campanas-admin.html para escribir campañas (asunto + texto), probarlas con uno mismo y enviarlas a todos los suscriptores del newsletter: cada destinatario genera una fila real en la bandeja de salida (outbox) del… | `mailer` `newsletter` `auth` | páginas, API, datos |
| `leads` | **Captación de leads** | Endpoint central para captar emails desde los formularios del sitio (lista de espera, popup de salida u otros) con panel admin: origen de cada lead, filtro y descarga CSV. | `auth` | páginas, API, datos |
| `cumples` | **Club de cumpleaños** | Sección en la Home para que el visitante se anote al club de cumpleaños (nombre, email y fecha de nacimiento, alta idempotente por email) y reciba un beneficio en su día. | — | páginas, API, datos |
| `qr` | **Códigos QR** | Generador de códigos QR propio, armado en el servidor sin servicios de terceros (encoder completo: modo byte, versiones 1 a 10, los cuatro niveles de corrección y las 8 máscaras de la norma). | `auth` | páginas, API, datos |
| `leadmagnet` | **Descargable con registro** | Ofrece material descargable (guías, catálogos, plantillas) a cambio del email: el visitante deja su email, desbloquea el enlace y ve cuánta gente lo descargó (Anime.js). | — | páginas, API, datos |
| `nps` | **Encuesta NPS** | Encuesta "¿Nos recomendarías?" de 0 a 10 con comentario opcional. | — | páginas, API, datos |
| `polls` | **Encuestas y votaciones** | Encuesta en la Home con votos persistidos en el servidor y resultados en vivo para todos los visitantes, con barras animadas (Anime.js). | — | API, datos |
| `enlaces` | **Enlaces cortos** | Acortador de enlaces propio con estadísticas reales: el negocio crea /l/<nombre> y el servidor redirige (302) contando cada clic, con serie de los últimos 14 días y origen de las visitas (referente). | `auth` | páginas, API, datos |
| `newsletter` | **Newsletter** | Suscripción por email desde el footer, con validación y control de duplicados. | — | API, datos |
| `referrals` | **Programa de referidos** | Sección "Recomendá y ganá": el visitante obtiene un código y un link para compartir; cada persona que llega por ese link y se anota le suma un referido (conteo real, animado con Anime.js). | — | páginas, API, datos |
| `experimentos` | **Pruebas A/B de textos** | Probá dos o más versiones de un texto clave del sitio (titular del hero, bajada, botón, título de una sección) y descubrí cuál convierte mejor, con datos en vez de opiniones. | — | páginas, API, datos |
| `raffle` | **Sorteo** | Sorteo con participación por email (idempotente) y contador de participantes en vivo (Anime.js). | — | páginas, API, datos |
| `loyalty` | **Tarjeta de fidelidad** | Tarjeta de sellos digital: el visitante se suma con su email y ve su progreso hacia el premio (barra + sellos con Anime.js). | — | páginas, API, datos |
| `usertestimonials` | **Testimonios moderados** | Sección "Dejá tu testimonio": el visitante envía una recomendación que queda pendiente y solo se publica cuando un administrador la aprueba. | — | páginas, API, datos |

### Soporte y comunidad (10)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `ai-agent` | **Agente IA (datos internos)** | Asistente para administradores que responde preguntas consultando los datos reales del sistema mediante herramientas (function calling). | `auth` | páginas, API |
| `kb` | **Centro de ayuda** | Base de conocimiento con página pública /ayuda.html: buscador (filtra en el servidor), artículos por categoría en acordeón (Anime.js) y contador de visitas real. | — | páginas, API, datos |
| `livechat` | **Chat en vivo** | Chat en vivo con backend: burbuja flotante en todas las páginas donde el visitante conversa con el negocio (mensajes persistidos, bienvenida automática, novedades por polling liviano — sin websockets ni servicios pagos). | — | páginas, API, datos |
| `chatbot` | **Chatbot IA** | Widget de chat flotante en todas las páginas, con contexto real del negocio (productos, sucursales). | — | API |
| `comments` | **Comentarios** | Comentarios públicos con moderación básica: API REST, modelo y validaciones. | — | API, datos |
| `profesionales` | **Directorio de profesionales** | Directorio de profesionales con backend: página pública /profesionales.html con las fichas publicadas (especialidad, bio y foto), chips de filtro por especialidad, buscador que filtra en el servidor y un formulario de consulta por… | — | páginas, API, datos |
| `firma` | **Firma de documentos** | Documentos para firmar a distancia con backend real: el negocio redacta el texto y el sistema genera un enlace único con token. | — | páginas, API, datos |
| `formularios` | **Formularios a medida** | El negocio arma sus propios formularios desde el panel (título, descripción y campos: texto, párrafo, email, teléfono, número, fecha, selección con opciones y sí/no), los publica en /formularios.html?f=<slug> y recibe las respuestas en… | — | páginas, API, datos |
| `qanda` | **Preguntas del público** | Muro público de preguntas y respuestas moderadas: el visitante deja una pregunta, el equipo la responde y las publicadas se ven en un acordeón animado (Anime.js). | — | páginas, API, datos |
| `tickets` | **Soporte con seguimiento** | Mesa de soporte: el visitante abre un reclamo, recibe un código de seguimiento y consulta el estado (línea de progreso animada). | — | páginas, API, datos |

### Operación interna (17)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `inbox` | **Bandeja de entrada** | Panel admin con los mensajes de contacto, pedidos de presupuesto y postulaciones recibidos: estado nuevo/respondido y descarga CSV. | `auth` | páginas, API |
| `vacantes` | **Bolsa de trabajo** | Página /vacantes.html con las búsquedas laborales abiertas servidas desde el backend (colección jobopenings): filtro por área, detalle desplegable y postulación por vacante guardada en el servidor (dedupe por email, CV por URL). | — | páginas, API, datos |
| `notifcentro` | **Centro de novedades del admin** | Campanita en la navbar (solo admins) con el total en vivo de pendientes reales de todos los módulos activos (postulaciones nuevas, llamadas por hacer, testimonios por moderar, chat sin leer…) y página /novedades-admin.html que desglosa… | `auth` | páginas, API |
| `respaldo` | **Copia de seguridad** | Panel solo-admin /respaldo-admin.html para descargar una copia completa de los datos del sitio (todas las colecciones de los módulos activos) en un archivo JSON y restaurarla cuando haga falta, preservando ids y fechas. | `auth` | páginas, API, datos |
| `clientes` | **Ficha de clientes (CRM)** | La libreta de contactos del negocio con backend real: ficha por persona (nombre, email, teléfono, empresa, etiquetas), estado de seguimiento (nuevo / contactado / cliente / perdido) y bitácora de notas fechadas. | `auth` | páginas, API, datos |
| `jobsadmin` | **Gestión de postulaciones** | Panel solo-admin /postulaciones.html para trabajar las postulaciones capturadas por el módulo "Trabajá con nosotros": estados (nuevo/revisión/entrevista/contratado/descartado), nota interna, filtro por estado y por puesto, CSV y resumen… | `jobs` | páginas, API, datos |
| `repositores` | **Gestión de repositores** | Asignación de repositores (usuarios con ese rol) a sucursales. | `auth` `branches` `users-admin` | páginas, API, datos |
| `importar` | **Importar datos (CSV)** | Importación de planillas a cualquier colección del proyecto con backend real: el servidor lista las colecciones con sus campos, parsea el CSV (comillas, saltos de línea dentro de celda y separador ; o , detectado solo), muestra una… | `auth` | páginas, API |
| `inventory` | **Inventario + Movimientos** | Stock por producto y sucursal, derivado del historial de movimientos (entrada, salida, ajuste). | `auth` `branches` `products-admin` | páginas, API, datos |
| `tablero` | **Panel de control del negocio** | La pantalla que contesta "¿cómo venimos?" sin entrar a diez paneles: /tablero.html reúne los indicadores reales de los módulos activos (ventas del mostrador y online, ingresos y egresos de caja, cobranzas, compras, contactos captados,… | `auth` | páginas, API |
| `personal` | **Personal y asistencia** | El legajo del equipo y el reloj de fichaje con backend real: cada empleado ficha entrada y salida desde /fichar.html con su propia cuenta (el servidor decide qué corresponde mirando si tiene un turno abierto) y las horas trabajadas las… | `auth` | páginas, API, datos |
| `compras` | **Proveedores y compras** | Libreta de proveedores y órdenes de compra con backend real: renglones con cantidad y costo unitario, totales calculados en el servidor y circuito de estados validado (borrador → enviada → recibida, anulable). | `auth` | páginas, API, datos |
| `pos` | **Puntos de venta** | Cajas por sucursal y registro de ventas con total calculado en el servidor. | `auth` `branches` `products-admin` | páginas, API, datos |
| `branches` | **Sucursales** | Alta, edición y baja de sucursales con dirección y zona. | `auth` | páginas, API, datos |
| `trabajo` | **Tablero de tareas del equipo** | El tablero de trabajo del equipo con backend real: tareas con responsable, prioridad, vencimiento y bitácora de notas, organizadas en tres columnas (pendiente, en curso, hecha). | `auth` | páginas, API, datos |
| `tareas` | **Tareas programadas** | Disparador diario sin cron externo: un middleware detecta el primer pedido del día y ejecuta en segundo plano los trabajos automáticos de los módulos activos (saludo de cumpleaños por email, recordatorio de los turnos de mañana,… | — | páginas, API, middleware, datos |
| `vencimientos` | **Vencimientos y pagos** | Lo que el negocio TIENE QUE PAGAR, con backend real: alquiler, servicios, impuestos, seguros y cuotas con su fecha de vencimiento y su estado. | `auth` | páginas, API, datos |

### Seguridad y cumplimiento (6)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `privacidad` | **Centro de privacidad** | Consentimiento de cookies registrado en el servidor (con fecha y versión de la política: la prueba que el negocio necesita si alguien reclama) y revocable desde /privacidad.html, más solicitudes del titular —acceso, rectificación,… | — | páginas, API, datos |
| `escudo` | **Escudo anti-spam** | Protección real para todos los envíos públicos del sitio: un middleware de Express corta las ráfagas por IP con ventana deslizante (429 + Retry-After), rechaza los envíos con palabras de spam o exceso de enlaces (422) y bloquea IPs a… | — | páginas, API, middleware, datos |
| `webhooks` | **Integraciones (webhooks)** | Avisa a otros sistemas cuando pasa algo en el sitio: cada escritura exitosa contra /api dispara un POST JSON firmado con HMAC-SHA256 a los endpoints cargados (Discord, Slack, Zapier, Make o un sistema propio), con reintentos, registro… | `auth` | páginas, API, middleware, datos |
| `mantenimiento` | **Modo mantenimiento** | Interruptor real para poner el sitio en mantenimiento: un middleware de Express (montado antes de los estáticos) responde 503 con una pantalla propia — título, mensaje y fecha estimada editables — a todas las páginas públicas. | — | páginas, API, middleware, datos |
| `salud` | **Monitor de salud del sitio** | Mide cómo le fue a cada visita real: velocidad de carga con las Core Web Vitals de Google (LCP, CLS, INP) tomadas con PerformanceObserver, errores de JavaScript que rompen la página en el navegador del visitante, y enlaces rotos (404)… | `auth` | páginas, API, middleware, datos |
| `auditoria` | **Registro de auditoría** | Anota automáticamente quién hizo qué en la administración del sitio: un middleware observa todos los pedidos que escriben (POST/PUT/PATCH/DELETE) hechos con sesión iniciada y registra usuario, módulo afectado, acción, resultado real e… | `auth` | páginas, API, middleware, datos |

### Métricas y búsqueda (3)

| id | Módulo | Qué hace | Requiere | Aporta |
|---|---|---|---|---|
| `sitesearch` | **Buscador global del sitio** | Página /buscar.html que busca en el servidor sobre el contenido dinámico de los módulos activos (novedades, ayuda, carta, avisos, proyectos, cursos…), sin distinguir acentos ni mayúsculas. | — | páginas, API, datos |
| `stats` | **Estadísticas de visitas** | Contador de visitas por página (sin cookies ni servicios externos) con gráfico de barras en el panel de administración. | `auth` | API, datos |
| `visits` | **Registro de visitas** | Formulario de campo: cada repositor registra visitas a sus sucursales asignadas (estado, observaciones). | `repositores` | páginas, API, datos |
