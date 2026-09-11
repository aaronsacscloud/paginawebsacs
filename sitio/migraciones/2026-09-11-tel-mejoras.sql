-- LLAMADAS INTELIGENTES · segunda tanda (11-sep-2026): sala que no se cae,
-- tope y horario que piensan, costo y disyuntor, cierre con IA, reglas y
-- conocimiento como datos.

-- Items: cuándo volver a marcar (compromiso o caída), costo, cierre propuesto por IA,
-- corrección del vendedor al detector, y el momento en que el vendedor se cayó en línea.
alter table tel_sesion_items add column if not exists volver_at timestamptz;
alter table tel_sesion_items add column if not exists prioridad int not null default 0;
alter table tel_sesion_items add column if not exists costo_usd numeric(8,4);
alter table tel_sesion_items add column if not exists cierre_ia jsonb;
alter table tel_sesion_items add column if not exists cierre_estado text;      -- proponiendo|propuesto|aplicado|sin_datos
alter table tel_sesion_items add column if not exists correccion text;         -- era_persona|era_maquina
alter table tel_sesion_items add column if not exists agente_salio_at timestamptz;
alter table tel_sesion_items add column if not exists lada text;
create index if not exists tel_sesion_items_volver_idx on tel_sesion_items (sesion_id, volver_at) where estado = 'pendiente';

-- Sesión: costo acumulado, racha de fallidas (disyuntor) y por qué se pausó.
alter table tel_sesiones add column if not exists costo_usd numeric(10,4) not null default 0;
alter table tel_sesiones add column if not exists fallidas_seguidas int not null default 0;
alter table tel_sesiones add column if not exists pausa_motivo text;           -- horario|caida|disyuntor|manual|sala

-- Reglas del oído como datos: lo que el vendedor corrige propone una frase nueva.
create table if not exists tel_reglas (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('persona','buzon','portero')),
  patron      text not null,                       -- frase o regex simple (sin acentos, minúsculas)
  origen      text not null default 'manual',      -- manual|ia|correccion
  estado      text not null default 'activa' check (estado in ('activa','propuesta','descartada')),
  ejemplo     text,                                -- lo que se oyó cuando se propuso
  item_id     uuid,
  veces       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tel_reglas_estado_idx on tel_reglas (estado, tipo);

-- Lo que se promete mandar en una llamada y su respuesta: la memoria del cierre.
create table if not exists tel_conocimiento (
  id          uuid primary key default gen_random_uuid(),
  tema        text not null,                       -- «facturación», «precio con dos sucursales»
  claves      text[] not null default '{}',        -- palabras con las que se busca
  texto       text,                                -- lo que se manda por WhatsApp
  pdf_url     text,                                -- el PDF ya generado (se reutiliza)
  origen      text not null default 'vendedor',    -- vendedor|fundador|ia
  estado      text not null default 'activo' check (estado in ('activo','pendiente','descartado')),
  veces_usado int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tel_conocimiento_estado_idx on tel_conocimiento (estado);
