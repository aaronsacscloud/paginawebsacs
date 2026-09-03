-- ═══ quotes.updated_at: la columna que tres consultas ya daban por hecha ═══
--
-- Hallazgo del 3-sep-2026, midiendo por qué el pago diferido de Ruben's no
-- salía en Finanzas. `quotes` NUNCA tuvo `updated_at`, pero TRES lugares la
-- piden. PostgREST responde 400 y el código hace `const { data } = …`, así que
-- el error se pierde y la pantalla enseña un cero que parece un dato:
--
--   · Finanzas · «Por cobrar de venta nueva» → $0 permanente (había $150,000
--     en COT-78905). Medido: la consulta vieja devuelve `filas: null`.
--   · TI · detector «cotización sin movimiento 30 días» → nunca disparó.
--     Medido: 1 candidata real que nadie estaba viendo.
--   · TI · «sigue viva» y «sigue en proceso de pago» escriben updated_at:
--     el UPDATE falla, así que el reloj no se reinicia nunca.
--
-- Se agrega la columna en vez de cambiar las consultas a `created_at` porque
-- el reloj tiene que poder REINICIARSE: «sigue viva» necesita mover una fecha,
-- y la de creación no se mueve.
--
-- Sin trigger a propósito: un trigger en cada UPDATE dejaría que el contador
-- de vistas del link público mantuviera la cotización eternamente «fresca» y
-- el detector de dormidas no volvería a disparar jamás. Se escribe donde hay
-- movimiento de verdad (abono registrado, decisión del consultor en TI).
--
-- Aditiva y reversible: `alter table quotes drop column updated_at;`

alter table quotes add column if not exists updated_at timestamptz;

-- Relleno con el último movimiento CONOCIDO, de lo más reciente a lo más
-- viejo. Sin esto toda la cartera arrancaría en NULL y el detector de dormidas
-- la ignoraría entera, porque `columna < fecha` nunca incluye NULL.
update quotes
   set updated_at = coalesce(pagado_fecha::timestamptz, aceptado_fecha, created_at)
 where updated_at is null;

alter table quotes alter column updated_at set default now();

create index if not exists quotes_updated_at on quotes (updated_at);

select count(*) total,
       count(*) filter (where updated_at is null) sin_fecha,
       min(updated_at) mas_vieja, max(updated_at) mas_nueva
  from quotes;
