// Hello agent — demuestra el framework end-to-end con audit trail completo.
// Hace una llamada Claude simple con un tool real (crm.get_contact si se pasa contact_id).

import { inngest } from '../client';
import { anthropic, MODELS, calculateCost } from '../../lib/ai/client';
import { createAgentRun, finishAgentRun } from '../../lib/ai/audit';
import { executeTool } from '../../lib/agent-tools/middleware';
import '../../lib/agent-tools'; // register tools

export const helloAgent = inngest.createFunction(
  { id: 'hello-agent', name: 'Hello Agent (demo)', triggers: [{ event: 'agent/hello.requested' }] },
  async ({ event, step }) => {
    const { contact_id, owner_id, message } = event.data;
    const t0 = Date.now();

    // Step 1: create audit run
    const run_id = await step.run('create-audit-run', async () => {
      return await createAgentRun({
        agent_name: 'hello_agent',
        trigger_type: 'event',
        trigger_ref: event.id,
        owner_id: owner_id || null,
        contact_id: contact_id || null,
        input: { message: message || 'greet me', contact_id },
        model: MODELS.haiku,
      });
    });

    // Step 2: if contact_id given, fetch it via tool
    let contactContext = 'No contact provided.';
    if (contact_id) {
      const toolResult = await step.run('fetch-contact', async () => {
        return await executeTool('crm.get_contact', { id: contact_id }, {
          run_id,
          agent_name: 'hello_agent',
          owner_id,
        });
      });
      if (toolResult.ok && toolResult.data) {
        contactContext = `Contact: ${toolResult.data.nombre || 'unknown'} (${toolResult.data.email || 'no email'})`;
      }
    }

    // Step 3: call Claude
    const claudeResponse = await step.run('claude-call', async () => {
      const resp = await anthropic.messages.create({
        model: MODELS.haiku,
        max_tokens: 200,
        system: 'Eres un agente demo del CRM SACS. Responde breve, en español, confirmando que el sistema funciona. Menciona el contacto si existe.',
        messages: [
          { role: 'user', content: `${message || 'Hola, ¿estás funcionando?'}\n\n${contactContext}` },
        ],
      });
      const text = resp.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n');
      return { text, usage: resp.usage, stop_reason: resp.stop_reason };
    });

    // Step 4: finalize audit with cost + output
    await step.run('finalize-audit', async () => {
      const usage = calculateCost(MODELS.haiku, {
        input_tokens: claudeResponse.usage.input_tokens || 0,
        output_tokens: claudeResponse.usage.output_tokens || 0,
        cache_read_input_tokens: (claudeResponse.usage as any).cache_read_input_tokens,
        cache_creation_input_tokens: (claudeResponse.usage as any).cache_creation_input_tokens,
      });
      await finishAgentRun({
        run_id,
        status: 'completed',
        output: { response: claudeResponse.text },
        reasoning: 'Demo run — simple greeting with optional contact lookup.',
        usage,
        latency_ms: Date.now() - t0,
      });
    });

    return {
      run_id,
      response: claudeResponse.text,
      contact_used: !!contact_id,
    };
  },
);
