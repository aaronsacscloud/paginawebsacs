-- El resumen que lee desarrollo, y la prioridad «urgente».
--
-- El paso 1 de una orden se escribe para que quede constancia de lo que se
-- acordó con el cliente: en OT-0013 son 1,900 caracteres. Nadie lee eso antes
-- de programar. El resumen se genera del paso 1, se puede editar y NO
-- reemplaza el original —lo que se acordó se queda en las palabras de quien
-- lo acordó—.
alter table taller_ordenes add column if not exists resumen text;
comment on column taller_ordenes.resumen is
  'Resumen del paso 1 para desarrollo. Se genera de problema/esperado/pasos/criterios y se puede editar. Nunca reemplaza esos campos.';

-- `prioridad` es texto libre sin restricción, así que «urgente» entra sin
-- migrar nada. Lo que sí se migra es el vocabulario: «media» no significaba
-- nada —nadie programa por lo que «estorba»— y se convierte en «baja».
comment on column taller_ordenes.prioridad is
  'baja | alta | urgente. Urgente es lo que no deja vender hoy.';
update taller_ordenes set prioridad = 'baja' where prioridad = 'media';
