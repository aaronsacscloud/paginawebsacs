-- LLAMADAS · lo que convierte un archivo de audio en material de entrenamiento.
--
-- Pedido del dueño (20-sep-2026): va a grabar muchas más llamadas para entrenar
-- el modelo de voz y el guion. Hoy hay 36 grabaciones y como corpus casi no
-- sirven: el resultado guardado dice «contestó» en 27 de ellas — eso cuenta que
-- alguien levantó el teléfono, no qué pasó. Sin saber cuáles acabaron en demo y
-- cuáles en «no me interesa», el audio no enseña nada.
--
-- Tres columnas, una por cada cosa que faltaba:
alter table wa_llamadas add column if not exists desenlace text;
alter table wa_llamadas add column if not exists ejemplo boolean not null default false;
alter table wa_llamadas add column if not exists objeciones jsonb;

comment on column wa_llamadas.desenlace is
  'En qué acabó DE VERDAD: agendo_demo, agendo_llamada, dio_datos, no_interesa, volver_llamar, hablamos, buzon, sin_contacto. Lo escribe el cierre.';
comment on column wa_llamadas.ejemplo is
  'Marcada a mano como buena: material de entrenamiento curado por una persona.';
comment on column wa_llamadas.objeciones is
  'Lo que puso el cliente y cómo se respondió: [{objecion, respuesta, funciono}]. Lo saca el cierre con IA.';

-- Se busca por desenlace y por ejemplo cada vez que se abre la pantalla de
-- grabaciones; sin índice son dos escaneos de tabla por carga.
create index if not exists idx_llamadas_desenlace on wa_llamadas (desenlace) where grabacion_path is not null;
create index if not exists idx_llamadas_ejemplo on wa_llamadas (ejemplo) where ejemplo;
