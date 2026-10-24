# PROGRESO — WebForge Builder (tarea programada "mejora-constante")

> Bitácora entre corridas: qué se agregó, qué quedó pendiente y qué conviene encarar después.
> El detalle técnico de cada cambio está en [CAMBIOS.md](CAMBIOS.md).

## Estado del catálogo

- **229 módulos en disco: 101 UI · 128 funcionales** (43ª). El disco y esta bitácora
  coinciden: **no quedan módulos huérfanos**. La 42ª no sumó módulos (fue de núcleo); la 43ª
  sumó uno solo, `escena3d`.
- **Escena 3D al scroll (43ª)**: `escena3d` + cinco escenas intercambiables en
  `modules/ui/escena3d/` (casa, teléfono desarmado, anteojos, switch mecánico, caja de envío).
  CSS 3D puro sobre scroll nativo con `sticky`, sin librerías ni scroll-jacking; el estado es
  función pura del progreso. El contrato de escena está documentado en `casa.js`, que es la
  implementación de referencia: agregar un rubro es crear el archivo y sumarlo al catálogo.
- **`fields` con `type: 'select'` (43ª)**: campos de opciones cerradas
  (`options: [[valor, etiqueta], …]`), validados contra la lista en vez de por largo.
- **La sugerencia nº1 quedó saldada (42ª)**: existe el contrato `fields` y el bloque *Textos por
  sección* del Builder. **39 secciones con 162 campos editables** —títulos, bajadas, listas
  completas (servicios, planes, preguntas, testimonios, filas comparativas, pasos, puestos),
  textos de botón, placeholders y mensajes de éxito—. Se lee con `txt()`/`txtList()` de
  `templates.js`; el valor resuelto vive en `cfg.moduleTexts[id][key]`.
- **Sistema de movimiento elegible (42ª)**: `src/motion.js` con **8 ejes × 47 variantes**
  (tarjetas, aparición al scroll, botones, enlaces, títulos, imágenes, campos, cambio de
  página). El default de cada eje reproduce el comportamiento histórico y el catálogo se
  publica en `/api/efectos`, así que el panel se arma solo.
- **Categorías con fuente única (42ª)**: `src/categorias.js`. Antes vivían duplicadas en
  `public/app.js` y dejaban **86 módulos funcionales en "Otros"**; ahora ninguno queda sin
  categoría y el generador del manual usa el mismo mapa.
- **Documentación de usuario (42ª)**: `MANUAL.md` (22 secciones) y `MODULOS.md` (referencia de
  los 228 módulos, **generada** con `node tools/catalogo.js` — regenerala al sumar un módulo).
- **Ya no queda ningún módulo UI "frontend puro" que publique datos inventados (41ª)**: los cinco
  que quedaban —contador de anotados, agenda de eventos, quiz, feed social y comparador— tienen
  backend real (`espera`, `eventos`, `recomendador`, `publicaciones`, `comparativa`). Era la
  continuación directa del trabajo de la 36ª/37ª sobre las secciones horneadas, pero con un
  agravante: los datos falsos de estas cinco eran **números** (prueba social, "me gusta" y una
  tabla de precios comparados), que es exactamente lo que un visitante usa para decidir.
- **La ficha de producto quedó completa (40ª)**: `variantes` (talle/color con stock, SKU y
  sobreprecio por combinación, y el stock del producto pasando a ser la **suma** de sus variantes),
  `consultas` (preguntas moderadas al pie de la ficha), `relacionados` ("quien compró esto también
  compró" calculado sobre los pedidos reales) y `etiquetas` (colecciones transversales con página
  propia en `/etiqueta/<slug>` armada por el servidor). **Ya no queda nada grande del circuito de
  compra sin cubrir.**
- **E-commerce completo (39ª)**: productos con galería de imágenes (subida real), stock validado y
  descontado por el checkout, página por producto en `/producto/<slug>` con JSON-LD, tienda con
  búsqueda y filtros resueltos en el servidor, checkout con datos de entrega y costo de envío por
  zona, y panel de pedidos cuya cancelación repone el stock. Las **variantes** que esta línea
  anotaba como pendiente las cerró la 40ª.
- **El sitio ya no se hornea entero (38ª)**: `paginas` publica páginas nuevas en `/p/<slug>` con el
  HTML **armado por el servidor** (middleware sobre una cáscara generada), y `navegacion` administra
  el menú **moviendo** los enlaces existentes en vez de reconstruirlos. Crear una página o cambiar
  el menú dejó de requerir regenerar y volver a deployar.
- **Contrato `vercelRewrites` (38ª)**: un módulo puede declarar rutas propias fuera de `/api` que
  responde un middleware, y el generador las suma a `vercel.json`. Sin esto, un middleware que sirve
  rutas propias funciona en local y da **404 en producción**: en Vercel, lo que no matchea un rewrite
  lo sirve la CDN de estáticos y nunca llega a Express.
- **Motor de animación**: además de **Motion** (vendorizado, atado al módulo `reveal`), ahora el
  generador también vendoriza **Anime.js v4** (`public/vendor/anime.js`, servido como `/js/anime.js`).
  Se activa por módulo con el flag `usesAnime` (análogo a `cfg.motion` pero no atado a `reveal`):
  cualquier módulo que la declare hace que el generador emita el asset y el `<script>`. Ambas
  librerías son assets estáticos, no dependencias npm del proyecto exportado.
- **Middlewares de módulo (31ª)**: además de `mounts` (rutas de API), un módulo puede declarar
  `middlewares: [{file}]` y el generador los monta **antes de `express.static`**, con lo que
  interceptan también las páginas HTML. Lo estrenó `mantenimiento` y la **32ª** lo consolidó con
  tres módulos más: `escudo` (rate limiting / anti-spam, el candidato que la 31ª anotaba como
  siguiente), `tareas` (disparador diario) y `auditoria` (registro de acciones). La **33ª** sumó dos
  más: `seoadmin` (que además de redirigir **reescribe el `<head>` del HTML antes de servirlo**) y
  `salud` (que no responde nada: se engancha al final de la respuesta para contar los 404 reales).
  La **34ª** sumó el séptimo: `permisos` (del módulo `roles`), que es el primero que **corta**
  pedidos según quién los hace. Los **siete** conviven sin pisarse en el proyecto con el catálogo
  completo.
- **100 módulos UI**: incluye el lote de la 17ª (paleta de comandos ⌘K, comparador de productos,
  barra de meta/objetivo, quiz recomendador, lista de espera), el lote de la 16ª (selector de moneda, galería mosaico/masonry,
  muro de reseñas, verificación de edad, feed social), el lote de la 15ª (menú desplegable/mega menú, formulario multi-paso,
  catálogo filtrable, popup de salida, mega footer), el lote de la 14ª (carga diferida de imágenes, ventanas modales,
  leer más, globos de ayuda/tooltips, formulario a WhatsApp), el lote de la 13ª (barras de
  capacidades, tarjetas giratorias, banda
  parallax, navegación por puntos, indicador de scroll), el lote de la 12ª (pantalla de carga,
  titular con palabras rotativas,
  selector de sucursal, navbar inteligente al scroll, fondo animado del hero), el lote de la 11ª
  (medios de pago, próximos eventos, recursos
  descargables, calculadora de presupuesto) + la mejora de `faq` (JSON-LD FAQPage), el lote de la
  10ª (CTA fijo en móvil, prensa/certificaciones,
  banner de valoración, descarga de app, avisos de actividad reciente adoptado) y el resto:
  hero, servicios, página de servicios, galería, filtros de galería,
  portfolio, testimonios (con reseñas reales si reviews está activo), testimonios en carrusel,
  faq, precios, tabla comparativa, blog
  (con páginas por artículo), feed RSS, buscador,
  contacto, barra de contacto flotante, modo oscuro, cookies, compartir, WhatsApp, volver
  arriba, animaciones al scroll,
  menú hamburguesa, carrusel, lightbox, SEO básico (con sitemap.xml), mapa de ubicación,
  equipo, barra de anuncios, marquesina animada, miga de pan, favicon de marca, página 404,
  tablas con orden y búsqueda, contadores animados, banda de estadísticas, características
  destacadas, logos de clientes, llamado a la acción, horarios de atención,
  video institucional, redes sociales, nuestra historia, cómo trabajamos, pedido de
  presupuesto, multiidioma ES/EN, trabajá con nosotros, páginas legales, popup de promoción,
  app instalable (PWA), accesibilidad, garantías de confianza, contenido en pestañas,
  progreso de lectura, antes/después, cuenta regresiva, medios de pago, próximos eventos,
  recursos descargables, calculadora de presupuesto, pantalla de carga, titular con palabras
  rotativas, selector de sucursal, navbar inteligente al scroll, fondo animado del hero,
  barras de capacidades, tarjetas giratorias, banda parallax, navegación por puntos,
  indicador de scroll, carga diferida de imágenes, ventanas modales, leer más, globos de
  ayuda (tooltips), formulario a WhatsApp, menú desplegable (mega menú), formulario
  multi-paso, catálogo filtrable, popup de salida (exit intent), mega footer.
- **Backend para las secciones que sólo eran HTML (36ª)**: cinco módulos funcionales nuevos le dan
  **datos administrables** a cinco secciones que hasta ahora venían horneadas en el generador —
  `planes` (precios), `faqadmin` (preguntas frecuentes), `horarios` (horarios + feriados), `cambio`
  (cotizaciones) y `equipo` (nuestro equipo). Todos siguen el patrón de `textos`/`negocio`:
  colección propia, `GET` público e **inyección en vivo sobre el HTML ya renderizado**, así cambiar
  un precio o agregar una pregunta **no requiere regenerar ni volver a deployar**. Para que la
  inyección no rompa las animaciones de los módulos UI que reemplaza, cuatro de ellos exponen ahora
  un punto de entrada: `window.WFPrecios.refrescar()`, `window.WFFaq.rebind()`,
  `window.WFMoneda.setMonedas()` y `window.WFHorarios.actualizar()`.
- **Secciones horneadas: se terminó el trabajo (37ª)**. La 36ª le puso backend a cinco secciones;
  la 37ª cubrió las siete que quedaban con cuatro módulos más —`servicios` (sección + página de
  detalle), `marca` (clientes, prensa y sellos), `historia` (línea de tiempo + "Cómo trabajamos") y
  `razones` (garantías + "Por qué elegirnos")—. **Ya no queda ninguna sección del sitio comercial
  cuyo contenido obligue a regenerar y volver a deployar.** Cuatro de ellas no sólo eran incómodas:
  `logos` y `press` publicaban clientes y medios **inventados**, y `trust` prometía condiciones
  comerciales ("envío gratis desde $50.000", "30 días para cambiar de idea") que un cliente puede
  reclamar. Para inyectar sobre ellas hicieron falta tres ganchos nuevos en el HTML horneado
  (`#servicios-detalle`, `#historia-linea`, `#garantias-grid`) y que `services.js` guardara el
  **nombre** del ícono además del SVG.
- **Medición (37ª)**: `experimentos` agrega la capa que faltaba — **pruebas A/B de textos** con
  reparto estable por hash en el servidor, impresiones que sólo cuentan si el elemento medido
  estaba en la página, conversiones idempotentes por visitante y veredicto por prueba z de dos
  proporciones al 95%. El catálogo sabía construir el sitio y administrarlo; ahora sabe medirlo.
- **123 módulos funcionales**: el lote de la 40ª (variantes de producto, preguntas sobre el
  producto, productos relacionados, etiquetas y colecciones) más el lote de la 39ª (página de producto, tienda con filtros, gestión de pedidos) más el lote de la 38ª (páginas administrables, menú de navegación administrable, descuentos automáticos, carritos abandonados) más los dos **adoptados** de la sesión cortada (integraciones por webhook, envío gratis por umbral), el lote de la 37ª (servicios administrables, pruebas A/B de textos,
  clientes/prensa/sellos administrables, historia y proceso administrables, garantías y
  características administrables), el lote de la 36ª (planes y precios administrables, preguntas
  frecuentes administrables, horarios y feriados administrables, tipo de cambio administrable,
  equipo administrable), el lote de la 35ª (personal y asistencia, tablero de tareas del
  equipo, panel de control del negocio, vencimientos y pagos, cotizador online — los cinco
  **adoptados**: los escribió una sesión cortada y la 35ª los revisó, probó y documentó),
  el lote de la 34ª (roles y permisos por área, firma de documentos,
  proveedores y órdenes de compra, cuenta corriente de clientes e importación de datos por CSV),
  el lote de la 33ª (SEO administrable con redirecciones 301, centro de
  privacidad, monitor de salud del sitio, multiidioma administrable y códigos QR con encoder propio),
  el lote de la 32ª (escudo anti-spam, tareas programadas, registro de
  auditoría, enlaces cortos, mi perfil), el lote de la 31ª (banner rotativo administrable, formularios a
  medida, ficha de clientes/CRM, recuperar contraseña, modo mantenimiento), el lote de la 30ª
  (alquileres por día, informar pago por
  transferencia, campañas de email, caja diaria, club de cumpleaños), el lote de la 29ª (avisos por email con bandeja de salida, copia de
  seguridad, centro de novedades del admin, galería de videos), el lote de la 28ª (pedidos desde
  la carta, lista de precios con aumento masivo, textos editables en vivo, fila virtual),
  el lote de la 27ª (buscador global del sitio con registro de
  búsquedas, bolsa de trabajo administrable, promociones con vigencia, datos del negocio),
  el lote de la 26ª (biblioteca de archivos con subida real, chat en
  vivo con bandeja admin, portal del cliente "Mis gestiones", comprobantes y recibos imprimibles),
  el lote de la 25ª (agenda de turnos con slots horarios por
  profesional, cursos con lecciones y progreso por alumno, directorio de profesionales con ficha y
  consulta, simulador de financiación con tasas administrables), el lote de la 24ª (portafolio administrable, galería administrable con
  "me gusta", centro de descargas con contador real y reserva de mesa con control de cupo), el lote
  de la 23ª (blog administrable, cotizador de envío por zona,
  directorio de avisos/clasificados y carta de restaurante), auth (login y registro en páginas
  separadas desde la 18ª),
  carrito, cupones, reseñas, favoritos, comentarios,
  newsletter, reservas, estadísticas, usuarios, sucursales, productos, inventario,
  repositores, visitas, POS, chatbot IA, agente IA, bandeja de entrada, el lote de la 18ª
  (encuestas y votaciones, soporte con seguimiento, "¿te resultó útil?", captación de leads),
  el lote de la 19ª (inscripción a eventos con cupos, programa de referidos, preguntas del
  público con moderación, avisos de stock "avisame cuando vuelva"), el lote de la 20ª
  (solicitar llamada "te llamamos", tarjeta de fidelidad de sellos, sorteo y seguimiento de
  pedidos), el lote de la 21ª (encuesta NPS, descargable con registro (lead magnet),
  devoluciones/cambios (RMA) y registro de garantía) y el lote de la 22ª: testimonios moderados,
  centro de ayuda (base de conocimiento), gestión de presupuestos y gestión de postulaciones.
  (El header no enumera donaciones, gift cards y membresías, que ya estaban registrados.)
- **Diseño configurable (18ª)**: el Builder tiene un selector de **efecto de hover de tarjetas**
  (`design.cardHover`: levantar / borde brillante / fondo aurora / zoom / ninguno, default el
  histórico "levantar"). Las cards que son o contienen formularios/campos quedan **excluidas por
  selector** (`:not(:has(form, input, select, textarea))`) y en su lugar los campos tienen anillo de
  foco animado y los checks `accent-color` + pop. Las microinteracciones ya no dependen del módulo
  `reveal`: se emiten siempre bajo `prefers-reduced-motion: no-preference`.

## Modernización de UI con la Design Library (2026-07-20, pedido del usuario)

Pasada de diseño sobre **el Builder y los 175 módulos de las páginas generadas** usando la skill
**Design Library**, con la consigna de aplicar criterio (mejorar donde suma, dejar donde ya está
bien), **Phosphor icons**, **Montserrat por default** y **cero emojis**. El detalle técnico está en
[CAMBIOS.md](CAMBIOS.md).

| Cambio | Nota |
|---|---|
| **0 emojis** | 64 emojis renderizados → **0**, en 30 módulos. Cada glifo pictográfico pasó a ícono Phosphor horneado conservando comportamiento, tamaño y accesibilidad. Las flechas `→ ←` de los **comentarios de código** se conservan (son notación, no emojis) |
| **+16 iconos Phosphor** | `src/icons.js` pasó de 36 a **52 iconos** (moon, sun, device-mobile, lock, chart-line-up, thumbs-up/down, confetti, plus, paper-plane-tilt, heart, heart-fill, download-simple, stack, circle-half, wheelchair), extraídos de `@phosphor-icons/core` |
| **Montserrat por default** | `DEFAULTS.brand.font`: `sistema` → `montserrat`. Los sitios generados salen con Montserrat (las stacks del sistema siguen elegibles como opt-out en el Builder) |
| **Base de las generadas** | Subrayado animado en los links de nav (**Skiper UI `skiper40`**, `scaleX` con flip de origen), `:focus-visible` accesible en links/botones, `.btn` como `inline-flex` con gap (ícono+texto alineados), ghost que se rellena en hover, scroll suave. Todo bajo `prefers-reduced-motion` |
| **Navbar con iconos** | `layout()` acepta `html: true` (label = markup confiable del módulo, no se escapa) e `icon: true` (clase `nav-icon`, sin subrayado). Reutilizable por cualquier módulo |
| **`darkmode` modernizado** | El `🌙`/`☀️` pasó a **toggle sol/luna Phosphor animado** con rotación + escala (Anime.js `outBack`, adaptación de `skiper26`), red de seguridad para pestaña oculta y `usesAnime` |
| **Iconos de feature** | `features`, `flipcards`, `bento` y `appbadges` guardaban emojis como dato; ahora guardan **nombres de ícono** y renderizan `phIcon(...)`. Es el upgrade visual de mayor impacto |

**El Builder no se tocó**: ya estaba en Montserrat, con Phosphor y sin emojis, y su
[DESIGN.md](DESIGN.md) ("La Mesa de Trazado") rechaza explícitamente los componentes decorativos del
catálogo. Preservarlo era la decisión correcta.

**Qué se dejó como estaba (criterio)**: `carousel`, `reveal`, `gallery` y el **spring firma**
`cubic-bezier(0.34, 1.56, 0.64, 1)`. Portar coverflow/card-stack de React+Swiper+GSAP sobre
implementaciones vanilla que ya funcionan bien era churn riesgoso, no modernización.

**Verificación**: proyecto generado con **los 175 módulos** → 217 archivos, 105 JS, **0 errores de
sintaxis, 0 emojis en el output renderizado**. **Smoke test en navegador**: cero errores de consola,
Montserrat aplicada y cargada, 0 emojis en pantalla, 36 iconos Phosphor, ningún ícono colapsado ni
desbordado, toggle de tema funcionando por UI con su red de seguridad.

### Pendiente / sugerencias

- **Componentes de la Design Library sin usar**: el catálogo tiene hover-expand, coverflow,
  card-stack en scroll, parallax multicapa y progreso circular. Hoy no encajan sin reescribir
  módulos que ya funcionan; el candidato más natural para una corrida propia es un **módulo NUEVO**
  de galería tipo hover-expand (`skiper52/53`) que conviva con `gallery` en vez de reemplazarla.
- **Montserrat vía Google Fonts**: el default rompe parcialmente la promesa de "100% offline" de los
  sitios generados. Auto-hospedar el woff2 en `public/fonts/` (y servirlo desde el propio sitio)
  cerraría el círculo sin perder la tipografía.
- **Iconos en más módulos**: varios paneles admin siguen usando texto donde un ícono ayudaría
  (acciones de tabla: editar/borrar/publicar). Es mecánico y ya está todo el sistema listo.
- **`phStars`**: `loyalty` usa `star-fill` suelto para los sellos; podría unificarse con el helper.
- **Hook de impeccable**: compara el CSS de las **generadas** contra el DESIGN.md del **Builder**
  (dos sistemas distintos), así que reporta falsos positivos constantes de color/tamaño/radio.
  Convendría darle un sidecar propio a las generadas o excluirlas del hook.

## Corrida 2026-07-22 (43ª) — escena 3D al scroll, una por rubro

Un módulo nuevo (`escena3d`) con cinco escenas. El detalle está en [CAMBIOS.md](CAMBIOS.md).

**Las tres lecciones que conviene no volver a aprender:**

1. **rAF no alcanza como único disparador.** En un panel/pestaña no visible el navegador puede
   no despachar **ni `scroll` ni `requestAnimationFrame`** — sólo timers. Un guard del tipo
   `if (pedido) return; pedido = true; requestAnimationFrame(...)` queda trabado para siempre y
   la animación se congela en el frame 0. Toda tarea encolada por rAF necesita su red de
   seguridad con `setTimeout`, más un sondeo de respaldo si el estado tiene que seguir al
   scroll. Es la misma lección que ya estaba anotada para Anime.js, en otra forma.
2. **`position:absolute` heredado no existe.** La convención "toda pieza va absolute con
   left/top 50%" alcanza sólo a los **hijos directos** de quien la declara. Un detalle 2D
   dentro de un plano 3D (una puerta en una pared) es nieto y queda en flujo normal, flotando
   fuera de lugar **sin tirar ningún error**.
3. **Media queries de ejes distintos tienen que compartir especificidad.** Escalar por alto
   con `#sec.clase .hijo` y por ancho con `#sec .hijo` hace que la de alto gane siempre, sin
   importar el orden en la hoja. La forma robusta es **una variable CSS** que todas las queries
   pisan con el mismo selector: ahí manda el orden, que es lo que uno espera.

### Pendiente de esta corrida

- **Más rubros para `escena3d`**: gastronomía (un plato que se arma por capas), salud (una
  pieza dental o una articulación), automotor (un motor o una rueda en despiece), indumentaria
  (una prenda que se despliega). El contrato ya está: es un archivo por escena.
- **Textos de la escena por paso**: hoy el Builder edita título y pasos, pero los MOMENTOS del
  recorrido (en qué fracción del scroll pasa cada cosa) están fijos en cada escena. Un campo
  de "velocidad del recorrido" (la altura del `.s3d-pin`, hoy 420vh fija) sería el siguiente
  ajuste barato y visible.
- **Safari real sin probar**: la escena usa `preserve-3d` anidado, `clip-path` y `@property`
  indirectamente vía el sistema de movimiento. Degradan a "no pasa nada", pero no está
  verificado en el navegador real.

## Corrida 2026-07-22 (42ª) — personalización al extremo + manual

Corrida de núcleo, sin módulos nuevos. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

**Qué entró**: contrato `fields` + bloque *Textos por sección* (39 secciones, 162 campos),
`src/motion.js` (8 ejes × 47 variantes de movimiento), `src/categorias.js` (fuente única de
categorías, se acabaron los 86 módulos en "Otros"), `MANUAL.md` y `MODULOS.md` generado.

**El aprendizaje que más vale para las próximas corridas**: cinco backends administrables
sembraban su colección con una **copia literal** de lo que horneaba su módulo UI. En cuanto el
texto pasó a ser editable, esa copia se volvió una fuente de verdad paralela y la primera carga
del sitio parpadeaba. La regla ahora es: **el backend importa la función resolutora del módulo
UI y siembra con ella** (`servicios(cfg)`, `faqs(cfg)`, `planes(cfg)`, `features(cfg)`,
`pasos(cfg)`). Al agregar un `fields` a un módulo UI, lo primero que hay que hacer es
`grep -rn "require('../ui/<id>')" modules/` y revisar quién más usa esos datos.

**Bug ajeno encontrado de paso**: una marca con apóstrofo (`O'Brien`) generaba cuatro archivos
`.js` que no parseaban (`server.js`, `routes/chatbot.js`, `routes/agent.js`, `public/js/app.js`).
El nombre se interpolaba crudo dentro de strings de JavaScript. Corregido con `JSON.stringify`.
**Conviene incorporar el test de "marca hostil" a la rutina de cierre de cada corrida**: generar
el catálogo completo con `O'Brien & Cía`, `La "Mejor" Pizza`, un backslash y un backtick, y
correr `node --check` sobre todos los `.js` generados.

### Pendiente de esta corrida

- **`imágenes por campo`**: `fields` resuelve textos. La sugerencia nº2 (URLs de imagen real en
  `gallery`, `beforeafter`, `features`) encaja en el mismo mecanismo con un `type: 'url'` y una
  validación contra `javascript:`/`data:` como la que ya hace el módulo `marca`.
- **Los 189 módulos sin `fields`**: quedaron 39 de 228. Los que más valen son los que todavía
  hornean listas visibles (`trust`, `logos`, `press`, `team`, `timeline`, `hours`, `quiz`,
  `productcompare`, `socialfeed`, `waitlist`, `events`). **Ojo**: todos ésos tienen módulo
  administrable, así que hay que aplicar la regla de la semilla de arriba.
- **`textos` (el módulo funcional) sigue cubriendo sólo los 4 textos globales**. Ahora que
  existe `cfg.moduleTexts`, podría sembrar TODOS los campos por sección y volverlos editables
  desde el sitio publicado sin regenerar. Es la continuación natural.
- Los ejes `titleFx` y `cardHover: blurpeers` dependen de `:has()` y `@property`: funcionan en
  los navegadores actuales y degradan a "no pasa nada" en los viejos, pero no están probados en
  Safari real.

## Corrida 2026-07-22 (41ª) — las cinco secciones que todavía mentían

**Chequeo de arranque**: el disco tenía **223 módulos** y la bitácora contaba 223. Coincidían, no
había huérfanos, así que esta corrida encaró lote propio.

**Cómo se eligió el lote.** Buscando qué le falta al catálogo para cubrir un sitio comercial
completo apareció algo mejor que una funcionalidad nueva: **cinco módulos UI cuya propia
descripción dice "frontend puro, sin backend"**, "sin backend obligatorio" o "estática". Los cinco
publican datos inventados que no se pueden corregir sin regenerar. Es el mismo hallazgo que la 37ª
hizo con `logos`, `press` y `trust`, y la consigna del usuario es explícita al respecto: una
funcionalidad sin backend no cuenta como funcionalidad. El detalle técnico está en
[CAMBIOS.md](CAMBIOS.md).

| Módulo | Qué mentía | Nota |
|---|---|---|
| `espera` | Un contador de **1.240 anotados que no existían** y emails que morían en `localStorage` | El alta es **idempotente por email**: volver a anotarse devuelve la misma posición en vez de sumar uno — sin eso cualquiera infla el contador recargando la página, y el número deja de significar algo. La **posición en la fila** (lo único que sólo puede dar un servidor) es el orden de llegada calculado al leer, no un campo guardado: por eso una baja hace que los de atrás suban solos. El **arranque** para gente anotada por otro canal existe pero **empieza en 0**, y el panel dice para qué es: si va a haber un número al lado de "personas ya se anotaron", que sea uno que el negocio pueda defender. Panel con KPIs, invitaciones idempotentes y CSV |
| `eventos` | Tres eventos con **fechas fijas** y un readme que pedía "quitá la sección cuando no tengas eventos" | La falla típica de una agenda no es estar vacía: es que en marzo siga anunciando un taller de agosto. **El servidor decide qué es próximo** con su reloj (ventana de 36 h desde el comienzo del día en UTC, que cubre el día completo del evento en cualquier huso y lo baja a la mañana siguiente), y si no queda ninguno **la sección se oculta entera**. Nunca hay que acordarse de nada. Las fechas se formatean con tabla de meses propia: `new Date('2026-08-15')` se parsea como UTC y al oeste de Greenwich devuelve **el 14**. Emite JSON-LD `Event` |
| `recomendador` | Un quiz que **tiraba a la basura todas las respuestas** — la sección que sirve para descubrir qué necesita la gente descartaba justo ese dato | La fila **nace en la primera respuesta**, no al cargar la página: así una fila es siempre una persona que interactuó y los buscadores no ensucian la medición. Cada respuesta actualiza la misma fila, y por eso el panel puede decir **en qué pregunta abandona la gente**, que es el número que un quiz de sólo-terminados esconde. El cuestionario es administrable y **rechaza una opción que apunte a un resultado inexistente** (si no, recomendaría el fallback genérico sin avisar). Cada resultado lleva a **su propio destino**; con `leads`, el email pedido en el resultado entra como lead |
| `publicaciones` | Ocho casilleros vacíos con **"me gusta" inventados** (128, 342, 511…) y un botón a `@tu_negocio`, que no existe | **El overlay muestra el epígrafe, no un número.** El campo de "me gusta" existe pero arranca vacío y sólo aparece si el negocio carga el real: un número escrito a mano no es una métrica, y ponerlo por default es enseñarle al sitio a mentir. La colección **no se siembra** — sin publicaciones la sección se oculta, la única versión honesta de "todavía no publicamos nada"— y si el perfil queda vacío **el botón desaparece** en vez de llevar a una cuenta inexistente |
| `comparativa` | Cuatro planes con **precios inventados** enfrentados en una tabla | Es la sección donde el visitante mira **números** para decidir: el peor lugar posible para un placeholder. Además de las opciones propias con atributos libres (cada atributo es una fila), con `products-admin` activo la fuente se pone en **catálogo** y la tabla se arma con los productos reales, su precio real y su disponibilidad real — la misma que valida el checkout, así no hay dos lugares que puedan decir precios distintos |

**Un dato horneado menos en un módulo existente**: `eventregister` tenía **su propia constante
`EVENTOS`** en el route generado, o sea la agenda vivía horneada en **dos** lugares. Con `eventos`
activo toma la colección `eventitems` (los visibles, vigentes y **con cupo > 0**: un evento sin
cupo declarado no tiene lugares que repartir) y `evento(id)` pasó a ser asíncrono siempre — un solo
camino de código en vez de dos.

**Tres puntos de entrada nuevos en los módulos UI** para inyectar sin duplicar lógica:
`window.WFLista`, `window.WFQuiz` y `window.WFComparador`, en la línea de `WFPrecios.refrescar` y
`WFFaq.rebind`. **El detalle que costó una vuelta**: los `clientJs` se concatenan en el orden de
`moduleIds` y un `requires` resuelto **empuja al módulo UI al final de la lista**, así que el
funcional nunca puede leer su `window.WF*` en la línea de arranque — siempre desde un callback
asíncrono, cuando el `app.js` entero ya corrió.

**Dos módulos UI dejaron de hornear su placeholder** cuando el backend está activo: `waitlist`
emite `data-base="0"` y `productcompare` emite la grilla vacía. Medio segundo de precios falsos en
pantalla sigue siendo precios falsos en pantalla.

Todo probado: registro (**100 UI · 128 funcionales = 228 módulos**), catálogo completo = **350
archivos / 175 JS, 0 errores de sintaxis**, las 9 tablas nuevas en `schema.sql` y **ningún archivo
perdido** (+10 exactos: 5 routes + 5 páginas admin). **104 asserts de backend en verde** contra
Express 5 real. **Smoke test en navegador real, 0 errores de consola**: alta devolviendo **"Sos el
número 1 de la lista"** con el contador pasando de 0 a 1; quiz respondido de punta a punta cuyo
recorrido quedó guardado **con las tres preguntas y sus opciones**, y el panel mostrando "Plan
Profesional 1" y 100% de finalización; evento creado desde el panel apareciendo en la home con su
badge **03 OCT** (no 02); feed social pasando de oculto a visible con la publicación real y el
botón **@minegocio**; y el comparador enfrentando **Producto Clásico $4.999 vs Producto Premium
$9.999** tras cambiar la fuente al catálogo.

### Pendiente / sugerencias para la próxima corrida

- **Nada quedó a medias ni revertido.** Los 5 módulos entraron completos, probados y documentados.
- **Lo que abre `eventos`**: (1) que entre al **`sitemap.xml`** — necesita el contrato de sitemap
  que la 40ª dejó anotado (ver abajo); (2) una **página de agenda completa** (`/eventos.html`) con
  los pasados, que hoy sólo existen en el panel; (3) **recordatorio por email** a los inscriptos el
  día previo, que es trabajo natural de `tareas`.
- **Lo que abre `recomendador`**: el panel muestra abandono por pregunta, pero falta el paso
  siguiente — **comparar dos versiones del cuestionario** (hoy hay que borrar los recorridos al
  cambiarlo, porque mezclar respuestas de dos cuestionarios distintos da un promedio que no
  describe a ninguno). `experimentos` ya sabe repartir por hash: es el mismo patrón.
- **Lo que abre `publicaciones`**: subida de imagen **desde el propio panel** (hoy hay que pasar
  por `uploads` y pegar la URL); y `albums` (galería administrable) resuelve un problema parecido
  con otra colección — vale evaluar si comparten el selector de imagen.
- **`comparativa`**: con fuente = catálogo faltan **elegir qué productos** entran (hoy entran los
  primeros 24 activos) y sumar los atributos de `variantes` como filas.
- **`espera`**: falta que la invitación traiga un **enlace o código de acceso** propio; hoy avisa
  "ya podés entrar" y nada más. Con `cupones` activo, un cupón por invitado sería el cierre natural.
- **Auditoría que conviene repetir**: este lote salió de leer las *descripciones* del catálogo
  buscando "sin backend", "estática", "placeholder". Quedan módulos UI **decorativos** que está
  bien que sean estáticos (`payments`, `marquee`, `parallax`), pero vale volver a pasar la lista
  cada tantas corridas: es la forma más barata de encontrar trabajo que importa.
- **Pendientes que siguen abiertos** (de la 40ª y anteriores): el **contrato de sitemap**
  (`sitemapUrls(cfg)` compuesto por un solo middleware — desbloquea `etiquetas` y ahora también
  `eventos`); **imagen por variante**; `restock` **por combinación**; **JSON-LD `QAPage`** en
  `consultas`; **pago real** con Mercado Pago como opt-in documentado; **recorte/`srcset`** de
  imágenes al subir; la **factura/remito imprimible** atando `invoices` a `pedidos`; decidir cuál
  manda entre el stock de `inventory` y el del producto; el **recordatorio automático** de
  `abandonos`; **historial de versiones** en `paginas`; **submenús y menú por rol** en `navegacion`;
  el **parpadeo del A/B**; `vercelRewrites` para `mantenimiento`, `seoadmin` y `salud`;
  auto-hospedar Montserrat; y el **helper `adminPanel({...})`** — con estos 5 ya son ~53 los
  módulos que repiten el mismo molde de tabla con acciones, interruptor visible/oculto y botones de
  reordenar. **Sigue siendo lo más valioso que se puede hacer con el tiempo de una corrida.**
