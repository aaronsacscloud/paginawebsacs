// El catálogo ÚNICO de lifecycle_stage (etapa del ciclo de vida de un contacto).
//
// Hasta hoy había 4 copias divergentes en componentes (ContactProfile,
// PipelineTab, AutomationsTab, LeadsTab/LeadDrawer). El inbox de WhatsApp no
// iba a ser la 5ª: esta es la fuente; los componentes viejos se migran cuando
// se toquen. Los VALORES son los que ya viven en contacts.lifecycle_stage —
// no inventar ni renombrar ids, hay datos reales guardados con ellos.
//
// No confundir con pipeline_stage (dimensión aditiva configurable, tabla
// pipelines) ni con la etapa DERIVADA de src/lib/crm/lead-etapa.ts.

export type LifecycleStage = {
  id: string;
  label: string;
  bg: string;   // pastel: la forma (chip)
  fg: string;   // tinta: el texto
};

export const LIFECYCLE: LifecycleStage[] = [
  { id: 'suscriptor',      label: 'Suscriptor',  bg: '#f4f4f6', fg: '#6B7280' },
  { id: 'lead',            label: 'Nuevo lead',  bg: '#f4f4f6', fg: '#6B7280' },
  { id: 'lead_calificado', label: 'Calificado',  bg: '#EEECFE', fg: '#5B4BD6' },
  { id: 'oportunidad',     label: 'Oportunidad', bg: '#E3EDFD', fg: '#2C5FC4' },
  { id: 'cliente',         label: 'Cliente',     bg: '#EAF8F2', fg: '#1E8A63' },
  { id: 'evangelista',     label: 'Evangelista', bg: '#EAF8F2', fg: '#1E8A63' },
  { id: 'churned',         label: 'Perdido',     bg: '#FEF0EF', fg: '#C0554E' },
];

export const lifecycleDe = (id?: string | null): LifecycleStage | null =>
  LIFECYCLE.find(e => e.id === id) || null;
