import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { leerConfig } from '../../../../lib/crm/ti/motor';
import { resumenConsumo } from '../../../../lib/crm/ti/consumo';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  return json(await resumenConsumo());
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (b.accion === 'presupuesto') {
    const usd = Math.max(10, Math.min(10000, Number(b.usd) || 300));
    const cfg: any = await leerConfig();
    await supabase.from('ti_config').update({ valor: { ...cfg, presupuesto_ia_usd: usd } }).eq('id', 1);
    await supabase.from('ia_log').insert({ accion: 'presupuesto_ia', razon: `$${usd} USD/mes`, detalle: { por: user.id } });
    return json({ ok: true, presupuesto: usd });
  }
  return json({ error: 'Acción desconocida' }, 400);
};
