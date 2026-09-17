-- 17-sep-2026 · El texto NUEVO de la cadencia de novias de España.
--
-- POR QUÉ SE REESCRIBE ENTERA. El dueño leyó la anterior y la paró: «se siente
-- muy fuerte; alguien que no nos conoce lo vería como si le estuvieras
-- mandando. Debe ser más introductorio, explicando el valor, que nos dé
-- opciones para agendar según el calendario, que sepa que investigamos su
-- negocio, más como SPIN selling y no como una oferta barata de ventas». Y
-- después: «engancha más con la historia, mete la foto de la funcionalidad de
-- Sacs con el negocio en ese proceso, y siempre cinco puntos de lo que Sacs
-- ayuda ahí; de ahí cierras en el call to action».
--
-- QUÉ CAMBIA, ADEMÁS DEL TONO:
-- · La categoría va en el correo 1, antes que nada: no somos un TPV genérico
--   con un apartado de novias, somos el sistema completo de una casa de novia.
-- · Un solo CTA en todos: la media hora, y el hueco lo elige ella en la
--   agenda. Antes seis correos acababan preguntando volúmenes, que nadie
--   contesta en frío.
-- · Los 10.000 tokens ya dicen para qué sirven —fotos de sus vestidos con IA,
--   publicadas a la vez en el TPV y en la tienda online— y con qué condición:
--   quien entra se lleva además la web conectada al TPV y tres meses de
--   acompañamiento.
-- · Firma Andrea, y el correo la lleva con su foto (inquilino `sacs-intl`).
-- · LA CADENCIA YA NO SE DESPIDE. El último correo era «lo dejo aquí»; ahora
--   sigue dando valor —la reserva por dentro, lo que enseña una temporada, la
--   novia que vuelve, la segunda tienda—, porque el dueño quiere estar en su
--   cabeza cuando les toque decidir, no desaparecer al mes.
-- · Once correos en vez de ocho: días 1, 4, 6, 10, 14, 19, 25, 33, 47, 61, 75.
-- · El correo 1 va SIN imagen: es el que estrena dominio en un país nuevo y
--   cuanto más limpio, mejor entra. Del 2 en adelante, una foto cada uno.
--
-- Los WhatsApp se reescriben igual (días 2, 16, 36) y el tercero deja de
-- despedirse: dice que el correo sigue. Hay que volver a registrarlos en Meta
-- con este texto: sin APPROVED no sale ninguno y el cron los deja en la fila.
begin;

-- Fuera el texto viejo de la ruta demo (las plantillas de `diagnostico`, para
-- cadenas de 5+ tiendas, no se tocan).
delete from abm_pasos where cadencia_id = 'a1c0de11-0000-4000-8000-0000000e5001';
delete from abm_plantillas where giro = 'novias' and region = 'espana' and ruta = 'demo' and canal = 'email';
delete from abm_plantillas where giro = 'novias' and region = 'espana' and canal = 'whatsapp';

insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, formato, objetivo, imagen, variables, activa) values
('novias','email','demo','espana','presentacion',0,'casas de novia de España',
 E'[[si persona]]Hola {{persona}}.\n[[/si]]Le escribo de Sacs, y no vengo a venderle nada hoy.\n\nLe cuento en dos líneas qué somos, porque no es lo de siempre. No somos un TPV genérico con un apartado de novias encima.\n\nSomos el sistema completo de una casa de novia, de principio a fin: desde que la clienta entra a probarse hasta que se lleva el vestido. Todo en el mismo sitio, no en cuatro programas que no se hablan.\n\nDe dónde salió su correo: lo publican ustedes en su web. Nadie nos lo pasó. Si prefiere que no le escriba, el enlace del pie lo corta.\n\nLlegamos a {{nombre}} mirando una por una las casas de {{ciudad}}.[[si plataforma]] Su tienda online está en {{plataforma}}.[[/si]][[si sucursales]] Y que llevan {{sucursales}} tiendas.[[/si]] Lo que se ve desde fuera está cuidado.\n\nEn qué somos distintos, en concreto:\n· Cada novia tiene su ficha con la fecha de la boda: la señal, los pagos a cuenta y el saldo al día.\n· El muestrario va marcado aparte de lo que sí se vende, para que no se venda la única talla que tenía en tienda.\n· El taller de arreglos, con sus órdenes y sus fechas: qué vestido entra primero y desde cuándo está ahí.\n· El pedido al proveedor con su plazo, atado a esa novia: cuando llega, llega con nombre.\n· Y detrás, lo de siempre: stock por tienda, traspasos, cierre de caja y la comisión de la dependienta.\n\nAbajo le dejo la página donde está todo explicado, por si quiere verlo con calma antes de hablar con nadie.\n\nY si le apetece que se lo enseñemos: son treinta minutos como mucho, con la consultora que lleva las casas de novia de {{ciudad}}, que conoce el nicho y sabe de lo que le habla. Elija el hueco que le venga bien en nuestra agenda.\n\nUna cosa más, por si el día de mañana dan el paso: quien entra ahora se lleva 10.000 tokens para hacer las fotos de sus vestidos con IA, su página web conectada al TPV —mismo stock, mismas fotos— y tres meses de acompañamiento con una experta en novias para dejarlo montado.\n\nUn saludo,\nAndrea',
 'texto','presentarse, decir de dónde salió el dato y qué somos; pedir la media hora sin presionar',null,'[]',true),
('novias','email','demo','espana','novias es · correo 1',1,'la ficha de la novia',
 E'Le cuento algo que nos pasó el primer día que nos sentamos en una tienda como la suya.\n\nEntró una novia a preguntar por su vestido. La chica que atendía abrió el cuaderno, pasó tres páginas y le dijo: «creo que llega la semana que viene, deja que pregunte».\n\nEsa frase —«deja que pregunte»— es la que nos hizo construir esto.\n\n\nLo que hace Sacs en esa parte del proceso:\n· Cada novia tiene su ficha con la fecha de la boda arriba del todo, y todo cuelga de ahí.\n· El modelo y la talla que pidió, con su prueba y su entrega ya puestas en el calendario.\n· La señal, los pagos a cuenta y el saldo, a la vista de quien atiende.\n· El sistema cuenta hacia atrás desde la boda, así que avisa cuando aún hay margen.\n· Y lo ve cualquiera de su equipo, no solo quien se lo sabe de memoria.\n\nSi le apetece verlo con sus propios modelos delante, son treinta minutos como mucho, con la consultora que lleva las casas de novia de {{pais}}. Elija el hueco que le venga bien en nuestra agenda.\n\nUn saludo,\nAndrea',
 'texto','la ficha de la novia: la historia del «deja que pregunte»','novias-es-2-ficha.jpg','[]',true),
('novias','email','demo','espana','novias es · correo 2',2,'la talla del escaparate',
 E'Esta nos la contaron en casi todas las tiendas que visitamos, y siempre con la misma cara.\n\nUn sábado con la tienda llena, alguien vende el vestido del escaparate. El del muestrario. La única pieza que había para enseñar.\n\nSe descubre el lunes, cuando la siguiente novia pide probárselo.\n\n\nLo que hace Sacs en esa parte del proceso:\n· El muestrario va marcado aparte: se prueba, pero no se vende.\n· Si alguien intenta cobrarlo, salta el aviso antes de cerrar la venta.\n· Cada modelo lleva su curva de tallas, y se ve cuál es la que de verdad se pide.\n· Lo que está reservado para una novia deja de estar disponible para otra al momento.\n· Y si tiene más de una tienda, ve dónde está esa talla sin llamar a nadie.\n\n¿Le apetece que se lo enseñe? Treinta minutos, el hueco que usted elija.\n\nUn saludo,\nAndrea',
 'texto','el muestrario aparte: el vestido del escaparate vendido un sábado','novias-es-3-muestrario.jpg','[]',true),
