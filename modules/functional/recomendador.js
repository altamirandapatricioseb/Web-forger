// Quiz recomendador con backend real: el módulo UI "quiz" era frontend puro — las preguntas
// viajaban embebidas en un <script type="application/json"> y las respuestas NO SE GUARDABAN EN
// NINGÚN LADO. Es la peor combinación posible: la sección que sirve para descubrir qué necesita
// la gente tiraba a la basura exactamente ese dato, y cambiar una pregunta obligaba a regenerar.
// Acá el cuestionario vive en la colección quizconfig (editable desde el panel) y cada recorrido
// deja una fila en quizruns.
// La fila se crea EN LA PRIMERA RESPUESTA, no al cargar la página: así una fila significa siempre
// una persona que interactuó, y los buscadores y los que pasan de largo no ensucian la estadística.
// Cada respuesta siguiente actualiza la misma fila, y por eso el panel puede decir algo que no se
// puede saber de otra forma: EN QUÉ PREGUNTA ABANDONA la gente. Un quiz que sólo registra los
// terminados esconde justo el número que hay que arreglar.
// Cada resultado puede tener su propio destino: sin eso, todas las recomendaciones llevan al mismo
// lugar y la recomendación deja de serlo. Con "Captación de leads" activo, el resultado ofrece
// mandarlo por email y ese email entra como lead con origen "recomendador".
// Panel solo-admin /recomendador-admin.html con estadísticas y ABM. Animado con Anime.js.
const { phIcon } = require('../../src/icons');
const { SEED } = require('../ui/quiz');

