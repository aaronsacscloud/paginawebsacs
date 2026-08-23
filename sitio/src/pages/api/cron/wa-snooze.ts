// GET /api/cron/wa-snooze — cada 15 min (Vercel cron).
//
// Despierta las conversaciones pospuestas cuyo snooze venció: limpia
// snooze_until, las marca no leídas (para que griten en el rail) y avisa por
// la campana. El filtro del inbox ya las re-enseña por query-time aunque el
// cron se retrase; esto es el empujón visible.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { notificar } from '../../../lib/crm/notificaciones';
import { telefonoLegible } from '../../../lib/telefono';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response('No', { status: 401 });

  const { data: vencidas } = await supabase.from('wa_conversaciones')
    .select('id, telefono, no_leidos, contacts(nombre, apellido)')
    .not('snooze_until', 'is', null)
    .lte('snooze_until', new Date().toISOString())
    .limit(100);

  for (const c of vencidas || []) {
    await supabase.from('wa_conversaciones')
      .update({ snooze_until: null, no_leidos: (c.no_leidos || 0) + 1, estado_crm: 'abierta' })
      .eq('id', c.id);
    const nombre = (c as any).contacts
      ? `${(c as any).contacts.nombre || ''} ${(c as any).contacts.apellido || ''}`.trim()
      : telefonoLegible(c.telefono);
    await notificar({
      clave: `wa_snooze_${c.id}_${new Date().toISOString().slice(0, 13)}`,
      tipo: 'wa_snooze',
      titulo: `Seguimiento: la conversación con ${nombre} despertó`,
      destino: 'whatsapp',
      metadata: { conversation_id: c.id },
    });
  }

  return new Response(JSON.stringify({ despertadas: (vencidas || []).length }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
