-- ═══ Cadencia ABM del giro «calzado» (expositores de SAPICA, León) ══════════
--
-- Pedido del dueño (13-sep-2026): «ahora vamos a hacer una cadencia pero esta
-- sí de puro correo para los de la base de datos de SAPICA, que está más
-- segmentado a calzado, matrices, corridas, etc. Ármate todo, pero esta sí es
-- puro correo».
--
-- QUIÉNES SON. 634 cuentas del lote 2026-09-05-abm-sapica.sql, todas en ruta
-- demo: fábricas y marcas de calzado del corredor León – San Francisco del
-- Rincón – Guadalajara que exponen en SAPICA (dama, botas y western, infantil,
-- tenis, industrial, confort, marroquinería). Su cliente es la zapatería, no
-- el que se calza: venden por corrida y por matriz —cuántos pares de cada
-- número lleva el pedido—, con medios números, por embarques y a crédito;
-- muchos tienen además tienda de fábrica y 72 venden en línea (Shopify 33,
-- WooCommerce 23…). El correo habla ese idioma: pares, números, corrida,
-- matriz, modelo, temporada, zapatería. Nunca «prendas» ni «tallas».
--
-- PURO CORREO. Sin pasos de WhatsApp, por instrucción del dueño. Si un día se
-- quisiera, se agregan pasos como en 2026-09-13-abm-goteo-whatsapp.sql; el
-- motor los ignora mientras no existan.
--
-- LO QUE SE AFIRMA ESTÁ VERIFICADO EN EL SISTEMA (no se promete lo que no hay):
--  · existencia por número y por color, con medios números; la cuadrícula de
--    la corrida enseña los huecos y el modelo que ya quedó descabalado
--    (src/data/giros/zapateria.ts: corrida, descabalado, omnicanal);
--  · listas de precio menudeo / medio mayoreo / mayoreo por tipo de cliente,
--    el POS cobra la que le toca; venta por corrida completa o par suelto
--    (verificado para mayoristas, 2026-09-13-abm-mayoristas-cadencia.sql);
--  · foto → ficha → variantes número/color → alta, precio dictado por el
--    cliente, botón «publicar a tienda» y kit para WhatsApp (Producto por Foto);
--  · tienda en línea con la misma existencia; el pedido cae a Ventas → Pedidos,
--    aparta al pedir y descuenta al preparar; promociones por volumen; carrito
--    abandonado por WhatsApp;
--  · crédito y estado de cuenta por cliente.
--  NO se afirma nada de producción, maquila ni control de piso de fábrica:
--  Sacs no es un sistema de producción y el correo no lo insinúa. Habla de la
--  bodega de producto terminado, la venta a zapaterías y la tienda de fábrica.
--  El único caso con cifra sigue siendo el de la cadena con 50 claves y 1.2
--  millones mal repartidos (correo 6).
--
-- NO DICE QUE SE REGISTRARON, PORQUE NO SE REGISTRARON: salieron del directorio
-- público de expositores de SAPICA (está en abm_fuentes). El correo 0 lo dice.
--
-- FORMA. Igual que mayoristas: correo 0 «presentacion» (hasta 200 palabras,
-- los dos enlaces) + siete correos cortos sin enlaces que cierran con UNA
-- pregunta; los tres primeros salen en texto plano sin rastreo y la pieza
-- visual entra del cuarto en adelante solo si hubo apertura. El cuerpo es
-- texto; la imagen y el botón son columnas. Dos rutas: los 634 están en demo;
-- la de diagnóstico queda lista para cuando se mueva alguno.
--
-- QUIÉN NO ENTRA. La base trae, marcados con encaje 6 desde
-- 2026-09-13-abm-sapica-proveedores.sql, 33 proveedores de la propia industria
-- (suelas, hormas, pieles, químicos, maquinaria, logística, certificación):
-- este guion les hablaría de pares por número y no es su negocio, así que se
-- ponen en_pausa y quedan fuera del goteo (solo enrola sin_tocar). Y hay tres
-- que no son prospectos de ningún guion: SIZES AND COLORS (software para
-- zapaterías: competidor directo), AVA SOFT (software) y SENDEX (la línea de
-- autobuses Senda, que expone como transporte). Esos van a no_contactar.

