-- Las 210 plantillas del motor Account-Based (15 giros × 2 rutas × 7 correos).
-- Estaban SOLO en la base: es el activo más valioso del módulo —el criterio de
-- venta de cada giro— y fuera de git se pierde con la base.
alter table abm_plantillas add column if not exists ruta text not null default 'demo';
delete from abm_plantillas;
insert into abm_plantillas (giro,canal,nombre,orden,asunto,cuerpo,formato,objetivo,ruta) values
('aliados','email','aliados demo · correo 1',1,'casi nadie hace lo suyo','[[si persona]]Hola {{persona}}.
[[/si]]Llegué a {{nombre}} buscando quién acompaña de verdad a dueñas de boutique en México, y salen muy pocas. Casi todo lo que circula con ese discurso viene de Argentina o de España.

Hacemos software de inventario y punto de venta para moda. Le propongo algo simple: sus alumnas reciben de su parte un diagnóstico gratis de inventario, y de las que se queden con el sistema a usted le toca comisión.

¿Le platico cómo funciona en quince minutos?','texto','abrir reconociendo su lugar y proponer la alianza','demo'),
('aliados','email','aliados demo · correo 2',2,'dónde se atoran sus alumnas','Le platico dónde se atoran casi siempre las alumnas, por si le suena.

Usted les enseña a comprar con cabeza, a costear y a vender. Aun así llegan a la siguiente temporada con lo mismo: no saben qué se les acabó primero ni qué lleva seis meses colgado. Un modelo trae ocho o diez tallas por color, y eso no se lleva en la cabeza mientras atienden, hacen envíos y graban contenido.

Entonces la clase se entendió, pero el negocio no se movió, y desde afuera parece que falló el acompañamiento.

¿Cuántas de sus alumnas llevan hoy un control real de su inventario?','texto','nombrar el hueco que la consultoría sola no cierra','demo'),
('aliados','email','aliados demo · correo 3',3,'cómo queda armada la alianza','Le cuento cómo queda armado, para que vea si le acomoda.

Usted nos presenta a las alumnas que quiera, cuando quiera. A cada una le hacemos el diagnóstico gratis: con sus existencias y sus ventas le decimos cuánto dinero trae parado y qué tallas está dejando de vender. Sin costo, sin compromiso, y entregado como parte de su programa.

La que quiera el sistema entra con precio especial por venir de usted, y de esa cuenta le corresponde una comisión mientras siga activa.

Instalación, capacitación y soporte los damos nosotros. Usted no carga con nada de eso.

¿Cuántas alumnas trae en el programa actual?','texto','explicar la mecánica exacta de la alianza','demo'),
('aliados','email','aliados demo · correo 4',4,'no quiero recomendar herramientas','Le adelanto la objeción, porque me la dicen seguido: no quiero andar recomendando herramientas y que luego me reclamen.

Se entiende, y por eso lo primero que reciben sus alumnas no es una cotización, es su propio número. Si el diagnóstico no les sirve, ahí muere y usted quedó como quien les dio algo concreto.

Y si su comunidad es chica, mejor. Esto no funciona por volumen: funciona porque usted sabe cuál de sus alumnas ya llegó al punto donde el Excel se le quedó corto. Con tres o cuatro al mes se ve si sirve.

¿Empezamos con dos alumnas suyas?','texto','romper la objeción de recomendar y la de comunidad chica','demo'),
('aliados','email','aliados demo · correo 5',5,'un ejercicio para su programa','Le dejo un ejercicio que puede meter a su programa esta semana, con nosotros o sin nosotros.

Que cada alumna tome sus diez modelos más vendidos y los baje a talla y color. Dos columnas: cuánto tiene hoy y cuánto vendió en los últimos treinta días.

De ahí salen dos listas. Lo que está en cero y sí se vendía, que es venta que se le fue. Y lo que tiene tres o más piezas sin moverse en un mes, que es dinero detenido en el piso.

Que multipliquen la primera lista por su precio de venta y la segunda por su costo. Casi siempre el segundo número les cambia la cara, porque es dinero que ya pagaron y que creían tener.

De ahí sale la mejor conversación de compra que va a tener con ellas.

¿Se lo dejo armado para su siguiente sesión?','texto','regalar un ejercicio que puede meter a su clase','demo'),
('aliados','email','aliados demo · correo 6',6,'1.2 millones en 50 modelos','Le platico lo que aparece cuando uno mira el inventario en serio.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la pedían.

Una boutique de sus alumnas maneja números mucho más chicos, pero es el mismo dinero detenido, y para ella suele ser casi todo su capital de trabajo. Cuando lo ve en pesos, la conversación cambia sola.

Si quiere, en veinte minutos le enseño el sistema por dentro con productos como los de ellas, y de ahí vemos si armamos la alianza.

¿Le acomoda esta semana o la que entra?','texto','usar el caso real y proponer ver el sistema','demo'),
('aliados','email','aliados demo · correo 7',7,'aquí le paro','[[si persona]]{{persona}}, [[/si]]no le sigo escribiendo, así que aquí le paro.

Le insistí porque en México casi no hay quien acompañe a dueñas de boutique con seriedad, y usted es de las pocas. Lo que pasa después de un buen programa casi siempre es lo mismo: la alumna entendió qué comprar, pero no tiene con qué medirlo, y a la tercera temporada está en el mismo lugar.

El diagnóstico gratis para sus alumnas va a seguir en pie cuando quiera, sea una o sean cincuenta, sin exclusividad y sin comprometerla a nada.

¿Lo retomo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad reconociendo su trabajo','demo'),
('aliados','email','aliados diagnostico · correo 1',1,'un beneficio para sus alumnas','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}} y el tamaño de su comunidad. Le escribo por ellas, no por usted.

Hacemos software de inventario para moda. Antes de venderle a nadie hacemos un diagnóstico gratis: con las existencias y las ventas de una boutique, en quince minutos le decimos cuánto dinero trae parado y cuánto está perdiendo por faltantes.

Se lo propongo abierto para sus alumnas, entregado a nombre de su programa y sin costo para nadie.

¿Se lo explico en quince minutos?','texto','abrir ofreciendo el diagnóstico para toda la comunidad','diagnostico'),
('aliados','email','aliados diagnostico · correo 2',2,'por qué no les sale flujo','Dinero parado no es la mercancía que nadie quiere. Esa ya se sabe. Es la que sí se vende, pero está en la talla, el color o el punto de venta donde no la piden.

En una boutique chica eso suele ser buena parte de lo que tiene en piso, y la dueña no lo ve, porque de vista todo parece surtido. Un modelo trae ocho o diez tallas por color: basta que falten dos tallas del que sí jala para que el mostrador diga que no hay.

Por eso muchas alumnas hacen todo bien y aun así no traen flujo. No les falta venta, les falta mercancía movida.

¿Cuántas alumnas activas tiene hoy?','texto','definir dinero parado en la escala de una boutique','diagnostico'),
('aliados','email','aliados diagnostico · correo 3',3,'1.2 millones en 50 modelos','Le pongo el ejemplo más claro que tengo.

En un cliente nuestro, cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía comprada, pagada y vendible, nada más que no estaba donde la pedían.

Cincuenta modelos. La cadena maneja miles.

Una boutique de sus alumnas maneja números mucho más chicos, pero es el mismo patrón, y ahí ese dinero detenido suele ser todo el capital de trabajo del negocio.

Eso es justo lo que sale del diagnóstico, con lo que tengan a la mano, aunque sea un archivo hecho a mano.

¿Le mando la lista de lo que se necesita?','texto','contar el caso real y traducirlo a una boutique','diagnostico'),
('aliados','email','aliados diagnostico · correo 4',4,'que no parezca que vendo','Le adelanto lo que yo diría en su lugar: no quiero que mi comunidad sienta que le estoy vendiendo algo.

Es la objeción correcta. Por eso el diagnóstico se entrega sin cotización adentro: nada más el número del negocio y qué hacer con él. Si al final nadie compra, usted igual quedó como quien les dio algo que nadie más les dio.

Y si le preocupa que sus alumnas no sean de sistemas, casi ninguna lo es. La mayoría lleva libreta o Excel, y con eso alcanza para armar el diagnóstico.

¿Empezamos con un grupo chico de alumnas?','texto','romper la objeción de vender a la propia comunidad','diagnostico'),
('aliados','email','aliados diagnostico · correo 5',5,'el método para su clase','Le paso el método completo, por si nunca trabajamos juntos. Lo puede dar como clase tal cual.

Cada alumna toma sus veinte modelos más vendidos y los baja a nivel talla y color. Dos columnas: cuánto tiene hoy y cuánto vendió en los últimos treinta días.

De ahí salen dos listas. Faltante: existencia en cero con venta arriba de cero. Sobrante: tres o más piezas sin una sola venta en treinta días. El faltante se multiplica por el precio de venta y el sobrante por el costo.

El primero es la venta que se les fue el mes pasado. El segundo es el dinero que traen detenido en el piso. Ese ejercicio, hecho dos veces al año, les cambia la forma de comprar.

¿Quiere que se lo arme como sesión para su grupo?','texto','regalar el método completo listo para darlo como sesión','diagnostico'),
('aliados','email','aliados diagnostico · correo 6',6,'qué recibe cada alumna','Para que sepa qué estaría ofreciendo, esto es lo que recibe cada alumna.

Primero, su dinero detenido en pesos, abierto por familia de producto y no un total que no sirve para nada. Segundo, el faltante: qué tallas y colores se están vendiendo y ya están en cero, y qué venta le costó eso el mes pasado. Tercero, qué comprar y qué rematar antes del siguiente pedido.

Lo armamos nosotros con su archivo y se entrega a nombre de su programa.

De las que después quieran el sistema, entran con condiciones especiales por venir de usted y a usted le queda una comisión mientras sigan activas. Sin cuota mínima y sin exclusividad.

¿Con cuántas alumnas le gustaría empezar?','texto','detallar el entregable y las condiciones de la alianza','diagnostico'),
('aliados','email','aliados diagnostico · correo 7',7,'lo dejo hasta aquí','[[si persona]]{{persona}}, [[/si]]lo dejo aquí y le digo por qué insistí.

En México casi no hay consultoría seria para dueñas de boutique. Lo poco que circula viene de fuera, con otros costos, otras tallas y otra manera de comprar. Usted ya tiene lo más difícil, que es la confianza de cientos de negocios. Lo que casi siempre falta es la parte de números, y ahí es donde se les queda el dinero.

El diagnóstico gratis para sus alumnas sigue en pie cuando quiera, sin costo y sin exclusividad. Si le sirve para una sola alumna, ya valió la pena.

¿Lo retomo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad reconociendo el hueco de mercado','diagnostico'),
('boutiques','email','boutiques demo · correo 1',1,'qué queda en la otra tienda','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}} en {{ciudad}}[[si rating]] y su {{rating}} de calificación en Google[[/si]][[si resenas]], ya con {{resenas}} reseñas[[/si]]. Se nota que la gente vuelve.

Hacemos software de inventario y punto de venta para negocios de moda. Lo que más nos buscan las boutiques multimarca es esto: saber, sin hablarle a la otra tienda, qué talla y qué color quedan de cada marca.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propios productos.

¿Cuántas tiendas traen hoy?','texto','abrir con algo cierto de su negocio y ofrecer la demo','demo'),
('boutiques','email','boutiques demo · correo 2',2,'ocho tallas por cada modelo','Una boutique multimarca no vende modelos, vende combinaciones. Un solo modelo trae ocho o diez tallas y tres colores: ahí ya van treinta piezas distintas de una sola marca.

Con una tienda eso se controla de vista. Con dos o tres, ya no. Lo que se acabó en una sigue colgado en la otra, y nadie se entera hasta que la clienta pide la talla y se le dice que no hay.

Y al final de la temporada la pregunta seria no es cuánto se vendió, sino qué marca dejó dinero y cuál dejó saldo.

¿Cuál de sus marcas le está costando más trabajo mover?','texto','enseñar el dolor mecánico con números del oficio','demo'),
('boutiques','email','boutiques demo · correo 3',3,'el mismo inventario en dos tiendas','Le cuento cómo funciona por dentro, para que juzgue.

Cada producto vive por talla y color, no por modelo. La blusa negra chica es una línea con su propia existencia, y esa existencia se ve por tienda desde el mismo mostrador. Si en una tienda se acabó la mediana y en la otra quedan dos, quien atiende lo ve antes de decir que no, y ahí mismo genera el traspaso.

Aparte, cada producto carga su marca y su proveedor, así que el reporte de fin de mes le dice cuánto vendió y cuánto le dejó cada marca, no solo el total de la tienda.

¿Hoy cómo revisan lo que hay en la otra tienda?','texto','mostrar cómo se resuelve por dentro','demo'),
('boutiques','email','boutiques demo · correo 4',4,'hasta dónde aguanta el excel','Casi todas las boutiques que nos escriben llevaban su control en Excel, y les servía bien con una tienda. El archivo no está mal hecho. Nada más que solo lo entiende quien lo hizo.

Con la segunda tienda empieza lo bueno: dos archivos que nunca cuadran, el conteo del domingo en la noche, la marca que se pidió doble porque nadie vio que ya venía en camino.

Y tampoco es cosa de ser grande o chico. Es cuántas piezas distintas trae encima: tres marcas con diez modelos cada una ya son cientos de tallas y colores que alguien está cargando de memoria.

¿Quién lleva hoy ese archivo?','texto','romper la objeción del control actual','demo'),
('boutiques','email','boutiques demo · correo 5',5,'una cuenta por marca','Le dejo algo que puede hacer esta semana sin comprarme nada.

Tome las últimas dos temporadas y arme una tabla por marca, no por producto. Tres columnas: cuánto compró, cuánto vendió a precio lleno y cuánto salió en rebaja. Al final ponga lo que le queda hoy en piso de esa marca.

Casi siempre aparecen tres grupos. Marcas que se venden solas y siempre se quedan cortas de talla. Marcas que venden, pero la mitad sale rebajada, o sea que ahí no hay margen. Y marcas que llevan dos temporadas dejándole saldo, que suelen ser las que más espacio ocupan.

Con eso ya sabe a quién pedirle más y a quién dejar de comprar, y no necesita sistema para hacerlo. Nada más necesita saber qué marca es cada producto.

¿Tiene identificada la marca en cada producto?','texto','dar un método útil que puedan usar sin comprar nada','demo'),
('boutiques','email','boutiques demo · correo 6',6,'lo que encontramos en 50 modelos','Le platico algo que vimos hace poco, por si le suena conocido.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la gente la pedía.

En una boutique de dos o tres tiendas el número es más chico, pero el problema es idéntico: la talla que se vendería en una está colgada en la otra, y el dinero que iba a servir para la marca nueva está detenido ahí.

[[si senal]]Como veo que {{senal}}, se lo comento ahora.

[[/si]]Si quiere, en veinte minutos le enseño el sistema con sus propios productos cargados.

¿Le acomoda esta semana o la que entra?','texto','contar el caso real y proponer la demo con sus productos','demo'),
('boutiques','email','boutiques demo · correo 7',7,'ya no le insisto más','[[si persona]]{{persona}}, [[/si]]no le quiero seguir llenando el correo, así que aquí le paro.

Le escribí porque las boutiques multimarca son el caso que peor resuelven los sistemas de tienda comunes: casi todos asumen que usted fabrica lo que vende y que trae una sola marca. Cuando trae ocho proveedores distintos, con temporadas cortas y tallas que no se reponen, el reporte de fin de mes no le dice lo único que importa, que es qué marca le deja dinero.

Si algún día abren otra tienda, o nada más quieren ver cómo se vería su catálogo adentro, me escribe y lo vemos en veinte minutos. No le vuelvo a insistir.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad dejando la puerta abierta','demo'),
('boutiques','email','boutiques diagnostico · correo 1',1,'cuánto dinero trae parado','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}} en {{ciudad}}[[si sucursales]], con {{sucursales}} sucursales[[/si]][[si rating]] y su {{rating}} de calificación en Google[[/si]][[si resenas]], sobre {{resenas}} reseñas[[/si]]. Crecer así de rápido casi siempre trae la misma cuenta pendiente: saber cuánto inventario está detenido en la tienda equivocada.

Hacemos software de inventario para moda. Antes de venderle nada, ofrecemos un diagnóstico gratis: con su información, en quince minutos le decimos cuánto dinero tiene parado y cuánto está perdiendo por faltantes.

¿Le interesa que se lo saque?','texto','abrir con sus sucursales y ofrecer el diagnóstico gratis','diagnostico'),
('boutiques','email','boutiques diagnostico · correo 2',2,'el dinero que está colgado','Cuando digo dinero parado no hablo de lo que no se ha vendido. Hablo de mercancía que sí se vende, pero que está en la tienda donde nadie la pide.

Un modelo de moda son ocho o diez tallas y varios colores. Multiplíquelo por las marcas que trae y por cada tienda: son miles de combinaciones, y cada una puede estar sobrada en un lado y agotada en otro al mismo tiempo.

Con una tienda eso se arregla caminando el piso. Con cinco o más ya nadie lo trae en la cabeza, y se paga dos veces: en la pieza que se rebaja y en la venta que no se hizo.

¿Cuántas veces al mes hacen traspasos entre tiendas?','texto','explicar dinero parado y por qué se multiplica con varias tiendas','diagnostico'),
('boutiques','email','boutiques diagnostico · correo 3',3,'50 modelos y 1.2 millones','Un ejemplo de lo que sale cuando uno mira el inventario en serio.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. No era mercancía muerta: era mercancía buena, comprada y pagada, que estaba donde no la pedían.

Lo que más le dolió al dueño no fue el número. Fue darse cuenta de que llevaba tres temporadas rebajando piezas que en otra tienda se hubieran vendido a precio lleno.

Eso mismo es lo que le sacamos en el diagnóstico de quince minutos, con sus propios datos.

¿Me deja sacarle el suyo?','texto','contar el caso real y amarrarlo al diagnóstico','diagnostico'),
('boutiques','email','boutiques diagnostico · correo 4',4,'no necesito su base completa','Dos cosas que me dicen seguido en este punto, y las dos son razonables.

La primera: no le voy a pasar mi información a un desconocido. No hace falta. Con un archivo de existencias por tienda y las ventas de los últimos meses alcanza. Sin nombres de clientes, sin costos si no quiere. Y firmamos confidencialidad si lo prefiere.

La segunda: ya tenemos sistema. Casi todos lo tienen. La pregunta no es si tiene sistema, es si ese sistema le dice hoy qué talla mover de cuál tienda a cuál. Los sistemas contables no hacen eso, y no está mal, no es su trabajo.

¿Puede exportar sus existencias por tienda?','texto','romper las dos objeciones de datos y de sistema actual','diagnostico'),
('boutiques','email','boutiques diagnostico · correo 5',5,'cómo medirlo usted mismo','Le dejo el método, por si nunca me contrata y de todos modos le sirve.

Escoja veinte modelos, los que más venda. Por cada talla y color de esos modelos anote dos cosas por tienda: cuántas piezas tiene hoy y cuántas vendió en los últimos treinta días.

Luego marque dos listas. Primera: donde la existencia es cero y la venta fue mayor a cero, eso es venta que se está perdiendo hoy. Segunda: donde hay tres o más piezas y la venta fue cero, eso es dinero detenido.

Cruce las dos listas entre tiendas y va a ver que muchas veces lo que le falta a una está sobrando en otra. Multiplique esas piezas por su precio y ya tiene el número.

¿Con veinte modelos le alcanza para probarlo?','texto','regalar el método de medición aunque no contraten','diagnostico'),
('boutiques','email','boutiques diagnostico · correo 6',6,'qué le entrego en quince minutos','Para que no sea una llamada a ciegas, le digo exactamente qué sale del diagnóstico.

Uno: cuánto dinero tiene parado hoy, en pesos, separado por tienda y por marca. Dos: la lista de tallas y colores que se están vendiendo y ya están en cero, con la venta que eso le costó el mes pasado. Tres: los traspasos concretos que le convienen esta semana, pieza por pieza, de cuál tienda a cuál. Cuatro: cuáles modelos ya no vale la pena mover y conviene rebajar de una vez.

Son quince minutos y se lo mandamos aunque decida no seguir. Nos sirve a nosotros para saber si de verdad le podemos ayudar.

[[si ultima_publicacion]]Vi lo de {{ultima_publicacion}}, buen momento para verlo.

[[/si]]¿Qué día de esta semana le queda mejor?','texto','detallar las salidas concretas del diagnóstico y pedir fecha','diagnostico'),
('boutiques','email','boutiques diagnostico · correo 7',7,'cierro por mi lado','[[si persona]]{{persona}}, [[/si]]ya no le escribo más, nada más le dejo el porqué de tanta insistencia.

En moda el inventario no es un almacén, es un rompecabezas de tallas y colores que se mueve cada semana. Cuando son varias tiendas, nadie puede traerlo en la cabeza, y lo que se pierde no se ve en ningún reporte: son ventas que nunca ocurrieron porque la talla estaba a veinte kilómetros.

El diagnóstico de quince minutos sigue en pie cuando quiera, este año o el que entra, y no cuesta nada. Si algún día le toca cerrar temporada con más saldo del que esperaba, ahí estamos.

¿Le vuelvo a escribir más adelante o lo saco de la lista?','texto','cerrar con dignidad dejando el diagnóstico en pie','diagnostico'),
('cadenas','email','cadenas demo · correo 1',1,'antes de la cuarta tienda','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}} en {{ciudad}}[[si senal]] y que {{senal}}[[/si]]. Se ven en pleno crecimiento.

Hacemos inventario y punto de venta para moda. Le escribo ahorita y no en dos años porque la talla y el color se controlan fácil cuando son pocas tiendas, y se vuelven un problema serio cuando ya son varias con bodega en medio.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propios productos.

¿Cuántas tiendas traen abiertas hoy?','texto','abrir con su crecimiento y ofrecer la demo corta','demo'),
('cadenas','email','cadenas demo · correo 2',2,'el online sabe, el piso no','[[si plataforma]]Su tienda en línea en {{plataforma}} sabe al segundo qué queda de cada talla. [[/si]]En el piso de venta casi nunca pasa lo mismo.

La vendedora no sabe si en la otra sucursal está la mediana que le están pidiendo, y la bodega no sabe que esa mediana se agotó el sábado. Entonces se manda por promedio, el traspaso sale el jueves siguiente y la clienta ya compró en otro lado.

Cuando son tres o cuatro tiendas todavía se tapa hablando por teléfono. En cuanto abren la quinta y la sexta, el teléfono ya no alcanza y aparece la rebaja.

¿Hoy cómo se enteran en tienda de lo que hay en las demás?','texto','enseñar el dolor mecánico del piso a ciegas','demo'),
('cadenas','email','cadenas demo · correo 3',3,'el sistema propone el reparto','Le cuento la parte que nos distingue, para que juzgue si le sirve.

Se llama nivelación. El sistema mira la venta real de cada talla y color en cada tienda, ve lo que hay en bodega y arma la propuesta de reparto: mandar tres medianas negras de esta tienda a aquella, sacar de bodega lo que ya se agotó en piso. Usted revisa la lista y aprueba; los traspasos se generan solos.

Debajo va lo normal: existencias por talla y color en tiempo real, punto de venta, mínimos y máximos que se ajustan con la venta[[si plataforma]] y el stock conectado con {{plataforma}}[[/si]].

¿Cuántas tallas maneja un modelo suyo?','texto','explicar nivelación por dentro','demo'),
('cadenas','email','cadenas demo · correo 4',4,'todavía somos pocas tiendas','La respuesta que más recibo de cadenas jóvenes es que todavía son pocas tiendas y se controlan bien. Es cierto, y no le voy a decir que está mal.

Lo que sí veo seguido es el costo de esperar. El día que abren la quinta tienda, el Excel ya trae dos años de historia mal capturada, y hay que limpiar catálogo, tallas y colores en plena temporada, que es el peor momento posible.

Entrar con tres tiendas cuesta un fin de semana de trabajo. Entrar con ocho cuesta un trimestre.

¿Para cuándo tienen pensada la siguiente apertura?','texto','romper la objeción de entrar después','demo'),
('cadenas','email','cadenas demo · correo 5',5,'su curva de tallas real','Le dejo algo que puede hacer esta semana sin comprarme nada, y que a cadenas jóvenes les cambia la compra.

Saque la venta del año pasado de sus tres modelos más fuertes, abierta por talla, y hágalo por tienda, no junto. Va a ver que la curva no es la misma en todas: hay tiendas que se cargan a las tallas chicas y otras a las grandes, y casi nunca coincide con la curva que le manda el proveedor.

Si compra y reparte con una sola curva para todas, está garantizando dos cosas al mismo tiempo: quiebre de la talla buena en unas tiendas y saldo de la misma talla en otras.

Con una hoja por tienda ya puede corregir el próximo pedido, sin sistema.

¿Reparten hoy con la misma curva para todas las tiendas?','texto','regalar el ejercicio de curva por tienda','demo'),
('cadenas','email','cadenas demo · correo 6',6,'lo que había en la bodega','Un número real, por si sirve de referencia.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. No era mercancía mala: era buena, comprada y pagada, parada donde no la pedían.

Esa cadena ya venía grande. El punto para ustedes es otro: ese hueco no aparece de golpe, se va formando desde la tercera o cuarta tienda, temporada tras temporada, y cuando se ve ya son millones.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propios productos y con nivelación corriendo sobre sus tiendas. Usted juzga si le sirve o no.

¿Le acomoda esta semana o la siguiente?','texto','contar el caso real y proponer la demo con sus productos','demo'),
('cadenas','email','cadenas demo · correo 7',7,'hasta aquí lo dejo','[[si persona]]{{persona}}, [[/si]]hasta aquí lo dejo, sin más correos.

Le escribí porque las cadenas que van creciendo rápido son a las que más caro les sale elegir tarde el sistema. Los de tienda común no entienden talla y color; los grandes piden un proyecto de meses y un presupuesto que a estas alturas no tiene sentido. En medio no hay casi nada hecho en México para moda, y ahí es donde estamos.

Cuando abran la siguiente tienda, o cuando el cierre de temporada salga con más rebaja de la que esperaban, me escribe y lo vemos en veinte minutos. No le vuelvo a insistir.

¿Le escribo cuando abran la que sigue o mejor lo saco de la lista?','texto','cerrar con dignidad y quedar para la siguiente apertura','demo'),
('cadenas','email','cadenas diagnostico · correo 1',1,'el piso no ve el stock','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si sucursales]] y sus {{sucursales}} tiendas[[/si]][[si plataforma]], y que su tienda en línea corre en {{plataforma}}[[/si]]. Casi siempre pasa lo mismo: el canal en línea sabe al minuto qué queda, y el piso de venta no.

Hacemos software de inventario para moda. Antes de venderle nada ofrecemos un diagnóstico gratis: con su información, en quince minutos le decimos cuánto dinero tiene parado y cuánto pierde por faltantes.

¿Se lo saco esta semana?','texto','abrir con sus tiendas y su canal en línea, y ofrecer el diagnóstico','diagnostico'),
('cadenas','email','cadenas diagnostico · correo 2',2,'el cedis empuja a ciegas','Dinero parado no es la mercancía que nadie quiere. Esa ya se sabe. Es la que sí se vende, pero está en la tienda donde no la piden.

Con muchas tiendas eso no se arregla caminando el piso. El centro de distribución reparte con lo que cree: la tienda que se quejó más fuerte, el promedio del año pasado, la corazonada del comprador. Un modelo son ocho o diez tallas por varios colores; multiplíquelo por cada tienda y son decenas de miles de decisiones al mes.

Después llegan los traspasos tarde y la rebaja, que casi siempre es el precio de un reparto que salió mal desde el principio.

¿Cómo deciden hoy cuánto mandarle a cada tienda?','texto','explicar dinero parado a escala de cadena','diagnostico'),
('cadenas','email','cadenas diagnostico · correo 3',3,'1.2 millones en 50 modelos','Le pongo el ejemplo más claro que tengo.

En un cliente nuestro, cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía comprada, pagada y vendible, nada más que no estaba donde la pedían.

Solo 50 modelos. La cadena maneja miles.

Y el patrón se repite: el centro de distribución guarda tallas que en tienda se agotaron el primer fin de semana, y hay tiendas cargadas de modelos que ahí nunca se movieron y van a terminar rebajados.

Eso es lo que le sacamos en quince minutos con sus datos, sin que cambie de sistema.

¿Le mando la lista de lo que necesito?','texto','contar el caso real a escala de cadena','diagnostico'),
('cadenas','email','cadenas diagnostico · correo 4',4,'su erp no reparte tallas','En cadenas del tamaño de la suya siempre salen dos cosas, y las dos tienen sentido.

Una: ya tenemos ERP. Seguro, y no le pedimos que lo cambie. El ERP le dice cuánto tiene y cuánto costó. No le dice qué talla mandar de la tienda A a la tienda B esta semana. Eso es otro problema y se resuelve encima de lo que ya tiene[[si plataforma]], incluido lo que vende en {{plataforma}}[[/si]].

Dos: no le paso mi base. No hace falta. Existencias por tienda y ventas de los últimos meses. Sin clientes, sin costos si prefiere, y con confidencialidad firmada.

¿Puede sacar existencias por tienda y talla?','texto','romper la objeción del ERP y la de entregar datos','diagnostico'),
('cadenas','email','cadenas diagnostico · correo 5',5,'mídalo con una hoja','Le paso el método por si nunca trabajamos juntos.

Tome sus veinte modelos más vendidos y bájelos a nivel talla y color por tienda. Dos columnas: existencia de hoy y unidades vendidas en los últimos treinta días.

Ahora saque dos listas. Quiebre: existencia cero con venta mayor a cero. Sobrante: tres o más piezas con venta cero en treinta días. Multiplique el quiebre por su precio de venta y el sobrante por su costo.

El primer número es lo que dejó de vender. El segundo es lo que trae detenido. Y cuando cruce las dos listas entre tiendas va a ver la parte que más duele: buena parte de lo que falta en una tienda está sobrando en otra, ya pagado.

¿Puede bajarlo a nivel talla o su sistema solo da modelo?','texto','regalar el método de quiebre y sobrante','diagnostico'),
('cadenas','email','cadenas diagnostico · correo 6',6,'las cuatro salidas del diagnóstico','Para que sepa qué está aceptando, esto es lo que sale de los quince minutos.

Primero, el dinero detenido en pesos, abierto por tienda y por familia de producto, no un total que no sirve para nada. Segundo, el quiebre: qué tallas y colores se están vendiendo y ya están en cero, y qué venta le costó eso el mes pasado.

Tercero, la lista de traspasos que le conviene ejecutar esta semana, pieza por pieza y de cuál tienda a cuál, ordenada por el dinero que recupera. Cuarto, qué le sobra al centro de distribución que debió salir hace dos meses.

Lo armamos nosotros con su archivo. Usted solo lo lee y decide si le hace sentido.

¿Quién de su equipo puede sacar el archivo?','texto','detallar el entregable y pedir el contacto operativo','diagnostico'),
('cadenas','email','cadenas diagnostico · correo 7',7,'no le escribo más','[[si persona]]{{persona}}, [[/si]]lo dejo aquí y le explico por qué insistí tanto.

En una cadena de moda el reparto es la decisión más cara del año y casi siempre se toma por corazonada. Nadie tiene la culpa: son miles de tallas por decenas de tiendas cada semana, y ninguna persona puede con eso. Por eso existe nivelación, que es lo único que hacemos distinto y lo que de verdad mueve el número.

El diagnóstico de quince minutos sigue disponible cuando quiera, sin costo y sin cambiar de sistema. Si este cierre de temporada les sale con más rebaja de la que esperaban, ahí va a estar la respuesta.

¿Lo retomo el año que entra o lo saco de la lista?','texto','cerrar con dignidad explicando por qué nivelación importa','diagnostico'),
('canal','email','canal demo · correo 1',1,'le escribo por sus clientas','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]]. No le escribo para venderle un sistema: le escribo por sus clientas.

Hacemos software de inventario para negocios de moda. Le propongo un convenio sencillo: sus boutiques reciben de su parte un diagnóstico gratis de inventario y condiciones especiales por venir de usted. A usted le queda una comisión recurrente y una clienta que compra mejor y le compra más seguido.

Usted no opera nada.

¿Le explico cómo funciona en quince minutos?','texto','abrir con el ángulo de convenio y pedir quince minutos','demo'),
('canal','email','canal demo · correo 2',2,'por qué dejan de comprarle','Le platico por qué esto le toca a usted y no nada más a ellas.

Una boutique que compra a ojo se equivoca de dos maneras. Mete fondo de modelos que no se mueven y, con ese dinero detenido en piso, ya no le puede pedir la reposición del que sí se vendió. Un modelo trae ocho o diez tallas por color: es facilísimo quedarse sin la mediana y con seis extragrandes colgadas.

Eso usted lo ve en su pedido: clientas que compran fuerte una temporada y luego desaparecen medio año.

¿Cuántas de sus clientas le recompran cada temporada?','texto','mostrar que la mala compra de sus clientas le pega a él en el pedido','demo'),
('canal','email','canal demo · correo 3',3,'cómo queda armado el convenio','Le cuento cómo queda armado, para que lo juzgue.

Usted nos pasa a las clientas que quiera, o nada más nos deja mandarles un correo a nombre de {{nombre}}. A cada una le hacemos el diagnóstico gratis: con sus existencias y sus ventas le decimos cuánto dinero trae parado y qué tallas está dejando de vender. Sin costo y sin compromiso.

La que quiera quedarse con el sistema entra con precio especial por venir de usted, y de esa cuenta le corresponde una comisión mientras siga activa.

Instalación, capacitación y soporte los damos nosotros.

¿Cuántas clientas activas maneja hoy?','texto','explicar la mecánica exacta de la alianza','demo'),
('canal','email','canal demo · correo 4',4,'usted vende ropa no software','Sé lo que puede estar pensando: usted vende ropa, no software, y no quiere quedar de aval de nadie.

Por eso el convenio empieza al revés. Lo primero que reciben sus clientas no es una cotización, es un diagnóstico con sus propios números. Si no les sirve, ahí muere y usted quedó como quien les mandó algo útil.

Y si le preocupa que sus clientas no sean de sistemas, casi ninguna lo es. La mayoría lleva libreta o Excel, y el diagnóstico se hace con eso, aunque sea un archivo hecho a mano.

¿Le parece si lo probamos con dos o tres clientas de confianza?','texto','romper la objeción de quedar de aval de un tercero','demo'),
('canal','email','canal demo · correo 5',5,'una pregunta para su pedido','Le dejo algo que puede usar esta semana sin ningún convenio de por medio.

La próxima vez que una clienta le pida surtido, pregúntele qué tallas se le acabaron primero del pedido pasado. Casi ninguna lo sabe de memoria, y esa es justo la información que decide si vuelve a comprarle.

La que sí la tenga le va a pedir distinto: menos modelos y más fondo de lo que sí salió. Ese pedido se vende completo y regresa antes.

La que no la tenga le va a repetir el pedido del año pasado, se le va a quedar la mitad colgada y no le va a comprar en seis meses.

Es una sola pregunta y le dice cuáles de sus clientas van a crecer.

¿Se la ha hecho a alguna?','texto','regalar un método usable sin convenio','demo'),
('canal','email','canal demo · correo 6',6,'1.2 millones en 50 modelos','Le platico lo que aparece cuando uno mira el inventario de un negocio de moda en serio.

En un cliente nuestro, una cadena, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la pedían.

Una boutique de sus clientas maneja números mucho más chicos, pero es el mismo dinero detenido, y ese dinero es el que usted no ve convertido en pedido.

Por eso el convenio le sirve por los dos lados: sus clientas compran con cabeza y le compran más seguido, y de las que se quedan con el sistema le toca comisión.

¿Le acomoda una llamada de quince minutos esta semana o la que entra?','texto','usar el caso real y proponer la llamada','demo'),
('canal','email','canal demo · correo 7',7,'aquí le paro','[[si persona]]{{persona}}, [[/si]]no le sigo llenando el correo, así que aquí le paro.

Le escribí porque en el canal mayorista casi todo lo que se ofrece son descuentos, y el descuento no arregla el problema de fondo: una clienta que compra mal se queda sin dinero y deja de comprar. Un diagnóstico de inventario entregado a su nombre sí lo mueve, y a usted no le cuesta nada.

Si algún día quiere probarlo con dos o tres clientas de confianza, me escribe y lo armamos en una llamada. No le vuelvo a insistir.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad dejando la puerta abierta','demo'),
('canal','email','canal diagnostico · correo 1',1,'un beneficio para sus socios','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y le escribo por los negocios que agrupan, no por ustedes.

Hacemos software de inventario para moda. Antes de venderle a nadie hacemos un diagnóstico gratis: con las existencias y las ventas de un negocio, en quince minutos le decimos cuánto dinero trae parado y cuánto está perdiendo por faltantes.

Lo podemos abrir como beneficio a nombre de ustedes, sin costo para nadie.

¿Se lo explico en quince minutos?','texto','abrir ofreciendo el diagnóstico como beneficio del padrón','diagnostico'),
('canal','email','canal diagnostico · correo 2',2,'qué es dinero parado','Dinero parado no es la mercancía que nadie quiere. Esa ya se sabe. Es la que sí se vende, pero está en la talla, el color o el local donde no la piden.

En un negocio de moda chico eso son decenas de miles de pesos detenidos que el dueño no ve, porque de vista todo parece surtido. Un modelo trae ocho o diez tallas por color, y basta que falten dos tallas del que sí jala para que el mostrador diga que no hay.

Multiplíquelo por los negocios que agrupan y ahí está el tamaño de un problema que nadie les está midiendo.

¿Cuántos negocios tienen hoy en el padrón?','texto','definir dinero parado y multiplicarlo por el padrón','diagnostico'),
('canal','email','canal diagnostico · correo 3',3,'1.2 millones en 50 modelos','Le pongo el ejemplo más claro que tengo.

En un cliente nuestro, cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía comprada, pagada y vendible, nada más que no estaba donde la pedían.

Cincuenta modelos. La cadena maneja miles.

Un local de plaza o un taller con tienda maneja números mucho más chicos, pero el patrón es idéntico, y para ellos suele ser la diferencia entre pedir crédito y no pedirlo.

Eso es justo lo que sale del diagnóstico, con lo que cada quien tenga y sin cambiar de sistema.

¿Le mando la lista de lo que se necesita?','texto','contar el caso real y bajarlo a la escala de sus agremiados','diagnostico'),
('canal','email','canal diagnostico · correo 4',4,'no recomendamos proveedores','En una organización como la suya salen dos cosas, y las dos tienen sentido.

Una: nosotros no le recomendamos proveedores a nuestros socios. No le pido que recomiende nada. El diagnóstico es gratis, se entrega sin cotización adentro y cada negocio decide después si quiere herramienta o no.

Dos: ya tenemos convenios de tecnología. Casi siempre son descuentos en licencias, y un descuento no sirve de nada si el dueño todavía no sabe qué le está fallando. Aquí primero va el número y luego, si acaso, la herramienta.

¿Quién ve los convenios de beneficios ahí?','texto','romper las dos objeciones de una organización gremial','diagnostico'),
('canal','email','canal diagnostico · correo 5',5,'el método en una hoja','Le paso el método por si nunca trabajamos juntos. Sirve para cualquiera de sus negocios y no necesita sistema.

Que tomen sus veinte modelos más vendidos y los bajen a nivel talla y color. Dos columnas: cuánto tienen hoy y cuánto vendieron en los últimos treinta días.

De ahí salen dos listas. Faltante: existencia en cero con venta arriba de cero. Sobrante: tres o más piezas sin una sola venta en treinta días. El faltante se multiplica por el precio de venta y el sobrante por el costo.

El primer número es la venta que se les fue el mes pasado. El segundo es el dinero que traen detenido en piso, y casi siempre ese asusta más.

Si les sirve, eso mismo lo damos como taller para sus negocios.

¿Les interesaría un taller así?','texto','regalar el método de faltante y sobrante para sus agremiados','diagnostico'),
('canal','email','canal diagnostico · correo 6',6,'qué recibe cada negocio','Para que sepan qué estarían ofreciendo, esto es lo que recibe cada negocio.

Primero, su dinero detenido en pesos, abierto por familia de producto y no un total que no sirve para nada. Segundo, el faltante: qué tallas y colores se están vendiendo y ya están en cero, y qué venta les costó eso el mes pasado. Tercero, qué comprar y qué rematar antes del siguiente pedido. Y si tienen más de un punto de venta, qué conviene mover de uno a otro.

Lo armamos nosotros con su archivo, se entrega a nombre de ustedes y no lleva cotización adentro.

De los que después quieran el sistema, entran con condiciones especiales y a ustedes les queda una participación mientras sigan activos.

¿Con cuántos negocios les gustaría empezar?','texto','detallar el entregable y la mecánica del convenio','diagnostico'),
('canal','email','canal diagnostico · correo 7',7,'lo dejo hasta aquí','[[si persona]]{{persona}}, [[/si]]lo dejo aquí y le explico por qué insistí.

Casi todos los negocios de moda en México compran de memoria. No es flojera: un modelo son ocho o diez tallas por color, y nadie puede con eso en la cabeza mientras atiende, cobra y surte. Por eso el mismo dinero se queda detenido temporada tras temporada, y por eso muchos de los que ustedes agrupan crecen más lento de lo que podrían.

El diagnóstico gratis va a seguir en pie cuando quieran, para un negocio o para cien, sin costo y sin obligar a nadie a cambiar de sistema.

¿Lo retomo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad explicando el porqué de fondo','diagnostico'),
('charro','email','charro demo · correo 1',1,'una duda de sus trajes','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y me quedé con una duda de su operación: cuando un ballet le pide treinta trajes para el mismo festival, alguien tiene que saber ese día si el taller alcanza y qué paño hay en bodega.

Hacemos software de inventario para negocios de moda. El traje a la medida es de los casos más difíciles, porque cada pieza es un pedido.

¿Cómo llevan hoy esos pedidos de grupo?','texto','abrir con algo cierto y ofrecer la demo','demo'),
('charro','email','charro demo · correo 2',2,'treinta trajes, una fecha','En trajes de charro el inventario no es lo que está colgado. Es lo que está prometido.

Un pedido de grupo entra como uno solo y por dentro son treinta medidas distintas, con su botonadura, su paño y su gamuza. Si a la mitad del taller se acaba el hilo de un color, no se frena una pieza: se frenan las treinta.

Y el dinero entra partido. Anticipo al apartar, algo a media hechura, el resto en la entrega. Cuando el festival se recorre o el cliente se pierde, queda la tela cortada, el anticipo a medias y nadie sabe de quién era.

¿Cuántos pedidos de grupo traen abiertos ahorita?','texto','enseñar el dolor mecánico del giro','demo'),
('charro','email','charro demo · correo 3',3,'el pedido de grupo por dentro','Le cuento cómo lo resolvemos, para que juzgue si le sirve.

Un pedido de grupo se abre como un solo documento con fecha de festival, y por dentro cada traje trae su renglón: nombre, medidas, color, avance. Se ve en una pantalla quién ya pasó a corte, quién está en prueba y quién no ha dado su anticipo.

Abajo va el material. Al confirmar el pedido, el sistema descuenta el paño y la botonadura de bodega y le avisa qué le falta comprar antes de empezar, no a media hechura.

Y el dinero por cliente: quién abonó, cuánto debe y qué se entrega contra qué pago.

¿Cuántos trajes sacan en temporada alta?','texto','mostrar cómo se resuelve por dentro','demo'),
('charro','email','charro demo · correo 4',4,'somos chicos para un sistema','Me lo dicen seguido: «somos un taller chico, con la libreta nos entendemos». Y es cierto un buen rato.

Pero el taller chico es justo el que no aguanta un error. Si una medida se anotó mal y el traje sale angosto, ahí se fue el paño, la mano de obra y la fecha del festival. Si un cliente abonó dos veces y nadie apuntó la segunda, se cobra de más y se pierde al cliente.

No se trata de contratar gente ni de complicarse. Se trata de que la libreta deje de estar en la cabeza de una sola persona.

¿Quién lleva hoy las medidas y los abonos?','texto','romper la objeción de tamaño','demo'),
('charro','email','charro demo · correo 5',5,'cuánto cuesta de verdad','Le dejo algo que puede hacer esta semana sin comprarme nada.

Agarre los tres trajes que más vende y cuéntelos por dentro. Metros de paño, botonadura, gamuza, hilo, forro, y las horas de taller que se llevó cada uno. Ponga precio a cada renglón, incluidas las horas.

Casi siempre pasan dos cosas. La primera es que el traje de gala cuesta bastante más de lo que se creía, porque la botonadura y las horas se cuentan por encima. La segunda es que hay un modelo sencillo que deja mejor margen que el caro y nadie lo empuja.

Con eso ya sabe qué cotizar diferente y qué ofrecer primero cuando entra un grupo grande.

¿Tiene medidas las horas de taller por traje?','texto','dar algo útil aunque no compren','demo'),
('charro','email','charro demo · correo 6',6,'1.2 millones en cincuenta modelos','Un ejemplo de lo que aparece cuando uno se sienta a mirar el inventario en serio.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la gente la pedía.

En su giro eso se ve como rollos de paño de un color que ya no se pide, botonadura comprada de más para un pedido que se cayó, y trajes de exhibición en la sucursal donde no hay festivales.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propios trajes y materiales, y usted juzga si le sirve.

¿Le acomoda esta semana o la que entra?','texto','contar el caso real y proponer la demo','demo'),
('charro','email','charro demo · correo 7',7,'hasta aquí le escribo','[[si persona]]{{persona}}, [[/si]]no le quiero seguir llenando la bandeja, así que hasta aquí le escribo.

Le insistí porque los talleres de charro y de folclórico son los que peor la pasan con los sistemas de tienda: ninguno entiende que se vende algo que todavía no existe, que se cobra en tres partes y que un solo cliente puede traer treinta medidas distintas. Casi todos los tratan como si vendieran playeras de talla mediana.

Si algún día se les junta la temporada de festivales, abren otro taller o nada más quieren ver cómo se vería su catálogo por dentro, me escribe y lo vemos en veinte minutos. No le vuelvo a insistir.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('charro','email','charro diagnostico · correo 1',1,'quince minutos con su inventario','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]] y que traen {{sucursales}} sucursales[[/si]]. Con varias tiendas, el paño y los trajes de exhibición terminan repartidos por corazonada, no por venta.

Hacemos inventario para negocios de moda. Regalamos un diagnóstico: con su información, en quince minutos le decimos cuánto dinero trae parado y cuánto se le va por lo que no tuvo a la mano.

¿Le late que lo hagamos con sus números?','texto','abrir con sus sucursales y ofrecer el diagnóstico','diagnostico'),
('charro','email','charro diagnostico · correo 2',2,'el paño que nadie mueve','Dinero parado es material y mercancía que ya pagó y que está donde nadie la pide.

En su giro pesa el doble, porque el traje vale mucho por pieza y el material se compra por rollo. Un color que se dejó de usar no son tres piezas muertas: son metros completos.

Con una sola tienda se nota, usted ve el rollo ahí. Con varias deja de notarse, porque cada quien ve su bodega y todos creen que lo suyo está bien. Y luego una sucursal compra paño que la otra tiene guardado desde hace dos temporadas.

¿Saben hoy qué material hay en cada sucursal sin ir a contarlo?','texto','explicar el dinero parado con varias plazas','diagnostico'),
('charro','email','charro diagnostico · correo 3',3,'el caso de los cincuenta modelos','Le paso el caso concreto, porque explica mejor que cualquier discurso.

En un cliente nuestro, una cadena de moda, revisamos 50 modelos. Aparecieron 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas: mercancía ya comprada y pagada que no estaba donde se vendía.

Nadie robó nada y las cuentas cuadraban. El problema fue el reparto: cada tienda pidió por lo que sentía y nadie miró el conjunto.

En trajes de charro el mismo error se paga más caro, porque cada pieza vale lo que valen diez playeras y el material se compra por rollo entero.

¿Hacemos ese mismo ejercicio con sus modelos?','texto','contar el caso real','diagnostico'),
('charro','email','charro diagnostico · correo 4',4,'sin tocar su base','Dos frases que oigo siempre, y las dos tienen razón de ser.

«No les paso mi información.» No hace falta la base completa. Con las existencias por sucursal y las ventas de los últimos meses alcanza. Sin datos de clientes, sin costos si no los quiere compartir. Y si prefiere, lo vemos juntos en pantalla y no sale nada de su oficina.

«Ya tenemos un sistema.» Seguro sí, y seguro registra bien lo que ya pasó. El diagnóstico no le pide cambiarlo: le dice qué mover y qué dejar de comprar con lo que ya tiene guardado.

¿Cuál de las dos le detiene más?','texto','romper las dos objeciones de datos y sistema','diagnostico'),
('charro','email','charro diagnostico · correo 5',5,'mídalo usted en una tarde','Le dejo el método por si prefiere medirlo usted, sin contratarnos.

Haga dos listas. La primera, de trajes terminados y de exhibición: por cada uno anote en qué sucursal está y cuándo fue la última vez que se vendió uno igual. Todo lo que lleve más de dos temporadas sin salir de esa plaza es dinero parado, y casi siempre se vende en otra.

La segunda, de material: metros de paño por color y por sucursal, contra los pedidos que hizo el último año. Ahí va a ver colores con años de existencia y colores que se le acaban a media hechura.

Sume el costo de las dos listas. Ese número es lo que trae detenido, y casi todo se arregla moviendo, no comprando.

¿Tiene el inventario separado por sucursal?','texto','regalar el método de medición','diagnostico'),
('charro','email','charro diagnostico · correo 6',6,'las cuatro salidas del diagnóstico','Para que sepa qué recibe antes de decir que sí.

Con su archivo de existencias y ventas, en quince minutos le entregamos cuatro cosas.

Uno: cuánto dinero trae parado en pesos y en qué sucursal está, separando trajes terminados de material.

Dos: qué modelos y qué tallas le faltaron donde sí se venden, con la venta que dejó de hacer.

Tres: una lista de movimientos concretos, del tipo mandar estas piezas de esta plaza a esta otra, ordenada por lo que más pesa en pesos.

Cuatro: qué no debería volver a comprar la próxima temporada porque ya lo tiene guardado.

Si no le sirve, se queda con las cuatro salidas y ahí la dejamos. No hay contrato ni letras chiquitas.

¿Le mando la lista de lo que necesitamos?','texto','detallar qué entregan los quince minutos','diagnostico'),
('charro','email','charro diagnostico · correo 7',7,'ya no le insisto','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no quiero volverme ruido, así que ya no le insisto.

Seguí porque en un negocio de trajes a la medida, con varias plazas, el dinero rara vez está perdido: está detenido en el paño equivocado, en la sucursal equivocada, o en anticipos de pedidos que nadie cerró. Eso no sale en el reporte de ventas y sí sale cruzando existencia contra venta, plaza por plaza.

La oferta se queda ahí por si algún día cambia el momento: quince minutos, su información y cuatro salidas concretas, sin compromiso.

¿Le vuelvo a escribir después de la temporada de festivales o mejor lo saco de la lista?','texto','cerrar con dignidad','diagnostico'),
('joyeria','email','joyeria demo · correo 1',1,'el precio del oro hoy','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}} en {{ciudad}}. Le escribo por algo muy de su oficio: el oro se mueve todos los días y el precio de sus piezas, no. Casi todas las joyerías recostean a mano cuando el metal ya se movió mucho, y mientras tanto venden con el costo de hace tres meses.

Hacemos un sistema de inventario para moda y joyería que cotiza por metal, pureza, gramos, gemas y mano de obra.

¿Cada cuándo actualizan hoy sus precios?','texto','abrir con algo cierto y ofrecer la demo','demo'),
('joyeria','email','joyeria demo · correo 2',2,'10, 14 y 18 quilates','El costeo de joyería es un infierno a mano por una razón simple: cada pieza es una suma de cosas que se mueven por separado.

Un anillo de 14 quilates no cuesta lo mismo que el mismo modelo en 18, y ninguno de los dos cuesta lo mismo que ayer. Encima va la plata por ley, las gemas por quilate y calidad, la mano de obra y la merma.

Cuando todo eso vive en una hoja de Excel, hay una sola persona que la sabe usar. Y el mostrador termina cotizando de memoria.

¿Quién saca hoy los precios de las piezas nuevas?','texto','enseñar el dolor del costeo a mano','demo'),
('joyeria','email','joyeria demo · correo 3',3,'el precio sigue al metal','Le cuento cómo lo hacemos, para que juzgue si le sirve.

Usted captura la pieza una vez: metal y pureza, gramos, gemas, mano de obra y el margen que quiere dejar. El sistema jala el precio del metal y recalcula solo. Si el oro sube, sus precios suben; si baja, usted decide si baja o se queda con más margen. Lo mismo con la plata por ley.

Y además cada pieza queda en inventario como cualquier producto de tienda: se vende, se aparta, se traspasa entre sucursales y se cuenta.

¿Cuántos modelos distintos manejan hoy?','texto','mostrar cómo se resuelve por dentro','demo'),
('joyeria','email','joyeria demo · correo 4',4,'el excel de una persona','La objeción que más oigo es que el Excel de costeo ya funciona y lleva años funcionando.

Seguro sí. El problema no es el archivo, es que depende de quien lo hizo. Si esa persona no está, la joyería cotiza a ojo. Y como recostear todo es una friega, se recostea cuando el oro ya se movió feo, no cuando se movió tantito. En ese rato se vende barato sin darse cuenta.

No le pido que tire su Excel. Le pido que una tarde compare el precio que le da su archivo contra el que da el sistema.

¿Le interesa esa comparación?','texto','romper la objeción del costeo actual','demo'),
('joyeria','email','joyeria demo · correo 5',5,'revise sus piezas viejas','Le dejo un ejercicio que puede hacer sin comprarme nada, y que casi siempre duele.

Agarre diez piezas que lleven más de un año en exhibición. Para cada una calcule qué costaría hacerla hoy: gramos por precio actual del metal, más gemas, más mano de obra. Compare ese número contra la etiqueta que trae puesta.

En casi toda joyería salen dos grupos. Piezas cuya etiqueta se quedó abajo del costo de reposición, que es vender perdiendo sin saberlo. Y piezas cuya etiqueta se quedó tan arriba que por eso llevan un año ahí.

Con ese solo ejercicio ya sabe cuál reetiquetar y cuál mandar a fundir.

¿Cuántas piezas lleva más de un año en el mostrador?','texto','dar algo útil aunque no compren','demo'),
('joyeria','email','joyeria demo · correo 6',6,'1.2 millones en 50 modelos','Le comparto algo que encontramos en otro cliente. Es una cadena de moda, no joyería, pero el mecanismo es idéntico.

Revisamos 50 modelos y aparecieron 1.2 millones de pesos mal repartidos entre la bodega y las tiendas. Mercancía comprada y pagada que no estaba donde la pedían.

En joyería eso pesa más, porque cada pieza detenida es oro quieto. Un exhibidor con las mismas piezas seis meses seguidos no es catálogo, es capital dormido.

Si quiere, en veinte minutos le enseño el sistema con sus propias piezas cargadas: costeo por quilate, plata por ley, gemas y mano de obra, y cómo se ve el inventario de vitrina.

¿Le acomoda algún día de esta semana?','texto','contar el caso real y proponer la demo','demo'),
('joyeria','email','joyeria demo · correo 7',7,'lo dejo por aquí','[[si persona]]{{persona}}, [[/si]]ya no le escribo más, lo dejo por aquí.

Le insistí porque la joyería es el único giro de moda donde el costo de lo que uno vende cambia mientras uno duerme. Los demás negocios compran una playera y ya saben para siempre lo que les costó. Ustedes no. Por eso el sistema de tienda normal nunca les acaba de servir: no sabe qué es un quilate ni qué es una ley, y termina tratando un anillo de oro como si fuera una blusa.

Si algún día se cansan de recostear a mano, o de que el precio dependa de una sola persona, me escribe y lo vemos en veinte minutos. Aquí queda el correo, sin fecha de vencimiento.

¿Le parece si le escribo de nuevo el año que entra?','texto','cerrar con dignidad','demo'),
('joyeria','email','joyeria diagnostico · correo 1',1,'sus vitrinas y el oro','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}} en {{ciudad}}[[si sucursales]], con {{sucursales}} sucursales[[/si]]. Con varias vitrinas siempre queda oro quieto: piezas que llevan meses en una tienda y se venderían en otra.

Hacemos inventario para moda y joyería. Con su información le decimos en 15 minutos cuánto capital tiene detenido en piezas que no rotan y cuánta venta se cae por no tener el modelo donde lo piden. Sin costo.

¿Le mando qué necesitaríamos de su lado?','texto','abrir con algo cierto y ofrecer el diagnóstico','diagnostico'),
('joyeria','email','joyeria diagnostico · correo 2',2,'oro dormido por sucursal','En joyería el dinero parado se ve distinto que en ropa, porque casi no se ve.

Una blusa que no sale ocupa un gancho y estorba. Un anillo que no sale ocupa dos centímetros de vitrina y nadie lo nota. Puede llevar dos años ahí, valiendo lo mismo o más, y por eso duele menos. Pero sigue siendo capital detenido.

Con varias tiendas se multiplica: cada sucursal arma su propia colección de piezas dormidas y nadie las compara entre sí. Y casi siempre la pieza dormida de una es la que a la otra le hace falta.

¿Saben hoy cuántas piezas llevan más de un año sin moverse?','texto','explicar el dinero parado en joyería','diagnostico'),
('joyeria','email','joyeria diagnostico · correo 3',3,'un reparto mal hecho','El ejemplo que mejor explica lo que hacemos.

En un cliente nuestro, cadena de moda, revisamos 50 modelos. Solo 50. Entre el centro de distribución y las tiendas encontramos 1.2 millones de pesos mal repartidos: mercancía comprada y pagada que no estaba donde la pedían.

No habían comprado mal. Habían repartido mal, que es un error más caro porque no aparece en ningún reporte. La compra se revisa; el reparto nadie lo revisa.

En joyería el mismo ejercicio pega más fuerte, porque el ticket por pieza es alto y lo detenido es oro. Eso es lo que mediríamos en su diagnóstico.

¿Me puede compartir un respaldo de inventario para correrlo?','texto','contar el caso real','diagnostico'),
('joyeria','email','joyeria diagnostico · correo 4',4,'no necesito su base completa','Le adelanto la duda normal: pasarle el inventario de una joyería a alguien de fuera no se hace a la ligera.

Para el diagnóstico no necesito su base completa. Con el modelo, la sucursal, los gramos y las ventas del año alcanza. Sin datos de clientes y sin costos de proveedor si prefiere. Convenio de confidencialidad si lo pide, y el archivo se borra al terminar.

Y si ya tienen sistema o ERP, mejor: el diagnóstico no lo reemplaza, nada más le dice si el reparto entre sus tiendas está bien hecho.

¿Con qué llevan hoy el inventario?','texto','romper la objeción de datos y del sistema actual','diagnostico'),
('joyeria','email','joyeria diagnostico · correo 5',5,'el cruce de las vitrinas','Esto lo puede hacer usted sin nosotros, y vale la pena aunque no volvamos a hablar.

Saque una lista por sucursal con dos datos por modelo: piezas en existencia y piezas vendidas en el año. Ponga las tiendas una junto a otra. Busque los modelos donde una tienda vendió todo y se quedó en cero, mientras otra tiene tres piezas del mismo modelo sin vender ninguna.

Cada uno de esos renglones es un traspaso que debió hacerse. Sume el precio de venta de las piezas dormidas y va a tener, a mano, una primera versión del número que le daríamos nosotros.

Si le sale chico, olvídese de mí. Si le sale grande, ahí sí platicamos.

¿Puede armar ese cruce con lo que tiene hoy?','texto','dar un método útil aunque no compren','diagnostico'),
('joyeria','email','joyeria diagnostico · correo 6',6,'qué le entregamos exactamente','Para que sepa qué recibe, se lo enumero sin adorno. El diagnóstico entrega cuatro números.

Uno, cuánto capital tiene detenido en piezas sin rotación, tienda por tienda. Dos, qué modelos conviene mover de una sucursal a otra y en qué orden. Tres, cuánta venta se perdió por no tener el modelo donde lo pidieron. Cuatro, qué piezas ya se quedaron abajo del costo de reposición del metal y hay que reetiquetar antes de venderlas.

Son quince minutos de junta y el archivo se lo queda usted, trabajemos juntos o no. Lo hacemos así porque es más fácil enseñarle el número que contarle lo bonito que está el sistema.

¿Le aparto quince minutos esta semana?','texto','explicar qué entrega el diagnóstico','diagnostico'),
('joyeria','email','joyeria diagnostico · correo 7',7,'lo dejo por aquí','[[si persona]]{{persona}}, [[/si]]lo dejo por aquí, ya no le escribo más.

Le busqué porque una joyería con varias sucursales carga dos problemas al mismo tiempo: el costo de lo que vende cambia todos los días con el metal, y el reparto entre vitrinas casi nunca lo revisa nadie. Cualquiera de los dos, por separado, ya cuesta dinero. Juntos cuestan bastante más.

El diagnóstico sigue disponible y sigue sin costo, haya compra o no la haya. Si algún día quieren ver el número, aquí sigo y con eso basta.

¿Le vuelvo a escribir pasando la temporada o mejor lo saco de la lista?','texto','cerrar con dignidad','diagnostico'),
('novias','email','novias demo · correo 1',1,'una duda de sus apartados','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y me quedé pensando en una parte de su operación: cuando una novia aparta su vestido para una boda de octubre, alguien tiene que saber si ese modelo, en esa talla, va a estar listo a tiempo.

Hacemos software de inventario para negocios de moda. Las novias son el caso más delicado, porque no hay segunda oportunidad.

¿Hoy llevan los apartados en libreta, en Excel o en algún sistema?','texto','abrir con algo cierto y ofrecer la demo','demo'),
('novias','email','novias demo · correo 2',2,'la talla del muestrario','En novias el inventario no es cuántos vestidos tienen colgados. Es qué modelo, en qué talla y para qué fecha.

Un modelo vive en ocho o diez tallas, y el muestrario casi nunca es la talla de la novia. La pieza que ella se probó se queda en el aparador y la suya se pide al proveedor con meses de anticipo.

Entre el día que se prueba y el día de la boda pasan pruebas, ajustes, un anticipo, una liquidación y un taller. Si una de esas fechas se corre, se corre todo lo demás.

¿Cuántos vestidos traen apartados al mismo tiempo en temporada?','texto','enseñar el dolor mecánico con números del oficio','demo'),
('novias','email','novias demo · correo 3',3,'una ficha por novia','Le cuento cómo lo resolvemos, para que juzgue si le sirve.

Cada venta deja de ser una línea y se vuelve una ficha con fecha de boda: modelo, talla pedida, qué día entra la prueba, qué día lo recibe el taller y qué día se entrega. El sistema cuenta hacia atrás desde la boda, no hacia adelante desde hoy.

Encima va el dinero: anticipo, abonos, saldo y quién autorizó el descuento. Y el pedido especial al proveedor queda amarrado a esa novia, así que cuando llega, llega con nombre y apellido, no a la bodega.

¿Cuántos vestidos entregan en una temporada buena?','texto','mostrar cómo se resuelve por dentro','demo'),
('novias','email','novias demo · correo 4',4,'la libreta no avisa','Muchas boutiques de novia llevan todo en una libreta de apartados, y funciona un buen rato. El problema no es que esté mal hecha.

Es que no avisa. No le dice que el vestido de la boda del 12 lleva tres semanas sin llegar del proveedor. No recuerda que esa novia debe la segunda parcialidad. No sabe que el taller tiene seis prendas encimadas la misma semana.

Y el día que no está la persona que se sabe todo de memoria, la que atiende no puede prometer una fecha sin ir a preguntar.

No le digo que su control esté mal. Le digo que ya llegó a su tope.

¿Quién lleva hoy esa libreta?','texto','romper la objeción del control actual','demo'),
('novias','email','novias demo · correo 5',5,'qué tallas sí venden','Le dejo algo que puede hacer esta semana sin comprarme nada.

Saque las ventas del último año y arme dos columnas por modelo: en qué tallas se pidió y cuántos días pasaron entre el apartado y la boda.

La primera columna le dice qué muestrario debería tener colgado. Muchas boutiques cargan el aparador con la talla que se ve bonita en el maniquí y venden otra, y esa diferencia se paga en ajustes de taller.

La segunda le dice su verdadero tiempo de anticipación. Si su promedio son cuatro meses y su proveedor tarda tres, no tiene margen: cualquier retraso se lo come el taller o la novia.

Con eso ya sabe qué pedir de muestrario y hasta cuándo puede aceptar una boda encimada.

¿Tiene registradas las fechas de boda del año pasado?','texto','dar algo útil aunque no compren','demo'),
('novias','email','novias demo · correo 6',6,'lo que aparece en 50 modelos','Un ejemplo de lo que aparece cuando uno mira el inventario en serio.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la gente la pedía.

En novias el mismo problema tiene otra cara: muestrarios repetidos de modelos que ya nadie pide, tallas que se maltrataron de tanto probarse y siguen contando como inventario bueno, y anticipos de vestidos que llevan meses sin llegar.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propios modelos y usted juzga si le sirve.

¿Le acomoda esta semana o la que entra?','texto','contar el caso real y proponer la demo','demo'),
('novias','email','novias demo · correo 7',7,'aquí le paro','[[si persona]]{{persona}}, [[/si]]no le quiero seguir llenando el correo, así que aquí le paro.

Le escribí porque las boutiques de novia son de las que peor la pasan con los sistemas de tienda normales: ninguno entiende que una venta empieza hoy y se entrega dentro de seis meses, que hay un anticipo de por medio y que la pieza pasa por taller antes de salir. Casi todos los tratan como si vendieran playeras.

Si algún día se les encima una temporada, abren otra sucursal o nada más quieren ver cómo se vería su catálogo por dentro, me escribe y lo vemos en veinte minutos. No le voy a volver a insistir.

¿Le escribo otra vez el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('novias','email','novias diagnostico · correo 1',1,'quince minutos con sus números','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]] y que traen {{sucursales}} sucursales[[/si]]. Con varias tiendas de novia, el vestido que una clienta pidió en una casi siempre está colgado en otra.

Hacemos inventario para negocios de moda. Ofrecemos un diagnóstico gratis: con su información, en quince minutos les decimos cuánto dinero traen parado y cuánto se les va por faltantes.

¿Le interesa que lo hagamos con sus números?','texto','abrir con sus sucursales y ofrecer el diagnóstico','diagnostico'),
('novias','email','novias diagnostico · correo 2',2,'dinero parado entre tiendas','Dinero parado es mercancía que ya pagó y que está donde nadie la pide.

En una tienda sola se nota: usted ve el vestido colgado desde marzo. Con varias tiendas deja de notarse, porque cada gerente ve nada más su piso y todos creen que lo suyo está bien.

Y se multiplica por las tallas. Un modelo de novia vive en ocho o diez tallas. Si en la sucursal grande sobran las chicas y en la otra faltan, las dos pierden venta al mismo tiempo y en el corporativo aparece como que hay existencia.

[[si sucursales]]Con {{sucursales}} sucursales eso ya no se ve a ojo.

[[/si]]¿Cada cuánto revisan qué se mueve entre tiendas?','texto','explicar qué es dinero parado y por qué se multiplica','diagnostico'),
('novias','email','novias diagnostico · correo 3',3,'50 modelos, 1.2 millones','Le paso el caso que hace que la gente nos conteste.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos. Encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas: mercancía ya comprada y pagada que no estaba donde se vendía.

No fue robo ni mal cierre de mes. Fue reparto. Cada tienda pidió lo que creía y nadie miró el conjunto.

En novias duele más, porque el vestido que no está el día que la clienta lo pide no se vende después: se va con la competencia y no vuelve.

¿Quiere que hagamos ese mismo ejercicio con sus modelos?','texto','contar el caso real','diagnostico'),
('novias','email','novias diagnostico · correo 4',4,'sobre pasarnos su información','Dos cosas que me dicen seguido, y las dos son justas.

La primera: «no les voy a pasar mi base». No hace falta. Con un archivo de existencias por tienda y las ventas de los últimos meses alcanza. Sin nombres de clientes, sin costos si no quiere. Y si prefiere, lo vemos en pantalla con usted y no se lleva nada nadie.

La segunda: «ya tenemos sistema». Casi siempre sí, y casi siempre guarda bien lo que pasó. El diagnóstico no compite con eso: le dice qué hacer con lo que ya tiene, tienda por tienda y talla por talla.

¿Cuál de las dos le preocupa más?','texto','romper la objeción de la base y del sistema actual','diagnostico'),
('novias','email','novias diagnostico · correo 5',5,'cómo medirlo usted mismo','Le dejo el método para que lo mida usted, aunque no nos contrate.

Tome sus veinte modelos más vendidos. Para cada uno, saque por tienda dos números del último trimestre: piezas en existencia hoy y piezas vendidas.

Divida existencia entre venta mensual. Le queda cuántos meses de venta trae encima cada modelo en cada tienda. Marque en rojo lo que pase de tres meses y en amarillo lo que esté abajo de uno.

Los rojos de una tienda casi siempre son los amarillos de otra. Eso que ve ahí es su dinero parado y su faltante, y casi todo se arregla moviendo, no comprando.

Con veinte modelos ya se le nota el patrón. Nosotros lo hacemos con el catálogo completo y por talla, pero el ejercicio es el mismo.

¿Le sale el dato de existencia por tienda?','texto','regalar el método aunque no contraten','diagnostico'),
('novias','email','novias diagnostico · correo 6',6,'qué sale de los quince minutos','Para que sepa exactamente qué recibe, sin sorpresas.

En quince minutos, con su archivo de existencias y ventas, le entregamos cuatro cosas.

Uno: cuánto dinero trae parado, en pesos, y en qué tiendas está.

Dos: qué modelos y qué tallas le están faltando donde sí se venden, con la venta que eso le cuesta.

Tres: una lista de traspasos concretos, del tipo mandar estas piezas de esta tienda a esta otra, ordenada por lo que más pesa.

Cuatro: qué debería dejar de comprar la próxima temporada porque ya lo tiene, nada más que en el lugar equivocado.

Si al final no le sirve, se queda con las cuatro salidas y no nos volvemos a hablar. No hay letras chiquitas.

¿Le paso la lista de lo que necesitamos?','texto','detallar las salidas concretas del diagnóstico','diagnostico'),
('novias','email','novias diagnostico · correo 7',7,'cierro el tema aquí','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no quiero volverme parte del ruido, así que cierro el tema aquí.

Le insistí porque en una cadena de novias el dinero casi nunca está perdido: está mal repartido. Y eso no se ve desde el reporte de ventas, se ve cruzando existencia contra venta, tienda por tienda y talla por talla. Es un rato de trabajo, no un proyecto de meses.

La oferta se queda parada por si algún día cambia el momento: quince minutos, su información, cuatro salidas concretas y sin compromiso. Cuando quiera, me escribe.

¿Le vuelvo a tocar la puerta en la próxima temporada o mejor lo saco de la lista?','texto','cerrar con dignidad','diagnostico'),
('operadores','email','operadores demo · correo 1',1,'tienda y marcas ajenas','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]]. Me llamó la atención porque su operación es dos cosas a la vez: tienda y administrador de marcas que no son suyas.

Hacemos software de inventario y punto de venta para moda. Lo que más nos buscan operaciones como la suya es poder llevar de quién es cada pieza, qué comisión deja y hasta cuándo se queda, sin sacarlo en un Excel aparte.

Si quiere, en veinte minutos se lo enseño con sus propios productos.

¿Cuántas marcas manejan hoy?','texto','abrir nombrando su doble papel y ofrecer la demo','demo'),
('operadores','email','operadores demo · correo 2',2,'cada pieza tiene apellido','El problema de fondo es que los sistemas de tienda dan por hecho que usted es dueño de lo que vende.

Usted no. Cada pieza tiene apellido: de qué marca es, con qué comisión entró, si es propia o a consignación, y qué día se devuelve o se liquida. Eso ya son cuatro datos por pieza, encima de talla y color, que de por sí son ocho o diez tallas por modelo.

El resultado se ve a fin de mes: la venta cuadra, pero el estado de cuenta de cada marca se arma a mano y siempre queda algo que nadie sabe si se vendió, se devolvió o sigue en piso.

¿Cómo arman hoy la cuenta de cada marca?','texto','nombrar el dolor mecánico de la consignación y las marcas ajenas','demo'),
('operadores','email','operadores demo · correo 3',3,'el dueño va en la pieza','Le cuento cómo funciona por dentro, para que juzgue.

Cada producto vive por talla y color, y encima carga a quién pertenece, con qué esquema entró y su fecha límite. Cuando se vende una pieza, el sistema ya sabe de quién era y cuánto le toca a cada quien, así que no hay que reconstruirlo después.

De ahí sale solo el corte por marca, lo que hay que pagarle o cobrarle a cada una, y qué piezas ya se pasaron de fecha y conviene devolver antes de que sigan ocupando piso.

Y si tiene más de un punto de venta, ese mismo control se ve por tienda, con traspasos incluidos.

¿Trabajan a consignación, en firme o de las dos formas?','texto','mostrar cómo se resuelve por dentro','demo'),
('operadores','email','operadores demo · correo 4',4,'cada marca su propio portal','La objeción que me dicen seguido es que cada marca les da su portal o su reporte, y que con eso van.

Pasa, pero eso resuelve el reporte de la marca, no su operación. Usted necesita ver el piso completo: qué se vendió, de quién era y qué le dejó, todo junto y en el mismo lugar. Con cinco marcas son cinco ventanas y un Excel que las junta a mano.

Y ese Excel aguanta hasta que se descuadra una comisión, o hasta que alguien pide su mercancía de vuelta y no hay cómo probar qué se vendió y qué se devolvió.

¿Cuántos sistemas distintos están usando hoy?','texto','romper la objeción de los sistemas que impone cada marca','demo'),
('operadores','email','operadores demo · correo 5',5,'desde cuándo está cada pieza','Le dejo algo que puede hacer esta semana sin comprarme nada.

Saque las piezas que trae en piso y póngales dos datos: de qué marca son y desde qué fecha están ahí. Nada más eso.

Ordene por fecha, de la más vieja a la más nueva, y corte a los noventa días. Lo que quede arriba es piso ocupado por mercancía que no se movió en un trimestre, y casi siempre está concentrado en dos o tres marcas.

Si esa mercancía es a consignación, ese corte es una conversación directa: cambio de piezas, ajuste de comisión o devolución. Si es propia, es la lista de rebaja que debió salir hace rato.

Es media hora de trabajo y le dice qué marcas le están ocupando el piso gratis.

¿Sabe hoy desde cuándo está cada pieza en tienda?','texto','regalar el método de antigüedad de piso','demo'),
('operadores','email','operadores demo · correo 6',6,'1.2 millones en 50 modelos','Le platico lo que aparece cuando uno mira el inventario en serio.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la pedían.

En una operación como la suya el mismo problema tiene otra cara: piezas de una marca amontonadas donde no se piden mientras la que sí jala está agotada de talla, y comisiones calculadas sobre datos que nadie alcanzó a cuadrar.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propios productos, con marcas y comisiones puestas, y usted juzga.

¿Le acomoda esta semana o la que entra?','texto','usar el caso real y proponer la demo con sus productos','demo'),
('operadores','email','operadores demo · correo 7',7,'aquí le paro','[[si persona]]{{persona}}, [[/si]]no le sigo llenando el correo, así que aquí le paro.

Le escribí porque ustedes caen en un hueco: los sistemas de marca sirven para quien fabrica, los de tienda sirven para quien compra en firme, y usted hace las dos cosas al mismo tiempo. Por eso casi todos acaban con un Excel aparte para comisiones y devoluciones, y ese Excel es justo donde se pierde el dinero.

Si algún día suman una marca más, abren otro punto o les toca cerrar la cuenta de una marca que se va, me escribe y lo vemos en veinte minutos. No le vuelvo a insistir.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad nombrando el hueco de herramientas','demo'),
('operadores','email','operadores diagnostico · correo 1',1,'inventario que no es suyo','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si sucursales]] y sus {{sucursales}} puntos de venta[[/si]]. Operar tiendas de marcas ajenas es de lo más difícil de medir: cada pieza trae dueño, comisión y fecha, encima de talla y color.

Hacemos software de inventario para moda. Antes de venderle nada ofrecemos un diagnóstico gratis: con su información, en quince minutos le decimos cuánto dinero tiene parado y cuánto pierde por faltantes, abierto por marca y por tienda.

¿Se lo saco esta semana?','texto','abrir con sus puntos de venta y ofrecer el diagnóstico','diagnostico'),
('operadores','email','operadores diagnostico · correo 2',2,'piso que ocupa otro','Dinero parado no es la mercancía que nadie quiere. Es la que sí se vende, pero está en la talla, el color o la tienda donde no la piden.

En su caso hay una vuelta más: ese inventario muchas veces ni es suyo, y aun así le ocupa piso, vitrina y personal. Un modelo son ocho o diez tallas por color; multiplíquelo por las marcas que maneja y por cada tienda, y son decenas de miles de decisiones al mes que hoy se toman a criterio del gerente.

Y cuando el reparto sale mal, la marca lo lee como que su tienda no vende.

¿Cómo deciden hoy qué marca va a cada tienda?','texto','definir dinero parado con la vuelta de la mercancía ajena','diagnostico'),
('operadores','email','operadores diagnostico · correo 3',3,'1.2 millones en 50 modelos','Le pongo el ejemplo más claro que tengo.

En un cliente nuestro, cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía comprada, pagada y vendible, nada más que no estaba donde la pedían.

Cincuenta modelos. Usted maneja bastante más que eso, y encima repartido entre marcas distintas que compiten por el mismo piso.

En quince minutos le sacamos ese mismo número con sus datos, abierto por marca y por tienda, sin que cambie de sistema ni toque lo que ya tiene instalado.

¿Le mando la lista de lo que necesito?','texto','contar el caso real a la escala de un operador multimarca','diagnostico'),
('operadores','email','operadores diagnostico · correo 4',4,'los datos son de las marcas','En operaciones como la suya salen dos objeciones, y las dos son válidas.

Una: las marcas nos imponen su sistema. Casi siempre le imponen el reporte, no el control interno. El diagnóstico no toca nada de lo que ya tiene instalado ni le pide cambiar de herramienta.

Dos: los datos no son míos, son de las marcas. Entendido. Nos alcanza con existencias por tienda y unidades vendidas de los últimos meses. Sin nombres de clientes, sin precios de compra si prefiere, y con confidencialidad firmada antes de que nos mande el primer archivo.

¿Puede sacar existencias por tienda y por talla?','texto','romper la objeción del sistema impuesto y la de entregar datos','diagnostico'),
('operadores','email','operadores diagnostico · correo 5',5,'faltante y sobrante por marca','Le paso el método por si nunca trabajamos juntos.

Tome sus veinte modelos más vendidos de cada marca importante y bájelos a talla y color por tienda. Dos columnas: existencia de hoy y unidades vendidas en los últimos treinta días.

Saque dos listas. Faltante: existencia en cero con venta arriba de cero. Sobrante: tres o más piezas con cero venta en treinta días. Multiplique el faltante por precio de venta y el sobrante por costo.

Luego cruce las dos listas entre tiendas. Ahí sale la parte que más duele: buena parte de lo que falta en una tienda está sobrando en otra, ya pagado y ya en su piso.

Si además lo abre por marca, va a ver rápido cuál le está ocupando el piso sin dejarle nada.

¿Puede bajarlo a nivel talla o su sistema solo da modelo?','texto','regalar el método de quiebre y sobrante cruzado entre tiendas','diagnostico'),
('operadores','email','operadores diagnostico · correo 6',6,'las cuatro salidas del diagnóstico','Para que sepa qué está aceptando, esto es lo que sale de los quince minutos.

Primero, el dinero detenido en pesos, abierto por tienda y por marca, no un total que no sirve para nada. Segundo, el faltante: qué tallas y colores se están vendiendo y ya están en cero, y qué venta le costó eso el mes pasado.

Tercero, la lista de traspasos que conviene ejecutar esta semana, pieza por pieza y de cuál tienda a cuál, ordenada por el dinero que recupera. Cuarto, qué marca le está ocupando piso sin moverse, con el dato en la mano para sentarse a negociar con ella.

Lo armamos nosotros con su archivo. Usted nada más lo lee y decide si le hace sentido.

¿Quién de su equipo puede sacar el archivo?','texto','detallar el entregable y pedir el contacto operativo','diagnostico'),
('operadores','email','operadores diagnostico · correo 7',7,'no le escribo más','[[si persona]]{{persona}}, [[/si]]lo dejo aquí y le explico por qué insistí.

Un operador vive entre dos aguas: la marca quiere su reporte y la tienda quiere vender, y usted responde por las dos con inventario que muchas veces ni es suyo. El reparto entre tiendas termina siendo la decisión más cara del mes y casi siempre se toma por criterio, porque son miles de tallas y ninguna persona puede con eso.

Por eso existe nivelación, que es lo único que hacemos distinto y lo que de verdad mueve el número. El diagnóstico de quince minutos sigue disponible cuando quiera, sin costo y sin cambiar de sistema.

¿Lo retomo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad explicando por qué el reparto importa','diagnostico'),
('renta','email','renta demo · correo 1',1,'una duda de sus vestidos','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}} en {{ciudad}} y me quedé pensando en algo de su operación: cuando entra una clienta y pide un vestido para el sábado 14, alguien tiene que saber en ese momento si la pieza está apartada, en tintorería o todavía puesta.

Hacemos software de inventario para negocios de moda. La renta es el caso más enredado, porque la misma prenda se vende muchas veces al año.

¿Hoy eso lo llevan en libreta, en Excel o en algún sistema?','texto','abrir con algo cierto y ofrecer la demo','demo'),
('renta','email','renta demo · correo 2',2,'los días libres de cada pieza','En renta el inventario no es cuántas piezas tienen. Es qué días está libre cada pieza.

Una prenda que jala puede salir veinte veces en un año. Si dos de esas salidas se pierden porque nadie supo que ya había vuelto de tintorería, ahí se fue el margen de la pieza completa.

Y pasa al revés: apartan un vestido para el 14, llega otra clienta que lo quería para el 21 y se le dice que no, aunque sí cabía.

¿Cuántas veces al mes les toca decir que no a una renta?','texto','enseñar el dolor con números del oficio','demo'),
('renta','email','renta demo · correo 3',3,'una ficha por prenda','Le cuento cómo lo resolvemos, para que juzgue si le sirve.

Cada prenda deja de ser una línea de inventario y se vuelve una ficha con su propio calendario: apartada del 12 al 15, en tintorería el 16, libre el 17. Quien está en mostrador ve ese calendario antes de prometer una fecha.

Encima va el dinero: anticipo, liquidación, depósito en garantía y a quién se le devuelve. Y si tienen más de un local, la ficha dice en cuál está colgada hoy.

¿Cuántas piezas de renta manejan en el catálogo?','texto','mostrar cómo se resuelve por dentro','demo'),
('renta','email','renta demo · correo 4',4,'el excel no avisa','Muchos negocios de renta llevan todo en Excel o en libreta, y funciona un buen rato. El problema no es que esté mal hecho.

Es que no avisa. No le dice a quien está en mostrador que ese vestido regresó el martes y ya se puede volver a apartar. No cobra el anticipo ni se acuerda del depósito. No cuadra dos locales. Y cuando falta un sábado la persona que se sabe el catálogo de memoria, el negocio se frena.

No le digo que su control esté mal. Le digo que ya llegó a su tope.

¿Quién lleva hoy ese control?','texto','romper la objeción del control actual','demo'),
('renta','email','renta demo · correo 5',5,'cuáles piezas ya se pagaron','Le dejo algo que puede hacer esta semana sin comprarme nada.

Saque las rentas del último año y por cada prenda anote dos números: cuántas veces salió y cuánto le costó la pieza. Divida el ingreso que dejó entre lo que costó.

El catálogo se le va a partir en tres. Piezas que ya se pagaron tres o cuatro veces y que debería tener repetidas. Piezas que apenas empatan. Y piezas que llevan un año colgadas ocupando lugar y tintorería.

Eso solo ya le dice qué volver a comprar y qué rematar, y no necesita sistema para hacerlo. Nada más necesita que las salidas estén registradas.

¿Tiene registradas las salidas de un año completo?','texto','dar algo útil aunque no compren','demo'),
('renta','email','renta demo · correo 6',6,'1.2 millones mal repartidos','Un ejemplo de lo que aparece cuando uno mira el inventario en serio.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre la bodega y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la gente la pedía.

En renta el mismo problema tiene otra cara: piezas que se rentarían todos los fines de semana y están arrumbadas donde nadie las pide, y tallas que llevan dos temporadas sin salir.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propias prendas y usted juzga.

¿Le acomoda esta semana o la que entra?','texto','contar el caso real y proponer la demo','demo'),
('renta','email','renta demo · correo 7',7,'lo dejo por aquí','[[si persona]]{{persona}}, [[/si]]no le quiero seguir llenando el correo, así que lo dejo por aquí.

Le escribí porque los negocios de renta son de los que peor la pasan con los sistemas de tienda normales: ninguno entiende que la misma prenda se vende veinte veces y que entre salida y salida pasa por tintorería. Casi todos los tratan como si vendieran playeras.

Si algún día se les encima un apartado, abren otro local o nada más quieren ver cómo se vería su catálogo adentro, me escribe y lo vemos en veinte minutos. No le voy a volver a insistir.

¿Le escribo otra vez el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('renta','email','renta diagnostico · correo 1',1,'sus sucursales el sábado','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}} en {{ciudad}}[[si sucursales]], con {{sucursales}} sucursales[[/si]]. Con varios locales de renta siempre pasa lo mismo: el sábado de las bodas nadie sabe desde una sola pantalla en qué tienda está cada pieza apartada.

Hacemos inventario para negocios de moda. Con su información le decimos en 15 minutos cuánto dinero tiene parado en piezas que no salen. Sin costo y sin compromiso.

¿Le mando el detalle de qué necesitaríamos?','texto','abrir con algo cierto y ofrecer el diagnóstico','diagnostico'),
('renta','email','renta diagnostico · correo 2',2,'dinero colgado en la percha','Le explico a qué le llamo dinero parado, porque en renta suena raro.

Es cada pieza que ya pagó y que no está saliendo. Con un local es fácil de ver: uno pasa y las ve colgadas. Con varios locales no, porque cada tienda tiene su propia percha muerta y nadie compara entre ellas.

Lo grave es que casi siempre esa misma pieza sí se renta, pero en otra sucursal, donde no la tienen. Está comprada, está pagada y está en el lugar equivocado.

¿Hoy pueden ver el inventario de todas sus tiendas en una sola lista?','texto','explicar el dinero parado y por qué se multiplica','diagnostico'),
('renta','email','renta diagnostico · correo 3',3,'50 modelos, 1.2 millones','Le pongo el ejemplo más claro que tengo.

En un cliente nuestro, una cadena de moda, revisamos 50 modelos. Nada más 50. Entre lo que estaba en el centro de distribución y lo que estaba en cada tienda encontramos 1.2 millones de pesos mal repartidos: mercancía ya comprada, ya pagada, que no estaba donde la gente la pedía.

No fue una compra mala. Fue un reparto malo. Eso es justo lo que mide nuestro motor de nivelación, y es lo que le revisaríamos a usted.

¿Me puede compartir un respaldo de su inventario para correrlo?','texto','contar el caso real','diagnostico'),
('renta','email','renta diagnostico · correo 4',4,'sobre pasarnos su información','Sé que lo primero que uno piensa es por qué le voy a pasar mi inventario a un desconocido.

Lo trabajamos así: nos manda un archivo con tres columnas, prenda, sucursal y salidas. Sin datos de sus clientes y sin costos de compra si no quiere. Firmamos convenio de confidencialidad si lo pide, y al terminar le entregamos el resultado y borramos el archivo.

Y si de plano no, se puede al revés: usted lo corre de su lado y nosotros nada más le explicamos cómo leerlo.

¿Cuál de las dos le acomoda más?','texto','romper la objeción de entregar datos','diagnostico'),
('renta','email','renta diagnostico · correo 5',5,'cómo medirlo usted mismo','Se lo dejo para que lo haga aunque nunca me conteste.

Agarre sus rentas de los últimos doce meses y arme una tabla de dos columnas por pieza: en cuál sucursal está y cuántas veces salió desde ahí. Luego busque los renglones donde una tienda tiene la pieza con cero salidas y otra tienda tuvo que decir que no por falta de esa misma pieza.

Cada renglón así es un traspaso que debió pasar y no pasó. Multiplíquelo por el precio de renta y por los fines de semana que le quedan de temporada. Ese número suele espantar más que cualquier cotización de sistema.

¿Le sale ese cruce con lo que tiene registrado hoy?','texto','dar un método útil aunque no compren','diagnostico'),
('renta','email','renta diagnostico · correo 6',6,'qué sale en 15 minutos','Para que sepa qué recibe, sin sorpresas. El diagnóstico le entrega cuatro cosas.

Uno, cuánto dinero tiene parado en piezas que no salieron en toda la temporada. Dos, cuáles piezas conviene mover de una sucursal a otra y en qué orden. Tres, cuántas rentas se le cayeron por no tener libre una pieza que sí existía en otro local. Cuatro, qué le conviene volver a comprar para la temporada que viene.

Son quince minutos de junta y el archivo se lo queda usted, trabajemos juntos o no. Lo hacemos así porque es la manera más honesta de enseñar de qué es capaz el sistema.

¿Le aparto quince minutos esta semana?','texto','explicar exactamente qué entrega el diagnóstico','diagnostico'),
('renta','email','renta diagnostico · correo 7',7,'lo dejo por aquí','[[si persona]]{{persona}}, [[/si]]ya no le insisto más, lo dejo por aquí.

Le escribí porque un negocio de renta con varias sucursales es de los casos donde más dinero se queda quieto sin que nadie lo note: la pieza está comprada, está sana y está colgada en la tienda donde nadie la pide. Eso no se ve en el estado de resultados, se ve en la percha, y para cuando se nota ya pasó la temporada.

Si en algún momento quieren saber cuánto es ese número en su caso, el diagnóstico sigue disponible y sigue sin costo. Nada más me escribe.

¿Prefiere que le escriba pasando la temporada o que ya no le escriba?','texto','cerrar con dignidad','diagnostico'),
('scrubs','email','scrubs demo · correo 1',1,'talla por color de scrubs','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]]. En uniformes médicos un modelo no es un producto: es talla por color. Seis tallas y ocho colores ya son cuarenta y ocho cosas distintas que contar, y eso sin el bordado.

Hacemos inventario y punto de venta para negocios de moda, y este giro es de los que más referencias generan.

¿Hoy llevan el inventario por talla y color o por modelo?','texto','abrir con el dolor real y ofrecer la demo','demo'),
('scrubs','email','scrubs demo · correo 2',2,'la mitad de un conjunto','Lo difícil de los scrubs no es vender, es contar.

Entra una enfermera, quiere el conjunto vino. Le queda la blusa en mediana y el pantalón en grande, así que del conjunto salen dos piezas de dos referencias distintas. En el sistema el conjunto queda cuadrado; en la bodega quedaron una blusa grande y un pantalón mediano solos, esperando a alguien que traiga exactamente la medida contraria.

Multiplique eso por ocho colores y por dos temporadas y ahí está el saldo del año: piezas buenas, sueltas, sin su par.

¿Cuántas piezas sueltas cree que trae hoy en bodega?','texto','enseñar el dolor mecánico del giro','demo'),
('scrubs','email','scrubs demo · correo 3',3,'piezas sueltas y bordado','Le cuento cómo lo armamos, para que juzgue.

Cada pieza vive por su cuenta: blusa vino mediana es una cosa, pantalón vino grande es otra, cada una con su existencia y su mínimo. El conjunto se arma en la venta con las piezas que la clienta se lleva de verdad, no con la pareja de fábrica.

El bordado va encima como trabajo aparte: nombre, hospital, logo, con su costo y su fecha de entrega, pegado a la venta pero sin ensuciar el inventario. Y si una pieza ya salió bordada, no puede regresar a piso como nueva.

¿El bordado lo hacen ustedes o lo mandan fuera?','texto','mostrar cómo se resuelve por dentro','demo'),
('scrubs','email','scrubs demo · correo 4',4,'el excel no alcanza','Sé que muchos negocios de uniformes llevan esto en Excel y les funciona. El Excel no está mal hecho, está rebasado.

Una hoja aguanta bien cien renglones. Aquí no son cien: son talla por color por modelo, más los conjuntos incompletos, más los pedidos de hospitales que se entregan en dos partes, más el bordado pendiente. Cuando alguien captura mal una celda, nadie se entera hasta que falta mercancía.

Y no es cosa de tamaño. Un negocio chico con cuarenta modelos ya trae más referencias que una zapatería con el triple de venta.

¿Cuántos modelos manejan hoy en catálogo?','texto','romper la objeción del control actual','demo'),
('scrubs','email','scrubs demo · correo 5',5,'un conteo por talla y color','Le dejo un ejercicio que puede hacer esta semana sin comprarme nada.

Escoja sus tres modelos de más salida y haga una tabla: los colores en las filas, las tallas en las columnas. Anote lo que tiene en existencia hoy y, en otra tabla igual, lo que vendió en tres meses.

Ponga las dos hojas una junto a otra. Van a saltar dos cosas: colores que compró parejo y solo se venden en dos tallas, y tallas que se acaban siempre en todos los colores y aun así se piden en la misma cantidad que las demás.

Con eso ya puede pedir distinto la próxima vez, sin gastar un peso. Lo único que se necesita es que la venta esté registrada por talla y color, no nada más por modelo.

¿La venta la tienen registrada a ese detalle?','texto','dar algo útil aunque no compren','demo'),
('scrubs','email','scrubs demo · correo 6',6,'lo que había en bodega','Le paso un caso real, para que vea qué tan grande puede ser esto.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada, nada más que no estaba donde se vendía.

En uniformes el equivalente son los colores de temporada. Se compró parejo en todas las tallas, la mitad se descontinúa y lo que sobra son piezas sueltas de un color que ya nadie va a pedir completo.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propios modelos, sus colores y sus tallas.

¿Le acomoda esta semana o la que entra?','texto','contar el caso real y proponer la demo','demo'),
('scrubs','email','scrubs demo · correo 7',7,'hasta aquí le escribo','[[si persona]]{{persona}}, [[/si]]ya fueron varios correos míos, así que hasta aquí le escribo.

Le insistí porque los uniformes médicos son un giro que casi ningún sistema de tienda entiende. Manejan talla por color, venden conjuntos que se arman con piezas de dos medidas, cobran un bordado que no es inventario, y encima les entra un pedido de hospital o de escuela de enfermería que se surte en dos o tres entregas. La mayoría de los sistemas trata todo eso como si fuera una playera.

Si en algún momento se les junta el saldo de un color descontinuado o quieren ver cómo se vería su catálogo adentro, me escribe y lo vemos en veinte minutos.

¿Le escribo el año que entra o lo saco de la lista?','texto','cerrar con dignidad','demo'),
('scrubs','email','scrubs diagnostico · correo 1',1,'uniformes en varias sucursales','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]], con {{sucursales}} sucursales[[/si]]. En uniformes médicos cada modelo se abre en talla por color, y con varias tiendas eso se vuelve mucho inventario del que nadie tiene la foto completa.

Hacemos inventario y punto de venta para moda. Antes de venderle algo hacemos un diagnóstico gratis: con su información, en 15 minutos le decimos cuánto dinero trae parado y cuánto pierde por faltantes.

¿Le agendo esos 15 minutos?','texto','abrir con sus sucursales y ofrecer el diagnóstico','diagnostico'),
('scrubs','email','scrubs diagnostico · correo 2',2,'el color de temporada parado','Dinero parado no es lo que no se vendió. Es lo que sí se vende, pero está donde no lo piden.

En uniformes eso se concentra en dos lugares. Uno, los colores de temporada que se compraron parejos en todas las tallas y solo caminaron en dos. Dos, las piezas sueltas que quedaron cuando la clienta se llevó blusa de una talla y pantalón de otra.

Con una tienda eso se ve al fondo de la bodega. Con varias se esconde: la sucursal que tiene los pantalones grandes no es la misma que tiene las blusas grandes, y ninguna de las dos puede cerrar un conjunto.

¿Alguien revisa hoy el inventario cruzando las sucursales?','texto','explicar dinero parado y por qué se multiplica','diagnostico'),
('scrubs','email','scrubs diagnostico · correo 3',3,'un caso de cadena','Le cuento un caso nuestro, sin adornarlo.

Cadena de moda con centro de distribución. Tomamos 50 modelos y cruzamos existencia contra venta, por variante y por tienda. Salieron 1.2 millones de pesos mal repartidos: mercancía ya comprada y pagada, parada donde no la pedían.

Lo que me interesa que vea no es el monto, es de dónde salió. Nadie compró de más. El dinero estaba completo y estaba en el lugar equivocado, que con talla por color se vuelve el problema principal, porque las combinaciones son tantas que nadie las trae en la cabeza.

Ese mismo cruce es el diagnóstico, con sus datos.

¿Cuántas referencias cree que trae hoy en catálogo?','texto','contar el caso real','diagnostico'),
('scrubs','email','scrubs diagnostico · correo 4',4,'ya tienen sistema, lo sé','Dos objeciones que me ponen siempre, y las dos se valen.

Que no me van a pasar su base. No la necesito. Con la existencia por talla y color y la venta de tres meses, en Excel, sin clientes ni costos si no quiere, alcanza para el cruce. Y firmamos confidencialidad.

Que ya tienen sistema. Seguramente sí, y seguramente registra bien lo que pasó. Lo que casi ninguno hace es leer el inventario por variante y por sucursal al mismo tiempo, que es justo donde se esconde el dinero en este giro.

El diagnóstico no le pide cambiar nada. Le enseña lo que ya está adentro de sus datos.

¿Puede sacar esos dos archivos de su sistema actual?','texto','romper la objeción de datos y de sistema propio','diagnostico'),
('scrubs','email','scrubs diagnostico · correo 5',5,'el ejercicio de las orillas','Aunque nunca trabajemos juntos, este ejercicio le va a servir.

Tome sus cinco modelos de más venta. Haga una hoja por sucursal con los colores en filas y las tallas en columnas, y ponga dos números por celda: existencia hoy y piezas vendidas en noventa días.

Ahora marque dos cosas. Las celdas con existencia y cero venta en noventa días: ese es dinero dormido, súmelo a costo. Y las celdas con venta seguida y existencia en cero: eso es lo que se le está yendo por la puerta cada semana.

Después compare las hojas entre sucursales. Ahí van a aparecer las piezas que sobran en una y faltan en otra, que son las que se arreglan con un traspaso y no con una compra.

¿Quiere que le pase el formato de esa hoja?','texto','dar el método gratis','diagnostico'),
('scrubs','email','scrubs diagnostico · correo 6',6,'las cuatro salidas del diagnóstico','Para que sepa a qué le está diciendo que sí, esto es lo que entregamos en los 15 minutos.

Uno: el dinero parado a costo, por sucursal y por variante, con el detalle de talla y color. Dos: los traspasos que convendría hacer esta semana, con origen, destino y cantidad. Tres: las piezas sueltas que ya no arman conjunto y conviene liquidar antes de que envejezcan. Cuatro: los faltantes que hoy le están costando venta, ordenados por lo que más se pide.

Se lo explico en llamada y el archivo se queda con ustedes, trabajemos juntos o no.

De su lado solo necesito existencia por talla y color y venta de tres meses.

¿Quién puede armarme esos dos archivos?','texto','decir exactamente qué entrega el diagnóstico','diagnostico'),
('scrubs','email','scrubs diagnostico · correo 7',7,'lo dejo hasta aquí','[[si persona]]{{persona}}, [[/si]]no quiero volverme correo de relleno, así que lo dejo hasta aquí.

Le escribí varias veces porque en uniformes médicos el inventario es de los más difíciles que hay: talla por color, conjuntos que se rompen en cada venta, bordado que no es mercancía, pedidos de hospitales y de escuelas que se surten en partes, y colores que se descontinúan de un año a otro. Con varias sucursales encima, nadie puede traer eso en la cabeza.

El diagnóstico sigue disponible sin costo cuando les acomode, aunque sea después de la temporada de titulaciones.

¿Le toco la puerta más adelante o mejor lo saco de la lista?','texto','cerrar con dignidad','diagnostico'),
('tallas','email','tallas demo · correo 1',1,'las tallas que se acaban','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}} en {{ciudad}}. En tallas extra pasa algo que no pasa en otras tiendas: la clienta que no encuentra su 3XL casi no tiene a dónde más ir, y aun así, si no la encuentra dos veces, ya no vuelve.

Hacemos software de inventario para negocios de moda, pensado para curvas largas de talla.

¿Hoy cómo se dan cuenta de qué tallas se están acabando?','texto','abrir con el dolor propio del giro y ofrecer la demo','demo'),
('tallas','email','tallas demo · correo 2',2,'un modelo son seis tallas','Un modelo de ropa normal vive en cuatro o cinco tallas. En tallas extra se va de la 1XL a la 6XL, y en bebé son 0-3, 3-6, 6-9, 12, 18 y 24 meses.

Eso quiere decir que cada modelo son seis renglones de inventario, no uno. Y como en el perchero el modelo se ve lleno, nadie nota que la 2XL y la 3XL, que son las que más salen, llevan tres semanas en cero. Lo que queda colgado es la punta de la curva.

¿Cuántos modelos traen hoy en piso, más o menos?','texto','enseñar el dolor mecánico con números del oficio','demo'),
('tallas','email','tallas demo · correo 3',3,'la curva por dentro','Le cuento cómo lo resolvemos, para que juzgue si le sirve.

Cada modelo se guarda como una curva, no como un producto: la 1XL, la 2XL y la 3XL son renglones propios, con su existencia y su venta. El sistema sabe cuál talla se acaba primero y avisa cuando queda poco de la que más sale, no cuando ya se acabó el modelo entero.

En bebé se agrega el reloj: los 0-3 meses tienen fecha de caducidad comercial, y el sistema le dice cuáles ya están tardando mientras todavía se pueden mover con margen.

¿Manejan tallas extra, bebé o las dos cosas?','texto','mostrar cómo se resuelve por dentro','demo'),
('tallas','email','tallas demo · correo 4',4,'somos chicos para eso','Lo que más me contestan es que son chicos y que se saben su mercancía de memoria. Y es cierto, casi siempre se la saben.

El detalle es que memoria y curva de tallas no se llevan. Uno se acuerda del modelo, no de que la 4XL en azul lleva quince días en cero. Y en bebé, con seis rangos por modelo, son cientos de combinaciones que nadie trae en la cabeza un sábado con la tienda llena.

No le digo que su control esté mal. Le digo que la talla es lo primero que se le escapa a cualquiera.

¿Quién decide hoy qué tallas se vuelven a pedir?','texto','romper la objeción de tamaño y memoria','demo'),
('tallas','email','tallas demo · correo 5',5,'el ejercicio de las faltantes','Le dejo algo que puede hacer esta semana sin comprarme nada.

Agarre sus quince modelos que más salen y arme una tabla chiquita: un renglón por modelo, una columna por talla. Marque con cruz cada talla que hoy trae en cero.

Lo que va a ver es que las cruces no están regadas: se juntan en dos o tres tallas, y son las mismas siempre. Ese es su centro de curva y es lo que debería pedir en doble.

Hay un segundo dato que casi nadie levanta: pídale a quien está en piso que apunte una semana cada talla que le pidieron y no había. Esa hoja vale oro, porque esa venta no aparece en ningún reporte.

¿Alguien apunta hoy lo que le piden y no hay?','texto','dar un método útil sin vender nada','demo'),
('tallas','email','tallas demo · correo 6',6,'1.2 millones en 50 modelos','Un ejemplo de lo que aparece cuando uno mira el inventario talla por talla.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la gente la pedía.

Casi siempre es lo mismo: las tallas del centro de la curva se acabaron en la tienda que las vende y están completas en la que no. En tallas extra duele más, porque la clienta que no halló la suya no se lleva otra cosa, se sale.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propios modelos.

¿Le acomoda esta semana o la que entra?','texto','contar el caso real y proponer la demo','demo'),
('tallas','email','tallas demo · correo 7',7,'aquí le paro','[[si persona]]{{persona}}, [[/si]]no quiero seguir llenándole el correo, así que aquí le paro.

Le escribí porque los sistemas de tienda normales tratan un modelo como si fuera una sola cosa, y en su negocio un modelo son seis tallas o seis rangos de edad. Ahí es donde se va el dinero: no en el modelo que no gustó, sino en la talla que se acabó el primer fin de semana y tardó un mes en volver.

Si algún día les crece el catálogo, abren otro punto o nada más quieren ver cómo se vería su curva de tallas adentro, me escribe y lo vemos en veinte minutos. No le vuelvo a insistir.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('tallas','email','tallas diagnostico · correo 1',1,'sus tallas entre las tiendas','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}} en {{ciudad}}[[si sucursales]], con {{sucursales}} sucursales[[/si]]. Con varias tiendas y curvas largas de talla pasa siempre lo mismo: la 3XL que se acabó el viernes en una está colgada sin moverse en otra.

Hacemos inventario para moda. Ofrecemos un diagnóstico gratis: con su información, en 15 minutos les decimos cuánto dinero tienen parado y cuánto pierden por tallas faltantes.

¿Se lo corremos con sus números?','texto','abrir con sus sucursales y ofrecer el diagnóstico','diagnostico'),
('tallas','email','tallas diagnostico · correo 2',2,'por qué se multiplica','Dinero parado no es lo que no se vende. Es lo que sí se vende, pero está en la tienda equivocada y en la talla equivocada.

Con una tienda eso se arregla caminando al perchero. Con cinco tiendas y seis tallas por modelo, cada modelo tiene treinta lugares donde puede estar mal puesto. Nadie trae eso en la cabeza y ningún reporte de ventas lo enseña, porque el modelo se ve sano: vendió bien. Lo que no se ve es que vendió menos de lo que podía, porque le faltaba la talla del centro.

¿Cuántos modelos activos traen hoy entre todas las tiendas?','texto','explicar el dinero parado en curva larga y varias tiendas','diagnostico'),
('tallas','email','tallas diagnostico · correo 3',3,'50 modelos, 1.2 millones','Le pongo el ejemplo más claro que tengo.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos. Entre el centro de distribución y las tiendas había 1.2 millones de pesos mal repartidos: mercancía ya comprada y pagada que no estaba donde la gente la pedía.

No hubo que comprar nada ni rematar nada. Fue mover lo que ya estaba, talla por talla.

En tallas extra y en bebé el número suele salir más grande, porque la curva es más larga y hay más lugares donde una talla se queda sola.

¿Con cuántas tiendas y cuántas tallas por modelo trabajan hoy?','texto','contar el caso real','diagnostico'),
('tallas','email','tallas diagnostico · correo 4',4,'ya tenemos sistema','Cuando propongo el diagnóstico, la respuesta seguido es que ya tienen sistema. Casi siempre es cierto, y casi siempre ese sistema no está mirando la talla.

Guarda las ventas, saca cortes, imprime tickets. Lo que no hace es decirle que la 2XL de un modelo lleva once días en cero en dos tiendas y sobra en la tercera, ni cuánto dinero significa eso.

Y si le preocupa mandar su base, no la necesito completa: existencias por tienda y ventas de unos meses, sin nombres de clientes y sin costos si no quiere.

¿De qué sistema saldrían esos dos archivos?','texto','romper la objeción del ERP y de los datos','diagnostico'),
('tallas','email','tallas diagnostico · correo 5',5,'medir la talla faltante','Le dejo el método para que lo corra usted, aunque nunca me conteste.

Escoja veinte modelos de los que más salen. Haga una tabla con un renglón por modelo y talla, y una columna por tienda, con las piezas que hay hoy. Marque en rojo cada cero.

Ahora vea los renglones en rojo y busque si esa misma talla tiene tres o más piezas en otra tienda. Cada vez que eso pase, ahí hubo un traspaso que se debió hacer y no se hizo.

Sume lo que valen esas piezas a precio de venta. Ese es el piso de su dinero parado, y digo piso porque nada más miró veinte modelos.

¿Cuántos modelos tendría que revisar para cubrir la mitad de su venta?','texto','regalar el método de medición','diagnostico'),
('tallas','email','tallas diagnostico · correo 6',6,'lo que entrega el diagnóstico','Para que sepa qué está aceptando, esto es lo que le entregamos.

Uno: cuánto dinero tienen parado hoy, en pesos, y en qué modelos y tallas está. Dos: los traspasos que convienen esta semana, de qué tienda a qué tienda y cuántas piezas de cada talla. Tres: las tallas que se acaban antes de tiempo y lo que dejaron de vender por no tenerlas. Cuatro: en bebé, qué rangos de edad ya se están pasando de tiempo y hay que mover ahora.

Son 15 minutos por videollamada. Si no le sirve, se queda con el archivo y ahí lo dejamos.

¿Quién de su equipo saca los archivos de inventario?','texto','detallar las salidas concretas del diagnóstico','diagnostico'),
('tallas','email','tallas diagnostico · correo 7',7,'lo dejo hasta aquí','[[si persona]]{{persona}}, [[/si]]le escribí varias veces y no quiero volverme parte del ruido, así que lo dejo hasta aquí.

Insistí porque en tallas extra y en bebé la venta perdida no se ve en ningún lado. La clienta que no encontró su 4XL no reclama, no deja queja y no vuelve; y en bebé, la talla que no se vendió a tiempo se le pasó al niño y ya no la compra nadie. Las dos cosas se pagan con dinero que ya estaba comprado.

Si mañana quieren un número real de cuánto traen parado, aquí seguimos y son 15 minutos. No le vuelvo a escribir.

¿Prefiere que lo saque de la lista o que le toque el año que entra?','texto','cerrar con dignidad','diagnostico'),
('telas','email','telas demo · correo 1',1,'una duda de sus rollos','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}} en {{ciudad}} y me quedé pensando en algo: cuando una clienta pide 12 metros de una tela, alguien tiene que saber en ese momento si el rollo del mostrador todavía da esos 12 o se quedó en 11.40.

Hacemos software de inventario para negocios de moda. La tela es de los casos más enredados, porque el inventario no son piezas, son metros.

¿Hoy eso lo llevan en libreta, en Excel o en algún sistema?','texto','abrir con algo cierto y ofrecer la demo','demo'),
('telas','email','telas demo · correo 2',2,'el pedazo que sobra','En telas el inventario no se acaba: se parte.

Un rollo de 30 metros sale en cortes de 3, de 5, de 1.5. Y llega el momento en que quedan 2.80 metros que ya no le sirven al cliente que pide 4, pero que siguen contando como inventario a precio de rollo.

A eso súmele que la misma tela existe en veinte colores. Un catálogo de 200 telas son 4,000 referencias que alguien tendría que contar, y abajo la mercería con miles de artículos chiquitos que nadie ha contado nunca.

¿Cuántas telas distintas manejan hoy, sin contar colores?','texto','enseñar el dolor mecánico con números del oficio','demo'),
('telas','email','telas demo · correo 3',3,'metros, no piezas','Le cuento cómo lo resolvemos, para que juzgue si le sirve.

Cada tela se maneja por rollo y por metro al mismo tiempo. El sistema sabe cuántos rollos completos hay y cuánto quedó suelto en cada uno, y cuando alguien corta 3.6 metros lo descuenta del rollo abierto, no del inventario en general.

El color y el ancho son variantes de la misma tela, así que el catálogo se ve en una pantalla y no en cuatro mil renglones. Y el precio de mayoreo y el de menudeo viven en el mismo mostrador, cada uno en su lista.

¿Venden también por kilo o nada más por metro?','texto','mostrar cómo se resuelve por dentro','demo'),
('telas','email','telas demo · correo 4',4,'la libreta no descuenta','Muchas telerías llevan todo en libreta y funciona años. El problema no es que esté mal hecha.

Es que no descuenta sola. Nadie apunta los 40 centímetros que se fueron en la orilla, ni el corte que se hizo a las siete cuando ya había fila. Al mes el registro dice 18 metros y en el anaquel hay 15, y eso se ve hasta que el cliente pide 16 y hay que decirle que no.

No le digo que su control esté mal. Le digo que ya llegó a su tope.

¿Quién lleva hoy la cuenta de los rollos abiertos?','texto','romper la objeción del control actual','demo'),
('telas','email','telas demo · correo 5',5,'cómo medir su merma','Le dejo algo que puede hacer esta semana sin comprarme nada.

Escoja sus diez telas que más salen. Mida con cinta lo que de verdad queda del rollo abierto de cada una y compárelo con lo que dice su registro. Anote la diferencia en metros y multiplíquela por lo que le costó el metro.

Ese número, en diez telas nada más, suele sorprender. Una parte es merma real de corte y otra es venta que no se apuntó, y son dos problemas distintos con dos remedios distintos.

Hágalo un lunes antes de abrir y le toma menos de una hora. No necesita sistema, nada más la cinta y su registro.

¿Con cuántos rollos abiertos anda hoy, más o menos?','texto','dar un método útil sin vender nada','demo'),
('telas','email','telas demo · correo 6',6,'1.2 millones mal repartidos','Un ejemplo de lo que aparece cuando uno mira el inventario en serio.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la gente la pedía.

En telas eso tiene otra cara: colores que salen todos los días y siempre andan en las últimas, junto a rollos completos de un color que nadie pide y que llevan tres temporadas ocupando anaquel.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propias telas y usted juzga.

¿Le acomoda esta semana o la que entra?','texto','contar el caso real y proponer la demo','demo'),
('telas','email','telas demo · correo 7',7,'lo dejo por aquí','[[si persona]]{{persona}}, [[/si]]no le quiero seguir llenando el correo, así que lo dejo por aquí.

Le escribí porque las telerías son de los negocios que peor la pasan con los sistemas de tienda normales: casi ninguno entiende que un rollo se parte, que el pedazo que sobra ya no vale lo mismo, y que la misma tela existe en veinte colores. La mayoría los trata como si vendieran playeras.

Si algún día se les descuadra el inventario, abren otro local o nada más quieren ver cómo se vería su catálogo adentro, me escribe y lo vemos en veinte minutos. No le voy a volver a insistir.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('telas','email','telas diagnostico · correo 1',1,'los rollos entre sus sucursales','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}} en {{ciudad}}[[si sucursales]], con {{sucursales}} sucursales[[/si]]. Con varias tiendas de tela pasa algo caro: el color que se acabó en una está parado en rollo completo en otra, y nadie lo mueve porque nadie lo ve.

Hacemos inventario para negocios de moda. Ofrecemos un diagnóstico gratis: con su información, en 15 minutos les decimos cuánto dinero tienen parado y cuánto pierden por faltantes.

¿Le interesa que se lo corramos?','texto','abrir con sus sucursales y ofrecer el diagnóstico','diagnostico'),
('telas','email','telas diagnostico · correo 2',2,'qué es dinero parado','Cuando digo dinero parado no hablo de lo que no se vende. Hablo de lo que sí se vende, pero está en la tienda equivocada.

Un rollo de gabardina negra que en el centro sale en dos semanas puede llevar ocho meses en la sucursal donde nadie la pide. Ahí no está muerto: está mal puesto.

Con una tienda eso se arregla caminando al anaquel. Con cinco, cada color tiene cinco lugares donde puede estar mal, y ya nadie lo trae en la cabeza. Por eso crece con las sucursales, no con el catálogo.

¿Hoy pueden ver de un jalón cuántos metros hay de una tela en todas las tiendas?','texto','definir dinero parado y por qué crece con las tiendas','diagnostico'),
('telas','email','telas diagnostico · correo 3',3,'50 telas, 1.2 millones','Le pongo el ejemplo más claro que tengo.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos. Entre el centro de distribución y las tiendas había 1.2 millones de pesos mal repartidos: mercancía ya comprada y pagada que no estaba donde la gente la pedía.

No hubo que comprar más ni rematar nada. Fue mover lo que ya estaba.

En tela el mismo ejercicio sale más rápido, porque el color le dice todo: el que se acaba cada semana en una tienda casi siempre está entero en otra.

¿Sus tiendas se traspasan mercancía entre ellas o cada una pide a bodega?','texto','contar el caso real','diagnostico'),
('telas','email','telas diagnostico · correo 4',4,'no necesito toda su base','Lo más común que me contestan es que no me van a pasar su información, y me parece bien.

Para el diagnóstico no necesito su base completa ni sus costos de compra. Con las existencias por tienda y las ventas de los últimos meses alcanza. Si prefiere, mándelo con los nombres cambiados: me sirve igual, porque lo que se mide es el movimiento, no quién es el cliente.

Y si ya tienen sistema, mejor: casi todos exportan eso en dos clics, y el diagnóstico les enseña lo que el suyo no les está diciendo.

¿Qué usan hoy para llevar el inventario?','texto','romper la objeción de los datos y del sistema actual','diagnostico'),
('telas','email','telas diagnostico · correo 5',5,'cómo medirlo sin nosotros','Le dejo el método para que lo haga usted, aunque no nos contrate.

Escoja veinte telas de las que más salen. Para cada color y cada tienda apunte dos cosas: metros que hay hoy y metros que vendió en los últimos tres meses. Divida lo primero entre lo segundo.

Ese número son meses de venta. Si en una tienda un color trae seis meses y en otra trae quince días, esa es la línea que hay que mover, y el mismo número le dice cuántos metros.

Ordene la lista por pesos y quédese con las diez primeras. Es una tarde de trabajo y normalmente paga el mes.

¿Tiene a la mano las ventas por tienda de los últimos tres meses?','texto','regalar el método de medición','diagnostico'),
('telas','email','telas diagnostico · correo 6',6,'qué sale de los quince minutos','Para que sepa exactamente qué está aceptando, esto es lo que sale del diagnóstico.

Uno: cuánto dinero tienen parado, en pesos, y en qué telas y colores está. Dos: la lista de traspasos que conviene hacer esta semana, tienda por tienda y en metros. Tres: los colores que se acaban antes de tiempo y lo que dejaron de vender por eso. Cuatro: cuántos rollos abiertos traen y cuánto valen ya como retazo.

Son 15 minutos de junta por videollamada[[si ciudad]], sin que nadie se mueva de {{ciudad}}[[/si]]. Si al final no le sirve, se queda con el archivo y no me vuelve a ver.

¿Le mando la lista de lo que necesito para correrlo?','texto','detallar las salidas concretas del diagnóstico','diagnostico'),
('telas','email','telas diagnostico · correo 7',7,'cierro el tema por hoy','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no quiero volverme parte del ruido, así que aquí lo dejo.

Insistí porque con varias tiendas de tela el dinero parado no se siente. Nadie ve el rollo entero que está en la bodega de otra sucursal; se ve todo normal y aun así el color que pedían se acabó el jueves. Es el problema más caro que hay y el que menos duele en el momento.

Si mañana abren otra sucursal, les crece el catálogo o nada más quieren un número real de cuánto tienen parado, me escribe y corremos los 15 minutos. No le vuelvo a insistir.

¿Lo saco de la lista o le toco de nuevo el año que entra?','texto','cerrar con dignidad','diagnostico'),
('vintage','email','vintage demo · correo 1',1,'una sola pieza de cada','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y le escribo por lo que hace difícil su negocio: de cada prenda hay una y ya. Si se vende, no se puede volver a pedir, y si se vende dos veces por andar en tienda y en Instagram, alguien se queda esperando.

Hacemos inventario y punto de venta para negocios de moda. Si quiere, en veinte minutos se lo enseño con sus propias prendas.

¿Hoy cómo lleva el control de piezas?','texto','abrir con el dolor de la pieza única y ofrecer la demo','demo'),
('vintage','email','vintage demo · correo 2',2,'sin reorden y sin sku','En vintage el inventario no se parece a nada. En una tienda normal un modelo trae doce tallas y si se acaba se vuelve a pedir. Aquí cada prenda es su propio modelo, su propia talla y su propia foto.

Eso quiere decir que dar de alta cien piezas es cien altas, cien fotos y cien precios, uno por uno. Y también quiere decir que la prenda que se vendió el jueves en el bazar sigue publicada el viernes, hasta que alguien se acuerda de bajarla.

¿Cuántas piezas nuevas mete a la semana?','texto','enseñar el dolor mecánico de la pieza única','demo'),
('vintage','email','vintage demo · correo 3',3,'la pieza se apaga sola','Le cuento cómo lo resolvemos, para que juzgue si le sirve.

Cada prenda entra una sola vez, con su foto, su medida, su precio y de quién es. Si viene a consignación, la ficha guarda el nombre de la dueña, qué comisión le toca y hasta qué fecha se queda.

De ahí sale a donde usted venda: mostrador, tienda en línea, marketplace. Cuando se vende en un lado, se apaga sola en los demás. Nadie tiene que acordarse de bajarla.

Y al cierre del mes sale solo cuánto le toca a cada consignante.

¿Trabaja con piezas a consignación?','texto','mostrar cómo se resuelve por dentro, con consignación','demo'),
('vintage','email','vintage demo · correo 4',4,'somos chicas para eso','Sé lo que me van a decir: somos chiquitas, con el Excel y el cuaderno nos alcanza.

Y sí alcanza, hasta que deja de alcanzar. Casi siempre truena en el mismo punto: cuando ya venden en tienda y en redes al mismo tiempo, cuando entra la segunda persona a ayudar, o cuando las piezas de otras dueñas ya son tantas que sacar las comisiones se lleva un domingo entero.

No es que su control esté mal hecho. Es que está armado para una persona que se acuerda de todo, y ese es justo el problema.

¿Cuántas piezas tiene hoy en piso?','texto','romper la objeción de somos chicos y el cuaderno alcanza','demo'),
('vintage','email','vintage demo · correo 5',5,'los días que lleva colgada','Le dejo algo que puede hacer esta semana sin comprarme nada.

A cada prenda que tenga en piso póngale la fecha en que entró. Nada más eso. Luego ordénelas por esa fecha, de la más vieja a la más nueva.

La parte de arriba de esa lista es su dinero dormido: piezas que llevan noventa días o más ocupando el buen lugar del perchero y tapando lo que sí acaba de llegar.

Con eso arma su rebaja del mes sin adivinar, y si son a consignación ya sabe a quién avisarle antes de devolver la prenda.

¿Sabe hoy cuál es la pieza más vieja que trae colgada?','texto','dar un método útil gratis','demo'),
('vintage','email','vintage demo · correo 6',6,'mercancía en el lugar equivocado','Un ejemplo de lo que aparece cuando uno mira el inventario con calma.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre la bodega y las tiendas. Ropa ya comprada y pagada que no estaba donde la gente la pedía.

En vintage el mismo problema es más callado, porque no se ve como faltante: se ve como una percha llena de piezas que nadie ha tocado en meses, mientras lo bueno entra y sale sin que quede registro de qué era.

Si quiere, en veinte minutos se lo enseño con sus prendas cargadas.

¿Le acomoda esta semana o la que entra?','texto','contar el caso real y proponer la demo','demo'),
('vintage','email','vintage demo · correo 7',7,'hasta aquí lo dejo','[[si persona]]{{persona}}, [[/si]]no le sigo llenando el correo, aquí lo dejo.

Le escribí porque los sistemas de tienda normales no entienden el vintage: piden código, talla y cantidad, y usted tiene una pieza única de la que no hay reorden ni segunda talla. Ninguno sabe qué hacer con la ropa de otra dueña que está a comisión.

Si algún día se le encima la temporada, mete a alguien a ayudarle o de plano ya no quiere volver a vender dos veces la misma prenda, me escribe y lo vemos en veinte minutos. No le vuelvo a insistir.

¿Le escribo más adelante o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('vintage','email','vintage diagnostico · correo 1',1,'piezas únicas en varios puntos','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]] y que ya son {{sucursales}} puntos[[/si]]. Con piezas únicas repartidas en varios lugares el problema no es vender: es saber dónde quedó cada prenda y que no se venda dos veces.

Hacemos inventario y punto de venta para moda. Con su información, en quince minutos le decimos cuánto dinero trae dormido en piezas que llevan meses sin moverse. Sin costo.

¿Le parece si lo vemos?','texto','abrir con sus puntos de venta y ofrecer el diagnóstico','diagnostico'),
('vintage','email','vintage diagnostico · correo 2',2,'dinero dormido en las perchas','Cuando digo dinero dormido hablo de prendas que ya pagó, o que ya le costaron trabajo y espacio, y llevan meses sin que nadie las toque.

Con un solo local se nota: usted camina y las ve. Con varios puntos, no. Cada quien acomoda lo suyo, mueve lo que le gusta y lo demás se va al fondo. Y como no hay reorden, nadie se entera de que esa pieza ya lleva medio año, porque nunca aparece como faltante.

Lo que sobra en un punto muchas veces es justo lo que en otro le piden y no tiene.

¿Cómo sabe hoy qué hay en cada punto?','texto','explicar el dinero parado y por qué se multiplica','diagnostico'),
('vintage','email','vintage diagnostico · correo 3',3,'1.2 millones en 50 modelos','Le pongo el caso, porque el número habla mejor que yo.

Un cliente nuestro, cadena de moda, nos dejó ver su inventario. Con nada más 50 modelos encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Ropa comprada y pagada que no estaba donde la gente la pedía.

En lo suyo los modelos no se repiten, pero el error es el mismo y hasta más caro: la prenda que en un punto no le hace caso nadie, en otro se la habrían llevado la primera semana.

¿Me deja hacer esa misma cuenta con sus piezas?','texto','contar el caso real','diagnostico'),
('vintage','email','vintage diagnostico · correo 4',4,'no le pido sus fotos','Dos cosas que me contestan siempre en este punto.

Una: no le paso mi información. Se entiende. No necesito nombres de clientas ni cuánto le pagó a cada consignante. Con la lista de piezas por punto y su fecha de entrada alcanza, y si prefiere lo vemos en su pantalla y usted no me manda nada.

Dos: ya tengo sistema, o llevo todo en una hoja. Puede ser, pero casi ninguno sabe manejar piezas de una sola unidad, ni sacar por su cuenta la comisión de cada dueña al cierre del mes.

¿Cuál de las dos le pesa más?','texto','romper las dos objeciones típicas','diagnostico'),
('vintage','email','vintage diagnostico · correo 5',5,'mídalo usted sin nosotros','Le dejo el método completo, por si nunca me contrata.

Haga una lista de todo lo que tiene en piso con dos datos nada más: en qué punto está y qué día entró. Luego cuente cuántas piezas llevan más de noventa días y sume lo que valen a precio de venta.

Esa suma es su dinero dormido, y casi siempre es más grande de lo que uno cree. Pártalo por punto y va a ver que no está parejo: hay uno que acumula y otro que se queda sin nada que enseñar.

Mover piezas entre esos dos, sin comprar nada, es la venta más barata que va a hacer este mes.

¿Quiere que le arme esa lista con sus datos?','texto','regalar el método de medición','diagnostico'),
('vintage','email','vintage diagnostico · correo 6',6,'qué le entrego en quince','Para que sepa qué se lleva de los quince minutos, sin sorpresas.

Uno: cuánto dinero trae dormido, en pesos, y en qué punto está. Dos: las piezas que conviene mover de un lugar a otro esta semana. Tres: qué tanto de lo que tiene es de consignantes y qué comisión trae encima, si es que trabaja así. Cuatro: dónde se le están yendo las ventas dobles, esas de la prenda que ya no estaba y se vendió otra vez.

Es una llamada con su información, y se lo dejo por escrito trabajemos o no.

¿Qué día de esta semana le queda bien?','texto','detallar las salidas concretas del diagnóstico','diagnostico'),
('vintage','email','vintage diagnostico · correo 7',7,'ya no le escribo más','[[si persona]]{{persona}}, [[/si]]ya no le escribo más, nada más le dejo dicho para qué le buscaba.

El vintage con varios puntos es de los negocios más difíciles de llevar y de los que menos ayuda tienen: piezas únicas, ropa de otras dueñas a comisión y ventas por tres lados al mismo tiempo. Ningún sistema de tienda normal está hecho para eso.

La cuenta de los quince minutos sigue en pie cuando usted quiera, y se la entrego por escrito aunque no trabajemos juntos. No le cuesta nada.

¿Le busco más adelante o mejor lo saco de la lista?','texto','cerrar con dignidad','diagnostico'),
('western','email','western demo · correo 1',1,'el número no alcanza','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y le escribo directo: en bota el número no alcanza. El mismo 27 en una horma y en otra no le queda al cliente, y ahí se quedan pares parados que nadie se lleva.

Hacemos un sistema mexicano de inventario y punto de venta para negocios de moda. Si quiere, en veinte minutos se lo enseño cargado con sus propios modelos.

¿Hoy cómo lleva sus pares, en libreta o en algún sistema?','texto','abrir con algo cierto del giro y ofrecer la demo','demo'),
('western','email','western demo · correo 2',2,'cuántos pares por modelo','Un modelo de bota se le vuelve un montón de pares sin que se dé cuenta. Del 25 al 30, con medias, ya son doce números. Multiplique por dos hormas y por tres pieles y de un solo modelo trae usted setenta y tantos pares distintos.

Y no todos valen igual. Un par de avestruz o de caimán cuesta lo que cuestan cinco de res. Si ese par se queda en la tienda equivocada, ahí está su dinero colgado hasta la otra feria.

¿Cuántos modelos maneja hoy en piso?','texto','enseñar el dolor con números del oficio','demo'),
('western','email','western demo · correo 3',3,'cada par con horma','Le cuento cómo funciona por dentro, para que juzgue si le sirve.

Cada modelo se abre por número, por horma y por piel. No es una línea que dice bota café: son los pares que de verdad tiene, uno por uno, y en cuál tienda está cada quien.

Así, cuando entra un cliente y quiere el 28 en horma puntal, quien está en mostrador ve si lo tiene ahí, si está en la otra tienda o si ya se acabó, y manda pedir el par sin prometer de más.

¿Tiene más de un punto de venta?','texto','mostrar cómo se resuelve por dentro','demo'),
('western','email','western demo · correo 4',4,'la libreta no avisa','Ya sé lo que va a pensar: la libreta funciona y usted se sabe su mercancía de memoria. Le creo, así empezó todo el que vende botas.

El detalle es que la libreta no avisa. No le dice que del 27 puntal ya no queda ni uno y lleva tres clientes pidiéndolo. No le dice cuántos pares de mantarraya llevan un año colgados. Y el día que no está usted, o no está el muchacho que se sabe todo, la tienda se vuelve lenta.

No le digo que esté mal llevado. Le digo que ya no le rinde.

¿Quién lleva hoy esa cuenta?','texto','romper la objeción del control actual','demo'),
('western','email','western demo · correo 5',5,'una cuenta de esta semana','Le dejo algo que puede hacer esta semana sin comprarme nada.

Agarre sus ventas del último año y sepárelas por número y por horma, no nada más por modelo. Luego ponga al lado cuántos pares tiene hoy de cada uno.

Le van a saltar dos cosas. Números que se le acaban temprano cada temporada y que debería pedir más hondo, y números que compra por costumbre y llevan dos ferias sin salir. En piel fina eso es dinero grande dormido.

Con eso ya sabe qué pedir y qué rematar antes de la próxima feria, y no necesita sistema para hacerlo. Nada más necesita las ventas apuntadas.

¿Tiene apuntadas las ventas de un año completo?','texto','dar algo útil aunque no compren','demo'),
('western','email','western demo · correo 6',6,'50 modelos, 1.2 millones','Un ejemplo de lo que aparece cuando uno se sienta a mirar el inventario en serio.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y salieron 1.2 millones de pesos mal repartidos entre la bodega y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la gente la pedía.

En botas eso pega más feo, porque un par de piel fina parado vale por varios. Ahí está el dinero, colgado, esperando la feria que ya pasó.

Si quiere, en veinte minutos le enseño el sistema cargado con sus modelos y usted juzga.

¿Le acomoda esta semana o la que entra?','texto','contar el caso real y proponer la demo','demo'),
('western','email','western demo · correo 7',7,'hasta aquí le escribo','[[si persona]]{{persona}}, [[/si]]no le quiero seguir llenando el correo, así que aquí le paro.

Le escribí porque los negocios de bota la pasan mal con los sistemas de tienda normales: ninguno entiende que un modelo trae doce números, dos hormas y varias pieles, ni que no es lo mismo un par de res que uno de avestruz. Los tratan como si vendieran playeras.

Si algún día se le junta mercancía parada, abre otra tienda o nada más quiere ver cómo se vería su catálogo adentro, me escribe y lo vemos en veinte minutos. No le vuelvo a insistir.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('western','email','western diagnostico · correo 1',1,'sus tiendas y sus pares','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]] y que ya trae {{sucursales}} tiendas[[/si]]. Con varias tiendas siempre pasa lo mismo: el 27 que le falta en una está colgado en otra, y ninguna de las dos lo sabe.

Hacemos inventario y punto de venta para negocios de moda. Con su información, en quince minutos le decimos cuánto dinero trae parado en pares que no están donde se venden. Sin costo.

¿Le late que lo veamos?','texto','abrir con sus sucursales y ofrecer el diagnóstico','diagnostico'),
('western','email','western diagnostico · correo 2',2,'dinero colgado en la pared','Cuando le digo dinero parado no hablo de una pérdida en papel. Hablo de pares que ya pagó y que están donde nadie los pide.

Con una tienda usted lo ve caminando el piso. Con varias, no. Cada tienda pide lo que se le acaba y nadie mira que ese mismo número sobra a dos horas de ahí. Al final compra otra vez algo que ya tenía, y el par viejo se va a remate en enero.

Entre más tiendas, más se reparte mal, y más rápido crece la bola.

¿Cuánto tarda hoy en pasar un par de una tienda a otra?','texto','explicar el dinero parado y por qué se multiplica','diagnostico'),
('western','email','western diagnostico · correo 3',3,'lo que salió en 50 modelos','Le pongo el caso que más se parece al suyo.

Un cliente nuestro, cadena de moda, nos dejó ver su inventario. Revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía comprada y pagada, nada más que no estaba donde la gente la pedía.

No hubo que comprar nada nuevo: con mover pares de una tienda a otra ya había venta. Eso mismo es lo que buscamos en los quince minutos, con sus números, no con los de nadie más.

¿Me deja hacerle esa cuenta con sus pares?','texto','contar el caso real de 1.2 millones','diagnostico'),
('western','email','western diagnostico · correo 4',4,'no le pido su base','Dos cosas que me suelen contestar aquí.

Una: no le voy a pasar mis números a un desconocido. Justo. Para esto no necesito nombres de clientes ni precios de compra. Con el listado de pares por tienda alcanza, y si quiere lo vemos en su pantalla y usted no me manda nada.

Dos: ya tengo sistema. Casi todos lo tienen, y casi ninguno le dice en qué tienda está mal repartido el 27 puntal. Guardar la venta es una cosa, repartir la mercancía es otra muy distinta.

¿Cuál de las dos le detiene más?','texto','romper las dos objeciones típicas','diagnostico'),
('western','email','western diagnostico · correo 5',5,'cómo medirlo usted mismo','Le dejo el método, por si nunca me contrata.

Escoja diez modelos de los que más se venden. Por cada tienda anote dos columnas: pares que tiene hoy y pares que vendió en los últimos tres meses.

Luego marque dos casos. Tienda con pares y sin venta, y tienda con venta y sin pares del mismo número. Cada vez que las dos cosas se dan al mismo tiempo en dos tiendas suyas, ahí hay un traspaso que le deja venta esta semana.

Multiplique los pares mal puestos por su precio de venta y ya tiene el tamaño del asunto. Con diez modelos se hace en una tarde.

¿Quiere que le haga esa cuenta con todos sus modelos?','texto','regalar el método aunque no contraten','diagnostico'),
('western','email','western diagnostico · correo 6',6,'qué sale en quince minutos','Para que sepa exactamente qué se lleva de los quince minutos, sin adivinar.

Uno: cuánto dinero trae parado, en pesos, tienda por tienda. Dos: la lista de traspasos que le dejan venta esta semana, par por par y de qué tienda a cuál. Tres: los números y hormas que se le acaban antes de tiempo, que son los que está dejando de vender. Cuatro: qué modelos ya no se mueven y conviene bajar antes de la temporada de ferias.

Sale en una llamada, con su información, y se lo dejo por escrito aunque no trabajemos juntos.

¿Qué día de esta semana le queda mejor?','texto','detallar las salidas concretas del diagnóstico','diagnostico'),
('western','email','western diagnostico · correo 7',7,'aquí le dejo de escribir','[[si persona]]{{persona}}, [[/si]]ya no le insisto más, nada más le dejo dicho para qué le escribí.

Con varias tiendas de bota el problema no es vender, es que la mercancía casi nunca está donde el cliente la pide. Y como cada par de piel buena cuesta lo que cuesta, ese error se paga caro y no se alcanza a ver en el corte del día.

La cuenta de los quince minutos sigue de pie cuando usted quiera, antes de la próxima feria o antes de la compra de temporada. No le cuesta nada y se la dejo por escrito.

¿Le busco más adelante o mejor lo saco de la lista?','texto','cerrar con dignidad','diagnostico'),
('zapaterias','email','zapaterias demo · correo 1',1,'la talla que faltaba','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]]. En calzado hay un momento que se repite: al cliente le gusta el modelo, pide su número y del 26 ya nada más queda el exhibidor. Se va, y esa venta no regresa.

Hacemos inventario y punto de venta para negocios de moda. Zapatería es de los giros más enredados, porque cada modelo no es un producto: son ocho o doce tallas.

¿Hoy cómo saben qué tallas les están faltando?','texto','abrir con el dolor real y ofrecer la demo','demo'),
('zapaterias','email','zapaterias demo · correo 2',2,'la curva se rompe','En zapatería el inventario no se cuenta por modelo. Se cuenta por talla.

Un modelo son ocho o doce números. Se acaban del 25 al 27, que es donde está la gente, y quedan colgados los extremos: el 22, el 23, el 30. El modelo sigue apareciendo con existencia, pero ya está muerto, porque nadie va a venir por esa talla.

Y el faltante no se pierde después. Se pierde ahí mismo, con el cliente enfrente y la caja abierta. De eso nadie levanta reporte, porque no queda registro de la venta que no fue.

¿Cuántos pares se les van al mes por número faltante?','texto','enseñar el dolor mecánico del giro','demo'),
('zapaterias','email','zapaterias demo · correo 3',3,'cada talla es un producto','Le cuento cómo lo trabajamos, para que usted juzgue si le sirve.

Cada talla lleva su propia línea de inventario, con su mínimo y su máximo. El sistema aprende cómo se vende cada número en cada tienda, porque no sale igual el 27 en el centro que en la plaza.

Cuando la curva se rompe, avisa antes de que se vacíe el centro. Y si el 24 sobra en una sucursal y falta en otra, arma el traspaso solo, ya con las cantidades. Lo que no salió en ningún lado se marca temprano, mientras todavía se puede rematar caro.

¿Cuántas tiendas manejan hoy?','texto','mostrar cómo se resuelve por dentro','demo'),
('zapaterias','email','zapaterias demo · correo 4',4,'la libreta no avisa','Muchas zapaterías llevan el control en libreta o en un Excel bien hecho, y aguanta años. No le digo que esté mal.

Le digo que no avisa. No le dice al de mostrador que el 27 de ese modelo se acabó ayer y que en la otra tienda hay tres pares parados. No cuenta por número cuando llega el pedido del proveedor. Y cuando sale de vacaciones el que se sabe el inventario de memoria, el negocio camina a ciegas.

Su control no está mal hecho. Nada más ya llegó a su tope.

¿Quién arma hoy el pedido al proveedor?','texto','romper la objeción del control actual','demo'),
('zapaterias','email','zapaterias demo · correo 5',5,'un ejercicio con sus ventas','Le dejo algo que puede hacer esta semana sin comprarme nada.

Agarre sus cinco modelos que más salen y saque las ventas de los últimos tres meses, pero anotadas por talla, no por modelo. Luego cuente lo que tiene hoy en piso y en bodega, también por talla.

Va a ver dos cosas. Que buena parte de su dinero está detenido en números extremos que salen una vez cada tanto. Y que los números de en medio, los que sí jalan, se le acaban mucho antes de que llegue el resurtido.

Con eso solo ya le puede cambiar la curva al siguiente pedido: menos orillas, más centro. No necesita sistema para hacerlo, necesita que la venta quede registrada por talla.

¿Sus ventas quedan hoy registradas por talla?','texto','dar algo útil aunque no compren','demo'),
('zapaterias','email','zapaterias demo · correo 6',6,'lo que salió en 50 modelos','Un ejemplo de lo que aparece cuando uno revisa el inventario en serio.

En un cliente nuestro, una cadena de moda, miramos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, nada más que no estaba donde la gente la pedía.

En calzado eso se ve clarito: cajas del 25 al 27 dormidas en bodega mientras en el mostrador que sí las vende dicen que no hay, y del 29 sobra en los dos lados.

Si quiere, en veinte minutos le enseño el sistema cargado con sus propios modelos y sus números, y usted decide.

¿Le acomoda esta semana o la que entra?','texto','contar el caso real y proponer la demo','demo'),
('zapaterias','email','zapaterias demo · correo 7',7,'lo dejo por aquí','[[si persona]]{{persona}}, [[/si]]no le quiero seguir llenando el correo, así que lo dejo por aquí.

Le escribí porque las zapaterías la pasan mal con los sistemas de tienda normales: casi ninguno entiende que un modelo son doce productos distintos y que el negocio se gana o se pierde en el número, no en el modelo. Los tratan como si vendieran playeras.

Si algún día se les llena la bodega de saldos, abren otra tienda o nada más tienen curiosidad de ver su catálogo abierto por talla adentro del sistema, me escribe y lo vemos en veinte minutos. No le vuelvo a insistir.

¿Le escribo el año que entra o mejor lo saco de la lista?','texto','cerrar con dignidad','demo'),
('zapaterias','email','zapaterias diagnostico · correo 1',1,'sus tiendas y los números','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]], con {{sucursales}} sucursales[[/si]]. Con varias tiendas de calzado el pleito ya no es cuánto compraron, es dónde quedó cada número.

Hacemos inventario y punto de venta para moda. Antes de venderle nada hacemos un diagnóstico gratis: con su información, en 15 minutos le decimos cuánto dinero trae parado y cuánto se le va en faltantes de talla.

¿Le agendo esos 15 minutos esta semana?','texto','abrir con sus sucursales y ofrecer el diagnóstico','diagnostico'),
('zapaterias','email','zapaterias diagnostico · correo 2',2,'dinero parado entre tiendas','Cuando digo dinero parado no hablo de lo que no se vende. Hablo de mercancía que sí se vende, pero está en la tienda equivocada.

Con un local el error se ve a ojo. Con varias ya no: el 25 sobra en una, falta en la otra y en la tercera nadie preguntó por él. Cada sucursal cree que le fue mal con ese modelo, y entre todas tenían la curva completa, nada más mal repartida.

Eso no aparece en el reporte de ventas ni en el de existencias por separado. Aparece cuando se cruzan los dos, tienda por tienda y talla por talla.

¿Hoy pueden ver ese cruce sin armarlo a mano?','texto','explicar dinero parado y por qué se multiplica','diagnostico'),
('zapaterias','email','zapaterias diagnostico · correo 3',3,'cincuenta modelos, 1.2 millones','Le paso un caso, sin adornos.

Un cliente nuestro, cadena de moda con centro de distribución. Tomamos 50 modelos, nada más 50, y cruzamos existencia contra venta por talla y por tienda. Salieron 1.2 millones de pesos mal repartidos: mercancía ya comprada y pagada, sentada donde no la pedían.

Nadie se había robado nada ni había comprado de más. El dinero estaba completo, nada más estaba en el lugar equivocado, que en calzado es lo mismo que no tenerlo.

Eso mismo es lo que sale del diagnóstico de 15 minutos, con sus datos en vez de los de él.

¿Con cuántos modelos activos trabajan hoy?','texto','contar el caso real','diagnostico'),
('zapaterias','email','zapaterias diagnostico · correo 4',4,'no necesito su base','Dos cosas que me contestan seguido, y las dos son justas.

La primera: no me van a pasar su base. No hace falta. Con la existencia por talla y la venta de tres meses, en Excel, sin costos ni nombres de clientes, alcanza. Firmamos confidencialidad si lo prefiere.

La segunda: ya tienen sistema. Casi siempre sí, y casi siempre guarda bien lo que pasó. El diagnóstico no viene a reemplazarlo, viene a leer lo que ya tienen adentro con un cruce que su sistema no hace: talla contra tienda contra venta.

Si después de verlo se quedan con lo que tienen, se quedan con el diagnóstico igual.

¿Le parece si lo hacemos con esos dos archivos?','texto','romper la objeción de datos y de sistema propio','diagnostico'),
('zapaterias','email','zapaterias diagnostico · correo 5',5,'cómo medirlo sin nosotros','Por si nunca nos contratan, le dejo el método para hacerlo a mano.

Escoja diez modelos de los que más mueve. Arme una tabla con las tallas en las filas y sus tiendas en las columnas, y ponga dos números en cada celda: piezas en existencia y piezas vendidas en los últimos noventa días.

Después marque dos tipos de celda. Las que tienen existencia y cero venta en noventa días, eso es dinero dormido. Y las que tienen venta constante y existencia en cero, eso es venta que se está perdiendo hoy.

Sume el costo de las primeras. Ese número suele espantar, y es el mismo que le entregaríamos nosotros, nada más que a mano y con diez modelos en lugar de todo el catálogo.

¿Quiere que le mande el formato de esa tabla?','texto','dar el método gratis','diagnostico'),
('zapaterias','email','zapaterias diagnostico · correo 6',6,'qué sale en quince minutos','Para que sepa qué está aceptando, esto es lo que sale de los 15 minutos.

Uno: cuánto dinero tienen parado en piezas sin movimiento, en pesos de costo, tienda por tienda. Dos: la lista de traspasos que convendría hacer mañana, con talla, origen y destino. Tres: los modelos donde la curva ya se rompió y solo quedan orillas. Cuatro: qué se está perdiendo por faltantes en los números que sí piden.

Sale en una hoja, se los explico en llamada y se queda con el archivo, contraten o no.

Lo único que necesito de su lado es existencia por talla y venta de tres meses.

¿Quién de su equipo puede sacar esos dos archivos?','texto','decir exactamente qué entrega el diagnóstico','diagnostico'),
('zapaterias','email','zapaterias diagnostico · correo 7',7,'cierro el tema','[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no me quiero volver ruido, así que aquí lo cierro.

Le insistí porque las cadenas de calzado son donde este problema pega más fuerte: la mercancía está completa, ya se pagó, y aun así el cliente se va sin su número. No es un problema de compras, es de reparto, y casi nadie lo mide porque no sale en ningún reporte estándar.

El diagnóstico sigue en pie sin costo cuando ustedes quieran, en temporada baja o cuando cierren el año. Me escribe y lo agendamos.

¿Lo dejamos así o le toco la puerta en unos meses?','texto','cerrar con dignidad','diagnostico');
