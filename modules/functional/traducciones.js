// Multiidioma administrable con backend real: el catálogo ya tenía el módulo UI `i18n`, pero su
// diccionario español→inglés está HORNEADO en el archivo generado. Eso significa dos límites que
// en un sitio comercial se chocan enseguida: son dos idiomas fijos (si el cliente vende a Brasil,
// no hay portugués) y cada texto nuevo que el dueño escribe —una promo, un servicio, una sección
// entera— queda sin traducir hasta que alguien vuelva al Builder y regenere todo el sitio.
// Acá el diccionario es un DATO: los idiomas y las traducciones se cargan desde /idiomas-admin.html
// y el visitante las recibe del servidor.
// La pieza que hace que esto sea usable de verdad es la CAPTURA: el propio sitio le avisa al
// servidor qué textos aparecieron en pantalla, así el panel muestra la lista real de frases a
// traducir en vez de obligar al dueño a copiarlas a mano de cada página. Ese es el trabajo que
// normalmente hace un plugin pago. La captura se apaga con un interruptor cuando ya está todo
// relevado, y nunca guarda de dónde vino cada texto ni quién lo vio.
// La traducción se aplica sobre los nodos de texto de la página, comparando el texto original
// completo: es el mismo criterio del módulo `i18n` (por eso los dos son compatibles y este
// esconde el selector del otro si conviven), pero con el diccionario vivo.
// Animado con Anime.js (count-up de KPIs, barras de avance por idioma) + red de seguridad.
// La lectura del diccionario es pública; el panel requiere auth.

module.exports = {
  id: 'traducciones', type: 'functional', name: 'Multiidioma administrable',
  description: 'Idiomas y traducciones cargados desde el panel, no horneados en el sitio: se agregan los idiomas que haga falta (inglés, portugués, el que sea) y se traduce frase por frase sin volver a exportar el proyecto. El sitio le avisa al servidor qué textos aparecieron en pantalla, así el panel muestra la lista real de lo que falta traducir en vez de obligar a copiarlas a mano. Selector de idioma en la navegación, avance por idioma y CSV. Con auth, panel /idiomas-admin.html. Convive con el módulo Multiidioma ES/EN (lo reemplaza cuando los dos están activos). Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/traducciones', file: 'routes/traducciones.js' }],
  collections: ['langs', 'i18nkeys', 'i18ncfg'],
  nav: () => [
    { label: 'ES', href: '#', id: 'tr-lang' },
    { label: 'Idiomas (admin)', href: '/idiomas-admin.html', id: 'nav-tr-admin' },
  ],
  head: () => `  <style>
    .tr-menu{position:absolute;z-index:60;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:6px;min-width:150px;box-shadow:0 8px 30px rgba(0,0,0,.18)}
    .tr-menu button{display:block;width:100%;text-align:left;background:none;border:0;padding:8px 12px;border-radius:6px;cursor:pointer;font:inherit;font-size:.9rem;color:inherit}
    .tr-menu button:hover,.tr-menu button:focus-visible{background:color-mix(in srgb,var(--accent) 12%,transparent)}
    .tr-menu button.on{font-weight:700;color:var(--accent)}
    .tr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:22px 0}
    .tr-kpis .card{text-align:center}
    .tr-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .tr-avance{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
    .tr-avance .n{width:112px;flex:none}
    .tr-avance .b{flex:1;height:9px;border-radius:999px;background:var(--bg);border:1px solid var(--line);overflow:hidden}
    .tr-avance .b i{display:block;height:100%;width:0;background:var(--accent)}
    .tr-avance .p{width:52px;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;font-size:.9rem}
    .tr-orig{font-size:.92rem;line-height:1.4}
    .tr-falta{display:inline-block;font-size:.7rem;padding:1px 9px;border-radius:999px;font-weight:700;background:#c0392b1a;color:#c0392b}
    .tr-lista{display:flex;flex-direction:column;gap:12px;margin-top:20px}
    .tr-fila{border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;background:var(--surface)}
    .tr-fila textarea{margin-bottom:0}
    .tr-campo{margin-top:10px}
    .tr-campo label{font-size:.8rem;color:var(--muted)}
  </style>`,
  files: () => ({
    'routes/traducciones.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

// Topes: la captura de textos la dispara cualquier visitante anónimo, así que el diccionario no
// puede crecer sin techo. 800 frases alcanzan de sobra para un sitio comercial completo.
const MAX_CLAVES = 800;
const MAX_POR_PEDIDO = 60;
const MAX_LARGO = 220;

// Un código de idioma razonable: 'en', 'pt', 'pt-BR'. No se aceptan inventos: el atributo lang
// del HTML tiene que ser válido para que el navegador y los lectores de pantalla lo entiendan.
const CODIGO_OK = /^[a-z]{2}(-[A-Za-z]{2,4})?$/;

// Un texto hecho solo de números, símbolos y separadores (un precio, una fecha, un teléfono)
const SOLO_NUMEROS = /^[\\d\\s$.,:/%+-]+$/;

// Ficha de configuración: idioma original del sitio e interruptor de captura
async function config() {
  const rows = await db.all('i18ncfg');
  if (rows.length) return rows[0];
  return db.insert('i18ncfg', { base: 'es', captura: true });
}

async function idiomas() {
  return (await db.all('langs')).slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));
}

