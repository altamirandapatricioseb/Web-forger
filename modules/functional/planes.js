// Planes y precios administrables con backend real: la sección "Planes" (módulo UI pricing) traía
// los importes HORNEADOS en el HTML, así que cambiar un precio obligaba a regenerar y volver a
// deployar el sitio. Es el pedido más frecuente y más urgente de cualquier cliente real ("subí el
// plan profesional a X desde mañana"), y hasta ahora era el único cambio que NO podía hacer solo.
// Acá los planes viven en la colección plans, GET /api/planes es público y el cliente los INYECTA
// EN VIVO sobre las tarjetas ya renderizadas: el negocio edita el precio en /planes-admin.html y el
// visitante lo ve al instante. Las tarjetas se reconstruyen con el MISMO marcado que hornea pricing
// (data-mensual / data-anual / .price-num / .price-per), así el interruptor mensual/anual animado
// sigue funcionando sobre los planes nuevos: por eso pricing expone window.WFPrecios.refrescar().
// El precio anual no se guarda dos veces salvo que el negocio lo pise: por default lo calcula el
// servidor como mensual × 10 (2 meses gratis), que es la regla que ya usaba el HTML horneado.
// Un plan con importe 0 es "a medida" (muestra un texto en vez de una cifra y no entra al
// interruptor), igual que la tarjeta Empresa del HTML original. El orden lo decide el servidor
// (botones subir/bajar que intercambian posiciones), no el navegador. Se siembran los tres planes
// del HTML horneado para que la primera carga no parpadee con datos distintos. Panel solo-admin,
// animado con Anime.js + red de seguridad. Requiere la sección de precios (pricing).
const { phIcon } = require('../../src/icons');
// Los planes salen del propio módulo UI, que los resuelve contra la config del Builder: una
// copia literal acá dejaría el sitio mostrando unos planes y el panel administrando otros.
const { planes } = require('../ui/pricing');
const { txt } = require('../../src/templates');

/**
 * Semilla de la colección `plans`: EXACTAMENTE los planes que hornea la sección de precios,
 * más el plan sin importe ("A medida"), que en el HTML es una tarjeta aparte y acá es una
 * fila más con priceMonthly 0 y priceText cargado.
 */
const semilla = (cfg) => {
  const cta = txt(cfg, 'pricing', 'cta', 'Consultar');
  const conPrecio = planes(cfg).map((p, i) => ({
    name: p.nombre, priceMonthly: p.mensual, priceAnnual: 0, priceText: '',
    note: p.nota, featured: p.destacado, ctaLabel: cta, ctaHref: '/contact.html',
    active: true, order: i + 1,
  }));
  return [...conPrecio, {
    name: txt(cfg, 'pricing', 'planAMedidaNombre', 'Empresa'),
    priceMonthly: 0, priceAnnual: 0,
    priceText: txt(cfg, 'pricing', 'planAMedidaPrecio', 'A medida'),
    note: txt(cfg, 'pricing', 'planAMedidaNota', 'Soluciones personalizadas para equipos.'),
    featured: false, ctaLabel: cta, ctaHref: '/contact.html',
    active: true, order: conPrecio.length + 1,
  }];
};

