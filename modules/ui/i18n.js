// Diccionario de textos FIJOS del sitio (es → en). Los textos que el usuario carga
// en el Builder (hero, "sobre nosotros", etc.) no se traducen: quedan como los escribió.
// Cubre la navegación, el footer y las secciones de los módulos más comunes; el cliente
// puede agregar entradas en public/js/app.js (buscar "módulo multiidioma").
const DICT = {
  // Navegación y layout base
  'Inicio': 'Home',
  'Nosotros': 'About us',
  'Contacto': 'Contact',
  'Presupuesto': 'Quote',
  'Suscribirme': 'Subscribe',
  // Página "Nosotros"
  'Misión': 'Mission',
  'Equipo': 'Team',
  'Valores': 'Values',
  'Resolver de verdad el problema de nuestros clientes, sin vueltas.': 'Truly solving our clients’ problems, no runaround.',
  'Un equipo chico y enfocado, con oficio y ganas.': 'A small, focused team with craft and drive.',
  'Claridad, calidad y trato directo.': 'Clarity, quality and straight talk.',
  // Encabezados y bajadas de secciones de módulos comunes
  'Nuestros servicios': 'Our services',
  'Soluciones pensadas para cada etapa de tu negocio.': 'Solutions designed for every stage of your business.',
  'Preguntas frecuentes': 'Frequently asked questions',
  'Galería': 'Gallery',
  'Algunos de nuestros trabajos recientes.': 'Some of our recent work.',
  'Lo que dicen nuestros clientes': 'What our clients say',
  'Nuestro equipo': 'Our team',
  'Planes': 'Plans',
  'Elegí el que mejor se adapte a tu etapa.': 'Choose the one that best fits your stage.',
  'Novedades': 'News',
  'Lo último de nuestro equipo.': 'The latest from our team.',
  'Leer más': 'Read more',
  'Volver a novedades': 'Back to news',
  'Nuestro portfolio': 'Our portfolio',
  'Una selección de proyectos que muestran cómo trabajamos.': 'A selection of projects that show how we work.',
  'Foto del proyecto': 'Project photo',
  'Todos': 'All',
  'Llamar': 'Call',
  'Cómo llegar': 'Directions',
  'Destacados': 'Highlights',
  'Hablemos': 'Let’s talk',
  'Contanos qué necesitás y te respondemos a la brevedad.': 'Tell us what you need and we’ll get back to you shortly.',
  'Horarios de atención': 'Opening hours',
  'Te esperamos en estos horarios.': 'We’re open at these times.',
  'Lunes a viernes': 'Monday to Friday',
  'Sábados': 'Saturdays',
  'Domingos y feriados': 'Sundays and holidays',
  'Cerrado': 'Closed',
  'Dónde encontrarnos': 'Where to find us',
  'Vení a visitarnos o escribinos: estamos para ayudarte.': 'Come visit us or write to us: we’re here to help.',
  'Números que nos respaldan': 'Numbers that back us up',
  'La trayectoria se mide en resultados concretos.': 'A track record measured in concrete results.',
  'Conocenos en un minuto': 'Get to know us in a minute',
  'Mirá cómo trabajamos y qué podemos hacer por vos.': 'See how we work and what we can do for you.',
  'Nuestra historia': 'Our story',
  'El camino que nos trajo hasta acá.': 'The road that brought us here.',
  'Cómo trabajamos': 'How we work',
  'Un proceso claro de principio a fin, sin sorpresas.': 'A clear process from start to finish, no surprises.',
  // Buscador global, bolsa de trabajo y promociones (módulos funcionales)
  'Buscar': 'Search',
  'Buscá en todo el sitio': 'Search the whole site',
  'Escribí lo que necesitás y te mostramos todo lo que tenemos sobre eso.': 'Type what you need and we’ll show you everything we have about it.',
  'Vacantes': 'Openings',
  'Sumate al equipo': 'Join the team',
  'Estas son nuestras búsquedas abiertas. Abrí la que te interese y postulate ahí mismo.': 'These are our open positions. Open the one you like and apply right there.',
  'Promociones': 'Promotions',
  'Aprovechalas antes de que terminen: estas son las promos activas hoy.': 'Grab them before they end: these are today’s active deals.',
  // Formularios (contacto y presupuesto)
  'Nombre': 'Name',
  'Mensaje': 'Message',
  'Enviar mensaje': 'Send message',
  'Teléfono (opcional)': 'Phone (optional)',
  'Pedí tu presupuesto': 'Request a quote',
  'Contanos qué necesitás en tres pasos y te enviamos una propuesta sin compromiso.': 'Tell us what you need in three steps and we’ll send you a proposal, no strings attached.',
  '1 · Tus datos': '1 · Your details',
  '2 · Tu proyecto': '2 · Your project',
  '3 · Confirmar': '3 · Confirm',
  'Qué necesitás': 'What do you need',
  'Elegí una opción': 'Choose an option',
  'Presupuesto estimado': 'Estimated budget',
  'Elegí un rango': 'Choose a range',
  'Contanos más': 'Tell us more',
  'Revisá tu pedido': 'Review your request',
  'Atrás': 'Back',
  'Siguiente': 'Next',
  'Enviar pedido': 'Send request',
};

