const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'lightbox', type: 'ui', name: 'Lightbox',
  description: 'Amplía imágenes y tarjetas de la galería en una vista superpuesta, con cierre por clic o Escape.',
  clientJs: () => `/* Módulo lightbox: clic en una imagen de contenido (o tarjeta de la galería)
   la muestra ampliada sobre un fondo oscuro. Un solo overlay reutilizado. */
(function () {
  // Imágenes de contenido y tarjetas de la galería (que pueden ser placeholders sin <img>)
  var targets = document.querySelectorAll('section img, #galeria .card');
  if (!targets.length) return;
  var style = document.createElement('style');
  style.textContent = '.lightbox-overlay{position:fixed;inset:0;z-index:60;display:flex;align-items:center;' +
    'justify-content:center;padding:24px;background:rgba(0,0,0,.78);cursor:zoom-out}' +
    '.lightbox-overlay img,.lightbox-overlay .card{max-width:min(920px,92vw);max-height:86vh;cursor:auto}' +
    '.lightbox-overlay img{object-fit:contain;border-radius:var(--radius)}' +
    '.lightbox-overlay .card{width:min(920px,92vw);aspect-ratio:auto;min-height:300px}' +
    '.lightbox-close{position:absolute;top:16px;right:16px;width:40px;height:40px;border:0;border-radius:50%;' +
    'background:rgba(255,255,255,.15);color:#fff;font-size:1.2rem;cursor:pointer}' +
    '.lightbox-zoomable{cursor:zoom-in}';
  document.head.appendChild(style);
  var overlay = null;
  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function open(el) {
    close();
    overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Vista ampliada');
    // Clona el elemento clickeado para no mover el original del layout
    var clone = el.cloneNode(true);
    clone.classList.remove('lightbox-zoomable');
    // La tarjeta conserva su estilo inline (gradiente) pero suelta la proporción fija
    if (clone.classList.contains('card')) clone.style.aspectRatio = 'auto';
    overlay.appendChild(clone);
    var btn = document.createElement('button');
    btn.className = 'lightbox-close';
    btn.type = 'button';
    btn.innerHTML = '${phIcon('x', { size: 20 })}';
    btn.setAttribute('aria-label', 'Cerrar vista ampliada');
    overlay.appendChild(btn);
    // Cierra con el botón o clickeando fuera del contenido
    overlay.addEventListener('click', function (e) { if (e.target === overlay || e.target === btn) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    btn.focus();
  }
  targets.forEach(function (el) {
    el.classList.add('lightbox-zoomable');
    el.addEventListener('click', function () { open(el); });
  });
})();`,
};
