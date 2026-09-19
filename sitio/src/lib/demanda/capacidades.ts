// DEMAND ENGINE · lo que Sacs hace de verdad.
//
// UNA SOLA FUENTE DE VERDAD, y esta es la razón: el motor escribe páginas
// públicas con un modelo. Un modelo, si no se le dice qué existe, completa el
// hueco con lo que suena razonable — y lo que suena razonable en un software de
// tiendas es casi cualquier función. Una página que promete algo que Sacs no
// hace no es un error de estilo: es una venta que se cae en la demo y un
// cliente que se siente engañado.
//
// Todo lo de aquí está verificado contra `sacs3/src/views` (las carpetas de
// módulos del sistema) y contra `planes.astro` (los precios). Lo que no está
// aquí, el motor NO puede afirmarlo. Si hace falta agregar algo, se verifica
// primero y se agrega aquí, no en el prompt de turno.
//
// La regla al mantenerlo: describe lo que el sistema HACE, no lo que el
// marketing diría. «Reserva la talla exacta» es una capacidad; «potencia tus
// ventas» no es nada.

export const PRECIOS = {
  vende: 810, controla: 1215, fideliza: 1890, automatiza: 3780,
  unidad: 'MXN al mes por tienda, sin contratos',
  nota: 'El plan Vende ya incluye tallas y colores, traspasos entre tiendas y sell-through.',
} as const;

/** Agrupadas por el problema que resuelven, que es como pregunta la gente. */
export const CAPACIDADES: Record<string, string[]> = {
  'Inventario de moda': [
    'Matriz de talla y color: una prenda con sus variantes, cada combinación con su existencia y su código',
    'Corrida completa por sucursal, visible en una pantalla',
    'Calzado por número, con medios números y horma',
    'Joyería por gramaje y quilataje, con costo histórico inmutable',
    'Conteo físico y ajustes de existencia',
    'Kardex y trazabilidad de movimientos',
  ],
  'Decisiones de compra y temporada': [
    'Curva de tallas: qué proporción de cada talla comprar, corregida por los días que cada talla estuvo agotada',
    'Sell-through por estilo y por talla contra las semanas de temporada',
    'Días en anaquel y productos sin movimiento',
    'Demanda insatisfecha: lo que se pidió y no había',
    'Mínimos y máximos automáticos por producto y sucursal',
    'Órdenes de compra y recepciones',
  ],
  'Varias tiendas': [
    'Nivelación: propone qué mover de qué tienda a cuál según la venta de cada una',
    'Traspasos entre sucursales y CEDIS',
    'Solicitud de mercancía de la tienda al centro',
    'Comparativo de ventas y de cortes por almacén',
  ],
  'Venta y mostrador': [
    'Punto de venta con modo offline que sincroniza al reconectar',
    'Apartados: reservan la talla exacta, bajan la disponibilidad en línea, abonos y vencimiento con regla',
    'Pedidos y cotizaciones',
    'Cambios, devoluciones y cancelaciones',
    'Cortes de caja, arqueo, movimientos y caja chica',
    'Vendedores y cajeros con permisos; comisiones y metas',
    'Promociones y dinámicas; ventas de impulso',
  ],
  'Vender en línea y en redes': [
    'Tienda en línea propia con el MISMO inventario del mostrador',
    'Mercado Libre, Shopify, WooCommerce y TikTok Shop',
    'WhatsApp conectado al inventario: cotizar, cobrar y enviar el ticket',
    'Carritos abandonados, cupones, colecciones e influencers en la tienda en línea',
  ],
  'Mayoreo y consignación': [
    'Listas de precio por cliente; menudeo y mayoreo sobre la misma existencia',
    'Consignación completa: consignatarios, retiros, incidentes y estado de cuenta',
    'Evaluación de proveedores',
  ],
  'Dinero y fiscal': [
    'Facturación CFDI 4.0 nativa',
    'Autofacturación por QR desde el ticket, sin que el cajero intervenga',
    'Addendas por cliente para departamentales',
    'Gastos, cuentas por pagar, cuentas de efectivo y bancos',
    'Reporte ejecutivo y estado de resultados por tienda',
  ],
  'Clientes': [
    'CRM con ficha de cliente e historial',
    'Programa de lealtad, tarjetas de regalo y membresías',
    'Portal de clientes y estado de cuenta',
    'Marketing por correo y por WhatsApp',
  ],
  'Especialidades por giro': [
    'Listas escolares por colegio y grado (uniformes y papelería)',
    'Órdenes de servicio y taller, con portal del técnico y del cliente',
    'Renta con calendario por pieza',
    'Venta por metro, peso o fracción (telas, granel)',
    'Eventos y merch en vivo con almacén por módulo',
  ],
};

