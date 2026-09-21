-- JORNADAS DE LLAMADAS · archivarlas en vez de borrarlas.
--
-- PEDIDO DEL DUEÑO (21-sep-2026), sobre la pestaña de Listas: «elimina todas
-- estas porque eran prueba, ya solo deja la primera que está, esa sí es real».
--
-- POR QUÉ ESTO ARCHIVA Y NO BORRA. Se miró qué hay dentro de cada una antes de
-- tocar nada, y el resultado cambia la respuesta:
--
--   Vista Rezagado · segunda vuelta   110 marcados ·  41 hablaron ·  96 llamadas
--   Vista Nuevo lead (18-sep)           7 marcados ·   2 hablaron ·   7 llamadas
--   Vista Nuevo lead (15-sep)          11 marcados ·   2 hablaron ·  11 llamadas
--   Vista Rezagado                      8 marcados ·   1 habló    ·   8 llamadas
--   Vista Calificado (×3)               4 marcados ·   1 habló    ·   4 llamadas
--   E0 medición (×2)                    2 marcados ·   0 hablaron ·   2 llamadas
--
-- Son ~130 llamadas de verdad. Borrar esas jornadas se lleva por delante sus
-- `tel_sesion_items`, y con ellos: la transcripción en vivo (`oido`), el cierre
-- con IA, la nota de cada llamada y el enganche con `wa_llamadas` —o sea, las
-- grabaciones y las minutas—. En pantalla eso se vería como que las pestañas de
-- Oportunidades (5) y Descalificados (9) se vacían solas, porque leen justo esa
-- tabla. Y el corpus para clonar la voz sale del mismo sitio.
--
-- Lo que el dueño quiere es no verlas. Eso se consigue archivando, y se puede
-- deshacer con un update. Borrar no.
--
-- Cinco sí están de verdad vacías (cero marcados y cero llamadas): ésas se
-- pueden borrar sin perder nada, pero tampoco hace falta — archivadas
-- desaparecen igual, y una sola regla es más fácil de recordar que dos.

alter table tel_sesiones add column if not exists archivada_at timestamptz;

comment on column tel_sesiones.archivada_at is
  'Fuera de la lista de jornadas, sin borrar sus llamadas. Se deshace poniéndola a NULL.';

-- Se archiva todo menos la más reciente, que es la que el dueño dijo que sí es
-- real. `where` explícito por id, no por «todas menos una» calculada al vuelo:
-- una consulta que borra por posición es la que un día archiva la buena.
update tel_sesiones set archivada_at = now(), updated_at = now()
where archivada_at is null
  and id <> 'cebf8300-1450-4688-b760-2db2b15b3e13';   -- Vista Nuevo lead · segunda vuelta (18-sep)

select count(*) filter (where archivada_at is null) as a_la_vista,
       count(*) filter (where archivada_at is not null) as archivadas
from tel_sesiones;
