-- ══ LAS CADENCIAS DE ALIADOS, UNA POR PERFIL ════════════════════════════════
--
-- Antes había dos («demo» y «diagnóstico») y las dos decían casi lo mismo,
-- porque estaban escritas para un solo tipo de aliado: la escuela. Textual del
-- día 1: «sus alumnas reciben de su parte un diagnóstico gratis». A un
-- despacho contable, a un taller de Moroleón o al que borda playeras en León
-- eso no les dice nada — y de esos son los 419 que se cargaron el 15-sep.
--
-- Regla del dueño (16-sep-2026): «los que venden talleres son unos y los que
-- venden insumos no les interesa nada de clases; se segmenta por tipo de
-- aliado, la apertura del correo debes diferenciarlo».
--
-- Cómo queda, y por qué así:
--   · EL ARCO ES DEL PERFIL — lo que gana con la alianza. Son cuatro:
--     referidor (40% de por vida), consultor (Sacs dentro de su servicio),
--     orquestador (negocio propio certificado) y tecnología (API y MCP, sin
--     comisión). Eso son 28 correos, no 7 por cada uno de los 27 tipos.
--   · LA APERTURA ES DEL TIPO. Los correos 1 y 2 dejan un hueco marcado que la
--     IA rellena con lo que `abm-aliados.ts` sabe de ese tipo: a quién le vende
--     y qué se le rompe a ese cliente suyo. Va como dato tajante del
--     expediente (ver `expediente()` en abm-generar.ts), no como pista dentro
--     del objetivo: una pista en el objetivo ya se contagió antes a todo el
--     guion (el caso de las tallas en `marcas`).
--   · LA RUTA LLEVA EL PERFIL. `abm_cadencias.ruta` y `abm_cuentas.ruta` pasan
--     a ser el perfil, que es lo que el goteo ya sabe filtrar.
--
-- Los días no se mueven: 1, 3, 7, 11, 16, 22 y 30, que es el arco que ya
-- estaba probado. Y nacen ACTIVAS pero sin goteo: sin goteo no sale un solo
-- correo, así que esto no manda nada por sí solo.

begin;

-- 1 · Fuera las dos viejas, con sus pasos y sus plantillas. No se desactivan:
--     una cadencia apagada sigue saliendo en la pantalla y confunde.
delete from abm_pasos where cadencia_id in (select id from abm_cadencias where giro = 'aliados');
delete from abm_cadencias where giro = 'aliados';
delete from abm_plantillas where giro = 'aliados';


