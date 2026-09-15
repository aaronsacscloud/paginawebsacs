-- Qué se quiere ver en el video de entrega, dicho DESDE EL PASO 1.
--
-- El video de entrega ya era obligatorio para cerrar una orden, pero nadie
-- decía qué tenía que enseñar. Desarrollo grababa lo que le parecía y en la
-- revisión se caía por «falta_video» o «no resuelve»: el video existía, pero
-- no mostraba lo que el cliente iba a preguntar.
--
-- Esto lo pide quien levanta la orden, junto con el criterio de aceptación: es
-- la misma pregunta vista desde la cámara. Se llena en el paso 1, se lee en el
-- paso 2 al grabar, y en el paso 3 se compara contra lo que llegó.
alter table taller_ordenes add column if not exists video_pide text;
comment on column taller_ordenes.video_pide is
  'Qué tiene que mostrar el video de entrega. Lo escribe quien levanta la orden en el paso 1; desarrollo lo lee al grabar y el dueño lo usa para revisar.';
