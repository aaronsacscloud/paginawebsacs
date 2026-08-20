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
  opciones: { soloSiParar?: boolean; detalle?: string } = {},
): Promise<number> {
  if (!contactId) return 0;
  const { soloSiParar = true, detalle } = opciones;

  const { data: activos } = await supabase.from('automation_enrollments')
    .select('id, automation_id')
    .eq('contact_id', contactId).eq('estado', 'activo');
  if (!activos?.length) return 0;

  let ids = activos.map((e: any) => e.id);

  if (soloSiParar) {
    const autoIds = [...new Set(activos.map((e: any) => e.automation_id))];
    const { data: autos } = await supabase.from('automations')
      .select('id, parar_si_responde').in('id', autoIds);
    // Un embudo que no se encuentra se trata como "sí parar": ante la duda,
    // callarse. El costo de callar de más es un correo que no salió; el de
    // hablar de más es una queja de spam.
    const noParan = new Set((autos || []).filter((a: any) => a.parar_si_responde === false).map((a: any) => a.id));
    ids = activos.filter((e: any) => !noParan.has(e.automation_id)).map((e: any) => e.id);
  }
  if (!ids.length) return 0;

  const razon = detalle ? `${TEXTO[motivo]} — ${detalle.slice(0, 120)}` : TEXTO[motivo];
  const { data } = await supabase.from('automation_enrollments')
    .update({
      estado: 'detenido',
      unenrollment_reason: razon,
      next_action_at: null,       // que el runner no lo vuelva a mirar
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', ids).select('id');
  return (data || []).length;
}
