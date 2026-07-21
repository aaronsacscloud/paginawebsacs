// GET /api/cron/arr-reminders?key=... — cobra solo (corre diario):
// 1) RECORDATORIOS de renovación: anuales a 30/15/7 días, mensuales a 3
//    → email al cliente (best-effort) + registro en activities (dedup por hito).
// 2) DUNNING de vencidas: día 1 email, día 3 WhatsApp al cliente, día 7 tarea
//    (activity) — y la suscripción activa pasa a pendiente_pago.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';
import { sendWhatsApp } from '../../../lib/kapso';
import { recordMovement } from '../../../lib/crm/mrr-ledger';

export const prerender = false;

const CRON_KEY = import.meta.env.CRM_CRON_KEY || 'sacs-cron-2026';

const fmtD = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

async function yaAvisado(subId: string, hito: string): Promise<boolean> {
  const { data } = await supabase.from('activities').select('id')
    .eq('automatico', true).contains('metadata', { arr_aviso: hito, subscription_id: subId }).limit(1).maybeSingle();
  return !!data;
}
async function marcarAviso(sub: any, hito: string, titulo: string) {
  await supabase.from('activities').insert({
    tipo: 'sistema', titulo, company_id: sub.company_id, contact_id: sub.contact_id,
    automatico: true, metadata: { arr_aviso: hito, subscription_id: sub.id },
  }).select().maybeSingle();
}

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== CRON_KEY) return new Response('Forbidden', { status: 403 });
  const hoy = new Date().toISOString().slice(0, 10);
  const out = { recordatorios: 0, dunning_email: 0, dunning_wa: 0, tareas: 0, a_pendiente: 0, errores: [] as string[] };

  const { data: subs, error } = await supabase.from('subscriptions')
    .select('*, companies(id, nombre), contacts(id, nombre, email, whatsapp)')
    .in('estado', ['activa', 'pendiente_pago']).not('proxima_factura', 'is', null);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  for (const s of (subs || []) as any[]) {
    try {
      const dias = Math.round((new Date(s.proxima_factura).getTime() - new Date(hoy).getTime()) / 86400000);
      const empresa = s.companies?.nombre || '—';
      const contacto = s.contacts || {};
      const monto = Number(s.monto_proximo ?? s.precio) || 0;

      // ── recordatorios previos ── (no a quien ya pidió cancelar al vencer)
      const hitos = s.ciclo === 'anual' ? [30, 15, 7] : [3];
      if (dias >= 0 && hitos.includes(dias) && !s.cancela_al_vencer) {
        const hito = 'recordatorio_' + s.proxima_factura + '_' + dias;
        if (!(await yaAvisado(s.id, hito))) {
          if (contacto.email) {
            await notify({
              channel: 'email', to: contacto.email, template: 'arr_renewal_reminder',
              data: { empresa, contacto: contacto.nombre, plan: s.nombre_plan, ciclo: s.ciclo, fecha: fmtD(s.proxima_factura), monto },
            }).catch(() => null);
          }
          await marcarAviso(s, hito, `🔔 Recordatorio de renovación enviado (${dias} días): ${empresa} · ${s.nombre_plan} · $${monto.toLocaleString('es-MX')}`);
          out.recordatorios++;
        }
      }

      // ── cancelación "al vencer": al llegar la fecha, se apaga de verdad ──
      if (s.cancela_al_vencer && dias <= 0) {
        await supabase.from('subscriptions').update({
          estado: 'cancelada', cancelada_at: new Date().toISOString(), cancela_al_vencer: false, updated_at: new Date().toISOString(),
        }).eq('id', s.id);
        const churn: any = { company_id: s.company_id, mrr_lost: s.mrr, reason: s.razon_cancelacion || 'cancelación programada', cancelled_at: new Date().toISOString() };
        let cr = await supabase.from('churn_events').insert({ ...churn, subscription_id: s.id }).select().maybeSingle();
        if (cr.error && /column .* does not exist|schema cache/i.test(cr.error.message || '')) await supabase.from('churn_events').insert(churn).select().maybeSingle();
        await recordMovement({ subscription_id: s.id, company_id: s.company_id, tipo: 'churn', mrr_anterior: Number(s.mrr || 0), mrr_nuevo: 0, motivo: s.razon_cancelacion || 'cancelación al vencer', actor: 'cron' });
        await marcarAviso(s, 'cancelada_al_vencer_' + s.proxima_factura, `🚫 Cancelación efectiva (era al vencer): ${empresa} · ${s.nombre_plan}`);
        continue; // no dunning ni recordatorios para algo que ya se apagó
      }

      // ── dunning de vencidas ──
      if (dias < 0) {
        const vencidaDias = Math.abs(dias);
        // la activa vencida pasa a pendiente_pago (estado honesto)
        if (s.estado === 'activa' && vencidaDias >= 1) {
          await supabase.from('subscriptions').update({ estado: 'pendiente_pago', updated_at: new Date().toISOString() }).eq('id', s.id);
          out.a_pendiente++;
        }
        if (vencidaDias >= 1 && !(await yaAvisado(s.id, 'dunning_email_' + s.proxima_factura))) {
          if (contacto.email) {
            await notify({
              channel: 'email', to: contacto.email, template: 'arr_payment_overdue',
              data: { empresa, contacto: contacto.nombre, plan: s.nombre_plan, fecha: fmtD(s.proxima_factura), dias: vencidaDias, monto },
            }).catch(() => null);
            out.dunning_email++;
          }
          await marcarAviso(s, 'dunning_email_' + s.proxima_factura, `📧 Dunning día 1 (email): ${empresa} · vencida ${fmtD(s.proxima_factura)} · $${monto.toLocaleString('es-MX')}`);
        }
        if (vencidaDias >= 3 && !(await yaAvisado(s.id, 'dunning_wa_' + s.proxima_factura))) {
          if (contacto.whatsapp) {
            await sendWhatsApp(contacto.whatsapp,
              `Hola ${contacto.nombre || ''} 👋 Te escribimos de SACS: el pago de tu suscripción ${s.nombre_plan} venció el ${fmtD(s.proxima_factura)} ($${monto.toLocaleString('es-MX')} MXN). ¿Te ayudamos a regularizarlo? Si ya pagaste, mándanos tu comprobante por aquí. 🙌`).catch(() => null);
            out.dunning_wa++;
          }
          await marcarAviso(s, 'dunning_wa_' + s.proxima_factura, `📱 Dunning día 3 (WhatsApp): ${empresa} · $${monto.toLocaleString('es-MX')}`);
        }
        if (vencidaDias >= 7 && !(await yaAvisado(s.id, 'dunning_tarea_' + s.proxima_factura))) {
          await marcarAviso(s, 'dunning_tarea_' + s.proxima_factura,
            `☎️ TAREA: llamar a ${empresa} — pago vencido ${vencidaDias} días ($${monto.toLocaleString('es-MX')})${contacto.whatsapp ? ' · Tel: ' + contacto.whatsapp : ''}`);
          out.tareas++;
        }
      }
    } catch (e: any) {
      out.errores.push((s.nombre_plan || s.id) + ': ' + (e?.message || String(e)));
    }
  }

  return new Response(JSON.stringify(out, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