module.exports = {
  id: 'planes', type: 'functional', name: 'Planes y precios administrables',
  description: 'Los planes de la sección de precios se guardan en el backend (colección plans) y se inyectan en vivo sobre las tarjetas: el negocio cambia importes, textos y el plan destacado desde /planes-admin.html y el sitio publicado lo refleja al instante, sin regenerar ni volver a deployar. Las tarjetas se reconstruyen con el mismo marcado que hornea el módulo Precios, así el interruptor mensual/anual animado sigue funcionando; el importe anual lo calcula el servidor (mensual × 10 = 2 meses gratis) salvo que se cargue a mano, y un importe 0 significa "a medida". El orden lo decide el servidor. GET /api/planes es público; el alta, la edición y el borrado son solo-admin. Animado con Anime.js.',
  usesAnime: true,
  requires: ['pricing'],
  mounts: [{ route: '/api/planes', file: 'routes/planes.js' }],
  collections: ['plans'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Precios', href: '/planes-admin.html', id: 'nav-planes-admin' }] : [],
  head: () => `  <style>
    .pl-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .pl-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .pl-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .pl-chip.destacado{background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}
    .pl-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .pl-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .pl-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
  </style>`,
  files: (cfg) => ({
    'routes/planes.js': `const router = require('express').Router();
const db = require('../src/db');
const { check, str, num } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Se siembran los mismos planes que hornea la sección de precios: así la primera carga del sitio
// no parpadea mostrando primero el HTML y después datos distintos.
db.seedIfEmpty('plans', ${JSON.stringify(semilla(cfg), null, 2)});

// Un destino de botón válido es una ruta del propio sitio o una URL http(s): nunca javascript:
const DESTINO = /^(\\/[\\w\\-./#?=&%]*|https?:\\/\\/[^\\s"']+)$/;

// El importe anual no se guarda por duplicado: si el negocio no lo pisa, lo calcula el servidor
// como 12 meses al precio de 10 (la misma regla "2 meses gratis" del HTML horneado).
function resolver(p) {
  const mensual = Number(p.priceMonthly) || 0;
  const anual = Number(p.priceAnnual) > 0 ? Number(p.priceAnnual) : Math.round(mensual * 10);
  return {
    id: p.id,
    name: p.name || '',
    priceMonthly: mensual,
    priceAnnual: anual,
    // Con importe 0 la tarjeta no muestra cifra sino un texto ("A medida"): no entra al interruptor
    priceText: mensual > 0 ? '' : (p.priceText || 'A medida'),
    note: p.note || '',
    featured: !!p.featured,
    ctaLabel: p.ctaLabel || 'Consultar',
    ctaHref: p.ctaHref || '/contact.html',
    active: p.active !== false,
    order: Number(p.order) || 0,
    // El anual explícito se informa aparte para que el panel sepa si está pisado o calculado
    annualManual: Number(p.priceAnnual) > 0,
  };
}

const ordenados = (rows) => rows.map(resolver)
  .sort((a, b) => (a.order - b.order) || String(a.name).localeCompare(String(b.name)));

// Valida el cuerpo de un alta o una edición. Devuelve {ok, error, patch}
function leer(body, parcial) {
  const patch = {};
  if (body.name !== undefined || !parcial) {
    if (!str(body.name, 2, 60)) return { ok: false, error: 'El nombre del plan tiene que tener entre 2 y 60 caracteres' };
    patch.name = String(body.name).trim();
  }
  if (body.priceMonthly !== undefined || !parcial) {
    const v = Number(body.priceMonthly);
    if (!num(v, 0, 1000000000)) return { ok: false, error: 'Importe mensual inválido (0 significa "a medida")' };
    patch.priceMonthly = Math.round(v * 100) / 100;
  }
  if (body.priceAnnual !== undefined) {
    const v = Number(body.priceAnnual || 0);
    if (!num(v, 0, 1000000000)) return { ok: false, error: 'Importe anual inválido (0 lo calcula el sistema)' };
    patch.priceAnnual = Math.round(v * 100) / 100;
  }
  if (body.priceText !== undefined) patch.priceText = String(body.priceText).trim().slice(0, 40);
  if (body.note !== undefined) patch.note = String(body.note).trim().slice(0, 160);
  if (body.featured !== undefined) patch.featured = body.featured === true || body.featured === 'true' || body.featured === 'on';
  if (body.active !== undefined) patch.active = !(body.active === false || body.active === 'false');
  if (body.ctaLabel !== undefined) patch.ctaLabel = String(body.ctaLabel).trim().slice(0, 40) || 'Consultar';
  if (body.ctaHref !== undefined) {
    const v = String(body.ctaHref).trim() || '/contact.html';
    if (!DESTINO.test(v)) return { ok: false, error: 'El destino del botón tiene que ser una ruta del sitio (/contact.html) o una URL http(s)' };
    patch.ctaHref = v;
  }
  return { ok: true, patch };
}

// GET /api/planes — público: sólo los planes visibles, en el orden que fijó el negocio
router.get('/', async (req, res) => {
  const rows = ordenados(await db.all('plans')).filter(p => p.active).map(p => {
    const { annualManual, active, ...publico } = p;
    return publico;
  });
  res.json({ rows });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/planes/todos — el panel ve también los planes apagados
router.get('/todos', requireAdmin, async (req, res) => {
  res.json({ rows: ordenados(await db.all('plans')) });
});

// POST /api/planes — alta. El orden lo decide el servidor: al final de la lista
router.post('/', requireAdmin, async (req, res) => {
  const { ok, error, patch } = leer(req.body, false);
  if (!ok) return res.status(422).json({ error });
  const todos = await db.all('plans');
  const ultimo = todos.reduce((m, p) => Math.max(m, Number(p.order) || 0), 0);
  const row = await db.insert('plans', {
    name: patch.name, priceMonthly: patch.priceMonthly,
    priceAnnual: patch.priceAnnual || 0,
    priceText: patch.priceText || '', note: patch.note || '',
    featured: !!patch.featured, active: patch.active !== false,
    ctaLabel: patch.ctaLabel || 'Consultar', ctaHref: patch.ctaHref || '/contact.html',
    order: ultimo + 1,
  });
  res.status(201).json(resolver(row));
});

// PUT /api/planes/:id — edición parcial (el orden se cambia con /mover, no a mano)
router.put('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('plans', req.params.id);
  if (!p) return res.status(404).json({ error: 'Ese plan no existe' });
  const { ok, error, patch } = leer(req.body, true);
  if (!ok) return res.status(422).json({ error });
  res.json(resolver(await db.update('plans', p.id, patch)));
});

// POST /api/planes/:id/mover — sube o baja el plan intercambiando su posición con la vecina.
// El orden es del servidor: dos administradores no pueden dejarlo en estados distintos.
router.post('/:id/mover', requireAdmin, async (req, res) => {
  const dir = req.body.dir === 'sube' ? -1 : 1;
  const lista = ordenados(await db.all('plans'));
  const i = lista.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Ese plan no existe' });
  const j = i + dir;
  if (j < 0 || j >= lista.length) return res.status(409).json({ error: dir < 0 ? 'Ese plan ya es el primero' : 'Ese plan ya es el último' });
  // Se reescriben las posiciones de toda la lista: así queda 1..N sin huecos ni empates
  const nueva = lista.slice();
  nueva[i] = lista[j];
  nueva[j] = lista[i];
  for (let k = 0; k < nueva.length; k++) await db.update('plans', nueva[k].id, { order: k + 1 });
  res.json({ rows: ordenados(await db.all('plans')) });
});

// DELETE /api/planes/:id — baja definitiva (para esconderlo sin perderlo está el interruptor)
router.delete('/:id', requireAdmin, async (req, res) => {
  const p = await db.get('plans', req.params.id);
  if (!p) return res.status(404).json({ error: 'Ese plan no existe' });
  await db.remove('plans', p.id);
  res.json({ ok: true });
});
` : `// La edición de planes requiere el módulo de autenticación: activalo en el Builder para habilitar
// /planes-admin.html. Sin él, los planes se editan en data/plans.json (la sección los lee igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'planes-admin': {
      title: 'Planes y precios',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('tag', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Planes y precios</h2>
      <p class="section-sub">Lo que cargues acá es lo que ve el visitante en la sección de precios del sitio, al instante y sin regenerar nada. Solo visible para administradores.</p>

      <div class="card" style="margin-bottom:26px">
        <h3 id="pl-form-titulo">Nuevo plan</h3>
        <form id="pl-form">
          <div class="grid cols-2">
            <div><label>Nombre del plan</label><input name="name" required maxlength="60" placeholder="Profesional"></div>
            <div><label>Importe mensual</label><input name="priceMonthly" type="number" min="0" step="any" required placeholder="19999"><span class="muted" style="font-size:.8rem">0 = plan "a medida" (sin cifra)</span></div>
          </div>
          <div class="grid cols-2">
            <div><label>Importe anual (opcional)</label><input name="priceAnnual" type="number" min="0" step="any" placeholder="Vacío = mensual × 10"><span class="muted" style="font-size:.8rem">Si lo dejás vacío, son 12 meses al precio de 10</span></div>
            <div><label>Texto sin cifra</label><input name="priceText" maxlength="40" placeholder="A medida"><span class="muted" style="font-size:.8rem">Sólo se usa cuando el mensual es 0</span></div>
          </div>
          <label>Bajada</label>
          <input name="note" maxlength="160" placeholder="El más elegido por nuestros clientes.">
          <div class="grid cols-2">
            <div><label>Texto del botón</label><input name="ctaLabel" maxlength="40" placeholder="Consultar"></div>
            <div><label>Destino del botón</label><input name="ctaHref" maxlength="200" placeholder="/contact.html"></div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="featured" style="width:auto;margin:0"> Destacar este plan (borde de acento)</label>
          <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" name="active" style="width:auto;margin:0" checked> Visible en el sitio</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="pl-guardar">Agregar plan</button>
            <button class="btn ghost" type="button" id="pl-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>

      <div id="pl-lista"><p class="muted">Cargando…</p></div>
      <p class="muted" style="font-size:.85rem;margin-top:14px">El orden de esta tabla es el orden en que se ven las tarjetas en el sitio.</p>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo planes: trae los planes de /api/planes y reconstruye las tarjetas de la sección de
   precios con el mismo marcado que hornea el módulo Precios (data-mensual/data-anual), para que el
   interruptor mensual/anual animado siga funcionando sobre los planes nuevos.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel de edición vive en /planes-admin.html.` : ''}
   Anime.js para la aparición de las tarjetas, con red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (n) { return '$' + Math.round(Number(n)).toLocaleString('es-AR'); };
  // Íconos horneados: los botones de reordenar llevan flecha Phosphor, no el glifo ↑↓
  var SUBIR = ${JSON.stringify(phIcon('arrow-up', { size: 14 }))};
  var BAJAR = ${JSON.stringify(phIcon('arrow-down', { size: 14 }))};

  // ---- Sección pública: reemplaza las tarjetas horneadas por las del backend ----
  function pintarSeccion(rows) {
    var seccion = document.getElementById('precios');
    if (!seccion || !rows || !rows.length) return;
    var grid = seccion.querySelector('.grid');
    if (!grid) return;
    grid.innerHTML = rows.map(function (p) {
      var borde = p.featured ? ' style="border-color:var(--accent)"' : '';
      var precio = p.priceMonthly > 0
        ? '<div class="price" data-mensual="' + p.priceMonthly + '" data-anual="' + p.priceAnnual + '"><span class="price-num">' + fmt(p.priceMonthly) + '</span><span class="price-per muted" style="font-size:.9rem">/mes</span></div>'
        : '<div class="price">' + App.esc(p.priceText || 'A medida') + '</div>';
      return '<div class="card"' + borde + '>' +
        '<h3>' + App.esc(p.name) + '</h3>' + precio +
        (p.note ? '<p class="muted">' + App.esc(p.note) + '</p>' : '') +
        '<a class="btn' + (p.featured ? '' : ' ghost') + '" href="' + App.esc(p.ctaHref) + '">' + App.esc(p.ctaLabel) + '</a>' +
        '</div>';
    }).join('');
    // El interruptor mensual/anual cachea las tarjetas: hay que avisarle que cambiaron
    if (window.WFPrecios && window.WFPrecios.refrescar) window.WFPrecios.refrescar();
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(grid.children, { opacity: [0, 1], translateY: [10, 0], duration: 420, delay: anime.stagger ? anime.stagger(60) : 0, ease: 'outCubic' });
      // Red de seguridad: con la pestaña oculta el loop de Anime no corre y las tarjetas
      // se quedarían en opacidad 0. Se fija el estado final igual.
      setTimeout(function () {
        Array.prototype.forEach.call(grid.children, function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
      }, 900);
    }
  }

  // Datos de la vista previa del Builder (la API no corre ahí): los mismos planes que hornea
  // la sección, con el anual ya calculado (mensual × 10) como lo haría el servidor.
  var DEMO = ${JSON.stringify(semilla(cfg).map((p, i) => ({ id: String(i + 1), ...p, priceAnnual: p.priceMonthly * 10 })))};

  if (document.getElementById('precios')) {
    if (window.__PREVIEW__) pintarSeccion(DEMO);
    else fetch('/api/planes').then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.rows) pintarSeccion(d.rows); }).catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /planes-admin.html ----
  var form = document.getElementById('pl-form');
  var box = document.getElementById('pl-lista');
  if (form && box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var editando = '';
    var CAMPOS = ['name', 'priceMonthly', 'priceAnnual', 'priceText', 'note', 'ctaLabel', 'ctaHref'];

    function salirDeEdicion() {
      editando = '';
      form.reset();
      form.querySelector('[name="active"]').checked = true;
      document.getElementById('pl-form-titulo').textContent = 'Nuevo plan';
      document.getElementById('pl-guardar').textContent = 'Agregar plan';
      document.getElementById('pl-cancelar').hidden = true;
    }

    function editar(p) {
      editando = p.id;
      CAMPOS.forEach(function (k) {
        var el = form.querySelector('[name="' + k + '"]');
        if (!el) return;
        // El anual calculado no se precarga: si el negocio no lo pisó, sigue siendo automático
        if (k === 'priceAnnual') { el.value = p.annualManual ? p.priceAnnual : ''; return; }
        el.value = p[k] == null ? '' : p[k];
      });
      form.querySelector('[name="featured"]').checked = !!p.featured;
      form.querySelector('[name="active"]').checked = p.active !== false;
      document.getElementById('pl-form-titulo').textContent = 'Editando: ' + p.name;
      document.getElementById('pl-guardar').textContent = 'Guardar cambios';
      document.getElementById('pl-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function pintar() {
      box.innerHTML = App.table(lista, [
        { label: 'Plan', render: function (p) {
          return '<strong>' + App.esc(p.name) + '</strong>' +
            (p.featured ? ' <span class="pl-chip destacado">destacado</span>' : '') +
            (p.note ? '<br><span class="muted" style="font-size:.8rem">' + App.esc(p.note) + '</span>' : '');
        } },
        { label: 'Mensual', render: function (p) { return '<span class="pl-num">' + (p.priceMonthly > 0 ? App.money(p.priceMonthly) : App.esc(p.priceText || 'A medida')) + '</span>'; } },
        { label: 'Anual', render: function (p) {
          if (!p.priceMonthly) return '<span class="pl-num muted">—</span>';
          return '<span class="pl-num">' + App.money(p.priceAnnual) + '</span>' +
            (p.annualManual ? '' : '<br><span class="muted" style="font-size:.75rem">calculado</span>');
        } },
        { label: 'Estado', render: function (p) { return p.active ? '<span class="pl-chip on">Visible</span>' : '<span class="pl-chip off">Oculto</span>'; } },
        { label: '', render: function (p) {
          return '<span class="pl-acciones">' +
            '<button class="btn ghost" type="button" aria-label="Subir" title="Subir" data-pl-sube="' + p.id + '">' + SUBIR + '</button>' +
            '<button class="btn ghost" type="button" aria-label="Bajar" title="Bajar" data-pl-baja="' + p.id + '">' + BAJAR + '</button>' +
            '<button class="btn ghost" type="button" data-pl-edit="' + p.id + '">Editar</button>' +
            '<button class="btn ghost" type="button" data-pl-ver="' + p.id + '">' + (p.active ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn ghost" type="button" data-pl-del="' + p.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);
      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-pl-edit]').forEach(function (b) {
        b.addEventListener('click', function () { var p = buscar(b.getAttribute('data-pl-edit')); if (p) editar(p); });
      });
      box.querySelectorAll('[data-pl-sube]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-pl-sube'), 'sube'); });
      });
      box.querySelectorAll('[data-pl-baja]').forEach(function (b) {
        b.addEventListener('click', function () { mover(b.getAttribute('data-pl-baja'), 'baja'); });
      });
      box.querySelectorAll('[data-pl-ver]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var p = buscar(b.getAttribute('data-pl-ver'));
          if (!p) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría la visibilidad'); return; }
          try {
            await App.api('/api/planes/' + p.id, { method: 'PUT', body: { active: !p.active } });
            App.toast(p.active ? 'Plan oculto' : 'Plan visible');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-pl-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar este plan? Si sólo querés sacarlo del sitio, usá "Ocultar".')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/planes/' + b.getAttribute('data-pl-del'), { method: 'DELETE' });
            App.toast('Plan borrado');
            if (editando === b.getAttribute('data-pl-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    async function mover(id, dir) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se reordenaría'); return; }
      try {
        var out = await App.api('/api/planes/' + id + '/mover', { method: 'POST', body: { dir: dir } });
        lista = out.rows;
        pintar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    async function cargar() {
      if (window.__PREVIEW__) { lista = DEMO.map(function (p) { return Object.assign({ annualManual: false }, p); }); pintar(); return; }
      try {
        var out = await App.api('/api/planes/todos');
        lista = out.rows;
        pintar();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {};
      CAMPOS.forEach(function (k) { datos[k] = form.querySelector('[name="' + k + '"]').value; });
      datos.featured = form.querySelector('[name="featured"]').checked;
      datos.active = form.querySelector('[name="active"]').checked;
      // El anual vacío significa "calculalo vos": se manda 0, no una cadena vacía
      datos.priceAnnual = datos.priceAnnual === '' ? 0 : Number(datos.priceAnnual);
      datos.priceMonthly = Number(datos.priceMonthly);
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el plan'); return; }
      try {
        if (editando) await App.api('/api/planes/' + editando, { method: 'PUT', body: datos });
        else await App.api('/api/planes', { method: 'POST', body: datos });
        App.toast(editando ? 'Plan actualizado' : 'Plan agregado');
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var cancelar = document.getElementById('pl-cancelar');
    if (cancelar) cancelar.addEventListener('click', salirDeEdicion);

    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      box.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      form.style.display = 'none';
    } else {
      cargar();
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(form, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: 'outCubic' });
        setTimeout(function () { form.style.opacity = 1; form.style.transform = 'none'; }, 800);
      }
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navP = document.getElementById('nav-planes-admin');
    if (navP && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navP.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Planes y precios administrables**: los planes viven en la colección \`plans\` y se inyectan en vivo sobre la sección de precios del sitio, así que **cambiar un precio no requiere regenerar ni volver a deployar**. Se siembran los tres planes de ejemplo del HTML: reemplazalos por los reales ${cfg.moduleIds.includes('auth') ? 'desde `/planes-admin.html`' : 'editando `data/plans.json` (o activá el módulo **Autenticación** para editarlos desde la web en `/planes-admin.html`)'}. El **importe anual se calcula solo** como mensual × 10 (12 meses al precio de 10) salvo que lo cargues a mano; un plan con importe **0** se muestra como texto ("A medida") y queda fuera del interruptor mensual/anual. El **orden lo decide el servidor** (botones de subir y bajar del panel), no el navegador.`,
  ],
};
