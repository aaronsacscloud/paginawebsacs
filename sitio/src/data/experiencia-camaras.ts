/**
 * /experiencia/camaras-con-ia — «Lo que tu clienta mira, en un mapa», la Experiencia 03 (3-oct-2026). EN CONSTRUCCIÓN.
 *
 * Pedido del dueño: tres experiencias nuevas para moda con las tarjetas de «Extiende tu Sacs › Hardware + IA»
 * (sacs3 src/views/sacs-plugins/sacs-plugins.html: «Cámaras con IA», «Conteo de personas con IA», «RFID · Inventario
 * automatizado»): el paso a paso, los beneficios, los problemas que resuelve, fotos de gpt-image-2.5 y el mismo diseño
 * que las experiencias 01 y 02.
 *
 * LO QUE EXISTE (revisado el 3-oct-2026 en sacs_api, sacs3 y SACSMobile): NADA de esto existe como software. No hay
 * integración de cámaras (RTSP/ONVIF ni ningún proveedor), ni mapa de calor del piso, ni permanencia, ni zonas: solo la
 * tarjeta de venta en la app, cuyo «Solicitar demo» abre WhatsApp. Los «mapas de calor» que sí hay en Sacs son otros
 * (cobertura de inventario en Nivelación, sesiones de la tienda en línea, ventas por día y hora).
 * Por eso la página entera va marcada «en construcción · así va a funcionar», sin fecha ni promesa, y todos los números
 * son de ejemplo. «Ya en Sacs» solo cuenta lo que existe: las ventas y los tickets por hora del tablero, y la venta por
 * producto, talla y tienda.
 * Fotos: gpt-image-2.5 (sunburst) — la planta vista desde el techo, la mesa de novedades, el aparador.
 */

export const OBRA_AVISO = 'En construcción · así va a funcionar';
export const OBRA_NOTA = 'En construcción: todavía no está disponible en Sacs y no le ponemos fecha. Los números de esta página son de ejemplo.';

export const CAMARAS = {
  folio: 'Experiencia 03',
  etiqueta: 'Cámaras con IA',
  titulo: 'Lo que tu clienta mira, en un mapa.',
  bajada: 'Las cámaras de tu tienda te van a decir qué mesas, maniquíes y racks atraen a tu clienta, cuánto tiempo se queda y qué mira sin comprar. Para acomodar tu tienda con datos, no a ojo.',
};

export const CAM_ANTES = {
  folio: ['Antes y después', 'El piso de tu tienda'] as [string, string],
  titulo: 'Hoy acomodas tu tienda a ojo.',
  antes: {
    k: 'A ojo',
    total: 'Lo que crees',
    pasos: [
      { d: 'Colección nueva', t: 'La pones donde crees que se ve.' },
      { d: 'Maniquíes', t: 'No sabes si alguien se detiene a verlos.' },
      { d: 'Pared del fondo', t: 'Nadie la visita y no te enteras.' },
      { d: 'Probadores', t: 'Te enteras de la fila cuando alguien se queja.' },
      { d: 'La caja', t: 'Ves lo que se vendió, no lo que pasó antes.' },
    ],
  },
  despues: {
    k: 'Con cámaras con IA',
    total: 'Lo que pasa',
    pasos: [
      { d: 'Mapa de calor', t: 'Qué zonas se llenan y a qué hora.' },
      { d: 'Permanencia', t: 'Cuánto se queda tu clienta en cada mesa y cada rack.' },
      { d: 'Zonas frías', t: 'Lo que nadie mira, para moverlo a donde sí.' },
    ],
  },
  nota: OBRA_NOTA,
};

/**
 * «Un día en tu tienda» (CamDia): el mapa de calor se arma con el scroll, de la apertura al cierre. Cada zona va en %
 * de la foto de planta (camaras-planta, 1536×1024) y su calor por tramo (0 = nada, 1 = lo más caliente).
 */
export type Zona = { id: string; x: number; y: number; r: number; calor: [number, number, number, number]; frio?: boolean };
export const CAM_ZONAS: Zona[] = [
  { id: 'mesa', x: 50, y: 48, r: 15, calor: [0.45, 1, 1, 1] },
  { id: 'entrada', x: 50, y: 88, r: 12, calor: [0.7, 0.6, 0.55, 0.6] },
  { id: 'amarilla', x: 17, y: 43, r: 10, calor: [0.2, 0.55, 0.6, 0.55] },
  { id: 'rackder', x: 92, y: 36, r: 11, calor: [0.15, 0.35, 0.65, 0.6] },
  { id: 'rackizq', x: 6, y: 42, r: 10, calor: [0, 0.3, 0.35, 0.35] },
  { id: 'caja', x: 48, y: 17, r: 10, calor: [0.1, 0.3, 0.6, 0.55] },
  { id: 'probadores', x: 80, y: 13, r: 13, calor: [0, 0.2, 0.95, 0.85] },
  { id: 'mezclilla', x: 24, y: 8, r: 11, calor: [0, 0.1, 0.12, 0.1], frio: true },
  { id: 'pedestal', x: 15, y: 64, r: 8, calor: [0, 0.08, 0.1, 0.1], frio: true },
];
export const CAM_DIA = {
  k: 'Un día en tu tienda · ejemplo',
  h: 'El mapa se arma solo.',
  tramos: [
    { hora: '11:00', t: 'Abre la tienda', d: 'Las primeras clientas entran y van directo a la mesa de novedades.', zona: 'Entrada', perm: '1:10' },
    { hora: '14:00', t: 'La mesa se prende', d: 'La colección de lino es lo más visto: ahí se quedan 2 minutos 40.', zona: 'Mesa de novedades', perm: '2:40' },
    { hora: '17:00', t: 'Los probadores se llenan', d: 'De 5 a 8 la espera en probadores llega a 6 minutos.', zona: 'Probadores', perm: '6:00' },
    { hora: '20:00', t: 'El mapa del día', d: 'Lo caliente, lo tibio y lo frío de tu piso. La pared de mezclilla casi nadie la visita.', zona: 'Mesa de novedades', perm: '2:40' },
  ],
  // las etiquetas del mapa del día (último tramo)
  etiquetas: [
    { t: 'Mesa de novedades', v: '2:40 min', x: 50, y: 33, tipo: 'caliente' },
    { t: 'Probadores', v: '6 min de espera', x: 80, y: 27, tipo: 'caliente' },
    { t: 'Pared de mezclilla', v: 'Zona fría', x: 24, y: 21, tipo: 'frio' },
  ],
};

