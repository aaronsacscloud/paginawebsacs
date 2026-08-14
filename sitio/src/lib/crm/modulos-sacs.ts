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

/** A qué familia pertenece un módulo (para agrupar en los reportes). */
export function familiaDe(modulo?: string | null): string | null {
  if (!modulo) return null;
  return MODULOS_SACS.find(f => f.modulos.includes(modulo))?.familia || null;
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
