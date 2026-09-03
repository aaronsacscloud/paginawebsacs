// GET/POST /api/debug/email-test
// Endpoint admin para diagnosticar la cadena de correo (SendGrid).
// GET → muestra config sin secretos
// POST { to, template? } → manda un correo de prueba y devuelve el resultado
//
// Uso:
//   curl https://www.sacscloud.com/api/debug/email-test
//   curl -X POST https://www.sacscloud.com/api/debug/email-test \
//     -H "Content-Type: application/json" -H "x-user-id: founder" \
//     -d '{"to":"tu@correo.com"}'

import type { APIRoute } from 'astro';
import { notify, getSalesInbox } from '../../../lib/notify';
import { getCurrentUser } from '../../../lib/auth/scope';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  const hasKey = !!(import.meta.env.SENDGRID_API_KEY || '').trim();
  const salesInbox = (import.meta.env.SALES_INBOX || '').trim() || 'ventas@sacscloud.com (default)';

  // El remitente ya NO sale de una variable de entorno: sale del inquilino
  // `sacs` en email_tenants, que es donde vive el dominio verificado.
  const { data: t } = await supabase
    .from('email_tenants')
    .select('from_nombre, from_email, reply_to, sendgrid_domain_id')
    .eq('slug', 'sacs')
    .maybeSingle();

  return new Response(JSON.stringify({
    proveedor: 'sendgrid',
    sendgrid_key_configured: hasKey,
    remitente: t ? `${t.from_nombre} <${t.from_email}>` : null,
    reply_to: t?.reply_to || null,
    dominio_verificado: t?.sendgrid_domain_id || null,
    sales_inbox: salesInbox,
    warnings: [
      ...(!hasKey ? ['SENDGRID_API_KEY no está configurado — no sale ningún correo'] : []),
      ...(!t ? ['No existe el inquilino `sacs` en email_tenants — se usa el remitente de respaldo'] : []),
    ],
  }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user || (user.role !== 'founder' && user.role !== 'cs')) {
    return new Response(JSON.stringify({ error: 'Solo admin puede usar este endpoint' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const body = await request.json().catch(() => ({})) as { to?: string; template?: string };
  const to = (body.to || '').trim();
  if (!to) {
    return new Response(JSON.stringify({ error: '"to" es requerido en body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const template = body.template || 'partner_password_reset';
  const result = await notify({
    channel: 'email',
    to,
    template,
    data: {
      nombre: 'Prueba de Email',
      programa: 'Embajador SACS',
      resetUrl: 'https://www.sacscloud.com/partner/reset-password?token=test',
      partnerLandingUrl: 'https://www.sacscloud.com/p/test',
      setPasswordUrl: 'https://www.sacscloud.com/partner/reset-password?token=test',
      loginUrl: 'https://www.sacscloud.com/partner/login',
      comision_pct: 50,
      nota: 'Esto es un email de prueba enviado desde el endpoint /api/debug/email-test',
    },
  });

  return new Response(JSON.stringify({
    sent_to: to,
    template,
    sales_inbox: getSalesInbox(),
    resend_response: result,
    interpretation: result.ok
      ? '✓ Resend aceptó el email. Verifica que llegó al inbox (revisa spam).'
      : `✗ Resend rechazó el envío. Reason: ${result.reason}. Si dice "you can only send testing emails to your own email address" → necesitas verificar dominio en Resend y configurar NOTIFY_FROM.`,
  }, null, 2), { status: result.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
};
