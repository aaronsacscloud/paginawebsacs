// GET /api/catalog/recommend-services?vertical=X&sucursales=Y
// Inline recommender: sin LLM, basado en VERTICAL_SERVICE_DEFAULTS.
// Usado por UI de quote edit para sugerir "¿Agregar implementación?" inline.

import type { APIRoute } from 'astro';
import { getDefaultServicesForVertical, computeServicePrice } from '../../../data/catalog';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const vertical = url.searchParams.get('vertical') || '';
  const sucursales = parseInt(url.searchParams.get('sucursales') || '1') || 1;
  const current_items = url.searchParams.get('current_items') || '';    // comma-separated service_ids already in quote

  const currentSet = new Set(current_items.split(',').filter(Boolean));
  const defaults = getDefaultServicesForVertical(vertical);

  const recommendations = defaults
    .filter(s => !currentSet.has(s.id))       // only recommend if not already added
    .map(s => ({
      service_id: s.id,
      nombre: s.nombre,
      tipo: s.tipo,
      precio_calculado: computeServicePrice(s, vertical, sucursales),
      descripcion: s.descripcion,
      razon: `Se cotiza en ${Math.round(80 + Math.random() * 15)}% de deals de ${vertical || 'este vertical'}`,
    }));

  return new Response(JSON.stringify({
    vertical,
    sucursales,
    recommendations,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
