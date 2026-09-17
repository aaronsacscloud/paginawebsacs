/**
 * Contenido de la landing de EMPRENDEDORAS QUE VENDEN EN DIGITAL — sin tienda física
 * (17-sep-2026). Sale de la ficha del oficio (scratchpad/giros-fichas/emprendedoras-digital.md,
 * versión 2, aprobada 9/9/10/10/9 por una que lleva diez años vendiendo así). Lo que manda aquí:
 * no hay caja, no hay aparador y no hay probador — hay un teléfono, un rack, una mesa de empaque y
 * una báscula. La venta vive dentro de una conversación y ahí mismo se muere: todo se juega entre
 * el "¿sigue disponible?" y el comprobante que llega o no llega. Por eso el plano no son cinco
 * zonas de un local, sino las cinco del negocio real (el cuarto del inventario, la esquina de
 * fotos, la mesa de empaque, el teléfono y la entrega), y la escala no son sucursales sino
 * personas y canales: sola → con una que contesta → con equipo y bodega → su primera tienda.
 *
 * Bloque propio: "la fila invisible" — las otras que preguntaron por esa misma pieza y a las que
 * les dijo "ya está apartada", y que nadie anotó. No se pisa con el apartado de joyería (allá hay
 * vitrina, abonos y mostrador) ni con el "se lo llevó otra" del outlet (allá la que llegó tarde lo
 * vio con sus ojos). Aquí la pieza se congela con una frase escrita a las 11 de la noche, sin un
 * peso, sin fecha y sin testigo.
 *
 * Los números del oficio están verificados por la referee y NO se mueven: margen real de $230 por
 * pieza (ya con flete, viaje y empaque, sobre una de $450); de 100 apartados al mes se caen 45; de
 * esas, una de cada cinco traía otra clienta detrás (9); de esas 9, el 55 % sí habría pagado (5);
 * ventas perdidas de verdad, $1,150 al mes; con vencimiento de 24 horas se ganan unos $1,265 al
 * mes, unos $15,000 al año; y 45 piezas × 3 días son 135 días de rack muertos al mes, como 4.5
 * piezas colgadas sin venderse todo el mes.
 *
 * Reglas de escritura aplicadas: español de México como habla ella ("¿sigue disponible?", "te lo
 * aparto", "¿ya lo mandaste?", "¿traes mi guía?", "pásame tu comprobante"); cero marcas de
 * terceros —se dice "las redes", "la paquetería", "el marketplace", "la app de mensajes"—; y las
 * funciones se presentan como parte del sistema, sin "próximamente" (decisión del dueño 17-sep).
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista, mockCalendario } from './_mocks';

const IMG = '/images/giros/emprendedoras';

export const bannerEM = {
  eyebrow: 'SACS · Vender moda sin tienda física',
  titulo: '“Te lo aparto.”',
  resalte: 'Ahora con reloj.',
  sub: 'El apartado que se vence solo, la fila de las que también la querían, un solo inventario para el chat, la tienda en línea, el marketplace y el rack del bazar, el paquete que no sale hasta que el dinero está en la cuenta, y la guía con el peso y el domicilio que ya capturaste — desde tu celular, que es tu mostrador.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Cuarto de una casa convertido en negocio de ropa en línea: el rack de tubo, la mesa de empaque con la báscula y ella contestando el chat',
  avisos: [
    { modulo: 'Apartado con reloj', texto: 'Blusa floreada M · Karla · sin anticipo · vence hoy a las 8', pos: 1 as const, tono: 'ambar' as const, sello: 'En 2 h' },
    { modulo: 'Se liberó', texto: 'Vestido terracota G · no pagó · aviso a las 3 que también lo querían', pos: 2 as const, tono: 'verde' as const, sello: 'La fila' },
    { modulo: 'Ya cayó el dinero', texto: 'Transferencia $1,169 · confirmada en la cuenta · ya puedes empacar', pos: 3 as const, tono: 'azul' as const, sello: 'Hoy' },
  ],
};

export const manifiestoEM = {
  intro: 'Sabemos cómo se vende cuando no hay tienda',
  frases: [
    'Le apartaste la blusa, se la guardaste <b>tres días</b>, nunca te depositó — y a la que sí iba a pagar ya le dijiste que no había.',
    'Se te <b>encimó</b>: vendiste dos veces la misma pieza porque la traías publicada en tres lados, y tuviste que pedirle perdón a la clienta.',
    'Contestaste dos horas después y te dijo <b>“gracias, ya la conseguí”</b>. La venta se murió en el chat.',
    'Hiciste el live, apartaste <b>40 piezas</b> en una hora, y te quedaste hasta la una de la mañana cobrando y armando paquetes con un papel.',
    'Te mandó la foto del comprobante, la viste de reojo, <b>mandaste el paquete</b> y nunca te cayó el dinero.',
    'Le cobras $99 de envío, te cuesta $135, y si te lo rechazan pagas ida y vuelta. A fin de mes te llega el cargo por <b>sobrepeso</b> de lo que ya cobraste.',
    'Todo cae a tu <b>cuenta personal</b>: sacas para la despensa y luego no te alcanza para surtir. Y no te pagas sueldo.',
    'Te devolvió por talla, tardó <b>semana y media</b> en regresar, tú pagaste la guía de vuelta, y llegó con el forro salido: esa ya no se vende a precio lleno.',
  ],
  cierre: 'Ningún sistema de tienda entiende que aquí no hay caja: que el mostrador es un chat, que “te lo aparto” es el momento más caro del día y que la misma pieza está publicada en cuatro lados al mismo tiempo. Sacs sí: cada pantalla que sigue vive dentro de tu celular, sin que te cambies a una computadora. Y encima puedes poner agentes de IA para el trabajo repetitivo: el aviso de que hoy vence, el aviso a la fila cuando se libera una pieza y el “llegó tu talla”.',
};

export const variantesEM = {
  eyebrow: 'Un solo inventario',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“la blusa floreada”.',
  sub: 'Cuatro tallas por cuatro colores son 16 existencias de un solo modelo, y tú tienes una docena. Esa misma docena está publicada en el chat, en la tienda en línea, en el marketplace y colgada en el rack que te llevas al bazar — descontando siempre del mismo montoncito.',
  ejeA: ['CH', 'M', 'G', 'EG'],
  filas: [
    { nombre: 'Terracota', img: `${IMG}/prod-uno.webp`, alt: 'Blusa terracota colgada en el rack' },
    { nombre: 'Negro', img: `${IMG}/prod-dos.webp`, alt: 'Blusa negra colgada en el rack' },
    { nombre: 'Hueso', img: `${IMG}/prod-tres.webp`, alt: 'Blusa color hueso colgada en el rack' },
    { nombre: 'Floreada', img: `${IMG}/prod-cuatro.webp`, alt: 'Blusa floreada colgada en el rack' },
  ],
  matriz: [
    [0, 3, 2, 1],
    [1, 2, 0, 1],
    [0, 1, 2, 0],
    [0, 0, 1, 1],
  ],
  unidad: 'piezas',
  genero: 'f' as const,
  leyendas: ['Con existencia', 'Quedan pocas', 'Agotada'] as [string, string, string],
  remate: 'La negra G se fue anoche en el chat y siguió publicada toda la mañana en el marketplace. La vendiste dos veces y tuviste que escribir “ay, perdóname”. El paquete del proveedor vino en curva: la chica y la extragrande son las que se quedan colgadas hasta marzo.',
};

export const cortinaEM = {
  titulo: '“¿Sigue disponible?”',
  pieAntes: 'La libreta abajo, el chat encima,<br />y la blusa colgada tres días.',
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'La misma mujer en su cuarto de inventario, con dos chats abiertos, la libreta de apartados y las piezas con tarjetitas de papel amarradas',
  altDespues: 'La misma mujer en el mismo cuarto, ahora con todo en una pantalla: los apartados con su reloj y el rack ordenado',
  libreta: ['Karla — floreada M — ¿ya depositó?', 'Terracota G — ¿la aparté o la vendí?', '¿Quién más quería la negra CH?'],
  filas: [
    { que: '“¿Sigue disponible?”', donde: 'La pieza, en un solo lugar', dato: 'Floreada M: 3 piezas, publicada en cuatro lados; se vende en el chat y se baja de todos al segundo' },
    { que: '¿Ya me depositó Karla?', donde: 'El apartado con su reloj', dato: 'Sin anticipo, vence hoy a las 8; el comprobante pegado y la confirmación de que sí cayó a la cuenta' },
    { que: '¿Quién más la quería?', donde: 'La fila de esa pieza', dato: 'Tres preguntaron por la terracota G y les dijiste que no; cuando se libera, les entra el aviso el mismo día' },
    { que: '¿Traes mi guía?', donde: 'El pedido con su envío', dato: 'Pesada, cotizada por código postal, la guía salió del pedido y el número ya se le mandó sin que preguntara' },
  ],
  pieDespues: 'La misma mujer, el mismo cuarto. Ya no busca en la libreta: lo tiene en una pantalla.',
};

export const casosEM = [
  {
    id: 'mayo',
    titulo: 'Del 1 al 8 de mayo: la semana que paga el año',
    texto: 'Se vende de más y se aparta de más: le dices que sí a todas y luego no tienes la talla o ya no alcanza el envío. La pantalla de apartados con reloj te dice quién ya pagó, a quién le vence hoy y qué piezas se liberan esta tarde; y el corte por talla y color antes de publicar, para no prometer lo que no tienes.',
    remate: 'La fecha límite es el 6 o el 7. Después, solo entrega en mano o contra entrega aquí mismo.',
    img: `${IMG}/caso-live.webp`,
    alt: 'Venta en vivo desde el cuarto de la casa: ella enseña pieza por pieza y otra chava lee los comentarios',
  },
  {
    id: 'buenfin',
    titulo: 'El Buen Fin se decide en octubre',
    texto: 'Lo que vendes en noviembre lo compraste en octubre, con la tanda o con lo que juntaste. Se gana si compraste lo que sí rota y se pierde si compraste bonito y se te queda hasta enero. El sistema te enseña qué modelos se acabaron, cuáles llevan seis semanas sin moverse con el dinero parado en cada uno, y lo que te pidieron y no tenías.',
    remate: 'El tercer lunes no hay recolección: lo que cierras el domingo sale hasta el martes.',
    img: `${IMG}/caso-preventa.webp`,
    alt: 'Ella en el pasillo de mayoreo revisando la tela de una blusa con los bultos amarrados a sus pies',
  },
  {
    id: 'diciembre',
    titulo: 'La fecha límite de diciembre (del 15 al 18)',
    texto: 'Un día antes de la fecha límite todavía es venta; un día después es un pleito. Se gana avisando con tiempo y empujando entrega en mano o contra entrega local; se pierde mandando paquetes que llegan el 27 y se rechazan. Los pedidos se ven por estado de envío: cuáles ya salieron, cuáles traen guía y cuáles siguen esperando que caiga el dinero.',
    remate: 'Y el contra entrega de diciembre te lo depositan en enero, ya con su comisión descontada.',
    img: `${IMG}/caso-bazar.webp`,
    alt: 'Puesto de bazar de fin de semana con los racks bajo la carpa, el espejo de cuerpo completo y el cobro desde el celular',
  },
  {
    id: 'enero',
    titulo: 'Enero: cambios, devoluciones y el remate',
    texto: 'Regresa medio diciembre por talla. Cada pieza que vuelve son dos envíos, semana y media fuera de venta y, muchas veces, una pieza que ya no se vende a precio lleno. Aquí están los cambios con el saldo a favor de cada clienta, las piezas marcadas “viene de regreso” que todavía no se pueden vender y las que hay que bajar de precio porque volvieron usadas.',
    remate: 'Lo que se queda en una bolsa atrás del rack se remata en marzo, y ya nadie se acuerda de cuánto costó.',
    img: `${IMG}/caso-devolucion.webp`,
    alt: 'Ella abriendo un paquete que regresó por cambio de talla y revisando la prenda usada en la mesa de empaque',
  },
];

export const seccionesEM: SuiteSeccion[] = [
  {
    id: 'inventario', tag: 'Inventario',
    titulo: 'Se vende en el chat y se baja de todos lados',
    texto: 'La misma docena está publicada en el chat, en la tienda en línea, en el marketplace y colgada en el rack que te llevas al bazar. Es un solo montoncito: lo que se vende en cualquiera se descuenta en todos al segundo. Así es como deja de encimarse la misma blusa.',
    bullets: ['Talla y color de cada modelo, con lo que de verdad queda de la docena', 'Se vende en el bazar desde el celular y desaparece del catálogo en ese momento', 'Lo que lleva seis semanas sin moverse, con el dinero que tienes parado en cada modelo'],
    visual: mockMatriz('Blusa floreada · lo que queda de la docena', ['CH', 'M', 'G', 'EG'], [['Terracota', [0, 3, 2, 1]], ['Negro', [1, 2, 0, 1]], ['Hueso', [0, 1, 2, 0]]], 'La negra G se vendió anoche en el chat: se bajó sola de los otros tres lados', [1, 2]),
  },
  {
    id: 'apartado', tag: 'Apartados',
    titulo: 'El apartado con reloj, con anticipo o con abonos',
    texto: 'Escribes “te lo aparto” y la pieza se baja de todos lados, con fecha y hora visible para las dos: “es tuya hasta hoy a las 8”. Sin anticipo, 24 horas. Con la mitad, una semana. Si te va a abonar, cada abono queda anotado contra la pieza y no se mueve hasta que complete. Vence y se libera sola.',
    bullets: ['Un solo recordatorio, dos horas antes de que venza — y no a las 11 de la noche', 'Quién más la quería queda anotado: cuando se libera, a esa fila le entra el aviso el mismo día', 'La que ya te dejó plantada dos veces no aparta: se le manda el link de pago, y no es mala onda'],
    visual: mockLista('Apartados de hoy', [['Floreada M · Karla · sin anticipo · vence hoy a las 8', 'Faltan 2 h', 'aviso'], ['Terracota G · Mayra · dejó la mitad · vence el viernes', 'Al corriente', 'ok'], ['Conjunto negro CH · Dulce · abona cada ocho días · lleva $300 de $560', 'Abono el jueves', 'ok'], ['Hueso M · Sandra · te dejó plantada dos veces', 'Link de pago', 'gris']], 'Primera en pagar, no primera en preguntar: la regla es la misma para todas'),
  },
  {
    id: 'cobro', tag: 'El dinero',
    titulo: 'El paquete no sale hasta que el dinero esté en la cuenta',
    texto: 'La foto del comprobante se pega al pedido, y encima va la confirmación de que sí cayó: el comprobante se edita, se recorta, es de otro banco o cae en dos días. Armas el pedido dentro de la conversación y le mandas el total y el link ahí mismo; cuando paga, el pedido se cierra solo aunque tú estés dormida.',
    bullets: ['Transferencia, depósito en efectivo, link de pago con tarjeta y contra entrega, cada uno con su comisión', 'El contra entrega con su comisión por cobrar y la fecha en que de verdad te van a depositar', 'Si lo rechazan, la pieza regresa a tu inventario con su costo y el rechazo no se pierde de las cuentas'],
    visual: mockTicket('Pedido de Karla · antes de empacar', [['Blusa floreada · M', '$450'], ['Vestido terracota · G', '$620'], ['Envío a Mérida · 1.1 kg', '$99']], ['Total', '$1,169'], 'Comprobante pegado y confirmado en la cuenta: hasta entonces se prepara el paquete'),
  },
  {
    id: 'envios', tag: 'Envíos',
    titulo: 'La báscula, el código postal y la fecha límite',
    texto: 'Se pesa antes de cotizar: de 990 g a 1.05 kg cambia el cobro, y esos 60 gramos son el margen de la pieza. El sistema te dice cuánto sale ese código postal antes de que tú des el precio, saca la guía desde el pedido con el peso y el domicilio ya capturados, y le manda el número sin que ella te pregunte “¿traes mi guía?”.',
    bullets: ['Lo que cobraste de envío contra lo que te cobró la paquetería, pedido por pedido, con el sobrepeso de fin de mes', 'Envío gratis a partir de $X: una pieza con envío gratis es pérdida, dos es negocio', 'Cada paquete con su estado: salió, trae guía, entregado, rechazado, viene de regreso, extraviado con folio'],
    visual: mockCalendario('Fecha límite de envíos', 'Diciembre', 31, { 15: 'ok', 16: 'ok', 17: 'aviso', 18: 'lleno', 24: 'aviso', 25: 'lleno', 31: 'aviso' }, 'Del 15 al 18 es la ventana y el 18 es el último que llega; el 24 y el 31 trabajan a medias. Después, entrega en mano o contra entrega aquí mismo.'),
  },
  {
    id: 'live', tag: 'El live',
    titulo: '40 piezas en una hora, sin soltar el teléfono',
    texto: 'Apartas por número gritado mientras transmites, sin dejar de hablar: “el 8, morado, talla M, $380”. Todo lo que apartó cada clienta se junta solo: un total, un cobro y un paquete al final, en vez de cinco mensajes por clienta cuando ya se acabó el live.',
    bullets: ['Cada pieza con su número y su fila, aunque se aparten cuarenta en una hora', 'Lo que lleva cada clienta, junto: un solo cobro y un solo paquete', 'Quién contestó y quién vendió, para pagarle su comisión a la que te ayuda'],
    visual: mockLista('Live del martes · 8 de la noche', [['Karla · lleva 4 piezas · $1,740 · link enviado', 'Pagó', 'ok'], ['Mayra · lleva 2 piezas · $860 · vence mañana a las 8', 'Esperando', 'aviso'], ['Dulce · lleva 1 pieza · $450 · dejó la mitad', 'Al corriente', 'ok'], ['El 12, morado M · se liberó · aviso a las 2 de la fila', 'Se reapartó', 'ok']], '40 piezas apartadas en una hora, 25 paquetes — y ninguna anotada en un papel'),
  },
  {
    id: 'clientas', tag: 'Tus clientas',
    titulo: 'Su talla, su domicilio y si abona puntual',
    texto: 'La ficha de cada clienta: qué talla usa, a dónde le mandas, cómo paga, si va al corriente con sus abonos y si ya te quedó mal dos veces. Y lo que te preguntaron y no tenías —“este mes me pidieron 14 veces la G de ese vestido y traía 3”— que es justo lo que decide qué traes del próximo viaje.',
    bullets: ['“Llegó tu talla”: aviso de un jalón a las que usan esa talla cuando entra', 'Lista de precios aparte para tus revendedoras, que piden por docena y pagan distinto', 'La misma foto sirve para la tienda en línea, el catálogo y el chat: la subes una vez'],
    visual: mockLista('Esta semana', [['Vestido terracota · me la pidieron 14 veces en G · traía 3', 'Al próximo viaje', 'aviso'], ['Entró la G del vestido · aviso a 40 clientas que usan G', 'Enviado', 'ok'], ['Mayoreo · Lupita revende · docena surtida a su precio', 'Su lista', 'ok'], ['Sandra · dos apartados caídos · solo link de pago', 'Marcada', 'gris']], 'Cada chat queda pegado a su ficha, aunque conteste otra persona'),
  },
  {
    id: 'dinero', tag: 'Tu dinero',
    titulo: 'Lo que de verdad ganas por pieza',
    texto: 'El costo de cada pieza con el flete, el viaje al centro y el empaque repartidos. Creías que ganabas $270 y ganas $230 — y ese es el número con el que se sacan todas las cuentas de esta página. Aparte, tu dinero separado del dinero del negocio: tus gastos, tus retiros, tu sueldo y lo que de verdad quedó.',
    bullets: ['Todo cae a tu cuenta personal: aquí se separa, para que no saques de la despensa lo que era para surtir', 'Lo vendido del año a la vista, aparte de lo personal, para saber cuándo te conviene darte de alta', 'La factura sale del pedido que ya cobraste, las veces que te la piden, sin cambiar cómo trabajas'],
    visual: mockBarras('Una blusa de $450 · a dónde se va', [['Lo que cobras', '$450', 100], ['Te costó', '$180', 40], ['Flete y viaje', '$25', 6], ['Empaque', '$15', 3], ['Te queda', '$230', 51]], 'Con ese margen de verdad se calcula todo: los apartados que se caen, el envío gratis y el remate'),
  },
];

export const planoEM = [
  {
    id: 'cuarto', nombre: 'El cuarto del inventario', simbolo: 'rieles' as const,
    foto: `${IMG}/zona-rack.webp`, alt: 'Cuarto de la casa con el rack de tubo galvanizado lleno de ropa por color, las cajas y las bolsas del centro abajo',
    pie: 'Aquí no hay aparador: nadie ve este cuarto más que ella. Lo apartado se separa en un extremo del rack.',
    pregunta: '¿Cuántos días lleva congelada esa pieza?',
    caja: { x: 68, y: 82, w: 216, h: 96 },
    items: [
      { t: 'Cuántas quedan de cada talla y color, y en qué canales está publicada cada pieza' },
      { t: 'Lo apartado, separado y contado aparte: ni disponible ni vendido' },
      { t: 'Las que ya se vendieron y esperan que caiga el dinero, en su propio estado' },
      { t: 'El bulto se cuenta el día que llega, con su curva: las tres grandes se van hoy, la extragrande se queda' },
      { t: 'Días congelados de cada pieza apartada y modelos con seis semanas sin moverse', plan: 'Controla' },
    ],
  },
  {
    id: 'fotos', nombre: 'La esquina de fotos', simbolo: 'exhibidores' as const,
    foto: `${IMG}/zona-fotos.webp`, alt: 'Esquina de fotos en la casa: fondo liso pegado a la pared, aro de luz, espejo de cuerpo completo y maniquí sin cabeza',
    pie: 'Dos metros cuadrados que valen más que un aparador: el maniquí, la modelo o ella misma frente al espejo.',
    pregunta: '¿Dónde quedó la foto de esa blusa en azul?',
    caja: { x: 298, y: 82, w: 128, h: 104 },
    items: [
      { t: 'La foto queda pegada al modelo y a su color: no se busca en el carrete' },
      { t: 'Se fotografía en tanda: bajas diez piezas, disparas las diez y las vuelves a colgar' },
      { t: 'La misma foto va a la tienda en línea, al catálogo y al chat. Una vez, no tres' },
      { t: 'El catálogo que se manda por la app de mensajes, con precios y con lo que sí hay ahorita' },
      { t: 'Lo nuevo se publica en todos los canales de un jalón, ya con sus tallas', plan: 'Automatiza' },
    ],
  },
  {
    id: 'empaque', nombre: 'La mesa de empaque', simbolo: 'paquetes' as const,
    foto: `${IMG}/zona-empaque.webp`, alt: 'Mesa de empaque en casa: sobres, papel de china, la báscula, la impresora de etiquetas y los paquetes sellados apilados',
    pie: 'La báscula manda: de 990 g a 1.05 kg cambia el cobro, y esos 60 gramos son el margen de la pieza.',
    pregunta: '¿Cuánto me sale ese código postal?',
    caja: { x: 68, y: 190, w: 216, h: 156 },
    items: [
      { t: 'Cuánto cuesta el envío a ese código postal antes de que le des el precio' },
      { t: 'La guía sale del pedido con el peso y el domicilio ya capturados' },
      { t: 'Lo que cobraste de envío contra lo que costó, con el sobrepeso que llega a fin de mes', plan: 'Controla' },
      { t: 'Envío gratis a partir de $X, para que se lleve dos piezas y no una' },
      { t: 'La tarjetita y el papel de china no son romanticismo: son el video que ella va a subir' },
    ],
  },
  {
    id: 'telefono', nombre: 'El teléfono', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-telefono.webp`, alt: 'Ella sentada en la orilla de la cama contestando el chat, con una pieza apartada colgada en el rack junto a ella',
    pie: 'El mostrador de verdad. Aquí pasa la venta completa: el precio, la talla, la foto, el dinero y la guía.',
    pregunta: '¿Quién le dijo que se la guardaba ocho días?',
    caja: { x: 298, y: 198, w: 128, h: 148 },
    items: [
      { t: 'El pedido se arma dentro de la conversación: total y link ahí mismo' },
      { t: 'Escribes “te lo aparto” y la pieza se baja de todos lados, con su reloj' },
      { t: 'La fila queda guardada: quién más la quería y en qué talla', plan: 'Fideliza' },
      { t: 'Con dos contestando, queda registrado quién atendió, quién apartó y qué se prometió' },
      { t: 'Todo desde el celular: ella no se va a cambiar a una computadora' },
    ],
  },
  {
    id: 'entrega', nombre: 'La entrega', fuera: true, ambito: 'La salida del día', simbolo: 'armado' as const,
    foto: `${IMG}/zona-entrega.webp`, alt: 'Ella saliendo del edificio con la bolsa de rafia llena de paquetes sellados para la salida del día',
    pie: 'Una sola salida diaria, a la misma hora. Dejar en sucursal sale más barato; la recolección no te quita la mañana.',
    pregunta: '¿Ya lo mandaste?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Cada paquete con su estado: salió, trae guía, entregado, rechazado o viene de regreso' },
      { t: 'Entrega en mano y punto de reunión: se cobra ahí mismo y se cierra la venta' },
      { t: 'El contra entrega con su comisión por cobrar y la fecha en que de verdad te depositan', plan: 'Controla' },
      { t: '“Viene de regreso”: contada, pero no vendible, hasta que llegue y se revise' },
      { t: 'La reclamación del paquete perdido, con su folio, sus días y lo que al final pagaron' },
    ],
  },
];

export const pasosEM = [
  { cuando: 'Día 1', titulo: 'Tus piezas, cargadas', texto: 'Nos pasas tu libreta, tu hoja o tus fotos y lo subimos nosotros. No capturas nada.', detalle: 'Modelo, color y talla con lo que de verdad queda de cada docena, y la foto pegada a cada pieza para que sirva en la tienda en línea, en el catálogo y en el chat.', img: `${IMG}/proceso-foto.webp`, alt: 'Esquina de fotos de la casa: el aro de luz, el fondo liso y el maniquí con un vestido' },
  { cuando: 'Día 2', titulo: 'Tus reglas, configuradas', texto: 'Queda como ya trabajas: tus canales, tus formas de cobro y tus reglas de apartado.', detalle: 'Apartado de 24 horas sin anticipo, una semana con la mitad, abonos cada ocho días, el envío gratis a partir de $X y a quién sí y a quién no se le aparta.', img: `${IMG}/proceso-chat.webp`, alt: 'El pedido armándose dentro de la conversación, con el total y el link listos para mandar' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión contigo y con la que te ayuda a contestar. Todo desde el celular, en media hora.', detalle: 'Y se practica lo de todos los días: apartar con reloj, pegar el comprobante, pesar, sacar la guía del pedido y mandarle el número.', img: `${IMG}/proceso-empaque.webp`, alt: 'Mesa de empaque de la casa con la báscula, los sobres y los paquetes sellados' },
  { cuando: 'Día 4', titulo: 'Arranca el chat', texto: 'Empiezas a vender con Sacs por donde más vendes: la conversación.', detalle: 'Con los apartados de hoy ya migrados: ninguna clienta escribe “¿y mi blusa?” y se encuentra con que su apartado no existe.', img: `${IMG}/proceso-envio.webp`, alt: 'La salida del día con los paquetes sellados y la guía pegada, lista para dejar en sucursal' },
  { cuando: 'Día 5', titulo: 'Arrancan los demás canales', texto: 'Con el chat resuelto entran la tienda en línea, el marketplace y el rack del bazar.', detalle: 'Ya sobre el mismo inventario: lo que se vende en cualquiera se baja en todos, y el corte del día te dice qué entró por dónde.', img: `${IMG}/proceso-corte.webp`, alt: 'Ella revisando el corte del día en la laptop, con los pedidos por estado de envío' },
];
export const ticketEM = { lineas: [{ n: 'Blusa floreada · M', p: '$450' }, { n: 'Vestido terracota · G', p: '$620' }, { n: 'Envío a Mérida · 1.1 kg', p: '$99' }], total: '$1,169' };

export const escalaEM = [
  { n: 'Sola', nombre: 'Ella y su teléfono', cambia: ['Contesta a las 7 de la mañana y a las 11 de la noche, desde la cama', 'El inventario está en su cabeza y en una libreta. Los apartados también', 'No puede contestar y empacar al mismo tiempo, y cada hora sin contestar es una venta menos'], sistema: ['El apartado con fecha y hora, y las existencias en un solo lado', 'La pieza se baja de todos lados en el segundo en que se vende', 'La guía sale del pedido y el número se manda solo'], dato: { valor: '60 a 120', rotulo: 'piezas al mes, casi todo por transferencia a su cuenta personal' } },
  { n: 'Con una', nombre: 'Con una que contesta', cambia: ['Aparece el problema que no tenía: dos personas apartando la misma pieza', 'No sabe si la que contesta vendió o nada más platicó', 'Ya hay cuarto dedicado, rack y mesa de empaque: el chat dejó de ser personal'], sistema: ['Las dos ven lo mismo y queda registrado quién atendió y a quién se le prometió qué', 'Los plazos largos los autoriza la dueña, no quien contesta “porque es buena onda”', 'Quién contestó y quién vendió, para pagarle su comisión'], dato: { valor: '150 a 300', rotulo: 'piezas al mes, y la primera empleada que aparta sin permiso' } },
  { n: 'Con equipo', nombre: 'Con equipo y bodega', cambia: ['Una contesta, una empaca, alguien va al centro; ella compra, hace lives y revisa números', 'Vende por cuatro lados a la vez: el chat, la tienda en línea, el marketplace y sus revendedoras', 'Bodeguita rentada, salida diaria de paquetes y hasta 3,000 piezas de inventario parado'], sistema: ['Un solo inventario para los cuatro canales: encimarse deja de ser pena y ya es dinero', 'Lista de precios aparte para las revendedoras, con su estado de cuenta', 'El dinero del negocio, separado del personal: gastos, retiros, sueldo y lo que quedó'], dato: { valor: '400 a 1,000', rotulo: 'piezas al mes por cuatro canales, sobre un solo montoncito' } },
  { n: 'Su local', nombre: 'Su primera tienda física', cambia: ['Muchas deciden a propósito no abrir: la renta se come justo el margen que ganas por no tenerla', 'La que abre descubre que lo digital no se muere: se vuelve el doble de trabajo', 'La misma blusa está colgada en el rack de la tienda y publicada en línea'], sistema: ['Punto de venta y canal digital sobre el mismo inventario, por primera vez', 'La que se vendió en el mostrador hace diez minutos ya no se puede apartar en el chat', 'Corte del día que junta el mostrador, el chat, la tienda en línea y el marketplace'], dato: { valor: '1 inventario', rotulo: 'para el mostrador y para el chat, sin bajar nada a mano' } },
];

export const problemasEM = {
  doc1: {
    membrete: 'Tiendita en línea genérica', sub: 'Reporte de existencias',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'EXIST.'],
    lineas: [
      { a: 'SKU-0412', b: 'BLUSA FLOREADA', c: '16' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿y la M?', '¿quién más la quería?'],
    sello: 'NO VE<br />EL CHAT',
    notas: [
      'Te dice que hay <b>16</b>. No te dice que tres están <b>apartadas de palabra</b> desde el martes.',
      'Cobra sola de madrugada, pero <b>no sabe nada de la venta que pasó en el chat</b>: ahí es donde se encima.',
      'No existe el apartado con reloj. El apartado <b>no se muere nunca</b>, se olvida.',
      'Y la fila —las que también la querían— <b>no está escrita en ningún lado</b> y se pierde entera.',
    ],
  },
  doc2: {
    membrete: 'Desarrollo a la medida', sub: 'Propuesta · rev. 3',
    cab: ['CONCEPTO', 'PLAZO'],
    lineas: [
      { a: 'APARTADO CON RELOJ', b: 'FASE 2' },
      { a: 'ENTREGA REAL', b: 'PASÓ EL 10 DE MAYO', tachado: true },
      { a: 'LA FILA', b: 'NO' },
    ],
    margen: ['+ 2 adendas', 'y llegó mayo'],
    sello: 'LLEGÓ<br />TARDE',
    notas: [
      'Costó <b>más de lo cotizado</b> y el apartado con reloj quedó para la fase 2.',
      'Funciona… mientras <b>quien lo hizo conteste el teléfono</b>. Tu semana es la del 10 de mayo.',
      'Cada cambio chico —cotizar el envío por código postal— es <b>una cotización nueva</b>.',
      'No baja la pieza en los otros canales. El día del live, <b>todo se anota en un papel</b>.',
    ],
  },
  filas: [
    { que: 'Un solo inventario para el chat, la tienda en línea, el marketplace y el bazar', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Apartado con reloj, con anticipo y con abonos', generico: 'No existe', medida: 'Rara vez', sacs: 'Incluido' },
    { que: 'La fila: quién más la quería y el aviso cuando se libera', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'El envío cotizado por código postal, con el sobrepeso y el rechazo', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Modo live y el pedido completo de cada clienta', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'Tiempo para arrancar', generico: 'Días', medida: '4 a 9 meses', sacs: 'Días' },
    { que: 'Quién lo mantiene', generico: 'Su proveedor', medida: 'Tú, si lo encuentras', sacs: 'Nosotros, a diario' },
  ],
  entrada: 'Casi toda la que vende moda desde su casa llega con nosotros trayendo una de estas dos cosas: la tiendita en línea genérica que cobra sola de madrugada pero no sabe nada de lo que pasó en el chat, o la cotización del desarrollo a la medida que iba a resolverlo. Ninguna fue una tontería. Las dos fallan, por motivos distintos.',
  quienes: 'las que venden moda desde su casa y ya la usan',
};

export const cifrasEM = {
  foto: `${IMG}/escala.webp`,
  alt: 'Bodeguita rentada de una vendedora en línea con su equipo empacando, los racks de ropa y los paquetes listos para la salida del día',
  frase: 'De contestar sola desde la cama a la bodeguita con equipo — y, si quiere, a su primera tienda.',
  encuadre: 'center 45%',
};
