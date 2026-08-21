// SOPORTE · Intercom: verificación de firma, parseo de eventos y persistencia
// de tickets ligados al cliente. Todo server-side (el widget del navegador es
// aparte). Intercom firma sus webhooks con X-Hub-Signature: sha1=<hmac> del
// cuerpo CRUDO usando el client secret de la app.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabase } from '../supabase';
import { companyIdDeCuenta, normCuenta } from '../crm/sacs-cuentas';
import { notificar } from '../crm/notificaciones';
import { clasificar } from './clasificar';
import { recomputarSoporteEmpresa } from '../crm/soporte-rollup';
import { dispararCSAT } from './csat';

const SECRET = (import.meta.env.INTERCOM_WEBHOOK_SECRET || '').trim();
const APP_ID = (import.meta.env.INTERCOM_APP_ID || 'zla430r8').trim();
const TOKEN = (import.meta.env.INTERCOM_ACCESS_TOKEN || '').trim();
const API = 'https://api.intercom.io';
const IV = { 'Authorization': 'Bearer ' + TOKEN, 'Intercom-Version': '2.11', 'Content-Type': 'application/json' };

export function hayToken(): boolean { return TOKEN.length > 0; }

// admin_id para responder: env override, o el primer admin activo de la app
// (se resuelve una vez y se cachea en memoria del proceso).
const ADMIN_ID_ENV = (import.meta.env.INTERCOM_ADMIN_ID || '').trim();
let _adminIdCache: string | null = null;
async function adminIdPredeterminado(): Promise<string | null> {
  if (ADMIN_ID_ENV) return ADMIN_ID_ENV;
  if (_adminIdCache) return _adminIdCache;
  try {
    const r = await fetch(`${API}/admins`, { headers: IV });
    const j: any = await r.json();
    const admins: any[] = j?.admins || j?.data || [];
    const activo = admins.find(a => a && a.away_mode_enabled !== undefined ? true : !!a?.id) || admins[0];
    _adminIdCache = activo?.id ? String(activo.id) : null;
    return _adminIdCache;
  } catch { return null; }
}

/** Responde (comentario público de admin) una conversación de Intercom desde el
 *  CRM. Devuelve {ok} o {error}. No lanza. */
export async function responderConversacion(conversationId: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  if (!TOKEN) return { ok: false, error: 'Intercom no configurado (falta INTERCOM_ACCESS_TOKEN)' };
  const body = (texto || '').trim();
  if (!body) return { ok: false, error: 'Mensaje vacío' };
  const adminId = await adminIdPredeterminado();
  if (!adminId) return { ok: false, error: 'No se encontró un admin de Intercom para responder (define INTERCOM_ADMIN_ID)' };
  try {
    const r = await fetch(`${API}/conversations/${conversationId}/reply`, {
      method: 'POST', headers: IV,
      body: JSON.stringify({ message_type: 'comment', type: 'admin', admin_id: adminId, body }),
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); return { ok: false, error: `Intercom ${r.status}: ${t.slice(0, 200)}` }; }
    return { ok: true };
  } catch (e: any) { return { ok: false, error: e?.message || 'No se pudo enviar' }; }
}

/** La cuenta SACS de una conversación viene del CONTACTO, no de la conversación:
 *  contacto.companies[0].company_id = la cuenta (lo que sacs3 pone como company.id).
 *  Solo se puede resolver con el Access Token. Devuelve {cuenta, email} o null. */
export async function cuentaDeContacto(contactId: string): Promise<{ cuenta: string | null; email: string | null }> {
  if (!TOKEN || !contactId) return { cuenta: null, email: null };
  try {
    const r = await fetch(`${API}/contacts/${contactId}/companies`, { headers: IV });
    const j: any = await r.json();
    const comp = (j?.data || j?.companies || [])[0];
    let email: string | null = null;
    try { const rc = await fetch(`${API}/contacts/${contactId}`, { headers: IV }); email = (await rc.json())?.email || null; } catch { /* email opcional */ }
    return { cuenta: comp?.company_id || null, email };
  } catch { return { cuenta: null, email: null }; }
}

export function hayConfig(): boolean { return SECRET.length > 0; }

