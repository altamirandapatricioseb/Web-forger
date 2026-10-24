// Panel de control del negocio con backend real: la pantalla que contesta "¿cómo venimos?" sin
// entrar a diez paneles distintos. El catálogo ya tenía estadísticas de VISITAS (módulo stats),
// pero no tenía un lugar donde se vea el DINERO y el MOVIMIENTO del negocio junto. Acá cada
// indicador se calcula en el servidor sobre los datos reales de los módulos activos, y la lista de
// indicadores se resuelve AL GENERAR el proyecto: si el sitio no tiene punto de venta, no hay
// tarjeta de ventas del mostrador; si mañana se activa, aparece sola al regenerar. Lo que convierte
// a esto en un panel de verdad y no en una lista de números es la COMPARACIÓN: cada indicador viene
// con el mismo período inmediatamente anterior y su variación, porque "vendimos 400.000" no dice
// nada si no se sabe si el mes pasado fueron 300.000 o 600.000. La serie diaria se devuelve
// completa, con los días en cero incluidos: un gráfico que saltea los días vacíos miente sobre la
// tendencia. Página solo-admin /tablero.html con Anime.js (count-up de los indicadores, barras que
// crecen escalonadas) + red de seguridad para la pestaña oculta. Requiere Autenticación.
const { phIcon } = require('../../src/icons');

