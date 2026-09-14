// LEADS · La PUERTA del WhatsApp directo: alta automática de contactos.
//
// Hasta hoy un número desconocido se quedaba en el limbo (conversación con
// contact_id null, fuera del funnel). Ahora:
//   · ENTRANTE → triaje IA barato (¿ventas / soporte / spam?). Ventas crea el
//     contacto y entra al funnel como "respondió"; spam no crea nada; soporte
//     se marca y se queda como conversación. Si la IA no contesta, se asume
//     ventas: peor es perder un lead que sobrar un contacto.
//   · SALIENTE humano (autorId) → el click ES el gesto: contacto directo como
//     "contactado", sin triaje.
// El backfill (silencioso) jamás pasa por aquí — lo garantiza el espejo.
import { supabase } from '../supabase';
import { pedirJSON } from '../ia';
import { ligarContacto } from '../whatsapp/espejo';
import { marcarRespondio, marcarContactado } from './estatus-live';
import { avisarNuevoLead } from './aviso-lead';
import { notificar } from './notificaciones';

const telefonoLegible = (t: string) => t.replace(/^\+?521?/, '').replace(/(\d{2})(\d{4})(\d{4})$/, '$1 $2 $3');

export async function altaDesdeWhatsApp(convId: string, telefono: string, o: { direccion: 'entrante' | 'saliente'; autorId?: string | null; texto?: string | null; nombrePerfil?: string | null }) {
  const { data: conv } = await supabase.from('wa_conversaciones').select('contact_id, company_id, triage').eq('id', convId).maybeSingle();
  if (!conv || conv.contact_id) return;

  // El comportamiento lo manda el MÓDULO (WhatsApp ▸ ⚙ Automatización):
  //   alta_wa_entrante: 'triaje' (IA decide) | 'siempre' | 'nunca'
  //   alta_wa_saliente: crear contacto al escribirle a un desconocido
  const { data: cfgAlta } = await supabase.from('wa_config').select('alta_wa_entrante, alta_wa_saliente').eq('id', 1).maybeSingle();
  const modoEntrante = cfgAlta?.alta_wa_entrante || 'triaje';
  if (o.direccion === 'entrante' && modoEntrante === 'nunca') return;
  if (o.direccion === 'saliente' && cfgAlta && cfgAlta.alta_wa_saliente === false) return;

  /* ¿VIENE DE UN CORREO NUESTRO? Antes de dar por desconocido a nadie.
     Los correos de campaña llevan un botón de WhatsApp con el texto ya escrito
     en el propio enlace. Si alguien hizo clic hace un rato y lo que acaba de
     llegar es ESE texto, no es un número desconocido: es la persona a la que le
     escribimos, contestando desde un teléfono que no teníamos.

     Caso medido (14-sep): Matin Vera Vera, cuenta cancelada, hizo clic a las
     20:48:46 y su mensaje entró a las 20:49:51. Se le abrió un lead nuevo sin
     nombre y entró a la cadencia de rezagados, cuando lo que estaba haciendo
     era volver. */
  if (o.direccion === 'entrante' && String(o.texto || '').trim()) {
    try {
      const { identificarPorClic } = await import('../whatsapp/identificar-por-clic');
      const q = await identificarPorClic(o.texto!);
      if (q?.certeza === 'exacta') {
        await supabase.from('wa_conversaciones').update({ contact_id: q.contactId, ...(q.companyId ? { company_id: q.companyId } : {}) }).eq('id', convId);
        // El teléfono nuevo se guarda: la próxima vez ya se reconoce solo.
        await supabase.from('contacts').update({ whatsapp: telefono, updated_at: new Date().toISOString() })
          .eq('id', q.contactId).is('whatsapp', null);
        await marcarRespondio(q.contactId);
        await supabase.from('activities').insert({ contact_id: q.contactId, tipo: 'nota', automatico: true,
          titulo: `Escribió por WhatsApp desde ${telefonoLegible(telefono)} — ${q.motivo}`,
          metadata: { identificado_por: 'clic_wa_correo', campana: q.campana, clic_at: q.clicAt, telefono } });
        return;
      }
    } catch { /* si esto falla, sigue el camino de siempre */ }
  }

  // ¿El teléfono ya es de alguien? (el lead llenó un formulario antes de
  // escribir): se liga y su estatus avanza — no se duplica la ficha.
  const ya = await ligarContacto(telefono);
  if (ya.contactId) {
    await supabase.from('wa_conversaciones').update({ contact_id: ya.contactId, ...(ya.companyId && !conv.company_id ? { company_id: ya.companyId } : {}) }).eq('id', convId);
    if (o.direccion === 'entrante') await marcarRespondio(ya.contactId);
    else if (o.autorId) await marcarContactado(ya.contactId);
    return;
  }

  if (o.direccion === 'saliente') {
    if (!o.autorId) return;   // eco/automatización: no es gesto humano
    const { data: nuevo } = await supabase.from('contacts').insert({
      nombre: o.nombrePerfil || null, whatsapp: telefono, tipo: 'lead', lifecycle_stage: 'lead',
      fuente: 'whatsapp-directo', origen_alta: 'wa_saliente', nombre_confianza: o.nombrePerfil ? 'perfil_wa' : null,
      estatus_lead: 'contactado', estatus_lead_at: new Date().toISOString(), last_contact_at: new Date().toISOString(),
    }).select('id').single();
    if (!nuevo) return;
    await supabase.from('wa_conversaciones').update({ contact_id: nuevo.id }).eq('id', convId);
    await supabase.from('activities').insert({ contact_id: nuevo.id, tipo: 'contacto_creado', titulo: 'Lead creado al escribirle por WhatsApp', automatico: true, metadata: { regla: 'alta_wa_saliente', actor: o.autorId } });
    return;
  }

  // ── Entrante: triaje ──
  if (conv.triage) return;   // ya se decidió antes (spam/soporte)
  let clase = 'ventas';
  if (modoEntrante === 'siempre') { /* sin triaje: todo desconocido es lead */ } else try {
    const r = await pedirJSON({
      system: 'Clasificas el PRIMER mensaje de WhatsApp que un desconocido le manda a SACS (software punto de venta para comercios en México). Contesta SOLO JSON: {"clase":"ventas"|"soporte"|"spam"}. "ventas" = persona/negocio interesada o preguntando por el sistema, precios, demo, o un saludo genuino. "soporte" = ya es cliente con un problema técnico. "spam" = publicidad, cadenas, links sospechosos, mensajes sin sentido.',
      user: `Mensaje: "${(o.texto || '').slice(0, 400)}"`,
    });
    if (['ventas', 'soporte', 'spam'].includes(r?.clase)) clase = r.clase;
  } catch { /* sin IA: se asume ventas */ }

  if (clase !== 'ventas') {
    await supabase.from('wa_conversaciones').update({ triage: clase, triage_meta: { cuando: new Date().toISOString(), texto: (o.texto || '').slice(0, 200) } }).eq('id', convId);
    return;
  }

  const { data: nuevo } = await supabase.from('contacts').insert({
    nombre: o.nombrePerfil || null, whatsapp: telefono, tipo: 'lead', lifecycle_stage: 'lead',
    fuente: 'whatsapp-directo', origen_alta: 'wa_entrante', nombre_confianza: o.nombrePerfil ? 'perfil_wa' : null,
    estatus_lead: 'respondio', estatus_lead_at: new Date().toISOString(), respondio_at: new Date().toISOString(),
  }).select('id, nombre, whatsapp').single();
  if (!nuevo) return;
  await supabase.from('wa_conversaciones').update({ contact_id: nuevo.id, triage: 'ventas' }).eq('id', convId);
  await supabase.from('activities').insert({ contact_id: nuevo.id, tipo: 'contacto_creado', titulo: 'Lead creado: nos escribió por WhatsApp', automatico: true, metadata: { regla: 'alta_wa_entrante', triaje: 'ia' } });
  await notificar({ clave: `lead_wa_${nuevo.id}`, tipo: 'lead_nuevo', titulo: `Lead nuevo por WhatsApp: ${o.nombrePerfil || telefonoLegible(telefono)}`, metadata: { contact_id: nuevo.id, conversation_id: convId } }).catch(() => {});
  await avisarNuevoLead({ id: nuevo.id, nombre: o.nombrePerfil, whatsapp: telefono, fuente: 'WhatsApp directo' }, 'Nos escribió él — contéstale ya.').catch(() => {});
}
