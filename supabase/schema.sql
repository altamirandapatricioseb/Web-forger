-- Esquema del Builder (opcional): guardado y compartido de proyectos por link.
-- Ejecutalo una sola vez en Supabase → SQL Editor → New query.

create table if not exists builder_projects (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table builder_projects enable row level security; -- solo accesible con la service key
