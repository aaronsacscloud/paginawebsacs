// SOPORTE · Rollup denormalizado por empresa. Agrega crm_soporte_tickets y
// escribe companies.soporte_* (lo leen health, el panel de Riesgo y la tabla de
// suscripciones sin N consultas). De paso RECALCULA la salud con la penalización
// de soporte, usando la actividad/uso ya persistidos, para que el health baje en
// cuanto entra o envejece un ticket (no hasta el próximo sync de 6 h).
import { supabase } from '../supabase';
import { healthScoreV2, type SoporteSalud } from './health';

export const SLA_ESTANCADO_HORAS = 48;   // ticket abierto sin actividad → estancado
const ABIERTO = ['abierto', 'en_curso', 'pausado'];   // NO resuelto/cerrado

const PESO_SENT: Record<string, number> = { urgente: 3, negativo: 2, neutral: 1 };
function peorSentimiento(vals: (string | null | undefined)[]): string | null {
  let best: string | null = null, bestW = 0;
  for (const v of vals) { const w = PESO_SENT[v || ''] || 0; if (w > bestW) { bestW = w; best = v || null; } }
  return best;
}

/** Recalcula el rollup de soporte de UNA empresa y persiste companies.soporte_* +
 *  health. Idempotente. No lanza (loguea y sigue). */
export async function recomputarSoporteEmpresa(companyId: string): Promise<void> {
  if (!companyId) return;
  try {
    const { data: tks } = await supabase
      .from('crm_soporte_tickets')
      .select('estado, sentimiento, ultima_actividad_at, primera_respuesta_at, abierto_at')
      .eq('company_id', companyId);
    const tickets = tks || [];
    const abiertosArr = tickets.filter((t: any) => ABIERTO.includes(t.estado));
    const abiertos = abiertosArr.length;
    const corte = Date.now() - SLA_ESTANCADO_HORAS * 3600_000;
    const estancado = abiertosArr.some((t: any) => {
      const ref = t.ultima_actividad_at || t.abierto_at;
      return ref ? new Date(ref).getTime() < corte : false;
    });
    const sentimiento = peorSentimiento(abiertosArr.map((t: any) => t.sentimiento));

    const soporte: SoporteSalud = { abiertos, estancado, sentimiento };

    // Recalcular health con la actividad/uso ya guardados.
    const { data: co } = await supabase
      .from('companies').select('actividad, uso_sacs').eq('id', companyId).maybeSingle();
    const upd: any = {
      soporte_abiertos: abiertos,
      soporte_estancado: estancado,
      soporte_sentimiento: sentimiento,
      soporte_computed_at: new Date().toISOString(),
    };
    if (co) {
      const { score, factors } = healthScoreV2(co.actividad || {}, co.uso_sacs || null, soporte);
      upd.health_score = score;
      upd.health_factors = factors;
      upd.health_computed_at = new Date().toISOString();
    }
    await supabase.from('companies').update(upd).eq('id', companyId);
  } catch (e) {
    console.error('recomputarSoporteEmpresa', companyId, (e as any)?.message || e);
  }
}
