/**
 * Contenido de la landing de TRAJES DE BAÑO Y ROPA DE PLAYA (17-sep-2026).
 *
 * Sale de la ficha del oficio (scratchpad/giros-fichas/trajes-de-bano.md) revisada por el
 * referee de oficio. Regla: todo ejemplo es de este giro — top y bottom por separado, curva
 * doble, set que descuenta dos piezas, temporada de diez semanas y el corte de agosto. Las
 * palabras son las del piso: descompletado, tallas rotas, protector, cápsula, corrida, guardado.
 * Revisada por el referee de oficio (17-sep): no se dice viudo ni salida de baño, las tallas van
 * S/M/L, y "corte" a secas es corte de caja, así que el bloque propio se llama "¿Remato o guardo?".
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran
 * como parte del sistema; se construyen si el cliente las pide): set como kit que descuenta
 * dos piezas, promo "2 sueltas = precio de set", alerta de set descompletado, cobro en dólares en caja,
 * orden de maquila con tela entregada vs piezas recibidas, semanas de cobertura como indicador,
 * listas de precios por tipo de cliente, tope de apartados contra orden de compra pendiente.
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista, est } from './_mocks';

const IMG = '/images/giros/trajes-de-bano';

/* ── Portada ── */
export const bannerTB = {
  eyebrow: 'SACS · Trajes de baño y playa',
  titulo: 'El top se vende por su lado.',
  resalte: 'El bottom, por el suyo.',
  sub: 'Matriz de tallas por pieza, sets que descuentan las dos, apartados que la de Instagram y la de tienda ven igual, y el remate a tiempo antes del regreso a clases — con un mismo inventario para tu tienda, tu tienda en línea y tu WhatsApp.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Dueña de una boutique de trajes de baño en una plaza de playa, con la matriz de tallas por color en su tablet y los rieles de bikinis detrás',
  avisos: [
    { modulo: 'Se está descompletando', texto: 'Estampado coral: quedan 9 bottoms y 31 tops', pos: 1 as const, tono: 'ambar' as const, sello: 'Hoy' },
    { modulo: 'Apartado desde Instagram', texto: 'Top triángulo negro M · anticipo recibido · bloqueado en tienda', pos: 2 as const, tono: 'azul' as const, sello: 'Ahora' },
    { modulo: '¿Remato o guardo?', texto: 'Faltan 4 semanas: te van a sobrar 84 piezas del estampado de primavera', pos: 3 as const, tono: 'rojo' as const, sello: 'Regreso a clases' },
  ],
};

/* ── Manifiesto: los dolores, como los dice la dueña ── */
export const manifiestoTB = {
  intro: 'Sabemos cómo se venden los trajes de baño',
  frases: [
    'Tienes cuarenta tops <b>M</b> y ni un bottom M del mismo estampado. Se te <b>descompletó</b> y ni cuenta te diste.',
    'Tu temporada son <b>diez semanas</b>. La reposición que pides en abril llega en junio.',
    'La de <b>Instagram</b> apartó una pieza que la de la tienda ya había vendido. Dos clientas enojadas por el mismo bikini.',
    'En septiembre te quedas con <b>doscientas piezas</b> de un estampado que el año que entra nadie quiere.',
    'El maquilero te entregó <b>96 de 100</b> y dice que la tela no alcanzó. No tienes cómo saberlo.',
    'La del <b>hotel</b> siempre se queda sin L mientras la de la plaza tiene doce. Lo ves hasta que la vendedora te marca.',
    'Un set son <b>dos piezas</b>, pero en tu sistema es un código. Cada inventario, nada cuadra.',
    'Compras <b>a ojo</b>. Siempre sobra XS y falta M.',
  ],
  cierre: 'Ningún sistema de ropa entiende que un set son dos piezas con dos curvas distintas, ni que la temporada se acaba con el regreso a clases. Sacs sí: cada pantalla que sigue funciona igual en el probador, en la tienda en línea y en el chat de Instagram, porque es el mismo inventario. Y encima puedes poner agentes de IA para que hagan el trabajo repetitivo: el remate a tiempo, la curva de compra y el aviso de que un estampado se está descompletando.',
};

