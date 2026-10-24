// Tipo de cambio administrable con backend real: el selector de moneda (módulo UI currency) traía
// las tasas HORNEADAS en una constante del generador, con el comentario "actualizalas cuando cambie
// el mercado" — es decir, regenerar y volver a deployar el sitio cada vez que se mueve el dólar.
// En un país con inflación eso convierte una función linda en una función que MIENTE a los tres
// días. Acá las cotizaciones viven en la colección fxrates, GET /api/cambio es público y el cliente
// se las pasa al selector en vivo (window.WFMoneda.setMonedas), así el visitante ve siempre la
// cotización que cargó el negocio esta mañana.
// Dos decisiones que importan:
//   1. LA TASA SE CARGA COMO LA PIENSA EL NEGOCIO: "1 USD = 1.200 pesos", no "1 peso = 0,00083 USD".
//      El servidor guarda los pesos por unidad y le entrega al front el factor invertido que el
//      selector necesita. Nadie tiene que hacer cuentas para cargar una cotización.
//   2. CADA CAMBIO DEJA HISTORIAL (fecha, valor anterior y quién lo cargó, últimos 20). Sin eso no
//      hay forma de contestar "¿a cuánto estaba el dólar cuando le pasé el presupuesto?", que es
//      justo la discusión que aparece.
// El peso es la moneda base y no se puede borrar ni cotizar contra sí misma (409): es el 1 contra
// el que se mide todo. Se siembran las mismas cuatro monedas del selector horneado para que la
// primera carga no parpadee. Panel solo-admin, animado con Anime.js + red de seguridad.
// Requiere el selector de moneda (currency).
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'cambio', type: 'functional', name: 'Tipo de cambio administrable',
  description: 'Las cotizaciones del selector de moneda se guardan en el backend (colección fxrates) y se le pasan al selector en vivo: el negocio actualiza el dólar desde /cambio-admin.html y el sitio publicado convierte con esa tasa al instante, sin regenerar ni volver a deployar. La tasa se carga como se piensa ("1 USD = X pesos") y el servidor entrega el factor que necesita el front; cada cambio deja historial con fecha, valor anterior y autor (últimos 20). El peso es la moneda base y no se puede borrar. GET /api/cambio es público; el alta, la edición y el borrado son solo-admin. Animado con Anime.js.',
  usesAnime: true,
  requires: ['currency'],
  mounts: [{ route: '/api/cambio', file: 'routes/cambio.js' }],
  collections: ['fxrates'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Cotizaciones', href: '/cambio-admin.html', id: 'nav-cambio-admin' }] : [],
  head: () => `  <style>
    .cb-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .cb-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .cb-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .cb-chip.base{background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}
    .cb-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .cb-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .cb-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .cb-hist{font-size:.78rem;color:var(--muted)}
  </style>`,
  files: (cfg) => ({
    'routes/cambio.js': `const router = require('express').Router();
const db = require('../src/db');
const { str, num } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Se siembran las mismas monedas que hornea el selector, con las tasas expresadas como las piensa
// el negocio (pesos que cuesta una unidad): así la primera carga del sitio no parpadea.
db.seedIfEmpty('fxrates', [
  { code: 'ARS', label: 'ARS $', symbol: '$', arsPerUnit: 1, decimals: 0, base: true, active: true, order: 1, history: [] },
  { code: 'USD', label: 'USD u$s', symbol: 'u$s ', arsPerUnit: 1200, decimals: 2, base: false, active: true, order: 2, history: [] },
  { code: 'EUR', label: 'EUR €', symbol: '€ ', arsPerUnit: 1300, decimals: 2, base: false, active: true, order: 3, history: [] },
  { code: 'BRL', label: 'BRL R$', symbol: 'R$ ', arsPerUnit: 217, decimals: 2, base: false, active: true, order: 4, history: [] },
]);

const CODIGO = /^[A-Z]{3}$/;
const HIST_MAX = 20;

const limpiar = (m) => ({
  id: m.id,
  code: m.code,
  label: m.label || m.code,
  symbol: m.symbol || '',
  arsPerUnit: Number(m.arsPerUnit) || 0,
  decimals: Number(m.decimals) || 0,
  base: !!m.base,
  active: m.active !== false,
  order: Number(m.order) || 0,
  updatedAt: m.updatedAt || m.createdAt || '',
  history: Array.isArray(m.history) ? m.history.slice(-HIST_MAX).reverse() : [],
});

const ordenadas = (rows) => rows.map(limpiar).sort((a, b) => (a.order - b.order) || a.code.localeCompare(b.code));

// GET /api/cambio — público: lo que el selector necesita. La tasa que se publica es el FACTOR
// (cuántas unidades de la moneda vale 1 peso), que es el inverso de lo que carga el negocio.
router.get('/', async (req, res) => {
  const activas = ordenadas(await db.all('fxrates')).filter(m => m.active && m.arsPerUnit > 0);
  const monedas = activas.map(m => ({
    codigo: m.code,
    etiqueta: m.label,
    simbolo: m.symbol,
    tasa: m.base ? 1 : 1 / m.arsPerUnit,
    decimales: m.decimals,
  }));
  // La fecha del último movimiento sirve para mostrar "cotización del …" en el sitio
  const actualizado = activas.map(m => m.updatedAt).filter(Boolean).sort().pop() || '';
  res.json({ base: 'ARS', monedas, actualizado });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/cambio/todas — el panel ve también las apagadas, el historial y la tasa como se carga
router.get('/todas', requireAdmin, async (req, res) => {
  res.json({ rows: ordenadas(await db.all('fxrates')) });
});

// POST /api/cambio — agrega una moneda. El código ISO es único: dos "USD" serían ambiguos
router.post('/', requireAdmin, async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!CODIGO.test(code)) return res.status(422).json({ error: 'Código de moneda inválido (3 letras, por ejemplo USD)' });
  const todas = await db.all('fxrates');
  if (todas.some(m => m.code === code)) return res.status(409).json({ error: 'Ya hay una moneda con el código ' + code });
  const tasa = Number(req.body.arsPerUnit);
  if (!num(tasa, 0.000001, 100000000)) return res.status(422).json({ error: 'Cotización inválida: cuántos pesos cuesta una unidad de esa moneda' });
  const decimals = Number(req.body.decimals);
  const ultimo = todas.reduce((m, x) => Math.max(m, Number(x.order) || 0), 0);
  const row = await db.insert('fxrates', {
    code,
    label: str(req.body.label, 1, 24) ? String(req.body.label).trim() : code,
    symbol: String(req.body.symbol || '').slice(0, 6),
    arsPerUnit: tasa,
    decimals: num(decimals, 0, 4) ? decimals : 2,
    base: false,
    active: !(req.body.active === false || req.body.active === 'false'),
    order: ultimo + 1,
    history: [],
    updatedAt: new Date().toISOString(),
  });
  res.status(201).json(limpiar(row));
});

// PUT /api/cambio/:id — actualiza la cotización o los datos de presentación.
// Cada cambio de tasa deja historial: sin eso no hay forma de contestar a cuánto estaba el dólar
// cuando se pasó un presupuesto, que es exactamente la discusión que aparece después.
router.put('/:id', requireAdmin, async (req, res) => {
  const m = await db.get('fxrates', req.params.id);
  if (!m) return res.status(404).json({ error: 'Esa moneda no existe' });
  const patch = {};
  if (req.body.arsPerUnit !== undefined) {
    const tasa = Number(req.body.arsPerUnit);
    // La base vale 1 contra sí misma por definición: cotizarla sería un sinsentido
    if (m.base && tasa !== 1) return res.status(409).json({ error: 'La moneda base no se cotiza contra sí misma: siempre vale 1' });
    if (!num(tasa, 0.000001, 100000000)) return res.status(422).json({ error: 'Cotización inválida' });
    if (tasa !== Number(m.arsPerUnit)) {
      const hist = Array.isArray(m.history) ? m.history.slice(-(HIST_MAX - 1)) : [];
      hist.push({ at: new Date().toISOString(), from: Number(m.arsPerUnit) || 0, to: tasa, by: req.user.name });
      patch.history = hist;
      patch.updatedAt = new Date().toISOString();
    }
    patch.arsPerUnit = tasa;
  }
  if (req.body.label !== undefined) {
    if (!str(req.body.label, 1, 24)) return res.status(422).json({ error: 'Etiqueta inválida (1 a 24 caracteres)' });
    patch.label = String(req.body.label).trim();
  }
  if (req.body.symbol !== undefined) patch.symbol = String(req.body.symbol).slice(0, 6);
  if (req.body.decimals !== undefined) {
    const d = Number(req.body.decimals);
    if (!num(d, 0, 4)) return res.status(422).json({ error: 'Decimales inválidos (0 a 4)' });
    patch.decimals = d;
  }
  if (req.body.active !== undefined) {
    const activa = !(req.body.active === false || req.body.active === 'false');
    // Apagar la base dejaría al selector sin el precio original: no se permite
    if (m.base && !activa) return res.status(409).json({ error: 'La moneda base no se puede ocultar' });
    patch.active = activa;
  }
  res.json(limpiar(await db.update('fxrates', m.id, patch)));
});

// DELETE /api/cambio/:id — saca una moneda del selector (la base no se toca)
router.delete('/:id', requireAdmin, async (req, res) => {
  const m = await db.get('fxrates', req.params.id);
  if (!m) return res.status(404).json({ error: 'Esa moneda no existe' });
  if (m.base) return res.status(409).json({ error: 'La moneda base no se puede borrar: es el 1 contra el que se mide todo' });
  await db.remove('fxrates', m.id);
  res.json({ ok: true });
});
` : `// La edición de cotizaciones requiere el módulo de autenticación: activalo en el Builder para
// habilitar /cambio-admin.html. Sin él, se editan en data/fxrates.json (el selector las lee igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'cambio-admin': {
      title: 'Cotizaciones',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('chart-line-up', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Cotizaciones</h2>
      <p class="section-sub">Las tasas que usa el selector de moneda del sitio. Se cargan como las pensás: <strong>cuántos pesos cuesta una unidad</strong> de la moneda. El cambio se ve al instante en el sitio publicado, sin regenerar nada. Solo visible para administradores.</p>

      <div class="card" style="margin-bottom:26px">
        <h3>Agregar moneda</h3>
        <form id="cb-form">
          <div class="grid cols-3">
            <div><label>Código ISO</label><input name="code" required maxlength="3" placeholder="USD" style="text-transform:uppercase"></div>
            <div><label>Etiqueta del botón</label><input name="label" maxlength="24" placeholder="USD u$s"></div>
            <div><label>Símbolo</label><input name="symbol" maxlength="6" placeholder="u$s "></div>
          </div>
          <div class="grid cols-2">
            <div><label>1 unidad cuesta (en pesos)</label><input name="arsPerUnit" type="number" min="0.000001" step="any" required placeholder="1200"></div>
            <div><label>Decimales a mostrar</label><input name="decimals" type="number" min="0" max="4" step="1" value="2"></div>
          </div>
          <div style="margin-top:16px"><button class="btn" type="submit">Agregar moneda</button></div>
        </form>
      </div>

      <div id="cb-lista"><p class="muted">Cargando…</p></div>
      <p class="muted" style="font-size:.85rem;margin-top:14px">Cada cambio de cotización queda registrado con fecha, valor anterior y quién lo cargó (últimos 20 por moneda).</p>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo tipo de cambio: trae las cotizaciones de /api/cambio y se las pasa al selector de
   moneda en vivo (window.WFMoneda.setMonedas), que repinta sus botones y reconvierte los precios.
   La tasa que viaja es el factor invertido que el selector espera; el negocio la carga en pesos
   por unidad.${cfg.moduleIds.includes('auth') ? ` Con auth activo, el panel vive en /cambio-admin.html.` : ''} */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fechaHora = function (iso) { try { return new Date(iso).toLocaleString('es-AR'); } catch (e) { return iso; } };

  // ---- Sección pública: el selector adopta las cotizaciones del negocio ----
  function aplicarEnSelector(data) {
    if (!data || !data.monedas || !data.monedas.length) return;
    if (window.WFMoneda && window.WFMoneda.setMonedas) window.WFMoneda.setMonedas(data.monedas);
    // Debajo del selector se aclara de cuándo es la cotización: una tasa sin fecha no dice nada
    var sec = document.getElementById('moneda');
    if (!sec || !data.actualizado) return;
    var pie = document.getElementById('cb-actualizado');
    if (!pie) {
      pie = document.createElement('p');
      pie.id = 'cb-actualizado';
      pie.className = 'muted';
      pie.style.fontSize = '.82rem';
      pie.style.marginTop = '10px';
      var sw = document.getElementById('moneda-switch');
      if (sw && sw.parentNode) sw.parentNode.insertBefore(pie, sw.nextSibling);
      else sec.appendChild(pie);
    }
    pie.textContent = 'Cotización actualizada el ' + fechaHora(data.actualizado) + '.';
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(pie, { opacity: [0, 1], duration: 380, ease: 'outCubic' });
      // Red de seguridad: con la pestaña oculta el loop de Anime no corre
      setTimeout(function () { pie.style.opacity = 1; }, 800);
    }
  }

  var DEMO = {
    base: 'ARS', actualizado: new Date().toISOString(),
    monedas: [
      { codigo: 'ARS', etiqueta: 'ARS $', simbolo: '$', tasa: 1, decimales: 0 },
      { codigo: 'USD', etiqueta: 'USD u$s', simbolo: 'u$s ', tasa: 1 / 1200, decimales: 2 },
      { codigo: 'EUR', etiqueta: 'EUR €', simbolo: '€ ', tasa: 1 / 1300, decimales: 2 },
    ],
  };

  if (document.getElementById('moneda-switch')) {
    if (window.__PREVIEW__) aplicarEnSelector(DEMO);
    else fetch('/api/cambio').then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.monedas) aplicarEnSelector(d); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /cambio-admin.html ----
  var form = document.getElementById('cb-form');
  var box = document.getElementById('cb-lista');
  if (form && box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];

    function pintar() {
      box.innerHTML = App.table(lista, [
        { label: 'Moneda', render: function (m) {
          return '<strong>' + App.esc(m.code) + '</strong> ' + (m.base ? '<span class="cb-chip base">base</span>' : '') +
            '<br><span class="muted" style="font-size:.8rem">' + App.esc(m.label) + '</span>';
        } },
        { label: '1 unidad en pesos', render: function (m) {
          if (m.base) return '<span class="cb-num muted">—</span>';
          return '<span class="cb-num">' + App.money(m.arsPerUnit) + '</span>' +
            (m.updatedAt ? '<br><span class="cb-hist">desde ' + App.esc(fechaHora(m.updatedAt)) + '</span>' : '');
        } },
        { label: 'Historial', render: function (m) {
          if (!m.history || !m.history.length) return '<span class="muted">—</span>';
          return m.history.slice(0, 3).map(function (h) {
            return '<span class="cb-hist">' + App.esc(fechaHora(h.at)) + ': ' + App.money(h.from) + ' → ' + App.money(h.to) + (h.by ? ' (' + App.esc(h.by) + ')' : '') + '</span>';
          }).join('<br>');
        } },
        { label: 'Estado', render: function (m) { return m.active ? '<span class="cb-chip on">En el selector</span>' : '<span class="cb-chip off">Oculta</span>'; } },
        { label: '', render: function (m) {
          return '<span class="cb-acciones">' +
            (m.base ? '' : '<button class="btn ghost" type="button" data-cb-tasa="' + m.id + '">Cotizar</button>') +
            (m.base ? '' : '<button class="btn ghost" type="button" data-cb-ver="' + m.id + '">' + (m.active ? 'Ocultar' : 'Mostrar') + '</button>') +
            (m.base ? '' : '<button class="btn ghost" type="button" data-cb-del="' + m.id + '">Borrar</button>') +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-cb-tasa]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var m = buscar(b.getAttribute('data-cb-tasa'));
          if (!m) return;
          var valor = prompt('¿Cuántos pesos cuesta 1 ' + m.code + '?', String(m.arsPerUnit));
          if (valor === null) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la cotización'); return; }
          try {
            await App.api('/api/cambio/' + m.id, { method: 'PUT', body: { arsPerUnit: Number(valor) } });
            App.toast('Cotización de ' + m.code + ' actualizada');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-cb-ver]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var m = buscar(b.getAttribute('data-cb-ver'));
          if (!m) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
          try {
            await App.api('/api/cambio/' + m.id, { method: 'PUT', body: { active: !m.active } });
            App.toast(m.active ? 'Moneda oculta' : 'Moneda visible');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-cb-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar esta moneda del selector? Se pierde su historial de cotizaciones.')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/cambio/' + b.getAttribute('data-cb-del'), { method: 'DELETE' });
            App.toast('Moneda borrada');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function cargar() {
      if (window.__PREVIEW__) {
        lista = [
          { id: '1', code: 'ARS', label: 'ARS $', symbol: '$', arsPerUnit: 1, decimals: 0, base: true, active: true, history: [], updatedAt: '' },
          { id: '2', code: 'USD', label: 'USD u$s', symbol: 'u$s ', arsPerUnit: 1200, decimals: 2, base: false, active: true, updatedAt: new Date().toISOString(), history: [{ at: new Date().toISOString(), from: 1150, to: 1200, by: 'Admin' }] },
        ];
        pintar();
        return;
      }
      try {
        var out = await App.api('/api/cambio/todas');
        lista = out.rows;
        pintar();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {};
      ['code', 'label', 'symbol', 'arsPerUnit', 'decimals'].forEach(function (k) { datos[k] = form.querySelector('[name="' + k + '"]').value; });
      datos.arsPerUnit = Number(datos.arsPerUnit);
      datos.decimals = Number(datos.decimals);
      if (window.__PREVIEW__) { App.toast('Vista previa: se agregaría la moneda'); return; }
      try {
        await App.api('/api/cambio', { method: 'POST', body: datos });
        form.reset();
        App.toast('Moneda agregada');
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      form.style.display = 'none';
    } else {
      cargar();
      var animeP = window.anime;
      if (animeP && animeP.animate && !reduce) {
        animeP.animate(form, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: 'outCubic' });
        setTimeout(function () { form.style.opacity = 1; form.style.transform = 'none'; }, 800);
      }
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navC = document.getElementById('nav-cambio-admin');
    if (navC && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navC.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Tipo de cambio administrable**: las cotizaciones viven en la colección \`fxrates\` y se le pasan al selector de moneda en vivo, así que **actualizar el dólar no requiere regenerar ni volver a deployar**. Se cargan como se piensan: *cuántos pesos cuesta una unidad* (1 USD = 1.200), y el servidor entrega el factor invertido que necesita el front. Las tasas sembradas son de EJEMPLO: cargá las reales ${cfg.moduleIds.includes('auth') ? 'desde `/cambio-admin.html`' : 'editando `data/fxrates.json` (o activá el módulo **Autenticación** para editarlas desde la web en `/cambio-admin.html`)'} antes de publicar. Cada cambio deja **historial** (fecha, valor anterior y autor, últimos 20 por moneda). El **peso es la moneda base**: no se puede borrar, ocultar ni cotizar contra sí misma. No hay ninguna API externa de por medio (nada que pagar ni que se caiga): la cotización la pone el negocio.`,
  ],
};
