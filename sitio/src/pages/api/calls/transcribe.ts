import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const OPENAI_API_KEY = (import.meta.env.OPENAI_API_KEY || '').trim();

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const audioFile = formData.get('audio') as File;
  const contactId = formData.get('contact_id') as string;
  const dealId = formData.get('deal_id') as string | null;

  if (!audioFile) {
    return new Response(JSON.stringify({ error: 'audio file required' }), { status: 400 });
  }

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OpenAI not configured' }), { status: 503 });
  }

  try {
    // Transcribe with Whisper
    const whisperForm = new FormData();
    whisperForm.append('file', audioFile);
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('language', 'es');
    whisperForm.append('response_format', 'verbose_json');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: whisperForm,
    });

    const transcription = await whisperRes.json();
    const transcriptText = transcription.text || '';
    const duration = transcription.duration || 0;

    // Generate summary with GPT-4
    let summary: any = null;
    if (transcriptText.length > 50) {
      const summaryRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Eres un asistente que genera minutas de reuniones de ventas para SACS (software de punto de venta para retailers en Mexico). Responde en JSON con: { "resumen": "resumen de 2-3 oraciones", "puntos_clave": ["punto 1", "punto 2"], "proximos_pasos": ["paso 1", "paso 2"], "sentimiento": "positivo|neutral|negativo", "plan_interes": "vende|controla|fideliza|automatiza|null", "objeciones": ["objecion 1"] }' },
            { role: 'user', content: `Genera la minuta de esta llamada de ventas:\n\n${transcriptText.substring(0, 8000)}` },
          ],
          temperature: 0.3,
        }),
      });
      const summaryData = await summaryRes.json();
      const content = summaryData.choices?.[0]?.message?.content || '';
      try { summary = JSON.parse(content); } catch { summary = { resumen: content }; }
    }

    // Log activity
    if (contactId) {
      await supabase.from('activities').insert({
        contact_id: contactId,
        deal_id: dealId || null,
        tipo: 'llamada',
        titulo: `Llamada (${Math.round(duration / 60)} min)`,
        descripcion: summary?.resumen || transcriptText.substring(0, 500),
        metadata: {
          duration_seconds: duration,
          transcript: transcriptText,
          summary,
          audio_size: audioFile.size,
        },
        automatico: false,
      });
    }

    return new Response(JSON.stringify({
      transcript: transcriptText,
      duration,
      summary,
    }));
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
