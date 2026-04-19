// Notification wrapper — pluggable channels. v1 = email only (via Resend).
// v2 will add WhatsApp (Kapso) without changing callsites.

const RESEND_API_KEY = (import.meta.env.RESEND_API_KEY || '').trim();
const INTERNAL_FROM = (import.meta.env.NOTIFY_FROM || 'SACS <onboarding@resend.dev>').trim();
const INTERNAL_SALES_EMAIL = (import.meta.env.SALES_INBOX || 'ventas@sacscloud.com').trim();

export type NotifyChannel = 'email' | 'whatsapp'; // whatsapp not active yet

export interface NotifyArgs {
  channel: NotifyChannel;
  to: string;
  subject?: string;
  template: string;
  data?: Record<string, any>;
  cc?: string[];
}

export type Template = (data: any) => { subject: string; html: string; text?: string };

const templates: Record<string, Template> = {
  quote_accepted_owner: (d) => ({
    subject: `✅ Cotización ${d.numero || ''} aceptada — ${d.empresa || ''}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
        <h2 style="font-size:1.25rem;margin:0 0 12px;color:#1a1a1a">Cliente aceptó la cotización</h2>
        <p style="color:#555;line-height:1.55;margin:0 0 16px">
          <strong>${d.empresa || 'Cliente'}</strong> aceptó la cotización <strong>${d.numero || ''}</strong> por <strong>$${Number(d.total || 0).toLocaleString('es-MX')} ${d.moneda || 'MXN'}</strong>.
        </p>
        <div style="background:#fafafa;border:1px solid #e5e5e5;padding:16px;border-radius:8px;margin:16px 0">
          <div style="font-size:0.75rem;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Detalles</div>
          <table style="width:100%;font-size:0.875rem;color:#555;border-collapse:collapse">
            <tr><td style="padding:4px 0;width:140px;color:#999">Contacto</td><td style="padding:4px 0">${d.contacto || '—'}</td></tr>
            <tr><td style="padding:4px 0;color:#999">Email</td><td style="padding:4px 0">${d.email || '—'}</td></tr>
            <tr><td style="padding:4px 0;color:#999">WhatsApp</td><td style="padding:4px 0">${d.whatsapp || '—'}</td></tr>
            <tr><td style="padding:4px 0;color:#999">Método</td><td style="padding:4px 0">${d.method || 'firma digital'}</td></tr>
            ${d.nota_interna ? `<tr><td style="padding:4px 0;color:#999">Nota</td><td style="padding:4px 0">${d.nota_interna}</td></tr>` : ''}
          </table>
        </div>
        <a href="${d.adminUrl || 'https://www.sacscloud.com/admin/crm?tab=cotizaciones'}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.875rem">Abrir deal en CRM</a>
        <p style="color:#999;font-size:0.75rem;margin-top:24px">Siguiente paso: generar link de pago y comenzar onboarding.</p>
      </div>
    `,
    text: `Cliente ${d.empresa} aceptó cotización ${d.numero} por $${d.total} ${d.moneda || 'MXN'}. Abrir en CRM: ${d.adminUrl || ''}`,
  }),
  quote_rejected_owner: (d) => ({
    subject: `❌ Cotización ${d.numero || ''} rechazada — ${d.empresa || ''}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
        <h2 style="font-size:1.25rem;margin:0 0 12px;color:#1a1a1a">Cliente rechazó la cotización</h2>
        <p style="color:#555;line-height:1.55;margin:0 0 16px">
          <strong>${d.empresa || 'Cliente'}</strong> rechazó la cotización <strong>${d.numero || ''}</strong>.
        </p>
        <div style="background:#fafafa;border-left:3px solid #c62828;padding:16px;margin:16px 0">
          <div style="font-size:0.75rem;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Motivo</div>
          <div style="font-size:1rem;font-weight:600;color:#1a1a1a">${d.motivo_label || d.motivo || '—'}</div>
          ${d.detalle ? `<div style="color:#555;margin-top:8px;font-size:0.875rem;line-height:1.5">${d.detalle}</div>` : ''}
        </div>
        <a href="${d.adminUrl || 'https://www.sacscloud.com/admin/crm?tab=cotizaciones'}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.875rem">Ver en CRM</a>
      </div>
    `,
    text: `${d.empresa} rechazó la cotización ${d.numero}. Motivo: ${d.motivo_label || d.motivo}. ${d.detalle || ''}`,
  }),
  quote_reminder_client: (d) => ({
    subject: `Recordatorio: tu cotización ${d.numero || ''} de SACS`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
        <h2 style="font-size:1.375rem;font-weight:300;margin:0 0 12px;color:#1a1a1a;letter-spacing:-0.01em">Hola ${d.contacto || ''},</h2>
        <p style="color:#555;line-height:1.6;margin:0 0 16px">
          Te comparto nuevamente tu cotización <strong>${d.numero || ''}</strong> por $${Number(d.total || 0).toLocaleString('es-MX')} ${d.moneda || 'MXN'}.
        </p>
        <p style="color:#555;line-height:1.6;margin:0 0 20px">
          ${d.cta_text || '¿Pudiste revisarla? Si tienes dudas estoy a tu orden.'}
        </p>
        <a href="${d.quoteUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.875rem">Ver cotización</a>
        <p style="color:#999;font-size:0.75rem;margin-top:24px;line-height:1.5">Saludos,<br/>Equipo SACS</p>
      </div>
    `,
    text: `Hola ${d.contacto || ''}, te recordamos tu cotización ${d.numero}: ${d.quoteUrl}`,
  }),
  renewal_reminder: (d) => ({
    subject: `Tu renovación SACS se acerca — ${d.days} días`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
        <h2 style="font-size:1.25rem;margin:0 0 12px">Hola ${d.contacto || ''},</h2>
        <p style="color:#555;line-height:1.55">Tu suscripción SACS se renueva en <strong>${d.days} días</strong> (${d.fecha}).</p>
        <p style="color:#555;line-height:1.55">Monto: <strong>$${Number(d.total || 0).toLocaleString('es-MX')} ${d.moneda || 'MXN'}</strong>.</p>
        ${d.action_required ? `<p style="color:#c62828;line-height:1.55"><strong>Acción requerida:</strong> ${d.action_required}</p>` : ''}
        <p style="color:#999;font-size:0.75rem;margin-top:24px">Cualquier duda, respóndenos a este correo.</p>
      </div>
    `,
    text: `Tu renovación SACS se acerca: ${d.days} días. Monto $${d.total} ${d.moneda || 'MXN'}`,
  }),
};

async function sendEmailViaResend(to: string, subject: string, html: string, text?: string, cc?: string[]) {
  if (!RESEND_API_KEY) {
    console.warn('[notify] RESEND_API_KEY not set — skipping email');
    return { ok: false, reason: 'no_api_key' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: INTERNAL_FROM,
        to: [to],
        cc: cc && cc.length ? cc : undefined,
        subject,
        html,
        text,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, reason: data?.message || 'provider_error' };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

export async function notify(args: NotifyArgs): Promise<{ ok: boolean; reason?: string; id?: string }> {
  if (args.channel === 'whatsapp') {
    // v2: not yet available
    return { ok: false, reason: 'whatsapp_not_available_yet' };
  }
  if (args.channel !== 'email') {
    return { ok: false, reason: 'unknown_channel' };
  }
  const tpl = templates[args.template];
  if (!tpl) {
    return { ok: false, reason: `template_not_found:${args.template}` };
  }
  const rendered = tpl(args.data || {});
  const subject = args.subject || rendered.subject;
  return sendEmailViaResend(args.to, subject, rendered.html, rendered.text, args.cc);
}

export function getSalesInbox() {
  return INTERNAL_SALES_EMAIL;
}
