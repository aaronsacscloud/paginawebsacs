import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { syncQuoteToDeal, ensureContactForQuote } from '../../../lib/crm/sync-quote-deal';
import { notify, getSalesInbox } from '../../../lib/notify';

export const prerender = false;

const MOTIVOS: Record<string, string> = {
  precio: 'Precio',
  timing: 'Timing',
  competidor: 'Competidor',
  no_fit: 'No es el producto que necesitan',
  otro: 'Otro',
};

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const body = await request.json();
    const { quoteId, motivo, detalle, competidor, from } = body || {};

    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'quoteId requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (!motivo || !MOTIVOS[motivo]) {
      return new Response(JSON.stringify({ error: 'motivo inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: quote, error: fetchErr } = await supabase
      .from('quotes').select('*').eq('id', quoteId).single();

    if (fetchErr || !quote) {
      return new Response(JSON.stringify({ error: 'cotización no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (quote.estado === 'paid') {
      return new Response(JSON.stringify({ error: 'la cotización ya está pagada' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    if (quote.estado === 'rejected') {
      return new Response(JSON.stringify({ error: 'la cotización ya está rechazada' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const sep = '\n---META---\n';
    const raw = quote.notas || '';
    const idx = raw.indexOf(sep);
    let textPart = raw;
    let meta: any = {};
    if (idx >= 0) {
      textPart = raw.slice(0, idx);
      try { meta = JSON.parse(raw.slice(idx + sep.length)) || {}; } catch { meta = {}; }
    }

    const now = new Date().toISOString();
    meta.motivo_rechazo = motivo;
    if (detalle) meta.detalle_rechazo = String(detalle).slice(0, 1000);
    if (competidor) meta.competidor = String(competidor).slice(0, 200);
    if (!meta.timeline) meta.timeline = [];
    meta.timeline.push({
      event: 'rejected',
      at: now,
      motivo,
      detalle: detalle || null,
      competidor: competidor || null,
      from: from || 'client',
    });

    const newNotas = textPart + sep + JSON.stringify(meta);

    // Update with rechazado_fecha if column exists; fall back to notas-only if not
    let { error: updateErr } = await supabase
      .from('quotes')
      .update({
        estado: 'rejected',
        rechazado_fecha: now,
        notas: newNotas,
      })
      .eq('id', quoteId);

    if (updateErr && String(updateErr.message || '').includes('rechazado_fecha')) {
      // Column not yet migrated — fall back (fecha stays only in meta.timeline)
      const fallback = await supabase
        .from('quotes')
        .update({ estado: 'rejected', notas: newNotas })
        .eq('id', quoteId);
      updateErr = fallback.error;
    }

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // ─── Post-rejection automation ───
    let dealResult: any = null;
    let contactId: string | null = quote.contact_id || null;
    try {
      contactId = await ensureContactForQuote(quote);

      // Move deal to cerrada_perdida with motivo
      dealResult = await syncQuoteToDeal(quoteId, {
        targetStage: 'cerrada_perdida',
        motivo_perdida: motivo,
        trigger: 'quote_rejected',
      });

      // Activity
      await supabase.from('activities').insert({
        contact_id: contactId,
        company_id: quote.company_id || null,
        deal_id: dealResult?.dealId || null,
        tipo: 'cotizacion',
        titulo: `Cotización ${quote.numero || ''} rechazada`,
        metadata: {
          event: 'cotizacion_rechazada',
          quote_id: quoteId,
          motivo,
          motivo_label: MOTIVOS[motivo],
          detalle: detalle || null,
          competidor: competidor || null,
          from: from || 'client',
        },
        automatico: true,
      });

      // Nurture: if motivo is precio/timing → schedule 60-day follow-up
      if (contactId && (motivo === 'precio' || motivo === 'timing')) {
        const followup = new Date();
        followup.setDate(followup.getDate() + 60);
        await supabase
          .from('contacts')
          .update({
            lifecycle_stage: 'nurture',
            next_followup: followup.toISOString(),
          })
          .eq('id', contactId);
      }

      // Notify owner + sales
      const ownerEmail = await (async () => {
        if (!dealResult?.dealId) return null;
        const { data: d } = await supabase.from('deals').select('owner_id, team_members(email)').eq('id', dealResult.dealId).single();
        return (d as any)?.team_members?.email || null;
      })();
      const origin = url ? new URL(url).origin : 'https://www.sacscloud.com';
      const adminUrl = `${origin}/admin/crm?tab=cotizaciones`;
      const notifyData = {
        numero: quote.numero,
        empresa: quote.empresa,
        motivo,
        motivo_label: MOTIVOS[motivo],
        detalle: detalle || competidor || '',
        adminUrl,
      };
      const targets = [getSalesInbox(), ownerEmail].filter(Boolean) as string[];
      for (const to of targets) {
        await notify({ channel: 'email', to, template: 'quote_rejected_owner', data: notifyData });
      }
    } catch (postErr) {
      console.error('[mark-rejected] post-rejection flow error:', postErr);
    }

    return new Response(JSON.stringify({
      success: true,
      rechazado_fecha: now,
      motivo,
      deal_id: dealResult?.dealId || null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
