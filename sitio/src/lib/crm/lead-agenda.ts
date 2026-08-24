/**
 * Qué reunión toca agendarle a un lead según en qué peldaño va.
 *
 * Hay siete tipos configurados, pero cuatro —capacitación, consultoría,
 * personalización, configuración— son de cliente ya firmado y no tienen por qué
 * ofrecérsele a alguien que todavía no compra. Quedan tres, y cuál toca no es
 * una decisión: se deduce de la etapa igual que la etapa se deduce de hechos.
 *
 * Esto no existía. El botón estaba fijo en `/agendar/demo`, y por eso las tres
 * únicas reuniones que hay en la base son las tres «Demo personalizada»: no
 * porque solo se den demos, sino porque era lo único que la ficha sabía ofrecer.
 */
import type { Etapa } from './lead-etapa';

export type TipoAgenda = { slug: string; porque: string };

const DEMO: TipoAgenda = { slug: 'demo', porque: 'todavía no ve el producto' };
const SEGUIMIENTO: TipoAgenda = { slug: 'seguimiento', porque: 'ya lo vio y faltan dudas y alcance' };
const COTIZACION: TipoAgenda = { slug: 'cotizacion', porque: 'ya tiene número y hay que defenderlo' };

const POR_ETAPA: Record<Etapa, TipoAgenda> = {
  nuevo: DEMO,
  contactado: DEMO,
  calificado: DEMO,
  agendado: SEGUIMIENTO,
  demo_hecha: SEGUIMIENTO,
  cotizado: COTIZACION,
  negociando: COTIZACION,
  cliente: SEGUIMIENTO,
  perdido: SEGUIMIENTO,
};

export function agendaDeEtapa(etapa?: Etapa | null): TipoAgenda {
  return (etapa && POR_ETAPA[etapa]) || DEMO;
}

/** Los tipos que sí se le ofrecen a un lead. El resto son de cliente firmado. */
export const SLUGS_DE_LEAD = ['demo', 'seguimiento', 'cotizacion'];
