// GET /api/cron/arr-weekly?key=... — resumen semanal del ARR (lunes):
// email al inbox de ventas + WhatsApp al admin: ARR vs meta, cobros de la
// semana pasada, vencidas, riesgo y alertas activas.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notify, getSalesInbox } from '../../../lib/notify';
import { sendWhatsApp } from '../../../lib/kapso';

export const prerender = false;

const CRON_KEY = import.meta.env.CRM_CRON_KEY || 'sacs-cron-2026';
const ADMIN_WHATSAPP = (import.meta.env.CRM_ADMIN_WHATSAPP || '').trim();
const SITE = 'https://www.sacscloud.com';

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== CRON_KEY) return new Response('Forbidden', { status: 403 });

  const sum = await fetch(SITE + '/api/crm/arr/summary').then(r => r.json()).catch(() => null);
  if (!sum?.kpis) return new Response(JSON.stringify({ error: 'summary no disponible' }), { status: 500 });

  const hace7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const { data: pagos } = await supabase.from('payments')
    .select('monto, fecha').gte('fecha', hace7).eq('migrado', false);
  const cobrosSemana = (pagos || []).reduce((a, p: any) => a + Number(p.monto || 0), 0);

  const k = sum.kpis, r = sum.riesgo, v = sum.vencidas || [];
  const riesgoN = (r?.banda_3_15?.length || 0) + (r?.banda_15_mas?.length || 0);
  const vencMonto = v.reduce((a: number, x: any) => a + Number(x.monto || 0), 0);

  const topRiesgo = [...(r?.banda_15_mas || []), ...(r?.banda_3_15 || [])].slice(0, 5)
    .map((x: any) => `<li>${x.nombre} — ${x.dias_sin_venta} días sin vender ($${Math.round(x.arr).toLocaleString('es-MX')} ARR)</li>`).join('');
  const topVenc = v.slice(0, 5).map((x: any) => `<li>${x.empresa} — vencida ${x.dias_vencida} días ($${Math.round(x.monto).toLocaleString('es-MX')})</li>`).join('');
  const detalle = `
    ${topVenc ? `<div style="margin:0 0 12px"><strong>Vencidas top:</strong><ul style="margin:6px 0;color:#555;font-size:0.85rem">${topVenc}</ul></div>` : ''}
    ${topRiesgo ? `<div style="margin:0 0 12px"><strong>En riesgo top:</strong><ul style="margin:6px 0;color:#555;font-size:0.85rem">${topRiesgo}</ul></div>` : ''}`;

  const data = {
    arr: k.arr_activo, meta_pct: sum.meta?.progreso_pct || 0,
    cobros_semana_n: (pagos || []).length, cobros_semana: Math.round(cobrosSemana),
    vencidas_n: v.length, vencidas: Math.round(vencMonto),
    riesgo_n: riesgoN, riesgo: r?.arr_en_riesgo || 0,
    detalle_html: detalle,
  };

  const email = await notify({ channel: 'email', to: getSalesInbox(), template: 'arr_weekly_summary', data }).catch(() => ({ ok: false }));

  let wa = { sent: false };
  if (ADMIN_WHATSAPP) {
    wa = await sendWhatsApp(ADMIN_WHATSAPP,
      `📊 SACS ARR semanal\n\nARR activo: $${Math.round(k.arr_activo).toLocaleString('es-MX')} (${sum.meta?.progreso_pct || 0}% de la meta)\nCobros 7d: ${(pagos || []).length} por $${Math.round(cobrosSemana).toLocaleString('es-MX')}\nVencidas: ${v.length} ($${Math.round(vencMonto).toLocaleString('es-MX')})\nEn riesgo: ${riesgoN} clientes ($${Math.round(r?.arr_en_riesgo || 0).toLocaleString('es-MX')} ARR)\n\n${SITE}/admin/crm?tab=suscripciones`).catch(() => ({ sent: false }));
  }

  return new Response(JSON.stringify({ ok: true, email_ok: (email as any)?.ok, wa_ok: (wa as any)?.sent, data }, null, 2),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
};
