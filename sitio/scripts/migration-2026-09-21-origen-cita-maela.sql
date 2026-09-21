-- LA CITA DE MAELA SPORT: el origen, corregido en el dato y no sólo en la vista.
--
-- Decisión del dueño (21-sep-2026), tras ver que la pantalla ya la atribuía
-- bien por evidencia: «sí, adelante».
--
-- QUÉ PASÓ. La demo del lunes 21 con Manuela Vidal (Maela Sport) salió de una
-- llamada de 19 min 22 s hecha desde la cabina. Pero la minuta de esa llamada
-- falló —la respuesta del modelo reventó al parsearse—, así que el cierre con
-- IA no llegó a agendar nada y la cita se creó A MANO desde la página pública.
-- Por eso quedó con `origen = 'publico'`: el dato es literalmente cierto (se
-- agendó por ahí) y a la vez cuenta mal la historia (salió de llamar).
--
-- POR QUÉ SÍ SE TOCA. `bookings.origen` no es una bitácora de por qué formulario
-- entró: es de dónde vino el negocio. De él comen el informe de telefonía
-- (`citas` = las que nacieron de una llamada), la conversión por canal y el
-- reporte de campañas. Dejarlo en «publico» le resta a la telefonía una cita
-- que sí produjo, y se la regala a la web.
--
-- POR QUÉ NO SE ARREGLA «TODO LO PARECIDO» DE UNA VEZ: porque la evidencia aquí
-- es concreta —hay una llamada de 19 minutos con esa persona, terminada dos
-- días antes de que se creara la cita— y no un patrón que se pueda generalizar
-- sin mirar caso por caso. La pantalla ya hace esa lectura sola, con su
-- etiqueta «agendada a mano»; esto es sólo poner el dato de acuerdo.

-- Antes.
select id, invitee_nombre, fecha, origen, created_at
from bookings where id = 'f70a1fb5-c875-4f1c-b744-1964d065a0cf';

-- El cambio. WHERE por id, como manda la casa, y con la condición del valor
-- viejo para que correrlo dos veces no pise una corrección posterior.
update bookings
set origen = 'llamada', updated_at = now()
where id = 'f70a1fb5-c875-4f1c-b744-1964d065a0cf'
  and origen = 'publico'
  -- El candado que hace esto seguro: sólo si de verdad hubo una conversación
  -- con esa persona ANTES de que la cita existiera.
  and exists (
    select 1 from tel_sesion_items i
    where i.contact_id = bookings.contact_id
      and i.en_linea_at is not null
      and i.duracion_seg > 20
      and i.en_linea_at < bookings.created_at
  );

-- Después.
select id, invitee_nombre, fecha, origen, updated_at
from bookings where id = 'f70a1fb5-c875-4f1c-b744-1964d065a0cf';
