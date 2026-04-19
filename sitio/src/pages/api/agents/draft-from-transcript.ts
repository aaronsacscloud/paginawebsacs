// POST /api/agents/draft-from-transcript
// Dispara quote_drafter agent. En v1 ejecuta INLINE (sin Inngest cloud);
// v2 usará Inngest events cuando esté configurado.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { anthropic, MODELS, calculateCost, hasApiKey } from '../../../lib/ai/client';
import { createAgentRun, finishAgentRun } from '../../../lib/ai/audit';
import { executeTool } from '../../../lib/agent-tools/middleware';
import { PLANS, getPlan, getService, computeServicePrice } from '../../../data/catalog';
import { redactPII, wrapUntrusted } from '../../../lib/ai/redact';
import { getCurrentUser } from '../../../lib/auth/scope';
import '../../../lib/agent-tools';

export const prerender = false;

const SYSTEM_PROMPT = `Eres un ejecutivo de ventas senior de SACS. Analiza la transcripción de demo y produce un DRAFT de cotización.

REGLAS CRÍTICAS:
1. NUNCA inventes precios — solo usa valores del catálogo proporcionado.
2. Detecta VERTICAL (moda/farmacia/restaurantes/ferreteria/abarrotes/electronica/belleza/mayoreo/otro).
3. Detecta SUCURSALES que el cliente operará.
4. Recomienda PLAN (controla/fideliza/automatiza) + servicios únicos apropiados al vertical.
5. Si hubo objeción de precio, sugiere descuento 10-20%.
6. Estima probabilidad de cierre (0-100).

OUTPUT: SOLO JSON (sin markdown), con este schema:
{
  "plan_id": "controla|fideliza|automatiza",
  "periodo": "mensual|anual",
  "sucursales": number,
  "servicios_unicos": [service_ids],
  "servicios_recurrentes": [service_ids],
  "descuento_pct_sugerido": number,
  "probabilidad_cierre": number,
  "vertical_detectado": string,
  "resumen_reunion": string,
  "objeciones_detectadas": [string],
  "siguientes_pasos": string
}`;

function buildQuoteItems(draft: any, vertical: string): any[] {
  const items: any[] = [];
  const sucursales = draft.sucursales || 1;
  const plan = getPlan(draft.plan_id);
  if (plan) {
    const isAnual = draft.periodo === 'anual';
    const precio_unitario = isAnual ? plan.precio_anual : plan.precio_mensual;
    const subtotal_base = precio_unitario * sucursales;
    const descuento = draft.descuento_pct_sugerido || 0;
    items.push({
      tipo: 'plan', nombre: plan.id, sucursales,
      precio_unitario, periodo: draft.periodo || 'mensual',
      descuento_pct: descuento,
      subtotal: Math.round(subtotal_base * (1 - descuento / 100)),
    });
  }
  for (const sid of draft.servicios_unicos || []) {
    const s = getService(sid);
    if (s) {
      const p = computeServicePrice(s, vertical, sucursales);
      items.push({ tipo: 'extra', nombre: s.nombre, monto: p, subtotal: p, recurrente: false, periodo_extra: 'unico', descripcion: s.descripcion });
    }
  }
  for (const sid of draft.servicios_recurrentes || []) {
    const s = getService(sid);
    if (s) {
      items.push({ tipo: 'extra', nombre: s.nombre, monto: s.precio_base, subtotal: s.precio_base, recurrente: true, periodo_extra: s.periodo_extra || 'mensual', descripcion: s.descripcion });
    }
  }
  return items;
}