// Indicadores posibles: cada uno existe sólo si su módulo está seleccionado.
// tipo: 'suma' (acumula `campo`) | 'conteo' (cuenta filas)
// fecha: qué campo de la fila define el día (se recorta a los primeros 10 caracteres: YYYY-MM-DD)
// filtro: {campo, valor} para quedarse sólo con ciertas filas (ingresos vs egresos, pagos, etc.)
// formato: 'money' | 'num' | 'horas'
const METRICAS_POSIBLES = [
  { id: 'pos-ventas', mod: 'pos', col: 'sales', tipo: 'suma', campo: 'total', fecha: 'createdAt', formato: 'money', label: 'Ventas del mostrador', href: '/pos.html' },
  { id: 'cart-ventas', mod: 'cart', col: 'orders', tipo: 'suma', campo: 'total', fecha: 'createdAt', formato: 'money', label: 'Ventas online', href: '/tienda.html' },
  { id: 'carta-pedidos', mod: 'pedidoscarta', col: 'foodorders', tipo: 'suma', campo: 'total', fecha: 'createdAt', formato: 'money', label: 'Pedidos de la carta', href: '/comandas.html' },
  { id: 'invoices-total', mod: 'invoices', col: 'invoices', tipo: 'suma', campo: 'total', fecha: 'createdAt', formato: 'money', label: 'Comprobantes emitidos', href: '/comprobantes-admin.html' },
  { id: 'caja-ingresos', mod: 'caja', col: 'cashmoves', tipo: 'suma', campo: 'amount', fecha: 'date', filtro: { campo: 'kind', valor: 'ingreso' }, formato: 'money', label: 'Ingresos de caja', href: '/caja-admin.html' },
  { id: 'caja-egresos', mod: 'caja', col: 'cashmoves', tipo: 'suma', campo: 'amount', fecha: 'date', filtro: { campo: 'kind', valor: 'egreso' }, formato: 'money', label: 'Egresos de caja', href: '/caja-admin.html' },
  { id: 'ctacte-cobrado', mod: 'ctacte', col: 'ctamoves', tipo: 'suma', campo: 'amount', fecha: 'date', filtro: { campo: 'kind', valor: 'pago' }, formato: 'money', label: 'Cobrado en cuenta corriente', href: '/ctacte-admin.html' },
  { id: 'compras-total', mod: 'compras', col: 'purchases', tipo: 'suma', campo: 'total', fecha: 'createdAt', formato: 'money', label: 'Compras a proveedores', href: '/compras-admin.html' },
  { id: 'venc-pagado', mod: 'vencimientos', col: 'duebills', tipo: 'suma', campo: 'paidAmount', fecha: 'paidAt', filtro: { campo: 'status', valor: 'pagado' }, formato: 'money', label: 'Vencimientos pagados', href: '/vencimientos.html' },
  { id: 'cotiza-total', mod: 'presupuestador', col: 'calcquotes', tipo: 'suma', campo: 'total', fecha: 'createdAt', formato: 'money', label: 'Cotizado online', href: '/cotizador-admin.html' },
  { id: 'donaciones', mod: 'donations', col: 'donations', tipo: 'suma', campo: 'amount', fecha: 'createdAt', formato: 'money', label: 'Aportes recibidos', href: '/index.html' },
  { id: 'personal-horas', mod: 'personal', col: 'shifts', tipo: 'suma', campo: 'minutes', fecha: 'date', formato: 'horas', label: 'Horas trabajadas', href: '/personal-admin.html' },
  { id: 'leads-nuevos', mod: 'leads', col: 'leads', tipo: 'conteo', fecha: 'createdAt', formato: 'num', label: 'Contactos captados', href: '/index.html' },
  { id: 'newsletter-altas', mod: 'newsletter', col: 'subscribers', tipo: 'conteo', fecha: 'createdAt', formato: 'num', label: 'Suscriptores nuevos', href: '/index.html' },
  { id: 'clientes-altas', mod: 'clientes', col: 'customers', tipo: 'conteo', fecha: 'createdAt', formato: 'num', label: 'Fichas de cliente nuevas', href: '/clientes-admin.html' },
  { id: 'agenda-turnos', mod: 'agenda', col: 'agbookings', tipo: 'conteo', fecha: 'createdAt', formato: 'num', label: 'Turnos reservados', href: '/agenda-admin.html' },
  { id: 'mesas', mod: 'reservamesa', col: 'tablebookings', tipo: 'conteo', fecha: 'createdAt', formato: 'num', label: 'Reservas de mesa', href: '/mesas-admin.html' },
  { id: 'tickets', mod: 'tickets', col: 'tickets', tipo: 'conteo', fecha: 'createdAt', formato: 'num', label: 'Reclamos recibidos', href: '/soporte.html' },
  { id: 'callbacks', mod: 'callback', col: 'callbacks', tipo: 'conteo', fecha: 'createdAt', formato: 'num', label: 'Pedidos de llamada', href: '/llamadas.html' },
  { id: 'presupuestos', mod: 'quotesadmin', col: 'quotes', tipo: 'conteo', fecha: 'createdAt', formato: 'num', label: 'Pedidos de presupuesto', href: '/presupuestos.html' },
  { id: 'postulaciones', mod: 'vacantes', col: 'jobapplicants', tipo: 'conteo', fecha: 'createdAt', formato: 'num', label: 'Postulaciones', href: '/vacantes-admin.html' },
  { id: 'socios', mod: 'membership', col: 'members', tipo: 'conteo', fecha: 'createdAt', formato: 'num', label: 'Socios nuevos', href: '/socios-admin.html' },
  { id: 'inscripciones', mod: 'eventregister', col: 'eventregistrations', tipo: 'conteo', fecha: 'createdAt', formato: 'num', label: 'Inscripciones a eventos', href: '/index.html' },
  { id: 'tareas-hechas', mod: 'trabajo', col: 'worktasks', tipo: 'conteo', fecha: 'completedAt', filtro: { campo: 'status', valor: 'hecha' }, formato: 'num', label: 'Tareas terminadas', href: '/trabajo.html' },
];

