-- DEMAND ENGINE · los competidores ESPECIALIZADOS EN MODA.
--
-- Corrección de método, señalada por el dueño: las primeras preguntas las hice
-- como compraría cualquiera —«mejor software para tienda de ropa»— y salieron
-- los genéricos. Pero Sacs no compite contra un punto de venta genérico: compite
-- contra quien también habla de tallas, numeración y corridas. Esos son los que
-- de verdad se pelean el mismo cliente.
--
-- El más claro es Sizes and Colors, mexicano y explícitamente para zapaterías y
-- boutiques. No lo había encontrado porque lo busqué en singular
-- («sizeandcolors») y el dominio es en plural.
--
-- HALLAZGO QUE VALE MÁS QUE LA LISTA: al preguntar por software ESPECIALIZADO
-- en moda, las IAs siguen contestando con genéricos (Syska, Multicomercio,
-- SICAR, Loggro). Ni siquiera Sizes and Colors domina esa respuesta. O sea que
-- la categoría «software hecho para moda» está VACANTE en las respuestas de IA:
-- nadie la ha ganado todavía. Eso es exactamente el hueco por donde entrar.
insert into de_competidores (nombre, dominio, tipo, categorias, mercados, descubierto_por, notas) values
  ('Sizes and Colors', 'sizesandcolors.com', 'herramienta_nicho',
   array['punto_de_venta','tallas','colores','inventario','zapateria'], array['MX'], 'dueno',
   'El competidor directo: mexicano y explícitamente para zapaterías y boutiques, con tallas y numeración. Lo señaló el dueño.'),
  ('Adiasoft',  'adiasoft.com',  'regional', array['contabilidad','inventario','punto_de_venta'], array['MX','LATAM'], 'ia:gemini', 'Sale al preguntar por software específico de moda'),
  ('Regtrix',   'regtrix.com',   'regional', array['punto_de_venta','tallas'], array['MX'], 'ia:gemini', 'Sale en «matriz de talla y color»'),
  ('Zentivy',   'zentivy.com',   'regional', array['inventario','punto_de_venta'], array['LATAM'], 'ia:gemini', 'Colombiano'),
  ('ComparaSoftware', 'comparasoftware.com', 'marketplace', array['comparativa'], array['MX','LATAM'], 'ia:gemini',
   'NO es competidor: es el comparador que las IAs citan al recomendar. Objetivo de presencia en terceros.')
on conflict (dominio) do nothing;

select count(*) total from de_competidores;
