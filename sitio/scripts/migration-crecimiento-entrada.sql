-- 13-sep-2026 · La cadencia de clientes no enrolaba a NADIE.
--
-- Su regla de entrada exigía «actividad de venta en los últimos 15 días», copiada
-- de una secuencia de leads. Pero ese campo mide la actividad del EQUIPO DE VENTAS
-- con el lead, y cuando alguien se vuelve cliente esa actividad se acaba: de 115
-- clientes elegibles, 0 la cumplían (76 entre 15 y 90 días, 34 arriba de 90, 16
-- nunca). La cadencia habría arrancado el lunes y no habría pasado nada — el peor
-- fallo posible, porque nadie se entera.
--
-- Entrada correcta para clientes: estar en etapa cliente. El resto de los candados
-- (uno por día, se aparta si una persona toma la conversación, se detiene el canal
-- por el que responden) siguen igual.
update crm_secuencias
set entrada = jsonb_set(entrada - 'filtros', '{para_clientes}', 'true'::jsonb)
where nombre like 'Crecimiento%';
