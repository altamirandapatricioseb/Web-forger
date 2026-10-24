/**
 * Guardado de proyectos del Builder en Supabase (PostgREST), sin dependencias.
 * Es opcional: si faltan las variables de entorno, los endpoints devuelven 503
 * y la UI oculta el botón de compartir. Tabla: builder_projects (ver supabase/schema.sql).
 */
const crypto = require('crypto');

const BASE = String(process.env.SUPABASE_URL || '').replace(new RegExp('/+$'), '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const TABLE = 'builder_projects';

exports.enabled = () => Boolean(BASE && KEY);

async function rest(method, query = '', body) {
  const res = await fetch(`${BASE}/rest/v1/${TABLE}${query}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Guarda una config y devuelve su id compartible */
exports.save = async (config) => {
  const id = crypto.randomBytes(5).toString('hex');
  await rest('POST', '', { id, data: config });
  return id;
};

/** Recupera una config por id (o null) */
exports.load = async (id) => {
  const rows = await rest('GET', `?select=*&id=eq.${encodeURIComponent(String(id).slice(0, 20))}`);
  return rows.length ? rows[0].data : null;
};
