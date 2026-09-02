import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { leerConfig } from '../../../../lib/crm/ti/motor';
export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const dias = Math.min(14, Number(url.searchParams.get('dias')) || 3);
  const desde = new Date(Date.now() - dias * 86400e3).toISOString().slice(0, 10);
  const { data: filas } = await supabase.from('ti_revision').select('*').gte('dia', desde).order('dia', { ascending: false }).order('created_at', { ascending: false }).limit(200);
  const ids = [...new Set((filas || []).map(f => f.contact_id))];
  const { data: cs } = ids.length ? await supabase.from('contacts').select('id, nombre, giro, lifecycle_stage').in('id', ids) : { data: [] as any[] };
  const por: Record<string, any> = {}; for (const c of cs || []) por[c.id] = c;
  const cfg: any = await leerConfig();
  return json({ filas: (filas || []).map(f => ({ ...f, contacto: por[f.contact_id] || null })), rampa: cfg.rampa_revision || { aceptadas: 0, automatico: false } });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (b.accion === 'correr') { const { revisionDiaria } = await import('../../../../lib/crm/ti/revision'); return json({ ok: true, ...(await revisionDiaria({ horas: Number(b.horas) || 26 })) }); }
  if (b.accion === 'rampa') { const cfg: any = await leerConfig(); const r = { ...(cfg.rampa_revision || { aceptadas: 0 }), automatico: !!b.automatico }; await supabase.from('ti_config').update({ valor: { ...cfg, rampa_revision: r } }).eq('id', 1); return json({ ok: true, rampa: r }); }
  if ((b.accion === 'aceptar' || b.accion === 'rechazar') && b.id) { const { ejecutarPropuesta } = await import('../../../../lib/crm/ti/revision'); const r = await ejecutarPropuesta(String(b.id), user.id, b.accion, b.motivo, b.texto); return json(r.ok ? { ok: true, hecho: r.hecho } : { error: r.error }, r.ok ? 200 : 400); }
  return json({ error: 'Acción desconocida' }, 400);
};
