-- ═══ Oportunidades v2: qué se vendió y qué tipo de dinero es ═══
--
-- El problema de fondo: una oportunidad guardaba UN plan, UN valor y un
-- `billing_period` que casi siempre venía vacío. Con eso, el pipeline sumaba en
-- la misma bolsa una licencia mensual de $900 y una implementación única de
-- $80,000 — números que no significan lo mismo ni se pronostican igual—, y al
-- ganar no había con qué crear la suscripción.
--
-- `items` es lo que de verdad se vendió (líneas del catálogo, plugins,
-- personalizados y pagos únicos, cada una con su descuento). De ahí se derivan
-- los tres números que sí se pueden leer:
--   mrr          → lo que se repite cada mes
--   valor_unico  → lo que se cobra una sola vez (implementación, hardware)
--   valor_total  → valor del PRIMER AÑO = mrr*12 + valor_unico
--
-- valor_total se conserva con ese significado porque de ahí cuelgan las
-- comisiones a socios y el pipeline histórico; cambiarle el sentido en silencio
-- movería comisiones ya calculadas.

alter table deals add column if not exists items          jsonb;
alter table deals add column if not exists mrr            numeric default 0;
alter table deals add column if not exists valor_unico    numeric default 0;
alter table deals add column if not exists descuento_pct  numeric;
-- 'recurrente' | 'unico' | 'mixto' — derivado de los items, guardado para poder
-- filtrar y agrupar sin recalcular en cada consulta.
alter table deals add column if not exists tipo_ingreso   text;
-- Qué se generó al ganar, para no volver a generarlo si alguien reabre y cierra
-- otra vez (y para poder auditar de dónde salió cada suscripción).
alter table deals add column if not exists subscription_id uuid references subscriptions(id) on delete set null;

create index if not exists deals_tipo_ingreso_idx on deals (tipo_ingreso);
create index if not exists deals_company_idx on deals (company_id);

-- Retro: lo que ya existía tenía el MRR en valor_mensual y el tipo en
-- billing_period. Sin esto, las oportunidades viejas se leerían como $0 de MRR.
update deals set mrr = coalesce(valor_mensual, 0) where mrr is null or mrr = 0;
update deals set tipo_ingreso = case
    when billing_period = 'unico' then 'unico'
    when coalesce(valor_mensual, 0) > 0 then 'recurrente'
    else null   -- sin datos: que se vea vacío, no que finja ser recurrente
  end
where tipo_ingreso is null;
update deals set valor_unico = coalesce(valor_total, 0)
where tipo_ingreso = 'unico' and coalesce(valor_unico, 0) = 0;

-- De qué oportunidad nació cada suscripción: es lo que hace idempotente el
-- cierre (reabrir y volver a ganar no puede crear una segunda suscripción) y lo
-- que permite auditar de dónde salió cada peso del ARR.
alter table subscriptions add column if not exists deal_id uuid references deals(id) on delete set null;
create index if not exists subscriptions_deal_idx on subscriptions (deal_id);
