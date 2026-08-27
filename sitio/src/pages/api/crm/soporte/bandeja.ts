// SOPORTE · La bandeja móvil: tickets ABIERTOS de todos los clientes, con el
// nombre de la empresa resuelto. El dashboard agrega; esta lista es para
// contestar "¿a quién le debo respuesta AHORA?" desde el teléfono.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const ABIERTO = ['abierto', 'en_curso', 'pausado'];

export const GET: APIRoute = async () => {
  const { data, error } = await supabase.from('crm_soporte_tickets')
    .select('conversation_id, company_id, estado, asunto, vista_previa, prioridad, abierto_at, primera_respuesta_at, ultima_actividad_at, intercom_url')
    .in('estado', ABIERTO)
    .order('abierto_at', { ascending: false }).limit(120);
  if (error) return json({ error: error.message }, 500);
  const tickets = data || [];
  const ids = [...new Set(tickets.map(t => t.company_id).filter(Boolean))];
  let nombres: Record<string, string> = {};
  if (ids.length) {
    const { data: cos } = await supabase.from('companies').select('id, nombre_comercial, nombre').in('id', ids);
    for (const c of cos || []) nombres[c.id] = c.nombre_comercial || c.nombre || '';
  }
  return json({ tickets: tickets.map(t => ({ ...t, empresa: nombres[t.company_id || ''] || null })) });
};
