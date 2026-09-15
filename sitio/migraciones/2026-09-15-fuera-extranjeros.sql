-- Fuera los negocios que no están en México, y los correos mal escritos.
--
-- Al revisar el enriquecimiento salieron cuentas en Bogotá, Medellín,
-- Barranquilla, Santiago y Temuco. El barrido busca "«término» en «ciudad»,
-- «estado»" y Google, cuando la ciudad mexicana no le basta, devuelve el
-- negocio que mejor empata aunque esté en otro país. Todo el guion dice «el
-- mapa de las mejores X de México»: escribirle a una casa de novias de Bogotá
-- con ese texto es quedar mal y además no sirve de nada.
--
-- Y `@gmail.co`: NO es Colombia, es un error de dedo de gmail.com. Ese correo
-- no existe y solo sirve para juntar un rebote. Igual con hotmail.co y
-- outlook.co. Ojo de contraste: hotmail.es y outlook.es SÍ son válidos —los
-- usan miles de mexicanos— y por eso no entran aquí.
update abm_cuentas set etapa = 'no_contactar'
 where etapa is distinct from 'no_contactar'
   and ciudad in ('Bogotá','Medellín','Barranquilla','Cali','Santiago','Temuco',
                  'Lima','Buenos Aires','Quito','Guayaquil','Valparaíso',
                  'Concepción','Cartagena','Bucaramanga','Arequipa','Rosario',
                  'Montevideo','San José','Panamá','Guatemala','Madrid','Barcelona');

update abm_canales set estado = 'invalido'
 where tipo like 'email%'
   and valor ~* '@(gmail|hotmail|outlook|yahoo|live|icloud)\.co$';
