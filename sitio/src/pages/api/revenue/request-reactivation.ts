import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { parseMeta, serializeMeta } from '../../../lib/quotes/meta';

export const prerender = false;

// El CLIENTE (desde la cotización pública vencida) pide reactivarla.
// Registra la solicitud en la meta + timeline y avisa al partner (o a ventas
// si la quote es del admin). El partner la reactiva con "Extender vigencia".

export const POST: APIRoute = async ({ request }) => {
  let body: any = {};
  try { body = await request.json(); } catch (e) { /* body inválido */ }
  const { id, mensaje } = body || {};
  if (!id) return new Response(JSON.stringify({ error: 'id requerido' }), { status: 400 });

  const { data: quote } = await supabase.from('quotes')
    .select('id, numero, empresa, contacto, email, total, moneda, vigencia, estado, partner_id, notas')
    .eq('id', id).single();
  if (!quote) return new Response(JSON.stringify({ error: 'cotización no encontrada' }), { status: 404 });

  // Solo sobre cotizaciones enviadas/vencidas. OJO: la página pública auto-sana
  // el estado a 'expired' al abrirse vencida, así que ambos valores son válidos.
  if (quote.estado !== 'sent' && quote.estado !== 'expired') {
    return new Response(JSON.stringify({ error: 'Esta cotización no admite reactivación.' }), { status: 409 });
  }

  const { text, meta } = parseMeta(quote.notas || '');

  // Anti-spam: máximo una solicitud pendiente
  if (meta.reactivation_requested_at && !meta.reactivation_resolved_at) {
    return new Response(JSON.stringify({ ok: true, already: true }), { status: 200 });
  }

  const now = new Date().toISOString();
  meta.reactivation_requested_at = now;
  delete meta.reactivation_resolved_at;
  if (typeof mensaje === 'string' && mensaje.trim()) {
    meta.reactivation_message = mensaje.trim().slice(0, 500);
  }
  if (!Array.isArray(meta.timeline)) meta.timeline = [];
  meta.timeline.push({ event: 'reactivation_requested', at: now });

  const { error } = await supabase.from('quotes')
    .update({ notas: serializeMeta(text, meta) })
    .eq('id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Aviso al partner (o a ventas si es cotización del admin) — fire-and-forget
  try {
    const { notify, getSalesInbox } = await import('../../../lib/notify');
    let to: string | null = null;
    if (quote.partner_id) {
      const { getPartnerProfile } = await import('../../../lib/partners/profile');
      const partner = await getPartnerProfile(quote.partner_id);
      to = partner?.email || null;
    }
    const dest: string = to || getSalesInbox();
    await notify({
      channel: 'email',
      to: dest,
      template: 'quote_reactivation_partner',
      data: {
        numero: quote.numero,
        empresa: quote.empresa,
        contacto: quote.contacto,
        total: quote.total,
        moneda: quote.moneda || 'MXN',
        mensaje: meta.reactivation_message || '',
        portalUrl: quote.partner_id
          ? 'https://www.sacscloud.com/partner/portal'
          : 'https://www.sacscloud.com/admin/crm?tab=cotizaciones',
      },
    });
  } catch (e) {
    console.error('[request-reactivation] notify error:', e);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
