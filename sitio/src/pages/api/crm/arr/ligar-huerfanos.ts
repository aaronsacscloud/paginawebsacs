// POST /api/crm/arr/ligar-huerfanos — liga los pagos SIN contacto al contacto
// principal de su empresa (los "sin contacto" que detecta reconciliacion). Así vuelven
// a aparecer en el 360 de un contacto. Bulk, idempotente. Body: {} (opcional
// { payment_id } para ligar solo uno).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
function json(o: any, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  try {
    let q = supabase.from('payments').select('id, company_id').is('contact_id', null).not('company_id', 'is', null);
    if (body?.payment_id) q = q.eq('id', body.payment_id);
    const { data: huer, error } = await q.limit(1000);
    if (error) throw error;

    // Cache de contacto principal por empresa (evita N queries repetidas).
    const cacheContacto: Record<string, string | null> = {};
    let ligados = 0, sin_contacto_empresa = 0;
    for (const p of huer || []) {
      let contactId = cacheContacto[p.company_id];
      if (contactId === undefined) {
        const { data: c } = await supabase.from('contacts').select('id').eq('company_id', p.company_id).order('created_at').limit(1).maybeSingle();
        contactId = c?.id || null;
        cacheContacto[p.company_id] = contactId;
      }
      if (contactId) { await supabase.from('payments').update({ contact_id: contactId }).eq('id', p.id); ligados++; }
      else sin_contacto_empresa++;
    }
    return json({ ok: true, ligados, sin_contacto_empresa, total: (huer || []).length });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
