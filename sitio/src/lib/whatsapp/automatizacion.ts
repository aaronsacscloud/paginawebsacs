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

type Horario = { dias?: number[]; desde?: string; hasta?: string };

/** ¿Estamos dentro del horario de atención? (hora de Ciudad de México) */
export function dentroDeHorario(h?: Horario | null, ahora = new Date()): boolean {
  if (!h?.desde || !h?.hasta) return true;   // sin horario configurado = siempre abierto
  const mx = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const dia = mx.getDay() === 0 ? 7 : mx.getDay();          // 1=lun … 7=dom
  if (Array.isArray(h.dias) && h.dias.length && !h.dias.includes(dia)) return false;
  const hhmm = `${String(mx.getHours()).padStart(2, '0')}:${String(mx.getMinutes()).padStart(2, '0')}`;
  return hhmm >= h.desde && hhmm <= h.hasta;
}

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
  // rearma a las 20 h, igual que el aviso de fuera de horario, para que quien
  // vuelve al día siguiente sí reciba señal de que lo leímos.
  //
  // Y el texto cambia con la hora, porque la promesa tiene que ser verdad:
  // dentro de horario se contesta en minutos; a medianoche no, y decir que sí
  // es peor que no decir nada.
  const enHorario = dentroDeHorario(cfg.horario);
  const hace20h = Date.now() - 20 * 3600 * 1000;
  const yaSaludamos = conv.auto_bienvenida_at && new Date(conv.auto_bienvenida_at).getTime() >= hace20h;
  const yaAvisamosFuera = conv.auto_fuera_at && new Date(conv.auto_fuera_at).getTime() >= hace20h;

  if (enHorario) {
    if (cfg.bienvenida_activa && cfg.bienvenida_texto && !yaSaludamos) {
      await mandarAuto(conv.id, conv.telefono, cfg.bienvenida_texto, 'auto_bienvenida_at');
    }
    return;
  }

  // Fuera de horario gana el texto de fuera; si no está configurado, cae al
  // de bienvenida antes que dejar al lead sin respuesta.
  if (cfg.fuera_activa && cfg.fuera_texto && !yaAvisamosFuera) {
    await mandarAuto(conv.id, conv.telefono, cfg.fuera_texto, 'auto_fuera_at');
  } else if (cfg.bienvenida_activa && cfg.bienvenida_texto && !yaSaludamos && !yaAvisamosFuera) {
    await mandarAuto(conv.id, conv.telefono, cfg.bienvenida_texto, 'auto_bienvenida_at');
  }
}
