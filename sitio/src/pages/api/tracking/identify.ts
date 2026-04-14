import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { email, visitor_id, page_url, page_title, referrer } = await request.json();

  if (!email && !visitor_id) {
    return new Response(JSON.stringify({ error: 'email or visitor_id required' }), { status: 400 });
  }

  // Find contact
  let contact: any = null;
  if (email) {
    const { data } = await supabase.from('contacts').select('id, company_id, nombre').eq('email', email).limit(1).single();
    contact = data;
  }
  if (!contact && visitor_id) {
    const { data } = await supabase.from('contacts').select('id, company_id, nombre').eq('visitor_id', visitor_id).limit(1).single();
    contact = data;
  }

  if (!contact) {
    return new Response(JSON.stringify({ identified: false }));
  }

  // Log page visit activity
  await supabase.from('activities').insert({
    contact_id: contact.id,
    company_id: contact.company_id,
    tipo: 'page_visit',
    titulo: `Visito: ${page_title || page_url || 'sitio web'}`,
    metadata: { page_url, page_title, referrer, timestamp: new Date().toISOString() },
    automatico: true,
  });

  // Update last_seen
  await supabase.from('contacts').update({
    last_contact_at: new Date().toISOString()
  }).eq('id', contact.id);

  // Check for automations triggered by website visit
  try {
    const { data: automations } = await supabase
      .from('automations')
      .select('id, enrollment_triggers, suppression_stages')
      .eq('estado', 'activo');

    for (const auto of (automations || [])) {
      const triggers = Array.isArray(auto.enrollment_triggers) ? auto.enrollment_triggers : auto.enrollment_triggers ? [auto.enrollment_triggers] : [];
      const shouldEnroll = triggers.some((t: any) => t.type === 'website_visit');
      if (!shouldEnroll) continue;

      const { data: existing } = await supabase
        .from('automation_enrollments')
        .select('id')
        .eq('automation_id', auto.id)
        .eq('contact_id', contact.id)
        .eq('estado', 'activo')
        .limit(1)
        .single();

      if (existing) continue;

      const { data: firstStep } = await supabase
        .from('automation_steps')
        .select('id')
        .eq('automation_id', auto.id)
        .is('parent_step_id', null)
        .order('orden')
        .limit(1)
        .single();

      if (firstStep) {
        await supabase.from('automation_enrollments').insert({
          automation_id: auto.id,
          contact_id: contact.id,
          current_step_id: firstStep.id,
          next_action_at: new Date().toISOString(),
          enrollment_trigger: { type: 'website_visit', page_url },
        }).catch(() => {});
      }
    }
  } catch {}

  return new Response(JSON.stringify({ identified: true, contact_id: contact.id }));
};
