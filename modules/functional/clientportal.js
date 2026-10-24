// Portal del cliente ("Mis gestiones"): cierra el pendiente histórico "portal de clientes" anotado
// desde la 24ª. El usuario logueado entra a /portal.html y ve TODO lo suyo en un solo lugar,
// juntado por su email desde las colecciones de los módulos activos: pedidos (ordertrack),
// turnos (bookings), devoluciones (returns), garantías (warranty), reclamos (tickets),
// presupuestos (quote), cursos con su avance (cursos), tarjeta de fidelidad (loyalty) y
// comprobantes (invoices). El servidor arma las secciones SOLO de los módulos presentes en el
// proyecto (el código de los demás ni se genera) y siempre filtra por el email del token JWT:
// nadie puede ver gestiones ajenas. Cada item enlaza a su página de detalle cuando existe
// (seguimiento por código, comprobante imprimible, curso). Nota: la agenda con horarios y la
// reserva de mesa registran teléfono (no email), por eso no aparecen acá. Requiere autenticación.
// Animado con Anime.js (resumen con count-up y secciones con stagger) + red de seguridad.

// Definición de cada sección del portal: colección, módulo que la habilita y cómo se resume.
// El código de cada bloque sólo se genera si el módulo está activo en la config del Builder.
const SECCIONES = [
  {
    mod: 'ordertrack', id: 'pedidos', title: 'Mis pedidos', col: 'orders',
    code: `rows.filter(r => r.email === email).map(r => ({
      title: 'Pedido ' + r.code, sub: r.detail || '', status: r.status, href: '/seguimiento.html?code=' + encodeURIComponent(r.code), at: r.createdAt }))`,
  },
  {
    mod: 'bookings', id: 'turnos', title: 'Mis turnos', col: 'bookings',
    code: `rows.filter(r => r.email === email).map(r => ({
      title: 'Turno ' + r.date + ' ' + (r.time || ''), sub: r.notes || '', status: r.status, at: r.createdAt }))`,
  },
  {
    mod: 'returns', id: 'devoluciones', title: 'Mis devoluciones y cambios', col: 'returns',
    code: `rows.filter(r => r.email === email).map(r => ({
      title: (r.kind === 'cambio' ? 'Cambio' : 'Devolución') + ' ' + r.code, sub: r.product, status: r.status, href: '/devoluciones.html', at: r.createdAt }))`,
  },
  {
    mod: 'warranty', id: 'garantias', title: 'Mis garantías', col: 'warranties',
    code: `rows.filter(r => r.email === email).map(r => ({
      title: r.product + ' (serie ' + r.serial + ')', sub: 'Cobertura hasta ' + new Date(r.coverageEnd).toLocaleDateString('es-AR'),
      status: r.claimed ? 'reclamada' : (new Date(r.coverageEnd) >= new Date() ? 'vigente' : 'vencida'), href: '/garantia.html', at: r.createdAt }))`,
  },
  {
    mod: 'tickets', id: 'reclamos', title: 'Mis consultas y reclamos', col: 'tickets',
    code: `rows.filter(r => r.email === email).map(r => ({
      title: r.subject + ' (' + r.code + ')', sub: r.reply ? 'Con respuesta del negocio' : 'Sin respuesta todavía', status: r.status, at: r.createdAt }))`,
  },
  {
    mod: 'quote', id: 'presupuestos', title: 'Mis pedidos de presupuesto', col: 'quotes',
    code: `rows.filter(r => r.email === email).map(r => ({
      title: r.service || 'Presupuesto', sub: r.details || '', status: r.status || 'nuevo', at: r.createdAt }))`,
  },
  {
    mod: 'cursos', id: 'cursos', title: 'Mis cursos', col: 'courseprogress',
    // El avance necesita cruzar con la colección de cursos para el título y el total de lecciones
    extra: `  const cursosAll = await db.all('courses');`,
    code: `rows.filter(r => r.email === email).map(r => {
      const c = cursosAll.find(x => x.id === r.courseId);
      const total = c && Array.isArray(c.lessons) ? c.lessons.length : 0;
      const hechas = Array.isArray(r.done) ? r.done.length : 0;
      return { title: c ? c.title : 'Curso', sub: hechas + ' de ' + total + ' lecciones completadas',
        status: total && hechas >= total ? 'completado' : 'en curso', href: c ? '/cursos.html?curso=' + encodeURIComponent(c.id) : '/cursos.html', at: r.createdAt };
    })`,
  },
  {
    mod: 'loyalty', id: 'fidelidad', title: 'Mi tarjeta de fidelidad', col: 'loyaltycards',
    code: `rows.filter(r => r.email === email).map(r => ({
      title: 'Tarjeta de sellos', sub: r.stamps + ' sellos juntados · ' + (r.redemptions || 0) + ' premios canjeados', status: 'activa', at: r.createdAt }))`,
  },
  {
    mod: 'invoices', id: 'comprobantes', title: 'Mis comprobantes', col: 'invoices',
    code: `rows.filter(r => r.email === email).map(r => ({
      title: 'Comprobante ' + r.code, sub: 'Total ' + '$' + Number(r.total).toLocaleString('es-AR'), status: r.status, href: '/comprobante.html?code=' + encodeURIComponent(r.code), at: r.createdAt }))`,
  },
];

