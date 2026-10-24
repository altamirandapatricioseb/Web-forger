// Envío gratis por umbral de compra, con el cálculo del lado del SERVIDOR: el visitante ve una
// barra de progreso ("te faltan $X para el envío gratis") que se actualiza sola con cada cambio
// del carrito, pero el subtotal NO se cree lo que dice el navegador — se recalcula contra el
// catálogo real (colección products) en cada consulta, igual que hace el checkout. Así el mensaje
// que promete envío gratis nunca se puede falsear desde el frontend.
//
// El umbral, los textos y el encendido son administrables desde /envio-gratis.html (solo admin) y
// se aplican sin regenerar ni volver a deployar. El módulo además cuenta cuántos carritos llegaron
// al umbral, que es el número que le interesa al negocio para decidir dónde ponerlo.
//
// Se engancha al evento `wf:cart` que emite el módulo Carrito en cada cambio (punto de entrada,
// no espía el localStorage). Barra animada con Anime.js + red de seguridad por si la pestaña
// está oculta, y respeta "prefers-reduced-motion".
const { phIcon } = require('../../src/icons');

// Valores con los que arranca la ficha (editables desde el panel, sin regenerar)
const DEFAULTS = {
  active: true,
  umbral: 25000,
  mensaje: 'Te faltan {falta} para el envío gratis',
  mensajeLogrado: '¡Tenés envío gratis en este pedido!',
  alcanzados: 0,
};

