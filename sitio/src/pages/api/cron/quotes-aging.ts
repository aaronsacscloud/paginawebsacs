// Vercel Cron diario — /api/cron/quotes-aging
// Reglas:
//   - quote 'sent' día 3 sin vista → email recordatorio + activity
//   - quote 'sent' día 7 → task al owner "Llamar a <contacto>"
//   - quote 'sent' día 14 → segundo email CTA urgente
//   - vigencia vencida sin aceptar → estado=expired, deal cerrada_perdida (timeout)
//   - vencida hace 45 días + opt-in → email de reactivación
//
// Autenticación: Vercel Cron envía header `Authorization: Bearer $CRON_SECRET`.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { syncQuoteToDeal } from '../../../lib/crm/sync-quote-deal';
import { notify } from '../../../lib/notify';

export const prerender = false;

const CRON_SECRET = (import.meta.env.CRON_SECRET || '').trim();
const QUOTE_PUBLIC_BASE = (import.meta.env.PUBLIC_BASE_URL || 'https://www.sacscloud.com').replace(/\/$/, '');

function parseMeta(notas: string | null | undefined) {
  const sep = '\n---META---\n';
  const raw = notas || '';
  const idx = raw.indexOf(sep);
  if (idx < 0) return { text: raw, meta: {} as any };
  try { return { text: raw.slice(0, idx), meta: JSON.parse(raw.slice(idx + sep.length)) || {} }; }
  catch { return { text: raw.slice(0, idx), meta: {} }; }
}

async function appendMeta(quoteId: string, updater: (m: any) => any) {
  const { data } = await supabase.from('quotes').select('notas').eq('id', quoteId).single();
  if (!data) return;
  const { text, meta } = parseMeta(data.notas);
  const newMeta = updater({ ...meta });
  const sep = '\n---META---\n';
  await supabase.from('quotes').update({ notas: text + sep + JSON.stringify(newMeta) }).eq('id', quoteId);
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return Infinity;
  return (Date.now() - t) / 86400000;
}

function daysUntil(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return Infinity;
  return (t - Date.now()) / 86400000;
}

