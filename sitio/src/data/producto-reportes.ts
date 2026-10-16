/**
 * /producto/reportes-y-analitica — rediseño con la línea de los plugins (5-oct-2026), como las páginas de «Vende»: se
 * queda el video de arriba y lo demás es nuevo, con entradas y animaciones distintas entre secciones.
 *
 * LO QUE EXISTE (inventario del código de sacs3, sacs_api y SACSMobile, 5-oct-2026) y es lo que la página cuenta:
 *  - Reportes (centro de reportes): «¿Qué necesitas saber?», un buscador por nombre o por lo que quieres lograr («faltantes
 *    de caja», «quién me debe», «qué no se vende», «margen»…; busca por palabras, no es IA), reportes por área y
 *    «Accesos rápidos» con los que más abres.
 *  - Análisis de ventas: sucursal, «Agrupar por» (agente, almacén, artículo, caja, categoría, cliente, marca, proveedor,
 *    SKU, sucursal, tipo de cliente, etiquetas y cada variante: talla y color), 22 métricas (ventas con y sin impuestos,
 *    piezas, costo, descuentos, cheque y canasta promedio, devoluciones, cambios, existencias…) y período (atajos, rango
 *    por día, semana o mes, «⇄ Semana vs anterior», «⇄ Mes vs anterior», «Comparar dos rangos» con su variación);
 *    filtros avanzados (almacén, artículo, categoría, proveedor, marca, ocasión, estilo, cajero, caja, variantes, solo
 *    ventas con descuento); detalle de tickets; «Personalizado» y unos 30 atajos; Excel.
 *  - La ganancia se calcula con el costo ACTUAL del catálogo (no el del día de la venta).
 *  - Reporte de Ventas por producto: una línea por prenda vendida con foto, SKU, fecha y hora, usuario, método, sucursal,
 *    caja, costo, ganancia y margen; filtros, columnas y Excel por bloques.
 *  - Dashboard de Inventario: «ABC Moda (Retail)» (criterio ventas, margen o unidades; clase A/B/C; por sucursal o
 *    producto), productos obsoletos (umbral de riesgo 90 días y obsoleto 180), resumen y rendimiento: edad 0-30 a 90+
 *    días, días sin venta, semáforo, GMROI, sell-through y cobertura. Excel.
 *  - Dashboard: Ventas (KPIs contra el período anterior, métricas de eficiencia, por hora, por sucursal/almacén/caja/
 *    cajero, más vendidos, por promoción, por canal, métodos de pago; «Reporte PDF») e Inventario (valor a costo y a
 *    precio, margen bruto, salud del stock Sano/Riesgo/Obsoleto, desempeño por talla y color —vendido en 90 días contra
 *    existencia— y «Candidatos a liquidación» con su capital atrapado y un precio sugerido 30 % abajo).
 *  - AXO: contesta preguntas sobre tus datos con tablas y gráficas; «🔁 Rutinas — Reportes que se arman solos y te llegan
 *    por correo» (diseños Ejecutivo, Detalle, Pulso, Corte de caja y Comparativo; recetas «Ventas del día», «Cobranza de
 *    los lunes», «Corte de caja», «Última pieza que sí rota», «Sucursal contra sucursal»; diario, semanal o al cerrar cada
 *    corte); radares «avísame si…» (en la campana de Sacs); preguntas por WhatsApp. En el celular (SACSMobile), el
 *    resumen y AXO.
 *  - VISIÓN (dueño, 5-oct-2026: «sácalo como si existiría»): el sell-through en una sola matriz de estilo × talla ×
 *    color × tienda (hoy: por producto y sucursal en Rendimiento, y vendido contra existencia por talla y color en el
 *    tablero). Va dibujado y marcado «Ejemplo»; sin testimonios, clientes, cifras de resultados ni certificaciones.
 * Pantallas: recortes REALES de la cuenta demo (andyaraujoconsultorias), 5-oct-2026, SOLO con las sucursales de la red
 * Polanco Boutique elegidas a mano (Polanco Boutique, SMA Centro, Querétaro Antea, León Altacia): nada de otras redes.
 * Nombres de personas y marcas reales cambiados en pantalla. Fotos: gpt-image-2.5 (la reunión) y fotos del sitio.
 */

export const I = '/images/producto/reportes-y-analitica/';
const TIE = '/images/producto/tienda-en-linea/';
const FAC = '/images/producto/facturacion-electronica/';

