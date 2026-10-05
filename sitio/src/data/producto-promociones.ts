/**
 * /producto/promociones — rediseño con la línea de los plugins (5-oct-2026), como /producto/punto-de-venta: se queda el
 * video de arriba y lo demás es nuevo, con entradas y animaciones distintas entre secciones.
 *
 * LO QUE EXISTE (inventario del código de sacs3, sacs_api, SACSMobile y la tienda en línea, 5-oct-2026):
 *  - Promociones de la caja (Promociones › Nueva Promoción): Básico (porcentaje o importe, por pieza o al total; todo el
 *    catálogo o productos, variantes, marcas, categorías con sus subcategorías, etiquetas, proveedores; con exclusiones),
 *    Avanzado (cuando compre N piezas o gaste $X → piezas gratis (la más barata o una específica: 2x1, 3x2, regalo),
 *    descuento en la venta o en productos, o precio menor por pieza; «no aplicar con otras promociones») y Progresivo
 *    (descuento por número de pieza del mismo SKU, con niveles y «repetir último nivel»). Sucursales por promoción,
 *    estado Borrador/Activo, fecha de inicio y fin (o sin fin). VIP: horario diario y disponibilidad diaria, semanal
 *    (días) o mensual. Objetivos: para todos, por grupo de clientes o con código de promoción. Validación de margen (VIP).
 *  - En la caja se aplican solas al armar la venta: precio tachado, el nuevo y la tira con el nombre de la promoción; el
 *    aviso al cajero «Promoción por desbloquear» cuando le falta algo a la clienta; el regalo a elegir; la pestaña
 *    «Cupón» (códigos de promoción, de venta cruzada y cupones de correo). El ticket puede llevar el nombre de la promo y
 *    «Ahorraste $X».
 *  - Venta cruzada: un código de descuento impreso en el ticket para la siguiente visita (por categoría, marca o
 *    etiqueta; umbral, %, vigencia, usos), con métricas (generados, canjeados, ingresos, tasa de canje).
 *  - Ventas de impulso: al cobrar, una campaña sugiere hasta 5 productos; desempeño por vendedor; VIP: monitoreo de
 *    cajeros, ranking y comparativa de campañas.
 *  - Reportes: «Ventas por promoción» en el tablero; promociones por vendedor y por sucursal; descuentos en Transacciones.
 *  - Tienda en línea: módulo propio «Cupones y promociones» (porcentaje, monto fijo, envío gratis, BOGO, por volumen, por
 *    niveles; automática o con cupón; horario recurrente; límite de usos; tope de pérdida que la pausa; plantillas;
 *    rueda de premios; QR por código).
 *  - Celular: SACSMobile aplica solas las básicas; las demás las avisa para aplicarlas a mano.
 *  - NO existe, y no se anuncia: puntos de lealtad desde una promoción (es «Próximamente»; los puntos extra viven en el
 *    programa de lealtad), un uso por clienta en códigos de la caja (no se respeta), tope de piezas o presupuesto en las
 *    promos de la caja, que las promos de la caja apliquen en la tienda en línea, colecciones como objetivo, hora de
 *    inicio exacta (la fecha sí; la hora de fin sí).
 * Pantallas: formulario REAL de «Nueva Promoción» de la cuenta demo (nada se guardó). La caja, el aviso, el ticket, la
 * sugerencia de impulso y el reporte van dibujados con el diseño y los textos reales de Sacs (en la cuenta demo no hay
 * promociones corriendo). Fotos: gpt-image-2.5.
 */

export const I = '/images/producto/promociones/';

export interface Pieza { id: string; t: string; d: string; img?: string; w?: number; h?: number; tono: 'negro' | 'fucsia' | 'marfil' | 'marino' | 'azul'; ancha?: boolean; alta?: boolean; cubre?: boolean; dibujo?: 'cupon' | 'reloj' | 'factura' | 'liga' | 'sobre' | 'reglas' | 'precio' | 'boleto' | 'margen' | 'barras' | 'impulso'; fotos?: string[] }

