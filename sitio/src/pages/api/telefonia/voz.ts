// TELEFONÍA · TwiML: qué hacer cuando una llamada arranca. PÚBLICO (Twilio no
// tiene cookies): se valida la firma X-Twilio-Signature; falla cerrado.
//
// - Saliente (viene del SDK del navegador vía la TwiML App): marca al número
//   destino con el callerId de nuestro número MX y GRABA en dual.
// - Entrante (alguien marca a nuestro número): timbra en los navegadores con
//   el CRM abierto (todas las identidades registradas) y también graba.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { firmaValida, xml, NUMERO, telefoniaConfigurada } from '../../../lib/telefonia/twilio';

export const prerender = false;
const BASE = 'https://www.sacscloud.com';

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  const p = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;
  if (!telefoniaConfigurada() || !firmaValida(`${BASE}/api/telefonia/voz`, p, request.headers.get('x-twilio-signature'))) {
    return xml('<Reject/>');
  }
  const grabar = `record="record-from-answer-dual" recordingStatusCallback="${BASE}/api/telefonia/grabacion" recordingStatusCallbackEvent="completed"`;
  const estado = `action="${BASE}/api/telefonia/estado"`;

  // Entrante: To = nuestro número. Saliente desde el navegador: To = destino.
  const esEntrante = p.To === NUMERO || p.Direction === 'inbound';
  const destino = String(p.To || '').trim();

  // Espejo de la llamada (misma tabla que WhatsApp, canal 'telefono'): el
  // conversation_id se liga por teléfono para que la minuta caiga en el hilo.
  const telCliente = esEntrante ? p.From : destino;
  let convId: string | null = null;
  if (telCliente) {
    const limpio = telCliente.replace(/\D/g, '').slice(-10);
    const { data: conv } = await supabase.from('wa_conversaciones').select('id')
      .like('telefono', `%${limpio}`).limit(1).maybeSingle();
    convId = conv?.id || null;
  }
  await supabase.from('wa_llamadas').upsert({
    call_id: p.CallSid, canal: 'telefono', conversation_id: convId,
    telefono: telCliente || 'desconocido',
    direccion: esEntrante ? 'entrante' : 'saliente',
    estado: 'timbrando', payload: { from: p.From, to: p.To },
  }, { onConflict: 'call_id' });

  if (esEntrante) {
    // Timbrar en el CRM: todas las identidades registradas ahora mismo.
    const { data: regs } = await supabase.from('tel_identidades').select('identity').gte('visto_at', new Date(Date.now() - 5 * 60e3).toISOString());
    const clientes = (regs || []).map(r => `<Client>${r.identity}</Client>`).join('');
    if (!clientes) return xml(`<Say language="es-MX" voice="Polly.Mia-Neural">Gracias por llamar a Sacscloud. Por el momento no podemos atenderte; escríbenos por WhatsApp a este mismo número.</Say>`);
    return xml(`<Dial ${grabar} ${estado} answerOnBridge="true">${clientes}</Dial>`);
  }
  if (!/^\+\d{8,15}$/.test(destino)) return xml('<Say language="es-MX" voice="Polly.Mia-Neural">Número inválido.</Say>');
  return xml(`<Dial callerId="${NUMERO}" ${grabar} ${estado}><Number>${destino}</Number></Dial>`);
};
