/**
 * /experiencia/rfid — «Toda tu tienda, contada en minutos», la Experiencia 05 (3-oct-2026).
 *
 * Pedido del dueño: ver src/data/experiencia-camaras.ts (las tres tarjetas de «Hardware + IA» de la app).
 *
 * 3-oct-2026, el dueño: «quita eso que dice en construcción, todo ponlo como si ya lo tenemos» y «lo que está dentro,
 * todo ponlo ya disponible». La página presenta RFID como disponible, como la vende la app en «Extiende tu Sacs ›
 * Hardware + IA» («Equipo + instalación · Nosotros los instalamos y los dejamos funcionando»).
 * Para quien la toque: revisado el 3-oct-2026, en el código no hay RFID (ni lectores, ni EPC, ni antenas; las
 * etiquetas de Sacs son de código de barras). Lo que sí existe y se nombra en preguntas: el conteo físico — completo,
 * parcial, sorpresa o ciego, con el celular o un lector Bluetooth, o dictado a AXO. Números de ejemplo.
 * Fotos: gpt-image-2.5 (sunburst) — el lector en el rack, la etiqueta, la puerta, la bodega.
 */

export const RFID = {
  folio: 'Experiencia 05',
  etiqueta: 'RFID · Inventario automatizado',
  titulo: 'Toda tu tienda, contada en minutos.',
  bajada: 'Con una etiqueta RFID en cada prenda, el lector cuenta un rack completo de una pasada, sin escanear pieza por pieza. Sabes qué falta, dónde está cada talla y la puerta avisa si sale algo sin pagar.',
};

export const RFID_ANTES = {
  folio: ['Antes y después', 'El inventario'] as [string, string],
  titulo: 'Un inventario ya no cierra tu tienda.',
  antes: {
    k: 'Así es hoy',
    total: 'Un día, con la tienda cerrada',
    pasos: [
      { d: 'Antes de abrir', t: 'Cerrar la tienda o contar de noche.' },
      { d: 'Pieza por pieza', t: 'Escanear cada prenda, talla por talla.' },
      { d: 'Lo que no cuadra', t: 'Volver a contarlo.' },
      { d: 'Las diferencias', t: 'Capturarlas a mano.' },
    ],
  },
  despues: {
    k: 'Con RFID',
    total: 'Minutos, con la tienda abierta',
    pasos: [
      { d: 'Una pasada', t: 'El lector lee el rack completo, sin sacar prenda por prenda.' },
      { d: 'Las diferencias', t: 'Salen solas contra tu inventario de Sacs.' },
      { d: 'Cada pieza', t: 'Sabes en qué rack o en qué caja está.' },
    ],
  },
};

/**
 * «Una pasada por el rack» (RfidPasada): lo que dice la pantalla del lector, un paso por tramo. Ejemplo cuadrado:
 * el vestido midi de lino mandarina — Sacs dice CH 2 · M 3 · G 3; el lector lee CH 2 · M 1 · G 3; las 2 M están en la
 * bodega, caja 14.
 */
export const RFID_PASADA = {
  k: 'Una pasada · ejemplo',
  h: 'El lector cuenta. Tú caminas.',
  total: 1248,
  segundos: 42,
  pasos: [
    { n: '01', t: 'Una pasada por el rack', d: 'El lector lee todas las etiquetas a su alcance, a la vez y sin verlas: 1,248 piezas en 42 segundos.' },
    { n: '02', t: 'Por talla y color', d: 'Cada estilo, con sus tallas y sus colores, contra lo que dice tu inventario de Sacs.' },
    { n: '03', t: 'Lo que no cuadra', d: 'Sacs dice 3 M del vestido de lino mandarina; el lector leyó 1. Faltan 2.' },
    { n: '04', t: 'Dónde están', d: 'Las 2 M están en la bodega, en la caja 14: súbelas al piso antes de que se pierda la venta.' },
  ],
  estilo: 'Vestido midi de lino · Mandarina',
  tallas: [
    { t: 'CH', sacs: 2, leidas: 2 },
    { t: 'M', sacs: 3, leidas: 1 },
    { t: 'G', sacs: 3, leidas: 3 },
  ],
};

