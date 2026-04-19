# Cookbook: Agregar un agente nuevo

Un agente es una función que orquesta LLM + tools para hacer algo útil. Cada agente vive en `src/inngest/agents/<name>.ts` y se registra en `src/pages/api/inngest.ts`.

## Template mínimo

```ts
// src/inngest/agents/followup-pacer.ts
import { inngest } from '../client';
import { anthropic, MODELS, calculateCost } from '../../lib/ai/client';
import { createAgentRun, finishAgentRun } from '../../lib/ai/audit';
import { executeTool } from '../../lib/agent-tools/middleware';
import '../../lib/agent-tools';

const SYSTEM_PROMPT = `Eres un experto en follow-ups de SACS. Dado un deal sin actividad en X días, decide:
- enviar email recordatorio (con tono calibrado al vertical)
- escalar a partner si >14 días
- marcar deal stale
Responde JSON: { action: 'email'|'escalate'|'stale', reason: string, email_body?: string }`;

export const followupPacerAgent = inngest.createFunction(
  { id: 'followup-pacer', name: 'Follow-up Pacer', triggers: [{ cron: '0 10 * * *' }] },  // 10am daily
  async ({ step }) => {
    const t0 = Date.now();

    // 1. Fetch deals sin actividad reciente (tool call)
    const staleDeals = await step.run('fetch-stale', async () => executeTool(
      'crm.get_stale_deals',
      { days_since_activity: 3 },
      { run_id: '', agent_name: 'followup_pacer', owner_id: null }
    ));

    const results = [];
    for (const deal of staleDeals.data || []) {
      // 2. Audit run per deal
      const run_id = await step.run(`run-${deal.id}`, async () => createAgentRun({
        agent_name: 'followup_pacer',
        trigger_type: 'cron',
        owner_id: deal.owner_id,
        deal_id: deal.id,
        input: { deal_id: deal.id, days_stale: deal.days_since_activity },
        model: MODELS.haiku,  // clasificación simple, Haiku basta
      }));

      // 3. LLM call
      const resp = await step.run(`llm-${deal.id}`, async () => anthropic.messages.create({
        model: MODELS.haiku,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(deal) }],
      }));

      const text = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
      let action;
      try { action = JSON.parse(text); } catch { action = { action: 'escalate', reason: 'LLM parse error' }; }

      // 4. Finalize
      await step.run(`finalize-${deal.id}`, async () => {
        const usage = calculateCost(MODELS.haiku, {
          input_tokens: resp.usage.input_tokens,
          output_tokens: resp.usage.output_tokens,
        });
        await finishAgentRun({
          run_id,
          status: action.action === 'email' ? 'awaiting_approval' : 'completed',
          output: action,
          reasoning: action.reason,
          usage,
          latency_ms: Date.now() - t0,
        });
      });

      results.push({ deal_id: deal.id, action: action.action });
    }

    return { processed: results.length, results };
  },
);
```

## Registro

```ts
// src/pages/api/inngest.ts
import { followupPacerAgent } from '../../inngest/agents/followup-pacer';

const handler = serve({
  client: inngest,
  functions: [helloAgent, meetingPrepAgent, quoteDrafterAgent, followupPacerAgent],
});
```

## Config en DB

```sql
INSERT INTO agent_configs (agent_name, auto_approve, enabled, current_model) VALUES
  ('followup_pacer', false, true, 'claude-haiku-4-5')
ON CONFLICT (agent_name) DO NOTHING;
```

## Reglas

1. **Un run por trabajo unitario**: no agrupes 100 deals en 1 run. Crea un run por deal. Así el approval UI es granular.
2. **Haiku vs Sonnet**: usa Haiku si el output es <1K tokens y no requiere razonamiento multi-paso. Sonnet solo cuando haya que combinar contextos complejos.
3. **HITL obligatorio para side effects externos** hasta medir precision ≥95% en shadow mode 2 semanas:
   - Email al cliente → `status: 'awaiting_approval'`
   - Llamada al cliente → HITL
   - Crear quote → HITL hasta precision validada
   - Nota interna, resumen, brief → `status: 'completed'` (auto)
4. **Siempre wrappea contenido del cliente**: `wrapUntrusted(transcript)` antes de pasarlo al LLM para prevenir prompt injection.
5. **PII redaction antes de LLM**: `redactPII(text)` antes de enviar a Anthropic.
6. **Nunca confíes en el LLM para pricing**: siempre extrae precios via tools del catálogo.

## Disparar el agente

### Desde cron
```ts
{ triggers: [{ cron: '0 10 * * *' }] }  // 10am UTC daily
```

### Desde evento
```ts
{ triggers: [{ event: 'agent/followup-pacer.requested' }] }
// Luego en tu API: await inngest.send({ name: 'agent/followup-pacer.requested', data: {...} });
```

### Manual via endpoint
Crea `/api/agents/<agent-name>/trigger.ts` que despache el evento.

## Testing

Antes de prod:
1. Crea 10 casos dorados en `src/lib/ai/eval-golden/<agent-name>.jsonl`
2. Corre el agente en cada caso
3. Compara output vs expected. Meta: ≥80% match exacto, ≥95% semánticamente correcto
4. Commit eval suite. CI lo correrá en cada PR que toque ese agente.

## Observabilidad

Cada run va automáticamente a `agent_runs` (audit), `agent_tool_log` (tool calls fine-grained), y si está configurado a Langfuse (trace completo).

Ver runs: `/admin/agents`. Ver detalle: `/admin/agents/[runId]`.
