-- ══ LA APERTURA DEL ALIADO, COMO VARIABLE Y NO COMO INSTRUCCIÓN ═════════════
--
-- Susto real del 16-sep-2026. Los correos 1 y 2 de los cuatro arcos dejaban un
-- hueco escrito en prosa para que lo rellenara la IA:
--   «...no de una lista: [[apertura del expediente: el gancho de su tipo…]]»
-- Ese mismo día la API de Anthropic se quedó sin crédito, la redacción cayó al
-- texto base tal cual y quedaron tres borradores CON EL MARCADOR ADENTRO,
-- esperando que alguien les diera aprobar.
--
-- Una variable se rellena siempre; una instrucción a la IA solo cuando la IA
-- contesta. Así que la apertura pasa a ser `{{apertura}}`, `{{su_gente}}` y
-- `{{dolor_cliente}}`, que salen del catálogo (`abm-aliados.ts`) por el tipo de
-- la cuenta y se sustituyen en código, como `{{nombre}}` o `{{ciudad}}`.
-- La IA sigue puliendo el correo; si no está, lo que sale ya es correcto y ya
-- está diferenciado por tipo.
--
-- Y de paso se cancelan los borradores que alcanzaron a nacer con el marcador.

begin;

update abm_toques set estado = 'cancelado',
       resultado = 'generado sin IA y con el marcador de apertura dentro: se regenera'
 where estado in ('borrador', 'aprobado', 'programado')
   and (cuerpo like '%[[apertura%' or cuerpo like '%[[el dolor%');

update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} a propósito, no de una lista. {{apertura}}
Hacemos software de inventario y punto de venta para moda. A usted no le vengo a vender un sistema: le vengo a proponer que sus clientes lo tengan.
Funciona así, y es de una sola línea: usted nos presenta a uno de sus clientes, nosotros hacemos la venta completa —la presentación, la visita o la reunión, el cierre— y cuando esa cuenta paga, usted cobra el 40% de ese negocio mientras siga siendo cliente. De por vida, no el primer mes.
Antes de venderle a nadie le hacemos un diagnóstico gratis: con sus existencias y sus ventas le decimos cuánto dinero trae parado y qué está dejando de vender por faltantes. Si no le sirve, ahí muere y usted queda como quien le dio algo concreto.
¿Le interesa que le cuente los números de la comisión?'
 where giro = 'aliados' and ruta = 'referidor' and orden = 1;
update abm_plantillas set cuerpo = 'Le platico qué es lo que vemos del otro lado, por si le suena.
Le vende a {{su_gente}}, y lo que pasa del otro lado es esto: {{dolor_cliente}}.
Un modelo son ocho o diez tallas por color. Con dos tallas en cero del que sí jala, el mostrador se ve surtido y la venta ya se fue.
No es que su cliente trabaje mal: está midiendo con lo que tiene.
¿Cuántos de sus clientes llevan el inventario en cuaderno o en Excel?'
 where giro = 'aliados' and ruta = 'referidor' and orden = 2;
update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} por algo concreto. {{apertura}}
Hacemos software de inventario y punto de venta para moda. Lo que le propongo no es que nos recomiende: es que su servicio incluya con qué ejecutarlo.
Usted ya cobra por lo difícil —el diagnóstico, el criterio, el plan—. Lo que casi siempre se cae después es la ejecución: el cliente aprueba el plan y a la tercera temporada está igual, porque no tiene con qué medirlo.
Con Sacs adentro, su entrega deja de ser un documento y se vuelve operación. Usted cobra comisión por la licencia y además sus propios servicios de implementación, capacitación y seguimiento.
¿Le interesa ver cómo queda armado?'
 where giro = 'aliados' and ruta = 'consultor' and orden = 1;
update abm_plantillas set cuerpo = 'Le platico dónde vemos que se cae, por si le pasa.
Le vende a {{su_gente}}, y lo que pasa del otro lado es esto: {{dolor_cliente}}.
El plan estaba bien. Lo que falta es que alguien lo mida todos los días: un modelo son ocho o diez tallas por color, y eso no se sigue en una hoja que se actualiza una vez al mes.
Por eso el mismo cliente vuelve a llamarlo con el mismo problema dos temporadas después.
¿Le ha pasado que le pidan otra vez el mismo diagnóstico?'
 where giro = 'aliados' and ruta = 'consultor' and orden = 2;
update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} por esto. {{apertura}}
Hacemos software de inventario y punto de venta para moda, y estamos armando la red de quienes lo operan en México. No busco que nos recomiende: busco que tenga un negocio propio encima.
Cómo se ve: nosotros lo certificamos —producto, IA, implementación—, lo acompañamos en sus primeras tiendas, y de ahí en adelante usted vende, implementa y opera. Cada retailer que opera con usted le deja ingreso recurrente mientras sea cliente.
No hace falta venir de la tecnología. Hace falta saber de retail, que es la parte que no enseñamos nosotros.
¿Le interesa que le cuente qué implica la certificación?'
 where giro = 'aliados' and ruta = 'orquestador' and orden = 1;