// «Lo miran, pero no lo compran» (CamMiran): la atención contra la venta y el inventario de Sacs.
export const CAM_MIRAN = {
  k: 'Lo que la caja no ve · ejemplo',
  h: 'Lo miran, pero no lo compran.',
  p: 'La cámara dice cuánta gente se detiene y cuánto se queda. Sacs ya sabe qué se vendió, en qué talla y qué hay en piso. Juntos te dicen por qué.',
  filas: [
    { k: 'Se detienen', v: '1 de cada 3 que entran' },
    { k: 'Se quedan', v: '2 min 40 s' },
    { k: 'Compran', v: '4 de cada 100 que se detienen' },
  ],
  porque: 'En piso no hay M ni G del vestido de lino: se lo prueban con los ojos y se van.',
  accion: 'Surte la M y la G desde la bodega',
};

// «Mueve y mide» (CamMueve): un cambio de acomodo, antes y después (dos semanas, ejemplo).
export const CAM_MUEVE = {
  k: 'Mueve y mide · ejemplo',
  h: 'Cambias el acomodo y ves si funcionó.',
  antes: { t: 'La mezclilla, en la pared del fondo', v: '0:20', s: 'min de permanencia', n: '3 de cada 100 se acercan' },
  despues: { t: 'La mezclilla, junto a la entrada', v: '1:30', s: 'min de permanencia', n: '21 de cada 100 se acercan' },
  nota: 'Dos semanas con cada acomodo, mismas horas y mismos días.',
};

export const CAM_RESUELVE = {
  folio: ['Lo que resuelve', 'Para tu piso de venta'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'La colección nueva, en la mesa que nadie ve.',
    'El maniquí que se viste cada semana y nadie mira.',
    'La pared del fondo que nunca se visita.',
    'La fila del probador que espanta la venta.',
    'Lo que miran mucho y no se vende, sin saber por qué.',
  ],
};

export const CAM_HOY = {
  folio: ['Hoy y lo que viene', 'Cámaras con IA'] as [string, string],
  titulo: 'Lo que ya tienes y lo que falta.',
  hoy: [
    { t: 'Tus ventas y tickets por hora', d: 'En el tablero de Sacs, por hora, día, semana y mes.' },
    { t: 'Qué se vende, en qué talla y en qué tienda', d: 'Cada venta con su producto, su talla, su color y su sucursal.' },
  ],
  obra: [
    { t: 'El mapa de calor de tu piso', d: 'Qué zonas se llenan y a qué hora, con las cámaras de tu tienda.' },
    { t: 'La permanencia por zona', d: 'Cuánto se queda tu clienta en cada mesa, rack y probador.' },
    { t: 'Lo que miran contra lo que se vende', d: 'La atención de cada zona junto a su venta y su inventario en Sacs.' },
  ],
  nota: OBRA_NOTA,
};

export const PREGUNTAS_CAMARAS = [
  { question: '¿Ya lo puedo usar?', answer: 'Todavía no: está en construcción y no le ponemos fecha. Hoy, en el tablero de Sacs ya ves tus ventas y tickets por hora, y qué se vende en cada talla y en cada tienda. Si te interesa, cuéntanos cómo es tu tienda.' },
  { question: '¿Qué va a medir?', answer: 'Por zona de tu piso: cuánta gente pasa, cuánto tiempo se queda y a qué hora se llena, para armar el mapa de calor del día. Las zonas son las que tú definas: la mesa de novedades, cada rack, los maniquíes, los probadores.' },
  { question: '¿Va a reconocer caras?', answer: 'No es la idea: la experiencia está pensada para medir zonas y tiempos, no para saber quién es tu clienta.' },
  { question: '¿Qué tiene que ver con mi inventario?', answer: 'Sacs ya sabe qué vendes, en qué talla y qué hay en cada tienda. Cruzarlo con lo que tu clienta mira es lo que dice por qué algo muy visto no se vende: muchas veces, la talla no está en piso.' },
  { question: '¿Cuánto va a costar?', answer: 'Todavía no tiene precio, porque está en construcción. En la demo te contamos cómo va.' },
];
