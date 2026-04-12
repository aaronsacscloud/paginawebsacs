import type { APIRoute } from 'astro';
import { createHash } from 'crypto';

export const prerender = false;

const TIKTOK_TOKEN = (import.meta.env.TIKTOK_ACCESS_TOKEN || '').trim();
const TIKTOK_PIXEL = 'CUT9GN3C77UAVCG32N00';

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return '+52' + digits;
  if (digits.length > 10 && !digits.startsWith('0')) return '+' + digits;
  return '+52' + digits;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, phone, plan, amount } = await request.json();
    const e164 = toE164(phone || '');

    if (!TIKTOK_TOKEN) {
      return new Response(JSON.stringify({ success: false, error: 'TikTok token not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const event = {
      pixel_code: TIKTOK_PIXEL,
      event: 'CompletePayment',
      event_id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      event_time: Math.floor(Date.now() / 1000),
      context: {
        user: {
          email: email ? sha256(email) : undefined,
          phone: e164 ? sha256(e164) : undefined,
        },
      },
      properties: {
        contents: [{ content_id: plan || 'manual', content_name: plan || 'manual' }],
        content_type: 'product',
        value: amount || 0,
        currency: 'MXN',
      },
    };

    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': TIKTOK_TOKEN,
      },
      body: JSON.stringify({ event_source: 'web', event_source_id: TIKTOK_PIXEL, data: [event] }),
    });

    const result = await res.json();

    return new Response(JSON.stringify({ success: true, tiktok: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
