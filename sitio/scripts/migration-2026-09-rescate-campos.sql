-- La propuesta de rescate, completa — 17-sep-2026
--
-- Cinco cosas que pidió el dueño y una sexta que llegó detrás:
--   1. personalizar el tiempo gratis (ya se podía por fecha: sólo faltaba en la
--      pantalla, que tenía tres botones fijos),
--   2. agregar más puntos a los que nos comprometemos,
--   3. comentarios,
--   4. a qué se compromete el CLIENTE,
--   5. el valor de lo que normalmente cuesta, con fecha y monto de lo que
--      pagaría si sigue después del período,
--   6. «y también agrega otras cosas que NO están incluidas y que sí tienen un
--      costo extra de la plataforma: son los tokens y la IA».
--
-- La 6 es la que más me importa de las seis. Escribir sólo lo incluido es lo
-- que hace que el primer recibo con consumo de IA se sienta a traición — y a
-- esta gente, que ya se fue una vez por sentirse mal atendida, una sorpresa en
-- el primer cobro la vuelve a perder y esta vez para siempre. Un acuerdo formal
-- dice las dos cosas: lo que entra y lo que se paga aparte.
--
-- La 5 es la que más vende: el número tachado al lado del cero es lo que hace
-- visible el tamaño del gesto. Pero obliga a que la fecha y el monto de
-- renovación queden escritos sin letra chica, que es lo contrario de un truco.

alter table quotes add column if not exists rescate_valor_normal      numeric;
alter table quotes add column if not exists rescate_no_incluido       jsonb;
alter table quotes add column if not exists rescate_cliente_compromisos jsonb;
alter table quotes add column if not exists rescate_comentarios       text;

comment on column quotes.rescate_valor_normal is 'Lo que costaría normalmente todo lo que se le está dando. Sirve para enseñar el tamaño del gesto al lado del cero.';
comment on column quotes.rescate_no_incluido is 'Lo que NO entra y se cobra aparte (tokens, IA…). Escribirlo evita que el primer recibo se sienta a traición.';
comment on column quotes.rescate_cliente_compromisos is 'A qué se compromete ÉL. Un acuerdo con obligaciones de un solo lado no es un acuerdo.';
comment on column quotes.rescate_comentarios is 'Lo que el dueño quiera añadir para ESTE caso, fuera de las listas.';