('novias','email','demo','espana','novias es · correo 3',3,'el taller, por fechas',
 E'En el taller es donde se juntan los nervios, y siempre por lo mismo.\n\nNadie sabe cuántas prendas hay dentro hasta que ya son demasiadas. Se ve el jueves, cuando la boda es el sábado y ya no hay quien lo mueva.\n\n\nLo que hace Sacs en esa parte del proceso:\n· Cada arreglo es una orden con su fecha: cuándo entra y para cuándo tiene que salir.\n· La carga de la semana se ve antes, no cuando ya está encima.\n· Cada prenda sabe de qué novia es y para qué boda, sin etiquetas sueltas.\n· Quien atiende puede decir una fecha sin ir a preguntar a nadie.\n· Y queda el registro de quién hizo qué, que en temporada alta vale oro.\n\nSi quiere verlo con sus propias prendas: treinta minutos, con la consultora que lleva las casas de novia de {{pais}}. Elija hueco.\n\nUn saludo,\nAndrea',
 'texto','el taller por fechas: la carga que se ve el jueves','novias-es-4-taller.jpg','[]',true),
('novias','email','demo','espana','novias es · correo 4',4,'el proveedor con nombre',
 E'La pieza que más veces se rompe es siempre la misma: el pedido al proveedor.\n\nSe pide por WhatsApp o por correo, se apunta en el cuaderno, y ahí se queda. Hasta que llama la madre de la novia preguntando si el vestido está.\n\n\nLo que hace Sacs en esa parte del proceso:\n· El pedido queda atado a esa novia y a esa boda, con el plazo del proveedor.\n· Cuando llega, llega con nombre: se recibe contra la ficha, no a un montón.\n· Si se retrasa, avisa antes de que alguien tenga que dar explicaciones.\n· En tienda puede decirle a una clienta si ese modelo llega a tiempo para octubre.\n· Y al final de la temporada sabe qué proveedor cumple y cuál no.\n\nEs la diferencia entre prometer una fecha y saberla. Treinta minutos y se lo enseño con sus proveedores: elija hueco en la agenda.\n\nUn saludo,\nAndrea',
 'texto','el pedido al proveedor atado a la novia','novias-es-5-proveedor.jpg','[]',true),
('novias','email','demo','espana','novias es · correo 5',5,'sus vestidos, en la modelo',
 E'Esto es lo más nuevo que tenemos, y es lo que más ilusión hace a las casas que lo prueban.\n\nUna tienda nos dijo: «las fotos buenas cuestan una sesión, y para cuando las tengo el vestido ya se vendió».\n\n\nLo que hace Sacs en esa parte del proceso:\n· Fotografía el vestido colgado con el móvil y se lo devuelve puesto en la modelo que elija.\n· Sin sesión, sin estudio y sin esperar una semana.\n· Esa foto sale sola en su página web y en el TPV, con el mismo stock detrás.\n· Lo que se vende en tienda deja de estar disponible en la web al momento.\n· Y el catálogo que enseña por WhatsApp es el mismo, siempre al día.\n\nNada de esto se cobra aparte: quien entra ahora se lleva 10.000 tokens para esas fotos, su página web conectada al TPV y tres meses de acompañamiento con una experta en novias.\n\nSi quiere verlo funcionando con un vestido suyo, elija hueco: treinta minutos.\n\nUn saludo,\nAndrea',
 'texto','las fotos con IA y el paquete de lanzamiento','novias-es-6-fotos-ia.jpg','[]',true),
