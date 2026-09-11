// WHATSAPP/TELEFONÍA · Pipeline compartido de minuta: Storage → Whisper (Groq)
// → Claude → wa_llamadas + actividad del contacto. Lo usan el endpoint de
// llamadas de WhatsApp (audio del navegador) y el webhook de grabaciones de
// Twilio (audio que descarga el servidor).
import { supabase } from '../supabase';
import { anthropic, MODELS } from '../ai/client';

const BUCKET = 'wa-media';
const GROQ_KEY = ((import.meta as any).env?.GROQ_API_KEY || process.env.GROQ_API_KEY || '').trim();

export type ResultadoMinuta =
  | { ok: true; minuta: string; siguiente_paso: string; transcript_len: number; pdf?: string | null }
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

  // 4) Claude redacta la minuta — las DOS versiones, en una sola pasada.
  let minuta = '', minutaCliente = '', siguiente = '';
  try {
    const r = await redactarMinuta({ transcript, quien, dur, canal: (ll as any).canal, direccion: ll.direccion });
    minuta = r.minuta; minutaCliente = r.minuta_cliente; siguiente = r.siguiente_paso;
  } catch (e: any) {
    await supabase.from('wa_llamadas').update({ grabacion_path: path, transcript }).eq('call_id', callId);
    return { ok: false, error: `La transcripción quedó guardada pero la minuta falló: ${String(e?.message || e)}`, status: 502 };
  }
  if (!minuta) minuta = `## Resumen\n${transcript.slice(0, 600)}…`;

  await supabase.from('wa_llamadas').update({
    grabacion_path: path, transcript, minuta, minuta_cliente: minutaCliente || null,
    siguiente_paso: siguiente || null, minuta_at: new Date().toISOString(),
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
      // Lo que el lead dijo en la llamada (tiendas, giro, marca, correo, ciudad…) también actualiza su ficha.
      try { const { extraerYAplicar } = await import('../crm/ti/datos-lead'); await extraerYAplicar(conv.contact_id, transcript, 'llamada', ll.conversation_id); } catch { /* la minuta ya quedó; los datos no la bloquean */ }
    }
  }
  /* El PDF y su entrega van DESPUÉS de guardar la minuta, y aparte: si el
     documento o el envío fallan, la minuta ya quedó escrita en el CRM y no se
     pierde. Solo aplica a llamadas telefónicas — las de WhatsApp ya viven en
     el chat del cliente. */
  let pdf: string | null = null;
  if ((ll as any).canal === 'telefono') {
    try {
      const { generarYEntregarMinuta } = await import('../minuta/entrega');
      pdf = (await generarYEntregarMinuta(callId)).pdf;
    } catch (e: any) { console.warn('[minuta] el PDF no salió:', e?.message || e); }
  }

  return { ok: true, minuta, siguiente_paso: siguiente, transcript_len: transcript.length, pdf };
}

/**
 * El paso de REDACCIÓN, aparte del de transcripción.
 *
 * Vive suelto porque re-redactar una minuta a partir del texto que ya está
 * guardado es una operación legítima —cambió el prompt, salió mal, hace falta
 * la versión del cliente de una llamada vieja— y no tiene por qué obligar a
 * volver a bajar y transcribir el audio.
 *
 * Devuelve DOS textos: el interno, que es una lectura nuestra y por eso sirve,
 * y el del cliente, escrito sabiendo que él lo va a abrir.
 */
export async function redactarMinuta(o: {
  transcript: string; quien: string; dur: string; canal?: string | null; direccion?: string | null;
}): Promise<{ minuta: string; minuta_cliente: string; siguiente_paso: string }> {
  const canal = o.canal === 'telefono' ? 'una llamada telefónica' : 'una llamada de WhatsApp';
  const prompt = `Eres el asistente del CRM de Sacscloud (software de punto de venta para comercios en México). Esta es la transcripción de ${canal} ${o.direccion === 'saliente' ? 'que el equipo le hizo a' : 'que recibió el equipo de'} ${o.quien}. Duración: ${o.dur}. La transcripción mezcla ambas voces sin etiquetar quién habla; dedúcelo por contexto y no inventes nada que no esté dicho.

TRANSCRIPCIÓN:
${String(o.transcript).slice(0, 24000)}

Responde SOLO un JSON válido con esta forma exacta:
{"minuta": "la minuta detallada en markdown: ## Resumen (2-3 frases), ## Temas tratados (viñetas con lo que se habló, con cifras y nombres literales), ## Acuerdos (viñetas; si no hubo, dilo), ## Pendientes (viñetas de quién debe qué)", "minuta_cliente": "la MISMA reunión, TAN DETALLADA como la minuta interna, pero escrita para que la lea el cliente. Markdown con ## Resumen, ## Temas tratados (viñetas con TODO lo técnico y operativo que se habló: cifras, nombres de módulos, plazos, montos, configuraciones, problemas concretos y cómo se van a resolver), ## Acuerdos, ## Lo que ya está en marcha de nuestro lado (las tareas internas que se dispararon con esta llamada, para que vea que el trabajo ya arrancó) y ## Pendientes (separando lo de cada lado). Dirígete a él de usted. LA ÚNICA PRUEBA para dejar algo fuera es esta: ¿podría él REENVIAR este documento a sus socios, a su dueño o a su jefe sin que le incomode? Si la respuesta es no, eso NO va. Concretamente fuera: lo que opinó de su dueño o de sus socios, los desacuerdos entre ellos, quién se desanimó o no está convencido, juicios sobre su gente, y nuestras propias lecturas de venta (probabilidad de cierre, qué tan caliente está, notas para el vendedor). Ojo: una objeción de precio o una preocupación que ÉL MISMO planteó de frente SÍ va —es parte de lo que se habló y él ya lo sabe—; lo que no va es atribuírsela a un tercero o contar la discusión interna que tuvieron entre ellos. Todo lo demás se queda, con el mismo nivel de detalle. Nada de jerga nuestra ni de etapas del CRM.", "siguiente_paso": "UNA frase imperativa con el siguiente paso más importante para el equipo (o cadena vacía si no hay)"}`;
  /* 6000 y no 2200: ahora se piden DOS minutas completas en el mismo JSON y
     con el tope viejo la respuesta se cortaba a la mitad —el JSON quedaba sin
     cerrar, `minuta_cliente` salía vacía y el envío se cancelaba solo—. Pasó
     tal cual en la primera prueba del criterio nuevo. */
  const r = await anthropic.messages.create({ model: MODELS.sonnet, max_tokens: 6000, messages: [{ role: 'user', content: prompt }] });
  const texto = (r.content[0] as any)?.text || '';
  const m = texto.match(/\{[\s\S]*\}/);
  const parsed = m ? JSON.parse(m[0]) : null;
  return {
    minuta: String(parsed?.minuta || '').trim(),
    minuta_cliente: String(parsed?.minuta_cliente || '').trim(),
    siguiente_paso: String(parsed?.siguiente_paso || '').trim(),
  };
}
