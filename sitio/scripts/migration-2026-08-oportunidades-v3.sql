-- ═══ Oportunidades v3: de dónde viene, para qué es, y quién la aceptó ═══
--
-- Tres cosas que HubSpot y Pipedrive resuelven y aquí faltaban:
--
-- 1. `categoria` — cliente NUEVO vs UPSELL vs RENOVACIÓN. Es la propiedad
--    "deal type" de HubSpot (net new vs repeat business): sin ella, vender por
--    primera vez y renovar se leen igual, y no lo son — cuestan distinto,
--    duran distinto y solo una es crecimiento real.
--
-- 2. `es_sugerencia` — lo que genera el sistema solo (renovaciones que vienen,
--    señales de uso) NO puede entrar al pipeline como si un vendedor lo hubiera
--    trabajado: inflaría el pronóstico con dinero que nadie ha ido a buscar. Nace
--    como SUGERENCIA, no cuenta en ningún KPI, y solo al ACEPTARLA se vuelve una
--    oportunidad de verdad. Descartada, desaparece de la bandeja (queda el
--    registro, para poder afinar después qué señal sirve y cuál es ruido).
--
-- 3. `motivo_perdida` obligatorio — es el "loss reason" de Pipedrive: sin él,
--    en tres meses nadie sabe si se pierde por precio, por función o por no dar
--    seguimiento. La columna ya existía y estaba vacía; ahora el servidor la
--    exige (el catálogo vive en el código, no aquí, para poder cambiarlo sin SQL).

alter table deals add column if not exists categoria      text;   -- nuevo | upsell | renovacion
alter table deals add column if not exists origen         text;   -- manual | auto_renovacion | auto_senal
alter table deals add column if not exists es_sugerencia  boolean not null default false;
alter table deals add column if not exists sugerencia_motivo text; -- por qué la propuso el sistema
alter table deals add column if not exists aceptada_at    timestamptz;
alter table deals add column if not exists descartada_at  timestamptz;
alter table deals add column if not exists descarte_motivo text;
-- De qué suscripción nace una renovación: hace idempotente al generador (una
-- sola sugerencia por suscripción y periodo).
alter table deals add column if not exists renueva_subscription_id uuid references subscriptions(id) on delete cascade;
alter table deals add column if not exists renueva_periodo text;   -- ej. '2027-05' — el vencimiento que cubre

create index if not exists deals_sugerencia_idx on deals (es_sugerencia) where es_sugerencia = true;
create index if not exists deals_categoria_idx on deals (categoria);
-- Una sugerencia por suscripción y periodo: el generador corre a diario y no
-- puede llenar la bandeja con la misma renovación treinta veces.
create unique index if not exists deals_renovacion_unica_idx
  on deals (renueva_subscription_id, renueva_periodo)
  where renueva_subscription_id is not null;

-- Retro: lo que ya existía lo capturó una persona, y es venta nueva salvo que
-- el cliente ya tuviera suscripción cuando se creó el trato.
update deals set origen = 'manual' where origen is null;
update deals d set categoria = case
    when exists (select 1 from subscriptions s where s.company_id = d.company_id and s.created_at < d.created_at) then 'upsell'
    else 'nuevo'
  end
where categoria is null;
