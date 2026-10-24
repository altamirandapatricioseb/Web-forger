// Precios con interruptor mensual/anual animado. Cada plan trae los dos importes en
// data-mensual/data-anual y el HTML muestra el mensual por defecto (sin JS queda
// el precio mensual, coherente). El anual aplica "2 meses gratis" (mensual × 10)
// y muestra una insignia de ahorro. El plan "A medida" no tiene importes: no cambia.
// Animación: el switch tiene un "pulgar" deslizante (.price-thumb, inyectado por JS,
// desliza con CSS transition) y el importe hace count-up/count-down con Anime.js,
// con red de seguridad setTimeout (el loop de Anime se pausa con la pestaña oculta)
// y respetando prefers-reduced-motion (pinta el valor final directo).
const { esc, txt, txtList } = require('../../src/templates');

// Planes por defecto. El anual se calcula como mensual × 10 (2 meses gratis).
const PLANES = [
  { nombre: 'Inicial', mensual: 9999, nota: 'Para arrancar con lo esencial.', destacado: false },
  { nombre: 'Profesional', mensual: 19999, nota: 'El más elegido por nuestros clientes.', destacado: true },
];
const PLANES_DEFAULT = PLANES.map(p => `${p.nombre} | ${p.mensual} | ${p.nota}${p.destacado ? ' | destacado' : ''}`).join('\n');

/**
 * Planes efectivos según la config del Builder. La usa el HTML y también la SEMILLA del
 * módulo `planes` (backend de precios): con una copia literal allá, activar los dos módulos
 * dejaría el sitio mostrando los planes del Builder y el panel administrando otros.
 * Formato por línea: "nombre | importe mensual | nota | destacado" (las tres últimas
 * columnas son opcionales; la palabra "destacado" marca el plan resaltado).
 */
function planes(cfg) {
  const lineas = txtList(cfg, 'pricing', 'planes', PLANES_DEFAULT);
  if (!lineas.length) return PLANES;
  return lineas.map((linea, i) => {
    const p = Array.isArray(linea) ? linea : [linea];
    const base = PLANES[i % PLANES.length];
    // Un importe que no parsea cae al del plano base en vez de mostrar "$NaN"
    const mensual = p.length > 1 ? Number(String(p[1]).replace(/[^\d.]/g, '')) : base.mensual;
    return {
      nombre: p[0],
      mensual: isFinite(mensual) && mensual > 0 ? Math.round(mensual) : base.mensual,
      nota: p.length > 2 ? p[2] : base.nota,
      destacado: p.length > 3 ? /destacad/i.test(p[3]) : base.destacado,
    };
  });
}

