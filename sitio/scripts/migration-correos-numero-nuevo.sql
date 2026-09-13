-- 13-sep-2026 · Los CORREOS también llevaban el número viejo.
--
-- El código del repo ya apuntaba al +52 55 9302 7234, pero las plantillas de
-- correo viven en la base: 61 de ellas traían ligas `wa.me/524152838733` en sus
-- botones («Escríbeme por WhatsApp», «Quiero agendar»). Un lead que tocara ese
-- botón habría caído en el número retirado.
--
-- Solo se tocan las PLANTILLAS (lo que se va a mandar). Lo ya enviado
-- (email_sends, email_messages) no se reescribe: es historial.
update email_templates set
  html_compilado = replace(coalesce(html_compilado,''), '524152838733', '525593027234'),
  texto_plano    = replace(coalesce(texto_plano,''),    '524152838733', '525593027234'),
  bloques        = replace(coalesce(bloques::text,'{}'), '524152838733', '525593027234')::jsonb,
  updated_at     = now()
where coalesce(html_compilado,'') || coalesce(texto_plano,'') || coalesce(bloques::text,'') like '%4152838733%';
