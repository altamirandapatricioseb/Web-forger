# WebForge Builder

Constructor de sistemas web modulares. No genera landing pages estáticas: genera **proyectos full-stack funcionales** (autenticación, persistencia, API REST por módulo, multipágina) exportables como `.zip`, listos para publicar sin servicios pagos.

## Cómo se usa

En el panel del Builder configurás marca, colores, tipografía y textos; personalizás **el
contenido de cada sección** (39 secciones con 162 campos editables: títulos, bajadas, listas de
servicios, planes, preguntas frecuentes, textos de botones y mensajes de formulario); elegís
**cómo se mueve el sitio** con ocho ejes independientes (tarjetas, aparición al scroll, botones,
enlaces, títulos, imágenes, campos y cambio de página — 47 variantes en total); tildás módulos,
mirás el preview en vivo (con pestañas por página) y presionás **Exportar proyecto .zip**.

> **Manual de uso**: **[MANUAL.md](MANUAL.md)** — recorrido completo del panel, flujo de trabajo,
> recetas por rubro y problemas frecuentes. El catálogo módulo por módulo está en
> **[MODULOS.md](MODULOS.md)** (se regenera con `node tools/catalogo.js`).
>
> **Deploy**: en **[DEPLOY.md](DEPLOY.md)** está la guía completa para publicar gratis en
> Vercel + Supabase — tanto el Builder (incluido el compartido de proyectos por link) como
> los proyectos que exporta.

## Infraestructura seleccionable (todo con capa gratuita)

- **Base de datos**: JSON local (cero config) o **Supabase** (PostgreSQL real, plan gratuito). El export
  con Supabase incluye `supabase/schema.sql` listo para pegar en el SQL Editor y el driver
  `src/db.js` vía PostgREST **sin dependencias nuevas**. Misma interfaz async: el código de los
  módulos no cambia entre drivers.
- **Deploy**: **Vercel** (plan Hobby gratuito). El export incluye `vercel.json` y `api/index.js`
  (la app Express corre como función serverless, `public/` como estáticos). Vercel fuerza Supabase
  porque su filesystem es efímero.
- **IA**: los módulos Chatbot y Agente usan cualquier API compatible OpenAI; el `.env.example`
  viene apuntando a **Groq** (gratis), con instrucciones para Gemini y OpenRouter en `src/ai.js`.
- **Guía B2B SaaS**: opción que genera `docs/B2B-SAAS.md` **a medida del proyecto** (sus módulos y
  colecciones reales): multi-tenant por organización, planes y límites, cobro recurrente
  (Mercado Pago/Stripe), onboarding y checklist para salir a vender.

## Arquitectura

