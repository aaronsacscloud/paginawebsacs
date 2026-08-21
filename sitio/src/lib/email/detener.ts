/**
 * Detener recorridos por una señal humana.
 *
 * Cuando alguien CONTESTA un correo, ya no es un destinatario: es una
 * conversación. Seguirle mandando el paso 3 de una secuencia mientras un
 * humano le está respondiendo el paso 2 es la forma más rápida de convertir
 * un lead interesado en una queja de spam — y la queja no solo mata la
 * campaña, mancha el dominio para todos los inquilinos.
 *
 * Se detiene, no se borra: el recorrido queda con su motivo, así que en la
 * ficha se ve "se detuvo porque respondió" y no un hueco inexplicable.
 */
import { supabase } from '../supabase';
import { cualesDetener, SALIDA } from './puro';

export type MotivoDetencion = 'respondio' | 'baja' | 'rebote' | 'queja' | 'manual';

const TEXTO: Record<MotivoDetencion, string> = {
  respondio: 'Respondió el correo: pasa a conversación humana',
  baja: 'Pidió no recibir más correos',
  rebote: 'El correo rebotó de forma permanente',
  queja: 'Marcó el correo como spam',
  manual: 'Detenido a mano',
};

/**
 * Detiene los recorridos ACTIVOS de una persona.
 *
 * `soloSiParar` respeta el interruptor por embudo: un embudo transaccional
 * —recordatorio de pago, aviso de vencimiento— normalmente NO debe detenerse
 * porque alguien conteste "gracias".
 */
export async function detenerRecorridos(
  contactId: string,
  motivo: MotivoDetencion,
  opciones: { soloSiParar?: boolean; detalle?: string; tenantId?: string | null } = {},
): Promise<number> {
  if (!contactId) return 0;
  const { soloSiParar = true, detalle, tenantId } = opciones;

  const { data: activos } = await supabase.from('automation_enrollments')
    .select('id, automation_id')
    .eq('contact_id', contactId).eq('estado', 'activo');
  if (!activos?.length) return 0;

  const autoIds = [...new Set(activos.map((e: any) => e.automation_id))];
  const { data: autos } = await supabase.from('automations')
    .select('id, parar_si_responde, tenant_id').in('id', autoIds);

  // La decisión vive en puro.ts para poder probarla: acotar al inquilino y
  // respetar el interruptor por embudo son los dos filtros que, mal puestos,
  // dan los errores opuestos —apagarle los embudos a otro inquilino, o seguir
  // escribiéndole a quien ya contestó.
  const ids = cualesDetener(activos as any, (autos || []) as any, { tenantId, soloSiParar });
  if (!ids.length) return 0;

  const razon = detalle ? `${TEXTO[motivo]} — ${detalle.slice(0, 120)}` : TEXTO[motivo];
  const { data, error } = await supabase.from('automation_enrollments')
    .update({
      estado: SALIDA,             // 'detenido' NO existe: la base lo rechaza
      unenrollment_reason: razon,
      next_action_at: null,       // que el runner no lo vuelva a mirar
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', ids).select('id');
  // El error SÍ se mira. Postgrest no lanza cuando el valor viola el CHECK: lo
  // devuelve aquí. Solo se leía `data`, así que el fallo era invisible y el
  // sistema aseguraba haber detenido recorridos que seguían corriendo.
  if (error) {
    console.error('[detener] no se pudieron detener los recorridos:', error.message);
    return 0;
  }
  return (data || []).length;
}
