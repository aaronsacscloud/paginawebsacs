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
import { enviar as enviarProveedor, proveedorListo, llaveDe } from './proveedor';
import { firmar } from './token';
import { footerHtml, footerTexto, headersBaja, htmlATexto } from './footer';
import { envolverLinks, agregarPixel } from './tracking';

import { frenado } from './freno';
import { escalonCalentamiento, direccionRespuesta } from './puro';

// 'abm' = prospección en frío a NEGOCIOS (Cuentas objetivo). Es marketing en
// todo menos en dos reglas que están pensadas para el boletín y que aquí
// estorban: el buzón de rol y la presión semanal. Ver evaluarDestinatario.
export type Categoria = 'marketing' | 'relacion' | 'prueba' | 'transaccional' | 'abm';

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

/** El subdominio que recibe respuestas (MX apuntando al Inbound Parse). */
function dominioRespuestas(): string {
  return (import.meta.env.EMAIL_REPLY_DOMAIN || '').trim();
}

/** ¿Aplica la presión a esta categoría? Solo marketing. */
const cuentaParaPresion = (c: Categoria) => c === 'marketing';

// ── Chequeos (exportados: el panel los usa para explicar ANTES de enviar) ──

export async function estaSuprimido(tenantId: string, email: string): Promise<{ suprimido: boolean; motivo?: string }> {
  const e = normalizarEmail(email);

  // Se consultan las DOS tablas a propósito. `email_unsubscribes` es la tabla
  // vieja del CRM, y el link de baja que viaja en todos los correos ya
  // entregados sigue escribiendo ahí. Si el pipeline solo mirara la nueva,
  // alguien que se dio de baja el año pasado recibiría la próxima campaña —
  // que además de ser la queja de spam más segura, es exposición legal.
  const [nuevas, legacy] = await Promise.all([
    supabase.from('email_suppressions')
      .select('motivo, pausado_hasta')
      .eq('tenant_id', tenantId).eq('email', e).is('restaurado_at', null)
      // Sin orden explícito, con dos filas activas Postgres puede devolver la
      // pausa vencida y ocultar un rebote duro posterior.
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('email_unsubscribes')
      .select('id').eq('email', e).is('resubscribed_at', null).limit(1),
  ]);

  if ((legacy.data || []).length) return { suprimido: true, motivo: 'baja' };

  for (const s of (nuevas.data || [])) {
    // Una PAUSA vencida ya no suprime; se sigue revisando el resto, porque
    // puede haber debajo una supresión permanente.
    if (s.pausado_hasta && new Date(s.pausado_hasta).getTime() < Date.now()) continue;
    return { suprimido: true, motivo: s.motivo };
  }
  return { suprimido: false };
}

/**
 * Medianoche del inquilino, en UTC. `setHours(0,0,0,0)` usa la zona del
 * proceso — en Vercel eso es UTC, así que el límite diario se reiniciaba a
 * las 18:00 hora de México y una campaña de la tarde gastaba la cuota del día
 * siguiente.
 */
function inicioDelDia(t: Tenant): string {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: t.timezone || 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(ahora);
  const v = (k: string) => Number(partes.find(p => p.type === k)?.value || 0);
  const transcurrido = (v('hour') % 24) * 3600000 + v('minute') * 60000 + v('second') * 1000;
  return new Date(ahora.getTime() - transcurrido).toISOString();
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
    const { count: porEmpresa } = await supabase
      .from('email_presion')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', t.id)
      .eq('company_id', companyId)
      .gte('enviado_at', inicioDelDia(t));
    if ((porEmpresa || 0) >= 1) return 'presion_empresa';
  }
  return null;
}

