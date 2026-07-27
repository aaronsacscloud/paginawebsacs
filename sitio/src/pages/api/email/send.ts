// POST /api/email/send — envío de correo. AHORA REQUIERE sesión admin (founder/cs).
// Antes estaba SIN auth → relay abierto (cualquiera mandaba correo a nombre de
// SACS). Los llamadores internos server-to-server ya NO usan este endpoint: usan
// sendEmail() de src/lib/email.ts in-process.
import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../lib/auth/scope';
import { sendEmail } from '../../../lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user || (user.role !== 'founder' && user.role !== 'cs')) {
    return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const body = await request.json().catch(() => ({}));
  const { to, subject, html, text, contact_id, template_id, automation_id, enrollment_id, step_id } = body;
  if (!to || !subject) {
    return new Response(JSON.stringify({ error: 'to and subject required' }), { status: 400 });
  }

  const r = await sendEmail({ to, subject, html, text, contact_id, template_id, automation_id, enrollment_id, step_id });
  return new Response(JSON.stringify({ id: r.id, provider_id: r.provider_id, status: r.status, error: r.error }), { headers: { 'Content-Type': 'application/json' } });
};
