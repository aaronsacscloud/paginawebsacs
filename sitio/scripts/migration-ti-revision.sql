-- Revisión diaria (F6): por conversación con actividad ayer, avance + propuesta concreta con fundamento.
create table if not exists ti_revision (
  id uuid primary key default gen_random_uuid(),
  dia date not null,
  contact_id uuid not null,
  conversation_id uuid,
  avance text,                -- avanzo | igual | retrocedio
  etapa_antes text, etapa_despues text,
  resumen text,
  que_funciono text,
  preguntas_abiertas jsonb not null default '[]'::jsonb,
  propuesta jsonb not null default '{}'::jsonb,   -- {tipo, texto, fundamento, riesgo}
  estado text not null default 'propuesta',       -- propuesta | aceptada | rechazada | ejecutada | automatica
  motivo text,
  decidido_por uuid, decidido_at timestamptz,
  costo_usd numeric,
  created_at timestamptz not null default now(),
  unique (dia, contact_id)
);
