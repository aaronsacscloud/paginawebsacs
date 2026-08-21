-- Consolidación Soporte × CRM (10 features). Aditivo, idempotente.
alter table crm_soporte_tickets add column if not exists tema text;
alter table crm_soporte_tickets add column if not exists sentimiento text;         -- positivo|neutral|negativo|urgente
alter table crm_soporte_tickets add column if not exists primera_respuesta_at timestamptz; -- FRT / SLA
alter table crm_soporte_tickets add column if not exists reabierto_count int not null default 0;
alter table crm_soporte_tickets add column if not exists mensajes_count int;
alter table crm_soporte_tickets add column if not exists csat_score int;            -- 1..5 (CSAT al resolver)
alter table crm_soporte_tickets add column if not exists csat_at timestamptz;
alter table crm_soporte_tickets add column if not exists csat_campana_id uuid;      -- campaña CSAT disparada

create index if not exists idx_soporte_company_estado on crm_soporte_tickets (company_id, estado);
create index if not exists idx_soporte_estado_ultima on crm_soporte_tickets (estado, ultima_actividad_at);
create index if not exists idx_soporte_tema on crm_soporte_tickets (tema);

-- Rollup de soporte denormalizado en companies (lo leen health, riesgo y la tabla de subs).
alter table companies add column if not exists soporte_abiertos int not null default 0;
alter table companies add column if not exists soporte_estancado boolean not null default false;
alter table companies add column if not exists soporte_sentimiento text;   -- peor sentimiento entre tickets abiertos
alter table companies add column if not exists soporte_computed_at timestamptz;
