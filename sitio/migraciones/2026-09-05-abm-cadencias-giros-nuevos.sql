insert into abm_cadencias (nombre,giro,ruta,descripcion) values
('Deportiva · demo','deportiva','demo','Cadencia de 7 correos escrita para el giro'),
('Deportiva · diagnóstico','deportiva','diagnostico','Cadencia de 7 correos escrita para el giro'),
('Sublimado · demo','sublimado','demo','Cadencia de 7 correos escrita para el giro'),
('Sublimado · diagnóstico','sublimado','diagnostico','Cadencia de 7 correos escrita para el giro'),
('Disfraces y ceremonia · demo','disfraces','demo','Cadencia de 7 correos escrita para el giro'),
('Disfraces y ceremonia · diagnóstico','disfraces','diagnostico','Cadencia de 7 correos escrita para el giro'),
('Outlets y saldos · demo','outlets','demo','Cadencia de 7 correos escrita para el giro'),
('Outlets y saldos · diagnóstico','outlets','diagnostico','Cadencia de 7 correos escrita para el giro'),
('Relojerías y ópticas · demo','relojerias','demo','Cadencia de 7 correos escrita para el giro'),
('Relojerías y ópticas · diagnóstico','relojerias','diagnostico','Cadencia de 7 correos escrita para el giro');
insert into abm_plantillas (giro,canal,nombre,orden,asunto,cuerpo,formato,objetivo,ruta) values
('deportiva','email','deportiva demo · correo 1',1,'la talla que ya no hay','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y le escribo por algo muy de su mostrador: en deporte el cliente llega sabiendo el modelo exacto, el año y su talla. O la tiene usted en ese momento, o se va con otro.

Hacemos software de inventario y punto de venta para negocios de moda y deporte, con el control por modelo, talla y color.

¿Hoy pueden ver desde el mostrador si otra de sus tiendas tiene esa talla?','texto','abrir con algo cierto y ofrecer la demo','demo'),
('deportiva','email','deportiva demo · correo 2',2,'el modelo que ya no existe','En deporte la mercancía tiene fecha de caducidad, aunque no se eche a perder.

Un tenis de running vive una temporada. Cuando se acaban el 26 y el 27, que es donde está la venta, el modelo sigue apareciendo con existencia porque quedan las orillas de la curva. Y ya no se resurte: la marca sacó el del año siguiente y el suyo dejó de existir.

Ahí se juntan las dos cosas caras: no tener lo que le piden y tener parado lo que nadie quiere, con un ticket que en bici o en golf no es de quinientos pesos.

¿Cómo deciden hoy cuándo rematar un modelo descontinuado?','texto','enseñar el dolor mecánico del giro','demo'),
('deportiva','email','deportiva demo · correo 3',3,'el mismo par, dos precios','Le cuento cómo funciona por dentro, para que juzgue si le sirve.

Cada modelo se da de alta una vez y adentro se abre en tallas y colores. Desde el mostrador, quien atiende ve si esa talla está en su tienda, en otra o en bodega, y puede pedirla o apartarla ahí mismo con el cliente enfrente.

Y si venden mayoreo a clubes y equipos, y menudeo en piso, no son dos inventarios: es el mismo, con dos listas de precio. Cada venta se descuenta de donde de verdad salió.

¿Manejan mayoreo y menudeo sobre el mismo almacén?','texto','mostrar cómo se resuelve por dentro','demo'),
('deportiva','email','deportiva demo · correo 4',4,'lo que sabe el vendedor','La objeción que más oigo en tiendas de deporte es que el equipo se sabe el piso de memoria.

Y es cierto: quien lleva años ahí sabe qué modelo entró, en qué tallas y quién lo pidió. El problema es que esa memoria no se traspasa. El sábado que está el nuevo, entra un cliente que sabe más que él, pregunta por un modelo con nombre y año, y la respuesta es «déjeme reviso» o de plano un no.

No le digo que su Excel esté mal hecho. Le digo que no alcanza a contestar en el mostrador, con el cliente ahí parado.

¿Quién lleva hoy el inventario?','texto','romper la objeción del control actual','demo'),
('deportiva','email','deportiva demo · correo 5',5,'las tallas de los extremos','Le dejo un ejercicio que puede hacer esta semana sin comprarme nada.

Tome los diez modelos con más piezas en piso y arme una tabla: las tallas en las filas, sus tiendas en las columnas. En cada celda ponga dos números, piezas en existencia y piezas vendidas en los últimos noventa días.

Van a saltar dos cosas. Modelos donde el centro de la curva está en cero y solo quedan las orillas: ese ya no vende aunque el reporte diga que tiene existencia, y si está descontinuado hay que rematarlo hoy, no en enero. Y tallas que en una tienda llevan tres meses quietas y en otra se acabaron el mes pasado.

Con eso solo ya sabe qué mover y qué rematar.

¿Puede sacar existencia por talla y por tienda de un jalón?','texto','dar algo útil aunque no compren','demo'),
('deportiva','email','deportiva demo · correo 6',6,'mercancía en la tienda equivocada','Le paso un caso, sin adornos.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la gente la pedía.

En deporte eso pesa más por el ticket. Una bici, un palo o un par de montaña no son piezas de quinientos pesos, y con la temporada corriendo cada una parada en el lugar equivocado es dinero grande dormido.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propios modelos y tallas, y usted juzga si le sirve.

¿Le acomoda algún día de esta semana?','texto','contar el caso real y proponer la demo','demo'),
('deportiva','email','deportiva demo · correo 7',7,'lo dejo hasta aquí','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no me quiero volver ruido, así que aquí lo dejo.

Le insistí porque el deporte es de los giros donde el error se paga dos veces. Una, cuando el cliente que venía decidido no encuentra su talla y se va sin regatear, porque él ya sabía qué quería. Y otra al final de la temporada, cuando lo que sobró ya no se resurte ni se devuelve, nada más se remata.

Si algún día quieren ver el inventario de todas sus tiendas en una pantalla, o abren otro punto, me escribe y lo vemos en veinte minutos. No le vuelvo a insistir.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('deportiva','email','deportiva diagnostico · correo 1',1,'sus tiendas y las tallas','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]], con {{sucursales}} puntos de venta[[/si]]. En deporte, con varias tiendas, el pleito ya no es cuánto compraron, es en cuál quedó cada talla antes de que se acabe la temporada.

Hacemos inventario y punto de venta para moda y deporte. Antes de venderle nada hacemos un diagnóstico gratis: con su información, en 15 minutos le decimos cuánto dinero trae parado y cuánto se le va en faltantes.

¿Le agendo esos 15 minutos esta semana?','texto','abrir con sus sucursales y ofrecer el diagnóstico','diagnostico'),
('deportiva','email','deportiva diagnostico · correo 2',2,'dinero parado con ticket alto','Cuando digo dinero parado no hablo de lo que no se vende. Hablo de mercancía que sí se vende, pero está en la tienda equivocada.

Con un local eso se ve a ojo. Con varios, no: la M sobra en uno, falta en el otro y en el tercero nadie preguntó. Cada tienda cree que le fue mal con ese modelo y entre todas tenían la curva completa, mal repartida.

En deporte el problema trae reloj. La temporada dura unos meses y el modelo se descontinúa: lo que no se movió a tiempo ya no se resurte ni se devuelve, se remata.

¿Hoy pueden cruzar talla contra tienda sin armarlo a mano?','texto','explicar dinero parado y por qué se multiplica','diagnostico'),
('deportiva','email','deportiva diagnostico · correo 3',3,'cincuenta modelos, 1.2 millones','Le paso un caso, sin adornos.

Un cliente nuestro, cadena de moda con centro de distribución. Tomamos 50 modelos, nada más 50, y cruzamos existencia contra venta por talla y por tienda. Salieron 1.2 millones de pesos mal repartidos: mercancía ya comprada y pagada, sentada donde no la pedían.

Nadie se robó nada ni compró de más. El dinero estaba completo, nada más en el lugar equivocado, que con ticket alto y temporada corta es lo mismo que no tenerlo.

Eso es exactamente lo que sale del diagnóstico de 15 minutos, con sus datos en lugar de los de él.

¿Con cuántos modelos activos trabajan hoy?','texto','contar el caso real','diagnostico'),
('deportiva','email','deportiva diagnostico · correo 4',4,'no necesito su base','Dos cosas que me contestan seguido, y las dos son justas.

La primera: no me van a pasar su base. No hace falta. Con la existencia por talla y la venta de tres meses, en Excel, sin costos ni datos de clientes, alcanza. Firmamos confidencialidad si lo prefiere.

La segunda: ya tienen sistema. Casi siempre sí, y casi siempre guarda bien lo que pasó. El diagnóstico no viene a reemplazarlo, viene a leer lo que ya tienen adentro con un cruce que su sistema no hace solo: talla contra tienda contra venta, con la temporada encima.

Si después de verlo se quedan con lo suyo, el diagnóstico se los queda igual.

¿Le parece si lo hacemos con esos dos archivos?','texto','romper la objeción de datos y de sistema propio','diagnostico'),
('deportiva','email','deportiva diagnostico · correo 5',5,'cómo medirlo sin nosotros','Por si nunca nos contratan, le dejo el método para hacerlo a mano.

Escoja diez modelos de los que más mueve. Arme una tabla con las tallas en las filas y sus tiendas en las columnas, y en cada celda ponga piezas en existencia y piezas vendidas en los últimos noventa días.

Después marque dos tipos de celda. Las que tienen existencia y cero venta en noventa días: eso es dinero dormido, y en un modelo descontinuado es dinero que ya no va a despertar solo. Y las que tienen venta constante y existencia en cero: eso es venta que se está perdiendo hoy.

Sume el costo de las primeras. Ese número suele espantar, y es el mismo que le entregaríamos nosotros, nada más que a mano y con diez modelos.

¿Quiere que le mande el formato de esa tabla?','texto','dar el método gratis','diagnostico'),
('deportiva','email','deportiva diagnostico · correo 6',6,'qué sale en quince minutos','Para que sepa qué está aceptando, esto es lo que sale de los 15 minutos.

Uno: cuánto dinero tienen parado en piezas sin movimiento, en pesos de costo, tienda por tienda. Dos: la lista de traspasos que convendría hacer mañana, con modelo, talla, origen y destino. Tres: los modelos donde la curva ya se rompió y solo quedan orillas, que son los que hay que rematar antes de que cierre la temporada. Cuatro: qué se está perdiendo por faltantes en las tallas que sí piden.

Sale en una hoja, se lo explico en llamada y se queda con el archivo, contraten o no.

De su lado solo necesito existencia por talla y venta de tres meses.

¿Quién de su equipo puede sacar esos dos archivos?','texto','decir exactamente qué entrega el diagnóstico','diagnostico'),
('deportiva','email','deportiva diagnostico · correo 7',7,'cierro el tema','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no me quiero volver ruido, así que aquí lo cierro.

Le insistí porque en deporte este problema pega más fuerte que en cualquier otro giro de moda: la mercancía está completa, ya se pagó, el cliente llega decidido y aun así se va sin su talla. No es un problema de compras, es de reparto, y no sale en ningún reporte estándar porque hay que cruzar dos que casi nadie cruza.

El diagnóstico sigue en pie sin costo cuando ustedes quieran, en temporada baja o al cerrar el año. Me escribe y lo agendamos.

¿Lo dejamos así o le toco la puerta en unos meses?','texto','cerrar con dignidad','diagnostico'),
('sublimado','email','sublimado demo · correo 1',1,'los dieciocho jerseys del sábado','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y le escribo por algo muy de su taller: un equipo pide dieciocho jerseys y por dentro son dieciocho piezas distintas, cada una con su nombre, su número y su talla, todas para la misma fecha.

Hacemos software de inventario y pedidos para negocios de moda. El uniforme personalizado es de los casos más enredados, porque se vende algo que todavía no existe.

¿Cómo llevan hoy esos pedidos por dentro?','texto','abrir con algo cierto y ofrecer la demo','demo'),
('sublimado','email','sublimado demo · correo 2',2,'un nombre mal escrito','En sublimado el inventario no es lo que está en el anaquel. Es lo que ya se prometió y todavía no se imprime.

Un pedido de dieciocho entra como uno solo, pero adentro son dieciocho renglones: nombre, número, talla, corte. Si uno de esos nombres se anotó mal, no se rehace el pedido, se rehace esa pieza, con su tela, su tinta y su tiempo de prensa, casi siempre a dos días de la entrega.

Y abajo está lo único que sí es inventario: la tela. El mismo corte en decenas de colores, y el color que se acabó nadie lo sabe hasta que ya se cortó el resto.

¿Cuántos pedidos traen abiertos ahorita?','texto','enseñar el dolor mecánico del giro','demo'),
('sublimado','email','sublimado demo · correo 3',3,'el pedido renglón por renglón','Le cuento cómo funciona por dentro, para que juzgue si le sirve.

El pedido se abre como un documento con fecha de entrega, y adentro cada jugador es un renglón: nombre, número, talla y color. En una pantalla se ve quién ya está impreso, quién está en costura y quién no ha confirmado. Nadie corta con un renglón abierto.

Abajo va el material: al confirmar el pedido el sistema baja los metros del color que se usó y avisa qué falta comprar antes de empezar, no a medio trabajo.

Y el dinero por cliente: anticipo, saldo y contra qué se entrega.

¿Cuántos uniformes sacan en temporada alta?','texto','mostrar cómo se resuelve por dentro','demo'),
('sublimado','email','sublimado demo · correo 4',4,'el pedido vive en whatsapp','Me lo dicen seguido: los pedidos llegan por WhatsApp, la lista de nombres viene en una foto o en un Excel del entrenador, y así se ha trabajado siempre.

Y funciona, hasta que se junta la temporada. Entonces la lista se queda en un celular, quien la recibió no vino, y el taller imprime con la versión vieja, la que traía dos nombres cambiados. Esa pieza se paga dos veces: la tela y el tiempo.

No le pido que deje de recibir pedidos por WhatsApp. Le pido que esa lista deje de vivir nada más en un chat.

¿Quién captura hoy las listas de los equipos?','texto','romper la objeción del control actual','demo'),
('sublimado','email','sublimado demo · correo 5',5,'cuánto cuesta cada jersey','Le dejo algo que puede hacer esta semana sin comprarme nada.

Agarre los tres uniformes que más vende y cuéntelos por dentro: metros de tela por pieza, tinta y papel, horas de prensa, corte, costura. Y luego cuente aparte el retrabajo, o sea cuántas piezas rehicieron el mes pasado y por qué, con su costo.

Casi siempre salen dos cosas. Que el modelo con más detalle deja menos de lo que se creía, porque las horas se cuentan por encima. Y que lo que se va en rehacer piezas por listas mal capturadas pesa más que cualquier descuento que hayan dado en el año.

Con eso ya sabe qué cotizar distinto y dónde apretar primero.

¿Tienen contadas las piezas que rehicieron el mes pasado?','texto','dar algo útil aunque no compren','demo'),
('sublimado','email','sublimado demo · correo 6',6,'el mismo color, otra bodega','Le comparto algo que encontramos en otro cliente, para que vea de qué tamaño es esto.

Es una cadena de moda. Revisamos nada más 50 modelos y aparecieron 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas: mercancía comprada y pagada que no estaba donde la pedían.

En su giro eso se ve en la tela. El mismo corte en decenas de colores repartido entre varios puntos, y justo el color que se acabó donde entró el pedido está completo en la sucursal de al lado, sin que nadie lo sepa a tiempo.

Si quiere, en veinte minutos le enseño el sistema con sus propias telas y un pedido de equipo cargado.

¿Le acomoda esta semana o la que entra?','texto','contar el caso real y proponer la demo','demo'),
('sublimado','email','sublimado demo · correo 7',7,'hasta aquí le escribo','[[si persona]]{{persona}}, [[/si]]no le quiero seguir llenando la bandeja, así que hasta aquí le escribo.

Le insistí porque el uniforme personalizado es de los negocios que peor la pasan con los sistemas de tienda. Ninguno entiende que cada pieza del pedido es distinta, que la fecha manda sobre todo lo demás y que el inventario de verdad es tela por color, no producto terminado. Casi todos los tratan como si vendieran playeras de talla mediana en un anaquel.

Si algún día se les encima la temporada de torneos, abren otro punto o nada más quieren ver cómo se vería su operación por dentro, me escribe y lo vemos en veinte minutos.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('sublimado','email','sublimado diagnostico · correo 1',1,'la tela repartida entre puntos','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]], con {{sucursales}} puntos[[/si]]. En sublimado el dinero casi nunca está en producto terminado: está en tela, y con varios puntos el mismo corte se reparte en decenas de colores.

Hacemos inventario, pedidos y punto de venta para negocios de moda. Antes de venderle nada hacemos un diagnóstico gratis: con su información, en 15 minutos le decimos cuántos metros trae parados y cuáles se le acaban justo cuando entra el pedido.

¿Le agendo esos 15 minutos esta semana?','texto','abrir con sus sucursales y ofrecer el diagnóstico','diagnostico'),
('sublimado','email','sublimado diagnostico · correo 2',2,'metros parados, metros faltantes','Cuando digo dinero parado no hablo de tela que no sirve. Hablo de tela buena que sí se usa, pero está en el punto equivocado.

Con un taller eso se ve a ojo. Con varios, no: el rojo se acabó donde entró el pedido de veinte, y está completo en el punto de al lado. Nadie se entera hasta que hay que decidir si se compra rollo nuevo o se recorre la entrega.

Y como cada punto compra para no quedarse corto, todos guardan un poco de todo. La suma de esos «poquitos» es el inventario más caro que tienen.

¿Hoy pueden ver los metros por color y por punto en una sola pantalla?','texto','explicar dinero parado y por qué se multiplica','diagnostico'),
('sublimado','email','sublimado diagnostico · correo 3',3,'cincuenta modelos, 1.2 millones','Le paso un caso, sin adornos.

Un cliente nuestro, cadena de moda con centro de distribución. Tomamos 50 modelos, nada más 50, y cruzamos existencia contra consumo, tienda por tienda. Salieron 1.2 millones de pesos mal repartidos: mercancía ya comprada y pagada, sentada donde no la ocupaban.

Nadie se robó nada ni compró de más. El dinero estaba completo, nada más en el lugar equivocado, que cuando hay una fecha de entrega encima es lo mismo que no tenerlo.

Eso es lo que sale del diagnóstico de 15 minutos, con sus colores y sus puntos en lugar de los de él.

¿Cuántos colores manejan hoy del corte que más venden?','texto','contar el caso real','diagnostico'),
('sublimado','email','sublimado diagnostico · correo 4',4,'no necesito su base','Dos cosas que me contestan seguido, y las dos son justas.

La primera: no me van a pasar su base. No hace falta. Con los metros por color y por punto, y el consumo de tres meses, en Excel, sin costos ni datos de clientes, alcanza. Firmamos confidencialidad si lo prefiere.

La segunda: ya tienen sistema, o cada punto lleva el suyo. Casi siempre es así, y ese es justo el asunto: cada uno guarda bien lo suyo y nadie ve la suma. El diagnóstico no viene a reemplazar nada, viene a juntar lo que ya tienen y cruzarlo.

Si después de verlo se quedan con lo suyo, el diagnóstico se los queda igual.

¿Le parece si lo hacemos con esos dos archivos?','texto','romper la objeción de datos y de sistema propio','diagnostico'),
('sublimado','email','sublimado diagnostico · correo 5',5,'cómo medirlo sin nosotros','Por si nunca nos contratan, le dejo el método para hacerlo a mano.

Escoja el corte que más usan. Arme una tabla con los colores en las filas y sus puntos en las columnas, y en cada celda ponga metros en existencia y metros consumidos en los últimos noventa días.

Después marque dos tipos de celda. Las que tienen metros y cero consumo en noventa días: eso es dinero dormido, y en tela con color de moda envejece rápido. Y las que tienen consumo constante y existencia casi en cero: ahí es donde se le van a caer las fechas de entrega el mes que entra.

Sume el costo de las primeras y va a ver por qué insisto. Es el mismo número que le entregaríamos nosotros, nada más que a mano y con un solo corte.

¿Quiere que le mande el formato de esa tabla?','texto','dar el método gratis','diagnostico'),
('sublimado','email','sublimado diagnostico · correo 6',6,'qué sale en quince minutos','Para que sepa qué está aceptando, esto es lo que sale de los 15 minutos.

Uno: cuánto dinero tienen parado en tela sin consumo, en pesos de costo, punto por punto. Dos: la lista de traspasos que convendría hacer mañana, con color, origen y destino. Tres: los colores que se van a acabar antes de que llegue la reposición, para comprarlos ahora y no a media producción. Cuatro: cuánta tela distinta están comprando de más entre todos los puntos.

Sale en una hoja, se lo explico en llamada y se queda con el archivo, contraten o no.

De su lado solo necesito metros por color y por punto, y el consumo de tres meses.

¿Quién de su equipo puede sacar esos dos archivos?','texto','decir exactamente qué entrega el diagnóstico','diagnostico'),
('sublimado','email','sublimado diagnostico · correo 7',7,'cierro el tema','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no me quiero volver ruido, así que aquí lo cierro.

Le insistí porque en su giro el inventario tiene dos caras y casi ningún sistema aguanta las dos: por un lado la tela, que se cuenta en metros y por color, y por el otro el pedido, que se cuenta por jugador y por fecha. Cuando esas dos caras no se hablan, se compra tela que ya se tenía y se cae la entrega de la que faltaba.

El diagnóstico sigue en pie sin costo cuando ustedes quieran, en temporada baja o al cerrar el año. Me escribe y lo agendamos.

¿Lo dejamos así o le toco la puerta en unos meses?','texto','cerrar con dignidad','diagnostico'),
('disfraces','email','disfraces demo · correo 1',1,'dos meses que deciden el año','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y me quedé pensando en su calendario: hay dos temporadas al año que deciden todo, y en esas semanas alguien tiene que saber al momento si una pieza está apartada, en lavandería o todavía puesta.

Hacemos software de inventario y punto de venta para negocios de moda. Cuando la misma pieza se renta y también se vende, es de los casos más enredados.

¿Hoy eso lo llevan en libreta, en Excel o en algún sistema?','texto','abrir con algo cierto y ofrecer la demo','demo'),
('disfraces','email','disfraces demo · correo 2',2,'la pieza que va y vuelve','En su giro el inventario no es cuántas piezas tienen. Es qué días está libre cada pieza y en qué tienda.

Un disfraz que jala puede salir varias veces en una sola temporada. Si una de esas salidas se pierde porque nadie supo que ya volvió de lavandería, ese fin de semana no se recupera: la fecha ya pasó, y la siguiente es hasta el año que entra.

Y encima conviven dos negocios en el mismo catálogo. El vestido de primera comunión que se vende y no vuelve, y la pieza de renta que sale, regresa, se lava y vuelve a salir. Contarlos igual descuadra los dos.

¿Cuántas piezas manejan hoy en renta?','texto','enseñar el dolor mecánico del giro','demo'),
('disfraces','email','disfraces demo · correo 3',3,'una ficha por pieza','Le cuento cómo lo resolvemos, para que juzgue si le sirve.

Cada pieza de renta deja de ser una línea de inventario y se vuelve una ficha con su propio calendario: apartada del 28 al 31, en lavandería el 1, libre el 2. Quien está en mostrador ve ese calendario antes de prometer una fecha, y ve en cuál de sus tiendas está colgada hoy.

Encima va el dinero: anticipo, liquidación, depósito en garantía y a quién se le devuelve. Y lo que se vende, como los vestidos de comunión y bautizo, corre como producto normal por talla, en el mismo catálogo.

¿Cuántas tiendas tienen abiertas hoy?','texto','mostrar cómo se resuelve por dentro','demo'),
('disfraces','email','disfraces demo · correo 4',4,'la libreta no avisa','Muchos negocios como el suyo llevan la temporada en libreta o en un Excel, y aguanta un buen rato. El problema no es que esté mal hecho.

Es que no avisa. No le dice a quien está en mostrador que esa pieza volvió el martes y ya se puede apartar de nuevo. No se acuerda del depósito. No cuadra dos tiendas. Y en octubre, cuando entra gente que no trabajó el año pasado, todo depende de la persona que se sabe el catálogo de memoria.

No le digo que su control esté mal. Le digo que en temporada ya llegó a su tope.

¿Quién lleva hoy los apartados?','texto','romper la objeción del control actual','demo'),
('disfraces','email','disfraces demo · correo 5',5,'cuáles piezas ya se pagaron','Le dejo algo que puede hacer sin comprarme nada, y de paso le sirve para la compra de la temporada que entra.

Saque las rentas del último año y por cada pieza anote dos números: cuántas veces salió y cuánto le costó. Divida lo que dejó entre lo que costó.

El catálogo se le va a partir en tres. Piezas que ya se pagaron tres o cuatro veces y que debería tener repetidas. Piezas que apenas empatan y aun así ocupan lugar, percha y lavandería. Y piezas que llevan dos temporadas colgadas.

Ese solo ejercicio le dice qué volver a comprar antes de octubre y qué rematar ahora que todavía tiene tiempo. No necesita sistema, nada más que las salidas estén registradas.

¿Tiene registradas las salidas de un año completo?','texto','dar algo útil aunque no compren','demo'),
('disfraces','email','disfraces demo · correo 6',6,'mercancía en la tienda equivocada','Un ejemplo de lo que aparece cuando uno se sienta a mirar el inventario en serio.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la gente la pedía.

En su giro eso tiene otra cara. Piezas que se rentarían todos los fines de semana arrumbadas en la tienda donde nadie las pide, tallas de comunión agotadas en una sucursal y completas en otra, y todo eso decidido en dos meses que no perdonan.

Si quiere, en veinte minutos le enseño el sistema con sus propias piezas cargadas, renta y venta juntas.

¿Le acomoda algún día de esta semana?','texto','contar el caso real y proponer la demo','demo'),
('disfraces','email','disfraces demo · correo 7',7,'lo dejo por aquí','[[si persona]]{{persona}}, [[/si]]ya no le escribo más, lo dejo por aquí.

Le insistí porque su giro tiene una trampa que casi nadie ve de fuera: el año se juega en unas cuantas semanas, y en esas semanas no hay tiempo de arreglar nada. Lo que no quedó bien acomodado en agosto se paga en octubre, y lo que no se registró de las rentas se paga cuando toca decidir qué comprar de nuevo.

Si algún día quieren ver el calendario de cada pieza, apartada, en lavandería o libre, y el mostrador vendiendo con eso enfrente, me escribe y lo vemos en veinte minutos. No le vuelvo a insistir.

¿Le escribo antes de la próxima temporada o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('disfraces','email','disfraces diagnostico · correo 1',1,'sus tiendas antes de octubre','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]], con {{sucursales}} sucursales[[/si]].[[si resenas]] Con {{resenas}} reseñas se nota que la temporada les carga fuerte.[[/si]] Con varias tiendas, el pleito no es cuánto compraron, es en cuál quedó cada pieza cuando llega el pico.

Hacemos inventario y punto de venta para moda. Antes de venderle nada hacemos un diagnóstico gratis: con su información, en 15 minutos le decimos cuánto dinero trae parado y cuánto se le va en faltantes.

¿Le agendo esos 15 minutos esta semana?','texto','abrir con sus sucursales y ofrecer el diagnóstico','diagnostico'),
('disfraces','email','disfraces diagnostico · correo 2',2,'dinero parado antes del pico','Cuando digo dinero parado no hablo de lo que no se vende. Hablo de mercancía que sí se vende, pero está en la tienda equivocada.

Con un local eso se ve a ojo. Con varios, no: la talla que se acabó en una está completa en otra, y en la tercera nadie preguntó por ese modelo. Cada tienda cree que le fue mal, y entre todas tenían la curva completa, mal repartida.

En su giro además hay reloj. En temporada no hay tiempo de mover nada: lo que quedó mal acomodado en agosto se queda mal acomodado los dos meses que importan.

¿Hoy pueden ver qué hay en todas sus tiendas sin llamarles una por una?','texto','explicar dinero parado y por qué se multiplica','diagnostico'),
('disfraces','email','disfraces diagnostico · correo 3',3,'cincuenta modelos, 1.2 millones','Le paso un caso, sin adornos.

Un cliente nuestro, cadena de moda con centro de distribución. Tomamos 50 modelos, nada más 50, y cruzamos existencia contra venta, tienda por tienda. Salieron 1.2 millones de pesos mal repartidos: mercancía ya comprada y pagada, sentada donde no la pedían.

Nadie se robó nada ni compró de más. El dinero estaba completo, nada más en el lugar equivocado, que cuando su año se juega en ocho semanas es lo mismo que no tenerlo.

Eso es lo que sale del diagnóstico de 15 minutos, con sus datos en lugar de los de él, y da tiempo de mover antes del pico.

¿Cuántos modelos activos manejan hoy?','texto','contar el caso real','diagnostico'),
('disfraces','email','disfraces diagnostico · correo 4',4,'no necesito su base','Dos cosas que me contestan seguido, y las dos son justas.

La primera: no me van a pasar su base. No hace falta. Con la existencia por tienda y la venta o las salidas de renta de tres meses, en Excel, sin costos ni datos de clientes, alcanza. Firmamos confidencialidad si lo prefiere.

La segunda: ya tienen sistema. Casi siempre sí, y casi siempre guarda bien lo que pasó. El diagnóstico no viene a reemplazarlo, viene a leer lo que ya tienen adentro con un cruce que su sistema no hace solo: qué hay, dónde, y qué se movió de verdad en cada tienda.

Si después de verlo se quedan con lo suyo, el diagnóstico se los queda igual.

¿Le parece si lo hacemos con esos dos archivos?','texto','romper la objeción de datos y de sistema propio','diagnostico'),
('disfraces','email','disfraces diagnostico · correo 5',5,'cómo medirlo sin nosotros','Por si nunca nos contratan, le dejo el método para hacerlo a mano.

Escoja veinte modelos de los que más mueve. Arme una tabla con los modelos en las filas y sus tiendas en las columnas, y en cada celda ponga piezas en existencia y piezas que salieron en la última temporada.

Después marque dos tipos de celda. Las que tienen existencia y cero salida en toda una temporada: eso es dinero dormido un año entero, porque la siguiente oportunidad tarda doce meses en llegar. Y las que se quedaron en cero a media temporada: ahí se ve la venta que se fue mientras la pieza estaba colgada en otra tienda.

Sume el costo de las primeras. Ese número suele espantar, y es el mismo que le entregaríamos nosotros, nada más que a mano.

¿Quiere que le mande el formato de esa tabla?','texto','dar el método gratis','diagnostico'),
('disfraces','email','disfraces diagnostico · correo 6',6,'qué sale en quince minutos','Para que sepa qué está aceptando, esto es lo que sale de los 15 minutos.

Uno: cuánto dinero tienen parado en piezas sin movimiento, en pesos de costo, tienda por tienda. Dos: la lista de traspasos que convendría hacer antes de que arranque la temporada, con modelo, origen y destino. Tres: las piezas de renta que ya se pagaron solas y convendría tener repetidas, y las que llevan dos temporadas sin salir. Cuatro: qué se pierde por faltantes en las tallas que sí piden.

Sale en una hoja, se lo explico en llamada y se queda con el archivo, contraten o no.

De su lado necesito existencia por tienda y el movimiento de la última temporada.

¿Quién de su equipo puede sacar esos dos archivos?','texto','decir exactamente qué entrega el diagnóstico','diagnostico'),
('disfraces','email','disfraces diagnostico · correo 7',7,'cierro el tema','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no me quiero volver ruido, así que aquí lo cierro.

Le insistí porque su negocio no da segundas oportunidades dentro del mismo año.[[si rating]] Y se ve que la gente sale contenta, porque {{rating}} de calificación no se junta solo.[[/si]] Cuando la atención ya está bien, lo que queda por ganar está del lado del inventario: tener la pieza en la tienda donde la piden, el día que la piden.

El diagnóstico sigue en pie sin costo cuando ustedes quieran, y lo suyo es hacerlo con calma, meses antes del pico. Me escribe y lo agendamos.

¿Lo dejamos así o le toco la puerta antes de la próxima temporada?','texto','cerrar con dignidad','diagnostico'),
('outlets','email','outlets demo · correo 1',1,'mover el par hasta venderlo','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y le escribo por algo que en saldos es el negocio mismo: la pieza que no se movió en una tienda se vende en otra, y todo está en enterarse a tiempo y moverla antes de que se enfríe.

Hacemos software de inventario y punto de venta para negocios de moda, con traspasos entre tiendas y precio que baja por antigüedad.

¿Hoy cómo deciden qué mercancía cambian de tienda?','texto','abrir con algo cierto y ofrecer la demo','demo'),
('outlets','email','outlets demo · correo 2',2,'lotes sin curva completa','En saldos la mercancía no llega en curva. Llega como cayó: tres del 25, catorce del 28 y ninguno del 26.

Eso rompe la forma normal de ver el inventario. Un modelo con veinte pares suena bien hasta que se ve que dieciocho son de un solo número. Y cada lote es distinto, así que lo que aprendió del anterior no le sirve para el que entra la semana que viene.

Encima el precio no se queda quieto: lo que no se movió a precio de entrada tiene que bajar, y mientras más tarda en bajar, más caro cuesta el metro cuadrado donde está parado.

¿Cómo llevan hoy los precios cuando la mercancía envejece?','texto','enseñar el dolor mecánico del giro','demo'),
('outlets','email','outlets demo · correo 3',3,'lo mismo, en otra tienda','Le cuento cómo funciona por dentro, para que juzgue si le sirve.

Cada lote entra con lo que de verdad trae, número por número y color por color, sin obligarlo a inventar una curva que no existe. Desde cualquier tienda se ve qué queda en las demás, y el traspaso se hace desde ahí: sale de una, entra en la otra, y las dos quedan cuadradas sin llamadas.

El precio va por lista y por antigüedad: cuando una pieza cumple sus días en piso, se marca para bajar. Y el sistema le dice cuáles ya se pasaron de tiempo, sin que alguien tenga que acordarse.

¿Cuántas tiendas mueven hoy entre ellas?','texto','mostrar cómo se resuelve por dentro','demo'),
('outlets','email','outlets demo · correo 4',4,'cada lote es distinto','La objeción que más oigo en saldos es que su mercancía no se puede sistematizar, porque cada lote llega distinto y nunca se repite.

Y es cierto que el catálogo no se repite. Pero la pregunta que se hacen todos los días sí es siempre la misma: qué llevo cuánto tiempo cargando, dónde está y a qué precio va hoy. Eso no cambia de lote a lote, y es justo lo que una libreta no contesta cuando son varias tiendas.

No le pido que catalogue como boutique. Le pido que cada pieza sepa desde cuándo está y en qué tienda.

¿Quién decide hoy los cambios entre tiendas?','texto','romper la objeción del control actual','demo'),
('outlets','email','outlets demo · correo 5',5,'días en piso por lote','Le dejo un ejercicio que puede hacer esta semana sin comprarme nada.

Tome los últimos diez lotes que compró y anote tres cosas de cada uno: qué día entró, cuántas piezas quedan y en qué tienda están. Nada más eso.

Va a ver que los lotes se le parten en dos grupos muy distintos. Los que se movieron casi completos en las primeras semanas y los que llevan meses arrastrándose de tienda en tienda. Compare qué tenían en común los primeros: proveedor, tipo de mercancía, precio de entrada, temporada.

Ese patrón es lo que debería mandar en su próxima compra, y hoy casi siempre se decide de memoria. Con la misma tabla también sale cuáles ya deberían haber bajado de precio hace un mes.

¿Sabe hoy qué día entró cada lote que tiene en piso?','texto','dar algo útil aunque no compren','demo'),
('outlets','email','outlets demo · correo 6',6,'mercancía en la tienda equivocada','Un ejemplo de lo que aparece cuando uno mira el inventario en serio.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la gente la pedía.

En saldos ese es literalmente el negocio, y por eso duele más: usted ya sabe que la pieza se vende en otra tienda, lo que no tiene es cómo enterarse a tiempo de cuál y cuándo, sin recorrer los locales.

Si quiere, en veinte minutos le enseño el sistema con sus propias tiendas y un par de lotes cargados, y usted juzga.

¿Le acomoda algún día de esta semana?','texto','contar el caso real y proponer la demo','demo'),
('outlets','email','outlets demo · correo 7',7,'lo dejo hasta aquí','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no me quiero volver ruido, así que aquí lo dejo.

Le insistí porque en saldos el tiempo es el costo. La misma pieza vale menos cada semana que pasa, y el margen no sale de comprar bien nada más, sale de qué tan rápido la pone donde alguien la quiere. Eso, con varias tiendas y sin nada que se lo diga, se acaba haciendo de memoria y a destiempo.

Si algún día quieren ver todas sus tiendas en una pantalla, o sacar a la venta en línea lo que ya recorrió todos los locales, me escribe y lo vemos en veinte minutos. No le vuelvo a insistir.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('outlets','email','outlets diagnostico · correo 1',1,'sus tiendas y el reparto','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]], con {{sucursales}} tiendas[[/si]]. En saldos el reparto entre tiendas no es un detalle de operación, es de dónde sale el margen.

Hacemos inventario y punto de venta para moda. Antes de venderle nada hacemos un diagnóstico gratis: con su información, en 15 minutos le decimos cuánto dinero trae parado, en qué tienda está y qué convendría mover primero.

¿Le agendo esos 15 minutos esta semana?','texto','abrir con sus sucursales y ofrecer el diagnóstico','diagnostico'),
('outlets','email','outlets diagnostico · correo 2',2,'lo que cuesta cada semana','Cuando digo dinero parado no hablo de lo que no se vende nunca. Hablo de mercancía que sí se vende, pero en otra tienda.

Con un local eso se ve a ojo. Con varios, no: un número se acabó en uno y está arrumbado en el otro, y en el tercero nadie preguntó. Cada tienda cree que el lote salió malo, y entre todas se vendía completo.

En saldos eso pesa el doble, porque su mercancía además envejece. Cada semana que una pieza está en la tienda equivocada no solo no vende: vale menos cuando por fin llegue a la buena.

¿Hoy pueden ver el inventario de todas sus tiendas sin llamarles una por una?','texto','explicar dinero parado y por qué se multiplica','diagnostico'),
('outlets','email','outlets diagnostico · correo 3',3,'cincuenta modelos, 1.2 millones','Le paso un caso, sin adornos.

Un cliente nuestro, cadena de moda con centro de distribución. Tomamos 50 modelos, nada más 50, y cruzamos existencia contra venta, tienda por tienda. Salieron 1.2 millones de pesos mal repartidos: mercancía ya comprada y pagada, sentada donde no la pedían.

Nadie se robó nada ni compró de más. El dinero estaba completo, nada más en el lugar equivocado.

Ese cliente tenía curva completa y reposición. Ustedes no: cada lote es único y no se resurte, así que cuando una pieza está mal puesta no hay otra igual esperando en bodega. Por eso el mismo cruce, en saldos, saca más.

¿Cuántas tiendas están moviendo hoy?','texto','contar el caso real','diagnostico'),
('outlets','email','outlets diagnostico · correo 4',4,'no necesito su base','Dos cosas que me contestan seguido, y las dos son justas.

La primera: no me van a pasar su base. No hace falta. Con la existencia por tienda y la venta de tres meses, en Excel, sin costos ni datos de clientes, alcanza. Firmamos confidencialidad si lo prefiere.

La segunda: en saldos no hay catálogo formal, se lleva por bulto o por lote. También sirve. Si lo que tiene es lote, fecha de entrada y piezas restantes por tienda, con eso armamos el cruce. No necesito que primero ordene nada para que valga la pena.

Si después de verlo se quedan como están, el diagnóstico se los queda igual.

¿Con qué archivo llevan hoy la existencia por tienda?','texto','romper la objeción de datos y de sistema propio','diagnostico'),
('outlets','email','outlets diagnostico · correo 5',5,'cómo medirlo sin nosotros','Por si nunca nos contratan, le dejo el método para hacerlo a mano.

Escoja diez lotes que sigan en piso. Arme una tabla con los lotes en las filas y sus tiendas en las columnas, y en cada celda ponga piezas que quedan y piezas vendidas en los últimos sesenta días.

Después marque dos tipos de celda. Las que tienen piezas y cero venta en sesenta días: eso es dinero dormido que además se abarata solo. Y las que vendieron parejo hasta quedarse en cero: ahí había demanda y se acabó la mercancía teniéndola en otro lado.

Cruce esas dos y ya tiene su lista de traspasos de mañana. Sume el costo de las primeras y ya tiene el tamaño del problema. Es lo mismo que le entregaríamos nosotros, a mano y con diez lotes.

¿Quiere que le mande el formato de esa tabla?','texto','dar el método gratis','diagnostico'),
('outlets','email','outlets diagnostico · correo 6',6,'qué sale en quince minutos','Para que sepa qué está aceptando, esto es lo que sale de los 15 minutos.

Uno: cuánto dinero tienen parado en piezas sin movimiento, en pesos de costo, tienda por tienda. Dos: la lista de traspasos que convendría hacer mañana, con pieza, origen y destino, ordenada por lo que más pesa. Tres: qué mercancía ya cumplió su tiempo en piso y debería cambiar de precio esta semana. Cuatro: qué se está perdiendo por faltantes donde sí había demanda.

Sale en una hoja, se lo explico en llamada y se queda con el archivo, contraten o no.

De su lado solo necesito existencia por tienda y venta de tres meses.

¿Quién de su equipo puede sacar esos dos archivos?','texto','decir exactamente qué entrega el diagnóstico','diagnostico'),
('outlets','email','outlets diagnostico · correo 7',7,'cierro el tema','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no me quiero volver ruido, así que aquí lo cierro.

Le insistí porque su negocio y lo que hacemos nosotros son la misma pregunta: dónde debería estar cada pieza para que se venda. Ustedes ya la contestan todos los días, con recorridos, llamadas y memoria. Lo único que cambia es que el sistema la contesta con números y sin esperar a que alguien se dé cuenta.

El diagnóstico sigue en pie sin costo cuando ustedes quieran. Me escribe y lo agendamos, y si de ahí no sale nada, se quedan con la lista de traspasos igual.

¿Lo dejamos así o le toco la puerta en unos meses?','texto','cerrar con dignidad','diagnostico'),
('relojerias','email','relojerias demo · correo 1',1,'la pieza con número de serie','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y le escribo por algo muy suyo: ustedes no venden modelos, venden piezas. Cada una trae su número de serie, su garantía y, tarde o temprano, su visita al taller.

Hacemos software de inventario y punto de venta para moda, joyería y piezas de alto valor, donde cada unidad se sigue por serie y no nada más por modelo.

¿Hoy dónde queda registrado el número de serie de lo que venden?','texto','abrir con algo cierto y ofrecer la demo','demo'),
('relojerias','email','relojerias demo · correo 2',2,'la garantía dos años después','El problema de su giro aparece dos años después de la venta.

Llega el cliente con la pieza y una queja. Para atenderlo hay que saber tres cosas: si esa serie salió de ustedes, qué día, y qué cobertura traía. Si eso vive en una nota, en un libro o en la memoria de quien lo vendió, la respuesta tarda, y una respuesta lenta en una pieza cara se siente como desconfianza.

Y luego está el taller. La pieza del cliente entra, se va a servicio y durante unos días no es inventario ni es venta: es algo caro que está bajo su responsabilidad y que no aparece en ningún reporte.

¿Cuántas piezas traen hoy en taller?','texto','enseñar el dolor mecánico del giro','demo'),
('relojerias','email','relojerias demo · correo 3',3,'cada unidad con su serie','Le cuento cómo funciona por dentro, para que juzgue si le sirve.

Cada pieza entra al inventario con su serie, no como una más del modelo. Al venderse, la serie se queda pegada al ticket y al cliente, con su fecha y su garantía. Cuando esa persona vuelve, se busca por serie y sale todo: quién se la vendió, cuándo y qué le toca.

El taller va en el mismo lugar: se abre una orden con la pieza recibida, el diagnóstico, el costo y la fecha prometida. En óptica el armado corre igual, con la graduación y el laboratorio dentro de la orden, y el armazón bajando del inventario por modelo y color.

¿Manejan taller propio o mandan el servicio fuera?','texto','mostrar cómo se resuelve por dentro','demo'),
('relojerias','email','relojerias demo · correo 4',4,'lo tengo en el libro','Casi siempre me dicen lo mismo: la garantía está en el libro y las series en las notas, y eso lleva años funcionando.

Le creo. El problema no es el libro, es a qué hora se consulta. Cuando el cliente está enfrente con la pieza en la mano, nadie va a ponerse a buscar en cajas de notas de hace dos años, así que se resuelve de memoria o de buena fe. Y en piezas caras la buena fe sale cara, para un lado o para el otro.

No le pido que tire el libro. Le pido que la serie viva pegada a la venta desde el primer día.

¿Quién lleva hoy el registro de garantías?','texto','romper la objeción del control actual','demo'),
('relojerias','email','relojerias demo · correo 5',5,'qué lleva un año en vitrina','Le dejo un ejercicio que puede hacer esta semana sin comprarme nada.

Recorra la vitrina y apunte, pieza por pieza, desde cuándo está ahí y cuánto costó. Nada más esas dos columnas.

Casi siempre pasan dos cosas. La primera es que el número de abajo asusta, porque en su giro una vitrina quieta no es exhibición, es capital dormido con vidrio encima. La segunda es que la mayor parte de ese dinero está en pocas piezas, casi siempre de las caras, que llevan más de un año ahí.

Con eso ya puede decidir cuáles mandar a otra sucursal donde sí se piden, cuáles negociar con la marca y cuáles poner en el mostrador que más gente ve.

¿Sabe hoy desde qué fecha está cada pieza de la vitrina?','texto','dar algo útil aunque no compren','demo'),
('relojerias','email','relojerias demo · correo 6',6,'mercancía en la tienda equivocada','Le comparto algo que encontramos en otro cliente, para que vea el tamaño del asunto.

Es una cadena de moda. Revisamos nada más 50 modelos y aparecieron 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas: mercancía comprada y pagada que no estaba donde la pedían.

En su giro el mecanismo es el mismo pero con menos piezas y más pesos cada una. Bastan unas cuantas referencias caras paradas en la sucursal equivocada para que el número se parezca, con el agravante de que ahí el dinero está quieto en vitrina.

Si quiere, en veinte minutos le enseño el sistema con sus propias piezas: serie, garantía, taller y la vitrina por sucursal.

¿Le acomoda algún día de esta semana?','texto','contar el caso real y proponer la demo','demo'),
('relojerias','email','relojerias demo · correo 7',7,'lo dejo por aquí','[[si persona]]{{persona}}, [[/si]]ya no le escribo más, lo dejo por aquí.

Le insistí porque su giro se lleva mal con los sistemas de tienda comunes. Todos suponen que un modelo son muchas piezas iguales, y en relojería y en óptica eso no es cierto: cada unidad tiene su serie, su garantía, su historia de servicio, y en el caso del lente ni siquiera existe hasta que se arma con la graduación de una persona.

Si algún día se cansan de buscar una garantía en cajas de notas, o de no saber qué hay en la vitrina de otra sucursal, me escribe y lo vemos en veinte minutos. Aquí queda el correo, sin fecha de vencimiento.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('relojerias','email','relojerias diagnostico · correo 1',1,'sus sucursales y la vitrina','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]], con {{sucursales}} sucursales[[/si]]. Con varios puntos y piezas caras, el pleito no es cuánto compraron, es en qué vitrina se quedó parado el dinero.

Hacemos inventario y punto de venta para moda, joyería y piezas de alto valor. Antes de venderle nada hacemos un diagnóstico gratis: con su información, en 15 minutos le decimos cuánto trae detenido y dónde.

¿Le agendo esos 15 minutos esta semana?','texto','abrir con sus sucursales y ofrecer el diagnóstico','diagnostico'),
('relojerias','email','relojerias diagnostico · correo 2',2,'capital dormido en vitrina','Cuando digo dinero parado no hablo de lo que no se vende. Hablo de piezas que sí se venden, pero en otra sucursal.

Con un local eso se ve a ojo, porque el dueño se sabe la vitrina. Con varios ya no: la referencia que aquí lleva dos años es la que allá les preguntan cada semana, y nadie hace la llamada porque nadie sabe que existe.

En su giro eso pesa más que en cualquier tienda de ropa. Son pocas piezas y cada una cuesta mucho, así que una vitrina mal armada detiene más dinero que un almacén entero de playeras.

¿Hoy pueden ver la vitrina de todas sus sucursales en una sola pantalla?','texto','explicar dinero parado y por qué se multiplica','diagnostico'),
('relojerias','email','relojerias diagnostico · correo 3',3,'cincuenta modelos, 1.2 millones','Le paso un caso, sin adornos.

Un cliente nuestro, cadena de moda con centro de distribución. Tomamos 50 modelos, nada más 50, y cruzamos existencia contra venta, sucursal por sucursal. Salieron 1.2 millones de pesos mal repartidos: mercancía ya comprada y pagada, sentada donde no la pedían.

Nadie se robó nada ni compró de más. El dinero estaba completo, nada más en el lugar equivocado.

En relojería y óptica el mismo número se junta con muchas menos referencias, porque el costo por pieza es otro. Por eso el cruce vale la pena aunque su catálogo sea chico.

¿Cuántas referencias distintas manejan hoy en vitrina?','texto','contar el caso real','diagnostico'),
('relojerias','email','relojerias diagnostico · correo 4',4,'no necesito su base','Dos cosas que me contestan seguido, y las dos son justas.

La primera: no me van a pasar su base. No hace falta. Con la existencia por sucursal y la venta de seis meses, en Excel, sin costos ni datos de clientes, alcanza. Firmamos confidencialidad si lo prefiere.

La segunda: ya tienen sistema, y a veces uno que puso la marca. Casi siempre guarda bien lo que pasó. El diagnóstico no viene a reemplazarlo, viene a leer lo que ya tienen con un cruce que no hace solo: qué referencia se mueve en cada sucursal contra qué referencia está detenida en cuál.

Si después de verlo se quedan con lo suyo, el diagnóstico se los queda igual.

¿Le parece si lo hacemos con esos dos archivos?','texto','romper la objeción de datos y de sistema propio','diagnostico'),
('relojerias','email','relojerias diagnostico · correo 5',5,'cómo medirlo sin nosotros','Por si nunca nos contratan, le dejo el método para hacerlo a mano.

Arme una tabla con sus referencias en las filas y sus sucursales en las columnas. En cada celda ponga dos números: piezas en existencia y piezas vendidas en los últimos seis meses. En su giro seis meses, no tres, porque el ritmo de venta es más lento y con noventa días se saca una foto engañosa.

Después marque dos tipos de celda. Las que tienen existencia y cero venta en seis meses, con su costo al lado: eso es capital dormido. Y las que vendieron y se quedaron en cero mientras la misma referencia dormía en otra sucursal.

Sume la primera columna y va a entender por qué insisto tanto con esto.

¿Quiere que le mande el formato de esa tabla?','texto','dar el método gratis','diagnostico'),
('relojerias','email','relojerias diagnostico · correo 6',6,'qué sale en quince minutos','Para que sepa qué está aceptando, esto es lo que sale de los 15 minutos.

Uno: cuánto dinero tienen detenido en piezas sin movimiento, en pesos de costo, sucursal por sucursal. Dos: qué referencias convendría mover y a dónde, ordenadas por lo que más pesa. Tres: las referencias que se agotan en las sucursales donde sí se piden, para reponer ahí primero. Cuatro: qué parte de su inventario lleva más de un año en la misma vitrina.

Sale en una hoja, se lo explico en llamada y se queda con el archivo, contraten o no.

De su lado solo necesito existencia por sucursal y venta de seis meses.

¿Quién de su equipo puede sacar esos dos archivos?','texto','decir exactamente qué entrega el diagnóstico','diagnostico'),
('relojerias','email','relojerias diagnostico · correo 7',7,'cierro el tema','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no me quiero volver ruido, así que aquí lo cierro.

Le insistí porque en su giro casi todo el oficio ya está resuelto: la atención, el taller, la relación con las marcas, muchas veces desde hace generaciones. Lo que casi nunca está resuelto es la pregunta aburrida de en qué vitrina se quedó el dinero, porque son pocas piezas, cada una cara, y ningún reporte estándar la contesta.

El diagnóstico sigue en pie sin costo cuando ustedes quieran, y no les cuesta más que dos archivos. Me escribe y lo agendamos.

¿Lo dejamos así o le toco la puerta en unos meses?','texto','cerrar con dignidad','diagnostico'),
('deportiva','whatsapp','abre',1,null,'Buen día. Le escribo a {{nombre}} de parte de Sacs, sistema mexicano de inventario y punto de venta para moda y deporte. El tema es la talla que falta cuando el cliente ya llegó pidiéndola por su nombre. ¿Con quién lo puedo ver?','texto','WhatsApp · abre','ambas'),
('deportiva','whatsapp','sigue',2,null,'Vuelvo una vez y ya. En deporte el cliente sabe más que el vendedor: llega con el modelo, el año y su talla. Y lo que no se vendió en la temporada ya no se resurte, nada más se remata. ¿Me pasa el correo de quien ve las compras?','texto','WhatsApp · sigue','ambas'),
('deportiva','whatsapp','cierra',3,null,'Con esta cierro y ya no insisto. Si algún día quieren ver en una sola pantalla qué tallas quedan en todas sus tiendas, aquí queda mi número. Gracias por leerme y buenas ventas.','texto','WhatsApp · cierra','ambas'),
('sublimado','whatsapp','abre',1,null,'Buen día. Le escribo a {{nombre}} de parte de Sacs, sistema mexicano de inventario y pedidos para negocios de moda. Nos buscan talleres de uniforme personalizado, por el pedido con nombre y número de cada jugador. ¿Con quién puedo verlo y por dónde?','texto','WhatsApp · abre','ambas'),
('sublimado','whatsapp','sigue',2,null,'Insisto una vez y ya. Un pedido de dieciocho jerseys son dieciocho piezas distintas para la misma fecha, y abajo va la tela: el mismo corte en decenas de colores repartido entre sus puntos. ¿Me pasa el correo de quien lleva los pedidos?','texto','WhatsApp · sigue','ambas'),
('sublimado','whatsapp','cierra',3,null,'Con esta ya no le insisto. Si algún día quieren llevar cada pedido renglón por renglón y ver la tela por color y por punto, aquí sigue mi número. Gracias por su tiempo.','texto','WhatsApp · cierra','ambas'),
('disfraces','whatsapp','abre',1,null,'Buen día. Le escribo a {{nombre}} de parte de Sacs, sistema mexicano de inventario y punto de venta para moda. Nos buscan negocios como el suyo por saber qué días está libre cada pieza de renta. ¿Con quién puedo verlo y por dónde?','texto','WhatsApp · abre','ambas'),
('disfraces','whatsapp','sigue',2,null,'Vuelvo una vez nada más. En su giro el año se juega en unas semanas, y ahí lo que duele es no saber si la pieza ya volvió de lavandería, o si la talla que piden está colgada en otra tienda. ¿Me deja el correo de quien lleva los apartados?','texto','WhatsApp · sigue','ambas'),
('disfraces','whatsapp','cierra',3,null,'Aquí lo dejo, sin insistir más. Si antes de la próxima temporada quieren ver el calendario de cada pieza y lo que hay en todas sus tiendas, este número sigue abierto. Gracias.','texto','WhatsApp · cierra','ambas'),
('outlets','whatsapp','abre',1,null,'Buen día. Le escribo a {{nombre}}[[si ciudad]], allá en {{ciudad}},[[/si]] de parte de Sacs, sistema mexicano de inventario y punto de venta para moda. Lo nuestro es mover la pieza a la tienda donde sí se vende. ¿Con quién puedo verlo y por dónde?','texto','WhatsApp · abre','ambas'),
('outlets','whatsapp','sigue',2,null,'Vuelvo una vez y ya. En saldos el lote llega sin curva, y la pieza que en un local no sale, en otro se vende el mismo día. El chiste es enterarse a tiempo, sin recorrer las tiendas. ¿Me pasa el correo de quien decide los cambios?','texto','WhatsApp · sigue','ambas'),
('outlets','whatsapp','cierra',3,null,'Con esta cierro. Si algún día quieren ver todas sus tiendas en una pantalla y qué mercancía ya cumplió su tiempo en piso, aquí queda mi número. Gracias por leerme.','texto','WhatsApp · cierra','ambas'),
('relojerias','whatsapp','abre',1,null,'Buen día. Le escribo a {{nombre}} de parte de Sacs, sistema mexicano de inventario para moda, joyería y piezas de alto valor. Lo nuestro es seguir cada unidad por su número de serie, con su garantía. ¿Con quién puedo verlo y por dónde?','texto','WhatsApp · abre','ambas'),
('relojerias','whatsapp','sigue',2,null,'Vuelvo una vez nada más. Lo que más nos piden en relojería y óptica es encontrar una garantía por número de serie sin buscar en notas de hace dos años, y saber qué trae el taller hoy. ¿Me pasa el correo de quien lleva el servicio?','texto','WhatsApp · sigue','ambas'),
('relojerias','whatsapp','cierra',3,null,'Aquí lo dejo, sin insistir. Si algún día quieren ver la vitrina de todas sus sucursales, y cada pieza con su serie y su garantía, este número sigue abierto. Gracias por su tiempo.','texto','WhatsApp · cierra','ambas');
insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select c.id, (array[1,3,7,11,16,22,30])[p.orden], p.orden, 'email', p.id, true, p.objetivo
from abm_cadencias c join abm_plantillas p on p.giro=c.giro and p.ruta=c.ruta and p.canal='email'
where c.giro in ('deportiva','sublimado','disfraces','outlets','relojerias')
  and not exists (select 1 from abm_pasos x where x.cadencia_id=c.id and x.orden=p.orden);