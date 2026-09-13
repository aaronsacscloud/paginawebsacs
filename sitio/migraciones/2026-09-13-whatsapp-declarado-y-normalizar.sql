-- Un enlace wa.me en la ficha del negocio ES un WhatsApp declarado.
--
-- Dos arreglos de la misma revisión.
--
-- 1) EL CANAL GUARDABA LA URL, NO EL NÚMERO.
--    Convivían `https://wa.me/525525301345` y `525593027234` como valores del
--    mismo tipo de canal. Eso rompía tres cosas en silencio:
--      · el dedupe —el mismo número en las dos formas son dos canales—,
--      · el cruce con abm_fuentes, que guarda `+52 55 2530 1345` con espacios
--        (por eso 1,703 canales PARECÍAN no tener procedencia: la tenían, y mi
--        consulta cruzaba por valor exacto, así que nunca empataba),
--      · y cualquier envío por API, que necesita dígitos.
--
-- 2) SI EL NEGOCIO PUBLICÓ UN ENLACE wa.me, NO HAY QUE VALIDAR NADA.
--    1,503 de estos canales son enlaces que el propio negocio puso en su ficha
--    de Google Maps o en su sitio. Es la misma certeza que raspar el wa.me de
--    su web: él dijo "escríbeme por WhatsApp aquí". Gastar una consulta de
--    Twilio Lookup en ellos es tirar dinero, y dejarlos en `sin_probar` los
--    sacaba de la lista de contactables sin razón.
--    Los que sí necesitan Lookup son los INFERIDOS del teléfono: ahí nadie
--    declaró nada, lo supusimos nosotros.
--
-- EL ORDEN IMPORTA: hay una restricción única (cuenta_id, tipo, lower(valor)).
-- Si se normaliza primero, las filas que quedan iguales chocan y la migración
-- entera se cae. Primero se quitan las que van a colisionar, luego se normaliza.

-- a) Guardar la forma original por si un enlace traía algo más que el número.
insert into abm_fuentes (cuenta_id, campo, valor, metodo, confianza, agente)
select cuenta_id, 'whatsapp_enlace', valor, 'google_maps', 'alta', 'normalizacion'
  from abm_canales
 where tipo like 'whatsapp%' and (valor ilike '%wa.me%' or valor ilike '%whatsapp.com%');

-- b) Marcar DECLARADO mientras el valor todavía se ve que venía de un enlace.
--    Un invalido/opt_out confirmado manda sobre lo declarado y no se toca.
update abm_canales set estado = 'declarado', confianza = 'alta',
       verificado_at = coalesce(verificado_at, now())
 where tipo like 'whatsapp%'
   and (valor ilike '%wa.me%' or valor ilike '%whatsapp.com%')
   and estado not in ('invalido', 'opt_out');

-- c) Quitar las que colisionarían al normalizar. Se conserva la de mejor estado
--    (valido > declarado > probable > el resto) y, a igualdad, la más vieja.
with norm as (
  select id, cuenta_id, tipo, estado, created_at,
         coalesce(regexp_replace(substring(valor from '[0-9]{10,13}'), '\D','','g'), valor) as num
    from abm_canales where tipo like 'whatsapp%'),
 rank as (
  select id, row_number() over (
      partition by cuenta_id, tipo, num
      order by case estado when 'valido' then 0 when 'declarado' then 1 when 'probable' then 2 else 3 end,
               created_at) as n
    from norm where num is not null)
delete from abm_canales where id in (select id from rank where n > 1);

-- d) Y ahora sí, a dígitos.
update abm_canales set valor = regexp_replace(substring(valor from '[0-9]{10,13}'), '\D', '', 'g')
 where tipo like 'whatsapp%' and valor !~ '^[0-9]+$'
   and substring(valor from '[0-9]{10,13}') is not null;
