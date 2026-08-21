// SOPORTE · Tickets de Intercom de UN cliente (ficha 360). Patrón de
// outbound/por-cliente: fetch propio al abrir la tab. Founder-only por el
// middleware (/api/crm/).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const companyId = url.searchParams.get('company_id');
  if (!companyId) return json({ error: 'Falta company_id' }, 400);
  const { data, error } = await supabase.from('crm_soporte_tickets')
    .select('conversation_id, estado, asunto, vista_previa, prioridad, asignado, abierto_at, resuelto_at, ultima_actividad_at, intercom_url')
    .eq('company_id', companyId).order('ultima_actividad_at', { ascending: false }).limit(200);
  if (error) return json({ error: error.message }, 500);
  const tickets = data || [];
  const abiertos = tickets.filter(t => t.estado !== 'resuelto' && t.estado !== 'cerrado').length;
  const resueltos = tickets.filter(t => t.estado === 'resuelto' && t.abierto_at && t.resuelto_at);
  const horas = resueltos.map(t => (new Date(t.resuelto_at!).getTime() - new Date(t.abierto_at!).getTime()) / 3600000);
  const promedioHoras = horas.length ? +(horas.reduce((a, b) => a + b, 0) / horas.length).toFixed(1) : null;
  return json({ tickets, resumen: { total: tickets.length, abiertos, resueltos: resueltos.length, promedio_horas: promedioHoras } });
};
