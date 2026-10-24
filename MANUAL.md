# Manual de usuario — WebForge Builder

Guía completa para armar, previsualizar, exportar y publicar un sistema web con el Builder.
Está escrita para usarse de arriba hacia abajo la primera vez, y como referencia después.

- **Referencia del catálogo**: [MODULOS.md](MODULOS.md) — los 229 módulos, uno por uno.
- **Publicar gratis en internet**: [DEPLOY.md](DEPLOY.md).
- **Cómo está hecho por dentro**: [README.md](README.md) y [DESIGN.md](DESIGN.md).

---

## Índice

1. [Qué es y qué no es](#1-qué-es-y-qué-no-es)
2. [Instalación y arranque](#2-instalación-y-arranque)
3. [La pantalla en 30 segundos](#3-la-pantalla-en-30-segundos)
4. [Flujo de trabajo recomendado](#4-flujo-de-trabajo-recomendado)
5. [Panel: Marca](#5-panel-marca)
6. [Panel: Colores](#6-panel-colores)
7. [Panel: Tipografía y efectos](#7-panel-tipografía-y-efectos)
8. [Panel: Movimiento y efectos](#8-panel-movimiento-y-efectos)
9. [Panel: Textos](#9-panel-textos)
10. [Panel: Textos por sección](#10-panel-textos-por-sección)
11. [Panel: Módulos](#11-panel-módulos)
12. [Panel: Infraestructura](#12-panel-infraestructura)
13. [El preview](#13-el-preview)
14. [Exportar el proyecto](#14-exportar-el-proyecto)
15. [Correr el proyecto exportado](#15-correr-el-proyecto-exportado)
16. [Publicarlo en internet](#16-publicarlo-en-internet)
17. [Qué se edita sin regenerar y qué no](#17-qué-se-edita-sin-regenerar-y-qué-no)
18. [Compartir una configuración por link](#18-compartir-una-configuración-por-link)
19. [Recetas por tipo de negocio](#19-recetas-por-tipo-de-negocio)
20. [Problemas frecuentes](#20-problemas-frecuentes)
21. [Glosario](#21-glosario)
22. [Para desarrolladores: agregar un módulo](#22-para-desarrolladores-agregar-un-módulo)

---

## 1. Qué es y qué no es

WebForge Builder es un **generador de sistemas web full-stack**. Elegís marca, colores,
tipografía, textos y módulos; el Builder arma un proyecto Node.js completo y te lo entrega
como un `.zip` listo para correr y publicar.

**Lo que genera** es un proyecto real, no una maqueta:

- Sitio multipágina en HTML + CSS + JavaScript vanilla (sin build step, sin framework).
- Backend Express con una ruta de API por módulo, validación en el servidor y persistencia.
- Autenticación con JWT y contraseñas hasheadas (scrypt), roles `user` / `repositor` / `admin`.
- Paneles de administración para los módulos que los tienen.
- **Una sola dependencia npm**: `express`. Todo lo demás usa el `crypto` nativo de Node.

**Lo que NO es**:

- No es un editor visual de arrastrar y soltar. Se configura por panel, no por lienzo.
- No es un hosting: exportás el proyecto y lo publicás donde quieras (la guía usa Vercel).
- No genera una landing estática de una sola página: genera un sistema con páginas y datos.
- El Builder no guarda tus proyectos (salvo que uses "Compartir link", ver punto 16): el
  entregable es el ZIP.

**Costo**: cero. Todas las piezas elegibles tienen capa gratuita (Vercel Hobby, Supabase Free,
Groq/Gemini/OpenRouter para los módulos de IA).

---

## 2. Instalación y arranque

Necesitás **Node.js 18 o superior** ([nodejs.org](https://nodejs.org)). Verificá con:

```bash
node --version
```

Después, dentro de la carpeta del Builder:

```bash
npm install
npm start
```

En la consola aparece:

```
WebForge Builder ▶ http://localhost:4000
```

Abrí esa dirección en el navegador. Si el puerto 4000 está ocupado, arrancá con otro:

```bash
PORT=4100 npm start          # macOS / Linux
$env:PORT=4100; npm start    # Windows PowerShell
```

> El Builder necesita internet solo para dos cosas opcionales: las tipografías web del
> selector (se cargan de Google Fonts) y "Compartir link" (Supabase). Todo lo demás —
> incluida la exportación— funciona sin conexión.

---

## 3. La pantalla en 30 segundos

```
┌────────────────────────────────────────────────────────────────────┐
│ WEBFORGE_BUILDER          12 módulos  [Compartir link] [Exportar]  │  ← barra superior
├──────────────────────┬─────────────────────────────────────────────┤
│ Marca                │  HOME  NOSOTROS  CATALOGO  …   preview…     │  ← pestañas de página
│ Colores              │ ┌─────────────────────────────────────────┐ │
│ Tipografía y efectos │ │                                         │ │
│ Movimiento y efectos │ │        vista previa en vivo             │ │  ← el sitio real
│ Textos               │ │        (el sitio que se exporta)        │ │
│ Textos por sección   │ │                                         │ │
│ Módulos      12/229  │ │                                         │ │
│ Infraestructura      │ └─────────────────────────────────────────┘ │
└──────────────────────┴─────────────────────────────────────────────┘
       panel                            preview
```

- **Panel izquierdo**: toda la configuración, en bloques plegables. Cada cambio regenera el
  preview solo (con un retardo mínimo mientras escribís).
- **Preview derecho**: el sitio real. No es una simulación: es exactamente el HTML, el CSS y
  el JavaScript que va a salir en el ZIP.
- **Pestañas de página**: una por cada página que generan los módulos elegidos. Cambian según
  lo que tildes.
- **Barra superior**: cantidad de módulos elegidos, "Compartir link" (si el server tiene
  Supabase) y **Exportar proyecto .zip**.

---

## 4. Flujo de trabajo recomendado

El orden que menos hace volver atrás:

1. **Arrancá desde un preset** (bloque Módulos): *Landing*, *Tienda*, *Reservas* o *Blog*.
   Reemplaza la selección actual y te deja algo mirable en un segundo.
2. **Cargá la marca**: nombre, eslogan y, si ya lo tenés, el dominio.
3. **Elegí colores y tipografía**. Mirá el preview: los tokens de contraste se recalculan
   solos, así que un fondo oscuro cambia todo el sistema de texto.
4. **Escribí los textos** del hero y de "Nosotros".
5. **Sumá o sacá módulos** buscándolos por nombre. Mirá el preview después de cada tanda.
6. **Personalizá el contenido** de cada sección desde *Textos por sección*: títulos, bajadas,
   listas de servicios, planes, preguntas. Es el paso que convierte un sitio de demostración
   en el sitio de un negocio concreto, y el que más se saltea.
7. **Elegí el movimiento** en *Movimiento y efectos*. Si no tenés una preferencia, tocá
   "Sorprendeme" un par de veces y quedate con lo que te guste.
8. **Elegí la infraestructura**: si el sitio va a producción, Vercel + Supabase.
9. **Exportá el ZIP**, descomprimilo, `npm install`, `npm start` y probalo local.
10. **Publicalo** siguiendo [DEPLOY.md](DEPLOY.md).

> Consejo: no tildes 229 módulos "para ver qué pasa". Genera, pero el sitio queda inmanejable
> y el menú, kilométrico. Elegí por lo que el negocio realmente necesita mostrar y operar.

---

## 5. Panel: Marca

| Campo | Para qué sirve | Dónde se ve |
|---|---|---|
| **Nombre** | Nombre del negocio | Navbar, `<title>` de cada página, pie, README y nombre del ZIP |
| **Eslogan** | Frase corta de la marca | Pie de página y descripción del `package.json` |
| **Dominio** (opcional) | La dirección final del sitio | `sitemap.xml`, feed RSS y metas `og:url` / `canonical` |

**Sobre el dominio**: se puede escribir `midominio.com` (el Builder le pone `https://` solo).
Si lo dejás vacío, el sitemap y las metas salen con un placeholder `https://TU-DOMINIO.com`
que hay que reemplazar a mano después. Si ya sabés el dominio, cargalo ahora: es gratis y
evita ese pendiente.

El **nombre** también define el nombre del archivo exportado: "Panadería El Sol" →
`panaderia-el-sol.zip`.

---

## 6. Panel: Colores

Tres colores definen todo el sistema visual:

- **Primario**: color de marca, se usa en degradados, sombras y superficies.
- **Acento**: botones, links, foco de los campos, estados activos.
- **Fondo**: el fondo de las páginas.

A partir de esos tres, el generador **calcula** el resto (superficie de tarjetas, color de
texto, texto secundario, líneas). No hay que elegirlos: el cálculo garantiza contraste
legible con cualquier paleta.

**Cómo funciona el contraste automático**: el Builder mide la luminancia del fondo elegido. Si
es oscuro, el texto pasa a claro; si es claro, a oscuro. Podés poner un fondo negro o uno
amarillo y el texto sigue siendo legible sin que toques nada.

> Límite conocido: un fondo de tono medio (un gris medio, un celeste apagado) no llega al
> mínimo de contraste AA con **ninguna** dirección de texto. Es una limitación física del
> texto directo sobre ese fondo, no del cálculo. Si el preview se ve lavado, movete a un fondo
> más claro o más oscuro.

---

## 7. Panel: Tipografía y efectos

### Familia tipográfica

Ocho opciones, con muestra en vivo:

| Opción | Tipo | Offline |
|---|---|---|
| Sistema (moderna) | stack del sistema | sí |
| Humanista | stack del sistema | sí |
| Clásica (serif) | stack del sistema | sí |
| Técnica (mono) | stack del sistema | sí |
| Montserrat | Google Fonts | no |
| Inter | Google Fonts | no |
| Poppins | Google Fonts | no |
| Space Grotesk | Google Fonts | no |

Las cuatro primeras no piden nada a la red: el sitio generado corre 100% offline. Las cuatro
web fonts se cargan desde Google Fonts y el panel te avisa con una nota. Elegí una sola: la
tipografía se aplica a toda la interfaz (títulos, cuerpo y labels).

### Despliegue del acordeón (FAQ)

Tres estilos para el módulo de preguntas frecuentes: *Deslizar*, *Deslizar con fundido* y
*Resorte (con rebote)*, más un tilde opcional para animar la aparición del texto.

El acordeón **siempre** se despliega animado: lo que elegís es el estilo. El único apagado
legítimo es la preferencia "menos movimiento" del sistema operativo del visitante, que el
sitio respeta automáticamente en todas sus animaciones.

---

## 8. Panel: Movimiento y efectos

**Ocho ejes independientes** que definen cómo se mueve el sitio. Cada uno se elige por separado
y el preview lo muestra al instante. Combinados dan más de un millón de configuraciones
distintas, así que dos sitios generados con el Builder no tienen por qué parecerse en nada.

| Eje | Qué controla | Opciones |
|---|---|---|
| **Tarjetas (hover)** | Qué hace una tarjeta al pasarle el mouse | Levantar con sombra · Borde brillante · Fondo aurora · Acercar · Inclinación 3D · Foco de luz · Borde que gira · Desenfocar las de al lado · Sin efecto |
| **Aparición al hacer scroll** | Cómo entran las secciones al bajar | Fundido hacia arriba · Con desenfoque · Cortina · Rotar y acercar · Crecer · Desde los costados · Girar · Sin aparición |
| **Botones** | La microinteracción del CTA | Levantar · Barrido de brillo · Relleno deslizante · Apretar · Flecha que avanza · Magnético · Sin efecto |
| **Enlaces del menú** | El hover de la navbar | Subrayado que entra · El texto rueda · Resaltado · Punto indicador · Sin efecto |
| **Títulos** | Cómo aparece un título en pantalla | Sin efecto · Palabra por palabra · Letra por letra · Destello · Subrayado que se dibuja |
| **Imágenes y medios** | El hover de fotos y bloques visuales | Acercar · Máscara que se abre · Sale del desenfoque · De gris a color · Sin efecto |
| **Campos de formulario** | Cómo responde un campo al foco | Anillo de acento · Resplandor · Levantar · Subrayado que crece |
| **Cambio de página** | La transición al navegar | Sin transición · Fundido · Deslizar · Cortina |

Dos atajos al pie del bloque: **Volver a los valores por defecto** (la primera opción de cada
eje) y **Sorprendeme** (una combinación al azar; si te gusta, quedátela).

### Cosas que conviene saber

- **Los valores por defecto reproducen el sitio de siempre.** Un proyecto guardado antes de que
  existiera este bloque genera exactamente el mismo resultado que antes.
- **Las tarjetas con formularios nunca se mueven.** Una tarjeta que se desplaza mientras estás
  tipeando es molesta; en su lugar, sus campos responden al foco con el efecto elegido.
- **"Aparición al hacer scroll" necesita el módulo `reveal`** (Animaciones). Sin él, el sitio
  no oculta nada para revelarlo después.
- **"Cambio de página" usa las transiciones nativas del navegador.** Donde no existen, la
  navegación es la de siempre: no hay JavaScript involucrado ni nada que se pueda romper.
- **Todo respeta "reducir movimiento".** Si el visitante lo tiene activado en su sistema
  operativo, el sitio queda estático y perfectamente usable. No es opcional ni configurable:
  es accesibilidad.
- **La mayoría de los efectos son CSS puro.** Sólo cinco variantes (inclinación 3D, foco de luz,
  botón magnético, flecha, texto que rueda y los títulos animados) agregan JavaScript, y sólo
  se emite si elegiste una de ellas: una configuración de puro CSS no suma ni un byte.

---

## 9. Panel: Textos

Los cuatro textos base de todo sitio:

| Campo | Máximo | Dónde va |
|---|---|---|
| Título del hero | 90 caracteres | `<h1>` de la portada |
| Bajada del hero | 160 caracteres | párrafo bajo el título |
| Botón principal | 30 caracteres | CTA del hero |
| Texto "Nosotros" | 600 caracteres | página `/about.html` |

Consejos de redacción para el hero: decí **qué hacés y para quién**, no un eslogan abstracto.
"Reparamos electrodomésticos en el día, en toda la ciudad" trabaja mucho mejor que
"Excelencia y compromiso". El botón, un verbo: "Pedir presupuesto", "Ver la carta", "Reservar".

> Si además querés que el cliente pueda cambiar estos textos **desde el sitio publicado**,
> sin volver al Builder ni redeployar, activá el módulo funcional **Textos editables**
> (`textos`): siembra estos mismos valores en el backend y agrega un panel `/textos-admin.html`.

---

## 10. Panel: Textos por sección

Acá se personaliza **el contenido de cada sección elegida**, sin tocar una línea de código.

El bloque se arma solo: cada módulo declara qué textos suyos son editables, y aparece en el
panel apenas lo tildás. Hoy hay **39 secciones con textos editables y 162 campos**, y el número
crece con cada módulo nuevo.

### Cómo funciona

- Cada sección es un grupo plegable con sus campos. El buscador de arriba filtra por nombre de
  sección o de campo.
- Algunos campos son **de opciones cerradas** (un desplegable): por ejemplo, el objeto del
  recorrido de la *Escena 3D al scroll*. Ahí no se escribe: se elige.
- El **texto gris dentro del campo** (el placeholder) es lo que dice el sitio hoy. Si escribís
  algo, lo reemplaza; si lo **borrás, vuelve al original**. Vaciar un campo nunca deja un hueco.
- Los campos con varias líneas son **listas**: un ítem por renglón. Cuando el ítem tiene varias
  partes se separan con `|`, y la ayuda del campo dice en qué orden van. Por ejemplo, en
  Servicios: `truck | Envíos en el día | Salimos a la mañana y llega a la tarde`.
- Podés poner **más o menos ítems** que los originales: la sección se adapta.
- En las listas que llevan ícono, el nombre sale del catálogo [Phosphor](https://phosphoricons.com).
  Si te equivocás con el nombre, se usa un ícono de reserva y no se rompe nada.

### Qué se puede personalizar

Un ejemplo de la profundidad que alcanza:

| Sección | Campos editables |
|---|---|
| **Servicios** | Título, bajada y la lista completa (ícono, título y texto de cada uno) |
| **Precios** | Título, bajada, planes con importe y plan destacado, texto del botón, y el plan "a medida" entero |
| **Preguntas frecuentes** | Título y todas las preguntas con sus respuestas (que también alimentan los datos estructurados que lee Google) |
| **Contacto** | Título, bajada, las etiquetas de cada campo, el texto del botón, el horario y el mensaje de "gracias" |
| **Pedido de presupuesto** | Nombres de los pasos, opciones de "qué necesitás", rangos de presupuesto y los textos de los tres botones |
| **Banner de cookies** | El texto legal y las dos etiquetas de los botones |
| **Verificación de edad** | Edad mínima, días de recuerdo, título, texto y los dos botones |
| **Trabajá con nosotros** | Las búsquedas abiertas (puesto, modalidad y descripción), que además alimentan el desplegable del formulario |

El catálogo completo de campos está a la vista en el panel: tildá un módulo y abrí su grupo.

### La regla que evita el error más caro

Cuando una sección tiene además su **módulo administrable** (por ejemplo `faq` + `faqadmin`),
lo que escribís acá **se usa también como dato inicial del panel de administración**. Así el
sitio publicado y el panel arrancan diciendo lo mismo: no pasa que la página muestre tus textos
y el administrador, los de ejemplo.

> **Ojo con el orden**: si el módulo administrable está activo, después de la primera carga
> manda lo que haya en el backend. Los textos de acá son el punto de partida, no un candado.

---

## 11. Panel: Módulos

Es el corazón del Builder: 229 módulos agrupados en dos familias.

### Interfaz vs. funcionales

- **Interfaz (101)**: secciones y comportamientos visuales. Se hornean en el HTML exportado.
  Un hero, una galería, un acordeón de FAQ, el menú hamburguesa.
- **Funcionales (128)**: agregan backend real — rutas de API, validación en el servidor,
  persistencia y casi siempre un panel de administración.

El catálogo completo, con qué hace cada uno, está en **[MODULOS.md](MODULOS.md)**.

### El par "sección + administrable"

Es el patrón más importante para entender el catálogo. Muchas secciones de interfaz vienen
con textos y datos de ejemplo horneados. Para que el cliente pueda cambiarlos sin regenerar,
existe un módulo funcional que le da backend:

| Sección (interfaz) | Su administrador (funcional) | Qué vuelve editable |
|---|---|---|
| `faq` | `faqadmin` | Las preguntas frecuentes |
| `pricing` | `planes` | Planes, importes y el plan destacado |
| `team` | `equipo` | Las personas del equipo |
| `hours` | `horarios` | Horarios, feriados y "abierto ahora" |
| `timeline` | `historia` | Hitos y pasos del proceso |
| `logos` / `press` / `trust` | `marca` / `razones` | Clientes, medios, sellos y garantías |
| `events` | `eventos` | La agenda de eventos |
| `waitlist` | `espera` | La lista de espera y su contador real |
| `socialfeed` | `publicaciones` | El feed de redes |
| `productcompare` | `comparativa` | La tabla comparativa |
| `quiz` | `recomendador` | El cuestionario y sus resultados |
| `currency` | `cambio` | Las cotizaciones |
| `services` | `servicios` | Los servicios y su página de detalle |

**Regla práctica**: si un dato de la sección lo va a querer cambiar el cliente alguna vez
(un precio, un horario, una pregunta), activá también su módulo administrable. Si no, el
cambio más chico obliga a volver al Builder, regenerar y volver a publicar.

### Presets

Cuatro puntos de partida que **reemplazan** la selección actual:

| Preset | Para qué |
|---|---|
| **Landing** | Sitio institucional de una empresa de servicios |
| **Tienda** | E-commerce con catálogo, carrito, cupones y reseñas |
| **Reservas** | Turnos, horarios, mapa y contacto |
| **Blog** | Contenido, artículos, RSS y newsletter |

Son un arranque, no un destino: después ajustás.

### Buscador

El campo de búsqueda filtra por id, nombre y descripción, y abre solo las categorías con
coincidencias. Atajo de teclado: **`/`** desde cualquier lado (fuera de un campo de texto).

Buscá por lo que necesitás, no por el nombre del módulo: escribir `email`, `stock`, `turno` o
`whatsapp` encuentra todo lo relacionado.

### Dependencias automáticas

Un módulo puede necesitar otros. Cuando tildás `cart`, el Builder agrega `auth` solo y te lo
muestra en el resumen con la etiqueta **auto**. Las dependencias se resuelven **en cadena**:
`pos` trae `auth`, `branches` y `products-admin`.

No podés quitar una dependencia mientras el módulo que la pide siga tildado: es correcto, el
proyecto no compilaría sin ella.

### El resumen de selección

Debajo del buscador aparecen los módulos elegidos como chips. La **×** de cada uno lo quita.
Los chips con etiqueta *auto* son dependencias: para sacarlos hay que desmarcar el módulo que
los trajo.

### Orden de las secciones en la Home

Las secciones aparecen en la Home en el **orden de carga del registro** (alfabético por
archivo dentro de cada tipo), no en el orden en que las tildás. Si necesitás otro orden, hoy
se cambia renombrando el archivo del módulo en `modules/ui/`.

---

## 12. Panel: Infraestructura

### Base de datos

| Opción | Cuándo usarla | Qué agrega al ZIP |
|---|---|---|
| **JSON local** | Probar en tu máquina, demos, sitios sin datos críticos | `src/db.js` sobre archivos en `data/` |
| **Supabase** | Cualquier cosa que vaya a producción | `src/db.js` vía PostgREST + `supabase/schema.sql` |

Las dos exponen **la misma interfaz async**, así que el código de los módulos es idéntico:
cambiar de una a otra no toca ni una línea de lógica.

> Con JSON local, los datos viven en archivos dentro de `data/`. En un hosting serverless el
> filesystem es efímero: **los datos se pierden en cada deploy**. Por eso, para publicar, la
> respuesta correcta es Supabase.

### Deploy

| Opción | Qué agrega |
|---|---|
| **Local (npm start)** | Nada extra: `server.js` y listo |
| **Vercel** | `vercel.json` (con los rewrites de los módulos) y `api/index.js` |

Al elegir Vercel, la base de datos **pasa a Supabase automáticamente** y el panel te avisa.
No es una preferencia: es la única combinación que persiste datos en Vercel.

### Guía B2B SaaS

Tilde opcional que genera `docs/B2B-SAAS.md` **a medida de tu proyecto** (con sus módulos y
sus colecciones reales): cómo convertirlo en multi-tenant por organización, planes y límites,
cobro recurrente con Mercado Pago o Stripe, onboarding y checklist para salir a vender.

---

## 13. El preview

- **Es el código real.** El iframe renderiza exactamente los archivos que se exportan, con el
  CSS y el JS inlineados. No hay dos caminos de render que puedan divergir.
- **Se actualiza solo** con cada cambio del panel (con un retardo corto mientras escribís).
- **Las pestañas** son las páginas del sitio. Aparecen y desaparecen según los módulos
  elegidos. Si desmarcás el módulo de la página que estabas mirando, vuelve solo a HOME.
- **La API no responde en el preview.** Los formularios y los paneles muestran el aviso
  "Vista previa: la API corre en el proyecto exportado". Es esperado: el backend existe recién
  cuando corrés el ZIP. Todo lo visual, las animaciones y la navegación sí funcionan.
- **Para probar en móvil**: achicá la ventana del navegador. El sitio generado es responsive.

---

## 14. Exportar el proyecto

Botón **Exportar proyecto .zip** de la barra superior. El archivo se llama como el slug de la
marca (`mi-empresa.zip`).

Qué trae adentro:

```
package.json         una sola dependencia: express
server.js            arranque local
src/app.js           la app Express (rutas y middlewares de los módulos)
src/db.js            capa de datos (JSON o Supabase, según lo elegido)
src/validate.js      helpers de validación
src/env.js           carga de .env sin dependencias
models/              modelo + validaciones por módulo
routes/              un router Express por módulo
public/              el sitio: HTML, CSS y JS vanilla
.env.example         las variables que hay que completar
README.md            instrucciones específicas de ESTE proyecto
```

Y según lo que hayas elegido: `vercel.json` + `api/index.js` (Vercel),
`supabase/schema.sql` (Supabase), `docs/B2B-SAAS.md` (guía B2B).

> **Leé el README generado.** No es genérico: lista los módulos incluidos, la tabla de rutas
> de API y —lo más importante— los **avisos de placeholders**: los datos de ejemplo que hay
> que reemplazar con información real antes de publicar (planes, badges, medios de prensa,
> enlaces de tiendas, textos legales).

---

## 15. Correr el proyecto exportado

```bash
unzip mi-empresa.zip
cd mi-empresa
npm install
cp .env.example .env      # copy .env.example .env  en Windows
npm start
```

Abre en `http://localhost:3000`.

### El primer usuario es el admin

Si activaste **Autenticación**, el **primer usuario registrado recibe rol `admin`
automáticamente**. Registrate vos antes de que el sitio sea público, o el primero que llegue
se queda con el panel de administración.

Los roles son `user`, `repositor` y `admin`, y se administran desde *Gestión de usuarios*.
Un usuario desactivado no puede iniciar sesión.

### Variables de entorno

`.env.example` lista lo que hay que completar. Las más comunes:

| Variable | Cuándo | Cómo se obtiene |
|---|---|---|
| `JWT_SECRET` | Siempre que haya auth | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `SUPABASE_URL` | Persistencia Supabase | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Persistencia Supabase | La **service_role**, no la `anon` |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | Chatbot o Agente IA | Groq, Gemini o OpenRouter (todos con capa gratuita) |
| `RESEND_API_KEY` | Avisos por email | Resend (capa gratuita) |

La service key **solo vive en el servidor**, nunca en el frontend, y las tablas de Supabase
se crean con RLS activado.

---

## 16. Publicarlo en internet

El recorrido completo está en **[DEPLOY.md](DEPLOY.md)**. El resumen:

1. Creá un proyecto en [supabase.com](https://supabase.com) (plan gratuito).
2. SQL Editor → New query → pegá y ejecutá `supabase/schema.sql`.
3. Copiá la Project URL y la service_role key.
4. `npm i -g vercel && vercel --prod` desde la carpeta del proyecto.
5. En Vercel → Settings → Environment Variables cargá las de `.env.example`.
6. Deployments → ⋯ → **Redeploy** (las variables aplican al deploy siguiente).
7. Entrá y **registrate primero** para quedarte con el rol admin.

---

## 17. Qué se edita sin regenerar y qué no

Esta es la distinción que más plata y tiempo ahorra en un proyecto real.

### Se edita desde el sitio publicado (sin volver al Builder)

Todo lo que administra un módulo funcional: productos, precios, pedidos, turnos, artículos,
preguntas frecuentes, horarios, equipo, planes, banners, páginas nuevas, el menú de
navegación, los textos base (con el módulo `textos`), los datos del negocio, los logos de
clientes y prensa, las garantías, la agenda de eventos, las cotizaciones de moneda.

### Requiere regenerar y volver a publicar

- Qué módulos tiene el sitio (agregar o sacar una sección).
- Los colores, la tipografía y los ocho ejes de movimiento.
- Los **textos por sección**: son el contenido inicial. Si la sección tiene su módulo
  administrable activo, después de la primera carga manda el backend y ya no hace falta
  regenerar; si no lo tiene, cada cambio de texto pasa por acá.
- La infraestructura (pasar de JSON a Supabase, o de local a Vercel).

**Por eso conviene decidir temprano**: si el cliente va a querer tocar algo, activá el módulo
administrable correspondiente **antes** de exportar.

---

## 18. Compartir una configuración por link

El botón **Compartir link** aparece solo si el server del Builder tiene Supabase configurado
(`SUPABASE_URL` y `SUPABASE_SERVICE_KEY`). Guarda la configuración actual y te copia al
portapapeles una URL con `?p=<id>`.

Quien abra ese link ve el Builder con **tu configuración exacta** cargada y puede seguir
editando o exportar. Sirve para mandarle una propuesta armada a un cliente sin mandarle un ZIP.

No guarda el proyecto generado, solo la configuración: el ZIP se arma al momento.

---

## 19. Recetas por tipo de negocio

Puntos de partida probados. Empezá por el preset indicado y sumá lo de la columna derecha.

| Negocio | Preset | Módulos que casi siempre suma |
|---|---|---|
| **Estudio de servicios** (contable, legal, diseño) | Landing | `servicios`, `quote` + `quotesadmin`, `equipo`, `faqadmin`, `mailer` |
| **Restaurante / bar** | Landing | `menu`, `pedidoscarta`, `reservamesa`, `horarios`, `map`, `albums` |
| **Peluquería / consultorio** | Reservas | `agenda`, `profesionales`, `horarios`, `recuperar`, `mailer` |
| **Tienda online** | Tienda | `products-admin`, `ficha`, `tienda`, `pedidos`, `variantes`, `shipping`, `pagoinformado`, `descuentos`, `escena3d` (objeto: caja) |
| **Inmobiliaria / clasificados** | Landing | `listings`, `formularios`, `clientes`, `qr`, `escena3d` (objeto: casa) |
| **Gimnasio / club** | Landing | `membership`, `cursos`, `loyalty`, `cumples`, `caja` |
| **Institución / ONG** | Landing | `donations`, `eventos` + `eventregister`, `paginas`, `blogcms`, `newsletter` + `campanas` |
| **Distribuidora / mayorista** | Tienda | `listaprecios`, `ctacte`, `compras`, `inventory`, `branches`, `pos` |

### La escena 3D al scroll

El módulo **`escena3d` (Escena 3D al scroll)** es la pieza de impacto de la landing: un objeto
típico del rubro se recorre y se desarma en 3D a medida que el visitante baja, con pasos de
texto al costado. El objeto se elige en *Textos por sección*:

| Objeto | Rubro pensado | Qué hace al scrollear |
|---|---|---|
| **Casa** | Inmobiliaria, construcción | Órbita de la fachada, se levanta el techo y aparecen los ambientes |
| **Teléfono desarmado** | Tecnología, service | El equipo se separa en capas (vista explotada) y se rearma |
| **Anteojos** | Óptica | El armazón se ensambla, las varillas se despliegan y las lentes se entintan |
| **Switch mecánico** | Periféricos, gaming | Se desarma verticalmente pieza por pieza y termina con la pulsación |
| **Caja de envío** | E-commerce, logística | Se corta la cinta, se abren las solapas y el producto se eleva |

Es puramente visual (no tiene backend), usa el scroll nativo —nunca "secuestra" la rueda—, se
pinta con los colores de tu marca, y con JavaScript apagado o "reducir movimiento" activado
queda una vista estática con los pasos como lista. El título y los pasos se personalizan como
cualquier otro texto por sección.

Tres módulos que conviene tildar **en casi todos los casos**:

- **`seo`** — metas, Open Graph y `sitemap.xml`. Sin esto, el sitio no existe en Google.
- **`navmobile`** — menú hamburguesa. La mitad del tráfico es móvil.
- **`textos`** — que el cliente pueda corregir un título sin llamarte.

Y dos más si el sitio recibe formularios: **`escudo`** (anti-spam) y **`mailer`** (que te
avise por email cuando entra algo).

---

## 20. Problemas frecuentes

**El preview dice "error" o queda en blanco.**
Casi siempre es un color inválido o el nombre de marca vacío. Revisá el mensaje del toast
abajo de todo: el Builder valida la configuración antes de generar y dice qué campo está mal.

**Tildé un módulo y no aparece nada en el preview.**
Puede ser un módulo sin sección en la Home: muchos funcionales aportan solo una página propia
(mirá las pestañas de arriba del preview) o un panel de admin. Buscalo en
[MODULOS.md](MODULOS.md), en la columna *Aporta*.

**Los formularios del preview no envían nada.**
Es correcto. En el preview la API no corre. Exportá y probá el proyecto local.

**El proyecto exportado no arranca: "Cannot find module 'express'".**
Falta el `npm install` dentro de la carpeta del proyecto exportado. El ZIP no trae
`node_modules`.

**Publiqué en Vercel y los datos se borran.**
Exportaste con persistencia JSON. Volvé al Builder, elegí Vercel (fuerza Supabase) y exportá
de nuevo.

**Publiqué en Vercel y una página da 404 aunque local funciona.**
Es una ruta servida por un middleware fuera de `/api` (`/p/<slug>`, `/producto/<slug>`,
`/etiqueta/<slug>`, `/l/<nombre>`, `/q/<nombre>`). Esas rutas necesitan su entrada en
`vercel.json`; el generador la agrega sola, así que verificá que el `vercel.json` publicado
sea el del ZIP y no uno viejo.

**Perdí el acceso de admin / alguien se registró primero.**
Con Supabase: entrá al SQL Editor y cambiá el `role` de tu fila en la tabla `users`. Con JSON:
editá `data/users.json`.

**Las animaciones no se ven.**
Si tenés activada la opción "reducir movimiento" del sistema operativo, el sitio la respeta y
todo pasa a ser instantáneo. Es intencional (accesibilidad).

**Cambié el texto de una sección pero el sitio publicado sigue mostrando el viejo.**
Esa sección tiene su módulo administrable activo y los datos del backend le ganan al HTML
horneado. Editalo desde su panel de administración, no desde el Builder.

---

## 21. Glosario

| Término | Qué significa acá |
|---|---|
| **Módulo** | Una pieza elegible del catálogo. Aporta secciones, páginas, API o middleware. |
| **Módulo de interfaz** | Solo visual: se hornea en el HTML exportado. |
| **Módulo funcional** | Aporta backend: rutas, validación, persistencia y panel. |
| **Dependencia (`requires`)** | Otro módulo que hace falta para que este funcione. Se agrega solo. |
| **Colección** | Una "tabla" de datos (`products`, `orders`, `bookings`…). |
| **Horneado** | Contenido escrito directo en el HTML al generar. Para cambiarlo hay que regenerar. |
| **Administrable** | Contenido que vive en el backend y se edita desde un panel, sin regenerar. |
| **Preset** | Selección de módulos predefinida para un tipo de sitio. |
| **Placeholder** | Dato de ejemplo que hay que reemplazar antes de publicar. |
| **Middleware** | Código que ve todos los pedidos antes que nadie (mantenimiento, anti-spam, roles). |
| **JWT** | El token de sesión que devuelve el login. |
| **RLS** | Row Level Security de Postgres: las tablas de Supabase solo responden con la service key. |

---

## 22. Para desarrolladores: agregar un módulo

Creá un archivo en `modules/ui/` o `modules/functional/`. Se registra solo al arrancar: no hay
que tocar ningún índice.

```js
module.exports = {
  id: 'mi-modulo', type: 'functional', name: 'Mi módulo',
  description: 'Qué hace, en una oración.',
  requires: ['auth'],                             // dependencias en cadena (opcional)
  fields: [                                       // textos editables desde el Builder (opcional)
    { key: 'titulo', label: 'Título de la sección', default: 'Lo que hacemos', max: 80 },
    { key: 'items', label: 'Ítems', type: 'list', default: ITEMS_DEFAULT, max: 2000,
      hint: 'Uno por línea: icono | título | texto' },
  ],
  html: (cfg) => `<section>…</section>`,          // sección en la Home (opcional)
  pages: (cfg) => ({ nombre: { title, html } }),  // páginas propias (opcional)
  files: (cfg, ctx) => ({ 'routes/x.js': '…' }),  // backend; ctx = {pages, nav}
  mounts: [{ route: '/api/x', file: 'routes/x.js' }],
  middlewares: [{ file: 'src/middleware/x.js' }], // global, ANTES de los estáticos
  vercelRewrites: ['/p/:slug*'],                  // rutas propias fuera de /api
  env: { MI_CLAVE: 'valor-ejemplo' },             // se suma a .env.example
  nav: (cfg) => [{ label: 'X', href: '/x.html' }],
  clientJs: (cfg) => `/* JS que va a public/js/app.js */`,
  head: (cfg, page) => `<meta …>`,                // fragmento del <head>
  collections: ['micoleccion'],
  usesAnime: true,                                // si usa Anime.js
  readmeNotes: (cfg) => ['Aviso para el README generado'],
};
```

Después:

1. Agregalo a una categoría en **`src/categorias.js`** (si no, cae en "Otros").
2. Regenerá la referencia: `node tools/catalogo.js`.
3. Probá: arrancá el Builder, tildalo, mirá el preview, exportá y corré el proyecto.

### Textos editables (`fields`)

El panel *Textos por sección* se arma solo con lo que declara cada módulo: no hay que tocar
nada del frontend del Builder. En el módulo, los valores se leen con dos helpers de
`src/templates.js`:

```js
const { esc, txt, txtList } = require('../../src/templates');

esc(txt(cfg, 'mi-modulo', 'titulo', 'Lo que hacemos'))   // un texto
txtList(cfg, 'mi-modulo', 'items', ITEMS_DEFAULT)        // una lista; las líneas con "|" vienen partidas
```

Cuatro reglas que no son opcionales:

- **El `default` tiene que ser exactamente el texto que el módulo hornea hoy**, y para las
  listas conviene armarlo desde el array base con `.map(...).join('\n')`: una copia a mano
  se desincroniza.
- **Todo lo que sale de `txt`/`txtList` pasa por `esc()`** antes de entrar al HTML o a un
  atributo. Si el texto entra a un string de JavaScript (un `clientJs`), va por
  `JSON.stringify(...)` en su lugar: un apóstrofo rompería el archivo entero.
- **Si el dato es un nombre de ícono Phosphor, usá `phIconOr(nombre, 'reserva', opciones)`**,
  nunca `phIcon`: un nombre mal escrito por el usuario tiraría abajo la generación completa.
- **Si otro módulo siembra una colección con esos datos** (el par sección + administrable),
  ese módulo tiene que importar la función resolutora del módulo UI y sembrar con ella. El
  ejemplo canónico es `services` + `servicios`; sin esto, la primera carga del sitio parpadea
  mostrando primero un contenido y después otro.

### Efectos de movimiento (`src/motion.js`)

Los ocho ejes, sus variantes y el CSS/JS de cada una viven en un solo archivo. Agregar una
variante nueva es sumarla al arreglo `EJES` y a la tabla de su eje: aparece en el panel del
Builder sola, porque el frontend lee el catálogo de `/api/efectos`.

**Reglas de la casa** (ver [PROGRESO.md](PROGRESO.md) y [CAMBIOS.md](CAMBIOS.md)):

- JavaScript vanilla, sin dependencias nuevas en el proyecto exportado.
- Nada que requiera una API paga o una clave obligatoria.
- Comentarios en español, con `//` en JS y `/* */` dentro de bloques `<style>`.
- Todo texto de usuario se escapa antes de entrar al HTML.
- Toda animación respeta `prefers-reduced-motion`.
- Si la animación lleva a un estado final (una opacidad, un número), poné una red de
  seguridad con `setTimeout`: con la pestaña oculta, Anime.js pausa su loop.
