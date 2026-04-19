// Vercel Cron — /api/cron/agents-reaper (every 10 min)
// Marks any agent_run stuck in 'running' > 10 min as 'timeout'.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const CRON_SECRET = (import.meta.env.CRON_SECRET || '').trim();

export const GET: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization') || '';
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  if (CRON_SECRET && !dryRun && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('agent_runs')
    .update({
      status: 'timeout',
      error: { message: 'Reaped by agents-reaper (>10 min in running state)' },
    })
    .eq('status', 'running')
    .lt('created_at', cutoff)
    .select('id, agent_name');

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ reaped: (data || []).length, runs: data || [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
