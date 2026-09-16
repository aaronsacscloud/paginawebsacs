-- ══ Los dos giros que quedaron a medias: jeans y trajes de baño ══════════════
--
-- El 15-sep se les escribió el correo 0 de presentación junto con los otros 21
-- giros, y ahí se quedaron: sin los siete correos de la cadencia, sin pasos y
-- sin renglón en abm_cadencias. O sea que tenían la puerta y no la casa. Un
-- goteo apuntado a cualquiera de los dos habría fallado con «todavía no hay
-- plantillas escritas para el giro».
--
-- Entre los dos son 89 cuentas alcanzables (63 con correo, 9 con WhatsApp).
--
-- EL QUIEBRE DE CADA UNO, que es de donde sale todo el texto (abm-giro-copy.ts):
--
--   jeans       una talla 30 no es una talla 30: es corte, largo y lavado. Un
--               modelo son treinta o sesenta renglones, y el cliente quiere
--               uno solo. El que encuentra el suyo vuelve por el mismo.
--   trajesbano  el año se juega en temporada. El error de compra no se paga
--               con descuento, se paga con doce meses de bodega.
--
-- La prueba del manual (§7.7): cambie el giro en cualquiera de estos párrafos
-- y tiene que dejar de leerse bien. Si sigue sirviendo, está mal escrito.

insert into abm_cadencias (nombre, giro, ruta, descripcion, region, activa) values
('Jeans y mezclilla · demo','jeans','demo','Cadencia de 8 correos, del día 1 al 33, escrita para la tienda de jeans: inventario por talla, corte, largo y lavado, curva rota, traslado entre tiendas y pedido por curva.','mexico',true),
('Jeans y mezclilla · diagnóstico','jeans','diagnostico','Cadencia de 8 correos, del día 1 al 33, con el diagnóstico gratis como ofrecimiento y el ángulo de varias tiendas.','mexico',true),
('Trajes de baño y playa · demo','trajesbano','demo','Cadencia de 8 correos, del día 1 al 33, escrita para el traje de baño: temporada corta, comparativo contra la temporada pasada y compra con dato en vez de memoria.','mexico',true),
('Trajes de baño y playa · diagnóstico','trajesbano','diagnostico','Cadencia de 8 correos, del día 1 al 33, con el diagnóstico gratis y el ángulo de varias tiendas en temporada.','mexico',true);

insert into abm_plantillas (giro, canal, ruta, orden, nombre, asunto, cuerpo, objetivo, formato, region, activa) values

