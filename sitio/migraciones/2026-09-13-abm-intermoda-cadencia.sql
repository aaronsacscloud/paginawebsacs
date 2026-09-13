-- ═══ Cadencia ABM del giro «marcas» (expositores de Intermoda, Guadalajara) ══
--
-- Pedido del dueño (13-sep-2026): «y de ahí la de Intermoda igual,
-- considerando todo el contexto» — puro correo, como la de SAPICA.
--
-- QUIÉNES SON. 558 cuentas del lote 2026-09-05-abm-intermoda.sql, todas en
-- ruta demo: las marcas, fabricantes, importadores y distribuidores que
-- exponen en Intermoda (Expo Guadalajara, dos ediciones al año) para que
-- tiendas y boutiques de todo el país les LEVANTEN PEDIDO. Sobre todo ropa
-- (dama, caballero, infantil, jeans, vestidos de fiesta, playa) y también
-- joyería, bolsas y piel, calzado, sombreros y accesorios. Su cliente es la
-- tienda multimarca, no la persona que se pone la prenda: venden por curva
-- —cuántas piezas de cada talla y color lleva el pedido—, con mínimos, a
-- crédito, y viven dos momentos: los tres días de feria, donde se levantan
-- los pedidos de la temporada, y los meses de en medio, donde las tiendas
-- reponen lo que sí se vendió. Muchos tienen showroom y tienda propia.
--
-- Al cargarlos cayeron en los giros `fabricantes` y `distribuidores`, donde
-- también viven 1,600 negocios del barrido de Maps con otro perfil. Para que
-- la cadencia les hable solo a ellos se les da giro propio: `marcas` (está en
-- src/lib/crm/abm-giros.ts). Se reconocen por la nota de origen, que es la
-- misma en los 558.
--
-- EL IDIOMA. Modelo, talla, color, curva, pedido de feria, reposición,
-- boutique, tienda, showroom, temporada. La base es mayoritariamente de ropa
-- y el texto base habla de tallas; para joyería, bolsas, sombreros y
-- accesorios el expediente (abm-generar.ts, por el subgiro) le dice a la IA
-- que hable de modelo y color y nunca de tallas. Al principio esa pista iba
-- en el objetivo de cada correo como «si vende joyería…» y la IA se la aplicó
-- también a una marca de ropa: se movió al expediente, tajante en ambos
-- sentidos (2026-09-13-abm-intermoda-objetivos.sql limpia los objetivos).
--
-- PURO CORREO. Sin pasos de WhatsApp, por instrucción del dueño.
--
-- LO QUE SE AFIRMA ESTÁ VERIFICADO EN EL SISTEMA (no se promete lo que no hay):
--  · existencia por talla y por color; la cuadrícula del modelo enseña los
--    huecos y la curva que ya se rompió (src/data/giros: curva, omnicanal);
--  · listas de precio menudeo / medio mayoreo / mayoreo por tipo de cliente,
--    el POS cobra la que le toca; venta por curva completa o pieza suelta
--    (verificado para mayoristas, 2026-09-13-abm-mayoristas-cadencia.sql);
--  · foto → ficha → variantes talla/color → alta, precio dictado por el
--    cliente, botón «publicar a tienda» y kit para WhatsApp (Producto por Foto);
--  · tienda en línea con la misma existencia; el pedido cae a Ventas → Pedidos,
--    aparta al pedir y descuenta al preparar; promociones por volumen; carrito
--    abandonado por WhatsApp;
--  · crédito y estado de cuenta por cliente.
--  NO se afirma nada de producción, maquila, corte ni control de piso, y NO
--  se dice que el pedido se capture «desde el stand sin internet» ni con una
--  app de feria: se dice que el pedido se captura una vez en el sistema (o la
--  tienda lo arma sola en el catálogo) y queda apartado desde ese momento. El
--  único caso con cifra sigue siendo el de la cadena con 50 claves y 1.2
--  millones mal repartidos (correo 6).
--
-- NO DICE QUE SE REGISTRARON, PORQUE NO SE REGISTRARON: salieron del directorio
-- público de expositores de Intermoda (está en abm_fuentes). El correo 0 lo dice.
--
-- FORMA. Igual que mayoristas y calzado: correo 0 «presentacion» (hasta 200
-- palabras, los dos enlaces) + siete correos cortos sin enlaces que cierran
-- con UNA pregunta; los tres primeros salen en texto plano sin rastreo y la
-- pieza visual entra del cuarto en adelante solo si hubo apertura. Dos rutas:
-- los 558 están en demo; la de diagnóstico queda lista.
--
-- QUIÉN NO ENTRA (95 de 558, leídos uno por uno con su producto):
--  · no_contactar (14): no son prospectos de ningún guion. BSALE MÉXICO es un
--    punto de venta: competidor directo. AUDACES es software de diseño y
--    corte. AMEX, TIK TOK SHOP y BANSI exponen como servicios financieros o
--    plataforma. Y hay negocios ajenos a la moda que exponen ahí: mezcal y
--    cantinas (SANTA CANTINA, CARAJILLOS DE LA CASA), aromas y velas para el
--    hogar (AROMA HOME, CALOR HEAT), agua (OCOXAL), cosmética (OS CXLXURS),
--    utensilios (SMART BAMBOO), sillas (ZERO GRAVITY) y una agencia de viajes.
--  · en_pausa (81): proveedores de la propia industria, a los que este guion
--    les hablaría de curvas y boutiques y no es su negocio: 48 de telas,
--    hilos y estampado; 14 de avíos, botones, etiquetas y bordado; 10 de
--    maquinaria de costura; 6 de exhibición, maniquíes y empaque; y 3 de
--    blancos, hogar y velas. Quedan sin_tocar para otro guion, si un día lo hay.
--  Quedan 460 elegibles (otros 3 ya estaban en no_contactar desde la carga). Sí entran los que venden producto terminado aunque
--  no sea ropa (joyería, bolsas, sombreros, ceremonia): el correo se adapta.

