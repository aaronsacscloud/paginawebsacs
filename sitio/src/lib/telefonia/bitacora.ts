// TELEFONÍA · La bitácora de la llamada: una nota interna en el inbox y una
// actividad en la ficha, escritas SOLAS, con lo que de verdad pasó.
//
// Por qué existe: hasta ahora solo dejaban rastro las llamadas que llegaban a
// tener minuta (20 s o más y con voz transcribible). Todo lo demás —no
// contestó, comunicaba, número muerto y, sobre todo, LAS QUE CAEN EN EL
// BUZÓN— desaparecía sin dejar nada. Alguien marcaba tres veces, las tres
// caían en la grabadora, y en el inbox no había señal de que se hubiera
// intentado. Ahora cada llamada deja su renglón, haya hablado o no.
//
// Es IDEMPOTENTE a propósito: la detección de contestadora y el cierre del
// <Dial> llegan por caminos distintos y en cualquier orden. Se puede llamar
// dos veces con el mismo CallSid y la nota se corrige en lugar de duplicarse.
import { supabase } from '../supabase';
import { telefonoLegible } from '../telefono';
import { aplicarReglasLlamada } from './reglas';

/* Motivos por los que NO mandar es lo NORMAL y no hay nada que reportar: si
   la regla está apagada o hubo conversación, decirlo en cada nota sería ruido
   en todas. Lo que sí se reporta es lo que el dueño querría saber: que se topó
   con la ventana de 24 h, con el horario, o con un tope. */
const REGLA_MUDA = /apagada|sí hubo contacto|no es saliente|solo aplica|en curso|no existe/i;

/** Los `AnsweredBy` de Twilio que significan «contestó una máquina». */
const ES_MAQUINA = /^machine_/;

const seg = (s: number) => {
  const n = Math.max(0, Math.round(s));
  if (n < 60) return `${n} s`;
  const m = Math.floor(n / 60);
  return n % 60 ? `${m} min ${n % 60} s` : `${m} min`;
};

type Fila = {
  call_id: string; canal: string | null; direccion: string; telefono: string;
  estado: string; motivo: string | null; conversation_id: string | null;
  started_at: string | null; answered_at: string | null; ended_at: string | null; duracion_seg: number | null;
  payload: any; atendida_por: string | null;
};

/** El relato: título corto para la actividad, cuerpo para la nota del inbox. */
function narrar(ll: Fila): { titulo: string; cuerpo: string; icono: string } {
  const saliente = ll.direccion === 'saliente';
  const quien = telefonoLegible(ll.telefono);
  const hacia = saliente ? `Llamada saliente a ${quien}` : `Llamada entrante de ${quien}`;
  const habló = Number(ll.duracion_seg || 0);

  /* Cuánto timbró. Se MIDE, no se infiere: `answered_at` es la marca que deja
     Twilio en el instante exacto en que descolgaron. Antes se restaba lo
     hablado del total, y cuando los avisos llegaban casi juntos el resultado
     era «timbró 0 s» — un dato falso en una nota que existe justamente para
     que alguien sepa qué pasó. Si nunca contestaron no hay marca, y entonces
     sí vale el total: eso ES lo que timbró. */
  const ini = ll.started_at ? Date.parse(ll.started_at) : 0;
  const fin = ll.ended_at ? Date.parse(ll.ended_at) : 0;
  const desc = ll.answered_at ? Date.parse(ll.answered_at) : 0;
  const total = ini && fin ? Math.round((fin - ini) / 1000) : 0;
  const timbró = ini && desc ? Math.max(0, Math.round((desc - ini) / 1000)) : Math.max(0, total - habló);

  const contestó = String(ll.payload?.answered_by || '');

  // ── BUZÓN DE VOZ ────────────────────────────────────────────────────────
  // El caso que el dueño pidió explícitamente, y el más traicionero: para
  // Twilio el buzón CONTESTA, así que la llamada se registra como completada
  // con duración. Sin detección de contestadora, tres intentos al buzón se
  // veían en el CRM como tres conversaciones exitosas.
  if (ES_MAQUINA.test(contestó)) {
    return {
      icono: '📼', titulo: `${hacia} — cayó en el buzón`,
      cuerpo: `Timbró ${seg(timbró)} y entró el **buzón de voz** (lo contestó una grabadora, no una persona).`
        + ` La grabadora corrió ${seg(habló)} antes de colgar. **No se dejó mensaje.**`
        + `\n\nSigue sin haber contacto: hay que volver a intentar o escribirle por WhatsApp.`,
    };
  }
  if (contestó === 'fax') {
    return { icono: '📠', titulo: `${hacia} — contestó un fax`, cuerpo: `Timbró ${seg(timbró)} y del otro lado respondió un fax. El número está mal capturado o ya no es de esa persona.` };
  }

  // ── SIN RESPUESTA ───────────────────────────────────────────────────────
  if (ll.estado === 'perdida') {
    return saliente
      ? { icono: '📵', titulo: `${hacia} — no contestó`, cuerpo: `Timbró ${seg(timbró || total)} y nadie tomó la llamada. Ni siquiera entró el buzón.` }
      : { icono: '🔔', titulo: `${hacia} — perdida`, cuerpo: `Sonó ${seg(timbró || total)} en el CRM y no se alcanzó a contestar. **Conviene devolverle la llamada.**` };
  }
  if (ll.estado === 'rechazada') {
    return saliente
      ? { icono: '⛔', titulo: `${hacia} — comunicaba`, cuerpo: `La línea estaba ocupada o rechazaron la llamada después de ${seg(timbró || total)}.` }
      : { icono: '⛔', titulo: `${hacia} — rechazada`, cuerpo: `Se rechazó desde el CRM.` };
  }
  if (ll.estado === 'fallida') {
    return { icono: '⚠️', titulo: `${hacia} — no se pudo completar`, cuerpo: ll.motivo || 'Twilio no pudo completar la llamada. Revisa que el teléfono esté bien capturado.' };
  }

  // ── HUBO CONVERSACIÓN ───────────────────────────────────────────────────
  if (habló > 0) {
    const base = `Timbró ${seg(timbró)} y se habló ${seg(habló)}.`;
    return {
      icono: '✅', titulo: `${hacia} — ${seg(habló)} de conversación`,
      cuerpo: habló >= 20
        ? `${base} La grabación se está transcribiendo; **la minuta cae aquí mismo en un minuto.**`
        : `${base} Fue muy corta para generar minuta (se transcriben de 20 s en adelante).`,
    };
  }
  return { icono: '☎️', titulo: `${hacia} — terminada`, cuerpo: `La llamada terminó sin que llegara a haber conversación.` };
}

