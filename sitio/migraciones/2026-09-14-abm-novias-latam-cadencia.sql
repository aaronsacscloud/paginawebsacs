-- 14-sep-2026 · Novias · cadencia de LATINOAMÉRICA (region 'latam').
--
-- Por qué: el dueño va a prospectar casas de novia en diez países de
-- Latinoamérica «exactamente con la misma lógica» que en México. El guion de
-- México (cadencias 085bb4af demo / 1bff645d diagnóstico) se reescribió en
-- español neutro: mismos 8 correos por ruta (días 1,4,6,10,14,19,25,33),
-- mismos 3 WhatsApp (días 2,16,36), mismas imágenes, mismo orden de ideas
-- —por qué le llega, el dolor mecánico, cómo se resuelve, la objeción del
-- control actual, algo útil gratis, el caso real, el cierre con dignidad—.
--
-- Lo que cambia y por qué:
-- · Sin mexicanismos: «apartado» → «reserva», «libreta» → «cuaderno»,
--   «aparador» → «vitrina», «corte de caja» → «cierre de caja», «playeras» →
--   «camisetas», «la que entra» → «la próxima», «le paro» → «lo dejo aquí».
-- · «México» → {{pais}} («el mapa de las casas de novia de Colombia»);
--   «XV años» → {{xv}} («15 años» en toda Latinoamérica).
-- · El caso real se cuenta en dólares («unos 60 mil dólares») porque «1.2
--   millones de pesos» en Chile o Colombia se lee como otra cantidad.
-- · No se promete facturación: la de Sacs es CFDI, que solo existe en México.
-- · La demo dice «por videollamada, en su horario». El bloque de cierre que
--   pone abm-correo.ts ya lleva la landing del país ({{landing}}), el botón
--   de agenda y el WhatsApp +52 en formato internacional.
-- · Perú: la ley 28493 exige «PUBLICIDAD» al inicio del asunto; lo pone el
--   código (asuntoPais en abm-paises.ts), no la plantilla.
-- · WhatsApp: plantillas nuevas para Meta en idioma `es` (no es_MX), con
--   {{nombre}}, {{ciudad}} y {{pais}}. Se registran en Meta SOLO cuando el
--   dueño lo apruebe (es un trámite hacia afuera); hasta entonces el cron las
--   deja en la fila y el correo sale igual.
-- · Un goteo por país, todos en `pausado` y las cuentas en `en_pausa`: no
--   sale nada hasta que el dueño revise el reporte. La migración de
--   lanzamiento es otra (2026-09-15-abm-novias-latam-encender.sql).
begin;
-- Sin índices únicos en plantillas/pasos/goteo: el candado contra correrla dos veces es este.
do $$ begin if exists (select 1 from abm_plantillas where giro='novias' and region='latam') then raise exception 'la cadencia Latam de novias ya existe'; end if; end $$;

-- ── A. Cadencias ─────────────────────────────────────────────────────────────
insert into abm_cadencias (id, nombre, giro, ruta, region, descripcion, activa, creada_por) values
  ('a1c0de11-0000-4000-8000-0000000a0001', 'Novias · demo · Latam', 'novias', 'demo', 'latam',
   'Casas de novia y fiesta fuera de México (Latinoamérica). 8 correos + 3 WhatsApp en español neutro; {{pais}}, {{xv}} y {{landing}} aterrizan el guion en cada país.', true, 'sistema'),
  ('a1c0de11-0000-4000-8000-0000000a0002', 'Novias · diagnóstico · Latam', 'novias', 'diagnostico', 'latam',
   'Casas de novia con 5+ sucursales fuera de México. Misma estructura que la de México, en español neutro.', true, 'sistema')
on conflict (id) do nothing;

