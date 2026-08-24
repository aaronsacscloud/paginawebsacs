// TELEFONÍA · action del <Dial>: cierra la llamada en el espejo (estado y
// duración reales). PÚBLICO con firma validada; siempre responde TwiML vacío.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { firmaValida, xml } from '../../../lib/telefonia/twilio';

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
  return xml('');
};
