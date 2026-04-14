import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const sid = url.searchParams.get('sid');
  const email = url.searchParams.get('email');
  const confirmed = url.searchParams.get('confirmed');

  if (!sid && !email) {
    return new Response('Missing parameters', { status: 400 });
  }

  // If confirmed, process the unsubscribe
  if (confirmed === '1') {
    let contactId: string | null = null;
    let contactEmail: string | null = email || null;

    // Get contact from email_send
    if (sid) {
      const { data: send } = await supabase
        .from('email_sends')
        .select('contact_id, email_to')
        .eq('id', sid)
        .single();
      if (send) {
        contactId = send.contact_id;
        contactEmail = send.email_to;
      }
    }

    // Find contact by email if no sid
    if (!contactId && contactEmail) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', contactEmail)
        .limit(1)
        .single();
      if (contact) contactId = contact.id;
    }

    if (contactId && contactEmail) {
      // Insert unsubscribe record
      await supabase.from('email_unsubscribes').upsert({
        contact_id: contactId,
        email: contactEmail,
        scope: 'all',
      }, { onConflict: 'email' });

      // Update email_send
      if (sid) {
        await supabase.from('email_sends').update({
          estado: 'unsubscribed',
          unsubscribed_at: new Date().toISOString(),
        }).eq('id', sid);
      }

      // Unenroll from all active automations
      await supabase.from('automation_enrollments').update({
        estado: 'unenrolled',
        unenrollment_reason: 'unsubscribed',
      }).eq('contact_id', contactId).eq('estado', 'activo');

      // Log activity
      await supabase.from('activities').insert({
        contact_id: contactId,
        tipo: 'email_unsubscribed',
        titulo: 'Se dio de baja de emails',
        automatico: true,
      });
    }

    // Show confirmation page
    return new Response(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cancelar suscripción — SACS</title>
<style>body{font-family:'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif;background:#FAFAF8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#1A1A1A;}
.card{background:#fff;border-radius:16px;padding:48px;max-width:400px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.06);}
h1{font-size:1.25rem;margin:0 0 12px;}p{color:#888;font-size:0.875rem;line-height:1.6;margin:0;}
.check{width:48px;height:48px;background:#e8f5e9;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:1.5rem;}</style>
</head>
<body><div class="card">
<div class="check">✓</div>
<h1>Listo, te hemos dado de baja</h1>
<p>Ya no recibirás más correos de marketing de SACS. Si cambias de opinión, contacta a nuestro equipo.</p>
</div></body></html>`, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Show confirmation page (before confirming)
  const confirmUrl = `/api/email/unsubscribe?${sid ? `sid=${sid}&` : ''}${email ? `email=${encodeURIComponent(email)}&` : ''}confirmed=1`;

  return new Response(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cancelar suscripción — SACS</title>
<style>body{font-family:'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif;background:#FAFAF8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#1A1A1A;}
.card{background:#fff;border-radius:16px;padding:48px;max-width:400px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.06);}
h1{font-size:1.25rem;margin:0 0 12px;}p{color:#888;font-size:0.875rem;line-height:1.6;margin:0 0 24px;}
a.btn{display:inline-block;padding:12px 32px;background:#E54B4B;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:0.875rem;}
a.btn:hover{background:#c0392b;}</style>
</head>
<body><div class="card">
<h1>¿Deseas cancelar tu suscripción?</h1>
<p>Dejarás de recibir correos de marketing de SACS. Los correos transaccionales (pagos, facturas) seguirán llegando.</p>
<a href="${confirmUrl}" class="btn">Sí, cancelar suscripción</a>
</div></body></html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
};
