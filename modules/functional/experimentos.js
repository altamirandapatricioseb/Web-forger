// Pruebas A/B con backend real: hasta ahora el catálogo sabía construir el sitio y administrarlo,
// pero no había forma de saber QUÉ TEXTO VENDE MÁS. "¿Conviene 'Empezar ahora' o 'Pedí tu
// presupuesto'?" se contestaba por opinión. Acá el negocio define variantes de un texto clave
// (titular del hero, bajada, botón, título de la banda final…), el SERVIDOR reparte los visitantes
// entre las variantes y cuenta impresiones y conversiones, y el panel declara ganador sólo cuando
// hay evidencia estadística (prueba z de dos proporciones al 95%, calculada en el servidor sin
// ninguna dependencia).
//
// Tres decisiones que lo hacen honesto y no un contador de clics:
//   1. El reparto es del SERVIDOR y es ESTABLE: hash del id de visitante + id de prueba. El mismo
//      visitante ve siempre la misma variante aunque recargue, cambie de página o vuelva mañana —
//      si no, la métrica mide ruido. Nada de Math.random() en el navegador.
//   2. La impresión se registra sólo si el elemento medido EXISTE en la página que se está viendo:
//      el cliente informa qué destinos renderizó y el servidor ignora el resto. Contar impresiones
//      de gente que nunca vio el titular arruinaría la tasa.
//   3. Una fila por visitante y por prueba (colección expvisitors): la impresión y la conversión se
//      deduplican EN EL SERVIDOR, no con una bandera del navegador. Recargar diez veces no infla
//      nada, y la conversión es idempotente.
//
// Los destinos y los objetivos son una LISTA BLANCA (no un selector CSS libre): el negocio elige de
// un desplegable y el servidor rechaza cualquier otro valor. La conversión viaja por sendBeacon
// cuando el navegador lo soporta, porque el clic en el botón medido navega a otra página antes de
// que un fetch normal llegue a salir. Panel solo-admin, animado con Anime.js + red de seguridad.
const { phIcon } = require('../../src/icons');

// Destinos medibles: qué texto del sitio se puede probar. `sel` lo usa el cliente para encontrarlo.
const DESTINOS = [
  { id: 'hero-titulo', label: 'Titular del hero', sel: '.hero h1' },
  { id: 'hero-bajada', label: 'Bajada del hero', sel: '.hero p' },
  { id: 'hero-boton', label: 'Botón del hero', sel: '.hero .btn' },
  { id: 'cta-titulo', label: 'Título de la banda final', sel: '#cta h2' },
  { id: 'cta-boton', label: 'Botón de la banda final', sel: '#cta .btn' },
  { id: 'precios-titulo', label: 'Título de la sección de precios', sel: '#precios h2' },
  { id: 'servicios-titulo', label: 'Título de la sección de servicios', sel: '#servicios h2' },
];

// Objetivos: qué cuenta como conversión. `evt` distingue el clic del envío de formulario;
// `sel` vacío significa "el propio elemento que se está probando" (botón que se mide a sí mismo).
const OBJETIVOS = [
  { id: 'clic-medido', label: 'Clic en el elemento que se está probando', sel: '', evt: 'click' },
  { id: 'clic-hero-boton', label: 'Clic en el botón del hero', sel: '.hero .btn', evt: 'click' },
  { id: 'clic-cta-boton', label: 'Clic en el botón de la banda final', sel: '#cta .btn', evt: 'click' },
  { id: 'envio-contacto', label: 'Envío del formulario de contacto', sel: '#contact-form', evt: 'submit' },
  { id: 'clic-whatsapp', label: 'Clic en WhatsApp', sel: 'a[href*="wa.me"]', evt: 'click' },
];

