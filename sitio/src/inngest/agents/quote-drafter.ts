// quote_drafter agent — genera cotización draft desde una transcripción de demo.
//
// Flujo:
// 1. Recibe transcript + contact_id (opcional deal_id)
// 2. Fetch contact timeline + historial de cotizaciones similar vertical
// 3. Llama Claude Sonnet con tool-use: catalog.get_plans, catalog.get_services,
//    catalog.recommend_services para que NO invente precios
// 4. Claude propone: plan, sucursales, servicios únicos, descuento global
// 5. Valida precios contra catálogo (hard guard — never trust LLM pricing)
// 6. Inserta quote en DB con estado 'draft' y agent_run status 'awaiting_approval'
// 7. Rep/partner revisa en /app/inbox, puede editar inline, luego approve

import { inngest } from '../client';
import { anthropic, MODELS, calculateCost } from '../../lib/ai/client';
import { createAgentRun, finishAgentRun } from '../../lib/ai/audit';
import { executeTool } from '../../lib/agent-tools/middleware';
import { supabase } from '../../lib/supabase';
import { PLANS, SERVICES, getPlan, getService, computeServicePrice } from '../../data/catalog';
import { redactPII, wrapUntrusted } from '../../lib/ai/redact';
import '../../lib/agent-tools';

const SYSTEM_PROMPT = `Eres un ejecutivo de ventas senior de SACS. Tu trabajo es analizar una transcripción de demo con un cliente potencial y producir un DRAFT de cotización estructurado.

REGLAS CRÍTICAS:
1. NUNCA inventes precios. Solo usa valores que obtengas de las tools catalog.get_plans, catalog.get_services, catalog.recommend_services.
2. Determina el VERTICAL del cliente (moda/farmacia/restaurantes/ferreteria/abarrotes/electronica/belleza/mayoreo/otro).
3. Determina NÚMERO DE SUCURSALES que el cliente necesita operar.
4. Recomienda un PLAN (controla/fideliza/automatiza) basado en sus necesidades declaradas.
5. Recomienda SERVICIOS ÚNICOS (implementación/migración/capacitación/setup_tienda_online/integracion_erp) basado en el vertical + complejidad.
6. Si el cliente mencionó urgencia/timeline, incluye nota en el draft.
7. Si el cliente objetó el precio, sugiere descuento_pct razonable (10-20%).
8. Estima la probabilidad de cierre (0-100%) basado en tono + señales.

OUTPUT: JSON estructurado con:
{
  "plan_id": "controla|fideliza|automatiza",
  "periodo": "mensual|anual",
  "sucursales": number,
  "servicios_unicos": ["implementacion_basica", ...],
  "servicios_recurrentes": ["consultor_dedicado_mes", ...],
  "descuento_pct_sugerido": number,
  "probabilidad_cierre": number,
  "vertical_detectado": "moda|farmacia|...",
  "resumen_reunion": "3 bullets de lo más importante",
  "objeciones_detectadas": ["objetion1", ...],
  "siguientes_pasos": "1 acción concreta",
  "tono_voz_partner": "string — el tono con que debe escribirse la cotización"
}

Responde SOLO con el JSON, sin markdown ni texto extra.`;

// Price validation — lookup from catalog, never from LLM
function buildQuoteItems(draft: any, vertical: string): any[] {
  const items: any[] = [];
  const sucursales = draft.sucursales || 1;

  // Plan principal
  const plan = getPlan(draft.plan_id);
  if (plan) {
    const isAnual = draft.periodo === 'anual';
    const precio_unitario = isAnual ? plan.precio_anual : plan.precio_mensual;
    const subtotal = precio_unitario * sucursales * (isAnual ? 1 : 1);
    items.push({
      tipo: 'plan',
      nombre: plan.id,
      sucursales,
      precio_unitario,
      periodo: draft.periodo || 'mensual',
      descuento_pct: draft.descuento_pct_sugerido || 0,
      subtotal: subtotal * (1 - (draft.descuento_pct_sugerido || 0) / 100),
    });
  }

  // Servicios únicos
  for (const service_id of draft.servicios_unicos || []) {
    const service = getService(service_id);
    if (service) {
      const precio = computeServicePrice(service, vertical, sucursales);
      items.push({
        tipo: 'extra',
        nombre: service.nombre,
        monto: precio,
        subtotal: precio,
        recurrente: false,
        periodo_extra: 'unico',
        descripcion: service.descripcion,
      });
    }
  }

  // Servicios recurrentes
  for (const service_id of draft.servicios_recurrentes || []) {
    const service = getService(service_id);
    if (service) {
      const precio = service.precio_base;
      items.push({
        tipo: 'extra',
        nombre: service.nombre,
        monto: precio,
        subtotal: precio,
        recurrente: true,
        periodo_extra: service.periodo_extra || 'mensual',
        descripcion: service.descripcion,
      });
    }
  }

  return items;
}

