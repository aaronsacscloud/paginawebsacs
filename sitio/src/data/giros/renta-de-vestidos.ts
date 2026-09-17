/**
 * Contenido de la landing de RENTA DE VESTIDOS Y TRAJES (17-sep-2026). Sale de la ficha del oficio
 * (scratchpad/giros-fichas/renta-de-vestidos.md) con el dictamen del referee aplicado: "día extra"
 * (no multa por entrega tarde), "regresarlo a su talla / soltar el ajuste" (hilván, sin cortar
 * tela), el corsé de agujetas que cubre 2-3 tallas, INE o copia en garantía, "lavado" (no
 * tintorería a secas), coctel, la invitada y la mamá, consignación, el anticipo no se regresa,
 * crinolina aparte, envío a foránea de 9 días, arrendamiento, corredores reales (Centro de CDMX,
 * Chimalhuacán, Medrano, Zapotlanejo), 15-25 rentas en la vida del vestido y 6-10 al año. Bloque
 * propio: el calendario de cada vestido (un vestido, muchas fiestas, cero empalmes); no repite el
 * de novias (abonos contra la fecha).
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran como
 * parte del sistema; se construyen si el cliente las pide): calendario por pieza, bloqueo de
 * empalmes, días de lavado, semáforo de estado por pieza, depósito en garantía y día extra,
 * contrato, foto de entrega y devolución, rentas acumuladas y alerta de venta, paso de renta a
 * venta, citas de prueba, cola de la costurera, traje como juego de dos tallas, renta en grupo,
 * disponibilidad por fecha en WhatsApp y en la tienda en línea, envío a foránea, consignación,
 * reglas del apartado, comisión por renta, arrendamiento y depósito fuera del ingreso.
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockBarras, mockTicket, mockLista, mockCalendario } from './_mocks';

const IMG = '/images/giros/renta-de-vestidos';

export const bannerRE = {
  eyebrow: 'SACS · Renta de vestidos y trajes',
  titulo: 'Un vestido, muchas fiestas.',
  resalte: 'Cero empalmes.',
  sub: 'El calendario de cada vestido con sus días de lavado, el apartado con anticipo amarrado a la fecha, el depósito en garantía y la devolución con foto, la cola de la costurera por fecha de evento y el “¿está disponible el 24?” contestado desde el celular.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Boutique de renta de vestidos de fiesta con los rieles por color y el calendario de un vestido en la tablet del mostrador',
  avisos: [
    { modulo: 'Ocupado ese sábado', texto: 'Azul rey talla 7 · sale el 20 · vuelve del lavado el 24 · ofrece el verde', pos: 1 as const, tono: 'rojo' as const, sello: 'Junio' },
    { modulo: 'Devolución', texto: 'Vino largo 9 · regresó hoy · foto tomada · depósito devuelto', pos: 2 as const, tono: 'verde' as const, sello: 'Lunes' },
    { modulo: 'Cola de costura', texto: '6 vestidos para el jueves · el de la boda del sábado va primero', pos: 3 as const, tono: 'azul' as const, sello: 'Hoy' },
  ],
};

export const manifiestoRE = {
  intro: 'Sabemos cómo se rentan los vestidos',
  frases: [
    'Apartaste el mismo vestido para <b>dos quinceañeras</b> el mismo sábado y te diste cuenta el jueves.',
    'Te preguntan en Instagram “<b>¿está disponible el 24?</b>”, vas a buscar la libreta, y para cuando contestas ya lo rentaron en otro lado.',
    'El vestido regresó con <b>vino</b> en toda la falda, la clienta dice que así se lo diste y no tienes foto de cómo salió.',
    'Se te olvidó que ese vestido <b>estaba en el lavado</b> y ya lo tenías prometido para el viernes.',
    'Tienes <b>$40,000 de depósitos</b> en el cajón y no sabes de quién es cuál ni cuáles ya regresaste.',
    'Las seis damas apartaron el mismo <b>verde</b> y una vive en Tijuana; no sabes quién ya pagó, quién ya se midió y qué talla falta.',
    'Abriste la segunda tienda y ya no sabes en cuál sucursal está el <b>azul talla 9</b> ni si allá ya lo apartaron.',
    'La costurera tiene <b>40 vestidos</b> en el taller y el de la boda del sábado estaba hasta abajo del montón.',
  ],
  cierre: 'Ningún sistema de ropa entiende que aquí el vestido no se vende: se comparte en el tiempo, sale cuatro sábados seguidos y entre uno y otro tiene que volver, lavarse y soltar el ajuste. Sacs sí: cada pantalla que sigue funciona igual en el mostrador, en el taller y en el WhatsApp. Y encima puedes poner agentes de IA para que hagan el trabajo repetitivo: el recordatorio de liquidar, el de recoger el jueves y el de devolver el lunes.',
};

export const variantesRE = {
  eyebrow: 'Un solo modelo',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“el azul de la foto”.',
  sub: 'Aquí no hay curva: cada vestido es una pieza con su talla, su tipo de espalda y su calendario. El azul rey de la foto son seis piezas, y la 7 con corsé cubre de la 5 a la 9 sin costurera. Lo que la clienta pregunta no es “¿lo tienes?”, es “¿lo tienes libre el 24?”.',
  ejeA: ['3', '5', '7', '9', '11', '13'],
  filas: [
    { nombre: 'Azul rey · corsé', img: `${IMG}/prod-azul.webp`, alt: 'Vestido largo azul rey con corsé de agujetas, en funda' },
    { nombre: 'Vino · cierre', img: `${IMG}/prod-vino.webp`, alt: 'Vestido largo vino con cierre, en funda' },
    { nombre: 'Verde esmeralda · dama', img: `${IMG}/prod-verde.webp`, alt: 'Vestido de dama verde esmeralda' },
    { nombre: 'Dorado · coctel', img: `${IMG}/prod-dorado.webp`, alt: 'Vestido corto dorado de coctel' },
  ],
  matriz: [
    [0, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 0, 1],
    [1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0, 0],
  ],
  unidad: 'piezas',
  genero: 'f' as const,
  umbralBajo: 0,
  leyendas: ['Hay una pieza', 'Hay una pieza', 'No hay'] as [string, string, string],
  remate: 'Casi todo es “una pieza”. Por eso la pregunta no es cuántas hay, sino qué fechas tiene ocupadas cada una y cuándo vuelve del lavado.',
};

export const cortinaRE = {
  titulo: '“¿Está disponible el 24?”',
  pieAntes: 'La libreta, el calendario de la pared<br />y la clienta esperando en el chat.',
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Encargada de una boutique de renta buscando en la libreta y en el calendario de la pared si el vestido azul está libre',
  altDespues: 'La misma encargada contestando desde la tablet, con el calendario del vestido azul en pantalla',
  libreta: ['Azul 7 — ¿libre el 24?', 'Depósito Sra. Ruiz $1,500', 'Vino 9 — ¿ya volvió del lavado?'],
  filas: [
    { que: '¿Está libre el 24?', donde: 'El calendario del vestido', dato: 'Sale el 22, vuelve el 25, lavado el 26 y 27: el 24 está ocupado. El verde sí está libre' },
    { que: 'El depósito de la Sra. Ruiz', donde: 'En la ficha de la renta', dato: 'Cuánto dejó, con qué, y si ya se devolvió o se descontó, con la foto de la devolución' },
    { que: 'Las seis damas del verde', donde: 'Un apartado de grupo', dato: 'Misma fecha, seis tallas, cada quien paga lo suyo; la de Tijuana con envío de 9 días' },
    { que: '¿Qué va primero en costura?', donde: 'La cola por fecha de evento', dato: 'El de la boda del sábado arriba, aunque haya llegado al último' },
  ],
  pieDespues: 'La misma encargada, el mismo chat. Ya no busca: contesta.',
};

export const casosRE = [
  {
    id: 'junio',
    titulo: 'Junio: el vestido que sale cuatro sábados seguidos',
    texto: 'Un vestido bueno sale jueves, regresa lunes, se lava martes y miércoles y sale otra vez jueves. Si un solo eslabón se atrasa (una devolución tarde, el lavado que no volvió), se cae la renta del siguiente sábado. El calendario del vestido bloquea los días de lavado y avisa al momento si la fecha nueva cabe o no.',
    remate: 'En junio, un sábado es la cuarta parte del mes.',
    img: `${IMG}/proceso-calendario.webp`,
    alt: 'Vendedora mostrando en la tablet el calendario de un vestido con los días de entrega, fiesta, devolución y lavado',
  },
  {
    id: 'limpia',
    titulo: 'Agosto y enero: qué se vende y qué se repone',
    texto: 'Sin el número de rentas por pieza, se vende el vestido que “te cae mal” y te quedas con el que ya no sale. Con las rentas acumuladas por vestido, lo que ya salió 15 o 25 veces pasa a venta con su precio de remate y el dinero financia la colección nueva.',
    remate: 'Un vestido que no sale ni tres veces al año pierde dinero aunque esté nuevo.',
    img: `${IMG}/caso-limpia.webp`,
    alt: 'Dueña de una boutique de renta revisando las rentas acumuladas de cada vestido para decidir cuáles pasan al rack de venta',
  },
  {
    id: 'diciembre',
    titulo: 'Octubre: cuando se aparta diciembre',
    texto: 'Diciembre se llena en octubre. Las foráneas apartan por WhatsApp con transferencia. El anticipo queda amarrado a la fecha y al vestido, con recordatorio de liquidación y de cita de prueba, y la que no liquida a tiempo libera el vestido.',
    remate: 'Si el anticipo no está amarrado, en diciembre aparecen dos clientas con el mismo comprobante.',
    img: `${IMG}/caso-foranea.webp`,
    alt: 'Encargada empacando un vestido en funda para enviarlo por paquetería a una clienta de otra ciudad, con la guía en el celular',
  },
  {
    id: 'lunes',
    titulo: 'El lunes de devolución',
    texto: 'Se abre la funda enfrente de la clienta y hay que decidir: se regresa el depósito, se descuenta o se cobra reposición. Con la foto de cómo salió, el contrato y la lista de revisión en la ficha, el cargo sale del mismo depósito y no hay pleito.',
    remate: 'Sin foto de salida, la dueña pierde la discusión o pierde a la clienta.',
    img: `${IMG}/proceso-devolucion.webp`,
    alt: 'Revisión de un vestido devuelto sobre el mostrador de una boutique de renta, con la foto de entrega en la tablet',
  },
];

export const seccionesRE: SuiteSeccion[] = [
  {
    id: 'calendario', tag: 'Calendario',
    titulo: 'Cada vestido con su calendario y su semáforo',
    texto: 'Cada pieza sabe en qué está: libre, apartada, en costura, lista, entregada, en revisión, en lavado, en venta. Al apartar una fecha se pintan solos los siete días: entrega, fiesta, devolución y lavado. Y el sistema no deja apartar dos veces el mismo sábado.',
    bullets: ['Siete días por renta: jueves a miércoles, con el lavado adentro', 'Nueve días si es foránea: sale el miércoles y vuelve el martes', 'Lavado urgente de un día solo con clave de la dueña'],
    visual: mockCalendario('Azul rey · talla 7', 'Junio', 30, { 4: 'aviso', 5: 'aviso', 6: 'lleno', 7: 'lleno', 8: 'aviso', 9: 'ok', 10: 'ok', 18: 'aviso', 19: 'aviso', 20: 'lleno', 21: 'lleno', 22: 'aviso', 23: 'ok', 24: 'ok' }, 'Sábados 6 y 20 ocupados con su lavado; el 13 y el 27 siguen libres'),
  },
  {
    id: 'apartado', tag: 'Apartado',
    titulo: 'El anticipo amarrado a la fecha y al vestido',
    texto: 'La mitad para apartar y la fecha queda en el calendario de la pieza. Recordatorio de segunda prueba y de liquidación por WhatsApp; la que no liquida a tiempo libera el vestido. El anticipo no se regresa, y el cambio de fecha depende del calendario.',
    bullets: ['Anticipo, liquidación y fecha límite en la ficha de la renta', 'Renta en grupo: las seis damas en un apartado, cada quien paga lo suyo', 'Cita de prueba con recordatorio'],
    visual: mockLista('Apartados de esta semana', [['Azul rey 7 · XV · sábado 20 · liquidado', 'Lista', 'ok'], ['Verde esmeralda · 6 damas · sábado 27 · 4 de 6 pagaron', 'Falta liquidar', 'aviso'], ['Dorado coctel 9 · graduación · jueves 25', 'Cita de prueba', 'gris'], ['Vino largo 9 · foránea · envío miércoles', 'Guía lista', 'ok']], 'Salen 12 el jueves; 4 no han liquidado'),
  },
  {
    id: 'deposito', tag: 'Depósito y devolución',
    titulo: 'El depósito no es tuyo, y la foto termina el pleito',
    texto: 'Al entregar: contrato, foto del vestido y depósito (dinero o INE en garantía), separado de la venta del día. Al devolver: lista de revisión, foto, y el depósito se regresa o se descuenta con concepto claro. El día extra se cobra solo.',
    bullets: ['Depósitos retenidos: cuánto dinero ajeno hay en caja hoy y de quién', 'Día extra por devolución tarde, reposición por daño, del mismo depósito', 'Historial del vestido: qué se le hizo y cuánto costó'],
    visual: mockTicket('Devolución · vino largo 9 · lunes', [['Depósito recibido el jueves', '$1,500'], ['Día extra (devolvió martes)', '−$300'], ['Mancha en el bajo · lavado especial', '−$250']], ['Se devuelve', '$950'], 'Con foto de entrega y de devolución en la ficha'),
  },
  {
    id: 'costura', tag: 'Taller',
    titulo: 'La cola de la costurera por fecha de evento',
    texto: 'Lo del sábado más próximo va primero, aunque haya llegado al último. El ajuste se hace con hilván, sin cortar tela, y al volver del lavado se suelta y el vestido regresa a su talla. Los de corsé de agujetas ni pasan por costura.',
    bullets: ['Pendientes por fecha: qué va primero, qué ya está listo', 'Regresarlo a su talla después del lavado, antes de marcarlo libre', 'Reparaciones en la ficha del vestido: cierre, pedrería, bastilla'],
    visual: mockLista('Cola de costura · para el jueves', [['Vino largo 9 · boda sábado · bastilla y entallar', 'Primero', 'aviso'], ['Dorado coctel 9 · graduación jueves · bastilla', 'En proceso', 'ok'], ['Azul rey 7 · corsé · sin ajuste', 'Listo', 'ok'], ['Verde dama 11 · volvió del lavado · soltar ajuste', 'Regresar a su talla', 'gris']], 'La costurera ve su cola en la tablet del taller'),
  },
  {
    id: 'whatsapp', tag: 'WhatsApp e Instagram',
    titulo: '“¿Está disponible el 24?”, contestado al momento',
    texto: 'La foto del aparador es la que más preguntan. Desde el chat se ve el calendario de esa pieza y se contesta con la fecha; si no está, se ofrece otro del mismo color. El apartado por transferencia queda amarrado a la fecha, y a la foránea le sale la guía de ida y de regreso.',
    bullets: ['Calendario del vestido desde el celular', 'Apartado desde el chat con anticipo y fecha', 'Envío a foránea con guía y bloqueo de nueve días'],
    visual: mockLista('WhatsApp · hoy', [['¿Está el azul libre el 24? · no, el 27 sí · verde libre el 24', 'Contestado', 'ok'], ['Foránea Tijuana · verde dama 11 · envío miércoles', 'Guía lista', 'ok'], ['Graduación jueves 25 · dorado 9 · anticipo por transferencia', 'Apartado', 'aviso'], ['Recordatorio: devolver el lunes · 12 clientas', 'Enviado', 'gris']], 'Cada chat queda en la ficha de la clienta'),
  },
  {
    id: 'rentas', tag: 'Rentas acumuladas',
    titulo: 'Cuántas veces ha salido cada vestido',
    texto: 'Cada renta suma en la ficha de la pieza: cuánto ha ganado, cuánto costó y cuánto lleva de lavado y costura. Cuando llega a las 15 o 25 salidas, o a las dos temporadas, aparece la alerta de pasarlo a venta con su precio de remate y sale en la tienda en línea.',
    bullets: ['Rentas y utilidad por vestido, de menos a más', 'De renta a venta con un clic; el dinero financia la colección nueva', 'Consignación: de quién es la pieza y qué porcentaje se le paga por salida'],
    visual: mockBarras('Rentas acumuladas · vestidos largos', [['Azul rey 7', '19 rentas · $38,000', 100], ['Vino largo 9', '14 rentas · $28,000', 74], ['Verde dama 11', '9 rentas · $13,500', 47], ['Rosa palo 5', '2 rentas · $4,000', 11]], 'El rosa palo no sale: a venta. El azul rey ya pagó tres veces lo que costó'),
  },
];

export const planoRE = [
  {
    id: 'aparador', nombre: 'Aparador y entrada', simbolo: 'exhibidores' as const,
    foto: `${IMG}/zona-aparador.webp`, alt: 'Aparador de una boutique de renta de vestidos con los modelos más pedidos de la temporada',
    pie: 'La foto que se sube a Instagram sale de aquí; es el vestido que más preguntan “¿está disponible el…?”.',
    pregunta: '¿Cuál es el que más preguntan?',
    caja: { x: 68, y: 82, w: 216, h: 80 },
    items: [
      { t: 'La pieza del aparador con su calendario a un clic desde el chat' },
      { t: 'El rack de venta: lo que ya rentó 15 o 25 veces, a precio de remate y en la tienda en línea' },
      { t: 'Citas de prueba en temporada alta, con recordatorio' },
      { t: 'La foránea que viene por su vestido y la clienta que llega a devolver se atienden con su ficha' },
      { t: 'Qué modelos y tallas se rentan más por temporada, para la compra de agosto', plan: 'Automatiza' },
    ],
  },
  {
    id: 'rieles', nombre: 'Rieles por color', simbolo: 'rieles' as const,
    foto: `${IMG}/zona-rieles.webp`, alt: 'Rieles de vestidos de fiesta por color en una boutique de renta, con etiqueta numerada en cada gancho',
    pie: 'Cada pieza con su etiqueta; los apartados llevan listón, y los que están en el lavado dejan su hueco.',
    pregunta: '¿Este ya tiene fecha?',
    caja: { x: 68, y: 170, w: 216, h: 86 },
    items: [
      { t: 'Cada vestido es una pieza: talla, color y tipo de espalda (corsé o cierre)' },
      { t: 'Semáforo por pieza: libre, apartado, en costura, listo, entregado, en lavado, en venta' },
      { t: 'La vendedora ve el calendario antes de bajarlo del riel' },
      { t: 'Existencias por sucursal: en qué tienda está el azul talla 9 y si allá ya lo apartaron', plan: 'Controla' },
      { t: 'Traspaso entre tiendas para un evento, con fecha de ida y de regreso', plan: 'Controla' },
    ],
  },
  {
    id: 'vestidores', nombre: 'Vestidores y espejo', simbolo: 'probadores' as const,
    foto: `${IMG}/zona-vestidores.webp`, alt: 'Vestidores con cortina y espejo de tres hojas en una boutique de renta, con la familia en la banca',
    pie: 'Primera prueba, segunda prueba con el ajuste hecho y la foto que la clienta manda al grupo de la familia.',
    pregunta: '¿Cuándo es la segunda prueba?',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Cita de prueba por vestidor y sucursal, con recordatorio por WhatsApp' },
      { t: 'El ajuste se marca aquí y entra a la cola de la costurera con la fecha del evento' },
      { t: 'Renta en grupo: las damas y los padrinos se miden por separado y cada quien paga lo suyo' },
      { t: 'La clienta queda en el CRM con su talla y sus fechas: XV, graduación, boda', plan: 'Fideliza' },
      { t: 'El caballero manda medidas por WhatsApp y el traje se arma con talla de saco y de pantalón' },
    ],
  },
  {
    id: 'mostrador', nombre: 'Mostrador y caja', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-mostrador.webp`, alt: 'Mostrador de una boutique de renta con la tablet del calendario, la impresora del contrato y el cajón de depósitos',
    pie: 'Aquí se aparta enfrente de la clienta, se firma el contrato, se deja el depósito y el lunes se revisa la devolución.',
    pregunta: '¿Cuánto dinero ajeno tengo en la caja?',
    caja: { x: 68, y: 264, w: 216, h: 104 },
    items: [
      { t: 'Anticipo, liquidación y depósito en la misma ficha; el depósito fuera del ingreso' },
      { t: 'Contrato impreso o digital con vestido, accesorios, fecha, precio y condiciones' },
      { t: 'Foto de entrega y de devolución; lista de revisión; día extra y reposición del mismo depósito' },
      { t: 'Factura como arrendamiento; cobro con y sin internet' },
      { t: 'Reporte de depósitos retenidos y comisión de la vendedora por renta cerrada', plan: 'Controla' },
    ],
  },
  {
    id: 'taller', nombre: 'Taller, lavado y fundas', fuera: true, simbolo: 'armado' as const,
    foto: `${IMG}/zona-taller.webp`, alt: 'Taller de costura de una boutique de renta con el riel de pendientes por fecha y el vaporizador',
    pie: 'Riel de pendientes por fecha de evento, riel de listos con funda y etiqueta, y lo que vuelve del lavado se revisa antes de volver al piso.',
    pregunta: '¿Qué va primero?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Cola de la costurera ordenada por fecha de evento, en la tablet del taller' },
      { t: 'Ajuste con hilván; soltar el ajuste y regresar a su talla al volver del lavado' },
      { t: 'Lavado (tintorería o lavandería propia) como días bloqueados en el calendario; pedrería a mano y vapor' },
      { t: 'Reparaciones por vestido: cierre, pedrería, bastilla, con su costo' },
      { t: 'En cadena, el taller central recibe lo de todas las sucursales y despacha por fecha', plan: 'Controla' },
    ],
  },
];

export const pasosRE = [
  { cuando: 'Día 1', titulo: 'Tus vestidos, cargados', texto: 'Nos das tu lista o tu sistema actual y lo subimos nosotros. No capturas nada.', detalle: 'Cada pieza con su talla, color, tipo de espalda, rentas que lleva y las fechas ya apartadas; los trajes por talla de saco y de pantalón.', img: `${IMG}/proceso-recibir.webp`, alt: 'Recepción de vestidos nuevos en una boutique de renta, etiquetando cada pieza' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus días de lavado, tu depósito, tu contrato y tus reglas del apartado.', detalle: 'Siete días por renta o nueve por foránea, el día extra, el anticipo que no se regresa y quién autoriza un lavado urgente.', img: `${IMG}/proceso-contrato.webp`, alt: 'Firma del contrato de renta y entrega del vestido en funda en el mostrador' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Apartar una fecha y contestar “¿está disponible el 24?” se aprende en media hora.', detalle: 'Y se practica lo de todos los días: la devolución con foto, la cola de costura y el envío a la foránea.', img: `${IMG}/proceso-costura.webp`, alt: 'Costurera marcando el ajuste de un vestido con alfileres frente a la cola de pendientes por fecha' },
  { cuando: 'Día 4', titulo: 'Arranca una tienda', texto: 'La primera sucursal renta con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con los apartados vivos ya migrados: ninguna quinceañera llega por su vestido y se encuentra con que su fecha no existe.', img: `${IMG}/proceso-entrega.webp`, alt: 'Entrega de un vestido en funda a una clienta el jueves, con la foto de salida en el celular' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día.', detalle: 'Y el traspaso de vestidos entre sucursales para un evento ya corre desde el primer fin de semana.', img: `${IMG}/proceso-lavado.webp`, alt: 'Vestidos volviendo del lavado en fundas, revisados antes de regresar al piso' },
];
export const ticketRE = { lineas: [{ n: 'Renta · azul rey 7 · sábado 20', p: '$2,200' }, { n: 'Crinolina', p: '$300' }, { n: 'Anticipo recibido', p: '−$1,250' }], total: '$1,250 · liquida en la prueba' };

export const escalaRE = [
  { n: '1 tienda', nombre: 'La boutique de la colonia', cambia: ['La dueña es el sistema: libreta, calendario de la pared y su WhatsApp', '80 a 300 vestidos; la costurera va por horas', 'Los empalmes y los depósitos en el cajón son el problema'], sistema: ['El calendario de cada vestido en el celular', 'La ficha de la renta con depósito, foto y contrato', 'El chat contesta “¿está disponible el 24?” sin ir a la libreta'], dato: { valor: '7 días', rotulo: 'por renta: entrega, fiesta, devolución y lavado, pintados solos' } },
  { n: '5 tiendas', nombre: 'La boutique de plaza con sucursales', cambia: ['Encargada por tienda y un Instagram compartido', 'Ya no se sabe en cuál sucursal está el vestido de la foto ni si allá lo apartaron', 'Taller de costura central o una costurera por tienda'], sistema: ['Existencias por sucursal y traspaso de vestidos para un evento', 'Calendario compartido: la pieza está ocupada en todas las tiendas a la vez', 'Cola de costura por fecha con lo de todas las tiendas'], dato: { valor: '1 pieza', rotulo: 'a la vez: el azul talla 9 sabe en qué tienda está y para cuándo' } },
  { n: '50 tiendas', nombre: 'La cadena con taller central', cambia: ['Compra centralizada por temporada y reparto por rotación de cada tienda', 'Taller central de costura y lavado propio o convenios por zona', 'La dirección pide rentas por vestido por sucursal, inventario muerto y depósitos retenidos'], sistema: ['Rentas acumuladas y utilidad por pieza y por tienda', 'Depósitos retenidos por sucursal y comisión por renta cerrada', 'Qué tiendas tienen más días extra y reposiciones: peor revisión al entregar'], dato: { valor: '15 a 25', rotulo: 'rentas en la vida de un vestido pedido; 6 a 10 al año' } },
  { n: '150 tiendas', nombre: 'La cadena nacional', cambia: ['Los vestidos viajan entre ciudades según el calendario de eventos', 'Franquicias con su propio corte y el corporativo con la foto completa', 'Consignación de diseñadoras y clientas en varias plazas'], sistema: ['Calendario nacional por modelo: 12 piezas talla 7 en el país, 9 ocupadas el 24, 3 libres', 'La IA decide dónde mandar cada pieza y qué reponer', 'Liquidación mensual a consignantes y a franquicias'], dato: { valor: '1 calendario', rotulo: 'por modelo en todo el país, con cada pieza y cada fecha' } },
];

export const problemasRE = {
  doc1: {
    membrete: 'Sistema de ropa', sub: 'Reporte de inventario',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'EXIST.'],
    lineas: [
      { a: 'SKU-1207', b: 'VESTIDO LARGO AZUL REY', c: '6' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿libre el 24?', '¿ya volvió del lavado?'],
    sello: 'NO VE<br />LA FECHA',
    notas: [
      'Te dice que hay <b>seis</b>. No te dice cuál está libre el sábado 24.',
      'Para saber si cabe la fecha abres la <b>libreta</b> o el calendario de la pared.',
      'Te dice cuánto vendiste, <b>no cuántas veces salió cada vestido</b>.',
      'Abres la segunda tienda y el vestido de la foto ya no se sabe dónde está.',
    ],
  },
  filas: [
    { que: 'El calendario de cada pieza con sus días de lavado', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Apartado con anticipo amarrado a fecha y vestido', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Depósito en garantía, foto y devolución con revisión', generico: 'No existe', medida: 'Rara vez', sacs: 'Incluido' },
    { que: 'Cola de la costurera por fecha de evento', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'Rentas acumuladas y paso a venta', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Tiempo para arrancar', generico: 'Días', medida: '4 a 9 meses', sacs: 'Días' },
    { que: 'Quién lo mantiene', generico: 'Su proveedor', medida: 'Tú, si lo encuentras', sacs: 'Nosotros, a diario' },
  ],
  entrada: 'Casi toda boutique de renta que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un sistema de ropa que dice “hay seis” y no sabe cuál está libre el sábado, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'las boutiques de renta y de fiesta que ya la usan',
};

export const cifrasRE = {
  foto: `${IMG}/escala.webp`,
  alt: 'Taller central de una cadena de renta de vestidos con los rieles de pendientes por fecha y las fundas listas para salir a las sucursales',
  frase: 'Desde la boutique de la colonia hasta la cadena con taller central y vestidos que viajan.',
  encuadre: 'center 45%',
};
