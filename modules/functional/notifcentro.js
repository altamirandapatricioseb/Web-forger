// Centro de novedades del administrador con backend real: una campanita en la navbar (solo
// visible para admins) muestra en vivo CUÁNTOS pendientes reales hay en todo el sitio — postulaciones
// nuevas, llamadas sin contactar, testimonios por moderar, mensajes de chat sin leer, comandas
// recibidas… — sumando las fuentes de los módulos activos, que el Builder resuelve al generar el
// proyecto (igual que el buscador global): si mañana activás otro módulo con bandeja, regenerás y
// la campanita lo cuenta. El total se refresca solo por sondeo liviano y la página
// /novedades-admin.html desglosa cada fuente con su contador animado y el enlace directo a su
// panel: el admin entra a UN lugar y sabe qué tiene que atender, sin recorrer diez paneles.
// Animado con Anime.js (count-up, stagger, pulso de la campanita al subir el total) + red de
// seguridad. Requiere autenticación: el resumen es solo-admin (401 sin token).

// Fuentes de pendientes disponibles: cada una existe solo si su módulo está seleccionado.
// campo/valor = qué filas cuentan como "pendiente"; def = valor asumido si la fila no trae el
// campo (filas viejas); negado = cuenta las filas donde el campo es falsy; y = condición extra.
const FUENTES_POSIBLES = [
  { mod: 'vacantes', col: 'jobapplicants', campo: 'status', valor: 'nuevo', label: 'Postulaciones nuevas', href: '/vacantes-admin.html' },
  { mod: 'callback', col: 'callbacks', campo: 'status', valor: 'pendiente', label: 'Llamadas por hacer', href: '/llamadas.html' },
  { mod: 'usertestimonials', col: 'testimonials', campo: 'status', valor: 'pending', label: 'Testimonios por moderar', href: '/testimonios-admin.html' },
  { mod: 'quotesadmin', col: 'quotes', campo: 'status', valor: 'nuevo', def: 'nuevo', label: 'Presupuestos sin cotizar', href: '/presupuestos.html' },
  { mod: 'jobsadmin', col: 'applications', campo: 'status', valor: 'nuevo', def: 'nuevo', label: 'Postulaciones (form estático)', href: '/postulaciones.html' },
  { mod: 'returns', col: 'returns', campo: 'status', valor: 'solicitada', label: 'Devoluciones solicitadas', href: '/devoluciones.html' },
  { mod: 'reservamesa', col: 'tablebookings', campo: 'status', valor: 'pendiente', label: 'Reservas de mesa por confirmar', href: '/mesas-admin.html' },
  { mod: 'agenda', col: 'agbookings', campo: 'status', valor: 'pendiente', label: 'Turnos por confirmar', href: '/agenda-admin.html' },
  { mod: 'qanda', col: 'questions', campo: 'answer', negado: true, label: 'Preguntas sin responder', href: '/preguntas.html' },
  { mod: 'livechat', col: 'chatmessages', campo: 'seen', negado: true, y: { campo: 'from', valor: 'visitor' }, label: 'Mensajes de chat sin leer', href: '/chat-admin.html' },
  { mod: 'tickets', col: 'tickets', campo: 'status', valor: 'abierto', label: 'Reclamos abiertos', href: '/soporte.html' },
  { mod: 'profesionales', col: 'prorequests', campo: 'status', valor: 'nuevo', label: 'Consultas a profesionales', href: '/profesionales-admin.html' },
  { mod: 'pedidoscarta', col: 'foodorders', campo: 'status', valor: 'recibido', label: 'Comandas recibidas', href: '/comandas.html' },
];

