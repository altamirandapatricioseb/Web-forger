module.exports = {
  id: 'coupons', type: 'functional', name: 'Cupones de descuento',
  description: 'Códigos de descuento con porcentaje, vencimiento y límite de usos. El admin los crea, el checkout los aplica y descuenta en el servidor.',
  requires: ['cart'],
  mounts: [{ route: '/api/coupons', file: 'routes/coupons.js' }],
  collections: ['coupons'],
  files: () => ({
    'models/coupon.js': `const { check, num } = require('../src/validate');

/** Modelo Cupón */
exports.validate = (data) => check(data, {
  code: (v) => typeof v === 'string' && /^[A-Z0-9]{3,20}$/.test(v.toUpperCase().trim()),
  percent: (v) => num(v, 1, 90),
  maxUses: (v) => v === undefined || v === null || num(v, 1, 100000),
  expiresAt: (v) => v === undefined || v === null || (typeof v === 'string' && !isNaN(Date.parse(v))),
});

/** Estado de un cupón ya cargado: existencia, vencimiento y usos */
exports.status = (coupon) => {
  if (!coupon) return { ok: false, reason: 'El cupón no existe' };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return { ok: false, reason: 'El cupón está vencido' };
  if (coupon.maxUses && (coupon.uses || 0) >= coupon.maxUses) return { ok: false, reason: 'El cupón se agotó' };
  return { ok: true };
};
`,
    'routes/coupons.js': `const router = require('express').Router();
const db = require('../src/db');
const Coupon = require('../models/coupon');
const { requireAdmin } = require('../src/middleware/auth');

// GET /api/coupons — listado (solo admin)
router.get('/', requireAdmin, async (req, res) => res.json((await db.all('coupons'))));

// POST /api/coupons — alta (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { ok, errors } = Coupon.validate(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const code = req.body.code.toUpperCase().trim();
  if ((await db.find('coupons', c => c.code === code)).length) {
    return res.status(409).json({ error: 'Ya existe un cupón con ese código' });
  }
  const { percent, maxUses = null, expiresAt = null } = req.body;
  res.status(201).json((await db.insert('coupons', { code, percent, maxUses, expiresAt, uses: 0 })));
});

// POST /api/coupons/validate — verificación pública antes del checkout
router.post('/validate', async (req, res) => {
  const coupon = (await db.find('coupons', c => c.code === String(req.body.code || '').toUpperCase().trim()))[0];
  const st = Coupon.status(coupon);
  if (!st.ok) return res.status(422).json({ error: st.reason });
  res.json({ code: coupon.code, percent: coupon.percent });
});

// DELETE /api/coupons/:id — baja (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  if (!(await db.get('coupons', req.params.id))) return res.status(404).json({ error: 'Cupón inexistente' });
  (await db.remove('coupons', req.params.id));
  res.json({ ok: true });
});

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo cupones: input en el carrito + gestión en el panel admin */
(function () {
  // --- Input de cupón en el carrito ---
  const panel = document.getElementById('cart-panel');
  if (panel) {
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap';
    box.innerHTML = '<input id="coupon-input" placeholder="Código de cupón" style="flex:1;min-width:140px;text-transform:uppercase">' +
      '<button class="btn btn-ghost" id="coupon-apply" type="button">Aplicar</button>' +
      '<span id="coupon-status" class="muted" style="width:100%"></span>';
    panel.insertBefore(box, panel.lastElementChild);
    const status = box.querySelector('#coupon-status');
    const input = box.querySelector('#coupon-input');
    const saved = localStorage.getItem('couponCode');
    if (saved) { input.value = saved; status.textContent = 'Cupón ' + saved + ' aplicado (el descuento se calcula al confirmar).'; }
    box.querySelector('#coupon-apply').addEventListener('click', async () => {
      const code = input.value.trim().toUpperCase();
      if (!code) { localStorage.removeItem('couponCode'); status.textContent = ''; return; }
      if (window.__PREVIEW__) { status.textContent = 'Cupón ' + code + ' aplicado: -10% (demo).'; return; }
      try {
        const r = await App.api('/api/coupons/validate', { method: 'POST', body: { code } });
        localStorage.setItem('couponCode', r.code);
        status.textContent = 'Cupón ' + r.code + ' aplicado: -' + r.percent + '% al confirmar la compra.';
      } catch (err) {
        localStorage.removeItem('couponCode');
        status.textContent = '';
        App.toast(err.message);
      }
    });
  }

  // --- Gestión de cupones en el panel admin ---
  const adminTables = document.getElementById('admin-tables');
  if (!adminTables) return;
  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginTop = '24px';
  card.innerHTML = '<h3>Cupones de descuento</h3>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">' +
    '<input id="cp-code" placeholder="CODIGO" style="text-transform:uppercase;width:130px">' +
    '<input id="cp-percent" type="number" placeholder="%" min="1" max="90" style="width:70px">' +
    '<input id="cp-max" type="number" placeholder="Usos máx." min="1" style="width:110px">' +
    '<input id="cp-exp" type="date" style="width:150px">' +
    '<button class="btn" id="cp-create" type="button">Crear</button></div>' +
    '<div id="cp-list" class="muted">Cargando…</div>';
  adminTables.parentElement.appendChild(card);

  const list = card.querySelector('#cp-list');
  function render(coupons) {
    if (!coupons.length) { list.textContent = 'Todavía no hay cupones.'; return; }
    list.innerHTML = coupons.map(c =>
      '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)">' +
      '<span><strong>' + c.code + '</strong> · -' + c.percent + '% · usos: ' + (c.uses || 0) + (c.maxUses ? '/' + c.maxUses : '') +
      (c.expiresAt ? ' · vence ' + c.expiresAt.slice(0, 10) : '') + '</span>' +
      '<a href="#" data-del="' + c.id + '">Eliminar</a></div>'
    ).join('');
    list.querySelectorAll('[data-del]').forEach(a => a.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await App.api('/api/coupons/' + a.dataset.del, { method: 'DELETE' }); load(); }
      catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }));
  }
  async function load() {
    if (window.__PREVIEW__) return render([{ code: 'BIENVENIDA', percent: 10, uses: 3, maxUses: 100 }, { code: 'INVIERNO26', percent: 25, uses: 0, expiresAt: '2026-08-31' }]);
    try { render(await App.api('/api/coupons')); }
    catch { card.style.display = 'none'; }
  }
  load();
  card.querySelector('#cp-create').addEventListener('click', async () => {
    const body = {
      code: card.querySelector('#cp-code').value.trim().toUpperCase(),
      percent: Number(card.querySelector('#cp-percent').value),
    };
    const max = card.querySelector('#cp-max').value;
    const exp = card.querySelector('#cp-exp').value;
    if (max) body.maxUses = Number(max);
    if (exp) body.expiresAt = exp;
    try {
      await App.api('/api/coupons', { method: 'POST', body });
      card.querySelectorAll('input').forEach(i => i.value = '');
      App.toast('Cupón creado');
      load();
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
})();`,
};