-- ── jeans · demo ────────────────────────────────────────────────────────────
('jeans','email','demo',1,'jeans demo · correo 1','el cliente que ya encontró el suyo','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y le escribo por algo muy de mezclilla: el cliente que por fin encuentra su jean —su corte, su largo, su lavado— vuelve por exactamente el mismo. Y si esa vez no lo trae, no se lleva otro. Se va.

Hacemos software de inventario y punto de venta para negocios de moda, con el inventario abierto por talla, corte y largo, no por modelo.

¿Hoy puede ver desde el mostrador si ese mismo jean está en otra de sus tiendas?','abrir con el dolor propio del giro y ofrecer la demo','texto','mexico',true),

('jeans','email','demo',2,'jeans demo · correo 2','una talla 30 no es una talla 30','Un jean no es un producto: es una cuadrícula.

Un solo modelo se abre en cinco o seis tallas, tres o cuatro cortes, dos o tres largos y un par de lavados. Eso son sesenta renglones de inventario donde el sistema le enseña uno, con un número grande al lado.

Por eso el reporte dice que hay ochenta jeans y en el piso no hay nada que ofrecerle al que acaba de entrar: los ochenta son el 36 en bota, largo 34, que lleva año y medio ahí.

¿Cómo saben hoy qué combinaciones están en cero?','enseñar el dolor mecánico con números del oficio','texto','mexico',true),

('jeans','email','demo',3,'jeans demo · correo 3','cómo se guarda un jean por dentro','Le cuento cómo lo resolvemos, para que juzgue si le sirve.

El modelo se da de alta una vez y adentro se abre solo: talla, corte, largo y lavado son renglones propios, cada uno con su existencia y su venta. Quien atiende ve en la pantalla si esa combinación está en su tienda, en otra o en bodega, y la pide o la aparta ahí mismo, con el cliente enfrente.

Y el pedido al proveedor sale por curva, no por bulto: se pide la corrida de lo que de verdad se vendió, con su tiempo de entrega.

¿Cómo arman hoy el pedido al proveedor?','mostrar cómo se resuelve por dentro','texto','mexico',true),

('jeans','email','demo',4,'jeans demo · correo 4','me lo sé de memoria','Lo que más me contestan es que se saben la tienda de memoria. Y casi siempre es cierto.

El detalle es que la memoria se acuerda del modelo, no de la cuadrícula. Uno se acuerda de que el skinny oscuro sale bien; nadie se acuerda de que el 30 en largo 32 se acabó hace tres semanas y que el 38 en largo 34 lleva ocho meses colgado.

Y esa memoria no se traspasa. El sábado que está el nuevo, el cliente pregunta por el suyo y la respuesta es déjeme reviso.

No le digo que su control esté mal hecho. Le digo que no alcanza a contestar con el cliente parado enfrente.

¿Quién lleva hoy el inventario?','romper la objeción del control actual','texto','mexico',true),

('jeans','email','demo',5,'jeans demo · correo 5','el ejercicio de la cuadrícula','Le dejo algo que puede hacer esta semana sin comprarme nada.

Agarre sus diez modelos que más salen y arme una tabla: un renglón por modelo, una columna por cada combinación de talla y largo que maneja. Marque con cruz cada casilla que hoy trae en cero.

Lo que va a ver es que las cruces no están repartidas: se juntan justo en el centro de la cuadrícula, que es donde está la venta. Y lo que sí tiene completo son las orillas.

Ahí está su dinero, en las dos direcciones: lo que no puede vender y lo que no se va a vender.

¿Quiere que revisemos esa tabla juntos?','dar un método útil sin vender nada','texto','mexico',true),

('jeans','email','demo',6,'jeans demo · correo 6','50 modelos, 1.2 millones','Un ejemplo de lo que aparece cuando uno mira el inventario combinación por combinación.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas: mercancía ya comprada y pagada, en la tienda equivocada y en la talla equivocada. No hubo que comprar nada, hubo que moverlo.

En mezclilla eso pesa más, porque la cuadrícula es más grande y el dinero se esconde mejor.

Se lo enseño en treinta minutos por videollamada, en su horario y con sus propios modelos.

¿Le queda bien esta semana?','contar el caso real y proponer la demo','texto','mexico',true),

('jeans','email','demo',7,'jeans demo · correo 7','aquí le paro','[[si persona]]{{persona}}, [[/si]]no quiero seguir llenándole el correo, así que aquí le paro.

Le escribí porque los sistemas de tienda normales tratan un jean como si fuera una sola cosa, y en su negocio un modelo son treinta o sesenta combinaciones. El que cuenta piezas sin saber de qué corte y de qué largo son, no está contando nada.

La demo de treinta minutos sigue en pie cuando usted quiera, y si nunca la toma, ahí le quedan los correos.

¿Le busco más adelante o mejor lo saco de la lista?','cerrar con dignidad','texto','mexico',true),

-- ── jeans · diagnóstico ─────────────────────────────────────────────────────
('jeans','email','diagnostico',1,'jeans diagnostico · correo 1','sus cortes entre las tiendas','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]], con {{sucursales}} sucursales[[/si]]. Con varias tiendas y mezclilla pasa siempre lo mismo: el 30 en largo 32 que se acabó el viernes en una está colgado en la otra desde hace medio año, y ninguna de las dos lo sabe.

Hacemos software de inventario y punto de venta para moda. Antes de proponerle nada, le ofrezco un diagnóstico gratis de treinta minutos con su información.

¿Le interesa que lo veamos?','abrir con sus sucursales y ofrecer el diagnóstico','texto','mexico',true),

('jeans','email','diagnostico',2,'jeans diagnostico · correo 2','por qué se multiplica','Dinero parado no es lo que no se vende. Es lo que sí se vende, pero está en la tienda equivocada y en la combinación equivocada.

Con una tienda eso se arregla caminando al anaquel. Con cuatro tiendas y un modelo que se abre en treinta combinaciones, cada modelo tiene ciento veinte lugares donde puede estar mal puesto. Nadie lleva eso en la cabeza, y el reporte que dice ochenta jeans no lo enseña.

Por eso en mezclilla el dinero dormido casi nunca se ve de golpe: no está en un modelo muerto, está repartido en migajas por toda la cuadrícula.

¿Hoy pueden ver el inventario de todas las tiendas en una sola pantalla?','explicar el dinero parado en cuadrícula y varias tiendas','texto','mexico',true),

('jeans','email','diagnostico',3,'jeans diagnostico · correo 3','50 modelos, 1.2 millones','Le pongo el ejemplo más claro que tengo.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos. Entre el centro de distribución y las tiendas había 1.2 millones de pesos mal repartidos: mercancía comprada y pagada que estaba donde no se vendía, mientras en otra tienda la pedían y no la había.

No hubo que comprar nada. Hubo que moverlo, y saber cuál mover.

Eso es exactamente lo que le entrego en el diagnóstico, con sus números.

¿Qué día le queda bien?','contar el caso real','texto','mexico',true),

('jeans','email','diagnostico',4,'jeans diagnostico · correo 4','no le pido sus datos','Dos cosas que me contestan siempre en este punto.

Una: no le paso mi información. Se entiende. No necesito nombres de clientes ni sus costos. Con la lista de modelos por tienda, con talla y largo, alcanza; y si prefiere lo vemos en su pantalla y usted no me manda nada.

Dos: ya tengo sistema. Puede ser, pero casi ninguno abre un modelo en corte y largo sin volverlo un producto distinto, y ahí se pierde la curva completa.

¿Cuál de las dos le pesa más?','romper las dos objeciones típicas','texto','mexico',true),

('jeans','email','diagnostico',5,'jeans diagnostico · correo 5','mídalo usted sin nosotros','Le dejo el método completo, por si nunca me contrata.

Saque sus diez modelos que más salen y arme la cuadrícula por tienda: talla y largo en las columnas, tiendas en los renglones. Marque los ceros.

Luego cuente cuántas combinaciones están en cero en una tienda y con tres o más piezas en otra. Cada una de esas es una venta que ya podía haber hecho, sin comprar nada.

Súmelas a precio de venta. Ese número es lo que le está costando no ver la cuadrícula completa.

¿Quiere que le arme esa tabla con sus datos?','regalar el método de medición','texto','mexico',true),

('jeans','email','diagnostico',6,'jeans diagnostico · correo 6','qué le entrego en treinta minutos','Para que sepa qué se lleva de los treinta minutos, sin sorpresas.

Uno: cuánto dinero trae dormido, en pesos, y en qué tienda está. Dos: qué combinaciones conviene mover de una tienda a otra esta semana. Tres: cuáles de sus modelos tienen la curva rota, o sea que ya no se pueden vender aunque queden piezas. Cuatro: cómo quedaría su próximo pedido al proveedor si se armara con lo que de verdad se vendió.

Es una llamada con su información, y se lo dejo por escrito trabajemos o no.

¿Qué día de esta semana le queda bien?','detallar las salidas concretas del diagnóstico','texto','mexico',true),

('jeans','email','diagnostico',7,'jeans diagnostico · correo 7','ya no le escribo más','[[si persona]]{{persona}}, [[/si]]ya no le escribo más, nada más le dejo dicho para qué le buscaba.

La mezclilla con varias tiendas es de los inventarios más difíciles que hay, porque un modelo no es un modelo: son treinta combinaciones y el cliente quiere una sola. Ningún sistema de tienda normal está hecho para eso.

El diagnóstico de treinta minutos sigue en pie cuando usted quiera, y se lo entrego por escrito aunque no trabajemos juntos. No le cuesta nada.

¿Le busco más adelante o mejor lo saco de la lista?','cerrar con dignidad','texto','mexico',true),

-- ── trajes de baño · demo ───────────────────────────────────────────────────
('trajesbano','email','demo',1,'trajesbano demo · correo 1','lo que no se vendió en agosto','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y le escribo por algo muy de su giro: el año se le juega en unos cuantos meses. Lo que no salió en temporada no se queda esperando al mes que entra, se queda esperando un año.

Hacemos software de inventario y punto de venta para negocios de moda, con el inventario abierto por talla y color y el comparativo de una temporada contra la anterior.

¿Con qué dato compran hoy la temporada que viene?','abrir con el dolor propio del giro y ofrecer la demo','texto','mexico',true),

('trajesbano','email','demo',2,'trajesbano demo · correo 2','el calendario manda','En casi toda la moda, el error de compra se paga con descuento. En traje de baño se paga con un año.

La temporada dura unas semanas, y dentro de esas semanas hay dos o tres fines que valen por el resto. Si el pedido llega tarde, llegó para la temporada que viene. Si llegó completo pero con la curva chueca —mucha talla chica, poco color oscuro—, se vende la mitad y la otra mitad se guarda doce meses, ya pasada de moda.

Y al año siguiente uno compra otra vez, casi siempre de memoria, porque el dato de lo que se quedó está en cajas y no en una pantalla.

¿Cómo deciden hoy cuánto pedir de cada talla?','enseñar el dolor mecánico del giro','texto','mexico',true),

('trajesbano','email','demo',3,'trajesbano demo · correo 3','la temporada pasada, a la vista','Le cuento cómo lo resolvemos, para que juzgue si le sirve.

Cada modelo se guarda por talla y color, así que al cerrar la temporada no le queda un número: le queda la curva completa de qué se agotó en junio y qué siguió colgado en septiembre.

Con eso el pedido del año que entra deja de ser de memoria. Y durante la temporada, cuando en la tienda de playa se acaba una talla que en la otra sobra, el traslado se hace desde el mostrador, que en plaza turística la cosa cambia de un día para otro.

¿Hoy pueden ver qué tiene la otra tienda sin hablarle por teléfono?','mostrar cómo se resuelve por dentro','texto','mexico',true),

('trajesbano','email','demo',4,'trajesbano demo · correo 4','nosotros ya sabemos qué se vende','Lo que más me contestan es que ya saben qué se vende, que llevan años en esto.

Y es verdad a medias: uno se acuerda de lo que se agotó, porque duele que lo pidan y no haya. De lo que sobró casi nadie se acuerda, porque se guardó y dejó de verse.

El problema es que la compra se decide con las dos mitades. Acordarse solo de lo que faltó lleva a comprar de más el año siguiente, y ahí empieza otra vez.

No le digo que su criterio esté mal. Le digo que le falta la mitad del dato, y esa mitad está en cajas.

¿Quién arma hoy el pedido de temporada?','romper la objeción del control actual','texto','mexico',true),

('trajesbano','email','demo',5,'trajesbano demo · correo 5','el ejercicio de las cajas','Le dejo algo que puede hacer antes de la próxima compra, sin comprarme nada.

Abra lo que guardó de la temporada pasada y anote nada más dos columnas: modelo y talla. No cuente dinero todavía, cuente piezas.

Va a ver que no está parejo: casi siempre sobra la misma orilla de la curva y el mismo par de colores, temporada tras temporada. Eso no es mala suerte, es un patrón, y es exactamente lo que no hay que volver a pedir.

Súmelo a precio de venta al final. Ese número es lo que le cuesta comprar de memoria.

¿Quiere que lo veamos juntos con sus datos?','dar un método útil sin vender nada','texto','mexico',true),

('trajesbano','email','demo',6,'trajesbano demo · correo 6','50 modelos, 1.2 millones','Un ejemplo de lo que aparece cuando uno mira el inventario talla por talla.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas: mercancía comprada y pagada que estaba donde no se vendía.

En su giro eso pega más fuerte, porque el dinero mal puesto no espera una semana a que lo muevan: espera a la temporada que viene.

Se lo enseño en treinta minutos por videollamada, en su horario y con sus propios modelos.

¿Le queda bien esta semana?','contar el caso real y proponer la demo','texto','mexico',true),

('trajesbano','email','demo',7,'trajesbano demo · correo 7','aquí le paro','[[si persona]]{{persona}}, [[/si]]no quiero seguir llenándole el correo, así que aquí le paro.

Le escribí porque su negocio compra una vez y cobra en unas semanas, y el sistema de tienda normal no le dice qué se quedó la temporada pasada, que es justo el dato con el que se compra la siguiente.

La demo de treinta minutos sigue en pie cuando usted quiera, y si nunca la toma, ahí le quedan los correos.

¿Le busco más adelante o mejor lo saco de la lista?','cerrar con dignidad','texto','mexico',true),

-- ── trajes de baño · diagnóstico ────────────────────────────────────────────
('trajesbano','email','diagnostico',1,'trajesbano diagnostico · correo 1','su temporada entre las tiendas','[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]], con {{sucursales}} sucursales[[/si]]. Con varias tiendas y temporada corta pasa siempre lo mismo: la talla que se acabó el sábado en la playa está colgada en la de plaza, y para cuando alguien se da cuenta ya pasó el fin de semana que valía por el mes.

Hacemos software de inventario y punto de venta para moda. Antes de proponerle nada, le ofrezco un diagnóstico gratis de treinta minutos con su información.

¿Le interesa que lo veamos?','abrir con sus sucursales y ofrecer el diagnóstico','texto','mexico',true),

('trajesbano','email','diagnostico',2,'trajesbano diagnostico · correo 2','la semana que no vuelve','Dinero parado no es lo que no se vende. Es lo que sí se vende, pero está en la tienda equivocada.

En otros giros eso se corrige el mes que entra. En el suyo no hay mes que entre: si la talla estuvo mal puesta el fin de julio, esa venta no se recupera en noviembre.

Por eso en temporada el traslado entre tiendas no es un trámite administrativo, es la venta más barata del año: mercancía que ya compró y ya pagó, puesta donde sí la están pidiendo.

¿Hoy pueden ver el inventario de todas las tiendas en una sola pantalla?','explicar el dinero parado cuando la temporada es corta','texto','mexico',true),

('trajesbano','email','diagnostico',3,'trajesbano diagnostico · correo 3','50 modelos, 1.2 millones','Le pongo el ejemplo más claro que tengo.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos. Entre el centro de distribución y las tiendas había 1.2 millones de pesos mal repartidos: mercancía comprada y pagada que estaba donde no se vendía, mientras en otra tienda la pedían y no la había.

No hubo que comprar nada. Hubo que moverlo, y saber cuál mover.

Eso es lo que le entrego en el diagnóstico, con sus números y antes de que arranque la temporada.

¿Qué día le queda bien?','contar el caso real','texto','mexico',true),

('trajesbano','email','diagnostico',4,'trajesbano diagnostico · correo 4','no le pido sus datos','Dos cosas que me contestan siempre en este punto.

Una: no le paso mi información. Se entiende. No necesito nombres de clientes ni sus costos. Con la lista de modelos por tienda, con talla y color, alcanza; y si prefiere lo vemos en su pantalla y usted no me manda nada.

Dos: ya tengo sistema. Puede ser, pero casi ninguno guarda la temporada pasada de forma que se pueda comparar con la de ahora, y sin esa comparación el pedido se arma de memoria.

¿Cuál de las dos le pesa más?','romper las dos objeciones típicas','texto','mexico',true),

('trajesbano','email','diagnostico',5,'trajesbano diagnostico · correo 5','mídalo usted sin nosotros','Le dejo el método completo, por si nunca me contrata.

Tome sus diez modelos más fuertes y arme una tabla por tienda: tallas en las columnas, tiendas en los renglones, piezas en las casillas. Marque los ceros.

Cuente cuántas casillas están en cero en una tienda y con tres o más piezas en otra. Cada una es una venta que ya podía haber hecho este fin de semana, sin comprar nada.

Hágalo un viernes, no un lunes. En su giro el dato sirve para el fin que viene, no para el reporte del mes.

¿Quiere que le arme esa tabla con sus datos?','regalar el método de medición','texto','mexico',true),

('trajesbano','email','diagnostico',6,'trajesbano diagnostico · correo 6','qué le entrego en treinta minutos','Para que sepa qué se lleva de los treinta minutos, sin sorpresas.

Uno: cuánto dinero trae dormido, en pesos, y en qué tienda está. Dos: qué tallas y colores conviene mover de una tienda a otra antes del fin de semana. Tres: qué se quedó la temporada pasada, por modelo y talla, que es el dato con el que se arma la compra. Cuatro: cómo quedaría ese pedido si se armara con ese dato y no de memoria.

Es una llamada con su información, y se lo dejo por escrito trabajemos o no.

¿Qué día de esta semana le queda bien?','detallar las salidas concretas del diagnóstico','texto','mexico',true),

('trajesbano','email','diagnostico',7,'trajesbano diagnostico · correo 7','ya no le escribo más','[[si persona]]{{persona}}, [[/si]]ya no le escribo más, nada más le dejo dicho para qué le buscaba.

El traje de baño con varias tiendas es de los inventarios más castigados que hay: la temporada es corta, la curva es larga y lo que se queda no se queda una semana, se queda un año. Ningún sistema de tienda normal está hecho para eso.

El diagnóstico de treinta minutos sigue en pie cuando usted quiera, y se lo entrego por escrito aunque no trabajemos juntos. No le cuesta nada.

¿Le busco más adelante o mejor lo saco de la lista?','cerrar con dignidad','texto','mexico',true);

-- Los pasos, con el mismo ritmo que el resto: 1, 4, 6, 10, 14, 19, 25, 33.
-- Se tienden desde las plantillas para que `plantilla_id` no pueda quedar
-- apuntando a otro correo (ver 2026-09-16-correo0-tambien-es-un-paso.sql).
insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select k.id,
       (array[1,4,6,10,14,19,25,33])[t.orden + 1],
       t.orden + 1, 'email', t.id, true,
       case when t.orden = 0 then 'presentación: de dónde salió el dato' else null end
from abm_cadencias k
join abm_plantillas t
  on t.giro = k.giro and t.ruta = k.ruta and t.canal = 'email' and t.activa
 and coalesce(t.region,'mexico') = coalesce(k.region,'mexico')
where k.giro in ('jeans','trajesbano') and t.orden between 0 and 7;
