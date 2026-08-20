// POST /api/email/inbound — respuestas de los clientes (SendGrid Inbound Parse).
//
// SendGrid recibe el correo en el MX del subdominio de respuestas y lo entrega
// aquí como multipart/form-data. De ahí sale la conversación que se ve en el
// CRM, con su hilo real.
//
// ── Reglas duras ──
// 1. SIEMPRE 200. SendGrid reintenta y desactiva un webhook que falla; un
//    correo mal formado no puede tumbar la puerta de entrada de todos.
// 2. El inquilino y el envío salen del TOKEN del Reply-To
//    (reply+<token>@dominio), no de adivinar por el remitente: dos inquilinos
//    pueden tener al mismo cliente.
// 3. Las auto-respuestas ("estoy de vacaciones") no crean conversación: son
//    ruido que enterraría las respuestas de verdad.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { verificar } from '../../../lib/email/token';
import { darDeBaja } from '../../../lib/email/bajas';
import { tenantDeCasa } from '../../../lib/email/tenant';

export const prerender = false;
const ok = () => new Response('OK', { status: 200 });

/** El correo del remitente, de "Nombre <a@b.com>" o de "a@b.com". */
function extraerEmail(s: string): string {
  const m = String(s || '').match(/<([^>]+)>/);
  return (m ? m[1] : String(s || '')).trim().toLowerCase();
}
const extraerNombre = (s: string): string | null => {
  const m = String(s || '').match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : null;
};

/** El token del Reply-To: reply+<token>@dominio. */
function tokenDeDestino(...campos: string[]): string | null {
  for (const c of campos) {
    const m = String(c || '').match(/reply\+([A-Za-z0-9_.-]+)@/i);
    if (m) return m[1];
  }
  return null;
}

/** ¿Es una auto-respuesta? */
function esAutomatico(headers: string, asunto: string): boolean {
  const h = String(headers || '').toLowerCase();
  if (/auto-submitted:\s*(?!no)/.test(h)) return true;
  if (/x-autoreply|x-autorespond|precedence:\s*(bulk|auto_reply|junk)/.test(h)) return true;
  return /^(out of office|automatic reply|respuesta autom|fuera de la oficina)/i.test(String(asunto || '').trim());
}

/**
 * Quita el texto citado: el hilo ya está arriba y repetirlo vuelve la bandeja
 * ilegible.
 *
 * La línea de atribución NO siempre cabe en un renglón. Gmail la parte:
 *     On Wed, Aug 19, 2026 at 8:18 PM Aarón de SACS Cloud <
 *     aaron@news.sacscloud.com> wrote:
 * Buscar "On … wrote:" en una sola línea fallaba con el cliente más usado que
 * existe, y el encabezado del citado se colaba a la vista. Por eso la
 * atribución se busca sobre la línea UNIDA con las dos siguientes.
 */
