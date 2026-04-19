// Vercel Cron diario — /api/cron/renewals
// Envía recordatorios a clientes con renovación en {30, 14, 7, 1} días.
// Escala a owner por email cuando estado_cuenta=vencido hace 7/14 días.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';

export const prerender = false;

const CRON_SECRET = (import.meta.env.CRON_SECRET || '').trim();

function daysUntil(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return Infinity;
  return Math.ceil((t - Date.now()) / 86400000);
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return Infinity;
  return Math.ceil((Date.now() - t) / 86400000);
}

const REMINDER_DAYS = [30, 14, 7, 1];

export const GET: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization') || '';
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  if (CRON_SECRET && !dryRun && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const results: any = { reminders_sent: 0, escalations: 0, processed: 0, errors: [] as string[] };

  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, nombre, mrr, moneda, fecha_renovacion, estado_cuenta, contact_id, stripe_subscription_id, contacts(email, whatsapp, nombre), renewals_log')
    .not('fecha_renovacion', 'is', null)
    .in('estado_cuenta', ['activo', 'vencido', 'trial']);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  for (const c of companies || []) {
    results.processed++;
    try {
      const remaining = daysUntil(c.fecha_renovacion);
      const contact: any = (c as any).contacts;
      const log = (c as any).renewals_log || {};
      const keyForDay = (d: number) => `d${d}_${(c.fecha_renovacion || '').slice(0, 10)}`;

      // Reminders
      if (contact?.email) {
        for (const d of REMINDER_DAYS) {
          if (remaining === d && !log[keyForDay(d)]) {
            const r = await notify({
              channel: 'email',
              to: contact.email,
              template: 'renewal_reminder',
              data: {
                contacto: contact.nombre || c.nombre,
                days: d,
                fecha: new Date(c.fecha_renovacion).toLocaleDateString('es-MX'),
                total: c.mrr || 0,
                moneda: c.moneda || 'MXN',
                action_required: d === 1 && c.estado_cuenta === 'vencido' ? 'Actualiza tu método de pago para evitar interrupciones.' : null,
              },
            });
            if (r.ok) {
              log[keyForDay(d)] = new Date().toISOString();
              await supabase.from('companies').update({ renewals_log: log }).eq('id', c.id).then(() => {}).catch(() => {});
              results.reminders_sent++;
            }
          }
        }
      }

      // Escalation: estado_cuenta=vencido hace >= 7/14 días
      const vencidoSince = c.estado_cuenta === 'vencido' ? daysSince((c as any).updated_at || c.fecha_renovacion) : -1;
      if (vencidoSince === 7 || vencidoSince === 14) {
        await supabase.from('activities').insert({
          contact_id: c.contact_id,
          company_id: c.id,
          tipo: 'tarea',
          titulo: `Escalamiento cobro vencido (${vencidoSince}d) — ${c.nombre}`,
          metadata: { task: true, category: 'dunning', company_id: c.id, days_overdue: vencidoSince },
          automatico: true,
        });
        results.escalations++;
      }
    } catch (err) {
      results.errors.push(String(err));
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
