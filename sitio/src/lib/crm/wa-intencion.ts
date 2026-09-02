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
import { permitido } from '../whatsapp/permisos';
import { enviarTexto } from '../whatsapp/kapso-api';
import { registrarMensaje } from '../whatsapp/espejo';
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

  // ── Pide cita: se le contestan los HORARIOS al momento ──
  // Alguien que ya está usando el producto y pide una sesión no debería esperar
  // a que alguien abra la bandeja. Los horarios son los reales del calendario,
  // así que el que elija queda confirmado sin que nadie intervenga.
  /* Pausado por decisión del dueño (2-sep): un cambio de horario NO se
     contesta solo. Cuando esté encendido vuelve a salir sin tocar nada. */
  if (intencion.agenda && await permitido('agenda_horarios_auto')) {
    await mandarHorarios(o.conversationId, quien.split(' ')[0]).catch(e => console.warn('[wa-agenda]', e?.message || e));
  }

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


/**
 * Contesta con los próximos horarios reales y el link que los confirma.
 *
 * Se manda como texto normal, no como plantilla: la conversación está abierta
 * porque el lead ACABA de escribir, y dentro de esa ventana de 24 h no hace
 * falta plantilla aprobada. Es la misma redacción que usa el vendedor desde la
 * bandeja, para que el lead reciba lo mismo lo conteste una persona o el
 * sistema.
 */
async function mandarHorarios(conversationId: string, primerNombre: string): Promise<void> {
  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('telefono').eq('id', conversationId).maybeSingle();
  if (!conv?.telefono) return;

  const base = (import.meta as any).env?.PUBLIC_SITE_URL || 'https://www.sacscloud.com';
  const hoy = new Date();
  const hasta = new Date(hoy.getTime() + 7 * 864e5);
  const f = (d: Date) => d.toISOString().slice(0, 10);

  let lineas: string[] = [];
  try {
    const r = await fetch(`${base}/api/scheduling/available-slots?slug=demo&from=${f(hoy)}&to=${f(hasta)}`);
    const j: any = await r.json();
    // Los primeros seis de los próximos días: una lista larga no se lee en el
    // teléfono y obliga a hacer scroll para llegar al link.
    lineas = Object.entries(j?.dates || {})
      .flatMap(([dia, hs]: any) => (hs || []).slice(0, 2).map((h: string) => `${dia} · ${h}`))
      .slice(0, 6);
  } catch { /* sin horarios se manda solo el link: peor es no contestar */ }

  const texto = lineas.length
    ? `${primerNombre}, estos son los horarios más próximos para tu sesión con Andrea (30 min, sin costo):\n\n`
      + lineas.map(l => `• ${l}`).join('\n')
      + `\n\nElige el que te acomode aquí y queda confirmada al momento — te llega la invitación por correo y por WhatsApp:\n${base}/agendar/demo`
    : `${primerNombre}, con gusto. Elige el horario que te acomode para tu sesión con Andrea (30 min, sin costo) y queda confirmada al momento:\n${base}/agendar/demo`;

  const r = await enviarTexto(conv.telefono, texto);
  const wamid = r?.messages?.[0]?.id;
  if (wamid) {
    await registrarMensaje({
      kapsoMessageId: wamid, telefono: conv.telefono, direccion: 'saliente',
      tipo: 'text', cuerpo: texto, status: 'sent',
    }).catch(() => {});
  }
}