module.exports = {
  id: 'enviogratis', type: 'functional', name: 'Envío gratis por umbral',
  description: 'Barra de progreso "te faltan $X para el envío gratis" sobre el carrito, con el subtotal calculado en el servidor contra el catálogo real (el frontend no puede falsearlo). Umbral y textos administrables en /envio-gratis.html sin regenerar, y contador de carritos que alcanzaron el umbral. Animada con Anime.js.',
  usesAnime: true,
  requires: ['cart'],
  mounts: [{ route: '/api/envio-gratis', file: 'routes/enviogratis.js' }],
  collections: ['freeshipping'],
  nav: () => [{ label: 'Envío gratis', href: '/envio-gratis.html', id: 'nav-enviogratis' }],
  head: () => `  <style>
    .eg-bar{display:flex;flex-direction:column;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;margin-bottom:20px}
    .eg-top{display:flex;align-items:center;gap:10px;font-size:.95rem}
    .eg-top strong{font-variant-numeric:tabular-nums}
    .eg-riel{position:relative;height:10px;border-radius:999px;background:color-mix(in srgb,var(--text) 10%,var(--bg));overflow:hidden}
    .eg-fill{position:absolute;inset:0 auto 0 0;width:0;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 70%,var(--primary)),var(--accent))}
    .eg-bar.eg-ok .eg-fill{background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 60%,#2e9e5b))}
    .eg-pie{font-size:.82rem;color:var(--muted)}
    .eg-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin:22px 0}
    .eg-kpis .card{text-align:center}
    .eg-kpis strong{display:block;font-size:1.7rem;font-variant-numeric:tabular-nums}
  </style>`,
  files: (cfg) => ({
    'routes/enviogratis.js': `const router = require('express').Router();
const db = require('../src/db');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
const DEFAULTS = ${JSON.stringify(DEFAULTS, null, 2)};

// Ficha única de configuración: se crea sola la primera vez con los valores por default
async function ficha() {
  const rows = await db.all('freeshipping');
  if (rows.length) return { ...DEFAULTS, ...rows[0] };
  return { ...DEFAULTS, ...(await db.insert('freeshipping', { ...DEFAULTS })) };
}

// Subtotal REAL de un carrito: los precios salen del catálogo, nunca del cuerpo del pedido.
// Es la misma regla que aplica el checkout (routes/orders.js): el navegador dice QUÉ productos
// y CUÁNTOS, el servidor dice CUÁNTO valen.
async function subtotalDe(items) {
  if (!Array.isArray(items) || !items.length) return 0;
  const porId = new Map((await db.all('products')).map(p => [p.id, p]));
  let total = 0;
  for (const i of items.slice(0, 200)) {
    const p = i && porId.get(i.productId);
    const qty = Number(i && i.qty);
    if (!p || !isFinite(qty) || qty < 1 || qty > 99) continue;
${cfg.moduleIds.includes('variantes') ? `    // El sobreprecio de la variante cuenta para el umbral: si no contara, la barra diría "te
    // faltan $300" mientras el checkout ya cobra el envío gratis (o al revés). Es el mismo error
    // que el guard que descartaba eventos — un número que no coincide con lo que se cobra.
    let precio = Number(p.price || 0);
    if (i.variantId) {
      const set = await require('../src/variantes').cargar(p.id);
      const v = set && set.variantes.find(x => x.id === i.variantId && x.active);
      if (v) precio += v.priceDelta;
    }
    total += precio * Math.round(qty);
` : `    total += Number(p.price || 0) * Math.round(qty);
`}  }
  return Math.round(total);
}

// GET /api/envio-gratis — configuración pública (sin contadores internos)
router.get('/', async (req, res) => {
  const f = await ficha();
  res.json({ active: !!f.active, umbral: f.umbral, mensaje: f.mensaje, mensajeLogrado: f.mensajeLogrado });
});

// POST /api/envio-gratis/progreso — { items: [{productId, qty}], avisar? } → progreso calculado acá.
// \`avisar: true\` lo manda el frontend UNA sola vez, en el momento en que el carrito cruza el
// umbral, para que el contador del panel mida carritos que llegaron y no consultas repetidas.
router.post('/progreso', async (req, res) => {
  const f = await ficha();
  const subtotal = await subtotalDe(req.body && req.body.items);
  const umbral = Number(f.umbral) || 0;
  const alcanzado = f.active && umbral > 0 && subtotal >= umbral;
  if (alcanzado && req.body && req.body.avisar === true) {
    await db.update('freeshipping', f.id, { alcanzados: (Number(f.alcanzados) || 0) + 1 });
  }
  res.json({
    active: !!f.active,
    umbral,
    subtotal,
    falta: Math.max(0, umbral - subtotal),
    alcanzado,
    porcentaje: umbral > 0 ? Math.min(100, Math.round((subtotal / umbral) * 100)) : 0,
    mensaje: f.mensaje,
    mensajeLogrado: f.mensajeLogrado,
  });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/envio-gratis/admin — configuración completa con contadores (solo admin)
router.get('/admin', requireAdmin, async (req, res) => res.json(await ficha()));

// PUT /api/envio-gratis — cambia umbral, textos y encendido (solo admin)
router.put('/', requireAdmin, async (req, res) => {
  const f = await ficha();
  const patch = {};
  if (req.body.active !== undefined) patch.active = !!req.body.active;
  if (req.body.umbral !== undefined) {
    const n = Number(req.body.umbral);
    if (!isFinite(n) || n < 1 || n > 100000000) return res.status(422).json({ error: 'El umbral va entre 1 y 100.000.000' });
    patch.umbral = Math.round(n);
  }
  for (const campo of ['mensaje', 'mensajeLogrado']) {
    if (req.body[campo] === undefined) continue;
    const t = String(req.body[campo]).trim();
    if (t.length < 3 || t.length > 160) return res.status(422).json({ error: 'Los textos van entre 3 y 160 caracteres' });
    patch[campo] = t;
  }
  res.json({ ...DEFAULTS, ...(await db.update('freeshipping', f.id, patch)) });
});

// DELETE /api/envio-gratis/contador — pone en cero el contador de carritos alcanzados (solo admin)
router.delete('/contador', requireAdmin, async (req, res) => {
  const f = await ficha();
  await db.update('freeshipping', f.id, { alcanzados: 0 });
  res.json({ ok: true });
});
` : `// El panel de envío gratis requiere el módulo de autenticación. Sin él la barra funciona igual
// con los valores por default, editables a mano en data/freeshipping.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'envio-gratis': {
      title: 'Envío gratis',
      html: `  <section>
    <div class="container" style="max-width:760px">
      <h2>Envío gratis por umbral</h2>
      <p class="section-sub">Definí desde qué monto el envío es gratis. La barra aparece sobre el carrito del catálogo y se actualiza sola: el subtotal lo calcula el servidor contra tu catálogo, así nadie puede falsearlo desde el navegador. Solo visible para administradores.</p>
      <div class="eg-kpis" id="eg-kpis"></div>
      <form class="card" id="eg-form">
        <h3 style="margin-top:0">Configuración</h3>
        <label for="eg-umbral">Monto mínimo para envío gratis</label>
        <input id="eg-umbral" name="umbral" type="number" min="1" step="1" required>
        <label for="eg-msg">Mensaje mientras falta (usá <code>{falta}</code> donde va el monto)</label>
        <input id="eg-msg" name="mensaje" maxlength="160" required>
        <label for="eg-msg-ok">Mensaje al alcanzarlo</label>
        <input id="eg-msg-ok" name="mensajeLogrado" maxlength="160" required>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
          <button class="btn" type="submit">Guardar</button>
          <button class="btn ghost" type="button" id="eg-toggle">—</button>
          <button class="btn ghost" type="button" id="eg-reset">Reiniciar contador</button>
        </div>
      </form>
      <h3 style="margin-top:32px">Vista previa</h3>
      <p class="muted" style="margin-top:0">Así se ve la barra con un carrito a mitad de camino.</p>
      <div class="eg-bar" id="eg-demo">
        <div class="eg-top">${phIcon('truck', { size: 20, color: 'var(--accent)' })}<span id="eg-demo-msg">—</span></div>
        <div class="eg-riel"><div class="eg-fill" id="eg-demo-fill"></div></div>
        <div class="eg-pie" id="eg-demo-pie">—</div>
      </div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo envío gratis: barra de progreso sobre el carrito del catálogo. Escucha el evento
   'wf:cart' del módulo Carrito y le pide al servidor el progreso real (el subtotal se calcula
   allá contra el catálogo). Animada con Anime.js + red de seguridad; con "menos movimiento"
   la barra salta directo al valor final. ${cfg.moduleIds.includes('auth') ? 'Con auth, panel en /envio-gratis.html.' : ''} */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ICONO = '${phIcon('truck', { size: 20, color: 'var(--accent)' }).replace(/'/g, "\\'")}';

  // Pinta el ancho de la barra con Anime.js (y deja el valor final fijo pase lo que pase)
  function llenar(fill, pct) {
    var destino = Math.max(0, Math.min(100, pct)) + '%';
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { fill.style.width = destino; return; }
    anime.animate(fill, { width: destino, duration: 620, ease: 'outCubic' });
    // Red de seguridad: Anime.js pausa su loop con la pestaña oculta
    setTimeout(function () { fill.style.width = destino; }, 800);
  }

  function texto(estado) {
    if (estado.alcanzado) return estado.mensajeLogrado || '¡Tenés envío gratis!';
    return String(estado.mensaje || 'Te faltan {falta} para el envío gratis')
      .replace('{falta}', App.money(estado.falta));
  }

  // ---- Barra pública (página del catálogo) ----
  var panel = document.getElementById('cart-panel');
  if (panel) {
    var barra = document.createElement('div');
    barra.className = 'eg-bar';
    barra.style.display = 'none';
    barra.innerHTML = '<div class="eg-top">' + ICONO + '<span class="eg-msg">—</span></div>' +
      '<div class="eg-riel"><div class="eg-fill"></div></div>' +
      '<div class="eg-pie"></div>';
    // Se inserta ANTES del panel del carrito, dentro de su mismo contenedor: no depende de
    // ningún :nth-child del módulo Carrito, sólo de que el panel exista.
    panel.parentNode.insertBefore(barra, panel);
    var msg = barra.querySelector('.eg-msg');
    var fill = barra.querySelector('.eg-fill');
    var pie = barra.querySelector('.eg-pie');
    var yaAlcanzado = false;
    var pidiendo = false;
    var pendiente = null;

    function pintar(estado) {
      if (!estado.active || !estado.umbral) { barra.style.display = 'none'; return; }
      barra.style.display = '';
      barra.classList.toggle('eg-ok', !!estado.alcanzado);
      msg.textContent = texto(estado);
      pie.textContent = 'Subtotal ' + App.money(estado.subtotal) + ' de ' + App.money(estado.umbral);
      llenar(fill, estado.porcentaje);
      yaAlcanzado = !!estado.alcanzado;
    }

    // Se guarda SIEMPRE el último estado del carrito y, si ya hay una consulta en curso, se
    // atiende al terminar. Descartar los eventos que llegan mientras se consulta parece una
    // optimización y es un error: agregar seis unidades seguidas dispara seis eventos, y la barra
    // se quedaría anunciando lo que falta para la primera. Un cartel que promete envío gratis
    // tiene que estar mirando el carrito de ahora, no el de hace tres clics.
    function actualizar(items) {
      pendiente = items || [];
      if (!pidiendo) correr();
    }

    async function correr() {
      pidiendo = true;
      try {
        while (pendiente) {
          var items = pendiente;
          pendiente = null;
          if (!items.length) { barra.style.display = 'none'; yaAlcanzado = false; continue; }
          if (window.__PREVIEW__) {
            var demo = items.reduce(function (s, i) { return s + i.qty * 4999; }, 0);
            pintar({ active: true, umbral: ${DEFAULTS.umbral}, subtotal: demo, falta: Math.max(0, ${DEFAULTS.umbral} - demo), alcanzado: demo >= ${DEFAULTS.umbral}, porcentaje: Math.min(100, Math.round(demo / ${DEFAULTS.umbral} * 100)), mensaje: ${JSON.stringify(DEFAULTS.mensaje)}, mensajeLogrado: ${JSON.stringify(DEFAULTS.mensajeLogrado)} });
            continue;
          }
          try {
            // avisar: sólo en la transición "todavía no" → "ya sí", para que el contador del panel
            // mida carritos que llegaron al umbral y no cada recálculo de la barra.
            var estado = await App.api('/api/envio-gratis/progreso', { method: 'POST', body: { items: items, avisar: !yaAlcanzado } });
            pintar(estado);
          } catch (err) { barra.style.display = 'none'; }
        }
      } finally { pidiendo = false; }
    }

    document.addEventListener('wf:cart', function (e) { actualizar(e.detail); });
    // Si el carrito ya tenía cosas antes de que enganchemos el listener, arrancamos con eso
    try { actualizar(JSON.parse(localStorage.getItem('cart') || '[]')); } catch (e) {}
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel admin (/envio-gratis.html) ----
  var form = document.getElementById('eg-form');
  if (form) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var kpis = document.getElementById('eg-kpis');
    var toggle = document.getElementById('eg-toggle');
    var actual = null;

    function contar(el, hasta) {
      if (!el) return;
      var anime = window.anime;
      if (!anime || !anime.animate || reduce) { el.textContent = Number(hasta).toLocaleString('es-AR'); return; }
      var st = { v: 0 };
      anime.animate(st, { v: hasta, duration: 620, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR'); } });
      setTimeout(function () { el.textContent = Number(hasta).toLocaleString('es-AR'); }, 820);
    }

    function demoPreview(f) {
      var mitad = Math.round((Number(f.umbral) || 1) * 0.55);
      document.getElementById('eg-demo-msg').textContent = texto({ alcanzado: false, falta: (Number(f.umbral) || 0) - mitad, mensaje: f.mensaje });
      document.getElementById('eg-demo-pie').textContent = 'Subtotal ' + App.money(mitad) + ' de ' + App.money(f.umbral);
      llenar(document.getElementById('eg-demo-fill'), 55);
    }

    function pintarAdmin(f) {
      actual = f;
      kpis.innerHTML = '<div class="card"><strong id="eg-k-umbral">0</strong><span class="muted">umbral actual ($)</span></div>' +
        '<div class="card"><strong id="eg-k-alc">0</strong><span class="muted">carritos que lo alcanzaron</span></div>' +
        '<div class="card"><strong id="eg-k-estado">—</strong><span class="muted">estado</span></div>';
      contar(document.getElementById('eg-k-umbral'), Number(f.umbral) || 0);
      contar(document.getElementById('eg-k-alc'), Number(f.alcanzados) || 0);
      document.getElementById('eg-k-estado').textContent = f.active ? 'Activo' : 'Apagado';
      toggle.textContent = f.active ? 'Apagar la barra' : 'Encender la barra';
      form.querySelector('[name="umbral"]').value = f.umbral;
      form.querySelector('[name="mensaje"]').value = f.mensaje;
      form.querySelector('[name="mensajeLogrado"]').value = f.mensajeLogrado;
      demoPreview(f);
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la configuración'); return; }
      try {
        pintarAdmin(await App.api('/api/envio-gratis', { method: 'PUT', body: {
          umbral: Number(form.querySelector('[name="umbral"]').value),
          mensaje: form.querySelector('[name="mensaje"]').value,
          mensajeLogrado: form.querySelector('[name="mensajeLogrado"]').value,
        } }));
        App.toast('Configuración guardada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    toggle.addEventListener('click', async function () {
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se enciende o apaga la barra'); return; }
      if (!actual) return;
      try {
        pintarAdmin(await App.api('/api/envio-gratis', { method: 'PUT', body: { active: !actual.active } }));
        App.toast(actual.active ? 'Barra activa' : 'Barra apagada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    document.getElementById('eg-reset').addEventListener('click', async function () {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reiniciaría el contador'); return; }
      if (!confirm('¿Poner en cero el contador de carritos que alcanzaron el umbral?')) return;
      try {
        await App.api('/api/envio-gratis/contador', { method: 'DELETE' });
        pintarAdmin(await App.api('/api/envio-gratis/admin'));
        App.toast('Contador reiniciado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (window.__PREVIEW__) {
      pintarAdmin({ ...${JSON.stringify(DEFAULTS)}, alcanzados: 38 });
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/envio-gratis/admin').then(pintarAdmin)
        .catch(function (err) { kpis.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navEg = document.getElementById('nav-enviogratis');
    if (navEg && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navEg.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Envío gratis por umbral**: la barra aparece sobre el carrito en \`/catalog.html\` y se actualiza con cada cambio (escucha el evento \`wf:cart\` del módulo Carrito). El **subtotal lo calcula el servidor** (\`POST /api/envio-gratis/progreso\`) contra la colección \`products\`: el navegador manda qué productos y cuántos, nunca los precios, así el cartel de envío gratis no se puede falsear desde el frontend. ${cfg.moduleIds.includes('auth') ? 'El umbral y los textos se editan en `/envio-gratis.html` y se aplican en el acto, sin regenerar. Ahí también ves cuántos carritos alcanzaron el umbral (se suma una sola vez por carrito, en el momento en que lo cruza).' : 'Sin el módulo **Autenticación** no hay panel: el umbral y los textos viven en `data/freeshipping.json` y se editan a mano.'} Ojo: el módulo **no** cobra ni descuenta el envío en el checkout — es el cartel de conversión; si vendés con envío calculado, atá el umbral a tu lógica de costos en \`routes/orders.js\`.`,
  ],
};
