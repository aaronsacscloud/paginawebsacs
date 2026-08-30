-- Un tipo de reunión para los clientes que se fueron.
--
-- POR QUÉ UNO PROPIO, y por qué se llama así
-- «Conversación con dirección» dice quién va a estar del otro lado, que es lo
-- único que hace distinta a esta reunión. A alguien que ya se fue no lo mueve
-- que le ofrezcan una consultoría más: lo mueve que quien manda quiera
-- escucharlo. Si el nombre no lo dice, la propuesta es la misma de siempre.
--
-- 30 minutos y no 45: se pide para ESCUCHAR, no para presentar. Pedir una hora
-- a quien ya decidió irse es pedir demasiado, y además manda el mensaje
-- equivocado sobre cuánto vamos a hablar nosotros.
--
-- `requiere_minuta` en true importa más aquí que en ninguna otra: lo que se
-- diga en estas reuniones es la única fuente honesta que tenemos de por qué se
-- van los clientes. Si no queda escrito, se pierde.
begin;

insert into event_types (nombre, slug, descripcion, duracion_minutos, categoria,
                         buffer_despues_minutos, aviso_minimo_horas, max_dias_adelanto,
                         tipo_reunion, ubicacion_tipo, color, owner_id, activo, requiere_minuta)
select 'Conversación con dirección', 'direccion',
       'Media hora para que nos cuentes qué pasó. No es una junta de ventas ni '
       'una demo: es la dirección de Sacs queriendo entender qué falló, sin '
       'pedirte nada a cambio.',
       30, 'consultoria',
       e.buffer_despues_minutos, e.aviso_minimo_horas, e.max_dias_adelanto,
       e.tipo_reunion, e.ubicacion_tipo, '#B4413A', e.owner_id, true, true
from event_types e
where e.slug = 'consultoria'
  and not exists (select 1 from event_types x where x.slug = 'direccion');

commit;
