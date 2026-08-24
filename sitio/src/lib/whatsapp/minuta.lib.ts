// WHATSAPP/TELEFONÍA · Pipeline compartido de minuta: Storage → Whisper (Groq)
// → Claude → wa_llamadas + actividad del contacto. Lo usan el endpoint de
// llamadas de WhatsApp (audio del navegador) y el webhook de grabaciones de
// Twilio (audio que descarga el servidor).
import { supabase } from '../supabase';
import { anthropic, MODELS } from '../ai/client';

const BUCKET = 'wa-media';
const GROQ_KEY = ((import.meta as any).env?.GROQ_API_KEY || process.env.GROQ_API_KEY || '').trim();

export type ResultadoMinuta =
  | { ok: true; minuta: string; siguiente_paso: string; transcript_len: number }
  | { ok: false; error: string; status: number; transcript?: string };

export async function generarMinutaDesdeAudio(callId: string, buf: ArrayBuffer, mime: string): Promise<ResultadoMinuta> {
  if (!GROQ_KEY) return { ok: false, error: 'Falta GROQ_API_KEY en el entorno', status: 503 };
  const { data: ll } = await supabase.from('wa_llamadas').select('*').eq('call_id', callId).maybeSingle();
  if (!ll) return { ok: false, error: 'Llamada no encontrada', status: 404 };

  // 1) Guardar la grabación (evidencia y re-procesos futuros).
  const ext = /mpeg|mp3/.test(mime) ? 'mp3' : 'webm';
  const path = `llamadas/${callId}.${ext}`;
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
  await supabase.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: true });

  // 2) Whisper (Groq): transcripción en español.
  const wf = new FormData();
  wf.append('file', new File([buf], `llamada.${ext}`, { type: mime }));
  wf.append('model', 'whisper-large-v3-turbo');
  wf.append('language', 'es');
  wf.append('response_format', 'json');
  const wr = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${GROQ_KEY}` }, body: wf,
  });
  const wj = await wr.json().catch(() => ({}));
  if (!wr.ok) return { ok: false, error: `Whisper: ${wj?.error?.message || wr.status}`, status: 502 };
  const transcript = String(wj.text || '').trim();
  if (transcript.length < 30) {
    await supabase.from('wa_llamadas').update({ grabacion_path: path, transcript }).eq('call_id', callId);
    return { ok: false, error: 'La llamada casi no tiene voz: no hay material para una minuta', status: 422, transcript };
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
  const canal = (ll as any).canal === 'telefono' ? 'una llamada telefónica' : 'una llamada de WhatsApp';
  const prompt = `Eres el asistente del CRM de Sacscloud (software de punto de venta para comercios en México). Esta es la transcripción de ${canal} ${ll.direccion === 'saliente' ? 'que el equipo le hizo a' : 'que recibió el equipo de'} ${quien}. Duración: ${dur}. La transcripción mezcla ambas voces sin etiquetar quién habla; dedúcelo por contexto y no inventes nada que no esté dicho.

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
    await supabase.from('wa_llamadas').update({ grabacion_path: path, transcript }).eq('call_id', callId);
    return { ok: false, error: `La transcripción quedó guardada pero la minuta falló: ${String(e?.message || e)}`, status: 502 };
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
        titulo: `${(ll as any).canal === 'telefono' ? 'Llamada telefónica' : 'Llamada de WhatsApp'} (${dur}) con minuta`,
        descripcion: minuta.slice(0, 4000), automatico: true,
      }).select('id').maybeSingle().then(() => {}, () => {});
      if (siguiente) await supabase.from('contacts').update({ proximo_paso: siguiente.slice(0, 300) }).eq('id', conv.contact_id).then(() => {}, () => {});
    }
  }
  return { ok: true, minuta, siguiente_paso: siguiente, transcript_len: transcript.length };
}
