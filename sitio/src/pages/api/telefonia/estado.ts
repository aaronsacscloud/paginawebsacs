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
  return xml('');
};