-- ── B. Plantillas de correo · ruta demo ──────────────────────────────────────
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, formato, objetivo, imagen, variables, activa) values
('novias','email','demo','latam','presentacion',0,'por qué le llega este correo',
E'[[si persona]]Hola {{persona}}.\n[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las casas de novia de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.\nY no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]\n· {{senal}}.[[/si]][[si sucursales]]\n· {{sucursales}} sucursales.[[/si]][[si plataforma]]\n· Su tienda en línea está en {{plataforma}}.[[/si]]\nPor eso pensamos que le podemos servir. Hay mucho punto de venta genérico y todos hacen lo mismo: cobran y descuentan del inventario. En una casa de novias eso no alcanza, porque la venta no termina en la caja: termina en una fecha.\nTenemos una suite hecha para casas de novias y fiesta. Lo que resuelve:\n· Reserva con fecha del evento y abonos, con el saldo al día. Se acabó el recibo en una servilleta.\n· La muestra marcada aparte de los pedidos, para que no se venda la única talla 6 que tenía en tienda.\n· Taller con órdenes de servicio y fechas: qué vestido entra primero y desde cuándo está ahí.\n· Pruebas y entregas con fecha, no de memoria. Nadie vuelve a preguntar si era el 25 o el 29.\n· El pedido al proveedor con su tiempo de entrega, para saber si ese modelo en esa talla llega antes de la boda.\n· Un catálogo que sirve igual en tienda, en WhatsApp y en redes, con el mismo inventario detrás.\nY esto es solo una parte: atrás hay inventario por sucursal, traslados entre tiendas, cierre de caja y comisión de la vendedora. Se lo muestro en treinta minutos por videollamada, en su horario, y usted juzga.\nSi prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234\n¿Se lo muestro, o le envío primero cómo se ve por dentro la ficha de una novia?',
'texto','citar lo investigado, explicar por qué el genérico no alcanza y dar las dos ligas','novias-1-presentacion.jpg','[]',true),

('novias','email','demo','latam','novias demo · correo 1',1,'una duda sobre sus reservas',
E'[[si persona]]Hola {{persona}}.\n[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y me quedé pensando en una parte de su operación: cuando una novia reserva su vestido para una boda de octubre, alguien tiene que saber si ese modelo, en esa talla, va a estar listo a tiempo.\n\nHacemos software de inventario para negocios de moda. Las novias son el caso más delicado, porque no hay segunda oportunidad.\n\n¿Hoy llevan las reservas en un cuaderno, en Excel o en algún sistema?',
'texto','abrir con algo cierto y ofrecer la demo','novias-2-apartados.jpg','[]',true),

('novias','email','demo','latam','novias demo · correo 2',2,'la talla del muestrario',
E'En novias el inventario no es cuántos vestidos tienen colgados. Es qué modelo, en qué talla y para qué fecha.\n\nUn modelo vive en ocho o diez tallas, y el muestrario casi nunca es la talla de la novia. La pieza que ella se probó se queda en la vitrina y la suya se pide al proveedor con meses de anticipación.\n\nEntre el día que se prueba y el día de la boda pasan pruebas, ajustes, un anticipo, un pago final y un taller. Si una de esas fechas se atrasa, se atrasa todo lo demás.\n\n¿Cuántos vestidos tienen reservados al mismo tiempo en temporada alta?',
'texto','enseñar el dolor mecánico con números del oficio','novias-3-talla.jpg','[]',true),

('novias','email','demo','latam','novias demo · correo 3',3,'una ficha por novia',
E'Le cuento cómo lo resolvemos, para que juzgue si le sirve.\n\nCada venta deja de ser una línea y se vuelve una ficha con fecha de boda: modelo, talla pedida, qué día es la prueba, qué día lo recibe el taller y qué día se entrega. El sistema cuenta hacia atrás desde la boda, no hacia adelante desde hoy.\n\nEncima va el dinero: anticipo, abonos, saldo y quién autorizó el descuento. Y el pedido especial al proveedor queda amarrado a esa novia, así que cuando llega, llega con nombre y apellido, no a la bodega.\n\n¿Cuántos vestidos entregan en una temporada buena?',
'texto','mostrar cómo se resuelve por dentro','novias-4-ficha.jpg','[]',true),

('novias','email','demo','latam','novias demo · correo 4',4,'el cuaderno no avisa',
E'Muchas casas de novia llevan todo en un cuaderno de reservas, y funciona un buen tiempo. El problema no es que esté mal hecho.\n\nEs que no avisa. No le dice que el vestido de la boda del 12 lleva tres semanas sin llegar del proveedor. No recuerda que esa novia debe la segunda cuota. No sabe que el taller tiene seis prendas juntas la misma semana.\n\nY el día que no está la persona que se sabe todo de memoria, quien atiende no puede prometer una fecha sin ir a preguntar.\n\nNo le digo que su control esté mal. Le digo que ya llegó a su tope.\n\n¿Quién lleva hoy ese cuaderno?',
'texto','romper la objeción del control actual','novias-5-libreta.jpg','[]',true),