export interface Pieza { id: string; t: string; d: string; img?: string; w?: number; h?: number; tono: 'negro' | 'fucsia' | 'marfil' | 'marino' | 'azul'; ancha?: boolean; alta?: boolean; cubre?: boolean; dibujo?: 'rp-matriz' | 'rp-abc' | 'rp-edad' | 'rp-rutina' }

// Rejilla de escritorio (4 columnas, 12 celdas): la búsqueda (2) · la matriz (alta) · ABC | los cuatro pasos (2) · · edad |
// liquidación · cada prenda · rutinas (2).
export const INCLUYE: { folio: [string, string]; titulo: string; intro: string; piezas: Pieza[] } = {
  folio: ['01', 'Todo lo que incluye'],
  titulo: 'Lo que vendes, lo que no y lo que te deja.',
  intro: 'Ventas por talla, color o vendedor; el ABC de tu inventario, su edad y lo que hay que rematar. Y el reporte que quieras, en tu correo antes de abrir.',
  piezas: [
    { id: 'rep-pregunta', t: 'Pregunta en tus palabras', d: '«Qué no se vende», «quién me debe», «faltantes de caja».', img: `${I}pantalla-busca.webp`, w: 1400, h: 760, tono: 'azul', ancha: true },
    { id: 'rep-talla', t: 'Sell-through por talla', d: 'Por estilo, talla, color y tienda.', dibujo: 'rp-matriz', tono: 'fucsia', alta: true },
    { id: 'rep-abc', t: 'ABC de moda', d: 'Por ventas, por margen o por unidades.', dibujo: 'rp-abc', tono: 'marfil' },
    { id: 'rep-arma', t: 'Tu reporte en cuatro pasos', d: 'Sucursal, cómo agrupar, qué medir y el período. Y lo comparas.', img: `${I}pantalla-armado.webp`, w: 1400, h: 520, tono: 'marino', ancha: true },
    { id: 'rep-abc', t: 'La edad de cada prenda', d: 'De 0 a 30 días hasta 90 y más.', dibujo: 'rp-edad', tono: 'negro' },
    { id: 'rep-liquida', t: 'Qué rematar', d: 'Con su capital atrapado y su precio sugerido.', img: `${I}pantalla-liquidacion.webp`, w: 900, h: 760, tono: 'marfil' },
    { id: 'rep-prenda', t: 'Cada prenda vendida', d: 'Foto, SKU, hora, vendedor y margen.', img: `${I}pantalla-prendas.webp`, w: 1400, h: 760, tono: 'fucsia' },
    { id: 'rep-rutinas', t: 'Te llega por correo', d: 'El reporte se arma solo: diario, cada semana o al cerrar la caja.', dibujo: 'rp-rutina', tono: 'azul', ancha: true },
  ],
};

// «Una pregunta, una respuesta» con el scroll: la pregunta se escribe sola y la pantalla REAL que la contesta.
export const PREGUNTA = {
  k: 'Una pregunta, una respuesta',
  h: 'Pregúntale a tu negocio.',
  tramos: [
    { n: '01', q: '¿Dónde veo lo que no se vende?', t: 'Escríbelo como lo dirías', d: 'El buscador de Reportes entiende «qué no se vende», «quién me debe» o «faltantes de caja» y te pone enfrente el reporte que lo contesta.', img: `${I}pantalla-busca.webp`, w: 1400, h: 760, alt: 'Reportes: el buscador con «qué no se vende» escrito y los reportes que lo contestan, con lo que trae cada uno' },
    { n: '02', q: '¿Qué talla se vende más?', t: 'Cuatro pasos y listo', d: 'Las sucursales, agrupar por talla, la métrica y el período. Un clic en «Generar reporte».', img: `${I}pantalla-talla.webp`, w: 1400, h: 860, alt: 'Análisis de ventas agrupado por talla en las cuatro sucursales: la venta de cada talla, día por día' },
    { n: '03', q: '¿Vendimos más que la semana pasada?', t: 'Compara dos períodos', d: 'Semana contra semana, mes contra mes o dos rangos que tú elijas, con su variación.', img: `${I}pantalla-compara.webp`, w: 1400, h: 860, alt: 'Análisis de ventas comparando dos semanas: cada talla con su venta en cada semana y la variación' },
    { n: '04', q: '¿Qué me está cargando el inventario?', t: 'Cada prenda, con su letra', d: 'El ABC de moda por ventas, margen o unidades, y cuántos días lleva cada prenda sin venderse.', img: `${I}pantalla-abc.webp`, w: 1400, h: 860, alt: 'Dashboard de Inventario: el ABC de moda de la boutique, cada prenda con su clase A, B o C' },
    { n: '05', q: '¿Qué remato?', t: 'Candidatos a liquidación', d: 'Lo que ya no rota, con el capital que tiene atrapado y un precio sugerido para sacarlo.', img: `${I}pantalla-liquidacion.webp`, w: 900, h: 760, alt: 'Candidatos a liquidación: las prendas que no rotan, con su capital atrapado y su precio sugerido' },
    { n: '06', q: '¿Me lo mandas cada lunes?', t: 'Que te llegue solo', d: 'Con las rutinas de AXO, el reporte se arma solo y te llega por correo: diario, cada semana o al cerrar cada corte.', alt: '' },
  ],
};

