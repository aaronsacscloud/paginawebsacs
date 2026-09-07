-- ═══ Imágenes y archivos en los puntos de agenda y en los acuerdos ════════
--
-- Pedido del dueño (7-sep-2026): "también poner imágenes o cosas".
--
-- POR QUÉ HACE FALTA
-- Los MENSAJES del chat ya cargan adjuntos (`espacio_mensajes.adjuntos`, jsonb):
-- imágenes al bucket privado `espacio`, audios con su transcripción, GIFs. Los
-- puntos de agenda no: solo tenían `contexto`, que son REFERENCIAS a mensajes
-- ("este punto salió de tal mensaje"). No es lo mismo. Un punto como "revisar
-- la portada nueva" no podía traer la portada: había que escribirlo en el canal
-- y luego proponerlo desde ahí, y aun así el punto solo guardaba un apuntador.
--
-- Misma historia con los acuerdos: "mandar el comparativo" no podía llevar el
-- comparativo, y el acta terminaba mandando a buscar el archivo en el chat.
--
-- MISMA FORMA QUE LOS MENSAJES, A PROPÓSITO
-- La columna es jsonb con la MISMA estructura de `espacio_mensajes.adjuntos`,
-- así que el validador (`limpiarAdjuntos`), el flujo de subida
-- (POST /api/crm/espacio/subir → URL firmada → el navegador sube directo al
-- bucket) y el componente que los pinta se reutilizan sin tocarlos. Una segunda
-- forma para lo mismo habría significado un segundo validador que mantener y
-- una segunda manera de que se cuele un adjunto sin revisar.

alter table espacio_reunion_puntos
  add column if not exists adjuntos jsonb not null default '[]'::jsonb;

alter table espacio_acuerdos
  add column if not exists adjuntos jsonb not null default '[]'::jsonb;

-- Reversible:
--   alter table espacio_reunion_puntos drop column adjuntos;
--   alter table espacio_acuerdos drop column adjuntos;
