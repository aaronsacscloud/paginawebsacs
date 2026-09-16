// Catálogo de dónde se trabaja dentro de SACS.
//
// Existe para que "módulo" deje de ser un campo de texto libre. Escrito a mano,
// la misma pantalla acaba capturada como "conteos", "Conteo físico" y "conteos
// fisicos", y después no hay forma de contar cuántas capacitaciones se dieron
// de inventario ni de cruzarlas con lo que el cliente empezó a usar.
//
// Los diecisiete primeros son los módulos reales que reporta el puente con
// SACS —los mismos nombres, para que crucen sin traducción—. Lo demás son
// lugares donde también se trabaja y que no son módulos: los reportes, la
// configuración inicial, el catálogo.
export const MODULOS_SACS: { familia: string; modulos: string[] }[] = [
  { familia: 'Ventas', modulos: ['Punto de venta', 'Pedidos / eCommerce', 'Apartados', 'Reparaciones / taller', 'Eventos y salones'] },
  { familia: 'Inventario', modulos: ['Transferencias', 'Conteos físicos', 'Órdenes de compra', 'Catálogo de productos', 'Mínimos y máximos'] },
  { familia: 'Clientes', modulos: ['Catálogo de clientes', 'Programa de lealtad', 'Promociones', 'Tarjetas de regalo'] },
  { familia: 'Administración', modulos: ['Cortes de caja', 'Gastos', 'Cuentas de efectivo / bancos', 'Proveedores', 'Facturación electrónica'] },
  { familia: 'Reportes', modulos: ['Reporte de ventas', 'Reporte de inventario', 'Reporte ejecutivo', 'Otro reporte'] },
  { familia: 'Otros', modulos: ['Configuración de la cuenta', 'Usuarios y permisos', 'Sucursales', 'App móvil', 'Otro'] },
];

/** Todos los nombres en una lista plana, para validar. */
export const MODULOS_PLANOS = MODULOS_SACS.flatMap(f => f.modulos);

/* ═══════════════ EL MENÚ REAL DE SACS ═══════════════
 *
 * Lo de arriba es el vocabulario del PUENTE: los diecisiete nombres con los que
 * SACS reporta el uso, y los que cruzan contra `crm_plan_modulos`. No se toca.
 *
 * Esto otro es DÓNDE SE TRABAJA, y son las secciones del sistema tal como las
 * ve el cliente en su menú. Son dos cosas distintas y por eso son dos listas:
 * el puente no reporta «Certificados de Autenticidad», pero una orden del
 * taller sí se hace ahí, y con el catálogo corto no había forma de decirlo —de
 * las 81 mejoras de Ruben's, 69 tenían el módulo vacío—.
 *
 * FUENTE: `sacs3/src/elem/lateral/lateral.js`, la propiedad `menu`. Es la única
 * buena: `views/configuracion/configuracion.js` se genera desde ahí y va
 * desfasado, y el editor de permisos por grupo tampoco tiene catálogo propio
 * —`services/menu_modules_extractor.js` recorre ESE mismo arreglo en runtime—.
 * Si el menú de SACS cambia, esta lista se vuelve a sacar de ahí.
 *
 * Se recortó a propósito la parte de Reportes: el menú trae más de ochenta
 * cortes («Ventas por Vendedor», «por Categoría», «por Sucursal»…) y elegir
 * entre ochenta no es elegir. Quedan los reportes como destino, no cada corte.
 */
