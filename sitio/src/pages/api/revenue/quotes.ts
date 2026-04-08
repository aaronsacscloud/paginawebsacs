import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

// Only pass known DB columns to avoid PostgREST errors
const QUOTE_FIELDS = [
  'empresa', 'contacto', 'email', 'whatsapp', 'items', 'iva_incluido',
  'descuento_global', 'descuento_tipo', 'moneda', 'template', 'condiciones',
  'vigencia', 'estado', 'subtotal', 'iva_monto', 'total', 'notas',
  'bank_account_id', 'mostrar_banco', 'link_pago', 'urgencia',
  'aceptado_por', 'aceptado_fecha',
];

function pick(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const f of fields) {
    if (f in obj) result[f] = obj[f];
  }
  return result;
}

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');

  if (id) {
    const { data, error } = await supabase.from('quotes').select('*').eq('id', id).single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify(data || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const clean = pick(body, QUOTE_FIELDS);
  const folioOffset = parseInt(body._folio_offset) || 0;

  // Auto-generate quote number
  const { count } = await supabase.from('quotes').select('*', { count: 'exact', head: true });
  const nextNum = Math.max((count || 0) + 1, folioOffset + 1);
  const num = `COT-${String(nextNum).padStart(3, '0')}`;

  const { data, error } = await supabase.from('quotes').insert({
    ...clean,
    numero: num,
    vigencia: clean.vigencia || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    estado: clean.estado || 'draft',
  }).select().single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id } = body;
  const clean = pick(body, QUOTE_FIELDS);
  const { data, error } = await supabase.from('quotes').update(clean).eq('id', id).select().single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
