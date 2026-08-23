// WHATSAPP · Acciones de Etapa E sobre un contacto en Kapso/Meta.
// POST { accion:'bloquear'|'desbloquear', conversation_id }
// POST { accion:'gdpr', conversation_id }  → borra en Kapso (conversaciones, mensajes, media) y en el espejo local
// POST { accion:'resincronizar', conversation_id } → manda nombre/empresa/etapa del CRM a Kapso
// POST { accion:'webhook', inactivity_minutes } → actualiza eventos/inactividad del webhook
// GET  ?bloqueados=1
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { bloquearKapso, bloqueadosKapso, borrarContactoKapso, sincronizarContactoKapso } from '../../../../lib/whatsapp/kapso-sync';
import { actualizarWebhook, listarWebhooks } from '../../../../lib/whatsapp/kapso-api';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('bloqueados')) return json({ bloqueados: await bloqueadosKapso().catch(() => []) });
  return json({ error: 'Parámetro requerido' }, 400);
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const yo = await getCurrentUser(request).catch(() => null);
  const autor = (yo as any)?.nombre || null;
  if (b.accion === 'webhook') {
    const hooks = await listarWebhooks().catch(() => []);
    const lista = Array.isArray(hooks) ? hooks : (hooks?.data || []);
    const mio = lista.find((w: any) => w.kind === 'kapso' && /sacscloud\.com\/api\/whatsapp\/webhook\?/.test(w.url || ''));
    if (!mio) return json({ error: 'No encuentro nuestro webhook en Kapso' }, 404);
    const r = await actualizarWebhook(mio.id, Number(b.inactivity_minutes) || 60).catch((e: any) => ({ error: String(e?.message || e) }));
    if (r?.error) return json({ error: r.error }, 502);
    return json({ ok: true, webhook: mio.id });
  }
  if (!b.conversation_id) return json({ error: 'Falta conversation_id' }, 400);
  const { data: conv } = await supabase.from('wa_conversaciones').select('id, telefono, contact_id, company_id, contacts(nombre, apellido, lifecycle_stage), companies(nombre, nombre_comercial, plan)').eq('id', b.conversation_id).maybeSingle();
  if (!conv) return json({ error: 'Conversación no encontrada' }, 404);

  if (b.accion === 'bloquear' || b.accion === 'desbloquear') {
    const r = await bloquearKapso(conv.telefono, b.accion === 'bloquear');
    if (!r.ok) return json({ error: `No se pudo ${b.accion}: ${r.motivo}` }, 502);
    await supabase.from('wa_conversaciones').update({ alerta: b.accion === 'bloquear' ? 'Número bloqueado: no recibirás ni podrás mandarle mensajes hasta desbloquearlo' : null, ...(b.accion === 'bloquear' ? { estado_crm: 'resuelta', cierre_categoria: 'Spam / número equivocado' } : {}) }).eq('id', conv.id);
    await supabase.from('wa_eventos').insert({ conversation_id: conv.id, tipo: 'bloqueo', autor, detalle: b.accion === 'bloquear' ? 'Número bloqueado en WhatsApp (spam)' : 'Número desbloqueado' });
    return json({ ok: true });
  }
  if (b.accion === 'gdpr') {
    const r = await borrarContactoKapso(conv.telefono);
    if (!r.ok) return json({ error: `Kapso no pudo borrar: ${r.motivo}` }, 502);
    // Espejo local: mensajes, notas, eventos, lecturas, llamadas y la conversación.
    for (const t of ['wa_mensajes', 'wa_notas', 'wa_eventos', 'wa_lecturas', 'wa_presencia', 'wa_programados', 'wa_llamadas']) await supabase.from(t).delete().eq('conversation_id', conv.id);
    await supabase.from('wa_conversaciones').delete().eq('id', conv.id);
    if (conv.contact_id) { try { await supabase.from('activities').insert({ contact_id: conv.contact_id, company_id: conv.company_id, tipo: 'nota', titulo: `Datos de WhatsApp borrados a petición del cliente (GDPR) · ${autor || 'equipo'}`, automatico: true }); } catch { /* sin activity */ } }
    return json({ ok: true });
  }
  if (b.accion === 'resincronizar') {
    const c: any = conv.contacts, e: any = conv.companies;
    const ok = await sincronizarContactoKapso(conv.telefono, { nombre: c ? `${c.nombre || ''} ${c.apellido || ''}`.trim() : null, empresa: e?.nombre_comercial || e?.nombre || null, etapa: c?.lifecycle_stage || null, contact_id: conv.contact_id, company_id: conv.company_id, plan: e?.plan || null });
    return json({ ok: !!ok });
  }
  return json({ error: 'Acción desconocida' }, 400);
};
