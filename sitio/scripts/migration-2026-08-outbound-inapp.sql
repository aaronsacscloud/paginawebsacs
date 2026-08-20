-- ═══════════════════════════════════════════════════════════════════════════
-- OUTBOUND · Campañas in-app dentro de SACS3 (módulo del CRM)
-- ✅ APLICADA en producción vía Management API el 2026-08-20.
--
-- El CRM crea la campaña, resuelve la audiencia (companies → cuentas SACS →
-- nivel usuario) y la PUBLICA a sacs_api (sacs3_global.campanas_inapp); los
-- eventos regresan por cron (/api/cron/outbound-sync) a inapp_eventos.
--
-- Decisiones de esquema que NO son opcionales (vienen del plan auditado):
-- - `holdout_pct` y `variante` nacen AQUÍ aunque la UI llegue después:
--   retrofitearlos contamina el grupo de control y el A/B.
-- - `modo` distingue 'unica' (audiencia congelada al activar) de 'continua'
--   (re-evaluación diaria con re-entrada); el holdout usa hash estable
--   md5(campana:uid) — réplica exacta en sacs_api/modules/campanasInapp.js.
-- - RLS encendido SIN políticas = solo service key (patrón gifts/crm_notificaciones).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists inapp_campanas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nombre text not null,
  objetivo_texto text,                      -- "adopción del módulo", libre, para la lista
  estado text not null default 'borrador'
    check (estado in ('borrador','programada','activa','pausada','terminada','archivada')),
  pausa_motivo text,                        -- 'manual' | 'circuit_breaker'
  formato text not null default 'modal'
    check (formato in ('banner_superior','banner_cuadrado','modal','chat',
                       'tarjeta_inicio','badge_menu','encuesta','coachmark')),
  canal text not null default 'web' check (canal in ('web','mobile','ambos')),
  prioridad text not null default 'normal' check (prioridad in ('baja','normal','alta','critica')),
  modo text not null default 'unica' check (modo in ('unica','continua')),
  reentrada_dias int,                       -- solo modo continua: null = nunca re-entra
  contenido jsonb not null default '{}',    -- {titulo, mensaje, imagen, video, tema, botones:[{texto,estilo,accion,destino}], encuesta:{escala}}
  comportamiento jsonb not null default '{}', -- {trigger, modulo_ancla, frecuencia:{tipo,tope,descanso_dias}, cerrable, bloqueante}
  guardar_campana boolean not null default false, -- persistir además en la campana de notificaciones
  audiencia jsonb not null default '{}',    -- Definicion del DSL (grupos/condiciones/excluir)
  nivel jsonb not null default '{"tipo":"todos"}', -- {tipo:'todos'|'grupos'|'uids', grupos:[fid], uids:[], cuenta?}
  meta jsonb,                               -- {tipo:'uso_modulo'|'plugin_activo'|'plan'|'chat'|'acuse', valor, descripcion}
  ventana_atribucion_dias int not null default 14,
  holdout_pct int not null default 10 check (holdout_pct >= 0 and holdout_pct <= 50),
  variante text,                            -- A/B (reservado desde F0)
  vigencia_desde timestamptz,
  vigencia_hasta timestamptz,
  bloqueante_aprobada_por uuid references team_members(id), -- gobernanza del modal bloqueante
  creada_por uuid references team_members(id),
  publicada_at timestamptz,                 -- última publicación a sacs_api
  materializada jsonb,                      -- {cuentas:n, usuarios:n, holdout:n, detalle_exclusiones:{...}, at}
  resumen jsonb,                            -- métricas cacheadas (se recalculan desde la verdad en el cron)
  archived_at timestamptz
);
create index if not exists idx_inapp_campanas_estado on inapp_campanas(estado, updated_at desc);

-- Embudos: pasos encadenados (F3.5; el DDL nace ahora para no migrar eventos).
create table if not exists inapp_pasos (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references inapp_campanas(id) on delete cascade,
  orden int not null default 1,
  espera_dias int not null default 0,
  condicion text not null default 'sin_interaccion'
    check (condicion in ('siempre','sin_interaccion','sin_clic','no_visto')),
  canal_paso text not null default 'inapp' check (canal_paso in ('inapp','email','tarea_whatsapp')),
  formato text,
  contenido jsonb not null default '{}',
  email_campaign_id uuid,                   -- si canal_paso='email': campaña del módulo de email
  variante text,
  created_at timestamptz not null default now()
);
create index if not exists idx_inapp_pasos_campana on inapp_pasos(campana_id, orden);

-- Eventos ingeridos desde sacs3_global.campanas_eventos (cursor progresivo).
create table if not exists inapp_eventos (
  id bigint generated always as identity primary key,
  campana_id uuid not null,
  cuenta text not null,
  uid text not null,
  evento text not null
    check (evento in ('impresion','clic','cierre','descarte','chat_abierto','respuesta_encuesta')),
  boton text,
  valor numeric,
  variante text,
  dia date,
  created timestamptz not null,             -- el timestamp ORIGINAL de Mongo (para el cursor)
  ingested_at timestamptz not null default now()
);
-- Idempotencia del re-pull: el mismo evento (mismo instante) no entra dos veces.
create unique index if not exists uq_inapp_eventos_natural
  on inapp_eventos(campana_id, uid, evento, created);
create index if not exists idx_inapp_eventos_campana on inapp_eventos(campana_id, evento);
create index if not exists idx_inapp_eventos_cuenta on inapp_eventos(cuenta, created desc);

-- Conversiones evaluadas por el cron (meta + view-through + brazo).
create table if not exists inapp_conversiones (
  id bigint generated always as identity primary key,
  campana_id uuid not null references inapp_campanas(id) on delete cascade,
  company_id uuid,
  cuenta text not null,
  uid text,                                 -- null cuando la meta es de cuenta (activó plugin)
  brazo text not null default 'expuesto' check (brazo in ('expuesto','control')),
  convirtio_at timestamptz not null default now(),
  detalle jsonb
);
create unique index if not exists uq_inapp_conv on inapp_conversiones(campana_id, cuenta, coalesce(uid,''));

-- Bitácora de autoría (gobernanza; obligatoria para bloqueantes y postmortems).
create table if not exists inapp_auditoria (
  id bigint generated always as identity primary key,
  campana_id uuid references inapp_campanas(id) on delete set null,
  accion text not null,                     -- 'creo'|'edito'|'activo'|'pauso'|'aprobo_bloqueante'|'archivo'|'prueba'
  quien uuid references team_members(id),
  detalle jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_inapp_auditoria_campana on inapp_auditoria(campana_id, created_at desc);

-- Estado del sincronizador (cursor del pull de eventos, kill switch espejo, etc.)
create table if not exists inapp_sync (
  id text primary key,
  valor jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Interés por módulo en la ficha del cliente → condición de audiencia de email.
alter table companies add column if not exists intereses jsonb;

-- RLS: encendido sin políticas = solo el service key del servidor.
alter table inapp_campanas enable row level security;
alter table inapp_pasos enable row level security;
alter table inapp_eventos enable row level security;
alter table inapp_conversiones enable row level security;
alter table inapp_auditoria enable row level security;
alter table inapp_sync enable row level security;
