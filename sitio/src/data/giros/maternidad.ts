/**
 * Contenido de la landing de ROPA DE MATERNIDAD Y LACTANCIA (17-sep-2026). Sale de la ficha del
 * oficio (scratchpad/giros-fichas/maternidad.md) ya aprobada por la referee (10/9/10/10/10) y con
 * los tres arreglos de renglón aplicados: la maleta se cierra en dos tiempos (se arma en la 34-36,
 * o en la 33-34 si hay cesárea programada, y el brasier de lactancia se deja para el final, medido
 * en la 36-38 —o en la 35-36 si la cesárea está puesta en la 38—), el cruce perdido son 3,100 a
 * 7,000 y el mercado real de una ciudad de 500 mil son 230 a 270.
 *
 * Lenguaje del piso, verificado contra el dictamen: "se alivia" (no "pare"), "la camada" (nunca
 * "cohorte"), "fruncido al costado (drapeado)" (nunca "ruching"), "sesión de maternidad" (nunca
 * "prenatal"), "la panza postiza (el cojín)" (nunca "panza de prueba"), "guardarropa completo"
 * (nunca "vestidero"), "la muda de salida de la mamá" (porque "ropa de salida" a secas, en México,
 * es la del bebé), "la baja" para pausar avisos. Nunca "fecha de caducidad" dicho de la clienta.
 *
 * LA REGLA QUE MANDA SOBRE TODO EL TEXTO: aquí se pierden embarazos y el primer trimestre es
 * secreto. Los avisos de una ficha se apagan de un toque, sin preguntar por qué y sin borrar a la
 * clienta; quien no dio su fecha no recibe nada; y el mensaje del parto lo manda una persona, nunca
 * el sistema. Verdades que no se contradicen en ninguna línea: la faja va DENTRO de la maleta del
 * hospital (ofrecerla al cuarto día es llegar tarde), y la cesárea programada cae en la semana
 * 38-39 y recorre TODOS los avisos dos semanas hacia adelante.
 *
 * Bloque propio: el acantilado. La clienta deja de comprar de golpe el día del parto, viene la
 * cuarentena, y después su talla es la de un cuerpo que ya no existe. La fecha probable de parto es
 * el dato del que cuelga todo, y se sabe desde el día uno.
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran como
 * parte del sistema; se construyen si el cliente las pide): pausar avisos sin borrar a la clienta,
 * ficha con FPP y semana calculada sola, avisos recorridos por cesárea programada, guía de tallas
 * propia por producto, catálogo por trimestre y etapa, campañas por semana con permiso, aviso del
 * cruce en la lista, aviso de la segunda faja, mesa de regalos del baby shower, paquetes armados
 * (la maleta con faja), registro de "lo que pidió y no había", marketplaces con la misma
 * existencia, referidos por origen, IA de surtido por semanas de embarazo, segundo embarazo
 * detectado, mayoreo por escalón, consignación con corte, presupuesto por región y mermas.
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista, mockCalendario } from './_mocks';

const IMG = '/images/giros/maternidad';

export const bannerMA = {
  eyebrow: 'SACS · Ropa de maternidad y lactancia',
  titulo: 'La clienta trae fecha.',
  resalte: 'Y se sabe desde el día uno.',
  sub: 'La ficha con su fecha probable de parto y la semana calculada sola, la pregunta de si le van a programar cesárea —que recorre todos sus avisos dos semanas—, la maleta del hospital con la faja adentro en la 34-36, el aviso de la segunda faja a las cinco semanas, y el botón que apaga los avisos de una ficha sin borrar a la clienta — con un mismo inventario para tus tiendas, tu tienda en línea y tu WhatsApp.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Boutique de maternidad moderna con los racks por trimestre, el maniquí con panza en la entrada y la ficha con fecha en la tablet del mostrador',
  avisos: [
    { modulo: 'Le toca la maleta', texto: 'Karla · semana 33 · cesárea el 6 de septiembre · la maleta con la faja adentro', pos: 1 as const, tono: 'verde' as const, sello: 'Agosto' },
    { modulo: 'Ya se alivió', texto: 'Sra. Luna · fecha cumplida hace 3 días · felicitar, sin vender · lo manda una persona', pos: 2 as const, tono: 'azul' as const, sello: 'Septiembre' },
    { modulo: 'Avisos en pausa', texto: 'Dani · no le llega nada más · su ficha no se borra: su talla y su historia quedan ahí', pos: 3 as const, tono: 'ambar' as const, sello: 'Hoy' },
  ],
};

export const manifiestoMA = {
  intro: 'Sabemos cómo se vende la ropa de maternidad',
  frases: [
    'La clienta te dejó <b>tres mil pesos</b> en marzo y no la volviste a ver. Se alivió en agosto y ni te enteraste: los brasieres, las pijamas y la segunda faja se los compró en línea a otra.',
    'Te llegó de <b>36 semanas</b> por el vestido del baby shower, que es el sábado, y el único que le gustó lo tienes en XS. Se fue llorando y tú te quedaste sin la venta más grande del mes.',
    'Vendes ropa de embarazo, no de temporada, y compras como tienda normal. Tienes el rack de <b>segundo trimestre</b> vacío y el de lactancia lleno de polvo.',
    'Mandaste a maquilar <b>300 pantalones</b> y te quedaron 90 extra chicos. Tus clientas son M y L y pediste como si vistieras adolescentes.',
    'Rentaste el mismo <b>vestido de sesión</b> a dos clientas para el mismo domingo. Una se quedó sin vestido el día de sus fotos. Y ni contamos los dos días que estuvo en la tintorería.',
    'Todo el día contestas lo mismo: “¿de cuántas semanas estás?”, “pide tu talla de antes”, “sí tiene apertura”. <b>Se te va la mañana en el celular</b> y no atiendes a la que está parada enfrente.',
    'Tienes <b>doscientas clientas embarazadas</b> y no sabes en qué semana va ninguna. Están en la libreta y en tu cabeza, y tu cabeza no se acuerda de doscientas fechas.',
    'Le mandaste “ya te toca tu pantalón de la 16” a una clienta que <b>había perdido el embarazo</b>. Te contestó una línea y no la volviste a ver. Eso no se arregla con un descuento.',
    'Regresó a los cuatro años con su segundo bebé y la atendiste como si fuera nueva: ni te acordabas de su talla, ni de que le va el <b>panel bajo</b>, ni de que la primera vez fue cesárea.',
  ],
  cierre: 'Ningún sistema de ropa entiende que aquí la clienta trae una fecha, que el surtido se arma por trimestre y no por temporada, ni que la faja va dentro de la maleta del hospital y no después del parto. Sacs sí: cada pantalla que sigue funciona igual en el mostrador, en el probador y en el WhatsApp de las once de la noche. Y encima puedes poner agentes de IA para que hagan el trabajo repetitivo: contestar “¿de cuántas semanas estás?”, avisar de la maleta en la 34 a quien dio permiso y proponer el surtido por las semanas de embarazo de tu lista. Lo del parto lo escribe una persona, siempre.',
};

export const variantesMA = {
  eyebrow: 'Un solo modelo',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“el pantalón de maternidad”.',
  sub: 'Aquí no hay cuadrícula de talla y color: hay etapa. El mismo pantalón vive con panel alto (tercer trimestre) y con panel bajo (segundo, y el mejor producto de postparto que existe), y la blusa vive con doble capa o sin apertura. La talla que se pide es la de antes del embarazo —con la excepción del busto—, así que el grueso son M y L: el XS se queda colgado y el XXL se pide y no hay.',
  ejeA: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  filas: [
    { nombre: 'Panel alto · negro', img: `${IMG}/prod-negro.webp`, alt: 'Pantalón de maternidad negro con panel alto que cubre toda la panza' },
    { nombre: 'Panel bajo · azul', img: `${IMG}/prod-azul.webp`, alt: 'Pantalón de mezclilla de maternidad azul con panel bajo de media panza' },
    { nombre: 'Doble capa · rayas', img: `${IMG}/prod-rayas.webp`, alt: 'Blusa de lactancia de rayas con doble capa, para dar pecho sin desvestirse' },
    { nombre: 'Drapeado · verde', img: `${IMG}/prod-verde.webp`, alt: 'Vestido de maternidad verde con fruncido al costado que se abre conforme crece la panza' },
  ],
  matriz: [
    [6, 3, 0, 0, 2, 0],
    [5, 4, 1, 0, 1, 0],
    [4, 2, 0, 1, 3, 0],
    [7, 3, 0, 0, 2, 0],
  ],
  unidad: 'piezas',
  genero: 'f' as const,
  leyendas: ['Con existencia', 'Quedan pocas', 'Agotada'] as [string, string, string],
  remate: 'La M y la L se fueron en las cuatro, y el XXL nunca llegó. Lo que cuelga es XS, que casi nadie pide. El reporte decía que “el pantalón negro” tenía 11 piezas, y la clienta de la semana 20 que usa M se fue sin nada — y con ella se fueron los otros cinco meses de su embarazo.',
};

export const cortinaMA = {
  titulo: '“¿De cuántas semanas estás?”',
  pieAntes: 'La libreta con doscientas fechas,<br />y la clienta de 36 semanas de pie.',
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Vendedora de una boutique de maternidad buscando en la libreta en qué semana va su clienta mientras ella espera cansada en el banco del mostrador',
  altDespues: 'La misma vendedora enseñándole la ficha con su fecha y su semana en la tablet, con el vestido ya apartado en el gancho',
  libreta: ['Karla — ¿de cuántas va?', 'Vestido de tul — ¿domingo o el otro?', 'Sra. Luna — ¿ya se alivió?'],
  filas: [
    { que: '“¿De cuántas semanas estás?”', donde: 'La ficha con su fecha', dato: 'Karla, semana 33; cesárea el 6 de septiembre; talla de antes M, panel bajo. Le toca la maleta esta semana' },
    { que: '¿Ya está libre el vestido del domingo?', donde: 'El calendario de rentas', dato: 'Sale el sábado 9 y regresa el lunes 11; el 12 y el 13 quedan bloqueados: está en la tintorería' },
    { que: '¿Quién cruzó el parto?', donde: 'La lista de “ya se alivió”', dato: 'Tres nombres a fecha+3. No sale nada solo: la vendedora ve el nombre, checa el chat y escribe a mano' },
    { que: 'Dani pidió la baja', donde: 'Pausar avisos', dato: 'Un toque, sin preguntar por qué. No le llega nada más. La ficha no se borra: se apaga, con su talla y su historia adentro' },
  ],
  pieDespues: 'La misma vendedora, la misma clienta. Ya no se acuerda de doscientas fechas: las lee.',
};

export const casosMA = [
  {
    id: 'shower',
    titulo: 'El baby shower: el ticket más alto del embarazo',
    texto: 'Se decide en la semana 24 y se usa en la 30-34. Tiene fecha fija: si el vestido no está en su talla ese fin de semana, la venta no se pospone, se pierde. El apartado con anticipo, abonos y vigencia deja el vestido guardado sin bloquear el mejor del perchero tres meses, y la mesa de regalos —la de la mamá, no la del bebé— la arman ella y la que organiza el shower.',
    remate: 'Cuando la mesa de regalos jala son 3 a 8 tickets chicos en dos semanas. No es la venta más grande: es la más barata de conseguir.',
    img: `${IMG}/caso-shower.webp`,
    alt: 'Clienta embarazada de siete meses eligiendo con la empleada lo que va en su mesa de regalos del baby shower, en una boutique de maternidad',
  },
  {
    id: 'sesion',
    titulo: 'La sesión de maternidad: dos horas con fecha de sábado',
    texto: 'De la semana 28 a la 34, y nunca después de la 36. El vestido largo casi siempre se renta y se reserva con semanas de anticipación. El calendario lleva la fecha, la hora de salida y de regreso, el depósito en garantía y —lo que la libreta nunca bloquea— los dos o tres días de tintorería entre una renta y la siguiente.',
    remate: 'Los dos o tres vestidos consentidos salen 20 a 30 veces al año. Empalmar dos clientas el mismo domingo cuesta las dos.',
    img: `${IMG}/caso-sesion.webp`,
    alt: 'Sesión de maternidad en un estudio, con la clienta en el vestido largo rentado y otro vestido en funda marcado para tintorería',
  },
  {
    id: 'maleta',
    titulo: 'La maleta del hospital, en la 34-36 y con la faja adentro',
    texto: 'La faja se compra ANTES del parto porque se usa desde ese mismo día: quien la ofrece al cuarto día llega tarde, ya se la regalaron en el shower. La maleta se arma de un jalón —camisón con apertura, bata, pantuflas, la faja de cesárea o de parto natural y la muda de salida de la mamá— y el brasier de lactancia es la única pieza que se deja para el final: se aparta con el resto y se mide en la 36-38, porque medido antes se queda corto. Si le programaron cesárea entre la 38 y la 39, todo se recorre dos semanas.',
    remate: 'Es el ticket que más se pierde por ofrecerlo tarde: de 1,900 a 4,000 pesos que se deciden en la semana 34, no después del parto.',
    img: `${IMG}/caso-lactancia.webp`,
    alt: 'Zona de lactancia y fajas de una boutique de maternidad, con las fajas en caja separadas por tipo y los brasieres de lactancia colgados',
  },
  {
    id: 'segunda',
    titulo: 'La cuarentena y la segunda faja',
    texto: 'Cuarenta días en que no va de compras: sale al pediatra a los tres días, al tamiz y a su revisión, nada más. Compra por WhatsApp o no compra. A las 4 a 6 semanas necesita la segunda faja, una talla menos, y a las 6 a 8 semanas su talla de brasier se estabiliza y llega el definitivo. El aviso del cruce aparece en la lista de la vendedora, nunca sale solo: hay bebés en terapia intensiva y no todos los finales son felices.',
    remate: 'Cada clienta que se pierde al cruzar el parto se lleva de 1,200 a 3,000 pesos; si además se perdió la maleta, son 3,100 a 7,000.',
    img: `${IMG}/caso-segunda.webp`,
    alt: 'Mamá recién aliviada recogiendo en el mostrador sus blusas de doble capa y su segunda faja, en una boutique de maternidad',
  },
];

export const seccionesMA: SuiteSeccion[] = [
  {
    id: 'fecha', tag: 'Clientas',
    titulo: 'La ficha con fecha, y la pausa a un toque',
    texto: 'En el primer ticket se capturan tres cosas en quince segundos: la fecha probable de parto, si le van a programar cesárea y el permiso para escribirle. De ahí sale todo: el sistema calcula su semana cada día, ordena la lista por semana de embarazo y, si hay cesárea puesta entre la 38 y la 39, recorre TODOS sus avisos dos semanas hacia adelante. Y junto a cada nombre está el botón que apaga sus avisos.',
    bullets: ['Pausar avisos sin preguntar por qué y sin borrar a la clienta: la ficha se apaga, con su talla y su historia adentro', 'Quien no dio su fecha no recibe nada, y en primer trimestre nunca se escribe la palabra “embarazo” en el mensaje', 'Seis conversaciones por embarazo —la 14, la 24, la 30, la 34, fecha+3 y la semana 5—, no un boletín'],
    visual: mockLista('La lista del lunes · por semana de embarazo', [['Karla · semana 33 · cesárea el 6 de sep · la maleta con la faja', 'Le toca hoy', 'aviso'], ['Sra. Luna · fecha cumplida hace 3 días · felicitar, sin vender', 'En la lista', 'ok'], ['Mónica · 5 semanas de postparto · segunda faja, una talla menos', 'Le toca hoy', 'aviso'], ['Dani · avisos en pausa · no recibe nada', 'Apagada', 'gris']], 'Primero las de 33 en adelante y las que ya cumplieron su fecha. El mensaje del parto lo manda una persona, nunca el sistema'),
  },
  {
    id: 'trimestre', tag: 'Inventario',
    titulo: 'El surtido por trimestre, no por temporada',
    texto: 'En diciembre tienes clientas de 8 semanas y de 38 el mismo día, y no compran ni remotamente lo mismo. El inventario se ordena por etapa —segundo trimestre, tercero, lactancia, postparto— y por talla de antes del embarazo, que es la que se pide. El sistema dice qué rack está hueco, qué modelo no se mueve en seis semanas y cuántas clientas de tu lista van a estar en la 20 en abril.',
    bullets: ['Matriz por talla y etapa, con panel alto y panel bajo como lo que son: dos productos', 'La curva de la maquila por talla y etapa, con lo vendido y con lo que pidieron y no había', 'IA de surtido que razona por las semanas de embarazo de tu lista, no por la estación del año'],
    visual: mockMatriz('Pantalón con panel · existencia por talla y etapa', ['XS', 'S', 'M', 'L', 'XL', 'XXL'], [['Panel alto', [6, 3, 0, 0, 2, 0]], ['Panel bajo', [5, 4, 1, 0, 1, 0]]], 'La M y la L en cero: justo donde está tu lista. El XS cuelga y el XXL nunca llegó', [0, 2]),
  },
  {
    id: 'maleta', tag: 'Lactancia y fajas',
    titulo: 'La maleta como paquete, con la faja adentro',
    texto: 'Un código que descuenta cada pieza de su existencia: camisón con apertura, bata, pantuflas, la faja —de cesárea o de parto natural, que son dos productos distintos— y la muda de salida de la mamá. El brasier de lactancia va apartado y se mide lo más tarde que se pueda, en la 36-38, porque medido antes se queda corto: se recoge medido. Fajas y brasieres llevan su propia matriz de talla, copa y medida de cintura.',
    bullets: ['Paquetes armados: la maleta del hospital, el kit de lactancia y el kit postparto de cesárea', 'Brasieres por talla y copa (34B, 36C) y fajas por medida, con aviso de qué tallas quedaron en cero antes del pico de nacimientos', 'Aviso de la segunda faja a las 4-6 semanas, una talla menos: la venta más fácil del giro y casi nadie la hace'],
    visual: mockTicket('La maleta del hospital · semana 33-34', [['Camisón con apertura · M', '$560'], ['Faja postparto de cesárea', '$1,290'], ['Bata y pantuflas', '$450'], ['Muda de salida de la mamá', '$500'], ['Brasier de lactancia · apartado, se mide en la 35-36', 'pendiente']], ['Un solo ticket', '$2,800'], 'La faja va adentro, no después del parto. Ofrecerla al cuarto día es llegar a una venta que ya ocurrió'),
  },
  {
    id: 'renta', tag: 'Ocasión',
    titulo: 'Vestidos de shower y de sesión, con fecha y con tintorería',
    texto: 'Los de venta de un lado y los de renta del otro, sin mezclar nunca. Cada reserva lleva fecha, hora de salida, hora de regreso y depósito en garantía, y el sistema bloquea solo los dos o tres días que el vestido pasa en la tintorería. No deja empalmar dos clientas el mismo domingo, que es como se pierden las dos.',
    bullets: ['Reservas por fecha y hora, con depósito, salida y regreso, y los días de limpieza bloqueados', 'Apartado con anticipo, abonos, saldo y vigencia: el que nadie recogió vence, avisa y se libera', 'A la fotógrafa aliada se le puede rentar el guardarropa completo por sesión, con su comisión'],
    visual: mockCalendario('Rentas de sesión y de shower', 'Agosto', 31, { 2: 'lleno', 3: 'lleno', 4: 'aviso', 5: 'aviso', 9: 'lleno', 10: 'lleno', 11: 'aviso', 12: 'aviso', 16: 'lleno', 17: 'lleno', 18: 'aviso', 23: 'ok', 24: 'lleno', 30: 'lleno', 31: 'lleno' }, 'En negro sale el vestido; en ámbar está en la tintorería y nadie lo puede reservar'),
  },
  {
    id: 'sucursales', tag: 'Sucursales',
    titulo: '¿En cuál tienda está la L de ese vestido?',
    texto: 'La L que sobra en la plaza es la que falta en la otra tienda el sábado del shower. Existencias por sucursal, traspaso con guía y la mezcla de cada plaza: en una pega lactancia y faja, en otra pegan los vestidos. Surtir igual a las cinco es tirar dinero, porque cada plaza tiene su propio ritmo de nacimientos.',
    bullets: ['Existencias por sucursal, por talla y por etapa, desde el celular', 'CRM único: la clienta que compró en una tienda y se alivió cerca de la otra es la misma', 'Comisión por vendedora con la regla del giro: la que capturó la fecha en la 14 y la que cerró el postparto seis meses después no son la misma'],
    visual: mockBarras('Vestido de shower · talla L · por tienda', [['Plaza', '3 pz', 100], ['Centro', '0 pz', 0], ['Norte', '1 pz', 33]], 'Traspaso sugerido: 1 de Plaza a Centro. El shower es el sábado y no se pospone'),
  },
  {
    id: 'linea', tag: 'En línea y WhatsApp',
    titulo: '“Pide tu talla de antes del embarazo”',
    texto: 'El mercado de tu ciudad es chiquito y cada año nacen menos: la tienda seria vende fuera desde el primer año. El catálogo se filtra por trimestre y por etapa —segundo, tercero, lactancia, postparto—, no por “blusas” y “pantalones”, y la guía de tallas repite la misma frase en todos lados, con la excepción del busto escrita en la misma línea. La clienta en cuarentena es la mejor compradora en línea que existe: no va de compras y tiene el celular en la mano.',
    bullets: ['Una sola existencia para el piso, la tienda en línea, el chat y los marketplaces', 'Apartado y cobro desde el chat, con la foto de cómo queda en la 20 y en la 34', 'Logística inversa con guía de retorno, quién la paga y en qué sucursal entra la pieza'],
    visual: mockLista('Chats y envíos · hoy', [['“¿De cuántas semanas estás?” · 31 · vestido drapeado en M', 'Apartado', 'ok'], ['Cuarentena · Sra. Ríos · pijamas con apertura y doble capa', 'Guía lista', 'ok'], ['Devolución · panel alto que le quedó alto · cambio por panel bajo', 'Nota de crédito', 'aviso'], ['Primer trimestre · pidió que no le escriban todavía', 'Sin avisos', 'gris']], 'Cada chat queda en la ficha con su fecha, su talla de antes y su permiso'),
  },
];

export const planoMA = [
  {
    id: 'trimestres', nombre: 'Entrada y racks por trimestre', simbolo: 'rieles' as const,
    foto: `${IMG}/zona-trimestres.webp`, alt: 'Entrada de una boutique de maternidad con el maniquí con panza y tres racks señalizados por etapa',
    pie: 'Tres racks por etapa —segundo, tercero y lactancia— y no por estación: es el acomodo que entiende la que llega asustada de la semana 14.',
    pregunta: '¿Qué rack está hueco en M y L?',
    caja: { x: 68, y: 82, w: 216, h: 80 },
    items: [
      { t: 'Existencia por etapa y talla, con el pantalón con panel y las blusas de punto al frente' },
      { t: 'Un maniquí con panza en la entrada, con el look del trimestre que más tráfico trae ese mes' },
      { t: 'La lona de “pide tu talla de antes del embarazo”, con la excepción del busto abajo' },
      { t: 'Etiquetas con talla y etapa impresas desde el sistema, no solo el precio' },
      { t: 'Qué modelo no se ha movido en seis semanas y qué talla quedó en cero', plan: 'Controla' },
    ],
  },
  {
    id: 'probador', nombre: 'El probador (con la panza postiza)', simbolo: 'probadores' as const,
    foto: `${IMG}/zona-probador.webp`, alt: 'Probador amplio de una boutique de maternidad con banca, espejo de cuerpo completo y el cojín con forma de panza sobre la banca',
    pie: 'Probador amplio, con banca y espejo de cuerpo completo: la de 34 semanas se cansa de estar parada.',
    pregunta: '¿Le va panel alto o panel bajo?',
    caja: { x: 68, y: 170, w: 216, h: 86 },
    items: [
      { t: 'La panza postiza (el cojín) en la banca: “ponte la panza para que veas” cómo queda en la 34' },
      { t: 'Aquí se ve si carga panza alta o baja, y ese dato se apunta en la ficha' },
      { t: 'Nunca se cobra, se mide ni se fotografía dentro: las medidas de cintura se toman sobre la ropa, en la zona de fajas' },
      { t: 'Talla de antes del embarazo, tipo de panel y la última prenda que se probó y no se llevó', plan: 'Fideliza' },
      { t: 'Lo que pidió y no había se apunta aquí mismo y alimenta la siguiente corrida' },
    ],
  },
  {
    id: 'fajas', nombre: 'Lactancia, fajas y la maleta', simbolo: 'anaqueles' as const,
    foto: `${IMG}/zona-fajas.webp`, alt: 'Zona de lactancia y fajas de una boutique de maternidad, con las fajas en caja separadas por tipo y la cinta métrica colgando del estante',
    pie: 'Aquí está la otra mitad del dinero del giro, y es la que casi nadie trabaja.',
    pregunta: '¿Ya le armaron la maleta?',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Fajas en caja, separadas por cesárea y por parto natural, con la cinta métrica para medir sobre la ropa' },
      { t: 'El letrero honesto, el que evita el pleito: la faja sostiene, no adelgaza, y se usa cuando el médico lo autoriza' },
      { t: 'Un espacio para la segunda faja, una talla menos, que se vende a las 4-6 semanas: se le enseña desde ahora' },
      { t: 'Brasieres por talla y copa con el broche de una mano a la vista; se miden en la 36-38 y son dos, no uno' },
      { t: 'La maleta del hospital como paquete que descuenta cada pieza, con LA FAJA adentro', plan: 'Controla' },
    ],
  },
  {
    id: 'mostrador', nombre: 'Mostrador y mesa de regalos', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-mostrador.webp`, alt: 'Mostrador de una boutique de maternidad con la tablet, la cinta métrica y la mesa de regalos del baby shower en la esquina',
    pie: 'Aquí se captura la fecha en el primer ticket, y aquí está el botón de pausar avisos.',
    pregunta: '¿Para cuándo le toca?',
    caja: { x: 68, y: 264, w: 216, h: 104 },
    items: [
      { t: 'Fecha probable de parto, la pregunta de la cesárea y el permiso para escribirle, en el primer ticket', plan: 'Fideliza' },
      { t: 'El botón de pausar avisos a un toque: se aprieta sin preguntar nada y no borra a nadie' },
      { t: 'La mesa de regalos del baby shower, que es para la mamá, no para el bebé: hay que explicárselo' },
      { t: 'Cobra con y sin internet, con corte por turno, arqueo, factura y nota de crédito con vigencia' },
      { t: 'Todo esto se ve y se mueve desde el celular: la dueña contesta a las once de la noche' },
    ],
  },
  {
    id: 'trastienda', nombre: 'Trastienda y envíos', fuera: true, simbolo: 'paquetes' as const,
    foto: `${IMG}/zona-trastienda.webp`, alt: 'Trastienda de una boutique de maternidad: recepción de la maquila por talla y la mesa de empaque de los envíos a todo el país',
    pie: 'La maquila se recibe por talla y etapa contra la corrida; de aquí salen los envíos a la clienta en cuarentena.',
    pregunta: '¿Cuántas M me faltó entregar la maquila?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Orden de maquila: tela entregada, piezas por talla y etapa recibidas, merma y pago por pieza' },
      { t: 'Reparto de la corrida por sucursal según lo que vende cada plaza por etapa' },
      { t: 'Empaque de los envíos a todo el país, con guía de retorno incluida' },
      { t: 'Marketplaces con la misma existencia: ahí se vacía la sobra de tallas de la corrida' },
      { t: 'Venta por etapa (embarazo, ocasión, maleta, lactancia, postparto) para saber qué rack merece más metros', plan: 'Controla' },
    ],
  },
];

export const pasosMA = [
  { cuando: 'Día 1', titulo: 'Tus prendas, cargadas', texto: 'Nos das tu lista o tu sistema actual y lo subimos nosotros. No capturas nada.', detalle: 'Modelo, talla y etapa, con el panel alto y el panel bajo separados, las fajas y los brasieres con su propia matriz de talla y copa, y la existencia real de cada tienda.', img: `${IMG}/proceso-recibir.webp`, alt: 'Dos empleadas desempacando la caja del proveedor en la trastienda de una boutique de maternidad' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus proveedores, tu maquila, tus sucursales y tus reglas de renta y de cambio.', detalle: 'Los racks por trimestre, los paquetes armados —la maleta con la faja, el kit de lactancia—, el depósito de las rentas y los días de tintorería que se bloquean solos.', img: `${IMG}/proceso-trimestre.webp`, alt: 'Empleada cargando el surtido por trimestre y talla en la tablet de la trastienda' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Preguntar la semana, la cesárea y el permiso, y capturarlos en el primer ticket, se aprende en media hora.', detalle: 'Y se practica lo que de verdad pasa: armar la maleta, apartar el vestido del shower y apretar el botón de pausa sin preguntarle nada a nadie.', img: `${IMG}/proceso-fecha.webp`, alt: 'Vendedora capturando la fecha probable de parto en la ficha de una clienta de cuatro meses, en el mostrador' },
  { cuando: 'Día 4', titulo: 'Arranca una tienda', texto: 'La primera sucursal vende con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con los apartados y las rentas ya migrados: ninguna clienta llega por su vestido de sesión y se encuentra con que su papelito no existe.', img: `${IMG}/proceso-maleta.webp`, alt: 'Vendedora armando la maleta del hospital como paquete, con la faja en su caja sobre el mostrador' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día.', detalle: 'Y sale la primera lista por semana de embarazo: quién va en 16, quién en 33-34 y quién ya se alivió — con las fichas en pausa apagadas desde el minuto uno.', img: `${IMG}/proceso-aviso.webp`, alt: 'Dueña revisando en su laptop la lista de clientas por semana de embarazo, con dos fichas apagadas en pausa' },
];

export const ticketMA = { lineas: [{ n: 'Camisón con apertura · M', p: '$560' }, { n: 'Faja postparto de cesárea', p: '$1,290' }, { n: 'Bata y pantuflas', p: '$450' }, { n: 'Muda de salida de la mamá', p: '$500' }, { n: 'Brasier de lactancia · apartado, se mide en la 35-36', p: '—' }], total: '$2,800' };

export const escalaMA = [
  { n: '1 tienda', nombre: 'La boutique de la plaza', cambia: ['La dueña compra, vende, sube la historia y contesta el WhatsApp a las once de la noche', 'La lista de clientas vive en su memoria: sabe que “la de los gemelos ya va en la 32” porque se acuerda', 'El apartado, la renta y las fechas van en libreta, y la libreta no se acuerda de doscientas'], sistema: ['La ficha con fecha y con pausa, la matriz por talla y etapa y el apartado con saldo', 'Calendario de renta con tintorería bloqueada y tienda en línea para salir de su ciudad', 'Una caja, un teléfono y una impresora de etiquetas — y todo se mueve desde el celular'], dato: { valor: '27 semanas', rotulo: 'útiles por clienta: de la 14 a la 36, más la cuarentena. Y no se repiten' } },
  { n: '5 tiendas', nombre: 'Las boutiques de la zona', cambia: ['Encargada por tienda, una compradora y el cuarto de envíos; la bodega es la trastienda de la más grande', 'El dolor cambia a “¿en cuál tienda está la L de ese vestido?”', 'En una plaza pega lactancia y faja; en otra, los vestidos de shower'], sistema: ['Existencias por sucursal, traspasos y calendario de renta compartido', 'CRM único: la que compró en una y se alivió cerca de la otra es la misma clienta', 'Comisión por vendedora con la regla de quién cobra el postparto, y corte consolidado por etapa'], dato: { valor: '6 conversaciones', rotulo: 'por embarazo: la 14, la 24, la 30, la 34, fecha+3 y la semana 5. No sesenta' } },
  { n: '50 tiendas', nombre: 'La cadena con bodega central', cambia: ['Compradora de ropa y compradora de lactancia y fajas: son dos negocios distintos', 'Recibir 20 mil piezas y mandar a cada tienda la mezcla que su mercado de embarazadas pide', 'La logística inversa es la que quiebra: quién paga la guía y cuándo vuelve a venderse la pieza'], sistema: ['Recepción con código de barras, reparto por curva de tienda y traspasos automáticos', 'Campañas por semana de embarazo por plaza, con permiso y con pausa', 'Envío desde la sucursal más cercana y marketplaces con la misma existencia'], dato: { valor: '1 fecha', rotulo: 'por clienta, y con eso sabes cuántas van a estar en la 30 en agosto: se compra con eso, no con la corazonada' } },
  { n: 'El corner', nombre: 'Corners y cadenas de bebé', cambia: ['En México no hay una cadena de 150 puntos de puro maternidad: a esta escala es el piso de maternidad de una cadena de bebé, o el corner dentro de una departamental', 'Se planea por región: el norte compra más faja, el centro más vestido de shower', 'La marca propia es el 70 u 80 % de lo que se vende, con patrones de maternidad y lactancia propios'], sistema: ['Presupuesto de compra por mes y por región, con mermas auditadas', 'IA de surtido que razona por las semanas de embarazo de la lista, no por la estación', 'Mayoreo con listas de precio, consignación con corte e inventario unificado en todos los canales'], dato: { valor: '1 botón', rotulo: 'de pausa, igual en toda la cadena: la ficha se apaga, no se borra' } },
];

export const problemasMA = {
  doc1: {
    membrete: 'Sistema de ropa', sub: 'Reporte de inventario',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'EXIST.'],
    lineas: [
      { a: 'SKU-0447', b: 'PANTALON PANEL NEGRO', c: '11' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿y la M?', '¿en qué semana va?'],
    sello: 'NO SABE<br />LA FECHA',
    notas: [
      'Te dice que hay <b>11</b>. No te dice que la M y la L ya se fueron y que lo que cuelga es XS.',
      'No distingue <b>panel alto de panel bajo</b>: para él es el mismo pantalón, y son dos productos.',
      'No sabe que tu clienta trae <b>una fecha</b>: no hay dónde anotarla, ni cómo apagarle los avisos.',
      'La faja la trata como una playera. Ni talla de cintura, ni cesárea, ni segunda faja.',
    ],
  },
  doc2: {
    membrete: 'Desarrollo a la medida', sub: 'Propuesta · rev. 4',
    cab: ['CONCEPTO', 'PLAZO'],
    lineas: [
      { a: 'FICHA CON FPP', b: 'FASE 2' },
      { a: 'ENTREGA REAL', b: 'PASÓ AGOSTO', tachado: true },
      { a: 'PAUSAR AVISOS', b: 'NO' },
    ],
    margen: ['+ 3 adendas', 'y llegó septiembre'],
    sello: 'LLEGÓ<br />TARDE',
    notas: [
      'Costó <b>más de lo cotizado</b> y la ficha con fecha quedó para la fase 2.',
      'Funciona… mientras <b>quien lo hizo conteste el teléfono</b>. Tu mes de showers es agosto.',
      'Cada cambio chico —recorrer los avisos por cesárea— es <b>una cotización nueva</b>.',
      'No trae el botón de pausa. Y eso no es un detalle de software: es <b>una clienta que no vuelve</b>.',
    ],
  },
  filas: [
    { que: 'Ficha con fecha probable de parto y semana calculada sola', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Cesárea programada que recorre todos los avisos dos semanas', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'Pausar avisos sin borrar a la clienta', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'La maleta del hospital como paquete, con la faja adentro', generico: 'No existe', medida: 'Rara vez', sacs: 'Incluido' },
    { que: 'Fajas y brasieres por talla, copa y medida de cintura', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Calendario de renta con los días de tintorería bloqueados', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Tiempo para arrancar', generico: 'Días', medida: '4 a 9 meses', sacs: 'Días' },
    { que: 'Quién lo mantiene', generico: 'Su proveedor', medida: 'Tú, si lo encuentras', sacs: 'Nosotros, a diario' },
  ],
  entrada: 'Casi toda boutique de maternidad que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un sistema de ropa que cuenta piezas pero no sabe que la clienta trae fecha, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'las boutiques y marcas de maternidad y lactancia que ya la usan',
};

export const cifrasMA = {
  foto: `${IMG}/escala.webp`,
  alt: 'Bodega central de una cadena de maternidad con las cajas separadas por etapa y los pantalones acomodados con el panel a la vista',
  frase: 'Desde la boutique de una plaza hasta la cadena con maquila propia, bodega central y corners.',
  encuadre: 'center 45%',
};
