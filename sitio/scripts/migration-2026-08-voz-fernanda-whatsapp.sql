-- El paso 2 de «Seguimiento a leads sin respuesta» pasa a la voz de Fernanda.
--
-- Era el último que quedaba diciendo «soy Andrea, tu consultora». La decisión
-- fue separar las voces: en WhatsApp escribe Fernanda, y el nombre de Andrea
-- aparece cuando la conversación sube de nivel —la sesión consultiva—, no en el
-- primer mensaje de una cadencia. Nombrarla en los dos lugares le quita peso
-- justo donde vale.
--
-- Meta no deja editar el cuerpo de una plantilla aprobada, así que esto no se
-- pudo corregir: hubo que dar de alta `cadencia_equipo_moda` y esperar su
-- aprobación. Ya está APPROVED, así que el paso se puede mover sin dejarlo mudo.
begin;
update crm_secuencia_pasos
   set wa_plantilla = 'cadencia_equipo_moda'
 where wa_plantilla = 'cadencia_consultora_moda' and activo;
commit;
