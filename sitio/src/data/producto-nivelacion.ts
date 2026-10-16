/**
 * /producto/nivelacion-de-inventario («Nivelación entre tiendas», Controla) — rediseño con la línea de los plugins
 * (5-oct-2026), como las páginas de «Vende»: se queda el video de arriba y lo demás es nuevo, con entradas y animaciones
 * distintas entre secciones.
 *
 * LO QUE EXISTE (inventario del código de sacs3, sacs_api y SACSMobile, 5-oct-2026) y es lo que la página cuenta:
 *  - La corrida de cada madrugada (pg_cron, hora de la CDMX): el cubo de venta y existencia a las 2:10 y a las 3:10; el
 *    tablero a las 3:40, con hasta 6 tarjetas «NUEVO HOY» y lo demás en «Puede esperar»; la campana «Tu tablero de hoy
 *    está listo» y, si el dueño lo activa, el resumen por correo.
 *  - El cálculo: venta diaria limpia (sin devoluciones, corrige los días sin existencia, recorta los picos raros),
 *    colchón por nivel de servicio según la clase ABC, posición = existencia − apartados + en camino. Si el CEDIS no
 *    alcanza, reparte justo según lo que le falta a cada tienda y redondea al empaque. Lo que mueve menos de $100 no se
 *    mueve («Faltante marginal (no paga el flete)»).
 *  - Moda: el CEDIS reparte con peso por nivel de tienda (A=3, B=2, C=1); curvas por red, por grupo de tiendas («vende
 *    chico / curva media / vende grande») y por tienda; talla núcleo; «Curva completa o nada»; la talla sin venta propia
 *    en una tienda se estima con la curva de la tienda (y la Mesa lo dice).
 *  - Tablero: «El plan — mueve solo lo que el destino puede vender» y «Crear N traspaso(s) seguros». La Mesa de moda:
 *    «Aprobar lo seguro · N de M modelos», «Talla × tienda», «¿Por qué?» y «Un traspaso por tienda, con su lista de
 *    surtido por modelo › color › talla. Nada sale hasta que lo envíen.» Cada folio se califica solo en el tablero
 *    («Tus últimas acciones»).
 *  - Al ejecutar: traspasos «Por enviar» (uno por origen → destino) y la compra en borrador. SACSMobile recibe el
 *    traspaso: «Recibir solo lo que ingresé» (recomendado), «Recibir completa», «Recibir parcial», «Recibir incompleta».
 *  - 22 reglas, cada una «Automático / Te pregunta / Apagada» (Compra, Reparto, Resurtido y traspasos, Promociones,
 *    Eventos): «Reserva en el CEDIS» (40 %), «Presentación primero», «La primera ola no sale sola», «Traspaso solo desde
 *    sobrante real» (7 días), «Ignora faltantes chicos», «Curva completa o nada», «Corrida diaria automática» (4 horas
 *    para objetar). Opcional y apagado de fábrica: que lo seguro salga solo de noche, con un tope en pesos.
 *  - Visión: nada. Todo lo de esta página está en el código (el resumen por WhatsApp NO se manda: no se menciona).
 * Pantallas: recortes REALES de Demand Planning con la red de prueba «Polanco Boutique» (cuenta andyaraujoconsultorias,
 * 2-oct-2026): las mismas, ya revisadas, de /planeacion-de-demanda (public/images/planeacion/sacs/), sin nada de MAJA
 * (es un prospecto: ni su red ni renombrada). Los dibujos (la noche, la curva, el reparto, el traspaso y SACSMobile)
 * llevan los textos reales y números de la boutique de prueba o de ejemplo, marcados «Ejemplo». Las capturas viejas de
 * esta página (nivelaciones.webp, reglas.webp, tablero.webp) traían a MAJA renombrada: ya no se usan aquí.
 * Fotos: gpt-image-2.5 (madrugada, caja, recibe, tiendas).
 */

export const I = '/images/producto/nivelacion-de-inventario/';

export interface Pieza { id: string; t: string; d: string; img?: string; w?: number; h?: number; tono: 'negro' | 'fucsia' | 'marfil' | 'marino' | 'azul'; ancha?: boolean; alta?: boolean; cubre?: boolean; dibujo?: 'madrugada' | 'curva' | 'traspaso' }

