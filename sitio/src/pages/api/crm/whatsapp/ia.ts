// WHATSAPP · IA del inbox: resumir la conversación y sugerir respuesta.
// Clona el patrón de outbound/redactar.ts: corrida auditada en agent_runs con
// costo, y BORRADOR SIEMPRE — la IA nunca envía nada; el resultado cae en el
// composer y lo manda un humano.
//
// POST { accion:'resumir'|'borrador', wa_id? | email_id?, canal? } →
//   resumir  → { resumen: [...], pendientes: [...], sentimiento, cost_usd }
//   borrador → { opciones: ["...", "..."], cost_usd }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { anthropic, MODELS, calculateCost, hasApiKey } from '../../../../lib/ai/client';
import { createAgentRun, finishAgentRun } from '../../../../lib/ai/audit';
import { getSessionFromRequest } from '../../../../lib/auth/session';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const SYSTEM_RESUMIR = `Eres el asistente del inbox de SacsCloud (ERP para comercios
en México). Te dan una conversación (WhatsApp y/o correo) entre el equipo de SACS
y un cliente o lead. Resume PARA EL VENDEDOR, en español de México, sin emojis.

Responde ÚNICAMENTE un JSON válido, sin markdown:
{"resumen":["punto 1","punto 2","..."],"pendientes":["qué le debemos o qué sigue"],"sentimiento":"positivo|neutral|molesto"}
- resumen: 3 a 5 puntos, concretos (qué pidió, qué se le dijo, montos/fechas si hay).
- pendientes: lo que el equipo debe hacer; [] si no hay nada.
- No inventes nada que no esté en la conversación.`;

const SYSTEM_BORRADOR = `Eres un vendedor/CS senior de SacsCloud (ERP para comercios en
México). Te dan la conversación con un cliente o lead y su contexto del CRM.
Escribe la SIGUIENTE respuesta del equipo, en español de México: cálida, directa,
tuteo profesional, sin emojis, sin tecnicismos, máximo ~500 caracteres por opción.
Nunca inventes precios, promesas ni datos que no estén en el contexto.
Si el canal es correo, puede ser un poco más formal y completo.

Responde ÚNICAMENTE un JSON válido, sin markdown:
{"opciones":["respuesta directa","respuesta más cálida"]}  (exactamente 2)`;

