import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const OPENAI_API_KEY = (import.meta.env.OPENAI_API_KEY || '').trim();

export const POST: APIRoute = async ({ request }) => {
  const { transcript, contact_id, deal_id } = await request.json();

  if (!transcript || transcript.length < 50) {
    return new Response(JSON.stringify({ error: 'Transcript too short (min 50 chars)' }), { status: 400 });
  }

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OpenAI not configured' }), { status: 503 });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que genera minutas de reuniones de ventas para SACS (software de punto de venta para retailers en Mexico). Responde en JSON con: { "resumen": "resumen de 2-3 oraciones", "puntos_clave": ["punto 1", "punto 2"], "proximos_pasos": ["paso 1", "paso 2"], "sentimiento": "positivo|neutral|negativo", "plan_interes": "vende|controla|fideliza|automatiza|null", "objeciones": ["objecion 1"], "duracion_estimada": "X minutos" }' },
        { role: 'user', content: `Genera la minuta de esta llamada/reunion:\n\n${transcript.substring(0, 12000)}` },
      ],
      temperature: 0.3,
    }),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  let summary: any;
  try { summary = JSON.parse(content); } catch { summary = { resumen: content }; }

  // Log activity if contact provided
  if (contact_id) {
    await supabase.from('activities').insert({
      contact_id,
      deal_id: deal_id || null,
      tipo: 'llamada',
      titulo: `Llamada — ${summary.sentimiento || 'neutral'}`,
      descripcion: summary.resumen || transcript.substring(0, 500),
      metadata: { transcript: transcript.substring(0, 5000), summary },
      automatico: false,
    });
  }

  return new Response(JSON.stringify(summary));
};
