-- LLAMADAS · cuánto tardas en contestarle al «bueno».
--
-- Por qué una columna y no una cuenta al vuelo: el dato SÍ se puede sacar de
-- `oido` —el primer trozo del contacto contra el primero del vendedor— pero eso
-- obliga a leer el `oido` entero de toda la jornada (194 trozos en una llamada
-- de 19 minutos, por 113 llamadas) cada vez que alguien abre el resumen. Se
-- calcula UNA vez, al cerrar la llamada, y se guarda.
--
-- Se mide contra el primer trozo DEL CONTACTO, no contra el descuelgue, a
-- propósito: la transcripción en vivo tarda un par de segundos en entregar cada
-- frase, y ese retraso lo llevan las dos pistas por igual. Restándolas se va, y
-- queda lo que de verdad importa: desde que dijo «bueno» hasta que te oyó.
--
-- Medido antes de existir esta columna, sobre las 27 llamadas que dejaron las
-- dos voces: 7.0 s de media. Y las peores ni salen en ese promedio — las que
-- murieron a los cuatro segundos no tienen ni una palabra nuestra.
alter table tel_sesion_items add column if not exists saludo_ms integer;

comment on column tel_sesion_items.saludo_ms is
  'Milisegundos entre la primera palabra del contacto y la primera del vendedor. NULL si falta alguna de las dos.';

-- Relleno de lo que ya está grabado, para tener contra qué comparar desde el
-- primer día. `v > c` descarta las llamadas donde el vendedor ya venía hablando
-- cuando el otro descolgó: ahí no hubo espera, y un negativo ensuciaría la media.
update tel_sesion_items i set saludo_ms = x.v - x.c
from (
  select id,
    (select (o->>'t')::int from jsonb_array_elements(oido) o
      where o->>'quien' = 'vendedor' and length(o->>'texto') > 1
      order by (o->>'t')::int limit 1) as v,
    (select (o->>'t')::int from jsonb_array_elements(oido) o
      where coalesce(o->>'quien', 'contacto') = 'contacto' and length(o->>'texto') > 1
      order by (o->>'t')::int limit 1) as c
  from tel_sesion_items
  where en_linea_at is not null and jsonb_typeof(oido) = 'array'
) x
where i.id = x.id and x.v is not null and x.c is not null and x.v > x.c and i.saludo_ms is null;
