// TELEFONÍA · Reglas automáticas: qué pasa DESPUÉS de una llamada.
//
// Hoy hay una: si marcaste y no lograste hablar —cayó en el buzón o nadie
// contestó— se le manda al contacto un WhatsApp de utilidad para que tenga por
// dónde volver. Se prende, se redacta y se acota desde
// Configuración ▸ WhatsApp ▸ Llamadas; aquí no hay ningún texto quemado.
//
// ── LA REGLA DE ORO: UNA SOLA VEZ ──────────────────────────────────────────
// «Si yo le vuelvo a marcar, ya se envió ese mismo; que no envíe otro.» Eso NO
// se resuelve mirando el historial —dos llamadas seguidas cierran casi a la
// vez y las dos verían el historial vacío—, sino con una marca única en
// `wa_envios_idem`: quien logra insertarla manda, el resto se calla. Es la
// misma pieza que usa el composer para que un doble clic no mande dos veces.
import { supabase } from '../supabase';
import { telefonoLegible, telefonoWhatsApp } from '../telefono';
import { permitido } from '../whatsapp/permisos';
import { puedeMandarWa, cadenciaPausadaPorPersona } from '../whatsapp/presion';
import { enviarTexto, enviarPlantilla, enContexto } from '../whatsapp/kapso-api';
import { ventanaEnLinea } from '../whatsapp/linea';
import { NUMERO } from './twilio';

type Desenlace = 'buzon' | 'sin_contestar' | 'contestada' | 'otro';

export type ResultadoRegla = { mandado: boolean; motivo: string; via?: 'texto' | 'plantilla' };

/** Qué le pasó a la llamada, en los términos que entienden las reglas. */
export function desenlaceDeLlamada(ll: {
  estado: string; direccion: string; duracion_seg: number | null; payload: any;
}): Desenlace {
  const contestó = String(ll.payload?.answered_by || '');
  if (/^machine_/.test(contestó)) return 'buzon';
  if (['perdida', 'rechazada'].includes(ll.estado)) return 'sin_contestar';
  if (ll.estado === 'terminada' && Number(ll.duracion_seg || 0) > 0) return 'contestada';
  return 'otro';
}

/** ¿Estamos dentro del horario de atención configurado para el inbox? */
function enHorario(horario: any): boolean {
  if (!horario?.desde || !horario?.hasta) return true;
  // Hora del centro de México, que es con la que está configurado el inbox.
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const dias: number[] = Array.isArray(horario.dias) ? horario.dias : [1, 2, 3, 4, 5];
  if (!dias.includes(ahora.getDay())) return false;
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  const [hd, md] = String(horario.desde).split(':').map(Number);
  const [hh, mh] = String(horario.hasta).split(':').map(Number);
  return min >= hd * 60 + (md || 0) && min < hh * 60 + (mh || 0);
}

const primerNombre = (n?: string | null) => String(n || '').trim().split(/\s+/)[0] || '';

/**
 * Aplica las reglas a una llamada ya cerrada.
 * Nunca lanza: esto corre dentro de un webhook de Twilio que TIENE que responder.
 */
