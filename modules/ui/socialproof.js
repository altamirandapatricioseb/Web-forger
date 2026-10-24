const { esc, txt, txtList } = require('../../src/templates');

// Mensajes placeholder, editables desde el Builder. Las tres listas se combinan por índice
// para armar cada aviso, así que no hace falta que tengan el mismo largo.
const ACCIONES = ['reservó un turno', 'hizo una compra', 'pidió un presupuesto', 'dejó una reseña', 'se suscribió al newsletter'];
const LUGARES = ['Córdoba', 'Rosario', 'Buenos Aires', 'Mendoza', 'La Plata', 'Salta', 'Mar del Plata'];
const NOMBRES = ['Sofía', 'Mateo', 'Valentina', 'Juan', 'Camila', 'Lucas', 'Martina', 'Diego'];

// Defaults de los campos editables: exactamente las listas de arriba, para que el panel
// arranque mostrando lo que el sitio ya dice y no un campo vacío que hay que adivinar.
const ACCIONES_DEFAULT = ACCIONES.join('\n');
const LUGARES_DEFAULT = LUGARES.join('\n');
const NOMBRES_DEFAULT = NOMBRES.join('\n');

/**
 * Lista efectiva de una de las tres columnas del aviso: una entrada por línea. Devuelve
 * siempre un array NO vacío (cae a la lista base) porque el JS del cliente indexa con
 * módulo: con una lista vacía el aviso quedaría en "undefined".
 * Cada entrada se escapa con esc() porque el aviso se arma con innerHTML.
 */
function lista(cfg, key, base) {
  const lineas = txtList(cfg, 'socialproof', key, base.join('\n'));
  const items = lineas.map(l => esc(Array.isArray(l) ? l.join(' | ') : l)).filter(Boolean);
  return items.length ? items : base.map(esc);
}

