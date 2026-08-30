/**
 * Presión de WhatsApp: cuántos mensajes le caen a un lead y cada cuánto.
 *
 * Por qué existe este archivo y no una bandera más en el cron:
 * la cadencia ya llevaba su propia cuenta (`envioHoy`), pero esa cuenta solo
 * sabe de lo que manda el cron. Un vendedor abriendo la bandeja y disparando
 * dos plantillas seguidas era invisible para ella. Pasó de verdad: a Sugar
 * store le salieron dos plantillas con tres minutos de diferencia el 30 de
 * agosto de 2026, una tras otra, y ninguna cadencia estaba encendida.
 *
 * La única fuente honesta de "cuándo le escribimos por última vez" son los
 * mensajes salientes que ya están en el espejo. Da igual quién los mandó.
 */
import { supabase } from '../supabase';
import { telefonoWhatsApp } from '../telefono';
import { configEntrante } from './config-entrante';

/** Valores de respaldo. Los de verdad se editan en Secuencias ▸ "WhatsApp
 *  entrante · atención y control"; estos rigen si esa fila no existe. */
export const HORAS_ENTRE_WHATSAPPS = 24;
export const DIAS_PAUSA_POR_MANUAL = 5;

export interface UltimoSaliente {
  cuando: Date;
  /** null = lo mandó una automatización; con nombre = lo mandó una persona. */
  autor: string | null;
}

/** El último mensaje que le mandamos a ese teléfono, venga de donde venga. */
export async function ultimoSalienteWa(telefono: string): Promise<UltimoSaliente | null> {
  const tel = telefonoWhatsApp(telefono);
  if (!tel) return null;
  const { data } = await supabase
    .from('wa_mensajes')
    .select('created_at, autor, wa_conversaciones!inner(telefono)')
    .eq('direccion', 'saliente')
    .eq('wa_conversaciones.telefono', tel)
    .is('borrado_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.created_at) return null;
  return { cuando: new Date(data.created_at as string), autor: (data as any).autor || null };
}

export interface Veredicto {
  ok: boolean;
  /** Cuándo se le puede volver a escribir. Solo cuando ok es false. */
  libreEn?: Date;
  /** Listo para enseñárselo a una persona, no para un log. */
  motivo?: string;
  /** Si el último lo mandó alguien del equipo y no una automatización. */
  fueManual?: boolean;
}

/**
 * ¿Se le puede mandar un WhatsApp ahora?
 *
 * `forzar` existe para el envío manual: el agente ve el aviso y decide. Lo que
 * NUNCA se salta el candado es la cadencia, porque ahí no hay nadie mirando.
 */
export async function puedeMandarWa(telefono: string, opts?: { forzar?: boolean }): Promise<Veredicto> {
  const ultimo = await ultimoSalienteWa(telefono);
  if (!ultimo) return { ok: true };

  const cfg = await configEntrante();
  const tope = cfg.presion.horas_entre_whatsapps;
  const horas = (Date.now() - ultimo.cuando.getTime()) / 36e5;
  if (horas >= tope) return { ok: true };

  const libreEn = new Date(ultimo.cuando.getTime() + tope * 36e5);
  // Forzar es una decisión del agente, y la pantalla puede tenerla prohibida.
  if (opts?.forzar && cfg.presion.permitir_forzar_manual) return { ok: true, libreEn, fueManual: !!ultimo.autor };

  const quien = ultimo.autor ? `${ultimo.autor} le escribió` : 'ya le salió un mensaje automático';
  const falta = Math.max(1, Math.round(tope - horas));
  return {
    ok: false,
    libreEn,
    fueManual: !!ultimo.autor,
    motivo: `${quien} hace ${horas < 1 ? 'unos minutos' : `${Math.round(horas)} h`}. `
          + `Para no saturarlo, el siguiente WhatsApp puede salir en ${falta} h `
          + `(a partir de las ${libreEn.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}).`,
  };
}

/**
 * ¿La cadencia debe hacerse a un lado porque una persona tomó el hilo?
 *
 * Regla acordada: sí, y se reanuda sola cuando el hilo lleva quieto
 * DIAS_PAUSA_POR_MANUAL días. La idea es que el lead nunca escuche dos voces
 * a la vez — la del vendedor gana mientras esté hablando.
 */
export async function cadenciaPausadaPorPersona(telefono: string): Promise<boolean> {
  const tel = telefonoWhatsApp(telefono);
  if (!tel) return false;
  const cfg = await configEntrante();
  if (!cfg.presion.dias_pausa_por_manual) return false;   // 0 = la cadencia nunca se aparta
  const desde = new Date(Date.now() - cfg.presion.dias_pausa_por_manual * 864e5).toISOString();
  const { data } = await supabase
    .from('wa_mensajes')
    .select('id, wa_conversaciones!inner(telefono)')
    .eq('direccion', 'saliente')
    .eq('wa_conversaciones.telefono', tel)
    .not('autor', 'is', null)          // con autor = lo mandó una persona
    .is('borrado_at', null)
    .gte('created_at', desde)
    .limit(1);
  return !!(data && data.length);
}