// 12 casillas en la rejilla de escritorio (4 columnas): dos anchas, una alta y seis sencillas.
export const INCLUYE: { folio: [string, string]; titulo: string; intro: string; piezas: Pieza[] } = {
  folio: ['01', 'Todo lo que incluye'],
  titulo: 'Tu analista, cada noche.',
  intro: 'Revisa cada talla en cada tienda y en el CEDIS, te deja el tablero listo antes de que abras y arma los traspasos que tú apruebas.',
  piezas: [
    { id: 'nv-noche', t: 'Cada madrugada, un tablero nuevo', d: 'A las 3:40 ya está: lo nuevo de hoy arriba y lo demás en «Puede esperar».', dibujo: 'madrugada', tono: 'marino', ancha: true },
    { id: 'nv-talla', t: 'Te dice por qué', d: 'Cada movimiento trae su razón, en palabras.', img: `${I}inc-porque.webp`, w: 550, h: 238, tono: 'marfil' },
    { id: 'nv-talla', t: 'Talla por talla, tienda por tienda', d: 'Lo que hay, lo que llega y de dónde, y lo que vende cada semana.', img: `${I}inc-talla.webp`, w: 682, h: 630, tono: 'azul', alta: true },
    { id: 'nv-curva', t: 'Curva completa o nada', d: 'No manda tallas sueltas que dejen la curva rota.', dibujo: 'curva', tono: 'fucsia' },
    { id: 'nv-cedis', t: 'El CEDIS reparte por tienda', d: 'Con peso por nivel A, B y C, y una reserva para resurtir.', img: `${I}tiendas-900.webp`, w: 900, h: 600, cubre: true, tono: 'negro' },
    { id: 'nv-mesa', t: 'Lo seguro, de un clic', d: 'Lo que no tiene duda se aprueba junto; lo raro se revisa en la Mesa.', img: `${I}inc-mesa.webp`, w: 700, h: 460, tono: 'marfil', ancha: true },
    { id: 'nv-traspaso', t: 'Un traspaso por tienda', d: 'Con su lista de surtido por modelo › color › talla.', dibujo: 'traspaso', tono: 'marino' },
    { id: 'nv-traspaso', t: 'Se recibe con el celular', d: 'En SACSMobile: completo, parcial o incompleto.', img: `${I}recibe-900.webp`, w: 900, h: 600, cubre: true, tono: 'negro' },
    { id: 'nv-reglas', t: 'Tú pones las reglas', d: 'Cada una: automática, te pregunta o apagada.', img: `${I}inc-reglas.webp`, w: 700, h: 270, tono: 'fucsia' },
  ],
};

// «Mientras duermes», con el scroll (data-tramos="6"): de la corrida de las 2:10 a la tienda que recibe. Las horas de
// la corrida son las reales (2:10 y 3:10 el cubo, 3:40 el tablero); las de la mañana son las de un día cualquiera. Los
// números son los de la «Nivelación Buen Fin · toda la red» de la boutique de prueba (Botín de piel con tacón, Negro).
export const NOCHE = {
  k: 'Mientras duermes',
  h: 'De las 2:10 a las 8:00.',
  tramos: [
    { hora: '2:10', sufijo: 'a. m.', t: 'Junta todo', d: 'La venta y la existencia de cada talla en cada tienda y en el CEDIS, lo apartado y lo que viene en camino. A las 3:10 vuelve a pasar.', foto: '' },
    { hora: '3:40', sufijo: 'a. m.', t: 'Tu tablero de hoy está listo', d: 'Arriba, lo nuevo de hoy: hasta seis tarjetas. Lo demás, en «Puede esperar». Te avisa en la campana y, si quieres, por correo.', foto: '' },
    { hora: '7:00', sufijo: 'a. m.', t: '¿Por qué?', d: 'Cada tarjeta se explica sola: qué tienda lo vende, cuánto por semana y de dónde sale la mercancía.', foto: 'madrugada' },
    { hora: '7:10', sufijo: 'a. m.', t: 'El plan', d: 'Mueve solo lo que el destino puede vender, y solo de donde de verdad sobra. Lo que no paga el flete, no se mueve.', foto: 'madrugada' },
    { hora: '8:00', sufijo: 'a. m.', t: 'Un traspaso por tienda', d: 'Apruebas y salen los traspasos «Por enviar», cada uno con su lista de surtido por modelo › color › talla. Nada sale hasta que lo envíen.', foto: 'caja' },
    { hora: 'Al llegar', sufijo: '', t: 'Se recibe con el celular', d: 'La tienda lo recibe en SACSMobile, completo, parcial o incompleto, y la existencia entra sola.', foto: 'recibe' },
  ],
  // el cubo: tiendas × tallas (existencia de hoy del Botín de piel con tacón · Negro; en rojo, la talla núcleo en 0)
  tallas: ['23', '24', '25', '26', '27'],
  tiendas: [
    { t: 'Polanco Boutique', n: 'A', v: [6, 14, 12, 8, 5] },
    { t: 'Querétaro Antea', n: 'B', v: [3, 5, 8, 7, 4] },
    { t: 'León Altacia', n: 'C', v: [2, 0, 5, 5, 4] },
    { t: 'SMA Centro', n: 'B', v: [4, 8, 9, 6, 4] },
    { t: 'CEDIS', n: '', v: [22, 39, 48, 37, 24] },
  ],
  tablero: [
    { t: 'Falta la 24 en León Altacia', d: 'Botín de piel con tacón · Negro. La vende cada semana y tiene 0.' },
    { t: '14 curvas rotas', d: 'Nivelación Buen Fin: esta nivelación las deja en 0.' },
    { t: 'Sobra la 27 en SMA Centro', d: '4 piezas que no se venden ahí.' },
  ],
  porque: 'León Altacia vende 0.4 de la 24 por semana en Negro y tiene 0: le llegan 4 de CEDIS (CEDIS tiene 39).',
  plan: [
    { t: 'Polanco Boutique', n: 17 },
    { t: 'Querétaro Antea', n: 14 },
    { t: 'León Altacia', n: 26 },
    { t: 'SMA Centro', n: 9 },
  ],
  quitado: 'Quité 1 traspaso entre tiendas que no se pagaba.',
  // lo que le llega a León Altacia de este modelo (Talla × tienda)
  surtido: [['23', 2], ['24', 4], ['25', 11], ['26', 8], ['27', 1]] as [string, number][],
};

