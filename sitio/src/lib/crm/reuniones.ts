// Reuniones del CRM: estados, minuta y la alerta por inasistencias.
//
// El módulo de agenda ya existía para que un prospecto reservara solo desde la
// página. Lo que faltaba es lo de DESPUÉS: si llegó, qué se acordó y dónde
// quedó la grabación. Sin eso una reunión es una fila en un calendario y a los
// tres meses nadie sabe qué se habló.
//
// El estado no se sobrescribe a secas: cada cambio se apila en estado_hist con
// fecha y quién lo marcó. La alerta de inasistencias se calcula sobre eso, y un
// dato que dispara una conversación con el dueño de la cuenta tiene que poder
// auditarse.

export type EstadoReunion = 'agendada' | 'confirmada' | 'asistio' | 'no_asistio' | 'cancelada' | 'reagendada';

export const ESTADOS: Record<string, { label: string; bg: string; color: string; borde?: string }> = {
  agendada:    { label: 'Agendada',       bg: '#E3EDFD', color: '#2C5FC4' },
  confirmada:  { label: 'Confirmada',     bg: '#EEECFE', color: '#5B4BD6' },
  asistio:     { label: 'Se presentó',    bg: '#EAF8F2', color: '#1E8A63' },
  no_asistio:  { label: 'No se presentó', bg: '#FEF0EF', color: '#C0554E' },
  cancelada:   { label: 'Cancelada',      bg: '#F4F4F6', color: '#6B7280' },
  reagendada:  { label: 'Reagendada',     bg: '#F4F4F6', color: '#6B7280' },
};

// Las reuniones viejas se guardaron con otro vocabulario. En vez de migrarlas a
// ciegas —no hay forma de saber si una "realizada" de abril tuvo asistencia— se
// traducen al vuelo y el dato original se queda intacto.
const LEGADO: Record<string, EstadoReunion> = {
  pendiente: 'agendada', realizada: 'asistio', no_show: 'no_asistio', completada: 'asistio',
};
export const normalizaEstado = (e: string): EstadoReunion =>
  (ESTADOS[e] ? e : LEGADO[e] || 'agendada') as EstadoReunion;

/** Estados que se pueden marcar desde la ficha, según dónde está la reunión. */
export function siguientes(estado: string, esFutura: boolean): EstadoReunion[] {
  const e = normalizaEstado(estado);
  if (e === 'agendada')   return esFutura ? ['confirmada', 'cancelada'] : ['asistio', 'no_asistio', 'cancelada'];
  if (e === 'confirmada') return esFutura ? ['asistio', 'no_asistio', 'cancelada'] : ['asistio', 'no_asistio', 'cancelada'];
  return ['agendada', 'confirmada', 'asistio', 'no_asistio', 'cancelada'].filter(x => x !== e) as EstadoReunion[];
}

// ── Minuta ──────────────────────────────────────────────────────────────────
// Cinco preguntas iguales para todas las reuniones. Es lo que las hace servir
// después: en formato libre cada quien escribe otra cosa y buscar un acuerdo de
// hace dos meses se vuelve leer párrafos.
export const MINUTA_CAMPOS: { k: string; label: string; hint: string }[] = [
  { k: 'reviso',       label: 'Qué se revisó',           hint: 'Los temas que sí se tocaron en la sesión.' },
  { k: 'acuerdos',     label: 'Acuerdos',                hint: 'Lo que quedó decidido, no lo que se propuso.' },
  { k: 'cliente',      label: 'Compromisos del cliente', hint: 'Qué queda de su lado y para cuándo.' },
  { k: 'sacs',         label: 'Compromisos de SACS',     hint: 'Qué queda del nuestro y para cuándo.' },
  { k: 'siguiente',    label: 'Siguiente paso y fecha',  hint: 'Si no hay fecha, no hay siguiente paso.' },
];

export const minutaVacia = () => Object.fromEntries(MINUTA_CAMPOS.map(c => [c.k, ''])) as Record<string, string>;
export const minutaLlena = (m: any) => !!m && MINUTA_CAMPOS.some(c => String(m?.[c.k] || '').trim());

/** La minuta en texto plano, para copiarla a un correo o a WhatsApp. */
export function minutaTexto(b: any): string {
  const m = b?.minuta || {};
  const cab = [
    `Minuta · ${b?.event_types?.nombre || 'Reunión'}`,
    `${b?.fecha || ''} ${String(b?.hora_inicio || '').slice(0, 5)}`,
    b?.invitee_nombre ? `Con: ${b.invitee_nombre}` : '',
    b?.host_nombre ? `Por: ${b.host_nombre}` : '',
  ].filter(Boolean).join('\n');
  const cuerpo = MINUTA_CAMPOS
    .filter(c => String(m[c.k] || '').trim())
    .map(c => `\n${c.label.toUpperCase()}\n${String(m[c.k]).trim()}`).join('\n');
  return cab + '\n' + cuerpo + (b?.grabacion_url ? `\n\nGRABACIÓN\n${b.grabacion_url}` : '');
}

// ── Alerta por inasistencias ────────────────────────────────────────────────
export type AlertaInasistencia = {
  categoria: string; tipo_nombre: string; faltas: number; umbral: number;
  seguidas: number; fechas: string[];
};

/**
 * Cuenta las faltas por categoría de reunión y devuelve una alerta por cada
 * categoría que llegó a su umbral.
 *
 * El umbral vive en el tipo de reunión (event_types.alerta_inasistencias), no
 * escrito aquí: consultoría avisa a las 3 porque es lo que el cliente está
 * pagando, y mañana puede ser otro número sin tocar código. Un tipo sin umbral
 * simplemente no alerta.
 */
export function alertasInasistencia(rows: any[]): AlertaInasistencia[] {
  const porCat: Record<string, { umbral: number; nombre: string; faltas: any[]; orden: any[] }> = {};
  for (const b of rows) {
    const cat = b.event_types?.categoria || 'otro';
    const umbral = Number(b.event_types?.alerta_inasistencias || 0);
    if (!umbral) continue;
    porCat[cat] = porCat[cat] || { umbral, nombre: b.event_types?.nombre || cat, faltas: [], orden: [] };
    const e = normalizaEstado(b.estado);
    // Las canceladas no cuentan: cancelar con aviso no es plantar a nadie.
    if (e === 'asistio' || e === 'no_asistio') porCat[cat].orden.push({ e, b });
    if (e === 'no_asistio') porCat[cat].faltas.push(b);
  }
  const out: AlertaInasistencia[] = [];
  for (const [cat, v] of Object.entries(porCat)) {
    if (v.faltas.length < v.umbral) continue;
    // La racha se cuenta desde la más reciente hacia atrás: tres faltas
    // seguidas hoy no es lo mismo que tres repartidas en dos años.
    const cron = v.orden.slice().sort((a, b) => String(a.b.fecha).localeCompare(String(b.b.fecha)));
    let seguidas = 0;
    for (let i = cron.length - 1; i >= 0; i--) { if (cron[i].e === 'no_asistio') seguidas++; else break; }
    out.push({
      categoria: cat, tipo_nombre: v.nombre, umbral: v.umbral, faltas: v.faltas.length, seguidas,
      fechas: v.faltas.map((f: any) => f.fecha).sort().slice(-5),
    });
  }
  return out;
}

export function textoAlerta(a: AlertaInasistencia): string {
  const seguidas = a.seguidas >= a.umbral ? ` (${a.seguidas} seguidas)` : '';
  return `${a.faltas} inasistencias en ${a.tipo_nombre.toLowerCase()}${seguidas}.`;
}