export const INCLUYE: { folio: [string, string]; titulo: string; intro: string; piezas: Pieza[] } = {
  folio: ['01', 'Todo lo que incluye'],
  titulo: 'Promociones que se aplican solas.',
  intro: 'Las armas una vez y Sacs las aplica en la caja de cada sucursal que elijas. Tu cajero no tiene que acordarse de nada.',
  piezas: [
    { id: 'pro-tipos', t: 'Tres mecánicas', d: 'Descuento directo, 2x1 o regalo, y más descuento por pieza.', img: `${I}pantalla-basico.webp`, w: 1100, h: 917, tono: 'fucsia', ancha: true },
    { id: 'pro-dia', t: 'Arranca y termina sola', d: 'Con su fecha y, en VIP, su horario y sus días.', dibujo: 'reloj', tono: 'azul', alta: true },
    { id: 'pro-dia', t: 'Sola en la caja', d: 'Precio tachado y el nombre de la promo en cada prenda.', dibujo: 'precio', tono: 'marfil' },
    { id: 'pro-codigos', t: 'Cupones y grupos', d: 'Para todas, solo tus VIP o con su código.', dibujo: 'cupon', tono: 'negro' },
    { id: 'pro-cruzada', t: 'El ticket que la trae de vuelta', d: 'Un código para su siguiente visita.', dibujo: 'boleto', tono: 'negro' },
    { id: 'pro-impulso', t: 'Ventas de impulso', d: 'Al cobrar, Sacs sugiere hasta 5 productos.', dibujo: 'impulso', fotos: [`${I}prenda-rosa.webp`, `${I}prenda-amarilla.webp`, `${I}prenda-azul.webp`], tono: 'fucsia' },
    { id: 'pro-online', t: 'En tu tienda en línea', d: 'Cupones, envío gratis, BOGO y descuentos por volumen, con su propio módulo.', img: `${I}online-900.webp`, w: 900, h: 600, tono: 'marino', ancha: true, cubre: true },
    { id: 'pro-margen', t: 'Cuida tu margen', d: 'Antes de guardar, Sacs revisa el margen (VIP).', dibujo: 'margen', tono: 'azul' },
    { id: 'pro-margen', t: 'Qué promo vendió', d: 'Ventas, unidades y transacciones por promoción.', dibujo: 'barras', tono: 'marfil' },
  ],
};

// «Un día de promociones» con el scroll: el reloj avanza de las 10:00 a las 21:30 y el día se vuelve noche.
export const DIA = {
  k: 'Un día de promociones',
  h: 'Nadie tiene que acordarse.',
  tramos: [
    { hora: '10:00', t: 'Abre la tienda y la promo ya está', d: '«Fin de temporada» se activó sola en las sucursales que elegiste, con su fecha de inicio.', foto: 'dia' },
    { hora: '12:30', t: 'En la caja, sin teclear nada', d: 'Al escanear la prenda sale su precio tachado, el nuevo y el nombre de la promoción.', foto: 'caja' },
    { hora: '13:15', t: 'El cajero sabe qué ofrecer', d: 'Si a la clienta le falta una prenda para su 3x2, Sacs le avisa al cajero qué decirle.', foto: 'caja' },
    { hora: '18:00', t: 'Martes de 6 a 9: arranca sola', d: 'Con el plan VIP, las promociones con horario y días se prenden y se apagan solas.', foto: 'noche' },
    { hora: '21:30', t: 'Y en la noche, sabes qué vendió', d: 'Ventas, unidades y transacciones de cada promoción, en tu tablero.', foto: 'noche' },
  ],
};

