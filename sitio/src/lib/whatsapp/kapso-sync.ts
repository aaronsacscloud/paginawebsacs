// WHATSAPP · Etapa E: lo que el CRM le cuenta a Kapso (y le pregunta).
// Todo es "best effort" y silencioso: si Kapso falla, el CRM sigue; se loguea.
//
// 33 estado de conversación   → PATCH /whatsapp/conversations/{id} {status: active|ended}
// 34 asignación               → POST/PATCH /whatsapp/conversations/{id}/assignments (user_id de Kapso por email)
// 35 contacto con metadata    → PATCH /whatsapp/contacts/{tel} {display_name, metadata}
// 36 borrado GDPR             → DELETE /whatsapp/contacts/{tel}
// 37 preferencias de marketing→ GET /whatsapp/contacts/{tel}/marketing_preferences
// 40 bloquear / desbloquear   → POST/DELETE /{phone_number_id}/block_users
import { supabase } from '../supabase';

const ENV: any = (import.meta as any).env || process.env || {};
const API_KEY = (ENV.KAPSO_API_KEY || '').trim();
const PHONE_NUMBER_ID = (ENV.KAPSO_PHONE_NUMBER_ID || '').trim();
const PLATFORM = 'https://api.kapso.ai/platform/v1';
const META = 'https://api.kapso.ai/meta/whatsapp/v24.0';

async function req(base: string, ruta: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  if (!API_KEY) return { ok: false, status: 0, data: { error: 'Falta KAPSO_API_KEY' } };
  const res = await fetch(`${base}${ruta}`, { ...init, headers: { 'X-API-Key': API_KEY, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers || {}) } }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e) }) } as any));
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data?.data !== undefined ? data.data : data };
}
const dig = (tel: string) => String(tel || '').replace(/\D/g, '');

// ── 33 ──
export async function sincronizarEstadoKapso(kapsoConversationId: string | null | undefined, estadoCrm: string) {
  if (!kapsoConversationId) return;
  const status = estadoCrm === 'resuelta' ? 'ended' : 'active';
  const r = await req(PLATFORM, `/whatsapp/conversations/${kapsoConversationId}`, { method: 'PATCH', body: JSON.stringify({ whatsapp_conversation: { status } }) });
  if (!r.ok) console.warn('[kapso-sync estado]', r.status, JSON.stringify(r.data).slice(0, 200));
}

