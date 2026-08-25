-- LEADS v2 · F1: estatus operativo materializado (YA APLICADO en prod 2026-08-25
-- vía Management API; este archivo es el registro).
alter table contacts
  add column if not exists estatus_lead text not null default 'nuevo',
  add column if not exists estatus_lead_at timestamptz default now(),
  add column if not exists respondio_at timestamptz,
  add column if not exists origen_alta text,
  add column if not exists nombre_confianza text,
  add column if not exists retenido_hasta timestamptz,
  add column if not exists retenido_razon text;
alter table wa_conversaciones
  add column if not exists triage text,
  add column if not exists triage_meta jsonb;
create index if not exists idx_contacts_estatus on contacts (estatus_lead) where archived_at is null;

-- La función exec_estatus_recalculo() se genera desde la fuente única:
-- src/lib/crm/estatus-lead.sql.ts (SQL_RECALCULO_ESTATUS). Si cambia el TS,
-- recrear la función con ese cuerpo. La llama /api/cron/leads-estatus (3 am CDMX).
-- Backfill inicial: 265 contactos clasificados; 2ª corrida = 0 (idempotente).
-- Owner: copiado de wa_conversaciones.asignado_a (solo 1: casi nada estaba asignado).
-- Vistas: sección "Funnel de venta" + 7 vistas-hueco sembradas en crm_vistas (compartidas).
