---
name: WebForge Builder
description: Un plano técnico de taller — grilla milimetrada, tinta azul de plano y ámbar de acción — para ensamblar y exportar webapps.
colors:
  ink: "#101828"
  blueprint-blue: "#2447f5"
  blue-soft: "#e4e9ff"
  action-amber: "#ff9f1c"
  blueprint-paper: "#eef1f6"
  line: "#cfd7e4"
  label-ink: "#475467"
  muted-ink: "#667085"
  surface-white: "#ffffff"
typography:
  # Familia única de toda la interfaz del Builder: Montserrat (cargada por Google Fonts en
  # public/index.html). El monoespaciado queda reservado SÓLO para tokens de código
  # (ids de módulo, contadores de spec, dependencias) — ver mono-meta / nano.
  wordmark:
    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.01em"
  section-label:
    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.07em"
  body:
    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  field-label:
    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  mono-meta:
    fontFamily: "ui-monospace, 'Cascadia Code', 'Courier New', monospace"
    fontSize: "0.72rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.05em"
  subhead:
    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.86rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  group-head:
    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  nano:
    fontFamily: "ui-monospace, 'Cascadia Code', 'Courier New', monospace"
    fontSize: "0.65rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.03em"
rounded:
  xs: "3px"
  sm: "4px"
  md: "6px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "20px"
  grid: "32px"
components:
  button-export:
    backgroundColor: "{colors.action-amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 18px"
    typography: "{typography.body}"
  panel-block:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px"
  module-item:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  module-item-selected:
    backgroundColor: "{colors.blue-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  input-field:
    backgroundColor: "{colors.blueprint-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  page-tab:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xs}"
    padding: "5px 10px"
  page-tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.xs}"
    padding: "5px 10px"
---

# Design System: WebForge Builder

## 1. Overview: La Mesa de Trazado

**Creative North Star: "La Mesa de Trazado" (The Drafting Table)**

WebForge Builder se ve como el tablero de un dibujante técnico: una hoja de papel milimetrado
bajo buena luz, tinta de plano, marcas de esquina y anotaciones a mano en monoespaciada. No es
decoración temática — es coherente con lo que la herramienta hace: se compone un sistema (marca,
colores, módulos) con precisión y se ve el resultado ensamblarse en vivo al lado. La densidad es
alta pero legible: un panel de control a la izquierda, el lienzo de preview como protagonista a la
derecha, y cero relleno persuasivo. El azul de plano marca lo que está activo o seleccionado; el
ámbar marca la única acción que importa (exportar). Todo lo demás es tinta, línea y papel.

La identidad tipográfica es **Montserrat como familia única** de toda la interfaz —logo, rótulos
de sección, campos, descripciones, botones y pestañas—, una geométrica de terminación premium que
le da al Builder aire de herramienta cuidada. La **monoespaciada** queda reservada estrictamente
para los **tokens de código** que la herramienta muestra tal cual son: ids de módulo, contadores de
spec y dependencias. Montserrat para lo que se lee; mono sólo donde el texto ES código.

Este sistema **rechaza explícitamente** las cuatro trampas de su categoría: no es una landing SaaS
genérica (nada de hero con degradé, cards de features ni eyebrows en mayúsculas); no es un builder
no-code recargado (nada de drag-handles por todos lados ni chrome que abruma); no es un proyecto de
juguete (la terminación es de trabajo de cliente); y no es un dashboard corporativo gris (la grilla
técnica en claro, bien ejecutada, tiene carácter). El papel es un gris-azulado **frío**, nunca el
crema cálido que delata al diseño hecho por defecto.

**Key Characteristics:**
- Fondo de papel milimetrado (grilla de 32px en `line` sobre `blueprint-paper` frío).
- Todo plano y delineado con 1px; la profundidad la ponen la línea y la grilla, no las sombras.
- Una sola sombra dura con offset (`8px 8px 0`) reservada al lienzo de preview: la sombra de un plano sobre la mesa.
- Marcas de esquina en L (azul de plano) que encuadran el preview como un recorte técnico.
- Montserrat para toda la interfaz; mono reservada sólo para tokens de código (ids, spec, deps).
- Azul = estado (activo/selección/foco). Ámbar = acción (exportar). Nada de color decorativo.

