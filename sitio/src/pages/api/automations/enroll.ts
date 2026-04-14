import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { automation_id, contact_id } = body;

  if (!automation_id || !contact_id) {
    return new Response(JSON.stringify({ error: 'automation_id and contact_id are required' }), { status: 400 });
  }

  // 1. Check automation exists and is active
  const { data: automation, error: autoErr } = await supabase
    .from('automations')
    .select('*')
    .eq('id', automation_id)
    .single();

  if (autoErr || !automation) {
    return new Response(JSON.stringify({ error: 'Automation not found' }), { status: 404 });
  }

  if (automation.estado !== 'activo') {
    return new Response(JSON.stringify({ error: 'Automation is not active' }), { status: 400 });
  }

  // 2. Check contact is not already actively enrolled
  const { data: existingEnrollment } = await supabase
    .from('automation_enrollments')
    .select('id')
    .eq('automation_id', automation_id)
    .eq('contact_id', contact_id)
    .eq('estado', 'activo')
    .limit(1)
    .maybeSingle();

  if (existingEnrollment) {
    return new Response(JSON.stringify({ error: 'Contact is already enrolled in this automation' }), { status: 409 });
  }

  // 3. Check contact is not in suppression_stages
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('*, companies(id, nombre)')
    .eq('id', contact_id)
    .single();

  if (contactErr || !contact) {
    return new Response(JSON.stringify({ error: 'Contact not found' }), { status: 404 });
  }

  const suppressionStages: string[] = automation.suppression_stages || [];
  if (suppressionStages.length > 0 && suppressionStages.includes(contact.lifecycle_stage)) {
    return new Response(JSON.stringify({ error: `Contact is in suppressed stage: ${contact.lifecycle_stage}` }), { status: 400 });
  }

  // 4. Check contact email is not in email_unsubscribes
  if (contact.email) {
    const { data: unsub } = await supabase
      .from('email_unsubscribes')
      .select('id')
      .eq('email', contact.email)
      .limit(1)
      .maybeSingle();

    if (unsub) {
      return new Response(JSON.stringify({ error: 'Contact email is unsubscribed' }), { status: 400 });
    }
  }

  // 5. Get the first step of the automation (orden = 1, no parent_step_id)
  const { data: firstStep } = await supabase
    .from('automation_steps')
    .select('id')
    .eq('automation_id', automation_id)
    .eq('orden', 1)
    .is('parent_step_id', null)
    .limit(1)
    .single();

  if (!firstStep) {
    return new Response(JSON.stringify({ error: 'Automation has no steps' }), { status: 400 });
  }

  // 6. Create automation_enrollment
  const { data: enrollment, error: enrollErr } = await supabase
    .from('automation_enrollments')
    .insert({
      automation_id,
      contact_id,
      estado: 'activo',
      current_step_id: firstStep.id,
      next_action_at: new Date().toISOString(),
      enrolled_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (enrollErr) {
    return new Response(JSON.stringify({ error: enrollErr.message }), { status: 500 });
  }

  // 7. Increment automations.total_enrolled
  await supabase.rpc('increment_field', {
    table_name: 'automations',
    field_name: 'total_enrolled',
    row_id: automation_id,
  }).then(async (res) => {
    // Fallback: manual increment if RPC doesn't exist
    if (res.error) {
      await supabase
        .from('automations')
        .update({ total_enrolled: (automation.total_enrolled || 0) + 1 })
        .eq('id', automation_id);
    }
  });

  // 8. Log activity on contact
  await supabase.from('activities').insert({
    contact_id,
    company_id: contact.company_id || null,
    tipo: 'automation_enrolled',
    titulo: `Inscrito en automatización: ${automation.nombre}`,
    metadata: { automation_id, enrollment_id: enrollment.id },
    automatico: true,
  });

  // 9. Return enrollment
  return new Response(JSON.stringify(enrollment), { status: 201 });
};