module.exports = {
  id: 'clientportal', type: 'functional', name: 'Portal del cliente',
  description: 'Portal "Mis gestiones" con backend: el usuario logueado ve en /portal.html todo lo suyo en un solo lugar — pedidos, turnos, devoluciones, garantías, reclamos, presupuestos, cursos con avance, tarjeta de fidelidad y comprobantes — juntado por su email desde los módulos activos, siempre filtrado en el servidor con el email del token (nadie ve gestiones ajenas). Cada item enlaza a su detalle. Requiere autenticación. Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/portal', file: 'routes/portal.js' }],
  collections: [],
  nav: () => [{ label: 'Mis gestiones', href: '/portal.html', id: 'nav-portal' }],
  head: () => `  <style>
    .po-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px dashed var(--line)}
    .po-item:last-child{border-bottom:0}
    .po-item small{color:var(--muted);display:block}
    .po-chip{flex-shrink:0;font-size:.72rem;font-weight:700;padding:2px 10px;border-radius:999px;background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent);text-transform:capitalize;white-space:nowrap}
    .po-empty{color:var(--muted);font-size:.9rem;margin:0}
  </style>`,
  files: (cfg) => {
    const activas = SECCIONES.filter(s => cfg.moduleIds.includes(s.mod));
    const bloques = activas.map(s => `  {
    // Sección "${s.title}" (módulo ${s.mod})
    const rows = await db.all('${s.col}');
${s.extra ? s.extra + '\n' : ''}    const items = ${s.code};
    if (items.length) secciones.push({ id: '${s.id}', title: ${JSON.stringify(s.title)}, items: items.sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))) });
  }`).join('\n');
    return {
      'routes/portal.js': `const router = require('express').Router();
const db = require('../src/db');
const { requireAuth } = require('../src/middleware/auth');

// GET /api/portal — todas las gestiones del usuario logueado, juntadas por su email.
// El filtro usa SIEMPRE el email del token (req.user), nunca un parámetro del cliente:
// es imposible pedir las gestiones de otra persona.
router.get('/', requireAuth, async (req, res) => {
  const email = String(req.user.email || '').toLowerCase();
  const secciones = [];
${bloques || `  // (ningún módulo con gestiones por email está activo en este proyecto)`}
  res.json({
    name: req.user.name || '',
    total: secciones.reduce((a, s) => a + s.items.length, 0),
    secciones,
  });
});

