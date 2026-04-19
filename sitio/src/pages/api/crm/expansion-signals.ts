// GET /api/crm/expansion-signals?company_id=xxx → lista señales activas (no dismissed)
// DELETE /api/crm/expansion-signals?id=xxx → marca como dismissed

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const companyId = url.searchParams.get('company_id');
  if (!companyId) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    const { data, error } = await supabase
      .from('expansion_signals')
      .select('id, signal_type, opportunity_value, metadata, detected_at')
      .eq('company_id', companyId)
      .is('dismissed_at', null)
      .order('detected_at', { ascending: false });

    if (error) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(data || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};

export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  try {
    await supabase.from('expansion_signals').update({ dismissed_at: new Date().toISOString() }).eq('id', id);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