module.exports = {
  id: 'i18n', type: 'ui', name: 'Multiidioma (ES/EN)',
  description: 'Selector de idioma en la navbar: traduce los textos fijos del sitio al inglés con un diccionario editable y recuerda la elección. Los textos del Builder no se tocan.',
  nav: () => [{ label: 'EN', href: '#', id: 'lang-toggle' }],
  clientJs: () => `/* Módulo multiidioma: alterna los textos FIJOS del sitio entre español e inglés.
   Agregá o corregí traducciones en el diccionario DICT ('texto en español': 'in English').
   Los textos cargados en el Builder y el contenido dinámico quedan en su idioma original. */
(function () {
  var btn = document.getElementById('lang-toggle');
  if (!btn) return;
  var DICT = ${JSON.stringify(DICT, null, 2).replace(/\n/g, '\n  ')};
  // Guarda qué se cambió para poder volver a español sin recargar
  var cambiados = [];
  var ATRIBUTOS = ['placeholder', 'aria-label', 'title'];
  function traducir() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodo;
    while ((nodo = walker.nextNode())) {
      var tag = nodo.parentNode && nodo.parentNode.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      // Separa el texto de sus espacios para traducir por coincidencia exacta
      var partes = nodo.nodeValue.match(/^(\\s*)([\\s\\S]*?)(\\s*)$/);
      if (partes && DICT[partes[2]]) {
        cambiados.push({ nodo: nodo, es: nodo.nodeValue });
        nodo.nodeValue = partes[1] + DICT[partes[2]] + partes[3];
      }
    }
    ATRIBUTOS.forEach(function (attr) {
      Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (el) {
        var v = el.getAttribute(attr);
        if (DICT[v]) {
          cambiados.push({ el: el, attr: attr, es: v });
          el.setAttribute(attr, DICT[v]);
        }
      });
    });
    document.documentElement.lang = 'en';
    btn.textContent = 'ES';
    btn.setAttribute('aria-label', 'Cambiar a español');
  }
  function restaurar() {
    cambiados.forEach(function (c) {
      if (c.nodo) c.nodo.nodeValue = c.es;
      else c.el.setAttribute(c.attr, c.es);
    });
    cambiados = [];
    document.documentElement.lang = 'es';
    btn.textContent = 'EN';
    btn.setAttribute('aria-label', 'Switch to English');
  }
  // localStorage puede fallar en contextos aislados (p. ej. el iframe del preview)
  var store = {
    get() { try { return localStorage.getItem('lang'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem('lang', v); } catch (e) {} },
  };
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    var aIngles = document.documentElement.lang !== 'en';
    if (aIngles) traducir(); else restaurar();
    store.set(aIngles ? 'en' : 'es');
  });
  btn.setAttribute('aria-label', 'Switch to English');
  // Aplica el idioma recordado de la visita anterior
  if (store.get() === 'en') traducir();
})();`,
  readmeNotes: () => [
    '**Multiidioma**: el botón EN/ES de la navbar traduce los textos fijos del sitio con el diccionario `DICT` de `public/js/app.js` (buscá "módulo multiidioma"). Los textos que cargaste en el Builder y el contenido dinámico (catálogo, comentarios, etc.) no se traducen: agregá sus entradas al diccionario si las necesitás en inglés.',
  ],
};
