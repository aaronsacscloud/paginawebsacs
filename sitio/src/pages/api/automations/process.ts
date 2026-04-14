import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

// ── Condition evaluator ───────────────────────────────────────────────

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

// ── Delay unit calculator ─────────────────────────────────────────────

function calculateDelay(amount: number, unit: string): number {
  const multipliers: Record<string, number> = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  };
  return amount * (multipliers[unit] || multipliers.days);
}

// ── Find next step helper ─────────────────────────────────────────────

async function findNextStep(
  automation_id: string,
  currentStep: any
): Promise<any | null> {
  // Build query for next sibling step (same parent, next orden)
  let query = supabase
    .from('automation_steps')
    .select('*')
    .eq('automation_id', automation_id)
    .eq('orden', currentStep.orden + 1);

  // Handle null vs non-null parent_step_id
  if (currentStep.parent_step_id) {
    query = query.eq('parent_step_id', currentStep.parent_step_id);
  } else {
    query = query.is('parent_step_id', null);
  }

  const { data: nextStep } = await query.limit(1).maybeSingle();
  if (nextStep) return nextStep;

  // If we're in a branch (parent_step_id is set), go back to parent level
  if (currentStep.parent_step_id) {
    const { data: parentStep } = await supabase
      .from('automation_steps')
      .select('*')
      .eq('id', currentStep.parent_step_id)
      .single();

    if (parentStep) {
      return findNextStep(automation_id, parentStep);
    }
  }

  return null;
}

// ── Advance enrollment to next step ───────────────────────────────────

