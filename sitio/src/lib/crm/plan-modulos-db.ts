// Carga del catálogo de planes desde la BD. SOLO SERVIDOR: se separa de
// plan-modulos.ts porque ese lo importa senales.ts, que corre también en el
// navegador — importar supabase allá se llevaría el cliente entero al bundle.
import { supabase } from '../supabase';
import type { CatalogoPlanes } from './plan-modulos';

let cache: { at: number; cat: CatalogoPlanes } | null = null;
const TTL_MS = 5 * 60 * 1000;

/** Carga el catálogo (cacheado 5 min). Devuelve null si la migración no corrió,
 *  y entonces el indicador simplemente no opina — mejor callar que inventar. */
export async function cargarCatalogo(): Promise<CatalogoPlanes | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.cat;
  try {
    const [pm, pl] = await Promise.all([
      supabase.from('crm_plan_modulos').select('plan_slug, modulo, incluido, confirmado'),
      supabase.from('crm_modulos_plugin').select('modulo, plugin_slug'),
    ]);
    if (pm.error || !pm.data?.length) return null;
    const cat: CatalogoPlanes = { porPlan: {}, plugins: {}, porConfirmar: new Set() };
    for (const r of pm.data) {
      (cat.porPlan[r.plan_slug] = cat.porPlan[r.plan_slug] || {})[r.modulo] = !!r.incluido;
      if (!r.confirmado) cat.porConfirmar.add(r.modulo);
    }
    for (const r of pl.data || []) cat.plugins[r.modulo] = r.plugin_slug;
    cache = { at: Date.now(), cat };
    return cat;
  } catch { return null; }
}

