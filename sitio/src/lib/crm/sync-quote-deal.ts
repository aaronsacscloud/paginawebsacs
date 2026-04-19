// Idempotent helpers to keep quotes ↔ deals in sync.
// All functions accept a supabase client and are safe to re-run.
// Used by mark-accepted, mark-rejected, quotes PUT, and aging cron.

import { supabase } from '../supabase';

export type DealStage =
  | 'calificacion'
  | 'demo_agendada'
  | 'demo_realizada'
  | 'cotizacion_enviada'
  | 'negociacion'
  | 'cerrada_ganada'
  | 'cerrada_perdida';

const STAGE_ORDER: DealStage[] = [
  'calificacion',
  'demo_agendada',
  'demo_realizada',
  'cotizacion_enviada',
  'negociacion',
  'cerrada_ganada',
];

function isEarlierStage(a: DealStage, b: DealStage): boolean {
  const ia = STAGE_ORDER.indexOf(a);
  const ib = STAGE_ORDER.indexOf(b);
  if (ia < 0 || ib < 0) return false;
  return ia < ib;
}

function parseNotas(notas: string | null | undefined): { text: string; meta: any } {
  const sep = '\n---META---\n';
  const raw = notas || '';
  const idx = raw.indexOf(sep);
  if (idx < 0) return { text: raw, meta: {} };
  try {
    return { text: raw.slice(0, idx), meta: JSON.parse(raw.slice(idx + sep.length)) || {} };
  } catch {
    return { text: raw.slice(0, idx), meta: {} };
  }
}

/**
 * Ensure a contact exists for the given quote. Upserts by email/whatsapp if no contact_id.
 * Returns the contact_id.
 */
export async function ensureContactForQuote(quote: any): Promise<string | null> {
  if (quote.contact_id) return quote.contact_id;
  const email = (quote.email || '').trim().toLowerCase();
  const whatsapp = (quote.whatsapp || '').trim();
  if (!email && !whatsapp) return null;

  // Try find existing contact
  let existing: any = null;
  if (email) {
    const { data } = await supabase.from('contacts').select('id').eq('email', email).limit(1).maybeSingle();
    existing = data;
  }
  if (!existing && whatsapp) {
    const { data } = await supabase.from('contacts').select('id').eq('whatsapp', whatsapp).limit(1).maybeSingle();
    existing = data;
  }
  if (existing?.id) {
    await supabase.from('quotes').update({ contact_id: existing.id }).eq('id', quote.id);
    return existing.id;
  }

  // Create new contact
  const { data: created } = await supabase
    .from('contacts')
    .insert({
      nombre: quote.contacto || quote.empresa || 'Contacto',
      email: email || null,
      whatsapp: whatsapp || null,
      lifecycle_stage: 'oportunidad',
      tipo: 'lead',
      fuente: 'cotizacion',
    })
    .select('id')
    .single();

  if (created?.id) {
    await supabase.from('quotes').update({ contact_id: created.id }).eq('id', quote.id);
    return created.id;
  }
  return null;
}

/**
 * Advance a deal's stage, but only forward (never back). Returns the updated deal.
 * If stage is a close stage, sets closed_at and probabilidad.
 */
export async function advanceDealStage(dealId: string, targetStage: DealStage, ctx: { valor_total?: number; valor_mensual?: number; motivo_perdida?: string; trigger?: string } = {}) {
  const { data: deal } = await supabase.from('deals').select('*').eq('id', dealId).single();
  if (!deal) return null;

  const currentStage: DealStage = deal.stage;

  // Safeguard: never revive a deal that is already cerrada_perdida
  if (currentStage === 'cerrada_perdida' && targetStage === 'cerrada_ganada') {
    await supabase.from('activities').insert({
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      deal_id: dealId,
      tipo: 'sistema',
      titulo: 'Revisión requerida: cotización aceptada sobre deal perdido',
      metadata: { current: currentStage, attempted: targetStage, trigger: ctx.trigger || 'unknown' },
      automatico: true,
    });
    return deal;
  }

  // For non-close targets, only advance forward
  if (targetStage !== 'cerrada_ganada' && targetStage !== 'cerrada_perdida') {
    if (!isEarlierStage(currentStage, targetStage)) return deal;
  }

  const updates: any = {
    stage: targetStage,
    stage_changed_at: new Date().toISOString(),
  };
  if (ctx.valor_total !== undefined) updates.valor_total = ctx.valor_total;
  if (ctx.valor_mensual !== undefined) updates.valor_mensual = ctx.valor_mensual;
  if (targetStage === 'cerrada_ganada') {
    updates.probabilidad = 100;
    updates.closed_at = new Date().toISOString();
  }
  if (targetStage === 'cerrada_perdida') {
    updates.probabilidad = 0;
    updates.closed_at = new Date().toISOString();
    if (ctx.motivo_perdida) updates.motivo_perdida = ctx.motivo_perdida;
  }

  const { data: updated } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', dealId)
    .select()
    .single();

  await supabase.from('activities').insert({
    contact_id: deal.contact_id,
    company_id: deal.company_id,
    deal_id: dealId,
    tipo: 'sistema',
    titulo: `Deal avanzó a ${targetStage}`,
    metadata: { from: currentStage, to: targetStage, trigger: ctx.trigger || 'system' },
    automatico: true,
  });

  return updated;
}

