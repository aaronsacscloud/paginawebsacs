import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const RESEND_API_KEY = (import.meta.env.RESEND_API_KEY || '').trim();

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { to, subject, html, text, contact_id, template_id, automation_id, enrollment_id, step_id } = body;

  if (!to || !subject) {
    return new Response(JSON.stringify({ error: 'to and subject required' }), { status: 400 });
  }

  // Check unsubscribe
  const { data: unsub } = await supabase
    .from('email_unsubscribes')
    .select('id')
    .eq('email', to)
    .is('resubscribed_at', null)
    .limit(1)
    .single();

  if (unsub) {
    return new Response(JSON.stringify({ error: 'contact_unsubscribed', message: 'Email is unsubscribed' }), { status: 200 });
  }

  // Send via Resend
  let providerMessageId: string | null = null;
  let estado = 'queued';
  let errorMessage: string | null = null;

  if (RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SACS <onboarding@resend.dev>',
          to: [to],
          subject,
          html: html || undefined,
          text: text || undefined,
        }),
      });

      const result = await res.json();

      if (result.id) {
        providerMessageId = result.id;
        estado = 'sent';
      } else {
        errorMessage = result.message || result.error || 'Unknown Resend error';
        estado = 'failed';
      }
    } catch (err) {
      errorMessage = String(err);
      estado = 'failed';
    }
  }

  // Log to email_sends table
  const { data: send, error } = await supabase
    .from('email_sends')
    .insert({
      contact_id: contact_id || null,
      template_id: template_id || null,
      automation_id: automation_id || null,
      enrollment_id: enrollment_id || null,
      step_id: step_id || null,
      email_to: to,
      email_provider: 'resend',
      provider_message_id: providerMessageId,
      estado,
      sent_at: estado === 'sent' ? new Date().toISOString() : null,
      error_message: errorMessage,
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({
    id: send?.id,
    provider_id: providerMessageId,
    status: estado,
    error: errorMessage,
  }));
};
