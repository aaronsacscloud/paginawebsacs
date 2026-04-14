import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * SMS/WhatsApp send endpoint via Twilio.
 *
 * PENDIENTE: Conectar Twilio.
 *
 * Env vars necesarias:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER  (for SMS, e.g., +15551234567)
 *   TWILIO_WHATSAPP_NUMBER (for WhatsApp, e.g., whatsapp:+15551234567)
 *
 * Usage:
 *   POST /api/scheduling/sms/send
 *   Body: { to: "+525512345678", message: "...", channel: "sms" | "whatsapp" }
 *
 * Twilio integration code (uncomment when ready):
 *
 *   import twilio from 'twilio';
 *   const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
 *
 *   // For SMS:
 *   await client.messages.create({
 *     body: message,
 *     from: process.env.TWILIO_PHONE_NUMBER,
 *     to: normalizedNumber,
 *   });
 *
 *   // For WhatsApp:
 *   await client.messages.create({
 *     body: message,
 *     from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
 *     to: `whatsapp:${normalizedNumber}`,
 *   });
 */

function normalizeMexicanNumber(phone: string): string {
  // Remove everything except digits and +
  let cleaned = phone.replace(/[^\d+]/g, '');
  // If starts with 52, add +
  if (cleaned.startsWith('52') && !cleaned.startsWith('+')) cleaned = '+' + cleaned;
  // If starts with just digits (no country code), assume Mexico
  if (!cleaned.startsWith('+')) cleaned = '+52' + cleaned;
  // Remove the old "1" mobile prefix if present (e.g., +5215512345678 → +525512345678)
  if (cleaned.startsWith('+521') && cleaned.length === 14) {
    cleaned = '+52' + cleaned.slice(4);
  }
  return cleaned;
}

export const POST: APIRoute = async ({ request }) => {
  const { to, message, channel = 'sms' } = await request.json();

  if (!to || !message) {
    return new Response(JSON.stringify({ error: 'to and message required' }), { status: 400 });
  }

  const normalizedNumber = normalizeMexicanNumber(to);

  // TODO: Uncomment when Twilio is connected
  // const TWILIO_SID = import.meta.env.TWILIO_ACCOUNT_SID;
  // const TWILIO_AUTH = import.meta.env.TWILIO_AUTH_TOKEN;
  // const TWILIO_FROM = import.meta.env.TWILIO_PHONE_NUMBER;
  //
  // if (!TWILIO_SID || !TWILIO_AUTH) {
  //   return new Response(JSON.stringify({ error: 'Twilio not configured' }), { status: 503 });
  // }
  //
  // try {
  //   const twilio = require('twilio');
  //   const client = twilio(TWILIO_SID, TWILIO_AUTH);
  //
  //   if (channel === 'whatsapp') {
  //     const result = await client.messages.create({
  //       body: message,
  //       from: `whatsapp:${TWILIO_FROM}`,
  //       to: `whatsapp:${normalizedNumber}`,
  //     });
  //     return new Response(JSON.stringify({ id: result.sid, status: 'sent', channel: 'whatsapp' }));
  //   } else {
  //     const result = await client.messages.create({
  //       body: message,
  //       from: TWILIO_FROM,
  //       to: normalizedNumber,
  //     });
  //     return new Response(JSON.stringify({ id: result.sid, status: 'sent', channel: 'sms' }));
  //   }
  // } catch (err) {
  //   return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  // }

  // Placeholder response until Twilio is connected
  return new Response(JSON.stringify({
    status: 'queued',
    message: `SMS/WhatsApp queued (Twilio not yet connected)`,
    to: normalizedNumber,
    channel,
    body: message,
  }));
};
