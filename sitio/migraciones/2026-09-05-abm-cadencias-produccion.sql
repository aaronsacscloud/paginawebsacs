insert into abm_cadencias (nombre,giro,ruta,descripcion) values
('Fabricantes y talleres · demo','fabricantes','demo','Cadencia de 7 correos escrita para el giro'),
('Fabricantes y talleres · diagnóstico','fabricantes','diagnostico','Cadencia de 7 correos escrita para el giro'),
('Distribuidores y showroom · demo','distribuidores','demo','Cadencia de 7 correos escrita para el giro'),
('Distribuidores y showroom · diagnóstico','distribuidores','diagnostico','Cadencia de 7 correos escrita para el giro');
insert into abm_plantillas (giro,canal,nombre,orden,asunto,cuerpo,formato,objetivo,ruta) values
('fabricantes','email','fabricantes demo · correo 1',1,'lo que trae a medio hacer','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y le escribo por algo de planta: en una fábrica hay tres inventarios al mismo tiempo. La tela y los avíos, lo que ya está cortado y en proceso, y el producto terminado en bodega.

Hacemos software de inventario y punto de venta para negocios de moda, con órdenes de producción y listas de precio por canal.

¿Hoy saben cuánto vale lo que traen a medio hacer?','texto','abrir con los tres inventarios y ofrecer la demo','demo'),
('fabricantes','email','fabricantes demo · correo 2',2,'la corrida no se repite','En fábrica el error no se corrige comprando otra vez.

Se tiende la tela, se corta una curva de tallas y colores, y de ahí sale lo que sale. Si se cortaron de más las tallas de las orillas, esas piezas se quedan. Y si se cortó de menos la talla que sí pedían, no hay resurtido: para repetirla hay que tender otra vez, con otro lote de tela que ya no da el mismo tono.

Encima corre el calendario: lo que no se colocó en la feria se queda un año en el rack.

¿Cómo deciden hoy la curva de la siguiente corrida?','texto','enseñar el dolor mecánico de producir por corrida','demo'),
('fabricantes','email','fabricantes demo · correo 3',3,'de la tela a la caja','Le cuento cómo funciona por dentro, para que juzgue si le sirve.

La tela y los avíos se llevan en su unidad, metros o kilos, por rollo y por lote. Cuando se abre una orden de producción esos insumos salen del almacén y entran a proceso; cuando la corrida se cierra, entra producto terminado por modelo, talla y color, con su costo armado desde lo que de verdad se consumió.

Y el mismo artículo se vende a precio distinto según a quién: mayoreo, medio mayoreo, menudeo y sus propios puntos de venta. Cada canal con su lista, sobre el mismo inventario.

¿Cuántas listas de precio manejan hoy?','texto','mostrar cómo se resuelve por dentro: producción y canales','demo'),
('fabricantes','email','fabricantes demo · correo 4',4,'el maestro se lo sabe','La objeción que más oigo en planta es que el cortador y el jefe de producción se lo saben de memoria.

Y es cierto. El que lleva veinte años ahí sabe cuánto rinde cada tendido y qué le debe cada taller. El problema es que esa cuenta vive en una libreta, y una libreta no se cruza: no le dice cuánto dinero trae detenido en proceso, ni qué corrida salió cara y cuál dejó.

No le digo que su Excel esté mal hecho. Le digo que se llena después, cuando la corrida ya cerró y ya no hay nada que corregir.

¿Quién lleva hoy la cuenta de los insumos?','texto','romper la objeción de que la memoria del taller alcanza','demo'),
('fabricantes','email','fabricantes demo · correo 5',5,'costear una corrida a mano','Le dejo un ejercicio que puede hacer esta semana sin comprarme nada.

Tome la última corrida cerrada, una sola. Anote los metros de tela que salieron del almacén, los avíos, lo que le pagó al taller por prenda cosida y las piezas buenas que entraron a bodega. Divida el total entre esas piezas: ese es el costo real de la corrida, no el que trae en la lista.

Ahora compárelo contra el precio con el que la está vendiendo, y ábralo por talla. Casi siempre las tallas de las orillas se hicieron con la misma tela, se venden peor y terminan rematadas.

Ese número mueve su precio de mayoreo más que cualquier negociación con el cliente.

¿Le sale ese cálculo con lo que tiene anotado hoy?','texto','dar un método útil aunque no compren','demo'),
('fabricantes','email','fabricantes demo · correo 6',6,'cincuenta claves, 1.2 millones','Le paso un caso, sin adornos.

En un cliente nuestro, cadena de moda, revisamos nada más 50 claves de producto y encontramos 1.2 millones de pesos mal repartidos entre su centro de distribución y sus tiendas. Mercancía ya hecha y ya pagada, sentada donde no la pedían.

Del lado de fábrica eso pasa antes y pesa más, porque el dinero se detiene tres veces: en la tela comprada para una corrida que no se ha cortado, en lo que está en proceso en los talleres, y en el terminado de la temporada pasada que ya nada más se remata.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propios modelos, su curva y sus listas de precio, y usted juzga.

¿Le acomoda algún día de esta semana?','texto','contar el caso real y proponer la demo','demo'),
('fabricantes','email','fabricantes demo · correo 7',7,'lo dejo hasta aquí','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no me quiero volver ruido, así que aquí lo dejo.

Le insistí porque en producción los errores no se ven en la caja, se ven un año después. La tela que se compró para una corrida que no se cortó, las tallas que sobraron de una curva mal armada, el terminado que no se colocó en la feria. Todo eso ya se pagó y sigue en la bodega.

Si algún día quieren ver la tela, lo que está en proceso y el terminado en una sola pantalla, con el costo real de cada corrida, me escribe y lo vemos en veinte minutos. No le vuelvo a insistir.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('fabricantes','email','fabricantes diagnostico · correo 1',1,'quince minutos con sus números','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]]. En fábrica el dinero se detiene en tres lugares a la vez: la tela y los avíos, lo que está cortado en los talleres y el terminado de la temporada pasada.

Hacemos inventario y punto de venta para moda. Antes de venderle nada hacemos un diagnóstico gratis: con su información, en 15 minutos le decimos cuánto dinero trae detenido y en cuál de los tres.

¿Le agendo esos 15 minutos esta semana?','texto','abrir con los tres inventarios y ofrecer el diagnóstico','diagnostico'),
('fabricantes','email','fabricantes diagnostico · correo 2',2,'dónde se detiene el dinero','Cuando digo dinero detenido no hablo de lo que no se vende. Hablo de lo que ya pagó y todavía no regresa.

En una fábrica son tres montones distintos. Tela y avíos comprados para una corrida que aún no se corta, o que ya cambió de temporada. Piezas cortadas que están en un taller y que nadie sabe cuánto valen así, a medias. Y producto terminado que salió bien pero no se colocó en la feria.

Los tres se pagaron con el mismo dinero y ninguno aparece junto en un reporte.

¿Hoy pueden ver esos tres montones el mismo día?','texto','explicar el dinero detenido en los tres inventarios','diagnostico'),
('fabricantes','email','fabricantes diagnostico · correo 3',3,'cincuenta claves, 1.2 millones','Le paso un caso, sin adornos.

Un cliente nuestro, cadena de moda con centro de distribución. Tomamos 50 claves de producto, nada más 50, y cruzamos existencia contra venta por talla y por punto. Salieron 1.2 millones de pesos mal repartidos: mercancía ya fabricada y ya pagada, sentada donde no la pedían.

Nadie se robó nada ni produjo de más. El dinero estaba completo, nada más en el lugar equivocado.

En su caso el cruce se hace sobre lo suyo: cuánta tela está comprometida con corridas que no se han cortado, y cuánto terminado lleva más de una temporada parado. Eso sale del diagnóstico de 15 minutos, con sus datos.

¿Cuántas claves activas manejan entre tela y terminado?','texto','contar el caso real llevado a la fábrica','diagnostico'),
('fabricantes','email','fabricantes diagnostico · correo 4',4,'no necesito su base','Dos cosas que me contestan seguido, y las dos son justas.

La primera: no me van a pasar su información. No hace falta toda. Con la existencia de tela por clave, el terminado por modelo y talla, y la venta de tres meses, en Excel, sin nómina ni datos de clientes, alcanza. Firmamos confidencialidad si lo prefiere.

La segunda: ya tienen sistema y contador. Casi siempre sí, y el contador le dice cuánto tiene en inventario en total. Lo que no le dice es en cuál de los tres montones está detenido, ni qué corrida se comió el margen.

Si después de verlo se quedan con lo suyo, el diagnóstico se los queda igual.

¿Le parece si lo hacemos con esos archivos?','texto','romper la objeción de datos y de sistema propio','diagnostico'),
('fabricantes','email','fabricantes diagnostico · correo 5',5,'cómo medirlo sin nosotros','Por si nunca nos contratan, le dejo el método para hacerlo a mano.

Saque tres listas. Una: tela y avíos en almacén, con la fecha en que entró cada clave. Dos: lo que está hoy en cada taller, en piezas cortadas. Tres: producto terminado por modelo y talla, con la temporada en que se hizo.

Marque en la primera lo que lleva más de seis meses sin tocarse, y en la tercera lo que lleva más de una temporada. Sume el costo de las dos marcas.

Ese número es el dinero que ya salió de su cuenta y todavía no vuelve. Casi siempre es más grande de lo que la gente calcula, y casi siempre está en tela, no en terminado.

¿Quiere que le mande el formato de esas tres listas?','texto','regalar el método completo','diagnostico'),
('fabricantes','email','fabricantes diagnostico · correo 6',6,'qué sale en quince minutos','Para que sepa qué está aceptando, esto es lo que sale de los 15 minutos.

Uno: cuánto dinero trae detenido, separado en tela, proceso y terminado, en pesos de costo. Dos: las claves de tela que ya no se van a usar en esta temporada. Tres: los modelos donde la curva quedó rota y solo quedan tallas de orilla, que son los que hay que rematar o volver a cortar antes de la próxima feria. Cuatro: si su lista de mayoreo aguanta el costo real de la corrida o va a la baja sin que nadie lo note.

Sale en una hoja, se lo explico en llamada y se queda con el archivo, contraten o no.

¿Quién de su equipo puede sacar la existencia y la venta de tres meses?','texto','decir exactamente qué entrega el diagnóstico','diagnostico'),
('fabricantes','email','fabricantes diagnostico · correo 7',7,'cierro el tema','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no me quiero volver ruido, así que aquí lo cierro.

Le insistí porque en producción esto no lo enseña ningún reporte. El estado de resultados le dice si ganó o perdió, pero no le dice que la tela que compró en enero sigue en el rack, que hay piezas cortadas en dos talleres que nadie ha contado, ni que la corrida que más vendió fue la que menos dejó.

El diagnóstico sigue en pie sin costo cuando ustedes quieran, en temporada baja o después de la feria. Me escribe y lo agendamos.

¿Lo dejamos así o le toco la puerta en unos meses?','texto','cerrar con dignidad','diagnostico'),
('distribuidores','email','distribuidores demo · correo 1',1,'el pedido de la temporada','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y le escribo por algo propio de su negocio: la boutique aparta en el showroom y la entrega es meses después. Entre una cosa y la otra alguien tiene que saber qué está comprometido, qué llegó y qué falta por entregar.

Hacemos software de inventario y punto de venta para moda, con pedidos anticipados, consignación y lista de precio por cliente.

¿Hoy el pedido del showroom lo llevan en papel, en Excel o en sistema?','texto','abrir con el pedido anticipado y ofrecer la demo','demo'),
('distribuidores','email','distribuidores demo · correo 2',2,'de quién es esa pieza','En su giro hay mercancía de la que ni siquiera es claro de quién es.

La que dejó a consignación en una boutique sigue siendo suya hasta que se venda, pero ya no está en su bodega. La que a usted le dieron a consignación no es suya, pero está en su showroom. Y la del pedido anticipado no está en ningún lado todavía: está comprometida con una clienta que la va a reclamar en tres meses.

Si esos tres montones viven en el mismo archivo de existencias, tarde o temprano se promete dos veces la misma pieza.

¿Cómo separan hoy lo suyo de lo que traen a consignación?','texto','enseñar el dolor de consignación y pedido anticipado','demo'),
('distribuidores','email','distribuidores demo · correo 3',3,'cómo queda armado por dentro','Le cuento cómo funciona por dentro, para que juzgue si le sirve.

El pedido del showroom se levanta con fecha de entrega: esa mercancía queda comprometida con esa boutique y ya no se le ofrece a otra, aunque físicamente no haya llegado. Cuando entra el embarque se surte contra esos pedidos, y queda claro qué salió completo y qué quedó pendiente.

La consignación vive en su propio almacén, a nombre de la boutique donde está, así que en cualquier momento sabe qué pieza tiene cada una y qué le debe.

Y cada cliente trae su lista de precio y sus condiciones de crédito.

¿Con cuántas boutiques trabajan hoy?','texto','mostrar cómo se resuelve pedido, consignación y precio por cliente','demo'),
('distribuidores','email','distribuidores demo · correo 4',4,'llevamos años con excel','La objeción que más oigo es que llevan años así y les funciona.

Y es cierto que funciona: el pedido se levanta en la libreta del showroom, la consignación se lleva de confianza y la cobranza se acuerda por teléfono. Con veinte clientas se puede. El problema aparece con doscientas: la misma pieza prometida a dos, una boutique con ocho meses de mercancía suya que nadie ha ido a recoger, y una temporada que abre sin saber qué dejó la anterior.

No le digo que capturen mal. Le digo que capturan bien y aun así no pueden contestar rápido qué le deben y quién.

¿Quién lleva hoy la cuenta de la consignación?','texto','romper la objeción de que el método actual alcanza','demo'),
('distribuidores','email','distribuidores demo · correo 5',5,'cierre de la temporada pasada','Le dejo un ejercicio que puede hacer esta semana sin comprarme nada.

Tome la temporada pasada y arme tres columnas por boutique: lo que apartó en el showroom, lo que de verdad se le entregó y lo que pagó. Casi nunca son el mismo número, y la diferencia entre la primera y la segunda es venta que ya tenía cerrada y se cayó por falta de entrega o de seguimiento.

Ahora agregue una cuarta columna: cuántas piezas suyas siguen en su piso a consignación, y desde cuándo. Esa es mercancía suya trabajando para alguien más.

Con esas cuatro columnas ya sabe a quién visitar primero la próxima temporada y a quién no conviene dejarle más piezas.

¿Puede sacar hoy lo apartado contra lo entregado por cliente?','texto','dar un método útil aunque no compren','demo'),
('distribuidores','email','distribuidores demo · correo 6',6,'cincuenta claves, 1.2 millones','Le paso un caso y una propuesta.

En un cliente nuestro, cadena de moda, revisamos nada más 50 claves de producto y encontramos 1.2 millones de pesos mal repartidos entre su centro de distribución y sus tiendas. Mercancía ya comprada y ya pagada, sentada donde no la pedían. Entre su bodega y las boutiques donde deja consignación pasa lo mismo con otro nombre.

Y va la propuesta: además de que ustedes lo usen, a sus boutiques les damos el mismo sistema con precio especial por venir de ustedes, y de cada cuenta que se queda les corresponde una comisión mientras siga activa. Ustedes no operan nada, y una boutique que compra con números le compra más seguido.

¿Le acomoda una llamada de veinte minutos esta semana?','texto','contar el caso real, abrir el convenio y proponer la demo','demo'),
('distribuidores','email','distribuidores demo · correo 7',7,'lo dejo hasta aquí','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no me quiero volver ruido, así que aquí lo dejo.

Le insistí porque el suyo es de los negocios donde el inventario casi nunca está donde uno lo ve. Está comprometido en un pedido que se entrega en tres meses, o está en el piso de una boutique a consignación, o está en una factura que todavía no se cobra. Nada de eso cabe en una lista de existencias.

Si algún día quieren ver pedidos anticipados, consignación y cobranza en una sola pantalla, o revisar lo del convenio con sus boutiques, me escribe. No le vuelvo a insistir.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad dejando abierto el convenio','demo'),
('distribuidores','email','distribuidores diagnostico · correo 1',1,'lo que dejó la temporada','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]]. En distribución el dinero se esconde en tres lados: lo comprometido en pedidos que aún no se entregan, lo que está a consignación en piso ajeno y lo que ya se entregó y no se ha cobrado.

Hacemos inventario y punto de venta para moda. Antes de venderle nada hacemos un diagnóstico gratis: con su información, en 15 minutos le decimos cuánto trae detenido y en dónde.

¿Le agendo esos 15 minutos esta semana?','texto','abrir con los tres escondites del dinero y ofrecer el diagnóstico','diagnostico'),
('distribuidores','email','distribuidores diagnostico · correo 2',2,'dinero que no está aquí','Cuando digo dinero detenido no hablo de lo que no se vende. Hablo de lo que ya pagó y todavía no regresa.

En su caso casi nunca está en su bodega. Está en las cajas que salieron a consignación y llevan meses en el piso de alguien más. Está en el saldo de las boutiques que se atrasaron. Y está en el catálogo de la temporada que se acabó, que ya no se coloca a precio de lista.

Los tres se pagaron con el mismo dinero y ninguno aparece junto en un reporte de existencias.

¿Hoy pueden ver consignación y cobranza el mismo día?','texto','explicar el dinero detenido fuera de su bodega','diagnostico'),
('distribuidores','email','distribuidores diagnostico · correo 3',3,'cincuenta claves, 1.2 millones','Le paso un caso, sin adornos.

Un cliente nuestro, cadena de moda con centro de distribución. Tomamos 50 claves de producto, nada más 50, y cruzamos existencia contra venta por talla y por punto. Salieron 1.2 millones de pesos mal repartidos: mercancía ya comprada y ya pagada, sentada donde no la pedían.

Lo suyo es lo mismo con otro nombre. Lo que dejó a consignación en una boutique que no lo mueve, en otra se vende en tres semanas, y usted se entera cuando pasa a recoger a fin de temporada.

Eso es lo que sale del diagnóstico de 15 minutos, con sus datos en lugar de los de él.

¿Cuántas boutiques traen mercancía suya en este momento?','texto','contar el caso real llevado a la consignación','diagnostico'),
('distribuidores','email','distribuidores diagnostico · correo 4',4,'no necesito su cartera','Dos cosas que me contestan seguido, y las dos son justas.

La primera: no me van a pasar su información de clientes. No hace falta. Con la existencia por clave, lo entregado en los últimos tres meses y una lista de qué hay en consignación y desde cuándo, alcanza. Sin nombres si lo prefiere, con clave de cliente, y firmamos confidencialidad.

La segunda: ya tienen sistema o contador. Casi siempre sí, y le dicen cuánto vendió y cuánto le deben. Lo que no le dicen es qué pieza suya lleva ocho meses parada en el piso de quién.

Si después de verlo se quedan con lo suyo, el diagnóstico se los queda igual.

¿Le parece si lo hacemos con esos archivos?','texto','romper la objeción de datos y de sistema propio','diagnostico'),
('distribuidores','email','distribuidores diagnostico · correo 5',5,'cómo medirlo sin nosotros','Por si nunca nos contratan, le dejo el método para hacerlo a mano.

Arme una tabla con una fila por boutique y cuatro columnas: piezas suyas que tiene a consignación, desde qué fecha, cuánto le compró la temporada pasada y cuánto le debe hoy.

Ordénela por la fecha. Arriba van a quedar las boutiques que llevan más tiempo con mercancía suya sin moverla, y ahí está su dinero dormido, pieza por pieza.

Después ordénela por lo que le deben y va a ver que las dos listas se parecen mucho. Quien no mueve la mercancía tampoco paga, y esa mercancía conviene recogerla y mandarla a donde sí se vende.

¿Quiere que le mande el formato de esa tabla?','texto','regalar el método completo','diagnostico'),
('distribuidores','email','distribuidores diagnostico · correo 6',6,'qué sale en quince minutos','Para que sepa qué está aceptando, esto es lo que sale de los 15 minutos.

Uno: cuánto dinero trae detenido, separado en bodega, consignación y cobranza, en pesos de costo. Dos: qué boutiques tienen mercancía suya sin movimiento y desde cuándo, para recogerla a tiempo. Tres: qué claves del catálogo de temporada se quedaron sin colocar. Sale en una hoja y se queda con el archivo, contraten o no.

Y algo que le puede servir todavía más: ese mismo diagnóstico se lo hacemos a sus boutiques a nombre de ustedes, sin costo. La que quiera el sistema entra con precio especial por venir de ustedes, y a ustedes les toca comisión.

¿Quién de su equipo puede sacar la existencia y lo entregado de tres meses?','texto','decir qué entrega el diagnóstico y extenderlo a sus boutiques','diagnostico'),
('distribuidores','email','distribuidores diagnostico · correo 7',7,'cierro el tema','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no me quiero volver ruido, así que aquí lo cierro.

Le insistí porque en distribución esto no lo enseña ningún reporte. El estado de cuenta le dice quién le debe y el inventario le dice qué hay en su bodega. Ninguno de los dos le dice qué piezas suyas llevan ocho meses en el piso de una boutique que ya no las va a vender, ni qué se apartó en el showroom y nunca se entregó.

El diagnóstico sigue en pie sin costo cuando ustedes quieran, antes de abrir la próxima temporada o al cerrar el año. Me escribe y lo agendamos.

¿Lo dejamos así o le toco la puerta en unos meses?','texto','cerrar con dignidad','diagnostico'),
('fabricantes','whatsapp','abre',1,null,'Buen día. Le escribo a {{nombre}} de parte de Sacs, sistema mexicano de inventario y punto de venta para moda. Lo nuestro es llevar juntas la tela, la producción y el producto terminado. ¿Con quién puedo verlo y por dónde?','texto','WhatsApp · abre','ambas'),
('fabricantes','whatsapp','sigue',2,null,'Vuelvo una vez y ya. En fábrica el dinero se detiene en tres lados: la tela comprada, las piezas que están en el taller y el terminado de la temporada pasada. Y la corrida que se cortó mal ya no se repite igual. ¿Me pasa el correo de quien lleva producción?','texto','WhatsApp · sigue','ambas'),
('fabricantes','whatsapp','cierra',3,null,'Con esta cierro y no insisto más. Si algún día quieren ver la tela, lo que está en proceso y el terminado en una sola pantalla, con el costo real de cada corrida, aquí queda mi número. Gracias.','texto','WhatsApp · cierra','ambas'),
('distribuidores','whatsapp','abre',1,null,'Buen día. Le escribo a {{nombre}} de parte de Sacs, sistema mexicano de inventario y punto de venta para moda. Nos buscan distribuidores por el pedido del showroom que se entrega meses después. ¿Con quién puedo verlo y por dónde?','texto','WhatsApp · abre','ambas'),
('distribuidores','whatsapp','sigue',2,null,'Insisto una vez y ya. Lo que más nos piden en su giro es saber qué pieza está comprometida en un pedido anticipado y cuál está a consignación en el piso de cada boutique, sin hablarle a todas. ¿Me pasa el correo de quien lleva los pedidos?','texto','WhatsApp · sigue','ambas'),
('distribuidores','whatsapp','cierra',3,null,'Con esta ya no le insisto. Si algún día quieren ver pedidos, consignación y cobranza en un solo lugar, o platicar del convenio para sus boutiques, aquí sigue mi número. Gracias por su tiempo.','texto','WhatsApp · cierra','ambas');
insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select c.id, (array[1,3,7,11,16,22,30])[p.orden], p.orden, 'email', p.id, true, p.objetivo
from abm_cadencias c join abm_plantillas p on p.giro=c.giro and p.ruta=c.ruta and p.canal='email'
where c.giro in ('fabricantes','distribuidores')
  and not exists (select 1 from abm_pasos x where x.cadencia_id=c.id and x.orden=p.orden);