begin;

-- ── Quién no entra ───────────────────────────────────────────────────────────
update abm_cuentas
   set etapa = 'no_contactar',
       nota = coalesce(nota, '') || ' · 13-sep-2026: fuera de toda cadencia (competidor de software o negocio ajeno al calzado).',
       updated_at = now()
 where giro = 'calzado' and etapa = 'sin_tocar'
   and nombre in ('SIZES AND COLORS', 'AVA SOFT', 'SENDEX');

insert into abm_actividad (cuenta_id, canal, tipo, texto)
select id, 'sistema', 'nota', 'Marcada no_contactar al armar la cadencia de calzado: ' ||
       case nombre when 'SIZES AND COLORS' then 'es software para zapaterías, competidor directo'
                   when 'AVA SOFT' then 'es una empresa de software, no una fábrica'
                   else 'es la línea de autobuses Senda, expone como transporte' end
  from abm_cuentas where giro = 'calzado' and nombre in ('SIZES AND COLORS', 'AVA SOFT', 'SENDEX');

update abm_cuentas
   set etapa = 'en_pausa',
       nota = coalesce(nota, '') || ' · 13-sep-2026: proveedor de la industria, fuera de la cadencia de calzado (el guion habla de pares por número a zapaterías); se decide aparte.',
       updated_at = now()
 where giro = 'calzado' and etapa = 'sin_tocar' and encaje <= 6;

insert into abm_actividad (cuenta_id, canal, tipo, texto)
select id, 'sistema', 'nota', 'En pausa al armar la cadencia de calzado: es proveedor de la industria (' || coalesce(subgiro, 'sin subgiro') || ') y el guion no le habla a su negocio.'
  from abm_cuentas where giro = 'calzado' and etapa = 'en_pausa' and encaje <= 6;