// La Mesa: la lista de nivelaciones y la Mesa de «Nivelación Buen Fin · toda la red», reales.
export const MESA = {
  k: '03',
  h: 'Lo seguro, de un clic. Lo raro, a tu mesa.',
  p: 'Cada nivelación llega a la Mesa con sus modelos, sus curvas y lo que cuesta. Lo que no tiene duda se aprueba junto; lo que sí, se revisa talla por talla. Nada se mueve sin que tú lo decidas.',
  cifras: [
    { n: 10, t: 'modelos' },
    { n: 1074, t: 'piezas' },
    { n: 850950, t: 'a costo', pesos: true },
  ],
  curvas: { de: 14, a: 0 },
  chips: ['Solo lo que hay que revisar', 'Por categoría, proveedor, temporada o grupo de tiendas', 'Confianza alta, media o baja', 'Aprueba o quita cada color'],
};

// Talla × tienda, con sus marcas sobre la pantalla real (x, y en % de pantalla-talla.webp, 1440 × 1110).
export const TALLA = {
  k: '04',
  h: 'Talla por talla, tienda por tienda.',
  p: 'Abre un modelo y ves cada talla en cada tienda: lo que hay hoy, lo que le llega y de dónde, y lo que vende por semana. Las tiendas van por grupo y abajo, en palabras, por qué.',
  marcas: [
    { x: 22.4, y: 38.5, t: 'Por grupo de tiendas', d: 'Las que venden chico, las que venden grande y las de curva media.' },
    { x: 39.8, y: 40.4, t: 'Lo que llega y de dónde', d: 'En rosa: +14 del CEDIS y 1 por pedir al proveedor.' },
    { x: 66.8, y: 53.4, t: 'Lo que vende por semana', d: 'Cada talla, en cada tienda, con su venta real.' },
    { x: 60.0, y: 55.5, t: 'Falta una talla núcleo', d: 'En rojo: León Altacia vende la 24 y tiene 0.' },
    { x: 84.3, y: 64.1, t: 'Lo que sobra', d: 'En ámbar: tiene 4 o más sin venta, o sale a otra tienda.' },
    { x: 30.5, y: 75.9, t: '¿Por qué?', d: 'Cada movimiento, explicado en palabras.' },
    { x: 76.0, y: 75.6, t: 'Un traspaso por tienda', d: 'Lo que se crea al aprobar: los traspasos y la compra en borrador.' },
  ],
};

