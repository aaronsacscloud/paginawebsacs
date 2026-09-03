/**
 * AVISOS DE SISTEMA: SOLO A NÚMEROS DEL EQUIPO.
 *
 * Pasó el 2 de septiembre: el latido del agente mandó «Aviso del sistema: el
 * agente lleva 16 min sin correr. Revisa Vercel → Crons» por WhatsApp, y cayó
 * en la conversación de un contacto. Esta vez era el número de pruebas del
 * dueño, así que no lo leyó un cliente — pero nada lo impedía. El destino
 * salía de una llave de configuración y NADIE comprobaba de quién era ese
 * número.
 *
 * Un aviso interno en el chat de un cliente no es un detalle feo: le enseña
 * las tripas del sistema, le dice que algo está roto y queda en su historial
 * para siempre.
 *
 * Aquí está la única puerta. Es FAIL-CLOSED: si no se puede comprobar que el
 * número es del equipo, NO sale. Un aviso perdido se nota; uno enviado al
 * cliente no se puede retirar.
 */
import { supabase } from '../supabase';
import { telefonoWhatsApp } from '../telefono';
import { enviarTexto } from './kapso-api';
import { notificar } from '../crm/notificaciones';

/** Los últimos 10 dígitos: es como se comparan los teléfonos en todo el CRM. */
const clave = (t: string) => String(t || '').replace(/\D/g, '').slice(-10);

let cache: { nums: Set<string>; hasta: number } | null = null;

/** Los números que SÍ son del equipo. Cuatro fuentes, todas explícitas. */
async function numerosInternos(): Promise<Set<string>> {
  if (cache && Date.now() < cache.hasta) return cache.nums;
  const nums = new Set<string>();
  try {
    // 1 · el equipo
    const { data: eq } = await supabase.from('team_members').select('whatsapp').not('whatsapp', 'is', null);
    for (const m of eq || []) { const k = clave((m as any).whatsapp); if (k.length === 10) nums.add(k); }

    // 2 · las conversaciones marcadas como internas a mano
    const { data: cv } = await supabase.from('wa_conversaciones').select('telefono').eq('interna', true);
    for (const c of cv || []) { const k = clave((c as any).telefono); if (k.length === 10) nums.add(k); }

    // 3 · el dueño y los teléfonos de prueba del agente
    const { data: cfg } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
    const v: any = (cfg as any)?.valor || {};
    for (const t of [v.dueno_whatsapp, ...(Array.isArray(v.agente_prueba_telefonos) ? v.agente_prueba_telefonos : [])]) {
      const k = clave(t); if (k.length === 10) nums.add(k);
    }
  } catch {
    /* Sin poder leer, el conjunto queda VACÍO y no sale ningún aviso. Es la
       decisión correcta: en la duda, no se le escribe a nadie. */
    return new Set();
  }
  cache = { nums, hasta: Date.now() + 5 * 60_000 };
  return nums;
}

export function olvidarInternos() { cache = null; }

/** ¿Este número es del equipo? */
export async function esNumeroInterno(tel: string): Promise<boolean> {
  const k = clave(tel);
  if (k.length !== 10) return false;
  return (await numerosInternos()).has(k);
}

/**
 * Manda un aviso de SISTEMA por WhatsApp. Devuelve por qué no salió, si no
 * salió — nunca falla en silencio.
 *
 * `clave` es para no repetir la alerta de destino equivocado cada dos minutos.
 */
export async function avisoInterno(o: {
  telefono?: string | null; texto: string; clave?: string | null; titulo?: string;
}): Promise<{ enviado: boolean; motivo?: string }> {
  const tel = telefonoWhatsApp(o.telefono || '');
  if (!tel) return { enviado: false, motivo: 'sin teléfono configurado' };

  if (!(await esNumeroInterno(tel))) {
    /* El destino no está en ninguna de las cuatro listas. NO se manda, y se
       dice: una configuración que apunta a un número ajeno es un error que hay
       que ver, no algo que se resuelva callando. */
    await notificar({
      clave: `aviso-interno-destino:${clave(tel)}:${new Date().toISOString().slice(0, 10)}`,
      tipo: 'sistema', nivel: 'alerta',
      titulo: 'Un aviso del sistema iba a un número que no es del equipo',
      detalle: `No se envió. El destino configurado (…${clave(tel).slice(-4)}) no está en el equipo, ni marcado como conversación interna, ni en los teléfonos de prueba del agente. Revísalo antes de que un cliente reciba un mensaje técnico.`,
      destino: 'whatsapp',
    }).catch(() => {});
    return { enviado: false, motivo: 'el destino no es del equipo' };
  }

  try {
    await enviarTexto(tel, o.texto);
    return { enviado: true };
  } catch (e: any) {
    /* Fuera de la ventana de 24 h Meta no acepta texto libre. El aviso ya
       quedó en la campana del CRM, que es donde de verdad se lee. */
    return { enviado: false, motivo: String(e?.message || e).slice(0, 160) };
  }
}
