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
  const clientId = url.searchParams.get('client_id') || '';
  const quoteId = url.searchParams.get('quote_id') || '';

  let query = supabase.from('payments').select('*, clients(empresa, contacto)').order('fecha', { ascending: false });

  if (clientId) query = query.eq('client_id', clientId);
  if (quoteId) query = query.eq('quote_id', quoteId);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  // Insert payment — schema accepts quote_id (added in migration-2026-04-payments-receipts.sql)
  const payload: any = {
    client_id: body.client_id || null,
    quote_id: body.quote_id || null,
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
    const fallback: any = { client_id: payload.client_id, fecha: payload.fecha, monto: payload.monto, metodo: payload.metodo, referencia: payload.referencia };
    const retry = await supabase.from('payments').insert(fallback).select().single();
    data = retry.data; error = retry.error;
  }

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Update client's next renewal date (legacy flow — solo si vino client_id)
  if (body.client_id) {
    const { data: client } = await supabase.from('clients').select('fecha_renovacion, precio_mensual').eq('id', body.client_id).single();
    if (client) {
      const currentDate = new Date(body.fecha);
      const isAnnual = body.monto >= (client.precio_mensual || 0) * 10;
      const months = isAnnual ? 12 : 1;
      currentDate.setMonth(currentDate.getMonth() + months);
      await supabase.from('clients').update({
        fecha_renovacion: currentDate.toISOString().slice(0, 10),
        estado: 'activo',
      }).eq('id', body.client_id);
    }
  }

  // Si el pago está ligado a una cotización, recalcular saldo y avanzar estado si se completa
  let quoteUpdate: { totalPagado: number; saldoRestante: number; isPaid: boolean } | null = null;
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
      if (isPaid && quote.estado !== 'paid') {
        updates.estado = 'paid';
        updates.pagado_fecha = new Date().toISOString();
      }
      await supabase.from('quotes').update(updates).eq('id', body.quote_id);
      quoteUpdate = { totalPagado, saldoRestante, isPaid };
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
    JSON.stringify({ ...data, _quote: quoteUpdate, _acuse: acuseResult }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
};