// «Tu reporte, en cuatro pasos»: el Análisis de ventas, con sus opciones reales que van rodando.
export const ARMA = {
  k: 'Análisis de ventas',
  h: 'Tu reporte, en cuatro pasos.',
  p: 'Un solo reporte para ver tus ventas desde cualquier ángulo: quién vende, qué se vende, dónde y cuánto te deja. Los que más abres se quedan en tus accesos rápidos.',
  pasos: [
    { t: 'Sucursal', v: ['Polanco Boutique', 'SMA Centro', 'Querétaro Antea', 'León Altacia', '4 sucursales'] },
    { t: 'Agrupar por', v: ['Variante: TALLA', 'Variante: COLOR', 'Categoría', 'Marca', 'Proveedor', 'Agente'] },
    { t: 'Métrica', v: ['Ventas con impuestos', 'Cantidad de productos vendidos', 'Cheque promedio', 'Descuentos', '% de devoluciones', 'Existencias'] },
    { t: 'Período', v: ['Últimos 7 días', 'Este mes', '⇄ Semana vs anterior', '⇄ Mes vs anterior', 'Comparar dos rangos'] },
  ],
  cuentas: [
    { v: '22', t: 'métricas' },
    { v: '16', t: 'formas de agrupar, con talla y color' },
    { v: '30', t: 'reportes listos de un clic' },
  ],
  puntos: [
    { t: 'Filtros avanzados', d: 'Almacén, proveedor, marca, ocasión, estilo, cajero o solo las ventas con descuento.' },
    { t: 'Del total al ticket', d: 'Abres cualquier cifra y ves los tickets que la forman.' },
    { t: 'Ganancia y margen', d: 'Con el costo de tu catálogo, en la misma tabla.' },
  ],
};

// «La talla que sí se vende»: la matriz de sell-through (dibujo, valores de ejemplo) y el tablero real por talla y color.
export const TALLA = {
  k: 'Sell-through',
  h: 'La talla que sí se vende.',
  p: 'De lo que compraste, cuánto ya vendiste: por estilo, talla, color y tienda. Para pedir la curva que sí sale y mover la que se queda.',
  tallas: ['XS', 'S', 'M', 'L', 'XL'],
  estilos: ['Blazer sastre cruzado', 'Vestido midi de lino', 'Jeans recto tiro alto', 'Camisa de popelina', 'Falda plisada'],
  // sell-through de ejemplo (%) por tienda: una fila por estilo, una columna por talla
  tiendas: [
    { t: 'Polanco Boutique', m: [[38, 82, 91, 74, 22], [55, 88, 79, 61, 30], [41, 77, 93, 85, 48], [63, 71, 66, 52, 19], [72, 90, 58, 34, 12]] },
    { t: 'SMA Centro', m: [[24, 61, 84, 88, 45], [70, 93, 81, 49, 18], [33, 58, 76, 92, 67], [48, 80, 72, 61, 27], [59, 74, 66, 41, 21]] },
    { t: 'Querétaro Antea', m: [[45, 79, 70, 52, 15], [62, 71, 90, 77, 36], [28, 66, 88, 81, 54], [71, 86, 59, 44, 23], [81, 69, 47, 29, 10]] },
    { t: 'León Altacia', m: [[19, 52, 77, 83, 61], [44, 68, 73, 85, 52], [37, 72, 81, 69, 39], [56, 63, 78, 66, 31], [64, 83, 71, 38, 17]] },
  ],
  puntos: [
    { t: 'Vendido contra existencia', d: 'Cada talla y cada color: lo vendido en 90 días frente a lo que te queda.' },
    { t: 'Por tienda', d: 'La misma talla se vende distinto en cada sucursal.' },
    { t: 'Para comprar y mover', d: 'Pides la curva que sí sale y mueves la que se queda.' },
  ],
};

