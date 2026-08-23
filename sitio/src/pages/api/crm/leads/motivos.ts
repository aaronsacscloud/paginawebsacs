// LEADS · Motivos de descarte y de desenlace, CONFIGURABLES.
//   GET    ?tipo=descarte|desenlace|todos  → lista
//   POST   { tipo, label }                 → agrega uno propio
//   PUT    { id, label?, activo?, orden? } → edita
//   DELETE ?id=                            → solo los que NO son de fábrica
//
// Los de fábrica se pueden DESACTIVAR pero no borrar: si se borrara uno ya
// usado, los leads descartados con él se quedarían sin explicación y el reporte
// de "por qué se caen" perdería justo lo que se quiere aprender.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const TIPOS = ['descarte', 'desenlace'];

/** Clave estable a partir del texto: sin acentos, sin espacios. Es lo que se
 *  guarda en el lead, así que renombrar la etiqueta después no rompe nada. */
const claveDe = (label: string) => String(label || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

export const GET: APIRoute = async ({ url }) => {
  const tipo = url.searchParams.get('tipo') || 'todos';
  let q = supabase.from('crm_lead_motivos').select('*').order('tipo').order('orden').order('label');
  if (TIPOS.includes(tipo)) q = q.eq('tipo', tipo);
  if (url.searchParams.get('activos') === '1') q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) return json({ error: error.message, motivos: [] }, 200);
  return json({ motivos: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const tipo = String(b?.tipo || '');
  const label = String(b?.label || '').trim();
  if (!TIPOS.includes(tipo)) return json({ error: 'tipo inválido' }, 400);
  if (label.length < 3) return json({ error: 'Escribe el motivo con al menos 3 letras.' }, 400);
  const clave = claveDe(label);
  if (!clave) return json({ error: 'Ese texto no deja una clave usable.' }, 400);

  const { data, error } = await supabase.from('crm_lead_motivos')
    .insert({ clave, label: label.slice(0, 80), tipo, orden: 500 }).select('*').single();
  // 23505 = ya existe uno con esa clave y tipo. Se contesta en claro en vez de
  // dejar que el front enseñe un error de base de datos.
  if ((error as any)?.code === '23505') return json({ error: 'Ya existe un motivo con ese nombre.' }, 409);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, motivo: data }, 201);
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  if (!b?.id) return json({ error: 'id requerido' }, 400);
  const upd: any = {};
  if (typeof b.label === 'string' && b.label.trim().length >= 3) upd.label = b.label.trim().slice(0, 80);
  if (typeof b.activo === 'boolean') upd.activo = b.activo;
  if (Number.isFinite(Number(b.orden))) upd.orden = Number(b.orden);
  if (!Object.keys(upd).length) return json({ error: 'Nada que cambiar.' }, 400);
  const { data, error } = await supabase.from('crm_lead_motivos').update(upd).eq('id', b.id).select('*').single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, motivo: data });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  const { data: m } = await supabase.from('crm_lead_motivos').select('de_fabrica').eq('id', id).maybeSingle();
  if (!m) return json({ error: 'No existe.' }, 404);
  if (m.de_fabrica) return json({ error: 'Los motivos de fábrica no se borran; desactívalo y deja de aparecer.' }, 409);
  const { error } = await supabase.from('crm_lead_motivos').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
