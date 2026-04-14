import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

function evaluateCondition(condition: any, contact: any, company: any): boolean {
  const { property, operator, value } = condition;
  const actual = contact[property] ?? company?.[property];
  switch (operator) {
    case 'eq': return actual === value;
    case 'neq': return actual !== value;
    case 'gte': return Number(actual) >= Number(value);
    case 'lte': return Number(actual) <= Number(value);
    case 'contains': return String(actual || '').toLowerCase().includes(String(value).toLowerCase());
    case 'in': return Array.isArray(value) && value.includes(actual);
    default: return false;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, action } = body;

  if (!id || !action) {
    return new Response(JSON.stringify({ error: 'id and action are required' }), { status: 400 });
  }

  if (!['activate', 'pause'].includes(action)) {
    return new Response(JSON.stringify({ error: 'action must be activate or pause' }), { status: 400 });
  }

  // Get automation
  const { data: automation, error: autoErr } = await supabase
    .from('automations')
    .select('*')
    .eq('id', id)
    .single();

  if (autoErr || !automation) {
    return new Response(JSON.stringify({ error: 'Automation not found' }), { status: 404 });
  }

  if (action === 'activate') {
    // Set estado to activo
    const { error: updateErr } = await supabase
      .from('automations')
      .update({ estado: 'activo' })
      .eq('id', id);

    if (updateErr) return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });

    // Auto-enroll matching contacts based on enrollment_triggers
    let enrolled = 0;
    const triggers = automation.enrollment_triggers;
    if (triggers && triggers.conditions && Array.isArray(triggers.conditions)) {
      // Get first step
      const { data: firstStep } = await supabase
        .from('automation_steps')
        .select('id')
        .eq('automation_id', id)
        .eq('orden', 1)
        .is('parent_step_id', null)
        .limit(1)
        .single();

      if (firstStep) {
        // Get all contacts not archived
        const { data: contacts } = await supabase
          .from('contacts')
          .select('*, companies(id, nombre, plan, estado_cuenta, lifecycle_stage)')
          .is('archived_at', null);

        const suppressionStages: string[] = automation.suppression_stages || [];

        for (const contact of contacts || []) {
          // Check suppression
          if (suppressionStages.includes(contact.lifecycle_stage)) continue;

          // Check if already enrolled
          const { data: existing } = await supabase
            .from('automation_enrollments')
            .select('id')
            .eq('automation_id', id)
            .eq('contact_id', contact.id)
            .eq('estado', 'activo')
            .limit(1)
            .maybeSingle();

          if (existing) continue;

          // Check email unsubscribe
          if (contact.email) {
            const { data: unsub } = await supabase
              .from('email_unsubscribes')
              .select('id')
              .eq('email', contact.email)
              .limit(1)
              .maybeSingle();

            if (unsub) continue;
          }

          // Evaluate all conditions
          const company = contact.companies;
          const allMatch = triggers.conditions.every((cond: any) =>
            evaluateCondition(cond, contact, company)
          );

          if (allMatch) {
            const { error: enrollErr } = await supabase
              .from('automation_enrollments')
              .insert({
                automation_id: id,
                contact_id: contact.id,
                estado: 'activo',
                current_step_id: firstStep.id,
                next_action_at: new Date().toISOString(),
                enrolled_at: new Date().toISOString(),
              });

            if (!enrollErr) {
              enrolled++;

              await supabase.from('activities').insert({
                contact_id: contact.id,
                company_id: contact.company_id || null,
                tipo: 'automation_enrolled',
                titulo: `Inscrito en automatización: ${automation.nombre}`,
                metadata: { automation_id: id, auto_enrolled: true },
                automatico: true,
              });
            }
          }
        }

        // Update total_enrolled
        if (enrolled > 0) {
          await supabase
            .from('automations')
            .update({ total_enrolled: (automation.total_enrolled || 0) + enrolled })
            .eq('id', id);
        }
      }
    }

    return new Response(JSON.stringify({
      action: 'activated',
      id,
      enrolled,
    }));
  }

  if (action === 'pause') {
    // Set automation estado to pausado
    const { error: updateErr } = await supabase
      .from('automations')
      .update({ estado: 'pausado' })
      .eq('id', id);

    if (updateErr) return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });

    // Pause all active enrollments
    const { data: paused, error: pauseErr } = await supabase
      .from('automation_enrollments')
      .update({ estado: 'pausado' })
      .eq('automation_id', id)
      .eq('estado', 'activo')
      .select('id');

    if (pauseErr) return new Response(JSON.stringify({ error: pauseErr.message }), { status: 500 });

    return new Response(JSON.stringify({
      action: 'paused',
      id,
      enrollments_paused: paused?.length || 0,
    }));
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
};
