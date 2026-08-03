-- Recalcula companies.mrr/arr/fecha_renovacion/estado_cuenta desde subscriptions,
-- que es la fuente de verdad. Replica exactamente recalcCompany() del endpoint.
--
-- Por qué hace falta: esos campos SOLO se recalculan cuando una suscripción se
-- muta por la API. Las empresas cuyas subs entraron por importación/migración —o
-- se tocaron por otra vía— se quedaron con el valor viejo. 27 empresas estaban
-- desfasadas: mibellapandita guardaba $0 con $150,000 reales, y varias empresas
-- sin suscripciones conservaban ARR de cuando la tenían.
--
-- Lo consumen el reporte de ingresos, el export de clientes y el fallback de
-- Oportunidades (la lista de Clientes y el hub ARR ya calculaban desde las subs,
-- por eso el KPI de pantalla se veía bien y esto pasaba inadvertido).
-- Es idempotente: solo deriva.
with agg as (
  select c.id,
         coalesce(sum(s.mrr) filter (where s.estado = 'activa'), 0)                as mrr,
         min(s.proxima_factura) filter (where s.estado = 'activa')                 as prox,
         count(s.*) filter (where s.estado = 'activa')                             as n_act,
         count(s.*) filter (where s.estado in ('pendiente_pago','programada'))     as n_pend,
         count(s.*) filter (where s.estado = 'pausada')                            as n_pausa,
         count(s.*)                                                                as n_total
    from companies c
    left join subscriptions s on s.company_id = c.id
   group by c.id
)
update companies c
   set mrr = round(agg.mrr::numeric, 2),
       arr = round((agg.mrr * 12)::numeric, 2),
       fecha_renovacion = agg.prox,
       estado_cuenta = case when agg.n_act   > 0 then 'activo'
                            when agg.n_pend  > 0 then 'vencido'
                            when agg.n_pausa > 0 then 'pausado'
                            when agg.n_total > 0 then 'cancelado'
                            else 'prospecto' end
  from agg
 where agg.id = c.id
   and (abs(coalesce(c.arr,0) - round((agg.mrr*12)::numeric,2)) > 0.01
        or c.fecha_renovacion is distinct from agg.prox);