('novias','email','demo','latam','novias demo · correo 5',5,'qué tallas sí venden',
E'Le dejo algo que puede hacer esta semana sin comprarme nada.\n\nSaque las ventas del último año y arme dos columnas por modelo: en qué tallas se pidió y cuántos días pasaron entre la reserva y la boda.\n\nLa primera columna le dice qué muestrario debería tener colgado. Muchas casas de novia llenan la vitrina con la talla que se ve bonita en el maniquí y venden otra, y esa diferencia se paga en ajustes de taller.\n\nLa segunda le dice su verdadero tiempo de anticipación. Si su promedio son cuatro meses y su proveedor tarda tres, no tiene margen: cualquier retraso se lo come el taller o la novia.\n\nCon eso ya sabe qué pedir de muestrario y hasta cuándo puede aceptar dos bodas la misma semana.\n\n¿Tiene registradas las fechas de boda del año pasado?',
'texto','dar algo útil aunque no compren','novias-6-tallas.jpg','[]',true),

('novias','email','demo','latam','novias demo · correo 6',6,'lo que aparece en 50 modelos',
E'Un ejemplo de lo que aparece cuando uno mira el inventario en serio.\n\nEn un cliente nuestro, una cadena de moda, revisamos solo 50 modelos y encontramos el equivalente a unos 60 mil dólares mal repartidos entre el centro de distribución y las tiendas. Mercancía ya comprada y pagada, solo que no estaba donde la gente la pedía.\n\nEn novias el mismo problema tiene otra cara: muestrarios repetidos de modelos que ya nadie pide, tallas que se maltrataron de tanto probarse y siguen contando como inventario bueno, y anticipos de vestidos que llevan meses sin llegar.\n\nSi quiere, en treinta minutos por videollamada le muestro el sistema cargado con sus propios modelos y usted juzga si le sirve.\n\n¿Le acomoda esta semana o la próxima?',
'texto','contar el caso real y proponer la demo','novias-7-modelos.jpg','[]',true),

('novias','email','demo','latam','novias demo · correo 7',7,'lo dejo aquí',
E'[[si persona]]{{persona}}, [[/si]]no le quiero seguir llenando el correo, así que lo dejo aquí.\n\nLe escribí porque las casas de novia son de las que peor la pasan con los sistemas de tienda normales: ninguno entiende que una venta empieza hoy y se entrega dentro de seis meses, que hay un anticipo de por medio y que la pieza pasa por taller antes de salir. Casi todos las tratan como si vendieran camisetas.\n\nSi algún día se les junta una temporada, abren otra sucursal o solo quieren ver cómo se vería su catálogo por dentro, me escribe y lo vemos en treinta minutos, en su horario. No le voy a volver a insistir.\n\n¿Le escribo otra vez el próximo año o mejor lo saco de la lista?',
'texto','cerrar con dignidad','novias-8-cierre.jpg','[]',true),

-- ── C. Plantillas de correo · ruta diagnóstico ───────────────────────────────
('novias','email','diagnostico','latam','presentacion',0,'por qué le llega este correo',
E'[[si persona]]Hola {{persona}}.\n[[/si]]Le escribo de Sacs, un software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica. Antes que nada, por qué le llega esto: estuvimos levantando el mapa de las casas de novia de {{pais}} y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] apareció ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.\nY no le escribo en automático. Esto es lo que vimos de ustedes:[[si senal]]\n· {{senal}}.[[/si]][[si sucursales]]\n· {{sucursales}} sucursales, que es justo donde empieza el problema: el vestido que una clienta pidió en una casi siempre está colgado en otra.[[/si]][[si plataforma]]\n· Su tienda en línea está en {{plataforma}}.[[/si]]\nPor eso pensamos que le podemos servir. Hay mucho software genérico y todos hacen lo mismo: cobran y descuentan del inventario. En una casa de novias eso no alcanza, porque la venta no termina en la caja: termina en una fecha.\nTenemos una suite hecha para casas de novias y fiesta: reserva con fecha del evento y abonos, la muestra marcada aparte de los pedidos, taller con órdenes de servicio, pruebas y entregas con fecha, y el pedido al proveedor con su tiempo de entrega. Y esto es solo una parte: atrás hay inventario por sucursal, traslados y cierre de caja.\nPero antes de mostrarle nada, le ofrezco algo más útil: un diagnóstico gratis de su inventario. Con su información le decimos en quince minutos cuánto dinero tiene parado en modelos que no se mueven, qué tallas sí le venden y cuánto se le va en vestidos que estaban en la sucursal equivocada.\nNo es una demo disfrazada: son sus números y se los entregamos aunque no nos compren.\nSi prefiere preguntarme por WhatsApp antes de agendar nada: https://wa.me/525593027234\n¿Le sacamos el diagnóstico con sus números?',
'texto','citar lo investigado y ofrecer el diagnóstico gratis','novias-1-presentacion.jpg','[]',true),

