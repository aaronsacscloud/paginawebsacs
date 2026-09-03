-- Publicaciones por canal: notas, checklists y proyectos que viven dentro del
-- canal (como los "posts" de Discord) y se pueden trabajar entre los dos.
-- Cada publicación deja una tarjeta en la conversación (espacio_mensajes con
-- metadata.publicacion) cuyo hilo son los comentarios.

create table if not exists espacio_publicaciones (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references espacio_canales(id) on delete cascade,
  tipo text not null default 'nota' check (tipo in ('nota', 'checklist', 'proyecto')),
  titulo text not null check (length(titulo) between 1 and 160),
  cuerpo text not null default '' check (length(cuerpo) <= 8000),
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  responsable_id uuid references team_members(id),
  vence_at date,
  fijada boolean not null default false,
  autor_id uuid not null references team_members(id),
  -- La tarjeta que la representa en la conversación (su hilo = comentarios).
  mensaje_id uuid references espacio_mensajes(id) on delete set null,
  cerrada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists espacio_publicaciones_canal_idx on espacio_publicaciones (canal_id, estado, fijada desc, updated_at desc);

-- Los renglones palomeables. `grupo` agrupa (las fases de un proyecto);
-- una nota puede no tener ninguno.
create table if not exists espacio_publicacion_items (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references espacio_publicaciones(id) on delete cascade,
  texto text not null check (length(texto) between 1 and 500),
  grupo text check (length(grupo) <= 80),
  orden integer not null default 0,
  responsable_id uuid references team_members(id),
  vence_at date,
  hecho_at timestamptz,
  hecho_por uuid references team_members(id),
  created_at timestamptz not null default now()
);
create index if not exists espacio_publicacion_items_pub_idx on espacio_publicacion_items (publicacion_id, orden);

alter table espacio_publicaciones enable row level security;
alter table espacio_publicacion_items enable row level security;
