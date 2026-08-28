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
  { id: 'descalificado',   label: 'Descalificado', bg: '#F1EFEF', fg: '#7A6E6C' },
  { id: 'rezagado',       label: 'Rezagado',    bg: '#FFF4E5', fg: '#9a6a10' },
];

export const lifecycleDe = (id?: string | null): LifecycleStage | null =>
  (CATALOGO as LifecycleStage[] | null || LIFECYCLE).find(e => e.id === id) || null;

// ── Catálogo DINÁMICO (crm_lifecycle_etapas) con las estáticas como fallback ──
// Los componentes usan useLifecycle(); lifecycleDe() consulta el mismo cache.
export type EtapaDinamica = LifecycleStage & { emoji: string; color: string; tipo: 'abierta' | 'ganada' | 'perdida'; orden: number; n?: number; sugerencias?: any[] };

const aTinta = (hex: string) => hex;
const aPastel = (hex: string) => {
  const h = hex.replace('#', ''); if (h.length !== 6) return '#f4f4f6';
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, 0.13)`;
};

let CATALOGO: EtapaDinamica[] | null = null;
let cargando: Promise<void> | null = null;
const subs = new Set<() => void>();

export async function cargarLifecycle(force = false): Promise<void> {
  if (CATALOGO && !force) return;
  if (cargando && !force) return cargando;
  cargando = fetch('/api/crm/lifecycle-etapas').then(r => r.json()).then(j => {
    if (Array.isArray(j.etapas) && j.etapas.length) {
      CATALOGO = j.etapas.map((e: any) => ({ id: e.id, label: e.nombre, emoji: e.emoji || '·', color: e.color || '#9B8CFA', bg: aPastel(e.color || '#9B8CFA'), fg: aTinta(e.color || '#6B7280'), tipo: e.tipo || 'abierta', orden: e.orden, n: e.n, sugerencias: e.sugerencias || [] }));
      subs.forEach(f => f());
    }
  }).catch(() => { /* fallback estático */ }).finally(() => { cargando = null; });
  return cargando;
}

import { useEffect, useState } from 'react';
export function useLifecycle(): EtapaDinamica[] {
  const [, setN] = useState(0);
  useEffect(() => { const f = () => setN(x => x + 1); subs.add(f); cargarLifecycle(); return () => { subs.delete(f); }; }, []);
  return CATALOGO || LIFECYCLE.map(e => ({ ...e, emoji: '·', color: e.fg, tipo: e.id === 'cliente' || e.id === 'evangelista' ? 'ganada' as const : e.id === 'churned' ? 'perdida' as const : 'abierta' as const, orden: 0 }));
}
