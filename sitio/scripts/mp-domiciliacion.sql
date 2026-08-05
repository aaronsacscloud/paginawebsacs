-- Link de domiciliación (preapproval) creado desde el CRM: es distinto del link
-- de pago único que ya vivía en mp_link_pago, y guardarlos en la misma columna
-- haría que enviar uno borrara el otro.
alter table subscriptions add column if not exists mp_domiciliacion_link text;
alter table subscriptions add column if not exists mp_domiciliacion_at timestamptz;
