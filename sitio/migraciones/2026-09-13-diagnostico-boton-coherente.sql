-- El botón de la ruta `diagnostico` ofrecía una demo; el texto pedía otra cosa.
--
-- La ruta `diagnostico` entra a las cuentas grandes (varias sucursales) y su
-- guion NO vende una demo: ofrece quince minutos con los números del prospecto
-- y entrega el resultado aunque no compren. Pero los botones se habían copiado
-- de la ruta `demo`, así que el correo cerraba con "¿Le sacamos el diagnóstico
-- con sus números?" y abajo un botón que decía "Ver una demo de 20 minutos".
--
-- Pedir una cosa y ofrecer otra en el mismo correo es justo lo que hace dudar
-- al que ya estaba por dar clic, y le pasaba a los tres prospectos MÁS grandes
-- del segmento (BIAANI, HEFESTOS y Novias de España: 5, 5 y 6 sucursales).
--
-- La URL NO cambia: /agendar/demo es la única página de agenda que existe
-- (/agendar/diagnostico da 404). Lo que se corrige es lo que promete el botón.
-- El texto del botón sale de la plantilla y la IA no lo toca, por eso esto se
-- arregla aquí y no regenerando las cadencias.
update abm_plantillas set boton_texto = case orden
    when 0 then 'Ver qué sale en quince minutos'   -- cierra: ¿Le sacamos el diagnóstico con sus números?
    when 1 then 'Agendar los quince minutos'       -- cierra: ¿Le interesa que lo hagamos con sus números?
    when 3 then 'Hacer el ejercicio con sus modelos' -- cierra: ¿Quiere que hagamos ese mismo ejercicio con sus modelos?
    when 6 then 'Ver la lista y agendar'           -- cierra: ¿Le paso la lista de lo que necesitamos?
  end
 where giro = 'novias' and canal = 'email' and activa
   and ruta = 'diagnostico' and orden in (0, 1, 3, 6);

-- Y los borradores que ya se generaron con el botón viejo. Solo borradores:
-- lo aprobado o enviado no se reescribe nunca hacia atrás.
update abm_toques t set boton_texto = p.boton_texto
  from abm_cuentas c, abm_plantillas p
 where t.cuenta_id = c.id and c.giro = 'novias' and c.ruta = 'diagnostico'
   and t.estado = 'borrador' and t.canal = 'email' and t.boton_texto is not null
   and p.giro = 'novias' and p.canal = 'email' and p.activa and p.ruta = 'diagnostico'
   and p.boton_url = t.boton_url and p.imagen = t.imagen;
