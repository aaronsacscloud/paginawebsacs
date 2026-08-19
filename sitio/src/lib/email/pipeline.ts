// EL PIPELINE ÚNICO DE ENVÍO. Ningún correo de marketing sale por otra vía.
//
// Esta regla es el archivo: campañas, embudos y envíos sueltos llaman
// `enviarCorreo()`. Nadie llama al proveedor directo. El día que alguien lo
// haga, ese correo saldrá sin footer legal, sin link de baja, sin respetar
// una supresión — y ese es exactamente el correo que quema un dominio.
//
// ── ORDEN DEL PIPELINE (cada rechazo devuelve {enviado:false, motivo}) ──
//   a. inquilino configurado y activo      → 'sin_configurar'
//   b. correo válido y no role-account     → 'email_invalido' | 'role_account'
//   c. supresión (baja/rebote/queja/pausa) → 'suprimido'
//   d. presión por contacto y por empresa  → 'presion' | 'presion_empresa'
//   e. límite diario del inquilino         → 'limite_diario'
//   f. registro PREVIO + envío + cierre
//
// ── POR QUÉ EL REGISTRO VA ANTES DEL ENVÍO ──
// En Vercel la función puede morir entre la llamada a SendGrid y el INSERT
// (timeout, redeploy, OOM). Si el registro fuera después, ese destinatario
// quedaría "no enviado" y el siguiente barrido lo reintentaría: correo doble.
// Aquí el INSERT en `email_sends` con estado 'enviando' ocurre ANTES —  ese
// insert ES el claim— y después se actualiza a 'sent'. Un envío que quede en
// 'enviando' más de 10 minutos se marca 'dudoso' y NO se reintenta solo.
//
// ── CATEGORÍAS ──
//   'marketing'   campañas y newsletters: presión y límite diario aplican.
//   'relacion'    renovación, pago vencido: footer y baja SÍ, presión NO —
//                 un tope de cortesía no puede costar una renovación de ARR.
//   'prueba'      el "enviar prueba" del panel: candados de CONTENIDO sí,
//                 candados de AUDIENCIA no (si no, la 3ª prueba de la semana
//                 se bloquea y se pierde una hora depurando el candado).
import { supabase } from '../supabase';
import { resolverTenant, puedeEnviar, faltantesDeConfiguracion, type Tenant } from './tenant';
import { enviar as enviarProveedor, proveedorListo } from './proveedor';
import { firmar } from './token';
import { footerHtml, footerTexto, headersBaja, htmlATexto } from './footer';

export type Categoria = 'marketing' | 'relacion' | 'prueba' | 'transaccional';

export interface Solicitud {
  tenantId?: string | null;
  para: string;
  asunto: string;
  html: string;
  texto?: string;
  categoria?: Categoria;
  contactId?: string | null;
  companyId?: string | null;
  campaignId?: string | null;
  templateId?: string | null;
  automationId?: string | null;
  enrollmentId?: string | null;
  stepId?: string | null;
  variante?: string | null;
  /** Fila ya materializada de email_sends a reusar (campañas). */
  reusarSendId?: string | null;
}

