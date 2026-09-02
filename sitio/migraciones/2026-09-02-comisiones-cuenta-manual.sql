-- Corregir A DONDE entro el pago, renglon por renglon.
--
-- La comision no se calcula sobre lo que pago el cliente sino sobre lo que
-- QUEDA despues del costo de recibirlo: 16% de IVA si entro a la corporativa,
-- 6% de dispersion si entro a la pagadora. El dato salia de
-- `payments.comision_cuenta`, y si al capturar el pago alguien marco la cuenta
-- equivocada, la unica salida era corregir el pago y recalcular — o taparlo con
-- un ajuste suelto que no explica nada.
--
-- Sobre $7,000, equivocarse de cuenta mueve la base $700 y la comision ~$245 en
-- UN renglon. No es un detalle cosmetico.
--
-- Igual que `pct_manual`, lo dificil es que SOBREVIVA al recalculo de la
-- madrugada, que sabe calcular este campo y calcularia el valor viejo.
alter table comision_lineas add column if not exists cuenta_manual text;

alter table comision_lineas drop constraint if exists comision_lineas_cuenta_manual_ck;
alter table comision_lineas add constraint comision_lineas_cuenta_manual_ck
  check (cuenta_manual is null or cuenta_manual in ('corporativa','pagadora','ninguna'));

comment on column comision_lineas.cuenta_manual is
  'Cuenta corregida a mano para ESTA linea. Nulo = la que trae el pago.';
