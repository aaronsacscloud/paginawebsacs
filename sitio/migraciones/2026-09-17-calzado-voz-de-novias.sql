-- ══ Calzado en la voz de novias ══════════════════════════════════════════════
--
-- Los correos 2 al 7 de calzado son fichas de producto: abren diciendo «le
-- cuento cómo entra un modelo nuevo EN SACS», enumeran funciones («arma la
-- ficha: nombre, descripción, categoría, variantes») y cierran anunciando la
-- estructura del correo («le cuento un caso y le hago una propuesta»).
--
-- Novias no hace nada de eso, y por eso se lee como una persona. Las cuatro
-- diferencias, medidas comparando los dos giros correo por correo:
--
--   1. ABRE POR EL NEGOCIO DE ELLOS, no por el nuestro. «En novias el
--      inventario no es cuántos vestidos tienen colgados. Es qué modelo, en
--      qué talla y para qué fecha.»
--   2. NOMBRA PERSONAS, no funciones: «la novia», «la que atiende», «la
--      persona que se sabe todo de memoria».
--   3. CONCEDE ANTES DE CONTRADECIR: «funciona un buen rato. El problema no es
--      que esté mal hecha… ya llegó a su tope». Al dueño que lleva 18 años con
--      su libreta, decirle que está mal lo pierde en la primera línea.
--   4. CIERRA CON UNA PREGUNTA CORTA que se contesta sin pensar: «¿Quién lleva
--      hoy esa libreta?» — no con la propuesta.
--
-- Y una quinta que se ve al contar: el correo 2 de novias NO dice «Sacs» ni
-- una vez. El de calzado lo dice tres veces en el primer párrafo.
--
-- Se conserva la sustancia del giro —corrida, número, matriz, crédito,
-- catálogo— y se cuenta como su día, no como nuestro catálogo de funciones.

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Cada temporada empieza igual: doscientos modelos nuevos y alguien sentado capturando. Nombre, clave, la corrida completa, número por número y color por color. Una tarde entera antes de poder vender el primero.

Y mientras eso pasa, las zapaterías ya están preguntando qué hay.

Lo que cambia para los que ya lo tienen: se le toma la foto al par con el teléfono y el modelo queda dado de alta con su corrida completa, listo para que lo vean sus clientes. El precio no lo pone el sistema, lo dicta usted.

¿Cuánto les toma hoy subir una temporada completa?'
where giro='calzado' and ruta='demo' and canal='email' and orden=2;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]La parte que más cambia el día de una fábrica no es la bodega. Es dejar de contestar el WhatsApp.

Hoy la zapatería de Querétaro escribe a las once de la noche a preguntar si queda del 25 en café. Alguien tiene que ir a ver, contestar, apartar y anotar. Y si contesta hasta el otro día, el pedido ya se fue con otro.

Cuando el catálogo trae la existencia real por número, esa zapatería arma su matriz sola a las once de la noche y los pares se apartan en ese momento. Usted lo ve en la mañana, ya hecho.

¿Cuántos pedidos les entran hoy por WhatsApp?'
where giro='calzado' and ruta='demo' and canal='email' and orden=3;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Lo que más me contestan es «yo lo llevo en mi hoja y así funciona». Y funciona, hasta que hay que contestar rápido.

El mismo modelo tiene un precio para la zapatería que se lleva la corrida, otro para el distribuidor que se lleva veinte y otro de menudeo en la tienda de fábrica. Casi siempre hay alguien sacando esa cuenta de cabeza — y el día que esa persona no está, alguien da el de mayoreo a quien no le tocaba.

No le digo que su hoja esté mal hecha. Le digo que ya no alcanza a contestar con el cliente esperando.

¿Quién saca hoy el precio cuando les habla una zapatería nueva?'
where giro='calzado' and ruta='demo' and canal='email' and orden=4;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Le dejo algo que sirve aunque nunca nos compre, porque es lo que más dinero cuida en una fábrica que vende a crédito.

Tres cosas que hacen distinto los proveedores que sí cobran:
· El límite y el plazo de cada zapatería, escritos antes del primer embarque. No después, cuando ya debe.
· Un estado de cuenta que se pueda mandar por WhatsApp el mismo día: lo que se llevó, lo que abonó y lo que debe.
· Alguien que avise antes de surtir, no después, cuando el cliente ya se pasó del límite.

Las tres se pueden hacer en papel. El problema nunca es saberlas: es que se hagan el día que hay prisa.

¿Cómo saben hoy si una zapatería ya se pasó de su límite?'
where giro='calzado' and ruta='demo' and canal='email' and orden=5;

update abm_plantillas set asunto = 'lo que salió al contar 50 claves', cuerpo =
'[[si persona]]{{persona}}.
[[/si]]Un ejemplo de lo que aparece cuando uno mira el inventario clave por clave.

En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos parados. No perdidos: mal repartidos. Números que sobraban en un lugar y faltaban en otro, y nadie lo veía desde el reporte de ventas.

En una fábrica con bodega de producto terminado pasa igual, nada más que en pares: corridas rotas que siguen contando como inventario bueno, y el número que sí se vende agotado desde hace tres semanas.

Si quiere, en treinta minutos se lo enseño con sus propios modelos y usted juzga.

¿Le queda bien esta semana o la que entra?'
where giro='calzado' and ruta='demo' and canal='email' and orden=6;

update abm_plantillas set cuerpo =
'[[si persona]]{{persona}}.
[[/si]]No le quiero seguir llenando el correo, así que aquí le paro.

Le escribí porque una fábrica de calzado no vende modelos: vende corridas. Y los sistemas de tienda normales cuentan pares sin saber de qué número son, tratan igual a la zapatería que se lleva una corrida y al que compra un par, y no tienen dónde anotar lo que cada cliente debe. Casi ninguno está hecho para eso.

Si algún día quiere ver cómo se ve su catálogo con la matriz de cada modelo y pidiéndose solo, conteste este correo y lo armamos.

Gracias por leer hasta aquí.'
where giro='calzado' and ruta='demo' and canal='email' and orden=7;

select orden, asunto, length(cuerpo) largo,
       (cuerpo like '%Sacs%') menciona_sacs,
       (btrim(cuerpo) like '%?') cierra_preguntando
from abm_plantillas where giro='calzado' and ruta='demo' and canal='email' and activa order by orden;
