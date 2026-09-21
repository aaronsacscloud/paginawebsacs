/* NO CONTESTÓ LA LLAMADA QUE ÉL PIDIÓ · el WhatsApp de ese caso, y sólo ese.
 *
 * PEDIDO DEL DUEÑO (21-sep-2026): «el WhatsApp que se le envía a un prospecto
 * que previamente solicitó un seguimiento debe ser un WhatsApp distinto, para
 * que entienda que fue una llamada a la cual él previamente solicitó el
 * seguimiento. Ahí tienes que hacer una nueva plantilla de marketing y otra de
 * utility. De ahí se termina el seguimiento de ese prospecto hasta que responde
 * el WhatsApp, y se hará un nuevo seguimiento».
 *
 * POR QUÉ NO SIRVE EL MENSAJE QUE YA HAY. El de «te marcamos y no te
 * encontramos» le habla a alguien a quien llamamos por nuestra cuenta. A quien
 * pidió la llamada hay que decirle otra cosa: que se le marcó A LA HORA QUE ÉL
 * PIDIÓ. La diferencia no es de cortesía — con el genérico parece que no
 * escuchamos lo que acordamos, que es exactamente lo que hace que deje de
 * contestar.
 *
 * Y POR QUÉ DOS PLANTILLAS Y NO UNA: Meta sólo deja escribir libremente dentro
 * de las 24 h siguientes al último mensaje del cliente. Fuera de esa ventana
 * hace falta una plantilla aprobada, y las categoriza distinto según lo que
 * digan. Es la misma pareja que ya usan la minuta y el resto del CRM.
 *
 * ⚠️ SIN PLANTILLA CONFIGURADA NO SE MANDA NADA, y se dice por qué. Caer al
 * mensaje genérico sería justo el error que esto existe para evitar.
 */
import { supabase } from '../supabase';
import { telefonoWhatsApp } from '../telefono';
import { enviarPlantilla, enContexto } from '../whatsapp/kapso-api';
import { ventanaEnLinea } from '../whatsapp/linea';
import { permitido } from '../whatsapp/permisos';

const primerNombre = (n?: string | null) => String(n || '').trim().split(/\s+/)[0] || '';

/** ¿Esta plantilla está APROBADA por Meta ahora mismo? */
async function aprobada(nombre?: string | null): Promise<boolean> {
  if (!nombre) return false;
  const { data } = await supabase.from('wa_plantillas')
    .select('status').eq('nombre', nombre).order('status').limit(1).maybeSingle();
  return String((data as any)?.status || '').toUpperCase() === 'APPROVED';
}

export type ResultadoAviso = { enviado: boolean; motivo: string };

/**
 * Avisa por WhatsApp a quien pidió la llamada y no la contestó.
 *
 * `hora` es la que él pidió, para poder decírsela: «te marqué a las 4 como
 * quedamos» vale mucho más que «te marcamos».
 */
export async function avisarSeguimientoSinContestar(o: {
  telefono: string; nombre?: string | null; hora?: string | null; conversationId?: string | null;
}): Promise<ResultadoAviso> {
  try {
    const tel = telefonoWhatsApp(o.telefono);
    if (!tel) return { enviado: false, motivo: 'el teléfono no sirve para WhatsApp' };
    if (!(await permitido('seguimiento_llamada'))) return { enviado: false, motivo: 'pausado en Automatizaciones' };

    const { data: cfg } = await supabase.from('wa_config')
      .select('seguimiento_plantilla_marketing, seguimiento_plantilla_utility').eq('id', 1).maybeSingle();

    /* Dentro de la ventana manda la de UTILITY —es una respuesta a una
       conversación viva y Meta la cobra distinto—; fuera, la de marketing. */
    let conv: any = null;
    if (o.conversationId) {
      const { data } = await supabase.from('wa_conversaciones')
        .select('id, telefono, phone_number_id, ventanas, ultimo_entrante_at').eq('id', o.conversationId).maybeSingle();
      conv = data;
    }
    const abierta = conv ? ventanaEnLinea(conv, conv.phone_number_id).abierta : false;
    const elegida = abierta
      ? (cfg?.seguimiento_plantilla_utility || cfg?.seguimiento_plantilla_marketing)
      : (cfg?.seguimiento_plantilla_marketing || cfg?.seguimiento_plantilla_utility);

    if (!elegida) {
      return { enviado: false, motivo: 'no hay plantilla configurada para el seguimiento sin contestar (Ajustes ▸ WhatsApp)' };
    }
    if (!(await aprobada(elegida))) {
      return { enviado: false, motivo: `la plantilla «${elegida}» todavía no está aprobada por Meta` };
    }

    enContexto('seguimiento', 'telefonia');
    /* Dos variables, en este orden: su nombre y la hora que él pidió. Si la
       plantilla lleva sólo una, Meta ignora la segunda sin fallar. */
    await enviarPlantilla(tel, String(elegida), 'es_MX', [primerNombre(o.nombre) || 'qué tal', String(o.hora || '')].filter(Boolean));
    return { enviado: true, motivo: abierta ? 'se le avisó (ventana abierta)' : 'se le avisó con plantilla' };
  } catch (e: any) {
    return { enviado: false, motivo: String(e?.message || e).slice(0, 160) };
  }
}
