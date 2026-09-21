/**
 * Contenido de la landing de LENCERÍA Y ROPA INTERIOR (17-sep-2026). Sale de la ficha del oficio
 * (scratchpad/giros-fichas/lenceria.md) con el dictamen del referee aplicado: "número y copa" (no
 * banda a secas), "se descompletó el juego" (no viudo), ganancia de la vendedora (compra a precio
 * de afiliada, no comisión), campañas cada 4-6 semanas, el protector es de pantaleta (el brasier se
 * cambia con etiqueta y ticket), tripack, EG, copa completa, balconet, "se corren" las medias, y el
 * bloque propio "La pared que se rompe por el centro" (número × copa, talla hermana, talla guardada
 * en la ficha) con el dato "huecos del centro hoy". No repite matriz talla-color ni curva (ropa) ni
 * set ni remato-o-guardo (trajes de baño).
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran como
 * parte del sistema; se construyen si el cliente las pide): cuadrícula número × copa, talla hermana
 * en la caja, alerta de huecos del centro por celda, tripack que pide clave para abrirse, leyenda y
 * bloqueo de devolución por higiene, talla en la ficha y aviso cuando llega, vendedoras de catálogo
 * con precio de afiliada, cartera y campañas, reserva del pedido de campaña, escalón de precio por
 * cantidad, surtido como unidad de mayoreo, premios por meta, vale de cambio, finanzas por canal.
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista } from './_mocks';

const IMG = '/images/giros/lenceria';

export const bannerLE = {
  eyebrow: 'SACS · Lencería y ropa interior',
  titulo: 'La talla son dos números.',
  resalte: 'Y si falta una, dos vecinas la salvan.',
  sub: 'La pared por número y copa, la talla hermana en la caja, la talla de cada clienta guardada en su ficha, las vendedoras de catálogo con su cartera, y el tripack que no se abre — con un mismo inventario para tu tienda, tu catálogo y tu WhatsApp.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Boutique de lencería en la Ciudad de México: la pared de brasieres por número y copa y la dueña con la cuadrícula en su tablet',
  avisos: [
    { modulo: 'Talla hermana', texto: 'Pidieron 34C negro · 0 · ofrécele 36B (2) o 32D con extensor (1)', pos: 1 as const, tono: 'azul' as const, sello: 'En caja' },
    { modulo: 'Llegó su talla', texto: '34D vino · 6 clientas con 34D en su ficha · aviso por WhatsApp', pos: 2 as const, tono: 'verde' as const, sello: 'Viernes' },
    { modulo: 'Huecos del centro', texto: 'Básico negro: 34C, 36C y 36D en cero · pedir el lunes', pos: 3 as const, tono: 'ambar' as const, sello: 'Lunes' },
  ],
};

export const manifiestoLE = {
  intro: 'Sabemos cómo se vende la lencería',
  frases: [
    'Tienes la <b>pared llena</b> y no tienes nada: se fueron todas las 34C y 36C y quedaron puras 32A y 42DD que nadie pide.',
    'No había <b>36B</b> y la dejaron ir. Sí había 34C, que le queda igual, y nadie lo supo.',
    'Cada domingo te sientas con el <b>cuaderno</b> a sacar cuánto te debe cada vendedora, y siempre hay una que dice que ella no debe eso.',
    'Vendiste un set por <b>WhatsApp</b> que ya estaba apartado para una vendedora de catálogo. Le quedaste mal a las dos.',
    'Te piden fotos de cada color y contestas “déjame checar” y corres a contar. Para cuando contestas, <b>ya compró en otro lado</b>.',
    'Mediste a la señora, le encontraste su talla y se fue feliz. Al mes regresó y <b>nadie se acordaba</b> cuál era.',
    'Mandaste a coser <b>300 brasieres</b> con <a href="/herramientas/curva-de-tallas">la corrida que tú creías</a>, y te quedaste dos años con las copas A del coral.',
    'Abrieron un <b>tripack</b> para vender una pantaleta y te quedó una bolsa con dos que ya nadie paga.',
  ],
  cierre: 'Ningún sistema de ropa entiende que aquí la talla son dos números que se cruzan, que si falta una celda hay dos vecinas que salvan la venta, ni que la talla de la clienta se mide en la tienda y vale dinero. Sacs sí: cada pantalla que sigue funciona igual en el mostrador, en la mesa de catálogo y en el WhatsApp. Y encima puedes poner agentes de IA para que hagan el trabajo repetitivo: la lista de huecos del lunes, el aviso de “ya llegó tu talla” y el cierre de campaña.',
};

export const variantesLE = {
  eyebrow: 'Un solo modelo',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“un brasier negro”.',
  sub: 'Cinco números por cinco copas: veinticinco existencias de un solo modelo en un solo color. El centro (34B a 36D) se va en dos semanas y la pared se ve llena de orillas. La corrida se rompió aunque parezca que hay de todo.',
  ejeA: ['A', 'B', 'C', 'D', 'DD'],
  filas: [
    { nombre: '32', img: `${IMG}/prod-negro.webp`, alt: 'Brasier negro número 32' },
    { nombre: '34', img: `${IMG}/prod-negro.webp`, alt: 'Brasier negro número 34' },
    { nombre: '36', img: `${IMG}/prod-negro.webp`, alt: 'Brasier negro número 36' },
    { nombre: '38', img: `${IMG}/prod-negro.webp`, alt: 'Brasier negro número 38' },
    { nombre: '40', img: `${IMG}/prod-negro.webp`, alt: 'Brasier negro número 40' },
  ],
  matriz: [
    [3, 2, 1, 1, 0],
    [2, 0, 0, 1, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 0, 1, 2],
    [0, 1, 2, 2, 2],
  ],
  unidad: 'piezas',
  genero: 'f' as const,
  anchoCelda: '56px',
  leyendas: ['Con existencia', 'Queda poco', 'Agotada'] as [string, string, string],
  remate: 'Nueve huecos, y siete son del centro: 34B, 34C, 36B, 36C, 36D, 38C. Lo que queda son 32A y 40DD. Eso es una corrida rota, y se ve aquí antes de que pregunten.',
};

export const cortinaLE = {
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Encargada de una corsetería de barrio hojeando el cuaderno frente a la pared de brasieres, con una clienta esperando',
  altDespues: 'La misma encargada mostrando en la tablet la cuadrícula de número y copa con las tallas hermanas iluminadas',
  libreta: ['Negro 34C — ¿queda?', 'Sra. Vega: 34D vino', 'Cartera Lupita $1,240'],
  filas: [
    { que: '¿Hay 34C del negro?', donde: 'La cuadrícula en la tablet', dato: 'Cero. Pero 36B (2) y 32D con extensor (1): la venta no se va' },
    { que: '¿Qué número era la señora?', donde: 'En su ficha, con su WhatsApp', dato: '34D. Cuando llegue en vino, le avisa el sistema, no la memoria' },
    { que: 'Cuánto debe cada vendedora', donde: 'La cartera de la campaña', dato: 'Pedido, abonos y saldo por vendedora, sin cuaderno de domingo' },
    { que: 'El tripack', donde: 'Un código, tres piezas', dato: 'Se vende cerrado; abrirlo pide clave de la encargada' },
  ],
  pieDespues: 'La misma encargada, la misma clienta. Ya no dice “déjame checar”: ve.',
};

export const casosLE = [
  {
    id: 'febrero',
    titulo: 'La semana del 14 de febrero: lo rojo se acaba el día 10',
    texto: 'Si el rojo en 34C y 36C se acabó el día 10, los últimos cuatro días se venden con talla hermana o no se venden. La cuadrícula del modelo rojo en semáforo y el traspaso desde la otra sucursal antes del día 8.',
    remate: 'Lo que sobre el 15 es de fantasía y no vuelve a salir hasta diciembre.',
    img: `${IMG}/proceso-pared.webp`,
    alt: 'La pared de brasieres de una tienda de lencería con los ganchos por número y copa y un hueco en el centro',
  },
  {
    id: 'mayo',
    titulo: 'El 10 de mayo: la campaña más grande del catálogo',
    texto: 'Las vendedoras meten pedidos hasta el día 5. La campaña abierta suma todos los pedidos por modelo, número, copa y color contra lo que hay en bodega, y saca en una sola lista lo que falta pedir al proveedor.',
    remate: 'Un pedido entregado después del 10 se cancela y se queda en cartera.',
    img: `${IMG}/caso-catalogo.webp`,
    alt: 'Mesa de catálogo de una distribuidora de lencería con las vendedoras recogiendo sus bolsas de campaña',
  },
  {
    id: 'agosto',
    titulo: 'Regreso a clases: calceta por bolsa y por docena',
    texto: 'Ticket chico, mucho volumen, filas en el mostrador y mamás comprando seis paquetes. El punto de venta escanea la bolsa cerrada (el tripack es un código, no tres piezas), el precio por escalón sale solo y la caja no se cae sin internet.',
    remate: 'Si la muchacha cobra un paquete como pieza suelta, se regala.',
    img: `${IMG}/proceso-calceteria.webp`,
    alt: 'Tienda de lencería y calcetería en agosto, con las mamás comprando paquetes de calceta escolar en el mostrador',
  },
  {
    id: 'lunes',
    titulo: 'El lunes: pedir solo las celdas que faltan',
    texto: 'Se resurte por celda, no por modelo. La lista de huecos del centro sale sola: básico negro, 34C en cero con seis pedidos en 30 días → pedir; coral de encaje, 32A con cuatro piezas y cero pedidos → no pedir. Y lo que no pediste en septiembre no existe en diciembre.',
    remate: '“Pídeme 34C y 36C del negro, nada más” es lo normal en este ramo.',
    img: `${IMG}/proceso-lunes.webp`,
    alt: 'Dueña de una tienda de lencería revisando en su laptop la cuadrícula con los huecos del centro antes de pedir',
  },
];

export const seccionesLE: SuiteSeccion[] = [
  {
    id: 'cuadricula', tag: 'Inventario',
    titulo: 'La pared como cuadrícula: número por copa',
    texto: 'Cada brasier existe como 34C, 36B o 38DD: así se compra, se cuenta y se vende. La cuadrícula del modelo se ve como la pared, con lo que hay de cada celda en cada color. Y el sistema acepta las tres formas: número y copa, solo número (brasier de fábrica) o solo letra.',
    bullets: ['Número en renglón, copa en columna, por color y por sucursal', 'Los huecos del centro se ven desde la caja: son la lista del lunes', 'Etiquetas con número y copa impresas desde la recepción'],
    visual: mockMatriz('Básico negro · existencia por número y copa', ['A', 'B', 'C', 'D', 'DD'], [['32', [3, 2, 1, 1, 0]], ['34', [2, 0, 0, 1, 1]], ['36', [1, 0, 0, 0, 1]], ['38', [0, 1, 0, 1, 2]], ['40', [0, 1, 2, 2, 2]]], 'Siete huecos del centro: la corrida se rompió aunque la pared se vea llena', [1, 2], 1),
  },
  {
    id: 'hermana', tag: 'Caja',
    titulo: 'La talla hermana, en la caja y en el chat',
    texto: 'Pidieron 34C y no hay. La pantalla no dice “agotado”: dice “tienes 36B (2) y 32D con extensor (1)”. Y apunta que se pidió 34C y se vendió 36B, para que el lunes se pida la que faltó.',
    bullets: ['Hermanas iluminadas junto a la talla que faltó, con su existencia', 'Primero su número en otro color, luego la hermana, luego otra sucursal con apartado', 'Cada petición sin existencia alimenta la lista de huecos'],
    visual: mockLista('Pidieron 34C · básico negro', [['34C negro · 0 en tienda · 2 en Plaza', 'Traspaso o apartado', 'aviso'], ['36B negro · queda igual de copa', 'Tienes 2', 'ok'], ['32D negro · con extensor', 'Tienes 1', 'ok'], ['34C piel · su número en otro color', 'Tienes 3', 'ok']], 'La venta no se va: se ofrece, se apunta la petición y el lunes se pide 34C'),
  },
  {
    id: 'ficha', tag: 'Clientas',
    titulo: 'La talla medida se queda en su ficha',
    texto: 'Siete de cada diez entran con la talla equivocada. La muchacha la mide en dos minutos y la talla se guarda con su WhatsApp: número, copa, pantaleta y faja. Cuando llega su talla en un color nuevo, el aviso sale solo.',
    bullets: ['Ficha con número y copa, talla de pantaleta y de faja', '“Ya llegó tu 34D en vino, ¿te aparto?” a las que la tienen en su ficha', 'La siguiente venta se hace por foto, sin pisar la tienda'],
    visual: mockLista('Llegó 34D negro y vino · viernes', [['Sra. Vega · 34D · compró en marzo', 'Aviso enviado', 'ok'], ['Lupita R. · 34D · apartó por transferencia', 'Apartado', 'ok'], ['Sra. Ortiz · 34D · pidió el vino en febrero', 'Aviso enviado', 'ok'], ['Karla M. · 34C · hermana', 'Sin aviso', 'gris']], 'Seis clientas con 34D en su ficha; tres contestaron el mismo día'),
  },
  {
    id: 'catalogo', tag: 'Catálogo',
    titulo: 'Las vendedoras, la campaña y la cartera',
    texto: 'Cada vendedora con su precio de afiliada, su pedido de campaña, sus abonos y su tope de crédito. La campaña suma todos los pedidos por modelo, número, copa y color y saca lo que falta pedir. Lo comprometido para una vendedora no se vende en el mostrador ni por WhatsApp.',
    bullets: ['Dos listas de precio: afiliada y catálogo; su ganancia sale sola', 'Cartera por vendedora: pedido, abonos, saldo; sin pedido nuevo con cartera vencida', 'Bolsas de campaña por vendedora y premios por meta sin Excel de domingo'],
    visual: mockBarras('Campaña 10 de mayo · pedidos por vendedora', [['Lupita R.', '$8,400 · al corriente', 84], ['Marisol T.', '$6,100 · al corriente', 61], ['Rosa E.', '$4,900 · cartera vencida', 49], ['Ana P.', '$3,200 · nueva', 32]], 'Consolidado: 312 piezas por modelo, número, copa y color; faltan 41 por pedir'),
  },
  {
    id: 'paquetes', tag: 'Paquetes y higiene',
    titulo: 'El tripack no se abre y la pantaleta no se devuelve',
    texto: 'El tripack es un código con tres piezas de la misma talla: se vende cerrado y abrirlo pide clave de la encargada. Pantaleta, bóxer, medias y calceta salen en el ticket como “sin cambio por higiene” y la caja no deja devolverlas. El brasier se cambia con etiqueta y ticket en 7 a 15 días.',
    bullets: ['Tripack cerrado; precio por escalón: pieza, tres, docena', 'Leyenda por categoría en el ticket y bloqueo de la devolución', 'Vale de cambio con vigencia en vez de dinero'],
    visual: mockTicket('Ticket · regreso a clases', [['Tripack calceta blanca · 2 · ×3', '$285'], ['Malla escolar · CH · ×2', '$130'], ['Brasier básico negro · 34C', '$420']], ['Total', '$835'], 'Calceta y malla: sin cambio por higiene · brasier: cambio 15 días con etiqueta'),
  },
  {
    id: 'whatsapp', tag: 'WhatsApp e Instagram',
    titulo: '“¿Lo tienes en 36C?”, contestado con la existencia',
    texto: 'La foto por color de cada modelo está lista para mandarla desde el chat, con la existencia por número y copa en pantalla. Apartado con anticipo por transferencia, guía por paquetería al interior, y la misma talla en la tienda en línea y en marketplaces.',
    bullets: ['Foto por color y existencia real en la conversación', 'Apartado con anticipo, guardado con nombre y cobrado al entregar', 'Tienda en línea, marketplaces y TikTok Shop con la variante número y copa'],
    visual: mockLista('WhatsApp · hoy', [['¿Tienes el rojo en 36C? · sí, 2 · foto enviada', 'Apartado', 'ok'], ['Set encaje vino · 34D + M · Instagram', 'Pagado', 'ok'], ['Faja postparto · M · fuerte · entrega 22', 'Anticipo', 'aviso'], ['Envío a Querétaro · pijama familiar', 'Guía lista', 'gris']], 'Cada chat queda en la ficha con su número y copa'),
  },
];

export const planoLE = [
  {
    id: 'mostrador', nombre: 'Mostrador y caja', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-mostrador.webp`, alt: 'Mostrador de una boutique de lencería con la cuadrícula de tallas en la tablet y los extensores a la mano',
    pie: 'Aquí se decide la talla hermana con la clienta enfrente: la cuadrícula a un clic.',
    pregunta: '¿Y si no hay 34C?',
    caja: { x: 68, y: 264, w: 216, h: 104 },
    items: [
      { t: 'La cuadrícula del modelo y las hermanas iluminadas, en la caja' },
      { t: 'Extensores y tirantes a la mano; el letrero de “sin cambio por higiene” también en el ticket' },
      { t: 'Escaneas la bolsa cerrada: el tripack es un código' },
      { t: 'Cobras el resto del apartado y entregas lo que llegó de otra sucursal', plan: 'Controla' },
      { t: 'El WhatsApp se contesta desde aquí, con existencias en pantalla' },
    ],
  },
  {
    id: 'pared', nombre: 'La pared de brasieres por talla', simbolo: 'exhibidores' as const,
    foto: `${IMG}/zona-pared.webp`, alt: 'La pared de brasieres de una tienda de lencería en ganchos por número y copa',
    pie: 'Es la cuadrícula física: renglones por número, columnas por copa, cada gancho con su talla.',
    pregunta: '¿Qué celdas del centro están vacías?',
    caja: { x: 68, y: 82, w: 216, h: 172 },
    items: [
      { t: 'Existencia por modelo, color, número y copa, en vivo y por sucursal', plan: 'Controla' },
      { t: 'Básicos a la altura de los ojos con mínimos por celda; moda arriba o en mesa' },
      { t: 'Los huecos del centro se ven desde la caja: son la lista de pedido del lunes' },
      { t: 'Tallas plus con su propio mueble y su propio proveedor, nunca escondidas' },
      { t: 'Foto por color de cada modelo para mandarla por WhatsApp sin descolgarlo' },
    ],
  },
  {
    id: 'mesa', nombre: 'Mesa de paquetes y calcetería', simbolo: 'anaqueles' as const,
    foto: `${IMG}/zona-bodega.webp`, alt: 'Cubos de pantaletas por talla, tripacks cerrados y calceta escolar en caja',
    pie: 'Ticket chico y mucho volumen: el precio por escalón sale solo y el paquete no se abre.',
    pregunta: '¿A cómo salen tres tripacks?',
    caja: { x: 298, y: 208, w: 128, h: 96 },
    items: [
      { t: 'Pantaleta suelta por talla (CH a 2EG) y por corte; tripack cerrado' },
      { t: 'Precio por escalón: pieza, tres, media docena, docena, sin que la muchacha lo calcule' },
      { t: 'Medias por talla y denier; calceta y malla escolar por paquete en agosto y enero' },
      { t: 'Ropa interior de caballero en su mueble, cerca de la puerta en junio' },
      { t: 'Conteo cíclico de la mesa con el escáner, sin cerrar', plan: 'Controla' },
    ],
  },
  {
    id: 'probador', nombre: 'Probador y toma de talla', simbolo: 'probadores' as const,
    foto: `${IMG}/zona-probador.webp`, alt: 'Pasillo de probadores de una boutique de lencería con la cinta métrica y la canasta de protectores',
    pie: 'Dos minutos con la cinta: la talla medida se guarda en la ficha de la clienta.',
    pregunta: '¿Qué número era la señora?',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Probador cerrado con protectores a la mano; la faja se prueba sobre ropa interior propia' },
      { t: 'Afuera, la cinta y la tabla: bajo busto y busto en dos minutos' },
      { t: 'La talla medida se guarda en la ficha con su WhatsApp: número, copa, pantaleta y faja', plan: 'Fideliza' },
      { t: 'Fajas por talla y compresión junto al probador, las de postparto aparte' },
      { t: 'El strapless, el balconet y la faja fuerte se apartan aquí mismo con anticipo y fecha' },
    ],
  },
  {
    id: 'catalogo', nombre: 'Bodega y mesa de catálogo', fuera: true, simbolo: 'paquetes' as const,
    foto: `${IMG}/zona-catalogo.webp`, alt: 'Mesa de catálogo de una distribuidora de lencería: bolsas de campaña por vendedora y el catálogo abierto',
    pie: 'El inventario de catálogo es otra bolsa: lo comprometido para una vendedora no está en la pared.',
    pregunta: '¿Cuánto me debe cada vendedora?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Campaña abierta y cerrada: pedidos por vendedora sumados por modelo, número, copa y color' },
      { t: 'Reserva del pedido de campaña: no se vende en mostrador ni por WhatsApp' },
      { t: 'Precio de afiliada, abonos, saldo y tope de crédito por vendedora', plan: 'Fideliza' },
      { t: 'Bolsas de campaña por vendedora y envíos por paquetería al interior' },
      { t: 'Cierre de campaña: premios por meta y lo que se pide al proveedor, sin cuaderno' },
    ],
  },
];

export const pasosLE = [
  { cuando: 'Día 1', titulo: 'Tu pared, cargada', texto: 'Nos das tu lista o tu sistema actual y lo subimos nosotros. No capturas nada.', detalle: 'Modelo, color, número y copa, con la existencia real de cada tienda; tripacks como un código y las clientas con su talla si ya la tienes.', img: `${IMG}/proceso-recibir.webp`, alt: 'Dos empleadas recibiendo la corrida de un proveedor y llenando la cuadrícula en la tablet' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus proveedores, tus vendedoras y tus reglas de cambio.', detalle: 'La regla de higiene por categoría, el escalón de precios, el precio de afiliada y quién puede abrir un tripack.', img: `${IMG}/proceso-campana.webp`, alt: 'Armado de las bolsas de campaña por vendedora en la mesa de catálogo' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Ver la cuadrícula y ofrecer la hermana se aprende en media hora.', detalle: 'Y se practica lo de todos los días: medir y guardar la talla, el apartado por WhatsApp y el cierre de campaña.', img: `${IMG}/proceso-hermana.webp`, alt: 'Cajera mostrando en la tablet las tallas hermanas iluminadas a una clienta' },
  { cuando: 'Día 4', titulo: 'Arranca una tienda', texto: 'La primera sucursal vende con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con los apartados y la cartera de las vendedoras ya migrados: nadie pierde su pedido ni su saldo.', img: `${IMG}/caso-whatsapp.webp`, alt: 'Dueña fotografiando un set por color para el catálogo de WhatsApp' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día.', detalle: 'Y el traspaso de copas entre tiendas ya corre desde la primera semana, que es cuando se rompe la corrida.', img: `${IMG}/caso-mayoreo.webp`, alt: 'Mostrador de mayoreo de una bodega de lencería con las corridas surtidas por talla' },
];
export const ticketLE = { lineas: [{ n: 'Brasier básico negro · 36B (hermana de 34C)', p: '$420' }, { n: 'Pantaleta · M · sin cambio', p: '$120' }, { n: 'Extensor', p: '$45' }], total: '$585' };

export const escalaLE = [
  { n: '1 tienda', nombre: 'La corsetería del barrio o la boutique de plaza', cambia: ['La dueña compra, mide a la clienta y contesta el WhatsApp', 'La cuadrícula vive en la pared: ella ve qué falta con los ojos, hasta que no está', '10 a 40 vendedoras de catálogo con cuaderno y Excel'], sistema: ['La talla de la clienta deja de estar en su cabeza', 'El WhatsApp contesta con existencias por número y copa', 'El tripack se cobra bien aunque no esté ella'], dato: { valor: '4 a 6', rotulo: 'de cada 30 ventas de brasier a la semana se salvan con la talla hermana' } },
  { n: '5 tiendas', nombre: 'La que ya tiene “las tiendas”', cambia: ['Aparecen las encargadas; la toma de talla se vuelve procedimiento', 'La corrida se rompe distinto en cada tienda: en Plaza faltan las C, en el barrio sobran las DD', '50 a 300 vendedoras con zonas y una persona armando bolsas'], sistema: ['Existencias por sucursal en tiempo real y traspaso por celda número-copa', 'Campaña consolidada y cartera por vendedora, sin Excel', 'CRM con la talla de cada clienta compartido entre tiendas'], dato: { valor: '1 celda', rotulo: 'a la vez: 34C del negro de la tienda del barrio a la de Plaza' } },
  { n: '50 tiendas', nombre: 'La cadena regional o la marca con maquila', cambia: ['Compradora, jefa de piso y jefa de catálogo; la corrida se decide seis meses antes', 'Lo importado llega en corrida cerrada y hay que repartirlo por tienda según lo que vende cada copa', '1,000 a 5,000 vendedoras con campañas nacionales y premios'], sistema: ['Reparto de corridas por tienda con IA: qué copa vende cada sucursal', 'Campaña con miles de pedidos y ganancia de la vendedora calculada sola', 'Finanzas por canal: piso, catálogo, WhatsApp y mayoreo, ya con la ganancia descontada'], dato: { valor: '2 a 3 semanas', rotulo: 'se voltea el centro de la pared; la orilla tarda meses' } },
  { n: '150 tiendas', nombre: 'La cadena nacional', cambia: ['Regiones con supervisoras; la misma regla de higiene y cambio en todas', 'La corrida se planea por grupo de tiendas: el norte con números grandes, el centro con copas medias', 'Catálogo y tienda física con inventarios separados y el mismo cliente'], sistema: ['Reposición por celda con mínimos y máximos por tienda', 'Auditoría de cambios rechazados por higiene y de mermas por sucursal', 'Qué copa vende cada colonia de México, en una pantalla'], dato: { valor: '1 ficha', rotulo: 'por clienta, con su número y copa, sin importar en qué tienda compró' } },
];

export const problemasLE = {
  doc1: {
    membrete: 'Sistema de ropa', sub: 'Reporte de inventario',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'EXIST.'],
    lineas: [
      { a: 'SKU-0288', b: 'BRASIER BASICO NEGRO', c: '24' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿número y copa?', '¿hay 34C?'],
    sello: 'NO VE<br />LA COPA',
    notas: [
      'Te pide <b>un solo código</b>. Tus 25 celdas de número y copa se vuelven esa fila.',
      'Para saber si queda 34C corres a la <b>pared</b> o abres un Excel que alguien mantiene a mano.',
      'Te dice cuánto vendiste, <b>no qué celda del centro se quedó vacía</b>.',
      'Abres la segunda tienda y empiezas de cero.',
    ],
  },
  doc2: {
    membrete: 'Desarrollo a la medida', sub: 'Propuesta · rev. 4',
    cab: ['CONCEPTO', 'PLAZO'],
    lineas: [
      { a: 'NÚMERO Y COPA', b: 'FASE 2' },
      { a: 'ENTREGA REAL', b: 'PASÓ DICIEMBRE', tachado: true },
      { a: 'CATÁLOGO DE AFILIADAS', b: 'NO' },
    ],
    margen: ['+ 3 adendas', 'y sin la pared'],
    sello: 'LLEGÓ<br />TARDE',
    notas: [
      'Costó <b>más de lo cotizado</b> y el número con copa quedó para la fase 2.',
      'Funciona… mientras <b>quien lo hizo conteste el teléfono</b>. Tu temporada es diciembre y mayo.',
      'Cada cambio chico —marcar una talla hermana— es <b>una cotización nueva</b>.',
      'No trae catálogo para las afiliadas ni la ganancia de cada vendedora. Eso, <b>en otra libreta</b>.',
    ],
  },
  filas: [
    { que: 'La talla como número y copa, no una letra', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'La talla hermana en la caja', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'La talla de la clienta en su ficha y el aviso cuando llega', generico: 'No existe', medida: 'Rara vez', sacs: 'Incluido' },
    { que: 'Vendedoras de catálogo con cartera y campaña', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Tripack que no se abre y regla de higiene en el ticket', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Tiempo para arrancar', generico: 'Días', medida: '4 a 9 meses', sacs: 'Días' },
    { que: 'Quién lo mantiene', generico: 'Su proveedor', medida: 'Tú, si lo encuentras', sacs: 'Nosotros, a diario' },
  ],
  entrada: 'Casi toda corsetería que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un sistema de ropa que ve “un brasier” donde hay 25 celdas de número y copa, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'las corseterías y marcas de lencería que ya la usan',
};

export const cifrasLE = {
  foto: `${IMG}/escala.webp`,
  alt: 'Bodega central de una cadena de lencería con las corridas en rack y el tablero de existencias por tienda',
  frase: 'Desde la corsetería del barrio hasta la cadena nacional con catálogo.',
  encuadre: 'center 45%',
};