```
server.js            API del Builder: /api/modules, /api/categorias, /api/efectos,
                       /api/preview, /api/export
src/registry.js      Registro de módulos (patrón plugin, carga automática)
src/categorias.js    Categorías del catálogo (fuente única: panel + tools/catalogo.js)
src/generator.js     config → Map<ruta, contenido> del proyecto completo
src/motion.js        Sistema de movimiento: 8 ejes × 47 variantes (CSS + JS vanilla)
modules/ui/escena3d/ Escenas 3D del recorrido al scroll (casa, teléfono, anteojos,
                       switch, caja): CSS 3D puro, una por rubro
src/templates.js     Plantillas base: server, db, validaciones, layout, CSS, README
src/zipper.js        Empaquetado ZIP en streaming (archiver)
tools/catalogo.js    Genera MODULOS.md desde el registro real
modules/ui/          101 módulos de interfaz (hero, escena 3D al scroll, servicios,
                       página de servicios, galería,
                       filtros de galería, portfolio, testimonios, testimonios en carrusel,
                       faq, precios, tabla comparativa, blog
                       (con páginas por artículo), feed RSS, buscador,
                       contacto, barra de contacto flotante, modo oscuro, banner de cookies,
                       botones de compartir,
                       botón de WhatsApp, volver arriba, animaciones al scroll,
                       menú hamburguesa, carrusel, lightbox, SEO básico (con sitemap),
                       mapa de ubicación, equipo, barra de anuncios, marquesina animada,
                       miga de pan, favicon de marca, página 404, tablas con orden y búsqueda,
                       contadores animados, banda de estadísticas, características destacadas,
                       logos de clientes, llamado a la acción,
                       horarios de atención, video institucional, redes sociales,
                       nuestra historia, cómo trabajamos, pedido de presupuesto,
                       multiidioma ES/EN, trabajá con nosotros, páginas legales,
                       popup de promoción, app instalable (PWA), accesibilidad,
                       garantías de confianza, contenido en pestañas, progreso de
                       lectura, antes/después, cuenta regresiva, CTA fijo en móvil,
                       prensa y certificaciones, banner de valoración, descarga de app,
                       avisos de actividad reciente, medios de pago, próximos eventos,
                       recursos descargables, calculadora de presupuesto,
                       pantalla de carga, titular con palabras rotativas,
                       selector de sucursal, navbar inteligente al scroll,
                       fondo animado del hero, barras de capacidades,
                       tarjetas giratorias, banda parallax, navegación por puntos,
                       indicador de scroll)
modules/functional/  123 módulos funcionales. Las familias históricas (la lista de abajo es una
                       muestra: el catálogo completo se ve en el Builder) más cuatro nuevas:
                     · e-commerce completo: productos con galería de imágenes (subida real),
                         stock que el checkout valida y descuenta, página por producto en
                         /producto/<slug> armada por el servidor con JSON-LD, tienda con
                         búsqueda y filtros resueltos en el servidor, checkout con datos de
                         entrega y costo de envío por zona, y panel de pedidos cuya cancelación
                         repone el stock. Desde la 40ª también variantes (talle/color) con
                         stock, SKU y sobreprecio por combinación —el stock del producto pasa a
                         ser la suma de sus variantes—, preguntas moderadas sobre el producto,
                         relacionados calculados sobre los pedidos reales ("quien compró esto
                         también compró") y etiquetas con página de colección propia en
                         /etiqueta/<slug>, también armada por el servidor.
                     · el sitio se publica solo: páginas administrables servidas por el servidor
                         en /p/<slug> (bloques tipados, sin HTML libre, con su entrada en el
                         sitemap) y menú de navegación administrable (orden, nombres, ocultar y
                         links propios). Crear una página o cambiar el menú dejó de requerir
                         regenerar y volver a deployar.
                       · venta: descuentos automáticos calculados en el servidor (por monto o por
                         cantidad, con vigencia, tope y regla exclusiva) que el checkout aplica con
                         el MISMO motor, envío gratis por umbral y carritos abandonados con enlace
                         de recuperación e integraciones salientes por webhook firmado.
                       · backends de secciones: le dan datos administrables a secciones que antes
                         venían horneadas en el HTML — textos del sitio, datos del negocio, planes
                         y precios, preguntas frecuentes, horarios y feriados, cotizaciones de
                         moneda, equipo, servicios (sección y página de detalle), clientes/prensa/
                         sellos, historia y proceso, y garantías y características. Se editan desde
                         su panel y el sitio publicado lo refleja al instante, sin regenerar ni
                         volver a deployar.
                       · medición: pruebas A/B de textos (reparto estable decidido por el servidor,
                         impresiones y conversiones deduplicadas por visitante, y ganador declarado
                         por prueba z al 95%). Sin servicios externos ni cookies de terceros.
                       · eshop: auth (login y registro en páginas separadas), carrito+checkout,
                         cupones, reseñas, favoritos, comentarios, newsletter, reservas, estadísticas
                       · gestión interna: usuarios (roles + soft delete), sucursales,
                         productos (CRUD con SKU), inventario+movimientos, repositores,
                         registro de visitas, puntos de venta, bandeja de entrada
                         (mensajes/presupuestos/postulaciones con estado y CSV)
                       · visitante: encuestas y votaciones (resultados en vivo), soporte con
                         seguimiento por código TK-XXXXXX, valoración "¿te resultó útil?" por
                         página, captación de leads (waitlist/exitpopup postean solos; panel + CSV)
                       · IA: chatbot con contexto del negocio, agente con tool calling
                         sobre los datos internos (proveedores gratuitos: Groq/Gemini/OpenRouter)
public/              UI del Builder (panel de configuración + preview en iframe)
```

**Decisiones clave**

- **Node.js + Express, frontend vanilla**: cero build step, cero lock-in de framework en el código generado; cualquier dev lo abre y lo entiende. Next.js quedó descartado para el *output* porque obliga a un toolchain pesado en la máquina del usuario final.
- **Preview = código real**: el iframe renderiza exactamente los archivos que se exportan (mismo generador, CSS inlineado). No hay dos caminos de render que puedan divergir.
- **Proyectos exportados con 1 dependencia** (`express`): persistencia en JSON por colección (`src/db.js`, interfaz tipo ORM simple, swappeable por SQLite/Postgres), JWT firmado con HMAC-SHA256 y passwords con scrypt, ambos con `crypto` nativo.
- **Seguridad**: secretos vía `.env` (con `.env.example` generado), passwords hasheadas con salt, comparaciones en tiempo constante, validación de modelos en el servidor, roles user/admin, escape de HTML en todo texto de usuario.

## Cómo agregar un módulo nuevo

