import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

/**
 * Webhook endpoint for Resend email events.
 * Configure in Resend dashboard: https://resend.com/webhooks
 * URL: https://www.sacscloud.com/api/email/webhook
 * Events: email.sent, email.delivered, email.opened, email.clicked, email.bounced, email.complained
 */
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { type, data } = body;

  if (!type || !data) {
    return new Response('OK', { status: 200 });
  }

  const messageId = data.email_id || data.message_id;
  if (!messageId) return new Response('OK', { status: 200 });

  // Find the email_send by provider_message_id
  const { data: send } = await supabase
    .from('email_sends')
    .select('id, contact_id, open_count, click_count, first_opened_at')
    .eq('provider_message_id', messageId)
    .limit(1)
    .single();

  if (!send) return new Response('OK', { status: 200 });

  const now = new Date().toISOString();

  switch (type) {
    case 'email.sent':
      await supabase.from('email_sends').update({ estado: 'sent', sent_at: now }).eq('id', send.id);
      break;

    case 'email.delivered':
      await supabase.from('email_sends').update({ estado: 'delivered', delivered_at: now }).eq('id', send.id);
      break;

    case 'email.opened':
      await supabase.from('email_sends').update({
        estado: 'opened',
        opened_at: now,
        first_opened_at: send.first_opened_at || now,
        open_count: (send.open_count || 0) + 1,
      }).eq('id', send.id);
      if (!send.first_opened_at) {
        await supabase.from('activities').insert({
          contact_id: send.contact_id, tipo: 'email_opened',
          titulo: 'Email abierto (webhook)', metadata: { email_send_id: send.id }, automatico: true,
        });
      }
      break;

    case 'email.clicked':
      await supabase.from('email_sends').update({
        estado: 'clicked', clicked_at: now,
        click_count: (send.click_count || 0) + 1,
      }).eq('id', send.id);
      break;

    case 'email.bounced':
      await supabase.from('email_sends').update({
        estado: 'bounced', bounced_at: now,
        bounce_type: data.bounce?.type || 'unknown',
        bounce_reason: data.bounce?.description || '',
      }).eq('id', send.id);
      await supabase.from('activities').insert({
        contact_id: send.contact_id, tipo: 'email_bounced',
        titulo: 'Email rebotó', metadata: { email_send_id: send.id, type: data.bounce?.type }, automatico: true,
      });
      break;

    case 'email.complained':
      await supabase.from('email_sends').update({ estado: 'complained' }).eq('id', send.id);
      // Auto-unsubscribe on complaint
      if (send.contact_id) {
        const { data: contact } = await supabase.from('contacts').select('email').eq('id', send.contact_id).single();
        if (contact?.email) {
          await supabase.from('email_unsubscribes').upsert({
            contact_id: send.contact_id, email: contact.email, scope: 'all', reason: 'spam_complaint',
          }, { onConflict: 'email' });
        }
      }
      break;
  }

  return new Response('OK', { status: 200 });
};