// Cuántas frases tiene traducidas cada idioma: es el dato que dice si se puede publicar
function avance(claves, code) {
  const hechas = claves.filter(k => k.trad && String(k.trad[code] || '').trim()).length;
  return { total: claves.length, hechas, pct: claves.length ? Math.round(hechas / claves.length * 100) : 0 };
}

/* ---------- Cara pública ---------- */

// GET /api/traducciones — idiomas publicados (lo lee el selector de la navegación)
router.get('/', async (req, res) => {
  const cfg = await config();
  res.json({
    base: cfg.base || 'es',
    captura: cfg.captura !== false,
    idiomas: (await idiomas()).filter(l => l.active !== false).map(l => ({ code: l.code, nombre: l.nombre })),
  });
});

/* ---------- Panel (van antes de /:code para que 'admin' no se lea como un idioma) ---------- */

// GET /api/traducciones/admin — diccionario completo, idiomas y avance (solo admin)
router.get('/admin', requireAdmin, async (req, res) => {
  const claves = (await db.all('i18nkeys')).slice().sort((a, b) => (b.hits || 0) - (a.hits || 0));
  const langs = await idiomas();
  res.json({
    config: await config(),
    idiomas: langs.map(l => ({ ...l, avance: avance(claves, l.code) })),
    claves,
    tope: MAX_CLAVES,
  });
});

// POST /api/traducciones/admin/idiomas — agrega un idioma (solo admin)
router.post('/admin/idiomas', requireAdmin, async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!CODIGO_OK.test(code)) return res.status(422).json({ error: 'Código de idioma inválido (ejemplos: en, pt, pt-BR)' });
  if (!str(req.body.nombre, 2, 40)) return res.status(422).json({ error: 'El nombre del idioma va entre 2 y 40 caracteres' });
  const cfg = await config();
  if (code === cfg.base) return res.status(422).json({ error: 'Ese ya es el idioma original del sitio' });
  if ((await db.find('langs', l => l.code === code)).length) return res.status(409).json({ error: 'Ese idioma ya está cargado' });
  res.status(201).json(await db.insert('langs', { code, nombre: String(req.body.nombre).trim(), active: false }));
});

// PUT /api/traducciones/admin/idiomas/:id — publicar o despublicar un idioma (solo admin).
// Un idioma a medio traducir publicado es peor que no tenerlo: por eso arranca apagado.
router.put('/admin/idiomas/:id', requireAdmin, async (req, res) => {
  const l = await db.get('langs', req.params.id);
  if (!l) return res.status(404).json({ error: 'Idioma inexistente' });
  const patch = {};
  if (req.body.active !== undefined) patch.active = !!req.body.active;
  if (req.body.nombre !== undefined) {
    if (!str(req.body.nombre, 2, 40)) return res.status(422).json({ error: 'El nombre del idioma va entre 2 y 40 caracteres' });
    patch.nombre = String(req.body.nombre).trim();
  }
  res.json(await db.update('langs', l.id, patch));
});

// DELETE /api/traducciones/admin/idiomas/:id — saca el idioma y sus traducciones (solo admin)
router.delete('/admin/idiomas/:id', requireAdmin, async (req, res) => {
  const l = await db.get('langs', req.params.id);
  if (!l) return res.status(404).json({ error: 'Idioma inexistente' });
  for (const k of await db.all('i18nkeys')) {
    if (!k.trad || k.trad[l.code] === undefined) continue;
    const trad = { ...k.trad };
    delete trad[l.code];
    await db.update('i18nkeys', k.id, { trad });
  }
  await db.remove('langs', l.id);
  res.json({ ok: true });
});

