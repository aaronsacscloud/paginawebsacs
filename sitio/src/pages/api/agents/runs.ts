// GET /api/agents/runs — list agent runs with filters + partner scope.
// Params: agent_name?, status?, limit?

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser, applyPartnerScope } from '../../../lib/auth/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });

  const agent_name = url.searchParams.get('agent_name');
  const status = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50') || 50, 500);

  let query = supabase
    .from('agent_runs')
    .select('id, created_at, agent_name, status, owner_id, assigned_to, deal_id, contact_id, company_id, model, input_tokens, output_tokens, cost_usd, latency_ms, input, output, reasoning')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (agent_name) query = query.eq('agent_name', agent_name);
  if (status) query = query.eq('status', status);

  // Partner scope: partner sees only runs where they're the owner_id or assigned_to
  if (user.role === 'partner') {
    query = query.or(`owner_id.eq.${user.id},assigned_to.eq.${user.id}`);
  }

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify(data || []), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
