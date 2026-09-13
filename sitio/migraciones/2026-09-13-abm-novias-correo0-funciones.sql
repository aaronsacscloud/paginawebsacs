-- ═══ El correo 1 con las funciones reales del giro ═══════════════════════
--
-- Pedido del dueño: agregar las funciones específicas de novias y decir que es
-- solo una parte de lo que hacemos.
--
-- Las seis funciones NO están inventadas: salen de la página del giro que ya
-- está publicada (giros/novias-y-fiesta.astro), que es lo que la empresa ya
-- promete en público. Meter aquí una función que la página no promete sería
-- vender algo distinto en el correo que en el sitio.
--   · Apartado con fecha del evento y abonos
--   · Muestras marcadas, aparte de los pedidos
--   · Taller con órdenes de servicio y fechas
--   · Entregas y pruebas con fecha, no de memoria
--   · El pedido al proveedor con su tiempo de entrega
--   · Un catálogo para piso, WhatsApp y redes
-- Y los dolores que se citan son los de esa misma página: el recibo en una
-- servilleta, la única talla 6 que se vendió, "¿era el 25 o el 29?".
--
-- LA LIGA DE AGENDAR SE QUITA DEL TEXTO: ahora es el BOTÓN del correo
-- (boton_texto / boton_url). El cron la agrega sola a la versión de texto
-- plano, para que quien lea sin formato tampoco se quede sin cómo agendar.
-- La de WhatsApp se queda en el cuerpo porque es la alternativa, no la acción
-- principal, y dos botones compitiendo no dejan ninguno claro.

update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de novia de México y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] salió ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — la buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En una casa de novias eso no alcanza, porque la venta no termina en la caja: termina en una fecha.
Tenemos una suite hecha para casas de novias y fiesta. Lo que resuelve:
· Apartado con fecha del evento y abonos, con el saldo al día. Se acabó el recibo en una servilleta.
· La muestra marcada aparte de los pedidos, para que no se venda la única talla 6 que tenía en piso.
· Taller con órdenes de servicio y fechas: qué vestido entra primero y desde cuándo lleva ahí.
· Pruebas y entregas con fecha, no de memoria. Nadie vuelve a preguntar si era el 25 o el 29.
· El pedido al proveedor con su tiempo de entrega, para saber si ese modelo en esa talla llega antes de la boda.
· Un catálogo que sirve igual en piso, en WhatsApp y en redes, con el mismo inventario detrás.
Y esto es solo una parte: atrás hay inventario por sucursal, traspasos entre tiendas, corte de caja, facturación y comisión de la vendedora. Se lo enseño en veinte minutos y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo enseño, o le mando primero cómo se ve por dentro la ficha de una novia?' where giro='novias' and canal='email' and orden=0 and ruta='demo';
update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de novia de México y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] salió ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — la buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales, que es justo donde empieza el problema: el vestido que una clienta pidió en una casi siempre está colgado en otra.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho software genérico y todos hacen lo mismo: cobran y descuentan del inventario. En una casa de novias eso no alcanza, porque la venta no termina en la caja: termina en una fecha.
Tenemos una suite hecha para casas de novias y fiesta: apartado con fecha del evento y abonos, la muestra marcada aparte de los pedidos, taller con órdenes de servicio, pruebas y entregas con fecha, y el pedido al proveedor con su tiempo de entrega. Y esto es solo una parte: atrás hay inventario por sucursal, traspasos, corte de caja y facturación.
Pero antes de enseñarle nada, le ofrezco algo más útil: un diagnóstico gratis de su inventario. Con su información le decimos en quince minutos cuánto dinero trae parado en modelos que no se mueven, qué tallas sí le venden y cuánto se le va en vestidos que estaban en la sucursal equivocada.
No es una demo disfrazada: son sus números y se los entregamos aunque no nos compren.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Le sacamos el diagnóstico con sus números?' where giro='novias' and canal='email' and orden=0 and ruta='diagnostico';
