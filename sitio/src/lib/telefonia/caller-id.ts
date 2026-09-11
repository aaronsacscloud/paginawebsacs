// TELEFONÍA · El número que ve el cliente cuando le llamamos.
//
// Twilio solo deja poner como remitente (a) un número comprado en Twilio o
// (b) un número VERIFICADO como Outgoing Caller ID (Twilio le llama y hay que
// teclear un código). El de ventas (+52 415 283 8733) es el (b): el dueño lo
// verifica una vez desde Configuración → Telefonía y desde entonces todas las
// salientes lo enseñan; así el cliente ve el mismo número del WhatsApp y le
// puede devolver la llamada o escribir ahí.
import { supabase } from '../supabase';
import { NUMERO, twilioRest } from './twilio';

let cache: { valor: string; hasta: number } | null = null;

/** El remitente de las salientes: el verificado si lo hay, si no el de Twilio. */
export async function callerIdSaliente(): Promise<string> {
  if (cache && cache.hasta > Date.now()) return cache.valor;
  let valor = NUMERO;
  try {
    const { data } = await supabase.from('wa_config').select('tel_caller_id').eq('id', 1).maybeSingle();
    if (data?.tel_caller_id) valor = String(data.tel_caller_id);
  } catch { /* sin config: el de Twilio */ }
  cache = { valor, hasta: Date.now() + 60_000 };
  return valor;
}
export const olvidarCallerId = () => { cache = null; };

/** Los números que Twilio acepta como remitente en esta cuenta. */
export async function callerIdsVerificados(): Promise<{ telefono: string; nombre: string | null }[]> {
  const j = await twilioRest('/OutgoingCallerIds.json?PageSize=50');
  return (j?.outgoing_caller_ids || []).map((c: any) => ({ telefono: String(c.phone_number), nombre: c.friendly_name || null }));
}

/** Pide a Twilio que llame al número con un código; devuelve el código para teclearlo. */
export async function pedirVerificacion(telefono: string, nombre: string) {
  const j = await twilioRest('/OutgoingCallerIds.json', { PhoneNumber: telefono, FriendlyName: nombre, CallDelay: '0' });
  if (!j?.validation_code) throw new Error(j?.message || 'Twilio no devolvió el código de verificación');
  return { codigo: String(j.validation_code), telefono: String(j.phone_number || telefono) };
}
