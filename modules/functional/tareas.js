// Tareas programadas con backend real: el DISPARADOR DIARIO que le faltaba al catálogo. Varios
// módulos venían pidiendo "algo que corra una vez por día" (saludar a los que cumplen años, avisar
// los turnos de mañana, limpiar los tokens vencidos) y hasta ahora no existía. Este módulo lo
// resuelve sin cron externo ni servicios pagos: un middleware liviano detecta el PRIMER pedido del
// día y dispara los trabajos pendientes en segundo plano (nunca demora la respuesta del visitante),
// y además expone POST /api/tareas/ejecutar protegido con una clave para engancharlo a un cron real
// (Vercel Cron, GitHub Actions, cron-job.org) cuando el sitio tiene poco tráfico. Los trabajos
// disponibles se arman AL GENERAR según los módulos activos: cada trabajo sabe qué hacer y deja su
// resultado en el historial. El panel /tareas-admin.html muestra cuándo corrió cada uno, con qué
// resultado, permite apagarlos de a uno y ejecutarlos a mano. Animado con Anime.js + red de
// seguridad. Es infraestructura: no compite con ningún módulo, los habilita.

module.exports = {
  id: 'tareas', type: 'functional', name: 'Tareas programadas',
  description: 'Disparador diario sin cron externo: un middleware detecta el primer pedido del día y ejecuta en segundo plano los trabajos automáticos de los módulos activos (saludo de cumpleaños por email, recordatorio de los turnos de mañana, limpieza de tokens vencidos, aviso de promos que vencen, resumen diario del negocio). También expone POST /api/tareas/ejecutar con clave para engancharlo a un cron real. Con auth activo, panel /tareas-admin.html con último resultado por trabajo, historial, apagado individual y ejecución manual. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/tareas', file: 'routes/tareas.js' }],
  middlewares: [{ file: 'src/middleware/tareas.js' }],
  collections: ['taskruns', 'taskcfg'],
  env: { CRON_SECRET: 'clave-larga-para-el-cron-externo' },
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Tareas (admin)', href: '/tareas-admin.html', id: 'nav-tareas-admin' }] : [],
  head: () => `  <style>
    .tar-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:22px 0}
    .tar-kpis .card{text-align:center}
    .tar-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .tar-job{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
    .tar-job .tar-body{flex:1;min-width:240px}
    .tar-job h3{margin:0 0 4px;font-size:1.05rem}
    .tar-est{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .tar-est.ok{background:#2e9e5b20;color:#1d6b3c}
    .tar-est.error{background:#c0392b20;color:#c0392b}
    .tar-est.nunca{background:color-mix(in srgb,var(--accent) 12%,var(--surface));color:var(--muted)}
    .tar-est.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .tar-cron{border-left:3px solid var(--accent);padding:14px 18px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0;margin:18px 0;font-size:.9rem;word-break:break-all}
  </style>`,
  files: (cfg) => {
    const has = (id) => cfg.moduleIds.includes(id);
    const conMailer = has('mailer');
    // Colecciones a resumir: las del proyecto menos las internas (binarios, usuarios con hash,
    // y el propio historial de tareas, que se contaría a sí mismo)
    const resumibles = (cfg.collections || []).filter(c => !['filedata', 'users', 'taskruns', 'taskcfg', 'shieldlog'].includes(c));
    // Cada trabajo se genera solo si sus módulos están activos: el catálogo de tareas es un
    // reflejo exacto de lo que el sitio puede hacer, no una lista de promesas vacías.
    const trabajos = [];
    trabajos.push(`  {
    id: 'resumen-diario',
    nombre: 'Resumen diario del negocio',
    descripcion: 'Cuenta lo cargado en cada sección del sitio y deja el resumen en el historial${conMailer ? ', además de mandarlo por email al negocio' : ''}.',
    async run() {
      const COLS = ${JSON.stringify(resumibles)};
      const partes = [];
      for (const c of COLS) {
        const n = await db.count(c);
        if (n) partes.push(c + ': ' + n);
      }
      const detalle = partes.length ? partes.join(' · ') : 'Todavía no hay datos cargados';
${conMailer ? `      await mailer.notify('Resumen diario del sitio', 'Estado de hoy (' + hoy() + '):\\n\\n' + partes.join('\\n')).catch(() => {});
` : ''}      return { detalle, count: partes.length };
    },
  },`);
    if (has('cumples')) {
      trabajos.push(`  {
    id: 'cumples-saludo',
    nombre: 'Saludo de cumpleaños',
    descripcion: '${conMailer ? 'Le escribe al cliente que cumple años hoy (una sola vez por año, aunque el trabajo corra varias veces).' : 'Marca a los que cumplen hoy. Activá Avisos por email para que además reciban el saludo.'}',
    async run() {
      const dia = hoy().slice(5); // MM-DD: el año del nacimiento no importa
      const anio = hoy().slice(0, 4);
      const cumplen = (await db.all('birthdays')).filter(b => String(b.birthday || '').slice(5) === dia);
      let saludados = 0;
      for (const b of cumplen) {
        if (String(b.greetedYear || '') === anio) continue; // ya saludado este año: nunca dos veces
${conMailer ? `        await mailer.notifyTo(b.email, '¡Feliz cumpleaños, ' + b.name + '!', 'Hola ' + b.name + ',\\n\\nTodo el equipo te desea un muy feliz cumpleaños. Pasá por el local o escribinos para usar tu beneficio del club de cumpleaños.\\n\\n¡Que lo disfrutes!').catch(() => {});
` : ''}        await db.update('birthdays', b.id, { greetedYear: anio });
        saludados++;
      }
      return { detalle: cumplen.length ? saludados + ' de ' + cumplen.length + ' saludados hoy' : 'Nadie cumple años hoy', count: saludados };
    },
  },`);
    }
    if (has('agenda') && conMailer) {
      trabajos.push(`  {
    id: 'agenda-recordatorio',
    nombre: 'Recordatorio de los turnos de mañana',
    descripcion: 'Le manda al negocio la lista de turnos del día siguiente para que confirme o prepare la jornada.',
    async run() {
      const manana = new Date(Date.parse(hoy() + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
      const turnos = (await db.find('agbookings', t => t.date === manana && t.status !== 'cancelado'))
        .sort((a, b) => String(a.time).localeCompare(String(b.time)));
      if (!turnos.length) return { detalle: 'Sin turnos para mañana (' + manana + ')', count: 0 };
      const lista = turnos.map(t => t.time + ' — ' + t.name + ' (tel. ' + t.phone + ') · ' + t.status).join('\\n');
      await mailer.notify('Turnos de mañana (' + manana + '): ' + turnos.length, 'Agenda del ' + manana + ':\\n\\n' + lista).catch(() => {});
      return { detalle: turnos.length + ' turnos para el ' + manana, count: turnos.length };
    },
  },`);
    }
    if (has('recuperar')) {
      trabajos.push(`  {
    id: 'limpieza-tokens',
    nombre: 'Limpieza de links de recuperación',
    descripcion: 'Borra los tokens de "olvidé mi contraseña" usados o vencidos hace más de un día: no tiene sentido guardarlos.',
    async run() {
      const corte = Date.now() - 86400000;
      const viejos = (await db.all('resets')).filter(t => {
        const venc = Date.parse(t.expiresAt || '') || 0;
        const uso = Date.parse(t.usedAt || '') || 0;
        return (venc && venc < corte) || (uso && uso < corte);
      });
      for (const t of viejos) await db.remove('resets', t.id);
      return { detalle: viejos.length ? viejos.length + ' tokens vencidos borrados' : 'No había tokens para limpiar', count: viejos.length };
    },
  },`);
    }
    if (has('promos')) {
      trabajos.push(`  {
    id: 'promos-por-vencer',
    nombre: 'Aviso de promociones que vencen',
    descripcion: 'Revisa qué promociones vencen hoy o mañana${conMailer ? ' y avisa por email' : ''}, para renovarlas antes de que desaparezcan solas del sitio.',
    async run() {
      const d = hoy();
      const manana = new Date(Date.parse(d + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
      const porVencer = (await db.all('promos')).filter(p => p.published !== false && (p.until === d || p.until === manana));
      if (!porVencer.length) return { detalle: 'Ninguna promoción vence hoy ni mañana', count: 0 };
      const lista = porVencer.map(p => '· ' + p.title + ' (hasta el ' + p.until + ')').join('\\n');
${conMailer ? `      await mailer.notify(porVencer.length + ' promociones por vencer', 'Estas promociones dejan de mostrarse muy pronto:\\n\\n' + lista + '\\n\\nRenovalas desde /promos-admin.html si querés que sigan activas.').catch(() => {});
` : ''}      return { detalle: porVencer.length + ' por vencer: ' + porVencer.map(p => p.title).join(', '), count: porVencer.length };
    },
  },`);
    }
    if (has('auditoria')) {
      trabajos.push(`  {
    id: 'auditoria-purga',
    nombre: 'Purga del registro de auditoría',
    descripcion: 'Borra los movimientos de auditoría de más de 90 días: el registro se mantiene liviano solo.',
    async run() {
      const corte = Date.now() - 90 * 86400000;
      const viejos = (await db.all('auditlog')).filter(r => (Date.parse(r.createdAt || '') || Date.now()) < corte);
      for (const r of viejos) await db.remove('auditlog', r.id);
      return { detalle: viejos.length ? viejos.length + ' movimientos viejos borrados' : 'Nada para purgar', count: viejos.length };
    },
  },`);
    }
    return {
      // El registro de trabajos es el corazón del módulo: lo comparten el middleware (disparo
      // automático), la ruta del cron externo y el panel. Una sola fuente de verdad.
      'src/tareas.js': `/**
 * Registro y corredor de tareas programadas. Cada trabajo es idempotente por día: correrlo dos
 * veces el mismo día no duplica efectos (el saludo de cumpleaños marca el año, la limpieza no
 * tiene nada que borrar la segunda vez). Por eso es seguro dispararlo desde varios lados.
 */
const db = require('./db');
${conMailer ? `const mailer = require('./mailer');
` : ''}
const hoy = () => new Date().toISOString().slice(0, 10);

// Trabajos disponibles: se generan según los módulos activos del sitio
const TRABAJOS = [
${trabajos.join('\n')}
];

// Ficha única de configuración: qué trabajos están apagados
async function ficha() {
  const rows = await db.all('taskcfg');
  if (rows.length) return rows[0];
  return db.insert('taskcfg', { apagados: [] });
}

// Historial acotado: las corridas son una ayuda operativa, no un archivo histórico
async function anotar(row) {
  const guardada = await db.insert('taskruns', row);
  const rows = await db.all('taskruns');
  if (rows.length > 300) {
    for (const viejo of rows.slice(0, rows.length - 200)) await db.remove('taskruns', viejo.id);
  }
  return guardada;
}

/** Corridas de hoy, indexadas por trabajo */
async function corridasDeHoy() {
  const d = hoy();
  const mapa = {};
  for (const r of await db.all('taskruns')) if (r.dia === d) mapa[r.jobId] = r;
  return mapa;
}

/** Estado de cada trabajo: habilitado, última corrida y si ya corrió bien hoy */
async function estado() {
  const f = await ficha();
  const runs = await db.all('taskruns');
  const d = hoy();
  return TRABAJOS.map(t => {
    const propias = runs.filter(r => r.jobId === t.id);
    const ultima = propias[propias.length - 1] || null;
    return {
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion,
      habilitado: !(f.apagados || []).includes(t.id),
      hechoHoy: propias.some(r => r.dia === d && r.ok),
      ultima: ultima ? { ok: ultima.ok, detalle: ultima.detalle, dia: ultima.dia, origen: ultima.origen, createdAt: ultima.createdAt } : null,
    };
  });
}

/** Ejecuta los trabajos indicados (o todos) y devuelve el resultado de cada uno */
async function ejecutar(ids, origen = 'manual') {
  const f = await ficha();
  const apagados = f.apagados || [];
  const objetivo = TRABAJOS.filter(t => (!ids || ids.includes(t.id)) && !apagados.includes(t.id));
  const salida = [];
  for (const t of objetivo) {
    const t0 = Date.now();
    let ok = true;
    let detalle = '';
    try {
      const r = await t.run();
      detalle = (r && r.detalle) || 'Listo';
    } catch (err) {
      // Un trabajo que falla jamás frena a los demás: se anota el error y sigue la lista
      ok = false;
      detalle = 'Error: ' + String(err && err.message || err).slice(0, 200);
    }
    await anotar({ jobId: t.id, dia: hoy(), ok, detalle, ms: Date.now() - t0, origen });
    salida.push({ id: t.id, nombre: t.nombre, ok, detalle });
  }
  return salida;
}

/** Ejecuta solo lo que todavía no corrió bien hoy (lo que usa el disparo automático) */
async function correrPendientes(origen = 'automatico') {
  const hechas = await corridasDeHoy();
  const pendientes = TRABAJOS.filter(t => !(hechas[t.id] && hechas[t.id].ok)).map(t => t.id);
  if (!pendientes.length) return [];
  return ejecutar(pendientes, origen);
}

module.exports = { TRABAJOS, estado, ejecutar, correrPendientes, corridasDeHoy, ficha, hoy };
`,
      'src/middleware/tareas.js': `/**
 * Disparador diario. Montado antes de los estáticos (ver src/app.js): mira el primer pedido de
 * cada día —sea una página o una API— y lanza los trabajos pendientes EN SEGUNDO PLANO. El
 * visitante nunca espera: la respuesta sale igual y las tareas corren después con setImmediate.
 * Si el sitio no recibe visitas, el cron externo (POST /api/tareas/ejecutar) hace el mismo trabajo.
 */
const tareas = require('../tareas');

let diaDisparado = '';
let corriendo = false;

module.exports = function disparador(req, res, next) {
  const d = tareas.hoy();
  if (d !== diaDisparado && !corriendo) {
    diaDisparado = d;
    corriendo = true;
    // Fuera del camino crítico del pedido. correrPendientes consulta la base, así que aunque
    // el proceso se reinicie diez veces por día los trabajos corren una sola vez.
    setImmediate(() => {
      tareas.correrPendientes('automatico')
        .catch((err) => console.error('[tareas] fallo el disparo automático:', err.message))
        .finally(() => { corriendo = false; });
    });
  }
  next();
};
`,
      'routes/tareas.js': `const router = require('express').Router();
const db = require('../src/db');
const tareas = require('../src/tareas');
${has('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// POST /api/tareas/ejecutar — punto de entrada para un cron externo (Vercel Cron, GitHub Actions,
// cron-job.org). Se autentica con la cabecera x-cron-secret contra CRON_SECRET del .env.
// Sin CRON_SECRET definido queda cerrado: nunca se expone abierto por olvido.
router.post('/ejecutar', async (req, res) => {
  const secreto = process.env.CRON_SECRET || '';
  const enviado = String(req.headers['x-cron-secret'] || '');
  if (!secreto) return res.status(503).json({ error: 'Definí CRON_SECRET en el .env para habilitar el disparo externo' });
  if (enviado !== secreto) return res.status(401).json({ error: 'Clave de cron inválida' });
  const forzar = req.body && req.body.forzar;
  const salida = forzar ? await tareas.ejecutar(null, 'cron') : await tareas.correrPendientes('cron');
  res.json({ ejecutados: salida.length, resultados: salida });
});
${has('auth') ? `
// GET /api/tareas — estado de cada trabajo (solo admin)
router.get('/', requireAdmin, async (req, res) => {
  res.json({ trabajos: await tareas.estado(), cronListo: Boolean(process.env.CRON_SECRET) });
});

// GET /api/tareas/historial — últimas corridas, de la más nueva a la más vieja (solo admin)
router.get('/historial', requireAdmin, async (req, res) => {
  res.json((await db.all('taskruns')).slice().reverse().slice(0, 200));
});

// DELETE /api/tareas/historial — vacía el historial (solo admin)
router.delete('/historial', requireAdmin, async (req, res) => {
  for (const r of await db.all('taskruns')) await db.remove('taskruns', r.id);
  res.json({ ok: true });
});

// POST /api/tareas/correr — ejecuta todos los trabajos habilitados a mano (solo admin)
router.post('/correr', requireAdmin, async (req, res) => {
  res.json({ resultados: await tareas.ejecutar(null, 'manual') });
});

// Las rutas con :id van AL FINAL para no tapar a /historial ni a /correr
// POST /api/tareas/:id/correr — ejecuta un trabajo puntual (solo admin)
router.post('/:id/correr', requireAdmin, async (req, res) => {
  if (!tareas.TRABAJOS.some(t => t.id === req.params.id)) return res.status(404).json({ error: 'Trabajo inexistente' });
  const salida = await tareas.ejecutar([req.params.id], 'manual');
  if (!salida.length) return res.status(409).json({ error: 'El trabajo está apagado: encendelo para poder ejecutarlo' });
  res.json({ resultados: salida });
});

// PUT /api/tareas/:id — enciende o apaga un trabajo (solo admin)
router.put('/:id', requireAdmin, async (req, res) => {
  if (!tareas.TRABAJOS.some(t => t.id === req.params.id)) return res.status(404).json({ error: 'Trabajo inexistente' });
  const f = await tareas.ficha();
  const apagados = new Set(f.apagados || []);
  if (req.body.habilitado === false) apagados.add(req.params.id); else apagados.delete(req.params.id);
  await db.update('taskcfg', f.id, { apagados: [...apagados] });
  res.json({ trabajos: await tareas.estado() });
});
` : `// El panel de tareas requiere el módulo de autenticación: activalo en el Builder para habilitar
// /tareas-admin.html. Sin él, los trabajos corren igual (disparo automático + cron externo).
`}
module.exports = router;
`,
    };
  },
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'tareas-admin': {
      title: 'Tareas programadas',
      html: `  <section>
    <div class="container" style="max-width:900px">
      <h2>Tareas programadas</h2>
      <p class="section-sub">Los trabajos automáticos del sitio: corren solos una vez por día con la primera visita, o cuando los dispara tu cron. Podés apagarlos de a uno y ejecutarlos a mano. Solo visible para administradores.</p>
      <div class="tar-kpis" id="tar-kpis"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
        <button class="btn" type="button" id="tar-correr">Ejecutar los pendientes ahora</button>
      </div>
      <div id="tar-list"><p class="muted">Cargando…</p></div>
      <div class="tar-cron" id="tar-cron"></div>
      <h3 style="margin-top:32px">Historial</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn ghost" type="button" id="tar-csv">Descargar CSV</button>
        <button class="btn ghost" type="button" id="tar-vaciar" style="color:#c0392b;border-color:#c0392b">Vaciar historial</button>
      </div>
      <div id="tar-hist"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => cfg.moduleIds.includes('auth') ? `/* Módulo tareas programadas: panel solo-admin en /tareas-admin.html con el estado de cada
   trabajo, ejecución manual e historial. Animado con Anime.js (count-up de KPIs, entrada
   escalonada de los trabajos) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  // Oculta el link admin de la navbar para quien no es admin (en TODAS las páginas)
  var navTar = document.getElementById('nav-tareas-admin');
  if (navTar && (!me || me.role !== 'admin') && !window.__PREVIEW__) navTar.style.display = 'none';

  var kpis = document.getElementById('tar-kpis');
  if (!kpis) return;
  var listBox = document.getElementById('tar-list');
  var histBox = document.getElementById('tar-hist');
  var cronBox = document.getElementById('tar-cron');
  var trabajos = [];
  var historial = [];

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = String(hasta); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = String(Math.round(st.v)); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = String(hasta); }, 800);
  }

  function pintarKpis() {
    var activos = trabajos.filter(function (t) { return t.habilitado; }).length;
    var hechos = trabajos.filter(function (t) { return t.hechoHoy; }).length;
    var fallados = trabajos.filter(function (t) { return t.ultima && !t.ultima.ok; }).length;
    kpis.innerHTML = '<div class="card"><strong id="tar-k-tot">0</strong><span class="muted">trabajos</span></div>' +
      '<div class="card"><strong id="tar-k-act">0</strong><span class="muted">encendidos</span></div>' +
      '<div class="card"><strong id="tar-k-hoy">0</strong><span class="muted">hechos hoy</span></div>' +
      '<div class="card"><strong id="tar-k-err">0</strong><span class="muted">con error</span></div>';
    contar(document.getElementById('tar-k-tot'), trabajos.length);
    contar(document.getElementById('tar-k-act'), activos);
    contar(document.getElementById('tar-k-hoy'), hechos);
    contar(document.getElementById('tar-k-err'), fallados);
  }

  function chipEstado(t) {
    if (!t.habilitado) return '<span class="tar-est off">Apagado</span>';
    if (!t.ultima) return '<span class="tar-est nunca">Nunca corrió</span>';
    if (!t.ultima.ok) return '<span class="tar-est error">Con error</span>';
    return '<span class="tar-est ok">' + (t.hechoHoy ? 'Hecho hoy' : 'Último: ' + App.esc(t.ultima.dia)) + '</span>';
  }

  function pintarLista() {
    listBox.innerHTML = trabajos.map(function (t) {
      return '<div class="card tar-job" data-job="' + App.esc(t.id) + '">' +
        '<div class="tar-body"><h3>' + App.esc(t.nombre) + ' ' + chipEstado(t) + '</h3>' +
        '<p class="muted" style="margin:0 0 6px;font-size:.9rem">' + App.esc(t.descripcion) + '</p>' +
        (t.ultima ? '<p class="muted" style="margin:0;font-size:.82rem">Último resultado: ' + App.esc(t.ultima.detalle) + '</p>' : '') +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn ghost" type="button" data-run="' + App.esc(t.id) + '" style="padding:6px 14px;font-size:.85rem">Ejecutar</button>' +
        '<button class="btn ghost" type="button" data-tog="' + App.esc(t.id) + '" style="padding:6px 14px;font-size:.85rem">' + (t.habilitado ? 'Apagar' : 'Encender') + '</button>' +
        '</div></div>';
    }).join('');
    listBox.querySelectorAll('[data-run]').forEach(function (b) { b.addEventListener('click', function () { correr(b.getAttribute('data-run')); }); });
    listBox.querySelectorAll('[data-tog]').forEach(function (b) { b.addEventListener('click', function () { alternar(b.getAttribute('data-tog')); }); });
    var anime = window.anime;
    var tarjetas = listBox.querySelectorAll('.tar-job');
    if (anime && anime.animate && !reduce && tarjetas.length) {
      anime.animate(tarjetas, { opacity: [0, 1], translateY: [14, 0], duration: 420, delay: anime.stagger ? anime.stagger(60) : 0, ease: 'outCubic' });
      // Red de seguridad: deja las tarjetas visibles aunque el loop esté pausado
      setTimeout(function () {
        tarjetas.forEach(function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
      }, 420 + 60 * tarjetas.length + 200);
    }
  }

  function pintarHistorial() {
    histBox.innerHTML = App.table(historial, [
      { label: 'Cuándo', render: function (r) { return new Date(r.createdAt).toLocaleString('es-AR'); } },
      { label: 'Trabajo', key: 'jobId' },
      { label: 'Resultado', render: function (r) { return r.ok ? '<span class="tar-est ok">OK</span>' : '<span class="tar-est error">Error</span>'; } },
      { label: 'Detalle', key: 'detalle' },
      { label: 'Origen', key: 'origen' },
    ]);
  }

  function pintarCron(cronListo) {
    cronBox.innerHTML = '<strong>Cron externo:</strong> si el sitio recibe pocas visitas, disparalo desde afuera con ' +
      '<code>POST ' + location.origin + '/api/tareas/ejecutar</code> y la cabecera <code>x-cron-secret</code>. ' +
      (cronListo ? 'La clave <code>CRON_SECRET</code> ya está definida en el servidor.' : 'Falta definir <code>CRON_SECRET</code> en el <code>.env</code>: hasta entonces el endpoint responde 503.');
  }

  function cargar() {
    App.api('/api/tareas').then(function (d) {
      trabajos = d.trabajos; pintarKpis(); pintarLista(); pintarCron(d.cronListo);
    }).catch(function (err) { listBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    App.api('/api/tareas/historial').then(function (rows) { historial = rows; pintarHistorial(); }).catch(function () {});
  }

  async function correr(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se ejecutaría el trabajo'); return; }
    try {
      var r = await App.api('/api/tareas/' + id + '/correr', { method: 'POST' });
      App.toast((r.resultados[0] && r.resultados[0].detalle) || 'Trabajo ejecutado');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function alternar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se apaga o enciende el trabajo'); return; }
    var t = trabajos.filter(function (x) { return x.id === id; })[0];
    try {
      var d = await App.api('/api/tareas/' + id, { method: 'PUT', body: { habilitado: !(t && t.habilitado) } });
      trabajos = d.trabajos; pintarKpis(); pintarLista();
      App.toast(t && t.habilitado ? 'Trabajo apagado' : 'Trabajo encendido');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  document.getElementById('tar-correr').addEventListener('click', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se ejecutan los trabajos pendientes'); return; }
    try {
      var r = await App.api('/api/tareas/correr', { method: 'POST' });
      App.toast(r.resultados.length + ' trabajos ejecutados');
      cargar();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  document.getElementById('tar-vaciar').addEventListener('click', async function () {
    if (window.__PREVIEW__) { App.toast('Vista previa: se vaciaría el historial'); return; }
    if (!confirm('¿Vaciar el historial de corridas?')) return;
    try {
      await App.api('/api/tareas/historial', { method: 'DELETE' });
      historial = []; pintarHistorial();
      App.toast('Historial vaciado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });

  document.getElementById('tar-csv').addEventListener('click', function () {
    var filas = [['fecha', 'trabajo', 'ok', 'detalle', 'origen', 'ms']].concat(historial.map(function (r) {
      return [r.createdAt, r.jobId, r.ok ? 'si' : 'no', r.detalle, r.origen, r.ms];
    }));
    var csv = filas.map(function (f) { return f.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'tareas-historial.csv';
    a.click();
  });

  if (window.__PREVIEW__) {
    trabajos = [
      { id: 'resumen-diario', nombre: 'Resumen diario del negocio', descripcion: 'Cuenta lo cargado en cada sección del sitio.', habilitado: true, hechoHoy: true, ultima: { ok: true, detalle: 'productos: 12 · pedidos: 4', dia: new Date().toISOString().slice(0, 10), origen: 'automatico' } },
      { id: 'cumples-saludo', nombre: 'Saludo de cumpleaños', descripcion: 'Le escribe al cliente que cumple años hoy.', habilitado: true, hechoHoy: false, ultima: null },
    ];
    pintarKpis(); pintarLista(); pintarCron(false);
    historial = [{ id: 'd1', createdAt: new Date().toISOString(), jobId: 'resumen-diario', ok: true, detalle: 'productos: 12 · pedidos: 4', origen: 'automatico', ms: 14 }];
    pintarHistorial();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargar();
  }
})();` : `/* Módulo tareas programadas: sin el módulo de autenticación no hay panel; los trabajos corren
   igual con el disparo automático del primer pedido del día y con el cron externo. */`,
  readmeNotes: (cfg) => [
    `**Tareas programadas**: los trabajos automáticos del sitio viven en \`src/tareas.js\` (se generan según los módulos activos) y corren de dos maneras. **1)** Solos: el middleware \`src/middleware/tareas.js\` detecta el primer pedido de cada día y los dispara **en segundo plano** (el visitante no espera). **2)** Por cron externo: \`POST /api/tareas/ejecutar\` con la cabecera \`x-cron-secret\` igual a \`CRON_SECRET\` del \`.env\` — sin esa variable el endpoint responde 503, así que nunca queda abierto por olvido. Es la opción recomendada si el sitio recibe pocas visitas${cfg.deploy === 'vercel' ? '; en Vercel agregá `"crons": [{ "path": "/api/tareas/ejecutar", "schedule": "0 9 * * *" }]` a `vercel.json` (el plan gratuito permite un cron diario) y mandá el secreto desde el propio endpoint' : ' (cron-job.org, GitHub Actions o el cron del servidor sirven)'}. Cada trabajo es **idempotente por día**: dispararlo de más no duplica efectos.${cfg.moduleIds.includes('auth') ? ' En `/tareas-admin.html` ves el último resultado de cada uno, los apagás de a uno y los ejecutás a mano.' : ' Sin el módulo **Autenticación** no hay panel, pero los trabajos corren igual.'}`,
  ],
};
