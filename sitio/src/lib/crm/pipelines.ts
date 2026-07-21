// Pipelines configurables del CRM. Un pipeline por TIPO (lead/oportunidad/cliente),
// con etapas en JSONB. Campo aditivo `pipeline_stage` en contacts/companies/deals:
// NO reemplaza lifecycle_stage/deals.stage/estado_cuenta (que mueven ARR/comisiones),
// es una dimensión organizativa configurable para las vistas Kanban.
import { supabase } from '../supabase';

export type Stage = { key: string; label: string; color: string };
export type Pipeline = { id?: string; tipo: 'lead' | 'oportunidad' | 'cliente'; nombre: string; stages: Stage[]; activo?: boolean };

export const TIPOS: Pipeline['tipo'][] = ['lead', 'oportunidad', 'cliente'];
export const TIPO_LABEL: Record<string, string> = { lead: 'Leads (contactos)', oportunidad: 'Oportunidades', cliente: 'Clientes' };

// Defaults sensatos — sirven de fallback si la tabla aún no existe (mismo patrón
// que plans.ts) y de semilla inicial.
export const DEFAULT_PIPELINES: Pipeline[] = [
  { tipo: 'lead', nombre: 'Prospección', stages: [
    { key: 'nuevo', label: 'Nuevo', color: '#64748B' },
    { key: 'contactado', label: 'Contactado', color: '#4B7BE5' },
    { key: 'calificado', label: 'Calificado', color: '#7c3aed' },
    { key: 'nutriendo', label: 'Nutriendo', color: '#0891b2' },
    { key: 'descartado', label: 'Descartado', color: '#94a3b8' },
  ] },
  { tipo: 'oportunidad', nombre: 'Ventas', stages: [
    { key: 'calificacion', label: 'Calificación', color: '#64748B' },
    { key: 'demo_agendada', label: 'Demo agendada', color: '#4B7BE5' },
    { key: 'demo_realizada', label: 'Demo realizada', color: '#6C5CE7' },
    { key: 'cotizacion_enviada', label: 'Cotización enviada', color: '#0891b2' },
    { key: 'negociacion', label: 'Negociación', color: '#E8A838' },
    { key: 'cerrada_ganada', label: 'Ganada', color: '#1A8F7A' },
    { key: 'cerrada_perdida', label: 'Perdida', color: '#E54B4B' },
  ] },
  { tipo: 'cliente', nombre: 'Ciclo de vida', stages: [
    { key: 'onboarding', label: 'Onboarding', color: '#4B7BE5' },
    { key: 'activo', label: 'Activo', color: '#1A8F7A' },
    { key: 'expansion', label: 'En expansión', color: '#7c3aed' },
    { key: 'riesgo', label: 'En riesgo', color: '#E8A838' },
    { key: 'recuperar', label: 'Recuperar', color: '#E54B4B' },
  ] },
];

export function defaultFor(tipo: string): Pipeline {
  return DEFAULT_PIPELINES.find(p => p.tipo === tipo) || DEFAULT_PIPELINES[0];
}

// Lee los 3 pipelines. Si la tabla no existe (SQL pendiente) o falta alguno,
// completa con los defaults — así la UI siempre tiene los 3 tipos.
export async function getPipelines(): Promise<Pipeline[]> {
  const { data, error } = await supabase.from('pipelines').select('id, tipo, nombre, stages, activo');
  const rows: Pipeline[] = (!error && data) ? (data as any[]).map(r => ({ ...r, stages: Array.isArray(r.stages) ? r.stages : [] })) : [];
  return TIPOS.map(t => rows.find(r => r.tipo === t) || defaultFor(t));
}
