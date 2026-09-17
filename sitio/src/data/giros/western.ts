/**
 * Contenido de la landing WESTERN Y VAQUERO (17-sep-2026).
 *
 * Sale de la ficha del oficio (scratchpad/giros-fichas/western.md) con el dictamen del referee de
 * oficio aplicado: el bloque propio NO es la corrida (eso ya lo cuenta zapatería) sino EL CONJUNTO:
 * bota por número, texana por talla, cinto por medida, camisa por talla y pantalón por cintura y
 * largo, cinco tallas en un solo ticket. Palabras del piso: el par, la horma, la punta rodeo o
 * picuda, la texana y sus X, el cinto piteado, el paisano, la carpa de la feria, las orillas.
 * No se dice "tribal" (moda de 2010), ni "extra ancho" (es horma normal u horma ancha), ni
 * "capital dormido" (es dinero parado).
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran como
 * parte del sistema; se construyen si el cliente las pide): conjunto sugerido en el ticket, tallas
 * favoritas del cliente en el CRM, número mexicano/americano en la ficha, pedido especial al taller
 * con etapas y aviso, recepción parcial de corridas con nombre, reporte de orillas, servicios de
 * taller en el ticket, lista de espera por número, tipo de cambio automático en caja, venta por live
 * de Facebook, devolución a fábrica con nota de crédito, mayoreo desde tienda.
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista } from './_mocks';

const IMG = '/images/giros/western';

export const bannerWS = {
  eyebrow: 'SACS · Western y vaquero',
  titulo: 'La bota por número. La texana por talla.',
  resalte: 'El cinto por medida. Un solo ticket.',
  sub: 'Corridas por número con medios números y horma ancha, texanas por talla y X, cintos por medida, apartados que no se pierden en diciembre y la carpa de la feria cobrando sin internet — con el mismo inventario para tus tiendas, tu WhatsApp y tu tienda en línea.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Tienda western moderna en León: pared de botas, texanas en el anaquel y la corrida por número en la tablet del mostrador',
  avisos: [
    { modulo: 'Hay en otra tienda', texto: 'Bota rodeo chocolate 27 · 0 aquí · 3 en la del centro · llega el jueves', pos: 1 as const, tono: 'azul' as const, sello: 'Ahora' },
    { modulo: 'Apartado por vencer', texto: 'Graduación · bota + texana 7 1/8 · saldo $2,400 · vence el viernes', pos: 2 as const, tono: 'ambar' as const, sello: 'Mayo' },
    { modulo: 'Corrida rota', texto: 'Picuda negra: sin 26, 27 ni 28 · quedan 25 y 30', pos: 3 as const, tono: 'rojo' as const, sello: 'Hoy' },
  ],
};

export const manifiestoWS = {
  intro: 'Sabemos cómo se vende lo vaquero',
  frases: [
    'Tienes el modelo pero no el número: el <b>27</b> se acabó aquí y en la de allá hay tres pares parados.',
    'De cada corrida se te quedan el <b>25 y el 30</b>, y ya llevas tres años juntando orillas.',
    'Los apartados van en una <b>libreta</b>; cada diciembre se pierde un anticipo o dos clientes se pelean el mismo par.',
    'Mandaste hacer la bota al <b>taller</b>, se te pasó avisarle, llegó tres semanas después y ya no la quiso.',
    'A las once de la noche te escriben “¿hay en <b>26 punta rodeo</b>?” y nadie sabe qué contestar hasta el otro día.',
    'En la <b>carpa de la feria</b> vendes sin internet y al regresar la caja no cuadra con las cajas.',
    'Vendes mucha texana, pero no sabes si te deja más la <b>20X o la 6X</b> después del descuento y la comisión del muchacho.',
    'El muchacho se llevó la bota y la texana, pero el <b>cinto en 36</b> no había, y el conjunto de la boda se fue a la tienda de enfrente.',
  ],
  cierre: 'Ningún sistema de ropa entiende que una bota es un número con horma, que una texana es una talla con X y que un cinto es una medida, y que los tres van en el mismo ticket para el mismo señor. Sacs sí: cada pantalla que sigue funciona igual en el mostrador, en la carpa de la feria y en el WhatsApp. Y encima puedes poner agentes de IA para que hagan el trabajo repetitivo: el sugerido de resurtido por número, el aviso de apartados por vencer y el recordatorio del Día del Padre.',
};

export const variantesWS = {
  eyebrow: 'Un solo modelo',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“una bota rodeo”.',
  sub: 'Una corrida trae del 25 al 30. En tres pieles y con horma normal y ancha, son 36 existencias distintas de un solo modelo. Y los números de en medio se van en las primeras semanas: lo que queda en la pared son las orillas.',
  ejeA: ['25', '26', '27', '28', '29', '30'],
  filas: [
    { nombre: 'Res chocolate', img: `${IMG}/prod-res.webp`, alt: 'Bota vaquera punta rodeo en piel de res color chocolate' },
    { nombre: 'Venado miel', img: `${IMG}/prod-venado.webp`, alt: 'Bota vaquera punta rodeo en piel de venado color miel' },
    { nombre: 'Avestruz negro', img: `${IMG}/prod-avestruz.webp`, alt: 'Bota vaquera punta rodeo en piel de avestruz color negro' },
    { nombre: 'Toro nobuck', img: `${IMG}/prod-toro.webp`, alt: 'Bota vaquera punta rodeo en piel de toro nobuck' },
  ],
  matriz: [
    [2, 0, 0, 1, 2, 3],
    [1, 2, 0, 0, 1, 2],
    [1, 1, 0, 1, 2, 2],
    [2, 3, 1, 0, 1, 1],
  ],
  unidad: 'pares',
  genero: 'm' as const,
  umbralBajo: 0,
  leyendas: ['Con existencia', 'Queda uno', 'Agotado'] as [string, string, string],
  remate: 'Las cuatro corridas ya están rotas en el 27 y el 28. Lo que queda son orillas: 25 y 30 que se van a quedar meses en la pared.',
};

export const cortinaWS = {
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Vendedor en la bodega de una tienda western buscando un número entre cajas de bota apiladas, con la libreta en la mano',
  altDespues: 'El mismo vendedor frente a la pared de botas, enseñando en la tablet los números que hay en cada tienda',
  libreta: ['Rodeo choc. 27 — ¿hay?', 'Apartado grad. — texana 7 1/8', 'Pedir al taller: cocodrilo 27.5 ancha'],
  filas: [
    { que: '¿Hay 27 de este modelo?', donde: 'En la tablet, desde la pared', dato: 'Los números, anchos y colores que hay aquí, en bodega y en las demás tiendas' },
    { que: 'El apartado de la graduación', donde: 'Par bloqueado, saldo y fecha', dato: 'Con aviso por WhatsApp antes de que venza; nadie le vende el par a otro' },
    { que: 'El 27 está en la del centro', donde: 'Traspaso desde el celular', dato: 'Le das fecha al cliente; se confirma cuando llega, no se pierde en el camino' },
    { que: 'Bota + texana + cinto', donde: 'Un solo ticket', dato: 'Tres tallas distintas en cinco líneas, con la comisión por conjunto' },
  ],
  pieDespues: 'El mismo vendedor, la misma tarde. Ya no adivina qué hay en la bodega: lo ve.',
};

export const casosWS = [
  {
    id: 'paisano',
    titulo: 'Diciembre: los paisanos y el aguinaldo',
    texto: 'Es la cuarta parte del año en tres semanas. El cliente pide en número americano, paga en efectivo o en dólares, quiere el conjunto completo y no espera: si no hay su número hoy, se va enfrente. Existencias de todas las tiendas desde el mostrador, traspaso con fecha y el número americano en la ficha.',
    remate: 'Un “8” es un 26. Y el que pide “un 8” en diciembre no regresa en enero.',
    img: `${IMG}/caso-paisano.webp`,
    alt: 'Familia de un paisano recién llegado del norte comprando botas y texanas en una tienda de Zacatecas en diciembre',
  },
  {
    id: 'feria',
    titulo: 'La carpa de la feria',
    texto: 'Dos semanas de carpa o stand, sin señal estable, con precio de feria y mucha texana y exótica. La carpa es un almacén aparte, cobra sin internet y sincroniza al volver la señal, con corte de caja por día de feria.',
    remate: 'Lo que no se cobra bien en la carpa se pierde en la cuenta. Y la feria de tu plaza es tu diciembre chiquito.',
    img: `${IMG}/caso-feria.webp`,
    alt: 'Carpa de una tienda western en la feria de noche, con botas en mesas, texanas colgadas y el cobro desde el celular',
  },
  {
    id: 'graduacion',
    titulo: 'Día del Padre y graduaciones',
    texto: 'Cinto piteado, hebilla, texana y el conjunto del graduado. El apartado se abrió en febrero y se liquida en mayo: con anticipo, abonos, fecha límite, aviso por WhatsApp y el par bloqueado. Nadie lo vende a otro.',
    remate: 'Si el par del apartado se vendió, se pierde el cliente y la familia entera.',
    img: `${IMG}/caso-graduacion.webp`,
    alt: 'Mamá e hijo en una tienda western en mayo: el joven se prueba botas con la texana puesta y la vendedora muestra el apartado en la tablet',
  },
  {
    id: 'taller',
    titulo: 'El pedido especial al taller',
    texto: 'Cocodrilo panza en 27.5, horma ancha, punta rodeo, caña de su color. Se levanta con la medida, la piel del muestrario y el anticipo del 50 %; el sistema lleva la etapa (corte, montado, suela, acabado) y le avisa al cliente cuando está lista.',
    remate: 'Hoy cada paso vive en un chat distinto. Ahí es donde se pasa avisarle.',
    img: `${IMG}/caso-taller.webp`,
    alt: 'Maestro botero montando una bota de avestruz sobre la horma, con la encargada mostrando el pedido especial en la tablet',
  },
];

export const seccionesWS: SuiteSeccion[] = [
  {
    id: 'tresmatrices', tag: 'Inventario',
    titulo: 'Tres matrices, un solo ticket',
    texto: 'La bota por número, medio número y horma. La texana por talla y X. El cinto por medida. El pantalón por cintura y largo. Cada uno con su matriz, y los cuatro se cobran en el mismo ticket para el mismo señor.',
    bullets: ['Bota: 25 al 30 con 26.5 y 27.5, horma normal o ancha, por piel y color', 'Texana: 6 3/4 a 7 5/8 (o “un 57”), por material y X', 'Cinto: 30 a 46; pantalón: cintura × largo, la segunda matriz más quebrada de la tienda'],
    visual: mockMatriz('Rodeo res chocolate · pares por número', ['25', '26', '26.5', '27', '27.5', '28', '29', '30'], [['Normal', [2, 3, 1, 0, 1, 2, 2, 3]], ['Ancha', [1, 1, 0, 0, 0, 1, 1, 2]]], 'Sin 27 en ninguna horma: la corrida ya está rota', [0, 3], 0),
  },
  {
    id: 'sucursales', tag: 'Sucursales',
    titulo: '¿Dónde hay un 27 de este modelo?',
    texto: 'Desde cualquier mostrador y desde tu celular. El vendedor escanea el par de muestra y ve los números que hay en bodega y en las demás tiendas; pide el traspaso ahí mismo y le da fecha al cliente.',
    bullets: ['Existencias por sucursal en vivo, por número, horma y color', 'Traspaso pedido, en tránsito y recibido: nada se pierde en el camino', 'Las orillas de una plaza se mandan a la plaza donde sí rotan'],
    visual: mockBarras('Rodeo res chocolate · 27 · por tienda', [['Centro', '3 pares', 100], ['Plaza', '0 pares', 0], ['Feria', '1 par', 33]], 'Traspaso sugerido: 1 del Centro a Plaza, llega el jueves'),
  },
  {
    id: 'apartados', tag: 'Apartados',
    titulo: 'El apartado de diciembre, sin libreta',
    texto: 'Anticipo del 20 o 30 %, abonos, fecha límite y el par bloqueado en inventario. El cliente recibe el recordatorio por WhatsApp y el vendedor ve qué vence esta semana.',
    bullets: ['Par bloqueado: nadie lo vende dos veces', 'Abonos por quincena con saldo y fecha', 'Aviso por WhatsApp antes de que venza'],
    visual: mockLista('Apartados por vencer esta semana', [['Rodeo avestruz 27 + texana 7 1/8 · Juan R. · saldo $2,400', 'Viernes', 'aviso'], ['Picuda negra 26 · graduación · saldo $800', 'Sábado', 'aviso'], ['Cinto piteado 36 + hebilla · liquidado', 'Entregar', 'ok'], ['Botín trabajo 28 · abono recibido', 'Al corriente', 'gris']], 'El par apartado ya no aparece disponible en la pared ni en la página'),
  },
  {
    id: 'feria', tag: 'Feria',
    titulo: 'La carpa cobra sin internet',
    texto: 'Lo que te llevas a la feria sale como un almacén aparte, con precio de feria. La caja cobra sin señal y sincroniza al volver; al cerrar el día, el corte de la carpa cuadra con las cajas que quedan.',
    bullets: ['Inventario de la carpa separado del de la tienda', 'Precio de feria y de Buen Fin sin tocar el precio de lista', 'Corte de caja por día de feria, en dólares y en pesos'],
    visual: mockTicket('Carpa San Marcos · ticket', [['Bota picuda avestruz 27', '$5,900'], ['Texana 20X castor 7 1/8', '$1,800'], ['Hormado de texana', '$0']], ['Total', '$7,700'], 'Cobrado sin señal · se sincroniza al volver'),
  },
  {
    id: 'whatsapp', tag: 'WhatsApp y redes',
    titulo: '“¿Hay en 26 punta rodeo?” a las once de la noche',
    texto: 'El WhatsApp conectado al inventario contesta con la existencia real, manda el link para pagar y la guía de paquetería. Y el pedido del live de Facebook nace en el comentario y se aparta desde el chat.',
    bullets: ['Existencia real en la conversación, sin preguntarle a nadie', 'Link de pago y envío a todo el país y a Estados Unidos', 'La tienda en línea vende la pared, la bodega y las demás tiendas con número y horma'],
    visual: mockLista('WhatsApp · pedidos de hoy', [['¿Hay rodeo choc. en 26? · Sí, 2 en Plaza · link enviado', 'Pagado', 'ok'], ['Live de anoche · texana gris 7 1/4 · apartada por comentario', 'Apartado', 'aviso'], ['Envío a Dallas · cinto piteado 38', 'Guía lista', 'ok'], ['¿Tienen de venado en 29? · lista de espera', 'Avisar', 'gris']], 'Cada chat queda en la ficha del cliente con su número y su talla de texana'),
  },
  {
    id: 'corrida', tag: 'Compras',
    titulo: 'La corrida con tu curva, no con la de fábrica',
    texto: 'Antes de ir a León ves por modelo y tienda qué números se fueron y cuáles sobraron. La IA te sugiere cuántos de cada número pedir y a qué tienda mandarlos, y la corrida se recibe aunque llegue en dos embarques.',
    bullets: ['Cuántos de cada número, con la venta real de cada plaza', 'Recepción parcial: llegaron 8 de 12 y sabes cuáles faltan', 'Orillas con más de 90 días y el dinero parado que representan'],
    visual: mockBarras('Rodeo res · sugerido de resurtido por número', [['25', '1 par', 33], ['26', '2 pares', 66], ['27', '3 pares', 100], ['28', '3 pares', 100], ['29', '2 pares', 66], ['30', '1 par', 33]], 'Con la venta de los últimos 12 meses de esta tienda; la fábrica mandaba 2 del 25 y 2 del 30'),
  },
];

export const planoWS = [
  {
    id: 'pared', nombre: 'La pared de botas', simbolo: 'exhibidores' as const,
    foto: `${IMG}/zona-pared.webp`, alt: 'Pared de botas de una tienda western, un par de muestra por modelo',
    pie: 'Se escanea el par de muestra y se ven todos los números que hay aquí y en las demás tiendas.',
    pregunta: '¿Hay en 27 de esta punta?',
    caja: { x: 68, y: 82, w: 216, h: 110 },
    items: [
      { t: 'Escaneas el par de muestra y ves números, hormas y colores en bodega y en las demás tiendas' },
      { t: 'Si no hay aquí, traspaso desde el celular con fecha para el cliente' },
      { t: 'Si no hay en ninguna, pedido especial al taller o lista de espera por número' },
      { t: 'Ficha del modelo: horma, punta, piel, caña, suela y el número americano' },
      { t: 'Sugiere el conjunto: texana, cinto y hebilla que casan con ese par' },
    ],
  },
  {
    id: 'texanas', nombre: 'El rincón de las texanas', simbolo: 'anaqueles' as const,
    foto: `${IMG}/zona-texanas.webp`, alt: 'Anaquel de texanas por talla y la máquina de vapor para hormar',
    pie: 'La texana se horma aquí mismo: el cliente sale con “su” texana, y el hormado queda en el ticket.',
    pregunta: '¿Queda 7 1/8 de la gris 20X?',
    caja: { x: 68, y: 200, w: 216, h: 56 },
    items: [
      { t: 'Inventario por talla (6 3/4 a 7 5/8), material (lana, pelo, castor) y X, por color' },
      { t: 'El hormado entra al ticket como servicio, con o sin cobro' },
      { t: 'Aviso cuando se acaba 7 1/8 o 7 1/4 de un modelo: son las que se van primero' },
      { t: 'Precio de feria y de Buen Fin sin tocar el precio de lista' },
      { t: 'El cliente queda en el CRM con su talla para el Día del Padre del año que entra', plan: 'Fideliza' },
    ],
  },
  {
    id: 'mostrador', nombre: 'Mostrador y caja', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-mostrador.webp`, alt: 'Mostrador de una tienda western con la tablet del punto de venta y cintos y hebillas en la vitrina',
    pie: 'Cobra con y sin internet, en pesos y en dólares; el apartado deja el par bloqueado.',
    pregunta: '¿Me cobras el conjunto con meses sin intereses?',
    caja: { x: 68, y: 264, w: 216, h: 104 },
    items: [
      { t: 'Cobra con y sin internet: terminal, meses sin intereses, efectivo y dólares' },
      { t: 'Apartados con anticipo, abonos, fecha límite, par bloqueado y aviso por WhatsApp' },
      { t: 'Cambio de número sin deshacer la venta; garantía con el historial del par' },
      { t: 'Comisión del vendedor por par y por conjunto, visible al cerrar el turno' },
      { t: 'Factura al ganadero al momento; ticket simple al paisano' },
    ],
  },
  {
    id: 'bodega', nombre: 'La bodega de cajas', ambito: 'Detrás del mostrador', simbolo: 'anaqueles' as const,
    foto: `${IMG}/zona-bodega.webp`, alt: 'Bodega de una tienda western con las cajas de bota apiladas por número',
    pie: 'Aquí llega la corrida, aunque venga en dos embarques, y aquí se ven las orillas.',
    pregunta: '¿Cuáles números me faltan por llegar de la fábrica?',
    caja: { x: 298, y: 82, w: 128, h: 186 },
    items: [
      { t: 'Recepción de corridas por número, con lo que falta por llegar del fabricante' },
      { t: 'Código de barras por par; conteo con el escáner sin cerrar la tienda' },
      { t: 'Corridas rotas y orillas con más de 90 días, con el dinero parado que representan' },
      { t: 'Traspasos en tránsito y recibidos; el rezago se manda a donde sí rota', plan: 'Controla' },
      { t: 'Sugerido de resurtido de la IA por modelo y número, para pedirle al agente', plan: 'Automatiza' },
    ],
  },
  {
    id: 'whatsapp', nombre: 'La mesa de WhatsApp y envíos', fuera: true, simbolo: 'paquetes' as const,
    foto: `${IMG}/zona-whatsapp.webp`, alt: 'Mesa de envíos de una tienda western: cajas de bota con guía de paquetería y el celular con el WhatsApp de la tienda',
    pie: 'La misma pared, vendida por WhatsApp, Facebook y la tienda en línea, con envío a todo el país y a Estados Unidos.',
    pregunta: '¿Se manda a Dallas?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'WhatsApp conectado al inventario: “¿hay en 26?” con existencia real y link de pago' },
      { t: 'Tienda en línea con número y horma, vendiendo pared, bodega y demás tiendas' },
      { t: 'Pedidos de la página, del live y de redes salen de la tienda más cercana, con guía' },
      { t: 'Pedidos especiales: especificación, anticipo, etapa en el taller y aviso al cliente' },
      { t: 'CRM con número de bota, talla de texana y medida de cinto; campaña de diciembre y del Día del Padre', plan: 'Fideliza' },
    ],
  },
];

export const pasosWS = [
  { cuando: 'Día 1', titulo: 'Tus pares, cargados', texto: 'Nos das tu lista o tu sistema actual y lo subimos nosotros. No capturas nada.', detalle: 'Modelo, horma, punta, piel, color y número, con medios números y horma ancha, más texanas por talla y cintos por medida, con la existencia real de cada tienda.', img: `${IMG}/proceso-recibir.webp`, alt: 'Recepción de una corrida de botas contra lo pedido, revisando un par contra la muestra' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus fábricas, tu taller, tus plazas y tus vendedores.', detalle: 'Precio de feria, comisión por par y por conjunto, la regla de los apartados y quién autoriza un traspaso.', img: `${IMG}/proceso-piso.webp`, alt: 'Vendedora atendiendo a una clienta que se prueba botas de avestruz, con los números en la tablet' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Escanear un par y ver dónde hay el número se aprende en media hora.', detalle: 'Y se practica lo de todos los días: el apartado, el traspaso, el hormado en el ticket y el conjunto.', img: `${IMG}/proceso-texana.webp`, alt: 'Sombrerero hormando una texana gris al vapor en el rincón de las texanas' },
  { cuando: 'Día 4', titulo: 'Arranca una tienda', texto: 'La primera sucursal vende con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con los apartados vivos ya migrados: nadie llega a liquidar su par y se encuentra con que su libreta no existe.', img: `${IMG}/proceso-traspaso.webp`, alt: 'Empleado entregando cajas de bota y una caja de texana a la camioneta de la cadena para un traspaso' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día.', detalle: 'Y el traspaso de números entre plazas ya corre desde el primer fin de semana, que es cuando se nota.', img: `${IMG}/proceso-direccion.webp`, alt: 'Dueño y comprador de una cadena western frente al tablero de margen por línea y rotación por número' },
];
export const ticketWS = { lineas: [{ n: 'Bota rodeo res chocolate · 27', p: '$2,200' }, { n: 'Texana 20X gris · 7 1/8', p: '$1,800' }, { n: 'Cinto piteado · 36', p: '$2,500' }], total: '$6,500' };

export const escalaWS = [
  { n: '1 tienda', nombre: 'La tienda del pueblo o de la plaza', cambia: ['El dueño va a León dos veces al año y resurte con el agente por WhatsApp', 'Hay bodega atrás y la pared; los apartados van en libreta', 'Vende por WhatsApp e Instagram y manda por paquetería'], sistema: ['Pide con la curva de su tienda, no con la de fábrica', 'Sabe qué hay en la bodega sin ir a ver; los apartados con fecha desde el celular', 'La página y el chat venden lo que hay, no lo que ya se vendió'], dato: { valor: '36', rotulo: 'existencias distintas en un solo modelo con tres pieles y dos hormas' } },
  { n: '5 tiendas', nombre: 'La cadena de la región', cambia: ['Una persona compra para todas y reparte a ojo', 'Traspasos diarios por mensaje, con pares que “se pierden en el camino”', 'Encargados por tienda y el dueño rotando'], sistema: ['Reparte por curva de cada plaza: rodeo para el pueblo, picuda para la ciudad', 'Traspaso registrado: pedido, en tránsito y recibido', 'Cierre de caja de las cinco sin ir; comisiones sin hoja de cálculo'], dato: { valor: '1 clic', rotulo: 'para mandar el 27 de la tienda del centro a la de la plaza' } },
  { n: '50 tiendas', nombre: 'La cadena con bodega madre', cambia: ['Comprador por categoría: bota de hombre, de dama, texana, ropa', 'Bodega central con recepción por corrida y resurtido a cada tienda', 'Marca propia maquilada; tienda en línea que vende el inventario de todas'], sistema: ['Surtido inicial y resurtido automático por sucursal con IA', 'Orillas visibles por región; el sistema propone mover números entre plazas cada semana', 'Margen por línea y por piel, rotación por número, dinero parado: en un tablero'], dato: { valor: '2+', rotulo: 'piezas por ticket cuando el conjunto se arma con la existencia de todas las tiendas' } },
  { n: '150 tiendas', nombre: 'La cadena nacional con fábrica propia', cambia: ['La compra de cada temporada con fábrica propia y maquiladores; corridas por volumen', 'Bodegas regionales y rutas; el traspaso es una orden con tiempos', 'Franquicias o concesiones con su propia caja'], sistema: ['Órdenes de producción conectadas al inventario que viene', 'Cliente único en el CRM sin importar dónde compró: número, texana y cinto', 'Cada franquicia con su caja y el corporativo con la foto completa por tienda y región'], dato: { valor: '1 ficha', rotulo: 'por cliente, con su número de bota, su talla de texana y su medida de cinto' } },
];

export const problemasWS = {
  entrada: 'Casi toda tienda western que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un sistema de ropa que ve “una bota” donde hay ocho números y dos hormas, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'las tiendas western y de calzado que ya la usan',
};

export const cifrasWS = {
  foto: `${IMG}/escala.webp`,
  alt: 'Bodega central de una cadena western con las cajas de bota por número, cajas de texana y el tablero de existencias por tienda',
  frase: 'Desde la tienda del pueblo hasta la cadena con bodega madre y fábrica propia.',
  encuadre: 'center 45%',
};