export const quoteDrafterAgent = inngest.createFunction(
  { id: 'quote-drafter', name: 'Quote Drafter Agent', triggers: [{ event: 'agent/quote-drafter.requested' }] },
  async ({ event, step }) => {
    const { transcript, contact_id, company_id, owner_id, deal_id } = event.data;
    const t0 = Date.now();

    // Redact PII from transcript before logging/sending to LLM
    const { text: safeTranscript, piiFields } = redactPII(transcript || '');

    const run_id = await step.run('create-audit-run', async () =>
      createAgentRun({
        agent_name: 'quote_drafter',
        trigger_type: 'event',
        trigger_ref: event.id,
        owner_id: owner_id || null,
        contact_id: contact_id || null,
        company_id: company_id || null,
        deal_id: deal_id || null,
        assigned_to: owner_id || null,
        input: {
          transcript_preview: safeTranscript.slice(0, 500),
          contact_id,
          deal_id,
        },
        pii_fields: piiFields,
        model: MODELS.sonnet,
      }),
    );

    const ctx = { run_id, agent_name: 'quote_drafter', owner_id };

    // Fetch context: contact info + catalog
    const contactData = contact_id ? await step.run('fetch-contact', async () => executeTool('crm.get_contact', { id: contact_id }, ctx)) : null;
    const plansData = await step.run('fetch-plans', async () => executeTool('catalog.get_plans', {}, ctx));
    const servicesData = await step.run('fetch-services', async () => executeTool('catalog.get_services', {}, ctx));

    // LLM call with structured output
    const llmResult = await step.run('claude-draft', async () => {
      const userContent = [
        `Transcripción de la demo (PII redactado):`,
        wrapUntrusted(safeTranscript),
        '',
        `Contacto: ${JSON.stringify(contactData?.data || { note: 'no contact info' })}`,
        '',
        `Catálogo de planes disponibles: ${JSON.stringify(plansData.data)}`,
        '',
        `Catálogo de servicios disponibles: ${JSON.stringify(servicesData.data)}`,
        '',
        'Genera el JSON del draft según las reglas.',
      ].join('\n');

      const resp = await anthropic.messages.create({
        model: MODELS.sonnet,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });
      const text = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
      return { text, usage: resp.usage };
    });

    // Parse + validate JSON response
    const draft = await step.run('parse-validate', async () => {
      let parsed: any;
      try {
        const jsonText = llmResult.text.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
        parsed = JSON.parse(jsonText);
      } catch (err) {
        throw new Error(`LLM returned invalid JSON: ${String(err)}`);
      }

      if (!parsed.plan_id || !PLANS.find(p => p.id === parsed.plan_id)) {
        throw new Error(`Invalid plan_id: ${parsed.plan_id}`);
      }
      parsed.sucursales = Math.max(1, parseInt(parsed.sucursales) || 1);
      parsed.vertical_detectado = parsed.vertical_detectado || 'otro';
      parsed.descuento_pct_sugerido = Math.max(0, Math.min(30, parseFloat(parsed.descuento_pct_sugerido) || 0));
      parsed.probabilidad_cierre = Math.max(0, Math.min(100, parseFloat(parsed.probabilidad_cierre) || 50));

      return parsed;
    });

    // Build quote items with validated prices
    const items = buildQuoteItems(draft, draft.vertical_detectado);
    const subtotal = items.reduce((s, i) => s + (i.subtotal || 0), 0);
    const iva = subtotal * 0.16;
    const total = Math.round(subtotal + iva);

    // Create quote draft in DB (estado='draft', requires approval)
    const quotePayload = {
      empresa: (contactData?.data as any)?.empresa || draft.empresa || '',
      contacto: (contactData?.data as any)?.nombre || draft.contacto || '',
      email: (contactData?.data as any)?.email || '',
      whatsapp: (contactData?.data as any)?.whatsapp || '',
      items,
      subtotal: Math.round(subtotal),
      iva_incluido: true,
      iva_monto: Math.round(iva),
      total,
      moneda: 'MXN',
      estado: 'draft',
      template: 'modern',
      contact_id: contact_id || null,
      company_id: company_id || null,
      deal_id: deal_id || null,
      condiciones: 'Precios en MXN. Vigencia 15 días.',
      notas: `Generado por quote_drafter agent — run_id: ${run_id}\nVertical detectado: ${draft.vertical_detectado}\nResumen: ${draft.resumen_reunion}\nObjeciones: ${(draft.objeciones_detectadas || []).join('; ')}\nSiguientes pasos: ${draft.siguientes_pasos}`,
    };

    // Finalize run with draft as output (awaiting_approval — requires human review)
    await step.run('finalize-awaiting', async () => {
      const usage = calculateCost(MODELS.sonnet, {
        input_tokens: llmResult.usage.input_tokens || 0,
        output_tokens: llmResult.usage.output_tokens || 0,
        cache_read_input_tokens: (llmResult.usage as any).cache_read_input_tokens,
        cache_creation_input_tokens: (llmResult.usage as any).cache_creation_input_tokens,
      });

      await finishAgentRun({
        run_id,
        status: 'awaiting_approval',
        output: {
          draft,
          quote_payload: quotePayload,
          preview: {
            plan: draft.plan_id,
            sucursales: draft.sucursales,
            total,
            servicios_unicos: draft.servicios_unicos,
            probabilidad_cierre: draft.probabilidad_cierre,
          },
        },
        reasoning: `Vertical: ${draft.vertical_detectado}. Plan: ${draft.plan_id} ${draft.periodo}. ${draft.sucursales} sucursales. Servicios únicos: ${(draft.servicios_unicos || []).join(', ')}. Descuento sugerido: ${draft.descuento_pct_sugerido}%. Probabilidad cierre: ${draft.probabilidad_cierre}%.`,
        usage,
        latency_ms: Date.now() - t0,
      });
    });

    return {
      run_id,
      status: 'awaiting_approval',
      draft,
      quote_preview: { plan: draft.plan_id, total, servicios_unicos: draft.servicios_unicos },
    };
  },
);
