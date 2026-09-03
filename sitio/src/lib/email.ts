// Envío de correo transaccional IN-PROCESS + registro en email_sends.
//
// Antes esta lógica vivía SOLO en el endpoint POST /api/email/send, que estaba
// SIN autenticación → cualquiera lo usaba como relay abierto para mandar correo
// a nombre de SACS (phishing/spam). Ahora los llamadores server-to-server usan
// esta función directo (sin HTTP), y el endpoint quedó detrás de sesión admin.
//
// ── Por qué ya NO va por Resend (2026-09-03) ─────────────────────────────
// Iba por Resend con el remitente de fábrica `onboarding@resend.dev`, y una
// cuenta de Resend sin dominio verificado **solo entrega al dueño de la
// cuenta**. Medido en producción: un aviso a aaron@sacscloud.com falló con
// "You can only send testing emails to your own email address
// (sacscloud@gmail.com)". O sea, TODO el correo transaccional del sitio
// —confirmaciones de cita, cancelaciones, reagendas, avisos del brief— llevaba
// tiempo fallando en silencio contra cualquier destinatario real.
//
// Ahora sale por el mismo camino que sí entrega todos los días: SendGrid con el
// remitente verificado del inquilino (`aaron@news.sacscloud.com`). Un solo
// proveedor para todo el correo del sistema; si mañana hay que cambiarlo, se
// cambia en `email/proveedor.ts` y no en veinte llamadores.
import { supabase } from './supabase';
import { enviar } from './email/proveedor';
import { htmlATexto } from './email/footer';

const TENANT = 'sacs';

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
  /** Para el tablero y el webhook: 'relacion', 'cita', 'brief'… */
  categoria?: string | null;
  /**
   * Correo TRANSACCIONAL: se salta la lista de bajas de marketing y no lleva
   * el grupo de supresión. Una baja de campaña no puede dejar a alguien sin la
   * confirmación de su cita ni sin las preguntas de su proyecto.
   */
  transaccional?: boolean;
}

export interface SendEmailResult {
  id?: string;
  provider_id: string | null;
  status: 'sent' | 'failed' | 'queued' | 'contact_unsubscribed';
  error: string | null;
}

type Remitente = {
  id: string;
  from_email: string;
  from_nombre: string;
  reply_to: string | null;
  sendgrid_asm_group_id: number | null;
};

let cache: Remitente | null = null;

async function remitente(): Promise<Remitente> {
  if (cache) return cache;
  const { data } = await supabase
    .from('email_tenants')
    .select('id, from_email, from_nombre, reply_to, sendgrid_asm_group_id')
    .eq('slug', TENANT)
    .maybeSingle();
  cache = {
    id: (data as any)?.id || '',
    from_email: (data as any)?.from_email || 'aaron@news.sacscloud.com',
    from_nombre: (data as any)?.from_nombre || 'Sacs',
    reply_to: (data as any)?.reply_to || null,
    sendgrid_asm_group_id: (data as any)?.sendgrid_asm_group_id ?? null,
  };
  return cache;
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const { to, subject } = args;
  if (!to || !subject) return { provider_id: null, status: 'failed', error: 'to and subject required' };

  // Respetar bajas — salvo en transaccional, donde la baja es de marketing y
  // no de las notificaciones del propio servicio que la persona contrató.
  if (!args.transaccional) {
    const { data: unsub } = await supabase
      .from('email_unsubscribes')
      .select('id')
      .eq('email', to)
      .is('resubscribed_at', null)
      .limit(1)
      .maybeSingle();
    if (unsub) return { provider_id: null, status: 'contact_unsubscribed', error: null };
  }

  const r = await remitente();

  // La fila se crea ANTES de mandar, por dos razones: su id viaja como
  // `custom_args.send` para que los eventos del webhook (entregado, abierto,
  // rebotado) sepan a qué envío pertenecen — sin eso el tablero se queda en
  // ceros —, y porque si el envío revienta igual queda el rastro.
  const { data: send } = await supabase
    .from('email_sends')
    .insert({
      contact_id: args.contact_id || null,
      template_id: args.template_id || null,
      automation_id: args.automation_id || null,
      enrollment_id: args.enrollment_id || null,
      step_id: args.step_id || null,
      tenant_id: r.id || null,
      email_to: to,
      email_provider: 'sendgrid',
      estado: 'queued',
      asunto: subject,
      categoria: args.categoria || null,
    })
    .select('id')
    .single();

  const html = args.html || `<p>${(args.text || '').replace(/\n/g, '<br>')}</p>`;
  const texto = args.text || htmlATexto(html);

  const res = await enviar({
    para: to,
    asunto: subject,
    html,
    texto,
    fromEmail: r.from_email,
    fromNombre: r.from_nombre,
    replyTo: r.reply_to,
    // El grupo de supresión es de MARKETING. Ponérselo a una confirmación de
    // cita haría que una baja de campaña también la bloqueara.
    asmGroupId: args.transaccional ? null : r.sendgrid_asm_group_id,
    customArgs: {
      ...(r.id ? { tenant: r.id } : {}),
      ...(send?.id ? { send: send.id } : {}),
      ...(args.categoria ? { categoria: args.categoria } : {}),
    },
    categorias: args.categoria ? [args.categoria] : undefined,
  }).catch((e) => ({ ok: false, providerMessageId: null, error: String(e?.message || e) }));

  const estado: SendEmailResult['status'] = res.ok ? 'sent' : 'failed';

  if (send?.id) {
    await supabase
      .from('email_sends')
      .update({
        provider_message_id: res.providerMessageId,
        estado,
        sent_at: res.ok ? new Date().toISOString() : null,
        error_message: res.error,
      })
      .eq('id', send.id);
  }

  // Nada de fallos silenciosos: un correo que no sale y nadie ve es
  // exactamente cómo se pasaron semanas mandando a un proveedor de pruebas.
  if (!res.ok) console.error(`[email] no salió a ${to} («${subject}»): ${res.error}`);

  return { id: send?.id, provider_id: res.providerMessageId, status: estado, error: res.error };
}
