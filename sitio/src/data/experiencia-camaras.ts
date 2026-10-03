/**
 * /experiencia/camaras-con-ia — «Lo que tu clienta mira, en un mapa», la Experiencia 03 (3-oct-2026).
 *
 * Pedido del dueño: tres experiencias nuevas para moda con las tarjetas de «Extiende tu Sacs › Hardware + IA»
 * (sacs3 src/views/sacs-plugins/sacs-plugins.html: «Cámaras con IA», «Conteo de personas con IA», «RFID · Inventario
 * automatizado»): el paso a paso, los beneficios, los problemas que resuelve, fotos de gpt-image-2.5 y el mismo diseño
 * que las experiencias 01 y 02.
 *
 * 3-oct-2026, el dueño: «quita eso que dice en construcción, todo ponlo como si ya lo tenemos» y «lo que está dentro,
 * todo ponlo ya disponible». La página presenta la experiencia como disponible, como la vende la app en «Extiende tu Sacs ›
 * Hardware + IA» («Equipo + instalación · Nosotros los instalamos y los dejamos funcionando»).
 * Para quien la toque: revisado el 3-oct-2026, en el código de Sacs (sacs_api, sacs3, SACSMobile) no hay integración
 * de cámaras, ni mapa de calor del piso, ni permanencia por zona; la tarjeta de la app abre WhatsApp. Los números son de
 * ejemplo (su pastilla «Ejemplo» se queda).
 * Fotos: gpt-image-2.5 (sunburst) — la planta vista desde el techo, la mesa de novedades, el aparador.
 */

export const CAMARAS = {
  folio: 'Experiencia 03',
  etiqueta: 'Cámaras con IA',
  titulo: 'Lo que tu clienta mira, en un mapa.',
  bajada: 'Las cámaras de tu tienda te dicen qué mesas, maniquíes y racks atraen a tu clienta, cuánto tiempo se queda y qué mira sin comprar. Para acomodar tu tienda con datos, no a ojo.',
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

export const PREGUNTAS_CAMARAS = [
  { question: '¿Qué necesito?', answer: 'Cámaras en tu piso de venta, conectadas a tu Sacs. Nosotros las instalamos y las dejamos funcionando; tú defines las zonas: la mesa de novedades, cada rack, los maniquíes, los probadores.' },
  { question: '¿Qué mide?', answer: 'Por zona de tu piso: cuánta gente pasa, cuánto tiempo se queda y a qué hora se llena, para armar el mapa de calor del día.' },
  { question: '¿Reconoce caras?', answer: 'No: mide zonas y tiempos, no quién es tu clienta.' },
  { question: '¿Qué tiene que ver con mi inventario?', answer: 'Sacs sabe qué vendes, en qué talla y qué hay en cada tienda. Cruzarlo con lo que tu clienta mira dice por qué algo muy visto no se vende: muchas veces, la talla no está en piso.' },
  { question: '¿Cuánto cuesta?', answer: 'Depende de tu tienda: el equipo y la instalación se cotizan contigo en la demo.' },
];
