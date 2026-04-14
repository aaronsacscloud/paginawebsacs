import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

// ── Helper: lookup email template by name ─────────────────────────────

async function getTemplateId(nombre: string): Promise<string | null> {
  const { data } = await supabase
    .from('email_templates')
    .select('id')
    .ilike('nombre', `%${nombre}%`)
    .eq('activo', true)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

// ── Helper: create automation with steps ──────────────────────────────

async function createAutomation(
  config: {
    nombre: string;
    descripcion: string;
    tipo: string;
    enrollment_triggers: any;
    goal_criteria?: any;
    suppression_stages?: string[];
  },
  steps: Array<{
    orden: number;
    tipo: string;
    config: any;
    parent_step_id?: string | null;
    branch_key?: string | null;
  }>
): Promise<{ automation: any; steps: any[] }> {
  const { data: automation, error: autoErr } = await supabase
    .from('automations')
    .insert({
      nombre: config.nombre,
      descripcion: config.descripcion,
      tipo: config.tipo,
      estado: 'borrador',
      enrollment_triggers: config.enrollment_triggers,
      goal_criteria: config.goal_criteria || null,
      suppression_stages: config.suppression_stages || null,
    })
    .select()
    .single();

  if (autoErr || !automation) {
    throw new Error(`Failed to create automation ${config.nombre}: ${autoErr?.message}`);
  }

  const createdSteps: any[] = [];
  for (const step of steps) {
    const { data: stepData, error: stepErr } = await supabase
      .from('automation_steps')
      .insert({
        automation_id: automation.id,
        orden: step.orden,
        tipo: step.tipo,
        config: step.config,
        parent_step_id: step.parent_step_id || null,
        branch_key: step.branch_key || null,
      })
      .select()
      .single();

    if (stepErr) {
      throw new Error(`Failed to create step ${step.orden} for ${config.nombre}: ${stepErr.message}`);
    }

    createdSteps.push(stepData);
  }

  return { automation, steps: createdSteps };
}

// ── GET — seed automations ────────────────────────────────────────────

export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key');
  if (key !== 'sacs-seed-2026') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    // Look up template IDs by name
    const bienvenidaId = await getTemplateId('Bienvenida');
    const casoExitoId = await getTemplateId('Caso de Éxito');
    const seguimientoDemoId = await getTemplateId('Seguimiento Demo');
    const newsletterId = await getTemplateId('Newsletter');
    const reactivacionId = await getTemplateId('Reactivación');

    const results: any[] = [];

    // ── 1. Bienvenida Lead ──────────────────────────────────────────

    const auto1 = await createAutomation(
      {
        nombre: 'Bienvenida Lead',
        descripcion: 'Secuencia de bienvenida para nuevos leads. Envía emails de introducción, caso de éxito y seguimiento para agendar demo.',
        tipo: 'lifecycle',
        enrollment_triggers: {
          type: 'lifecycle_stage_change',
          conditions: [
            { property: 'lifecycle_stage', operator: 'eq', value: 'lead' },
          ],
        },
        goal_criteria: {
          conditions: [
            { property: 'lifecycle_stage', operator: 'eq', value: 'oportunidad' },
          ],
        },
        suppression_stages: ['cliente', 'churned'],
      },
      [
        {
          orden: 1,
          tipo: 'send_email',
          config: { template_id: bienvenidaId, description: 'Email de bienvenida' },
        },
        {
          orden: 2,
          tipo: 'wait',
          config: { delay_amount: 1, delay_unit: 'days', description: 'Esperar 1 día' },
        },
        {
          orden: 3,
          tipo: 'send_email',
          config: { template_id: casoExitoId, description: 'Caso de éxito' },
        },
        {
          orden: 4,
          tipo: 'wait',
          config: { delay_amount: 3, delay_unit: 'days', description: 'Esperar 3 días' },
        },
        {
          orden: 5,
          tipo: 'send_email',
          config: { template_id: seguimientoDemoId, description: 'Seguimiento demo' },
        },
      ]
    );
    results.push({ name: auto1.automation.nombre, id: auto1.automation.id, steps: auto1.steps.length });

    // ── 2. Nurture MQL ──────────────────────────────────────────────

    const auto2 = await createAutomation(
      {
        nombre: 'Nurture MQL',
        descripcion: 'Nurturing para leads calificados. Envía contenido de valor y seguimiento para convertir en oportunidad.',
        tipo: 'lifecycle',
        enrollment_triggers: {
          type: 'lifecycle_stage_change',
          conditions: [
            { property: 'lifecycle_stage', operator: 'eq', value: 'lead_calificado' },
          ],
        },
        goal_criteria: {
          conditions: [
            { property: 'lifecycle_stage', operator: 'eq', value: 'oportunidad' },
          ],
        },
        suppression_stages: ['cliente', 'churned'],
      },
      [
        {
          orden: 1,
          tipo: 'send_email',
          config: { template_id: casoExitoId, description: 'Caso de éxito' },
        },
        {
          orden: 2,
          tipo: 'wait',
          config: { delay_amount: 3, delay_unit: 'days', description: 'Esperar 3 días' },
        },
        {
          orden: 3,
          tipo: 'send_email',
          config: { template_id: seguimientoDemoId, description: 'Seguimiento demo' },
        },
        {
          orden: 4,
          tipo: 'wait',
          config: { delay_amount: 5, delay_unit: 'days', description: 'Esperar 5 días' },
        },
        {
          orden: 5,
          tipo: 'send_email',
          config: { template_id: bienvenidaId, description: 'Email de valor general' },
        },
      ]
    );
    results.push({ name: auto2.automation.nombre, id: auto2.automation.id, steps: auto2.steps.length });

    // ── 3. Onboarding Cliente ───────────────────────────────────────

    const auto3 = await createAutomation(
      {
        nombre: 'Onboarding Cliente',
        descripcion: 'Secuencia de onboarding para nuevos clientes. Bienvenida, tips de uso y contenido educativo.',
        tipo: 'onboarding',
        enrollment_triggers: {
          type: 'lifecycle_stage_change',
          conditions: [
            { property: 'lifecycle_stage', operator: 'eq', value: 'cliente' },
          ],
        },
        suppression_stages: ['churned'],
      },
      [
        {
          orden: 1,
          tipo: 'send_email',
          config: { template_id: bienvenidaId, description: 'Bienvenida cliente' },
        },
        {
          orden: 2,
          tipo: 'wait',
          config: { delay_amount: 2, delay_unit: 'days', description: 'Esperar 2 días' },
        },
        {
          orden: 3,
          tipo: 'send_email',
          config: { template_id: casoExitoId, description: 'Caso de éxito' },
        },
        {
          orden: 4,
          tipo: 'wait',
          config: { delay_amount: 5, delay_unit: 'days', description: 'Esperar 5 días' },
        },
        {
          orden: 5,
          tipo: 'send_email',
          config: { template_id: newsletterId, description: 'Newsletter educativo' },
        },
      ]
    );
    results.push({ name: auto3.automation.nombre, id: auto3.automation.id, steps: auto3.steps.length });

    // ── 4. Re-engagement ────────────────────────────────────────────

    const auto4 = await createAutomation(
      {
        nombre: 'Re-engagement',
        descripcion: 'Secuencia de re-engagement para contactos con lead score bajo. Reactivación y contenido de valor.',
        tipo: 'reenganche',
        enrollment_triggers: {
          type: 'property_change',
          conditions: [
            { property: 'lead_score', operator: 'lte', value: 20 },
          ],
        },
        suppression_stages: ['cliente'],
      },
      [
        {
          orden: 1,
          tipo: 'send_email',
          config: { template_id: reactivacionId, description: 'Email de reactivación' },
        },
        {
          orden: 2,
          tipo: 'wait',
          config: { delay_amount: 5, delay_unit: 'days', description: 'Esperar 5 días' },
        },
        {
          orden: 3,
          tipo: 'send_email',
          config: { template_id: casoExitoId, description: 'Caso de éxito' },
        },
        {
          orden: 4,
          tipo: 'wait',
          config: { delay_amount: 7, delay_unit: 'days', description: 'Esperar 7 días' },
        },
        {
          orden: 5,
          tipo: 'send_email',
          config: { template_id: seguimientoDemoId, description: 'Seguimiento demo' },
        },
      ]
    );
    results.push({ name: auto4.automation.nombre, id: auto4.automation.id, steps: auto4.steps.length });

    // ── 5. Churn Prevention ─────────────────────────────────────────

    const auto5 = await createAutomation(
      {
        nombre: 'Churn Prevention',
        descripcion: 'Prevención de churn. Notificación interna inmediata y secuencia de reactivación para recuperar al cliente.',
        tipo: 'lifecycle',
        enrollment_triggers: {
          type: 'lifecycle_stage_change',
          conditions: [
            { property: 'lifecycle_stage', operator: 'eq', value: 'churned' },
          ],
        },
        goal_criteria: {
          conditions: [
            { property: 'lifecycle_stage', operator: 'eq', value: 'cliente' },
          ],
        },
      },
      [
        {
          orden: 1,
          tipo: 'send_notification',
          config: {
            message: 'ALERTA: Cliente en riesgo de churn. Contactar inmediatamente.',
            notification_type: 'urgent',
            description: 'Notificación urgente de churn',
          },
        },
        {
          orden: 2,
          tipo: 'send_email',
          config: { template_id: reactivacionId, description: 'Email de reactivación' },
        },
        {
          orden: 3,
          tipo: 'wait',
          config: { delay_amount: 7, delay_unit: 'days', description: 'Esperar 7 días' },
        },
        {
          orden: 4,
          tipo: 'send_email',
          config: { template_id: casoExitoId, description: 'Caso de éxito' },
        },
      ]
    );
    results.push({ name: auto5.automation.nombre, id: auto5.automation.id, steps: auto5.steps.length });

    return new Response(JSON.stringify({
      success: true,
      automations: results,
      templates_found: {
        bienvenida: !!bienvenidaId,
        caso_exito: !!casoExitoId,
        seguimiento_demo: !!seguimientoDemoId,
        newsletter: !!newsletterId,
        reactivacion: !!reactivacionId,
      },
    }), { status: 201 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
