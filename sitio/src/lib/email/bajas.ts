// Procesar una baja: una sola función para todas las puertas de entrada
// (one-click RFC 8058, página pública, centro de preferencias, respuesta
// textual en la bandeja, panel del CRM).
//
// Hace tres cosas que tienen que ir juntas o el sistema miente: suprime,
// marca el envío que la provocó (así se sabe qué campaña quemó lista) y saca
// a la persona de TODOS los embudos activos — quedarse inscrita significaría
// recibir el siguiente paso pese a haberse dado de baja.
import { supabase } from '../supabase';

import { SALIDA } from './puro';

export interface Baja {
  tenantId: string;
  email: string;
  sendId?: string | null;
  contactId?: string | null;
  motivo?: 'baja' | 'queja' | 'rebote_duro' | 'rebote_suave' | 'dropped' | 'manual' | 'sunset';
  origen?: string;
  detalle?: string | null;
  /** Pausa temporal en vez de baja definitiva (centro de preferencias). */
  pausarHasta?: string | null;
}

export async function darDeBaja(b: Baja): Promise<{ ok: boolean; contactId: string | null }> {
  const email = String(b.email || '').trim().toLowerCase();
  if (!email || !b.tenantId) return { ok: false, contactId: null };

  let contactId = b.contactId || null;
  if (!contactId && b.sendId) {
    const { data } = await supabase.from('email_sends').select('contact_id').eq('id', b.sendId).maybeSingle();
    contactId = data?.contact_id || null;
  }
  if (!contactId) {
    const { data } = await supabase.from('contacts').select('id').eq('email', email).limit(1).maybeSingle();
    contactId = data?.id || null;
  }

  const { data: previa } = await supabase
    .from('email_suppressions').select('id, motivo')
    .eq('tenant_id', b.tenantId).eq('email', email).is('restaurado_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  // Una pausa NUNCA puede degradar una supresión permanente. Sin esto, quien
  // había marcado spam o rebotado duro y luego tocaba "pausar 30 días" en el
  // centro de preferencias volvía a ser enviable al mes siguiente.
  // Una pausa no puede degradar NADA que ya sea más fuerte, y eso incluye una
  // baja: quien canceló la suscripción y luego toca "pausar 30 días" desde un
  // correo viejo volvería a ser enviable al mes siguiente — es decir, recibiría
  // marketing después de haberse dado de baja.
  const NO_DEGRADABLES = ['queja', 'rebote_duro', 'dropped', 'baja'];
  if (b.pausarHasta && previa && NO_DEGRADABLES.includes(String(previa.motivo))) {
    return { ok: true, contactId };
  }

  const fila = {
    tenant_id: b.tenantId,
    email,
    contact_id: contactId,
    motivo: b.motivo || 'baja',
    detalle: b.detalle || null,
    origen: b.origen || 'desconocido',
    pausado_hasta: b.pausarHasta || null,
  };
  if (previa) await supabase.from('email_suppressions').update(fila).eq('id', previa.id);
  else await supabase.from('email_suppressions').insert(fila);

  if (b.sendId) {
    // ⚠️ NO pisar un estado terminal. El webhook protege con cuidado el estado
    // del envío y tres líneas después llamaba aquí, que lo sobrescribía sin
    // condición: todo rebote duro y toda queja quedaban guardados como "baja".
    // La cadena que eso rompía: `pausaSalud` cuenta estado='bounced' → siempre
    // cero → el freno automático al 2% de rebotes NUNCA se disparaba, y el
    // tablero reportaba 0 rebotes y 0 quejas justo mientras se quemaba el
    // dominio. Solo se marca la baja si el envío no tiene ya algo peor.
    const parche: Record<string, any> = { unsubscribed_at: new Date().toISOString() };
    if (!b.motivo || b.motivo === 'baja') parche.estado = 'unsubscribed';
    await supabase.from('email_sends').update(parche)
      .eq('id', b.sendId).not('estado', 'in', '(spam,bounced)');
  }

  // Fuera de todos los embudos: seguir inscrito sería recibir el paso 3 de
  // una secuencia de la que la persona acaba de salir.
  if (contactId && !b.pausarHasta) {
    // Acotado al inquilino: una baja en uno no puede apagar las inscripciones
    // de otro. Se resuelven primero los embudos de este inquilino.
    const { data: mios } = await supabase.from('automations').select('id').eq('tenant_id', b.tenantId);
    const ids = (mios || []).map((a: any) => a.id);
    if (ids.length) {
      // 'cancelado' NO es un estado permitido por la base —nunca lo fue— y
      // Postgrest devuelve el error en `error` en vez de lanzarlo. Como aquí
      // no se leía, darse de baja NUNCA sacó a nadie de un embudo: la persona
      // seguía avanzando paso a paso, cada envío chocaba con la supresión y el
      // embudo "terminaba" sin haber entregado nada.
      const { error: eSalida } = await supabase.from('automation_enrollments')
        .update({ estado: SALIDA, unenrollment_reason: 'baja de correo', completed_at: new Date().toISOString() })
        .eq('contact_id', contactId).eq('estado', 'activo').in('automation_id', ids);
      if (eSalida) console.error('[bajas] no se pudo sacar del embudo:', eSalida.message);
    }
    await supabase.from('activities').insert({
      contact_id: contactId, tipo: 'email_unsubscribed', automatico: true,
      titulo: b.pausarHasta ? 'Pausó los correos' : 'Canceló la suscripción de correo',
      metadata: { origen: b.origen, motivo: fila.motivo },
    });
  }
  return { ok: true, contactId };
}

/**
 * Volver a suscribir.
 *
 * `incluirPermanentes` existe porque hay dos puertas con permisos distintos:
 * el panel (founder, que ve el aviso de riesgo y decide) y la página pública
 * de preferencias, a la que llega cualquiera con un link de baja reenviado.
 * Desde la pública NO se puede revivir una queja de spam ni un rebote duro:
 * el token no expira y viaja en cada correo entregado, así que sería la forma
 * más fácil de reactivar a alguien que expresamente no quiere recibir.
 */
export async function reactivar(tenantId: string, email: string, incluirPermanentes = false): Promise<void> {
  const e = String(email).trim().toLowerCase();
  let q = supabase.from('email_suppressions')
    .update({ restaurado_at: new Date().toISOString() })
    .eq('tenant_id', tenantId).eq('email', e).is('restaurado_at', null);
  if (!incluirPermanentes) q = q.in('motivo', ['baja', 'pausa', 'sunset', 'manual']);
  await q;

  // La tabla vieja también: si no, la página dice "vuelves a estar suscrito"
  // y el pipeline lo sigue bloqueando por el otro lado.
  await supabase.from('email_unsubscribes')
    .update({ resubscribed_at: new Date().toISOString() })
    .eq('email', e).is('resubscribed_at', null);
}