export function limpiarCitado(texto: string): string {
  const lineas = String(texto || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const ATRIBUCION = /(wrote|escribi(ó|o)|a écrit|schrieb)\s*:\s*$/i;
  const ARRANQUE = /^\s*(on|el|le|am)\s+\S/i;

  const esCorte = (i: number): boolean => {
    const l = lineas[i];
    if (/^\s*>/.test(l)) return true;
    if (/^\s*(-{2,}|_{2,})?\s*(mensaje original|original message|forwarded message|mensaje reenviado)/i.test(l)) return true;
    if (/^\s*de:\s.+$/i.test(l) && /^\s*(para|enviado el|asunto):/im.test(lineas.slice(i + 1, i + 4).join('\n'))) return true;
    // Atribución, en una línea o repartida en hasta tres.
    if (ARRANQUE.test(l)) {
      for (let n = 0; n < 3; n++) {
        const unida = lineas.slice(i, i + n + 1).join(' ').replace(/\s+/g, ' ');
        if (ATRIBUCION.test(unida)) return true;
      }
    }
    return false;
  };

  let corte = -1;
  for (let i = 0; i < lineas.length; i++) if (esCorte(i)) { corte = i; break; }
  return (corte > 0 ? lineas.slice(0, corte) : corte === 0 ? [] : lineas).join('\n').trim();
}

/** "ya no me manden" — se detecta y se ofrece la baja con un clic. */
const PIDE_BAJA = /\b(no me mand|dejen de mandar|ya no quiero recibir|quitenme|quítenme|remove me|unsubscribe|dar de baja|darme de baja|no me interesa recibir)/i;

export const POST: APIRoute = async ({ request, url }) => {
  try {
    // CANDADO DE LA PUERTA. Antes esto no validaba NADA: cualquiera en internet
    // podía escribir conversaciones, mensajes y actividades a nombre de
    // cualquier contacto, y mover su "último contacto". SendGrid permite poner
    // un secreto en la URL del Inbound Parse
    // (…/api/email/inbound?k=<INBOUND_SECRET>), que es el único dato que un
    // extraño no tiene.
    // FALLA CERRADO. Antes, sin la variable no había candado — solo un aviso
    // en consola — y la ruta está exenta de CSRF: eso era escritura anónima
    // desde internet a conversaciones, actividades y bajas de cualquier
    // contacto. Un secreto sin configurar es una puerta abierta, no un
    // inconveniente.
    const esperado = (import.meta.env.INBOUND_SECRET || '').trim();
    if (!esperado) {
      console.error('[inbound] falta INBOUND_SECRET: correo entrante descartado');
      return ok();
    }
    if (url.searchParams.get('k') !== esperado) return ok();

    const form = await request.formData();
    const campo = (k: string) => String(form.get(k) ?? '');

    const de = campo('from');
    const para = campo('to');
    const asunto = campo('subject');
    const headers = campo('headers');
    const texto = limpiarCitado(campo('text'));
    const html = campo('html');
    const email = extraerEmail(de);
    if (!email) return ok();

    if (esAutomatico(headers, asunto)) return ok();

    // ── De quién es esta conversación ──
    const token = tokenDeDestino(para, campo('envelope'), headers);
    const p = token ? verificar(token) : null;
    let tenantId = p?.t || null;
    let sendId = p?.s || null;
    if (!tenantId) {
      // Sin token (alguien escribió directo): cae en el inquilino de casa.
      const casa = await tenantDeCasa();
      tenantId = casa?.id || null;
    }
    if (!tenantId) return ok();

    // ── A quién corresponde ──
    let contactId: string | null = null;
    let companyId: string | null = null;
    if (sendId) {
      const { data } = await supabase.from('email_sends').select('contact_id').eq('id', sendId).maybeSingle();
      contactId = data?.contact_id || null;
    }
    if (!contactId) {
      const { data } = await supabase.from('contacts').select('id, company_id').eq('email', email).limit(1).maybeSingle();
      contactId = data?.id || null; companyId = data?.company_id || null;
    } else {
      const { data } = await supabase.from('contacts').select('company_id').eq('id', contactId).maybeSingle();
      companyId = data?.company_id || null;
    }

    // ── Hilo: se reusa la conversación abierta de esa persona ──
    const { data: abierta } = await supabase.from('email_conversations')
      .select('id').eq('tenant_id', tenantId).eq('email', email).eq('estado', 'abierta')
      .order('ultimo_mensaje_at', { ascending: false }).limit(1).maybeSingle();

    let convId = abierta?.id || null;
    if (!convId) {
      const { data: nueva } = await supabase.from('email_conversations').insert({
        tenant_id: tenantId, contact_id: contactId, company_id: companyId,
        email, asunto: asunto || '(sin asunto)', estado: 'abierta', leida: false,
      }).select('id').single();
      convId = nueva?.id || null;
    } else {
      await supabase.from('email_conversations')
        .update({ leida: false, ultimo_mensaje_at: new Date().toISOString(), estado: 'abierta' })
        .eq('id', convId);
    }
    if (!convId) return ok();

    // Adjuntos: se guardan los metadatos; el binario va a Storage aparte.
    const adjuntos: any[] = [];
    const n = Number(campo('attachments') || 0);
    for (let i = 1; i <= n; i++) {
      const f = form.get(`attachment${i}`);
      if (f && typeof f === 'object' && 'name' in f) {
        adjuntos.push({ nombre: (f as File).name, tipo: (f as File).type, bytes: (f as File).size });
      }
    }

    const idsHeader = (re: RegExp) => (String(headers).match(re)?.[1] || '').trim() || null;
    await supabase.from('email_messages').insert({
      conversation_id: convId, direccion: 'entrante',
      de_email: email, para_email: extraerEmail(para), asunto,
      cuerpo_texto: texto, cuerpo_html: html || null,
      message_id: idsHeader(/^message-id:\s*(.+)$/im),
      in_reply_to: idsHeader(/^in-reply-to:\s*(.+)$/im),
      referencias: idsHeader(/^references:\s*(.+)$/im),
      adjuntos, send_id: sendId,
    });

    // El hilo también vive en la ficha del contacto.
    if (contactId) {
      await supabase.from('activities').insert({
        contact_id: contactId, company_id: companyId, tipo: 'email_respuesta', automatico: true,
        titulo: `Respondió por correo: ${(texto || asunto).slice(0, 90)}`,
        metadata: { conversation_id: convId, nombre: extraerNombre(de) },
      });
      await supabase.from('contacts').update({ last_contact_at: new Date().toISOString() }).eq('id', contactId);
    }

    // Baja pedida con palabras. Se ejecuta DE UNA: alguien que escribe "ya no
    // me manden" y recibe otra campaña es la queja de spam más segura que
    // existe. El hilo queda marcado para que se vea por qué.
    if (PIDE_BAJA.test(texto)) {
      await supabase.from('email_conversations')
        .update({ asunto: `[PIDE BAJA] ${asunto || ''}`.slice(0, 250) }).eq('id', convId);
      await darDeBaja({ tenantId, email, contactId, origen: 'respuesta-textual', detalle: texto.slice(0, 200) });
    }
    return ok();
  } catch {
    return ok();   // ver regla 1
  }
};
