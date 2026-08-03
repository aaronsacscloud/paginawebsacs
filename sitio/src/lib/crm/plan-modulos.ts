// ═══ ¿El cliente usa módulos que su plan no cubre? ═══
//
// Cruza lo que el cliente REALMENTE opera en SACS (companies.uso_sacs.modulos,
// que llena el cron) contra lo que su plan incluye (tabla crm_plan_modulos).
// De ahí salen las dos caras del mismo dato: upsell (usa de más) y riesgo de
// churn (paga de más y no lo usa).
//
// El cálculo es DETERMINISTA a propósito. Mapear 17 módulos contra 5 planes es
// un conjunto cerrado y estable; resolverlo con un modelo en cada corrida del
// cron sería lento, caro y —lo peor— no determinista: el mismo cliente podría
// entrar y salir de tus oportunidades sin que cambie nada real, y una señal que
// parpadea deja de creerse. La IA se usa donde sí aporta: proponer el catálogo
// la primera vez, redactar el mensaje de venta y clasificar módulos nuevos.
//
// ⚠️ Este archivo es PURO: lo importa lib/crm/senales.ts, que corre también en
// el navegador. El cargador que pega a la BD vive en plan-modulos-db.ts — si se
// importara supabase aquí, se iría entero al bundle del cliente.

export type CatalogoPlanes = {
  /** plan_slug → { modulo → incluido } */
  porPlan: Record<string, Record<string, boolean>>;
  /** módulos que se venden como plugin aparte: modulo → plugin_slug */
  plugins: Record<string, string>;
  /** módulos cuya asignación aún no confirma un humano */
  porConfirmar: Set<string>;
};

/* ── Plan base contratado ─────────────────────────────────────────────────
 * Se DERIVA de las suscripciones activas en vez de leerse de companies.plan:
 * esa columna está vacía en 139 de 218 empresas y, cuando se llena a mano, se
 * desfasa en cuanto el cliente cambia de plan. La suscripción es la verdad.
 *
 * Si el cliente tiene varias, gana la de tier más alto: es lo que paga. */
const TIER: Record<string, number> = { vende: 1, controla: 2, fideliza: 3, automatiza: 4 };

export function planDeNombre(nombre?: string | null, ciclo?: string | null): string | null {
  const n = String(nombre || '').toLowerCase();
  if (ciclo === 'vitalicia' || /vitalic/.test(n)) return 'vitalicia';
  if (/automatiza/.test(n)) return 'automatiza';
  if (/fideliz/.test(n)) return 'fideliza';
  if (/controla/.test(n)) return 'controla';
  if (/vende/.test(n)) return 'vende';
  return null; // plugins, "soporte premium", licencias personalizadas…
}

/** Plan base del cliente a partir de sus suscripciones activas (null si ninguna
 *  corresponde a un plan base: personalizadas y plugins sueltos no se juzgan). */
export function planBase(subsActivas: any[]): string | null {
  const planes = (subsActivas || [])
    .map(s => planDeNombre(s?.nombre_plan, s?.ciclo))
    .filter(Boolean) as string[];
  if (!planes.length) return null;
  // Vitalicia solo gana si no hay ningún plan de la escalera: si el cliente
  // además paga un plan recurrente, ese es el que manda.
  const escalera = planes.filter(p => TIER[p]);
  if (escalera.length) return escalera.sort((a, b) => TIER[b] - TIER[a])[0];
  return planes.includes('vitalicia') ? 'vitalicia' : null;
}

/** Slugs de plugin que el cliente tiene contratados (para no cobrarle de más
 *  una oportunidad que ya pagó). */
export function pluginsContratados(subsActivas: any[]): Set<string> {
  const out = new Set<string>();
  for (const s of subsActivas || []) {
    const n = String(s?.nombre_plan || '').toLowerCase();
    if (/evento|salon/.test(n)) out.add('plugin_eventos');
    if (/reparacion|taller|orden(es)? de servicio/.test(n)) out.add('plugin_ordenes_servicio');
    // Un "plugin VIP"/"plugins & add ons" no dice cuál: se trata como comodín y
    // silencia el aviso de plugins, que es preferible a inventar un upsell.
    if (/plugin/.test(n)) { out.add('plugin_eventos'); out.add('plugin_ordenes_servicio'); }
  }
  return out;
}

export type ModuloFuera = { modulo: string; docs_30d: number; total: number; es_plugin: boolean; por_confirmar: boolean };

/**
 * Módulos que el cliente OPERA y su plan no cubre.
 *
 * Umbral: `docs_30d > 0`, no la bandera `usa` que manda sacs_api — esa es
 * `total > 0`, así que un solo documento de hace tres años marcaría el módulo
 * como en uso y generaría un upsell falso. Aquí solo cuenta lo que se movió
 * este mes.
 */
export function modulosFueraDePlan(
  plan: string | null,
  usoModulos: any[] | null | undefined,
  plugins: Set<string>,
  cat: CatalogoPlanes,
): ModuloFuera[] {
  if (!plan || !cat.porPlan[plan] || !Array.isArray(usoModulos)) return [];
  const permitidos = cat.porPlan[plan];
  const out: ModuloFuera[] = [];
  for (const m of usoModulos) {
    const nombre = m?.modulo;
    if (!nombre) continue;
    if (Number(m.docs_30d || 0) <= 0) continue;      // no lo está usando ahora
    if (permitidos[nombre] !== false) continue;      // incluido, o módulo que no conocemos
    const pluginSlug = cat.plugins[nombre];
    if (pluginSlug && plugins.has(pluginSlug)) continue; // compró el add-on: está en su derecho
    out.push({
      modulo: nombre,
      docs_30d: Number(m.docs_30d || 0),
      total: Number(m.total || 0),
      es_plugin: !!pluginSlug,
      por_confirmar: cat.porConfirmar.has(nombre),
    });
  }
  return out.sort((a, b) => b.docs_30d - a.docs_30d);
}

/** Precio de lista anual, para poner número al upsell. */
export const ARR_PLAN: Record<string, number> = { vende: 6000, controla: 9000, fideliza: 14000, automatiza: 59000 };

/** Plan mínimo que cubriría TODOS los módulos que hoy usa fuera de su plan. */
export function planQueLoCubre(fuera: ModuloFuera[], cat: CatalogoPlanes): string | null {
  const necesarios = fuera.filter(f => !f.es_plugin).map(f => f.modulo);
  if (!necesarios.length) return null;
  for (const p of ['controla', 'fideliza', 'automatiza']) {
    const inc = cat.porPlan[p];
    if (inc && necesarios.every(m => inc[m])) return p;
  }
  return null;
}