export const POST: APIRoute = async ({ request }) => {
  if (!hasApiKey()) return json({ error: 'Falta ANTHROPIC_API_KEY en el entorno' }, 503);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }

  // ── transformar: edita el TEXTO del composer (tono/traducir/ortografía/simplificar) ──
  if (b.accion === 'transformar') {
    const texto = String(b.texto || '').trim().slice(0, 3000);
    const instr = String(b.instruccion || '').trim().slice(0, 200);
    if (!texto || !instr) return json({ error: 'Faltan texto e instrucción' }, 400);
    let ownerId: string | null = null;
    try { const u = await getSessionFromRequest(request); ownerId = (u as any)?.id || null; } catch { /* sin dueño */ }
    const run_id = await createAgentRun({ agent_name: 'wa-inbox-transformar', trigger_type: 'user', owner_id: ownerId, input: { instr, largo: texto.length }, model: MODELS.sonnet } as any);
    const t0 = Date.now();
    try {
      const msg = await anthropic.messages.create({
        model: MODELS.sonnet, max_tokens: 900,
        system: `Eres editor de mensajes de un equipo comercial de SacsCloud (México). Te dan un mensaje y UNA instrucción de edición. Devuelve ÚNICAMENTE el mensaje editado, sin comillas, sin explicaciones, sin emojis nuevos. Conserva el sentido y los datos (montos, fechas, nombres). Si la instrucción es traducir, traduce fielmente.`,
        messages: [{ role: 'user', content: `Instrucción: ${instr}\n\nMensaje:\n${texto}` }],
      });
      const out = (msg.content || []).map((x: any) => x.type === 'text' ? x.text : '').join('').trim();
      const usage = calculateCost(MODELS.sonnet, msg.usage as any);
      await finishAgentRun({ run_id, status: 'completed', output: { largo: out.length }, usage, latency_ms: Date.now() - t0 } as any);
      return json({ texto: out, cost_usd: usage.cost_usd });
    } catch (e: any) {
      await finishAgentRun({ run_id, status: 'failed', error: e?.message || String(e), latency_ms: Date.now() - t0 } as any);
      return json({ error: 'La IA falló: ' + (e?.message || 'error del modelo') }, 502);
    }
  }

  const accion = b.accion === 'borrador' ? 'borrador' : 'resumir';

  // ── Juntar el contexto: conversación de ambos canales + panel ──
  let conv: any = null;
  let lineas: string[] = [];
  if (b.wa_id) {
    const { data } = await supabase.from('wa_conversaciones')
      .select('*, contacts(id, nombre, apellido, email, lifecycle_stage, tipo), companies(id, nombre, nombre_comercial, plan, mrr)')
      .eq('id', b.wa_id).maybeSingle();
    conv = data;
    if (conv) {
      const { data: msjs } = await supabase.from('wa_mensajes')
        .select('direccion, cuerpo, transcript, tipo, created_at')
        .eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(40);
      for (const m of (msjs || []).reverse()) {
        const quien = m.direccion === 'entrante' ? 'CLIENTE' : 'SACS';
        lineas.push(`[WhatsApp] ${quien}: ${m.transcript ? `(nota de voz) ${m.transcript}` : (m.cuerpo || `[${m.tipo}]`)}`);
      }
      const { data: notas } = await supabase.from('wa_notas')
        .select('autor, texto').eq('conversation_id', conv.id).limit(10);
      for (const n of notas || []) lineas.push(`[Nota interna de ${n.autor}]: ${n.texto}`);
    }
  }
  // Correos del mismo contacto (o el hilo de email si es fila email-only).
  const contactId = conv?.contact_id || null;
  let convsEmail: any[] = [];
  if (b.email_id) {
    const { data } = await supabase.from('email_conversations')
      .select('*, contacts(id, nombre, apellido, email, lifecycle_stage, tipo), companies(id, nombre, nombre_comercial, plan, mrr)')
      .eq('id', b.email_id).maybeSingle();
    if (data) { convsEmail = [data]; conv = conv || data; }
  } else if (contactId) {
    const { data } = await supabase.from('email_conversations').select('*')
      .eq('contact_id', contactId).order('ultimo_mensaje_at', { ascending: false }).limit(2);
    convsEmail = data || [];
  }
  for (const ce of convsEmail) {
    const { data: msjs } = await supabase.from('email_messages')
      .select('direccion, asunto, cuerpo_texto, created_at')
      .eq('conversation_id', ce.id).order('created_at', { ascending: false }).limit(20);
    for (const m of (msjs || []).reverse()) {
      const quien = m.direccion === 'entrante' ? 'CLIENTE' : 'SACS';
      lineas.push(`[Correo · ${m.asunto || 'sin asunto'}] ${quien}: ${(m.cuerpo_texto || '').slice(0, 600)}`);
    }
  }
  if (!conv || !lineas.length) return json({ error: 'No hay conversación que analizar' }, 400);
  lineas = lineas.slice(-60);

  const contacto = conv.contacts;
  const empresa = conv.companies;
  const contexto = [
    contacto ? `Contacto: ${contacto.nombre || ''} ${contacto.apellido || ''} (etapa ${contacto.lifecycle_stage || 'sin etapa'}, tipo ${contacto.tipo || '?'})` : 'Contacto: número desconocido, no está en el CRM',
    empresa ? `Empresa: ${empresa.nombre_comercial || empresa.nombre} · plan ${empresa.plan || '—'} · MRR $${empresa.mrr || 0}` : '',
    accion === 'borrador' ? `Canal de la respuesta: ${b.canal === 'correo' ? 'correo' : 'WhatsApp'}` : '',
  ].filter(Boolean).join('\n');

  let ownerId: string | null = null;
  try { const u = await getSessionFromRequest(request); ownerId = (u as any)?.id || null; } catch { /* audit sin dueño */ }

  const run_id = await createAgentRun({
    agent_name: accion === 'resumir' ? 'wa-inbox-resumen' : 'wa-inbox-borrador',
    trigger_type: 'user',
    owner_id: ownerId,
    contact_id: contacto?.id || null,
    company_id: empresa?.id || null,
    input: { accion, wa_id: b.wa_id || null, email_id: b.email_id || null, mensajes: lineas.length },
    model: MODELS.sonnet,
  } as any);

  const t0 = Date.now();
  try {
    const msg = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 900,
      system: accion === 'resumir' ? SYSTEM_RESUMIR : SYSTEM_BORRADOR,
      messages: [{ role: 'user', content: `${contexto}\n\n── Conversación ──\n${lineas.join('\n')}` }],
    });
    const texto = (msg.content || []).map((x: any) => x.type === 'text' ? x.text : '').join('').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(texto.replace(/^```json?\s*/i, '').replace(/```\s*$/, ''));
    } catch {
      await finishAgentRun({ run_id, status: 'failed', error: 'JSON inválido del modelo', latency_ms: Date.now() - t0 } as any);
      return json({ error: 'La IA no devolvió una respuesta válida — intenta de nuevo' }, 502);
    }
    const usage = calculateCost(MODELS.sonnet, msg.usage as any);

    if (accion === 'resumir') {
      const out = {
        resumen: (Array.isArray(parsed.resumen) ? parsed.resumen : []).slice(0, 6).map(String),
        pendientes: (Array.isArray(parsed.pendientes) ? parsed.pendientes : []).slice(0, 5).map(String),
        sentimiento: ['positivo', 'neutral', 'molesto'].includes(parsed.sentimiento) ? parsed.sentimiento : 'neutral',
      };
      await finishAgentRun({ run_id, status: 'completed', output: out, usage, latency_ms: Date.now() - t0 } as any);
      return json({ ...out, cost_usd: usage.cost_usd, run_id });
    }
    const opciones = (Array.isArray(parsed.opciones) ? parsed.opciones : []).slice(0, 2)
      .map((o: any) => String(o).slice(0, 900)).filter(Boolean);
    if (!opciones.length) {
      await finishAgentRun({ run_id, status: 'failed', error: 'Sin opciones utilizables', latency_ms: Date.now() - t0 } as any);
      return json({ error: 'La IA no devolvió opciones utilizables — intenta de nuevo' }, 502);
    }
    await finishAgentRun({ run_id, status: 'completed', output: { opciones }, usage, latency_ms: Date.now() - t0 } as any);
    return json({ opciones, cost_usd: usage.cost_usd, run_id });
  } catch (e: any) {
    await finishAgentRun({ run_id, status: 'failed', error: e?.message || String(e), latency_ms: Date.now() - t0 } as any);
    return json({ error: 'La IA falló: ' + (e?.message || 'error del modelo') }, 502);
  }
};