Creá un archivo en `modules/ui/` o `modules/functional/` que exporte el contrato — se registra solo, sin tocar nada más:

```js
module.exports = {
  id: 'mi-modulo', type: 'functional', name: 'Mi módulo',
  description: 'Qué hace.',
  requires: ['auth'],                             // dependencias, se resuelven en cadena (opcional)
  fields: [{ key: 'titulo', label: 'Título', default: 'Lo que hacemos', max: 80 }],
                                                  // textos editables desde el Builder; se leen
                                                  // con txt()/txtList() (opcional)
  html: (cfg) => `<section>…</section>`,          // sección en la Home (opcional)
  pages: (cfg) => ({ nombre: { title, html } }),  // páginas propias (opcional)
  files: (cfg, ctx) => ({ 'routes/x.js': '…' }),  // backend; ctx = {pages: […], nav: [{label, href}]} (opcional)
  mounts: [{ route: '/api/x', file: 'routes/x.js' }],
  middlewares: [{ file: 'src/middleware/x.js' }],  // middleware global, ANTES de los estáticos (opcional)
  vercelRewrites: ['/p/:slug*'],                   // rutas propias fuera de /api que sirve un
                                                   // middleware: en Vercel, sin rewrite la CDN
                                                   // responde y el pedido nunca llega a Express
  env: { MI_CLAVE: 'valor-ejemplo' },             // se agrega a .env.example
  nav: (cfg) => [{ label: 'X', href: '/x.html' }],
  clientJs: (cfg) => `/* JS que va a public/js/app.js */`,
  head: (cfg, page) => `<meta …>`,               // fragmento extra del <head> de cada página; page = {title, active} (opcional)
  usesAnime: true,                                // si el módulo usa Anime.js: el generador sirve /js/anime.js (opcional)
  readmeNotes: (cfg) => ['Aviso en el README generado para pasos que requieren acción humana'], // (opcional)
};
```

## API del proyecto generado (ejemplo con todos los módulos)

| Ruta | Módulo |
|---|---|
| `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` | Autenticación |
| `GET /api/admin/overview` | Panel admin (rol admin) |
| `GET/POST /api/products` · `GET/POST /api/orders` | Carrito + Checkout |
| `GET/POST/DELETE /api/coupons` · `POST /api/coupons/validate` | Cupones de descuento |
| `GET/POST /api/reviews` · `GET /api/reviews/summary` · `GET /api/reviews/top` | Reseñas con estrellas |
| `GET /api/favorites` · `POST /api/favorites/toggle` | Favoritos |
| `POST /api/stats/hit` · `GET /api/stats` | Estadísticas de visitas |
| `GET/PATCH /api/users` | Gestión de usuarios (roles, activar/desactivar) |
| `GET/POST/PATCH/DELETE /api/branches` | Sucursales |
| `GET/POST/PATCH/DELETE /api/products` | Gestión de productos (SKU, categoría, baja lógica) |
| `GET /api/inventory/stock` · `GET/POST /api/inventory/movements` | Inventario + Movimientos |
| `GET /api/repositores` · `POST /api/repositores/assign` · `GET /api/repositores/my-branches` | Repositores |
| `GET/POST /api/visits` | Registro de visitas |
| `GET/POST/DELETE /api/pos` · `GET/POST /api/pos/sales` | Puntos de venta |
| `POST /api/chatbot` | Chatbot IA |
| `POST /api/agent` | Agente IA (admin) |
| `GET/POST /api/comments` | Comentarios |
| `POST /api/newsletter` | Newsletter |
| `GET/POST /api/bookings` | Reservas |
| `POST /api/contact` | Contacto |
| `POST /api/quotes` | Pedido de presupuesto |
| `POST /api/applications` | Postulaciones laborales |
| `GET /api/inbox` · `PATCH /api/inbox/:col/:id` | Bandeja de entrada (admin) |
| `GET /api/polls` · `POST /api/polls/:id/vote` | Encuestas y votaciones |
| `POST /api/tickets` · `GET /api/tickets/codigo/:code` · `GET/PATCH /api/tickets/:id` (admin, con auth) | Soporte con seguimiento |
| `POST /api/feedback` · `GET /api/feedback/summary` | ¿Te resultó útil? |
| `POST /api/leads` · `GET /api/leads` (admin) | Captación de leads |

El primer usuario registrado en cada proyecto generado recibe rol `admin`. Los roles disponibles
son `user`, `repositor` y `admin`; se administran desde Gestión de usuarios y los usuarios
desactivados tienen el login bloqueado. Si Inventario y Puntos de venta conviven, cada venta
valida y descuenta stock de la sucursal de la caja automáticamente.
