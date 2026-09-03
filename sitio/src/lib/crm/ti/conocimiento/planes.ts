// CONOCIMIENTO DEL AGENTE · LOS PLANES (licencia).
//
// Regla del dueño (2026-09-02): los únicos precios que el agente da son los
// de LICENCIA. Plugins, suites y extras existen y se mencionan («eso se
// cotiza aparte, se ve en la reunión»), pero su precio lo da el consultor.
// Fuente de verdad: src/data/plans.ts (la página /planes). Si cambia allá,
// cambia aquí — el compilador nocturno lo revisa.

export type PlanId = 'vende' | 'controla' | 'fideliza' | 'automatiza';

export const PLANES: { id: PlanId; nombre: string; mensual: number; anualMes: number; anualTotal: number; paraQuien: string; agrega: string[]; servicios: string[] }[] = [
  {
    id: 'vende', nombre: 'Vende', mensual: 810, anualMes: 527, anualTotal: 6318,
    paraQuien: 'Tu primera tienda de ropa: cobras en el mostrador y en línea, con tallas y colores. Una sucursal.',
    agrega: [
      'Punto de venta con y sin internet; pausa la venta mientras se prueba otra talla; cambios de talla, devoluciones y cancelaciones',
      'Cortes de caja y arqueos; tickets por WhatsApp; cotizaciones; apartados con abonos y pedidos; ventas a crédito; listas de precios menudeo y mayoreo',
      'Tienda en línea con el mismo inventario del piso; Facebook, Instagram, WhatsApp y TikTok Shop; tus prendas visibles en ChatGPT',
      'Prendas por talla y color, sets y paquetes, etiquetas con código, talla y precio',
      'Facturación: 20 folios incluidos',
    ],
    servicios: ['1 sucursal', 'Soporte 9 AM–5 PM por chat de Sacs y WhatsApp', 'Tickets resueltos en 30–90 min', 'Implementación y migración de tu Excel o sistema (valor $9,500; sin costo solo con la promoción vigente)'],
  },
  {
    id: 'controla', nombre: 'Controla', mensual: 1215, anualMes: 790, anualTotal: 9477,
    paraQuien: 'Varias tiendas: qué talla hay en cada una, traspasos, CEDIS, conteo, compras de temporada y reportes.',
    agrega: [
      'Qué talla hay en cada tienda al momento; reparto desde tu CEDIS; traspasos entre tiendas; resurtido por curva; aviso de corrida rota y de prenda colgada',
      'Conteo físico por corrida sin cerrar la tienda; kardex; faltantes y diferencias',
      'Pedidos a proveedor y lo que le debes; recepción contra pedido; gastos; complementos de pago y notas de crédito',
      'Clientas con lo que se han llevado; metas y comisiones por vendedor; permisos por persona y tienda',
      '50+ reportes; ABC, rotación y sell-through por modelo, talla y tienda; costo y utilidad por prenda; comparativa contra la misma temporada del año pasado',
      'Temporada, colección y drop como etiqueta de cada modelo',
    ],
    servicios: ['Multi-sucursal', 'Reunión de introducción', 'Soporte 9 AM–5 PM', 'Tickets en 30–90 min', 'Implementación y migración de tu Excel o sistema (valor $9,500; sin costo solo con la promoción vigente)'],
  },
  {
    id: 'fideliza', nombre: 'Fideliza y Multiplica', mensual: 1890, anualMes: 1229, anualTotal: 14742,
    paraQuien: 'La clienta que vuelve cada temporada: ficha de clienta, monedero y puntos, portal, tarjetas de regalo, correo y WhatsApp a tus clientas, membresías. Es el más popular.',
    agrega: [
      'Ficha de la clienta con lo que compró en tienda y en línea; grupos por lo que compran; notas y seguimientos',
      'Monedero electrónico y puntos; niveles de clienta y premios; valen en mostrador y en línea',
      'Portal con tu marca donde la clienta ve sus compras y se autofactura; tarjetas de regalo físicas y digitales',
      'Correos a grupos de clientas (hasta 1,000 contactos); avisos y campañas por WhatsApp (hasta 200 contactos activos)',
      'Membresía mensual de clienta frecuente con cobro automático',
    ],
    servicios: ['Multi-sucursal', 'Reunión mensual', 'Soporte 9 AM–5 PM', 'Tickets en 15–30 min', 'Implementación y migración prioritaria (valor $9,500; sin costo solo con la promoción vigente)'],
  },
  {
    id: 'automatiza', nombre: 'Automatiza', mensual: 3780, anualMes: 2457, anualTotal: 29484,
    paraQuien: 'La IA que mueve tu inventario por ti: especialista IA dedicado, AXO (copiloto), reglas «si pasa esto, haz esto otro», avisos, pronóstico de temporada, agentes de IA e integraciones.',
    agrega: [
      'Especialista IA dedicado: una persona real que diseña tus automatizaciones contigo, con sesión mensual',
      'AXO, copiloto IA: pregúntale cuánto llevas vendido del modelo nuevo y actúa; te avisa de la talla que se va a agotar',
      'Reglas automáticas: se acaba una talla → sale el pedido al proveedor; se vende → avisa, factura y baja existencia',
      'Avisos por WhatsApp o correo cuando la venta o la existencia se salen de lo normal',
      'Reportes automáticos, tableros por rol, pronóstico de demanda por modelo y tienda; la IA propone el traspaso que completa la corrida y tú apruebas',
      'API abierta e integraciones con +600 apps; 1,000 créditos de IA al mes',
    ],
    servicios: ['Multi-sucursal', 'Especialista IA dedicado', 'Onboarding de automatización', 'Soporte 24/7', 'Tickets en <2 min', 'Implementación y migración (valor $9,500; sin costo solo con la promoción vigente)'],
  },
];