module.exports = {
  id: 'tablero', type: 'functional', name: 'Panel de control del negocio',
  description: 'La pantalla que contesta "¿cómo venimos?" sin entrar a diez paneles: /tablero.html reúne los indicadores reales de los módulos activos (ventas del mostrador y online, ingresos y egresos de caja, cobranzas, compras, contactos captados, turnos, reclamos, horas trabajadas…) calculados en el servidor sobre los datos de verdad. Cada indicador viene con el mismo período anterior y su variación, porque un número solo no dice si el negocio sube o baja, y la serie diaria incluye los días en cero para no mentir sobre la tendencia. La lista de indicadores se arma al generar según los módulos elegidos. Gráfico y KPIs animados con Anime.js. Solo admin. Requiere Autenticación. Distinto de "Estadísticas de visitas", que mide tráfico del sitio.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/tablero', file: 'routes/tablero.js' }],
  nav: () => [{ label: 'Tablero de control', href: '/tablero.html', id: 'nav-tablero' }],
  head: () => `  <style>
    .tc-periodo{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
    .tc-periodo button{padding:7px 16px;font-size:.85rem}
    .tc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:16px;margin-bottom:30px}
    .tc-kpi{cursor:pointer;text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:var(--radius);padding:16px 18px;width:100%;font:inherit;color:inherit}
    .tc-kpi.sel{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 22%,transparent)}
    .tc-kpi .tc-label{display:block;font-size:.82rem;color:var(--muted);margin-bottom:6px}
    .tc-kpi strong{font-size:1.55rem;font-variant-numeric:tabular-nums;line-height:1.1;display:block}
    .tc-var{display:inline-block;font-size:.75rem;font-weight:700;margin-top:8px}
    .tc-var.sube{color:#1d6b3c}
    .tc-var.baja{color:#c0392b}
    .tc-var.igual{color:var(--muted)}
    .tc-chart{display:flex;align-items:flex-end;gap:5px;height:170px;padding:10px 0 0}
    .tc-bar{flex:1;background:var(--accent);border-radius:4px 4px 0 0;min-height:2px;position:relative;opacity:.88}
    .tc-bar:hover{opacity:1}
    .tc-bar span{position:absolute;bottom:-22px;left:0;right:0;text-align:center;font-size:.62rem;color:var(--muted)}
    .tc-chart-wrap{padding-bottom:26px}
    .tc-total-serie{font-size:.85rem;color:var(--muted);margin:0 0 4px}
  </style>`,
  pages: () => ({
    'tablero': {
      title: 'Tablero de control',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('chart-line-up', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Tablero de control</h2>
      <p class="section-sub">Cómo viene el negocio. Cada número lo calcula el servidor con los datos reales y se compara con el mismo período anterior.</p>
      <div class="tc-periodo">
        <button class="btn ghost" type="button" data-tc-dias="7">Últimos 7 días</button>
        <button class="btn" type="button" data-tc-dias="30">Últimos 30 días</button>
        <button class="btn ghost" type="button" data-tc-dias="90">Últimos 90 días</button>
      </div>
      <div id="tc-grid" class="tc-grid"><p class="muted">Cargando…</p></div>
      <div class="card tc-chart-wrap" id="tc-serie-box" style="display:none">
        <h3 id="tc-serie-titulo" style="margin-top:0"></h3>
        <p class="tc-total-serie" id="tc-serie-sub"></p>
        <div class="tc-chart" id="tc-chart"></div>
      </div>
    </div>
  </section>`,
    },
  }),
  files: (cfg) => {
    const metricas = METRICAS_POSIBLES.filter(m => cfg.moduleIds.includes(m.mod)).map(({ mod, ...resto }) => resto);
    return {
      'routes/tablero.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');

// Indicadores de ESTE proyecto (los resolvió el Builder según los módulos activos)
const METRICAS = ${JSON.stringify(metricas, null, 2)};

const DIAS_VALIDOS = [7, 30, 90];
const dia = (d) => d.toISOString().slice(0, 10);
// El día de una fila: el campo declarado, recortado a YYYY-MM-DD (sirve igual para
// una fecha suelta y para un timestamp ISO completo)
const diaDe = (row, m) => String(row[m.fecha] || '').slice(0, 10);

// Lista de días consecutivos hacia atrás, incluido hoy
function ventana(dias, desplazamiento = 0) {
  const out = [];
  const base = Date.now() - desplazamiento * 86400000;
  for (let i = dias - 1; i >= 0; i--) out.push(dia(new Date(base - i * 86400000)));
  return out;
}

function valorDe(rows, m, dias) {
  if (m.tipo === 'conteo') return rows.length;
  const t = rows.reduce((s, r) => s + (Number(r[m.campo]) || 0), 0);
  return Math.round(t * 100) / 100;
}

// Filas de una métrica que caen dentro de un conjunto de días
function enRango(todas, m, diasSet) {
  return todas.filter(r => {
    if (m.filtro && r[m.filtro.campo] !== m.filtro.valor) return false;
    const d = diaDe(r, m);
    return d && diasSet.has(d);
  });
}

// Lee cada colección una sola vez por pedido, aunque la usen varios indicadores
async function lector() {
  const cache = new Map();
  return async (col) => {
    if (!cache.has(col)) cache.set(col, await db.all(col));
    return cache.get(col);
  };
}

// GET /api/tablero/kpis?dias=30 — cada indicador con su período anterior y la variación
router.get('/kpis', requireAdmin, async (req, res) => {
  const dias = DIAS_VALIDOS.includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
  const leer = await lector();
  const actual = new Set(ventana(dias));
  const previo = new Set(ventana(dias, dias));
  const items = [];
  for (const m of METRICAS) {
    const todas = await leer(m.col);
    const valor = valorDe(enRango(todas, m, actual), m, dias);
    const antes = valorDe(enRango(todas, m, previo), m, dias);
    // Variación contra el período anterior. Sin base previa no hay porcentaje que valga:
    // "creció infinito" no es información, así que se devuelve null y la pantalla dice "nuevo".
    const variacion = antes > 0 ? Math.round(((valor - antes) / antes) * 1000) / 10 : null;
    items.push({ id: m.id, label: m.label, href: m.href, formato: m.formato, valor, antes, variacion });
  }
  res.json({ dias, items });
});

// GET /api/tablero/serie?metrica=<id>&dias=30 — serie diaria COMPLETA (los días sin
// movimiento van en cero: un gráfico que los saltea miente sobre la tendencia)
router.get('/serie', requireAdmin, async (req, res) => {
  const m = METRICAS.find(x => x.id === req.query.metrica);
  if (!m) return res.status(404).json({ error: 'Ese indicador no existe en este proyecto' });
  const dias = DIAS_VALIDOS.includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
  const fechas = ventana(dias);
  const todas = await leer1(m);
  const porDia = new Map(fechas.map(f => [f, 0]));
  for (const r of todas) {
    if (m.filtro && r[m.filtro.campo] !== m.filtro.valor) continue;
    const d = diaDe(r, m);
    if (!porDia.has(d)) continue;
    porDia.set(d, porDia.get(d) + (m.tipo === 'conteo' ? 1 : (Number(r[m.campo]) || 0)));
  }
  const puntos = fechas.map(f => ({ dia: f, valor: Math.round(porDia.get(f) * 100) / 100 }));
  res.json({
    metrica: m.id, label: m.label, formato: m.formato, dias,
    total: Math.round(puntos.reduce((s, p) => s + p.valor, 0) * 100) / 100,
    puntos,
  });
});

async function leer1(m) { return db.all(m.col); }

// GET /api/tablero/indicadores — qué mide este proyecto (útil para saber si el tablero sirve)
router.get('/indicadores', requireAdmin, async (req, res) => {
  res.json(METRICAS.map(m => ({ id: m.id, label: m.label, formato: m.formato })));
});

module.exports = router;
`,
    };
  },
  clientJs: () => `/* Módulo tablero de control: indicadores del negocio con comparación contra el período anterior y
   serie diaria del indicador elegido. Count-up y barras escalonadas con Anime.js + red de seguridad
   (con la pestaña oculta el loop no corre y las barras tienen que quedar en su alto final).
   En la vista previa del Builder simula la API. */
(function () {
  var grid = document.getElementById('tc-grid');
  if (!grid) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
    grid.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver el tablero.</p>';
    return;
  }
  var dias = 30, items = [], elegida = '';

  function formatear(v, formato) {
    if (formato === 'money') return App.money(Math.round(v));
    if (formato === 'horas') return Math.round(v / 60) + 'h';
    return String(Math.round(v));
  }

  function contar(el, valor, formato) {
    var pintar = function (v) { el.textContent = formatear(v, formato); };
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { pintar(valor); return; }
    var obj = { v: 0 };
    anime.animate(obj, { v: valor, duration: 750, ease: 'outCubic', onUpdate: function () { pintar(obj.v); } });
    setTimeout(function () { pintar(valor); }, 950);
  }

  function variacionHtml(it) {
    if (it.variacion === null || it.variacion === undefined) {
      return it.valor > 0 ? '<span class="tc-var igual">sin base para comparar</span>' : '<span class="tc-var igual">sin movimiento</span>';
    }
    var clase = it.variacion > 0 ? 'sube' : it.variacion < 0 ? 'baja' : 'igual';
    var signo = it.variacion > 0 ? '+' : '';
    return '<span class="tc-var ' + clase + '">' + signo + it.variacion + '% vs. período anterior</span>';
  }

  function pintarKpis() {
    if (!items.length) {
      grid.innerHTML = '<p class="muted">Este sitio todavía no tiene módulos con datos para medir. Activá módulos como Punto de venta, Caja diaria, Turnos o Captación de contactos y regenerá el proyecto.</p>';
      return;
    }
    grid.innerHTML = items.map(function (it) {
      return '<button class="tc-kpi' + (it.id === elegida ? ' sel' : '') + '" type="button" data-tc-m="' + it.id + '">' +
        '<span class="tc-label">' + App.esc(it.label) + '</span>' +
        '<strong data-tc-val="' + it.valor + '" data-tc-fmt="' + it.formato + '">0</strong>' +
        variacionHtml(it) + '</button>';
    }).join('');
    grid.querySelectorAll('[data-tc-val]').forEach(function (el) {
      contar(el, Number(el.getAttribute('data-tc-val')), el.getAttribute('data-tc-fmt'));
    });
    grid.querySelectorAll('[data-tc-m]').forEach(function (b) {
      b.addEventListener('click', function () { verSerie(b.getAttribute('data-tc-m')); });
    });
  }

  function pintarSerie(data) {
    var box = document.getElementById('tc-serie-box');
    var chart = document.getElementById('tc-chart');
    if (!box || !chart) return;
    box.style.display = '';
    document.getElementById('tc-serie-titulo').textContent = data.label;
    document.getElementById('tc-serie-sub').textContent = 'Total del período: ' + formatear(data.total, data.formato) +
      ' · ' + data.puntos.length + ' días (los días sin movimiento se muestran en cero)';
    var max = Math.max.apply(null, data.puntos.map(function (p) { return p.valor; }).concat([1]));
    // Con muchos días la etiqueta se pone cada varios: 90 rótulos no entran ni se leen
    var paso = data.puntos.length > 40 ? 7 : data.puntos.length > 14 ? 3 : 1;
    chart.innerHTML = data.puntos.map(function (p, i) {
      var alto = Math.round((p.valor / max) * 100);
      var rot = (i % paso === 0) ? '<span>' + p.dia.slice(8) + '/' + p.dia.slice(5, 7) + '</span>' : '';
      return '<div class="tc-bar" data-tc-alto="' + alto + '" style="height:0%" title="' + p.dia + ': ' + formatear(p.valor, data.formato) + '">' + rot + '</div>';
    }).join('');
    var barras = chart.querySelectorAll('.tc-bar');
    var anime = window.anime;
    var final = function () {
      barras.forEach(function (b) { b.style.height = Math.max(1, Number(b.getAttribute('data-tc-alto'))) + '%'; });
    };
    if (!anime || !anime.animate || reduce) { final(); return; }
    barras.forEach(function (b, i) {
      anime.animate(b, { height: [0, Math.max(1, Number(b.getAttribute('data-tc-alto'))) + '%'], duration: 620, delay: i * 12, ease: 'outQuad' });
    });
    // Red de seguridad: si la pestaña está oculta el loop no corre y las barras quedan en cero
    setTimeout(final, 1200);
  }

  async function verSerie(id) {
    elegida = id;
    grid.querySelectorAll('[data-tc-m]').forEach(function (b) {
      b.classList.toggle('sel', b.getAttribute('data-tc-m') === id);
    });
    if (window.__PREVIEW__) {
      var puntos = [];
      for (var i = 13; i >= 0; i--) {
        puntos.push({ dia: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), valor: Math.round(20000 + Math.sin(i) * 12000) });
      }
      pintarSerie({ label: 'Indicador de ejemplo', formato: 'money', dias: 14, total: 300000, puntos: puntos });
      return;
    }
    try { pintarSerie(await App.api('/api/tablero/serie?metrica=' + encodeURIComponent(id) + '&dias=' + dias)); }
    catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function cargar() {
    if (window.__PREVIEW__) {
      items = [
        { id: 'demo1', label: 'Ventas del mostrador', href: '#', formato: 'money', valor: 486000, antes: 402000, variacion: 20.9 },
        { id: 'demo2', label: 'Contactos captados', href: '#', formato: 'num', valor: 34, antes: 41, variacion: -17.1 },
        { id: 'demo3', label: 'Turnos reservados', href: '#', formato: 'num', valor: 58, antes: 0, variacion: null },
      ];
    } else {
      try {
        var data = await App.api('/api/tablero/kpis?dias=' + dias);
        items = data.items;
      } catch (err) {
        if (err.message !== 'preview') grid.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
        return;
      }
    }
    pintarKpis();
    if (items.length) verSerie(elegida && items.some(function (i) { return i.id === elegida; }) ? elegida : items[0].id);
  }

  document.querySelectorAll('[data-tc-dias]').forEach(function (b) {
    b.addEventListener('click', function () {
      dias = Number(b.getAttribute('data-tc-dias'));
      document.querySelectorAll('[data-tc-dias]').forEach(function (x) {
        x.className = 'btn' + (Number(x.getAttribute('data-tc-dias')) === dias ? '' : ' ghost');
      });
      cargar();
    });
  });

  cargar();
})();`,
  readmeNotes: (cfg) => {
    const activas = METRICAS_POSIBLES.filter(m => cfg.moduleIds.includes(m.mod)).map(m => m.label.toLowerCase());
    return [
      `**Tablero de control**: está en \`/tablero.html\` (solo administradores) y reúne los indicadores de los módulos activos${activas.length ? ` — ${activas.join(', ')} —` : ''} calculados en el servidor sobre los datos reales. Cada tarjeta muestra el período elegido (7, 30 o 90 días) **comparado con el período inmediatamente anterior**; cuando no hay base previa dice "sin base para comparar" en vez de inventar un porcentaje. Al tocar una tarjeta se dibuja su **serie diaria completa**, con los días sin movimiento en cero. ${activas.length ? 'La lista de indicadores se arma al generar el proyecto: si activás otro módulo medible, regenerá y aparece solo.' : 'Ahora mismo ningún módulo medible está activo: activá Punto de venta, Caja diaria, Turnos, Captación de contactos u otro y regenerá el proyecto.'} No confundir con **Estadísticas de visitas**, que mide el tráfico del sitio y no el negocio.`,
    ];
  },
};
