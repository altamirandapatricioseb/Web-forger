const T = require('../../src/templates');

const { phIcon } = require('../../src/icons');

module.exports = {
  id: 'chatbot', type: 'functional', name: 'Chatbot IA',
  description: 'Widget de chat flotante en todas las páginas, con contexto real del negocio (productos, sucursales). Funciona con proveedores de IA gratuitos (Groq, Gemini, OpenRouter).',
  mounts: [{ route: '/api/chatbot', file: 'routes/chatbot.js' }],
  env: {
    AI_API_KEY: 'tu-api-key (gratis en console.groq.com)',
    AI_BASE_URL: 'https://api.groq.com/openai/v1',
    AI_MODEL: 'llama-3.3-70b-versatile',
  },
  files: (cfg) => ({
    'src/ai.js': T.AI_JS,
    'routes/chatbot.js': `const router = require('express').Router();
const db = require('../src/db');
const ai = require('../src/ai');
const { str } = require('../src/validate');

// Rate limit simple en memoria: 30 mensajes por hora por IP
const hits = new Map();
const limited = (ip) => {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 3600000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 30;
};

/** Contexto del negocio para el system prompt (solo colecciones que existan) */
async function businessContext() {
  const parts = [];
  try {
    const products = (await db.all('products')).filter(p => p.active !== false).slice(0, 25);
    if (products.length) parts.push('Catálogo:\\n' + products.map(p => '- ' + p.name + ' ($' + p.price + ')' + (p.description ? ': ' + p.description : '')).join('\\n'));
  } catch {}
  try {
    const branches = (await db.all('branches')).slice(0, 20);
    if (branches.length) parts.push('Sucursales:\\n' + branches.map(b => '- ' + b.name + ' — ' + b.address).join('\\n'));
  } catch {}
  return parts.join('\\n\\n');
}

// POST /api/chatbot — { messages: [{ role, content }] }
router.post('/', async (req, res) => {
  if (!ai.enabled()) return res.status(503).json({ error: 'El chatbot no está configurado: falta AI_API_KEY en el servidor' });
  if (limited(req.ip)) return res.status(429).json({ error: 'Demasiados mensajes, probá de nuevo en un rato' });
  const messages = req.body.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 20) {
    return res.status(422).json({ error: 'Conversación inválida' });
  }
  for (const m of messages) {
    if (!m || !['user', 'assistant'].includes(m.role) || !str(m.content, 1, 1000)) {
      return res.status(422).json({ error: 'Mensaje inválido' });
    }
  }
  const context = await businessContext();
  // El nombre entra por JSON.stringify y no interpolado: una marca con apóstrofo ("O'Brien",
  // "Rock'n Deli") rompía el archivo entero. Va SIN escapar como HTML: esto es el prompt que
  // recibe el modelo, no marcado — con esc() el asistente leería "O&#39;Brien".
  const system = 'Sos el asistente virtual de ' + ${JSON.stringify(`"${cfg.brand.name}"`)} + '. Respondé en español rioplatense, breve y concreto (máximo 3 oraciones salvo que pidan detalle). ' +
    'Solo hablás de este negocio y sus datos. Si no sabés algo, decilo y sugerí escribir desde la página de contacto.' +
    (context ? '\\n\\nDatos actuales del negocio:\\n' + context : '');
  const reply = await ai.chat({ system, messages: messages.map(m => ({ role: m.role, content: m.content })) });
  res.json({ reply: reply.content || '…' });
});

module.exports = router;
`,
  }),
  clientJs: (cfg) => `/* Módulo chatbot: widget flotante */
(function () {
  const chat = document.createElement('div');
  chat.innerHTML = '<button id="cb-open" type="button" aria-label="Abrir chat" ' +
    'style="position:fixed;bottom:22px;right:22px;width:56px;height:56px;border-radius:50%;border:none;background:var(--accent);color:#fff;font-size:1.5rem;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:60">${phIcon('chat-circle-dots', { size: 24 })}</button>' +
    '<div id="cb-panel" style="display:none;position:fixed;bottom:90px;right:22px;width:min(360px,calc(100vw - 44px));height:460px;background:var(--bg);border:1px solid var(--line);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);z-index:60;flex-direction:column;overflow:hidden">' +
    '<div style="padding:12px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center"><strong>' + ${JSON.stringify(T.esc(cfg.brand.name))} + '</strong><button id="cb-close" type="button" style="width:auto;background:none;border:none;cursor:pointer;font-size:1.1rem">${phIcon('x', { size: 18 })}</button></div>' +
    '<div id="cb-msgs" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px"></div>' +
    '<div style="display:flex;gap:8px;padding:12px;border-top:1px solid var(--line)"><input id="cb-input" placeholder="Escribí tu consulta…" style="flex:1"><button class="btn" id="cb-send" type="button" style="width:auto">${phIcon('paper-plane-tilt', { size: 18 })}</button></div></div>';
  document.body.appendChild(chat);

  const panel = document.getElementById('cb-panel');
  const msgsEl = document.getElementById('cb-msgs');
  const input = document.getElementById('cb-input');
  let history = [];
  let busy = false;

  const bubble = (role, text) => {
    const isUser = role === 'user';
    msgsEl.insertAdjacentHTML('beforeend', '<div style="max-width:85%;padding:9px 12px;border-radius:12px;font-size:.9rem;line-height:1.4;' +
      (isUser ? 'align-self:flex-end;background:var(--accent);color:#fff' : 'align-self:flex-start;background:color-mix(in srgb, var(--text) 6%, var(--bg));') + '">' + App.esc(text) + '</div>');
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return msgsEl.lastElementChild;
  };

  document.getElementById('cb-open').addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    if (panel.style.display === 'flex' && !history.length) bubble('assistant', '¡Hola! Soy el asistente de ' + ${JSON.stringify(cfg.brand.name)} + '. ¿En qué te puedo ayudar?');
    input.focus();
  });
  document.getElementById('cb-close').addEventListener('click', () => panel.style.display = 'none');

  async function send() {
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    bubble('user', text);
    history.push({ role: 'user', content: text });
    if (window.__PREVIEW__) { bubble('assistant', 'En el proyecto exportado respondo con IA real usando los datos del negocio (demo).'); return; }
    busy = true;
    const typing = bubble('assistant', '…');
    try {
      const r = await App.api('/api/chatbot', { method: 'POST', body: { messages: history.slice(-10) } });
      typing.textContent = r.reply;
      history.push({ role: 'assistant', content: r.reply });
    } catch (err) {
      typing.textContent = err.message;
    }
    busy = false;
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  document.getElementById('cb-send').addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
})();`,
};