/** Valida X-Hub-Signature (HMAC-SHA1 del body crudo). Fail-closed. */
export function firmaValida(raw: string, header: string | null): boolean {
  if (!SECRET || !header) return false;
  const esperado = 'sha1=' + createHmac('sha1', SECRET).update(raw, 'utf8').digest('hex');
  try {
    const a = Buffer.from(header);
    const b = Buffer.from(esperado);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

// Topic de Intercom → estado del ticket en el CRM. Solo nos importan los que
// cambian el estado o crean la conversación; el resto se ignora sin ruido.
const TOPIC_ESTADO: Record<string, string> = {
  'conversation.user.created': 'abierto',
  'conversation.user.replied': 'abierto',
  'conversation.admin.opened': 'abierto',
  'conversation.admin.assigned': 'en_curso',
  'conversation.admin.replied': 'en_curso',
  'conversation.admin.snoozed': 'pausado',
  'conversation.admin.closed': 'resuelto',
  'conversation.admin.unsnoozed': 'en_curso',
  'ticket.state.updated': 'auto',   // el estado viene en el payload
};

function seg(ms: number | null | undefined): string | null {
  return (ms && ms > 0) ? new Date(ms * 1000).toISOString() : null;
}

/** Extrae de un evento de Intercom los datos del ticket que nos interesan. */
export function parseEvento(body: any): {
  topic: string; conversationId: string; estado: string; contactoId: string | null;
  asunto: string | null; vistaPrevia: string | null; prioridad: string | null;
  asignado: string | null; cuenta: string | null; autorEmail: string | null;
  abiertoAt: string | null; resueltoAt: string | null; ultimaAt: string | null; url: string | null;
} | null {
  const topic = String(body?.topic || '');
  const item = body?.data?.item;
  if (!item || !item.id) return null;
  let estado = TOPIC_ESTADO[topic];
  if (!estado) {
    // topics no mapeados (p.ej. conversation.admin.noted): ignorar.
    if (topic.startsWith('conversation.') && (item.state || typeof item.open === 'boolean')) {
      estado = item.state === 'closed' || item.open === false ? 'resuelto' : 'abierto';
    } else return null;
  }
  if (estado === 'auto') {
    const st = String(item.state || item.ticket_state || '').toLowerCase();
    estado = st.includes('resolv') || st.includes('closed') ? 'resuelto' : (st.includes('progress') ? 'en_curso' : 'abierto');
  }

  const source = item.source || {};
  const autor = source.author || {};
  // La cuenta SACS NO viene en la conversación: viene del CONTACTO. Aquí solo
  // se guarda el contactId; upsertTicket la enriquece con el token si hace falta.
  let cuenta: string | null = null;
  const comp = item.company || (Array.isArray(item.companies?.companies) ? item.companies.companies[0] : null);
  if (comp) cuenta = comp.company_id || comp.name || null;
  const contactoId = (Array.isArray(item.contacts?.contacts) ? item.contacts.contacts[0]?.id : null) || autor.id || null;

  return {
    topic, conversationId: String(item.id), estado, contactoId,
    asunto: item.title || source.subject || null,
    vistaPrevia: (source.body ? String(source.body).replace(/<[^>]*>/g, ' ').trim().slice(0, 300) : null),
    prioridad: item.priority || null,
    asignado: item.assignee?.name || item.admin_assignee?.name || null,
    cuenta: cuenta,
    autorEmail: autor.email || null,
    abiertoAt: seg(item.created_at),
    resueltoAt: estado === 'resuelto' ? (seg(item.updated_at) || new Date().toISOString()) : null,
    ultimaAt: seg(item.updated_at) || new Date().toISOString(),
    url: 'https://app.intercom.com/a/apps/' + APP_ID + '/conversations/' + item.id,
  };
}

/** Guarda/actualiza el ticket + su evento en el timeline + aviso. Idempotente
 *  por conversation_id (upsert) y por clave de aviso. */
export async function upsertTicket(ev: ReturnType<typeof parseEvento>): Promise<{ ok: boolean; company_id: string | null }> {
  if (!ev) return { ok: false, company_id: null };

  // Resolver identidad: cuenta SACS → company_id; si no, email → contacto.
  // Si el evento no trae ni cuenta ni email, se enriquece con el token
  // (contacto → company → cuenta), que es el join fiable.
  let cuenta = ev.cuenta;
  let email = ev.autorEmail;
  if (!cuenta && ev.contactoId && hayToken()) {
    const enr = await cuentaDeContacto(ev.contactoId);
    cuenta = cuenta || enr.cuenta;
    email = email || enr.email;
  }
  let companyId: string | null = null;
  let contactId: string | null = null;
  if (cuenta) companyId = await companyIdDeCuenta(cuenta);
  if (email) {
    const { data: ct } = await supabase.from('contacts').select('id, company_id')
      .eq('email', String(email).trim().toLowerCase()).limit(1).maybeSingle();
    if (ct) { contactId = ct.id; if (!companyId) companyId = ct.company_id || null; }
  }

  // Estado previo del ticket: para detectar REAPERTURA y no re-timbrar la
  // primera respuesta ni el CSAT dos veces.
  const { data: prev } = await supabase.from('crm_soporte_tickets')
    .select('estado, primera_respuesta_at, reabierto_count, csat_campana_id')
    .eq('conversation_id', ev.conversationId).maybeSingle();

  const { tema, sentimiento } = clasificar(ev.asunto, ev.vistaPrevia);
  const reabierto = !!(prev && prev.estado === 'resuelto' && ev.estado !== 'resuelto');
  const esRespuestaAdmin = ev.topic === 'conversation.admin.replied';   // primera respuesta (FRT/SLA)

  const fila: any = {
    conversation_id: ev.conversationId, company_id: companyId, contact_id: contactId,
    cuenta: cuenta ? normCuenta(cuenta) : null,
    estado: ev.estado, asunto: ev.asunto, vista_previa: ev.vistaPrevia, prioridad: ev.prioridad,
    asignado: ev.asignado, autor_email: email,
    tema, sentimiento,
    ultima_actividad_at: ev.ultimaAt, intercom_url: ev.url,
    updated_at: new Date().toISOString(),
  };
  if (ev.abiertoAt) fila.abierto_at = ev.abiertoAt;
  if (ev.resueltoAt) fila.resuelto_at = ev.resueltoAt;
  if (!prev?.primera_respuesta_at && esRespuestaAdmin) fila.primera_respuesta_at = new Date().toISOString();
  if (reabierto) { fila.reabierto_count = (prev?.reabierto_count || 0) + 1; fila.resuelto_at = null; }

  const { error } = await supabase.from('crm_soporte_tickets')
    .upsert(fila, { onConflict: 'conversation_id' });
  if (error) return { ok: false, company_id: companyId };

  // Rollup de soporte + recálculo de salud (el health baja al instante).
  if (companyId) await recomputarSoporteEmpresa(companyId);

  // CSAT: al resolver por primera vez, encolar la cuenta a la encuesta post-soporte.
  if (ev.estado === 'resuelto' && !prev?.csat_campana_id && cuenta) {
    const campId = await dispararCSAT(cuenta);
    if (campId) await supabase.from('crm_soporte_tickets')
      .update({ csat_campana_id: campId }).eq('conversation_id', ev.conversationId);
  }

  // Evento en el timeline unificado (solo en abrir y resolver, no cada réplica).
  if (companyId && (ev.estado === 'abierto' || ev.estado === 'resuelto')) {
    const tipo = ev.estado === 'resuelto' ? 'ticket_resuelto' : 'ticket_abierto';
    const { data: yaAct } = await supabase.from('activities').select('id')
      .eq('company_id', companyId).eq('tipo', tipo)
      .contains('metadata', { conversation_id: ev.conversationId }).limit(1);
    if (!yaAct?.length) {
      await supabase.from('activities').insert({
        company_id: companyId, contact_id: contactId, tipo, automatico: true,
        titulo: ev.estado === 'resuelto' ? 'Ticket de soporte resuelto' : 'Nuevo ticket de soporte',
        descripcion: ev.asunto || ev.vistaPrevia || null,
        metadata: { conversation_id: ev.conversationId, intercom_url: ev.url, origen: 'intercom' },
      });
    }
  }

  // Aviso a la campana del CRM al abrir y al resolver (idempotente por clave).
  if (companyId && (ev.estado === 'abierto' || ev.estado === 'resuelto')) {
    await notificar({
      clave: `intercom_ticket:${ev.conversationId}:${ev.estado}`,
      tipo: ev.estado === 'resuelto' ? 'ticket_resuelto' : 'ticket_abierto',
      nivel: ev.estado === 'resuelto' ? 'info' : 'alerta',
      titulo: ev.estado === 'resuelto' ? 'Ticket de soporte resuelto' : 'Nuevo ticket de soporte',
      detalle: ev.asunto || ev.vistaPrevia || 'Sin asunto',
      company_id: companyId, destino: 'soporte',
      metadata: { conversation_id: ev.conversationId, cuenta },
    });
  }
  return { ok: true, company_id: companyId };
}
