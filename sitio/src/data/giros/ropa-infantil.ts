/**
 * Contenido de la landing de ROPA INFANTIL Y BEBÉS (17-sep-2026). Sale de la ficha del oficio
 * (scratchpad/giros-fichas/ropa-infantil.md) con el dictamen del referee aplicado: descompletado
 * (no viudo), de colonia (no de barrio), escalera de bebé RN, 0-3, 3-6, 6-9, 9-12, 12-18, 18-24, el
 * 3 y el 5 se venden a diario en niña, ajuar = todo lo que se junta antes del parto, chambrita y
 * ombliguero, moñito, 20 de noviembre, Día del Niño sin porcentaje, el regalo es la mitad solo en
 * bebé y en diciembre, 12 tallas del RN al 12 y 25-30 compras por hijo, comunión se guarda
 * enfundada, "del Buen Fin al 24: el mes del año", y el mecanismo del bloque: la última talla que se
 * llevó y cuándo mandan, la edad solo empuja, el sistema propone y la vendedora confirma. Bloque
 * propio: "El niño crece, la clienta regresa" (ficha del hijo, ticket de regalo, talla siguiente);
 * no repite matriz, curva, set, remate, lista de escuela ni talla hermana.
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran como
 * parte del sistema; se construyen si el cliente las pide): conjunto que se puede romper, ticket
 * de regalo sin precio y cambio desde el ticket, ficha del hijo, aviso de talla siguiente y de
 * cumpleaños, lista de baby shower, canastilla como paquete, talla pedida y no había, catálogo
 * para Instagram, escalón de mayoreo, envoltura como cargo, consignación, estado de cuenta de
 * mayoreo, orden de maquila, reparto de la corrida por sucursal.
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista } from './_mocks';

const IMG = '/images/giros/ropa-infantil';

export const bannerRI = {
  eyebrow: 'SACS · Ropa infantil y bebés',
  titulo: 'La talla es del hijo.',
  resalte: 'Y cambia sola.',
  sub: 'Tallas en meses y años, la ficha del hijo con su última talla, el ticket de regalo sin precio que se cambia en enero, el aviso de “ya usa 6” a la mamá y a la abuela, y la curva por edad para la maquila — con un mismo inventario para tus tiendas, tu Instagram y tu WhatsApp.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Tienda de ropa infantil moderna con el muro de conjuntos por talla y la ficha del hijo en la tablet del mostrador',
  avisos: [
    { modulo: 'Ya usa 6', texto: 'Regina · se llevó 4 en diciembre · le toca 6 · foto de primavera enviada a mamá', pos: 1 as const, tono: 'verde' as const, sello: 'Marzo' },
    { modulo: 'Ticket de regalo', texto: 'Conjunto rojo 4 → 6 · cambio hecho · sin enseñar el precio', pos: 2 as const, tono: 'azul' as const, sello: 'Enero' },
    { modulo: 'Se está acabando', texto: 'Playera lisa · 4 y 6 · quedan 2 · Día del Niño en 8 días', pos: 3 as const, tono: 'ambar' as const, sello: 'Abril' },
  ],
};

export const manifiestoRI = {
  intro: 'Sabemos cómo se vende la ropa de niño',
  frases: [
    'La mamá regresó en agosto por el de <b>6</b> y ya nomás te quedaba el 2 y el 14. Se fue a la tienda de enfrente y ahí se queda.',
    'Vendes puro <b>regalo</b> en diciembre y en enero vives cambiando tallas sin saber qué era, en qué talla lo tienes ni cuánto costó.',
    'Mandaste a maquilar <b>300 vestidos</b> y te quedaron 60 del 12, 14 y 16 que nadie pide. Ya van dos veranos colgados.',
    'Tienes tres tiendas y no sabes cuál tiene el <b>4</b> de la sudadera azul. Llamas, cuentan, te dicen que sí, y cuando lo mandas ya se vendió.',
    'Subiste la foto a <b>Instagram</b>, te lo pidieron en 8 seis personas, y la única de 8 se vendió en piso a las diez.',
    'El <b>ropón</b> lo apartaron con mil pesos en abril para el bautizo de junio, y nadie sabe cuánto le falta ni cuál ropón era.',
    'El Día del Niño vendiste como nunca y al otro día no tenías ni <b>playeras lisas</b> del 4 y del 6. Nadie te avisó que iban en cero.',
    'Ese conjunto no se vende suelto, y vendieron el short solo a 80 pesos. Ahora tienes una playera <b>descompletada</b> que nadie quiere.',
  ],
  cierre: 'Ningún sistema de ropa entiende que aquí la talla es del hijo y cambia sola, que la mitad de lo de bebé y de diciembre lo compra alguien que no es la mamá, ni que el conjunto no se separa. Sacs sí: cada pantalla que sigue funciona igual en el mostrador, en la mesa de regalo y en el WhatsApp. Y encima puedes poner agentes de IA para que hagan el trabajo repetitivo: el aviso de talla siguiente, el del cumpleaños y el pedido antes del Día del Niño.',
};

export const variantesRI = {
  eyebrow: 'Un solo modelo',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“la sudadera azul”.',
  sub: 'Del 2 al 16 son ocho tallas, y el 2, el 4 y el 6 rotan tres veces más que el 12, el 14 y el 16. En cuatro colores son 32 existencias de un solo modelo, y el sistema las ordena por edad, no por letra.',
  ejeA: ['2', '4', '6', '8', '10', '12', '14', '16'],
  filas: [
    { nombre: 'Azul', img: `${IMG}/prod-azul.webp`, alt: 'Sudadera infantil azul' },
    { nombre: 'Rosa', img: `${IMG}/prod-rosa.webp`, alt: 'Sudadera infantil rosa' },
    { nombre: 'Gris', img: `${IMG}/prod-gris.webp`, alt: 'Sudadera infantil gris' },
    { nombre: 'Verde', img: `${IMG}/prod-verde.webp`, alt: 'Sudadera infantil verde' },
  ],
  matriz: [
    [0, 0, 1, 3, 4, 5, 5, 4],
    [1, 0, 0, 2, 3, 4, 4, 3],
    [2, 1, 1, 3, 3, 5, 6, 5],
    [0, 1, 0, 2, 4, 4, 5, 4],
  ],
  unidad: 'piezas',
  genero: 'f' as const,
  leyendas: ['Con existencia', 'Quedan pocas', 'Agotada'] as [string, string, string],
  remate: 'El 2, el 4 y el 6 ya se fueron y el 12, 14 y 16 se quedan. La mamá del de 4 se fue a la tienda de enfrente, y el reporte decía que “la sudadera azul” tenía 22 piezas.',
};

export const cortinaRI = {
  titulo: '“¿Ya no le quedó?”',
  pieAntes: 'La bolsa, sin ticket,<br />y la abuela esperando.',
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Vendedora de una tienda de ropa infantil buscando en la libreta de qué era un conjunto que regresan a cambiar en enero',
  altDespues: 'La misma vendedora escaneando el ticket de regalo y mostrando en la tablet la talla siguiente donde sí hay',
  libreta: ['Conjunto rojo — ¿4 o 6?', 'Ropón Sra. Mora — ¿cuánto falta?', 'Sudadera azul 4 — ¿en cuál tienda?'],
  filas: [
    { que: '“Ya no le quedó”', donde: 'Se escanea el ticket de regalo', dato: 'Conjunto rojo 4, pagado en diciembre; talla 6 en la sucursal: 1 pieza. Cambio hecho sin enseñar el precio' },
    { que: '¿Cuánto le falta al ropón?', donde: 'El apartado con su fecha', dato: 'Anticipo, abonos, saldo y el bautizo del 14 de junio; aviso una semana antes' },
    { que: '¿En cuál tienda está el 4?', donde: 'Existencias por sucursal', dato: 'En la de la plaza hay 2; traspaso con guía, no en bolsa negra con el chofer' },
    { que: 'Regina ya usa 6', donde: 'La ficha del hijo', dato: 'Se llevó 4 en diciembre; el sistema propone 6 y le escribe a la mamá con la foto de lo nuevo' },
  ],
  pieDespues: 'La misma vendedora, la misma abuela. Ya no busca en la libreta: escanea.',
};

export const casosRI = [
  {
    id: 'navidad',
    titulo: 'Del Buen Fin al 24: el mes del año',
    texto: 'Se vende un tercio del año y la mitad es regalo. Si el 4 y el 6 de fiesta se acaban el día 15, los últimos nueve días se venden con puro 2 y 12. El mapa de tallas por modelo, con lo que se vende al día en cada sucursal, pide o traspasa la talla que va a faltar antes de que falte.',
    remate: 'Lo que no se vende el 24 vale la mitad el 26.',
    img: `${IMG}/caso-navidad.webp`,
    alt: 'Tienda de ropa infantil llena en diciembre, con la abuela comprando un conjunto de fiesta y la mesa de envoltura al fondo',
  },
  {
    id: 'cambios',
    titulo: 'Enero: la temporada de cambios',
    texto: 'Regresan la abuela, la madrina y la mamá con la bolsa: “ya no le quedó” o “le compraron dos iguales”. El ticket de regalo escaneado muestra el modelo, la talla y lo pagado (sin enseñarlo) y ofrece la talla siguiente donde sí hay, o un vale con vigencia.',
    remate: 'Sin ticket, cada cambio son diez minutos y, una de cada cuatro veces, dinero regalado.',
    img: `${IMG}/proceso-cambio.webp`,
    alt: 'Mamá cambiando un conjunto de regalo por la talla siguiente en el mostrador de una tienda de ropa infantil',
  },
  {
    id: 'nino',
    titulo: 'Día del Niño: la semana fuerte de primavera',
    texto: 'Ocho días en los que sale lo de 2 a 8 y se acaban los básicos. La compra sugerida con lo que se vendió por talla en el mismo Día del Niño del año pasado y lo que hay hoy, con fecha límite de pedido, para que lo de marzo no llegue tarde.',
    remate: 'El regalo es juguete; a la tienda le toca el conjunto del festival y el regalo de la abuela.',
    img: `${IMG}/caso-nino.webp`,
    alt: 'Mostrador de una tienda de ropa infantil la semana del Día del Niño, con las playeras y los shorts del 2 al 8 saliendo',
  },
  {
    id: 'maquila',
    titulo: 'Febrero y septiembre: la corrida de la maquila',
    texto: 'Se decide de un golpe cuántas piezas de cada talla va a tener la marca propia por seis meses. La curva por edad sale de lo que se vendió por talla en los últimos dos ciclos del mismo tipo de prenda y de lo que se pidió y no había, con la orden de maquila: tela entregada, piezas recibidas por talla, merma y pago por pieza.',
    remate: 'Un 15 % de tallas mal calculadas es un 15 % del dinero de la temporada a remate.',
    img: `${IMG}/caso-maquila.webp`,
    alt: 'Dueña de una marca de ropa infantil revisando la corrida por talla con las costureras del taller',
  },
];

export const seccionesRI: SuiteSeccion[] = [
  {
    id: 'edad', tag: 'Inventario',
    titulo: 'La talla en meses y años, ordenada por edad',
    texto: 'RN, 0-3, 3-6, 6-9, 9-12, 12-18 y 18-24; del 2 al 16 con el 3 y el 5 de niña. El sistema habla en la talla de cada proveedor y ordena por edad, no por letra. El conjunto se vende como uno y no se separa; si la encargada lo rompe, cada pieza queda con su precio.',
    bullets: ['Escalera de tallas de cada proveedor, ordenada por edad', 'El 3-6 y el 6-12 en bebé, y el 2, 4 y 6 en niño, son el corazón: mínimos por talla', 'Conjunto que no se vende suelto; romperlo pide clave y deja cada pieza con su precio'],
    visual: mockMatriz('Mameluco de polar · existencia por edad', ['RN', '0-3', '3-6', '6-9', '9-12', '12-18', '18-24'], [['Gris', [3, 4, 0, 1, 0, 4, 5]], ['Rosa', [2, 3, 1, 0, 0, 3, 4]]], 'El 3-6 y el 9-12 en cero: justo las que se acaban', [0, 2]),
  },
  {
    id: 'regalo', tag: 'Regalo',
    titulo: 'El ticket de regalo que se cambia en enero',
    texto: 'Un segundo ticket sin importe va dentro de la bolsa. Al escanearlo sabe qué se compró y cuánto se pagó, y cambia por la talla siguiente del mismo modelo sin enseñar el precio. Si no hay, vale con vigencia. La envoltura, como cargo o como costo.',
    bullets: ['Ticket de regalo sin precio y con la talla grande, para que la abuela la lea', 'Cambio desde el ticket en cualquier sucursal, aunque se haya comprado en otra', 'Vale de cambio con vigencia que avisa cuándo caduca'],
    visual: mockTicket('Cambio de regalo · enero', [['Conjunto fiesta rojo · talla 4 · regalo de la abuela', 'pagado'], ['Cambio por talla 6 · misma sucursal', '1 pieza'], ['Diferencia', '$0']], ['Listo en', '2 minutos'], 'El precio no se enseña; el 4 regresa al inventario'),
  },
  {
    id: 'hijo', tag: 'Clientas',
    titulo: 'La ficha del hijo: nombre, edad y la última talla',
    texto: 'En el primer ticket se apunta el hijo: nombre, cuántos meses o años y la talla que se llevó. La última talla y cuándo se la llevó mandan; la edad solo empuja. Cuando le toca, el sistema propone la que sigue y la vendedora confirma. La abuela y la mamá quedan ligadas al mismo niño.',
    bullets: ['Regina, 3 años, se llevó 4 en diciembre: el sistema propone 6 en marzo', 'Aviso de talla siguiente por WhatsApp con una foto en su talla; bebé cada tres meses, niño cada temporada', 'Cumpleaños, Día del Niño y Navidad: un mensaje, una talla, una foto, a la mamá y a quien regaló'],
    visual: mockLista('Cambio de temporada · marzo', [['Regina · 3 años · 4 en dic → le toca 6 · foto enviada a mamá', 'Respondió', 'ok'], ['Santi · 8 meses · 3-6 en dic → le toca 6-9', 'Aviso enviado', 'ok'], ['Nieto de la Sra. Ortiz · 4 · regalo en dic → aviso a la abuela', 'Día del Niño', 'aviso'], ['Mateo · 6 · compró en agosto · sin volver', 'Primero de la lista', 'gris']], 'Primero las que no han vuelto en seis meses con hijo de menos de dos años'),
  },
  {
    id: 'sucursales', tag: 'Sucursales',
    titulo: '¿En cuál tienda está el 4?',
    texto: 'El 8 que sobra en la plaza es el 8 que falta en la colonia. Existencias por sucursal, traspaso con guía y la curva de cada tienda: la de plaza pide fiesta y 2 a 6; la de colonia pide bebé y básicos. La corrida de la maquila se reparte por sucursal según lo que vende cada una.',
    bullets: ['Existencias por sucursal, por talla y por color, desde el celular', 'Traspaso con guía; el cambio de regalo se lee en cualquier caja', 'Reparto de la corrida por sucursal según su curva, no en partes iguales'],
    visual: mockBarras('Sudadera azul · talla 4 · por tienda', [['Plaza', '2 pz', 100], ['Colonia', '0 pz', 0], ['Centro', '1 pz', 50]], 'Traspaso sugerido: 1 de Plaza a Colonia'),
  },
  {
    id: 'ocasion', tag: 'Ocasión',
    titulo: 'El ropón, la comunión y el charro, apartados con fecha',
    texto: 'Bautizo, presentación, comunión, 15 de septiembre y 20 de noviembre: pocas piezas, tallas exactas, apartado con anticipo y abonos, nombre de la clienta y fecha del evento, y aviso una semana antes. Lo de comunión que sobró no se remata: se guarda enfundado para mayo del año que entra.',
    bullets: ['Apartado con anticipo, abonos, saldo y fecha del evento', 'Canastilla y ajuar como paquete armado que descuenta cada pieza', 'Lista de baby shower: las amigas compran de la lista y lo comprado se descuenta'],
    visual: mockLista('Apartados de ocasión', [['Ropón bautizo · Sra. Mora · 14 de junio · saldo $600', 'Aviso el 7', 'aviso'], ['Vestido comunión · talla 10 · 24 de mayo · liquidado', 'Listo', 'ok'], ['Charro · talla 6 · 15 de septiembre · anticipo', 'Al corriente', 'ok'], ['Canastilla · baby shower Sra. Ruiz · 8 de 12 piezas compradas', 'Lista abierta', 'gris']], 'Cada apartado con su fecha; el sistema avisa una semana antes'),
  },
  {
    id: 'whatsapp', tag: 'Instagram y WhatsApp',
    titulo: '“¿Te lo aparto en 4?”',
    texto: 'La foto del conjunto sale del sistema con sus tallas disponibles y se actualiza sola cuando se vende. Del chat se aparta con anticipo y la pieza se descuenta del piso: no quedas mal con seis personas por la única de 8. La tienda en línea filtra por “6-12 meses” o “talla 4” y muestra solo lo que hay.',
    bullets: ['Catálogo para Instagram con tallas disponibles que se actualizan solas', 'Apartado desde el chat que descuenta la pieza en piso', 'Tienda en línea con la talla en meses y años; mayoreo por escalón con su estado de cuenta'],
    visual: mockLista('Instagram y WhatsApp · hoy', [['Conjunto rayas · ¿en 8? · única pieza · apartada por transferencia', 'Apartado', 'ok'], ['Vestido primavera · talla 6 · foto de talla siguiente · Regina', 'Respondió', 'ok'], ['Mayoreo · tienda de Uriangato · docena surtida 2-8', 'Estado de cuenta', 'aviso'], ['Pedido en línea · mameluco 6-9 · Mérida', 'Guía lista', 'gris']], 'Cada chat queda en la ficha de la mamá con sus hijos'),
  },
];

export const planoRI = [
  {
    id: 'bebe', nombre: 'Sección de bebé', simbolo: 'exhibidores' as const,
    foto: `${IMG}/zona-bebe.webp`, alt: 'Sección de bebé de una tienda infantil: pañaleros en paquete, mamelucos en ganchitos y canastillas armadas',
    pie: 'La talla se lee en meses en la etiqueta y en el separador; la abuela tiene que leerla sin lentes.',
    pregunta: '¿Queda 6-9 del mameluco gris?',
    caja: { x: 68, y: 82, w: 216, h: 80 },
    items: [
      { t: 'Existencia por modelo en RN, 0-3, 3-6, 6-9, 9-12, 12-18 y 18-24' },
      { t: 'Etiquetas con la talla en meses, grande, impresas desde el sistema' },
      { t: 'Canastilla y ajuar como paquete armado; la lista del baby shower se arma aquí' },
      { t: 'Pañaleros por paquete o por pieza suelta, cada uno con su precio' },
      { t: 'El 3-6 y el 6-12 con mínimo por sucursal: son las que se acaban', plan: 'Controla' },
    ],
  },
  {
    id: 'piso', nombre: 'Piso de niño y niña (2 a 16)', simbolo: 'rieles' as const,
    foto: `${IMG}/zona-piso.webp`, alt: 'Piso de una tienda de ropa infantil con los racks por talla del 2 al 16 y los conjuntos colgados armados',
    pie: 'Los conjuntos se cuelgan armados y no se venden sueltos; el 2, 4 y 6 al frente y a la altura de la mano.',
    pregunta: '¿Qué modelo está hueco en 4 y 6?',
    caja: { x: 68, y: 170, w: 216, h: 86 },
    items: [
      { t: 'Tallas ordenadas por edad, con el 3 y el 5 de niña; aviso de modelo hueco en 4 y 6' },
      { t: 'El conjunto como una pieza que no se separa; romperlo pide clave' },
      { t: 'Existencias por sucursal y traspaso con guía', plan: 'Controla' },
      { t: 'La talla que pidieron y no había se apunta en caja y alimenta el pedido' },
      { t: 'Compra sugerida por temporada: Día del Niño, regreso a clases, Navidad', plan: 'Automatiza' },
    ],
  },
  {
    id: 'ocasion', nombre: 'Vitrina de ocasión', simbolo: 'vitrinas' as const,
    foto: `${IMG}/zona-ocasion.webp`, alt: 'Vitrina de ocasión de una tienda infantil: ropones, vestidos de presentación y trajes de comunión en fundas',
    pie: 'Bautizo, presentación, comunión y fiesta: pocas piezas, tallas exactas, apartado con fecha.',
    pregunta: '¿Cuánto le falta al ropón?',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Apartado con anticipo, abonos, saldo y fecha del evento; aviso una semana antes' },
      { t: 'La etiqueta lleva el nombre de la clienta y la fecha' },
      { t: 'Se prueba en piso con la mamá, nunca en probador con el niño solo' },
      { t: 'Charro, china poblana, adelita y disfraz del festival: pedidos con un mes de anticipación' },
      { t: 'Lo de comunión que sobró se guarda enfundado para mayo, con su costo a la vista', plan: 'Controla' },
    ],
  },
  {
    id: 'mostrador', nombre: 'Mostrador y mesa de regalo', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-mostrador.webp`, alt: 'Mostrador y mesa de envoltura de una tienda de ropa infantil, con la impresora del ticket de regalo',
    pie: 'Aquí se apunta el hijo en el primer ticket y aquí se hacen los cambios de enero.',
    pregunta: '¿De quién es el nieto?',
    caja: { x: 68, y: 264, w: 216, h: 104 },
    items: [
      { t: 'Ficha del hijo en el primer ticket: nombre, meses o años, talla que se llevó', plan: 'Fideliza' },
      { t: 'Ticket de regalo sin precio; cambio por talla desde el ticket; vale con vigencia' },
      { t: 'Cobra con y sin internet; factura para la que compra para la oficina y para el mayoreo' },
      { t: 'Envoltura como cargo o como costo; la foto para Instagram con la pared lisa de fondo' },
      { t: 'La abuela y la mamá ligadas al mismo niño: dos clientas por un regalo', plan: 'Fideliza' },
    ],
  },
  {
    id: 'trastienda', nombre: 'Trastienda y en línea', fuera: true, simbolo: 'paquetes' as const,
    foto: `${IMG}/zona-trastienda.webp`, alt: 'Trastienda de una tienda infantil: recepción de la maquila por talla y la mesa de empaque de pedidos en línea',
    pie: 'La maquila se recibe por talla contra la corrida; los pedidos en línea y de WhatsApp salen de la misma mesa.',
    pregunta: '¿Cuántas del 4 me faltó entregar la maquila?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Orden de maquila: tela entregada, piezas por talla recibidas, merma y pago por pieza' },
      { t: 'Reparto de la corrida por sucursal según su curva' },
      { t: 'Pedidos en línea y de WhatsApp con guía y tarjetita de regalo' },
      { t: 'Consignación en tiendas de otros: lo dejado, lo vendido, lo que se liquida' },
      { t: 'Venta por talla por línea (bebé, niño, niña, fiesta, básicos) para la compra de febrero', plan: 'Controla' },
    ],
  },
];

export const pasosRI = [
  { cuando: 'Día 1', titulo: 'Tus prendas, cargadas', texto: 'Nos das tu lista o tu sistema actual y lo subimos nosotros. No capturas nada.', detalle: 'Modelo, color y talla en meses y años, con la escalera de cada proveedor, los conjuntos armados y la existencia real de cada tienda.', img: `${IMG}/proceso-recibir.webp`, alt: 'Recepción de la maquila por talla en la trastienda de una tienda infantil' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus proveedores, tu maquila, tus sucursales y tus reglas de cambio.', detalle: 'El ticket de regalo, la ventana de cambios de enero, quién puede romper un conjunto y el escalón de mayoreo.', img: `${IMG}/proceso-etiquetas.webp`, alt: 'Impresión de etiquetas con la talla en meses y años para la sección de bebé' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Apuntar al hijo en el primer ticket y escanear el ticket de regalo se aprende en media hora.', detalle: 'Y se practica lo de todos los días: el cambio de talla, el apartado del ropón y la foto para Instagram con tallas.', img: `${IMG}/proceso-regalo.webp`, alt: 'Vendedora imprimiendo el ticket de regalo y apuntando al hijo en la ficha de la abuela' },
  { cuando: 'Día 4', titulo: 'Arranca una tienda', texto: 'La primera sucursal vende con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con los apartados de ocasión ya migrados: ninguna mamá llega por su ropón y se encuentra con que su papelito no existe.', img: `${IMG}/proceso-cambio.webp`, alt: 'Cambio de un conjunto de regalo por la talla siguiente el primer día con Sacs' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día.', detalle: 'Y el traspaso de tallas entre la de la plaza y la de la colonia ya corre desde el primer fin de semana.', img: `${IMG}/proceso-campana.webp`, alt: 'Dueña revisando la campaña de talla siguiente antes del Día del Niño' },
];
export const ticketRI = { lineas: [{ n: 'Conjunto fiesta rojo · 4', p: '$780' }, { n: 'Mameluco polar gris · 6-9', p: '$320' }, { n: 'Ticket de regalo · sin precio', p: '—' }], total: '$1,100' };

export const escalaRI = [
  { n: '1 tienda', nombre: 'La tienda de la colonia', cambia: ['La dueña compra, etiqueta, vende, envuelve y contesta el WhatsApp', 'La memoria está en ella: sabe que la mamá de Santi ya usa 6; si no está, nadie lo sabe', 'El cambio de enero, la foto y el apartado del ropón van en libreta'], sistema: ['La ficha del hijo, el ticket de regalo y el apartado con saldo', 'La foto para Instagram sale con sus tallas', 'Una caja, un celular y una impresora de etiquetas'], dato: { valor: '12 tallas', rotulo: 'del recién nacido al 12: seis en dos años y seis en diez' } },
  { n: '5 tiendas', nombre: 'Las tiendas de la zona', cambia: ['Encargada por tienda y una compradora; la bodega es la trastienda de la grande', 'El dolor cambia a “¿en cuál tienda está el 4?”', 'La de plaza pide fiesta y 2 a 6; la de colonia, bebé y básicos'], sistema: ['Existencias por sucursal y traspasos con guía', 'Compra sugerida por tienda y corte consolidado por línea', 'El CRM une a la mamá aunque compre en dos sucursales'], dato: { valor: '25 a 30', rotulo: 'compras por hijo del recién nacido al 12; cada talla dos o tres veces' } },
  { n: '50 tiendas', nombre: 'La cadena con bodega central', cambia: ['Compradora de bebé y compradora de niño; tres a seis talleres de maquila', 'Recibir 20,000 piezas y repartirlas según la curva de cada tienda', 'El cambio de regalo cruza tiendas: se compró en una plaza y se cambia en otra'], sistema: ['Recepción en bodega con código de barras y reparto por curva de tienda', 'Traspasos automáticos de tallas huecas y venta por talla por tienda por semana', 'La curva de maquila sacada de las 50 tiendas juntas'], dato: { valor: '1 ticket', rotulo: 'de regalo que se lee en cualquier caja de la cadena' } },
  { n: '150 tiendas', nombre: 'La empresa de moda infantil', cambia: ['Planeación de compra por temporada y por región; el norte pide invierno de verdad', 'La marca propia es el 70 u 80 % de la venta', 'Cientos de miles de mamás con sus hijos y sus edades en el CRM'], sistema: ['IA de surtido por tienda que sabe que el 2, 4 y 6 rotan tres veces más que el 12 al 16', 'Campañas de talla siguiente por segmento, automáticas', 'Cuántas niñas de la lista cumplen 4 este verano, antes de mandar la corrida'], dato: { valor: '1 ficha', rotulo: 'por hijo, con su última talla y cuándo se la llevó, en toda la cadena' } },
];

export const problemasRI = {
  doc1: {
    membrete: 'Sistema de ropa', sub: 'Reporte de inventario',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'EXIST.'],
    lineas: [
      { a: 'SKU-0961', b: 'SUDADERA AZUL NIÑO', c: '22' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿y el 4?', '¿de quién es el nieto?'],
    sello: 'NO VE<br />LA EDAD',
    notas: [
      'Te dice que hay <b>22</b>. No te dice que el 2, el 4 y el 6 ya se fueron.',
      'Ordena las tallas por letra: <b>12 antes que 2</b>, y 6-9 meses se pierde entre el 6 y el 9.',
      'No sabe quién compró para quién: la abuela y la mamá son <b>dos clientas</b> que se fueron.',
      'Abres la segunda tienda y el cambio de regalo ya no se puede leer allá.',
    ],
  },
  doc2: {
    membrete: 'Desarrollo a la medida', sub: 'Propuesta · rev. 4',
    cab: ['CONCEPTO', 'PLAZO'],
    lineas: [
      { a: 'FICHA DEL HIJO', b: 'FASE 2' },
      { a: 'ENTREGA REAL', b: 'PASÓ DICIEMBRE', tachado: true },
      { a: 'TICKET DE REGALO', b: 'NO' },
    ],
    margen: ['+ 3 adendas', 'y llegó enero'],
    sello: 'LLEGÓ<br />TARDE',
    notas: [
      'Costó <b>más de lo cotizado</b> y la ficha del hijo quedó para la fase 2.',
      'Funciona… mientras <b>quien lo hizo conteste el teléfono</b>. Tu mes es diciembre.',
      'Cada cambio chico —imprimir el ticket sin precio— es <b>una cotización nueva</b>.',
      'No trae aviso de talla siguiente ni cambio con ticket de regalo. En enero, <b>la fila se hace a mano</b>.',
    ],
  },
  filas: [
    { que: 'La talla en meses y años, ordenada por edad', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Ticket de regalo sin precio y cambio desde el ticket', generico: 'No existe', medida: 'Rara vez', sacs: 'Incluido' },
    { que: 'La ficha del hijo y el aviso de talla siguiente', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'El conjunto que no se vende suelto', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Curva por edad y orden de maquila', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Tiempo para arrancar', generico: 'Días', medida: '4 a 9 meses', sacs: 'Días' },
    { que: 'Quién lo mantiene', generico: 'Su proveedor', medida: 'Tú, si lo encuentras', sacs: 'Nosotros, a diario' },
  ],
  entrada: 'Casi toda tienda de ropa infantil que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un sistema de ropa que ordena el 12 antes que el 2 y no sabe de quién es el nieto, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'las tiendas y marcas de ropa infantil que ya la usan',
};

export const cifrasRI = {
  foto: `${IMG}/escala.webp`,
  alt: 'Bodega central de una cadena de ropa infantil con la corrida de la maquila repartida por sucursal y talla',
  frase: 'Desde la tienda de la colonia hasta la cadena con maquila propia y bodega central.',
  encuadre: 'center 45%',
};
