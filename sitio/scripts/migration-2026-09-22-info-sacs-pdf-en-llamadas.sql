-- ══ MEJORA CRM #3 · el mismo PDF también en las llamadas (22-sep-2026) ══════
-- ⚠️ CORRER DESPUÉS DEL DEPLOY: antes, la liga del PDF todavía da 404.
--
-- Cuando en una llamada el prospecto dice «mándame información», el cierre con
-- IA manda el tema «la información de Sacs» de `tel_conocimiento`. Hasta hoy
-- se armaba un PDF de puro texto con ese renglón; con esto sale el mismo PDF
-- visual que manda el agente de WhatsApp. Una sola pieza, dos canales.
update tel_conocimiento
   set pdf_url = 'https://www.sacscloud.com/info/sacs-informacion.pdf', updated_at = now()
 where tema = 'la información de Sacs' and estado = 'activo';

select tema, pdf_url from tel_conocimiento where tema = 'la información de Sacs';
