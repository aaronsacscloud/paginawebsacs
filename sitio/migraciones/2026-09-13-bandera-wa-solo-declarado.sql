-- `tiene_wa` tiene que significar "se le puede escribir por WhatsApp".
--
-- Al cerrar la regla a solo-declarados, 710 cuentas quedaron con la bandera en
-- true sin tener un canal declarado. Esa bandera no es cosmética: alimenta la
-- accesibilidad del puntaje (abm.lib.ts, tiene_wa ? 8 : 0), el filtro "con
-- WhatsApp" de la pantalla y el orden de la cola. Con la bandera mintiendo, 710
-- cuentas puntúan +8 por un canal que no existe y se cuelan arriba de la fila
-- por encima de cuentas que sí se pueden trabajar.
--
-- Es la segunda vez hoy que este trigger cuenta canales que no sirven: la
-- primera fue con correos invalidados. La regla de fondo es la misma — la
-- bandera cuenta lo CONTACTABLE, no lo que existe en la tabla.
create or replace function public.abm_recontar_canales()
 returns trigger language plpgsql as $function$
declare cid uuid;
begin
  cid := coalesce(new.cuenta_id, old.cuenta_id);
  update abm_cuentas c set
    tiene_email = exists (select 1 from abm_canales x where x.cuenta_id=cid
                            and x.tipo like 'email%' and x.estado not in ('invalido','rebote')),
    -- WhatsApp solo cuenta si el negocio lo declaró o si ya se le entregó uno.
    tiene_wa    = exists (select 1 from abm_canales x where x.cuenta_id=cid
                            and x.tipo like 'whatsapp%' and x.estado in ('declarado','valido')),
    canales_n   = (select count(*) from abm_canales x where x.cuenta_id=cid
                            and x.estado not in ('invalido','rebote','no_declarado'))
  where c.id = cid;
  return null;
end $function$;

update abm_cuentas c set
  tiene_email = exists (select 1 from abm_canales x where x.cuenta_id=c.id
                          and x.tipo like 'email%' and x.estado not in ('invalido','rebote')),
  tiene_wa    = exists (select 1 from abm_canales x where x.cuenta_id=c.id
                          and x.tipo like 'whatsapp%' and x.estado in ('declarado','valido')),
  canales_n   = (select count(*) from abm_canales x where x.cuenta_id=c.id
                          and x.estado not in ('invalido','rebote','no_declarado'));
