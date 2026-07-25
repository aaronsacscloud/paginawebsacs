// Cola de ONBOARDING post-gane — única fuente (antes vivía dentro de
// mark-accepted.ts y solo la disparaba aceptar cotización; ahora también la
// dispara ganar la oportunidad). Las tareas viven en `activities` tipo 'tarea'
// con metadata { task, category:'onboarding', step, due_at, done }.
// IDEMPOTENTE: si la company ya tiene tareas de onboarding, no re-encola.
import { supabase } from '../supabase';

const TASKS = [
  { titulo: 'Activar cuenta del cliente', due_in_hours: 24, step: 'activar_cuenta' },
  { titulo: 'Enviar email de bienvenida', due_in_hours: 2, step: 'email_bienvenida', auto: true },
  { titulo: 'Agendar llamada de onboarding', due_in_hours: 72, step: 'onboarding_call' },
  { titulo: 'Verificar primer corte / primeras ventas', due_in_hours: 24 * 7, step: 'primer_uso' },
];

export async function enqueueOnboarding(companyId: string | null, contactId: string | null, dealId: string | null): Promise<boolean> {
  if (!companyId) return false;
  // Idempotencia: ¿ya hay tareas de onboarding para esta company?
  const { data: previa } = await supabase.from('activities').select('id')
    .eq('company_id', companyId).eq('tipo', 'tarea')
    .contains('metadata', { category: 'onboarding' }).limit(1).maybeSingle();
  if (previa) return false;

  // Un solo insert batch: minimiza la ventana del race si "ganar el deal" y
  // "aceptar la cotización" llegan casi simultáneos (check-then-insert sin
  // constraint único en BD). Re-check inmediato antes de insertar.
  const { data: previa2 } = await supabase.from('activities').select('id')
    .eq('company_id', companyId).eq('tipo', 'tarea')
    .contains('metadata', { category: 'onboarding' }).limit(1).maybeSingle();
  if (previa2) return false;

  const now = Date.now();
  const { error } = await supabase.from('activities').insert(TASKS.map(t => ({
    contact_id: contactId, company_id: companyId, deal_id: dealId,
    tipo: 'tarea', titulo: t.titulo, automatico: true,
    metadata: {
      task: true, category: 'onboarding', step: t.step, done: false,
      due_in_hours: t.due_in_hours,
      due_at: new Date(now + t.due_in_hours * 3600000).toISOString(),
      ...(t.auto ? { auto: true } : {}),
    },
  })));
  if (error) { console.warn('[onboarding] insert falló:', error.message); return false; }
  return true;
}
