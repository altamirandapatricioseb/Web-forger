// Centro de privacidad con backend real: las dos obligaciones legales que todo sitio comercial
// tiene y que hasta ahora el catálogo resolvía a medias. La primera es el CONSENTIMIENTO: el
// módulo UI `cookies` muestra el cartel y guarda la respuesta en el navegador del visitante, que
// es exactamente donde no sirve — si mañana alguien reclama, el negocio no tiene con qué probar
// que esa persona aceptó, y el dato vive en la única computadora a la que el dueño no tiene acceso.
// Acá cada decisión queda registrada en el servidor con su fecha y la versión de la política
// vigente, y el visitante puede cambiarla cuando quiera (revocar tiene que ser tan fácil como
// aceptar: eso también lo dice la ley).
// La segunda son las SOLICITUDES DEL TITULAR: acceso, rectificación, eliminación y oposición.
// El visitante pide desde /privacidad.html, recibe un código y sigue el estado; el negocio las ve
// en su panel con el plazo legal corriendo (10 días corridos en Argentina, Ley 25.326; el RGPD
// europeo da 30). Y para responder de verdad hay dos herramientas que hacen el trabajo pesado:
// "buscar sus datos" recorre TODAS las colecciones del proyecto —las de los módulos activos,
// resueltas al generar, así que cualquier módulo futuro queda cubierto solo— y arma el archivo
// que se le entrega; y "anonimizar" reemplaza los datos personales de esas filas sin borrarlas,
// que es la única forma de cumplir sin romper la contabilidad de un pedido ya facturado.
// Animado con Anime.js (count-up de KPIs, barra de aceptación, entrada de las fichas) + red de
// seguridad. La parte pública funciona sin auth; el panel requiere auth.

