// CRUD del LIENZO de notas del cliente (tab "Notas" tipo Milanote en el drawer).
// Tarjetas posicionadas (nota | minuta | idea | imagen | pdf) en client_board_nodes.
// Founder-only (middleware protege /api/crm/*).
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const TIPOS = ['nota', 'minuta', 'idea', 'imagen', 'pdf'];
const CAMPOS = ['tipo', 'titulo', 'contenido', 'archivo_url', 'color', 'pos_x', 'pos_y', 'width', 'height', 'metadata'];

export const GET: APIRoute = async ({ url }) => {
  const companyId = (url.searchParams.get('company_id') || '').trim();
  if (!companyId) return json({ error: 'company_id requerido' }, 400);
  const { data, error } = await supabase.from('client_board_nodes')
    .select('*').eq('company_id', companyId).order('created_at', { ascending: true });
  if (error) return json({ error: error.message }, 500);
  return json({ data: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({} as any));
  const companyId = String(body.company_id || '').trim();
  if (!companyId) return json({ error: 'company_id requerido' }, 400);
  const tipo = TIPOS.includes(body.tipo) ? body.tipo : 'nota';
  const row: any = { company_id: companyId, tipo };
  for (const k of CAMPOS) if (k !== 'tipo' && body[k] !== undefined) row[k] = body[k];
  const { data, error } = await supabase.from('client_board_nodes').insert(row).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ data }, 201);
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({} as any));
  const id = String(body.id || '').trim();
  if (!id) return json({ error: 'id requerido' }, 400);
  const upd: any = { updated_at: new Date().toISOString() };
  for (const k of CAMPOS) if (body[k] !== undefined) upd[k] = body[k];
  const { data, error } = await supabase.from('client_board_nodes').update(upd).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ data });
};

export const DELETE: APIRoute = async ({ url, request }) => {
  let id = url.searchParams.get('id');
  if (!id) { try { const b = await request.json(); id = b?.id; } catch { /* sin body */ } }
  if (!id) return json({ error: 'id requerido' }, 400);
  const { error } = await supabase.from('client_board_nodes').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
