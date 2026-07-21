// Ledger de movimientos MRR — un solo lugar por donde pasan TODOS los cambios
// de MRR. Cada mutación de suscripción (alta, cambio de precio/ciclo, churn,
// reactivación) llama a recordMovement(). De aquí salen NRR/GRR, cohortes,
// churn y el waterfall de expansión/contracción.
//
// Best-effort y tolerante: si la tabla mrr_movements aún no existe (SQL-5 sin
// aplicar) NO rompe la mutación de negocio — solo se pierde la línea del ledger.
import { supabase } from '../supabase';

export type MrrTipo = 'new' | 'expansion' | 'contraction' | 'churn' | 'reactivation' | 'renewal';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Deriva el tipo de movimiento a partir del MRR antes/después.
 * anterior 0 → new · nuevo 0 → churn · sube → expansion · baja → contraction.
 */
export function tipoPorDelta(mrrAnterior: number, mrrNuevo: number, reactivacion = false): MrrTipo | null {
  const a = r2(mrrAnterior), b = r2(mrrNuevo);
  if (a === b) return null;              // sin cambio de MRR → no hay movimiento
  if (a === 0 && b > 0) return reactivacion ? 'reactivation' : 'new';
  if (a > 0 && b === 0) return 'churn';
  return b > a ? 'expansion' : 'contraction';
}

export async function recordMovement(m: {
  subscription_id?: string | null;
  company_id?: string | null;
  fecha?: string;
  tipo: MrrTipo;
  mrr_anterior: number;
  mrr_nuevo: number;
  motivo?: string | null;
  actor?: string | null;
}): Promise<void> {
  try {
    await supabase.from('mrr_movements').insert({
      subscription_id: m.subscription_id || null,
      company_id: m.company_id || null,
      fecha: m.fecha || new Date().toISOString().slice(0, 10),
      tipo: m.tipo,
      mrr_delta: r2(m.mrr_nuevo - m.mrr_anterior),
      mrr_anterior: r2(m.mrr_anterior),
      mrr_nuevo: r2(m.mrr_nuevo),
      motivo: m.motivo || null,
      actor: m.actor || null,
    }).select().maybeSingle();
  } catch { /* SQL-5 pendiente o error transitorio: no bloquear la mutación */ }
}

/**
 * Atajo: registra el movimiento correcto comparando MRR antes/después.
 * Devuelve el tipo registrado (o null si no hubo cambio).
 */
export async function recordDelta(args: {
  subscription_id?: string | null; company_id?: string | null; fecha?: string;
  mrr_anterior: number; mrr_nuevo: number; reactivacion?: boolean; motivo?: string | null; actor?: string | null;
}): Promise<MrrTipo | null> {
  const tipo = tipoPorDelta(args.mrr_anterior, args.mrr_nuevo, args.reactivacion);
  if (!tipo) return null;
  await recordMovement({ ...args, tipo });
  return tipo;
}