/* ── Variantes: un modelo son 24 existencias ── */
export const variantesTB = {
  eyebrow: 'Un solo modelo',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“un bikini”.',
  sub: 'Tres tallas de top y cinco de bottom, en cuatro estampados. Y el top y el bottom llevan cada uno su propia existencia: cuando el bottom coral se acaba, el set coral se descompleta aunque el reporte diga que “el modelo” sigue vendiendo.',
  ejeA: ['Top S', 'Top M', 'Top L', 'Bot XS', 'Bot S', 'Bot M', 'Bot L', 'Bot XL'],
  filas: [
    { nombre: 'Coral', img: `${IMG}/prod-coral.webp`, alt: 'Top de bikini triángulo coral' },
    { nombre: 'Negro', img: `${IMG}/prod-negro.webp`, alt: 'Top de bikini triángulo negro' },
    { nombre: 'Salvia', img: `${IMG}/prod-salvia.webp`, alt: 'Top de bikini triángulo verde salvia' },
    { nombre: 'Animal', img: `${IMG}/prod-animal.webp`, alt: 'Top de bikini triángulo estampado animal' },
  ],
  matriz: [
    [6, 11, 5, 1, 2, 0, 0, 1],
    [4, 6, 3, 2, 5, 6, 4, 2],
    [2, 4, 3, 0, 3, 2, 1, 0],
    [5, 8, 4, 1, 1, 0, 0, 0],
  ],
  unidad: 'piezas',
  genero: 'f' as const,
  leyendas: ['Con existencia', 'Quedan pocas', 'Agotada'] as [string, string, string],
  remate: 'El coral y el animal ya no tienen bottom M ni L: los tops que quedan se quedaron solos. Eso se ve aquí, no en el inventario de octubre.',
};

/* ── Cortina: la misma vendedora, antes y después ── */
export const cortinaTB = {
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Vendedora en la trastienda buscando entre cajas un bottom que ya no hay, con la libreta de tallas a un lado',
  altDespues: 'La misma vendedora en el piso, entregando el bottom correcto con la existencia por sucursal en su celular',
  libreta: ['Coral bottom M — ¿quedan?', 'Apartado Insta: top negro M', 'Hotel: mandar 6 L'],
  filas: [
    { que: '¿Hay bottom M del coral?', donde: 'En el celular, del riel', dato: 'Existencia por pieza, talla y color, en las tres tiendas' },
    { que: 'La de Instagram apartó el negro M', donde: 'Bloqueado en todos lados', dato: 'El apartado con anticipo lo ven la tienda, la web y el chat' },
    { que: 'Mandar 6 L a la del hotel', donde: 'Traspaso desde el celular', dato: 'Sale hoy, se confirma cuando llega, no se pierde en el camino' },
    { que: 'Set: top M con bottom L', donde: 'Se cobra como set', dato: 'Descuenta las dos piezas y aplica el precio de set' },
  ],
  pieDespues: 'La misma vendedora, la misma tarde. Lo que cambió es que ya no busca: ve.',
};

/* ── Los cuatro momentos del año ── */
export const casosTB = [
  {
    id: 'ficha',
    titulo: 'La ficha técnica de enero: lo que mandas a maquilar',
    texto: 'Lo que pidas después de Reyes es lo que vas a vender en Semana Santa y en verano. La curva sale de lo que se vendió por talla, color y pieza la temporada pasada, tienda por tienda, y no de la corazonada.',
    remate: 'Pedir a ojo es sobrar XS y quedarte sin M en tres semanas. Entre tela, muestra y costura, la maquila tarda de seis a diez semanas.',
    img: `${IMG}/caso-maquila.webp`,
    alt: 'Diseñadora de una marca de trajes de baño en su taller, con rollos de lycra y la orden de compra por talla en la pantalla',
  },
  {
    id: 'santa',
    titulo: 'Semana Santa: diez días que son un tercio del año',
    texto: 'Cada pieza que está en la tienda equivocada es venta perdida sin regreso. Existencias por sucursal en vivo desde el celular, traspaso en dos toques y una caja que no se cae aunque se caiga el internet.',
    remate: 'En ciudad, Semana Santa es el 25 al 35 % de la venta del año.',
    img: `${IMG}/caso-ciudad.webp`,
    alt: 'Tienda de trajes de baño en una plaza de Monterrey llena la semana antes de Semana Santa, con la caja cobrando un set',
  },
  {
    id: 'corte',
    titulo: 'Regreso a clases: ¿remato o guardo?',
    texto: 'Con el regreso a clases decides qué baja de precio. El sistema te dice cuántas semanas te dura lo que tienes contra las que quedan de temporada, y el descuento se aplica en todos los canales el mismo día. En playa, lo liso se guarda para diciembre y sale a precio lleno.',
    remate: 'Rematar tarde es guardar un año. Rematar temprano es regalar margen en piezas que sí se iban a vender.',
    img: `${IMG}/proceso-corte.webp`,
    alt: 'Encargada reetiquetando un riel para el remate, con la lista de lo que va a sobrar por talla y color en la tablet',
  },
  {
    id: 'capsula',
    titulo: 'La preventa de la cápsula por Instagram',
    texto: 'Vender antes de recibir la corrida financia la maquila. Los apartados con anticipo quedan ligados a la orden de compra que viene, con tope por talla: no tomas 60 apartados de un top del que van a llegar 40.',
    remate: 'Una cápsula que se sobrevende quema a la marca en una semana.',
    img: `${IMG}/caso-instagram.webp`,
    alt: 'Fundadora de una marca de bikinis empacando un pedido de Instagram en su estudio, con el apartado en el celular',
  },
];

