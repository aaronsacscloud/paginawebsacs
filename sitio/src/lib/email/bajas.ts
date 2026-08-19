// Procesar una baja: una sola función para todas las puertas de entrada
// (one-click RFC 8058, página pública, centro de preferencias, respuesta
// textual en la bandeja, panel del CRM).
//
// Hace tres cosas que tienen que ir juntas o el sistema miente: suprime,
// marca el envío que la provocó (así se sabe qué campaña quemó lista) y saca
// a la persona de TODOS los embudos activos — quedarse inscrita significaría
// recibir el siguiente paso pese a haberse dado de baja.
import { supabase } from '../supabase';

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
    .from('email_suppressions').select('id')
    .eq('tenant_id', b.tenantId).eq('email', email).is('restaurado_at', null)
    .limit(1).maybeSingle();

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
    await supabase.from('email_sends')
      .update({ estado: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('id', b.sendId);
  }

  // Fuera de todos los embudos: seguir inscrito sería recibir el paso 3 de
  // una secuencia de la que la persona acaba de salir.
  if (contactId && !b.pausarHasta) {
    await supabase.from('automation_enrollments')
      .update({ estado: 'cancelado', unenrollment_reason: 'baja de correo', completed_at: new Date().toISOString() })
      .eq('contact_id', contactId).eq('estado', 'activo');
    await supabase.from('activities').insert({
      contact_id: contactId, tipo: 'email_unsubscribed', automatico: true,
      titulo: b.pausarHasta ? 'Pausó los correos' : 'Canceló la suscripción de correo',
      metadata: { origen: b.origen, motivo: fila.motivo },
    });
  }
  return { ok: true, contactId };
}

/** Volver a suscribir (el usuario se equivocó, o el panel lo restaura). */
export async function reactivar(tenantId: string, email: string): Promise<void> {
  await supabase.from('email_suppressions')
    .update({ restaurado_at: new Date().toISOString() })
    .eq('tenant_id', tenantId).eq('email', String(email).trim().toLowerCase())
    .is('restaurado_at', null);
}
