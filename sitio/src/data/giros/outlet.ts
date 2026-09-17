/**
 * Contenido de la landing de OUTLET Y SALDOS DE MODA (17-sep-2026). Sale de la ficha del oficio
 * (scratchpad/giros-fichas/outlet.md), aprobada por el referee en tercera ronda con los tres pelos
 * de redacción ya aplicados. Lenguaje del piso: el lote, el bulto, la lista del lote, a ciegas, la
 * bajada, el escalón, la etiqueta verde/amarilla/roja, el tendido, la revoltura, la marchanta, el
 * que surte, el desmarque, "hecho para outlet", el surtido de mayoreo, abonos, descompletada, días
 * de piso ("¿cuánto lleva colgada?"), "lo que dejó el lote" y "cuánto me salió puesta en el piso".
 *
 * DOS NEGOCIOS DISTINTOS QUE NUNCA SE REVUELVEN EN ESTA PÁGINA: el saldo nuevo de marca —caja de
 * cartón o bulto amarrado con el número de lote escrito con marcador, etiqueta original, no se
 * lava, no se vende por kilo, con desmarque y precio mínimo de por medio— y la paca de ropa
 * americana usada, que es otro giro: se compra prensada y por kilo, se lava, se plancha y tiene
 * otra clientela. La página habla del saldo nuevo; la paca solo se nombra para no confundirla.
 *
 * El eje: el lote entra a ciegas, se cuenta, se clasifica en cuatro montones, se le reparte el
 * costo con flete y maniobra, y la bajada corre sola por tanda hasta que sale. Lo que cambia el año
 * no es el margen de un bulto: es que el dinero regrese doce semanas antes — 3.7 vueltas al año en
 * vez de 2. Los números del ejemplo están verificados con calculadora por el referee y se copian
 * tal cual: $116,600 puestos en piso, 1,174 contadas, 30 de merma, 1,144 vendidas, $101.92 de costo
 * real por pieza vendida, $229,658 a ojo (49.2 %, 26 semanas, $4,348 por semana, 2 vueltas) contra
 * $261,908 con la bajada corriendo (55.5 %, 14 semanas, $10,379 por semana, 3.7 vueltas), $32,250
 * de diferencia y 314 piezas abajo de costo contra 139.
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran como
 * parte del sistema; se construyen si el cliente las pide): recepción de lote con conteo contra
 * lista, costo repartido entre las piezas contadas, clasificación por calidad al recibir, alta por
 * montón con impresión masiva de etiquetas, bajada automática por tanda con etiqueta de color,
 * doble precio con desmarque y precio mínimo, pieza única entre canales, apartados del vivo con
 * liberación a las 24 horas, traspaso con cambio de precio, surtido de mayoreo, venta de bulto
 * completo, cierre de lote con la calificación del que surte, inventario cíclico por rack y merma
 * con motivo. La verdad se mantiene intacta en precios y planes.
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista, mockCalendario } from './_mocks';

const IMG = '/images/giros/outlet';

export const bannerOU = {
  eyebrow: 'SACS · Outlet y saldos de moda',
  titulo: 'El lote entra a ciegas.',
  resalte: 'La bajada ya no.',
  sub: 'Recepción con el conteo real contra la lista, el costo del bulto repartido entre las piezas que sí llegaron, alta por montón con las etiquetas de un jalón, la bajada que corre sola por tanda —verde, amarilla, roja— y lo que dejó el lote hasta la última pieza de $50, con la misma pieza única en el piso, en el vivo y en la tienda en línea.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Piso de un outlet de moda en México con los racks llenos por escalón de precio y la mesa de la revoltura al centro',
  avisos: [
    { modulo: 'Baja hoy', texto: 'Lote 148 · tanda del 3 de junio · 212 piezas pasan a amarilla · $209', pos: 1 as const, tono: 'ambar' as const, sello: 'Día 21' },
    { modulo: 'Puesta en el piso', texto: 'Lote 151 · lista 1,200 · contadas 1,174 · te salió en $99.32, no en $85', pos: 2 as const, tono: 'azul' as const, sello: 'Recepción' },
    { modulo: 'Pieza única', texto: 'Se vendió en caja a las 11:40 · se bajó sola del vivo y de la tienda en línea', pos: 3 as const, tono: 'verde' as const, sello: 'Hoy' },
  ],
};

export const manifiestoOU = {
  intro: 'Sabemos cómo se vende un lote',
  frases: [
    'Le entraste al <b>lote</b> y no sabes si ganaste o perdiste hasta que salió la última pieza.',
    '¿Cómo das de alta <b>1,174 piezas</b> si cada una es distinta? Nadie va a teclear mil claves.',
    'En la lista venían 1,200 y contaste <b>1,174</b>. Esas 26 las pagaste y nadie te volvió a sacar el costo.',
    'Tienes ropa colgada de hace <b>ocho meses</b> y nadie te avisa: se te hizo vieja en el gancho.',
    'Le bajas <b>cuando te acuerdas</b>, y te acuerdas tarde: sale en $99 lo que pudo salir en $209.',
    'Cada pieza es una sola: la vendes en el piso, sigue en la <b>tienda en línea</b> y quedas mal con la clienta.',
    'La marca te pide <b>quitarle la etiqueta</b> y no bajar de cierto precio, y eso no se controla en cinco tiendas.',
    'En el <b>Buen Fin</b> las tiendas de línea ponen 60 % y tú, que eres el barato, te quedas sin argumento.',
  ],
  cierre: 'Ningún sistema de ropa entiende que aquí el inventario no se repone, que cada pieza es una sola y que la talla descompletada es lo normal y no un error. Sacs sí: cada pantalla que sigue está hecha para el lote que entra a ciegas, se clasifica en la mesa y baja de escalón solo. Y encima puedes poner agentes de IA para el trabajo repetitivo: el aviso de lote nuevo a la lista por talla, la bajada de cada tanda y el recordatorio del abono que vence hoy.',
};

export const variantesOU = {
  eyebrow: 'Un solo bulto',
  titulo: 'Esto es lo que de verdad hay dentro de',
  resalte: '“el lote de dama”.',
  sub: 'Aquí no se compra una corrida: llega lo que llegó. De cada modelo hay una o dos piezas, la talla viene descompletada de origen y lo que se vendió ya no vuelve. El sistema no pide reponer ni marca faltante: sabe que cada pieza es una sola.',
  ejeA: ['28', '30', '32', '34', '36', '38', '40'],
  filas: [
    { nombre: 'Blusa satinada', img: `${IMG}/prod-uno.webp`, alt: 'Blusa satinada de saldo de marca con su etiqueta original' },
    { nombre: 'Mezclilla recta', img: `${IMG}/prod-dos.webp`, alt: 'Pantalón de mezclilla recto de saldo de marca' },
    { nombre: 'Chamarra acolchada', img: `${IMG}/prod-tres.webp`, alt: 'Chamarra acolchada de saldo de marca colgada en el rack' },
    { nombre: 'Vestido estampado', img: `${IMG}/prod-cuatro.webp`, alt: 'Vestido estampado de saldo de marca en el rack del outlet' },
  ],
  matriz: [
    [0, 1, 2, 0, 0, 1, 0],
    [1, 0, 0, 1, 1, 0, 0],
    [0, 0, 1, 0, 0, 0, 1],
    [2, 1, 0, 0, 1, 0, 0],
  ],
  unidad: 'piezas',
  genero: 'f' as const,
  leyendas: ['Hay pieza', 'Es la última', 'Ya se vendió'] as [string, string, string],
  remate: 'De la blusa satinada hay una 30 y dos 32, y entre la 32 y la 38 no hay nada. Eso no se arregla ni se repone: así vino el bulto. Lo que sí se puede es saber, en el piso y en el vivo, qué pieza es la que queda y en qué escalón va.',
};

export const cortinaOU = {
  titulo: '“¿Cuánto lleva colgada?”',
  pieAntes: 'La libreta del lote,<br />y el rack sin bajar.',
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Encargada de un outlet revisando con marcador y portapapeles la lista del lote contra las etiquetas escritas a mano',
  altDespues: 'La misma encargada con la impresora de etiquetas y la tablet, colgando las etiquetas del color que toca hoy',
  libreta: ['Lote 148 — ¿cuántas quedan?', 'Rack 3 — ¿desde cuándo está?', 'Pieza 0471 — ¿se vendió o la apartaron?'],
  filas: [
    { que: '“¿Cuánto lleva colgada?”', donde: 'Días de piso por tanda', dato: 'Lote 148, tanda del 3 de junio: 212 piezas cumplen 21 días; hoy pasan a amarilla, de $299 a $209' },
    { que: '¿Cuánto me salió puesta en el piso?', donde: 'El costo repartido del lote', dato: '$116,600 entre las 1,174 contadas: $99.32. Con la merma, $101.92 por cada pieza que sí pasa por caja' },
    { que: '¿Esa pieza todavía está?', donde: 'Pieza única entre canales', dato: 'Se cobró en el piso a las 11:40 y se bajó sola del vivo y de la tienda en línea en el mismo minuto' },
    { que: '¿Qué dejó el lote?', donde: 'El cierre del lote', dato: 'Lo cobrado de todas las piezas, la de $50 y el bulto final incluidos, contra el costo puesto en el piso' },
  ],
  pieDespues: 'La misma encargada, el mismo rack. Ya no adivina desde cuándo está colgado: el sistema le imprime las etiquetas del color que toca hoy.',
};

export const casosOU = [
  {
    id: 'lote',
    titulo: 'El día que llega el lote (junio y febrero)',
    texto: 'Aquí se decide el año: cuántas piezas llegaron de verdad, cómo se clasificaron y a qué precio se etiquetó cada montón. Se cuenta pieza por pieza contra la lista, el faltante queda anotado —en lote cerrado no se reclama, pero tiene que subirte el costo— y el sistema reparte el bulto, el flete, la maniobra y la clasificación entre las piezas contadas.',
    remate: 'De un lote de 1,200 piezas, dos personas se llevan cinco días. Si el costo no se saca ahí, el margen de los siguientes seis meses está mal.',
    img: `${IMG}/caso-lote.webp`,
    alt: 'Recepción de un lote de saldo en la bodega de un outlet: cajas de cartón abiertas y el conteo pieza por pieza contra la lista',
  },
  {
    id: 'bajada',
    titulo: 'De la semana 3 a la 10: la bajada',
    texto: 'Es cuando la pieza deja de ser novedad y empieza a estorbar. Si la tanda no baja de escalón a tiempo, termina saliendo en $99 cuando pudo salir en $209 — y $99 está abajo de lo que costó puesta en el piso. Cada tanda baja sola a los 21, 45 y 75 días desde que entró, y lo que queda al final se barre en surtido de mayoreo o en bulto completo.',
    remate: 'Y la regla que casi nadie apunta: el lote nuevo mata al lote viejo. Lo del mes pasado hay que bajarlo el mismo día que se cuelga el nuevo.',
    img: `${IMG}/caso-mayoreo.webp`,
    alt: 'Mesa de empaque de un outlet armando el surtido de 30 piezas para una revendedora, con las bolsas ya contadas',
  },
  {
    id: 'buenfin',
    titulo: 'Buen Fin y Hot Sale: cuando el barato compite',
    texto: 'Las tiendas de línea ponen 50 y 60 %, o sea el precio de aquí, y arriba las departamentales meten ventas nocturnas que se llevan un sábado completo. Se gana con mercancía fresca y un escalón más abajo: precio plano por rack y por mesa, promoción por monto y por cantidad, y lo que lleva dejado el lote a la vista para no vender abajo de costo sin darte cuenta.',
    remate: 'Es el mes más grande del año. Llegar con el piso lleno de cosa vieja y sin nada nuevo que enseñar es perderlo.',
    img: `${IMG}/caso-sabado.webp`,
    alt: 'Caja rápida de un outlet en sábado, con la fila de clientas cargando montones de piezas y la encargada escaneando etiquetas',
  },
  {
    id: 'reyes',
    titulo: 'Del 26 de diciembre al 6 de enero',
    texto: 'Once días que pagan el arranque del año: aguinaldo, regalo barato y Reyes. Se gana avisando a tiempo y teniendo el piso lleno —el mensaje de “llegó lote nuevo” a la lista de clientas por talla, y el vivo del viernes con su lista de apartados— y se pierde con la caja lenta y la bodega llena de cosa sin etiquetar.',
    remate: 'Lo que no sale ahí se queda hasta marzo: después del 6 viene la cuesta y el piso se muere.',
    img: `${IMG}/caso-vivo.webp`,
    alt: 'Vivo por redes desde la bodega de un outlet: la encargada enseñando pieza por pieza y el compañero anotando los números apartados',
  },
];

export const seccionesOU: SuiteSeccion[] = [
  {
    id: 'recepcion', tag: 'Recepción',
    titulo: 'Cuánto te salió puesta en el piso',
    texto: 'Se cuenta pieza por pieza contra la lista del lote y el faltante queda registrado. El sistema reparte el precio del bulto más el flete, la maniobra, la clasificación y el etiquetado entre las piezas que de verdad se contaron —no entre las de la lista— y le carga la merma a las que sí pasan por caja. Ese es el número con el que se decide todo el año.',
    bullets: ['Conteo real contra la lista: en la lista 1,200, contadas 1,174, y el faltante anotado', 'El costo del bulto, el flete, la maniobra y la clasificación repartidos entre las contadas', 'La pieza de $85 te salió en $99.32 puesta en el piso; con la merma, $101.92 por pieza vendida'],
    visual: mockTicket('Lote 151 · costo puesto en el piso', [['Precio del lote · 1,200 de lista a $85', '$102,000'], ['Flete desde la bodega del que surte', '$6,500'], ['Maniobra de descarga y acomodo', '$1,200'], ['Conteo y clasificación · 2 personas × 5 días', '$4,800'], ['Etiquetas, ganchos y bolsas', '$2,100']], ['Costo puesto en el piso', '$116,600'], 'Entre las 1,174 contadas: $99.32. Y entre las 1,144 que sí pasan por caja: $101.92 la pieza'),
  },
  {
    id: 'clasificar', tag: 'Clasificación',
    titulo: 'Cuatro montones y las etiquetas de un jalón',
    texto: 'En la misma pantalla de recepción se separa primera, segunda, con defecto y para remate, y cada montón lleva su precio: la misma prenda vale $299 o $49 según cómo salió del bulto. El alta es por montón —precio, calidad y talla— y de ahí salen las 1,174 etiquetas de un jalón, cada una con su código de pieza. Nadie teclea mil claves.',
    bullets: ['Primera, segunda, con defecto y para remate, con precio distinto por montón', 'Alta por montón e impresión masiva: cada etiqueta con su código, sus dos precios y su color', 'La talla queda como dato de la pieza, para el piso, para el vivo y para el WhatsApp'],
    visual: mockBarras('Lote 151 · cómo salió el bulto', [['Primera', '780 pz', 100], ['Segunda', '244 pz', 31], ['Con defecto', '118 pz', 15], ['Remate', '32 pz', 4]], 'El que surte dio 66 % de primera; con eso se decide la siguiente compra a ciegas'),
  },
  {
    id: 'bajada', tag: 'La bajada',
    titulo: 'Cada tanda baja sola de escalón',
    texto: 'La tanda entra en verde y el sistema la pasa a amarilla a los 21 días, a roja a los 45 y al tendido a los 75, contando desde la fecha en que se recibió. Nadie se acuerda de bajarle a 4,000 piezas. Y los días no se reinician con el traspaso: la pieza viaja con su fecha de entrada, o la tienda lenta se vuelve el lugar donde todo vuelve a ser nuevo.',
    bullets: ['Verde, amarilla y roja por tanda de entrada, y cuánto dinero hay parado en cada color', '“¿Cuánto lleva colgada?” por tanda, por rack y por sucursal, desde el celular', 'El traspaso entre tiendas no reinicia los días; la pieza se lleva su fecha'],
    visual: mockCalendario('La bajada del lote 148', 'Junio', 30, { 3: 'lleno', 24: 'aviso', 25: 'aviso' }, 'La tanda entró el 3 y se colgó en verde; el 24 cumple 21 días y pasa sola a amarilla, de $299 a $209'),
  },
  {
    id: 'desmarque', tag: 'Precio y desmarque',
    titulo: 'Dos precios en la etiqueta, y lo que la marca te obliga',
    texto: 'El argumento de venta no es el precio, es el porcentaje, y todos los escalones se calculan contra el precio original de la marca: entra al 50, pasa al 65, se va al 75 y de ahí al tendido. Si el contrato pide desmarque, la etiqueta se imprime sin el nombre de la marca, con el precio mínimo bloqueado y con aviso si una sucursal cae dentro del radio prohibido.',
    bullets: ['Un solo criterio: cada escalón contra el precio original, nunca sobre el ya rebajado', 'Etiqueta sin marca, precio mínimo bloqueado y aviso de radio, como lo pide el contrato', 'Quién puede bajar un precio: la encargada cambia etiquetas, el gerente autoriza en su rango, abajo del mínimo solo el dueño'],
    visual: mockTicket('Blusa satinada · la escalera contra el original', [['Precio original de la marca', '$599'], ['Etiqueta verde · al 50', '$299'], ['Etiqueta amarilla · al 65', '$209'], ['Etiqueta roja · al 75', '$149']], ['Piso que pide la marca', '$149'], 'Se imprime sin el nombre de la marca cuando el contrato lo pide, y no deja cobrar abajo del mínimo'),
  },
  {
    id: 'canales', tag: 'Caja, vivo y en línea',
    titulo: 'Una sola pieza, en tres lugares al mismo tiempo',
    texto: 'Lo que se vende en el piso se baja solo del vivo y de la tienda en línea en el mismo minuto: con existencia 1, la clienta que pagó y no hay pieza no regresa. La caja rápida escanea la etiqueta del precio y cobra sin buscar talla ni modelo, con efectivo, tarjeta y transferencia, y sigue cobrando aunque se vaya el internet.',
    bullets: ['Apartados del vivo por el número que gritaron en el comentario, liberados solos a las 24 horas', 'Apartado a abonos con fecha: lo vencido se libera el mismo día y la pieza regresa al rack', 'WhatsApp a la lista de clientas por talla: “llegó lote nuevo”, con las fotos de lo que se acaba de colgar'],
    visual: mockLista('Vivo del viernes · apartados', [['Pieza 47 · mezclilla talla 30 · transferencia recibida', 'Pagada', 'ok'], ['Pieza 112 · chamarra talla M · vence a las 9 de la noche', 'Se libera hoy', 'aviso'], ['Pieza 205 · vestido talla 34 · dos clientas en lista de espera', 'Apartada', 'ok'], ['Pieza 83 · blusa talla 32 · no pagó en 24 horas', 'Regresó al rack', 'gris']], 'Lo que se vende en el piso se baja del vivo y de la tienda en línea en el mismo minuto'),
  },
  {
    id: 'cierre', tag: 'Lo que dejó el lote',
    titulo: 'El bulto se cierra y te dice si ganaste',
    texto: 'Aquí no se gana por modelo: se gana por lote, y se sabe el día que salió la última pieza, incluida la que se remató a $50 y el bulto que se le vendió al revendedor. El sistema junta todo lo cobrado contra el costo puesto en el piso, lo dice sobre la venta y saca lo que de verdad manda: cuánto por semana y cuántas vueltas al año.',
    bullets: ['Cierre del lote con lo cobrado de todas las piezas, el remate y el bulto final incluidos', 'La calificación del que surte: qué porcentaje de primera dio, cuántas semanas tardó y cuánto dejó', 'Merma con motivo —robo, dañado, perdido— e inventario cíclico por rack, un rack al día'],
    visual: mockBarras('Lote 151 · cerrado en 14 semanas', [['Cobrado', '$261,908', 100], ['Costo', '$116,600', 45], ['Dejó', '$145,308', 55]], '55.5 % sobre la venta: $10,379 por semana y 3.7 vueltas al año, contra 2 cuando el lote tarda 26 semanas'),
  },
];

export const planoOU = [
  {
    id: 'racks', nombre: 'Racks largos por escalón', simbolo: 'rieles' as const,
    foto: `${IMG}/zona-racks.webp`, alt: 'Racks paralelos de un outlet ordenados por precio y por color de etiqueta, tan llenos que los ganchos no corren',
    pie: 'Los dos primeros racks son siempre lote nuevo en verde; el pasillo amarillo y el rojo van separados.',
    pregunta: '¿Qué tanda baja hoy?',
    caja: { x: 68, y: 82, w: 216, h: 96 },
    items: [
      { t: 'Días de piso por tanda, por rack y por sucursal: “¿cuánto lleva colgada?”' },
      { t: 'La bajada automática por fecha de entrada: 21, 45 y 75 días' },
      { t: 'Impresión de las etiquetas del color que toca, para el cambio del lunes antes de abrir' },
      { t: 'Cuánto dinero hay parado en verde, en amarilla y en roja', plan: 'Controla' },
      { t: 'Quién puede bajar un precio, por rol y por rango', plan: 'Controla' },
    ],
  },
  {
    id: 'revoltura', nombre: 'La revoltura y el rack de defecto', simbolo: 'exhibidores' as const,
    foto: `${IMG}/zona-revoltura.webp`, alt: 'Mesa central de la revoltura en un outlet, con clientas escarbando y el rack de piezas con defecto aparte',
    pie: '“Todo a $199”, “todo a $99”: aquí baja el ticket y sube el número de piezas por venta.',
    pregunta: '¿Qué se va al tendido?',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Precio plano por mesa y por rack: “todo a $199”, “3 x $100”' },
      { t: 'La segunda y la de defecto en rack aparte, con el defecto avisado desde la etiqueta' },
      { t: 'Remate final y venta del bulto completo a un revendedor, en un solo movimiento' },
      { t: 'Surtido de mayoreo de 20, 30 o 50 piezas con su lista de precios aparte' },
      { t: 'Con menos del 15 % del lote en piso, se barre todo junto a precio único', plan: 'Automatiza' },
    ],
  },
  {
    id: 'probadores', nombre: 'Probadores y control de prendas', simbolo: 'probadores' as const,
    foto: `${IMG}/zona-probadores.webp`, alt: 'Fila de probadores con cortina en un outlet, el encargado entregando la ficha numerada y contando las prendas',
    pie: 'Es el punto número uno de robo del giro: en pieza única, la que se llevaron no aparece hasta el conteo del rack.',
    pregunta: '¿Cuántas entraron y cuántas salieron?',
    caja: { x: 68, y: 196, w: 216, h: 78 },
    items: [
      { t: 'Inventario cíclico por rack: se cuenta un rack al día, sin cerrar la tienda' },
      { t: 'Merma con motivo —robo, dañado, perdido— que pega a lo que dejó el lote', plan: 'Controla' },
      { t: 'El faltante se detecta en días, no en el conteo de fin de año' },
      { t: 'El rack de rechazadas se regresa a su lugar y vuelve a quedar a la venta' },
      { t: 'Del 2 al 4 % del bulto se va en robo hormiga, y aquí se ve cuánto', plan: 'Controla' },
    ],
  },
  {
    id: 'caja', nombre: 'Caja rápida y apartados', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-caja.webp`, alt: 'Caja rápida de un outlet con el escáner de mano, la reja de ganchos vacíos y el estante de apartados detrás',
    pie: 'No se busca modelo ni talla: se escanea la etiqueta del precio, se dobla y se embolsa.',
    pregunta: '¿Cuánto le falta a ese apartado?',
    caja: { x: 68, y: 290, w: 216, h: 88 },
    items: [
      { t: 'Caja rápida por etiqueta de precio, con y sin internet' },
      { t: 'Efectivo, tarjeta y transferencia, que ya es la mitad del vivo y casi todo el mayoreo' },
      { t: 'Apartado a abonos con fecha; lo vencido se libera solo y la pieza regresa al rack', plan: 'Fideliza' },
      { t: 'Corte por caja y por turno, con la diferencia a la vista', plan: 'Controla' },
      { t: 'Facturación para la revendedora que sí factura y para el mayoreo grande' },
    ],
  },
  {
    id: 'bodega', nombre: 'Bodega: recepción, mesa y salida', fuera: true, simbolo: 'paquetes' as const,
    foto: `${IMG}/zona-bodega.webp`, alt: 'Bodega de un outlet con las cajas de cartón selladas y los bultos amarrados, el número de lote escrito con marcador y la mesa de clasificación',
    pie: 'Aquí se cuenta contra la lista, se clasifica en cuatro botes y se etiqueta; de aquí sale todo lo demás.',
    pregunta: '¿Cuántas llegaron de verdad?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Recepción del lote con conteo real contra la lista y el faltante registrado' },
      { t: 'El costo repartido entre las piezas contadas, con flete, maniobra y etiquetado' },
      { t: 'Alta por montón e impresión masiva de etiquetas, con marca o sin marca' },
      { t: 'Traspasos entre sucursales que no reinician los días, y traspaso con cambio de precio desde la tienda de línea', plan: 'Controla' },
      { t: 'Consignación: de quién es cada pieza y qué se le liquida en cada corte', plan: 'Controla' },
    ],
  },
];

export const pasosOU = [
  { cuando: 'Día 1', titulo: 'Tus lotes, cargados', texto: 'Nos das lo que tienes colgado y lo subimos nosotros, por lote y por tanda. No capturas nada.', detalle: 'Con su número de lote, su fecha de entrada, su calidad y su escalón, para que la bajada empiece a correr con los días que ya llevan.', img: `${IMG}/proceso-recibir.webp`, alt: 'Recepción de cajas de cartón selladas con el número de lote escrito con marcador en la bodega de un outlet' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus montones, tu escalera, tus sucursales y lo que te obliga cada marca.', detalle: 'Los cuatro montones con su precio, los 21, 45 y 75 días, el precio mínimo y el desmarque de cada proveedor, y quién puede bajar un precio.', img: `${IMG}/proceso-clasificar.webp`, alt: 'Mesa de clasificación de un outlet con los cuatro botes: primera, segunda, con defecto y para remate' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Dar de alta un montón e imprimir las etiquetas se aprende en media hora.', detalle: 'Y se practica lo de todos los días: la caja rápida por etiqueta, el apartado del vivo y el cambio de etiquetas del lunes.', img: `${IMG}/proceso-etiquetar.webp`, alt: 'Estación de etiquetado de un outlet con la pistola y la impresora sacando la tira de etiquetas de dos precios' },
  { cuando: 'Día 4', titulo: 'Arranca una tienda', texto: 'La primera sucursal vende con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con los apartados y los abonos ya migrados: ninguna clienta llega por su pieza y se encuentra con que su papelito no existe.', img: `${IMG}/proceso-caja.webp`, alt: 'Caja rápida de un outlet cobrando un montón de piezas escaneando la etiqueta del precio' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día.', detalle: 'Y el lunes siguiente la bajada ya corre sola en todas: cada tanda pasa de verde a amarilla sin que nadie recorra los racks.', img: `${IMG}/proceso-bajada.webp`, alt: 'Encargada de un outlet cambiando las etiquetas verdes por amarillas en un rack antes de abrir' },
];
export const ticketOU = { lineas: [{ n: 'Blusa satinada · 32 · etiqueta verde', p: '$299' }, { n: 'Mezclilla recta · 30 · etiqueta amarilla', p: '$209' }, { n: 'Revoltura · todo a $99', p: '$99' }], total: '$607' };

export const escalaOU = [
  { n: '1 tienda', nombre: 'La tienda de saldos', cambia: ['El dueño es el que compra, el que clasifica y el que decide cuándo bajarle', 'El lote se recibe en la bodega de atrás y la bajada es “ya se ve viejo, bájale”', 'Todo está en su cabeza y en un cuaderno: funciona mientras él esté todos los días'], sistema: ['Alta por montón con las etiquetas de un jalón y caja rápida por etiqueta', 'Qué lleva cobrado de ese lote y en qué escalón va lo que queda colgado', 'Una caja, un celular y una impresora de etiquetas'], dato: { valor: '$101.92', rotulo: 'lo que de verdad cuesta puesta en el piso la pieza de $85, ya con la merma' } },
  { n: '5 tiendas', nombre: 'Las tiendas de la zona', cambia: ['Encargada por tienda y el dueño ya no está en todas', 'El lote se recibe en una sola bodega y se reparte a mano, casi siempre a como caiga', 'Cada encargada baja cuando se le ocurre: lo mismo está en verde aquí y en rojo allá'], sistema: ['La bajada central por tanda, igual en las cinco, y quién puede bajar un precio', 'Existencias por sucursal y traspasos que no reinician los días', 'Lista de precios distinta por formato, si la de plaza no es la de barrio'], dato: { valor: '21, 45 y 75', rotulo: 'los días en que cada tanda baja de escalón, sin que nadie se acuerde' } },
  { n: '50 tiendas', nombre: 'La cadena con centro de distribución', cambia: ['Se cuenta, se clasifica y se etiqueta en el CEDIS, y el reparto ya es decisión de negocio', 'Nadie puede recorrer 50 tiendas cambiando precios: la bajada tiene que ser automática', 'El robo hormiga deja de ser anécdota y se vuelve un porcentaje del año'], sistema: ['Recepción y costo repartido en el CEDIS, con reparto por cómo se mueve cada tienda', 'Inventario cíclico por rack y merma con motivo en las 50', 'Traspaso con cambio de precio desde la tienda de línea, con etiqueta nueva'], dato: { valor: '3.7 vueltas', rotulo: 'al año contra 2, cuando el lote sale en 14 semanas y no en 26' } },
  { n: '150 tiendas', nombre: 'La cadena de outlet', cambia: ['Calendario de temporada: cuándo entra cada lote, a qué tiendas y en qué escalón arranca', 'Tres formatos con tres listas de precios: outlet de plaza, tienda de saldos y bazar temporal', 'Se compra por contrato anual de sobrantes, y una parte ya es hecho para outlet'], sistema: ['El resultado por temporada, no por bulto suelto, con la calificación de cada que surte', 'Tienda temporal en tablet: se abre y se cierra en tres días con su corte y su inventario', 'Mayoreo y remate de bulto como línea de negocio, que es lo que limpia 150 pisos a la vez'], dato: { valor: '$32,250', rotulo: 'más por el mismo bulto, cuando la bajada corre sola en vez de a ojo' } },
];

export const problemasOU = {
  doc1: {
    membrete: 'Sistema de ropa', sub: 'Reporte de inventario',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'EXIST.'],
    lineas: [
      { a: 'SKU-0471', b: 'BLUSA DAMA SATINADA', c: '1' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿y el lote?', '¿cuánto lleva colgada?'],
    sello: 'NO SABE<br />DEL LOTE',
    notas: [
      'Te pide <b>una clave por pieza</b>. Son 1,174 y cada una es distinta.',
      'Marca “faltante” y te pide reponer la talla. Aquí <b>no se repone</b>: se vendió y se acabó.',
      'No sabe qué te costó <b>puesta en el piso</b>: reparte sobre las de la lista, no sobre las contadas.',
      'No baja sola de escalón ni sabe qué día entró la tanda: <b>bajas cuando te acuerdas</b>.',
    ],
  },
  doc2: {
    membrete: 'Desarrollo a la medida', sub: 'Propuesta · rev. 4',
    cab: ['CONCEPTO', 'PLAZO'],
    lineas: [
      { a: 'BAJADA POR TANDA', b: 'FASE 2' },
      { a: 'ENTREGA REAL', b: 'PASÓ EL BUEN FIN', tachado: true },
      { a: 'COSTO DEL LOTE', b: 'NO' },
    ],
    margen: ['+ 3 adendas', 'y llegó el Buen Fin'],
    sello: 'LLEGÓ<br />TARDE',
    notas: [
      'Costó <b>más de lo cotizado</b> y la bajada por tanda quedó para la fase 2.',
      'Funciona… mientras <b>quien lo hizo conteste el teléfono</b>. Tu mes es noviembre.',
      'Cada cambio chico —imprimir la etiqueta sin la marca— es <b>una cotización nueva</b>.',
      'No trae cierre de lote ni pieza única entre canales. El sábado del vivo, <b>la lista se lleva a mano</b>.',
    ],
  },
  filas: [
    { que: 'Alta por montón e impresión masiva de etiquetas', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Costo del lote repartido entre las piezas contadas', generico: 'No existe', medida: 'Rara vez', sacs: 'Incluido' },
    { que: 'La bajada automática por tanda, con etiqueta de color', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'Doble precio, desmarque y precio mínimo de la marca', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Pieza única en el piso, en el vivo y en línea', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Tiempo para arrancar', generico: 'Días', medida: '4 a 9 meses', sacs: 'Días' },
    { que: 'Quién lo mantiene', generico: 'Su proveedor', medida: 'Tú, si lo encuentras', sacs: 'Nosotros, a diario' },
  ],
  entrada: 'Casi todo outlet que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un sistema de ropa hecho para reponer talla, que te pide una clave por pieza y no sabe qué es un lote, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'los outlets y las tiendas de saldos que ya la usan',
};

export const cifrasOU = {
  foto: `${IMG}/escala.webp`,
  alt: 'Centro de distribución de una cadena de outlet con las líneas de clasificación y los lotes repartidos por sucursal',
  frase: 'De la tienda de saldos de la esquina a la cadena que recibe lotes por contrato y los reparte a 150 pisos.',
  encuadre: 'center 45%',
};
