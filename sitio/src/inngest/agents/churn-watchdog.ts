// churn_watchdog agent — cron 6h.
// Para cada company con estado_cuenta='activo' y health_score < 60 o señales de churn:
// 1. Analiza health_factors + activities recientes
// 2. Clasifica riesgo: verde/amarillo/rojo
// 3. Sugiere play de retención específico
// 4. Crea task para CSM (founder o asignado)
// 5. Inserta agent_run con recommendation

import { inngest } from '../client';
import { anthropic, MODELS, calculateCost } from '../../lib/ai/client';
import { createAgentRun, finishAgentRun } from '../../lib/ai/audit';
import { supabase } from '../../lib/supabase';
import '../../lib/agent-tools';

const SYSTEM_PROMPT = `Eres un especialista senior en Customer Success de SACS. Analizas una empresa cliente con posibles señales de churn y decides:

1. Nivel de riesgo: green (estable) / yellow (atención) / red (crítico)
2. Play de retención específico (no genérico):
   - red: llamada inmediata CEO-to-CEO
   - yellow: sesión QBR con propuesta de valor
   - green: check-in proactivo mensual
3. Motivo concreto basado en las señales observadas
4. Próximo paso en 48h MAX

OUTPUT: SOLO JSON:
{
  "risk_level": "green|yellow|red",
  "primary_concern": "1 oración del problema",
  "play_sugerido": "1 oración del play específico",
  "next_action_48h": "1 tarea concreta",
  "confidence": 0-100
}`;

export const churnWatchdogAgent = inngest.createFunction(
  {
    id: 'churn-watchdog',
    name: 'Churn Watchdog Agent',
    triggers: [{ cron: '0 */6 * * *' }], // cada 6h
  },
  async ({ step }) => {
    const t0 = Date.now();
    const results: any = { analyzed: 0, flagged: 0, tasks_created: 0, errors: [] as string[] };

    // Candidatos: activos con health < 60 OR fecha_renovacion en 30d OR estado_cuenta=vencido
    const in30d = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const { data: companies } = await supabase
      .from('companies')
      .select('id, nombre, plan, mrr, health_score, health_factors, health_computed_at, estado_cuenta, fecha_renovacion, contact_id, giro, sucursales')
      .in('estado_cuenta', ['activo', 'vencido'])
      .or(`health_score.lt.60,estado_cuenta.eq.vencido,fecha_renovacion.lte.${in30d}`);

    if (!companies || companies.length === 0) {
      return { processed: 0, message: 'No companies at risk' };
    }

    for (const company of companies) {
      results.analyzed++;
      try {
        // Check si ya hay un churn_watchdog run hoy para esta company (evitar spam)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: todayRun } = await supabase
          .from('agent_runs')
          .select('id')
          .eq('agent_name', 'churn_watchdog')
          .eq('company_id', company.id)
          .gte('created_at', today.toISOString())
          .limit(1)
          .maybeSingle();

        if (todayRun) continue; // ya procesado hoy

        // Fetch recent activities del company
        const { data: activities } = await supabase
          .from('activities')
          .select('tipo, titulo, created_at, metadata')
          .eq('company_id', company.id)
          .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())
          .order('created_at', { ascending: false })
          .limit(20);

        const run_id = await step.run(`run-${company.id}`, async () =>
          createAgentRun({
            agent_name: 'churn_watchdog',
            trigger_type: 'cron',
            company_id: company.id,
            contact_id: company.contact_id || null,
            input: {
              company: company.nombre,
              health_score: company.health_score,
              estado_cuenta: company.estado_cuenta,
              fecha_renovacion: company.fecha_renovacion,
            },
            model: MODELS.haiku,
          }),
        );

        const llmResult = await step.run(`llm-${company.id}`, async () => {
          const userContent = [
            `Empresa cliente: ${company.nombre}`,
            `Plan: ${company.plan} · Sucursales: ${company.sucursales || 1} · MRR: $${company.mrr || 0} MXN`,
            `Vertical: ${company.giro || 'no especificado'}`,
            `Estado cuenta: ${company.estado_cuenta}`,
            `Fecha renovación: ${company.fecha_renovacion || 'sin configurar'}`,
            `Health score: ${company.health_score ?? 'no calculado'}/100`,
            `Health factors: ${JSON.stringify(company.health_factors || {})}`,
            '',
            `Actividades recientes (90d):`,
            JSON.stringify(activities || []),
            '',
            'Analiza y devuelve JSON con risk_level + play.',
          ].join('\n');

          const resp = await anthropic.messages.create({
            model: MODELS.haiku,
            max_tokens: 500,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userContent }],
          });
          const text = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
          return { text, usage: resp.usage };
        });

        let analysis: any;
        try {
          const jsonText = llmResult.text.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
          analysis = JSON.parse(jsonText);
        } catch (err) {
          await finishAgentRun({
            run_id, status: 'failed',
            error: { step: 'parse', message: String(err), raw: llmResult.text.slice(0, 300) },
            latency_ms: Date.now() - t0,
          });
          continue;
        }

        const usage = calculateCost(MODELS.haiku, {
          input_tokens: llmResult.usage.input_tokens || 0,
          output_tokens: llmResult.usage.output_tokens || 0,
        });

        await finishAgentRun({
          run_id,
          status: 'completed',
          output: analysis,
          reasoning: `${analysis.risk_level}: ${analysis.primary_concern}. Play: ${analysis.play_sugerido}`,
          usage,
          latency_ms: Date.now() - t0,
        });

        // Create CSM task if risk yellow or red
        if (['yellow', 'red'].includes(analysis.risk_level)) {
          await supabase.from('activities').insert({
            contact_id: company.contact_id,
            company_id: company.id,
            tipo: 'tarea',
            titulo: `${analysis.risk_level.toUpperCase()} — ${company.nombre}: ${analysis.next_action_48h}`,
            metadata: {
              task: true,
              category: 'churn_prevention',
              risk_level: analysis.risk_level,
              primary_concern: analysis.primary_concern,
              play_sugerido: analysis.play_sugerido,
              agent_run_id: run_id,
              due_in_hours: analysis.risk_level === 'red' ? 24 : 48,
            },
            automatico: true,
          });
          results.tasks_created++;
          results.flagged++;
        }
      } catch (err: any) {
        results.errors.push(`company ${company.id}: ${err?.message || String(err)}`);
      }
    }

    return results;
  },
);
