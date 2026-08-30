-- ═══ MÓDULO CHURN · F0 · backfill de los históricos ══════════════════════
-- Regla de entrada, medida contra producción: es churn la empresa cuya(s)
-- sub(s) se cancelaron y que NO tiene ninguna sub viva. La que canceló una y
-- conserva otra es CONTRACCIÓN — sale del ledger, no abre caso. Eso deja 35.
--
-- Categorías derivadas del TEXTO REAL de las 39 razones escritas, no
-- inventadas. Lo que dijeron, contado: 24 servicio/soporte, 11 no-uso,
-- 2 dejó de pagar, 1 competencia, 1 implementación. Cero por precio.

with viva as (
  select distinct company_id from subscriptions
  where estado in ('activa','programada','pendiente_pago','pausada')
),
cand as (
  select
    s.company_id,
    sum(s.mrr) as mrr_perdido,
    -- la sub cancelada más reciente es la que abre el caso
    (array_agg(s.id order by coalesce(s.cancelada_at, s.updated_at) desc))[1] as sub_id,
    (array_agg(s.razon_cancelacion order by coalesce(s.cancelada_at, s.updated_at) desc))[1] as razon,
    max(s.cancelada_at) as cancelada_real,
    max(s.updated_at)  as tocada_al
  from subscriptions s
  where s.estado = 'cancelada'
    and s.company_id is not null
    and s.company_id not in (select company_id from viva)
  group by s.company_id
)
insert into churn_casos (
  company_id, subscription_id, etapa, mrr_perdido,
  motivo_original, motivo_categoria,
  detectado_at, fecha_estimada, episodio
)
select
  c.company_id,
  c.sub_id,
  'detectado',
  coalesce(c.mrr_perdido, 0),
  c.razon,
  case
    when c.razon ilike '%competencia%'                              then 'competencia'
    when c.razon ilike '%implementaci%'                             then 'implementacion'
    when c.razon ilike '%mal servicio%' or c.razon ilike '%mal_servicio%'
      or c.razon ilike '%soporte%'                                  then 'mal_servicio'
    when c.razon ilike 'no_uso' or c.razon ilike '%no lo usaba%'
      or c.razon ilike '%nunca%us%'                                 then 'no_uso'
    when c.razon ilike '%dej%de pagar%'                             then 'dejo_de_pagar'
    when coalesce(c.razon,'') = ''                                  then null
    else 'otro'
  end,
  -- Fecha real si la hay; si no, la última vez que se tocó el registro,
  -- MARCADA como estimada para que los tiempos de rescate no se calculen
  -- sobre fechas inventadas.
  coalesce(c.cancelada_real, c.tocada_al, now()),
  c.cancelada_real is null,
  1
from cand c
on conflict do nothing;
