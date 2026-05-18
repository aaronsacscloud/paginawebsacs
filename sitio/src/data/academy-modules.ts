// Datos de la Academia SACS — Plan VENDE (el más completo).
// Fuente: /Users/anonimoanonimo/sacs3/src/views/inicio/index.html — _getModuleMeta + _getVendeTasks
//
// Se usa en el portal del partner (AcademyTab) para que conozcan los módulos
// que sus clientes ven y puedan explicárselos. Cada módulo enlaza a la
// academia real en app.sacscloud.com.

export type AcademyTask = {
  id: string;
  title: string;
  time: string;
  category: string;
};

export type AcademyModule = {
  num: number;
  name: string;
  emoji: string;
  description: string;
  color: string;
  /** Imagen ambiental del momento real de un cliente en este módulo. */
  image: string;
  /** Fase narrativa del journey ("Día 1", "Semana 1", etc.) */
  phase: string;
  /** Por qué este módulo le importa al cliente — para que el partner lo venda desde ese ángulo. */
  clientStory: {
    /** Qué siente/necesita el cliente cuando llega a este módulo. */
    feeling: string;
    /** Cómo le cambia la vida al terminar este módulo. */
    outcome: string;
    /** Frase que el partner puede usar al pitch. */
    pitch: string;
  };
  tasks: AcademyTask[];
};

export const ACADEMY_DEMO_URL = 'https://app.sacscloud.com/lavidaesparadisfrutar/pruebasmongo/inicio/list/index';

