-- Cuántas sucursales cubre CADA licencia.
-- `companies.sucursales` dice cuántas tiene el negocio; esto dice cuántas
-- PAGA en esa licencia, que no siempre es lo mismo (caso Alazanas: dos
-- licencias anuales de distinto tamaño en la misma cuenta).
-- Nulo = no se ha capturado; no se asume 1 para no inventar un dato.
alter table subscriptions add column if not exists sucursales integer;
