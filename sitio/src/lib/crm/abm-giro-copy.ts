// ══ Lo que se le dice a cada giro, en un solo lugar ══════════════════════════
//
// Una fila por giro alimenta TRES cosas: el correo 0 de presentación, los tres
// mensajes de WhatsApp en frío y los asuntos. Antes el texto del giro vivía
// repartido entre 310 plantillas de correo y un módulo aparte de WhatsApp, así
// que arreglar una frase obligaba a buscarla en dos lugares y casi siempre se
// arreglaba en uno solo.
//
// CÓMO SE ESCRIBE CADA CAMPO
// El manual (§7.7) pide que el mensaje NO sirva para otro negocio. Eso no se
// logra metiendo {{nombre}}: se logra aquí, en `dolor` y `funciones`. La prueba
// es simple — si cambias el giro y el párrafo sigue leyéndose bien, está mal
// escrito.
//
//   plural     cómo se nombra al conjunto: "las casas de novia"
//   singular   para "una suite hecha para X"
//   quiebre    POR QUÉ el punto de venta genérico no alcanza EN ESE GIRO.
//              Es la bisagra del correo y la frase que más trabajo cuesta.
//   funciones  seis, concretas, en el vocabulario del ramo. Nada de
//              "gestión de inventario": "la corrida completa por número".
//   dolorWa    el quiebre en UNA frase, para WhatsApp
//   solucion   cómo se resuelve, distinto de `funciones` (el paso 2 de
//              WhatsApp no puede repetir el paso 1)
//   pesa       qué les pesa hoy, para el cierre
//   suyo       el objeto del negocio: "sus modelos", "sus corridas"
//   cierre     la pregunta final del correo 0
export type CopyGiro = {
  plural: string; singular: string; quiebre: string; funciones: string[];
  dolorWa: string; solucion: string; pesa: string; suyo: string; cierre: string;
};

