// Helper para enviar el acuse de pago al cliente por email.
// Usado por la API /api/revenue/payments/[id]/send-acuse y por stripe-webhook.

import { supabase } from '../supabase';
import { notify } from '../notify';

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

function fmtDateEs(d: string | null | undefined): string {
  if (!d) return '';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '';
  const day = date.getDate();
  const month = date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export async function sendAcuseEmail(paymentId: string): Promise<{ ok: boolean; reason?: string; id?: string }> {
  if (!paymentId) return { ok: false, reason: 'missing_payment_id' };

  const { data: payment, error: pErr } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (pErr || !payment) return { ok: false, reason: 'payment_not_found' };

  if (!payment.quote_id) {
    return { ok: false, reason: 'payment_has_no_quote' };
  }

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, numero, empresa, contacto, email, total, moneda, items, notas')
    .eq('id', payment.quote_id)
    .single();

  if (!quote) return { ok: false, reason: 'quote_not_found' };

  const recipient = (quote.email || '').trim();
  if (!recipient) return { ok: false, reason: 'quote_has_no_email' };

  // Total pagado hasta ahora (incluye este pago)
  const { data: allPayments } = await supabase
    .from('payments')
    .select('monto')
    .eq('quote_id', quote.id);
  const totalPagado = (allPayments || []).reduce((s: number, p: any) => s + Number(p.monto || 0), 0);
  const saldoRestante = Math.max(0, Number(quote.total || 0) - totalPagado);

  // Items cubiertos por este pago — si el pago tiene items_cubiertos usa eso, si no muestra todo
  const quoteItems = Array.isArray(quote.items) ? quote.items : [];
  let coveredItems: any[] = quoteItems;
  if (Array.isArray(payment.items_cubiertos) && payment.items_cubiertos.length > 0) {
    const ids = new Set(payment.items_cubiertos);
    coveredItems = quoteItems.filter((_, i) => ids.has(i) || ids.has(String(i)));
    if (coveredItems.length === 0) coveredItems = quoteItems;
  }
  const itemsForEmail = coveredItems.map((it: any) => ({
    label: it.tipo === 'plan'
      ? `Plan ${it.nombre}${it.sucursales ? ` · ${it.sucursales} suc.` : ''}${it.periodo ? ` (${it.periodo})` : ''}`
      : it.nombre || 'Concepto',
    monto: Number(it.subtotal || it.monto || 0),
  }));

  const acuseUrl = `https://www.sacscloud.com/acuse/${payment.id}`;

  const result = await notify({
    channel: 'email',
    to: recipient,
    template: 'payment_receipt_client',
    data: {
      numero_acuse: payment.numero_acuse,
      monto: Number(payment.monto || 0),
      metodo: payment.metodo,
      fecha: fmtDateEs(payment.fecha),
      referencia: payment.referencia,
      contacto: quote.contacto || '',
      empresa: quote.empresa || '',
      quote_numero: quote.numero || '',
      totalCotizacion: Number(quote.total || 0),
      saldoRestante,
      items: itemsForEmail,
      acuseUrl,
    },
  });

  // Anexar evento al timeline de la cotización
  if (result.ok) {
    const newNotas = appendTimeline(quote.notas, {
      event: 'acuse_enviado',
      payment_id: payment.id,
      numero_acuse: payment.numero_acuse,
      to: recipient,
    });
    await supabase.from('quotes').update({ notas: newNotas }).eq('id', quote.id);
  }

  return result;
}
