// ─── Interfaces ───

export interface PlanPrice {
  mxn: number;
  usd: number;
  eur: number;
  brl: number;
  cop: number;
  ars: number;
  clp: number;
  pen: number;
  gbp: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  monthly: PlanPrice;
  annual: PlanPrice;
  annualTotal: PlanPrice;
  badge?: string;
  highlighted: boolean;
  inheritsFrom?: string;
  cta: { label: string; href: string; variant: 'primary' | 'secondary' };
  features: (string | { category: string; items: string[] })[];
  services: string[];
}

export interface ComparisonFeature {
  name: string;
  vende: boolean | string;
  controla: boolean | string;
  fideliza: boolean | string;
  automatiza: boolean | string;
}

export interface ComparisonCategory {
  name: string;
  features: ComparisonFeature[];
}

export interface FAQ {
  question: string;
  answer: string;
}

// ─── Plans ───

export const plans: Plan[] = [
  {
    id: 'vende',
    name: 'Vende',
    description: 'Tu primera tienda de ropa. Cobras en el mostrador y en línea, con tallas y colores.',
    monthly: { mxn: 810, usd: 41, eur: 38, brl: 210, cop: 169000, ars: 36500, clp: 38500, pen: 155, gbp: 32 },
    annual: { mxn: 527, usd: 27, eur: 25, brl: 135, cop: 110000, ars: 23500, clp: 25000, pen: 100, gbp: 21 },
    annualTotal: { mxn: 6318, usd: 324, eur: 300, brl: 1620, cop: 1320000, ars: 282000, clp: 300000, pen: 1200, gbp: 252 },
    highlighted: false,
    cta: { label: 'Inicia ahora', href: '/registro?plan=vende', variant: 'secondary' },
    features: [
      { category: 'Piso de venta', items: ['Punto de venta con y sin internet', 'Pausa la venta mientras la clienta se prueba otra talla', 'Cambios de talla, devoluciones y cancelaciones', 'Cortes de caja y arqueos', 'Tickets por WhatsApp', 'Cotizaciones', 'Apartados con abonos y pedidos', 'Ventas a crédito', 'Listas de precios: menudeo y mayoreo', 'Precio de mayoreo por cantidad'] },
      { category: 'Tienda en línea y redes', items: ['Tu tienda en línea con el mismo inventario del piso', 'Facebook, Instagram y WhatsApp', 'TikTok Shop', 'Tus prendas visibles en ChatGPT'] },
      { category: 'Tus prendas', items: ['Accesorios y prendas de talla única', 'Prendas por talla y color', 'Sets y paquetes de varias prendas', 'Existencias por talla y color', 'Etiquetas con código, talla y precio'] },
      { category: 'Facturación', items: ['20 folios incluidos'] },
    ],
    services: [
      '1 sucursal',
      'Soporte 9 AM–5 PM · chat SACS y WhatsApp',
      'Tickets resueltos en 30–90 min',
    ],
  },
  {
    id: 'controla',
    name: 'Controla',
    description: 'Ya tienes varias tiendas. Aquí ves qué talla hay en cada una y la mueves donde se vende.',
    monthly: { mxn: 1215, usd: 61, eur: 57, brl: 315, cop: 255000, ars: 54500, clp: 57500, pen: 230, gbp: 49 },
    annual: { mxn: 790, usd: 40, eur: 37, brl: 205, cop: 166000, ars: 35500, clp: 37500, pen: 150, gbp: 32 },
    annualTotal: { mxn: 9477, usd: 480, eur: 444, brl: 2460, cop: 1992000, ars: 426000, clp: 450000, pen: 1800, gbp: 384 },
    highlighted: false,
    inheritsFrom: 'Vende',
    cta: { label: 'Inicia ahora', href: '/registro?plan=controla', variant: 'secondary' },
    features: [
      { category: 'Tallas en todas tus tiendas', items: ['Qué talla hay en cada tienda, al momento', 'Reparto desde tu CEDIS', 'Traspasos de tallas entre tiendas', 'Resurtido por curva: detecta el hueco en el núcleo de tallas', 'Aviso de corrida rota y de prenda colgada'] },
      { category: 'Conteo y rastro de cada prenda', items: ['Conteo físico por corrida, sin cerrar la tienda', 'Conteo programado sin cerrar la tienda', 'Kardex: el rastro de cada prenda', 'Faltantes y diferencias de inventario'] },
      { category: 'Compra de temporada y gastos', items: ['Pedidos a proveedor y lo que le debes', 'Recibes contra el pedido que hiciste', 'Control de gastos', 'Complementos de pago y notas de crédito'] },
      { category: 'Tus clientas y tus vendedores', items: ['Tus clientas, con lo que se han llevado', 'Metas y comisiones por vendedor', 'Permisos por persona y por tienda'] },
      { category: 'Qué se vendió y qué se quedó', items: ['50+ reportes de ventas, inventario y finanzas', '20+ indicadores de tu operación', 'ABC, rotación y sell-through por modelo, talla y tienda', 'Sell-through por semana de vida del modelo · pronto', 'Costo y utilidad por prenda, antes y después de remarcar', 'Comparativa de temporada contra la misma del año pasado', 'Auditoría de movimientos'] },
      { category: 'Tu temporada, organizada', items: ['Temporada, colección y drop como etiqueta de cada modelo', 'Básicos de recompra continua, aparte de la moda de temporada', 'Semanas de cobertura por modelo y tienda · pronto', 'Calendario de temporada: entrada a piso, rebaja y salida · pronto'] },
    ],
    services: [
      'Multi-sucursal',
      'Reunión de introducción',
      'Soporte 9 AM–5 PM · chat SACS y WhatsApp',
      'Tickets resueltos en 30–90 min',
      'Migración gratis (3 días)',
    ],
  },
  {
    id: 'fideliza',
    name: 'Fideliza y Multiplica',
    description: 'Para que tu clienta regrese cada temporada, no una vez al año.',
    monthly: { mxn: 1890, usd: 95, eur: 88, brl: 490, cop: 397000, ars: 85000, clp: 90000, pen: 360, gbp: 76 },
    annual: { mxn: 1229, usd: 62, eur: 57, brl: 320, cop: 258000, ars: 55500, clp: 58500, pen: 235, gbp: 49 },
    annualTotal: { mxn: 14742, usd: 744, eur: 684, brl: 3840, cop: 3096000, ars: 666000, clp: 702000, pen: 2820, gbp: 588 },
    badge: 'Más popular',
    highlighted: true,
    inheritsFrom: 'Controla',
    cta: { label: 'Inicia ahora', href: '/registro?plan=fideliza', variant: 'primary' },
    features: [
      { category: 'La ficha de tu clienta', items: ['La ficha de tu clienta: lo que compró en tienda y en línea', 'Agrupa a tus clientas por lo que compran', 'Notas y seguimientos de cada clienta'] },
      { category: 'Puntos y monedero de la clienta', items: ['Monedero electrónico y puntos por compra', 'Niveles de clienta y premios por nivel', 'Sus puntos valen en el mostrador y en línea'] },
      { category: 'Portal de tu clienta y tarjetas de regalo', items: ['Portal con tu marca donde tu clienta ve sus compras', 'Portal de autofacturación', 'Tarjetas de regalo físicas y digitales'] },
      { category: 'Correo a tus clientas', items: ['Correos al grupo de clientas que elijas', 'Plantillas que editas a la imagen de tu marca', 'Hasta 1,000 contactos incluidos'] },
      { category: 'WhatsApp a tus clientas', items: ['Avisos automáticos por WhatsApp a tu clienta', 'Avisa el drop o la rebaja por WhatsApp', 'Hasta 200 contactos activos incluidos'] },
      { category: 'Membresías de clienta frecuente', items: ['Membresía mensual para tu clienta frecuente', 'Cobro automático y renovación', 'Beneficios exclusivos por nivel de membresía'] },
    ],
    services: [
      'Multi-sucursal',
      'Reunión mensual',
      'Soporte 9 AM–5 PM · chat SACS y WhatsApp',
      'Tickets resueltos en 15–30 min',
      'Migración gratis (1 día)',
    ],
  },
  {
    id: 'automatiza',
    name: 'Automatiza',
    description: 'La IA mueve las tallas entre tus tiendas y te dice qué comprar la próxima temporada.',
    monthly: { mxn: 3780, usd: 190, eur: 175, brl: 985, cop: 794000, ars: 170000, clp: 180000, pen: 720, gbp: 150 },
    annual: { mxn: 2457, usd: 125, eur: 115, brl: 640, cop: 516000, ars: 111000, clp: 117000, pen: 470, gbp: 98 },
    annualTotal: { mxn: 29484, usd: 1500, eur: 1380, brl: 7680, cop: 6192000, ars: 1332000, clp: 1404000, pen: 5640, gbp: 1176 },
    highlighted: false,
    inheritsFrom: 'Fideliza y Multiplica',
    cta: { label: 'Inicia ahora', href: '/registro?plan=automatiza', variant: 'secondary' },
    features: [
      { category: 'Especialista IA dedicado', items: ['Una persona real que diseña tus automatizaciones contigo', 'Sesión mensual para ajustar y agregar automatizaciones', 'Arranque completo de tu operación con IA'] },
      { category: 'AXO · Copiloto IA', items: ['Pregúntale cuánto llevas vendido del modelo nuevo, y actúa al momento', 'Te avisa de la talla que se va a agotar y te dice qué hacer', 'Aprende de tu operación y se vuelve más inteligente cada día'] },
      { category: 'Tareas que se hacen solas', items: ['Reglas del tipo "si pasa esto, haz esto otro"', 'Se acaba una talla → sale el pedido al proveedor', 'Se vende una prenda → avisa, factura y baja la existencia', 'Automatizaciones a la medida de cómo trabajas'] },
      { category: 'Avisos que te llegan solos', items: ['Avisos cuando la venta o la existencia se salen de lo normal', 'Aviso de prenda colgada y de talla a punto de agotarse', 'Te llega por WhatsApp o correo, al momento'] },
      { category: 'Reportes y pronóstico de temporada', items: ['Reportes automáticos a la hora que elijas', 'Tableros distintos para dueño, gerente y piso de venta', 'Pronóstico de demanda por modelo y tienda'] },
      { category: 'Antes de la temporada · la compra', items: ['Presupuesto de compra por temporada, categoría y mes (OTB) · pronto', 'Plan de surtido: cuánto de cada modelo va a cada tienda · pronto', 'Curva de tallas del modelo nuevo, sin historia previa · pronto', 'Reparto del primer embarque tienda por tienda · pronto', 'Amplitud contra profundidad: cuántos modelos y qué tan hondo · pronto', 'Tope de presupuesto por temporada que prioriza por venta perdida al día'] },
      { category: 'En temporada · el inventario que se mueve solo', items: ['Salud de la curva por color: qué modelo tiene hueco en el núcleo de tallas y cuál ya se rompió', 'La IA propone el traspaso que completa la corrida entre tiendas; tú apruebas', 'Resurtido y mínimos por tienda calculados solos, con la venta real y el mismo periodo del año pasado', 'Pronóstico de demanda por modelo, talla y tienda · pronto', 'Recompra de básicos calculada sola, sin tocar la moda de temporada · pronto', 'Aviso de prenda colgada antes de que se vuelva saldo'] },
      { category: 'Fin de temporada · rebajas y liquidación', items: ['Lo etiquetado como liquidación o fin de temporada deja de resurtirse en toda la red', 'Rebajas programadas por rango de fechas, iguales en todas tus tiendas', 'Cadencia de rebaja por semanas en piso: 20% a la 8, 40% a la 12 · pronto', 'La IA te dice qué remarcar, cuánto y cuándo, para no regalar margen · pronto', 'Liquidación que arranca sola por edad del modelo y sell-through · pronto', 'Cuánto dinero tienes parado en saldos, por tienda y por temporada · pronto'] },
      { category: 'Agentes de IA trabajando en cadena', items: ['Conecta Claude, GPT y Gemini para ejecutar tareas complejas', 'Agentes de IA para resurtido, precios y campañas, uno tras otro', 'Especialista IA dedicado para diseñar tus automatizaciones'] },
      { category: 'API e integraciones', items: ['Conecta con +600 apps: ERP, contabilidad, logística, marketing', 'API abierta para integraciones a la medida', '1,000 créditos de IA incluidos al mes', 'El consumo adicional de IA se cobra aparte'] },
    ],
    services: [
      'Multi-sucursal',
      'Especialista IA dedicado',
      'Onboarding de automatización (diseño de workflows)',
      'Sesión mensual de optimización IA',
      'Soporte 24/7 · chat SACS y WhatsApp',
      'Tickets resueltos en <2 min',
      'Migración gratis',
      'Acceso anticipado a nuevas funciones IA',
    ],
  },
];