/**
 * Create a new deal from a quote (when quote has no deal_id yet).
 * Sets quote.deal_id back-reference. Returns the new deal.
 */
export async function createDealFromQuote(quote: any, targetStage: DealStage, ctx: { trigger?: string; motivo_perdida?: string } = {}) {
  const contactId = await ensureContactForQuote(quote);
  if (!contactId) {
    console.warn('[sync-quote-deal] cannot create deal without contact');
    return null;
  }

  // Pull plan info from items
  const items = Array.isArray(quote.items) ? quote.items : [];
  const planItem = items.find((i: any) => i.tipo === 'plan');
  const plan = planItem?.nombre || null;
  const sucursales = parseInt(planItem?.sucursales) || 1;
  const billingPeriod = planItem?.periodo || null;

  // Calculate valor mensual from monthly items only
  const monthlyItems = items.filter((i: any) => i.tipo === 'plan' && i.periodo === 'mensual');
  const recurMonthly = items.filter((i: any) => i.tipo === 'extra' && i.recurrente && i.periodo_extra !== 'anual');
  const valorMensual = monthlyItems.reduce((s: number, i: any) => s + (i.subtotal || 0), 0) +
    recurMonthly.reduce((s: number, i: any) => s + (i.monto || 0), 0);

  // Try to find contact owner
  const { data: contact } = await supabase.from('contacts').select('owner_id, company_id').eq('id', contactId).single();

  const insertPayload: any = {
    nombre: `Deal — ${quote.empresa || quote.contacto || 'Cliente'}`,
    contact_id: contactId,
    company_id: contact?.company_id || null,
    plan,
    sucursales,
    billing_period: billingPeriod,
    valor_mensual: Math.round(valorMensual),
    valor_total: Math.round(quote.total || 0),
    stage: targetStage,
    quote_id: quote.id,
    owner_id: contact?.owner_id || null,
  };
  if (targetStage === 'cerrada_ganada') {
    insertPayload.probabilidad = 100;
    insertPayload.closed_at = new Date().toISOString();
  }
  if (targetStage === 'cerrada_perdida') {
    insertPayload.probabilidad = 0;
    insertPayload.closed_at = new Date().toISOString();
    if (ctx.motivo_perdida) insertPayload.motivo_perdida = ctx.motivo_perdida;
  }

  const { data: deal } = await supabase.from('deals').insert(insertPayload).select().single();
  if (!deal) return null;

  // Back-reference on quote
  await supabase.from('quotes').update({ deal_id: deal.id }).eq('id', quote.id);

  // Activity
  await supabase.from('activities').insert({
    contact_id: contactId,
    company_id: insertPayload.company_id,
    deal_id: deal.id,
    tipo: 'sistema',
    titulo: `Deal creado automáticamente: ${targetStage}`,
    metadata: { trigger: ctx.trigger || 'quote_sync', quote_id: quote.id, stage: targetStage },
    automatico: true,
  });

  return deal;
}

/**
 * High-level: sync a quote to its deal (create-or-advance).
 * Returns { dealId, created, advanced, skipped }.
 */
export async function syncQuoteToDeal(
  quoteId: string,
  options: {
    targetStage: DealStage;
    motivo_perdida?: string;
    trigger?: string;
    valor_total?: number;
    valor_mensual?: number;
  }
): Promise<{ dealId: string | null; created: boolean; advanced: boolean; skipped: boolean }> {
  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
  if (!quote) return { dealId: null, created: false, advanced: false, skipped: true };

  if (quote.deal_id) {
    const updated = await advanceDealStage(quote.deal_id, options.targetStage, options);
    const advanced = !!updated && updated.stage === options.targetStage;
    return { dealId: quote.deal_id, created: false, advanced, skipped: !advanced };
  }

  const deal = await createDealFromQuote(quote, options.targetStage, options);
  return { dealId: deal?.id || null, created: !!deal, advanced: false, skipped: !deal };
}