// PUT /api/traducciones/admin/config — interruptor de captura (solo admin)
router.put('/admin/config', requireAdmin, async (req, res) => {
  const cfg = await config();
  const patch = {};
  if (req.body.captura !== undefined) patch.captura = !!req.body.captura;
  res.json(await db.update('i18ncfg', cfg.id, patch));
});

// PUT /api/traducciones/admin/claves/:id — guarda las traducciones de una frase (solo admin)
router.put('/admin/claves/:id', requireAdmin, async (req, res) => {
  const k = await db.get('i18nkeys', req.params.id);
  if (!k) return res.status(404).json({ error: 'Frase inexistente' });
  const entrada = req.body.trad;
  if (!entrada || typeof entrada !== 'object') return res.status(422).json({ error: 'Faltan las traducciones' });
  const validos = (await idiomas()).map(l => l.code);
  const trad = { ...(k.trad || {}) };
  for (const [code, valor] of Object.entries(entrada)) {
    // Solo idiomas cargados: un código suelto en el cuerpo no puede crear un idioma fantasma
    if (!validos.includes(code)) continue;
    const t = String(valor == null ? '' : valor).slice(0, MAX_LARGO * 2).trim();
    if (t) trad[code] = t; else delete trad[code];
  }
  res.json(await db.update('i18nkeys', k.id, { trad }));
});

// DELETE /api/traducciones/admin/claves/:id — saca una frase del diccionario (solo admin)
router.delete('/admin/claves/:id', requireAdmin, async (req, res) => {
  const k = await db.get('i18nkeys', req.params.id);
  if (!k) return res.status(404).json({ error: 'Frase inexistente' });
  await db.remove('i18nkeys', k.id);
  res.json({ ok: true });
});

/* ---------- Captura de textos y diccionario por idioma ---------- */

// POST /api/traducciones/textos — el sitio avisa qué frases aparecieron en pantalla. Público
// por necesidad (lo manda el navegador de cualquier visita) y por eso con topes en todo:
// cuántas frases por pedido, cuánto mide cada una y cuántas puede tener el diccionario entero.
router.post('/textos', async (req, res) => {
  const cfg = await config();
  if (cfg.captura === false) return res.json({ ok: true, nuevas: 0, captura: false });
  const textos = Array.isArray(req.body.textos) ? req.body.textos.slice(0, MAX_POR_PEDIDO) : [];
  const claves = await db.all('i18nkeys');
  const porTexto = new Map(claves.map(k => [k.texto, k]));
  let nuevas = 0;
  let total = claves.length;
  for (const bruto of textos) {
    const texto = String(bruto == null ? '' : bruto).trim();
    if (texto.length < 2 || texto.length > MAX_LARGO) continue;
    // Los números sueltos, los precios y las fechas no se traducen. El filtro está también en el
    // navegador, pero se repite acá porque este endpoint es público: lo que decide qué entra al
    // diccionario tiene que ser el servidor, no la buena voluntad de quien manda el pedido.
    if (SOLO_NUMEROS.test(texto)) continue;
    const previo = porTexto.get(texto);
    if (previo) {
      // Se cuenta en cuántas visitas apareció: el panel ordena por eso, así lo más visible
      // se traduce primero.
      await db.update('i18nkeys', previo.id, { hits: (previo.hits || 0) + 1 });
      continue;
    }
    if (total >= MAX_CLAVES) break;
    const fila = await db.insert('i18nkeys', { texto, trad: {}, hits: 1 });
    porTexto.set(texto, fila);
    total++;
    nuevas++;
  }
  res.json({ ok: true, nuevas });
});

// GET /api/traducciones/:code — el diccionario de un idioma, listo para aplicar (público).
// Va al final para no tapar /admin ni /textos.
router.get('/:code', async (req, res) => {
  const code = String(req.params.code || '').trim();
  const l = (await db.find('langs', x => x.code === code))[0];
  if (!l || l.active === false) return res.status(404).json({ error: 'Idioma no disponible' });
  const dict = {};
  for (const k of await db.all('i18nkeys')) {
    const t = k.trad && k.trad[code];
    if (t) dict[k.texto] = t;
  }
  res.json({ code, nombre: l.nombre, dict });
});