// «Tres mecánicas»: los tres tipos REALES del formulario, cada uno con su pantalla y sus recetas.
export const TIPOS = {
  k: 'Promociones › Nueva Promoción',
  h: 'Las promos que ya haces. Sin calculadora.',
  p: 'Eliges la mecánica, a qué productos aplica y en qué sucursales. Lo demás lo hace la caja.',
  tipos: [
    { t: 'Básico', d: 'Descuento directo en porcentaje o importe fijo.', recetas: ['30 % en toda la colección', '$200 menos por pieza', 'Solo vestidos, o lo que elijas'], img: `${I}pantalla-basico.webp`, w: 1100, h: 917, alt: 'Nueva Promoción, tipo Básico: descuento en porcentaje o importe y los productos a los que aplica (todo el catálogo o específicos)' },
    { t: 'Avanzado', d: 'Descuento o regalo según lo que compran o cuánto gastan.', recetas: ['3x2: la más barata, gratis', '2x1 y regalo con tu compra', 'Gasta $2,000 y llévate un descuento', 'Precio especial por pieza'], img: `${I}pantalla-avanzado.webp`, w: 1100, h: 837, alt: 'Nueva Promoción, tipo Avanzado: cuando un cliente compre 3 piezas, se lleva 1 gratis, la más barata (un 3x2)' },
    { t: 'Progresivo', d: 'Descuentos crecientes por cada pieza adicional del mismo producto.', recetas: ['2.ª pieza 10 %, 3.ª 20 %, 4.ª 30 %', 'Por categoría, marca o etiqueta', 'Repite el último nivel'], img: `${I}pantalla-progresivo.webp`, w: 1100, h: 700, alt: 'Nueva Promoción, tipo Progresivo: niveles de descuento por pieza: la 2.ª con 10 %, la 3.ª con 20 % y la 4.ª con 30 %' },
  ],
  extra: ['Por productos, variantes, marcas, categorías, etiquetas o proveedor', 'Con exclusiones', 'Sucursales por promoción', 'Borrador o activa'],
};

// «Para todas o solo para algunas»: objetivos y códigos.
export const CODIGOS = {
  k: 'Objetivos y cupones',
  h: 'Para todas, o solo para algunas.',
  p: 'Una promoción puede ser para cualquiera que entre a la tienda, solo para un grupo de clientes o solo con su código.',
  codigo: 'VIP-15',
  opciones: [
    { t: 'Disponible para todos', d: 'Todos los clientes pueden recibir esta promoción.' },
    { t: 'Por grupo de clientes', d: 'Tus VIP, mayoristas o el grupo que tú armes.' },
    { t: 'Con código', d: 'En la caja, en la pestaña «Cupón»; también valen los cupones de correo y los de venta cruzada.' },
  ],
  correo: 'Con el marketing por correo, cada clienta recibe su propio cupón, de un solo uso, que vale en tu tienda en línea y en la caja.',
};

// «El ticket que la trae de vuelta»: venta cruzada.
export const CRUZADA = {
  k: 'Venta cruzada',
  h: 'El ticket que la trae de vuelta.',
  p: 'Si compra lo que tú definas (por categoría, marca o etiqueta), su ticket sale con un código de descuento para su siguiente visita.',
  ticket: { codigo: 'VC-8K2M4Q', pct: '15', vence: '20/10/2026' },
  ajustes: ['Desde cuántas piezas', 'El % de descuento', 'Días de vigencia', 'Usos por código', 'Público en general o solo registrados', 'Solo o acumulable'],
  metricas: ['Generados', 'Canjeados', 'Ingresos', 'Tasa de canje', 'Por sucursal', 'Por cajero'],
};

// «Al cobrar, una sugerencia»: ventas de impulso.
export const IMPULSO = {
  k: 'Ventas de impulso',
  h: 'Al cobrar, una sugerencia.',
  p: 'Armas una campaña con hasta 5 productos y, cuando el cajero presiona «Cobrar», aparecen para ofrecerlos. Con un toque se suman a la venta.',
  campana: { t: 'Completa el look', d: 'Tops de temporada, a un lado de la caja.' },
  prendas: [
    { img: `${I}prenda-rosa.webp`, t: 'Camiseta ajustada margarita rosa', n: 6 },
    { img: `${I}prenda-amarilla.webp`, t: 'Camiseta sin mangas de punto', n: 4 },
    { img: `${I}prenda-tirantes.webp`, t: 'Top de tirantes estampado', n: 9 },
    { img: `${I}prenda-azul.webp`, t: 'Camiseta estampada azul', n: 3 },
  ],
  puntos: [
    { t: 'Desempeño por vendedor', d: 'Cuánto vendió cada campaña y quién la ofreció.' },
    { t: 'VIP: que sí la ofrezcan', d: 'Si un cajero cierra la sugerencia antes de tiempo, queda registrado.' },
    { t: 'VIP: ranking y comparativa', d: 'Tus mejores vendedores de impulso y qué campaña funcionó más.' },
  ],
};

