-- ═══ Un solo WhatsApp en todo lo que sale ════════════════════════════════
--
-- Revisión completa pedida por el dueño. Se barrieron las 1,731 columnas de
-- texto/json del esquema buscando cualquier número viejo.
--
-- LO QUE NO SE TOCA (y es la mitad del trabajo): 78 apariciones son HISTORIAL
-- —conversaciones que de verdad ocurrieron en la línea anterior, mensajes
-- migrados de Respond, notificaciones ya enviadas, y el propio registro
-- `wa_numeros` que lista las líneas viejas como inactivas—. Reescribir eso
-- sería falsificar lo que pasó. Solo se corrige lo que SE MANDA.
--
-- LO QUE SÍ ESTABA MAL: la plantilla "Bienvenida" —el primer correo que recibe
-- un cliente nuevo— mandaba su pie de "¿Tienes dudas? escríbenos por WhatsApp"
-- a +52 81 8333 1741, un número que ni siquiera está dado de alta en
-- `wa_numeros`. Cada cliente nuevo que le diera clic escribía a un número que
-- nadie mira. Las otras 60 plantillas ya apuntaban bien.
--
-- El vigente sale de `wa_numeros` (activo y es_default): +52 1 55 9302 7234.
update email_templates
   set bloques = replace(bloques::text, 'wa.me/528183331741', 'wa.me/525593027234')::jsonb
 where bloques::text like '%wa.me/528183331741%';
