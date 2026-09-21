/**
 * Contenido de la landing de BOLSAS Y ACCESORIOS DE PIEL (17-sep-2026). Sale de la ficha del oficio
 * (scratchpad/giros-fichas/bolsas-y-accesorios.md) con los dos dictámenes del referee aplicados:
 * aquí la bolsa no tiene talla, tiene modelo, color y piel; el lote se acaba y ese camel ya no
 * vuelve; el cuero es irregular y no se calcula sino se acomoda (de dos bandas salen 5 Totes o 4
 * según la garrapata); la piel se paga por decímetro y la banda es medio cuero de 250 dm² contra el
 * cuero entero de 400 a 450; el cinturón es la única pieza con talla y la talla es la del pantalón
 * (cintura + 5 cm, medida al hoyo de en medio); ANPIC es proveeduría (mayo y octubre-noviembre),
 * SAPICA es venta (marzo y agosto-septiembre) e Intermoda es enero y julio; el margen se calcula
 * sin IVA; el mayoreo del mismo lote puede irse abajo del costo; la pieza del aparador se quema.
 * Bloque propio: "El lote se acaba y ese camel ya no vuelve" (lote con su costo por decímetro,
 * consumo por modelo, la decisión de los últimos 60 dm²); no repite matriz de tallas, curva, set,
 * remate ni talla hermana de los otros giros.
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran como
 * parte del sistema; se construyen si el cliente las pide): nota de reparación con estatus, grabado
 * de iniciales como servicio en el ticket, lote de piel con su costo por decímetro, consumo de
 * decímetros por modelo, orden de producción a maquila con consumo pactado y vale de piel, herraje
 * y avíos como inventario con su tipo de cambio, garantía por pieza con su nota, etiqueta con
 * código por color y lote, y de qué lote salió cada bolsa del recibo de piel a la etiqueta.
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista, mockCalendario } from './_mocks';

const IMG = '/images/giros/bolsas-y-accesorios';

export const bannerBO = {
  eyebrow: 'SACS · Bolsas y accesorios de piel',
  titulo: 'La bolsa no tiene talla.',
  resalte: 'Tiene color, piel y lote.',
  sub: 'El modelo con sus colores y su piel, el lote con su costo por decímetro y lo que le queda, el consumo de cada modelo, el vale de piel de la maquila, la nota de reparación con estatus y el grabado de iniciales en el ticket — con un mismo inventario para tus tiendas, tu Instagram y tu WhatsApp.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Boutique moderna de bolsas de piel con la pared de un modelo en todos sus colores y la ficha del lote en la tablet del mostrador',
  avisos: [
    { modulo: 'Último del lote', texto: 'Camel lote 17 · quedan 60 dm² · alcanza para una Tote o siete carteras', pos: 1 as const, tono: 'verde' as const, sello: 'Hoy' },
    { modulo: 'Vale de piel', texto: 'Cruzada a maquila · 1,500 dm² entregados · faltan 60 por justificar', pos: 2 as const, tono: 'azul' as const, sello: 'Abril' },
    { modulo: 'Se está acabando', texto: 'Tote negro · básico · quedan 2 en piso · Buen Fin en 9 días', pos: 3 as const, tono: 'ambar' as const, sello: 'Noviembre' },
  ],
};

export const manifiestoBO = {
  intro: 'Sabemos cómo se vende la piel',
  frases: [
    'Te piden la Tote en <b>camel</b> y no sabes si el que te queda es del lote nuevo o del viejo. Son dos cafés distintos y el cliente lo caza en la foto.',
    'La piel subió tres veces este año y el <b>herraje</b> te lo cobran en dólares. Sigues vendiendo la bolsa al mismo precio y no sabes a cuánto te sale de verdad.',
    'Mandaste <b>3 docenas a maquila</b> con piel tuya y te regresaron 34 bolsas y ni un pedazo de piel. Nadie sabe dónde quedó lo demás.',
    'Te quedan <b>60 decímetros</b> del camel 17 y ese lote ya se acabó. ¿Cortas la última Tote o guardas para carteras? Si le erras, ese color se te muere en la pared.',
    'Tienes 60 bolsas del <b>lila</b> que se puso de moda hace dos años. La piel está perfecta. Se te clavaron.',
    'El cliente trajo su bolsa a reparar hace tres semanas y te pregunta por WhatsApp si ya está. No sabes si está en el taller o en la caja de la <b>trastienda</b>.',
    'En diciembre la <b>prensa de grabado</b> se vuelve un desastre: apartados con iniciales, envíos con iniciales, y una bolsa grabada con las letras equivocadas ya no la vendes.',
    'Subiste la foto del <b>verde</b> a Instagram, te pidieron doce, y en tienda tenías tres. Vendiste lo que no tenías.',
  ],
  cierre: 'Ningún sistema de ropa entiende que aquí no hay talla sino color y piel, que cada color nace de un lote que se acaba y no vuelve, ni que el cuero no se calcula sino se acomoda. Sacs sí: cada pantalla que sigue funciona igual en el mostrador, en la mesa de corte y en el WhatsApp. Y encima puedes poner agentes de IA para que hagan el trabajo repetitivo: el aviso del lote que se está acabando, el de la reparación que ya está lista y la compra de piel antes de ANPIC.',
};

export const variantesBO = {
  eyebrow: 'Un solo modelo',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“la Tote camel”.',
  sub: 'Aquí no hay talla: hay color y hay piel. El modelo vive años y lo que se repone es el color, y cada color nace de un lote con su tono, sus cicatrices y su precio por decímetro. Cuatro colores en cinco pieles son veinte existencias de un solo modelo, y al camel del lote 17 le quedan 60 decímetros.',
  ejeA: ['Vaqueta', 'Napa', 'Nobuk', 'Gamuza', 'Grabada'],
  filas: [
    { nombre: 'Camel · lote 17: quedan 60 dm²', img: `${IMG}/prod-camel.webp`, alt: 'Bolsa Tote de piel en camel, vaqueta natural' },
    { nombre: 'Negro · lote 21: quedan 1,400 dm²', img: `${IMG}/prod-negro.webp`, alt: 'Bolsa Tote de piel negra, el básico que nunca se liquida' },
    { nombre: 'Vino · lote 19: quedan 180 dm²', img: `${IMG}/prod-vino.webp`, alt: 'Bolsa Tote de piel en vino, color de temporada' },
    { nombre: 'Hueso · lote 22: quedan 1,200 dm²', img: `${IMG}/prod-hueso.webp`, alt: 'Bolsa Tote de piel en hueso, colección de primavera' },
  ],
  matriz: [
    [0, 2, 0, 1, 0],
    [7, 6, 2, 0, 5],
    [1, 0, 0, 0, 2],
    [4, 3, 1, 2, 0],
  ],
  unidad: 'piezas',
  genero: 'f' as const,
  umbralBajo: 1,
  leyendas: ['Con existencia', 'Queda la última', 'Agotada'] as [string, string, string],
  remate: 'El reporte dice que tienes 36 “Totes”. No dice que el camel de vaqueta —el de la foto que sube en Instagram— ya se fue, ni que lo que queda es del lote nuevo y sale medio tono más oscuro.',
};

export const cortinaBO = {
  titulo: '“¿Es del mismo camel?”',
  pieAntes: 'Dos cafés casi iguales<br />y la linterna del celular.',
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Encargada de una tienda de bolsas comparando dos Totes camel casi idénticas con la linterna del celular en la bodega',
  altDespues: 'La misma encargada escaneando la etiqueta de esa Tote camel y viendo en la tablet su color, su lote y la existencia por tienda',
  libreta: ['Camel — ¿lote 14 o 17?', 'Bolsa Sra. Mora — ¿ya la trajo el taller?', 'Maquila Cruzada — ¿cuánta piel regresó?'],
  filas: [
    { que: '“¿Es del mismo camel?”', donde: 'Se escanea la etiqueta', dato: 'Tote camel, lote 17, $12.80 el decímetro. Las dos de la pared son del 17; la del aparador es del 14 y va a rotación' },
    { que: '¿Cuánto queda del lote 17?', donde: 'La ficha del lote', dato: '60 dm² de los 5,000 que trajo la partida. Alcanza para una Tote de 45 o para siete carteras de 8. Después, ese camel se despide' },
    { que: '¿Cuánta piel regresó de maquila?', donde: 'El vale de la orden', dato: '1,500 dm² entregados, 34 bolsas y 260 dm² devueltos: faltan 60 dm² por justificar y se le cobran' },
    { que: '¿Ya está la bolsa de la Sra. Mora?', donde: 'La nota de reparación', dato: 'Cierre YKK de 30 cm, en garantía con su nota, en el taller desde el 4; sale el jueves y se le avisa por WhatsApp' },
  ],
  pieDespues: 'La misma encargada, la misma bodega. Ya no alumbra con el celular: escanea.',
};

export const casosBO = [
  {
    id: 'intermoda',
    titulo: 'Enero y julio: Intermoda, el mayoreo de toda la temporada',
    texto: 'En cuatro días se define cuánto va a fabricar la marca los siguientes seis meses. El pedido se levanta por cliente, modelo y color, con lo ya comprometido, los decímetros de piel que implica y quién quedó a crédito o a consignación la temporada pasada. Prometer de más quiebra al taller; prometer de menos deja la temporada corta.',
    remate: 'Intermoda es Guadalajara y es venta. SAPICA es León en marzo y en agosto. ANPIC es donde se compra la piel, y es otra feria.',
    img: `${IMG}/caso-feria.webp`,
    alt: 'Estand de una marca mexicana de bolsas en la feria de Guadalajara, con cueros colgados atrás y el comprador de una boutique levantando el pedido de temporada',
  },
  {
    id: 'diez-de-mayo',
    titulo: 'Abril y mayo: el 10 de mayo y el Hot Sale',
    texto: 'Lo que no está hecho el 30 de abril no se vende el 10 de mayo. La orden de producción sale de lo vendido por modelo × color en las dos semanas del año pasado contra lo que hay hoy en tienda y bodega, y de la piel que queda por lote. En mayo el Hot Sale es puro en línea, y ahí se vende con la foto de cada color.',
    remate: 'Si no hay foto del color, ese color no se vende. Y lo que se vende en línea se descuenta del piso en ese momento.',
    img: `${IMG}/caso-instagram.webp`,
    alt: 'Fundadora de una marca de bolsas fotografiando una cruzada de piel color por color para el catálogo del 10 de mayo',
  },
  {
    id: 'buen-fin',
    titulo: 'Noviembre: Buen Fin, básicos y el mayoreo que se va abajo del costo',
    texto: 'Dos cosas el mismo mes. El negro y el camel se acaban el 15 de diciembre si no se pidieron en noviembre, y cada Tote negra que falta en diciembre es una venta que no vuelve en enero. Y el descuento hay que ponerlo donde no queme: con el costo real de cada modelo × color según su lote, el sistema enseña el piso de precio al que ya no conviene bajar.',
    remate: 'La misma Tote, del mismo lote irrepetible, sale a $2,146 en piso y a $1,073 a la boutique, ambos sin IVA. Con el lote caro ese pedido se vende $66 abajo del costo.',
    img: `${IMG}/caso-mayoreo.webp`,
    alt: 'Showroom de mayoreo de una marca de bolsas en León con medias docenas surtidas por color y el comprador de una boutique escogiendo',
  },
  {
    id: 'enero',
    titulo: 'Enero: cambios, reparaciones y rematar los clavos',
    texto: 'Entra el cambio del regalo, entra la reparación de lo que se estrenó y hay que sacar lo que sobró antes de que llegue la primavera y estorbe. La lista de modelo × color con más de 120 días sin salir dice cuánto dinero está parado en cada uno y a qué precio conviene rematar sin vender abajo del costo real de su lote.',
    remate: 'La piel no caduca, pero el color sí. Cada mes que pasa ese lila vale menos aunque el cuero esté perfecto.',
    img: `${IMG}/caso-reparacion.webp`,
    alt: 'Mostrador de reparaciones de una tienda de bolsas de piel en enero, con el cliente entregando una bolsa de cierre roto y la encargada levantando la nota con foto',
  },
];

export const seccionesBO: SuiteSeccion[] = [
  {
    id: 'modelo', tag: 'Inventario',
    titulo: 'El modelo existe una vez; abajo van sus colores y sus pieles',
    texto: 'La Tote se da de alta una vez y debajo cuelgan sus colores, cada uno con su piel, su acabado y su herraje. Así no se duplica el producto y se sabe cuál color se acabó y en cuál tienda está. El cinturón es la única pieza con talla, y va en la misma matriz.',
    bullets: ['Color × piel como la variante real: la Tote camel de vaqueta no es la Tote camel de nobuk', 'Existencia por color en cada tienda y en bodega, desde el celular de la vendedora', 'Cinturón por talla en centímetros y en pulgadas: la talla es la del pantalón, cintura + 5'],
    visual: mockMatriz('Existencia por modelo y color · esta tienda', ['Camel', 'Negro', 'Cognac', 'Hueso', 'Vino'], [['Tote', [0, 7, 4, 3, 1]], ['Cruzada', [2, 6, 5, 0, 2]], ['Bucket', [1, 4, 0, 2, 0]]], 'El camel de la Tote en cero y el cognac de la Bucket también: son los dos que salen en la foto', [0, 0]),
  },
  {
    id: 'lote', tag: 'Piel y costo',
    titulo: 'El lote, con su costo por decímetro y con lo que le queda',
    texto: 'Cada partida que entra se registra con su piel, su color, su acabado, su calidad, su precio por decímetro y su tipo de cambio si vino de fuera, y se le da número de lote. Con el consumo de cada modelo —la Tote 45 dm², la cartera 8— el sistema dice cuántas piezas salen de lo que queda y cuánto cuesta cada una de verdad.',
    bullets: ['Costo real por lote: piel + herraje al tipo de cambio + forro y avíos + mano de obra', 'El margen se calcula sin IVA, que es como lo lee el contador; el precio de etiqueta ÷ 1.16', 'De qué lote salió cada bolsa, del recibo de piel a la etiqueta, con lo que pide la NOM'],
    visual: mockTicket('Costo real de la Tote · camel lote 17', [['Piel · 45 dm² con merma × $12.80', '$576.00'], ['Herraje · cierre, argollas, patitas y placa', '$180.00'], ['Forro y avíos · tela, hilo, tinta de canto', '$60.00'], ['Mano de obra por pieza', '$220.00']], ['Costo real', '$1,036.00'], 'Precio $2,490 con IVA = $2,146 sin IVA · margen real 51.7 %. Con el lote 23 a $15.10 baja a 46.9 %'),
  },
  {
    id: 'maquila', tag: 'Producción',
    titulo: 'La orden a maquila con consumo pactado y vale de piel',
    texto: 'Se pacta de entrada cuántos decímetros lleva cada pieza, se entrega la piel con vale firmado y el maquilador responde contra ese consumo. Lo que no salió, se cobra. La orden lleva modelo, cantidad, de qué lote, qué herraje y para cuándo, y el herraje y los avíos viven como inventario con su tipo de cambio.',
    bullets: ['Vale de piel entregada contra piezas devueltas y decímetros regresados', 'Herraje y avíos con existencia: cierres YKK por largo, argollas, hebillas, patitas y placas', 'Una producción se corta de un solo lote por color: no se mezcla el camel 14 con el 17'],
    visual: mockBarras('Cruzada · 3 docenas a maquila · camel lote 17', [['Cortado', '1,180 dm²', 79], ['Devuelto', '260 dm²', 17], ['Sin justificar', '60 dm²', 4]], '34 bolsas buenas de 36. Los 60 dm² que no regresaron se le cobran contra el consumo pactado'),
  },
  {
    id: 'servicio', tag: 'Servicio',
    titulo: 'Grabado de iniciales y nota de reparación con estatus',
    texto: 'El grabado en caliente con foil entra como un renglón del ticket, con sus letras y su fecha de entrega, para que en diciembre nadie grabe las iniciales equivocadas. Y la bolsa que el cliente trae a componer se recibe con foto, con su falla, con si es garantía o con costo y con la fecha en que se le entrega.',
    bullets: ['“Tote camel + grabado M.G.R. en dorado, sale el jueves”, en el mismo ticket', 'Se recibió, se revisó, está en el taller, ya está lista, se avisó: el cliente pregunta y hay respuesta', 'Garantía por pieza con su nota: el sistema dice si esa bolsa todavía la tiene'],
    visual: mockCalendario('Prensa de grabado · entregas comprometidas', 'Diciembre', 31, { 5: 'ok', 8: 'ok', 11: 'aviso', 12: 'lleno', 13: 'lleno', 14: 'lleno', 15: 'aviso', 18: 'lleno', 19: 'lleno', 20: 'aviso', 22: 'ok', 23: 'lleno' }, 'El 18 cierra el envío y el 24 el recoge en tienda. El taller ya no toma reparaciones: se dan a tres semanas'),
  },
  {
    id: 'canales', tag: 'Instagram y WhatsApp',
    titulo: '“Lo tengo en camel y en negro, ¿cuál te mando?”',
    texto: 'Cada color tiene su foto y esa es la que se manda, con lo que hay detrás. Del chat se cierra con link de pago y meses sin intereses, y la pieza se descuenta del piso en ese momento. La tienda en línea y los marketplaces venden del mismo inventario, que es el que más se descuadra.',
    bullets: ['Foto por color en el catálogo, con la existencia de ese color al lado', 'Link de pago con MSI y la comisión del banco cargada a esa pieza, no a un gasto general', 'Tienda en línea y marketplaces con el mismo inventario, y envíos con guía y estatus'],
    visual: mockLista('Instagram y WhatsApp · hoy', [['Tote camel · única pieza del lote 17 · apartada con anticipo', 'Apartado', 'ok'], ['Cruzada verde · doce pedidas · quedan 3 · foto pausada', 'Aviso', 'aviso'], ['Cartera hueso + grabado · link de pago a 6 MSI', 'Pagado', 'ok'], ['Pedido en línea · Bucket cognac · Monterrey', 'Guía lista', 'gris']], 'Cada chat queda en la ficha del cliente: se llevó la Tote en 2024 y la cartera en 2025'),
  },
  {
    id: 'mayoreo', tag: 'Mayoreo y córner',
    titulo: 'La boutique, la consignación y el córner en departamental',
    texto: 'La boutique cada vez compra menos y cada vez pide más a consignación: la bolsa y el riesgo son míos, parados en otra ciudad. El sistema separa lo vendido a crédito de lo dejado en consignación, concilia la liquidación del mes y, en departamental, la del córner con su comisión y sus notas de cargo.',
    bullets: ['Precio de mayoreo con su piso: abajo del costo real del lote, el sistema no deja cerrar', 'Consignación: lo dejado, lo vendido, lo liquidado y lo que sigue siendo mío', 'Concesión en departamental con cita en CEDIS, su código de etiqueta y su liquidación conciliada'],
    visual: mockTicket('Pedido de mayoreo · boutique de Querétaro', [['6 Tote camel · lote 23 · $1,245 c/u con IVA', '$7,470'], ['Precio sin IVA por pieza', '$1,073'], ['Costo real por pieza · lote 23', '$1,139'], ['Diferencia por pieza', '−$66']], ['Piso de precio con IVA', '$1,322'], 'Con este lote el pedido se vende abajo del costo. Para dejar 25 % hay que cobrar $1,519 sin IVA'),
  },
];

export const planoBO = [
  {
    id: 'pared', nombre: 'La pared de bolsas', simbolo: 'exhibidores' as const,
    foto: `${IMG}/zona-pared.webp`, alt: 'Pared iluminada de una tienda de bolsas con un modelo en todos sus colores, del hueso al negro, y el espejo de cuerpo entero',
    pie: 'Una fila es un modelo en todos sus colores, del claro al oscuro; los básicos a la altura de los ojos.',
    pregunta: '¿Este camel es del mismo lote?',
    caja: { x: 68, y: 82, w: 216, h: 80 },
    items: [
      { t: 'Existencia por modelo, color y piel, con el lote a la vista en la etiqueta colgante' },
      { t: 'Etiqueta con código por color y lote, y con lo que exige la NOM: piel o sintético, origen e importador' },
      { t: 'Un mismo color en una misma pared, de un mismo lote: dos cafés parecidos no se distinguen a ojo' },
      { t: 'La pieza de aparador se marca desde que se surte y se rota al mes: la exhibida se quema', plan: 'Controla' },
      { t: 'Si el color no está aquí, el sistema dice en cuál tienda está y lo trae con guía', plan: 'Controla' },
    ],
  },
  {
    id: 'caballero', nombre: 'El rincón de caballero y cinturones', simbolo: 'rieles' as const,
    foto: `${IMG}/zona-caballero.webp`, alt: 'Rincón de caballero de una tienda de piel con los cinturones colgados por talla, carteras, portafolios y la mesa de ajuste',
    pie: 'Los cinturones son la única matriz por talla de la tienda, y la talla es la del pantalón.',
    pregunta: '¿Tengo el 34 en café?',
    caja: { x: 68, y: 170, w: 216, h: 86 },
    items: [
      { t: 'Cinturón por talla en centímetros (85, 90, 95) y en pulgadas (32, 34, 36), con su existencia' },
      { t: 'La regla pegada por dentro del mostrador: cintura + 5 cm, medida del doblez de la hebilla al hoyo de en medio' },
      { t: 'Si sobra se corta del lado de la hebilla, se rebaja, se pica y se remonta: diez minutos, no un tijeretazo' },
      { t: 'Carteras, portafolios, mochilas, maletines y kits de viaje en su propia línea, con su ticket alto' },
      { t: 'Lo que pidieron y no había se apunta en caja y alimenta el pedido de junio y de diciembre', plan: 'Controla' },
    ],
  },
  {
    id: 'caja', nombre: 'Mostrador, caja y prensa de grabado', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-caja.webp`, alt: 'Mostrador de una tienda de bolsas con la prensa de grabado, las letras de metal en su charola, el rollo de foil y la vitrina de carteras',
    pie: 'Aquí se cobra, aquí se graban las iniciales y aquí se atora la fila con el “quiero factura”.',
    pregunta: '¿Para cuándo sale el grabado?',
    caja: { x: 68, y: 264, w: 216, h: 104 },
    items: [
      { t: 'Punto de venta que no se cae sin internet: el 10 de mayo no se puede parar' },
      { t: 'Meses sin intereses con la comisión del banco a la vista y cargada a esa pieza', plan: 'Controla' },
      { t: 'Grabado de iniciales como renglón del ticket, con sus letras, su foil y su fecha de entrega', plan: 'Fideliza' },
      { t: 'Factura global diaria del mostrador, CFDI 4.0 para el corporativo y complemento de pago para la boutique' },
      { t: 'Vitrina de carteras, tarjeteros, monederos, llaveros y cosmetiqueras, contada al cerrar' },
    ],
  },
  {
    id: 'trastienda', nombre: 'Trastienda: reparaciones, apartados y envíos', simbolo: 'paquetes' as const,
    foto: `${IMG}/zona-trastienda.webp`, alt: 'Trastienda de una tienda de bolsas con la repisa de reparaciones en fundas de tela, la de apartados con su fecha y la mesa de empaque',
    pie: 'La bolsa a componer, la apartada de noviembre y el pedido de Instagram salen del mismo cuarto.',
    pregunta: '¿Dónde está la bolsa de la Sra. Mora?',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Nota de reparación con foto, falla, si es garantía o con costo y fecha de entrega', plan: 'Fideliza' },
      { t: 'Estatus que el cliente puede preguntar: se recibió, está en el taller, ya está lista, se avisó', plan: 'Automatiza' },
      { t: 'Refacciones con existencia: cierres YKK por largo y color, asas, correas, argollas y tinta de canto' },
      { t: 'Repisa de apartados con nombre, anticipo, saldo y fecha: se llena en octubre y noviembre' },
      { t: 'Mesa de empaque con guía impresa y la tabla de “sale hoy / sale mañana” para línea y marketplaces' },
    ],
  },
  {
    id: 'taller', nombre: 'El taller y la mesa de corte', fuera: true, simbolo: 'armado' as const,
    foto: `${IMG}/zona-taller.webp`, alt: 'Taller de marroquinería en León con la mesa de corte, las bandas del lote en uso, los suajes por modelo y la rebajadora',
    pie: 'Aquí el cuero no se calcula: se acomoda. De dos bandas salen cinco Totes o cuatro, según la garrapata.',
    pregunta: '¿Cuántos decímetros le quedan al 17?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Cada lote con su tarjeta: piel, color, número, precio por decímetro y cuántos decímetros quedan', plan: 'Controla' },
      { t: 'Consumo por modelo con merma: la Tote 45 dm², la cartera 8; el rendimiento real se reporta al cortar' },
      { t: 'Orden de producción de la semana: modelo, cantidad, lote, herraje, para qué tienda o cliente' },
      { t: 'Vale de piel de lo que salió a maquila, con su consumo pactado y lo que regresó', plan: 'Controla' },
      { t: 'Suajes por modelo, rebajadora, punto de silla y pintado de cantos: el acabado que se cobra' },
    ],
  },
];

export const pasosBO = [
  { cuando: 'Día 1', titulo: 'Tus modelos y tus lotes, cargados', texto: 'Nos das tu lista o tu sistema actual y lo subimos nosotros. No capturas nada.', detalle: 'Modelo con sus colores y sus pieles, el consumo de cada uno en decímetros, los lotes que tienes abiertos con su precio, y la existencia real de cada tienda.', img: `${IMG}/proceso-recibir.webp`, alt: 'Recepción de una entrega de maquila en la bodega de una marca de bolsas, contando pieza por pieza y etiquetando con su lote' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus pieleros, tus maquilas, tus tiendas y tus reglas.', detalle: 'El consumo pactado de cada modelo, quién puede cerrar abajo del piso de precio, la comisión del córner, el escalón de mayoreo y la ventana de garantía.', img: `${IMG}/proceso-lote.webp`, alt: 'Comprador de piel midiendo y registrando una partida de vaqueta camel con su número de lote en la mesa del taller' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Escanear la etiqueta y levantar la nota de reparación se aprende en media hora.', detalle: 'Y se practica lo de todos los días: el grabado en el ticket, el apartado con anticipo, el ajuste del cinturón y la foto por color para Instagram.', img: `${IMG}/proceso-grabado.webp`, alt: 'Vendedora grabando las iniciales de un cliente en una cartera de piel con la prensa de calor y el rollo de foil dorado' },
  { cuando: 'Día 4', titulo: 'Arranca una tienda', texto: 'La primera sucursal vende con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con los apartados y las reparaciones ya migrados: ningún cliente llega por su bolsa y se encuentra con que su papelito no existe.', img: `${IMG}/proceso-corte.webp`, alt: 'Maestro cortador acomodando los suajes sobre una banda de camel, esquivando las cicatrices y la garrapata' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día.', detalle: 'Y el traspaso de colores entre tiendas ya corre desde el primer fin de semana, con su guía y con el lote anotado.', img: `${IMG}/proceso-armado.webp`, alt: 'Artesanos armando el cuerpo de una bucket sobre la horma y las correas terminadas colgadas en el taller' },
];
export const ticketBO = { lineas: [{ n: 'Tote camel · vaqueta · lote 17', p: '$2,490' }, { n: 'Grabado de iniciales · M.G.R. en dorado', p: '$250' }, { n: 'Cartera hueso · del retazo del mismo lote', p: '$690' }], total: '$3,430' };

export const escalaBO = [
  { n: '1 tienda', nombre: 'La marca que empezó en Instagram', cambia: ['La dueña diseña, compra la piel, revisa la maquila, contesta el WhatsApp y graba las iniciales', 'El inventario está en la cabeza y en una libreta; el de piso, el de Instagram y el de marketplaces son “el mismo” hasta que no lo son', 'El costo por modelo se saca una vez al año, con el precio de piel de ese día y sin contar la comisión del banco'], sistema: ['Un solo inventario por modelo × color para piso, WhatsApp, tienda en línea y marketplaces', 'El lote con su precio por decímetro y el consumo de cada modelo', 'El apartado con anticipo, el link de pago con MSI y la factura global del día'], dato: { valor: '250 dm²', rotulo: 'tiene una banda, y el cuero entero de 400 a 450: así se compra la piel' } },
  { n: '5 tiendas', nombre: 'La marca regional con taller', cambia: ['Taller propio en León, gerente de tiendas y vendedoras por comisión', 'El lote se reparte entre tiendas y hay dos tonos del mismo color en la misma pared', 'Las reparaciones se concentran en la central y nadie sabe dónde está cada bolsa'], sistema: ['Existencia por sucursal, traspaso con guía y reposición de básicos por tienda', 'Nota de reparación compartida entre tienda y central, con su estatus', 'Costo por lote, consignación en boutiques con su liquidación y comisiones de vendedoras'], dato: { valor: '50 a 70 %', rotulo: 'de la venta son los básicos: negro, camel, café, tan y cognac' } },
  { n: '50 tiendas', nombre: 'La marca nacional con córners', cambia: ['Fábrica propia, varias maquilas, bodega central y córners en departamental', 'Compras planea la piel a seis meses con especificación de tono; producción trabaja por órdenes semanales', 'Cada plaza vende distinto: la fina, la de outlet y la de aeropuerto no piden lo mismo'], sistema: ['Surtido sugerido por tienda y reposición automática de básicos', 'La orden de producción ligada al lote de piel y al consumo en decímetros', 'Concesión con su liquidación conciliada y sus notas de cargo, y finanzas consolidadas'], dato: { valor: '30 a 35 %', rotulo: 'se queda la departamental del córner: el margen se decide antes de entrar' } },
  { n: '150 tiendas', nombre: 'La cadena grande con exportación', cambia: ['Colecciones decididas a un año, partidas de miles de cueros y tenería que entrega por especificación de tono', 'El sistema propone el traspaso y la gerencia lo autoriza', 'Reparación y grabado facturan solos y tienen su propio tiempo de respuesta'], sistema: ['De qué lote salió cada bolsa, del recibo de piel a la etiqueta', 'Utilidad real por modelo × color × lote × canal: piso, línea, mayoreo y concesión', 'Exportación con etiqueta y factura por país, y la NOM en lo que se vende aquí'], dato: { valor: '1 lote', rotulo: 'por color en cada producción: el camel 14 nunca se mezcla con el camel 17' } },
];

export const problemasBO = {
  doc1: {
    membrete: 'Sistema de ropa', sub: 'Reporte de inventario',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'EXIST.'],
    lineas: [
      { a: 'SKU-2214', b: 'BOLSA TOTE CAMEL', c: '36' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿de qué lote?', '¿cuánto me costó?'],
    sello: 'NO VE<br />EL LOTE',
    notas: [
      'Te dice que hay <b>36</b>. No te dice que son de <b>dos lotes</b> y que en la pared se ven dos cafés.',
      'Te pide una talla que aquí no existe, y no sabe qué es un <b>decímetro</b> ni qué consume cada modelo.',
      'El costo es el que capturaste una vez: no cambia con el lote ni con el <b>tipo de cambio</b> del herraje.',
      'No sabe de piel entregada a maquila, ni de <b>vale</b>, ni de piel que no regresó.',
    ],
  },
  doc2: {
    membrete: 'Desarrollo a la medida', sub: 'Propuesta · rev. 4',
    cab: ['CONCEPTO', 'PLAZO'],
    lineas: [
      { a: 'COSTO POR LOTE', b: 'FASE 2' },
      { a: 'ENTREGA REAL', b: 'PASÓ DICIEMBRE', tachado: true },
      { a: 'NOTA DE REPARACIÓN', b: 'NO' },
    ],
    margen: ['+ 3 adendas', 'y llegó ANPIC'],
    sello: 'LLEGÓ<br />TARDE',
    notas: [
      'Costó <b>más de lo cotizado</b> y el costo por lote quedó para la fase 2.',
      'Funciona… mientras <b>quien lo hizo conteste el teléfono</b>. Tu mes es diciembre.',
      'Cada cambio chico —el vale de piel de la maquila— es <b>una cotización nueva</b>.',
      'No trae estatus de reparación ni grabado en el ticket. En diciembre, <b>la prensa se lleva en un cuaderno</b>.',
    ],
  },
  filas: [
    { que: 'Color × piel en vez de talla, con su foto por color', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Lote con su costo por decímetro y lo que le queda', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Consumo por modelo y orden a maquila con vale de piel', generico: 'No existe', medida: 'Rara vez', sacs: 'Incluido' },
    { que: 'Nota de reparación con estatus y garantía por pieza', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'Grabado de iniciales como servicio en el ticket', generico: 'No existe', medida: 'Rara vez', sacs: 'Incluido' },
    { que: 'Consignación, córner y piso de precio de mayoreo', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Tiempo para arrancar', generico: 'Días', medida: '4 a 9 meses', sacs: 'Días' },
    { que: 'Quién lo mantiene', generico: 'Su proveedor', medida: 'Tú, si lo encuentras', sacs: 'Nosotros, a diario' },
  ],
  entrada: 'Casi toda marca de bolsas que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un sistema de ropa que cuenta 36 Totes sin saber de qué lote son, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'las marcas y tiendas de bolsas y accesorios de piel que ya la usan',
};

export const cifrasBO = {
  foto: `${IMG}/escala.webp`,
  alt: 'Tienda insignia de una marca de bolsas de piel en una plaza mexicana, con la pared de un modelo en todos sus colores y la estación de grabado junto a la caja',
  frase: 'Desde la marca que empezó en Instagram hasta la cadena con fábrica en León y córners en departamental.',
  encuadre: 'center 45%',
};
