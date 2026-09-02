// CONOCIMIENTO DEL AGENTE · FICHA DE PRODUCTO (lo que Sacs hace, por módulo).
//
// Primera pasada sacada del menú real de sacs3 (src/elem/lateral/lateral.js)
// y de plans.ts; el dueño la afina módulo por módulo. Cada entrada dice en
// una o dos líneas qué hace, para qué giros importa, en qué plan entra y si
// es complemento (se cotiza aparte). `noHace` evita que el agente prometa lo
// que no existe. El agente recibe solo los módulos relevantes al giro y a la
// pregunta, no la lista entera.

export type Modulo = {
  id: string;
  nombre: string;
  area: 'vende' | 'controla' | 'fideliza' | 'automatiza' | 'complemento';
  queHace: string;
  giros: string[];        // ids de giros.ts; [] = todos
  plan: 'vende' | 'controla' | 'fideliza' | 'automatiza' | 'giro' | 'aparte';  // giro = se instala por ser de ese giro, va con el plan
  noHace?: string;
  claves: string[];       // palabras que lo disparan en una pregunta
};

export const MODULOS: Modulo[] = [
  // ── VENDE ──
  { id: 'pos', nombre: 'Punto de venta', area: 'vende', plan: 'vende', giros: [], claves: ['cobrar', 'caja', 'ticket', 'sin internet', 'offline', 'terminal', 'punto de venta', 'pos'],
    queHace: 'Cobra con y sin internet (sincroniza al volver), varias cajas a la vez, pausa la venta mientras la clienta se prueba otra talla, cortes y arqueos, ticket impreso o por WhatsApp, efectivo/tarjeta/transferencia y divisas.' },
  { id: 'cambios', nombre: 'Cambios de talla y devoluciones', area: 'vende', plan: 'controla', giros: ['ropa', 'multimarca', 'activewear', 'zapateria'], claves: ['cambio', 'devolución', 'vale', 'reembolso', 'talla', 'número'],
    queHace: 'Cambio de talla o color desde el mostrador aunque haya comprado en otra tienda, vale de cambio automático, reembolso al método original, sin ticket físico gracias al QR y a la ficha de la clienta.' },
  { id: 'apartados', nombre: 'Apartados y pedidos', area: 'vende', plan: 'vende', giros: [], claves: ['apartado', 'abono', 'anticipo', 'quincena', 'pedido', 'sobre pedido'],
    queHace: 'Apartado con anticipo y abonos (largos si hace falta), recordatorios, la pieza apartada se bloquea de verdad en todos los canales; pedidos sobre pedido con fecha de entrega.' },
  { id: 'tienda-linea', nombre: 'Tienda en línea y canales', area: 'vende', plan: 'vende', giros: [], claves: ['tienda en línea', 'ecommerce', 'página', 'instagram', 'facebook', 'tiktok', 'shopify', 'mercado libre', 'whatsapp', 'catálogo'],
    queHace: 'Tienda en línea propia con el mismo inventario del piso; Facebook, Instagram, WhatsApp y TikTok Shop conectados; la talla agotada se apaga sola en todos lados; prendas visibles en Google y ChatGPT. Mercado Libre y Shopify se conectan también.',
    noHace: 'No es un constructor de sitios de marketing: es la tienda para vender tu inventario.' },
  { id: 'promociones', nombre: 'Promociones y rebajas', area: 'vende', plan: 'controla', giros: [], claves: ['promoción', 'rebaja', 'descuento', 'liquidación', '2x1', 'remate'],
    queHace: 'Rebajas programadas por rango de fechas iguales en todas las tiendas, promociones por look/kit, liquidación de fin de temporada; lo etiquetado en liquidación deja de resurtirse.' },
  { id: 'cotizaciones', nombre: 'Cotizaciones', area: 'vende', plan: 'vende', giros: [], claves: ['cotización', 'presupuesto', 'mayoreo'],
    queHace: 'Cotizaciones que se convierten en venta o pedido; listas de precio menudeo y mayoreo y precio de mayoreo por cantidad.' },
  { id: 'facturacion', nombre: 'Facturación electrónica', area: 'vende', plan: 'vende', giros: [], claves: ['factura', 'cfdi', 'sat', 'timbre', 'complemento de pago', 'nota de crédito'],
    queHace: 'CFDI 4.0 desde la venta o desde el portal de autofacturación de la clienta; complementos de pago y notas de crédito. Vende incluye 20 folios; los demás planes, según plan.' },
  { id: 'metas', nombre: 'Metas y comisiones', area: 'vende', plan: 'controla', giros: [], claves: ['comisión', 'meta', 'vendedora', 'vendedor'],
    queHace: 'Metas por tienda y vendedora, comisiones calculadas solas, permisos por persona y por tienda.' },

  // ── CONTROLA ──
  { id: 'tallas', nombre: 'Inventario por talla y color', area: 'controla', plan: 'vende', giros: ['ropa', 'multimarca', 'activewear', 'zapateria', 'novias'], claves: ['talla', 'color', 'matriz', 'curva', 'existencia', 'variante', 'corrida', 'número'],
    queHace: 'Matriz talla × color con existencia propia por cada combinación y por tienda; en calzado, corrida completa con medios números; sets y paquetes; etiquetas con código, talla y precio.' },
  { id: 'multisucursal', nombre: 'Varias tiendas y CEDIS', area: 'controla', plan: 'controla', giros: [], claves: ['sucursal', 'tienda', 'bodega', 'cedis', 'almacén', 'traspaso', 'transferencia'],
    queHace: 'Qué talla hay en cada tienda al momento, traspasos entre tiendas con escáner, reparto desde el CEDIS, solicitud y recepción de mercancía.' },
  { id: 'nivelacion', nombre: 'Nivelación entre tiendas', area: 'controla', plan: 'automatiza', giros: ['ropa', 'zapateria', 'multimarca', 'activewear'], claves: ['nivelación', 'nivelar', 'sobra en una y falta en otra', 'balancear'],
    queHace: 'Detecta la talla que sobra en una tienda y falta en otra y propone el traspaso que completa la corrida; tú apruebas y sale la orden.' },
  { id: 'conteo', nombre: 'Conteo físico', area: 'controla', plan: 'controla', giros: [], claves: ['conteo', 'inventario físico', 'contar', 'diferencias', 'faltantes'],
    queHace: 'Conteo desde el celular, por corrida o por zona, sin cerrar la tienda; programado o parcial; faltantes y diferencias con su reporte.' },
  { id: 'compras', nombre: 'Compras y reabasto por curva', area: 'controla', plan: 'controla', giros: [], claves: ['proveedor', 'pedido', 'orden de compra', 'recepción', 'embarque', 'resurtido', 'reabasto', 'mínimos', 'máximos'],
    queHace: 'Pedidos a proveedor, recepción contra pedido, lo que le debes a cada proveedor; resurtido por curva que detecta el hueco en el núcleo de tallas; aviso de corrida rota y de prenda colgada.' },
  { id: 'reportes', nombre: 'Reportes y análisis', area: 'controla', plan: 'controla', giros: [], claves: ['reporte', 'sell-through', 'rotación', 'abc', 'utilidad', 'margen', 'qué se vende', 'comparativo'],
    queHace: '50+ reportes: ventas por tienda, vendedora, marca, categoría, cliente; ABC, rotación y sell-through por modelo, talla y tienda; costo y utilidad por prenda; comparativa de temporada contra el año pasado; kardex y auditoría.' },
  { id: 'gastos', nombre: 'Gastos, cuentas por pagar y bancos', area: 'controla', plan: 'controla', giros: [], claves: ['gasto', 'cuentas por pagar', 'banco', 'conciliación', 'caja chica'],
    queHace: 'Control de gastos y presupuestos, cuentas por pagar a proveedores con vencimientos, cuentas de efectivo y bancos con conciliación.' },
  { id: 'temporada', nombre: 'Temporada, colección y drop', area: 'controla', plan: 'controla', giros: ['ropa', 'activewear', 'multimarca', 'zapateria'], claves: ['temporada', 'colección', 'drop', 'básicos', 'calendario'],
    queHace: 'Cada modelo etiquetado por temporada, colección y drop; básicos de recompra aparte de la moda de temporada; comparativas por temporada.' },
  { id: 'marcas', nombre: 'Marca y proveedor en cada prenda', area: 'controla', plan: 'controla', giros: ['multimarca'], claves: ['marca', 'proveedor', 'corte por marca', 'margen por marca'],
    queHace: 'La mercancía entra con su marca, proveedor y costo; etiquetado al recibir; ventas y margen por marca y por proveedor.' },

  // ── FIDELIZA ──
  { id: 'clientas', nombre: 'Ficha de clienta y CRM', area: 'fideliza', plan: 'fideliza', giros: [], claves: ['cliente', 'clienta', 'ficha', 'historial', 'seguimiento', 'crm'],
    queHace: 'La ficha de la clienta con lo que compró en tienda y en línea, sus tallas y colores, grupos por lo que compran, notas y seguimientos.' },
  { id: 'lealtad', nombre: 'Monedero y programa de lealtad', area: 'fideliza', plan: 'fideliza', giros: [], claves: ['puntos', 'monedero', 'lealtad', 'cashback', 'niveles', 'recompensa'],
    queHace: 'Monedero electrónico y puntos por compra, niveles de clienta con premios; valen en mostrador y en línea; cashback también en apartados al liquidar.' },
  { id: 'portal', nombre: 'Portal de clientas y tarjetas de regalo', area: 'fideliza', plan: 'fideliza', giros: [], claves: ['portal', 'autofactura', 'tarjeta de regalo', 'gift card'],
    queHace: 'Portal con tu marca donde la clienta ve compras, puntos y se autofactura; tarjetas de regalo físicas y digitales.' },
  { id: 'marketing', nombre: 'Correo y WhatsApp a tus clientas', area: 'fideliza', plan: 'fideliza', giros: [], claves: ['correo', 'email', 'campaña', 'whatsapp masivo', 'avisar', 'restock', 'newsletter'],
    queHace: 'Correos a grupos de clientas con plantillas de tu marca (1,000 contactos incluidos) y avisos/campañas por WhatsApp (200 contactos activos incluidos): el drop, la rebaja, el restock.' },
  { id: 'membresias', nombre: 'Membresías y suscripciones', area: 'fideliza', plan: 'fideliza', giros: [], claves: ['membresía', 'suscripción', 'cobro automático', 'vip'],
    queHace: 'Membresía mensual de clienta frecuente con cobro automático, renovación y beneficios por nivel.' },

  // ── AUTOMATIZA ──
  { id: 'axo', nombre: 'AXO, copiloto IA y especialista dedicado', area: 'automatiza', plan: 'automatiza', giros: [], claves: ['ia', 'inteligencia artificial', 'copiloto', 'automatizar', 'workflow', 'alertas', 'pronóstico', 'forecast'],
    queHace: 'Le preguntas cuánto llevas vendido del modelo nuevo y actúa; te avisa de la talla que se va a agotar; reglas «si pasa esto, haz esto otro»; pronóstico de demanda por modelo y tienda; y una persona real que diseña tus automatizaciones contigo.' },

  // ── POR GIRO (se instalan según el giro, van con el plan) y EXTRAS (solo se mencionan) ──
  { id: 'suite-consignacion', nombre: 'Suite de Consignación', area: 'complemento', plan: 'giro', giros: ['consignacion'], claves: ['consigna', 'consignación', 'consignante', 'departamental', 'liquidar', 'comisión'],
    queHace: 'Cada pieza con su dueña o su proveedor y su comisión, contrato con firma remota, estado de cuenta y saldo a favor por consignante, Lives con piezas asignadas, retiros y liquidación. Separa lo firme de lo consignado.' },
  { id: 'suite-joyeria', nombre: 'Suite Joyería', area: 'complemento', plan: 'giro', giros: ['joyeria'], claves: ['gramo', 'quilataje', 'oro', 'repreciar', 'colchón', 'metal'],
    queHace: 'Precio por gramo con tu colchón del fino, factor por quilataje, costo histórico inmutable, repreciar en masa con simulación, compras de metal y cumplimiento LFPIORPI.' },
  { id: 'torre-evento', nombre: 'Torre de Control del Evento', area: 'complemento', plan: 'giro', giros: ['merch'], claves: ['torre', 'semáforo', 'módulo', 'reabasto en vivo', 'evento'],
    queHace: 'Semáforo de venta y existencia por módulo con el reabasto propuesto en vivo durante el show.' },
  { id: 'ordenes-servicio', nombre: 'Órdenes de servicio (taller y reparaciones)', area: 'complemento', plan: 'giro', giros: ['novias', 'joyeria', 'zapateria'], claves: ['taller', 'reparación', 'ajuste', 'prueba', 'arreglo', 'orden de servicio'],
    queHace: 'Órdenes de servicio con etapas y fechas (primera prueba, ajuste, entrega; reparación con foto antes/después), ligadas al ticket y a la clienta.' },
  { id: 'extraordinarios', nombre: 'Módulos extraordinarios de moda', area: 'complemento', plan: 'aparte', giros: ['ropa', 'multimarca', 'activewear'], claves: ['probador virtual', 'fotografía', 'foto con ia', 'video', 'lookbook', 'pre-orden', 'preventa'],
    queHace: 'Probador virtual en tienda, fotografía y video de producto con IA, sugerencia de outfits con IA, lookbooks digitales y pre-órdenes de colección. Son extras: se mencionan si pregunta y el consultor los ve en la reunión.' },
  { id: 'otros-plugins', nombre: 'Otros complementos', area: 'complemento', plan: 'aparte', giros: [], claves: ['rfid', 'empleados', 'recursos humanos', 'asistencia', 'renta', 'kiosko', 'lotes', 'racks', 'kueski', 'aplazo', 'meses sin intereses'],
    queHace: 'Existe un catálogo amplio de complementos (RFID, empleados y asistencia, renta de prendas, kiosko verificador de tallas, pagos a meses con Kueski/Aplazo, racks de CEDIS, etc.). Se mencionan si el lead los pide y se cotizan en la reunión.' },
];