module.exports = {
  id: 'experimentos', type: 'functional', name: 'Pruebas A/B de textos',
  description: 'Probá dos o más versiones de un texto clave del sitio (titular del hero, bajada, botón, título de una sección) y descubrí cuál convierte mejor, con datos en vez de opiniones. El reparto de visitantes lo hace el servidor con un hash estable del visitante: cada persona ve siempre la misma variante aunque recargue o vuelva otro día. Se registran impresiones (sólo si el elemento medido estaba realmente en la página) y conversiones (clic en un botón o envío del formulario de contacto), una fila por visitante y por prueba, así recargar no infla nada. El panel muestra la tasa de cada variante y declara ganador sólo cuando la diferencia supera una prueba z de dos proporciones al 95%. Sin servicios externos ni cookies de terceros. Panel solo-admin, animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/experimentos', file: 'routes/experimentos.js' }],
  collections: ['experiments', 'expvisitors'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Pruebas A/B', href: '/experimentos-admin.html', id: 'nav-experimentos' }] : [],
  head: () => `  <style>
    .ex-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .ex-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .ex-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .ex-chip.gana{background:color-mix(in srgb,var(--accent) 16%,var(--surface));color:var(--accent)}
    .ex-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .ex-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .ex-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .ex-barra{height:6px;border-radius:999px;background:var(--line);overflow:hidden;margin-top:5px}
    .ex-barra span{display:block;height:100%;background:var(--accent);width:0}
    .ex-prueba{margin-bottom:22px}
    .ex-variante{padding:10px 0;border-bottom:1px solid var(--line)}
    .ex-variante:last-child{border-bottom:0}
  </style>`,
  files: (cfg) => ({
    'routes/experimentos.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Lista blanca de destinos y objetivos: el panel sólo ofrece estos y el servidor rechaza el resto.
// Nunca se acepta un selector CSS libre desde el cliente.
const DESTINOS = ${JSON.stringify(DESTINOS.map(d => d.id))};
const OBJETIVOS = ${JSON.stringify(OBJETIVOS.map(o => o.id))};
const LETRAS = ['A', 'B', 'C', 'D'];
// Debajo de esta cantidad de visitantes por variante no se declara nada: con muestras chicas
// cualquier diferencia es ruido, y un ganador falso es peor que no tener ganador.
const MIN_MUESTRA = 30;

// Hash FNV-1a de 32 bits: determinista, sin dependencias y estable entre procesos (importa en
// serverless, donde cada request puede caer en otra instancia). Decide qué variante ve cada
// visitante a partir de su id y el de la prueba: el mismo par da siempre el mismo resultado.
function hash32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Normaliza las variantes guardadas: como máximo 4, con letra fija por posición
function variantes(lista) {
  return (Array.isArray(lista) ? lista : []).slice(0, 4).map((v, i) => ({
    key: LETRAS[i],
    label: String(v.label || ('Variante ' + LETRAS[i])).slice(0, 40),
    text: String(v.text || '').slice(0, 300),
  }));
}

const resolver = (e) => ({
  id: e.id,
  name: e.name || '',
  target: DESTINOS.includes(e.target) ? e.target : DESTINOS[0],
  goal: OBJETIVOS.includes(e.goal) ? e.goal : OBJETIVOS[0],
  variants: variantes(e.variants),
  active: e.active === true,
  createdAt: e.createdAt,
});

// Se siembra una prueba de ejemplo APAGADA: sirve de plantilla y no cambia el sitio de nadie
// sin que el negocio lo decida. Una prueba encendida sola repartiría visitantes desde el minuto 0.
db.seedIfEmpty('experiments', [
  {
    name: 'Titular del hero (ejemplo)',
    target: 'hero-titulo',
    goal: 'clic-hero-boton',
    variants: [
      { label: 'Original', text: ${JSON.stringify(cfg.texts.heroTitle)} },
      { label: 'Más directa', text: 'Todo lo que tu negocio necesita para crecer' },
    ],
    active: false,
  },
]);

// Función de distribución normal acumulada (aproximación de Abramowitz-Stegun 26.2.17) para
// traducir el valor z en confianza de dos colas. Es la única "estadística" que hace falta y
// evita cualquier dependencia.
function confianza(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const cola = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 1 - 2 * cola;
}

// Prueba z de dos proporciones entre la mejor variante y la segunda. Devuelve ganador sólo con
// 95% de confianza y muestra suficiente en AMBAS: si no, explica qué falta.
function veredicto(vars) {
  const listos = vars.filter(v => v.impressions >= MIN_MUESTRA);
  if (listos.length < 2) {
    return { winner: null, confidence: 0, verdict: 'Faltan datos: cada variante necesita al menos ' + MIN_MUESTRA + ' visitantes.' };
  }
  const orden = listos.slice().sort((a, b) => b.rate - a.rate);
  const a = orden[0];
  const b = orden[1];
  const p = (a.conversions + b.conversions) / (a.impressions + b.impressions);
  const se = Math.sqrt(p * (1 - p) * (1 / a.impressions + 1 / b.impressions));
  if (!se) return { winner: null, confidence: 0, verdict: 'Todavía no hubo ninguna conversión.' };
  const z = Math.abs(a.rate - b.rate) / se;
  const conf = Math.round(confianza(z) * 1000) / 10;
  if (z < 1.96) {
    return { winner: null, confidence: conf, verdict: 'La diferencia todavía puede ser azar (' + conf + '% de confianza; hace falta 95%). Dejala correr.' };
  }
  return { winner: a.key, confidence: conf, verdict: 'Gana la variante ' + a.key + ' con ' + conf + '% de confianza.' };
}

// Arma las métricas de una prueba a partir de las filas de visitantes
function conMetricas(exp, filas) {
  const vars = resolver(exp).variants.map(v => {
    const propias = filas.filter(f => f.variant === v.key);
    const conversions = propias.filter(f => f.converted).length;
    return {
      key: v.key, label: v.label, text: v.text,
      impressions: propias.length,
      conversions,
      rate: propias.length ? conversions / propias.length : 0,
    };
  });
  return Object.assign(resolver(exp), { variants: vars }, veredicto(vars));
}

// Un id de visitante es una cadena opaca generada por el navegador: sin datos personales
const VISITANTE = /^[A-Za-z0-9_-]{8,64}$/;

// POST /api/experimentos/asignar — devuelve la variante de cada prueba activa Y registra la
// impresión. Es POST porque escribe. El cliente informa qué destinos renderizó realmente:
// una prueba cuyo elemento no está en esta página no suma impresión (mediría a quien no vio nada).
router.post('/asignar', async (req, res) => {
  const vid = String((req.body && req.body.v) || '');
  if (!VISITANTE.test(vid)) return res.status(422).json({ error: 'Identificador de visitante inválido' });
  const presentes = Array.isArray(req.body.destinos) ? req.body.destinos.filter(d => DESTINOS.includes(d)) : [];
  if (!presentes.length) return res.json({ rows: [] });
  const activos = (await db.all('experiments')).map(resolver).filter(e => e.active && presentes.includes(e.target));
  const mias = await db.find('expvisitors', r => r.visitorId === vid);
  const rows = [];
  for (const e of activos) {
    if (e.variants.length < 2) continue;
    const previa = mias.filter(r => r.expId === e.id)[0];
    // Si la prueba cambió de cantidad de variantes, la asignación vieja puede no existir más
    const vale = previa && e.variants.some(v => v.key === previa.variant);
    const key = vale ? previa.variant : e.variants[hash32(vid + ':' + e.id) % e.variants.length].key;
    if (!previa) await db.insert('expvisitors', { expId: e.id, visitorId: vid, variant: key, converted: false });
    else if (!vale) await db.update('expvisitors', previa.id, { variant: key });
    const v = e.variants.filter(x => x.key === key)[0];
    rows.push({ id: e.id, target: e.target, goal: e.goal, variant: key, text: v.text });
  }
  res.json({ rows });
});

// POST /api/experimentos/:id/conversion — marca la conversión del visitante. Idempotente: el
// mismo visitante puede disparar el objetivo diez veces y cuenta una sola.
router.post('/:id/conversion', async (req, res) => {
  const vid = String((req.body && req.body.v) || '');
  if (!VISITANTE.test(vid)) return res.status(422).json({ error: 'Identificador de visitante inválido' });
  const exp = await db.get('experiments', req.params.id);
  if (!exp) return res.status(404).json({ error: 'Esa prueba no existe' });
  const fila = (await db.find('expvisitors', r => r.expId === exp.id && r.visitorId === vid))[0];
  // Sin impresión previa no hay conversión posible: el visitante nunca vio la variante
  if (!fila) return res.status(409).json({ error: 'Ese visitante no tiene variante asignada en esta prueba' });
  if (fila.converted) return res.json({ ok: true, nuevo: false });
  await db.update('expvisitors', fila.id, { converted: true, convertedAt: new Date().toISOString() });
  res.json({ ok: true, nuevo: true });
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/experimentos/todos — el panel ve todas las pruebas con sus métricas y su veredicto
router.get('/todos', requireAdmin, async (req, res) => {
  const filas = await db.all('expvisitors');
  const rows = (await db.all('experiments'))
    .map(e => conMetricas(e, filas.filter(f => f.expId === e.id)))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  res.json({ rows, minMuestra: MIN_MUESTRA });
});

// Valida el cuerpo de un alta o una edición. Devuelve {ok, error, patch}
function leer(body, parcial) {
  const patch = {};
  if (body.name !== undefined || !parcial) {
    if (!str(body.name, 2, 80)) return { ok: false, error: 'El nombre de la prueba tiene que tener entre 2 y 80 caracteres' };
    patch.name = String(body.name).trim();
  }
  if (body.target !== undefined || !parcial) {
    if (!DESTINOS.includes(body.target)) return { ok: false, error: 'Ese elemento no se puede medir' };
    patch.target = body.target;
  }
  if (body.goal !== undefined || !parcial) {
    if (!OBJETIVOS.includes(body.goal)) return { ok: false, error: 'Ese objetivo no existe' };
    patch.goal = body.goal;
  }
  if (body.variants !== undefined || !parcial) {
    const lista = variantes(body.variants).filter(v => v.text.trim());
    if (lista.length < 2) return { ok: false, error: 'Una prueba necesita al menos dos variantes con texto' };
    patch.variants = lista;
  }
  if (body.active !== undefined) patch.active = body.active === true || body.active === 'true' || body.active === 'on';
  return { ok: true, patch };
}

// POST /api/experimentos — alta. Nace apagada salvo que se pida lo contrario
router.post('/', requireAdmin, async (req, res) => {
  const { ok, error, patch } = leer(req.body, false);
  if (!ok) return res.status(422).json({ error });
  const row = await db.insert('experiments', {
    name: patch.name, target: patch.target, goal: patch.goal,
    variants: patch.variants, active: patch.active === true,
  });
  res.status(201).json(conMetricas(row, []));
});

// PUT /api/experimentos/:id — edición parcial. Cambiar la CANTIDAD de variantes, el destino o el
// objetivo invalida lo medido hasta ahora (ya no compara lo mismo), así que se reinician los datos
// en el mismo movimiento y se avisa. Corregir una falta de ortografía en un texto no reinicia nada.
router.put('/:id', requireAdmin, async (req, res) => {
  const exp = await db.get('experiments', req.params.id);
  if (!exp) return res.status(404).json({ error: 'Esa prueba no existe' });
  const { ok, error, patch } = leer(req.body, true);
  if (!ok) return res.status(422).json({ error });
  const antes = resolver(exp);
  // Boolean() no es decorativo: sin él, un patch que sólo trae variantes de la misma cantidad
  // devuelve undefined (por el || con campos ausentes) y JSON.stringify borra la clave, así que
  // el panel nunca se entera de que NO se reinició nada.
  const cambiaEstructura = Boolean(
    (patch.variants && patch.variants.length !== antes.variants.length) ||
    (patch.target && patch.target !== antes.target) ||
    (patch.goal && patch.goal !== antes.goal)
  );
  if (cambiaEstructura) {
    for (const f of await db.find('expvisitors', r => r.expId === exp.id)) await db.remove('expvisitors', f.id);
  }
  const row = await db.update('experiments', exp.id, patch);
  const filas = await db.find('expvisitors', r => r.expId === exp.id);
  res.json(Object.assign(conMetricas(row, filas), { reiniciada: cambiaEstructura }));
});

// POST /api/experimentos/:id/reiniciar — borra lo medido y arranca de cero (sin tocar los textos)
router.post('/:id/reiniciar', requireAdmin, async (req, res) => {
  const exp = await db.get('experiments', req.params.id);
  if (!exp) return res.status(404).json({ error: 'Esa prueba no existe' });
  const filas = await db.find('expvisitors', r => r.expId === exp.id);
  for (const f of filas) await db.remove('expvisitors', f.id);
  res.json({ ok: true, borradas: filas.length });
});

// DELETE /api/experimentos/:id — baja de la prueba Y de sus mediciones (no dejar huérfanas)
router.delete('/:id', requireAdmin, async (req, res) => {
  const exp = await db.get('experiments', req.params.id);
  if (!exp) return res.status(404).json({ error: 'Esa prueba no existe' });
  for (const f of await db.find('expvisitors', r => r.expId === exp.id)) await db.remove('expvisitors', f.id);
  await db.remove('experiments', exp.id);
  res.json({ ok: true });
});
` : `// El panel de pruebas requiere el módulo de autenticación: activalo en el Builder para habilitar
// /experimentos-admin.html. Sin él, las pruebas se definen en data/experiments.json y el reparto,
// el conteo de impresiones y el de conversiones siguen funcionando igual.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'experimentos-admin': {
      title: 'Pruebas A/B',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('chart-line-up', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Pruebas A/B de textos</h2>
      <p class="section-sub">Probá dos o más versiones de un texto del sitio y dejá que los visitantes decidan cuál funciona mejor. El reparto lo hace el servidor: cada persona ve siempre la misma variante. Solo visible para administradores.</p>

      <div class="card" style="margin-bottom:26px">
        <h3 id="ex-form-titulo">Nueva prueba</h3>
        <form id="ex-form">
          <label>Nombre de la prueba</label>
          <input name="name" required maxlength="80" placeholder="Titular del hero — directo vs. aspiracional">
          <div class="grid cols-2">
            <div><label>¿Qué texto se prueba?</label><select name="target" id="ex-target"></select></div>
            <div><label>¿Qué cuenta como conversión?</label><select name="goal" id="ex-goal"></select></div>
          </div>
          <label style="margin-top:14px">Variantes</label>
          <p class="muted" style="font-size:.82rem;margin:0 0 8px">La A suele ser el texto actual. Dejá en blanco las que no uses (mínimo dos).</p>
          <div id="ex-variantes"></div>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="active" style="width:auto;margin:0"> Activar la prueba ahora</label>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="submit" id="ex-guardar">Crear prueba</button>
            <button class="btn ghost" type="button" id="ex-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </div>

      <div id="ex-lista"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo experimentos: pide al servidor qué variante le toca a este visitante (reparto estable
   por hash, no aleatorio en el navegador), aplica el texto y avisa la conversión cuando el visitante
   cumple el objetivo. El id de visitante es una cadena opaca en localStorage: sin datos personales
   ni cookies de terceros.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel de pruebas vive en /experimentos-admin.html.` : ''}
   Anime.js para el cambio de texto, con red de seguridad por si el loop está pausado. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DESTINOS = ${JSON.stringify(DESTINOS)};
  var OBJETIVOS = ${JSON.stringify(OBJETIVOS)};
  var selDestino = {};
  DESTINOS.forEach(function (d) { selDestino[d.id] = d.sel; });

  // Id opaco y estable de este navegador. No identifica a la persona: sólo permite que el
  // servidor le devuelva SIEMPRE la misma variante y no cuente dos veces la misma visita.
  function visitante() {
    try {
      var v = localStorage.getItem('wf_vid');
      if (!v) {
        v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
          : (Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
        localStorage.setItem('wf_vid', v);
      }
      return v;
    } catch (e) { return ''; }
  }

  // El clic en el botón medido navega a otra página: un fetch normal se cancela a mitad de camino.
  // sendBeacon está pensado exactamente para esto (y keepalive es el plan B).
  function avisar(url, cuerpo) {
    var texto = JSON.stringify(cuerpo);
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([texto], { type: 'application/json' }));
        return;
      }
    } catch (e) {}
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: texto, keepalive: true }).catch(function () {});
  }

  function aplicar(el, texto) {
    if (!el || !texto || el.textContent.trim() === texto) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = texto; return; }
    // Cambio suave: se apaga, se reemplaza y vuelve. Evita el salto seco del texto.
    anime.animate(el, {
      opacity: [1, 0], duration: 140, ease: 'outQuad',
      onComplete: function () {
        el.textContent = texto;
        anime.animate(el, { opacity: [0, 1], duration: 220, ease: 'outQuad' });
      },
    });
    // Red de seguridad: con la pestaña oculta el loop de Anime no corre y el texto se quedaría
    // invisible (o sin cambiar). Se fija el estado final igual.
    setTimeout(function () { el.textContent = texto; el.style.opacity = 1; }, 700);
  }

  function objetivo(id) {
    var o = OBJETIVOS.filter(function (x) { return x.id === id; })[0];
    return o || OBJETIVOS[0];
  }

  function engancharConversion(fila, vid, elMedido) {
    var o = objetivo(fila.goal);
    // Objetivo "el propio elemento": el botón que se está probando se mide a sí mismo
    var nodos = o.sel ? document.querySelectorAll(o.sel) : (elMedido ? [elMedido] : []);
    Array.prototype.forEach.call(nodos, function (n) {
      n.addEventListener(o.evt, function () {
        avisar('/api/experimentos/' + fila.id + '/conversion', { v: vid });
      });
    });
  }

  // ---- Sitio público: pedir asignación y aplicar ----
  (function () {
    if (window.__PREVIEW__) return;
    var vid = visitante();
    if (!vid) return;
    // Sólo se informan los destinos que existen EN ESTA página: el servidor no cuenta impresión
    // de un texto que el visitante no llegó a ver.
    var presentes = DESTINOS.filter(function (d) { return document.querySelector(d.sel); }).map(function (d) { return d.id; });
    if (!presentes.length) return;
    fetch('/api/experimentos/asignar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ v: vid, destinos: presentes }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.rows) return;
      d.rows.forEach(function (fila) {
        var el = document.querySelector(selDestino[fila.target] || '');
        aplicar(el, fila.text);
        engancharConversion(fila, vid, el);
      });
    }).catch(function () {});
  })();
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /experimentos-admin.html ----
  var form = document.getElementById('ex-form');
  var box = document.getElementById('ex-lista');
  if (form && box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var lista = [];
    var editando = '';
    var minMuestra = 30;
    var LETRAS = ['A', 'B', 'C', 'D'];
    var pct = function (n) { return (n * 100).toFixed(1) + '%'; };

    function llenarSelects() {
      var t = document.getElementById('ex-target');
      var g = document.getElementById('ex-goal');
      if (t) t.innerHTML = DESTINOS.map(function (d) { return '<option value="' + d.id + '">' + App.esc(d.label) + '</option>'; }).join('');
      if (g) g.innerHTML = OBJETIVOS.map(function (o) { return '<option value="' + o.id + '">' + App.esc(o.label) + '</option>'; }).join('');
      var cont = document.getElementById('ex-variantes');
      if (cont) {
        cont.innerHTML = LETRAS.map(function (L, i) {
          return '<div class="grid cols-2" style="gap:10px">' +
            '<div><label>Etiqueta ' + L + '</label><input name="label' + L + '" maxlength="40" placeholder="' + (i === 0 ? 'Original' : 'Variante ' + L) + '"></div>' +
            '<div><label>Texto ' + L + (i < 2 ? '' : ' (opcional)') + '</label><input name="text' + L + '" maxlength="300"></div>' +
            '</div>';
        }).join('');
      }
    }

    function salirDeEdicion() {
      editando = '';
      form.reset();
      document.getElementById('ex-form-titulo').textContent = 'Nueva prueba';
      document.getElementById('ex-guardar').textContent = 'Crear prueba';
      document.getElementById('ex-cancelar').hidden = true;
    }

    function editar(e) {
      editando = e.id;
      form.querySelector('[name="name"]').value = e.name || '';
      form.querySelector('[name="target"]').value = e.target;
      form.querySelector('[name="goal"]').value = e.goal;
      LETRAS.forEach(function (L, i) {
        var v = e.variants[i];
        form.querySelector('[name="label' + L + '"]').value = v ? v.label : '';
        form.querySelector('[name="text' + L + '"]').value = v ? v.text : '';
      });
      form.querySelector('[name="active"]').checked = !!e.active;
      document.getElementById('ex-form-titulo').textContent = 'Editando: ' + e.name;
      document.getElementById('ex-guardar').textContent = 'Guardar cambios';
      document.getElementById('ex-cancelar').hidden = false;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function etiqueta(idLista, id) {
      var f = idLista.filter(function (x) { return x.id === id; })[0];
      return f ? f.label : id;
    }

    function pintar() {
      if (!lista.length) { box.innerHTML = '<p class="muted">Todavía no hay pruebas cargadas.</p>'; return; }
      var mejor = function (e) { return e.variants.reduce(function (m, v) { return Math.max(m, v.rate); }, 0); };
      box.innerHTML = lista.map(function (e) {
        var tope = mejor(e) || 1;
        var filas = e.variants.map(function (v) {
          var ancho = Math.round((v.rate / tope) * 100);
          return '<div class="ex-variante">' +
            '<div style="display:flex;gap:12px;justify-content:space-between;align-items:baseline;flex-wrap:wrap">' +
            '<strong>' + v.key + ' · ' + App.esc(v.label) + (e.winner === v.key ? ' <span class="ex-chip gana">gana</span>' : '') + '</strong>' +
            '<span class="ex-num">' + pct(v.rate) + ' <span class="muted" style="font-weight:400">(' + v.conversions + ' de ' + v.impressions + ')</span></span>' +
            '</div>' +
            '<div class="muted" style="font-size:.85rem">' + App.esc(v.text) + '</div>' +
            '<div class="ex-barra"><span style="width:' + ancho + '%"></span></div>' +
            '</div>';
        }).join('');
        return '<div class="card ex-prueba">' +
          '<div style="display:flex;gap:12px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap">' +
          '<div><h3 style="margin:0 0 4px">' + App.esc(e.name) + ' ' + (e.active ? '<span class="ex-chip on">Activa</span>' : '<span class="ex-chip off">Pausada</span>') + '</h3>' +
          '<span class="muted" style="font-size:.85rem">Mide: ' + App.esc(etiqueta(DESTINOS, e.target)) + ' · Convierte con: ' + App.esc(etiqueta(OBJETIVOS, e.goal)) + '</span></div>' +
          '<span class="ex-acciones">' +
          '<button class="btn ghost" type="button" data-ex-edit="' + e.id + '">Editar</button>' +
          '<button class="btn ghost" type="button" data-ex-on="' + e.id + '">' + (e.active ? 'Pausar' : 'Activar') + '</button>' +
          '<button class="btn ghost" type="button" data-ex-reset="' + e.id + '">Reiniciar</button>' +
          '<button class="btn ghost" type="button" data-ex-del="' + e.id + '">Borrar</button>' +
          '</span></div>' +
          filas +
          '<p class="muted" style="font-size:.85rem;margin:12px 0 0">' + App.esc(e.verdict) + '</p>' +
          '</div>';
      }).join('');

      var buscar = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      box.querySelectorAll('[data-ex-edit]').forEach(function (b) {
        b.addEventListener('click', function () { var e = buscar(b.getAttribute('data-ex-edit')); if (e) editar(e); });
      });
      box.querySelectorAll('[data-ex-on]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var e = buscar(b.getAttribute('data-ex-on'));
          if (!e) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se cambiaría el estado'); return; }
          try {
            await App.api('/api/experimentos/' + e.id, { method: 'PUT', body: { active: !e.active } });
            App.toast(e.active ? 'Prueba pausada' : 'Prueba activa');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-ex-reset]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar lo medido hasta ahora y empezar de cero? Los textos no se tocan.')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se reiniciaría'); return; }
          try {
            var out = await App.api('/api/experimentos/' + b.getAttribute('data-ex-reset') + '/reiniciar', { method: 'POST', body: {} });
            App.toast('Mediciones borradas: ' + out.borradas);
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      box.querySelectorAll('[data-ex-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Borrar la prueba y todo lo medido? Para dejar de repartir sin perder los datos, usá "Pausar".')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/experimentos/' + b.getAttribute('data-ex-del'), { method: 'DELETE' });
            App.toast('Prueba borrada');
            if (editando === b.getAttribute('data-ex-del')) salirDeEdicion();
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    var DEMO = [{
      id: 'd1', name: 'Titular del hero (ejemplo)', target: 'hero-titulo', goal: 'clic-hero-boton', active: false,
      variants: [
        { key: 'A', label: 'Original', text: ${JSON.stringify(cfg.texts.heroTitle)}, impressions: 0, conversions: 0, rate: 0 },
        { key: 'B', label: 'Más directa', text: 'Todo lo que tu negocio necesita para crecer', impressions: 0, conversions: 0, rate: 0 },
      ],
      winner: null, confidence: 0, verdict: 'Faltan datos: cada variante necesita al menos 30 visitantes.',
    }];

    async function cargar() {
      if (window.__PREVIEW__) { lista = DEMO.slice(); pintar(); return; }
      try {
        var out = await App.api('/api/experimentos/todos');
        lista = out.rows;
        minMuestra = out.minMuestra || minMuestra;
        pintar();
      } catch (err) {
        if (err.message !== 'preview') box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {
        name: form.querySelector('[name="name"]').value,
        target: form.querySelector('[name="target"]').value,
        goal: form.querySelector('[name="goal"]').value,
        active: form.querySelector('[name="active"]').checked,
        // Las variantes sin texto no viajan: el servidor exige al menos dos con contenido
        variants: LETRAS.map(function (L) {
          return {
            label: form.querySelector('[name="label' + L + '"]').value,
            text: form.querySelector('[name="text' + L + '"]').value,
          };
        }).filter(function (v) { return v.text.trim(); }),
      };
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la prueba'); return; }
      try {
        var out;
        if (editando) out = await App.api('/api/experimentos/' + editando, { method: 'PUT', body: datos });
        else out = await App.api('/api/experimentos', { method: 'POST', body: datos });
        App.toast(out && out.reiniciada ? 'Prueba actualizada (se reiniciaron las mediciones)' : (editando ? 'Prueba actualizada' : 'Prueba creada'));
        salirDeEdicion();
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var cancelar = document.getElementById('ex-cancelar');
    if (cancelar) cancelar.addEventListener('click', salirDeEdicion);

    llenarSelects();
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
    var navE = document.getElementById('nav-experimentos');
    if (navE && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navE.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Pruebas A/B de textos**: se siembra una prueba de ejemplo **apagada** (titular del hero) para que el sitio no empiece a repartir variantes sin que lo decidas. ${cfg.moduleIds.includes('auth') ? 'Creá y activá pruebas desde `/experimentos-admin.html`' : 'Definí las pruebas en `data/experiments.json` (o activá el módulo **Autenticación** para administrarlas desde `/experimentos-admin.html`)'}. El reparto lo hace el servidor con un **hash estable** del id de visitante: cada persona ve siempre la misma variante. La **impresión sólo se cuenta si el elemento medido estaba en la página** y hay **una fila por visitante y por prueba**, así recargar no infla los números. El panel declara ganador con una **prueba z de dos proporciones al 95%** y un mínimo de 30 visitantes por variante: hasta entonces dice qué falta. El id de visitante es una cadena opaca en \`localStorage\` (sin datos personales ni cookies de terceros); si mostrás un banner de cookies, alcanza con declararlo como medición propia.`,
  ],
};
