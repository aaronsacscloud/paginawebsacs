-- ══ CUÁNTAS SUCURSALES TIENE EL NEGOCIO (no cuántas nos contrató) ══════════
--
-- `companies.sucursales` dice cuántas están ACTIVAS en el sistema: las que nos
-- paga. Lo que no estaba en ningún lado es cuántas tiene EL NEGOCIO en la
-- calle, y esa resta es una oportunidad de expansión que hoy nadie ve: si
-- Okulany tiene cuatro tiendas y contrató una, hay tres esperando.
--
-- Se guarda aparte y no se deduce: nadie puede adivinar cuántas sucursales
-- tiene un cliente. Se pregunta en la junta y se captura.
alter table companies add column if not exists sucursales_negocio int;

comment on column companies.sucursales is
  'Sucursales ACTIVAS en el sistema: las que el cliente paga.';
comment on column companies.sucursales_negocio is
  'Sucursales que el NEGOCIO tiene en la calle, contratadas o no. La resta contra `sucursales` es la expansión disponible.';