module.exports = router;
`,
    };
  },
  pages: () => ({
    portal: {
      title: 'Mis gestiones',
      html: `  <section>
    <div class="container" style="max-width:860px">
      <h2 id="po-hola">Mis gestiones</h2>
      <p class="section-sub">Todo lo tuyo con nosotros en un solo lugar: pedidos, turnos, consultas y más, siempre al día.</p>
      <div class="card" style="display:flex;gap:14px;align-items:baseline;margin-bottom:22px">
        <span class="price" id="po-total">0</span>
        <span class="muted">gestiones registradas con tu cuenta</span>
      </div>
      <div id="po-secciones"><p class="muted">Cargando tus gestiones…</p></div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo portal del cliente: /portal.html junta todas las gestiones del usuario logueado
   (filtradas por email en el servidor) con resumen count-up y secciones con stagger de Anime.js
   + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var box = document.getElementById('po-secciones');
  if (box) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');

    function pintar(data) {
      if (data.name) document.getElementById('po-hola').textContent = 'Hola, ' + data.name.split(' ')[0];
      // Total con count-up (con red de seguridad si la pestaña está oculta)
      var totalEl = document.getElementById('po-total');
      var anime = window.anime;
      if (anime && anime.animate && !reduce && data.total) {
        var obj = { v: 0 };
        anime.animate(obj, { v: data.total, duration: 700, ease: 'outCubic', onUpdate: function () { totalEl.textContent = Math.round(obj.v); } });
        setTimeout(function () { totalEl.textContent = data.total; }, 850);
      } else { totalEl.textContent = data.total; }

      if (!data.secciones.length) {
        box.innerHTML = '<div class="card"><p class="po-empty">Todavía no tenés gestiones registradas. Cuando hagas un pedido, saques un turno o dejes una consulta con el email de tu cuenta, van a aparecer acá.</p></div>';
        return;
      }
      box.innerHTML = data.secciones.map(function (s) {
        return '<div class="card" style="margin-bottom:18px"><h3 style="margin:0 0 8px">' + App.esc(s.title) + '</h3>' +
          s.items.map(function (it) {
            var titulo = it.href ? '<a href="' + App.esc(it.href) + '">' + App.esc(it.title) + '</a>' : App.esc(it.title);
            return '<div class="po-item"><div><strong>' + titulo + '</strong>' +
              (it.sub ? '<small>' + App.esc(it.sub) + '</small>' : '') + '</div>' +
              '<span class="po-chip">' + App.esc(it.status) + '</span></div>';
          }).join('') + '</div>';
      }).join('');
      var cards = [].slice.call(box.querySelectorAll('.card'));
      if (anime && anime.animate && !reduce && cards.length) {
        anime.animate(cards, { opacity: [0, 1], translateY: [14, 0], duration: 450, delay: anime.stagger ? anime.stagger(90) : 0, ease: 'outCubic' });
        // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
        setTimeout(function () { cards.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 1100);
      }
    }

    if (window.__PREVIEW__) {
      pintar({ name: 'Ana Pérez', total: 3, secciones: [
        { id: 'pedidos', title: 'Mis pedidos', items: [
          { title: 'Pedido OT-DEMO01', sub: 'Notebook y accesorios', status: 'en preparación', href: '#' },
        ] },
        { id: 'comprobantes', title: 'Mis comprobantes', items: [
          { title: 'Comprobante RC-DEMO01', sub: 'Total $22.000', status: 'pagado', href: '#' },
          { title: 'Comprobante RC-DEMO02', sub: 'Total $8.500', status: 'pendiente', href: '#' },
        ] },
      ] });
    } else if (!me) {
      location.href = '/auth.html';
    } else {
      App.api('/api/portal').then(pintar).catch(function (err) { box.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // El link "Mis gestiones" de la navbar sólo se muestra a usuarios logueados
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navP = document.getElementById('nav-portal');
    if (navP && !meNav && !window.__PREVIEW__) navP.style.display = 'none';
  })();
})();`,
  readmeNotes: (cfg) => {
    const activos = SECCIONES.filter(s => cfg.moduleIds.includes(s.mod)).map(s => s.title.replace('Mis ', '').replace('Mi ', ''));
    return [
      `**Portal del cliente**: \`/portal.html\` junta todas las gestiones del usuario logueado filtrando por el email de su token (el filtro corre en el servidor: nadie puede ver gestiones ajenas). ${activos.length ? `En este proyecto muestra: ${activos.join(', ')}.` : 'En este proyecto no hay módulos con gestiones por email todavía: el portal mostrará el estado vacío.'} Las gestiones hechas con un email distinto al de la cuenta no se asocian. La agenda con horarios y la reserva de mesa registran teléfono (no email), por eso no aparecen en el portal.`,
    ];
  },
};
