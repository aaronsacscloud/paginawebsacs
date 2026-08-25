// LEADS v2 · El estatus operativo del lead: QUÉ tan viva está la relación.
//
// Es la segunda dimensión del modelo (la primera es lifecycle_stage = quién
// es). El enum es FIJO en código, se DERIVA de hechos (el cron nocturno
// /api/cron/leads-estatus lo recalcula entero) y vive MATERIALIZADO en
// contacts.estatus_lead para poder filtrar en SQL.
//
// La escalera técnica tiene 10 peldaños, pero al humano se le enseñan 5
// GRUPOS con color (regla del veredicto UI: nadie opera con 10 estados en
// la cabeza). El snooze (retenido_hasta) NO es un estatus: es un velo.

export const ESTATUS_LEAD = [
  'nuevo', 'contactado', 'sin_respuesta', 'respondio', 'descubrimiento',
  'agendado', 'demo_hecha', 'cotizado', 'negociando', 'descartado',
] as const;
export type EstatusLead = typeof ESTATUS_LEAD[number];

export const ESTATUS_LABEL: Record<EstatusLead, string> = {
  nuevo: 'Sin tocar', contactado: 'Contactado', sin_respuesta: 'No contesta',
  respondio: 'Respondió', descubrimiento: 'Discovery hecho', agendado: 'Agendó demo',
  demo_hecha: 'Demo hecha', cotizado: 'Cotizado', negociando: 'Negociando',
  descartado: 'Descartado',
};

// Los 5 grupos de presentación (color de paleta.ts por SIGNIFICADO):
//   comprometido = verde (agendó o más: hay dinero en la mesa)
//   activo       = morado (nos respondió, la bola está en juego)
//   frio         = rojo (lo tocamos ≥3 veces y no contesta)
//   pendiente    = gris (nuestro turno: aún no lo trabajamos)
//   fuera        = neutro apagado (descartado)
export type GrupoEstatus = 'comprometido' | 'activo' | 'frio' | 'pendiente' | 'fuera';
export const GRUPO_DE: Record<EstatusLead, GrupoEstatus> = {
  nuevo: 'pendiente', contactado: 'pendiente', sin_respuesta: 'frio',
  respondio: 'activo', descubrimiento: 'activo',
  agendado: 'comprometido', demo_hecha: 'comprometido', cotizado: 'comprometido', negociando: 'comprometido',
  descartado: 'fuera',
};

export const COLOR_GRUPO: Record<GrupoEstatus, { fondo: string; tinta: string }> = {
  comprometido: { fondo: '#EAF8F2', tinta: '#1E8A63' },
  activo: { fondo: '#EEECFE', tinta: '#5B4BD6' },
  frio: { fondo: '#FEF0EF', tinta: '#C0554E' },
  pendiente: { fondo: '#f1f1f4', tinta: '#666' },
  fuera: { fondo: '#f1f1f4', tinta: '#999' },
};

/** Pastilla lista para pintar: etiqueta + colores. `retenido` la vela en ámbar. */
export function pintaEstatus(estatus?: string | null, retenidoHasta?: string | null) {
  if (retenidoHasta && new Date(retenidoHasta) > new Date())
    return { label: 'Pidió tiempo', fondo: '#FFF4E5', tinta: '#9a6a10' };
  const e = (estatus || 'nuevo') as EstatusLead;
  const c = COLOR_GRUPO[GRUPO_DE[e] || 'pendiente'];
  return { label: ESTATUS_LABEL[e] || e, ...c };
}

/** Valores para el builder de filtros (etiquetas humanas). */
export const ESTATUS_VALORES = ESTATUS_LEAD.map(v => ({ v, l: ESTATUS_LABEL[v] }));
