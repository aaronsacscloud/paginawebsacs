-- Marcas y mayoristas, en la misma voz que novias (ver la migración de calzado
-- del mismo día para las cuatro diferencias y por qué importan).
-- Se conserva la sustancia de cada giro: en marcas la feria, la curva por talla
-- y color y la reposición entre una feria y la otra; en mayoristas el paquete
-- de doce, las tallas que quedan sueltas y los tres precios.

-- ── marcas ──────────────────────────────────────────────────────────────────
update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Cada colección empieza igual: alguien capturando modelo por modelo, con sus tallas y sus colores, contra el reloj de la feria.

Y cuando por fin está, la feria ya empezó y las boutiques están preguntando qué hay.

Lo que cambia para las marcas que ya lo tienen: se le toma la foto a la prenda con el teléfono y el modelo queda dado de alta con su curva completa, talla por talla y color por color, listo para enseñarse. El precio lo dicta usted, no el sistema.

¿Cuánto les toma hoy subir una colección completa?'
where giro='marcas' and ruta='demo' and canal='email' and orden=2;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Lo que más cambia el año de una marca no es la feria. Es lo que pasa entre una feria y la otra.

En la feria levantan pedido y todo sale bien. Después la boutique de Mérida vende las medianas en dos semanas, quiere reponer, y escribe por WhatsApp a preguntar qué queda. Alguien va a la bodega, cuenta, contesta. Si contesta tarde, esa reposición no se hizo y la marca se enteró en la feria siguiente.

Cuando el catálogo trae la existencia real por talla y color, esa boutique repone sola cuando le hace falta, sin preguntarle a nadie.

¿Cómo les reponen hoy las tiendas entre feria y feria?'
where giro='marcas' and ruta='demo' and canal='email' and orden=3;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Lo que más me contestan es «yo lo llevo en mi hoja y así funciona». Y funciona, hasta que hay que contestar rápido.

El mismo modelo tiene un precio para la boutique que se lleva la curva, otro para el distribuidor que se lleva veinte y otro para lo que se vende en la feria. Casi siempre hay alguien sacando esa cuenta de cabeza — y el día que esa persona no está, alguien da el precio que no tocaba.

No le digo que su hoja esté mal hecha. Le digo que ya no alcanza a contestar en el stand, con la compradora enfrente.

¿Quién saca hoy el precio cuando llega una tienda nueva?'
where giro='marcas' and ruta='demo' and canal='email' and orden=4;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Le dejo algo que sirve aunque nunca nos compre, porque es lo que más dinero cuida en una marca que surte a crédito.

Tres cosas que hacen distinto las marcas que sí cobran:
· El límite y el plazo de cada tienda, escritos antes del primer embarque. No después, cuando ya debe.
· Un estado de cuenta que se pueda mandar por WhatsApp el mismo día: lo que se llevó, lo que abonó y lo que debe.
· Alguien que avise antes de surtir, no después, cuando la tienda ya se pasó del límite.

Las tres se pueden hacer en papel. El problema nunca es saberlas: es que se hagan la semana de la feria, que es cuando hay prisa.

¿Cómo saben hoy si una tienda ya se pasó de su límite?'
where giro='marcas' and ruta='demo' and canal='email' and orden=5;

update abm_plantillas set asunto = 'lo que salió al contar 50 claves', cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Un ejemplo de lo que aparece cuando uno mira el inventario clave por clave.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos parados. No perdidos: mal repartidos. Tallas que sobraban en un lugar y faltaban en otro, y nadie lo veía desde el reporte de ventas.

En una marca con bodega propia pasa igual: curvas rotas que siguen contando como inventario bueno, y la talla que sí se vende agotada desde la feria pasada.

Si quiere, en treinta minutos se lo enseño con sus propios modelos y usted juzga.

¿Le queda bien esta semana o la que entra?'
where giro='marcas' and ruta='demo' and canal='email' and orden=6;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]No le quiero seguir llenando el correo, así que aquí le paro.

Le escribí porque una marca no vende modelos: vende curvas. Y los sistemas de tienda normales cuentan prendas sin saber de qué talla ni de qué color son, tratan igual a la boutique que se lleva la curva y a la que compra una pieza, y no tienen dónde anotar lo que cada tienda debe. Casi ninguno está hecho para eso.

Si algún día quiere ver cómo se ve su catálogo con la curva de cada modelo y reponiéndose solo, conteste este correo y lo armamos.

Gracias por leer hasta aquí.'
where giro='marcas' and ruta='demo' and canal='email' and orden=7;

