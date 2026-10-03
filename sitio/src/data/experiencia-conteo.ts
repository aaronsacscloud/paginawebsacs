/**
 * /experiencia/conteo-de-personas — «Cuántas entran y cuántas compran», la Experiencia 04 (3-oct-2026). EN CONSTRUCCIÓN.
 *
 * Pedido del dueño: ver src/data/experiencia-camaras.ts (las tres tarjetas de «Hardware + IA» de la app).
 *
 * LO QUE EXISTE (revisado el 3-oct-2026): no hay sensor de entrada, ni integración de contadores de personas, ni un
 * endpoint que reciba conteos, ni conversión de tienda (tickets ÷ visitantes). Los «visitantes» que hay en Sacs son de
 * parques y eventos (boletos de taquilla, aforo) y de la tienda en línea. Por eso la página entera va marcada
 * «en construcción · así va a funcionar», sin fecha ni promesa, y los números son de ejemplo.
 * «Ya en Sacs»: las ventas y los tickets por hora del tablero (Hora · Día · Semana · Mes) y el Cuadrante de horarios
 * de tu equipo (Empleados y asistencia).
 * Fotos: gpt-image-2.5 (sunburst) — la entrada con el sensor, el sábado lleno.
 */
export { OBRA_AVISO, OBRA_NOTA } from './experiencia-camaras';
import { OBRA_NOTA } from './experiencia-camaras';

export const CONTEO = {
  folio: 'Experiencia 04',
  etiqueta: 'Conteo de personas con IA',
  titulo: 'Cuántas entran y cuántas compran.',
  bajada: 'Un sensor en tu entrada va a contar a cada persona que entra. Junto con tus ventas de Sacs, sabrás tu conversión hora por hora, tus horas pico y cuánta gente necesitas en piso.',
};

// «Bajó la venta. ¿Por qué?» (ConCausa): la misma caída en la caja, dos causas que solo el conteo separa.
export const CON_CAUSA = {
  folio: ['El problema', 'Lo que la caja no te dice'] as [string, string],
  h: 'Bajó la venta. ¿Por qué?',
  p: 'En tu caja las dos semanas se ven igual: 20 % menos. Contando a quien entra, son dos problemas distintos.',
  casos: [
    { k: 'Caso A', t: 'Entró menos gente', visitas: [100, 80], tickets: [100, 80], conv: ['23 %', '23 %'], que: 'Es tráfico.', haz: 'Revisa el aparador, tus campañas y la calle.' },
    { k: 'Caso B', t: 'Entró la misma gente y compró menos', visitas: [100, 100], tickets: [100, 80], conv: ['23 %', '18 %'], que: 'Es la tienda.', haz: 'Revisa tallas en piso, probadores y atención.' },
  ],
};

/**
 * «Tu sábado, hora por hora» (ConDia): visitantes y tickets por hora de 10 a 21 (ejemplo cuadrado: 1,284 visitantes,
 * 295 tickets = 23 %). La hora de 18 a 19 es el pico: 214 personas y la conversión cae a 15 % con dos vendedoras.
 */
export const HORAS = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
export const VISITAS = [38, 58, 74, 92, 110, 120, 128, 168, 214, 172, 110];
export const TICKETS = [8, 13, 17, 21, 26, 29, 31, 41, 32, 43, 34];
export const CON_DIA = {
  k: 'Tu sábado · ejemplo',
  h: 'Hora por hora.',
  // hasta qué hora va cada tramo (índice exclusivo en HORAS) y lo que se dice
  tramos: [
    { hasta: 2, hora: '12:00', t: 'Abre la tienda', d: 'Entraron 96 personas y 21 compraron: 22 %.' },
    { hasta: 5, hora: '15:00', t: 'La tarde', d: 'Van 372 visitas y 85 tickets: la conversión se sostiene en 23 %.' },
    { hasta: 9, hora: '19:00', t: 'La hora pico', d: 'De 6 a 7 entraron 214 personas y solo 32 compraron: 15 %. Había dos vendedoras para todo el piso.' },
    { hasta: 11, hora: '21:00', t: 'El cierre', d: '1,284 visitas y 295 tickets: 23 % del día. Sin la caída de las 6, habrían sido más.' },
  ],
};

