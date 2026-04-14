import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== 'sacs-cron-2026') {
    return new Response('Forbidden', { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  // Find companies with overdue renewals
  const { data: overdue } = await supabase
    .from('companies')
    .select('id, nombre, plan, mrr, fecha_renovacion, estado_cuenta')
    .eq('estado_cuenta', 'activo')
    .lt('fecha_renovacion', today)
    .is('archived_at', null);

  let alerts = 0;

  for (const company of (overdue || [])) {
    const daysOverdue = Math.floor((Date.now() - new Date(company.fecha_renovacion + 'T00:00:00').getTime()) / 86400000);

    // Update payment status
    await supabase.from('companies').update({
      payment_status: daysOverdue > 30 ? 'moroso' : 'vencido',
      days_overdue: daysOverdue,
    }).eq('id', company.id);

    // If newly overdue (< 3 days), send WhatsApp reminder
    if (daysOverdue <= 3) {
      // Find contact for this company
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, whatsapp, nombre')
        .eq('company_id', company.id)
        .eq('tipo', 'cliente')
        .limit(1)
        .single();

      if (contact?.whatsapp) {
        try {
          const baseUrl = 'https://www.sacscloud.com';
          await fetch(`${baseUrl}/api/kapso/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: contact.whatsapp,
              message: `Hola ${contact.nombre}, tu suscripción de SACS (plan ${company.plan}) venció el ${company.fecha_renovacion}. ¿Necesitas ayuda con la renovación? Responde a este mensaje y te apoyamos.`,
            }),
          });
        } catch {}
      }

      if (contact) {
        await supabase.from('activities').insert({
          contact_id: contact.id,
          company_id: company.id,
          tipo: 'pago_vencido',
          titulo: `Renovación vencida: ${company.nombre} (${daysOverdue} días)`,
          metadata: { mrr: company.mrr, plan: company.plan, days_overdue: daysOverdue },
          automatico: true,
        });
      }

      alerts++;
    }
  }

  // Reset companies that are current
  await supabase.from('companies')
    .update({ payment_status: 'al_dia', days_overdue: 0 })
    .eq('estado_cuenta', 'activo')
    .gte('fecha_renovacion', today);

  return new Response(JSON.stringify({ overdue: (overdue || []).length, alerts_sent: alerts }));
};