// «Curva completa o nada»: las curvas de los tres grupos de tiendas (dibujo de ejemplo) y el recorte real de la Mesa.
export const CURVA = {
  k: '05',
  h: 'Curva completa o nada.',
  p: 'En moda, una tienda sin su talla núcleo deja de vender el modelo aunque le queden diez piezas. Sacs conoce la curva de cada grupo de tiendas, primero completa la talla núcleo de cada una y no manda tallas sueltas que dejen la curva rota. Si una talla todavía no tiene venta propia en esa tienda, la estima con su curva y te lo dice.',
  tallas: ['XS', 'S', 'M', 'L', 'XL'],
  grupos: [
    { t: 'Vende chico', tienda: 'Polanco Boutique', curva: [62, 100, 74, 38, 16], hay: [3, 6, 5, 2, 1], falta: -1 },
    { t: 'Curva media', tienda: 'SMA Centro', curva: [22, 62, 100, 66, 26], hay: [1, 4, 0, 4, 2], falta: 2 },
    { t: 'Vende grande', tienda: 'León Altacia', curva: [12, 34, 70, 100, 64], hay: [1, 2, 4, 0, 3], falta: 3 },
  ],
  llega: 4,
  rotas: { de: 14, a: 0 },
};

// El reparto del CEDIS por nivel de tienda (dibujo de ejemplo: 40 piezas, 40 % de reserva, pesos A=3, B=2, C=1).
export const CEDIS = {
  k: '06',
  h: 'El CEDIS reparte según cada tienda.',
  p: 'Lo nuevo sale del CEDIS con peso por nivel de tienda —una A pesa 3, una B 2 y una C 1—, primero la presentación y luego la profundidad. Una parte se queda en el CEDIS para resurtir donde sí se venda. Y si no alcanza para todas, reparte justo según lo que le falta a cada una y redondea al empaque.',
  total: 40,
  reserva: 16,
  tiendas: [
    { t: 'Polanco Boutique', n: 'A', p: 9 },
    { t: 'Querétaro Antea', n: 'B', p: 6 },
    { t: 'SMA Centro', n: 'B', p: 6 },
    { t: 'León Altacia', n: 'C', p: 3 },
  ],
  reglas: [
    { t: 'Presentación primero', d: 'Cada tienda recibe su talla núcleo completa antes que profundidad.' },
    { t: 'Reserva en el CEDIS', d: 'Lo que se queda para resurtir donde sí se venda.', v: '40 %' },
    { t: 'La primera ola no sale sola', d: 'El primer reparto de cada temporada espera tu visto bueno.' },
    { t: 'Faltante marginal', d: 'Si mover no paga el flete, no se mueve.' },
  ],
};

// Un traspaso por tienda y la recepción en SACSMobile (textos reales de la app; folio y piezas de ejemplo).
export const TRASPASO = {
  k: '07',
  h: 'Un traspaso por tienda. Se recibe con el celular.',
  p: 'Al aprobar, Sacs arma un traspaso por cada tienda, con su lista de surtido por modelo › color › talla. Nada sale hasta que lo envíen. Del otro lado, la tienda lo recibe con SACSMobile y la existencia entra sola.',
  estados: ['Por enviar', 'Enviada', 'Recibida completa'],
  opciones: [
    { t: 'Recibir solo lo que ingresé', d: 'Recomendado — el inventario queda cuadrado' },
    { t: 'Recibir completa', d: 'Da por recibido todo lo enviado' },
    { t: 'Recibir parcial', d: 'Queda abierta para capturar el resto luego' },
    { t: 'Recibir incompleta', d: 'Se cierra con descuadre' },
  ],
  califica: 'Y cada folio se califica solo: en tu tablero ves si lo que moviste se vendió.',
};

// El gestor de reglas: cuatro reglas reales de «Resurtido y traspasos» y «Reparto», con su estado cambiando solo.
export const REGLAS = {
  k: '08',
  h: 'Tú pones las reglas. Sacs las cumple cada noche.',
  p: 'Cada regla dice qué hace en una línea. Ajusta su número y elige si Sacs la aplica solo, si te pregunta antes o si se queda apagada.',
  estados: ['Automático', 'Te pregunta', 'Apagada'],
  reglas: [
    { t: 'Traspaso solo desde sobrante real', d: 'Solo saca de una tienda lo que le sobra para más de estos días.', v: '7', u: 'días', e: 1 },
    { t: 'Ignora faltantes chicos', d: 'Un envío de menos de estas piezas no sale.', v: '2', u: 'piezas', e: 2 },
    { t: 'Reserva en el CEDIS', d: 'Lo que se queda en el CEDIS para resurtir donde sí se venda.', v: '40', u: '%', e: 1 },
    { t: 'Corrida diaria automática', d: 'Cada madrugada ejecuta lo aprobado y espera este tiempo por si quieres frenarla.', v: '4', u: 'horas para objetar', e: 2 },
  ],
  auto: '¿Quieres que lo seguro salga solo? Actívalo con un tope en pesos. Viene apagado.',
};

