// SOPORTE · Intercom: verificación de firma, parseo de eventos y persistencia
// de tickets ligados al cliente. Todo server-side (el widget del navegador es
// aparte). Intercom firma sus webhooks con X-Hub-Signature: sha1=<hmac> del
// cuerpo CRUDO usando el client secret de la app.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabase } from '../supabase';
import { companyIdDeCuenta, normCuenta } from '../crm/sacs-cuentas';
import { notificar } from '../crm/notificaciones';

const SECRET = (import.meta.env.INTERCOM_WEBHOOK_SECRET || '').trim();
const APP_ID = (import.meta.env.INTERCOM_APP_ID || 'zla430r8').trim();

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
  topic: string; conversationId: string; estado: string;
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
  // La cuenta SACS viaja como company del contacto (Intercom la incluye a veces
  // en item.contacts o en item.company). Se intentan varias rutas.
  let cuenta: string | null = null;
  const comp = item.company || (Array.isArray(item.companies?.companies) ? item.companies.companies[0] : null);
  if (comp) cuenta = comp.company_id || comp.remote_company_id || comp.name || null;

  return {
    topic, conversationId: String(item.id), estado,
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
  let companyId: string | null = null;
  let contactId: string | null = null;
  if (ev.cuenta) companyId = await companyIdDeCuenta(ev.cuenta);
  if (ev.autorEmail) {
    const { data: ct } = await supabase.from('contacts').select('id, company_id')
      .eq('email', String(ev.autorEmail).trim().toLowerCase()).limit(1).maybeSingle();
    if (ct) { contactId = ct.id; if (!companyId) companyId = ct.company_id || null; }
  }

  const fila: any = {
    conversation_id: ev.conversationId, company_id: companyId, contact_id: contactId,
    cuenta: ev.cuenta ? normCuenta(ev.cuenta) : null,
    estado: ev.estado, asunto: ev.asunto, vista_previa: ev.vistaPrevia, prioridad: ev.prioridad,
    asignado: ev.asignado, autor_email: ev.autorEmail,
    ultima_actividad_at: ev.ultimaAt, intercom_url: ev.url,
    updated_at: new Date().toISOString(),
  };
  if (ev.abiertoAt) fila.abierto_at = ev.abiertoAt;
  if (ev.resueltoAt) fila.resuelto_at = ev.resueltoAt;

  const { error } = await supabase.from('crm_soporte_tickets')
    .upsert(fila, { onConflict: 'conversation_id' });
  if (error) return { ok: false, company_id: companyId };

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
      metadata: { conversation_id: ev.conversationId, cuenta: ev.cuenta },
    });
  }
  return { ok: true, company_id: companyId };
}
