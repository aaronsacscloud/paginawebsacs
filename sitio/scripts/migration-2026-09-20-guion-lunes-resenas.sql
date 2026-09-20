-- JUNTA DE LOS LUNES · bloque de reseñas (Google y Capterra).
--
-- Pedido del dueño (20-sep-2026): «en las reuniones que tengo con Andy cada
-- lunes, agregar el avance en recomendaciones de Google y Capterra, ya que el
-- objetivo es lograr 3 a la semana, lo cual nos permitirá posicionarnos en
-- ambas plataformas; pidiéndole igual a los clientes que ya han publicado en
-- Google que lo hagan en las otras plataformas, y que hablen de los temas de
-- fashion retail».
--
-- Va en BLOQUE PROPIO y no como un punto dentro de «Cuentas actuales», por la
-- misma razón que se hicieron bloques propios Leads VIP y Renovaciones: un
-- punto escondido al final de otro bloque es lo primero que se omite cuando la
-- junta va tarde. Un bloque con minutos, no.
--
-- Y va en el TERCER lugar —justo después de Cuentas actuales, antes de
-- renovaciones y demos— a propósito: son los mismos clientes de los que Andrea
-- acaba de hablar. Pedir la reseña es una frase más en una conversación que ya
-- está teniendo, no una tarea aparte.
--
-- Pasa de 10 a 11 bloques (el contrato de `POST /api/crm/espacio/sala` permite
-- hasta 12) y de 61 a 66 minutos.
--
-- Idempotente: si ya existe un bloque de reseñas, no hace nada.

update espacio_canales
set guion = jsonb_insert(guion, '{2}', '{
  "quien": "Andrea",
  "bloque": "Reseñas: Google y Capterra",
  "minutos": 5,
  "puntos": [
    {
      "t": "Cuántas reseñas nuevas salieron esta semana, por plataforma. La meta son 3 por semana entre Google y Capterra.",
      "fuente": "Cuentas → Clientes"
    },
    "Quién las publicó y quién dijo que sí y no lo hizo — con nombre y cuenta, no un número suelto.",
    {
      "t": "Clientes que YA reseñaron en Google: a cuáles se les pidió la de Capterra y cuántos la publicaron.",
      "fuente": "Cuentas → Clientes"
    },
    "A quién se le pide esta semana: 5 nombres con fecha, salidos de las cuentas más contentas.",
    "Si las reseñas hablan de moda —tallas y colores, temporadas, sucursales— o se quedaron en «buen sistema».",
    "Qué hace falta para que pedirla sea parte del trabajo de la semana y no un favor que se pide al final."
  ]
}'::jsonb)
where id = 'f6bae953-b3b2-463c-89bb-d46ea5d645b6'      -- canal lunes-semanal
  and not exists (
    select 1 from jsonb_array_elements(guion) b
    where b->>'bloque' ilike '%rese%'
  );

-- Comprobación: 11 bloques y el de reseñas en tercer lugar.
select jsonb_array_length(guion) as bloques,
       guion->2->>'bloque' as tercero,
       (select sum((b->>'minutos')::int) from jsonb_array_elements(guion) b) as minutos
from espacio_canales where id = 'f6bae953-b3b2-463c-89bb-d46ea5d645b6';