module.exports = {
  id: 'recomendador', type: 'functional', name: 'Quiz recomendador administrable',
  description: 'Le da backend real al Quiz recomendador: el cuestionario vive en la colección quizconfig y se edita desde /recomendador-admin.html sin regenerar, y cada recorrido queda registrado en quizruns. La fila se crea en la primera respuesta (no al cargar la página), así el panel puede mostrar cuántos terminaron, qué resultado gana y en qué pregunta abandona la gente — el dato que el quiz frontend-only tiraba. Cada resultado admite su propio destino y texto de botón; con Captación de leads activo, quien quiere puede pedir la recomendación por email y entra como lead. Animado con Anime.js.',
  usesAnime: true,
  requires: ['quiz'],
  mounts: [{ route: '/api/recomendador', file: 'routes/recomendador.js' }],
  collections: ['quizconfig', 'quizruns'],
  nav: (cfg) => cfg.moduleIds.includes('auth') ? [{ label: 'Recomendador', href: '/recomendador-admin.html', id: 'nav-recomendador-admin' }] : [],
  head: () => `  <style>
    .rc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}
    .rc-kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px}
    .rc-kpi strong{display:block;font-size:1.7rem;font-variant-numeric:tabular-nums;line-height:1.1}
    .rc-kpi span{font-size:.79rem;color:var(--muted)}
    .rc-barra{height:8px;background:color-mix(in srgb,var(--text) 10%,var(--bg));border-radius:999px;overflow:hidden;margin-top:5px}
    .rc-barra i{display:block;height:100%;background:var(--accent);border-radius:999px;width:0}
    .rc-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .rc-acciones .btn{width:auto;padding:6px 12px;font-size:.85rem}
    .rc-op{display:grid;grid-template-columns:1fr 190px auto;gap:8px;align-items:end;margin-bottom:8px}
    .rc-op .btn{width:auto;padding:9px 13px}
    @media (max-width:640px){.rc-op{grid-template-columns:1fr}}
    .rc-lead{margin-top:18px;padding-top:16px;border-top:1px solid var(--line);text-align:left}
    .rc-lead form{display:flex;gap:8px;flex-wrap:wrap}
    .rc-lead input{flex:1;min-width:190px}
    .rc-lead button{width:auto;flex:none}
  </style>`,
  files: (cfg) => ({
    'routes/recomendador.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Semilla: el MISMO cuestionario que hornea la sección (viene exportado del módulo UI, no
// copiado a mano) para que la primera carga no muestre unas preguntas y después otras.
db.seedIfEmpty('quizconfig', [${JSON.stringify({
      titulo: '¿Cuál te conviene?',
      intro: SEED.intro,
      textoBoton: SEED.textoBoton,
      preguntas: SEED.preguntas,
      resultados: Object.entries(SEED.resultados).map(([valor, r]) => ({ valor, titulo: r.titulo, texto: r.texto, enlace: '', textoBoton: '' })),
    }, null, 2)}]);

const MAX_PREGUNTAS = 12, MAX_OPCIONES = 6, MAX_RESULTADOS = 12;
const DESTINO = /^(\\/[\\w\\-./%#?=&]*|https?:\\/\\/[^\\s"'<>]+)$/;
const esEmail = (e) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(e || ''));

// Cooldown por IP para el alta de recorridos: sin esto, un script podría llenar la colección de
// filas y arruinar la estadística, que es el único producto de este módulo.
const ultimo = new Map();
const COOLDOWN = 1500;
const TOPE_RESPUESTAS = 20;

async function config() {
  const rows = await db.all('quizconfig');
  const c = rows[0] || {};
  return {
    id: c.id,
    titulo: c.titulo || '¿Cuál te conviene?',
    intro: c.intro || '',
    textoBoton: c.textoBoton || 'Ver esta opción',
    preguntas: Array.isArray(c.preguntas) ? c.preguntas : [],
    resultados: Array.isArray(c.resultados) ? c.resultados : [],
  };
}

// Forma que espera el módulo UI: resultados como objeto indexado por valor (así lo lee el quiz).
function paraElSitio(c) {
  const resultados = {};
  for (const r of c.resultados) {
    resultados[r.valor] = { titulo: r.titulo, texto: r.texto || '', enlace: r.enlace || '', textoBoton: r.textoBoton || '' };
  }
  return { titulo: c.titulo, intro: c.intro, textoBoton: c.textoBoton, preguntas: c.preguntas, resultados };
}

// GET /api/recomendador — público: el cuestionario que se pinta en la sección
router.get('/', async (req, res) => {
  res.json(paraElSitio(await config()));
});

// POST /api/recomendador/recorrido — primera respuesta: nace la fila. Devuelve su id para que
// las siguientes actualicen la MISMA fila y el recorrido quede completo, no partido en pedazos.
router.post('/recorrido', async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const ahora = Date.now();
  if (ip && ultimo.get(ip) && ahora - ultimo.get(ip) < COOLDOWN) {
    return res.status(429).json({ error: 'Demasiadas respuestas seguidas' });
  }
  if (ip) ultimo.set(ip, ahora);
  const respuestas = leerRespuestas(req.body && req.body.respuestas);
  if (!respuestas.length) return res.status(422).json({ error: 'Falta la respuesta' });
  const row = await db.insert('quizruns', { respuestas, resultado: '', resultadoTitulo: '', terminado: false, email: '' });
  res.status(201).json({ id: row.id });
});

// PUT /api/recomendador/recorrido/:id — cada respuesta siguiente y el cierre del recorrido.
// Sólo se puede AVANZAR: un cuerpo con menos respuestas de las ya guardadas se ignora, para que
// un pedido que llega tarde o desordenado no borre lo que la persona ya contestó.
router.put('/recorrido/:id', async (req, res) => {
  const row = await db.get('quizruns', req.params.id);
  if (!row) return res.status(404).json({ error: 'Ese recorrido no existe' });
  if (row.terminado) return res.json({ ok: true, yaCerrado: true });
  const respuestas = leerRespuestas(req.body && req.body.respuestas);
  const patch = {};
  if (respuestas.length >= (row.respuestas || []).length) patch.respuestas = respuestas;
  if (req.body && req.body.terminado) {
    patch.terminado = true;
    patch.resultado = String((req.body.resultado || '')).trim().slice(0, 40);
    patch.resultadoTitulo = String((req.body.resultadoTitulo || '')).trim().slice(0, 90);
  }
  await db.update('quizruns', row.id, patch);
  res.json({ ok: true });
});

// POST /api/recomendador/recorrido/:id/email — el visitante pide su recomendación por email.
// Sólo se acepta sobre un recorrido TERMINADO: un email sin recomendación no sirve para nada.
router.post('/recorrido/:id/email', async (req, res) => {
  const row = await db.get('quizruns', req.params.id);
  if (!row) return res.status(404).json({ error: 'Ese recorrido no existe' });
  if (!row.terminado) return res.status(409).json({ error: 'Terminá el cuestionario primero' });
  const email = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 120);
  if (!esEmail(email)) return res.status(422).json({ error: 'Ese email no parece válido' });
  await db.update('quizruns', row.id, { email });
${cfg.moduleIds.includes('leads') ? `  // Con "Captación de leads" activo el email entra también al embudo central con su origen,
  // que es donde el negocio ya mira. Es idempotente por email+origen del lado de leads.
  const previo = (await db.find('leads', l => l.email === email && l.origen === 'recomendador'))[0];
  if (!previo) await db.insert('leads', { email, origen: 'recomendador', nota: row.resultadoTitulo || row.resultado || '' });
` : ''}${cfg.moduleIds.includes('mailer') ? `  const mailer = require('../src/mailer');
  // "Disparar y seguir": un email caído no puede hacer que se pierda el lead ya registrado.
  mailer.notifyTo(email, 'Tu recomendación', 'Según lo que respondiste, te recomendamos: ' + (row.resultadoTitulo || row.resultado || 'la opción que viste en pantalla') + '. Cualquier duda, respondé este mail.').catch(() => {});
  mailer.notify('Nueva recomendación pedida por email', email + ' pidió su recomendación: ' + (row.resultadoTitulo || row.resultado || '-')).catch(() => {});
` : ''}  res.json({ ok: true, mensaje: 'Listo, te lo mandamos por email.' });
});

// Normaliza y acota las respuestas que manda el navegador: nada de lo que llega de afuera entra
// crudo a la colección.
function leerRespuestas(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, TOPE_RESPUESTAS).map(r => ({
    i: Math.max(0, Number(r && r.i) || 0),
    pregunta: String((r && r.pregunta) || '').slice(0, 200),
    opcion: String((r && r.opcion) || '').slice(0, 200),
    valor: String((r && r.valor) || '').slice(0, 40),
  })).filter(r => r.valor);
}
${cfg.moduleIds.includes('auth') ? `
// GET /api/recomendador/config — el panel edita sobre esta forma (resultados como lista)
router.get('/config', requireAdmin, async (req, res) => {
  res.json(await config());
});

// PUT /api/recomendador/config — guarda el cuestionario completo. Se valida entero y se escribe
// entero: un cuestionario a medio guardar (preguntas nuevas apuntando a resultados que todavía
// no existen) es peor que uno viejo.
router.put('/config', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const c = await config();
  const patch = {};
  if (b.titulo !== undefined) {
    if (!str(b.titulo, 2, 90)) return res.status(422).json({ error: 'El título tiene que tener entre 2 y 90 caracteres' });
    patch.titulo = String(b.titulo).trim();
  }
  if (b.intro !== undefined) patch.intro = String(b.intro).trim().slice(0, 300);
  if (b.textoBoton !== undefined) patch.textoBoton = String(b.textoBoton).trim().slice(0, 40) || 'Ver esta opción';

  if (b.resultados !== undefined) {
    if (!Array.isArray(b.resultados) || !b.resultados.length) return res.status(422).json({ error: 'Tiene que haber al menos un resultado posible' });
    if (b.resultados.length > MAX_RESULTADOS) return res.status(422).json({ error: 'Como máximo ' + MAX_RESULTADOS + ' resultados' });
    const vistos = new Set();
    const limpios = [];
    for (const r of b.resultados) {
      const valor = String((r && r.valor) || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '');
      if (!valor) return res.status(422).json({ error: 'Cada resultado necesita una clave (por ejemplo: inicial)' });
      if (vistos.has(valor)) return res.status(422).json({ error: 'La clave "' + valor + '" está repetida' });
      vistos.add(valor);
      if (!str(r.titulo, 2, 90)) return res.status(422).json({ error: 'Cada resultado necesita un título de 2 a 90 caracteres' });
      const enlace = String(r.enlace || '').trim();
      if (enlace && !DESTINO.test(enlace)) return res.status(422).json({ error: 'El destino de "' + r.titulo + '" tiene que ser una ruta del sitio o una URL http(s)' });
      limpios.push({ valor, titulo: String(r.titulo).trim(), texto: String(r.texto || '').trim().slice(0, 300), enlace, textoBoton: String(r.textoBoton || '').trim().slice(0, 40) });
    }
    patch.resultados = limpios;
  }

  if (b.preguntas !== undefined) {
    if (!Array.isArray(b.preguntas) || !b.preguntas.length) return res.status(422).json({ error: 'Tiene que haber al menos una pregunta' });
    if (b.preguntas.length > MAX_PREGUNTAS) return res.status(422).json({ error: 'Como máximo ' + MAX_PREGUNTAS + ' preguntas' });
    const claves = new Set((patch.resultados || c.resultados).map(r => r.valor));
    const limpias = [];
    for (const p of b.preguntas) {
      if (!str(p && p.pregunta, 3, 200)) return res.status(422).json({ error: 'Cada pregunta tiene que tener entre 3 y 200 caracteres' });
      const ops = Array.isArray(p.opciones) ? p.opciones : [];
      if (ops.length < 2) return res.status(422).json({ error: 'Cada pregunta necesita al menos 2 opciones' });
      if (ops.length > MAX_OPCIONES) return res.status(422).json({ error: 'Como máximo ' + MAX_OPCIONES + ' opciones por pregunta' });
      const limpiasOps = [];
      for (const o of ops) {
        if (!str(o && o.texto, 1, 160)) return res.status(422).json({ error: 'Cada opción necesita un texto' });
        const valor = String((o && o.valor) || '').trim();
        // Una opción que apunta a un resultado inexistente deja el quiz recomendando el fallback
        // genérico sin ningún aviso: se corta acá, que es donde todavía se puede explicar.
        if (!claves.has(valor)) return res.status(422).json({ error: 'La opción "' + o.texto + '" apunta a un resultado que no existe' });
        limpiasOps.push({ texto: String(o.texto).trim(), valor });
      }
      limpias.push({ pregunta: String(p.pregunta).trim(), opciones: limpiasOps });
    }
    patch.preguntas = limpias;
  }

  if (c.id) await db.update('quizconfig', c.id, patch);
  else await db.insert('quizconfig', patch);
  res.json(await config());
});

// GET /api/recomendador/stats — lo que no se podía saber sin backend
router.get('/stats', requireAdmin, async (req, res) => {
  const c = await config();
  const runs = await db.all('quizruns');
  const terminados = runs.filter(r => r.terminado);
  // Ranking de resultados: qué recomienda de verdad el quiz, no qué creemos que recomienda
  const porResultado = {};
  for (const r of terminados) {
    const k = r.resultado || '(sin clave)';
    porResultado[k] = (porResultado[k] || 0) + 1;
  }
  const ranking = Object.entries(porResultado)
    .map(([valor, veces]) => {
      const def = c.resultados.find(x => x.valor === valor);
      return { valor, titulo: def ? def.titulo : valor, veces };
    })
    .sort((a, b) => b.veces - a.veces);
  // Abandono por pregunta: de los que NO terminaron, en cuál se quedaron. El índice es la
  // cantidad de respuestas dadas, es decir la pregunta en la que se fueron.
  const abandono = c.preguntas.map((p, i) => ({
    i, pregunta: p.pregunta,
    // Llegaron a verla todos los que ya contestaron i preguntas
    llegaron: runs.filter(r => (r.respuestas || []).length >= i).length,
    abandonaron: runs.filter(r => !r.terminado && (r.respuestas || []).length === i).length,
  }));
  const recientes = runs.slice(-40).reverse().map(r => ({
    id: r.id, terminado: !!r.terminado,
    resultado: r.resultadoTitulo || r.resultado || '',
    respuestas: (r.respuestas || []).map(x => x.opcion),
    email: r.email || '',
    createdAt: r.createdAt || null,
  }));
  res.json({
    total: runs.length,
    terminados: terminados.length,
    conEmail: runs.filter(r => r.email).length,
    ranking, abandono, recientes,
  });
});

// DELETE /api/recomendador/recorridos — vacía la estadística (para empezar a medir de cero
// después de cambiar el cuestionario: mezclar respuestas de dos cuestionarios distintos da un
// promedio que no describe a ninguno de los dos).
router.delete('/recorridos', requireAdmin, async (req, res) => {
  const runs = await db.all('quizruns');
  for (const r of runs) await db.remove('quizruns', r.id);
  res.json({ ok: true, borrados: runs.length });
});
` : `// La edición del cuestionario y las estadísticas requieren el módulo de autenticación:
// activalo en el Builder para habilitar /recomendador-admin.html. Sin él, el quiz igual se
// alimenta de data/quizconfig.json y los recorridos se guardan en data/quizruns.json.
`}
module.exports = router;
`,
  }),
  pages: (cfg) => cfg.moduleIds.includes('auth') ? {
    'recomendador-admin': {
      title: 'Recomendador',
      html: `  <section>
    <div class="container">
      <h2>${phIcon('target', { size: 22, style: 'vertical-align:-4px;margin-right:9px' })}Quiz recomendador</h2>
      <p class="section-sub">Qué le pregunta el sitio a los visitantes, qué les recomienda y qué contestan de verdad. Los cambios se ven al instante, sin regenerar. Solo visible para administradores.</p>

      <div class="rc-kpis" id="rc-kpis"></div>

      <div class="card" style="margin-bottom:26px">
        <h3>Resultados posibles</h3>
        <p class="muted" style="font-size:.86rem;margin:0 0 12px">Cada opción de cada pregunta suma un voto a uno de estos. El más votado es el que se recomienda. La <strong>clave</strong> es el identificador interno (inicial, pro, empresa): cambiarla desafina las opciones que la usaban, así que el guardado avisa antes de romper nada.</p>
        <div id="rc-resultados"></div>
        <button class="btn ghost" type="button" id="rc-add-resultado" style="width:auto;margin-top:10px">Agregar resultado</button>
      </div>

      <div class="card" style="margin-bottom:26px">
        <h3>Preguntas</h3>
        <p class="muted" style="font-size:.86rem;margin:0 0 12px">En el orden en que se muestran. Cada opción tiene que apuntar a un resultado de la lista de arriba.</p>
        <div id="rc-preguntas"></div>
        <button class="btn ghost" type="button" id="rc-add-pregunta" style="width:auto;margin-top:10px">Agregar pregunta</button>
      </div>

      <div class="card" style="margin-bottom:26px">
        <h3>Textos de la sección</h3>
        <form id="rc-textos">
          <label>Título</label>
          <input name="titulo" required maxlength="90" placeholder="¿Cuál te conviene?">
          <label>Bajada</label>
          <textarea name="intro" rows="2" maxlength="300"></textarea>
          <label>Texto del botón (por defecto)</label>
          <input name="textoBoton" maxlength="40" placeholder="Ver esta opción">
          <span class="muted" style="font-size:.8rem">Cada resultado puede pisarlo con el suyo.</span>
        </form>
        <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" type="button" id="rc-guardar">Guardar cuestionario</button>
          <button class="btn ghost" type="button" id="rc-recargar">Descartar cambios</button>
        </div>
      </div>

      <h3>Qué contesta la gente</h3>
      <div id="rc-stats"><p class="muted">Cargando…</p></div>
      <p style="margin-top:16px"><button class="btn ghost" type="button" id="rc-limpiar" style="width:auto">Borrar los recorridos registrados</button></p>
    </div>
  </section>`,
    },
  } : {},
  clientJs: (cfg) => `/* Módulo recomendador: reemplaza el cuestionario horneado por el administrable (window.WFQuiz)
   y registra el recorrido — la fila nace en la primera respuesta y se actualiza en cada una, que
   es lo que permite saber en qué pregunta abandona la gente.${cfg.moduleIds.includes('auth') ? `
   Con auth activo, el panel vive en /recomendador-admin.html.` : ''} */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Sección pública ----
  // window.WFQuiz lo define el módulo UI y el orden de concatenación de los clientJs no está
  // garantizado, así que se consulta desde un callback asíncrono (cuando el app.js ya corrió).
  if (document.getElementById('quiz-app')) {
    setTimeout(function () {
      var q = window.WFQuiz;
      if (!q) return;
      var runId = '', respuestas = [], enviando = false;

      function guardar(cerrar, resultado, titulo) {
        if (window.__PREVIEW__) return;
        var cuerpo = { respuestas: respuestas };
        if (cerrar) { cuerpo.terminado = true; cuerpo.resultado = resultado; cuerpo.resultadoTitulo = titulo; }
        if (!runId) {
          if (enviando) return;
          enviando = true;
          App.api('/api/recomendador/recorrido', { method: 'POST', body: cuerpo })
            .then(function (r) {
              runId = r.id;
              enviando = false;
              // Si mientras se creaba la fila la persona siguió contestando, se manda lo que hay
              // ahora: sin esta segunda pasada el recorrido quedaría congelado en la respuesta 1.
              if (respuestas.length > cuerpo.respuestas.length || cerrar) guardar(cerrar, resultado, titulo);
            })
            .catch(function () { enviando = false; });
          return;
        }
        App.api('/api/recomendador/recorrido/' + runId, { method: 'PUT', body: cuerpo }).catch(function () {});
      }

      q.alResponder(function (i, pregunta, opcion, valor) {
        respuestas.push({ i: i, pregunta: pregunta || '', opcion: opcion || '', valor: valor || '' });
        guardar(false);
      });

      q.alTerminar(function (valor, resultado, extra) {
        guardar(true, valor, resultado && resultado.titulo);
        respuestas = [];
        // Ojo: el runId NO se limpia acá. "Volver a empezar" arranca un recorrido nuevo, y para
        // eso alcanza con que la primera respuesta encuentre respuestas vacías; pero el pedido
        // de email tiene que poder seguir apuntando al recorrido que se acaba de cerrar.
        var cerrado = runId;
        runId = '';
${cfg.moduleIds.includes('leads') ? `        if (!extra || !cerrado || window.__PREVIEW__) return;
        // Captura de email sobre el resultado: es el único momento del recorrido en que la
        // persona ya sabe qué le conviene, que es cuando dejar el mail tiene sentido para ella.
        extra.innerHTML = '<div class="rc-lead"><p class="muted" style="margin:0 0 8px;font-size:.9rem">¿Te lo mandamos por email para tenerlo a mano?</p>' +
          '<form><input type="email" required placeholder="tu@email.com" aria-label="Tu email"><button class="btn ghost" type="submit">Enviármelo</button></form></div>';
        var f = extra.querySelector('form');
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          var email = f.querySelector('input').value.trim();
          App.api('/api/recomendador/recorrido/' + cerrado + '/email', { method: 'POST', body: { email: email } })
            .then(function (r) {
              extra.innerHTML = '<div class="rc-lead"><p class="muted" style="margin:0;font-size:.9rem">' + App.esc(r.mensaje) + '</p></div>';
              App.toast('Te lo mandamos por email');
            })
            .catch(function (err) { if (err.message !== 'preview') App.toast(err.message); });
        });
` : `        if (extra) extra.innerHTML = '';
`}      });

      if (!window.__PREVIEW__) {
        fetch('/api/recomendador').then(function (r) { return r.json(); })
          .then(function (d) { if (d && d.preguntas) q.setDatos(d); }).catch(function () {});
      }
    }, 0);
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Panel /recomendador-admin.html ----
  var boxRes = document.getElementById('rc-resultados');
  var boxPre = document.getElementById('rc-preguntas');
  var formTex = document.getElementById('rc-textos');
  if (boxRes && boxPre && formTex) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var cfgQ = { titulo: '', intro: '', textoBoton: '', preguntas: [], resultados: [] };

    function pintarResultados() {
      boxRes.innerHTML = cfgQ.resultados.map(function (r, i) {
        return '<div class="card" style="margin-bottom:12px" data-res="' + i + '">' +
          '<div class="grid cols-2">' +
            '<div><label>Clave</label><input data-k="valor" value="' + App.esc(r.valor) + '" maxlength="40" placeholder="inicial"></div>' +
            '<div><label>Título</label><input data-k="titulo" value="' + App.esc(r.titulo) + '" maxlength="90" placeholder="Plan Inicial"></div>' +
          '</div>' +
          '<label>Texto</label><textarea data-k="texto" rows="2" maxlength="300">' + App.esc(r.texto || '') + '</textarea>' +
          '<div class="grid cols-2">' +
            '<div><label>Destino del botón</label><input data-k="enlace" value="' + App.esc(r.enlace || '') + '" maxlength="300" placeholder="/index.html#precios"></div>' +
            '<div><label>Texto del botón</label><input data-k="textoBoton" value="' + App.esc(r.textoBoton || '') + '" maxlength="40" placeholder="Ver esta opción"></div>' +
          '</div>' +
          '<div class="rc-acciones" style="margin-top:12px"><button class="btn ghost" type="button" data-del-res="' + i + '">Borrar resultado</button></div>' +
        '</div>';
      }).join('') || '<p class="muted">Todavía no hay resultados.</p>';
      boxRes.querySelectorAll('[data-del-res]').forEach(function (b) {
        b.addEventListener('click', function () {
          leerDelDom();
          cfgQ.resultados.splice(Number(b.getAttribute('data-del-res')), 1);
          pintarResultados();
          pintarPreguntas();
        });
      });
    }

    function opcionesHtml(valorSel) {
      return cfgQ.resultados.map(function (r) {
        return '<option value="' + App.esc(r.valor) + '"' + (r.valor === valorSel ? ' selected' : '') + '>' + App.esc(r.titulo || r.valor) + '</option>';
      }).join('');
    }

    function pintarPreguntas() {
      boxPre.innerHTML = cfgQ.preguntas.map(function (p, i) {
        var ops = (p.opciones || []).map(function (o, j) {
          return '<div class="rc-op" data-op="' + j + '">' +
            '<div><label>Opción ' + (j + 1) + '</label><input data-k="texto" value="' + App.esc(o.texto) + '" maxlength="160"></div>' +
            '<div><label>Suma a</label><select data-k="valor">' + opcionesHtml(o.valor) + '</select></div>' +
            '<button class="btn ghost" type="button" data-del-op="' + i + ':' + j + '">Quitar</button>' +
          '</div>';
        }).join('');
        return '<div class="card" style="margin-bottom:12px" data-pre="' + i + '">' +
          '<label>Pregunta ' + (i + 1) + '</label>' +
          '<input data-k="pregunta" value="' + App.esc(p.pregunta) + '" maxlength="200">' +
          '<div style="margin-top:12px">' + ops + '</div>' +
          '<div class="rc-acciones" style="margin-top:6px">' +
            '<button class="btn ghost" type="button" data-add-op="' + i + '">Agregar opción</button>' +
            '<button class="btn ghost" type="button" data-del-pre="' + i + '">Borrar pregunta</button>' +
          '</div>' +
        '</div>';
      }).join('') || '<p class="muted">Todavía no hay preguntas.</p>';
      boxPre.querySelectorAll('[data-del-pre]').forEach(function (b) {
        b.addEventListener('click', function () { leerDelDom(); cfgQ.preguntas.splice(Number(b.getAttribute('data-del-pre')), 1); pintarPreguntas(); });
      });
      boxPre.querySelectorAll('[data-add-op]').forEach(function (b) {
        b.addEventListener('click', function () {
          leerDelDom();
          var i = Number(b.getAttribute('data-add-op'));
          cfgQ.preguntas[i].opciones.push({ texto: '', valor: (cfgQ.resultados[0] || {}).valor || '' });
          pintarPreguntas();
        });
      });
      boxPre.querySelectorAll('[data-del-op]').forEach(function (b) {
        b.addEventListener('click', function () {
          leerDelDom();
          var par = b.getAttribute('data-del-op').split(':');
          cfgQ.preguntas[Number(par[0])].opciones.splice(Number(par[1]), 1);
          pintarPreguntas();
        });
      });
    }

    // Lee el DOM ANTES de cualquier repintado: si no, agregar una opción borraría lo que el
    // administrador venía escribiendo en los campos de al lado.
    function leerDelDom() {
      boxRes.querySelectorAll('[data-res]').forEach(function (card) {
        var i = Number(card.getAttribute('data-res'));
        if (!cfgQ.resultados[i]) return;
        card.querySelectorAll('[data-k]').forEach(function (el) { cfgQ.resultados[i][el.getAttribute('data-k')] = el.value; });
      });
      boxPre.querySelectorAll('[data-pre]').forEach(function (card) {
        var i = Number(card.getAttribute('data-pre'));
        if (!cfgQ.preguntas[i]) return;
        var campo = card.querySelector('[data-k="pregunta"]');
        if (campo) cfgQ.preguntas[i].pregunta = campo.value;
        card.querySelectorAll('[data-op]').forEach(function (fila) {
          var j = Number(fila.getAttribute('data-op'));
          if (!cfgQ.preguntas[i].opciones[j]) return;
          fila.querySelectorAll('[data-k]').forEach(function (el) { cfgQ.preguntas[i].opciones[j][el.getAttribute('data-k')] = el.value; });
        });
      });
      ['titulo', 'intro', 'textoBoton'].forEach(function (k) {
        var el = formTex.querySelector('[name="' + k + '"]');
        if (el) cfgQ[k] = el.value;
      });
    }

    function pintarTodo() {
      ['titulo', 'intro', 'textoBoton'].forEach(function (k) {
        var el = formTex.querySelector('[name="' + k + '"]');
        if (el) el.value = cfgQ[k] || '';
      });
      pintarResultados();
      pintarPreguntas();
    }

    function pintarStats(d) {
      var kpis = document.getElementById('rc-kpis');
      var pct = d.total ? Math.round((d.terminados / d.total) * 100) : 0;
      if (kpis) {
        kpis.innerHTML =
          '<div class="rc-kpi"><strong>' + d.total + '</strong><span>empezaron el quiz</span></div>' +
          '<div class="rc-kpi"><strong>' + d.terminados + '</strong><span>llegaron al resultado</span></div>' +
          '<div class="rc-kpi"><strong>' + pct + '%</strong><span>lo terminan</span></div>' +
          '<div class="rc-kpi"><strong>' + d.conEmail + '</strong><span>dejaron su email</span></div>';
        var anime = window.anime;
        if (anime && anime.animate && !reduce) {
          anime.animate(kpis.children, { opacity: [0, 1], translateY: [10, 0], duration: 420, delay: anime.stagger ? anime.stagger(60) : 0, ease: 'outCubic' });
          // Red de seguridad para la pestaña oculta (el loop de Anime no corre y quedarían en 0)
          setTimeout(function () {
            Array.prototype.forEach.call(kpis.children, function (c) { c.style.opacity = 1; c.style.transform = 'none'; });
          }, 900);
        }
      }
      var box = document.getElementById('rc-stats');
      if (!box) return;
      var maxR = d.ranking.reduce(function (m, r) { return Math.max(m, r.veces); }, 0) || 1;
      var ranking = d.ranking.length
        ? '<div class="card"><h4 style="margin:0 0 12px">Qué recomienda</h4>' + d.ranking.map(function (r) {
            return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:.9rem"><span>' + App.esc(r.titulo) + '</span><strong>' + r.veces + '</strong></div>' +
              '<div class="rc-barra"><i style="width:' + Math.round((r.veces / maxR) * 100) + '%"></i></div></div>';
          }).join('') + '</div>'
        : '<p class="muted">Todavía nadie terminó el cuestionario.</p>';
      var abandono = '<div class="card" style="margin-top:16px"><h4 style="margin:0 0 12px">Dónde se van</h4>' +
        App.table(d.abandono, [
          { label: 'Pregunta', render: function (a) { return (a.i + 1) + '. ' + App.esc(a.pregunta); } },
          { label: 'La vieron', render: function (a) { return String(a.llegaron); } },
          { label: 'Se fueron acá', render: function (a) { return '<strong>' + a.abandonaron + '</strong>'; } },
        ]) + '</div>';
      var recientes = '<div class="card" style="margin-top:16px"><h4 style="margin:0 0 12px">Últimos recorridos</h4>' +
        App.table(d.recientes, [
          { label: 'Cuándo', render: function (r) { return r.createdAt ? new Date(r.createdAt).toLocaleString('es-AR') : '—'; } },
          { label: 'Respondió', render: function (r) { return App.esc(r.respuestas.join(' · ')) || '—'; } },
          { label: 'Resultado', render: function (r) { return r.terminado ? App.esc(r.resultado || '—') : '<span class="muted">abandonó</span>'; } },
          { label: 'Email', render: function (r) { return r.email ? App.esc(r.email) : '—'; } },
        ]) + '</div>';
      box.innerHTML = ranking + abandono + recientes;
      // Las barras se animan de 0 al valor: se pintan con width 0 y se llevan a su ancho
      var anime2 = window.anime;
      if (anime2 && anime2.animate && !reduce) {
        box.querySelectorAll('.rc-barra i').forEach(function (b) {
          var w = b.style.width;
          b.style.width = '0%';
          anime2.animate(b, { width: w, duration: 700, ease: 'outCubic' });
          setTimeout(function () { b.style.width = w; }, 1100);
        });
      }
    }

    async function cargar() {
      if (window.__PREVIEW__) {
        cfgQ = { titulo: '¿Cuál te conviene?', intro: 'Respondé 3 preguntas rápidas.', textoBoton: 'Ver esta opción',
          resultados: [{ valor: 'inicial', titulo: 'Plan Inicial', texto: '', enlace: '', textoBoton: '' }],
          preguntas: [{ pregunta: '¿Para qué lo vas a usar?', opciones: [{ texto: 'Un proyecto personal', valor: 'inicial' }, { texto: 'Mi pyme', valor: 'inicial' }] }] };
        pintarTodo();
        pintarStats({ total: 12, terminados: 8, conEmail: 3, ranking: [{ valor: 'inicial', titulo: 'Plan Inicial', veces: 8 }], abandono: [{ i: 0, pregunta: '¿Para qué lo vas a usar?', llegaron: 12, abandonaron: 4 }], recientes: [] });
        return;
      }
      try {
        cfgQ = await App.api('/api/recomendador/config');
        pintarTodo();
        pintarStats(await App.api('/api/recomendador/stats'));
      } catch (err) {
        if (err.message !== 'preview') document.getElementById('rc-stats').innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>';
      }
    }

    document.getElementById('rc-add-resultado').addEventListener('click', function () {
      leerDelDom();
      cfgQ.resultados.push({ valor: '', titulo: '', texto: '', enlace: '', textoBoton: '' });
      pintarResultados();
    });
    document.getElementById('rc-add-pregunta').addEventListener('click', function () {
      leerDelDom();
      var v = (cfgQ.resultados[0] || {}).valor || '';
      cfgQ.preguntas.push({ pregunta: '', opciones: [{ texto: '', valor: v }, { texto: '', valor: v }] });
      pintarPreguntas();
    });
    document.getElementById('rc-recargar').addEventListener('click', cargar);
    document.getElementById('rc-guardar').addEventListener('click', async function () {
      leerDelDom();
      if (window.__PREVIEW__) { App.toast('Vista previa: se guardaría el cuestionario'); return; }
      try {
        cfgQ = await App.api('/api/recomendador/config', { method: 'PUT', body: cfgQ });
        pintarTodo();
        App.toast('Cuestionario guardado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });
    document.getElementById('rc-limpiar').addEventListener('click', async function () {
      if (!confirm('¿Borrar todos los recorridos registrados? Las estadísticas vuelven a cero.')) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: se borrarían'); return; }
      try {
        var out = await App.api('/api/recomendador/recorridos', { method: 'DELETE' });
        App.toast('Borrados ' + out.borrados + ' recorridos');
        await cargar();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (!window.__PREVIEW__ && (!me || me.role !== 'admin')) {
      document.getElementById('rc-stats').innerHTML = '<p class="muted">Necesitás una cuenta de administrador para ver esta pantalla.</p>';
      boxRes.style.display = 'none';
      boxPre.style.display = 'none';
      formTex.style.display = 'none';
    } else {
      cargar();
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navE = document.getElementById('nav-recomendador-admin');
    if (navE && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navE.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Quiz recomendador administrable**: el cuestionario vive en la colección \`quizconfig\` ${cfg.moduleIds.includes('auth') ? 'y se edita entero desde `/recomendador-admin.html`' : '(editable en `data/quizconfig.json`; activá **Autenticación** para el panel web)'}, así que cambiar una pregunta **no requiere regenerar ni volver a deployar**. Cada recorrido queda registrado en \`quizruns\`: la fila **nace en la primera respuesta** (no al cargar la página, para que los buscadores no ensucien la medición) y se actualiza en cada una, que es lo que permite saber **en qué pregunta abandona la gente** además de cuántos terminan y qué resultado gana. Cada resultado puede llevar a **su propio destino**. Si cambiás el cuestionario, borrá los recorridos viejos desde el panel: mezclar respuestas de dos cuestionarios distintos da un promedio que no describe a ninguno.${cfg.moduleIds.includes('leads') ? ' Con **Captación de leads** activo, quien pide su recomendación por email entra como lead con origen `recomendador`.' : ''}`,
  ],
};