// «Cuida tu margen. Mide cada promo.»: validación de margen (VIP) y reportes.
export const MARGEN = {
  k: 'Margen y reportes',
  h: 'Cuida tu margen. Mide cada promo.',
  p: 'Antes de guardar, Sacs revisa que el descuento no deje una prenda por debajo del margen mínimo que pusiste. Y después, sabes qué vendió cada promoción.',
  // el aviso real lista solo lo que queda por debajo del umbral, de más a menos riesgo (crítico, alto, medio)
  aviso: '3 productos tienen margen por debajo del umbral configurado:',
  filas: [
    { p: 'Blazer sastre cruzado', o: 'Categoría', m: '12 %', u: '30 %', r: 'Crítico' },
    { p: 'Camiseta ajustada margarita', o: 'Marca', m: '22 %', u: '30 %', r: 'Alto' },
    { p: 'Vestido de punto manga larga', o: 'Global', m: '27 %', u: '30 %', r: 'Medio' },
  ],
  reportes: [
    { t: 'Ventas por promoción', d: 'En tu tablero: ventas, unidades y transacciones de cada una, contra el periodo anterior.' },
    { t: 'Por vendedor y por sucursal', d: 'Quién vende con promoción y dónde.' },
    { t: 'Descuentos en Transacciones', d: 'Las ventas con descuento, en su propia pestaña.' },
  ],
};

// «En tu tienda en línea»: el módulo propio de la tienda.
export const ONLINE = {
  k: 'Tienda en línea',
  h: 'Y en tu tienda en línea, también.',
  p: 'La tienda en línea tiene su propio módulo de cupones y promociones, con lo que se usa en línea.',
  tipos: ['Porcentaje', 'Monto fijo', 'Envío gratis', 'BOGO', 'Por volumen', 'Por niveles'],
  puntos: [
    { t: 'Automática o con cupón', d: 'Un código único o una lista de códigos.' },
    { t: 'Con sus límites', d: 'Monto mínimo, usos totales y un tope de pérdida que la pausa sola.' },
    { t: 'Plantillas', d: 'Buen Fin, Hot Sale, Black Friday, Día de las Madres y más.' },
    { t: 'Rueda de premios y QR', d: 'Para tus redes y tu aparador.' },
  ],
};

export const RESUELVE = {
  folio: ['Lo que resuelve', 'En tus promociones'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'La promo que se le olvidó al cajero.',
    'El 3x2 que cada quien cobra distinto.',
    'El descuento que se quedó prendido una semana de más.',
    'La promoción que no sabes si funcionó.',
    'El código de Instagram que nadie sabe cómo aplicar.',
  ],
};

export const PREGUNTAS = [
  { question: '¿Qué tipos de promoción puedo hacer?', answer: 'Tres: Básico (descuento en porcentaje o importe), Avanzado (2x1, 3x2, regalo con tu compra o precio especial, según las piezas que lleven o lo que gasten) y Progresivo (más descuento por cada pieza adicional del mismo producto).' },
  { question: '¿Puedo programar promociones por fecha, horario o días?', answer: 'Sí. Todas llevan fecha de inicio y de fin (o sin fecha final). Con el plan VIP activas la disponibilidad automática y les pones horario diario y días de la semana o del mes.' },
  { question: '¿Puedo elegir en qué sucursales aplica?', answer: 'Sí. Cada promoción tiene sus sucursales: puede correr en todas o solo en las que elijas.' },
  { question: '¿Puedo dar una promoción solo a ciertas clientas?', answer: 'Sí: a un grupo de clientes (tus VIP, por ejemplo) o con un código que se aplica en la pestaña «Cupón» de la caja.' },
  { question: '¿Las promociones funcionan en la tienda en línea?', answer: 'La tienda en línea tiene su propio módulo de cupones y promociones (porcentaje, monto fijo, envío gratis, BOGO, por volumen y por niveles, automáticas o con cupón). Las de la caja se configuran aparte.' },
  { question: '¿Y desde el celular?', answer: 'En la app de Sacs para el celular, las promociones básicas se aplican solas; las avanzadas y las progresivas te las avisa para que las apliques a mano.' },
  { question: '¿Puedo dar puntos de lealtad con una promoción?', answer: 'Los puntos extra (dobles por categoría o por temporada) se configuran en el programa de lealtad de Sacs.' },
  { question: '¿Cómo sé si una promoción funcionó?', answer: 'En tu tablero, «Ventas por promoción» te dice las ventas, unidades y transacciones de cada una; y tienes reportes de promociones por vendedor y por sucursal.' },
];
