-- LAS ACCIONES QUE PIDE EL CLIENTE EN LA LLAMADA (17-sep-2026)
--
-- Pedido del dueño: «me pidió una acción —enviar la información por WhatsApp—.
-- En el momento en que alguien pida una acción, la IA tiene que ejecutar esa
-- acción y explicar qué acción hizo; y si no reconoce cuál, que yo se la
-- explique para que aprenda.»
--
-- Dos tablas, y la segunda es la que aprende:
--   · tel_acciones       — lo que se oyó, qué acción es, si se hizo y QUÉ PASÓ.
--   · tel_accion_reglas  — las frases que enseñan a reconocerla la próxima vez.

create table if not exists tel_acciones (
  id uuid primary key default gen_random_uuid(),
  -- La llamada. `call_sid` es la llave viva (la sala pregunta por ella);
  -- `item_id` amarra con el riel de Llamadas inteligentes (cierre, envíos).
  call_sid text,
  item_id uuid references tel_sesion_items(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  conversation_id uuid references wa_conversaciones(id) on delete set null,
  telefono text,
  -- Qué acción (id del catálogo de lib/telefonia/acciones.ts) y con qué datos.
  accion text not null,
  params jsonb not null default '{}'::jsonb,
  -- La frase que la disparó, tal cual se oyó: es la evidencia que se le enseña
  -- a quien acaba de colgar, y el ejemplo que aprende la regla.
  frase text,
  origen text not null default 'regla',          -- regla | ia | dictada | manual
  confianza numeric,
  estado text not null default 'propuesta',      -- propuesta | hecha | descartada | fallo
  -- QUÉ PASÓ, en palabras: «salió por plantilla» no es «salió como mensaje».
  resultado text,
  user_id uuid references team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tel_acciones_call_idx on tel_acciones (call_sid);
create index if not exists tel_acciones_item_idx on tel_acciones (item_id);
create index if not exists tel_acciones_fecha_idx on tel_acciones (created_at desc);
-- La misma acción no se propone dos veces en la misma llamada.
create unique index if not exists tel_acciones_una_por_llamada
  on tel_acciones (call_sid, accion) where call_sid is not null;

create table if not exists tel_accion_reglas (
  id uuid primary key default gen_random_uuid(),
  accion text not null,
  patron text not null,
  origen text not null default 'vendedor',       -- semilla | vendedor | ia
  estado text not null default 'activa',         -- activa | propuesta | rechazada
  ejemplo text,
  call_sid text,
  veces integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tel_accion_reglas_unica on tel_accion_reglas (accion, patron);
create index if not exists tel_accion_reglas_estado_idx on tel_accion_reglas (estado);

-- El interruptor de la transcripción en vivo de las llamadas NORMALES
-- (entrantes y marcadas a mano). Encendida por omisión: es lo que permite
-- hacer en el momento lo que el cliente pide. Se apaga aquí si algún día la
-- factura de Twilio lo pide.
alter table wa_config add column if not exists tel_dictado boolean not null default true;
