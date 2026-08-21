-- ═══════════════════════════════════════════════════════════════════════════
-- SOPORTE · Tickets/conversaciones de Intercom ligados al perfil del cliente.
-- ✅ APLICADA en producción vía Management API el 2026-08-21.
--
-- Intercom manda company.id = la cuenta SACS (lo pone sacs3 en intercomSettings).
-- El webhook resuelve cuenta → company_id (company_sacs_accounts) o email →
-- contacts. Estado VIVO del ticket aquí; cada transición además deja un evento
-- en `activities` para el timeline unificado de la ficha 360.
-- (El CHECK de activities.tipo ya fue eliminado en prod — insertar ticket_* es seguro.)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists crm_soporte_tickets (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,          -- id de la conversación/ticket en Intercom
  company_id uuid references companies(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  cuenta text,                            -- la cuenta SACS cruda (para reconciliar si aún no mapea)
  estado text not null default 'abierto'
    check (estado in ('abierto','en_curso','pausado','resuelto','cerrado')),
  asunto text,
  vista_previa text,                      -- primer mensaje / resumen
  prioridad text,                         -- priority de Intercom (si aplica)
  asignado text,                          -- nombre del admin asignado
  autor_email text,                       -- email del que abrió (para el fallback por contacto)
  abierto_at timestamptz,
  resuelto_at timestamptz,
  ultima_actividad_at timestamptz,
  intercom_url text,                      -- deep-link a la conversación en Intercom
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_soporte_conv on crm_soporte_tickets (conversation_id);
create index if not exists ix_soporte_company on crm_soporte_tickets (company_id, ultima_actividad_at desc);
create index if not exists ix_soporte_estado on crm_soporte_tickets (estado, ultima_actividad_at desc);
create index if not exists ix_soporte_cuenta on crm_soporte_tickets (lower(trim(cuenta)));

alter table crm_soporte_tickets enable row level security;