/* ── Recorrido de funcionalidades (≤ 6, sin repetir el bloque propio) ── */
export const seccionesTB: SuiteSeccion[] = [
  {
    id: 'piezas', tag: 'Inventario',
    titulo: 'El top y el bottom, cada uno por su lado',
    texto: 'Cada pieza con su propia matriz: el top por su talla, el bottom por su talla y su corte. Un modelo en tres colores son 24 existencias, y el sistema las ve así desde que las das de alta.',
    bullets: ['Top por S/M/L, y “copa C+” o “D+” como talla extra si la manejas', 'Bottom por XS a XL y por corte: brasileño, cheeky, el que cubre, de tiro alto', 'Cada color con su propia curva, arriba y abajo; el entero y el reductor por su lado'],
    visual: mockMatriz('Bikini Marea · coral · existencia por pieza', ['S', 'M', 'L', '', 'XS', 'S', 'M', 'L', 'XL'], [['Top', [6, 11, 5, 0, 0, 0, 0, 0, 0]], ['Bottom', [0, 0, 0, 0, 1, 2, 0, 0, 1]]], 'Top con existencia, bottom casi en cero: el coral se está descompletando', [1, 6]),
  },
  {
    id: 'set', tag: 'Caja',
    titulo: 'El set descuenta dos piezas',
    texto: 'Se cobra un set y bajan el top y el bottom por separado. Y si la clienta arma su propio set con dos sueltas —top M, bottom L, dos estampados— la caja aplica sola el precio de set.',
    bullets: ['Un código de set, dos existencias descontadas', 'Promo “dos sueltas = precio de set” automática', 'El inventario cuadra el día que lo cuentas'],
    visual: mockTicket('Ticket · Caja 1', [['Top triángulo coral · M', '$590'], ['Bottom cheeky animal · L', '$490'], ['Precio de set aplicado', '−$130']], ['Total', '$950'], 'Bajaron una pieza de cada matriz; el set no existe como “un producto”'),
  },
  {
    id: 'apartados', tag: 'Instagram y WhatsApp',
    titulo: 'Un apartado que todos ven',
    texto: 'La clienta escribe “¿tienen en M?”, se le manda la foto del color, deja anticipo por link y la pieza queda bloqueada para la tienda, la web y el chat. Nadie vende dos veces el mismo bikini.',
    bullets: ['Apartado con anticipo desde el chat, con la pieza bloqueada', 'Foto por color lista para mandar, la misma que en la tienda en línea', 'La conversación queda en la ficha de la clienta, con su talla de top y de bottom'],
    visual: mockLista('Apartados de hoy', [['Top negro M · Fernanda · anticipo $300', 'Bloqueado', 'ok'], ['Set salvia S/M · Instagram · link enviado', 'Por pagar', 'aviso'], ['Entero negro 8 · tienda · recoge mañana', 'Bloqueado', 'ok'], ['Bottom coral L · web · cambio de talla', 'Cambio', 'gris']], 'Tienda, web y chat ven la misma lista'),
  },
  {
    id: 'sucursales', tag: 'Sucursales',
    titulo: 'La del hotel y la de la plaza, con el mismo inventario',
    texto: 'Ves desde el celular cuántas L tiene la del hotel sin marcarle a nadie, mandas seis desde el riel y queda registrado hasta que la otra tienda confirma que llegaron.',
    bullets: ['Existencias por sucursal en vivo, por pieza, talla y color', 'Traspaso con confirmación de recibido: nada se pierde en el camino', 'La curva de cada tienda es distinta: Tulum pide S, Cancún pide M y L'],
    visual: mockBarras('Bottom cheeky negro · talla L · por sucursal', [['Plaza', '12 pz', 100], ['Hotel', '0 pz', 0], ['Aeropuerto', '4 pz', 33]], 'Traspaso sugerido: 6 de Plaza a Hotel'),
  },
  {
    id: 'curva', tag: 'Compras',
    titulo: 'La curva de la maquila, con datos',
    texto: 'Antes de mandar la ficha técnica, el sistema te dice cuántas de cada talla y color pedir de cada pieza, con lo que se vendió la temporada pasada en cada tienda. Y recibes la corrida contra la orden: cuántas llegaron, cuántas faltan.',
    bullets: ['Curva sugerida por pieza: la del top y la del bottom no son iguales', 'Sabes qué le pediste al maquilero, cuánto le diste de anticipo y cuándo te entrega', 'Tela entregada contra piezas recibidas: se ve cuánto “se quedó” el maquilero'],
    visual: mockBarras('Corrida Marea · bottom · curva sugerida', [['XS', '10 pz · 10 %', 33], ['S', '25 pz · 25 %', 83], ['M', '30 pz · 30 %', 100], ['L', '25 pz · 25 %', 83], ['XL', '10 pz · 10 %', 33]], 'Con la venta real de Semana Santa y verano del año pasado'),
  },
  {
    id: 'linea', tag: 'Tienda en línea',
    titulo: 'La tienda en línea con talla por pieza',
    texto: 'Guía de tallas por modelo, foto por color, top y bottom por separado, y la regla de higiene en el pedido: cambio de talla con el protector puesto, no devolución. Y el mismo inventario también en marketplaces y TikTok Shop.',
    bullets: ['Talla por pieza y “cómo tallea” en cada modelo', 'El cambio de talla en línea es un cambio de talla con nota de crédito, no una devolución', 'Pedidos de web, marketplaces, Instagram y WhatsApp en una sola lista de empaque'],
    visual: mockLista('Pedidos por empacar', [['#2231 · Set coral S/M · Mérida', 'Empacar', 'ok'], ['#2232 · Entero negro 8 · CDMX', 'Empacar', 'ok'], ['#2228 · Bottom animal L → M', 'Cambio de talla', 'aviso'], ['#2230 · Cover-up lino · Cancún', 'Enviado', 'gris']], 'La pieza ya bajó del inventario al confirmarse el pago'),
  },
];

