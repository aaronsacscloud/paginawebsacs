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
  /* ── CÓMO SE ESCRIBE UNA MINUTA QUE SIRVE DENTRO DE TRES MESES ───────────
     La primera versión tiraba todo en un solo «## Temas tratados»: una lista
     larga de viñetas sueltas donde el ejemplo de la tienda de moda, el problema
     de las etiquetas y la estrategia de las 15 sucursales quedaban al mismo
     nivel y sin decir POR QUÉ salió cada cosa. Se leía y no se recordaba.
     Ahora las secciones las decide el CONTENIDO: una por tema real, con título
     que dice el asunto y un arranque que da el contexto. Lo demás son reglas
     de oficio —decisiones separadas de propuestas, pendientes con dueño, lo que
     quedó abierto, sin relleno— que es lo que separa una minuta de un resumen. */
  const REGLAS = `CÓMO ESCRIBIRLA (aplica a las DOS versiones):

1. SECCIONES POR TEMA, no una lista gigante. Cada asunto real de la llamada lleva su propio "## ". Entre más temas distintos se tocaron, más secciones. Si se habló de cinco cosas, son cinco secciones — no una con veinte viñetas.
2. EL TÍTULO DICE EL ASUNTO. "## El problema de las etiquetas borrosas", no "## Tema 2". Quien busca algo meses después escanea títulos.
3. CADA SECCIÓN ABRE CON SU CONTEXTO: una o dos frases que digan por qué salió el tema y cuál era la situación, ANTES del detalle. Sin eso el punto no se entiende ni se recuerda.
4. LOS EJEMPLOS Y CASOS DE USO VAN EN SU PROPIA SECCIÓN, contados completos. Si se puso el ejemplo de otro negocio para explicar algo, esa sección lleva el ejemplo entero: qué negocio, qué hacía antes, qué cambió, con las cifras que se dijeron. Un ejemplo a medias no convence a nadie que lo lea después.
5. CIFRAS Y NOMBRES LITERALES, nunca "algunos" ni "varios": los montos, los plazos, los nombres de módulos, cuántas tiendas, cuántos días.
6. DECIDIDO ≠ PROPUESTO. Lo que quedó acordado va en "## Acuerdos"; lo que solo se mencionó como posibilidad se queda en su tema y se dice que está por definir. Confundirlos es como se generan malentendidos.
7. CADA PENDIENTE CON DUEÑO Y FECHA. Quién lo hace y para cuándo. Si no se dijo fecha, escribe "sin fecha definida" — en blanco parece que se olvidó.
8. LO QUE QUEDÓ ABIERTO tiene su propia sección si lo hubo. Las dudas sin resolver son lo que muerde después, y son justo lo que las minutas esconden.
9. TRADUCE LA JERGA la primera vez que aparezca, entre paréntesis y en corto (una herramienta, un módulo, una sigla). Quien reenvíe el documento puede no conocerla.
10. ORDEN POR IMPORTANCIA, no por el minuto en que se dijo. La minuta se consulta, no se revive.
11. SIN RELLENO. Nada de "se trataron diversos temas". Si de algo no se habló, esa sección no existe.
12. CIERRA CON EL SIGUIENTE HITO: cuándo vuelve a haber contacto y para qué.`;

  const prompt = `Eres quien levanta la minuta en el CRM de Sacscloud (software de punto de venta para comercios en México). Esta es la transcripción de ${canal} ${o.direccion === 'saliente' ? 'que el equipo le hizo a' : 'que recibió el equipo de'} ${o.quien}. Duración: ${o.dur}. La transcripción mezcla ambas voces sin etiquetar quién habla; dedúcelo por contexto y NO inventes nada que no esté dicho.

${REGLAS}

LAS DOS VERSIONES

· "minuta" (INTERNA, la lee el equipo): todo lo anterior más la lectura nuestra —cómo viene la cuenta, qué frenó la venta, quién no está convencido, qué conviene hacer—. Es la que sirve para vender; aquí se dice todo.

· "minuta_cliente" (LA LEE EL CLIENTE): MISMA estructura y MISMO nivel de detalle, con las mismas secciones por tema y sus contextos. Dirígete a él de usted. Agrega una sección "## Lo que ya está en marcha de nuestro lado" con las tareas internas que disparó la llamada, para que vea que el trabajo arrancó.
  LA ÚNICA PRUEBA para dejar algo fuera: ¿podría él REENVIAR este documento a sus socios, a su dueño o a su jefe sin que le incomode? Si no, fuera. En concreto: lo que opinó de su dueño o de sus socios, los desacuerdos entre ellos, quién se desanimó o no está convencido, juicios sobre su gente, y nuestras lecturas de venta.
  Matiz: una objeción o preocupación que ÉL MISMO planteó de frente SÍ va —ya la sabe, es parte de lo que se habló—; lo que no va es atribuírsela a un tercero ni contar la discusión que tuvieron entre ellos.
  Todo lo demás se queda, con el mismo detalle.

TRANSCRIPCIÓN:
${String(o.transcript).slice(0, 24000)}

Responde SOLO un JSON válido, sin texto alrededor, con esta forma exacta:
{"minuta": "markdown", "minuta_cliente": "markdown", "siguiente_paso": "UNA frase imperativa con el siguiente paso más importante para el equipo (o cadena vacía si no hay)"}`;
  /* El tope ha subido dos veces por la misma razón, así que queda anotada: se
     piden DOS minutas completas en un solo JSON, y ahora además seccionadas por
     tema. Corto, la respuesta se parte a la mitad, el JSON queda sin cerrar y
     `minuta_cliente` sale vacía — con lo que el envío se cancela solo. Pasó con
     2200 y volvió a pasar con 6000. 12000 deja margen para una llamada larga
     con muchos temas; una corta no gasta más por tenerlo alto. */
  const r = await anthropic.messages.create({ model: MODELS.sonnet, max_tokens: 12000, messages: [{ role: 'user', content: prompt }] });
  const texto = (r.content[0] as any)?.text || '';
  const m = texto.match(/\{[\s\S]*\}/);
  const parsed = m ? JSON.parse(m[0]) : null;
  return {
    minuta: String(parsed?.minuta || '').trim(),
    minuta_cliente: String(parsed?.minuta_cliente || '').trim(),
    siguiente_paso: String(parsed?.siguiente_paso || '').trim(),
  };
}