export interface Resultado {
  enviado: boolean;
  motivo: string | null;
  sendId: string | null;
  detalle?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

// Buzones de función: en B2B abundan y son justo los que reportan spam o son
// trampas. Nunca reciben marketing; una prueba dirigida a uno sí pasa.
const ROLE_ACCOUNTS = new Set([
  'info', 'ventas', 'contacto', 'admin', 'administracion', 'facturacion', 'facturas',
  'soporte', 'ayuda', 'hola', 'contabilidad', 'compras', 'rh', 'recursoshumanos',
  'noreply', 'no-reply', 'postmaster', 'abuse', 'webmaster', 'sales', 'support',
  'billing', 'help', 'office', 'contact', 'marketing',
]);

export const esRoleAccount = (email: string): boolean =>
  ROLE_ACCOUNTS.has(String(email || '').toLowerCase().split('@')[0].replace(/[._-]/g, ''));

export const normalizarEmail = (e: unknown): string => String(e ?? '').trim().toLowerCase();

function baseUrl(): string {
  return (import.meta.env.PUBLIC_SITE_URL || 'https://www.sacscloud.com').replace(/\/$/, '');
}

/** ¿Aplica la presión a esta categoría? Solo marketing. */
const cuentaParaPresion = (c: Categoria) => c === 'marketing';

// ── Chequeos (exportados: el panel los usa para explicar ANTES de enviar) ──

export async function estaSuprimido(tenantId: string, email: string): Promise<{ suprimido: boolean; motivo?: string }> {
  const { data } = await supabase
    .from('email_suppressions')
    .select('motivo, pausado_hasta')
    .eq('tenant_id', tenantId)
    .eq('email', normalizarEmail(email))
    .is('restaurado_at', null)
    .limit(1)
    .maybeSingle();
  if (!data) return { suprimido: false };
  // Una PAUSA vencida ya no suprime: el suscriptor vuelve solo.
  if (data.pausado_hasta && new Date(data.pausado_hasta).getTime() < Date.now()) return { suprimido: false };
  return { suprimido: true, motivo: data.motivo };
}

export async function excedePresion(t: Tenant, email: string, companyId?: string | null): Promise<string | null> {
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count } = await supabase
    .from('email_presion')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', t.id)
    .eq('email', normalizarEmail(email))
    .gte('enviado_at', desde);
  if ((count || 0) >= t.presion_max_semana) return 'presion';

  // Cap por EMPRESA: en B2B, cinco contactos de la misma cuenta recibiendo lo
  // mismo el mismo día se percibe como spam organizacional y multiplica el
  // riesgo de que ese dominio nos bloquee entero.
  if (t.presion_por_empresa && companyId) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const { count: porEmpresa } = await supabase
      .from('email_presion')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', t.id)
      .eq('company_id', companyId)
      .gte('enviado_at', hoy.toISOString());
    if ((porEmpresa || 0) >= 1) return 'presion_empresa';
  }
  return null;
}

export async function excedeLimiteDiario(t: Tenant): Promise<boolean> {
  if (!t.limite_diario || t.limite_diario <= 0) return false;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('email_sends')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', t.id)
    .in('categoria', ['marketing', 'relacion'])
    .gte('created_at', hoy.toISOString());
  return (count || 0) >= t.limite_diario;
}

/**
 * ¿Se le puede mandar a esta persona? Corre los candados SIN enviar, para que
 * el panel pueda decir de antemano cuántos quedarán fuera y por qué.
 */
export async function evaluarDestinatario(
  t: Tenant, email: string, categoria: Categoria, companyId?: string | null,
): Promise<string | null> {
  const e = normalizarEmail(email);
  if (!EMAIL_RE.test(e)) return 'email_invalido';
  if (categoria !== 'prueba' && esRoleAccount(e)) return 'role_account';
  const sup = await estaSuprimido(t.id, e);
  if (sup.suprimido) return 'suprimido';
  if (cuentaParaPresion(categoria)) {
    const p = await excedePresion(t, e, companyId);
    if (p) return p;
  }
  if (categoria !== 'prueba' && await excedeLimiteDiario(t)) return 'limite_diario';
  return null;
}

// ── El envío ───────────────────────────────────────────────────────────