// Lo que sigue: Demand Planning (reglas → forecasting → temporadas), en /planeacion-de-demanda.
export const PLANEACION = {
  k: '09',
  h: 'La nivelación es el día a día. Demand Planning, la temporada entera.',
  p: 'Antes de que empiece la temporada: tus reglas, el pronóstico por tienda y talla, y cada temporada con su calendario. La nivelación se encarga de lo que pasa todos los días.',
  pasos: [
    { n: '1', t: 'Gestor de reglas', d: 'Qué se compra, cómo se reparte y cuándo se rebaja.' },
    { n: '2', t: 'Forecasting', d: 'Cuánto se va a vender, por tienda y talla.' },
    { n: '3', t: 'Temporadas', d: 'De la pretemporada al resultado: ¿le atinamos?' },
  ],
  liga: '/planeacion-de-demanda',
};

export const RESUELVE = {
  folio: ['Lo que resuelve', 'Entre tus tiendas'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'La talla que sobra en una tienda mientras otra la pide.',
    'La curva rota que deja de vender el modelo completo.',
    'El traspaso que nadie armó porque nadie lo vio a tiempo.',
    'Mandar mercancía a la tienda que no la va a vender.',
    'El lunes entero en Excel para decidir qué mover.',
  ],
};

export const PREGUNTAS = [
  { question: '¿Cada cuándo revisa Sacs mis tiendas?', answer: 'Cada madrugada. A las 2:10 junta la venta y la existencia de cada talla en cada tienda y en el CEDIS (y vuelve a pasar a las 3:10), y a las 3:40 deja listo tu tablero, con lo nuevo de hoy arriba. Te avisa en la campana de Sacs y, si quieres, por correo.' },
  { question: '¿Se mueve mercancía sin que yo lo apruebe?', answer: 'No. De fábrica nada se mueve sin tu visto bueno: apruebas en la Mesa y Sacs crea los traspasos «Por enviar». Si quieres, activas que lo seguro salga solo cada noche, con un tope en pesos y unas horas para objetar.' },
  { question: '¿Cómo decide qué mover?', answer: 'Con la venta real de cada talla en cada tienda, limpia: sin devoluciones, corrigiendo los días en que no había existencia y sin picos raros. Descuenta lo apartado y suma lo que ya viene en camino. Solo mueve lo que el destino puede vender, de donde de verdad sobra, y si el faltante no paga el flete, no lo mueve.' },
  { question: '¿Respeta las tallas y las curvas?', answer: 'Sí. Conoce la curva de cada grupo de tiendas (las que venden chico, las de curva media, las que venden grande), completa primero la talla núcleo de cada tienda y no manda tallas sueltas que dejen la curva rota.' },
  { question: '¿Qué pasa si el CEDIS no alcanza para todas las tiendas?', answer: 'Reparte justo según lo que le falta a cada una y el nivel de cada tienda (A, B o C), redondea al empaque y, si así lo pones, deja una reserva en el CEDIS para resurtir donde sí se venda.' },
  { question: '¿Cómo recibe la tienda el traspaso?', answer: 'Con SACSMobile, en el celular: lo recibe completo, parcial (queda abierto para capturar el resto después) o incompleto, y la existencia entra sola. Lo recomendado es recibir solo lo que se ingresó, para que el inventario quede cuadrado.' },
  { question: '¿Sirve si no vendo ropa?', answer: 'Sí. La nivelación trabaja por artículo y sucursal para cualquier giro. Las tallas, las curvas y los grupos de tiendas se suman con la Suite de Moda.' },
  { question: '¿Qué tiene que ver con Demand Planning?', answer: 'La nivelación es el día a día: qué mover hoy entre tus tiendas. Demand Planning suma la temporada completa: tus reglas, el pronóstico por tienda y talla, y cada temporada de la pretemporada al resultado.' },
];
