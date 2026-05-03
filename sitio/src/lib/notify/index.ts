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
  payment_receipt_client: (d) => {
    const fmt = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
    const metodoLabel: Record<string, string> = {
      transferencia: 'Transferencia bancaria',
      tarjeta: 'Tarjeta (Stripe)',
      efectivo: 'Efectivo',
      oxxo: 'OXXO',
      otro: 'Otro',
    };
    const metodo = metodoLabel[d.metodo] || d.metodo || '—';
    const itemsHtml = Array.isArray(d.items) && d.items.length
      ? `<div style="margin:18px 0 8px"><div style="font-size:0.6875rem;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Lo que adquirió</div>${d.items.map((it: any) => `<div style="display:flex;justify-content:space-between;font-size:0.875rem;color:#333;padding:4px 0;border-bottom:1px solid #f0f0f0"><span>${it.label}</span><span style="font-weight:600">${fmt(it.monto)}</span></div>`).join('')}</div>`
      : '';
    return {
      subject: `Acuse de pago ${d.numero_acuse || ''} — SACS`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;background:#FAFAF8">
          <div style="text-align:center;padding:8px 0 20px;border-bottom:1px solid #e5e5e5">
            <div style="font-size:0.6875rem;color:#999;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px">Acuse de pago</div>
            <div style="font-family:'Sora',sans-serif;font-size:1.5rem;font-weight:800;color:#1a1a1a;letter-spacing:-0.01em">${d.numero_acuse || '—'}</div>
            <div style="display:inline-block;margin-top:10px;padding:4px 12px;background:#2AB5A0;color:#fff;font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;border-radius:4px">Pago confirmado</div>
          </div>
          <p style="color:#555;line-height:1.6;margin:20px 0 12px">Hola ${d.contacto || ''},</p>
          <p style="color:#555;line-height:1.6;margin:0 0 16px">Confirmamos la recepción de tu pago por <strong>${fmt(d.monto)}</strong> correspondiente a la cotización <strong>${d.quote_numero || ''}</strong>.</p>
          <div style="background:#fff;border:1px solid #e5e5e5;padding:18px;border-radius:8px;margin:16px 0">
            <table style="width:100%;font-size:0.875rem;color:#333;border-collapse:collapse">
              <tr><td style="padding:6px 0;width:120px;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Método</td><td style="padding:6px 0;font-weight:600">${metodo}</td></tr>
              <tr><td style="padding:6px 0;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Fecha</td><td style="padding:6px 0">${d.fecha || '—'}</td></tr>
              ${d.referencia ? `<tr><td style="padding:6px 0;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Referencia</td><td style="padding:6px 0;font-family:monospace">${d.referencia}</td></tr>` : ''}
              <tr><td style="padding:6px 0;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Monto</td><td style="padding:6px 0;font-weight:800;font-size:1rem">${fmt(d.monto)}</td></tr>
            </table>
          </div>
          ${itemsHtml}
          ${d.saldoRestante > 0 ? `<div style="margin:16px 0;padding:14px;background:#fff8e1;border-left:3px solid #E8A838;font-size:0.875rem;color:#5a4a1f"><strong>Saldo restante:</strong> ${fmt(d.saldoRestante)} de ${fmt(d.totalCotizacion)}</div>` : `<div style="margin:16px 0;padding:14px;background:#e8f7f3;border-left:3px solid #2AB5A0;font-size:0.875rem;color:#1a5a4f"><strong>✓ Cotización pagada en su totalidad.</strong></div>`}
          <div style="text-align:center;margin:24px 0">
            <a href="${d.acuseUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.875rem">Ver acuse completo</a>
          </div>
          <p style="color:#999;font-size:0.75rem;line-height:1.5;margin:24px 0 0;text-align:center">Este acuse confirma la recepción de tu pago. No constituye un comprobante fiscal (CFDI).</p>
          <p style="color:#bbb;font-size:0.6875rem;line-height:1.5;margin-top:12px;text-align:center">SACS Cloud · administracion@sacscloud.com</p>
        </div>
      `,
      text: `Acuse ${d.numero_acuse}: pago de ${fmt(d.monto)} por ${metodo} recibido. Ver: ${d.acuseUrl}`,
    };
  },
  partner_submitted_user: (d) => ({
    subject: `Recibimos tu solicitud · Programa ${d.programa || 'Partners SACS'}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
        <h2 style="font-size:1.375rem;font-weight:300;margin:0 0 12px;letter-spacing:-0.01em">Hola ${d.nombre || ''},</h2>
        <p style="color:#555;line-height:1.6;margin:0 0 16px">
          Recibimos tu solicitud para el programa <strong>${d.programa || 'Partners SACS'}</strong>. Nuestro equipo la revisará y te contactaremos en las próximas <strong>24-48 horas hábiles</strong> para activar tu cuenta.
        </p>
        <div style="background:#fafafa;border-left:3px solid #4B7BE5;padding:14px 16px;margin:18px 0;font-size:0.875rem;color:#444;line-height:1.55">
          <strong>¿Qué sigue?</strong><br/>
          1. Validamos tus datos de cobro y dirección<br/>
          2. Aprobamos tu programa y creamos tu cuenta SACS<br/>
          3. Te enviamos credenciales + tu link único de partner
        </div>
        <p style="color:#555;line-height:1.6;margin:0 0 16px">
          Mientras tanto, puedes revisar de nuevo los términos de tu invitación cuando quieras:
        </p>
        <a href="${d.partnerUrl || ''}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.875rem">Ver mi invitación</a>
        <p style="color:#999;font-size:0.75rem;margin-top:24px;line-height:1.5">Cualquier duda, responde directo a este correo.<br/>Equipo SACS · partners@sacscloud.com</p>
      </div>
    `,
    text: `Hola ${d.nombre || ''}, recibimos tu solicitud para ${d.programa}. La revisaremos en 24-48h. Ver invitación: ${d.partnerUrl || ''}`,
  }),
  partner_submitted_admin: (d) => {
    const payoutLine = d.payout
      ? d.payout.method === 'clabe'
        ? `CLABE ${d.payout.clabe || '—'} (${d.payout.banco || ''}) · titular ${d.payout.titular || '—'}${d.payout.rfc ? ` · RFC ${d.payout.rfc}` : ''}`
        : d.payout.method === 'paypal'
          ? `PayPal: ${d.payout.email || '—'}`
          : `Mercado Pago: ${d.payout.mp_id || '—'}${d.payout.titular ? ` · titular ${d.payout.titular}` : ''}`
      : '—';
    const dirLine = d.direccion
      ? [d.direccion.calle, d.direccion.colonia, d.direccion.cp, d.direccion.ciudad, d.direccion.estado].filter(Boolean).join(', ')
      : '—';
    return {
      subject: `🤝 Nueva solicitud de partner: ${d.nombre || ''} · ${d.programa || ''}`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
          <h2 style="font-size:1.25rem;margin:0 0 8px">Nueva solicitud de partner</h2>
          <p style="color:#555;line-height:1.55;margin:0 0 16px">
            <strong>${d.nombre || ''}</strong> firmó la invitación <strong>${d.numero || ''}</strong> y está pendiente de aprobación.
          </p>
          <div style="background:#fafafa;border:1px solid #ececec;padding:16px;border-radius:8px;margin:16px 0">
            <table style="width:100%;font-size:0.875rem;color:#444;border-collapse:collapse">
              <tr><td style="padding:5px 0;width:120px;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Programa</td><td style="padding:5px 0;font-weight:600">${d.programa || ''}</td></tr>
              <tr><td style="padding:5px 0;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Comisión</td><td style="padding:5px 0;font-weight:600">${d.comision_pct || 0}%</td></tr>
              <tr><td style="padding:5px 0;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Email</td><td style="padding:5px 0">${d.email || '—'}</td></tr>
              <tr><td style="padding:5px 0;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">WhatsApp</td><td style="padding:5px 0">${d.whatsapp || '—'}</td></tr>
              <tr><td style="padding:5px 0;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Empresa</td><td style="padding:5px 0">${d.empresa || '—'}</td></tr>
              <tr><td style="padding:5px 0;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Dirección</td><td style="padding:5px 0">${dirLine}</td></tr>
              <tr><td style="padding:5px 0;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Cobro</td><td style="padding:5px 0">${payoutLine}</td></tr>
            </table>
          </div>
          <a href="${d.adminUrl || 'https://www.sacscloud.com/admin/crm?tab=partners'}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.875rem">Revisar y aprobar en CRM</a>
          <p style="color:#999;font-size:0.75rem;margin-top:24px">Aprobar dispara: creación de team_member + email de bienvenida al partner.</p>
        </div>
      `,
      text: `Nueva solicitud de partner: ${d.nombre} (${d.email}) — ${d.programa}, ${d.comision_pct}%. Revisar: ${d.adminUrl}`,
    };
  },
  partner_approved_user: (d) => ({
    subject: `🎉 Bienvenido a ${d.programa || 'Partners SACS'}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
        <div style="text-align:center;margin-bottom:20px">
          <div style="display:inline-block;padding:6px 14px;background:#2AB5A0;color:#fff;font-size:0.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;border-radius:4px">Programa activado</div>
        </div>
        <h2 style="font-size:1.5rem;font-weight:700;margin:0 0 12px;letter-spacing:-0.01em;text-align:center">¡Bienvenido, ${d.nombre || 'partner'}!</h2>
        <p style="color:#555;line-height:1.6;margin:0 0 16px;text-align:center">
          Tu programa <strong>${d.programa || 'Partner SACS'}</strong> está activo con una comisión del <strong>${d.comision_pct || 0}%</strong>.
        </p>
        ${d.nota ? `<div style="background:#fff8e1;border-left:3px solid #E8A838;padding:12px 14px;margin:18px 0;font-size:0.875rem;color:#5a4a1f;line-height:1.55">${d.nota}</div>` : ''}
        <div style="background:#1a1a1a;color:#fff;padding:20px;border-radius:10px;margin:18px 0;text-align:center">
          <div style="font-size:0.6875rem;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.10em;margin-bottom:10px">Paso 1 — Crea tu contraseña</div>
          <p style="color:rgba(255,255,255,0.85);font-size:0.875rem;line-height:1.5;margin:0 0 16px">
            Para entrar a tu portal de partner necesitas una contraseña. Crea la tuya aquí:
          </p>
          <a href="${d.setPasswordUrl || ''}" style="display:inline-block;background:#fff;color:#1a1a1a;padding:13px 26px;border-radius:6px;text-decoration:none;font-weight:700;font-size:0.875rem">Crear mi contraseña</a>
          <div style="font-size:0.6875rem;color:rgba(255,255,255,0.5);margin-top:12px">Este link expira en 14 días.</div>
        </div>
        <div style="background:#fafafa;border:1px solid #ececec;padding:18px;border-radius:10px;margin:18px 0">
          <div style="font-size:0.6875rem;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">Tu link único de partner</div>
          <a href="${d.partnerLandingUrl || ''}" style="font-family:monospace;font-size:0.875rem;color:#4B7BE5;word-break:break-all">${d.partnerLandingUrl || ''}</a>
          <div style="font-size:0.75rem;color:#777;margin-top:8px;line-height:1.5">Cualquier prospecto que llegue por este link se atribuye automáticamente a ti — visible en tiempo real desde tu portal.</div>
        </div>
        <div style="background:#fafafa;border:1px solid #ececec;padding:14px 16px;border-radius:8px;margin:14px 0;font-size:0.8125rem;color:#555;line-height:1.5">
          📘 <strong>Brand kit:</strong> <a href="https://www.sacscloud.com/partners/brand-kit" style="color:#4B7BE5">descarga logos, captions y plantillas</a>.<br/>
          🛍️ <strong>Tu cuenta SACS Plan Fideliza:</strong> la activamos en las próximas 48h hábiles, te llegará un correo aparte con tus credenciales.
        </div>
        <p style="color:#999;font-size:0.75rem;margin-top:24px;line-height:1.5;text-align:center">Cualquier duda: partners@sacscloud.com</p>
      </div>
    `,
    text: `¡Bienvenido ${d.nombre}! Tu programa ${d.programa} está activo (${d.comision_pct}% comisión). Crea tu contraseña: ${d.setPasswordUrl}. Tu link: ${d.partnerLandingUrl}.`,
  }),
  partner_fideliza_ready: (d) => ({
    subject: `🛍️ Tu cuenta SACS Plan Fideliza está lista`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
        <div style="text-align:center;margin-bottom:20px">
          <div style="display:inline-block;padding:6px 14px;background:#6C5CE7;color:#fff;font-size:0.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;border-radius:4px">Cuenta SACS activa</div>
        </div>
        <h2 style="font-size:1.5rem;font-weight:700;margin:0 0 12px;letter-spacing:-0.01em;text-align:center">Tu Plan Fideliza está listo, ${d.nombre || ''}</h2>
        <p style="color:#555;line-height:1.6;margin:0 0 16px;text-align:center">
          Como parte del programa, te activamos una cuenta completa de SACS en el plan <strong>Fideliza</strong> (valor $14,000 MXN/año). Úsalo para tu propio negocio o para hacer demos en vivo a tus prospectos.
        </p>
        ${d.nota ? `<div style="background:#fff8e1;border-left:3px solid #E8A838;padding:12px 14px;margin:18px 0;font-size:0.875rem;color:#5a4a1f;line-height:1.55">${d.nota}</div>` : ''}
        <div style="background:#1a1a1a;color:#fff;padding:24px;border-radius:10px;margin:18px 0;text-align:center">
          <div style="font-size:0.6875rem;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.10em;margin-bottom:10px">Cómo entrar</div>
          <p style="color:rgba(255,255,255,0.85);font-size:0.875rem;line-height:1.5;margin:0 0 16px">
            Entra a <strong>app.sacscloud.com</strong> con tu email <strong>${d.email}</strong> y la contraseña temporal que te enviaremos por separado para máxima seguridad.
          </p>
          <a href="${d.loginUrl || 'https://app.sacscloud.com'}" style="display:inline-block;background:#fff;color:#1a1a1a;padding:13px 26px;border-radius:6px;text-decoration:none;font-weight:700;font-size:0.875rem">Ir a app.sacscloud.com</a>
        </div>
        <div style="background:#fafafa;border:1px solid #ececec;padding:14px 16px;border-radius:8px;margin:14px 0;font-size:0.8125rem;color:#555;line-height:1.6">
          <strong>Plan Fideliza incluye:</strong><br/>
          ✓ POS multi-terminal<br/>
          ✓ Inventario multi-sucursal<br/>
          ✓ E-commerce sincronizado<br/>
          ✓ CRM omnicanal + lealtad<br/>
          ✓ Email + WhatsApp marketing<br/>
          ✓ 5 sucursales · 5 usuarios incluidos
        </div>
        <p style="color:#999;font-size:0.75rem;margin-top:24px;line-height:1.5;text-align:center">¿Necesitas ayuda? Responde este correo.<br/>Equipo SACS · partners@sacscloud.com</p>
      </div>
    `,
    text: `Tu cuenta SACS Plan Fideliza está activa. Entra a ${d.loginUrl || 'app.sacscloud.com'} con ${d.email}.`,
  }),
  partner_commission_earned: (d) => {
    const fmt = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
    return {
      subject: `✓ Tu bono fue verificado · ${fmt(d.monto)} disponibles`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
          <div style="text-align:center;margin-bottom:18px">
            <div style="display:inline-block;padding:6px 14px;background:#2AB5A0;color:#fff;font-size:0.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:0.10em;border-radius:4px">Bono verificado</div>
          </div>
          <h2 style="font-size:1.375rem;font-weight:600;margin:0 0 12px;letter-spacing:-0.01em;text-align:center">Bien hecho, ${d.nombre || 'partner'}.</h2>
          <p style="color:#555;line-height:1.6;margin:0 0 16px;text-align:center">
            Verificamos tu bono por <strong>${d.tipo}</strong>. Ya está acreditado a tu balance.
          </p>
          <div style="text-align:center;margin:22px 0">
            <div style="display:inline-block;padding:18px 28px;background:#fafafa;border:1px solid #ececec;border-radius:12px">
              <div style="font-size:0.6875rem;color:#999;text-transform:uppercase;letter-spacing:0.10em;margin-bottom:6px">Bono acreditado</div>
              <div style="font-family:'Sora',sans-serif;font-size:2rem;font-weight:800;color:#2AB5A0;letter-spacing:-0.015em">${fmt(d.monto)}</div>
            </div>
          </div>
          <p style="color:#555;line-height:1.6;margin:0 0 20px;text-align:center;font-size:0.875rem">
            Se sumará a tu próximo payout (cada 30 días) — o si tienes preguntas, escríbenos.
          </p>
          <div style="text-align:center">
            <a href="${d.portalUrl || ''}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.875rem">Ver mi portal</a>
          </div>
          <p style="color:#bbb;font-size:0.6875rem;margin-top:24px;text-align:center">SACS Partners · partners@sacscloud.com</p>
        </div>
      `,
      text: `Tu bono por ${d.tipo} (${fmt(d.monto)}) fue verificado. Ver portal: ${d.portalUrl}`,
    };
  },
  partner_commission_paid: (d) => {
    const fmt = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
    return {
      subject: d.bulk
        ? `🏦 Recibiste tu pago · ${fmt(d.monto)} (${d.tipo})`
        : `🏦 Recibiste tu pago · ${fmt(d.monto)}`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
          <div style="text-align:center;margin-bottom:18px">
            <div style="display:inline-block;padding:6px 14px;background:#1A8F7A;color:#fff;font-size:0.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:0.10em;border-radius:4px">Pago liquidado</div>
          </div>
          <h2 style="font-size:1.5rem;font-weight:600;margin:0 0 12px;letter-spacing:-0.01em;text-align:center">${fmt(d.monto)} en camino, ${d.nombre || 'partner'} 🎉</h2>
          <p style="color:#555;line-height:1.6;margin:0 0 16px;text-align:center">
            ${d.bulk
              ? `SACS liquidó <strong>${d.tipo}</strong> en un solo payout.`
              : `SACS liquidó tu comisión por <strong>${d.tipo}</strong>.`}
          </p>
          <div style="background:#fafafa;border:1px solid #ececec;padding:18px;border-radius:10px;margin:18px 0">
            <table style="width:100%;font-size:0.875rem;color:#444;border-collapse:collapse">
              <tr><td style="padding:6px 0;width:140px;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Concepto</td><td style="padding:6px 0;font-weight:600">${d.tipo}</td></tr>
              <tr><td style="padding:6px 0;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Monto</td><td style="padding:6px 0;font-weight:800;font-size:1rem">${fmt(d.monto)}</td></tr>
              <tr><td style="padding:6px 0;color:#999;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Referencia</td><td style="padding:6px 0;font-family:monospace;font-size:0.8125rem">${d.payment_reference || '—'}</td></tr>
            </table>
          </div>
          <div style="text-align:center;margin:22px 0">
            <a href="${d.portalUrl || ''}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.875rem">Ver desglose en mi portal</a>
          </div>
          <p style="color:#bbb;font-size:0.6875rem;margin-top:20px;text-align:center;line-height:1.5">El depósito puede tardar 1–2 días hábiles en reflejarse en tu cuenta.<br/>SACS Partners · partners@sacscloud.com</p>
        </div>
      `,
      text: `Recibiste un pago de ${fmt(d.monto)} por ${d.tipo}. Ref: ${d.payment_reference}. Ver: ${d.portalUrl}`,
    };
  },
  partner_password_reset: (d) => ({
    subject: `Restablece tu contraseña — Partners SACS`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
        <h2 style="font-size:1.25rem;font-weight:700;margin:0 0 12px">Hola ${d.nombre || ''},</h2>
        <p style="color:#555;line-height:1.6;margin:0 0 16px">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta de partner SACS.
          Click el botón para crear una nueva:
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${d.resetUrl || ''}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:13px 26px;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.875rem">Restablecer contraseña</a>
        </div>
        <p style="color:#777;font-size:0.8125rem;line-height:1.5;margin:0 0 8px">
          Este link expira en <strong>1 hora</strong>. Si tú no solicitaste el cambio, puedes ignorar este correo — tu contraseña actual sigue funcionando.
        </p>
        <p style="color:#999;font-size:0.75rem;margin-top:20px;line-height:1.5">Equipo SACS · partners@sacscloud.com</p>
      </div>
    `,
    text: `Restablece tu contraseña: ${d.resetUrl} (expira en 1h)`,
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
