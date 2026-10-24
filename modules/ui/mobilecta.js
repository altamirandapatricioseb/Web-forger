// Barra de llamada a la acción fija al pie, SOLO en móvil (≤640px). Es el patrón
// de conversión típico de e-commerce y servicios: un botón siempre a mano sin tapar
// el contenido del desktop. Solo clientJs: sin JS no aparece nada (no rompe layout).
// El destino del botón se resuelve en generación según los módulos activos.
// Usa Motion para la entrada deslizante si está disponible; si no, cae a CSS.
const { esc, txt } = require('../../src/templates');

module.exports = {
  id: 'mobilecta', type: 'ui', name: 'CTA fijo en móvil',
  description: 'Barra de acción fija al pie de la pantalla en móvil con un botón siempre visible (contacto, presupuesto o WhatsApp). Solo se muestra en pantallas chicas.',
  fields: [
    // Vacío por defecto porque el texto original depende de los módulos elegidos (contacto,
    // presupuesto o nosotros): si el cliente no escribe nada, sigue saliendo el de siempre.
    { key: 'etiqueta', label: 'Texto del botón principal', default: '', max: 40, hint: 'Si lo dejás vacío se usa "Contactanos", "Pedir presupuesto" o "Conocenos" según los módulos activos.' },
    { key: 'etiquetaWhatsapp', label: 'Texto del botón de WhatsApp', default: 'WhatsApp', max: 30 },
  ],
  clientJs: (cfg) => {
    // Destino del botón: contacto > presupuesto > nosotros. Texto acorde.
    const ids = cfg.moduleIds || [];
    let href = '/about.html', etiqueta = 'Conocenos';
    if (ids.includes('contact')) { href = '/contact.html'; etiqueta = 'Contactanos'; }
    else if (ids.includes('quote')) { href = '/quote.html'; etiqueta = 'Pedir presupuesto'; }
    // Si WhatsApp está activo, se agrega un segundo botón directo al chat.
    const conWhatsapp = ids.includes('whatsapp');
    // Las etiquetas entran por innerHTML del lado del cliente, así que se escapan acá con
    // esc() y recién después se serializan con JSON.stringify para viajar dentro del string.
    return `// Módulo CTA fijo en móvil: barra inferior con botón(es) de acción, solo en pantallas chicas.
(function () {
  var HREF = ${JSON.stringify(href)};
  var ETIQUETA = ${JSON.stringify(esc(txt(cfg, 'mobilecta', 'etiqueta', etiqueta)))};
  var ETIQUETA_WA = ${JSON.stringify(esc(txt(cfg, 'mobilecta', 'etiquetaWhatsapp', 'WhatsApp')))};
  var CON_WHATSAPP = ${conWhatsapp ? 'true' : 'false'};
  var mq = window.matchMedia('(max-width:640px)');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var M = window.Motion;

  // Estilos inline: no dependen del CSS del sitio. Se oculta en desktop por media query.
  var estilo = document.createElement('style');
  estilo.textContent =
    '.mcta{position:fixed;left:0;right:0;bottom:0;z-index:56;display:none;gap:8px;padding:10px 12px;' +
    'padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));background:var(--bg,#fff);' +
    'border-top:1px solid var(--line,#e5e7eb);box-shadow:0 -6px 24px rgba(0,0,0,.08)}' +
    '.mcta a{flex:1;text-align:center;padding:13px 16px;border-radius:10px;font-weight:700;' +
    'text-decoration:none;font-size:.98rem}' +
    '.mcta .mcta-main{background:var(--accent,#2563eb);color:#fff}' +
    '.mcta .mcta-wa{flex:0 0 auto;background:#25d366;color:#fff;display:inline-flex;align-items:center;gap:6px}' +
    '@media (max-width:640px){.mcta.mcta-on{display:flex}body.mcta-pad{padding-bottom:76px}}';
  document.head.appendChild(estilo);

  var barra = document.createElement('div');
  barra.className = 'mcta';
  barra.setAttribute('role', 'region');
  barra.setAttribute('aria-label', 'Acciones rápidas');

  // Se arma diferido (rAF): así el botón flotante de WhatsApp, que crea su propio
  // módulo más adelante en app.js, ya existe y podemos reutilizar su enlace wa.me.
  function construir() {
    var html = '<a class="mcta-main" href="' + HREF + '">' + ETIQUETA + '</a>';
    if (CON_WHATSAPP) {
      var wa = document.querySelector('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
      var waHref = wa ? wa.getAttribute('href') : '#';
      html += '<a class="mcta-wa" href="' + waHref + '" aria-label="Escribir por WhatsApp"' +
        (wa ? ' target="_blank" rel="noopener"' : '') + '>' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1012 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.8-.6-3-1.3-5-4.4-5.1-4.6-.2-.2-1.3-1.7-1.3-3.2 0-1.5.8-2.3 1.1-2.6.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5.2.6.8 2 .9 2.1.1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.3.1 1.6.8 1.8.9.3.1.4.2.5.3.1.2.1.8-.1 1.4z"/></svg>' + ETIQUETA_WA + '</a>';
    }
    barra.innerHTML = html;
  }

  function activar() {
    if (!mq.matches) { barra.classList.remove('mcta-on'); document.body.classList.remove('mcta-pad'); return; }
    document.body.appendChild(barra);
    document.body.classList.add('mcta-pad');
    if (M && M.animate && !reduce) {
      barra.classList.add('mcta-on');
      M.animate(barra, { transform: ['translateY(100%)', 'translateY(0)'] }, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
    } else {
      barra.classList.add('mcta-on');
    }
  }
  // Diferido (timer 0) para que el FAB de WhatsApp, creado más adelante en app.js,
  // ya esté en el DOM al copiar su enlace. setTimeout se usa en vez de rAF porque
  // sigue disparando aunque la pestaña esté oculta (rAF se suspende en ese caso).
  setTimeout(function () { construir(); activar(); }, 0);
  // Reacciona a rotación / cambio de tamaño de viewport
  (mq.addEventListener ? mq.addEventListener('change', activar) : mq.addListener(activar));
})();`;
  },
};
