-- ═══ Cadencia ABM del giro «mayoristas» (Villa Hidalgo, Jalisco) ═══════════
--
-- Pedido del dueño (13-sep-2026): «los de Villa Hidalgo que están como ABM,
-- genera la cadencia totalmente personalizada; ellos están más enfocados a
-- mayoreo: mayoreo de ropa, el proceso de la foto del producto hasta la venta,
-- listas de precios, precios por volumen por prenda, ecommerce automático».
--
-- QUIÉNES SON. 185 cuentas del lote 2026-09-13-abm-villa-hidalgo.sql, todas en
-- ruta demo. Son PROVEEDORES: fabrican o surten ropa (dama 77, infantil 26,
-- familia 22, caballero 20, lencería 8, deportiva 7, calzado 7, mezclilla 5…)
-- y le venden a tiendas, tianguistas y revendedoras de todo el país. Su cliente
-- es una tienda, no una clienta; venden por paquete, docena, corrida y surtido;
-- dan crédito; reciben pedidos por WhatsApp. El correo habla ese idioma.
--
-- LO QUE SE AFIRMA ESTÁ VERIFICADO EN EL SISTEMA (no se promete lo que no hay):
--  · listas de precio menudeo / medio mayoreo / mayoreo por tipo de cliente,
--    y el POS cobra la lista que le toca (puntos-giro.ts mayorista:una/varias);
--  · precio por volumen y promociones por volumen y por niveles en la tienda
--    en línea (guías del ecommerce);
--  · foto → ficha → variantes talla/color → alta, precio SIEMPRE dictado por
--    el cliente, botón «publicar a tienda» y kit para WhatsApp/Instagram
--    (Producto por Foto desde AXO, P0-P6 en producción);
--  · tienda en línea con la misma existencia; el pedido cae a Ventas → Pedidos,
--    aparta al pedir y descuenta al preparar; carrito abandonado por WhatsApp;
--  · existencia por talla y color, venta por corrida completa o pieza suelta,
--    qué tallas quedan sueltas; crédito y estado de cuenta por cliente tienda.
--  El único caso con cifra que se puede citar sigue siendo el de la cadena con
--  50 claves y 1.2 millones mal repartidos (correo 6).
--
-- NO DICE QUE SE REGISTRARON, PORQUE NO SE REGISTRARON: salieron de la lista de
-- proveedores del dueño (está en abm_fuentes). El correo 0 lo dice tal cual.
--
-- FORMA. Mismo patrón que novias: correo 0 «presentacion» (hasta 200 palabras,
-- los dos enlaces) + siete correos cortos sin enlaces que cierran con UNA
-- pregunta; los tres primeros salen en texto plano sin rastreo y la pieza
-- visual entra del cuarto en adelante solo si hubo apertura (abm-cadencias.ts).
-- El cuerpo es texto; la imagen y el botón son columnas (2026-09-13-abm-correo-
-- con-diseno.sql). Dos rutas porque el ofrecimiento es distinto: demo enseña el
-- sistema, diagnóstico entrega el análisis aunque no compren. Los 185 de hoy
-- están en demo; la de diagnóstico queda lista para cuando se mueva alguno.

begin;

