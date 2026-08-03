-- Licencia PAUSADA: el cliente ya compró y pagó, pero pidió congelar (p.ej. no
-- abrió la plaza). No es un churn ni una cancelación: la relación sigue viva y
-- hay que poder gestionarla — por eso se guarda POR QUÉ está pausada y QUÉ se
-- está esperando del cliente, no solo una fecha.
--
-- El estado `pausada` ya existía en el código y ya quedaba fuera del ARR
-- (recalcCompany solo suma las 'activa'); lo que faltaba era el contexto.
alter table subscriptions
  add column if not exists razon_pausa  text,        -- por qué se pausó
  add column if not exists pausa_espera text,        -- qué esperamos del cliente para reactivar
  add column if not exists pausada_at   timestamptz; -- cuándo se pausó (para medir cuánto lleva congelada)

comment on column subscriptions.razon_pausa  is 'Motivo de la pausa (obligatorio al pausar).';
comment on column subscriptions.pausa_espera is 'Qué se espera del cliente para poder reactivarla.';
comment on column subscriptions.pausada_at   is 'Momento en que se pausó; se limpia al reactivar.';
