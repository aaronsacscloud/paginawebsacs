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

async function getMaxFolio(): Promise<number> {
  const { data } = await supabase.from('quotes').select('numero');
  let max = 0;
  if (Array.isArray(data)) {
    for (const row of data) {
      const m = String(row?.numero || '').match(/(\d+)\s*$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
  }
  return max;
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const clean = pick(body, QUOTE_FIELDS);
  // Folio configurado = mínimo inicial (solo aplica cuando no hay folios más altos ya usados)
  const folioStart = (parseInt(body._folio_offset) || 0) + 1;

  const vigencia = clean.vigencia || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  const estado = clean.estado || 'draft';

  // Intento con reintentos por si hay colisión (race o UNIQUE constraint)
  const MAX_TRIES = 6;
  let lastErr: any = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const maxExisting = await getMaxFolio();
    const nextNum = Math.max(maxExisting + 1, folioStart) + attempt;
    const num = `COT-${String(nextNum).padStart(3, '0')}`;

    const { data, error } = await supabase.from('quotes').insert({
      ...clean,
      numero: num,
      vigencia,
      estado,
    }).select().single();

    if (!error) {
      return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    lastErr = error;
    // 23505 = unique_violation de Postgres; si no es eso, no tiene sentido reintentar
    if (error.code !== '23505') break;
  }

  return new Response(JSON.stringify({ error: lastErr?.message || 'No se pudo asignar folio' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id } = body;
  const clean = pick(body, QUOTE_FIELDS);
  const { data, error } = await supabase.from('quotes').update(clean).eq('id', id).select().single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