('novias','email','demo','espana','novias es · correo 6',6,'cincuenta modelos',
 E'Un dato real, y le digo de dónde sale: un cliente nuestro, una cadena de moda, en otro país. No es {{pais}} y no es novias.\n\nRevisamos cincuenta modelos. Nada más. Aparecieron unos 55.000 euros de mercancía comprada, pagada y en el sitio equivocado.\n\nNo estaba perdida. Estaba donde nadie la pedía.\n\n\nLo que hace Sacs en esa parte del proceso:\n· Le dice cuánto dinero tiene parado y en qué modelos, no en un total.\n· Separa lo que de verdad rota de lo que lleva meses colgado.\n· Marca las piezas gastadas de tanto probarse, que siguen contando como buenas.\n· Saca las señales cobradas de vestidos que aún no han llegado.\n· Y si tiene varias tiendas, le dice qué mover de una a otra y en qué orden.\n\nNo sé si en {{nombre}} pasa. Nadie lo sabe hasta que lo mira, y eso es parte de lo que hacemos en esos treinta minutos: mirarlo con usted, con sus números.\n\nUn saludo,\nAndrea',
 'texto','el caso real de los 55.000 euros','novias-es-7-almacen.jpg','[]',true),
('novias','email','demo','espana','novias es · correo 7',7,'la reserva, por dentro',
 E'[[si persona]]{{persona}}, [[/si]]le he escrito unas cuantas veces y todavía no le he contado la parte que más nos piden: la reserva.\n\nEn una casa de novia el dinero entra a trozos y a lo largo de meses. Una señal hoy, un pago a cuenta en la prueba, el resto al recoger. Y mientras tanto, la boda se acerca.\n\nCuando eso vive en un cuaderno, la pregunta «¿cuánto debe esta novia?» siempre la contesta la misma persona.\n\nLo que hace Sacs en esa parte del proceso:\n· Cada reserva lleva su fecha de boda, su señal y lo que queda, a la vista de quien atiende.\n· Los pagos a cuenta se apuntan en la ficha, con quién cobró y cuándo.\n· Si una novia va retrasada con el segundo pago, el sistema lo dice antes de la prueba.\n· El recibo sale con el saldo escrito, para que no se discuta en la entrega.\n· Y al cierre del día cuadra la caja con lo que entró de reservas, sin sumar a mano.\n\nNo hace falta que hablemos para que le sirva: esto es lo que hemos visto que más ordena una tienda. Pero si quiere verlo con sus números, son treinta minutos con la consultora que lleva las casas de novia de {{pais}}, el día que usted elija.\n\nUn saludo,\nAndrea',
 'texto','la reserva por dentro: la señal y los pagos a cuenta','novias-es-9-reserva.jpg','[]',true),
('novias','email','demo','espana','novias es · correo 8',8,'lo que enseña una temporada',
 E'Le mando algo que a las casas que ya lo tienen montado les cambió la forma de comprar.\n\nAl acabar la temporada, casi todo el mundo mira cuánto vendió. Y lo que de verdad enseña es otra cosa: qué se probó mucho y se vendió poco.\n\nEse modelo que todas se prueban y ninguna se lleva está ocupando sitio, tiempo de dependienta y dinero.\n\nLo que hace Sacs en esa parte del proceso:\n· Cuenta las pruebas, no solo las ventas, y las cruza con lo que acabó comprándose.\n· Le dice qué tallas se piden de verdad, para que el muestrario sea el que se vende.\n· Mide cuánto tarda cada proveedor en llegar, con sus retrasos reales.\n· Le dice cuántos días pasan de media entre la reserva y la boda en su tienda.\n· Y con eso, qué pedir para la próxima temporada, modelo por modelo.\n\nSi quiere, en esos treinta minutos se lo sacamos con sus números del año pasado. Elija hueco cuando le venga bien.\n\nUn saludo,\nAndrea',
 'texto','lo que enseña una temporada: probados contra vendidos','novias-es-10-informe.jpg','[]',true),