begin;

-- ── Giro propio ──────────────────────────────────────────────────────────────
update abm_cuentas
   set giro = 'marcas', updated_at = now()
 where nota like 'Del directorio oficial de Intermoda%'
   and giro in ('fabricantes', 'distribuidores');

-- ── Quién no entra ───────────────────────────────────────────────────────────
update abm_cuentas
   set etapa = 'no_contactar',
       nota = coalesce(nota, '') || ' · 13-sep-2026: fuera de toda cadencia (competidor de software, servicio financiero o negocio ajeno a la moda).',
       updated_at = now()
 where giro = 'marcas' and etapa = 'sin_tocar'
   and nombre in ('AMEX', 'TIK TOK SHOP', 'BANSI S.A', 'SANTA CANTINA', 'CARAJILLOS DE LA CASA', 'AROMA HOME', 'CALOR HEAT / CASA MIST / PREDIRE / BTB', 'OCOXAL', 'OS CXLXURS / HAYAN', 'SMART BAMBOO', 'ZERO GRAVITY / ELEVARE / CBG GARDEN', 'CHINA INTERNATIONAL TRAVEL SERVICE', 'BSALE MÉXICO', 'AUDACES');

insert into abm_actividad (cuenta_id, canal, tipo, texto)
select id, 'sistema', 'nota', 'Marcada no_contactar al armar la cadencia de Intermoda: ' ||
       case nombre when 'BSALE MÉXICO' then 'es un punto de venta, competidor directo'
                   when 'AUDACES' then 'es software de diseño y corte, no una marca'
                   when 'AMEX' then 'servicio financiero'
                   when 'TIK TOK SHOP' then 'plataforma de venta, no una marca'
                   when 'BANSI S.A' then 'banco'
                   else 'negocio ajeno a la moda que expone en la feria' end
  from abm_cuentas where giro = 'marcas' and etapa = 'no_contactar'
   and nombre in ('AMEX', 'TIK TOK SHOP', 'BANSI S.A', 'SANTA CANTINA', 'CARAJILLOS DE LA CASA', 'AROMA HOME', 'CALOR HEAT / CASA MIST / PREDIRE / BTB', 'OCOXAL', 'OS CXLXURS / HAYAN', 'SMART BAMBOO', 'ZERO GRAVITY / ELEVARE / CBG GARDEN', 'CHINA INTERNATIONAL TRAVEL SERVICE', 'BSALE MÉXICO', 'AUDACES');

