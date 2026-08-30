/**
 * El paso de secuencia que habla DENTRO de Sacs.
 *
 * QUÉ RESUELVE
 * Durante una prueba gratis, el mejor lugar para hablarle a alguien es el
 * sistema que está usando: ahí ya puso atención, el mensaje llega en el
 * contexto de lo que está haciendo, y no cuesta ni un peso de Meta ni de
 * SendGrid. Correo y WhatsApp compiten con todo lo demás de su día.
 *
 * CÓMO, sin construir un segundo Outbound
 * El paso no guarda contenido: apunta a una campaña de Outbound. La campaña es
 * el mensaje —con su formato, sus botones y su vista previa ya resueltos—; la
 * secuencia decide a quién y cuándo. Cuando un lead llega al paso, su cuenta se
 * agrega a la audiencia de esa campaña y se republica.
 *
 * Meter un editor de mensajes in-app dentro del paso habría creado un segundo
 * lugar donde diseñar lo mismo, y esos dos se separan en la primera semana:
 * Outbound estrena un formato y el de secuencias no lo tiene.
 */
import { supabase } from '../supabase';
import { publicarCampana } from '../outbound/motor';
import { normCuenta } from './sacs-cuentas';

/** De qué cuenta de SACS es este lead. La de la prueba manda; si no, la de su empresa. */
export async function cuentaDelLead(c: any): Promise<string | null> {
  if (c?.prueba_cuenta) return normCuenta(c.prueba_cuenta);
  if (!c?.company_id) return null;
  const { data } = await supabase.from('company_sacs_accounts')
    .select('cuenta, es_principal').eq('company_id', c.company_id)
    .order('es_principal', { ascending: false }).limit(1);
  return data?.[0]?.cuenta ? normCuenta(data[0].cuenta) : null;
}

/**
 * Mete la cuenta del lead en la campaña y la republica.
 *
 * Devuelve `ya_estaba` cuando la cuenta ya figuraba: entonces NO se republica.
 * Sin ese corte, cada corrida del cron mandaría una publicación por lead aunque
 * nada hubiera cambiado — y la publicación reescribe el documento que sacs_api
 * sirve a esa cuenta, así que no es una llamada inocente.
 */
export async function entregarInapp(campanaId: string, cuenta: string): Promise<{ ok: boolean; ya_estaba?: boolean; error?: string }> {
  if (!campanaId) return { ok: false, error: 'El paso no tiene campaña ligada' };
  if (!cuenta) return { ok: false, error: 'El lead no tiene cuenta de SACS' };

  const { data: camp } = await supabase.from('inapp_campanas')
    .select('id, nombre, estado, audiencia, archived_at').eq('id', campanaId).maybeSingle();
  if (!camp) return { ok: false, error: 'Esa campaña ya no existe' };
  if (camp.archived_at) return { ok: false, error: 'Esa campaña está archivada' };

  const aud: any = camp.audiencia || {};
  /* Si alguien la creó desde Outbound sin la bandera, su audiencia se resuelve
     por condiciones y `grupos: []` significa TODAS. Publicarla creyendo que va
     a un lead le llegaría a las 560 cuentas. Se para aquí. */
  if (!aud.solo_manual) {
    return { ok: false, error: 'Esa campaña no está marcada como gobernada por una secuencia (audiencia.solo_manual).' };
  }

  const lista: string[] = Array.isArray(aud.incluir_cuentas) ? aud.incluir_cuentas : [];
  if (lista.includes(cuenta)) return { ok: true, ya_estaba: true };

  const nueva = { ...aud, incluir_cuentas: [...lista, cuenta] };
  const { error: e1 } = await supabase.from('inapp_campanas')
    .update({ audiencia: nueva, updated_at: new Date().toISOString() }).eq('id', campanaId);
  if (e1) return { ok: false, error: e1.message };

  try {
    /* `congelada: false` a propósito: la gracia de esta campaña es justo que su
       audiencia CAMBIE. Congelarla dejaría fuera a todos los leads que lleguen
       después del primero. */
    await publicarCampana({ ...camp, audiencia: nueva }, { congelada: false });
    return { ok: true };
  } catch (e: any) {
    /* La cuenta ya quedó guardada: la próxima corrida vuelve a intentar la
       publicación sin duplicar a nadie, porque `incluir_cuentas` es un conjunto.
       Se separa el guardado del envío para poder reintentar solo lo que falló. */
    return { ok: false, error: String(e?.message || e) };
  }
}

/**
 * Saca la cuenta del lead de la campaña. Se usa al salir de la secuencia.
 *
 * Sin esto, el que ya pagó su anual seguiría viendo dentro de Sacs el modal que
 * le ofrece contratar el anual — que es la peor forma de recibir a alguien que
 * acaba de pagar. Las bajas importan tanto como las altas.
 */
export async function retirarInapp(campanaId: string, cuenta: string): Promise<void> {
  const { data: camp } = await supabase.from('inapp_campanas')
    .select('id, audiencia, estado, archived_at').eq('id', campanaId).maybeSingle();
  if (!camp || camp.archived_at) return;
  const aud: any = camp.audiencia || {};
  const lista: string[] = Array.isArray(aud.incluir_cuentas) ? aud.incluir_cuentas : [];
  if (!lista.includes(cuenta)) return;
  const nueva = { ...aud, incluir_cuentas: lista.filter(x => x !== cuenta) };
  await supabase.from('inapp_campanas').update({ audiencia: nueva, updated_at: new Date().toISOString() }).eq('id', campanaId);
  /* Con la lista vacía `publicarCampana` lanza («0 cuentas»), y con razón: una
     campaña sin nadie no se publica. Aquí eso NO es un error — es que el último
     lead salió. Se despublica en vez de fallar. */
  try {
    if (nueva.incluir_cuentas.length) await publicarCampana({ ...camp, audiencia: nueva }, { congelada: false });
    else await (await import('../outbound/motor')).despublicarCampana(campanaId);
  } catch (e: any) {
    console.warn('[secuencia-inapp] no se pudo republicar tras la baja:', e?.message || e);
  }
}

/** Todas las campañas in-app que una secuencia gobierna, para las bajas. */
export async function campanasDeSecuencia(secuenciaId: string): Promise<string[]> {
  const { data } = await supabase.from('crm_secuencia_pasos')
    .select('inapp_campana_id').eq('secuencia_id', secuenciaId).not('inapp_campana_id', 'is', null);
  return Array.from(new Set((data || []).map((p: any) => p.inapp_campana_id).filter(Boolean)));
}
