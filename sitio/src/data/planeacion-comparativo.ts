/**
 * El comparativo de /planeacion-de-demanda (2-oct-2026): Sacs frente a Analyticalways, Celes y Sizes and Colors.
 *
 * De dónde sale cada celda:
 *  - Sacs: el motor de Demand Planning de sacs_api — el catálogo de reglas (lib/moda/reglas.lib.js) y el Forecasting
 *    que entró el 2-oct-2026 (DP3: lib/moda/pronostico.lib.js, plan-temporada.lib.js y calendario.lib.js). Lo que aún
 *    no está va como 'obra' (asterisco, «en construcción»), nunca como incluido. Desde el 3-oct-2026 medir la
 *    exactitud del pronóstico («¿le atinamos?», contra la foto del plan) ya está en producción: dejó de ser obra.
 *  - Competidores: solo lo que publican en sus sitios y materiales, consultados el 2-oct-2026 (análisis completo con
 *    citas en la sesión; las páginas principales van en FUENTES). Si no lo dicen, 'nd' (sin información pública): no se
 *    adivina ni se pone «No» por no encontrarlo. Analyticalways y Celes no son punto de venta ni tienda en línea
 *    («se integra con el ERP y el TPV del retailer», «una capa de AI sobre tu stack actual»).
 *  - Filas justas: el plan financiero semanal de Analyticalways (ahí gana) y la exactitud medida (hasta el 2-oct
 *    ganaba Celes; desde el 3-oct empatan). Una comparativa que solo gana es una que nadie cree.
 *  - Nada de los clientes de los competidores en la página (uno de los casos publicados de Celes es un prospecto de
 *    Sacs: la web no lo nombra).
 *
 * Valores: 'full' sí · 'partial' parcial · 'none' no · 'obra' en construcción (solo Sacs) · 'nd' sin información pública.
 */
export type Celda = 'full' | 'partial' | 'none' | 'obra' | 'nd';
export type Fila = { t: string; n?: string; v: [Celda, Celda, Celda, Celda] };

export const COLUMNAS = ['Sacs', 'Analyticalways', 'Celes', 'Sizes and Colors'] as const;

export const GRUPOS: { t: string; filas: Fila[] }[] = [
  { t: 'Antes de la temporada', filas: [
    { t: 'Habla moda: temporada, básico o de temporada, tallas núcleo', n: 'Clasifica tu catálogo solo y tú confirmas lo que tenga duda.', v: ['full', 'partial', 'nd', 'partial'] },
    { t: 'Curva de tallas por región y tienda', n: 'El Norte vende más L y XL; el Centro, más M.', v: ['full', 'full', 'nd', 'partial'] },
    { t: '¿Evento o demanda real?', n: 'Un pico raro te lo pregunta antes de inflar el pronóstico.', v: ['full', 'partial', 'full', 'nd'] },
    { t: 'Pronóstico de la temporada por modelo, tienda y talla', n: 'Con el mismo evento del año anterior y la tendencia de las últimas semanas.', v: ['full', 'full', 'full', 'partial'] },
    { t: 'Modelos nuevos sin historia', n: 'Se pronostican con sus parecidos.', v: ['full', 'full', 'partial', 'nd'] },
    { t: 'Corte de pedido de cada proveedor, con aviso', n: 'Contado hacia atrás con su plazo real de entrega.', v: ['full', 'partial', 'full', 'nd'] },
    { t: 'Presupuesto por temporada que avisa y bloquea', v: ['full', 'partial', 'nd', 'nd'] },
    { t: 'Plan financiero semana a semana (OTB y WSSI)', n: 'En Sacs, el presupuesto por categoría contra tu open-to-buy; sin plan semanal.', v: ['partial', 'full', 'nd', 'nd'] },
  ] },
  { t: 'Durante la temporada', filas: [
    { t: 'Primer reparto: la talla núcleo completa en cada tienda', n: 'Presentación primero, profundidad después.', v: ['full', 'partial', 'nd', 'nd'] },
    { t: 'Antes de mover, revisa lo que viene en camino', v: ['full', 'full', 'partial', 'partial'] },
    { t: 'Traspasos entre tiendas, solo desde sobrante real', v: ['full', 'full', 'nd', 'partial'] },
    { t: 'Resurtido del CEDIS sin romper la curva', n: 'Curva completa o nada; los faltantes chicos no pagan el flete.', v: ['full', 'partial', 'partial', 'partial'] },
    { t: 'Compra neta mirando toda la red', n: 'Descuenta tiendas, CEDIS y lo que viene en camino.', v: ['full', 'partial', 'full', 'partial'] },
  ] },
  { t: 'Al cierre', filas: [
    { t: 'Rebajas por escalones, sin tocar básicos ni lo recién llegado', v: ['full', 'partial', 'nd', 'partial'] },
    { t: 'Mide qué tan bien pronosticó', n: 'Lo pronosticado contra lo vendido, para corregir la siguiente temporada.', v: ['full', 'nd', 'full', 'nd'] },
  ] },
  { t: 'La plataforma', filas: [
    { t: 'Tú eliges cuánto decide solo', n: 'Sugerir, aprobar o automático con candados.', v: ['full', 'partial', 'full', 'nd'] },
    { t: 'Punto de venta, tienda en línea y planeación en una sola base', n: 'Sin integraciones: la venta de hoy ya está en el plan.', v: ['full', 'none', 'none', 'partial'] },
    { t: 'Precio público en pesos', v: ['full', 'none', 'none', 'partial'] },
  ] },
];

