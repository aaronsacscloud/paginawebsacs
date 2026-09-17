-- ARREGLO · el marcador del propio motor no tenía guardia contra duplicados.
--
-- `de_ia_muestras` es de donde sale el AVS, que es EL número del objetivo:
-- ¿aparece Sacs cuando alguien del ramo le pregunta a una IA? Y no había nada
-- que impidiera guardar dos veces la misma medición.
--
-- Cómo pasaría: `geo.muestrear` mide un prompt, guarda sus cuatro muestras y
-- después marca `medido_at`. Si el worker muere entre lo uno y lo otro —la
-- función de Vercel se corta a los 300 s y esto son cuatro llamadas lentas a
-- IAs—, el prompt sigue apareciendo como el más rancio, se vuelve a medir y las
-- muestras se duplican. El AVS es un promedio: un prompt contado dos veces pesa
-- el doble que los demás, y si la segunda vuelta salió distinta, el número se
-- mueve por un accidente de infraestructura.
--
-- Hoy hay cero duplicados (15 prompts, 60 muestras, ninguna repetida), así que
-- esto entra limpio. Es prevención, no reparación.
--
-- El índice es (prompt_id, plataforma, fecha): una medición por prompt, por
-- plataforma y por día. Volver a medir el mismo día REEMPLAZA en vez de sumar,
-- que es la semántica correcta — la medición buena es la última, no las dos.

create unique index if not exists de_ia_muestras_unica
  on de_ia_muestras (prompt_id, plataforma, fecha);

comment on index de_ia_muestras_unica is
  'Una medición por prompt/plataforma/día. Sin esto, un worker que muere entre guardar y marcar duplica muestras y el AVS —que es un promedio— se mueve por un accidente de infraestructura.';