('novias','email','diagnostico','latam','novias diagnostico · correo 1',1,'quince minutos con sus números',
E'[[si persona]]Hola {{persona}}.\n[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]][[si sucursales]] y que tienen {{sucursales}} sucursales[[/si]]. Con varias tiendas de novia, el vestido que una clienta pidió en una casi siempre está colgado en otra.\n\nHacemos inventario para negocios de moda. Ofrecemos un diagnóstico gratis: con su información, en quince minutos les decimos cuánto dinero tienen parado y cuánto se les va por faltantes.\n\n¿Le interesa que lo hagamos con sus números?',
'texto','abrir con lo investigado y ofrecer el diagnóstico','novias-2-apartados.jpg','[]',true),

('novias','email','diagnostico','latam','novias diagnostico · correo 2',2,'dinero parado entre tiendas',
E'Dinero parado es mercancía que ya pagó y que está donde nadie la pide.\n\nEn una tienda sola se nota: usted ve el vestido colgado desde marzo. Con varias tiendas deja de notarse, porque cada encargado ve solo su tienda y todos creen que lo suyo está bien.\n\nY se multiplica por las tallas. Un modelo de novia vive en ocho o diez tallas. Si en la sucursal grande sobran las chicas y en la otra faltan, las dos pierden venta al mismo tiempo y en la oficina central aparece como que hay existencia.\n\n[[si sucursales]]Con {{sucursales}} sucursales eso ya no se ve a simple vista.\n\n[[/si]]¿Cada cuánto revisan qué se mueve entre tiendas?',
'texto','el dolor de varias tiendas','novias-3-talla.jpg','[]',true),

('novias','email','diagnostico','latam','novias diagnostico · correo 3',3,'50 modelos, 60 mil dólares',
E'Le paso el caso que hace que la gente nos conteste.\n\nEn un cliente nuestro, una cadena de moda, revisamos solo 50 modelos. Encontramos el equivalente a unos 60 mil dólares mal repartidos entre el centro de distribución y las tiendas: mercancía ya comprada y pagada que no estaba donde se vendía.\n\nNo fue robo ni mal cierre de mes. Fue reparto. Cada tienda pidió lo que creía y nadie miró el conjunto.\n\nEn novias duele más, porque el vestido que no está el día que la clienta lo pide no se vende después: se va con la competencia y no vuelve.\n\n¿Quiere que hagamos ese mismo ejercicio con sus modelos?',
'texto','contar el caso real','novias-4-ficha.jpg','[]',true),

('novias','email','diagnostico','latam','novias diagnostico · correo 4',4,'sobre pasarnos su información',
E'Dos cosas que me dicen seguido, y las dos son justas.\n\nLa primera: «no les voy a pasar mi base». No hace falta. Con un archivo de existencias por tienda y las ventas de los últimos meses alcanza. Sin nombres de clientes, sin costos si no quiere. Y si prefiere, lo vemos en pantalla con usted y nadie se lleva nada.\n\nLa segunda: «ya tenemos sistema». Casi siempre sí, y casi siempre guarda bien lo que pasó. El diagnóstico no compite con eso: le dice qué hacer con lo que ya tiene, tienda por tienda y talla por talla.\n\n¿Cuál de las dos le preocupa más?',
'texto','romper las dos objeciones','novias-5-libreta.jpg','[]',true),

('novias','email','diagnostico','latam','novias diagnostico · correo 5',5,'cómo medirlo usted mismo',
E'Le dejo el método para que lo mida usted, aunque no nos contrate.\n\nTome sus veinte modelos más vendidos. Para cada uno, saque por tienda dos números del último trimestre: piezas en existencia hoy y piezas vendidas.\n\nDivida existencia entre venta mensual. Le queda cuántos meses de venta tiene encima cada modelo en cada tienda. Marque en rojo lo que pase de tres meses y en amarillo lo que esté abajo de uno.\n\nLos rojos de una tienda casi siempre son los amarillos de otra. Eso que ve ahí es su dinero parado y su faltante, y casi todo se arregla moviendo, no comprando.\n\nCon veinte modelos ya se le nota el patrón. Nosotros lo hacemos con el catálogo completo y por talla, pero el ejercicio es el mismo.\n\n¿Le sale el dato de existencia por tienda?',
'texto','dar algo útil aunque no compren','novias-6-tallas.jpg','[]',true),