/**
 * Escribe (o corrige) la nota del inbox y la actividad de la ficha.
 * Nunca lanza: una bitácora que falle no puede tumbar un webhook de Twilio.
 */
export async function registrarBitacoraLlamada(callId: string): Promise<void> {
  try {
    const { data } = await supabase.from('wa_llamadas')
      .select('call_id, canal, direccion, telefono, estado, motivo, conversation_id, started_at, answered_at, ended_at, duracion_seg, payload, atendida_por')
      .eq('call_id', callId).maybeSingle();
    if (!data) return;
    const ll = data as Fila;

    const { titulo, cuerpo, icono } = narrar(ll);

    /* Las reglas automáticas corren AQUÍ y su resultado entra en la MISMA
       nota. Un WhatsApp que sale solo tiene que verse donde se ve todo lo
       demás de esa llamada; si va a un renglón aparte, nadie lo relaciona.
       Y si NO salió, el motivo también se escribe: «no se mandó» sin decir
       por qué es peor que no decir nada. */
    const regla = await aplicarReglasLlamada(callId);
    const linea = regla.mandado
      ? `\n\n💬 Se le mandó el WhatsApp automático de la regla${regla.via === 'plantilla' ? ' (con plantilla, porque ya cerró la ventana de 24 h)' : ''}.`
      : REGLA_MUDA.test(regla.motivo) ? ''
      : `\n\n💬 No se le mandó el WhatsApp automático: ${regla.motivo}.`;

    const texto = `${icono} **${titulo}**\n\n${cuerpo}${linea}`;

    // ── Nota en el hilo del inbox ─────────────────────────────────────────
    if (ll.conversation_id) {
      const { data: conv } = await supabase.from('wa_conversaciones')
        .select('contact_id, company_id').eq('id', ll.conversation_id).maybeSingle();

      // Idempotencia: se busca por el CallSid guardado en metadata. Si la nota
      // ya existe (porque la detección de contestadora llegó después del
      // cierre del <Dial>), se CORRIGE en vez de escribir una segunda.
      const { data: previa } = await supabase.from('wa_notas')
        .select('id').eq('conversation_id', ll.conversation_id)
        .eq('metadata->>call_id', callId).maybeSingle();

      const fila = {
        conversation_id: ll.conversation_id,
        contact_id: (conv as any)?.contact_id || null,
        autor: 'Telefonía',
        texto,
        metadata: { call_id: callId, tipo: 'llamada', canal: ll.canal, estado: ll.estado, answered_by: ll.payload?.answered_by || null },
      };
      if (previa?.id) await supabase.from('wa_notas').update({ texto, metadata: fila.metadata }).eq('id', previa.id);
      else await supabase.from('wa_notas').insert(fila);

      // ── Actividad de la ficha 360 ───────────────────────────────────────
      if ((conv as any)?.contact_id) {
        const { data: act } = await supabase.from('activities')
          .select('id').eq('contact_id', (conv as any).contact_id)
          .eq('metadata->>call_id', callId).maybeSingle();
        const cuerpoAct = { tipo: 'llamada', titulo, descripcion: cuerpo, automatico: true };
        if (act?.id) await supabase.from('activities').update(cuerpoAct).eq('id', act.id);
        else await supabase.from('activities').insert({
          ...cuerpoAct,
          contact_id: (conv as any).contact_id,
          company_id: (conv as any).company_id || null,
          metadata: fila.metadata,
        });
      }
    }
  } catch (e: any) {
    // Se registra y se sigue: el webhook de Twilio TIENE que responder.
    console.error(`[telefonia/bitacora] ${callId}: ${String(e?.message || e)}`);
  }
}
