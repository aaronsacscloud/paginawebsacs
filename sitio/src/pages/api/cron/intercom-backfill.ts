// SOPORTE · Backfill/reconciliación de conversaciones de Intercom (cron o
// disparo manual). Trae el histórico (y lo que el webhook no alcanzó) vía la
// API REST y lo liga al cliente. Presupuesto de tiempo + cursor por página.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { hayToken, cuentaDeContacto } from '../../../lib/soporte/intercom';
import { supabase } from '../../../lib/supabase';
import { companyIdDeCuenta, normCuenta } from '../../../lib/crm/sacs-cuentas';

export const prerender = false;
const TOKEN = (import.meta.env.INTERCOM_ACCESS_TOKEN || '').trim();
const APP_ID = (import.meta.env.INTERCOM_APP_ID || 'zla430r8').trim();
const API = 'https://api.intercom.io';
const IV = { 'Authorization': 'Bearer ' + TOKEN, 'Intercom-Version': '2.11', 'Content-Type': 'application/json' };
const PRESUPUESTO_MS = 120_000;

const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

function estadoDe(c: any): string {
  if (c.state === 'closed' || c.open === false) return 'resuelto';
  if (c.state === 'snoozed') return 'pausado';
  if (c.admin_assignee_id) return 'en_curso';
  return 'abierto';
}
const seg = (ms: number | null) => (ms && ms > 0) ? new Date(ms * 1000).toISOString() : null;

async function correr(): Promise<Response> {
  if (!hayToken()) return json({ error: 'Falta INTERCOM_ACCESS_TOKEN' }, 503);
  const deadline = Date.now() + PRESUPUESTO_MS;
  const out: any = { revisadas: 0, ligadas: 0, sin_cuenta: 0, errores: [] as string[] };
  const cacheCuenta = new Map<string, string | null>();  // contactId → cuenta (evita refetch)

  let starting_after: string | null = null;
  try {
    while (Date.now() < deadline) {
      const url = `${API}/conversations?per_page=50` + (starting_after ? `&starting_after=${encodeURIComponent(starting_after)}` : '');
      const r = await fetch(url, { headers: IV });
      if (!r.ok) { out.errores.push(`lista ${r.status}`); break; }
      const j: any = await r.json();
      const convs: any[] = j.conversations || [];
      if (!convs.length) break;

      for (const c of convs) {
        if (Date.now() > deadline) break;
        out.revisadas++;
        const contactId = (Array.isArray(c.contacts?.contacts) ? c.contacts.contacts[0]?.id : null) || c.source?.author?.id || null;
        let email: string | null = c.source?.author?.email || null;
        let cuenta: string | null = null;
        if (contactId) {
          if (cacheCuenta.has(contactId)) cuenta = cacheCuenta.get(contactId)!;
          else { const enr = await cuentaDeContacto(contactId); cuenta = enr.cuenta; if (!email) email = enr.email; cacheCuenta.set(contactId, cuenta); }
        }
        let companyId: string | null = cuenta ? await companyIdDeCuenta(cuenta) : null;
        let crmContactId: string | null = null;
        if (email) {
          const { data: ct } = await supabase.from('contacts').select('id, company_id').eq('email', email.trim().toLowerCase()).limit(1).maybeSingle();
          if (ct) { crmContactId = ct.id; if (!companyId) companyId = ct.company_id || null; }
        }
        if (!companyId) { out.sin_cuenta++; }

        const estado = estadoDe(c);
        const fila: any = {
          conversation_id: String(c.id), company_id: companyId, contact_id: crmContactId,
          cuenta: cuenta ? normCuenta(cuenta) : null, estado,
          asunto: c.title || c.source?.subject || null,
          vista_previa: c.source?.body ? String(c.source.body).replace(/<[^>]*>/g, ' ').trim().slice(0, 300) : null,
          prioridad: c.priority || null,
          autor_email: email,
          abierto_at: seg(c.created_at),
          resuelto_at: estado === 'resuelto' ? seg(c.updated_at) : null,
          ultima_actividad_at: seg(c.updated_at) || seg(c.created_at),
          intercom_url: `https://app.intercom.com/a/apps/${APP_ID}/conversations/${c.id}`,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('crm_soporte_tickets').upsert(fila, { onConflict: 'conversation_id' });
        if (error) { out.errores.push(`upsert ${c.id}: ${error.message}`); continue; }
        if (companyId) out.ligadas++;

        // Evento en el timeline (idempotente por conversation_id + tipo).
        if (companyId && (estado === 'abierto' || estado === 'resuelto')) {
          const tipo = estado === 'resuelto' ? 'ticket_resuelto' : 'ticket_abierto';
          const { data: ya } = await supabase.from('activities').select('id')
            .eq('company_id', companyId).eq('tipo', tipo).contains('metadata', { conversation_id: String(c.id) }).limit(1);
          if (!ya?.length) {
            await supabase.from('activities').insert({
              company_id: companyId, contact_id: crmContactId, tipo, automatico: true,
              titulo: estado === 'resuelto' ? 'Ticket de soporte resuelto' : 'Nuevo ticket de soporte',
              descripcion: fila.asunto || null, created_at: fila.ultima_actividad_at || undefined,
              metadata: { conversation_id: String(c.id), intercom_url: fila.intercom_url, origen: 'intercom' },
            });
          }
        }
      }

      starting_after = j.pages?.next?.starting_after || null;
      if (!starting_after) break;
    }
    if (Date.now() > deadline) out.presupuesto_agotado = true;
    return json({ ok: true, ...out });
  } catch (e: any) {
    out.errores.push(e?.message || String(e));
    return json({ ok: false, ...out }, 500);
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });
  return correr();
};
export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });
  return correr();
};