module.exports = {
  id: 'pricing', type: 'ui', name: 'Precios',
  description: 'Tabla de planes y precios con interruptor mensual/anual animado: pulgar deslizante en el switch (CSS transition) y count-up del importe con Anime.js, más pop de la insignia "2 meses gratis". Sin JS se ve el precio mensual.',
  usesAnime: true,
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Planes', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'Elegí el que mejor se adapte a tu etapa.', max: 220 },
    {
      key: 'planes', label: 'Planes con precio', type: 'list', max: 1600, default: PLANES_DEFAULT,
      hint: 'Uno por línea: nombre | importe mensual | nota | destacado. El importe va en números (el anual se calcula como mensual × 10). Escribí "destacado" al final para resaltar un plan.',
    },
    { key: 'cta', label: 'Texto del botón', default: 'Consultar', max: 40 },
    { key: 'planAMedidaNombre', label: 'Plan sin precio: nombre', default: 'Empresa', max: 40 },
    { key: 'planAMedidaPrecio', label: 'Plan sin precio: qué dice en vez del importe', default: 'A medida', max: 40 },
    { key: 'planAMedidaNota', label: 'Plan sin precio: nota', default: 'Soluciones personalizadas para equipos.', max: 220 },
  ],
  html: (cfg) => {
    const fmt = (n) => '$' + Number(n).toLocaleString('es-AR');
    const cta = esc(txt(cfg, 'pricing', 'cta', 'Consultar'));
    const cards = planes(cfg).map(p => {
      const anual = p.mensual * 10; // 12 meses al precio de 10
      return `<div class="card"${p.destacado ? ' style="border-color:var(--accent)"' : ''}>
          <h3>${esc(p.nombre)}</h3>
          <div class="price" data-mensual="${p.mensual}" data-anual="${anual}"><span class="price-num">${fmt(p.mensual)}</span><span class="price-per muted" style="font-size:.9rem">/mes</span></div>
          <p class="muted">${esc(p.nota)}</p>
          <a class="btn${p.destacado ? '' : ' ghost'}" href="/contact.html">${cta}</a>
        </div>`;
    }).join('\n        ');
    return `  <section id="precios">
    <div class="container">
      <h2>${esc(txt(cfg, 'pricing', 'titulo', 'Planes'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'pricing', 'bajada', 'Elegí el que mejor se adapte a tu etapa.'))}</p>
      <div class="price-switch" role="group" aria-label="Periodicidad de los planes">
        <button type="button" class="price-opt active" data-periodo="mensual" aria-pressed="true">Mensual</button>
        <button type="button" class="price-opt" data-periodo="anual" aria-pressed="false">Anual <span class="price-save">2 meses gratis</span></button>
      </div>
      <div class="grid cols-3">
        ${cards}
        <div class="card"><h3>${esc(txt(cfg, 'pricing', 'planAMedidaNombre', 'Empresa'))}</h3><div class="price">${esc(txt(cfg, 'pricing', 'planAMedidaPrecio', 'A medida'))}</div><p class="muted">${esc(txt(cfg, 'pricing', 'planAMedidaNota', 'Soluciones personalizadas para equipos.'))}</p><a class="btn ghost" href="/contact.html">${cta}</a></div>
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    #precios .price-switch{position:relative;display:inline-flex;gap:4px;padding:4px;margin:0 0 24px;background:var(--surface);border:1px solid var(--line);border-radius:999px}
    #precios .price-opt{position:relative;z-index:1;background:none;border:0;padding:8px 16px;border-radius:999px;font:inherit;font-weight:600;color:var(--muted);cursor:pointer;width:auto;display:inline-flex;align-items:center;gap:6px;transition:color .25s ease}
    #precios .price-opt.active{background:var(--accent);color:#fff}
    /* Con JS activo el color lo da el pulgar deslizante: el botón activo queda transparente */
    #precios .price-switch.con-pulgar .price-opt.active{background:transparent}
    #precios .price-thumb{position:absolute;top:4px;bottom:4px;left:4px;width:0;background:var(--accent);border-radius:999px;transition:left .3s cubic-bezier(0.22,1,0.36,1);pointer-events:none}
    #precios .price{font-variant-numeric:tabular-nums}
    #precios .price-save{font-size:.7rem;font-weight:700;padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--accent) 18%,var(--bg));color:var(--accent)}
    #precios .price-opt.active .price-save{background:rgba(255,255,255,.22);color:#fff}
    @media (prefers-reduced-motion:reduce){#precios .price-thumb,#precios .price-opt{transition:none}}
  </style>`,
  // Interruptor mensual/anual: reescribe el importe visible leyendo data-mensual/data-anual,
  // ahora animado: pulgar deslizante (CSS transition medida por JS) y count-up con Anime.js.
  clientJs: () => `// Módulo precios: interruptor mensual/anual sobre los importes con data-mensual/data-anual.
// Animado: pulgar deslizante con CSS transition + count-up del importe con Anime.js
// (red de seguridad setTimeout por si el loop está pausado con la pestaña oculta).
(function () {
  var seccion = document.getElementById('precios');
  if (!seccion) return;
  var botones = seccion.querySelectorAll('.price-opt');
  // Las tarjetas se buscan cada vez y no se cachean: el módulo "planes" (backend de precios)
  // puede reemplazarlas por las del negocio después de que este JS corrió, y el interruptor
  // tiene que seguir funcionando sobre las nuevas. Los botones sí son fijos (los hornea el HTML).
  var listaPrecios = function () { return seccion.querySelectorAll('.price[data-mensual]'); };
  if (!botones.length) return;
  var fmt = function (n) { return '$' + Math.round(Number(n)).toLocaleString('es-AR'); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var anime = window.anime;
  // Sin Anime o con reduced-motion se pinta el valor final directo (comportamiento clásico)
  var puedeAnimar = Boolean(anime && anime.animate) && !reduce;

  // Pulgar deslizante: lo inyecta el JS (sin JS el botón activo conserva su fondo por CSS)
  var interruptor = seccion.querySelector('.price-switch');
  var pulgar = null;
  if (interruptor) {
    pulgar = document.createElement('span');
    pulgar.className = 'price-thumb';
    pulgar.setAttribute('aria-hidden', 'true');
    interruptor.appendChild(pulgar);
    interruptor.classList.add('con-pulgar');
  }
  function moverPulgar() {
    if (!pulgar) return;
    var activo = interruptor.querySelector('.price-opt.active');
    if (!activo) return;
    // Posición y ancho medidos en vivo; la transition de CSS hace el deslizamiento
    // (robusto con pestaña oculta: el valor final queda aplicado aunque no se vea animar)
    pulgar.style.left = activo.offsetLeft + 'px';
    pulgar.style.width = activo.offsetWidth + 'px';
  }
  moverPulgar();
  // Recalcula en resize, directo en el handler (sin rAF, que se pausa en segundo plano)
  window.addEventListener('resize', moverPulgar);

  // Cada precio recuerda su valor visible en data-visible para animar desde ahí.
  // Se marca también a las tarjetas que aparezcan después (las que inyecta "planes").
  function marcarVisibles() {
    listaPrecios().forEach(function (p) {
      if (!p.hasAttribute('data-visible')) p.setAttribute('data-visible', p.getAttribute('data-mensual'));
    });
  }
  marcarVisibles();

  function aplicar(periodo) {
    listaPrecios().forEach(function (p) {
      var destino = Number(periodo === 'anual' ? p.getAttribute('data-anual') : p.getAttribute('data-mensual'));
      var sufijo = periodo === 'anual' ? '/año' : '/mes';
      var numEl = p.querySelector('.price-num');
      var perEl = p.querySelector('.price-per');
      var desde = Number(p.getAttribute('data-visible'));
      if (isNaN(desde)) desde = destino;
      // Se reescribe solo el número y el sufijo; el resto de la tarjeta no se toca
      function fijarFinal() {
        p.setAttribute('data-visible', String(destino));
        if (numEl) numEl.textContent = fmt(destino);
        if (perEl) perEl.textContent = sufijo;
        p.style.transform = '';
      }
      if (!puedeAnimar || desde === destino) { fijarFinal(); return; }
      if (perEl) perEl.textContent = sufijo;
      // Count-up/count-down sobre un objeto de estado + pulso sutil de escala del precio
      var estado = { v: desde };
      anime.animate(estado, { v: destino, duration: 520, ease: 'outCubic', onUpdate: function () {
        p.setAttribute('data-visible', String(Math.round(estado.v)));
        if (numEl) numEl.textContent = fmt(estado.v);
      } });
      anime.animate(p, { scale: [1, 1.03, 1], duration: 520, ease: 'inOutQuad' });
      // Red de seguridad: si el loop de Anime está pausado (pestaña oculta), fija el final
      if (p._wfTimer) clearTimeout(p._wfTimer);
      p._wfTimer = setTimeout(fijarFinal, 680);
    });
    botones.forEach(function (b) {
      var activo = b.getAttribute('data-periodo') === periodo;
      b.classList.toggle('active', activo);
      b.setAttribute('aria-pressed', activo ? 'true' : 'false');
    });
    moverPulgar();
    // Detalle: pop sutil de la insignia "2 meses gratis" al pasar a anual
    if (periodo === 'anual' && puedeAnimar) {
      var insignia = seccion.querySelector('.price-opt[data-periodo="anual"] .price-save');
      if (insignia) {
        anime.animate(insignia, { scale: [1, 1.18, 1], duration: 420, ease: 'inOutQuad' });
        setTimeout(function () { insignia.style.transform = ''; }, 540);
      }
    }
  }
  botones.forEach(function (b) {
    b.addEventListener('click', function () {
      // Si ya es el período activo no hay nada que animar ni aplicar
      if (b.classList.contains('active')) return;
      aplicar(b.getAttribute('data-periodo'));
    });
  });

  // Punto de entrada para quien reemplace las tarjetas en vivo (módulo "planes"): vuelve a
  // marcar los importes visibles y reaplica el período activo sobre las tarjetas nuevas,
  // sin animar (son tarjetas recién pintadas: no hay un valor anterior del que venir).
  window.WFPrecios = {
    refrescar: function () {
      marcarVisibles();
      var activo = seccion.querySelector('.price-opt.active');
      var periodo = activo ? activo.getAttribute('data-periodo') : 'mensual';
      if (periodo !== 'mensual') aplicar(periodo);
      moverPulgar();
    },
  };
})();`,
  readmeNotes: () => [
    '**Precios**: los planes, cifras y textos se cargan en el Builder (bloque *Textos por sección*); si no los editaste, son placeholders. El precio anual se calcula como `mensual × 10` (2 meses gratis) vía el atributo `data-anual` de cada `.price`. El cambio de período anima el importe con Anime.js (con fallback instantáneo si hay `prefers-reduced-motion`). Para que el negocio cambie los importes desde el sitio publicado, activá el módulo **Planes y precios administrables**.',
  ],
};

// Los planes efectivos se exportan para que el backend `planes` siembre su colección con
// EXACTAMENTE los mismos que hornea esta sección.
module.exports.planes = planes;
module.exports.PLANES = PLANES;