// Qué es cada uno, dónde gana y dónde se queda corto para una cadena de moda (de sus propios sitios).
export const PERFILES: { n: string; que: string; gana: string; corto: string }[] = [
  {
    n: 'Analyticalways',
    que: 'Software español (Madrid, 2015) de IA para planear y reponer inventario en moda, calzado y joyería. Se conecta a tu ERP y a tu punto de venta.',
    gana: 'La planeación financiera de la temporada (OTB y plan semanal), el pronóstico por modelo, talla y tienda, los modelos nuevos y los clústeres de tiendas.',
    corto: 'No vende ni cobra: sus recomendaciones se ejecutan en tu ERP y tu punto de venta. Pide de uno a dos años de historia y no publica precios.',
  },
  {
    n: 'Celes',
    que: 'Plataforma colombiana (2021) de IA para pronóstico, resurtido y compras, sobre todo en cadenas de consumo masivo, farmacia y descuento.',
    gana: 'La automatización a gran escala: pronóstico por SKU, tienda y día, aprobaciones configurables, órdenes que salen sin intervención y agentes que vigilan la precisión.',
    corto: 'Es generalista: sus soluciones no hablan de tallas, curvas ni rebajas. Se monta sobre tu ERP, con arranque de 3 a 6 meses, y no publica precios.',
  },
  {
    n: 'Sizes and Colors',
    que: 'Punto de venta y sistema administrativo mexicano para zapaterías y boutiques (León, desde 1995), con inventario por talla y color.',
    gana: 'La operación de piso del calzado: apartados, monedero con niveles, 2×1 y 3×2 por tienda, crédito y vales, CEDIS y factura desde la caja.',
    corto: 'No publica un pronóstico de temporada: compra y resurte con reportes y alertas por WhatsApp. Su tienda en línea vive en Shopify u otra plataforma conectada.',
  },
];

// La especialización en moda: reglas reales del motor (reglas.lib.js, todas vivas) y del Forecasting (DP3).
export const MODA: { t: string; d: string }[] = [
  { t: 'Talla núcleo primero', d: 'Cada tienda abre la temporada con su talla núcleo completa antes que con profundidad.' },
  { t: 'Curva completa o nada', d: 'No manda tallas sueltas que dejen la curva rota.' },
  { t: 'La corrida del proveedor', d: 'Redondea la compra a la corrida completa, con el umbral que tú eliges.' },
  { t: 'Curvas por zona', d: 'La curva de cada tienda se apoya en la de su zona, aunque el modelo sea nuevo.' },
  { t: 'Parecidos de la misma familia', d: 'Un modelo sin historia se pronostica con tres parecidos de su familia o prenda, y te dice con cuáles.' },
  { t: 'El calendario de la moda en México', d: 'Día del Padre contra Día del Padre, domingo contra domingo; Buen Fin, Hot Sale, Semana Santa y Navidad, cada uno con su regla.' },
  { t: 'Básicos fuera, lo nuevo protegido', d: 'Los básicos nunca entran a liquidación y lo que llegó hace menos de 45 días no se rebaja.' },
  { t: 'Colchón por modelo', d: 'El inventario de seguridad se calcula por modelo, no por cada talla y color.' },
];

export const FUENTES: { n: string; ls: { n: string; url: string }[] }[] = [
  { n: 'Analyticalways', ls: [
    { n: 'soluciones', url: 'https://analyticalways.com/soluciones-retail/' },
    { n: 'planificación', url: 'https://analyticalways.com/planificacion-inventarios/' },
    { n: 'compras', url: 'https://analyticalways.com/software-de-compras-retail/' },
    { n: 'integración', url: 'https://analyticalways.com/integracion-de-erp/' },
  ] },
  { n: 'Celes', ls: [
    { n: 'inicio', url: 'https://www.celes.ai/es' },
    { n: 'demand planning', url: 'https://www.celes.ai/es/soluciones/demand-planning' },
    { n: 'distribución', url: 'https://www.celes.ai/es/soluciones/distribucion' },
    { n: 'compras', url: 'https://www.celes.ai/es/soluciones/compras' },
    { n: 'automatización', url: 'https://www.celes.ai/es/soluciones/automatizacion' },
  ] },
  { n: 'Sizes and Colors', ls: [
    { n: 'precios', url: 'https://www.sizesandcolors.com/precios/' },
    { n: 'inventarios', url: 'https://www.sizesandcolors.com/control-de-inventarios/' },
    { n: 'compras y resurtidos', url: 'https://www.sizesandcolors.com/compras-iniciales-y-resurtidos/' },
    { n: 'tienda en línea', url: 'https://www.sizesandcolors.com/conector-con-marketplaces-y-tienda-online/' },
    { n: 'Sizes AI', url: 'https://www.sizesandcolors.com/sizes-ai-whatsapp/' },
  ] },
];

export const COMPARATIVO = {
  titulo: 'Sacs frente a las otras opciones',
  dek: 'Analyticalways y Celes son plataformas de IA que planean sobre tu ERP; Sizes and Colors es un punto de venta para zapaterías y boutiques. Así se comparan con Sacs, función por función, en una cadena de moda.',
  columnas: COLUMNAS,
  grupos: GRUPOS,
  hayNd: GRUPOS.some((g) => g.filas.some((f) => f.v.includes('nd'))),
  hayObra: GRUPOS.some((g) => g.filas.some((f) => f.v.includes('obra'))),
  perfiles: PERFILES,
  modaTitulo: 'Lo que Sacs sabe de moda',
  modaDek: 'Son reglas del motor: cada una se prende, se apaga o se ajusta en el Gestor de reglas.',
  moda: MODA,
  nota: 'Consultado el 2 de octubre de 2026 en los sitios y materiales públicos de cada empresa. «Sin información pública» no quiere decir que no lo tengan.',
  fuentes: FUENTES,
};