export const COPY: Record<string, CopyGiro> = {
  novias: {
    plural: 'las casas de novia', singular: 'casas de novias y fiesta',
    quiebre: 'En una casa de novias eso no alcanza, porque la venta no termina en la caja: termina en una fecha.',
    funciones: [
      'Reserva con fecha del evento y abonos, con el saldo al día. Se acabó el recibo en una servilleta.',
      'La muestra marcada aparte de los pedidos, para que no se venda la única talla 6 que tenía en tienda.',
      'Taller con órdenes de servicio y fechas: qué vestido entra primero y desde cuándo está ahí.',
      'Pruebas y entregas con fecha, no de memoria. Nadie vuelve a preguntar si era el 25 o el 29.',
      'El pedido al proveedor con su tiempo de entrega, para saber si ese modelo en esa talla llega antes de la boda.',
      'Un catálogo que sirve igual en tienda, en WhatsApp y en redes, con el mismo inventario detrás.',
    ],
    dolorWa: 'todo cuelga de una fecha: el vestido que se pide al proveedor, las pruebas, el anticipo y la liquidación. Si una se recorre, se recorren todas.',
    solucion: 'cada novia con su fecha, sus abonos y sus pruebas en un solo lugar, y el sistema avisando antes, no cuando ya se pasó.',
    pesa: 'llevar las reservas, las pruebas y los abonos en libreta',
    suyo: 'sus modelos', cierre: '¿Se lo muestro, o le envío primero cómo se ve por dentro la ficha de una novia?',
  },

  zapaterias: {
    plural: 'las zapaterías', singular: 'zapaterías',
    quiebre: 'En una zapatería eso no alcanza, porque usted no vende modelos: vende números. Y el sistema que cuenta pares sin saber de qué número son, no cuenta nada.',
    funciones: [
      'Inventario por número, no por modelo. Saber que hay catorce pares no sirve si los siete del 25 ya se fueron.',
      'La corrida completa a la vista: qué números se agotan primero y cuáles se quedan en los extremos temporada tras temporada.',
      'Traslado entre sucursales desde el mostrador, sin hablarle a la otra tienda para preguntar si lo tienen.',
      'Apartado con abonos para el par que se pidió y todavía no llega.',
      'El pedido al proveedor por corrida, con su tiempo de entrega, para no volver a quedarse sin los números que sí se venden.',
      'Un catálogo con existencias reales por número, igual en tienda que en WhatsApp.',
    ],
    dolorWa: 'el modelo que el cliente quiere sí está, pero no en su número — y esa venta se va a la tienda de enfrente.',
    solucion: 'ver el número exacto que hay en cada sucursal desde el mostrador, y trasladarlo sin llamar a nadie.',
    pesa: 'perder ventas por un número que sí estaba, pero en otra sucursal',
    suyo: 'sus corridas', cierre: '¿Se lo muestro, o le paso primero cómo se ve el inventario por número?',
  },

  boutiques: {
    plural: 'las boutiques', singular: 'boutiques de moda',
    quiebre: 'En una boutique eso no alcanza, porque su inventario no son piezas: son combinaciones de talla y color, y cada una se vende distinto.',
    funciones: [
      'Inventario por talla y color, con la matriz completa a la vista.',
      'Qué combinación se vende sola y cuál lleva meses colgada, con el dinero que representa cada una.',
      'Apartado con abonos, que en boutique es la mitad de la venta de temporada.',
      'El catálogo en línea con el mismo inventario de la tienda, para no vender lo que ya no está.',
      'Traslado entre sucursales sin llamadas, cuando un cliente quiere la talla que está en la otra tienda.',
      'Cierre de caja y comisión de la vendedora, calculadas solas.',
    ],
    dolorWa: 'el inventario no son piezas sino tallas y colores, y el sistema genérico los cuenta a todos como si fueran lo mismo.',
    solucion: 'la matriz de talla y color a la vista, con el dinero que trae parado cada combinación.',
    pesa: 'no saber qué tallas y colores son los que de verdad se venden',
    suyo: 'sus modelos', cierre: '¿Se lo muestro, o le paso primero cómo se ve la matriz de tallas?',
  },

  joyeria: {
    plural: 'las joyerías', singular: 'joyerías',
    quiebre: 'En una joyería eso no alcanza, porque cada pieza vale distinto y un inventario que cuenta bultos no dice cuánto dinero tiene usted en la vitrina.',
    funciones: [
      'Inventario pieza por pieza, con su costo real y su margen.',
      'Qué piezas llevan meses sin moverse y cuánto dinero representan.',
      'Apartado con abonos, que en joyería es la forma normal de comprar.',
      'Control de lo que sale a consignación y de lo que entra a taller, con quién lo tiene y desde cuándo.',
      'Reparaciones con su orden de servicio y su fecha de entrega.',
      'Cierre de caja con el detalle por pieza, no por montón.',
    ],
    dolorWa: 'cada pieza vale distinto y el inventario por montón no dice cuánto dinero hay parado ni dónde.',
    solucion: 'saber de cada pieza cuánto costó, cuánto lleva ahí y quién la tiene, sin abrir la vitrina.',
    pesa: 'no saber qué piezas llevan meses sin moverse',
    suyo: 'sus piezas', cierre: '¿Se lo muestro, o le paso primero cómo se ve el inventario por pieza?',
  },

  renta: {
    plural: 'las casas de renta de vestidos y trajes', singular: 'renta de vestidos y trajes',
    quiebre: 'En renta eso no alcanza, porque la prenda no se vende: se va y regresa. Y un sistema que solo descuenta del inventario no sabe cuándo vuelve.',
    funciones: [
      'Calendario por prenda, con su fecha de salida y de regreso. Nada se aparta dos veces el mismo fin de semana.',
      'Depósito y abonos, con el saldo al día y quién debe qué.',
      'El estado de cada pieza al volver: qué entró a lavandería, qué a compostura y qué ya no sirve.',
      'Pruebas y ajustes con fecha, no de memoria.',
      'Cuántas veces salió cada prenda y cuánto ha dejado, para saber cuál conviene reponer.',
      'Un catálogo con lo que está libre en esa fecha, no con lo que existe.',
    ],
    dolorWa: 'una prenda rentada dos veces el mismo fin de semana se descubre el día del evento, cuando ya no hay cómo arreglarlo.',
    solucion: 'el calendario de cada prenda a la vista, para que no se aparte dos veces la misma fecha.',
    pesa: 'llevar el calendario de las prendas en una libreta',
    suyo: 'sus prendas', cierre: '¿Se lo muestro, o le paso primero cómo se ve el calendario de una prenda?',
  },

  western: {
    plural: 'las tiendas de botas y ropa vaquera', singular: 'botas y ropa western',
    quiebre: 'En botas eso no alcanza, porque una bota no es un modelo: es horma, número y material, y el cliente que quiere la suya no acepta otra.',
    funciones: [
      'Inventario por horma, número y material, no solo por modelo.',
      'La corrida completa a la vista, con los números que se agotan primero.',
      'Pedido al proveedor por corrida y por horma, con su tiempo de entrega.',
      'Apartado con abonos para la bota que se mandó pedir.',
      'Traslado entre sucursales desde el mostrador.',
      'Qué se vende en temporada de feria y qué se queda, con el dinero de cada uno.',
    ],
    dolorWa: 'la bota que el cliente quiere está, pero no en su número ni en esa horma — y esa venta no espera.',
    solucion: 'ver horma y número exactos en cada sucursal desde el mostrador, y pedir la corrida completa a tiempo.',
    pesa: 'quedarse sin los números que sí se venden justo en temporada',
    suyo: 'sus corridas', cierre: '¿Se lo muestro, o le paso primero cómo se ve el inventario por horma y número?',
  },

  telas: {
    plural: 'las tiendas de telas y mercería', singular: 'telas y mercería',
    quiebre: 'En telas eso no alcanza, porque usted no vende piezas: vende metros, y un sistema que cuenta unidades no sabe cuánto le queda en el rollo.',
    funciones: [
      'Inventario por metro y por rollo, con lo que queda de cada uno.',
      'Venta por metro, por corte y por pieza completa, con su precio distinto.',
      'Qué telas se mueven por temporada y cuáles llevan el año en el anaquel.',
      'Pedido al proveedor por rollo, con su tiempo de entrega.',
      'Mercería con miles de claves chicas, sin que el inventario se vuelva imposible.',
      'Cierre de caja y comisión, calculadas solas.',
    ],
    dolorWa: 'el sistema cuenta piezas y usted vende metros: nunca cuadra lo que queda en el rollo con lo que dice la pantalla.',
    solucion: 'saber cuánto queda de cada rollo en metros, y que el corte descuente lo que de verdad salió.',
    pesa: 'no saber cuánta tela queda de verdad en cada rollo',
    suyo: 'sus rollos', cierre: '¿Se lo muestro, o le paso primero cómo se ve el inventario por metro?',
  },

  tallas: {
    plural: 'las tiendas de ropa de bebé, maternidad y tallas extra', singular: 'ropa de bebé, maternidad y tallas extra',
    quiebre: 'En este giro eso no alcanza, porque la talla lo es todo: el cliente que no encuentra la suya no compra otra cosa, se va.',
    funciones: [
      'Inventario por talla y edad, con la curva completa a la vista.',
      'Qué tallas se agotan primero y cuáles se quedan, temporada tras temporada.',
      'Pedido al proveedor por curva de tallas, no por bulto.',
      'Apartado con abonos para la prenda que se mandó pedir.',
      'Traslado entre sucursales cuando la talla está en la otra tienda.',
      'Catálogo con existencias reales por talla, igual en tienda que en WhatsApp.',
    ],
    dolorWa: 'el cliente que no encuentra su talla no compra otra cosa: se va, y casi nunca vuelve.',
    solucion: 'ver la curva de tallas completa y pedir al proveedor por curva, no por bulto.',
    pesa: 'quedarse sin las tallas que sí se venden',
    suyo: 'sus curvas de tallas', cierre: '¿Se lo muestro, o le paso primero cómo se ve la curva de tallas?',
  },

  deportiva: {
    plural: 'las tiendas de ropa deportiva y uniformes', singular: 'ropa deportiva y uniformes',
    quiebre: 'En deportiva eso no alcanza, porque la mitad de su venta no está en el mostrador: está en un pedido de equipo, con tallas, nombres y números.',
    funciones: [
      'Pedidos de equipo con su lista de tallas, nombres y números, y su fecha de entrega.',
      'Anticipo y saldo del pedido, con quién debe qué.',
      'Inventario por talla y color de lo que sí está en piso.',
      'Órdenes de estampado y bordado con su fecha, para saber qué entra primero.',
      'Pedido al proveedor con su tiempo de entrega, para comprometer fechas que sí se cumplen.',
      'Catálogo con existencias reales, igual en tienda que en WhatsApp.',
    ],
    dolorWa: 'un pedido de equipo son treinta tallas con nombre y número, y eso en una libreta se cae solo.',
    solucion: 'el pedido completo con sus tallas, sus nombres, su anticipo y su fecha, en un solo lugar.',
    pesa: 'llevar los pedidos de equipo en libreta o en un grupo de WhatsApp',
    suyo: 'sus pedidos de equipo', cierre: '¿Se lo muestro, o le paso primero cómo se ve un pedido de equipo por dentro?',
  },

  scrubs: {
    plural: 'las tiendas de uniformes médicos', singular: 'uniformes médicos',
    quiebre: 'En uniformes eso no alcanza, porque su venta grande no es de mostrador: es un pedido de hospital o de escuela, con tallas, bordados y una fecha que no se mueve.',
    funciones: [
      'Pedidos institucionales con su lista de tallas y su fecha de entrega.',
      'Bordado y personalización con su orden de servicio, para saber qué entra primero.',
      'Anticipo y saldo, con quién debe qué.',
      'Inventario por talla y color de lo que está en piso.',
      'Pedido al proveedor con su tiempo de entrega, para comprometer fechas que sí se cumplen.',
      'Facturación al hospital o a la escuela, sin rehacer la captura.',
    ],
    dolorWa: 'un pedido de hospital son cientos de piezas con talla y bordado, y una fecha que no se mueve.',
    solucion: 'el pedido completo con sus tallas, su bordado, su anticipo y su fecha, sin libreta de por medio.',
    pesa: 'llevar los pedidos institucionales fuera del sistema',
    suyo: 'sus pedidos', cierre: '¿Se lo muestro, o le paso primero cómo se ve un pedido institucional por dentro?',
  },

  vintage: {
    plural: 'las tiendas de ropa de segunda mano y vintage', singular: 'ropa vintage y de segunda mano',
    quiebre: 'En segunda mano eso no alcanza, porque cada prenda es única: no hay dos iguales, no hay corrida y no hay reposición.',
    funciones: [
      'Inventario por pieza única, con su foto, su costo y su precio.',
      'De qué lote o paca salió cada prenda, para saber qué lote deja dinero y cuál no.',
      'Qué lleva meses colgado y cuánto representa en dinero parado.',
      'Apartado con abonos para la pieza que se separó.',
      'Catálogo en línea con la pieza única, que se baja sola al venderse.',
      'Cierre de caja con el margen real por prenda.',
    ],
    dolorWa: 'cada prenda es única: no hay dos iguales ni forma de reponerla, y el sistema genérico las cuenta como si fueran lo mismo.',
    solucion: 'cada pieza con su foto, su costo y su lote, y el catálogo que la baja sola al venderse.',
    pesa: 'no saber qué paca dejó dinero y cuál no',
    suyo: 'sus piezas', cierre: '¿Se lo muestro, o le paso primero cómo se ve el control por pieza única?',
  },

  disfraces: {
    plural: 'las tiendas de disfraces', singular: 'disfraces y renta de trajes',
    quiebre: 'En disfraces eso no alcanza, porque se vende y se renta al mismo tiempo, y el pico de temporada decide el año entero.',
    funciones: [
      'Venta y renta en el mismo sistema, cada una con sus reglas.',
      'Calendario de lo rentado, con fecha de salida y de regreso.',
      'Depósito en garantía y su devolución, con quién debe qué.',
      'Inventario por talla y personaje de lo que está libre en esa fecha.',
      'El estado de la prenda al volver: qué entra a lavandería y qué a compostura.',
      'Qué se movió en temporada y qué no, para preparar la siguiente.',
    ],
    dolorWa: 'se vende y se renta al mismo tiempo, y en temporada el mostrador no da para llevar las dos cosas en papel.',
    solucion: 'venta y renta en el mismo lugar, con el calendario de lo que está libre en cada fecha.',
    pesa: 'llevar las rentas de temporada en libreta',
    suyo: 'sus disfraces', cierre: '¿Se lo muestro, o le paso primero cómo se ve el calendario de renta?',
  },

  sublimado: {
    plural: 'los talleres de playeras personalizadas y sublimado', singular: 'personalización y sublimado',
    quiebre: 'En personalización eso no alcanza, porque usted no vende inventario: vende trabajo con fecha de entrega, y lo que se atora es el taller, no la caja.',
    funciones: [
      'Órdenes de trabajo con su arte, sus tallas y su fecha de entrega.',
      'En qué paso va cada orden: diseño, impresión, prensa, entrega.',
      'Anticipo y saldo por orden, con quién debe qué.',
      'Inventario de playeras y blancos por talla y color.',
      'Qué órdenes están por vencerse, antes de que el cliente llame.',
      'Cotización y factura sin recapturar lo mismo tres veces.',
    ],
    dolorWa: 'lo que se atora no es la caja, es el taller: saber en qué paso va cada orden y cuál se vence mañana.',
    solucion: 'cada orden con su arte, sus tallas, su paso y su fecha, y el aviso antes de que se venza.',
    pesa: 'llevar las órdenes del taller en libreta o en WhatsApp',
    suyo: 'sus órdenes', cierre: '¿Se lo muestro, o le paso primero cómo se ve una orden de taller por dentro?',
  },

  jeans: {
    plural: 'las tiendas de jeans y mezclilla', singular: 'jeans y mezclilla',
    quiebre: 'En mezclilla eso no alcanza, porque una talla 30 no es una talla 30: es corte, largo y lavado, y el cliente que encuentra el suyo vuelve por el mismo.',
    funciones: [
      'Inventario por talla, corte y largo, no solo por modelo.',
      'Qué combinación se vende sola y cuál lleva meses en el anaquel.',
      'Pedido al proveedor por curva de tallas, con su tiempo de entrega.',
      'Traslado entre sucursales cuando el corte está en la otra tienda.',
      'Apartado con abonos para lo que se mandó pedir.',
      'Catálogo con existencias reales por talla y corte.',
    ],
    dolorWa: 'una talla 30 no es una talla 30: es corte, largo y lavado, y el sistema genérico los cuenta a todos igual.',
    solucion: 'ver talla, corte y largo exactos en cada sucursal, y pedir al proveedor por curva.',
    pesa: 'no saber qué cortes y largos son los que de verdad se venden',
    suyo: 'sus cortes', cierre: '¿Se lo muestro, o le paso primero cómo se ve el inventario por corte y largo?',
  },

  trajesbano: {
    plural: 'las tiendas de trajes de baño y ropa de playa', singular: 'trajes de baño y ropa de playa',
    quiebre: 'En trajes de baño eso no alcanza, porque su año entero se juega en temporada, y lo que no se vendió en agosto ya no se vende.',
    funciones: [
      'Inventario por talla y color, con la curva completa a la vista.',
      'Qué se movió la temporada pasada y qué se quedó, para comprar mejor esta.',
      'Pedido al proveedor con su tiempo de entrega, para llegar antes de la temporada y no durante.',
      'Traslado entre sucursales, que en plaza turística cambia de un día a otro.',
      'Catálogo con existencias reales, igual en tienda que en WhatsApp.',
      'Cierre de caja y comisión, calculadas solas.',
    ],
    dolorWa: 'el año se juega en temporada, y lo que no se vendió en agosto se queda un año entero.',
    solucion: 'saber qué se movió la temporada pasada y comprar esta con ese dato, no de memoria.',
    pesa: 'comprar la temporada sin saber qué se quedó la pasada',
    suyo: 'su temporada', cierre: '¿Se lo muestro, o le paso primero cómo se ve el comparativo de temporada?',
  },

  charro: {
    plural: 'las tiendas de trajes de charro y ropa de danza', singular: 'trajes de charro y danza',
    quiebre: 'En charro y danza eso no alcanza, porque casi todo es a la medida y con fecha: el traje se hace para una persona y para un día.',
    funciones: [
      'Pedidos a la medida con sus medidas, su fecha de prueba y su fecha de entrega.',
      'Taller con órdenes de servicio: qué entra primero y desde cuándo está ahí.',
      'Anticipo y saldo por pedido, con quién debe qué.',
      'Pedidos de grupo —un ballet completo— con la lista de medidas de cada integrante.',
      'Inventario de lo que sí está hecho y listo para llevar.',
      'El pedido al proveedor de material con su tiempo de entrega.',
    ],
    dolorWa: 'casi todo es a la medida y con fecha, y un ballet completo son treinta juegos de medidas que no caben en una libreta.',
    solucion: 'cada pedido con sus medidas, su prueba y su entrega, y el grupo completo en una sola ficha.',
    pesa: 'llevar las medidas y las fechas del taller en papel',
    suyo: 'sus pedidos a la medida', cierre: '¿Se lo muestro, o le paso primero cómo se ve un pedido de grupo por dentro?',
  },

  relojerias: {
    plural: 'las relojerías', singular: 'relojerías',
    quiebre: 'En relojería eso no alcanza, porque la mitad del negocio no es la venta: es el taller, con piezas ajenas, garantías y fechas.',
    funciones: [
      'Inventario pieza por pieza, con su costo real y su margen.',
      'Órdenes de servicio del taller: qué reloj de quién, desde cuándo y para cuándo.',
      'Garantías con su vigencia, para no discutirlas de memoria.',
      'Apartado con abonos, que en relojería es la forma normal de comprar.',
      'Qué piezas llevan meses sin moverse y cuánto dinero representan.',
      'Cierre de caja con el detalle por pieza.',
    ],
    dolorWa: 'la mitad del negocio es el taller: piezas ajenas, garantías y fechas que no se pueden llevar de memoria.',
    solucion: 'cada orden de taller con su dueño, su fecha y su garantía, junto al inventario por pieza.',
    pesa: 'llevar las órdenes del taller y las garantías en papel',
    suyo: 'sus piezas', cierre: '¿Se lo muestro, o le paso primero cómo se ve una orden de taller?',
  },

  outlets: {
    plural: 'los outlets y tiendas de saldos', singular: 'outlets y saldos',
    quiebre: 'En saldos eso no alcanza, porque usted compra por lote y vende por pieza, y lo único que importa es cuánto dejó cada lote.',
    funciones: [
      'Costo por lote repartido entre las piezas, para saber el margen real de cada una.',
      'Qué lote se movió y cuál sigue ahí, con el dinero de cada uno.',
      'Precios por etapa de liquidación, sin recapturar la tienda entera.',
      'Inventario por talla de lo que queda del lote.',
      'Traslado entre sucursales, que en saldos cambia todas las semanas.',
      'Cierre de caja con el margen por lote, no por montón.',
    ],
    dolorWa: 'se compra por lote y se vende por pieza: sin repartir el costo, nadie sabe qué lote dejó dinero.',
    solucion: 'el costo del lote repartido entre sus piezas, y el margen real de cada una a la vista.',
    pesa: 'no saber qué lote dejó dinero y cuál no',
    suyo: 'sus lotes', cierre: '¿Se lo muestro, o le paso primero cómo se ve el margen por lote?',
  },

  distribuidores: {
    plural: 'los distribuidores de ropa', singular: 'distribución de ropa',
    quiebre: 'En distribución eso no alcanza, porque usted no le vende al público: le vende a tiendas, con precio por cliente, crédito y una lista de pedidos que cambia todos los días.',
    funciones: [
      'Lista de precios por cliente, sin recapturarla en cada pedido.',
      'Crédito y saldo por cliente, con quién debe qué y desde cuándo.',
      'Pedidos por tienda con su curva de tallas y su fecha de surtido.',
      'Inventario por talla y color de lo que de verdad hay para surtir.',
      'Qué cliente compra qué y cada cuánto, para saber a quién llamar.',
      'Facturación sin rehacer la captura.',
    ],
    dolorWa: 'cada tienda tiene su precio y su crédito, y eso en hojas de cálculo se cae en cuanto crece.',
    solucion: 'la lista de precios y el crédito por cliente dentro del sistema, y el pedido armado en minutos.',
    pesa: 'llevar precios y créditos por cliente en hojas de cálculo',
    suyo: 'sus clientes', cierre: '¿Se lo muestro, o le paso primero cómo se ve un pedido de tienda por dentro?',
  },

  fabricantes: {
    plural: 'los fabricantes de ropa', singular: 'fabricación de ropa',
    quiebre: 'En fábrica eso no alcanza, porque entre la tela y la prenda hay corte, maquila y proceso, y ahí es donde se pierde el dinero que nadie ve.',
    funciones: [
      'Órdenes de producción con su corte, su maquilero y su fecha.',
      'Qué salió a maquila, con quién está y cuándo vuelve.',
      'Consumo de tela por prenda, para saber el costo real y no el estimado.',
      'Inventario en tres momentos: materia prima, proceso y producto terminado.',
      'Pedidos de clientes con su curva de tallas y su fecha comprometida.',
      'Costo real por prenda, con tela, maquila y avíos adentro.',
    ],
    dolorWa: 'entre la tela y la prenda hay corte y maquila, y ahí se pierde el costo real que nadie alcanza a medir.',
    solucion: 'la orden de producción con su corte, su maquilero y su consumo de tela, y el costo real por prenda.',
    pesa: 'no saber el costo real de cada prenda con la maquila adentro',
    suyo: 'su producción', cierre: '¿Se lo muestro, o le paso primero cómo se ve una orden de producción?',
  },

  mayoristas: {
    plural: 'los proveedores mayoristas y multimarca', singular: 'venta por mayoreo',
    quiebre: 'En mayoreo eso no alcanza, porque usted vende por bulto y por docena, con precio por cliente y crédito — nada de eso cabe en un punto de venta de mostrador.',
    funciones: [
      'Venta por pieza, docena y bulto, cada una con su precio.',
      'Lista de precios por cliente, sin recapturarla en cada pedido.',
      'Crédito y saldo por cliente, con quién debe qué y desde cuándo.',
      'Pedidos con su curva de tallas y su fecha de surtido.',
      'Inventario por talla y color de lo que de verdad hay para surtir.',
      'Facturación sin rehacer la captura.',
    ],
    dolorWa: 'se vende por bulto y por docena, con precio por cliente y crédito: nada de eso cabe en un punto de venta de mostrador.',
    solucion: 'precio por cliente, crédito y venta por bulto dentro del mismo sistema.',
    pesa: 'llevar precios y créditos de mayoreo en hojas de cálculo',
    suyo: 'sus clientes', cierre: '¿Se lo muestro, o le paso primero cómo se ve un pedido de mayoreo por dentro?',
  },

  calzado: {
    plural: 'los fabricantes y marcas de calzado', singular: 'fabricación de calzado',
    quiebre: 'En calzado eso no alcanza, porque entre la piel y el par hay horma, corte y pespunte, y el costo real se arma pieza por pieza.',
    funciones: [
      'Órdenes de producción por horma y corrida, con su fecha.',
      'Qué salió a maquila, con quién está y cuándo vuelve.',
      'Consumo de piel y suela por par, para saber el costo real.',
      'Inventario en materia prima, proceso y producto terminado.',
      'Pedidos de clientes por corrida completa, con su fecha comprometida.',
      'Costo real por par, con piel, suela, maquila y avíos adentro.',
    ],
    dolorWa: 'entre la piel y el par hay horma, corte y pespunte, y el costo real se arma pieza por pieza.',
    solucion: 'la orden por horma y corrida, con su consumo de piel y su maquila, y el costo real por par.',
    pesa: 'no saber el costo real de cada par con la maquila adentro',
    suyo: 'sus corridas', cierre: '¿Se lo muestro, o le paso primero cómo se ve una orden por horma?',
  },

  cadenas: {
    plural: 'las cadenas de tiendas de moda', singular: 'cadenas de moda',
    quiebre: 'En una cadena eso no alcanza, porque el problema no es vender: es que la prenda está en la tienda equivocada y nadie se entera hasta el corte de temporada.',
    funciones: [
      'Inventario por sucursal, con la matriz de talla y color en cada una.',
      'Traslados entre tiendas sugeridos por lo que de verdad se vende en cada plaza.',
      'Qué combinación se vende en una tienda y se queda parada en otra.',
      'Cierre de caja y comisión por sucursal y por vendedora.',
      'Compras por curva de tallas con el histórico de cada plaza detrás.',
      'El mismo inventario detrás de la tienda en línea y del mostrador.',
    ],
    dolorWa: 'la prenda está en la tienda equivocada y nadie se entera hasta el corte de temporada.',
    solucion: 'ver la matriz de talla y color por sucursal, y que el sistema sugiera el traslado antes de que se pierda la venta.',
    pesa: 'descubrir al cierre de temporada que el inventario estaba mal repartido',
    suyo: 'sus sucursales', cierre: '¿Se lo muestro, o le paso primero cómo se ve el inventario por sucursal?',
  },

  canal: {
    plural: 'las plazas y corredores de mayoreo', singular: 'locales de plaza y mayoreo',
    quiebre: 'En plaza eso no alcanza, porque se vende por bulto, se fía de palabra y el local trabaja a un ritmo que no espera a que alguien capture nada.',
    funciones: [
      'Venta por pieza, docena y bulto, cada una con su precio.',
      'Crédito y saldo por cliente, con quién debe qué y desde cuándo.',
      'Cobro rápido en mostrador, sin trabar la fila en temporada.',
      'Inventario por talla y color de lo que hay para surtir hoy.',
      'Qué cliente compra qué y cada cuánto, para saber a quién llamar.',
      'Corte de caja del local, cuadrado al cerrar.',
    ],
    dolorWa: 'se vende por bulto y se fía de palabra, y al final de la temporada nadie sabe quién debe qué.',
    solucion: 'el crédito por cliente y la venta por bulto dentro del sistema, sin trabar el mostrador.',
    pesa: 'llevar lo fiado en una libreta',
    suyo: 'sus clientes', cierre: '¿Se lo muestro, o le paso primero cómo se ve el control de lo fiado?',
  },
};

export const GIROS_CON_COPY = Object.keys(COPY);
