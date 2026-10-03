/**
 * /experiencia/alta-de-productos — «De la caja a la venta en 30 minutos», la Experiencia 02 (3-oct-2026).
 *
 * Pedido del dueño: «subir productos en tiempo real con AXO al llegarte, con lo que tenemos del Estudio: que se vea
 * cómo se pone un tripié, se pone la prenda, se toma la foto en automático con una cámara o un teléfono y cómo se habla
 * en tiempo real con AXO, y de ahí todo el proceso: edición automática, modelo, escenario, publicación en punto de
 * venta y tienda en línea; que indique cuántas tallas son de cada uno y qué colores; que se entienda que un proceso
 * normal de 4–5 días se hace en 30 minutos y, muy importante, que todos los campos comunes de ropa se llenan solos con
 * el reconocimiento de foto de la IA».
 *
 * LO QUE EXISTE (y es lo único que esta página cuenta), revisado el 3-oct-2026 en sacs_api y sacs3:
 *  - «EN VIVO» (sacs_api lib/estudio/vivo.lib.js · sacs3 src/elem/estudio/estudio-vivo.html · también en SACSMobile):
 *    el celular en un tripié con la pantalla hacia la persona y la cámara de enfrente a la prenda; la foto se toma sola
 *    cuando la prenda se queda quieta (cuenta 3·2·1) o al decir «toma la foto»; AXO (voz en tiempo real de OpenAI)
 *    dice qué es y pregunta lo que falta; las decisiones salen en pantalla con opciones numeradas y se contestan por
 *    voz («Di el número o el nombre»). La visión reconoce tipo, nombre, tela probable, color (y, si duda, hasta 4
 *    colores posibles), si es otro color de una prenda de la misma captura y si ya está en el catálogo. Las tallas y
 *    piezas se dictan («¿En qué colores y cuántas de cada talla?» · «de cada color»). Lo que ya tenías va a una
 *    recepción «Pendiente»; lo nuevo, al Estudio. Etiquetas con código de barras al terminar (vivo-etiquetas.lib.js).
 *  - El ADN de la prenda (lib/estudio/adn.lib.js) llena la ficha con la foto: tipo, subtipo, género, silueta, largo,
 *    tiro, cuello, manga, cierre, tela (familia, peso, elasticidad, caída, transparencia, brillo), estampado, colores
 *    (nombre comercial y hex MEDIDO en los píxeles), detalles, temporada, ocasión, estilo, nombre y descripción. La
 *    composición, el cuidado y la talla salen de la ETIQUETA; En vivo manda al Estudio la foto de frente (y la de
 *    espalda), así que en este ejemplo quedan «por confirmar»: lo que no se ve no se inventa; la marca confirma.
 *  - El Estudio (orquestador): foto de producto → colores (el que no se fotografió sale de la misma foto, marcado
 *    «Color ilustrativo») → en modelo (frente, 3/4, espalda, detalle) → video; en paralelo y en el servidor. Prueba
 *    real (29-sep-2026): 10 prendas en 7.7 minutos, 83 % sin retoque.
 *  - La propuesta de producto (producto.lib.js, precio.lib.js): taxonomía de la marca, nombre, descripción, SEO, precio
 *    por reglas (costo $480 al 55 % → $1,290), variantes talla × color con SKU y existencia, fotos (la de modelo de
 *    principal). Se publica con visto bueno, prenda por prenda o en automático (solo lo que pasa todas las revisiones)
 *    en el catálogo de la caja y la tienda en línea, con fotos para marketplaces e historias (canales.lib.js).
 *  - El escenario para redes: el Contenido del Estudio (escenas, reels, lookbook).
 * Fotos: gpt-image-2 (la misma prenda, encadenada por edición). Los números de tiempo son de referencia (lote de 10).
 */

export const ALTA = {
  folio: 'Experiencia 02',
  titulo: 'De la caja a la venta en 30 minutos.',
  bajada: 'Pones la prenda frente al celular, le hablas a AXO y Sacs hace lo demás: la ficha, las fotos, la modelo, el escenario y la publicación en tu caja y tu tienda en línea.',
};

