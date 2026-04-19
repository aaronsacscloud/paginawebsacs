// POST /api/agents/reject { run_id, category, detail } — partner/founder rejects a pending run.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser, assertCanAccess, AccessDenied } from '../../../lib/auth/scope';
import { recordMetric } from '../../../lib/ai/audit';

export const prerender = false;

const CATEGORIES = new Set([
  'wrong_price',
  'wrong_tone',
  'missing_context',
  'hallucinated_fact',
  'dangerous_action',
  'other',
]);

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });

  try {
    const body = await request.json();
    const { run_id, category, detail } = body || {};
    if (!run_id || !category) return new Response(JSON.stringify({ error: 'run_id and category required' }), { status: 400 });
    if (!CATEGORIES.has(category)) return new Response(JSON.stringify({ error: 'invalid category' }), { status: 400 });

    const { data: run } = await supabase.from('agent_runs').select('*').eq('id', run_id).single();
    if (!run) return new Response(JSON.stringify({ error: 'run not found' }), { status: 404 });
    if (run.status !== 'awaiting_approval') {
      return new Response(JSON.stringify({ error: `cannot reject run in status ${run.status}` }), { status: 409 });
    }

    try {
      assertCanAccess(user, run.assigned_to || run.owner_id);
    } catch (err) {
      if (err instanceof AccessDenied) return new Response(JSON.stringify({ error: err.message }), { status: 403 });
      throw err;
    }

    const { error } = await supabase
      .from('agent_runs')
      .update({
        status: 'rejected',
        rejected_reason_category: category,
        rejected_reason_detail: detail || null,
      })
      .eq('id', run_id);

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    await recordMetric(run.agent_name, run_id, 'rejected', 1, { category, detail: detail || null });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