module.exports = {
  id: 'privacidad', type: 'functional', name: 'Centro de privacidad',
  description: 'Consentimiento de cookies registrado en el servidor (con fecha y versión de la política: la prueba que el negocio necesita si alguien reclama) y revocable desde /privacidad.html, más solicitudes del titular —acceso, rectificación, eliminación y oposición— con código de seguimiento y plazo legal a la vista. El panel busca los datos de una persona en TODAS las colecciones del proyecto y puede anonimizarlos sin borrar las filas. Con auth, panel /privacidad-admin.html. Animado con Anime.js.',
  usesAnime: true,
  collections: ['consents', 'datareqs', 'privacyconfig'],
  nav: (cfg) => [
    { label: 'Privacidad', href: '/privacidad.html' },
    ...(cfg.moduleIds.includes('auth') ? [{ label: 'Privacidad (admin)', href: '/privacidad-admin.html', id: 'nav-priv-admin' }] : []),
  ],
  head: () => `  <style>
    .pv-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:22px 0}
    .pv-kpis .card{text-align:center}
    .pv-kpis strong{font-size:1.7rem;display:block;font-variant-numeric:tabular-nums}
    .pv-barra{height:10px;border-radius:999px;background:var(--surface);border:1px solid var(--line);overflow:hidden;margin:10px 0 4px}
    .pv-barra i{display:block;height:100%;width:0;background:var(--accent)}
    .pv-est{display:inline-block;font-size:.72rem;padding:1px 9px;border-radius:999px;font-weight:700}
    .pv-est.recibida{background:color-mix(in srgb,var(--accent) 15%,var(--surface));color:var(--accent)}
    .pv-est.proceso{background:#e6a80020;color:#8a6400}
    .pv-est.resuelta{background:#2e9e5b20;color:#1d6b3c}
    .pv-est.rechazada{background:#c0392b1a;color:#c0392b}
    .pv-plazo{font-size:.78rem;font-weight:700}
    .pv-plazo.vencido{color:#c0392b}
    .pv-opcion{display:flex;gap:14px;align-items:flex-start;border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;margin-bottom:12px;background:var(--surface);cursor:pointer}
    .pv-opcion input{width:auto;margin-top:4px;flex:none}
    .pv-opcion strong{display:block}
    .pv-estado-actual{border-left:3px solid var(--accent);padding:14px 18px;background:var(--surface);border-radius:0 var(--radius) var(--radius) 0;margin:18px 0}
    .pv-datos{max-height:340px;overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px;font-family:ui-monospace,'Cascadia Code','Courier New',monospace;font-size:.78rem;white-space:pre-wrap;word-break:break-word}
    .pv-code{font-family:ui-monospace,'Cascadia Code','Courier New',monospace;font-weight:700;letter-spacing:.04em}
  </style>`,
  files: (cfg) => {
    // Colecciones donde puede haber datos personales: todas las del proyecto menos las propias del
    // módulo y la de usuarios (que tiene su propia baja de cuenta). Se resuelven AL GENERAR, así
    // que un módulo agregado después queda cubierto sin tocar una línea de acá.
    const PROPIAS = ['consents', 'datareqs', 'users'];
    const buscables = (cfg.collections || []).filter(c => !PROPIAS.includes(c));
    const conAuth = cfg.moduleIds.includes('auth');
    return {
      'routes/privacidad.js': `const router = require('express').Router();
const crypto = require('crypto');
const db = require('../src/db');
const { str, isEmail } = require('../src/validate');
${conAuth ? "const { requireAdmin } = require('../src/middleware/auth');" : '// Sin el módulo de autenticación no se generan endpoints de administración'}

// Colecciones donde se buscan los datos personales de una persona (resueltas al generar el
// proyecto según los módulos activos). Se excluyen las propias del módulo y la de usuarios.
const BUSCABLES = ${JSON.stringify(buscables)};

// Campos que NUNCA se devuelven en una exportación de datos: son secretos del sistema, no
// datos del titular (entregar el hash de una contraseña sería regalar el material para romperla).
const SECRETOS = ['password', 'passwordHash', 'hash', 'token', 'resetToken', 'bypassKey', 'secret'];

// Campos que se limpian al anonimizar, además del que trajo la coincidencia
const PERSONALES = ['name', 'nombre', 'apellido', 'email', 'mail', 'telefono', 'phone', 'tel',
  'direccion', 'address', 'dni', 'documento', 'cuit', 'empresa', 'contacto'];

const TIPOS = ['acceso', 'rectificacion', 'eliminacion', 'oposicion'];
const ESTADOS = ['recibida', 'proceso', 'resuelta', 'rechazada'];
const OPCIONES = ['accepted', 'essential', 'rejected'];

// Plazo legal de respuesta: 10 días corridos (Ley 25.326 de Argentina para el derecho de acceso).
// El panel lo muestra corriendo, que es la única forma de que no se venza por olvido.
const PLAZO_DIAS = 10;

const hoy = () => new Date().toISOString().slice(0, 10);
const codigo = () => 'PR-' + crypto.randomBytes(3).toString('hex').toUpperCase();
const norm = (s) => String(s || '').trim().toLowerCase();
const dispositivo = (ua) => /Mobi|Android|iPhone|iPad|iPod/i.test(String(ua || '')) ? 'móvil' : 'escritorio';

// Días que faltan (o que se pasaron) para responder dentro del plazo legal
function plazo(r) {
  const limite = new Date(new Date(r.createdAt).getTime() + PLAZO_DIAS * 86400000);
  return Math.ceil((limite - Date.now()) / 86400000);
}

// Lo que ve el titular de su propia solicitud: nunca la nota interna del negocio
const vistaPublica = (r) => ({ code: r.code, tipo: r.tipo, estado: r.estado, createdAt: r.createdAt, resueltaAt: r.resueltaAt || '' });
const vistaAdmin = (r) => ({ ...r, diasRestantes: plazo(r) });

/* ---------- Versión de la política ---------- */

// La versión vigente de la política de privacidad. Importa porque el consentimiento se da SOBRE
// UNA POLÍTICA CONCRETA: si el negocio cambia lo que hace con los datos, lo que la gente aceptó
// antes ya no cubre lo nuevo y hay que volver a preguntar. El módulo UI "cookies" consulta esta
// versión (window.WFConsentVersion) y vuelve a mostrar el cartel a quien aceptó una anterior.
async function politica() {
  const rows = await db.all('privacyconfig');
  if (rows.length) return rows[0];
  return db.insert('privacyconfig', { version: 'v1', publicadaAt: new Date().toISOString() });
}

// GET /api/privacidad/politica — público: la versión vigente
router.get('/politica', async (req, res) => {
  const p = await politica();
  res.json({ version: p.version, publicadaAt: p.publicadaAt });
});

/* ---------- Consentimiento ---------- */

// POST /api/privacidad/consentimiento — registra (o cambia) la decisión de este navegador.
// Es público a propósito: lo llama el visitante anónimo al elegir en el cartel de cookies.
router.post('/consentimiento', async (req, res) => {
  const vid = String(req.body.vid || '').trim();
  // El identificador lo genera el navegador y es un número al azar: no identifica a una persona,
  // solo permite que ESE navegador pueda ver y cambiar después lo que eligió.
  if (!/^[a-f0-9]{8,32}$/i.test(vid)) return res.status(422).json({ error: 'Identificador de navegador inválido' });
  const choice = OPCIONES.includes(req.body.choice) ? req.body.choice : null;
  if (!choice) return res.status(422).json({ error: 'Opción de consentimiento inválida' });

  const previo = (await db.find('consents', c => c.vid === vid))[0];
  const datos = {
    choice,
    // La versión de la política la pone EL SERVIDOR, no el navegador: si el visitante pudiera
    // declarar contra qué política aceptó, la prueba que este registro existe para dar no valdría.
    politica: (await politica()).version,
    pagina: String(req.body.pagina || '').slice(0, 120),
    disp: dispositivo(req.headers['user-agent']),
    updatedAt: new Date().toISOString(),
  };
  if (previo) {
    // Se guarda cuántas veces cambió de opinión: es parte de la prueba, no un dato de más
    const out = await db.update('consents', previo.id, { ...datos, cambios: (previo.cambios || 0) + 1 });
    return res.json({ ok: true, choice: out.choice, updatedAt: out.updatedAt });
  }
  const out = await db.insert('consents', { vid, ...datos, cambios: 0 });
  res.status(201).json({ ok: true, choice: out.choice, updatedAt: out.updatedAt });
});

// GET /api/privacidad/consentimiento/:vid — qué eligió este navegador (público, por su propio id)
router.get('/consentimiento/:vid', async (req, res) => {
  const c = (await db.find('consents', x => x.vid === req.params.vid))[0];
  if (!c) return res.json({ registrado: false });
  res.json({ registrado: true, choice: c.choice, updatedAt: c.updatedAt, politica: c.politica });
});

/* ---------- Solicitudes del titular ---------- */

// POST /api/privacidad/solicitudes — el visitante ejerce sus derechos (público)
router.post('/solicitudes', async (req, res) => {
  if (!str(req.body.name, 2, 80)) return res.status(422).json({ error: 'El nombre va entre 2 y 80 caracteres' });
  if (!isEmail(req.body.email)) return res.status(422).json({ error: 'Email inválido' });
  if (!TIPOS.includes(req.body.tipo)) return res.status(422).json({ error: 'Tipo de solicitud inválido' });
  if (req.body.detalle && !str(req.body.detalle, 0, 1000)) return res.status(422).json({ error: 'El detalle no puede pasar de 1000 caracteres' });

  // Una solicitud abierta por email y tipo alcanza: pedir tres veces lo mismo no acelera nada
  // y multiplicar filas idénticas solo esconde las que sí hay que atender.
  const abierta = (await db.find('datareqs', r => norm(r.email) === norm(req.body.email) &&
    r.tipo === req.body.tipo && (r.estado === 'recibida' || r.estado === 'proceso')))[0];
  if (abierta) return res.status(409).json({ error: 'Ya tenés una solicitud de este tipo en curso', code: abierta.code });

  const fila = await db.insert('datareqs', {
    code: codigo(),
    name: String(req.body.name).trim(),
    email: String(req.body.email).trim(),
    tipo: req.body.tipo,
    detalle: String(req.body.detalle || '').trim(),
    estado: 'recibida',
    nota: '',
    resueltaAt: '',
    anonimizados: 0,
  });
  ${cfg.moduleIds.includes('mailer') ? `// Con el módulo de avisos activo, el negocio se entera al toque (disparar y seguir: un email
  // caído no puede tumbar el alta de una solicitud legal)
  try {
    const mailer = require('../src/mailer');
    mailer.notify('Nueva solicitud de privacidad (' + fila.tipo + ')',
      'Código: ' + fila.code + '\\\\nDe: ' + fila.name + ' <' + fila.email + '>\\\\nDetalle: ' + (fila.detalle || '(sin detalle)') +
      '\\\\n\\\\nTenés ' + PLAZO_DIAS + ' días corridos para responder.').catch(() => {});
  } catch { /* el módulo de avisos no está disponible */ }
  ` : ''}res.status(201).json(vistaPublica(fila));
});

// GET /api/privacidad/solicitudes/:code/estado — seguimiento con el código (público).
// Va antes que las rutas de admin con :id para que un código nunca se confunda con un id.
router.get('/solicitudes/:code/estado', async (req, res) => {
  const r = (await db.find('datareqs', x => String(x.code).toUpperCase() === String(req.params.code).toUpperCase()))[0];
  if (!r) return res.status(404).json({ error: 'No encontramos ninguna solicitud con ese código' });
  res.json(vistaPublica(r));
});
${conAuth ? `
/* ---------- Panel del negocio ---------- */

// GET /api/privacidad/admin — solicitudes con su plazo (solo admin)
router.get('/admin', requireAdmin, async (req, res) => {
  res.json((await db.all('datareqs')).slice().reverse().map(vistaAdmin));
});

// GET /api/privacidad/admin/stats — KPIs (solo admin)
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const cs = await db.all('consents');
  const rs = await db.all('datareqs');
  const abiertas = rs.filter(r => r.estado === 'recibida' || r.estado === 'proceso');
  const p = await politica();
  res.json({
    consentimientos: cs.length,
    aceptaron: cs.filter(c => c.choice === 'accepted').length,
    solicitudes: rs.length,
    pendientes: abiertas.length,
    vencidas: abiertas.filter(r => plazo(r) < 0).length,
    politica: p.version,
    politicaDesde: p.publicadaAt,
    // Cuántos de los consentimientos guardados corresponden a una política anterior: son los
    // que ya no cubren lo que el sitio hace hoy y a quienes se les va a volver a preguntar
    desactualizados: cs.filter(c => String(c.politica || '') !== p.version).length,
  });
});

// POST /api/privacidad/admin/politica — publica una versión nueva de la política.
// Efecto real: a todo el que había aceptado una versión anterior le vuelve a aparecer el cartel.
// No se toca ningún consentimiento guardado: la prueba de lo que cada uno aceptó, y sobre qué
// política lo aceptó, es justamente lo que no se puede reescribir.
router.post('/admin/politica', requireAdmin, async (req, res) => {
  const p = await politica();
  const n = parseInt(String(p.version).replace(/\\D/g, ''), 10) || 1;
  const out = await db.update('privacyconfig', p.id, {
    version: 'v' + (n + 1), publicadaAt: new Date().toISOString(),
  });
  res.json({ version: out.version, publicadaAt: out.publicadaAt });
});

// GET /api/privacidad/admin/:id/datos — busca los datos de esa persona en TODAS las colecciones
// del proyecto. Es lo que se le entrega ante un pedido de acceso, y lo que hay que mirar antes
// de anonimizar: sin esto, "borrar mis datos" se responde a ojo. (solo admin)
router.get('/admin/:id/datos', requireAdmin, async (req, res) => {
  const r = await db.get('datareqs', req.params.id);
  if (!r) return res.status(404).json({ error: 'Solicitud inexistente' });
  const email = norm(r.email);
  const encontrado = {};
  let total = 0;
  for (const col of BUSCABLES) {
    let filas;
    try { filas = await db.all(col); } catch { continue; }
    const mias = filas.filter(f => Object.values(f).some(v => typeof v === 'string' && norm(v) === email));
    if (!mias.length) continue;
    encontrado[col] = mias.map(f => {
      const limpia = { ...f };
      for (const k of Object.keys(limpia)) if (SECRETOS.includes(k)) delete limpia[k];
      return limpia;
    });
    total += mias.length;
  }
  res.json({ email: r.email, total, colecciones: encontrado, generadoEl: new Date().toISOString() });
});

// POST /api/privacidad/admin/:id/anonimizar — reemplaza los datos personales de esa persona en
// todas las colecciones SIN borrar las filas. Se anonimiza en vez de borrar porque un pedido ya
// facturado o una reserva pasada tienen que seguir existiendo para la contabilidad del negocio:
// lo que la ley exige que desaparezca es el dato personal, no el registro de la operación.
// (solo admin)
router.post('/admin/:id/anonimizar', requireAdmin, async (req, res) => {
  const r = await db.get('datareqs', req.params.id);
  if (!r) return res.status(404).json({ error: 'Solicitud inexistente' });
  const email = norm(r.email);
  let tocadas = 0;
  const detalle = {};
  for (const col of BUSCABLES) {
    let filas;
    try { filas = await db.all(col); } catch { continue; }
    for (const f of filas) {
      if (!Object.values(f).some(v => typeof v === 'string' && norm(v) === email)) continue;
      const patch = {};
      for (const [k, v] of Object.entries(f)) {
        if (k === 'id' || k === 'createdAt') continue;
        if (typeof v !== 'string') continue;
        if (norm(v) === email || PERSONALES.includes(k)) patch[k] = '(dato eliminado)';
      }
      if (!Object.keys(patch).length) continue;
      await db.update(col, f.id, patch);
      tocadas++;
      detalle[col] = (detalle[col] || 0) + 1;
    }
  }
  const out = await db.update('datareqs', r.id, {
    anonimizados: (r.anonimizados || 0) + tocadas,
    nota: (r.nota ? r.nota + ' | ' : '') + 'Anonimizados ' + tocadas + ' registros el ' + hoy(),
  });
  res.json({ ok: true, tocadas, detalle, solicitud: vistaAdmin(out) });
});

// PUT /api/privacidad/admin/:id — estado y nota interna (solo admin)
router.put('/admin/:id', requireAdmin, async (req, res) => {
  const r = await db.get('datareqs', req.params.id);
  if (!r) return res.status(404).json({ error: 'Solicitud inexistente' });
  const patch = {};
  if (req.body.estado !== undefined) {
    if (!ESTADOS.includes(req.body.estado)) return res.status(422).json({ error: 'Estado inválido' });
    patch.estado = req.body.estado;
    // La fecha de resolución la pone el servidor: es el dato que prueba que se respondió a tiempo
    if (req.body.estado === 'resuelta' || req.body.estado === 'rechazada') patch.resueltaAt = new Date().toISOString();
  }
  if (req.body.nota !== undefined) {
    if (req.body.nota && !str(req.body.nota, 0, 600)) return res.status(422).json({ error: 'La nota no puede pasar de 600 caracteres' });
    patch.nota = String(req.body.nota || '').trim();
  }
  res.json(vistaAdmin(await db.update('datareqs', r.id, patch)));
});
` : ''}
module.exports = router;
`,
    };
  },
  mounts: [{ route: '/api/privacidad', file: 'routes/privacidad.js' }],
  pages: (cfg) => {
    const paginas = {
      privacidad: {
        title: 'Privacidad',
        html: `  <section>
    <div class="container" style="max-width:760px">
      <h2>Centro de privacidad</h2>
      <p class="section-sub">Acá decidís qué hacemos con tus datos: podés cambiar tus preferencias cuando quieras y pedirnos una copia, una corrección o la eliminación de la información que tengamos tuya.</p>

      <h3 style="margin-top:34px">Tus preferencias</h3>
      <div id="pv-estado" class="pv-estado-actual"><span class="muted">Cargando…</span></div>
      <form id="pv-pref-form">
        <label class="pv-opcion"><input type="radio" name="choice" value="accepted"><span><strong>Aceptar todo</strong><span class="muted">Nos dejás usar el almacenamiento del navegador para recordar tus elecciones y entender qué partes del sitio se usan más.</span></span></label>
        <label class="pv-opcion"><input type="radio" name="choice" value="essential"><span><strong>Solo lo indispensable</strong><span class="muted">Únicamente lo que el sitio necesita para funcionar (tu sesión, el carrito, tus preferencias).</span></span></label>
        <label class="pv-opcion"><input type="radio" name="choice" value="rejected"><span><strong>Rechazar</strong><span class="muted">Nada más allá de lo estrictamente técnico. Algunas funciones pueden dejar de recordar lo que hacías.</span></span></label>
        <button class="btn" type="submit">Guardar mis preferencias</button>
      </form>

      <h3 style="margin-top:40px">Pedidos sobre tus datos</h3>
      <p class="muted">Contestamos dentro de los 10 días corridos. Te damos un código para que sigas el estado sin tener que escribirnos de nuevo.</p>
      <form id="pv-sol-form" class="card">
        <div class="grid cols-2" style="gap:14px">
          <div><label>Nombre</label><input name="name" required maxlength="80"></div>
          <div><label>Email</label><input name="email" type="email" required placeholder="el mismo que usaste con nosotros"></div>
        </div>
        <label>Qué querés pedirnos</label>
        <select name="tipo">
          <option value="acceso">Una copia de los datos que tienen míos</option>
          <option value="rectificacion">Corregir un dato equivocado</option>
          <option value="eliminacion">Eliminar mis datos</option>
          <option value="oposicion">Que dejen de usarlos para enviarme cosas</option>
        </select>
        <label>Detalle (opcional)</label>
        <textarea name="detalle" rows="3" maxlength="1000" placeholder="Contanos qué necesitás con más precisión."></textarea>
        <button class="btn" type="submit" style="margin-top:14px">Enviar el pedido</button>
      </form>
      <div id="pv-sol-ok"></div>

      <h3 style="margin-top:40px">Seguir un pedido</h3>
      <form id="pv-seg-form" style="display:flex;gap:10px;flex-wrap:wrap">
        <input name="code" placeholder="PR-A1B2C3" style="flex:1 1 200px" maxlength="12" required>
        <button class="btn ghost" type="submit">Consultar</button>
      </form>
      <div id="pv-seg-res"></div>
    </div>
  </section>`,
      },
    };
    if (cfg.moduleIds.includes('auth')) {
      paginas['privacidad-admin'] = {
        title: 'Privacidad',
        html: `  <section>
    <div class="container" style="max-width:1000px">
      <h2>Privacidad</h2>
      <p class="section-sub">Los consentimientos registrados y los pedidos de las personas sobre sus datos, con el plazo legal a la vista. Solo visible para administradores.</p>
      <div class="pv-kpis" id="pv-kpis"></div>
      <div class="card">
        <strong>Aceptación del aviso de cookies</strong>
        <div class="pv-barra"><i id="pv-barra"></i></div>
        <span class="muted" id="pv-barra-txt" style="font-size:.85rem">—</span>
      </div>
      <div class="card" style="margin-top:18px">
        <strong>Versión de la política</strong>
        <p class="muted" style="margin:6px 0 0;font-size:.88rem" id="pv-politica-txt">—</p>
        <p class="muted" style="margin:10px 0 0;font-size:.82rem">Publicá una versión nueva cuando cambies qué datos guardás o para qué los usás: a todo el que había aceptado la anterior le vuelve a aparecer el cartel. Los consentimientos ya registrados no se tocan.</p>
        <button class="btn ghost" type="button" id="pv-nueva-politica" style="width:auto;margin-top:14px">Publicar versión nueva</button>
      </div>
      <div id="pv-lista" style="margin-top:26px"><p class="muted">Cargando…</p></div>
      <div id="pv-detalle"></div>
      <div style="margin-top:18px"><button class="btn ghost" type="button" id="pv-csv">Descargar CSV</button></div>
    </div>
  </section>`,
      };
    }
    return paginas;
  },
  clientJs: (cfg) => `/* Módulo centro de privacidad: registra en el servidor la decisión sobre cookies de cada
   navegador (con fecha y versión de la política), la deja cambiar desde /privacidad.html y
   gestiona los pedidos de acceso/corrección/eliminación. Panel solo-admin.
   Animado con Anime.js (count-up, barra de aceptación) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = JSON.parse(localStorage.getItem('user') || 'null');
  var navPriv = document.getElementById('nav-priv-admin');
  if (navPriv && (!me || me.role !== 'admin') && !window.__PREVIEW__) navPriv.style.display = 'none';

  // Identificador al azar de ESTE navegador: no dice quién es la persona, solo permite que
  // vuelva a ver y a cambiar lo que eligió. Sin él, "revocar el consentimiento" sería imposible.
  function vid() {
    try {
      var v = localStorage.getItem('pv-vid');
      if (!v) {
        v = (crypto && crypto.getRandomValues)
          ? Array.from(crypto.getRandomValues(new Uint8Array(8))).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('')
          : (Date.now().toString(16) + Math.random().toString(16).slice(2, 10)).slice(0, 16);
        localStorage.setItem('pv-vid', v);
      }
      return v;
    } catch (e) { return ''; }
  }

  // Versión vigente de la política, publicada como PROMESA para el módulo UI "cookies": si el
  // negocio publica una versión nueva, el cartel vuelve a aparecerle a quien había aceptado la
  // anterior. Sin este puente, cambiar lo que el sitio hace con los datos dejaba corriendo un
  // consentimiento dado sobre otra política — que es justamente lo que la ley no permite.
  window.WFConsentVersion = window.__PREVIEW__
    ? Promise.resolve('v1')
    : fetch('/api/privacidad/politica').then(function (r) { return r.json(); })
        .then(function (d) { return (d && d.version) || null; });

  var ultimaOpcion = '';
  var ultimaMarca = 0;

  function registrar(choice) {
    var id = vid();
    if (!id || window.__PREVIEW__) return Promise.resolve();
    // El cartel avisa de DOS maneras (el evento 'wf:consent' y el clic que este módulo captura,
    // para el caso de un cartel que no sea el del módulo "cookies"). Sin esta guarda la misma
    // elección se registraría dos veces y el contador de cambios de opinión —que es parte de la
    // prueba— diría que la persona cambió de idea cuando nunca lo hizo.
    var ahora = Date.now();
    if (choice === ultimaOpcion && ahora - ultimaMarca < 2000) return Promise.resolve();
    ultimaOpcion = choice;
    ultimaMarca = ahora;
    // Se manda con fetch directo (no App.api): esto corre en TODAS las páginas para visitantes
    // anónimos y no debe arrastrar el token de sesión de nadie. La versión de la política NO se
    // manda: la pone el servidor, que es el único que no se puede editar desde la consola.
    return fetch('/api/privacidad/consentimiento', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vid: id, choice: choice, pagina: location.pathname }),
    }).catch(function () {});
  }

  // Punto de entrada del módulo UI "cookies": avisa su elección con este evento
  document.addEventListener('wf:consent', function (e) {
    var d = e.detail || {};
    if (d.choice) registrar(d.choice);
  });

  // Respaldo: cualquier cartel de consentimiento que use botones [data-consent] queda cubierto,
  // aunque no emita el evento. Los dos caminos conviven gracias a la guarda de registrar().
  document.addEventListener('click', function (e) {
    var t = e.target;
    var choice = t && t.dataset && t.dataset.consent;
    if (choice) registrar(choice);
  }, true);
${cfg.moduleIds.includes('cookies') ? '' : `
  // Sin el módulo "cookies" activo, el aviso lo pone este módulo: pedir el consentimiento es la
  // mitad del trabajo, y sin cartel no hay nada que registrar.
  (function () {
    var elegido = null;
    try { elegido = localStorage.getItem('cookie-consent'); } catch (e) {}
    if (elegido || window.__PREVIEW__) return;
    var estilo = document.createElement('style');
    estilo.textContent = '.pv-banner{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:40;' +
      'display:flex;flex-wrap:wrap;gap:12px;align-items:center;max-width:min(680px,calc(100vw - 32px));' +
      'background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);' +
      'padding:14px 18px;box-shadow:0 8px 30px rgba(0,0,0,.18)}' +
      '.pv-banner p{margin:0;font-size:.9rem;flex:1 1 240px}.pv-banner .btn{padding:8px 14px;font-size:.85rem}';
    document.head.appendChild(estilo);
    var caja = document.createElement('div');
    caja.className = 'pv-banner';
    caja.setAttribute('role', 'dialog');
    caja.setAttribute('aria-label', 'Aviso de privacidad');
    caja.innerHTML = '<p>Usamos el almacenamiento del navegador para que el sitio funcione. Podés cambiar esto cuando quieras en <a href="/privacidad.html">Privacidad</a>.</p>' +
      '<button class="btn" data-consent="accepted">Aceptar</button>' +
      '<button class="btn ghost" data-consent="essential">Solo esenciales</button>';
    caja.addEventListener('click', function (e) {
      var choice = e.target.dataset && e.target.dataset.consent;
      if (!choice) return;
      try { localStorage.setItem('cookie-consent', choice); } catch (err) {}
      caja.remove();
    });
    document.body.appendChild(caja);
  })();
