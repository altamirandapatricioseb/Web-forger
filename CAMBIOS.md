# Registro de cambios — WebForge Builder

> Este proyecto no usa git por decisión del usuario: los cambios se documentan acá,
> con el mismo formato de mensaje que usaría un commit.

## 2026-07-22 (43ª corrida) — ESCENA 3D AL SCROLL, UNA POR RUBRO

Un módulo UI nuevo, `escena3d`, con **cinco escenas** intercambiables desde el Builder: la
sección de impacto que a una landing generada le faltaba, en la línea de las páginas de
storytelling tipo 45R "Indigo Hakusho". El visitante scrollea y un objeto típico del rubro se
recorre, se abre y se desarma en 3D, con los pasos de texto cambiando al costado.

| Objeto | Rubro | Qué pasa al scrollear |
|---|---|---|
| **Casa** | Inmobiliaria, construcción | Órbita de fachada → se levanta el techo → la fachada se vuelve vidrio y aparecen ambientes y muebles → vista de casa de muñecas |
| **Teléfono desarmado** | Tecnología, service | Vista explotada: tapa, batería, placa con chips y pistas, marco y pantalla se separan en Z y se rearman |
| **Anteojos** | Óptica | Las piezas vuelan a su lugar → las varillas se despliegan → las lentes se entintan → barrido de reflejo |
| **Switch mecánico** | Periféricos, gaming | Explosión vertical de la pila → reensamble → **la pulsación**, con el resorte comprimiéndose y un anillo de clic |
| **Caja de envío** | E-commerce, logística | Se corta la cinta → se abren las cuatro solapas → el producto se eleva y flota |

### Las decisiones que la sostienen

**Scroll nativo, no scroll-jacking.** La sección mide 420vh y el contenido va `sticky`; el
progreso se calcula con `getBoundingClientRect()` del contenedor. La rueda del mouse siempre
hace lo que el visitante espera y el estado visual es **función pura del scroll**: no hay
timers de animación, no hay estado acumulado, y saltar con la barra de scroll a cualquier
punto pinta exactamente el frame que corresponde.

**CSS 3D, cero librerías.** Ni Three.js ni WebGL: divs, `transform-style: preserve-3d`,
gradientes y `clip-path`. El proyecto exportado sigue con una sola dependencia y corriendo
offline. Los colores salen de los tokens del Builder con `color-mix`, así que la escena se ve
bien con cualquier paleta —se verificó con paleta clara y oscura.

**Degradación en cascada, en tres escalones.** Sin JavaScript la sección **no** mide 420vh
(sería un vacío inescrolleable): queda una vista estática con el objeto armado —la pose de
reposo vive en el CSS— y los pasos como lista numerada. Con `prefers-reduced-motion` pasa lo
mismo. Recién con JS y movimiento habilitado el motor agrega `.s3d-on`, que es lo que activa
la altura del recorrido y el sticky.

**Contrato de escena.** Cada escena es un archivo en `modules/ui/escena3d/` que exporta
`{id, label, titulo, pasos, html, css, js}`, donde `js` es una función
`(p, q, u, W)`. Agregar un rubro nuevo es crear el archivo y sumarlo al catálogo: aparece solo
en el select del Builder. El contrato completo, con el sistema de coordenadas y las
convenciones de geometría, está documentado en `casa.js`, que es la implementación de
referencia.

**Campo `fields` de tipo `select`.** El contrato de textos por sección de la 42ª sólo tenía
campos de texto libre. Se sumó `type: 'select'` con `options: [[valor, etiqueta], …]`: el
generador valida contra la lista (no por largo) y un valor desconocido cae al default. Es lo
que permite elegir el objeto del recorrido desde el panel.

### Tres bugs que encontró la verificación en navegador

1. **El motor no avanzaba en un panel embebido.** El `medir()` se apoyaba sólo en
   `requestAnimationFrame`, y en una pestaña/panel no visible el navegador puede no despachar
   **ni `scroll` ni rAF** —sólo timers—. El guard `pedido` quedaba trabado en `true` para
   siempre y la escena se congelaba en el frame 0. Ahora la tarea tiene red de seguridad con
   `setTimeout` y hay un sondeo de respaldo cada 300ms. Es la misma lección que la bitácora ya
   tenía anotada para Anime.js, en otra forma.
2. **Las aberturas de la casa flotaban fuera de la pared.** La regla de posicionamiento del
   contrato (`position:absolute` para las piezas) alcanza sólo a los **hijos directos** del
   raíz de la escena; puerta y ventanas son nietas y quedaban en flujo normal. Quedó anotado
   en el contrato: todo detalle 2D dentro de un plano necesita su propio `position:absolute`.
3. **El objeto se salía de cuadro en pantallas chicas y tablets.** El primer intento puso la
   escala responsive en reglas con selectores de distinta especificidad
   (`#escena3d.s3d-on .s3d-viewport` para alto vs `#escena3d .s3d-viewport` para ancho): la de
   alto le ganaba a la de ancho sin importar el orden, y en un celular angosto no se aplicaba
   nada. Se resolvió con **una sola variable** `--s3d-escala` que todas las media queries pisan
   con el mismo selector, así decide el orden y no la especificidad.

### Verificación

- **875 archivos `.js` generados** (catálogo completo × las 5 escenas, con marca
  `O'Brien & "Cía"`, Vercel + Supabase + guía SaaS y efectos no-default): `node --check` 0 fallas.
- **Auditoría de contrato** de las 5 escenas: campos obligatorios, `id` coincidente, CSS
  balanceado y scopeado, pose de reposo declarada, `js` evaluable con aridad 4, HTML sin
  `<script>` ni handlers inline. 5/5.
- **Recorte de cuadro medido en navegador** contra el borde real del stage, en cinco medidas
  (390×780, 768×1024, 1280×720, 1366×640, 1920×1080) y cinco puntos del scroll cada una:
  **0px de recorte** en todas.
- **Barrido fino de 21 puntos** por escena con paleta clara y oscura y el resto de los efectos
  encendidos: **0 errores de consola**.
- **Fallback sin JS** en las 5: sin `.s3d-on`, altura normal, objeto armado y los 4 pasos
  visibles como lista.
- **Proyecto exportado corriendo** (229 módulos, 80 secciones, Express 5): el recorrido
  funciona, el título y los pasos personalizados están, 0 errores de consola.

## 2026-07-22 (42ª corrida) — PERSONALIZACIÓN AL EXTREMO + MANUAL DE USUARIO

Tres cosas que no son módulos nuevos sino **cambios de núcleo**, más la documentación que
faltaba desde el principio.

### 1. Contrato `fields`: textos por sección (la sugerencia nº1, saldada)

Era el pendiente más viejo y más citado de la bitácora: cada corrida sumaba placeholders
("planes de `pricing`", "badges de `trust`", "frases de `marquee`") y todas terminaban con la
misma línea — *hace falta un mecanismo de campos por módulo en el Builder*.

Un módulo ahora declara `fields: [{key, label, default, max, type?, hint?}]` y el resto sale
solo: `/api/modules` lo publica, el panel arma el bloque **Textos por sección** sin conocer
ningún módulo en particular, y `normalize()` deja el valor resuelto en
`cfg.moduleTexts[id][key]`. Los módulos lo leen con dos helpers nuevos de `templates.js`,
`txt()` y `txtList()`.

**Cobertura: 39 secciones, 162 campos.** No sólo títulos y bajadas: las **listas** completas
(servicios, planes con importe, preguntas y respuestas, testimonios, filas de la tabla
comparativa, pasos del proceso, columnas del mega footer, puestos de trabajo), los **textos de
botón**, los **placeholders de formulario** y los **mensajes de éxito**.

Cuatro decisiones que sostienen el mecanismo:

- **Vaciar un campo vuelve al default, no deja un hueco.** El default de cada campo ES el texto
  que el módulo horneaba, y para las listas se arma desde el array base con `.map().join('\n')`
  en vez de copiarse a mano: una copia se desincroniza en la primera edición.
- **El recorte por `max` se hace en el generador, no sólo en el input.** La config también
  llega por `/api/preview` y por un link compartido, sin pasar por el panel.
- **Lo que va a un string de JavaScript viaja por `JSON.stringify`, no por `esc()`.** Un
  apóstrofo en un texto editable rompía el `app.js` generado entero.
- **`phIconOr()`**: los campos que llevan un nombre de ícono Phosphor ya no pueden tirar abajo
  la generación con un nombre mal tipeado; caen al ícono de reserva del módulo.

**Lo delicado fue la sincronía con los módulos administrables.** Seis backends sembraban su
colección con una **copia literal** de lo horneado (`servicios`, `faqadmin`, `planes`,
`razones`, `historia`). Si el usuario editaba la sección desde el Builder, la semilla quedaba
con los datos viejos y la primera carga del sitio parpadeaba: primero el HTML del Builder, un
instante después los datos del panel. Los cinco pasaron a importar la función resolutora del
módulo UI (`servicios(cfg)`, `faqs(cfg)`, `planes(cfg)`, `features(cfg)`, `pasos(cfg)`) y a
sembrar con ella. Una sola fuente de verdad por sección.

### 2. `src/motion.js`: ocho ejes de movimiento, 47 variantes

El único eje elegible era el hover de las tarjetas. Ahora son ocho, independientes entre sí:
**tarjetas** (9 variantes, con inclinación 3D, foco de luz que sigue al mouse, borde cónico
que gira y desenfoque de las hermanas), **aparición al scroll** (8, incluida cortina por
clip-path y giro sobre el eje X), **botones** (7: barrido de brillo, relleno deslizante,
apretar, flecha, magnético), **enlaces del menú** (5: subrayado, texto que rueda, resaltado,
punto), **títulos** (5: palabra por palabra, letra por letra, destello, subrayado que se
dibuja), **imágenes** (5), **campos de formulario** (4) y **cambio de página** (4, con las
View Transitions nativas). Adaptadas de la biblioteca de componentes al stack del proyecto
exportado: CSS puro donde alcanza y JavaScript vanilla donde no.

Tres cosas que valen más que la lista:

- **El default de cada eje reproduce el comportamiento histórico.** Una config guardada antes
  de este cambio genera exactamente el mismo sitio: el bloque `design` se normaliza en
  `motion.normalizeDesign()` y todo valor desconocido cae al default de su eje.
- **El JS se emite sólo si hace falta.** Cinco variantes necesitan JavaScript; las otras 42 son
  CSS. Una configuración de puro CSS no agrega ni un byte al `app.js` del proyecto exportado.
- **El catálogo es la fuente del panel.** `/api/efectos` devuelve los ejes con sus opciones y el
  frontend arma los selects con eso: agregar una variante en `src/motion.js` la hace aparecer en
  el Builder sin tocar el panel. Mismo criterio que se aplicó a las categorías del catálogo.

El módulo `reveal` dejó de tener sus keyframes horneados y los toma de `REVEAL_KEYFRAMES`.
Detalle que costó un bug: la variante `none` vale `null` a propósito, así que hay que preguntar
por la **clave** y no por el valor — con `||` terminaba animando como `fade`.

### 3. Bug encontrado de paso: una marca con apóstrofo rompía el proyecto entero

Probando la generación completa con nombres hostiles (`O'Brien & Cía`, `La "Mejor" Pizza`,
`Ñandú <b>Tech</b>`, con backslash y backtick) aparecieron **cuatro archivos generados que no
parseaban**: `server.js`, `routes/chatbot.js`, `routes/agent.js` y `public/js/app.js`. El
nombre de la marca se interpolaba crudo dentro de strings de JavaScript con comillas simples.
Una panadería llamada "D'Angelo" exportaba un proyecto que no arrancaba.

Los cuatro pasaron a `JSON.stringify`. De paso se corrigió que el prompt del chatbot y del
agente recibían el nombre **escapado como HTML**: el modelo leía `O&#39;Brien`.

### 4. `src/categorias.js`: el catálogo dejó de tener 86 módulos en "Otros"

Las categorías vivían duplicadas dentro de `public/app.js` y cubrían 42 de los 128 módulos
funcionales: los otros **86 caían todos juntos en "Otros"**, que con este tamaño de catálogo es
lo mismo que no tener categorías. Ahora hay una fuente única (`src/categorias.js`) que consumen
el panel (vía `/api/modules` y `/api/categorias`) y el generador del manual. Las 6 categorías
funcionales pasaron a 10 y **ningún módulo queda sin categoría**.

### 5. Documentación: `MANUAL.md` + `MODULOS.md`

- **`MANUAL.md`** — manual de usuario completo (22 secciones): qué es y qué no es, instalación,
  recorrido bloque por bloque del panel, flujo de trabajo, el par sección + administrable,
  exportar y correr el proyecto, **qué se edita sin regenerar y qué no** (la distinción que más
  tiempo ahorra en un proyecto real), recetas por rubro, problemas frecuentes, glosario y la
  guía para agregar un módulo.
- **`MODULOS.md`** — referencia de los 228 módulos agrupados por categoría, **generada** por
  `node tools/catalogo.js` desde el registro real. Se genera y no se escribe a mano porque una
  lista copiada se desactualiza en silencio, que es exactamente lo que le venía pasando a la
  lista de módulos del README.

### Verificación

- Generación con el catálogo completo (228 módulos, 351 archivos) y `node --check` sobre los
  **175 archivos `.js` generados**: 0 fallas.
- Las **47 variantes de movimiento**, una por una: generación + syntax-check del `app.js`
  resultante. 47/47.
- Los cuatro nombres de marca hostiles (apóstrofo, comillas dobles, HTML, backslash y backtick)
  sobre el catálogo completo: todos los `.js` parsean.
- Proyecto exportado con los 228 módulos **corriendo de verdad** (Express 5, `NODE_PATH`):
  Home, Nosotros, Servicios y Contacto en 200, `/api/products`, `/api/faqs` y `/api/planes`
  respondiendo, y los textos personalizados presentes en el HTML servido.
- Builder en navegador real: los 8 selects de efectos aplican al preview (verificado que el
  título se parte en palabras en el DOM del iframe y que el CSS del foco de luz y de la cortina
  de página llegan), el bloque de textos por sección aparece y desaparece con la selección, y
  un override se ve en la página correcta. **0 errores de consola** en el sitio generado con las
  76 secciones del catálogo completo.

## 2026-07-22 (41ª corrida) — LAS CINCO SECCIONES QUE TODAVÍA MENTÍAN

Lote de **5 módulos funcionales nuevos**. El chequeo de arranque encontró un hilo que ninguna
corrida había tirado: **cinco módulos UI que en su propia descripción dicen "frontend puro, sin
backend"**, "sin backend obligatorio" o "estática". No eran secciones decorativas: las cinco
**publican datos inventados** y ninguna se puede corregir sin regenerar y volver a deployar.

| Qué publicaba | Módulo UI | Módulo nuevo | Colecciones |
|---|---|---|---|
| Un contador de **1.240 personas anotadas que no existían** | `waitlist` | `espera` | `waitlist`, `waitlistcfg` |
| Tres eventos con **fechas fijas** que nadie va a sacar cuando pasen | `events` | `eventos` | `eventitems` |
| Un quiz que **tiraba a la basura** todas las respuestas | `quiz` | `recomendador` | `quizconfig`, `quizruns` |
| Ocho casilleros vacíos con **"me gusta" inventados** y `@tu_negocio` | `socialfeed` | `publicaciones` | `socialposts`, `socialcfg` |
| Cuatro planes con **precios inventados** enfrentados en una tabla | `productcompare` | `comparativa` | `compareitems`, `comparecfg` |

Es el mismo problema que la 37ª le encontró a `logos`, `press` y `trust` — placeholders que, como
no se ven rotos, salen a producción tal cual—, pero con un agravante: acá los datos falsos son
**números**. Una prueba social ("ya somos 1.240"), una métrica ("342 me gusta") y una tabla de
precios comparados son exactamente las tres cosas que un visitante usa para decidir.

### El patrón, ya repetido diez veces

Los cinco siguen el molde de `equipo`/`planes`/`faqadmin`: `requires` del módulo UI, siembra que
**repite lo horneado** para que la primera carga no parpadee, `GET` público, inyección en vivo
sobre el DOM ya renderizado y panel solo-admin. Lo que cambia por módulo son las decisiones:

**`espera` — la idempotencia es la funcionalidad.** El alta se normaliza a minúsculas y se busca
por email antes de insertar: volver a anotarse **devuelve la misma posición** en vez de sumar uno.
Sin eso, cualquiera infla el contador recargando la página, y el número deja de significar algo.
La **posición en la fila** es el orden de llegada calculado al leer, no un campo guardado: por eso
dar de baja a alguien hace que los de atrás suban solos, sin reescribir a nadie. El **arranque**
(gente anotada por otro canal) existe pero **empieza en 0** y el panel dice para qué es: si va a
haber un número al lado de "personas ya se anotaron", que sea uno que el negocio pueda defender.

**`eventos` — el servidor decide qué es "próximo".** La falla típica de una agenda no es estar
vacía: es que en marzo siga anunciando un taller de agosto. Un evento sigue siendo próximo hasta
**36 horas después del comienzo de su día en UTC** — la ventana cubre el día completo del evento en
cualquier huso horario (UTC-12 a UTC+14) y lo baja a la mañana siguiente; cortar a la medianoche
UTC escondería un evento nocturno de América mientras todavía está pasando. Si no queda ninguno,
**la sección se oculta entera**. Las fechas se formatean con una tabla de meses propia y no con
`toLocaleDateString`: `new Date('2026-08-15')` se parsea como UTC y al oeste de Greenwich devuelve
**el 14** — un módulo de agenda que corre el día de los eventos no sirve.

**`recomendador` — la fila nace en la primera respuesta.** No al cargar la página: así una fila
significa siempre una persona que interactuó y los buscadores no ensucian la medición. Cada
respuesta siguiente actualiza la misma fila, y eso es lo que permite mostrar **en qué pregunta
abandona la gente** — el número que un quiz que sólo registra los terminados esconde justo. Un
`PUT` con menos respuestas de las ya guardadas se ignora, para que un pedido que llega tarde no
borre lo que la persona ya contestó (hay un assert). El guardado del cuestionario **rechaza una
opción que apunte a un resultado inexistente**: si no, el quiz recomendaría el fallback genérico
sin ningún aviso. La semilla **se importa del módulo UI** (`SEED`) en vez de copiarse, porque una
copia se desincroniza y deja la primera carga mostrando un cuestionario y el backend otro.

**`publicaciones` — el overlay muestra el epígrafe, no un número.** El campo de "me gusta" existe
pero arranca vacío y sólo se muestra si el negocio lo carga: un número escrito a mano no es una
métrica, y ponerlo por default es enseñarle al sitio a mentir. La colección **no se siembra**: sin
publicaciones la sección se oculta, que es la única versión honesta de "todavía no publicamos
nada". Y si el perfil queda vacío, el botón principal desaparece en vez de llevar a
`instagram.com/tu_negocio`.

**`comparativa` — dos fuentes, y la segunda es la que importa.** Con `products-admin` activo, la
fuente se puede poner en **catálogo** y la tabla se arma con los productos reales, su precio real y
su disponibilidad real (la misma que valida el checkout: si el comparador dijera "disponible" sobre
algo agotado, la contradicción aparecería recién en la caja). No hay dos lugares que puedan decir
precios distintos.

### Un puente que saca un dato horneado de otro módulo

`eventregister` (inscripción con cupos) tenía **su propia constante `EVENTOS`** en el route
generado. Con `eventos` activo, esa constante se reemplaza por la colección `eventitems`: la agenda
deja de estar horneada en dos lugares y se carga una sola vez. Entran los eventos **visibles,
vigentes y con cupo > 0** — este módulo reparte lugares limitados, y un evento con cupo 0 no tiene
nada que repartir. `evento(id)` pasó a ser asíncrono siempre, venga de la constante o de la
colección: un solo camino de código en vez de dos.

### Cinco puntos de entrada nuevos en los módulos UI

Para inyectar sin duplicar lógica ni romper handlers, siguiendo lo que ya hacían
`WFPrecios.refrescar` y `WFFaq.rebind`: **`window.WFLista`** (textos/setTotal/cerrar/alEnviar),
**`window.WFQuiz`** (setDatos/alResponder/alTerminar) y **`window.WFComparador`** (setProductos).
Detalle que costó una vuelta: los `clientJs` se concatenan en el orden de `moduleIds`, y un
`requires` resuelto **empuja al módulo UI al final** — así que el funcional nunca lee su
`window.WF*` en la línea de arranque, siempre desde un callback asíncrono.

Dos módulos UI dejaron de hornear su placeholder cuando el backend está activo: `waitlist` emite
`data-base="0"` (sembrar el 1.240 haría que la primera pintada mostrara la cifra falsa) y
`productcompare` emite la grilla vacía (medio segundo de precios falsos en pantalla sigue siendo
precios falsos en pantalla). `socialfeed` sumó `id="social-seguir"` como anclaje de inyección.

### Probado

**104 asserts de backend en verde** contra Express 5 real: la idempotencia del alta y el contador
que no se infla, el cooldown por IP, el arranque que suma, la lista cerrada que da 409, invitar dos
veces sin pisar la fecha, el evento vencido que no sale en el público, el `javascript:` rechazado en
el botón de un evento, el puente ofreciendo sólo los eventos con cupo y resolviendo los títulos
desde la agenda, el recorrido atrasado que no borra respuestas, el abandono detectado en la tercera
pregunta, la opción que apunta a un resultado inexistente, el email que entra a `leads` con origen
`recomendador`, el perfil sin protocolo rechazado, y el producto agotado que dice "Sin stock" en la
tabla comparada.

**Catálogo completo: 228 módulos → 350 archivos, 175 JS, 0 errores de sintaxis**, las 9 tablas
nuevas en `schema.sql` y **ningún archivo perdido** (+10 exactos: 5 routes + 5 páginas admin).

**Smoke test en navegador real, 0 errores de consola**: alta desde la sección devolviendo **"Sos el
número 1 de la lista"** con el contador pasando de 0 a 1, quiz respondido de punta a punta cuyo
recorrido quedó guardado **con las tres preguntas y sus opciones** (y el panel mostrando "Plan
Profesional 1" en el ranking y 100% de finalización), evento creado desde el panel apareciendo en
la home con su badge **03 OCT** (no 02), feed social pasando de oculto a visible con la publicación
real y el botón **@minegocio**, y el comparador enfrentando **Producto Clásico $4.999 vs Producto
Premium $9.999** tras cambiar la fuente al catálogo.

## 2026-07-21 (40ª corrida) — LA FICHA DE PRODUCTO, COMPLETA

Lote de **4 módulos funcionales nuevos**. La 39ª le dio a la tienda su centro (imágenes, stock,
ficha, filtros, pedidos) y dejó anotado que **las variantes eran lo único grande que faltaba**.
Esta corrida las cierra, y de paso completa las otras tres cosas que tiene la ficha de producto de
cualquier tienda real y a esta le faltaban: elegir una opción, preguntar antes de comprar, y ver
qué más se llevó la gente que compró eso.

| Módulo | Colecciones | Qué agrega |
|---|---|---|
| `variantes` | `variantsets` | Talle, color, sabor o medida: hasta 3 ejes por producto, matriz de combinaciones generada desde el panel, y **stock, SKU y sobreprecio por combinación**. Selector en la ficha, línea propia en el carrito, validación y descuento en el checkout, reposición al cancelar |
| `consultas` | `productqa` | **Preguntas y respuestas** al pie de la ficha. El visitante pregunta sin registrarse; nada se publica hasta que el negocio contesta |
| `relacionados` | `crossell` | **"Quien compró esto también compró"**, calculado sobre los pedidos reales, con curación manual que gana siempre y bloque "completá tu compra" en el carrito |
| `etiquetas` | `producttags` | Listas transversales (Regalos, Recién llegados) con **página de colección propia** en `/etiqueta/<slug>`, armada por el servidor |

### `variantes` — las tres decisiones que lo sostienen

**1. El stock de la variante manda; `products.stock` es su espejo.** Cada movimiento de una
variante reescribe el stock del producto con la **suma** de sus variantes activas. No es
redundancia: gracias a eso la disponibilidad de la ficha, el "solo con stock" de la tienda, el chip
de "quedan 3" del catálogo, la validación del checkout, la reposición al cancelar y los avisos de
"avisame cuando vuelva" **siguen funcionando sin enterarse de que existen las variantes**, porque
el número que leen sigue siendo cierto. El control fino se agregó ARRIBA de esas reglas, no en
lugar de ellas — que es lo que permitió tocar 5 módulos existentes con parches de pocas líneas en
vez de reescribirlos.

**2. El id de la variante es determinista** (`talle-m`, `talle-m__color-azul`), derivado de sus
opciones. Con ids sorteados, regenerar la matriz —algo que pasa cada vez que se agrega un talle—
cambiaría todos los ids y dejaría huérfanos los carritos y los pedidos que ya los referencian. Con
la clave derivada, **agregar XL conserva S, M y L con su stock y su SKU**; hay un assert dedicado.

**3. El precio de la variante es una DIFERENCIA** (`priceDelta`), no un precio absoluto. Un
aumento general se aplica una sola vez en el producto, y el precio tachado sigue teniendo sentido.
El precio final lo calcula **siempre el servidor**.

**Y una cuarta, que salió de una prueba**: cambiar los ejes (agregar "Color" a un producto que
tenía "Talle") no puede conservar el stock —"Talle M" y "Talle M / Color Azul" no son la misma
cosa, y no hay forma de saber cuántas de las 9 unidades de M eran azules—. En vez de repartir a
ojo o borrar en silencio, el `PUT` **corta con 409**, enumera las combinaciones con stock que
quedarían sin lugar, y recién entra con `confirmar: true`. El panel muestra esos números en un
`confirm()`.

**Cambios en 5 módulos existentes**, todos condicionados a que `variantes` esté activo:

| Archivo | Cambio |
|---|---|
| `cart.js` | `WFCart.agregar(id, qty, variantId)` — dos talles del mismo producto son **dos líneas**, no una con cantidad 2. `renderCart` muestra la combinación y su sobreprecio. `routes/orders.js` resuelve la variante en el servidor (existe, es de ese producto, está activa, alcanza el stock), arma `unitPrice = precio + delta` y descuenta **por variante** (la foto `productsById` es vieja: con dos líneas del mismo producto la segunda resta pisaba a la primera). `/cotizar` suma los deltas |
| `ficha.js` | Antes de agregar al carrito le pregunta a `window.WFVariantes` si el producto exige combinación; sin ninguna elegida, no agrega |
| `pedidos.js` | Cancelar repone las unidades **a la variante**, no al producto: reponer al producto dejaría el total bien y el detalle mal |
| `descuentos.js` | `src/descuentos.js` suma el sobreprecio al armar las líneas. Sin esto, el descuento del cartel se calcularía sobre un subtotal distinto al que cobra el checkout |
| `enviogratis.js` | Idem para el umbral de envío gratis |

`src/variantes.js` es el motor compartido: lo usan las rutas del módulo, el checkout y la
cancelación. Un solo lugar donde vive la regla de qué se puede vender y cuánto sale.

### `consultas` — moderación por construcción

Nada llega a la ficha sin que alguien conteste: una pregunta entra `publicada: false` y sólo se
publica al responderla. **El email de quien pregunta no viaja a la vista pública** — no se oculta
con CSS ni se filtra en el navegador, directamente no sale del servidor (`publica()` no lo
incluye). Las consultas **con enlaces se rechazan** (el 90% del spam de un formulario abierto es
un enlace, y una pregunta genuina sobre un producto casi nunca necesita uno), con cooldown de 20
segundos por IP como defensa secundaria — en serverless cada instancia tiene el suyo, así que la
defensa real sigue siendo la moderación. Con `mailer` activo, responder manda **la respuesta
adentro del mail**, que es la parte que devuelve a la persona a la ficha.

### `relacionados` — recomendaciones con evidencia

La ficha ya mostraba cuatro productos, pero los elegía **por categoría**: la única regla que
garantiza mostrar lo más parecido a lo que la persona ya está mirando. Ahora el servidor recorre
`orders` (salteando los cancelados), cuenta cuántas veces dos productos cayeron en la misma compra
y ordena por frecuencia. **Piso de evidencia: 2 pedidos** — una sola compra conjunta es una
coincidencia, no un patrón; por debajo se cae al criterio de categoría, que es flojo pero honesto.
La curación manual va primero. El grafo se recalcula como mucho una vez por minuto. Nunca se
recomienda un producto pausado ni sin stock: mandar a alguien a una ficha con el botón apagado es
peor que no recomendar nada.

### `etiquetas` — el tercer eje

Categoría y marca son atributos **únicos**; lo que un negocio necesita anunciar casi nunca lo es
("Regalos para el Día de la Madre", "Menos de $20.000", "Recién llegados"). La etiqueta **guarda a
qué productos apunta**, no al revés: armar una campaña es editar una fila y desarmarla es
borrarla, sin tocar ningún producto. Cada una se sirve en `/etiqueta/<slug>` con el HTML armado
por el servidor (mismo patrón que `ficha` y `paginas`), con `vercelRewrites` declarado. Una
etiqueta **oculta se comporta como inexistente** (404), no como una página con cartel: servirla la
dejaría indexada antes de que la campaña exista. Los agotados van al final y marcados.

### Dos bugs encontrados por la prueba en navegador

**1. El carrito mostraba "(opción)" y el precio sin el sobreprecio.** El índice de variantes llega
en una consulta aparte que se resuelve **después** de que el carrito ya se pintó, y no había nada
que lo volviera a pintar. Se agregó `window.WFCart.refrescar()` (mismo patrón que
`WFPrecios.refrescar`, `WFFaq.rebind`, `WFNav.aplicar`) y `variantes` lo llama al cargar el
índice. Al arreglarlo apareció el segundo tramo del mismo bug: el **importe de la línea** seguía
usando `p.price * qty` mientras el total ya sumaba el delta, así que las líneas no cerraban con el
total. Es exactamente la clase de error que la 38ª documentó: un número que no coincide con lo que
se cobra es peor que ningún número.

**2. Los cuatro paneles de administración no se mostraban nunca.** El gate de admin decodificaba
el JWT con `atob(token.split('.')[1])`, y el payload viene en **base64url** (con `-` y `_`), que
`atob()` rechaza con `InvalidCharacterError`. El `try/catch` se tragaba la excepción y `esAdmin`
quedaba en `false` para siempre. Reemplazado por `localStorage.getItem('user')`, que es lo que
guarda el login y lo que usa el resto de los paneles del catálogo. **No lo habría encontrado
ninguna prueba de backend**: los endpoints estaban perfectos.

### Verificación

- Registro: **223 módulos (100 UI · 123 funcionales)**.
- 6 variantes generadas; catálogo completo = **388 archivos / 169 JS**, **0 errores de sintaxis**.
- `vercel.json` con el rewrite nuevo `/etiqueta/:slug*`; `schema.sql` con las **4 tablas nuevas**.
- **145 asserts de backend en verde** contra Express 5 real: 56 de variantes (semilla que reparte
  el stock en vez de inventarlo, id determinista, agregar un talle conservando los 3 anteriores,
  el 409 que enumera el stock que se perdería, espejo del stock, compra de **dos talles del mismo
  producto** con el sobreprecio aplicado, reposición al cancelar, idempotencia, y el producto sin
  variantes que se sigue comprando igual), 40 del par consultas+relacionados (el enlace rechazado,
  el email que no viaja, el piso de evidencia, el pausado y el agotado que desaparecen) y 35 de
  etiquetas (el `<h1>` **en el HTML**, la oculta que da 404, el nombre con `<script>` escapado,
  borrar la etiqueta sin tocar los productos), más 14 con el catálogo completo (los 4 módulos
  conviviendo con los 219 anteriores, los middlewares sin pisarse, el sitemap intacto y las áreas
  nuevas entrando **solas** al mapa de `roles`).
- **Smoke test en navegador real, 0 errores de consola**: selector de talle que mueve precio
  ($4.999 → **$5.799** en el talle L), stock y tope de cantidad; dos talles agregados como dos
  líneas; **checkout confirmando $21.596 — el importe exacto que la caja había prometido**; stock
  bajando M 9→7, L 8→6 y el producto 25→21; consulta enviada desde la ficha con acentos y eñes
  intactos, respondida desde el panel y publicada; página de colección servida con su `<title>` y
  su `<h1>` en el HTML; y los cuatro paneles cargando.

---

## 2026-07-21 (39ª corrida) — E-COMMERCE COMPLETO

> **Pedido del usuario**: "¿el builder tiene todo para que ande un e-commerce? productos con
> descripción, subir imágenes, compras reales, actualización de stock, gestión de envíos, filtros y
> búsqueda, listado de productos… si no lo tiene, agregalo."
>
> La auditoría dio que **no**. El catálogo tenía las piezas de alrededor (carrito, cupones,
> descuentos, envío gratis, carritos abandonados, cotizador de envío, reseñas, POS) y le faltaba el
> centro: los productos eran fichas de texto sin foto, sin stock y sin dirección propia.

### Lo que faltaba, y qué lo resuelve

| Agujero | Cómo estaba | Qué lo cierra |
|---|---|---|
| **Imágenes** | No existía el campo. El catálogo eran tarjetas de texto | `products-admin`: galería ordenada, con **subida real** vía Biblioteca de archivos |
| **Stock** | No existía. El checkout **vendía infinito** | `products-admin` + `cart`: stock por producto, validado y descontado en el checkout |
| **Página de producto** | No había. Sin URL no hay link para compartir ni SEO por producto | `ficha` (nuevo): `/producto/<slug>` armado por el servidor, con JSON-LD |
| **Filtros y búsqueda** | El catálogo filtrable era **HTML horneado**; `/catalog.html`, una grilla pelada | `tienda` (nuevo): búsqueda, filtros, orden y paginación **en el servidor** |
| **Envío en el checkout** | La orden **no pedía dirección** ni sumaba el costo | `cart`: datos de entrega validados + costo calculado con las zonas de `shipping` |
| **Gestión de pedidos** | `ordertrack` pisaba `orders` con otro esquema; no había panel de las ventas reales | `pedidos` (nuevo): panel con detalle, entrega, estados y cancelación |

### Módulos nuevos

| Módulo | Colecciones | Qué agrega |
|---|---|---|
| `ficha` | — | Página de producto en `/producto/<slug>`, server-rendered, con JSON-LD `Product` |
| `tienda` | — | `/tienda.html`: buscador, filtros, orden y paginación resueltos en el servidor |
| `pedidos` | — | Panel de los pedidos del checkout; cancelar repone stock |

**`products-admin` reescrito**: el modelo pasó de 5 campos a 15 — `slug` (único, con sufijo `-2` si
se repite), `brand`, `compareAt` (precio tachado, **rechazado si no es mayor que el actual**:
si no, no es una oferta), `details` (largo), `images[]`, `stock`, `trackStock`, `allowBackorder`,
`weight` y `featured`. Cada cambio de stock queda en la colección **`stockmoves`** con motivo y
usuario: sin ese rastro un faltante no se puede explicar nunca. Y `GET /api/products` **sigue
devolviendo el mismo arreglo de siempre** — lo consumen seis módulos (carrito, POS, agente IA,
avisos de stock, lista de precios, simulador de descuentos) y cambiarle la forma para meter la
paginación los habría roto en silencio; la respuesta paginada vive en `/api/products/buscar`.

**`ficha` — la decisión que lo define**: mismo patrón que las páginas administrables de la 38ª —
el middleware toma la cáscara `public/producto.html` y le reemplaza el bloque marcado, el `<title>`
y la meta description. Emite **JSON-LD `Product`** con la **disponibilidad real**
(`InStock`/`OutOfStock`) calculada con la misma regla que el checkout: anunciar stock que no existe
es peor que no anunciarlo, y Google penaliza el dato estructurado que no coincide con la página.

**`tienda` — la decisión que lo define**: todo se resuelve en el servidor. Filtrar en el navegador
obliga a bajar el catálogo entero: con 40 productos no se nota y con 4.000 el sitio no abre en un
teléfono. Además **los filtros viven en la URL** (se puede compartir el resultado, volver con
"atrás" y anunciar `/tienda.html?cat=Ofertas`), **las facetas se calculan sobre todo el catálogo**
y no sobre lo ya filtrado (si no, elegir una categoría haría desaparecer las demás del desplegable)
y el buscador **descarta las respuestas que llegan fuera de orden**: sin eso, escribir rápido deja
en pantalla el resultado de "rem" cuando ya escribiste "remera".

**`cart` — el checkout de verdad**: valida el stock **antes de cobrar** y devuelve 409 diciendo
**qué producto falta y cuánto hay** (un "no hay stock" a secas obliga al cliente a adivinar cuál de
los cinco items es); descuenta el stock **después** de guardar el pedido, para que un error al
escribir no deje unidades restadas sin venta que las explique; exige **datos de entrega** (envío a
domicilio con dirección, localidad, provincia y CP, o retiro en el local) y calcula el **costo de
envío en el servidor** con las zonas de `shipping`, con envío gratis evaluado sobre el importe ya
rebajado. El pedido nace con **código `OT-XXXXXX` y los estados de Seguimiento de pedidos**, así el
cliente sigue su compra en `/seguimiento.html` sin que nadie copie nada. Nuevo punto de entrada
`window.WFCart` para que la ficha y la tienda agreguen al carrito sin duplicar su formato.

**`pedidos` — la decisión que lo define**: **cancelar repone el stock**, de forma **idempotente**
(un segundo intento devuelve 409 y no vuelve a sumar unidades) y registrado en el historial del
producto — un pedido cancelado cuyas unidades no vuelven es mercadería que está en el depósito y
que el sistema cree vendida. Y **el pedido no se edita**: cambia el estado, la nota y el número de
seguimiento, nunca los items ni los importes. Un panel que deja reescribir el importe de una venta
ya cobrada es un agujero contable. Los KPIs se calculan **al leer** sobre los no cancelados: no hay
contador guardado que se desincronice.

### Dos bugs encontrados por las pruebas y corregidos

1. **Buscar sin tildes no encontraba nada.** `q=algodon` no traía "Algodón" — y nadie tipea tildes
   en un buscador. Se pliegan los acentos (NFD + quitar diacríticos) **en los dos lados** de la
   comparación, no sólo en la consulta.
2. **Las imágenes de la primera fila salían con `loading="lazy"` estando sobre el pliegue.** Lo
   detectó la prueba en navegador: la foto no cargaba. Diferir una imagen que ya está a la vista
   retrasa el **LCP**, que es una de las tres métricas con las que Google posiciona. Las primeras
   tarjetas cargan ahora sin diferir y la primera con `fetchpriority="high"`; el resto sigue lazy.

### Verificación

- Registro: **100 UI · 119 funcionales = 219 módulos**.
- **227 JS con `node --check`: 0 errores.** Catálogo completo: 326 archivos.
- **92 asserts del circuito de compra** en verde contra Express 5 real: imagen con `javascript:`
  rechazada, precio anterior menor rechazado, slug único con sufijo, historial de stock con motivo,
  stock que no queda negativo, búsqueda sin tildes, "todas las palabras", facetas que no se
  recalculan, paginación y página fuera de rango, ficha con `<h1>` y `<title>` en el HTML servido,
  JSON-LD `InStock` → `OutOfStock` al agotarse, ficha de un producto dado de baja que devuelve 404,
  checkout sin entrega rechazado, provincia inválida rechazada, **sobrepedido con 409 diciendo qué
  falta**, costo de envío por zona y envío gratis por umbral, stock descontado con el número de
  pedido, seguimiento público que encuentra la compra, panel que **no** puede reescribir importes,
  CSV con la dirección, y **cancelar que repone el stock una sola vez**.
- **114 asserts de la 38ª** y **28 del catálogo completo**: en verde (la suite vieja se actualizó
  porque el checkout ahora exige datos de entrega — el cambio buscado).
- **Smoke test en navegador, 0 errores de consola**: imagen **subida de verdad** por el endpoint
  binario y renderizada en la ficha y en la grilla; búsqueda "edicion" sin tilde encontrando
  "Edición Limitada" con el estado en la URL; orden por precio; compra desde la ficha con selector
  de cantidad; costo de envío mostrado **antes** de confirmar ("Envío a CABA y GBA: $2.500 — llega
  en 2 días hábiles. Gratis desde $40.000."); **checkout confirmando `OT-D16A73` por $22.498**
  ($19.998 + $2.500 de envío); stock bajando de 12 a 10; el panel de pedidos mostrando el detalle
  completo con la dirección; y el producto agotado con su cartel "Sin stock" y el botón inhabilitado.

## 2026-07-21 (38ª corrida)

> **Lote de 4 módulos funcionales nuevos + adopción de los 2 huérfanos que dejó una sesión cortada
> + el contrato colgado de `cookies` cerrado.**
> El hilo: hasta acá **toda página del sitio se horneaba al generar**. El negocio podía cambiar el
> contenido de las secciones que ya existían (eso lo resolvieron la 36ª y la 37ª), pero no podía
> **crear una página nueva** ni **tocar el menú**: "agregame Política de envíos", "sacá Reseñas del
> menú", "que Catálogo diga Tienda" obligaban a volver al Builder, regenerar y deployar de nuevo.
> Y del lado comercial faltaban las dos cosas que cualquier tienda pide primero: **descuentos que se
> apliquen solos** y **saber quién dejó el carrito**.

### Módulos nuevos

| Módulo | Colecciones | Qué agrega |
|---|---|---|
| `paginas` | `sitepages` | **Páginas administrables** servidas en `/p/<slug>`, con el HTML armado **por el servidor** |
| `navegacion` | `navlinks` | **Menú administrable**: orden, nombres, ocultar y links propios, sembrado con el menú real del proyecto |
| `descuentos` | `discountrules` | **Descuentos automáticos** calculados en el servidor; el checkout usa el mismo motor |
| `abandonos` | `abandonedcarts` | **Carritos abandonados** con estado calculado y enlace de recuperación |

**`paginas` — la decisión que lo define**: el HTML lo arma el **middleware** (contrato
`middlewares`, corre antes de `express.static`) tomando la cáscara ya generada de
`public/paginas.html` —con la navbar, el CSS y el pie reales del sitio— y reemplazando el bloque
marcado entre los comentarios `WF-PAGINA`, más el `<title>` (conservando el sufijo de marca) y la
`meta description`. Nada de plantillas en runtime y **cero parpadeo**: una página pintada por
JavaScript después de cargar no la ve Google, ni el previsualizador de WhatsApp, ni el de LinkedIn
— y una página que el negocio publica para que la encuentren tiene que ser encontrable. El
contenido **no es un campo HTML libre** sino una lista de **bloques tipados** (título, párrafo,
lista, imagen, botón, cita, separador): se escapa todo lo que entra —un panel que acepta HTML crudo
es un XSS almacenado esperando— y el formato liviano (negrita y enlaces) se resuelve **después** de
escapar, así el marcado sale del formato y nunca del dato. El renderer (`src/paginas-render.js`) es
**uno solo**: lo usan el middleware y la vista previa del panel, así que si la previa se ve bien, la
página se ve bien. Las publicadas se suman al `sitemap.xml` que hornea el módulo SEO. La página
sembrada nace **en borrador**.

**`navegacion` — la decisión que lo define**: el cliente **NO reconstruye** el HTML del menú,
**mueve** los enlaces que ya existen. Reescribir el `innerHTML` de `.nav-links` parece más simple y
rompe tres cosas en silencio: el contador del carrito (que `cart` enganchó a un nodo concreto), el
`display:none` con que ~15 módulos esconden su link de administración a quien no es admin, y la
clase `active` de la página en curso. Moviendo los nodos originales con `appendChild` todo eso
sobrevive. Lo oculto usa el atributo `hidden`, **nunca** `style.display`, justamente para no pisar
ese ocultamiento por rol. El menú se siembra **al generar** con los links reales del proyecto (el
generador se los pasa en `ctx.nav`). Expone `window.WFNav.aplicar()` y `paginas` lo llama al
insertar las suyas.

**`descuentos` — la decisión que lo define**: los porcentajes se aplican **siempre sobre el subtotal
original**, nunca en cascada (dos reglas del 10% descuentan 20%, no 19% — el mismo criterio que los
ajustes de `presupuestador`), una regla marcada **exclusiva** corta las siguientes, la vigencia la
evalúa el **reloj del servidor** (una promo que termina según el reloj del visitante se estira
cambiando la hora de la máquina) y hay **tope en pesos**. Y lo más importante: **el descuento que se
muestra es el que se cobra**. `src/descuentos.js` es un motor único que usan la caja del carrito, el
simulador del panel y `routes/orders.js` del módulo Carrito, que se modificó para llamarlo antes de
guardar la orden. Con cupones activos, el cupón se aplica **después**, sobre el importe ya rebajado
(al revés, dos promociones del 50% regalarían el pedido).

**`abandonos` — la decisión que lo define**: "abandonado" **no es un estado guardado**, lo calcula el
servidor con su reloj contra la última actividad; y un carrito pasa a "recuperado" si existe una
orden posterior del mismo visitante, resuelto **al leer** contra `orders` y no con un aviso del
navegador (ese aviso no llega si la pestaña se cierra justo después de comprar). Cada carrito tiene
un **enlace de recuperación** (`/catalog.html?recuperar=CODIGO`) que le devuelve el carrito armado a
quien lo abre — sin eso, "te acordás que dejaste algo" obliga al cliente a buscar todo de nuevo, que
es lo que lo hizo abandonar. Seguimiento **anónimo** (identificador aleatorio del navegador, sin IP
ni user-agent) y **respeta el rechazo del banner de cookies**. Si el visitante tenía sesión, el email
sale **del token firmado**, nunca del cuerpo del pedido.

### Módulos huérfanos adoptados

La 37ª encontró en disco dos módulos que había escrito una sesión cortada, sin probar ni documentar,
y los dejó intactos a propósito. Esta corrida los revisó, les armó la suite que les faltaba y los
sumó al conteo — el mismo procedimiento que la 35ª con los cinco de aquella vez.

| Módulo | Colecciones | Qué agrega |
|---|---|---|
| `webhooks` | `webhooks`, `webhookdeliveries` | integraciones salientes: cada escritura exitosa contra `/api` dispara un POST JSON **firmado con HMAC-SHA256**, con reintentos, registro de entregas y **bloqueo de destinos internos** (un panel que acepta cualquier URL es un SSRF esperando) |
| `enviogratis` | `freeshipping` | barra "te faltan $X para el envío gratis" con el **subtotal recalculado en el servidor** contra el catálogo: el cartel no se puede falsear desde el frontend |

Los dos estaban bien escritos y siguen el patrón de la casa. Lo único que hubo que corregirles es el
bug de coalescencia que se describe abajo (que `descuentos` compartía).

### El contrato colgado de `cookies`

La misma sesión cortada modificó `modules/ui/cookies.js` para que el banner **(1)** avisara su
elección con el evento `wf:consent` y **(2)** consultara `window.WFConsentVersion` para volver a
preguntar cuando cambia la política. Ningún módulo publicaba esa promesa ni escuchaba ese evento: el
banner degradaba bien (no rompía nada) pero **la función no existía**. `privacidad` la implementa:

- colección `privacyconfig` con la **versión vigente** de la política y `GET /api/privacidad/politica`
  público; el clientJs publica `window.WFConsentVersion`.
- `POST /api/privacidad/admin/politica` publica una versión nueva: a todo el que había aceptado la
  anterior **le vuelve a aparecer el cartel**. Los consentimientos ya registrados no se tocan — son
  la prueba de qué aceptó cada uno y **sobre qué política**.
- la versión que se guarda con cada consentimiento **la pone el servidor**, ya no el navegador: si el
  visitante pudiera declarar contra qué política aceptó, la prueba no valdría nada.
- el módulo escucha `wf:consent` **y** sigue capturando el clic en `[data-consent]` (para un cartel
  que no sea el del módulo `cookies`), con una **guarda de 2 segundos** que evita que la misma
  elección se registre dos veces e infle el contador de "cambios de opinión".

### Cambios en el generador

- **`ctx.nav`**: `files(cfg, ctx)` recibe ahora también el menú ya armado (`[{label, href}]`), no sólo
  la lista de páginas. Lo usa `navegacion` para sembrar su panel con el menú real del proyecto.
- **Contrato `vercelRewrites`**: un módulo puede declarar rutas propias fuera de `/api` que responde
  un middleware. `vercel.json` dejó de ser una constante y se arma con `T.vercelJson(extras)`. Sin
  esto, `/p/<slug>` daría **404 en producción** aunque funcione local: en Vercel, todo lo que no
  matchea un rewrite lo sirve la CDN de estáticos y nunca llega a Express. Es un agujero que
  afectaba en potencia a cualquier módulo futuro con rutas propias.
- **`src/icons.js`**: +1 ícono Phosphor (`shopping-cart`), 52 → **53**.

### Un bug encontrado por la prueba en navegador y corregido en DOS módulos

La caja de descuentos mostraba **el subtotal de una sola unidad** después de agregar seis al carrito,
y la barra de envío gratis lo mismo. Causa: los dos módulos escuchan `wf:cart`, y el guard
`if (pidiendo) return;` **descartaba** los eventos que llegaban mientras había una consulta en vuelo.
Seis clics rápidos = seis eventos: se atendía el primero y se tiraban los otros cinco, así que el
cartel quedaba anunciando un carrito de hace tres clics. Parece una optimización y es un error de
fondo: en un módulo cuyo trabajo es que el número sea cierto, **un número viejo es peor que ninguno**.
Se reemplazó por coalescencia (se guarda siempre el último estado y se atiende al terminar la
consulta en curso), en `descuentos` y en `enviogratis`.

### Verificación

- Registro: **100 UI · 116 funcionales = 216 módulos**.
- 4 variantes generadas: lote (58 archivos), sin `auth` (23, degrada bien), **Vercel** (61, con el
  rewrite de `/p/:slug*` en `vercel.json`) y **catálogo completo** (321 archivos / 161 JS).
- **238 JS con `node --check`: 0 errores de sintaxis.** 0 glifos pictográficos en el HTML servido.
- **114 asserts de backend en verde** contra Express 5 real, entre ellos: el `<script>` del editor
  que sale escapado, el `javascript:` rechazado en botón y en enlace, el borrador que no se sirve ni
  entra al sitemap, despublicar que saca la página **sin esperar el TTL del caché**, el slug
  reservado y el repetido, las dos reglas del 10% que dan **19.998 y no 18.998**, la regla exclusiva
  que corta, la vigencia vencida que no aplica, el tope, la orden que guarda **el mismo descuento que
  mostró el carrito**, el cupón calculado sobre el importe ya rebajado, el precio falso del navegador
  ignorado (tres módulos), el email que sale del token y no del cuerpo, el carrito vaciado que borra
  su fila, el `localhost` y el `192.168.x` rechazados como webhook, y el `v99` que el navegador quiso
  declarar como versión de política.
- **28 asserts sobre el catálogo completo**: los **9 middlewares** conviviendo, las rutas nuevas en
  200 con todos en el medio, `/p/<slug>` servida armada, el sitemap juntando lo horneado con lo
  administrable, y las 4 áreas nuevas entrando **solas** al mapa de `roles` y al middleware de
  permisos.
- **Smoke test en navegador real, 0 errores de consola**: página creada por el editor de bloques
  (con el texto conservado al repintar), previa renderizada por el servidor, `/p/como-comprar`
  servida con `<h1>` y `<title>` en el HTML y sumada al menú; menú reordenado y renombrado
  (Catálogo → **Tienda**) **conservando el badge del carrito**, "Nosotros" oculto, Instagram agregado
  con `rel="noopener noreferrer"`, y **cero filtración de links de administración** al cerrar sesión;
  carrito de 6 unidades con descuento y envío gratis correctos tras el fix de coalescencia, enlace de
  recuperación que devuelve el carrito y limpia la URL, y el **checkout confirmando $53.995 — el
  importe exacto que la caja había prometido**; y el banner de cookies **reapareciendo** al publicar
  la política v2 en un navegador que ya había aceptado la v1, con `cambios: 1` (no 2: la guarda
  anti-duplicado funciona).

## 2026-07-21 (37ª corrida)

> **Lote de 5 módulos funcionales: se terminan de administrar las secciones horneadas y aparece
> la capa que faltaba, la de MEDIR.**
> La 36ª le puso backend a cinco secciones (precios, FAQ, horarios, cotizaciones, equipo). Quedaban
> afuera las que cuentan **qué hace el negocio y por qué confiar en él**: los servicios, los
> clientes, la prensa, la historia, el proceso, las garantías y las características. Todas venían
> con placeholders, y no todos inofensivos:
>
> - `logos` y `press` publicaban **clientes y medios inventados** ("Nova Group", "El Diario",
>   "Radio Ciudad"). No se ven rotos, así que salen a producción tal cual: el sitio termina
>   exhibiendo clientes que no existen.
> - `trust` prometía **"Envío gratis en compras superiores a $50.000"** y **"Hasta 30 días para
>   cambiar de idea"**. Son condiciones comerciales que un cliente puede reclamar, con cifras que
>   el negocio no podía corregir sin regenerar y volver a deployar.
> - `timeline` dejaba la historia congelada en "2021: nueva etapa" para siempre.
>
> Y el hueco conceptual: el catálogo sabía **construir** el sitio y **administrarlo**, pero no
> sabía **medirlo**. "¿Conviene 'Empezar ahora' o 'Pedí tu presupuesto'?" se contestaba por
> opinión. `experimentos` cierra eso con pruebas A/B de backend real.
>
> | Módulo | Colecciones | Qué agrega |
> |---|---|---|
> | `servicios` | `services` | backend de la sección de servicios (`services`) **y** de la página de detalle (`servicespage`) |
> | `experimentos` | `experiments`, `expvisitors` | **pruebas A/B** con reparto estable por hash, impresiones/conversiones y prueba z al 95% |
> | `marca` | `brandlogos` | backend de clientes (`logos`), medios y sellos (`press`) |
> | `historia` | `milestones`, `worksteps` | backend de la línea de tiempo (`timeline`) y de "Cómo trabajamos" (`process`) |
> | `razones` | `guarantees`, `highlights` | backend de la barra de garantías (`trust`) y de "Por qué elegirnos" (`features`) |
>
> Verificación: registro en **210 módulos (100 UI · 110 funcionales)**, **102 asserts de backend en
> verde** contra Express 5 real, **0 errores de sintaxis** en los **200 JS** de las 4 variantes
> generadas, **0 glifos pictográficos** en el HTML, **20 asserts** más sobre el proyecto con el
> catálogo completo (304 archivos) verificando que los ganchos de DOM que los módulos nuevos
> necesitan siguen en el HTML horneado, variante Vercel+Supabase con las **8 tablas nuevas** en
> `schema.sql`, variante **sin `auth`** degradando bien (API pública en 200, paneles en 404) y
> **smoke test en navegador real**: las 7 secciones inyectadas, el ciclo A/B completo de punta a
> punta (asignación → cambio de texto → clic real que navega → conversión por `sendBeacon`), los
> 5 paneles cargando y **0 errores de consola**. **Un bug encontrado por los tests y corregido**
> (ver abajo). Sin módulos revertidos.

### Los 5 módulos

#### `servicios` — Servicios administrables
[modules/functional/servicios.js](modules/functional/servicios.js) · `requires: ['services']` ·
colección `services` · `usesAnime`

- **Alimenta dos vistas con una sola lista**: la grilla de tarjetas de la home y la página de
  detalle (`/services.html`), incluidas **las anclas `#servicio-N`** que unen una con otra. Si se
  reordenan los servicios, las anclas se recalculan solas y el link "Ver detalle" sigue apuntando
  a donde corresponde.
- **El ícono se guarda como NOMBRE Phosphor de una lista blanca de 16, nunca como marcado**: el
  panel muestra una grilla de íconos, el servidor rechaza cualquier nombre fuera de la lista y el
  SVG lo hornea el cliente desde su propia tabla. Es la diferencia entre "elegí un ícono" y
  "pegá HTML en mi sitio".
- **Puntos clave** como lista (se limpian vacíos y se corta en 6, que es lo que muestra la ficha).
- La siembra **no se duplica a mano**: `servicios.js` importa `SERVICIOS` de
  [modules/ui/services.js](modules/ui/services.js) y `DETALLES` de
  [modules/ui/servicespage.js](modules/ui/servicespage.js), así los datos sembrados no pueden
  divergir del HTML horneado.
- Tras repintar el detalle **se vuelve a resolver el `#hash`**: el navegador ya había saltado al
  ancla con el DOM viejo, y sin esto entrar por `/services.html#servicio-3` dejaba al visitante
  arriba de todo.

#### `experimentos` — Pruebas A/B de textos
[modules/functional/experimentos.js](modules/functional/experimentos.js) · colecciones
`experiments` y `expvisitors` · `usesAnime`

Tres decisiones lo separan de un contador de clics:

1. **El reparto es del servidor y es estable**: hash FNV-1a de `visitorId + expId`, no
   `Math.random()` en el navegador. El mismo visitante ve **siempre** la misma variante aunque
   recargue, cambie de página o vuelva mañana. Sin eso la métrica mide ruido. FNV-1a es
   determinista entre procesos, que importa en serverless (cada request puede caer en otra
   instancia).
2. **La impresión sólo se cuenta si el elemento medido existe en la página que se está viendo**:
   el cliente informa qué destinos renderizó (`POST /asignar {v, destinos}`) y el servidor ignora
   el resto. Contar impresiones de gente que nunca vio el titular arruina la tasa.
3. **Una fila por visitante y por prueba** (`expvisitors`): la deduplicación de impresión y
   conversión es **del servidor**, no una bandera del navegador. Recargar diez veces no infla
   nada y la conversión es idempotente (`{ok:true, nuevo:false}` la segunda vez).

- **Destinos y objetivos son listas blancas**, no selectores CSS libres: 7 destinos (titular del
  hero, bajada, botón, título de la banda final, botón de la banda, título de precios, título de
  servicios) y 5 objetivos (clic en el elemento medido, clic en el botón del hero o de la banda,
  envío del formulario de contacto, clic en WhatsApp).
- **Veredicto estadístico en el servidor**: prueba z de dos proporciones entre la mejor variante y
  la segunda, con la CDF normal por aproximación de Abramowitz-Stegun. Declara ganador sólo con
  **≥95% de confianza y ≥30 visitantes por variante**; si no, explica qué falta ("La diferencia
  todavía puede ser azar (73,4% de confianza; hace falta 95%). Dejala correr."). Cero dependencias.
- **La conversión viaja por `navigator.sendBeacon`** (con `fetch keepalive` de plan B): el clic en
  el botón medido navega a otra página y un `fetch` normal se cancela a mitad de camino. Verificado
  en navegador real: clic que navega → conversión registrada.
- **Cambiar la estructura reinicia; corregir un texto no.** Cambiar la cantidad de variantes, el
  destino o el objetivo borra lo medido en el mismo movimiento (ya no compara lo mismo) y lo avisa
  con `reiniciada: true`. Arreglar una falta de ortografía conserva los datos.
- **La prueba sembrada nace apagada**: una prueba encendida sola repartiría visitantes desde el
  minuto cero sin que el negocio lo decida.
- El id de visitante es una **cadena opaca en `localStorage`** (`crypto.randomUUID()` con plan B),
  sin datos personales ni cookies de terceros. Se valida contra `/^[A-Za-z0-9_-]{8,64}$/`.

#### `marca` — Clientes, prensa y sellos administrables
[modules/functional/marca.js](modules/functional/marca.js) · `requires: ['logos']` · colección
`brandlogos` · `usesAnime`

- Tres grupos en una colección (`cliente`, `medio`, `sello`) con **orden independiente por grupo**:
  sumar un cliente no reordena los medios.
- Cada entrada puede ser el **wordmark tipográfico** (como el HTML original) o el **logo real por
  URL**; los estilos de grisado de `logos` y `press` ya contemplan `<img>`, así que se conserva el
  marcado exacto (`.logo-marca`, `.press-media`, `.press-cert`) y con él el hover que devuelve el
  color.
- La URL se valida contra `javascript:` y `data:` (sólo rutas del sitio o `http(s)`).
- Los sellos llevan **ícono Phosphor de lista blanca**, reemplazando los SVG inline de `press`.

#### `historia` — Historia y proceso administrables
[modules/functional/historia.js](modules/functional/historia.js) · `requires: ['timeline']` ·
colecciones `milestones` y `worksteps` · `usesAnime`

- **Dos entidades, un módulo**: hitos y pasos contestan el mismo bloque narrativo y separarlos
  obligaría a entrar a dos pantallas para contar una sola historia (mismo criterio que `horarios`
  con horarios + feriados). El CRUD del servidor va **parametrizado por `:tipo`**, así la segunda
  lista no duplicó una línea de lógica, y el panel usa una fábrica común.
- **El año es texto a propósito**: el HTML original cierra con "Hoy", y un `number` lo prohibiría.
- **Los pasos se numeran por posición, no por dato guardado**: borrar el paso 2 hace que el 3 pase
  a ser 2. Guardar el número habría dejado huecos.
- Nuevo gancho `id="historia-linea"` en [modules/ui/timeline.js](modules/ui/timeline.js) (el
  contenedor sólo tenía estilos inline y no había forma estable de encontrarlo).

#### `razones` — Garantías y características administrables
[modules/functional/razones.js](modules/functional/razones.js) · `requires: ['trust']` ·
colecciones `guarantees` y `highlights` · `usesAnime`

- Mismo patrón de dos entidades con CRUD parametrizado por `:tipo`.
- **Las filas de características se reinsertan como hermanas directas del contenedor**, no dentro
  de un envoltorio: el zigzag de `features` es `:nth-child(even)` contando desde el `<h2>` de la
  sección, y meterlas en un `div` lo habría roto **en silencio**. Hay un assert dedicado a esto en
  la prueba del catálogo completo.
- Nuevo gancho `id="garantias-grid"` en [modules/ui/trust.js](modules/ui/trust.js).
- El panel abre con un aviso explícito: *"Revisá los montos y los plazos antes de publicar: los que
  vienen cargados son de ejemplo y un cliente puede reclamártelos"*. El `readmeNotes` repite la
  advertencia.

### Cambios en módulos UI existentes

- [modules/ui/services.js](modules/ui/services.js): cada servicio guarda ahora también `icon` (el
  **nombre** Phosphor) además de `icono` (el SVG horneado). El nombre es dato; el SVG no sirve como
  dato. Sin esto la siembra de `servicios` habría tenido que duplicar los íconos a mano.
- [modules/ui/servicespage.js](modules/ui/servicespage.js): se exporta `DETALLES` (igual que
  `services.js` ya exportaba `SERVICIOS`) y las fichas quedan envueltas en `#servicios-detalle`,
  el gancho que el módulo funcional reemplaza.
- [modules/ui/timeline.js](modules/ui/timeline.js) y [modules/ui/trust.js](modules/ui/trust.js):
  un `id` en el contenedor que hasta ahora sólo tenía estilos inline.

Los cinco degradan solos: sin el módulo funcional, el HTML horneado se ve exactamente igual que antes.

### Bug encontrado por los tests y corregido

`PUT /api/experimentos/:id` devolvía `reiniciada: undefined` —no `false`— cuando el patch traía
variantes de la misma cantidad: la expresión era una cadena de `||` sobre campos ausentes, y
`false || undefined || undefined` es `undefined`. `JSON.stringify` **borra las claves `undefined`**,
así que el panel nunca se enteraba de que **no** se había reiniciado nada y mostraba el mensaje
genérico. Se envolvió en `Boolean()` con el comentario que explica por qué no es decorativo.

### Pruebas realizadas

- **Registro**: 210 módulos (100 UI · 110 funcionales), sin ids ni colecciones duplicadas.
- **4 variantes generadas** con syntax-check de cada JS emitido: lote con auth (38 archivos),
  sin auth (22), Vercel+Supabase (37) y catálogo completo (307) → **200 JS, 0 errores**.
- **102 asserts de backend** contra Express 5 real, entre ellos: los 6 servicios sembrados iguales
  al HTML, el ícono fuera de lista rechazado, los 8 puntos clave cortados en 6, el orden que queda
  1..N sin huecos, el 409 del último que no puede bajar, el servicio oculto que sale del sitio
  **pero no del panel**, el 401 del anónimo; la prueba A/B sembrada **apagada**, la que no reparte
  mientras esté pausada, el mismo visitante que recibe **siempre** la misma variante, las dos
  cargas que suman **una** impresión, las 60 visitas que se reparten entre A y B, la conversión
  idempotente, el 409 de convertir sin haber visto nada, el **ganador declarado por la prueba z con
  200 visitantes** y ≥95% de confianza, el reinicio que borra 200 mediciones sin tocar los textos,
  el texto corregido que **no** reinicia y la variante agregada que **sí**, y el borrado que no deja
  mediciones huérfanas; el `javascript:` y el `data:` rechazados en los logos, el medio nuevo que va
  al final de **su** grupo sin tocar el orden de los clientes; el hito sin año rechazado y el paso
  sin año aceptado (misma validación parametrizada), el paso del medio borrado que corre a los
  siguientes; y las dos listas de `razones` creciendo por separado.
- **20 asserts sobre el catálogo completo** (304 archivos, persistencia JSON): las 5 rutas nuevas
  en 200 con los 7 middlewares en el medio, los **8 ganchos de DOM** presentes en el HTML horneado,
  el zigzag de `features` con sus dos hermanos previos intactos y las 5 páginas de panel sirviéndose.
- **Degradación sin `auth`**: `/api/servicios`, `/api/marca`, `/api/historia` y `/api/razones` en
  200; `/todos` en 404; el reparto A/B **sigue funcionando** (es la parte pública); no se genera
  ninguna página de panel.
- **Smoke test en navegador real** sobre el proyecto generado: 6 servicios, 6 clientes, 5 medios,
  4 sellos con ícono, 4 hitos, 4 pasos numerados 1-4, 4 garantías y 3 filas de características,
  todo inyectado desde la API, con las opacidades en 1 (la red de seguridad de Anime funcionando).
  Ciclo A/B completo: se activó la prueba sembrada, el titular cambió a la variante B, se hizo un
  **clic real** en el botón (que navega) y la conversión llegó igual por `sendBeacon`. Los 5
  paneles cargando sus filas y sus grillas de íconos, el selector de grupo de `marca` alternando
  entre logo e ícono. **0 errores de consola.**
- **Vista previa del Builder**: las 7 secciones se pintan con los datos DEMO y el módulo A/B
  **no toca** el titular (corta antes en `__PREVIEW__`), como corresponde.

### docs: la documentación queda enfocada en el deploy, sin arranque local

Pedido del usuario: **DEPLOY.md con las instrucciones de Vercel, y ningún `.md` explicando cómo
correr el proyecto en local**.

- **[DEPLOY.md](DEPLOY.md) reescrito**. Antes cubría sólo el Builder y arrancaba obligando a
  GitHub; ahora separa explícitamente **dos deploys distintos** —el Builder y un proyecto
  generado—, que es la confusión más cara (un sitio de cliente exportado con persistencia JSON
  pierde los datos en cada deploy porque el filesystem de Vercel es efímero). Novedades:
  - **La CLI de Vercel como opción 1**, con la tabla de respuestas del asistente: publica la
    carpeta tal cual, **sin git ni GitHub**, que es como se trabaja este proyecto. El import
    desde GitHub queda como opción 2, para redeploy automático.
  - **Parte B nueva**: publicar un proyecto generado de punta a punta — Supabase, `vercel --prod`,
    la tabla de variables de entorno (incluidas las de IA cuando corresponde), el comando para
    generar un `JWT_SECRET` fuerte, y el aviso de que **el primer usuario que se registre se queda
    con el rol admin**.
  - Verificación y problemas típicos ampliados (datos que se pierden entre deploys, panel admin
    inaccesible, base de Supabase pausada a los 7 días) y el conteo del catálogo corregido:
    decía "debe listar 26" desde hacía muchas corridas, hoy son **210**.
  - En dominio propio se agrega el detalle que faltaba: cargar ese dominio en el Builder **antes**
    de exportar, porque es el que usan SEO y RSS para armar las URLs absolutas.
- **[README.md](README.md)**: fuera el bloque "Arranque rápido" (`npm install` / `npm start` /
  `localhost:4000`) y la línea de cómo correr el proyecto exportado. En su lugar, "Cómo se usa"
  describe el flujo del panel y remite a DEPLOY.md. En infraestructura, "Deploy: local o Vercel"
  pasó a "Deploy: Vercel".
- **README generado** ([src/generator.js](src/generator.js), función `readme`): se eliminó la
  sección `## Instalación`. La intro ahora **dice la verdad según la config** (antes afirmaba
  "corre 100% local… persistencia en archivos JSON" incluso en proyectos con Supabase), la sección
  de Supabase perdió el paso `npm start`, y la de Vercel se amplió con la CLI, las variables de
  entorno (sumando las de IA sólo si el proyecto tiene Chatbot o Agente) y el comando del
  `JWT_SECRET`. Los proyectos exportados **sin** Vercel reciben en su lugar una sección
  **"Publicarlo"** que explica por qué la persistencia en archivos no sobrevive en serverless.
  El bloque `## Estructura` también se volvió condicional: muestra `api/index.js` y
  `supabase/schema.sql` o `data/`, según lo que el proyecto realmente tenga.

**Bug de comillas corregido en el acto**: la primera versión de la intro condicional cerraba un
backtick con un apóstrofo (`` `data/' ``) por un `\'` de más dentro de la rama del ternario. Se vio
leyendo el README generado, no el código.

Verificación: 4 variantes regeneradas (**203 JS, 0 errores de sintaxis**), **102 asserts de backend**
y **20 del catálogo completo** en verde, e inspección de los README generados en las dos ramas
(Supabase/Vercel y JSON/local) — **cero apariciones** de `npm start`, `localhost:3000` o
`## Instalación` en los `.md` generados.

> Nota: en CAMBIOS.md y PROGRESO.md sí quedan menciones a `npm install` y `localhost`, pero son
> **registros históricos de pruebas ya corridas** ("el servidor levanta sin errores tras
> `npm install`"), no instrucciones para el lector.

## 2026-07-21 (36ª corrida)

> **Lote de 5 módulos funcionales que le ponen backend a las secciones que sólo eran HTML.**
> El catálogo llegó a 200 módulos sabiendo construir un sitio comercial completo y todo el ERP
> de atrás, pero **cinco de las secciones más visibles del sitio seguían siendo datos horneados
> en el generador**: los precios, las preguntas frecuentes, los horarios, las cotizaciones y el
> equipo. Cambiar un precio, agregar una pregunta o corregir un horario obligaba a **regenerar el
> proyecto y volver a deployar**, que es exactamente lo que un cliente real no puede hacer. Peor:
> el selector de moneda traía tasas fijas con el comentario "actualizalas cuando cambie el
> mercado" (o sea, una función que miente a los tres días), el cartel "Abierto ahora" lo calculaba
> **el reloj del visitante** (con la computadora en otro huso, mentía siempre) y la sección de
> equipo salía a producción con **tres nombres inventados**.
>
> Los cinco módulos nuevos siguen el patrón que estrenaron `textos` y `negocio`: colección propia,
> `GET` público, e **inyección en vivo sobre el HTML ya renderizado**. Ninguno es front-only:
> todos tienen backend real con validación, orden decidido por el servidor y panel solo-admin.
>
> | Módulo | Colección | Le da backend a |
> |---|---|---|
> | `planes` | `plans` | la sección de precios (`pricing`) |
> | `faqadmin` | `faqs` | el acordeón de preguntas (`faq`) |
> | `horarios` | `openhours` | la tabla de horarios (`hours`) |
> | `cambio` | `fxrates` | el selector de moneda (`currency`) |
> | `equipo` | `teamcards` | la sección "Nuestro equipo" (`team`) |
>
> Verificación: registro en **205 módulos (100 UI · 105 funcionales)**, **83 asserts de backend en
> verde** contra Express 5 real (dos veces: build inicial y build limpio de regresión), **0 errores
> de sintaxis** en los 167 JS de las variantes generadas, **0 emojis/glifos** en el HTML
> renderizado, el proyecto con los **205 módulos** levantando con las 11 rutas nuevas en 200 (con
> los 7 middlewares en el medio), variante Vercel+Supabase con las **5 tablas nuevas** en
> `schema.sql`, variante **sin `auth`** degradando bien (API pública en 200, panel en 404) y smoke
> test en navegador real con **0 errores de consola**. **Un bug de coherencia encontrado por la
> prueba en navegador y corregido** (ver abajo). Sin módulos revertidos.

### Los 5 módulos

- **`planes`** (`requires: ['pricing']`, `usesAnime`) — las tarjetas de precios salen de la
  colección `plans` y se reconstruyen con **el mismo marcado que hornea `pricing`**
  (`data-mensual` / `data-anual` / `.price-num` / `.price-per`), así el interruptor mensual/anual
  animado sigue funcionando sobre las tarjetas nuevas. El **importe anual no se guarda dos veces**:
  por default lo calcula el servidor como mensual × 10 (la regla "2 meses gratis" que ya usaba el
  HTML), y sólo se persiste si el negocio lo pisa a mano (`annualManual` se lo informa al panel
  para no precargar un valor calculado como si fuera propio). Un importe **0 es "a medida"**: la
  tarjeta muestra texto y queda fuera del interruptor, como la tarjeta Empresa original. El
  **orden lo decide el servidor** (`POST /:id/mover` intercambia con la vecina y reescribe las
  posiciones 1..N, sin huecos ni empates) y el destino del botón se valida contra
  `javascript:`. Se siembran los tres planes del HTML horneado para que la primera carga no
  parpadee con datos distintos.
- **`faqadmin`** (`requires: ['faq']`, `usesAnime`) — reemplaza los `<details>` con el marcado del
  acordeón (incluido el caret Phosphor horneado) y **reescribe el JSON-LD FAQPage del `<head>`**
  con las preguntas reales, para que el rich result deje de mostrar los ejemplos. La pieza que lo
  vuelve útil: **cada apertura suma una vista** (`POST /:id/vista`, público, anónimo, sin cookies
  ni datos personales, `keepalive` para que se registre aunque el visitante navegue enseguida, y
  **una vista por pregunta y por carga de página** para que abrir y cerrar diez veces no infle el
  número). El panel puede ordenar por las más consultadas — y en ese orden **esconde los botones de
  mover**, porque reordenar sobre una lista ordenada por otro criterio confunde.
- **`horarios`** (`requires: ['hours']`, `usesAnime`) — reescribe la tabla **conservando los
  atributos `data-dias` / `data-abre` / `data-cierra`** que `hours` usa como única fuente de
  verdad, así su recálculo por minuto sigue andando sin tocar ese módulo. Suma las dos cosas que el
  front solo no puede resolver: **(1) feriados y cierres excepcionales** por fecha, con horario
  especial opcional, que **pisan el día** (el cliente le saca el horario a las filas que cubren hoy
  y agrega la del feriado, así el cartel dice "Cerrado" sin que `hours` sepa qué es un feriado); y
  **(2) el veredicto lo da el servidor con la zona horaria del NEGOCIO**, guardada en minutos de
  diferencia con UTC — porque en Vercel el proceso corre en UTC y un local de Buenos Aires cerraría
  tres horas antes. Además calcula "cierra a las 18:00" y "abre mañana a las 09:00" recorriendo los
  próximos 7 días con los feriados aplicados. Validaciones: una franja que cierra antes de abrir se
  rechaza, y cargar dos veces la misma fecha de feriado **reemplaza** en vez de duplicar.
- **`cambio`** (`requires: ['currency']`, `usesAnime`) — la tasa se carga **como la piensa el
  negocio** ("1 USD = 1.200 pesos"), no como la necesita el front (0,00083): el servidor guarda los
  pesos por unidad y publica el factor invertido. Cada cambio deja **historial** (fecha, valor
  anterior, valor nuevo y quién lo cargó, últimos 20 por moneda) — sin eso no hay forma de
  contestar "¿a cuánto estaba el dólar cuando te pasé el presupuesto?". Guardar la misma tasa **no
  ensucia el historial**. El peso es la **moneda base**: 409 al cotizarla contra sí misma, al
  ocultarla y al borrarla. Sin API externa de por medio: nada que pagar ni que se caiga.
- **`equipo`** (`requires: ['team']`, `usesAnime`) — las personas salen de `teamcards`, con foto por
  URL (validada contra `javascript:`/`data:`) o el **mismo avatar de iniciales con degradado** del
  HTML original, así una ficha sin foto nunca se ve rota. Quien se va se puede **ocultar** en vez de
  borrar. Distinto de `personal` (el legajo interno con fichajes): acá es la cara pública.

### Cambios en 4 módulos UI existentes (puntos de entrada para la inyección en vivo)

Un módulo que reemplaza el DOM de otro rompe los handlers que ese otro enganchó al cargar. En vez
de duplicar lógica, los cuatro módulos UI afectados exponen un punto de entrada mínimo:

| Módulo | Qué expone | Por qué |
|---|---|---|
| `pricing` | `window.WFPrecios.refrescar()` | además **dejó de cachear** las tarjetas (`listaPrecios()` las busca cada vez): el interruptor tiene que funcionar sobre tarjetas que aparecen después |
| `faq` | `window.WFFaq.rebind()` | el enganche por ítem pasó a función con nombre + flag `_wfFaq` para no enganchar dos veces (dos handlers cancelarían la apertura) |
| `currency` | `window.WFMoneda.setMonedas()` | repinta los botones enteros (una moneda puede dejar de existir) y **dejó de cachear** los `.js-precio` |
| `hours` | `window.WFHorarios.actualizar()` | ver el bug de abajo |

Los cuatro degradan solos: si el módulo funcional no está, no cambia nada; y si el funcional está
pero el UI salió temprano (p. ej. `faq` con `prefers-reduced-motion`), la inyección igual funciona
con el comportamiento nativo.

### Bug encontrado por la prueba en navegador y corregido

Con un feriado cargado para hoy, la Home mostraba **"Abierto ahora" en verde justo arriba de una
tabla que decía "Cerrado (feriado)"** y de una línea que decía "Cerrado · Abrimos mañana a las
09:00". Causa: `hours` calcula su cartel **al cargar la página**, cuando la tabla todavía tiene las
filas horneadas, y recién vuelve a calcularlo **al minuto siguiente**. La ventana de contradicción
era de hasta 60 segundos, y era exactamente la mentira que el módulo existe para evitar. Se
resolvió exponiendo `window.WFHorarios.actualizar()` desde `hours` y llamándolo desde `horarios`
justo después de reescribir la tabla. Verificado en navegador: el cartel pasa a **"Cerrado en este
momento"** en rojo en la misma carga, y al borrar el feriado vuelve a "Abierto".

### Detalle: los glifos ↑↓ de los botones de reordenar

Los tres paneles con reordenamiento salieron primero con `↑` y `↓` como texto del botón. El
catálogo no usa glifos pictográficos desde la pasada de diseño: pasaron a **íconos Phosphor
horneados** (`arrow-up` / `arrow-down` interpolados en el `clientJs`, la misma convención que usa
`faqadmin` para el caret del acordeón) con `aria-label` y `title`. Verificado sobre el HTML
renderizado del catálogo completo: **0 glifos**; los únicos `↑↓` que quedan en `app.js` son los de
`commandpalette`, donde son **notación de teclas** y corresponden.

## 2026-07-21 (35ª corrida)

> **Corrida de adopción**: no se escribieron módulos nuevos. Una sesión cortada de esta misma
> mañana (archivos de 07:14–07:24) dejó **5 módulos funcionales completos pero sin probar y sin
> bitácora** — el mismo caso de la 30ª y la 33ª, y la razón por la que cada corrida arranca
> contrastando el disco contra `PROGRESO.md`. Esta corrida los revisó contra el patrón de la casa,
> les armó la suite de tests que les faltaba, los verificó en navegador y los documentó
> retroactivamente. Los cinco son: **`personal`** (legajo y fichaje de asistencia), **`trabajo`**
> (tablero de tareas del equipo), **`tablero`** (panel de control con los KPIs del negocio),
> **`vencimientos`** (lo que el negocio tiene que pagar) y **`presupuestador`** (cotizador online
> para el visitante).
>
> Como el registro de módulos **se carga solo desde el disco** (`registry.js` recorre
> `modules/ui` y `modules/functional`), los cinco ya entraban al catálogo sin tocar nada: el
> registro pasó de 195 a **200 módulos (100 UI · 100 funcionales)** sin ninguna edición. Lo que
> faltaba no era registrarlos sino **probar que funcionan**.
>
> Verificación: **98 asserts de backend en verde** contra Express 5 real, **10 asserts más** sobre
> el proyecto con los **200 módulos y los 7 middlewares conviviendo**, **0 errores de sintaxis** en
> los 187 JS de las tres variantes generadas, **0 emojis** en el HTML renderizado y smoke test en
> navegador real con **0 errores de consola**. **Un bug cosmético encontrado por la prueba en
> navegador y corregido** (ver abajo). Sin módulos revertidos.

### Revisión de los 5 módulos adoptados

Los cinco siguen el patrón de la casa sin desvíos: `usesAnime`, `requires: ['auth']`, cálculo
server-side, integración condicional por `cfg.moduleIds`, y `readmeNotes` explicando lo que
requiere acción humana. Lo que la revisión confirmó módulo por módulo:

- **`personal`** (`staff`, `shifts`) — el vínculo cuenta↔legajo es **el email**, y quien no figura
  en el legajo recibe un 403 con el mensaje que explica qué pedirle al administrador. Las horas
  **no son un campo escribible**: salen de `minutosEntre()` sobre los pares entrada/salida. El
  fichaje es un **toggle que decide el servidor** (nadie puede fichar dos entradas seguidas), el
  doble toque dentro del minuto se rechaza con 409 y un turno de más de 20 horas **no inventa una
  hora de salida**: queda marcado `missing` para que el admin lo corrija. La baja es **lógica**, así
  que la planilla de los meses pasados sobrevive.
- **`trabajo`** (`worktasks`) — **quién ve qué lo decide el servidor**: `visibles()` filtra por
  `assigneeEmail` para todo el que no sea admin, y `GET /equipo` (la lista del equipo con sus
  emails) **es solo-admin**, que es lo correcto en un sitio con registro público. Transiciones
  validadas por la tabla `PASOS` (`pendiente → curso → hecha`, y reabrir vuelve a `curso` borrando
  `completedAt`), y **lo vencido lo marca el servidor con su propia fecha**, no el reloj del
  navegador.
- **`tablero`** (sin colección propia) — el módulo **no guarda nada**: lee las colecciones de los
  otros. El arreglo `METRICAS` se **hornea al generar** según los módulos activos, con lo que un
  módulo medible que se active después entra solo al regenerar. Cada KPI se compara contra el
  **período inmediatamente anterior** y, sin base previa, devuelve `variacion: null` en vez de
  inventar un porcentaje. La serie diaria incluye **los días en cero** (un gráfico que los saltea
  miente sobre la tendencia), y `lector()` cachea cada colección por pedido aunque la usen varios
  indicadores.
- **`vencimientos`** (`duebills`) — **el estado "vencido" no se guarda: lo calcula `decorar()`** con
  la fecha del servidor. Las obligaciones mensuales **se renuevan al pagarlas**, no por adelantado,
  y `mesSiguiente()` respeta los meses cortos (31/1 → 28/2, sin días fantasma). Un vencimiento
  pagado **queda sellado** (409 al editarlo o al pagarlo de nuevo) y los pagos a futuro se rechazan.
  Con `caja` activo el pago **espeja un egreso del día** respetando el cierre; el bloque entero está
  bajo `${conCaja ? … : …}` con **las dos ramas cerrando el handler**, que es la trampa anotada en
  [[cierre-de-handler-en-template]].
- **`presupuestador`** (`calcitems`, `calcquotes`) — **el total nunca llega del navegador**:
  `cotizar()` lo arma de cero validando la selección contra la definición vigente, y una opción que
  no está en la definición **se rechaza** en vez de aceptarse "por las dudas". Los ajustes
  porcentuales se aplican **siempre sobre la base, nunca en cascada** (dos recargos del 10% suman
  20%, no 21%). Cada cotización guarda la **foto de los precios del momento**, así que actualizar la
  lista no cambia lo ya prometido. La consulta pública por código devuelve lo del visitante y nada
  más: ni el email ni la nota interna del negocio.

### `modules/functional/personal.js` — arreglo del encabezado de fecha

- **El bug**: la pantalla de fichaje mostraba **"Martes, 21 De Julio"**. La regla era
  `.pe-reloj .pe-dia{…;text-transform:capitalize}`, y `capitalize` pone mayúscula en **cada
  palabra**; `toLocaleDateString('es-AR', {weekday:'long', …})` devuelve `"martes, 21 de julio"`, así
  que la preposición quedaba capitalizada. En español eso está mal escrito.
- **La solución**: sacar el `capitalize` global y capitalizar sólo la inicial con
  `.pe-reloj .pe-dia::first-letter{text-transform:uppercase}`. Es CSS puro, sin tocar el JS ni el
  dato.
- **Verificado en navegador**: `getComputedStyle(el).textTransform === 'none'` y
  `getComputedStyle(el, '::first-letter').textTransform === 'uppercase'`, con el texto crudo
  intacto en `"martes, 21 de julio"`.
- **Nota**: el comentario que documenta la regla va con `/* … */`, no con `//`. El bloque es un
  `<style>` dentro de un template literal: un `//` ahí no es un comentario sino texto que rompe la
  regla siguiente. (Primer intento de este arreglo cayó en eso y se corrigió antes de generar.)

## 2026-07-21 (34ª corrida)

> Lote de **5 módulos funcionales nuevos con backend real**. El hilo es **el negocio por dentro**:
> el catálogo ya sabía construir un sitio comercial completo y sostenerlo después de publicarlo
> (33ª), pero seguía suponiendo que del otro lado hay **una sola persona dueña de todo** — un único
> admin que ve la caja y los pedidos, que carga cada dato a mano y que cierra los tratos de palabra.
> Los cinco atacan eso: quién puede hacer qué (**`roles`**, con un middleware que corta la API por
> área y por método, con el mapa de áreas armado al generar con los módulos activos), cómo se deja
> constancia de lo acordado (**`firma`**, con enlace de un solo uso, lienzo de firma y huella
> SHA-256 del texto exacto que se mostró), qué le compro a mis proveedores (**`compras`**, con el
> total calculado en el servidor, circuito de estados validado y entrada automática de stock al
> recibir), qué me deben mis clientes (**`ctacte`**, con el saldo derivado de los movimientos y el
> pago espejado en la caja diaria) y cómo entran los datos que ya tenía en una planilla
> (**`importar`**, con parser de CSV propio, previsualización y colecciones vedadas).
> Verificación: **90 asserts de backend en verde** contra Express 5 real, **17 de las variantes**
> (sin-auth y catálogo completo con 195 módulos y 7 middlewares conviviendo), **0 errores de
> sintaxis** en los 195 JS emitidos, **0 emojis** en el HTML renderizado y smoke test en navegador
> con **0 errores de consola**. **Un bug de usabilidad encontrado por la prueba en navegador y
> corregido** (mapeo de columnas de `importar`, ver abajo). Sin módulos revertidos.

### `modules/functional/roles.js` — Roles y permisos

- **El problema**: los roles estaban horneados en dos (`admin` ve todo, `user` no ve nada de la
  trastienda) y el pedido del medio —"que la recepcionista cargue turnos pero no vea la caja"— no
  tenía respuesta. Resolverlo tocando los 94 módulos restantes no era una opción.
- **La solución**: `middlewares: [{file: 'src/middleware/permisos.js'}]`, montado antes de los
  routers. Mira `req.path`, resuelve el **área** por prefijo de ruta y decide. El mapa `AREAS` se
  **genera** recorriendo `cfg.moduleIds` y leyendo los `mounts` y el `name` de cada módulo funcional
  activo (el registro se requiere **dentro** de `files()`, no en el top-level, para no entrar en un
  ciclo con `registry.js`, que es quien carga este archivo).
- **Orden de las reglas** (importa, y está comentado en el archivo generado): lo que no es `/api/`
  pasa; `/api/auth` y `/api/roles` son **libres** (sin la primera nadie podría iniciar sesión, y la
  segunda ya exige admin por su cuenta); sin sesión pasa (cada ruta decide si es pública); `admin`
  pasa siempre; **sin rol asignado pasa** — activar el módulo no cambia el comportamiento de ningún
  proyecto existente; recién con rol se aplica `none` / `read` / `write`, con `read` cortando todo lo
  que no sea GET o HEAD.
- **Modos**: `abierto` (lo no configurado se permite) y `cerrado` (lo no configurado se niega), en
  el campo `mode` del rol. `limpiarPerms()` descarta las áreas que no existen en el proyecto.
- **Propiedad que reveló la prueba**: un rol **restringe, nunca otorga**. Dar `write` sobre un área
  a una cuenta común no la vuelve admin: el `requireAdmin` de la ruta corre después y sigue
  cortando. Quedó documentado como `readmeNotes` propio, porque es lo primero que se malinterpreta.
- **Anti-lockout**: `PATCH /api/roles/usuarios/:id` responde 409 si el id es el del propio usuario,
  y `DELETE /api/roles/:id` libera (`roleKey: ''`) a todos los que lo tenían antes de borrarlo.
- Se siembra un rol `consulta` con `read` en todas las áreas del proyecto.

### `modules/functional/firma.js` — Firma de documentos

- Colección `signdocs`. El admin crea el documento y el servidor guarda `hash = sha256(body)` en el
  alta: es la huella del texto **tal como se mostró**. Al firmar guarda `proof =
  sha256(hash + '|' + nombre + '|' + signedAt)`, que ata texto, firmante y momento.
- La parte pública (`GET`/`POST /api/firma/doc/:token`) **no** pasa por `requireAuth`: el cliente no
  se va a crear una cuenta para firmar. El control es el token (`crypto.randomBytes(18)`).
  `publica()` no expone el email del destinatario ni la IP.
- La firma viaja como dataURL PNG validada por regex y con tope de 400 KB. El lienzo usa **Pointer
  Events** (mismo código para dedo y mouse) con `setPointerCapture`.
- Estados: `pendiente` → `firmado` / `anulado`, más `vencido` **derivado** de `expiresAt` (30 días),
  nunca guardado. Un documento firmado responde 409 tanto al DELETE como al PATCH de anulación.
- Sin `auth` el módulo emite igual la página pública y el router, pero sin las rutas de admin.

### `modules/functional/compras.js` — Proveedores y compras

- Colecciones `suppliers` y `purchases`. `totalDe(items)` corre **sólo en el servidor**; el total que
  manda el navegador se ignora (probado con un total falso de 999.999).
- `TRANSICIONES = {borrador: ['enviada','anulada'], enviada: ['recibida','anulada'], recibida: [],
  anulada: []}`: el circuito es un dato, no una cadena de `if`. Saltar de borrador a recibida da 409.
- **Integración con `inventory`** (condicional por `cfg.moduleIds.includes('inventory')`): al pasar a
  `recibida` se insertan movimientos `entrada` en `movements` para los renglones con `productId`,
  usando el `branchId` elegido al crear la orden, y la respuesta informa `stockIngresado`. Los
  renglones sin producto (un flete) no tocan stock.
- El DELETE sólo acepta borradores y el proveedor con órdenes no se borra (se da de baja).

### `modules/functional/ctacte.js` — Cuenta corriente de clientes

- Colección `ctamoves`. El saldo **no se persiste**: `cuentas()` agrupa por `clientKey` y calcula
  `charges - payments`, igual que `inventory` deriva el stock. `GET /cuenta/:key` devuelve además el
  **saldo corrido** ordenando por `date + createdAt`.
- `claveDe(name, email)` usa `m:<email>` si hay email y `n:<nombre normalizado>` si no: dos
  homónimos con emails distintos no se mezclan.
- **Integración con `caja`**: un `pago` inserta un `cashmove` de tipo ingreso, salvo que exista un
  `cashclosure` de ese día — en ese caso el movimiento se registra igual en la cuenta y la respuesta
  trae `cajaCerrada: true` para que el panel lo diga. **Integración con `clientes`**:
  `GET /api/ctacte/clientes` alimenta el selector de fichas del CRM.
- El DELETE sólo acepta movimientos cargados **hoy**; lo viejo se corrige con el movimiento
  contrario, que es como se lleva una cuenta de verdad y deja el historial completo.

### `modules/functional/importar.js` — Importar datos (CSV)

- No declara colecciones propias: la lista de importables sale de `cfg.collections` menos las
  **vedadas** (`users`, `roles`, `signdocs`, `filedata`, `taskruns`, `taskcfg`, `shieldlog`,
  `cashclosures`). Importar usuarios o roles sería una escalada de privilegios y importar firmas
  sería fabricarlas; se rechaza aunque se pida la colección a mano.
- `parseCsv()` es una máquina de estados propia: comillas dobles con `""` escapado, **saltos de
  línea dentro de una celda**, CRLF, BOM y separador `;` o `,` detectado contando la primera línea.
- `POST /previsualizar` **no escribe nada** (verificado con un assert que cuenta las filas del CRM
  después de previsualizar); `POST /confirmar` es el único que inserta, con tope de 2000 filas y
  1 MB. `valorDe()` convierte números y `sí/no`; `RESERVADOS` (`id`, `createdAt`) se ignoran siempre.
- La deduplicación exige que el campo esté entre los mapeados (422 si no) y compara en minúsculas.

### Corrección de usabilidad en `importar` (encontrada por el smoke test en navegador)

- **Síntoma**: el mapeo de columnas era un `<select>` cerrado armado con los campos **ya existentes**
  en la colección más los encabezados del CSV. En una colección **vacía** —el caso del primer día,
  que es justo el que el módulo existe para resolver— no hay campos conocidos, así que la única
  opción elegible era el encabezado del CSV: importar una columna "nombre" a `customers` creaba un
  campo `nombre` que el CRM (que lee `name`) no muestra nunca.
- **Arreglo**: pasó a `<input list="im-campos">` con un `<datalist>` de los campos conocidos —sugiere
  lo que hay y deja escribir lo que falte— y el selector de deduplicación se rearma solo con lo que
  se va escribiendo (`pintarDedupe()` enganchado al evento `input` de cada campo). Vacío = no
  importar. Se ajustó también el texto de ayuda del paso 3.

### Bugs propios corregidos durante la corrida

- **Cierre de handler comido por la interpolación** en `compras.js` y `ctacte.js`: el `});` final de
  un `router.patch(...)` estaba escrito como `` `}); `` después de un `${cond ? … : …}`, con lo que
  la llave cerraba **la interpolación** y al archivo generado sólo llegaba `);`. Los seis archivos
  afectados (2 rutas × 3 variantes) no parseaban. Arreglado moviendo el `});` **adentro de las dos
  ramas** del ternario. Lo detectó el syntax-check de los JS generados, que por eso corre siempre.

## 2026-07-21 (33ª corrida)

> Lote de **5 módulos funcionales con backend real**: **4 nuevos** más el **rescate de `qr`**, que
> una sesión cortada de esta misma madrugada había dejado escrito (02:15–02:19) sin probar ni
> documentar. El hilo de los cuatro nuevos es **lo que le pasa al sitio después de publicarlo**, que
> es donde el catálogo tenía sus últimos agujeros grandes: que Google lo muestre bien
> (**`seoadmin`**, con las metas editables sin reexportar y las redirecciones 301 que salvan el
> posicionamiento de una dirección vieja), que cumpla la ley (**`privacidad`**, con el
> consentimiento probable en el servidor y los pedidos de acceso/eliminación con el plazo legal
> corriendo), que se sepa cuándo se rompe (**`salud`**, con las Core Web Vitals de visitas reales,
> los errores de JavaScript del visitante y los enlaces rotos) y que se pueda vender afuera
> (**`traducciones`**, con los idiomas y el diccionario como dato y la detección automática de las
> frases del sitio). Verificación: **84 asserts de backend en verde** contra Express 5 real, **9
> sin-auth**, **10 con los 190 módulos activos a la vez** (6 middlewares conviviendo) y smoke test
> en navegador con **0 errores de consola**. **Un bug de UX encontrado por la prueba en navegador y
> corregido**; el encoder QR **contrastado contra el paquete `qrcode` de npm**.

### feat(qr): Códigos QR con encoder propio — módulo adoptado y verificado

- [modules/functional/qr.js](modules/functional/qr.js) y [src/qrcode.js](src/qrcode.js) (escritos
  por una sesión anterior que se cortó antes de probarlos; esta corrida los revisó contra el patrón
  de la casa, los probó y los documentó — mismo procedimiento que la 30ª con los 4 adoptados).
- **Verificación del encoder**: se contrastó módulo a módulo contra el paquete `qrcode` de npm
  (instalado sólo como oráculo de prueba, **no** es dependencia de nada). **15 de 16** casos de modo
  byte × niveles L/M/Q/H dan matrices **idénticas**; el único distinto elige otra máscara con el
  mismo tamaño, y forzando la máscara de referencia las matrices coinciden exactamente — o sea que
  el desacuerdo es un empate de penalización, no un error de codificación.
- Probado en la suite: SVG servido por el backend, redirección 302 con passthrough de query,
  escaneos contados por día y dispositivo, slug reservado (422) y duplicado (409), destino
  `javascript:` rechazado, código de texto que no redirige, pausado que deja de redirigir **pero
  cuya imagen se sigue sirviendo** (el panel necesita la vista previa).
- Nota de comportamiento verificada: un QR pausado o de texto responde 404, y con `salud` activo ese
  404 **queda registrado como enlace roto** — es correcto, son visitas reales que no encontraron nada.

### feat(seoadmin): SEO administrable — metas por página y redirecciones 301

- [modules/functional/seoadmin.js](modules/functional/seoadmin.js) (nuevo, `usesAnime`,
  `requires: ['auth']`, `middlewares` + `mounts`, colecciones `seopages`, `seoredirects`, `seoconfig`).
- `src/middleware/seoadmin.js` corre **antes de los estáticos** y hace tres cosas en orden:
  1. **redirecciones** (301/302, comparación sin distinguir mayúsculas ni barra final, los
     parámetros viajan al destino salvo que se apague, contador de usos escrito **después** de
     responder);
  2. **robots.txt** vigente desde la base (le gana al `public/robots.txt` estático del módulo `seo`);
  3. **reescritura del `<head>`** de cada página HTML con título, descripción, canonical, Open Graph
     y Twitter Card.
- La reescritura pasa por el servidor y **no** por JavaScript en el navegador a propósito: el
  buscador y las vistas previas de WhatsApp/LinkedIn leen el HTML tal como llega.
- Sólo se quitan las metas **que administra este módulo** (las que emite `seo` al generar); el resto
  del `<head>` —fuente, hojas de estilo, JSON-LD, favicon— queda intacto. Verificado que no quedan
  dos `<meta name="description">`.
- Si la ficha de la página está vacía y sin `noindex`, **no se toca el HTML**: se sirve byte a byte
  el archivo de disco (assert explícito comparando contra `public/index.html`).
- Las páginas se **siembran al abrir el panel** desde la lista horneada al generar (`ctx.pages`), y
  las de trastienda (`*-admin.html`, `auth.html`) arrancan con **noindex**: que Google indexe el
  login de un cliente es un error clásico y silencioso.
- Caché de 5 s de las fichas con `invalidar()` exportado en el middleware y llamado por el router:
  sin eso el panel mostraría el cambio guardado y el sitio seguiría sirviendo lo viejo.
- Validaciones: destino interno o `http(s)` (nada de `javascript:`), redirección a sí misma 422,
  duplicada 409, imagen sólo `http(s)`.
- Panel `/seo-admin.html` con tres pestañas, **vista previa del resultado en Google**, contador de
  caracteres con el largo recomendado (60/155) y KPIs con count-up.

### feat(privacidad): Centro de privacidad — consentimiento probable y derechos del titular

- [modules/functional/privacidad.js](modules/functional/privacidad.js) (nuevo, `usesAnime`,
  colecciones `consents` y `datareqs`). **La parte pública funciona sin `auth`**; el panel se genera
  sólo si `auth` está activo.
- **Consentimiento en el servidor**: cada decisión queda con su fecha, la versión de la política, la
  página y si fue móvil o escritorio. El identificador es un número al azar generado por el propio
  navegador (`pv-vid`), que no dice quién es la persona pero le permite **volver a ver y cambiar** lo
  que eligió; se cuenta cuántas veces cambió de opinión, que es parte de la prueba.
- **Convive con el módulo UI `cookies` sin tocarlo**: escucha en fase de captura el clic sobre
  `[data-consent]`. Si `cookies` **no** está activo, este módulo pone su propio cartel (pedir el
  consentimiento es la mitad del trabajo; sin cartel no hay nada que registrar).
- **Solicitudes del titular** (acceso, rectificación, eliminación, oposición) con código `PR-XXXXXX`,
  seguimiento público por código —que **nunca** devuelve la nota interna— y una sola solicitud
  abierta por email+tipo (409 devolviendo el código de la que ya está).
- **Plazo legal a la vista**: 10 días corridos (Ley 25.326), calculados en el servidor, con KPI de
  vencidas.
- **"Buscar sus datos"** recorre **todas las colecciones del proyecto** —resueltas al generar desde
  `cfg.collections`, así que cualquier módulo futuro queda cubierto solo— menos `users` y las
  propias; nunca devuelve contraseñas ni tokens. Es lo que se le entrega ante un pedido de acceso.
- **"Anonimizar"** reemplaza los datos personales **sin borrar las filas**: un pedido facturado o una
  reserva pasada tienen que seguir existiendo para la contabilidad; lo que desaparece es el dato
  personal, no el registro de la operación. Doble confirmación y anotación en la nota de la solicitud.
- Con `mailer` activo, cada solicitud le avisa al negocio (disparar y seguir).
- La decisión se guarda en `localStorage` **tal cual** (incluido `rejected`): es lo que consultan los
  otros módulos antes de medir nada.

### feat(salud): Monitor de salud del sitio — velocidad real, errores del visitante y enlaces rotos

- [modules/functional/salud.js](modules/functional/salud.js) (nuevo, `usesAnime`,
  `requires: ['auth']`, `middlewares` + `mounts`, colecciones `vitals`, `jserrors`, `notfound`).
- **Core Web Vitals de visitas reales** con `PerformanceObserver`: LCP (última entrada), CLS
  (saltos sin interacción reciente) e INP (la peor interacción). Se mandan con `navigator.sendBeacon`
  y `Blob` de tipo `application/json` —lo que hace que `express.json()` los parsee— al ocultarse la
  pestaña (`visibilitychange`/`pagehide`, el único momento garantizado en iOS).
- Los **umbrales oficiales viven en el servidor**, no en el navegador: se guarda por día/métrica/ruta
  el conteo `bueno/mejorable/malo` más suma y peor valor. Una fila por día, no una por visita.
- **Errores de JavaScript** (`error` + `unhandledrejection`) agrupados por mensaje+archivo+línea: uno
  que le pasa a 400 personas es **una fila con 400 usos**. Un error marcado como resuelto que vuelve
  a pasar **se reabre solo**. Tope de 300 errores distintos.
- **404 reales** contados por `src/middleware/salud.js` con `res.on('finish')` mirando el estado real
  de la respuesta (no adivinando si el archivo existe), agrupados por ruta+origen+día, guardando
  **sólo el dominio** de quien enlazó. Los assets que faltan no ensucian el listado.
- **Integración con `seoadmin`**: el botón "Redirigir" del panel crea la 301 y marca el roto como
  atendido, todo sin salir de la pantalla. El endpoint sólo existe si `seoadmin` está activo.
- **Privacidad de raíz**: no se guarda IP, ni user-agent, ni identificador de visitante; la ruta se
  guarda **sin los parámetros** (ahí puede viajar un email). Con `privacidad` activo, **no se mide
  nada** si la persona rechazó el almacenamiento (verificado en navegador real).
- Panel `/salud-admin.html` con serie de 14 días coloreada por calidad, las tres métricas con su
  promedio, páginas más lentas, errores y rotos.

### feat(traducciones): Multiidioma administrable — con detección automática de los textos

- [modules/functional/traducciones.js](modules/functional/traducciones.js) (nuevo, `usesAnime`,
  `requires: ['auth']`, colecciones `langs`, `i18nkeys`, `i18ncfg`).
- Es la **evolución administrable del módulo UI `i18n`**, cuyo diccionario ES→EN está horneado: acá
  los idiomas son datos (los que haga falta) y el diccionario se edita sin regenerar el sitio.
  Si los dos están activos, éste **esconde el selector del otro** (traducen igual y se pisarían).
- **Detección de textos**: cada visita le avisa al servidor qué frases mostró la página, una sola vez
  por página y por día. Es el trabajo que normalmente hace un plugin pago. Se apaga con un
  interruptor cuando ya está todo relevado. **Verificado en navegador**: una sola visita a la Home
  dejó **36 frases** listas para traducir (navegación, hero, formulario, pie).
- No se detecta lo que **no se ve** (`getClientRects().length === 0`) ni las páginas de trastienda
  (`*-admin.html`, `auth.html`): traducir el propio panel no le sirve a nadie y taparía lo del sitio.
- Topes en todo porque el endpoint es público: 60 frases por pedido, 220 caracteres cada una, 800 en
  total. El filtro de "sólo números/precios/fechas" está **también en el servidor**, no sólo en el
  navegador: lo que decide qué entra al diccionario no puede ser la buena voluntad de quien manda el
  pedido.
- Un idioma **arranca sin publicar**: un sitio a medio traducir es peor que un sitio en un solo
  idioma. Sólo se guardan traducciones de idiomas cargados (un código suelto en el cuerpo no crea un
  idioma fantasma) y quitar un idioma borra las suyas.
- El texto original de cada nodo se guarda al recolectar, así volver al idioma del sitio es
  **restaurar** y no traducir al revés; se conserva el espaciado original (sin eso, dos palabras
  seguidas en el HTML se pegan al traducir). Se fija `<html lang>`.
- **Bug de UX encontrado por la prueba en navegador y corregido**: guardar una frase redibujaba toda
  la lista y **borraba lo tipeado y todavía sin guardar en las demás** — quien traduce escribe varias
  seguidas. Ahora se actualiza sólo el cartelito de esa fila y las barras de avance, con el avance
  recalculado en el cliente (`calcularAvance`).

### test: verificación del lote

- **Generación**: 4 variantes con `vm.Script` — full (56 archivos, 32 JS), sin-auth (16/8), Vercel +
  Supabase (44/23, con las **13 colecciones nuevas** en `schema.sql`) y **el proyecto con los 190
  módulos activos a la vez** (260 archivos, 130 JS). **0 errores de sintaxis**, 0 cierres peligrosos
  en `app.js`.
- **Backend real** en Express 5 (:4980): **84 asserts en verde** cubriendo los 5 módulos.
  **9 asserts sin-auth** (:4981) y **10 con el catálogo completo** (:4982), incluida la verificación
  de que los **6 middlewares** de módulo se montan antes de los estáticos y conviven.
- **Smoke test en navegador real** (:4983): **0 errores de consola**; `anime` y `Motion` conviviendo;
  metas reescritas visibles en `document.title`/`canonical`; **edición de metas por UI reflejada al
  instante en el HTML servido**; clic en el cartel de cookies **registrado en el servidor** con su
  página y dispositivo; un **error de JavaScript real capturado y reportado**; preferencia de
  privacidad cambiada y solicitud creada y consultada por código desde la UI; idioma agregado,
  traducido y publicado por UI y **la Home cambiando de idioma con el selector** (y volviendo);
  panel de QR con las imágenes servidas por el backend y sus 14 barras animadas.
- **Limitación conocida del entorno de prueba**: el panel del navegador corre oculto, así que el
  navegador no emite LCP (por especificación, una página que nunca se vio no tiene "contenido más
  grande pintado"). El envío de métricas se probó por API y el de errores en el navegador real.

## 2026-07-21 (32ª corrida)

> Lote de **5 módulos funcionales, todos con backend real**. El hilo de la corrida es la
> **infraestructura que faltaba para que el sitio se defienda y se opere solo**: el **escudo
> anti-spam** que protege de una vez todos los formularios del catálogo (cerrando el pendiente del
> contrato `middlewares` anotado en la 31ª), el **disparador diario** que varias corridas venían
> pidiendo (saludo de cumpleaños, recordatorios, limpiezas) y el **registro de auditoría** que anota
> quién hizo qué sin tocar una línea de los demás módulos. Los completan dos piezas que cualquier
> cliente pide: el **acortador de enlaces con estadísticas** y la página de **Mi perfil**.
> Verificación: **97 asserts de backend en verde** contra Express 5 real + **11 asserts sin-auth**,
> generación con **los 185 módulos activos a la vez** (245 archivos, 121 JS, 0 errores) y smoke test
> en navegador con **0 errores de consola**. **Un bug encontrado por los tests y corregido**.

### feat(escudo): Escudo anti-spam — protección real para todos los envíos públicos

- [modules/functional/escudo.js](modules/functional/escudo.js) (nuevo, `usesAnime`,
  `middlewares` + `mounts`, colecciones `shield` y `shieldlog`).
- `src/middleware/escudo.js` corre **antes de los estáticos y de toda la API**: un envío frenado
  nunca llega al módulo que lo iba a atender. Sólo actúa sobre `POST/PUT/PATCH/DELETE` contra
  `/api`; navegar y leer jamás se frena.
- Tres defensas: **ráfaga por IP** con ventana deslizante en memoria (429 + `Retry-After`),
  **contenido** (palabras bloqueadas con acentos plegados + tope de enlaces por mensaje, 422) y
  **lista de IPs** bloqueadas a mano (403).
- Los campos cuyo nombre matchea `pass|clave|token|secret` **nunca se inspeccionan**: sin eso una
  contraseña que contenga una palabra bloqueada sería impasable (probado: login con clave
  `casino-…` responde 401, no 422).
- Con `auth`, el **admin queda exento**: un panel hace ráfagas legítimas (altas masivas,
  importaciones). El middleware verifica el token con `src/token.js` cuando `auth` está activo.
- Config cacheada 15 s para no pegarle a la base en cada request (crítico con Supabase), con
  `escudo.invalidar()` que el router llama al guardar: el cambio de límite se aplica en el acto.
- El log se autolimita (400 → 300) y **no guarda el cuerpo del envío**, sólo IP, ruta y motivo.
- Panel `/escudo-admin.html`: interruptor, KPIs por motivo con count-up, límites editables, ABM de
  IPs y tabla de bloqueos con CSV.

### feat(tareas): Tareas programadas — el disparador diario que faltaba

- [modules/functional/tareas.js](modules/functional/tareas.js) (nuevo, `usesAnime`,
  `middlewares` + `mounts`, colecciones `taskruns` y `taskcfg`, env `CRON_SECRET`).
- `src/tareas.js` es el registro de trabajos, **generado según los módulos activos**: cada trabajo
  existe sólo si su módulo está. Hoy: `resumen-diario` (siempre), `cumples-saludo` (+`cumples`),
  `agenda-recordatorio` (+`agenda`+`mailer`), `limpieza-tokens` (+`recuperar`), `promos-por-vencer`
  (+`promos`) y `auditoria-purga` (+`auditoria`).
- Dos vías de disparo: **1)** `src/middleware/tareas.js` detecta el primer pedido del día y corre
  los pendientes con `setImmediate` (el visitante nunca espera); **2)** `POST /api/tareas/ejecutar`
  con `x-cron-secret` para un cron externo — **sin `CRON_SECRET` responde 503**, así que nunca queda
  abierto por olvido.
- **Idempotencia por día**: `correrPendientes()` consulta las corridas de hoy en la base, así que
  aunque el proceso se reinicie diez veces los trabajos corren una sola vez. El saludo de cumpleaños
  además marca `greetedYear` por persona: correrlo dos veces no saluda dos veces.
- `cumples-saludo` usa `mailer.notifyTo()` — **es el segundo módulo que le escribe al cliente y no
  al negocio**, avanzando sobre el pendiente nº 1 de la 31ª.
- Un trabajo que falla se anota y **no frena a los demás**. Historial acotado (300 → 200).
- Panel `/tareas-admin.html`: estado y último resultado por trabajo, encender/apagar de a uno,
  ejecutar (todo o uno), historial con CSV y la receta del cron externo con la URL real del sitio.

### feat(auditoria): Registro de auditoría — quién hizo qué, sin tocar ningún módulo

- [modules/functional/auditoria.js](modules/functional/auditoria.js) (nuevo, `usesAnime`,
  `requires: ['auth']`, `middlewares` + `mounts`, colección `auditlog`).
- `src/middleware/auditoria.js` observa los pedidos que escriben contra `/api` hechos **con sesión
  iniciada** y anota en `res.on('finish')`: así queda el **status real**, incluidos los intentos
  **rechazados** (un 403 repetido es justo lo que interesa ver).
- La tabla ruta → nombre humano del módulo se arma **al generar**, recorriendo los `mounts` de los
  módulos seleccionados (`require('../../src/registry')` perezoso adentro de `files()` para evitar
  la dependencia circular con el registro). Consecuencia: **cualquier módulo que se agregue después
  queda auditado solo**, sin escribir una línea.
- Panel `/auditoria-admin.html`: KPIs (hoy, semana, bajas, intentos rechazados), filtros por
  usuario/módulo/acción/período **armados con lo que realmente hay registrado**, CSV y purga
  (`?dias=` obligatorio: vaciar el registro de un click sería justo lo que un registro de auditoría
  tiene que hacer difícil).

### feat(enlaces): Enlaces cortos con estadísticas reales

- [modules/functional/enlaces.js](modules/functional/enlaces.js) (nuevo, `usesAnime`,
  `requires: ['auth']`, colecciones `links` y `linkclicks`).
- Dos montajes: `/l` (la redirección pública) y `/api/enlaces` (el ABM admin). `GET /l/<slug>`
  responde **302 real** y cuenta el clic **después de responder**.
- Los parámetros de la visita se **reenvían al destino** (las etiquetas `utm_*` siguen llegando a la
  analítica del cliente) y del referente se guarda **sólo el dominio**, nunca la URL completa.
- Los clics se agrupan por **enlace/día/origen** (un renglón por combinación, no uno por clic): el
  histórico no crece sin control. El detalle devuelve la **serie completa de 14 días** con ceros
  incluidos — un gráfico que omite los días vacíos miente.
- Destino validado en el servidor con `new URL()`: sólo `http:`/`https:` (un `javascript:` guardado
  acá sería un XSS disparado desde el dominio del propio cliente). Slug reservado (`api`, `l`,
  `admin`, `index`), único (409) y **no editable** a propósito: cambiarlo rompería los enlaces ya
  repartidos.
- Pausa y vencimiento por fecha: al vencer, el link responde una página propia autocontenida con
  `noindex`. Borrar un enlace **arrastra su historial de clics**.

### feat(perfil): Mi perfil — la gestión de cuenta que le faltaba a `auth`

- [modules/functional/perfil.js](modules/functional/perfil.js) (nuevo, `usesAnime`,
  `requires: ['auth']`, sin colección propia: usa `users`).
- `/perfil.html` con cuatro operaciones reales: editar nombre y teléfono, **cambiar el email de
  acceso** (exige la contraseña actual, valida formato y rechaza el de otra cuenta con 409),
  **cambiar la contraseña** (exige la actual: tener la sesión abierta no alcanza para robar una
  cuenta; rechaza que la nueva sea igual a la vieja) y **darse de baja** confirmando con la clave.
- Como el JWT lleva adentro nombre, email y rol, **cada cambio devuelve un token nuevo** que el
  cliente guarda solo: la sesión sigue coherente sin obligar a volver a entrar.
- El **último administrador no se puede dar de baja** (409): es imposible dejar el sistema sin nadie
  que lo administre.
- Medidor de fuerza de contraseña animado con Anime.js (guía visual; la regla real la aplica el
  servidor) con red de seguridad para pestaña oculta.

### fix(auditoria): `db.insert(...).catch is not a function` — el driver JSON es síncrono

- Encontrado por la suite de tests, que **tiró abajo el servidor** en el primer PUT admin: el driver
  JSON (`src/db.js` local) inserta de forma **síncrona** y el de Supabase devuelve promesa. Como el
  registro se hace en un callback de evento (`res.on('finish')`) no se puede usar `await`, así que
  la llamada va envuelta en `Promise.resolve(...)` para que `.catch()` exista en los dos drivers.
  Es un riesgo latente para cualquier módulo futuro que escriba fuera de un handler `async`.

### Verificación

- **Registro**: 100 UI · **85 funcionales** = **185 módulos** (los 5 nuevos cargan con `usesAnime`).
- **3 variantes generadas + la de catálogo completo**: full (55 archivos / 31 JS), sin-auth (22 / 14),
  Vercel+Supabase (47 / 27, con las **7 colecciones nuevas** en `schema.sql`) y **todos los 185
  módulos juntos** (245 archivos, 121 JS, **4 middlewares conviviendo**: auditoria, escudo,
  mantenimiento y tareas). **0 errores de sintaxis** en los 193 JS, inlineado limpio, **0 emojis**.
- **Backend real** en Express 5 (:4990): **97 asserts en verde** — las 3 defensas del escudo con sus
  contadores y su exención de admin, los 6 trabajos del programador con idempotencia verificada
  (correr el saludo dos veces no saluda dos veces) y las tres vías de disparo (automático, manual y
  cron), la auditoría registrando lo rechazado e ignorando lo anónimo, la redirección 302 con
  passthrough de query y conteo por origen, y el ciclo completo de perfil (email, clave, baja y la
  protección del último admin). Más **11 asserts sin-auth** (:4989): el escudo frenando spam sin
  panel y el cron cerrado con 503.
- **Navegador real**: 5 paneles nuevos con **0 errores de consola**, `anime` y `Motion` cargados y
  conviviendo, bloqueo/desbloqueo de IP por UI persistido, trabajo apagado y reencendido por UI,
  enlace creado por UI con sus 2 clics contados y las 14 barras animadas, la auditoría capturando
  **esa misma alta hecha desde el navegador**, medidor de fuerza de clave y token renovado tras
  editar el perfil. Con sesión cerrada, los 5 links nuevos de la navbar quedan **ocultos**.
- **Sin módulos revertidos.**

## 2026-07-21 (31ª corrida)

> Lote de **5 módulos funcionales, todos con backend real**, elegidos por lo que le faltaba al
> catálogo para cubrir un sitio comercial completo: el **banner que todo cliente quiere editar solo**,
> el **formulario a medida** que ningún catálogo fijo puede anticipar, la **libreta de clientes**,
> el **"olvidé mi contraseña"** que le faltaba a `auth` desde siempre, y el **modo mantenimiento**.
> Además se cerró el **pendiente nº 1 de la 30ª**: el email al cliente (`mailer.notifyTo`).
> Verificación: **91 asserts de backend en verde** contra Express 5 real + **9 asserts sin-auth**,
> smoke test en navegador con **0 errores de consola**, y **2 bugs encontrados por los tests y
> corregidos** (uno de ruteo, uno de semántica de merge).

### feat(generador): contrato `middlewares` para módulos
- [src/registry.js](src/registry.js): se documenta el campo opcional `middlewares → [{file}]`.
- [src/templates.js](src/templates.js) — `appJs(cfg, mounts, middlewares)`: los middlewares que
  aportan los módulos se montan **antes de `express.static`**, a propósito: sin eso un módulo como
  `mantenimiento` sólo podría interceptar `/api/*` y las páginas HTML se seguirían sirviendo.
- [src/generator.js](src/generator.js): recolecta `m.middlewares` igual que `m.mounts` (acepta array
  o función de `cfg`) y se los pasa a `appJs`.

### feat(mailer): `notifyTo(to, subject, text)` — el email AL CLIENTE
- [modules/functional/mailer.js](modules/functional/mailer.js): `src/mailer.js` pasa a exportar
  `notifyTo`, la versión general que le escribe a **cualquier destinatario**; `notify` queda como el
  caso "al negocio" y se implementa sobre ella (conservando el mensaje de error cuando no hay
  destinatario configurado). Cierra el pendiente más viejo anotado por la 30ª: hasta ahora los 13
  módulos con avisos le escribían **solo al negocio**.

### feat(módulos): banner rotativo administrable
- [modules/functional/banners.js](modules/functional/banners.js) (`usesAnime`, colección `banners`):
  la franja del encabezado de la Home deja de estar horneada y pasa a ser un dato. `GET /api/banners`
  devuelve **sólo los publicados y vigentes**, ya ordenados (un banner de temporada se apaga solo el
  día que vence) y suma una **vista** por slide devuelto; `POST /:id/click` cuenta el clic con
  `keepalive` para que sobreviva a la navegación. El panel `/banners-admin.html` es el ABM con
  **CTR real por slide**, reordenamiento por intercambio de posición (sobrevive a órdenes repetidos)
  y estado calculado (vigente / programado / vencido / oculto). Los links y las imágenes se validan
  en el servidor: sólo rutas internas o `http(s)`, **nunca `javascript:`**. Rotación con fundido
  cruzado (Anime.js), pausa al hover, puntos de navegación y `prefers-reduced-motion`.

### feat(módulos): formularios a medida con bandeja de respuestas
- [modules/functional/formularios.js](modules/functional/formularios.js) (`usesAnime`, colecciones
  `forms` y `formentries`): el admin arma sus propios formularios (8 tipos de campo: texto, párrafo,
  email, teléfono, número, fecha, selección con opciones y sí/no) y quedan vivos en
  `/formularios.html?f=<slug>`. **La definición es el dato**: `POST /api/formularios/:slug` valida
  cada respuesta **contra la definición guardada** (obligatorios, tipo, largo y opciones permitidas),
  nunca contra el HTML que mandó el navegador — que cualquiera edita antes de enviar. El nombre
  técnico de cada campo lo calcula el servidor a partir de la etiqueta (con desambiguación:
  dos "Tu nombre" → `tu_nombre` y `tu_nombre_2`). El **slug no cambia al editar**, así los links ya
  repartidos siguen funcionando. **Campo trampa (honeypot)** invisible: el bot recibe 201 y nada se
  guarda, sin obligar a nadie a resolver un captcha. Bandeja por formulario con CSV.

### feat(módulos): ficha de clientes (CRM liviano)
- [modules/functional/clientes.js](modules/functional/clientes.js) (`usesAnime`, `requires: auth`,
  colección `customers`): ficha por persona con estado de seguimiento (nuevo → contactado → cliente /
  perdido) y **bitácora de notas fechadas y firmadas** por quien las escribió. El servidor calcula el
  embudo, ordena por último contacto y **busca sin acentos ni mayúsculas** sobre nombre, email,
  empresa y etiquetas (`fold()`, misma convención que `sitesearch`). `POST /admin/importar` trae los
  contactos que ya venían juntando `leads`, `newsletter` y `contact` **sin duplicar por email**. Con
  `mailer` activo, se le escribe al cliente desde su propia ficha y el envío queda anotado en la
  bitácora.

### feat(módulos): recuperar contraseña
- [modules/functional/recuperar.js](modules/functional/recuperar.js) (`usesAnime`,
  `requires: auth + mailer`, colección `resets`): el "olvidé mi contraseña" que le faltaba a `auth`.
  Token de **32 bytes de `crypto`, un solo uso, 60 minutos de vigencia**; cada pedido nuevo invalida
  los anteriores del mismo usuario y el cambio mata todos los vivos. El pedido responde **siempre lo
  mismo exista o no el email** (no se pueden enumerar usuarios). El link viaja **por email al
  usuario** vía `mailer.notifyTo`: sin `RESEND_API_KEY` queda igual en la bandeja de salida, así que
  el flujo **no depende de ninguna clave** para funcionar. El link "¿Olvidaste tu contraseña?" se
  **inyecta en el formulario de login sin tocar el módulo `auth`**. La barra de fuerza de la
  contraseña anima `transform: scaleX` (no `width`): sin layout thrash.

### feat(módulos): modo mantenimiento
- [modules/functional/mantenimiento.js](modules/functional/mantenimiento.js) (`usesAnime`, colección
  `maintenance`, **primer módulo que usa el contrato `middlewares`**): interruptor real para bajar el
  sitio. El middleware responde **503 + `Retry-After: 3600`** con una pantalla propia y autocontenida
  (sin CSS ni JS externos, porque el propio middleware podría estar bloqueando los estáticos), con
  título, mensaje y fecha de vuelta editables. Google lee el 503 como caída temporal y no desindexa.
  El admin sigue navegando con un **link de acceso** (`?acceso=<clave>` → cookie de 24 h, clave
  rotable); `/auth.html`, `/mantenimiento-admin.html` y los estáticos **nunca se bloquean**: es
  imposible quedar afuera del sistema. El servidor cuenta las visitas frenadas.

### fix(formularios): las rutas `/:slug` tapaban `POST /admin`
- Encontrado por los tests: `router.post('/:slug')` declarado antes del bloque admin capturaba
  `POST /api/formularios/admin` con `slug = "admin"` y el alta de formularios devolvía
  *"Ese formulario no existe"*. Las rutas con `:slug` se movieron **al final del router**, con el
  comentario que explica por qué no pueden volver a subir.

### fix(clientes): el alta idempotente pisaba con vacío los datos ya cargados
- Encontrado por los tests: cargar de nuevo a alguien por su email corría `db.update` con el payload
  limpio completo y **borraba** teléfono, empresa y etiquetas que ya estaban. Ahora el merge sólo
  pisa los campos **que vinieron con algo**; para vaciar un campo está el editar.

### test: suite de backend real del lote
- **91 asserts en verde** contra el proyecto generado corriendo en Express 5 (:4996): filtro por
  vigencia y CTR de `banners`, rechazo de `javascript:` y tope del reordenamiento (409); las 5 formas
  de respuesta inválida de `formularios` más el honeypot y la unicidad de slugs; merge, búsqueda,
  embudo e importación sin duplicados de `clientes`; el ciclo completo de `recuperar` (token de un
  solo uso, invalidación en cadena, respuesta indistinguible, la clave vieja que deja de entrar); y
  el ciclo de `mantenimiento` (503 con `Retry-After`, login siempre abierto, cookie de acceso,
  cookie robada rechazada, rotación de clave que invalida las viejas). Más **9 asserts sin-auth**
  (:4995) confirmando que sin `auth` no se genera ninguna ruta de administración.
- **Generación**: 180 módulos registrados (100 UI · 80 funcionales); 3 variantes verificadas —
  full = 230 archivos / 109 JS, sin-auth = 19 / 10, Vercel+Supabase = 43 / 21 con las **6 colecciones
  nuevas** en `schema.sql`. **0 errores de sintaxis** en los 109 JS, 0 emojis en el output.
- **Smoke test en navegador real**: respuesta a un formulario a medida enviada por UI y verificada en
  disco; banner rotando; ficha del CRM con su bitácora; interruptor de mantenimiento bajando y
  publicando el sitio por UI (503 ↔ 200). **Cero errores de consola.**

## 2026-07-20 (modernización de UI con la Design Library)

> Pedido del usuario: modernizar la UI del Builder y de **todos los módulos de las páginas
> generadas** usando la skill **Design Library**, "con criterio de cuándo dejarlo como está y
> cuándo mejorarlo", siempre con **Phosphor icons**, **Montserrat por default** y **cero emojis**.
> Resultado: **0 emojis en todo el output renderizado** (175 módulos, 217 archivos, 105 JS sin
> errores de sintaxis), Montserrat como tipografía por defecto de los sitios generados, y el
> sistema base de las generadas modernizado. El **Builder no se tocó**: ya estaba en Montserrat,
> con Phosphor y sin emojis, y su DESIGN.md ("La Mesa de Trazado") rechaza explícitamente los
> componentes decorativos del catálogo — preservarlo *era* la decisión correcta.

### feat(icons): 16 iconos Phosphor nuevos vendorizados
- [src/icons.js](src/icons.js): se extrajeron de `@phosphor-icons/core` (peso *regular*, y *fill*
  para `heart-fill`) y se sumaron al mapa `PATHS`: `moon`, `sun`, `device-mobile`, `lock`,
  `chart-line-up`, `thumbs-up`, `thumbs-down`, `confetti`, `plus`, `paper-plane-tilt`, `heart`,
  `heart-fill`, `download-simple`, `stack`, `circle-half`, `wheelchair`. Catálogo: **36 → 52
  iconos**. Verificado path por path contra el paquete (el de `heart-fill` se comparó byte a byte).

### feat(generadas): sistema base modernizado (levanta los 175 módulos a la vez)
- [src/templates.js](src/templates.js) — `stylesCss()`:
  - **Subrayado animado en los links de navegación** (adaptación de **Skiper UI `skiper40`**, CSS
    puro): un `::after` de 2px que entra con `scaleX` y **flip de origen** (`right` en hover,
    `left` en el link activo), con `cubic-bezier(0.4, 0, 0.2, 1)` bajo
    `prefers-reduced-motion: no-preference`. Excluye el toggle de tema y cualquier `a.nav-icon`.
  - **Foco visible por teclado** (`:focus-visible`) en links, botones, `[role=button]`, `summary` y
    `[tabindex]`: anillo de acento con `outline-offset`. Los inputs conservan su propio anillo.
  - `.btn` pasa a `inline-flex` con `gap` (para que un ícono + texto quede alineado sin hacks) y
    `.btn.ghost:hover` ahora **se rellena** con el acento en vez de sólo bajar el brillo.
  - `scroll-behavior: smooth` bajo la guarda de movimiento reducido.
- [src/templates.js](src/templates.js) — `layout()`: los items de navegación aceptan **`html: true`**
  (el label es markup confiable del módulo —un ícono horneado—, no dato de usuario, así que no se
  escapa) e **`icon: true`** (agrega la clase `nav-icon`). Reutilizable por cualquier módulo que
  quiera un ícono en la navbar.
- [src/generator.js](src/generator.js): **`DEFAULTS.brand.font` pasa de `sistema` a `montserrat`**.
  Los sitios generados salen con Montserrat por defecto (vía Google Fonts, ya cableado en
  `fontHead()`); las stacks del sistema siguen elegibles en el Builder como opt-out.

### feat(darkmode): toggle sol/luna animado, sin emoji
- [modules/ui/darkmode.js](modules/ui/darkmode.js): reescrito. El `🌙`/`☀️` de la navbar y del
  `textContent` se reemplazó por **iconos Phosphor horneados** (`moon`/`sun`) que se alternan con
  una animación de **rotación + escala** (Anime.js, `outBack`, adaptación de **`skiper26`**) con la
  **red de seguridad** `setTimeout` de la casa (pestaña oculta) y respeto a `prefers-reduced-motion`.
  Declara `usesAnime`, usa el nuevo `html/icon` de la navbar y suma su propio `head()` con el estilo
  del botón (circular, hover de acento).

### fix(sin emojis): 64 → 0 emojis renderizados en 30 módulos
Reemplazo de **todo glifo pictográfico** que llegaba al usuario por su ícono Phosphor horneado,
preservando comportamiento, tamaños, `aria-label` y animaciones. Los `→ ← ↑ ↓` que viven en
**comentarios de código** se conservaron: son notación, no emojis.
- **Iconos de feature (el upgrade de más craft)** — el dato pasó de emoji a *nombre de ícono* y el
  render a `phIcon(...)`: [features.js](modules/ui/features.js) (`lightning`/`lock`/`chart-line-up`,
  64px), [flipcards.js](modules/ui/flipcards.js) (`lightning`/`target`/`handshake`/`shield-check`,
  38px), [bento.js](modules/ui/bento.js) (`stack`/`lightning`/`lock`/`chat-circle-dots`, 26px),
  [appbadges.js](modules/ui/appbadges.js) (`device-mobile`, 64px). Se sacaron los `font-size` que
  dimensionaban el emoji (ahora el tamaño lo da el SVG).
- **UI**: `a11y` (`♿`→`wheelchair`), `commandpalette` (`🔍`→`magnifying-glass`; los hints de teclado
  `↑↓ ↵ ⌘` se conservan por ser convención), `events` (`🕒📍`→`clock`/`map-pin`), `resources`
  (`↓`→`download-simple`), `socialfeed` (`♥`→`heart-fill`), `hours` (el `●` de estado pasó a ser un
  **punto CSS** que hereda el color abierto/cerrado, sin glifo).
- **Funcionales**: `favorites` (`♥♡`), `albums`, `chatbot` (`💬✕➤`→`chat-circle-dots`/`x`/
  `paper-plane-tilt`), `feedback` (`👍👎`→`thumbs-up`/`thumbs-down`), `loyalty` (`★`→`star-fill`,
  `🎉`→`confetti`), `raffle`, `referrals` (`👋`→`handshake`), `visits` (`✔◐✕`), `inventory` (`↑↓`),
  `ordertrack` (`➕✓`), `pedidoscarta`, `pos`, `repositores`, `restock`, `returns`, `callback`,
  `cursos`, `donations`, `leadmagnet`, `usertestimonials`, `eventregister` (`📍`), `blogcms` y
  `listings` (`←`→`arrow-left`).
- **Detalle de criterio**: en `loyalty` el `🎉` de un **toast** se eliminó en vez de reemplazarse —
  `App.toast()` usa `textContent`, así que un SVG se vería como markup crudo. Los labels de
  `visits`/`inventory` sí admiten SVG porque van al `render:` de `App.table()`, que inserta HTML.
- **Terminal y comentarios**: los `⚠` de `console.warn` y el `▶` del mensaje de arranque en
  [templates.js](src/templates.js) pasaron a texto (`[aviso]`, `->`), y los `⚠ ACCIÓN REQUERIDA` de
  `whatsapp`/`whatsappform`/`contactbar` a `IMPORTANTE — ACCIÓN REQUERIDA`.

### Criterio aplicado: qué NO se tocó
La base ya venía muy pulida de 30 corridas. Se **preservó** deliberadamente: el `carousel` (slide
limpio con flechas/puntos/autoplay), el módulo `reveal` (cascada del hero + reveal al scroll con
Motion y red de seguridad), la `gallery` (hover de lift + scale + pop del ícono) y el **spring
firma** `cubic-bezier(0.34, 1.56, 0.64, 1)` de botones y cards. Portar coverflow/card-stack de
React+Swiper+GSAP sobre implementaciones vanilla que ya funcionan bien habría sido *churn* riesgoso,
no modernización. El hook de diseño marca ese spring como "dated": es la identidad de movimiento del
proyecto, elegida y reafirmada; se deja como está.

### test
- **Verificador nuevo** que genera un proyecto con **los 175 módulos** (100 UI + 75 funcionales) y
  escanea el **output renderizado** (HTML + `app.js` + CSS), no sólo el fuente: **217 archivos, 105
  JS, 0 errores de sintaxis, 0 emojis**. Partió de 64 emojis y se cerró en 0 en pasadas sucesivas
  (64 → 10 → 7 → 4 → 1 → 0; el barrido por dedupe iba destapando casos nuevos como `pedidoscarta`,
  `pos`, `raffle`, `repositores`, `restock` y `returns`, que no estaban en el inventario inicial).
- **Smoke test en navegador real** (:4999) con 18 módulos visuales: **cero errores de consola**,
  `Montserrat` efectivamente aplicada y cargada (`document.fonts.check` → true), **0 emojis en
  `body.innerText`**, 36 iconos Phosphor en la página, y **ningún ícono colapsado ni desbordado**
  (feature 64px, flip 38px, bento 26px, toggle 20px, corazón 14px; `feature-media` conservó sus
  200px de alto y `.flip` sus 210px). **Toggle de tema por UI**: `dark → light`, `aria-label`
  actualizado y la animación asienta en `opacity 1 / transform none` (red de seguridad OK).
  Subrayado de nav con `height 2px` y `transition 0.3s`.
- Nota de proceso: el fan-out en Workflow (10 agentes) **falló entero por límite de sesión**; el
  barrido se rehízo inline con un script de sustituciones auditable + correcciones puntuales.

## 2026-07-20 (30ª corrida)

> Lote de **5 módulos funcionales con backend real**: `cumples` (nuevo de esta corrida) más la
> **adopción de 4 módulos huérfanos** — `alquileres`, `pagoinformado`, `campanas` y `caja` — que
> una sesión anterior del mismo día dejó escritos (15:15–15:20) pero **sin probar y sin bitácora**
> (la sesión se cortó ahí). Esta corrida los revisó contra el patrón de la casa, los probó a fondo
> y los documenta acá. Además se cerró el **pendiente número 1 de la 29ª**: el hook de avisos por
> email en 7 módulos más (`tickets`, `quote`, `agenda`, `reservamesa`, `pedidoscarta`, `cart` y
> los ya integrados quedan igual), y `videos` + `alquileres` entraron como fuentes del buscador
> global. **Dos bugs de generación encontrados y corregidos por los tests.** Catálogo: **100 UI ·
> 75 funcionales = 175 módulos**.

### feat(functional/cumples): club de cumpleaños (módulo nuevo de esta corrida)
- [modules/functional/cumples.js](modules/functional/cumples.js): módulo nuevo, `usesAnime`,
  colección `birthdays`, mount `/api/cumples`. Sección pública en la Home: el visitante se anota
  con nombre, email y fecha de nacimiento para recibir un beneficio en su día. El alta es
  **idempotente por email** (re-anotarse actualiza nombre y fecha, jamás duplica — verificado con
  email en mayúsculas) y la fecha se valida en el server (formato + no futura → 422). Con `auth`:
  `/cumples-admin.html` con KPIs count-up (total, cumplen hoy, semana, 30 días), lista ordenada
  por **días para el cumple calculados SIEMPRE en el servidor** (solo mes y día — el año no se
  muestra en la tabla; 29/2 cae 1/3 en años no bisiestos vía desborde natural de `Date.UTC`),
  chips "¡Cumple hoy!" / "En N días", filtro por próximos, CSV y baja. Con `mailer`: cada alta
  avisa al negocio. Distinto de `loyalty` (sellos) y `leads` (captación genérica).

### feat(functional): adopción verificada de los 4 módulos de la sesión cortada
Los 4 siguen el patrón de la casa (público+admin-por-`auth`, `requireAdmin` con 401/403, anti-XSS
de URLs, Anime.js con red de seguridad, navbar oculta para no-admin) y pasaron la suite completa:
- [modules/functional/alquileres.js](modules/functional/alquileres.js): **Alquileres por día** —
  `/alquileres.html` con recursos sembrados (cabaña, salón), reserva por rango de fechas con
  **control de solapamiento en el server** (409, y cancelar libera las fechas — ambas cosas
  verificadas), total = días × precio calculado en el server, código `AL-`, rango máximo 60 días,
  fechas ocupadas visibles antes de reservar. Admin: ABM de recursos (borrar arrastra sus
  reservas — verificado) y bandeja de reservas. Colecciones `rentitems`/`rentbookings`.
- [modules/functional/pagoinformado.js](modules/functional/pagoinformado.js): **Informar pago por
  transferencia** — `/informar-pago.html` publica los datos bancarios (ficha `paymentinfo`
  editable sin regenerar; CBU de 22 dígitos validado) y el cliente informa su transferencia
  (comprobante por URL solo http/https — `javascript:` descartado, verificado) con código `PG-`
  para consultar el estado. Admin: conciliación aprobar/rechazar con KPIs y CSV. Con `mailer`
  avisa cada pago informado.
- [modules/functional/campanas.js](modules/functional/campanas.js): **Campañas de email** —
  requiere `mailer`+`newsletter`+`auth` (dependencias en cadena resueltas por el Builder). El
  negocio redacta, **prueba consigo** y envía a todos los suscriptores: una fila real en `outbox`
  por destinatario (sin clave quedan registradas; con `RESEND_API_KEY` salen de verdad). Campaña
  enviada queda **sellada** (editar/reenviar → 409, verificado); enviar sin suscriptores → 409.
- [modules/functional/caja.js](modules/functional/caja.js): **Caja diaria** — requiere `auth`,
  panel solo-admin con ingresos/egresos por medio de pago, totales SIEMPRE del server, **cierre de
  caja que sella el día** (movimiento nuevo, borrado o re-cierre sobre día cerrado → 409, todo
  verificado), historial de cierres y CSV. Colecciones `cashmoves`/`cashclosures`.

### feat(mailer): hook de avisos en 7 módulos más (cierra el pendiente nº 1 de la 29ª)
- [modules/functional/tickets.js](modules/functional/tickets.js), [modules/ui/quote.js](modules/ui/quote.js),
  [modules/functional/returns.js](modules/functional/returns.js), [modules/functional/agenda.js](modules/functional/agenda.js),
  [modules/functional/reservamesa.js](modules/functional/reservamesa.js), [modules/functional/pedidoscarta.js](modules/functional/pedidoscarta.js),
  [modules/functional/cart.js](modules/functional/cart.js): hook condicional (`solo si mailer está
  activo`) tras cada alta pública — reclamo, pedido de presupuesto, solicitud de devolución/cambio,
  turno (con nombre de profesional y servicio resueltos), reserva de mesa (con etiqueta del turno),
  comanda (con renglones y total) y pedido web del carrito (con nombre/email del token). Todos
  "disparar y seguir" (`.catch(() => {})`): un email caído jamás rompe el alta. Con esto avisan
  **10 módulos** (los 7 + `vacantes`/`callback`/`profesionales` de la 29ª) más `alquileres`,
  `pagoinformado` y `cumples` que ya venían con su hook.
- **Bug de generación encontrado por los tests y corregido**: en `cart.js` el `require` del mailer
  se emitía en `routes/products.js` pero el `notify` quedaba en `routes/orders.js` →
  `ReferenceError: mailer is not defined` al hacer checkout (crasheaba el server generado). El
  require se movió al archivo correcto y el checkout quedó verificado con su aviso en la bandeja.
- **Bug de generación encontrado y corregido**: `quote.js` declaraba `files: () =>` sin recibir
  `cfg` → `ReferenceError: cfg is not defined` al generar cualquier proyecto con `quote` activo.
  Ahora `files: (cfg) =>` como el resto del catálogo.

### feat(sitesearch): fuentes nuevas videos y alquileres
- [modules/functional/sitesearch.js](modules/functional/sitesearch.js): `FUENTES_POSIBLES` suma
  `videos` (título/categoría → `/videos.html`) — la línea que la 29ª dejó anotada — y
  `alquileres` (nombre/descripción → `/alquileres.html`). Verificado: "bunny" encuentra el video
  sembrado y "cabana" (sin acento) encuentra la Cabaña vía `fold()`.

### test: 3 variantes generadas, 91 asserts y smoke test en navegador
- Variantes con el lote completo: **full** (hero + reveal/Motion + auth + mailer + newsletter +
  tickets + quote + agenda + reservamesa + menu + pedidoscarta + cart + sitesearch + videos +
  los-5 = 68 archivos, 35 JS, con Anime y Motion conviviendo y las 7 páginas nuevas), **sin-auth**
  (21 archivos, 11 JS: partes públicas sin ningún panel ni endpoint admin) y **Vercel+Supabase**
  (44 archivos, 23 JS, con las 8 colecciones nuevas — `rentitems`, `rentbookings`, `paymentinfo`,
  `paymentreports`, `campaigns`, `cashmoves`, `cashclosures`, `birthdays` — en `schema.sql`).
  Syntax-check con `vm.Script` de los **69 JS** de las tres variantes: 0 errores; inlineado seguro
  (0 `</script>`/`</style>` en `app.js`).
- **Prueba de backend real** sirviendo la variante full en Express (:4997): **79 asserts en
  verde** (alquileres 16, pagoinformado 14, campañas 9, caja 11, cumples 10, hooks de mailer 14 —
  los 10 asuntos esperados presentes en la bandeja —, sitesearch 2, setup 2, más 401/403 por
  panel). **12 asserts sin-auth** (:4998): públicos OK, endpoints admin inexistentes (404),
  persistencia en `data/*.json` y rutas generadas sin rastro de mailer.
- **Smoke test en navegador real**: cero errores de consola en Home + `/alquileres.html` +
  `/informar-pago.html` + los 5 paneles admin. Por UI: alta al club (caja de éxito animada con red
  de seguridad → opacidad 1), reserva de alquiler completa (total $170.000 con count-up, código
  `AL-EOTYLY` visible después en la bandeja admin), ficha bancaria editada por API precargada en
  el panel y reflejada en la página pública, caja cerrada deshabilitando el form, filtro de
  próximos cumpleaños. Los 5 links admin nuevos **ocultos** para el anónimo y visibles tras login
  admin. Sin módulos revertidos.

## 2026-07-20 (29ª corrida)

> Lote de **4 módulos funcionales nuevos con backend real** (`mailer`, `respaldo`, `notifcentro`,
> `videos`) — según la directiva de no sumar funcionalidad sin backend. Los 4 usan **Anime.js**
> (`usesAnime`) con red de seguridad `setTimeout` y respetan `prefers-reduced-motion`. El foco fue
> la **operación del negocio**: cerrar el pendiente más viejo del proyecto (email transaccional,
> anotado desde la 19ª) con una bandeja de salida que funciona sin API key y envía de verdad con
> Resend si se carga la clave; darle al admin **una campanita con TODOS los pendientes** del sitio
> en un solo lugar; la **copia de seguridad** completa con restauración (la pieza de tranquilidad
> antes de operar en serio); y la **videoteca administrable** con reproducciones reales. Patrón
> público+admin-por-`auth` con `requireAdmin` (endpoints admin **401 sin token**, **403 con token
> no-admin**) y navbar oculta para no-admin. Ninguno se revirtió. Catálogo: **100 UI · 70
> funcionales = 170 módulos**.

### feat(functional/mailer): avisos por email con bandeja de salida real (cierra el pendiente de email transaccional)
- [modules/functional/mailer.js](modules/functional/mailer.js): módulo nuevo, `usesAnime`,
  colección `outbox`, mount `/api/mailer`, env `RESEND_API_KEY` (opcional) / `MAIL_TO` /
  `MAIL_FROM`. Genera `src/mailer.js` en el proyecto exportado: `mailer.notify(asunto, texto)`
  registra SIEMPRE el aviso en la bandeja (estado `registrado`) y, si hay `RESEND_API_KEY`
  (resend.com, free tier), lo envía de verdad vía `fetch` a la API de Resend (estado `enviado` /
  `error` con el detalle). **Nunca lanza**: un email caído jamás rompe el alta que lo disparó
  (disparar-y-seguir con `.catch(() => {})` en los llamadores). El **destinatario** sale del email
  de la ficha del negocio (colección `bizinfo`, si el módulo `negocio` está activo) con fallback a
  `MAIL_TO`; sin destinatario, la fila lo avisa en su campo `error`. Con `auth`:
  `/emails-admin.html` con aviso de configuración vigente (envío activo/apagado + destinatario),
  4 KPIs count-up, tabla con filtro por estado, **reenviar** (409 si no hay clave), **email de
  prueba**, borrar y CSV. Sin `auth` no hay panel pero el registro sigue (headless, verificado).
- [modules/functional/vacantes.js](modules/functional/vacantes.js): hook condicional (solo si
  `mailer` está activo) tras el alta de postulación: `mailer.notify('Nueva postulación: …')`.
- [modules/functional/callback.js](modules/functional/callback.js): hook condicional tras el
  pedido de llamada: `mailer.notify('Nuevo pedido de llamada', … franja + motivo)`.
- [modules/functional/profesionales.js](modules/functional/profesionales.js): hook condicional
  tras la consulta a un profesional: `mailer.notify('Nueva consulta para <nombre>', …)`.
- **Bug encontrado y corregido en el smoke test**: el link "Emails (admin)" de la navbar quedaba
  visible para el visitante anónimo en las páginas que no son el panel (el `return` temprano de
  "no estamos en el panel" cortaba antes de ocultarlo). El ocultamiento se movió arriba del corte.

### feat(functional/respaldo): copia de seguridad completa con restauración
- [modules/functional/respaldo.js](modules/functional/respaldo.js): módulo nuevo, `usesAnime`,
  `requires: ['auth']`, colección `backuplog`, mount `/api/respaldo`. Las colecciones a respaldar
  las **resuelve el Builder al generar** (`cfg.collections`, excluyendo `backuplog`).
  `GET /admin/export` descarga un JSON `{version: 1, generatedAt, collections}` con TODO;
  `POST /admin/import` lo restaura **preservando ids y fechas** (las referencias cruzadas tipo
  `openingId` no se rompen), validando versión, colecciones conocidas y filas objeto (422 si no).
  El archivo de restauración viaja como **octet-stream crudo hasta 20 MB** (mismo truco que
  `uploads` para esquivar el límite del `express.json` global). Cada operación queda en el
  historial. Panel `/respaldo-admin.html`: KPI por colección con count-up y stagger, descarga por
  blob con token, restauración con **doble confirm**, historial. README avisa que la copia incluye
  `users` (hashes) y es confidencial.
- [src/templates.js](src/templates.js): método nuevo `restore(n, rows)` en **ambos drivers** de
  datos con la misma interfaz — JSON: reescribe el archivo preservando id/createdAt (generándolos
  solo si faltan); Supabase: `DELETE` con filtro que matchea todo (PostgREST exige filtro) +
  inserción en tandas de 200 con `id`/`created_at` originales. Comentario de interfaz actualizado.

### feat(functional/notifcentro): centro de novedades del admin (campanita con pendientes reales)
- [modules/functional/notifcentro.js](modules/functional/notifcentro.js): módulo nuevo,
  `usesAnime`, `requires: ['auth']`, mount `/api/notifs`, sin colecciones propias (lee las de los
  demás). Tabla `FUENTES_POSIBLES` con **13 fuentes de pendientes** que el Builder resuelve al
  generar según los módulos activos (mismo patrón que `sitesearch`): postulaciones nuevas
  (`vacantes`), llamadas pendientes (`callback`), testimonios por moderar (`usertestimonials`),
  presupuestos sin cotizar (`quotesadmin`, con default `nuevo` para filas viejas), postulaciones
  del form estático (`jobsadmin`), devoluciones solicitadas (`returns`), reservas de mesa y turnos
  por confirmar (`reservamesa`/`agenda`), preguntas sin responder (`qanda`, filtro negado),
  chat sin leer (`livechat`, filtro compuesto `from=visitor && !seen`), reclamos abiertos
  (`tickets`), consultas a profesionales (`profesionales`) y comandas recibidas (`pedidoscarta`).
  `GET /admin/summary` devuelve total + desglose con href al panel de cada fuente. En la navbar,
  el link **"Novedades" con badge** (soporte `badge` que el layout ya traía) solo para admins, con
  **sondeo liviano cada 60 s** (solo pestaña visible) y **pulso de Anime.js cuando el total sube**.
  `/novedades-admin.html` desglosa cada fuente como tarjeta-enlace con count-up y stagger
  ("Atender ahora" si hay pendientes). El total **baja solo** al atender cada bandeja (verificado:
  marcar una llamada como contactada lo descuenta).

### feat(functional/videos): galería de videos administrable con reproducciones reales
- [modules/functional/videos.js](modules/functional/videos.js): módulo nuevo, `usesAnime`,
  colección `videos`, mount `/api/videos`. Los videos se cargan **pegando la URL de YouTube o
  Vimeo**: el server extrae y valida el ID (`[A-Za-z0-9_-]{6,20}` / dígitos) y el embed se
  construye SIEMPRE desde ese ID — `javascript:` y cualquier otra URL → 422 (anti-XSS de raíz).
  Página pública `/videos.html`: chips de categoría, tarjetas con stagger y **click-to-play**
  (ningún iframe ni request a terceros hasta dar play; se usa `youtube-nocookie` / player de
  Vimeo), `POST /:id/play` cuenta cada **reproducción real** (404 sobre ocultos). Con `auth`: ABM
  `/videos-admin.html` (título, categoría con datalist, URL, publicar/ocultar, borrar) con las
  reproducciones por video. Se siembran 2 cortos abiertos de Blender. Distinto de `video` (UI: un
  único video fijo en la Home).

### Pruebas (29ª)
- 3 variantes generadas con `vm.Script`: **full** (hero + reveal/Motion + auth + negocio +
  vacantes + callback + profesionales + usertestimonials + qanda + livechat + los-4) = 51
  archivos, 26 JS, 20 páginas, con Anime y Motion conviviendo; **sin-auth** (hero + vacantes +
  mailer + videos) = 20 archivos, 11 JS, sin ninguna página ni endpoint admin; **Vercel+Supabase**
  = 45 archivos, 22 JS, con las 3 colecciones nuevas (`outbox`, `backuplog`, `videos`) en
  `schema.sql`. Syntax-check de los **59 JS** de las tres variantes: 0 errores; inlineado seguro
  (0 `</script>`/`</style>` en `app.js`).
- **Backend real** (Express, variante full): **54 asserts en verde** — videos (2 sembrados,
  payload sin campos internos, play +1, oculto invisible y 404 al play, youtu.be/vimeo parseados,
  `javascript:` 422, 401/403); mailer (envío apagado sin clave, destino desde la ficha del
  negocio, 3 avisos por las 3 integraciones + prueba, reenviar sin clave 409, borrar, 401/403);
  notifcentro (401/403, cuenta postulación+llamada+consulta, **el total baja al atender**);
  respaldo (conteos, export v1 completo, borrado simulado + **restauración con ids preservados**,
  archivo inválido 422, copia ajena 422, historial, 401). Variante sin-auth: **10 asserts** —
  público OK, endpoints admin inexistentes (404), **el mailer registra headless** en
  `data/outbox.json` avisando que falta destinatario, sin links ni páginas admin.
- **Smoke test en navegador real**: cero errores de consola en `/videos.html` + los 3 paneles;
  `anime` y `Motion` cargados; click-to-play por UI (iframe `youtube-nocookie` recién al click,
  contador 1→2 persistido); login admin → campanita "Novedades 2" con badge, desglose de 6
  fuentes con counts reales; bandeja de emails con los 3 avisos de las integraciones y el
  destinatario de la ficha del negocio; respaldo con 12 colecciones/19 registros y **export por
  UI** (toast + historial). Los links admin nuevos ocultos para el anónimo (verificado tras el fix).

## 2026-07-20 (28ª corrida)

> Lote de **4 módulos funcionales nuevos con backend real** (`pedidoscarta`, `listaprecios`,
> `textos`, `fila`) — según la directiva de no sumar funcionalidad sin backend. Los 4 usan
> **Anime.js** (`usesAnime`) con red de seguridad `setTimeout` y respetan `prefers-reduced-motion`.
> El foco fue **completar flujos comerciales de punta a punta**: la carta gastronómica ahora VENDE
> (pedidos take-away/delivery armados por el visitante, con total recalculado en el server y
> seguimiento en vivo), la lista de precios se actualiza con un **aumento masivo por porcentaje**
> (el pedido clásico de la inflación argentina), los **textos del sitio se editan en vivo** sin
> regenerar (el pedido n.º 1 de cualquier cliente real) y la **fila virtual** trae el turnero de
> mostrador por orden de llegada. Patrón público+admin-por-`auth` con `requireAdmin` (endpoints
> admin **401 sin token**, **403 con token no-admin**) y navbar oculta para no-admin. Ninguno se
> revirtió. Catálogo: **100 UI · 66 funcionales = 166 módulos**.

### feat(functional/pedidoscarta): pedidos take-away/delivery armados desde la carta
- [modules/functional/pedidoscarta.js](modules/functional/pedidoscarta.js): módulo nuevo,
  `usesAnime`, `requires: ['menu']`, colección `foodorders`, mount `/api/pedidoscarta`. En
  `/carta.html` cada plato disponible recibe un botón **"Agregar" / stepper − n +** (inyectado por
  `MutationObserver` sobre `#mn-list`, sobrevive al re-render del buscador de la carta), con
  **barra flotante** (ítems · total — Hacer pedido) y panel de confirmación (nombre, teléfono,
  retiro/delivery con dirección obligatoria solo en delivery, aclaraciones, carrito editable en
  `localStorage` `pc-cart` purgado de platos no disponibles). `POST /` valida cada renglón contra
  `menuitems` (existente y `available`, qty 1–99, máx. 40 renglones) y **recalcula el total SIEMPRE
  con los precios del backend**; devuelve código `PC-XXXXXX`. Seguimiento público en
  `/mi-pedido.html` (`GET /track/:code`, sin exponer el teléfono): línea de progreso Recibido → En
  preparación → Listo → Entregado (misma técnica visual que `ordertrack`), auto-consulta con
  `?code=` y **sondeo cada 8 s** mientras siga en curso, con toast al avanzar. Con `auth`:
  `/comandas.html` (tablero de cocina) con KPIs count-up (en curso, listos, total del día), avance
  de estado con un click (`SIG`), cancelar, borrar, filtro, CSV y refresco cada 20 s. Estados
  inválidos → 422. Distinto de `ordertrack` (códigos cargados a mano), `cart` (e-commerce) y `menu`.
- [modules/functional/menu.js](modules/functional/menu.js): el render público de la carta ahora
  emite `data-plato="<id>"` en cada `.mn-item` (una línea, con comentario) para que `pedidoscarta`
  enganche sus controles por plato. Sin cambios de comportamiento si `pedidoscarta` no está activo.

### feat(functional/listaprecios): lista de precios administrable con aumento masivo
- [modules/functional/listaprecios.js](modules/functional/listaprecios.js): módulo nuevo,
  `usesAnime`, colección `pricelist`, mount `/api/listaprecios`. Página pública `/precios.html`:
  ítems publicados agrupados por categoría (unidad opcional "por hora / por kg", precio alineado,
  mismo lenguaje visual que la carta), **buscador que filtra en el servidor con plegado de
  acentos** (`fold()` local: "diagnostico" encuentra "diagnóstico") y leyenda **"Precios
  actualizados al DD de MES de AAAA"** calculada con el `updatedAt`/`createdAt` más nuevo real.
  Con `auth`: ABM en `/precios-admin.html` (crear, editar, publicar/ocultar, borrar, datalist de
  categorías) + tarjeta de **aumento masivo**: `POST /admin/bulk {percent, category?}` aplica el
  porcentaje (−90 a 1000, ≠ 0, negativo = baja) a toda la lista o a una categoría, redondeando a
  pesos enteros en el server; el panel muestra un **aviso en vivo** de cuántos ítems toca, pide
  `confirm` y anima el **count-up del precio viejo al nuevo** en las filas que cambiaron. Se
  siembran 6 ítems. Categoría inexistente o porcentaje 0 → 422. Distinto de `pricing` (UI),
  `menu` y `products-admin`.
- [modules/functional/sitesearch.js](modules/functional/sitesearch.js): `listaprecios` sumado a
  `FUENTES_POSIBLES` (una línea): el buscador global ahora encuentra ítems de la lista de precios
  por nombre/categoría/unidad y linkea a `/precios.html`.

### feat(functional/textos): textos del sitio editables en vivo (mini-CMS)
- [modules/functional/textos.js](modules/functional/textos.js): módulo nuevo, `usesAnime`,
  colección `sitetexts` (ficha única **sembrada con los `cfg.texts` del Builder** al generar),
  mount `/api/textos`. `GET /` es público y el cliente **inyecta los textos sobre el HTML
  generado** al cargar cada página: `heroTitle`/`heroSubtitle`/`heroCta` sobre `.hero .container`
  (si el hero está en la página) y el párrafo de "Nosotros" buscando el `h2` que empieza con
  "Sobre " (cubre `/about.html` y el fallback de la Home), con fundido sutil de Anime.js solo si
  el texto difiere del horneado. **Override por campo**: un campo vacío conserva el texto original
  del HTML. Con `auth`: `PUT /` (por campo, largos máximos 120/220/40/600 → 422) y panel
  `/textos-admin.html`. En la vista previa del Builder NO se inyecta nada (los textos ya vienen de
  la config en vivo). Es el "¿puedo cambiar el texto yo solo?" resuelto sin regenerar ni redeployar.
  Distinto de `blogcms` (contenido nuevo) y `negocio` (ficha institucional del pie).

### feat(functional/fila): fila virtual / turnero de mostrador
- [modules/functional/fila.js](modules/functional/fila.js): módulo nuevo, `usesAnime`, colección
  `queueturns`, mount `/api/fila`. **Numeración diaria** (arranca en 1 cada día, campo `day`).
  `POST /` saca número (nombre 2–60 obligatorio, teléfono opcional) y devuelve `{number, secret,
  ahead}`: el **secreto por turno** es la llave para consultar (`GET /turno/:id?secret=`, 404 si no
  coincide o venció el día) y para **cancelar el propio turno** (`DELETE`, solo en estado
  `esperando`; ya llamado → 422). `GET /estado` público: `nowServing` (último llamado del día),
  `waiting`, `lastNumber`. En `/fila.html`: sacar número, seguimiento con **sondeo cada 5 s** que
  solo repinta si algo cambió, aviso **"¡Es tu turno!"** con la tarjeta destacada y el **título de
  la pestaña** actualizado (`#N · atienden M`), estados atendido/ausente con salida limpia, y
  persistencia del turno en `localStorage` `fv-turno`. Con `auth`: `/fila-admin.html` (mostrador)
  con el número en atención bien grande, **"Llamar al siguiente"** (`POST /admin/next`, toma el
  menor número esperando; 404 si no hay nadie), atendido / ausente / volver a llamar
  (`PATCH`, estados inválidos → 422), **vaciado de la fila del día** (`POST /admin/reset`) y
  refresco cada 6 s; el listado admin **no expone los secretos**. Sin websockets: polling que corre
  gratis en cualquier hosting. Distinto de `agenda` (horarios), `bookings` y `reservamesa` (cupo).

### test: 3 variantes generadas + 74 asserts de backend + smoke en navegador real
- Variantes con `vm.Script` (0 errores de sintaxis en los 51 JS): **full** (hero + reveal/Motion +
  auth + menu + los-4 = 39 archivos, 19 JS, 15 HTML con las 8 páginas nuevas —`carta`, `mi-pedido`,
  `comandas`, `precios`, `precios-admin`, `textos-admin`, `fila`, `fila-admin`—, Anime y Motion
  conviviendo); **sin-auth** (23 archivos, 12 JS: públicos sí, ningún panel ni endpoint admin);
  **Vercel+Supabase** (42 archivos, 20 JS, las 4 colecciones nuevas —`foodorders`, `pricelist`,
  `sitetexts`, `queueturns`— en `schema.sql`). Inlineado seguro (0 `</script>`/`</style>` en
  `app.js`).
- **Backend real** (Express :4995): **62 asserts en verde** — textos (seed del Builder, 401/403,
  edición por campo, campos no tocados intactos, 700 chars → 422); listaprecios (6 sembrados, fold
  "diagnostico"→"diagnóstico" y "estandar"→"estándar", bulk +10% solo a Servicios con 22000→24200
  verificado y las otras categorías intactas, %0 y categoría inexistente → 422, oculto invisible);
  pedidoscarta (total server-side 22.100 verificado contra la semilla, vacío/plato
  inexistente/qty 0/delivery sin dirección/plato pausado → 422, track sin teléfono, 401/403,
  avance de estado reflejado en el track); fila (numeración 1-2-3, ahead correcto, secreto
  incorrecto → 404, llamar al siguiente en orden, cancelación propia que reordena la fila, llamado
  no cancelable → 422, panel sin secretos, reset). Más **12 asserts sin-auth** (:4996): públicos
  OK (pedido 201, número de fila 1), endpoints admin 404, páginas admin inexistentes, públicas 200.
- **Smoke en navegador real** (:4995): cero errores de consola en Home + carta + mi-pedido + fila +
  precios + comandas + textos-admin + fila-admin + precios-admin; `anime` y `Motion` cargados;
  pedido completo por UI (2 empanadas + 1 limonada → barra "$12.400", panel, delivery con
  dirección, código `PC-0D507F`, carrito limpio) y visible en comandas con KPIs ($34.500 del día)
  y avance de estado por click; fila por UI (número 1, "Llamar al siguiente" desde la API → la
  página del visitante pasó sola a **"¡Es tu turno!"** vía sondeo, título de pestaña incluido);
  textos por UI (bajada editada en el panel → visible al instante en la Home); precios públicos con
  el +10% aplicado y "actualizados al 20 de julio de 2026"; los 6 links admin ocultos para el
  anónimo y visibles tras login admin.

## 2026-07-20 (27ª corrida)

> Lote de **4 módulos funcionales nuevos con backend real** (`sitesearch`, `vacantes`, `promos`,
> `negocio`) — según la directiva de no sumar funcionalidad sin backend. Los 4 usan **Anime.js**
> (`usesAnime`) con red de seguridad `setTimeout` y respetan `prefers-reduced-motion`. El foco fue
> **transversalidad**: el buscador global indexa el contenido de los demás módulos (y cierra el
> pendiente histórico de **búsqueda sin acentos**), y la ficha del negocio alimenta el pie de todas
> las páginas y el encabezado fiscal de los comprobantes (cierra el pendiente "datos del negocio
> configurables" de la 26ª). Más dos piezas comerciales que faltaban: bolsa de trabajo administrable
> y promociones con vigencia. Patrón público+admin-por-`auth` con `requireAdmin` (endpoints admin
> **401 sin token**, **403 con token no-admin**) y navbar oculta para no-admin. Ninguno se revirtió.
> Catálogo: **100 UI · 62 funcionales = 162 módulos**.

### feat(functional/sitesearch): buscador global del sitio con registro de búsquedas
- [modules/functional/sitesearch.js](modules/functional/sitesearch.js): módulo nuevo, `usesAnime`,
  colección `searchqueries`, mount `/api/search`. Página pública `/buscar.html` con debounce (350 ms)
  que busca **en el servidor** con plegado de acentos y mayúsculas (`fold()`: "envios" encuentra
  "envíos") sobre las **fuentes resueltas al generar** según los módulos activos: `blogcms` (posts),
  `kb` (kbarticles), `menu` (menuitems), `listings`, `projects`, `downloads`, `cursos`,
  `profesionales` y `vacantes` (tabla `FUENTES_POSIBLES` del lado Builder, serializada filtrada al
  route). Resultados agrupados por fuente (hasta 8 por grupo) con enlace directo (`?post=`,
  `?aviso=`, `?v=`…), stagger de Anime.js y soporte `?q=` compartible. **Cada búsqueda se registra**
  con su total de resultados; con `auth`: `/busquedas-admin.html` con KPIs count-up, top 10 de
  términos, top de **búsquedas sin resultados** (el contenido que falta), últimas 50, CSV y "vaciar
  historial". Query < 2 letras → 422 (y no se loguea). Distinto del módulo UI `search` (filtra la
  página actual en vivo).
- Probado: "envios" (2 hits vía fold), "RISOTTO" (mayúsculas → carta), "vendedor" (vacante con href
  directo), término inexistente → 0 y aparece en sin-resultados, 4 búsquedas registradas, stats/list
  401/403, clear deja total 0.

### feat(functional/vacantes): bolsa de trabajo administrable con postulaciones por puesto
- [modules/functional/vacantes.js](modules/functional/vacantes.js): módulo nuevo, `usesAnime`,
  colecciones `jobopenings` + `jobapplicants`, mount `/api/vacantes`. Página pública
  `/vacantes.html` con las búsquedas **abiertas** servidas del backend, chips por área, detalle en
  acordeón animado (enlace directo `?v=<id>` que auto-abre y scrollea) y **formulario de postulación
  por vacante** (nombre, email, CV por URL —solo http/https, anti-XSS—, mensaje) con **dedupe por
  email+vacante (409)** y email normalizado a minúsculas. Postular a una pausada → 404. Con `auth`:
  `/vacantes-admin.html` con ABM de búsquedas (publicar/pausar/editar/borrar — **borrar arrastra sus
  postulaciones en cascada**) con contador de postulantes, y bandeja de postulantes con **estados**
  (nuevo → en revisión → entrevista → contratado/descartado), nota interna, filtros por búsqueda y
  estado, link al CV y CSV. Se siembran 2 búsquedas. Distinto de `jobs` (form estático genérico) y
  `jobsadmin` (gestiona lo capturado por jobs).
- Probado: 2 sembradas, postulación 201, dedupe 409 (email con mayúsculas), inválida 422, cvUrl
  `javascript:` guardada como vacía, admin 401, contador 1, estado+nota, estado inválido 422, filtro
  por estado, alta/pausa (desaparece del público), borrado en cascada verificado.

### feat(functional/promos): promociones con vigencia e interés medible
- [modules/functional/promos.js](modules/functional/promos.js): módulo nuevo, `usesAnime`, colección
  `promos`, mount `/api/promos`. Sección "Promociones" en la Home que muestra **solo las vigentes al
  día de hoy** (el server filtra `from <= hoy <= until`; `until` vacío = sin vencimiento; fechas
  AAAA-MM-DD comparadas como texto) con etiqueta grande, **días restantes calculados en el server**
  (`daysLeft`) y botón **"Me interesa"** que suma interés real (`POST /:id/interest`, un voto por
  navegador vía localStorage, pop `outBack`); interés en una no-vigente → 404. Con `auth`:
  `/promos-admin.html` con ABM (título, etiqueta, detalle, desde/hasta, publicada), **estado
  calculado** (vigente/programada/vencida/oculta) e interesados por promo. Valida fechas
  (formato 422, `until < from` 422). Se siembran 2 vigentes + 1 vencida que demuestra el filtro.
  Distinto de `promo` (popup estático), `countdown` (UI) y `coupons` (códigos del carrito).
- Probado: público 2 de 3, daysLeft > 0, interés 1, admin 401/lista 3 con estados, vencida 404 al
  interesar, alta futura = "programada" y oculta del público, fechas al revés 422,
  ocultar/publicar/borrar.

### feat(functional/negocio): ficha del negocio que alimenta pie y comprobantes
- [modules/functional/negocio.js](modules/functional/negocio.js): módulo nuevo, `usesAnime`,
  colección `bizinfo` (una sola fila, auto-recreada si falta), mount `/api/negocio`. Ficha
  institucional (razón social, CUIT, dirección, teléfono, email, horario) **sembrada con la marca**
  (`<marca> S.R.L.`, `hola@<slug>.com`). `GET /api/negocio` público (sin id interno);
  `PUT` solo-admin con validación (CUIT formato `30-12345678-9` → 422 si no, email → 422, largos
  máximos). El `clientJs` la **inyecta en vivo en el pie de todas las páginas** (dirección ·
  teléfono · email · horario · razón social+CUIT, con fade de Anime.js y guard anti-duplicado) y,
  **si `invoices` está activo**, agrega la línea fiscal (razón social · CUIT · dirección) al
  encabezado del comprobante público vía `MutationObserver` sobre `#inv-view` (sale también en la
  impresión). Con `auth`: `/negocio-admin.html` con el formulario de edición. **Cierra el pendiente
  "datos del negocio configurables (CUIT, dirección)" anotado por la 26ª para `invoices`.**
- Probado: ficha sembrada, sin id en la vista pública, PUT 401/403, CUIT y email inválidos 422,
  actualización reflejada en GET, línea fiscal inyectada en `/comprobante.html?code=RC-DEMO01` con
  los datos editados, pie inyectado en Home y edición por UI persistida (toast + GET).

### feat(ui/i18n): diccionario sincronizado con el lote
- [modules/ui/i18n.js](modules/ui/i18n.js): entradas nuevas en `DICT` para las etiquetas públicas
  del lote (Buscar, Vacantes, Promociones y los títulos/bajadas de sus secciones), siguiendo la
  convención de sincronía i18n del catálogo. Solo se agregaron claves; nada se modificó ni borró.

### Verificación de la corrida
- Generación con `vm.Script`: **full** (hero + reveal/Motion + auth + blogcms + kb + menu + invoices
  + los-4) = 47 archivos, 22 JS, con **Anime y Motion conviviendo** y las 6 páginas nuevas
  (`buscar`, `vacantes`, `busquedas-admin`, `vacantes-admin`, `promos-admin`, `negocio-admin`);
  **sin-auth** = 22 archivos, 12 JS, con `/buscar.html` y `/vacantes.html` pero **sin ningún panel
  ni link admin**; **Vercel+Supabase** = 46 archivos, 21 JS, con las 5 colecciones nuevas
  (`searchqueries`, `jobopenings`, `jobapplicants`, `promos`, `bizinfo`) en `schema.sql`.
  **0 errores de sintaxis en los 55 JS**, inlineado seguro (0 `</script>`/`</style>` en `app.js`).
- Backend real (Express 5 instalado, :4993): **52 asserts en verde** + **9 de la variante sin-auth**
  (:4994; públicos OK, endpoints admin inexistentes 404, navbar sin links admin).
- Smoke en navegador real: **cero errores de consola** en Home + buscar + vacantes + comprobante +
  los 4 paneles admin; `anime` y `Motion` cargados; "Me interesa" por UI (contador 2, botón
  deshabilitado, dedupe localStorage), búsqueda por UI con `?q=` (stagger completado), postulación
  por UI (caja de éxito + visible en bandeja con CV), línea fiscal en el comprobante, edición de la
  ficha por UI persistida; links admin ocultos para el anónimo y visibles para la admin.



> Lote de **4 módulos funcionales nuevos con backend real** (`uploads`, `livechat`, `clientportal`,
> `invoices`) — según la directiva de no sumar funcionalidad sin backend. Los 4 usan **Anime.js**
> (`usesAnime`) con red de seguridad `setTimeout` y respetan `prefers-reduced-motion`. El foco fue
> **cerrar dos pendientes históricos** (la subida real de archivos que `albums`/`downloads`/
> `projects` esperaban por URL, y el **portal de clientes** anotado desde la 24ª) y sumar **dos
> piezas clásicas de sitio comercial** que faltaban: chat en vivo con bandeja y comprobantes/recibos
> imprimibles. Patrón público+admin-por-`auth` con `requireAdmin` (endpoints admin **401 sin token**,
> **403 con token no-admin**) y navbar oculta para no-admin. Ninguno se revirtió. Catálogo:
> **100 UI · 58 funcionales = 158 módulos**.

### feat(functional/uploads): biblioteca de archivos con subida real
- [modules/functional/uploads.js](modules/functional/uploads.js): módulo nuevo, `usesAnime`,
  `requires: ['auth']`, colecciones `files` (metadatos) + `filedata` (binarios en Supabase), mount
  `/api/uploads`. Cierra el pendiente "las imágenes/archivos van por URL": el admin sube archivos en
  `/archivos-admin.html` (input o **arrastrar y soltar**) y copia la URL propia del sitio
  (`/api/uploads/f/<id>`) para pegarla en cualquier módulo que pida una URL. El binario viaja
  **crudo** (`application/octet-stream` + header `x-file-name` en ASCII, con acentos plegados en el
  cliente) para no pisar el `express.json` global; `express.raw` a nivel ruta limita a **5 MB**.
  Lista blanca de extensiones **sin svg/html (anti-XSS)**, nombre saneado en el servidor
  (`nombreSeguro`), Content-Type desde tabla `TIPOS`, `Content-Disposition: inline` y caché 1 día.
  Persistencia por modo: local escribe en `data/uploads/` (metadatos en `files`); con Supabase el
  binario va en **base64 a `filedata`** (fila aparte para que el listado nunca cargue binarios) —
  funciona en Vercel sin servicios extra. `GET /f/:id` público; `POST/GET list/DELETE` admin.
- Probado: subida 201 con nombre saneado ("Catálogo Peñón 2026.txt" → `catalogo-penon-2026.txt`),
  svg rechazado 422, no-admin 403, roundtrip binario idéntico, borrado deja el archivo en 404.

### feat(functional/livechat): chat en vivo con bandeja admin
- [modules/functional/livechat.js](modules/functional/livechat.js): módulo nuevo, `usesAnime`,
  colección `chatmessages` (una fila por mensaje), mount `/api/chat`. Burbuja flotante en **todas
  las páginas** (ícono Phosphor `chat-circle-dots` horneado en el `clientJs`): el visitante deja su
  nombre (identidad anónima `lc-id` aleatoria en localStorage, **sin pedir email**) y conversa; el
  primer mensaje dispara una **bienvenida automática** del negocio. Novedades por **polling liviano**
  (4 s con el panel abierto, pausado con `document.hidden`; sin websockets: corre en cualquier
  hosting gratuito incluido Vercel) y **punto de aviso** en la burbuja cuando responde el negocio
  con el panel cerrado. `POST /messages` (422 chatId/texto inválido, tope `MAX_POR_CHAT` 200 → 429),
  `GET /messages?chatId=` (solo la conversación propia). Con `auth`: bandeja `/chat-admin.html`
  (hilos agrupados con **no-leídos**, abrir el hilo los marca leídos, respuesta, borrar conversación,
  refresco automático 5 s/10 s). Convivencia con los flotantes de WhatsApp y volver-arriba (se
  corre a 84 px). Distinto de `chatbot`/`ai-agent` (responde una IA) y de `inbox`/`contact`.
- Probado: bienvenida automática en el primer mensaje, hilo con no-leídos que baja a 0 al abrirlo,
  respuesta admin visible para el visitante, 404 al responder hilos inexistentes, variante sin
  `auth` con endpoints admin inexistentes (404) y widget funcionando igual.

### feat(functional/clientportal): portal del cliente "Mis gestiones"
- [modules/functional/clientportal.js](modules/functional/clientportal.js): módulo nuevo,
  `usesAnime`, `requires: ['auth']`, mount `/api/portal` (sin colecciones propias). Cierra el
  pendiente **"portal de clientes"** anotado desde la 24ª: `GET /api/portal` (`requireAuth`) junta
  todas las gestiones del usuario **filtrando por el email del token JWT** (nunca por parámetro:
  imposible ver gestiones ajenas) desde las colecciones de los módulos activos — el código de cada
  sección **solo se genera si su módulo está en la config** (tabla `SECCIONES`): pedidos
  (`ordertrack`), turnos (`bookings`), devoluciones (`returns`), garantías (`warranty`, con estado
  vigente/vencida/reclamada derivado), reclamos (`tickets`), presupuestos (`quote`), cursos con
  avance (`cursos`, cruza `courseprogress` con `courses`), fidelidad (`loyalty`) y comprobantes
  (`invoices`). Cada item normalizado a `{title, sub, status, href, at}` con enlace al detalle
  cuando existe. Página `/portal.html` con saludo por nombre, **total con count-up** y secciones con
  stagger; link de navbar "Mis gestiones" visible solo logueado. `agenda`/`reservamesa` quedan
  afuera (guardan teléfono, no email; anotado en el README generado).
- Probado: 401 sin token, portal de Ana con su comprobante enlazado, **aislamiento por email**
  (otro usuario no ve lo de Ana), estado vacío amigable.

### feat(functional/invoices): comprobantes y recibos imprimibles
- [modules/functional/invoices.js](modules/functional/invoices.js): módulo nuevo, `usesAnime`,
  colección `invoices`, mount `/api/invoices`. El negocio **emite comprobantes** (cliente, email
  opcional para el portal, **items con cantidad y precio**; el **total lo calcula siempre el
  servidor**, 422 si algún item es inválido) con código `RC-XXXXXX` y estados
  pendiente/pagado/anulado. El cliente los consulta en `/comprobante.html` (o con el enlace directo
  `?code=`, auto-consulta) y los **imprime con hoja limpia** (`@media print` oculta navbar/footer/
  botones); la vista pública nunca expone email ni nota interna, y el anulado se marca sin validez.
  Se siembra `RC-DEMO01`. Con `auth`: `/comprobantes-admin.html` con **filas de items dinámicas**
  (agregar/quitar con total en vivo), KPIs animados (emitidos, **cobrado** con count-up, pendientes),
  filtro por estado, marcar pagado/anular, nota interna (`prompt`), CSV y link "Ver" al comprobante.
  Distinto de `ordertrack` (estado logístico) y `quote`/`quotesadmin` (presupuestos del visitante).
- Probado: total server-side (975.000 verificado), formato de código validado, qty 0 y precio
  negativo 422, estado inválido 422, filtro por estado, chip y count-up en la página pública.

### chore(design): ajustes por el hook de diseño
- En los 4 módulos nuevos se usan los tokens del sitio generado (`var(--radius)`, `var(--accent)`,
  chips positivos con `color-mix` sobre `--accent`) en lugar de valores nuevos; se mantienen
  `#c0392b` (convención de peligro ya usada por 16 módulos), la sombra `rgba(0,0,0,.25)` (la misma
  del FAB de WhatsApp) y el radio 14 px de las burbujas de chat (deliberado del patrón chat).
  DESIGN.md documenta la paleta del **Builder**, no la de los sitios generados (que salen de la
  marca elegida por el cliente), así que esos avisos se clasifican como falsos positivos acá.

## 2026-07-20 (25ª corrida)

> Lote de **4 módulos funcionales nuevos con backend real** (`agenda`, `cursos`, `profesionales`,
> `simulador`) — según la directiva de no sumar funcionalidad sin backend. Los 4 usan **Anime.js**
> (`usesAnime`) con red de seguridad `setTimeout` y respetan `prefers-reduced-motion`. Cubren los
> verticales pendientes anotados en la 23ª/24ª: **turnos con slots horarios por profesional** (más
> fino que `bookings`), **cursos con lecciones y progreso por alumno**, **directorio de
> profesionales con ficha y consulta**, y **cotizador/simulador de financiación por parámetros**.
> Todos siguen el **patrón público+admin-por-`auth`** con `requireAdmin` (endpoints admin **401 sin
> token**) y navbar oculta para no-admin; sin `auth` la parte pública funciona con datos sembrados.
> Ninguno se revirtió. Catálogo: **100 UI · 54 funcionales = 154 módulos**.

### feat(functional/agenda): agenda de turnos con slots horarios por profesional
- [modules/functional/agenda.js](modules/functional/agenda.js): módulo nuevo, `usesAnime`,
  colección `agbookings`, mount `/api/agenda`. Público `/turnos.html`: el visitante elige servicio
  (constante `SERVICIOS`, cada uno con duración en minutos), profesional (`PROFESIONALES`) y fecha;
  `GET /slots?date=&pro=&service=` arma la grilla de `HORARIO.start` a `HORARIO.end` con paso `PASO`
  (30') marcando ocupado todo slot cuyo rango `[t, t+dur)` pise un turno vigente (un color de 90'
  bloquea 3 slots de 30'). `POST /` **recalcula la disponibilidad en el servidor** y responde **409**
  si el horario se ocupó en el medio; devuelve código `AG-XXXXXX`. `GET /meta` para armar el
  formulario. Fechas solo de hoy en adelante (422). Grilla con `anime.stagger` + red de seguridad.
  Con `auth`: panel `/agenda-admin.html` (agenda del día ordenada por profesional+hora, estados
  pendiente/confirmado/atendido/cancelado — cancelar **libera el horario** —, `PATCH`/`DELETE`
  `requireAdmin`). Distinto de `bookings` (turno genérico) y `reservamesa` (cupo de personas).

### feat(functional/cursos): cursos online con lecciones y progreso por alumno
- [modules/functional/cursos.js](modules/functional/cursos.js): módulo nuevo, `usesAnime`,
  colecciones `courses` + `courseprogress`, mount `/api/cursos`. Público `/cursos.html`: listado de
  cursos publicados con conteo real de lecciones y alumnos, curso abierto vía `?curso=<id>` (enlace
  compartible con `history.replaceState`). El alumno se inscribe con su email (`POST /:id/enroll`,
  **idempotente** con email normalizado a minúsculas, 201/200+`already`) y marca lecciones
  (`POST /:id/progress`, idempotente, 422 lección inválida, 404 sin inscripción); el avance vive en
  el servidor y se retoma desde cualquier dispositivo (email recordado en localStorage). Barra de
  progreso + porcentaje con count-up de Anime.js y red de seguridad. Con `auth`: ABM
  `/cursos-admin.html` (`GET /admin/all` con alumnos por curso, `POST /admin`, `PATCH /admin/:id`,
  `DELETE /admin/:id` — borra también el progreso—, todos `requireAdmin`); las lecciones se escriben
  **una por línea** ("Título | contenido", `parsearLecciones()` con ids posicionales l1..lN, máx 60).
  Borradores invisibles en público (listado y `GET /:id` → 404). Siembra 2 cursos.

### feat(functional/profesionales): directorio de profesionales con ficha y consulta
- [modules/functional/profesionales.js](modules/functional/profesionales.js): módulo nuevo,
  `usesAnime`, colecciones `pros` + `prorequests`, mount `/api/pros`. Público `/profesionales.html`:
  fichas publicadas (`publico()` sin campos internos) con chips por especialidad
  (`GET /especialidades`), filtro `?esp=` (case-insensitive) y buscador server `?q=`; avatar de
  iniciales si no hay foto; cada ficha tiene formulario de consulta (`POST /:id/contact`, valida
  nombre 2-80 + email + mensaje 10-600, **404** a profesional inexistente u oculto) que se guarda en
  `prorequests` con estado `nuevo`. Fichas con `anime.stagger` + red de seguridad. Con `auth`: ABM
  `/profesionales-admin.html` (staff con conteo de consultas, foto **solo URL http/https**
  —`urlSegura()` anti-XSS—, publicar/ocultar, `requireAdmin`) + bandeja de consultas
  (`GET /admin/requests` con `?status=`, marcar `contactado`, borrar). Siembra 3 fichas. Distinto de
  `team` (UI estática) y `listings` (avisos con precio).

### feat(functional/simulador): simulador de financiación con tasas administrables
- [modules/functional/simulador.js](modules/functional/simulador.js): módulo nuevo, `usesAnime`,
  colecciones `financelines` + `financequotes`, mount `/api/financing`. Sección en la Home: línea +
  monto + cuotas → `POST /quote` calcula **en el servidor** la cuota por **sistema francés**
  (`cuotaFrancesa()`: `monto·i/(1-(1+i)^-n)` con `i = TNA/1200`; con TNA 0, monto/cuotas) validando
  monto dentro de `minAmount..maxAmount` (422) y plazo dentro de `terms` (422), y **registra cada
  simulación** en `financequotes` (sin datos personales) para medir demanda. Cuota con count-up de
  Anime.js + leyenda fija "simulación orientativa, no constituye una oferta". Con `auth`: ABM
  `/financiacion-admin.html` (`GET /admin/all` con conteo de simulaciones por línea, `POST /admin`,
  `PATCH /admin/:id` — la tasa editada **rige al instante** —, `DELETE /admin/:id`, `requireAdmin`);
  plazos saneados con `limpiarPlazos()` (enteros 1-360, sin repetidos, ordenados), máximo ≥ mínimo
  (422). Siembra 3 líneas. Distinto de `estimator` (front-only) y `shipping` (envíos).

### test: 3 variantes generadas + 80 asserts de backend + smoke en navegador
- Variantes con `generate()`: full (hero+reveal/Motion+auth+los-4 = 36 archivos, 18 JS, las 8
  páginas nuevas), sin-auth (21 archivos, 11 JS, sin paneles), Vercel+Supabase (39 archivos, 19 JS,
  las 7 colecciones —`agbookings`, `courses`, `courseprogress`, `pros`, `prorequests`,
  `financelines`, `financequotes`— en `schema.sql`). Syntax-check `vm.Script` de los 48 JS: 0
  errores; 0 cierres `</script>`/`</style>` en `app.js`. Backend real en Express (:4975): **80
  asserts en verde**. Smoke en navegador (:4976): cero errores de consola en las 4 páginas públicas
  + 2 paneles admin, flujos completos por UI y links admin ocultos para anónimos.

## 2026-07-18 (23ª corrida)

> Lote de **4 módulos funcionales nuevos con backend real** (`blogcms`, `shipping`, `listings`,
> `menu`) — según la directiva de no sumar funcionalidad sin backend. Los 4 usan **Anime.js**
> (`usesAnime`) con red de seguridad `setTimeout` y respetan `prefers-reduced-motion`. Cubren
> verticales/piezas que faltaban por completo: **blog administrable** (distinto del `blog` UI
> estático), **cotizador de envío por provincia**, **directorio de avisos** y **carta de
> restaurante**. Todos siguen el **patrón público+admin-por-`auth`** con `requireAdmin` (endpoints
> admin **401 sin token**) y navbar oculta para no-admin; sin `auth` la parte pública funciona con
> datos sembrados. Ninguno se revirtió. Catálogo: **100 UI · 46 funcionales = 146 módulos**.

### feat(functional/blogcms): blog administrable con backend
- [modules/functional/blogcms.js](modules/functional/blogcms.js): módulo nuevo, `usesAnime`,
  colección `posts`, mount `/api/blogcms`. Público `/blog.html`: listado de publicados desde el
  server (`resumen()` sin `body`), buscador `?q=` (título/categoría/extracto) + `?cat=`, chips de
  categoría (`GET /categorias`), artículo completo en la misma página vía `?post=<id>` con
  `history.pushState` (enlace directo compartible + `popstate`), **visita real** `POST /:id/view`.
  Revelado de tarjetas y artículo con `anime.animate`+`anime.stagger` y red de seguridad. Con `auth`:
  ABM `/blog-admin.html` (`GET /all/list`, `POST`, `PATCH` publicar/despublicar/editar, `DELETE`,
  todos `requireAdmin`). Validación `title` 3-160, `category` 2-60, `excerpt` 10-320, `body` 20-20000;
  portada `cover` opcional (URL ≤500). Siembra 2 artículos. Distinto de `blog`/`blogpages` (UI fija)
  y `comments`.

### feat(functional/shipping): cotizador de costo de envío por zona
- [modules/functional/shipping.js](modules/functional/shipping.js): módulo nuevo, `usesAnime`,
  colección `shippingzones`, mount `/api/shipping`. Sección en la Home: `<select>` de 24 provincias
  (constante `PROVINCIAS`), `GET /quote?province=` devuelve `{zone, cost, days, freeFrom}` buscando
  la zona que abarca la provincia (**422** provincia fuera de lista, **404** si ninguna zona la
  cubre); costo con count-up de Anime.js + aviso de envío gratis por monto. `GET /provinces`. Con
  `auth`: ABM `/envios-admin.html` (`GET /`, `POST`, `PATCH`, `DELETE` `requireAdmin`), provincias por
  casilleros, saneadas con `limpiarProvincias()` (sólo válidas, sin repetidos). Valida `name` 2-80,
  `cost`/`days` numéricos, `freeFrom` opcional. Siembra 3 zonas (CABA/GBA, Centro, Resto). Pieza de
  e-commerce inexistente; distinto de `branches`/`map`.

### feat(functional/listings): directorio de avisos / clasificados
- [modules/functional/listings.js](modules/functional/listings.js): módulo nuevo, `usesAnime`,
  colección `listings`, mount `/api/listings`. Público `/avisos.html`: listado (`resumen()` sin
  `description`), buscador `?q=` + `?cat=` + chips (`GET /categorias`), detalle vía `?aviso=<id>`
  (`history.pushState`/`popstate`) con **visitas reales** `POST /:id/view`. Campos: título, categoría,
  `price` (0 → "A convenir" en UI), ubicación, descripción, `image` opcional. Revelado con
  `anime.stagger` + red de seguridad. Con `auth`: ABM `/avisos-admin.html` (crear/editar/publicar/
  borrar, `requireAdmin`). Valida `title` 3-140, `category` 2-60, `location` 2-120, `description`
  10-6000. Siembra 3 (inmueble/vehículo/servicio). Distinto de `products-admin` (e-commerce con
  carrito) y `catalogo`/`productcompare` (UI estática).

### feat(functional/menu): carta / menú de restaurante administrable
- [modules/functional/menu.js](modules/functional/menu.js): módulo nuevo, `usesAnime`, colección
  `menuitems`, mount `/api/menu`. Público `/carta.html`: platos publicados agrupados por categoría
  en orden gastronómico (constante `ORDEN` en el `clientJs`, no listadas al final alfabéticas), con
  precio, descripción, **etiquetas de dieta** (constante `TAGS`: veg/vegan/sintacc/picante) y buscador
  `?q=` que filtra en el server; plato marcable **"no disponible hoy"** (`available:false`, clase
  `.off`). Aparición de secciones con `anime.stagger` + red de seguridad. Con `auth`: ABM
  `/carta-admin.html` (`GET /all`, `POST`, `PATCH` editar/pausar, `DELETE` `requireAdmin`), etiquetas
  por casilleros saneadas con `limpiarTags()`. Valida `name` 2-120, `category` 2-60, `price` numérico;
  `description` opcional ≤400. Siembra 6 platos. Distinto de `products-admin` (carrito) y
  `pricing`/`catalogo` (UI estática): administra la carta, sin carrito.

### test: verificación del lote
- Registro: **100 UI · 46 funcionales = 146** (`registry.list()` sin duplicados; los 4 con
  `usesAnime:true` y sus colecciones).
- 3 variantes generadas (full con auth, sin-auth, Vercel+Supabase) → **43 JS** verificados con
  `vm.Script` (0 errores de sintaxis), 0 `</script>`/`</style>` en `app.js` inlineado, 4 tablas nuevas
  en `schema.sql`.
- **48 asserts** de backend real en Express (:4933) sobre los 4 módulos (altas/consultas/validaciones
  422/401 admin/borrado); **smoke test** en navegador (:4933): Home + `/blog.html` + `/avisos.html` +
  `/carta.html` + `/carta-admin.html` sin errores de consola, `anime`+`Motion` cargados, datos
  sembrados y flujos (abrir artículo con contador, cotizar envío, panel admin) funcionando.

## 2026-07-14 (22ª corrida)

> Lote de **4 módulos funcionales nuevos con backend real** (`usertestimonials`, `kb`, `quotesadmin`,
> `jobsadmin`) — según la directiva de no sumar funcionalidad sin backend. Los 4 usan **Anime.js**
> (`usesAnime`) con red de seguridad `setTimeout` y respetan `prefers-reduced-motion`. Dos son **netos
> nuevos** (testimonios moderados; centro de ayuda administrable) y dos **cierran huecos ya anotados**:
> `quote` (UI, colección `quotes`) y `jobs` (UI, colección `applications`) capturaban sin gestionar;
> `quotesadmin`/`jobsadmin` **reusan la misma colección vía `requires`** y sólo agregan el panel admin,
> **sin duplicar el alta**. Todos siguen el **patrón admin-por-`auth`** con `requireAdmin` + navbar/sección
> oculta para no-admin. Se verificó no colisionar con el módulo UI `testimonials` (mismo `id` no permitido):
> el nuevo usa `id: usertestimonials` y su sección `#testimonios-clientes` (la UI usa `#testimonios`).
> Ninguno se revirtió. Catálogo: **100 UI · 42 funcionales = 142 módulos**.

### feat(functional/usertestimonials): testimonios moderados
- [modules/functional/usertestimonials.js](modules/functional/usertestimonials.js): módulo nuevo,
  `usesAnime`, `id: 'usertestimonials'` (evita choque con el UI `testimonials`). Sección en la Home
  (`#testimonios-clientes`) con **muro de aprobados** (revelado con `anime.stagger` + count-up del total,
  con red de seguridad que fija opacidad/transform final si la pestaña estaba oculta) y **formulario de
  envío** con **selector de estrellas propio** (0 = sin puntuar; volver a tocar la misma estrella la
  desmarca; escribe un `input[type=hidden] name=rating`). `POST /api/testimonials` valida `name` (2-80)
  y `message` (10-600); `rating` opcional entero 1-5 (422 si viene fuera de rango); guarda `status:
  'pending'`. `GET /api/testimonials` sólo aprobados con **vista pública** (`publico()` no expone campos
  internos); `GET /api/testimonials/stats` cuenta aprobados. **Backend condicional** (`auth`): `GET
  /all` (`requireAdmin`, filtro `?status=`), `PATCH /:id` (aprobar/rechazar, valida `oneOf` estados),
  `DELETE /:id`; página `/testimonios-admin.html` con tabla + badges + botones aprobar/rechazar/borrar +
  filtro + CSV (`;` + BOM). Siembra 2 aprobados con `db.seedIfEmpty`. Colección `testimonials`. Nav
  `/testimonios-admin.html` sólo con `auth`, oculta para no-admin. **Fix durante el smoke**: el panel
  traía `/all?status=<filtro>` y el `<select>` sólo reordenaba ese subconjunto → ahora **trae todos** y
  filtra en cliente (como `callback`). Distinto de `reviews`, del UI `testimonials` y de `qanda`.

### feat(functional/kb): centro de ayuda / base de conocimiento
- [modules/functional/kb.js](modules/functional/kb.js): módulo nuevo, `usesAnime`. Página pública
  `/ayuda.html` con **buscador server-side** (`GET /api/kb?q=` filtra por `título+categoría+contenido`,
  debounce 250 ms en cliente), artículos **agrupados por categoría** en **acordeón** cuyo `max-height`
  anima con **Anime.js** (abrir/cerrar, con red de seguridad que deja el panel en su estado final si el
  loop se pausa) y **contador de visitas real**: `POST /api/kb/:id/view` incrementa `views` sólo en
  artículos publicados (404 si no), llamado **una vez por apertura** (set `vistos`). `publico()` normaliza
  la salida. **Backend condicional** (`auth`): `GET /all` (`requireAdmin`, publicados y borradores),
  `POST /` (valida `title` 3-140, `category` 2-60, `body` 10-5000; `published` default true), `PATCH /:id`
  (valida por campo presente), `DELETE /:id`; página `/ayuda-admin.html` con **ABM** (form crear/editar,
  toggle publicar/despublicar, borrar, `datalist` de categorías vivas). Siembra 4 artículos. Colección
  `kbarticles`. Nav pública `/ayuda.html` siempre + `/ayuda-admin.html` sólo con `auth` (oculta para
  no-admin). Distinto de `faq` (fijo) y `qanda` (preguntas del público).

### feat(functional/quotesadmin): gestión de presupuestos (sobre `quote`)
- [modules/functional/quotesadmin.js](modules/functional/quotesadmin.js): módulo nuevo, `usesAnime`,
  `requires: ['quote']`, `collections: ['quotes']` (de-dup con el UI). **No duplica el alta**: sólo agrega
  gestión. `mounts`/`files`/`pages`/`clientJs`/`head` **condicionales a `auth`** (sin `auth` no emite nada
  salvo la nota de README). `routes/quotesadmin.js` en `/api/quotes-admin`: `GET /` (`requireAdmin`, filtro
  `?status=`, `conEstado()` normaliza pedidos viejos sin estado a `nuevo`), `GET /stats` (`{total,
  pendientes}`), `PATCH /:id` (estados `nuevo|cotizado|aceptado|rechazado` con `oneOf`; `note` 0-500).
  Página `/presupuestos.html`: **resumen KPI con count-up** (Anime.js + red de seguridad), tabla con
  `<select>` de estado por fila (PATCH al cambiar), botón de **nota** (`prompt`), filtro y CSV. Nav sólo
  con `auth`, oculta para no-admin. **Cierra el hueco** de captura-sin-gestión anotado en la 21ª.

### feat(functional/jobsadmin): gestión de postulaciones (sobre `jobs`)
- [modules/functional/jobsadmin.js](modules/functional/jobsadmin.js): módulo nuevo, `usesAnime`,
  `requires: ['jobs']`, `collections: ['applications']`. Mismo molde condicional-a-`auth` que
  `quotesadmin`. `routes/jobsadmin.js` en `/api/applications-admin`: `GET /` (`requireAdmin`, filtros
  `?status=` y `?position=`, `conEstado()` a `nuevo`), `GET /stats`, `PATCH /:id` (estados `nuevo|revision|
  entrevista|contratado|descartado`; `note` 0-500; 422 si no hay nada para actualizar). Página
  `/postulaciones.html`: resumen KPI con count-up, **filtro por estado y por puesto** (opciones derivadas
  de los datos), `<select>` de estado por fila, nota, **link al CV** (`target=_blank rel=noopener`) y CSV.
  Nav sólo con `auth`, oculta para no-admin. **Cierra el hueco** anotado en la 21ª.

### test(22ª): verificación del lote
- **Registro**: `100 UI · 42 funcionales = 142`. **3 variantes** generadas (full JSON+auth = 40 archivos/20
  JS; sin-auth = 23/12; Vercel+Supabase+auth = 43/21). `node --check` en **todos** los JS de cada variante
  (0 errores). Inlineado seguro (0 `</script>`/`</style>` en `app.js`). `schema.sql` (Vercel) incluye
  `testimonials`, `kbarticles`, `quotes`, `applications`. **Backend real** (Express :4931, **44 asserts en
  verde**) y **smoke en navegador real** (:4932, 0 errores de consola; Home + 5 páginas nuevas; visita de
  KB 0→1 persistida; envío de testimonio por UI persistido `pending` rating 5; los 4 paneles admin con
  datos vivos; links admin ocultos para no-admin). Detalle en [PROGRESO.md](PROGRESO.md).

## 2026-07-14 (21ª corrida)

> Lote de **4 módulos funcionales nuevos con backend real** (`nps`, `leadmagnet`, `returns`,
> `warranty`) — según la directiva de no sumar funcionalidad sin backend. Los 4 usan **Anime.js**
> (`usesAnime`) con red de seguridad `setTimeout` y respetan `prefers-reduced-motion`. Todos siguen el
> **patrón admin-por-`auth`**: la parte pública funciona anónima; con `auth` activo suman gestión
> solo-admin (`nps`/`leadmagnet` con página propia estilo `callback`; `returns`/`warranty` con sección
> condicional en la misma página estilo `tickets`), siempre con `requireAdmin` + navbar/sección oculta
> para no-admin. Foco: medir satisfacción (NPS), captar (lead magnet) y post-venta de e-commerce
> (devoluciones y garantía). Se verificó no pisar los módulos UI `quote` (colección `quotes`) ni `jobs`
> (colección `applications`), que ya capturan pero no gestionan; no se tocaron. Ninguno se revirtió.
> Catálogo: **100 UI · 35 funcionales = 135 módulos**.

### feat(functional/nps): encuesta NPS
- [modules/functional/nps.js](modules/functional/nps.js): módulo nuevo, `usesAnime`. Sección en la
  Home con escala **0-10** (botones generados en el `clientJs`, `aria-pressed`) + comentario opcional.
  `POST /api/nps` valida `Number.isInteger(score) && 0..10` (422 si no) y guarda con `category`
  derivada (`promotor` 9-10 / `pasivo` 7-8 / `detractor` 0-6); `GET /api/nps/summary` devuelve
  `{ total, nps, promotores, pasivos, detractores }` con **NPS = `%promotores − %detractores`**. El
  score sube con count-up y las barras de distribución animan su `width` (**Anime.js** + red de
  seguridad). Un voto por navegador (localStorage `nps-voto`). Colección `npsresponses`. **Backend
  condicional**: con `auth`, `GET /api/nps/all` (`requireAdmin`, filtro `?category=`) devuelve
  `{ resumen, respuestas }` y la página `/nps.html` pinta tarjeta de resumen + tabla con comentarios +
  filtro + CSV (`;` + BOM). Preview con datos demo. Nav `/nps.html` sólo con `auth`, oculta para
  no-admin. Distinto de `feedback` (sí/no por página) y `polls` (opción múltiple).

### feat(functional/leadmagnet): descargable con registro (lead magnet)
- [modules/functional/leadmagnet.js](modules/functional/leadmagnet.js): módulo nuevo, `usesAnime`.
  Sección en la Home con material descargable (constante `RECURSOS` = `{id,title,desc,format,url}`,
  embebida en route y `clientJs`). `GET /api/leadmagnet` lista los recursos con su `downloads` (sin
  exponer la `url`); `POST /api/leadmagnet` valida `isEmail` + recurso existente (404/422), inserta la
  captura **idempotente por recurso+email** (201 nuevo / 200 repetido con `already`) y **sólo entonces**
  devuelve la `url` y el nuevo `downloads` (count-up **Anime.js** + red de seguridad). El enlace se
  revela recién tras dejar el email; `localStorage lm-ok-<id>` recuerda lo desbloqueado. Colección
  `downloadleads` (con `resourceTitle` desnormalizado para el CSV). **Backend condicional**: con `auth`,
  `GET /api/leadmagnet/all` (`requireAdmin`, filtro `?resource=`) y página `/descargas.html` con tabla
  por recurso + filtro poblado dinámicamente + CSV. Distinto del UI `resources` (enlaces abiertos) y de
  `leads` (captación genérica).

### feat(functional/returns): devoluciones y cambios (RMA)
- [modules/functional/returns.js](modules/functional/returns.js): módulo nuevo, `usesAnime`. Página
  propia `/devoluciones.html` con formulario de alta (nombre, email, comprobante, producto, tipo
  `devolucion`/`cambio`, motivo) + consulta por código. `POST /api/returns` valida con `check`
  (`str`/`isEmail`/`oneOf`), genera código `RTN-` + `crypto.randomBytes(3).hex.toUpperCase()`, guarda
  con `status:'solicitada'` y devuelve **sólo la vista pública** (`publica()` omite el email);
  `GET /api/returns/codigo/:code` idem por código (404 si no existe). Estado como **línea de progreso**
  de 4 pasos (`solicitada→aprobada→recibida→resuelta`) animada por `width` (**Anime.js** + red de
  seguridad), con `rechazada` renderizado como cierre alternativo (no está en `ESTADOS`, sí en
  `TODOS_ESTADOS`). Colección `returns`. **Backend condicional**: con `auth`, `GET /api/returns`
  (`requireAdmin`, filtro `?status=`), `PATCH /api/returns/:id` (estado validado contra `TODOS_ESTADOS`
  + nota ≤1000, 422/404) y sección admin en la misma página con tabla (selects de estado + input de
  nota + guardar por fila) y CSV. Distinto de `ordertrack` (lo emite el negocio) y `tickets` (soporte).

### feat(functional/warranty): registro de garantía
- [modules/functional/warranty.js](modules/functional/warranty.js): módulo nuevo, `usesAnime`. Página
  propia `/garantia.html` con alta (nombre, email, producto, **serie**, fecha de compra) + consulta por
  serie. `POST /api/warranty` valida con `check` (incluye `dateISO` + `fecha ≤ hoy`, 422 si futura),
  **serie única** (409 si ya existe, normalizada a mayúsculas), calcula `coverageEnd = compra + MESES`
  (`Date.setMonth`, `MESES=12` configurable) y devuelve la vista pública `publica()` (sin nombre/email).
  El **estado se deriva** en el servidor (`estado()`): `reclamada` si el admin la marcó, si no `vigente`
  cuando `coverageEnd ≥ ahora` o `vencida`. `GET /api/warranty/serie/:serial` devuelve el estado público
  con una **barra de tiempo transcurrido** (`(ahora−compra)/(fin−compra)`, clamp 0-100 %) animada
  (**Anime.js** + red de seguridad; la barra usa color gris si venció). Colección `warranties`. **Backend
  condicional**: con `auth`, `GET /api/warranty` (`requireAdmin`, agrega `status` derivado + filtro
  `?status=`), `PATCH /api/warranty/:id` (`claimed` booleano + nota ≤1000) y sección admin con tabla
  (check "reclamada" + nota + guardar) y CSV con fechas formateadas. Distinto de `returns` (devolución)
  y `ordertrack` (seguimiento de pedido).

### chore: pruebas del lote 21
- Registro cargado sin conflictos de `id`/colección/route/page (se chequearon colisiones con `quote`,
  `jobs`, `resources`, `trust` antes de escribir). `node --check` en los JS de 3 variantes generadas
  (full con `auth`+`reveal`, sin-auth, Vercel+Supabase): 0 errores; inlineado seguro; `schema.sql`
  incluye las 4 colecciones nuevas. Backend real en Express (:4821) y smoke test en navegador real de
  Home + `/devoluciones.html` + `/garantia.html` + los 4 paneles admin (0 errores de consola, `anime` y
  `Motion` cargados, datos vivos, secciones admin ocultas para no-admin). Detalle en PROGRESO.md (21ª).

## 2026-07-14 (20ª corrida)

> Lote de **4 módulos funcionales nuevos con backend real** (`callback`, `loyalty`, `raffle`,
> `ordertrack`) — según la directiva de no sumar funcionalidad sin backend. Los 4 usan **Anime.js**
> (`usesAnime`) con red de seguridad `setTimeout` y respetan `prefers-reduced-motion`. Todos siguen el
> **patrón admin-por-`auth`** de `tickets`/`restock`: la parte pública funciona anónima; con el módulo
> `auth` activo suman una página solo-admin (route condicional con `requireAdmin` + navbar oculta para
> no-admin). Foco: relación con el cliente y post-venta. Ninguno se revirtió. Catálogo: **100 UI ·
> 31 funcionales = 131 módulos**.

### feat(functional/callback): solicitar llamada ("te llamamos")
- [modules/functional/callback.js](modules/functional/callback.js): módulo nuevo, `usesAnime`. Sección
  en la Home con nombre + teléfono + **franja horaria** (constante `FRANJAS`, embebida en el route con
  `JSON.stringify` y en el `clientJs` para poblar el `<select>`) + motivo opcional. `POST /api/callback`
  valida (`str`/`oneOf` sobre los ids de franja), guarda el pedido con `status:'pendiente'` y `slotLabel`
  resuelto, y devuelve `total` (prueba social); `GET /api/callback/stats` devuelve el total público con
  count-up (**Anime.js** + red de seguridad). Colección `callbacks`. **Backend condicional**: con `auth`,
  `GET /api/callback/all` (`requireAdmin`, filtro `?status=`), `PATCH /api/callback/:id` (marca
  `contactado`, valida con `oneOf`) y página `/llamadas.html` con tabla, filtro pendiente/contactado,
  botón inline por fila, teléfono clickeable (`tel:`) y CSV (separador `;` + BOM). Preview con datos demo.

### feat(functional/loyalty): tarjeta de fidelidad (sellos)
- [modules/functional/loyalty.js](modules/functional/loyalty.js): módulo nuevo, `usesAnime`. Sección en
  la Home donde el visitante consulta/crea su tarjeta por email (`POST /api/loyalty/card`, idempotente;
  completa `name` si faltaba) y ve la **barra de progreso** + sellos (`META`/`PREMIO` configurables,
  `GET /api/loyalty/config` para la Home). La carga de sellos es **solo-admin** (el visitante nunca se
  suma sellos): con `auth`, `GET /api/loyalty/all` (`requireAdmin`, búsqueda `?q=`), `PATCH
  /api/loyalty/:id/stamp` (+1), `POST /api/loyalty/:id/redeem` (canjea si `stamps>=META`: resta la meta,
  suma `redemptions`, sella `lastRedeemedAt`; `409` con detalle si no llegó) y página `/fidelidad.html`
  con búsqueda, botones **+1 sello** / **Canjear** por fila y CSV. Anima barra + count-up + `stagger` de
  sellos con red de seguridad. Colección `loyaltycards`. Preview con datos demo.

### feat(functional/raffle): sorteo con ganador elegido en el servidor
- [modules/functional/raffle.js](modules/functional/raffle.js): módulo nuevo, `usesAnime`. Sección en la
  Home: `POST /api/raffle` `{name,email}` participa **idempotente por email** y cierra con `409` si ya
  hay ganador; `GET /api/raffle` devuelve premio/bases (`PREMIO`/`BASES`), cantidad de participantes y,
  si se sorteó, el ganador con **email enmascarado** (`di***@dominio`). El ganador se elige con
  **`crypto.randomInt`** del lado del servidor (nunca en el navegador). Colecciones `raffleentries` +
  `raffledraws` (el draw activo = última tirada, así `reopen` es borrar tiradas). **Backend condicional**:
  con `auth`, `GET /api/raffle/all` (participantes + estado), `POST /api/raffle/draw` (`409` si ya hay
  ganador o si no hay participantes), `POST /api/raffle/reopen` y página `/sorteo.html` con panel de
  estado, botón **Sortear**, **Reabrir** (con `confirm`) y CSV. Contador con count-up y reveal del ganador
  animado (red de seguridad). Preview con datos demo.

### feat(functional/ordertrack): seguimiento de pedidos por código
- [modules/functional/ordertrack.js](modules/functional/ordertrack.js): módulo nuevo, `usesAnime`. Página
  pública **propia** `/seguimiento.html` (siempre presente; el link a la navbar se agrega siempre y el de
  `/pedidos.html` solo con `auth`): el cliente ingresa `OT-XXXXXX` (o llega con `?code=` en la URL y
  auto-consulta) y ve la **línea de progreso** animada sobre `ESTADOS` (Recibido → En preparación →
  Enviado → Entregado, más `cancelado`). `GET /api/ordertrack/code/:code` es público y devuelve una vista
  **saneada** (solo nombre de pila y estado, **sin email/detalle**). Se **siembra** `OT-DEMO01` con
  `db.seedIfEmpty` para que el tracker sea usable sin datos. Los pedidos los crea el negocio: con `auth`,
  `GET /api/ordertrack` (lista + `states`), `POST /api/ordertrack` (`requireAdmin`, valida `customer`,
  genera `OT-` con `crypto`), `PATCH /api/ordertrack/:id` (estado con `oneOf` incluyendo `cancelado`, y
  nota) y página `/pedidos.html` con alta en `<details>`, `<select>` de estado inline por fila, filtro y
  CSV. Anima el relleno de la línea con red de seguridad. Colección `orders`. Preview con datos demo.

### test + docs
- Registro OK: **131 módulos** (100 UI · 31 funcionales); los 4 nuevos con `usesAnime`.
- 3 variantes generadas y `node --check` **sin errores** en todos los JS: full (auth + reveal/Motion +
  los-4, 34 archivos, Anime y Motion conviviendo), sin-auth (19 archivos, `/seguimiento.html` presente,
  sin paneles admin), Vercel+Supabase+auth (37 archivos, las 5 colecciones nuevas en `schema.sql`).
  Inlineado seguro (0 `</script>`/`</style>` en `app.js`).
- Backend real servido en Express (:4720): públicos (callback/loyalty/raffle/ordertrack) + POST con casos
  válidos/ inválidos (422), idempotencia, `409` de sorteo cerrado y canje sin meta, admin `401` sin token
  y OK con token de admin (stamp/redeem, draw/reopen, create/patch). Smoke en navegador real: 0 errores de
  consola, `anime`+`Motion` cargados, secciones con datos vivos y timeline de `/seguimiento.html` al 33 %.
- [PROGRESO.md](PROGRESO.md): nueva corrida 20ª con tabla del lote, resultados de prueba y pendientes.

## 2026-07-14 (19ª corrida)

> Lote de **4 módulos funcionales nuevos con backend real** (`eventregister`, `referrals`, `qanda`,
> `restock`) — según la directiva de no sumar funcionalidad sin backend. Los 4 usan **Anime.js**
> (`usesAnime`) con red de seguridad `setTimeout` y respetan `prefers-reduced-motion`. Todos siguen el
> **patrón admin-por-`auth`** de `tickets`/`leads`: la parte pública funciona anónima; con el módulo
> `auth` activo suman una página solo-admin (route condicional con `requireAdmin` + navbar oculta para
> no-admin). Ninguno se revirtió. Catálogo: **100 UI · 27 funcionales = 127 módulos**.

### feat(functional/eventregister): inscripción a eventos con cupos
- [modules/functional/eventregister.js](modules/functional/eventregister.js): módulo nuevo, `usesAnime`.
  Sección en la Home que lista eventos (constante `EVENTOS` editable, embebida en el route con
  `JSON.stringify`) y deja anotarse con nombre+email. `GET /api/eventregister` devuelve cada evento con
  `taken`/`remaining`; `POST /api/eventregister` valida, controla el **cupo del lado del servidor**
  (409 si está completo), es **idempotente por evento+email** (devuelve el mismo `EV-XXXXXX` con
  `already:true`) y baja `remaining`. Colección `eventregistrations`. Los lugares disponibles cuentan
  con count-up y la barra de ocupación se anima (**Anime.js** + red de seguridad). **Backend
  condicional**: con `auth`, `GET /api/eventregister/all` (`requireAdmin`, filtro `?eventId=`,
  enriquecido con `eventTitle`) y página `/inscripciones.html` con tabla, filtro por evento y CSV
  (separador `;` + BOM). Una inscripción por navegador (`localStorage`). Preview con datos demo.

### feat(functional/referrals): programa de referidos con código y link
- [modules/functional/referrals.js](modules/functional/referrals.js): módulo nuevo, `usesAnime`. Sección
  "Recomendá y ganá": `POST /api/referrals/join` `{email}` crea (idempotente) un miembro con **código
  corto legible** (alfabeto sin 0/O/1/I, reintenta ante colisión) y devuelve su conteo. El cliente arma
  el link `location.origin + '/?ref=CODIGO'` con botones de WhatsApp/email/copiar. En **cualquier
  página** se lee `?ref=` de la URL y se guarda en `localStorage` (`rf-invitadoPor`) si el visitante no
  es ya miembro; al anotarse, `POST /api/referrals/refer` `{code, email}` **acredita el referido** a
  quien invitó — **un crédito por email referido** (idempotente global) y **bloquea la auto-referencia**
  (`ok:false, reason:'self'|'dup'`). `GET /api/referrals/stats?code=` es el conteo público. Colecciones
  `referrals` + `referralhits`. Contador con count-up (**Anime.js** + red de seguridad). **Backend
  condicional**: con `auth`, `GET /api/referrals` (`requireAdmin`) devuelve el **ranking** ordenado por
  cantidad y `/referidos.html` lo muestra con CSV.

### feat(functional/qanda): preguntas del público con moderación
- [modules/functional/qanda.js](modules/functional/qanda.js): módulo nuevo, `usesAnime`. Muro Q&A:
  `POST /api/qanda` `{question, name?}` deja la pregunta **pendiente** (`published:false`);
  `GET /api/qanda` devuelve solo las **respondidas y publicadas** (vista pública sin datos internos).
  Colección `questions`. En la Home, form de envío + **acordeón** de respondidas que abre/cierra
  animando `height` (**Anime.js** + red de seguridad; con `prefers-reduced-motion` cambia a `height:auto`
  directo). **Backend condicional**: con `auth`, `GET /api/qanda/all` (todas, incl. pendientes),
  `PATCH /api/qanda/:id` (responder + publicar) y `DELETE /api/qanda/:id`, todos `requireAdmin`; página
  `/preguntas.html` con textarea de respuesta, checkbox "publicada", guardar y borrar por pregunta.

### feat(functional/restock): avisos de stock ("avisame cuando vuelva")
- [modules/functional/restock.js](modules/functional/restock.js): módulo nuevo, `usesAnime`. Lista
  productos agotados (constante `PRODUCTOS` editable en el route) y capta emails para avisar cuando
  vuelvan. `GET /api/restock` devuelve cada producto con `waiting` (interesados **no avisados**);
  `POST /api/restock` `{product, email}` es **idempotente por producto+email**. Colección
  `restockrequests` con flag `notified`. El contador de "personas esperando" cuenta con count-up
  (**Anime.js** + red de seguridad). **Backend condicional**: con `auth`, `GET /api/restock/all`
  (`requireAdmin`, filtro `?product=`, con `productName`) y `PATCH /api/restock/notified` `{product}`
  que marca avisados a todos los pendientes de ese producto; página `/avisos-stock.html` con tabla,
  filtro, botón "marcar como avisado" y CSV para mandar el mail al reponer. Un pedido por navegador.

### test(19ª): generación, node --check y prueba de backend real end-to-end
- 3 variantes generadas y verificadas: **full** (hero + reveal/Motion + auth + los 4 = 33 archivos, con
  Anime y Motion conviviendo y las 4 páginas admin), **sin-auth** (18 archivos, parte pública sin
  paneles, `anime.js` presente y `motion.js` ausente) y **Vercel+Supabase + auth + los 4** (35 archivos,
  fuerza `persistence:supabase`). `node --check` en los 18 JS de cada variante = 0 errores; `app.js`
  generado sin `</script>`/`</style>` inlineados.
- **Backend real** servido con Express en :4713 (proyecto full): probados los caminos válidos e
  inválidos de las 8+ rutas nuevas (201/200/409/404/422 según corresponde), idempotencias, control de
  cupo, acreditación/auto-referencia/duplicado de referidos, ciclo pendiente→publicada de qanda,
  marcado de avisados de restock, y **401 sin token** vs. filas con token de admin en los 4 endpoints
  `requireAdmin` (primer usuario registrado = admin). **Smoke test en navegador real**: 0 errores de
  consola, `anime`+`Motion` cargados, las 4 secciones con datos vivos del servidor, y flujo de referidos
  completo por UI (submit → panel con link `?ref=` válido → count-up → copiar) persistido en el backend.

## 2026-07-13 (18ª corrida)

> Lote de **4 módulos funcionales nuevos con backend real** (`polls`, `tickets`, `feedback`,
> `leads`) — según la directiva de no sumar funcionalidad sin backend — más un **paquete de
> mejoras UX pedidas por el usuario en vivo**: toggle de precios animado, login y registro en
> páginas separadas, efectos de hover de tarjetas seleccionables desde el Builder y formularios
> excluidos del hover (con animaciones propias de campos y botones). Ninguno se revirtió.

### feat(functional/polls): encuestas y votaciones con votos en el servidor
- [modules/functional/polls.js](modules/functional/polls.js): módulo nuevo, `usesAnime`. Sección en la
  Home cuya encuesta persiste los votos en el servidor (colecciones `polls` + `pollvotes`): los
  resultados suman entre todos los visitantes. `GET /api/polls` (encuestas activas con conteo por
  opción) y `POST /api/polls/:id/vote` (voto anónimo validado contra las opciones reales). La encuesta
  de ejemplo se siembra en el **primer request** (no al cargar el módulo, para no soltar promesas en el
  arranque con el driver Supabase). Un voto por navegador (`localStorage`; sin login no hay dedupe
  fuerte, avisado en el README). Resultados con barras y porcentajes en count-up (**Anime.js** + red de
  seguridad `setTimeout`); marca "tu voto" en la opción propia. En preview del Builder usa datos demo.

### feat(functional/tickets): soporte con código de seguimiento
- [modules/functional/tickets.js](modules/functional/tickets.js): módulo nuevo, `usesAnime`. Página
  `/soporte.html` con alta de reclamo (`POST /api/tickets`, devuelve código `TK-XXXXXX`) y consulta
  pública por código (`GET /api/tickets/codigo/:code`, case-insensitive, **sin exponer email ni
  detalle**). Estado como línea de progreso de 3 pasos (Recibido → En proceso → Resuelto) con avance
  animado (**Anime.js** + red de seguridad). **Backend condicional**: con `auth` activo emite además
  `GET /api/tickets` y `PATCH /api/tickets/:id` (`requireAdmin`, estados validados) y la página suma un
  panel de gestión solo-admin (select de estado + respuesta por reclamo); sin `auth`, solo rutas
  públicas y aviso en el README. La respuesta del equipo aparece en la consulta pública.

### feat(functional/feedback): "¿te resultó útil esta página?" con votos reales
- [modules/functional/feedback.js](modules/functional/feedback.js): módulo nuevo, `usesAnime`. Widget
  inyectado por JS antes del footer en todas las páginas (mejora progresiva: sin JS no aparece).
  `POST /api/feedback` `{page, util}` (valida que `page` empiece con `/`) y `GET /api/feedback/summary`
  con `{si, no, total, porcentaje}`. Tras votar muestra el **porcentaje real** de utilidad con count-up
  (**Anime.js** + red de seguridad). Un voto por página por navegador; `/` y `/index.html` cuentan como
  la misma página.

### feat(functional/leads): captación de leads centralizada + integración de waitlist/exitpopup
- [modules/functional/leads.js](modules/functional/leads.js): módulo nuevo, `requires: ['auth']`.
  `POST /api/leads` público e **idempotente por email+origen** (patrón newsletter) y `GET /api/leads`
  solo-admin con filtro `?origen=`. Página `/leads.html` (link oculto para no-admins) con tabla, filtro
  por origen y **descarga CSV** (separador `;`, BOM UTF-8, como la bandeja). Cierra el pendiente de la
  15ª/17ª: los formularios de captura guardaban emails solo en `localStorage`.
- [modules/ui/waitlist.js](modules/ui/waitlist.js) y [modules/ui/exitpopup.js](modules/ui/exitpopup.js):
  `clientJs` ahora recibe `cfg`; **con `leads` activo** postean solos a `/api/leads` (origen `waitlist`
  / `exitpopup`, sin bloquear la UX si falla) además del guardado local. `readmeNotes` condicionales.
- [modules/functional/auth.js](modules/functional/auth.js): el overview del panel admin suma las
  colecciones nuevas (`polls`, `pollvotes`, `tickets`, `feedback`, `leads`).

### feat(ui/pricing): interruptor mensual/anual animado (pedido del usuario)
- [modules/ui/pricing.js](modules/ui/pricing.js): ahora `usesAnime`. El switch recibe un **pulgar
  deslizante** (`.price-thumb`, inyectado por JS, desliza con CSS transition midiendo
  `offsetLeft/offsetWidth`, recalculado en `resize`); el botón activo queda transparente con JS
  (`.con-pulgar`) y conserva su fondo sin JS. El cambio de período hace **count-up/count-down** del
  importe con `anime.animate` sobre un objeto de estado (nuevo `<span class="price-num">`) + pulso de
  escala del `.price` + pop de la insignia "2 meses gratis" al pasar a anual. Red de seguridad
  `setTimeout(680)` por precio que fija número/sufijo/`data-visible` con el loop pausado (pestaña
  oculta); con `prefers-reduced-motion` o sin Anime pinta directo. Clic en el período ya activo es no-op.

### feat(functional/auth): login y registro en páginas separadas (pedido del usuario)
- [modules/functional/auth.js](modules/functional/auth.js): `/auth.html` queda **solo con el login**
  (card centrada de 420px + enlace "¿No tenés cuenta? Creá una" → `/registro.html`) y la nueva página
  `/registro.html` tiene **solo el registro** (+ enlace de vuelta "¿Ya tenés cuenta? Ingresá"). IDs de
  formularios y `clientJs` intactos: todas las redirecciones existentes a `/auth.html` (dashboard,
  admin, navbar, favoritos, carrito, reseñas, bandeja, leads) siguen siendo válidas porque sigue siendo
  la página de login.
- [modules/ui/seo.js](modules/ui/seo.js): `registro.html` y `leads.html` sumadas a `PRIVADAS` (fuera
  del sitemap, como `auth.html`).

### feat(core): efecto de hover de tarjetas seleccionable + formularios excluidos (pedido del usuario)
- [src/generator.js](src/generator.js): nuevo bloque `cfg.design` con `cardHover` validado contra
  `['lift','glow','aurora','zoom','none']`, default `lift` (configs viejas generan idéntico al efecto
  histórico; valores inválidos caen en `lift`).
- [src/templates.js](src/templates.js): `stylesCss` emite **siempre** (ya no atado al módulo `reveal`)
  un bloque de microinteracciones bajo `@media (prefers-reduced-motion: no-preference)`: springs de
  `.btn`, el efecto de tarjetas elegido y animaciones de formularios. **Selector de exclusión**
  `.card:not(form):not(:has(form, input, select, textarea))`: una card que es o contiene un formulario
  o campos **nunca** recibe el hover (en navegadores sin `:has()` la regla se descarta entera:
  fail-safe, jamás se levanta un form). Efectos: `lift` (levantar + sombra), `glow` (borde acento +
  resplandor), `aurora` (gradiente que se desplaza en loop), `zoom` (escala sutil), `none`. Formularios:
  anillo de foco animado en `input/textarea/select` (borde acento + `box-shadow` con `color-mix`),
  `accent-color` de marca en checks/radios (siempre, fuera del media query: es color, no movimiento) y
  pop `:checked`.
- [public/index.html](public/index.html) + [public/app.js](public/app.js): sección C del Builder
  renombrada "Tipografía y efectos" con el select `#cardfx-select`; `config()` envía
  `design.cardHover` y `applyConfig()` lo repone al cargar un proyecto compartido.

### Pruebas de la corrida
- Generación de 5 variantes (solo-nuevos con `glow`, full con Anime+Motion conviviendo, Vercel+Supabase,
  tickets-sin-auth con `aurora`, y `none` sin reglas de hover): **77 archivos JS, 0 errores** de
  `node --check`, inlineado seguro (0 `</script>`/`</style>`).
- APIs probadas con casos válidos e inválidos (voto 201/422/404, ticket 201/422 + consulta pública
  200/404 + PATCH 401 sin token y 200/422 como admin, feedback 201/422 + summary, leads 201 + duplicado
  idempotente + 422 + GET 401/200) y overview admin con las colecciones nuevas.
- Smoke test en navegador real (proyecto full en :4712): **cero errores de consola**; encuesta votada
  (resultados 50%/50% reales, "tu voto" marcado, barras fijadas por la red de seguridad con pestaña
  oculta); feedback 67% de 3 opiniones reales; alta de reclamo con código emitido y precargado,
  timeline 1/3 → 2/3 pasos con avance 0%→50% y respuesta del equipo visible; panel admin con 2 reclamos
  gestionables; leads con tabla, filtro por origen y nav oculto para anónimos. Toggle de precios:
  pulgar 4px→101px, `$9.999/mes` → `$99.990/año` y vuelta, `aria-pressed` correcto. `/auth.html` solo
  login y `/registro.html` solo registro con sus enlaces cruzados. Exclusión de hover verificada por
  selector en DOM real (4 de 5 cards de la Home con efecto; la de waitlist, que tiene form, excluida).
  Preview del Builder devuelve el CSS de `glow` sin `lift`, la página `registro` y el fallback ante
  `cardHover` inválido.

## 2026-07-12 (17ª corrida)

> Lote de **5 módulos UI nuevos** (`commandpalette`, `productcompare`, `goalmeter`, `quiz`,
> `waitlist`), todos frontend puro y sin dependencias npm nuevas en el proyecto exportado. **4 de los
> 5 usan Anime.js** (`usesAnime`): `commandpalette`, `goalmeter`, `quiz` y `waitlist`. El foco fue
> **navegación rápida, conversión y prueba social** — cerrando dos ideas pendientes de la 16ª
> (buscador global con atajos de teclado y comparador de productos lado a lado). Ninguno se revirtió.

### feat(ui/commandpalette): paleta de comandos / buscador con atajos ⌘K
- [modules/ui/commandpalette.js](modules/ui/commandpalette.js): módulo nuevo, `usesAnime`. Capa de
  navegación rápida que se abre con `Ctrl/Cmd+K` o la tecla `/` (ignora `/` cuando el foco está en un
  campo), y con un botón `🔍 ⌘K` que se inyecta en `.nav-links`. Construye el índice al abrir: links de
  la navbar (grupo "Páginas"), `<h2>` de la página (grupo "En esta página", scroll suave a la sección) y
  la constante editable `ACCIONES` (grupo "Acciones"). Filtro en vivo normalizando acentos (`NFD`),
  navegación ↑↓ con wrap, Enter ejecuta, Esc cierra. Diálogo accesible: `role=dialog`, `aria-modal`,
  `combobox`/`listbox`/`option`, `aria-activedescendant`, foco atrapado (Tab bloqueado) y foco restaurado
  al cerrar. Apertura animada con `anime.animate` (fade + translateY + scale) y red de seguridad
  `setTimeout` que fija el estado final; respeta `prefers-reduced-motion`. Estilos en `head()`.

### feat(ui/productcompare): comparador de productos lado a lado
- [modules/ui/productcompare.js](modules/ui/productcompare.js): módulo nuevo, sin dependencias. Tarjetas
  con checkbox (`.pc-check`) para marcar hasta `MAX=3` productos; al llegar al tope deshabilita los no
  marcados. Arma una `<table>` enfrentada: fila "Precio" + una fila por atributo (claves del primer
  producto), resaltando con `.dif` las filas cuyos valores no coinciden en todas las columnas. Productos
  y atributos en la constante `PRODUCTOS`, embebidos en un `<script type="application/json" id="pc-datos">`
  con `<` escapado a `<` para no romper el HTML. `:has()` en CSS para el estado marcado/deshabilitado;
  la tabla scrollea en horizontal en móvil. Distinto de `comparison` (matriz fija de planes).

### feat(ui/goalmeter): barra de progreso hacia una meta/objetivo
- [modules/ui/goalmeter.js](modules/ui/goalmeter.js): módulo nuevo, `usesAnime`. Barra que se llena y
  número que cuenta hasta `META.actual` cuando la sección entra en pantalla (`IntersectionObserver`, se
  desconecta tras animar). `role=progressbar` con `aria-valuenow`. Valores (título, monto, objetivo,
  prefijo/sufijo, etiquetas, texto del botón) en la constante `META`, pasados al cliente por atributos
  `data-` de la sección; el botón enlaza a `contact`/`quote`/`about` según qué esté activo. Count-up con
  `anime.animate` sobre un objeto de estado (`onUpdate`) más `anime.round`, y ancho de la barra animado de
  `0%` a `pct%`; red de seguridad `setTimeout` fija el estado final. Sin Anime o con `prefers-reduced-motion`
  pinta el estado final directo. Estilos en `head()`.

### feat(ui/quiz): quiz recomendador interactivo
- [modules/ui/quiz.js](modules/ui/quiz.js): módulo nuevo, `usesAnime`. Preguntas de opción única
  (`QUIZ.preguntas`) que suman un voto al `valor` de cada opción; al terminar recomienda el resultado más
  votado (`QUIZ.resultados`) con un CTA cuyo `href` se resuelve a `pricing`/`contact`/`about`. Barra de
  progreso, indicador "Pregunta N de M", botón "volver a empezar" y fallback `<noscript>`. Datos embebidos
  como JSON (`#quiz-datos`, `<` escapado). Transiciones entre pasos con `anime.animate` + `anime.stagger`
  (entrada/salida con dirección según avance) y red de seguridad `setTimeout`; respeta
  `prefers-reduced-motion`. Distinto de `multistep` (que junta datos de un formulario).

### feat(ui/waitlist): lista de espera / "próximamente" con contador
- [modules/ui/waitlist.js](modules/ui/waitlist.js): módulo nuevo, `usesAnime`. Captación de emails para un
  lanzamiento con contador de anotados que cuenta hasta `base + propios` al entrar en pantalla
  (`IntersectionObserver`), como prueba social. `LISTA` (título, descripción, base, textos) editable; la
  base viaja en `data-base`. Al enviar valida el email con regex, guarda `waitlist-email` y
  `waitlist-propios` en `localStorage` (persiste el alta propia entre visitas), suma 1 al contador con un
  count-up corto, oculta el formulario y muestra el mensaje de éxito + toast. Count-up con `anime.animate`
  (`onUpdate`/`onComplete`) y red de seguridad `setTimeout`; sin Anime o con `prefers-reduced-motion` fija
  el valor. Sin backend obligatorio (README explica cómo conectar a newsletter/endpoint).

### chore: verificación del lote
- Registro correcto: **100 UI · 19 funcionales** (95→100 UI). Generación de 3 variantes (solo-los-5,
  full con `reveal`/Motion + `pricing` + `contact`, y Vercel+Supabase+`auth`+`cart`), `node --check` OK en
  fuente y en el `app.js` generado de las tres, 0 secuencias `</script>`/`</style>` en el `app.js`
  inlineado. Smoke test en navegador real sobre el proyecto full servido estático (:4711): 0 errores de
  consola; `anime` y `Motion` cargados; interacción probada de los 5 módulos (⌘K abre/filtra/cierra,
  comparador arma tabla con diferencias, goalmeter cuenta a `$68.000`, quiz devuelve resultado, waitlist
  confirma alta).

## 2026-07-12 (16ª corrida)

> Lote de **5 módulos UI nuevos** (`currency`, `masonry`, `reviewswall`, `agegate`, `socialfeed`),
> todos frontend puro y sin dependencias npm nuevas en el proyecto exportado. **3 de los 5 usan
> Anime.js** (`usesAnime`): `masonry`, `agegate` y `socialfeed`. El foco fue **conversión, prueba
> social y cumplimiento** (selector de moneda sobre los precios, mosaicos y muro de reseñas, barrera
> de edad y feed de redes) — cerrando tres ideas pendientes de la 15ª. Ninguno se revirtió.

### feat(ui/currency): selector de moneda que convierte los precios mostrados
- [modules/ui/currency.js](modules/ui/currency.js): módulo nuevo. Convierte en vivo cualquier elemento
  con `class="js-precio"` y `data-ars="MONTO"` (monto base en pesos) a la moneda elegida, con tasas
  fijas editables en la constante `MONEDAS` (ARS/USD/EUR/BRL) — sin API de cambio, deployable gratis.
  Recuerda la elección en `localStorage` (`moneda-preferida`) y conserva el sufijo `.price-per` (ej:
  "/mes") si el precio lo tiene. Trae una lista de 3 precios de demo para verse/probarse solo. **No
  interfiere** con el switch mensual/anual de `pricing`: ese opera sobre `.price[data-mensual]`, este
  sobre `.js-precio[data-ars]`. Mejora progresiva: sin JS se ve el importe base en pesos.

### feat(ui/masonry): galería tipo mosaico (masonry) con CSS columns
- [modules/ui/masonry.js](modules/ui/masonry.js): módulo nuevo, `usesAnime`. Tarjetas de alturas
  variables en columnas tipo Pinterest usando `columns:3 240px` (layout puro CSS, sin librería de
  masonry). Placeholders con gradiente de proporciones distintas (constante `RATIOS`), reemplazables
  por `<img>`. Entrada en cascada con `anime.animate` + `anime.stagger`, disparada por
  `IntersectionObserver` (baja a `columns:2` en ≤560px). Red de seguridad `setTimeout` que fija el
  estado final si el loop está pausado (pestaña oculta), y respeta `prefers-reduced-motion`.

### feat(ui/reviewswall): muro de reseñas masonry (HTML+CSS puro)
- [modules/ui/reviewswall.js](modules/ui/reviewswall.js): módulo nuevo, sin JS. Muro de reseñas con
  estrellas, autor y origen en columnas `CSS columns` (masonry de texto). Reseñas editables en la
  constante `RESENAS`; estrellas como texto accesible (`aria-label`). Distinto de `testimonials`
  (grilla fija de 3) y `testimonialslider` (carrusel): este es un muro con muchas opiniones de largos
  variables. Baja a 1 columna en ≤560px.

### feat(ui/agegate): verificación de edad (age gate) bloqueante y accesible
- [modules/ui/agegate.js](modules/ui/agegate.js): módulo nuevo, `usesAnime`. Diálogo bloqueante al
  entrar (rubros regulados) con `role=dialog`/`aria-modal`, foco al abrir, Tab atrapado entre los dos
  botones, sin cierre por Esc (es bloqueante) y bloqueo del scroll vía clases `agegate-lock` en
  `html`/`body`. "Sí" guarda `Date.now()` en `localStorage` (`agegate-ok`) por `DIAS_RECORDAR` días y
  cierra con fundido `anime.animate`; "No" muestra mensaje y deshabilita los botones. Entrada del
  diálogo animada (opacity+scale) con red de seguridad. `EDAD_MINIMA`/`DIAS_RECORDAR` editables. Se
  saltea cuando `window.__PREVIEW__` (vista previa del builder) para no bloquear el iframe.

### feat(ui/socialfeed): feed social estilo Instagram con CTA a seguir
- [modules/ui/socialfeed.js](modules/ui/socialfeed.js): módulo nuevo, `usesAnime`. Grilla de
  casilleros cuadrados (`grid-template-columns:repeat(4,1fr)`, baja a 2 en ≤640px) con overlay de "me
  gusta" al hover/focus (CSS) y botón "Seguinos @usuario" que enlaza al perfil (`target=_blank`
  `rel=noopener`). Placeholders editables (sin API de Instagram): `USUARIO`, `PERFIL` y `POSTS` en el
  módulo. Entrada en cascada con `anime.animate`+`stagger` por `IntersectionObserver` + red de
  seguridad; respeta `prefers-reduced-motion`.

### test: verificación del lote
- Registro OK: **95 UI · 19 funcionales** (antes 90 UI). Generación de 3 variantes (solo-los-5;
  full con Anime+Motion conviviendo; Vercel+Supabase+auth+cart+los-5), `node --check` en fuente y en
  el `app.js` de las tres (0 errores), 0 `</script>`/`</style>` en el `app.js` inlineado. Smoke test en
  navegador real (proyecto generado servido estático): 0 errores de consola; age gate bloquea y al
  confirmar desbloquea (localStorage), currency convierte ARS→USD (`$9.999`→`u$s 8,30`) y persiste,
  masonry/reviewswall/socialfeed renderizan sus 9/7/8 elementos.

## 2026-07-12 (15ª corrida)

> Lote de **5 módulos UI nuevos** (`megamenu`, `multistep`, `catalogo`, `exitpopup`, `megafooter`),
> todos frontend puro y sin dependencias npm nuevas en el proyecto exportado. **4 de los 5 usan
> Anime.js** (`usesAnime`): `megamenu`, `multistep`, `catalogo` y `exitpopup`. El foco fueron
> **patrones de navegación y conversión** que todo sitio comercial usa y que faltaban en el catálogo
> (navegación con submenús, formulario tipo wizard, catálogo con filtros, captura de salida y pie
> ampliado). Además se corrigió un gap del **preview del builder**: ahora inlinea también `anime.js`.
> Ninguno se revirtió.

### fix(preview): inlinear Anime.js en la vista previa del builder
- [src/webapp.js](src/webapp.js): la ruta `/api/preview` inlineaba `motion.js` pero **no** `anime.js`,
  así que los módulos con `usesAnime` no animaban dentro del iframe `srcdoc` de la vista previa (la
  ruta `/js/anime.js` no resuelve ahí). Se agregó el mismo reemplazo por-función que ya tenía Motion,
  con idéntica precaución por el `$` en el código inlineado. El proyecto exportado no cambia (ahí el
  `<script src>` sí resuelve); esto sólo arregla la previsualización.

### feat(modulos): menú desplegable (mega menú) — nuevo (usa Anime.js)
- Nuevo módulo UI `megamenu` ([modules/ui/megamenu.js](modules/ui/megamenu.js)) con `usesAnime: true`:
  **mejora progresiva sobre la navbar** (no toca `layout()`). El `clientJs` inyecta en `.nav-links`
  un disparador con panel desplegable armado desde la lista editable `MENU` (grupos de enlaces).
  Accesible: `aria-haspopup`/`aria-expanded`, teclado (Enter/Espacio/Escape/flechas arriba-abajo,
  Tab que cierra al salir del panel), cierre por clic afuera. Responsive: en escritorio el panel
  **flota** bajo el disparador; en ≤720px (o dentro del menú hamburguesa) se despliega **en línea**.
  Apertura animada con `anime.animate(panel, { opacity, translateY })` + **red de seguridad**
  `setTimeout(260)` y respeto de `prefers-reduced-motion`. Aviso en `readmeNotes`.

### feat(modulos): formulario multi-paso (wizard) — nuevo (usa Anime.js)
- Nuevo módulo UI `multistep` ([modules/ui/multistep.js](modules/ui/multistep.js)) con `usesAnime: true`:
  sección `#multistep` con un `<form>` dividido en `.wizard-paso` (`<fieldset>`), **barra de progreso**,
  **riel de indicadores** armado desde `data-titulo`, y navegación Atrás/Siguiente/Enviar. **Validación
  por paso** con la validación nativa del navegador (`checkValidity`/`reportValidity`): no deja avanzar
  con campos inválidos. El último paso arma un **resumen** (`<dl>`) con todos los datos; al confirmar
  abre un **`mailto`** al `EMAIL_DESTINO` editable con nombre/email/tipo/presupuesto/mensaje ya cargados
  (sin backend, universal y gratis). Transición de paso y avance de barra animados con **Anime.js**
  (`opacity`/`translateX` + `width`) con **red de seguridad** `setTimeout(380)`; respeta
  `prefers-reduced-motion`. Mejora progresiva: sin JS el formulario se ve completo y usable.

### feat(modulos): catálogo filtrable — nuevo (usa Anime.js)
- Nuevo módulo UI `catalogo` ([modules/ui/catalogo.js](modules/ui/catalogo.js)) con `usesAnime: true`:
  sección `#catalogo` con grilla de tarjetas (constante `PRODUCTOS`, editable) con `data-cat`,
  **chips de categoría** que se arman solos desde esos `data-cat`, y **buscador en vivo** que filtra por
  título y descripción (`textContent`). Filtro y búsqueda se combinan; mensaje "sin resultados" cuando
  no hay coincidencias. Entrada de las tarjetas **en cascada** con `anime.animate(items, { opacity,
  translateY, delay: anime.stagger(70) })` (guardando el caso sin `stagger`), con **red de seguridad**
  `setTimeout(1200)` que fija el estado final si el loop está pausado; respeta `prefers-reduced-motion`.
  Sin JS la grilla se ve completa. Distinto de `galleryfilters` (ese filtra la galería de imágenes; este
  es un catálogo de productos/servicios con precio y búsqueda de texto).

### feat(modulos): popup de salida (exit intent) — nuevo (usa Anime.js)
- Nuevo módulo UI `exitpopup` ([modules/ui/exitpopup.js](modules/ui/exitpopup.js)) con `usesAnime: true`:
  detecta la **intención de salida** — `mouseout` con `clientY<=0` en escritorio, o fallback por
  **inactividad** (`inactividadSegundosMovil`, reiniciado por scroll/touch/click) en dispositivos
  `(hover: none)` — y abre un diálogo accesible (`role="dialog"`, foco atrapado, cierre por Esc/afuera/✕,
  foco devuelto) con captura de email. **Frecuencia** por `localStorage` (`frecuenciaDias`): se muestra
  una sola vez por período. Sin backend, el `submit` guarda el email en `localStorage` y avisa por toast
  (el `readmeNotes` explica cómo conectarlo a newsletter/endpoint). Apertura animada con **Anime.js** +
  **red de seguridad** `setTimeout(360)`; respeta `prefers-reduced-motion`. Textos editables en `POPUP`.
  Complementa a `promo` (ese aparece por tiempo/scroll; este reacciona a la salida).

### feat(modulos): mega footer (pre-footer) — nuevo
- Nuevo módulo UI `megafooter` ([modules/ui/megafooter.js](modules/ui/megafooter.js)): banda ancha
  `#megafooter` **antes** del footer mínimo de copyright que ya trae `layout()`, con columna de marca
  (usa `cfg.brand.name`/`tagline`) + 3 columnas de enlaces/contacto. **HTML+CSS puro, sin JS ni
  dependencias**: `grid` que en ≤860px pasa a 2 columnas y en ≤480px a 1. Enlaces y datos editables en
  el HTML. Aviso en `readmeNotes`.

### verificación (15ª)
- Registro: **90 UI · 19 funcionales** (los 5 se autocargan por el registry).
- `node --check` en fuente (5 módulos + `webapp.js`) y en **todo** el JS generado de **3 variantes**
  (solo-los-5 = 14 archivos; full = hero+reveal/Motion+faq/pricing/contact/gallery/galleryfilters+
  navmobile+darkmode+seo+los-5 = 20 archivos, con **Anime y Motion conviviendo**; Vercel+Supabase+
  auth+cart+los-5 = 30 archivos): **0 errores**. Inlineado seguro: **0** `</script>`/`</style>` en el
  `app.js` de las 3 variantes. `anime.js` se emite al activar cualquiera de los 4 que lo usan.
- **Smoke test en navegador real** (variante con los 5 + navmobile, servida por HTTP): **cero errores
  de consola**; los 5 módulos inicializan (mega menú con botón + 2 columnas, wizard con 3 pasos + 3
  indicadores, catálogo con 6 tarjetas + 4 chips, mega footer con 3 columnas, exit popup aún cerrado).
  **Interacción probada**: el mega menú abre (`aria-expanded=true`, panel `.abierto`); el wizard
  **bloquea** el avance con campos vacíos y **avanza** al completarlos (barra 33%); el catálogo filtra
  por categoría (sólo tarjetas de esa `data-cat`) y por búsqueda ("tienda" → 1 resultado); el exit
  popup **abre** al simular `mouseout` por arriba y muestra el input de email. Sin módulos revertidos.
  *Nota de entorno*: la captura de pantalla del pane headless se colgó (renderer), pero la consola
  quedó limpia y toda la verificación funcional se hizo por DOM/JS.

## 2026-07-12 (14ª corrida)

> Lote de **5 módulos UI nuevos** (`lazyload`, `modal`, `readmore`, `tooltip`, `whatsappform`),
> todos frontend puro y sin dependencias npm nuevas en el proyecto exportado. **2 de los 5 usan
> Anime.js** (`usesAnime`): `modal` (apertura/cierre) y `readmore` (altura). El foco fueron
> **utilidades de UX reutilizables** que faltaban en el catálogo. Ninguno se revirtió.

### feat(modulos): carga diferida de imágenes — nuevo
- Nuevo módulo UI `lazyload` ([modules/ui/lazyload.js](modules/ui/lazyload.js)): **no aporta HTML**,
  es puro comportamiento. Recorre las `img:not([data-nolazy])`, les agrega `loading="lazy"` y
  `decoding="async"` (si no los traen) y les da un **fundido de entrada** al aparecer, vía
  IntersectionObserver (`rootMargin: 120px`). Mejora progresiva: el estado inicial `opacity:0` sólo
  se aplica a imágenes que el JS marcó con `.lazy-img`, así **sin JS nada queda oculto**. Si la
  imagen ya está en caché (`complete && naturalWidth>0`) se muestra sin fundido; `prefers-reduced-
  motion` y falta de soporte → se ven de una. **Red de seguridad** `setTimeout(3000)` que muestra
  cualquier `.lazy-img` que haya quedado sin dispararse. Con `data-nolazy` una imagen se excluye.

### feat(modulos): ventanas modales — nuevo (usa Anime.js)
- Nuevo módulo UI `modal` ([modules/ui/modal.js](modules/ui/modal.js)) con `usesAnime: true`:
  overlay **único** para todo el sitio, construido por JS y reutilizable. Accesible: `role="dialog"`
  + `aria-modal`, **foco atrapado** (trap de Tab entre los focusables de la caja), cierre con **Esc**,
  **clic en el fondo** y botón ✕, y **foco devuelto** al elemento que lo abrió. Dos formas de uso:
  disparadores declarativos `data-modal-target="#id"` (clona el `innerHTML` del bloque oculto, usa
  `data-modal-titulo` o el texto del trigger como título) y API programática
  `window.abrirModal({titulo, html})` / `window.cerrarModal()`.
- Animación con **Anime.js**: apertura = overlay `opacity 0→1` + caja `scale .92→1`/`translateY 12→0`
  (`outCubic`); cierre inverso con `onComplete` que limpia y devuelve el foco. **Red de seguridad**
  `setTimeout` en ambos que fija el estado final aunque el loop esté pausado (pestaña oculta). Sin
  Anime o con `prefers-reduced-motion` abre/cierra sin animar. Sección de demo editable
  (`#modal-demo`, términos y condiciones) y aviso en `readmeNotes`.

### feat(modulos): leer más — nuevo (usa Anime.js)
- Nuevo módulo UI `readmore` ([modules/ui/readmore.js](modules/ui/readmore.js)) con
  `usesAnime: true`: recorta cualquier `[data-readmore="N"]` a N líneas (calcula `lineHeight × N`),
  agrega un **degradado al pie** (`.readmore-fade`) y un botón "Leer más/menos". Mejora progresiva:
  el recorte lo agrega el JS (`.readmore-activo` + `height` fija), así que **sin JS el texto queda
  completo**; si el contenido ya entra en el alto plegado, no recorta. Al togglear mide el alto real
  (`height:auto` momentáneo) y **anima la altura** con `anime.animate(el, { height: [...], ease:
  'inOutQuad' })`, dejando `height:auto` al expandir. `aria-expanded` en el botón. **Red de
  seguridad** `setTimeout(380)` + respeta `prefers-reduced-motion`. Demo editable (`#leer-mas`).

### feat(modulos): globos de ayuda (tooltips) — nuevo
- Nuevo módulo UI `tooltip` ([modules/ui/tooltip.js](modules/ui/tooltip.js)): globo **único**
  compartido (`.tooltip-bubble`) para todo elemento con `data-tooltip="texto"`. Se muestra por
  delegación en `mouseover`, **`focusin`** (teclado) y **`touchstart`** (móvil); se oculta en
  `mouseout`, `focusout`, **Esc** y `scroll`. Posicionado por JS con `position:fixed`: centrado sobre
  el elemento, **clamp** horizontal al viewport y arriba por defecto / abajo si no entra. Accesible:
  vincula `aria-describedby` al globo. El fundido es **por CSS** (no se instancia una animación de
  librería en cada hover, por rendimiento). Degrada sin romper (el texto queda en el atributo). Demo
  editable (`#tooltips-demo`) y aviso en `readmeNotes`.

### feat(modulos): formulario a WhatsApp — nuevo
- Nuevo módulo UI `whatsappform` ([modules/ui/whatsappform.js](modules/ui/whatsappform.js)): sección
  `#whatsapp-form` con formulario (nombre, contacto opcional, consulta) que **al enviar arma un
  mensaje y abre `wa.me`** con el texto prellenado hacia el número del negocio. **Sin backend ni API
  keys** (solo el link público de WhatsApp), pensado para captar consultas en sitios chicos
  deployados gratis. Valida nombre + consulta (errores inline), agrega el ícono de WhatsApp al botón
  y usa `App.toast` si está disponible. Distinto del módulo `whatsapp` (botón flotante que abre un
  chat vacío): acá viajan los datos del formulario. El número se edita en `public/js/app.js`
  (constante local `NUMERO_WHATSAPP`, formato internacional sin `+`); aviso en `readmeNotes`.

### test(lote-14): verificación completa
- Registro **85 UI · 19 funcionales**; los 5 nuevos cargan (`usesAnime` correcto en `modal`/`readmore`).
- Generación de 3 variantes (solo-los-5 = 14 archivos; full con Motion+Anime conviviendo = 20; y
  Vercel+Supabase+auth+cart = 30) con `node --check` sobre **todo** el JS generado (0 errores) e
  inlineado seguro (0 `</script>`/`</style>` en el JS). `anime.js` se emite al activar `modal`.
- **Smoke test en navegador real** (full servido por HTTP): **0 errores de consola**; se probó abrir
  la modal (título + contenido clonado, cierre por API), el toggle de `readmore` ("Leer más"↔"Leer
  menos"), el tooltip (texto correcto + `aria-describedby` en hover) y, con imágenes reales,
  `lazyload` (`loading=lazy`/`decoding=async`, `opacity:1`, y `data-nolazy` intacto).

## 2026-07-12 (13ª corrida)

> Lote de **5 módulos UI nuevos** (`skillbars`, `flipcards`, `parallax`, `sectionnav`, `scrollcue`),
> todos frontend puro y sin dependencias npm nuevas en el proyecto exportado. **2 de los 5 usan
> Anime.js** (`usesAnime`): `skillbars` (relleno de barras) y `scrollcue` (rebote de la flecha).
> Ninguno se revirtió.

### feat(modulos): barras de capacidades — nuevo (usa Anime.js)
- Nuevo módulo UI `skillbars` ([modules/ui/skillbars.js](modules/ui/skillbars.js)) con
  `usesAnime: true`: sección `#capacidades` con barras horizontales (`.skillbar-fill`) cuyo ancho
  final ya viene en el `style` inline del HTML (más el `%` visible), así que **sin JS o con
  `prefers-reduced-motion` se ven completas**. El `clientJs` las pone en `0%` sólo al iniciar y,
  vía IntersectionObserver (umbral 0.35), anima cada una con `anime.animate(fill, { width: ['0%',
  nivel+'%'], ease: 'out(3)' })`, sincronizando el número de porcentaje en `onUpdate`.
- **Red de seguridad** (igual patrón que `estimator`/`counters`): un `setTimeout(1300)` dentro del
  callback del observer fija el ancho final aunque el motor de Anime esté pausado (pestaña oculta).
  Datos placeholder editables (`CAPACIDADES`), aviso en `readmeNotes`.

### feat(modulos): tarjetas giratorias — nuevo
- Nuevo módulo UI `flipcards` ([modules/ui/flipcards.js](modules/ui/flipcards.js)): grilla
  `#beneficios` de tarjetas con giro 3D **100% CSS** (`perspective` + `transform-style:
  preserve-3d` + `rotateY(180deg)` en `:hover`/`:focus-within`/`.is-flipped`, con
  `backface-visibility:hidden`). El `clientJs` sólo agrega `classList.toggle('is-flipped')` al
  **clic**, para que en táctil (sin hover) también se pueda voltear; sin JS funciona con mouse y
  teclado. Cada tarjeta es un `<button>` con `aria-label`. `prefers-reduced-motion` acorta la
  transición a `.001ms`. Placeholders en `TARJETAS`, aviso en `readmeNotes`.

### feat(modulos): banda parallax — nuevo
- Nuevo módulo UI `parallax` ([modules/ui/parallax.js](modules/ui/parallax.js)): banda `.parallax`
  a todo el ancho con el `tagline` de la marca y 3 capas difuminadas (`.parallax-capa` con
  `data-veloc`) que se desplazan a distinta velocidad según la posición de scroll de la banda.
  Atado al **scroll continuo**, por eso `requestAnimationFrame` directo y no Anime/Motion (que
  animan por tiempo, no por posición). Sólo escucha `scroll`/`resize` mientras la banda está en
  pantalla (IntersectionObserver) y colapsa múltiples eventos en un solo frame (flag `pendiente`).
  Con `prefers-reduced-motion` no engancha el scroll: queda estática y legible.

### feat(modulos): navegación por puntos (scrollspy) — nuevo
- Nuevo módulo UI `sectionnav` ([modules/ui/sectionnav.js](modules/ui/sectionnav.js)): no aporta
  HTML; el `clientJs` arma un riel `.dotnav` (`position:fixed`, derecha) con un punto por cada
  `<section id>` de la página, etiquetado con el primer encabezado de la sección (tooltip en
  `:hover`/`:focus-visible`). IntersectionObserver con umbrales `[0.15, 0.5, 0.85]` marca como
  `.activo` la sección con mayor porción visible; el clic hace `scrollIntoView` suave (instantáneo
  con `prefers-reduced-motion`). Se auto-suprime con **menos de 3 secciones** o en pantallas
  **≤900px**. Al ser por-página, crece solo con los módulos activos.

### feat(modulos): indicador de scroll — nuevo (usa Anime.js)
- Nuevo módulo UI `scrollcue` ([modules/ui/scrollcue.js](modules/ui/scrollcue.js)) con
  `usesAnime: true` y `requires: ['hero']`: el `clientJs` inyecta un `<button class="scrollcue">`
  con una flecha SVG al pie del `.hero` (asegurando `position:relative` en el hero). Al clic baja a
  la primera `<section>` posterior al hero (`scrollIntoView` suave; instantáneo con menos
  movimiento) y se oculta (`.oculto`) apenas `scrollY > 60`. Con Anime disponible rebota en bucle
  (`anime.animate(btn, { translateY: [0, 10], loop: true, alternate: true })`); sin Anime o con
  `prefers-reduced-motion` queda quieta pero **sigue siendo un botón funcional**.

### chore(pruebas): generación y verificación del lote
- Registro OK: **76 UI · 19 funcionales** (antes 71 UI). Tres variantes generadas y `node --check`
  en fuente y en **todo** el JS generado (0 errores): full (20 archivos, Anime+Motion), solo-los-5
  (14 archivos, `scrollcue`→`hero` por `requires`, Anime **sin** Motion) y Vercel+Supabase+auth
  (30 archivos). Inlineado seguro (0 `</script>`/`</style>` en `app.js`). Smoke test en navegador:
  cero errores de consola; `sectionnav` con 5 puntos (1 activo), 4 `flipcards` (toggle al clic
  verificado), 3 capas parallax, `scrollcue` en `.hero` con destino resuelto a `capacidades`, 4
  barras en `0%` al cargar. Las rutas atadas a IntersectionObserver/rAF no se observan animar en el
  preview headless (`innerHeight:0` + loop de Anime pausado), como el `counters` ya existente; en
  navegador real funcionan y las redes de seguridad cubren la pestaña oculta.

## 2026-07-12 (12ª corrida)

> Lote de **5 módulos UI nuevos** (`preloader`, `typewriter`, `branchselector`, `stickynav`,
> `herobg`), todos frontend puro y sin dependencias npm nuevas en el proyecto exportado. **3 de
> los 5 usan Anime.js** (`usesAnime`): `preloader` y `herobg` con adornos de entrada/flotado, y
> `branchselector` con un fundido de ficha. Ninguno se revirtió.

### feat(modulos): pantalla de carga — nuevo (usa Anime.js)
- Nuevo módulo UI `preloader` ([modules/ui/preloader.js](modules/ui/preloader.js)) con
  `usesAnime: true`: overlay a pantalla completa (`position:fixed;inset:0;z-index:9999`) con el
  nombre de marca y un spinner CSS. El `clientJs` lo oculta cuando la página cargó (`window.load`
  o, si ya está lista, en el próximo tick) agregando `.oculto` y removiéndolo del DOM.
- **Doble red de seguridad** para no dejar nunca el sitio tapado: (1) un `@keyframes preloader-red`
  CSS que desvanece el overlay a los ~3s **aunque el JS no corra**, y (2) un `setTimeout(3000)` en
  JS. El hide por JS hace `pl.style.animation='none'` antes de fundir, para no chocar con la
  animación CSS. La entrada del logo (`anime.animate` opacidad+escala) es puro adorno: si Anime
  está pausado (pestaña oculta) el overlay igual se remueve por `setTimeout`, así que no hay flash
  atascado. Respeta `prefers-reduced-motion` (spinner más lento, sin animar el logo).

### feat(modulos): titular con palabras rotativas — nuevo
- Nuevo módulo UI `typewriter` ([modules/ui/typewriter.js](modules/ui/typewriter.js)): franja con
  un titular donde una palabra se reescribe letra a letra (efecto máquina de escribir) rotando la
  lista `PALABRAS`. Vanilla JS a propósito (escritura carácter a carácter, la herramienta correcta;
  no fuerza Anime.js). Cursor con `::after` que parpadea sólo con `prefers-reduced-motion:
  no-preference`; con menos movimiento muestra la primera palabra fija. Sin JS queda el texto del
  HTML. Aviso en README (editar `PALABRAS`).

### feat(modulos): selector de sucursal — nuevo (usa Anime.js)
- Nuevo módulo UI `branchselector` ([modules/ui/branchselector.js](modules/ui/branchselector.js))
  con `usesAnime: true`: `<select>` de sucursales que repinta una ficha con dirección, horario,
  teléfono (`tel:`) y botón "Cómo llegar" que abre **Google Maps por búsqueda de dirección**
  (`/maps/search/?api=1&query=` — sin API key ni SDK). La elección se recuerda en `localStorage`
  (`sucursal-elegida`). Datos de sedes placeholder en la const `SUCURSALES` (avisado en README).
- La ficha entra con un fundido corto (`anime.animate` opacidad+translateY). **Red de seguridad**
  (patrón de `reveal`/`estimator`): `setTimeout(450)` que fuerza `opacity=''`/`transform=''`, para
  que la ficha nunca quede invisible si Anime está pausado (pestaña en segundo plano).

### feat(modulos): navbar inteligente al scroll — nuevo
- Nuevo módulo UI `stickynav` ([modules/ui/stickynav.js](modules/ui/stickynav.js)): agrega/quita
  clases a la `.navbar` existente según el scroll — `.nav-scrolled` (sombra + navbar más compacta,
  `height:54px`) pasados 8px, y `.nav-hidden` (`translateY(-100%)`) al bajar más de 200px, que se
  quita al subir. No aporta HTML (sólo comportamiento + `<style>` en el head). El toggle es
  **directo, sin `requestAnimationFrame`** (son sólo clases): así funciona igual con la pestaña en
  segundo plano —donde rAF se pausa— siguiendo la convención de `mobilecta`. Con
  `prefers-reduced-motion` el CSS neutraliza el `translate` (no se oculta). Sin JS, navbar normal.

### feat(modulos): fondo animado del hero — nuevo (usa Anime.js)
- Nuevo módulo UI `herobg` ([modules/ui/herobg.js](modules/ui/herobg.js)) con `usesAnime: true` y
  `requires: ['hero']`: inyecta desde JS una capa de 3 manchas difuminadas (`filter:blur`) dentro
  de `.hero` (nunca en el HTML, para no ensuciar el markup). El `head()` pone `.hero` en
  `position:relative;overflow:hidden` y sube el `.container` a `z-index:1` para que el texto quede
  por encima. Las manchas ya se ven quietas sólo con CSS; Anime.js las hace flotar en bucle
  (`loop:true, alternate:true, ease:'inOutSine'`, recorridos distintos por mancha). Si no hay
  `.hero`, o Anime no está, o `prefers-reduced-motion`: quedan quietas y el texto se lee igual.

### Prueba
- Registro OK: **71 módulos UI · 19 funcionales** (66 → 71).
- Generación de 3 variantes con el lote: **full** (hero+lote+reveal/Motion+cart+darkmode+i18n+seo,
  33 archivos), **soloNuevos** (14 archivos; `herobg` arrastra `hero` por `requires`, activa
  Anime **sin** Motion) y **Vercel** (deploy vercel + supabase, 31 archivos). `node --check` en
  fuente y en **los 44** archivos JS generados de las tres variantes: **0 errores**. Inlineado
  seguro (sin `</` + `script>`/`style>` en `app.js`).
- Smoke test en navegador real (servidor estático): typewriter escribiendo, `branchselector`
  cambia de sede y persiste en `localStorage` (`sucursal-elegida=2`) con link de Maps correcto y
  ficha en `opacity:1` (red de seguridad OK **con la pestaña oculta**), `stickynav` alterna
  `nav-scrolled`/`nav-hidden` al bajar y vuelve a mostrarse al subir, `herobg` con **3 manchas**
  dentro de `.hero`, `preloader` removido tras la carga. En `about.html` (sin hero) `herobg`
  degrada sin romper (0 manchas) y la navbar sigue. **Cero errores de consola** en Home y About,
  con `anime.js` y `motion.js` conviviendo.

## 2026-07-11 (11ª corrida)

> Lote de **4 módulos UI nuevos** (`payments`, `events`, `resources`, `estimator`), la
> **mejora del módulo `faq`** con datos estructurados FAQPage (SEO), y la **integración de
> Anime.js v4** en el generador como segunda librería de animación vendorizada (activable por
> módulo con `usesAnime`). Todo frontend puro, sin dependencias npm nuevas en el proyecto
> exportado (Anime.js es un asset estático, igual que Motion). Ninguno se revirtió.

### feat(core): Anime.js vendorizada y activable por módulo
- [src/templates.js](src/templates.js): nuevo `ANIME_LIB` que lee `public/vendor/anime.js`
  (bundle UMD v4.5.0, expone `window.anime`) con el mismo patrón que `MOTION_LIB`. El `layout()`
  agrega `<script src="/js/anime.js">` cuando `cfg.anime` es true (antes de `app.js`). Se exporta
  `ANIME_LIB`.
- [src/generator.js](src/generator.js): `normalize()` calcula `cfg.anime = algún módulo con
  `usesAnime` && Boolean(T.ANIME_LIB)`. A diferencia de `cfg.motion` (atado a `reveal`), Anime se
  activa por-módulo: cualquiera que declare `usesAnime: true` la trae. `generate()` emite
  `public/js/anime.js` cuando `cfg.anime`.
- [public/vendor/anime.js](public/vendor/anime.js): copia del bundle `anime.umd.min.js` de
  `animejs@4.5.0` (agregado a las dependencias del Builder). Convive con `motion.js` sin choques.

### feat(modulos): calculadora de presupuesto — nuevo (usa Anime.js)
- Nuevo módulo UI `estimator` ([modules/ui/estimator.js](modules/ui/estimator.js)) con
  `usesAnime: true`: select de plan (precios base en `value`/`data-base`), slider de cantidad y
  checkboxes de extras/urgencia. El `clientJs` recalcula el total en cada cambio y lo anima con
  count-up (`anime.animate` sobre un objeto `{v}`, `onUpdate`→pinta, `onComplete`→fija). Formato
  de moneda con `Intl.NumberFormat('es-AR')` y fallback manual.
- **Red de seguridad** (patrón tomado de `reveal`): tras lanzar la animación, un
  `setTimeout(650)` fuerza el valor final. Necesario porque el motor de Anime.js pausa su loop
  cuando `document.hidden` (pestaña en segundo plano): sin esa red, `onUpdate`/`onComplete` no
  corren y el total quedaba en `$0`. Con la red, el valor final siempre es correcto; con
  `prefers-reduced-motion` o sin librería salta directo. Todo el cálculo es frontend puro.

### feat(modulos): medios de pago — nuevo
- Nuevo módulo UI `payments` ([modules/ui/payments.js](modules/ui/payments.js)): banda "Aceptamos
  estos medios de pago" con 6 chips (Visa, Mastercard, Amex, Mercado Pago, transferencia,
  efectivo) dibujados con **SVG inline propio** (formas simples, no logos oficiales, sin assets
  externos). Estática; estilos vía `head()`. Aviso en README para dejar solo los medios reales.

### feat(modulos): próximos eventos — nuevo
- Nuevo módulo UI `events` ([modules/ui/events.js](modules/ui/events.js)): sección "Próximos
  eventos" con tarjetas `.card` (badge de fecha día+mes en color de acento, hora, lugar y CTA a
  contacto/nosotros). 3 eventos placeholder editables. Estática; al usar `.card`, el módulo
  `reveal` (si está activo) las anima al scroll. Estilos vía `head()`.

### feat(modulos): recursos descargables — nuevo
- Nuevo módulo UI `resources` ([modules/ui/resources.js](modules/ui/resources.js)): "Recursos y
  descargas" con tarjetas (ícono SVG, tipo/peso, título, bajada, botón `download`). `href="#"`
  placeholder; aviso en README para apuntar a PDFs reales en `public/`. Pieza de captación de
  leads. Estática, estilos vía `head()`.

### feat(modulos): FAQPage (SEO) en `faq` — mejora
- [modules/ui/faq.js](modules/ui/faq.js): las preguntas/respuestas se movieron a una constante
  `FAQS` que alimenta **tanto** el acordeón `<details>` visible **como** un JSON-LD `FAQPage`
  (schema.org) emitido en el `<head>` de la Home vía `head()` (solo en `/index.html`; los `<` del
  contenido se escapan a `<` para no cerrar el `<script>`). Así el rich result de FAQ nunca
  diverge del contenido.
  Convive con el JSON-LD `Organization` del módulo `seo`.

## 2026-07-11 (10ª corrida)

> Lote de conversión y confianza: **4 módulos UI nuevos** (`mobilecta`, `press`,
> `ratingbanner`, `appbadges`), la **mejora del módulo `pricing`** con interruptor
> mensual/anual (saldando el ítem que quedaba de la sugerencia nº7), y la **adopción del
> módulo huérfano `socialproof`** (avisos de actividad reciente), que la 9ª corrida creó
> pero no documentó. Todo frontend puro, sin backend ni dependencias nuevas; dos módulos
> usan **Motion** con degradación a CSS. Ninguno se revirtió.

### feat(modulos): interruptor mensual/anual en `pricing` — mejora
- [modules/ui/pricing.js](modules/ui/pricing.js): la tabla de planes pasó de HTML estático a
  traer los dos importes por plan en `data-mensual`/`data-anual`. El HTML muestra el mensual
  por defecto (sin JS queda ese, coherente). El anual se calcula como `mensual × 10`
  ("2 meses gratis") y una insignia lo anuncia. El plan "A medida" no tiene importes: el switch
  no lo toca. Nuevo `clientJs` que reescribe **solo** el número y el sufijo (`/mes`↔`/año`) al
  cambiar de periodo, con `aria-pressed` en los botones. Estilos del switch vía `head()`.
- Cierra el último ítem de la sugerencia nº7 (era una modificación del módulo existente, no un
  módulo nuevo). Verificado en navegador: $9.999/mes → $99.990/año → vuelta a mensual.

### feat(modulos): CTA fijo en móvil — nuevo
- Nuevo módulo UI `mobilecta` ([modules/ui/mobilecta.js](modules/ui/mobilecta.js)): barra de
  acción fija al pie **solo en móvil** (`@media (max-width:640px)`). Solo `clientJs`: sin JS no
  aparece nada. El destino del botón principal se resuelve en generación según los módulos
  activos (contacto > presupuesto > nosotros) y el texto acompaña. Si `whatsapp` está activo,
  agrega un segundo botón que **reutiliza el enlace `wa.me` del FAB** existente.
- La barra se arma con `setTimeout(…, 0)` (no `requestAnimationFrame`): así el FAB de WhatsApp,
  creado más adelante en `app.js`, ya está en el DOM al copiar su enlace, **y** sigue
  disparando aunque la pestaña esté oculta (rAF se suspende en ese caso, limitación conocida
  del preview embebido). Entrada deslizante con Motion si está disponible; si no, CSS. Reacciona
  a cambios de viewport (`matchMedia change`). `body.mcta-pad` evita que tape el footer.

### feat(modulos): prensa y certificaciones — nuevo
- Nuevo módulo UI `press` ([modules/ui/press.js](modules/ui/press.js)): franja "Como se vio en"
  con medios (wordmarks tipográficos en escala de grises que se colorean al hover) + una fila de
  sellos de certificación/confianza con ícono SVG inline (escudo SSL, verificado, sustentable,
  calidad). Estática, sin JS. Distinta de `logos` (clientes que confían). Estilos vía `head()`,
  textos placeholder avisados por `readmeNotes`.

### feat(modulos): banner de valoración — nuevo
- Nuevo módulo UI `ratingbanner` ([modules/ui/ratingbanner.js](modules/ui/ratingbanner.js)):
  banda con la nota promedio grande, fila de estrellas (llenas/media/vacías vía `clip` CSS con
  `.st-half`) y cantidad de reseñas. El HTML server-side ya trae el placeholder (4,8 · 250) con
  las estrellas correctas, así que sin JS se ve completo y accesible (`role="img"` + `aria-label`).
- Convivencia con `reviews`: si el módulo está activo, un `clientJs` opcional consulta
  `/api/reviews/summary`, **agrega** todos los productos en una nota global ponderada por cantidad
  y actualiza número, estrellas, total y `aria-label`. Con la API caída o sin reseñas, queda el
  placeholder. Verificado end-to-end: se sembró una reseña real por API y el banner pasó a
  "5 · 1 reseña" al recargar. Mismo patrón que la integración testimonios↔reseñas.

### feat(modulos): descarga de app — nuevo
- Nuevo módulo UI `appbadges` ([modules/ui/appbadges.js](modules/ui/appbadges.js)): sección
  "Descargá nuestra app" con los badges de **App Store** y **Google Play** como SVG inline (sin
  imágenes externas ni requests) y un mockup de teléfono con degradado (oculto en móvil). Estática,
  sin JS. Enlaces placeholder (`#`) avisados por `readmeNotes`.

### chore(modulos): adopción de `socialproof` (huérfano de la 9ª)
- [modules/ui/socialproof.js](modules/ui/socialproof.js): estaba escrito y con sintaxis válida
  desde la 9ª corrida (usa Motion) pero sin probar ni documentar. Se verificó completo: avisos
  flotantes de actividad reciente abajo a la izquierda, rotación **determinista** (recorre la
  lista en orden, no al azar), cierre recordado por sesión, entrada con Motion (fallback CSS) y
  respeto de `prefers-reduced-motion`. Smoke test en navegador: "Sofía de Córdoba reservó un
  turno · hace 2 min". Textos placeholder avisados por `readmeNotes`. Cubre el primer ítem de la
  sugerencia nº8 del backlog.

### test(corrida)
- Registro: **62 módulos UI · 19 funcionales**. Generación del proyecto de prueba (los 5 del lote
  + `socialproof` + módulos que interactúan). `node --check` en la fuente y en **todo** el JS
  generado (incluida la variante "solo los 5 nuevos" y la variante Vercel+Supabase). Servidor
  levantado con páginas y `sitemap.xml` en 200, API de reseñas 201. Inlineado seguro (sin
  `</script>` ni `</style>` en el bundle). Smoke test en navegador real: switch de precios ida y
  vuelta, banner de valoración con datos reales tras sembrar una reseña, CTA móvil con enlace
  `wa.me` correcto y link a contacto, prensa/certificaciones, 2 badges de tienda, aviso de
  actividad reciente. **Cero errores de consola** conviviendo con reveal/Motion, darkmode,
  navmobile, whatsapp, i18n y seo.

## 2026-07-11 (9ª corrida)

> Se integró la librería **Motion** (motion.dev, v12) al Builder y a los proyectos que
> genera. La librería se **vendoriza** como asset estático ([public/vendor/motion.js](public/vendor/motion.js),
> build UMD de 139 KB): el Builder la sirve tal cual y los proyectos generados reciben una
> copia en `public/js/motion.js`. Es un asset, **no** una dependencia npm: el proyecto
> exportado sigue teniendo una sola dependencia (`express`) y corre 100% offline. Todo
> respeta `prefers-reduced-motion` y degrada a contenido visible sin JS. De paso se corrigió
> un bug preexistente del preview. `npm install motion` quedó en las dependencias del Builder.

### feat(builder): animaciones del panel con Motion
- [public/index.html](public/index.html): se carga `/vendor/motion.js` antes de `/app.js`.
- [public/app.js](public/app.js): nueva capa `FX` sobre `window.Motion` con guarda de
  `prefers-reduced-motion` y no-op si la librería no cargó. Anima la entrada de la barra
  superior y de los bloques del panel en cascada (`stagger`), un rebote al marcar/desmarcar
  módulos, el fundido del iframe al entrar un preview nuevo, la aparición en cascada de la
  lista de módulos, y microinteracciones hover/press (spring) en botones de exportar, tabs
  de página y ítems de módulo (se reenganchan tras cada re-render de tabs). `reveal` pasó a
  estar seleccionado por defecto.
- [public/styles.css](public/styles.css): sombras/borde al hover (sin tocar `transform`, que
  lo maneja Motion), `will-change` y apagado de transiciones con `prefers-reduced-motion`.

### feat(modulos): `reveal` reescrito como "Animaciones (Motion)"
- [modules/ui/reveal.js](modules/ui/reveal.js): antes hacía reveal al scroll con
  IntersectionObserver + transición CSS; ahora usa Motion. Entrada del hero (título, bajada,
  CTA) en cascada al cargar; reveal al scroll de encabezados, bajadas y tarjetas con cascada
  **por contenedor**; navbar que baja suave. El estado inicial (opacidad 0) se aplica sólo por
  JS, nunca en el HTML. Robustez: guarda de `IntersectionObserver`, **red de seguridad** que
  deja el hero visible en < 1.5 s pase lo que pase, y limpieza del estilo inline al terminar
  cada reveal. Sin retorno en el callback de `inView`: cada elemento se anima una sola vez.

### feat(generador): capa de animaciones activable y vendorizado del asset
- [src/templates.js](src/templates.js): carga única de `public/vendor/motion.js` como
  `MOTION_LIB` (con aviso si falta). `layout()` inyecta `<script src="/js/motion.js">` antes de
  `app.js` cuando el proyecto tiene animaciones. `stylesCss()` agrega microinteracciones CSS de
  `.btn`/`.card` con curva tipo resorte, bajo `@media (prefers-reduced-motion: no-preference)`.
- [src/generator.js](src/generator.js): bandera `cfg.motion` (= módulo `reveal` activo **y**
  librería presente); si está activa, se emite `public/js/motion.js`. Todo gira sobre un único
  toggle (el módulo `reveal`): desactivarlo deja el proyecto sin nada de Motion (100% lean).

### fix(preview): reemplazos por función al inlinear CSS/JS
- [src/webapp.js](src/webapp.js): `/api/preview` inlineaba con `String.replace(str, str)`, y el
  bundle contiene `'$'` (p. ej. `App.money`). En un string de reemplazo, `$&`/`$'`/`` $` ``
  tienen significado especial: el `$'` de `'$'` expandía "el texto posterior al match" y
  **corrompía el `<script>` inline**, así que `app.js` no ejecutaba en el preview (bug
  preexistente). Ahora los reemplazos son por **función** (valor literal). Además, la librería
  Motion se inlinea en el preview para ver las animaciones en vivo dentro del iframe `srcdoc`.

## 2026-07-11 (8ª corrida)

> Lote de 5 módulos UI nuevos, todos frontend puro (sin backend ni dependencias): módulos de
> conversión que cubren la sugerencia nº7 del backlog (comparativa de planes, marquesina,
> banda de estadísticas, testimonios en carrusel) más una sección de características en zigzag.
> Ninguno se revirtió.

### feat(modulos): tabla comparativa — nuevo
- Nuevo módulo UI `comparison` ([modules/ui/comparison.js](modules/ui/comparison.js)): matriz
  de características por plan (Básico/Pro/Empresa) con celdas `✓` / `✕` / texto libre. Columna
  recomendada resaltada (color de acento + fondo `color-mix` suave). Estática, sin JS.
- La `<table>` sale con `data-mejorada="1"` para que el módulo `datatable` la **ignore**
  (una comparativa se lee, no se ordena ni se filtra); verificado en el smoke test que no le
  agrega flecha de orden ni buscador aun teniendo 6 filas. Scroll horizontal en móvil.
- Encabezados con `scope="col"`/`scope="row"`; textos placeholder avisados vía `readmeNotes`.

### feat(modulos): marquesina animada — nuevo
- Nuevo módulo UI `marquee` ([modules/ui/marquee.js](modules/ui/marquee.js)): cinta de frases
  o marcas que se desplaza en loop continuo. La animación es **CSS puro** (`@keyframes` con
  `translateX(0 → -50%)`); el clientJs solo inyecta los estilos. Se duplica la lista (la copia
  con `aria-hidden`) para que el bucle no tenga cortes.
- Pausa al pasar el mouse (`:hover` → `animation-play-state:paused`). Con
  `prefers-reduced-motion` la animación se apaga y las frases quedan quietas y legibles
  (flex-wrap centrado). Sin JS: fila estática (nada roto). Frases placeholder en `readmeNotes`.

### feat(modulos): banda de estadísticas — nuevo
- Nuevo módulo UI `metrics` ([modules/ui/metrics.js](modules/ui/metrics.js)): franja full-bleed
  de acento con 4 cifras de confianza grandes (`+500`, `10`, `4.9★`, `24/7`) y su etiqueta,
  texto en blanco para contraste. Estática, sin JS: la cifra final ya está en el HTML (para
  cifras que se animan al entrar en pantalla sigue estando el módulo `counters`).
- Estilos vía `head()` (una sola vez por página); grilla `auto-fit minmax(150px,1fr)`.

### feat(modulos): características destacadas — nuevo
- Nuevo módulo UI `features` ([modules/ui/features.js](modules/ui/features.js)): filas
  alternadas (zigzag) imagen + texto, con `flex-direction:row-reverse` en las pares. Cada fila
  trae emoji, título y bajada. Layout clásico de landing de producto. Estática, sin JS.
- Los bloques "imagen" son degradados placeholder (mismo criterio que galería/beforeafter);
  `readmeNotes` explica cómo reemplazarlos por `<img>` reales. Estilos vía `head()`.

### feat(modulos): testimonios en carrusel — nuevo
- Nuevo módulo UI `testimonialslider` ([modules/ui/testimonialslider.js](modules/ui/testimonialslider.js)):
  carrusel de testimonios que rota solo (6s), con flechas ‹/› y puntos, **standalone** (no
  depende del módulo `testimonios`: trae sus propias 3 reseñas placeholder).
- Progressive enhancement: sin JS se ven los 3 apilados; el JS agrega la clase `ts-js` (que
  recién ahí oculta los no activos) y **crea** las flechas y los puntos (así no quedan
  controles muertos sin JS). Pausa al `mouseenter`, reanuda al `mouseleave`. Con
  `prefers-reduced-motion` no autoavanza pero flechas y puntos siguen operativos.
- Accesible: `aria-live="polite"` en la lista, `aria-label` en flechas y puntos,
  `aria-current` en el punto activo.

### chore: catálogo
- Registro sube a **57 módulos UI** (los 5 se autocargan por [src/registry.js](src/registry.js),
  sin tocar el front del Builder). Total: 57 UI + 19 funcionales = 76 módulos.

### test
- `node --check` en los 5 módulos fuente y en el JS del proyecto generado (bundle cliente,
  server, rutas). También validado el `app.js` de la variante "solo los 5 módulos".
- Generación de un proyecto de prueba con los 5 nuevos + 10 existentes (hero, pricing,
  datatable, reveal, darkmode, navmobile, contact, newsletter, i18n, seo): 20 archivos, las
  5 secciones (`comparativa`, `marquesina`, `estadisticas`, `caracteristicas`,
  `testimonios-carrusel`) presentes en `index.html`.
- Servidor levantado con `NODE_PATH` al `node_modules` del Builder: `index/about/contact` 200,
  `styles.css` 200, `app.js` 200, `sitemap.xml` 200.
- Smoke test en navegador real (DOM tras ejecutar el JS): comparativa con opt-out de datatable
  confirmado (sin flecha de orden ni buscador con 6 filas); marquesina con 2 grupos y
  `animationName:mq-scroll`; 4 métricas; 3 filas de características con la 2ª en `row-reverse`;
  carrusel con clase `ts-js`, 2 flechas, 3 puntos y **1 solo** slide visible, click en
  "siguiente" y en el 3er punto cambian el testimonio activo (`aria-current="true"`).
  **Cero errores de consola** conviviendo con datatable, reveal, darkmode, navmobile, i18n y seo.
- Inlineado del preview del Builder: verificado que ningún clientJs contiene `</script>` ni
  `</style>` (no rompe el `srcdoc`). Variante Vercel+Supabase genera `vercel.json`,
  `api/index.js` y `supabase/schema.sql` sin errores.

## 2026-07-11 (7ª corrida)

> Lote de 5 módulos UI nuevos, todos frontend puro (sin backend ni dependencias): las
> funcionalidades de confianza/conversión que cualquier cliente comercial pide primero.
> Ninguno se revirtió.

### feat(modulos): garantías de confianza — nuevo
- Nuevo módulo UI `trust` ([modules/ui/trust.js](modules/ui/trust.js)): barra de 4 badges
  (envío gratis, pago seguro, cambios y devoluciones, atención personalizada) con iconos
  SVG inline (`stroke: var(--accent)`), título y bajada. Sección estática sin JS.
- Grilla responsive (`repeat(auto-fit, minmax(220px, 1fr))`); textos placeholder avisados
  en el README generado vía `readmeNotes`.

### feat(modulos): contenido en pestañas — nuevo
- Nuevo módulo UI `tabs` ([modules/ui/tabs.js](modules/ui/tabs.js)): patrón tablist
  accesible (roles `tab`/`tabpanel`, `aria-selected`, `aria-controls`/`aria-labelledby`,
  roving `tabindex`) con navegación por teclado (flechas, Inicio, Fin). 3 pestañas
  placeholder: características, especificaciones, envíos y devoluciones.
- Progressive enhancement: el HTML trae todos los paneles visibles; recién el JS oculta los
  no activos. Sin JS se ven los 3 apilados (nunca roto). IDs únicos por instancia.

### feat(modulos): progreso de lectura — nuevo
- Nuevo módulo UI `scrollprogress` ([modules/ui/scrollprogress.js](modules/ui/scrollprogress.js)):
  cinta fija de 3px arriba de todo (`z-index:60`, sobre navbar y barra de anuncios) que
  crece con el scroll (`scrollTop / (scrollHeight - clientHeight)`). Solo clientJs, presente
  en todas las páginas. Se recalcula en `scroll` (passive) y `resize`; 0% si la página entra
  entera en pantalla. `role="progressbar"` + `aria-hidden` (es decorativa).

### feat(modulos): antes/después — nuevo
- Nuevo módulo UI `beforeafter` ([modules/ui/beforeafter.js](modules/ui/beforeafter.js)):
  comparador de imágenes con dos capas superpuestas y un `<input type="range">` como control
  (arrastre + teclado + lectores de pantalla gratis, sin reinventar el gesto). La capa
  superior se recorta con `clip-path: inset(0 calc((100 - var(--pos)) * 1%) 0 0)` según la
  variable `--pos` que el range actualiza. Thumb estilado como tirador circular con anillo
  de foco visible al tabular. Sin JS queda una división fija 50/50.
- Placeholders con degradado (mismo criterio que galería/carrusel); `readmeNotes` explica
  cómo reemplazar por fotos reales cambiando el `background` de `.ba-before`/`.ba-after`.

### feat(modulos): cuenta regresiva — nuevo
- Nuevo módulo UI `countdown` ([modules/ui/countdown.js](modules/ui/countdown.js)): contador
  a un evento con 4 cajas (días, horas, minutos, segundos, `tabular-nums`) y CTA que apunta a
  contacto si existe, si no a Nosotros (siempre válida). Tick por segundo; al llegar a cero
  oculta la grilla y muestra "¡Ya llegó el día!".
- Fecha objetivo configurable en `data-fecha`; si falta o ya pasó, cae a **fin del mes
  actual** (determinista y se renueva solo cada mes, criterio parecido al de la barra de
  anuncios) para que siempre cuente en vivo. `readmeNotes` explica cómo fijar un evento.

### chore: catálogo y documentación
- Registro sube a **52 módulos UI** (los 5 se autocargan por [src/registry.js](src/registry.js),
  sin tocar el front del Builder, que los lista solo desde `/api/modules`).
- Corrección de conteo: el README/PROGRESO enumeraban "43 UI" pero los archivos ya eran 47
  (faltaban en la prosa `contactbar`, `blogpages`, `portfolio` y `rss`, que sí existían y se
  cargaban). Ahora ambos docs reflejan 52 (47 previos + 5 nuevos) y suman esos 4 nombres.

### test
- `node --check` en los 5 módulos fuente y en todo el JS del proyecto generado (bundle
  cliente, server, rutas, modelos, db).
- Generación de un proyecto de prueba con los 5 nuevos + 14 existentes (carrusel,
  testimonios, precios, faq, galería, contacto, newsletter, modo oscuro, menú hamburguesa,
  volver-arriba, seo, i18n, datatable, hero): 20 archivos, las 4 secciones + la barra de
  progreso inyectadas.
- Servidor levantado: páginas 200, `sitemap.xml` 200, `POST /api/contact` 201/422,
  `POST /api/newsletter` 201.
- Smoke test en navegador real (DOM tras ejecutar el JS): 4 badges de trust; pestañas con
  roles ARIA, primera seleccionada y 1 solo panel visible, click en la 2ª cambia selección
  y panel; `--pos` del comparador pasa de 50 a 80 al mover el range; contador con números
  reales (d/h/m/s) y segundos que avanzan; barra de progreso presente. **Cero errores de
  consola** conviviendo con i18n, darkmode, navmobile, datatable y carrusel.
- Preview del Builder (`/api/preview`) 200 con CSS y JS inlineados y las 4 secciones presentes;
  verificado que ningún clientJs contiene `</script>` (no rompe el inlineado del srcdoc).

## 2026-07-11 (6ª corrida)

> Nota: al iniciar esta corrida se encontraron 5 módulos ya escritos pero sin probar ni
> documentar (`jobs`, `legal`, `promo`, `servicespage`, `inbox`), restos de una corrida
> anterior interrumpida. Esta corrida los **adoptó**: se verificaron completos junto con
> el lote nuevo y se documentan acá.

### feat(modulos): app instalable (PWA) — nuevo
- Nuevo módulo UI `pwa` ([modules/ui/pwa.js](modules/ui/pwa.js)): `manifest.webmanifest`
  con nombre/colores de la marca, ícono SVG con la inicial (mismo criterio que favicon) y
  service worker `public/sw.js` con estrategia **red primero con respaldo en cache**:
  online siempre contenido fresco, offline las páginas ya visitadas (y la home como último
  recurso al navegar). La API (`/api/*`) y los orígenes externos nunca se cachean.
- Cache versionado por slug (`<slug>-v1`) con limpieza de versiones viejas en `activate`.
- El registro del SW solo corre en HTTPS o localhost y nunca en el preview del Builder.
  README generado avisa cómo forzar actualización durante el desarrollo.

### feat(modulos): accesibilidad — nuevo
- Nuevo módulo UI `a11y` ([modules/ui/a11y.js](modules/ui/a11y.js)): enlace "Saltar al
  contenido" (visible al enfocar con Tab) y botón flotante ♿ abajo a la izquierda
  (WhatsApp y volver-arriba usan la derecha) con panel de preferencias: tamaño del texto
  (A−/A+ en 4 pasos, 100–137,5 % sobre el tamaño raíz, funciona porque el CSS usa rem),
  alto contraste (negro/blanco/amarillo con `color-scheme: dark`) y subrayado de enlaces.
- Preferencias persistidas en `localStorage` y aplicadas al cargar cada página. El selector
  de contraste va duplicado (`[data-contrast="alto"][data-contrast="alto"]`) para ganarle
  en especificidad al modo oscuro sin depender del orden de carga de los módulos.
- Panel con `aria-expanded`, cierre por Escape con foco de vuelta al botón.

### feat(modulos): sitemap.xml en SEO (pendiente del backlog)
- El generador ahora resuelve las páginas de los módulos **una sola vez** y pasa
  `ctx = {pages: [...]}` como segundo argumento de `files(cfg, ctx)` — cambio retrocompatible
  (los módulos existentes ignoran el argumento). Documentado en [src/registry.js](src/registry.js)
  y en el contrato del README.
- El módulo `seo` genera `public/sitemap.xml` con todas las páginas públicas del sitio
  (excluye las de uso interno: auth, dashboard, admin, bandeja, POS, etc.) y `robots.txt`
  ahora referencia el sitemap. El dominio es un placeholder `https://TU-DOMINIO.com`
  avisado en el README generado (los sitemaps requieren URLs absolutas).

### feat(modulos): testimonios con reseñas reales (sugerencia nº 2 del backlog)
- Nueva ruta `GET /api/reviews/top` en el módulo reseñas: las últimas reseñas de 4-5
  estrellas (máximo 6), solo campos públicos (autor, rating, texto, fecha).
- Si `testimonials` y `reviews` están activos a la vez, la sección de testimonios
  reemplaza los tres ejemplos por las mejores reseñas reales (con estrellas y
  `aria-label` del puntaje). Sin reseñas todavía —o si la API falla— los ejemplos quedan
  en pantalla: la sección nunca puede quedar vacía. En el preview no se toca nada.
- `readmeNotes` de testimonios ahora varía según reviews esté activo o no.

### feat(modulos): lote adoptado de la corrida interrumpida
- `jobs` ([modules/ui/jobs.js](modules/ui/jobs.js)): página "Trabajá con nosotros" con
  3 búsquedas placeholder y formulario de postulación (CV por link opcional http/https);
  backend `POST /api/applications` + colección `applications`.
- `legal` ([modules/ui/legal.js](modules/ui/legal.js)): páginas de Términos y Privacidad
  con texto modelo editable (campos `[completar…]`), párrafos condicionales según módulos
  activos (auth → contraseña cifrada, cookies → aviso) y links en el footer de todas las
  páginas. Disclaimer de revisión profesional en ambas.
- `promo` ([modules/ui/promo.js](modules/ui/promo.js)): popup de promoción a los 8 s o a
  media página de scroll (lo primero que ocurra), `role="dialog"` con foco en el botón de
  cierre, Escape/clic afuera cierran, y frecuencia máxima configurable (default 7 días)
  recordada en `localStorage`. El CTA apunta a presupuesto → contacto → about según qué
  módulos estén activos.
- `servicespage` ([modules/ui/servicespage.js](modules/ui/servicespage.js)): página propia
  `/services.html` con detalle por servicio (párrafo + puntos clave, anclas `#servicio-N`),
  reusando `SERVICIOS` del módulo services (`requires: ['services']`); CTA final según
  módulos activos.
- `inbox` ([modules/functional/inbox.js](modules/functional/inbox.js)): bandeja de entrada
  admin (sugerencias nº 3 y 4 del backlog) que unifica mensajes, presupuestos y
  postulaciones de los módulos activos: pestañas con conteo de nuevos, badge en la navbar,
  estado nuevo/respondido (`PATCH /api/inbox/:col/:id`), descarga CSV (separador `;` con
  BOM para Excel es-AR) y todo tras `requireAdmin` (`requires: ['auth']`).

### docs
- README del Builder: 43 módulos UI + 19 funcionales, contrato `files(cfg, ctx)` y rutas
  `/api/applications`, `/api/inbox`, `/api/reviews/top` en la tabla de API.

### Pruebas realizadas
- Registro: los 62 módulos cargan sin errores (43 UI + 19 funcionales).
- Generación de prueba con los 9 módulos del lote + dependencias (14 seleccionados,
  auth/cart resueltos en cadena): 47 archivos, `node --check` OK en todos los `.js`.
- `sitemap.xml` correcto: 9 URLs públicas, home como `/`, y las privadas (auth, dashboard,
  admin, inbox) excluidas; `robots.txt` referencia el sitemap.
- Servidor levantado (puerto 3991): 16 rutas en 200 (páginas + sitemap + robots +
  manifest + sw.js + icon.svg).
- API: `POST /api/applications` 201/422; contacto y presupuesto 201; `GET /api/inbox`
  401 sin token y con token admin lista las 3 fuentes; `PATCH` de estado 200, estado
  inválido 422, colección desconocida 404; `GET /api/reviews/top` devuelve solo las
  reseñas de 4-5 estrellas con campos públicos.
- Smoke test en navegador real, cero errores de consola: service worker registrado y
  cacheando core + páginas visitadas (la API no); testimonios mostrando las 2 reseñas
  reales en lugar de los ejemplos; skip-link y panel de accesibilidad (125 % de texto,
  alto contraste con fondo negro, subrayado) con persistencia entre páginas; popup de
  promoción con foco en cerrar, Escape y frecuencia respetada al recargar; formulario de
  empleo enviado desde el navegador con tildes/ñ correctas, toast y reset; links Bandeja/
  Admin ocultos para anónimos; bandeja como admin: 3 pestañas con conteos, badge 3→2 al
  marcar respondido, link "Ver CV", CSV sin errores; páginas legales con condicionales
  de auth activos; página de servicios con 6 artículos.
- Regresión: generación sin los módulos nuevos no incluye sw.js/manifest/sitemap/icon ni
  JS de pwa/a11y/inbox; variante Vercel+Supabase completa con las tablas messages, quotes,
  applications, reviews, users, products y orders en el schema.
- Sin módulos revertidos.

## 2026-07-11 (5ª corrida)

### feat(modulos): redes sociales en el footer
- Nuevo módulo UI `social` ([modules/ui/social.js](modules/ui/social.js)): bloque de íconos
  de redes (Instagram, Facebook, X, YouTube, LinkedIn) que se inyecta en el footer de todas
  las páginas, con SVG inline estilo feather que heredan `--muted` y toman el acento al hover.
- Las URLs viven en la constante `REDES` de `public/js/app.js`; las que quedan vacías (`''`)
  no se renderizan (por defecto vienen 3 activas y 2 vacías como ejemplo de ambos casos).
  El README generado avisa dónde editarlas.

### feat(modulos): nuestra historia (timeline)
- Nuevo módulo UI `timeline` ([modules/ui/timeline.js](modules/ui/timeline.js)): línea de
  tiempo vertical con cuatro hitos placeholder (año, título, texto), línea con `border-left`
  y puntos del acento. Todo con estilos inline sobre variables del tema: sin CSS nuevo.
- Hitos editables en la sección `#historia` de `public/index.html` (avisado en el README).

### feat(modulos): cómo trabajamos (proceso)
- Nuevo módulo UI `process` ([modules/ui/process.js](modules/ui/process.js)): sección de
  cuatro pasos numerados (consulta → propuesta → ejecución → entrega) con círculos del acento,
  la típica sección "How it works" de sitios de servicios.
- Placeholders editables en `#proceso` de `public/index.html` (avisado en el README).

### feat(modulos): pedido de presupuesto (formulario multipaso)
- Nuevo módulo UI `quote` ([modules/ui/quote.js](modules/ui/quote.js)): página `/quote.html`
  con wizard de 3 pasos (datos → proyecto → confirmación), indicador de progreso con
  `aria-current="step"`, validación nativa por paso (`reportValidity` solo sobre los campos
  visibles; el form lleva `novalidate` para que el envío no choque con campos ocultos) y
  resumen de lo cargado antes de enviar.
- Enter en pasos intermedios avanza en lugar de enviar (se intercepta el submit implícito).
- Backend igual al patrón de contacto: `models/quote.js` (teléfono opcional) +
  `routes/quotes.js` (`POST /api/quotes`, 422 con errores por campo) + colección `quotes`
  (verificada también en `supabase/schema.sql`). Las opciones de los selects son placeholders
  editables en el HTML.

### feat(modulos): multiidioma ES/EN
- Nuevo módulo UI `i18n` ([modules/ui/i18n.js](modules/ui/i18n.js)): botón EN/ES en la navbar
  (patrón del modo oscuro) que traduce los textos FIJOS del sitio con un diccionario
  `'español': 'english'` de ~70 entradas, generado desde el módulo e inlineado en
  `public/js/app.js` para que el cliente lo edite/amplíe.
- Mecanismo: TreeWalker sobre los nodos de texto del body (salteando script/style) con
  coincidencia exacta tras separar espacios, más los atributos `placeholder`, `aria-label` y
  `title`. Cada reemplazo guarda el original, así la vuelta a español restaura sin recargar.
  Actualiza `document.documentElement.lang` y recuerda la elección en `localStorage`.
- Alcance deliberado (era la sugerencia nº 1 del backlog): los textos del Builder
  (`cfg.texts`) y el contenido dinámico NO se traducen; el README generado lo aclara y
  explica cómo sumar entradas al diccionario.

### docs
- README del Builder actualizado: 37 módulos UI y la ruta `POST /api/quotes` en la tabla de API.

### Pruebas realizadas
- Registro: los 55 módulos cargan sin errores (37 UI + 18 funcionales, los 5 nuevos incluidos).
- Generación de proyecto de prueba con los 5 módulos nuevos + 7 existentes: 21 archivos,
  `node --check` OK en fuente y generados; variante Vercel+Supabase genera `vercel.json`,
  `api/index.js` y la tabla `quotes` en el schema.
- Servidor generado levantado (puerto 3987): 200 en las 4 páginas, `POST /api/quotes` 201 con
  datos válidos y 422 con inválidos, registros persistidos en `data/quotes.json`.
- Smoke test en navegador real: 3 íconos sociales en el footer (los 2 sin URL no aparecen),
  4 hitos de historia y 4 pasos de proceso renderizados; toggle EN→ES ida y vuelta en Home y
  en la página de presupuesto (nav, encabezados, tabla de horarios, labels, placeholders y
  marcas del wizard) con persistencia en localStorage; wizard completo: no avanza con campos
  vacíos, avanza validando, "Atrás" funciona, resumen correcto, envío real con toast y reset
  al paso 1. Cero errores de consola.

## 2026-07-10 (4ª corrida)

### feat(modulos): contadores animados
- Nuevo módulo UI `counters` ([modules/ui/counters.js](modules/ui/counters.js)): sección
  "Números que nos respaldan" con cuatro cifras (años, clientes, proyectos, % de recomendación)
  que suben de 0 a su valor con easing cúbico al entrar en pantalla (IntersectionObserver).
- El HTML ya trae el valor final: sin JS, con `prefers-reduced-motion` o sin observer la cifra
  se ve igual (el 0 inicial se pinta recién desde JS, mismo criterio que `reveal`). Formato es-AR
  con `toLocaleString`. Placeholders editables; el README generado avisa dónde.

### feat(modulos): logos de clientes
- Nuevo módulo UI `logos` ([modules/ui/logos.js](modules/ui/logos.js)): franja "Confían en
  nosotros" con seis marcas placeholder como wordmarks tipográficos (cero imágenes), en gris
  que toma el color de acento al pasar el mouse.
- Los estilos incluyen también el caso `<img>` (grisado + hover a color), así el cliente pega
  sus logos reales sin tocar CSS. El README generado lo explica.

### feat(modulos): llamado a la acción
- Nuevo módulo UI `cta` ([modules/ui/cta.js](modules/ui/cta.js)): banda destacada con gradiente
  del acento, título, texto y botón, pensada para ir antes del footer.
- El botón apunta a `/contact.html` si el módulo contacto está activo (se detecta vía
  `cfg.moduleIds`) y a `/about.html` si no; reutiliza el texto del CTA del hero configurado
  en el Builder.

### feat(modulos): horarios de atención
- Nuevo módulo UI `hours` ([modules/ui/hours.js](modules/ui/hours.js)): tabla de horarios
  semanales + cartel "● Abierto ahora / ● Cerrado en este momento" calculado en vivo con la
  hora local del visitante, y la fila del día actual resaltada.
- Una sola fuente de verdad: el JS lee los atributos `data-dias` (números de `getDay()`, rango
  `1-5` o lista), `data-abre` y `data-cierra` de las filas del HTML. Sin JS la tabla estática
  sigue informando. Se recalcula cada minuto por si la página queda abierta al cambiar el estado.

### feat(modulos): video institucional
- Nuevo módulo UI `video` ([modules/ui/video.js](modules/ui/video.js)): sección con placeholder
  (botón de play sobre gradiente de la marca) que recién al hacer clic crea el iframe de
  **youtube-nocookie.com** con `autoplay=1`: la página no le pide nada a YouTube (ni cookies ni
  tracking) hasta que el visitante decide reproducir.
- El ID es un placeholder con un corto libre de Blender; el README generado explica cómo poner
  el video propio (`data-video-id`).

### feat(modulos): filtros de galería
- Nuevo módulo UI `galleryfilters` ([modules/ui/galleryfilters.js](modules/ui/galleryfilters.js)):
  tabs de categorías arriba de la galería ("Todos" + las que encuentre) que filtran las tarjetas,
  estilo portfolio. Botones pill con `aria-pressed` y `role="group"`.
- Declara `requires: ['gallery']`: activarlo solo arrastra la galería automáticamente (verificado).
- La galería ([modules/ui/gallery.js](modules/ui/gallery.js)) ahora asigna `data-cat` placeholder
  a sus tarjetas (Diseño/Obras/Consultoría); sin el módulo de filtros ese atributo es inerte
  (verificado en la prueba de no-regresión). Las categorías se renombran editando los `data-cat`.

### fix(cta): destino del botón
- Detectado en el smoke test: el CTA apuntaba a un ancla `#contacto` que no existe (contacto es
  una página propia, no una sección de la Home). Corregido a `/contact.html` antes de cerrar el lote.

### Pruebas realizadas
- Registro: los 50 módulos cargan sin errores (32 UI + 18 funcionales, los 6 nuevos incluidos).
- Generación de prueba con `hero, services, counters, logos, gallery, galleryfilters, video,
  hours, contact, cta`: 16 archivos, `node --check` OK en todos los `.js` (fuente y generados),
  `npm install` y servidor Express levantando; index, CSS y JS con HTTP 200.
- Smoke test en el navegador embebido: las 7 secciones presentes, cero errores de consola;
  filtros de galería dejan 2/6 tarjetas al elegir "Diseño" y 6/6 en "Todos" con `aria-pressed`
  correcto; clic en el video reemplaza el placeholder por el iframe de youtube-nocookie (y no hay
  ningún iframe antes del clic); horarios marca "Cerrado" un viernes 21:14 con la fila de hoy en
  negrita; la lógica abierto/cerrado pasó 6 casos borde (límite de cierre exclusivo incluido).
- Contadores: el panel embebido quedó con `visibilityState: hidden` (rAF e IntersectionObserver
  suspendidos por el navegador), así que la animación no pudo verse en vivo; se validó la curva
  frame a frame con la misma fórmula (0 → 723 → 1.094 → 1.230 → 1.250, es-AR, final exacto) y el
  fallback: con la página oculta las cifras quedan en 0 hasta que la pestaña se hace visible,
  y sin JS/observer/con menos movimiento se ve directo el valor final del HTML.
- Sin regresión: una generación sin los módulos nuevos no incluye ninguna de sus secciones ni su
  JS; `data-cat` queda en la galería pero sin efecto. La webapp del Builder carga OK.

## 2026-07-10 (3ª corrida)

### feat(modulos): servicios
- Nuevo módulo UI `services` ([modules/ui/services.js](modules/ui/services.js)): sección
  "Nuestros servicios" en la Home con seis tarjetas (icono SVG inline con `stroke: var(--accent)`,
  título y descripción). Era la sección más común de un sitio comercial que faltaba en el catálogo.
  Los textos son placeholders genéricos; el README generado avisa dónde editarlos.

### feat(modulos): barra de anuncios
- Nuevo módulo UI `announcement` ([modules/ui/announcement.js](modules/ui/announcement.js)):
  barra de promoción arriba de la navbar en todas las páginas, con cuenta regresiva hasta el
  próximo domingo a la medianoche (se renueva sola cada semana) y botón de cierre.
- El cierre se guarda en localStorage **por mensaje**: si el dueño cambia el texto de la promo,
  la barra reaparece aunque el visitante hubiera cerrado la anterior. `localStorage` va en
  try/catch (modo incógnito estricto no rompe la página).

### feat(modulos): miga de pan
- Nuevo módulo UI `breadcrumbs` ([modules/ui/breadcrumbs.js](modules/ui/breadcrumbs.js)):
  breadcrumb "Inicio › Página actual" bajo la navbar en todas las páginas internas
  (`aria-label`, `aria-current="page"`). Se arma solo con el `<title>` del layout;
  la Home no lleva miga.

### feat(modulos): favicon de marca
- Nuevo módulo UI `favicon` ([modules/ui/favicon.js](modules/ui/favicon.js)): favicon SVG con
  la inicial de la marca en blanco sobre el color de acento, inyectado como data URI vía el
  campo `head()` en todas las páginas. Cero archivos binarios en el proyecto generado.

### feat(modulos): página 404
- Nuevo módulo UI `page404` ([modules/ui/page404.js](modules/ui/page404.js)): genera
  `public/404.html` con el layout del sitio (número grande, mensaje y botón al inicio) y un
  router fallback `routes/notfound.js` montado en `/` que responde cualquier ruta inexistente
  con esa página y status 404. Las rutas `/api/*` hacen `next()`: su 404 sigue siendo el JSON
  de `src/app.js`, y como el static de Express corre antes, los archivos reales no se ven afectados.

### feat(modulos): tablas con orden y búsqueda
- Nuevo módulo UI `datatable` ([modules/ui/datatable.js](modules/ui/datatable.js)): mejora
  progresiva de **todas** las tablas del sitio sin tocar su HTML. Clic (o Enter/Espacio, los
  `th` reciben `tabindex`) en un encabezado ordena por esa columna con `aria-sort` y flecha
  indicadora; las tablas de más de 5 filas suman un buscador que filtra filas en vivo.
- Orden con criterio: números en formato es-AR (`$1.234,56`, `15 %`) comparan como números;
  fechas y códigos quedan afuera del parser numérico y se ordenan con
  `localeCompare('es', { numeric: true })`.
- Un MutationObserver mejora también las tablas que los módulos funcionales renderizan
  después de un fetch con `App.table` (dashboard, admin, inventario, etc.).

### docs
- README del Builder: la lista de `modules/ui/` pasa de 20 a 26 módulos.

### Pruebas realizadas
- Registro: los 44 módulos cargan sin errores (26 de UI, los 6 nuevos incluidos).
- Generación de prueba con `hero, services, announcement, breadcrumbs, favicon, page404,
  datatable, contact, products-admin, auth`: 29 archivos, `node --check` OK en todos los `.js`,
  `npm install` y servidor levantado sin errores.
- HTTP: `/` y `/products.html` → 200; `/pagina-inexistente` → **404 con la página amigable**;
  `/api/inexistente` → 404 JSON intacto.
- Smoke test en navegador real, sin errores de consola: barra de anuncios con countdown
  corriendo; cierre persiste tras navegar (localStorage por mensaje); breadcrumb
  "Inicio › Contacto" con marcado accesible; favicon data URI presente en el `<head>`;
  tabla inyectada dinámicamente detectada por el observer, orden asc/desc numérico es-AR
  correcto (`$1.200` → `$110.000`), fechas ISO ordenadas como texto, buscador filtrando,
  `aria-sort` y `tabindex` aplicados; página 404 con breadcrumb y botón al inicio.
- Sin regresión: una generación sin los módulos nuevos no incluye su JS, ni el favicon,
  ni `404.html`, ni el mount del fallback.

## 2026-07-10 (2ª corrida)

### feat(modulos): menú hamburguesa
- Nuevo módulo UI `navmobile` ([modules/ui/navmobile.js](modules/ui/navmobile.js)): en pantallas
  de hasta 720px los links de la navbar se pliegan en un menú hamburguesa accesible
  (`aria-expanded`, cierre por link, botón o Escape). Sin JS los links quedan visibles:
  la navegación nunca puede quedar inaccesible.

### feat(modulos): carrusel
- Nuevo módulo UI `carousel` ([modules/ui/carousel.js](modules/ui/carousel.js)): carrusel de
  destacados con flechas, puntos y autoplay cada 5s. Se pausa con hover/foco, una interacción
  manual reinicia el reloj, y con `prefers-reduced-motion` no hay autoplay. Sin JS queda visible
  el primer slide (los controles se crean desde JS).

### feat(modulos): lightbox
- Nuevo módulo UI `lightbox` ([modules/ui/lightbox.js](modules/ui/lightbox.js)): clic en una
  imagen de contenido o tarjeta de la galería la amplía sobre fondo oscuro (overlay único
  reutilizado, `role="dialog"`, cierre por clic fuera, botón o Escape). Las tarjetas clonadas
  conservan su estilo inline pero sueltan la proporción fija.

### feat(modulos): SEO básico
- Nuevo módulo UI `seo` ([modules/ui/seo.js](modules/ui/seo.js)): meta descripción (tomada del
  texto "Sobre nosotros", recortada a 155 caracteres), Open Graph por página, `theme-color`,
  JSON-LD de Organization (con `<` escapado para no poder cerrar el script) y `robots.txt`.
  Aviso en el README generado para revisar la descripción y agregar dominio/sitemap.

### feat(modulos): mapa de ubicación
- Nuevo módulo UI `map` ([modules/ui/map.js](modules/ui/map.js)): sección "Dónde encontrarnos"
  con mapa embebido de OpenStreetMap (gratis, sin API key, `loading="lazy"`) junto a una tarjeta
  de dirección/horario/teléfono. Coordenadas y datos son placeholders; el README generado avisa
  cómo reemplazarlos (acción humana).

### feat(modulos): equipo
- Nuevo módulo UI `team` ([modules/ui/team.js](modules/ui/team.js)): sección "Nuestro equipo"
  con avatares de iniciales (gradiente con los colores de la marca), nombre, rol y mini bio.

### feat(generador): fragmentos de <head> por módulo
- Nuevo campo opcional del contrato: `head(cfg, page) → string` (page = `{title, active}`).
  El generador ([src/generator.js](src/generator.js)) junta los fragmentos de los módulos
  seleccionados y [src/templates.js](src/templates.js) los inserta antes de `</head>` en todas
  las páginas (Home, Nosotros y páginas propias de módulos). Documentado en
  [src/registry.js](src/registry.js) y en el contrato de ejemplo del [README.md](README.md).

### Pruebas realizadas
- Registro: los 38 módulos cargan sin errores (los 6 nuevos incluidos); 20 de UI.
- Generación de prueba con `hero, gallery, navmobile, carousel, lightbox, seo, map, team,
  darkmode, contact, auth`: 26 archivos, `node --check` OK en todos los `.js`, `npm install`
  y servidor Express levantando sin errores; `robots.txt` y `app.js` servidos con HTTP 200.
- Smoke test en navegador real (viewport angosto): sin errores de consola; hamburguesa abre y
  cierra con `aria-expanded` correcto; carrusel avanza (transform y punto activo); lightbox abre
  como `role="dialog"` y cierra con Escape; todo conviviendo con modo oscuro activo.
- Sin regresión: una generación sin los módulos nuevos no incluye su JS, ni las metas SEO,
  ni `robots.txt`, y el `<head>` no queda con líneas sueltas.

## 2026-07-10

### feat(modulos): botón de WhatsApp
- Nuevo módulo UI `whatsapp` ([modules/ui/whatsapp.js](modules/ui/whatsapp.js)): botón flotante
  verde en todas las páginas que abre un chat de WhatsApp con mensaje prellenado con el nombre
  de la marca. Sin SDKs, solo el link público `wa.me`.
- El número es un placeholder (`NUMERO_WHATSAPP` en `public/js/app.js` del proyecto generado);
  el README generado avisa que hay que reemplazarlo (acción humana).

### feat(modulos): volver arriba
- Nuevo módulo UI `backtotop` ([modules/ui/backtotop.js](modules/ui/backtotop.js)): botón flotante
  que aparece pasados 400px de scroll y vuelve al inicio con scroll suave. Respeta
  `prefers-reduced-motion` (salto instantáneo).
- Convivencia con el botón de WhatsApp resuelta en ambos sentidos: si los dos están activos,
  WhatsApp queda abajo y "volver arriba" se ubica encima, sin importar el orden de carga.

### feat(modulos): animaciones al scroll
- Nuevo módulo UI `reveal` ([modules/ui/reveal.js](modules/ui/reveal.js)): títulos, subtítulos y
  tarjetas aparecen con fade + desplazamiento al entrar en pantalla (IntersectionObserver).
- Sin JS o con `prefers-reduced-motion` el contenido queda visible normal (la clase inicial se
  aplica solo desde JS). Lo que ya está en pantalla al cargar no se anima, para evitar parpadeo.

### feat(generador): avisos de acción humana en el README generado
- Nuevo campo opcional del contrato de módulo: `readmeNotes(cfg) → [string]`. El generador
  ([src/generator.js](src/generator.js)) junta los avisos de los módulos seleccionados y los agrega
  a la sección **Notas** del README del proyecto exportado.
- Documentado en [src/registry.js](src/registry.js) y en el contrato de ejemplo del
  [README.md](README.md) (que además ahora lista 14 módulos UI).

### Pruebas realizadas
- Registro: los 32 módulos cargan sin errores (los 3 nuevos incluidos).
- Generación de un proyecto de prueba con `hero, gallery, contact, darkmode, whatsapp, backtotop,
  reveal, auth, cart`: 29 archivos, `node --check` OK en todos los `.js` generados, y el servidor
  Express del proyecto generado **levanta sin errores** tras `npm install`.
- Sin regresión: una generación sin los módulos nuevos no arrastra ni su JS ni sus avisos.
