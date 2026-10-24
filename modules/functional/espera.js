// Lista de espera con backend real: el módulo UI "waitlist" mostraba un contador de 1.240
// personas anotadas que NO existían (una constante horneada en el HTML) y guardaba los emails
// en localStorage — es decir, el visitante se anotaba a una lista que nadie iba a leer nunca y
// veía una prueba social inventada. Acá cada alta es una fila real en la colección waitlist, el
// contador es el conteo verdadero y quien se anota recibe SU POSICIÓN en la fila, que es el dato
// que sólo puede dar un servidor y el que hace que la mecánica tenga sentido.
// El alta es IDEMPOTENTE por email: volver a anotarse devuelve la misma posición en vez de inflar
// el contador (si no, cualquiera podría subir el número recargando la página). El negocio decide
// desde el panel si la lista está abierta o cerrada, edita los textos de la sección e invita a la
// gente por tandas (con "Avisos por email" activo, la invitación viaja por mail).
// El "arranque" (gente que ya se había anotado por otro canal) es un campo explícito que arranca
// en CERO y el panel dice para qué es: si va a haber un número al lado de "personas ya se
// anotaron", que sea uno que el negocio pueda defender.
// Panel solo-admin /espera-admin.html con KPIs, tabla, invitaciones y CSV. Animado con Anime.js.
const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'espera', type: 'functional', name: 'Lista de espera administrable',
  description: 'Le da backend real a la sección "Lista de espera": cada alta se guarda en la colección waitlist, el contador de anotados es el número verdadero (no una constante horneada) y quien deja su email recibe su posición en la fila. El alta es idempotente por email, así recargar la página no infla el contador. Desde /espera-admin.html el negocio edita los textos de la sección, abre o cierra la lista, invita por tandas y descarga el CSV; con Avisos por email activo, la invitación se manda por mail. GET /api/espera y el alta son públicos; el resto es solo-admin. Animado con Anime.js.',
  usesAnime: true,
  requires: ['waitlist'],
  mounts: [{ route: '/api/espera', file: 'routes/espera.js' }],
  collections: ['waitlist', 'waitlistcfg'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Lista de espera', href: '/espera-admin.html', id: 'nav-espera-admin' }] : [],
  head: () => `  <style>
    .esp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .esp-kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px}
    .esp-kpi strong{display:block;font-size:1.7rem;font-variant-numeric:tabular-nums;line-height:1.1}
    .esp-kpi span{font-size:.79rem;color:var(--muted)}
    .esp-chip{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .esp-chip.on{background:#2e9e5b20;color:#1d6b3c}
    .esp-chip.off{background:var(--surface);color:var(--muted);border:1px solid var(--line)}
    .esp-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .esp-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .esp-pos{font-variant-numeric:tabular-nums;font-weight:700}
  </style>`,
  files: (cfg) => ({
    'routes/espera.js': `const router = require('express').Router();
const db = require('../src/db');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}${cfg.moduleIds.includes('mailer') ? `const mailer = require('../src/mailer');
` : ''}
// Configuración de la sección: los textos que hornea el HTML se siembran IGUALES para que la
// primera carga no parpadee mostrando primero unos y después otros. Lo único que cambia respecto
// del HTML original es "arranque": el 1.240 horneado era gente inventada y acá empieza en 0.
db.seedIfEmpty('waitlistcfg', [{
  titulo: 'Se viene algo grande',
  descripcion: 'Estamos por lanzar y los primeros en la lista tienen acceso anticipado y un beneficio exclusivo. Dejanos tu email y te avisamos.',
  boton: 'Sumarme a la lista',
  etiqueta: 'personas ya se anotaron',
  cerrada: 'Por ahora cerramos las anotaciones. Volvé pronto: estamos preparando el lanzamiento.',
  abierta: true,
  arranque: 0,
}]);

const esEmail = (e) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(e || ''));
// El email se normaliza SIEMPRE en minúsculas antes de comparar y de guardar: "Ana@Mail.com" y
// "ana@mail.com" son la misma persona, y sin esto la misma persona ocuparía dos lugares.
const normal = (e) => String(e || '').trim().toLowerCase().slice(0, 120);

// Cooldown por IP en memoria: frena el alta repetida desde el mismo lugar. En serverless cada
// instancia tiene el suyo; la defensa real contra el inflado del contador es la idempotencia
// por email, que no depende de dónde corra el proceso.
const ultimo = new Map();
const COOLDOWN = 8000;

async function config() {
  const rows = await db.all('waitlistcfg');
  const c = rows[0] || {};
  return {
    id: c.id,
    titulo: c.titulo || 'Se viene algo grande',
    descripcion: c.descripcion || '',
    boton: c.boton || 'Sumarme a la lista',
    etiqueta: c.etiqueta || 'personas ya se anotaron',
    cerrada: c.cerrada || 'Por ahora cerramos las anotaciones.',
    abierta: c.abierta !== false,
    arranque: Math.max(0, Number(c.arranque) || 0),
  };
}

// Anotados en orden de llegada: la posición en la fila es el ORDEN DE ALTA, no un campo guardado.
// Guardarlo obligaría a reescribir a todos los de atrás cada vez que se borra a alguien.
const porLlegada = (rows) => rows.slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

// GET /api/espera — público: los textos, si está abierta y el total real (arranque + anotados)
router.get('/', async (req, res) => {
  const cfg = await config();
  const total = (await db.count('waitlist')) + cfg.arranque;
  res.json({
    titulo: cfg.titulo, descripcion: cfg.descripcion, boton: cfg.boton,
    etiqueta: cfg.etiqueta, cerrada: cfg.cerrada,
    abierta: cfg.abierta, total,
  });
});

// POST /api/espera — alta pública. Idempotente por email: quien ya está anotado recibe la MISMA
// posición que la primera vez y el contador no se mueve.
router.post('/', async (req, res) => {
  const cfg = await config();
  if (!cfg.abierta) return res.status(409).json({ error: cfg.cerrada });

  const email = normal(req.body && req.body.email);
  if (!esEmail(email)) return res.status(422).json({ error: 'Ese email no parece válido' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const ahora = Date.now();
  if (ip && ultimo.get(ip) && ahora - ultimo.get(ip) < COOLDOWN) {
    return res.status(429).json({ error: 'Esperá unos segundos antes de volver a intentar' });
  }

  const lista = porLlegada(await db.all('waitlist'));
  const yaEstaba = lista.findIndex(r => normal(r.email) === email);
  if (yaEstaba >= 0) {
    return res.json({
      ok: true, yaEstaba: true,
      posicion: cfg.arranque + yaEstaba + 1,
      total: lista.length + cfg.arranque,
      mensaje: 'Ya estabas en la lista: no te anotamos dos veces.',
    });
  }

  if (ip) ultimo.set(ip, ahora);
  await db.insert('waitlist', { email, invitadoAt: null, origen: 'sitio' });
  const total = lista.length + 1 + cfg.arranque;
  res.status(201).json({
    ok: true, yaEstaba: false,
    posicion: cfg.arranque + lista.length + 1,
    total,
    mensaje: 'Listo, ya estás en la lista.',
  });
});
${cfg.moduleIds.includes('auth') ? `
const fila = (r, i, arranque) => ({
  id: r.id, email: r.email, origen: r.origen || 'sitio',
  posicion: arranque + i + 1,
  invitadoAt: r.invitadoAt || null,
  createdAt: r.createdAt || null,
});

// GET /api/espera/todos — el panel: la fila completa con su posición y sus KPIs
router.get('/todos', requireAdmin, async (req, res) => {
  const cfg = await config();
  const lista = porLlegada(await db.all('waitlist'));
  const rows = lista.map((r, i) => fila(r, i, cfg.arranque));
  res.json({
    rows,
    config: cfg,
    total: rows.length + cfg.arranque,
    anotados: rows.length,
    invitados: rows.filter(r => r.invitadoAt).length,
  });
});

// PUT /api/espera/config — textos de la sección, abierta/cerrada y arranque
router.put('/config', requireAdmin, async (req, res) => {
  const cfg = await config();
  const b = req.body || {};
  const patch = {};
  const texto = (k, min, max) => {
    if (b[k] === undefined) return null;
    const v = String(b[k]).trim();
    if (v.length < min || v.length > max) return 'El campo "' + k + '" tiene que tener entre ' + min + ' y ' + max + ' caracteres';
    patch[k] = v;
    return null;
  };
  const err = texto('titulo', 2, 90) || texto('descripcion', 0, 400) || texto('boton', 2, 40)
    || texto('etiqueta', 2, 60) || texto('cerrada', 2, 240);
  if (err) return res.status(422).json({ error: err });
  if (b.abierta !== undefined) patch.abierta = !(b.abierta === false || b.abierta === 'false');
  if (b.arranque !== undefined) {
    const n = Number(b.arranque);
    if (!isFinite(n) || n < 0 || n > 1000000) return res.status(422).json({ error: 'El arranque tiene que ser un número entre 0 y 1.000.000' });
    patch.arranque = Math.floor(n);
  }
  if (cfg.id) await db.update('waitlistcfg', cfg.id, patch);
  else await db.insert('waitlistcfg', patch);
  res.json(await config());
});

// POST /api/espera/:id/invitar — marca la invitación. Es idempotente: invitar dos veces no
// reescribe la fecha (si no, un doble clic borraría cuándo se invitó de verdad).
router.post('/:id/invitar', requireAdmin, async (req, res) => {
  const r = await db.get('waitlist', req.params.id);
  if (!r) return res.status(404).json({ error: 'Esa persona no está en la lista' });
  if (r.invitadoAt) return res.json({ ok: true, yaInvitado: true, invitadoAt: r.invitadoAt });
  const invitadoAt = new Date().toISOString();
  await db.update('waitlist', r.id, { invitadoAt });
${cfg.moduleIds.includes('mailer') ? `  // "Disparar y seguir": un email caído no puede hacer que la invitación quede sin registrar.
  mailer.notifyTo(r.email, 'Te toca: ya podés entrar', 'Te habías anotado en la lista de espera y ya te llegó el turno. Entrá al sitio para empezar.').catch(() => {});
` : ''}  res.json({ ok: true, yaInvitado: false, invitadoAt });
});

// DELETE /api/espera/:id — baja de la lista. Los de atrás suben una posición solos porque la
// posición se calcula al leer: no hay ningún número guardado que quede desfasado.
router.delete('/:id', requireAdmin, async (req, res) => {
  const r = await db.get('waitlist', req.params.id);
  if (!r) return res.status(404).json({ error: 'Esa persona no está en la lista' });
  await db.remove('waitlist', r.id);
  res.json({ ok: true });
});
` : `// La administración de la lista requiere el módulo de autenticación: activalo en el Builder para
// habilitar /espera-admin.html. Sin él, el alta pública sigue funcionando y los emails quedan en
// data/waitlist.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'espera-admin': {
      title: 'Lista de espera',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('users', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Lista de espera</h2>
      <p class="section-sub">Quiénes se anotaron, en orden de llegada. El contador que ve el visitante en el sitio es este número real, no una constante. Solo visible para administradores.</p>

      <div class="esp-kpis" id="esp-kpis"></div>

      <div class="card" style="margin-bottom:26px">
        <h3>Textos y estado de la sección</h3>
        <p class="muted" style="font-size:.86rem;margin:0 0 4px">Lo que edites acá se ve en el sitio al instante, sin regenerar ni volver a deployar.</p>
        <form id="esp-cfg">
          <label>Título</label>
          <input name="titulo" required maxlength="90" placeholder="Se viene algo grande">
          <label>Descripción</label>
          <textarea name="descripcion" rows="3" maxlength="400"></textarea>
          <div class="grid cols-2">
            <div><label>Texto del botón</label><input name="boton" required maxlength="40" placeholder="Sumarme a la lista"></div>
            <div><label>Etiqueta del contador</label><input name="etiqueta" required maxlength="60" placeholder="personas ya se anotaron"></div>
          </div>
          <label>Mensaje cuando la lista está cerrada</label>
          <input name="cerrada" required maxlength="240" placeholder="Por ahora cerramos las anotaciones.">
          <label>Arranque del contador</label>
          <input name="arranque" type="number" min="0" max="1000000" step="1" value="0">
          <span class="muted" style="font-size:.8rem">Suma al total que se muestra. Es para la gente que ya se había anotado por otro canal (un formulario viejo, Instagram) y que no está en esta tabla. Dejalo en 0 si no es el caso: el número que ve el visitante tiene que ser uno que puedas defender.</span>
          <label style="display:flex;align-items:center;gap:8px;margin-top:12px"><input type="checkbox" name="abierta" style="width:auto;margin:0" checked> Lista abierta (se pueden anotar)</label>
          <div style="margin-top:16px"><button class="btn" type="submit">Guardar cambios</button></div>
        </form>
      </div>

      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
        <select id="esp-filtro" style="width:auto;min-width:190px">
          <option value="">Todos</option>
          <option value="pendiente">Sin invitar</option>
          <option value="invitado">Ya invitados</option>
        </select>
        <button class="btn ghost" type="button" id="esp-csv">Descargar CSV</button>
      </div>
      <div id="esp-tabla"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo lista de espera administrable: trae textos, estado y total real de /api/espera y los
   aplica sobre la sección horneada usando el punto de entrada window.WFLista que expone el módulo
   UI (así el contador animado sigue siendo de ese módulo y no se duplica su lógica acá).
   El alta va al backend: devuelve la posición en la fila, que es lo que no puede saber el navegador.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel vive en /espera-admin.html.` : ''} */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Sección pública ----
  // window.WFLista lo define el módulo UI, y el orden en que el generador concatena los clientJs
  // NO está garantizado (un requires resuelto empuja al UI al final de la lista). Por eso nunca se
  // lee en la línea de arranque: se consulta desde un callback asíncrono, que corre cuando todo
  // el app.js ya se ejecutó.
  function conApi(fn) {
    var api = window.WFLista;
    if (api) fn(api);
  }
  var DEMO = { titulo: 'Se viene algo grande', descripcion: 'Estamos por lanzar y los primeros en la lista tienen acceso anticipado y un beneficio exclusivo. Dejanos tu email y te avisamos.', boton: 'Sumarme a la lista', etiqueta: 'personas ya se anotaron', cerrada: 'Por ahora cerramos las anotaciones.', abierta: true, total: 0 };

  function aplicar(api, d) {
    api.textos(d);
    api.setTotal(Number(d.total) || 0);
    if (!d.abierta) api.cerrar(d.cerrada);
  }

  // El handler del formulario se registra apenas termina de correr el app.js (setTimeout 0), no
  // cuando contesta el servidor: si esperara al fetch, un envío rápido caería en el vacío.
  setTimeout(function () {
    conApi(function (api) {
      api.alEnviar(function (email, listo) {
        if (window.__PREVIEW__) { App.toast('Vista previa: el alta corre en el proyecto exportado'); return; }
        App.api('/api/espera', { method: 'POST', body: { email: email } }).then(function (r) {
          api.setTotal(Number(r.total) || 0);
          listo(r.mensaje, r.posicion);
          App.toast(r.yaEstaba ? 'Ya estabas anotado' : '¡Sumado a la lista!');
        }).catch(function (err) {
          if (err.message !== 'preview') App.toast(err.message || 'No pudimos anotarte');
        });
      });
      if (window.__PREVIEW__) aplicar(api, DEMO);
    });
  }, 0);

  if (!window.__PREVIEW__ && document.querySelector('[data-waitlist]')) {
    fetch('/api/espera').then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.titulo) conApi(function (api) { aplicar(api, d); }); })
      .catch(function () {});
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /espera-admin.html ----
  var tabla = document.getElementById('esp-tabla');
  var formCfg = document.getElementById('esp-cfg');
  if (tabla && formCfg) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var todos = [];
    var CAMPOS = ['titulo', 'descripcion', 'boton', 'etiqueta', 'cerrada'];

    var fecha = function (iso) { return iso ? new Date(iso).toLocaleDateString('es-AR') : '—'; };

    function filtrados() {
      var f = document.getElementById('esp-filtro').value;
      return todos.filter(function (r) {
        if (f === 'pendiente') return !r.invitadoAt;
        if (f === 'invitado') return !!r.invitadoAt;
        return true;
      });
    }

    function pintarKpis(d) {
      var box = document.getElementById('esp-kpis');
      if (!box) return;
      box.innerHTML =
        '<div class="esp-kpi"><strong>' + d.total.toLocaleString('es-AR') + '</strong><span>total que ve el visitante</span></div>' +
        '<div class="esp-kpi"><strong>' + d.anotados.toLocaleString('es-AR') + '</strong><span>anotados desde el sitio</span></div>' +
        '<div class="esp-kpi"><strong>' + d.invitados.toLocaleString('es-AR') + '</strong><span>ya invitados</span></div>' +
        '<div class="esp-kpi"><strong>' + (d.anotados - d.invitados).toLocaleString('es-AR') + '</strong><span>esperando turno</span></div>';
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(box.children, { opacity: [0, 1], translateY: [10, 0], duration: 420, delay: anime.stagger ? anime.stagger(60) : 0, ease: 'outCubic' });
        // Red de seguridad: con la pestaña oculta el loop de Anime no corre y los KPIs
        // se quedarían invisibles. Se fija el estado final igual.
        setTimeout(function () {
          Array.prototype.forEach.call(box.children, function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
        }, 900);
      }
    }

    function pintar() {
      tabla.innerHTML = App.table(filtrados(), [
        { label: '#', render: function (r) { return '<span class="esp-pos">' + r.posicion + '</span>'; } },
        { label: 'Email', render: function (r) { return App.esc(r.email); } },
        { label: 'Se anotó', render: function (r) { return fecha(r.createdAt); } },
        { label: 'Estado', render: function (r) {
          return r.invitadoAt
            ? '<span class="esp-chip on">Invitado ' + fecha(r.invitadoAt) + '</span>'
            : '<span class="esp-chip off">Esperando</span>';
        } },
        { label: '', render: function (r) {
          return '<span class="esp-acciones">' +
            (r.invitadoAt ? '' : '<button class="btn ghost" type="button" data-esp-inv="' + r.id + '">Invitar</button>') +
            '<button class="btn ghost" type="button" data-esp-del="' + r.id + '">Borrar</button>' +
            '</span>';
        } },
      ]);
      tabla.querySelectorAll('[data-esp-inv]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (window.__PREVIEW__) { App.toast('Vista previa: se invitaría'); return; }
          try {
            var out = await App.api('/api/espera/' + b.getAttribute('data-esp-inv') + '/invitar', { method: 'POST' });
            App.toast(out.yaInvitado ? 'Ya estaba invitado' : 'Invitación registrada');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
      tabla.querySelectorAll('[data-esp-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('¿Sacar a esta persona de la lista? Los que están detrás suben una posición.')) return;
          if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
          try {
            await App.api('/api/espera/' + b.getAttribute('data-esp-del'), { method: 'DELETE' });
            App.toast('Persona borrada de la lista');
            await cargar();
          } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
        });
      });
    }

    function cargarCfg(c) {
      CAMPOS.forEach(function (k) {
        var el = formCfg.querySelector('[name="' + k + '"]');
        if (el) el.value = c[k] || '';
      });
      formCfg.querySelector('[name="arranque"]').value = Number(c.arranque) || 0;
      formCfg.querySelector('[name="abierta"]').checked = c.abierta !== false;
    }

    async function cargar() {
      if (window.__PREVIEW__) {
        todos = [
          { id: '1', email: 'sofia@mail.com', posicion: 1, invitadoAt: null, createdAt: new Date().toISOString() },
          { id: '2', email: 'diego@mail.com', posicion: 2, invitadoAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        ];
        pintarKpis({ total: 2, anotados: 2, invitados: 1 });
        cargarCfg({ titulo: 'Se viene algo grande', descripcion: '', boton: 'Sumarme a la lista', etiqueta: 'personas ya se anotaron', cerrada: 'Cerramos las anotaciones.', abierta: true, arranque: 0 });
        pintar();
        return;
      }
      try {
        var out = await App.api('/api/espera/todos');
        todos = out.rows;
        pintarKpis(out);
        cargarCfg(out.config);
        pintar();
      } catch (err) {
        if (err.message !== 'preview') tabla.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    formCfg.addEventListener('submit', async function (e) {
      e.preventDefault();
      var datos = {};
      CAMPOS.forEach(function (k) {
        var el = formCfg.querySelector('[name="' + k + '"]');
        if (el) datos[k] = el.value;
      });
      datos.arranque = Number(formCfg.querySelector('[name="arranque"]').value) || 0;
      datos.abierta = formCfg.querySelector('[name="abierta"]').checked;
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría la configuración'); return; }
      try {
        await App.api('/api/espera/config', { method: 'PUT', body: datos });
        App.toast('Sección actualizada');
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    var filtro = document.getElementById('esp-filtro');
    if (filtro) filtro.addEventListener('change', pintar);

    // Descarga CSV de lo filtrado (separador ; para Excel es-AR, con BOM UTF-8)
    var csv = document.getElementById('esp-csv');
    if (csv) csv.addEventListener('click', function () {
      var celda = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lineas = [['Posicion', 'Email', 'Se anoto', 'Invitado'].map(celda).join(';')];
      filtrados().forEach(function (r) {
        lineas.push([r.posicion, r.email, r.createdAt || '', r.invitadoAt || ''].map(celda).join(';'));
      });
      var blob = new Blob(['\\ufeff' + lineas.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'lista-de-espera-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      tabla.innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      formCfg.style.display = 'none';
    } else {
      cargar();
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navE = document.getElementById('nav-espera-admin');
    if (navE && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navE.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Lista de espera administrable**: los emails se guardan de verdad en la colección \`waitlist\` y el contador de la sección es el **número real de anotados**, no la constante de 1.240 que traía el HTML. Quien se anota recibe **su posición en la fila**. El alta es **idempotente por email**: volver a anotarse devuelve la misma posición sin inflar el contador. ${cfg.moduleIds.includes('auth') ? 'Desde `/espera-admin.html` editás los textos de la sección, abrís o cerrás la lista, invitás por tandas y descargás el CSV.' : 'Activá el módulo **Autenticación** para administrar la lista desde `/espera-admin.html`; sin él los emails quedan en `data/waitlist.json`.'}${cfg.moduleIds.includes('mailer') ? ' Con **Avisos por email** activo, invitar a alguien le manda el mail.' : ''} El campo **arranque** del panel (default 0) suma al total mostrado y es para gente anotada por otro canal: si lo usás, que sea un número que puedas defender.`,
  ],
};
