// GET /api/crm/arr/plans — catálogo de planes desde la BD (fuente única para
// todos los formularios del CRM: editar sub, crear sub, registrar pago).
// Fallback al catálogo hardcodeado de cotizaciones si la tabla aún no existe.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { PLAN_PRICES } from '../../../../lib/quotes/constants';

export const prerender = false;

const FALLBACK = [
  { slug: 'vende', nombre: 'Plan Vende', precio_mensual: 600, precio_anual: 6000, a_la_medida: false, orden: 1 },
  { slug: 'controla', nombre: 'Plan Controla', precio_mensual: 900, precio_anual: 9000, a_la_medida: false, orden: 2 },
  { slug: 'fideliza', nombre: 'Plan Fideliza', precio_mensual: 1400, precio_anual: 14000, a_la_medida: false, orden: 3 },
  { slug: 'automatiza', nombre: 'Plan Automatiza', precio_mensual: 5900, precio_anual: 59000, a_la_medida: false, orden: 4 },
  { slug: 'personalizada', nombre: 'Licencia personalizada', precio_mensual: null, precio_anual: null, a_la_medida: true, orden: 5 },
  { slug: 'soporte_premium', nombre: 'Soporte premium', precio_mensual: null, precio_anual: null, a_la_medida: true, orden: 6 },
  { slug: 'vitalicia_legacy', nombre: 'Licencia Vitalicia Legacy', precio_mensual: null, precio_anual: null, a_la_medida: true, orden: 7 },
];

export const GET: APIRoute = async () => {
  const { data, error } = await supabase.from('plans')
    .select('id, slug, nombre, precio_mensual, precio_anual, a_la_medida, activo, orden')
    .eq('activo', true).order('orden', { ascending: true });

  if (error || !data || !data.length) {
    // tabla aún no creada (SQL-4 pendiente) → fallback, sin id
    const fb = FALLBACK.map(p => ({ ...p, precio_mensual: p.precio_mensual ?? PLAN_PRICES[p.slug] ?? null }));
    return new Response(JSON.stringify({ data: fb, fallback: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
