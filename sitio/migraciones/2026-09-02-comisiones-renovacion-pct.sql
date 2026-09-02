-- La anualidad no se paga como primera venta.
--
-- El modelo tenía UNA tasa por regla, así que un cliente que renovaba cobraba
-- lo mismo que una venta nueva: kuubpets pagó su anualidad de $7,000 y salió
-- al 35% ($2,058) cuando le tocaba el 30% ($1,764). La deteccion de renovacion
-- YA funcionaba (es_renovacion venia en true) — lo que no existia era una tasa
-- distinta que aplicarle.
--
-- Las tasas altas (35% lead de Sacs, 55% referido, 70% recuperada) son premio
-- de ADQUISICION: se pagan una vez, por traer la cuenta. El recurrente de ARR
-- es 30% fijo. Por eso la tasa de renovacion se guarda POR REGLA y no como un
-- numero global: manda sobre `pct` solo cuando el pago es renovacion, y cada
-- combinacion de origen y concepto puede ajustarse sin tocar codigo.
--
-- Nulo = esa regla no distingue, y una renovacion suya cobra `pct` normal. Es
-- lo correcto para lo que no es ARR (servicios de arranque, personalizacion):
-- ahi no hay anualidad que renovar.
alter table comision_reglas add column if not exists pct_renovacion numeric;

comment on column comision_reglas.pct_renovacion is
  'Tasa cuando el pago es renovacion (anualidad de ARR). Nulo = usa pct.';

-- ARR = licencia + plugins. 30% fijo en todos los origenes.
update comision_reglas set pct_renovacion = 30 where categoria in ('plan', 'plugin');

-- La linea guarda si cobro tasa de anualidad, para que el estado de cuenta lo
-- pueda decir sin recalcular nada.
alter table comision_lineas add column if not exists tasa_de_renovacion boolean not null default false;