-- ── Correos · ruta demo ──────────────────────────────────────────────────────
insert into abm_plantillas (giro, canal, nombre, orden, asunto, cuerpo, formato, objetivo, variables, activa, ruta, imagen, boton_texto, boton_url) values
('mayoristas','email','presentacion',0,'por qué le llega este correo',$m$[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, y antes que nada le digo por qué le llega esto: estuvimos armando la lista de proveedores mayoristas de ropa y calzado[[si ciudad]] de {{ciudad}}[[/si]] y {{nombre}} salió ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros, y por eso le escribo yo y no un formulario.
Hacemos un sistema mexicano de inventario y punto de venta para negocios de ropa, con una parte hecha para el que vende por mayoreo. Lo que nos dicen que ningún sistema normal les resuelve:
· Tres precios por prenda —menudeo, medio mayoreo y mayoreo— y que el sistema cobre el que le toca a cada cliente, sin que el vendedor lo calcule en el mostrador.
· Precio por volumen: a partir de tantas piezas, o del paquete completo, baja solo.
· De la foto de la prenda a la venta: le toma la foto, el asistente arma la ficha con tallas y colores, usted dicta el precio y queda lista para publicarse en su tienda en línea con la misma existencia de la bodega.
· Sus clientes tienda piden solos por el catálogo o por WhatsApp, y el pedido cae al sistema apartando la mercancía.
· Crédito y estado de cuenta por cada cliente tienda.
La mayoría de los puntos de venta están hechos para la que vende una blusa a la vez. Con veinte tiendas pidiendo paquetes y corridas, eso no alcanza.
Si quiere verlo por dentro son veinte minutos: https://www.sacscloud.com/agendar/demo
Y si prefiere probarlo usted antes de hablar con nadie, la prueba es gratis y sin tarjeta: https://www.sacscloud.com/prueba-gratis
¿Le enseño cómo queda una prenda con sus tres precios, o prefiere probarlo por su cuenta?$m$,'texto',
 'explicar por qué le escribimos, qué hace Sacs distinto para mayoreo y dar la accion','[]'::jsonb,true,'demo',
 'mayoristas-1-presentacion.jpg','Ver una demo de 20 minutos','https://www.sacscloud.com/agendar/demo'),

('mayoristas','email','mayoristas demo · correo 1',1,'una duda de sus listas de precio',$m$[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y me quedé pensando en una parte de su operación: la misma blusa tiene un precio para el que se lleva una, otro para el que se lleva media docena y otro para el que se lleva el paquete. Y casi siempre hay alguien haciendo esa cuenta de cabeza en el mostrador.

Hacemos software de inventario para negocios de ropa. En mayoreo el precio es lo primero que se pierde: el vendedor da el de mayoreo a quien no le toca, o le cobra menudeo a un cliente de años y lo pierde.

En Sacs cada cliente tiene su lista —menudeo, medio mayoreo, mayoreo— y el sistema cobra la que le toca sin preguntar.

¿Hoy quién decide en su mostrador qué precio se cobra?$m$,'texto',
 'abrir con las tres listas de precio y ofrecer la demo','[]'::jsonb,true,'demo',
 'mayoristas-2-listas.jpg','Agendar una demo','https://www.sacscloud.com/agendar/demo'),

('mayoristas','email','mayoristas demo · correo 2',2,'de la foto a la venta',$m$[[si persona]]{{persona}}, [[/si]]le cuento cómo entra una prenda nueva en Sacs, porque es donde más tiempo se les va a los mayoristas.

Le toma la foto con el teléfono. El asistente la ve y arma la ficha: nombre, descripción, categoría, y las tallas y colores como variantes —la corrida completa en una pasada. El precio no lo inventa: usted lo dicta, por lista. La prenda queda dada de alta con su clave, lista para publicarse en la tienda en línea con un botón, y hasta le saca el post para mandar por WhatsApp.

Lo que hoy tarda una tarde capturando modelo por modelo, tarda lo que tarda tomar la foto.

¿Cuántas prendas nuevas mete por temporada?$m$,'texto',
 'enseñar el camino de la foto del producto a la venta','[]'::jsonb,true,'demo',
 'mayoristas-3-foto.jpg',null,null),

('mayoristas','email','mayoristas demo · correo 3',3,'que le pidan solos',$m$[[si persona]]{{persona}}, [[/si]]la parte que más cambia el día de un mayorista no es el mostrador: es que las tiendas le pidan solas.

En Sacs su catálogo vive en una tienda en línea con la misma existencia de la bodega: si quedan cuatro paquetes, ven cuatro. La clienta de Monterrey pide a las once de la noche, el pedido cae en Ventas → Pedidos y la mercancía se aparta desde ese momento; se descuenta cuando usted lo prepara. Las promociones por volumen y por niveles las arma una vez —a partir de tantas piezas, tal precio— y aplican solas. Y si dejan el carrito a medias, se les recuerda por WhatsApp.

Sin fotos por WhatsApp una por una, sin «¿todavía tienes de la M?».

¿Hoy cómo le llegan los pedidos de fuera?$m$,'texto',
 'mostrar el ecommerce automatico: el pedido entra solo con existencia real','[]'::jsonb,true,'demo',
 'mayoristas-4-pedidos.jpg','Ver cómo pide una tienda','https://www.sacscloud.com/agendar/demo'),

('mayoristas','email','mayoristas demo · correo 4',4,'las tallas que quedan sueltas',$m$[[si persona]]{{persona}}, [[/si]]cuando les propongo esto, lo que más oigo es «yo lo llevo en mi hoja y así funciona». Y funciona, hasta que hay que contestar rápido.

El paquete de doce sale completo, pero el siguiente cliente quiere solo las M y las G. Quedan sueltas dos CH y una XL de ese modelo, y de veinte modelos más. La hoja no sabe eso: lo sabe quien acomodó la mercancía, si está.

En Sacs la existencia es por talla y por color, se vende por corrida completa o por pieza suelta, y el sistema le dice qué le queda suelto de cada modelo antes de que el cliente pregunte.

¿Cuánto tardan hoy en saber qué tallas sueltas quedan de un modelo?$m$,'texto',
 'romper la objecion de la hoja con las tallas sueltas','[]'::jsonb,true,'demo',
 'mayoristas-5-sueltas.jpg',null,null),

('mayoristas','email','mayoristas demo · correo 5',5,'el crédito de cada tienda',$m$[[si persona]]{{persona}}, [[/si]]le dejo algo útil aunque no nos compren, porque es lo que más dinero cuida en mayoreo: el crédito de cada tienda.

Tres reglas que usan los proveedores que sí cobran:
· Cada cliente tienda con su límite de crédito y su plazo, escritos antes de la primera venta, no después.
· Un estado de cuenta por cliente que se pueda mandar por WhatsApp el mismo día: lo que llevó, lo que abonó y lo que debe.
· Ninguna venta a crédito sin que alguien avise si ya se pasó del límite.

En Sacs las tres vienen de fábrica: crédito por cliente, saldos al día y el estado de cuenta listo para enviar. Pero aunque lo lleve en papel, las tres reglas le sirven igual.

¿Cuántas de sus tiendas le compran a crédito?$m$,'texto',
 'dar algo util aunque no compren: las tres reglas del credito','[]'::jsonb,true,'demo',
 'mayoristas-6-credito.jpg',null,null),

('mayoristas','email','mayoristas demo · correo 6',6,'un caso y una propuesta',$m$[[si persona]]{{persona}}, [[/si]]le cuento un caso real y le hago una propuesta.

Una cadena de moda con cincuenta claves traía 1.2 millones de pesos parados: no perdidos, mal repartidos. Modelos y tallas que sobraban en un lugar y faltaban en otro, y nadie lo veía desde el reporte de ventas. Se vio cruzando existencia contra venta, clave por clave y talla por talla. En un mayorista con bodega y local pasa igual, nada más que en paquetes.

La propuesta: veinte minutos en video, con su tipo de prendas, para que vea cómo queda una lista de precios por cliente, cómo entra una prenda por foto y cómo pide sola una tienda.

¿Le busco un espacio esta semana o la que entra?$m$,'texto',
 'contar el caso real y proponer la demo','[]'::jsonb,true,'demo',
 'mayoristas-7-caso.jpg','Agendar una demo','https://www.sacscloud.com/agendar/demo'),

('mayoristas','email','mayoristas demo · correo 7',7,'aquí le paro',$m$[[si persona]]{{persona}}, [[/si]]no le quiero seguir llenando el correo, así que aquí le paro.

Le escribí porque los mayoristas de ropa son de los que peor la pasan con los sistemas de tienda normales: ninguno entiende que una prenda tiene tres precios, que se vende por paquete y por corrida, que las tiendas piden a crédito y que las tallas sueltas son dinero parado. Casi todos los tratan como si vendieran una blusa a la vez.

Si algún día quiere ver cómo queda su catálogo con sus tres listas y pidiéndose solo, la puerta sigue abierta: conteste este correo y lo armamos.

Gracias por leer hasta aquí.$m$,'texto',
 'cerrar con dignidad','[]'::jsonb,true,'demo',
 'mayoristas-8-cierre.jpg',null,null);

-- ── Correos · ruta diagnóstico ───────────────────────────────────────────────
-- Los correos 2, 3 y 4 son los mismos: enseñan el oficio, no venden la ruta.
-- Cambian el 0, 1, 5, 6 y 7, donde está el ofrecimiento.
insert into abm_plantillas (giro, canal, nombre, orden, asunto, cuerpo, formato, objetivo, variables, activa, ruta, imagen, boton_texto, boton_url) values
('mayoristas','email','presentacion',0,'por qué le llega este correo',$m$[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, y antes que nada le digo por qué le llega esto: estuvimos armando la lista de proveedores mayoristas de ropa y calzado[[si ciudad]] de {{ciudad}}[[/si]] y {{nombre}} salió ahí[[si sucursales]], con sus {{sucursales}} puntos de venta[[/si]]. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Hacemos un sistema mexicano de inventario y punto de venta para negocios de ropa, con una parte hecha para el que vende por mayoreo: tres listas de precio que el sistema cobra solo según el cliente, precio por volumen, la prenda que entra por foto y se publica en la tienda en línea, las tiendas pidiendo solas por catálogo y el crédito de cada una al día.
Pero antes de enseñarle nada, le ofrezco algo más útil: un diagnóstico gratis de su inventario. Con su información le decimos en quince minutos cuánto dinero trae parado en tallas sueltas y modelos que no rotan, qué modelos sí le piden las tiendas y en qué paquetes se le está yendo el margen.
No es una demo disfrazada: es su información y se la entregamos aunque no nos compren.
Si quiere que lo hagamos, aquí se agenda: https://www.sacscloud.com/agendar/demo
Y si prefiere ver el sistema por su cuenta primero, la prueba es gratis y sin tarjeta: https://www.sacscloud.com/prueba-gratis
¿Le sacamos el diagnóstico con sus números?$m$,'texto',
 'explicar por qué le escribimos y ofrecer el diagnostico gratis','[]'::jsonb,true,'diagnostico',
 'mayoristas-1-presentacion.jpg','Agendar el diagnóstico gratis','https://www.sacscloud.com/agendar/demo'),

('mayoristas','email','mayoristas diagnostico · correo 1',1,'quince minutos con sus números',$m$[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y me quedé pensando en una parte de su operación: la misma blusa tiene tres precios según quién la compre, y el margen de todo el negocio depende de que se cobre el que toca.

Hacemos inventario para negocios de ropa. Ofrecemos un diagnóstico gratis: con su información, en quince minutos le decimos cuánto dinero trae parado en tallas sueltas, qué modelos sí rotan y en qué paquetes se le va el margen. Se lo entregamos aunque no nos compren.

¿Le sacamos el diagnóstico con sus números?$m$,'texto',
 'abrir con las tres listas y ofrecer el diagnostico','[]'::jsonb,true,'diagnostico',
 'mayoristas-2-listas.jpg','Agendar los quince minutos','https://www.sacscloud.com/agendar/demo'),

('mayoristas','email','mayoristas diagnostico · correo 2',2,'de la foto a la venta',$m$[[si persona]]{{persona}}, [[/si]]le cuento cómo entra una prenda nueva en Sacs, porque es donde más tiempo se les va a los mayoristas.

Le toma la foto con el teléfono. El asistente la ve y arma la ficha: nombre, descripción, categoría, y las tallas y colores como variantes —la corrida completa en una pasada. El precio no lo inventa: usted lo dicta, por lista. La prenda queda dada de alta con su clave, lista para publicarse en la tienda en línea con un botón, y hasta le saca el post para mandar por WhatsApp.

Lo que hoy tarda una tarde capturando modelo por modelo, tarda lo que tarda tomar la foto.

¿Cuántas prendas nuevas mete por temporada?$m$,'texto',
 'enseñar el camino de la foto del producto a la venta','[]'::jsonb,true,'diagnostico',
 'mayoristas-3-foto.jpg',null,null),

('mayoristas','email','mayoristas diagnostico · correo 3',3,'que le pidan solos',$m$[[si persona]]{{persona}}, [[/si]]la parte que más cambia el día de un mayorista no es el mostrador: es que las tiendas le pidan solas.

En Sacs su catálogo vive en una tienda en línea con la misma existencia de la bodega: si quedan cuatro paquetes, ven cuatro. La clienta de Monterrey pide a las once de la noche, el pedido cae en Ventas → Pedidos y la mercancía se aparta desde ese momento; se descuenta cuando usted lo prepara. Las promociones por volumen y por niveles las arma una vez —a partir de tantas piezas, tal precio— y aplican solas. Y si dejan el carrito a medias, se les recuerda por WhatsApp.

Sin fotos por WhatsApp una por una, sin «¿todavía tienes de la M?».

¿Hoy cómo le llegan los pedidos de fuera?$m$,'texto',
 'mostrar el ecommerce automatico: el pedido entra solo con existencia real','[]'::jsonb,true,'diagnostico',
 'mayoristas-4-pedidos.jpg','Ver cómo pide una tienda','https://www.sacscloud.com/agendar/demo'),

('mayoristas','email','mayoristas diagnostico · correo 4',4,'las tallas que quedan sueltas',$m$[[si persona]]{{persona}}, [[/si]]cuando les propongo esto, lo que más oigo es «yo lo llevo en mi hoja y así funciona». Y funciona, hasta que hay que contestar rápido.

El paquete de doce sale completo, pero el siguiente cliente quiere solo las M y las G. Quedan sueltas dos CH y una XL de ese modelo, y de veinte modelos más. La hoja no sabe eso: lo sabe quien acomodó la mercancía, si está.

En Sacs la existencia es por talla y por color, se vende por corrida completa o por pieza suelta, y el sistema le dice qué le queda suelto de cada modelo antes de que el cliente pregunte.

¿Cuánto tardan hoy en saber qué tallas sueltas quedan de un modelo?$m$,'texto',
 'romper la objecion de la hoja con las tallas sueltas','[]'::jsonb,true,'diagnostico',
 'mayoristas-5-sueltas.jpg',null,null),

('mayoristas','email','mayoristas diagnostico · correo 5',5,'el crédito de cada tienda',$m$[[si persona]]{{persona}}, [[/si]]le dejo algo útil aunque no nos compren, porque es lo que más dinero cuida en mayoreo: el crédito de cada tienda.

Tres reglas que usan los proveedores que sí cobran:
· Cada cliente tienda con su límite de crédito y su plazo, escritos antes de la primera venta, no después.
· Un estado de cuenta por cliente que se pueda mandar por WhatsApp el mismo día: lo que llevó, lo que abonó y lo que debe.
· Ninguna venta a crédito sin que alguien avise si ya se pasó del límite.

Y el diagnóstico gratis sigue en pie: con sus números le decimos también cuánto de su cartera está vencida y con quién.

¿Cuántas de sus tiendas le compran a crédito?$m$,'texto',
 'dar algo util aunque no compren y recordar el diagnostico','[]'::jsonb,true,'diagnostico',
 'mayoristas-6-credito.jpg',null,null),

('mayoristas','email','mayoristas diagnostico · correo 6',6,'un caso y una propuesta',$m$[[si persona]]{{persona}}, [[/si]]le cuento un caso real y le hago una propuesta.

Una cadena de moda con cincuenta claves traía 1.2 millones de pesos parados: no perdidos, mal repartidos. Modelos y tallas que sobraban en un lugar y faltaban en otro, y nadie lo veía desde el reporte de ventas. Se vio cruzando existencia contra venta, clave por clave y talla por talla. En un mayorista con bodega y local pasa igual, nada más que en paquetes.

La propuesta: ese mismo cruce con sus números, en quince minutos, gratis. Se lleva el resultado aunque no nos compre nada.

¿Le busco un espacio esta semana o la que entra?$m$,'texto',
 'contar el caso real y proponer el diagnostico','[]'::jsonb,true,'diagnostico',
 'mayoristas-7-caso.jpg','Agendar el diagnóstico','https://www.sacscloud.com/agendar/demo'),

('mayoristas','email','mayoristas diagnostico · correo 7',7,'cierro el tema aquí',$m$[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no quiero volverme parte del ruido, así que cierro el tema aquí.

Le insistí porque en un mayorista el dinero casi nunca está perdido: está parado en tallas sueltas, en modelos que no rotan y en crédito que nadie cobró a tiempo. Y eso no se ve desde el reporte de ventas, se ve cruzando existencia contra venta, modelo por modelo y talla por talla. Es un rato de trabajo, no un proyecto de meses.

La oferta del diagnóstico gratis no caduca: conteste este correo cuando le sirva y lo hacemos.

Gracias por leer hasta aquí.$m$,'texto',
 'cerrar con dignidad','[]'::jsonb,true,'diagnostico',
 'mayoristas-8-cierre.jpg',null,null);

-- ── WhatsApp · las tres (ruta ambas) ────────────────────────────────────────
-- El primero NO vende: pregunta con quién y por dónde. En un proveedor de
-- Villa Hidalgo el WhatsApp de la ficha suele ser el del mostrador, no el del
-- dueño, y quien contesta tiene que poder pasar el recado en una línea.
insert into abm_plantillas (giro, canal, nombre, orden, asunto, cuerpo, formato, objetivo, variables, activa, ruta) values
('mayoristas','whatsapp','abre',1,null,$m$Buen día. Le escribo a {{nombre}} de parte de Sacs, sistema mexicano de inventario y punto de venta para negocios de ropa. Con mayoristas nos buscan por las listas de precio —menudeo, medio mayoreo, mayoreo— y para que las tiendas les pidan solas por catálogo. ¿Con quién puedo ver ese tema y por dónde?$m$,'texto','WhatsApp · abre','[]'::jsonb,true,'ambas'),
('mayoristas','whatsapp','sigue',2,null,$m$Insisto una vez y ya. En mayoreo el dinero se va en el mostrador: el precio que se cobra de cabeza, las tallas sueltas que nadie ve y el crédito de las tiendas en la libreta. ¿Me pasa el correo de quien lleva las ventas de mayoreo?$m$,'texto','WhatsApp · sigue','[]'::jsonb,true,'ambas'),
('mayoristas','whatsapp','cierra',3,null,$m$Aquí lo dejo, sin insistir más. Si alguna temporada quieren que cada prenda tenga sus tres precios, que las tiendas pidan solas y que el crédito de cada cliente esté al día, este número sigue abierto. Gracias.$m$,'texto','WhatsApp · cierra','[]'::jsonb,true,'ambas');

-- ── La pieza visual: una prenda con sus tres precios ────────────────────────
-- Entra del cuarto correo en adelante y solo si ya abrieron. Es la lista de
-- precios de UNA prenda tal como la ve el vendedor: las tres listas, las tallas
-- que quedaron sueltas del paquete y el crédito de la tienda que la está
-- pidiendo. Datos de ejemplo, como la fila de Mariana en la pieza de novias.
-- Colores de paleta.ts: verde = precio/dinero, ámbar = atención, morado = ancla.
insert into abm_plantillas (giro, canal, nombre, orden, asunto, cuerpo, formato, objetivo, variables, activa, ruta) values
('mayoristas','pieza','pieza',1,'Una prenda con sus tres precios',$m$<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border:1px solid #ececec;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
<tr>
<td width="4" bgcolor="#9B8CFA" style="background-color:#9B8CFA;width:4px;font-size:1px;line-height:1px;">&nbsp;</td>
<td bgcolor="#ffffff" style="background-color:#ffffff;padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr><td colspan="3" style="padding:13px 14px 11px 14px;background-color:#ffffff;color:#3a3a44;font-size:16px;font-weight:bold;line-height:20px;">Blusa bordada manga corta &middot; MAY-0412<br><span style="font-size:14px;font-weight:normal;color:#8a8a92;">Corrida CH&ndash;XL &middot; 4 colores &middot; paquete de 12</span></td></tr>
<tr><td width="7" bgcolor="#4FBF95" style="background-color:#4FBF95;width:7px;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 6px 9px 12px;color:#3a3a44;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Menudeo</b> &middot; 1 a 5 piezas</td><td align="right" style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 14px 9px 6px;color:#1E8A63;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">$189</td></tr>
<tr><td bgcolor="#4FBF95" style="background-color:#4FBF95;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 6px 9px 12px;color:#3a3a44;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Medio mayoreo</b> &middot; 6 a 11 piezas</td><td align="right" style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 14px 9px 6px;color:#1E8A63;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">$149</td></tr>
<tr><td bgcolor="#9B8CFA" style="background-color:#9B8CFA;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td bgcolor="#EEECFE" style="background-color:#EEECFE;border-top:1px solid #ececec;padding:10px 6px 10px 12px;color:#5B4BD6;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Mayoreo</b> &middot; paquete de 12 &middot; el sistema lo cobra solo</td><td align="right" bgcolor="#EEECFE" style="background-color:#EEECFE;border-top:1px solid #ececec;padding:10px 14px 10px 6px;color:#5B4BD6;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">$119</td></tr>
<tr><td bgcolor="#E8A838" style="background-color:#E8A838;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td bgcolor="#FFF4E5" style="background-color:#FFF4E5;border-top:1px solid #ececec;padding:9px 6px 9px 12px;color:#9a6a10;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Sueltas del paquete</b> &middot; 2 CH, 1 XL en azul</td><td align="right" bgcolor="#FFF4E5" style="background-color:#FFF4E5;border-top:1px solid #ececec;padding:9px 14px 9px 6px;color:#9a6a10;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">avisa</td></tr>
<tr><td bgcolor="#7DA6F5" style="background-color:#7DA6F5;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 6px 9px 12px;color:#3a3a44;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Tienda La Esquina, Monterrey</b> &middot; crédito 30 días</td><td align="right" style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 14px 9px 6px;color:#2C5FC4;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">debe $4,320</td></tr>
<tr><td colspan="3" style="padding:12px 14px 14px 14px;background-color:#ffffff;color:#3a3a44;font-size:14px;line-height:19px;">El sistema cobra la lista que le toca a cada cliente. <b>El vendedor ya no decide el descuento en el mostrador.</b></td></tr>
</table>
</td></tr>
</table>$m$,'html',
 'La lista de precios de una prenda como la ve el vendedor: menudeo, medio mayoreo y mayoreo, las tallas sueltas del paquete y el credito de la tienda que la pide.',
 '[]'::jsonb,true,'ambas');

-- ── Las dos cadencias y sus pasos ───────────────────────────────────────────
-- Mismos días que novias (1, 4, 6, 10, 14, 19, 25, 33): los tres primeros
-- correos juntos en la primera semana, y después se abre el paso.
insert into abm_cadencias (id, nombre, giro, ruta, descripcion, activa, creada_por) values
('c0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b01','Mayoristas · demo','mayoristas','demo','Cadencia de 8 correos, del día 1 al 33, escrita para el proveedor mayorista de ropa: listas de precio, foto a venta, pedidos solos, tallas sueltas y crédito',true,'sistema'),
('c0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b02','Mayoristas · diagnóstico','mayoristas','diagnostico','Cadencia de 8 correos, del día 1 al 33, escrita para el proveedor mayorista de ropa, con el diagnóstico gratis como ofrecimiento',true,'sistema');

insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select c.id, d.dia, d.orden, 'email', p.id, true, d.nota
from abm_cadencias c
join (values
  (1, 1, 0, 'presentarse: por que le escribimos y que hace Sacs para mayoreo'),
  (4, 2, 1, 'abrir con las tres listas de precio'),
  (6, 3, 2, 'enseñar el camino de la foto a la venta'),
  (10, 4, 3, 'mostrar el ecommerce automatico: el pedido entra solo'),
  (14, 5, 4, 'romper la objecion de la hoja con las tallas sueltas'),
  (19, 6, 5, 'dar algo util aunque no compren: las tres reglas del credito'),
  (25, 7, 6, 'contar el caso real y proponer'),
  (33, 8, 7, 'cerrar con dignidad')
) as d(dia, orden, correo, nota) on true
join abm_plantillas p on p.giro = 'mayoristas' and p.canal = 'email' and p.orden = d.correo and p.ruta = c.ruta
where c.giro = 'mayoristas';

commit;
