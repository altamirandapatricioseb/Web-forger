// Chat en vivo con backend real: burbuja flotante en todas las páginas donde el visitante deja su
// nombre y conversa; cada mensaje se guarda en el servidor (colección chatmessages, una fila por
// mensaje) y el primer mensaje dispara una bienvenida automática del negocio. El panel del
// visitante consulta novedades cada pocos segundos mientras está abierto (polling liviano, sin
// websockets: funciona en cualquier hosting gratuito incluido Vercel) y muestra un punto de aviso
// cuando llega una respuesta con el panel cerrado. Con auth activo, /chat-admin.html es la bandeja
// solo-admin: lista de conversaciones con no-leídos, hilo abierto con refresco automático,
// respuesta, y borrado de conversación. La identidad del visitante es un id aleatorio guardado en
// su navegador (localStorage): no se le pide email. Distinto de "chatbot"/"agente IA" (responde
// una IA) y de "inbox"/"contact" (mensaje suelto sin conversación): acá chatea una persona del
// negocio. Animado con Anime.js (entrada del panel, pop de cada burbuja, latido del aviso) + red
// de seguridad. Sin auth el widget funciona igual y los mensajes quedan en data/chatmessages.json.

const { phIcon } = require('../../src/icons');

// Mensaje automático que recibe el visitante al escribir por primera vez
const BIENVENIDA = '¡Hola! Gracias por escribirnos. Te respondemos a la brevedad, dejanos tu consulta.';

