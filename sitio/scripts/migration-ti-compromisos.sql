-- 2026-09-05 · COMPROMISOS: cuando el prospecto pide una acción con fecha («llámame el jueves», «contáctame en 30
-- días», «estoy de viaje, la otra semana»), se le responde con empatía y se programa el seguimiento EXACTO: qué día,
-- a qué hora (la suya) y qué hay que hacer (escribir, llamar, agendar). Sección propia en Trabajo inteligente.
create table if not exists ti_compromisos (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null,
  conversation_id uuid,
  tipo text not null,                 -- retomar | llamar | agendar | esperar_dato | esperar_evento
  pidio text,                          -- lo que dijo el lead, textual
  interpretacion text,                 -- «quiere que lo busquemos la otra semana»
  programado_para timestamptz not null,
  hora_local int,                      -- la hora CDMX elegida y por qué (mejor_hora_wa / la de su mensaje)
  por_que_hora text,
  estado text not null default 'programado',   -- programado | preguntando_hora | cumplido | cancelado | reprogramado
  accion_al_vencer text not null default 'escribir',   -- escribir | llamar | agendar
  mensaje_origen_id uuid,             -- el wa_mensaje donde lo pidió
  envio_id uuid,                       -- el envío que se generó al vencer
  confianza numeric(3,2),
  creado_por text default 'agente',    -- agente | consultor
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  cumplido_at timestamptz,
  notas text
);
create index if not exists ix_ti_compromisos_vence on ti_compromisos (estado, programado_para);
create index if not exists ix_ti_compromisos_contact on ti_compromisos (contact_id, created_at desc);
