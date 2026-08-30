/**
 * Qué hacer cuando un contacto CONOCIDO escribe por WhatsApp desde un CTA.
 *
 * El caso que esto resuelve: un lead en etapa Oportunidad —ya vio la demo, ya
 * tiene cotización— aprieta el botón del correo 3 y escribe. Antes de esto,
 * el sistema llamaba a marcarRespondio() y ya. Y marcarRespondio solo mueve a
 * quien está en 'nuevo', 'contactado' o 'sin_respuesta': alguien en 'cotizado'
 * ni siquiera cambiaba de estatus. El mensaje caía en la bandeja y nadie se
 * enteraba hasta que alguien la abriera por casualidad.
 *
 * Ahora ese mensaje deja tres rastros:
 *   1. Una etiqueta en su ficha, para medir qué correo trae más conversación.
 *   2. Una actividad en su timeline, para que quede en la historia del lead.
 *   3. Una notificación con CONTEXTO — no "te escribieron" sino "viene del
 *      correo del hueco de curva y quiere probarlo con un estilo suyo".
 *
 * Solo dispara cuando el texto viene de un CTA reconocible. Un lead que ya
 * está conversando y manda "ok, gracias" no genera nada: para eso está el
 * contador de no leídos, y una campana que suena de más se deja de mirar.
 */
import { supabase } from '../supabase';
import { intencionDe } from '../whatsapp/intencion';
import { configEntrante } from '../whatsapp/config-entrante';
import { notificar } from './notificaciones';

/** Color de la etiqueta según qué tan cerca está de cerrar. */
const COLOR = { alta: '#2AB5A0', media: '#E8A838' } as const;

async function etiquetar(contactId: string, nombre: string, color: string) {
  let { data: et } = await supabase.from('crm_etiquetas').select('id').eq('nombre', nombre).maybeSingle();
  if (!et) {
    const { data } = await supabase.from('crm_etiquetas')
      .insert({ nombre, color, descripcion: 'Puesta sola: el lead escribió por WhatsApp desde este CTA.' })
      .select('id').single();
    et = data;
  }
  if (!et) return;
  // La asignación se repite si vuelve a escribir del mismo correo; se evita.
  const { data: ya } = await supabase.from('crm_etiqueta_asignaciones')
    .select('id').eq('etiqueta_id', et.id).eq('entidad', 'contact').eq('entidad_id', contactId).maybeSingle();
  if (ya) return;
  await supabase.from('crm_etiqueta_asignaciones')
    .insert({ etiqueta_id: et.id, entidad: 'contact', entidad_id: contactId });
}

export async function registrarIntencionEntrante(o: {
  contactId: string;
  conversationId: string;
  texto?: string | null;
  mensajeId?: string | null;
}): Promise<void> {
  const cfg = await configEntrante();
  if (!cfg.activa) return;   // la secuencia manda: apagada, no hace nada

  const intencion = intencionDe(o.texto);
  if (!intencion) return;   // escribió por su cuenta: no hay CTA que atribuir

  const { data: c } = await supabase.from('contacts')
    .select('nombre, apellido, lifecycle_stage, estatus_lead, companies(nombre)')
    .eq('id', o.contactId).maybeSingle();

  const quien = [c?.nombre, c?.apellido].filter(Boolean).join(' ').trim() || 'Un lead';
  const empresa = (c as any)?.companies?.nombre || null;
  const donde = empresa ? ` de ${empresa}` : '';
  const etapa = [c?.lifecycle_stage, c?.estatus_lead].filter(Boolean).join(' · ');

  if (cfg.intencion.etiquetar) await etiquetar(o.contactId, `WA: ${intencion.fuente}`, COLOR[intencion.temperatura]);

  await supabase.from('activities').insert({
    contact_id: o.contactId,
    tipo: 'wa_intencion',
    automatico: true,
    titulo: `Escribió por WhatsApp desde: ${intencion.fuente}`,
    metadata: {
      clave: intencion.clave,
      quiere: intencion.quiere,
      temperatura: intencion.temperatura,
      conversation_id: o.conversationId,
      texto: (o.texto || '').slice(0, 300),
    },
  }).then(() => {}, () => {});

  if (!cfg.intencion.notificar) return;
  await notificar({
    // Una notificación por mensaje: si escribe dos veces del mismo correo, son
    // dos hechos distintos y el vendedor querrá ver los dos.
    clave: o.mensajeId ? `wa_intencion:${o.mensajeId}` : null,
    tipo: 'wa_intencion',
    nivel: intencion.temperatura === 'alta' ? 'alerta' : 'info',
    titulo: `${quien}${donde} te escribió por WhatsApp`,
    detalle: `Viene de: ${intencion.fuente}\nQuiere: ${intencion.quiere}`
           + (etapa ? `\nEtapa: ${etapa}` : ''),
    destino: 'whatsapp',
    metadata: {
      contact_id: o.contactId,
      conversation_id: o.conversationId,
      clave: intencion.clave,
      temperatura: intencion.temperatura,
    },
  }).catch(() => {});
}