export async function enviarCorreo(s: Solicitud): Promise<Resultado> {
  const categoria: Categoria = s.categoria || 'marketing';
  const email = normalizarEmail(s.para);

  const t = await resolverTenant(s.tenantId);
  if (!t) return { enviado: false, motivo: 'sin_configurar', sendId: null, detalle: 'No existe el inquilino.' };
  if (!puedeEnviar(t)) {
    return { enviado: false, motivo: 'sin_configurar', sendId: null, detalle: faltantesDeConfiguracion(t).join(' · ') };
  }
  if (!proveedorListo()) {
    return { enviado: false, motivo: 'sin_proveedor', sendId: null, detalle: 'Falta SENDGRID_API_KEY.' };
  }
  if (!s.asunto?.trim() || !s.html?.trim()) {
    return { enviado: false, motivo: 'datos_invalidos', sendId: null, detalle: 'Faltan asunto o contenido.' };
  }

  const rechazo = await evaluarDestinatario(t, email, categoria, s.companyId);
  if (rechazo) return { enviado: false, motivo: rechazo, sendId: null };

  // f. REGISTRO PREVIO — ver la nota de la cabecera. Este insert es el claim.
  const { data: send, error: errIns } = await supabase
    .from('email_sends')
    .insert({
      tenant_id: t.id,
      contact_id: s.contactId || null,
      template_id: s.templateId || null,
      automation_id: s.automationId || null,
      enrollment_id: s.enrollmentId || null,
      step_id: s.stepId || null,
      campaign_id: s.campaignId || null,
      email_to: email,
      email_provider: 'sendgrid',
      categoria,
      variante: s.variante || null,
      estado: 'enviando',
    })
    .select('id')
    .single();
  if (errIns || !send) {
    return { enviado: false, motivo: 'error', sendId: null, detalle: errIns?.message || 'No se pudo registrar el envío.' };
  }

  // El token se firma con el id del envío ya existente: el link de baja de
  // ESTE correo apunta a ESTE envío, y por eso una baja sabe de qué campaña vino.
  let token: string;
  try {
    token = firmar({ t: t.id, m: email, s: send.id, p: 'baja' });
  } catch (e: any) {
    await supabase.from('email_sends').update({ estado: 'failed', error_message: String(e?.message || e) }).eq('id', send.id);
    return { enviado: false, motivo: 'sin_secreto', sendId: send.id, detalle: 'Falta EMAIL_TOKEN_SECRET: no se envía sin link de baja.' };
  }

  const base = baseUrl();
  const html = `${s.html}\n${footerHtml(t, base, token)}`;
  const texto = `${s.texto?.trim() || htmlATexto(s.html)}\n${footerTexto(t, base, token)}`;

  const r = await enviarProveedor({
    para: email,
    asunto: s.asunto,
    html,
    texto,
    fromEmail: t.from_email,
    fromNombre: t.from_nombre,
    replyTo: t.reply_to,
    headers: headersBaja(base, token),
    asmGroupId: t.sendgrid_asm_group_id,
    customArgs: { tenant: t.id, send: send.id, categoria },
    categorias: [categoria, ...(s.campaignId ? ['campaign'] : [])],
  });

  const ahora = new Date().toISOString();
  if (!r.ok) {
    await supabase.from('email_sends')
      .update({ estado: 'failed', error_message: r.error, token })
      .eq('id', send.id);
    return { enviado: false, motivo: 'error_proveedor', sendId: send.id, detalle: r.error };
  }

  await supabase.from('email_sends')
    .update({ estado: 'sent', sent_at: ahora, provider_message_id: r.providerMessageId, token })
    .eq('id', send.id);

  // La presión se registra DESPUÉS de un envío real: si el proveedor falló,
  // el destinatario no gastó su cuota de la semana.
  if (cuentaParaPresion(categoria)) {
    await supabase.from('email_presion').insert({
      tenant_id: t.id, email, contact_id: s.contactId || null, company_id: s.companyId || null,
    });
  }

  return { enviado: true, motivo: null, sendId: send.id };
}

/**
 * Envíos que quedaron a medias (proceso muerto entre el claim y el cierre).
 * NO se reintentan solos: pueden haber salido. Se marcan para que una persona
 * decida — reenviar a ciegas es el camino al correo duplicado.
 */
export async function marcarEnviosDudosos(minutos = 10): Promise<number> {
  const limite = new Date(Date.now() - minutos * 60000).toISOString();
  const { data } = await supabase
    .from('email_sends')
    .update({ estado: 'dudoso', error_message: 'El proceso murió durante el envío; puede haber salido.' })
    .eq('estado', 'enviando')
    .lt('created_at', limite)
    .select('id');
  return (data || []).length;
}