export const POST: APIRoute = async ({ request }) => {
  if (!hasApiKey()) {
    return new Response(JSON.stringify({
      error: 'ANTHROPIC_API_KEY not configured',
      hint: 'Add in Vercel env and redeploy',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const user = await getCurrentUser(request);
    const body = await request.json();
    const { transcript, contact_id, company_id, deal_id } = body || {};

    if (!transcript || transcript.length < 50) {
      return new Response(JSON.stringify({ error: 'transcript too short (min 50 chars)' }), { status: 400 });
    }

    const t0 = Date.now();
    const owner_id = user?.id || null;
    const { text: safeTranscript, piiFields } = redactPII(transcript);

    // Audit run
    const run_id = await createAgentRun({
      agent_name: 'quote_drafter',
      trigger_type: 'user',
      trigger_ref: 'manual-trigger',
      owner_id,
      contact_id: contact_id || null,
      company_id: company_id || null,
      deal_id: deal_id || null,
      assigned_to: owner_id,
      input: {
        transcript_preview: safeTranscript.slice(0, 500),
        contact_id,
        deal_id,
      },
      pii_fields: piiFields,
      model: MODELS.sonnet,
    });

    const ctx = { run_id, agent_name: 'quote_drafter', owner_id };

    // Fetch context
    const contactTool = contact_id ? await executeTool('crm.get_contact', { id: contact_id }, ctx) : null;
    const plansTool = await executeTool('catalog.get_plans', {}, ctx);
    const servicesTool = await executeTool('catalog.get_services', {}, ctx);

    const contactData = contactTool?.ok ? contactTool.data : null;

    // LLM call
    const userContent = [
      'Transcripción de demo (PII redactado):',
      wrapUntrusted(safeTranscript),
      '',
      `Contacto: ${JSON.stringify(contactData || { note: 'no contact info' })}`,
      '',
      `Planes disponibles: ${JSON.stringify(plansTool.data)}`,
      '',
      `Servicios disponibles: ${JSON.stringify(servicesTool.data)}`,
      '',
      'Responde SOLO con el JSON del draft.',
    ].join('\n');

    let resp;
    try {
      resp = await anthropic.messages.create({
        model: MODELS.sonnet,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });
    } catch (err: any) {
      await finishAgentRun({ run_id, status: 'failed', error: { step: 'llm', message: err?.message || String(err) }, latency_ms: Date.now() - t0 });
      return new Response(JSON.stringify({ error: err?.message || 'LLM call failed' }), { status: 500 });
    }

    const llmText = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');

    // Parse + validate
    let draft: any;
    try {
      const jsonText = llmText.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
      draft = JSON.parse(jsonText);
    } catch (err) {
      await finishAgentRun({ run_id, status: 'failed', error: { step: 'parse', message: `LLM returned invalid JSON: ${String(err)}`, raw: llmText.slice(0, 500) }, latency_ms: Date.now() - t0 });
      return new Response(JSON.stringify({ error: `LLM invalid JSON: ${String(err)}`, raw_preview: llmText.slice(0, 500) }), { status: 500 });
    }

    if (!draft.plan_id || !PLANS.find(p => p.id === draft.plan_id)) {
      await finishAgentRun({ run_id, status: 'failed', error: { step: 'validate', message: `Invalid plan_id: ${draft.plan_id}` }, latency_ms: Date.now() - t0 });
      return new Response(JSON.stringify({ error: `Invalid plan_id returned by LLM: ${draft.plan_id}` }), { status: 500 });
    }

    draft.sucursales = Math.max(1, parseInt(draft.sucursales) || 1);
    draft.vertical_detectado = draft.vertical_detectado || 'otro';
    draft.descuento_pct_sugerido = Math.max(0, Math.min(30, parseFloat(draft.descuento_pct_sugerido) || 0));
    draft.probabilidad_cierre = Math.max(0, Math.min(100, parseFloat(draft.probabilidad_cierre) || 50));

    const items = buildQuoteItems(draft, draft.vertical_detectado);
    const subtotal = items.reduce((s, i) => s + (i.subtotal || 0), 0);
    const iva = subtotal * 0.16;
    const total = Math.round(subtotal + iva);

    const quotePayload = {
      empresa: (contactData as any)?.empresa || '',
      contacto: (contactData as any)?.nombre || '',
      email: (contactData as any)?.email || '',
      whatsapp: (contactData as any)?.whatsapp || '',
      items,
      subtotal: Math.round(subtotal),
      iva_incluido: true,
      iva_monto: Math.round(iva),
      total,
      moneda: 'MXN',
      estado: 'draft',
      template: 'modern',
    };

    const usage = calculateCost(MODELS.sonnet, {
      input_tokens: resp.usage.input_tokens || 0,
      output_tokens: resp.usage.output_tokens || 0,
      cache_read_input_tokens: (resp.usage as any).cache_read_input_tokens,
      cache_creation_input_tokens: (resp.usage as any).cache_creation_input_tokens,
    });

    await finishAgentRun({
      run_id,
      status: 'awaiting_approval',
      output: { draft, quote_payload: quotePayload, preview: { plan: draft.plan_id, total, probabilidad_cierre: draft.probabilidad_cierre } },
      reasoning: `Vertical: ${draft.vertical_detectado}. ${draft.plan_id} ${draft.periodo} ${draft.sucursales} suc. Servicios: ${(draft.servicios_unicos || []).join(', ')}. Descuento: ${draft.descuento_pct_sugerido}%.`,
      usage,
      latency_ms: Date.now() - t0,
    });

    return new Response(JSON.stringify({
      ok: true,
      run_id,
      status: 'awaiting_approval',
      draft,
      quote_payload: quotePayload,
      cost_usd: usage.cost_usd,
      latency_ms: Date.now() - t0,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500 });
  }
};