export const MENU_SACS: { familia: string; modulos: string[]; giro?: string }[] = [
  { familia: 'Joyería', giro: 'joyer', modulos: [
    'Metales y valuación', 'Productos a repreciar', 'Actualización masiva', 'Compras de metal',
    'Certificados de Autenticidad', 'Precio dinámico', 'Combos de costos', 'LFPIORPI'] },
  { familia: 'Órdenes de servicio', modulos: [
    'Órdenes de servicio', 'Catálogos de servicio', 'Joyeros', 'Productos en reparación', 'Resumen de órdenes'] },
  { familia: 'Ventas', modulos: [
    'Punto de Venta', 'Comercio en Línea', 'Transacciones', 'Promociones', 'Ventas de impulso',
    'Venta Cruzada', 'Cotizaciones', 'Pedidos', 'Metas y Comisiones', 'Propinas', 'Apartados', 'Contratos'] },
  { familia: 'Canales de venta', modulos: [
    'Meta', 'TikTok Shop', 'Google Merchant Center', 'Google My Business', 'MercadoLibre',
    'Amazon', 'Rappi', 'Uber Tiendas', 'Didi Tiendas'] },
  { familia: 'Inventarios', modulos: [
    'Productos', 'Colecciones', 'Insumos', 'Modificadores', 'Conteo físico', 'Transferencias',
    'Solicitud de mercancía', 'Recepción de productos', 'Impresión de etiquetas', 'Verificador',
    'Nivelación de inventario', 'Reglas de catálogo', 'Resurtido de inventario', 'Productos Inactivos',
    'Mermas y Ajustes', 'Control de Costos', 'Kardex', 'Demanda Insatisfecha'] },
  { familia: 'Administración', modulos: [
    'Proveedores', 'Gastos', 'Cuentas de Efectivo y Bancos', 'Cuentas por pagar', 'Órdenes de Compra'] },
  { familia: 'Clientes', modulos: [
    'Clientes', 'Programa de Lealtad', 'Membresías', 'Portal de Clientes', 'Dinámicas',
    'Tarjetas de regalo', 'Embudos y Campañas'] },
  { familia: 'Facturación', modulos: ['Facturas', 'Complementos de pago', 'Notas de crédito'] },
  { familia: 'Empleados', modulos: [
    'Dashboard Empleados', 'Lista Empleados', 'Talento y Cultura', 'Expedientes', 'Solicitudes',
    'Control Asistencia', 'Cuadrante de Horarios', 'Control Actas'] },
  { familia: 'Consignación', giro: 'consignac', modulos: [
    'Dashboard de consignación', 'Colas de proceso', 'Incidentes', 'Importar', 'Solicitudes de retiro', 'Reportes de consignación'] },
  { familia: 'Eventos', giro: 'evento', modulos: [
    'Dashboard de eventos', 'Aforo', 'Reservaciones', 'Espacios', 'Paquetes', 'Calendario', 'Check-in'] },
  { familia: 'Tienda en línea', modulos: [
    'Inicio de la tienda', 'Métricas del sitio web', 'Identidad y posicionamiento', 'Personalización de páginas',
    'Widgets de e-commerce', 'Influencers', 'Cupones y promociones', 'Colecciones en línea',
    'Carrito abandonado', 'Notificaciones de la tienda'] },
  { familia: 'Reportes', modulos: [
    'Resumen de reportes', 'Cortes de caja', 'Movimientos de caja', 'Análisis de ventas', 'Reporte personalizado',
    'Dashboard de Inventario', 'Cuentas por cobrar', 'Reporte de lealtad', 'Reporte de clientes',
    'Reporte Ejecutivo', 'Auditoría', 'KDS'] },
  { familia: 'Configuración', modulos: [
    'Negocio', 'Sucursales', 'Folios', 'Usuarios y permisos', 'Integraciones', 'Notificaciones',
    'Impuestos', 'Monedas y tipo de cambio', 'Terminales', 'Formas de pago', 'Ticket de venta',
    'Suite Joyería', 'Suite de Consignación'] },
  { familia: 'Otros', modulos: ['AXO', 'Academia', 'Dashboard', 'App móvil', 'Otro'] },
];

/** Todos los nombres del menú, en plano, para validar lo que llega. */
export const MENU_PLANOS = MENU_SACS.flatMap(f => f.modulos);

/** Vale como módulo lo que esté en el menú o en el vocabulario del puente: los
 *  renglones viejos se capturaron con el corto y no se van a invalidar solos. */
export const esModuloValido = (m?: string | null) =>
  !!m && (MENU_PLANOS.includes(m) || MODULOS_PLANOS.includes(m));

/** El menú con la familia del giro del cliente ARRIBA.
 *  Con una joyería, «Metales y valuación» es lo primero que se busca; con una
 *  boutique, «Punto de Venta». Ordenar por el giro ahorra el scroll que hace
 *  que la gente se salte el campo. */
export function modulosParaGiro(giro?: string | null) {
  const g = String(giro || '').toLowerCase();
  if (!g) return MENU_SACS;
  const mio = MENU_SACS.filter(f => f.giro && g.includes(f.giro));
  return mio.length ? [...mio, ...MENU_SACS.filter(f => !mio.includes(f))] : MENU_SACS;
}

/** A qué familia pertenece un módulo (para agrupar en los reportes). */
export function familiaDe(modulo?: string | null): string | null {
  if (!modulo) return null;
  return (MENU_SACS.find(f => f.modulos.includes(modulo))
    || MODULOS_SACS.find(f => f.modulos.includes(modulo)))?.familia || null;
}

// ── Cómo se dio (o se dará) una capacitación ────────────────────────────────
// El modo es explícito y no se adivina por si hay liga: un video que TODAVÍA no
// se manda es exactamente el caso que hay que poder ver, y adivinando por la
// liga se vería igual que uno que nunca fue video.
export type ModoCapacitacion = 'junta' | 'video' | 'agendada';

export const MODOS: Record<ModoCapacitacion, { label: string; pendiente: string; hecho: string; ayuda: string }> = {
  junta:    { label: 'En una junta',        pendiente: 'por dar',      hecho: 'impartida', ayuda: 'Se enseñó en vivo, en una reunión con su equipo.' },
  video:    { label: 'Por video',           pendiente: 'por enviar',   hecho: 'enviado',   ayuda: 'Se le manda un video de eso que preguntó. Sin liga todavía, queda pendiente de enviar.' },
  agendada: { label: 'En la próxima junta', pendiente: 'agendada',     hecho: 'impartida', ayuda: 'Ya quedó de verse en una reunión que aún no ocurre.' },
};

export const modoDe = (m: any): ModoCapacitacion =>
  (MODOS[m?.modo as ModoCapacitacion] ? m.modo : (m?.url ? 'video' : 'junta')) as ModoCapacitacion;

/** Cómo se llama el estado de una capacitación según su modo. */
export function etiquetaCap(m: any): { texto: string; hecha: boolean } {
  const hecha = m?.estado === 'entregada';
  const modo = MODOS[modoDe(m)];
  return { texto: hecha ? modo.hecho : modo.pendiente, hecha };
}
