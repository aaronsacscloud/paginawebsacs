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

/* CONTEXTO: la nota que el consultor lee ANTES de la sesión, dentro de la
   invitación de su calendario. No es el resumen del inbox: ese está escrito
   para el vendedor que ya conoce el hilo. Éste lo lee alguien que llega en
   frío, quince minutos antes, desde el teléfono — y tiene que poder abrir la
   videollamada sabiendo con quién habla y qué le van a pedir.
   Por eso el orden es quién / qué busca / qué se habló / qué quiere ver: la
   pregunta que el consultor se hace primero va primero. */
const SYSTEM_CONTEXTO = `Eres el asistente del CRM de SacsCloud (ERP para comercios
en México). Te dan una conversación con un cliente o lead al que se le acaba de
agendar una sesión consultiva. Escribe el CONTEXTO que el consultor va a leer en
su invitación de calendario, minutos antes de la reunión, sin haber visto el hilo.

Responde ÚNICAMENTE un JSON válido, sin markdown:
{"quien":"1-2 líneas: quién es, su negocio, giro y tamaño si se sabe","busca":"1-2 líneas: el problema o la meta que lo trae","hablado":["lo que ya se le dijo o se acordó"],"quiere_ver":["lo que pidió ver o resolver en la sesión"],"ojo":["algo que el consultor debe cuidar: una objeción, una urgencia, un mal rato"]}
- Español de México, sin emojis, frases cortas. Nada de relleno ni de cortesías.
- "hablado" y "quiere_ver": 2 a 4 puntos cada uno. "ojo": [] si no hay nada.
- Si algo NO está en la conversación, omítelo. Jamás lo inventes ni lo supongas:
  una nota que inventa el giro del cliente hace quedar mal al consultor en vivo.
- Si la conversación es muy corta y casi no hay señal, dilo en "quien" en vez de
  rellenar los demás campos.`;

const SYSTEM_BORRADOR = `Eres un vendedor/CS senior de SacsCloud (ERP para comercios en
México). Te dan la conversación con un cliente o lead y su contexto del CRM.
Escribe la SIGUIENTE respuesta del equipo, en español de México: cálida, directa,
tuteo profesional, sin emojis, sin tecnicismos, máximo ~500 caracteres por opción.
Nunca inventes precios, promesas ni datos que no estén en el contexto.
Si el canal es correo, puede ser un poco más formal y completo.

Responde ÚNICAMENTE un JSON válido, sin markdown:
{"opciones":["respuesta directa","respuesta más cálida"]}  (exactamente 2)`;

/* El SDK de Anthropic mete el JSON completo del error en `message`, y eso se
   estaba pintando TAL CUAL en el inbox: el vendedor veía un volcado con
   `request_id` incluido en vez de saber qué hacer. Se traduce lo que sí tiene
   una acción detrás y lo demás se recorta — el detalle completo ya queda en
   `agent_runs`, que es donde se diagnostica. */
function errorHumano(e: any): string {
  const m = String(e?.message || e || '');
  if (/credit balance is too low|billing|sin saldo/i.test(m)) return 'La IA no tiene saldo: hay que recargar la cuenta de Anthropic. Mientras, escribe la nota a mano.';
  if (/rate.?limit|429/i.test(m)) return 'La IA está saturada en este momento — vuelve a intentar en un minuto.';
  if (/overloaded|529/i.test(m)) return 'El modelo está sobrecargado — vuelve a intentar en un minuto.';
  if (/timeout|ETIMEDOUT|ECONNRESET/i.test(m)) return 'La IA tardó de más — vuelve a intentar.';
  return 'La IA falló: ' + (m.slice(0, 120) || 'error del modelo');
}

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
      const msg = await anthropic.messages.create({ proposito: 'pages/api/crm/whatsapp/ia.ts:89',
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
      return json({ error: errorHumano(e) }, 502);
    }
  }

  const accion: 'borrador' | 'contexto' | 'resumir' =
    b.accion === 'borrador' ? 'borrador' : b.accion === 'contexto' ? 'contexto' : 'resumir';

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
    agent_name: accion === 'resumir' ? 'wa-inbox-resumen' : accion === 'contexto' ? 'wa-inbox-contexto' : 'wa-inbox-borrador',
    trigger_type: 'user',
    owner_id: ownerId,
    contact_id: contacto?.id || null,
    company_id: empresa?.id || null,
    input: { accion, wa_id: b.wa_id || null, email_id: b.email_id || null, mensajes: lineas.length },
    model: MODELS.sonnet,
  } as any);

  const t0 = Date.now();
  try {
    const msg = await anthropic.messages.create({ proposito: 'pages/api/crm/whatsapp/ia.ts:176',
      model: MODELS.sonnet,
      max_tokens: 900,
      system: accion === 'resumir' ? SYSTEM_RESUMIR : accion === 'contexto' ? SYSTEM_CONTEXTO : SYSTEM_BORRADOR,
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
    /* El texto se arma AQUÍ, no en el front, porque este mismo bloque viaja a
       dos lados: la caja que el humano edita antes de confirmar, y la
       descripción del evento de Google. Si cada lado lo formateara por su
       cuenta, el consultor leería una cosa en el CRM y otra en su calendario.
       Sale en texto plano con guiones: Google Calendar no pinta markdown. */
    if (accion === 'contexto') {
      /* El `!= null` va ANTES del String(): sin él, un null dentro del arreglo
         se vuelve la cadena "null", pasa el filtro de vacíos y el consultor
         lee «- null» en su invitación. Medido con una respuesta de prueba. */
      const lista = (x: any) => (Array.isArray(x) ? x : [])
        .filter((s: any) => s != null).map((s: any) => String(s).trim()).filter(Boolean).slice(0, 5);
      const quien = String(parsed.quien || '').trim();
      const busca = String(parsed.busca || '').trim();
      const hablado = lista(parsed.hablado), quiereVer = lista(parsed.quiere_ver), ojo = lista(parsed.ojo);
      const bloque = (t: string, cuerpo: string) => (cuerpo ? `${t}\n${cuerpo}` : '');
      const nota = [
        bloque('QUIÉN ES', quien),
        bloque('QUÉ BUSCA', busca),
        bloque('LO QUE SE HABLÓ', hablado.map(s => `- ${s}`).join('\n')),
        bloque('QUIERE VER EN LA SESIÓN', quiereVer.map(s => `- ${s}`).join('\n')),
        bloque('OJO', ojo.map(s => `- ${s}`).join('\n')),
      ].filter(Boolean).join('\n\n').slice(0, 4000);
      if (!nota) {
        await finishAgentRun({ run_id, status: 'failed', error: 'Contexto vacío', latency_ms: Date.now() - t0 } as any);
        return json({ error: 'La conversación no da para armar el contexto — escríbelo a mano' }, 502);
      }
      await finishAgentRun({ run_id, status: 'completed', output: { largo: nota.length }, usage, latency_ms: Date.now() - t0 } as any);
      return json({ nota, cost_usd: usage.cost_usd, run_id });
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
    return json({ error: errorHumano(e) }, 502);
  }
};