module.exports = router;
`,
  }),
  pages: () => ({
    'idiomas-admin': {
      title: 'Idiomas',
      html: `  <section>
    <div class="container" style="max-width:1000px">
      <h2>Idiomas del sitio</h2>
      <p class="section-sub">Agregá los idiomas en los que querés mostrar el sitio y traducí las frases que ya aparecieron en pantalla. Los cambios se ven al instante, sin volver a exportar el proyecto. Solo visible para administradores.</p>
      <div class="tr-kpis" id="tr-kpis"></div>

      <div class="card">
        <h3 style="margin-top:0">Idiomas</h3>
        <div id="tr-idiomas"><p class="muted">Cargando…</p></div>
        <form id="tr-idioma-form" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
          <input name="code" placeholder="en" maxlength="7" required style="flex:0 1 110px">
          <input name="nombre" placeholder="Inglés" maxlength="40" required style="flex:1 1 180px">
          <button class="btn" type="submit">Agregar idioma</button>
        </form>
        <p class="muted" style="font-size:.82rem;margin:10px 0 0">Un idioma arranca sin publicar: aparece en el selector recién cuando vos lo prendés. Un sitio a medio traducir es peor que un sitio en un solo idioma.</p>
      </div>

      <div class="card" style="margin-top:18px">
        <h3 style="margin-top:0">Detección de textos</h3>
        <p class="muted" style="margin:0 0 12px;font-size:.9rem">Mientras esté prendida, cada página que alguien visita le avisa al servidor qué frases mostró, y acá abajo aparecen listas para traducir. Apagala cuando ya esté todo relevado.</p>
        <label style="display:flex;align-items:center;gap:10px;font-weight:400"><input type="checkbox" id="tr-captura" style="width:auto"> Detectar automáticamente los textos del sitio</label>
      </div>

      <h3 style="margin-top:30px">Frases</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input id="tr-buscar" placeholder="Buscar una frase…" style="flex:1 1 220px">
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin:0"><input type="checkbox" id="tr-solo-falta" style="width:auto"> Solo las que faltan</label>
        <button class="btn ghost" type="button" id="tr-csv">CSV</button>
      </div>
      <div class="tr-lista" id="tr-claves"></div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo multiidioma administrable: en TODAS las páginas aplica el diccionario del idioma
   elegido (traído del servidor) sobre los textos de la página y, si la detección está prendida,
   le avisa al servidor qué frases aparecieron. El panel solo-admin vive en /idiomas-admin.html.
   Animado con Anime.js (count-up, barras de avance) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var navTr = document.getElementById('nav-tr-admin');
  if (navTr && (!me || me.role !== 'admin') && !window.__PREVIEW__) navTr.style.display = 'none';

  /* ---------- Cara pública: selector y aplicación del diccionario ---------- */
  var boton = document.getElementById('tr-lang');
  // Si el módulo UI "Multiidioma ES/EN" también está activo, su selector se esconde: los dos
  // traducen por texto original y se pisarían. Manda el administrable, que es el que tiene datos.
  var viejo = document.getElementById('lang-toggle');
  if (viejo && boton) viejo.style.display = 'none';

  var guardado = { get: function () { try { return localStorage.getItem('lang'); } catch (e) { return null; } },
                   set: function (v) { try { localStorage.setItem('lang', v); } catch (e) {} } };

  // Los textos originales se guardan la primera vez que se traduce un nodo, así volver al idioma
  // del sitio es restaurar y no "traducir al revés" (que perdería los acentos y las mayúsculas).
  var nodos = [];
  function recolectar() {
    if (nodos.length) return nodos;
    var it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        // Ni scripts ni estilos ni el propio selector de idioma ni bloques de código
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        if (p.id === 'tr-lang' || p.closest && p.closest('.tr-menu')) return NodeFilter.FILTER_REJECT;
        var t = n.nodeValue.trim();
        return (t.length >= 2 && t.length <= 220) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    var n;
    while ((n = it.nextNode())) nodos.push({ nodo: n, original: n.nodeValue });
    return nodos;
  }

  function aplicar(dict) {
    recolectar().forEach(function (x) {
      var base = x.original.trim();
      var t = dict && dict[base];
      // Se conserva el espaciado original alrededor del texto: sin esto, dos palabras seguidas
      // en HTML se pegan al traducir.
      x.nodo.nodeValue = t ? x.original.replace(base, t) : x.original;
    });
  }

  function pintarBoton(code, idiomas) {
    if (!boton) return;
    boton.textContent = code.toUpperCase();
    boton.setAttribute('aria-label', 'Cambiar idioma');
    boton.style.display = (idiomas.length ? '' : 'none');
  }

  var estado = { base: 'es', idiomas: [], actual: 'es' };

  async function cambiar(code) {
    estado.actual = code;
    guardado.set(code);
    document.documentElement.lang = code;
    if (boton) boton.textContent = code.toUpperCase();
    if (code === estado.base) { aplicar(null); return; }
    try {
      var r = await fetch('/api/traducciones/' + encodeURIComponent(code));
      if (!r.ok) throw new Error('idioma no disponible');
      var d = await r.json();
      aplicar(d.dict);
    } catch (e) { aplicar(null); }
  }

  function menu() {
    var previo = document.querySelector('.tr-menu');
    if (previo) { previo.remove(); return; }
    var caja = document.createElement('div');
    caja.className = 'tr-menu';
    caja.setAttribute('role', 'menu');
    var opciones = [{ code: estado.base, nombre: 'Español' }].concat(estado.idiomas);
    caja.innerHTML = opciones.map(function (o) {
      return '<button type="button" role="menuitem" data-code="' + o.code + '"' + (o.code === estado.actual ? ' class="on"' : '') + '>' + App.esc(o.nombre) + '</button>';
    }).join('');
    var r = boton.getBoundingClientRect();
    caja.style.top = (r.bottom + window.scrollY + 6) + 'px';
    caja.style.left = Math.max(8, r.left + window.scrollX - 40) + 'px';
    document.body.appendChild(caja);
    caja.addEventListener('click', function (e) {
      var code = e.target.getAttribute && e.target.getAttribute('data-code');
      if (!code) return;
      caja.remove();
      cambiar(code);
    });
    setTimeout(function () {
      document.addEventListener('click', function cerrar(ev) {
        if (caja.contains(ev.target) || ev.target === boton) return;
        caja.remove();
        document.removeEventListener('click', cerrar);
      });
    }, 0);
  }

  // Detección de textos: se manda una sola vez por página y por día. Sin ese recuerdo, cada
  // visita repetiría el mismo pedido sin agregar nada nuevo.
  function detectar() {
    // Las páginas de trastienda no se detectan: nadie traduce su propio panel de administración,
    // y sus textos taparían los del sitio que sí ve el público.
    if (/-admin\\.html$/.test(location.pathname) || location.pathname === '/auth.html') return;
    var hoy = new Date().toISOString().slice(0, 10);
    var marca = 'tr-visto:' + location.pathname + ':' + hoy;
    try { if (localStorage.getItem(marca)) return; localStorage.setItem(marca, '1'); } catch (e) {}
    var vistos = {};
    var textos = [];
    recolectar().forEach(function (x) {
      var t = x.original.trim();
      if (!t || vistos[t] || textos.length >= 60) return;
      // Los números sueltos, los precios y las fechas no se traducen
      if (/^[\\d\\s$.,:/%+-]+$/.test(t)) return;
      // Lo que está escondido no se detecta: si el sitio tiene apagado un módulo o un panel que
      // esta persona no puede ver, esos textos ensuciarían la lista de lo que hay que traducir.
      var p = x.nodo.parentElement;
      if (!p || !p.getClientRects().length) return;
      vistos[t] = 1;
      textos.push(t);
    });
    if (!textos.length) return;
    fetch('/api/traducciones/textos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ textos: textos }),
    }).catch(function () {});
  }

  if (boton && !window.__PREVIEW__) {
    boton.addEventListener('click', function (e) { e.preventDefault(); menu(); });
    fetch('/api/traducciones').then(function (r) { return r.json(); }).then(function (d) {
      estado.base = d.base || 'es';
      estado.idiomas = d.idiomas || [];
      var elegido = guardado.get();
      estado.actual = (elegido && (elegido === estado.base || estado.idiomas.some(function (l) { return l.code === elegido; }))) ? elegido : estado.base;
      pintarBoton(estado.actual, estado.idiomas);
      if (estado.actual !== estado.base) cambiar(estado.actual);
      if (d.captura) detectar();
    }).catch(function () { if (boton) boton.style.display = 'none'; });
  } else if (boton) {
    boton.addEventListener('click', function (e) { e.preventDefault(); App.toast('Vista previa: acá se elige el idioma'); });
  }

  /* ---------- Panel del negocio ---------- */
  var kpis = document.getElementById('tr-kpis');
  if (!kpis) return;
  var cajaIdiomas = document.getElementById('tr-idiomas');
  var cajaClaves = document.getElementById('tr-claves');
  var formIdioma = document.getElementById('tr-idioma-form');
  var buscar = document.getElementById('tr-buscar');
  var soloFalta = document.getElementById('tr-solo-falta');
  var swCaptura = document.getElementById('tr-captura');
  var idiomas = [], claves = [], cfgTr = {};

  function contar(el, hasta, sufijo) {
    if (!el) return;
    var anime = window.anime;
    function fin() { el.textContent = Number(hasta).toLocaleString('es-AR') + (sufijo || ''); }
    if (!anime || !anime.animate || reduce) { fin(); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR') + (sufijo || ''); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(fin, 800);
  }

  function pintarStats() {
    var publicados = idiomas.filter(function (l) { return l.active !== false; }).length;
    var sinTraducir = claves.filter(function (k) {
      return idiomas.some(function (l) { return !(k.trad && k.trad[l.code]); });
    }).length;
    kpis.innerHTML = '<div class="card"><strong id="tr-k-idi">0</strong><span class="muted">idiomas cargados</span></div>' +
      '<div class="card"><strong id="tr-k-pub">0</strong><span class="muted">publicados</span></div>' +
      '<div class="card"><strong id="tr-k-fra">0</strong><span class="muted">frases detectadas</span></div>' +
      '<div class="card"><strong id="tr-k-fal">0</strong><span class="muted">sin terminar</span></div>';
    contar(document.getElementById('tr-k-idi'), idiomas.length);
    contar(document.getElementById('tr-k-pub'), publicados);
    contar(document.getElementById('tr-k-fra'), claves.length);
    contar(document.getElementById('tr-k-fal'), sinTraducir);
  }

  // El avance se recalcula acá con lo que ya está en memoria (el servidor manda el mismo número al
  // cargar): así se puede refrescar la barra después de guardar una frase sin volver a pedir todo
  // el diccionario ni redibujar la lista que la persona está usando.
  function calcularAvance(code) {
    var hechas = claves.filter(function (k) { return k.trad && String(k.trad[code] || '').trim(); }).length;
    return { total: claves.length, hechas: hechas, pct: claves.length ? Math.round(hechas / claves.length * 100) : 0 };
  }

  function pintarIdiomas() {
    idiomas = idiomas.map(function (l) { return Object.assign({}, l, { avance: calcularAvance(l.code) }); });
    if (!idiomas.length) {
      cajaIdiomas.innerHTML = '<p class="muted">Todavía no cargaste ningún idioma.</p>';
      return;
    }
    cajaIdiomas.innerHTML = idiomas.map(function (l) {
      return '<div class="tr-avance"><span class="n"><strong>' + App.esc(l.nombre) + '</strong><br><span class="muted" style="font-size:.78rem">' + App.esc(l.code) + '</span></span>' +
        '<span class="b"><i data-pct="' + l.avance.pct + '"></i></span>' +
        '<span class="p">' + l.avance.pct + '%</span>' +
        '<span><button class="btn ghost" type="button" data-pub="' + l.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">' + (l.active === false ? 'Publicar' : 'Despublicar') + '</button>' +
        '<button class="btn ghost" type="button" data-dell="' + l.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Quitar</button></span></div>';
    }).join('');
    cajaIdiomas.querySelectorAll('[data-pub]').forEach(function (b) { b.addEventListener('click', function () { publicar(b.getAttribute('data-pub')); }); });
    cajaIdiomas.querySelectorAll('[data-dell]').forEach(function (b) { b.addEventListener('click', function () { quitarIdioma(b.getAttribute('data-dell')); }); });

    var barras = cajaIdiomas.querySelectorAll('.b i');
    var anime = window.anime;
    function fijar() { barras.forEach(function (b) { b.style.width = b.getAttribute('data-pct') + '%'; }); }
    if (anime && anime.animate && !reduce && barras.length) {
      barras.forEach(function (b, i) {
        anime.animate(b, { width: ['0%', b.getAttribute('data-pct') + '%'], duration: 620, delay: i * 60, ease: 'outCubic' });
      });
      // Red de seguridad: deja las barras en su ancho final aunque el loop esté pausado
      setTimeout(fijar, 620 + 60 * barras.length + 200);
    } else { fijar(); }
  }

  function visibles() {
    var q = (buscar.value || '').trim().toLowerCase();
    return claves.filter(function (k) {
      if (q && k.texto.toLowerCase().indexOf(q) < 0) return false;
      if (soloFalta.checked && !idiomas.some(function (l) { return !(k.trad && k.trad[l.code]); })) return false;
      return true;
    });
  }

  function pintarClaves() {
    var filas = visibles();
    if (!idiomas.length) { cajaClaves.innerHTML = '<p class="muted">Agregá primero un idioma.</p>'; return; }
    if (!filas.length) { cajaClaves.innerHTML = '<p class="muted">No hay frases para mostrar. Navegá el sitio en otra pestaña con la detección prendida y volvé.</p>'; return; }
    cajaClaves.innerHTML = filas.slice(0, 200).map(function (k) {
      var falta = idiomas.filter(function (l) { return !(k.trad && k.trad[l.code]); }).length;
      return '<div class="tr-fila" data-id="' + k.id + '">' +
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">' +
        '<span class="tr-orig">' + App.esc(k.texto) + '</span>' +
        (falta ? '<span class="tr-falta">faltan ' + falta + '</span>' : '') + '</div>' +
        idiomas.map(function (l) {
          return '<div class="tr-campo"><label>' + App.esc(l.nombre) + '</label>' +
            '<textarea rows="1" data-code="' + App.esc(l.code) + '" maxlength="440">' + App.esc((k.trad && k.trad[l.code]) || '') + '</textarea></div>';
        }).join('') +
        '<div style="margin-top:10px"><button class="btn" type="button" data-save="' + k.id + '" style="padding:5px 14px;font-size:.85rem">Guardar</button>' +
        '<button class="btn ghost" type="button" data-delk="' + k.id + '" style="padding:5px 14px;font-size:.85rem;margin-left:8px">Quitar frase</button></div>' +
        '</div>';
    }).join('') + (filas.length > 200 ? '<p class="muted">Mostrando las 200 más vistas de ' + filas.length + '. Usá el buscador para llegar al resto.</p>' : '');
    cajaClaves.querySelectorAll('[data-save]').forEach(function (b) { b.addEventListener('click', function () { guardarClave(b.getAttribute('data-save')); }); });
    cajaClaves.querySelectorAll('[data-delk]').forEach(function (b) { b.addEventListener('click', function () { quitarClave(b.getAttribute('data-delk')); }); });
  }

  async function guardarClave(id) {
    var fila = cajaClaves.querySelector('.tr-fila[data-id="' + id + '"]');
    var trad = {};
    fila.querySelectorAll('[data-code]').forEach(function (t) { trad[t.getAttribute('data-code')] = t.value; });
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se guarda la traducción'); return; }
    try {
      var upd = await App.api('/api/traducciones/admin/claves/' + id, { method: 'PUT', body: { trad: trad } });
      claves = claves.map(function (x) { return x.id === id ? upd : x; });
      // A propósito NO se vuelve a dibujar la lista: quien traduce escribe varias frases seguidas
      // y guarda una por una; redibujar borraría todo lo tipeado y todavía sin guardar. Se
      // actualiza solo el cartelito de esta fila y las barras de avance.
      var falta = idiomas.filter(function (l) { return !(upd.trad && upd.trad[l.code]); }).length;
      var chip = fila.querySelector('.tr-falta');
      if (falta && chip) chip.textContent = 'faltan ' + falta;
      else if (falta) fila.firstChild.insertAdjacentHTML('beforeend', '<span class="tr-falta">faltan ' + falta + '</span>');
      else if (chip) chip.remove();
      pintarIdiomas();
      pintarStats();
      App.toast('Traducción guardada: ya se ve en el sitio');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function quitarClave(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se quitaría la frase'); return; }
    if (!confirm('¿Quitar esta frase del diccionario? Si vuelve a aparecer en el sitio con la detección prendida, se agrega de nuevo.')) return;
    try {
      await App.api('/api/traducciones/admin/claves/' + id, { method: 'DELETE' });
      claves = claves.filter(function (x) { return x.id !== id; });
      pintarClaves();
      pintarStats();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function publicar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se publica el idioma'); return; }
    var l = idiomas.filter(function (x) { return x.id === id; })[0];
    try {
      await App.api('/api/traducciones/admin/idiomas/' + id, { method: 'PUT', body: { active: l.active === false } });
      await recargarAvance();
      App.toast(l.active === false ? 'Idioma publicado: ya aparece en el selector' : 'Idioma despublicado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function quitarIdioma(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: se quitaría el idioma'); return; }
    if (!confirm('¿Quitar este idioma? Se borran todas sus traducciones y no se puede deshacer.')) return;
    try {
      await App.api('/api/traducciones/admin/idiomas/' + id, { method: 'DELETE' });
      await recargarAvance();
      App.toast('Idioma quitado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  formIdioma.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se agrega el idioma'); return; }
    try {
      await App.api('/api/traducciones/admin/idiomas', { method: 'POST', body: {
        code: formIdioma.querySelector('[name="code"]').value.trim(),
        nombre: formIdioma.querySelector('[name="nombre"]').value,
      } });
      formIdioma.reset();
      await recargarAvance();
      App.toast('Idioma agregado: traducí las frases y después publicalo');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  swCaptura.addEventListener('change', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se apaga la detección'); return; }
    try { cfgTr = await App.api('/api/traducciones/admin/config', { method: 'PUT', body: { captura: swCaptura.checked } }); }
    catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  buscar.addEventListener('input', pintarClaves);
  soloFalta.addEventListener('change', pintarClaves);

  document.getElementById('tr-csv').addEventListener('click', function () {
    var cabecera = ['texto'].concat(idiomas.map(function (l) { return l.code; }));
    var filas = [cabecera].concat(claves.map(function (k) {
      return [k.texto].concat(idiomas.map(function (l) { return (k.trad && k.trad[l.code]) || ''; }));
    }));
    var csv = filas.map(function (f) { return f.map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'traducciones.csv';
    a.click();
  });

  async function recargarAvance() {
    var d = await App.api('/api/traducciones/admin');
    idiomas = d.idiomas; claves = d.claves; cfgTr = d.config;
    swCaptura.checked = cfgTr.captura !== false;
    pintarStats(); pintarIdiomas(); pintarClaves();
  }

  if (window.__PREVIEW__) {
    idiomas = [
      { id: 'l1', code: 'en', nombre: 'Inglés', active: true, avance: { total: 42, hechas: 38, pct: 90 } },
      { id: 'l2', code: 'pt', nombre: 'Portugués', active: false, avance: { total: 42, hechas: 12, pct: 29 } },
    ];
    claves = [
      { id: 'k1', texto: 'Nuestros servicios', trad: { en: 'Our services' }, hits: 84 },
      { id: 'k2', texto: 'Pedí tu presupuesto sin cargo', trad: {}, hits: 61 },
    ];
    cfgTr = { captura: true };
    swCaptura.checked = true;
    pintarStats(); pintarIdiomas(); pintarClaves();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    recargarAvance().catch(function (err) { cajaClaves.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
  }
})();`,
  readmeNotes: (cfg) => [
    `**Multiidioma administrable**: entrá a \`/idiomas-admin.html\`, agregá el idioma (código \`en\`, \`pt\`, \`pt-BR\`…) y traducí. El orden importa: **primero traducí, después publicá** — un idioma arranca sin publicar a propósito, porque un sitio a medio traducir es peor que un sitio en un solo idioma. Mientras la **detección de textos** esté prendida, cada visita le avisa al servidor qué frases mostró la página, así el listado se llena solo con lo que la gente realmente ve (ordenado por cuántas veces apareció): navegá tu propio sitio una vez de punta a punta y vas a tener casi todo el diccionario. Cuando ya no aparezcan frases nuevas, apagala. Las traducciones se aplican comparando el **texto completo** de cada frase: si cambiás una palabra del original, esa frase vuelve a aparecer como pendiente.${cfg.moduleIds.includes('i18n') ? ' Tenés también el módulo **Multiidioma ES/EN** activo: los dos traducen igual y se pisarían, así que este esconde el selector del otro y manda el administrable.' : ''} Lo que **no** se traduce solo es el contenido cargado por API (productos, artículos del blog): para eso hay que cargar cada texto como frase.`,
  ],
};
