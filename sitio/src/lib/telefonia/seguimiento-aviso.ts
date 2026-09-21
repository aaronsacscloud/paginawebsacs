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


/* ── MEJORA 1 · QUE SU RESPUESTA REABRA EL SEGUIMIENTO ──────────────────────
 * Lo pidió el dueño en la misma frase y se me había quedado fuera: «de ahí se
 * termina el seguimiento de ese prospecto HASTA QUE RESPONDE EL WHATSAPP, y se
 * hará un nuevo seguimiento».
 *
 * Sin esto, el ciclo quedaba cojo: no contesta → se cierra la tarea → se le
 * escribe → contesta «sí, márcame mañana» → y nadie lo vuelve a poner en una
 * lista. La promesa moría justo en el momento en que el cliente volvía a
 * levantar la mano, que es el peor sitio donde puede morir.
 *
 * QUÉ HACE, Y QUÉ NO. Crea una tarea NUEVA para mañana a la misma hora, con la
 * historia escrita («no contestó el {fecha}; escribió de vuelta»). NO adivina
 * la hora que él quiere: eso lo dice él, y quien abra la tarea lo lee en el
 * chat. Poner una hora inventada sería volver a marcarle cuando no toca.
 *
 * Y sólo reabre UNA vez por respuesta: si escribe tres mensajes seguidos no
 * nacen tres seguimientos.
 */
export async function reabrirSeguimientoPorRespuesta(conversationId: string): Promise<number> {
  try {
    const { data: conv } = await supabase.from('wa_conversaciones')
      .select('id, telefono, contact_id, company_id, contacts(nombre)').eq('id', conversationId).maybeSingle();
    if (!conv?.contact_id) return 0;

    /* Sólo si se le cerró un seguimiento por no contestar en los últimos 3
       días. Más atrás, su mensaje ya no es respuesta a aquella llamada: es una
       conversación nueva, y tratarla como seguimiento pone al contacto en una
       lista que nadie acordó. */
    const desde = new Date(Date.now() - 3 * 86400e3).toISOString();
    const { data: cerrada } = await supabase.from('ti_tareas')
      .select('id, vence_at, owner_id, payload, hecho_at')
      .eq('contact_id', conv.contact_id).eq('tipo', 'llamada')
      .eq('seguimiento_desenlace', 'no_contesto').gte('hecho_at', desde)
      .order('hecho_at', { ascending: false }).limit(1).maybeSingle();
    if (!cerrada) return 0;

    // ¿Ya se reabrió por un mensaje anterior? Entonces no se duplica.
    const { count } = await supabase.from('ti_tareas').select('id', { count: 'exact', head: true })
      .eq('contact_id', conv.contact_id).eq('tipo', 'llamada').eq('estado', 'pendiente')
      .eq('payload->>reabierto_de', String(cerrada.id));
    if (Number(count || 0) > 0) return 0;

    /* ── MEJORA 4 · NI UN BUCLE INFINITO DE PROMESAS ──────────────────────
       Un contacto que ya falló TRES seguimientos no vuelve a entrar solo. Sin
       este tope, alguien que contesta el WhatsApp pero nunca el teléfono se
       reabre para siempre: cada respuesta suya crea otra promesa, y la lista
       del lunes acaba llena de gente a la que llevamos un mes marcando en
       balde. A la tercera deja de ser automático y pasa a ser una decisión —
       la tarea no nace y el caso se ve en la pestaña de seguimientos. */
    const { count: fallidos } = await supabase.from('ti_tareas').select('id', { count: 'exact', head: true })
      .eq('contact_id', conv.contact_id).eq('tipo', 'llamada').eq('seguimiento_desenlace', 'no_contesto');
    if (Number(fallidos || 0) >= 3) return 0;

    const p: any = cerrada.payload || {};
    const nombre = p.nombre || (conv as any)?.contacts?.nombre || null;
    const cuando = new Date(String(cerrada.vence_at));
    cuando.setDate(cuando.getDate() + 1);          // mañana, a la misma hora acordada
    const dia = new Date(String(cerrada.vence_at)).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' });

    await supabase.from('ti_tareas').insert({
      contact_id: conv.contact_id, company_id: conv.company_id || null, owner_id: cerrada.owner_id,
      familia: 'llamar', tipo: 'llamada', prioridad: 1, vence_at: cuando.toISOString(), origen: 'evento',
      payload: {
        de_llamada: true, reabierto_de: cerrada.id, nombre, whatsapp: conv.telefono,
        instruccion: `${String(nombre || 'El contacto').split(' ')[0]}: te escribió de vuelta — confirma con él la hora antes de marcar`,
        porque: `No contestó la llamada que pidió (${dia}) y respondió por WhatsApp.`,
      },
    });
    return 1;
  } catch { return 0; }
}
