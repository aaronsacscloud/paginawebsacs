/**
 * Contenido de la landing de TELAS Y MERCERÍA (17-sep-2026). Sale de la ficha del oficio v2
 * (scratchpad/giros-fichas/telas-y-merceria.md), aprobada por una dueña con 30 años en el giro y 7
 * tiendas. Vocabulario del piso, tal cual: la PIEZA es la unidad (no "el rollo"), el saldo es lo que
 * queda de la pieza abierta, la punta o la colilla es el último pedazo, el retazo ya no da un corte
 * y se va por kilo o por bulto al retacero, los avíos es todo lo que no es la tela, el medio mayoreo
 * arranca en 10 metros, el metro clavado es la solera de la orilla del mostrador, la revisadora mide
 * y vuelve a enrollar, la gruesa son 144, los botones vienen en cartón, y en el mostrador se dice
 * "¿se lo rasgo o se lo corto?", "sáquelo a la luz" y "tela cortada no se cambia". El tono es el
 * baño de tintura; en el sistema el campo se llama lote, con el cliente se dice tono.
 *
 * El eje de toda la página, y lo único que no cuentan las otras landings de moda: EN TELAS LAS
 * EXISTENCIAS NO SE SUMAN. Tres saldos de cinco, cuatro y tres metros no son doce metros, porque el
 * corte tiene que salir de una sola pieza y del mismo baño. Y de ahí sale el desarrollo: la vida de
 * la pieza, que se va muriendo corte por corte —de pieza a tramo, de tramo a saldo, de saldo a
 * retazo por kilo—. La báscula NO mide metros: solo pesa el retazo; los metros se miden contra el
 * metro clavado o en la revisadora.
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran como
 * parte del sistema; se construyen si el cliente las pide): folio por pieza serializada con tono y
 * metros, venta por metro con fracción, el saldo como inventario chiquito, etiqueta por pieza,
 * recepción midiendo con reclamo de faltante, recosteo con flete y tipo de cambio, pasar saldo a
 * retazo por kilo, báscula en la venta de retazo, tono en la pieza, conversión gruesa → docena →
 * pieza, doble unidad metro/pieza en listón y elástico, la receta de avíos guardada, el salto
 * automático de escalón por metros, el bloqueo de devolución de tela cortada, el detalle por pieza y
 * tono en existencias por sucursal, el vencimiento automático del apartado, los metros por pieza en
 * el mensaje de WhatsApp, la venta en línea por metro con mínimo y pasos de 0.25, el conteo en
 * metros por pieza, la alerta de tono que se acaba y el número de cuántas veces recuperas cada pieza.
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista, mockCalendario } from './_mocks';

const IMG = '/images/giros/telas-y-merceria';

export const bannerTM = {
  eyebrow: 'SACS · Telas y mercería',
  titulo: 'Tres saldos de cinco, cuatro y tres',
  resalte: 'no son doce metros.',
  sub: 'Cada pieza con su folio, su tono y sus metros; la venta por metro con fracción desde la mesa de corte; la tela y los avíos en una sola nota; la pieza que se mide al recibirla y el faltante que se le reclama al proveedor; y el aviso de último saldo antes de que se te muera en el cajón del retazo — con el mismo inventario para tus tiendas, tu WhatsApp y tu tienda en línea.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Tienda de telas moderna con la pared de piezas por color, la mesa de corte con su metro clavado y la tablet del mostrador',
  avisos: [
    { modulo: 'Último saldo', texto: 'Popelina vino · pieza 4502 · quedan 3.00 m · ya llegó el baño nuevo', pos: 1 as const, tono: 'ambar' as const, sello: 'Hoy' },
    { modulo: 'Llegó la pieza', texto: 'Gabardina azul marino · facturados 50 · medidos 47.50 · faltante reclamado', pos: 2 as const, tono: 'azul' as const, sello: 'Recepción' },
    { modulo: 'Apartado con fecha', texto: 'Sra. Robles · pieza cerrada de chifón vino · vence en 3 días', pos: 3 as const, tono: 'verde' as const, sello: 'Mayo' },
  ],
};

export const manifiestoTM = {
  intro: 'Sabemos cómo se vende la tela',
  frases: [
    'El sistema dice que hay <b>12 metros de vino</b> y son tres saldos de cinco, cuatro y tres, de tres baños distintos. La clienta ocupa seis de un solo tono y no le puedes dar ninguno.',
    'La pieza decía <b>50</b> y trajo 47 y medio. Lo descubriste tres meses después, cuando ya no tenías a quién reclamarle.',
    'Vendiste <b>metro y cuarto</b> y el sistema no te deja poner .25; tienes que hacer trampa con la nota.',
    'Se te acabó el vino en pleno diciembre, llegó el nuevo y es <b>otro baño</b>. La clienta lo notó y te lo regresó hecho vestido.',
    'La costurera viene <b>por la tela y los avíos</b>, la de mostrador tarda veinte minutos en la nota y siempre se le olvida cobrar el hilo.',
    'Tienes tres cajones de <b>retazo</b> que valen dinero y nadie sabe cuánto es ni cuándo se vendió.',
    'Te piden foto por <b>WhatsApp</b>, la mandas desde el centro, y cuando llega la clienta a la del norte ya no había ese tono.',
    'Compraste <b>treinta piezas</b> de terciopelo rojo para Navidad y en marzo todavía tienes once; no supiste cuánto vendiste el año pasado.',
  ],
  cierre: 'Ningún sistema entiende que aquí las existencias no se suman: que el corte sale de una sola pieza y de un solo baño, y que cada corte deja la pieza más chica hasta que un día ya no es tela, es retazo. Sacs sí: cada pantalla que sigue funciona igual en la mesa de corte, en la mercería y en el WhatsApp. Y encima puedes poner agentes de IA para que hagan el trabajo repetitivo: el aviso de último saldo, el reclamo del faltante al proveedor y el pedido de temporada antes de que se encarezca.',
};

export const variantesTM = {
  eyebrow: 'Una sola tela',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“hay 12 metros de vino”.',
  sub: 'La popelina no vive en el reporte: vive en piezas, y cada pieza trae su baño. Cuatro colores en cinco baños son veinte existencias distintas de una sola tela, y lo que ves en cada casilla son los metros que quedan de esa pieza — no un total que se pueda sumar.',
  ejeA: ['Baño A', 'Baño B', 'Baño C', 'Baño D', 'Baño E'],
  filas: [
    { nombre: 'Vino', img: `${IMG}/prod-vino.webp`, alt: 'Pieza de popelina vino doblada en tabla' },
    { nombre: 'Azul rey', img: `${IMG}/prod-azul.webp`, alt: 'Pieza de popelina azul rey doblada en tabla' },
    { nombre: 'Blanco', img: `${IMG}/prod-blanco.webp`, alt: 'Pieza de popelina blanca doblada en tabla' },
    { nombre: 'Negro', img: `${IMG}/prod-negro.webp`, alt: 'Pieza de popelina negra doblada en tabla' },
  ],
  matriz: [
    [5, 4, 3, 0, 0],
    [0, 12, 0, 50, 0],
    [2, 0, 26, 0, 50],
    [0, 0, 1, 18, 0],
  ],
  unidad: 'metros',
  genero: 'm' as const,
  leyendas: ['De aquí sale un corte', 'Último saldo', 'De ese baño no hay'] as [string, string, string],
  remate: 'La clienta pedía seis metros de vino para un corte de vestido. Hay cinco, cuatro y tres —doce— y son tres baños distintos: doce metros, y ninguna venta. En telas las existencias no se suman.',
};

export const cortinaTM = {
  titulo: '“¿Cuánto te queda del vino?”',
  pieAntes: 'La pieza medio desenrollada<br />y la clienta esperando.',
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Empleada de una tienda de telas desenrollando una pieza de gabardina sobre el mostrador para contar a mano lo que queda',
  altDespues: 'La misma empleada escaneando la etiqueta de la tabla de la pieza y viendo en la tablet los metros que quedan y su tono',
  libreta: ['Vino chifón — ¿cuánto queda?', 'Sra. Robles — apartó la pieza, ¿qué día?', 'Gabardina marino — ¿en cuál tienda?'],
  filas: [
    { que: '“¿Cuánto te queda del vino?”', donde: 'Se escanea la tabla de la pieza', dato: 'Pieza 4502, tono A: quedan 3.00 m. Y la 4488, cerrada de 50, es del tono B: no se mezclan' },
    { que: '¿La pieza trajo sus metros?', donde: 'La recepción midiendo', dato: 'Facturados 50, medidos 47.50: faltan 2.50 y el reclamo al proveedor sale el mismo día' },
    { que: '¿En cuál tienda está el marino?', donde: 'Existencias por sucursal, pieza por pieza', dato: 'En la del norte hay 6 piezas cerradas del mismo tono; traspaso con folio, no “de ese color”' },
    { que: '¿Ya es retazo o todavía sale un corte?', donde: 'El aviso de último saldo', dato: '1.20 m de popelina: abajo del mínimo de su familia. Descuento de último saldo con clave, o pasa a retazo por kilo' },
  ],
  pieDespues: 'La misma empleada, la misma clienta. Ya no desenrolla para contar: escanea.',
};

export const casosTM = [
  {
    id: 'escolar',
    titulo: 'Julio: las piezas cerradas de uniformes',
    texto: 'El taller pide 40 piezas de gabardina azul marino del mismo tono y las quiere en dos días. Existencias por sucursal pieza por pieza, con folio, tono y metros; las piezas cerradas contadas aparte de los saldos, y el traspaso entre tiendas respetando el tono.',
    remate: 'Si mezclas dos baños, el taller no te regresa la tela: te regresa las prendas hechas.',
    img: `${IMG}/caso-escolar.webp`,
    alt: 'Dos hombres cargando al hombro piezas cerradas de gabardina azul marino a la camioneta del taller de uniformes',
  },
  {
    id: 'temporadas',
    titulo: 'De septiembre a diciembre: cuatro temporadas encimadas',
    texto: 'Patrio, muertos, Revolución y Navidad-Guadalupe entran una tras otra con quince días de diferencia. El reporte de temporada año contra año, por tela y por color, dice cuánta manta, cuánto listón tricolor y cuánto terciopelo se vendieron el año pasado, qué quedó y a cuánto se remató.',
    remate: 'El rojo patrio y el rojo de Navidad no son el mismo rojo. Lo que no salió el 17 se remata el 17.',
    img: `${IMG}/caso-navidad.webp`,
    alt: 'Cambio de aparador en una tienda de telas: se baja el listón tricolor y entran el tul negro, la manta cruda y el terciopelo rojo',
  },
  {
    id: 'fiesta',
    titulo: 'Mayo y junio: fiesta, graduación y XV años',
    texto: 'La modista compra la tela y los avíos para seis damas del mismo tono, y el tono se acaba a la tercera porque eran tres piezas distintas. Apartado de pieza o de saldo con anticipo y con fecha, y el aviso de “de esta pieza quedan X metros” dentro de la venta.',
    remate: 'Con la pieza apartada a tiempo la venta era de 18 metros. Sin ella, fue de 7.',
    img: `${IMG}/caso-fiesta.webp`,
    alt: 'Modista y empleada midiendo satín para las seis damas de unos XV años sobre la mesa de corte de una tienda de telas',
  },
  {
    id: 'enero',
    titulo: 'Enero: el remate, el conteo y el fiado de diciembre',
    texto: 'Se cuenta toda la tienda pieza por pieza y saldo por saldo —midiendo contra el metro del mostrador o en la revisadora, no pesando—, se decide qué pasa a retazo y a cuánto, y se cobra el fiado de diciembre a costureras y talleres.',
    remate: 'Ahí sale el número del año: cuántas veces recuperaste lo que pagaste por cada pieza.',
    img: `${IMG}/caso-costurera.webp`,
    alt: 'Costurera pagando el fiado de diciembre en el mostrador de una tienda de telas mientras se cuentan las piezas en enero',
  },
];

export const seccionesTM: SuiteSeccion[] = [
  {
    id: 'pieza', tag: 'Inventario',
    titulo: 'La pieza, con su folio, su tono y sus metros',
    texto: 'El mismo artículo vive en varias piezas físicas y cada una es su propia existencia. No hay “12 metros de popelina lila”: hay la pieza 4517 con 6.40 del tono A y la 4488 cerrada de 50 del tono B. Cada corte baja esa pieza, no el artículo, y el saldo se queda con su folio y sus metros a la vista.',
    bullets: ['Folio, tono, ancho y metros por pieza; las cerradas contadas aparte de los saldos', 'Etiqueta con código de barras en la tabla: la de mostrador escanea la pieza y no teclea el color', 'Dos piezas del mismo color y distinto baño no se ofrecen juntas para un mismo corte'],
    visual: mockBarras('Popelina vino · lo que queda, pieza por pieza', [['4502 · A', '5.00 m', 10], ['4488 · B', '4.00 m', 8], ['4502 · C', '3.00 m', 6], ['4517 · D', '50 m · cerrada', 100]], 'La clienta pide 6 m de un solo tono: de las tres abiertas no sale, aunque sumen doce'),
  },
  {
    id: 'mostrador', tag: 'Mesa de corte',
    titulo: 'El metro con fracción, y la tela con sus avíos en una sola nota',
    texto: 'Se vende como se pide: metro y cuarto, dos y medio, ochenta centímetros. Se escanea la pieza, se mide contra el metro clavado, se pregunta “¿se lo rasgo o se lo corto?”, se da el dedito de más y el corte y la nota son lo mismo. Y en el mismo cobro entran los avíos: forro, cierre, hilo, entretela, botones y listón.',
    bullets: ['Venta por metro con centavos de metro desde la tablet del mostrador', 'La receta de avíos guardada por prenda, para volver a cobrar el juego completo igual', 'Menudeo, medio mayoreo desde 10 metros, mayoreo y pieza cerrada: el precio salta solo', 'Descuento de último saldo con clave de la encargada, y tela cortada bloqueada para devolución'],
    visual: mockTicket('Una nota · la tela y sus avíos', [['Chifón vino · 2.50 m · pieza 4471', '$437'], ['Forro · 2.50 m', '$162'], ['Cierre invisible 50 · color 415', '$28'], ['Hilo · 2 carretes del tono', '$36'], ['Entretela · 0.60 m', '$21'], ['Botones · 6 pz del cartón', '$30'], ['Listón del 5 · 1.20 m', '$14']], ['Total', '$728'], 'Cuatro unidades distintas —metro, pieza, cartón y carrete— en un solo cobro'),
  },
  {
    id: 'recepcion', tag: 'Recepción y costo',
    titulo: 'La pieza se mide antes de subirla al anaquel',
    texto: 'La que dice 50 muchas veces trae 47.5. Se compara lo facturado contra lo medido —contra el metro clavado o en la revisadora—, se captura folio, tono, ancho y metros reales, y el faltante sale el mismo día como reclamo al proveedor o como nota de crédito. De ahí sale también el costo real por metro.',
    bullets: ['Metros facturados contra metros medidos, con el faltante y su reclamo', 'Costo por metro con flete y tipo de cambio si la tela es de importación', 'La pieza sale de recepción con su etiqueta: folio, tono, ancho y precio'],
    visual: mockLista('Recepción de hoy · 6 piezas', [['Gabardina marino · facturados 50 · medidos 47.50', 'Faltan 2.50', 'aviso'], ['Popelina blanca · facturados 50 · medidos 50.00', 'Completa', 'ok'], ['Chifón vino · facturados 30 · medidos 28.80', 'Faltan 1.20', 'aviso'], ['Terciopelo rojo · facturados 25 · medidos 25.00', 'Completa', 'ok']], '2.5 m por pieza × 300 piezas al año × $85 son $63,750 que hoy se regalan'),
  },
  {
    id: 'saldos', tag: 'Saldos y retazo',
    titulo: 'El último saldo, antes de que se muera en el cajón',
    texto: 'Cada corte deja la pieza más chica, más difícil de vender y menos cara. Cuando el saldo baja del mínimo de su familia —o cuando ya llegó el baño nuevo del mismo color— sale el aviso. La encargada decide: descuento de último saldo, o pasarlo a retazo. Ahí sí se pesa en la báscula, cambia de unidad a kilo y se va al cajón con su precio.',
    bullets: ['Aviso de último saldo por familia: popelina abajo de 1 m, tela de vestido abajo de 1.50, cortina abajo de 2.50', 'El saldo cuyo color ya tiene baño nuevo en la tienda sale primero, aunque le queden 4 metros', 'Retazo por kilo o por bulto en la misma nota que lo demás, y la paca al retacero'],
    visual: mockTicket('Pieza 4471 · de 50 m, qué se cobró', [['44 m cobrados como tela · $140', '$6,160'], ['6 m que se quedaron colgados → 1.9 kg de retazo · $60', '$114'], ['Como tela, esos 6 m valían', '$840']], ['Cobrado de la pieza', '$6,274'], 'Pagaste $4,250 por ella: la recuperaste 1.48 veces. Con el aviso a tiempo, 1.63'),
  },
  {
    id: 'temporada', tag: 'Temporada y compra',
    titulo: 'Cuatro temporadas en cien días, y la compra dos meses antes',
    texto: 'Patrio, muertos, Revolución y Navidad-Guadalupe. La manta, el listón tricolor, la gamuza y el terciopelo se piden en julio y agosto: el que compra Navidad en noviembre ya llegó tarde y paga más caro. El reporte año contra año, por tela y por color, dice cuánto se vendió, qué quedó y a cuánto se remató.',
    bullets: ['Reporte de temporada año contra año por tela y color, antes de recibir al agente con su muestrario', 'Lo escolar no se remata: se guarda de un año a otro con su costo a la vista', 'La fantasía sí se remata, porque el año que entra ya cambió la moda'],
    visual: mockCalendario('Noviembre · el mes de la manta y el listón', 'Noviembre', 30, { 3: 'aviso', 14: 'lleno', 15: 'lleno', 16: 'lleno', 17: 'lleno', 18: 'ok', 19: 'ok', 20: 'lleno', 21: 'ok', 22: 'ok', 25: 'ok', 27: 'ok', 29: 'ok' }, 'Del 3 se remata muertos; del 14 al 17 el Buen Fin; el 20 la Revolución; y del 20 en adelante Navidad y Guadalupe'),
  },
  {
    id: 'lejos', tag: 'Sucursales, WhatsApp y talleres',
    titulo: '“¿Tiene el chifón en vino? Mándeme foto”',
    texto: 'La de mostrador extiende el tramo, lo saca a la luz de la puerta —porque con el foco el tono miente—, lo fotografía y contesta desde el inventario: “quedan 8 metros del tono A en centro”. Cobra por transferencia y manda los metros cortados con guía. Y el taller pide su cotización por 40 piezas, recibe remisiones todo el mes y una sola factura al corte.',
    bullets: ['Existencias por sucursal, pieza por pieza y con su tono, para contestar sin llamar', 'Apartado de pieza o saldo con anticipo y fecha: si no se liquida en 8 o 15 días, se libera solo', 'Crédito a costureras y talleres con saldo, cobro de los sábados y corte de mes', 'Tienda en línea por metro con mínimo y pasos de 0.25, para que nadie venda 8 m de una pieza que tiene 6'],
    visual: mockLista('El WhatsApp de hoy', [['Chifón vino · pieza 4471 · quedan 3.00 m en centro', 'Foto enviada', 'ok'], ['Gabardina marino · 40 piezas cerradas · taller El Roble', 'Cotización', 'aviso'], ['Sra. Robles · apartó pieza de satín · vence el jueves', 'Con anticipo', 'ok'], ['Pedido en línea · 2.25 m de popelina lila · Mérida', 'Guía lista', 'gris']], 'Cada chat queda en la ficha de la costurera, con lo que compra y cada cuándo'),
  },
];

export const planoTM = [
  {
    id: 'pared', nombre: 'La pared de piezas y el aparador', simbolo: 'anaqueles' as const,
    foto: `${IMG}/zona-pared.webp`, alt: 'Pared de piezas de tela hasta el techo de una tienda de telas, ordenadas por familia y por color',
    pie: 'Por familia —básicas, fantasía, novia, cortina— y dentro de cada familia por color; lo de temporada al frente.',
    pregunta: '¿Cuánto me queda del vino, y de qué tono?',
    caja: { x: 68, y: 82, w: 216, h: 80 },
    items: [
      { t: 'Existencias pieza por pieza, con folio, tono, ancho y metros' },
      { t: 'Etiqueta con código de barras en la tabla de cada pieza, impresa desde el sistema' },
      { t: 'Los saldos chicos acostados encima: cada uno con sus metros, no revueltos con las cerradas' },
      { t: 'Aviso de último saldo cuando baja del mínimo de su familia', plan: 'Controla' },
      { t: 'Conteo cíclico por pared o por familia, sin cerrar la tienda un día entero', plan: 'Controla' },
    ],
  },
  {
    id: 'corte', nombre: 'La mesa de corte y la caja', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-mostrador.webp`, alt: 'Mesa de corte de madera con la solera metálica clavada a la orilla, tijeras grandes y la tablet del mostrador',
    pie: 'Tres a seis metros de madera con el metro clavado, la cinta al cuello, el papel de estraza y el mecate.',
    pregunta: 'Vendí metro y cuarto, ¿cómo lo cobro?',
    caja: { x: 68, y: 170, w: 216, h: 86 },
    items: [
      { t: 'Venta por metro con fracción escaneando la pieza: el corte y la nota son lo mismo' },
      { t: 'La tela y todos sus avíos en una sola nota, con sus cuatro unidades distintas' },
      { t: 'Cuatro escalones de precio: menudeo, medio mayoreo, mayoreo y pieza cerrada' },
      { t: 'Descuento con clave de la encargada; tela cortada bloqueada para devolución' },
      { t: 'Cobra con y sin internet, corte de caja por turno y retiros: siete de cada diez pesos son efectivo' },
    ],
  },
  {
    id: 'merceria', nombre: 'La mercería: los avíos', simbolo: 'gondolas' as const,
    foto: `${IMG}/zona-merceria.webp`, alt: 'Mostrador de mercería con cajoneras de botones, la pared de conos de hilo por color y las varillas de listón',
    pie: 'Si no hay el hilo del color, se cae la venta de la tela: la clienta se la lleva a la tienda de enfrente.',
    pregunta: '¿Tengo el hilo de ese color?',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Unidades múltiples: se compra por gruesa, se vende por docena, por cartón o por pieza' },
      { t: 'Listón, encaje, elástico y bies por metro y por pieza, con sus dos precios' },
      { t: 'Matriz de color por medida en cierres e hilos, con la carta de colores por número' },
      { t: 'Listón por número —del 1, del 5, del 9, del 40— y tricolor en septiembre' },
      { t: 'La receta de avíos guardada por prenda, para volver a cobrar el juego completo', plan: 'Controla' },
    ],
  },
  {
    id: 'retazo', nombre: 'El cajón del retazo y la báscula', simbolo: 'armado' as const,
    foto: `${IMG}/zona-retazo.webp`, alt: 'Cajón de retazos por color con la báscula y la etiquetadora al lado, y el costal del retacero en el piso',
    pie: 'Aquí termina la pieza: lo que ya no da un corte se pesa, se etiqueta y se vende por kilo.',
    pregunta: '¿Cuánto vale lo que tengo en el cajón?',
    caja: { x: 68, y: 264, w: 216, h: 104 },
    items: [
      { t: 'Pasar un saldo a retazo: sale de metros y entra a kilos con su precio' },
      { t: 'La báscula pesa el retazo y cobra por kilo en la misma nota que lo demás' },
      { t: 'Venta por bulto o por paca al retacero, y el trapo industrial por kilo al final' },
      { t: 'Lo que se cobró de cada pieza: como tela, como último saldo y como retazo', plan: 'Controla' },
      { t: 'El dinero dormido en saldos: cuántos, cuántos metros y cuántos ya tienen baño nuevo', plan: 'Automatiza' },
    ],
  },
  {
    id: 'bodega', nombre: 'Recepción, bodega y envíos', fuera: true, simbolo: 'paquetes' as const,
    foto: `${IMG}/zona-bodega.webp`, alt: 'Mesa de recepción de una tienda de telas con la revisadora midiendo una pieza y las piezas envueltas en plástico atrás',
    pie: 'Aquí se abre la pieza nueva, se mide contra la nota del proveedor, se le pone folio y tono, y se etiqueta.',
    pregunta: '¿La pieza trajo los metros que me facturaron?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Recepción midiendo: facturados contra medidos, con reclamo de faltante o nota de crédito' },
      { t: 'Costo real por metro con flete y tipo de cambio en la tela de importación' },
      { t: 'Traspasos de piezas entre sucursales respetando el tono, con folio' },
      { t: 'Mesa de empaque: metros cortados con guía de paquetería y foto para el WhatsApp' },
      { t: 'Remisiones del mes agrupadas en una factura al taller, con la unidad metro del SAT', plan: 'Controla' },
    ],
  },
];

export const pasosTM = [
  { cuando: 'Día 1', titulo: 'Tus telas y tus avíos, cargados', texto: 'Nos das tu lista o tu sistema actual y lo subimos nosotros. No capturas nada.', detalle: 'Cada tela con sus colores y anchos, cada pieza física con su folio, su tono y sus metros reales, las piezas cerradas aparte de los saldos, y la mercería con sus unidades.', img: `${IMG}/proceso-recibir.webp`, alt: 'Recepción de piezas de tela envueltas en plástico en la bodega de una tienda de telas' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus proveedores, tus escalones de precio, tus sucursales y tus reglas.', detalle: 'Los cuatro escalones —menudeo, medio mayoreo desde 10 metros, mayoreo y pieza cerrada—, la conversión de gruesa a pieza, el mínimo de cada familia para el último saldo y quién autoriza el descuento.', img: `${IMG}/proceso-merceria.webp`, alt: 'Empleada de mercería sacando un cartón de botones de la cajonera frente a la pared de conos de hilo' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Escanear la pieza y cobrar metro y cuarto se aprende en media hora.', detalle: 'Y se practica lo de todos los días: la venta con avíos en una sola nota, el apartado con fecha y el aviso de último saldo.', img: `${IMG}/proceso-corte.webp`, alt: 'Manos midiendo popelina contra el metro clavado de la mesa de corte antes de rasgarla' },
  { cuando: 'Día 4', titulo: 'Arranca una tienda', texto: 'La primera sucursal vende con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con los apartados ya migrados: ninguna modista llega por su pieza y se encuentra con que su papelito no existe.', img: `${IMG}/proceso-luz.webp`, alt: 'Clienta y empleada sacando un tramo de tela a la luz de la puerta para ver el tono de verdad' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día.', detalle: 'Y el traspaso de piezas del mismo tono entre la del centro y la del norte ya corre desde el primer fin de semana.', img: `${IMG}/proceso-conteo.webp`, alt: 'Conteo de enero en una tienda de telas: se miden los saldos contra el metro clavado y se capturan en la tablet' },
];
export const ticketTM = { lineas: [{ n: 'Chifón vino · 2.50 m · pieza 4471', p: '$437' }, { n: 'Forro · 2.50 m', p: '$162' }, { n: 'Cierre invisible 50 · color 415', p: '$28' }, { n: 'Hilo · 2 carretes · botones · listón', p: '$80' }], total: '$707' };

export const escalaTM = [
  { n: '1 tienda', nombre: 'La tienda del centro', cambia: ['La dueña compra, mide, corta, cobra y a veces fía', 'La memoria es el inventario: sabe de cabeza cuánto le queda del vino y de qué tono', 'El saldo que nadie apuntó, la pieza que llegó corta y la nota con .25 hecha a mano'], sistema: ['Metro con fracción, folio y metros por pieza, y la venta con avíos en una sola nota', 'Recepción midiendo, para dejar de regalar dos metros y medio por pieza', 'La libreta del fiado que suma sola'], dato: { valor: '1.48 veces', rotulo: 'lo que hoy recuperas de cada pieza; con el aviso a tiempo, 1.63' } },
  { n: '5 sucursales', nombre: 'Las tiendas de la zona', cambia: ['Ya hay encargadas y la dueña ya no ve las piezas', 'Empieza el “¿tienen el vino en la del norte?” y el traspaso en taxi', 'El tono se acaba en una y sobra en otra; el proveedor entrega en una bodega'], sistema: ['Existencias por sucursal pieza por pieza y con su tono, y traspasos con folio', 'Apartados con fecha visibles en todas y descuento con clave de la encargada', 'WhatsApp que contesta desde el inventario y conteo cíclico por pared'], dato: { valor: '1 tono', rotulo: 'el corte sale de una sola pieza y de un solo baño, esté donde esté' } },
  { n: '50 sucursales', nombre: 'La cadena con bodega central', cambia: ['Se importa por contenedor y por tono, con carta de colores', 'Revisadora en recepción: lo que llega se mide y el faltante se reclama en serio', 'El retazo de 50 tiendas es un negocio aparte: bulto, paca y trapo industrial'], sistema: ['Reparto de piezas por sucursal según la venta del año pasado', 'Listas de precios por zona y por cliente de mayoreo; remate de retazo con precio central', 'Remisiones agrupadas en factura mensual al taller y CRM de talleres por región'], dato: { valor: '$5.8 M', rotulo: 'lo que deja al año en saldos una cadena que abre 8,000 piezas' } },
  { n: '150 sucursales', nombre: 'La cadena de retail de telas', cambia: ['Planeación de temporada por color y por plaza, con compras a seis meses', 'Marca propia de telas y tienda en línea que vende de la sucursal más cercana', 'La merma de saldos es un renglón del estado de resultados'], sistema: ['Asignación de piezas por sucursal respetando el tono: 40 piezas de vino de tres baños no se reparten a ciegas', 'Precio por zona y el número de cuántas veces se recupera cada pieza por sucursal', 'IA que repone por color, tono y plaza antes de que se acabe, con el apartado en pie'], dato: { valor: '1 folio', rotulo: 'por pieza física, con su tono y sus metros, en toda la cadena' } },
];

export const problemasTM = {
  doc1: {
    membrete: 'Sistema de punto de venta', sub: 'Reporte de inventario',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'EXIST.'],
    lineas: [
      { a: 'SKU-2214', b: 'POPELINA VINO', c: '12' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿de cuál pieza?', '¿y el tono?'],
    sello: 'SUMA LO<br />QUE NO SE SUMA',
    notas: [
      'Te dice que hay <b>12</b>. No te dice que son tres saldos de tres baños distintos y que el corte de 6 no sale de ninguno.',
      'No maneja <b>fracción</b>: metro y cuarto se cobra a mano, y la nota deja de cuadrar con el inventario.',
      'No sabe qué es un <b>baño</b>: ofrece junto el vino viejo y el nuevo, y la prenda regresa hecha.',
      'La pieza entra por lo <b>facturado</b>, no por lo medido. Los 2.5 metros que faltaron no existen en ningún reporte.',
    ],
  },
  doc2: {
    membrete: 'Desarrollo a la medida', sub: 'Propuesta · rev. 4',
    cab: ['CONCEPTO', 'PLAZO'],
    lineas: [
      { a: 'FOLIO POR PIEZA', b: 'FASE 2' },
      { a: 'ENTREGA REAL', b: 'PASÓ JULIO', tachado: true },
      { a: 'RETAZO POR KILO', b: 'NO' },
    ],
    margen: ['+ 3 adendas', 'y llegó diciembre'],
    sello: 'LLEGÓ<br />TARDE',
    notas: [
      'Costó <b>más de lo cotizado</b> y el folio por pieza quedó para la fase 2.',
      'Funciona… mientras <b>quien lo hizo conteste el teléfono</b>. Tus meses son julio y diciembre.',
      'Cada cambio chico —cobrar el retazo por kilo— es <b>una cotización nueva</b>.',
      'No trae aviso de último saldo ni recepción midiendo. En enero, <b>el conteo se hace en papel</b>.',
    ],
  },
  filas: [
    { que: 'Folio, tono y metros por pieza física', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Venta por metro con fracción (1.25, 0.80)', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Recepción midiendo, con reclamo del faltante', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'Aviso de último saldo y paso a retazo por kilo', generico: 'No existe', medida: 'Rara vez', sacs: 'Incluido' },
    { que: 'La tela y sus avíos en una sola nota, con cuatro unidades', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Tiempo para arrancar', generico: 'Días', medida: '4 a 9 meses', sacs: 'Días' },
    { que: 'Quién lo mantiene', generico: 'Su proveedor', medida: 'Tú, si lo encuentras', sacs: 'Nosotros, a diario' },
  ],
  entrada: 'Casi toda tienda de telas que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un punto de venta que suma doce metros que no se pueden sumar, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'las tiendas de telas y mercería que ya la usan',
};

export const cifrasTM = {
  foto: `${IMG}/escala.webp`,
  alt: 'Bodega central de una cadena de telas con las piezas dobladas en tabla, ordenadas por color, y la revisadora en recepción',
  frase: 'Desde la tienda del centro hasta la cadena con bodega central y revisadora en recepción.',
  encuadre: 'center 45%',
};
