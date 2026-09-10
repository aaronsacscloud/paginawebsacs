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
const decir = (t: string) => xml(`<Say language="es-MX" voice="Polly.Mia-Neural">${t}</Say>`);

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  const p = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;
  if (!telefoniaConfigurada() || !firmaValida(`${BASE}/api/telefonia/voz`, p, request.headers.get('x-twilio-signature'))) {
    return xml('<Reject/>');
  }
  const grabar = `record="record-from-answer-dual" recordingStatusCallback="${BASE}/api/telefonia/grabacion" recordingStatusCallbackEvent="completed"`;
  const estado = `action="${BASE}/api/telefonia/estado"`;

  /* ⚠️ CÓMO SE DISTINGUE ENTRANTE DE SALIENTE — la trampa que rompió las
     llamadas en producción (10-sep-2026).

     Se decidía con `p.To === NUMERO || p.Direction === 'inbound'`, y eso está
     mal: **Twilio manda `Direction=inbound` TAMBIÉN para las llamadas que
     nacen en el navegador.** Desde su punto de vista el SDK está llamando
     HACIA Twilio, así que la pata que llega a la TwiML App es entrante. Como
     la condición era un OR, `esEntrante` salía `true` SIEMPRE.

     Qué se veía: dabas clic en llamar a un cliente y el TwiML respondía
     `<Dial><Client>tu-propia-identidad</Client></Dial>` — o sea, la llamada
     se devolvía a tu propio navegador. En pantalla salían DOS barras a la vez
     (la saliente «llamando» y una entrante de `client:crm-…`) y el cliente
     nunca sonaba. La llamada jamás salía de Twilio.

     Lo único que de verdad las separa es el `From`: una llamada del navegador
     siempre llega como `client:<identidad>`. Un teléfono real nunca.

     Y NO se puede volver a meter `Direction` en la condición: es la que
     mentía. */
  const identidad = /^client:(.+)$/i.exec(String(p.From || '').trim())?.[1] || null;
  const esEntrante = !identidad;
  const destino = String(p.To || '').trim();

  // Espejo de la llamada (misma tabla que WhatsApp, canal 'telefono'): el
  // conversation_id se liga por teléfono para que la minuta caiga en el hilo.
  const telCliente = esEntrante ? p.From : destino;
  let convId: string | null = null;
  if (telCliente) {
    const limpio = telCliente.replace(/\D/g, '').slice(-10);
    if (limpio.length === 10) {
      const { data: conv } = await supabase.from('wa_conversaciones').select('id')
        .like('telefono', `%${limpio}`).limit(1).maybeSingle();
      convId = conv?.id || null;
    }
  }
  // Quién marcó: la identidad ya está mapeada a un usuario del CRM en el
  // registro de latido, así que la llamada saliente queda con nombre.
  let agente: { user_id: string | null } | null = null;
  if (identidad) {
    const { data } = await supabase.from('tel_identidades').select('user_id').eq('identity', identidad).maybeSingle();
    agente = data as any;
  }
  await supabase.from('wa_llamadas').upsert({
    call_id: p.CallSid, canal: 'telefono', conversation_id: convId,
    telefono: telCliente || 'desconocido',
    direccion: esEntrante ? 'entrante' : 'saliente',
    estado: 'timbrando', payload: { from: p.From, to: p.To },
    ...(agente?.user_id ? { atendida_por: agente.user_id } : {}),
  }, { onConflict: 'call_id' });

  if (esEntrante) {
    // Timbrar en el CRM: todas las identidades registradas ahora mismo.
    const { data: regs } = await supabase.from('tel_identidades').select('identity').gte('visto_at', new Date(Date.now() - 5 * 60e3).toISOString());
    const clientes = (regs || []).map(r => `<Client>${r.identity}</Client>`).join('');
    if (!clientes) return decir('Gracias por llamar a Sacscloud. Por el momento no podemos atenderte; escríbenos por WhatsApp a este mismo número.');
    return xml(`<Dial ${grabar} ${estado} answerOnBridge="true">${clientes}</Dial>`);
  }

  // ── Saliente. Validaciones ANTES de gastar una llamada ──────────────────
  if (!/^\+\d{8,15}$/.test(destino)) {
    await supabase.from('wa_llamadas').update({ estado: 'fallida', motivo: `Número inválido: ${destino || '(vacío)'}`, ended_at: new Date().toISOString() }).eq('call_id', p.CallSid);
    return decir('El número marcado no es válido. Revisa el teléfono del contacto en el CRM.');
  }
  // Marcarnos a nosotros mismos crea un bucle: la llamada entraría por el
  // webhook de entrantes y volvería a timbrar en este mismo navegador.
  if (destino === NUMERO) {
    await supabase.from('wa_llamadas').update({ estado: 'fallida', motivo: 'Marcaste el número del propio negocio', ended_at: new Date().toISOString() }).eq('call_id', p.CallSid);
    return decir('Ese es el número del negocio. No puedes llamarte a ti mismo.');
  }

  /* `answerOnBridge="true"` no es decorativo: sin él Twilio contesta NUESTRA
     pata al instante y el navegador cree que ya hay conversación desde el
     primer segundo — el cronómetro corría mientras el cliente apenas sonaba,
     y no había forma de mostrar «timbrando». Con el puente, la pata del
     navegador no se contesta hasta que el cliente descuelga de verdad: el SDK
     recibe `ringing` primero y `accept` en el momento exacto de la respuesta. */
  return xml(`<Dial callerId="${NUMERO}" ${grabar} ${estado} answerOnBridge="true" timeout="30"><Number>${destino}</Number></Dial>`);
};
