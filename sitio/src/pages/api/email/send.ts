import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

/**
 * Email send endpoint — placeholder until Resend is integrated.
 * Currently logs the send to email_sends table with estado='queued'.
 * When Resend is connected, this will actually send via their API.
 */
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

  // TODO: Replace with Resend API call
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // const { data, error } = await resend.emails.send({
  //   from: 'SACS <hola@sacscloud.com>',
  //   to: [to],
  //   subject,
  //   html,
  //   text,
  // });

  // For now, log as queued
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
      estado: 'queued', // Will be 'sent' once Resend is connected
      // provider_message_id: data?.id, // From Resend response
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ id: send?.id, status: 'queued', message: 'Email queued (Resend not yet connected)' }));
};
