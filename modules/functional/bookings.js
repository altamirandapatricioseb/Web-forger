module.exports = {
  id: 'bookings', type: 'functional', name: 'Reservas',
  description: 'Turnos/reservas con validación de fecha futura y consulta para administradores.',
  mounts: [{ route: '/api/bookings', file: 'routes/bookings.js' }],
  collections: ['bookings'],
  html: () => `  <section id="reservas">
    <div class="container" style="max-width:640px">
      <h2>Reservá tu turno</h2>
      <p class="section-sub">Elegí fecha y horario, y te lo confirmamos por email.</p>
      <form id="booking-form" class="card">
        <label>Nombre</label><input name="name" required maxlength="80">
        <label>Email</label><input name="email" type="email" required>
        <div class="grid cols-2">
          <div><label>Fecha</label><input name="date" type="date" required></div>
          <div><label>Horario</label><select name="time" required>
            <option value="">Elegir…</option>
            <option>09:00</option><option>11:00</option><option>14:00</option><option>16:00</option><option>18:00</option>
          </select></div>
        </div>
        <label>Notas (opcional)</label><textarea name="notes" rows="2" maxlength="500"></textarea>
        <div style="margin-top:14px"><button class="btn" type="submit">Reservar</button></div>
      </form>
    </div>
  </section>`,
  files: () => ({
    'models/booking.js': `const { check, str, isEmail, oneOf } = require('../src/validate');

const SLOTS = ['09:00', '11:00', '14:00', '16:00', '18:00'];

/** Modelo Reserva: fecha futura y horario dentro de la grilla */
exports.validate = (data) => {
  const base = check(data, {
    name: (v) => str(v, 2, 80),
    email: isEmail,
    time: (v) => oneOf(v, SLOTS),
    notes: (v) => v === undefined || v === '' || str(v, 0, 500),
  });
  const date = Date.parse(data && data.date);
  if (isNaN(date)) base.errors.date = 'Fecha inválida';
  else if (date < Date.now() - 24 * 3600 * 1000) base.errors.date = 'La fecha debe ser futura';
  base.ok = Object.keys(base.errors).length === 0;
  return base;
};

exports.SLOTS = SLOTS;
`,
    'routes/bookings.js': `const router = require('express').Router();
const db = require('../src/db');
const Booking = require('../models/booking');
const { requireAdmin } = require('../src/middleware/auth');

// POST /api/bookings — crea una reserva si el turno está libre
router.post('/', async (req, res) => {
  const { ok, errors } = Booking.validate(req.body);
  if (!ok) return res.status(422).json({ error: 'Datos inválidos', errors });
  const { name, email, date, time, notes = '' } = req.body;
  const taken = (await db.find('bookings', b => b.date === date && b.time === time)).length > 0;
  if (taken) return res.status(409).json({ error: 'Ese turno ya está reservado, probá otro horario' });
  const booking = (await db.insert('bookings', { name, email: email.toLowerCase(), date, time, notes, status: 'pendiente' }));
  res.status(201).json(booking);
});

// GET /api/bookings — listado solo para administradores
router.get('/', requireAdmin, async (req, res) => res.json((await db.all('bookings'))));

module.exports = router;
`,
  }),
  clientJs: () => `/* Módulo reservas */
(function () {
  const form = document.getElementById('booking-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const b = await App.api('/api/bookings', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      App.toast('¡Reserva confirmada para el ' + b.date + ' a las ' + b.time + '!');
    } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
  });
})();`,
};
