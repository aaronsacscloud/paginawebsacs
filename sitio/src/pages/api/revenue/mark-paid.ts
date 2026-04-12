import type { APIRoute } from 'astro';
import { createHash } from 'crypto';
import { supabase } from '../../../lib/supabase';

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
    const { quoteId } = await request.json();
    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'quoteId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Update estado to paid
    await supabase.from('quotes').update({
      estado: 'paid',
      aceptado_fecha: new Date().toISOString(),
    }).eq('id', quoteId);

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

    return new Response(JSON.stringify({ success: true }), {
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
