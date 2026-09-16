-- Lo que la revisión adversarial encontró de la migración de las despedidas.
--
-- 1 · UNA FRASE ROTA. El regex que reescribió las 41 dejó a `tallas/diagnostico`
--     con «Si le sirve, le toco el año que entra.» — le falta «la puerta», y
--     leída en frío en México esa frase suena a otra cosa. Venía de «¿Prefiere
--     que lo saque de la lista o que le toque el año que entra?», donde el
--     verbo iba en subjuntivo.
--
-- 2 · NUEVE QUE NADIE TOCÓ. La migración buscaba «lo saco de la lista», así que
--     no vio las que cierran con «¿Lo dejamos así o le toco la puerta en unos
--     meses?». Es el mismo mecanismo: una pregunta cerrada que invita al «sí,
--     déjenlo así», o sea una baja pedida a mano en el último correo.
--
-- 3 · DOS DESPEDIDAS DE ALIADOS dicen «Gracias por leer.» y las otras 57
--     «Gracias por leer hasta aquí.». Se unifica.

update abm_plantillas set cuerpo = replace(cuerpo,
  'Si le sirve, le toco el año que entra.', 'Si le sirve, le toco la puerta el año que entra.')
where activa and cuerpo like '%Si le sirve, le toco el año que entra.%';

update abm_plantillas set cuerpo = replace(cuerpo,
  '¿Lo dejamos así o le toco la puerta en unos meses?',
  'Si le sirve, le toco la puerta en unos meses. Gracias por leer hasta aquí.')
where activa and canal='email' and orden=7 and cuerpo like '%¿Lo dejamos así o le toco la puerta en unos meses?%';

update abm_plantillas set cuerpo = replace(cuerpo,
  '¿Le parece si le escribo de nuevo el año que entra?',
  'Si le parece, le escribo de nuevo el año que entra. Gracias por leer hasta aquí.')
where activa and canal='email' and orden=7 and cuerpo like '%¿Le parece si le escribo de nuevo el año que entra?%';

update abm_plantillas set cuerpo = regexp_replace(cuerpo, 'Gracias por leer\.\s*$', 'Gracias por leer hasta aquí.')
where activa and canal='email' and orden=7 and cuerpo ~ 'Gracias por leer\.\s*$';

select count(*) filter (where btrim(cuerpo) like '%?') cierran_preguntando,
       count(*) filter (where cuerpo like '%le toco el año%') frase_rota,
       count(*) total
from abm_plantillas where activa and canal='email' and orden=7;
