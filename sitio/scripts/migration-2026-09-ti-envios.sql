-- TRABAJO INTELIGENTE · ti_envios: lo que el AGENTE SDR quiere mandar.
-- Nivel N2 «auto con veto»: cada respuesta del agente nace aquí como
-- pendiente con su hora de salida (ahora + ventana de veto); el humano la ve
-- en «Próximos envíos», la puede editar, detener o mandar ya; si nadie la toca,
-- sale sola. Los vetos y ediciones alimentan la rampa y el aprendizaje.
create table if not exists ti_envios (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid,
  conversation_id uuid,
  telefono        text not null,
  origen          text not null default 'respuesta',   -- respuesta | silencio | confirmacion
  estado          text not null default 'pendiente',   -- pendiente | enviado | vetado | fallido | reemplazado | expirado
  mensaje         text not null,
  mensaje_original text,                                -- si el humano lo editó, aquí queda el del agente
  salida          jsonb not null default '{}'::jsonb,   -- estado del guion, objetivo, datos, interés, escalar, siguiente toque
  sale_at         timestamptz not null,
  enviado_at      timestamptz,
  kapso_message_id text,
  error           text,
  vetado_por      uuid,
  motivo_veto     text,
  editado_por     uuid,
  modelo          text,
  costo_usd       numeric(10,6),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists ti_envios_pend on ti_envios (estado, sale_at);
create index if not exists ti_envios_contacto on ti_envios (contact_id, created_at desc);