export async function excedeLimiteDiario(t: Tenant): Promise<boolean> {
  const rampa = escalonCalentamiento((t as any).calentamiento_inicio, t.limite_diario);
  // Explícito contra NaN: `!NaN` es true, y eso quitaba el tope entero.
  const tope = Number(rampa ?? t.limite_diario);
  if (!Number.isFinite(tope) || tope <= 0) return false;
  const { count } = await supabase
    .from('email_sends')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', t.id)
    .in('categoria', ['marketing', 'relacion'])
    .gte('created_at', inicioDelDia(t));
  return (count || 0) >= tope;
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
  // El freno de emergencia manda sobre todo lo demás en marketing. El correo
  // de relación —cobros, renovaciones— sigue saliendo: si el dominio se está
  // quemando, eso es justo lo último que quieres detener.
  if ((categoria === 'marketing' || categoria === 'abm') && (await frenado(t.id)).si) return 'frenado';
  // El buzón de rol se rechaza en marketing porque un contacto real dio su
  // correo personal. En prospección en frío a comercios es al revés: el
  // `contacto@` que la boutique publica en su propio aviso de privacidad ES el
  // canal legítimo, y en la mitad de los casos es el único que existe.
  if (categoria !== 'prueba' && categoria !== 'abm' && esRoleAccount(e)) return 'role_account';
  const sup = await estaSuprimido(t.id, e);
  if (sup.suprimido) return 'suprimido';
  if (cuentaParaPresion(categoria)) {
    const p = await excedePresion(t, e, companyId);
    if (p) return p;
  }
  // El ABM no comparte el cupo diario del inquilino ni la presión semanal:
  // trae sus propios frenos, más estrictos (rampa de calentamiento por días
  // con envíos, uno por buzón al día, disyuntor por rebotes). Con la presión
  // de 2 por semana, el correo 3 de toda cadencia —el que enseña el dolor—
  // no salía nunca, para nadie, y sin dar un solo error visible.
  if (categoria !== 'prueba' && categoria !== 'abm' && await excedeLimiteDiario(t)) return 'limite_diario';
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
  if (categoria === 'marketing' || categoria === 'abm') {
    const f = await frenado(t.id);
    if (f.si) return { enviado: false, motivo: 'frenado', sendId: null, detalle: f.motivo };
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
      /* QUÉ se mandó, no solo a quién. El asunto solo existe en este momento:
         los envíos no llevan plantilla ni campaña (medido: los 89 con ambos en
         null), así que si no se guarda aquí, después no hay de dónde sacarlo.
         Sin esto el inbox decía «Correo «campaña»: lo abrió» — «campaña» era
         relleno y no decía de qué correo hablaba, que es justo lo que hace
         falta para retomar la conversación.
         Se guarda un extracto corto y no el HTML: el cuerpo pesa cientos de kB
         y para reconocer un correo bastan el asunto y sus primeras líneas. */
      asunto: s.asunto?.trim().slice(0, 300) || null,
      extracto: (s.texto?.trim() || htmlATexto(s.html || '')).replace(/\s+/g, ' ').trim().slice(0, 240) || null,
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
  // El orden importa: primero se arma el cuerpo con su pie, DESPUÉS se envuelve
  // para medir. Así el link de baja del footer queda excluido del redirector
  // (envolverLinks lo respeta) y el pixel va al final de todo.
  let html = `${s.html}\n${footerHtml(t, base, token)}`;
  html = agregarPixel(envolverLinks(html, base, send.id), base, send.id);
  const texto = `${s.texto?.trim() || htmlATexto(s.html)}\n${footerTexto(t, base, token)}`;

  const r = await enviarProveedor({
    para: email,
    asunto: s.asunto,
    html,
    texto,
    fromEmail: t.from_email,
    fromNombre: t.from_nombre,
    // Reply-To con el token del envío: cuando el cliente contesta, su respuesta
    // llega al Inbound Parse y el sistema sabe de QUÉ envío y de qué inquilino
    // venía sin adivinar por el remitente (dos inquilinos pueden tener al mismo
    // cliente). Si el subdominio de recepción no está configurado, se cae al
    // reply_to normal: mejor que la respuesta llegue a un buzón humano a que se
    // pierda en un dominio sin MX.
    // El Reply-To lleva el ID DEL ENVÍO, no el token firmado.
    //
    // El token completo mide ~166 caracteres y el RFC 5321 limita la parte
    // local de una dirección a 64 octetos: Hostinger —y no es el único—
    // rechazaba la dirección al escribirla y NADIE podía responder. Un correo
    // al que no se puede contestar es peor que no mandarlo. Lo encontró el
    // usuario intentando responder; ninguna revisión de código lo vio.
    //
    // El id del envío basta para identificar: de él salen inquilino, contacto
    // y correo. Y no es un secreto que proteger — la puerta la cuida el
    // INBOUND_SECRET de la URL del Parse, sin el cual no entra nada. Aun así
    // es un UUID v4: 122 bits, no se adivina.
    replyTo: direccionRespuesta(send.id, dominioRespuestas()) || t.reply_to,
    headers: headersBaja(base, token),
    asmGroupId: t.sendgrid_asm_group_id,
    apiKey: llaveDe(t as any),
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