/* ── El plano de la tienda ── */
export const planoTB = [
  {
    id: 'entrada', nombre: 'La mesa de novedades', simbolo: 'exhibidores' as const,
    foto: `${IMG}/zona-entrada.webp`, alt: 'Mesa de novedades con la cápsula doblada por color en una boutique de playa',
    pie: 'La cápsula entra como colección con fecha: se ve cuánto se vendió de cada modelo desde que salió.',
    pregunta: '¿Cómo va la cápsula que lancé la semana pasada?',
    caja: { x: 68, y: 82, w: 216, h: 80 },
    items: [
      { t: 'Colección cápsula con fecha de lanzamiento y venta por modelo' },
      { t: 'Hangtag con código, talla, color y pieza impreso desde la recepción' },
      { t: 'Foto por color igual en tienda, en línea y en el catálogo de WhatsApp' },
      { t: 'Aviso de que un estampado se está descompletando: se acaba abajo y no arriba' },
      { t: 'La vendedora aparta desde el celular lo que está en otra sucursal' },
    ],
  },
  {
    id: 'rieles', nombre: 'Los rieles y la pared de lisos', simbolo: 'rieles' as const,
    foto: `${IMG}/zona-rieles.webp`, alt: 'Rieles de bikinis por color y la pared de lisos en una tienda de trajes de baño',
    pie: 'Los lisos se reponen todo el año; los estampados entran solos a la lista de remate.',
    pregunta: '¿Hay bottom L de este, sin ir a bodega?',
    caja: { x: 68, y: 170, w: 216, h: 86 },
    items: [
      { t: 'Existencia por modelo, color, talla y pieza, en vivo' },
      { t: 'Mínimo por talla y sucursal para negro, blanco y nude' },
      { t: 'Estampados con temporada: entran a la lista de remate cuando te duran más semanas de las que quedan' },
      { t: 'La curva del año que entra sale de lo que salió de estos rieles' },
      { t: 'Traspaso pedido desde el riel, pendiente hasta que la otra tienda confirma' },
    ],
  },
  {
    id: 'probador', nombre: 'El probador', simbolo: 'probadores' as const,
    foto: `${IMG}/zona-probador.webp`, alt: 'Pasillo de probadores con cortinas de lino en una boutique de playa',
    pie: 'Aquí se decide la venta: la talla que falta se aparta sin dejar a la clienta.',
    pregunta: '¿Cómo tallea este modelo?',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Se registra qué talla se probó y cuál se llevó: así sabes cómo tallea cada modelo' },
      { t: 'Apartado con anticipo desde el probador, bloqueado en todos los canales' },
      { t: 'Cambio de talla de una compra en línea como cambio de talla, no devolución' },
      { t: '“No hay devoluciones, solo cambio con el protector puesto” en el ticket y en el sistema' },
      { t: 'La clienta queda en el CRM con su talla de top y de bottom', plan: 'Fideliza' },
    ],
  },
  {
    id: 'caja', nombre: 'La caja y los pareos', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-caja.webp`, alt: 'Mostrador de una boutique de trajes de baño con la tablet del punto de venta y los pareos de impulso',
    pie: 'El set se cobra como uno y descuenta dos. Sin internet, se sigue cobrando.',
    pregunta: '¿Me cobra el set aunque las piezas sean sueltas?',
    caja: { x: 68, y: 264, w: 216, h: 104 },
    items: [
      { t: 'Set que descuenta top y bottom, y precio de set aunque se cobren sueltas' },
      { t: 'Te pagan en dólares y la caja lo pasa a pesos sola; tarjeta, transferencia o link por WhatsApp' },
      { t: 'Factura desde la caja sin que te la pidan por correo; corte de caja por turno desde el celular' },
      { t: 'Cobra sin internet en playa, hotel o bazar, y sincroniza después' },
      { t: 'Cada venta ligada a la vendedora; el hotel cobra más caro que la plaza sin cambiar etiquetas' },
      { t: 'Pareos, sombreros, bloqueador y playeras UV como unitalla con reposición por mínimo' },
    ],
  },
  {
    id: 'trastienda', nombre: 'La trastienda y la mesa de empaque', fuera: true, simbolo: 'paquetes' as const,
    foto: `${IMG}/zona-empaque.webp`, alt: 'Trastienda de una marca de trajes de baño: cajas de la maquila recién llegadas y la mesa de empaque de pedidos en línea',
    pie: 'La corrida se recibe contra la orden; los pedidos de web, Instagram y WhatsApp salen de la misma mesa.',
    pregunta: '¿Cuántas me faltó entregar el maquilero?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Recepción de la corrida contra lo que pediste: llegaron, faltan, cuánta tela se quedó' },
      { t: 'Pedidos de Instagram, WhatsApp y web en una sola lista, ya descontados' },
      { t: 'Guía de envío y etiqueta desde la misma pantalla' },
      { t: 'Lo que sobra se cuenta y sabes cuánto dinero tienes guardado en cajas', plan: 'Controla' },
      { t: 'Cuentas la tienda con el celular, sin cerrar' },
    ],
  },
];

/* ── Cómo se cambia sin cerrar ── */
export const pasosTB = [
  { cuando: 'Día 1', titulo: 'Tus piezas, cargadas', texto: 'Nos das tu lista o tu sistema actual y lo subimos nosotros. No capturas nada.', detalle: 'Modelo, color, talla y pieza (top, bottom, entero), con la existencia real de cada tienda y los sets ya armados.', img: `${IMG}/proceso-curva.webp`, alt: 'Compradora revisando la venta por talla y color de la temporada pasada en su tablet' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus maquileros, tus proveedores y tus sucursales.', detalle: 'La regla de cambios con el protector puesto, los precios de set, el precio del hotel y quién autoriza un remate.', img: `${IMG}/proceso-recepcion.webp`, alt: 'Recepción de una corrida de la maquila contra la orden de compra en el celular' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Cobrar un set y buscar una talla se aprende en media hora.', detalle: 'Y se practica lo de todos los días: el apartado desde el chat, el cambio de talla y el traspaso a la del hotel.', img: `${IMG}/proceso-probador.webp`, alt: 'Vendedora pasando un bottom de otra talla por la cortina del probador con el celular en la mano' },
  { cuando: 'Día 4', titulo: 'Arranca una tienda', texto: 'La primera sucursal vende con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con los apartados vivos ya migrados: nadie llega por su bikini y se encuentra con que no existe.', img: `${IMG}/proceso-traspaso.webp`, alt: 'Traspaso de bikinis entre dos tiendas de Cancún confirmado en el celular' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día.', detalle: 'Y el reporte del fin de semana ya sale por pieza, talla, color y tienda, que es donde se ve la temporada.', img: `${IMG}/proceso-cierre.webp`, alt: 'Dueña revisando el tablero del día al cerrar la tienda' },
];
export const ticketTB = { lineas: [{ n: 'Top triángulo coral · M', p: '$590' }, { n: 'Bottom cheeky coral · L', p: '$490' }, { n: 'Precio de set', p: '−$130' }], total: '$950' };

/* ── De 1 a 150 sucursales ── */
export const escalaTB = [
  { n: '1 tienda', nombre: 'La boutique o la marca que arranca', cambia: ['La dueña compra, vende, cobra y contesta Instagram', 'La “tienda en línea” es el chat y el apartado en una libreta', 'La primera cápsula maquilada: 3 a 5 modelos, 30 a 50 piezas por color'], sistema: ['Un solo inventario para tienda, chat y web, desde el celular', 'Apartados con anticipo que no se pisan entre canales', 'Qué talla y color se vendió, para la próxima ficha técnica'], dato: { valor: '24', rotulo: 'existencias distintas en un solo modelo de tres colores' } },
  { n: '5 tiendas', nombre: 'La marca consolidada o la boutique del destino', cambia: ['Maquila el 60 o 70 %; compra tela por rollo', 'Traspasos diarios entre la de la plaza y la del hotel', 'Ya hay jefa de tiendas y alguien de e-commerce'], sistema: ['Existencias por sucursal y traspasos con confirmación', 'Comisión por vendedora y reporte por tienda', 'Curva de compra por pieza con los datos de cada sucursal'], dato: { valor: '2 toques', rotulo: 'para mandar seis L de la plaza al hotel' } },
  { n: '50 tiendas', nombre: 'La cadena regional: plazas y aeropuertos', cambia: ['Compradora por categoría: bikini, entero, resort, accesorios', 'Bodega central que surte por curva según el perfil de cada tienda', 'E-commerce con su equipo; el pedido sale de la tienda que tiene la talla'], sistema: ['Surtido por perfil de tienda con IA: Tulum pide S, Cancún M y L', 'Remate por temporada de toda la cadena, el mismo día en todos los canales', 'Finanzas por sucursal y por colección; el pedido en línea sale de la tienda que sí tiene la talla'], dato: { valor: '3', rotulo: 'remates al año en playa: después de Reyes, de Semana Santa y del regreso a clases' } },
  { n: '150 tiendas', nombre: 'La cadena nacional con franquicias y hoteles', cambia: ['Presupuesto de compra por temporada, región y línea: dama, niños, caballero, UV', 'Bodegas regionales: Riviera Maya, Pacífico, Bajío', 'Franquiciatarios y hoteles con su propio acceso'], sistema: ['Permisos por rol y por franquicia; consolidado nacional', 'Reglas para mover piezas entre tiendas y reabastecer desde bodega', 'La temporada en una pantalla: venta contra plan, qué porcentaje ya se vendió, remate y margen por región'], dato: { valor: '1 pantalla', rotulo: 'para ver la temporada completa de la cadena' } },
];

/* ── Objeciones: los dos caminos que ya probó ── */
export const problemasTB = {
  entrada: 'Casi toda marca de trajes de baño que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un sistema de ropa que ve “un bikini” donde hay dos piezas, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'las marcas de trajes de baño y playa que ya la usan',
};

/* ── Cifras de la casa ── */
export const cifrasTB = {
  foto: `${IMG}/escala.webp`,
  alt: 'Bodega central de una cadena de trajes de baño en Guadalajara, con las piezas por color y el tablero de existencias por tienda',
  frase: 'Desde una boutique en la playa hasta una cadena con bodega central.',
  encuadre: 'center 40%',
};
