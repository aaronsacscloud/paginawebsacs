// TELEFONÍA · action del <Dial>: cierra la llamada en el espejo (estado y
// duración reales). PÚBLICO con firma validada; siempre responde TwiML vacío.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { firmaValida, xml } from '../../../lib/telefonia/twilio';
import { registrarBitacoraLlamada } from '../../../lib/telefonia/bitacora';

export const prerender = false;
const BASE = 'https://www.sacscloud.com';
const MAPA: Record<string, string> = { completed: 'terminada', answered: 'terminada', busy: 'rechazada', 'no-answer': 'perdida', failed: 'fallida', canceled: 'perdida' };

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  const p = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;
  if (!firmaValida(`${BASE}/api/telefonia/estado`, p, request.headers.get('x-twilio-signature'))) return xml('');
  const dur = parseInt(p.DialCallDuration || p.CallDuration || '0', 10) || null;
  await supabase.from('wa_llamadas').update({
    estado: MAPA[p.DialCallStatus || p.CallStatus] || 'terminada',
    duracion_seg: dur, ended_at: new Date().toISOString(),
  }).eq('call_id', p.CallSid);

  /* Aquí es donde la llamada deja rastro. Antes solo lo dejaban las que
     alcanzaban a tener minuta (20 s y con voz): «no contestó», «comunicaba»,
     «número muerto» y las que caen en el buzón se perdían sin que nadie se
     enterara de que se había intentado. Ahora cada una escribe su nota en el
     inbox y su renglón en la ficha. */
  await registrarBitacoraLlamada(p.CallSid);

  /* ══ NOS LLAMARON Y NO ALCANZAMOS ══════════════════════════════════════
     Sólo para ENTRANTES que se quedaron sin contestar. En las salientes no
     aplica: ahí el que no contestó fue él, y avisarle «no alcanzamos a
     responderte» sería mentirle.

     Va después de la bitácora y sin esperar a que termine: Twilio quiere el
     TwiML rápido, y si el aviso tarda o truena no debe arrastrar la llamada.
     Lo que no puede fallar —el rastro— ya se escribió arriba. */
  /* ══ LA LLAMADA SE CIERRA AUNQUE NADIE TOQUE LA PANTALLA (17-sep-2026) ═══
     El que cuelga primero casi siempre es el cliente, y quien atendió puede
     cerrar la pestaña sin decir nada. Si el cierre dependiera del botón
     «Colgar» de la sala, esas llamadas se quedarían abiertas para siempre: sin
     apunte, sin compromiso y sin el envío prometido.

     Aquí sólo se CIERRA el item (un UPDATE, rápido: Twilio quiere su respuesta
     en segundos). Proponer y aplicar el cierre con IA lo hace el latido,
     `rescatarCierres`, a los dos minutos — que es también el rato que se le da
     a la persona para cerrarlo ella desde la pantalla, que siempre sabe más.
     `soloSiExiste` evita crearle item a una llamada que nunca tuvo sala.

     Se ESPERA (son tres consultas) y no se deja corriendo: en serverless lo que
     no se espera se muere a medias cuando la función contesta. */
  await import('../../../lib/telefonia/suelta')
    .then(m => m.cerrarLlamadaSuelta(p.CallSid, { soloSiExiste: true }))
    .catch(() => { /* el rescate del latido lo vuelve a intentar */ });

  const estadoFinal = MAPA[p.DialCallStatus || p.CallStatus] || 'terminada';
  if (estadoFinal === 'perdida' || estadoFinal === 'rechazada') {
    const { data: ll } = await supabase.from('wa_llamadas')
      .select('direccion, telefono').eq('call_id', p.CallSid).maybeSingle();
    if (ll?.direccion === 'entrante' && ll.telefono) {
      import('../../../lib/telefonia/perdida')
        .then(m => m.avisarLlamadaPerdida(ll.telefono))
        .catch(() => { /* el aviso es un extra: nunca tumba el webhook */ });
    }
  }
  return xml('');
};