export const ANTES = {
  titulo: 'Lo que antes tomaba una semana.',
  antes: {
    k: 'Así era',
    total: '4 a 5 días',
    pasos: [
      { d: 'Día 1', t: 'Contar y anotar tallas y colores de lo que llegó.' },
      { d: 'Día 2', t: 'Sesión de fotos: fotógrafa, modelo y locación.' },
      { d: 'Día 3', t: 'Editar: fondos, retoque y recortes.' },
      { d: 'Día 4', t: 'Capturar cada ficha: nombre, tela, tallas, colores y precio.' },
      { d: 'Día 5', t: 'Darla de alta en la caja, la tienda en línea y los marketplaces.' },
    ],
  },
  despues: {
    k: 'Con AXO',
    total: 'unos 30 minutos',
    pasos: [
      { d: 'Min 0–15', t: 'Capturas las prendas hablando con AXO.' },
      { d: 'Min 15–23', t: 'El Estudio llena las fichas y hace las fotos, la modelo y el escenario.' },
      { d: 'Min 23–30', t: 'Revisas y publicas en tu caja y tu tienda en línea.' },
    ],
  },
  nota: 'Referencia para un lote de 10 prendas. En nuestras pruebas de septiembre de 2026, el Estudio terminó las fotos de 10 prendas en 7.7 minutos; el resto es la captura y tu revisión.',
};

// La captura en vivo (AltaCaptura): lo que pasa frente al tripié, un paso por tramo del scroll.
export const CAPTURA = [
  { n: '01', t: 'Pones la prenda', d: 'El celular va en un tripié, a 1–1.5 m, con la pantalla hacia ti. Cuelgas la prenda y te haces a un lado.' },
  { n: '02', t: 'La foto se toma sola', d: 'Cuando la prenda se queda quieta, cuenta 3·2·1 y la toma. También puedes decirle «toma la foto».' },
  { n: '03', t: 'AXO la reconoce', d: 'Te dice qué es y te pregunta lo que falta, con opciones en pantalla. Contestas hablando: «la uno».' },
  { n: '04', t: 'Le dices cuántas', d: '«Una chica, tres medianas y dos grandes, de cada color.» AXO lo acomoda por talla y color.' },
  { n: '05', t: 'Y la siguiente', d: 'Mientras capturas, el Estudio ya llena la ficha y hace las fotos de las que pasaste.' },
];

// La tabla que AXO arma con lo dictado (colores × tallas), como la de la pantalla de En vivo.
export const PIEZAS = {
  tallas: ['CH', 'M', 'G'],
  filas: [
    { color: 'Mandarina', hex: '#D44E16', n: [1, 3, 2] },
    { color: 'Negro', hex: '#161616', n: [1, 3, 2] },
  ],
};

/**
 * «La ficha se llena sola» (AltaFicha): el ADN de la prenda de la foto del celular. `punto` = dónde lo ve la IA en la
 * foto (alta-cruda, 720×1080, en %) y de qué lado sale su etiqueta. El color es el medido en los píxeles de la tela.
 * Composición y cuidado: de la etiqueta; aquí no se ve, así que quedan por confirmar (no se inventan).
 */
export interface Campo { k: string; v: string; hex?: string; vacio?: boolean; ancho?: boolean; punto?: { x: number; y: number; lado: 'izq' | 'der' } }
export const FICHA: { k: string; h: string; p: string; campos: Campo[]; nota: string } = {
  k: 'Reconocimiento con IA',
  h: 'La ficha se llena sola.',
  p: 'La IA lee la foto como lo haría tu encargada de producto. Lo que no se ve, no lo inventa: lo deja para que lo confirmes.',
  campos: [
    { k: 'Tipo', v: 'Vestido' },
    { k: 'Subtipo', v: 'Midi, con cinto' },
    { k: 'Género', v: 'Mujer' },
    { k: 'Cuello', v: 'Redondo', punto: { x: 49, y: 19.5, lado: 'der' } },
    { k: 'Manga', v: 'Corta, hombro caído', punto: { x: 29.5, y: 27, lado: 'izq' } },
    { k: 'Silueta', v: 'Línea A', punto: { x: 33.5, y: 72, lado: 'izq' } },
    { k: 'Largo', v: 'Midi', punto: { x: 60, y: 83, lado: 'der' } },
    { k: 'Detalles', v: 'Cinto para anudar', punto: { x: 50.5, y: 44.5, lado: 'izq' } },
    { k: 'Tela', v: 'Lino', punto: { x: 60, y: 33, lado: 'der' } },
    { k: 'Caída', v: 'Fluida' },
    { k: 'Peso', v: 'Ligero' },
    { k: 'Elasticidad', v: 'Nula' },
    { k: 'Estampado', v: 'Liso' },
    { k: 'Color', v: 'Mandarina', hex: '#D44E16', punto: { x: 42, y: 58, lado: 'der' } },
    { k: 'Temporada', v: 'Primavera-verano' },
    { k: 'Ocasión', v: 'Casual, de día' },
    { k: 'Estilo', v: 'Relajado' },
    { k: 'Nombre', v: 'Vestido midi de lino con cinto' },
    { k: 'Descripción', v: 'Vestido midi de lino en mandarina, de cuello redondo y manga corta, con cinto para anudar.', ancho: true },
    { k: 'Composición', v: 'Por confirmar', vacio: true },
    { k: 'Cuidado', v: 'Por confirmar', vacio: true },
  ],
  nota: 'El color es el que se mide en la tela de la foto, con su nombre comercial. La composición y el cuidado salen de la etiqueta: si no se ve, quedan por confirmar.',
};

