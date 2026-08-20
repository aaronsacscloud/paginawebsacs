-- ═══════════════════════════════════════════════════════════════════════════
-- OUTBOUND · OLA 2 — recurrencia NPS, comentario, cita agendada, presión y
-- ejecuciones de pasos cross-canal.
-- ✅ APLICADA en producción vía Management API el 2026-08-20.
-- ═══════════════════════════════════════════════════════════════════════════

-- Encuestas recurrentes (NPS cada X días). null = una sola vez.
alter table inapp_campanas add column if not exists recurrencia_dias int;

-- Comentario del NPS ("¿por qué esa calificación?") — texto plano, tope 500
-- aplicado en sacs_api; aquí solo se guarda y el CRM lo pinta ESCAPADO.
alter table inapp_eventos add column if not exists comentario text;

-- Evento nuevo: cita agendada desde el formato "agenda" (modal con el
-- agendador embebido). El catálogo cerrado vive en sacs_api; este CHECK es
-- el espejo.
alter table inapp_eventos drop constraint if exists inapp_eventos_evento_check;
alter table inapp_eventos add constraint inapp_eventos_evento_check
  check (evento in ('impresion','clic','cierre','descarte','chat_abierto','respuesta_encuesta','cita_agendada'));

-- Presupuesto de presión por cliente y semana (lo alimentan el cron de
-- Outbound y el de Email; lo lee el paso Revisión y la vista Convivencia).
create table if not exists presion_por_company (
  company_id uuid not null,
  semana date not null,            -- lunes de la semana (ISO)
  inapp int not null default 0,    -- impresiones in-app de la semana
  emails int not null default 0,   -- correos enviados de la semana
  updated_at timestamptz not null default now(),
  primary key (company_id, semana)
);

-- Ejecuciones de pasos cross-canal: un paso corre UNA vez por cuenta.
create table if not exists inapp_paso_ejecuciones (
  id bigint generated always as identity primary key,
  paso_id uuid not null references inapp_pasos(id) on delete cascade,
  campana_id uuid not null,
  cuenta text not null,
  detalle jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_inapp_paso_ejec on inapp_paso_ejecuciones(paso_id, cuenta);

alter table presion_por_company enable row level security;
alter table inapp_paso_ejecuciones enable row level security;
