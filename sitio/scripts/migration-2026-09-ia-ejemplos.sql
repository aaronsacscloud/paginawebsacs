-- TRABAJO INTELIGENTE · ia_ejemplos: las respuestas humanas que SÍ funcionaron
-- (de conversaciones que convirtieron) y las correcciones del dueño («esto
-- hubiera contestado yo»). Las aprobadas entran al prompt del agente como
-- ejemplos de su estado. Pedido del dueño 2026-09-02.
create table if not exists ia_ejemplos (
  id            uuid primary key default gen_random_uuid(),
  estado        text not null,            -- estado del guion (descubriendo, proponiendo…)
  giro          text,
  situacion     text,                     -- qué dijo/pidió el lead
  mensaje_lead  text,
  respuesta     text not null,            -- la humana, tal cual
  pulida        text,                     -- lista para reusar
  por_que       text,
  lo_humano     text,
  fuente        text not null default 'convirtio',  -- convirtio | correccion_dueno | sombra
  contact_id    uuid,
  conversation_id uuid,
  modelo        text,
  estado_rev    text not null default 'propuesta',  -- propuesta | aprobado | rechazado
  usos          int not null default 0,
  created_at    timestamptz not null default now(),
  revisado_at   timestamptz
);
create index if not exists ia_ejemplos_estado on ia_ejemplos (estado, estado_rev);
