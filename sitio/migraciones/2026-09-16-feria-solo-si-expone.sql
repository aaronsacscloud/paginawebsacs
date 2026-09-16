-- ══ No se le dice a nadie que expone en una feria a la que no va ════════════
--
-- El correo 0 de calzado y marcas abre así:
--
--     estuvimos armando la lista de fábricas y marcas de calzado QUE EXPONEN
--     EN SAPICA y {{nombre}}, de {{ciudad}}, salió ahí
--
-- Es cierto para las 632 cuentas del padrón de la feria. NO lo es para las 304
-- que trajo Google Maps, y 43 de ellas ya estaban en la fila del goteo «SAPICA
-- · cuarenta al día», que reparte 40 al día. Entre esas 43:
--
--     Industrial de Pinturas Ecatepec SA de CV
--     Reparadora de Calzado «Carol»
--     Provesicsa Seguridad Industrial
--     Seguridad Técnica Mat · Segurihigiene · Safety Depot
--
-- A una fábrica de pinturas le habría llegado un correo diciéndole que expone
-- en la feria del calzado y ofreciéndole crédito por cada cliente zapatería.
-- El gancho del correo 0 es precisamente «le digo por qué le llega esto»: si
-- esa frase es falsa, el correo entero se cae, y es de las falsedades más
-- fáciles de verificar que hay — el destinatario sabe si va a SAPICA o no.
--
-- El motor de plantillas no tiene «o», así que van dos banderas
-- complementarias desde `variablesDe` (el mismo recurso que `vimos`):
--   feria      el nombre, cuando la cuenta viene del padrón
--   sin_feria  lleno cuando no, para la versión que sí se sostiene
--
-- La versión sin feria no inventa nada: dice el giro y la ciudad, que es lo
-- que de verdad sabemos de una cuenta que salió de Google Maps.

update abm_plantillas set cuerpo = replace(cuerpo,
 'estuvimos armando la lista de fábricas y marcas de calzado que exponen en SAPICA y {{nombre}}',
 'estuvimos armando el mapa de las fábricas y marcas de calzado de México[[si feria]], empezando por las que exponen en {{feria}},[[/si]] y {{nombre}}')
where giro = 'calzado' and canal = 'email' and orden = 0
  and cuerpo like '%que exponen en SAPICA%';

update abm_plantillas set cuerpo = replace(cuerpo,
 'estuvimos armando la lista de marcas que exponen en Intermoda y {{nombre}}',
 'estuvimos armando el mapa de las marcas de moda de México[[si feria]], empezando por las que exponen en {{feria}},[[/si]] y {{nombre}}')
where giro = 'marcas' and canal = 'email' and orden = 0
  and cuerpo like '%que exponen en Intermoda%';

select count(*) quedan_afirmando_la_feria from abm_plantillas
where activa and cuerpo ~ 'que exponen en (SAPICA|Intermoda) y \{\{nombre\}\}';
