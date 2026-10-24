const { txt } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'promo', type: 'ui', name: 'Popup de promoción',
  description: 'Ventana emergente de promoción que aparece tras unos segundos (o al scrollear media página), se cierra con Escape o clic afuera y respeta una frecuencia máxima por visitante.',
  fields: [
    { key: 'titulo', label: 'Título del popup', default: '¡10% de descuento en tu primera compra!', max: 80 },
    { key: 'texto', label: 'Texto', type: 'textarea', default: 'Contanos qué necesitás esta semana y accedé al descuento de bienvenida.', max: 220 },
    { key: 'boton', label: 'Texto del botón', default: 'Quiero mi descuento', max: 40 },
  ],
  // El botón del popup apunta al canal de conversión disponible según los módulos activos
  clientJs: (cfg) => {
    const destino = cfg.moduleIds.includes('quote') ? '/quote.html'
      : cfg.moduleIds.includes('contact') ? '/contact.html' : '/about.html';
    // Los textos viajan adentro de un string de JS, así que van por JSON.stringify y no por
    // esc(): un apóstrofo en "¡Sumate al club!" partiría el archivo generado al medio.
    return `/* Módulo popup de promoción: editá los textos de PROMO acá abajo.
   frecuenciaDias controla cada cuántos días puede volver a aparecer tras cerrarse. */
(function () {
  var PROMO = {
    titulo: ${JSON.stringify(txt(cfg, 'promo', 'titulo', '¡10% de descuento en tu primera compra!'))},
    texto: ${JSON.stringify(txt(cfg, 'promo', 'texto', 'Contanos qué necesitás esta semana y accedé al descuento de bienvenida.'))},
    textoBoton: ${JSON.stringify(txt(cfg, 'promo', 'boton', 'Quiero mi descuento'))},
    url: '${destino}',
    retardoSegundos: 8,
    frecuenciaDias: 7,
  };
  // Respeta la frecuencia: si se cerró hace menos de frecuenciaDias, no se muestra
  var visto = Number(localStorage.getItem('promo-cerrado') || 0);
  if (Date.now() - visto < PROMO.frecuenciaDias * 24 * 3600 * 1000) return;

  var abierto = false;
  function abrir() {
    if (abierto) return;
    abierto = true;
    var fondo = document.createElement('div');
    fondo.id = 'promo-popup';
    fondo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:60;display:flex;align-items:center;justify-content:center;padding:20px';
    var caja = document.createElement('div');
    caja.setAttribute('role', 'dialog');
    caja.setAttribute('aria-modal', 'true');
    caja.setAttribute('aria-labelledby', 'promo-titulo');
    caja.style.cssText = 'background:var(--bg);color:var(--text);border-radius:var(--radius);max-width:420px;width:100%;padding:28px;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.3)';
    caja.innerHTML =
      '<button type="button" id="promo-cerrar" aria-label="Cerrar" style="position:absolute;top:10px;right:10px;width:34px;background:none;border:0;cursor:pointer;color:var(--muted);padding:4px">${phIcon('x', { size: 18 })}</button>' +
      '<h3 id="promo-titulo" style="margin:0 0 8px;font-size:1.3rem">' + App.esc(PROMO.titulo) + '</h3>' +
      '<p style="margin:0 0 18px;color:var(--muted)">' + App.esc(PROMO.texto) + '</p>' +
      '<a class="btn" id="promo-cta" href="' + PROMO.url + '">' + App.esc(PROMO.textoBoton) + '</a>';
    fondo.appendChild(caja);
    document.body.appendChild(fondo);
    function cerrar() {
      localStorage.setItem('promo-cerrado', String(Date.now()));
      fondo.remove();
      document.removeEventListener('keydown', porTecla);
    }
    function porTecla(e) { if (e.key === 'Escape') cerrar(); }
    document.getElementById('promo-cerrar').addEventListener('click', cerrar);
    document.getElementById('promo-cta').addEventListener('click', function () { localStorage.setItem('promo-cerrado', String(Date.now())); });
    fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); });
    document.addEventListener('keydown', porTecla);
    document.getElementById('promo-cerrar').focus();
  }
  // Se dispara por tiempo o por scroll a media página, lo que ocurra primero
  var timer = setTimeout(abrir, PROMO.retardoSegundos * 1000);
  function porScroll() {
    var mitad = (document.documentElement.scrollHeight - innerHeight) / 2;
    if (scrollY >= mitad && mitad > 0) {
      clearTimeout(timer);
      removeEventListener('scroll', porScroll);
      abrir();
    }
  }
  addEventListener('scroll', porScroll, { passive: true });
})();`;
  },
  readmeNotes: () => [
    '**Popup de promoción**: el título, el texto y el botón salen del Builder (bloque *Textos por sección*). El destino del botón, el retardo y la frecuencia se editan en la constante `PROMO` de `public/js/app.js` (buscá "popup de promoción").',
  ],
};
