// TELEFONÍA · LO QUE SE OYE EN UNA LLAMADA NORMAL, mientras pasa.
//
// Es el gemelo de `/api/telefonia/marcador/transcripcion`, pero para las
// llamadas que NO son de una lista: las entrantes y las que se marcan a mano.
// Twilio manda aquí cada fragmento de las dos pistas y con eso se hacen dos
// cosas, en este orden de importancia:
//
//   1. Se guarda en el item de la llamada (`oido`), que es lo que después lee
//      el cierre con IA. Sin esto, colgar una entrante no deja NADA: ni
//      apunte, ni compromiso, ni envío. Era la mitad del «aplica exactamente
//      el mismo proceso».
//   2. Se mira si el cliente PIDIÓ ALGO («mándame la info por WhatsApp») y, si
//      sí, se anota como acción y las seguras salen solas. Ver `acciones.ts`.
//
// PÚBLICO (Twilio no tiene cookies): la firma se valida y falla cerrado.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { firmaValida, xml } from '../../../lib/telefonia/twilio';
import type { Oido } from '../../../lib/telefonia/oidos';
import { itemDeLlamada } from '../../../lib/telefonia/suelta';
import { corregirTerminos } from '../../../lib/telefonia/terminos';
import { detectar, anotarYHacer } from '../../../lib/telefonia/acciones';

export const prerender = false;
const BASE = 'https://www.sacscloud.com';
const ahora = () => new Date().toISOString();

export const POST: APIRoute = async ({ request, url }) => {
  const raw = await request.text();
  const p = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;
  // La URL firmada incluye el query tal cual llegó (igual que en /amd y en los
  // webhooks del marcador): reconstruirla a mano es cómo se rompe la firma.
  if (!firmaValida(`${BASE}/api/telefonia/dictado${url.search}`, p, request.headers.get('x-twilio-signature'))) return xml('');
  const call = String(url.searchParams.get('call') || p.CallSid || '');
  if (!call) return xml('');
  if (p.TranscriptionEvent !== 'transcription-content') return xml('');

  let texto = '';
  try { texto = String(JSON.parse(p.TranscriptionData || '{}')?.transcript || ''); } catch { texto = ''; }
  if (!texto.trim()) return xml('');

  const it = await itemDeLlamada(call);
  if (!it) return xml('');   // la llamada no está en el espejo: no hay dónde apuntar

  /* Quién habló. `outbound_track` es lo que sale de Twilio hacia el otro lado
     —o sea, NUESTRA voz— tanto en una saliente como en una entrante. Lo que
     dispara acciones es sólo lo que dice el CLIENTE: si el vendedor dice «te
     mando la info», eso ya es una promesa suya, no una petición. */
  const quien: Oido['quien'] = /outbound/.test(String(p.Track || '')) ? 'vendedor' : 'contacto';

  /* ══ AQUÍ SÓLO ENTRAN LOS FINALES (17-sep-2026) ═════════════════════════
     El marcador sí guarda los parciales: los necesita para decidir en dos
     segundos si contestó una persona o un buzón. Aquí NO hay nada que decidir
     —ya hay alguien hablando— y los parciales sólo traen problemas:

     · `oido` se lee y se escribe entero en cada fragmento, y Twilio manda uno
       por segundo POR PISTA. Dos escrituras que se cruzan y la última pisa a
       la otra: se pierde justo la frase que pedía algo.
     · Una acción no puede dispararse con media frase: «mándame la info…» que
       en realidad terminaba en «…no, mejor luego» habría mandado un WhatsApp
       que nadie pidió.

     Con finales solamente, las escrituras bajan a una por frase dicha y lo que
     se ve en pantalla llega uno o dos segundos después. Vale el cambio. */
  if (String(p.Final) !== 'true') return xml('');
  const final = true;

  const { data: fila } = await supabase.from('tel_sesion_items').select('oido, contestado_at').eq('id', it.id).maybeSingle();
  const oido: Oido[] = Array.isArray(fila?.oido) ? (fila!.oido as any).slice() : [];
  const t = fila?.contestado_at ? Date.now() - new Date(fila.contestado_at).getTime() : 0;
  /* Los nombres propios, bien escritos desde que entran. Aquí SÍ se corrige lo
     que se guarda —al revés que en la minuta, donde la transcripción cruda es
     la evidencia—: esto es lo que se lee en pantalla durante la llamada y de
     donde salen el cierre con IA y las acciones. Ver `lib/telefonia/terminos`. */
  oido.push({ t, texto: corregirTerminos(texto.trim()).slice(0, 300), final, quien });
  // Una llamada muy larga no puede crecer sin fin: se quedan las últimas 300
  // frases, que son de sobra para el cierre con IA (lee 9000 caracteres).
  if (oido.length > 300) oido.splice(0, oido.length - 300);
  await supabase.from('tel_sesion_items').update({ oido, updated_at: ahora() }).eq('id', it.id);

  /* Las acciones se miran sólo en los FINALES del cliente: un parcial a medias
     («mándame la info…» que en realidad era «mándame la info no, mejor no»)
     dispararía un WhatsApp que nadie pidió. */
  if (final && quien === 'contacto') {
    const detectadas = await detectar(texto);
    if (detectadas.length) {
      const { data: ll } = await supabase.from('wa_llamadas').select('atendida_por').eq('call_id', call).maybeSingle();
      await anotarYHacer({
        callSid: call, itemId: it.id, contactId: it.contact_id, conversationId: it.conversation_id,
        telefono: it.telefono, nombre: it.nombre, userId: ll?.atendida_por || null,
      }, detectadas);
    }
  }
  return xml('');
};
