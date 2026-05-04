// GET/POST /api/debug/email-test
// Endpoint admin para diagnosticar la cadena de email Resend.
// GET → muestra config sin secretos
// POST { to, template? } → manda email de prueba y devuelve respuesta cruda de Resend
//
// Uso:
//   curl https://www.sacscloud.com/api/debug/email-test
//   curl -X POST https://www.sacscloud.com/api/debug/email-test \
//     -H "Content-Type: application/json" -H "x-user-id: founder" \
//     -d '{"to":"tu@correo.com"}'

import type { APIRoute } from 'astro';
import { notify, getSalesInbox } from '../../../lib/notify';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

export const GET: APIRoute = async () => {
  const hasKey = !!(import.meta.env.RESEND_API_KEY || '').trim();
  const from = (import.meta.env.NOTIFY_FROM || '').trim();
  const fromEffective = from || 'SACS <onboarding@resend.dev> (DEFAULT — solo envía a email registrado en Resend)';
  const salesInbox = (import.meta.env.SALES_INBOX || '').trim() || 'ventas@sacscloud.com (default)';

  return new Response(JSON.stringify({
    resend_key_configured: hasKey,
    notify_from: fromEffective,
    notify_from_is_default: !from,
    sales_inbox: salesInbox,
    warnings: [
      ...(!hasKey ? ['RESEND_API_KEY no está configurado — emails desactivados completamente'] : []),
      ...(!from ? ['NOTIFY_FROM no configurado — usando onboarding@resend.dev que SOLO envía a tu email registrado en Resend. Configura NOTIFY_FROM con dominio verificado para enviar a partners.'] : []),
    ],
    next_steps: [
      '1. Verifica dominio en https://resend.com/domains (ej. sacscloud.com)',
      '2. Configura NOTIFY_FROM en Vercel env: NOTIFY_FROM="SACS <hola@sacscloud.com>"',
      '3. Prueba: POST a este endpoint con {"to":"tu_email@..."}',
      '4. Si devuelve {ok:true} → ya funciona',
      '5. Si devuelve {ok:false, reason:"..."} → mira el reason exacto',
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