('novias','email','demo','espana','novias es · correo 9',9,'la novia que vuelve',
 E'Una cosa que casi ninguna casa aprovecha, y está delante.\n\nLa novia que se casó en junio tiene una hermana, una madre y cinco amigas. Y todas necesitan vestido: la madrina, la invitada, la de la comunión, la del bautizo.\n\nEs la misma clienta, la misma talla, el mismo gusto. Y casi siempre se pierde porque nadie se acuerda de escribirle.\n\nLo que hace Sacs en esa parte del proceso:\n· Guarda la ficha de cada clienta con lo que se probó, su talla y su fecha.\n· Le avisa cuando toca escribirle, sin que nadie lleve la cuenta.\n· El catálogo de fiesta se le manda por WhatsApp con el stock de verdad detrás.\n· Lo que se vende en tienda deja de ofrecerse en el mensaje al momento.\n· Y verá, al final del año, cuánto de su venta vino de novias que ya eran suyas.\n\nEsto es de lo que más hablamos en la media hora, porque es dinero que ya está en su tienda. Elija el hueco que le venga.\n\nUn saludo,\nAndrea',
 'texto','la novia que vuelve: madrina, invitada, comunión','novias-es-11-fiesta.jpg','[]',true),
('novias','email','demo','espana','novias es · correo 10',10,'cuando entra la segunda tienda',
 E'Le escribo por algo que nos preguntan mucho y casi nadie cuenta antes de tiempo.\n\nAbrir la segunda tienda no dobla el trabajo: lo multiplica. El vestido que piden en una está colgado en la otra, y nadie sabe cuál es el bueno hasta que alguien va a mirar.\n\nLo mismo pasa con dos personas atendiendo la misma agenda de pruebas.\n\nLo que hace Sacs en esa parte del proceso:\n· Un solo stock, con lo que hay en cada tienda a la vista desde las dos.\n· Los traspasos con su registro: qué salió, qué llegó y quién lo movió.\n· La agenda de pruebas compartida, sin dobles citas.\n· La caja de cada tienda por separado y el total del día en la misma pantalla.\n· Y la comisión de cada dependienta calculada sola, con lo que vendió de verdad.\n\nTanto si tiene dos como si algún día las tendrá, esos treinta minutos le sirven para verlo antes de decidirlo.\n\nUn saludo,\nAndrea',
 'texto','la segunda tienda: un solo stock y una sola agenda','novias-es-12-dos-tiendas.jpg','[]',true);

-- Los WhatsApp, con el mismo encuadre y sin despedida en el último.
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, formato, objetivo, imagen, variables, activa) values
('novias','whatsapp','ambas','espana','abre',1,null,
 E'Buenos días. Le escribo de Sacs: stock y TPV para negocios de moda.\n\nLlevo semanas levantando a mano el mapa de las casas de novia de {{pais}} y así llegué a {{nombre}}, en {{ciudad}}. Los encontré en Google Maps y en su web; nadie nos pasó su contacto. Si prefiere no recibir más mensajes, responda «no» y lo retiro.\n\nNo somos un TPV genérico con un apartado de novias encima: es el sistema completo de una casa de novia, con la reserva y la fecha de la boda, la señal y los pagos a cuenta, las pruebas, el taller de arreglos y el pedido al proveedor con su plazo.\n\nMe gustaría dedicarle media hora de videollamada. Es un rato que se cobra y con ustedes no: es lo que ponemos para abrirnos camino aquí y apoyar a quien se anima con un software de verdad especializado.\n\n¿Le busco un hueco esta semana?',
 'texto','WhatsApp · abre. Plantilla de Meta (es_ES), texto fijo.',null,'[]',true),
