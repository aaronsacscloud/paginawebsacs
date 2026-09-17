-- Preguntas de desarrollo sobre una orden del taller.
--
-- Por qué. El paso 2 le da a desarrollo el encargo y el video, pero no tenía
-- dónde preguntar: lo que no se entiende del video se pregunta por WhatsApp y
-- se pierde, o la orden rebota por «mal entendida» sin que nadie supiera que
-- había una duda. Ahora la duda vive PEGADA a su folio y le llega al dueño de
-- la cuenta a su bandeja.
--
-- Se reusa `taller_comentarios` en vez de crear una tabla: es exactamente el
-- mismo objeto —alguien escribe algo en una orden— y partirlo en dos obligaría
-- a unir dos hilos para leer una conversación.
--
--   tipo         nota | pregunta | respuesta
--   responde_a   la pregunta que contesta (solo en las respuestas)
--   resuelta_at  cuándo se contestó (solo en las preguntas). NULL = abierta,
--                y eso es justo lo que sale en la bandeja.

alter table taller_comentarios
  add column if not exists tipo        text not null default 'nota',
  add column if not exists responde_a  uuid references taller_comentarios(id) on delete set null,
  add column if not exists resuelta_at timestamptz;

alter table taller_comentarios drop constraint if exists taller_comentarios_tipo_chk;
alter table taller_comentarios add constraint taller_comentarios_tipo_chk
  check (tipo in ('nota', 'pregunta', 'respuesta'));

-- El índice es parcial a propósito: la bandeja solo pregunta por las abiertas,
-- y esas son siempre pocas al lado del histórico.
create index if not exists taller_comentarios_abiertas
  on taller_comentarios (at desc)
  where tipo = 'pregunta' and resuelta_at is null;