`}
  /* ---------- Página pública /privacidad.html ---------- */
  var cajaEstado = document.getElementById('pv-estado');
  if (cajaEstado) {
    var formPref = document.getElementById('pv-pref-form');
    var formSol = document.getElementById('pv-sol-form');
    var formSeg = document.getElementById('pv-seg-form');
    var okSol = document.getElementById('pv-sol-ok');
    var resSeg = document.getElementById('pv-seg-res');
    var NOMBRES = { accepted: 'Aceptaste todo', essential: 'Aceptaste solo lo indispensable', rejected: 'Rechazaste el almacenamiento no técnico' };

    function pintarEstado(d) {
      if (!d || !d.registrado) {
        cajaEstado.innerHTML = '<span class="muted">Todavía no registramos ninguna preferencia tuya desde este navegador.</span>';
        return;
      }
      cajaEstado.innerHTML = '<strong>' + App.esc(NOMBRES[d.choice] || d.choice) + '</strong><br>' +
        '<span class="muted" style="font-size:.88rem">Guardado el ' + new Date(d.updatedAt).toLocaleString('es-AR') + ' · queda registrado en nuestro servidor como prueba de tu decisión.</span>';
      var radio = formPref.querySelector('[value="' + d.choice + '"]');
      if (radio) radio.checked = true;
    }

    if (window.__PREVIEW__) {
      pintarEstado({ registrado: true, choice: 'essential', updatedAt: new Date().toISOString() });
    } else {
      fetch('/api/privacidad/consentimiento/' + vid()).then(function (r) { return r.json(); }).then(pintarEstado).catch(function () {
        cajaEstado.innerHTML = '<span class="muted">No pudimos consultar tus preferencias.</span>';
      });
    }

    formPref.addEventListener('submit', async function (e) {
      e.preventDefault();
      var sel = formPref.querySelector('[name="choice"]:checked');
      if (!sel) { App.toast('Elegí una opción'); return; }
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se guardan tus preferencias'); return; }
      // La decisión se guarda TAL CUAL en el navegador (incluido 'rejected') además de mandarla al
      // servidor: es lo que consultan los otros módulos antes de medir o guardar nada. Traducir el
      // rechazo a "solo esenciales" para que el cartel no vuelva a salir sería hacerle decir a la
      // persona algo que no dijo.
      try { localStorage.setItem('cookie-consent', sel.value); } catch (err) {}
      await registrar(sel.value);
      pintarEstado({ registrado: true, choice: sel.value, updatedAt: new Date().toISOString() });
      App.toast('Listo: guardamos tus preferencias');
    });

    formSol.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se envía el pedido'); return; }
      try {
        var r = await App.api('/api/privacidad/solicitudes', { method: 'POST', body: {
          name: formSol.querySelector('[name="name"]').value,
          email: formSol.querySelector('[name="email"]').value,
          tipo: formSol.querySelector('[name="tipo"]').value,
          detalle: formSol.querySelector('[name="detalle"]').value,
        } });
        formSol.reset();
        okSol.innerHTML = '<div class="pv-estado-actual"><strong>Recibimos tu pedido</strong><br>' +
          'Guardá este código para seguirlo: <span class="pv-code">' + App.esc(r.code) + '</span><br>' +
          '<span class="muted" style="font-size:.88rem">Te respondemos dentro de los 10 días corridos.</span></div>';
        okSol.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
      } catch (err) {
        if (err.message === 'preview') return;
        // Si ya hay una en curso, el servidor devuelve su código: se lo mostramos igual
        if (err.data && err.data.code) {
          okSol.innerHTML = '<div class="pv-estado-actual"><strong>' + App.esc(err.message) + '</strong><br>Su código es <span class="pv-code">' + App.esc(err.data.code) + '</span></div>';
        } else { App.toast(err.message); }
      }
    });

    formSeg.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (window.__PREVIEW__) { App.toast('Vista previa: acá se consulta el estado'); return; }
      var ESTADO_TXT = { recibida: 'Recibida, todavía sin abrir', proceso: 'En curso', resuelta: 'Resuelta', rechazada: 'Rechazada' };
      try {
        var r = await App.api('/api/privacidad/solicitudes/' + encodeURIComponent(formSeg.querySelector('[name="code"]').value.trim()) + '/estado');
        resSeg.innerHTML = '<div class="pv-estado-actual"><strong>' + App.esc(ESTADO_TXT[r.estado] || r.estado) + '</strong><br>' +
          '<span class="muted" style="font-size:.88rem">Pedido de ' + App.esc(r.tipo) + ' · ingresado el ' + new Date(r.createdAt).toLocaleDateString('es-AR') +
          (r.resueltaAt ? ' · respondido el ' + new Date(r.resueltaAt).toLocaleDateString('es-AR') : '') + '</span></div>';
      } catch (err) { if (err.message !== 'preview') resSeg.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; }
    });
  }

  /* ---------- Panel del negocio ---------- */
  var kpis = document.getElementById('pv-kpis');
  if (!kpis) return;
  var lista = document.getElementById('pv-lista');
  var detalle = document.getElementById('pv-detalle');
  var solicitudes = [];
  var ESTADOS = { recibida: 'recibida', proceso: 'en curso', resuelta: 'resuelta', rechazada: 'rechazada' };
  var TIPOS = { acceso: 'copia de sus datos', rectificacion: 'corrección', eliminacion: 'eliminación', oposicion: 'oposición' };

  function contar(el, hasta) {
    if (!el) return;
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) { el.textContent = Number(hasta).toLocaleString('es-AR'); return; }
    var st = { v: 0 };
    anime.animate(st, { v: hasta, duration: 600, ease: 'outCubic', onUpdate: function () { el.textContent = Math.round(st.v).toLocaleString('es-AR'); } });
    // Red de seguridad: fija el valor final si el loop está pausado (pestaña oculta)
    setTimeout(function () { el.textContent = Number(hasta).toLocaleString('es-AR'); }, 800);
  }

  function pintarStats(s) {
    kpis.innerHTML = '<div class="card"><strong id="pv-k-con">0</strong><span class="muted">consentimientos</span></div>' +
      '<div class="card"><strong id="pv-k-sol">0</strong><span class="muted">pedidos recibidos</span></div>' +
      '<div class="card"><strong id="pv-k-pen">0</strong><span class="muted">sin responder</span></div>' +
      '<div class="card"><strong id="pv-k-ven">0</strong><span class="muted">fuera de plazo</span></div>';
    contar(document.getElementById('pv-k-con'), s.consentimientos);
    contar(document.getElementById('pv-k-sol'), s.solicitudes);
    contar(document.getElementById('pv-k-pen'), s.pendientes);
    contar(document.getElementById('pv-k-ven'), s.vencidas);

    var txtPol = document.getElementById('pv-politica-txt');
    if (txtPol) {
      txtPol.textContent = 'Vigente: ' + (s.politica || 'v1') +
        (s.politicaDesde ? ' (desde el ' + new Date(s.politicaDesde).toLocaleDateString('es-AR') + ')' : '') +
        (s.desactualizados ? ' · ' + s.desactualizados + ' consentimiento(s) quedaron sobre una versión anterior' : '');
    }

    var pct = s.consentimientos ? Math.round(s.aceptaron / s.consentimientos * 100) : 0;
    var barra = document.getElementById('pv-barra');
    document.getElementById('pv-barra-txt').textContent = pct + '% aceptó todo · ' + (s.consentimientos - s.aceptaron) + ' eligió limitar el uso de sus datos';
    var anime = window.anime;
    if (anime && anime.animate && !reduce) {
      anime.animate(barra, { width: ['0%', pct + '%'], duration: 700, ease: 'outCubic' });
      // Red de seguridad: deja la barra en su ancho final aunque el loop esté pausado
      setTimeout(function () { barra.style.width = pct + '%'; }, 950);
    } else { barra.style.width = pct + '%'; }
  }

  function plazoTxt(r) {
    if (r.estado === 'resuelta' || r.estado === 'rechazada') return '<span class="muted">cerrada</span>';
    if (r.diasRestantes < 0) return '<span class="pv-plazo vencido">vencida hace ' + Math.abs(r.diasRestantes) + ' d</span>';
    return '<span class="pv-plazo">quedan ' + r.diasRestantes + ' d</span>';
  }

  function pintarLista() {
    lista.innerHTML = App.table(solicitudes, [
      { label: 'Código', render: function (r) { return '<span class="pv-code">' + App.esc(r.code) + '</span>'; } },
      { label: 'Quién', render: function (r) { return App.esc(r.name) + '<br><span class="muted" style="font-size:.82rem">' + App.esc(r.email) + '</span>'; } },
      { label: 'Qué pide', render: function (r) {
        return App.esc(TIPOS[r.tipo] || r.tipo) + (r.detalle ? '<br><span class="muted" style="font-size:.82rem">' + App.esc(r.detalle.slice(0, 70)) + (r.detalle.length > 70 ? '…' : '') + '</span>' : '');
      } },
      { label: 'Estado', render: function (r) {
        return '<span class="pv-est ' + App.esc(r.estado) + '">' + App.esc(ESTADOS[r.estado] || r.estado) + '</span><br>' + plazoTxt(r);
      } },
      { label: 'Acciones', render: function (r) {
        return '<select data-est="' + r.id + '" style="font-size:.8rem;padding:3px 6px;margin:2px">' +
          Object.keys(ESTADOS).map(function (k) { return '<option value="' + k + '"' + (r.estado === k ? ' selected' : '') + '>' + ESTADOS[k] + '</option>'; }).join('') + '</select>' +
          '<button class="btn ghost" type="button" data-datos="' + r.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Buscar sus datos</button>';
      } },
    ]);
    lista.querySelectorAll('[data-est]').forEach(function (s) {
      s.addEventListener('change', function () { cambiarEstado(s.getAttribute('data-est'), s.value); });
    });
    lista.querySelectorAll('[data-datos]').forEach(function (b) {
      b.addEventListener('click', function () { verDatos(b.getAttribute('data-datos')); });
    });
  }

  async function cambiarEstado(id, estado) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se cambia el estado'); return; }
    try {
      var upd = await App.api('/api/privacidad/admin/' + id, { method: 'PUT', body: { estado: estado } });
      solicitudes = solicitudes.map(function (x) { return x.id === id ? upd : x; });
      pintarLista();
      cargarStats();
      App.toast('Estado actualizado');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  function pintarDatos(id, d) {
    var r = solicitudes.filter(function (x) { return x.id === id; })[0] || {};
    var cols = Object.keys(d.colecciones || {});
    detalle.innerHTML = '<div class="card" style="margin-top:22px">' +
      '<h3 style="margin:0 0 4px">Datos de ' + App.esc(d.email) + '</h3>' +
      '<p class="muted" style="margin:0 0 12px;font-size:.88rem">' + d.total + ' registro(s) en ' + cols.length + ' lugar(es) del sistema' +
      (cols.length ? ': ' + App.esc(cols.join(', ')) : '') + '. Las contraseñas y los tokens nunca se incluyen.</p>' +
      (d.total ? '<div class="pv-datos">' + App.esc(JSON.stringify(d.colecciones, null, 2)) + '</div>' : '<p class="muted">No encontramos datos de esta persona.</p>') +
      '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn ghost" type="button" id="pv-bajar">Descargar para entregarle</button>' +
      (d.total ? '<button class="btn ghost" type="button" id="pv-anon" style="color:#c0392b;border-color:#c0392b">Anonimizar estos datos</button>' : '') +
      '</div>' +
      (r.anonimizados ? '<p class="muted" style="margin:12px 0 0;font-size:.85rem">Ya se anonimizaron ' + r.anonimizados + ' registro(s) de esta persona.</p>' : '') +
      '</div>';
    document.getElementById('pv-bajar').addEventListener('click', function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
      a.download = 'datos-' + (r.code || 'titular') + '.json';
      a.click();
    });
    var btnAnon = document.getElementById('pv-anon');
    if (btnAnon) btnAnon.addEventListener('click', function () { anonimizar(id); });
    detalle.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  async function verDatos(id) {
    if (window.__PREVIEW__) {
      pintarDatos(id, { email: 'ana@ejemplo.com', total: 3, colecciones: { newsletter: [{ id: 'x1', email: 'ana@ejemplo.com' }], bookings: [{ id: 'x2', name: 'Ana', email: 'ana@ejemplo.com' }] } });
      return;
    }
    try { pintarDatos(id, await App.api('/api/privacidad/admin/' + id + '/datos')); }
    catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  async function anonimizar(id) {
    if (window.__PREVIEW__) { App.toast('Vista previa: acá se anonimizan los datos'); return; }
    if (!confirm('Vamos a reemplazar los datos personales de esta persona en todo el sistema. Las operaciones (pedidos, reservas) se conservan, pero sin sus datos. Esto no se puede deshacer. ¿Seguimos?')) return;
    if (!confirm('Confirmá una vez más: la información personal se pierde para siempre.')) return;
    try {
      var out = await App.api('/api/privacidad/admin/' + id + '/anonimizar', { method: 'POST' });
      solicitudes = solicitudes.map(function (x) { return x.id === id ? out.solicitud : x; });
      pintarLista();
      detalle.innerHTML = '<div class="card" style="margin-top:22px"><strong>Listo: ' + out.tocadas + ' registro(s) anonimizados.</strong>' +
        '<p class="muted" style="margin:6px 0 0;font-size:.88rem">Ya podés marcar la solicitud como resuelta.</p></div>';
      App.toast('Datos anonimizados');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  }

  document.getElementById('pv-csv').addEventListener('click', function () {
    var filas = [['codigo', 'nombre', 'email', 'tipo', 'estado', 'ingresada', 'resuelta', 'dias_restantes', 'anonimizados']].concat(solicitudes.map(function (r) {
      return [r.code, r.name, r.email, r.tipo, r.estado, r.createdAt, r.resueltaAt || '', r.diasRestantes, r.anonimizados || 0];
    }));
    var csv = filas.map(function (f) { return f.map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'solicitudes-privacidad.csv';
    a.click();
  });

  function cargarStats() { App.api('/api/privacidad/admin/stats').then(pintarStats).catch(function () {}); }

  var btnPol = document.getElementById('pv-nueva-politica');
  if (btnPol) {
    btnPol.addEventListener('click', async function () {
      if (window.__PREVIEW__) { App.toast('Vista previa: se publicaría una versión nueva'); return; }
      if (!confirm('¿Publicar una versión nueva de la política? A todo el que había aceptado la anterior le va a volver a aparecer el cartel de cookies.')) return;
      try {
        var out = await App.api('/api/privacidad/admin/politica', { method: 'POST', body: {} });
        App.toast('Política ' + out.version + ' publicada: se vuelve a pedir el consentimiento');
        cargarStats();
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });
  }

  if (window.__PREVIEW__) {
    pintarStats({ consentimientos: 248, aceptaron: 171, solicitudes: 5, pendientes: 2, vencidas: 1, politica: 'v1', politicaDesde: null, desactualizados: 0 });
    solicitudes = [
      { id: 'd1', code: 'PR-A1B2C3', name: 'Ana Gómez', email: 'ana@ejemplo.com', tipo: 'acceso', detalle: 'Quiero saber qué datos míos guardan.', estado: 'recibida', diasRestantes: 7, anonimizados: 0 },
      { id: 'd2', code: 'PR-D4E5F6', name: 'Luis Pérez', email: 'luis@ejemplo.com', tipo: 'eliminacion', detalle: '', estado: 'proceso', diasRestantes: -2, anonimizados: 0 },
    ];
    pintarLista();
  } else if (!me || me.role !== 'admin') {
    location.href = '/auth.html';
  } else {
    cargarStats();
    App.api('/api/privacidad/admin').then(function (rows) { solicitudes = rows; pintarLista(); })
      .catch(function (err) { lista.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
  }
})();`,
  readmeNotes: (cfg) => [
    `**Centro de privacidad**: la página pública \`/privacidad.html\` deja al visitante ver y **cambiar** su decisión sobre el almacenamiento del navegador (revocar tiene que ser tan fácil como aceptar) y pedir **acceso, corrección, eliminación u oposición** sobre sus datos, con un código de seguimiento. Cada consentimiento queda registrado **en tu servidor** con su fecha y la versión de la política: eso es lo que sirve como prueba si alguien reclama — la respuesta guardada solo en el navegador del visitante no le sirve a nadie${cfg.moduleIds.includes('cookies') ? ' (el cartel del módulo Banner de cookies sigue funcionando igual: este módulo escucha esa misma elección y la registra)' : ''}.
  La **versión de la política** se publica desde el panel: cuando cambies qué datos guardás o para qué los usás, apretá **"Publicar versión nueva"** y a todo el que había aceptado la anterior le vuelve a aparecer el cartel${cfg.moduleIds.includes('cookies') ? ' (el módulo Banner de cookies consulta esa versión y se encarga de volver a preguntar)' : ''}. Los consentimientos ya registrados **no se tocan**: son la prueba de qué aceptó cada uno y sobre qué política.
  En \`/privacidad-admin.html\` cada pedido muestra **cuántos días te quedan** para responder (10 corridos, Ley 25.326 de Argentina; si vendés a Europa, el RGPD te da 30). El botón **"Buscar sus datos"** recorre todas las colecciones del proyecto buscando ese email y arma el archivo que le entregás — sin contraseñas ni tokens. **"Anonimizar"** reemplaza los datos personales **sin borrar las filas**, a propósito: un pedido ya facturado o una reserva pasada tienen que seguir existiendo para tu contabilidad; lo que desaparece es el dato personal, no el registro de la operación. **No se puede deshacer.**
  Falta lo único que no puede generarse solo: el **texto de tu política de privacidad**${cfg.moduleIds.includes('legal') ? ' (el módulo Páginas legales ya te dejó el borrador en `/legal.html`: revisalo con tu contador o tu abogado)' : ' — escribila y publicala, aunque sea en una página simple'}, con quién es el responsable de los datos, para qué se usan y cómo se contacta.`,
  ],
};
