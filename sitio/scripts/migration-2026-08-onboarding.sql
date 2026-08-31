-- ═══ Onboarding de clientes nuevos: el modelo, PAUSADO de fábrica ═════════
--
-- Espejo del patrón de churn: un caso por empresa, etapas que avanzan por
-- HECHOS (uso_sacs), un cron que vigila y avisos cuando algo se atora.
-- Churn rescata al que se va; esto evita que haya que rescatarlo.
--
-- ⚠️ NACE APAGADO. `onboarding_config.activo = false`: todo el motor existe
-- pero no abre casos ni manda nada hasta que el dueño lo encienda desde la
-- pantalla. Al encenderse, SOLO entran clientes nuevos (su primera
-- suscripción viva posterior al encendido) — los 81 existentes no entran en
-- masa: un «bienvenido» a un cliente de años se lee como error.

begin;

-- ── El interruptor y las reglas, editables sin desplegar ──────────────────
create table if not exists onboarding_config (
  id text primary key default 'main',
  activo boolean not null default false,
  activado_at timestamptz,           -- desde cuándo cuentan los "nuevos"
  reglas jsonb not null default '{
    "configurado":   { "productos_min": 10, "usuarios_min": 2 },
    "primer_uso":    { "ventas_min": 1 },
    "uso_constante": { "dias_con_venta": 3, "ventana_dias": 7 },
    "atorado_dias":  { "cuenta_lista": 5, "configurado": 5, "primer_uso": 7 },
    "graduacion_dia": 30
  }'::jsonb,
  updated_at timestamptz not null default now()
);
insert into onboarding_config (id, activo) values ('main', false)
on conflict (id) do nothing;

-- ── El caso ───────────────────────────────────────────────────────────────
create table if not exists onboarding_casos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  etapa text not null default 'cuenta_lista'
    check (etapa in ('cuenta_lista','configurado','primer_uso','uso_constante','graduado','perdido_temprano')),
  inicio date not null default (now() at time zone 'America/Mexico_City')::date,
  consultor_id uuid references team_members(id) on delete set null,
  -- Fecha REAL en que se cumplió cada hito: {"configurado":"2026-09-02",...}
  -- Los hitos se RECALCULAN del uso_sacs vivo; aquí solo queda cuándo.
  hitos jsonb not null default '{}'::jsonb,
  uso_al_abrir jsonb,                -- la foto inicial, como en churn
  atorado_desde timestamptz,         -- null = va avanzando
  cerrado_at timestamptz,
  cierre_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un caso ABIERTO por empresa: cobrar dos cotizaciones no abre dos onboardings.
create unique index if not exists onboarding_uno_abierto
  on onboarding_casos (company_id) where cerrado_at is null;
create index if not exists onboarding_etapa on onboarding_casos (etapa) where cerrado_at is null;

-- Y el vínculo con actividades, para la línea de tiempo del caso.
alter table activities add column if not exists onboarding_caso_id uuid references onboarding_casos(id) on delete set null;

select (select activo from onboarding_config where id='main') interruptor,
       (select count(*) from onboarding_casos) casos;

commit;
