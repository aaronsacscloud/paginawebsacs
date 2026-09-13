-- 13-sep-2026 · `utm_content` de punta a punta.
--
-- La cadencia de leads manda ocho correos y cada botón lleva su etiqueta
-- (dia1…dia8). Sin esta columna, la etiqueta se pierde al agendar y no hay forma
-- de saber CUÁL de los ocho trae las sesiones — que es justo el dato que permite
-- recortar la cadencia en vez de adivinar. El capturador de atribución ya lo
-- guardaba (`co`); lo que faltaba era dónde escribirlo.
alter table contacts add column if not exists utm_content text;
alter table bookings add column if not exists utm_content text;
create index if not exists idx_bookings_utm_content on bookings (utm_content) where utm_content is not null;
