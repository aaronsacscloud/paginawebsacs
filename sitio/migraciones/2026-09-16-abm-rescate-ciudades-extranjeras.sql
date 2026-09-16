-- 16-sep-2026 · Devolver a la fila las 1,017 cuentas de Latam y España que
-- una limpieza de México sacó por vivir en «una ciudad extranjera».
--
-- QUÉ PASÓ. `2026-09-15-fuera-extranjeros.sql` (de otra sesión, con toda la
-- razón para México) marcó `no_contactar` TODA cuenta cuya ciudad estuviera en
-- una lista de ciudades de fuera —Bogotá, Madrid, Buenos Aires, Lima…—. La
-- intención era sacar del barrido mexicano los negocios que Google coló de
-- otro país: escribirle «el mapa de las mejores casas de novia de México» a
-- una de Bogotá es quedar mal. Correcto. Pero la sentencia no filtró por
-- `pais`, y ese mismo día se habían cargado 3,565 cuentas de novias de once
-- países, donde Bogotá o Madrid no son una fuga: son el objetivo. Se llevó
-- 1,017 por delante, casi un tercio de la base nueva, sin dejar rastro en la
-- bitácora ni en `abm_no_contactar` —por eso no se veía como una baja.
--
-- QUÉ SE DEVUELVE. Solo lo que cumple las tres cosas: es de fuera de México,
-- trae el `pausa_motivo` que pone el cargador por país, y nadie la dio de baja
-- de verdad (sin nota, sin baja, y su correo/WhatsApp no está en la lista de
-- no contactar). Vuelven a `en_pausa`, que es donde estaban: esto repara el
-- accidente, no enciende nada.
--
-- LA GUARDA. La limpieza por ciudad solo tiene sentido dentro de México, así
-- que queda escrita la regla para la próxima: una lista de ciudades NUNCA
-- decide sola, siempre acompañada de `pais = 'México'`. Ver manual §13.
begin;

update abm_cuentas a
   set etapa = 'en_pausa', updated_at = now()
 where a.etapa = 'no_contactar'
   and a.pais <> 'México'
   and a.pausa_motivo like 'Carga por país%'
   and not exists (select 1 from abm_actividad v where v.cuenta_id = a.id and v.tipo in ('nota', 'baja'))
   and not exists (select 1 from abm_canales c join abm_no_contactar n on lower(n.valor) = lower(c.valor) where c.cuenta_id = a.id);

commit;

select pais, count(*) filter (where etapa = 'en_pausa') en_pausa, count(*) filter (where etapa = 'no_contactar') no_contactar, count(*) cuentas
  from abm_cuentas where giro = 'novias' and pais <> 'México' group by 1 order by 4 desc;
