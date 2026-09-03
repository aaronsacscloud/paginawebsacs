// GUION, WIKI Y LÍMITES como datos con versiones. GET: textos vigentes + versiones. POST { clave, texto, nota } (solo dueño).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { guionActual, guardarVersionGuion } from '../../../../lib/crm/ti/guion-datos';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const g = await guionActual(true);
  const { data: vs } = await supabase.from('ti_guion_versiones').select('id, clave, version, nota, created_by, created_at, texto').order('created_at', { ascending: false }).limit(60);
  const uids = [...new Set((vs || []).map(v => v.created_by).filter(Boolean))] as string[];
  const { data: us } = uids.length ? await supabase.from('team_members').select('id, nombre').in('id', uids) : { data: [] as any[] };
  return json({ textos: g.textos, versiones_vigentes: g.versiones, historial: (vs || []).map(v => ({ ...v, largo: v.texto.length, texto: undefined, por: (us || []).find((u: any) => u.id === v.created_by)?.nombre || null })) });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  if (user.role !== 'founder') return json({ error: 'Solo el dueño cambia el guion, la wiki o los límites' }, 403);
  const b = await request.json().catch(() => ({}));
  if (b.accion === 'ver_version' && b.id) { const { data } = await supabase.from('ti_guion_versiones').select('texto').eq('id', b.id).maybeSingle(); return json({ texto: data?.texto || '' }); }
  if (!['guion', 'wiki', 'limites'].includes(b.clave)) return json({ error: 'Clave inválida' }, 400);
  const r = await guardarVersionGuion(b.clave, String(b.texto || ''), user.id, b.nota);
  return json(r, r.error ? 400 : 200);
};