// Tres usos más, uno por foto (RfidUsos).
export const RFID_USOS = {
  folio: ['Más allá del conteo', 'En tu tienda y tu bodega'] as [string, string],
  h: 'La misma etiqueta, todo el día.',
  usos: [
    { k: 'Encuentra cualquier prenda', t: '¿Dónde está la M?', d: 'Buscas la prenda en el lector y te guía mientras te acercas, como un radar.', img: 'rfid-vertical', ui: { a: 'Buscando', b: 'Vestido midi · M · Mandarina', c: 'Muy cerca' } },
    { k: 'Recibe sin abrir cajas', t: 'La caja, contada cerrada.', d: 'Lees la caja del proveedor y la comparas con la orden de compra: sabes qué llegó y qué falta antes de abrirla.', img: 'rfid-bodega', ui: { a: 'Caja leída', b: '48 de 50 piezas', c: 'Faltan 2 G' } },
    { k: 'Controla las salidas', t: 'La puerta avisa.', d: 'Las antenas de la entrada avisan si una prenda sale sin pagar; lo cobrado ya no suena.', img: 'rfid-puerta', ui: { a: 'Salida sin pagar', b: 'Blusa de seda · M', c: '18:42' } },
  ],
};

export const RFID_ETIQUETA = {
  k: 'La etiqueta',
  h: 'Un chip y una antena, dentro de la etiqueta de siempre.',
  puntos: [
    { t: 'Se lee sin verla', d: 'No hace falta apuntarle ni sacarla del gancho.' },
    { t: 'A metros y muchas a la vez', d: 'El lector lee todo lo que alcanza, no una por una.' },
    { t: 'Un número por pieza', d: 'Cada prenda tiene el suyo: no solo el estilo, la pieza.' },
  ],
};

export const RFID_RESUELVE = {
  folio: ['Lo que resuelve', 'Para tu inventario'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'Cerrar la tienda un día para contar.',
    'La M que el sistema dice que hay y nadie encuentra.',
    'La talla que está en la bodega mientras se pierde la venta en el piso.',
    'La caja del proveedor que nadie revisa completa.',
    'La prenda que sale sin pagar y te enteras en el inventario.',
  ],
};

export const PREGUNTAS_RFID = [
  { question: '¿Qué necesito?', answer: 'Etiquetas RFID en tus prendas y un lector de mano, conectados a tu Sacs; si quieres control de salidas, las antenas de la puerta. Nosotros lo instalamos y lo dejamos funcionando.' },
  { question: '¿Qué es una etiqueta RFID?', answer: 'Una etiqueta con un chip y una antena adentro. A diferencia del código de barras, se lee sin verla, a distancia y muchas a la vez: por eso un rack completo se cuenta de una pasada.' },
  { question: '¿Tengo que etiquetar toda mi mercancía?', answer: 'Para contar con RFID, cada pieza necesita su etiqueta. Lo normal es empezar con la mercancía que llega y con las tiendas donde más cuesta contar.' },
  { question: '¿Sustituye a mi código de barras?', answer: 'No: la etiqueta puede llevar los dos. La caja sigue cobrando con código de barras, y el RFID cuenta, busca y controla salidas.' },
  { question: '¿Y en las tiendas sin RFID?', answer: 'También cuentas tu inventario en Sacs: completo, parcial, sorpresa o ciego, con la cámara del celular o un lector Bluetooth, o dictándole a AXO por voz.' },
  { question: '¿Cuánto cuesta?', answer: 'Depende de cuántas prendas y tiendas tengas: las etiquetas, el equipo y la instalación se cotizan contigo en la demo.' },
];
