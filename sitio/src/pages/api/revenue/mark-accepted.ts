import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { syncQuoteToDeal, ensureContactForQuote } from '../../../lib/crm/sync-quote-deal';
import { notify, getSalesInbox } from '../../../lib/notify';

export const prerender = false;

function escapeXml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function generateSignatureSVG(name: string): string {
  const clean = String(name || '').trim() || 'Cliente';
  const width = Math.max(280, Math.min(560, clean.length * 24 + 40));
  const height = 96;
  const fontSize = 44;
  const escaped = escapeXml(clean);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>.sig{font-family:'Dancing Script','Brush Script MT','Lucida Handwriting','Segoe Script','Apple Chancery',cursive;font-size:${fontSize}px;fill:#1a1a1a;font-style:italic}</style><text x="24" y="${height - 28}" class="sig" transform="rotate(-3 ${width / 2} ${height / 2})">${escaped}</text></svg>`;
  const base64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

async function enqueueOnboardingTasks(quote: any, dealId: string | null, contactId: string | null) {
  const tasks = [
    { titulo: 'Activar cuenta del cliente', tipo: 'tarea', metadata: { task: true, due_in_hours: 24, category: 'onboarding', step: 'activar_cuenta' } },
    { titulo: 'Enviar email de bienvenida', tipo: 'tarea', metadata: { task: true, due_in_hours: 2, category: 'onboarding', step: 'email_bienvenida', auto: true } },
    { titulo: 'Agendar llamada de onboarding', tipo: 'tarea', metadata: { task: true, due_in_hours: 72, category: 'onboarding', step: 'onboarding_call' } },
  ];
  for (const t of tasks) {
    await supabase.from('activities').insert({
      contact_id: contactId,
      company_id: quote.company_id || null,
      deal_id: dealId,
      tipo: t.tipo,
      titulo: t.titulo,
      metadata: t.metadata,
      automatico: true,
    });
  }
}

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const body = await request.json();
    const { quoteId, aceptado_por, method, nota_interna } = body || {};

    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'quoteId requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const nombre = String(aceptado_por || '').trim();
    if (!nombre) {
      return new Response(JSON.stringify({ error: 'aceptado_por requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: quote, error: fetchErr } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (fetchErr || !quote) {
      return new Response(JSON.stringify({ error: 'cotización no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (quote.estado === 'paid') {
      return new Response(JSON.stringify({ error: 'la cotización ya está pagada' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    if (quote.estado === 'accepted') {
      return new Response(JSON.stringify({ error: 'la cotización ya está aceptada' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
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
    const firma = generateSignatureSVG(nombre);

    meta.firma_base64 = firma;
    meta.firma_auto = true;
    meta.aceptacion_method = method || 'admin_manual';
    if (nota_interna) meta.aceptacion_nota = String(nota_interna).slice(0, 1000);
    if (!meta.timeline) meta.timeline = [];
    meta.timeline.push({
      event: 'accepted',
      at: now,
      method: 'admin_manual',
      via: method || null,
      name: nombre,
    });

    const newNotas = textPart + sep + JSON.stringify(meta);

    const { error: updateErr } = await supabase
      .from('quotes')
      .update({
        estado: 'accepted',
        aceptado_por: nombre,
        aceptado_fecha: now,
        notas: newNotas,
      })
      .eq('id', quoteId);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // ─── Post-acceptance automation (non-blocking on errors) ───
    let dealResult: any = null;
    let contactId: string | null = quote.contact_id || null;
    try {
      // Ensure contact exists + linked to quote
      contactId = await ensureContactForQuote(quote);

      // Sync deal (create or advance to cerrada_ganada)
      const items = Array.isArray(quote.items) ? quote.items : [];
      const monthlyPlan = items.filter((i: any) => i.tipo === 'plan' && i.periodo === 'mensual')
        .reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
      const recurMonthly = items.filter((i: any) => i.tipo === 'extra' && i.recurrente && i.periodo_extra !== 'anual')
        .reduce((s: number, i: any) => s + (i.monto || 0), 0);
      const valorMensual = Math.round(monthlyPlan + recurMonthly);

      dealResult = await syncQuoteToDeal(quoteId, {
        targetStage: 'cerrada_ganada',
        trigger: 'quote_accepted',
        valor_total: Math.round(quote.total || 0),
        valor_mensual: valorMensual,
      });

      // Activity: cotizacion_aceptada
      await supabase.from('activities').insert({
        contact_id: contactId,
        company_id: quote.company_id || null,
        deal_id: dealResult?.dealId || null,
        tipo: 'cotizacion',
        titulo: `Cotización ${quote.numero || ''} aceptada`,
        metadata: {
          event: 'cotizacion_aceptada',
          quote_id: quoteId,
          total: quote.total,
          moneda: quote.moneda || 'MXN',
          method: method || 'admin_manual',
          aceptado_por: nombre,
        },
        automatico: true,
      });

      // Advance contact lifecycle → customer
      if (contactId) {
        await supabase
          .from('contacts')
          .update({ lifecycle_stage: 'cliente', tipo: 'cliente' })
          .eq('id', contactId);
      }

      // Enqueue onboarding tasks
      await enqueueOnboardingTasks(quote, dealResult?.dealId || null, contactId);

      // Notify owner + sales inbox
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
        contacto: quote.contacto,
        email: quote.email,
        whatsapp: quote.whatsapp,
        total: quote.total,
        moneda: quote.moneda || 'MXN',
        method: method || 'firma digital',
        nota_interna: nota_interna || '',
        adminUrl,
      };
      const targets = [getSalesInbox(), ownerEmail].filter(Boolean) as string[];
      for (const to of targets) {
        await notify({ channel: 'email', to, template: 'quote_accepted_owner', data: notifyData });
      }
    } catch (postErr) {
      console.error('[mark-accepted] post-acceptance flow error:', postErr);
      // Don't fail the request — quote is already marked accepted
    }

    return new Response(JSON.stringify({
      success: true,
      aceptado_por: nombre,
      aceptado_fecha: now,
      firma_base64: firma,
      deal_id: dealResult?.dealId || null,
      deal_created: !!dealResult?.created,
      deal_advanced: !!dealResult?.advanced,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
