// GET /api/crm/arr/plans — catálogo de planes desde la BD (fuente única para
// todos los formularios del CRM: editar sub, crear sub, registrar pago).
// Fallback al catálogo hardcodeado de cotizaciones si la tabla aún no existe.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { PLAN_PRICES } from '../../../../lib/quotes/constants';

export const prerender = false;

const FALLBACK = [
  { slug: 'vende', nombre: 'Plan Vende', precio_mensual: 600, precio_anual: 6000, a_la_medida: false, categoria: 'plan', orden: 1 },
  { slug: 'controla', nombre: 'Plan Controla', precio_mensual: 900, precio_anual: 9000, a_la_medida: false, categoria: 'plan', orden: 2 },
  { slug: 'fideliza', nombre: 'Plan Fideliza', precio_mensual: 1400, precio_anual: 14000, a_la_medida: false, categoria: 'plan', orden: 3 },
  { slug: 'automatiza', nombre: 'Plan Automatiza', precio_mensual: 5900, precio_anual: 59000, a_la_medida: false, categoria: 'plan', orden: 4 },
  { slug: 'personalizada', nombre: 'Licencia personalizada', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plan', orden: 5 },
  { slug: 'soporte_premium', nombre: 'Soporte premium', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plan', orden: 6 },
  { slug: 'vitalicia_legacy', nombre: 'Licencia Vitalicia Legacy', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plan', orden: 7 },
];

// PLUGINS / MÓDULOS de SACS que se venden como suscripción propia (mensual o
// anual) y también suman al ARR. Precio a la medida (se pacta por cliente), el
// admin lo captura al crear/editar la suscripción — igual que "Licencia
// personalizada". Se inyectan SIEMPRE (haya o no tabla `plans`); si algún día
// se cargan en la BD con precio fijo, esa versión gana (dedupe por slug).
const PLUGINS = [
  { slug: 'plugin_ordenes_servicio', nombre: 'Órdenes de servicio', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plugin', orden: 101 },
  { slug: 'plugin_consignacion', nombre: 'Consignación', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plugin', orden: 102 },
  { slug: 'plugin_joyeria', nombre: 'Joyería', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plugin', orden: 103 },
  { slug: 'plugin_listas_escolares', nombre: 'Listas escolares', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plugin', orden: 104 },
  { slug: 'plugin_eventos', nombre: 'Eventos y reservaciones', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plugin', orden: 105 },
  { slug: 'plugin_nivelacion', nombre: 'Nivelación de inventario', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plugin', orden: 106 },
  { slug: 'plugin_ecommerce', nombre: 'Tienda en línea', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plugin', orden: 107 },
  { slug: 'plugin_facturacion', nombre: 'Facturación', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plugin', orden: 108 },
];

// Une catálogo base + plugins, deduplicando por slug (lo de la BD manda).
function conPlugins(base: any[]): any[] {
  const slugs = new Set(base.map(p => p.slug).filter(Boolean));
  const extra = PLUGINS.filter(p => !slugs.has(p.slug));
  return [...base, ...extra];
}

export const GET: APIRoute = async () => {
  const { data, error } = await supabase.from('plans')
    .select('id, slug, nombre, precio_mensual, precio_anual, a_la_medida, activo, orden, categoria')
    .eq('activo', true).order('orden', { ascending: true });

  if (error || !data || !data.length) {
    // tabla aún no creada (SQL-4 pendiente) → fallback, sin id
    const fb = FALLBACK.map(p => ({ ...p, precio_mensual: p.precio_mensual ?? PLAN_PRICES[p.slug] ?? null }));
    return new Response(JSON.stringify({ data: conPlugins(fb), fallback: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  // Si la tabla NO trae la columna categoria, los planes de la BD quedan sin
  // categoria (undefined) — se tratan como 'plan' en el front.
  return new Response(JSON.stringify({ data: conPlugins(data) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
