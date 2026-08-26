// CRON · SLA del primer toque (cada 10 min).
//
// En leads de campaña la velocidad del primer contacto ES la conversión.
// Aviso 1 a los 30 min sin toque; escala a los 120. Cada aviso se firma en
// propiedades.sla (idempotente: no re-suena) y va por campana + WhatsApp al
// equipo, agrupado en UN mensaje.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { avisarSLA } from '../../../lib/crm/aviso-lead';
import { notificar } from '../../../lib/crm/notificaciones';

export const prerender = false;
const json = (o: any) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async () => {
  const { data: leads } = await supabase.from('contacts')
    .select('id, nombre, apellido, whatsapp, email, created_at, propiedades')
    .eq('lifecycle_stage', 'lead').eq('estatus_lead', 'nuevo')
    .is('archived_at', null).is('last_contact_at', null)
    .lt('created_at', new Date(Date.now() - 30 * 60000).toISOString())
    // Solo lo de HOY-ayer: los viejos ya son Rezagados, no una emergencia.
    .gt('created_at', new Date(Date.now() - 48 * 3600e3).toISOString())
    .limit(50);

  const avisar: { id: string; nombre: string; mins: number }[] = [];
  for (const c of leads || []) {
    const mins = Math.floor((Date.now() - Date.parse(c.created_at)) / 60000);
    const sla = (c.propiedades as any)?.sla || {};
    const nivel = mins >= 120 ? 2 : 1;
    if (sla[`aviso${nivel}`]) continue;   // ya sonó este nivel
    avisar.push({ id: c.id, nombre: [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email || c.whatsapp || 'Sin nombre', mins });
    await supabase.from('contacts').update({ propiedades: { ...(c.propiedades || {}), sla: { ...sla, [`aviso${nivel}`]: new Date().toISOString() } } }).eq('id', c.id);
    await notificar({ clave: `sla_lead_${c.id}_${nivel}`, tipo: 'lead_sla', titulo: `${nivel === 2 ? '🔴' : '⏰'} Lead sin primer toque hace ${mins} min: ${[c.nombre, c.apellido].filter(Boolean).join(' ') || c.whatsapp || c.email}`, metadata: { contact_id: c.id } }).catch(() => {});
  }
  if (avisar.length) await avisarSLA(avisar).catch(() => {});
  return json({ ok: true, avisados: avisar.length });
};
