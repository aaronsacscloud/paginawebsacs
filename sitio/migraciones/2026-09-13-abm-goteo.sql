-- Envíos progresivos («goteo»): una base entra a su cadencia de a poco.
--
-- Por qué. Villa Hidalgo son 185 proveedores de mayoreo que se conocen entre
-- ellos: es una comunidad, no una lista. Si los 171 con correo reciben el mismo
-- correo de presentación la misma mañana, a mediodía ya se preguntan en el
-- grupo de WhatsApp «¿de dónde sacaron la base?» y el remitente queda quemado
-- antes del segundo correo. La instrucción del dueño (13-sep-2026): que salgan
-- de diez en diez, cada día a diez negocios distintos, de esa base y de esa
-- cadencia, como una opción del sistema.
--
-- Cómo. Un renglón en abm_goteo describe UNA salida progresiva: qué cadencia,
-- cuántas cuentas por día y con qué filtro se eligen. Cada día hábil, el
-- cartero (/api/cron/abm-cadencias) toma las N cuentas elegibles mejor
-- puntuadas que todavía no tienen cadencia, les escribe la suya (con IA, como
-- desde la ficha) y la deja APROBADA. La aprobación la dio la persona que
-- encendió el goteo, una sola vez y para toda la base: eso es lo que
-- significa activarlo, y por eso lleva creado_por. La regla 8.3 del manual
-- («nada sale sin que una persona apruebe») se cumple en ese acto; el motor
-- global (abm_config.pausado) sigue mandando y un goteo activo con el motor
-- pausado no enrola a nadie.
--
-- abm_goteo_lotes es la bitácora: qué día, cuántas, cuáles y por qué no,
-- cuando no. Sin eso, «¿ya salieron los de hoy?» se contesta contando toques.

create table if not exists abm_goteo (
  id            uuid primary key default gen_random_uuid(),
  cadencia_id   uuid not null references abm_cadencias(id) on delete cascade,
  nombre        text not null,
  cuentas_dia   int  not null default 10 check (cuentas_dia between 1 and 100),
  -- Filtro sobre abm_cuentas además del giro/ruta de la cadencia. Hoy se
  -- entienden `ciudad` (ilike) y `subgiro` (ilike); vacío = toda la base.
  filtro        jsonb not null default '{}'::jsonb,
  con_ia        boolean not null default true,
  estado        text not null default 'activo' check (estado in ('activo', 'pausado', 'terminado')),
  inicio        date not null default current_date,      -- no enrola antes de esta fecha
  hasta         date,                                    -- ni después de esta, si se pone
  ultimo_lote   date,                                    -- último día que enroló (o intentó)
  enroladas     int  not null default 0,
  creado_por    uuid references team_members(id),
  nota          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists abm_goteo_cadencia_idx on abm_goteo (cadencia_id);

create table if not exists abm_goteo_lotes (
  id         uuid primary key default gen_random_uuid(),
  goteo_id   uuid not null references abm_goteo(id) on delete cascade,
  fecha      date not null default current_date,
  cuentas    int  not null default 0,
  sin_ia     int  not null default 0,        -- cuántas salieron con la plantilla porque la IA falló
  detalle    jsonb not null default '[]'::jsonb,   -- [{cuenta_id, nombre, correos, con_ia}]
  motivo     text,                           -- por qué no se enroló (nadie elegible, fila atorada…)
  created_at timestamptz not null default now()
);
create index if not exists abm_goteo_lotes_goteo_idx on abm_goteo_lotes (goteo_id, fecha desc);

-- Cada toque sabe si nació de un goteo: así se cuenta «cuántas van» y se
-- distingue lo que enroló el sistema de lo que aprobó alguien desde la ficha.
alter table abm_toques add column if not exists goteo_id uuid references abm_goteo(id) on delete set null;
create index if not exists abm_toques_goteo_idx on abm_toques (goteo_id) where goteo_id is not null;

-- El primero: la base de Villa Hidalgo, cadencia «Mayoristas · demo», diez al día.
insert into abm_goteo (id, cadencia_id, nombre, cuentas_dia, filtro, con_ia, estado, creado_por, nota)
values (
  'd0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b10',
  'c0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b01',
  'Villa Hidalgo · diez al día',
  10, '{}'::jsonb, true, 'activo',
  '60be8bd8-995a-45ca-926f-1bcb159d3c1e',
  'Son comunidad: si les llega a todos el mismo día se preguntan de dónde salió la base. Diez negocios nuevos cada día hábil, los mejor puntuados primero.'
)
on conflict (id) do nothing;