// «Cada prenda, con su letra»: el Dashboard de Inventario (ABC Moda, edad, GMROI, sell-through, cobertura).
export const ABC = {
  k: 'Dashboard de Inventario',
  h: 'Cada prenda, con su letra.',
  p: 'El ABC de moda clasifica tu inventario por lo que vende, por lo que te deja o por las piezas que mueve. Y a cada prenda le pone su edad.',
  letras: [
    { l: 'A', t: 'Lo que más te deja', d: 'Que nunca le falte su talla.' },
    { l: 'B', t: 'Lo de en medio', d: 'Vigílalo: puede subir o bajar.' },
    { l: 'C', t: 'Lo que menos', d: 'No lo vuelvas a pedir igual.' },
  ],
  edad: [
    { t: '0-30 días', v: 46 },
    { t: '31-60', v: 27 },
    { t: '61-90', v: 15 },
    { t: '90+ días', v: 12 },
  ],
  glosario: [
    { t: 'GMROI', d: 'Cuánto margen te deja cada peso que tienes en inventario.' },
    { t: 'Sell-through', d: 'De lo que compraste, cuánto ya vendiste.' },
    { t: 'Cobertura', d: 'Para cuántos días te alcanza lo que tienes.' },
    { t: 'Semáforo', d: 'Sano, en riesgo (90 días) u obsoleto (180). Los días los pones tú.' },
  ],
};

// «Lo que hay que rematar»: candidatos a liquidación del tablero de Inventario.
export const LIQUIDA = {
  k: 'Candidatos a liquidación',
  h: 'Sabes qué rematar, y a cuánto.',
  p: 'En el tablero de Inventario: las prendas que ya no rotan, con el capital que tienen atrapado y un precio sugerido para sacarlas. Antes de rebajar, prueba moverlas a la tienda donde sí se venden.',
  salud: [
    { t: 'Sano', c: '#1F9D63' },
    { t: 'Riesgo', c: '#E09B2D' },
    { t: 'Obsoleto', c: '#D64545' },
  ],
  ligas: [
    { t: 'Rebájalas con una promoción', href: '/producto/promociones' },
    { t: 'O muévelas con nivelación', href: '/producto/nivelacion-de-inventario' },
  ],
  foto: { src: `${TIE}duena-1280.webp`, srcset: `${TIE}duena-900.webp 900w, ${TIE}duena-1280.webp 1280w`, w: 1280, h: 853, alt: 'La dueña revisa su inventario en la laptop, en la mesa de la boutique' },
};

// «Tu día, en una pantalla»: el Dashboard de ventas.
export const TABLERO = {
  k: 'Dashboard',
  h: 'Tu día, en una pantalla.',
  p: 'Ventas, tickets y margen contra el período anterior. Por hora, por sucursal, por canal y por método de pago. Y en PDF para la junta.',
  chips: ['Canasta promedio', 'Cheque promedio', 'Unidades por ticket', 'Margen de utilidad', 'Tickets con descuento'],
  foto: { src: `${I}reunion-1280.webp`, srcset: `${I}reunion-900.webp 900w, ${I}reunion-1280.webp 1280w, ${I}reunion-1536.webp 1536w`, w: 1536, h: 1024, alt: 'La dueña y su equipo revisan las ventas de la semana en la laptop, sobre la mesa de la boutique' },
};

// «Cada prenda vendida»: Reporte de Ventas por producto y el Excel.
export const PRENDA = {
  k: 'Reporte de Ventas por producto',
  h: 'Cada prenda vendida, con su foto.',
  p: 'Una línea por prenda: SKU, fecha y hora, quién la vendió, cómo la pagaron, en qué sucursal y caja, su costo, su ganancia y su margen.',
  puntos: [
    { t: 'Filtros', d: 'Por origen de la venta, método de pago o rango de descuento.' },
    { t: 'Columnas', d: 'Ves solo las que necesitas.' },
    { t: 'A Excel', d: 'Con los mismos filtros; los reportes grandes bajan por bloques.' },
  ],
};

