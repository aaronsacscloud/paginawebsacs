-- El recuento de canales ignoraba el ESTADO del canal.
--
-- El trigger ponía tiene_email = true con que existiera una fila tipo email%,
-- aunque estuviera marcada 'invalido' o 'rebote'. Consecuencias medidas hoy:
--
--  · Las dos cuentas cuyo correo invalidé (team@latofonts.com de Estrómboli y
--    el inexistente mivestido@tiscaeno.mx de Tiscareno) SEGUÍAN contando como
--    alcanzables por correo.
--  · La accesibilidad del puntaje se calcula con esta bandera
--    (abm.lib.ts: tiene_email ? 12 : 0), así que esas cuentas puntúan +12 por
--    un canal muerto y se cuelan arriba de la cola por encima de cuentas que
--    sí se pueden contactar.
--  · El filtro "con correo" de la pantalla las muestra, pero generar la
--    cadencia falla con 409: el generador sí mira el estado. La pantalla y el
--    motor daban respuestas distintas sobre la misma cuenta.
--
-- Se arregla en el trigger, no en cada llamada: son 21,107 cuentas y la
-- bandera la leen la cola, el tablero, los filtros y el puntaje.
create or replace function public.abm_recontar_canales()
 returns trigger language plpgsql as $function$
declare cid uuid;
begin
  cid := coalesce(new.cuenta_id, old.cuenta_id);
  update abm_cuentas c set
    -- Un canal quemado no es un canal: invalido/rebote no cuentan.
    tiene_email = exists (select 1 from abm_canales x where x.cuenta_id=cid
                            and x.tipo like 'email%' and x.estado not in ('invalido','rebote')),
    tiene_wa    = exists (select 1 from abm_canales x where x.cuenta_id=cid
                            and x.tipo like 'whatsapp%' and x.estado not in ('invalido','rebote')),
    canales_n   = (select count(*) from abm_canales x where x.cuenta_id=cid
                            and x.estado not in ('invalido','rebote'))
  where c.id = cid;
  return null;
end $function$;

-- Y el rezago acumulado: filas metidas antes de que el trigger existiera, más
-- todo lo que se invalidó desde entonces. De una vez para las 21,107.
update abm_cuentas c set
  tiene_email = exists (select 1 from abm_canales x where x.cuenta_id=c.id
                          and x.tipo like 'email%' and x.estado not in ('invalido','rebote')),
  tiene_wa    = exists (select 1 from abm_canales x where x.cuenta_id=c.id
                          and x.tipo like 'whatsapp%' and x.estado not in ('invalido','rebote')),
  canales_n   = (select count(*) from abm_canales x where x.cuenta_id=c.id
                          and x.estado not in ('invalido','rebote'));