-- ── Referidor · 40% de por vida ──
insert into abm_cadencias (nombre, giro, ruta, region, activa)
values ('Referidor · 40% de por vida', 'aliados', 'referidor', 'mexico', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'referidor', 'mexico', 'aliados referidor 1', 1, 'por qué le escribo a usted', '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} a propósito, no de una lista: [[apertura del expediente: el gancho de su tipo, con SU clientela por nombre]].
Hacemos software de inventario y punto de venta para moda. A usted no le vengo a vender un sistema: le vengo a proponer que sus clientes lo tengan.
Funciona así, y es de una sola línea: usted nos presenta a uno de sus clientes, nosotros hacemos la venta completa —la presentación, la visita o la reunión, el cierre— y cuando esa cuenta paga, usted cobra el 40% de ese negocio mientras siga siendo cliente. De por vida, no el primer mes.
Antes de venderle a nadie le hacemos un diagnóstico gratis: con sus existencias y sus ventas le decimos cuánto dinero trae parado y qué está dejando de vender por faltantes. Si no le sirve, ahí muere y usted queda como quien le dio algo concreto.
¿Le interesa que le cuente los números de la comisión?', 'presentarse y decir por qué a él; abrir con el gancho de SU tipo', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'referidor', 'mexico', 'aliados referidor 2', 2, 'lo que se le rompe a su cliente', 'Le platico qué es lo que vemos del otro lado, por si le suena.
[[el dolor de su cliente según el expediente, dicho en dos o tres líneas concretas]]
Un modelo son ocho o diez tallas por color. Con dos tallas en cero del que sí jala, el mostrador se ve surtido y la venta ya se fue.
No es que su cliente trabaje mal: está midiendo con lo que tiene.
¿Cuántos de sus clientes llevan el inventario en cuaderno o en Excel?', 'nombrar el dolor DE SU CLIENTE con las palabras de su tipo', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'referidor', 'mexico', 'aliados referidor 3', 3, 'cómo se cobra el 40%', 'Le dejo la mecánica completa, para que no haya sorpresas.
Usted nos pasa el nombre y el contacto. Nosotros hacemos todo: presentación, visita si hace falta, cotización y cierre. Usted no vende ni implementa nada.
Cuando esa cuenta paga, le corresponde el 40% de lo que pague, cada mes que siga pagando. Si deja de ser cliente, deja de cobrarse; mientras siga, se sigue cobrando.
No hay mínimo de referidos, no hay exclusividad y no tiene que dejar de recomendar lo que ya recomienda.
¿Quiere que le mande el detalle de cómo queda el pago?', 'explicar la mecánica del referido sin letras chicas', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'referidor', 'mexico', 'aliados referidor 4', 4, 'y si no quiere recomendar nada', 'Le adelanto la objeción, porque me la dicen seguido: no quiero recomendar un sistema y que luego me reclamen.
Es la objeción correcta. Por eso lo primero que recibe su cliente no es una cotización: es su propio número, sin nada que firmar.
Si no le sirve, usted queda como quien le dio algo que nadie más le dio. Y si le sirve, la decisión es de él.
Y si su cartera es chica, mejor: esto funciona porque a usted le creen, no por volumen.
¿Empezamos con un solo cliente, el que usted quiera?', 'adelantar la objeción del riesgo de reputación', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'referidor', 'mexico', 'aliados referidor 5', 5, 'un ejercicio que puede pasarle hoy', 'Le dejo algo que le puede pasar a cualquier cliente esta semana, con nosotros o sin nosotros.
Que tome sus diez modelos más vendidos y los baje a talla y color: existencia de hoy y venta de treinta días.
De ahí salen dos listas. Lo que está en cero y sí se vendía es venta perdida. Lo que lleva tres piezas sin moverse en un mes es dinero detenido.
Con eso solo, la mayoría descubre que el problema no era comprar más.
¿Se lo mando en una hoja para que lo use con su nombre?', 'dar valor gratis, con o sin nosotros', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'referidor', 'mexico', 'aliados referidor 6', 6, '1.2 millones en 50 modelos', 'Le pongo el ejemplo más claro que tengo.
En un cliente nuestro, una cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía comprada, pagada y vendible: nada más que no estaba donde la pedían.
Cincuenta modelos. La cadena maneja miles.
Su cliente maneja números mucho más chicos, pero es el mismo dinero detenido y en la misma proporción.
¿Le hacemos ese ejercicio con uno de ellos?', 'la cifra, sin inventar nada', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'referidor', 'mexico', 'aliados referidor 7', 7, 'aquí le paro', '[[si persona]]{{persona}}, [[/si]]no le sigo escribiendo, así que aquí le paro.
Le insistí porque usted ya tiene lo más difícil, que es la confianza de sus clientes. Nosotros tenemos la parte que a ellos les falta, que es el número.
Si algún día uno de ellos le dice que no sabe qué comprar o que no le cuadra el inventario, acuérdese de este correo: el diagnóstico es gratis y la comisión es del 40% mientras esa cuenta pague.
Gracias por leer hasta aquí.', 'cerrar con dignidad y dejar la puerta abierta', 'texto', true);
insert into abm_pasos (cadencia_id, dia, orden, canal, automatico)
select c.id, d.dia, d.orden, 'email', true
  from abm_cadencias c,
       (values (1,1), (3,2), (7,3), (11,4), (16,5), (22,6), (30,7)) as d(dia, orden)
 where c.giro = 'aliados' and c.ruta = 'referidor';

-- ── Consultor · Sacs dentro de su servicio ──
insert into abm_cadencias (nombre, giro, ruta, region, activa)
values ('Consultor · Sacs dentro de su servicio', 'aliados', 'consultor', 'mexico', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'consultor', 'mexico', 'aliados consultor 1', 1, 'su estrategia y quién la ejecuta', '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} por algo concreto: [[apertura del expediente: el gancho de su tipo, con SU clientela por nombre]].
Hacemos software de inventario y punto de venta para moda. Lo que le propongo no es que nos recomiende: es que su servicio incluya con qué ejecutarlo.
Usted ya cobra por lo difícil —el diagnóstico, el criterio, el plan—. Lo que casi siempre se cae después es la ejecución: el cliente aprueba el plan y a la tercera temporada está igual, porque no tiene con qué medirlo.
Con Sacs adentro, su entrega deja de ser un documento y se vuelve operación. Usted cobra comisión por la licencia y además sus propios servicios de implementación, capacitación y seguimiento.
¿Le interesa ver cómo queda armado?', 'presentarse por su tipo; posicionar Sacs como ejecución', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'consultor', 'mexico', 'aliados consultor 2', 2, 'dónde se cae su entrega', 'Le platico dónde vemos que se cae, por si le pasa.
[[el dolor de su cliente según el expediente, dicho en dos o tres líneas concretas]]
El plan estaba bien. Lo que falta es que alguien lo mida todos los días: un modelo son ocho o diez tallas por color, y eso no se sigue en una hoja que se actualiza una vez al mes.
Por eso el mismo cliente vuelve a llamarlo con el mismo problema dos temporadas después.
¿Le ha pasado que le pidan otra vez el mismo diagnóstico?', 'nombrar el dolor del cliente de ÉL', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'consultor', 'mexico', 'aliados consultor 3', 3, 'cómo queda armado', 'Le cuento cómo queda, para que vea si le acomoda.
Usted lo mete en su propuesta como parte de su servicio. Nosotros no le tocamos al cliente: usted da la cara, y si quiere ni aparecemos.
Gana por dos lados: comisión por la licencia mientras el cliente la pague, y sus horas de implementación y seguimiento, que dejan de terminar con el proyecto.
El diagnóstico inicial va gratis, para que lo use como entrada de su propia venta.
¿Le paso los números de la comisión?', 'la mecánica del consultor', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'consultor', 'mexico', 'aliados consultor 4', 4, 'y si el cliente no es de sistemas', 'Le adelanto la objeción que sale siempre: mis clientes no son de sistemas.
Casi ninguno lo es. Lo que hay que capturar es lo que ya cuentan a mano, y se captura una vez. De ahí en adelante el punto de venta lo alimenta solo.
Y si el cliente se atora, lo levantamos nosotros con usted enfrente, no por su cuenta.
Lo otro que preguntan: no hay que tirar lo que ya tienen. Se puede empezar por una tienda.
¿Con cuál de sus clientes lo probaría primero?', 'objeción de adopción', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'consultor', 'mexico', 'aliados consultor 5', 5, 'el método, aunque no trabajemos juntos', 'Le paso el método que usamos en el diagnóstico. Lo puede dar como parte de su servicio tal cual.
El cliente toma sus veinte modelos más vendidos y los baja a talla y color: existencia de hoy y venta de treinta días.
Faltante: cero existencia con venta arriba de cero. Sobrante: tres piezas sin una sola venta en el mes. El primero se traduce a venta perdida; el segundo, a pesos detenidos.
Eso es todo. La diferencia está en hacerlo cada semana, no una vez.
¿Se lo armo con los datos de un cliente suyo?', 'dar valor gratis', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'consultor', 'mexico', 'aliados consultor 6', 6, '1.2 millones en 50 modelos', 'Le pongo el ejemplo más claro que tengo.
En un cliente nuestro, cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Mercancía comprada, pagada y vendible: nada más que no estaba donde la pedían.
Cincuenta modelos, de miles que maneja.
En un cliente suyo los números son más chicos, pero la proporción es la misma, y ese hallazgo lo firma usted.
¿Lo probamos con uno?', 'la cifra', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'consultor', 'mexico', 'aliados consultor 7', 7, 'lo dejo hasta aquí', '[[si persona]]{{persona}}, [[/si]]lo dejo aquí y le digo por qué insistí.
Usted tiene el criterio, que es lo que no se compra. Lo que casi siempre falta del lado del cliente es la medición diaria, y ahí es donde se le queda el dinero y donde su trabajo deja de notarse.
Si algún día quiere que su entrega siga viva después del proyecto, el diagnóstico es gratis y la conversación toma quince minutos.
Gracias por leer.', 'cierre', 'texto', true);
insert into abm_pasos (cadencia_id, dia, orden, canal, automatico)
select c.id, d.dia, d.orden, 'email', true
  from abm_cadencias c,
       (values (1,1), (3,2), (7,3), (11,4), (16,5), (22,6), (30,7)) as d(dia, orden)
 where c.giro = 'aliados' and c.ruta = 'consultor';

-- ── Orquestador · negocio propio ──
insert into abm_cadencias (nombre, giro, ruta, region, activa)
values ('Orquestador · negocio propio', 'aliados', 'orquestador', 'mexico', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'orquestador', 'mexico', 'aliados orquestador 1', 1, 'un negocio propio sobre Sacs', '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} porque [[apertura del expediente: el gancho de su tipo, con SU clientela por nombre]].
Hacemos software de inventario y punto de venta para moda, y estamos armando la red de quienes lo operan en México. No busco que nos recomiende: busco que tenga un negocio propio encima.
Cómo se ve: nosotros lo certificamos —producto, IA, implementación—, lo acompañamos en sus primeras tiendas, y de ahí en adelante usted vende, implementa y opera. Cada retailer que opera con usted le deja ingreso recurrente mientras sea cliente.
No hace falta venir de la tecnología. Hace falta saber de retail, que es la parte que no enseñamos nosotros.
¿Le interesa que le cuente qué implica la certificación?', 'presentarse por su tipo; proponer certificación', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'orquestador', 'mexico', 'aliados orquestador 2', 2, 'por qué no basta con recomendar', 'Le platico por qué se lo propongo así y no como referido.
[[el dolor de su cliente según el expediente, dicho en dos o tres líneas concretas]]
Eso no se arregla con una recomendación: se arregla con alguien que entre, lo deje andando y se quede a operarlo. Ese trabajo hoy lo hace usted gratis o no lo hace nadie.
Cobrarlo una vez es un proyecto. Cobrarlo cada mes es un negocio.
¿Cuántas tiendas diría que podría operar el primer año?', 'el dolor del cliente y el límite de su modelo actual', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'orquestador', 'mexico', 'aliados orquestador 3', 3, 'qué es la certificación', 'Le cuento qué es, en concreto.
Capacitación en producto e inteligencia artificial, un examen y sus primeras implementaciones acompañadas por nosotros. No es un curso para colgar en la pared: es para que pueda pararse solo frente a una cadena.
Después, la relación con el retailer es suya. Usted cobra por operar y por sus servicios; nosotros le damos producto, soporte y las mejoras.
No hay cuota de entrada ni compra mínima de licencias.
¿Le mando el programa de la certificación?', 'la mecánica', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'orquestador', 'mexico', 'aliados orquestador 4', 4, 'y si no soy de tecnología', 'Le adelanto lo que más me preguntan: no vengo de sistemas.
La mayoría de los mejores no viene. Lo que no se puede enseñar rápido es entender una temporada, una curva de tallas y un pedido. El sistema se aprende en semanas; el retail, en años.
Y no arranca solo: las primeras implementaciones van con nosotros al lado, hasta que ya no nos necesite.
¿Quiere que le presente a alguien que ya está operando así?', 'objeción de perfil', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'orquestador', 'mexico', 'aliados orquestador 5', 5, 'el ejercicio con el que se abre una cuenta', 'Le dejo la herramienta con la que se abre casi cualquier cuenta, y sirve aunque nunca trabajemos juntos.
Pídale al retailer sus veinte modelos más vendidos, abiertos por talla y color, con existencia de hoy y venta de treinta días. En quince minutos sale cuánto trae parado y qué está dejando de vender.
Ese número es la reunión. Nadie discute su propio dinero detenido.
¿Se lo armo con los datos de una tienda que tenga a la mano?', 'dar valor gratis y herramienta de venta', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'orquestador', 'mexico', 'aliados orquestador 6', 6, '1.2 millones en 50 modelos', 'Le pongo el ejemplo más claro que tengo.
En un cliente nuestro, cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Comprado, pagado y vendible: nada más que no estaba donde lo pedían.
Cincuenta modelos, de miles.
Ese hallazgo es el que abre la puerta, y en su red lo firmaría usted.
¿Lo vemos en una llamada de quince minutos?', 'la cifra', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'orquestador', 'mexico', 'aliados orquestador 7', 7, 'aquí le paro', '[[si persona]]{{persona}}, [[/si]]aquí le paro, no le escribo más.
Le insistí porque en México hay muy pocos que entiendan retail de moda de verdad, y la parte técnica se aprende. Al revés no se puede.
Si algún día quiere dejar de cobrar por proyecto y empezar a cobrar por operar, aquí estamos. La certificación no se va a ningún lado.
Gracias por leer hasta aquí.', 'cierre', 'texto', true);
insert into abm_pasos (cadencia_id, dia, orden, canal, automatico)
select c.id, d.dia, d.orden, 'email', true
  from abm_cadencias c,
       (values (1,1), (3,2), (7,3), (11,4), (16,5), (22,6), (30,7)) as d(dia, orden)
 where c.giro = 'aliados' and c.ruta = 'orquestador';

-- ── Tecnología · integración por API y MCP ──
insert into abm_cadencias (nombre, giro, ruta, region, activa)
values ('Tecnología · integración por API y MCP', 'aliados', 'tecnologia', 'mexico', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'tecnologia', 'mexico', 'aliados tecnologia 1', 1, 'conectar lo suyo con Sacs', '[[si persona]]Hola {{persona}}. | [[/si]]Le escribo a {{nombre}} por una integración, no por una venta: [[apertura del expediente: el gancho de su tipo, con SU clientela por nombre]].
Hacemos software de inventario y punto de venta para moda. Tenemos API y servidor MCP abiertos, y la base de marcas y tiendas que operan con nosotros.
Lo que propongo es que lo suyo quede conectado: que el dato que hoy se queda en su lado llegue al inventario del retailer, y al revés. No hay comisión ni reventa de por medio: lo que gana es distribución en toda nuestra base y un caso que sus clientes le van a pedir.
¿Con quién de su lado se habla de integraciones?', 'presentarse por su tipo; proponer integración, no comisión', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'tecnologia', 'mexico', 'aliados tecnologia 2', 2, 'dónde se rompe hoy la cadena', 'Le platico dónde se rompe hoy, por si lo ven igual.
[[el dolor de su cliente según el expediente, dicho en dos o tres líneas concretas]]
En moda el problema es el detalle: un modelo son ocho o diez tallas por color, y casi todas las integraciones se quedan a nivel producto. Ahí es donde se sobrevende, se reenvía y se devuelve.
Nosotros llevamos el inventario a ese nivel, que es lo que hace que la integración sirva de algo.
¿Cómo resuelven hoy el nivel de talla y color?', 'el dolor del cliente de ÉL', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'tecnologia', 'mexico', 'aliados tecnologia 3', 3, 'cómo se ve la integración', 'Le cuento cómo se ve, en corto.
API REST documentada y un servidor MCP, que es lo que permite que un agente de IA consulte y escriba sin que nadie arme un conector a mano. Autenticación por cuenta del retailer, con su permiso.
Del lado comercial: entramos los dos al catálogo de integraciones, lo anunciamos a la base y su equipo tiene acceso a nuestro entorno de pruebas desde el primer día.
Tiempo típico de una integración así: semanas, no meses.
¿Le paso la documentación?', 'la mecánica técnica', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'tecnologia', 'mexico', 'aliados tecnologia 4', 4, 'y si no es prioridad este trimestre', 'Le adelanto lo que suele pasar: esto no está en el roadmap de este trimestre.
Se entiende. Le propongo algo que no consume roadmap: una prueba con un solo retailer, de los que ya operan con nosotros y ya usan lo suyo. Si no aporta, no se publica y no pasó nada.
Y si prefieren empezar por lectura nada más —que su lado consulte el inventario sin escribir—, con eso alcanza para ver si vale la pena.
¿Quiere que le proponga un candidato concreto?', 'objeción de roadmap', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'tecnologia', 'mexico', 'aliados tecnologia 5', 5, 'lo que veríamos juntos', 'Le dejo lo que podemos ver juntos sin integrar nada, porque le puede servir igual.
En nuestra base tenemos el comportamiento real de moda en México a nivel talla y color: qué se vende, qué se queda, cuánto se devuelve y por qué. Eso explica buena parte de lo que a usted le llega como reenvío, como sobreventa o como contracargo.
Se lo puedo mostrar agregado, sin datos de nadie, en una llamada.
¿Le interesa verlo?', 'dar valor gratis: el dato agregado', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'tecnologia', 'mexico', 'aliados tecnologia 6', 6, '1.2 millones en 50 modelos', 'Le pongo el ejemplo que mejor explica por qué el nivel de detalle importa.
En un cliente nuestro, cadena de moda, revisamos nada más 50 modelos y encontramos 1.2 millones de pesos mal repartidos entre el centro de distribución y las tiendas. Comprado, pagado y vendible: nada más que no estaba donde lo pedían.
A nivel producto ese inventario se veía correcto. El error solo aparece cuando se mira por talla y color.
Es exactamente el dato que una integración a medias no ve.
¿Lo revisamos en quince minutos?', 'la cifra', 'texto', true);
insert into abm_plantillas (giro, canal, ruta, region, nombre, orden, asunto, cuerpo, objetivo, formato, activa)
values ('aliados', 'email', 'tecnologia', 'mexico', 'aliados tecnologia 7', 7, 'lo dejo hasta aquí', '[[si persona]]{{persona}}, [[/si]]lo dejo aquí y no insisto más.
Le escribí porque lo suyo ya está en la operación del retailer y nosotros tenemos la parte que le falta al dato: el nivel de talla y color. Conectarlo es de semanas y no le cuesta.
Si algún día abren ventana para integraciones, la API y el MCP siguen ahí, documentados.
Gracias por leer.', 'cierre', 'texto', true);
insert into abm_pasos (cadencia_id, dia, orden, canal, automatico)
select c.id, d.dia, d.orden, 'email', true
  from abm_cadencias c,
       (values (1,1), (3,2), (7,3), (11,4), (16,5), (22,6), (30,7)) as d(dia, orden)
 where c.giro = 'aliados' and c.ruta = 'tecnologia';

-- 2 · Cada aliado a la ruta de SU perfil. El mapa sale de `abm-aliados.ts`:
--     los subgiros nuevos ya son la clave del tipo; los doce viejos entran por
--     el nombre con el que se cargaron en su día.
update abm_cuentas set ruta = m.perfil
  from (values
    ('consultora_moda','orquestador'), ('Firma','orquestador'),
    ('consultora_retail','orquestador'),
    ('consultor_inventario','consultor'), ('Consultora independiente','consultor'),
    ('visual_merchandiser','consultor'),
    ('escuela_moda','referidor'), ('Escuela','referidor'),
    ('comunidad','referidor'), ('Comunidad','referidor'),
    ('taller','referidor'), ('bordado','referidor'), ('patronista','referidor'),
    ('contador','referidor'), ('fotografia','referidor'),
    ('insumos_tienda','referidor'), ('Proveedores de boutiques','referidor'),
    ('agencia_marketing','consultor'),
    ('camara','referidor'), ('Cámaras y asociaciones','referidor'),
    ('feria','referidor'), ('Ferias y expos','referidor'),
    ('plaza','referidor'), ('Plazas y mayoristas de ropa','referidor'),
    ('showroom','referidor'), ('Showrooms','referidor'),
    ('mayorista','referidor'), ('Mayoristas de calzado','referidor'),
    ('plataforma_b2b','tecnologia'), ('Plataformas B2B','tecnologia'),
    ('creador','referidor'), ('Creadora','referidor'),
    ('medio','referidor'),
    ('pagos','tecnologia'), ('logistica','tecnologia'), ('ecommerce','tecnologia'),
    ('marketplace','tecnologia'), ('hardware','tecnologia'), ('datos_ia','tecnologia')
  ) as m(subgiro, perfil)
 where abm_cuentas.giro = 'aliados' and abm_cuentas.subgiro = m.subgiro;

commit;

-- Comprobación
select c.ruta, c.nombre, (select count(*) from abm_pasos p where p.cadencia_id = c.id) pasos,
       (select count(*) from abm_plantillas t where t.giro='aliados' and t.ruta=c.ruta) plantillas,
       (select count(*) from abm_cuentas a where a.giro='aliados' and a.ruta=c.ruta) cuentas
  from abm_cadencias c where c.giro='aliados' order by c.ruta;