-- Proveedores de la industria: en pausa, con el porqué en su actividad.
create temp table _intermoda_pausa (nombre text, motivo text) on commit drop;
insert into _intermoda_pausa
select n, 'telas, hilos o estampado' from unnest(array['ARMEX TEXTIL', 'AZTEXTIL / AZTX', 'BELTEX', 'COPACABANA TEXTIL', 'CORPORATIVO FERMOTEX, SA DE CV', 'ELEMENTO STUDIO', 'FAMOSA TEXTIL', 'GRUPO SIMJIS.', 'GRUPO TEXTIL CARU', 'GRUPO VISION / SATEX TEXTIL', 'GT', 'HAMMAM', 'HILOS CLAUDIA / DURALON / REFLEX / ETERNO', 'JOHN TAYLOR', 'KAGE TEXTIL', 'KAIKALA TEXTIL', 'LA POBLANA', 'LA SULTANA', 'LOLITA BOUTIQUE', 'MAXIMODA', 'MILENIUM TEXTIL / BIG MODA.', 'MODATEX / IMPRESIÓN TEXTIL', 'MR. DENIM', 'NEOCRI', 'ORBIT INC', 'PERSATEX', 'POQUETINES', 'PRIMAVERA', 'QST POCKETING / ULTRAFUSE / Q-LOOP / BAN ROL / QUICK', 'RABATEX / LOLITA BOUTIQUE', 'RAVEMY POQUETIN / CAMISERA / UNIFORMERA', 'SEXI DENIM', 'SIDDIQSONS LIMITED', 'STUDIO EXPRESS BY ONLY', 'T-WIN TEXTILE CO.,LTD', 'TAHUA ELENA YE', 'TELAS LÚA', 'TEXTIL', 'TEXTIL SURTIMODA', 'TEXTILES LAFAYETTE', 'VILLATEP TEXTILES', 'WUSSTEK', 'ZHONGYA', 'PANTERA TEXTIL', 'LUDEM', 'VERY CHIK TEXTIL', 'TELAS Y GALONES LITURGICOS CONCEVIDA', 'PRINT FANATICS']) as n
union all
select n, 'avíos, botones, etiquetas o bordado' from unnest(array['BOTONES HENRY / BOTONES LOREN', 'DATESA', 'ETIRAPID', 'GALAXY, AZULTECH, CYAN TECH INC.', 'HARMONY TRIM', 'JAHE/ TIGER´´S/ BINAH', 'MR. DTEX', 'VER TEX', 'YINHUA PIAO', 'ETIQUETAS RAMS IMPRIMALAS USTED MISMO', 'ACE', 'CLISÈ', 'SACURI ACCESORIOS', 'SIC']) as n
union all
select n, 'maquinaria de costura o bordado' from unnest(array['DINNEK | DINNEK GOLD| JUKI | GOLDEN WHEEL.', 'EXPORTACIONES TEXTILES MEXICANAS', 'FORTEVER', 'HAPPY JAPAN / SWF / WILCOM / HOLIAUMA', 'JACK / MAICA / BI / VE.MAC / BULLMMER', 'JUKI / MAQI / OSAKA', 'JUKI Y JIN', 'MIMAKI / CIXING / STEIGER / JACK / GALGA / YINHAIGO', 'SWF', 'TOP LASER']) as n
union all
select n, 'exhibición, maniquíes o empaque' from unnest(array['BAGMAN', 'EUROBOLSA / GRUPEB', 'EXPOTODO', 'MANIQUIES TRENDY', 'TECARTD FAST', 'LE SAC']) as n
union all
select n, 'blancos, hogar o velas' from unnest(array['CEREMONIAS ISIS', 'CONDECORA, JENIN HOME', 'RZC']) as n;

update abm_cuentas c
   set etapa = 'en_pausa',
       nota = coalesce(c.nota, '') || ' · 13-sep-2026: en pausa, proveedor de la industria (' || p.motivo || '); el guion de marcas no le habla.',
       updated_at = now()
  from _intermoda_pausa p
 where c.giro = 'marcas' and c.etapa = 'sin_tocar' and c.nombre = p.nombre;

insert into abm_actividad (cuenta_id, canal, tipo, texto)
select c.id, 'sistema', 'nota', 'En pausa al armar la cadencia de Intermoda: vende ' || p.motivo || ' a las marcas, y este guion habla de curvas, pedidos de feria y boutiques.'
  from abm_cuentas c join _intermoda_pausa p on p.nombre = c.nombre
 where c.giro = 'marcas' and c.etapa = 'en_pausa';

