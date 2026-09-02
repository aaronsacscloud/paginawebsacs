-- Ajustar el % de UNA linea, solo por esta vez.
--
-- Ya se podia corregir un corte con un ajuste (un abono o un cargo suelto),
-- pero eso miente sobre lo que paso: el renglon sigue diciendo 35% y aparte
-- cuelga un abono sin relacion visible. Cuando el consultor pregunta "¿por que
-- este cliente pago distinto?", la respuesta no esta en el documento.
--
-- Con `pct_manual` la excepcion vive DONDE OCURRIO. El renglon dice el % que
-- de verdad se cobro, la nota dice por que, y la suma cuadra sola.
--
-- Es por LINEA y no por regla a proposito: cambiar la regla cambiaria el futuro
-- de todos los clientes de ese origen; esto cambia un cobro concreto y nada mas.
--
-- Lo dificil no es guardarlo: es que SOBREVIVA. El recalculo de cada madrugada
-- reescribe la linea completa, asi que sin arrastrarlo explicitamente el ajuste
-- de la tarde desaparecia de noche y el lunes se pagaba el numero viejo.
alter table comision_lineas add column if not exists pct_manual numeric;
alter table comision_lineas add column if not exists pct_manual_nota text;
alter table comision_lineas add column if not exists pct_manual_at timestamptz;

comment on column comision_lineas.pct_manual is
  'Porcentaje puesto a mano para ESTA linea. Nulo = manda la tarifa configurada.';