async function advanceEnrollment(
  enrollmentId: string,
  automation_id: string,
  currentStep: any,
  automationData: any
): Promise<'advanced' | 'completed'> {
  const nextStep = await findNextStep(automation_id, currentStep);

  if (nextStep) {
    await supabase
      .from('automation_enrollments')
      .update({
        current_step_id: nextStep.id,
        next_action_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);
    return 'advanced';
  }

  // No next step — enrollment is complete
  await supabase
    .from('automation_enrollments')
    .update({
      estado: 'completado',
      completed_at: new Date().toISOString(),
      next_action_at: null,
    })
    .eq('id', enrollmentId);

  // Increment total_completed on automation
  await supabase
    .from('automations')
    .update({ total_completed: (automationData.total_completed || 0) + 1 })
    .eq('id', automation_id);

  return 'completed';
}

// ── Main cron processor ───────────────────────────────────────────────

export const GET: APIRoute = async ({ url, request }) => {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const keyParam = url.searchParams.get('key');
  const cronSecret = import.meta.env.CRON_SECRET || 'sacs-cron-2026';

  const isAuthorized =
    authHeader === `Bearer ${cronSecret}` ||
    keyParam === 'sacs-cron-2026';

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let processed = 0;
  let completed = 0;
  let errors = 0;

  // 1. Query enrollments ready to process
  const { data: enrollments, error: fetchErr } = await supabase
    .from('automation_enrollments')
    .select(`
      *,
      automation_steps!current_step_id(*),
      automations!automation_id(*)
    `)
    .eq('estado', 'activo')
    .lte('next_action_at', new Date().toISOString())
    .order('next_action_at', { ascending: true })
    .limit(50);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  if (!enrollments || enrollments.length === 0) {
    return new Response(JSON.stringify({ processed: 0, completed: 0, errors: 0, message: 'No enrollments to process' }));
  }

  for (const enrollment of enrollments) {
    try {
      const currentStep = enrollment.automation_steps;
      const automation = enrollment.automations;

      if (!currentStep || !automation) {
        errors++;
        continue;
      }

      // b. Load the contact
      const { data: contact } = await supabase
        .from('contacts')
        .select('*, companies(*)')
        .eq('id', enrollment.contact_id)
        .single();

      if (!contact) {
        errors++;
        continue;
      }

      const company = contact.companies;

      // c. Check goal_criteria
      if (automation.goal_criteria && automation.goal_criteria.conditions) {
        const goalMet = automation.goal_criteria.conditions.every((cond: any) =>
          evaluateCondition(cond, contact, company)
        );

        if (goalMet) {
          await supabase
            .from('automation_enrollments')
            .update({
              estado: 'goal_achieved',
              completed_at: new Date().toISOString(),
              next_action_at: null,
            })
            .eq('id', enrollment.id);

          await supabase.from('activities').insert({
            contact_id: contact.id,
            company_id: contact.company_id || null,
            tipo: 'automation_goal_achieved',
            titulo: `Meta alcanzada en: ${automation.nombre}`,
            metadata: { automation_id: automation.id, enrollment_id: enrollment.id },
            automatico: true,
          });

          processed++;
          completed++;
          continue;
        }
      }

      // d. Check unenrollment_triggers
      if (automation.unenrollment_triggers && automation.unenrollment_triggers.conditions) {
        const unenroll = automation.unenrollment_triggers.conditions.some((cond: any) =>
          evaluateCondition(cond, contact, company)
        );

        if (unenroll) {
          await supabase
            .from('automation_enrollments')
            .update({
              estado: 'unenrolled',
              completed_at: new Date().toISOString(),
              next_action_at: null,
            })
            .eq('id', enrollment.id);

          processed++;
          continue;
        }
      }

      // e. Execute the step based on tipo
      const stepConfig = currentStep.config || {};

      switch (currentStep.tipo) {
        case 'send_email': {
          // Load email template
          if (stepConfig.template_id) {
            // Check unsubscribe
            if (contact.email) {
              const { data: unsub } = await supabase
                .from('email_unsubscribes')
                .select('id')
                .eq('email', contact.email)
                .limit(1)
                .maybeSingle();

              if (unsub) {
                // Skip email, still advance
                const result = await advanceEnrollment(enrollment.id, automation.id, currentStep, automation);
                if (result === 'completed') completed++;
                processed++;
                continue;
              }
            }

            // Create email_sends record
            await supabase.from('email_sends').insert({
              template_id: stepConfig.template_id,
              contact_id: contact.id,
              email: contact.email,
              estado: 'queued',
              automation_id: automation.id,
              enrollment_id: enrollment.id,
              step_id: currentStep.id,
            });

            // Log activity
            await supabase.from('activities').insert({
              contact_id: contact.id,
              company_id: contact.company_id || null,
              tipo: 'email_automation_sent',
              titulo: `Email de automatización encolado: ${automation.nombre}`,
              metadata: {
                automation_id: automation.id,
                template_id: stepConfig.template_id,
                step_id: currentStep.id,
              },
              automatico: true,
            });
          }

          // Advance to next step
          const result = await advanceEnrollment(enrollment.id, automation.id, currentStep, automation);
          if (result === 'completed') completed++;
          processed++;
          break;
        }

        case 'wait': {
          const delayAmount = stepConfig.delay_amount || 1;
          const delayUnit = stepConfig.delay_unit || 'days';
          const delayMs = calculateDelay(delayAmount, delayUnit);
          const nextActionAt = new Date(Date.now() + delayMs).toISOString();

          // Find the next step
          const nextStep = await findNextStep(automation.id, currentStep);

          if (nextStep) {
            await supabase
              .from('automation_enrollments')
              .update({
                current_step_id: nextStep.id,
                next_action_at: nextActionAt,
              })
              .eq('id', enrollment.id);
          } else {
            // No next step after wait — complete
            await supabase
              .from('automation_enrollments')
              .update({
                estado: 'completado',
                completed_at: new Date().toISOString(),
                next_action_at: null,
              })
              .eq('id', enrollment.id);

            await supabase
              .from('automations')
              .update({ total_completed: (automation.total_completed || 0) + 1 })
              .eq('id', automation.id);

            completed++;
          }

          processed++;
          // DON'T process further this tick
          break;
        }

        case 'if_then': {
          const condition = stepConfig.condition;
          let branchKey = 'no';

          if (condition) {
            const result = evaluateCondition(condition, contact, company);
            branchKey = result ? 'yes' : 'no';
          }

          // Find child step for this branch
          const { data: branchStep } = await supabase
            .from('automation_steps')
            .select('*')
            .eq('automation_id', automation.id)
            .eq('parent_step_id', currentStep.id)
            .eq('branch_key', branchKey)
            .order('orden', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (branchStep) {
            await supabase
              .from('automation_enrollments')
              .update({
                current_step_id: branchStep.id,
                next_action_at: new Date().toISOString(),
              })
              .eq('id', enrollment.id);
          } else {
            // No children for this branch — advance to next sibling
            const advResult = await advanceEnrollment(enrollment.id, automation.id, currentStep, automation);
            if (advResult === 'completed') completed++;
          }

          processed++;
          break;
        }

        case 'set_property': {
          const propName = stepConfig.property;
          const propValue = stepConfig.value;
          const target = stepConfig.target || 'contact'; // 'contact' or 'company'

          if (propName) {
            if (target === 'company' && contact.company_id) {
              await supabase
                .from('companies')
                .update({ [propName]: propValue })
                .eq('id', contact.company_id);
            } else {
              await supabase
                .from('contacts')
                .update({ [propName]: propValue })
                .eq('id', contact.id);
            }
          }

          const result = await advanceEnrollment(enrollment.id, automation.id, currentStep, automation);
          if (result === 'completed') completed++;
          processed++;
          break;
        }

        case 'create_task': {
          // Insert into tasks table if it exists
          const { error: taskErr } = await supabase.from('tasks').insert({
            titulo: stepConfig.titulo || `Tarea de automatización: ${automation.nombre}`,
            descripcion: stepConfig.descripcion || null,
            contact_id: contact.id,
            company_id: contact.company_id || null,
            tipo: stepConfig.task_type || 'seguimiento',
            prioridad: stepConfig.prioridad || 'media',
            assigned_to: stepConfig.assigned_to || null,
            due_date: stepConfig.due_days
              ? new Date(Date.now() + stepConfig.due_days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
              : null,
            metadata: { automation_id: automation.id, step_id: currentStep.id },
          });

          // If tasks table doesn't exist, just skip silently
          if (taskErr && !taskErr.message.includes('relation')) {
            // Log but don't fail
          }

          const result = await advanceEnrollment(enrollment.id, automation.id, currentStep, automation);
          if (result === 'completed') completed++;
          processed++;
          break;
        }

        case 'send_notification': {
          const message = stepConfig.message || `Notificación de automatización: ${automation.nombre}`;

          await supabase.from('activities').insert({
            contact_id: contact.id,
            company_id: contact.company_id || null,
            tipo: 'automation_notification',
            titulo: message,
            metadata: {
              automation_id: automation.id,
              step_id: currentStep.id,
              notification_type: stepConfig.notification_type || 'internal',
            },
            automatico: true,
          });

          const result = await advanceEnrollment(enrollment.id, automation.id, currentStep, automation);
          if (result === 'completed') completed++;
          processed++;
          break;
        }

        default: {
          // Unknown step type — advance past it
          const result = await advanceEnrollment(enrollment.id, automation.id, currentStep, automation);
          if (result === 'completed') completed++;
          processed++;
          break;
        }
      }
    } catch (err: any) {
      errors++;
      console.error(`Error processing enrollment ${enrollment.id}:`, err?.message || err);
    }
  }

  return new Response(JSON.stringify({
    processed,
    completed,
    errors,
    timestamp: new Date().toISOString(),
  }));
};
