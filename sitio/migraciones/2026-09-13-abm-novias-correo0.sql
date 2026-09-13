-- ═══ El correo 0 de novias: por qué le estamos escribiendo ════════════════
--
-- Pedido del dueño: antes de arrancar la cadencia tiene que existir un correo
-- que le permita a quien lo recibe ENTENDER por qué le llega, qué hace Sacs
-- distinto y qué puede hacer con eso.
--
-- ⚠️ NO DICE QUE SE REGISTRARON, PORQUE NO SE REGISTRARON.
-- La idea original era abrir con "usted se registró hace unas semanas". Las 73
-- cuentas de novias salieron de investigación —localizadores, Google Maps,
-- tiendasinfo.mx; está en abm_fuentes—: ninguna se registró. Decirlo habría
-- costado tres cosas: la persona no se acuerda porque no pasó y desconfía justo
-- en el correo donde te juegas todo; quien no reconoce el registro reporta, y
-- el dominio es lo que el motor entero está construido para proteger (arranca
-- pausado, 15 al día, rampa de 30%); y en México deja sin base legal que
-- sostener. El porqué verdadero funciona igual de bien y desarma más:
-- "estuvimos levantando el mapa de tiendas de novia y su boutique salió ahí".
--
-- VA EN TEXTO PLANO, SIN FOTO NI BOTONES, A PROPÓSITO.
-- El motor manda los tres primeros correos en texto plano, sin pixel y sin
-- enlaces envueltos (abm-cadencias.ts: "el correo en frío que parece boletín
-- entrega peor"), y la pieza visual entra del cuarto en adelante y solo si ya
-- hubo apertura o clic. Un correo 0 con foto y dos botones es exactamente lo
-- que esa regla evita. La foto sigue llegando, en el momento en que sirve.
--
-- Una versión por RUTA porque el ofrecimiento es distinto: demo enseña el
-- sistema, diagnóstico entrega el análisis aunque no compren.

insert into abm_plantillas (giro, canal, nombre, orden, asunto, cuerpo, formato, objetivo, variables, activa, ruta) values
('novias','email','presentacion',0,'por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, y antes que nada le digo por qué le llega esto: estuvimos levantando el mapa de las tiendas de novia de México y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] salió ahí. Nadie nos pasó su correo ni usted se registró en ningún lado — la buscamos nosotros, y por eso le escribo yo y no un formulario.
Hacemos un sistema mexicano de inventario y punto de venta para tiendas de moda, con una parte hecha a propósito para novias. Lo que nos dicen que ningún sistema normal les resuelve:
· Una venta que empieza hoy y se entrega en seis meses, con la fecha de la boda y la de entrega, no la del ticket.
· El anticipo y los abonos de cada novia, con su saldo al día y sin buscar en la libreta.
· Las pruebas y el paso por taller: qué vestido está en ajustes y desde cuándo.
· El pedido al proveedor con su tiempo de entrega, para saber si ese modelo en esa talla llega a tiempo.
La mayoría de los puntos de venta los tratan como si vendieran playeras: cobran y descuentan del inventario, y ahí se acaba. Con un vestido apartado para octubre eso no alcanza.
Si quiere verlo por dentro son veinte minutos: https://www.sacscloud.com/agendar/demo
Y si prefiere probarlo usted antes de hablar con nadie, la prueba es gratis y sin tarjeta: https://www.sacscloud.com/prueba-gratis
¿Le enseño cómo se ve la ficha de una novia por dentro, o prefiere probarlo por su cuenta?','texto',
 'explicar por qué le escribimos, qué hace Sacs distinto para novias y dar la accion',
 '[]'::jsonb,true,'demo'),
('novias','email','presentacion',0,'por qué le llega este correo','[[si persona]]Hola {{persona}}.
[[/si]]Le escribo de Sacs, y antes que nada le digo por qué le llega esto: estuvimos levantando el mapa de las tiendas de novia de México y {{nombre}}[[si ciudad]], en {{ciudad}},[[/si]] salió ahí[[si sucursales]], con sus {{sucursales}} sucursales[[/si]]. Nadie nos pasó su correo ni usted se registró en ningún lado — la buscamos nosotros.
Hacemos un sistema mexicano de inventario para tiendas de moda, con una parte hecha a propósito para novias: la venta que se entrega en seis meses, el anticipo y los abonos de cada clienta, el paso por taller y el pedido al proveedor con su tiempo de entrega.
Pero antes de enseñarle nada, le ofrezco algo más útil: un diagnóstico gratis de su inventario. Con su información le decimos en quince minutos cuánto dinero trae parado en modelos que no se mueven, qué tallas sí le venden y cuánto se le va en vestidos que una clienta pidió y estaban colgados en otra sucursal.
No es una demo disfrazada: es su información y se la entregamos aunque no nos compren.
Si quiere que lo hagamos, aquí se agenda: https://www.sacscloud.com/agendar/demo
Y si prefiere ver el sistema por su cuenta primero, la prueba es gratis y sin tarjeta: https://www.sacscloud.com/prueba-gratis
¿Le sacamos el diagnóstico con sus números?','texto',
 'explicar por qué le escribimos y ofrecer el diagnostico gratis',
 '[]'::jsonb,true,'diagnostico');

-- ── El correo 0 se vuelve el paso 1; los siete de hoy recorren 3 días ──────
-- Se recorren y no se encima ninguno: el de hoy abre con una pregunta ("¿hoy
-- llevan los apartados en libreta?") y esa pregunta funciona mucho mejor DESPUÉS
-- de haberse presentado que como primer contacto en frío.
update abm_pasos set dia = dia + 3, orden = orden + 1
where cadencia_id in ('085bb4af-530d-4714-a9fe-9e5a990ad401','1bff645d-0ffa-4cc9-aa3a-57542bf3633c');

insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select c.id, 1, 1, 'email', p.id, true, 'presentarse: por que le escribimos y que hace Sacs para novias'
from abm_cadencias c
join abm_plantillas p on p.giro = 'novias' and p.canal = 'email' and p.orden = 0 and p.ruta = c.ruta
where c.id in ('085bb4af-530d-4714-a9fe-9e5a990ad401','1bff645d-0ffa-4cc9-aa3a-57542bf3633c');
