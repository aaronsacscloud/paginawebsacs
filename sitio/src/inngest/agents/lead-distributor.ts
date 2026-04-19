// lead_distributor agent — auto-routing de leads a partners.
// Trigger: evento cuando se crea un contact nuevo con tipo='lead'.
//
// Estrategia v1 (sin LLM todavía — reglas determinísticas):
// 1. Partners con capacity (deals abiertos < 20)
// 2. Prioriza vertical match si partner tiene tag/history en el vertical
// 3. Round-robin entre candidatos
// 4. Si no hay partners disponibles → asigna a founder
//
// Actualiza contact.owner_id + crea activity.

import { inngest } from '../client';
import { createAgentRun, finishAgentRun } from '../../lib/ai/audit';
import { supabase } from '../../lib/supabase';
import { MODELS } from '../../lib/ai/client';
import '../../lib/agent-tools';

export const leadDistributorAgent = inngest.createFunction(
  {
    id: 'lead-distributor',
    name: 'Lead Distributor Agent',
    triggers: [{ event: 'agent/lead-distributor.requested' }],
  },
  async ({ event, step }) => {
    const { contact_id } = event.data;
    const t0 = Date.now();

    const run_id = await step.run('create-audit-run', async () =>
      createAgentRun({
        agent_name: 'lead_distributor',
        trigger_type: 'event',
        trigger_ref: event.id,
        contact_id,
        input: { contact_id },
        model: 'rules-only', // no LLM en v1
      }),
    );

    // Fetch contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, nombre, email, giro, lead_score, lifecycle_stage, owner_id')
      .eq('id', contact_id)
      .single();

    if (!contact) {
      await finishAgentRun({ run_id, status: 'failed', error: { message: 'contact not found' }, latency_ms: Date.now() - t0 });
      throw new Error('contact not found');
    }

    if (contact.owner_id) {
      // Already assigned
      await finishAgentRun({
        run_id, status: 'completed',
        output: { skipped: true, reason: 'already_assigned', owner_id: contact.owner_id },
        reasoning: 'Contact already has owner_id assigned',
        latency_ms: Date.now() - t0,
      });
      return { run_id, skipped: true, owner_id: contact.owner_id };
    }

    // Fetch active partners
    const { data: partners } = await supabase
      .from('team_members')
      .select('id, nombre, email, activo')
      .eq('rol', 'partner')
      .eq('activo', true);

    if (!partners || partners.length === 0) {
      // Fallback: asignar a founder
      const { data: founder } = await supabase
        .from('team_members')
        .select('id, nombre')
        .eq('rol', 'founder')
        .limit(1)
        .maybeSingle();

      if (founder) {
        await supabase.from('contacts').update({ owner_id: founder.id }).eq('id', contact_id);
        await supabase.from('activities').insert({
          contact_id, tipo: 'sistema',
          titulo: `Lead asignado a ${founder.nombre} (founder fallback)`,
          metadata: { agent_run_id: run_id, rule: 'no_partners_available' },
          automatico: true,
        });
        await finishAgentRun({
          run_id, status: 'completed',
          output: { assigned_to: founder.id, rule: 'founder_fallback' },
          reasoning: 'No active partners — assigned to founder',
          latency_ms: Date.now() - t0,
        });
        return { run_id, owner_id: founder.id, rule: 'founder_fallback' };
      }

      await finishAgentRun({ run_id, status: 'failed', error: { message: 'no partners or founder available' }, latency_ms: Date.now() - t0 });
      return { run_id, error: 'no assignees available' };
    }

    // Score partners: capacity + recent leads assigned
    const scored = await Promise.all(partners.map(async (p: any) => {
      const { count: openDeals } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', p.id)
        .not('stage', 'in', '(cerrada_ganada,cerrada_perdida)');

      const { count: recentLeads } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', p.id)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

      return {
        ...p,
        open_deals: openDeals || 0,
        recent_leads: recentLeads || 0,
        capacity: Math.max(0, 20 - (openDeals || 0)), // each partner handles max 20 open deals
      };
    }));

    // Filter those with capacity
    const available = scored.filter(p => p.capacity > 0);
    if (available.length === 0) {
      // All partners at capacity — assign founder
      const { data: founder } = await supabase.from('team_members').select('id').eq('rol', 'founder').limit(1).maybeSingle();
      if (founder) {
        await supabase.from('contacts').update({ owner_id: founder.id }).eq('id', contact_id);
        await finishAgentRun({
          run_id, status: 'completed',
          output: { assigned_to: founder.id, rule: 'partners_at_capacity' },
          reasoning: 'All partners at capacity — founder fallback',
          latency_ms: Date.now() - t0,
        });
        return { run_id, owner_id: founder.id };
      }
    }

    // Pick the one with fewest recent leads (round-robin style)
    available.sort((a, b) => a.recent_leads - b.recent_leads);
    const chosen = available[0];

    await supabase.from('contacts').update({ owner_id: chosen.id }).eq('id', contact_id);

    await supabase.from('activities').insert({
      contact_id,
      tipo: 'sistema',
      titulo: `Lead asignado a ${chosen.nombre} (round-robin)`,
      metadata: {
        agent_run_id: run_id,
        rule: 'round_robin_capacity',
        partner_id: chosen.id,
        partner_open_deals: chosen.open_deals,
        partner_recent_leads: chosen.recent_leads,
      },
      automatico: true,
    });

    await finishAgentRun({
      run_id, status: 'completed',
      output: {
        assigned_to: chosen.id,
        partner_nombre: chosen.nombre,
        rule: 'round_robin_capacity',
        scoring: scored,
      },
      reasoning: `Round-robin entre ${available.length} partners con capacidad. Elegido: ${chosen.nombre} (${chosen.recent_leads} leads recientes, ${chosen.open_deals} deals abiertos).`,
      latency_ms: Date.now() - t0,
    });

    return { run_id, owner_id: chosen.id, partner_nombre: chosen.nombre };
  },
);
