// OUTBOUND · "Redactar con IA": borrador de título/mensaje/botones para una
// campaña. Clona el patrón de agents/draft-from-transcript.ts: corrida
// auditada en agent_runs con costo, y BORRADOR SIEMPRE — la IA nunca activa
// nada; el resultado cae en el editor y pasa por la misma Revisión.
//
// POST { objetivo, formato, modulo?, publico? } → { opciones: [...], cost_usd }
import type { APIRoute } from 'astro';
import { anthropic, MODELS, calculateCost, hasApiKey } from '../../../../lib/ai/client';
import { createAgentRun, finishAgentRun } from '../../../../lib/ai/audit';
import { getSessionFromRequest } from '../../../../lib/auth/session';
import { DESTINOS_MODULO, FORMATOS } from '../../../../lib/outbound/catalogo';

export const prerender = false;

const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const SYSTEM = `Eres el redactor del canal de mensajes in-app de SacsCloud (ERP para
comercios en México). Escribes para dueños de negocio poco técnicos: directo,
concreto, en español de México, sin tecnicismos ni anglicismos.

REGLAS DURAS (romperlas invalida la respuesta):
- CERO emojis y cero signos decorativos. Tipografía limpia.
- Título: máximo 60 caracteres. Habla del beneficio, no del feature.
- Mensaje: máximo 200 caracteres, una sola idea, sin promesas que el producto no cumpla.
- Botones: máximo 2. El primero es la acción principal. "accion" SOLO puede ser
  "modulo" (con "destino" EXACTO de la lista de módulos permitidos), "chat",
  "whatsapp_ventas" o "cerrar". NUNCA inventes un destino ni uses URLs.
- Si el formato es "encuesta" o "chat", botones = [].
- Nunca inventes precios, montos ni nombres de planes que no te den.

Responde ÚNICAMENTE un JSON válido, sin markdown:
{"opciones":[{"titulo":"...","mensaje":"...","botones":[{"texto":"...","accion":"...","destino":"..."}]}]}
con exactamente 2 opciones de tono distinto (una directa, una más cálida).`;

export const POST: APIRoute = async ({ request }) => {
  if (!hasApiKey()) return json({ error: 'Falta ANTHROPIC_API_KEY en el entorno' }, 503);
  let body: any; try { body = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }
  const objetivo = String(body.objetivo || '').trim().slice(0, 300);
  const formato = String(body.formato || 'modal');
  if (!objetivo) return json({ error: 'Cuéntame el objetivo de la campaña (campo objetivo)' }, 400);
  if (!FORMATOS.some(f => f.id === formato)) return json({ error: 'Formato desconocido' }, 400);

  let ownerId: string | null = null;
  try { const u = await getSessionFromRequest(request); ownerId = (u as any)?.id || null; } catch { /* audit sin dueño */ }

  const run_id = await createAgentRun({
    agent_name: 'outbound-drafter',
    trigger_type: 'user',
    owner_id: ownerId,
    input: { objetivo, formato, modulo: body.modulo || null, publico: body.publico || null },
    model: MODELS.sonnet,
  } as any);

  const t0 = Date.now();
  try {
    const destinos = DESTINOS_MODULO.map(d => `${d.id} (${d.etiqueta})`).join(', ');
    const user = [
      `Objetivo de la campaña: ${objetivo}`,
      `Formato: ${formato}`,
      body.modulo ? `Módulo/plugin del que se habla: ${body.modulo}` : '',
      body.publico ? `Público: ${body.publico}` : '',
      `Destinos de módulo permitidos: ${destinos}`,
    ].filter(Boolean).join('\n');

    const msg = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 900,
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    });

    const texto = (msg.content || []).map((b: any) => b.type === 'text' ? b.text : '').join('').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(texto.replace(/^```json?\s*/i, '').replace(/```\s*$/, ''));
    } catch {
      await finishAgentRun({ run_id, status: 'failed', error: 'JSON inválido del modelo', latency_ms: Date.now() - t0 } as any);
      return json({ error: 'La IA no devolvió un borrador válido — intenta de nuevo' }, 502);
    }
    const opciones = (Array.isArray(parsed?.opciones) ? parsed.opciones : []).slice(0, 3).map((o: any) => ({
      titulo: String(o.titulo || '').slice(0, 80),
      mensaje: String(o.mensaje || '').slice(0, 240),
      botones: (Array.isArray(o.botones) ? o.botones : []).slice(0, 2)
        .filter((b: any) => ['modulo', 'chat', 'whatsapp_ventas', 'cerrar'].includes(b.accion))
        .filter((b: any) => b.accion !== 'modulo' || DESTINOS_MODULO.some(d => d.id === b.destino))
        .map((b: any) => ({ texto: String(b.texto || '').slice(0, 40), accion: b.accion, destino: b.destino || '' })),
    })).filter((o: any) => o.titulo);
    if (!opciones.length) {
      await finishAgentRun({ run_id, status: 'failed', error: 'Sin opciones utilizables', latency_ms: Date.now() - t0 } as any);
      return json({ error: 'La IA no devolvió opciones utilizables — intenta de nuevo' }, 502);
    }

    const usage = calculateCost(MODELS.sonnet, msg.usage as any);
    await finishAgentRun({ run_id, status: 'completed', output: { opciones }, usage, latency_ms: Date.now() - t0 } as any);
    return json({ opciones, cost_usd: usage.cost_usd, run_id });
  } catch (e: any) {
    await finishAgentRun({ run_id, status: 'failed', error: e?.message || String(e), latency_ms: Date.now() - t0 } as any);
    return json({ error: 'No se pudo redactar: ' + (e?.message || 'error del modelo') }, 502);
  }
};
