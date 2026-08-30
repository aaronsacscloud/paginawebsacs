-- ═══ MÓDULO CHURN · F0 ═══════════════════════════════════════════════════
-- El caso de churn: un EPISODIO de cancelación con su historia completa, no
-- un campo de estado en la empresa. Un cliente puede cancelar, ser rescatado
-- y volver a cancelar; el reincidente se trata distinto y hay que verlo.
--
-- Medido contra producción antes de escribir esto (30-ago-2026):
--   · 39 subs canceladas · $38,958 de MRR · 35 empresas
--   · las 3 fuentes de "canceló" CUADRAN en 35; la única discrepancia es una
--     empresa con sub cancelada y otra viva → eso es contracción, no churn
--   · 15 traen fecha real de cancelación; 24 vienen de Excel sin fecha
--   · 29 de 39 tienen sacs_account (o sea: uso real medible)
--   · las 39 razones escritas se agrupan en 5 categorías reales

create table if not exists churn_casos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  company_id      uuid not null references companies(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,

  -- Reincidencia: el episodio 2 se liga al 1 y NUNCA lo edita.
  episodio       integer not null default 1,
  caso_previo_id uuid references churn_casos(id) on delete set null,

  etapa text not null default 'detectado',

  -- Se COPIA al abrir: si la sub cambia después, el caso conserva cuánto valía.
  mrr_perdido numeric not null default 0,

  motivo_categoria text,
  motivo_detalle   text,
  -- Lo que decía la sub al cancelar, intacto. El original no se pisa nunca:
  -- sirve para comparar lo que dijo con lo que de verdad pasó.
  motivo_original  text,

  detectado_at    timestamptz not null default now(),
  -- 24 de 39 vienen de Excel sin fecha. Marcarlas es lo que evita que el
  -- "tiempo medio de rescate" se calcule sobre fechas inventadas.
  fecha_estimada  boolean not null default false,
  conciliacion_at timestamptz,
  gracia_at       timestamptz,
  cerrado_at      timestamptz,

  -- Una gracia sin fecha fin es un cliente gratis para siempre: los tres
  -- campos son obligatorios para entrar a la etapa (validado en el servidor).
  gracia_acuerdo    text,
  gracia_fin        date,
  gracia_mrr        numeric,
  gracia_extensiones integer not null default 0,

  resultado             text,
  resultado_motivo      text,
  -- La sub que lo trajo de vuelta. Sin ella no hay "recuperado".
  subscription_nueva_id uuid references subscriptions(id) on delete set null,

  owner_id        uuid,
  proximo_paso    text,
  proximo_paso_at date,
  notas           text,

  constraint churn_etapa_valida check (etapa in ('detectado','conciliacion','gracia','recuperado','irrecuperable')),
  constraint churn_resultado_valido check (resultado is null or resultado in ('recuperado','perdido')),
  -- Recuperado EXIGE la sub que lo respalda. Un recuperado que no paga es un
  -- dato que miente, y mentiría en la ARR.
  constraint churn_recuperado_con_sub check (etapa <> 'recuperado' or subscription_nueva_id is not null),
  -- Cerrar exige decir por qué.
  constraint churn_irrecuperable_con_motivo check (etapa <> 'irrecuperable' or coalesce(resultado_motivo,'') <> ''),
  -- Entrar a gracia exige el acuerdo COMPLETO.
  constraint churn_gracia_completa check (
    etapa <> 'gracia' or (coalesce(gracia_acuerdo,'') <> '' and gracia_fin is not null and gracia_mrr is not null)
  )
);

-- UN solo caso abierto por empresa: si cancela otra sub mientras se le
-- rescata, se anota en el caso vivo en vez de abrir uno paralelo.
create unique index if not exists churn_casos_uno_abierto
  on churn_casos (company_id) where etapa not in ('recuperado','irrecuperable');

create index if not exists churn_casos_etapa      on churn_casos (etapa);
create index if not exists churn_casos_company    on churn_casos (company_id);
create index if not exists churn_casos_gracia_fin on churn_casos (gracia_fin) where etapa = 'gracia';
create index if not exists churn_casos_paso       on churn_casos (proximo_paso_at) where etapa in ('detectado','conciliacion','gracia');

-- El seguimiento NO inventa tabla: notas, llamadas, WhatsApp y correos del
-- caso van al mismo río de `activities` que ya alimenta la ficha 360. Una
-- sola línea de tiempo por cliente.
alter table activities add column if not exists churn_caso_id uuid references churn_casos(id) on delete set null;
create index if not exists activities_churn_caso on activities (churn_caso_id) where churn_caso_id is not null;