module.exports = {
  id: 'notifcentro', type: 'functional', name: 'Centro de novedades del admin',
  description: 'Campanita en la navbar (solo admins) con el total en vivo de pendientes reales de todos los módulos activos (postulaciones nuevas, llamadas por hacer, testimonios por moderar, chat sin leer…) y página /novedades-admin.html que desglosa cada fuente con enlace directo a su panel. Las fuentes se resuelven al generar según los módulos elegidos. Sondeo liviano + Anime.js. Requiere Autenticación.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/notifs', file: 'routes/notifcentro.js' }],
  nav: () => [{ label: 'Novedades', href: '/novedades-admin.html', id: 'nav-notif-admin', badge: 'nc-badge' }],
  head: () => `  <style>
    #nc-badge{display:none}
    #nc-badge.on{display:inline-block}
    .nc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
    .nc-item{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:var(--text)}
    .nc-item strong{font-size:1.9rem;font-variant-numeric:tabular-nums;line-height:1}
    .nc-item .muted{font-size:.9rem}
    .nc-item .nc-ir{color:var(--accent);font-size:.85rem;font-weight:600;margin-top:auto}
    .nc-item.cero strong{color:var(--muted)}
    .nc-total{font-size:.95rem;color:var(--muted);margin:0 0 22px}
    .nc-total strong{color:var(--accent)}
  </style>`,
  files: (cfg) => {
    // Solo las fuentes cuyos módulos están seleccionados en este proyecto
    const fuentes = FUENTES_POSIBLES.filter(f => cfg.moduleIds.includes(f.mod)).map(({ mod, ...resto }) => resto);
    return {
      'routes/notifcentro.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');

// Fuentes de pendientes de ESTE proyecto (resueltas por el Builder según los módulos activos)
const FUENTES = ${JSON.stringify(fuentes, null, 2)};

// ¿Esta fila cuenta como pendiente según la fuente?
function pendiente(r, f) {
  if (f.y && r[f.y.campo] !== f.y.valor) return false;
  const v = r[f.campo] !== undefined ? r[f.campo] : f.def;
  return f.negado ? !v : v === f.valor;
}

// GET /api/notifs/admin/summary — total y desglose de pendientes por módulo (solo admin)
router.get('/admin/summary', requireAdmin, async (req, res) => {
  const items = [];
  let total = 0;
  for (const f of FUENTES) {
    const count = (await db.all(f.col)).filter(r => pendiente(r, f)).length;
    total += count;
    items.push({ label: f.label, href: f.href, count });
  }
  res.json({ total, items });
});

module.exports = router;
`,
    };
  },
  pages: () => ({
    'novedades-admin': {
      title: 'Novedades',
      html: `  <section>
    <div class="container" style="max-width:920px">
      <h2>Novedades</h2>
      <p class="section-sub">Todo lo que espera tu atención, en un solo lugar: cada tarjeta te lleva directo al panel donde se resuelve. Solo visible para administradores.</p>
      <p class="nc-total" id="nc-total" hidden></p>
      <div class="nc-grid" id="nc-grid"><p class="muted">Cargando…</p></div>
      <noscript><p class="muted">Activá JavaScript para ver las novedades.</p></noscript>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo centro de novedades: campanita con total de pendientes en la navbar (solo admin,
   sondeo liviano) y desglose con enlaces en /novedades-admin.html. Animado con Anime.js
   (count-up, stagger, pulso del badge) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var navN = document.getElementById('nav-notif-admin');
  var badge = document.getElementById('nc-badge');
  var esAdmin = me && me.role === 'admin';

  // El link (y todo el sondeo) existe solo para administradores
  if (navN && !esAdmin && !window.__PREVIEW__) { navN.style.display = 'none'; return; }

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = Number(hasta).toLocaleString('es-AR'); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR'); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = Number(hasta).toLocaleString('es-AR'); }, 800);
  }

  // ---- Badge de la navbar (todas las páginas) ----
  var ultimoTotal = -1;
  function pintarBadge(total) {
    if (!badge) return;
    badge.textContent = total > 99 ? '99+' : String(total);
    badge.classList.toggle('on', total > 0);
    var anime = window.anime;
    if (total > ultimoTotal && ultimoTotal >= 0 && anime && anime.animate && !reduce) {
      // Pulso al subir el total: hay algo nuevo desde la última mirada
      anime.animate(badge, { scale: [1, 1.35, 1], duration: 420, ease: 'outBack' });
      setTimeout(function () { badge.style.transform = 'none'; }, 800);
    }
    ultimoTotal = total;
  }

  function sondear() {
    App.api('/api/notifs/admin/summary').then(function (s) {
      pintarBadge(s.total);
      if (grid) pintarGrid(s);
    }).catch(function () {});
  }

  // ---- Página /novedades-admin.html ----
  var grid = document.getElementById('nc-grid');
  var totalBox = document.getElementById('nc-total');

  function pintarGrid(s) {
    totalBox.hidden = false;
    totalBox.innerHTML = s.total
      ? 'Tenés <strong>' + s.total + '</strong> ' + (s.total === 1 ? 'pendiente' : 'pendientes') + ' en total.'
      : 'Estás al día: no hay pendientes ahora mismo.';
    if (!s.items.length) { grid.innerHTML = '<p class="muted">Ningún módulo con bandeja de pendientes está activo en este sitio.</p>'; return; }
    grid.innerHTML = s.items.map(function (it, i) {
      return '<a class="card nc-item' + (it.count ? '' : ' cero') + '" href="' + App.esc(it.href) + '">' +
        '<strong id="nc-c-' + i + '">0</strong>' +
        '<span class="muted">' + App.esc(it.label) + '</span>' +
        '<span class="nc-ir">' + (it.count ? 'Atender ahora' : 'Ver panel') + '</span></a>';
    }).join('');
    s.items.forEach(function (it, i) { contar(document.getElementById('nc-c-' + i), it.count); });
    var anime = window.anime;
    var cards = grid.querySelectorAll('.nc-item');
    if (anime && anime.animate && !reduce && cards.length) {
      anime.animate(cards, { opacity: [0, 1], translateY: [12, 0], duration: 420, delay: anime.stagger(60), ease: 'outCubic' });
      // Red de seguridad: deja todo visible aunque el loop esté pausado
      setTimeout(function () { cards.forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; }); }, 1400);
    }
  }

  if (window.__PREVIEW__) {
    if (grid) {
      pintarGrid({ total: 7, items: [
        { label: 'Postulaciones nuevas', href: '#', count: 3 },
        { label: 'Llamadas por hacer', href: '#', count: 2 },
        { label: 'Testimonios por moderar', href: '#', count: 2 },
        { label: 'Reclamos abiertos', href: '#', count: 0 },
      ] });
    }
    pintarBadge(7);
    return;
  }
  if (grid && !esAdmin) { location.href = '/auth.html'; return; }
  if (!esAdmin) return;

  sondear();
  // Sondeo liviano: cada 60 segundos, solo con la pestaña visible
  setInterval(function () { if (!document.hidden) sondear(); }, 60000);
})();`,
  readmeNotes: (cfg) => {
    const activas = FUENTES_POSIBLES.filter(f => cfg.moduleIds.includes(f.mod)).map(f => f.label.toLowerCase());
    return [
      `**Centro de novedades**: la campanita "Novedades" de la navbar (solo administradores) suma los pendientes reales de los módulos activos${activas.length ? ` — ${activas.join(', ')} —` : ''} y \`/novedades-admin.html\` los desglosa con enlace directo a cada panel. ${activas.length ? 'El total baja solo a medida que atendés cada bandeja desde su panel.' : 'Ahora mismo ningún módulo con bandeja de pendientes está activo: activá módulos como Bolsa de trabajo, Solicitar llamada o Testimonios moderados y regenerá el proyecto.'}`,
    ];
  },
};