export const UNIVERSAL = [
  'Punto de venta', 'Tienda en línea', 'Vende en Facebook, Instagram y TikTok Shop', 'Tus prendas aparecen en Google, ChatGPT y Gemini',
  'Dispositivos y usuarios ilimitados', 'Modelos ilimitados con todas sus tallas y colores', '3 cajas cobrando a la vez (más, sin costo por caja)',
  'Espacio ilimitado para fotos', 'Actualizaciones mensuales', 'Sin contratos de permanencia',
];

export const REGLAS_PRECIO = `
CÓMO SE COBRA (lo que el agente SÍ dice)
- Los precios son MENSUALES y POR SUCURSAL, en pesos mexicanos; el pago anual sale ~35 % más barato.
- Cuenta como sucursal cada ubicación con inventario: un almacén o bodega cuenta igual que una tienda (4 tiendas + 1 bodega = 5).
- Cada plan incluye todo lo del anterior. Sin permanencia. La implementación y migración de tu Excel o sistema la hacemos nosotros: vale $9,500 y va SIN COSTO solo cuando hay una promoción vigente (ver PROMOCIÓN VIGENTE si aparece en el contexto; si no aparece, no la prometas gratis).
- Los planes: Vende $810 · Controla $1,215 · Fideliza y Multiplica $1,890 (el más popular) · Automatiza $3,780 — al mes por sucursal.
  En anual: $527 · $790 · $1,229 · $2,457 al mes por sucursal.
- Cuando pregunten «¿cuánto cuesta?» SIN que sepamos giro y número de tiendas: el marco («planes desde $527 al mes por sucursal en anual hasta el más completo; cuál te queda depende de lo que necesites; según el caso suele haber distintos tipos de descuento y eso lo ve el consultor en la demo») y regresa a entender el negocio.
- Cuando ya sabes giro y tiendas: el precio de lista del plan que le queda (una tienda → Vende; varias → Controla; quiere clientas que vuelvan → Fideliza) y la demo para aterrizarlo. Nunca el monto de un descuento.

LO QUE VA CON EL PLAN SEGÚN EL GIRO (no se vende aparte)
- Las suites son segmentación por giro: consignación para tiendas de consignación (y boutiques que la trabajan), joyería para joyería fina, torre de control para giras, órdenes de servicio para taller de novias/joyería. Se instalan por ser de ese giro.
LO QUE NO SE COTIZA POR MENSAJE (solo se menciona; el consultor lo ve en la reunión)
- Extras y plugins: probador virtual, fotografía y video con IA, lookbooks, pre-órdenes, RFID, bancos, empleados, etc.
- Descuentos a la medida, precios especiales, condiciones de contrato y facturación. (La PROMOCIÓN VIGENTE sí se menciona: ver regla abajo.)

PROMOCIÓN VIGENTE (cuando el contexto la traiga)
- Al dar precio o cuando pregunte por costos, menciónala UNA vez como un plus real, con naturalidad y sin sonar vendedor: «además, esta semana y media está el 35 % en el anual y la implementación y migración (que vale $9,500) va sin costo». Di hasta cuándo aplica. No la repitas en cada mensaje; si el lead ya la conoce (OFERTA YA DICHA), úsala solo para dar contexto de tiempo cuando decida.
- Nunca inventes promociones ni cambies los números; si la promoción venció, no la menciones ni la prometas.
Frase que funciona: «eso lo tenemos; en la demo el consultor lo aterriza con tu operación».
POR TAMAÑO: 1–2 tiendas → habla de vender rápido, tallas y colores y su tienda en línea integrada (plan Vende o Controla). 3+ tiendas → control y automatización (Controla, Fideliza, Automatiza). Pregunta cuántas tiendas ANTES de dar precio.
`;

export function planesTexto(): string {
  return PLANES.map(p => `${p.nombre.toUpperCase()} — $${p.mensual.toLocaleString('es-MX')}/mes por sucursal (anual: $${p.anualMes.toLocaleString('es-MX')}/mes)
Para quién: ${p.paraQuien}
Agrega: ${p.agrega.join('; ')}.
Servicio: ${p.servicios.join(' · ')}.`).join('\n\n')
    + `\n\nEN TODOS LOS PLANES: ${UNIVERSAL.join(' · ')}.\n` + REGLAS_PRECIO;
}
