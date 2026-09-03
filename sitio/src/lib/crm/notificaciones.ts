// Notificaciones del CRM (la campana).
//
// Existen por lo que pasa SOLO: un cobro domiciliado de Mercado Pago entra de
// madrugada, se registra el pago y la próxima factura avanza sin que nadie
// toque nada. Justo por eso nadie se entera — ni del que entró, ni del que
// rebotó. El timeline del cliente ya guarda el rastro, pero solo lo lee quien
// ya está dentro de ese cliente; la campana es lo que se ve sin ir a buscarlo.
//
// Idempotente por `clave`: Mercado Pago REINTENTA sus avisos y la conciliación
// puede volver a ver el mismo cobro. Tres reintentos del mismo pago tienen que
// ser una sola notificación, o la campana se vuelve ruido y se deja de mirar.
import { supabase } from '../supabase';
import { espejarNotificacion } from './espacio-sistema';

export type NivelNotif = 'info' | 'alerta' | 'urgente';

export type Notificacion = {
  /** Identidad del hecho (ej. `pago_mp:123456789`). Sin ella no hay dedupe. */
  clave?: string | null;
  tipo: string;
  nivel?: NivelNotif;
  titulo: string;
  detalle?: string | null;
  monto?: number | null;
  company_id?: string | null;
  subscription_id?: string | null;
  payment_id?: string | null;
  /** Pestaña del CRM a la que lleva el clic cuando no hay cliente que abrir. */
  destino?: string | null;
  metadata?: any;
};

/**
 * Deja la notificación. Devuelve true solo si es NUEVA (la clave no existía).
 *
 * No lanza nunca: avisar es un efecto secundario del cobro, y tirar el webhook
 * por no poder escribir un aviso perdería el pago, que es lo caro. Si la tabla
 * todavía no existe (el deploy puede ir antes que el SQL) se traga el error
 * igual que el resto de los writes nuevos del CRM.
 */
export async function notificar(n: Notificacion): Promise<boolean> {
  try {
    const { error } = await supabase.from('crm_notificaciones').insert({
      clave: n.clave || null,
      tipo: n.tipo,
      nivel: n.nivel || 'info',
      titulo: n.titulo,
      detalle: n.detalle || null,
      monto: n.monto != null ? Number(n.monto) : null,
      company_id: n.company_id || null,
      subscription_id: n.subscription_id || null,
      payment_id: n.payment_id || null,
      destino: n.destino || null,
      metadata: n.metadata || null,
    });
    if (!error) {
      // Espejo en Equipo → Sistema (solo lo nuevo; el dedupe ya pasó aquí).
      await espejarNotificacion(n).catch(() => {});
      return true;
    }
    if (/duplicate key|23505/i.test(error.message || '')) return false;  // ya se avisó
    console.error('[notificaciones] no se pudo avisar:', error.message);
    return false;
  } catch (e: any) {
    console.error('[notificaciones] error inesperado:', e?.message || e);
    return false;
  }
}
