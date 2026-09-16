-- Dos correcciones de una sola cuenta, de las que ningún patrón atrapa.
--
-- El giro de una cuenta del barrido es el TÉRMINO CON EL QUE SE BUSCÓ, no algo
-- que Google confirme. Casi siempre acierta; cuando no, el error es de a una
-- y se arregla a mano. Buscar un patrón para dos renglones es cómo se acaba
-- borrando «Bordados Levi's».

-- Una tienda de mascotas que cayó en trajes de baño. Fuera: no es moda.
update abm_cuentas set etapa = 'no_contactar',
  nota = coalesce(nota || ' · ', '') || 'Tienda de mascotas: no es un negocio de moda.'
where nombre = 'Pet N''Go Polanco' and etapa is distinct from 'no_contactar';

-- Uniformes clasificado como jeans. Sí es moda, pero su cadencia es la de
-- scrubs y uniformes, que habla de bordado, tallas y pedido por escuela o
-- clínica. Con la de mezclilla le llegaría un correo sobre cortes y lavados.
update abm_cuentas set giro = 'scrubs',
  nota = coalesce(nota || ' · ', '') || 'Reclasificado de jeans a scrubs: vende uniformes, no mezclilla.'
where nombre = 'CODIGO UNIFORMES' and giro = 'jeans';

select (select etapa from abm_cuentas where nombre = 'Pet N''Go Polanco') pet,
       (select giro from abm_cuentas where nombre = 'CODIGO UNIFORMES') uniformes;
