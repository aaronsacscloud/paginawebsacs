// TELEFONÍA · Detección de contestadora (AMD). Twilio escucha los primeros
// segundos de la llamada y dice si contestó una PERSONA o una GRABADORA.
//
// Por qué hace falta: para Twilio el buzón de voz CONTESTA. Una llamada que
// cae en la grabadora se registra igual que una atendida —completada, con
// duración— así que sin esto tres intentos al buzón se veían en el CRM como
// tres conversaciones exitosas. `AnsweredBy` es lo único que los separa.
//
// PÚBLICO con firma validada; siempre responde 200 para que Twilio no reintente.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { firmaValida } from '../../../lib/telefonia/twilio';
import { registrarBitacoraLlamada } from '../../../lib/telefonia/bitacora';

export const prerender = false;
const BASE = 'https://www.sacscloud.com';
const ok = (o: any = { ok: true }) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, url }) => {
  const raw = await request.text();
  const p = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;

  /* ⚠️ LA FIRMA INCLUYE LA CADENA DE CONSULTA. Twilio firma la URL COMPLETA
     —con `?padre=…`— más los campos ordenados. Si aquí se firmara solo la
     ruta, ninguna llamada pasaría el filtro. */
  if (!firmaValida(`${BASE}/api/telefonia/amd${url.search}`, p, request.headers.get('x-twilio-signature'))) {
    return ok({ ok: false });
  }

  /* El CallSid que manda AMD es el de la pata HIJA (el teléfono al que se
     marcó), no el de la llamada del navegador, que es con la que está armado
     todo el espejo. Por eso el padre viaja en la URL: es la única forma
     determinista de amarrarlos —la documentación de AMD no promete
     `ParentCallSid` entre sus campos. */
  const padre = String(url.searchParams.get('padre') || '').trim();
  if (!/^CA[0-9a-f]{32}$/i.test(padre)) return ok({ ok: false, motivo: 'sin padre' });

  /* Esta ruta atiende DOS avisos de la misma pata, porque son el mismo dato
     visto desde dos lados y no vale la pena un segundo endpoint:
       · `AnsweredBy` → el veredicto de la contestadora.
       · `CallStatus=answered` → el instante EXACTO en que descolgaron.
     El segundo es lo que permite decir «timbró 24 s» sin inventar: antes se
     restaba lo hablado del total y, si los avisos llegaban juntos, salía
     «timbró 0 s». */
  if (String(p.CallStatus || '').toLowerCase() === 'answered') {
    await supabase.from('wa_llamadas')
      .update({ answered_at: new Date().toISOString() })
      .eq('call_id', padre).is('answered_at', null);
    return ok({ ok: true, marca: 'answered_at' });
  }

  const contestó = String(p.AnsweredBy || '').trim();
  if (!contestó) return ok({ ok: true, motivo: 'sin veredicto' });

  const { data: prev } = await supabase.from('wa_llamadas').select('payload').eq('call_id', padre).maybeSingle();
  await supabase.from('wa_llamadas').update({
    payload: { ...((prev as any)?.payload || {}), answered_by: contestó, amd_ms: Number(p.MachineDetectionDuration || 0) || null },
  }).eq('call_id', padre);

  /* Se reescribe la bitácora AHORA. El veredicto casi siempre llega antes de
     que termine la llamada, así que la nota nacerá ya sabiendo que fue el
     buzón; pero si llegara tarde, `registrarBitacoraLlamada` es idempotente y
     corrige la nota que ya estaba en lugar de escribir otra. */
  await registrarBitacoraLlamada(padre);
  return ok({ ok: true, answered_by: contestó });
};