/** Las páginas propias a las que una guía puede enlazar. NO se inventan slugs:
 *  un enlace inventado publica un 404 desde nuestro propio sitio. La lista se
 *  lee de la base al escribir; esto es solo el mapa de qué trata cada una. */
export const GUIAS: Record<string, string> = {
  'curva-de-tallas': 'qué proporción de cada talla comprar',
  'sell-through': 'qué porcentaje de lo comprado ya se vendió',
  'nivelacion-inventario-entre-tiendas': 'mover mercancía entre sucursales',
  'apartados-tienda-de-ropa': 'apartados, abonos, plazos y cancelaciones',
  'ropa-que-no-se-vende': 'detectar inventario parado antes de rematarlo',
  'inventario-talla-color-sucursales': 'existencias por talla y color en varias tiendas',
  'corridas-rotas-zapateria': 'corridas incompletas en calzado',
  'que-tallas-recomprar': 'la recompra por talla para la próxima temporada',
  'tienda-fisica-y-en-linea': 'un solo inventario para mostrador y tienda en línea',
  'catalogo-de-mayoreo': 'vender a otras tiendas',
  'whatsapp-para-tiendas-de-ropa': 'vender y cobrar por WhatsApp',
};

/** Las tres herramientas gratis, que son el mejor cierre de una guía: quien
 *  calcula con sus números deja de leer y empieza a probar el producto. */
export const HERRAMIENTAS: Record<string, string> = {
  'curva-de-tallas': 'calcula la curva de tallas real de tu venta',
  'nivelar-entre-tiendas': 'dice qué mover entre tiendas para reparar corridas',
  'sale-o-no-sale': 'dice si un estilo sale antes de que acabe la temporada',
};

/** El bloque que se le da al modelo. Se arma una vez y se reusa, para que
 *  brief y borrador trabajen con exactamente la misma verdad. */
export function fichaSacs(): string {
  const caps = Object.entries(CAPACIDADES)
    .map(([grupo, xs]) => `${grupo}:\n${xs.map(x => `  - ${x}`).join('\n')}`)
    .join('\n');
  const guias = Object.entries(GUIAS).map(([s, q]) => `  /recursos/${s}/ — ${q}`).join('\n');
  const herr = Object.entries(HERRAMIENTAS).map(([s, q]) => `  /herramientas/${s} — ${q}`).join('\n');

  return `QUÉ ES SACS
Sistema de punto de venta e inventario para tiendas de ropa, calzado y joyería en México. Hecho para moda: el inventario se lleva por talla y color, no por cantidad.

PRECIOS (exactos, no redondear ni inventar promociones)
Vende $${PRECIOS.vende} · Controla $${PRECIOS.controla} · Fideliza $${PRECIOS.fideliza} · Automatiza $${PRECIOS.automatiza}
${PRECIOS.unidad}. ${PRECIOS.nota}

LO QUE SACS HACE (si no está aquí, NO existe para efectos de lo que escribas)
${caps}

GUÍAS PUBLICADAS a las que puedes enlazar (usa el slug tal cual o ninguno)
${guias}

HERRAMIENTAS GRATIS, sin registro
${herr}`;
}
