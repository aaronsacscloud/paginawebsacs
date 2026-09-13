-- COT-80129 de Vende Tu Closet: amarrar su partida al concepto de Consultoría.
--
-- La cotización se escribió antes de que Consultoría existiera en el catálogo,
-- así que su única partida es texto libre: «Implementación 1 a 1», $98,900. La
-- heurística la lee como «servicio» y le aplica el 35% de la categoría, pero el
-- alcance que firmó el cliente es consultoría de 4 semanas —revisión de
-- procesos con Consultoría y Desarrollo, migración, configuración, capacitación
-- presencial y acompañamiento al cierre—, y esa tarifa es del 74%.
--
-- El NOMBRE no se toca: es lo que el cliente ya vio y firmó en el documento.
-- Lo único que se agrega es `plan_slug`, que nadie le enseña al cliente y que
-- es lo que el motor de comisiones lee para elegir la tarifa.
--
-- Efecto medido sobre los $49,450 ya cobrados: la comisión del consultor pasa
-- de $17,308 (35%) a $36,593 (74%). Al liquidar los $114,724 serán $73,186.
update quotes
set items = jsonb_set(items, '{0}', (items -> 0) || '{"plan_slug":"servicio_consultoria"}'::jsonb)
where numero = 'COT-80129'
  and items -> 0 ->> 'nombre' = 'Implementación 1 a 1'
  and items -> 0 ->> 'plan_slug' is null;
