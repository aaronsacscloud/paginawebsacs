-- ═══ El correo 0 cita lo que investigamos de ESA cuenta ══════════════════
--
-- Pedido del dueño: que el primer correo mencione los datos que encontramos de
-- esa cuenta, para que la oferta se vea relevante y no como un envío masivo; y
-- que de ahí salgan las dos ligas, WhatsApp y agendar.
--
-- Se puede porque el dato ESTÁ: de las 73 de novias, 73 traen ciudad,
-- calificación y reseñas; 69 traen la señal de lo que se investigó; 41 la
-- plataforma; 33 tienen más de una sucursal. Cada bloque va dentro de su
-- [[si ...]]: a quien no le encontramos algo, no se le inventa — la línea
-- desaparece sola.
--
-- El argumento que pidió, en ese orden: esto vimos de ustedes → por eso creemos
-- que les servimos → el software genérico cobra y descuenta, y con un vestido
-- de novia eso no alcanza → esto es lo que sí hacemos → las dos ligas.
--
-- ⚠️ La liga de WhatsApp es la NUEVA: wa.me/525593027234 (+52 1 415 283 8733).
-- última migración que lo haya tocado: wa.me/525593027234 (+52 1 55 9302 7234).
-- Una migración dice qué pasó ese día, no qué es cierto hoy.

update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de novia de México y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] salió ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — la buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si rating]]
· {{rating}} de calificación con {{resenas}} reseñas en Google.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho software de punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. Con un vestido de novia eso no alcanza, porque la venta empieza hoy y se entrega en seis meses.
Nosotros hacemos inventario y punto de venta para tiendas de moda, y la parte de novias está hecha aparte:
· La venta se guarda con la fecha de la BODA y la de entrega, no con la del ticket.
· El anticipo y los abonos de cada novia, con su saldo al día y sin buscar en la libreta.
· Las pruebas y el paso por taller: qué vestido está en ajustes y desde cuándo.
· El pedido al proveedor con su tiempo de entrega, para saber si ese modelo en esa talla llega a tiempo.
· La talla del muestrario contra la que se pide, que es donde se va el dinero.
Si quiere verlo por dentro son veinte minutos y se agenda aquí:
https://www.sacscloud.com/agendar/demo
Y si prefiere preguntarme por WhatsApp antes de agendar nada:
https://wa.me/525593027234
¿Se lo enseño, o le mando primero cómo se ve por dentro la ficha de una novia?',
  objetivo = 'citar lo investigado, explicar por que el generico no alcanza y dar las dos ligas'
where giro='novias' and canal='email' and orden=0 and ruta='demo';

update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de novia de México y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] salió ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — la buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si rating]]
· {{rating}} de calificación con {{resenas}} reseñas en Google.[[/si]][[si sucursales]]
· {{sucursales}} sucursales, que es justo donde empieza el problema: el vestido que una clienta pidió en una casi siempre está colgado en otra.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho software genérico y todos hacen lo mismo: cobran y descuentan del inventario. Con un vestido de novia eso no alcanza, porque la venta empieza hoy y se entrega en seis meses, con anticipo de por medio y un paso por taller.
Pero antes de enseñarle nada, le ofrezco algo más útil: un diagnóstico gratis de su inventario. Con su información le decimos en quince minutos cuánto dinero trae parado en modelos que no se mueven, qué tallas sí le venden y cuánto se le va en vestidos que estaban en la sucursal equivocada.
No es una demo disfrazada: son sus números y se los entregamos aunque no nos compren.
Si quiere que lo hagamos, aquí se agenda:
https://www.sacscloud.com/agendar/demo
Y si prefiere preguntarme por WhatsApp antes de agendar nada:
https://wa.me/525593027234
¿Le sacamos el diagnóstico con sus números?',
  objetivo = 'citar lo investigado y ofrecer el diagnostico gratis, con las dos ligas'
where giro='novias' and canal='email' and orden=0 and ruta='diagnostico';
