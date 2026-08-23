// WHATSAPP · Minuta automática de llamadas.
//
// POST multipart {audio, call_id} — la grabación (mezcla local+remoto) que el
// navegador hizo durante la llamada:
//   1. se guarda en Storage (wa-media/llamadas/…),
//   2. se transcribe con Whisper (Groq, whisper-large-v3-turbo),
//   3. Claude redacta la minuta detallada + siguiente paso,
//   4. queda en wa_llamadas y como actividad del contacto: visible en el hilo,
//      en el panel derecho y en la ficha.
// GET ?call_id=… → { llamada } (para saber si la minuta ya está lista).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { anthropic, MODELS } from '../../../../lib/ai/client';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const BUCKET = 'wa-media';
const GROQ_KEY = ((import.meta as any).env?.GROQ_API_KEY || process.env.GROQ_API_KEY || '').trim();

export const GET: APIRoute = async ({ url }) => {
  const callId = url.searchParams.get('call_id') || '';
  if (!callId) return json({ error: 'Falta call_id' }, 400);
  const { data } = await supabase.from('wa_llamadas')
    .select('call_id, estado, duracion_seg, transcript, minuta, minuta_at, siguiente_paso')
    .eq('call_id', callId).maybeSingle();
  return json({ llamada: data || null });
};

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: 'Se esperaba multipart/form-data' }, 400);
  const audio = form.get('audio') as File | null;
  const callId = String(form.get('call_id') || '');
  if (!audio || !callId) return json({ error: 'Faltan audio y call_id' }, 400);
  if (audio.size < 12_000) return json({ error: 'La grabación es demasiado corta para una minuta' }, 400);
  if (audio.size > 50 * 1024 * 1024) return json({ error: 'Grabación mayor a 50 MB' }, 400);
  if (!GROQ_KEY) return json({ error: 'Falta GROQ_API_KEY en el entorno' }, 503);

  const { data: ll } = await supabase.from('wa_llamadas').select('*').eq('call_id', callId).maybeSingle();
  if (!ll) return json({ error: 'Llamada no encontrada' }, 404);

  // 1) Guardar la grabación (evidencia y re-procesos futuros).
  const path = `llamadas/${callId}.webm`;
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
  const buf = await audio.arrayBuffer();
  await supabase.storage.from(BUCKET).upload(path, buf, { contentType: audio.type || 'audio/webm', upsert: true });

  // 2) Whisper (Groq): transcripción en español.
  const wf = new FormData();
  wf.append('file', new File([buf], 'llamada.webm', { type: audio.type || 'audio/webm' }));
  wf.append('model', 'whisper-large-v3-turbo');
  wf.append('language', 'es');
  wf.append('response_format', 'json');
  const wr = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${GROQ_KEY}` }, body: wf,
  });
  const wj = await wr.json().catch(() => ({}));
  if (!wr.ok) return json({ error: `Whisper: ${wj?.error?.message || wr.status}` }, 502);
  const transcript = String(wj.text || '').trim();
  if (transcript.length < 30) {
    await supabase.from('wa_llamadas').update({ grabacion_path: path, transcript }).eq('call_id', callId);
    return json({ error: 'La llamada casi no tiene voz: no hay material para una minuta', transcript }, 422);
  }

  // 3) Contexto del contacto para que la minuta hable con nombres.
  let quien = ll.telefono;
  if (ll.conversation_id) {
    const { data: conv } = await supabase.from('wa_conversaciones')
      .select('contact_id, company_id, contacts(nombre, apellido), companies(nombre_comercial, nombre)')
      .eq('id', ll.conversation_id).maybeSingle();
    const c: any = conv?.contacts, e: any = conv?.companies;
    if (c?.nombre) quien = `${c.nombre} ${c.apellido || ''}`.trim() + (e ? ` (${e.nombre_comercial || e.nombre})` : '');
  }
  const dur = ll.duracion_seg ? `${Math.floor(ll.duracion_seg / 60)} min ${ll.duracion_seg % 60} s` : 'desconocida';

  // 4) Claude redacta la minuta.
  const prompt = `Eres el asistente del CRM de Sacscloud (software de punto de venta para comercios en México). Esta es la transcripción de una llamada de WhatsApp ${ll.direccion === 'saliente' ? 'que el equipo le hizo a' : 'que recibió el equipo de'} ${quien}. Duración: ${dur}. La transcripción mezcla ambas voces sin etiquetar quién habla; dedúcelo por contexto y no inventes nada que no esté dicho.

TRANSCRIPCIÓN:
${transcript.slice(0, 24000)}

Responde SOLO un JSON válido con esta forma exacta:
{"minuta": "la minuta detallada en markdown: ## Resumen (2-3 frases), ## Temas tratados (viñetas con lo que se habló, con cifras y nombres literales), ## Acuerdos (viñetas; si no hubo, dilo), ## Pendientes (viñetas de quién debe qué)", "siguiente_paso": "UNA frase imperativa con el siguiente paso más importante para el equipo (o cadena vacía si no hay)"}`;
  let minuta = '', siguiente = '';
  try {
    const r = await anthropic.messages.create({
      model: MODELS.sonnet, max_tokens: 1600,
      messages: [{ role: 'user', content: prompt }],
    });
    const texto = (r.content[0] as any)?.text || '';
    const m = texto.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : null;
    minuta = String(parsed?.minuta || '').trim();
    siguiente = String(parsed?.siguiente_paso || '').trim();
  } catch (e: any) {
    // La transcripción ya es valiosa: se guarda aunque la minuta falle.
    await supabase.from('wa_llamadas').update({ grabacion_path: path, transcript }).eq('call_id', callId);
    return json({ error: `La transcripción quedó guardada pero la minuta falló: ${String(e?.message || e)}` }, 502);
  }
  if (!minuta) minuta = `## Resumen\n${transcript.slice(0, 600)}…`;

  await supabase.from('wa_llamadas').update({
    grabacion_path: path, transcript, minuta, siguiente_paso: siguiente || null, minuta_at: new Date().toISOString(),
  }).eq('call_id', callId);

  // 5) Actividad del contacto (ficha 360) + siguiente paso sugerido en el CRM.
  if (ll.conversation_id) {
    const { data: conv } = await supabase.from('wa_conversaciones').select('contact_id, company_id').eq('id', ll.conversation_id).maybeSingle();
    if (conv?.contact_id) {
      await supabase.from('activities').insert({
        contact_id: conv.contact_id, company_id: conv.company_id || null, tipo: 'llamada',
        titulo: `Llamada de WhatsApp (${dur}) con minuta`,
        descripcion: minuta.slice(0, 4000), automatico: true,
      }).select('id').maybeSingle().then(() => {}, () => {});
      if (siguiente) await supabase.from('contacts').update({ proximo_paso: siguiente.slice(0, 300) }).eq('id', conv.contact_id).then(() => {}, () => {});
    }
  }
  return json({ ok: true, minuta, siguiente_paso: siguiente, transcript_len: transcript.length });
};
