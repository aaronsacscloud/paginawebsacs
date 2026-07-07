import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { parseMeta, serializeMeta } from '../../../lib/quotes/meta';
import { notify } from '../../../lib/notify';
import { getPartnerProfile } from '../../../lib/partners/profile';

export const prerender = false;

// Cron diario (vercel.json) — recordatorios automáticos de cotizaciones 'sent'.
// Etapas (máx UNA por corrida por cotización, la más urgente primero):
//   r_expiring_48h — vence en <48h y sigue viva
//   r_no_accept_7d — 7+ días enviada, el cliente la abrió pero no decide
//   r_no_open_3d   — 3+ días enviada y el cliente NUNCA la ha abierto
// Cada etapa se manda una sola vez (meta.reminders_sent[]). El correo usa la
// plantilla quote_reminder_client firmada por el partner (reply-to al partner).

const CRON_KEY = 'sacs-cron-2026'; // mismo key-por-query que el cron de scheduling
const MAX_SENDS_PER_RUN = 50;

const DAY = 86400000;

function stageFor(q: any, meta: Record<string, any>): { stage: string; cta: string } | null {
  const sent = Array.isArray(meta.reminders_sent) ? meta.reminders_sent : [];
  const created = new Date(q.created_at).getTime();
  if (!isFinite(created)) return null;
  const ageDays = (Date.now() - created) / DAY;
  const views = Number(meta.views) || 0;

  // Vigencia
  let msToExpiry = Infinity;
  if (q.vigencia) {
    const end = new Date(q.vigencia.length === 10 ? q.vigencia + 'T23:59:59' : q.vigencia).getTime();
    if (isFinite(end)) msToExpiry = end - Date.now();
  }
  if (msToExpiry <= 0) return null; // vencida: la maneja el flujo de reactivación, no spam

  if (msToExpiry <= 2 * DAY && !sent.includes('r_expiring_48h')) {
    return {
      stage: 'r_expiring_48h',
      cta: 'Tu cotización vence pronto y con ella los precios especiales que te preparé. Si quieres avanzar o tienes dudas, escríbeme hoy mismo.',
    };
  }
  if (ageDays >= 7 && views > 0 && !sent.includes('r_no_accept_7d')) {
    return {
      stage: 'r_no_accept_7d',
      cta: '¿Qué te pareció la propuesta? Si hay algo que ajustar (alcance, presupuesto, tiempos) dime y lo revisamos — está a tiempo de personalizarse.',
    };
  }
  if (ageDays >= 3 && views === 0 && !sent.includes('r_no_open_3d')) {
    return {
      stage: 'r_no_open_3d',
      cta: 'Te comparto de nuevo el enlace por si se traspapeló. Ahí viene el detalle de todo lo que platicamos.',
    };
  }
  return null;
}

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== CRON_KEY) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('id, numero, empresa, contacto, email, total, moneda, vigencia, created_at, partner_id, notas, estado')
    .eq('estado', 'sent')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const partnerCache = new Map<string, any>();
  let sent = 0;
  const details: any[] = [];

  for (const q of quotes || []) {
    if (sent >= MAX_SENDS_PER_RUN) break;
    if (!q.email) continue;

    const { text, meta } = parseMeta(q.notas || '');
    const hit = stageFor(q, meta);
    if (!hit) continue;

    let partner: any = null;
    if (q.partner_id) {
      if (!partnerCache.has(q.partner_id)) {
        partnerCache.set(q.partner_id, await getPartnerProfile(q.partner_id).catch(() => null));
      }
      partner = partnerCache.get(q.partner_id);
    }

    try {
      await notify({
        channel: 'email',
        to: q.email,
        template: 'quote_reminder_client',
        replyTo: partner?.email || undefined,
        data: {
          numero: q.numero,
          contacto: q.contacto,
          total: q.total,
          moneda: q.moneda || 'MXN',
          quoteUrl: `https://www.sacscloud.com/cotizacion/${q.id}`,
          cta_text: hit.cta,
          partner,
        },
      });
    } catch (e: any) {
      details.push({ id: q.id, stage: hit.stage, error: String(e?.message || e) });
      continue;
    }

    // Persistir la etapa enviada + evento en el timeline
    if (!Array.isArray(meta.reminders_sent)) meta.reminders_sent = [];
    meta.reminders_sent.push(hit.stage);
    if (!Array.isArray(meta.timeline)) meta.timeline = [];
    meta.timeline.push({ event: 'reminder', stage: hit.stage, at: new Date().toISOString() });
    await supabase.from('quotes').update({ notas: serializeMeta(text, meta) }).eq('id', q.id);

    sent++;
    details.push({ id: q.id, numero: q.numero, stage: hit.stage });
  }

  return new Response(JSON.stringify({ ok: true, checked: (quotes || []).length, sent, details }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
