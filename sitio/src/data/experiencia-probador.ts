/**
 * /experiencia/probador-virtual — «Probador virtual en tienda» (Experiencia 01, 2-oct-2026).
 *
 * Pedido del dueño: «toda la parte del probador que ya pusimos en la tienda online, pero con el fin de que el usuario
 * entienda que lo puede hacer en su tienda física o en su tienda online; la imagen en pantalla completa, como en
 * Planeación de demanda, con los colores, y que con el scroll vayas viendo la experiencia».
 *
 * LO QUE EXISTE (y es lo único que esta página cuenta), revisado el 2-oct-2026:
 *  - «Pruébatelo con tu foto» en la ficha de la tienda en línea de Sacs (fashion-forward 7d919c1; API
 *    /tienda/:cuenta/probador, sacs_api lib/estudio/probador.lib.js): la clienta sube su foto o se la toma, acepta el
 *    aviso (para qué se usa, que no se guarda, que es adulta y que es ella), la IA revisa la foto (una persona, adulta,
 *    vestida) y genera la imagen con la prenda o el look puesto. «Suele tardar de 30 a 60 segundos» (lo dice la tienda).
 *    No se guarda nada; la imagen lleva su etiqueta de IA; hay tope por día de la tienda y por persona; cada prueba usa
 *    créditos de IA de la marca. APAGADO por defecto: la marca lo enciende en Ajustes del Estudio.
 *  - «¿Cuál es mi talla?»: sus medidas contra la tabla de medidas de la prenda. «Míralo en alguien como tú»: el look en
 *    el cuerpo más parecido a ella (talla, estatura, complexión). Las dos en la misma ficha.
 *  - Funciona en cualquier navegador: en el PISO va en la tablet de la tienda o en el celular de la clienta. NO es un
 *    espejo con cámara ni un aparato aparte, y NO es en tiempo real (por eso aquí no se dice «en vivo»).
 * Fotos: escenas de tienda generadas con gpt-image-2.5 (Higgsfield); la clienta en su casa (antes y con el vestido)
 * son las de la sección de Tienda en línea (public/images/probador).
 */

export const PROBADOR = {
  folio: 'Experiencia 01',
  titulo: 'Probador virtual en tienda.',
  bajada: 'Tu clienta se ve con la prenda puesta antes de comprarla: en el piso de tu tienda o desde su casa.',
};

export const LUGARES = {
  tienda: {
    k: '01 · En el piso',
    h: 'En tu tienda.',
    p: 'En la tablet de tu tienda o en su celular: se ve con otra talla, otro color o el look completo, sin volver al probador.',
  },
  casa: {
    k: '02 · En línea',
    h: 'Y desde su casa.',
    p: 'Desde la ficha de cada prenda en tu tienda en línea, a cualquier hora.',
  },
  cierre: 'El mismo probador, con el mismo inventario.',
};

export const FOTO = {
  k: 'Pruébatelo con tu foto',
  h: 'De su foto, a la prenda puesta.',
  p: 'Se toma una foto o la sube, y en menos de un minuto se ve con la prenda puesta.',
  colores: [
    { n: 'Rosa', c: '#E0457B', img: 'cam-rosa' },
    { n: 'Negro', c: '#141414', img: 'cam-negro' },
    { n: 'Verde esmeralda', c: '#1E7A4C', img: 'cam-verde' },
  ],
  nota: 'Con la misma foto se prueba otro color. Tú pones cuántas pruebas al día tiene cada persona.',
};

export const PASOS = [
  { n: '01', t: '¿Cuál es mi talla?', d: 'Pone sus medidas y le dice qué talla le queda, con la tabla de medidas de esa prenda.' },
  { n: '02', t: 'Míralo en alguien como tú', d: 'El look en la modelo que más se parece a ella: talla, estatura y complexión.' },
  { n: '03', t: 'Pruébatelo con tu foto', d: 'Se toma una foto y en menos de un minuto se ve con la prenda puesta.' },
  { n: '04', t: 'Elige el color y compra', d: 'Lo agrega a la bolsa en su talla y lo recoge en tu tienda o se lo envías.' },
];

export const CUIDADO = {
  h: 'Su foto, cuidada.',
  puntos: [
    'Antes de todo, su permiso: para qué se usa y que es mayor de edad.',
    'Solo ella en la foto, adulta y vestida. Si no, no se genera nada.',
    'No se guarda: la foto y el resultado se borran al terminar.',
    'La imagen dice que es de IA: el ajuste, la caída y el color son aproximados.',
  ],
  nota: 'Su talla se la da la tabla de medidas, no la foto.',
};

export const MARCA = {
  h: 'Lo prendes tú.',
  cols: [
    { t: 'Apagado de entrada', d: 'Lo enciendes en los Ajustes del Estudio de moda, cuando tu aviso de privacidad lo cubra.' },
    { t: 'Con tope', d: 'Tú pones cuántas pruebas al día tiene la tienda y cada persona. Cada prueba usa créditos de IA de tu cuenta.' },
    { t: 'Con tu inventario', d: 'Se prueba sobre tu catálogo: la talla, el color y la sucursal donde está.' },
  ],
};

export const PREGUNTAS_PROBADOR = [
  { question: '¿Funciona en mi tienda física?', answer: 'Sí. Es el mismo probador de tu tienda en línea de Sacs: en el piso lo usas en la tablet de tu tienda o tu clienta en su celular. No necesitas un aparato especial.' },
  { question: '¿Es en tiempo real?', answer: 'No. Tu clienta se toma una foto o la sube, y la imagen con la prenda puesta tarda de 30 a 60 segundos en estar lista. No es un espejo con cámara en vivo.' },
  { question: '¿Qué pasa con la foto de mi clienta?', answer: 'No se guarda: la foto y el resultado se borran al terminar. Antes de generar nada, ella acepta para qué se usa y confirma que es mayor de edad y que la foto es suya; la IA revisa que sea una sola persona, adulta y vestida. La imagen lleva su etiqueta de IA.' },
  { question: '¿Cómo sabe su talla?', answer: 'Con «¿Cuál es mi talla?»: pone sus medidas (busto, cintura, cadera o pie) y Sacs le recomienda la talla con la tabla de medidas de esa prenda. La foto no se usa para la talla.' },
  { question: '¿Cuánto cuesta cada prueba?', answer: 'Cada prueba usa créditos de IA de tu cuenta. Tú pones cuántas pruebas al día tiene tu tienda y cada persona.' },
  { question: '¿Cómo lo enciendo?', answer: 'Viene apagado. Lo enciendes en los Ajustes del Estudio de moda de Sacs, cuando tu aviso de privacidad cubra el uso de la foto. Es parte de la Suite de Moda; en la demo te decimos qué incluye tu plan.' },
];
