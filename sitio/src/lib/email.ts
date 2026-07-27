// Envío de correo transaccional (Resend) IN-PROCESS + registro en email_sends.
// Antes esta lógica vivía SOLO en el endpoint POST /api/email/send, que estaba
// SIN autenticación → cualquiera lo usaba como relay abierto para mandar correo
// a nombre de SACS (phishing/spam). Ahora los llamadores server-to-server usan
// esta función directo (sin HTTP), y el endpoint quedó detrás de sesión admin.
import { supabase } from './supabase';

const RESEND_API_KEY = (import.meta.env.RESEND_API_KEY || '').trim();
const NOTIFY_FROM = (import.meta.env.NOTIFY_FROM || 'SACS <onboarding@resend.dev>').trim();

export interface SendEmailArgs {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  contact_id?: string | null;
  template_id?: string | null;
  automation_id?: string | null;
  enrollment_id?: string | null;
  step_id?: string | null;
}

export interface SendEmailResult {
  id?: string;
  provider_id: string | null;
  status: 'sent' | 'failed' | 'queued' | 'contact_unsubscribed';
  error: string | null;
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const { to, subject } = args;
  if (!to || !subject) return { provider_id: null, status: 'failed', error: 'to and subject required' };

  // Respetar bajas: no reenviar a quien se desuscribió.
  const { data: unsub } = await supabase
    .from('email_unsubscribes')
    .select('id')
    .eq('email', to)
    .is('resubscribed_at', null)
    .limit(1)
    .maybeSingle();
  if (unsub) return { provider_id: null, status: 'contact_unsubscribed', error: null };

  let providerMessageId: string | null = null;
  let estado: SendEmailResult['status'] = 'queued';
  let errorMessage: string | null = null;

  if (RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: NOTIFY_FROM, to: [to], subject, html: args.html || undefined, text: args.text || undefined }),
      });
      const result = await res.json().catch(() => ({} as any));
      if (result.id) { providerMessageId = result.id; estado = 'sent'; }
      else { errorMessage = result.message || result.error || 'Unknown Resend error'; estado = 'failed'; }
    } catch (err) { errorMessage = String(err); estado = 'failed'; }
  }

  const { data: send } = await supabase
    .from('email_sends')
    .insert({
      contact_id: args.contact_id || null,
      template_id: args.template_id || null,
      automation_id: args.automation_id || null,
      enrollment_id: args.enrollment_id || null,
      step_id: args.step_id || null,
      email_to: to,
      email_provider: 'resend',
      provider_message_id: providerMessageId,
      estado,
      sent_at: estado === 'sent' ? new Date().toISOString() : null,
      error_message: errorMessage,
    })
    .select()
    .single();

  return { id: send?.id, provider_id: providerMessageId, status: estado, error: errorMessage };
}
