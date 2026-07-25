// GET /api/crm/uso-historia?company_id=&dias=90 — snapshots históricos de uso
// (los escriben los crons sync-sacs-uso / sync-sacs-activity). Para la sección
// "Evolución" del drawer. Founder-only (middleware).
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const companyId = (url.searchParams.get('company_id') || '').trim();
  if (!companyId) return json({ error: 'company_id requerido' }, 400);
  const dias = Math.min(365, Number(url.searchParams.get('dias')) || 90);
  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from('uso_snapshots')
    .select('fecha, ventas_30d, total_30d, tendencia_pct, dias_sin_venta, health_score, usuarios_operando, clientes_total, lealtad_inscritos, conteos_7d, transferencias_7d, facturas_7d, clientes_nuevos_7d')
    .eq('company_id', companyId).gte('fecha', desde)
    .order('fecha', { ascending: true });
  if (error) return json({ error: error.message }, 500);
  return json({ data: data || [] });
};