('novias','email','diagnostico','latam','novias diagnostico · correo 6',6,'qué sale de los quince minutos',
E'Para que sepa exactamente qué recibe, sin sorpresas.\n\nEn quince minutos, con su archivo de existencias y ventas, le entregamos cuatro cosas.\n\nUno: cuánto dinero tiene parado, en su moneda, y en qué tiendas está.\n\nDos: qué modelos y qué tallas le están faltando donde sí se venden, con la venta que eso le cuesta.\n\nTres: una lista de traslados concretos, del tipo mandar estas piezas de esta tienda a esta otra, ordenada por lo que más pesa.\n\nCuatro: qué debería dejar de comprar la próxima temporada porque ya lo tiene, solo que en el lugar equivocado.\n\nSi al final no le sirve, se queda con las cuatro salidas y no nos volvemos a hablar. No hay letra chica.\n\n¿Le paso la lista de lo que necesitamos?',
'texto','decir exactamente qué recibe','novias-7-modelos.jpg','[]',true),

('novias','email','diagnostico','latam','novias diagnostico · correo 7',7,'cierro el tema aquí',
E'[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no quiero volverme parte del ruido, así que cierro el tema aquí.\n\nLe insistí porque en una cadena de novias el dinero casi nunca está perdido: está mal repartido. Y eso no se ve desde el reporte de ventas, se ve cruzando existencia contra venta, tienda por tienda y talla por talla. Es un rato de trabajo, no un proyecto de meses.\n\nLa oferta se queda en pie por si algún día cambia el momento: quince minutos, su información, cuatro salidas concretas y sin compromiso. Cuando quiera, me escribe.\n\n¿Le vuelvo a tocar la puerta en la próxima temporada o mejor lo saco de la lista?',
'texto','cerrar con dignidad','novias-8-cierre.jpg','[]',true),

-- ── D. WhatsApp para Meta (idioma es): texto fijo, {{nombre}} {{ciudad}} {{pais}} ──
('novias','whatsapp','ambas','latam','abre',1,null,
E'Buen día. Le escribo de Sacs — software de inventario y punto de venta para negocios de moda, con clientes en México y Latinoamérica.\n\nEstamos armando el mapa de las mejores casas de novia de {{pais}} y {{nombre}}, en {{ciudad}}, apareció en la lista. Los encontramos en Google Maps; nadie nos pasó su contacto.\n\nLe escribo porque lo nuestro no es un punto de venta genérico: tenemos una versión hecha para casas de novia. Reservas con la fecha de la boda y sus abonos al día, el muestrario marcado aparte de lo que sí se vende, y las pruebas, el taller y el pedido al proveedor con fecha.\n\nEste mes estamos dando demos gratis por videollamada, 30 minutos, en su horario y sin compromiso. ¿Le muestro cómo se vería con sus modelos?',
'texto','WhatsApp · abre. Plantilla de Meta (es): texto fijo con {{nombre}}, {{ciudad}} y {{pais}}. Un día después del primer correo.',null,'[]',true),
('novias','whatsapp','ambas','latam','sigue',2,null,
E'Le escribo una vez más y ya no insisto.\n\nLo que más nos dicen las casas de novia es que todo cuelga de una fecha: el vestido que se pide al proveedor, las pruebas, el anticipo y el pago final. Si una se atrasa, se atrasan todas — y eso hoy casi siempre vive en un cuaderno o en un grupo de WhatsApp.\n\nEso es justo lo que resuelve la versión para novias: cada novia con su fecha, sus abonos y sus pruebas en un solo lugar, y el sistema avisando antes, no cuando ya pasó.\n\nLa demo por videollamada sigue en pie: 30 minutos, gratis, en su horario y sin compromiso. ¿Le acomoda esta semana o la próxima?',
'texto','WhatsApp · sigue. Plantilla de Meta (es) sin huecos. A media cadencia (día 16).',null,'[]',true),
('novias','whatsapp','ambas','latam','cierra',3,null,
E'Con este cierro el tema — no quiero ser el que insiste.\n\nSi en alguna temporada les pesa llevar las reservas, las pruebas y los abonos en un cuaderno, aquí seguimos y con gusto les muestro cómo lo resuelve el sistema. Este número queda abierto.\n\nY si prefiere verlo sin hablar con nadie primero, puede agendar la demo cuando quiera con el botón de abajo.\n\nGracias por el tiempo y mucho éxito con la temporada.',
'texto','WhatsApp · cierra. Plantilla de Meta (es) sin huecos, con botón a la agenda. Después del último correo (día 36).',null,'[]',true);