// ── 34 ──
let usuariosCache: { at: number; lista: any[] } | null = null;
export async function usuariosKapso(): Promise<{ id: string; email: string; name: string }[]> {
  if (usuariosCache && Date.now() - usuariosCache.at < 10 * 60e3) return usuariosCache.lista;
  const r = await req(PLATFORM, '/users?per_page=100');
  const lista = Array.isArray(r.data) ? r.data : [];
  usuariosCache = { at: Date.now(), lista };
  return lista;
}
export async function sincronizarAsignacionKapso(kapsoConversationId: string | null | undefined, teamMemberId: string | null, nota?: string) {
  if (!kapsoConversationId) return { ok: false, motivo: 'sin kapso_conversation_id' };
  const actuales = await req(PLATFORM, `/whatsapp/conversations/${kapsoConversationId}/assignments?per_page=5`);
  const activa = (Array.isArray(actuales.data) ? actuales.data : []).find((a: any) => a.active);
  if (!teamMemberId) {
    if (activa) await req(PLATFORM, `/whatsapp/conversations/${kapsoConversationId}/assignments/${activa.id}`, { method: 'PATCH', body: JSON.stringify({ assignment: { active: false } }) });
    return { ok: true };
  }
  const { data: tm } = await supabase.from('team_members').select('email, nombre').eq('id', teamMemberId).maybeSingle();
  const u: any = (await usuariosKapso()).find(x => x.email?.toLowerCase() === (tm?.email || '').toLowerCase());
  if (!u) return { ok: false, motivo: `${tm?.nombre || 'El agente'} no es usuario del proyecto en Kapso (${tm?.email}); invítalo en Kapso con ese correo para que el inbox de Kapso también lo vea asignado.` };
  const body = { assignment: { user_id: u.user_id || u.id, notes: nota || 'Asignado desde el CRM de Sacscloud' } };
  const r = activa
    ? await req(PLATFORM, `/whatsapp/conversations/${kapsoConversationId}/assignments/${activa.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    : await req(PLATFORM, `/whatsapp/conversations/${kapsoConversationId}/assignments`, { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok) return { ok: false, motivo: JSON.stringify(r.data).slice(0, 160) };
  return { ok: true };
}

// ── 35 ──
export async function sincronizarContactoKapso(telefono: string, datos: { nombre?: string | null; empresa?: string | null; etapa?: string | null; contact_id?: string | null; company_id?: string | null; plan?: string | null }) {
  const tel = dig(telefono); if (!tel) return;
  const body = { contact: {
    ...(datos.nombre ? { display_name: datos.empresa ? `${datos.nombre} (${datos.empresa})` : datos.nombre } : {}),
    metadata: { crm_contact_id: datos.contact_id || null, crm_company_id: datos.company_id || null, empresa: datos.empresa || null, etapa: datos.etapa || null, plan: datos.plan || null, crm: 'sacscloud' },
  } };
  let r = await req(PLATFORM, `/whatsapp/contacts/${tel}`, { method: 'PATCH', body: JSON.stringify(body) });
  if (r.status === 404) r = await req(PLATFORM, '/whatsapp/contacts', { method: 'POST', body: JSON.stringify({ contact: { wa_id: `+${tel}`, ...body.contact } }) });
  if (!r.ok) console.warn('[kapso-sync contacto]', r.status, JSON.stringify(r.data).slice(0, 200));
  return r.ok;
}

// ── 36 ──
export async function borrarContactoKapso(telefono: string): Promise<{ ok: boolean; motivo?: string }> {
  const tel = dig(telefono); if (!tel) return { ok: false, motivo: 'Teléfono inválido' };
  const r = await req(PLATFORM, `/whatsapp/contacts/${tel}`, { method: 'DELETE' });
  return r.ok || r.status === 404 ? { ok: true } : { ok: false, motivo: JSON.stringify(r.data).slice(0, 160) };
}

// ── 37 ──
export async function preferenciasMarketingKapso(telefono: string): Promise<{ stopped: boolean; detalle: any[] } | null> {
  const tel = dig(telefono); if (!tel) return null;
  const r = await req(PLATFORM, `/whatsapp/contacts/${tel}/marketing_preferences`);
  if (!r.ok) return null;
  const lista = Array.isArray(r.data) ? r.data : [];
  return { stopped: lista.some((p: any) => p.status === 'stopped' || p.marketing_allowed === false), detalle: lista };
}

// ── 40 ──
export async function bloqueadosKapso(): Promise<string[]> {
  const r = await req(META, `/${PHONE_NUMBER_ID}/block_users`);
  const lista = Array.isArray(r.data) ? r.data : (r.data?.data || []);
  return lista.map((x: any) => String(x.user || x.wa_id || x));
}
export async function bloquearKapso(telefono: string, bloquear: boolean): Promise<{ ok: boolean; motivo?: string }> {
  const tel = dig(telefono); if (!tel) return { ok: false, motivo: 'Teléfono inválido' };
  const r = await req(META, `/${PHONE_NUMBER_ID}/block_users`, { method: bloquear ? 'POST' : 'DELETE', body: JSON.stringify({ messaging_product: 'whatsapp', block_users: [{ user: tel }] }) });
  // Meta responde 200 aunque falle: hay que mirar failed_users. El caso típico
  // es 131047: solo se puede bloquear a quien escribió en las últimas 24 h.
  const fallidos: any[] = r.data?.block_users?.failed_users || [];
  if (fallidos.length) {
    const code = fallidos[0]?.errors?.[0]?.code;
    return { ok: false, motivo: code === 131047 ? 'WhatsApp solo permite bloquear a un número que te escribió en las últimas 24 horas.' : (fallidos[0]?.errors?.[0]?.message || 'Meta rechazó el bloqueo') };
  }
  return r.ok ? { ok: true } : { ok: false, motivo: JSON.stringify(r.data).slice(0, 200) };
}