-- ── mayoristas ──────────────────────────────────────────────────────────────
update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]La temporada empieza igual todos los años: llega el embarque y alguien se sienta a capturar prenda por prenda, con sus tallas y sus colores, antes de poder venderla.

Y mientras eso pasa, las tiendas ya están mandando fotos por WhatsApp a preguntar qué llegó.

Lo que cambia para los que ya lo tienen: se le toma la foto a la prenda con el teléfono y queda dada de alta con sus tallas, lista para que la vean sus clientes. El precio lo dicta usted, no el sistema.

¿Cuánto les toma hoy subir un embarque completo?'
where giro='mayoristas' and ruta='demo' and canal='email' and orden=2;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Lo que más cambia el día de un mayorista no es el mostrador. Es dejar de contestar el WhatsApp.

Hoy la tienda de Zacatecas manda a preguntar si queda del modelo azul. Alguien va a la bodega, cuenta los paquetes, contesta, aparta y anota. Y si contesta hasta el otro día, esa tienda ya le compró a otro de la misma calle.

Cuando el catálogo trae los paquetes que de verdad quedan, esa tienda arma su pedido sola de madrugada y lo que pidió se aparta en ese momento. Usted lo ve en la mañana, ya hecho.

¿Cuántos pedidos les entran hoy por WhatsApp?'
where giro='mayoristas' and ruta='demo' and canal='email' and orden=3;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Lo que más me contestan es «yo lo llevo en mi hoja y así funciona». Y funciona, hasta que hay que contestar rápido.

El paquete de doce sale completo, pero la siguiente clienta quiere nada más las medianas y las grandes. Se rompe el paquete, quedan sueltas las chicas, y esas sueltas ya no son un paquete ni son menudeo: son un renglón que nadie lleva. A fin de temporada están ahí, y nadie sabe desde cuándo.

No le digo que su hoja esté mal hecha. Le digo que ya no alcanza cuando el paquete se rompe.

¿Cómo llevan hoy las tallas que quedan sueltas?'
where giro='mayoristas' and ruta='demo' and canal='email' and orden=4;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Le dejo algo que sirve aunque nunca nos compre, porque es lo que más dinero cuida en mayoreo.

Tres cosas que hacen distinto los proveedores que sí cobran:
· El límite y el plazo de cada tienda, escritos antes del primer embarque. No después, cuando ya debe.
· Un estado de cuenta que se pueda mandar por WhatsApp el mismo día: lo que se llevó, lo que abonó y lo que debe.
· Alguien que avise antes de surtir, no después, cuando la tienda ya se pasó del límite.

Las tres se pueden hacer en papel. El problema nunca es saberlas: es que se hagan el día de plaza, que es cuando hay prisa.

¿Cómo saben hoy si una tienda ya se pasó de su límite?'
where giro='mayoristas' and ruta='demo' and canal='email' and orden=5;

update abm_plantillas set asunto = 'lo que salió al contar 50 claves', cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Un ejemplo de lo que aparece cuando uno mira el inventario clave por clave.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos parados. No perdidos: mal repartidos. Tallas que sobraban en un lugar y faltaban en otro, y nadie lo veía desde el reporte de ventas.

En mayoreo tiene otra cara: paquetes rotos que siguen contando como paquete completo, y la talla que sí se vende agotada desde hace tres semanas.

Si quiere, en treinta minutos se lo enseño con sus propias prendas y usted juzga.

¿Le queda bien esta semana o la que entra?'
where giro='mayoristas' and ruta='demo' and canal='email' and orden=6;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]No le quiero seguir llenando el correo, así que aquí le paro.

Le escribí porque en mayoreo una prenda no tiene un precio: tiene tres. Y los sistemas de tienda normales no saben llevar eso, ni saben qué hacer cuando un paquete se rompe y quedan tallas sueltas, ni tienen dónde anotar lo que cada tienda debe. Casi ninguno está hecho para eso.

Si algún día quiere ver cómo se ve su catálogo con los paquetes que de verdad quedan, conteste este correo y lo armamos.

Gracias por leer hasta aquí.'
where giro='mayoristas' and ruta='demo' and canal='email' and orden=7;

select giro, count(*) filter (where cuerpo like '%Sacs%') mencionan_sacs,
       count(*) filter (where btrim(cuerpo) like '%?') cierran_preguntando, count(*) total
from abm_plantillas where giro in ('calzado','marcas','mayoristas','novias')
  and ruta='demo' and canal='email' and activa and orden between 2 and 7 group by 1 order by 1;
