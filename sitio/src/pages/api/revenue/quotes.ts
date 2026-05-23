import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { validatePartnerQuoteBody, canPartnerEditQuote } from '../../../lib/quotes/permissions';

export const prerender = false;

// Only pass known DB columns to avoid PostgREST errors
const QUOTE_FIELDS = [
  'empresa', 'contacto', 'email', 'whatsapp', 'items', 'iva_incluido',
  'descuento_global', 'descuento_tipo', 'moneda', 'template', 'condiciones',
  'vigencia', 'estado', 'subtotal', 'iva_monto', 'total', 'notas',
  'bank_account_id', 'mostrar_banco', 'link_pago', 'urgencia',
  'aceptado_por', 'aceptado_fecha',
  // Partner authorship
  'partner_id', 'created_via',
];

function pick(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const f of fields) {
    if (f in obj) result[f] = obj[f];
  }
  return result;
}

function jsonResponse(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  const id = url.searchParams.get('id');

  if (id) {
    // Public URL access needed (e.g., client accepting quote) — don't enforce scope on single lookup
    const { data, error } = await supabase.from('quotes').select('*').eq('id', id).single();
    if (error) return jsonResponse({ error: error.message }, 404);
    return jsonResponse(data);
  }

  // Partner scope: cotizaciones donde partner_id = user.id, con fallback legacy
  // (deal.owner_id / contact.owner_id) para cotizaciones previas a la migración.
  if (user && user.role === 'partner') {
    const { data: ownedDeals } = await supabase.from('deals').select('id').eq('owner_id', user.id);
    const dealIds = (ownedDeals || []).map((d: any) => d.id);
    const { data: ownedContacts } = await supabase.from('contacts').select('id').eq('owner_id', user.id);
    const contactIds = (ownedContacts || []).map((c: any) => c.id);

    const orParts: string[] = [`partner_id.eq.${user.id}`];
    if (dealIds.length) orParts.push(`deal_id.in.(${dealIds.join(',')})`);
    if (contactIds.length) orParts.push(`contact_id.in.(${contactIds.join(',')})`);

    const { data, error } = await supabase
      .from('quotes').select('*')
      .or(orParts.join(','))
      .order('created_at', { ascending: false });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse(data || []);
  }

  // Founder/cs see all. Unauthenticated preserves legacy behavior (admin UI without auth header).
  const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse(data || []);
};

async function getMaxFolio(): Promise<number> {
  const { data } = await supabase.from('quotes').select('numero');
  let max = 0;
  if (Array.isArray(data)) {
    for (const row of data) {
      const m = String(row?.numero || '').match(/(\d+)\s*$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
  }
  return max;
}

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  const body = await request.json();

  // Validación de permisos del partner ANTES de limpiar
  if (user?.role === 'partner') {
    const permErr = validatePartnerQuoteBody(user, body);
    if (permErr) return jsonResponse({ error: permErr.message, code: permErr.code }, permErr.status);
  }

  const clean = pick(body, QUOTE_FIELDS);

  // Si el actor es un partner, forzamos partner_id = user.id y created_via = 'partner_portal'
  // (no confiamos en lo que mande el body).
  if (user?.role === 'partner') {
    clean.partner_id = user.id;
    clean.created_via = 'partner_portal';
  } else if (!clean.created_via) {
    clean.created_via = 'admin';
  }

  // Folio configurado = mínimo inicial (solo aplica cuando no hay folios más altos ya usados)
  const folioStart = (parseInt(body._folio_offset) || 0) + 1;

  const vigencia = clean.vigencia || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  const estado = clean.estado || 'draft';

  // Intento con reintentos por si hay colisión (race o UNIQUE constraint)
  const MAX_TRIES = 6;
  let lastErr: any = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const maxExisting = await getMaxFolio();
    const nextNum = Math.max(maxExisting + 1, folioStart) + attempt;
    const num = `COT-${String(nextNum).padStart(3, '0')}`;

    const { data, error } = await supabase.from('quotes').insert({
      ...clean,
      numero: num,
      vigencia,
      estado,
    }).select().single();

    if (!error) {
      return jsonResponse(data, 201);
    }
    lastErr = error;
    // 23505 = unique_violation de Postgres; si no es eso, no tiene sentido reintentar
    if (error.code !== '23505') break;
  }

  return jsonResponse({ error: lastErr?.message || 'No se pudo asignar folio' }, 500);
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  const body = await request.json();
  const { id } = body;
  if (!id) return jsonResponse({ error: 'id requerido' }, 400);

  // Fetch previous state before update (also for ownership / lock checks)
  const { data: prev } = await supabase
    .from('quotes')
    .select('estado, deal_id, total, partner_id')
    .eq('id', id)
    .single();

  if (!prev) return jsonResponse({ error: 'cotización no encontrada' }, 404);

  // Ownership / permission checks para partner
  if (user?.role === 'partner') {
    if (prev.partner_id && prev.partner_id !== user.id) {
      return jsonResponse({ error: 'no autorizado' }, 403);
    }
    if (!canPartnerEditQuote(prev.estado)) {
      return jsonResponse({
        error: `No puedes editar una cotización ${prev.estado}`,
        code: 'quote_locked',
      }, 409);
    }
    const permErr = validatePartnerQuoteBody(user, body);
    if (permErr) return jsonResponse({ error: permErr.message, code: permErr.code }, permErr.status);
  }

  const clean = pick(body, QUOTE_FIELDS);

  // Partner no puede reasignar partner_id ni cambiar created_via
  if (user?.role === 'partner') {
    delete clean.partner_id;
    delete clean.created_via;
  }

  const { data, error } = await supabase.from('quotes').update(clean).eq('id', id).select().single();

  if (error) return jsonResponse({ error: error.message }, 500);

  // ─── Sync to deal (non-blocking on errors) ───
  try {
    const { syncQuoteToDeal, advanceDealStage } = await import('../../../lib/crm/sync-quote-deal');
    const items = Array.isArray(data?.items) ? data.items : [];
    const monthlyPlan = items.filter((i: any) => i.tipo === 'plan' && i.periodo === 'mensual')
      .reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
    const recurMonthly = items.filter((i: any) => i.tipo === 'extra' && i.recurrente && i.periodo_extra !== 'anual')
      .reduce((s: number, i: any) => s + (i.monto || 0), 0);
    const valorMensual = Math.round(monthlyPlan + recurMonthly);
    const valorTotal = Math.round(data?.total || 0);

    // Draft → sent transition: advance deal to cotizacion_enviada
    const transitionedToSent = prev && prev.estado !== 'sent' && data?.estado === 'sent';
    if (transitionedToSent) {
      if (data?.deal_id) {
        await advanceDealStage(data.deal_id, 'cotizacion_enviada', {
          valor_total: valorTotal, valor_mensual: valorMensual, trigger: 'quote_sent',
        });
      } else {
        await syncQuoteToDeal(id, {
          targetStage: 'cotizacion_enviada', valor_total: valorTotal, valor_mensual: valorMensual, trigger: 'quote_sent',
        });
      }
    } else if (data?.deal_id && (valorTotal !== (prev?.total || 0))) {
      // Total changed → sync deal amounts without moving stage
      await supabase.from('deals').update({ valor_total: valorTotal, valor_mensual: valorMensual }).eq('id', data.deal_id);
    }
  } catch (syncErr) {
    console.error('[quotes PUT] deal sync error:', syncErr);
  }

  return jsonResponse(data);
};