- **Hook de impeccable**: décima corrida seguida con los mismos falsos positivos (`#2e9e5b20`/
  `#1d6b3c` del chip "visible", `#c0392b18`/`#c0392b` del chip "ya pasó", tamaños `.72rem`–`.85rem`).
  Son la convención de chips que comparten ~15 módulos de **las generadas**, y el hook las compara
  contra el DESIGN.md **del Builder**, que es otro sistema. Esta corrida sí encontró **dos
  hallazgos legítimos** entre el ruido (un `border-radius: 8px` suelto que pasó a `var(--radius)`),
  lo que confirma que apagarlo entero sería un error: lo que hace falta es el **sidecar propio para
  `modules/`**, no silenciar la regla.

## Corrida 2026-07-21 (40ª) — la ficha de producto, completa

**Chequeo de arranque**: el disco tenía **219 módulos** y la bitácora contaba 219. Coincidían, no
había huérfanos, así que esta corrida encaró lote propio.

Lote de **4 módulos funcionales nuevos**. La 39ª dejó anotado que **las variantes eran lo único
grande que faltaba** para cerrar el e-commerce y que merecían una corrida propia. Esta las cierra,
y completa de paso las otras tres cosas que tiene la ficha de producto de cualquier tienda real y
a esta le faltaban: **elegir una opción**, **preguntar antes de comprar** y **ver qué más se llevó
la gente que compró eso**. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `variantes` | **Talle, color, sabor o medida**: hasta 3 ejes por producto, matriz de combinaciones generada desde el panel, con **stock, SKU y sobreprecio propios**. Lo que sostiene todo: el stock de la variante es el dato real y `products.stock` pasa a ser su **espejo** (la suma de las activas). Gracias a eso la ficha, la tienda, el catálogo, el checkout, la reposición al cancelar y los avisos de "avisame cuando vuelva" **siguen funcionando sin enterarse de que existen las variantes** — el número que leen sigue siendo cierto—, y los 5 módulos existentes se tocaron con parches de pocas líneas en vez de reescribirse. El **id es determinista** (`talle-m__color-azul`): agregar XL conserva S, M y L con su stock; con ids sorteados, regenerar la matriz habría dejado huérfanos los carritos y los pedidos que ya la referencian. El precio es una **diferencia**, no un precio absoluto, así un aumento general se aplica una sola vez. Y cambiar los ejes (agregar "Color" donde había "Talle") **corta con 409** enumerando el stock que quedaría sin lugar: repartirlo a ojo o borrarlo en silencio son las dos formas de perder inventario que nadie puede reconstruir |
| `consultas` | **Preguntas y respuestas** al pie de la ficha: el visitante pregunta sin registrarse y la respuesta queda publicada para todos los que entren después, así contestar una vez sirve para siempre. **Nada se publica solo** (una consulta entra pendiente y aparece recién al contestarla), **el email de quien pregunta no viaja a la vista pública** —no se oculta con CSS: no sale del servidor— y las consultas **con enlaces se rechazan**, que filtra casi todo el spam automático sin molestar a nadie real. Con `mailer`, responder manda la respuesta **adentro del mail** |
| `relacionados` | **Recomendaciones con datos reales.** La ficha ya mostraba cuatro productos pero los elegía **por categoría**, que es la regla que garantiza mostrar lo más parecido a lo que la persona ya está mirando: recomendarle otra remera a quien compra una remera no vende. Ahora el servidor recorre `orders`, cuenta cuántas veces dos productos cayeron en la misma compra y ordena por frecuencia. **Piso de evidencia: 2 pedidos** —una sola compra conjunta es coincidencia, no patrón—, con caída a categoría por debajo. La curación manual gana siempre. Nunca recomienda pausados ni agotados. Segundo bloque en el carrito ("completá tu compra") que se recalcula con cada cambio |
| `etiquetas` | **El tercer eje.** Categoría y marca son atributos únicos; lo que un negocio necesita anunciar casi nunca lo es ("Regalos para el Día de la Madre", "Menos de $20.000"). La etiqueta **guarda a qué productos apunta**, no al revés: armar una campaña es editar una fila y desarmarla es borrarla, sin tocar ningún producto. Cada una tiene **página de colección propia** en `/etiqueta/<slug>` armada por el servidor (mismo patrón que `ficha` y `paginas`, con su `vercelRewrites`): es una página de aterrizaje real, que se puede mandar por WhatsApp y anunciar. Una etiqueta **oculta da 404**, no una página con cartel — servirla la dejaría indexada antes de que la campaña exista |

**Cambios en 5 módulos existentes**, todos condicionados a que `variantes` esté activo: `cart`
(ítem con `variantId`, dos talles = dos líneas, resolución y descuento por variante en el
checkout), `ficha` (no deja agregar sin combinación elegida), `pedidos` (cancelar repone **a la
variante**), `descuentos` y `enviogratis` (los dos suman el sobreprecio, si no el cartel prometería
un número distinto del que cobra la caja).

**Dos bugs encontrados por la prueba en navegador**, ninguno de los cuales habría aparecido en las
pruebas de backend:

1. **El carrito mostraba "(opción)" y el precio sin el sobreprecio.** El índice de variantes llega
   en una consulta aparte que resuelve **después** de que el carrito se pintó, y nada lo volvía a
   pintar. Se agregó `window.WFCart.refrescar()` —el mismo patrón de punto de entrada que
   `WFPrecios.refrescar`, `WFFaq.rebind` y `WFNav.aplicar`— y al arreglarlo apareció el segundo
   tramo: el importe **de la línea** seguía usando el precio base mientras el total ya sumaba el
   delta, así que las líneas no cerraban con el total.
2. **Los cuatro paneles de administración no se mostraban nunca.** El gate de admin decodificaba el
   JWT con `atob(token.split('.')[1])`, y el payload viene en **base64url** (con `-` y `_`), que
   `atob()` rechaza; el `try/catch` se tragaba la excepción y `esAdmin` quedaba en `false` para
   siempre. Reemplazado por `localStorage.getItem('user')`, que es lo que guarda el login y lo que
   usa el resto del catálogo.

Todo probado: registro (**100 UI · 123 funcionales = 223 módulos**), 6 variantes generadas
(catálogo completo = **388 archivos / 169 JS**), **0 errores de sintaxis**, `vercel.json` con el
rewrite nuevo de `/etiqueta/:slug*` y `schema.sql` con las 4 tablas nuevas. **145 asserts de
backend en verde** contra Express 5 real (56 de variantes, 40 de consultas+relacionados, 35 de
etiquetas, 14 con el catálogo completo verificando que los 4 conviven con los 219 anteriores, que
los middlewares no se pisan, que el sitemap sigue intacto y que las áreas nuevas entran **solas**
al mapa de `roles`). **Smoke test en navegador real, 0 errores de consola**: selector de talle que
mueve el precio a **$5.799** en el L, dos talles como dos líneas, **checkout confirmando $21.596 —
el importe exacto que la caja había prometido**, stock bajando M 9→7 y L 8→6 con el producto 25→21,
consulta enviada desde la ficha con acentos y eñes intactos y respondida desde el panel, y la
página de colección con su `<title>` y su `<h1>` **en el HTML**.

### Pendiente / sugerencias para la próxima corrida

- **Nada quedó a medias ni revertido.** Los 4 módulos entraron completos, probados y documentados.
- **`etiquetas` no entra al `sitemap.xml`.** Se descubre por los enlaces internos de la ficha y la
  tienda, que alcanza, pero no acelera la indexación. La razón de no hacerlo ahora es real y vale
  anotarla: `paginas` ya intercepta `/sitemap.xml` desde su middleware, y un segundo middleware que
  hiciera lo mismo **taparía al primero** según el orden de `moduleIds` (que no está garantizado).
  La solución correcta es un **contrato de sitemap** en el generador —`sitemapUrls(cfg)` que cada
  módulo declare y que un solo middleware componga—, no un segundo interceptor. Es una corrida
  chica y desbloquea a los tres módulos que hoy publican URLs propias.
- **Lo que abre `variantes`**: (1) **imagen por variante** (elegir "Azul" debería cambiar la foto:
  hoy la galería es del producto); (2) que `restock` ("avisame cuando vuelva") sea **por
  combinación** —hoy avisa cuando el producto tiene stock, aunque el talle que la persona quería
  siga en cero, que es exactamente el aviso que hace perder la venta—; (3) que el **CSV de
  `listaprecios`** abra una fila por variante.
- **`consultas`**: falta que la ficha emita **JSON-LD `QAPage`** (Google muestra las preguntas bajo
  el resultado) y un botón "esta pregunta me sirvió", que es lo que ordena las más útiles arriba.
- **`relacionados`**: el grafo se recalcula en memoria en cada instancia. Con tráfico real conviene
  que **`tareas`** (el disparador diario) lo precalcule a una colección; también falta el criterio
  **"visto también"** (hoy sólo hay co-compra, que exige una venta cerrada para aprender algo).
- **Pendientes que siguen abiertos** (de la 39ª y anteriores): **pago real** con Mercado Pago como
  opt-in documentado; **recorte/redimensionado y `srcset`** de las imágenes al subir; la
  **factura/remito imprimible** atando `invoices` a `pedidos`; decidir **cuál manda** entre el stock
  de `inventory` (por sucursal) y el del producto cuando los dos están activos; el **recordatorio
  automático** de `abandonos` con `tareas`; **historial de versiones** en `paginas`; **submenús y
  menú por rol** en `navegacion`; el **parpadeo del A/B** portando el patrón de `paginas` a
  `experimentos`; `vercelRewrites` para los middlewares que hoy no corren en Vercel
  (`mantenimiento`, `seoadmin`, `salud`); auto-hospedar Montserrat en `public/fonts/`; y el
  **helper `adminPanel({...})`** — con estos 4 ya son ~48 los módulos que repiten el mismo molde de
  tabla con acciones, interruptor visible/oculto y botones de reordenar. Sigue siendo lo más
  valioso que se puede hacer con el tiempo de una corrida.
- **Hook de impeccable**: novena corrida seguida con los mismos falsos positivos (`#2e9e5b20`/
  `#1d6b3c` del chip "con stock", `#c0392b18`/`#c0392b` del chip "sin stock", tamaños
  `.71rem`–`.88rem`). Son la convención de chips que comparten ~12 módulos de **las generadas**, y
  el hook las compara contra el DESIGN.md **del Builder**, que es otro sistema. Darle un sidecar
  propio a `modules/` o excluirlas del hook es cada vez más urgente.

## Corrida 2026-07-21 (39ª) — e-commerce completo (pedido del usuario)

El usuario preguntó si el Builder tenía todo para que ande un e-commerce real (productos con
descripción, subir imágenes, compras reales, stock, gestión de envíos, filtros y búsqueda, listado).
**La auditoría dio que no.** El catálogo tenía todas las piezas de alrededor y le faltaba el centro.

| Agujero | Cómo estaba | Qué lo cierra |
|---|---|---|
| **Imágenes** | No existía el campo: el catálogo eran tarjetas de texto | `products-admin` con galería y **subida real** |
| **Stock** | No existía: el checkout **vendía infinito** | `products-admin` + `cart`, validado y descontado |
| **Página de producto** | No había ninguna, ni URL por producto | `ficha` (nuevo) |
| **Filtros y búsqueda** | El catálogo filtrable era HTML horneado | `tienda` (nuevo) |
| **Envío en el checkout** | La orden no pedía dirección ni cobraba envío | `cart` + zonas de `shipping` |
| **Gestión de pedidos** | No había panel de las ventas reales | `pedidos` (nuevo) |

**3 módulos nuevos** (`ficha`, `tienda`, `pedidos`) y **`products-admin` reescrito**: el modelo pasó
de 5 campos a 15 (slug único, marca, precio anterior, detalle largo, galería, stock, control de
stock, a pedido, peso, destacado), con la colección **`stockmoves`** registrando cada ajuste con su
motivo y su autor. `GET /api/products` **sigue devolviendo el mismo arreglo de siempre**: lo
consumen seis módulos y cambiarle la forma para meter la paginación los habría roto en silencio.

Las tres decisiones que definen el lote: **la ficha la arma el servidor** (con JSON-LD `Product` y
disponibilidad real, porque una ficha pintada por JS no la ve Google); **la tienda filtra en el
servidor** y guarda el estado en la URL (filtrar en el navegador obliga a bajar el catálogo entero);
y **cancelar un pedido repone el stock** de forma idempotente, mientras que los importes de una
venta ya cobrada **no se pueden editar**.

**Dos bugs encontrados por las pruebas**: buscar "algodon" sin tilde no encontraba "Algodón" (se
pliegan los acentos en los dos lados), y las fotos de la primera fila salían con `loading="lazy"`
**estando sobre el pliegue**, lo que retrasa el LCP — lo detectó la prueba en navegador.

Todo probado: **219 módulos**, 227 JS sin errores de sintaxis, **92 asserts del circuito de compra**
+ 114 de la 38ª + 28 del catálogo completo, todos en verde. Smoke test en navegador con una imagen
**subida de verdad**, búsqueda sin tildes, y una **compra real confirmada en `OT-D16A73` por
$22.498** ($19.998 + $2.500 de envío) con el stock bajando de 12 a 10. Detalle en
[CAMBIOS.md](CAMBIOS.md).

### Pendiente / sugerencias para la próxima

- **Variantes (talle/color) es lo único grande que queda.** Tocan todo el circuito (el item del
  carrito necesita `variantId`, el stock pasa a ser por variante, la ficha necesita selector), así
  que hacerlas a medias sería peor que no tenerlas. Merece una corrida propia.
- **Pago real**: hoy el circuito termina en el pedido registrado; el cobro se coordina por
  transferencia (`pagoinformado`). Un checkout con Mercado Pago necesita credenciales del cliente,
  así que va como **opt-in documentado**, nunca activado por default.
- **Imágenes**: falta recorte/redimensionado al subir (hoy sube el original, con tope de 5 MB) y
  `srcset` para servir una foto más chica en teléfono.
- **`tienda`**: falta el filtro por **etiquetas** y que el módulo `promos` anuncie las ofertas
  vigentes (el `GET /api/descuentos` público ya devuelve lo necesario y no lo consume nadie).
- **`pedidos`**: falta la **factura/remito imprimible** (el módulo `invoices` ya existe y no está
  atado) y el aviso automático al cliente en cada cambio de estado, no sólo al despachar.
- **`inventory`** (stock por sucursal, con movimientos) y el **stock del producto** son ahora dos
  fuentes: conviene decidir cuál manda cuando los dos están activos, antes de que diverjan.

## Corrida 2026-07-21 (38ª)

**Chequeo de arranque**: el disco tenía **212 módulos** y la bitácora contaba 210 — la diferencia
eran exactamente los dos huérfanos que la 37ª dejó anotados (`webhooks` y `enviogratis`). Además
apareció un tercer rastro de esa misma sesión cortada que la 37ª **no** había registrado:
`modules/ui/cookies.js`, modificado a las 13:12, con un contrato colgado (ver abajo). El chequeo de
arranque volvió a pagar solo.

Lote de **4 módulos funcionales nuevos**, más la **adopción de los 2 huérfanos** y el cierre del
contrato colgado. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

El hilo: hasta acá **toda página del sitio se horneaba al generar**. La 36ª y la 37ª le dieron datos
administrables a las secciones que ya existían, pero el negocio seguía sin poder **crear una página
nueva** ni **tocar el menú** — "agregame Política de envíos", "sacá Reseñas del menú", "que Catálogo
diga Tienda" obligaban a regenerar y volver a deployar por un cambio de una palabra. Y del lado
comercial faltaban las dos cosas que cualquier tienda pide primero: descuentos que se apliquen solos
y saber quién dejó el carrito.

| Módulo | Nota |
|---|---|
| `paginas` | **Páginas administrables** en `/p/<slug>`, con el HTML **armado por el servidor** (middleware sobre la cáscara ya generada de `/paginas.html`, reemplazando el bloque marcado + `<title>` + `meta description`). Sin plantillas en runtime y sin parpadeo: una página pintada por JS no la ve Google ni el previsualizador de WhatsApp. El contenido son **bloques tipados**, no HTML libre: todo se escapa y el formato liviano (negrita, enlaces) se resuelve **después** de escapar, así el marcado sale del formato y nunca del dato. El renderer es **uno solo** para la página real y para la vista previa del panel. Las publicadas entran al `sitemap.xml`. La página sembrada nace **en borrador** |
| `navegacion` | **Menú administrable** sembrado al generar con los links reales del proyecto (`ctx.nav`, contrato nuevo). El cliente **mueve** los enlaces existentes en vez de reconstruir `.nav-links`: reescribir el `innerHTML` rompería en silencio el badge del carrito, el `display:none` con que ~15 módulos esconden su link admin, y la clase `active`. Lo oculto usa `hidden`, nunca `style.display`, para no pisar ese ocultamiento por rol. Expone `window.WFNav.aplicar()` |
| `descuentos` | **Descuentos automáticos** por monto o por cantidad, con vigencia (reloj del **servidor**), tope en pesos y regla **exclusiva** que corta las siguientes. Los porcentajes van **siempre sobre el subtotal original**, nunca en cascada. Lo que lo vuelve honesto: `src/descuentos.js` es un motor único que usan la caja del carrito, el simulador del panel **y `routes/orders.js`** — el descuento que se muestra es el que se cobra. Con cupones, el cupón se aplica **después**, sobre el importe ya rebajado |
| `abandonos` | **Carritos abandonados**: "abandonado" **no se guarda**, lo calcula el servidor con su reloj; y "recuperado" sale de una consulta a `orders` al leer, no de un aviso del navegador (ese aviso no llega si la pestaña se cierra al comprar). **Enlace de recuperación** que devuelve el carrito armado. Seguimiento **anónimo**, que **respeta el rechazo del banner de cookies**; con sesión, el email sale **del token**, nunca del cuerpo |

**Los 2 huérfanos, adoptados**: `webhooks` (integraciones salientes con POST JSON firmado por
HMAC-SHA256, reintentos, registro de entregas y bloqueo de destinos internos) y `enviogratis`
(barra de umbral con el subtotal recalculado en el servidor). Estaban bien escritos y siguen el
patrón de la casa; lo único que hubo que corregirles es el bug de coalescencia de abajo.

**El contrato colgado de `cookies`, cerrado**: la sesión cortada dejó el banner emitiendo
`wf:consent` y consultando `window.WFConsentVersion`, y **nadie publicaba ni escuchaba nada**. El
banner degradaba bien pero la función no existía. `privacidad` la implementa: versión de política
en la colección `privacyconfig`, endpoint público, botón "Publicar versión nueva" que hace que a
todo el que aceptó la anterior **le vuelva a aparecer el cartel**, y la versión guardada con cada
consentimiento **la pone el servidor** (si el visitante pudiera declararla, la prueba no valdría).
Se escucha el evento **y** se sigue capturando el clic, con una guarda de 2 segundos para que la
misma elección no se registre dos veces e infle el contador de cambios de opinión.

**Dos cambios en el generador**: `ctx.nav` (el menú armado llega a `files()`) y el contrato
**`vercelRewrites`**. Este segundo tapa un agujero que iba más allá de este lote: en Vercel todo lo
que no matchea un rewrite lo sirve la CDN de estáticos y **nunca llega a Express**, así que
`/p/<slug>` habría dado 404 en producción funcionando perfecto en local. Cualquier módulo futuro con
rutas propias lo necesita.

**Un bug encontrado por la prueba en navegador, corregido en DOS módulos**: la caja de descuentos y
la barra de envío gratis mostraban **el subtotal de una sola unidad** después de agregar seis al
carrito. El guard `if (pidiendo) return;` **descartaba** los eventos `wf:cart` que llegaban con una
consulta en vuelo: se atendía el primero y se tiraban los otros cinco. Reemplazado por coalescencia
(se guarda el último estado y se atiende al terminar). En un módulo cuyo trabajo es que el número
sea cierto, un número viejo es peor que ninguno.

Todo probado: registro (**100 UI · 116 funcionales = 216 módulos**), 4 variantes generadas (lote =
58 archivos; sin `auth` = 23, degrada bien; **Vercel** = 61 con el rewrite de `/p/:slug*`; catálogo
completo = 307→**321** archivos / 161 JS), **0 errores de sintaxis en los 238 JS** y **0 glifos
pictográficos** en el HTML servido. **114 asserts de backend en verde** contra Express 5 real —
entre ellos el `<script>` del editor que sale escapado, el `javascript:` rechazado en botón y en
enlace, el borrador que no se sirve ni entra al sitemap, despublicar que saca la página **sin
esperar el TTL del caché**, las dos reglas del 10% que dan **19.998 y no 18.998**, la regla
exclusiva que corta, la vigencia vencida que no aplica, la orden que guarda **el mismo descuento que
mostró el carrito**, el cupón sobre el importe ya rebajado, el precio falso del navegador ignorado
en tres módulos, el email que sale del token y no del cuerpo, el `localhost` rechazado como webhook
y el `v99` que el navegador quiso declarar como versión de política. Más **28 asserts sobre el
catálogo completo**: los **9 middlewares** conviviendo, el sitemap juntando lo horneado con lo
administrable, y las 4 áreas nuevas entrando **solas** al mapa de `roles`.

**Smoke test en navegador real, 0 errores de consola**: página creada con el editor de bloques y
servida en `/p/como-comprar` con su `<h1>` y su `<title>` **en el HTML**; menú renombrado
(Catálogo → **Tienda**) **conservando el badge del carrito**, "Nosotros" oculto, Instagram agregado
con `rel="noopener noreferrer"`, y **cero filtración de links de administración** al cerrar sesión;
carrito de 6 unidades con el descuento y el envío gratis correctos tras el fix, enlace de
recuperación que devuelve el carrito y limpia la URL, y el **checkout confirmando $53.995 — el
importe exacto que la caja había prometido**; y el banner de cookies **reapareciendo** al publicar
la política v2 en un navegador que ya había aceptado la v1, con `cambios: 1` (no 2).

### Pendiente / sugerencias para la próxima corrida

- **Nada quedó a medias ni revertido.** Los 4 módulos nuevos, los 2 adoptados y el cierre del
  contrato de `cookies` entraron completos, probados y documentados. **No quedan módulos huérfanos
  en disco**: el conteo de este documento y el del disco coinciden en 216.
