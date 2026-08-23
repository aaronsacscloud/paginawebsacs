-- Inbox WhatsApp G3-G5: respuestas rápidas, estados CRM, snooze, automatización,
-- opt-out y búsqueda en historial. Aplicar a mano, como todas.

-- G3 · Respuestas rápidas ("/atajo" en el composer)
create table if not exists wa_respuestas (
  id uuid primary key default gen_random_uuid(),
  atajo text not null unique,        -- sin "/", minúsculas
  texto text not null,
  created_at timestamptz not null default now()
);

-- G3 · Estado CRM de la conversación (independiente del active/ended de Kapso)
-- y snooze. La reapertura por mensaje entrante la hace el espejo.
alter table wa_conversaciones
  add column if not exists estado_crm text not null default 'abierta'
    check (estado_crm in ('abierta', 'pendiente', 'resuelta')),
  add column if not exists snooze_until timestamptz,
  add column if not exists auto_bienvenida_at timestamptz,
  add column if not exists auto_fuera_at timestamptz;
create index if not exists idx_wa_conv_estado_crm on wa_conversaciones(estado_crm);
create index if not exists idx_wa_conv_snooze on wa_conversaciones(snooze_until) where snooze_until is not null;

-- G5 · Automatización (config singleton en wa_config)
alter table wa_config
  add column if not exists bienvenida_activa boolean not null default false,
  add column if not exists bienvenida_texto text,
  add column if not exists fuera_activa boolean not null default false,
  add column if not exists fuera_texto text,
  add column if not exists horario jsonb,          -- {dias:[1..5], desde:'09:00', hasta:'18:00'}  (hora CDMX)
  add column if not exists asignacion_rr boolean not null default false,
  add column if not exists rr_last int not null default 0;

-- G5 · Opt-out de marketing (lo alimenta el webhook de Kapso y lo respetan
-- los masivos y Nuevo chat)
alter table contacts add column if not exists wa_optout boolean not null default false;

-- G4 · Búsqueda en TODO el historial (trigram para ILIKE rápido)
create extension if not exists pg_trgm;
create index if not exists idx_wa_msj_cuerpo_trgm on wa_mensajes using gin (cuerpo gin_trgm_ops);
