import type { APIRoute } from 'astro';
import { createHash } from 'crypto';
import { supabase } from '../../../lib/supabase';
import { sendAcuseEmail } from '../../../lib/payments/send-acuse';

export const prerender = false;

const TIKTOK_TOKEN = (import.meta.env.TIKTOK_ACCESS_TOKEN || '').trim();
const TIKTOK_PIXEL = 'CUT9GN3C77UAVCG32N00';

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return '+52' + digits;
  if (digits.length > 10) return '+' + digits;
  return '+52' + digits;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { quoteId, metodo, referencia, fecha, monto, enviar_acuse } = body || {};
    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'quoteId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Update estado to paid
    const nowIso = new Date().toISOString();
    await supabase.from('quotes').update({
      estado: 'paid',
      aceptado_fecha: nowIso,
      pagado_fecha: nowIso,
    }).eq('id', quoteId);

    // ─── Auto-crear pago + acuse para cubrir el saldo restante ───
    let acuseGenerated: any = null;
    let createdPaymentId: string | null = null;
    try {
      const { data: q } = await supabase.from('quotes').select('total').eq('id', quoteId).single();
      const total = Number(q?.total || 0);
      // Suma de pagos existentes
      const { data: existing } = await supabase.from('payments').select('monto').eq('quote_id', quoteId);
      const yaPagado = (existing || []).reduce((s: number, p: any) => s + Number(p.monto || 0), 0);
      const saldo = Math.max(0, total - yaPagado);
      const montoPago = Number(monto || saldo); // si no hay saldo, no creamos pago duplicado
      if (montoPago > 0) {
        const { data: paymentRow, error: pErr } = await supabase.from('payments').insert({
          quote_id: quoteId,
          fecha: fecha || nowIso.slice(0, 10),
          monto: montoPago,
          metodo: metodo || 'otro',
          referencia: referencia || null,
          estado: 'confirmado',
        }).select().single();
        if (!pErr && paymentRow?.id) {
          createdPaymentId = paymentRow.id;
          // Envia el acuse por email (default true)
          if (enviar_acuse !== false) {
            try { acuseGenerated = await sendAcuseEmail(paymentRow.id); } catch (e) { acuseGenerated = { ok: false, reason: String(e) }; }
          } else {
            acuseGenerated = { ok: true, skipped_email: true };
          }
        }
      }
    } catch (err) {
      console.error('[mark-paid] acuse autogen error:', err);
    }

    // Add timeline event
    const { data: quote } = await supabase.from('quotes').select('notas, email, whatsapp, total, empresa').eq('id', quoteId).single();
    if (quote) {
      const sep = '\n---META---\n';
      const idx = (quote.notas || '').indexOf(sep);
      let text = quote.notas || '';
      let meta: any = {};
      if (idx >= 0) {
        text = quote.notas.slice(0, idx);
        try { meta = JSON.parse(quote.notas.slice(idx + sep.length)); } catch {}
      }
      if (!meta.timeline) meta.timeline = [];
      meta.timeline.push({ event: 'paid', at: new Date().toISOString(), method: 'manual' });
      const newNotas = text + sep + JSON.stringify(meta);
      await supabase.from('quotes').update({ notas: newNotas }).eq('id', quoteId);

      // TikTok: CompletePayment
      if (TIKTOK_TOKEN) {
        const e164 = toE164(quote.whatsapp || '');
        const event = {
          pixel_code: TIKTOK_PIXEL,
          event: 'CompletePayment',
          event_id: `quote_${quoteId}_${Date.now()}`,
          event_time: Math.floor(Date.now() / 1000),
          context: {
            user: {
              email: quote.email ? sha256(quote.email) : undefined,
              phone: e164 ? sha256(e164) : undefined,
            },
          },
          properties: {
            contents: [{ content_id: 'cotizacion', content_name: quote.empresa || 'cotizacion' }],
            content_type: 'product',
            value: quote.total || 0,
            currency: 'MXN',
          },
        };

        await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Access-Token': TIKTOK_TOKEN },
          body: JSON.stringify({ event_source: 'web', event_source_id: TIKTOK_PIXEL, data: [event] }),
        }).catch(() => {});
      }
    }

    // ─── Cobrar cierra la oportunidad ───
    // Toda la maquinaria de "ganar" ya existía —convertir el lead en cliente,
    // crear la suscripción, registrar el pago único como licencia vitalicia—
    // pero solo se disparaba moviendo la tarjeta en el tablero. Cobrar desde la
    // cotización se la saltaba entera: la venta quedaba cobrada y el cliente
    // seguía siendo lead, sin suscripción.
    //
    // Nada de esto puede tumbar el cobro: el pago ya está registrado y el acuse
    // enviado. Si algo falla aquí se reporta en la respuesta y se resuelve
    // después, pero el dinero no se pierde.
    let cierre: any = null;
    try {
      const { syncQuoteToDeal } = await import('../../../lib/crm/sync-quote-deal');
      const { data: q2 } = await supabase.from('quotes')
        .select('id, deal_id, company_id, contact_id, total, pagado_fecha').eq('id', quoteId).maybeSingle();
      const r = await syncQuoteToDeal(quoteId, {
        targetStage: 'cerrada_ganada',
        valor_total: Math.round(Number(q2?.total || 0)),
        trigger: 'quote_paid',
        closed_at: q2?.pagado_fecha || nowIso,
      });
      // Materializar: lead → cliente, suscripción del recurrente y pago único.
      // Es idempotente, así que volver a cobrar no duplica nada.
      if (r.dealId) {
        const { data: deal } = await supabase.from('deals').select('*').eq('id', r.dealId).maybeSingle();
        if (deal) {
          const { materializarDealGanado } = await import('../../../lib/crm/deal-cierre');
          cierre = await materializarDealGanado(deal);
        }
      }
      cierre = { ...(cierre || {}), deal_id: r.dealId, oportunidad_creada: r.created };
    } catch (e) {
      console.error('[mark-paid] cierre de oportunidad:', e);
      cierre = { error: String(e) };
    }

    return new Response(JSON.stringify({
      success: true,
      payment_id: createdPaymentId,
      acuse_url: createdPaymentId ? `/acuse/${createdPaymentId}` : null,
      acuse_email: acuseGenerated,
      cierre,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
