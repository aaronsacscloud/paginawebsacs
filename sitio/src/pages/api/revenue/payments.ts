import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { sendAcuseEmail } from '../../../lib/payments/send-acuse';

export const prerender = false;

const NOTAS_SEP = '\n---META---\n';

function appendTimeline(notas: string | null, event: Record<string, any>): string {
  const raw = notas || '';
  const idx = raw.indexOf(NOTAS_SEP);
  let text = raw;
  let meta: any = {};
  if (idx >= 0) {
    text = raw.slice(0, idx);
    try { meta = JSON.parse(raw.slice(idx + NOTAS_SEP.length)) || {}; } catch {}
  }
  if (!meta.timeline) meta.timeline = [];
  meta.timeline.push({ ...event, at: event.at || new Date().toISOString() });
  return text + NOTAS_SEP + JSON.stringify(meta);
}

export const GET: APIRoute = async ({ url }) => {
  const quoteId = url.searchParams.get('quote_id') || '';

  // La tabla legacy `clients` fue retirada; los pagos se consultan por cotización.
  let query = supabase.from('payments').select('*').order('fecha', { ascending: false });

  if (quoteId) query = query.eq('quote_id', quoteId);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  // Insert payment — schema accepts quote_id (added in migration-2026-04-payments-receipts.sql)
  const payload: any = {
    quote_id: body.quote_id || null,
    // La empresa viaja cuando quien registra el abono ya sabe de quién es (p.ej.
    // Cobranza): sin ella, el pago no se puede agrupar por cliente después.
    company_id: body.company_id || null,
    fecha: body.fecha,
    monto: Number(body.monto || 0),
    metodo: body.metodo,
    referencia: body.referencia || null,
    comprobante_url: body.comprobante_url || null,
    items_cubiertos: Array.isArray(body.items_cubiertos) ? body.items_cubiertos : null,
    notas: body.notas || null,
    estado: body.estado || 'confirmado',
  };

  // Retry without optional cols if migration aún no aplicada
  let { data, error } = await supabase.from('payments').insert(payload).select().single();
  if (error && /quote_id|comprobante_url|items_cubiertos|notas|estado/.test(String(error.message))) {
    const fallback: any = { quote_id: payload.quote_id, fecha: payload.fecha, monto: payload.monto, metodo: payload.metodo, referencia: payload.referencia };
    const retry = await supabase.from('payments').insert(fallback).select().single();
    data = retry.data; error = retry.error;
  }

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Si el pago está ligado a una cotización, recalcular saldo y avanzar estado si se completa
  let quoteUpdate: { totalPagado: number; saldoRestante: number; isPaid: boolean } | null = null;
  let cierreResult: any = null;
  if (body.quote_id && data) {
    const { data: quote } = await supabase.from('quotes').select('id, total, estado, notas').eq('id', body.quote_id).single();
    if (quote) {
      const { data: pagos } = await supabase.from('payments').select('monto').eq('quote_id', body.quote_id);
      const totalPagado = (pagos || []).reduce((s: number, p: any) => s + Number(p.monto || 0), 0);
      const total = Number(quote.total || 0);
      const saldoRestante = Math.max(0, total - totalPagado);
      const isPaid = totalPagado >= total && total > 0;

      const updates: any = {
        notas: appendTimeline(quote.notas, {
          event: 'pago_registrado',
          payment_id: data.id,
          monto: payload.monto,
          metodo: payload.metodo,
          numero_acuse: data.numero_acuse,
          total_pagado_acumulado: totalPagado,
        }),
      };
      const seCompleta = isPaid && quote.estado !== 'paid';
      if (seCompleta) {
        updates.estado = 'paid';
        updates.pagado_fecha = new Date().toISOString();
      }
      await supabase.from('quotes').update(updates).eq('id', body.quote_id);
      quoteUpdate = { totalPagado, saldoRestante, isPaid };

      // ── El abono que LIQUIDA la cotización cierra la venta ──
      // Antes esta puerta solo movía el estado: la oportunidad no se ganaba, el
      // lead no se volvía cliente y no nacía ninguna licencia. La venta quedaba
      // cobrada y en el CRM no existía. Best-effort: nunca tumba el registro
      // del pago (el dinero ya está guardado).
      if (seCompleta) {
        try {
          const { cerrarCotizacionPagada } = await import('../../../lib/crm/cobro-cotizacion');
          cierreResult = await cerrarCotizacionPagada(body.quote_id, { actor: 'pago-registrado' });
        } catch (e) {
          console.error('[payments] cierre de cotización pagada:', e);
        }
      }
    }
  }

  // Auto-enviar acuse por email si así se solicita
  let acuseResult: any = null;
  if (body.enviar_acuse && data?.id) {
    try {
      acuseResult = await sendAcuseEmail(data.id);
    } catch (err) {
      acuseResult = { ok: false, reason: String(err) };
    }
  }

  return new Response(
    JSON.stringify({ ...data, _quote: quoteUpdate, _acuse: acuseResult, _cierre: cierreResult }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
};
