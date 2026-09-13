-- Reescritura del guion de WhatsApp en frío. El anterior pedía que lo reporten.
--
-- QUÉ ESTABA MAL, mensaje por mensaje:
--   · Abría con "Le escribo a {{nombre}} de parte de Sacs" y en la misma
--     respiración pedía un dato ("¿con quién puedo ver ese tema?"). Pide antes
--     de dar. A un desconocido que llega pidiendo se le reporta.
--   · Nunca decía DE DÓNDE salió su número. En WhatsApp eso es lo primero que
--     piensa quien lo recibe, y no responderlo se siente como base comprada.
--   · Decía "sistema de inventario para tiendas de moda" — genérico. No decía
--     que hay una versión hecha para casas de novia, que es el único motivo por
--     el que valdría la pena contestar.
--   · No ofrecía NADA. Solo pedía el correo de alguien más.
--
-- LAS REGLAS DEL PRIMER MENSAJE EN FRÍO POR WHATSAPP (valen para todo giro):
--   1. Quiénes somos, en una línea y en concreto.
--   2. DE DÓNDE salió su contacto. La verdad: Google Maps, los buscamos
--      nosotros, nadie nos pasó nada.
--   3. Su NOMBRE y algo real de ellos (reseñas, ciudad). Prueba de que no es
--      un envío masivo.
--   4. Por qué ELLOS: estamos buscando a los mejores del ramo y salieron ahí.
--   5. Qué tenemos que es ESPECÍFICO de su giro, con dos o tres cosas
--      concretas. Un "sistema de inventario" no le mueve a nadie.
--   6. Algo que DAMOS: la demo por videollamada, gratis y sin compromiso.
--   7. Una pregunta fácil de contestar. Nunca "pásame el correo de tu jefe".
--
-- Los [[si ...]] borran la frase entera cuando falta el dato, para que nadie
-- reciba "con  estrellas" ni "Buen día, ".

update abm_plantillas set cuerpo =
'Buen día[[si persona]], {{persona}}[[/si]]. Le escribo de Sacs — hacemos software mexicano de inventario y punto de venta para negocios de moda.

Estamos armando el mapa de las mejores casas de novia de México y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] salió en la lista[[si rating]]: {{rating}} estrellas con {{resenas}} reseñas[[/si]]. Los encontramos en Google Maps — nadie nos pasó su contacto.

Le escribo porque lo nuestro no es un punto de venta genérico: tenemos una versión hecha para casas de novia. Apartados con la fecha de la boda y sus abonos al día, el muestrario marcado aparte de lo que sí se vende, y las pruebas, el taller y el pedido al proveedor con fecha.

Este mes estamos dando demos gratis por videollamada, 20 minutos y sin compromiso. ¿Le muestro cómo se vería con sus modelos?'
 where giro='novias' and canal='whatsapp' and activa and orden=1;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}, le[[/si]][[si nombre]]Le[[/si]] escribo una vez más y ya no insisto de más.

Lo que más nos dicen las casas de novia es que todo cuelga de una fecha: el vestido que se pide al proveedor, las pruebas, el anticipo y la liquidación. Si una se recorre, se recorren todas — y eso hoy casi siempre vive en una libreta o en un grupo de WhatsApp.

Eso es justo lo que resuelve la versión para novias: cada novia con su fecha, sus abonos y sus pruebas en un solo lugar, y el sistema avisando antes, no cuando ya se pasó.

La demo por videollamada sigue en pie: 20 minutos, gratis. ¿Le acomoda esta semana o la que entra?'
 where giro='novias' and canal='whatsapp' and activa and orden=2;

update abm_plantillas set cuerpo =
'Con este cierro el tema — no quiero ser el que insiste.

Si en alguna temporada les pesa llevar los apartados, las pruebas y los abonos en libreta, aquí seguimos y con gusto les muestro cómo lo resuelve el sistema. Este número queda abierto.

Y si prefiere verlo sin hablar con nadie primero, puede agendar la demo cuando quiera: https://www.sacscloud.com/agendar/demo

Gracias por el tiempo y mucho éxito con la temporada.'
 where giro='novias' and canal='whatsapp' and activa and orden=3;
-- El motor de plantillas NO tiene negación: no existe [[si no persona]]. Poner
-- [[si persona]]…le[[/si]][[si nombre]]Le[[/si]] imprimía los DOS cuando había
-- persona, y salía "Cielo Inzunza, leLe escribo una vez más". Lo cachó el
-- render contra cuentas reales, que es para lo que se hace.
--
-- La forma correcta es que el condicional sea una frase completa que se pueda
-- borrar entera sin romper la de afuera.
update abm_plantillas set cuerpo =
'Le escribo una vez más y ya no le insisto más.

Lo que más nos dicen las casas de novia es que todo cuelga de una fecha: el vestido que se pide al proveedor, las pruebas, el anticipo y la liquidación. Si una se recorre, se recorren todas — y eso hoy casi siempre vive en una libreta o en un grupo de WhatsApp.

Eso es justo lo que resuelve la versión para novias: cada novia con su fecha, sus abonos y sus pruebas en un solo lugar, y el sistema avisando antes, no cuando ya se pasó.

La demo por videollamada sigue en pie: 20 minutos, gratis y sin compromiso. ¿Le acomoda esta semana o la que entra?'
 where giro='novias' and canal='whatsapp' and activa and orden=2;
