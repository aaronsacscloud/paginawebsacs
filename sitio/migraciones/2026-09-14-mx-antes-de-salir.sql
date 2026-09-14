-- Verificación de MX sobre TODO lo aprobado, y el WhatsApp de mayoristas fuera.
--
-- Por qué ahora: la primera tanda real salió el 14-sep y rebotaron 3 de 15
-- —20%—. El disyuntor corta con 3, así que la segunda tanda ya no habría
-- salido. Un dominio que no tiene MX no recibe correo: es un rebote seguro, y
-- los rebotes en un dominio que apenas lleva días calentando son lo que tira
-- la reputación del remitente.
--
-- Se revisaron los 73 dominios distintos de todo lo aprobado y en borrador.
-- Dos no tienen MX y sus toques se cancelan: angusboots.com y zaid.mx.
--
-- Y los WhatsApp de `mayoristas` se cancelan completos: ese giro NO tiene
-- guion de WhatsApp escrito, así que salían con el texto viejo —el que pedía
-- un dato sin haberse presentado— y encima sin plantilla de Meta.
update abm_toques set estado = 'cancelado'
 where canal = 'email' and estado in ('aprobado', 'borrador')
   and lower(split_part(destino, '@', 2)) in ('angusboots.com', 'zaid.mx');

update abm_canales set estado = 'invalido'
 where tipo like 'email%'
   and lower(split_part(valor, '@', 2)) in ('angusboots.com', 'zaid.mx');
