// CRM · Catálogo configurable de opciones por campo (crm_campos_config).
// Los modales de la tabla de Leads leen de aquí y el usuario puede AGREGAR
// opciones sin tocar código. El código trae defaults por si la tabla falta.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async () => {
  const { data, error } = await supabase.from('crm_campos_config').select('campo, opciones');
  if (error) return json({ error: error.message }, 500);
  const out: Record<string, any[]> = {};
  for (const r of data || []) out[r.campo] = r.opciones || [];
  return json({ campos: out });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json();
  if (!b?.campo || !Array.isArray(b?.opciones)) return json({ error: 'campo y opciones requeridos' }, 400);
  const opciones = b.opciones
    .map((o: any) => ({ v: String(o.v || '').trim(), l: String(o.l || '').trim() }))
    .filter((o: any) => o.v && o.l);
  const { error } = await supabase.from('crm_campos_config')
    .upsert({ campo: String(b.campo), opciones, updated_at: new Date().toISOString() }, { onConflict: 'campo' });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, opciones });
};