update abm_plantillas set cuerpo = 'Le platico por qué se lo propongo así y no como referido.
Le vende a {{su_gente}}, y lo que pasa del otro lado es esto: {{dolor_cliente}}.
Eso no se arregla con una recomendación: se arregla con alguien que entre, lo deje andando y se quede a operarlo. Ese trabajo hoy lo hace usted gratis o no lo hace nadie.
Cobrarlo una vez es un proyecto. Cobrarlo cada mes es un negocio.
¿Cuántas tiendas diría que podría operar el primer año?'
 where giro = 'aliados' and ruta = 'orquestador' and orden = 2;
update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} por una integración, no por una venta. {{apertura}}
Hacemos software de inventario y punto de venta para moda. Tenemos API y servidor MCP abiertos, y la base de marcas y tiendas que operan con nosotros.
Lo que propongo es que lo suyo quede conectado: que el dato que hoy se queda en su lado llegue al inventario del retailer, y al revés. No hay comisión ni reventa de por medio: lo que gana es distribución en toda nuestra base y un caso que sus clientes le van a pedir.
¿Con quién de su lado se habla de integraciones?'
 where giro = 'aliados' and ruta = 'tecnologia' and orden = 1;
update abm_plantillas set cuerpo = 'Le platico dónde se rompe hoy, por si lo ven igual.
Le vende a {{su_gente}}, y lo que pasa del otro lado es esto: {{dolor_cliente}}.
En moda el problema es el detalle: un modelo son ocho o diez tallas por color, y casi todas las integraciones se quedan a nivel producto. Ahí es donde se sobrevende, se reenvía y se devuelve.
Nosotros llevamos el inventario a ese nivel, que es lo que hace que la integración sirva de algo.
¿Cómo resuelven hoy el nivel de talla y color?'
 where giro = 'aliados' and ruta = 'tecnologia' and orden = 2;

commit;

-- Comprobación: ni un hueco sin variable en las 28 plantillas.
select ruta, orden, asunto,
       (cuerpo like '%[[apertura%' or cuerpo like '%[[el dolor%') as marcador,
       (cuerpo like '%{{apertura}}%' or cuerpo like '%{{dolor_cliente}}%') as variable
  from abm_plantillas where giro = 'aliados' and orden <= 2 order by ruta, orden;
