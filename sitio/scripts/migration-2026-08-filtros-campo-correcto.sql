-- Dos cadencias llevaban un filtro que no filtraba NADA.
--
--   {"campo":"dias_sin_venta","op":"menor_que","valor":15}
--
-- Ni el campo ni el operador existen. El evaluador de filtros tiene
-- `default: return true`, así que la condición pasaba SIEMPRE: «Crecimiento»
-- —que debía hablarle solo a clientes que están operando— habría entrado a
-- todos, incluidos los dormidos, a quienes el primer correo les dice «lo estás
-- usando bien». A alguien que no ha vendido en tres meses eso se lee como burla.
--
-- El campo correcto es `sin_actividad`, que mide días desde
-- `ultima_actividad_venta_at`, y su operador es `hace_menos`.
--
-- Lo encontró el arnés de pruebas al validar la etapa de entrada; leyendo el
-- JSON no se ve, porque un filtro mal escrito se ve idéntico a uno bueno.
begin;

update crm_secuencias
   set entrada = jsonb_set(entrada, '{filtros}',
         '[{"campo":"sin_actividad","op":"hace_menos","valor":"15"}]'::jsonb)
 where id = '11111111-2222-4333-8444-5555555555b1';   -- Crecimiento

update crm_secuencias
   set entrada = jsonb_set(entrada, '{filtros}',
         '[{"campo":"sin_actividad","op":"hace_menos","valor":"30"}]'::jsonb)
 where id = '11111111-2222-4333-8444-5555555555a1';   -- Renovación

commit;
