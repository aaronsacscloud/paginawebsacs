import { z } from 'zod';
import { defineTool } from '../define';
import { PLANS, SERVICES, getDefaultServicesForVertical, computeServicePrice } from '../../../data/catalog';

export const getPlans = defineTool({
  name: 'catalog.get_plans',
  description: 'Retrieve all SACS subscription plans (controla/fideliza/automatiza) with prices and features.',
  readonly: true,
  action_type: 'read_catalog',
  schema: z.object({}),
  handler: async () => {
    return PLANS;
  },
});

export const getServices = defineTool({
  name: 'catalog.get_services',
  description: 'Retrieve all SACS one-time or recurring services (implementación, migración, etc.) with base prices.',
  readonly: true,
  action_type: 'read_catalog',
  schema: z.object({
    tipo: z.enum(['unico', 'recurrente']).optional(),
  }),
  handler: async ({ tipo }) => {
    if (tipo) return SERVICES.filter(s => s.tipo === tipo);
    return SERVICES;
  },
});

export const recommendServices = defineTool({
  name: 'catalog.recommend_services',
  description: 'Given a vertical (moda/farmacia/etc.) and number of sucursales, recommend default services with computed prices.',
  readonly: true,
  action_type: 'read_catalog',
  schema: z.object({
    vertical: z.string(),
    sucursales: z.number().int().positive().optional(),
  }),
  handler: async ({ vertical, sucursales = 1 }) => {
    const services = getDefaultServicesForVertical(vertical);
    return services.map(s => ({
      id: s.id,
      nombre: s.nombre,
      tipo: s.tipo,
      precio_calculado: computeServicePrice(s, vertical, sucursales),
      descripcion: s.descripcion,
    }));
  },
});
