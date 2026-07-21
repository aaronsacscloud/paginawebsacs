import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { syncQuoteToDeal, ensureContactForQuote } from '../../../lib/crm/sync-quote-deal';
import { notify, getSalesInbox } from '../../../lib/notify';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

function escapeXml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function generateSignatureSVG(name: string): string {
  const clean = String(name || '').trim() || 'Cliente';
  const fontSize = 44;
  // Aproximación de ancho: cada char ~ 0.55em del fontSize en cursive italic
  const width = Math.max(280, Math.min(620, Math.round(clean.length * fontSize * 0.55) + 48));
  const height = 96;
  const escaped = escapeXml(clean);
  // Atributos inline (no <style>) — mas confiable para SVG-as-img cross-browser.
  // font-family con cursive como fallback final por si las cursivas no estan disponibles.
  const fontFamily = 'Dancing Script, Brush Script MT, Lucida Handwriting, Segoe Script, Apple Chancery, cursive';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><text x="24" y="${height - 28}" font-family="${fontFamily}" font-size="${fontSize}" font-style="italic" fill="#1a1a1a" transform="rotate(-3 ${width / 2} ${height / 2})">${escaped}</text></svg>`;
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
    // Quién acepta: si el actor es un PARTNER, la aceptación queda registrada
    // a SU nombre con la etiqueta "(Partner)" — nunca como si el cliente hubiera
    // firmado. El nombre del body se ignora para evitar suplantar al cliente.
    const requester = await getCurrentUser(request);
    const isPartner = requester?.role === 'partner';
    const nombre = isPartner
      ? `${String(requester.nombre || aceptado_por || 'Partner').trim()} (Partner)`
      : String(aceptado_por || '').trim();
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

    // Partner: solo puede aceptar cotizaciones SUYAS (scoping por partner_id).
    if (isPartner && quote.partner_id !== requester.id) {
      return new Response(JSON.stringify({ error: 'Solo puedes aceptar cotizaciones tuyas' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
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
    const acceptMethod = isPartner ? 'partner_manual' : 'admin_manual';

    // Partner NO genera firma: el cliente no firmó nada — es una confirmación
    // verbal registrada. La página pública mostrará "Aceptada por <nombre> (Partner)"
    // sin imagen de firma (ya tolera meta.firma_base64 ausente).
    let firma: string | null = null;
    if (isPartner) {
      meta.aceptacion_partner = { id: requester.id, nombre: requester.nombre || null };
      meta.aceptacion_via = method || null;
      meta.aceptacion_method = 'partner_manual';
    } else {
      firma = generateSignatureSVG(nombre);
      meta.firma_base64 = firma;
      meta.firma_auto = true;
      meta.aceptacion_method = method || 'admin_manual';
    }
    if (nota_interna) meta.aceptacion_nota = String(nota_interna).slice(0, 1000);
    if (!meta.timeline) meta.timeline = [];
    meta.timeline.push({
      event: 'accepted',
      at: now,
      method: acceptMethod,
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
          method: acceptMethod,
          via: method || null,
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

      // ─── Cotización aceptada → crear la SUSCRIPCIÓN (idempotente) ───
      // Cierra el loop cotización→deal→suscripción: al ganar, nace la sub. Solo si la
      // empresa aún NO tiene una suscripción viva (no duplica en re-aceptación ni en
      // clientes ya activos). Nace 'programada' (aceptada, sin pagar); al registrar el
      // primer pago pasa a 'activa' (register-payment). Best-effort — nunca rompe la
      // aceptación. Hereda el partner_id (RR) de la cotización para la comisión.
      if (quote.company_id) {
        try {
          const { data: subViva } = await supabase.from('subscriptions').select('id')
            .eq('company_id', quote.company_id)
            .in('estado', ['activa', 'programada', 'pendiente_pago', 'pausada']).limit(1).maybeSingle();
          if (!subViva) {
            const items2 = Array.isArray(quote.items) ? quote.items : [];
            const annualPlan = items2.filter((i: any) => i.tipo === 'plan' && i.periodo === 'anual').reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
            const ciclo = valorMensual > 0 ? 'mensual' : (annualPlan > 0 ? 'anual' : null);
            const precio = ciclo === 'mensual' ? valorMensual : (ciclo === 'anual' ? Math.round(annualPlan) : 0);
            if (ciclo && precio > 0) {
              const planItem = items2.find((i: any) => i.tipo === 'plan');
              const nombrePlan = String(planItem?.nombre || planItem?.label || planItem?.descripcion || 'Licencia SACS').slice(0, 160);
              const hoy = now.slice(0, 10);
              const mrr = ciclo === 'anual' ? precio / 12 : precio;
              await supabase.from('subscriptions').insert({
                company_id: quote.company_id, contact_id: contactId,
                nombre_plan: nombrePlan, ciclo, estado: 'programada', precio,
                mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100,
                fecha_inicio: hoy, proxima_factura: hoy, monto_proximo: precio,
                ...(quote.partner_id ? { partner_id: quote.partner_id } : {}),
              });
            }
          }
        } catch { /* la suscripción nunca bloquea la aceptación de la cotización */ }
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

      // Si la cotización fue creada por un partner, incluir su perfil + destinatario + reply-to
      let partnerProfile: any = null;
      if (quote.partner_id) {
        const { getPartnerProfile } = await import('../../../lib/partners/profile');
        partnerProfile = await getPartnerProfile(quote.partner_id);
      }

      const notifyData = {
        numero: quote.numero,
        empresa: quote.empresa,
        contacto: quote.contacto,
        email: quote.email,
        whatsapp: quote.whatsapp,
        total: quote.total,
        moneda: quote.moneda || 'MXN',
        method: isPartner
          ? `confirmada por el partner${method ? ` vía ${method}` : ''}`
          : (method || 'firma digital'),
        nota_interna: nota_interna || '',
        adminUrl,
        partner: partnerProfile,
      };

      const targets = Array.from(new Set([
        getSalesInbox(),
        ownerEmail,
        partnerProfile?.email || null,
      ].filter(Boolean))) as string[];

      for (const to of targets) {
        await notify({
          channel: 'email',
          to,
          template: 'quote_accepted_owner',
          data: notifyData,
          replyTo: partnerProfile?.email || undefined,
        });
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