## 2. Colors

Una paleta de plano de taller: tinta casi negra, papel gris-azulado frío, una tinta azul saturada para el estado y un ámbar cálido para la acción, todo sobre líneas finas.

### Primary
- **Azul de Plano** (`#2447f5`): la tinta de estado. Bordes y fondo tenue de los módulos seleccionados, chips de icono de sección (Phosphor en blanco sobre azul), anillo de foco de los campos, ids de módulo y marcas de esquina del preview. Es el color que dice "esto está activo / elegido / enfocado".

### Secondary
- **Ámbar de Acción** (`#ff9f1c`): reservado a la única acción primaria de la pantalla —**Exportar proyecto .zip**— y al acento del logo. Su rareza es su fuerza: cuando aparece ámbar, es algo que hacés, no algo que mirás.

### Neutral
- **Tinta** (`#101828`): texto principal, barra superior, bordes estructurales (panel de 2px), pestaña activa. El "negro" del sistema, con una pizca de azul.
- **Papel de Plano** (`#eef1f6`): el fondo. Un gris-azulado **frío** (no crema), sobre el que se dibuja la grilla milimetrada. También el relleno de los campos en reposo.
- **Línea** (`#cfd7e4`): la grilla milimetrada y todos los bordes de 1px. El material de dibujo del sistema.
- **Tinta de Etiqueta** (`#475467`): labels de formulario. Suficiente contraste sobre blanco (~8:1).
- **Tinta Apagada** (`#667085`): descripciones de módulo y metadatos secundarios (~5.6:1 sobre blanco).
- **Azul Tenue** (`#e4e9ff`): único relleno tintado — el fondo de un módulo seleccionado. Señala selección sin gritar.
- **Blanco** (`#ffffff`): superficie de los paneles, tarjetas y el lienzo del preview, que flota sobre el papel milimetrado.

### Named Rules
**The State-or-Action Rule.** El azul de plano solo comunica **estado** (activo, seleccionado, enfocado) y el ámbar solo comunica **acción** (exportar/compartir). Ningún color se usa como decoración: si un elemento no cambió de estado ni es una acción, va en tinta, línea o papel. La escasez del ámbar —una sola aparición fuerte por pantalla— es lo que lo hace leer como "el botón".

## 3. Typography

**UI Font:** Montserrat (con system-ui, -apple-system, 'Segoe UI', Roboto de respaldo)
**Code-Token Font:** ui-monospace (con 'Cascadia Code', 'Courier New' de respaldo)

**Character:** Montserrat —una geométrica de pesos 400–800— lleva toda la interfaz con una terminación premium y prolija: el logo en 800, los rótulos de sección en 700 espaciados en mayúsculas, los campos y descripciones en 500–600 neutros y rápidos de leer. La monoespaciada aparece sólo en los tokens de código, donde su forma de máquina comunica "esto es un id, no una etiqueta". No hay fuente display ni titulares gigantes: es una herramienta densa, no una portada.

### Hierarchy
- **Wordmark** (Montserrat, 800, 1.02rem, tracking -0.01em): el logo `WEBFORGE_BUILDER` en la barra superior; el `_BUILDER` va en ámbar.
- **Section Label** (Montserrat, 700, 0.75rem, MAYÚSCULAS, tracking 0.07em): los rótulos de bloque del panel (Marca, Colores, Tipografía…), acompañados del chip azul con su icono Phosphor (tag, palette, text-aa, article, squares-four, database — SVG inline de 13px, blanco sobre azul).
- **Body** (Montserrat, 500, 0.88rem, interlínea 1.5): valores de campos, texto de inputs y el nombre de cada módulo (600 para el nombre).
- **Field Label** (Montserrat, 600, 0.75rem): etiquetas sobre cada control del panel, en tinta de etiqueta.
- **Subhead** (Montserrat, 600, 0.86rem): el nombre de cada módulo en la fila del catálogo.
- **Group Head** (Montserrat, 600, 0.8rem): el título de cada categoría colapsable del catálogo de módulos.
- **Mono Meta** (mono, 0.72rem, tracking 0.05em): tokens de código de tamaño medio (dependencias, contadores de categoría). El "número de pieza" de cada cosa.
- **Nano** (mono, 0.65rem): ids reales de módulo y el grano más fino de la hoja de especificaciones.

