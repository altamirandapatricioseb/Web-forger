# Product

## Register

product

## Platform

web

## Users

El usuario primario es **desarrollador o agencia**: alguien técnico que arma y exporta sitios
comerciales completos para clientes activando módulos, en vez de escribir el andamiaje a mano. Su
contexto es de trabajo: quiere pasar de una idea a un proyecto Express desplegable en minutos, con
backend real y sin repetir el mismo boilerplate en cada encargo. El trabajo a resolver es
**ensamblar y exportar un proyecto listo para producir**, no diseñar desde cero.

Hay una segunda audiencia indirecta por la naturaleza de generador: los **visitantes de los sitios
generados** (los clientes finales de la agencia). Es un desdoblamiento superficie-vs-usuario: el
Builder le habla al operador técnico; las páginas que emite le hablan al público de ese operador.
Por eso la calidad no termina en el Builder — el output generado tiene que sostenerse solo.

## Product Purpose

WebForge Builder es un **generador modular de webapps**: un workspace de dos paneles (configuración
de marca/colores/tipografía/módulos a la izquierda, preview en vivo a la derecha) que produce un
proyecto Express 5 completo y lo empaqueta como `.zip` descargable. El catálogo tiene 140+ módulos
toggleables — de UI (hero, galerías, navbars, FAQ) y funcionales con backend de verdad (auth,
carrito, reseñas, testimonios moderados, centro de ayuda, gestión de presupuestos…). El éxito de una
sesión es concreto: **exportar un proyecto que buildea y despliega sin tocar código**, gratis, en
Vercel/Supabase.

## Positioning

Tres afirmaciones, las tres igual de importantes, y toda pantalla debería reforzarlas:

1. **Backend real, no maquetas** — cada módulo funcional trae un backend que funciona (rutas,
   validación, persistencia, auth). Nunca una función "de mentira" solo-front. Es la regla dura del
   proyecto y su diferenciador más fuerte.
2. **Sitio completo, deploy gratis** — se ensambla un sitio comercial entero sin servicios pagos ni
   API keys obligatorias, desplegable en las capas gratuitas de Vercel y Supabase.
3. **Ensamblar, no programar** — 140+ módulos de producción se combinan en un proyecto Express
   terminado, exportable, sin escribir código.

## Brand Personality

Dirección elegida: **precisión de ingeniería con terminación premium**. El ADN de "plano técnico"
que ya vive en el Builder (grilla milimetrada, logo monoespaciado, marcas de esquina en el preview,
ids de módulo a la vista) es honesto para una herramienta que genera código y conviene conservarlo
como identidad — pero elevado por encima de su ejecución plana actual: jerarquía tipográfica real,
espaciado disciplinado, el preview en vivo como protagonista. La voz es técnica, exacta y sin
adornos, en español rioplatense; nombra las cosas por lo que son (módulo, id, colección) sin jerga
de marketing. Lo que debe transmitir: **competencia, confianza y un poco de orgullo por el oficio** —
que se sienta hecho por gente que sabe, digno de usarse en trabajo de cliente.

## Anti-references

Explícitamente NO debe parecerse a:

- **Landing SaaS genérica** — hero con degradé, tres cards de features, métricas gigantes, eyebrows
  en mayúsculas tracked sobre cada sección.
- **Builder no-code recargado** (estilo Wix/Elementor) — paneles densos, drag-handles por todos
  lados, chrome que abruma.
- **Proyecto de juguete/hobby** — que parezca inacabado o amateur; eso socava la confianza para
  trabajo de cliente.
- **Dashboard corporativo estéril** — gris sobre gris, sin alma, blandura de admin empresarial.

El desafío de diseño es esquivar las cuatro a la vez: ni cálido-cremita de SaaS, ni oscuro-terminal
de dev-tool por reflejo. La grilla técnica en claro, bien ejecutada, es el camino para diferenciarse.

## Design Principles

- **Practicá lo que predicás.** El Builder tiene que ser tan sólido y backend-real como lo que
  emite; si el output es producción, la herramienta no puede sentirse prototipo.
- **La configuración es el producto.** El workspace es una superficie de control, no una página de
  marketing: la legibilidad de las opciones y del estado gana sobre la decoración.
- **Mostrá el resultado, no una promesa.** El preview en vivo es el héroe; el usuario siempre
  debería estar viendo lo que ensambla, no leyendo sobre ello.
- **Hecho por ingenieros, para ingenieros.** Lenguaje técnico honesto (ids, spec tags, nombres de
  colección), cero patrones de growth-hack ni relleno persuasivo.
- **Gratis y autocontenido como postura.** Sin servicios pagos ni lock-in; la UI nunca debería
  insinuar un paywall.

## Accessibility & Inclusion

Nivel **best-effort**: buenos defaults, acceso por teclado, contraste AA donde sea práctico y respeto
por `prefers-reduced-motion` (que el output generado ya honra, con red de seguridad para pestañas
ocultas). Sin objetivo formal de conformidad WCAG, pero sin descuidar lo básico ni en el Builder ni
en los sitios generados.