-- ── Correos · ruta demo ──────────────────────────────────────────────────────
insert into abm_plantillas (giro, canal, nombre, orden, asunto, cuerpo, formato, objetivo, variables, activa, ruta, imagen, boton_texto, boton_url) values
('marcas','email','presentacion',0,'por qué le llega este correo',$m$[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, y antes que nada le digo por qué le llega esto: estuvimos armando la lista de marcas que exponen en Intermoda y {{nombre}}[[si ciudad]], de {{ciudad}},[[/si]] salió ahí[[si plataforma]], con su tienda en línea en {{plataforma}}[[/si]]. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros, y por eso le escribo yo y no un formulario.
Hacemos un sistema mexicano de inventario y punto de venta para negocios de moda, con una parte hecha para la marca que vende a tiendas y boutiques. Lo que nos dicen que ningún sistema normal les resuelve:
· Existencia por talla y por color de cada modelo: la curva completa a la vista y cuál ya se rompió en bodega.
· Un precio para la boutique, otro para el distribuidor y el de menudeo de su propia tienda, y el sistema cobra el que le toca a cada cliente.
· Del modelo nuevo a la venta: foto, ficha con sus tallas y colores en una pasada, precio dictado por usted, y publicado en su tienda en línea con la existencia real.
· Sus tiendas reponen solas por catálogo o por WhatsApp entre una feria y otra, y el pedido cae al sistema apartando las piezas.
· Crédito y estado de cuenta por cada tienda.
Los sistemas de tienda están hechos para vender una prenda a la vez. Con cuarenta boutiques pidiendo por curva, eso no alcanza.
Si quiere verlo por dentro son veinte minutos: https://www.sacscloud.com/agendar/demo
Y si prefiere probarlo usted antes de hablar con nadie, la prueba es gratis y sin tarjeta: https://www.sacscloud.com/prueba-gratis
¿Le enseño cómo queda un modelo con su curva y sus tres precios, o prefiere probarlo por su cuenta?$m$,'texto',
 'explicar por qué le escribimos, qué hace Sacs distinto para la marca que vende a tiendas y dar la accion','[]'::jsonb,true,'demo',
 'marcas-1-presentacion.jpg','Ver una demo de 20 minutos','https://www.sacscloud.com/agendar/demo'),

('marcas','email','marcas demo · correo 1',1,'lo que se levanta en la feria',$m$[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y me quedé pensando en lo que pasa después de la feria: tres días levantando pedidos en el stand —en libreta, en hoja, por WhatsApp— y de regreso alguien los vuelve a capturar. Para cuando se surten, la talla que más pidieron ya se vendió dos veces y a la boutique le llegan ocho piezas de doce.

Hacemos software de inventario para marcas de moda. En Sacs la existencia es por talla y por color, la curva de cada modelo se ve completa, y el pedido de cada tienda se captura una sola vez y aparta las piezas desde ese momento: lo que se comprometió en la feria ya no se le vende a nadie más.

¿Hoy cómo saben, de regreso de la feria, qué tallas quedan de cada modelo?$m$,'texto',
 'abrir con el pedido de feria que se surte incompleto y la existencia por talla y color','[]'::jsonb,true,'demo',
 'marcas-2-feria.jpg','Agendar una demo','https://www.sacscloud.com/agendar/demo'),

('marcas','email','marcas demo · correo 2',2,'de la muestra a la venta',$m$[[si persona]]{{persona}}, [[/si]]le cuento cómo entra un modelo nuevo en Sacs, porque cada colección es donde más tiempo se les va: capturar modelo por modelo, con sus tallas y sus colores, antes de que empiece la feria.

Le toma la foto con el teléfono. El asistente la ve y arma la ficha: nombre, descripción, categoría, y la curva completa como variantes, talla por talla y por color, en una pasada. El precio no lo inventa: usted lo dicta, por lista. El modelo queda dado de alta con su clave, listo para publicarse en la tienda en línea con un botón, y hasta le saca el post para mandárselo a sus tiendas por WhatsApp.

Lo que hoy tarda una tarde por colección, tarda lo que tarda tomar la foto.

¿Cuántos modelos estrena por temporada?$m$,'texto',
 'enseñar el camino de la foto de la muestra a la venta','[]'::jsonb,true,'demo',
 'marcas-3-foto.jpg',null,null),

('marcas','email','marcas demo · correo 3',3,'la reposición entre feria y feria',$m$[[si persona]]{{persona}}, [[/si]]la parte que más cambia el año de una marca no es la feria: es que las tiendas le repongan solas entre una feria y la otra.

En Sacs su catálogo vive en una tienda en línea con la misma existencia de la bodega, por talla y color: si de la blusa en arena quedan seis medianas, ven seis. La boutique de Mérida arma su reposición a las once de la noche, el pedido cae en Ventas → Pedidos y las piezas se apartan desde ese momento; se descuentan cuando usted lo prepara. El precio por volumen —a partir de tantas piezas, o por curva completa— lo arma una vez y aplica solo. Y si dejan el pedido a medias, se les recuerda por WhatsApp.

Sin fotos por WhatsApp una por una, sin «¿todavía tienes la mediana en arena?».

¿Hoy cómo le llegan las reposiciones de sus tiendas?$m$,'texto',
 'mostrar el catalogo en linea: la reposicion entra sola con existencia real','[]'::jsonb,true,'demo',
 'marcas-4-reposicion.jpg','Ver cómo repone una boutique','https://www.sacscloud.com/agendar/demo'),

('marcas','email','marcas demo · correo 4',4,'el precio de la boutique y el del distribuidor',$m$[[si persona]]{{persona}}, [[/si]]cuando les propongo esto, lo que más oigo es «yo lo llevo en mi hoja y así funciona». Y funciona, hasta que hay que contestar rápido.

El mismo modelo tiene un precio para la boutique que se lleva la curva, otro para el distribuidor que se lleva cien piezas y otro de menudeo en su propia tienda. Casi siempre hay alguien haciendo esa cuenta de cabeza en el stand, o dando el de mayoreo a quien no le toca.

En Sacs cada cliente tiene su lista —menudeo, medio mayoreo, mayoreo— y el sistema cobra la que le toca sin preguntar, por curva completa o por pieza suelta. La hoja no sabe quién es el cliente: lo sabe quien atiende, si está.

¿Hoy quién decide qué precio se le da a cada tienda?$m$,'texto',
 'romper la objecion de la hoja con las listas de precio por cliente','[]'::jsonb,true,'demo',
 'marcas-5-precios.jpg',null,null),

('marcas','email','marcas demo · correo 5',5,'el crédito de cada tienda',$m$[[si persona]]{{persona}}, [[/si]]le dejo algo útil aunque no nos compren, porque es lo que más dinero cuida en una marca que surte a crédito: la cuenta de cada tienda.

Tres reglas que usan las marcas que sí cobran:
· Cada tienda con su límite de crédito y su plazo, escritos antes del primer embarque, no después.
· Un estado de cuenta por cliente que se pueda mandar por WhatsApp el mismo día: lo que se llevó, lo que abonó y lo que debe.
· Ningún pedido a crédito sin que alguien avise si ya se pasó del límite.

En Sacs las tres vienen de fábrica: crédito por cliente, saldos al día y el estado de cuenta listo para enviar. Pero aunque lo lleve en papel, las tres reglas le sirven igual.

¿Cuántas de sus tiendas le compran a crédito?$m$,'texto',
 'dar algo util aunque no compren: las tres reglas del credito','[]'::jsonb,true,'demo',
 'marcas-6-credito.jpg',null,null),

('marcas','email','marcas demo · correo 6',6,'un caso y una propuesta',$m$[[si persona]]{{persona}}, [[/si]]le cuento un caso real y le hago una propuesta.

Una cadena de moda con cincuenta claves traía 1.2 millones de pesos parados: no perdidos, mal repartidos. Modelos y tallas que sobraban en un lugar y faltaban en otro, y nadie lo veía desde el reporte de ventas. Se vio cruzando existencia contra venta, clave por clave y talla por talla. En una marca con bodega de producto terminado, showroom y tienda propia pasa igual.

La propuesta: veinte minutos en video, con sus modelos, para que vea cómo queda la curva de uno, cómo entra un modelo por foto y cómo repone sola una boutique.

¿Le busco un espacio esta semana o la que entra?$m$,'texto',
 'contar el caso real y proponer la demo','[]'::jsonb,true,'demo',
 'marcas-7-caso.jpg','Agendar una demo','https://www.sacscloud.com/agendar/demo'),

('marcas','email','marcas demo · correo 7',7,'aquí le paro',$m$[[si persona]]{{persona}}, [[/si]]no le quiero seguir llenando el correo, así que aquí le paro.

Le escribí porque las marcas que venden a tiendas son de las que peor la pasan con los sistemas de tienda normales: ninguno entiende que un modelo vive por talla y por color, que se vende por curva, que la boutique pide a crédito y repone entre ferias, y que una curva rota es dinero parado en la bodega. Casi todos los tratan como si vendieran una prenda a la vez.

Si algún día quiere ver cómo queda su catálogo con la curva de cada modelo y sus tiendas reponiendo solas, la puerta sigue abierta: conteste este correo y lo armamos.

Gracias por leer hasta aquí.$m$,'texto',
 'cerrar con dignidad','[]'::jsonb,true,'demo',
 'marcas-8-cierre.jpg',null,null);

-- ── Correos · ruta diagnóstico ───────────────────────────────────────────────
-- Los correos 2, 3 y 4 son los mismos: enseñan el oficio, no venden la ruta.
-- Cambian el 0, 1, 5, 6 y 7, donde está el ofrecimiento.
insert into abm_plantillas (giro, canal, nombre, orden, asunto, cuerpo, formato, objetivo, variables, activa, ruta, imagen, boton_texto, boton_url) values
('marcas','email','presentacion',0,'por qué le llega este correo',$m$[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, y antes que nada le digo por qué le llega esto: estuvimos armando la lista de marcas que exponen en Intermoda y {{nombre}}[[si ciudad]], de {{ciudad}},[[/si]] salió ahí[[si plataforma]], con su tienda en línea en {{plataforma}}[[/si]]. Nadie nos pasó su correo ni usted se registró en ningún lado — lo buscamos nosotros.
Hacemos un sistema mexicano de inventario y punto de venta para negocios de moda, con una parte hecha para la marca que vende a tiendas y boutiques: existencia por talla y color con la curva a la vista, listas de precio que el sistema cobra solo según el cliente, el modelo que entra por foto y se publica en la tienda en línea, las tiendas reponiendo solas entre ferias y el crédito de cada una.
Pero antes de enseñarle nada, le ofrezco algo más útil: un diagnóstico gratis de su inventario. Con su información le decimos en quince minutos cuánto dinero trae parado en curvas rotas y tallas que no rotan, qué modelos sí le reponen las tiendas y en qué colección se le está yendo el margen.
No es una demo disfrazada: es su información y se la entregamos aunque no nos compren.
Si quiere que lo hagamos, aquí se agenda: https://www.sacscloud.com/agendar/demo
Y si prefiere ver el sistema por su cuenta primero, la prueba es gratis y sin tarjeta: https://www.sacscloud.com/prueba-gratis
¿Le sacamos el diagnóstico con sus números?$m$,'texto',
 'explicar por qué le escribimos y ofrecer el diagnostico gratis','[]'::jsonb,true,'diagnostico',
 'marcas-1-presentacion.jpg','Agendar el diagnóstico gratis','https://www.sacscloud.com/agendar/demo'),

('marcas','email','marcas diagnostico · correo 1',1,'quince minutos con sus números',$m$[[si persona]]Hola {{persona}}.
[[/si]]Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]] y me quedé pensando en lo que pasa después de la feria: tres días levantando pedidos en el stand y de regreso alguien los vuelve a capturar. Para cuando se surten, la talla que más pidieron ya se vendió dos veces y a la boutique le llegan ocho piezas de doce.

Hacemos inventario para marcas de moda. Ofrecemos un diagnóstico gratis: con su información, en quince minutos le decimos cuánto dinero trae parado en curvas rotas, qué modelos sí rotan y en qué colección se le va el margen. Se lo entregamos aunque no nos compren.

¿Le sacamos el diagnóstico con sus números?$m$,'texto',
 'abrir con el pedido de feria que se surte incompleto y ofrecer el diagnostico','[]'::jsonb,true,'diagnostico',
 'marcas-2-feria.jpg','Agendar los quince minutos','https://www.sacscloud.com/agendar/demo'),

('marcas','email','marcas diagnostico · correo 2',2,'de la muestra a la venta',$m$[[si persona]]{{persona}}, [[/si]]le cuento cómo entra un modelo nuevo en Sacs, porque cada colección es donde más tiempo se les va: capturar modelo por modelo, con sus tallas y sus colores, antes de que empiece la feria.

Le toma la foto con el teléfono. El asistente la ve y arma la ficha: nombre, descripción, categoría, y la curva completa como variantes, talla por talla y por color, en una pasada. El precio no lo inventa: usted lo dicta, por lista. El modelo queda dado de alta con su clave, listo para publicarse en la tienda en línea con un botón, y hasta le saca el post para mandárselo a sus tiendas por WhatsApp.

Lo que hoy tarda una tarde por colección, tarda lo que tarda tomar la foto.

¿Cuántos modelos estrena por temporada?$m$,'texto',
 'enseñar el camino de la foto de la muestra a la venta','[]'::jsonb,true,'diagnostico',
 'marcas-3-foto.jpg',null,null),

('marcas','email','marcas diagnostico · correo 3',3,'la reposición entre feria y feria',$m$[[si persona]]{{persona}}, [[/si]]la parte que más cambia el año de una marca no es la feria: es que las tiendas le repongan solas entre una feria y la otra.

En Sacs su catálogo vive en una tienda en línea con la misma existencia de la bodega, por talla y color: si de la blusa en arena quedan seis medianas, ven seis. La boutique de Mérida arma su reposición a las once de la noche, el pedido cae en Ventas → Pedidos y las piezas se apartan desde ese momento; se descuentan cuando usted lo prepara. El precio por volumen —a partir de tantas piezas, o por curva completa— lo arma una vez y aplica solo. Y si dejan el pedido a medias, se les recuerda por WhatsApp.

Sin fotos por WhatsApp una por una, sin «¿todavía tienes la mediana en arena?».

¿Hoy cómo le llegan las reposiciones de sus tiendas?$m$,'texto',
 'mostrar el catalogo en linea: la reposicion entra sola con existencia real','[]'::jsonb,true,'diagnostico',
 'marcas-4-reposicion.jpg','Ver cómo repone una boutique','https://www.sacscloud.com/agendar/demo'),

('marcas','email','marcas diagnostico · correo 4',4,'el precio de la boutique y el del distribuidor',$m$[[si persona]]{{persona}}, [[/si]]cuando les propongo esto, lo que más oigo es «yo lo llevo en mi hoja y así funciona». Y funciona, hasta que hay que contestar rápido.

El mismo modelo tiene un precio para la boutique que se lleva la curva, otro para el distribuidor que se lleva cien piezas y otro de menudeo en su propia tienda. Casi siempre hay alguien haciendo esa cuenta de cabeza en el stand, o dando el de mayoreo a quien no le toca.

En Sacs cada cliente tiene su lista —menudeo, medio mayoreo, mayoreo— y el sistema cobra la que le toca sin preguntar, por curva completa o por pieza suelta. La hoja no sabe quién es el cliente: lo sabe quien atiende, si está.

¿Hoy quién decide qué precio se le da a cada tienda?$m$,'texto',
 'romper la objecion de la hoja con las listas de precio por cliente','[]'::jsonb,true,'diagnostico',
 'marcas-5-precios.jpg',null,null),

('marcas','email','marcas diagnostico · correo 5',5,'el crédito de cada tienda',$m$[[si persona]]{{persona}}, [[/si]]le dejo algo útil aunque no nos compren, porque es lo que más dinero cuida en una marca que surte a crédito: la cuenta de cada tienda.

Tres reglas que usan las marcas que sí cobran:
· Cada tienda con su límite de crédito y su plazo, escritos antes del primer embarque, no después.
· Un estado de cuenta por cliente que se pueda mandar por WhatsApp el mismo día: lo que se llevó, lo que abonó y lo que debe.
· Ningún pedido a crédito sin que alguien avise si ya se pasó del límite.

Y el diagnóstico gratis sigue en pie: con sus números le decimos también cuánto de su cartera está vencida y con quién.

¿Cuántas de sus tiendas le compran a crédito?$m$,'texto',
 'dar algo util aunque no compren y recordar el diagnostico','[]'::jsonb,true,'diagnostico',
 'marcas-6-credito.jpg',null,null),

('marcas','email','marcas diagnostico · correo 6',6,'un caso y una propuesta',$m$[[si persona]]{{persona}}, [[/si]]le cuento un caso real y le hago una propuesta.

Una cadena de moda con cincuenta claves traía 1.2 millones de pesos parados: no perdidos, mal repartidos. Modelos y tallas que sobraban en un lugar y faltaban en otro, y nadie lo veía desde el reporte de ventas. Se vio cruzando existencia contra venta, clave por clave y talla por talla. En una marca con bodega de producto terminado, showroom y tienda propia pasa igual.

La propuesta: ese mismo cruce con sus números, en quince minutos, gratis. Se lleva el resultado aunque no nos compre nada.

¿Le busco un espacio esta semana o la que entra?$m$,'texto',
 'contar el caso real y proponer el diagnostico','[]'::jsonb,true,'diagnostico',
 'marcas-7-caso.jpg','Agendar el diagnóstico','https://www.sacscloud.com/agendar/demo'),

('marcas','email','marcas diagnostico · correo 7',7,'cierro el tema aquí',$m$[[si persona]]{{persona}}, [[/si]]ya le escribí varias veces y no quiero volverme parte del ruido, así que cierro el tema aquí.

Le insistí porque en una marca que vende a tiendas el dinero casi nunca está perdido: está parado en curvas rotas, en modelos que no rotan y en crédito que nadie cobró a tiempo. Y eso no se ve desde el reporte de ventas, se ve cruzando existencia contra venta, modelo por modelo y talla por talla. Es un rato de trabajo, no un proyecto de meses.

La oferta del diagnóstico gratis no caduca: conteste este correo cuando le sirva y lo hacemos.

Gracias por leer hasta aquí.$m$,'texto',
 'cerrar con dignidad','[]'::jsonb,true,'diagnostico',
 'marcas-8-cierre.jpg',null,null);

-- ── La pieza visual: un modelo con su curva ──────────────────────────────────
-- Entra del cuarto correo en adelante y solo si ya abrieron. Es la ficha de UN
-- modelo tal como la ve el vendedor: sus tres listas, la curva que ya se
-- rompió en un color y el crédito de la boutique que lo está reponiendo.
-- Datos de ejemplo. Colores de paleta.ts: verde = precio/dinero, ámbar =
-- atención, morado = ancla, azul = dato del cliente.
insert into abm_plantillas (giro, canal, nombre, orden, asunto, cuerpo, formato, objetivo, variables, activa, ruta) values
('marcas','pieza','pieza',1,'Un modelo con su curva',$m$<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border:1px solid #ececec;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
<tr>
<td width="4" bgcolor="#9B8CFA" style="background-color:#9B8CFA;width:4px;font-size:1px;line-height:1px;">&nbsp;</td>
<td bgcolor="#ffffff" style="background-color:#ffffff;padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr><td colspan="3" style="padding:13px 14px 11px 14px;background-color:#ffffff;color:#3a3a44;font-size:16px;font-weight:bold;line-height:20px;">Blusa lino dama &middot; modelo 2210<br><span style="font-size:14px;font-weight:normal;color:#8a8a92;">Curva CH&ndash;XG &middot; arena, olivo y negro &middot; curva de 10 piezas</span></td></tr>
<tr><td width="7" bgcolor="#4FBF95" style="background-color:#4FBF95;width:7px;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 6px 9px 12px;color:#3a3a44;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Menudeo</b> &middot; tienda propia, pieza suelta</td><td align="right" style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 14px 9px 6px;color:#1E8A63;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">$890</td></tr>
<tr><td bgcolor="#4FBF95" style="background-color:#4FBF95;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 6px 9px 12px;color:#3a3a44;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Boutique</b> &middot; 6 a 19 piezas</td><td align="right" style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 14px 9px 6px;color:#1E8A63;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">$520</td></tr>
<tr><td bgcolor="#9B8CFA" style="background-color:#9B8CFA;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td bgcolor="#EEECFE" style="background-color:#EEECFE;border-top:1px solid #ececec;padding:10px 6px 10px 12px;color:#5B4BD6;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Distribuidor</b> &middot; curva completa de 10 &middot; el sistema lo cobra solo</td><td align="right" bgcolor="#EEECFE" style="background-color:#EEECFE;border-top:1px solid #ececec;padding:10px 14px 10px 6px;color:#5B4BD6;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">$460</td></tr>
<tr><td bgcolor="#E8A838" style="background-color:#E8A838;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td bgcolor="#FFF4E5" style="background-color:#FFF4E5;border-top:1px solid #ececec;padding:9px 6px 9px 12px;color:#9a6a10;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Curva rota en arena</b> &middot; sin M ni G &middot; quedan 9 piezas de los extremos</td><td align="right" bgcolor="#FFF4E5" style="background-color:#FFF4E5;border-top:1px solid #ececec;padding:9px 14px 9px 6px;color:#9a6a10;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">avisa</td></tr>
<tr><td bgcolor="#7DA6F5" style="background-color:#7DA6F5;font-size:1px;line-height:1px;border-top:1px solid #ececec;">&nbsp;</td><td style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 6px 9px 12px;color:#3a3a44;font-size:14px;line-height:19px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><b>Boutique Lila, M&eacute;rida</b> &middot; cr&eacute;dito 30 d&iacute;as</td><td align="right" style="background-color:#ffffff;border-top:1px solid #ececec;padding:9px 14px 9px 6px;color:#2C5FC4;font-size:14px;font-weight:bold;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">debe $24,300</td></tr>
<tr><td colspan="3" style="padding:12px 14px 14px 14px;background-color:#ffffff;color:#3a3a44;font-size:14px;line-height:19px;">Lo que se levant&oacute; en la feria contra lo que hay en bodega, y el precio que le toca a cada tienda. <b>Nadie decide el descuento de cabeza en el stand.</b></td></tr>
</table>
</td></tr>
</table>$m$,'html',
 'La ficha de un modelo como la ve el vendedor: menudeo, boutique y distribuidor, la curva que se rompio en un color y el credito de la boutique que lo repone.',
 '[]'::jsonb,true,'ambas');

-- ── Las dos cadencias y sus pasos (solo correo) ──────────────────────────────
-- Mismos días que mayoristas y calzado (1, 4, 6, 10, 14, 19, 25, 33).
insert into abm_cadencias (id, nombre, giro, ruta, descripcion, activa, creada_por) values
('c0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b05','Marcas · demo','marcas','demo','Cadencia de 8 correos, del día 1 al 33, escrita para la marca que expone en feria y vende a tiendas y boutiques: pedido de feria, curva por talla y color, foto a venta, reposición sola, precio por cliente y crédito. Solo correo.',true,'sistema'),
('c0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b06','Marcas · diagnóstico','marcas','diagnostico','Cadencia de 8 correos, del día 1 al 33, escrita para la marca que expone en feria, con el diagnóstico gratis como ofrecimiento. Solo correo.',true,'sistema');

insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select c.id, d.dia, d.orden, 'email', p.id, true, d.nota
from abm_cadencias c
join (values
  (1, 1, 0, 'presentarse: por que le escribimos y que hace Sacs para la marca que vende a tiendas'),
  (4, 2, 1, 'abrir con el pedido de feria que se surte incompleto'),
  (6, 3, 2, 'enseñar el camino de la foto de la muestra a la venta'),
  (10, 4, 3, 'mostrar el catalogo en linea: la reposicion entra sola'),
  (14, 5, 4, 'romper la objecion de la hoja con las listas por cliente'),
  (19, 6, 5, 'dar algo util aunque no compren: las tres reglas del credito'),
  (25, 7, 6, 'contar el caso real y proponer'),
  (33, 8, 7, 'cerrar con dignidad')
) as d(dia, orden, correo, nota) on true
join abm_plantillas p on p.giro = 'marcas' and p.canal = 'email' and p.orden = d.correo and p.ruta = c.ruta
where c.giro = 'marcas';

commit;
