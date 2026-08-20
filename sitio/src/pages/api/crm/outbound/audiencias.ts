// OUTBOUND · Audiencias guardadas con nombre, reutilizables entre campañas.
// GET → lista (con conteo vivo opcional ?contar=1) · POST {nombre, definicion,
// nivel?} · PUT ?id= · DELETE ?id= · POST ?accion=contar {definicion} → alcance.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverAudiencia } from '../../../../lib/outbound/motor';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const { data, error } = await supabase.from('inapp_audiencias').select('*').order('nombre');
  if (error) return json({ error: error.message }, 500);
  if (url.searchParams.get('contar')) {
    // Conteo VIVO por audiencia (pocas): cuántas cuentas resuelve HOY.
    for (const a of (data || [])) {
      try { (a as any).cuentas = (await resolverAudiencia(a.definicion || {})).cuentas.length; }
      catch { (a as any).cuentas = null; }
    }
  }
  return json({ data: data || [] });
};

export const POST: APIRoute = async ({ request, url }) => {
  let body: any; try { body = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }
  if (url.searchParams.get('accion') === 'contar') {
    try {
      const r = await resolverAudiencia(body.definicion || {});
      return json({ cuentas: r.cuentas.length, companies: r.companies.length });
    } catch (e: any) { return json({ error: e?.message || 'No se pudo contar' }, 500); }
  }
  if (!String(body.nombre || '').trim()) return json({ error: 'Falta el nombre' }, 400);
  const { data, error } = await supabase.from('inapp_audiencias')
    .insert({ nombre: String(body.nombre).trim(), descripcion: body.descripcion || null, definicion: body.definicion || {}, nivel: body.nivel || null })
    .select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ audiencia: data });
};

export const PUT: APIRoute = async ({ request, url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);
  let body: any; try { body = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }
  const upd: any = { updated_at: new Date().toISOString() };
  for (const k of ['nombre', 'descripcion', 'definicion', 'nivel']) if (body[k] !== undefined) upd[k] = body[k];
  const { data, error } = await supabase.from('inapp_audiencias').update(upd).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ audiencia: data });
};

export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);
  const { error } = await supabase.from('inapp_audiencias').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