update abm_plantillas set meta_nombre = 'abm_novias_latam_' || nombre, meta_idioma = 'es',
  boton_texto = case nombre when 'abre' then 'Sí, muéstrenme | Ahora no' when 'sigue' then 'Esta semana | Mejor no' else 'Agendar cuando quiera' end,
  boton_url = case nombre when 'cierra' then 'https://www.sacscloud.com/agendar/demo' end
where giro = 'novias' and canal = 'whatsapp' and region = 'latam';

-- ── E. Pasos: los mismos días que México ─────────────────────────────────────
insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select c.id, d.dia, d.orden, 'email', p.id, true, d.nota
from abm_cadencias c
join (values (1,1,0,'Presentación: por qué le llega'),(4,2,1,'Abrir con algo cierto'),(6,3,2,'El dolor mecánico'),(10,4,3,'Cómo se resuelve'),
             (14,5,4,'La objeción del control actual'),(19,6,5,'Algo útil gratis'),(25,7,6,'El caso real'),(33,8,7,'Cierre con dignidad')) as d(dia, orden, pl_orden, nota) on true
join abm_plantillas p on p.giro = 'novias' and p.canal = 'email' and p.region = 'latam' and p.ruta = c.ruta and p.orden = d.pl_orden and p.activa
where c.region = 'latam' and c.giro = 'novias';

insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select c.id, d.dia, d.orden, 'whatsapp', p.id, true, d.nota
from abm_cadencias c
join (values (2,1,'abre','Abre por WhatsApp un día después del primer correo'),(16,2,'sigue','Insiste una vez a media cadencia'),(36,3,'cierra','Cierra después del último correo')) as d(dia, orden, pl, nota) on true
join abm_plantillas p on p.giro = 'novias' and p.canal = 'whatsapp' and p.region = 'latam' and p.nombre = d.pl and p.activa
where c.region = 'latam' and c.giro = 'novias';

-- ── F. Un goteo por país, PAUSADO. Diez al día como en México. ──────────────
insert into abm_goteo (cadencia_id, nombre, cuentas_dia, filtro, con_ia, estado, creado_por, nota)
select 'a1c0de11-0000-4000-8000-0000000a0001', 'Novias · ' || p.nombre, 10, jsonb_build_object('pais', p.iso), true, 'pausado',
  '60be8bd8-995a-45ca-926f-1bcb159d3c1e',
  'Casas de novia de ' || p.nombre || ' (ruta demo). Correo + WhatsApp a quien publicó su wa.me. Pausado hasta que el dueño revise el reporte de lanzamiento (14-sep-2026).'
from (values ('co','Colombia'),('cl','Chile'),('ar','Argentina'),('pe','Perú'),('ec','Ecuador'),('cr','Costa Rica'),('pa','Panamá'),('uy','Uruguay'),('do','República Dominicana'),('gt','Guatemala')) as p(iso, nombre);

insert into abm_goteo (cadencia_id, nombre, cuentas_dia, filtro, con_ia, estado, creado_por, nota)
values ('a1c0de11-0000-4000-8000-0000000a0002', 'Novias · diagnóstico · Latam', 10, '{}'::jsonb, true, 'pausado',
  '60be8bd8-995a-45ca-926f-1bcb159d3c1e', 'Casas de novia con 5+ sucursales fuera de México. Un goteo por país se crea si hace falta; con tan pocas cuentas basta uno y el país se pone en el filtro al encender.');

select (select count(*) from abm_cadencias where region='latam') cadencias,
       (select count(*) from abm_plantillas where region='latam') plantillas,
       (select count(*) from abm_pasos p join abm_cadencias c on c.id=p.cadencia_id where c.region='latam') pasos,
       (select count(*) from abm_goteo where estado='pausado' and nombre like 'Novias · %') goteos_pausados;
commit;
