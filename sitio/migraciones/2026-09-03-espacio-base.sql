-- 2026-09-03 · "Equipo": el chat de colaboración del CRM (F0, cimientos).
--
-- Nueve tablas con prefijo espacio_. Todo referencia a team_members.id (la
-- identidad viene de la cookie; el navegador nunca manda quién es).
-- RLS activo y SIN políticas en todas: solo el servidor (service_role) las
-- toca; la llave anónima —que se expone para Realtime— no puede leer nada.

create table if not exists espacio_secciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(nombre) between 2 and 30),
  orden int not null default 0,
  creada_por uuid references team_members(id),
  archivada_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists espacio_canales (
  id uuid primary key default gen_random_uuid(),
  seccion_id uuid references espacio_secciones(id) on delete set null,
  nombre text not null check (nombre ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  descripcion text,
  tipo text not null default 'charla' check (tipo in ('charla','sala','directo','sistema')),
  importante boolean not null default false,
  -- Salas: cuándo es la próxima reunión ({dia_iso: 1..7, hora: '09:00'}).
  regla_reunion jsonb,
  -- Directos: las dos personas, ordenadas, para que el par sea único.
  participantes uuid[] not null default '{}',
  creado_por uuid references team_members(id),
  archivado_at timestamptz,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists espacio_canales_nombre_uq
  on espacio_canales (seccion_id, nombre) where archivado_at is null and tipo <> 'directo';
create unique index if not exists espacio_canales_directo_uq
  on espacio_canales (participantes) where tipo = 'directo';

create table if not exists espacio_mensajes (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references espacio_canales(id) on delete cascade,
  -- Hilo: el mensaje raíz del que cuelga (un solo nivel).
  hilo_de uuid references espacio_mensajes(id) on delete cascade,
  autor_id uuid not null references team_members(id),
  texto text not null default '' check (length(texto) <= 4000),
  responde_a uuid references espacio_mensajes(id) on delete set null,
  menciones uuid[] not null default '{}',
  adjuntos jsonb not null default '[]',
  citas jsonb not null default '[]',
  -- Salas: a qué sesión y a qué punto pertenece lo que se dijo.
  sesion_id uuid,
  punto_id uuid,
  editado_at timestamptz,
  borrado_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists espacio_mensajes_canal_idx on espacio_mensajes (canal_id, created_at desc) where hilo_de is null;
create index if not exists espacio_mensajes_hilo_idx on espacio_mensajes (hilo_de, created_at) where hilo_de is not null;
create index if not exists espacio_mensajes_menciones_idx on espacio_mensajes using gin (menciones);
-- El id de cliente evita duplicar un mensaje reenviado tras caerse el socket.
create unique index if not exists espacio_mensajes_cid_uq on espacio_mensajes ((metadata->>'cid')) where metadata ? 'cid';
-- Búsqueda: texto y transcripciones de audio (pg_trgm ya está instalada).
create index if not exists espacio_mensajes_texto_trgm on espacio_mensajes using gin (texto gin_trgm_ops);

create table if not exists espacio_reacciones (
  mensaje_id uuid not null references espacio_mensajes(id) on delete cascade,
  usuario_id uuid not null references team_members(id),
  emoji text not null check (length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (mensaje_id, usuario_id, emoji)
);

create table if not exists espacio_lecturas (
  canal_id uuid not null references espacio_canales(id) on delete cascade,
  usuario_id uuid not null references team_members(id),
  ultimo_leido_at timestamptz not null default now(),
  silenciado boolean not null default false,
  primary key (canal_id, usuario_id)
);

create table if not exists espacio_seguimientos (
  mensaje_raiz_id uuid not null references espacio_mensajes(id) on delete cascade,
  usuario_id uuid not null references team_members(id),
  created_at timestamptz not null default now(),
  primary key (mensaje_raiz_id, usuario_id)
);

create table if not exists espacio_presencia (
  usuario_id uuid primary key references team_members(id),
  visto_at timestamptz not null default now(),
  estado text not null default 'fuera' check (estado in ('activo','ausente','fuera')),
  dispositivo text
);

create table if not exists espacio_reunion_sesiones (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references espacio_canales(id) on delete cascade,
  inicio_at timestamptz not null default now(),
  fin_at timestamptz,
  asistentes uuid[] not null default '{}',
  resumen_ia text,
  acta jsonb,
  abierta_por uuid references team_members(id),
  cerrada_por uuid references team_members(id)
);
create unique index if not exists espacio_sesion_abierta_uq on espacio_reunion_sesiones (canal_id) where fin_at is null;

create table if not exists espacio_reunion_puntos (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references espacio_canales(id) on delete cascade,
  titulo text not null check (length(titulo) between 3 and 120),
  propuesto_por uuid references team_members(id),
  origen_mensaje_id uuid references espacio_mensajes(id) on delete set null,
  contexto jsonb not null default '[]',
  votos uuid[] not null default '{}',
  orden int not null default 0,
  estado text not null default 'propuesto' check (estado in ('propuesto','tratado','acordado','pospuesto','retirado')),
  sesion_id uuid references espacio_reunion_sesiones(id) on delete set null,
  arrastres int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists espacio_puntos_canal_idx on espacio_reunion_puntos (canal_id, estado, orden);

create table if not exists espacio_acuerdos (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references espacio_reunion_sesiones(id) on delete cascade,
  punto_id uuid references espacio_reunion_puntos(id) on delete set null,
  texto text not null check (length(texto) between 3 and 500),
  responsable_id uuid not null references team_members(id),
  vence_at date,
  tarea_id uuid references ti_tareas(id) on delete set null,
  hecho_at timestamptz,
  created_at timestamptz not null default now()
);

-- Ahora que existen sesiones y puntos, amarrar las columnas del mensaje.
alter table espacio_mensajes
  add constraint espacio_mensajes_sesion_fk foreign key (sesion_id) references espacio_reunion_sesiones(id) on delete set null,
  add constraint espacio_mensajes_punto_fk foreign key (punto_id) references espacio_reunion_puntos(id) on delete set null;

-- RLS activo, sin políticas: la llave anónima no ve nada.
alter table espacio_secciones enable row level security;
alter table espacio_canales enable row level security;
alter table espacio_mensajes enable row level security;
alter table espacio_reacciones enable row level security;
alter table espacio_lecturas enable row level security;
alter table espacio_seguimientos enable row level security;
alter table espacio_presencia enable row level security;
alter table espacio_reunion_sesiones enable row level security;
alter table espacio_reunion_puntos enable row level security;
alter table espacio_acuerdos enable row level security;

-- Semilla: el árbol inicial (idempotente por nombre).
insert into espacio_secciones (nombre, orden) values ('Equipo', 1), ('Ventas', 2), ('Reuniones', 3), ('Sistema', 4)
on conflict do nothing;

with s as (select id, nombre from espacio_secciones)
insert into espacio_canales (seccion_id, nombre, descripcion, tipo, importante, regla_reunion, orden)
select s.id, c.nombre, c.descripcion, c.tipo, c.importante, c.regla, c.orden
from (values
  ('Equipo',    'general',              'Lo de todos los días',                                 'charla',  false, null::jsonb, 1),
  ('Equipo',    'aleatorio',            'Lo que no es trabajo',                                 'charla',  false, null, 2),
  ('Equipo',    'decisiones',           'Solo lo que ya se decidió. Se fija.',                  'charla',  true,  null, 3),
  ('Ventas',    'leads-calientes',      'Los que hay que cerrar esta semana',                   'charla',  false, null, 1),
  ('Ventas',    'nuevo-arr',            'Cada venta nueva y cada anualidad',                    'charla',  false, null, 2),
  ('Ventas',    'cotizaciones',         'Lo que se está cotizando',                             'charla',  false, null, 3),
  ('Reuniones', 'lunes-semanal',        'La junta de la semana',                                'sala',    false, '{"dia_iso":1,"hora":"09:00"}', 1),
  ('Reuniones', 'revision-comisiones',  'El corte del lunes, el que se paga el martes',         'sala',    false, '{"dia_iso":1,"hora":"10:00"}', 2),
  ('Reuniones', 'producto',             'Qué construimos y por qué',                            'sala',    false, null, 3),
  ('Sistema',   'leads-nuevos',         'Cada lead que entra',                                  'sistema', false, null, 1),
  ('Sistema',   'tickets',              'Soporte: abiertos y resueltos',                        'sistema', false, null, 2),
  ('Sistema',   'commits',              'Lo que se subió',                                      'sistema', false, null, 3),
  ('Sistema',   'errores',              'Lo que se rompió',                                     'sistema', false, null, 4)
) as c(seccion, nombre, descripcion, tipo, importante, regla, orden)
join s on s.nombre = c.seccion
where not exists (select 1 from espacio_canales x where x.seccion_id = s.id and x.nombre = c.nombre);

-- Verificación esperada:
-- select count(*) from espacio_canales;  -- 13
-- select count(*) from pg_policies where tablename like 'espacio_%';  -- 0