/** Los módulos que le hablan a un giro y a lo que preguntó. */
export function modulosRelevantes(giroId: string | null, pregunta: string, max = 6): Modulo[] {
  const t = (pregunta || '').toLowerCase();
  const puntuados = MODULOS.map(m => {
    let n = 0;
    if (m.giros.length === 0) n += 1;                       // genérico: relleno de último recurso
    if (giroId && m.giros.includes(giroId)) n += 2;          // propio del giro
    for (const k of m.claves) if (t.includes(k)) n += 3;     // lo preguntó
    return { m, n };
  }).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  // Primero lo que preguntó o es de su giro; los genéricos solo completan hasta 3.
  const fuertes = puntuados.filter(x => x.n >= 2).slice(0, max);
  const relleno = puntuados.filter(x => x.n < 2).slice(0, Math.max(0, 3 - fuertes.length));
  return [...fuertes, ...relleno].map(x => x.m);
}

export const moduloTexto = (m: Modulo) =>
  `· ${m.nombre}${m.plan === 'aparte' ? ' (extra: se menciona, el consultor lo ve en la reunión)' : m.plan === 'giro' ? ' (se instala por su giro, va con el plan)' : ` (desde el plan ${m.plan[0].toUpperCase() + m.plan.slice(1)})`}: ${m.queHace}${m.noHace ? ` Ojo: ${m.noHace}` : ''}`;
