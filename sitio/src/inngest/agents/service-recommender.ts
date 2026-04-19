// service_recommender agent — analiza una quote existente y sugiere servicios con reasoning.
// Diferencia con el inline /api/catalog/recommend-services:
//   - inline: retorna defaults deterministas del VERTICAL_SERVICE_DEFAULTS
//   - agent: razona sobre items actuales + historial del contact + objeciones para priorizar

import { inngest } from '../client';
import { anthropic, MODELS, calculateCost } from '../../lib/ai/client';
import { createAgentRun, finishAgentRun } from '../../lib/ai/audit';
import { executeTool } from '../../lib/agent-tools/middleware';
import { supabase } from '../../lib/supabase';
import { SERVICES, computeServicePrice } from '../../data/catalog';
import '../../lib/agent-tools';

const SYSTEM_PROMPT = `Eres un ejecutivo de ventas senior de SACS. Analiza una cotización existente y sugiere servicios ADICIONALES que el cliente probablemente necesita.

CONTEXTO:
- El cliente ya tiene una cotización con ciertos items (plan + posibles servicios).
- Tu trabajo es detectar qué FALTA para que la implementación sea exitosa.
- Solo sugieres servicios que NO estén ya en la quote.
- Si la quote ya está completa, NO sugieres nada.

REGLAS:
1. Priorizas por probabilidad de cierre (servicios que no elevan mucho el precio).
2. Si el cliente objetó precio en el timeline → sugiere servicios de bajo costo o que tengan alto ROI percibido.
3. Si mencionó migrar desde otro sistema → migracion_datos es must-have.
4. Si tiene >3 sucursales y plan no es automatiza → sugiere upgrade (no servicio extra).
5. Devuelve MAX 3 sugerencias (calidad sobre cantidad).

OUTPUT: SOLO JSON:
{
  "suggestions": [
    {
      "service_id": "id del catálogo",
      "priority": "high|medium|low",
      "reason": "1 sentence why",
      "impact": "1 sentence de qué gana el cliente"
    }
  ],
  "quote_status": "complete|missing_critical|upsell_opportunity",
  "overall_recommendation": "1 line summary"
}`;

export const serviceRecommenderAgent = inngest.createFunction(
  {
    id: 'service-recommender',
    name: 'Service Recommender Agent',
    triggers: [{ event: 'agent/service-recommender.requested' }],
  },
  async ({ event, step }) => {
    const { quote_id, owner_id } = event.data;
    const t0 = Date.now();

    const run_id = await step.run('create-audit-run', async () =>
      createAgentRun({
        agent_name: 'service_recommender',
        trigger_type: 'event',
        trigger_ref: event.id,
        owner_id: owner_id || null,
        input: { quote_id },
        model: MODELS.haiku, // simple enough for Haiku
      }),
    );

    // Fetch quote + contact
    const quote = await step.run('fetch-quote', async () => {
      const { data } = await supabase
        .from('quotes')
        .select('id, empresa, contacto, items, total, contact_id, deal_id, estado')
        .eq('id', quote_id)
        .single();
      return data;
    });

    if (!quote) {
      await finishAgentRun({
        run_id,
        status: 'failed',
        error: { message: 'quote not found' },
        latency_ms: Date.now() - t0,
      });
      throw new Error('quote not found');
    }

    const ctx = { run_id, agent_name: 'service_recommender', owner_id };
    const contactData = quote.contact_id
      ? await step.run('fetch-contact', async () => executeTool('crm.get_contact', { id: quote.contact_id }, ctx))
      : null;

    const timeline = quote.contact_id
      ? await step.run('fetch-timeline', async () => executeTool('crm.get_contact_timeline', { contact_id: quote.contact_id, limit: 10 }, ctx))
      : { ok: false, data: [] };

    // Extract current items
    const currentServiceIds = (quote.items || [])
      .filter((i: any) => i.tipo === 'extra')
      .map((i: any) => {
        const svc = SERVICES.find(s => s.nombre === i.nombre);
        return svc?.id;
      })
      .filter(Boolean);

    // LLM call
    const llmResult = await step.run('claude-recommend', async () => {
      const vertical = (contactData?.data as any)?.giro || 'otro';
      const userContent = [
        `Quote actual:`,
        JSON.stringify({
          empresa: quote.empresa,
          total: quote.total,
          items: quote.items,
        }),
        '',
        `Contacto: ${JSON.stringify(contactData?.data || { vertical })}`,
        '',
        `Servicios en la quote ya (NO sugerir de nuevo): ${currentServiceIds.join(', ') || 'ninguno'}`,
        '',
        `Actividad reciente: ${JSON.stringify((timeline as any).data || [])}`,
        '',
        `Servicios disponibles: ${JSON.stringify(SERVICES)}`,
        '',
        'Genera el JSON de sugerencias según las reglas.',
      ].join('\n');

      const resp = await anthropic.messages.create({
        model: MODELS.haiku,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });
      const text = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
      return { text, usage: resp.usage };
    });

    // Parse JSON
    let recommendations: any;
    try {
      const jsonText = llmResult.text.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
      recommendations = JSON.parse(jsonText);
    } catch (err) {
      await finishAgentRun({
        run_id,
        status: 'failed',
        error: { step: 'parse', message: String(err), raw: llmResult.text.slice(0, 300) },
        latency_ms: Date.now() - t0,
      });
      throw err;
    }

    // Validate + compute prices
    const vertical = (contactData?.data as any)?.giro || 'otro';
    const sucursales = ((contactData?.data as any)?.sucursales_interes) || 1;
    const validSuggestions = (recommendations.suggestions || [])
      .filter((s: any) => SERVICES.find(svc => svc.id === s.service_id))
      .slice(0, 3)
      .map((s: any) => {
        const svc = SERVICES.find(x => x.id === s.service_id)!;
        return {
          ...s,
          nombre: svc.nombre,
          precio: computeServicePrice(svc, vertical, sucursales),
          descripcion: svc.descripcion,
        };
      });

    // Finalize
    await step.run('finalize', async () => {
      const usage = calculateCost(MODELS.haiku, {
        input_tokens: llmResult.usage.input_tokens || 0,
        output_tokens: llmResult.usage.output_tokens || 0,
        cache_read_input_tokens: (llmResult.usage as any).cache_read_input_tokens,
        cache_creation_input_tokens: (llmResult.usage as any).cache_creation_input_tokens,
      });
      await finishAgentRun({
        run_id,
        status: 'completed',
        output: {
          quote_id: quote.id,
          suggestions: validSuggestions,
          quote_status: recommendations.quote_status || 'unknown',
          overall_recommendation: recommendations.overall_recommendation || '',
        },
        reasoning: `Vertical: ${vertical}. Quote tiene ${currentServiceIds.length} servicios. Sugerencias: ${validSuggestions.length}.`,
        usage,
        latency_ms: Date.now() - t0,
      });
    });

    return {
      run_id,
      suggestions: validSuggestions,
      quote_status: recommendations.quote_status,
    };
  },
);
