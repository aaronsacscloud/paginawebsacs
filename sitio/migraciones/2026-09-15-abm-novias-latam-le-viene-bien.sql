-- Español neutro, revisión tras el render de prueba (15-sep-2026): «¿le
-- acomoda?» es mexicano; en Argentina, Chile o Colombia se dice «¿le viene
-- bien?». Solo las plantillas de la región latam (las de México se quedan).
update abm_plantillas
   set cuerpo = replace(cuerpo, '¿Le acomoda esta semana o la próxima?', '¿Le viene bien esta semana o la próxima?')
 where region = 'latam' and cuerpo like '%¿Le acomoda esta semana o la próxima?%'
returning nombre, canal;
