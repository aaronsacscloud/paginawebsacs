// POST /api/agents/trigger — dispara un agente directamente (sin Inngest dev server).
// Útil para testing manual y para uso en dev hasta que Inngest Cloud esté setup.
// Params: { agent: 'hello' | 'meeting_prep' | ..., data: {...} }

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { anthropic, MODELS, calculateCost, hasApiKey } from '../../../lib/ai/client';
import { createAgentRun, finishAgentRun } from '../../../lib/ai/audit';
import { executeTool } from '../../../lib/agent-tools/middleware';
import { inngest } from '../../../inngest/client';
import '../../../lib/agent-tools'; // ensure tools registered

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!hasApiKey()) {
    return new Response(JSON.stringify({
      error: 'ANTHROPIC_API_KEY not configured',
      hint: 'Set env var and redeploy, or export in local .env',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await request.json();
    const { agent, data } = body || {};

    if (!agent) return new Response(JSON.stringify({ error: 'agent name required' }), { status: 400 });

    // meeting_prep: dispara via Inngest event (requiere Inngest configured)
    if (agent === 'meeting_prep') {
      const { ids } = await inngest.send({ name: 'agent/meeting-prep.requested', data });
      return new Response(JSON.stringify({ ok: true, event_ids: ids, note: 'dispatched via Inngest — check /admin/agents for run status' }), { status: 202, headers: { 'Content-Type': 'application/json' } });
    }

    if (agent !== 'hello') {
      return new Response(JSON.stringify({ error: `agent "${agent}" not supported via /trigger. Use 'hello' or 'meeting_prep'.` }), { status: 400 });
    }

    // Run the hello agent inline (duplicates the logic from inngest/agents/hello.ts for direct testing)
    const t0 = Date.now();
    const { contact_id, owner_id, message } = data || {};

    const run_id = await createAgentRun({
      agent_name: 'hello_agent',
      trigger_type: 'user',
      trigger_ref: 'manual-trigger',
      owner_id: owner_id || null,
      contact_id: contact_id || null,
      input: { message: message || 'greet me', contact_id },
      model: MODELS.haiku,
    });

    let contactContext = 'No contact provided.';
    if (contact_id) {
      const tool = await executeTool('crm.get_contact', { id: contact_id }, {
        run_id,
        agent_name: 'hello_agent',
        owner_id,
      });
      if (tool.ok && tool.data) {
        contactContext = `Contact: ${tool.data.nombre || 'unknown'} (${tool.data.email || 'no email'})`;
      } else if (!tool.ok) {
        contactContext = `Contact lookup failed: ${tool.error}`;
      }
    }

    const resp = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 200,
      system: 'Eres un agente demo del CRM SACS. Responde breve, en español, confirmando que el sistema funciona. Menciona el contacto si existe.',
      messages: [{ role: 'user', content: `${message || 'Hola, ¿estás funcionando?'}\n\n${contactContext}` }],
    });

    const text = resp.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');

    const usage = calculateCost(MODELS.haiku, {
      input_tokens: resp.usage.input_tokens || 0,
      output_tokens: resp.usage.output_tokens || 0,
      cache_read_input_tokens: (resp.usage as any).cache_read_input_tokens,
      cache_creation_input_tokens: (resp.usage as any).cache_creation_input_tokens,
    });

    await finishAgentRun({
      run_id,
      status: 'completed',
      output: { response: text },
      reasoning: 'Demo run via /api/agents/trigger',
      usage,
      latency_ms: Date.now() - t0,
    });

    return new Response(JSON.stringify({
      ok: true,
      run_id,
      response: text,
      cost_usd: usage.cost_usd,
      latency_ms: Date.now() - t0,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