-- ── Correos · ruta demo ──────────────────────────────────────────────────────
insert into abm_plantillas (giro, canal, nombre, orden, asunto, cuerpo, formato, objetivo, variables, activa, ruta, imagen, boton_texto, boton_url) values
('calzado','email','presentacion',0,'por qué le llega este correo',$m$[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, y antes que nada le digo por qué le llega esto: estuvimos armando la lista de fábricas y marcas de calzado que exponen en SAPICA y {{nombre}}[[si ciudad]], de {{ciudad}},[[/si]] salió ahí[[si plataforma]], con su tienda en línea en {{plataforma}}[[/si]]. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros, y por eso le escribo yo y no un formulario.
Hacemos un sistema mexicano de inventario y punto de venta para negocios de calzado y ropa, con una parte hecha para el que vende por corrida a zapaterías. Lo que nos dicen que ningún sistema normal les resuelve:
· Existencia por número y por color, con medios números: la matriz de cada modelo a la vista y qué corrida ya se rompió en bodega.
· Precio de mayoreo para la zapatería y de menudeo para la tienda de fábrica, y el sistema cobra el que le toca a cada cliente.
· Del modelo nuevo a la venta: foto, ficha con su corrida en una pasada, precio dictado por usted, y publicado en su tienda en línea con la existencia real.
· Sus zapaterías piden solas por catálogo o por WhatsApp, y el pedido cae al sistema apartando los pares.
· Crédito y estado de cuenta por cada cliente zapatería.
Los sistemas de tienda están hechos para vender un par a la vez. Con treinta zapaterías pidiendo por matriz, eso no alcanza.
Si quiere verlo por dentro son veinte minutos: https://www.sacscloud.com/agendar/demo
Y si prefiere probarlo usted antes de hablar con nadie, la prueba es gratis y sin tarjeta: https://www.sacscloud.com/prueba-gratis
¿Le enseño cómo queda un modelo con su matriz y sus dos precios, o prefiere probarlo por su cuenta?$m$,'texto',
 'explicar por qué le escribimos, qué hace Sacs distinto para el que vende por corrida y dar la accion','[]'::jsonb,true,'demo',
 'calzado-1-presentacion.jpg','Ver una demo de 20 minutos','https://www.sacscloud.com/agendar/demo'),

('calzado','email','calzado demo · correo 1',1,'la corrida que se rompe en bodega',$m$[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y me quedé pensando en una parte de su operación: de cada modelo salen primero los números de en medio —el 24, el 25— y en la bodega quedan los extremos. El reporte dice que hay pares; lo que hay es una corrida rota que ya solo sale a saldo.

Hacemos software de inventario para negocios de calzado. En Sacs la existencia es por número y por color, con medios números, y la matriz de cada modelo se ve completa: qué números quedan, cuántos pares, y qué modelo ya está descabalado antes de que una zapatería lo pregunte.

¿Hoy cómo sabe qué números le quedan de un modelo sin ir a contar cajas?$m$,'texto',
 'abrir con la corrida rota y la existencia por numero','[]'::jsonb,true,'demo',
 'calzado-2-corrida.jpg','Agendar una demo','https://www.sacscloud.com/agendar/demo'),

('calzado','email','calzado demo · correo 2',2,'del modelo nuevo a la venta',$m$[[si persona]]{{persona}}, [[/si]]le cuento cómo entra un modelo nuevo en Sacs, porque en cada temporada es donde más tiempo se les va.

Le toma la foto con el teléfono. El asistente la ve y arma la ficha: nombre, descripción, categoría, y la corrida completa como variantes, número por número y por color, en una pasada. El precio no lo inventa: usted lo dicta, por lista. El modelo queda dado de alta con su clave, listo para publicarse en la tienda en línea con un botón, y hasta le saca el post para mandárselo a sus zapaterías por WhatsApp.

Lo que hoy tarda una tarde capturando modelo por modelo, tarda lo que tarda tomar la foto.

¿Cuántos modelos estrena por temporada?$m$,'texto',
 'enseñar el camino de la foto del modelo a la venta','[]'::jsonb,true,'demo',
 'calzado-3-foto.jpg',null,null),

('calzado','email','calzado demo · correo 3',3,'que las zapaterías pidan solas',$m$[[si persona]]{{persona}}, [[/si]]la parte que más cambia el día de una fábrica no es la bodega: es que las zapaterías le pidan solas.

En Sacs su catálogo vive en una tienda en línea con la misma existencia de la bodega, por número: si del modelo en café quedan seis pares del 25, ven seis. La zapatería de Querétaro arma su matriz a las once de la noche, el pedido cae en Ventas → Pedidos y los pares se apartan desde ese momento; se descuentan cuando usted lo prepara. El precio por volumen —a partir de tantos pares, o por corrida completa— lo arma una vez y aplica solo. Y si dejan el pedido a medias, se les recuerda por WhatsApp.

Sin fotos por WhatsApp una por una, sin «¿todavía tienes el 24 en negro?».

¿Hoy cómo le llegan los pedidos de sus zapaterías?$m$,'texto',
 'mostrar el catalogo en linea: el pedido por matriz entra solo con existencia real','[]'::jsonb,true,'demo',
 'calzado-4-pedidos.jpg','Ver cómo pide una zapatería','https://www.sacscloud.com/agendar/demo'),

('calzado','email','calzado demo · correo 4',4,'el precio que le toca a cada cliente',$m$[[si persona]]{{persona}}, [[/si]]cuando les propongo esto, lo que más oigo es «yo lo llevo en mi hoja y así funciona». Y funciona, hasta que hay que contestar rápido.

El mismo modelo tiene un precio para la zapatería que se lleva la corrida, otro para el distribuidor que se lleva veinte y otro de menudeo en la tienda de fábrica. Casi siempre hay alguien haciendo esa cuenta de cabeza, o dando el de mayoreo a quien no le toca.

En Sacs cada cliente tiene su lista —menudeo, medio mayoreo, mayoreo— y el sistema cobra la que le toca sin preguntar, por corrida completa o por par suelto. La hoja no sabe quién es el cliente: lo sabe quien atiende, si está.

¿Hoy quién decide en su mostrador qué precio se cobra?$m$,'texto',
 'romper la objecion de la hoja con las listas de precio por cliente','[]'::jsonb,true,'demo',
 'calzado-5-precios.jpg',null,null),

('calzado','email','calzado demo · correo 5',5,'el crédito de cada zapatería',$m$[[si persona]]{{persona}}, [[/si]]le dejo algo útil aunque no nos compren, porque es lo que más dinero cuida en una fábrica que vende a crédito: la cuenta de cada zapatería.

Tres reglas que usan los proveedores que sí cobran:
· Cada zapatería con su límite de crédito y su plazo, escritos antes del primer embarque, no después.
· Un estado de cuenta por cliente que se pueda mandar por WhatsApp el mismo día: lo que se llevó, lo que abonó y lo que debe.
· Ningún pedido a crédito sin que alguien avise si ya se pasó del límite.

En Sacs las tres vienen de fábrica: crédito por cliente, saldos al día y el estado de cuenta listo para enviar. Pero aunque lo lleve en papel, las tres reglas le sirven igual.

¿Cuántas de sus zapaterías le compran a crédito?$m$,'texto',
 'dar algo util aunque no compren: las tres reglas del credito','[]'::jsonb,true,'demo',
 'calzado-6-credito.jpg',null,null),

('calzado','email','calzado demo · correo 6',6,'un caso y una propuesta',$m$[[si persona]]{{persona}}, [[/si]]le cuento un caso real y le hago una propuesta.

Una cadena de moda con cincuenta claves traía 1.2 millones de pesos parados: no perdidos, mal repartidos. Modelos y tallas que sobraban en un lugar y faltaban en otro, y nadie lo veía desde el reporte de ventas. Se vio cruzando existencia contra venta, clave por clave y talla por talla. En una fábrica con bodega de producto terminado y tienda de fábrica pasa igual, nada más que en pares y por número.

La propuesta: veinte minutos en video, con sus modelos, para que vea cómo queda la matriz de uno, cómo entra un modelo por foto y cómo pide sola una zapatería.

¿Le busco un espacio esta semana o la que entra?$m$,'texto',
 'contar el caso real y proponer la demo','[]'::jsonb,true,'demo',
 'calzado-7-caso.jpg','Agendar una demo','https://www.sacscloud.com/agendar/demo'),

('calzado','email','calzado demo · correo 7',7,'aquí le paro',$m$[[si persona]]{{persona}}, [[/si]]no le quiero seguir llenando el correo, así que aquí le paro.

Le escribí porque las fábricas y marcas de calzado son de las que peor la pasan con los sistemas de tienda normales: ninguno entiende que un modelo vive por número y por color, que se vende por corrida y por matriz, que la zapatería pide a crédito y que una corrida rota es dinero parado en la bodega. Casi todos los tratan como si vendieran un par a la vez.

Si algún día quiere ver cómo queda su catálogo con la matriz de cada modelo y pidiéndose solo, la puerta sigue abierta: conteste este correo y lo armamos.

Gracias por leer hasta aquí.$m$,'texto',
 'cerrar con dignidad','[]'::jsonb,true,'demo',
 'calzado-8-cierre.jpg',null,null);

-- ── Correos · ruta diagnóstico ───────────────────────────────────────────────
-- Los correos 2, 3 y 4 son los mismos: enseñan el oficio, no venden la ruta.
-- Cambian el 0, 1, 5, 6 y 7, donde está el ofrecimiento.
insert into abm_plantillas (giro, canal, nombre, orden, asunto, cuerpo, formato, objetivo, variables, activa, ruta, imagen, boton_texto, boton_url) values
('calzado','email','presentacion',0,'por qué le llega este correo',$m$[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, y antes que nada le digo por qué le llega esto: estuvimos armando la lista de fábricas y marcas de calzado que exponen en SAPICA y {{nombre}}[[si ciudad]], de {{ciudad}},[[/si]] salió ahí[[si plataforma]], con su tienda en línea en {{plataforma}}[[/si]]. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Hacemos un sistema mexicano de inventario y punto de venta para negocios de calzado y ropa, con una parte hecha para el que vende por corrida a zapaterías: existencia por número y color con medios números, listas de precio que el sistema cobra solo según el cliente, el modelo que entra por foto y se publica en la tienda en línea, las zapaterías pidiendo solas por catálogo y el crédito de cada una al día.
Pero antes de enseñarle nada, le ofrezco algo más útil: un diagnóstico gratis de su inventario. Con su información le decimos en quince minutos cuánto dinero trae parado en corridas rotas y números que no rotan, qué modelos sí le piden las zapaterías y en qué corridas se le está yendo el margen.
No es una demo disfrazada: es su información y se la entregamos aunque no nos compren.
Si quiere que lo hagamos, aquí se agenda: https://www.sacscloud.com/agendar/demo
Y si prefiere ver el sistema por su cuenta primero, la prueba es gratis y sin tarjeta: https://www.sacscloud.com/prueba-gratis
¿Le sacamos el diagnóstico con sus números?$m$,'texto',
 'explicar por qué le escribimos y ofrecer el diagnostico gratis','[]'::jsonb,true,'diagnostico',
 'calzado-1-presentacion.jpg','Agendar el diagnóstico gratis','https://www.sacscloud.com/agendar/demo'),

('calzado','email','calzado diagnostico · correo 1',1,'quince minutos con sus números',$m$[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y me quedé pensando en una parte de su operación: de cada modelo salen primero los números de en medio y en la bodega quedan los extremos. El reporte dice que hay pares; lo que hay es una corrida rota que ya solo sale a saldo.

Hacemos inventario para negocios de calzado. Ofrecemos un diagnóstico gratis: con su información, en quince minutos le decimos cuánto dinero trae parado en corridas rotas, qué modelos sí rotan y en qué corridas se le va el margen. Se lo entregamos aunque no nos compren.

¿Le sacamos el diagnóstico con sus números?$m$,'texto',
 'abrir con la corrida rota y ofrecer el diagnostico','[]'::jsonb,true,'diagnostico',
 'calzado-2-corrida.jpg','Agendar los quince minutos','https://www.sacscloud.com/agendar/demo'),

('calzado','email','calzado diagnostico · correo 2',2,'del modelo nuevo a la venta',$m$[[si persona]]{{persona}}, [[/si]]le cuento cómo entra un modelo nuevo en Sacs, porque en cada temporada es donde más tiempo se les va.

Le toma la foto con el teléfono. El asistente la ve y arma la ficha: nombre, descripción, categoría, y la corrida completa como variantes, número por número y por color, en una pasada. El precio no lo inventa: usted lo dicta, por lista. El modelo queda dado de alta con su clave, listo para publicarse en la tienda en línea con un botón, y hasta le saca el post para mandárselo a sus zapaterías por WhatsApp.

Lo que hoy tarda una tarde capturando modelo por modelo, tarda lo que tarda tomar la foto.

¿Cuántos modelos estrena por temporada?$m$,'texto',
 'enseñar el camino de la foto del modelo a la venta','[]'::jsonb,true,'diagnostico',
 'calzado-3-foto.jpg',null,null),

('calzado','email','calzado diagnostico · correo 3',3,'que las zapaterías pidan solas',$m$[[si persona]]{{persona}}, [[/si]]la parte que más cambia el día de una fábrica no es la bodega: es que las zapaterías le pidan solas.

En Sacs su catálogo vive en una tienda en línea con la misma existencia de la bodega, por número: si del modelo en café quedan seis pares del 25, ven seis. La zapatería de Querétaro arma su matriz a las once de la noche, el pedido cae en Ventas → Pedidos y los pares se apartan desde ese momento; se descuentan cuando usted lo prepara. El precio por volumen —a partir de tantos pares, o por corrida completa— lo arma una vez y aplica solo. Y si dejan el pedido a medias, se les recuerda por WhatsApp.

Sin fotos por WhatsApp una por una, sin «¿todavía tienes el 24 en negro?».

¿Hoy cómo le llegan los pedidos de sus zapaterías?$m$,'texto',
 'mostrar el catalogo en linea: el pedido por matriz entra solo con existencia real','[]'::jsonb,true,'diagnostico',
 'calzado-4-pedidos.jpg','Ver cómo pide una zapatería','https://www.sacscloud.com/agendar/demo'),

('calzado','email','calzado diagnostico · correo 4',4,'el precio que le toca a cada cliente',$m$[[si persona]]{{persona}}, [[/si]]cuando les propongo esto, lo que más oigo es «yo lo llevo en mi hoja y así funciona». Y funciona, hasta que hay que contestar rápido.

El mismo modelo tiene un precio para la zapatería que se lleva la corrida, otro para el distribuidor que se lleva veinte y otro de menudeo en la tienda de fábrica. Casi siempre hay alguien haciendo esa cuenta de cabeza, o dando el de mayoreo a quien no le toca.

En Sacs cada cliente tiene su lista —menudeo, medio mayoreo, mayoreo— y el sistema cobra la que le toca sin preguntar, por corrida completa o por par suelto. La hoja no sabe quién es el cliente: lo sabe quien atiende, si está.

¿Hoy quién decide en su mostrador qué precio se cobra?$m$,'texto',
 'romper la objecion de la hoja con las listas de precio por cliente','[]'::jsonb,true,'diagnostico',
 'calzado-5-precios.jpg',null,null),

('calzado','email','calzado diagnostico · correo 5',5,'el crédito de cada zapatería',$m$[[si persona]]{{persona}}, [[/si]]le dejo algo útil aunque no nos compren, porque es lo que más dinero cuida en una fábrica que vende a crédito: la cuenta de cada zapatería.

Tres reglas que usan los proveedores que sí cobran:
· Cada zapatería con su límite de crédito y su plazo, escritos antes del primer embarque, no después.
· Un estado de cuenta por cliente que se pueda mandar por WhatsApp el mismo día: lo que se llevó, lo que abonó y lo que debe.
· Ningún pedido a crédito sin que alguien avise si ya se pasó del límite.

Y el diagnóstico gratis sigue en pie: con sus números le decimos también cuánto de su cartera está vencida y con quién.

¿Cuántas de sus zapaterías le compran a crédito?$m$,'texto',
 'dar algo util aunque no compren y recordar el diagnostico','[]'::jsonb,true,'diagnostico',
 'calzado-6-credito.jpg',null,null),

('calzado','email','calzado diagnostico · correo 6',6,'un caso y una propuesta',$m$[[si persona]]{{persona}}, [[/si]]le cuento un caso real y le hago una propuesta.

Una cadena de moda con cincuenta claves traía 1.2 millones de pesos parados: no perdidos, mal repartidos. Modelos y tallas que sobraban en un lugar y faltaban en otro, y nadie lo veía desde el reporte de ventas. Se vio cruzando existencia contra venta, clave por clave y talla por talla. En una fábrica con bodega de producto terminado y tienda de fábrica pasa igual, nada más que en pares y por número.

La propuesta: ese mismo cruce con sus números, en quince minutos, gratis. Se lleva el resultado aunque no nos compre nada.

¿Le busco un espacio esta semana o la que entra?$m$,'texto',
 'contar el caso real y proponer el diagnostico','[]'::jsonb,true,'diagnostico',
 'calzado-7-caso.jpg','Agendar el diagnóstico','https://www.sacscloud.com/agendar/demo'),

('calzado','email','calzado diagnostico · correo 7',7,'cierro el tema aquí',$m$[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no quiero volverme parte del ruido, así que cierro el tema aquí.

Le insistí porque en una fábrica de calzado el dinero casi nunca está perdido: está parado en corridas rotas, en modelos que no rotan y en crédito que nadie cobró a tiempo. Y eso no se ve desde el reporte de ventas, se ve cruzando existencia contra venta, modelo por modelo y número por número. Es un rato de trabajo, no un proyecto de meses.

La oferta del diagnóstico gratis no caduca: conteste este correo cuando le sirva y lo hacemos.

Gracias por leer hasta aquí.$m$,'texto',
 'cerrar con dignidad','[]'::jsonb,true,'diagnostico',
 'calzado-8-cierre.jpg',null,null);

-- ── La pieza visual: un modelo con su matriz ─────────────────────────────────
-- Entra del cuarto correo en adelante y solo si ya abrieron. Es la ficha de UN
-- modelo tal como la ve el vendedor: sus tres listas, la corrida que ya se
-- rompió en un color y el crédito de la zapatería que lo está pidiendo. Datos
-- de ejemplo. Colores de paleta.ts: verde = precio/dinero, ámbar = atención,
-- morado = ancla, azul = dato del cliente.
insert into abm_plantillas (giro, canal, nombre, orden, asunto, cuerpo, formato, objetivo, variables, activa, ruta) values
('calzado','pieza','pieza',1,'Un modelo con su matriz',$m$<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border:1px solid #ececec;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
<tr>
<td width="4" bgcolor="#9B8CFA" style="background-color:#9B8CFA;width:4px;font-size:1px;line-height:1px;">&nbsp;</td>
<td bgcolor="#ffffff" style="background-color:#ffffff;padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr><td colspan="3" style="padding:13px 14px 11px 14px;background-color:#ffffff;color:#3a3a44;font-size:16px;font-weight:bold;line-height:20px;">Bot&iacute;n dama piel &middot; modelo 4120<br><span style="font-size:14px;font-weight:normal;color:#8a8a92;">Corrida 22&ndash;27 con medios n&uacute;meros &middot; caf&eacute; y negro &middot; corrida de 12 pares</span></td></tr>
<tr><td width="7" bgcolor="#4FBF95" style="background-color:#4FBF95;width:7px;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 6px 9px 12px;color:#3a3a44;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Menudeo</b> &middot; tienda de f&aacute;brica, par suelto</td><td align="right" style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 14px 9px 6px;color:#1E8A63;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">$1,290</td></tr>
<tr><td bgcolor="#4FBF95" style="background-color:#4FBF95;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 6px 9px 12px;color:#3a3a44;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Medio mayoreo</b> &middot; 6 a 11 pares</td><td align="right" style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 14px 9px 6px;color:#1E8A63;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">$890</td></tr>
<tr><td bgcolor="#9B8CFA" style="background-color:#9B8CFA;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td bgcolor="#EEECFE" style="background-color:#EEECFE;border-top:1px solid #ececec;padding:10px 6px 10px 12px;color:#5B4BD6;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Mayoreo</b> &middot; corrida completa de 12 &middot; el sistema lo cobra solo</td><td align="right" bgcolor="#EEECFE" style="background-color:#EEECFE;border-top:1px solid #ececec;padding:10px 14px 10px 6px;color:#5B4BD6;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">$790</td></tr>
<tr><td bgcolor="#E8A838" style="background-color:#E8A838;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td bgcolor="#FFF4E5" style="background-color:#FFF4E5;border-top:1px solid #ececec;padding:9px 6px 9px 12px;color:#9a6a10;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Corrida rota en caf&eacute;</b> &middot; sin 23&frac12; ni 24 &middot; quedan 17 pares de los extremos</td><td align="right" bgcolor="#FFF4E5" style="background-color:#FFF4E5;border-top:1px solid #ececec;padding:9px 14px 9px 6px;color:#9a6a10;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">avisa</td></tr>
<tr><td bgcolor="#7DA6F5" style="background-color:#7DA6F5;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 6px 9px 12px;color:#3a3a44;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Zapater&iacute;a El Paso, Quer&eacute;taro</b> &middot; cr&eacute;dito 30 d&iacute;as</td><td align="right" style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 14px 9px 6px;color:#2C5FC4;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">debe $18,960</td></tr>
<tr><td colspan="3" style="padding:12px 14px 14px 14px;background-color:#ffffff;color:#3a3a44;font-size:14px;line-height:19px;">La matriz de cada modelo a la vista y el precio que le toca a cada cliente. <b>El vendedor ya no decide el descuento en el mostrador.</b></td></tr>
</table>
</td></tr>
</table>$m$,'html',
 'La ficha de un modelo como la ve el vendedor: menudeo, medio mayoreo y mayoreo, la corrida que se rompio en un color y el credito de la zapateria que lo pide.',
 '[]'::jsonb,true,'ambas');

-- ── Las dos cadencias y sus pasos (solo correo) ──────────────────────────────
-- Mismos días que mayoristas (1, 4, 6, 10, 14, 19, 25, 33): los tres primeros
-- correos juntos en la primera semana, y después se abre el paso. Sin WhatsApp.
insert into abm_cadencias (id, nombre, giro, ruta, descripcion, activa, creada_por) values
('c0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b03','Calzado · demo','calzado','demo','Cadencia de 8 correos, del día 1 al 33, escrita para la fábrica o marca de calzado que vende por corrida a zapaterías: matriz por número, foto a venta, pedidos solos, precio por cliente y crédito. Solo correo.',true,'sistema'),
('c0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b04','Calzado · diagnóstico','calzado','diagnostico','Cadencia de 8 correos, del día 1 al 33, escrita para la fábrica o marca de calzado, con el diagnóstico gratis como ofrecimiento. Solo correo.',true,'sistema');

insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select c.id, d.dia, d.orden, 'email', p.id, true, d.nota
from abm_cadencias c
join (values
  (1, 1, 0, 'presentarse: por que le escribimos y que hace Sacs para el que vende por corrida'),
  (4, 2, 1, 'abrir con la corrida rota y la existencia por numero'),
  (6, 3, 2, 'enseñar el camino de la foto del modelo a la venta'),
  (10, 4, 3, 'mostrar el catalogo en linea: el pedido por matriz entra solo'),
  (14, 5, 4, 'romper la objecion de la hoja con las listas por cliente'),
  (19, 6, 5, 'dar algo util aunque no compren: las tres reglas del credito'),
  (25, 7, 6, 'contar el caso real y proponer'),
  (33, 8, 7, 'cerrar con dignidad')
) as d(dia, orden, correo, nota) on true
join abm_plantillas p on p.giro = 'calzado' and p.canal = 'email' and p.orden = d.correo and p.ruta = c.ruta
where c.giro = 'calzado';

commit;

-- ── Añadido el mismo día: sombreros y marroquinería tampoco entran ───────────
-- Al ir a renderizar la cadencia contra cuentas reales, la mejor puntuada era
-- una fábrica de sombreros. El guion habla de pares, números y corridas; a un
-- sombrerero o a quien hace bolsas y cinturones le suena a correo masivo mal
-- dirigido, que es justo lo que el manual (§7.7) dice que se reporta. Son 20
-- cuentas (Sombreros 4, Marroquinería y accesorios 16): quedan en pausa para
-- correrlas aparte con un guion de accesorios, no se pierden.
begin;
update abm_cuentas
   set etapa = 'en_pausa',
       nota = coalesce(nota, '') || ' · 13-sep-2026: fuera de la cadencia de calzado (el guion habla de pares por número); pendiente un guion de accesorios.',
       updated_at = now()
 where giro = 'calzado' and etapa = 'sin_tocar'
   and subgiro in ('Sombreros', 'Marroquinería y accesorios');
insert into abm_actividad (cuenta_id, canal, tipo, texto)
select id, 'sistema', 'nota', 'En pausa al armar la cadencia de calzado: ' || subgiro || ' no vende por pares ni por número; pendiente un guion de accesorios.'
  from abm_cuentas where giro = 'calzado' and etapa = 'en_pausa' and subgiro in ('Sombreros', 'Marroquinería y accesorios');
commit;
