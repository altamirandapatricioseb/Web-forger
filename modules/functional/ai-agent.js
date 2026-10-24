const T = require('../../src/templates');

module.exports = {
  id: 'ai-agent', type: 'functional', name: 'Agente IA (datos internos)',
  description: 'Asistente para administradores que responde preguntas consultando los datos reales del sistema mediante herramientas (function calling). Proveedores gratuitos: Groq, Gemini, OpenRouter.',
  requires: ['auth'],
  mounts: [{ route: '/api/agent', file: 'routes/agent.js' }],
  env: {
    AI_API_KEY: 'tu-api-key (gratis en console.groq.com)',
    AI_BASE_URL: 'https://api.groq.com/openai/v1',
    AI_MODEL: 'llama-3.3-70b-versatile',
  },
  nav: () => [{ label: 'Asistente IA', href: '/agent.html', id: 'nav-agent' }],
  pages: (cfg) => ({
    agent: {
      title: 'Asistente IA',
      html: `  <section>
    <div class="container">
      <h2>Asistente IA</h2>
      <p class="section-sub">Preguntale por los datos del sistema en lenguaje natural: consulta las colecciones reales antes de responder.</p>
      <div class="card">
        <div style="display:flex;gap:8px">
          <input id="ag-q" placeholder="Ej: ¿cuántas visitas completas hubo esta semana y en qué sucursales?" style="flex:1">
          <button class="btn" id="ag-send" type="button" style="width:auto">Preguntar</button>
        </div>
        <div id="ag-trace" style="margin-top:12px"></div>
        <div id="ag-answer" style="margin-top:8px;white-space:pre-wrap;line-height:1.5"></div>
      </div>
    </div>
  </section>`,
    },
  }),
  files: (cfg) => ({
    'src/ai.js': T.AI_JS,
    'routes/agent.js': `const router = require('express').Router();
const db = require('../src/db');
const ai = require('../src/ai');
const { str } = require('../src/validate');
const { requireAdmin } = require('../src/middleware/auth');

// Colecciones consultables (definidas por los módulos activos de este proyecto)
const COLLECTIONS = ${JSON.stringify((cfg.collections || []).length ? cfg.collections : ['users'])};

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'consultar_datos',
      description: 'Devuelve las últimas filas y el total de una colección del sistema.',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string', enum: COLLECTIONS, description: 'Colección a consultar' },
          limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Cantidad de filas (default 20)' },
        },
        required: ['collection'],
      },
    },
  },
${(cfg.moduleIds || []).includes('inventory') ? `  {
    type: 'function',
    function: {
      name: 'consultar_stock',
      description: 'Devuelve el stock actual de cada producto en cada sucursal (calculado desde los movimientos).',
      parameters: { type: 'object', properties: {} },
    },
  },
` : ''}];

const sanitize = ({ passwordHash, ...row }) => row;

async function runTool(name, args) {
  if (name === 'consultar_datos') {
    if (!COLLECTIONS.includes(args.collection)) return { error: 'Colección inexistente' };
    const rows = await db.all(args.collection);
    return { total: rows.length, ultimas: rows.slice(-(Math.min(args.limit || 20, 50))).map(sanitize) };
  }
${(cfg.moduleIds || []).includes('inventory') ? `  if (name === 'consultar_stock') {
    const [branches, products, movements] = await Promise.all([db.all('branches'), db.all('products'), db.all('movements')]);
    const rows = [];
    for (const b of branches) for (const p of products.filter(x => x.active !== false)) {
      const qty = movements.filter(m => m.branchId === b.id && m.productId === p.id).reduce((s, m) => s + m.delta, 0);
      rows.push({ sucursal: b.name, producto: p.name, sku: p.sku || '', stock: qty });
    }
    return { stock: rows };
  }
` : ''}  return { error: 'Herramienta desconocida' };
}

// POST /api/agent — { question } (solo admin). Loop agéntico de hasta 4 vueltas.
router.post('/', requireAdmin, async (req, res) => {
  if (!ai.enabled()) return res.status(503).json({ error: 'El agente no está configurado: falta AI_API_KEY en el servidor' });
  if (!str(req.body.question, 3, 500)) return res.status(422).json({ error: 'Escribí una pregunta de 3 a 500 caracteres' });

  const today = new Date().toISOString().slice(0, 10);
  // El nombre entra por JSON.stringify y sin escapar como HTML: es el prompt del modelo, y
  // una marca con apóstrofo ("O'Brien") rompía el archivo generado entero.
  const system = 'Sos el asistente interno de ' + ${JSON.stringify(`"${cfg.brand.name}"`)} + '. Hoy es ' + today + '. ' +
    'Usá las herramientas para consultar datos reales ANTES de responder: nunca inventes cifras. ' +
    'Respondé en español rioplatense, concreto, citando los números que obtuviste.';
  const messages = [{ role: 'user', content: req.body.question }];
  const trace = [];

  for (let round = 0; round < 4; round++) {
    const msg = await ai.chat({ system, messages, tools: TOOLS });
    if (!msg.tool_calls || !msg.tool_calls.length) {
      return res.json({ answer: msg.content || 'No obtuve respuesta del modelo', trace });
    }
    messages.push(msg);
    for (const call of msg.tool_calls) {
      let args = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch {}
      trace.push({ tool: call.function.name, args });
      const result = await runTool(call.function.name, args);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 8000) });
    }
  }
  res.json({ answer: 'Necesité demasiadas consultas para responder; probá con una pregunta más acotada.', trace });
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo agente IA */
(function () {
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const nav = document.getElementById('nav-agent');
  if (nav && (!me || me.role !== 'admin') && !window.__PREVIEW__) nav.style.display = 'none';

  const q = document.getElementById('ag-q');
  if (!q) return;
  const answer = document.getElementById('ag-answer');
  const traceEl = document.getElementById('ag-trace');

  async function ask() {
    const question = q.value.trim();
    if (!question) return;
    if (window.__PREVIEW__) {
      traceEl.innerHTML = '<span style="display:inline-block;border:1px solid var(--line);border-radius:20px;padding:2px 10px;font-size:.75rem;font-family:monospace">consultar_datos {"collection":"visits"}</span>';
      answer.textContent = 'Esta semana hubo 12 visitas completas: 7 en Sucursal Centro y 5 en Sucursal Ituzaingó (demo — en el proyecto exportado consulto los datos reales).';
      return;
    }
    answer.textContent = 'Consultando datos…';
    traceEl.innerHTML = '';
    try {
      const r = await App.api('/api/agent', { method: 'POST', body: { question } });
      traceEl.innerHTML = r.trace.map(t =>
        '<span style="display:inline-block;border:1px solid var(--line);border-radius:20px;padding:2px 10px;margin:2px;font-size:.75rem;font-family:monospace">' +
        App.esc(t.tool + ' ' + JSON.stringify(t.args)) + '</span>').join('');
      answer.textContent = r.answer;
    } catch (err) { answer.textContent = err.message; }
  }
  document.getElementById('ag-send').addEventListener('click', ask);
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(); });
})();`,
};
