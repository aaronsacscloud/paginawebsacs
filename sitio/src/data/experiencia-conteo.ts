/**
 * /experiencia/conteo-de-personas — «Cuántas entran y cuántas compran», la Experiencia 04 (3-oct-2026).
 *
 * Pedido del dueño: ver src/data/experiencia-camaras.ts (las tres tarjetas de «Hardware + IA» de la app).
 *
 * 3-oct-2026, el dueño: «quita eso que dice en construcción, todo ponlo como si ya lo tenemos» y «lo que está dentro,
 * todo ponlo ya disponible». La página presenta el conteo de personas como disponible, como la vende la app en «Extiende tu Sacs ›
 * Hardware + IA» («Equipo + instalación · Nosotros los instalamos y los dejamos funcionando»).
 * Para quien la toque: revisado el 3-oct-2026, en el código no hay sensor de entrada ni contadores de personas para
 * tiendas (los «visitantes» de Sacs son de parques y eventos y de la tienda en línea). Lo que sí existe y se nombra: las
 * ventas y tickets por hora del tablero y el Cuadrante de horarios (Empleados y asistencia). Números de ejemplo.
 * Fotos: gpt-image-2.5 (sunburst) — la entrada con el sensor, el sábado lleno.
 */

export const CONTEO = {
  folio: 'Experiencia 04',
  etiqueta: 'Conteo de personas con IA',
  titulo: 'Cuántas entran y cuántas compran.',
  bajada: 'Un sensor en tu entrada cuenta a cada persona que entra. Junto con tus ventas de Sacs, sabes tu conversión hora por hora, tus horas pico y cuánta gente necesitas en piso.',
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

export const PREGUNTAS_CONTEO = [
  { question: '¿Qué necesito?', answer: 'Un sensor en la entrada de cada tienda, conectado a tu Sacs. Nosotros lo instalamos y lo dejamos funcionando.' },
  { question: '¿Qué es la conversión?', answer: 'De cada 100 personas que entran, cuántas compran: tickets entre visitas. Es el número que dice si tu tienda vende bien la gente que ya trae.' },
  { question: '¿Para qué me sirve si ya veo mi venta?', answer: 'Tu venta junta dos cosas: cuánta gente entra y cuánta compra. Si baja, contando a quien entra sabes cuál de las dos fue, y qué arreglar: el aparador y tus campañas, o las tallas, los probadores y la atención.' },
  { question: '¿Identifica a las personas?', answer: 'No: cuenta entradas por hora, no quién entra.' },
  { question: '¿Y los turnos de mi equipo?', answer: 'Con tus horas pico a la vista, los armas en el Cuadrante de horarios de Sacs: más gente en piso cuando se llena tu tienda.' },
  { question: '¿Cuánto cuesta?', answer: 'Depende de cuántas tiendas y entradas tengas: el equipo y la instalación se cotizan contigo en la demo.' },
];