// Lo que el Estudio hace solo (AltaEstudio), un paso por tramo del scroll.
export const ESTUDIO = [
  { n: '01', t: 'La foto de producto', d: 'Sin gancho ni pared: la prenda limpia, en maniquí invisible.', img: 'producto' },
  { n: '02', t: 'Todos sus colores', d: 'El negro sale de la misma foto, sin otra sesión, marcado como color ilustrativo.', img: 'negro' },
  { n: '03', t: 'En una modelo', d: 'Con la modelo de tu marca: de frente, de 3/4 y de espalda.', img: 'modelo' },
  { n: '04', t: 'En un escenario', d: 'La misma prenda en una locación, lista para tus redes.', img: 'escenario' },
  { n: '05', t: 'Publicada', d: 'En tu caja y tu tienda en línea, con su precio, sus tallas y sus colores. Con tu visto bueno o en automático.', img: 'publicada' },
];

export const AHORRO = {
  h: 'Lo que te ahorras.',
  cols: [
    { big: '4–5 días', t: 'se vuelven unos 30 minutos', d: 'De la caja a la venta, en un lote de 10 prendas.' },
    { big: '19', t: 'de 21 campos, sin teclear', d: 'En este vestido: tipo, corte, tela, color, temporada, ocasión, nombre y descripción salen de la foto. La composición y el cuidado, de la etiqueta.' },
    { big: '1', t: 'foto por prenda', d: 'De ahí salen la de producto, sus colores, la de modelo, la de escenario y las de marketplaces.' },
  ],
};

export const PREGUNTAS_ALTA = [
  { question: '¿Qué necesito?', answer: 'Un celular o una tablet con Sacs, un tripié, luz pareja y un fondo liso. El tripié va a 1–1.5 m de la prenda y tú a un lado: si te pones enfrente, no toma la foto.' },
  { question: '¿Cómo habla con AXO?', answer: 'Por voz, en tiempo real. AXO te dice qué prenda es y te pregunta lo que falta; lo que haya que decidir sale en pantalla con opciones numeradas y contestas hablando («la dos», «es vino»). Tocar la pantalla también sirve.' },
  { question: '¿Qué campos llena solo?', answer: 'Con la foto de la prenda: tipo y corte, género, silueta, largo, tiro, cuello, manga, cierre, tela, peso, caída, elasticidad, estampado, colores con su nombre comercial y su tono medido, detalles, temporada, ocasión, estilo, nombre y descripción. La composición y el cuidado salen de la etiqueta (si subes su foto al Estudio); si no, quedan por confirmar: Sacs no los inventa.' },
  { question: '¿Y si la prenda ya la tengo?', answer: 'AXO la busca en tu catálogo (por el código de la etiqueta o por la foto). Si ya la tienes, la manda a Recepción como pendiente: la existencia cambia hasta que la recibes. Lo nuevo pasa al Estudio.' },
  { question: '¿Quién revisa antes de publicar?', answer: 'Tú eliges: visto bueno por lote, prenda por prenda o automático. En automático solo se publica lo que pasa todas las revisiones; lo que necesita tu ojo espera tu confirmación.' },
  { question: '¿Dónde se publica?', answer: 'En el catálogo de tu caja y en tu tienda en línea de Sacs, con su precio (por tus reglas de margen), sus tallas y sus colores. También quedan listas las fotos para marketplaces (fondo blanco) e historias.' },
  { question: '¿Cuánto cuesta?', answer: 'Cada captura y cada foto usan créditos de IA de tu cuenta, con tope por captura y por prenda. En la demo te decimos qué incluye tu plan.' },
];