// «Tus horas pico» (ConSemana): lunes a domingo × 10 a 21, en 0–4 (de tranquilo a lleno). Ejemplo.
export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const SEMANA = [
  [0, 0, 1, 1, 1, 1, 1, 1, 2, 1, 1],
  [0, 0, 1, 1, 1, 1, 1, 1, 2, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1],
  [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1],
  [1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 2],
  [1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 3],
  [1, 2, 3, 4, 4, 4, 3, 3, 2, 2, 1],
];
export const CON_SEMANA = {
  folio: ['Horas pico', 'Tu equipo en piso'] as [string, string],
  h: 'Tu gente, en las horas que llegan.',
  p: 'Con las visitas de cada hora sabes cuándo se llena tu tienda: ahí es donde una vendedora más hace la venta.',
  picos: [
    { t: 'Sábado de 5 a 8', d: 'La hora más llena de tu semana: pon una persona más en piso.' },
    { t: 'Domingo de 1 a 4', d: 'Familias y paseo: refuerza probadores y caja.' },
    { t: 'Lunes y martes temprano', d: 'Tranquilo: el mejor momento para acomodar y recibir mercancía.' },
  ],
  hoy: 'Los turnos ya se arman en el Cuadrante de horarios de Sacs.',
};

// «Tus tiendas, comparadas» (ConTiendas): la conversión ordena distinto que la venta. Ejemplo.
export const CON_TIENDAS = {
  folio: ['Tus tiendas', 'Comparadas por conversión'] as [string, string],
  h: 'La que más vende no es la que mejor vende.',
  tiendas: [
    { n: 'Tienda Norte', visitas: 1410, tickets: 169 },
    { n: 'Tienda Centro', visitas: 1284, tickets: 295 },
    { n: 'Tienda Sur', visitas: 980, tickets: 274 },
  ],
  nota: 'La Norte recibe más gente que ninguna y convierte la mitad que la Centro: ahí está la venta que se va.',
};

export const CON_RESUELVE = {
  folio: ['Lo que resuelve', 'Para tus tiendas'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'Que baje la venta y no sepas si fue la gente o la tienda.',
    'Dos vendedoras para el sábado a las 6 y cuatro el martes a las 11.',
    'Pagar un aparador nuevo sin saber si trajo más gente.',
    'Comparar tiendas solo por lo que venden.',
  ],
};

export const CON_HOY = {
  folio: ['Hoy y lo que viene', 'Conteo de personas con IA'] as [string, string],
  titulo: 'Lo que ya tienes y lo que falta.',
  hoy: [
    { t: 'Tus ventas y tickets por hora', d: 'En el tablero de Sacs, por hora, día, semana y mes.' },
    { t: 'El Cuadrante de horarios', d: 'Los turnos de tu equipo, día por día (Empleados y asistencia).' },
  ],
  obra: [
    { t: 'El sensor de la entrada', d: 'Cuenta a cada persona que entra a tu tienda.' },
    { t: 'Visitantes por hora y conversión', d: 'Las visitas junto a tus tickets de Sacs: cuántas entran y cuántas compran.' },
    { t: 'Horas pico y tiendas comparadas', d: 'Cuándo se llena cada tienda y cuál convierte mejor.' },
  ],
  nota: OBRA_NOTA,
};

export const PREGUNTAS_CONTEO = [
  { question: '¿Ya lo puedo usar?', answer: 'Todavía no: está en construcción y no le ponemos fecha. Hoy, en el tablero de Sacs ya ves tus ventas y tickets por hora, y armas los turnos de tu equipo en el Cuadrante de horarios. Si te interesa, cuéntanos cómo es tu tienda.' },
  { question: '¿Qué es la conversión?', answer: 'De cada 100 personas que entran, cuántas compran: tickets entre visitas. Es el número que dice si tu tienda vende bien la gente que ya trae.' },
  { question: '¿Para qué me sirve si ya veo mi venta?', answer: 'Tu venta junta dos cosas: cuánta gente entra y cuánta compra. Si baja, contando a quien entra sabes cuál de las dos fue, y qué arreglar: el aparador y tus campañas, o las tallas, los probadores y la atención.' },
  { question: '¿Va a identificar a las personas?', answer: 'No es la idea: la experiencia está pensada para contar entradas por hora, no para saber quién entra.' },
  { question: '¿Cuánto va a costar?', answer: 'Todavía no tiene precio, porque está en construcción. En la demo te contamos cómo va.' },
];