### Named Rules
**The Dense Micro-Scale Rule.** Es una herramienta densa: el panel usa una **escala chica y acotada** de pasos —`0.65 · 0.72 · 0.75 · 0.8 · 0.86 · 0.88 · 1.02rem`— y nada por fuera de ella. La densidad se logra con pasos finos y consistentes, no inventando tamaños sueltos. Cualquier texto nuevo del panel cae en uno de esos pasos.

**The Mono-for-Code Rule.** La monoespaciada viste **sólo tokens de código** —ids de módulo, contadores de spec, dependencias—: texto que literalmente es un identificador de código. Todo lo demás —marca, rótulos de sección, campos, descripciones, pestañas— va en Montserrat. Poner una etiqueta legible en mono, o un id de código en Montserrat, rompe la señal.

## 4. Elevation

El sistema es **plano por linework**: la profundidad no la dan sombras ambientales sino la grilla milimetrada, los bordes de 1px y el borde estructural de 2px en tinta que separa el panel del lienzo. Las superficies están planas en reposo. Hay exactamente dos excepciones, ambas con intención: (1) una **sombra dura con offset** en el marco del preview, que simula un plano apoyado sobre la mesa; (2) **resplandores de color al hover** —ámbar bajo el botón de exportar, azul bajo los módulos y pestañas— que son respuesta a la interacción, no decoración en reposo.

### Shadow Vocabulary
- **Sombra de Plano** (`box-shadow: 8px 8px 0 rgba(16, 24, 40, 0.12)`): fija, dura, sin blur; solo en el marco del preview. Es la firma del sistema: un recorte sobre la mesa de trazado.
- **Resplandor Ámbar** (`box-shadow: 0 6px 18px rgba(255, 159, 28, 0.35)`): al hover del botón exportar. Refuerza que es la acción.
- **Resplandor Azul** (`box-shadow: 0 5px 14px rgba(36, 71, 245, 0.14)`): al hover de los módulos; una versión más tenue (0.12) queda en el módulo seleccionado.
- **Realce de Pestaña** (`box-shadow: 0 4px 10px rgba(16, 24, 40, 0.14)`): al hover de las pestañas de página.

### Named Rules
**The Linework-First Rule.** La jerarquía se construye con líneas, no con sombras: 1px para divisiones y campos, 2px en tinta para la separación estructural panel/lienzo, y la grilla de 32px como base. Las sombras aparecen **solo** como respuesta a un estado (hover) o para el único lienzo que debe "levantarse" (el preview). Prohibido usar sombras blandas para jerarquizar tarjetas en reposo — eso es blandura de dashboard.

## 5. Components

### Buttons
- **Shape:** esquinas apenas redondeadas (`4px`), compactas.
- **Primary (Exportar):** fondo ámbar de acción (`#ff9f1c`), texto en tinta (`#101828`), peso 700, padding `9px 18px`. Es el único botón fuerte de la pantalla.
- **Hover / Focus:** `filter: brightness(1.08)` + resplandor ámbar (`0 6px 18px rgba(255,159,28,0.35)`); el resorte/escala lo agrega Motion desde `app.js`. Estado `:disabled` a `opacity 0.6` con cursor `wait` (usado durante la exportación).
- **Ghost / Secundario:** no hay un segundo botón fuerte por diseño — las acciones secundarias (compartir) reusan el mismo molde ámbar y aparecen solo cuando aplican.

### Cards / Containers
- **Corner Style:** paneles a `6px`, tarjetas y filas a `4px`.
- **Background:** blanco (`#ffffff`) sobre el papel milimetrado; el panel de configuración es blanco pleno con borde derecho de 2px en tinta.
- **Shadow Strategy:** ninguna en reposo (ver Elevation). Solo el marco del preview lleva la sombra dura con offset.
- **Border:** 1px en `line` (`#cfd7e4`) para bloques y filas; 2px en tinta para separaciones estructurales.
- **Internal Padding:** `14px` en bloques del panel; `8px 10px` en filas de módulo.