('novias','whatsapp','ambas','espana','sigue',2,null,
 E'Le escribo una vez más y ya no insisto por aquí.\n\nSigue en pie la media hora de videollamada: usted cuenta cómo lleva hoy las reservas de {{nombre}} y yo le enseño cómo queda eso por dentro, con sus modelos y sus fechas.\n\nAl terminar le cargamos 10.000 tokens de inteligencia artificial en su cuenta: sirven para hacer las fotos de sus vestidos con IA, puestos en la modelo que elija, y publicarlas a la vez en su TPV y en su tienda online. Quedan a su nombre y no hace falta ninguna tarjeta.\n\nEstamos empezando en {{pais}} con unas pocas casas elegidas a mano, y la zona de {{ciudad}} nos interesa de verdad.\n\n¿Le viene bien esta semana o la próxima?',
 'texto','WhatsApp · sigue. Plantilla de Meta (es_ES), texto fijo.',null,'[]',true),
('novias','whatsapp','ambas','espana','cierra',3,null,
 E'Con este cierro el seguimiento por aquí, y gracias por el tiempo.\n\nHe pasado semanas mirando casas de novia de {{pais}}, y {{nombre}} es una de las que nos habría gustado tener del lado de Sacs.\n\nLe sigo mandando por correo lo que vamos aprendiendo del oficio —las reservas, el taller, lo que enseña una temporada—, sin compromiso ninguno. Y la media hora de videollamada queda abierta, con los 10.000 tokens de IA para las fotos de sus vestidos.\n\nSi algún día le pesa la temporada, me escribe por aquí y lo vemos.\n\nMucha suerte con lo que viene en {{ciudad}}.',
 'texto','WhatsApp · cierra. Plantilla de Meta (es_ES), texto fijo.',null,'[]',true);

update abm_plantillas set meta_nombre = 'abm_novias_es_' || nombre, meta_idioma = 'es_ES',
  boton_texto = case nombre when 'abre' then 'Sí, muéstrenme | Ahora no' when 'sigue' then 'Esta semana | Mejor no' else 'Reservar cuando quiera' end,
  boton_url = case nombre when 'cierra' then 'https://www.sacscloud.com/agendar/demo' end
where giro = 'novias' and canal = 'whatsapp' and region = 'espana';

-- Los pasos: once correos y tres WhatsApp.
insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select 'a1c0de11-0000-4000-8000-0000000e5001', d.dia, d.orden, 'email', p.id, true, d.nota
from (values
  (1,1,0,'Presentación: qué somos y de dónde salió su dato'),
  (4,2,1,'La ficha de la novia'),
  (6,3,2,'El muestrario aparte'),
  (10,4,3,'El taller por fechas'),
  (14,5,4,'El proveedor atado a la novia'),
  (19,6,5,'Las fotos con IA y el paquete'),
  (25,7,6,'El caso real de los 55.000 euros'),
  (33,8,7,'La reserva por dentro'),
  (47,9,8,'Lo que enseña una temporada'),
  (61,10,9,'La novia que vuelve'),
  (75,11,10,'La segunda tienda')
) as d(dia, orden, pl_orden, nota)
join abm_plantillas p on p.giro='novias' and p.canal='email' and p.region='espana' and p.ruta='demo' and p.orden=d.pl_orden and p.activa;

insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select 'a1c0de11-0000-4000-8000-0000000e5001', d.dia, d.orden, 'whatsapp', p.id, true, d.nota
from (values (2,20,'abre','Un día después del primer correo'),(16,21,'sigue','A media cadencia'),(36,22,'cierra','Cierra el WhatsApp; el correo sigue')) as d(dia, orden, pl, nota)
join abm_plantillas p on p.giro='novias' and p.canal='whatsapp' and p.region='espana' and p.nombre=d.pl and p.activa;

commit;

select (select count(*) from abm_plantillas where giro='novias' and region='espana' and ruta='demo' and canal='email') correos,
       (select count(*) from abm_plantillas where giro='novias' and region='espana' and canal='whatsapp') whatsapp,
       (select count(*) from abm_pasos where cadencia_id='a1c0de11-0000-4000-8000-0000000e5001') pasos;
