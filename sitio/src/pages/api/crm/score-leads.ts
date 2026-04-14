import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== 'sacs-cron-2026') {
    return new Response('Forbidden', { status: 403 });
  }

  // Get all non-archived contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, lead_score, total_time_on_site, page_count, created_at, lifecycle_stage')
    .is('archived_at', null)
    .in('tipo', ['lead']);

  let updated = 0;

  for (const contact of (contacts || [])) {
    // Count activities
    const { count: totalActivities } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', contact.id);

    const { count: emailOpens } = await supabase
      .from('email_sends')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', contact.id)
      .in('estado', ['opened', 'clicked']);

    const { count: pageVisits } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', contact.id)
      .eq('tipo', 'page_visit');

    const { count: demos } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', contact.id)
      .in('tipo', ['demo_agendada', 'demo_realizada']);

    // Calculate score
    let score = 0;
    score += Math.min((contact.page_count || 0) * 3, 30); // Max 30 from pages
    score += Math.min(Math.floor((contact.total_time_on_site || 0) / 30), 20); // Max 20 from time
    score += Math.min((totalActivities || 0) * 2, 20); // Max 20 from activities
    score += Math.min((emailOpens || 0) * 5, 15); // Max 15 from email engagement
    score += Math.min((pageVisits || 0) * 3, 10); // Max 10 from page visits
    score += (demos || 0) > 0 ? 15 : 0; // 15 bonus for demo

    // Decay: lose points if no activity in 14+ days
    const { data: lastActivity } = await supabase
      .from('activities')
      .select('created_at')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastActivity) {
      const daysSince = Math.floor((Date.now() - new Date(lastActivity.created_at).getTime()) / 86400000);
      if (daysSince > 30) score = Math.max(0, score - 20);
      else if (daysSince > 14) score = Math.max(0, score - 10);
    }

    score = Math.min(100, Math.max(0, score));

    if (score !== contact.lead_score) {
      await supabase.from('contacts').update({ lead_score: score }).eq('id', contact.id);

      // Auto-promote lifecycle if score threshold reached
      if (score >= 40 && contact.lifecycle_stage === 'lead') {
        await supabase.from('contacts').update({ lifecycle_stage: 'lead_calificado' }).eq('id', contact.id);
      }

      updated++;
    }
  }

  return new Response(JSON.stringify({ processed: (contacts || []).length, updated }));
};
