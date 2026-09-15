-- El correo 0 de presentación para los 21 giros que faltaban.
--
-- Hasta hoy solo lo tenían novias, calzado, marcas y mayoristas. Los otros 21
-- arrancaban en frío sin decir de dónde salimos, que es justo lo que el manual
-- prohíbe (§7.2): el primer correo existe para que el prospecto entienda POR
-- QUÉ le llega.
--
-- El texto NO es el de novias con el giro cambiado. Cada uno tiene su propio
-- `quiebre` —por qué el punto de venta genérico no alcanza EN ESE GIRO— y sus
-- seis funciones en el vocabulario del ramo:
--
--   zapaterías  "usted no vende modelos: vende números"
--   telas       "usted no vende piezas: vende metros"
--   renta       "la prenda no se vende: se va y regresa"
--   vintage     "cada prenda es única: no hay dos iguales"
--   sublimado   "no vende inventario: vende trabajo con fecha de entrega"
--   fabricantes "entre la tela y la prenda hay corte y maquila"
--
-- La prueba del manual (§7.7) es que el párrafo NO sirva para otro negocio. Si
-- cambias el giro y se sigue leyendo bien, está mal escrito.
--
-- Todo sale de src/lib/crm/abm-giro-copy.ts, que es la fuente única: el mismo
-- archivo alimenta este correo y los tres mensajes de WhatsApp en frío. Antes
-- el texto del giro vivía en dos lugares y arreglar una frase obligaba a
-- buscarla en ambos —y casi siempre se arreglaba en uno solo.
insert into abm_plantillas (giro, ruta, canal, orden, nombre, asunto, cuerpo, objetivo, activa) values
('zapaterias','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las zapaterías de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En una zapatería eso no alcanza, porque usted no vende modelos: vende números. Y el sistema que cuenta pares sin saber de qué número son, no cuenta nada.
Tenemos una suite hecha para zapaterías. Lo que resuelve:
· Inventario por número, no por modelo. Saber que hay catorce pares no sirve si los siete del 25 ya se fueron.
· La corrida completa a la vista: qué números se agotan primero y cuáles se quedan en los extremos temporada tras temporada.
· Traslado entre sucursales desde el mostrador, sin hablarle a la otra tienda para preguntar si lo tienen.
· Apartado con abonos para el par que se pidió y todavía no llega.
· El pedido al proveedor por corrida, con su tiempo de entrega, para no volver a quedarse sin los números que sí se venden.
· Un catálogo con existencias reales por número, igual en tienda que en WhatsApp.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el inventario por número?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('zapaterias','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las zapaterías de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En una zapatería eso no alcanza, porque usted no vende modelos: vende números. Y el sistema que cuenta pares sin saber de qué número son, no cuenta nada.
Tenemos una suite hecha para zapaterías. Lo que resuelve:
· Inventario por número, no por modelo. Saber que hay catorce pares no sirve si los siete del 25 ya se fueron.
· La corrida completa a la vista: qué números se agotan primero y cuáles se quedan en los extremos temporada tras temporada.
· Traslado entre sucursales desde el mostrador, sin hablarle a la otra tienda para preguntar si lo tienen.
· Apartado con abonos para el par que se pidió y todavía no llega.
· El pedido al proveedor por corrida, con su tiempo de entrega, para no volver a quedarse sin los números que sí se venden.
· Un catálogo con existencias reales por número, igual en tienda que en WhatsApp.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el inventario por número?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('boutiques','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las boutiques de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En una boutique eso no alcanza, porque su inventario no son piezas: son combinaciones de talla y color, y cada una se vende distinto.
Tenemos una suite hecha para boutiques de moda. Lo que resuelve:
· Inventario por talla y color, con la matriz completa a la vista.
· Qué combinación se vende sola y cuál lleva meses colgada, con el dinero que representa cada una.
· Apartado con abonos, que en boutique es la mitad de la venta de temporada.
· El catálogo en línea con el mismo inventario de la tienda, para no vender lo que ya no está.
· Traslado entre sucursales sin llamadas, cuando una clienta quiere la talla que está en la otra tienda.
· Cierre de caja y comisión de la vendedora, calculadas solas.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve la matriz de tallas?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('boutiques','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las boutiques de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En una boutique eso no alcanza, porque su inventario no son piezas: son combinaciones de talla y color, y cada una se vende distinto.
Tenemos una suite hecha para boutiques de moda. Lo que resuelve:
· Inventario por talla y color, con la matriz completa a la vista.
· Qué combinación se vende sola y cuál lleva meses colgada, con el dinero que representa cada una.
· Apartado con abonos, que en boutique es la mitad de la venta de temporada.
· El catálogo en línea con el mismo inventario de la tienda, para no vender lo que ya no está.
· Traslado entre sucursales sin llamadas, cuando una clienta quiere la talla que está en la otra tienda.
· Cierre de caja y comisión de la vendedora, calculadas solas.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve la matriz de tallas?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('joyeria','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las joyerías de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En una joyería eso no alcanza, porque cada pieza vale distinto y un inventario que cuenta bultos no dice cuánto dinero tiene usted en la vitrina.
Tenemos una suite hecha para joyerías. Lo que resuelve:
· Inventario pieza por pieza, con su costo real y su margen.
· Qué piezas llevan meses sin moverse y cuánto dinero representan.
· Apartado con abonos, que en joyería es la forma normal de comprar.
· Control de lo que sale a consignación y de lo que entra a taller, con quién lo tiene y desde cuándo.
· Reparaciones con su orden de servicio y su fecha de entrega.
· Cierre de caja con el detalle por pieza, no por montón.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el inventario por pieza?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('joyeria','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las joyerías de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En una joyería eso no alcanza, porque cada pieza vale distinto y un inventario que cuenta bultos no dice cuánto dinero tiene usted en la vitrina.
Tenemos una suite hecha para joyerías. Lo que resuelve:
· Inventario pieza por pieza, con su costo real y su margen.
· Qué piezas llevan meses sin moverse y cuánto dinero representan.
· Apartado con abonos, que en joyería es la forma normal de comprar.
· Control de lo que sale a consignación y de lo que entra a taller, con quién lo tiene y desde cuándo.
· Reparaciones con su orden de servicio y su fecha de entrega.
· Cierre de caja con el detalle por pieza, no por montón.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el inventario por pieza?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('renta','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las casas de renta de vestidos y trajes de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En renta eso no alcanza, porque la prenda no se vende: se va y regresa. Y un sistema que solo descuenta del inventario no sabe cuándo vuelve.
Tenemos una suite hecha para renta de vestidos y trajes. Lo que resuelve:
· Calendario por prenda, con su fecha de salida y de regreso. Nada se aparta dos veces el mismo fin de semana.
· Depósito y abonos, con el saldo al día y quién debe qué.
· El estado de cada pieza al volver: qué entró a lavandería, qué a compostura y qué ya no sirve.
· Pruebas y ajustes con fecha, no de memoria.
· Cuántas veces salió cada prenda y cuánto ha dejado, para saber cuál conviene reponer.
· Un catálogo con lo que está libre en esa fecha, no con lo que existe.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el calendario de una prenda?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('renta','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las casas de renta de vestidos y trajes de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En renta eso no alcanza, porque la prenda no se vende: se va y regresa. Y un sistema que solo descuenta del inventario no sabe cuándo vuelve.
Tenemos una suite hecha para renta de vestidos y trajes. Lo que resuelve:
· Calendario por prenda, con su fecha de salida y de regreso. Nada se aparta dos veces el mismo fin de semana.
· Depósito y abonos, con el saldo al día y quién debe qué.
· El estado de cada pieza al volver: qué entró a lavandería, qué a compostura y qué ya no sirve.
· Pruebas y ajustes con fecha, no de memoria.
· Cuántas veces salió cada prenda y cuánto ha dejado, para saber cuál conviene reponer.
· Un catálogo con lo que está libre en esa fecha, no con lo que existe.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el calendario de una prenda?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('western','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de botas y ropa vaquera de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En botas eso no alcanza, porque una bota no es un modelo: es horma, número y material, y el cliente que quiere la suya no acepta otra.
Tenemos una suite hecha para botas y ropa western. Lo que resuelve:
· Inventario por horma, número y material, no solo por modelo.
· La corrida completa a la vista, con los números que se agotan primero.
· Pedido al proveedor por corrida y por horma, con su tiempo de entrega.
· Apartado con abonos para la bota que se mandó pedir.
· Traslado entre sucursales desde el mostrador.
· Qué se vende en temporada de feria y qué se queda, con el dinero de cada uno.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el inventario por horma y número?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('western','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de botas y ropa vaquera de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En botas eso no alcanza, porque una bota no es un modelo: es horma, número y material, y el cliente que quiere la suya no acepta otra.
Tenemos una suite hecha para botas y ropa western. Lo que resuelve:
· Inventario por horma, número y material, no solo por modelo.
· La corrida completa a la vista, con los números que se agotan primero.
· Pedido al proveedor por corrida y por horma, con su tiempo de entrega.
· Apartado con abonos para la bota que se mandó pedir.
· Traslado entre sucursales desde el mostrador.
· Qué se vende en temporada de feria y qué se queda, con el dinero de cada uno.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el inventario por horma y número?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('telas','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de telas y mercería de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En telas eso no alcanza, porque usted no vende piezas: vende metros, y un sistema que cuenta unidades no sabe cuánto le queda en el rollo.
Tenemos una suite hecha para telas y mercería. Lo que resuelve:
· Inventario por metro y por rollo, con lo que queda de cada uno.
· Venta por metro, por corte y por pieza completa, con su precio distinto.
· Qué telas se mueven por temporada y cuáles llevan el año en el anaquel.
· Pedido al proveedor por rollo, con su tiempo de entrega.
· Mercería con miles de claves chicas, sin que el inventario se vuelva imposible.
· Cierre de caja y comisión, calculadas solas.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el inventario por metro?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('telas','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de telas y mercería de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En telas eso no alcanza, porque usted no vende piezas: vende metros, y un sistema que cuenta unidades no sabe cuánto le queda en el rollo.
Tenemos una suite hecha para telas y mercería. Lo que resuelve:
· Inventario por metro y por rollo, con lo que queda de cada uno.
· Venta por metro, por corte y por pieza completa, con su precio distinto.
· Qué telas se mueven por temporada y cuáles llevan el año en el anaquel.
· Pedido al proveedor por rollo, con su tiempo de entrega.
· Mercería con miles de claves chicas, sin que el inventario se vuelva imposible.
· Cierre de caja y comisión, calculadas solas.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el inventario por metro?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('tallas','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de ropa de bebé, maternidad y tallas extra de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En este giro eso no alcanza, porque la talla lo es todo: la clienta que no encuentra la suya no compra otra cosa, se va.
Tenemos una suite hecha para ropa de bebé, maternidad y tallas extra. Lo que resuelve:
· Inventario por talla y edad, con la curva completa a la vista.
· Qué tallas se agotan primero y cuáles se quedan, temporada tras temporada.
· Pedido al proveedor por curva de tallas, no por bulto.
· Apartado con abonos para la prenda que se mandó pedir.
· Traslado entre sucursales cuando la talla está en la otra tienda.
· Catálogo con existencias reales por talla, igual en tienda que en WhatsApp.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve la curva de tallas?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('tallas','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de ropa de bebé, maternidad y tallas extra de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En este giro eso no alcanza, porque la talla lo es todo: la clienta que no encuentra la suya no compra otra cosa, se va.
Tenemos una suite hecha para ropa de bebé, maternidad y tallas extra. Lo que resuelve:
· Inventario por talla y edad, con la curva completa a la vista.
· Qué tallas se agotan primero y cuáles se quedan, temporada tras temporada.
· Pedido al proveedor por curva de tallas, no por bulto.
· Apartado con abonos para la prenda que se mandó pedir.
· Traslado entre sucursales cuando la talla está en la otra tienda.
· Catálogo con existencias reales por talla, igual en tienda que en WhatsApp.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve la curva de tallas?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('deportiva','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de ropa deportiva y uniformes de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En deportiva eso no alcanza, porque la mitad de su venta no está en el mostrador: está en un pedido de equipo, con tallas, nombres y números.
Tenemos una suite hecha para ropa deportiva y uniformes. Lo que resuelve:
· Pedidos de equipo con su lista de tallas, nombres y números, y su fecha de entrega.
· Anticipo y saldo del pedido, con quién debe qué.
· Inventario por talla y color de lo que sí está en piso.
· Órdenes de estampado y bordado con su fecha, para saber qué entra primero.
· Pedido al proveedor con su tiempo de entrega, para comprometer fechas que sí se cumplen.
· Catálogo con existencias reales, igual en tienda que en WhatsApp.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve un pedido de equipo por dentro?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('deportiva','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de ropa deportiva y uniformes de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En deportiva eso no alcanza, porque la mitad de su venta no está en el mostrador: está en un pedido de equipo, con tallas, nombres y números.
Tenemos una suite hecha para ropa deportiva y uniformes. Lo que resuelve:
· Pedidos de equipo con su lista de tallas, nombres y números, y su fecha de entrega.
· Anticipo y saldo del pedido, con quién debe qué.
· Inventario por talla y color de lo que sí está en piso.
· Órdenes de estampado y bordado con su fecha, para saber qué entra primero.
· Pedido al proveedor con su tiempo de entrega, para comprometer fechas que sí se cumplen.
· Catálogo con existencias reales, igual en tienda que en WhatsApp.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve un pedido de equipo por dentro?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('scrubs','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de uniformes médicos de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En uniformes eso no alcanza, porque su venta grande no es de mostrador: es un pedido de hospital o de escuela, con tallas, bordados y una fecha que no se mueve.
Tenemos una suite hecha para uniformes médicos. Lo que resuelve:
· Pedidos institucionales con su lista de tallas y su fecha de entrega.
· Bordado y personalización con su orden de servicio, para saber qué entra primero.
· Anticipo y saldo, con quién debe qué.
· Inventario por talla y color de lo que está en piso.
· Pedido al proveedor con su tiempo de entrega, para comprometer fechas que sí se cumplen.
· Facturación al hospital o a la escuela, sin rehacer la captura.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve un pedido institucional por dentro?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('scrubs','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de uniformes médicos de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En uniformes eso no alcanza, porque su venta grande no es de mostrador: es un pedido de hospital o de escuela, con tallas, bordados y una fecha que no se mueve.
Tenemos una suite hecha para uniformes médicos. Lo que resuelve:
· Pedidos institucionales con su lista de tallas y su fecha de entrega.
· Bordado y personalización con su orden de servicio, para saber qué entra primero.
· Anticipo y saldo, con quién debe qué.
· Inventario por talla y color de lo que está en piso.
· Pedido al proveedor con su tiempo de entrega, para comprometer fechas que sí se cumplen.
· Facturación al hospital o a la escuela, sin rehacer la captura.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve un pedido institucional por dentro?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('vintage','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de ropa de segunda mano y vintage de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En segunda mano eso no alcanza, porque cada prenda es única: no hay dos iguales, no hay corrida y no hay reposición.
Tenemos una suite hecha para ropa vintage y de segunda mano. Lo que resuelve:
· Inventario por pieza única, con su foto, su costo y su precio.
· De qué lote o paca salió cada prenda, para saber qué lote deja dinero y cuál no.
· Qué lleva meses colgado y cuánto representa en dinero parado.
· Apartado con abonos para la pieza que se separó.
· Catálogo en línea con la pieza única, que se baja sola al venderse.
· Cierre de caja con el margen real por prenda.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el control por pieza única?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('vintage','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de ropa de segunda mano y vintage de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En segunda mano eso no alcanza, porque cada prenda es única: no hay dos iguales, no hay corrida y no hay reposición.
Tenemos una suite hecha para ropa vintage y de segunda mano. Lo que resuelve:
· Inventario por pieza única, con su foto, su costo y su precio.
· De qué lote o paca salió cada prenda, para saber qué lote deja dinero y cuál no.
· Qué lleva meses colgado y cuánto representa en dinero parado.
· Apartado con abonos para la pieza que se separó.
· Catálogo en línea con la pieza única, que se baja sola al venderse.
· Cierre de caja con el margen real por prenda.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el control por pieza única?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('disfraces','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de disfraces de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En disfraces eso no alcanza, porque se vende y se renta al mismo tiempo, y el pico de temporada decide el año entero.
Tenemos una suite hecha para disfraces y renta de trajes. Lo que resuelve:
· Venta y renta en el mismo sistema, cada una con sus reglas.
· Calendario de lo rentado, con fecha de salida y de regreso.
· Depósito en garantía y su devolución, con quién debe qué.
· Inventario por talla y personaje de lo que está libre en esa fecha.
· El estado de la prenda al volver: qué entra a lavandería y qué a compostura.
· Qué se movió en temporada y qué no, para preparar la siguiente.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el calendario de renta?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('disfraces','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de disfraces de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En disfraces eso no alcanza, porque se vende y se renta al mismo tiempo, y el pico de temporada decide el año entero.
Tenemos una suite hecha para disfraces y renta de trajes. Lo que resuelve:
· Venta y renta en el mismo sistema, cada una con sus reglas.
· Calendario de lo rentado, con fecha de salida y de regreso.
· Depósito en garantía y su devolución, con quién debe qué.
· Inventario por talla y personaje de lo que está libre en esa fecha.
· El estado de la prenda al volver: qué entra a lavandería y qué a compostura.
· Qué se movió en temporada y qué no, para preparar la siguiente.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el calendario de renta?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('sublimado','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de los talleres de playeras personalizadas y sublimado de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En personalización eso no alcanza, porque usted no vende inventario: vende trabajo con fecha de entrega, y lo que se atora es el taller, no la caja.
Tenemos una suite hecha para personalización y sublimado. Lo que resuelve:
· Órdenes de trabajo con su arte, sus tallas y su fecha de entrega.
· En qué paso va cada orden: diseño, impresión, prensa, entrega.
· Anticipo y saldo por orden, con quién debe qué.
· Inventario de playeras y blancos por talla y color.
· Qué órdenes están por vencerse, antes de que el cliente llame.
· Cotización y factura sin recapturar lo mismo tres veces.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve una orden de taller por dentro?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('sublimado','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de los talleres de playeras personalizadas y sublimado de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En personalización eso no alcanza, porque usted no vende inventario: vende trabajo con fecha de entrega, y lo que se atora es el taller, no la caja.
Tenemos una suite hecha para personalización y sublimado. Lo que resuelve:
· Órdenes de trabajo con su arte, sus tallas y su fecha de entrega.
· En qué paso va cada orden: diseño, impresión, prensa, entrega.
· Anticipo y saldo por orden, con quién debe qué.
· Inventario de playeras y blancos por talla y color.
· Qué órdenes están por vencerse, antes de que el cliente llame.
· Cotización y factura sin recapturar lo mismo tres veces.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve una orden de taller por dentro?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('jeans','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de jeans y mezclilla de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En mezclilla eso no alcanza, porque una talla 30 no es una talla 30: es corte, largo y lavado, y el cliente que encuentra el suyo vuelve por el mismo.
Tenemos una suite hecha para jeans y mezclilla. Lo que resuelve:
· Inventario por talla, corte y largo, no solo por modelo.
· Qué combinación se vende sola y cuál lleva meses en el anaquel.
· Pedido al proveedor por curva de tallas, con su tiempo de entrega.
· Traslado entre sucursales cuando el corte está en la otra tienda.
· Apartado con abonos para lo que se mandó pedir.
· Catálogo con existencias reales por talla y corte.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el inventario por corte y largo?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('jeans','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de jeans y mezclilla de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En mezclilla eso no alcanza, porque una talla 30 no es una talla 30: es corte, largo y lavado, y el cliente que encuentra el suyo vuelve por el mismo.
Tenemos una suite hecha para jeans y mezclilla. Lo que resuelve:
· Inventario por talla, corte y largo, no solo por modelo.
· Qué combinación se vende sola y cuál lleva meses en el anaquel.
· Pedido al proveedor por curva de tallas, con su tiempo de entrega.
· Traslado entre sucursales cuando el corte está en la otra tienda.
· Apartado con abonos para lo que se mandó pedir.
· Catálogo con existencias reales por talla y corte.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el inventario por corte y largo?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('trajesbano','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de trajes de baño y ropa de playa de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En trajes de baño eso no alcanza, porque su año entero se juega en temporada, y lo que no se vendió en agosto ya no se vende.
Tenemos una suite hecha para trajes de baño y ropa de playa. Lo que resuelve:
· Inventario por talla y color, con la curva completa a la vista.
· Qué se movió la temporada pasada y qué se quedó, para comprar mejor esta.
· Pedido al proveedor con su tiempo de entrega, para llegar antes de la temporada y no durante.
· Traslado entre sucursales, que en plaza turística cambia de un día a otro.
· Catálogo con existencias reales, igual en tienda que en WhatsApp.
· Cierre de caja y comisión, calculadas solas.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el comparativo de temporada?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('trajesbano','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de trajes de baño y ropa de playa de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En trajes de baño eso no alcanza, porque su año entero se juega en temporada, y lo que no se vendió en agosto ya no se vende.
Tenemos una suite hecha para trajes de baño y ropa de playa. Lo que resuelve:
· Inventario por talla y color, con la curva completa a la vista.
· Qué se movió la temporada pasada y qué se quedó, para comprar mejor esta.
· Pedido al proveedor con su tiempo de entrega, para llegar antes de la temporada y no durante.
· Traslado entre sucursales, que en plaza turística cambia de un día a otro.
· Catálogo con existencias reales, igual en tienda que en WhatsApp.
· Cierre de caja y comisión, calculadas solas.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el comparativo de temporada?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('charro','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de trajes de charro y ropa de danza de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En charro y danza eso no alcanza, porque casi todo es a la medida y con fecha: el traje se hace para una persona y para un día.
Tenemos una suite hecha para trajes de charro y danza. Lo que resuelve:
· Pedidos a la medida con sus medidas, su fecha de prueba y su fecha de entrega.
· Taller con órdenes de servicio: qué entra primero y desde cuándo está ahí.
· Anticipo y saldo por pedido, con quién debe qué.
· Pedidos de grupo —un ballet completo— con la lista de medidas de cada integrante.
· Inventario de lo que sí está hecho y listo para llevar.
· El pedido al proveedor de material con su tiempo de entrega.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve un pedido de grupo por dentro?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('charro','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las tiendas de trajes de charro y ropa de danza de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En charro y danza eso no alcanza, porque casi todo es a la medida y con fecha: el traje se hace para una persona y para un día.
Tenemos una suite hecha para trajes de charro y danza. Lo que resuelve:
· Pedidos a la medida con sus medidas, su fecha de prueba y su fecha de entrega.
· Taller con órdenes de servicio: qué entra primero y desde cuándo está ahí.
· Anticipo y saldo por pedido, con quién debe qué.
· Pedidos de grupo —un ballet completo— con la lista de medidas de cada integrante.
· Inventario de lo que sí está hecho y listo para llevar.
· El pedido al proveedor de material con su tiempo de entrega.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve un pedido de grupo por dentro?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('relojerias','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las relojerías de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En relojería eso no alcanza, porque la mitad del negocio no es la venta: es el taller, con piezas ajenas, garantías y fechas.
Tenemos una suite hecha para relojerías. Lo que resuelve:
· Inventario pieza por pieza, con su costo real y su margen.
· Órdenes de servicio del taller: qué reloj de quién, desde cuándo y para cuándo.
· Garantías con su vigencia, para no discutirlas de memoria.
· Apartado con abonos, que en relojería es la forma normal de comprar.
· Qué piezas llevan meses sin moverse y cuánto dinero representan.
· Cierre de caja con el detalle por pieza.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve una orden de taller?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('relojerias','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las relojerías de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En relojería eso no alcanza, porque la mitad del negocio no es la venta: es el taller, con piezas ajenas, garantías y fechas.
Tenemos una suite hecha para relojerías. Lo que resuelve:
· Inventario pieza por pieza, con su costo real y su margen.
· Órdenes de servicio del taller: qué reloj de quién, desde cuándo y para cuándo.
· Garantías con su vigencia, para no discutirlas de memoria.
· Apartado con abonos, que en relojería es la forma normal de comprar.
· Qué piezas llevan meses sin moverse y cuánto dinero representan.
· Cierre de caja con el detalle por pieza.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve una orden de taller?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('outlets','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de los outlets y tiendas de saldos de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En saldos eso no alcanza, porque usted compra por lote y vende por pieza, y lo único que importa es cuánto dejó cada lote.
Tenemos una suite hecha para outlets y saldos. Lo que resuelve:
· Costo por lote repartido entre las piezas, para saber el margen real de cada una.
· Qué lote se movió y cuál sigue ahí, con el dinero de cada uno.
· Precios por etapa de liquidación, sin recapturar la tienda entera.
· Inventario por talla de lo que queda del lote.
· Traslado entre sucursales, que en saldos cambia todas las semanas.
· Cierre de caja con el margen por lote, no por montón.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el margen por lote?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('outlets','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de los outlets y tiendas de saldos de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En saldos eso no alcanza, porque usted compra por lote y vende por pieza, y lo único que importa es cuánto dejó cada lote.
Tenemos una suite hecha para outlets y saldos. Lo que resuelve:
· Costo por lote repartido entre las piezas, para saber el margen real de cada una.
· Qué lote se movió y cuál sigue ahí, con el dinero de cada uno.
· Precios por etapa de liquidación, sin recapturar la tienda entera.
· Inventario por talla de lo que queda del lote.
· Traslado entre sucursales, que en saldos cambia todas las semanas.
· Cierre de caja con el margen por lote, no por montón.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el margen por lote?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('distribuidores','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de los distribuidores de ropa de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En distribución eso no alcanza, porque usted no le vende al público: le vende a tiendas, con precio por cliente, crédito y una lista de pedidos que cambia todos los días.
Tenemos una suite hecha para distribución de ropa. Lo que resuelve:
· Lista de precios por cliente, sin recapturarla en cada pedido.
· Crédito y saldo por cliente, con quién debe qué y desde cuándo.
· Pedidos por tienda con su curva de tallas y su fecha de surtido.
· Inventario por talla y color de lo que de verdad hay para surtir.
· Qué cliente compra qué y cada cuánto, para saber a quién llamar.
· Facturación sin rehacer la captura.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve un pedido de tienda por dentro?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('distribuidores','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de los distribuidores de ropa de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En distribución eso no alcanza, porque usted no le vende al público: le vende a tiendas, con precio por cliente, crédito y una lista de pedidos que cambia todos los días.
Tenemos una suite hecha para distribución de ropa. Lo que resuelve:
· Lista de precios por cliente, sin recapturarla en cada pedido.
· Crédito y saldo por cliente, con quién debe qué y desde cuándo.
· Pedidos por tienda con su curva de tallas y su fecha de surtido.
· Inventario por talla y color de lo que de verdad hay para surtir.
· Qué cliente compra qué y cada cuánto, para saber a quién llamar.
· Facturación sin rehacer la captura.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve un pedido de tienda por dentro?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('fabricantes','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de los fabricantes de ropa de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En fábrica eso no alcanza, porque entre la tela y la prenda hay corte, maquila y proceso, y ahí es donde se pierde el dinero que nadie ve.
Tenemos una suite hecha para fabricación de ropa. Lo que resuelve:
· Órdenes de producción con su corte, su maquilero y su fecha.
· Qué salió a maquila, con quién está y cuándo vuelve.
· Consumo de tela por prenda, para saber el costo real y no el estimado.
· Inventario en tres momentos: materia prima, proceso y producto terminado.
· Pedidos de clientes con su curva de tallas y su fecha comprometida.
· Costo real por prenda, con tela, maquila y avíos adentro.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve una orden de producción?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('fabricantes','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de los fabricantes de ropa de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En fábrica eso no alcanza, porque entre la tela y la prenda hay corte, maquila y proceso, y ahí es donde se pierde el dinero que nadie ve.
Tenemos una suite hecha para fabricación de ropa. Lo que resuelve:
· Órdenes de producción con su corte, su maquilero y su fecha.
· Qué salió a maquila, con quién está y cuándo vuelve.
· Consumo de tela por prenda, para saber el costo real y no el estimado.
· Inventario en tres momentos: materia prima, proceso y producto terminado.
· Pedidos de clientes con su curva de tallas y su fecha comprometida.
· Costo real por prenda, con tela, maquila y avíos adentro.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve una orden de producción?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('cadenas','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las cadenas de tiendas de moda de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En una cadena eso no alcanza, porque el problema no es vender: es que la prenda está en la tienda equivocada y nadie se entera hasta el corte de temporada.
Tenemos una suite hecha para cadenas de moda. Lo que resuelve:
· Inventario por sucursal, con la matriz de talla y color en cada una.
· Traslados entre tiendas sugeridos por lo que de verdad se vende en cada plaza.
· Qué combinación se vende en una tienda y se queda parada en otra.
· Cierre de caja y comisión por sucursal y por vendedora.
· Compras por curva de tallas con el histórico de cada plaza detrás.
· El mismo inventario detrás de la tienda en línea y del mostrador.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el inventario por sucursal?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('cadenas','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las cadenas de tiendas de moda de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En una cadena eso no alcanza, porque el problema no es vender: es que la prenda está en la tienda equivocada y nadie se entera hasta el corte de temporada.
Tenemos una suite hecha para cadenas de moda. Lo que resuelve:
· Inventario por sucursal, con la matriz de talla y color en cada una.
· Traslados entre tiendas sugeridos por lo que de verdad se vende en cada plaza.
· Qué combinación se vende en una tienda y se queda parada en otra.
· Cierre de caja y comisión por sucursal y por vendedora.
· Compras por curva de tallas con el histórico de cada plaza detrás.
· El mismo inventario detrás de la tienda en línea y del mostrador.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el inventario por sucursal?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('canal','demo','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las plazas y corredores de mayoreo de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En plaza eso no alcanza, porque se vende por bulto, se fía de palabra y el local trabaja a un ritmo que no espera a que alguien capture nada.
Tenemos una suite hecha para locales de plaza y mayoreo. Lo que resuelve:
· Venta por pieza, docena y bulto, cada una con su precio.
· Crédito y saldo por cliente, con quién debe qué y desde cuándo.
· Cobro rápido en mostrador, sin trabar la fila en temporada.
· Inventario por talla y color de lo que hay para surtir hoy.
· Qué cliente compra qué y cada cuánto, para saber a quién llamar.
· Corte de caja del local, cuadrado al cerrar.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el control de lo fiado?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true),
('canal','diagnostico','email',0,'presenta','por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las plazas y corredores de mayoreo de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Y no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]
· {{senal}}.[[/si]][[si sucursales]]
· {{sucursales}} sucursales.[[/si]][[si plataforma]]
· Su tienda en línea está en {{plataforma}}.[[/si]]
Por eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En plaza eso no alcanza, porque se vende por bulto, se fía de palabra y el local trabaja a un ritmo que no espera a que alguien capture nada.
Tenemos una suite hecha para locales de plaza y mayoreo. Lo que resuelve:
· Venta por pieza, docena y bulto, cada una con su precio.
· Crédito y saldo por cliente, con quién debe qué y desde cuándo.
· Cobro rápido en mostrador, sin trabar la fila en temporada.
· Inventario por talla y color de lo que hay para surtir hoy.
· Qué cliente compra qué y cada cuánto, para saber a quién llamar.
· Corte de caja del local, cuadrado al cerrar.
Y esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.
Si prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234
¿Se lo muestro, o le paso primero cómo se ve el control de lo fiado?','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas',true)
on conflict do nothing;