export const ACADEMY_MODULES: AcademyModule[] = [
  {
    num: 1,
    name: 'Configuración de tu Empresa',
    emoji: '🏢',
    color: '#3B82F6',
    description: 'Tu negocio, sucursales, almacenes, cajas y equipo de trabajo — la base de todo.',
    image: '/images/aprende-sacs/modulo-1.webp',
    phase: 'Día 1 · Cimientos',
    clientStory: {
      feeling: 'Acaba de firmar plan y abre el sistema por primera vez. Está nervioso — "espero no echarlo a perder". Tiene datos sueltos en la cabeza: cuántas sucursales tiene, quién es su equipo, qué impuestos aplica.',
      outcome: 'En 40 minutos tiene su negocio configurado: logo, sucursales, almacenes, cajas, impuestos, ticket personalizado y su equipo invitado. La sensación es "esto ya es mío, ya está hecho a mi medida".',
      pitch: 'Es la base — todo lo demás se construye encima. Aquí decidimos cómo opera su negocio (caja compartida vs. caja por vendedor) y lo configuramos para siempre.',
    },
    tasks: [
      { id: 'v1t1', title: 'Completa la información de tu negocio', time: '5 min', category: 'Negocio' },
      { id: 'v1t2', title: 'Sucursales, almacenes, cajas y agentes', time: '8 min', category: 'Estructura' },
      { id: 'v1t3', title: 'Monedas, divisas y tipo de cambio', time: '5 min', category: 'Financiero' },
      { id: 'v1t4', title: 'Impuestos y configuración fiscal', time: '5 min', category: 'Fiscal' },
      { id: 'v1t5', title: 'Métodos de pago del Punto de Venta', time: '5 min', category: 'Pagos' },
      { id: 'v1t6', title: 'Ticket, folios e impresora', time: '8 min', category: 'Personalización' },
      { id: 'v1t7', title: 'Grupos de usuarios e invitar a tu equipo', time: '6 min', category: 'Equipo' },
    ],
  },
  {
    num: 2,
    name: 'Prepara tu Catálogo',
    emoji: '📦',
    color: '#10B981',
    description: 'Tu catálogo profesional para venta física y en línea — productos que se ven bien y se venden solos.',
    image: '/images/aprende-sacs/modulo-2.webp',
    phase: 'Día 2-5 · Producto',
    clientStory: {
      feeling: 'Tiene 200, 500 o 2,000 productos en la cabeza, en un Excel viejo o en cajas sin etiquetar. Sabe que "subir todo" suena agobiante. La pregunta real: ¿cómo lo hago sin perder dos semanas?',
      outcome: 'Termina con su catálogo profesional vivo: productos con fotos buenas (incluso si nunca tomó una foto pro), variantes correctas, precios estratégicos con margen visible, códigos de barras impresos. Su tienda en línea y POS comparten el mismo catálogo.',
      pitch: 'Aquí pasa de "tengo productos sueltos" a "tengo un catálogo profesional listo para vender en todos lados". Las fotos con IA, las listas de precios y los combos cambian la economía del negocio.',
    },
    tasks: [
      { id: 'v2t1',  title: 'Tipos de producto: simple, variante y compuesto', time: '4 min', category: 'Productos' },
      { id: 'v2t2',  title: 'Configura tus productos con variantes', time: '5 min', category: 'Variantes' },
      { id: 'v2t1b', title: 'Organiza tu catálogo: categorías, marcas, proveedores y etiquetas', time: '7 min', category: 'Organización' },
      { id: 'v2t3',  title: 'Estrategia de precios: listas, costos, márgenes y volumen', time: '6 min', category: 'Precios' },
      { id: 'v2t6',  title: 'Códigos de barras y SKUs', time: '5 min', category: 'Identificación' },
      { id: 'v2t6b', title: 'Diseña e imprime tus etiquetas de producto', time: '5 min', category: 'Etiquetas' },
      { id: 'v2t5',  title: 'Fotografía de producto: mejores prácticas y herramientas con IA', time: '6 min', category: 'Visual' },
      { id: 'v2t4a', title: 'Producto simple: crea, vende y mira el impacto', time: '8 min', category: 'Productos' },
      { id: 'v2t4b', title: 'Producto con variantes: crea, vende y mira el impacto', time: '8 min', category: 'Productos' },
      { id: 'v2t4c', title: 'Producto compuesto: crea, vende y mira el impacto', time: '7 min', category: 'Productos' },
    ],
  },
  {
    num: 3,
    name: 'Punto de Venta y Pedidos',
    emoji: '🛒',
    color: '#8B5CF6',
    description: 'Domina el punto de venta, pedidos, devoluciones, corte de caja y ventas desde tu tienda en línea.',
    image: '/images/aprende-sacs/modulo-3.webp',
    phase: 'Día 6-9 · Vender',
    clientStory: {
      feeling: 'El POS es el momento de la verdad — donde el cliente paga. Si algo falla aquí, pierde la venta y la confianza del comprador. Lo que más le preocupa: ¿qué pasa cuando llegue una devolución? ¿Y si mi vendedor se equivoca?',
      outcome: 'Su equipo cobra en segundos con código de barras, aplica descuentos sin calculadora, procesa devoluciones y cambios sin pánico, cierra caja al centavo y maneja pedidos con anticipos sin confundir el dinero. Cada venta queda registrada y atribuida.',
      pitch: 'Lo más importante para el cliente: aquí su negocio empieza a generar dinero medible. Cada escenario complicado (devolución, cambio, pago mixto, pedido con abono) tiene un flujo claro.',
    },
    tasks: [
      { id: 'v3t1', title: 'Tu primera venta completa en el Punto de Venta', time: '6 min', category: 'Ventas' },
      { id: 'v3t2', title: 'Búsqueda de productos: nombre, SKU, código de barras y búsqueda directa', time: '5 min', category: 'Ventas' },
      { id: 'v3t3', title: 'Vendedores y cajeros: cómo operar con tu equipo', time: '5 min', category: 'Equipo' },
      { id: 'v3t4', title: 'Descuentos, cobro mixto y registro de clientes', time: '6 min', category: 'Ventas' },
      { id: 'v3t5', title: 'Devoluciones, cambios, cancelaciones y notas de crédito', time: '7 min', category: 'Posventa' },
      { id: 'v3t6', title: 'Corte de caja: cierre de turno y control de efectivo', time: '6 min', category: 'Caja' },
      { id: 'v3t7', title: 'Pedidos: crear, editar y dar seguimiento', time: '7 min', category: 'Pedidos' },
      { id: 'v3t8', title: 'Pedidos: abonos, cobros y manejo del dinero', time: '6 min', category: 'Pedidos' },
      { id: 'v3t9', title: 'Pedidos desde tu tienda en línea: cómo llegan y cómo gestionarlos', time: '6 min', category: 'E-commerce' },
    ],
  },
  {
    num: 4,
    name: 'Puesta en Marcha',
    emoji: '🚀',
    color: '#F59E0B',
    description: 'Importa tu catálogo, carga tu inventario, trae tus clientes y arranca a vender de verdad.',
    image: '/images/aprende-sacs/modulo-4.webp',
    phase: 'Día 10 · Lanzamiento',
    clientStory: {
      feeling: 'Es el día de arranque real. Trae años de datos en otro sistema o en hojas de cálculo. El miedo: "¿y si pierdo el historial de mis clientes? ¿y si los precios suben mal? ¿y si el primer día algo falla frente al cliente?"',
      outcome: 'Migra todo limpio (catálogo, inventario, clientes con saldos pendientes), corrige los errores típicos antes de que duelan, hace una venta de prueba completa, y termina el día 1 real con su primer corte de caja en SACS sin sorpresas.',
      pitch: 'Este es el módulo que vuelve la migración un evento controlado y no un trauma. Si el partner acompaña este día específicamente, el cliente nunca lo olvida.',
    },
    tasks: [
      { id: 'v4t1', title: 'Elige tu ruta: las 3 formas de cargar tu catálogo e inventario', time: '5 min',  category: 'Planificación' },
      { id: 'v4t2', title: 'Importa tu catálogo e inventario inicial', time: '10 min', category: 'Importación' },
      { id: 'v4t3', title: 'Detecta y corrige errores post-importación', time: '6 min',  category: 'Corrección' },
      { id: 'v4t4', title: 'Importa tus clientes con todo su contexto', time: '6 min',  category: 'Clientes' },
      { id: 'v4t5', title: 'Checklist de arranque: verifica que todo esté listo', time: '6 min',  category: 'Verificación' },
      { id: 'v4t6', title: 'Tu primer día operando: venta real, corte real, problemas reales', time: '7 min',  category: 'Operación' },
    ],
  },
  {
    num: 5,
    name: 'Tu Operación Diaria',
    emoji: '📊',
    color: '#EC4899',
    description: 'Cortes de caja, reportes, recepción de mercancía, KPIs y tu rutina de operación.',
    image: '/images/aprende-sacs/modulo-5.webp',
    phase: 'Semana 2 · Rutina',
    clientStory: {
      feeling: 'Ya vende, pero opera en automático sin entender qué le dicen los números. "¿Por qué siempre me falta dinero al cierre?" "¿Cuál es mi producto que sí deja margen?" Sospecha que pierde dinero pero no sabe dónde.',
      outcome: 'Domina el dashboard en 30 segundos: sabe cuánto vendió, cuál es su ticket promedio, qué productos ya no se mueven, cuál vendedor rinde más y dónde está su mejor margen. Cierra cada día con una rutina clara — apertura, monitoreo, cierre.',
      pitch: 'Aquí el cliente pasa de "tener un POS" a "operar con datos". Es donde percibe que el sistema le devuelve valor todos los días — y por eso renueva.',
    },
    tasks: [
      { id: 'v5t1', title: 'Entiende tu corte de caja: leyendo los números', time: '6 min', category: 'Caja' },
      { id: 'v5t2', title: 'Tus reportes de ventas: las métricas que importan', time: '6 min', category: 'Reportes' },
      { id: 'v5t3', title: 'Rendimiento por vendedor y formas de pago', time: '5 min', category: 'Reportes' },
      { id: 'v5t4', title: 'Te llegó mercancía: recepción de compra', time: '6 min', category: 'Compras' },
      { id: 'v5t5', title: 'Tu dashboard: los KPIs de tu negocio', time: '5 min', category: 'Dashboard' },
      { id: 'v5t6', title: 'Tu rutina diaria y semanal recomendada', time: '5 min', category: 'Operación' },
    ],
  },
  {
    num: 6,
    name: 'Tienda en Línea y Canales Digitales',
    emoji: '🌐',
    color: '#3B82F6',
    description: 'Tu tienda en línea, pagos, envíos, pedidos digitales y canales de venta — todo con el mismo inventario.',
    image: '/images/aprende-sacs/modulo-6.webp',
    phase: 'Semana 3 · Escalar',
    clientStory: {
      feeling: 'Su tienda física ya opera bien — ahora quiere abrir el canal digital sin volverse loca. La preocupación: "¿se me va a duplicar el inventario? ¿voy a vender lo que no tengo? ¿cómo cobro y envío sin que sea un caos?"',
      outcome: 'Su tienda en línea queda lista con su marca, métodos de pago conectados (Stripe, MercadoPago), zonas de envío configuradas, y todo conectado al mismo inventario del POS. Empieza a recibir pedidos en línea mientras duerme — sin sobreventas, sin doble captura.',
      pitch: 'Este es el módulo que escala el negocio. Una venta en línea descuenta del mismo stock que el POS — un solo inventario, todos los canales. Aquí el cliente ve el verdadero ROI de SACS.',
    },
    tasks: [
      { id: 'v6t1', title: 'Configura y personaliza tu tienda en línea', time: '7 min', category: 'Tienda' },
      { id: 'v6t2', title: 'Publica productos y arma tu catálogo digital', time: '6 min', category: 'Catálogo' },
      { id: 'v6t3', title: 'Configura métodos de pago en línea', time: '6 min', category: 'Pagos' },
      { id: 'v6t4', title: 'Configura envíos, entregas y zonas de cobertura', time: '5 min', category: 'Envíos' },
      { id: 'v6t5', title: 'Tu primer pedido en línea: del carrito a la entrega', time: '7 min', category: 'Pedidos' },
      { id: 'v6t6', title: 'Conecta tus canales de venta digitales', time: '6 min', category: 'Canales' },
    ],
  },
];

// Totales útiles para mostrar en el hero
export const ACADEMY_TOTAL_MODULES = ACADEMY_MODULES.length;
export const ACADEMY_TOTAL_TASKS = ACADEMY_MODULES.reduce((sum, m) => sum + m.tasks.length, 0);
export const ACADEMY_TOTAL_MINUTES = ACADEMY_MODULES.reduce((sum, m) => {
  return sum + m.tasks.reduce((s, t) => {
    const n = parseInt(t.time, 10) || 0;
    return s + n;
  }, 0);
}, 0);
