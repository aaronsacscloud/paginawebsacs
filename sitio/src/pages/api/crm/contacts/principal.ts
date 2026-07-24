// POST /api/crm/contacts/principal { contact_id, company_id }
// Marca UN contacto como el principal de su empresa (desmarca los demás).
// Requiere la migración migration-2026-07-contactos-rol.sql (columna es_principal).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({} as any));
  const { contact_id, company_id } = body;
  if (!contact_id || !company_id) {
    return new Response(JSON.stringify({ error: 'contact_id y company_id requeridos' }), { status: 400 });
  }

  // Primero desmarca todos (evita chocar con el índice único parcial).
  const off = await supabase.from('contacts').update({ es_principal: false }).eq('company_id', company_id).eq('es_principal', true);
  if (off.error) {
    const msg = /es_principal|column|schema cache/i.test(off.error.message || '')
      ? 'Falta correr scripts/migration-2026-07-contactos-rol.sql en Supabase.'
      : off.error.message;
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
  const on = await supabase.from('contacts').update({ es_principal: true }).eq('id', contact_id);
  if (on.error) return new Response(JSON.stringify({ error: on.error.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