-- El punto final de la apertura: la frase del catálogo cierra sin punto
-- (así se puede usar a media frase) y aquí es una oración entera.
update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} a propósito, no de una lista. {{apertura}}.
Hacemos software de inventario y punto de venta para moda. A usted no le vengo a vender un sistema: le vengo a proponer que sus clientes lo tengan.
Funciona así, y es de una sola línea: usted nos presenta a uno de sus clientes, nosotros hacemos la venta completa —la presentación, la visita o la reunión, el cierre— y cuando esa cuenta paga, usted cobra el 40% de ese negocio mientras siga siendo cliente. De por vida, no el primer mes.
Antes de venderle a nadie le hacemos un diagnóstico gratis: con sus existencias y sus ventas le decimos cuánto dinero trae parado y qué está dejando de vender por faltantes. Si no le sirve, ahí muere y usted queda como quien le dio algo concreto.
¿Le interesa que le cuente los números de la comisión?' where giro='aliados' and ruta='referidor' and orden=1;
update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} por algo concreto. {{apertura}}.
Hacemos software de inventario y punto de venta para moda. Lo que le propongo no es que nos recomiende: es que su servicio incluya con qué ejecutarlo.
Usted ya cobra por lo difícil —el diagnóstico, el criterio, el plan—. Lo que casi siempre se cae después es la ejecución: el cliente aprueba el plan y a la tercera temporada está igual, porque no tiene con qué medirlo.
Con Sacs adentro, su entrega deja de ser un documento y se vuelve operación. Usted cobra comisión por la licencia y además sus propios servicios de implementación, capacitación y seguimiento.
¿Le interesa ver cómo queda armado?' where giro='aliados' and ruta='consultor' and orden=1;
update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} por esto. {{apertura}}.
Hacemos software de inventario y punto de venta para moda, y estamos armando la red de quienes lo operan en México. No busco que nos recomiende: busco que tenga un negocio propio encima.
Cómo se ve: nosotros lo certificamos —producto, IA, implementación—, lo acompañamos en sus primeras tiendas, y de ahí en adelante usted vende, implementa y opera. Cada retailer que opera con usted le deja ingreso recurrente mientras sea cliente.
No hace falta venir de la tecnología. Hace falta saber de retail, que es la parte que no enseñamos nosotros.
¿Le interesa que le cuente qué implica la certificación?' where giro='aliados' and ruta='orquestador' and orden=1;
update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} por una integración, no por una venta. {{apertura}}.
Hacemos software de inventario y punto de venta para moda. Tenemos API y servidor MCP abiertos, y la base de marcas y tiendas que operan con nosotros.
Lo que propongo es que lo suyo quede conectado: que el dato que hoy se queda en su lado llegue al inventario del retailer, y al revés. No hay comisión ni reventa de por medio: lo que gana es distribución en toda nuestra base y un caso que sus clientes le van a pedir.
¿Con quién de su lado se habla de integraciones?' where giro='aliados' and ruta='tecnologia' and orden=1;
select ruta, (cuerpo like '%{{apertura}}.%') as con_punto from abm_plantillas where giro='aliados' and orden=1 order by ruta;
-- El correo 1 del aliado lleva SU liga de WhatsApp, y es la de ventas.
--
-- Sin liga en el texto base, la IA se inventó una: en el correo del despacho
-- contable escribió una cita de HubSpot y un wa.me/5215568806568, que no es
-- nuestro número. El de ventas es 55 9302 7234 desde el 12-sep-2026, y es el
-- que ya llevan las plantillas de los demás giros. La regla del guion dice que
-- el correo 1 lleva «las ligas del texto base»: si el texto base no trae
-- ninguna, la IA rellena el hueco con lo que se le ocurre.
update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} a propósito, no de una lista. {{apertura}}.
Hacemos software de inventario y punto de venta para moda. A usted no le vengo a vender un sistema: le vengo a proponer que sus clientes lo tengan.
Funciona así, y es de una sola línea: usted nos presenta a uno de sus clientes, nosotros hacemos la venta completa —la presentación, la visita o la reunión, el cierre— y cuando esa cuenta paga, usted cobra el 40% de ese negocio mientras siga siendo cliente. De por vida, no el primer mes.
Antes de venderle a nadie le hacemos un diagnóstico gratis: con sus existencias y sus ventas le decimos cuánto dinero trae parado y qué está dejando de vender por faltantes. Si no le sirve, ahí muere y usted queda como quien le dio algo concreto.
¿Le interesa que le cuente los números de la comisión?
Si prefiere preguntarme por WhatsApp antes de nada: https://wa.me/525593027234' where giro='aliados' and ruta='referidor' and orden=1;
update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} por algo concreto. {{apertura}}.
Hacemos software de inventario y punto de venta para moda. Lo que le propongo no es que nos recomiende: es que su servicio incluya con qué ejecutarlo.
Usted ya cobra por lo difícil —el diagnóstico, el criterio, el plan—. Lo que casi siempre se cae después es la ejecución: el cliente aprueba el plan y a la tercera temporada está igual, porque no tiene con qué medirlo.
Con Sacs adentro, su entrega deja de ser un documento y se vuelve operación. Usted cobra comisión por la licencia y además sus propios servicios de implementación, capacitación y seguimiento.
¿Le interesa ver cómo queda armado?
Si prefiere preguntarme por WhatsApp antes de nada: https://wa.me/525593027234' where giro='aliados' and ruta='consultor' and orden=1;
update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} por esto. {{apertura}}.
Hacemos software de inventario y punto de venta para moda, y estamos armando la red de quienes lo operan en México. No busco que nos recomiende: busco que tenga un negocio propio encima.
Cómo se ve: nosotros lo certificamos —producto, IA, implementación—, lo acompañamos en sus primeras tiendas, y de ahí en adelante usted vende, implementa y opera. Cada retailer que opera con usted le deja ingreso recurrente mientras sea cliente.
No hace falta venir de la tecnología. Hace falta saber de retail, que es la parte que no enseñamos nosotros.
¿Le interesa que le cuente qué implica la certificación?
Si prefiere preguntarme por WhatsApp antes de nada: https://wa.me/525593027234' where giro='aliados' and ruta='orquestador' and orden=1;
update abm_plantillas set cuerpo = '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} por una integración, no por una venta. {{apertura}}.
Hacemos software de inventario y punto de venta para moda. Tenemos API y servidor MCP abiertos, y la base de marcas y tiendas que operan con nosotros.
Lo que propongo es que lo suyo quede conectado: que el dato que hoy se queda en su lado llegue al inventario del retailer, y al revés. No hay comisión ni reventa de por medio: lo que gana es distribución en toda nuestra base y un caso que sus clientes le van a pedir.
¿Con quién de su lado se habla de integraciones?
Si prefiere preguntarme por WhatsApp antes de nada: https://wa.me/525593027234' where giro='aliados' and ruta='tecnologia' and orden=1;
select ruta, (cuerpo like '%wa.me/525593027234%') as liga_ok from abm_plantillas where giro='aliados' and orden=1 order by ruta;
