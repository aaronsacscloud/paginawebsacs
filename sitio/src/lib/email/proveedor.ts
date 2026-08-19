// Proveedor de correo — SendGrid detrás de UNA interfaz.
//
// Toda salida de correo del sistema de marketing pasa por `enviar()`. Cambiar
// de proveedor (o darle a un partner su propia cuenta) es implementar esta
// interfaz, no tocar a los llamadores.
//
// Tres decisiones que valen tanto como el código:
//
// 1. `tracking_settings` APAGADO por mensaje. El CRM ya tiene su propio
//    tracking de aperturas y clics contra su PROPIO dominio (mejor reputación
//    de links que el dominio compartido de SendGrid). Si no se apagara aquí,
//    SendGrid reescribiría encima de los links ya reescritos: doble envoltura,
//    URLs feas y la ventaja perdida. Se apaga por MENSAJE y no en la cuenta
//    para no tocar el correo transaccional de sacs_api, que comparte cuenta.
//
// 2. `asm.group_id` — el grupo de supresión de marketing. Es lo que hace que
//    una baja de marketing NO mate las notificaciones transaccionales del
//    producto: SendGrid guarda la baja contra el GRUPO, no contra la cuenta.
//    Es el aislamiento que en el plan se creía que exigía un subuser de pago.
//
// 3. `custom_args` con tenant/send: los eventos del webhook vuelven con ellos
//    y por eso se puede saber de quién era el correo sin adivinar.
export interface EnvioProveedor {
  para: string;
  asunto: string;
  html: string;
  texto: string;
  fromEmail: string;
  fromNombre: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
  asmGroupId?: number | null;
  customArgs?: Record<string, string>;
  categorias?: string[];
}

export interface ResultadoProveedor {
  ok: boolean;
  providerMessageId: string | null;
  error: string | null;
}

const API = 'https://api.sendgrid.com/v3/mail/send';

export function proveedorListo(): boolean {
  return !!(import.meta.env.SENDGRID_API_KEY || '').trim();
}

export async function enviar(e: EnvioProveedor): Promise<ResultadoProveedor> {
  const key = (import.meta.env.SENDGRID_API_KEY || '').trim();
  if (!key) return { ok: false, providerMessageId: null, error: 'Falta SENDGRID_API_KEY en el entorno.' };

  const body: Record<string, any> = {
    personalizations: [{
      to: [{ email: e.para }],
      ...(e.customArgs ? { custom_args: e.customArgs } : {}),
    }],
    from: { email: e.fromEmail, name: e.fromNombre },
    subject: e.asunto,
    content: [
      // El orden importa: SendGrid exige text/plain ANTES que text/html.
      { type: 'text/plain', value: e.texto },
      { type: 'text/html', value: e.html },
    ],
    // Ver nota 1 de la cabecera.
    tracking_settings: {
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
      subscription_tracking: { enable: false },
    },
  };
  if (e.replyTo) body.reply_to = { email: e.replyTo };
  if (e.headers && Object.keys(e.headers).length) body.headers = e.headers;
  if (e.asmGroupId) body.asm = { group_id: e.asmGroupId };
  if (e.categorias?.length) body.categories = e.categorias.slice(0, 10);

  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.status >= 200 && r.status < 300) {
      return { ok: true, providerMessageId: r.headers.get('x-message-id'), error: null };
    }
    const txt = await r.text().catch(() => '');
    return { ok: false, providerMessageId: null, error: `SendGrid ${r.status}: ${txt.slice(0, 300)}` };
  } catch (err: any) {
    return { ok: false, providerMessageId: null, error: String(err?.message || err) };
  }
}
