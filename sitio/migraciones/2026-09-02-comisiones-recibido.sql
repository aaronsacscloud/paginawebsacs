-- ════════════════════════════════════════════════════════════════════════
-- Comisiones · firma de recibido en el estado de cuenta
-- ════════════════════════════════════════════════════════════════════════
--
-- El corte ya se podía enviar, pero no había forma de saber si el consultor lo
-- vio y estuvo de acuerdo. Sin ese acuse, un reclamo tres semanas después
-- ("nunca vi ese descuento") no tiene contra qué contrastarse.
--
-- Se firma desde la propia página del estado de cuenta, con el UUID del corte
-- como llave. Se guarda quién firmó, cuándo y desde dónde: no es una firma
-- legal, es un acuse con rastro, que es lo que hace falta para cerrar la
-- conversación de un pago.
alter table comision_cortes
  add column if not exists recibido_at     timestamptz,
  add column if not exists recibido_nombre text,
  add column if not exists recibido_ip     text,
  add column if not exists recibido_agente text,
  add column if not exists recibido_nota   text;
