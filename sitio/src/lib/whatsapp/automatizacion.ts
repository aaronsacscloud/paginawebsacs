// WHATSAPP · Automatización del inbox: bienvenida, fuera de horario y
// asignación round-robin. Corre desde el WEBHOOK al llegar un mensaje
// entrante — nunca desde un saliente, para no responderse a sí misma.
//
// Dedupe a prueba de reintentos de Kapso:
//  - Bienvenida: una vez por conversación (auto_bienvenida_at).
//  - Fuera de horario: máximo una cada 20 h por conversación (auto_fuera_at).
// El mensaje sale por la MISMA vía que el composer (enviarTexto) y el webhook
// message.sent lo espeja con dedup de wamid, así que no se duplica.
import { supabase } from '../supabase';
import { enviarTexto } from './kapso-api';
import { registrarMensaje } from './espejo';

// El horario y el reloj viven con el resto de la configuración del entrante.
export { dentroDeHorario } from './config-entrante';
import { configEntrante, dentroDeHorario } from './config-entrante';
import { permitido } from './permisos';

async function mandarAuto(convId: string, telefono: string, texto: string, marca: 'auto_bienvenida_at' | 'auto_fuera_at') {
  // Marcar ANTES de enviar: si Kapso tarda y el webhook reintenta, no salen dos.
  await supabase.from('wa_conversaciones').update({ [marca]: new Date().toISOString() }).eq('id', convId);
  try {
    const r = await enviarTexto(telefono, texto);
    const wamid = r?.messages?.[0]?.id;
    if (wamid) await registrarMensaje({
      kapsoMessageId: wamid, telefono, direccion: 'saliente', tipo: 'text', cuerpo: texto, status: 'sent',
    });
  } catch (e) {
    console.warn('[wa-auto] envío falló:', e);
  }
}

/** Se llama tras espejar un mensaje ENTRANTE nuevo. */
export async function alRecibirMensaje(convId: string) {
  const { data: cfg } = await supabase.from('wa_config').select('*').eq('id', 1).maybeSingle();
  if (!cfg) return;
  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('id, telefono, asignado_a, auto_bienvenida_at, auto_fuera_at')
    .eq('id', convId).maybeSingle();
  if (!conv) return;

  // Round-robin: la conversación nueva sin dueño se reparte al siguiente del equipo.
  if (cfg.asignacion_rr && !conv.asignado_a) {
    const { data: equipo } = await supabase.from('team_members')
      .select('id').eq('activo', true).in('rol', ['founder', 'cs']).order('nombre');
    if (equipo?.length) {
      const idx = ((cfg.rr_last || 0) + 1) % equipo.length;
      await supabase.from('wa_conversaciones').update({ asignado_a: equipo[idx].id }).eq('id', conv.id);
      await supabase.from('wa_config').update({ rr_last: idx }).eq('id', 1);
    }
  }

  // ── Acuse: siempre que alguien ABRE conversación, a cualquier hora ──
  //
  // "Siempre" es por conversación abierta, no por mensaje: si el lead manda
  // tres mensajes seguidos no le contestamos tres veces la misma frase. Se
  // rearma a las N horas para que quien vuelve al día siguiente sí reciba
  // señal de que lo leímos.
  //
  // Y el texto cambia con la hora, porque la promesa tiene que ser verdad:
  // dentro de horario se contesta en minutos; a medianoche no, y decir que sí
  // es peor que no decir nada.
  //
  // Todo esto se edita en Secuencias ▸ "WhatsApp entrante · atención y
  // control". Si esa secuencia está apagada, no sale acuse: encenderla es una
  // decisión explícita, igual que cualquier otra secuencia.
  const cfgE = await configEntrante();
  if (!cfgE.activa || !cfgE.acuse.activo) return;
  /* Segundo candado, el de arriba de todos: la lista de automatizaciones
     permitidas. Ver `lib/whatsapp/permisos.ts`. */
  if (!(await permitido('acuse_entrante'))) return;

  /* ── SILENCIO CUANDO YA HAY UN HUMANO EN LA CONVERSACIÓN ──
     Caso real del 30 de agosto: el asesor le escribió a las 15:58, ella
     contestó a las 16:17 y el bot le soltó «ya estamos fuera de horario, te
     contesto a partir de las 9 de la mañana» — porque era domingo y el
     horario configurado es de lunes a sábado. El asesor le respondió doce
     minutos después. Delante del cliente, el sistema quedó mintiendo.

     El acuse existe para que nadie se quede sin respuesta. Si un compañero ya
     está en esa conversación, ese trabajo ya está hecho, y el acuse solo puede
     estorbar: o promete algo que ya está pasando («dame unos minutos») o
     contradice a quien está escribiendo («abrimos a las 9»).

     Se mide por el ÚLTIMO SALIENTE CON `autor_id`, que es lo único que
     distingue a una persona de una automatización: solo el composer del CRM y
     los mensajes programados lo llenan. Ventana configurable; 0 la apaga. */
  if (cfgE.acuse.silencio_humano_horas > 0) {
    const desde = new Date(Date.now() - cfgE.acuse.silencio_humano_horas * 3600 * 1000).toISOString();
    const { data: humano } = await supabase.from('wa_mensajes')
      .select('id').eq('conversation_id', convId).eq('direccion', 'saliente')
      .not('autor_id', 'is', null).gte('created_at', desde).limit(1).maybeSingle();
    if (humano) return;
  }

  const enHorario = dentroDeHorario(cfgE.horario);
  const rearme = Date.now() - cfgE.acuse.rearme_horas * 3600 * 1000;
  const yaSaludamos = conv.auto_bienvenida_at && new Date(conv.auto_bienvenida_at).getTime() >= rearme;
  const yaAvisamosFuera = conv.auto_fuera_at && new Date(conv.auto_fuera_at).getTime() >= rearme;

  if (enHorario) {
    if (cfgE.acuse.en_horario && !yaSaludamos) {
      await mandarAuto(conv.id, conv.telefono, cfgE.acuse.en_horario, 'auto_bienvenida_at');
    }
    return;
  }
  // Fuera de horario gana el texto de fuera; si está vacío, cae al de horario
  // antes que dejar al lead sin ninguna señal.
  if (cfgE.acuse.fuera && !yaAvisamosFuera) {
    await mandarAuto(conv.id, conv.telefono, cfgE.acuse.fuera, 'auto_fuera_at');
  } else if (cfgE.acuse.en_horario && !yaSaludamos && !yaAvisamosFuera) {
    await mandarAuto(conv.id, conv.telefono, cfgE.acuse.en_horario, 'auto_bienvenida_at');
  }
}