### Inputs / Fields
- **Style:** relleno en papel de plano (`#eef1f6`), borde 1px `line`, radio `4px`, texto `0.88rem`. Las etiquetas van encima en sans 600, tinta de etiqueta.
- **Focus:** `outline: 2px solid var(--blue)` con `outline-offset: 1px` — el anillo azul de estado, nunca un glow difuso.
- **Color pickers:** tres swatches en fila (Primario / Acento / Fondo), cada uno `38px` de alto, borde 1px, radio `4px`.

### Navigation
- **Barra superior:** fondo tinta (`#101828`), texto blanco, `56px` de alto. El wordmark a la izquierda; a la derecha el spec tag (conteo de módulos) y las acciones ámbar. No hay nav lateral de links: el "menú" es el panel de configuración.
- **Pestañas de página (preview):** Montserrat 600, `0.72rem`, borde 1px tinta, radio `4px`; la activa invierte a fondo tinta / texto blanco. Hover con realce sutil.
- **Spec tag:** chip Montserrat 600 con borde `currentColor`, radio `999px` (pill), `opacity 0.82` sobre la barra tinta.

### Signature: El Lienzo de Preview
El componente distintivo. Un `iframe` blanco dentro de un marco con borde de 2px en tinta, **sombra dura con offset** (`8px 8px 0`) y **marcas de esquina en L** en azul de plano (pseudo-elementos `::before`/`::after`, `14px`, arriba-izquierda y abajo-derecha) que lo encuadran como un recorte de plano. Es el protagonista de la pantalla: siempre visible, siempre mostrando el proyecto que se ensambla.

### Signature: Fila de Módulo (spec sheet)
Cada módulo es una fila tipo hoja de especificaciones: checkbox (accent azul), id en mono `0.65rem` azul (token de código), nombre en Montserrat 600, y descripción en Montserrat `0.75rem` tinta apagada. En reposo, borde `line`; al hover, borde y resplandor azul; seleccionado, borde azul + fondo `blue-soft`. Es el catálogo de 140+ módulos, denso y escaneable.

## 6. Do's and Don'ts

### Do:
- **Do** mantener la grilla milimetrada de 32px como fondo del workspace: es la identidad, no un adorno.
- **Do** reservar el ámbar (`#ff9f1c`) para la acción primaria (exportar/compartir) y nada más — una aparición fuerte por pantalla.
- **Do** usar el azul de plano (`#2447f5`) solo para estado: activo, seleccionado, foco.
- **Do** vestir toda la interfaz en Montserrat (marca, rótulos, campos, descripciones, pestañas) y reservar la monoespaciada sólo para tokens de código (ids de módulo, contadores de spec, dependencias).
- **Do** construir jerarquía con líneas de 1px, el borde estructural de 2px en tinta y la grilla — no con sombras.
- **Do** mantener el lienzo de preview como protagonista, con su marca de esquina y su sombra dura con offset.
- **Do** verificar contraste: labels en `#475467` y descripciones en `#667085` sobre blanco están sobre 5:1; mantené el texto de lectura al menos en ese piso.

### Don't:
- **Don't** teñir el papel hacia el crema/cálido: el fondo es un gris-azulado **frío** (`#eef1f6`). El crema cálido es el default de IA que este sistema rechaza.
- **Don't** convertir esto en una **landing SaaS genérica**: nada de hero con degradé, tríos de cards de features, métricas gigantes ni eyebrows en mayúsculas tracked sobre cada bloque.
- **Don't** convertirlo en un **builder no-code recargado**: nada de drag-handles por todos lados ni chrome que abrume el panel.
- **Don't** dejar que parezca un **proyecto de juguete**: la terminación es de trabajo de cliente; cuidá alineación, bordes y estados.
- **Don't** caer en el **dashboard corporativo estéril**: gris sobre gris sin la grilla ni la tinta de plano que le dan carácter.
- **Don't** usar sombras blandas para jerarquizar tarjetas en reposo (viola la Linework-First Rule); la única sombra dura es la del preview.
- **Don't** usar `background-clip: text` con degradé, bordes-franja laterales (`border-left`/`right` > 1px como acento), ni glassmorphism decorativo.
- **Don't** invertir las voces tipográficas: poner texto legible (etiquetas, descripciones) en mono, o un id de código en Montserrat, rompe la señal de "esto es código".