export async function aplicarReglasLlamada(callId: string): Promise<ResultadoRegla> {
  try {
    const { data: ll } = await supabase.from('wa_llamadas')
      .select('call_id, canal, direccion, telefono, estado, duracion_seg, payload, conversation_id, ended_at')
      .eq('call_id', callId).eq('canal', 'telefono').maybeSingle();
    if (!ll) return { mandado: false, motivo: 'la llamada no existe' };

    /* ⚠️ SOLO CON LA LLAMADA YA COLGADA. El veredicto de la contestadora llega
       ANTES de que termine la llamada, y esta función corre también en ese
       momento. Sin este freno se le mandaría el WhatsApp mientras la grabadora
       del cliente sigue corriendo — y encima con los tiempos aún sin cerrar. */
    if (!ll.ended_at || ['timbrando', 'aceptada'].includes(String(ll.estado))) {
      return { mandado: false, motivo: 'la llamada sigue en curso' };
    }

    // Solo cuando NOSOTROS marcamos: si el cliente llamó y no alcanzamos a
    // contestar, escribirle «te marcamos y no contestaste» sería absurdo.
    if (ll.direccion !== 'saliente') return { mandado: false, motivo: 'no es saliente' };

    const desenlace = desenlaceDeLlamada(ll as any);
    if (desenlace === 'contestada' || desenlace === 'otro') return { mandado: false, motivo: 'sí hubo contacto' };

    const { data: cfg } = await supabase.from('wa_config')
      .select('llamadas_regla_activa, llamadas_regla_cuando, llamadas_regla_texto, llamadas_regla_plantilla, llamadas_regla_una_vez, llamadas_regla_horario, horario')
      .eq('id', 1).maybeSingle();
    if (!cfg?.llamadas_regla_activa) return { mandado: false, motivo: 'la regla está apagada' };

    const cuando = String(cfg.llamadas_regla_cuando || 'ambos');
    if (cuando !== 'ambos' && cuando !== desenlace) return { mandado: false, motivo: `la regla solo aplica a «${cuando}»` };

    if (!ll.conversation_id) return { mandado: false, motivo: 'el teléfono no tiene conversación en el inbox' };
    const { data: conv } = await supabase.from('wa_conversaciones')
      .select('id, telefono, contact_id, phone_number_id, ventanas, ultimo_entrante_at, contacts(nombre)')
      .eq('id', ll.conversation_id).maybeSingle();
    if (!conv) return { mandado: false, motivo: 'conversación no encontrada' };

    const tel = telefonoWhatsApp((conv as any).telefono || ll.telefono);
    if (!tel) return { mandado: false, motivo: 'el teléfono no sirve para WhatsApp' };

    // ── Los frenos que ya protegen a todo lo demás ────────────────────────
    // La lista de permitidos es fail-closed y es el interruptor maestro del
    // dueño: si él pausa la telefonía ahí, esto no manda aunque la regla esté
    // encendida en su propia pantalla.
    if (!(await permitido('llamada_sin_contacto'))) return { mandado: false, motivo: 'pausada en Automatizaciones' };
    if (cfg.llamadas_regla_horario && !enHorario(cfg.horario)) return { mandado: false, motivo: 'fuera del horario de atención' };
    const presion = await puedeMandarWa(tel);
    if (!presion.ok) return { mandado: false, motivo: 'ya se le escribió hoy por WhatsApp' };
    if (await cadenciaPausadaPorPersona(tel)) return { mandado: false, motivo: 'una persona tomó la conversación' };

    /* ── LA MARCA ÚNICA ─────────────────────────────────────────────────────
       Con `una_vez` la marca es del CONTACTO y no caduca: aunque le marques
       diez veces en un mes, el mensaje sale una sola vez en su vida. Sin
       `una_vez`, la marca es de ESTA llamada, así que sale uno por intento
       pero nunca dos por el mismo (el veredicto de la contestadora y el
       cierre del <Dial> pueden llegar los dos aquí). */
    const idem = cfg.llamadas_regla_una_vez
      ? `tel-sincontacto-contacto-${(conv as any).contact_id || tel}`
      : `tel-sincontacto-llamada-${callId}`;
    const { error: eIdem } = await supabase.from('wa_envios_idem').insert({ idem, conversation_id: (conv as any).id });
    if (eIdem) return { mandado: false, motivo: cfg.llamadas_regla_una_vez ? 'ya se le había mandado antes' : 'ya se mandó por esta llamada' };

    try {
      const nombre = primerNombre((conv as any).contacts?.nombre) || 'qué tal';
      enContexto('llamada', 'telefonia');

      /* La ventana de 24 h es POR LÍNEA, no por conversación: un entrante la
         abre solo en el número por el que llegó. `ventanaEnLinea` es la misma
         función que usa el composer para avisar si se puede escribir libre —
         no una copia, para que las dos pantallas no se separen. */
      const ventana = ventanaEnLinea(conv as any, (conv as any).phone_number_id);
      if (ventana.abierta) {
        // Dentro de las 24 h Meta deja texto libre: se manda tal cual quedó
        // redactado en Configuración, con sus dos variables resueltas.
        const texto = String(cfg.llamadas_regla_texto || '')
          .replace(/\{\{\s*nombre\s*\}\}/gi, nombre)
          .replace(/\{\{\s*numero\s*\}\}/gi, telefonoLegible(NUMERO));
        if (!texto.trim()) throw new Error('el mensaje está vacío');
        await enviarTexto(tel, texto);
        return { mandado: true, motivo: 'mandado por WhatsApp', via: 'texto' };
      }

      /* Fuera de la ventana Meta NO acepta texto libre: hace falta una
         plantilla UTILITY aprobada. Sin plantilla elegida se prefiere NO
         mandar y decirlo, en vez de intentar un envío que Meta rechaza y que
         nadie vería fallar. */
      if (!cfg.llamadas_regla_plantilla) throw new Error('fuera de la ventana de 24 h y sin plantilla elegida');
      await enviarPlantilla(tel, String(cfg.llamadas_regla_plantilla), 'es_MX', [nombre]);
      return { mandado: true, motivo: 'mandado con plantilla (fuera de la ventana de 24 h)', via: 'plantilla' };
    } catch (e: any) {
      // Se libera la marca: si no salió, el próximo intento SÍ debe poder.
      await supabase.from('wa_envios_idem').delete().eq('idem', idem);
      return { mandado: false, motivo: String(e?.message || e) };
    }
  } catch (e: any) {
    console.error(`[telefonia/reglas] ${callId}: ${String(e?.message || e)}`);
    return { mandado: false, motivo: String(e?.message || e) };
  }
}
