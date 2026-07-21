// Catálogo de planes: fuente única para normalizar suscripciones contra la tabla
// `plans`. Lo usan la creación de sub desde cotización (mark-accepted) y el
// backfill de subs viejas. Así "Licencia Controla Anual", "licencia controla",
// "licencia controla( 1 suc)"… caen todas bajo el plan canónico Controla.
import { supabase } from '../supabase';

export type PlanRow = {
  id: string; slug: string; nombre: string;
  precio_mensual: number | null; precio_anual: number | null; a_la_medida: boolean;
};

export async function getPlans(): Promise<PlanRow[]> {
  const { data } = await supabase.from('plans')
    .select('id, slug, nombre, precio_mensual, precio_anual, a_la_medida')
    .eq('activo', true);
  return (data as PlanRow[]) || [];
}

// Matchea un texto/slug de plan al catálogo. Prioriza el slug exacto (los ítems
// de cotización guardan el slug en `nombre`), luego que el texto contenga el
// slug (o el slug con espacios), luego el nombre del catálogo. Conservador:
// devuelve null si no hay match claro (mejor sin ligar que mal ligado).
export function matchPlan(plans: PlanRow[], texto: string | null | undefined): PlanRow | null {
  if (!plans.length) return null;
  const t = String(texto || '').toLowerCase().trim();
  if (!t) return null;
  const bySlug = plans.find(p => p.slug === t);
  if (bySlug) return bySlug;
  // slug más largo primero para que 'automatiza' gane sobre coincidencias cortas
  const ordered = [...plans].sort((a, b) => b.slug.length - a.slug.length);
  const cont = ordered.find(p => p.slug && (t.includes(p.slug) || t.includes(p.slug.replace(/_/g, ' '))));
  if (cont) return cont;
  const byNombre = ordered.find(p => { const n = p.nombre.toLowerCase().replace(/^plan\s+/, '').trim(); return n && t.includes(n); });
  if (byNombre) return byNombre;
  // Tolerancia a typos/truncados: contiene la RAÍZ del slug (primeros 6 chars).
  // "control(a)" → contro, "fideliz(a)" → fideli, "soporte…" → soport. Raíces
  // distintivas, no producen falsos positivos con los otros planes.
  const byStem = ordered.find(p => p.slug.length >= 6 && t.includes(p.slug.slice(0, 6)));
  return byStem || null;
}

export function precioLista(plan: PlanRow | null, ciclo: string): number | null {
  if (!plan || plan.a_la_medida) return null;
  return ciclo === 'anual' ? plan.precio_anual : plan.precio_mensual;
}

// Nombre canónico para mostrar/guardar: "Plan Controla" + ciclo → "Controla Anual".
export function nombreCanonico(plan: PlanRow, ciclo: string): string {
  const base = plan.nombre.replace(/^plan\s+/i, '').trim();
  return base + (ciclo === 'anual' ? ' Anual' : ' Mensual');
}