// «Que el reporte te busque a ti»: las rutinas de AXO (dibujo con sus textos reales) y lo que llega al correo.
export const RUTINAS = {
  k: 'AXO · Rutinas',
  h: 'Que el reporte te busque a ti.',
  p: 'Le pides el reporte a AXO una vez y se arma solo. Te llega por correo diario, cada semana o cada vez que cierras un corte.',
  recetas: [
    { t: 'Ventas del día', d: 'Cada mañana, cómo cerró ayer cada sucursal.', cada: 'Diario · 8:00' },
    { t: 'Cobranza de los lunes', d: 'Quién te debe y cuánto, para arrancar la semana.', cada: 'Lunes · 9:00' },
    { t: 'Corte de caja', d: 'El corte, en cuanto se cierra.', cada: 'Al cerrar cada corte' },
    { t: 'Última pieza que sí rota', d: 'Lo que se vende y está por acabarse.', cada: 'Semanal' },
    { t: 'Sucursal contra sucursal', d: 'Tus tiendas, lado a lado.', cada: 'Semanal' },
  ],
  disenos: ['Ejecutivo', 'Detalle', 'Pulso', 'Corte de caja', 'Comparativo'],
  bandeja: [
    { de: 'AXO · Sacs', t: 'Ventas del día', d: 'Polanco Boutique, SMA Centro, Querétaro Antea y León Altacia', h: '8:00' },
    { de: 'AXO · Sacs', t: 'Corte de caja · SMA Centro', d: 'Efectivo esperado contra contado', h: '21:12' },
    { de: 'AXO · Sacs', t: 'Sucursal contra sucursal', d: 'La semana, tienda por tienda', h: 'Lun' },
  ],
  extra: [
    { t: 'Pregúntale lo que sea', d: 'AXO te contesta con una tabla o una gráfica, y la bajas en CSV.' },
    { t: 'Avísame si…', d: 'Una tienda va abajo de su ritmo o se agotó lo que más vendes: te avisa en Sacs.' },
    { t: 'También por WhatsApp', d: '«¿Cuánto vendimos hoy?» y te contesta. O te manda el corte en PDF.' },
  ],
  foto: { src: `${TIE}noche-1280.webp`, srcset: `${TIE}noche-900.webp 900w, ${TIE}noche-1280.webp 1280w`, w: 1280, h: 853, alt: 'La dueña revisa en su celular, ya en casa, cómo le fue a la tienda' },
};

export const FOTO_NOCHE = { src: `${FAC}noche-1280.webp`, srcset: `${FAC}noche-900.webp 900w, ${FAC}noche-1280.webp 1280w`, w: 1280, h: 853 };

export const RESUELVE = {
  folio: ['Lo que resuelve', 'En tu oficina'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'Esperar al cierre de mes para saber cómo te fue.',
    'Volver a pedir la talla que no se vendió.',
    'Rebajar a ciegas al final de la temporada.',
    'Armar a mano, en Excel, el reporte de la junta.',
    'Enterarte tarde de que una tienda se quedó atrás.',
  ],
};

export const PREGUNTAS = [
  { question: '¿Los reportes son en tiempo real?', answer: 'Sí. Cada reporte lee tus ventas y tu inventario en el momento en que lo generas, de todas tus sucursales y canales.' },
  { question: '¿Puedo armar mis propios reportes?', answer: 'Sí. En «Análisis de ventas» eliges las sucursales, cómo agrupar (talla, color, categoría, marca, proveedor, vendedor…), la métrica y el período, y lo comparas contra otro período. Y si prefieres preguntar, AXO te contesta con una tabla o una gráfica.' },
  { question: '¿Me pueden llegar los reportes por correo?', answer: 'Sí. Con las rutinas de AXO eliges el reporte, su diseño (Ejecutivo, Detalle, Pulso, Corte de caja o Comparativo) y cada cuándo te llega: diario, cada semana o al cerrar cada corte.' },
  { question: '¿Con qué costo calcula la ganancia?', answer: 'Con el costo que tiene hoy cada producto en tu catálogo. Si lo actualizas, la ganancia y el margen de tus reportes se recalculan con el nuevo costo.' },
  { question: '¿Qué es el ABC de moda?', answer: 'Una clasificación de tus prendas: A, las que más te dejan; B, las de en medio, y C, las que menos. La calculas por ventas, por margen o por unidades, por sucursal o por producto, junto con la edad de cada prenda, su GMROI y su sell-through.' },
  { question: '¿Puedo bajarlos a Excel?', answer: 'Sí, con los mismos filtros que ves en pantalla; los reportes grandes se descargan por bloques. El dashboard sale en PDF para imprimirlo o mandarlo.' },
  { question: '¿Quién puede ver los reportes?', answer: 'Tú decides qué reportes ve cada persona de tu equipo con sus permisos.' },
  { question: '¿Funciona en el celular?', answer: 'Sí. En la app de Sacs para el celular ves el resumen del día por sucursal y le preguntas a AXO lo que quieras. También por WhatsApp.' },
];