// Avisos flotantes de actividad reciente ("prueba social"): cada tanto aparece
// abajo a la izquierda un cartelito tipo "Alguien de Córdoba reservó hace 3 min".
// La rotación es determinista (recorre la lista en orden, no al azar). Solo clientJs:
// sin JS no aparece nada (no rompe el layout). Usa Motion para la entrada si está
// disponible; si no, cae a una transición CSS. Respeta prefers-reduced-motion.
module.exports = {
  id: 'socialproof', type: 'ui', name: 'Avisos de actividad reciente',
  description: 'Cartelitos flotantes que muestran actividad reciente ("Alguien de Córdoba reservó hace 3 min"). Prueba social típica de e-commerce. Se pueden cerrar y recuerdan el cierre en la sesión.',
  fields: [
    {
      key: 'nombres', label: 'Nombres', type: 'list', max: 1500, default: NOMBRES_DEFAULT,
      hint: 'Un nombre por línea. Es la primera parte del aviso ("Sofía de Córdoba reservó un turno"); la inicial se usa para el círculo de color.',
    },
    {
      key: 'lugares', label: 'Localidades', type: 'list', max: 1500, default: LUGARES_DEFAULT,
      hint: 'Una localidad por línea. Es la segunda parte del aviso ("Sofía de Córdoba reservó un turno").',
    },
    {
      key: 'acciones', label: 'Acciones', type: 'list', max: 1500, default: ACCIONES_DEFAULT,
      hint: 'Una acción por línea, escrita en pasado y sin punto final. Es el cierre del aviso ("Sofía de Córdoba reservó un turno").',
    },
  ],
  // Las tres listas viajan adentro de un string de JavaScript: se interpolan con
  // JSON.stringify (nunca con esc suelto), y sus entradas ya vienen escapadas porque
  // el aviso se arma con innerHTML.
  clientJs: (cfg) => `// Módulo avisos de actividad reciente: prueba social flotante abajo a la izquierda.
// Los mensajes y localidades salen del Builder (bloque "Textos por sección").
// Recorre la lista en orden (determinista). Se cierra con la X y no vuelve en la sesión.
(function () {
  var ACCIONES = ${JSON.stringify(lista(cfg, 'acciones', ACCIONES))};
  var LUGARES = ${JSON.stringify(lista(cfg, 'lugares', LUGARES))};
  var NOMBRES = ${JSON.stringify(lista(cfg, 'nombres', NOMBRES))};

  if (sessionStorage.getItem('sp-cerrado') === '1') return;

  // Estilos inline: no depende del CSS del sitio
  var estilo = document.createElement('style');
  estilo.textContent =
    '.sp-aviso{position:fixed;left:16px;bottom:16px;z-index:55;max-width:300px;display:flex;gap:10px;' +
    'align-items:center;background:var(--surface,#fff);color:var(--text,#111);border:1px solid var(--line,#e5e7eb);' +
    'border-radius:12px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.14);opacity:0}' +
    '.sp-aviso.sp-visible{opacity:1}' +
    '.sp-punto{flex:0 0 auto;width:34px;height:34px;border-radius:999px;background:var(--accent,#2563eb);' +
    'color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem}' +
    '.sp-texto{font-size:.82rem;line-height:1.35}.sp-texto b{font-weight:600}' +
    '.sp-tiempo{display:block;color:var(--muted,#6b7280);font-size:.72rem;margin-top:2px}' +
    '.sp-cerrar{margin-left:auto;background:none;border:0;color:var(--muted,#6b7280);font-size:1.1rem;' +
    'line-height:1;cursor:pointer;padding:2px 4px;align-self:flex-start}' +
    '.sp-cerrar:hover{color:var(--text,#111)}' +
    '@media (max-width:640px){.sp-aviso{left:10px;right:10px;bottom:10px;max-width:none}}';
  document.head.appendChild(estilo);

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var M = window.Motion;

  var caja = document.createElement('div');
  caja.className = 'sp-aviso';
  caja.setAttribute('role', 'status');
  caja.setAttribute('aria-live', 'polite');
  caja.style.display = 'none';
  document.body.appendChild(caja);

  var i = 0, ocultarTimer = null, siguienteTimer = null;

  function armarTexto(idx) {
    var nombre = NOMBRES[idx % NOMBRES.length];
    var lugar = LUGARES[idx % LUGARES.length];
    var accion = ACCIONES[idx % ACCIONES.length];
    var minutos = ((idx * 7) % 55) + 2; // tiempo determinista, siempre "hace unos minutos"
    return '<div class="sp-punto" aria-hidden="true">' + nombre.charAt(0) + '</div>' +
      '<div class="sp-texto"><b>' + nombre + '</b> de <b>' + lugar + '</b> ' + accion +
      '<span class="sp-tiempo">hace ' + minutos + ' min</span></div>' +
      '<button class="sp-cerrar" type="button" aria-label="Cerrar aviso">×</button>';
  }

  function cerrarTodo() {
    sessionStorage.setItem('sp-cerrado', '1');
    clearTimeout(ocultarTimer); clearTimeout(siguienteTimer);
    caja.style.display = 'none';
  }

  function ocultar() {
    if (M && M.animate && !reduce) {
      M.animate(caja, { opacity: [1, 0], y: [0, 12] }, { duration: 0.35 })
        .finished.then(function () { caja.style.display = 'none'; caja.style.transform = ''; }).catch(function () {});
    } else {
      caja.classList.remove('sp-visible');
      setTimeout(function () { caja.style.display = 'none'; }, 300);
    }
    siguienteTimer = setTimeout(mostrar, 9000);
  }

  function mostrar() {
    caja.innerHTML = armarTexto(i);
    i++;
    caja.querySelector('.sp-cerrar').addEventListener('click', cerrarTodo);
    caja.style.display = 'flex';
    if (M && M.animate && !reduce) {
      caja.style.opacity = '0';
      M.animate(caja, { opacity: [0, 1], y: [12, 0] }, { duration: 0.4, ease: [0.22, 1, 0.36, 1] });
    } else {
      requestAnimationFrame(function () { caja.classList.add('sp-visible'); });
    }
    ocultarTimer = setTimeout(ocultar, 5000);
  }

  // Primer aviso a los 4s (deja respirar al visitante antes de aparecer)
  siguienteTimer = setTimeout(mostrar, 4000);
})();`,
  readmeNotes: () => [
    '**Avisos de actividad reciente**: los nombres, localidades y acciones salen del bloque *Textos por sección* del Builder; si no los editaste, son placeholders. También podés cambiarlos después en las constantes `ACCIONES`, `LUGARES` y `NOMBRES` de `public/js/app.js` (bloque "avisos de actividad reciente").',
  ],
};