- **Lo que abre `paginas`**: (1) que las páginas se puedan **elegir como destino** desde otros
  módulos (el botón de `pricing`, el CTA de `hero`, un link de `promos`) en vez de escribir la ruta
  a mano; (2) **bloques que embeban módulos** ("acá va el formulario de contacto", "acá va la
  galería"), que es el paso de "páginas de texto" a "constructor de páginas"; (3) **historial de
  versiones** para poder volver atrás — hoy editar pisa lo anterior sin red.
- **Lo que abre `navegacion`**: submenús (hoy el menú es plano) y **menú por rol** — que el link de
  un panel lo vea sólo quien tiene permiso en `roles`, en vez del `display:none` por "es admin o no"
  que usan hoy todos los módulos.
- **`descuentos`**: falta la regla **por categoría/etiqueta de producto** (hoy la lista blanca de
  productos existe en el modelo pero el panel no la expone: sólo se puede aplicar a todos), el
  **"llevá 3 pagá 2"** propiamente dicho (hoy se aproxima con monto fijo por grupo), y anunciar las
  promos vigentes en el catálogo con el módulo `promos` (el `GET /api/descuentos` público ya
  devuelve lo necesario y no lo consume nadie).
- **`abandonos`**: falta el **recordatorio automático** —hoy el email se manda a mano desde el
  panel— que es el trabajo natural del módulo `tareas` (disparador diario); y capturar el email
  **antes** del login (hoy sólo hay contacto si el visitante ya tenía sesión), que es donde está la
  mayor parte del valor real de recuperar carritos.
- **Parpadeo del A/B (sigue vigente, y ahora hay precedente)**: la 37ª anotaba que la solución
  honesta era que el servidor reescribiera el HTML. `paginas` demuestra el patrón completo
  (middleware + cáscara + reemplazo de bloque marcado); portarlo a `experimentos` ahora es mecánico.
- **`vercelRewrites` para los middlewares existentes**: `mantenimiento`, `seoadmin` y `salud`
  interceptan HTML y, en Vercel, **no corren** (la CDN sirve los estáticos). El contrato nuevo
  permite arreglarlo declarando `['/((?!api/).*)']` o similar, pero hay que medir el costo: mandar
  TODO por la función serverless cambia el perfil de latencia. Vale una corrida propia con
  decisión explícita, no un cambio al pasar.
- **Pendientes que siguen abiertos** (de la 37ª y anteriores): probar **destinos de botón** y
  secciones enteras en `experimentos`; poda de `expvisitors` con `tareas`; auto-hospedar Montserrat
  en `public/fonts/`; íconos en las acciones de tabla de los paneles admin; unificar `phStars` en
  `loyalty`; el módulo nuevo de galería hover-expand; y toda la lista larga de mejoras por módulo
  de la 36ª (horario por sucursal, puente `equipo`↔`personal`, etc.).
- **Molde ABM público+admin**: con estos 4 son ~44 los módulos que repiten el molde. Esta corrida
  volvió a escribir **cuatro veces** el mismo par de botones de reordenar, el mismo interruptor
  visible/oculto y la misma tabla con acciones. El helper `adminPanel({...})` sugerido desde la 19ª
  sigue siendo **lo más valioso que se puede hacer** con el tiempo de una corrida.
- **Hook de impeccable**: octava corrida seguida con los mismos falsos positivos
  (`#2e9e5b20`/`#1d6b3c` del chip "ok", `#c0392b18` del chip "vencido", tamaños `.78rem`–`.85rem`).
  Compara el CSS de las **generadas** contra el DESIGN.md del **Builder**, que son dos sistemas
  distintos. Darle un sidecar propio a `modules/` o excluirlas del hook es cada vez más urgente.

## Corrida 2026-07-21 (37ª)

**Chequeo de arranque**: el disco coincidía con la bitácora (205 módulos, nada huérfano), así que
esta corrida encaró lote propio.

Lote de **5 módulos funcionales con backend real**, todos nuevos. Dos hilos, uno que cierra y otro
que abre. El que **cierra**: la 36ª le dio datos administrables a cinco secciones y quedaban siete
más horneadas —las que cuentan **qué hace el negocio y por qué confiar en él**—. Con esta corrida
**ya no queda ninguna**. El que **abre**: el catálogo sabía construir el sitio y administrarlo,
pero no sabía **medirlo**; "¿conviene 'Empezar ahora' o 'Pedí tu presupuesto'?" se contestaba por
opinión. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

No eran placeholders inofensivos: `logos` y `press` publicaban **clientes y medios inventados**
("Nova Group", "El Diario", "Radio Ciudad") que, como no se ven rotos, salen a producción tal cual;
y `trust` prometía **"envío gratis en compras superiores a $50.000"** y **"hasta 30 días para
cambiar de idea"**, condiciones que un cliente puede reclamar y que el negocio no podía corregir sin
regenerar y volver a deployar.

| Módulo | Nota |
|---|---|
| `servicios` | **Servicios administrables** (`requires: services`, `usesAnime`): alimenta con una sola lista la grilla de la home **y** la página de detalle, incluidas **las anclas `#servicio-N`** que unen una con otra —si se reordenan, las anclas se recalculan solas—. El ícono se guarda como **nombre Phosphor de una lista blanca de 16, nunca como marcado**: el panel muestra una grilla y el servidor rechaza lo demás. Los puntos clave son lista (vacíos limpiados, corte en 6). La siembra **no se duplica a mano**: importa `SERVICIOS` y `DETALLES` de los propios módulos UI, así no puede divergir del HTML. Tras repintar el detalle **vuelve a resolver el `#hash`**, porque el navegador ya había saltado al ancla con el DOM viejo |
| `experimentos` | **Pruebas A/B de textos** (`usesAnime`): tres decisiones lo separan de un contador de clics. **(1)** El reparto es del servidor y es **estable** (hash FNV-1a de visitante + prueba, determinista entre procesos: importa en serverless), no `Math.random()` en el navegador — sin eso la métrica mide ruido. **(2)** La **impresión sólo cuenta si el elemento medido estaba en la página**: el cliente informa qué destinos renderizó y el servidor ignora el resto. **(3)** Una fila por visitante y por prueba: la deduplicación es **del servidor**, no una bandera del navegador. Destinos y objetivos son **listas blancas**, no selectores libres. El **veredicto** es una prueba z de dos proporciones (CDF normal por Abramowitz-Stegun, cero dependencias) que declara ganador sólo con ≥95% y ≥30 visitantes por variante; si no, dice qué falta. La conversión viaja por **`sendBeacon`** porque el clic en el botón medido navega antes de que un `fetch` normal salga. La prueba sembrada **nace apagada** |
| `marca` | **Clientes, prensa y sellos administrables** (`requires: logos`, `usesAnime`): tres grupos con **orden independiente** (sumar un cliente no reordena los medios). Cada entrada puede ser el **wordmark tipográfico** o el **logo real por URL** —validada contra `javascript:`/`data:`—, conservando el marcado exacto y con él el grisado que toma color en hover. Los sellos pasaron de SVG inline a **ícono Phosphor de lista blanca** |
| `historia` | **Historia y proceso administrables** (`requires: timeline`, `usesAnime`): dos entidades en un módulo porque contestan el mismo bloque narrativo (mismo criterio que `horarios` con horarios + feriados), con **CRUD parametrizado por `:tipo`** — la segunda lista no duplicó una línea. El **año es texto a propósito** (el HTML cierra con "Hoy"). Los **pasos se numeran por posición**, no por dato guardado: borrar el paso 2 hace que el 3 pase a ser 2 |
| `razones` | **Garantías y características administrables** (`requires: trust`, `usesAnime`): mismo patrón de dos entidades. Las filas de características se reinsertan como **hermanas directas del contenedor**, no dentro de un envoltorio: el zigzag de `features` es `:nth-child(even)` contando desde el `<h2>`, y un `div` extra lo habría roto **en silencio** (hay un assert dedicado). El panel abre avisando que los montos y plazos cargados son de ejemplo **y que un cliente puede reclamártelos** |

**Cambios en 4 módulos UI existentes** (mínimos, sin tocar comportamiento): `services` guarda ahora
también el **nombre** del ícono además del SVG (el SVG no sirve como dato), `servicespage` exporta
`DETALLES` y envuelve las fichas en `#servicios-detalle`, y `timeline` y `trust` reciben un `id` en
un contenedor que sólo tenía estilos inline. Los cinco módulos degradan solos: sin el funcional, el
HTML horneado se ve igual que antes.

**Un bug encontrado por los tests**: `PUT /api/experimentos/:id` devolvía `reiniciada: undefined`
—no `false`— porque `false || undefined || undefined` es `undefined` y `JSON.stringify` borra esas
claves, así que el panel nunca se enteraba de que **no** se había reiniciado nada. Corregido con
`Boolean()`.

Todo probado: registro (**100 UI · 110 funcionales = 210 módulos**), 4 variantes generadas
(lote con auth = 38 archivos; sin auth = 22; **Vercel+Supabase** con las **8 tablas nuevas** en
`schema.sql`; catálogo completo = 307), **0 errores de sintaxis** en los **200 JS**, **0 glifos
pictográficos** en el HTML. **102 asserts de backend en verde** contra Express 5 real — entre ellos
el ícono fuera de lista rechazado, los 8 puntos clave cortados en 6, el orden 1..N sin huecos, el
servicio oculto que sale del sitio **pero no del panel**, el mismo visitante que recibe **siempre**
la misma variante, las dos cargas que suman **una** impresión, las 60 visitas repartidas entre A y
B, el 409 de convertir sin haber visto nada, el **ganador declarado por la prueba z** con 200
visitantes, el texto corregido que **no** reinicia y la variante agregada que **sí**, el
`javascript:` rechazado en los logos, el hito sin año rechazado y el paso sin año aceptado (misma
validación parametrizada) y el paso del medio borrado que corre a los siguientes. Más **20 asserts**
sobre el catálogo completo verificando que los **8 ganchos de DOM** siguen en el HTML horneado y que
el zigzag conserva sus dos hermanos previos. **Smoke test en navegador real**: las 7 secciones
inyectadas, el **ciclo A/B completo de punta a punta** (asignación → cambio de texto → clic real que
navega → conversión por `sendBeacon`), los 5 paneles cargando y **0 errores de consola**. La vista
previa del Builder pinta todo con datos DEMO y el A/B **no toca** el titular (corta en `__PREVIEW__`).

### ⚠ Módulos huérfanos en disco → **RESUELTO por la 38ª**

> **Cerrado.** La 38ª probó, documentó y sumó al conteo a `webhooks` y `enviogratis`, y encontró
> además un tercer rastro de esa sesión que esta anotación no registraba: `modules/ui/cookies.js`,
> modificado a las 13:12 con un contrato colgado (`wf:consent` + `window.WFConsentVersion`) que
> ningún módulo implementaba. También está cerrado, en `privacidad`. **No quedan huérfanos.**

Después de cerrar el lote de la 37ª aparecieron en `modules/functional/` **dos módulos que esta
corrida no escribió**, más una modificación de `cart.js`, con fecha 13:12–13:16 de una sesión que
se cortó (no volvió a escribir nada en casi dos horas y no dejó entrada en CAMBIOS.md):

| Archivo | Qué dice su cabecera |
|---|---|
| `modules/functional/webhooks.js` | Integraciones salientes: middleware global que despacha un POST JSON a los endpoints cargados cuando cualquier escritura de API termina en 2xx (Discord, Slack, Zapier, Make) |
| `modules/functional/enviogratis.js` | Envío gratis por umbral con subtotal recalculado en el servidor contra `products`; se engancha al evento `wf:cart` |
| `modules/functional/cart.js` | **Modificado**: al parecer para emitir el evento `wf:cart` que consume `enviogratis` |

**Lo único verificado sobre ellos** es lo que cayó de rebote en las pruebas de esta corrida: cargan
en el registro, y la variante con el catálogo completo (que los incluye) **genera sin errores de
sintaxis** y levanta. **Su comportamiento NO está probado** y no están documentados.

Los dejé intactos a propósito: adoptarlos sin probarlos sería peor que no tenerlos. La próxima
corrida debería **probarlos, documentarlos y sumarlos al conteo** —como hizo la 35ª con los cinco
módulos que le dejó una sesión cortada— o descartarlos. Hasta entonces, **el catálogo real en disco
son 212 módulos (100 UI · 112 funcionales)**, aunque este documento y el README cuenten 210: la
diferencia son exactamente estos dos.

### Pendiente / sugerencias para la próxima

- **Lo que abrió `experimentos`**: hoy prueba **textos**. El paso natural es probar **destinos de
  botón** (`/contact.html` vs. `/quote.html`) y **secciones enteras encendidas o apagadas**. La
  infraestructura (reparto estable, impresiones, prueba z) ya está: falta ampliar la lista blanca
  de destinos y que el cliente sepa aplicar `href` y `display`, no sólo `textContent`.
- **`expvisitors` crece sin poda**: una fila por visitante y por prueba. Es lo correcto para
  deduplicar de verdad, pero a un año de tráfico real conviene un barrido de filas de pruebas ya
  borradas o pausadas hace mucho — el módulo `tareas` (disparador diario) es el lugar natural.
- **Parpadeo del A/B**: el texto original se ve unos milisegundos antes del cambio. Se disimula con
  el fundido de Anime, pero la solución honesta sería que el servidor **reescriba el HTML** antes de
  servirlo (el patrón de `seoadmin`, que ya reescribe el `<head>` con un middleware). Es la mejora
  de mayor impacto visible sobre este módulo.
- **Secciones sin backend que quedan**: ninguna del bloque comercial. Las que siguen horneadas son
  decorativas o de una sola línea (`marquee`, `announcement`, `scrollcue`) y no justifican un panel.
  El próximo lote conviene buscarlo en **capacidades nuevas**, no en administrar más HTML.
- **Sigue vigente de la corrida anterior**: auto-hospedar Montserrat en `public/fonts/`, íconos en
  las acciones de tabla de los paneles admin, unificar `phStars` en `loyalty`, el módulo nuevo de
  galería hover-expand, y darle a las generadas un sidecar propio de impeccable (el hook compara su
  CSS contra el DESIGN.md del Builder y reporta falsos positivos de color en cada archivo nuevo).

## Corrida 2026-07-21 (36ª)

**Chequeo de arranque**: el disco coincidía con la bitácora (200 módulos, nada huérfano), así que
esta corrida encaró lote propio, como anticipaba la 35ª.

Lote de **5 módulos funcionales con backend real**, todos nuevos. El hilo es **el sitio hacia
afuera**: el catálogo ya sabía construir un sitio comercial completo y sostener todo el ERP de
atrás, pero **cinco de las secciones más visibles seguían siendo datos horneados en el generador**.
Cambiar un precio, agregar una pregunta o corregir un horario obligaba a regenerar el proyecto y
volver a deployar — justo lo que un cliente real no puede hacer. Y tres de esas secciones no sólo
eran incómodas: **mentían**. El selector de moneda traía tasas fijas ("actualizalas cuando cambie
el mercado"), el cartel "Abierto ahora" lo calculaba el reloj del visitante, y la sección de equipo
salía a producción con tres nombres inventados. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `planes` | **Planes y precios administrables** (`requires: pricing`, `usesAnime`): las tarjetas se reconstruyen con **el mismo marcado que hornea `pricing`**, así el interruptor mensual/anual animado sigue funcionando sobre los planes del negocio. El **importe anual no se guarda dos veces**: lo calcula el servidor como mensual × 10 (la regla "2 meses gratis" que ya usaba el HTML) salvo que se pise a mano — y el panel **no precarga un valor calculado** como si fuera propio. Un importe **0 es "a medida"**: muestra texto y queda fuera del interruptor. El **orden lo decide el servidor** (reescribe 1..N sin huecos) y el destino del botón se valida contra `javascript:` |
| `faqadmin` | **Preguntas frecuentes administrables** (`requires: faq`, `usesAnime`): reemplaza los `<details>` con el caret Phosphor incluido y **reescribe el JSON-LD FAQPage del `<head>`** con las preguntas reales. Lo que lo vuelve útil de verdad: **el negocio ve qué se pregunta**. Cada apertura suma una vista pública y anónima (sin cookies ni datos personales), **una por pregunta y por carga** para que abrir y cerrar diez veces no infle el número, y el panel ordena por las más consultadas — en ese orden **esconde los botones de mover**, porque reordenar sobre otro criterio confunde |
| `horarios` | **Horarios y feriados administrables** (`requires: hours`, `usesAnime`): reescribe la tabla **conservando los `data-dias`/`data-abre`/`data-cierra`** que `hours` usa como fuente de verdad, sin tocar ese módulo. Suma las dos cosas que el front solo no puede: **feriados y cierres excepcionales** por fecha (con horario especial opcional) que **pisan el día**, y el veredicto "Abierto ahora" **calculado por el servidor con la zona horaria del NEGOCIO** — en Vercel el proceso corre en UTC y un local de Buenos Aires cerraría tres horas antes. Además dice "cierra a las 18:00" o "abre mañana a las 09:00" recorriendo 7 días con los feriados aplicados. Una franja que cierra antes de abrir se rechaza; cargar dos veces la misma fecha **reemplaza** en vez de duplicar |
| `cambio` | **Tipo de cambio administrable** (`requires: currency`, `usesAnime`): la tasa se carga **como la piensa el negocio** ("1 USD = 1.200 pesos"), no como la necesita el front (0,00083); el servidor guarda los pesos por unidad y publica el factor invertido. Cada cambio deja **historial** (fecha, valor anterior, valor nuevo y autor, últimos 20) — sin eso no se puede contestar "¿a cuánto estaba el dólar cuando te pasé el presupuesto?"; guardar la misma tasa **no ensucia el historial**. El peso es la **base**: 409 al cotizarla contra sí misma, al ocultarla y al borrarla. **Sin API externa**: nada que pagar ni que se caiga |
| `equipo` | **Equipo administrable** (`requires: team`, `usesAnime`): foto por URL (validada contra `javascript:`/`data:`) o el **mismo avatar de iniciales con degradado** del HTML original, así una ficha sin foto nunca se ve rota. Quien se va se **oculta** en vez de borrarse. Distinto de `personal` (legajo interno con fichajes): acá es la cara pública |

**Cambio en 4 módulos UI existentes**: un módulo que reemplaza el DOM de otro rompe los handlers que
ese otro enganchó al cargar. En vez de duplicar lógica, `pricing`, `faq`, `currency` y `hours`
exponen ahora un punto de entrada mínimo (`window.WFPrecios.refrescar()`, `window.WFFaq.rebind()`,
`window.WFMoneda.setMonedas()`, `window.WFHorarios.actualizar()`), y los dos primeros **dejaron de
cachear** los nodos que el módulo funcional reemplaza. Los cuatro degradan solos: sin el funcional
no cambia nada.

Todo probado: registro (**100 UI · 105 funcionales = 205 módulos**), 4 variantes generadas (lote =
38 archivos; **Vercel+Supabase** con las **5 tablas nuevas** en `schema.sql`; **sin `auth`**, que
degrada bien — API pública en 200 y panel en 404; y el proyecto con los **205 módulos** = 294
archivos / 146 JS), **0 errores de sintaxis** en los 167 JS de las variantes y **0 glifos
pictográficos** en el HTML renderizado. **Prueba de backend real** en Express 5: **83 asserts en
verde**, corridos dos veces (build inicial y build limpio de regresión) — el anual calculado que da
99.990, el plan "a medida" sin cifra, el `javascript:` rechazado en el botón, el orden que queda
1..N sin huecos, el 409 al bajar el último, el plan oculto que sale del sitio **pero no del panel**,
la vista de FAQ que un anónimo puede registrar y que **no se expone** en la vista pública, el
feriado de hoy que **da cerrado igual con la franja abierta**, el mismo feriado recargado con
horario especial que **reemplaza** y da abierto hasta las 23:59, el huso horario que **mueve el
reloj del negocio 5 horas** y el imposible rechazado, la tasa publicada que es **el inverso exacto**
de los pesos por unidad, el historial que guarda el valor anterior y **no crece** al guardar lo
mismo, y los tres 409 de la moneda base. Más el catálogo completo levantando con las **11 rutas
nuevas en 200** con los **7 middlewares en el medio**.

**Los 5 entraron solos al mapa de áreas de `roles`** (`/api/planes`, `/api/faqs`, `/api/horarios`,
`/api/cambio`, `/api/equipo`), como ya había pasado en la 35ª.

**Smoke test en navegador real**: cero errores de consola. Lo importante acá no era que las páginas
cargaran sino que **la inyección en vivo no rompiera las animaciones del módulo que reemplaza**, y
se verificó una por una: el interruptor **anual sobre las tarjetas inyectadas** ($99.990/año, con la
tarjeta "A medida" sin tocar y el pulgar reposicionado), el acordeón **abriendo con la clase
`abierto`** sobre las preguntas del backend (prueba del `rebind`) y registrando la vista — que se
comprobó **persistida en disco** (2 → 3), el selector de moneda convirtiendo con la tasa que el
test había cargado por API (**u$s 7,41 = 9.999 / 1.350**) y, más fuerte todavía, adoptando una
moneda **que no existe en la constante horneada** (GBP cargada desde el panel → botón nuevo y
£ 5,88). Los cinco paneles operados por UI real: plan editado a $24.999 y visto en la Home, plan
reordenado, feriado cargado desde el formulario, moneda dada de alta, y un **nombre inventado
reemplazado por uno real** con el cambio reflejado en `/api/equipo`. La **red de seguridad de
Anime.js** verificada otra vez: pese a que la pestaña corre oculta, las tarjetas quedan en opacidad
1.

**Un bug de coherencia encontrado por la prueba en navegador y corregido**: con un feriado cargado
para hoy, la Home mostraba **"Abierto ahora" en verde justo arriba de una tabla que decía "Cerrado
(feriado)"**. `hours` calcula su cartel al cargar la página —cuando la tabla todavía tiene las filas
horneadas— y recién vuelve a calcularlo al minuto siguiente: hasta 60 segundos de contradicción, que
es exactamente la mentira que el módulo existe para evitar. Se resolvió exponiendo
`window.WFHorarios.actualizar()` y llamándolo tras reescribir la tabla; verificado que ahora pasa a
**"Cerrado en este momento"** en rojo en la misma carga, y que al borrar el feriado vuelve a
"Abierto". Sin módulos revertidos.

**Detalle de estilo**: los botones de reordenar salieron primero con los glifos `↑ ↓` como texto.
El catálogo no usa glifos pictográficos desde la pasada de diseño, así que pasaron a **íconos
Phosphor horneados** en el `clientJs` (misma convención que el caret de `faqadmin`) con `aria-label`
y `title`. Los únicos `↑↓` que quedan en el `app.js` generado son los de `commandpalette`, donde son
**notación de teclas** y corresponden.

**Falsos positivos del hook de impeccable** (sexta corrida seguida): 13 avisos de
`design-system-color` y `design-system-font-size` sobre `#2e9e5b20`/`#1d6b3c` (chip "estado ok"),
`#c0392b`/`#c0392b18` (chip "cerrado/vencido") y `.92rem` (el tamaño que **ya usa** la tarjeta de
equipo horneada, replicado a propósito para no romper la paridad visual). Son la convención del
catálogo desde hace 20 corridas y el hook compara el CSS de las **generadas** contra el DESIGN.md
del **Builder**. Quedaron como están.

### Pendiente / sugerencias para la próxima corrida

- **Nada quedó a medias**: los 5 módulos entraron completos, probados y documentados, más el
  cambio en los 4 módulos UI y el fix del cartel de horarios.
- **Secciones que siguen horneadas** (el mismo problema, sin resolver): `metrics` y `counters`
  (cifras de confianza), `events` (próximos eventos), `logos`/`press` (marcas y prensa),
  `testimonials` (tiene integración con `reviews` pero los ejemplos son fijos), `services`,
  `features`, `timeline` y `process`. **`events` es la más urgente**: un evento vencido en la Home
  es peor que no tener la sección. Ojo con el solape: `eventregister` ya administra eventos con
  cupos — conviene que la sección UI **lea de ese módulo** en vez de crear uno nuevo, que sería el
  primer caso de "un funcional existente alimenta una sección UI".
- **`planes`**: falta atarlo a lo que ya existe — que el botón "Consultar" **arme un presupuesto**
  con `presupuestador` o `quotesadmin` en vez de mandar a contacto, y que con `cambio` activo las
  tarjetas se puedan marcar como convertibles (hoy `pricing` y `currency` no se pisan porque usan
  atributos distintos: habría que decidir cuál manda). Un plan **destacado por tiempo limitado**
  (con `promos`) es el pedido comercial obvio.
- **`faqadmin`**: falta **buscar entre las preguntas** cuando son muchas, agrupar por categoría, y
  el circuito completo con `sitesearch`/`kb` (hoy son tres lugares distintos donde vive una
  respuesta). Con `feedback` activo, el "¿te resultó útil?" por pregunta cerraría el bucle que hoy
  sólo mide aperturas.
- **`horarios`**: falta **horario por sucursal** con `branches` activo (hoy es uno solo para todo
  el negocio), **feriados nacionales precargados** por país para no cargarlos a mano uno por uno, y
  que `bookings`/`agenda` **no ofrezcan turnos** en un día cerrado o feriado — eso último es un bug
  latente real: hoy esos módulos no consultan estos horarios.
- **`cambio`**: falta que los **importes de todo el sitio** se puedan mostrar convertidos (hoy sólo
  los `.js-precio[data-ars]` de la sección de moneda), que `invoices`/`presupuestador` **guarden la
  cotización del día** junto al comprobante, y una **actualización opcional por API** (hay fuentes
  gratuitas sin key, pero habría que dejarla apagada por default para no romper la promesa de
  "cero dependencias externas").
- **`equipo`**: falta el puente con `personal` — publicar a alguien del legajo interno como ficha
  pública sin recargar los datos — y campos de contacto por persona (email, LinkedIn) que hoy no
  están.
- **Pendientes que siguen abiertos** (de la 35ª y anteriores): parte mensual imprimible, feriados y
  ausencias y PIN de fichaje en `personal`; tareas recurrentes y adjuntos en `trabajo`; comparar dos
  períodos y objetivo por indicador en `tablero`; aviso previo, adjuntar comprobante y pagos
  parciales en `vencimientos`; convertir la cotización en presupuesto formal y conceptos
  dependientes en `presupuestador`; permisos por sucursal en `roles`; más de un firmante en `firma`;
  recepción parcial en `compras`; límite de crédito en `ctacte`; actualizar filas en `importar`;
  sitemap dinámico en `seoadmin`.
- **Molde ABM público+admin**: con estos 5 son ~40 los módulos que repiten el molde, y esta corrida
  lo confirmó de la peor manera: los cinco paneles comparten **el mismo formulario con edición
  inline, la misma tabla con acciones, el mismo interruptor visible/oculto y el mismo par de
  botones de reordenar**, escritos cinco veces. El helper compartido (`adminPanel({...})`) sugerido
  desde la 19ª es, otra vez, **lo más valioso que se puede hacer**: con el patrón de reordenamiento
  ya repetido tres veces en un solo lote, ahora hay evidencia de sobra de cuál es la abstracción
  correcta.
- **Un patrón nuevo que conviene nombrar**: "módulo funcional que le da backend a un módulo UI"
  ya tiene cinco casos y una convención de facto (`requires: ['<ui>']`, siembra igual al HTML
  horneado para que no parpadee, `window.WF*` como punto de entrada). Vale documentarlo en el
  encabezado de `registry.js` para que la próxima corrida no lo re-derive.
- **Hook de impeccable**: sigue comparando las **generadas** contra el DESIGN.md del **Builder**.
  Van 6 corridas anotando los mismos falsos positivos; darle un sidecar propio o excluir
  `modules/` es cada vez más urgente.

## Corrida 2026-07-21 (35ª)

**Corrida de adopción: no se escribieron módulos nuevos.** Al arrancar contrastando el disco contra
esta bitácora aparecieron **5 módulos funcionales completos, sin probar y sin documentar**, con
archivos de 07:14–07:24 de esta misma mañana: una sesión cortada los escribió y no llegó a más. Es
el tercer caso (30ª y 33ª), y confirma que el chequeo de arranque vale la pena. Esta corrida los
revisó contra el patrón de la casa, les armó la suite de tests que les faltaba, los verificó en
navegador real y los documentó. El hilo de los cinco es **el negocio hacia adentro y el número que
lo resume**: quiénes trabajan y cuánto (`personal`), qué tiene que hacer cada uno (`trabajo`), qué
hay que pagar y cuándo (`vencimientos`), cuánto sale lo que el cliente pide antes de que pregunte
(`presupuestador`) y cómo viene todo junto (`tablero`). El detalle técnico está en
[CAMBIOS.md](CAMBIOS.md).

**No hizo falta registrar nada**: `registry.js` carga los módulos **recorriendo el disco**, así que
los cinco ya estaban en el catálogo desde que la sesión anterior los escribió. El registro pasó de
195 a **200 módulos (100 UI · 100 funcionales)** sin una sola edición. Lo que faltaba no era
registrarlos: era **probar que funcionan**.

| Módulo | Nota |
|---|---|
| `personal` | **Personal y asistencia** (`usesAnime`, requiere auth): legajo del equipo y reloj de fichaje en `/fichar.html`. El vínculo entre la cuenta y el legajo es **el email**, y quien no figura recibe un 403 que explica qué pedirle al administrador. **Las horas no son un campo escribible**: las suma el servidor sobre los pares entrada/salida. El fichaje es un **toggle que decide el servidor**, así que nadie puede marcar dos entradas seguidas ni una salida sin haber entrado. Un turno de más de 20 horas **no inventa la hora de salida**: queda marcado "sin salida" para que el admin lo complete desde la planilla. La baja es **lógica**: la planilla de los meses pasados no se toca |
| `trabajo` | **Tablero de tareas del equipo** (`usesAnime`, requiere auth): quién hace qué. **Quién ve qué lo decide el servidor**: el admin ve el tablero entero y cualquier otro **sólo sus tareas** — y como el registro del sitio es público, la lista del equipo con sus emails **se le entrega únicamente al admin**. Transiciones validadas (`pendiente → curso → hecha`; reabrir vuelve a "en curso" borrando la fecha de fin, nunca a pendiente: ya se empezó) y **lo vencido lo marca el servidor con su propia fecha**, no el reloj del navegador. No confundir con `tareas`, que son los trabajos automáticos del servidor |
| `tablero` | **Panel de control del negocio** (`usesAnime`, requiere auth): **el único módulo del catálogo sin colección propia** — no guarda nada, lee las de los demás. El arreglo de indicadores **se hornea al generar** según los módulos activos, así que un módulo medible que se active después entra solo al regenerar. Cada KPI se compara contra el **período inmediatamente anterior** y, sin base previa, dice "sin base para comparar" en vez de inventar un porcentaje. La serie diaria incluye **los días en cero**: un gráfico que los saltea miente sobre la tendencia. Distinto de `stats`, que mide el tráfico y no el negocio |
| `vencimientos` | **Vencimientos y pagos** (`usesAnime`, requiere auth): lo que el negocio tiene que pagar. El estado **"vencido" no se guarda: lo calcula el servidor** cada vez con su propia fecha. Las obligaciones **mensuales se renuevan al pagarlas** (no por adelantado, para no llenar la agenda de filas que nadie pidió) respetando los meses cortos: un vencimiento del 31 cae el 28 o 29 en febrero. Un pago **queda sellado** (409 al editarlo o pagarlo dos veces) y los pagos a futuro se rechazan. Con `caja` activo cada pago **espeja un egreso del día**; si la caja ya cerró, el pago se registra igual y el panel avisa que no la tocó |
| `presupuestador` | **Cotizador online** (`usesAnime`, público + panel admin): el visitante arma su presupuesto y ve el total en vivo. **El total nunca llega del navegador**: el servidor lo arma de cero validando la selección contra la definición vigente, y una opción que no está en la definición **se rechaza** en vez de aceptarse por las dudas. Cuatro tipos de concepto (por cantidad, elegir opción, sí/no y **ajuste porcentual**), y los ajustes se aplican **siempre sobre la base, nunca en cascada**: dos recargos del 10% suman 20%, no 21%. Cada cotización guarda la **foto de los precios del momento**, así que actualizar la lista no cambia lo ya prometido. La consulta pública por código no expone ni el email ni la nota interna |

Todo probado: registro (**100 UI · 100 funcionales = 200 módulos**), 3 variantes generadas
(lote = 53 archivos / 27 JS; Vercel+Supabase = 39 / 19 con las **6 colecciones nuevas** en
`schema.sql`; **y el proyecto con los 200 módulos a la vez** = 284 archivos, 141 JS, **7
middlewares conviviendo**), syntax-check de los **187 JS** de las tres variantes (**0 errores**) y
**0 emojis** en el HTML renderizado. **Prueba de backend real** en Express 5 (:4970): **98 asserts
en verde** — el fichaje que rechaza al que no está en el legajo y al que está de baja, el doble
toque frenado con 409, los 270 minutos calculados por el servidor sobre un registro manual, la baja
lógica que **deja vivos los fichajes viejos**, el responsable que ve su tarea y **no** la ajena, el
salto `pendiente → hecha` rechazado, reabrir borrando la fecha de fin, el mensual que agenda el
**28/2** al pagar el 31/1, el pagado sellado, el **total falso del cliente descartado** (mandé
`total: 1` y devolvió 102.000), el ajuste del 20% **sobre la base**, la opción inexistente
rechazada, la **foto de precios** que sobrevive a un aumento, y la serie del tablero con sus **6
días en cero**. Más **10 asserts sobre el catálogo completo** (:4971): los 5 respondiendo con los 7
middlewares en el medio, y **la auditoría registrando la escritura de un módulo nuevo**.

**Los 5 entraron solos al mapa de áreas de `roles`** (`/api/personal`, `/api/trabajo`,
`/api/tablero`, `/api/vencimientos`, `/api/cotizador`), que es exactamente lo que la 34ª prometía
cuando decía "un módulo nuevo entra solo". Es la primera vez que se comprueba con módulos que la
34ª no conocía.

**Smoke test en navegador real**: cero errores de consola. Login por el handler real del módulo
`auth`; cotizador armado por UI con el **total en vivo en $179.988** (10 m² × $9.999 + Premium
$50.000 = $149.990 de base, +20% de urgencia = $29.998), cotización enviada por el formulario real
con su código `CO-74147B`; el **tablero de control mostrando $281.988 de "Cotizado online"** — la
suma exacta de la cotización del test y la del navegador —, los egresos de caja del vencimiento
pagado y las horas fichadas; y un vencimiento **pagado desde el botón del panel** con el aviso
correcto *"Pago registrado (la caja del día ya estaba cerrada: no se tocó)"*. La **red de seguridad
de Anime.js** verificada: pese a que la pestaña corre oculta, los KPIs quedan en su valor final.

**Un bug cosmético encontrado por la prueba en navegador y corregido**: `personal` mostraba
**"Martes, 21 De Julio"**. La regla era `text-transform: capitalize`, que pone mayúscula en **cada
palabra**, y `toLocaleDateString('es-AR')` devuelve `"martes, 21 de julio"` — así que capitalizaba
la preposición. Pasó a `::first-letter{text-transform:uppercase}`, que capitaliza sólo la inicial.
Al escribirlo se cayó en la trampa de comentar con `//` dentro de un bloque `<style>` (donde no es
un comentario sino texto que rompe la regla siguiente); se detectó antes de generar y quedó con
`/* … */`. Sin módulos revertidos.

**Falsos positivos del hook de impeccable** (pendiente abierto desde la pasada de diseño): el
arreglo de `personal` disparó 7 avisos de `design-system-color` y `design-system-font-size` sobre
líneas **que no toqué** (`#2e9e5b20`/`#1d6b3c` para el estado correcto, `#c0392b` para el negativo,
`.72rem` para los chips). Son la convención del catálogo desde hace 20 corridas y el hook compara
el CSS de las **generadas** contra el DESIGN.md del **Builder**. Quedaron como están.

### Pendiente / sugerencias para la próxima corrida

- **Lote nuevo**: esta corrida se consumió adoptando lo que había en disco, así que **no agregó
  funcionalidad nueva**. La próxima arranca con el catálogo en 200 y el disco limpio: contrastar
  igual antes de empezar, pero contando con encarar un lote propio.
- **`personal`**: falta el **parte mensual imprimible** por empleado (las horas ya están, es la
  vista), **feriados y ausencias** (hoy sólo hay fichajes: no hay forma de anotar una licencia) y,
  con `roles` activo, que el encargado vea **sólo la gente de su sucursal**. El fichaje no tiene
  ninguna verificación de presencia: un **PIN por persona** o el QR de `qr` en la puerta sería el
  siguiente escalón sin salir de lo gratuito.
- **`trabajo`**: falta **tareas recurrentes** ("limpiar la heladera todos los lunes"), que con
  `tareas` activo es un trabajo diario más; **adjuntar un archivo** vía `uploads`; y avisarle por
  email al responsable cuando se le asigna algo (`mailer.notifyTo` ya existe). Las subtareas y el
  filtro por rango de fechas son el pedido obvio siguiente.
- **`tablero`**: los indicadores son **de todo el negocio**: falta poder **comparar dos períodos
  elegidos a mano** y filtrar por sucursal con `branches` activo. Un **objetivo por indicador**
  ("quiero facturar X este mes") convertiría el panel en algo accionable en vez de descriptivo.
  Falta también exportar la serie a CSV, que ya es la convención de todos los paneles.
- **`vencimientos`**: falta el **aviso antes de que venza** (con `tareas` + `mailer` es un trabajo
  diario que manda el resumen de la semana), **adjuntar el comprobante** vía `uploads`, y
  **pagos parciales** (hoy es todo o nada, igual que la recepción de `compras`). Con `compras`
  activo, una orden recibida podría **generar el vencimiento** de lo que hay que pagarle al
  proveedor, cerrando el circuito.
- **`presupuestador`**: falta **convertir la cotización en presupuesto formal** con `quotesadmin` o
  en comprobante con `invoices` (hoy la cotización muere en la bandeja), **conceptos dependientes**
  (que elegir A muestre B), y descuento por volumen. Con `firma` activo, que el cliente **acepte el
  presupuesto firmando** sería el cierre natural del circuito y ya está todo lo necesario.
- **Pendientes que siguen abiertos** (de la 34ª y anteriores): permisos por sucursal y navbar
  filtrado en `roles`; enlace por email, recordatorio, constancia descargable y **más de un
  firmante** en `firma`; **recepción parcial** y costo promedio en `compras`; límite de crédito y
  resumen imprimible en `ctacte`; **actualizar filas** y CSV en Latin-1 en `importar`; sitemap
  dinámico en `seoadmin`; métricas móvil/escritorio en `salud`; ventana deslizante del `escudo` en
  la base; hora elegible en `tareas`; diff antes/después en `auditoria`.
- **Molde ABM público+admin**: con estos 5 son ~35 los módulos que repiten el molde. El helper
  compartido (`adminPanel({...})`) sugerido desde la 19ª sigue siendo el refactor más rentable del
  proyecto y ya amerita una corrida propia sin módulos nuevos — es, probablemente, lo más valioso
  que se puede hacer ahora que el catálogo llegó a 200.
- **Hook de impeccable**: sigue comparando las **generadas** contra el DESIGN.md del **Builder**.
  Darle un sidecar propio (o excluirlas) es cada vez más urgente: ya son 5 corridas seguidas
  anotando los mismos falsos positivos.

## Corrida 2026-07-21 (34ª)

Lote de **5 módulos funcionales con backend real**, todos nuevos. El hilo es **el negocio por
dentro**: hasta ahora el catálogo sabía construir un sitio comercial completo y sostenerlo después
de publicarlo (33ª), pero seguía suponiendo que del otro lado hay **una sola persona que es dueña de
todo** — un único admin que ve la caja, los sueldos y los pedidos, que carga cada dato a mano y que
cierra los tratos de palabra. Los cinco módulos atacan eso: quién puede hacer qué (`roles`), cómo se
deja constancia de lo acordado (`firma`), qué le compro a mis proveedores (`compras`), qué me deben
mis clientes (`ctacte`) y cómo entran los datos que ya tenía en una planilla (`importar`). El
detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `roles` | **Roles y permisos** (`usesAnime`, middleware, requiere auth): el pedido más repetido de cualquier negocio con empleados —"que la recepcionista cargue turnos pero no vea la caja"— y el que no se podía dar, porque los roles estaban horneados en dos (`admin` ve todo / `user` no ve nada). Se resuelve **sin tocar los otros 94 módulos**: un middleware mira cada pedido a `/api/…`, resuelve el **área** por el prefijo de la ruta y corta con 403, distinguiendo consultar (GET) de modificar. El mapa de áreas **se arma al generar** con las rutas y los nombres reales de los módulos activos, así que un módulo nuevo entra solo. Dos modos por rol: **abierto** (puede todo salvo lo que se le saca) y **cerrado** (no puede nada salvo lo que se le da). La puerta está en el servidor, no en la pantalla: da igual si alguien escribe la URL a mano o llama la API con `curl`. Tres defensas contra dejarse afuera: el admin **siempre** pasa, quien no tiene rol asignado se comporta **exactamente como antes** (activarlo no rompe ningún proyecto existente) y nadie puede cambiarse el rol a sí mismo. Un rol **restringe, nunca otorga**: las rutas que ya exigían admin lo siguen exigiendo |
| `firma` | **Firma de documentos** (`usesAnime`, público con token): el trámite que hoy se resuelve mandando un PDF y esperando que vuelva escaneado. El negocio redacta el texto, el sistema devuelve un **enlace único** y quien lo recibe entra **sin cuenta** a `/firmar.html?t=…`, lee y **firma con el dedo o el mouse** sobre un lienzo. Lo que hace que la firma valga algo no es el dibujo sino la **constancia**: huella **SHA-256 del texto exacto que se mostró** más fecha, IP y navegador, y un sello que ata huella + nombre + momento. Si mañana alguien edita el documento, la huella deja de coincidir y se nota. El enlace es **de un solo uso**, anulable antes de que firmen y con vencimiento a 30 días; un documento firmado **no se borra ni se anula**, porque es la prueba |
| `compras` | **Proveedores y órdenes de compra** (`usesAnime`, requiere auth): el catálogo sabía todo sobre lo que **entra** (ventas, pedidos, caja) y nada sobre lo que **sale**. Libreta de proveedores y órdenes con renglones cuyo **total lo calcula siempre el servidor** (se probó mandando un total falso: lo descarta). Circuito validado borrador → enviada → recibida, anulable desde las dos primeras, y **lo recibido queda sellado** (409 al tocarlo o borrarlo). La integración fuerte: con `inventory` activo, marcar la orden como recibida **genera los movimientos de entrada de stock** en la sucursal elegida — el depósito se actualiza solo y deja de haber dos verdades. Los renglones sin producto del catálogo (un flete) no tocan stock |
| `ctacte` | **Cuenta corriente de clientes** (`usesAnime`, requiere auth): el "fiado" de toda la vida. Había cómo cobrar (POS, carrito, caja) pero no cómo llevar **lo que quedó debiendo**. El saldo **nunca se guarda**: lo calcula el servidor sumando cargos y restando pagos, el mismo criterio con el que `inventory` deriva el stock de los movimientos, así que no puede desincronizarse ni editarse por afuera. Los movimientos viejos **no se editan**: para corregir se registra el contrario, que es como se lleva una cuenta de verdad. Con `caja` activo, cada **pago entra como ingreso del día** respetando el cierre (si el día ya cerró, el pago se registra igual en la cuenta y avisa que no tocó la caja); con `clientes`, la cuenta se abre desde una ficha del CRM. La cuenta se identifica por email, así que dos homónimos no se mezclan |
| `importar` | **Importar datos (CSV)** (`usesAnime`, requiere auth): el catálogo entero sabía **exportar** (casi todos los paneles tienen su botón de CSV) y no sabía **importar**, con lo que cada cliente que ya tenía sus datos en una planilla los cargaba a mano el primer día. Funciona sobre **cualquier colección** del proyecto: el servidor las lista con los campos que ya usan, parsea el CSV con un parser propio (comillas, `""` escapado, **saltos de línea dentro de una celda** y separador `;` o `,` detectado solo), **previsualiza sin escribir nada** y recién al confirmar inserta. Mapeo de columna → campo, deduplicación opcional y conversión automática de números y sí/no. Tres protecciones no opcionales: **colecciones vedadas** (usuarios, roles y firmas **nunca** se importan: serían una vía directa para crearse un admin o fabricar una firma), tope de filas y tope de tamaño |

Todo probado: registro (**100 UI · 95 funcionales = 195 módulos**), 4 variantes generadas
(lote = 55 archivos / 31 JS; sin-auth = 16 / 8; Vercel+Supabase = 39 / 20 con las **5 colecciones
nuevas** en `schema.sql`; **y el proyecto con los 195 módulos a la vez** = 272 archivos, 136 JS,
**7 middlewares conviviendo**), syntax-check de los 195 JS emitidos (**0 errores**) y **0 emojis** en
el HTML renderizado. **Prueba de backend real** en Express 5: **90 asserts en verde** — el portero
cortando por área y por método con su mensaje propio, el modo abierto y el cerrado, el admin pasando
siempre, el visitante sin sesión intacto, borrar un rol liberando a quien lo tenía, la huella
SHA-256 coincidiendo con el texto, el enlace de firma de un solo uso, el documento firmado que no se
borra, el total de la orden **descartando el que manda el cliente**, la transición inválida
rechazada, el stock entrando solo al recibir, el saldo corrido de la cuenta, el pago espejado en la
caja y la caja cerrada avisando, el CSV con `;` adentro de comillas y salto de línea adentro de una
celda, y la colección vedada rechazada aunque se la pida a mano. Más **17 asserts** de las variantes
sin-auth y catálogo completo. **Smoke test en navegador real**: cero errores de consola; rol creado,
permiso quitado y asignado **enteramente por UI**, con la empleada recibiendo *"Tu rol (Recepción) no
tiene acceso a Caja diaria"* desde una sesión real; documento emitido y **firmado con trazo real de
puntero** sobre el lienzo (3.993 píxeles dibujados) con la constancia mostrando la misma huella que
el panel; orden de compra armada renglón por renglón con el total en vivo y **10 unidades entrando al
inventario** al recibirla; cuenta corriente con su saldo corrido y el pago espejado en la caja; y CSV
importado al CRM con los campos correctos. La **red de seguridad de Anime.js** verificada con
`visibilityState: hidden`: los KPIs quedan en su valor final igual.

**Un bug de usabilidad encontrado por la prueba en navegador y corregido**: en `importar`, el mapeo
de columnas era un `<select>` cerrado que sólo ofrecía los campos **ya existentes** en la colección.
En una colección **vacía** —que es justo el caso del primer día, el que el módulo existe para
resolver— no hay campos conocidos, así que la única opción era el encabezado del CSV: importar
"nombre" a `customers` creaba un campo `nombre` que el CRM no muestra. Pasó a ser un **campo de texto
con sugerencias** (`<input list=…>`): sugiere lo conocido y deja escribir lo que haga falta. El
selector de deduplicación se rearma solo con lo que se va escribiendo. Sin módulos revertidos.

**Falsos positivos del hook de impeccable** (ya anotados como pendiente desde la pasada de diseño):
los 5 módulos disparan avisos de `design-system-color`, `design-system-font-size` y `side-tab`. Son
los mismos valores que ya usan los 190 módulos previos (`#2e9e5b20`/`#1d6b3c` para estado correcto,
`#c0392b` para el negativo, `.72rem` para los chips, el borde izquierdo de los avisos tipo
`.tar-cron`/`.wr-nota`). El hook compara el CSS de las **generadas** contra el DESIGN.md del
**Builder**: cambiarlos rompería la coherencia del catálogo, así que quedaron como están.

### Pendiente / sugerencias para la próxima corrida

- **`roles`**: el mapa `AREAS` se hornea al generar, así que un módulo agregado **a mano** después
  no queda regulado hasta editar los dos arreglos (el del middleware y el del router). Convendría
  derivarlo en runtime de los `app.use` montados. Faltan además: **permisos por sucursal** (con
  `branches` activo, "esta persona sólo ve su local"), y que el panel **oculte del navbar** los
  links de las áreas sin acceso — hoy el corte es del servidor y el link sigue a la vista, que es
  seguro pero confuso.
- **`firma`**: falta mandar el enlace por email solo (con `mailer` activo ya está el helper) y el
  **recordatorio** al que no firmó (con `tareas`, sería un trabajo diario más). Falta también
  **descargar la constancia** como archivo imprimible y permitir **más de un firmante** por
  documento (hoy es uno solo), que es lo que pide cualquier contrato entre dos partes.
- **`compras`**: no hay **recepción parcial** (llegaron 6 de 10), que es el caso más común de una
  orden real; hoy es todo o nada. Falta el **costo promedio** por producto (con las órdenes
  recibidas ya está el dato) y, con `ctacte` activo, llevar también la **cuenta corriente del
  proveedor** —lo que yo le debo— reusando exactamente la misma mecánica de saldo.
- **`ctacte`**: falta el **límite de crédito** por cliente (avisar al pasarse) y el **resumen de
  cuenta imprimible** para mandarle al cliente. Con `perfil` o `clientportal` activos, que la
  persona **vea su propio saldo** sin pedirlo es el salto natural, y con `invoices` cada cargo
  podría nacer de un comprobante en vez de tipearse.
- **`importar`**: falta **actualizar** las filas existentes en vez de sólo insertar (hoy el campo de
  deduplicación saltea, no pisa), un **modo de prueba** que informe qué pasaría sin escribir, y
  soportar el **CSV con acentos en Latin-1** que exporta el Excel viejo (hoy se asume UTF-8 y los
  acentos entran rotos). Sería útil además ofrecer los **nombres de campo conocidos por colección**
  aunque esté vacía, horneando un mapa al generar a partir de los modelos de cada módulo.

## Corrida 2026-07-21 (33ª)

Lote de **5 módulos funcionales con backend real**: **4 nuevos** más el **rescate de `qr`**, que una
sesión cortada de esta misma madrugada (archivos de 02:15–02:19) había dejado escrito sin probar ni
documentar — el mismo caso que la 30ª, y la razón por la que conviene arrancar cada corrida
contrastando el disco contra esta bitácora. El hilo de los cuatro nuevos es **lo que le pasa al
sitio después de publicarlo**: hasta ahora el catálogo sabía construir un sitio comercial completo,
pero no tenía nada para lo que viene después — que Google lo muestre bien, que cumpla la ley, que
avise cuando se rompe y que se pueda vender afuera. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `seoadmin` | **SEO administrable** (`usesAnime`, middleware, requiere auth): el título y la descripción que muestra Google dejan de estar horneados. Un middleware **reescribe el `<head>` antes de servir la página**, no con JavaScript en el navegador: el buscador y las vistas previas de WhatsApp y LinkedIn leen el HTML tal como llega, y un título puesto después de cargar **no lo ve ninguno de los tres**. Sólo se tocan las metas que administra el módulo; si la ficha está vacía, la página se sirve **byte a byte** como está en disco. Incluye **redirecciones 301** con contador de usos (los `utm_` viajan al destino) y robots.txt editable. Las páginas de trastienda arrancan con **noindex** |
| `privacidad` | **Centro de privacidad** (`usesAnime`, público sin auth): el consentimiento deja de vivir sólo en el navegador del visitante —donde no le sirve a nadie si mañana hay un reclamo— y queda **registrado en el servidor** con fecha y versión de la política, revocable desde `/privacidad.html`. Convive con el módulo `cookies` sin tocarlo (escucha su clic) y pone su propio cartel si no está. Las **solicitudes del titular** (acceso, rectificación, eliminación, oposición) llevan código de seguimiento y **plazo legal de 10 días corriendo**. "Buscar sus datos" recorre **todas las colecciones del proyecto** (cualquier módulo futuro queda cubierto solo) y "anonimizar" limpia el dato personal **sin borrar la fila**: el pedido facturado tiene que seguir existiendo |
| `salud` | **Monitor de salud del sitio** (`usesAnime`, middleware, requiere auth): las tres cosas que no se ven hasta que un cliente se queja. **Core Web Vitals de visitas reales** (LCP, CLS, INP con `PerformanceObserver`, enviadas con `sendBeacon` al ocultarse la pestaña), **errores de JavaScript** del visitante agrupados —uno que le pasa a 400 personas es una fila con 400 usos, y si se marca resuelto y vuelve a pasar **se reabre solo**— y **404 reales** contados mirando el estado de la respuesta, no adivinando si el archivo existe. Con `seoadmin`, el botón "Redirigir" arregla el enlace roto ahí mismo. **No guarda IP ni identificador**, y con `privacidad` activo no mide nada si la persona rechazó |
| `traducciones` | **Multiidioma administrable** (`usesAnime`, requiere auth): la evolución del módulo UI `i18n`, cuyo diccionario ES→EN está horneado. Acá los idiomas son datos y la pieza que lo hace usable es la **detección**: el sitio le avisa al servidor qué frases mostró, así el panel lista lo que realmente hay que traducir en vez de obligar a copiarlas a mano. Una sola visita a la Home dejó **36 frases** listas. No detecta lo invisible ni las páginas de trastienda. Un idioma **arranca sin publicar** a propósito |
| `qr` | **Códigos QR** (`usesAnime`, requiere auth, **adoptado**): encoder propio completo de la norma ISO/IEC 18004 en `src/qrcode.js` (modo byte, versiones 1 a 10, L/M/Q/H y las 8 máscaras). **Contrastado contra el paquete `qrcode` de npm**: 15 de 16 casos dan matrices idénticas y el único distinto elige otra máscara del mismo tamaño (forzando la de referencia, coinciden exactamente). Los códigos de página pasan por `/q/<nombre>`, que **redirige 302** y cuenta escaneos por día y dispositivo, así que el destino se cambia **sin volver a imprimir**. Cierra el pendiente de QR anotado en la 32ª |

Todo probado: registro (**100 UI · 90 funcionales = 190 módulos**), 4 variantes generadas
(full = 56 archivos / 32 JS; sin-auth = 16 / 8; Vercel+Supabase = 44 / 23 con las **13 colecciones
nuevas** en `schema.sql`; **y el proyecto con los 190 módulos activos a la vez** = 260 archivos,
130 JS, **6 middlewares conviviendo**), syntax-check de los 193 JS (**0 errores**).
**Prueba de backend real** en Express 5 (:4980): **84 asserts en verde** — el HTML servido idéntico
al archivo cuando no hay metas cargadas y reescrito cuando sí (sin dejar dos descripciones), la
redirección 301 con passthrough de `utm_` y su contador, el bucle y el duplicado rechazados, el
consentimiento cambiado por el mismo navegador, la búsqueda de datos en todas las colecciones y la
anonimización que **deja viva la reserva sin datos personales**, los umbrales de Google
clasificando visitas, el error que **se reabre solo**, el 404 arreglado desde el panel de salud, y
el diccionario que sólo entrega lo traducido. Más **9 asserts sin-auth** (:4981) y **10 con el
catálogo completo** (:4982). **Smoke test en navegador real**: cero errores de consola; edición de
metas por UI reflejada al instante en el HTML servido; clic en el cartel de cookies **registrado en
el servidor**; un **error de JavaScript real capturado y reportado**; solicitud de privacidad creada
y consultada por código; idioma agregado, traducido y publicado por UI con **la Home cambiando de
idioma** y volviendo; y la comprobación de que **con el rechazo puesto, `salud` no reporta nada**.
**Un bug de UX encontrado por la prueba en navegador y corregido**: en `traducciones`, guardar una
frase redibujaba la lista entera y borraba lo tipeado y sin guardar en las demás — quien traduce
escribe varias seguidas. Sin módulos revertidos.

### Pendiente / sugerencias para la próxima corrida

- **`seoadmin`**: el `sitemap.xml` sigue siendo el archivo estático del módulo `seo` (se genera una
  vez y no conoce las páginas dinámicas: artículos del blog, avisos, cursos). Servirlo desde el
  middleware con las fuentes activas —el mismo truco que usa `sitesearch`— es el próximo salto
  natural, y de paso permite excluir las páginas marcadas con noindex. Faltan además: redirecciones
  por **prefijo** (`/blog/* → /novedades/*`, hoy sólo exacta), y un aviso cuando dos redirecciones
  encadenan (A→B→C: Google penaliza los saltos).
- **`privacidad`**: la anonimización es todo o nada; convendría **previsualizar qué campos** van a
  cambiar antes de confirmar. Falta el email automático al titular cuando su solicitud se resuelve
  (`mailer.notifyTo` ya existe) y una **política de retención** ("borrar consentimientos con más de
  N años"). Con `perfil` activo, el botón "descargá tus datos" del usuario podría reusar la misma
  búsqueda por colecciones.
- **`salud`**: las métricas no distinguen **móvil de escritorio**, que es justamente donde se ve el
  problema (un sitio que carga bien en la oficina y mal en la calle); es un campo más en la fila.
  Falta también un **aviso** cuando aparece un error nuevo (con `notifcentro` sería una fuente más)
  y limpieza automática de las filas viejas de `vitals` (crecen una por día/métrica/ruta).
- **`traducciones`**: no traduce el contenido que llega por API (productos, artículos), que es el
  pedido siguiente obvio; el camino es un modo "traducir este campo" por colección. Faltan también:
  **importar el CSV** que ya se exporta (para mandarlo a traducir afuera y volver a subirlo), el
  `<html lang>` correcto en el HTML servido (hoy lo pone el navegador; con `seoadmin` podría venir
  ya escrito) y traducir los `placeholder` y los `alt`, que hoy quedan en español.
- **`qr`**: falta el QR **por sucursal** si `branches` está activo, usar `negocio.domain` para
  mostrar el enlace con el dominio real, y códigos de tipo vCard/teléfono con un armador de campos
  en vez de pedir el texto crudo.
- **Pendientes de la 32ª que siguen abiertos**: ventana deslizante del `escudo` en la base (en
  serverless cada instancia cuenta aparte) y su modo "sólo observar"; hora y frecuencia elegibles en
  `tareas` + copia automática con `respaldo`; diff antes/después en `auditoria`; cerrar sesión en
  todos los dispositivos en `perfil` (necesita `tokenVersion` en `auth`).
- **Email al cliente**: sigue faltando el código de turno/reserva/pedido al cliente en `agenda`,
  `reservamesa`, `alquileres`, `cart` y `ordertrack`.
- **Molde ABM público+admin**: con este lote son ~30 los módulos que repiten el molde; el helper
  compartido (`adminPanel({...})`) sugerido desde la 19ª sigue siendo el refactor más rentable y ya
  amerita una corrida propia sin módulos nuevos.
- **Hook de impeccable**: sigue comparando el CSS de las **generadas** contra el DESIGN.md del
  **Builder** y reportó ~25 falsos positivos en este lote (los colores de estado `#2e9e5b`/`#c0392b`
  y el borde de acento son la convención del catálogo desde hace 20 corridas). Darle un sidecar
  propio a las generadas es cada vez más urgente.
- **Nota de entorno**: en el panel de navegador de estas corridas la pestaña corre **oculta**, así
  que el navegador **no emite LCP** (por especificación, una página que nunca se vio no tiene
  "contenido más grande pintado"). Las métricas de `salud` se probaron por API y los errores en el
  navegador real; para verlas de punta a punta hace falta una pestaña visible.

## Corrida 2026-07-21 (32ª)

Lote de **5 módulos funcionales, todos con backend real**. El hilo de esta corrida es la
**infraestructura que faltaba para que el sitio se defienda y se opere solo**: hasta ahora cada
módulo se protegía del spam por su cuenta (o no se protegía), no existía forma de correr nada una
vez por día —pendiente arrastrado desde la 30ª— y no había manera de saber quién había tocado qué.
Los completan dos piezas que cualquier cliente pide. Se cierra el **pendiente del contrato
`middlewares`** anotado en la 31ª. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `escudo` | **Escudo anti-spam** (`usesAnime`, middleware): protege **de una sola vez todos los formularios del catálogo**, sin tocar una línea de los otros módulos. Tres defensas sobre los `POST/PUT/PATCH/DELETE` de `/api`: **ráfaga por IP** con ventana deslizante (**429 + Retry-After**), **contenido** (palabras bloqueadas con acentos plegados y tope de enlaces, 422) y **lista de IPs** a mano (403). Los campos de contraseña **nunca se inspeccionan** y el **admin queda exento** (un panel hace ráfagas legítimas). No es reCAPTCHA: no le pide nada a terceros ni molesta al visitante honesto. Panel con KPIs por motivo, límites editables en vivo y registro de lo frenado |
| `tareas` | **Tareas programadas** (`usesAnime`, middleware): el **disparador diario** que venían pidiendo `cumples`, `agenda`, `recuperar` y `promos`. Sin cron externo: el primer pedido del día lanza los pendientes **en segundo plano**; y con `CRON_SECRET` se engancha a un cron real (**503 si la clave no está**, nunca queda abierto por olvido). Los 6 trabajos se generan **según los módulos activos** y son **idempotentes por día**. `cumples-saludo` le escribe **al cliente** con `notifyTo` |
| `auditoria` | **Registro de auditoría** (`usesAnime`, middleware, requiere auth): quién hizo qué y cuándo en la trastienda. Observa las escrituras **con sesión iniciada** y anota al terminar la respuesta, así queda el **status real** — incluidos los **intentos rechazados**. La tabla ruta → nombre del módulo se arma **al generar** desde el registro, con lo que **cualquier módulo futuro queda auditado solo**. Panel con filtros armados con lo que hay registrado, CSV y purga con `?dias=` obligatorio |
| `enlaces` | **Enlaces cortos** (`usesAnime`, requiere auth): el acortador propio, `midominio.com/l/promo` con **302 real** y clics contados. Serie completa de **14 días** (con ceros: un gráfico que omite días vacíos miente) y origen por **dominio** del referente, nunca la URL entera. Los parámetros de la visita **viajan al destino** (las `utm_*` siguen llegando). Pausa y vencimiento por fecha; el slug **no se edita** a propósito (rompería lo ya repartido) |
| `perfil` | **Mi perfil** (`usesAnime`, requiere auth): la gestión de cuenta que le faltaba a `auth`. Editar datos, **cambiar el email de acceso** y **la contraseña** (ambas exigen la clave actual: tener la sesión abierta no alcanza para robar una cuenta) y **darse de baja**. Como el JWT lleva nombre/email/rol adentro, **cada cambio devuelve un token nuevo**. El **último administrador no se puede borrar** |

Todo probado: registro (**100 UI · 85 funcionales = 185 módulos**), 3 variantes generadas
(full = 55 archivos / 31 JS; sin-auth = 22 / 14; Vercel+Supabase = 47 / 27 con las **7 colecciones
nuevas** en `schema.sql`) **más el proyecto con los 185 módulos activos a la vez** (245 archivos,
121 JS, **4 middlewares conviviendo**), syntax-check de los 193 JS (**0 errores**), 0 emojis.
**Prueba de backend real** en Express 5 (:4990): **97 asserts en verde** — las 3 defensas del escudo
con sus contadores y la exención del admin (6 altas seguidas con el límite en 3), la contraseña que
**no** pasa por el filtro de palabras, los 6 trabajos con idempotencia verificada (correr el saludo
dos veces no vuelve a saludar) y las tres vías de disparo, la auditoría registrando lo rechazado e
**ignorando lo anónimo**, la redirección 302 con passthrough de query y conteo por origen, y el
ciclo completo de `perfil` (email viejo que deja de entrar, clave vieja que deja de entrar, último
admin protegido con 409). Más **11 asserts sin-auth** (:4989). **Smoke test en navegador real**:
5 paneles con **cero errores de consola**, `anime` y `Motion` conviviendo, IP bloqueada y
desbloqueada por UI, trabajo apagado/encendido por UI, enlace creado por UI con sus clics contados y
sus 14 barras animadas, y la auditoría capturando **esa misma alta hecha desde el navegador**.
**Un bug encontrado por los tests y corregido**: `db.insert(...).catch is not a function` — el
driver JSON inserta **síncrono** y el de Supabase devuelve promesa; como la auditoría anota en un
callback de evento (sin `await` posible), la llamada va envuelta en `Promise.resolve(...)`. Tiraba
abajo el servidor en la primera escritura admin. Sin módulos revertidos.

### Pendiente / sugerencias para la próxima corrida

- **`escudo`**: la ventana deslizante vive **en memoria**, así que en serverless (Vercel) cada
  instancia lleva su propia cuenta y el límite efectivo se multiplica; llevarla a la base (o a un
  contador por IP con TTL) daría un límite exacto. Falta también un **modo "sólo observar"** (contar
  sin bloquear, para calibrar el límite antes de encenderlo) y desbloqueo automático a las N horas.
- **`tareas`**: los trabajos son fijos por módulo; el salto natural es **elegir la hora** de cada uno
  (hoy corren todos con el primer pedido del día) y permitir frecuencias distintas (semanal,
  mensual — un "cerrá la caja del mes"). Con `respaldo` activo, un trabajo de **copia automática**
  cierra el pendiente de la 29ª. Y `campanas` podría programar un envío a futuro.
- **`auditoria`**: registra el **qué** pero no el **antes/después**; guardar un diff del cuerpo en
  las ediciones (salteando contraseñas, como ya hace el escudo) sería el salto de valor grande.
  También convendría un filtro por rango de fechas exacto y, si crece mucho, paginado real.
- **`enlaces`**: falta el **QR descargable** del enlace corto (es lo primero que va a pedir un
  restaurante para la carta): necesita un generador de QR propio en SVG, sin servicios de terceros —
  amerita su propia corrida por el tamaño del encoder. Después: enlace por sucursal si `branches`
  está activo, y usar `negocio.domain` para mostrar el link con el dominio real en vez de `origin`.
- **`perfil`**: no hay **cerrar sesión en todos los dispositivos** (el JWT no tiene `jti` ni versión;
  agregar `tokenVersion` al usuario y al payload lo resolvería, pero toca `auth`). La baja de cuenta
  borra el usuario pero **no** sus datos en otros módulos: falta una exportación "descargá tus datos"
  y una limpieza opcional. Con `uploads` activo, una foto de perfil sería natural.
- **Email al cliente, tercera parte**: con `cumples-saludo` ya son 3 los módulos que le escriben al
  cliente (`recuperar`, `clientes`, `tareas`). Sigue faltando el código de turno/reserva/pedido al
  cliente en `agenda`, `reservamesa`, `alquileres`, `cart` y `ordertrack`.
- **Molde ABM público+admin**: con este lote son ~27 los módulos que repiten el molde; el helper
  compartido (`adminPanel({...})`) sugerido desde la 19ª sigue siendo el refactor más rentable y ya
  amerita una corrida propia sin módulos nuevos.
- **Hook de impeccable**: sigue comparando el CSS de las **generadas** contra el DESIGN.md del
  **Builder**, así que reportó ~30 falsos positivos en este lote (los colores de estado
  `#2e9e5b`/`#c0392b` y el borde de acento son la convención del catálogo desde hace 20 corridas).
  Darle un sidecar propio a las generadas es cada vez más urgente.
- **Pendientes que siguen abiertos**: imagen de `banners` vía `uploads` y reordenar campos en
  `formularios`; recordatorio de seguimiento en `clientes`; lista de IPs y ventana programada en
  `mantenimiento`; contador de aperturas de `campanas`; seña de `alquileres` vía `pagoinformado`;
  arqueo de `caja`; snippet `<mark>` y anclas `?a=`/`?item=` en `sitesearch`; migrar los buscadores
  viejos a `fold()`; picker de `uploads` en formularios con URL; CV de `vacantes` vía `uploads`;
  numeración correlativa en `invoices`; cupo por día/feriado en `reservamesa`; staff/servicios de
  `agenda` como colección; filtrar horarios pasados en `agenda`.

## Corrida 2026-07-21 (31ª)

Lote de **5 módulos funcionales, todos con backend real**, elegidos por lo que le faltaba al catálogo
para cubrir un **sitio comercial completo** más que por sumar verticales nuevos. Dos cambios de
infraestructura acompañan al lote: el generador ahora acepta **middlewares de módulo** (montados
antes de los estáticos) y el mailer sabe escribirle **al cliente** y no sólo al negocio — con lo que
se cierra el **pendiente nº 1 de la 30ª**. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `banners` | **Banner rotativo** (`usesAnime`): la franja del encabezado deja de estar horneada y pasa a ser un dato. El server devuelve **sólo los publicados y vigentes** ya ordenados (un banner de temporada se apaga solo) y cuenta **vistas y clics**: el panel muestra el **CTR real por slide**. ABM con reordenamiento, vigencia desde/hasta e imagen por URL validada (**nunca `javascript:`**). Rotación con fundido cruzado, pausa al hover y puntos |
| `formularios` | **Formularios a medida** (`usesAnime`): el negocio arma sus propios formularios (8 tipos de campo) y los publica en `/formularios.html?f=<slug>`. **La definición es el dato**: el servidor valida cada respuesta contra ella (obligatorios, tipo, largo, opciones), nunca contra el HTML del navegador. Slug estable al editar, nombres técnicos desambiguados, **honeypot** anti-bots sin captcha y bandeja por formulario con CSV |
| `clientes` | **Ficha de clientes / CRM liviano** (`usesAnime`, requiere auth): la libreta que faltaba. Estado de seguimiento (nuevo → contactado → cliente / perdido), **bitácora de notas fechadas y firmadas**, embudo en KPIs, búsqueda **server-side sin acentos** e **importación sin duplicados** desde `leads`, `newsletter` y `contact`. Con `mailer`, se le escribe al cliente desde su ficha y queda anotado |
| `recuperar` | **Recuperar contraseña** (`usesAnime`, requiere auth + mailer): el "olvidé mi contraseña" que le faltaba a `auth`. Token de 32 bytes, **un solo uso, 60 min**, cada pedido invalida los anteriores. Respuesta **indistinguible** exista o no el email (no se enumeran usuarios). El link va **por email al usuario**; sin clave de envío queda en la bandeja de salida, así que **no depende de ninguna API key**. El link se inyecta en el login sin tocar `auth` |
| `mantenimiento` | **Modo mantenimiento** (`usesAnime`, **primer módulo con `middlewares`**): baja el sitio de verdad — **503 + `Retry-After`** con pantalla propia autocontenida, así que también intercepta el HTML (nadie se saltea el aviso apagando JS) y Google no desindexa. Link de acceso con clave rotable (cookie 24 h) para que el admin siga navegando; login y panel **nunca se bloquean**. Cuenta las visitas frenadas |

Todo probado: registro (**100 UI · 80 funcionales = 180 módulos**), 3 variantes generadas
(full = 230 archivos / 109 JS; sin-auth = 19 / 10; Vercel+Supabase = 43 / 21 con las **6 colecciones
nuevas** en `schema.sql`), syntax-check de los 109 JS (**0 errores**), 0 emojis en el output.
**Prueba de backend real** en Express 5 (:4996): **91 asserts en verde** — incluidos el filtro por
vigencia y el CTR de `banners`, las 5 formas de respuesta inválida de `formularios` más el honeypot,
el merge y la importación sin duplicados de `clientes`, el ciclo completo de `recuperar` (token de un
solo uso, invalidación en cadena, la clave vieja que deja de entrar) y el de `mantenimiento` (cookie
de acceso, cookie robada rechazada, rotación que invalida las viejas). Más **9 asserts sin-auth**
(:4995). **Smoke test en navegador real**: respuesta a un formulario a medida enviada por UI y
verificada en disco, banner rotando, ficha del CRM con su bitácora, interruptor de mantenimiento
bajando y publicando el sitio por UI (503 ↔ 200); **cero errores de consola**. **Dos bugs
encontrados por los tests y corregidos**: en `formularios`, `POST /:slug` tapaba `POST /admin` (las
rutas con `:slug` se movieron al final del router); en `clientes`, el alta idempotente pisaba con
vacío el teléfono y la empresa ya cargados. Sin módulos revertidos.

### Pendiente / sugerencias para la próxima corrida

- **Email al cliente, segunda mitad**: `mailer.notifyTo()` ya existe y `recuperar`/`clientes` lo
  usan, pero los **13 módulos de avisos siguen escribiéndole sólo al negocio**. El salto natural es
  mandarle al cliente su código de turno/reserva/pedido cuando lo genera (`agenda`, `reservamesa`,
  `alquileres`, `cart`, `ordertrack`) y avisarle a `pagoinformado` cuando le aprueban el pago.
- **`banners`**: imagen vía `uploads` en vez de URL a mano (hoy hay que pegar el enlace); un slide
  por sucursal si `branches` está activo; y las vistas se cuentan con un `db.update` por slide por
  request — con mucho tráfico conviene acumular en memoria y bajar cada N.
- **`formularios`**: falta **reordenar los campos** (hoy se borran y se vuelven a cargar), duplicar
  un formulario, y adjuntar archivos vía `uploads`. Integrarlo con `clientes` (que cada respuesta con
  email cree o actualice la ficha) sería la conexión más rentable del lote.
- **`clientes`**: recordatorio de seguimiento ("volver a contactar el …") — necesita el mismo
  disparador diario que pide `cumples`; importar desde `quotesadmin` y `tickets`; y un campo de
  valor/monto para medir el embudo en plata, no sólo en cantidad.
- **`mantenimiento`**: una **lista de IPs permitidas** además de la cookie, y programar la ventana
  (bajar y volver a subir solo entre dos horarios) — hoy es manual en las dos puntas.
- **Contrato `middlewares`**: ahora que existe, el candidato obvio es un módulo de **rate limiting +
  anti-spam** para todos los POST públicos del sitio (hoy cada módulo se defiende solo, y sólo
  `formularios` tiene honeypot).
- **Molde ABM público+admin**: con este lote son ~25 los módulos que repiten el molde; el helper
  compartido (`adminPanel({...})`) sugerido desde la 19ª sigue siendo el refactor más rentable.
- **Pendientes que siguen abiertos**: saludo automático de `cumples` y contador de aperturas de
  `campanas` (ambos necesitan disparador diario); seña de `alquileres` vía `pagoinformado`; arqueo
  de `caja`; snippet `<mark>` y anclas `?a=`/`?item=` en `sitesearch`; migrar los buscadores viejos a
  `fold()`; picker de `uploads` en formularios con URL; CV de `vacantes` vía `uploads`; numeración
  correlativa en `invoices`; cupo por día/feriado en `reservamesa`; staff/servicios de `agenda` como
  colección; filtrar horarios pasados en `agenda`.

## Corrida 2026-07-20 (30ª)

Lote de **5 módulos funcionales, todos con backend real**. Particularidad de esta corrida: una
sesión anterior del mismo día dejó **4 módulos escritos pero sin probar y sin bitácora**
(`alquileres`, `pagoinformado`, `campanas`, `caja`, archivos de 15:15–15:20; la sesión se cortó
ahí). Esta corrida los **adoptó**: revisión contra el patrón de la casa, suite completa de tests y
documentación retroactiva en [CAMBIOS.md](CAMBIOS.md). El módulo propio de la corrida es
`cumples` (club de cumpleaños). Además se cerró el **pendiente nº 1 de la 29ª**: el hook de
avisos por email ahora está en 7 módulos más (`tickets`, `quote`, `returns`, `agenda`,
`reservamesa`, `pedidoscarta`, `cart`) — con lo que **13 módulos avisan al negocio** — y
`videos` + `alquileres` entraron como fuentes del buscador global (la línea anotada en la 29ª).

| Módulo | Nota |
|---|---|
| `alquileres` | **Alquileres por día** (`usesAnime`, adoptado): `/alquileres.html` con recursos del backend (cabañas, salones, canchas); reserva por rango con **solapamiento controlado en el server** (409; cancelar libera fechas), total días × precio server-side, código `AL-`, ocupadas visibles antes de reservar. Admin: ABM (borrar arrastra reservas) + bandeja. Completa el vertical hospedaje/alquiler |
| `pagoinformado` | **Informar pago por transferencia** (`usesAnime`, adoptado): el flujo clásico del comercio argentino — datos bancarios publicados (ficha editable sin regenerar, CBU 22 dígitos validado), el cliente informa su transferencia (comprobante solo http/https anti-XSS) y consulta el estado con su código `PG-`. Admin: conciliación aprobar/rechazar con KPIs y CSV. **Primera pieza de pagos del catálogo sin API key** |
| `campanas` | **Campañas de email** (`usesAnime`, adoptado, requiere mailer+newsletter+auth): redactar, "probar conmigo" y enviar a todos los suscriptores — una fila real en `outbox` por destinatario; enviada queda sellada (409). **Cierra el ciclo de email marketing** (newsletter captura → campañas escribe) |
| `caja` | **Caja diaria** (`usesAnime`, adoptado, requiere auth): la planilla de plata del día — ingresos/egresos por medio de pago, totales del server, **cierre que sella el día** (409 a todo cambio posterior), historial de cierres y CSV. Distinto de `pos` y `stats` |
| `cumples` | **Club de cumpleaños** (`usesAnime`, nuevo): alta pública en la Home (nombre, email, fecha; **idempotente por email**, fecha validada en server), panel admin con cumplen-hoy y próximos ordenados por **días faltantes calculados en el server** (solo mes/día, sin exponer el año; 29/2 → 1/3), KPIs, filtro, CSV y baja. Con mailer avisa cada alta |

Todo probado: registro (**100 UI · 75 funcionales = 175 módulos**), 3 variantes generadas
(full = 68 archivos / 35 JS con Anime y Motion conviviendo y las 7 páginas nuevas; sin-auth = 21
archivos / 11 JS sin ningún panel; Vercel+Supabase = 44 archivos / 23 JS con las **8 colecciones
nuevas** en `schema.sql`), syntax-check de los 69 JS (0 errores), inlineado seguro. **Prueba de
backend real** en Express (:4997): **79 asserts en verde** — incluidos solapamiento y liberación
de fechas de `alquileres`, sellado de campañas y de caja, idempotencia de `cumples`, y los **10
asuntos de mailer esperados** en la bandeja (reclamo, presupuesto, turno, mesa, comanda, pedido
web, alquiler, pago, club, campaña). Más **12 asserts sin-auth** (:4998). **Smoke test en
navegador real**: cero errores de consola en Home + 2 páginas públicas + 5 paneles admin;
interacciones por UI verificadas (alta al club, reserva de alquiler con count-up y su código
visible en la bandeja, ficha bancaria en vivo, caja cerrada deshabilitando el form). **Dos bugs
de generación encontrados por los tests y corregidos**: `quote.js` no recibía `cfg` en `files()`
(rompía la generación con `quote` activo) y el require del mailer de `cart` caía en
`routes/products.js` con el notify en `routes/orders.js` (crasheaba el checkout). Sin módulos
revertidos.

### Pendiente / sugerencias para la próxima corrida

- **Email al cliente**: todo el sistema de avisos (13 módulos) le escribe **solo al negocio**; el
  email de confirmación al cliente (su código de turno/reserva/pago) sigue siendo el salto
  natural, y `pagoinformado` podría avisar al cliente al aprobar/rechazar su pago.
- **`campanas`**: el free tier de Resend limita a ~100 emails/día con remitente genérico; para
  listas grandes faltan envío en tandas y aviso de límite en el panel. Un contador de aperturas
  (pixel) sería el siguiente KPI.
- **`alquileres`**: precios por temporada (finde/feriados), **seña vía `pagoinformado`** (la
  integración natural entre los dos adoptados: reservar → transferir la seña → conciliar), fotos
  del recurso vía `uploads`.
- **`pagoinformado`**: adjuntar el comprobante como archivo vía `uploads` (hoy URL); si
  `cart`/`pedidoscarta` están activos, precargar la referencia con el código del pedido.
- **`caja`**: arqueo/fondo inicial del día y CSV del historial de cierres (hoy solo el del día).
  Si `pos` está activo, cada venta podría registrar su ingreso automáticamente.
- **`cumples`**: el saludo automático por email **el día del cumple** necesita un disparador
  diario (cron de Vercel o chequeo al primer request del día — patrón nuevo para el catálogo);
  integración con `coupons` (generar el cupón de regalo) cerraría el circuito.
- **`notifcentro`**: sumar los pendientes nuevos como fuentes (pagos por conciliar, reservas de
  alquiler pendientes, comandas) — el matcher por igualdad ya lo soporta.
- **Molde ABM público+admin**: con este lote son ~23 los módulos que repiten el molde; el helper
  compartido (`adminPanel({...})`) sugerido desde la 19ª sigue siendo el refactor más rentable.
- **Pendientes que siguen abiertos**: snippet `<mark>` y anclas `?a=`/`?item=` en `sitesearch`;
  migrar los buscadores viejos a `fold()`; picker de `uploads` en formularios con URL; CV de
  `vacantes` vía `uploads`; numeración correlativa en `invoices`; cupo por día/feriado en
  `reservamesa`; staff/servicios de `agenda` como colección; filtrar horarios pasados en `agenda`.

## Corrida 2026-07-20 (29ª)

Lote de **4 módulos funcionales nuevos, todos con backend real** (directiva vigente: prohibido
sumar funcionalidad no visual sin backend). Los 4 usan **Anime.js** (`usesAnime`) con red de
seguridad. El foco fue la **operación del negocio**: se cerró el **pendiente más viejo del
proyecto** — el email transaccional anotado desde la 19ª — con una bandeja de salida que funciona
sin ninguna API key y envía de verdad si se carga la clave gratuita de Resend, integrada de
entrada a tres módulos de captura y a la ficha del negocio; se le dio al admin una **campanita
con todos los pendientes del sitio** en un solo lugar (13 fuentes resueltas al generar, estilo
`sitesearch`); la **copia de seguridad completa con restauración** que preserva ids (nuevo
`db.restore()` en ambos drivers); y la **videoteca administrable** con click-to-play y
reproducciones reales. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

> Nota de bitácora: la **28ª corrida** (mismo día, otra sesión) agregó `pedidoscarta`,
> `listaprecios`, `textos` y `fila` — está documentada completa en [CAMBIOS.md](CAMBIOS.md) pero
> no dejó su entrada acá; este es el resumen retroactivo mínimo. Por eso el salto 27ª → 29ª.

| Módulo | Nota |
|---|---|
| `mailer` | **Avisos por email** (`usesAnime`): bandeja de salida real (colección `outbox`) + helper `src/mailer.js` en el proyecto exportado. Sin clave, cada aviso queda **registrado** y visible; con `RESEND_API_KEY` (free tier, opcional) **se envía de verdad**. El destinatario sale de la **ficha del negocio** (si `negocio` está activo) o de `MAIL_TO`. Integrado de entrada: postulación (`vacantes`), pedido de llamada (`callback`) y consulta a profesional (`profesionales`) avisan solos, con disparar-y-seguir (un email caído jamás rompe el alta). Con `auth`: `/emails-admin.html` (KPIs, filtro, reintento — 409 sin clave —, email de prueba, CSV). **Cierra el pendiente de email transaccional anotado desde la 19ª** |
| `respaldo` | **Copia de seguridad** (`usesAnime`, requiere `auth`): `/respaldo-admin.html` descarga TODAS las colecciones del proyecto (resueltas al generar) en un JSON y las **restaura preservando ids y fechas** (nuevo `db.restore()` en ambos drivers; en Supabase borra con filtro-que-matchea-todo e inserta en tandas). El archivo de restauración viaja como octet-stream (hasta 20 MB, truco de `uploads`). Doble confirm, KPI por colección con count-up, historial (`backuplog`). La copia incluye `users` con hashes: el README avisa que es confidencial |
| `notifcentro` | **Centro de novedades del admin** (`usesAnime`, requiere `auth`): campanita "Novedades" en la navbar (solo admins, con **badge**) que suma los **pendientes reales** de los módulos activos — 13 fuentes posibles resueltas al generar: postulaciones nuevas, llamadas por hacer, testimonios por moderar, presupuestos sin cotizar, devoluciones solicitadas, reservas/turnos por confirmar, preguntas sin responder, chat sin leer, reclamos abiertos, consultas a profesionales, comandas recibidas. Sondeo cada 60 s (solo pestaña visible) y pulso al subir el total. `/novedades-admin.html` desglosa cada fuente con count-up y enlace directo a su panel. El total **baja solo** al atender cada bandeja |
| `videos` | **Galería de videos** (`usesAnime`): `/videos.html` con los videos publicados del backend, chips por categoría y **click-to-play** (ningún iframe ni request a terceros hasta dar play; `youtube-nocookie`). Se cargan pegando la URL de YouTube/Vimeo: el server valida y guarda **solo el ID** (anti-XSS de raíz; `javascript:` → 422) y cada play se **cuenta de verdad** (404 sobre ocultos). Con `auth`: ABM `/videos-admin.html` con reproducciones por video. Se siembran 2 cortos abiertos de Blender. **Distinto de `video`** (UI con un único video fijo) |

Todo probado: registro (**100 UI · 70 funcionales = 170 módulos**), 3 variantes generadas con
`vm.Script` (full = hero + reveal/Motion + auth + negocio + vacantes + callback + profesionales +
usertestimonials + qanda + livechat + los-4 = 51 archivos con **Anime y Motion conviviendo**, 26
JS y las 4 páginas nuevas —`emails-admin`, `respaldo-admin`, `novedades-admin`, `videos` +
`videos-admin`—; sin-auth = 20 archivos, 11 JS, con `/videos.html` público pero **ningún** panel
ni endpoint admin; Vercel+Supabase + los-4 = 45 archivos, 22 JS, con las 3 colecciones nuevas
—`outbox`, `backuplog`, `videos`— en `schema.sql`), **syntax-check de los 59 JS** de las tres
variantes (0 errores), inlineado seguro (0 `</script>`/`</style>` en `app.js`). **Prueba de
backend real** sirviendo el proyecto full en Express, **54 asserts en verde**: videos (payload
público sin campos internos, play +1, oculto invisible + play 404, youtu.be y Vimeo parseados,
`javascript:` 422, 401/403); mailer (envío apagado sin clave, **destino tomado de la ficha del
negocio**, 3 avisos reales por las 3 integraciones, prueba, reenviar sin clave 409, 401/403);
notifcentro (cuenta postulación/llamada/consulta, **el total baja al marcar la llamada
contactada**, 401/403); respaldo (export v1 completo, borrado simulado y **restauración con ids
preservados**, JSON inválido 422, copia ajena 422, historial, `backuplog` excluido). Más **10
asserts sin-auth**: endpoints admin inexistentes (404) y el **mailer registrando headless** en
`data/outbox.json` con el aviso de "falta destinatario". **Smoke test en navegador real**: cero
errores de consola en `/videos.html` y los 3 paneles; click-to-play por UI (iframe
`youtube-nocookie` recién al click, contador 1→2 persistido); campanita "Novedades 2" con
desglose de 6 fuentes vivas; bandeja de emails con los avisos de las integraciones; respaldo con
12 colecciones y export por UI. **Bug encontrado y corregido**: el link "Emails (admin)" quedaba
visible para el anónimo fuera del panel (el `return` temprano del clientJs cortaba antes de
ocultarlo); verificado el fix en el navegador. Sin módulos revertidos.

### Pendiente / sugerencias para la próxima corrida

- **`mailer`**: hoy avisan `vacantes`, `callback` y `profesionales`; sumar el hook (2 líneas por
  módulo) a `tickets`, `quote`, `returns`, `agenda`, `reservamesa`, `pedidoscarta` y `cart` es
  mecánico y multiplica el valor. Falta el **email al cliente** (confirmación de turno/pedido con
  su código): hoy solo se avisa al negocio. Con dominio propio verificado en Resend se puede
  personalizar `MAIL_FROM`; documentado en el README. Los avisos podrían agruparse (digest diario)
  si el volumen molesta.
- **`respaldo`**: la restauración es todo-o-nada por colección; se podría ofrecer restauración
  selectiva (checkboxes por colección) y una **copia automática programada** (cron simple o al
  arrancar, guardando las últimas N en `data/backups/`). En Supabase la copia viaja entera por la
  API: para bases grandes convendría paginar el export.
- **`notifcentro`**: las fuentes son equality/negation sobre un campo (+una condición extra); si
  aparece un módulo con lógica de pendiente más compleja, extender el matcher. Podría recordar
  "visto hasta" por admin (hoy el badge muestra el total absoluto, que ya baja al atender). El
  título de la pestaña podría sumar el contador (`(2) Novedades`) — se ata al pendiente de
  notificación en pestaña de `livechat`.
- **`videos`**: falta miniatura real (se eligió placeholder con play para no pegarle a terceros
  al cargar; la miniatura de YouTube `i.ytimg.com` sería opt-in), orden manual y un campo
  descripción. Integrarlo a `sitesearch` (`FUENTES_POSIBLES`) es una línea y quedó afuera de esta
  corrida. Si `pedidoscarta`/`menu` están activos, un video por plato sería un diferencial.
- **PROGRESO de la 28ª**: quedó sin entrada propia acá (solo en CAMBIOS.md); si alguna corrida
  quiere completarla con formato pleno, el detalle está ahí.
- **Molde ABM público+admin**: el helper compartido (`adminPanel({...})`) sugerido desde la 19ª
  sigue pendiente; con este lote son ~19 los módulos que repiten el molde. Sigue siendo el
  refactor más rentable del proyecto y amerita una corrida propia sin módulos nuevos.
- **Pendientes que siguen abiertos de corridas anteriores**: snippet con `<mark>` y anclas
  `?a=`/`?item=` en `sitesearch` (kb/menu/downloads/profesionales); migrar los buscadores viejos a
  `fold()` (acentos); picker de `uploads` en los formularios que piden URL; CV de `vacantes` vía
  `uploads`; numeración correlativa y emisión automática en `invoices`; cupo por día/feriado en
  `reservamesa`; staff/servicios de `agenda` como colección; filtrar horarios pasados en `agenda`.

## Corrida 2026-07-20 (27ª)

Lote de **4 módulos funcionales nuevos, todos con backend real** (directiva vigente: prohibido
sumar funcionalidad no visual sin backend). Los 4 usan **Anime.js** (`usesAnime`) con red de
seguridad. El foco fue la **transversalidad**: dos módulos que potencian a todo el catálogo — el
**buscador global** que indexa el contenido dinámico de los módulos activos (y cierra el pendiente
histórico de **búsqueda sin acentos**: "envios" encuentra "envíos") y la **ficha del negocio** que
alimenta el pie de todas las páginas y el encabezado fiscal de los comprobantes (cierra el
pendiente "datos del negocio configurables" de la 26ª) — más dos piezas comerciales que faltaban:
la **bolsa de trabajo administrable** (los puestos de `jobs` eran texto fijo) y las **promociones
con vigencia** que aparecen y desaparecen solas por fecha. Patrón público+admin-por-`auth` con
`requireAdmin` (admin **401 sin token** y **403 con token no-admin**) y link de navbar oculto para
quien no corresponde. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `sitesearch` | **Buscador global del sitio** (`usesAnime`): `/buscar.html` busca **en el servidor**, sin distinguir acentos ni mayúsculas, sobre las fuentes que el Builder resuelve al generar según los módulos activos (novedades, ayuda, carta, avisos, proyectos, descargables, cursos, profesionales, vacantes), con resultados agrupados, enlace directo a cada contenido, debounce y `?q=` compartible. **Cada búsqueda queda registrada** con su total: con `auth`, `/busquedas-admin.html` muestra el top de términos y los **buscados sin resultados** (el contenido que falta), con KPIs animados, CSV y vaciado. **Distinto del módulo UI `search`** (filtra la página actual). Cierra el pendiente de búsqueda sin acentos |
| `vacantes` | **Bolsa de trabajo** (`usesAnime`): `/vacantes.html` lista las búsquedas laborales **abiertas** desde el backend (chips por área, acordeón animado, enlace directo `?v=`) y cada una tiene su **formulario de postulación propio** (CV por URL solo http/https anti-XSS, dedupe por email+vacante → 409, postular a una pausada → 404). Con `auth`: ABM de búsquedas (pausar/reabrir; **borrar arrastra sus postulaciones**) y bandeja de postulantes con estados (nuevo → en revisión → entrevista → contratado/descartado), nota, filtros y CSV. Se siembran 2. **Distinto de `jobs`** (form estático) y `jobsadmin` (gestiona lo de jobs) |
| `promos` | **Promociones con vigencia** (`usesAnime`): sección en la Home con **solo las promos vigentes hoy** (el server filtra por `desde`/`hasta`; una vencida desaparece sola), días restantes calculados en el server y botón **"Me interesa"** que registra interés real por promo (un voto por navegador): el negocio mide qué promo tracciona. Con `auth`: ABM en `/promos-admin.html` con **estado calculado** (vigente/programada/vencida/oculta) e interesados. Valida `hasta ≥ desde` (422). Se siembran 2 vigentes + 1 vencida que demuestra el filtro. **Distinto de `promo`** (popup estático), `countdown` y `coupons` |
| `negocio` | **Datos del negocio** (`usesAnime`): ficha única (razón social, CUIT con validación de formato, dirección, teléfono, email, horario) editable en `/negocio-admin.html` y servida por `GET /api/negocio`. Se **inyecta en vivo en el pie de todas las páginas** y, si `invoices` está activo, agrega la **línea fiscal al comprobante impreso** (razón social · CUIT · dirección) vía MutationObserver. El cliente corrige sus datos una vez, sin regenerar. **Cierra el pendiente de la 26ª** (datos del negocio para comprobantes). Distinto de `hours` (UI) y `branches` |

Todo probado: registro (**100 UI · 62 funcionales = 162 módulos**), 3 variantes generadas con
`vm.Script` (full = hero + reveal/Motion + auth + blogcms + kb + menu + invoices + los-4 = 47
archivos con **Anime y Motion conviviendo**, 22 JS y las 6 páginas nuevas —`buscar`, `vacantes`,
`busquedas-admin`, `vacantes-admin`, `promos-admin`, `negocio-admin`—; sin-auth = 22 archivos,
12 JS, con `/buscar.html` y `/vacantes.html` pero sin ningún panel; Vercel+Supabase + auth + los-4
= 46 archivos, 21 JS, con las 5 colecciones nuevas —`searchqueries`, `jobopenings`,
`jobapplicants`, `promos`, `bizinfo`— en `schema.sql`), **syntax-check de los 55 JS** de las tres
variantes (0 errores), inlineado seguro (0 `</script>`/`</style>` en `app.js`). **Prueba de backend
real** sirviendo el proyecto full en Express (:4993), **52 asserts en verde**: sitesearch (fold de
acentos "envios"→"envíos", mayúsculas, vacante con enlace directo, 0 resultados registrado en
sin-resultados, 401/403, vaciado); vacantes (dedupe 409 con email en mayúsculas, cvUrl
`javascript:` descartada, estados+nota, pausada invisible y 404 al postular, **borrado en cascada
verificado**); promos (2 de 3 vigentes en público, daysLeft server-side, interés +1, vencida 404,
programada oculta, fechas al revés 422); negocio (ficha sembrada con la marca, sin id público,
CUIT/email inválidos 422, cambios reflejados). Más **9 asserts de la variante sin-auth** en :4994
(públicos OK, endpoints admin inexistentes 404, navbar sin links admin). **Smoke test en navegador
real** (:4993): cero errores de consola en Home + buscar + vacantes + comprobante + los 4 paneles
admin; `anime` y `Motion` cargados; "Me interesa" por UI (contador 2, botón deshabilitado, dedupe
en localStorage); búsqueda por UI con stagger completado; postulación por UI (caja de éxito,
visible en la bandeja con su CV); **línea fiscal del negocio inyectada en el comprobante**
`RC-DEMO01` con los datos editados por API; edición de la ficha por UI persistida; los 6 links
admin nuevos **ocultos** para el visitante anónimo y visibles tras login admin. Sin módulos
revertidos.

### Pendiente / sugerencias para la próxima corrida

- **`sitesearch`**: los resultados no muestran un extracto con la coincidencia resaltada (solo
  título + extra); un snippet con `<mark>` mejoraría la lectura. `kb`, `menu`, `downloads` y
  `profesionales` linkean a su página general (no al item puntual) porque esas páginas no tienen
  ancla por item: agregar soporte `?a=`/`?item=` en esas páginas (el pendiente `?a=` de `kb` viene
  de la 22ª) y actualizar la tabla `FUENTES_POSIBLES`. Los demás buscadores del catálogo
  (`blogcms`, `kb`, `projects`, `downloads`…) siguen usando `includes()` plano: **migrar sus
  filtros al mismo `fold()`** es mecánico y cierra el pendiente de acentos en todo el catálogo.
  `products-admin` quedó fuera de las fuentes (no tiene página pública propia).
- **`vacantes`**: convive con `jobs`/`jobsadmin` (dos vías de postulación si activás ambos; avisado
  en el README). Una migración natural es que `jobs` se retire del catálogo visible o que `vacantes`
  lo reemplace con `requires`. El CV va por URL: integrarlo con `uploads` (26ª) para subir el
  archivo directo sería el combo correcto. No notifica por email al negocio cuando entra una
  postulación (pendiente viejo de email transaccional con Resend free tier).
- **`promos`**: el "Me interesa" no captura contacto; un campo email opcional al interesarse (o
  integración de 2 líneas con `leads`) convertiría interés en lead. Si `coupons` está activo, la
  promo podría mostrar su código de cupón asociado. La vigencia es por fecha (no por hora) y usa la
  fecha UTC del server: para negocios con cortes horarios finos habría que decidir zona horaria.
- **`negocio`**: más módulos podrían leer la ficha: `contact` (email/teléfono reales en el form),
  `map` (dirección), `hours` (horario), el footer del módulo `megafooter`. Hoy solo pie +
  comprobantes. El CUIT valida formato pero no dígito verificador.
- **Molde ABM público+admin**: con este lote son ~17 los módulos que repiten el molde. El **helper
  compartido** (`adminPanel({...})`) sugerido desde la 19ª sigue pendiente; ya es el refactor más
  rentable del proyecto y amerita una corrida propia sin módulos nuevos.
- **Pendientes que siguen abiertos de corridas anteriores**: picker de la biblioteca de `uploads`
  en los formularios que piden URL (`albums`/`downloads`/`projects`/`blogcms`, anotado en la 26ª);
  notificación sonora/título en la bandeja de `livechat`; email opcional en `agenda`/`reservamesa`
  para que entren al portal del cliente; numeración correlativa y emisión automática desde
  `cart`/`pos` en `invoices` (los datos fiscales ya los aporta `negocio`); cupo por día/feriado en
  `reservamesa`; staff/servicios de `agenda` como colección; filtrar horarios pasados del día en
  `agenda`.

## Corrida 2026-07-20 (26ª)

Lote de **4 módulos funcionales nuevos, todos con backend real** (directiva vigente: prohibido
sumar funcionalidad no visual sin backend). Los 4 usan **Anime.js** (`usesAnime`) con red de
seguridad. El foco fue **cerrar dos pendientes históricos** — la **subida real de archivos** (que
`albums`/`downloads`/`projects` venían esperando: recibían todo por URL) y el **portal de
clientes** anotado desde la 24ª — y sumar **dos piezas clásicas de sitio comercial** que faltaban:
el chat en vivo con bandeja de respuestas y los comprobantes/recibos imprimibles. Patrón
público+admin-por-`auth` con `requireAdmin` (admin **401 sin token** y **403 con token no-admin**)
y link de navbar oculto para quien no corresponde. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `uploads` | **Biblioteca de archivos con subida real** (`usesAnime`, requiere `auth`): el admin sube archivos en `/archivos-admin.html` (input o **arrastrar y soltar**, hasta 5 MB) y copia la URL propia del sitio (`/api/uploads/f/<id>`) para pegarla en cualquier módulo que pida una URL (galería, descargas, portafolio, blog…). El binario viaja crudo (octet-stream + header ASCII con acentos plegados) sin pisar el `express.json` global; **lista blanca de extensiones sin svg/html (anti-XSS)** y nombre saneado en el server. Local: binarios en `data/uploads/`; Supabase/Vercel: base64 en la colección `filedata`, separada de los metadatos (`files`) para que el listado nunca cargue binarios. **Cierra el pendiente histórico** de la 24ª |
| `livechat` | **Chat en vivo** (`usesAnime`): burbuja flotante en todas las páginas (identidad anónima en localStorage, sin pedir email); el primer mensaje dispara una **bienvenida automática** y las novedades llegan por **polling liviano** (sin websockets: corre gratis en cualquier hosting, Vercel incluido), con punto de aviso si el negocio responde con el panel cerrado. Con `auth`: bandeja `/chat-admin.html` con hilos agrupados, **no-leídos** que se marcan al abrir, respuesta, borrado de conversación y refresco automático. Convive con los flotantes de WhatsApp/volver-arriba. **Distinto de `chatbot`/`ai-agent`** (responde una persona, no una IA) |
| `clientportal` | **Portal del cliente "Mis gestiones"** (`usesAnime`, requiere `auth`): `/portal.html` junta todo lo del usuario logueado **filtrando por el email del token en el servidor** (imposible ver gestiones ajenas): pedidos, turnos, devoluciones, garantías, reclamos, presupuestos, cursos con avance, fidelidad y comprobantes — cada sección **solo se genera si su módulo está activo** y cada item enlaza a su detalle. Saludo por nombre, total con count-up y secciones con stagger. `agenda`/`reservamesa` no aparecen (guardan teléfono, no email). **Cierra el pendiente "portal de clientes"** anotado desde la 24ª |
| `invoices` | **Comprobantes y recibos** (`usesAnime`): el negocio emite comprobantes (items con cantidad y precio, **total calculado siempre en el servidor**, estados pendiente/pagado/anulado) con código `RC-XXXXXX`; el cliente los consulta en `/comprobante.html` (enlace directo `?code=` auto-consulta) y los **imprime con hoja limpia** (`@media print`). La vista pública no expone email ni nota interna. Con `auth`: `/comprobantes-admin.html` con filas de items dinámicas y total en vivo, KPIs animados (cobrado con count-up), filtro, nota interna y CSV. Se siembra `RC-DEMO01`. Integrado al portal del cliente |

Todo probado: registro (**100 UI · 58 funcionales = 158 módulos**), 3 variantes generadas con
`vm.Script` (full = hero + reveal/Motion + auth + los-4 = 34 archivos con **Anime y Motion
conviviendo**, 18 JS y las 5 páginas nuevas —`archivos-admin`, `chat-admin`, `portal`,
`comprobante`, `comprobantes-admin`—; sin-auth = 17 archivos, 9 JS, con `/comprobante.html` y el
widget de chat pero sin ningún panel; Vercel+Supabase + auth + los-4 = 37 archivos, 19 JS, con las
4 colecciones nuevas —`files`, `filedata`, `chatmessages`, `invoices`— en `schema.sql`),
**syntax-check de los 46 JS** de las tres variantes (0 errores), inlineado seguro
(0 `</script>`/`</style>` en `app.js`). **Prueba de backend real** sirviendo el proyecto full en
Express (:4991), **44 asserts en verde**: uploads (subida 201 con nombre saneado, roundtrip binario
idéntico byte a byte, svg 422 anti-XSS, no-admin 403, borrado → 404); livechat (bienvenida
automática, bandeja con no-leídos que baja a 0 al abrir el hilo, respuesta admin visible para el
visitante, hilo inexistente 404); invoices (total server-side 975.000 verificado, qty 0 / precio
negativo / estado inválido 422, vista pública sin email/nota, filtro por estado); clientportal (401
sin token, portal con el comprobante de la clienta enlazado, **aislamiento por email** verificado).
Más **6 asserts de la variante sin-auth** en :4992 (chat y comprobante públicos OK, endpoints admin
inexistentes 404). **Smoke test en navegador real** (:4991): cero errores de consola en Home +
comprobante + portal + 3 paneles admin; `anime` y `Motion` cargados; chat por UI (mensaje →
bienvenida automática renderizada, respuesta desde la bandeja admin persistida y visible del lado
del visitante); comprobante `?code=RC-DEMO01` auto-consultado (chip "Pagado", total `$22.000` con
count-up y red de seguridad, botón imprimir); subida por UI con drag-and-drop simulado ("Catálogo
Peñón 2026.txt" → `catalogo-penon-2026.txt` tras corregir el plegado de acentos en el header);
portal de la clienta ("Hola, Ana", total 1, su comprobante `$975.000` enlazado) con los 4 links
admin **ocultos** para ella y "Mis gestiones" oculto para el visitante anónimo. Sin módulos
revertidos.

### Pendiente / sugerencias para la próxima corrida

- **`uploads`**: los formularios de `albums`/`downloads`/`projects`/`blogcms` siguen pidiendo URL a
  secas; el siguiente paso natural es agregarles un **botón "elegir de la biblioteca"** (un picker
  que liste `/api/uploads/admin/list` y pegue la URL) o un input de archivo directo que suba y
  complete el campo. Con Supabase los binarios van en base64 a la tabla `filedata` (razonable para
  archivos chicos); para volumen real, migrar esa rama a **Supabase Storage** manteniendo la misma
  API. No hay límite de cantidad total de archivos ni cuota global.
- **`livechat`**: el polling de la bandeja podría mostrar una **notificación sonora/título** cuando
  entra un mensaje nuevo con la pestaña abierta. No hay indicador de "escribiendo…" ni horario de
  atención (mostrar "te respondemos en horario comercial" fuera de hora, reusando la constante de
  `hours`). Si `auth` no está activo el widget captura igual pero nadie responde desde la web:
  se podría degradar a un formulario de contacto con aviso claro. El nombre del visitante podría
  precargarse del usuario logueado si existe.
- **`clientportal`**: `agenda` y `reservamesa` quedan afuera porque guardan teléfono; pedir un
  email opcional en esos flujos (o un campo teléfono en el registro) las sumaría al portal. Podría
  agregarse una acción por item (cancelar turno pendiente, descargar comprobante) y un **resumen
  por email** mensual (se ata al pendiente viejo de email transaccional con Resend free tier).
- **`invoices`**: no tiene numeración correlativa (solo código aleatorio); para uso fiscal real
  faltaría serie+número secuencial y datos del negocio configurables (CUIT, dirección) desde el
  Builder o un panel de configuración. Si `cart`/`pos` están activos, cada venta podría **emitir su
  comprobante automáticamente**. El CSV no incluye los items (solo cabecera).
- **Molde ABM público+admin**: con este lote ya son ~14 los módulos que repiten el molde
  (form + tabla + estados + CSV + navbar-oculta). El **helper compartido** (`adminPanel({...})`)
  sugerido desde la 19ª sigue pendiente y es cada vez más rentable; buen candidato para una corrida
  de refactor sin módulos nuevos.
- **Pendientes que siguen abiertos de corridas anteriores**: helper de búsqueda sin acentos en
  `src/` (ahora también lo usaría el saneo de nombres de `uploads`); cupo por día/feriado en
  `reservamesa`; recordatorio por email de turnos (`agenda`); staff/servicios de `agenda` como
  colección con CRUD (hoy constantes); filtrar horarios ya pasados del propio día en `agenda`.

## Corrida 2026-07-20 (25ª)

Lote de **4 módulos funcionales nuevos, todos con backend real** (directiva vigente: prohibido
sumar funcionalidad no visual sin backend). Los 4 usan **Anime.js** (`usesAnime`) con red de
seguridad. El foco fue **cerrar los cuatro verticales pendientes anotados por las corridas 23ª y
24ª**: la agenda "fina" de turnos con horarios (peluquerías, consultorios, estudios), un sistema de
cursos con progreso por alumno, el directorio de profesionales con ficha y contacto, y el cotizador
por parámetros (financiación) que el `estimator` UI dejaba front-only. Cada módulo sirve su parte
pública de forma dinámica desde el servidor y, con `auth` activo, suma un **ABM/panel solo-admin**
con `requireAdmin` (los endpoints admin devuelven **401 sin token**) y el link de navbar oculto para
el visitante no logueado. Sin `auth` la parte pública funciona igual (datos sembrados, editables a
mano en `data/*.json`). El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `agenda` | **Agenda de turnos con slots horarios** (`usesAnime`): página pública `/turnos.html` donde el visitante elige **servicio (con duración), profesional y fecha**, ve la grilla de horarios del día (los ocupados, tachados; un color de 90' bloquea tres slots de 30') y reserva un horario puntual. El servidor **recalcula la disponibilidad al confirmar** (409 si otro se lo llevó en el medio) y devuelve un código `AG-XXXXXX`. Con `auth`: `/agenda-admin.html` con la agenda del día por profesional (confirmar / atendido / cancelar — cancelar libera el horario — / borrar). Profesionales, servicios y horario en constantes de `routes/agenda.js`. **Distinto de `bookings`** (turno genérico sin horario ni profesional) y de `reservamesa` (cupo de personas por franja). Era el vertical más pedido en los pendientes |
| `cursos` | **Cursos con progreso** (`usesAnime`): página pública `/cursos.html` con los cursos publicados (conteo real de lecciones y alumnos) y curso abierto vía `?curso=<id>`. El alumno se **inscribe con su email** (idempotente) y marca lecciones completadas: el avance se guarda en el servidor (`courseprogress`) y se retoma desde cualquier dispositivo, con **barra + porcentaje animados**. Con `auth`: ABM `/cursos-admin.html` (lecciones una por línea "Título \| contenido", publicar/despublicar, alumnos por curso); los borradores no se ven ni se abren en público. Se siembran 2 cursos. **Distinto de `kb`** (artículos de ayuda) y `blogcms` (novedades): contenido ordenado en lecciones con avance por alumno |
| `profesionales` | **Directorio de profesionales** (`usesAnime`): página pública `/profesionales.html` con las fichas publicadas (especialidad, bio, foto o avatar de iniciales), **chips por especialidad + buscador server**, y en cada ficha un **formulario de consulta que se guarda en el backend** (`prorequests`); la ficha pública nunca expone datos internos. Con `auth`: `/profesionales-admin.html` con el ABM del staff (foto solo URL http/https, anti-XSS) y la **bandeja de consultas** (marcar contactado, filtro por estado, borrar). Se siembran 3 fichas. **Distinto de `team`** (UI estática) y de `listings` (avisos con precio) |
| `simulador` | **Simulador de financiación** (`usesAnime`): sección en la Home donde el visitante elige línea, monto y cuotas y el **servidor calcula la cuota por sistema francés** con la tasa vigente (422 fuera de rango/plazo, 404 línea inexistente), **registrando cada simulación** para medir la demanda por línea. Cuota con count-up + leyenda "simulación orientativa, no constituye una oferta". Las líneas (nombre, TNA, montos, plazos) viven en `financelines`: con `auth`, ABM `/financiacion-admin.html` donde la tasa editada **rige al instante** y se ve cuántas simulaciones tuvo cada línea. Se siembran 3 líneas. **Distinto de `estimator`** (calculadora front-only) y de `shipping` (cotizador de envío). Cierra el pendiente "cotizador por parámetros" |

Todo probado: registro (**100 UI · 54 funcionales = 154 módulos**), 3 variantes generadas con
`vm.Script` (full = hero + reveal/Motion + auth + los-4 = 36 archivos con **Anime y Motion
conviviendo** y las 8 páginas nuevas —`turnos`, `agenda-admin`, `cursos`, `cursos-admin`,
`profesionales`, `profesionales-admin`, `financiacion-admin` + la sección del simulador en la
Home— y 18 JS; sin-auth = 21 archivos, 11 JS, parte pública sin paneles pero con `/turnos.html`,
`/cursos.html` y `/profesionales.html`; Vercel+Supabase + auth + los-4 = 39 archivos, 19 JS, con
las 7 colecciones nuevas —`agbookings`, `courses`, `courseprogress`, `pros`, `prorequests`,
`financelines`, `financequotes`— en `schema.sql`), **syntax-check de los 48 JS** de las tres
variantes (0 errores), inlineado seguro (0 `</script>`/`</style>` en `app.js`). **Prueba de backend
real** sirviendo el proyecto full en Express (:4975), **80 asserts en verde**: agenda (grillas de
18/16 slots según duración, 409 por doble reserva y por solapamiento de 90', cancelación que libera
el horario, agenda de otro profesional intacta, admin 401 sin token); cursos (2 sembrados,
inscripción idempotente con email normalizado, avance sin duplicar, 404 sin inscripción, borrador
invisible en público, alta con lecciones parseadas); profesionales (fichas sin campos internos,
filtro y buscador server, consulta 201/422/404, foto `javascript:` descartada, bandeja con
contactado y filtro); simulador (cuota francesa exacta verificada contra el cálculo independiente,
TNA 0 = monto/cuotas, simulación registrada, tasa editada rige al instante). **Smoke test en
navegador real** (:4976): cero errores de consola en Home + las 3 páginas públicas + 2 paneles
admin; `anime` y `Motion` cargados; reserva de turno por UI (grilla con los ocupados del test de
API, código `AG-…`), curso por UI (inscripción + lección marcada → barra al 33% y "1 de 3", URL
`?curso=` compartible), consulta a profesional por UI (persistida y visible en la bandeja admin),
simulación por UI (`$60.459` idéntico al assert de API); los 4 links admin de navbar **ocultos para
el visitante anónimo** y visibles tras login admin. Sin módulos revertidos.

### Pendiente / sugerencias para la próxima corrida

- **`agenda`**: profesionales, servicios y horario son constantes en `routes/agenda.js` (espejadas
  en el `clientJs`); moverlas a una colección con CRUD admin permitiría editar el equipo sin tocar
  código (mismo camino que se hizo con `simulador`, cuyas líneas sí son colección). Hoy no se
  filtran los horarios ya pasados del propio día (si reservás para hoy a la tarde, la mañana
  aparece libre); comparar contra la hora del servidor lo cerraría. Falta un recordatorio por email
  del turno (se ata a la sugerencia vieja de email transaccional con Resend free tier).
- **`cursos`**: los ids de lección son posicionales (l1, l2…), así que reordenar lecciones desde el
  ABM puede reasignar avances ya marcados (avisado en el README generado). Las lecciones son texto
  plano: sumar una URL de video por lección (YouTube embed) sería el siguiente salto. Un
  certificado imprimible al llegar al 100 % y la integración con `leads` (el email del alumno como
  lead) cierran el ciclo comercial.
- **`profesionales`**: la consulta no notifica por email al profesional/negocio (queda en la
  bandeja admin). Si `agenda` está activo, la ficha podría linkear "sacar turno con este
  profesional" preseleccionando el profesional en `/turnos.html` (hoy son listas separadas:
  unificarlas es un buen candidato). El buscador es substring simple (caso conocido de `kb`).
- **`simulador`**: muestra TNA pero no CFT (en Argentina la publicidad de créditos reales exige
  CFT; anotado como leyenda orientativa). Podría capturar el email del interesado tras simular
  (integración de 2 líneas con `leads`) y mostrar el desglose de las primeras cuotas
  (capital/interés) en una tabla.
- **Molde ABM público+admin**: con `cursos`, `profesionales` y `simulador` ya son ~10 los módulos
  que repiten el molde (form ABM + tabla + publicar/ocultar + borrar). El **helper compartido**
  sugerido desde la 19ª (`adminPanel({...})`) sigue pendiente y rinde cada vez más.
- **Pendientes que siguen abiertos de corridas anteriores**: subida real de archivos (multipart →
  `data/uploads/` o Supabase Storage) reutilizable por `albums`/`downloads`/`projects`; helper de
  búsqueda sin acentos en `src/`; cupo por día/feriado en `reservamesa`; **portal de clientes**
  (login + sus pedidos/turnos/facturas en un lugar).

## Corrida 2026-07-18 (24ª)

Lote de **4 módulos funcionales nuevos, todos con backend real** (directiva vigente: prohibido
sumar funcionalidad no visual sin backend). Los 4 usan **Anime.js** (`usesAnime`) con red de
seguridad. El foco fue **cerrar verticales de contenido/servicios que faltaban**: portafolio de
trabajos para agencias/estudios/freelancers, galería de fotos administrable para
fotógrafos/restaurantes/salones/inmobiliarias, biblioteca de descargas para catálogos/precios/manuales,
y reserva de mesa con cupo para completar el vertical gastronómico (junto a `menu` de la 23ª). Cada
módulo sirve su parte pública de forma dinámica desde el servidor y, con `auth` activo, suma un
**ABM/panel solo-admin** con `requireAdmin` (los endpoints admin devuelven **401 sin token**) y el
link de navbar oculto para el visitante no logueado. Sin `auth` la parte pública funciona igual
(datos sembrados, editables a mano en `data/*.json`). El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `projects` | **Portafolio administrable** (`usesAnime`): página pública `/proyectos.html` que **lista los proyectos publicados traídos del servidor** (colección `projects`) con buscador (server, por título/rubro/cliente/extracto), **chips de filtro por rubro** y apertura del proyecto completo en la misma página (`?proyecto=<id>`, enlace compartible) sumando una **visita real** (`POST /:id/view`). Cada proyecto: título, rubro, cliente opcional, portada opcional, **enlace opcional al proyecto real** (solo http/https, se descarta lo demás como anti-XSS). Con `auth`: ABM `/proyectos-admin.html` (crear, editar, publicar/despublicar, borrar). Se siembran 3. Revelado con `anime.stagger` + red de seguridad. **Distinto de `portfolio`** (UI estática con trabajos fijos), de `listings` (avisos clasificados con precio) y de `products-admin` (e-commerce con stock/carrito) |
| `albums` | **Galería administrable** (`usesAnime`): página pública `/galeria.html` con las fotos publicadas (colección `albumphotos`) **agrupadas por álbum**, chips de filtro, **visor/lightbox** (teclado ← → Esc, navegación entre fotos) y un **"me gusta" real por foto** (contador persistido, `POST /:id/like`). Con `auth`: ABM `/galeria-admin.html` (cargar por URL, publicar/ocultar, borrar). Se siembran 6 (sin URL usan un fondo de marca como marcador). Aparición con `anime` scale/stagger + red de seguridad; pop del corazón con `outBack`. **Distinto de `gallery`/`galleryfilters`/`lightbox`** (UI estática con imágenes fijas): acá el negocio administra las fotos y los visitantes dejan su me gusta |
| `downloads` | **Centro de descargas** (`usesAnime`): página pública `/descargables.html` que lista los recursos publicados (colección `downloads`) **agrupados por categoría** con buscador (server), donde **cada descarga pasa por el servidor** (`POST /:id/get`) que **suma una descarga real** al contador y devuelve la URL del archivo (el cliente la abre). Count-up del contador con Anime.js. Cada recurso: título, categoría, descripción, URL del archivo (solo http/https), peso opcional. Con `auth`: ABM `/descargables-admin.html` (cargar, publicar/ocultar, borrar) viendo cuántas veces se descargó cada uno. Se siembran 3. **Distinto de `leadmagnet`** (un único descargable con registro de email para captar leads) y de `resources` (UI estática con enlaces fijos): acá el negocio administra una biblioteca y mide cada descarga |
| `reservamesa` | **Reserva de mesa con cupo** (`usesAnime`): sección pública en la Home donde el visitante elige **fecha, turno (mediodía/noche) y personas** y el servidor confirma **solo si hay lugar** en ese turno, sumando las personas ya reservadas (no canceladas) contra un **cupo configurable por turno** (`CUPO_POR_TURNO`, default 40) y **rechazando con 409** si se completó; devuelve un **código de reserva**. `GET /availability` (422 fecha pasada/turno inválido), `GET /turnos`, `POST /` (201/409/422). Ocupación con count-up de Anime.js. Con `auth`: panel `/mesas-admin.html` con la **agenda por fecha**, cupo usado por turno y confirmar/cancelar/borrar (`PATCH`/`DELETE`). Se guarda en colección `tablebookings`. **Distinto de `bookings`** (turnos genéricos sin cupo por franja) y de `eventregister` (cupo total de un evento, no por turno diario). Completa el vertical gastronómico junto a `menu` |

Todo probado: registro (**100 UI · 50 funcionales = 150 módulos**), 3 variantes generadas con
`vm.Script` (full = hero + reveal/Motion + auth + los-4 = 36 archivos con **Anime y Motion
conviviendo** y las 7 páginas nuevas —`proyectos`, `proyectos-admin`, `galeria`, `galeria-admin`,
`descargables`, `descargables-admin`, `mesas-admin` + la sección de reserva de mesa en la Home— y 18
JS; sin-auth = 21 archivos, 11 JS, parte pública sin paneles pero con `/proyectos.html`,
`/galeria.html` y `/descargables.html`; Vercel+Supabase + auth + los-4 = 38 archivos, 18 JS, con las
4 colecciones nuevas —`projects`, `albumphotos`, `downloads`, `tablebookings`— en `schema.sql`),
**syntax-check de los 47 JS** generados de las tres variantes con `vm.Script` (0 errores), inlineado
seguro (0 `</script>`/`</style>` en `app.js`). **Prueba de backend real** sirviendo el proyecto full
en Express (:4951), **44 asserts en verde**: projects (3 sembrados, listado sin `body`, categorías,
detalle con `body`, `view` +1, inexistente 404, `all/list` 401 sin token, alta 201 con `url`
javascript: descartada, inválido 422, despublicar → oculto en público pero admin lo ve, borrar);
albums (6 sembrados, `albumes` incluye Instalaciones, filtro por álbum, `like` +1, `all/list` 401,
alta con url válida, inválido 422); downloads (3 sembrados, buscador `?q=`, `get` cuenta +1 y
devuelve url, `all/list` 401, alta 201, inválido 422); reservamesa (2 turnos, disponibilidad 40/40,
fecha pasada/turno inválido 422, reserva 201 con código, cupo baja a 36, fecha pasada/datos inválidos
422, **control de cupo real: 24+20>40 → 409**, admin 401 sin token, listado con `turnLabel`, confirmar,
estado inválido 422, cancelar libera cupo).

### Pendiente / sugerencias para la próxima corrida

- **Subida real de imágenes/archivos**: `albums`, `downloads` y `projects` reciben la imagen/archivo
  por **URL** (el negocio los sube a su hosting y pega el enlace). Sería un salto de calidad agregar
  un módulo/base de **carga de archivos** (endpoint `multipart` que guarde en `data/uploads/` local
  o en Supabase Storage) reutilizable por estos tres. Ojo con Vercel (filesystem efímero → Storage).
- **Búsqueda sin acentos**: los buscadores (server) usan `includes()` plano, así que "catalogo" no
  encuentra "Catálogo" (comportamiento consistente con todo el catálogo). Un helper de *fold* de
  acentos compartido en `src/` mejoraría la UX de `blogcms`, `projects`, `downloads`, `kb`, etc.
- **Reserva de mesa — turnos/cupo por día**: hoy el cupo por turno es una constante global
  (`CUPO_POR_TURNO`). Se podría hacer configurable desde el panel (colección de config) y permitir
  distintos cupos por día de la semana o feriados.
- **Verticales que aún faltan** con backend real: agenda de **turnos por profesional/servicio con
  slots horarios** (más fino que `bookings`), **cotizador de seguros/créditos** por parámetros,
  **sistema de suscripción a cursos/lecciones** con progreso, **directorio de profesionales** con
  ficha y contacto.

## Corrida 2026-07-18 (23ª)

Lote de **4 módulos funcionales nuevos, todos con backend real** (directiva vigente: prohibido
sumar funcionalidad no visual sin backend). Los 4 usan **Anime.js** (`usesAnime`) con red de
seguridad. El foco fue **cubrir verticales y piezas comerciales que faltaban por completo en el
catálogo**: contenido/marketing (un blog administrable de verdad, no el `blog` UI estático),
logística de e-commerce (cotizador de costo de envío por provincia), marketplace/inmobiliaria
(directorio de avisos clasificados) y gastronomía (carta de restaurante). Cada módulo sirve su
parte pública de forma dinámica desde el servidor y, con `auth` activo, suma un **ABM/panel
solo-admin** con `requireAdmin` (los endpoints admin devuelven **401 sin token**) y el link de
navbar oculto para el visitante no logueado. Sin `auth` la parte pública funciona igual (datos
sembrados, editables a mano en `data/*.json`). El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `blogcms` | **Blog administrable** (`usesAnime`): página pública `/blog.html` que **lista los artículos publicados traídos del servidor** (colección `posts`) con buscador (filtra en el server por título/categoría/extracto), **chips de filtro por categoría** y apertura del artículo completo en la misma página (`?post=<id>`, enlace directo compartible) sumando una **visita real** (`POST /:id/view`). Portada opcional por URL. Con `auth`: ABM `/blog-admin.html` (escribir, editar, publicar/despublicar, borrar). Se siembran 2 artículos. Revelado de tarjetas y artículo con `anime.stagger` + red de seguridad. **Distinto de `blog`/`blogpages`** (UI estática con artículos fijos en el HTML) y de `comments`: acá el negocio escribe y administra sus novedades desde la web y se sirven dinámicamente |
| `shipping` | **Cotizador de envío por zona** (`usesAnime`): sección en la Home donde el visitante **elige su provincia** y el servidor devuelve **costo y plazo** buscando la zona que la abarca (colección `shippingzones`), con **envío gratis opcional por monto**. El costo sube con count-up de Anime.js. `GET /quote?province=` (422 provincia inválida, 404 si ninguna zona la cubre), `GET /provinces`. Con `auth`: ABM `/envios-admin.html` de zonas (nombre, provincias por casilleros, costo, días, umbral de envío gratis). Se siembran 3 zonas (CABA/GBA, Centro, Resto). Lista de 24 provincias de Argentina editable. Pieza clásica de e-commerce que **no existía**. **Distinto de `branches`** (sucursales físicas) y `map` |
| `listings` | **Directorio de avisos / clasificados** (`usesAnime`): página pública `/avisos.html` que lista avisos publicados (colección `listings`) con buscador (server), filtro por categoría y **detalle con visitas reales** (`?aviso=<id>`). Cada aviso: título, categoría, **precio** (0 = "A convenir"), ubicación, descripción, imagen opcional. Con `auth`: ABM `/avisos-admin.html` (crear/editar/publicar/borrar). Se siembran 3 (inmueble, vehículo, servicio). Sirve para inmobiliarias, concesionarias, marketplaces y directorios profesionales. **Distinto de `products-admin`** (catálogo e-commerce con stock/carrito) y `catalogo`/`productcompare` (UI estática) |
| `menu` | **Carta / menú de restaurante** (`usesAnime`): página pública `/carta.html` con los platos publicados **agrupados por categoría** en orden gastronómico (Entradas → Principales → … → Postres → Bebidas), con precio, descripción, **etiquetas de dieta** (vegetariano/vegano/sin TACC/picante) y buscador que filtra en el servidor (colección `menuitems`). Cada plato se marca **"no disponible hoy"** sin borrarlo. Con `auth`: ABM `/carta-admin.html` (crear/editar/pausar/borrar, casilleros de etiquetas). Se siembran 6 platos. Aparición de secciones con `anime.stagger` + red de seguridad. Pieza clave para restaurantes/bares/cafeterías que **no existía**. **Distinto de `products-admin`** (e-commerce con carrito) y `pricing`/`catalogo` (UI estática): administra la carta, sin carrito |

Todo probado: registro (**100 UI · 46 funcionales = 146 módulos**), 3 variantes generadas
(full = hero + reveal/Motion + auth + los-4 = 36 archivos con **Anime y Motion conviviendo** y las 6
páginas nuevas —`blog`, `blog-admin`, `avisos`, `avisos-admin`, `carta`, `carta-admin` + la sección
de envío en la Home— y 16 JS; sin-auth = 21 archivos, 10 JS, parte pública sin paneles pero con
`/blog.html`, `/avisos.html` y `/carta.html`; Vercel+Supabase + auth + los-4 = 39 archivos, 17 JS,
con las 4 colecciones nuevas —`posts`, `shippingzones`, `listings`, `menuitems`— en `schema.sql`),
**syntax-check de los 43 JS** generados de las tres variantes con `vm.Script` (0 errores), inlineado
seguro (0 `</script>`/`</style>` en `app.js`). **Prueba de backend real** sirviendo el proyecto full
en Express (:4933), **48 asserts en verde**: blogcms (2 sembrados, listado sin `body`, `categorias` 2,
`GET /:id` con body, `view` +1, inexistente 404, `all/list` 401 sin token, alta 201, inválido 422,
despublicar → no aparece en público pero admin ve 3, borrar → 2); shipping (`provinces` 24, quote
Bs As 2500/CABA-GBA con freeFrom, Córdoba 4200, provincia inválida/mal escrita 422, admin 401 sin
token, 3 zonas, alta descarta provincia inválida, costo negativo 422, borrar); listings (3 sembrados,
listado sin `description`, detalle con description, `view`, filtro `?cat=` y `?q=` 1 resultado, admin
401, alta 201, descripción corta 422, borrar); menu (6 sembrados, `?q=risotto` 1, admin 401, alta 201
con **tags saneados** —descarta "inventado"—, precio negativo 422, pausar, borrar → 6). **Smoke test
en navegador real** (:4933): cero errores de consola en Home + las 3 páginas públicas + un panel admin;
`anime` y `Motion` cargados; `/carta.html` renderiza 4 categorías en orden, 6 platos, 7 etiquetas;
`/blog.html` 2 tarjetas + 3 chips, click abre el artículo con contador "2 lecturas" y `?post=`;
`/avisos.html` 3 tarjetas, precios formateados ("A convenir"/`$12.500.000`), detalle; **cotizador de
envío por UI** (Buenos Aires → costo animado `$2.500`, zona "CABA y GBA", aviso de envío gratis desde
$40.000); login admin → `/carta-admin.html` con 6 filas, 4 casilleros de etiquetas y link admin visible.
Sin módulos revertidos.

### Pendiente / sugerencias para la próxima corrida
- **`blogcms`**: no tiene paginación (lista todos los publicados); para blogs grandes conviene
  `?page=`/`?limit=` o scroll infinito. Se podría integrar `comments` por artículo (ya existe el
  módulo) y sumar imagen destacada con subida a `public/` en vez de URL. El buscador es substring
  simple (mismo caso que `kb`). Un RSS del blog (reusando el módulo `rss`) cerraría el ciclo de
  contenido.
- **`shipping`**: una provincia puede quedar en dos zonas (el `find` toma la primera); el ABM podría
  avisar de solapamientos. Hoy no calcula por código postal (el campo es informativo): para envíos
  más finos, mover a rangos de CP. Si `cart`/`pos` están activos, el carrito podría **usar el
  cotizador** para sumar el envío al total (llamar a `/api/shipping/quote` desde el checkout). La
  lista de provincias es de Argentina: parametrizarla por país desde el Builder.
- **`listings`**: una sola imagen por aviso (URL); una galería por aviso (varias imágenes) y un
  campo de contacto/WhatsApp por aviso lo acercarían a un marketplace real. Podría sumar orden
  (precio, más nuevos, más vistos) y rango de precio en el filtro. Si crece, paginación como en
  `blogcms`.
- **`menu`**: el orden de categorías es una constante (`ORDEN`) en el `clientJs`; se podría hacer
  editable (campo `orden` por categoría) desde el admin. Una foto por plato (URL) y un botón
  "pedir por WhatsApp" (reusando `whatsappform`) sumarían. Si el restaurante tiene varios locales
  con cartas distintas, atar el plato a `branches`.
- **Molde ABM público+admin**: `blogcms`, `listings` (y `kb` de la 22ª) comparten casi todo el molde
  (listado público con buscador/filtro server + detalle con contador de visitas + ABM admin con
  publicar/despublicar). El **helper compartido** que se viene sugiriendo desde la 19ª (un
  `adminPanel({coleccion, columnas, ...})` + un `publicList({endpoint, render})`) recortaría a la
  mitad estos módulos y ya son varios: conviene encararlo antes de sumar más CMS-like.
- **Verticales aún sin cubrir con backend**: **reserva de mesa con confirmación** (para el mismo
  rubro gastronómico de `menu`), **agenda de disponibilidad por servicio** (más fino que `bookings`),
  **cotizador de productos configurables** (el `estimator` UI es front-only), **portal de clientes**
  (login + ver sus pedidos/turnos/facturas en un solo lugar).

## Corrida 2026-07-14 (22ª)

Lote de **4 módulos funcionales nuevos, todos con backend real** (directiva vigente: prohibido
sumar funcionalidad no visual sin backend). Los 4 usan **Anime.js** (`usesAnime`) con red de
seguridad. El foco fue **contenido, prueba social y cierre de dos huecos ya marcados**: se
sumaron dos módulos netos y nuevos (testimonios moderados y un centro de ayuda administrable) y
se cerraron los dos huecos que la corrida anterior había dejado anotados — `quote` (UI) y `jobs`
(UI) **capturaban** pedidos/postulaciones pero **sin ninguna gestión posterior**. En vez de
duplicar el alta, los dos módulos de gestión **reusan la misma colección** vía `requires` y solo
agregan el panel admin. Cada módulo funciona anónimo donde corresponde y, con `auth` activo, suma
gestión **solo-admin** con CSV. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `usertestimonials` | **Testimonios moderados** (`usesAnime`): sección en la Home con un **muro de testimonios ya aprobados** (revelado con stagger de Anime.js + count-up de cuántos hay) y un formulario para que cualquier visitante deje el suyo (nombre, rol/empresa, texto y **estrellas opcionales** con selector propio). Lo enviado queda **`pending`** y **no** se publica hasta que un admin lo aprueba. Con `auth`: `/testimonios-admin.html` solo-admin para **aprobar / rechazar / borrar**, filtrar por estado y CSV. Se siembran 2 aprobados. Colección `testimonials`. **Distinto de `reviews`** (reseñas con estrella atadas a producto/compra), `testimonials` UI (decorativo) y `qanda` (preguntas del público): acá el cliente deja una recomendación curada que el negocio modera antes de publicar |
| `kb` | **Centro de ayuda / base de conocimiento** (`usesAnime`): página pública `/ayuda.html` con **buscador que filtra en el servidor** (`?q=` sobre título+categoría+contenido), artículos **agrupados por categoría** en **acordeón** (abre/cierra con Anime.js) y **contador de visitas real** (POST `/:id/view`, una vez por apertura). Los artículos los escribe el negocio: con `auth`, `/ayuda-admin.html` es un **ABM** (crear, editar, **publicar/despublicar**, borrar) con datalist de categorías. Se siembran 4 artículos. Colección `kbarticles`. **Distinto de `faq`** (lista fija y estática) y `qanda` (preguntas del público): es documentación propia, organizada y buscable |
| `quotesadmin` | **Gestión de presupuestos** (`usesAnime`, `requires: ['quote']`): panel **solo-admin** `/presupuestos.html` sobre los pedidos que ya captura el módulo *Pedido de presupuesto* (colección `quotes`), **sin duplicar el alta**. Suma flujo de estados **nuevo → cotizado → aceptado / rechazado**, **nota interna**, filtro, CSV y **resumen animado** (total y pendientes con count-up). Normaliza pedidos viejos sin estado a `nuevo`. Endpoints admin (`/api/quotes-admin`) **401 sin token**. Sin `auth` no hay panel (los pedidos se siguen guardando). **Cierra el hueco** anotado en la 21ª |
| `jobsadmin` | **Gestión de postulaciones** (`usesAnime`, `requires: ['jobs']`): panel **solo-admin** `/postulaciones.html` sobre las postulaciones que captura *Trabajá con nosotros* (colección `applications`), **sin duplicar el alta**. Estados **nuevo → en revisión → entrevista → contratado / descartado**, nota interna, **filtro por estado y por puesto** (derivado de los datos), CSV, resumen con count-up y **link al CV**. Endpoints admin (`/api/applications-admin`) **401 sin token**. Sin `auth` no hay panel. **Cierra el hueco** anotado en la 21ª |

Todo probado: registro (**100 UI · 42 funcionales = 142 módulos**), 3 variantes generadas
(full = hero + reveal/Motion + auth + los-4 (+ `quote`/`jobs` traídos por `requires`) = 40 archivos
con **Anime y Motion conviviendo**, 20 JS; sin-auth = 23 archivos, 12 JS, parte pública con
`/ayuda.html` y la sección de testimonios pero **sin ningún panel admin**; Vercel+Supabase + auth
+ los-4 = 43 archivos, 21 JS, con las colecciones nuevas —`testimonials`, `kbarticles`— y las
compartidas —`quotes`, `applications`— en `schema.sql`), `node --check` en **todos los JS** de cada
variante (0 errores), inlineado seguro (0 `</script>`/`</style>` en `app.js`). **Prueba de backend
real** sirviendo el proyecto full en Express (:4931), **44 asserts en verde**: testimonials (muro
público arranca con 2 sembrados **sin campos internos**, `stats` 2, envío 201 queda pendiente y
**no** aparece hasta aprobar, mensaje corto 422, rating 9 → 422, `all` 401 sin token / 200 con admin
ve los 3, aprobar → público muestra 3, estado inválido 422, borrar → vuelve a 2); kb (arranca con 4,
`?q=pago` filtra en server, `view` +1 y persiste, view a inexistente 404, `all` 401, alta como
**borrador no aparece** en público, publicar → aparece, PATCH título inválido 422, borrar);
quotesadmin (alta pública por `quote` 201, `/api/quotes-admin` 401 sin token, lista 1 en `nuevo`,
`stats` total/pendientes, PATCH estado+nota, pendientes baja a 0, estado inválido 422, filtro
`?status=`); jobsadmin (alta pública por `jobs` 201, admin 401 sin token, lista 1 en `nuevo`, PATCH
a `entrevista`+nota, **filtro por puesto**, PATCH vacío 422, `stats`). **Smoke test en navegador
real** (:4932): cero errores de consola en Home + las 5 páginas nuevas; `anime` y `Motion`
cargados; Home renderiza el muro (2 cards + count 2) y el selector de 5 estrellas; `/ayuda.html`
lista 3 categorías / 4 artículos, el acordeón abre y **la visita sube 0 → 1** persistida, la
búsqueda server devuelve 2 para "envíos"; **envío de testimonio por UI** (estrellas 5 → submit →
caja de éxito) **persistido como `pending` con rating 5**; los 4 paneles admin renderizan con datos
vivos (testimonios: filtro `pendientes` 0 / `todos` 2 con botones aprobar-rechazar-borrar tras
**arreglar** que traía solo el subconjunto filtrado; ayuda-admin 4 filas + form; presupuestos 1 fila
con select de estado + botón de nota + KPI; postulaciones 1 fila con filtro de puesto de 2 opciones)
y los links admin quedan **ocultos para el visitante no logueado**. Sin módulos revertidos.

### Pendiente / sugerencias para la próxima corrida
- **`usertestimonials`**: la pregunta/segmentación es global; se podría permitir asociar el
  testimonio a un producto/servicio (si `products-admin` está activo) o pedir una foto/logo (subida
  a `public/`). Notificar al admin por email cuando entra uno nuevo (Resend free tier). Hoy no hay
  dedupe: alguien podría spammear varios (agregar honeypot o límite por navegador como `nps`).
- **`kb`**: el buscador filtra por substring simple; para catálogos grandes convendría un índice o
  destacar coincidencias. Se podría sumar "¿te resultó útil?" por artículo (reusando `feedback`) y
  ordenar los artículos por visitas. El slug/enlace directo a un artículo (`/ayuda.html?a=<id>` que
  auto-abra el acordeón) facilitaría compartir respuestas puntuales.
- **`quotesadmin` / `jobsadmin`**: comparten casi todo el molde (tabla + select de estado + nota +
  CSV + resumen KPI). Con estos dos ya son **muchos** módulos admin repitiendo navbar-oculta + CSV +
  tabla; el **helper compartido** que se viene sugiriendo desde la 19ª rinde cada vez más — un
  `adminPanel({coleccion, columnas, estados, csv})` recortaría a la mitad estos módulos. Ambos
  podrían notificar por email al cambiar de estado (se ata a la sugerencia vieja de email
  transaccional) y mostrar una **línea de tiempo** de cambios de estado (hoy solo queda el último).
- **Molde `requires` para "gestión sobre captura"**: quedó demostrado que se puede **cerrar un hueco
  de gestión** sin duplicar el alta (reusar colección + `requires`). Mismo patrón serviría para
  cualquier otro UI que hoy capture sin panel (revisar `contact`/`inbox` u otros formularios sueltos).

## Corrida 2026-07-14 (21ª)

Lote de **4 módulos funcionales nuevos, todos con backend real** (directiva vigente: prohibido
sumar funcionalidad no visual sin backend). Los 4 usan **Anime.js** (`usesAnime`) con red de
seguridad. El foco fue **medir satisfacción, captar y post-venta de e-commerce**: dos huecos
clásicos del catálogo (devoluciones y garantía) que cualquier tienda online necesita, más la
métrica NPS y un lead magnet con captura de email. Se evitó pisar lo existente: ya había módulos
que **guardan** pedidos de presupuesto (`quote`, UI) y postulaciones (`jobs`, UI) pero sin panel
admin, así que esos no se tocaron. Cada módulo funciona anónimo (parte pública) y, con `auth`
activo, suma gestión **solo-admin** (página propia o sección condicional en la misma página) con
listado/gestión y CSV. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `nps` | **Encuesta NPS** (`usesAnime`): sección en la Home con la escala **0 a 10** + comentario opcional. El servidor guarda cada respuesta clasificándola (promotor 9-10 / pasivo 7-8 / detractor 0-6) y calcula el **NPS en vivo** (`%promotores − %detractores`); el puntaje sube con count-up y las barras de distribución se animan. Un voto por navegador (localStorage). Con `auth`: `/nps.html` solo-admin con el resumen (NPS + totales), la lista de respuestas con comentarios, filtro por categoría y CSV. Colección `npsresponses`. **Distinto de `feedback`** (¿te resultó útil? por página, sí/no) y de `polls` (encuesta de opción múltiple): mide la métrica NPS clásica |
| `leadmagnet` | **Descargable con registro** (`usesAnime`): sección en la Home que ofrece material (guías, catálogos, plantillas — constante `RECURSOS`) **a cambio del email**; al dejarlo, el servidor registra la captura (idempotente por recurso+email) y **recién ahí devuelve el enlace de descarga**, más cuánta gente ya lo descargó (prueba social, count-up). Con `auth`: `/descargas.html` solo-admin con los emails captados por material, filtro y CSV. Colección `downloadleads`. **Distinto del módulo UI "Recursos descargables"** (lista de enlaces abiertos, sin captura) y de `leads` (captación genérica): el email desbloquea un archivo concreto y mide la demanda de cada material |
| `returns` | **Devoluciones y cambios (RMA)** (`usesAnime`): página `/devoluciones.html` donde el cliente pide una devolución/cambio (comprobante + producto + motivo + tipo) y recibe un código `RTN-XXXXXX` para **seguir el estado** (Solicitada → Aprobada → Recibida → Resuelta, con "Rechazada" como cierre alternativo) como línea de progreso animada. La vista pública **no expone el email**. Con `auth`: la misma página suma un panel solo-admin para aprobar/rechazar, cambiar estado, dejar nota y CSV. Colección `returns`. **Distinto de `ordertrack`** (pedido que emite el negocio) y de `tickets` (soporte genérico): acá el cliente inicia la devolución de un producto ya comprado |
| `warranty` | **Registro de garantía** (`usesAnime`): página `/garantia.html` donde el cliente registra un producto (serie **única** + fecha de compra) y el sistema calcula el **fin de cobertura** (compra + `MESES`, 12 por defecto). Después consulta por número de serie y ve el estado (**Vigente / Vencida / Reclamada**, derivado de las fechas) con una **barra de tiempo transcurrido** animada. La vista pública no expone nombre ni email. Con `auth`: panel solo-admin con todos los registros, marcado de "reclamada" con nota y CSV. Colección `warranties`. **Distinto de `returns`** (devolución) y `ordertrack` (seguimiento de pedido): registra la cobertura de un producto ya comprado |

Todo probado: registro (**100 UI · 35 funcionales = 135 módulos**), 3 variantes generadas
(full = hero + reveal/Motion + auth + los-4 = 33 archivos con **Anime y Motion conviviendo**, 18 JS;
sin-auth = 20 archivos, 11 JS, parte pública sin paneles pero con `/devoluciones.html` y
`/garantia.html`; Vercel+Supabase + auth + los-4 = 36 archivos, 19 JS, con las 4 colecciones nuevas
en `schema.sql`), `node --check` en **todos los JS** de cada variante (0 errores), inlineado seguro
(0 `</script>`/`</style>` en `app.js`). **Prueba de backend real** sirviendo el proyecto full en
Express (:4821): NPS (summary vacío, voto 10 → NPS 100, voto 4 → NPS 0, score 11 → 422, `all`
sin token 401); leadmagnet (list, desbloqueo 201 con url, idempotente 200, recurso inexistente 404,
email inválido 422); returns (alta 201 con código, kind inválido 422, consulta pública **sin email**,
código inexistente 404, `all` 401 sin token y con admin lista, PATCH a `rechazada`+nota, estado
inválido 422, el público refleja "rechazada"); warranty (alta 201 con cobertura calculada, **serie
duplicada 409**, fecha futura 422, consulta pública **sin PII** con status `vigente`, compra vieja →
`vencida` derivado, serie inexistente 404, `all` 401 sin token, filtro `?status=vigente`, PATCH
marca `reclamada`, el público refleja "reclamada"). **Smoke test en navegador real** (:4821): cero
errores de consola en Home + las 3 páginas; `anime` y `Motion` cargados; Home renderiza NPS (11
botones 0-10) y leadmagnet (3 cards con contador vivo); voto NPS por UI → gracias + score **33**
count-up + 3 barras (67/0/33 %); alta de devolución por UI → código `RTN-…` y línea de progreso de
4 pasos; alta de garantía por UI → cobertura calculada, chip "Vigente" y barra al **25 %** (3 de 12
meses); los 4 paneles admin renderizan con datos vivos (NPS con resumen+3 filas, returns 2 filas con
selects de estado, descargas 1 fila con filtro, garantía 3 filas con checks de "reclamada") y las
secciones admin quedan **ocultas para el visitante no logueado**. Sin módulos revertidos.

### Pendiente / sugerencias para la próxima corrida
- **`nps`**: un voto por navegador (localStorage), sin dedupe fuerte del lado servidor (mismo caso
  conocido que `polls`/`feedback`). Se podría segmentar el NPS por página (guardar `page` en la
  respuesta) o integrarlo al módulo `stats`. La pregunta ("¿nos recomendarías?") es fija: se podría
  parametrizar desde el Builder.
- **`leadmagnet`**: los archivos son placeholders (`/descargables/…`) que el cliente sube a
  `public/descargables/`. Podría postear también a `/api/leads` con origen `leadmagnet` (mismo patrón
  de 2 líneas que `waitlist`/`exitpopup`) para unificar la captación, y mandar el enlace por email
  (Resend free tier) en vez de mostrarlo en pantalla. Hoy la descarga no está protegida: quien tenga
  la URL la baja sin dejar email (el gate es sólo de UI); si se quiere gating real, servir el archivo
  detrás de un endpoint que verifique la captura.
- **`returns`**: el motivo de la devolución no se muestra en la vista pública (sí en el panel admin
  vía `title`). Podría notificar al cliente por email en cada cambio de estado (se ata a la sugerencia
  vieja de email transaccional). Si `cart`/`ordertrack` están activos, el cliente podría elegir el
  pedido a devolver desde su historial en vez de tipear el comprobante a mano.
- **`warranty`**: la cobertura es un único plazo global (`MESES`); si hay productos con garantías
  distintas, mover `MESES` a una tabla por producto (o tomarlo de `products-admin` si está activo).
  Podría avisar por email cuando la garantía está por vencer. El registro lo hace el cliente; si
  `pos`/`cart` están activos, se podría registrar la garantía automáticamente al cerrar la venta.
- **Patrón admin-por-auth**: `nps` y `leadmagnet` usan **página admin propia** (como `callback`);
  `returns` y `warranty` usan **sección admin condicional en la misma página** (como `tickets`). Sigue
  repitiéndose el molde de navbar-oculta + CSV + tabla; el helper compartido que se viene sugiriendo
  desde la 19ª/20ª sigue pendiente y cada vez rinde más.
- **Huecos detectados que ya tienen captura pero no gestión**: `quote` (UI, colección `quotes`) y
  `jobs` (UI, colección `applications`) **guardan** los envíos pero no tienen panel admin. Un próximo
  lote podría sumarles gestión solo-admin (estado + CSV) sin duplicar el alta, o migrarlos a módulos
  funcionales con el molde actual.

## Corrida 2026-07-14 (20ª)

Lote de **4 módulos funcionales nuevos, todos con backend real** (directiva vigente: prohibido
sumar funcionalidad no visual sin backend). Los 4 usan **Anime.js** (`usesAnime`) con red de
seguridad. El foco fue **relación con el cliente y post-venta**: pedir contacto, fidelizar,
generar demanda con un sorteo y dar visibilidad del pedido — piezas muy comunes en sitios
comerciales que todavía faltaban. Cada uno funciona anónimo (parte pública) y, con `auth` activo,
suma un **panel solo-admin en su propia página** con listado/gestión y CSV (mismo molde condicional
de `tickets`/`restock`, navbar oculta para no-admin). El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `callback` | **Solicitar llamada ("te llamamos")** (`usesAnime`): sección en la Home con nombre + teléfono + **franja horaria** (constante `FRANJAS`) + motivo opcional. El servidor guarda el pedido con estado `pendiente` y devuelve el total de pedidos como **prueba social** (count-up). Con `auth`: página `/llamadas.html` solo-admin con la cola, filtro pendiente/contactado, botón **"marcar contactado"** (PATCH) y CSV; el teléfono es clickeable (`tel:`). Colección `callbacks`. **Distinto de `contact`** (mensaje escrito), `bookings` (turno con fecha) e `inbox` (bandeja): acá el cliente pide explícitamente que lo llamen |
| `loyalty` | **Tarjeta de fidelidad (sellos)** (`usesAnime`): el visitante se suma con su email y ve su tarjeta con la **barra de progreso** y los sellos hacia el premio (constantes `META`/`PREMIO`). Alta/consulta idempotente por email. Los sellos los carga el negocio: con `auth`, página `/fidelidad.html` solo-admin para buscar por email, **+1 sello** (PATCH) y **canjear** el premio (POST; reinicia sellos, cuenta canjes, `409` si no llegó a la meta) + CSV. Colección `loyaltycards`. El visitante **nunca** puede sumarse sellos solo. Patrón clásico de cafés/peluquerías |
| `raffle` | **Sorteo** (`usesAnime`): participación por email (idempotente) con contador de participantes en vivo. El **ganador se elige al azar en el servidor** con `crypto.randomInt` (nunca en el navegador); al sortear, el sorteo **se cierra** a nuevas participaciones (`409`) y el ganador se muestra en la Home con el **email enmascarado**. Con `auth`: `/sorteo.html` solo-admin lista participantes, botón **"Sortear ganador"**, **reabrir** (borra la tirada) y CSV. Colecciones `raffleentries` + `raffledraws`. **Distinto de `polls`/`quiz`** (votación/recomendador sin premio ni ganador) |
| `ordertrack` | **Seguimiento de pedidos** (`usesAnime`): página pública `/seguimiento.html` donde el cliente ingresa el código `OT-XXXXXX` (o llega con `?code=` en la URL) y ve el estado como **línea de progreso animada** (Recibido → En preparación → Enviado → Entregado, con `cancelado`). Los pedidos los **crea el negocio**: con `auth`, `/pedidos.html` solo-admin da de alta (genera el código), cambia estado y agrega nota + filtro y CSV. Se **siembra** `OT-DEMO01` la primera vez. La vista pública solo muestra nombre de pila y estado, **nunca el email**. Colección `orders`. **Distinto de `tickets`** (el visitante abre el reclamo): acá el negocio emite el código y el cliente sigue su pedido, como el tracking de una tienda online |

Todo probado: registro (**100 UI · 31 funcionales = 131 módulos**), 3 variantes generadas
(full = hero + reveal/Motion + auth + los-4 = 34 archivos con **Anime y Motion conviviendo** y las 4
páginas admin; sin-auth = 19 archivos, parte pública sin paneles pero con `/seguimiento.html`;
Vercel+Supabase + auth + los-4 = 37 archivos con las 5 colecciones nuevas en `schema.sql`),
`node --check` en **todos los JS** de cada variante (0 errores), inlineado seguro
(0 `</script>`/`</style>` en `app.js`). **Prueba de backend real** sirviendo el proyecto full en
Express (:4720): GET públicos OK; callback (alta 201, slot inválido 422, `stats` sube); loyalty
(alta idempotente, email inválido 422, +1 sello ×10, canje reinicia sellos y suma `redemptions`,
canje sin meta 409); raffle (participar idempotente `already`, `draw` elige ganador y **cierra**
—re-draw 409, participar 409—, público con email enmascarado `di***@mail.com`, `reopen`);
ordertrack (crear con código, `customer` faltante 422, PATCH estado + nota, estado inválido 422,
`cancelado`, público sin email). Los endpoints admin **401 sin token** y con token de admin
responden. **Smoke test en navegador real** (:4720): cero errores de consola; `anime` y `Motion`
cargados; las 3 secciones públicas de la Home renderizan con **datos vivos** (prueba social de
callback y contador de sorteo reflejando las altas previas); `/seguimiento.html?code=OT-DEMO01`
auto-consulta y dibuja la línea de progreso (4 pasos, "En preparación", relleno al 33 %). Sin
módulos revertidos.

### Pendiente / sugerencias para la próxima corrida
- **`callback`**: hoy no hay dedupe del lado servidor (permite pedir varias veces desde el mismo
  teléfono). Si molesta el spam, sumar idempotencia por teléfono con una ventana de tiempo, o un
  honeypot en el POST. Podría notificar al admin por email al entrar un pedido (Resend free tier).
- **`loyalty`**: el alta de sellos es manual desde el panel. Si `pos` está activo, se podría sumar
  un sello automático al cerrar una venta (llamar a `/api/loyalty/:id/stamp` desde ese flujo). El
  canje también podría registrar qué premio se entregó si hay más de uno.
- **`raffle`**: solo hay un sorteo activo a la vez. Para varios sorteos simultáneos, mover `PREMIO`
  a una colección con CRUD admin (como se sugirió para `polls`/`eventregister`). El aviso al ganador
  hoy es manual (email enmascarado en la Home); integrarlo con `newsletter`/email cerraría el ciclo.
- **`ordertrack`**: los pedidos se crean a mano en el panel. Si `cart` está activo, cada compra
  podría crear su pedido automáticamente (código + estado inicial) y mandar el link
  `/seguimiento.html?code=…` por email. Podría guardarse un historial de cambios de estado con
  fecha (hoy solo se guarda `updatedAt` del último cambio) para mostrar una línea de tiempo con
  fechas por paso.
- **Patrón admin-por-auth**: los 4 vuelven a compartir el molde (parte pública siempre + página
  admin condicional a `auth`). Ya son varios módulos con este esquema; si se repite mucho, evaluar
  un helper compartido para la navbar-oculta y el CSV (hoy cada módulo lo reimplementa).

## Corrida 2026-07-14 (19ª)

Lote de **4 módulos funcionales nuevos, todos con backend real** (directiva vigente: prohibido
sumar funcionalidad no visual sin backend). Los 4 usan **Anime.js** (`usesAnime`) con red de
seguridad. El foco fue **conversión, captación y demanda**: patrones muy pedidos en sitios
comerciales que faltaban con backend de verdad. Cada uno funciona anónimo (parte pública) y, si el
módulo `auth` está activo, suma un **panel solo-admin en su propia página** con listado/moderación y
CSV — mismo patrón condicional de `tickets`. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `eventregister` | **Inscripción a eventos con cupos** (`usesAnime`): sección en la Home que lista eventos (constante `EVENTOS` editable) y deja anotarse con nombre+email. El servidor controla el cupo, es **idempotente por evento+email** y devuelve un código `EV-XXXXXX`; los lugares disponibles bajan en vivo con count-up. Con `auth`: página `/inscripciones.html` solo-admin con listado por evento, filtro y CSV. Colección `eventregistrations`. **Distinto de `events`** (UI decorativa) y de `bookings` (turnos): acá el visitante reserva lugar en un evento con cupo |
| `referrals` | **Programa de referidos** (`usesAnime`): "Recomendá y ganá". El visitante deja su email y obtiene un **código + link para compartir** (`tusitio.com/?ref=CODIGO`, con botones de WhatsApp/email y copiar). Al llegar alguien por ese link y anotarse, se **acredita el referido** a quien invitó (colecciones `referrals` + `referralhits`, conteo real, **un crédito por email referido**, bloquea auto-referencia). Contador con count-up. Con `auth`: ranking solo-admin en `/referidos.html` con CSV. **Distinto de `leads`/`newsletter`** (captación simple): hay mecanismo de invitación con crédito |
| `qanda` | **Preguntas del público con moderación** (`usesAnime`): muro tipo Q&A. El visitante deja una pregunta que queda **pendiente**; solo las respondidas y publicadas se muestran, en un **acordeón** que abre/cierra con Anime.js. Colección `questions`. Con `auth`: página `/preguntas.html` solo-admin para responder, publicar (checkbox) y borrar. **Distinto de `faq`** (lista fija tuya), `tickets` (soporte privado) y `comments` (blog): es un muro público moderado |
| `restock` | **Avisos de stock** (`usesAnime`): "Avisame cuando vuelva". Lista productos agotados (constante `PRODUCTOS` editable); el visitante deja su email y ve **cuánta gente lo espera** (prueba social, count-up). Idempotente por producto+email. Colección `restockrequests`. Con `auth`: página `/avisos-stock.html` solo-admin con interesados por producto, botón **"marcar como avisados"** (PATCH) y CSV para mandar el mail al reponer. Mide demanda de lo agotado |

Todo probado: registro (**100 UI · 27 funcionales = 127 módulos**), 3 variantes generadas
(full = hero + reveal/Motion + auth + los-4 = 33 archivos con **Anime y Motion conviviendo** y las 4
páginas admin; sin-auth = 18 archivos, parte pública sin paneles; Vercel+Supabase + auth + los-4 =
35 archivos), `node --check` en **los 18 JS** de cada variante (0 errores), inlineado seguro
(0 `</script>`/`</style>` en `app.js`). **Prueba de backend real** sirviendo el proyecto full en
Express (:4713): GET públicos OK; inscripción a evento (válido 201, idempotente `already:true`,
cupo baja, email inválido 422, evento inexistente 404); referidos (join idempotente, refer acredita,
duplicado `dup`, auto-referencia `self`, código inexistente 404, stats públicas); qanda (envío 201,
muy corta 422, público vacío hasta publicar, admin responde+publica → público lo muestra); restock
(pedido 201, idempotente, `waiting` sube, admin marca avisados → baja a 0); los 4 endpoints admin
**401 sin token** y con token de admin devuelven las filas. **Smoke test en navegador real**: cero
errores de consola; `anime` y `Motion` cargados; las 4 secciones renderizan con **datos vivos del
servidor** (el evento con 29 lugares reflejando el alta previa, la pregunta publicada por admin, el
restock en 0 tras marcarlo avisado); flujo de referidos completo por UI (submit → panel con link
`?ref=7NBEAM` válido → count-up → copiar), persistido en el servidor. Sin módulos revertidos.

### Pendiente / sugerencias para la próxima corrida
- **`eventregister`**: hoy los eventos son una constante en el route. Si se quiere que el admin
  cree/edite eventos desde la web, mover `EVENTOS` a la colección (seed la primera vez, como `polls`)
  y sumar CRUD en `/inscripciones.html`. También podría enviar el código de confirmación por email
  (Resend free tier) en vez de mostrarlo solo en pantalla.
- **`referrals`**: la acreditación se dispara cuando el referido se **anota al programa**. Se podría
  acreditar también en otras conversiones (registro con `auth`, primer pedido con `cart`) llamando a
  `/api/referrals/refer` desde esos flujos si hay `rf-invitadoPor` en `localStorage`. El premio por
  referir es texto editable: se podría parametrizar en el Builder.
- **`qanda`**: sin `auth` la moderación es manual sobre el JSON; el acordeón anima por click (no hay
  reveal en cascada al cargar). Se podría sumar búsqueda/orden si crecen mucho las preguntas, y un
  honeypot anti-spam en el POST público.
- **`restock`**: el aviso real por email lo manda el admin con el CSV. Integrarlo con `newsletter` o
  un endpoint de email cerraría el ciclo (marcar avisado + disparar el mail en una sola acción). Los
  productos son una constante: si `products-admin` está activo, se podrían tomar los productos sin
  stock reales de esa colección.
- **Patrón admin-por-auth**: los 4 comparten el mismo esquema (parte pública siempre + página admin
  condicional a `auth` con navbar oculta para no-admin). Quedó consistente con `tickets`/`leads`; si
  se agregan más módulos de captación, reusar este molde.

## Corrida 2026-07-13 (18ª)

Lote de **4 módulos funcionales nuevos, todos con backend real** (directiva vigente: prohibido
sumar funcionalidad no visual sin backend) + **4 mejoras UX pedidas por el usuario en vivo**
durante la corrida. Los 4 módulos usan Anime.js (`usesAnime`) con red de seguridad. El detalle
técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `polls` | **Encuestas y votaciones** (`usesAnime`): encuesta en la Home con votos persistidos (`polls`/`pollvotes`), resultados en vivo que suman entre visitantes, barras + % en count-up. Siembra en el primer request. Un voto por navegador (localStorage; sin dedupe fuerte del lado servidor, avisado). Distinto de `quiz` (recomendador sin persistencia) |
| `tickets` | **Soporte con seguimiento** (`usesAnime`): `/soporte.html` — el visitante abre un reclamo, recibe código `TK-XXXXXX` y consulta el estado sin cuenta (timeline de 3 pasos animada; la vista pública no expone email/detalle). **Backend condicional**: con `auth` suma GET/PATCH admin + panel de gestión en la misma página. Distinto de `inbox` (bandeja sin ida y vuelta consultable) |
| `feedback` | **"¿Te resultó útil esta página?"** (`usesAnime`): widget al pie de todas las páginas con votos reales por página (`POST /api/feedback`, `GET /api/feedback/summary`) y porcentaje en count-up tras votar. Un voto por página por navegador |
| `leads` | **Captación de leads** (`requires: auth`): `POST /api/leads` público idempotente por email+origen + panel `/leads.html` solo-admin con filtro por origen y CSV. **Integración**: `waitlist` y `exitpopup` postean solos cuando está activo (cerró el pendiente de la 15ª/17ª de persistir esas capturas) |

Mejoras UX pedidas por el usuario (mismo día, entre medio de la corrida):

| Mejora | Nota |
|---|---|
| `pricing` animado | Pulgar deslizante en el switch mensual/anual (CSS transition medida por JS) + count-up/down del importe con Anime.js + pulso del precio + pop de la insignia. Red de seguridad `setTimeout(680)`; con `prefers-reduced-motion` pinta directo |
| Login/registro separados | `/auth.html` solo login, `/registro.html` solo registro, enlaces cruzados. IDs y clientJs intactos: ninguna redirección existente se rompió. `registro.html` y `leads.html` fuera del sitemap |
| Efectos de card seleccionables | `design.cardHover` en el Builder (sección C "Tipografía y efectos"): lift / glow / aurora / zoom / none, default lift retrocompatible byte a byte. Los efectos ya no dependen de `reveal` |
| Forms nunca se levantan | Exclusión por `.card:not(form):not(:has(form, input, select, textarea))` (fail-safe en navegadores sin `:has`). A cambio: anillo de foco animado en campos, `accent-color` en checks/radios (siempre) + pop al marcar |

Todo probado: registro (**100 UI · 23 funcionales**), 5 variantes generadas (solo-nuevos con glow,
full con Anime+Motion, Vercel+Supabase, tickets-sin-auth con aurora, y none sin hovers), `node --check`
en 77 archivos JS (0 errores), inlineado seguro. APIs con casos válidos e inválidos (voto, ticket
público/admin, feedback, leads idempotente; 201/200/401/404/422 según corresponde). **Smoke test en
navegador real** (:4712): cero errores de consola; encuesta y feedback con datos reales del servidor;
reclamo creado, consultado y gestionado como admin; leads filtrable; toggle de precios ida y vuelta con
pulgar y aria-pressed; auth/registro separados; exclusión de hover verificada en DOM (la única card de
la Home sin efecto es la de waitlist, que tiene form). Preview del Builder con glow/registro/fallback
verificados. Sin módulos revertidos.

### Pendiente / sugerencias para la próxima corrida
- **`polls`**: solo hay una encuesta activa a la vez en la UI (la primera activa). Si se quiere un
  CRUD de encuestas para el admin (crear/cerrar), encaja como sección en la misma página o en el
  panel admin. También se podría integrar el resultado al módulo `stats`.
- **`tickets`**: podría notificar por email al cliente al responder (hoy la respuesta se ve al
  consultar el código) — se ata a la sugerencia vieja de "notificación por email de la bandeja"
  (Resend free tier). El panel admin recarga toda la tabla al guardar; alcanza y sobra por ahora.
- **`feedback`**: un mini-reporte para el admin (páginas ordenadas por % de utilidad) sería un
  buen complemento de `stats`; hoy se consulta por API o mirando `data/feedback.json`.
- **`leads`**: `newsletterinline`/`multistep` podrían postear también a `/api/leads` con su origen
  (mismo patrón condicional de 2 líneas que waitlist/exitpopup).
- **Efectos**: si se piden más variantes de `cardHover` (tilt 3D, sombra de color, borde animado
  conic-gradient), el mecanismo ya está: agregar la clave en `CARD_FX` de `templates.js`, el `<option>`
  en el Builder y la validación en `generator.js`. También quedó la idea de efectos de **click** en
  cards (ripple) — hoy solo los botones tienen press.
- La **página de registro** no tiene link propio en la navbar (solo se llega desde el login):
  decisión deliberada; si algún cliente pide CTA de "Crear cuenta" en la navbar, es un cambio de
  2 líneas en `nav()` de auth.
- Nota de entorno (pane headless): además de `innerHeight:0` y el loop de Anime pausado, Chromium
  **no aplica estilos `:focus`** cuando la ventana no tiene foco del SO (aunque `document.activeElement`
  sí cambia), y la pestaña puede **volver sola a su URL semilla** entre llamadas — verificar por
  presencia de reglas CSS + selectores en DOM, y re-navegar antes de cada chequeo.

## Corrida 2026-07-12 (17ª)

Lote de **5 módulos UI nuevos**, todos frontend puro y sin dependencias npm nuevas en el proyecto
exportado. **4 de los 5 usan Anime.js** (`usesAnime`): `commandpalette`, `goalmeter`, `quiz` y
`waitlist`. El foco de este lote fueron **navegación rápida, conversión y prueba social** — patrones
muy usados en sitios comerciales que faltaban en el catálogo. Cerró dos ideas pendientes de la 16ª
(buscador global con atajos de teclado y comparador de productos lado a lado). El detalle técnico está
en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `commandpalette` | **Paleta de comandos (⌘K)** (`usesAnime`): capa de navegación rápida que se abre con `Ctrl/Cmd+K` o la tecla `/`, y con un botón `🔍 ⌘K` que se inyecta en la navbar. Indexa solo **las páginas** (links de la navbar), **las secciones** de la página actual (cada `<h2>`) y una lista editable de **acciones rápidas** (`ACCIONES`). Filtra en vivo (normaliza acentos), se navega con ↑↓ + Enter y cierra con Esc; diálogo accesible (`role=dialog`, `aria-modal`, foco atrapado, `aria-activedescendant`). Apertura con **Anime.js** + red de seguridad. **Distinto de `search`** (ese filtra tarjetas dentro de la página): este salta a cualquier parte del sitio |
| `productcompare` | **Comparador de productos lado a lado**: tarjetas seleccionables (hasta 3) que arman una **tabla enfrentada** de atributos con las filas distintas resaltadas (clase `.dif`). **HTML+CSS+JS puro, sin dependencias**. Productos y atributos editables en la constante `PRODUCTOS` (viajan embebidos en un `<script type="application/json">` con `<` escapado). **Distinto de `comparison`** (matriz fija de planes): acá el visitante elige qué comparar |
| `goalmeter` | **Barra de meta / objetivo** (`usesAnime`): progreso hacia una meta (recaudación, donaciones, cupos, objetivo del mes) con **barra que se llena** y **número que cuenta** hasta el valor actual cuando la sección entra en pantalla (`IntersectionObserver`). `role=progressbar` accesible. Valores editables en la constante `META` (viajan en atributos `data-`). El botón enlaza a Contacto/Presupuesto/Nosotros según qué esté activo. Animación con **Anime.js** + red de seguridad; sin animación muestra el estado final igual. **Distinto de `counters`/`skillbars`**: es un progreso concreto hacia un objetivo con unidad |
| `quiz` | **Quiz recomendador** (`usesAnime`): preguntas de opción única que suman votos por resultado y al final recomiendan el **más votado**, con un CTA. Barra de progreso, botón "volver a empezar" y fallback `<noscript>`. Preguntas y resultados editables en la constante `QUIZ` (embebidos como JSON). Transiciones entre pasos con **Anime.js** (stagger) + red de seguridad. El CTA enlaza a Precios/Contacto/Nosotros. **Distinto de `multistep`** (junta datos de un formulario): esto orienta una decisión de compra |
| `waitlist` | **Lista de espera / "próximamente"** (`usesAnime`): captación de emails para un lanzamiento con **contador de anotados** que cuenta hasta su valor al entrar en pantalla (prueba social). Al enviar valida el email, guarda en `localStorage`, **suma 1 al contador** (persiste el alta propia entre visitas) y agradece ocultando el formulario. Sin backend obligatorio (conectar a newsletter/endpoint para recibirlos de verdad). Textos y base editables en la constante `LISTA`. **Distinto de `newsletter`** (suscripción a novedades) y del popup de salida: es la sección de captación de un producto que aún no salió |

Todo probado: registro (**100 UI · 19 funcionales**), generación de 3 variantes (solo-los-5 = 14
archivos, con `anime.js`; full = hero + reveal/Motion + pricing + contact + navmobile + darkmode + los-5
= 20 archivos, con **Anime y Motion conviviendo**; y Vercel+Supabase + auth + cart + los-5 = 30 archivos),
`node --check` en fuente y en el `app.js` generado de las **tres** variantes (0 errores), inlineado seguro
(0 `</script>`/`</style>` en el `app.js`). **Smoke test en navegador real** (proyecto full generado servido
estático en :4711): **cero errores de consola**; los 5 módulos inicializan (`anime` y `Motion` ambos
cargados) e **interacción probada** — la paleta ⌘K abre con `Ctrl+K` (11 ítems), filtra a 1 con
"nosotros" y cierra con Esc; el comparador con 2 productos marcados arma la tabla (6 filas, 12 celdas
diferencia resaltadas); el goalmeter contó hasta `$68.000`; el quiz respondido 3 veces devolvió el
resultado "Plan Inicial"; y la lista de espera al enviar oculta el form y muestra el "listo". Sin módulos
revertidos.

### Pendiente / sugerencias para la próxima corrida
- **`commandpalette`**: hoy no indexa el contenido de otras páginas (solo la actual). Se podría
  generar un índice estático `search-index.json` en build (una entrada por sección de cada página) y
  cargarlo con `fetch` para buscar en todo el sitio. Evaluar si compensa la complejidad.
- **`productcompare`**: cuando los productos tengan imagen/enlace real, sumar una fila de miniatura y un
  botón "Elegir" por columna que lleve a la ficha/carrito. Cambio acotado.
- **`quiz`**: el resultado es el más votado; si se quisiera lógica por puntajes ponderados (cada opción
  suma distinto peso), alcanza con cambiar `valor` por `{peso, resultado}` y ajustar el conteo.
- Ideas de catálogo aún sin cubrir: **stepper/checkout visual multi-paso con resumen**, **testimonios en
  video (lightbox de YouTube/Vimeo sin autoplay)**, **selector de plan con toggle mensual/anual global**,
  **banner de urgencia en la barra superior con stock/cupos**, **comparador con más de 3 columnas en scroll horizontal**.
- La **captura de pantalla** del pane headless volvió a no usarse; la verificación se hizo por DOM/JS
  (más confiable para probar interacción) sirviendo el proyecto generado como estático en :4711.

## Corrida 2026-07-12 (16ª)

Lote de **5 módulos UI nuevos**, todos frontend puro y sin dependencias npm nuevas en el proyecto
exportado. **3 de los 5 usan Anime.js** (`usesAnime`): `masonry`, `agegate` y `socialfeed`. El foco
de este lote fue cubrir **conversión, prueba social y cumplimiento** — patrones que un sitio comercial
completo suele necesitar y que faltaban en el catálogo. Cerró tres de las ideas pendientes de la 15ª
(selector de moneda, galería mosaico/masonry, muro de reseñas masonry). El detalle técnico está en
[CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `currency` | **Selector de moneda** (sin JS extra de librería): convierte en vivo cualquier importe marcado con `class="js-precio"` y `data-ars="MONTO"` (monto base en pesos) a las monedas de la constante editable `MONEDAS` (ARS/USD/EUR/BRL con tasas fijas, sin API de cambio). Recuerda la elección en `localStorage` y conserva el sufijo `.price-per` (ej: "/mes") si existe. Trae una lista de precios de demo para que se vea/pruebe solo. **No pisa** los precios de `pricing` (esos usan `data-mensual`, no `js-precio`): son mecanismos independientes |
| `masonry` | **Galería mosaico/masonry** (`usesAnime`): tarjetas de alturas variables en columnas tipo Pinterest con **CSS `columns`** (layout puro CSS, sin librería de masonry). Placeholders con gradiente de proporciones distintas (constante `RATIOS`), reemplazables por `<img>`. Entrada en cascada con **Anime.js** disparada por `IntersectionObserver` + red de seguridad. Distinta de `gallery` (grilla uniforme) |
| `reviewswall` | **Muro de reseñas** (masonry de texto): muchas reseñas con estrellas, autor y origen en columnas `CSS columns`. **HTML+CSS puro, sin JS ni dependencias**. Reseñas editables en la constante `RESENAS`. Distinto de `testimonials` (grilla fija de 3) y `testimonialslider` (carrusel): este es un muro con opiniones de largos variables |
| `agegate` | **Verificación de edad (age gate)** (`usesAnime`): diálogo **bloqueante** al entrar que pide confirmar la mayoría de edad (rubros regulados: bebidas, vaping, apuestas). Accesible (`role=dialog`, `aria-modal`, foco al abrir, Tab atrapado, no cierra con Esc por ser bloqueante), bloquea el scroll del `html`/`body`. "Sí" recuerda en `localStorage` por `DIAS_RECORDAR` (30) y cierra con fundido **Anime.js** + red de seguridad; "No" muestra mensaje y deja bloqueado. `EDAD_MINIMA` editable. Se saltea en la vista previa del builder (`__PREVIEW__`) |
| `socialfeed` | **Feed social estilo Instagram** (`usesAnime`): grilla de casilleros cuadrados con overlay de "me gusta" al pasar el mouse/enfocar (CSS) y botón **"Seguinos @usuario"** que enlaza al perfil. Placeholders editables (sin API de Instagram, que requiere token/app aprobada): `USUARIO`, `PERFIL` y `POSTS` en el módulo. Entrada en cascada con **Anime.js** por `IntersectionObserver` + red de seguridad. Distinto de `gallery`/`masonry`: imita el feed de una red social con su CTA a seguir la cuenta |

Todo probado: registro (**95 UI · 19 funcionales**), generación de 3 variantes (solo-los-5 = 14
archivos, con `anime.js`; full = hero + reveal/Motion + pricing/gallery/lightbox + navmobile + darkmode +
seo + los-5 = 17 archivos, con **Anime y Motion conviviendo**; y Vercel+Supabase + auth + cart + los-5 =
30 archivos), `node --check` en fuente y en el `app.js` generado de las **tres** variantes (0 errores),
inlineado seguro (0 `</script>`/`</style>` en el `app.js`). **Smoke test en navegador real** (proyecto
generado servido estático): **cero errores de consola**; los 5 módulos inicializan (`anime` y `Motion`
ambos cargados) e **interacción probada** — el age gate **bloquea** el sitio al entrar (overlay +
`body.agegate-lock`) y al confirmar "Sí" se **quita** y desbloquea (guardado en `localStorage`); el
selector de moneda **convierte** los 3 precios de demo (ARS `$9.999` → USD `u$s 8,30`) y persiste la
elección; masonry (9 mosaicos), reviewswall (7 reseñas) y socialfeed (8 casilleros) renderizan. Sin
módulos revertidos.

### Pendiente / sugerencias para la próxima corrida
- **`masonry`/`socialfeed`**: hoy no se integran con el `lightbox` (ese apunta a `section img` y
  `#galeria .card`). Cuando tengan `<img>` reales, evaluar ampliar el selector de `lightbox` para
  incluir `.mosaic-item`/`.social-tile` (cambio de 1 línea, bajo riesgo).
- **`currency`**: las tasas son fijas y manuales. Si algún día se quiere actualizarlas solas sin
  backend, se podría documentar un fetch opcional a una API pública de tasas (ej: exchangerate.host)
  con fallback a las tasas fijas — pero eso agrega una dependencia de red, evaluar si compensa.
- Ideas de catálogo aún sin cubrir: **galería con filtro por etiquetas + lightbox integrado**,
  **comparador de productos lado a lado**, **stepper/checkout visual**, **buscador global con atajos
  de teclado**, **banner de urgencia con cuenta regresiva en la barra superior**.
- La **captura de pantalla** del pane headless volvió a no usarse; la verificación se hizo por DOM/JS
  (más confiable para probar interacción) sirviendo el proyecto generado como estático en :4599.

## Corrida 2026-07-12 (15ª)

Lote de **5 módulos UI nuevos**, todos frontend puro y sin dependencias npm nuevas en el proyecto
exportado. **4 de los 5 usan Anime.js** (`usesAnime`): `megamenu`, `multistep`, `catalogo` y
`exitpopup`. El foco de este lote fueron **patrones de navegación y conversión** que todo sitio
comercial usa y que faltaban en el catálogo. Además se corrigió un gap del preview del builder (ahora
inlinea también `anime.js`, no sólo `motion.js`). El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `megamenu` | **Menú desplegable / mega menú** (`usesAnime`): mejora progresiva sobre la navbar (no toca `layout()`). El JS inyecta en `.nav-links` un disparador con panel de submenús agrupados armado desde la lista editable `MENU`. Accesible (`aria-haspopup`/`aria-expanded`, teclado Enter/Espacio/Escape/flechas, Tab que cierra, clic afuera) y responsive: en escritorio flota bajo el disparador, en móvil o dentro del menú hamburguesa se despliega en línea. Apertura con **Anime.js** + red de seguridad; respeta `prefers-reduced-motion` |
| `multistep` | **Formulario multi-paso (wizard)** (`usesAnime`): `<form>` en pasos (`<fieldset>`) con barra de progreso, riel de indicadores (desde `data-titulo`), navegación Atrás/Siguiente y **validación por paso** (validación nativa del navegador: no avanza con campos inválidos). El último paso arma un resumen (`<dl>`) y al confirmar abre un **`mailto`** al `EMAIL_DESTINO` con todos los datos cargados (sin backend). Transición de paso y avance de barra con **Anime.js** + red de seguridad. Sin JS el form se ve completo |
| `catalogo` | **Catálogo filtrable** (`usesAnime`): grilla de tarjetas (constante `PRODUCTOS`) con **chips de categoría** armados desde `data-cat` y **buscador en vivo** (filtra por título y descripción); ambos se combinan, con mensaje "sin resultados". Entrada de tarjetas en cascada con **Anime.js** (`anime.stagger`) + red de seguridad. Distinto de `galleryfilters` (ese filtra la galería de imágenes; este es un catálogo de productos con precio y búsqueda de texto) |
| `exitpopup` | **Popup de salida (exit intent)** (`usesAnime`): detecta la intención de irse — `mouseout` por arriba en escritorio, o inactividad en táctil `(hover:none)` — y abre un diálogo accesible con captura de email. Frecuencia por `localStorage` (una vez por período). Sin backend guarda el email localmente y avisa por toast (el README explica cómo conectarlo). Apertura con **Anime.js** + red de seguridad. Complementa a `promo` (ese es por tiempo/scroll; este reacciona a la salida) |
| `megafooter` | **Mega footer (pre-footer)**: banda ancha antes del pie de copyright, con columna de marca (usa `cfg.brand`) + 3 columnas de enlaces/contacto. **HTML+CSS puro, sin JS ni dependencias**: `grid` que baja a 2 columnas en ≤860px y a 1 en ≤480px. Enlaces y datos editables en el HTML |

Todo probado: registro (**90 UI · 19 funcionales**), generación de 3 variantes (solo-los-5 = 14
archivos; full = hero + reveal/Motion + faq/pricing/contact/gallery/galleryfilters + navmobile +
darkmode + seo + los-5 = 20 archivos, con **Anime y Motion conviviendo**; y Vercel+Supabase + auth +
cart + los-5 = 30 archivos), `node --check` en fuente y en **todo** el JS generado de las tres
variantes (0 errores), inlineado seguro (0 `</script>`/`</style>` en el `app.js`). **Smoke test en
navegador real**: **cero errores de consola**; los 5 módulos inicializan e **interacción probada** —
el mega menú abre (`aria-expanded=true`); el wizard **bloquea** el avance con campos vacíos y **avanza**
al completarlos (barra 33%); el catálogo filtra por categoría y por búsqueda ("tienda" → 1 resultado);
el exit popup **abre** al simular `mouseout` por arriba con su input de email. Sin módulos revertidos.

### Pendiente / sugerencias para la próxima corrida
- **`megamenu`**: hoy los submenús se editan en `MENU` dentro de `app.js`; se podría permitir que
  otros módulos aporten sus enlaces al panel (API de registro de secciones en la navbar).
- **`exitpopup`/`multistep`**: la captura queda en `localStorage`/`mailto`. Si en algún momento se
  quiere persistencia real sin backend propio, evaluar integrarlos con el módulo funcional `newsletter`
  o `inbox` cuando estén activos (detectarlos por `cfg.moduleIds` y postear al endpoint).
- Ideas de catálogo aún sin cubrir: **selector de moneda** sobre los precios mostrados, **comparador de
  planes con toggle mensual/anual**, **muro de reseñas (masonry)**, **galería tipo mosaico/masonry**.
- La **captura de pantalla** del pane headless se colgó (renderer) en esta corrida; no bloqueó la
  verificación (se hizo por DOM/JS) pero conviene tenerlo en cuenta para próximas pruebas visuales.

## Corrida 2026-07-12 (14ª)

Lote de **5 módulos UI nuevos**, todos frontend puro y sin dependencias npm nuevas en el proyecto
exportado. **2 de los 5 usan Anime.js** (`usesAnime`: `modal` y `readmore`). El foco de este lote
fueron **utilidades reutilizables de UX** que faltaban en el catálogo (patrones de interacción que
cualquier sitio comercial usa). El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `lazyload` | **Carga diferida de imágenes**: marca todas las `<img>` con `loading="lazy"` + `decoding="async"` y las hace aparecer con un fundido suave al entrar en pantalla (IntersectionObserver, `rootMargin` 120px). Puro comportamiento, **no aporta HTML**. Mejora progresiva: sin JS las imágenes se ven igual; con `data-nolazy` se excluye una imagen; si ya está en caché no la oculta; red de seguridad `setTimeout(3000)`. Respeta `prefers-reduced-motion` |
| `modal` | **Ventanas modales** reutilizables y accesibles (`usesAnime`): un único overlay para todo el sitio, con foco atrapado (trap de Tab), cierre con Esc/clic afuera/botón y foco devuelto. Se abren con `data-modal-target="#id"` (clona el contenido de un bloque oculto) o con `window.abrirModal({titulo, html})`. Animación de apertura/cierre con **Anime.js** (escala + fundido) y red de seguridad `setTimeout` que fija el estado final si el loop está pausado. Sección de demo editable (términos y condiciones) |
| `readmore` | **Leer más/menos** (`usesAnime`): recorta cualquier contenedor con `data-readmore="N"` a N líneas con un degradado al pie y un botón para expandir/plegar, animando la **altura** con **Anime.js** (`inOutQuad`). Mejora progresiva: el recorte lo agrega el JS, así que sin él el texto queda completo y legible; si el texto ya entra, no recorta. Red de seguridad + respeta `prefers-reduced-motion`. Sección de demo editable |
| `tooltip` | **Globos de ayuda (tooltips)** accesibles: cualquier elemento con `data-tooltip="texto"` muestra un globo al pasar el mouse, al **enfocar por teclado** (`focusin`) o al **tocar** en móvil; se oculta al salir, con Esc o al scrollear. Globo único compartido, posicionado por JS para no salirse del viewport (arriba, o abajo si no entra) y vinculado con `aria-describedby`. Fundido por CSS (no anima en cada hover, por rendimiento). Sección de demo editable |
| `whatsappform` | **Formulario a WhatsApp**: formulario de contacto que, al enviar, valida y abre **wa.me** con el mensaje ya armado (nombre + consulta + contacto opcional) hacia el número del negocio. **Sin backend ni API keys** — ideal para captar consultas en sitios chicos deployados gratis. Distinto del botón flotante `whatsapp` (ese abre un chat vacío; este manda los datos del formulario). El número se edita en `public/js/app.js` (`NUMERO_WHATSAPP`) |

Todo probado: registro (**85 UI · 19 funcionales**), generación de 3 variantes (solo-los-5, 14 archivos;
full = hero + reveal/Motion + faq/pricing/contact/gallery + darkmode + seo + los 5, 20 archivos, con
Anime **y** Motion conviviendo; y Vercel+Supabase + auth + cart + los 5, 30 archivos), `node --check`
en fuente y en **todo** el JS generado de las tres variantes (0 errores), inlineado seguro (0
`</script>`/`</style>` en el JS). Se verificó que `anime.js` se emite al activar `modal`. **Smoke test
en navegador real** (proyecto full servido en `http://localhost`): **cero errores de consola**; los 5
módulos inicializan (`window.abrirModal` global + trigger presente, 1 bloque readmore recortado con su
botón, 3 términos con tooltip, formulario WhatsApp presentes); **interacción probada**: la modal abre
con título "Términos y condiciones" y contenido clonado y cierra por API; `readmore` alterna "Leer
más"↔"Leer menos"; el tooltip muestra el texto correcto y setea `aria-describedby` al hacer hover; y en
una página de prueba con imágenes reales `lazyload` aplicó `loading=lazy`/`decoding=async`, dejó la
imagen visible (`opacity:1`) y **respetó `data-nolazy`** (no la tocó). Sin módulos revertidos.

## Corrida 2026-07-12 (13ª)

Lote de **5 módulos UI nuevos**, todos frontend puro y sin dependencias npm nuevas en el proyecto
exportado. **2 de los 5 usan Anime.js** (`usesAnime`). El detalle técnico está en
[CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `skillbars` | **Barras de capacidades** (habilidades con %): sección con barras horizontales que crecen de 0 a su nivel al entrar en pantalla, animadas con **Anime.js** (`width: ['0%', nivel]`) y con el número de % sincronizado en `onUpdate`. El HTML ya trae el ancho final: sin librería o con `prefers-reduced-motion` se ven completas. **Red de seguridad** `setTimeout(1300)` que fija el ancho final aunque el motor esté pausado (pestaña oculta). IntersectionObserver, umbral 0.35 |
| `flipcards` | **Tarjetas giratorias** (flip 3D): grilla de tarjetas que giran al pasar el mouse/foco (100% CSS `rotateY` + `backface-visibility`) mostrando info en el dorso. El `clientJs` sólo agrega el voltear al **tocar/clic** en táctil (`.is-flipped`), donde no hay hover. Respeta `prefers-reduced-motion` (giro casi instantáneo). Ideal para beneficios/valores |
| `parallax` | **Banda parallax**: banda a todo el ancho con una frase (el `tagline`) y 3 capas de fondo que se desplazan a distinta velocidad al scrollear (profundidad). Atada al scroll continuo → `requestAnimationFrame` directo (Anime/Motion animan por tiempo, no por posición de scroll); sólo escucha `scroll` mientras la banda está en pantalla (IntersectionObserver). Con menos movimiento queda estática |
| `sectionnav` | **Navegación por puntos** (scrollspy): riel vertical de puntos a la derecha que se arma solo desde las `<section id>` de la página y marca la visible al scrollear, con tooltip por punto y scroll suave al hacer clic. No aporta HTML; con menos de 3 secciones o pantalla ≤900px no aparece. Con `prefers-reduced-motion` el salto es instantáneo |
| `scrollcue` | **Indicador de scroll** (`requires: hero`, `usesAnime`): flecha SVG al pie del hero que rebota en bucle con **Anime.js** invitando a bajar y lleva a la siguiente sección al hacer clic; se oculta al empezar a scrollear. Decorativo: sin Anime o con menos movimiento queda quieta pero sigue siendo botón funcional |

Todo probado: registro (**76 UI · 19 funcionales**), generación de 3 variantes (full = hero + lote +
reveal/Motion + faq/pricing/contact + darkmode + seo, 20 archivos; solo-los-5, 14 archivos, con
`scrollcue` arrastrando `hero` por `requires` y Anime activo **sin** Motion; y Vercel+Supabase + auth,
30 archivos), `node --check` en fuente y en **todo** el JS generado de las tres variantes (0 errores),
inlineado seguro (0 `</script>`/`</style>` en el JS). Smoke test en navegador real: **cero errores de
consola**, `anime.js` y `motion.js` conviviendo, los 5 módulos inicializan (5 puntos con 1 activo, 4
flipcards, 3 capas parallax, `scrollcue` inyectado en `.hero` con destino "capacidades", 4 barras
arrancando en 0%); el flip alterna `.is-flipped` al clic y el destino del `scrollcue` resuelve a la
sección siguiente. **Nota de entorno**: el preview headless reporta `innerHeight:0` y pausa el loop de
Anime, así que las rutas atadas a IntersectionObserver/rAF (relleno de barras, movimiento parallax,
rebote del cue, scrollspy) no se pueden *ver* animar ahí — igual que el `counters` ya existente —; en
navegador real con viewport real funcionan y las redes de seguridad cubren la pestaña oculta. Sin
módulos revertidos.

## Corrida 2026-07-12 (12ª)

Lote de **5 módulos UI nuevos**, todos frontend puro y sin dependencias npm nuevas en el proyecto
exportado. **3 de los 5 usan Anime.js** (`usesAnime`). El detalle técnico está en
[CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `preloader` | **Pantalla de carga** a pantalla completa (nombre de marca + spinner) que se desvanece al cargar. Logo animado con **Anime.js**. Doble red de seguridad para no dejar el sitio tapado: `@keyframes` CSS que lo oculta a los ~3s aunque el JS no corra, más `setTimeout(3000)`. Se remueve del DOM. Presente en todas las páginas |
| `typewriter` | **Titular con palabras rotativas** (efecto máquina de escribir sobre la lista `PALABRAS`). Vanilla JS a propósito (escritura letra a letra); con `prefers-reduced-motion` muestra la primera palabra fija. Cursor CSS que parpadea sólo si hay movimiento permitido |
| `branchselector` | **Selector de sucursal/ciudad**: `<select>` que repinta dirección, horario, teléfono y botón "Cómo llegar" (Google Maps por búsqueda de dirección, **sin API key**). Recuerda la elegida en `localStorage`. Ficha con fundido **Anime.js** + red de seguridad `setTimeout(450)` que la deja visible aunque el motor esté pausado (pestaña oculta). Datos placeholder editables |
| `stickynav` | **Navbar inteligente al scroll**: se compacta y gana sombra al bajar, se oculta al bajar y reaparece al subir. Sólo comportamiento + `<style>` (no aporta HTML). Toggle **directo sin rAF** (son clases) para funcionar con la pestaña en segundo plano, como `mobilecta`. Respeta `prefers-reduced-motion` |
| `herobg` | **Fondo animado del hero** (`requires: hero`): 3 manchas difuminadas estilo aurora inyectadas dentro de `.hero` desde JS, que flotan en bucle con **Anime.js** (`loop`/`alternate`). Puramente decorativo: sin librería, sin hero o con menos movimiento quedan quietas y el texto se lee igual |

Todo probado: registro (**71 UI · 19 funcionales**), generación de 3 variantes (full = hero + lote
+ reveal/Motion + cart + darkmode + i18n + seo, 33 archivos; solo-los-5, 14 archivos, con `herobg`
arrastrando `hero` por `requires` y Anime activo **sin** Motion; y Vercel+Supabase, 31 archivos),
`node --check` en fuente y en **los 44** archivos JS generados de las tres variantes (0 errores),
inlineado seguro. Smoke test en navegador real: typewriter escribiendo, `branchselector` cambia de
sede y persiste (`sucursal-elegida=2`) con Maps correcto y ficha en `opacity:1` **con la pestaña
oculta** (red de seguridad), `stickynav` alternando `nav-scrolled`/`nav-hidden`, `herobg` con 3
manchas dentro de `.hero`, `preloader` removido tras la carga. En `about.html` (sin hero) `herobg`
degrada sin romper. **Cero errores de consola** en Home y About, con `anime.js` y `motion.js`
conviviendo. Sin módulos revertidos.

## Corrida 2026-07-11 (11ª)

Lote de **4 módulos UI nuevos** + la **mejora de `faq`** (datos estructurados FAQPage para SEO) +
la **integración de Anime.js** en el generador (vendorizada como asset estático, activable por
módulo con `usesAnime`). Todo frontend puro; la calculadora estrena el uso de Anime.js con
degradación limpia. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo / mejora | Nota |
|---|---|
| **Anime.js (core)** | Nueva librería vendorizada (`public/vendor/anime.js`, bundle UMD v4 → `window.anime`). Flag `usesAnime` por módulo → el generador emite `/js/anime.js` y el `<script>`, sin atarlo a `reveal`. Convive con Motion sin choques |
| `payments` | Banda "Aceptamos estos medios de pago" con 6 chips SVG inline (Visa, Mastercard, Amex, Mercado Pago, transferencia, efectivo). Formas propias, no logos oficiales. Estática. Avisado en README |
| `events` | Sección "Próximos eventos": tarjetas `.card` con badge de fecha (día grande + mes en acento), hora, lugar y CTA a contacto/nosotros. 3 eventos placeholder. Estática; las `.card` las anima `reveal` si está activo |
| `resources` | "Recursos y descargas": tarjetas con ícono SVG, tipo/peso, título, bajada y botón `download` (`href="#"` placeholder). Captación de leads B2B. Estática |
| `estimator` | **Calculadora de presupuesto interactiva** (`usesAnime`): select de plan + slider de cantidad + extras/urgencia → total en vivo. El número hace count-up con Anime.js; **red de seguridad** `setTimeout(650)` que fija el valor final aunque el motor esté pausado (pestaña oculta) o con `prefers-reduced-motion`. Sin backend, formato `Intl` es-AR |
| `faq` (mejora) | Ahora emite JSON-LD `FAQPage` (schema.org) en el `<head>` de la Home. Las preguntas se definen una vez (const `FAQS`) y alimentan el acordeón visible y el schema, sin divergencia. Rich result de FAQ para buscadores |

Todo probado: registro (**66 UI · 19 funcionales**), generación del proyecto de prueba (23 archivos
con el lote + reveal/Motion + seo + i18n + darkmode + navmobile + trust), variante Vercel+Supabase
(38 archivos), y variante "solo los nuevos" (activa Anime sin Motion). `node --check` en fuente y en
**todo** el JS generado de las tres variantes (incluidos `anime.js` y `motion.js` vendorizados).
Servidor con páginas y `sitemap.xml` en 200. Inlineado seguro (sin `</script>` ni `</style>` en el
JS). Smoke test en navegador real: la calculadora asienta el total correcto (`$ 890.500` para plan
empresa ×3 + soporte + urgente, esperado 890500) **incluso con la pestaña oculta** gracias a la red
de seguridad; 6 medios de pago, 3 eventos, 3 recursos renderizados; JSON-LD `FAQPage` y
`Organization` ambos parsean; `<script src="/js/anime.js">` y `/js/motion.js` conviven. **Cero
errores de consola** junto a reveal/Motion, darkmode, navmobile, i18n y seo. Sin módulos revertidos.

## Corrida 2026-07-11 (10ª)

Lote de conversión/confianza: **4 módulos UI nuevos**, la **mejora de `pricing`** (interruptor
mensual/anual, último ítem de la sugerencia nº7) y la **adopción del huérfano `socialproof`**
(la 9ª corrida lo creó al integrar Motion pero no lo documentó). Todo frontend puro; dos módulos
usan Motion con degradación a CSS. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo / mejora | Nota |
|---|---|
| `pricing` (mejora) | Interruptor mensual/anual: cada plan trae `data-mensual`/`data-anual` (anual = mensual × 10, "2 meses gratis"); el JS reescribe solo el número y el sufijo. Sin JS queda el mensual. Cierra la sugerencia nº7 |
| `mobilecta` | Barra CTA fija al pie **solo en móvil**; botón principal a contacto/presupuesto/nosotros según módulos activos, más botón de WhatsApp que reutiliza el `wa.me` del FAB. `setTimeout(0)` (no rAF) para leer el FAB ya creado y funcionar con la pestaña oculta. Entrada con Motion |
| `press` | Franja "Como se vio en" (medios en grises que se colorean al hover) + sellos de certificación con SVG inline. Estática. Distinta de `logos` (clientes) |
| `ratingbanner` | Banda con nota promedio + estrellas + cantidad de reseñas. Placeholder editable; con `reviews` activo recalcula la nota global ponderada desde `/api/reviews/summary`. Verificado con una reseña real sembrada por API |
| `appbadges` | Sección "Descargá nuestra app" con badges de App Store y Google Play en SVG inline (sin imágenes externas) + mockup de teléfono. Estática |
| `socialproof` (adoptado) | Avisos flotantes de actividad reciente ("Sofía de Córdoba reservó… hace 2 min"), rotación determinista, cierre por sesión, entrada con Motion. Cubre el 1er ítem de la sugerencia nº8 |

Todo probado: registro (62 UI · 19 funcionales), generación del proyecto de prueba con el lote +
`socialproof` + módulos que interactúan, `node --check` en fuente y en todo el JS generado
(incluidas las variantes "solo los 5" y Vercel+Supabase), servidor con páginas y `sitemap.xml` en
200 y API de reseñas 201, inlineado seguro (sin `</script>` ni `</style>`). Smoke test en
navegador real: switch de precios ida y vuelta ($9.999/mes ↔ $99.990/año), banner de valoración
que pasa a "5 · 1 reseña" tras sembrar una reseña real, CTA móvil con `wa.me` correcto y link a
contacto, prensa/certificaciones, 2 badges de tienda, aviso de actividad reciente rotando.
**Cero errores de consola** conviviendo con reveal/Motion, darkmode, navmobile, whatsapp, i18n y
seo. Sin módulos revertidos.

## Corrida 2026-07-11 (8ª)

Lote de 5 módulos UI nuevos, todos frontend puro (sin backend, sin dependencias): módulos de
conversión que saldan 4 de los 5 ítems de la sugerencia nº7 del backlog, más una sección de
características en zigzag. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `comparison` | Tabla comparativa de planes (matriz `✓`/`✕`/valor), columna recomendada resaltada; sale con `data-mejorada="1"` para que `datatable` no le agregue orden ni buscador; scroll horizontal en móvil; textos placeholder |
| `marquee` | Marquesina/ticker de frases o marcas en loop CSS puro (lista duplicada para bucle sin cortes); pausa al hover; con `prefers-reduced-motion` queda estática; sin JS es una fila fija |
| `metrics` | Banda full-bleed de acento con 4 cifras de confianza grandes; estática (la cifra final ya está en el HTML); distinta de `counters`, que es la versión animada |
| `features` | Filas alternadas (zigzag) imagen+texto con emoji, título y bajada; "imágenes" con degradado placeholder reemplazables por `<img>`; estilos vía `head()`; sin JS |
| `testimonialslider` | Carrusel de testimonios que rota solo (6s) con flechas y puntos, standalone (reseñas propias); sin JS se ven apilados y los controles los crea el JS; pausa al hover, respeta `prefers-reduced-motion`; ARIA completo |

Todo probado: registro (57 UI · 19 funcionales), generación (proyecto de prueba con los 5 + 10
existentes, 20 archivos), `node --check` en fuente y en el JS generado (incluida la variante
"solo los 5"), servidor con páginas y sitemap en 200, e inlineado seguro del preview (sin
`</script>` ni `</style>`). Smoke test en navegador real: opt-out de datatable en la comparativa
confirmado, marquesina animando (`mq-scroll`), 4 métricas, 3 filas de características con la 2ª
en `row-reverse`, carrusel con 1 slide visible + flechas/puntos que cambian el testimonio activo.
**Cero errores de consola** conviviendo con datatable, reveal, darkmode, navmobile, i18n y seo.
Variante Vercel+Supabase sin errores. Sin módulos revertidos.

## Corrida 2026-07-11 (7ª)

Lote de 5 módulos UI nuevos, todos frontend puro (sin backend, sin dependencias, sin choques
con módulos existentes): las piezas de confianza y conversión que un cliente comercial pide
primero. El detalle técnico está en [CAMBIOS.md](CAMBIOS.md).

| Módulo | Nota |
|---|---|
| `trust` | Barra de garantías (envío gratis, pago seguro, cambios/devoluciones, atención) con iconos SVG inline; estática, grilla responsive; textos placeholder avisados en el README |
| `tabs` | Contenido en pestañas con patrón tablist accesible (roles ARIA, flechas/Inicio/Fin, roving tabindex); sin JS los 3 paneles quedan visibles apilados; IDs únicos por instancia |
| `scrollprogress` | Cinta de 3px arriba de todo que crece con el scroll (`z-index:60`); solo clientJs, en todas las páginas; passive + resize; 0% si la página entra entera |
| `beforeafter` | Comparador de imágenes con `<input type="range">` como control (arrastre+teclado+SR gratis); capa superior recortada por `clip-path` según `--pos`; placeholders con degradado, reemplazables por fotos |
| `countdown` | Cuenta regresiva (d/h/m/s) a un evento; `data-fecha` configurable y, si falta/pasó, cae a fin de mes (determinista y auto-renovable); CTA a contacto o Nosotros |

Todo probado: registro (52 UI · 19 funcionales), generación (proyecto de prueba con los 5 + 14 existentes, 20
archivos), `node --check` en fuente y en todo el JS generado, servidor con páginas y sitemap
en 200 y APIs 201/422, preview del Builder 200 con inlineado seguro (sin `</script>`), y smoke
test en navegador real: badges de trust, pestañas con ARIA y cambio de panel, `--pos` del
comparador 50→80 al mover, contador con números reales y segundos que avanzan, barra de
progreso presente. **Cero errores de consola** conviviendo con i18n, darkmode, navmobile,
datatable y carrusel. Sin módulos revertidos.

## Corrida 2026-07-11 (6ª)

Al arrancar se encontraron **5 módulos huérfanos** de una corrida anterior interrumpida
(`jobs`, `legal`, `promo`, `servicespage`, `inbox`): estaban escritos y con sintaxis válida
pero sin probar ni documentar. Se adoptaron: se verificaron completos junto con el lote
nuevo y quedaron documentados en CAMBIOS.md y el README.

Lote nuevo de esta corrida (4 funcionalidades, 2 sugerencias del backlog cumplidas):

| Módulo / mejora | Nota |
|---|---|
| `pwa` | Manifest + ícono SVG + service worker "red primero con respaldo en cache"; instalable y funcional offline con lo visitado; la API nunca se cachea; cache versionado por slug |
| `a11y` | Skip-link + botón flotante ♿ (izquierda) con tamaño de texto A−/A+, alto contraste y subrayado de enlaces, persistido en localStorage; el selector doble le gana al modo oscuro |
| `seo` + sitemap | El generador pasa `ctx.pages` a `files(cfg, ctx)` (retrocompatible); seo genera `sitemap.xml` sin páginas privadas y robots.txt lo referencia; dominio placeholder avisado en el README (era pendiente del backlog) |
| testimonios ↔ reseñas | `GET /api/reviews/top` + reemplazo de los ejemplos por reseñas reales de 4-5 estrellas cuando ambos módulos conviven; con API caída o sin datos quedan los ejemplos (sugerencia nº 2) |

Módulos adoptados y verificados: `jobs` (página de empleo + `POST /api/applications`),
`legal` (términos y privacidad con texto modelo y condicionales), `promo` (popup con
frecuencia), `servicespage` (detalle por servicio, `requires: services`), `inbox`
(bandeja admin con estados, badge y CSV — sugerencias nº 3 y 4 del backlog).

Todo probado: registro (62 módulos), generación (47 archivos), `node --check`, servidor
con 16 rutas en 200, APIs con casos válidos e inválidos, smoke test en navegador real con
cero errores de consola (SW cacheando, testimonios reales, panel a11y persistente, popup
accesible, bandeja completa como admin, links privados ocultos para anónimos), regresión
sin fugas y variante Vercel+Supabase con todas las tablas. Sin módulos revertidos.

## Corrida 2026-07-11 (5ª)

Lote agregado (5 módulos UI, 3 sugerencias del backlog cumplidas: i18n, redes sociales
en el footer, timeline; más el formulario multipaso que también estaba sugerido):

| Módulo | Nota |
|---|---|
| `i18n` | Selector ES/EN en la navbar con diccionario de ~70 textos fijos inlineado en `app.js` (editable); TreeWalker + coincidencia exacta, restaura sin recargar, recuerda en localStorage. Los textos del Builder y el contenido dinámico no se traducen (decisión de alcance, como sugería el backlog) |
| `quote` | Página `/quote.html` con wizard de 3 pasos: validación nativa por paso, Enter avanza en vez de enviar, resumen antes de confirmar, backend `POST /api/quotes` con colección propia |
| `social` | Íconos de redes en el footer de todas las páginas; URLs en `const REDES` de `app.js`, las vacías no se muestran |
| `timeline` | Sección "Nuestra historia" con 4 hitos placeholder; línea y puntos con estilos inline sobre variables del tema |
| `process` | Sección "Cómo trabajamos" con 4 pasos numerados, típica de sitios de servicios |

Todo probado: registro (55 módulos), generación (21 archivos), `node --check` en fuente y
generados, variante Vercel+Supabase con tabla `quotes` en el schema, servidor levantado con
las 4 páginas en 200, API de presupuestos (201 válido / 422 inválido, persistencia verificada),
y smoke test en navegador real: secciones nuevas renderizadas, toggle EN↔ES ida y vuelta en
dos páginas (incluye placeholders y aria-labels), wizard completo con validación por paso,
"Atrás", resumen, envío con toast y reset. Cero errores de consola. Sin módulos revertidos.
README actualizado (37 UI + ruta `/api/quotes`).

## Corrida 2026-07-10 (4ª)

Lote agregado (6 módulos UI):

| Módulo | Nota |
|---|---|
| `counters` | Contadores animados (IntersectionObserver + easing cúbico); el HTML trae el valor final, así que sin JS o con menos movimiento la cifra se ve igual |
| `logos` | Franja "Confían en nosotros" con wordmarks tipográficos; los estilos ya contemplan `<img>` para cuando el cliente pegue logos reales |
| `cta` | Banda CTA con gradiente antes del footer; el botón va a `/contact.html` si contacto está activo, a `/about.html` si no |
| `hours` | Horarios semanales + "Abierto ahora / Cerrado" calculado en vivo leyendo `data-dias/abre/cierra` de la tabla (única fuente de verdad) |
| `video` | Video de YouTube click-to-load vía youtube-nocookie: cero requests a YouTube hasta que el visitante decide reproducir |
| `galleryfilters` | Tabs de categorías que filtran la galería (`requires: ['gallery']` verificado); la galería ahora trae `data-cat` placeholder, inerte sin este módulo |

Todo probado: registro (50 módulos), generación (16 archivos), `node --check` en fuente y
generados, servidor levantado con HTTP 200, smoke test en navegador (filtros dejan 2/6 y 6/6
tarjetas con `aria-pressed` correcto, clic en video → iframe de nocookie y ninguno antes,
horarios "Cerrado" un viernes 21:14 con la fila de hoy resaltada más 6 casos borde de la
lógica en unit test). Un fix dentro del lote: el CTA apuntaba a un ancla `#contacto`
inexistente (contacto es página propia); corregido a `/contact.html`. La animación de
contadores no pudo verse en vivo porque el panel embebido quedó `visibilityState: hidden`
(rAF/IntersectionObserver suspendidos); se validó la curva frame a frame con la misma fórmula
y los fallbacks. Sin módulos revertidos. README actualizado (32 UI).

## Corrida 2026-07-10 (3ª)

Lote agregado (6 módulos UI):

| Módulo | Nota |
|---|---|
| `services` | Sección "Nuestros servicios" con iconos SVG inline; faltaba la sección más común de un sitio comercial |
| `announcement` | Barra promo con countdown al próximo domingo (se renueva sola) y cierre recordado por mensaje |
| `breadcrumbs` | Miga de pan automática en páginas internas, con marcado accesible |
| `favicon` | Favicon SVG con la inicial de la marca sobre el acento, como data URI vía `head()` |
| `page404` | Página 404 con el layout del sitio + fallback Express (la API sigue respondiendo JSON) |
| `datatable` | Orden por columna (numérico es-AR incluido) y buscador en todas las tablas, con MutationObserver para las dinámicas |

Todo probado: registro (44 módulos), generación, `node --check`, servidor levantado,
verificación HTTP del fallback 404, smoke test de los 6 módulos en navegador real
(countdown, cierre persistente, orden/búsqueda de tablas, breadcrumb, favicon).
Sin pendientes ni módulos revertidos. También se actualizó la lista de módulos del README.

## Pendiente / a medias

- Nada quedó a medias en esta corrida (10ª): los 4 módulos nuevos + la mejora de `pricing`
  entraron completos y probados, y se adoptó `socialproof`.
- **Sugerencia nº7 saldada por completo**: el toggle mensual/anual en `pricing` ya está. Solo
  queda, si se quiere, una **marquesina específica de logos** (hoy `marquee` es de frases/marcas
  de texto; para logos reales se ata al mecanismo de imágenes de la sugerencia nº1).
- **Sugerencia nº8 avanzada**: entraron `socialproof` (avisos de actividad reciente),
  `ratingbanner` (banner de reseñas con estrellas agregadas), `press` (logos de prensa/
  certificaciones) y `mobilecta` (CTA fijo al pie en móvil). **Queda 1 ítem**: el **comparador
  de productos lado a lado** (es interactivo y necesita datos de productos; encaja mejor una vez
  que exista el mecanismo de campos/datos por módulo de la sugerencia nº1).
- Los placeholders editables siguen creciendo con este lote (planes/cifras de `pricing`, medios y
  sellos de `press`, nota/cantidad de `ratingbanner` cuando no hay `reviews`, enlaces de tienda de
  `appbadges`, nombres/lugares de `socialproof`): todos avisados en el README generado, refuerzan
  la sugerencia nº1.
- Los placeholders editables siguen creciendo (planes/filas de `comparison`, frases de
  `marquee`, cifras de `metrics`, íconos/textos de `features`, reseñas de `testimonialslider`):
  todos avisados en el README generado, pero refuerzan la sugerencia nº 1 (campos de texto por
  módulo en el Builder). `features` suma otro caso de la nº 2 (imágenes reales): hoy usa
  degradados placeholder.
- De la 7ª quedaba: nada a medias. Los placeholders editables (badges de `trust`, textos de
  `tabs`, fotos de `beforeafter`, `data-fecha` de `countdown`) siguen vigentes como pendiente
  de la sugerencia nº 1.
- De la 6ª quedaba: nada a medias. Del backlog anterior se saldaron: sitemap.xml,
  testimonios↔reseñas (nº 2), panel admin de formularios (nº 3), export CSV (nº 4) y página
  de servicios (nº 6).
- El dominio del `sitemap.xml` es un placeholder (`https://TU-DOMINIO.com`): lo definitivo
  sería un campo "dominio" en el Builder, que también serviría para `og:url` del módulo seo.
- La lista de placeholders editables en el proyecto generado sigue creciendo (ahora suma
  puestos de `jobs`, textos de `promo` y campos `[completar…]` de `legal`). Todos avisados
  en el README generado, pero refuerzan la necesidad de campos de texto por módulo en el
  Builder.
- Limitación conocida de `i18n` (documentada en el README generado): el contenido que los
  módulos funcionales renderizan por JS después de cargar (catálogo, comentarios, bandeja,
  cartel "Abierto ahora") queda en español. Si se quisiera cubrir, la vía sería un
  MutationObserver opcional o que esos módulos consulten el diccionario al renderizar.
- Los screenshots del panel embebido del navegador volvieron a fallar (timeout), como en la
  4ª corrida; el smoke test se hizo por DOM/JS, que cubre lo mismo salvo lo puramente visual.

## Sugerencias para la próxima corrida

1. **Campos de texto/imagen por módulo en el Builder** (máxima prioridad y cada vez más
   urgente): un mecanismo genérico `fields → cfg.moduleTexts`/`cfg.moduleImages` resolvería
   de una vez la lista entera de placeholders (badges de trust, textos de tabs, fotos de
   beforeafter y gallery, data-fecha de countdown, etc.). Es un cambio de núcleo (Builder UI +
   generator); si además acepta **URLs de imagen**, cubre de paso la sugerencia nº 2. Un campo
   **dominio** entra en el mismo cambio y completa sitemap + og:url.
2. **Imágenes reales en módulos visuales**: hoy gallery y beforeafter usan degradados de
   placeholder. Ideal atarlo al mecanismo de campos del punto 1 (URLs con **el `lazyload`
   ya existente desde la 14ª**, que aplicará `loading=lazy` + fundido automáticamente a las
   `<img>` que se agreguen).
3. **Notificación por email de la bandeja**: al llegar un mensaje/presupuesto/postulación,
   avisar por email gratis (p. ej. Resend free tier u hoja de cálculo vía webhook); hoy el
   admin tiene que entrar a mirar.
4. **Blog con páginas por artículo** (hoy es una sección única): detalle por post + el
   sitemap ya los incluiría solo gracias a ctx.pages.
5. **Página de galería/portfolio propia** con filtros, complemento de gallery+galleryfilters.
6. **Búsqueda/orden server-side** para colecciones grandes en los paneles de gestión (el CSV
   ya está resuelto por la bandeja).
7. **Más módulos UI de conversión** — ✅ **saldada en la 10ª**: ya están `comparison`,
   `testimonialslider`, `marquee`, `metrics` (8ª) y el **toggle mensual/anual en `pricing`**
   (10ª). Solo queda opcional una variante de `marquee` con logos reales (atada a la nº 1/nº 2).
8. **Nuevos módulos UI que faltaban** — mayormente saldada en la 10ª: entraron `socialproof`
   (avisos de actividad reciente), `ratingbanner` (banner de reseñas con estrellas agregadas),
   `press` (logos de prensa/certificaciones) y `mobilecta` (CTA fijo al pie en móvil). **Queda
   el comparador de productos lado a lado** (interactivo; conviene tras el mecanismo de datos por
   módulo de la nº 1).
9. **Más módulos UI que faltaban** — mayormente saldada en la 11ª/12ª: entraron `payments`
   (medios de pago), `events`, `resources`, `estimator` (11ª) y **`branchselector` (selector de
   sucursal, 12ª)**. **Queda pendiente**: banner de envío gratis por umbral de compra que lea el
   subtotal del `cart`. Ojo: el `cart` guarda `[{productId, qty}]` sin precios (los precios sólo
   están tras el fetch del catálogo), así que un banner de progreso real necesitaría que `cart`
   exponga el subtotal (evento/variable global) o leer el `#cart-total` del DOM en la página de
   catálogo. Además, el módulo `announcement` ya usa "Envío gratis…" como texto, así que hay que
   diferenciarlo (widget de progreso, no una barra estática más).
10. **Aprovechar más Anime.js** — avanzada en la 12ª (`preloader`, `herobg`, `branchselector` ya la
    usan). Candidatos que **siguen pendientes**: migrar/duplicar el count-up de `counters`/`metrics`
    a Anime.js (hoy `counters` usa IntersectionObserver; evaluar si conviene), morphing de SVG, o un
    efecto scramble de texto en el hero. Nota de robustez confirmada otra vez: Anime.js **pausa su
    loop con la pestaña oculta** → todo módulo que anime hacia un estado final (opacidad, número)
    necesita su red de seguridad con `setTimeout`, como hacen `reveal`/`estimator`/`branchselector`.
11. **Comparador de productos lado a lado** (interactivo) — sigue pendiente de la nº8; conviene
    tras el mecanismo de datos por módulo de la nº1.
12. **Multipágina para los módulos del hero** — `herobg` sólo afecta la Home (donde vive `hero`).
    Si en el futuro hay hero en otras páginas, `herobg` ya lo cubriría (busca `.hero` en cada
    página). Sin acción por ahora; anotado para no sorprenderse.
13. **Aprovechar las utilidades del lote 14ª desde otros módulos**: ahora que existe `modal`
    (`window.abrirModal`), varios módulos podrían usarlo en vez de soluciones propias — p. ej.
    `lightbox` (imagen ampliada), `legal`/`cookies` (mostrar el texto legal en modal), o un
    "ver detalle" en `pricing`/`services`. Igual, `tooltip` (`data-tooltip`) podría enriquecer
    labels de formularios (`contact`, `quote`) y `readmore` (`data-readmore`) recortar textos
    largos de `testimonials`/`team`. Son integraciones opcionales, no bloqueantes.
14. **Candidatos de módulos UX aún ausentes**: menú "mega" para navbars grandes, breadcrumbs
    automáticos por ruta (hay `breadcrumbs` pero estático), un `scrollspy` de tabla de contenidos
    para páginas largas (existe `toc`/`sectionnav`; evaluar solape), y un módulo de **compartir en
    redes con contador/preview**. Priorizar según el criterio de "lo que cualquier cliente pediría".

## Recordatorios operativos

- No usar git: los cambios se documentan en CAMBIOS.md (decisión del usuario).
- Todo módulo nuevo: vanilla JS, gratis (sin API keys obligatorias), comentarios en español
  con `//`, y probar generación + servidor antes de dar por cerrado el lote.
