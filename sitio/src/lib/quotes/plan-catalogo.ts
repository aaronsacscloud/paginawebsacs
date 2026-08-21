// De un nombre de plan escrito a mano, al catálogo real.
//
// Los documentos que recibe el cliente —cotización, acuse, estado de cuenta—
// tienen que decir lo MISMO sobre qué incluye su plan. Antes cada uno lo
// resolvía por su cuenta y era cuestión de tiempo que se desincronizaran.
//
// El nombre de la suscripción se captura a mano y en producción existe de
// veinte formas: "Licencia Vende Mensual", "Plan Controla Anual", "controla",
// "Licencia Controla ( 3 sucursales)". Por eso se detecta por palabra clave y
// no por igualdad: lo que importa es cuál de los cuatro planes es.
import { plans } from '../../data/plans';

export type PlanCatalogo = (typeof plans)[number];

/** Sin acentos y en minúsculas: "Licencia Vende Mensual" → "licencia vende mensual". */
const normaliza = (s?: string | null) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * El plan del catálogo que corresponde a un texto libre.
 * Devuelve null cuando no es uno de los planes —una licencia vitalicia legacy,
 * un plugin suelto, una licencia personalizada—: en esos casos es mejor no
 * mostrar nada que mostrar el catálogo equivocado.
 */
export function detectaPlan(texto?: string | null): PlanCatalogo | null {
  const t = normaliza(texto);
  if (!t) return null;
  // Del más específico al más general: "fideliza y multiplica" contiene
  // "fideliza", pero ninguno contiene a otro, así que el orden es solo por
  // frecuencia de uso.
  for (const id of ['fideliza', 'automatiza', 'controla', 'vende']) {
    if (t.includes(id)) return plans.find(p => p.id === id) || null;
  }
  return null;
}

/**
 * Las áreas del plan CON lo que hereda de los planes de abajo: quien compra
 * Controla también tiene lo de Vende, y verlo separado no le dice nada.
 * El orden va del plan base hacia arriba, que es como se leyó al venderlo.
 */
export function areasDePlan(plan: PlanCatalogo | null): { category: string; items: string[] }[] {
  if (!plan) return [];
  const out: { category: string; items: string[] }[] = [];
  let cur: any = plan;
  const visto = new Set<string>();
  while (cur && !visto.has(cur.id)) {
    visto.add(cur.id);
    for (const f of cur.features) {
      if (f && typeof f === 'object' && 'category' in f) out.push(f as any);
    }
    cur = cur.inheritsFrom ? plans.find(p => p.name === cur.inheritsFrom) : undefined;
  }
  return out.reverse();
}

/** Cuántas funciones trae el plan en total — para el resumen de una línea. */
export const totalFunciones = (areas: { items: string[] }[]) =>
  areas.reduce((n, a) => n + a.items.length, 0);
