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
import { axoPlanes, esPlanAxo } from '../../data/axo-planes';

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
  // Los planes de AXO van primero: «AXO Super Power 20x» no es ninguna licencia.
  if (esPlanAxo(t)) return planAxoDe(t);
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
  // Un bloque por plan: se invierten los PLANES (el base primero), no las áreas de
  // cada uno, que conservan el orden en que se escribieron.
  const bloques: { category: string; items: string[] }[][] = [];
  let cur: any = plan;
  const visto = new Set<string>();
  while (cur && !visto.has(cur.id)) {
    visto.add(cur.id);
    bloques.push(cur.features.filter((f: any) => f && typeof f === 'object' && 'category' in f));
    cur = cur.inheritsFrom ? [...plans, ...axoPlanes].find(p => p.name === cur.inheritsFrom) : undefined;
  }
  return bloques.reverse().flat();
}

/** Cuántas funciones trae el plan en total — para el resumen de una línea. */
export const totalFunciones = (areas: { items: string[] }[]) =>
  areas.reduce((n, a) => n + a.items.length, 0);

/** El plan de AXO de un slug o nombre: «axo_super_power_20x», «AXO Super Power 20x mensual». */
function planAxoDe(t: string): PlanCatalogo | null {
  const slug = t.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  // Del id más largo al más corto: axo_super_power_20x contiene a axo_super_power.
  const orden = [...axoPlanes].sort((a, b) => b.id.length - a.id.length);
  return orden.find(p => slug === p.id || slug.startsWith(p.id + '_')) || null;
}

/** Un plan del catálogo por su id: licencias de SACS y planes de AXO. */
export function planDelCatalogo(id?: string | null): PlanCatalogo | null {
  const k = String(id || '').toLowerCase();
  if (!k) return null;
  return plans.find(p => p.id === k) || axoPlanes.find(p => p.id === k) || null;
}
