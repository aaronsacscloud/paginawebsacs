// meeting_prep agent — 30 min antes de cada scheduled_meeting.
// Genera brief interno al partner/founder con:
//   - Contexto del contacto (timeline, deals abiertos)
//   - Servicios recomendados para su vertical
//   - Objeciones comunes del vertical (v2: RAG)
// Output: email al owner (no al cliente).

import { inngest } from '../client';
import { anthropic, MODELS, calculateCost } from '../../lib/ai/client';
import { createAgentRun, finishAgentRun } from '../../lib/ai/audit';
import { executeTool } from '../../lib/agent-tools/middleware';
import { notify, getSalesInbox } from '../../lib/notify';
import { supabase } from '../../lib/supabase';
import '../../lib/agent-tools';

const SYSTEM_PROMPT = `Eres un asistente de ventas senior de SACS. Preparas un brief de 1-pager para el asesor antes de su demo.
Tu objetivo: dar al asesor contexto claro en <30 segundos de lectura.

Formato del brief (plain text, español, no markdown):
1. CLIENTE — nombre empresa + vertical + tamaño (sucursales)
2. HISTORIAL — 2-3 bullets de eventos relevantes (fuente de lead, interacciones previas, interés declarado)
3. RECOMENDACIÓN SACS — plan sugerido + servicios únicos recomendados para su vertical (solo usa nombres/precios de catalog.recommend_services)
4. OBJECIONES TÍPICAS — 2 objeciones comunes del vertical + cómo responder
5. SIGUIENTES PASOS — 1 acción clara post-demo

Tono: directo, sin adjetivos. Prioriza información accionable. Máximo 250 palabras.
`;

export const meetingPrepAgent = inngest.createFunction(
  { id: 'meeting-prep', name: 'Meeting Prep Agent', triggers: [{ event: 'agent/meeting-prep.requested' }] },
  async ({ event, step }) => {
    const { meeting_id, contact_id, owner_id, company_id, scheduled_at } = event.data;
    const t0 = Date.now();

    const run_id = await step.run('create-audit-run', async () =>
      createAgentRun({
        agent_name: 'meeting_prep',
        trigger_type: 'event',
        trigger_ref: event.id,
        owner_id: owner_id || null,
        contact_id,
        company_id: company_id || null,
        assigned_to: owner_id || null,
        input: { meeting_id, scheduled_at },
        model: MODELS.sonnet,
      }),
    );

    // Step 1: get contact + timeline
    const ctx = { run_id, agent_name: 'meeting_prep', owner_id };
    const contactTool = await step.run('get-contact', async () => executeTool('crm.get_contact', { id: contact_id }, ctx));
    if (!contactTool.ok) {
      await finishAgentRun({
        run_id,
        status: 'failed',
        error: { step: 'get-contact', message: contactTool.error },
        latency_ms: Date.now() - t0,
      });
      throw new Error(contactTool.error);
    }

    const timelineTool = await step.run('get-timeline', async () => executeTool('crm.get_contact_timeline', { contact_id, limit: 20 }, ctx));
    const recServicesTool = await step.run('recommend-services', async () => {
      const vertical = (contactTool.data as any)?.giro || 'abarrotes';
      const sucursales = (contactTool.data as any)?.sucursales_interes || 1;
      return executeTool('catalog.recommend_services', { vertical, sucursales }, ctx);
    });
    const plansTool = await step.run('get-plans', async () => executeTool('catalog.get_plans', {}, ctx));

    // Step 2: Claude call
    const brief = await step.run('claude-brief', async () => {
      const resp = await anthropic.messages.create({
        model: MODELS.sonnet,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Contacto:\n${JSON.stringify(contactTool.data, null, 2)}\n\nÚltimas 20 actividades:\n${JSON.stringify(timelineTool.data, null, 2)}\n\nServicios recomendados por vertical:\n${JSON.stringify(recServicesTool.data, null, 2)}\n\nPlanes disponibles:\n${JSON.stringify(plansTool.data, null, 2)}\n\nMeeting scheduled at: ${scheduled_at}\n\nGenera el brief.`,
          },
        ],
      });
      const text = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
      return { text, usage: resp.usage };
    });

    // Step 3: send email to owner (internal)
    const emailResult = await step.run('send-email', async () => {
      if (!owner_id) return { ok: false, reason: 'no owner to send to' };
      const { data: owner } = await supabase.from('team_members').select('email, nombre').eq('id', owner_id).maybeSingle();
      if (!owner?.email) return { ok: false, reason: 'owner without email' };

      // Simple text email — no template needed for internal briefs
      return notify({
        channel: 'email',
        to: owner.email,
        subject: `Brief demo — ${(contactTool.data as any)?.nombre || 'contacto'} · ${scheduled_at?.slice(0, 16)}`,
        template: 'quote_accepted_owner', // reuse template shell; data below overrides
        data: {
          numero: 'BRIEF',
          empresa: (contactTool.data as any)?.empresa || '',
          contacto: (contactTool.data as any)?.nombre || '',
          email: (contactTool.data as any)?.email || '',
          total: 0,
          moneda: 'MXN',
          method: 'meeting_prep_auto',
          nota_interna: brief.text,  // pega el brief completo
          adminUrl: `https://www.sacscloud.com/admin/agents/${run_id}`,
        },
      });
    });

    // Step 4: finalize
    await step.run('finalize', async () => {
      const usage = calculateCost(MODELS.sonnet, {
        input_tokens: brief.usage.input_tokens || 0,
        output_tokens: brief.usage.output_tokens || 0,
        cache_read_input_tokens: (brief.usage as any).cache_read_input_tokens,
        cache_creation_input_tokens: (brief.usage as any).cache_creation_input_tokens,
      });
      await finishAgentRun({
        run_id,
        status: 'completed',
        output: { brief: brief.text, email_sent: emailResult.ok },
        reasoning: 'Brief generated from contact timeline + vertical defaults + plan catalog.',
        usage,
        latency_ms: Date.now() - t0,
      });
    });

    return { run_id, brief: brief.text, email_sent: emailResult.ok };
  },
);
