-- ═══ Quién es el que rebotó ═══
--
-- La bitácora de cobros guardaba monto, motivo y poco más. Un rebote sin correo
-- ni cliente se lee "$8,500 · Tarjeta bloqueada · sin identificar": dice que
-- perdiste dinero, no a quién llamarle — que es lo único que sirve.
--
-- Mercado Pago SÍ manda con quién fue el cargo, solo que en campos que no se
-- estaban guardando: el pagador, el nombre del titular, los últimos 4 de la
-- tarjeta y la descripción del cobro (que en las domiciliaciones creadas desde
-- el CRM es literalmente "<plan> · <cuenta del cliente>").

alter table crm_cobros_mp add column if not exists payer_nombre text;
alter table crm_cobros_mp add column if not exists payer_id     text;
alter table crm_cobros_mp add column if not exists tarjeta      text;  -- ej. "master ••••4321"
alter table crm_cobros_mp add column if not exists descripcion  text;
-- Cuándo se fue a Mercado Pago a rellenar todo esto (para no repetir barridos).
alter table crm_cobros_mp add column if not exists enriquecido_at timestamptz;
