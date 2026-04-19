// POST /api/agents/approve { run_id } — partner/founder approves a pending run.
// Moves status: awaiting_approval → approved. Triggers any post-approval side effect.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser, assertCanAccess, AccessDenied } from '../../../lib/auth/scope';
import { recordMetric } from '../../../lib/ai/audit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });

  try {
    const body = await request.json();
    const { run_id, edited_output } = body || {};
    if (!run_id) return new Response(JSON.stringify({ error: 'run_id required' }), { status: 400 });

    const { data: run } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('id', run_id)
      .single();

    if (!run) return new Response(JSON.stringify({ error: 'run not found' }), { status: 404 });
    if (run.status !== 'awaiting_approval') {
      return new Response(JSON.stringify({ error: `cannot approve run in status ${run.status}` }), { status: 409 });
    }

    // Access control: only owner or assigned_to (or founder) can approve
    try {
      assertCanAccess(user, run.assigned_to || run.owner_id);
    } catch (err) {
      if (err instanceof AccessDenied) return new Response(JSON.stringify({ error: err.message }), { status: 403 });
      throw err;
    }

    // Record edit diff if output was changed
    if (edited_output) {
      await recordMetric(run.agent_name, run_id, 'edited_before_send', 1, {
        original: run.output,
        edited: edited_output,
      });
    }

    const { error } = await supabase
      .from('agent_runs')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        output: edited_output || run.output,
      })
      .eq('id', run_id);

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    await recordMetric(run.agent_name, run_id, 'approved', 1);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