module.exports = {
  id: 'livechat', type: 'functional', name: 'Chat en vivo',
  description: 'Chat en vivo con backend: burbuja flotante en todas las páginas donde el visitante conversa con el negocio (mensajes persistidos, bienvenida automática, novedades por polling liviano — sin websockets ni servicios pagos). Con auth activo, bandeja solo-admin /chat-admin.html con conversaciones, no-leídos, respuesta y refresco automático. Animado con Anime.js.',
  usesAnime: true,
  mounts: [{ route: '/api/chat', file: 'routes/livechat.js' }],
  collections: ['chatmessages'],
  nav: (cfg) => (cfg.moduleIds.includes('auth') ? [{ label: 'Chat (admin)', href: '/chat-admin.html', id: 'nav-chat-admin' }] : []),
  head: () => `  <style>
    .lc-fab{position:fixed;right:18px;bottom:18px;z-index:30;width:54px;height:54px;border:0;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25)}
    .lc-dot{position:absolute;top:2px;right:2px;width:12px;height:12px;border-radius:50%;background:#c0392b;border:2px solid var(--bg);display:none}
    .lc-panel{position:fixed;right:18px;bottom:84px;z-index:31;width:min(340px,calc(100vw - 36px));background:var(--bg);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 18px 50px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden}
    .lc-panel.open{display:flex}
    .lc-head{background:var(--accent);color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
    .lc-head button{background:none;border:0;color:#fff;font-size:1.1rem;cursor:pointer;padding:2px 6px}
    .lc-msgs{padding:14px;height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;background:var(--surface)}
    .lc-b{max-width:82%;padding:8px 12px;border-radius:14px;font-size:.9rem;line-height:1.45;overflow-wrap:break-word}
    .lc-b.vis{align-self:flex-end;background:var(--accent);color:#fff;border-bottom-right-radius:4px}
    .lc-b.adm{align-self:flex-start;background:var(--bg);border:1px solid var(--line);border-bottom-left-radius:4px}
    .lc-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line)}
    .lc-form input{flex:1}
    .lc-name{padding:14px}
    .lc-threads{max-height:520px;overflow-y:auto}
    .lc-t{display:block;width:100%;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:10px 14px;margin-bottom:8px;cursor:pointer;font:inherit;color:var(--text)}
    .lc-t.on{border-color:var(--accent)}
    .lc-t .lc-badge{float:right;background:var(--accent);color:#fff;border-radius:999px;font-size:.72rem;padding:1px 8px}
    .lc-t small{color:var(--muted);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  </style>`,
  files: (cfg) => ({
    'routes/livechat.js': `const router = require('express').Router();
const db = require('../src/db');
const { str } = require('../src/validate');
${cfg.moduleIds.includes('auth') ? `const { requireAdmin } = require('../src/middleware/auth');
` : ''}
// Bienvenida automática al primer mensaje de cada conversación
const BIENVENIDA = ${JSON.stringify(BIENVENIDA)};
const MAX_POR_CHAT = 200; // tope anti-spam por conversación

// El id de chat lo genera el navegador del visitante: se acepta sólo un formato acotado
const idValido = (v) => typeof v === 'string' && /^[a-z0-9]{8,32}$/.test(v);

// POST /api/chat/messages — el visitante manda un mensaje (público)
router.post('/messages', async (req, res) => {
  const chatId = req.body && req.body.chatId;
  if (!idValido(chatId)) return res.status(422).json({ error: 'Identificador de chat inválido' });
  if (!str(req.body.text, 1, 500)) return res.status(422).json({ error: 'Escribí un mensaje de hasta 500 caracteres' });
  const previos = await db.find('chatmessages', m => m.chatId === chatId);
  if (previos.length >= MAX_POR_CHAT) return res.status(429).json({ error: 'Esta conversación llegó a su límite de mensajes' });
  const name = str(req.body.name, 2, 60) ? req.body.name.trim() : 'Visitante';
  const msg = await db.insert('chatmessages', { chatId, from: 'visitor', name, text: req.body.text.trim(), seen: false });
  // Primera vez que escribe: el negocio saluda automáticamente para que no quede el vacío
  if (!previos.length) await db.insert('chatmessages', { chatId, from: 'admin', name: '', text: BIENVENIDA, auto: true, seen: true });
  res.status(201).json(msg);
});

// GET /api/chat/messages?chatId= — mensajes de UNA conversación (público: sólo la propia, por id)
router.get('/messages', async (req, res) => {
  const chatId = String(req.query.chatId || '');
  if (!idValido(chatId)) return res.status(422).json({ error: 'Identificador de chat inválido' });
  const rows = await db.find('chatmessages', m => m.chatId === chatId);
  res.json(rows.map(m => ({ id: m.id, from: m.from, text: m.text, createdAt: m.createdAt })));
});
${cfg.moduleIds.includes('auth') ? `
// GET /api/chat/admin/threads — conversaciones agrupadas, la de actividad más reciente primero (solo admin)
router.get('/admin/threads', requireAdmin, async (req, res) => {
  const rows = await db.all('chatmessages');
  const porChat = {};
  for (const m of rows) {
    const t = porChat[m.chatId] || (porChat[m.chatId] = { chatId: m.chatId, name: 'Visitante', count: 0, unread: 0, last: '', lastAt: '' });
    t.count++;
    if (m.from === 'visitor') {
      if (m.name && m.name !== 'Visitante') t.name = m.name;
      if (!m.seen) t.unread++;
    }
    if (!t.lastAt || m.createdAt > t.lastAt) { t.lastAt = m.createdAt; t.last = m.text; }
  }
  res.json(Object.values(porChat).sort((a, b) => b.lastAt.localeCompare(a.lastAt)));
});

// GET /api/chat/admin/thread/:chatId — hilo completo; marca como leídos los mensajes del visitante (solo admin)
router.get('/admin/thread/:chatId', requireAdmin, async (req, res) => {
  const chatId = req.params.chatId;
  if (!idValido(chatId)) return res.status(422).json({ error: 'Identificador de chat inválido' });
  const rows = await db.find('chatmessages', m => m.chatId === chatId);
  for (const m of rows) if (m.from === 'visitor' && !m.seen) await db.update('chatmessages', m.id, { seen: true });
  res.json(rows);
});

// POST /api/chat/admin/thread/:chatId — responde en un hilo (solo admin)
router.post('/admin/thread/:chatId', requireAdmin, async (req, res) => {
  const chatId = req.params.chatId;
  if (!idValido(chatId)) return res.status(422).json({ error: 'Identificador de chat inválido' });
  if (!str(req.body.text, 1, 500)) return res.status(422).json({ error: 'Escribí una respuesta de hasta 500 caracteres' });
  const previos = await db.find('chatmessages', m => m.chatId === chatId);
  if (!previos.length) return res.status(404).json({ error: 'Conversación inexistente' });
  const msg = await db.insert('chatmessages', { chatId, from: 'admin', name: '', text: req.body.text.trim(), seen: true });
  res.status(201).json(msg);
});

// DELETE /api/chat/admin/thread/:chatId — borra una conversación completa (solo admin)
router.delete('/admin/thread/:chatId', requireAdmin, async (req, res) => {
  const chatId = req.params.chatId;
  if (!idValido(chatId)) return res.status(422).json({ error: 'Identificador de chat inválido' });
  const rows = await db.find('chatmessages', m => m.chatId === chatId);
  if (!rows.length) return res.status(404).json({ error: 'Conversación inexistente' });
  for (const m of rows) await db.remove('chatmessages', m.id);
  res.json({ ok: true, removed: rows.length });
});
` : `// La bandeja de respuestas requiere el módulo de autenticación: activalo en el Builder para
// habilitar /chat-admin.html. Sin él, los mensajes quedan guardados en data/chatmessages.json
// (el visitante recibe la bienvenida automática igual).
`}
module.exports = router;
`,
  }),
  pages: (cfg) => (cfg.moduleIds.includes('auth') ? {
    'chat-admin': {
      title: 'Chat en vivo',
      html: `  <section>
    <div class="container">
      <h2>Chat en vivo</h2>
      <p class="section-sub">Conversaciones de los visitantes del sitio. El hilo abierto se refresca solo. Solo visible para administradores.</p>
      <div class="grid" style="grid-template-columns:minmax(240px,1fr) 2fr;gap:20px;align-items:start">
        <div>
          <p class="muted" style="margin:0 0 10px"><strong id="lca-count">0</strong> conversaciones</p>
          <div id="lca-threads" class="lc-threads"><p class="muted">Cargando…</p></div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <div style="padding:12px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">
            <strong id="lca-title">Elegí una conversación</strong>
            <button class="btn ghost" type="button" id="lca-del" style="padding:4px 10px;font-size:.8rem;color:#c0392b;border-color:#c0392b" hidden>Borrar conversación</button>
          </div>
          <div id="lca-msgs" class="lc-msgs" style="height:380px"></div>
          <form id="lca-form" class="lc-form" hidden>
            <input name="text" required maxlength="500" placeholder="Escribí tu respuesta…" autocomplete="off">
            <button class="btn" type="submit" style="padding:8px 16px">Responder</button>
          </form>
        </div>
      </div>
    </div>
  </section>`,
    },
  } : {}),
  clientJs: (cfg) => `/* Módulo chat en vivo: burbuja flotante en todas las páginas (conversación persistida en el
   backend, bienvenida automática, novedades por polling) y, con auth activo, la bandeja admin en
   /chat-admin.html. Animado con Anime.js (entrada del panel, pop de burbujas) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function popIn(el) {
    var anime = window.anime;
    if (!anime || !anime.animate || reduce) return;
    anime.animate(el, { opacity: [0, 1], translateY: [8, 0], duration: 280, ease: 'outCubic' });
    // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
    setTimeout(function () { el.style.opacity = 1; el.style.transform = 'none'; }, 400);
  }

  // ---- Burbuja del visitante (todas las páginas menos la bandeja admin) ----
  if (location.pathname.indexOf('chat-admin') < 0) {
    // Identidad anónima del visitante: id aleatorio persistido en su navegador
    var chatId = localStorage.getItem('lc-id');
    if (!chatId || !/^[a-z0-9]{8,32}$/.test(chatId)) {
      chatId = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, '').slice(0, 16);
      localStorage.setItem('lc-id', chatId);
    }
    var nombre = localStorage.getItem('lc-name') || '';
    var mensajes = [];
    var timer = null;

    var fab = document.createElement('button');
    fab.className = 'lc-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Abrir el chat en vivo');
    fab.innerHTML = ${JSON.stringify(phIcon('chat-circle-dots', { size: 28 }))} + '<span class="lc-dot" id="lc-dot"></span>';
    document.body.appendChild(fab);

    var panel = document.createElement('div');
    panel.className = 'lc-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat en vivo');
    panel.innerHTML =
      '<div class="lc-head"><strong>Chat en vivo</strong><button type="button" id="lc-close" aria-label="Cerrar el chat">&times;</button></div>' +
      '<div class="lc-name" id="lc-name-step"><label style="margin-top:0">Tu nombre para empezar</label>' +
      '<input id="lc-name-input" maxlength="60" placeholder="Ej: Ana" autocomplete="off">' +
      '<button class="btn" type="button" id="lc-name-ok" style="margin-top:10px;width:100%">Empezar a chatear</button></div>' +
      '<div class="lc-msgs" id="lc-msgs" hidden></div>' +
      '<form class="lc-form" id="lc-form" hidden><input name="text" required maxlength="500" placeholder="Escribí tu mensaje…" autocomplete="off">' +
      '<button class="btn" type="submit" style="padding:8px 14px">Enviar</button></form>';
    document.body.appendChild(panel);

    // Convivencia con otros flotantes (WhatsApp, volver arriba): el chat se corre hacia arriba.
    // Se resuelve en un microturno para que todos los widgets ya estén montados.
    setTimeout(function () {
      var wa = document.getElementById('whatsapp-fab');
      if (wa) {
        fab.style.bottom = '84px';
        panel.style.bottom = '150px';
        var arriba = document.getElementById('backtotop-btn');
        if (arriba) arriba.style.bottom = '150px';
      }
    }, 0);

    var msgsBox = panel.querySelector('#lc-msgs');
    var form = panel.querySelector('#lc-form');
    var nameStep = panel.querySelector('#lc-name-step');
    var dot = fab.querySelector('#lc-dot');

    function pintar() {
      msgsBox.innerHTML = mensajes.map(function (m) {
        return '<div class="lc-b ' + (m.from === 'visitor' ? 'vis' : 'adm') + '">' + App.esc(m.text) + '</div>';
      }).join('') || '<p class="muted" style="font-size:.85rem">Contanos en qué te podemos ayudar.</p>';
      msgsBox.scrollTop = msgsBox.scrollHeight;
    }

    function refrescar(inicial) {
      if (window.__PREVIEW__) return;
      App.api('/api/chat/messages?chatId=' + chatId).then(function (rows) {
        var habia = mensajes.length;
        var teniaAdmin = mensajes.filter(function (m) { return m.from === 'admin'; }).length;
        mensajes = rows;
        var adminAhora = rows.filter(function (m) { return m.from === 'admin'; }).length;
        if (rows.length !== habia) {
          pintar();
          if (!inicial && msgsBox.lastElementChild) popIn(msgsBox.lastElementChild);
        }
        // Respuesta nueva del negocio con el panel cerrado: punto de aviso en la burbuja
        if (adminAhora > teniaAdmin && !panel.classList.contains('open') && !inicial) dot.style.display = 'block';
      }).catch(function () { /* sin red: se reintenta en el próximo ciclo */ });
    }

    function abrir() {
      panel.classList.add('open');
      dot.style.display = 'none';
      var conNombre = Boolean(nombre);
      nameStep.hidden = conNombre;
      msgsBox.hidden = !conNombre;
      form.hidden = !conNombre;
      if (conNombre) { pintar(); refrescar(true); }
      var anime = window.anime;
      if (anime && anime.animate && !reduce) {
        anime.animate(panel, { opacity: [0, 1], translateY: [16, 0], scale: [0.96, 1], duration: 320, ease: 'outCubic' });
        setTimeout(function () { panel.style.opacity = 1; panel.style.transform = 'none'; }, 450);
      }
      // Mientras el panel está abierto, se consultan novedades cada 4 segundos
      if (!timer) timer = setInterval(function () { if (!document.hidden) refrescar(false); }, 4000);
      var inp = conNombre ? form.querySelector('[name="text"]') : panel.querySelector('#lc-name-input');
      if (inp) inp.focus();
    }
    function cerrar() {
      panel.classList.remove('open');
      if (timer) { clearInterval(timer); timer = null; }
    }
    fab.addEventListener('click', function () { panel.classList.contains('open') ? cerrar() : abrir(); });
    panel.querySelector('#lc-close').addEventListener('click', cerrar);

    panel.querySelector('#lc-name-ok').addEventListener('click', function () {
      var v = panel.querySelector('#lc-name-input').value.trim();
      if (v.length < 2) { App.toast('Contanos tu nombre para empezar'); return; }
      nombre = v;
      localStorage.setItem('lc-name', nombre);
      nameStep.hidden = true; msgsBox.hidden = false; form.hidden = false;
      pintar(); refrescar(true);
      form.querySelector('[name="text"]').focus();
    });
    panel.querySelector('#lc-name-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); panel.querySelector('#lc-name-ok').click(); }
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var inp = form.querySelector('[name="text"]');
      var texto = inp.value.trim();
      if (!texto) return;
      if (window.__PREVIEW__) {
        mensajes.push({ from: 'visitor', text: texto });
        mensajes.push({ from: 'admin', text: ${JSON.stringify(BIENVENIDA)} });
        pintar(); inp.value = '';
        if (msgsBox.lastElementChild) popIn(msgsBox.lastElementChild);
        return;
      }
      inp.value = '';
      mensajes.push({ from: 'visitor', text: texto });
      pintar();
      if (msgsBox.lastElementChild) popIn(msgsBox.lastElementChild);
      try {
        await App.api('/api/chat/messages', { method: 'POST', body: { chatId: chatId, name: nombre, text: texto } });
        refrescar(false);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    // Al cargar la página: si el negocio respondió desde la última visita, se muestra el aviso
    if (!window.__PREVIEW__ && nombre) {
      App.api('/api/chat/messages?chatId=' + chatId).then(function (rows) {
        mensajes = rows;
        var ultimo = rows[rows.length - 1];
        if (ultimo && ultimo.from === 'admin' && !ultimo.auto) dot.style.display = 'block';
      }).catch(function () { /* sin red al cargar: el chat sigue disponible */ });
    }
  }
${cfg.moduleIds.includes('auth') ? `
  // ---- Bandeja admin /chat-admin.html ----
  var threadsBox = document.getElementById('lca-threads');
  if (threadsBox) {
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var hilos = [];
    var abierto = null;
    var timerA = null;
    var msgsA = document.getElementById('lca-msgs');
    var formA = document.getElementById('lca-form');
    var delBtn = document.getElementById('lca-del');
    var titleA = document.getElementById('lca-title');

    function pintarHilos() {
      document.getElementById('lca-count').textContent = hilos.length;
      if (!hilos.length) { threadsBox.innerHTML = '<p class="muted">Sin conversaciones todavía.</p>'; return; }
      threadsBox.innerHTML = hilos.map(function (t) {
        return '<button type="button" class="lc-t' + (abierto === t.chatId ? ' on' : '') + '" data-chat="' + App.esc(t.chatId) + '">' +
          (t.unread ? '<span class="lc-badge">' + t.unread + '</span>' : '') +
          '<strong>' + App.esc(t.name) + '</strong>' +
          '<small>' + App.esc(t.last) + '</small></button>';
      }).join('');
      threadsBox.querySelectorAll('[data-chat]').forEach(function (b) {
        b.addEventListener('click', function () { abrirHilo(b.getAttribute('data-chat')); });
      });
    }

    function pintarHilo(rows) {
      msgsA.innerHTML = rows.map(function (m) {
        return '<div class="lc-b ' + (m.from === 'visitor' ? 'adm' : 'vis') + '">' + App.esc(m.text) + '</div>';
      }).join('');
      msgsA.scrollTop = msgsA.scrollHeight;
    }

    function abrirHilo(chatId) {
      abierto = chatId;
      var t = hilos.filter(function (x) { return x.chatId === chatId; })[0];
      titleA.textContent = 'Conversación con ' + ((t && t.name) || 'Visitante');
      formA.hidden = false; delBtn.hidden = false;
      pintarHilos();
      cargarHilo(true);
    }

    function cargarHilo(conAnimacion) {
      if (!abierto) return;
      if (window.__PREVIEW__) return;
      App.api('/api/chat/admin/thread/' + abierto).then(function (rows) {
        var habia = msgsA.children.length;
        pintarHilo(rows);
        if (conAnimacion && msgsA.lastElementChild && rows.length !== habia) popIn(msgsA.lastElementChild);
        // Abrir el hilo marca los no-leídos: se refresca la lista para bajar el contador
        cargarHilos();
      }).catch(function (err) { msgsA.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }

    function cargarHilos() {
      if (window.__PREVIEW__) {
        hilos = [{ chatId: 'demo1234', name: 'Ana', count: 3, unread: 1, last: '¿Tienen envíos a Córdoba?', lastAt: new Date().toISOString() }];
        pintarHilos();
        return;
      }
      App.api('/api/chat/admin/threads').then(function (rows) { hilos = rows; pintarHilos(); }).catch(function (err) { threadsBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }

    formA.addEventListener('submit', async function (e) {
      e.preventDefault();
      var inp = formA.querySelector('[name="text"]');
      var texto = inp.value.trim();
      if (!texto || !abierto) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: se enviaría la respuesta'); return; }
      inp.value = '';
      try {
        await App.api('/api/chat/admin/thread/' + abierto, { method: 'POST', body: { text: texto } });
        cargarHilo(true);
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    delBtn.addEventListener('click', async function () {
      if (!abierto) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría la conversación'); return; }
      if (!confirm('¿Borrar toda esta conversación? No se puede deshacer.')) return;
      try {
        await App.api('/api/chat/admin/thread/' + abierto, { method: 'DELETE' });
        abierto = null;
        titleA.textContent = 'Elegí una conversación';
        msgsA.innerHTML = ''; formA.hidden = true; delBtn.hidden = true;
        cargarHilos();
        App.toast('Conversación borrada');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    });

    if (window.__PREVIEW__) { cargarHilos(); }
    else if (!me || me.role !== 'admin') { location.href = '/auth.html'; }
    else {
      cargarHilos();
      // La bandeja se refresca sola: hilo abierto cada 5 segundos, lista cada 10
      timerA = setInterval(function () { if (!document.hidden) { cargarHilo(false); } }, 5000);
      setInterval(function () { if (!document.hidden) cargarHilos(); }, 10000);
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navC = document.getElementById('nav-chat-admin');
    if (navC && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navC.style.display = 'none';
  })();
` : ''}})();`,
  readmeNotes: (cfg) => [
    `**Chat en vivo**: cada mensaje se guarda en la colección \`chatmessages\`; el visitante chatea desde la burbuja flotante (identidad anónima en su navegador, sin pedir email) y recibe una bienvenida automática al primer mensaje. Las novedades llegan por polling liviano (sin websockets: funciona en cualquier hosting gratuito). ${cfg.moduleIds.includes('auth') ? 'Los administradores responden desde la bandeja `/chat-admin.html` (conversaciones con no-leídos y refresco automático).' : 'Para responder desde la web activá el módulo **Autenticación** (habilita la bandeja `/chat-admin.html`); sin él, los mensajes quedan en `data/chatmessages.json`.'}`,
  ],
};