// ─── Universal Features (all plans) ───

export const universalFeatures: string[] = [
  'Punto de venta',
  'Tienda en línea',
  'Vende en Facebook, Instagram y TikTok Shop',
  'Tus prendas aparecen en Google, ChatGPT y Gemini',
  'Soporte por chat SACS y WhatsApp',
  'Dispositivos ilimitados',
  'Usuarios ilimitados',
  'Modelos ilimitados, con todas sus tallas y colores',
  '3 cajas cobrando a la vez (más, sin costo por caja)',
  'Espacio ilimitado para las fotos de tus prendas',
  'Actualizaciones mensuales',
  'Sin contratos de permanencia',
];

// ─── Comparison Table ───

export const comparisonCategories: ComparisonCategory[] = [
  {
    name: 'Cobrar en el piso de venta',
    features: [
      { name: 'Punto de venta con y sin internet', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Sigues cobrando si se cae el internet', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Impresión rápida de tickets', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Ticket por WhatsApp', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Cobra en efectivo, tarjeta o transferencia', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Arqueos de caja', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Cortes de caja', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Ticket personalizado', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Deja la venta pausada mientras se prueba otra talla', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Precio distinto para mayoreo y menudeo', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Varias vendedoras cobrando al mismo tiempo', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Cobro en múltiples divisas', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Pantalla principal automatizada', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Corte de caja ciego antifraude', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Bloqueo seguro de pantalla', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Permisos avanzados en POS', vende: false, controla: false, fideliza: false, automatiza: true },
    ],
  },
  {
    name: 'Cambios de talla y devoluciones',
    features: [
      { name: 'Cambios y devoluciones desde el mostrador', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Compró en una tienda y cambia en otra', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Cambios exprés de talla o color', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Vale de cambio automático', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Reembolsos al método original', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Etiquetas QR en tickets', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Reportes de devoluciones', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Bonificación en monedero electrónico', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Sugerencias de qué llevarse en el cambio', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Cambios sin ticket físico', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Aplica sola tu política de cambios', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Permisos avanzados en cambios', vende: false, controla: false, fideliza: false, automatiza: true },
    ],
  },
  {
    name: 'Apartados, abonos y pedidos',
    features: [
      { name: 'Cotizaciones y pedidos', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Apartado con anticipo', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Listas de precios automáticas', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Revisa que la talla siga disponible', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Abonos parciales del apartado', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Descuentos en pedidos', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Precio de mayoreo en pedidos', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Recordatorio de abono a tu clienta', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Facturación automática al concluir', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Puntos de lealtad al concluir', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Recuperación de pedidos cancelados', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'Sugerencia de qué más ofrecerle a la clienta', vende: false, controla: false, fideliza: false, automatiza: true },
    ],
  },
  {
    name: 'Existencia por talla y color',
    features: [
      { name: 'Matriz de talla × color por modelo', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Códigos de barras y QR', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Carga masiva de tus modelos', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Conteo sin cerrar la tienda', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Conteo masivo con escáner', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Conteo con lector de código de barras', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Traspasos de tallas entre tiendas', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Reparto desde tu CEDIS a cada tienda', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Qué talla hay en cada tienda, al momento', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'El rastro de cada prenda, movimiento por movimiento', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Conteo sorpresa automático', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Conteo parcial por sección de la tienda', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Rebalanceo de corridas entre tiendas con IA', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'Resurtido automático', vende: false, controla: false, fideliza: false, automatiza: true },
    ],
  },
  {
    name: 'Tus clientas',
    features: [
      { name: 'Registro de tus clientas', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Lo que se ha llevado cada clienta', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Notas y seguimientos', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Cuánto te ha comprado cada clienta', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Ficha completa de tu clienta', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Lo que compró en tienda, en línea y por WhatsApp', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Sugerencias de qué ofrecerle', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Grupos de clientas por lo que compran', vende: false, controla: false, fideliza: true, automatiza: true },
    ],
  },
  {
    name: 'Lealtad, rebajas y promociones',
    features: [
      { name: 'Descuento por prenda', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Descuento por cantidad', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Promociones combinadas', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'La rebaja se avisa sola en la caja', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Promociones multi-sucursal', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Tarjetas de regalo', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Monedero electrónico', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Puntos de lealtad por compra', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Niveles de lealtad configurables', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Promoción 3x2 automática', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Promociones progresivas', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Rebaja programada por rango de fechas', vende: false, controla: true, fideliza: true, automatiza: true },
    ],
  },
  {
    name: 'Tienda en línea, redes y WhatsApp',
    features: [
      { name: 'Tienda en línea básica', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Mismo inventario que el piso de venta', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Tienda en línea avanzada', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Envíos locales y nacionales', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Chat integrado con WhatsApp', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Cobro por WhatsApp y por la web', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Tus prendas en Meta, TikTok y Google', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Puntos que suman igual en tienda y en línea', vende: false, controla: false, fideliza: true, automatiza: true },
    ],
  },
  {
    name: 'Sell-through, margen y reportes',
    features: [
      { name: 'Ventas por prenda', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Reporte por método de pago', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Compara esta temporada contra la pasada', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Margen por prenda, antes y después de remarcar', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Kardex: el rastro de cada prenda', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Ventas por vendedora y por prenda', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Sell-through: cuánto llevas vendido de lo que compraste', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'Resurtido por curva: detecta el hueco en el núcleo de tallas', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'Indicadores de todas tus tiendas juntas', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'Envío automático de reportes', vende: false, controla: false, fideliza: false, automatiza: true },
    ],
  },
  {
    name: 'Facturación electrónica',
    features: [
      { name: 'Factura manual CFDI', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Factura desde punto de venta', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Factura global a público en general', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Cancelación de facturas', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Facturación automática', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Kiosko de autofacturación', vende: false, controla: false, fideliza: true, automatiza: true },
    ],
  },
  {
    name: 'La temporada, de la compra a la liquidación',
    features: [
      { name: 'Temporada, colección y drop en cada modelo', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Sell-through por modelo, talla y tienda', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Salud de la curva de tallas por color', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'Traspaso que completa la corrida, propuesto por IA', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'Tope de presupuesto de compra por temporada', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'La etiqueta de salida frena el resurtido en la red', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'Presupuesto de compra pre-temporada (OTB)', vende: false, controla: false, fideliza: false, automatiza: 'Pronto' },
      { name: 'Plan de surtido y reparto del primer embarque', vende: false, controla: false, fideliza: false, automatiza: 'Pronto' },
      { name: 'Curva de tallas para modelo nuevo sin historia', vende: false, controla: false, fideliza: false, automatiza: 'Pronto' },
      { name: 'Cadencia de rebaja por semanas en piso', vende: false, controla: false, fideliza: false, automatiza: 'Pronto' },
      { name: 'Liquidación automática por edad y sell-through', vende: false, controla: false, fideliza: false, automatiza: 'Pronto' },
      { name: 'Dinero parado en saldos, por tienda y temporada', vende: false, controla: false, fideliza: false, automatiza: 'Pronto' },
    ],
  },
  {
    name: 'Compra de temporada y recepción',
    features: [
      { name: 'Pedidos al proveedor por talla y color', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Recibes contra el pedido que hiciste', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Recibes contra la nota del proveedor', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Devolución a proveedores', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Catálogos por proveedor', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Historial de costos por talla y color', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Aviso de qué resurtir', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Compra por curva de tallas, con tope de presupuesto por temporada', vende: false, controla: false, fideliza: false, automatiza: true },
    ],
  },
];

// ─── Add-ons ───

export interface Addon {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge?: string;
}

export const addons: Addon[] = [
  {
    id: 'listas-escolares',
    name: 'Listas Escolares',
    description: 'Para papelerías: captura las listas por colegio y grado, arma el kit, deja que el papá quite lo que ya tiene y saca la orden de compra de las listas mismas.',
    icon: 'listas',
  },
  {
    id: 'suite-joyeria',
    name: 'Suite Joyería',
    description: 'Para joyerías: el producto no tiene precio fijo, vale lo que pesa por lo que vale el gramo — y el gramo lo pones tú. Colchón del fino, factor por quilataje, costo histórico que no se mueve y repreciado masivo con simulación antes de aplicar.',
    icon: 'joyeria',
  },
  {
    id: 'shopify',
    name: 'Integración con Shopify',
    description: 'Sincroniza inventario, pedidos y clientes entre tus tiendas físicas y tu tienda en Shopify en tiempo real.',
    icon: 'shopify',
  },
  {
    id: 'woocommerce',
    name: 'Integración con WooCommerce',
    description: 'Conecta tu tienda en WordPress con Sacs. Stock, precios y pedidos sincronizados automáticamente.',
    icon: 'woocommerce',
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Gestión de empleados, horarios, cambios de turno y control de asistencia desde tu punto de venta.',
    icon: 'staff',
  },
  {
    id: 'marketing',
    name: 'Marketing Suite',
    description: 'Campañas por correo y WhatsApp, segmentación de clientes y automatización de marketing para retail.',
    icon: 'marketing',
  },
];

// ─── Pricing FAQ ───

export const pricingFaqs: FAQ[] = [
  {
    question: '¿Puedo cambiar de plan en cualquier momento?',
    answer: 'Sí. Subes o bajas de plan cuando quieras, sin penalización. Si la temporada alta te pide más, subes en noviembre y bajas en febrero. El cambio entra en tu siguiente periodo de facturación.',
  },
  {
    question: '¿Qué pasa con mi catálogo si cancelo?',
    answer: 'Todo sigue disponible 90 días después de cancelar. Exportas cuando quieras tus modelos con sus tallas y colores, tu cartera de clientas y tu historial de ventas. No hay cargo por cancelar.',
  },
  {
    question: '¿Ustedes cargan mi catálogo o lo capturo yo?',
    answer: 'Lo cargamos nosotros y no cuesta aparte: viene en todos los planes de pago. En Controla y superiores nuestro equipo sube cada modelo con su matriz de tallas y colores en 1 a 3 días. Tú solo validas.',
  },
  {
    question: '¿Qué métodos de pago aceptan?',
    answer: 'Tarjeta de crédito y débito, transferencia bancaria (SPEI) y pago en OXXO. Facturamos en pesos mexicanos con CFDI.',
  },
  {
    question: '¿En cuánto tiempo estoy vendiendo con Sacs?',
    answer: 'El arranque básico toma 15 minutos. Con todo tu catálogo cargado —cada modelo con sus tallas y colores— más la capacitación de tu equipo, entre 1 y 3 semanas según cuántos modelos traigas. No cierras la tienda ningún día.',
  },
  {
    question: '¿El soporte tiene costo adicional?',
    answer: 'No. Todos los planes incluyen soporte por chat de SACS y WhatsApp sin costo adicional. Vende y Controla atienden de 9 AM a 5 PM con resolución de tickets en 30–90 min; Fideliza y Multiplica, en 15–30 min; y Automatiza incluye soporte 24/7. Automatiza además incluye un especialista IA dedicado.',
  },
];
