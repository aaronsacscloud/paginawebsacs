import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q');
  if (!q || q.length < 2) return new Response(JSON.stringify({ results: [] }));

  const search = `%${q}%`;

  const [contacts, companies, deals, quotes] = await Promise.all([
    supabase.from('contacts').select('id, nombre, email, tipo, lifecycle_stage').or(`nombre.ilike.${search},email.ilike.${search},whatsapp.ilike.${search}`).limit(5),
    supabase.from('companies').select('id, nombre, plan, estado_cuenta').ilike('nombre', search).limit(5),
    supabase.from('deals').select('id, nombre, stage, valor_total').ilike('nombre', search).limit(5),
    supabase.from('quotes').select('id, numero, empresa, total, estado').or(`empresa.ilike.${search},numero.ilike.${search}`).limit(5),
  ]);

  return new Response(JSON.stringify({
    results: [
      ...(contacts.data || []).map(c => ({ type: 'contact', ...c })),
      ...(companies.data || []).map(c => ({ type: 'company', ...c })),
      ...(deals.data || []).map(d => ({ type: 'deal', ...d })),
      ...(quotes.data || []).map(q => ({ type: 'quote', ...q })),
    ],
  }));
};