export const GET: APIRoute = async ({ request }) => {
  // Auth: either Vercel Cron bearer or internal dry-run param
  const auth = request.headers.get('authorization') || '';
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  if (CRON_SECRET && !dryRun && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const results: any = { processed: 0, reminders_sent: 0, tasks_created: 0, expired: 0, errors: [] as string[] };

  // Pull all potentially relevant quotes (sent, expired within last 60d)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('id, numero, estado, email, contacto, empresa, moneda, total, vigencia, created_at, deal_id, contact_id, company_id, notas')
    .in('estado', ['sent', 'expired'])
    .gte('created_at', cutoff.toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  for (const q of quotes || []) {
    results.processed++;
    try {
      const { meta } = parseMeta(q.notas);
      const views = meta.views || 0;
      const remindersSent: Record<string, boolean> = meta.reminders_sent || {};
      const age = daysSince(q.created_at);
      const vigDaysRemaining = daysUntil(q.vigencia);
      const quoteUrl = `${QUOTE_PUBLIC_BASE}/cotizacion/${q.id}`;

      // ─── expired by vigencia ───
      if (q.estado === 'sent' && vigDaysRemaining < 0) {
        await supabase.from('quotes').update({ estado: 'expired' }).eq('id', q.id);
        // Move deal to cerrada_perdida with motivo timeout
        await syncQuoteToDeal(q.id, {
          targetStage: 'cerrada_perdida',
          motivo_perdida: 'sin_respuesta_timeout',
          trigger: 'quote_expired_timeout',
        });
        await supabase.from('activities').insert({
          contact_id: q.contact_id,
          company_id: q.company_id,
          deal_id: q.deal_id,
          tipo: 'sistema',
          titulo: `Cotización ${q.numero} expiró sin respuesta`,
          metadata: { quote_id: q.id, age_days: Math.round(age), motivo: 'sin_respuesta_timeout' },
          automatico: true,
        });
        results.expired++;
        continue;
      }

      // ─── expired → reactivation drip at 45d ───
      if (q.estado === 'expired') {
        const expiredDays = daysSince(q.vigencia);
        if (expiredDays >= 44 && expiredDays <= 46 && !remindersSent['reactivation_45d'] && q.email) {
          const r = await notify({
            channel: 'email',
            to: q.email,
            template: 'quote_reminder_client',
            data: {
              numero: q.numero,
              contacto: q.contacto || q.empresa,
              total: q.total,
              moneda: q.moneda || 'MXN',
              quoteUrl,
              cta_text: 'Si esto vuelve a interesarte, podemos armar una cotización actualizada. Cuéntanos si hay forma de ayudarte.',
            },
          });
          if (r.ok) {
            await appendMeta(q.id, (m: any) => {
              m.reminders_sent = { ...(m.reminders_sent || {}), reactivation_45d: true };
              m.timeline = [...(m.timeline || []), { event: 'reactivation_email', at: new Date().toISOString() }];
              return m;
            });
            results.reminders_sent++;
          }
        }
        continue;
      }

      // From here: q.estado === 'sent'
      // ─── Day 3 reminder (sin vista) ───
      if (age >= 3 && age < 7 && views === 0 && !remindersSent['day3'] && q.email) {
        const r = await notify({
          channel: 'email',
          to: q.email,
          template: 'quote_reminder_client',
          data: {
            numero: q.numero,
            contacto: q.contacto || q.empresa,
            total: q.total,
            moneda: q.moneda || 'MXN',
            quoteUrl,
            cta_text: '¿Pudiste revisar la propuesta? Si tienes cualquier duda, estamos a tu orden.',
          },
        });
        if (r.ok) {
          await appendMeta(q.id, (m: any) => {
            m.reminders_sent = { ...(m.reminders_sent || {}), day3: true };
            m.timeline = [...(m.timeline || []), { event: 'reminder_email', day: 3, at: new Date().toISOString() }];
            return m;
          });
          await supabase.from('activities').insert({
            contact_id: q.contact_id,
            company_id: q.company_id,
            deal_id: q.deal_id,
            tipo: 'email',
            titulo: `Email recordatorio día 3 — Cotización ${q.numero}`,
            metadata: { event: 'reminder_day3', quote_id: q.id },
            automatico: true,
          });
          results.reminders_sent++;
        }
      }

      // ─── Day 7 task to owner ───
      if (age >= 7 && age < 14 && !remindersSent['day7_task']) {
        await supabase.from('activities').insert({
          contact_id: q.contact_id,
          company_id: q.company_id,
          deal_id: q.deal_id,
          tipo: 'tarea',
          titulo: `Llamar a ${q.contacto || q.empresa} — cotización fría`,
          metadata: { task: true, category: 'follow_up', source: 'aging_day7', quote_id: q.id },
          automatico: true,
        });
        await appendMeta(q.id, (m: any) => {
          m.reminders_sent = { ...(m.reminders_sent || {}), day7_task: true };
          return m;
        });
        results.tasks_created++;
      }

      // ─── Day 14 urgent email ───
      if (age >= 14 && age < 30 && !remindersSent['day14'] && q.email) {
        const r = await notify({
          channel: 'email',
          to: q.email,
          template: 'quote_reminder_client',
          data: {
            numero: q.numero,
            contacto: q.contacto || q.empresa,
            total: q.total,
            moneda: q.moneda || 'MXN',
            quoteUrl,
            cta_text: 'Solo confirmando que sigue pendiente tu cotización. Si necesitas que ajustemos algo (precio, alcance, timing) me avisas y con gusto te armo una versión actualizada.',
          },
        });
        if (r.ok) {
          await appendMeta(q.id, (m: any) => {
            m.reminders_sent = { ...(m.reminders_sent || {}), day14: true };
            m.timeline = [...(m.timeline || []), { event: 'reminder_email', day: 14, at: new Date().toISOString() }];
            return m;
          });
          results.reminders_sent++;
        }
      }
    } catch (err) {
      results.errors.push(String(err));
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
