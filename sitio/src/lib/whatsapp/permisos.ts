/**
 * QUÉ AUTOMATIZACIÓN PUEDE ESCRIBIRLE AL CLIENTE POR WHATSAPP.
 *
 * Decisión del dueño (2-sep-2026): «esto es lo único que vamos a habilitar
 * ahorita por WhatsApp» — la agenda (confirmación, recordatorio y seguimiento
 * de una reunión YA establecida) y el primer mensaje al contacto.
 *
 * Es una lista de PERMITIDOS y es FAIL-CLOSED: una clave que no exista en la
 * tabla, o que esté en false, NO envía. Y si la base no contesta, tampoco.
 *
 * Por qué así y no una lista de bloqueados: el barrido del 1-sep encontró
 * siete automatizaciones distintas escribiéndole al mismo cliente sin saber
 * una de la otra. Una lista de bloqueados protege de las que ya conoces; esta
 * protege también de la que alguien agregue mañana sin preguntar.
 *
 * El caché es de 60 s. Esto se consulta antes de cada envío y la tabla cambia
 * una vez al mes.
 */
import { supabase } from '../supabase';

export type ClaveWA =
  | 'agenda_confirmacion' | 'agenda_recordatorio' | 'agenda_seguimiento'
  | 'primer_mensaje' | 'acuse_entrante' | 'agenda_horarios_auto'
  | 'agenda_reagendar_auto' | 'cadencia_leads' | 'cobranza'
  | 'copiloto_ia' | 'valvula_ti';

let cache: { v: Record<string, boolean>; hasta: number } | null = null;
let cacheCfg: { v: Record<string, any>; hasta: number } | null = null;

/** ¿Esta automatización tiene permiso de escribirle al cliente? */
export async function permitido(clave: ClaveWA): Promise<boolean> {
  if (cache && Date.now() < cache.hasta) return cache.v[clave] === true;
  try {
    const { data, error } = await supabase.from('wa_automatizaciones').select('clave, activa');
    /* Un error NO se interpreta como permiso. Sin poder leer la tabla no se
       sabe qué está encendido, y en la duda no se le escribe a nadie: un
       mensaje de más no se puede retirar. */
    if (error || !data) return false;
    const v: Record<string, boolean> = {};
    for (const r of data) v[String(r.clave)] = r.activa === true;
    cache = { v, hasta: Date.now() + 60_000 };
    return v[clave] === true;
  } catch {
    return false;
  }
}

/** Para las pruebas y para cuando la pantalla acaba de guardar. */
export function olvidarPermisos() { cache = null; cacheCfg = null; }

/**
 * La configuración de una automatización (la columna `config`).
 *
 * Devuelve `{}` si no se puede leer: quien la use tiene que traer su propio
 * valor por omisión. Nunca inventa nombres de plantilla — mandar la plantilla
 * equivocada es peor que no mandar.
 */
export async function configDe(clave: ClaveWA): Promise<Record<string, any>> {
  if (cacheCfg && Date.now() < cacheCfg.hasta) return cacheCfg.v[clave] || {};
  try {
    const { data, error } = await supabase.from('wa_automatizaciones').select('clave, config');
    if (error || !data) return {};
    const v: Record<string, any> = {};
    for (const r of data) v[String(r.clave)] = (r as any).config || {};
    cacheCfg = { v, hasta: Date.now() + 60_000 };
    return v[clave] || {};
  } catch {
    return {};
  }
}
